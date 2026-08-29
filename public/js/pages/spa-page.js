/**
 * Crystal Crest - Dedicated Customer Spa & Wellness Rituals Logic (spa-page.js)
 * Fetches spa services from /api/spa/services, displays filterable service cards,
 * manages live session slot availability, and reserves appointment slots.
 */

import { UI } from '../shared/ui.js';
import { ApiService } from '../shared/api.js';
import { CartStore } from '../shared/cart.js';

let spaServices = [];
let activeFilter = 'all';
let selectedSpaDate = new Date().toISOString().split('T')[0];
let selectedSlotsByService = {}; // Maps serviceId -> selectedSlotTime

async function initSpaPage() {
  UI.initHeader('spa');
  UI.initFooter();

  const globalDateInput = document.getElementById('global-spa-date');
  if (globalDateInput) {
    globalDateInput.value = selectedSpaDate;
    globalDateInput.min = new Date().toISOString().split('T')[0];

    globalDateInput.addEventListener('change', async (e) => {
      selectedSpaDate = e.target.value;
      await renderSpaServicesGrid();
    });
  }

  setupFilterButtons();
  await loadSpaServices();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSpaPage);
} else {
  initSpaPage();
}

async function loadSpaServices() {
  const container = document.getElementById('spa-services-grid');
  if (!container) return;

  UI.renderSkeletonGrid(container, 6);

  try {
    const res = await fetch('/api/spa/services');
    const data = await res.json();
    spaServices = data.services || [];
    await renderSpaServicesGrid();
  } catch (err) {
    console.error('Failed to load spa services', err);
    UI.renderEmptyState(container, {
      icon: '💆‍♀️',
      title: 'Unable to Load Spa Services',
      message: 'Please check your connection and refresh the page.'
    });
  }
}

function setupFilterButtons() {
  const filterBtns = document.querySelectorAll('.spa-filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      activeFilter = e.currentTarget.getAttribute('data-filter');

      filterBtns.forEach(b => {
        b.className = "spa-filter-btn px-4 py-2 rounded-full bg-white text-charcoal/80 border border-blush hover:border-deep-purple transition-all font-semibold text-[11px] sm:text-xs";
      });
      e.currentTarget.className = "spa-filter-btn px-4 py-2 rounded-full bg-deep-purple text-white shadow-md transition-all font-semibold text-[11px] sm:text-xs";

      await renderSpaServicesGrid();
    });
  });
}

