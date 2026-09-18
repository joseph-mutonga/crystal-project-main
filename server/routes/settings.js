const express = require('express');
const router = express.Router();
const settingsStore = require('../store/settingsStore');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/permissions');

// GET /api/settings/paybill - Retrieve current Paybill account details
router.get('/paybill', async (req, res) => {
  try {
    const settings = await settingsStore.getAllPaybillSettings();
    return res.json({ success: true, settings });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/settings/paybill - Update Paybill account details (Admin only)
router.put('/paybill', requireAuth, requireRole('admin'), async (req, res) => {
  const {
    paybill_number, paybill_account_number, paybill_account_name,
    receipt_business_name, receipt_address, receipt_phone, receipt_email, receipt_footer
  } = req.body;

  if (!paybill_number || !paybill_account_number) {
    return res.status(400).json({
      success: false,
      error: 'Paybill Business Number and Account Number are required.'
    });
  }

  try {
    const updated = await settingsStore.updatePaybillSettings({
      paybill_number,
      paybill_account_number,
      paybill_account_name: paybill_account_name || 'Crystal Crest',
      receipt_business_name, receipt_address, receipt_phone, receipt_email, receipt_footer
    });

    return res.json({
      success: true,
      message: 'Paybill settings updated successfully.',
      settings: updated
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/settings/social - Public: retrieve social media links & contact details shown in the storefront footer
router.get('/social', async (req, res) => {
  try {
    const settings = await settingsStore.getAllSocialSettings();
    return res.json({ success: true, settings });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/settings/social - Update social media links & contact details (Admin only)
router.put('/social', requireAuth, requireRole('admin'), async (req, res) => {
  const {
    social_whatsapp, social_instagram, social_facebook, social_tiktok,
    contact_phone, contact_email, contact_address
  } = req.body;

  try {
    const updated = await settingsStore.updateSocialSettings({
      social_whatsapp, social_instagram, social_facebook, social_tiktok,
      contact_phone, contact_email, contact_address
    });

    return res.json({
      success: true,
      message: 'Social media & contact settings updated successfully.',
      settings: updated
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
