/**
 * Crystal Crest - Admin Spa Sessions & Slot Calendar (js/spa-bookings.js)
 */

import { AdminLayout } from '../../js/shared/admin-layout.js';
import { http, ApiService } from '../../js/shared/api.js';
import { UI } from '../../js/shared/ui.js';

let selectedDate = new Date().toISOString().split('T')[0];
let bookingsList = [];

async function initSpaBookingsPage() {
  const user = await AdminLayout.init('spa-bookings', 'Spa Sessions & Slot Management');
  if (!user) return;

  const dateInput = document.getElementById('admin-spa-date-filter');
  if (dateInput) {
    dateInput.value = selectedDate;
    dateInput.addEventListener('change', async (e) => {
      selectedDate = e.target.value;
      await loadSpaData();
    });
  }

  await loadSpaData();
  setupEventListeners();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSpaBookingsPage);
} else {
  initSpaBookingsPage();
}

async function loadSpaData() {
  await loadSlotsGrid(selectedDate);
  await loadBookingsTable(selectedDate);
}

async function loadSlotsGrid(date) {
  const container = document.getElementById('admin-spa-slots-grid');
  if (!container) return;

  try {
    const slots = await ApiService.getSpaSlots(date);

    container.innerHTML = slots.map(slot => {
      const isBooked = slot.isBooked || slot.status === 'booked';
      return `
        <div class="p-3 rounded-xl border ${isBooked ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-900'} flex flex-col justify-between items-center text-center space-y-1">
          <span class="font-bold text-xs">${slot.time}</span>
          <span class="px-2 py-0.5 rounded text-[9px] font-bold uppercase ${isBooked ? 'bg-red-200 text-red-800' : 'bg-emerald-200 text-emerald-800'}">
            ${isBooked ? '🔒 Reserved' : '✓ Available'}
          </span>
        </div>
      `;
    }).join('');

  } catch (e) {
    container.innerHTML = `<div class="col-span-full text-xs text-red-500">Failed to load slots.</div>`;
  }
}

