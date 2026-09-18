const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { getEffectivePrice } = require('../utils/discount');

// All cart routes require authentication
router.use(requireAuth);

// Helper to parse product images
function parseImages(val) {
  if (!val) return [];
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch (e) { return []; }
}

// GET /api/cart - Return logged-in user's cart items joined with products
router.get('/', async (req, res) => {
  const userId = req.user.id;

  try {
    const [rows] = await db.query(
      `SELECT c.id as cart_item_id, c.quantity, c.selected_size, c.selected_color, p.id as product_id, p.name, p.price, p.discount_percentage, p.discount_expires_at, p.images, p.stock_quantity
       FROM cart_items c
       JOIN products p ON c.product_id = p.id
       WHERE c.user_id = ?
       ORDER BY c.created_at DESC`,
      [userId]
    );

    const items = rows.map(r => ({
      cart_item_id: r.cart_item_id,
      product_id: r.product_id,
      id: r.product_id,
      name: r.name,
      price: getEffectivePrice(r),
      quantity: r.quantity,
      stock_quantity: r.stock_quantity,
      images: parseImages(r.images),
      image: parseImages(r.images)[0] || ''
      ,selectedSize: r.selected_size || null
      ,selectedShade: r.selected_color || null
    }));
    return res.json({ success: true, items });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Unable to load cart.' });
  }
});

// POST /api/cart - Add or update item quantity in cart
router.post('/', async (req, res) => {
  const userId = req.user.id;
  const { product_id, quantity = 1, selected_size = null, selected_color = null } = req.body;

  if (!product_id) {
    return res.status(400).json({ success: false, error: 'Product ID is required' });
  }

  const qty = parseInt(quantity, 10);
  try {
    if (qty <= 0) {
      await db.query('DELETE FROM cart_items WHERE user_id = ? AND product_id = ? AND selected_size <=> ? AND selected_color <=> ?', [userId, product_id, selected_size, selected_color]);
    } else {
      const [existing] = await db.query('SELECT id, quantity FROM cart_items WHERE user_id = ? AND product_id = ? AND selected_size <=> ? AND selected_color <=> ?', [userId, product_id, selected_size, selected_color]);

      if (existing && existing.length > 0) {
        await db.query('UPDATE cart_items SET quantity = ? WHERE id = ?', [qty, existing[0].id]);
      } else {
        const id = crypto.randomUUID();
        await db.query('INSERT INTO cart_items (id, user_id, product_id, quantity, selected_size, selected_color) VALUES (?, ?, ?, ?, ?, ?)', [id, userId, product_id, qty, selected_size, selected_color]);
      }
    }

    return res.json({ success: true, message: 'Cart updated' });

  } catch (error) {
    return res.status(500).json({ success: false, error: 'Unable to update cart.' });
  }
});

// DELETE /api/cart/:productId - Remove item from cart
router.delete('/:productId', async (req, res) => {
  const userId = req.user.id;
  const { productId } = req.params;

  try {
    await db.query('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?', [userId, productId]);
    return res.json({ success: true, message: 'Item removed from cart' });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Unable to remove cart item.' });
  }
});

// POST /api/cart/merge - Merge local guest items into user's DB cart upon login
router.post('/merge', async (req, res) => {
  const userId = req.user.id;
  const { items } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.json({ success: true, message: 'No items to merge' });
  }

  try {
    for (const item of items) {
      const prodId = item.id || item.product_id;
      const qty = parseInt(item.quantity || 1, 10);
      if (!prodId || qty <= 0) continue;

      const [existing] = await db.query('SELECT id, quantity FROM cart_items WHERE user_id = ? AND product_id = ?', [userId, prodId]);

      if (existing && existing.length > 0) {
        const newQty = existing[0].quantity + qty;
        await db.query('UPDATE cart_items SET quantity = ? WHERE id = ?', [newQty, existing[0].id]);
      } else {
        const id = crypto.randomUUID();
        await db.query('INSERT INTO cart_items (id, user_id, product_id, quantity) VALUES (?, ?, ?, ?)', [id, userId, prodId, qty]);
      }
    }

    return res.json({ success: true, message: 'Guest cart merged successfully' });

  } catch (error) {
    return res.status(500).json({ success: false, error: 'Unable to merge cart.' });
  }
});

module.exports = router;
