/**
 * Crystal Crest - Admin Dashboard Logic (js/dashboard.js - KSh Currency)
 */

import { AdminLayout } from '../../js/shared/admin-layout.js';
import { http } from '../../js/shared/api.js';

document.addEventListener('DOMContentLoaded', async () => {
  const user = await AdminLayout.init('dashboard', 'Executive Dashboard');
  if (!user) return;

  await loadDashboardStats();
});

async function loadDashboardStats() {
  try {
    const res = await http.get('/api/admin/dashboard-stats');
    const stats = res.stats || {};

    document.getElementById('stat-today-orders').textContent = stats.todayOrders || 0;
    document.getElementById('stat-total-revenue').textContent = `KSh ${(stats.totalRevenue || 0).toLocaleString()}`;
    document.getElementById('stat-low-stock').textContent = stats.lowStockCount || 0;
    document.getElementById('stat-today-spa').textContent = stats.todaySpaBookings || 0;

    const ordersRes = await http.get('/api/admin/orders');
    const recentOrders = (ordersRes.orders || []).slice(0, 5);
    renderRecentOrders(recentOrders);

    const spaRes = await http.get('/api/admin/spa-bookings');
    const upcomingSpa = (spaRes.bookings || []).slice(0, 5);
    renderUpcomingSpa(upcomingSpa);

  } catch (err) {
    console.error('Failed to load dashboard stats', err);
  }
}

function renderRecentOrders(orders) {
  const tbody = document.getElementById('recent-orders-tbody');
  if (!tbody) return;

  if (orders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-gray-400">No orders recorded yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = orders.map(o => `
    <tr class="hover:bg-gray-50 transition-colors">
      <td class="p-2.5 font-bold text-gray-900">#${o.order_number || o.id}</td>
      <td class="p-2.5">${o.full_name}</td>
      <td class="p-2.5 font-bold text-[#9B72CF]">KSh ${(Number(o.total) || 0).toLocaleString()}</td>
      <td class="p-2.5">
        <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${o.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
          ${o.status || 'processing'}
        </span>
      </td>
    </tr>
  `).join('');
}

function renderUpcomingSpa(bookings) {
  const tbody = document.getElementById('upcoming-spa-tbody');
  if (!tbody) return;

  if (bookings.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-gray-400">No upcoming spa appointments today.</td></tr>`;
    return;
  }

  tbody.innerHTML = bookings.map(b => `
    <tr class="hover:bg-gray-50 transition-colors">
      <td class="p-2.5 font-bold text-gray-900">${b.booking_date} • ${b.booking_time}</td>
      <td class="p-2.5">${b.customer_name}</td>
      <td class="p-2.5 truncate max-w-[150px]">${b.service_name}</td>
      <td class="p-2.5">
        <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${b.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}">
          ${b.status || 'confirmed'}
        </span>
      </td>
    </tr>
  `).join('');
}
