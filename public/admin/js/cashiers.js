/**
 * Crystal Crest - Admin Cashier Accounts & POS Performance Logic (public/admin/js/cashiers.js)
 */

import { AdminLayout } from '../../js/shared/admin-layout.js';
import { http } from '../../js/shared/api.js';
import { UI } from '../../js/shared/ui.js';

let cashiersList = [];
let currentPerfCashierId = null;

async function initCashiersPage() {
  const user = await AdminLayout.init('cashiers', 'Cashier Accounts & POS Performance');
  if (!user) return;

  await loadCashiers();
  setupEventListeners();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCashiersPage);
} else {
  initCashiersPage();
}

async function loadCashiers() {
  const tbody = document.getElementById('admin-cashiers-tbody');
  if (tbody) {
    UI.renderSkeletonTable(tbody, 4, 5);
  }

  try {
    const res = await http.get('/api/admin/cashiers');
    cashiersList = res.cashiers || [];
    renderTable(cashiersList);
  } catch (err) {
    console.error('Failed to load cashiers', err);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-red-500 font-semibold text-xs">Failed to load cashiers.</td></tr>`;
    }
  }
}

function renderTable(list) {
  const tbody = document.getElementById('admin-cashiers-tbody');
  const countBadge = document.getElementById('cashier-count-badge');

  if (countBadge) countBadge.textContent = `${list.length} Cashier Account${list.length === 1 ? '' : 's'}`;
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="p-8 text-center text-gray-400">
          <div class="space-y-2">
            <span class="text-3xl block">👤</span>
            <h4 class="font-bold text-gray-700 text-sm">No Cashier Accounts Registered</h4>
            <p class="text-xs text-gray-500">Create cashier accounts to grant access to POS terminals.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list.map(c => {
    const createdStr = new Date(c.created_at || Date.now()).toLocaleDateString();
    const deactivatedStr = c.deactivated_at ? new Date(c.deactivated_at).toLocaleDateString() : '—';
    const isActive = c.is_active !== false && c.is_active !== 0 && c.is_active !== '0';

    return `
      <tr class="hover:bg-gray-50 transition-colors border-b border-gray-100">
        <td class="p-3.5 font-bold text-gray-900">${c.name}</td>
        <td class="p-3.5">
          <span class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${isActive ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-red-100 text-red-800 border border-red-200'}">
            ${isActive ? 'Active' : 'Inactive / Deactivated'}
          </span>
        </td>
        <td class="p-3.5 text-gray-500 text-[11px]">${createdStr}</td>
        <td class="p-3.5 text-gray-500 text-[11px]">${deactivatedStr}</td>
        <td class="p-3.5 text-right space-x-2">
          <button data-perf-id="${c.id}" data-perf-name="${c.name}" class="px-3 py-1.5 bg-[#9B72CF] text-white hover:bg-purple-700 font-bold text-[11px] rounded-lg transition-colors shadow-sm">
            View Performance
          </button>
          <button data-regen-id="${c.id}" data-regen-name="${c.name}" class="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold text-[11px] rounded-lg transition-colors border border-amber-200">
            Regenerate PIN
          </button>
          ${isActive ? `
            <button data-deactivate-id="${c.id}" data-deactivate-name="${c.name}" class="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 font-semibold text-[11px] rounded-lg transition-colors border border-red-200">
              Deactivate
            </button>
          ` : `
            <button data-reactivate-id="${c.id}" data-reactivate-name="${c.name}" class="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-[11px] rounded-lg transition-colors border border-emerald-200">
              Reactivate
            </button>
          `}
        </td>
      </tr>
    `;
  }).join('');

  // Attach button event listeners
  tbody.querySelectorAll('[data-perf-id]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-perf-id');
      const name = e.currentTarget.getAttribute('data-perf-name');
      openPerformanceModal(id, name);
    });
  });

  tbody.querySelectorAll('[data-regen-id]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.getAttribute('data-regen-id');
      const name = e.currentTarget.getAttribute('data-regen-name');

      const confirmed = await UI.showConfirm({
        title: 'Regenerate Cashier PIN',
        message: `Regenerate PIN for cashier "${name}"? The existing PIN will be overwritten.`,
        confirmText: 'Regenerate PIN',
        danger: true
      });

      if (confirmed) {
        UI.setButtonLoading(e.currentTarget, true, 'Regenerating...');
        try {
          const res = await http.post(`/api/admin/cashiers/${id}/regenerate-pin`);
          if (res.success && res.pin) {
            UI.showToast(`PIN regenerated for ${name}`, "PIN Updated", "success");
            showOneTimePinReveal(name, res.pin);
            await loadCashiers();
          }
        } catch (err) {
          UI.showToast(err.message || 'Failed to regenerate PIN', "Error", "error");
        } finally {
          UI.setButtonLoading(e.currentTarget, false);
        }
      }
    });
  });

  tbody.querySelectorAll('[data-deactivate-id]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.getAttribute('data-deactivate-id');
      const name = e.currentTarget.getAttribute('data-deactivate-name');

      const confirmed = await UI.showConfirm({
        title: 'Deactivate Cashier',
        message: `Deactivate account for "${name}"? Their POS login PIN will stop working immediately.`,
        confirmText: 'Deactivate Account',
        danger: true
      });

      if (confirmed) {
        UI.setButtonLoading(e.currentTarget, true, 'Deactivating...');
        try {
          await http.put(`/api/admin/cashiers/${id}/deactivate`);
          UI.showToast(`Cashier ${name} deactivated`, "Deactivated", "success");
          await loadCashiers();
        } catch (err) {
          UI.showToast(err.message || 'Failed to deactivate cashier', "Error", "error");
        } finally {
          UI.setButtonLoading(e.currentTarget, false);
        }
      }
    });
  });

  tbody.querySelectorAll('[data-reactivate-id]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.getAttribute('data-reactivate-id');
      const name = e.currentTarget.getAttribute('data-reactivate-name');

      UI.setButtonLoading(e.currentTarget, true, 'Reactivating...');
      try {
        await http.put(`/api/admin/cashiers/${id}/reactivate`);
        UI.showToast(`Cashier ${name} reactivated`, "Reactivated", "success");
        await loadCashiers();
      } catch (err) {
        UI.showToast(err.message || 'Failed to reactivate cashier', "Error", "error");
      } finally {
        UI.setButtonLoading(e.currentTarget, false);
      }
    });
  });
}

