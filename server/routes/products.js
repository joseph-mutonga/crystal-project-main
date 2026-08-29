const express = require('express');
const router = express.Router();
const db = require('../config/db');
const productsStore = require('../store/productsStore');

const MOCK_CATEGORIES = [
  { id: 'all', name: 'All Products', slug: 'all', image_url: '' },
  { id: 'cat-skincare-001', name: 'Skincare', slug: 'skincare', image_url: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80' },
  { id: 'cat-lipcare-002', name: 'Lip Care', slug: 'lip-care', image_url: 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&w=800&q=80' },
  { id: 'cat-fragrance-003', name: 'Fragrance', slug: 'fragrance', image_url: 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=800&q=80' },
  { id: 'cat-makeup-004', name: 'Makeup & Cosmetics', slug: 'makeup-cosmetics', image_url: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80' },
  { id: 'cat-shoes-005', name: 'Luxury Shoes', slug: 'luxury-shoes', image_url: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=800&q=80' }
];

function parseJsonField(val) {
  if (!val) return [];
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch (e) { return []; }
}

// GET /api/categories (Returns physical shop categories only)
router.get('/categories', async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM categories WHERE slug != 'spa-services' AND id != 'cat-spa-006' AND LOWER(name) NOT LIKE '%spa%' ORDER BY name ASC");
    if (rows && rows.length > 0) {
      return res.json({ success: true, data: rows });
    }
    return res.json({ success: true, data: MOCK_CATEGORIES });
  } catch (error) {
    res.json({ success: true, data: MOCK_CATEGORIES });
  }
});

// GET /api/products (Returns physical products: Cosmetics, Shoes, Fragrances)
router.get('/', async (req, res) => {
  const { category, minPrice, maxPrice, sort, search, targetGroup } = req.query;

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

    if (sort === 'price_asc' || sort === 'price-low') {
      sql += ' ORDER BY p.price ASC';
    } else if (sort === 'price_desc' || sort === 'price-high') {
      sql += ' ORDER BY p.price DESC';
    } else {
      sql += ' ORDER BY p.created_at DESC';
    }

    const [rows] = await db.query(sql, params);

    if (rows && rows.length > 0) {
      const formatted = rows.map(r => ({
        ...r,
        price: Number(r.price) || 0,
        buying_price: Number(r.buying_price) || 0,
        images: parseJsonField(r.images),
        sizes: parseJsonField(r.sizes),
        colors: parseJsonField(r.colors),
        category: r.category_name || 'General'
      }));
      return res.json({ success: true, data: formatted });
    }

    throw new Error('Using in-memory productsStore');

  } catch (error) {
    let list = productsStore.getProducts().filter(p => p.is_active !== false);

    if (category && category !== 'all') {
      list = list.filter(p => p.category_id === category || (p.category_name || '').toLowerCase().includes(category.toLowerCase()));
    } else {
      // Exclude spa services from general productsStore
      list = list.filter(p => p.category_id !== 'cat-spa-006' && !(p.category_name || '').toLowerCase().includes('spa'));
    }

    let filtered = list.filter(item => {
      const matchMin = !minPrice || item.price >= parseFloat(minPrice);
      const matchMax = !maxPrice || item.price <= parseFloat(maxPrice);
      const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase()) || item.description.toLowerCase().includes(search.toLowerCase());
      const matchTarget = !targetGroup || targetGroup === 'all' || (item.target_group && item.target_group.toLowerCase() === targetGroup.toLowerCase());

      return matchMin && matchMax && matchSearch && matchTarget;
    });

    if (sort === 'price_asc' || sort === 'price-low') {
      filtered.sort((a, b) => a.price - b.price);
    } else if (sort === 'price_desc' || sort === 'price-high') {
      filtered.sort((a, b) => b.price - a.price);
    }

    const formattedMock = filtered.map(item => ({
      ...item,
      price: Number(item.price) || 0,
      image: (item.images && item.images[0]) || item.image || '',
      category: item.category_name || item.category
    }));

    res.json({ success: true, data: formattedMock });
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
      const product = {
        ...r,
        price: Number(r.price) || 0,
        buying_price: Number(r.buying_price) || 0,
        images: parseJsonField(r.images),
        sizes: parseJsonField(r.sizes),
        colors: parseJsonField(r.colors),
        image: parseJsonField(r.images)[0] || '',
        category: r.category_name || 'Cosmetics'
      };
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
