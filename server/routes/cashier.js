const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const path = require('path');
const multer = require('multer');
const db = require('../config/db');
const productsStore = require('../store/productsStore');
const cashiersStore = require('../store/cashiersStore');
const { requireCashier } = require('../middleware/permissions');

// Setup Multer Storage for cashier product images with file size and type validation
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../../public/images/products'));
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `prod-${Date.now()}-${Math.round(Math.random() * 1E6)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max file size
  fileFilter: function (req, file, cb) {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
    const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedMimes.includes(file.mimetype) && allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid image file type. Only JPEG, PNG, WEBP, GIF, and AVIF images are permitted.'));
    }
  }
});

// All cashier endpoints require Cashier Authentication
router.use(requireCashier);

function parseJson(val) {
  if (!val) return [];
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch (e) { return []; }
}

// GET /api/cashier/products - Returns active products for the POS catalog grid
router.get('/products', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.is_active = TRUE ORDER BY p.name ASC`
    );

    if (rows && rows.length > 0) {
      const products = rows.map(r => ({
        id: r.id,
        name: r.name,
        category: r.category_name || 'General',
        category_name: r.category_name || 'General',
        price: Number(r.price) || 0,
        buying_price: Number(r.buying_price) || 0,
        stock_quantity: Number(r.stock_quantity) || 0,
        images: parseJson(r.images),
        image: parseJson(r.images)[0] || 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80',
        sizes: parseJson(r.sizes),
        colors: parseJson(r.colors)
      }));

      return res.json({ success: true, products });
    }

    throw new Error('Using productsStore for POS catalog');

  } catch (error) {
    const all = productsStore.getProducts().filter(p => p.is_active !== false);
    const products = all.map(p => ({
      id: p.id,
      name: p.name,
      category: p.category_name || p.category || 'General',
      category_name: p.category_name || p.category || 'General',
      price: Number(p.price) || 0,
      buying_price: Number(p.buying_price) || 0,
      stock_quantity: Number(p.stock_quantity) || 0,
      images: p.images || [],
      image: (p.images && p.images[0]) || p.image || 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80',
      sizes: p.sizes || [],
      colors: p.colors || []
    }));

    return res.json({ success: true, products });
  }
});

