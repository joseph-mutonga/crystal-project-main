const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../config/db');

// In-memory fallback mock spa bookings if DB is offline
const MOCK_SPA_BOOKINGS = [
  {
    id: 'mock-b-1',
    booking_date: new Date().toISOString().split('T')[0],
    booking_time: '11:00 AM',
    service_name: 'Aromatherapy Damask Rose Body Massage'
  }
];

const STANDARD_TIME_SLOTS = [
  '09:00 AM',
  '11:00 AM',
  '01:00 PM',
  '03:00 PM',
  '05:00 PM',
  '07:00 PM'
];

function parseJsonField(val) {
  if (!val) return [];
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch (e) { return []; }
}

// GET /api/spa/services - Returns active spa services for customer spa page
router.get('/services', async (req, res) => {
  const productsStore = require('../store/productsStore');
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
        image: (parseJsonField(r.images)[0]) || r.image || 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80',
        durations: parseJsonField(r.sizes).length > 0 ? parseJsonField(r.sizes) : ['60 Min Session', '90 Min Session'],
        sizes: parseJsonField(r.sizes),
        colors: parseJsonField(r.colors)
      }));

      return res.json({ success: true, services });
    }

    throw new Error('Fallback to productsStore for Spa Services');

  } catch (error) {
    const spaItems = productsStore.getProducts().filter(p => 
      p.is_active !== false && 
      (p.category_id === 'cat-spa-006' || (p.category_name || '').toLowerCase().includes('spa'))
    );

    const services = spaItems.map(p => ({
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

    return res.json({ success: true, services });
  }
});

// GET /api/spa/slots?date=YYYY-MM-DD
router.get('/slots', async (req, res) => {
  const queryDate = req.query.date || new Date().toISOString().split('T')[0];

  try {
    const [rows] = await db.query(
      'SELECT booking_time FROM spa_bookings WHERE booking_date = ? AND status != "cancelled"',
      [queryDate]
    );

    const bookedTimes = rows.map(r => r.booking_time);

    const slots = STANDARD_TIME_SLOTS.map(time => ({
      time,
      isBooked: bookedTimes.includes(time),
      status: bookedTimes.includes(time) ? 'booked' : 'available'
    }));

    return res.json({ success: true, date: queryDate, slots });

  } catch (error) {
    console.warn('DB Spa slots fallback:', error.message);
    const bookedTimes = MOCK_SPA_BOOKINGS
      .filter(b => b.booking_date === queryDate)
      .map(b => b.booking_time);

    const slots = STANDARD_TIME_SLOTS.map(time => ({
      time,
      isBooked: bookedTimes.includes(time),
      status: bookedTimes.includes(time) ? 'booked' : 'available'
    }));

    return res.json({ success: true, date: queryDate, slots });
  }
});

// POST /api/spa/book - Book a spa session
router.post('/book', async (req, res) => {
  const {
    service_id,
    service_name,
    customer_name,
    customer_email,
    customer_phone,
    booking_date,
    booking_time
  } = req.body;

  if (!service_name || !customer_name || !customer_email || !booking_date || !booking_time) {
    return res.status(400).json({ success: false, error: 'Service name, name, email, date, and time slot are required.' });
  }

  const bookingId = crypto.randomUUID();

  try {
    // Check if already booked
    const [existing] = await db.query(
      'SELECT id FROM spa_bookings WHERE booking_date = ? AND booking_time = ? AND status != "cancelled"',
      [booking_date, booking_time]
    );

    if (existing && existing.length > 0) {
      return res.status(400).json({ success: false, error: `The ${booking_time} session slot on ${booking_date} is already booked. Please select another time slot.` });
    }

    await db.query(
      `INSERT INTO spa_bookings (id, service_id, service_name, customer_name, customer_email, customer_phone, booking_date, booking_time, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [bookingId, service_id || 'spa-service', service_name, customer_name.trim(), customer_email.toLowerCase().trim(), customer_phone || '', booking_date, booking_time, 'confirmed']
    );

    return res.json({
      success: true,
      bookingId,
      message: `Spa session reserved for ${booking_date} at ${booking_time}`
    });

  } catch (error) {
    console.warn('DB Spa booking fallback:', error.message);
    MOCK_SPA_BOOKINGS.push({
      id: bookingId,
      service_id,
      service_name,
      customer_name,
      customer_email,
      booking_date,
      booking_time
    });

    return res.json({
      success: true,
      bookingId,
      message: `Spa session reserved for ${booking_date} at ${booking_time}`
    });
  }
});

module.exports = router;
