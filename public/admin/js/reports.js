/**
 * Crystal Crest - Executive Analytics & Reports Controller
 * Orchestrates revenue trends, product velocity, cashier leaderboard, customer stats, and spa slot utilization.
 */

import { AdminLayout } from '../../js/shared/admin-layout.js';
import { ApiService } from '../../js/shared/api.js';

let currentStartDate = '';
let currentEndDate = '';
let chartMode = 'source'; // 'source' or 'payment'
let revenueChartInstance = null;

let cachedRevenueData = null;
let cachedProductsData = null;
let cachedCustomersData = null;
let cachedCashiersData = null;
let cachedSpaData = null;
let inventoryLedger = null;

document.addEventListener('DOMContentLoaded', async () => {
  const user = await AdminLayout.init('reports', 'Executive Analytics & Performance Reports');
  if (!user) return;

  initializeDatePresets();
  setupEventListeners();
  await fetchAndRenderAllReports();
  await loadInventoryLedger();
});

function initializeDatePresets() {
  const now = new Date();
  
  // Default to This Month: 1st of current month to today
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  currentStartDate = formatDate(firstDay);
  currentEndDate = formatDate(now);

  const startInput = document.getElementById('report-start-date');
  const endInput = document.getElementById('report-end-date');
  if (startInput) startInput.value = currentStartDate;
  if (endInput) endInput.value = currentEndDate;
}

function formatDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function setupEventListeners() {
  // Preset buttons
  document.querySelectorAll('.report-preset-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.report-preset-btn').forEach(b => {
        b.className = "report-preset-btn px-3 py-1.5 rounded-lg hover:text-gray-900 transition-colors";
      });
      e.currentTarget.className = "report-preset-btn px-3 py-1.5 rounded-lg bg-white text-gray-900 shadow-sm font-bold transition-colors";

      const preset = e.currentTarget.getAttribute('data-preset');
      applyDatePreset(preset);
    });
  });

  // Apply manual date filter
  document.getElementById('apply-filter-btn')?.addEventListener('click', () => {
    const startVal = document.getElementById('report-start-date')?.value;
    const endVal = document.getElementById('report-end-date')?.value;
    if (startVal && endVal) {
      currentStartDate = startVal;
      currentEndDate = endVal;
      fetchAndRenderAllReports();
    }
  });

  // Toggle chart view (By Source vs By Payment Method)
  document.getElementById('toggle-by-source')?.addEventListener('click', () => {
    chartMode = 'source';
    document.getElementById('toggle-by-source').className = "px-3 py-1.5 rounded-lg bg-white text-gray-900 shadow-sm font-bold";
    document.getElementById('toggle-by-payment').className = "px-3 py-1.5 rounded-lg text-gray-600 hover:text-gray-900";
    if (cachedRevenueData) renderRevenueChart(cachedRevenueData);
  });

  document.getElementById('toggle-by-payment')?.addEventListener('click', () => {
    chartMode = 'payment';
    document.getElementById('toggle-by-payment').className = "px-3 py-1.5 rounded-lg bg-white text-gray-900 shadow-sm font-bold";
    document.getElementById('toggle-by-source').className = "px-3 py-1.5 rounded-lg text-gray-600 hover:text-gray-900";
    if (cachedRevenueData) renderRevenueChart(cachedRevenueData);
  });

  // CSV Export Buttons
  document.getElementById('export-revenue-csv')?.addEventListener('click', exportRevenueCsv);
  document.getElementById('export-top-products-csv')?.addEventListener('click', exportTopProductsCsv);
  document.getElementById('export-slow-products-csv')?.addEventListener('click', exportSlowProductsCsv);
  document.getElementById('export-cashiers-csv')?.addEventListener('click', exportCashiersCsv);
  document.getElementById('export-inventory-excel')?.addEventListener('click', exportInventoryExcel);
  document.getElementById('inventory-loss-form')?.addEventListener('submit', recordInventoryLoss);
  document.getElementById('close-department-transactions-modal')?.addEventListener('click', () => {
    document.getElementById('department-transactions-modal')?.classList.replace('flex', 'hidden');
  });
}

