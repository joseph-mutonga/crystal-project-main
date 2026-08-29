const express = require('express');
const router = express.Router();
const db = require('../config/db');

// GET /api/cashiers/orders - Pending store pickups for Kajiado boutique POS
router.get('/orders', async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM orders WHERE fulfillment_type = 'pickup' ORDER BY created_at DESC");
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