// POST /api/cashier/products - Add a new product directly from Cashier POS Station with image upload
router.post('/products', upload.single('imageFile'), async (req, res) => {
  const { name, category_name, price, buying_price, stock_quantity, sizes, colors, description, image_url } = req.body;

  if (!name || !name.trim() || price === undefined) {
    return res.status(400).json({ success: false, error: 'Product name and price are required.' });
  }

  const id = crypto.randomUUID();
  let imageList = [];
  if (req.file) {
    imageList.push(`/images/products/${req.file.filename}`);
  } else if (image_url && image_url.trim()) {
    imageList.push(image_url.trim());
  } else {
    imageList.push('https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80');
  }

  const sizesList = Array.isArray(sizes) ? sizes : (typeof sizes === 'string' && sizes.trim() ? (sizes.startsWith('[') ? parseJson(sizes) : sizes.split(',').map(s => s.trim())) : []);
  const colorsList = Array.isArray(colors) ? colors : (typeof colors === 'string' && colors.trim() ? (colors.startsWith('[') ? parseJson(colors) : colors.split(',').map(c => c.trim())) : []);

  // Try to find matching category_id
  let categoryId = null;
  if (category_name && category_name.trim()) {
    try {
      const [cats] = await db.query(
        'SELECT id FROM categories WHERE LOWER(name) = ? OR LOWER(slug) = ? LIMIT 1',
        [category_name.toLowerCase().trim(), category_name.toLowerCase().trim()]
      );
      if (cats && cats.length > 0) {
        categoryId = cats[0].id;
      }
    } catch (e) {}
  }

  const newProd = {
    id,
    name: name.trim(),
    category_id: categoryId,
    category_name: category_name ? category_name.trim() : 'General',
    category: category_name ? category_name.trim() : 'General',
    price: parseFloat(price),
    buying_price: parseFloat(buying_price || 0),
    stock_quantity: parseInt(stock_quantity || 0, 10),
    description: description || '',
    is_active: true,
    images: imageList,
    image: imageList[0],
    sizes: sizesList,
    colors: colorsList
  };

  productsStore.addProduct(newProd);

  try {
    await db.query(
      `INSERT INTO products (id, name, category_id, price, buying_price, description, images, sizes, colors, stock_quantity, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
      [
        id,
        newProd.name,
        categoryId,
        newProd.price,
        newProd.buying_price,
        newProd.description,
        JSON.stringify(newProd.images),
        JSON.stringify(newProd.sizes),
        JSON.stringify(newProd.colors),
        newProd.stock_quantity
      ]
    );
  } catch (error) {
    console.warn('[Cashier Products] DB insert fallback:', error.message);
  }

  return res.json({
    success: true,
    product: newProd,
    message: `Product "${newProd.name}" added to catalog successfully.`
  });
});

// POST /api/cashier/upload-inventory-excel - Bulk Stock Restock & Catalog Sync
router.post('/upload-inventory-excel', async (req, res) => {
  const { items } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: 'No inventory rows found in uploaded sheet.' });
  }

  let updatedCount = 0;
  let createdCount = 0;

  for (const row of items) {
    const name = (row.name || row.product_name || row['Product Name'] || row.Name || '').toString().trim();
    if (!name) continue;

    const rowId = (row.id || row.product_id || row['ID'] || '').toString().trim();
    const price = row.price !== undefined ? parseFloat(row.price || row['Price'] || 0) : null;
    const buyingPrice = row.buying_price !== undefined ? parseFloat(row.buying_price || row['Buying Price'] || 0) : null;
    const stockQty = row.stock_quantity !== undefined ? parseInt(row.stock_quantity || row['Stock Quantity'] || row['Quantity'] || 0, 10) : null;
    const addStockQty = row.add_stock_quantity !== undefined ? parseInt(row.add_stock_quantity || row['Add Stock'] || 0, 10) : null;

    const categoryName = (row.category || row.category_name || row['Category'] || 'General').toString().trim();
    const sizesStr = row.sizes || row['Sizes'] || '';
    const colorsStr = row.colors || row['Colors'] || '';

    const sizesList = Array.isArray(sizesStr) ? sizesStr : (sizesStr.toString().trim() ? sizesStr.toString().split(',').map(s => s.trim()) : []);
    const colorsList = Array.isArray(colorsStr) ? colorsStr : (colorsStr.toString().trim() ? colorsStr.toString().split(',').map(c => c.trim()) : []);

    const existing = productsStore.getProducts().find(p => (rowId && p.id === rowId) || p.name.toLowerCase() === name.toLowerCase());

    if (existing) {
      const updatedFields = {};
      if (price !== null && !isNaN(price) && price > 0) updatedFields.price = price;
      if (buyingPrice !== null && !isNaN(buyingPrice)) updatedFields.buying_price = buyingPrice;
      
      if (addStockQty !== null && !isNaN(addStockQty)) {
        updatedFields.stock_quantity = (existing.stock_quantity || 0) + addStockQty;
      } else if (stockQty !== null && !isNaN(stockQty)) {
        updatedFields.stock_quantity = stockQty;
      }

      if (sizesList.length > 0) updatedFields.sizes = sizesList;
      if (colorsList.length > 0) updatedFields.colors = colorsList;
      if (categoryName) {
        updatedFields.category_name = categoryName;
        updatedFields.category = categoryName;
      }

      productsStore.updateProduct(existing.id, updatedFields);

      try {
        await db.query(
          `UPDATE products SET price = IFNULL(?, price), buying_price = IFNULL(?, buying_price), stock_quantity = IFNULL(?, stock_quantity) WHERE id = ?`,
          [updatedFields.price || null, updatedFields.buying_price || null, updatedFields.stock_quantity || null, existing.id]
        );
      } catch (e) {}

      updatedCount++;
    } else {
      const newId = rowId || crypto.randomUUID();
      const finalStock = addStockQty !== null ? addStockQty : (stockQty !== null ? stockQty : 10);
      const finalPrice = price !== null ? price : 1000;

      const newProd = {
        id: newId,
        name,
        category_name: categoryName,
        category: categoryName,
        price: finalPrice,
        buying_price: buyingPrice || 0,
        stock_quantity: finalStock,
        description: (row.description || row['Description'] || 'Restocked via Excel Import').toString(),
        is_active: true,
        images: ['https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80'],
        image: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80',
        sizes: sizesList,
        colors: colorsList
      };

      productsStore.addProduct(newProd);

      try {
        await db.query(
          `INSERT INTO products (id, name, price, buying_price, description, images, sizes, colors, stock_quantity, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
          [
            newId,
            name,
            finalPrice,
            newProd.buying_price,
            newProd.description,
            JSON.stringify(newProd.images),
            JSON.stringify(newProd.sizes),
            JSON.stringify(newProd.colors),
            finalStock
          ]
        );
      } catch (e) {}

      createdCount++;
    }
  }

  return res.json({
    success: true,
    updated_count: updatedCount,
    created_count: createdCount,
    message: `Excel import complete! Updated ${updatedCount} existing products, added ${createdCount} new products.`
  });
});