async function renderSpaServicesGrid() {
  const container = document.getElementById('spa-services-grid');
  if (!container) return;

  const filtered = spaServices.filter(s => {
    if (activeFilter === 'all') return true;
    const nameStr = s.name.toLowerCase();
    const descStr = (s.description || '').toLowerCase();
    const typeStr = (s.spa_type || '').toLowerCase();

    if (activeFilter === 'nails') return nameStr.includes('nail') || nameStr.includes('manicure') || nameStr.includes('pedicure') || typeStr.includes('nail');
    if (activeFilter === 'massage') return nameStr.includes('massage') || descStr.includes('massage') || typeStr.includes('massage');
    if (activeFilter === 'facial') return nameStr.includes('facial') || descStr.includes('skin') || typeStr.includes('facial');
    if (activeFilter === 'makeup') return nameStr.includes('hair') || nameStr.includes('makeup') || typeStr.includes('makeup');
    return true;
  });

  if (filtered.length === 0) {
    UI.renderEmptyState(container, {
      icon: '💆‍♀️',
      title: 'No Spa Services Found',
      message: 'No rituals match the selected filter. Try choosing "All Rituals".'
    });
    return;
  }

  // Fetch slot availability for selected Date
  let slotsData = [];
  try {
    const slotsRes = await ApiService.getSpaSlots(selectedSpaDate);
    slotsData = slotsRes || [];
  } catch (e) {
    slotsData = [];
  }

  container.innerHTML = filtered.map(service => {
    const priceNum = typeof service.price === 'number' ? service.price : (parseFloat(service.price) || 0);
    const imgUrl = service.image || (service.images && service.images[0]) || 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80';
    const durationTag = (service.durations && service.durations[0]) || (service.sizes && service.sizes[0]) || '60 Min Session';

    const selectedTime = selectedSlotsByService[service.id] || null;

    return `
      <div class="glass-card rounded-3xl overflow-hidden flex flex-col justify-between border border-blush shadow-lg hover:shadow-xl transition-all">
        <div>
          <!-- Service Banner Image -->
          <div class="relative aspect-[4/3] overflow-hidden bg-blush/40">
            <img src="${imgUrl}" alt="${service.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
            <span class="absolute top-3 right-3 px-3 py-1 bg-charcoal/80 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider rounded-full border border-white/20">
              ⏱️ ${durationTag}
            </span>
          </div>

          <!-- Content Body -->
          <div class="p-6 space-y-3">
            <span class="text-[10px] font-bold uppercase tracking-widest text-deep-purple block">Spa & Wellness Ritual</span>
            <h3 class="font-serif-heading text-xl font-bold text-charcoal leading-snug">${service.name}</h3>
            <p class="text-xs text-charcoal/70 line-clamp-2 leading-relaxed">${service.description || 'Opulent spa treatment tailored for sensory relaxation.'}</p>
            
            <div class="pt-2 flex items-center justify-between border-t border-blush/60">
              <span class="text-xs text-gray-500 font-medium">Session Rate:</span>
              <span class="font-serif-heading text-xl font-bold text-deep-purple">KSh ${priceNum.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <!-- Interactive Slot Selection Widget -->
        <div class="p-6 pt-0 space-y-4">
          <div class="bg-blush/20 rounded-2xl p-3 border border-blush/60 space-y-2">
            <span class="text-[11px] font-bold text-charcoal block">Select Appointment Slot for ${selectedSpaDate}:</span>
            <div class="grid grid-cols-3 gap-1.5">
              ${slotsData.map(slot => {
                const isBooked = slot.isBooked || slot.status === 'booked';
                const isSelected = selectedTime === slot.time;
                if (isBooked) {
                  return `
                    <div class="p-1.5 rounded-xl border border-red-200 bg-red-50 text-red-700 text-[10px] text-center opacity-70 cursor-not-allowed">
                      <span class="font-bold block">${slot.time}</span>
                      <span class="text-[8px] uppercase tracking-wider text-red-500 font-bold">Booked</span>
                    </div>
                  `;
                } else {
                  return `
                    <button data-slot-service="${service.id}" data-slot-time="${slot.time}" class="slot-select-btn p-1.5 rounded-xl border text-[10px] text-center font-bold transition-all ${isSelected ? 'border-deep-purple bg-deep-purple text-white shadow-sm' : 'border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'}">
                      <span>${slot.time}</span>
                    </button>
                  `;
                }
              }).join('')}
            </div>
          </div>

          <!-- Reserve Button -->
          <button data-reserve-service="${service.id}" class="w-full py-3.5 bg-charcoal hover:bg-deep-purple active:scale-[0.98] text-white font-bold text-xs uppercase tracking-widest rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2">
            <span>Reserve Spa Session</span>
          </button>
        </div>

      </div>
    `;
  }).join('');

  // Attach Slot Selection click handlers
  container.querySelectorAll('[data-slot-service]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const sId = e.currentTarget.getAttribute('data-slot-service');
      const time = e.currentTarget.getAttribute('data-slot-time');
      selectedSlotsByService[sId] = time;

      // Update button styles in card
      const card = e.currentTarget.closest('.glass-card');
      if (card) {
        card.querySelectorAll('[data-slot-service]').forEach(b => {
          b.className = "slot-select-btn p-1.5 rounded-xl border text-[10px] text-center font-bold transition-all border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100";
        });
        e.currentTarget.className = "slot-select-btn p-1.5 rounded-xl border text-[10px] text-center font-bold transition-all border-deep-purple bg-deep-purple text-white shadow-sm";
      }
    });
  });

  // Attach Reserve Appointment handlers
  container.querySelectorAll('[data-reserve-service]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const sId = e.currentTarget.getAttribute('data-reserve-service');
      const service = spaServices.find(s => s.id === sId);
      if (!service) return;

      const chosenTime = selectedSlotsByService[sId];
      if (!chosenTime) {
        UI.showToast("Please select an available time slot before reserving your spa session.", "Select Time Slot", "error");
        return;
      }

      UI.setButtonLoading(e.currentTarget, true, 'Reserving...');

      try {
        const user = CartStore.getUser();
        await ApiService.bookSpaSession({
          service_id: service.id,
          service_name: service.name,
          customer_name: user ? user.full_name : 'Guest Client',
          customer_email: user ? user.email : 'client@crystalcrest.com',
          booking_date: selectedSpaDate,
          booking_time: chosenTime
        });

        const bookedLabel = `Session: ${selectedSpaDate} @ ${chosenTime}`;
        await CartStore.addItem(service, 1, bookedLabel, null);

        UI.showToast(`Spa session reserved for ${selectedSpaDate} at ${chosenTime}!`, "Session Booked", "success");
        UI.openCartDrawer();

        await renderSpaServicesGrid();

      } catch (err) {
        UI.showToast(err.message || 'Failed to book slot. Please try another time.', "Booking Error", "error");
      } finally {
        UI.setButtonLoading(e.currentTarget, false);
      }
    });
  });
}