function applyDatePreset(preset) {
  const now = new Date();
  let start = new Date();
  let end = new Date();

  if (preset === 'today') {
    start = new Date();
    end = new Date();
  } else if (preset === 'this_week') {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
    start = new Date(now.setDate(diff));
    end = new Date();
  } else if (preset === 'this_month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date();
  } else if (preset === 'last_30_days') {
    start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    end = new Date();
  }

  currentStartDate = formatDate(start);
  currentEndDate = formatDate(end);

  const startInput = document.getElementById('report-start-date');
  const endInput = document.getElementById('report-end-date');
  if (startInput) startInput.value = currentStartDate;
  if (endInput) endInput.value = currentEndDate;

  fetchAndRenderAllReports();
  loadInventoryLedger();
}

async function loadInventoryLedger() {
  try {
    const response = await fetch(`/api/admin/inventory-summary?startDate=${currentStartDate}&endDate=${currentEndDate}`, { credentials: 'include' });
    inventoryLedger = await response.json();
    if (!inventoryLedger.success) throw new Error(inventoryLedger.error);
    const money = value => `KSh ${Math.round(Number(value || 0)).toLocaleString()}`;
    document.getElementById('inventory-cost-value').textContent = money(inventoryLedger.stock.cost_value);
    document.getElementById('inventory-selling-value').textContent = money(inventoryLedger.stock.selling_value);
    document.getElementById('inventory-sold-revenue').textContent = money(inventoryLedger.sales.revenue);
    document.getElementById('inventory-net-profit').textContent = money(inventoryLedger.netProfit);
    document.getElementById('loss-product-id').innerHTML = '<option value="">Select product</option>' + inventoryLedger.products.map(product => `<option value="${product.id}">${product.name} (${product.stock_quantity} in stock)</option>`).join('');
    document.getElementById('loss-date').value = new Date().toISOString().slice(0, 10);
    const rows = inventoryLedger.expenseRows || [];
    document.getElementById('expense-ledger-tbody').innerHTML = rows.length ? rows.map(item => `<tr class="border-t border-gray-100"><td class="p-3">${item.description}<span class="block text-gray-400">${item.cashier_name}</span></td><td class="p-3">${item.expense_date}</td><td class="p-3 text-right font-bold">KSh ${Number(item.amount).toLocaleString()}</td></tr>`).join('') : '<tr><td colspan="3" class="p-3 text-gray-400">No expenses recorded.</td></tr>';
  } catch (error) { console.error('Unable to load inventory ledger:', error); }
}

async function recordInventoryLoss(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const response = await fetch('/api/admin/inventory-losses', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product_id: document.getElementById('loss-product-id').value, quantity: Number(document.getElementById('loss-quantity').value), reason: document.getElementById('loss-reason').value, notes: document.getElementById('loss-notes').value, recorded_at: document.getElementById('loss-date').value }) });
  const result = await response.json();
  if (!result.success) return alert(result.error || 'Unable to record loss.');
  form.reset();
  await loadInventoryLedger();
}

function exportInventoryExcel() {
  if (!inventoryLedger || !window.XLSX) return;
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(inventoryLedger.products), 'Stock on Hand');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(inventoryLedger.lossRows), 'Inventory Losses');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(inventoryLedger.expenseRows), 'Cashier Expenses');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{ stock_cost_value: inventoryLedger.stock.cost_value, stock_selling_value: inventoryLedger.stock.selling_value, sold_revenue: inventoryLedger.sales.revenue, gross_profit: inventoryLedger.grossProfit, loss_cost: inventoryLedger.losses.cost, expenses: inventoryLedger.expenses.total, net_profit: inventoryLedger.netProfit }]), 'Financial Summary');
  XLSX.writeFile(workbook, `inventory-ledger-${currentStartDate}-to-${currentEndDate}.xlsx`);
}