// POST /api/cashier/upload-offline-sales - Bulk Offline / Daily Sales Import
router.post('/upload-offline-sales', async (req, res) => {
  const { sales } = req.body;
  const cashierId = req.cashier.id;
  const cashierName = req.cashier.name;
  const paymentMode = process.env.PAYMENTS_MODE || 'simulation';

  if (!sales || !Array.isArray(sales) || sales.length === 0) {
    return res.status(400).json({ success: false, error: 'No sales rows found in uploaded sheet.' });
  }

  let importedOrdersCount = 0;
  let totalRevenueAdded = 0;

  for (const row of sales) {
    const prodNameOrId = (row.name || row.product_name || row['Product Name'] || row.product_id || row['ID'] || '').toString().trim();
    if (!prodNameOrId) continue;

    const qty = parseInt(row.quantity || row.qty || row['Quantity'] || row['Qty'] || 1, 10);
    const unitPrice = parseFloat(row.price || row.unit_price || row['Unit Price'] || row['Price'] || 0);
    const payMethod = (row.payment_method || row['Payment Method'] || 'cash').toString().toLowerCase();
    const custName = (row.customer_name || row['Customer Name'] || 'Offline Walk-in').toString();
    const custPhone = (row.customer_phone || row['Phone'] || '—').toString();

    const prod = productsStore.getProducts().find(p => p.id === prodNameOrId || p.name.toLowerCase() === prodNameOrId.toLowerCase());
    const itemPrice = unitPrice > 0 ? unitPrice : (prod ? prod.price : 1000);
    const orderTotal = itemPrice * qty;

    if (prod) {
      const newStock = Math.max(0, prod.stock_quantity - qty);
      productsStore.updateProduct(prod.id, { stock_quantity: newStock });

      try {
        await db.query(`UPDATE products SET stock_quantity = GREATEST(0, stock_quantity - ?) WHERE id = ?`, [qty, prod.id]);
      } catch (e) {}
    }

    const orderId = crypto.randomUUID();
    const orderNumber = `POS-OFFLINE-${Math.floor(100000 + Math.random() * 900000)}`;

    const posOrderObj = {
      id: orderId,
      order_number: orderNumber,
      cashier_id: cashierId,
      cashier_name: cashierName,
      full_name: custName,
      email: 'offline@crystalcrest.com',
      phone: custPhone,
      payment_method: payMethod,
      payment_status: 'paid',
      payment_mode: paymentMode,
      subtotal: orderTotal,
      shipping: 0.00,
      total: orderTotal,
      status: 'completed',
      pickup_location: 'In-Store Offline Batch',
      source: 'pos',
      created_at: new Date().toISOString(),
      items: [
        {
          id: crypto.randomUUID(),
          product_id: prod ? prod.id : 'offline-item',
          name: prod ? prod.name : prodNameOrId,
          quantity: qty,
          price_at_purchase: itemPrice,
          image: prod ? (prod.image || (prod.images && prod.images[0])) : ''
        }
      ]
    };

    cashiersStore.addPosOrder(posOrderObj);

    try {
      await db.query(
        `INSERT INTO orders 
         (id, order_number, user_id, cashier_id, full_name, email, phone, address, city, payment_method, payment_status, payment_mode, subtotal, shipping, total, status, pickup_location, source)
         VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, 'paid', ?, ?, 0.00, ?, 'completed', 'In-Store Offline Batch', 'pos')`,
        [
          orderId,
          orderNumber,
          cashierId,
          custName,
          'offline@crystalcrest.com',
          custPhone,
          'Flagship Store Counter',
          'Kajiado Town',
          payMethod,
          paymentMode,
          orderTotal,
          orderTotal
        ]
      );
    } catch (e) {}

    importedOrdersCount++;
    totalRevenueAdded += orderTotal;
  }

  return res.json({
    success: true,
    imported_count: importedOrdersCount,
    total_revenue_added: totalRevenueAdded,
    payment_mode: paymentMode,
    message: `Offline sales import complete! Created ${importedOrdersCount} POS transactions totaling KSh ${totalRevenueAdded.toLocaleString()}.`
  });
});

