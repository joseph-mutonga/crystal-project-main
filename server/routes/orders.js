const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../config/db');
const { requireAuth, optionalAuth } = require('../middleware/auth');

// Helper to parse product images
function parseImages(val) {
  if (!val) return [];
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch (e) { return []; }
}

// POST /api/orders - Create order + order_items, decrement stock, clear cart
router.post('/', requireAuth, async (req, res) => {
  const {
    full_name,
    email,
    phone,
    address,
    city,
    payment_method,
    pickup_location,
    transaction_reference,
    payer_name_or_number,
    items,
    totals
  } = req.body;

  if (!full_name || !email || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: 'Full name, email, and items are required' });
  }

  const orderId = crypto.randomUUID();
  const orderNumber = "CC-" + Math.floor(100000 + Math.random() * 900000);
  const userId = req.user ? req.user.id : null;
  const paymentMode = process.env.PAYMENTS_MODE || 'live';

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'You need a registered account to place an order. Please sign up or log in first.'
    });
  }

  const registeredPhone = String((req.user && req.user.phone) || '').trim();
  let resolvedPhone = String(phone || '').trim();
  let accountPhone = registeredPhone;

  if (!accountPhone && userId) {
    try {
      const [userRows] = await db.query('SELECT phone FROM users WHERE id = ?', [userId]);
      if (userRows && userRows.length > 0) {
        accountPhone = String(userRows[0].phone || '').trim();
      }
    } catch (e) {
      console.warn('[Orders] Could not fetch user account phone:', e.message);
    }
  }

  if (payment_method === 'mpesa') {
    resolvedPhone = String(accountPhone || resolvedPhone || '').trim();
    if (!resolvedPhone) {
      return res.status(400).json({ success: false, error: 'Your registered account phone number is required for M-Pesa STK push.' });
    }
  }

  if (payment_method !== 'mpesa') {
    return res.status(400).json({
      success: false,
      error: 'M-Pesa STK Push is the only available customer payment method.'
    });
  }

  const isPickup = Boolean(pickup_location && pickup_location.trim()) || (totals && (totals.fulfillmentType === 'pickup' || totals.shipping === 0));
  const subtotal = totals ? parseFloat(totals.subtotal || 0) : items.reduce((sum, i) => sum + (parseFloat(i.price || 0) * parseInt(i.quantity || 1)), 0);
  // When customer is picking in store: KSh 0 (FREE); When for delivery around Kajiado Town: default KSh 100
  const shipping = isPickup ? 0 : (totals && totals.shipping !== undefined ? parseFloat(totals.shipping) : 100);
  const tax = totals ? parseFloat(totals.tax || 0) : 0;
  const grandTotal = totals && totals.grandTotal ? parseFloat(totals.grandTotal) : (subtotal + shipping + tax);

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    let initialPaymentStatus = 'paid';
    let initialOrderStatus = 'processing';
    if (payment_method === 'mpesa') {
      initialPaymentStatus = 'awaiting_payment';
      initialOrderStatus = 'pending';
    } else if (payment_method === 'paybill_manual') {
      initialPaymentStatus = 'awaiting_verification';
      initialOrderStatus = 'pending';
    } else if (payment_method === 'cod') {
      initialPaymentStatus = 'pending';
      initialOrderStatus = 'processing';
    }

    // 1. Insert into orders table with payment_mode and verification columns
    await connection.query(
      `INSERT INTO orders (id, order_number, user_id, full_name, email, phone, address, city, payment_method, payment_status, payment_mode, transaction_reference, payer_name_or_number, subtotal, shipping, total, status, pickup_location, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderId,
        orderNumber,
        userId,
        full_name.trim(),
        email.toLowerCase().trim(),
        resolvedPhone,
        address || '',
        city || '',
        payment_method || 'card',
        initialPaymentStatus,
        paymentMode,
        transaction_reference ? transaction_reference.trim() : null,
        payer_name_or_number ? payer_name_or_number.trim() : null,
        subtotal,
        shipping,
        grandTotal,
        initialOrderStatus,
        pickup_location || '',
        'online'
      ]
    );

    // 2. Insert order_items & Decrement product stock_quantity
    for (const item of items) {
      const itemProductId = item.product_id || item.id;
      const itemQty = parseInt(item.quantity || 1, 10);
      const itemPrice = parseFloat(item.price || 0);

      const orderItemId = crypto.randomUUID();
      await connection.query(
        `INSERT INTO order_items (id, order_id, product_id, quantity, price_at_purchase, selected_size, selected_color)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [orderItemId, orderId, itemProductId, itemQty, itemPrice, item.selectedSize || item.selected_size || null, item.selectedShade || item.selected_color || null]
      );

      // Decrement stock_quantity in products table
      await connection.query(
        `UPDATE products SET stock_quantity = GREATEST(0, stock_quantity - ?) WHERE id = ?`,
        [itemQty, itemProductId]
      );
    }

    // 3. Clear user's cart_items in database if logged in
    if (userId) {
      await connection.query(`DELETE FROM cart_items WHERE user_id = ?`, [userId]);
    }

    await connection.commit();
    connection.release();

    return res.json({
      success: true,
      orderId,
      orderNumber,
      payment_mode: paymentMode,
      message: 'Order created successfully'
    });

  } catch (error) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    console.error('DB Order transaction error:', error.message);
    return res.status(500).json({ success: false, error: 'Unable to create order.' });
  }
});

