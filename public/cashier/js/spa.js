/**
 * Crystal Crest - Cashier Spa Walk-in Sessions & Slot Management (public/cashier/js/spa.js)
 */

import { CashierGuard } from '../../js/shared/cashier-guard.js';
import { UI } from '../../js/shared/ui.js';

let activeCashier = null;
let selectedDate = new Date().toISOString().split('T')[0];
let spaServices = [];
let spaSlots = [];

let selectedSlotTime = null;
let selectedPaymentMethod = 'cash';
let bookingToCancel = null;

async function initSpaPage() {
  activeCashier = await CashierGuard.init('spa');
  if (!activeCashier) return;

  const dateInput = document.getElementById('spa-date-input');
  if (dateInput) {
    dateInput.value = selectedDate;
    dateInput.min = new Date().toISOString().split('T')[0];
    dateInput.addEventListener('change', async (e) => {
      selectedDate = e.target.value;
      updateDateLabel();
      await loadSpaSlots(selectedDate);
    });
  }

  updateDateLabel();
  setupEventListeners();
  
  await Promise.all([
    loadSpaServices(),
    loadSpaSlots(selectedDate)
  ]);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSpaPage);
} else {
  initSpaPage();
}

function updateDateLabel() {
  const label = document.getElementById('current-slot-date-label');
  const today = new Date().toISOString().split('T')[0];
  const tomorrowObj = new Date();
  tomorrowObj.setDate(tomorrowObj.getDate() + 1);
  const tomorrow = tomorrowObj.toISOString().split('T')[0];

  if (label) {
    if (selectedDate === today) {
      label.textContent = 'Today, ' + new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } else if (selectedDate === tomorrow) {
      label.textContent = 'Tomorrow, ' + tomorrowObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } else {
      label.textContent = selectedDate;
    }
  }
}