function showInlineError(inputEl, msg) {
  if (!inputEl) return;
  inputEl.classList.add('border-red-500', 'bg-red-50/20');
  let parent = inputEl.parentElement;
  let errEl = parent.querySelector('.inline-error-text');
  if (!errEl) {
    errEl = document.createElement('p');
    errEl.className = 'inline-error-text text-[11px] text-red-500 font-semibold mt-1';
    parent.appendChild(errEl);
  }
  errEl.textContent = msg;
}

function clearInlineErrors() {
  document.querySelectorAll('.inline-error-text').forEach(e => e.remove());
  document.querySelectorAll('.border-red-500').forEach(e => e.classList.remove('border-red-500', 'bg-red-50/20'));
}

function setupEventListeners() {
  const searchInput = document.getElementById('admin-cashier-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      const filtered = cashiersList.filter(c => c.name.toLowerCase().includes(q));
      renderTable(filtered);
    });
  }

  document.getElementById('open-add-cashier-btn')?.addEventListener('click', () => {
    clearInlineErrors();
    document.getElementById('cashier-name-input').value = '';
    document.getElementById('add-cashier-modal')?.classList.remove('hidden');
  });

  document.getElementById('close-add-cashier-modal')?.addEventListener('click', () => {
    document.getElementById('add-cashier-modal')?.classList.add('hidden');
  });

  document.getElementById('cancel-add-cashier')?.addEventListener('click', () => {
    document.getElementById('add-cashier-modal')?.classList.add('hidden');
  });

  const form = document.getElementById('add-cashier-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearInlineErrors();

      const nameEl = document.getElementById('cashier-name-input');
      const submitBtn = form.querySelector('button[type="submit"]');
      const name = nameEl.value.trim();

      if (!name) {
        showInlineError(nameEl, 'Cashier full name is required.');
        return;
      }

      UI.setButtonLoading(submitBtn, true, 'Creating Account...');

      try {
        const res = await http.post('/api/admin/cashiers', { name });
        if (res.success && res.pin) {
          UI.showToast(`Cashier "${name}" created successfully!`, "Account Created", "success");
          document.getElementById('add-cashier-modal')?.classList.add('hidden');
          showOneTimePinReveal(name, res.pin);
          await loadCashiers();
        }
      } catch (err) {
        UI.showToast(err.message || 'Error creating cashier account', "Creation Error", "error");
      } finally {
        UI.setButtonLoading(submitBtn, false);
      }
    });
  }

  document.getElementById('close-pin-reveal-modal')?.addEventListener('click', () => {
    document.getElementById('pin-reveal-modal')?.classList.add('hidden');
  });

  document.getElementById('copy-pin-btn')?.addEventListener('click', () => {
    const pin = document.getElementById('reveal-pin-number')?.textContent || '';
    if (navigator.clipboard) {
      navigator.clipboard.writeText(pin);
      UI.showToast('PIN copied to clipboard!', "Copied", "success");
    }
  });

  document.getElementById('close-perf-modal')?.addEventListener('click', () => {
    document.getElementById('performance-modal')?.classList.add('hidden');
  });

  document.getElementById('apply-perf-filter-btn')?.addEventListener('click', () => {
    if (currentPerfCashierId) {
      const name = document.getElementById('perf-cashier-title')?.textContent.replace("'s Performance Metrics", "") || "Cashier";
      loadPerformanceData(currentPerfCashierId, name);
    }
  });
}