async function loadBookingsTable(date) {
  const tbody = document.getElementById('admin-spa-tbody');
  if (!tbody) return;

  UI.renderSkeletonTable(tbody, 3, 6);

  try {
    const res = await http.get('/api/admin/spa-bookings', { date });
    bookingsList = res.bookings || [];

    if (bookingsList.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="p-8 text-center text-gray-400">
            <div class="space-y-2">
              <span class="text-3xl block">💆‍♀️</span>
              <h4 class="font-bold text-gray-700 text-sm">No Spa Session Bookings</h4>
              <p class="text-xs text-gray-500">No client bookings or reserved slots for ${date}.</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = bookingsList.map(b => `
      <tr class="hover:bg-gray-50 transition-colors border-b border-gray-100">
        <td class="p-3.5 font-bold text-gray-900">${b.booking_date} • ${b.booking_time}</td>
        <td class="p-3.5 text-gray-800 font-semibold">${b.service_name}</td>
        <td class="p-3.5 font-medium text-gray-900">${b.customer_name}</td>
        <td class="p-3.5 text-gray-500 text-xs">${b.customer_email} ${b.customer_phone ? `(${b.customer_phone})` : ''}</td>
        <td class="p-3.5">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${b.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' : b.status === 'blocked' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}">
            ${b.status || 'confirmed'}
          </span>
        </td>
        <td class="p-3.5 text-right space-x-2">
          ${b.status !== 'cancelled' ? `
            <button data-cancel-spa="${b.id}" class="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold text-[11px] rounded-lg border border-amber-200 transition-colors">Cancel</button>
          ` : ''}
          <button data-delete-spa="${b.id}" class="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 font-semibold text-[11px] rounded-lg border border-red-200 transition-colors">Free Slot</button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('[data-cancel-spa]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-cancel-spa');
        const booking = bookingsList.find(b => b.id === id);

        const confirmed = await UI.showConfirm({
          title: 'Cancel Spa Booking',
          message: `Are you sure you want to cancel spa booking for ${booking ? booking.customer_name : 'this client'} at ${booking ? booking.booking_time : ''}?`,
          confirmText: 'Cancel Booking',
          danger: true
        });

        if (confirmed) {
          UI.setButtonLoading(e.currentTarget, true, 'Canceling...');
          try {
            await http.put(`/api/admin/spa-bookings/${id}`, { status: 'cancelled' });
            UI.showToast("Spa booking canceled.", "Booking Canceled", "success");
            await loadSpaData();
          } catch (err) {
            UI.showToast(err.message || 'Failed to cancel booking', "Error", "error");
          } finally {
            UI.setButtonLoading(e.currentTarget, false);
          }
        }
      });
    });

    tbody.querySelectorAll('[data-delete-spa]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-delete-spa');
        const booking = bookingsList.find(b => b.id === id);

        const confirmed = await UI.showConfirm({
          title: 'Free Spa Slot',
          message: `Are you sure you want to free this slot and delete the booking record for ${booking ? booking.customer_name : 'this client'}?`,
          confirmText: 'Free Slot',
          danger: true
        });

        if (confirmed) {
          UI.setButtonLoading(e.currentTarget, true, 'Freeing Slot...');
          try {
            await http.delete(`/api/admin/spa-bookings/${id}`);
            UI.showToast("Spa slot is now available.", "Slot Freed", "success");
            await loadSpaData();
          } catch (err) {
            UI.showToast(err.message || 'Failed to delete booking', "Error", "error");
          } finally {
            UI.setButtonLoading(e.currentTarget, false);
          }
        }
      });
    });

  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-red-400">Failed to load bookings.</td></tr>`;
  }
}

function setupEventListeners() {
  document.getElementById('open-block-slot-btn')?.addEventListener('click', () => {
    document.getElementById('block-form-date').value = selectedDate;
    document.getElementById('block-slot-modal-backdrop')?.classList.remove('hidden');
  });

  document.getElementById('close-block-modal')?.addEventListener('click', closeModal);
  document.getElementById('cancel-block-modal')?.addEventListener('click', closeModal);

  // 1. ADD NEW SPA SERVICE HANDLERS
  document.getElementById('open-add-spa-service-btn')?.addEventListener('click', () => {
    document.getElementById('add-spa-service-form')?.reset();
    document.getElementById('spa-service-media-name').textContent = 'No file selected';
    document.getElementById('add-spa-modal-backdrop')?.classList.remove('hidden');
  });

  document.getElementById('spa-service-media')?.addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    document.getElementById('spa-service-media-name').textContent = file ? file.name : 'No file selected';
  });

  document.getElementById('close-add-spa-modal')?.addEventListener('click', () => {
    document.getElementById('add-spa-modal-backdrop')?.classList.add('hidden');
  });

  document.getElementById('cancel-add-spa-modal')?.addEventListener('click', () => {
    document.getElementById('add-spa-modal-backdrop')?.classList.add('hidden');
  });

  const addSpaForm = document.getElementById('add-spa-service-form');
  if (addSpaForm) {
    addSpaForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = addSpaForm.querySelector('button[type="submit"]');

      const name = document.getElementById('spa-service-name').value.trim();
      const spa_type = document.getElementById('spa-service-type').value;
      const price = parseFloat(document.getElementById('spa-service-price').value || 0);
      const durations = document.getElementById('spa-service-duration').value.split(',').map(d => d.trim()).filter(Boolean);
      const description = document.getElementById('spa-service-description').value.trim();
      const mediaFile = document.getElementById('spa-service-media').files?.[0];
      const mediaUrl = document.getElementById('spa-service-image').value.trim();

      if (mediaFile && mediaFile.size > 30 * 1024 * 1024) {
        UI.showToast('Media file must be 30 MB or smaller.', 'File Too Large', 'error');
        return;
      }

      UI.setButtonLoading(submitBtn, true, 'Publishing Service...');

      try {
        const formData = new FormData();
        formData.append('name', name);
        formData.append('category_id', 'cat-spa-006');
        formData.append('category_name', 'Spa & Beauty Services');
        formData.append('price', price);
        formData.append('buying_price', 0);
        formData.append('stock_quantity', 100);
        formData.append('description', description);
        formData.append('is_active', true);
        formData.append('sizes', JSON.stringify(durations));
        formData.append('colors', JSON.stringify([]));
        if (mediaFile) {
          formData.append('imageFile', mediaFile);
        } else if (mediaUrl) {
          formData.append('images', JSON.stringify([mediaUrl]));
        }

        const res = await fetch('/api/admin/products', {
          method: 'POST',
          credentials: 'include',
          body: formData
        });

        const data = await res.json();
        if (data.success) {
          UI.showToast(`Spa service "${name}" published to customer Spa page!`, "Spa Service Created", "success");
          document.getElementById('add-spa-modal-backdrop')?.classList.add('hidden');
        } else {
          UI.showToast(data.error || 'Failed to create spa service', "Error", "error");
        }

      } catch (err) {
        UI.showToast('Error saving spa service', "Error", "error");
      } finally {
        UI.setButtonLoading(submitBtn, false);
      }
    });
  }

  // 2. BLOCK SLOT HANDLERS
  const form = document.getElementById('block-slot-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector('button[type="submit"]');

      const date = document.getElementById('block-form-date').value;
      const time = document.getElementById('block-form-time').value;
      const service_name = document.getElementById('block-form-service').value.trim() || 'Reserved Spa Slot';
      const customer_name = document.getElementById('block-form-client').value.trim() || 'Admin Reserved';

      UI.setButtonLoading(submitBtn, true, 'Reserving Slot...');

      try {
        await http.post('/api/admin/spa-bookings', {
          booking_date: date,
          booking_time: time,
          service_name,
          customer_name,
          customer_email: 'admin@crystalcrest.com',
          status: 'blocked'
        });

        UI.showToast(`Reserved slot for ${date} at ${time}!`, "Slot Reserved", "success");
        closeModal();
        selectedDate = date;
        document.getElementById('admin-spa-date-filter').value = date;
        await loadSpaData();

      } catch (err) {
        UI.showToast(err.message || 'Failed to block slot', "Reservation Error", "error");
      } finally {
        UI.setButtonLoading(submitBtn, false);
      }
    });
  }
}

function closeModal() {
  document.getElementById('block-slot-modal-backdrop')?.classList.add('hidden');
}
