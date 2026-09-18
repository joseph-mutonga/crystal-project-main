const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { withStorefrontPricing } = require('../utils/discount');

function parseJsonField(val) {
  if (!val) return [];
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch (e) { return []; }
}

// GET /api/categories (Returns physical shop categories only)
router.get('/categories', async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM categories WHERE slug != 'spa-services' AND id != 'cat-spa-006' AND LOWER(name) NOT LIKE '%spa%' ORDER BY name ASC");
    return res.json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Unable to load categories.' });
  }
});

// GET /api/products (Returns physical products: Cosmetics, Shoes, Fragrances)
router.get('/', async (req, res) => {
  const { category, minPrice, maxPrice, sort, search, targetGroup, onOffer } = req.query;

  try {
    let sql = `
      SELECT p.*, c.name as category_name, c.slug as category_slug 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id 
      WHERE p.is_active = TRUE
    `;
    const params = [];

    if (category && category !== 'all') {
      sql += ' AND (p.category_id = ? OR c.slug = ? OR LOWER(c.name) LIKE ? OR LOWER(p.name) LIKE ?)';
      params.push(category, category, `%${category.toLowerCase()}%`, `%${category.toLowerCase()}%`);
    } else {
      // By default, exclude Spa Services from regular physical shop catalogue
      sql += ` AND (c.slug != 'spa-services' OR c.slug IS NULL) AND (p.category_id != 'cat-spa-006' OR p.category_id IS NULL)`;
    }

    if (minPrice) {
      sql += ' AND p.price >= ?';
      params.push(parseFloat(minPrice));
    }

    if (maxPrice) {
      sql += ' AND p.price <= ?';
      params.push(parseFloat(maxPrice));
    }

    if (search) {
      sql += ' AND (LOWER(p.name) LIKE ? OR LOWER(p.description) LIKE ?)';
      params.push(`%${search.toLowerCase()}%`, `%${search.toLowerCase()}%`);
    }

    if (onOffer === 'true' || onOffer === '1') {
      sql += ' AND p.discount_percentage > 0 AND p.discount_expires_at > NOW()';
    }

    if (sort === 'price_asc' || sort === 'price-low') {
      sql += ' ORDER BY p.price ASC';
    } else if (sort === 'price_desc' || sort === 'price-high') {
      sql += ' ORDER BY p.price DESC';
    } else {
      sql += ' ORDER BY p.created_at DESC';
    }

    const [rows] = await db.query(sql, params);

    const formatted = rows.map(r => withStorefrontPricing({
      ...r,
      buying_price: Number(r.buying_price) || 0,
      images: parseJsonField(r.images),
      sizes: parseJsonField(r.sizes),
      colors: parseJsonField(r.colors),
      category: r.category_name || 'General'
    }));
    return res.json({ success: true, data: formatted });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Unable to load products.' });
  }
});

// GET /api/products/:id
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query(
      `SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?`,
      [id]
    );

    if (rows && rows.length > 0) {
      const r = rows[0];
      const product = withStorefrontPricing({
        ...r,
        buying_price: Number(r.buying_price) || 0,
        images: parseJsonField(r.images),
        sizes: parseJsonField(r.sizes),
        colors: parseJsonField(r.colors),
        image: parseJsonField(r.images)[0] || '',
        category: r.category_name || 'Cosmetics'
      });
      return res.json({ success: true, data: product });
    }

    throw new Error('Database empty, using productsStore');

  } catch (error) {
    const found = productsStore.getProductById(id) || productsStore.getProducts()[0];
    const product = {
      ...found,
      price: Number(found.price) || 0,
      image: (found.images && found.images[0]) || found.image || '',
      category: found.category_name || found.category
    };
    res.json({ success: true, data: product });
  }
});

module.exports = router;