async function fetchAndRenderAllReports() {
  const query = `?startDate=${currentStartDate}&endDate=${currentEndDate}`;

  try {
    const [revRes, prodRes, custRes, cashRes, spaRes] = await Promise.all([
      fetch(`/api/admin/analytics/revenue${query}`).then(r => r.json()),
      fetch(`/api/admin/analytics/products${query}`).then(r => r.json()),
      fetch(`/api/admin/analytics/customers${query}`).then(r => r.json()),
      fetch(`/api/admin/analytics/cashiers${query}`).then(r => r.json()),
      fetch(`/api/admin/analytics/spa${query}`).then(r => r.json())
    ]);

    if (revRes.success) {
      cachedRevenueData = revRes;
      renderRevenueChart(revRes);
    }

    if (custRes.success) {
      cachedCustomersData = custRes;
      renderCustomerInsights(custRes, revRes);
    }

    if (prodRes.success) {
      cachedProductsData = prodRes;
      renderTopBottomProducts(prodRes);
    }

    if (cashRes.success) {
      cachedCashiersData = cashRes;
      renderCashierLeaderboard(cashRes);
    }

    if (spaRes.success) {
      cachedSpaData = spaRes;
      renderSpaPerformance(spaRes);
    }

  } catch (error) {
    console.error('Error fetching analytics reports:', error);
  }
}

// 1. Render Customer Insights & Top Stat Cards
function renderCustomerInsights(cust, rev) {
  const totalRev = rev?.totals?.totalRevenue || cust.totalSpentInRange || 0;
  const totalOrders = rev?.totals?.totalOrders || cust.totalOrdersInRange || 0;
  const aov = totalOrders > 0 ? (totalRev / totalOrders) : cust.averageOrderValue || 0;

  const revEl = document.getElementById('stat-period-revenue');
  const ordersEl = document.getElementById('stat-orders-count');
  const aovEl = document.getElementById('stat-aov');
  const totalCustEl = document.getElementById('stat-customers-total');
  const newCustEl = document.getElementById('stat-customers-new');
  const repeatRateEl = document.getElementById('stat-repeat-rate');

  if (revEl) revEl.textContent = `KSh ${Math.round(totalRev).toLocaleString()}`;
  if (ordersEl) ordersEl.textContent = `${totalOrders} completed orders in range`;
  if (aovEl) aovEl.textContent = `KSh ${Math.round(aov).toLocaleString()}`;
  if (totalCustEl) totalCustEl.textContent = cust.totalCustomers.toLocaleString();
  if (newCustEl) newCustEl.textContent = `+${cust.newCustomers} registered in range`;
  if (repeatRateEl) repeatRateEl.textContent = `${cust.repeatCustomerRate}%`;
}

