const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const db = require('../config/db');
const usersStore = require('../store/usersStore');
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

  // Register in in-memory usersStore
  const existingMock = usersStore.findUserByEmail(cleanEmail);
  if (existingMock) {
    return res.status(400).json({ success: false, error: 'An account with this email address already exists.' });
  }

  const newUser = usersStore.addUser({
    id: userId,
    full_name: full_name.trim(),
    email: cleanEmail,
    phone: phone || '',
    passwordHash,
    role: 'customer'
  });

  try {
    await db.query(
      'INSERT INTO users (id, full_name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, full_name.trim(), cleanEmail, phone || '', passwordHash, 'customer']
    );
  } catch (error) {
    console.warn('DB Signup error, using usersStore fallback:', error.message);
  }

  const token = jwt.sign({ userId, role: 'customer' }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('token', token, COOKIE_OPTIONS);

  return res.json({
    success: true,
    user: { id: newUser.id, full_name: newUser.full_name, email: newUser.email, phone: newUser.phone, role: newUser.role }
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
      const mock = usersStore.findUserByEmail(cleanEmail);
      if (mock && await bcrypt.compare(password, mock.passwordHash)) {
        const token = jwt.sign({ userId: mock.id, role: mock.role }, JWT_SECRET, { expiresIn: '7d' });
        res.cookie('token', token, COOKIE_OPTIONS);
        return res.json({
          success: true,
          user: { id: mock.id, full_name: mock.full_name, email: mock.email, phone: mock.phone, role: mock.role }
        });
      }

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
    console.warn('DB Login error, checking usersStore:', error.message);
    const mock = usersStore.findUserByEmail(cleanEmail);
    if (mock && await bcrypt.compare(password, mock.passwordHash)) {
      const token = jwt.sign({ userId: mock.id, role: mock.role }, JWT_SECRET, { expiresIn: '7d' });
      res.cookie('token', token, COOKIE_OPTIONS);
      return res.json({
        success: true,
        user: { id: mock.id, full_name: mock.full_name, email: mock.email, phone: mock.phone, role: mock.role }
      });
    }

    return res.status(401).json({ success: false, error: 'Invalid email or password.' });
  }
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

    const mock = usersStore.findUserById(req.user.id);
    if (mock) {
      return res.json({
        success: true,
        user: { id: mock.id, full_name: mock.full_name, email: mock.email, phone: mock.phone, role: mock.role || 'customer' }
      });
    }

    return res.status(401).json({ success: false, error: 'User not found' });
  } catch (error) {
    const mock = usersStore.findUserById(req.user.id);
    if (mock) {
      return res.json({
        success: true,
        user: { id: mock.id, full_name: mock.full_name, email: mock.email, phone: mock.phone, role: mock.role || 'customer' }
      });
    }

    if (req.user.email === 'admin@crystalcrest.com' || req.user.role === 'admin') {
      return res.json({
        success: true,
        user: { id: 'usr-admin-001', full_name: 'Executive Administrator', email: 'admin@crystalcrest.com', role: 'admin' }
      });
    }

    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
});

module.exports = router;
