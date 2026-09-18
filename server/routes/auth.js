const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'crystal_crest_jwt_secret_key_2026';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
};

// Rate limiter for authentication attempts (10 attempts per 15 minutes per IP)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: 'Too many authentication attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, error: 'Too many password reset requests. Please wait 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});
// Rate limiters for customer email OTP login (separate from password reset, above)
const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 6,
  message: { success: false, error: 'Too many verification code requests. Please wait 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});
const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, error: 'Too many verification attempts. Please wait 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});
const inMemoryPasswordResets = new Map();
const inMemoryLoginOtps = new Map();
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_EXPIRY_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

function createMailTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 465,
    secure: SMTP_SECURE !== 'false',
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
}

// Dedicated transport for customer login OTP emails, sent via a Gmail account using an
// App Password (never the account's real password). Falls back to the generic SMTP_*
// transport above if Gmail-specific credentials are not configured.
function createLoginOtpMailTransport() {
  const { EMAIL_USER, EMAIL_APP_PASSWORD } = process.env;
  if (EMAIL_USER && EMAIL_APP_PASSWORD) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user: EMAIL_USER, pass: EMAIL_APP_PASSWORD }
    });
  }
  return createMailTransport();
}

// POST /api/auth/signup
router.post('/signup', authLimiter, async (req, res) => {
  const { full_name, email, password, phone } = req.body;

  if (!full_name || !email || !password) {
    return res.status(400).json({ success: false, error: 'Full name, email, and password are required.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long.' });
  }

  const userId = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(password, 10);
  const cleanEmail = email.toLowerCase().trim();

  try {
    await db.query(
      'INSERT INTO users (id, full_name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, full_name.trim(), cleanEmail, phone || '', passwordHash, 'customer']
    );
  } catch (error) {
    const message = error.code === 'ER_DUP_ENTRY' ? 'An account with this email address already exists.' : 'Unable to create account.';
    return res.status(error.code === 'ER_DUP_ENTRY' ? 400 : 500).json({ success: false, error: message });
  }

  const token = jwt.sign({ userId, role: 'customer' }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('token', token, COOKIE_OPTIONS);

  return res.json({
    success: true,
    user: { id: userId, full_name: full_name.trim(), email: cleanEmail, phone: phone || '', role: 'customer' }
  });
});

// POST /api/auth/login
router.post('/login', authLimiter, async (req, res) => {
  const { email, password, otp } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required.' });
  }

  const cleanEmail = email.toLowerCase().trim();

  // Cashiers use the same email/password login screen, then complete the admin-issued OTP challenge.
  try {
    const [cashierRows] = await db.query(
      'SELECT id, name, username, password_hash, otp_hash, is_active FROM cashiers WHERE username = ? LIMIT 1',
      [cleanEmail]
    );
    const cashier = cashierRows?.[0];
    if (cashier) {
      if (!cashier.is_active || cashier.is_active === 0 || cashier.is_active === '0') {
        return res.status(403).json({ success: false, error: 'This cashier account has been deactivated.' });
      }
      const validPassword = await bcrypt.compare(password, cashier.password_hash || '');
      if (!validPassword) return res.status(401).json({ success: false, error: 'Invalid email or password.' });
      if (!otp) {
        return res.json({ success: true, requiresCashierOtp: true, cashier: { id: cashier.id, name: cashier.name, email: cashier.username } });
      }
      const validOtp = await bcrypt.compare(String(otp).trim(), cashier.otp_hash || '');
      if (!validOtp || !/^\d{4}$/.test(String(otp).trim())) {
        return res.status(401).json({ success: false, error: 'Invalid 4-digit administrator OTP.' });
      }
      const token = jwt.sign({ cashierId: cashier.id, name: cashier.name, role: 'cashier' }, JWT_SECRET, { expiresIn: '8h' });
      res.cookie('cc_cashier_token', token, COOKIE_OPTIONS);
      return res.json({ success: true, cashierLogin: true, user: { id: cashier.id, full_name: cashier.name, email: cashier.username, role: 'cashier' } });
    }
  } catch (cashierError) {
    console.warn('Cashier customer-login lookup failed:', cashierError.message);
  }

  try {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [cleanEmail]);

    if (!rows || rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    const token = jwt.sign({ userId: user.id, role: user.role || 'customer' }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, COOKIE_OPTIONS);

    return res.json({
      success: true,
      user: { id: user.id, full_name: user.full_name, email: user.email, phone: user.phone, role: user.role || 'customer' }
    });

  } catch (error) {
    console.error('DB Login error:', error.message);
    return res.status(500).json({ success: false, error: 'Unable to sign in.' });
  }
});