// 2. Render Revenue Trend Chart (Chart.js)
function renderRevenueChart(data) {
  const canvas = document.getElementById('revenue-chart');
  if (!canvas) return;

  const labels = (data.daily || []).map(d => {
    const parts = d.date.split('-');
    return `${parts[1]}/${parts[2]}`;
  });

  let datasets = [];

  if (chartMode === 'source') {
    datasets = [
      {
        label: 'Online Boutique',
        data: (data.daily || []).map(d => d.onlineRevenue),
        borderColor: '#E8C500',
        backgroundColor: 'rgba(232, 197, 0, 0.1)',
        tension: 0.35,
        fill: true,
        borderWidth: 2.5,
        pointRadius: 3
      },
      {
        label: 'POS Walk-in Store',
        data: (data.daily || []).map(d => d.posRevenue),
        borderColor: '#9B72CF',
        backgroundColor: 'rgba(155, 114, 207, 0.1)',
        tension: 0.35,
        fill: true,
        borderWidth: 2.5,
        pointRadius: 3
      },
      {
        label: 'Spa Appointments',
        data: (data.daily || []).map(d => d.spaRevenue),
        borderColor: '#10B981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.35,
        fill: true,
        borderWidth: 2.5,
        pointRadius: 3
      }
    ];
  } else {
    // By Payment Method
    datasets = [
      {
        label: 'M-Pesa Express',
        data: (data.daily || []).map(d => d.mpesaRevenue),
        borderColor: '#10B981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.35,
        fill: true,
        borderWidth: 2.5,
        pointRadius: 3
      },
      {
        label: 'Cash on Delivery / Register',
        data: (data.daily || []).map(d => d.cashRevenue),
        borderColor: '#F59E0B',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        tension: 0.35,
        fill: true,
        borderWidth: 2.5,
        pointRadius: 3
      },
      {
        label: 'Co-op Paybill',
        data: (data.daily || []).map(d => d.paybillRevenue || 0),
        borderColor: '#8B5CF6',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        tension: 0.35,
        fill: true,
        borderWidth: 2.5,
        pointRadius: 3
      },
      {
        label: 'Credit / Debit Card',
        data: (data.daily || []).map(d => d.cardRevenue),
        borderColor: '#6366F1',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        tension: 0.35,
        fill: true,
        borderWidth: 2.5,
        pointRadius: 3
      }
    ];
  }

  if (revenueChartInstance) {
    revenueChartInstance.destroy();
  }

  const ctx = canvas.getContext('2d');
  revenueChartInstance = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          labels: { boxWidth: 12, usePointStyle: true, font: { size: 11, family: 'sans-serif' } }
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              return ` ${context.dataset.label}: KSh ${Number(context.raw || 0).toLocaleString()}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 10 }, color: '#9CA3AF' }
        },
        y: {
          grid: { color: '#F3F4F6' },
          ticks: {
            font: { size: 10 },
            color: '#9CA3AF',
            callback: function (val) {
              return 'KSh ' + (val >= 1000 ? (val / 1000) + 'k' : val);
            }
          }
        }
      }
    }
  });

  // Render Summary Pills
  const pillsContainer = document.getElementById('revenue-breakdown-pills');
  if (pillsContainer) {
    if (chartMode === 'source') {
      const src = data.bySource || {};
      pillsContainer.innerHTML = `
        <button data-department="online" class="department-revenue-card p-3 bg-amber-50 rounded-xl border border-amber-200 text-left hover:border-amber-400 transition-colors">
          <span class="text-[10px] uppercase font-bold text-amber-800 block">Online Boutique</span>
          <span class="font-bold text-sm text-gray-900">KSh ${Math.round(src.online || 0).toLocaleString()}</span>
        </button>
        <button data-department="pos" class="department-revenue-card p-3 bg-purple-50 rounded-xl border border-purple-200 text-left hover:border-purple-400 transition-colors">
          <span class="text-[10px] uppercase font-bold text-purple-800 block">POS In-Store Register</span>
          <span class="font-bold text-sm text-gray-900">KSh ${Math.round(src.pos || 0).toLocaleString()}</span>
        </button>
        <button data-department="spa" class="department-revenue-card p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-left hover:border-emerald-400 transition-colors">
          <span class="text-[10px] uppercase font-bold text-emerald-800 block">Spa Appointments</span>
          <span class="font-bold text-sm text-gray-900">KSh ${Math.round(src.spa || 0).toLocaleString()}</span>
        </button>
        <div class="p-3 bg-gray-50 rounded-xl border border-gray-200">
          <span class="text-[10px] uppercase font-bold text-gray-700 block">Total Combined</span>
          <span class="font-bold text-sm text-gray-900">KSh ${Math.round(data.totals?.totalRevenue || 0).toLocaleString()}</span>
        </div>
      `;
      pillsContainer.querySelectorAll('[data-department]').forEach(button => {
        button.addEventListener('click', () => loadDepartmentTransactions(button.dataset.department));
      });
    } else {
      const pay = data.byPaymentMethod || {};
      pillsContainer.innerHTML = `
        <div class="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
          <span class="text-[10px] uppercase font-bold text-emerald-800 block">M-Pesa Express</span>
          <span class="font-bold text-sm text-gray-900">KSh ${Math.round(pay.mpesa || 0).toLocaleString()}</span>
        </div>
        <div class="p-3 bg-purple-50 rounded-xl border border-purple-200">
          <span class="text-[10px] uppercase font-bold text-purple-800 block">Co-op Paybill (Verified)</span>
          <span class="font-bold text-sm text-gray-900">KSh ${Math.round(pay.paybill_manual || 0).toLocaleString()}</span>
        </div>
        <div class="p-3 bg-amber-50 rounded-xl border border-amber-200">
          <span class="text-[10px] uppercase font-bold text-amber-800 block">Cash Payments</span>
          <span class="font-bold text-sm text-gray-900">KSh ${Math.round(pay.cash || 0).toLocaleString()}</span>
        </div>
        <div class="p-3 bg-indigo-50 rounded-xl border border-indigo-200">
          <span class="text-[10px] uppercase font-bold text-indigo-800 block">Card Transactions</span>
          <span class="font-bold text-sm text-gray-900">KSh ${Math.round(pay.card || 0).toLocaleString()}</span>
        </div>
      `;
    }

    async function loadDepartmentTransactions(department) {
      const modal = document.getElementById('department-transactions-modal');
      const tbody = document.getElementById('department-transactions-tbody');
      const title = document.getElementById('department-transactions-title');
      const summary = document.getElementById('department-transactions-summary');
      const label = { online: 'Online Boutique', pos: 'POS In-Store Register', spa: 'Spa Appointments' }[department];

      title.textContent = `${label} Transactions`;
      summary.textContent = 'Loading transactions...';
      tbody.innerHTML = '<tr><td colspan="6" class="p-5 text-center text-gray-400">Loading transactions...</td></tr>';
      modal.classList.replace('hidden', 'flex');

      try {
        const response = await fetch(`/api/admin/analytics/department-transactions?department=${department}&startDate=${currentStartDate}&endDate=${currentEndDate}`, { credentials: 'include' });
        const data = await response.json();
        if (!data.success) throw new Error(data.error || 'Unable to load transactions.');
        summary.textContent = `${data.transactions.length} transactions | KSh ${Number(data.totalRevenue).toLocaleString()} total`;
        tbody.innerHTML = data.transactions.length ? data.transactions.map(transaction => `
          <tr class="border-t border-gray-100">
            <td class="p-3">${transaction.transaction_date}</td>
            <td class="p-3 font-semibold">${transaction.order_number || transaction.description || transaction.id}</td>
            <td class="p-3">${transaction.customer_name}<span class="block text-gray-400">${transaction.customer_phone || transaction.customer_email || ''}</span></td>
            <td class="p-3 uppercase">${transaction.payment_method || '-'}</td>
            <td class="p-3 uppercase">${transaction.payment_status || transaction.status || '-'}</td>
            <td class="p-3 text-right font-bold">KSh ${Number(transaction.total || 0).toLocaleString()}</td>
          </tr>`).join('') : '<tr><td colspan="6" class="p-5 text-center text-gray-400">No transactions in this date range.</td></tr>';
      } catch (error) {
        summary.textContent = error.message;
        tbody.innerHTML = '<tr><td colspan="6" class="p-5 text-center text-red-500">Unable to load transactions.</td></tr>';
      }
    }
  }
}

// 3. Render Top 10 Best Sellers & Bottom 10 Slowest-Moving Products
function renderTopBottomProducts(data) {
  const topTbody = document.getElementById('top-products-tbody');
  const slowTbody = document.getElementById('slow-products-tbody');

  // Top Products Table
  if (topTbody) {
    if (!data.topSelling || data.topSelling.length === 0) {
      topTbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-400">No product sales recorded in this period.</td></tr>`;
    } else {
      topTbody.innerHTML = data.topSelling.map((p, idx) => {
        let medal = `#${idx + 1}`;
        if (idx === 0) medal = '🥇 #1';
        else if (idx === 1) medal = '🥈 #2';
        else if (idx === 2) medal = '🥉 #3';

        const stockBadge = p.current_stock <= 0
          ? `<span class="px-2 py-0.5 bg-red-100 text-red-700 rounded-md font-bold text-[10px]">Out of Stock</span>`
          : (p.current_stock <= 10
            ? `<span class="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md font-bold text-[10px]">${p.current_stock} left</span>`
            : `<span class="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md font-bold text-[10px]">${p.current_stock} in stock</span>`);

        return `
          <tr class="hover:bg-gray-50/80 transition-colors">
            <td class="p-2.5 font-bold text-xs ${idx < 3 ? 'text-[#9B72CF]' : 'text-gray-500'}">${medal}</td>
            <td class="p-2.5">
              <span class="font-bold text-gray-900 block truncate max-w-[180px]">${p.name}</span>
              <span class="text-[10px] text-gray-500">${p.category}</span>
            </td>
            <td class="p-2.5 text-center font-bold text-gray-900">${p.total_quantity_sold}</td>
            <td class="p-2.5 text-right font-bold text-emerald-700">KSh ${Math.round(p.total_revenue).toLocaleString()}</td>
            <td class="p-2.5 text-right">${stockBadge}</td>
          </tr>
        `;
      }).join('');
    }
  }

  // Slow Moving Products Table
  if (slowTbody) {
    if (!data.slowMoving || data.slowMoving.length === 0) {
      slowTbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-400">All catalog items active.</td></tr>`;
    } else {
      slowTbody.innerHTML = data.slowMoving.map(p => {
        return `
          <tr class="hover:bg-gray-50/80 transition-colors">
            <td class="p-2.5">
              <span class="font-bold text-gray-900 block truncate max-w-[180px]">${p.name}</span>
            </td>
            <td class="p-2.5 text-gray-500 text-[11px]">${p.category}</td>
            <td class="p-2.5 text-center font-bold ${p.total_quantity_sold === 0 ? 'text-gray-400' : 'text-amber-700'}">${p.total_quantity_sold}</td>
            <td class="p-2.5 text-right font-semibold text-gray-700">KSh ${Math.round(p.price).toLocaleString()}</td>
            <td class="p-2.5 text-right font-mono font-bold text-gray-800">${p.current_stock} units</td>
          </tr>
        `;
      }).join('');
    }
  }
}