// GET /api/orders - Logged-in user's own order history
router.get('/', requireAuth, async (req, res) => {
  const userId = req.user.id;

  try {
    const [orders] = await db.query(
      `SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC`,
      [userId]
    );

    for (let order of orders) {
      const [items] = await db.query(
        `SELECT oi.*, p.name, p.images
         FROM order_items oi
         LEFT JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = ?`,
        [order.id]
      );
      order.items = items.map(i => ({
        ...i,
        price_at_purchase: parseFloat(i.price_at_purchase),
        images: parseImages(i.images),
        image: parseImages(i.images)[0] || ''
      }));
      order.subtotal = parseFloat(order.subtotal);
      order.shipping = parseFloat(order.shipping);
      order.total = parseFloat(order.total);
      order.payment_mode = order.payment_mode || 'simulation';
    }

    return res.json({ success: true, orders });

  } catch (error) {
    return res.status(500).json({ success: false, error: 'Unable to load order history.' });
  }
});

// GET /api/orders/:id/status - Lightweight status check for real-time STK polling (<5ms response)
router.get('/:id/status', async (req, res) => {
  const { id } = req.params;

  try {
    let rows = [];
    try {
      [rows] = await db.query(
        `SELECT id, order_number, payment_status, status, payment_method, total, payment_message, created_at FROM orders WHERE id = ? OR order_number = ?`,
        [id, id]
      );
    } catch (selectErr) {
      if (String(selectErr.message).includes('payment_message')) {
        [rows] = await db.query(
          `SELECT id, order_number, payment_status, status, payment_method, total, created_at FROM orders WHERE id = ? OR order_number = ?`,
          [id, id]
        );
      } else {
        throw selectErr;
      }
    }

    if (rows && rows.length > 0) {
      const order = rows[0];

      // 5-minute timeout check: if awaiting_payment for > 5 minutes, auto-mark as failed
      const orderAgeMs = Date.now() - new Date(order.created_at).getTime();
      if (order.payment_status === 'awaiting_payment' && orderAgeMs > 5 * 60 * 1000) {
        order.payment_status = 'failed';
        try {
          await db.query(`UPDATE orders SET payment_status = 'failed' WHERE id = ?`, [order.id]);
        } catch (e) {}
      }

      return res.json({
        success: true,
        orderId: order.id,
        orderNumber: order.order_number,
        payment_status: order.payment_status,
        status: order.status,
        payment_method: order.payment_method,
        total: parseFloat(order.total),
        payment_message: order.payment_message || ''
      });
    }

    return res.status(404).json({ success: false, error: 'Order status not found' });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Unable to retrieve order status.' });
  }
});

// GET /api/orders/:id - Single order detail
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    let orders = [];
    try {
      [orders] = await db.query(
        `SELECT o.*, c.name as verified_by_name 
         FROM orders o 
         LEFT JOIN cashiers c ON o.verified_by = c.id 
         WHERE o.id = ? OR o.order_number = ?`,
        [id, id]
      );
    } catch (ordErr) {
      if (String(ordErr.message).includes('payment_message')) {
        [orders] = await db.query(
          `SELECT o.*, c.name as verified_by_name 
           FROM orders o 
           LEFT JOIN cashiers c ON o.verified_by = c.id 
           WHERE o.id = ? OR o.order_number = ?`,
          [id, id]
        );
      } else {
        throw ordErr;
      }
    }

    if (!orders || orders.length === 0) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const order = orders[0];
    const [items] = await db.query(
      `SELECT oi.*, p.name, p.images
       FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = ?`,
      [order.id]
    );

    order.items = items.map(i => ({
      ...i,
      price_at_purchase: parseFloat(i.price_at_purchase),
      images: parseImages(i.images),
      image: parseImages(i.images)[0] || ''
    }));
    order.subtotal = parseFloat(order.subtotal);
    order.shipping = parseFloat(order.shipping);
    order.total = parseFloat(order.total);
    order.payment_mode = order.payment_mode || 'simulation';
    order.payment_message = order.payment_message || '';

    return res.json({ success: true, order });

  } catch (error) {
    return res.status(500).json({ success: false, error: 'Unable to retrieve order.' });
  }
});

module.exports = router;
