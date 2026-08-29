/**
 * Crystal Crest - Admin Customers Directory (js/customers.js - KSh Currency)
 */

import { AdminLayout } from '../../js/shared/admin-layout.js';
import { http } from '../../js/shared/api.js';

let customersList = [];

document.addEventListener('DOMContentLoaded', async () => {
  const user = await AdminLayout.init('customers', 'Registered Customer Accounts');
  if (!user) return;

  await loadCustomers();
  setupEventListeners();
});

async function loadCustomers() {
  try {
    const res = await http.get('/api/admin/customers');
    customersList = res.customers || [];
    renderTable(customersList);
  } catch (e) {
    console.error('Failed to load customers', e);
  }
}

function renderTable(list) {
  const tbody = document.getElementById('admin-customers-tbody');
  const countBadge = document.getElementById('customer-count-badge');

  if (countBadge) countBadge.textContent = `${list.length} Registered Account${list.length === 1 ? '' : 's'}`;
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-gray-400">No customer accounts registered yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(c => `
    <tr class="hover:bg-gray-50 transition-colors">
      <td class="p-3.5 font-bold text-gray-900">${c.full_name}</td>
      <td class="p-3.5 text-gray-600">${c.email}</td>
      <td class="p-3.5 text-gray-500">${c.phone || '—'}</td>
      <td class="p-3.5">
        <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${c.role === 'admin' ? 'bg-purple-100 text-[#9B72CF]' : 'bg-gray-100 text-gray-600'}">
          ${c.role || 'customer'}
        </span>
      </td>
      <td class="p-3.5 text-gray-400 text-[11px]">${new Date(c.created_at || Date.now()).toLocaleDateString()}</td>
      <td class="p-3.5 font-bold text-gray-800">${c.total_orders || 0}</td>
      <td class="p-3.5 text-right font-bold text-emerald-700">KSh ${(Number(c.total_spent) || 0).toLocaleString()}</td>
    </tr>
  `).join('');
}

function setupEventListeners() {
  const searchInput = document.getElementById('admin-customer-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      const filtered = customersList.filter(c => 
        c.full_name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.phone || '').includes(q)
      );
      renderTable(filtered);
    });
  }
}
