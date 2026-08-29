const db = require('../config/db');

const DEFAULTS = {
  paybill_number: '400200',
  paybill_account_number: '104514',
  paybill_account_name: 'Crystal Crest'
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
  return {
    paybill_number: settingsCache.paybill_number || DEFAULTS.paybill_number,
    paybill_account_number: settingsCache.paybill_account_number || DEFAULTS.paybill_account_number,
    paybill_account_name: settingsCache.paybill_account_name || DEFAULTS.paybill_account_name
  };
}

async function updatePaybillSettings({ paybill_number, paybill_account_number, paybill_account_name }) {
  if (paybill_number) settingsCache.paybill_number = String(paybill_number).trim();
  if (paybill_account_number) settingsCache.paybill_account_number = String(paybill_account_number).trim();
  if (paybill_account_name) settingsCache.paybill_account_name = String(paybill_account_name).trim();

  try {
    const updates = [
      ['paybill_number', settingsCache.paybill_number],
      ['paybill_account_number', settingsCache.paybill_account_number],
      ['paybill_account_name', settingsCache.paybill_account_name]
    ];
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
