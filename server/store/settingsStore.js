const db = require('../config/db');

const DEFAULTS = {
  paybill_number: '400200',
  paybill_account_number: '104514',
  paybill_account_name: 'Crystal Crest',
  receipt_business_name: 'Crystal Crest',
  receipt_address: 'Crystal Crest Boutique, Kajiado Town',
  receipt_phone: '',
  receipt_email: '',
  receipt_footer: 'Thank you for shopping with Crystal Crest.'
};

const settingsCache = { ...DEFAULTS };

async function loadSettingsFromDb() {
  try {
    const [rows] = await db.query('SELECT `key`, `value` FROM settings');
    if (rows && rows.length > 0) {
      rows.forEach(r => {
        settingsCache[r.key] = r.value;
      });
    } else {
      // Seed default settings
      for (const [key, value] of Object.entries(DEFAULTS)) {
        await db.query('INSERT IGNORE INTO settings (`key`, `value`) VALUES (?, ?)', [key, value]);
      }
    }
  } catch (e) {
    // If DB offline or table missing, keep defaults
  }
}

async function getSetting(key, fallback = '') {
  return settingsCache[key] !== undefined ? settingsCache[key] : (DEFAULTS[key] || fallback);
}

async function getAllPaybillSettings() {
  return Object.keys(DEFAULTS).reduce((settings, key) => {
    settings[key] = settingsCache[key] || DEFAULTS[key];
    return settings;
  }, {});
}

async function updatePaybillSettings(settings) {
  Object.keys(DEFAULTS).forEach(key => {
    if (settings[key] !== undefined) settingsCache[key] = String(settings[key]).trim();
  });

  try {
    const updates = Object.keys(DEFAULTS).map(key => [key, settingsCache[key] || DEFAULTS[key]]);
    for (const [k, v] of updates) {
      await db.query(
        'INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)',
        [k, v]
      );
    }
  } catch (e) {
    console.warn('Could not persist settings update to DB:', e.message);
  }

  return getAllPaybillSettings();
}

// Initial load
loadSettingsFromDb().catch(() => {});

module.exports = {
  loadSettingsFromDb,
  getSetting,
  getAllPaybillSettings,
  updatePaybillSettings,
  DEFAULTS
};