// 4. Render Cashier Performance Leaderboard
function renderCashierLeaderboard(data) {
  const tbody = document.getElementById('cashiers-leaderboard-tbody');
  if (!tbody) return;

  if (!data.leaderboard || data.leaderboard.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-gray-400">No active cashier POS sales recorded.</td></tr>`;
    return;
  }

  tbody.innerHTML = data.leaderboard.map((c, idx) => {
    let rankBadge = `#${idx + 1}`;
    if (idx === 0) rankBadge = '🥇 #1 Top Performer';
    else if (idx === 1) rankBadge = '🥈 #2';
    else if (idx === 2) rankBadge = '🥉 #3';

    return `
      <tr class="hover:bg-gray-50/80 transition-colors">
        <td class="p-2.5 font-bold text-xs ${idx === 0 ? 'text-amber-600' : 'text-gray-500'}">${rankBadge}</td>
        <td class="p-2.5">
          <div class="flex items-center gap-2">
            <div class="w-6 h-6 rounded-full bg-purple-100 text-[#9B72CF] font-bold text-xs flex items-center justify-center">
              ${c.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <span class="font-bold text-gray-900 block">${c.name}</span>
              <span class="text-[10px] text-gray-400 font-mono">${c.cashier_id || 'POS User'}</span>
            </div>
          </div>
        </td>
        <td class="p-2.5 text-center font-bold text-gray-900">${c.total_sales}</td>
        <td class="p-2.5 text-center">
          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${c.verifications_count > 0 ? 'bg-purple-100 text-purple-800 font-extrabold' : 'bg-gray-100 text-gray-500'}">
            ${c.verifications_count || 0}
          </span>
        </td>
        <td class="p-2.5 text-right font-bold text-emerald-700">KSh ${Math.round(c.total_revenue).toLocaleString()}</td>
        <td class="p-2.5 text-right font-semibold text-gray-600">KSh ${Math.round(c.avg_sale_value).toLocaleString()}</td>
      </tr>
    `;
  }).join('');
}

