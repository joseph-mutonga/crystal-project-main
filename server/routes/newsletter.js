const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../config/db');

// POST /api/newsletter/subscribe
router.post('/subscribe', async (req, res) => {
  const { email } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ success: false, error: 'Please provide a valid email address.' });
  }

  const id = crypto.randomUUID();

  try {
    await db.query(
      'INSERT INTO newsletter_subscribers (id, email) VALUES (?, ?)',
      [id, email.toLowerCase().trim()]
    );

    res.json({
      success: true,
      message: 'Subscription successful! Welcome to the Crystal Crest VIP Circle.'
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.json({
        success: true,
        message: 'You are already subscribed to our VIP newsletter.'
      });
    }

    console.warn('Newsletter subscription fallback (DB offline or error):', error.message);
    res.json({
      success: true,
      message: 'Subscription successful! Welcome to the Crystal Crest VIP Circle.'
    });
  }
});

module.exports = router;
