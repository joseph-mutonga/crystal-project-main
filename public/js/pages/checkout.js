/**
 * Crystal Crest - Checkout Page Logic (checkout.js - KSh Shillings Currency)
 * 3-step checkout wizard, Leaflet.js store pickup map near Kajiado, POST /api/orders integration.
 */

import { UI } from '../shared/ui.js';
import { ApiService } from '../shared/api.js';
import { CartStore } from '../shared/cart.js';

let currentStep = 1;
let currentFulfillmentType = 'delivery'; // 'delivery' or 'pickup'
let mapInitialized = false;
let leafletMap = null;

document.addEventListener('DOMContentLoaded', async () => {
  UI.initHeader('checkout');
  UI.initFooter();

  window.addEventListener('cartUpdated', () => {
    renderSummaryCart();
  });

  await CartStore.init();
  renderSummaryCart();

  const currentUser = await ApiService.getCurrentUser();
  if (currentUser) {
    const names = (currentUser.full_name || '').split(' ');
    const firstName = names[0] || '';
    const lastName = names.slice(1).join(' ') || '';

    const fnEl = document.getElementById('ship-first-name');
    const lnEl = document.getElementById('ship-last-name');
    const emailEl = document.getElementById('ship-email');
    const phoneEl = document.getElementById('ship-phone');

    if (fnEl && !fnEl.value) fnEl.value = firstName;
    if (lnEl && !lnEl.value) lnEl.value = lastName;
    if (emailEl && !emailEl.value) emailEl.value = currentUser.email || '';
    if (phoneEl && !phoneEl.value) phoneEl.value = currentUser.phone || '';
  }

  setupFulfillmentToggle();
  setupPaymentToggle();
  setupStepWizard();
});

function renderSummaryCart() {
  const container = document.getElementById('checkout-cart-items');
  const subtotalEl = document.getElementById('summary-subtotal');
  const shippingLabelEl = document.getElementById('summary-shipping-label');
  const shippingEl = document.getElementById('summary-shipping');
  const taxEl = document.getElementById('summary-tax');
  const grandtotalEl = document.getElementById('summary-grandtotal');

  if (!container) return;

  const cart = CartStore.getCart();
  const totals = CartStore.getTotals(currentFulfillmentType);

  if (subtotalEl) subtotalEl.textContent = `KSh ${totals.subtotal.toLocaleString()}`;
  if (shippingLabelEl) {
    shippingLabelEl.textContent = currentFulfillmentType === 'pickup' ? 'Store Pickup (Kajiado)' : 'Kajiado Town Delivery';
  }
  if (shippingEl) {
    shippingEl.textContent = totals.shipping === 0 ? 'FREE' : `KSh ${totals.shipping.toLocaleString()}`;
  }
  if (taxEl) taxEl.textContent = 'Included';
  if (grandtotalEl) grandtotalEl.textContent = `KSh ${totals.grandTotal.toLocaleString()}`;

  if (!cart || cart.length === 0) {
    UI.renderEmptyState(container, {
      icon: '🛍️',
      title: 'Your Bag is Empty',
      message: 'Add formulations to your bag before checking out.',
      actionText: 'Return to Shop',
      actionUrl: 'shop.html'
    });
    return;
  }

  container.innerHTML = cart.map(item => {
    const p = typeof item.price === 'number' ? item.price : (parseFloat(item.price) || 0);
    const q = parseInt(item.quantity) || 1;
    const img = (item.images && item.images[0]) || item.image || 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80';

    return `
      <div class="flex items-center gap-3 p-2 bg-white rounded-xl border border-blush shadow-sm">
        <img src="${img}" alt="${item.name}" class="w-12 h-12 object-cover rounded-lg bg-blush">
        <div class="flex-1 min-w-0">
          <h4 class="text-xs font-bold text-charcoal truncate">${item.name}</h4>
          <p class="text-[10px] text-gray-500">${q}x ${item.selectedSize ? `• ${item.selectedSize}` : ''} ${item.selectedShade ? `(${item.selectedShade})` : ''}</p>
        </div>
        <span class="text-xs font-bold text-charcoal">KSh ${(p * q).toLocaleString()}</span>
      </div>
    `;
  }).join('');
}

