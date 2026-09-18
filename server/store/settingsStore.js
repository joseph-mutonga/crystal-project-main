const db = require('../config/db');

const DEFAULTS = {
  paybill_number: '400200',
  paybill_account_number: '104514',
  paybill_account_name: 'Crystal Crest',
  receipt_business_name: 'Crystal Crest',
  receipt_address: 'Crystal Crest Boutique, Kajiado Town',
  receipt_phone: '',
  receipt_email: '',
  receipt_footer: 'Thank you for shopping with Crystal Crest.',
  social_whatsapp: '254700074333',
  social_instagram: 'https://instagram.com/crystalcrestboutique',
  social_facebook: 'https://facebook.com/crystalcrestboutique',
  social_tiktok: 'https://tiktok.com/@crystalcrestboutique',
  contact_phone: '0700 074 333',
  contact_email: 'crystalcrest17@gmail.com',
  contact_address: 'Kajiado Town (Opp Crapas Hotel)'
};

const SOCIAL_KEYS = ['social_whatsapp', 'social_instagram', 'social_facebook', 'social_tiktok', 'contact_phone', 'contact_email', 'contact_address'];

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

async function getAllSocialSettings() {
  return SOCIAL_KEYS.reduce((settings, key) => {
    settings[key] = settingsCache[key] || DEFAULTS[key];
    return settings;
  }, {});
}

async function updateSocialSettings(settings) {
  SOCIAL_KEYS.forEach(key => {
    if (settings[key] !== undefined) settingsCache[key] = String(settings[key]).trim();
  });

  try {
    for (const key of SOCIAL_KEYS) {
      await db.query(
        'INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)',
        [key, settingsCache[key] || DEFAULTS[key]]
      );
    }
  } catch (e) {
    console.warn('Could not persist social settings update to DB:', e.message);
  }

  return getAllSocialSettings();
}

// Initial load
loadSettingsFromDb().catch(() => {});

module.exports = {
  loadSettingsFromDb,
  getSetting,
  getAllPaybillSettings,
  updatePaybillSettings,
  getAllSocialSettings,
  updateSocialSettings,
  DEFAULTS
};
