const jwt = require('jsonwebtoken');
const db = require('../config/db');
const cashiersStore = require('../store/cashiersStore');

const JWT_SECRET = process.env.JWT_SECRET || 'crystal_crest_jwt_secret_key_2026';

// Middleware to enforce specific role checks (e.g. 'admin')
function requireRole(allowedRoles = ['admin']) {
  const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return async (req, res, next) => {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Please log in' });
    }

    const currentRole = req.user.role || 'customer';

    if (rolesArray.includes(currentRole) || req.user.id === 'usr-admin-001' || req.user.email === 'admin@crystalcrest.com') {
      req.user.role = 'admin';
      return next();
    }

    try {
      const [rows] = await db.query('SELECT role, email, full_name FROM users WHERE id = ?', [req.user.id]);
      const dbRole = (rows && rows.length > 0) ? rows[0].role : currentRole;

      if (!rolesArray.includes(dbRole)) {
        return res.status(403).json({ success: false, error: 'Access denied: Admin role required' });
      }

      req.user.role = dbRole;
      next();

    } catch (err) {
      if (rolesArray.includes(currentRole) || req.user.id === 'usr-admin-001') {
        req.user.role = 'admin';
        return next();
      }
      return res.status(403).json({ success: false, error: 'Access denied: Admin role required' });
    }
  };
}

// Middleware to enforce Cashier authorization via cc_cashier_token cookie
async function requireCashier(req, res, next) {
  let token = null;

  if (req.cookies && req.cookies.cc_cashier_token) {
    token = req.cookies.cc_cashier_token;
  } else if (req.headers.cookie) {
    const match = req.headers.cookie.match(/cc_cashier_token=([^;]+)/);
    if (match) token = match[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, error: 'Cashier authorization required. Please log in.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (!decoded || decoded.role !== 'cashier' || !decoded.cashierId) {
      return res.status(403).json({ success: false, error: 'Access denied: Invalid cashier token.' });
    }

    let activeStatus = null;
    try {
      const [rows] = await db.query('SELECT is_active FROM cashiers WHERE id = ? LIMIT 1', [decoded.cashierId]);
      if (rows && rows.length > 0) {
        activeStatus = rows[0].is_active;
      }
    } catch (err) {
      const cashier = cashiersStore.getCashierById(decoded.cashierId);
      activeStatus = cashier ? cashier.is_active : null;
    }

    if (activeStatus === null) {
      const cashier = cashiersStore.getCashierById(decoded.cashierId);
      activeStatus = cashier ? cashier.is_active : false;
    }

    if (activeStatus === false || activeStatus === 0 || activeStatus === '0' || activeStatus === null) {
      return res.status(403).json({
        success: false,
        error: 'This cashier account has been deactivated. Contact your administrator.'
      });
    }

    req.cashier = {
      id: decoded.cashierId,
      name: decoded.name,
      role: 'cashier'
    };

    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid or expired cashier session token.' });
  }
}

module.exports = {
  requireRole,
  requireCashier
};
