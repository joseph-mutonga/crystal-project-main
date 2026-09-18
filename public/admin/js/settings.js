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
  await loadSocialSettings();
  setupFormListener();
  setupSocialFormListener();
  setupAdminPinChange();
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
      document.getElementById('setting-receipt-business-name').value = s.receipt_business_name || 'Crystal Crest';
      document.getElementById('setting-receipt-address').value = s.receipt_address || '';
      document.getElementById('setting-receipt-phone').value = s.receipt_phone || '';
      document.getElementById('setting-receipt-email').value = s.receipt_email || '';
      document.getElementById('setting-receipt-footer').value = s.receipt_footer || '';
    }
  } catch (err) {
    console.error('Failed to load settings:', err);
    UI.showToast('Failed to load current settings.', 'Error', 'error');
  }
}

async function loadSocialSettings() {
  try {
    const res = await http.get('/api/settings/social');
    if (res.success && res.settings) {
      const s = res.settings;
      document.getElementById('setting-social-whatsapp').value = s.social_whatsapp || '';
      document.getElementById('setting-social-instagram').value = s.social_instagram || '';
      document.getElementById('setting-social-facebook').value = s.social_facebook || '';
      document.getElementById('setting-social-tiktok').value = s.social_tiktok || '';
      document.getElementById('setting-contact-phone').value = s.contact_phone || '';
      document.getElementById('setting-contact-email').value = s.contact_email || '';
      document.getElementById('setting-contact-address').value = s.contact_address || '';
    }
  } catch (err) {
    console.error('Failed to load social settings:', err);
  }
}

function setupSocialFormListener() {
  const form = document.getElementById('social-settings-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('save-social-btn');
    UI.setButtonLoading(saveBtn, true, 'Saving...');

    try {
      const res = await http.put('/api/settings/social', {
        social_whatsapp: document.getElementById('setting-social-whatsapp').value.trim(),
        social_instagram: document.getElementById('setting-social-instagram').value.trim(),
        social_facebook: document.getElementById('setting-social-facebook').value.trim(),
        social_tiktok: document.getElementById('setting-social-tiktok').value.trim(),
        contact_phone: document.getElementById('setting-contact-phone').value.trim(),
        contact_email: document.getElementById('setting-contact-email').value.trim(),
        contact_address: document.getElementById('setting-contact-address').value.trim()
      });

      if (!res.success) throw new Error(res.error || 'Failed to update social & contact links.');
      UI.showToast('Social media & contact links saved successfully!', 'Settings Saved', 'success');
    } catch (err) {
      UI.showToast(err.message || 'Server error updating social links.', 'Error', 'error');
    } finally {
      UI.setButtonLoading(saveBtn, false);
    }
  });
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

  const receiptForm = document.getElementById('receipt-settings-form');
  receiptForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('save-receipt-btn');
    UI.setButtonLoading(saveBtn, true, 'Saving...');
    try {
      const res = await http.put('/api/settings/paybill', {
        paybill_number: document.getElementById('setting-paybill-number').value.trim(),
        paybill_account_number: document.getElementById('setting-paybill-account').value.trim(),
        paybill_account_name: document.getElementById('setting-paybill-name').value.trim(),
        receipt_business_name: document.getElementById('setting-receipt-business-name').value.trim(),
        receipt_address: document.getElementById('setting-receipt-address').value.trim(),
        receipt_phone: document.getElementById('setting-receipt-phone').value.trim(),
        receipt_email: document.getElementById('setting-receipt-email').value.trim(),
        receipt_footer: document.getElementById('setting-receipt-footer').value.trim()
      });
      if (!res.success) throw new Error(res.error || 'Failed to save receipt settings.');
      UI.showToast('Receipt settings saved successfully.', 'Settings Saved', 'success');
    } catch (err) {
      UI.showToast(err.message || 'Server error updating receipt settings.', 'Error', 'error');
    } finally {
      UI.setButtonLoading(saveBtn, false);
    }
  });
}

function setupAdminPinChange() {
  const sendOtpButton = document.getElementById('send-admin-pin-otp-btn');
  const pinForm = document.getElementById('admin-pin-form');
  const cancelButton = document.getElementById('cancel-admin-pin-change-btn');

  sendOtpButton?.addEventListener('click', async () => {
    UI.setButtonLoading(sendOtpButton, true, 'Sending...');
    try {
      const response = await http.post('/api/admin/security/pin-otp');
      if (!response.success) throw new Error(response.error || 'Unable to send the verification code.');
      pinForm?.classList.remove('hidden');
      document.getElementById('admin-pin-otp')?.focus();
      UI.showToast('Verification code sent to your signed-in email.', 'Code Sent', 'success');
    } catch (error) {
      UI.showToast(error.message || 'Unable to send the verification code.', 'Error', 'error');
    } finally {
      UI.setButtonLoading(sendOtpButton, false);
    }
  });

  cancelButton?.addEventListener('click', () => {
    pinForm?.reset();
    pinForm?.classList.add('hidden');
  });

  pinForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const otp = document.getElementById('admin-pin-otp').value.trim();
    const newPin = document.getElementById('admin-new-pin').value.trim();
    const confirmPin = document.getElementById('admin-confirm-pin').value.trim();
    const changeButton = document.getElementById('change-admin-pin-btn');

    if (!/^\d{6}$/.test(otp)) {
      UI.showToast('Enter the 6-digit verification code.', 'Validation Error', 'error');
      return;
    }
    if (!/^\d{4}$/.test(newPin)) {
      UI.showToast('New PIN must be exactly 4 digits.', 'Validation Error', 'error');
      return;
    }
    if (newPin !== confirmPin) {
      UI.showToast('The new PIN entries do not match.', 'Validation Error', 'error');
      return;
    }

    UI.setButtonLoading(changeButton, true, 'Changing...');
    try {
      const response = await http.post('/api/admin/security/pin', { otp, newPin });
      if (!response.success) throw new Error(response.error || 'Unable to change the PIN.');
      pinForm.reset();
      pinForm.classList.add('hidden');
      UI.showToast('Admin portal PIN changed successfully.', 'PIN Updated', 'success');
    } catch (error) {
      UI.showToast(error.message || 'Unable to change the PIN.', 'Error', 'error');
    } finally {
      UI.setButtonLoading(changeButton, false);
    }
  });
}
