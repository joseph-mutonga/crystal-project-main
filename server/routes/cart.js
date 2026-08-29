const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../config/db');
const productsStore = require('../store/productsStore');
const { requireAuth } = require('../middleware/auth');

// All cart routes require authentication
router.use(requireAuth);

// Fallback mock cart store per user if DB is offline
const MOCK_DB_CARTS = {}; // userId -> array of cart items

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
      `SELECT c.id as cart_item_id, c.quantity, p.id as product_id, p.name, p.price, p.images, p.stock_quantity
       FROM cart_items c
       JOIN products p ON c.product_id = p.id
       WHERE c.user_id = ?
       ORDER BY c.created_at DESC`,
      [userId]
    );

    if (rows && rows.length > 0) {
      const items = rows.map(r => ({
        cart_item_id: r.cart_item_id,
        product_id: r.product_id,
        id: r.product_id,
        name: r.name,
        price: Number(r.price) || 0,
        quantity: r.quantity,
        stock_quantity: r.stock_quantity,
        images: parseImages(r.images),
        image: parseImages(r.images)[0] || ''
      }));

      return res.json({ success: true, items });
    }

    throw new Error('Database cart empty, using mock cart');

  } catch (error) {
    const mockCart = MOCK_DB_CARTS[userId] || [];
    // Ensure every item in mockCart has full product details (name, price, image)
    const enrichedCart = mockCart.map(item => {
      const prod = productsStore.getProductById(item.product_id || item.id) || {};
      const img = item.image || (prod.images && prod.images[0]) || prod.image || 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80';
      return {
        ...item,
        cart_item_id: item.cart_item_id || item.id || crypto.randomUUID(),
        product_id: item.product_id || item.id,
        id: item.product_id || item.id,
        name: item.name || prod.name || 'Cosmetics Item',
        price: typeof item.price === 'number' ? item.price : Number(prod.price || item.price || 0),
        image: img,
        quantity: parseInt(item.quantity || 1, 10)
      };
    });

    return res.json({ success: true, items: enrichedCart });
  }
});

// POST /api/cart - Add or update item quantity in cart
router.post('/', async (req, res) => {
  const userId = req.user.id;
  const { product_id, quantity = 1, name, price, image } = req.body;

  if (!product_id) {
    return res.status(400).json({ success: false, error: 'Product ID is required' });
  }

  const qty = parseInt(quantity, 10);
  const prod = productsStore.getProductById(product_id) || {};
  const itemPrice = typeof price === 'number' ? price : Number(prod.price || price || 0);
  const itemName = name || prod.name || 'Cosmetics Item';
  const itemImg = image || (prod.images && prod.images[0]) || prod.image || 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80';

  try {
    if (qty <= 0) {
      await db.query('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?', [userId, product_id]);
    } else {
      const [existing] = await db.query('SELECT id, quantity FROM cart_items WHERE user_id = ? AND product_id = ?', [userId, product_id]);

      if (existing && existing.length > 0) {
        await db.query('UPDATE cart_items SET quantity = ? WHERE id = ?', [qty, existing[0].id]);
      } else {
        const id = crypto.randomUUID();
        await db.query('INSERT INTO cart_items (id, user_id, product_id, quantity) VALUES (?, ?, ?, ?)', [id, userId, product_id, qty]);
      }
    }

    return res.json({ success: true, message: 'Cart updated' });

  } catch (error) {
    let cart = MOCK_DB_CARTS[userId] || [];

    if (qty <= 0) {
      cart = cart.filter(item => (item.product_id || item.id) !== product_id);
    } else {
      const existingIdx = cart.findIndex(item => (item.product_id || item.id) === product_id);
      if (existingIdx > -1) {
        cart[existingIdx].quantity = qty;
        if (itemPrice > 0) cart[existingIdx].price = itemPrice;
        if (itemName) cart[existingIdx].name = itemName;
        if (itemImg) cart[existingIdx].image = itemImg;
      } else {
        cart.push({
          cart_item_id: crypto.randomUUID(),
          product_id,
          id: product_id,
          name: itemName,
          price: itemPrice,
          image: itemImg,
          quantity: qty
        });
      }
    }

    MOCK_DB_CARTS[userId] = cart;
    return res.json({ success: true, message: 'Cart updated (mock)' });
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
    let cart = MOCK_DB_CARTS[userId] || [];
    cart = cart.filter(item => (item.product_id || item.id) !== productId);
    MOCK_DB_CARTS[userId] = cart;
    return res.json({ success: true, message: 'Item removed from cart' });
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
    let cart = MOCK_DB_CARTS[userId] || [];

    for (const item of items) {
      const prodId = item.id || item.product_id;
      const qty = parseInt(item.quantity || 1, 10);
      const prod = productsStore.getProductById(prodId) || {};

      const existingIdx = cart.findIndex(i => (i.product_id || i.id) === prodId);

      if (existingIdx > -1) {
        cart[existingIdx].quantity += qty;
      } else {
        cart.push({
          cart_item_id: crypto.randomUUID(),
          product_id: prodId,
          id: prodId,
          name: item.name || prod.name || 'Cosmetics Item',
          price: typeof item.price === 'number' ? item.price : Number(prod.price || item.price || 0),
          quantity: qty,
          image: item.image || (prod.images && prod.images[0]) || prod.image || ''
        });
      }
    }

    MOCK_DB_CARTS[userId] = cart;
    return res.json({ success: true, message: 'Guest cart merged (mock)' });
  }
});

module.exports = router;