// POST /api/cashier/sale - Process a POS walk-in sale in a transaction, decrement stock, record cashier_id
router.post('/sale', async (req, res) => {
  const { items, payment_method, customer_name, customer_phone, transaction_reference, payer_name_or_number, subtotal, discount, total } = req.body;
  const cashierId = req.cashier.id;
  const cashierName = req.cashier.name;
  const paymentMode = process.env.PAYMENTS_MODE || 'live';

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: 'Sale cart cannot be empty.' });
  }

  const orderId = crypto.randomUUID();
  const orderNumber = `POS-${Math.floor(100000 + Math.random() * 900000)}`;
  const custName = customer_name ? customer_name.trim() : 'Walk-in Customer';
  const custPhone = customer_phone ? customer_phone.trim() : '—';
  const payMethod = (payment_method || 'cash').toLowerCase();

  const subtotalAmount = parseFloat(subtotal || total || 0);
  const totalAmount = parseFloat(total || subtotal || 0);

  // Decrement stock in shared productsStore
  for (const item of items) {
    const prodId = item.product_id || item.id;
    const qty = parseInt(item.quantity || 1, 10);
    const currentProd = productsStore.getProductById(prodId);
    if (currentProd) {
      const newStock = Math.max(0, currentProd.stock_quantity - qty);
      productsStore.updateProduct(prodId, { stock_quantity: newStock });
    }
  }

  const isPaybill = payMethod === 'paybill_manual' || payMethod.includes('paybill');
  const now = new Date();
  let initialPaymentStatus = 'paid';
  let initialOrderStatus = 'completed';
  let verifiedBy = null;
  let verifiedAt = null;

  if (payMethod === 'mpesa') {
    initialPaymentStatus = 'awaiting_payment';
    initialOrderStatus = 'pending';
  } else if (isPaybill) {
    // If cashier took payment and verified transaction code at counter
    if (transaction_reference && transaction_reference.trim()) {
      initialPaymentStatus = 'paid';
      initialOrderStatus = 'completed';
      verifiedBy = cashierId;
      verifiedAt = now;
    } else {
      initialPaymentStatus = 'awaiting_verification';
      initialOrderStatus = 'pending';
    }
  }

  try {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      await connection.query(
        `INSERT INTO orders 
         (id, order_number, user_id, cashier_id, full_name, email, phone, address, city, payment_method, payment_status, payment_mode, transaction_reference, payer_name_or_number, verified_by, verified_at, subtotal, shipping, total, status, pickup_location, source)
         VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0.00, ?, ?, 'In-Store POS Counter', 'pos')`,
        [
          orderId,
          orderNumber,
          cashierId,
          custName,
          'walkin@crystalcrest.com',
          custPhone,
          'Flagship Store Counter',
          'Kajiado Town',
          payMethod,
          initialPaymentStatus,
          paymentMode,
          transaction_reference ? transaction_reference.trim() : null,
          payer_name_or_number ? payer_name_or_number.trim() : null,
          verifiedBy,
          verifiedAt,
          subtotalAmount,
          totalAmount,
          initialOrderStatus
        ]
      );

      for (const item of items) {
        const itemId = crypto.randomUUID();
        const prodId = item.product_id || item.id;
        const qty = parseInt(item.quantity || 1, 10);
        const itemPrice = parseFloat(item.price || 0);

        await connection.query(
          `INSERT INTO order_items (id, order_id, product_id, quantity, price_at_purchase)
           VALUES (?, ?, ?, ?, ?)`,
          [itemId, orderId, prodId, qty, itemPrice]
        );

        await connection.query(
          `UPDATE products SET stock_quantity = GREATEST(0, stock_quantity - ?) WHERE id = ?`,
          [qty, prodId]
        );
      }

      await connection.commit();
      connection.release();

    } catch (err) {
      await connection.rollback();
      connection.release();
      throw err;
    }

  } catch (error) {
    console.warn('DB POS sale transaction fallback:', error.message);
  }

  // Record in in-memory cashiersStore
  const posOrderObj = {
    id: orderId,
    order_number: orderNumber,
    cashier_id: cashierId,
    cashier_name: cashierName,
    full_name: custName,
    email: 'walkin@crystalcrest.com',
    phone: custPhone,
    payment_method: payMethod,
    payment_status: initialPaymentStatus,
    payment_mode: paymentMode,
    transaction_reference: transaction_reference || null,
    payer_name_or_number: payer_name_or_number || null,
    verified_by: verifiedBy,
    verified_by_name: verifiedBy ? cashierName : null,
    verified_at: verifiedAt ? verifiedAt.toISOString() : null,
    subtotal: subtotalAmount,
    shipping: 0.00,
    total: totalAmount,
    status: initialOrderStatus,
    pickup_location: 'In-Store POS Counter',
    source: 'pos',
    created_at: now.toISOString(),
    items: items.map(i => {
      const prod = productsStore.getProductById(i.product_id || i.id) || {};
      return {
        id: crypto.randomUUID(),
        order_id: orderId,
        product_id: i.product_id || i.id,
        name: i.name || prod.name || 'Cosmetics Item',
        quantity: parseInt(i.quantity || 1, 10),
        price_at_purchase: parseFloat(i.price || prod.price || 0),
        images: prod.images || [],
        image: (prod.images && prod.images[0]) || prod.image || ''
      };
    })
  };

  cashiersStore.addPosOrder(posOrderObj);

  return res.json({
    success: true,
    orderId: orderId,
    order_id: orderId,
    order_number: orderNumber,
    payment_method: payMethod,
    payment_status: initialPaymentStatus,
    payment_mode: paymentMode,
    total: totalAmount,
    status: initialOrderStatus,
    verified_by: verifiedBy,
    message: isPaybill && initialPaymentStatus === 'paid'
      ? `POS sale completed with Paybill verification (#${transaction_reference}).`
      : `POS sale recorded successfully.`
  });
});

// ----------------------------------------------------
// MANUAL PAYBILL PAYMENT VERIFICATION QUEUE
// ----------------------------------------------------