async function loadSpaServices() {
  const carousel = document.getElementById('spa-services-carousel');
  const select = document.getElementById('modal-service-select');
  const countBadge = document.getElementById('services-count-badge');

  try {
    const res = await fetch('/api/cashier/spa-services', { credentials: 'include' });
    const data = await res.json();
    spaServices = data.services || [];

    if (countBadge) {
      countBadge.textContent = `${spaServices.length} Rituals Active`;
    }

    // Render quick catalog strip
    if (carousel) {
      if (spaServices.length === 0) {
        carousel.innerHTML = `<div class="col-span-full py-4 text-center text-xs text-gray-400">No active spa rituals found.</div>`;
      } else {
        carousel.innerHTML = spaServices.map(s => {
          const priceNum = typeof s.price === 'number' ? s.price : (parseFloat(s.price) || 0);
          const durationStr = Array.isArray(s.durations) ? s.durations.join(' • ') : '60 Min Session';
          const isVideo = /\.(mp4|webm)(?:[?#]|$)/i.test(s.image || '');
          return `
            <div class="bg-white rounded-2xl p-3 border border-gray-200 shadow-sm flex flex-col justify-between space-y-2 hover:border-[#9B72CF] transition-all">
              <div class="space-y-1.5">
                <div class="aspect-video w-full rounded-xl overflow-hidden bg-gray-100 relative">
                  ${isVideo
                    ? `<video src="${s.image}" class="w-full h-full object-cover" muted loop playsinline autoplay></video>`
                    : `<img src="${s.image}" alt="${s.name}" class="w-full h-full object-cover">`}
                  <span class="absolute bottom-1 right-1 px-2 py-0.5 bg-gray-900/80 text-white font-bold text-[9px] rounded-md">
                    ${durationStr}
                  </span>
                </div>
                <div>
                  <h4 class="font-bold text-xs text-gray-900 line-clamp-1 leading-snug">${s.name}</h4>
                  <p class="text-[10px] text-gray-500 line-clamp-1">${s.description}</p>
                </div>
              </div>
              <div class="pt-1.5 flex items-center justify-between border-t border-gray-100">
                <span class="font-bold text-xs text-[#9B72CF]">KSh ${priceNum.toLocaleString()}</span>
                <span class="text-[9px] px-2 py-0.5 bg-purple-50 text-[#9B72CF] font-bold rounded-md">Walk-in</span>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // Populate Modal Dropdown
    if (select) {
      select.innerHTML = '<option value="">-- Choose Spa Service --</option>' + spaServices.map(s => {
        const priceNum = typeof s.price === 'number' ? s.price : (parseFloat(s.price) || 0);
        return `<option value="${s.id}" data-price="${priceNum}">${s.name} — KSh ${priceNum.toLocaleString()}</option>`;
      }).join('');
    }

  } catch (err) {
    console.error('Failed to load spa services', err);
    if (carousel) carousel.innerHTML = `<div class="col-span-full py-4 text-center text-xs text-red-500">Failed to load spa services.</div>`;
  }
}

async function loadSpaSlots(date) {
  const container = document.getElementById('spa-slots-grid');
  if (!container) return;

  container.innerHTML = `
    <div class="col-span-full py-12 text-center text-xs text-gray-400 flex flex-col items-center justify-center gap-2">
      <span class="w-6 h-6 border-2 border-[#9B72CF] border-t-transparent rounded-full animate-spin"></span>
      <span>Checking session availability...</span>
    </div>
  `;

  try {
    const res = await fetch(`/api/cashier/spa-slots?date=${date}`, { credentials: 'include' });
    const data = await res.json();
    spaSlots = data.slots || [];

    if (spaSlots.length === 0) {
      container.innerHTML = `<div class="col-span-full py-12 text-center text-xs text-gray-400">No session slots available for ${date}.</div>`;
      return;
    }

    container.innerHTML = spaSlots.map(slot => {
      const isBooked = slot.isBooked || slot.status === 'booked';
      const booking = slot.booking || {};
      const isMyBooking = booking.isCreatedByMe;

      if (!isBooked) {
        // AVAILABLE GREEN SLOT
        return `
          <div data-book-slot="${slot.time}" class="p-5 rounded-2xl border-2 border-emerald-300 bg-emerald-50/60 hover:bg-emerald-100/70 hover:border-emerald-500 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-4 group">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="w-8 h-8 rounded-xl bg-emerald-200/80 text-emerald-800 font-bold flex items-center justify-center text-xs">🕒</span>
                <div>
                  <span class="font-serif-heading text-base font-bold text-gray-900 block">${slot.time}</span>
                  <span class="text-[10px] text-emerald-700 font-semibold">Standard Daily Slot</span>
                </div>
              </div>
              <span class="px-2.5 py-1 bg-emerald-200 text-emerald-900 border border-emerald-300 rounded-lg text-[10px] font-extrabold uppercase tracking-wider">
                ✓ Available
              </span>
            </div>

            <div class="pt-2 border-t border-emerald-200/60 flex items-center justify-between">
              <span class="text-xs font-bold text-emerald-800 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                <span>+ Book Walk-in Client</span>
                <span>→</span>
              </span>
              <span class="w-7 h-7 rounded-lg bg-emerald-600 group-hover:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center shadow-sm">
                +
              </span>
            </div>
          </div>
        `;
      }

      if (isMyBooking) {
        // BOOKED BY LOGGED IN CASHIER (THIS SHIFT)
        const priceNum = typeof booking.price === 'number' ? booking.price : (parseFloat(booking.price) || 0);
        return `
          <div class="p-5 rounded-2xl border-2 border-[#9B72CF]/60 bg-purple-50/70 shadow-sm flex flex-col justify-between space-y-3.5">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="w-8 h-8 rounded-xl bg-[#9B72CF] text-white font-bold flex items-center justify-center text-xs">💆‍♀️</span>
                <div>
                  <span class="font-serif-heading text-base font-bold text-gray-900 block">${slot.time}</span>
                  <span class="text-[10px] text-purple-700 font-semibold">Walk-in Reservation</span>
                </div>
              </div>
              <span class="px-2.5 py-1 bg-purple-200/80 text-purple-900 border border-purple-300 rounded-lg text-[10px] font-extrabold uppercase tracking-wider">
                Your Shift
              </span>
            </div>

            <div class="space-y-1 bg-white/80 p-3 rounded-xl border border-purple-100 text-xs">
              <div class="font-bold text-gray-900 line-clamp-1">${booking.service_name || 'Spa Service'}</div>
              <div class="flex items-center justify-between text-gray-600 text-[11px]">
                <span>👤 ${booking.customer_name}</span>
                <span class="font-mono text-gray-500">${booking.customer_phone || ''}</span>
              </div>
              <div class="flex items-center justify-between text-[11px] pt-1 border-t border-gray-100 font-semibold">
                <span class="text-[#9B72CF]">KSh ${priceNum.toLocaleString()} (${(booking.source || 'pos').toUpperCase()})</span>
                <span class="text-emerald-700 uppercase font-bold text-[9px] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">Paid</span>
              </div>
            </div>

            <div class="pt-1 flex items-center justify-between">
              <span class="text-[10px] text-gray-500">Booked by ${booking.cashier_name || 'You'}</span>
              <button data-cancel-booking-id="${booking.id}" data-customer="${booking.customer_name}" data-time="${slot.time}" class="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 border border-red-200 font-bold text-xs rounded-xl transition-colors shadow-sm flex items-center gap-1">
                <span>✕</span>
                <span>Cancel Booking</span>
              </button>
            </div>
          </div>
        `;
      }

      // BOOKED ONLINE OR BY OTHER CASHIER (LOCKED / ADMIN MANAGED)
      return `
        <div class="p-5 rounded-2xl border-2 border-gray-200 bg-gray-50/80 opacity-80 flex flex-col justify-between space-y-3.5">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="w-8 h-8 rounded-xl bg-gray-200 text-gray-600 font-bold flex items-center justify-center text-xs">🔒</span>
              <div>
                <span class="font-serif-heading text-base font-bold text-gray-700 block">${slot.time}</span>
                <span class="text-[10px] text-gray-400 font-semibold">Online / Admin Booking</span>
              </div>
            </div>
            <span class="px-2.5 py-1 bg-gray-200 text-gray-700 border border-gray-300 rounded-lg text-[10px] font-extrabold uppercase tracking-wider">
              🔒 Reserved
            </span>
          </div>

          <div class="space-y-1 bg-white p-3 rounded-xl border border-gray-200 text-xs">
            <div class="font-bold text-gray-800 line-clamp-1">${booking.service_name || 'Reserved Session'}</div>
            <div class="text-gray-500 text-[11px]">👤 ${booking.customer_name || 'Customer'}</div>
          </div>

          <div class="pt-1 flex items-center justify-between text-[10px] text-gray-400">
            <span>Admin managed reservation</span>
            <span class="italic">Locked</span>
          </div>
        </div>
      `;
    }).join('');

    // Attach click listeners for booking available slots
    container.querySelectorAll('[data-book-slot]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const time = e.currentTarget.getAttribute('data-book-slot');
        openBookingModal(time);
      });
    });

    // Attach click listeners for cancelling shift bookings
    container.querySelectorAll('[data-cancel-booking-id]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-cancel-booking-id');
        const cust = e.currentTarget.getAttribute('data-customer');
        const time = e.currentTarget.getAttribute('data-time');
        openCancelModal({ id, customer_name: cust, time });
      });
    });

  } catch (err) {
    console.error('Failed to load spa slots', err);
    container.innerHTML = `<div class="col-span-full py-12 text-center text-xs text-red-500">Failed to load session slots.</div>`;
  }
}

function openBookingModal(time) {
  selectedSlotTime = time;
  selectedPaymentMethod = 'cash';

  const timeEl = document.getElementById('modal-slot-time-text');
  const dateEl = document.getElementById('modal-slot-date-text');
  const priceEl = document.getElementById('modal-service-price-text');
  const serviceSelect = document.getElementById('modal-service-select');
  const modal = document.getElementById('walkin-booking-modal');

  if (timeEl) timeEl.textContent = `${time} Session`;
  if (dateEl) dateEl.textContent = selectedDate;

  // Reset form
  const form = document.getElementById('walkin-booking-form');
  if (form) form.reset();

  // Reset payment buttons
  updateModalPaymentButtons('cash');

  // Auto-select first service if available
  if (serviceSelect && serviceSelect.options.length > 1) {
    serviceSelect.selectedIndex = 1;
    const opt = serviceSelect.options[1];
    const price = parseFloat(opt.getAttribute('data-price') || 0);
    if (priceEl) priceEl.textContent = `KSh ${price.toLocaleString()}`;
  } else if (priceEl) {
    priceEl.textContent = 'KSh 0';
  }

  modal?.classList.remove('hidden');
}

function updateModalPaymentButtons(pay) {
  selectedPaymentMethod = pay;
  document.querySelectorAll('.spa-modal-pay-btn').forEach(btn => {
    const isSelected = btn.getAttribute('data-modal-pay') === pay;
    if (isSelected) {
      btn.className = 'spa-modal-pay-btn p-2.5 rounded-xl border-2 border-[#9B72CF] bg-purple-50 text-[#9B72CF] font-bold text-xs flex flex-col items-center gap-1 transition-all shadow-sm';
    } else {
      btn.className = 'spa-modal-pay-btn p-2.5 rounded-xl border-2 border-gray-200 bg-white text-gray-700 font-bold text-xs flex flex-col items-center gap-1 transition-all';
    }
  });
}

function openCancelModal(booking) {
  bookingToCancel = booking;
  const modal = document.getElementById('cancel-modal');
  const desc = document.getElementById('cancel-modal-desc');
  const input = document.getElementById('cancel-reason-input');

  if (desc) {
    desc.textContent = `Are you sure you want to cancel the ${booking.time} booking for ${booking.customer_name}? The slot will immediately become available for other walk-ins.`;
  }
  if (input) {
    input.value = '';
  }

  modal?.classList.remove('hidden');
}

function setupEventListeners() {
  // Date Shortcut Buttons
  document.getElementById('btn-date-today')?.addEventListener('click', async () => {
    selectedDate = new Date().toISOString().split('T')[0];
    const input = document.getElementById('spa-date-input');
    if (input) input.value = selectedDate;
    updateDateLabel();
    await loadSpaSlots(selectedDate);
  });

  document.getElementById('btn-date-tomorrow')?.addEventListener('click', async () => {
    const tomorrowObj = new Date();
    tomorrowObj.setDate(tomorrowObj.getDate() + 1);
    selectedDate = tomorrowObj.toISOString().split('T')[0];
    const input = document.getElementById('spa-date-input');
    if (input) input.value = selectedDate;
    updateDateLabel();
    await loadSpaSlots(selectedDate);
  });

  document.getElementById('btn-refresh-spa')?.addEventListener('click', async () => {
    await Promise.all([
      loadSpaServices(),
      loadSpaSlots(selectedDate)
    ]);
    UI.showToast("Slots and services updated.", "Refreshed", "info");
  });

  // Service Dropdown Price Sync
  document.getElementById('modal-service-select')?.addEventListener('change', (e) => {
    const opt = e.target.selectedOptions[0];
    const price = parseFloat(opt?.getAttribute('data-price') || 0);
    const priceEl = document.getElementById('modal-service-price-text');
    if (priceEl) priceEl.textContent = `KSh ${price.toLocaleString()}`;
  });

  // Payment Method Selection in Modal
  document.querySelectorAll('.spa-modal-pay-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const pay = e.currentTarget.getAttribute('data-modal-pay');
      updateModalPaymentButtons(pay);
    });
  });

  // Close Booking Modal
  document.getElementById('close-booking-modal')?.addEventListener('click', () => {
    document.getElementById('walkin-booking-modal')?.classList.add('hidden');
  });
  document.getElementById('cancel-booking-modal')?.addEventListener('click', () => {
    document.getElementById('walkin-booking-modal')?.classList.add('hidden');
  });

  // Submit Booking Form
  const bookingForm = document.getElementById('walkin-booking-form');
  if (bookingForm) {
    bookingForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('submit-booking-btn');

      const serviceSelect = document.getElementById('modal-service-select');
      const serviceId = serviceSelect.value;
      const serviceOpt = serviceSelect.selectedOptions[0];
      const servicePrice = parseFloat(serviceOpt?.getAttribute('data-price') || 0);
      const custName = document.getElementById('modal-cust-name').value.trim();
      const custPhone = document.getElementById('modal-cust-phone').value.trim();

      if (!serviceId) {
        UI.showToast("Please choose a spa ritual.", "Selection Required", "error");
        return;
      }

      UI.setButtonLoading(submitBtn, true, 'Booking Session...');

      try {
        const res = await fetch('/api/cashier/spa-book', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            serviceId,
            date: selectedDate,
            timeSlot: selectedSlotTime,
            customerName: custName,
            customerPhone: custPhone,
            paymentMethod: selectedPaymentMethod,
            price: servicePrice
          })
        });

        const data = await res.json();

        if (data.success) {
          document.getElementById('walkin-booking-modal')?.classList.add('hidden');

          // Show success receipt modal
          const successModal = document.getElementById('success-modal');
          const orderNoEl = document.getElementById('success-order-no');
          const summaryBox = document.getElementById('success-summary-box');

          if (orderNoEl) orderNoEl.textContent = `Order #${data.order_number || data.bookingId}`;
          if (summaryBox) {
            summaryBox.innerHTML = `
              <div class="flex justify-between border-b border-gray-200 pb-1.5">
                <span class="text-gray-500">Service:</span>
                <span class="font-bold text-gray-900">${data.booking?.service_name || 'Spa Service'}</span>
              </div>
              <div class="flex justify-between border-b border-gray-200 pb-1.5">
                <span class="text-gray-500">Session Slot:</span>
                <span class="font-bold text-gray-900">${data.booking?.booking_date} • ${data.booking?.booking_time}</span>
              </div>
              <div class="flex justify-between border-b border-gray-200 pb-1.5">
                <span class="text-gray-500">Customer:</span>
                <span class="font-bold text-gray-900">${data.booking?.customer_name} (${data.booking?.customer_phone})</span>
              </div>
              <div class="flex justify-between border-b border-gray-200 pb-1.5">
                <span class="text-gray-500">Payment:</span>
                <span class="font-bold uppercase text-[#9B72CF]">${selectedPaymentMethod} (${data.payment_mode || 'simulation'})</span>
              </div>
              <div class="flex justify-between pt-1 text-sm font-bold">
                <span>Total Paid:</span>
                <span class="text-[#9B72CF]">KSh ${(data.booking?.total || servicePrice).toLocaleString()}</span>
              </div>
            `;
          }

          successModal?.classList.remove('hidden');
          UI.showToast("Walk-in booking recorded successfully!", "Booking Confirmed", "success");
          await loadSpaSlots(selectedDate);

        } else {
          UI.showToast(data.error || 'Failed to complete booking', "Booking Error", "error");
        }

      } catch (err) {
        console.error('Error booking spa session', err);
        UI.showToast('Network error while booking session', "Error", "error");
      } finally {
        UI.setButtonLoading(submitBtn, false);
      }
    });
  }

  // Close Success Modal
  document.getElementById('close-success-modal')?.addEventListener('click', () => {
    document.getElementById('success-modal')?.classList.add('hidden');
  });

  // Cancel Reason Quick Pills
  document.querySelectorAll('.cancel-reason-pill').forEach(pill => {
    pill.addEventListener('click', (e) => {
      const input = document.getElementById('cancel-reason-input');
      if (input) input.value = e.currentTarget.textContent.trim();
    });
  });

  // Close Cancel Modal
  document.getElementById('close-cancel-modal')?.addEventListener('click', () => {
    document.getElementById('cancel-modal')?.classList.add('hidden');
  });
  document.getElementById('abort-cancel-modal')?.addEventListener('click', () => {
    document.getElementById('cancel-modal')?.classList.add('hidden');
  });

  // Confirm Cancel Button
  document.getElementById('confirm-cancel-btn')?.addEventListener('click', async (e) => {
    if (!bookingToCancel) return;
    const reasonInput = document.getElementById('cancel-reason-input');
    const reason = reasonInput?.value.trim();

    if (!reason) {
      UI.showToast("Please provide a reason for cancellation.", "Reason Required", "error");
      return;
    }

    const btn = e.currentTarget;
    UI.setButtonLoading(btn, true, 'Cancelling...');

    try {
      const res = await fetch(`/api/cashier/spa-slots/${bookingToCancel.id}/cancel`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason })
      });

      const data = await res.json();

      if (data.success) {
        document.getElementById('cancel-modal')?.classList.add('hidden');
        UI.showToast(data.message || "Spa slot is now available.", "Booking Cancelled", "success");
        await loadSpaSlots(selectedDate);
      } else {
        UI.showToast(data.error || "Failed to cancel booking", "Error", "error");
      }

    } catch (err) {
      console.error('Error cancelling spa booking', err);
      UI.showToast("Network error while cancelling booking", "Error", "error");
    } finally {
      UI.setButtonLoading(btn, false);
    }
  });
}