// 5. Render Spa Performance & Slot Utilization
function renderSpaPerformance(data) {
  const util = data.utilization || {};
  const rate = util.utilizationRate || 0;

  const rateEl = document.getElementById('spa-utilization-rate');
  const barEl = document.getElementById('spa-utilization-bar');
  const bookedText = document.getElementById('spa-booked-slots-text');
  const totalText = document.getElementById('spa-total-slots-text');
  const breakdownContainer = document.getElementById('spa-service-breakdown');

  if (rateEl) rateEl.textContent = `${rate}%`;
  if (barEl) barEl.style.width = `${rate}%`;
  if (bookedText) bookedText.textContent = `${util.bookedSlotsCount || 0} slots booked`;
  if (totalText) totalText.textContent = `out of ${util.totalSlotsAvailable || 0} available (${util.totalDays || 0} days)`;

  if (breakdownContainer && data.byServiceType) {
    breakdownContainer.innerHTML = data.byServiceType.map(s => `
      <div class="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl border border-gray-100">
        <div>
          <span class="font-bold text-gray-800 block">${s.service_type}</span>
          <span class="text-[10px] text-gray-500">${s.count} appointment${s.count === 1 ? '' : 's'} booked</span>
        </div>
        <div class="text-right">
          <span class="font-bold text-[#9B72CF] block">KSh ${Math.round(s.revenue).toLocaleString()}</span>
          <span class="text-[10px] text-gray-400">Avg KSh ${Math.round(s.avg_rate).toLocaleString()}</span>
        </div>
      </div>
    `).join('');
  }
}

