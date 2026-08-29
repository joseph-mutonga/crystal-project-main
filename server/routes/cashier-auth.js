const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const db = require('../config/db');
const cashiersStore = require('../store/cashiersStore');
const { requireCashier } = require('../middleware/permissions');

const JWT_SECRET = process.env.JWT_SECRET || 'crystal_crest_jwt_secret_key_2026';
const CASHIER_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  maxAge: 8 * 60 * 60 * 1000 // 8 hours shift session
};

// Rate limiter for Cashier 4-digit PIN attempts (10 attempts per 15 minutes per IP)
const cashierPinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: 'Too many PIN verification attempts. Please wait 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

// POST /api/auth/cashier-login
router.post('/cashier-login', cashierPinLimiter, async (req, res) => {
  const { pin } = req.body;

  if (!pin) {
    return res.status(400).json({ success: false, error: 'Cashier numeric PIN is required.' });
  }

  const pinHash = crypto.createHash('sha256').update(pin.toString().trim()).digest('hex');

  try {
    const [rows] = await db.query(
      'SELECT id, name, pin_hash, is_active FROM cashiers WHERE pin_hash = ?',
      [pinHash]
    );

    let cashier = null;
    if (rows && rows.length > 0) {
      cashier = rows[0];
    } else {
      cashier = cashiersStore.findAnyCashierByPinHash(pinHash);
    }

    if (!cashier) {
      return res.status(401).json({ success: false, error: 'Invalid Cashier PIN. Please try again.' });
    }

    if (!cashier.is_active || cashier.is_active === 0 || cashier.is_active === '0' || cashier.is_active === false) {
      return res.status(403).json({ success: false, error: 'This PIN is no longer active. Contact your administrator.' });
    }

    const token = jwt.sign(
      { cashierId: cashier.id, name: cashier.name, role: 'cashier' },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.cookie('cc_cashier_token', token, CASHIER_COOKIE_OPTIONS);

    return res.json({
      success: true,
      cashier: { id: cashier.id, name: cashier.name }
    });

  } catch (error) {
    console.warn('DB Cashier auth fallback:', error.message);
    const cashier = cashiersStore.findAnyCashierByPinHash(pinHash);

    if (!cashier) {
      return res.status(401).json({ success: false, error: 'Invalid Cashier PIN. Please try again.' });
    }

    if (!cashier.is_active || cashier.is_active === 0 || cashier.is_active === '0' || cashier.is_active === false) {
      return res.status(403).json({ success: false, error: 'This PIN is no longer active. Contact your administrator.' });
    }

    const token = jwt.sign(
      { cashierId: cashier.id, name: cashier.name, role: 'cashier' },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.cookie('cc_cashier_token', token, CASHIER_COOKIE_OPTIONS);

    return res.json({
      success: true,
      cashier: { id: cashier.id, name: cashier.name }
    });
  }
});

// GET /api/auth/cashier-me
router.get('/cashier-me', requireCashier, (req, res) => {
  return res.json({
    success: true,
    cashier: {
      id: req.cashier.id,
      name: req.cashier.name
    }
  });
});

// POST /api/auth/cashier-logout
router.post('/cashier-logout', (req, res) => {
  res.clearCookie('cc_cashier_token', CASHIER_COOKIE_OPTIONS);
  return res.json({ success: true, message: 'Cashier logged out successfully.' });
});

module.exports = router;
