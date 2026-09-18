/**
 * Crystal Crest - Admin Orders Fulfillment Logic (js/orders.js - KSh Currency)
 */

import { AdminLayout } from '../../js/shared/admin-layout.js';
import { http } from '../../js/shared/api.js';
import { UI } from '../../js/shared/ui.js';

let ordersList = [];

async function initOrdersPage() {
  const user = await AdminLayout.init('orders', 'Orders & Delivery Fulfillment');
  if (!user) return;

  await loadOrders();
  setupEventListeners();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initOrdersPage);
} else {
  initOrdersPage();
}

async function loadOrders() {
  const tbody = document.getElementById('admin-orders-tbody');
  if (tbody) {
    UI.renderSkeletonTable(tbody, 5, 8);
  }

  try {
    const res = await http.get('/api/admin/orders');
    ordersList = res.orders || [];
    renderTable(ordersList);
  } catch (e) {
    console.error('Failed to load orders', e);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-red-500 font-semibold text-xs">Failed to load orders.</td></tr>`;
    }
  }
}

function renderTable(orders) {
  const tbody = document.getElementById('admin-orders-tbody');
  if (!tbody) return;

  if (orders.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="p-8 text-center text-gray-400">
          <div class="space-y-2">
            <span class="text-3xl block">📦</span>
            <h4 class="font-bold text-gray-700 text-sm">No Orders Placed</h4>
            <p class="text-xs text-gray-500">Customer storefront orders will display here for fulfillment.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = orders.map(o => {
    const totalNum = Number(o.total) || 0;
    const isPickup = o.pickup_location && o.pickup_location.length > 0;
    const isAwaitingVerif = o.payment_status === 'awaiting_verification';
    const isAwaitingPayment = o.payment_status === 'awaiting_payment';
    const isPaybill = o.payment_method === 'paybill_manual';
    const isPaid = o.payment_status === 'paid';

    return `
      <tr class="hover:bg-gray-50 transition-colors border-b border-gray-100">
        <td class="p-3.5 font-bold text-gray-900">#${o.order_number || o.id}</td>
        <td class="p-3.5 text-gray-500 text-[11px]">${new Date(o.created_at || Date.now()).toLocaleDateString()}</td>
        <td class="p-3.5 font-semibold text-gray-800">
          <div>${o.full_name}</div>
          <div class="text-[10px] text-gray-400 font-normal">${o.email}</div>
        </td>
        <td class="p-3.5">
          <span class="px-2 py-0.5 text-[10px] font-bold rounded uppercase ${isPickup ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}">
            ${isPickup ? 'Kajiado Pickup' : (o.city || 'Delivery')}
          </span>
        </td>
        <td class="p-3.5">
          <div class="flex flex-col gap-0.5">
            <div class="flex items-center gap-1.5">
              <span class="uppercase font-medium text-[11px] text-gray-700">
                ${isPaybill ? 'Co-op Paybill' : (o.payment_method || 'mpesa')}
              </span>
              <span class="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
                ${o.payment_status || 'unpaid'}
              </span>
            </div>
            ${o.transaction_reference ? `
              <span class="font-mono text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200 inline-block w-max">
                Code: ${o.transaction_reference}
              </span>
            ` : ''}
            ${isAwaitingVerif || isAwaitingPayment ? `
              <span class="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 text-[9px] font-bold inline-block w-max">
                ⏳ Unverified
              </span>
            ` : ''}
            ${o.verified_by_name || o.verified_at ? `
              <span class="text-[9px] text-emerald-700 font-semibold">
                ✓ ${o.verified_by_name || 'Admin'}
              </span>
            ` : ''}
          </div>
        </td>
        <td class="p-3.5 font-bold text-[#9B72CF]">KSh ${totalNum.toLocaleString()}</td>
        <td class="p-3.5">
          <select data-status-id="${o.id}" class="px-2 py-1 border border-gray-300 rounded text-[11px] font-bold bg-white cursor-pointer focus:outline-none focus:border-[#9B72CF]">
            <option value="pending" ${o.status === 'pending' ? 'selected' : ''}>Pending</option>
            <option value="processing" ${o.status === 'processing' ? 'selected' : ''}>Processing</option>
            <option value="ready_for_pickup" ${o.status === 'ready_for_pickup' ? 'selected' : ''}>Ready for Pickup</option>
            <option value="dispatched" ${o.status === 'dispatched' ? 'selected' : ''}>Dispatched</option>
            <option value="completed" ${o.status === 'completed' ? 'selected' : ''}>Completed</option>
            <option value="cancelled" ${o.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
          </select>
        </td>
        <td class="p-3.5 text-right whitespace-nowrap">
          <div class="inline-flex items-center gap-1.5 justify-end">
            ${!isPaid ? `
              <button data-record-mpesa="${o.id}" class="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] rounded-lg shadow transition-colors flex items-center gap-1 cursor-pointer">
                <span>📱</span>
                <span>Record M-Pesa</span>
              </button>
            ` : ''}
            <button data-view-order="${o.id}" class="px-3 py-1.5 bg-gray-900 text-white font-bold text-[11px] rounded-lg hover:bg-[#9B72CF] transition-colors cursor-pointer">
              View Details
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('[data-status-id]').forEach(select => {
    select.addEventListener('change', async (e) => {
      const id = e.currentTarget.getAttribute('data-status-id');
      const newStatus = e.target.value;
      const order = ordersList.find(o => o.id === id);

      if (newStatus === 'cancelled') {
        const confirmed = await UI.showConfirm({
          title: 'Cancel Order',
          message: `Are you sure you want to cancel order #${order ? (order.order_number || order.id) : id}?`,
          confirmText: 'Cancel Order',
          danger: true
        });

        if (!confirmed) {
          await loadOrders();
          return;
        }
      }

      try {
        await http.put(`/api/admin/orders/${id}/status`, { status: newStatus });
        UI.showToast(`Order status updated to "${newStatus.replace('_', ' ')}"`, "Status Updated", "success");
        await loadOrders();
      } catch (err) {
        UI.showToast(err.message || 'Failed to update order status', "Error", "error");
      }
    });
  });

  tbody.querySelectorAll('[data-record-mpesa]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-record-mpesa');
      const order = ordersList.find(o => o.id === id);
      if (order) openOrderModal(order, true);
    });
  });

  tbody.querySelectorAll('[data-view-order]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-view-order');
      const order = ordersList.find(o => o.id === id);
      if (order) openOrderModal(order, false);
    });
  });
}