function setupFulfillmentToggle() {
  const homeOpt = document.getElementById('delivery-option-home');
  const pickupOpt = document.getElementById('delivery-option-pickup');
  const homeSection = document.getElementById('home-address-section');
  const pickupSection = document.getElementById('store-pickup-section');

  const radioHome = homeOpt.querySelector('input[value="home"]');
  const radioPickup = pickupOpt.querySelector('input[value="pickup"]');

  homeOpt.addEventListener('click', () => {
    radioHome.checked = true;
    currentFulfillmentType = 'delivery';
    homeOpt.className = "p-3 sm:p-4 rounded-2xl border-2 border-deep-purple bg-blush/30 cursor-pointer flex flex-col items-center text-center space-y-1 transition-all";
    pickupOpt.className = "p-3 sm:p-4 rounded-2xl border-2 border-blush bg-white cursor-pointer flex flex-col items-center text-center space-y-1 transition-all";
    
    homeSection.classList.remove('hidden');
    pickupSection.classList.add('hidden');
    renderSummaryCart();
  });

  pickupOpt.addEventListener('click', () => {
    radioPickup.checked = true;
    currentFulfillmentType = 'pickup';
    pickupOpt.className = "p-3 sm:p-4 rounded-2xl border-2 border-deep-purple bg-blush/30 cursor-pointer flex flex-col items-center text-center space-y-1 transition-all";
    homeOpt.className = "p-3 sm:p-4 rounded-2xl border-2 border-blush bg-white cursor-pointer flex flex-col items-center text-center space-y-1 transition-all";

    pickupSection.classList.remove('hidden');
    homeSection.classList.add('hidden');
    renderSummaryCart();

    initKajiadoLeafletMap();
  });
}

function initKajiadoLeafletMap() {
  if (mapInitialized) return;
  
  const kajiadoLat = -1.8523;
  const kajiadoLng = 36.7768;

  setTimeout(() => {
    const mapElement = document.getElementById('pickup-map');
    if (!mapElement) return;

    leafletMap = L.map('pickup-map').setView([kajiadoLat, kajiadoLng], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors | Crystal Crest Boutique'
    }).addTo(leafletMap);

    const marker = L.marker([kajiadoLat, kajiadoLng]).addTo(leafletMap);
    
    marker.bindPopup(`
      <div style="padding: 4px; text-align: center;">
        <h4 style="font-family: 'Cormorant Garamond', serif; font-size: 16px; font-weight: bold; color: #1C1C1E; margin-bottom: 2px;">
          Crystal Crest Boutique
        </h4>
        <p style="font-size: 11px; color: #9B72CF; font-weight: 600;">Kajiado Town Flagship Store</p>
        <p style="font-size: 10px; color: #666; margin-top: 4px;">Store Hours: 9:00 AM - 7:00 PM</p>
      </div>
    `).openPopup();

    mapInitialized = true;
  }, 100);
}