// GET /api/cashier/orders/awaiting-verification - Return all online & POS orders waiting for SMS verification
router.get('/orders/awaiting-verification', async (req, res) => {
  try {
    const [orders] = await db.query(
      `SELECT o.*, c.name as cashier_name 
       FROM orders o 
       LEFT JOIN cashiers c ON o.cashier_id = c.id 
       WHERE o.payment_status = 'awaiting_verification' 
       ORDER BY o.created_at ASC`
    );

    for (let order of orders) {
      const [items] = await db.query(
        `SELECT oi.*, p.name as prod_name, p.images 
         FROM order_items oi 
         LEFT JOIN products p ON oi.product_id = p.id 
         WHERE oi.order_id = ?`,
        [order.id]
      );
      order.items = items.map(i => ({
        ...i,
        name: i.prod_name || 'Cosmetics Item',
        price_at_purchase: Number(i.price_at_purchase) || 0,
        image: (parseJson(i.images)[0]) || ''
      }));
      order.subtotal = Number(order.subtotal) || 0;
      order.shipping = Number(order.shipping) || 0;
      order.total = Number(order.total) || 0;
    }

    return res.json({ success: true, orders, count: orders.length });
  } catch (error) {
    console.warn('DB error fetching awaiting verification orders, checking in-memory store:', error.message);
    const posOrders = cashiersStore.getAllPosOrders();
    const awaiting = posOrders.filter(o => o.payment_status === 'awaiting_verification');
    return res.json({ success: true, orders: awaiting, count: awaiting.length });
  }
});