function setupEventListeners() {
  const searchInput = document.getElementById('admin-order-search');
  const statusFilter = document.getElementById('admin-order-status-filter');

  if (searchInput) searchInput.addEventListener('input', filterTable);
  if (statusFilter) statusFilter.addEventListener('change', filterTable);

  document.getElementById('close-order-modal')?.addEventListener('click', () => {
    document.getElementById('order-modal-backdrop')?.classList.add('hidden');
  });
}

function filterTable() {
  const search = (document.getElementById('admin-order-search')?.value || '').toLowerCase();
  const status = document.getElementById('admin-order-status-filter')?.value || 'all';

  const filtered = ordersList.filter(o => {
    const matchSearch = (o.order_number || '').toLowerCase().includes(search) ||
                        o.full_name.toLowerCase().includes(search) ||
                        o.email.toLowerCase().includes(search);
    const matchStatus = status === 'all' || o.status === status;
    return matchSearch && matchStatus;
  });

  renderTable(filtered);
}

function openOrderModal(order, focusMpesa = false) {
  document.getElementById('modal-order-number').textContent = `Order #${order.order_number || order.id}`;
  document.getElementById('modal-order-date').textContent = `Placed on ${new Date(order.created_at || Date.now()).toLocaleString()}`;

  const container = document.getElementById('modal-order-content');
  const totalNum = Number(order.total) || 0;
  const subtotalNum = Number(order.subtotal) || 0;
  const shippingNum = Number(order.shipping) || 0;
  const taxNum = Math.max(0, totalNum - subtotalNum - shippingNum);
  const isPaid = order.payment_status === 'paid';

  container.innerHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200 text-xs">
      <div>
        <h4 class="font-bold text-gray-900 mb-1">Customer Profile</h4>
        <p class="font-semibold text-gray-800">${order.full_name}</p>
        <p class="text-gray-500">${order.email}</p>
        <p class="text-gray-500">${order.phone}</p>
        <p class="text-gray-500 mt-1"><span class="font-bold text-gray-700">Customer account ID:</span> ${order.user_id || 'Guest / walk-in'}</p>
      </div>

      <div class="space-y-1">
        <h4 class="font-bold text-gray-900 mb-1">Fulfillment & Payment</h4>
        <p><span class="font-bold">Method:</span> ${(order.payment_method || 'M-Pesa').toUpperCase()}</p>
        <p><span class="font-bold">Destination:</span> ${order.pickup_location ? `Store Pickup (${order.pickup_location})` : `${order.address || ''}, ${order.city || 'Nairobi'}`}</p>
        <p><span class="font-bold">Fulfillment status:</span> <span class="uppercase">${order.status || 'pending'}</span></p>
        <p><span class="font-bold">Payment Status:</span> <span class="uppercase font-bold ${isPaid ? 'text-emerald-700' : 'text-amber-600'}">${order.payment_status || 'unpaid'}</span></p>
        <p><span class="font-bold">Sales channel:</span> ${(order.source || 'online').toUpperCase()}</p>
        <p><span class="font-bold">Payment mode:</span> ${order.payment_mode || 'live'}</p>
        ${order.transaction_reference ? `<p><span class="font-bold text-purple-900">M-Pesa Tx Code:</span> <span class="font-mono font-bold text-purple-700">${order.transaction_reference}</span></p>` : ''}
        ${order.payer_name_or_number ? `<p><span class="font-bold text-purple-900">Payer Details:</span> <span>${order.payer_name_or_number}</span></p>` : ''}
        ${order.payment_message ? `<p><span class="font-bold text-emerald-900">Callback Message:</span> <span class="text-emerald-700">${order.payment_message}</span></p>` : ''}
        ${order.verified_by || order.verified_by_name ? `<p class="text-[11px] text-emerald-800 mt-1 font-semibold">✓ Verified by ${order.verified_by_name || 'Admin'} on ${new Date(order.verified_at || Date.now()).toLocaleString()}</p>` : ''}
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
      <div class="p-3 border border-gray-200 rounded-xl bg-white"><span class="block text-gray-500">Order ID</span><span class="font-mono text-[10px] break-all">${order.id}</span></div>
      <div class="p-3 border border-gray-200 rounded-xl bg-white"><span class="block text-gray-500">Order placed</span><span class="font-semibold">${new Date(order.created_at || Date.now()).toLocaleString()}</span></div>
      <div class="p-3 border border-gray-200 rounded-xl bg-white"><span class="block text-gray-500">Cashier / verifier</span><span class="font-semibold">${order.cashier_name || order.verified_by_name || 'Not assigned'}</span></div>
    </div>

    ${!isPaid ? `
      <!-- Manual M-Pesa Record / Verification Section -->
      <div class="p-4 bg-emerald-50/70 border border-emerald-300 rounded-2xl space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-sm">📱</span>
            <div>
              <h4 class="font-bold text-emerald-950 text-xs">Record / Confirm M-Pesa Payment Manually</h4>
              <p class="text-[10px] text-emerald-700">Enter customer's Safaricom SMS code and mark order as PAID</p>
            </div>
          </div>
          <span class="text-[10px] font-mono font-bold text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded-full">
            Amount: KSh ${totalNum.toLocaleString()}
          </span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div>
            <label class="block font-bold text-gray-700 mb-0.5 text-[11px]">M-Pesa / SMS Transaction Code *</label>
            <input type="text" id="admin-mpesa-code-input" value="${order.transaction_reference || ''}" placeholder="e.g. QKH8972JKL" class="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl text-xs uppercase font-mono font-bold focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500">
          </div>
          <div>
            <label class="block font-bold text-gray-700 mb-0.5 text-[11px]">Payer Name / Number from SMS</label>
            <input type="text" id="admin-mpesa-payer-input" value="${order.payer_name_or_number || order.full_name || order.phone || ''}" placeholder="e.g. Mary Wambui (0712345678)" class="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl text-xs focus:outline-none focus:border-emerald-600">
          </div>
        </div>

        <button id="admin-verify-btn" class="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer">
          <span>✅</span>
          <span>Confirm & Record M-Pesa Payment (Mark as PAID)</span>
        </button>
      </div>
    ` : `
      <!-- Already Paid Info & Option to Update Code -->
      <div class="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs">
        <div class="space-y-0.5">
          <div class="flex items-center gap-1.5 font-bold text-emerald-900">
            <span>✅ Payment Verified & Recorded</span>
            ${order.transaction_reference ? `<span class="font-mono bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded border border-emerald-300">${order.transaction_reference}</span>` : ''}
          </div>
          <p class="text-[10px] text-emerald-700">
            ${order.verified_by_name ? `Verified by <strong>${order.verified_by_name}</strong> on ` : 'Verified on '}
            ${new Date(order.verified_at || order.created_at || Date.now()).toLocaleString()}
            ${order.payer_name_or_number ? `&bull; Payer: <strong>${order.payer_name_or_number}</strong>` : ''}
          </p>
        </div>
        <button id="admin-edit-mpesa-code-btn" class="px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-lg font-bold text-[10px] transition-colors cursor-pointer">
          Edit Code
        </button>
      </div>

      <div id="admin-edit-code-box" class="p-3 bg-purple-50 border border-purple-200 rounded-xl space-y-2 text-xs hidden">
        <div class="flex items-center gap-2">
          <input type="text" id="admin-edit-code-input" value="${order.transaction_reference || ''}" placeholder="M-Pesa Transaction Code" class="flex-1 px-3 py-1.5 bg-white border border-purple-200 rounded-lg text-xs uppercase font-mono font-bold">
          <button id="admin-save-code-btn" class="px-3 py-1.5 bg-[#9B72CF] hover:bg-[#855cb8] text-white font-bold rounded-lg text-xs cursor-pointer">Save Code</button>
        </div>
      </div>
    `}

    ${order.payment_message ? `
      <div class="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
        <p class="font-bold text-emerald-900 text-[11px] uppercase tracking-wide mb-1">Callback Status / M-Pesa Note</p>
        <p class="text-[11px] text-emerald-800">${order.payment_message}</p>
      </div>
    ` : ''}

    <div>
      <h4 class="font-bold text-gray-900 text-xs mb-2">Purchased Items (${order.items ? order.items.length : 0})</h4>
      <div class="space-y-2">
        ${(order.items || []).map(item => `
          <div class="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg text-xs">
            <div class="flex items-center gap-3">
              <img src="${item.image || 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80'}" class="w-10 h-10 object-cover rounded bg-gray-100">
              <div>
                <h5 class="font-bold text-gray-900">${item.name || 'Product'}</h5>
                <p class="text-[10px] text-gray-500">Qty: ${item.quantity} | Unit price: KSh ${Number(item.price_at_purchase || item.price || 0).toLocaleString()}</p>
                ${item.description ? `<p class="mt-1 max-w-xl text-[10px] leading-relaxed text-gray-600">${item.description}</p>` : ''}
                ${item.selected_size || item.selectedSize ? `<p class="text-[10px] font-semibold text-[#9B72CF]">Size: ${item.selected_size || item.selectedSize}</p>` : ''}
                ${item.selected_color || item.selectedShade ? `<p class="text-[10px] font-semibold text-[#9B72CF]">Color: ${item.selected_color || item.selectedShade}</p>` : ''}
              </div>
            </div>
            <span class="font-bold text-gray-900">KSh ${(Number(item.price_at_purchase || item.price) * item.quantity).toLocaleString()}</span>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="p-4 bg-gray-900 text-white rounded-xl space-y-2 font-bold text-xs">
      <div class="flex justify-between"><span>Items subtotal</span><span>KSh ${subtotalNum.toLocaleString()}</span></div>
      <div class="flex justify-between"><span>Delivery / pickup</span><span>${shippingNum === 0 ? 'FREE' : `KSh ${shippingNum.toLocaleString()}`}</span></div>
      <div class="flex justify-between"><span>Tax</span><span>KSh ${taxNum.toLocaleString()}</span></div>
      <div class="flex justify-between border-t border-white/20 pt-2 text-sm"><span>Total Amount Payable:</span><span class="text-[#E8C500] text-base">KSh ${totalNum.toLocaleString()}</span></div>
    </div>
  `;

  const verifyBtn = document.getElementById('admin-verify-btn');
  if (verifyBtn) {
    verifyBtn.addEventListener('click', async () => {
      const codeInput = document.getElementById('admin-mpesa-code-input');
      const payerInput = document.getElementById('admin-mpesa-payer-input');
      const code = codeInput ? codeInput.value.trim().toUpperCase() : '';
      const payer = payerInput ? payerInput.value.trim() : '';

      if (!code) {
        UI.showToast('Please enter the M-Pesa / SMS confirmation code.', 'Code Required', 'error');
        codeInput?.focus();
        return;
      }

      UI.setButtonLoading(verifyBtn, true, 'Recording & Verifying...');
      try {
        const res = await http.put(`/api/admin/orders/${order.id}/verify-payment`, {
          transaction_reference: code,
          payer_name_or_number: payer,
          payment_method: 'mpesa'
        });
        if (res.success) {
          UI.showToast(`Order #${order.order_number || order.id} marked as PAID with code ${code}!`, 'Payment Verified', 'success');
          document.getElementById('order-modal-backdrop')?.classList.add('hidden');
          await loadOrders();
        } else {
          UI.showToast(res.error || 'Failed to verify payment', 'Error', 'error');
        }
      } catch (err) {
        UI.showToast(err.message || 'Server error verifying payment', 'Error', 'error');
      } finally {
        UI.setButtonLoading(verifyBtn, false);
      }
    });
  }

  // Edit Code toggle & save
  document.getElementById('admin-edit-mpesa-code-btn')?.addEventListener('click', () => {
    document.getElementById('admin-edit-code-box')?.classList.toggle('hidden');
    document.getElementById('admin-edit-code-input')?.focus();
  });

  document.getElementById('admin-save-code-btn')?.addEventListener('click', async (e) => {
    const editCodeInput = document.getElementById('admin-edit-code-input');
    const newCode = editCodeInput ? editCodeInput.value.trim().toUpperCase() : '';
    if (!newCode) {
      UI.showToast('Please enter a valid code', 'Code Required', 'error');
      return;
    }

    UI.setButtonLoading(e.currentTarget, true, 'Saving...');
    try {
      const res = await http.put(`/api/admin/orders/${order.id}/verify-payment`, {
        transaction_reference: newCode,
        payer_name_or_number: order.payer_name_or_number,
        payment_method: order.payment_method || 'mpesa'
      });
      if (res.success) {
        UI.showToast(`M-Pesa code updated to ${newCode}!`, 'Code Updated', 'success');
        document.getElementById('order-modal-backdrop')?.classList.add('hidden');
        await loadOrders();
      } else {
        UI.showToast(res.error || 'Failed to update code', 'Error', 'error');
      }
    } catch (err) {
      UI.showToast(err.message || 'Server error', 'Error', 'error');
    } finally {
      UI.setButtonLoading(e.currentTarget, false);
    }
  });

  document.getElementById('order-modal-backdrop')?.classList.remove('hidden');

  if (focusMpesa) {
    setTimeout(() => {
      document.getElementById('admin-mpesa-code-input')?.focus();
    }, 150);
  }
}
