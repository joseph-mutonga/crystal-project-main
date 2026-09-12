/**
 * Crystal Crest - Order Confirmation & Receipt Display Logic (order-confirmation.js)
 * Reads orderId from URL query parameter, fetches order from GET /api/orders/:id, and renders receipt in KSh.
 */

import { UI } from '../shared/ui.js';
import { ApiService } from '../shared/api.js';
import { downloadReceiptPdf, getReceiptSettings } from '../shared/receipt.js';

let loadedOrder = null;
let receiptSettings = {};

document.addEventListener('DOMContentLoaded', async () => {
  UI.initHeader('checkout');
  UI.initFooter();

  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get('orderId') || urlParams.get('id');

  if (!orderId) {
    window.location.href = 'index.html';
    return;
  }

  receiptSettings = await getReceiptSettings();
  await loadOrderReceipt(orderId);
  document.getElementById('download-receipt-pdf')?.addEventListener('click', () => {
    if (loadedOrder) downloadReceiptPdf(loadedOrder, receiptSettings);
  });
});

async function loadOrderReceipt(orderId) {
  try {
    const order = await ApiService.getOrderById(orderId);

    if (!order) {
      document.getElementById('receipt-container').innerHTML = `
        <div class="text-center py-12 text-gray-500 text-xs">
          Order receipt not found. <a href="index.html" class="text-deep-purple font-bold underline">Return to home</a>
        </div>
      `;
      return;
    }

    renderReceipt(order);
    loadedOrder = order;
  } catch (err) {
    console.error('Failed to fetch order details:', err);
  }
}