// PUT /api/cashier/orders/:id/verify-payment - Cashier marks order as paid after matching against shop SMS
router.put('/orders/:id/verify-payment', async (req, res) => {
  const { id } = req.params;
  const cashierId = req.cashier.id;
  const cashierName = req.cashier.name;

  try {
    const [rows] = await db.query('SELECT * FROM orders WHERE id = ? OR order_number = ?', [id, id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Order not found.' });
    }

    const order = rows[0];
    const newStatus = order.source === 'pos' ? 'completed' : 'processing';
    const now = new Date();

    await db.query(
      `UPDATE orders 
       SET payment_status = 'paid', status = ?, verified_by = ?, verified_at = ? 
       WHERE id = ?`,
      [newStatus, cashierId, now, order.id]
    );

    const posOrders = cashiersStore.getAllPosOrders();
    const memOrder = posOrders.find(o => o.id === order.id || o.order_number === order.order_number);
    if (memOrder) {
      memOrder.payment_status = 'paid';
      memOrder.status = newStatus;
      memOrder.verified_by = cashierId;
      memOrder.verified_by_name = cashierName;
      memOrder.verified_at = now.toISOString();
    }

    return res.json({
      success: true,
      message: `Payment for order #${order.order_number} verified and marked as PAID by ${cashierName}.`,
      orderId: order.id,
      orderNumber: order.order_number,
      payment_status: 'paid',
      verified_by: cashierId,
      verified_by_name: cashierName,
      verified_at: now
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ----------------------------------------------------
// SPA SERVICE MANAGEMENT FOR CASHIER WALK-INS
// ----------------------------------------------------

const STANDARD_TIME_SLOTS = [
  '09:00 AM',
  '11:00 AM',
  '01:00 PM',
  '03:00 PM',
  '05:00 PM',
  '07:00 PM'
];

// GET /api/cashier/spa-services - List active spa services with rates and durations
router.get('/spa-services', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT p.*, c.name as category_name, c.slug as category_slug 
       FROM products p 
       LEFT JOIN categories c ON p.category_id = c.id 
       WHERE p.is_active = TRUE AND (p.category_id = 'cat-spa-006' OR c.slug = 'spa-services' OR LOWER(p.name) LIKE '%spa%' OR LOWER(c.name) LIKE '%spa%')
       ORDER BY p.name ASC`
    );

    if (rows && rows.length > 0) {
      const services = rows.map(r => ({
        id: r.id,
        name: r.name,
        category_name: 'Spa & Beauty Services',
        price: Number(r.price) || 0,
        description: r.description || '',
        image: (parseJson(r.images)[0]) || r.image || 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80',
        durations: parseJson(r.sizes).length > 0 ? parseJson(r.sizes) : ['60 Min Session', '90 Min Session'],
        sizes: parseJson(r.sizes),
        colors: parseJson(r.colors)
      }));

      return res.json({ success: true, services });
    }

    throw new Error('Using productsStore for Cashier Spa Services');

  } catch (error) {
    const spaItems = productsStore.getProducts().filter(p => 
      p.is_active !== false && 
      (p.category_id === 'cat-spa-006' || (p.category_name || '').toLowerCase().includes('spa') || (p.category || '').toLowerCase().includes('spa'))
    );

    let services = spaItems.map(p => ({
      id: p.id,
      name: p.name,
      category_name: 'Spa & Beauty Services',
      price: Number(p.price) || 0,
      description: p.description || '',
      image: (p.images && p.images[0]) || p.image || 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80',
      durations: p.sizes && p.sizes.length > 0 ? p.sizes : ['60 Min Session', '90 Min Session'],
      sizes: p.sizes || [],
      colors: p.colors || []
    }));

    // If no specific spa items found, supply luxury defaults
    if (services.length === 0) {
      services = [
        {
          id: 'prod-spa-massage-02',
          name: 'Aromatherapy Damask Rose Body Massage',
          category_name: 'Spa & Beauty Services',
          price: 12500,
          description: 'Relaxing 60/90 minute full-body aromatherapeutic session.',
          image: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80',
          durations: ['60 Min Session', '90 Min Session']
        },
        {
          id: 'prod-spa-facial-01',
          name: 'Celestial 24K Gold Rejuvenation Facial',
          category_name: 'Spa & Beauty Services',
          price: 14500,
          description: 'Cellular renewal facial infused with pure 24K gold leaves.',
          image: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=800&q=80',
          durations: ['60 Min Session', '75 Min Session']
        },
        {
          id: 'prod-spa-nails-03',
          name: 'Royal Velvet Gel Manicure & Pedicure',
          category_name: 'Spa & Beauty Services',
          price: 6500,
          description: 'Organic cuticle care, exfoliating scrub, and long-lasting gel finish.',
          image: 'https://images.unsplash.com/photo-1632345031435-8727f6897d53?auto=format&fit=crop&w=800&q=80',
          durations: ['45 Min Session', '60 Min Session']
        },
        {
          id: 'prod-spa-makeup-04',
          name: 'Bridal & Red Carpet Glamour Artistry',
          category_name: 'Spa & Beauty Services',
          price: 18000,
          description: 'Bespoke celebrity artistry session with luxury cosmetics.',
          image: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=800&q=80',
          durations: ['90 Min Session']
        }
      ];
    }

    return res.json({ success: true, services });
  }
});

// GET /api/cashier/spa-slots?date=YYYY-MM-DD - Return session slots with status and cashier ownership
router.get('/spa-slots', async (req, res) => {
  const queryDate = req.query.date || new Date().toISOString().split('T')[0];
  const currentCashierId = req.cashier.id;

  try {
    const [rows] = await db.query(
      'SELECT * FROM spa_bookings WHERE booking_date = ? AND status != "cancelled" ORDER BY booking_time ASC',
      [queryDate]
    );

    // Combine with in-memory bookings for that date
    const memBookings = cashiersStore.getSpaBookings(queryDate).filter(b => b.status !== 'cancelled');
    const allBookings = [...(rows || [])];
    memBookings.forEach(mb => {
      if (!allBookings.some(b => b.id === mb.id || (b.booking_time === mb.booking_time && b.status !== 'cancelled'))) {
        allBookings.push(mb);
      }
    });

    const slots = STANDARD_TIME_SLOTS.map(time => {
      const booking = allBookings.find(b => b.booking_time === time && b.status !== 'cancelled');
      const isBooked = !!booking;
      return {
        time,
        status: isBooked ? 'booked' : 'available',
        isBooked,
        booking: isBooked ? {
          id: booking.id,
          service_id: booking.service_id,
          service_name: booking.service_name,
          customer_name: booking.customer_name,
          customer_phone: booking.customer_phone,
          customer_email: booking.customer_email,
          cashier_id: booking.cashier_id,
          cashier_name: booking.cashier_name,
          source: booking.source || (booking.cashier_id ? 'pos' : 'online'),
          price: Number(booking.price) || 0,
          status: booking.status,
          isCreatedByMe: booking.cashier_id === currentCashierId
        } : null
      };
    });

    return res.json({ success: true, date: queryDate, slots });

  } catch (error) {
    const memBookings = cashiersStore.getSpaBookings(queryDate).filter(b => b.status !== 'cancelled');

    const slots = STANDARD_TIME_SLOTS.map(time => {
      const booking = memBookings.find(b => b.booking_time === time && b.status !== 'cancelled');
      const isBooked = !!booking;
      return {
        time,
        status: isBooked ? 'booked' : 'available',
        isBooked,
        booking: isBooked ? {
          id: booking.id,
          service_id: booking.service_id,
          service_name: booking.service_name,
          customer_name: booking.customer_name,
          customer_phone: booking.customer_phone,
          customer_email: booking.customer_email,
          cashier_id: booking.cashier_id,
          cashier_name: booking.cashier_name,
          source: booking.source || (booking.cashier_id ? 'pos' : 'online'),
          price: Number(booking.price) || 0,
          status: booking.status,
          isCreatedByMe: booking.cashier_id === currentCashierId
        } : null
      };
    });

    return res.json({ success: true, date: queryDate, slots });
  }
});

// POST /api/cashier/spa-book - Book walk-in customer, create booking and linked POS order
router.post('/spa-book', async (req, res) => {
  const {
    serviceId, service_id,
    date, booking_date,
    timeSlot, booking_time,
    customerName, customer_name,
    customerPhone, customer_phone,
    paymentMethod, payment_method,
    price
  } = req.body;

  const sId = serviceId || service_id;
  const bDate = date || booking_date;
  const bTime = timeSlot || booking_time;
  const cName = (customerName || customer_name || '').trim();
  const cPhone = (customerPhone || customer_phone || '').trim();
  const payMethod = (paymentMethod || payment_method || 'cash').toLowerCase();

  if (!sId || !bDate || !bTime || !cName || !cPhone) {
    return res.status(400).json({
      success: false,
      error: 'Service ID, date, time slot, customer name, and customer phone number are required.'
    });
  }

  // Find service info
  let serviceName = 'Spa Treatment Session';
  let servicePrice = parseFloat(price || 0);
  let serviceImage = 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80';

  const matchedProd = productsStore.getProductById(sId);
  if (matchedProd) {
    serviceName = matchedProd.name;
    if (!servicePrice) servicePrice = matchedProd.price;
    serviceImage = (matchedProd.images && matchedProd.images[0]) || matchedProd.image || serviceImage;
  }

  try {
    const [prodRows] = await db.query('SELECT * FROM products WHERE id = ?', [sId]);
    if (prodRows && prodRows.length > 0) {
      serviceName = prodRows[0].name;
      if (!servicePrice) servicePrice = Number(prodRows[0].price);
      const images = parseJson(prodRows[0].images);
      if (images && images[0]) serviceImage = images[0];
    }
  } catch (e) {}

  if (!servicePrice || servicePrice <= 0) {
    servicePrice = 12500;
  }

  const cashierId = req.cashier.id;
  const cashierName = req.cashier.name;
  const paymentMode = process.env.PAYMENTS_MODE || 'simulation';

  const bookingId = crypto.randomUUID();
  const orderId = crypto.randomUUID();
  const orderNumber = `POS-SPA-${Math.floor(100000 + Math.random() * 900000)}`;

  try {
    // Check if slot already booked
    const [existing] = await db.query(
      'SELECT id FROM spa_bookings WHERE booking_date = ? AND booking_time = ? AND status != "cancelled"',
      [bDate, bTime]
    );

    if (existing && existing.length > 0) {
      return res.status(400).json({
        success: false,
        error: `The ${bTime} slot on ${bDate} is already booked. Please choose an available time slot.`
      });
    }

    // Check in-memory store
    const memExisting = cashiersStore.getSpaBookings(bDate).find(b => b.booking_time === bTime && b.status !== 'cancelled');
    if (memExisting) {
      return res.status(400).json({
        success: false,
        error: `The ${bTime} slot on ${bDate} is already booked. Please choose an available time slot.`
      });
    }

    // Insert Order (source = 'pos')
    await db.query(
      `INSERT INTO orders 
       (id, order_number, user_id, cashier_id, full_name, email, phone, address, city, payment_method, payment_status, payment_mode, subtotal, shipping, total, status, pickup_location, source)
       VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, 'paid', ?, ?, 0.00, ?, 'completed', 'In-Store Spa Suite', 'pos')`,
      [
        orderId,
        orderNumber,
        cashierId,
        cName,
        'walkin@crystalcrest.com',
        cPhone,
        'Flagship Store Spa Suite',
        'Kajiado Town',
        payMethod,
        paymentMode,
        servicePrice,
        servicePrice
      ]
    );

    // Insert Order Item
    await db.query(
      `INSERT INTO order_items (id, order_id, product_id, quantity, price_at_purchase)
       VALUES (?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), orderId, sId, 1, servicePrice]
    );

    // Insert Spa Booking
    await db.query(
      `INSERT INTO spa_bookings 
       (id, service_id, service_name, customer_name, customer_email, customer_phone, booking_date, booking_time, status, cashier_id, cashier_name, order_id, price, payment_method, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, ?, ?, ?, 'pos')`,
      [
        bookingId,
        sId,
        serviceName,
        cName,
        'walkin@crystalcrest.com',
        cPhone,
        bDate,
        bTime,
        cashierId,
        cashierName,
        orderId,
        servicePrice,
        payMethod
      ]
    );

  } catch (error) {
    console.warn('DB Spa Booking fallback:', error.message);
  }

  // Record in in-memory cashiersStore
  const bookingObj = {
    id: bookingId,
    service_id: sId,
    service_name: serviceName,
    customer_name: cName,
    customer_email: 'walkin@crystalcrest.com',
    customer_phone: cPhone,
    booking_date: bDate,
    booking_time: bTime,
    status: 'confirmed',
    cashier_id: cashierId,
    cashier_name: cashierName,
    order_id: orderId,
    price: servicePrice,
    payment_method: payMethod,
    source: 'pos',
    created_at: new Date().toISOString()
  };
  cashiersStore.addSpaBooking(bookingObj);

  const posOrderObj = {
    id: orderId,
    order_number: orderNumber,
    cashier_id: cashierId,
    cashier_name: cashierName,
    full_name: cName,
    email: 'walkin@crystalcrest.com',
    phone: cPhone,
    payment_method: payMethod,
    payment_status: 'paid',
    payment_mode: paymentMode,
    subtotal: servicePrice,
    shipping: 0.00,
    total: servicePrice,
    status: 'completed',
    pickup_location: 'In-Store Spa Suite',
    source: 'pos',
    created_at: new Date().toISOString(),
    items: [
      {
        id: crypto.randomUUID(),
        product_id: sId,
        name: `💆‍♀️ ${serviceName}`,
        quantity: 1,
        price_at_purchase: servicePrice,
        image: serviceImage
      }
    ]
  };
  cashiersStore.addPosOrder(posOrderObj);

  return res.json({
    success: true,
    bookingId,
    orderId,
    order_number: orderNumber,
    payment_mode: paymentMode,
    booking: {
      id: bookingId,
      service_name: serviceName,
      booking_date: bDate,
      booking_time: bTime,
      customer_name: cName,
      customer_phone: cPhone,
      total: servicePrice,
      payment_method: payMethod,
      order_number: orderNumber
    },
    message: `Walk-in spa session booked successfully for ${cName} at ${bTime} on ${bDate}!`
  });
});

// Helper for cancelling a cashier spa booking
async function handleCancelSpaBooking(req, res) {
  const { id } = req.params;
  const { reason } = req.body;
  const currentCashierId = req.cashier.id;

  if (!reason || !reason.trim()) {
    return res.status(400).json({
      success: false,
      error: 'A cancellation reason is required for audit shift logging.'
    });
  }

  let booking = null;

  try {
    const [rows] = await db.query('SELECT * FROM spa_bookings WHERE id = ?', [id]);
    if (rows && rows.length > 0) {
      booking = rows[0];
    }
  } catch (e) {}

  if (!booking) {
    booking = cashiersStore.findSpaBookingById(id);
  }

  if (!booking) {
    return res.status(404).json({ success: false, error: 'Spa booking session not found.' });
  }

  // Permission Scope: Cashiers can only cancel bookings created by themselves during their shift
  if (booking.cashier_id !== currentCashierId) {
    return res.status(403).json({
      success: false,
      error: 'Access denied: Cashiers can only cancel walk-in bookings created by their own account. Online bookings or bookings created by other cashiers require Administrator management.'
    });
  }

  const reasonText = reason.trim();

  try {
    await db.query(
      'UPDATE spa_bookings SET status = "cancelled", cancellation_reason = ? WHERE id = ?',
      [reasonText, id]
    );

    if (booking.order_id) {
      await db.query('UPDATE orders SET status = "cancelled" WHERE id = ?', [booking.order_id]);
    }
  } catch (e) {}

  cashiersStore.updateSpaBooking(id, {
    status: 'cancelled',
    cancellation_reason: reasonText
  });

  if (booking.order_id) {
    const posOrders = cashiersStore.getAllPosOrders();
    const orderIdx = posOrders.findIndex(o => o.id === booking.order_id);
    if (orderIdx > -1) {
      posOrders[orderIdx].status = 'cancelled';
    }
  }

  return res.json({
    success: true,
    message: `Spa booking for ${booking.customer_name} (${booking.booking_time}) has been cancelled and the slot is now freed.`
  });
}

// PUT /api/cashier/spa-slots/:id/cancel
router.put('/spa-slots/:id/cancel', handleCancelSpaBooking);

// PUT /api/cashier/spa-bookings/:id/cancel (alias)
router.put('/spa-bookings/:id/cancel', handleCancelSpaBooking);

// GET /api/cashier/my-sales - Return today's sales (products & spa walk-ins) for logged-in cashier only
router.get('/my-sales', async (req, res) => {
  const cashierId = req.cashier.id;

  try {
    const [orders] = await db.query(
      `SELECT * FROM orders 
       WHERE cashier_id = ? AND DATE(created_at) = CURDATE() 
       ORDER BY created_at DESC`,
      [cashierId]
    );

    if (orders && orders.length > 0) {
      for (let order of orders) {
        const [items] = await db.query(
          `SELECT oi.*, p.name as prod_name, p.images FROM order_items oi LEFT JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?`,
          [order.id]
        );
        order.items = items.map(i => {
          const prod = productsStore.getProductById(i.product_id) || {};
          return {
            ...i,
            name: i.prod_name || prod.name || (order.pickup_location && order.pickup_location.includes('Spa') ? 'Spa Session' : 'Cosmetics Item'),
            price_at_purchase: Number(i.price_at_purchase) || 0,
            images: parseJson(i.images),
            image: (parseJson(i.images)[0]) || prod.image || ''
          };
        });
        order.subtotal = Number(order.subtotal) || 0;
        order.shipping = Number(order.shipping) || 0;
        order.total = Number(order.total) || 0;
        order.payment_mode = order.payment_mode || 'simulation';
      }
      return res.json({ success: true, sales: orders });
    }

    throw new Error('Using cashiersStore for my-sales');

  } catch (error) {
    const sales = cashiersStore.getPosOrdersByCashier(cashierId);
    return res.json({ success: true, sales });
  }
});

module.exports = router;

