const express = require('express');
const router = express.Router();
const settingsStore = require('../store/settingsStore');
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
router.put('/paybill', requireRole('admin'), async (req, res) => {
  const { paybill_number, paybill_account_number, paybill_account_name } = req.body;

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
      paybill_account_name: paybill_account_name || 'Crystal Crest'
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

module.exports = router;