// POST /api/auth/forgot-password - Send an expiring reset code without exposing account existence.
router.post('/forgot-password', passwordResetLimiter, async (req, res) => {
  const email = String(req.body?.email || '').toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, error: 'Enter a valid email address.' });
  }

  const transporter = createMailTransport();
  if (!transporter) {
    return res.status(503).json({ success: false, error: 'Email service is not configured. Please contact support.' });
  }

  let user;
  try {
    const [rows] = await db.query('SELECT id, email FROM users WHERE email = ? LIMIT 1', [email]);
    user = rows?.[0];
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Unable to process password reset.' });
  }

  const response = { success: true, message: 'If an account exists for this email, a reset code has been sent.' };
  if (!user) return res.json(response);

  const otp = crypto.randomInt(100000, 1000000).toString();
  const otpHash = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: 'Crystal Crest password reset code',
      text: `Your Crystal Crest password reset code is ${otp}. It expires in 10 minutes. Do not share this code.`
    });

    try {
      await db.query(
        `INSERT INTO password_reset_otps (email, otp_hash, expires_at, attempts)
         VALUES (?, ?, ?, 0)
         ON DUPLICATE KEY UPDATE otp_hash = VALUES(otp_hash), expires_at = VALUES(expires_at), attempts = 0`,
        [email, otpHash, expiresAt]
      );
      inMemoryPasswordResets.delete(email);
    } catch (databaseError) {
      inMemoryPasswordResets.set(email, { otp_hash: otpHash, expires_at: expiresAt, attempts: 0 });
    }
    return res.json(response);
  } catch (error) {
    console.error('[Password reset] Failed to send email:', error.message);
    return res.status(502).json({ success: false, error: 'Unable to send the reset code. Please try again.' });
  }
});

// POST /api/auth/reset-password - Verify reset OTP and update a customer or admin password.
router.post('/reset-password', passwordResetLimiter, async (req, res) => {
  const email = String(req.body?.email || '').toLowerCase().trim();
  const otp = String(req.body?.otp || '').trim();
  const password = String(req.body?.password || '');

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{6}$/.test(otp)) {
    return res.status(400).json({ success: false, error: 'Enter your email and the 6-digit reset code.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long.' });
  }

  let record;
  let useMemoryRecord = false;
  try {
    const [rows] = await db.query('SELECT otp_hash, expires_at, attempts FROM password_reset_otps WHERE email = ? LIMIT 1', [email]);
    record = rows?.[0];
    if (!record && inMemoryPasswordResets.has(email)) {
      record = inMemoryPasswordResets.get(email);
      useMemoryRecord = true;
    }
  } catch (databaseError) {
    record = inMemoryPasswordResets.get(email);
    useMemoryRecord = true;
  }

  if (!record || new Date(record.expires_at) <= new Date()) {
    return res.status(400).json({ success: false, error: 'This reset code has expired. Request a new one.' });
  }
  if (Number(record.attempts) >= 5) {
    return res.status(429).json({ success: false, error: 'Too many invalid codes. Request a new one.' });
  }
  if (!await bcrypt.compare(otp, record.otp_hash)) {
    if (useMemoryRecord) {
      record.attempts += 1;
    } else {
      await db.query('UPDATE password_reset_otps SET attempts = attempts + 1 WHERE email = ?', [email]);
    }
    return res.status(401).json({ success: false, error: 'Invalid reset code.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  let updated = false;
  try {
    const [result] = await db.query('UPDATE users SET password_hash = ? WHERE email = ?', [passwordHash, email]);
    updated = result.affectedRows > 0;
  } catch (databaseError) {}

  if (!updated) return res.status(404).json({ success: false, error: 'Account not found.' });

  if (useMemoryRecord) {
    inMemoryPasswordResets.delete(email);
  } else {
    try { await db.query('DELETE FROM password_reset_otps WHERE email = ?', [email]); } catch (databaseError) {}
  }
  return res.json({ success: true, message: 'Password updated. You can now sign in.' });
});

// POST /api/auth/request-otp - Send a 6-digit customer login verification code by email.
// Response is intentionally generic and does not reveal whether an account exists.
router.post('/request-otp', otpRequestLimiter, async (req, res) => {
  const email = String(req.body?.email || '').toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, error: 'Enter a valid email address.' });
  }

  const transporter = createLoginOtpMailTransport();
  if (!transporter) {
    return res.status(503).json({ success: false, error: 'Email service is not configured. Please contact support.' });
  }

  const now = new Date();

  // Resend cooldown is enforced per email regardless of whether an account exists for it,
  // so response timing/behavior never reveals account existence.
  let existingRecord;
  try {
    const [rows] = await db.query('SELECT last_sent_at FROM otp_verifications WHERE email = ? LIMIT 1', [email]);
    existingRecord = rows?.[0];
  } catch (databaseError) {
    existingRecord = inMemoryLoginOtps.get(email);
  }

  if (existingRecord && existingRecord.last_sent_at) {
    const elapsedMs = now.getTime() - new Date(existingRecord.last_sent_at).getTime();
    if (elapsedMs < OTP_RESEND_COOLDOWN_MS) {
      const retryAfterSeconds = Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsedMs) / 1000);
      return res.status(429).json({ success: false, error: `Please wait ${retryAfterSeconds}s before requesting a new code.`, retryAfterSeconds });
    }
  }

  let user;
  try {
    const [rows] = await db.query('SELECT id, email, full_name FROM users WHERE email = ? LIMIT 1', [email]);
    user = rows?.[0];
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Unable to process verification code request.' });
  }

  // Cryptographically secure random 6-digit OTP (100000-999999).
  const otp = crypto.randomInt(100000, 1000000).toString();
  const otpHash = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MS);

  // Only a matching account ever receives the email; a non-existent email silently no-ops here.
  if (user) {
    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.EMAIL_USER || process.env.SMTP_USER,
        to: email,
        subject: 'Your Verification Code',
        text: `Hello,\n\nYour verification code is:\n\n${otp}\n\nThis code expires in 10 minutes.\n\nIf you did not request this code, you can ignore this email.`,
        html: `<p>Hello,</p><p>Your verification code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px;margin:16px 0;">${otp}</p><p>This code expires in 10 minutes.</p><p>If you did not request this code, you can ignore this email.</p>`
      });
    } catch (error) {
      console.error('[Login OTP] Failed to send email:', error.message);
      return res.status(502).json({ success: false, error: 'Unable to send the verification code. Please try again.' });
    }
  }

  try {
    await db.query(
      `INSERT INTO otp_verifications (email, otp_hash, expires_at, attempts, last_sent_at)
       VALUES (?, ?, ?, 0, ?)
       ON DUPLICATE KEY UPDATE otp_hash = VALUES(otp_hash), expires_at = VALUES(expires_at), attempts = 0, last_sent_at = VALUES(last_sent_at)`,
      [email, otpHash, expiresAt, now]
    );
    inMemoryLoginOtps.delete(email);
  } catch (databaseError) {
    inMemoryLoginOtps.set(email, { otp_hash: otpHash, expires_at: expiresAt, attempts: 0, last_sent_at: now });
  }

  return res.json({
    success: true,
    message: 'If an account exists for this email, a verification code has been sent.',
    cooldownSeconds: 60
  });
});

