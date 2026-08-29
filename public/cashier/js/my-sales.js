/**
 * Crystal Crest - Cashier Shift Sales Report (public/cashier/js/my-sales.js)
 */

import { CashierGuard } from '../../js/shared/cashier-guard.js';
import { UI } from '../../js/shared/ui.js';

let activeCashier = null;

async function initMySales() {
  activeCashier = await CashierGuard.init('my-sales');
  if (!activeCashier) return;

  await loadMySales();

  document.getElementById('refresh-sales-btn')?.addEventListener('click', loadMySales);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMySales);
} else {
  initMySales();
}

async function loadMySales() {
  const tbody = document.getElementById('my-sales-tbody');
  const countEl = document.getElementById('shift-sales-count');
  const revEl = document.getElementById('shift-revenue-total');

  if (!tbody) return;
  UI.renderSkeletonTable(tbody, 4, 6);

  try {
    const res = await fetch('/api/cashier/my-sales', { credentials: 'include' });
    const data = await res.json();
    const sales = data.sales || [];

    const totalRev = sales.reduce((sum, s) => sum + (Number(s.total) || 0), 0);

    if (countEl) countEl.textContent = sales.length;
    if (revEl) revEl.textContent = `KSh ${totalRev.toLocaleString()}`;

    if (sales.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="p-8 text-center text-gray-400">
            <div class="space-y-2">
              <span class="text-3xl block">🧾</span>
              <h4 class="font-bold text-gray-700 text-sm">No Sales Recorded Today</h4>
              <p class="text-xs text-gray-500">Sales completed during your POS shift will display here.</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = sales.map(sale => {
      const saleTime = new Date(sale.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const totalAmount = Number(sale.total) || 0;
      const itemsList = sale.items || [];

      const isSpaOrder = (sale.pickup_location && sale.pickup_location.includes('Spa')) || (sale.order_number && sale.order_number.includes('SPA'));

      return `
        <tr class="hover:bg-gray-50 transition-colors border-b border-gray-100">
          <td class="p-3.5 text-gray-500 font-mono text-[11px]">${saleTime}</td>
          <td class="p-3.5 font-bold text-gray-900">
            <div>#${sale.order_number || sale.id}</div>
            ${isSpaOrder ? `
              <span class="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-100 text-purple-800 border border-purple-200 uppercase">Spa Walk-in</span>
            ` : `
              <span class="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-gray-100 text-gray-600 border border-gray-200 uppercase">POS Sale</span>
            `}
          </td>
          <td class="p-3.5 font-semibold text-gray-800">
            <div>${sale.full_name}</div>
            <div class="text-[10px] text-gray-400 font-normal">${sale.phone}</div>
          </td>
          <td class="p-3.5">
            <div class="space-y-0.5">
              ${itemsList.map(i => `
                <div class="text-[11px] text-gray-700 font-medium">
                  <span class="font-bold text-gray-900">${i.quantity}x</span> ${i.name || i.product_id}
                </div>
              `).join('')}
            </div>
          </td>
          <td class="p-3.5 uppercase font-bold text-[10px] text-[#9B72CF]">
            <span class="px-2 py-0.5 bg-purple-50 border border-purple-100 rounded">
              ${sale.payment_method || 'cash'}
            </span>
          </td>
          <td class="p-3.5 text-right font-bold text-gray-900 text-sm">KSh ${totalAmount.toLocaleString()}</td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.error('Failed to load my sales', err);
    tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-red-500 text-xs font-semibold">Error loading shift sales report.</td></tr>`;
  }
}