function setupPaymentToggle() {
  const mpesaForm = document.getElementById('mpesa-form');

  // Fetch dynamic Paybill settings

  document.querySelectorAll('input[name="payment-method"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.value === 'mpesa') {
        mpesaForm?.classList.remove('hidden');
      } else {
        mpesaForm?.classList.add('hidden');
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

function validateInformationStep() {
  clearInlineErrors();
  let isValid = true;

  const fnEl = document.getElementById('ship-first-name');
  const lnEl = document.getElementById('ship-last-name');
  const emailEl = document.getElementById('ship-email');
  const phoneEl = document.getElementById('ship-phone');
  const addressEl = document.getElementById('ship-address');
  const cityEl = document.getElementById('ship-city');

  const isPickup = currentFulfillmentType === 'pickup' || document.querySelector('input[name="fulfillment-type"]:checked')?.value === 'pickup';

  if (!fnEl.value.trim()) {
    showInlineError(fnEl, 'First name is required.');
    isValid = false;
  }
  if (!lnEl.value.trim()) {
    showInlineError(lnEl, 'Last name is required.');
    isValid = false;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailEl.value.trim() || !emailRegex.test(emailEl.value.trim())) {
    showInlineError(emailEl, 'Please enter a valid email address.');
    isValid = false;
  }

  const phoneRegex = /^[0-9+\s-]{7,15}$/;
  if (!phoneEl.value.trim() || !phoneRegex.test(phoneEl.value.trim())) {
    showInlineError(phoneEl, 'Please enter a valid phone number (e.g. 0700074333).');
    isValid = false;
  }

  if (!isPickup) {
    if (!addressEl.value.trim()) {
      showInlineError(addressEl, 'Street address / landmark is required for Kajiado doorstep delivery.');
      isValid = false;
    }
    const cityVal = cityEl.value.trim().toLowerCase();
    if (!cityVal) {
      showInlineError(cityEl, 'Town/Area is required (Delivery is around Kajiado Town).');
      isValid = false;
    } else if (!cityVal.includes('kajiado') && !cityVal.includes('crapas') && !cityVal.includes('town') && !cityVal.includes('central') && !cityVal.includes('hospital')) {
      showInlineError(cityEl, 'Doorstep delivery is currently only available around Kajiado Town. Please select Store Pickup or enter a Kajiado address.');
      isValid = false;
    }
  }

  return isValid;
}

function setupStepWizard() {
  const step1 = document.getElementById('checkout-step-1');
  const step2 = document.getElementById('checkout-step-2');
  const step3 = document.getElementById('checkout-step-3');

  const toStep2 = document.getElementById('to-step-2-btn');
  const backStep1 = document.getElementById('back-to-step-1');
  const toStep3 = document.getElementById('to-step-3-btn');
  const backStep2 = document.getElementById('back-to-step-2');
  const submitBtn = document.getElementById('submit-order-btn');

  const ind1 = document.getElementById('step-1-indicator');
  const ind2 = document.getElementById('step-2-indicator');
  const ind3 = document.getElementById('step-3-indicator');

  toStep2.addEventListener('click', () => {
    if (!validateInformationStep()) {
      UI.showToast('Please check the highlighted delivery fields.', 'Form Validation', 'error');
      return;
    }

    step1.classList.add('hidden');
    step2.classList.remove('hidden');

    ind1.className = "flex items-center gap-2 text-charcoal/60 font-medium text-xs";
    ind1.querySelector('span').className = "w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs";
    ind1.querySelector('span').textContent = "✓";

    ind2.className = "flex items-center gap-2 text-deep-purple font-bold text-xs";
    ind2.querySelector('span').className = "w-7 h-7 rounded-full bg-deep-purple text-white flex items-center justify-center text-xs";
    
    currentStep = 2;
  });

  backStep1.addEventListener('click', () => {
    step2.classList.add('hidden');
    step1.classList.remove('hidden');

    ind1.className = "flex items-center gap-2 text-deep-purple font-bold text-xs";
    ind1.querySelector('span').className = "w-7 h-7 rounded-full bg-deep-purple text-white flex items-center justify-center text-xs";
    ind1.querySelector('span').textContent = "1";

    ind2.className = "flex items-center gap-2 text-charcoal/40 font-bold text-xs";
    ind2.querySelector('span').className = "w-7 h-7 rounded-full bg-blush text-charcoal flex items-center justify-center text-xs";

    currentStep = 1;
  });

  toStep3.addEventListener('click', () => {
    clearInlineErrors();
    const payment = document.querySelector('input[name="payment-method"]:checked')?.value || 'mpesa';


    step2.classList.add('hidden');
    step3.classList.remove('hidden');

    const isPickup = currentFulfillmentType === 'pickup';
    document.getElementById('review-fulfillment-type').textContent = isPickup ? 'Store Pickup (FREE - Kajiado Boutique)' : 'Kajiado Town Delivery (Flat KSh 100)';
    
    const city = document.getElementById('ship-city')?.value || 'Kajiado Town';
    const address = document.getElementById('ship-address')?.value || '';
    document.getElementById('review-destination').textContent = isPickup ? 'Crystal Crest Boutique (Opp Crapas Hotel), Kajiado' : `${address}, ${city}`;

     document.getElementById('review-payment-method').textContent = 'M-Pesa Express (Instant STK)';

    ind2.className = "flex items-center gap-2 text-charcoal/60 font-medium text-xs";
    ind2.querySelector('span').className = "w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs";
    ind2.querySelector('span').textContent = "✓";

    ind3.className = "flex items-center gap-2 text-deep-purple font-bold text-xs";
    ind3.querySelector('span').className = "w-7 h-7 rounded-full bg-deep-purple text-white flex items-center justify-center text-xs";

    currentStep = 3;
  });

  backStep2.addEventListener('click', () => {
    step3.classList.add('hidden');
    step2.classList.remove('hidden');

    ind2.className = "flex items-center gap-2 text-deep-purple font-bold text-xs";
    ind2.querySelector('span').className = "w-7 h-7 rounded-full bg-deep-purple text-white flex items-center justify-center text-xs";
    ind2.querySelector('span').textContent = "2";

    ind3.className = "flex items-center gap-2 text-charcoal/40 font-bold text-xs";
    ind3.querySelector('span').className = "w-7 h-7 rounded-full bg-blush text-charcoal flex items-center justify-center text-xs";

    currentStep = 2;
  });

  let pendingOrderId = null;
  let pollingInterval = null;
  let pollingSecondsLeft = 60;

  function stopPolling() {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
  }

  function updateCountdownUI() {
    const countdownEl = document.getElementById('stk-countdown-text');
    const progressBar = document.getElementById('stk-progress-bar');
    if (countdownEl) {
      countdownEl.textContent = `Awaiting PIN entry (${pollingSecondsLeft}s remaining)...`;
    }
    if (progressBar) {
      const pct = Math.max(0, Math.min(100, (pollingSecondsLeft / 60) * 100));
      progressBar.style.width = `${pct}%`;
    }
  }

  async function pollOrderStatus(orderId) {
    stopPolling();
    pollingSecondsLeft = 60;
    let pollsCompleted = 0;
    const maxPolls = 30; // 30 polls * 2s = 60s

    pollingInterval = setInterval(async () => {
      pollsCompleted++;
      pollingSecondsLeft = Math.max(0, 60 - (pollsCompleted * 2));
      updateCountdownUI();

      try {
        const res = await fetch(`/api/orders/${orderId}/status`);
        const data = await res.json();

        if (data.success) {
          if (data.payment_status === 'paid') {
            stopPolling();
            handlePaymentSuccess(orderId);
            return;
          } else if (data.payment_status === 'failed') {
            stopPolling();
            handlePaymentFailure("Payment wasn't completed. Customer cancelled or entered wrong PIN.");
            return;
          } else if (data.payment_status === 'awaiting_payment') {
            // Proactive check with Daraja Query
            try {
              const stkRes = await fetch(`/api/payments/stk-status/${orderId}`);
              const stkData = await stkRes.json();
              if (stkData.success && stkData.payment_status === 'paid') {
                stopPolling();
                handlePaymentSuccess(orderId);
                return;
              } else if (stkData.success && stkData.payment_status === 'failed') {
                stopPolling();
                handlePaymentFailure(stkData.message || "Payment wasn't completed.");
                return;
              }
            } catch (err2) {}
          }
        }
      } catch (e) {
        console.warn('Polling error:', e);
      }

      if (pollsCompleted >= maxPolls) {
        stopPolling();
        handlePaymentFailure("Payment request timed out without PIN confirmation. Please tap Retry or choose a different payment method.");
      }
    }, 2000);
  }

  function handlePaymentSuccess(orderId) {
    const waitingPanel = document.getElementById('mpesa-stk-waiting-panel');
    const successPanel = document.getElementById('mpesa-stk-success-panel');
    const failurePanel = document.getElementById('mpesa-stk-failure-panel');

    waitingPanel?.classList.add('hidden');
    failurePanel?.classList.add('hidden');
    successPanel?.classList.remove('hidden');

    CartStore.clearCart();
    UI.showToast("M-Pesa payment confirmed successfully! Redirecting...", "Payment Success", "success");

    setTimeout(() => {
      window.location.href = `order-confirmation.html?orderId=${orderId}`;
    }, 1500);
  }

  function handlePaymentFailure(reason) {
    const waitingPanel = document.getElementById('mpesa-stk-waiting-panel');
    const failurePanel = document.getElementById('mpesa-stk-failure-panel');
    const failureMsg = document.getElementById('stk-failure-message');
    const submitBtn = document.getElementById('submit-order-btn');
    const submitBtnText = document.getElementById('submit-order-btn-text');

    waitingPanel?.classList.add('hidden');

    let formattedReason = reason;
    if (reason && (reason.includes('Invalid Access Token') || reason.includes('credentials') || reason.includes('errorCode'))) {
      formattedReason = "Safaricom M-Pesa is not accepting the current credentials for Paybill 400200. You can pay directly via Co-op Paybill (400200 / Account: 104514) or retry.";
    }

    if (failureMsg && formattedReason) failureMsg.textContent = formattedReason;
    failurePanel?.classList.remove('hidden');

    if (submitBtn) {
      UI.setButtonLoading(submitBtn, false);
      submitBtn.disabled = false;
      submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      if (submitBtnText) submitBtnText.textContent = "Complete Order & Reserve";
    }
  }

  // Retry STK Push Button
  document.getElementById('retry-stk-btn')?.addEventListener('click', async () => {
    if (!pendingOrderId) return;
    const phoneInput = document.getElementById('mpesa-phone')?.value || document.getElementById('ship-phone')?.value || '';
    const totals = CartStore.getTotals(currentFulfillmentType);
    await triggerMpesaStkPush(pendingOrderId, phoneInput, totals.grandTotal);
  });

  async function triggerMpesaStkPush(orderId, phone, amount) {
    const waitingPanel = document.getElementById('mpesa-stk-waiting-panel');
    const failurePanel = document.getElementById('mpesa-stk-failure-panel');
    const submitBtn = document.getElementById('submit-order-btn');
    const promptPhoneEl = document.getElementById('stk-prompt-phone');
    const promptAmountEl = document.getElementById('stk-prompt-amount');

    failurePanel?.classList.add('hidden');
    waitingPanel?.classList.remove('hidden');

    if (promptPhoneEl) promptPhoneEl.textContent = phone;
    if (promptAmountEl) promptAmountEl.textContent = `KSh ${parseFloat(amount).toLocaleString()}`;

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }

    try {
      const res = await fetch('/api/payments/mpesa-stk-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, phone, amount })
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to send M-Pesa STK push.');
      }

      UI.showToast(`Payment request sent to ${data.phone}. Enter PIN on your phone.`, "STK Push Sent", "info");
      pollOrderStatus(orderId);

    } catch (err) {
      handlePaymentFailure(err.message || 'Error triggering STK push.');
    } finally {
      if (submitBtn) {
        UI.setButtonLoading(submitBtn, false);
      }
    }
  }

  submitBtn.addEventListener('click', async () => {
    const cart = CartStore.getCart();
    if (!cart || cart.length === 0) {
      UI.showToast("Your shopping bag is empty!", "Cart Empty", "error");
      return;
    }

    const firstName = document.getElementById('ship-first-name').value || 'Valued';
    const lastName = document.getElementById('ship-last-name').value || 'Customer';
    const email = document.getElementById('ship-email').value || 'customer@crystalcrest.com';
    const phone = document.getElementById('ship-phone').value || '';
    const address = document.getElementById('ship-address')?.value || '';
    const city = document.getElementById('ship-city')?.value || 'Kajiado Town';

    const isPickup = currentFulfillmentType === 'pickup';
    const payment = document.querySelector('input[name="payment-method"]:checked').value;
    const mpesaPhone = document.getElementById('mpesa-phone')?.value || phone;

    const currentTotals = CartStore.getTotals(currentFulfillmentType);

    const payload = {
      full_name: `${firstName} ${lastName}`,
      email,
      phone: payment === 'mpesa' ? mpesaPhone : phone,
      address: isPickup ? 'Crystal Crest Boutique (Opposite Crapas Hotel)' : address,
      city: isPickup ? 'Kajiado Town' : city,
      payment_method: payment,
      pickup_location: isPickup ? 'Crystal Crest Boutique (Opposite Crapas Hotel), Kajiado Town' : '',
      items: cart.map(item => ({
        product_id: item.product_id || item.id,
        id: item.product_id || item.id,
        name: item.name,
        quantity: parseInt(item.quantity || 1, 10),
        price: typeof item.price === 'number' ? item.price : (parseFloat(item.price) || 0),
        image: (item.images && item.images[0]) || item.image || ''
      })),
      totals: currentTotals
    };


    if (payment === 'mpesa') {
      UI.setButtonLoading(submitBtn, true, 'Sending payment request to your phone...');
      try {
        const res = await ApiService.createOrder(payload);
        if (!res.success || !res.orderId) {
          throw new Error(res.error || 'Failed to initialize order.');
        }

        pendingOrderId = res.orderId;
        const totalAmount = currentTotals.grandTotal;
        await triggerMpesaStkPush(pendingOrderId, mpesaPhone, totalAmount);

      } catch (err) {
        UI.setButtonLoading(submitBtn, false);
        UI.showToast(err.message || 'Error processing checkout', 'Order Error', 'error');
      } finally {
        UI.setButtonLoading(submitBtn, false);
      }
    }
  });
}