// POST /api/auth/verify-otp - Verify a customer login code and authenticate using the
// application's existing JWT cookie session mechanism (same as POST /api/auth/login).
router.post('/verify-otp', otpVerifyLimiter, async (req, res) => {
  const email = String(req.body?.email || '').toLowerCase().trim();
  const otp = String(req.body?.otp || '').trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{6}$/.test(otp)) {
    return res.status(400).json({ success: false, error: 'Enter your email and the 6-digit verification code.' });
  }

  let record;
  let useMemoryRecord = false;
  try {
    const [rows] = await db.query('SELECT otp_hash, expires_at, attempts FROM otp_verifications WHERE email = ? LIMIT 1', [email]);
    record = rows?.[0];
    if (!record && inMemoryLoginOtps.has(email)) {
      record = inMemoryLoginOtps.get(email);
      useMemoryRecord = true;
    }
  } catch (databaseError) {
    record = inMemoryLoginOtps.get(email);
    useMemoryRecord = true;
  }

  if (!record || new Date(record.expires_at) <= new Date()) {
    return res.status(400).json({ success: false, error: 'This verification code has expired or is invalid. Request a new one.' });
  }
  if (Number(record.attempts) >= OTP_MAX_ATTEMPTS) {
    return res.status(429).json({ success: false, error: 'Too many invalid attempts. Request a new code.' });
  }
  if (!await bcrypt.compare(otp, record.otp_hash)) {
    if (useMemoryRecord) {
      record.attempts += 1;
    } else {
      await db.query('UPDATE otp_verifications SET attempts = attempts + 1 WHERE email = ?', [email]);
    }
    return res.status(401).json({ success: false, error: 'Invalid verification code.' });
  }

  // Correct code — invalidate it immediately so it can never be reused, before authenticating.
  if (useMemoryRecord) {
    inMemoryLoginOtps.delete(email);
  } else {
    try { await db.query('DELETE FROM otp_verifications WHERE email = ?', [email]); } catch (databaseError) {}
  }

  let user;
  try {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
    user = rows?.[0];
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Unable to complete sign in.' });
  }

  if (!user) {
    // Should not normally happen (only real accounts are ever emailed a code), but never
    // authenticate or reveal account state if it does.
    return res.status(401).json({ success: false, error: 'Invalid verification code.' });
  }

  const token = jwt.sign({ userId: user.id, role: user.role || 'customer' }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('token', token, COOKIE_OPTIONS);

  return res.json({
    success: true,
    user: { id: user.id, full_name: user.full_name, email: user.email, phone: user.phone, role: user.role || 'customer' }
  });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token', COOKIE_OPTIONS);
  res.json({ success: true, message: 'Logged out successfully' });
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, full_name, email, phone, role, created_at FROM users WHERE id = ?', [req.user.id]);
    if (rows && rows.length > 0) {
      return res.json({ success: true, user: rows[0] });
    }

    return res.status(401).json({ success: false, error: 'User not found' });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Unable to retrieve account.' });
  }
});

module.exports = router;
