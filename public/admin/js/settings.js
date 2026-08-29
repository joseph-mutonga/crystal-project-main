/**
 * Crystal Crest - Admin Settings Logic (public/admin/js/settings.js)
 */

import { AdminLayout } from '../../js/shared/admin-layout.js';
import { http } from '../../js/shared/api.js';
import { UI } from '../../js/shared/ui.js';

async function initSettingsPage() {
  const user = await AdminLayout.init('settings', 'Store & Paybill Settings');
  if (!user) return;

  await loadPaybillSettings();
  setupFormListener();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSettingsPage);
} else {
  initSettingsPage();
}

async function loadPaybillSettings() {
  try {
    const res = await http.get('/api/settings/paybill');
    if (res.success && res.settings) {
      const s = res.settings;
      const numEl = document.getElementById('setting-paybill-number');
      const accEl = document.getElementById('setting-paybill-account');
      const nameEl = document.getElementById('setting-paybill-name');

      if (numEl) numEl.value = s.paybill_number || '400200';
      if (accEl) accEl.value = s.paybill_account_number || '104514';
      if (nameEl) nameEl.value = s.paybill_account_name || 'Crystal Crest';
    }
  } catch (err) {
    console.error('Failed to load settings:', err);
    UI.showToast('Failed to load current settings.', 'Error', 'error');
  }
}

function setupFormListener() {
  const form = document.getElementById('paybill-settings-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('save-paybill-btn');
    const msgEl = document.getElementById('save-status-msg');

    const paybill_number = document.getElementById('setting-paybill-number').value.trim();
    const paybill_account_number = document.getElementById('setting-paybill-account').value.trim();
    const paybill_account_name = document.getElementById('setting-paybill-name').value.trim();

    if (!paybill_number || !paybill_account_number) {
      UI.showToast('Please provide both Business Number and Account Number.', 'Validation Error', 'error');
      return;
    }

    UI.setButtonLoading(saveBtn, true, 'Saving...');

    try {
      const res = await http.put('/api/settings/paybill', {
        paybill_number,
        paybill_account_number,
        paybill_account_name
      });

      if (res.success) {
        UI.showToast('Paybill settings saved successfully!', 'Settings Saved', 'success');
        if (msgEl) {
          msgEl.textContent = '✓ Saved successfully';
          msgEl.classList.remove('hidden');
          setTimeout(() => msgEl.classList.add('hidden'), 3000);
        }
      } else {
        UI.showToast(res.error || 'Failed to update settings.', 'Error', 'error');
      }
    } catch (err) {
      UI.showToast(err.message || 'Server error updating settings.', 'Error', 'error');
    } finally {
      UI.setButtonLoading(saveBtn, false);
    }
  });
}