function showOneTimePinReveal(cashierName, plaintextPin) {
  document.getElementById('reveal-cashier-name').textContent = cashierName;
  document.getElementById('reveal-pin-number').textContent = plaintextPin;
  document.getElementById('pin-reveal-modal')?.classList.remove('hidden');
}

async function openPerformanceModal(cashierId, cashierName) {
  currentPerfCashierId = cashierId;
  document.getElementById('perf-cashier-title').textContent = `${cashierName}'s Performance Metrics`;
  document.getElementById('performance-modal')?.classList.remove('hidden');

  await loadPerformanceData(cashierId, cashierName);
}

async function loadPerformanceData(cashierId, cashierName) {
  const startDate = document.getElementById('perf-start-date')?.value || '';
  const endDate = document.getElementById('perf-end-date')?.value || '';
  const tbody = document.getElementById('perf-daily-tbody');

  if (tbody) {
    UI.renderSkeletonTable(tbody, 3, 3);
  }

  try {
    let url = `/api/admin/cashiers/${cashierId}/performance`;
    const params = [];
    if (startDate) params.push(`startDate=${startDate}`);
    if (endDate) params.push(`endDate=${endDate}`);
    if (params.length > 0) url += `?${params.join('&')}`;

    const res = await http.get(url);
    const perf = res.performance || {};

    const totalSales = perf.total_sales || 0;
    const totalRev = perf.total_revenue || 0;
    const avgVal = perf.avg_sale_value || 0;
    const dailySales = perf.daily_sales || [];

    document.getElementById('perf-total-count').textContent = totalSales;
    document.getElementById('perf-total-revenue').textContent = `KSh ${totalRev.toLocaleString()}`;
    document.getElementById('perf-avg-sale').textContent = `KSh ${Math.round(avgVal).toLocaleString()}`;

    if (dailySales.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-gray-400">No shift sales recorded in range.</td></tr>`;
      return;
    }

    tbody.innerHTML = dailySales.map(d => `
      <tr class="hover:bg-gray-50 transition-colors">
        <td class="p-3 font-bold text-gray-900">${d.date}</td>
        <td class="p-3 font-semibold text-gray-800">${d.count} transaction${d.count === 1 ? '' : 's'}</td>
        <td class="p-3 text-right font-bold text-[#9B72CF]">KSh ${Number(d.revenue || 0).toLocaleString()}</td>
      </tr>
    `).join('');

  } catch (err) {
    console.error('Failed to load performance metrics', err);
    if (tbody) tbody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-red-500">Failed to load performance data.</td></tr>`;
  }
}