function renderReceipt(order) {
  const orderNoEl = document.getElementById('receipt-order-number') || document.getElementById('order-ref-code');
  if (orderNoEl) orderNoEl.textContent = `Order #${order.order_number || order.id}`;

  const dateEl = document.getElementById('receipt-date') || document.getElementById('order-date-label');
  if (dateEl) {
    dateEl.textContent = `Placed on ${new Date(order.created_at || Date.now()).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })}`;
  }

  const isAwaitingVerification = order.payment_status === 'awaiting_verification';
  const isPaid = order.payment_status === 'paid';

  // Customize Banner for Awaiting Verification
  const bannerCard = document.getElementById('receipt-banner-card');
  const bannerIcon = document.getElementById('receipt-banner-icon');
  const bannerBadge = document.getElementById('receipt-banner-badge');
  const bannerTitle = document.getElementById('receipt-banner-title');
  const bannerDesc = document.getElementById('receipt-banner-desc');

  if (isAwaitingVerification) {
    if (bannerCard) bannerCard.className = "glass-card rounded-3xl p-8 sm:p-12 text-center space-y-6 border-t-4 border-t-purple-500 shadow-2xl animate-fade-in bg-purple-50/30";
    if (bannerIcon) {
      bannerIcon.className = "w-20 h-20 rounded-full bg-purple-100 text-deep-purple mx-auto flex items-center justify-center shadow-inner text-2xl font-bold";
      bannerIcon.innerHTML = `<span>⏳</span>`;
    }
    if (bannerBadge) {
      bannerBadge.textContent = "Awaiting Payment Confirmation";
      bannerBadge.className = "text-xs uppercase tracking-[0.25em] text-deep-purple font-bold";
    }
    if (bannerTitle) bannerTitle.textContent = "Order Received";
    if (bannerDesc) bannerDesc.textContent = "Order received — awaiting payment confirmation, this is usually quick";
  }

  const nameEl = document.getElementById('receipt-customer-name') || document.getElementById('order-customer-name');
  if (nameEl) nameEl.textContent = order.full_name || 'Valued Client';

  const emailEl = document.getElementById('receipt-customer-email') || document.getElementById('order-email');
  if (emailEl) emailEl.textContent = order.email || '';

  const payMethodEl = document.getElementById('receipt-payment-method') || document.getElementById('order-payment-mode');
  if (payMethodEl) {
    if (order.payment_method === 'paybill_manual') {
      payMethodEl.textContent = 'Co-op Paybill (Shop SMS Verified)';
    } else {
      payMethodEl.textContent = (order.payment_method || 'M-Pesa').toUpperCase();
    }
  }

  const statusEl = document.getElementById('receipt-payment-status');
  if (statusEl) {
    if (isAwaitingVerification) {
      statusEl.className = "text-purple-800 font-semibold mt-1";
      statusEl.textContent = "Status: Awaiting Cashier SMS Verification";
    } else if (isPaid) {
      statusEl.className = "text-emerald-700 font-semibold mt-1";
      statusEl.textContent = "Status: Paid & Reserved";
    } else {
      statusEl.className = "text-gray-600 font-semibold mt-1";
      statusEl.textContent = `Status: ${order.payment_status || 'Pending'}`;
    }
  }

  // Paybill verification code & payer info box
  const pbInfoBox = document.getElementById('receipt-paybill-info');
  const txCodeEl = document.getElementById('receipt-tx-code');
  const payerNameEl = document.getElementById('receipt-payer-name');
  if (pbInfoBox && (order.transaction_reference || order.payer_name_or_number)) {
    pbInfoBox.classList.remove('hidden');
    if (txCodeEl) txCodeEl.textContent = order.transaction_reference || '—';
    if (payerNameEl) payerNameEl.textContent = order.payer_name_or_number || '—';
  }

  const isPickup = order.pickup_location && order.pickup_location.length > 0;
  const fulEl = document.getElementById('receipt-fulfillment-type') || document.getElementById('order-fulfillment-mode');
  if (fulEl) fulEl.textContent = isPickup ? 'Boutique Store Pickup' : 'Home Express Delivery';

  const destEl = document.getElementById('receipt-destination') || document.getElementById('order-destination');
  if (destEl) destEl.textContent = isPickup ? order.pickup_location : `${order.address || ''}, ${order.city || 'Nairobi'}`;

  // Show Simulated Payment Notice if payment_mode is simulation
  const simNotice = document.getElementById('simulation-notice-box');
  if (simNotice) {
    const isSimulated = (order.payment_mode === 'simulation');
    if (isSimulated) {
      simNotice.classList.remove('hidden');
    } else {
      simNotice.classList.add('hidden');
    }
  }

  const itemsContainer = document.getElementById('receipt-items') || document.getElementById('confirmed-items-list');
  const subtotalNum = typeof order.subtotal === 'number' ? order.subtotal : (parseFloat(order.subtotal) || 0);
  const shippingNum = typeof order.shipping === 'number' ? order.shipping : (parseFloat(order.shipping) || 0);
  const totalNum = typeof order.total === 'number' ? order.total : (parseFloat(order.total) || 0);

  const subEl = document.getElementById('receipt-subtotal');
  const shipEl = document.getElementById('receipt-shipping');
  const totEl = document.getElementById('receipt-total');

  if (subEl) subEl.textContent = `KSh ${subtotalNum.toLocaleString()}`;
  if (shipEl) shipEl.textContent = shippingNum === 0 ? 'FREE' : `KSh ${shippingNum.toLocaleString()}`;
  if (totEl) totEl.textContent = `KSh ${totalNum.toLocaleString()}`;

  if (itemsContainer && order.items) {
    itemsContainer.innerHTML = order.items.map(item => {
      const p = typeof item.price_at_purchase === 'number' ? item.price_at_purchase : (parseFloat(item.price_at_purchase || item.price) || 0);
      const q = parseInt(item.quantity) || 1;
      const img = item.image || (item.images && item.images[0]) || 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80';

      return `
        <div class="flex items-center justify-between p-3 bg-white rounded-xl border border-blush">
          <div class="flex items-center gap-3">
            <img src="${img}" alt="${item.name}" class="w-12 h-12 object-cover rounded-lg bg-blush">
            <div>
              <h4 class="font-serif-heading text-sm font-bold text-charcoal">${item.name}</h4>
              <p class="text-[10px] text-gray-500">Qty: ${q}</p>
            </div>
          </div>
          <span class="font-bold text-xs text-charcoal">KSh ${(p * q).toLocaleString()}</span>
        </div>
      `;
    }).join('');
  }
}
