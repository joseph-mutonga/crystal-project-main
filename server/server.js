require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const os = require('os');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

// Enable CORS
app.use(cors({
  origin: true,
  credentials: true
}));

// Parse cookies and JSON body
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets from /public
app.use(express.static(path.join(__dirname, '../public')));

// Uptime Monitoring Health Route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development'
  });
});

// Mount REST API Routes under /api
const productsRouter = require('./routes/products');
app.use('/api/products', productsRouter);
app.use('/api/categories', (req, res, next) => {
  req.url = '/categories' + (req.url === '/' ? '' : req.url);
  productsRouter(req, res, next);
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/auth', require('./routes/cashier-auth'));
app.use('/api/cart', require('./routes/cart'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/spa', require('./routes/spa'));
app.use('/api/newsletter', require('./routes/newsletter'));
app.use('/api/cashiers', require('./routes/cashiers'));
app.use('/api/cashier', require('./routes/cashier'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/cresti', require('./routes/cresti'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/settings', require('./routes/settings'));

// Handle unmatched /api/* endpoints
app.use('/api/*', (req, res) => {
  res.status(404).json({ success: false, error: `API endpoint ${req.originalUrl} not found` });
});

// Fallback navigation for storefront routes & 404 page
app.get('*', (req, res) => {
  const reqPath = req.path;

  // Attempt to resolve direct .html file if missing extension (e.g. /shop -> shop.html)
  if (!reqPath.includes('.')) {
    const htmlPath = path.join(__dirname, '../public', `${reqPath}.html`);
    if (fs.existsSync(htmlPath)) {
      return res.sendFile(htmlPath);
    }
  }

  const exactFilePath = path.join(__dirname, '../public', reqPath);
  if (fs.existsSync(exactFilePath) && fs.statSync(exactFilePath).isFile()) {
    return res.sendFile(exactFilePath);
  }

  // 404 Page fallback
  res.status(404).sendFile(path.join(__dirname, '../public/404.html'));
});

// Generic Express Error Handler Middleware (Production-hardened)
app.use((err, req, res, next) => {
  if (!IS_PROD) {
    console.error('[Unhandled Express Error]:', err.stack || err.message);
  } else {
    console.error('[Unhandled Express Error]:', err.message);
  }

  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    success: false,
    error: IS_PROD ? 'Internal Server Error' : (err.message || 'Internal Server Error')
  });
});

// Auto database setup helper on startup
async function initDatabaseSchema() {
  const host = process.env.DB_HOST || 'localhost';
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const dbName = process.env.DB_NAME || 'crystal_crest';

  try {
    const rootConn = await mysql.createConnection({ host, user, password });
    await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await rootConn.query(`USE \`${dbName}\``);

    const schemaSqlPath = path.join(__dirname, '../database/schema.sql');
    if (fs.existsSync(schemaSqlPath)) {
      const sqlContent = fs.readFileSync(schemaSqlPath, 'utf8');
      const statements = sqlContent.split(';').map(s => s.trim()).filter(s => s.length > 0);
      for (const statement of statements) {
        try {
          await rootConn.query(statement);
        } catch (e) {}
      }
    }

    // Auto-migrate: ensure settings table exists & seeded
    try {
      await rootConn.query(`
        CREATE TABLE IF NOT EXISTS settings (
          \`key\` VARCHAR(100) PRIMARY KEY,
          \`value\` TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB
      `);
      await rootConn.query(`INSERT IGNORE INTO settings (\`key\`, \`value\`) VALUES ('paybill_number', '400200'), ('paybill_account_number', '104514'), ('paybill_account_name', 'Crystal Crest')`);
    } catch (e) {}

    // Auto-migrate: ensure payment_mode and Paybill verification columns exist in orders table
    const orderCols = [
      "ALTER TABLE orders ADD COLUMN payment_mode VARCHAR(20) DEFAULT 'simulation'",
      "ALTER TABLE orders ADD COLUMN transaction_reference VARCHAR(255) DEFAULT NULL",
      "ALTER TABLE orders ADD COLUMN payer_name_or_number VARCHAR(255) DEFAULT NULL",
      "ALTER TABLE orders ADD COLUMN verified_by VARCHAR(36) DEFAULT NULL",
      "ALTER TABLE orders ADD COLUMN verified_at TIMESTAMP NULL DEFAULT NULL",
      "ALTER TABLE orders ADD COLUMN payment_message TEXT DEFAULT NULL"
    ];
    for (const sql of orderCols) {
      try { await rootConn.query(sql); } catch (e) {}
    }

    // Auto-migrate: ensure cashier and order tracking columns exist in spa_bookings table
    const spaCols = [
      "ALTER TABLE spa_bookings ADD COLUMN cashier_id VARCHAR(36) DEFAULT NULL",
      "ALTER TABLE spa_bookings ADD COLUMN cashier_name VARCHAR(255) DEFAULT NULL",
      "ALTER TABLE spa_bookings ADD COLUMN order_id VARCHAR(36) DEFAULT NULL",
      "ALTER TABLE spa_bookings ADD COLUMN price DECIMAL(10, 2) DEFAULT 0.00",
      "ALTER TABLE spa_bookings ADD COLUMN payment_method VARCHAR(50) DEFAULT 'cash'",
      "ALTER TABLE spa_bookings ADD COLUMN source VARCHAR(50) DEFAULT 'online'",
      "ALTER TABLE spa_bookings ADD COLUMN cancellation_reason TEXT DEFAULT NULL"
    ];
    for (const sql of spaCols) {
      try { await rootConn.query(sql); } catch (e) {}
    }

    console.log(`✅ Database [${dbName}] initialized.`);
    await rootConn.end();
  } catch (err) {
    console.warn(`ℹ️ Database initialization warning (${err.message}). Server running with API mock fallback.`);
  }
}

// Start HTTP server (Listening on 0.0.0.0 for LAN & mobile access)
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', async () => {
    console.log(`\n✨ Crystal Crest server running on port ${PORT} (Env: ${process.env.NODE_ENV || 'development'})`);
    console.log(`👉 Local:   http://localhost:${PORT}`);

    // Print local network IP addresses for easy mobile testing
    const interfaces = os.networkInterfaces();
    let networkFound = false;
    for (const devName of Object.keys(interfaces)) {
      const iface = interfaces[devName];
      for (const alias of iface) {
        if (alias.family === 'IPv4' && !alias.internal) {
          console.log(`👉 Network: http://${alias.address}:${PORT} (${devName})`);
          networkFound = true;
        }
      }
    }
    if (!networkFound) {
      console.log(`👉 Network: http://<your-local-ip>:${PORT}`);
    }
    console.log(`📡 Listening on: 0.0.0.0:${PORT} (Reachable from phones/devices on the same Wi-Fi)\n`);

    // Payments simulation warning check
    const paymentsMode = process.env.PAYMENTS_MODE || 'simulation';
    if (paymentsMode !== 'live') {
      console.warn("⚠️  Payments are running in SIMULATION mode — M-Pesa is not connected to a real provider. Do not use in production until real Daraja credentials are integrated.");
    }

    // Loud warning if production runtime is pointed at Safaricom sandbox
    if (process.env.NODE_ENV === 'production' && (process.env.MPESA_ENV || '').toLowerCase() === 'sandbox') {
      console.warn("\n🚨 [CRITICAL CONFIGURATION WARNING]: NODE_ENV is set to 'production' but MPESA_ENV is set to 'sandbox'. Real customer payments will NOT be processed! Update MPESA_ENV=production in your .env before accepting live orders.\n");
    }

    await initDatabaseSchema();
  });
}

module.exports = app;
