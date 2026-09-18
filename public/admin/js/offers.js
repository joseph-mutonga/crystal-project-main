/**
 * Crystal Crest - Admin Offers & Discounts Page (js/offers.js)
 * Lists every product with a configured discount, live countdowns, quick edit/remove actions.
 */

import { AdminLayout } from '../../js/shared/admin-layout.js';
import { http, ApiService } from '../../js/shared/api.js';
import { UI } from '../../js/shared/ui.js';

let offersList = [];

async function initOffersPage() {
  const user = await AdminLayout.init('offers', 'Offers & Discounts');
  if (!user) return;

  UI.startCountdownTicker();
  document.addEventListener('countdown-expired', () => renderOffersTable(filterOffers()), { passive: true });

  await loadOffers();
  setupEventListeners();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initOffersPage);
} else {
  initOffersPage();
}

async function loadOffers() {
  const tbody = document.getElementById('offers-tbody');
  if (tbody) UI.renderSkeletonTable(tbody, 5, 7);

  try {
    const res = await http.get('/api/admin/products');
    const products = res.products || [];
    offersList = products.filter(p => Number(p.discount_percentage) > 0 && p.discount_expires_at);
    updateStats();
    renderOffersTable(offersList);
  } catch (e) {
    console.error('Failed to load offers', e);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-red-500 font-semibold text-xs">Failed to load offers.</td></tr>`;
    }
  }
}

function isActive(p) {
  return new Date(p.discount_expires_at).getTime() > Date.now();
}

function updateStats() {
  const activeCount = offersList.filter(isActive).length;
  document.getElementById('stat-active-count').textContent = activeCount;
  document.getElementById('stat-expired-count').textContent = offersList.length - activeCount;
  document.getElementById('stat-total-count').textContent = offersList.length;
}

function filterOffers() {
  const search = (document.getElementById('offers-search')?.value || '').toLowerCase();
  if (!search) return offersList;
  return offersList.filter(p => p.name.toLowerCase().includes(search));
}

function renderOffersTable(products) {
  const tbody = document.getElementById('offers-tbody');
  if (!tbody) return;

  if (products.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="p-8 text-center text-gray-400">
          <div class="space-y-2">
            <span class="text-3xl block">🔥</span>
            <h4 class="font-bold text-gray-700 text-sm">No Discounted Products</h4>
            <p class="text-xs text-gray-500">Add a discount to a product from the Products & Inventory page.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = products.map(p => {
    const img = (p.images && p.images[0]) || p.image || 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80';
    const originalPrice = Number(p.price) || 0;
    const active = isActive(p);
    const offerPrice = active ? Number(p.discount_price ?? originalPrice) : originalPrice;

    return `
      <tr class="hover:bg-gray-50 transition-colors border-b border-gray-100">
        <td class="p-3.5">
          <img src="${img}" alt="${p.name}" class="w-10 h-10 object-cover rounded-lg bg-gray-100 border border-gray-200">
        </td>
        <td class="p-3.5">
          <span class="font-bold text-gray-900 block">${p.name}</span>
          <span class="text-[10px] text-gray-400">${p.category || 'Unassigned'}</span>
        </td>
        <td class="p-3.5 text-gray-500 line-through">KSh ${originalPrice.toLocaleString()}</td>
        <td class="p-3.5 font-bold ${active ? 'text-red-600' : 'text-gray-400'}">KSh ${offerPrice.toLocaleString()}</td>
        <td class="p-3.5">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${active ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-400'}">
            -${Number(p.discount_percentage)}%
          </span>
        </td>
        <td class="p-3.5">
          ${active
            ? `<span class="font-semibold text-red-600" data-countdown-expires="${p.discount_expires_at}">Ends in ${UI.formatCountdown(p.discount_expires_at) || ''}</span>`
            : `<span class="text-gray-400 font-semibold">Expired ${new Date(p.discount_expires_at).toLocaleString()}</span>`}
        </td>
        <td class="p-3.5 text-right space-x-2">
          <button data-edit-offer="${p.id}" class="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold text-[11px] rounded-lg transition-colors">
            Edit
          </button>
          <button data-remove-offer="${p.id}" class="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 font-semibold text-[11px] rounded-lg transition-colors">
            Remove
          </button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('[data-edit-offer]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-edit-offer');
      const prod = offersList.find(p => p.id === id);
      if (prod) openOfferModal(prod);
    });
  });

  tbody.querySelectorAll('[data-remove-offer]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.getAttribute('data-remove-offer');
      const prod = offersList.find(p => p.id === id);

      const confirmed = await UI.showConfirm({
        title: 'Remove Offer',
        message: `Stop the "${prod ? prod.name : 'this item'}" offer and revert it to the normal selling price?`,
        confirmText: 'Remove Offer',
        danger: true
      });

      if (!confirmed) return;

      UI.setButtonLoading(e.currentTarget, true, 'Removing...');
      try {
        await http.patch(`/api/admin/products/${id}/discount`, { discount_percentage: 0, discount_expires_at: '' });
        UI.showToast(`Offer removed from "${prod ? prod.name : ''}".`, "Offer Removed", "success");
        await loadOffers();
      } catch (err) {
        UI.showToast(err.message || 'Failed to remove offer', "Error", "error");
      } finally {
        UI.setButtonLoading(e.currentTarget, false);
      }
    });
  });
}

function setupEventListeners() {
  const searchInput = document.getElementById('offers-search');
  if (searchInput) searchInput.addEventListener('input', () => renderOffersTable(filterOffers()));

  document.getElementById('close-offer-modal')?.addEventListener('click', closeOfferModal);
  document.getElementById('cancel-offer-modal')?.addEventListener('click', closeOfferModal);

  const form = document.getElementById('offer-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleOfferSubmit();
    });
  }
}

function toDatetimeLocalValue(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function openOfferModal(product) {
  document.getElementById('offer-product-id').value = product.id;
  document.getElementById('offer-discount-percentage').value = product.discount_percentage;
  document.getElementById('offer-discount-expires').value = toDatetimeLocalValue(product.discount_expires_at);
  document.getElementById('offer-modal-title').textContent = `Edit Offer - ${product.name}`;
  document.getElementById('offer-modal-backdrop').classList.remove('hidden');
}

function closeOfferModal() {
  document.getElementById('offer-modal-backdrop')?.classList.add('hidden');
}

async function handleOfferSubmit() {
  const id = document.getElementById('offer-product-id').value;
  const discount_percentage = document.getElementById('offer-discount-percentage').value;
  const discount_expires_at = document.getElementById('offer-discount-expires').value;
  const submitBtn = document.querySelector('#offer-form button[type="submit"]');

  UI.setButtonLoading(submitBtn, true, 'Saving...');
  try {
    await http.patch(`/api/admin/products/${id}/discount`, { discount_percentage, discount_expires_at });
    UI.showToast('Offer updated successfully.', "Offer Saved", "success");
    closeOfferModal();
    await loadOffers();
  } catch (err) {
    UI.showToast(err.message || 'Failed to save offer', "Save Error", "error");
  } finally {
    UI.setButtonLoading(submitBtn, false);
  }
}