// ----------------------------------------------------
// CSV EXPORT GENERATOR ENGINE
// ----------------------------------------------------

function exportToCsv(filename, headers, rows) {
  const csvContent = [
    headers.join(','),
    ...rows.map(r => r.map(field => {
      const escaped = ('' + (field ?? '')).replace(/"/g, '""');
      return `"${escaped}"`;
    }).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', `${filename}_${currentStartDate}_to_${currentEndDate}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function exportRevenueCsv() {
  if (!cachedRevenueData?.daily) return;
  const headers = ['Date', 'Total Revenue (KSh)', 'Online Revenue (KSh)', 'POS Revenue (KSh)', 'Spa Revenue (KSh)', 'M-Pesa (KSh)', 'Co-op Paybill (KSh)', 'Cash (KSh)', 'Card (KSh)', 'Orders Count'];
  const rows = cachedRevenueData.daily.map(d => [
    d.date, d.totalRevenue, d.onlineRevenue, d.posRevenue, d.spaRevenue, d.mpesaRevenue, d.paybillRevenue || 0, d.cashRevenue, d.cardRevenue, d.ordersCount
  ]);
  exportToCsv('crystal_crest_revenue_trend', headers, rows);
}

function exportTopProductsCsv() {
  if (!cachedProductsData?.topSelling) return;
  const headers = ['Rank', 'Product Name', 'Category', 'Price (KSh)', 'Units Sold', 'Total Revenue (KSh)', 'Current Stock'];
  const rows = cachedProductsData.topSelling.map((p, i) => [
    i + 1, p.name, p.category, p.price, p.total_quantity_sold, p.total_revenue, p.current_stock
  ]);
  exportToCsv('crystal_crest_top_selling_products', headers, rows);
}

function exportSlowProductsCsv() {
  if (!cachedProductsData?.slowMoving) return;
  const headers = ['Product Name', 'Category', 'Unit Price (KSh)', 'Units Sold', 'Current Stock On Hand'];
  const rows = cachedProductsData.slowMoving.map(p => [
    p.name, p.category, p.price, p.total_quantity_sold, p.current_stock
  ]);
  exportToCsv('crystal_crest_slow_moving_products', headers, rows);
}

function exportCashiersCsv() {
  if (!cachedCashiersData?.leaderboard) return;
  const headers = ['Rank', 'Cashier Name', 'Cashier ID', 'Total Sales Count', 'SMS Verifications Count', 'Total Revenue (KSh)', 'Average Ticket Size (KSh)'];
  const rows = cachedCashiersData.leaderboard.map((c, i) => [
    i + 1, c.name, c.cashier_id, c.total_sales, c.verifications_count || 0, c.total_revenue, c.avg_sale_value
  ]);
  exportToCsv('crystal_crest_cashier_leaderboard', headers, rows);
}
