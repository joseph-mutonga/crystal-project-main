const jwt = require('jsonwebtoken');
const db = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'crystal_crest_jwt_secret_key_2026';

// Require JWT Cookie or Authorization Header
async function requireAuth(req, res, next) {
  let token = req.cookies ? req.cookies.token : null;

  if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication required. Please log in.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { id: decoded.userId, role: decoded.role || 'customer' };

    try {
      const [rows] = await db.query('SELECT id, full_name, email, phone, role FROM users WHERE id = ?', [decoded.userId]);
      if (rows && rows.length > 0) {
        req.user = rows[0];
      } else if (decoded.userId === 'usr-admin-001') {
        req.user = { id: 'usr-admin-001', full_name: 'Executive Administrator', email: 'admin@crystalcrest.com', role: 'admin' };
      }
    } catch (dbErr) {
      if (decoded.userId === 'usr-admin-001' || decoded.role === 'admin') {
        req.user = { id: 'usr-admin-001', full_name: 'Executive Administrator', email: 'admin@crystalcrest.com', role: 'admin' };
      }
    }

    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid or expired session token.' });
  }
}

// Optional Auth (attaches user if cookie exists, doesn't fail if missing)
async function optionalAuth(req, res, next) {
  let token = req.cookies ? req.cookies.token : null;
  if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { id: decoded.userId, role: decoded.role || 'customer' };

    try {
      const [rows] = await db.query('SELECT id, full_name, email, phone, role FROM users WHERE id = ?', [decoded.userId]);
      if (rows && rows.length > 0) {
        req.user = rows[0];
      }
    } catch (e) {}

    next();
  } catch (err) {
    req.user = null;
    next();
  }
}

module.exports = {
  requireAuth,
  optionalAuth
};
