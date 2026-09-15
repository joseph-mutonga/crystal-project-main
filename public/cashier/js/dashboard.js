/**
 * Crystal Crest - Cashier POS Register Dashboard (public/cashier/js/dashboard.js)
 * Touch catalog grid, running POS cart, single product creation, bulk restock Excel upload, and offline sales import.
 */

import { CashierGuard } from '../../js/shared/cashier-guard.js';
import { UI } from '../../js/shared/ui.js';
import { getReceiptSettings, printReceipt } from '../../js/shared/receipt.js';

let activeCashier = null;
let receiptSettings = {};
let posProducts = [];
let selectedCategory = 'all';
let searchQuery = '';

let posCart = [];
let selectedPaymentMethod = 'cash';

let restockParsedRows = [];
let salesParsedRows = [];

let verifPollInterval = null;

async function initDashboard() {
  activeCashier = await CashierGuard.init('dashboard');
  if (!activeCashier) return;

  await loadPosProducts();
  await loadPaybillSettings();
  receiptSettings = await getReceiptSettings();
  await loadPendingVerifications();

  setupEventListeners();
  renderCart();

  // Poll for new pending SMS verifications every 10 seconds
  if (!verifPollInterval) {
    verifPollInterval = setInterval(loadPendingVerifications, 10000);
  }
}

async function loadPaybillSettings() {
  try {
    const res = await fetch('/api/settings/paybill');
    const data = await res.json();
    if (data.success && data.settings) {
      const pbNo = document.getElementById('pos-pb-no');
      const pbAcc = document.getElementById('pos-pb-acc');
      if (pbNo) pbNo.textContent = data.settings.paybill_number || '400200';
      if (pbAcc) pbAcc.textContent = data.settings.paybill_account_number || '104514';
    }
  } catch (e) {}
}

async function loadPendingVerifications() {
  const container = document.getElementById('verif-queue-list');
  const countBadge = document.getElementById('verif-badge-count');
  if (!container) return;

  try {
    const res = await fetch('/api/cashier/orders/awaiting-verification', { credentials: 'include' });
    const data = await res.json();

    if (data.success) {
      const orders = data.orders || [];
      if (countBadge) {
        countBadge.textContent = `${orders.length} Pending`;
        if (orders.length > 0) {
          countBadge.className = "px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-gray-900 shadow-sm animate-pulse";
        } else {
          countBadge.className = "px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-600 text-white shadow-sm border border-purple-400/40";
        }
      }

      if (orders.length === 0) {
        container.innerHTML = `
          <div class="text-center py-4 text-purple-200 text-xs">
            <span>✨ No pending payments. All incoming orders matched against shop SMS!</span>
          </div>
        `;
        return;
      }

      container.innerHTML = orders.map(o => {
        const timeAgo = formatTimeAgo(o.created_at);
        const isPos = o.source === 'pos';
        const totalNum = typeof o.total === 'number' ? o.total : (parseFloat(o.total) || 0);

        return `
          <div class="bg-gray-800/90 border border-purple-500/40 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md hover:border-purple-400 transition-all">
            <div class="space-y-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="font-bold text-xs text-white">#${o.order_number || o.id}</span>
                <span class="px-2 py-0.5 rounded-md text-[9px] font-bold ${isPos ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30' : 'bg-purple-400/20 text-purple-200 border border-purple-400/30'} uppercase">
                  ${isPos ? 'POS Walk-in' : 'Online Store'}
                </span>
                <span class="text-[10px] text-gray-400 font-medium">🕒 ${timeAgo}</span>
              </div>

              <!-- SMS Matching Details -->
              <div class="flex flex-wrap items-center gap-2 pt-0.5">
                <div class="flex items-center gap-1 text-xs">
                  <span class="text-gray-400 text-[11px]">Amount:</span>
                  <span class="font-bold text-emerald-400">KSh ${totalNum.toLocaleString()}</span>
                </div>
                <span class="text-gray-600">&bull;</span>
                <div class="flex items-center gap-1 text-xs">
                  <span class="text-gray-400 text-[11px]">M-Pesa/SMS Code:</span>
                  <span class="font-mono px-1.5 py-0.5 rounded bg-purple-950 text-amber-300 border border-purple-600/60 font-bold text-[11px]">
                    ${o.transaction_reference || 'Pending Code'}
                  </span>
                </div>
                <span class="text-gray-600">&bull;</span>
                <div class="flex items-center gap-1 text-xs">
                  <span class="text-gray-400 text-[11px]">Payer:</span>
                  <span class="font-semibold text-white truncate max-w-[140px]" title="${o.payer_name_or_number || o.full_name}">
                    ${o.payer_name_or_number || o.full_name || '—'}
                  </span>
                </div>
              </div>

              ${o.payment_message ? `
                <div class="mt-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2 py-1.5 text-[10px] text-emerald-200">
                  <span class="font-bold uppercase tracking-wide">M-Pesa callback:</span> ${o.payment_message}
                </div>
              ` : ''}
            </div>

            <!-- Verification Action Button -->
            <button data-verify-modal-btn="true" data-id="${o.id}" data-no="${o.order_number}" data-amount="${totalNum}" data-cust="${o.full_name || 'Walk-in'}" data-phone="${o.phone || ''}" data-code="${o.transaction_reference || ''}" data-payer="${o.payer_name_or_number || o.full_name || ''}" class="shrink-0 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-900/30 transition-all cursor-pointer">
              <span>📱</span>
              <span>${o.transaction_reference ? 'Verify & Mark Paid' : 'Record M-Pesa Code'}</span>
            </button>
          </div>
        `;
      }).join('');

      container.querySelectorAll('[data-verify-modal-btn]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const b = e.currentTarget;
          openCashierVerifyModal({
            id: b.getAttribute('data-id'),
            order_number: b.getAttribute('data-no'),
            amount: b.getAttribute('data-amount'),
            cust: b.getAttribute('data-cust'),
            phone: b.getAttribute('data-phone'),
            code: b.getAttribute('data-code'),
            payer: b.getAttribute('data-payer')
          });
        });
      });
    }
  } catch (e) {
    console.warn('Failed to load pending verifications:', e);
  }
}

function openCashierVerifyModal(order) {
  const modal = document.getElementById('cashier-verify-code-modal');
  if (!modal) return;

  const idInput = document.getElementById('cashier-verify-order-id');
  const noInput = document.getElementById('cashier-verify-order-no');
  const subEl = document.getElementById('cashier-verify-modal-subtitle');
  const custEl = document.getElementById('cashier-verify-cust');
  const phoneEl = document.getElementById('cashier-verify-phone');
  const amtEl = document.getElementById('cashier-verify-amount');
  const codeInput = document.getElementById('cashier-verify-code-input');
  const payerInput = document.getElementById('cashier-verify-payer-input');

  if (idInput) idInput.value = order.id || '';
  if (noInput) noInput.value = order.order_number || '';
  if (subEl) subEl.textContent = `Order #${order.order_number || order.id}`;
  if (custEl) custEl.textContent = order.cust || 'Walk-in Customer';
  if (phoneEl) phoneEl.textContent = order.phone || '—';
  if (amtEl) amtEl.textContent = `KSh ${Number(order.amount || 0).toLocaleString()}`;
  if (codeInput) {
    codeInput.value = order.code || '';
    setTimeout(() => codeInput.focus(), 100);
  }
  if (payerInput) payerInput.value = order.payer || order.cust || '';

  modal.classList.remove('hidden');
}

document.getElementById('close-cashier-verify-modal')?.addEventListener('click', () => {
  document.getElementById('cashier-verify-code-modal')?.classList.add('hidden');
});

document.getElementById('cashier-verify-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const orderId = document.getElementById('cashier-verify-order-id')?.value;
  const orderNo = document.getElementById('cashier-verify-order-no')?.value;
  const code = document.getElementById('cashier-verify-code-input')?.value.trim().toUpperCase();
  const payer = document.getElementById('cashier-verify-payer-input')?.value.trim();
  const btn = document.getElementById('cashier-verify-submit-btn');

  if (!code) {
    UI.showToast("Please enter the M-Pesa / SMS confirmation code.", "Code Required", "error");
    document.getElementById('cashier-verify-code-input')?.focus();
    return;
  }

  await verifyOrderPayment(orderId, orderNo, btn, code, payer);
  document.getElementById('cashier-verify-code-modal')?.classList.add('hidden');
});

async function verifyOrderPayment(orderId, orderNo, btnEl, code = null, payer = null) {
  if (btnEl) {
    UI.setButtonLoading(btnEl, true, 'Verifying...');
  }

  try {
    const payload = {};
    if (code) payload.transaction_reference = code;
    if (payer) payload.payer_name_or_number = payer;
    payload.payment_method = 'mpesa';

    const res = await fetch(`/api/cashier/orders/${orderId}/verify-payment`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success) {
      const codeMsg = data.transaction_reference ? ` (Code: ${data.transaction_reference})` : '';
      UI.showToast(`Order #${orderNo || orderId} payment confirmed & marked as PAID${codeMsg}!`, "Payment Verified", "success");
      await loadPendingVerifications();
    } else {
      UI.showToast(data.error || 'Failed to verify payment.', "Verification Error", "error");
    }
  } catch (err) {
    UI.showToast('Server error during payment verification.', "Error", "error");
  } finally {
    if (btnEl) {
      UI.setButtonLoading(btnEl, false);
    }
  }
}

function formatTimeAgo(dateStr) {
  if (!dateStr) return 'just now';
  const diffSec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  return `${diffHrs}h ago`;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDashboard);
} else {
  initDashboard();
}

async function loadPosProducts() {
  const container = document.getElementById('pos-product-grid');
  if (!container) return;

  UI.renderSkeletonGrid(container, 8);

  try {
    const res = await fetch('/api/cashier/products', { credentials: 'include' });
    const data = await res.json();
    posProducts = data.products || [];
    renderProductGrid();
  } catch (e) {
    console.error('Failed to load POS catalog', e);
    container.innerHTML = `<div class="col-span-full py-12 text-center text-xs text-red-500 font-semibold">Failed to load product catalog.</div>`;
  }
}

function renderProductGrid() {
  const container = document.getElementById('pos-product-grid');
  if (!container) return;

  const filtered = posProducts.filter(p => {
    const pCat = (p.category || p.category_name || '').toLowerCase();
    const matchCat = selectedCategory === 'all' || pCat.includes(selectedCategory);
    const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  if (filtered.length === 0) {
    UI.renderEmptyState(container, {
      icon: '🛍️',
      title: 'No POS Items Match Filter',
      message: 'Try adjusting your search query or category filter.'
    });
    return;
  }

  container.innerHTML = filtered.map(p => {
    const isOut = p.stock_quantity <= 0;
    const priceNum = typeof p.price === 'number' ? p.price : (parseFloat(p.price) || 0);

    return `
      <div data-add-prod="${p.id}" class="bg-white rounded-2xl p-3 border border-gray-200 shadow-sm flex flex-col justify-between cursor-pointer hover:border-[#9B72CF] hover:shadow-md transition-all active:scale-[0.97] ${isOut ? 'opacity-60 bg-red-50/20' : ''}">
        <div class="space-y-2">
          <div class="relative aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-100">
            <img src="${p.image}" alt="${p.name}" class="w-full h-full object-cover">
            <span class="absolute bottom-1 right-1 px-2 py-0.5 text-[9px] font-bold rounded-md ${isOut ? 'bg-red-600 text-white' : (p.stock_quantity <= 5 ? 'bg-amber-500 text-white' : 'bg-gray-900/80 text-white')}">
              ${isOut ? 'OUT OF STOCK' : `Stock: ${p.stock_quantity}`}
            </span>
          </div>

          <div>
            <span class="text-[9px] font-bold uppercase tracking-wider text-[#9B72CF] block">${p.category || p.category_name || 'General'}</span>
            <h4 class="font-bold text-xs text-gray-900 line-clamp-1 leading-tight mt-0.5">${p.name}</h4>
          </div>
        </div>

        <div class="pt-2 flex items-center justify-between border-t border-gray-100 mt-2">
          <span class="font-bold text-xs text-gray-900">KSh ${priceNum.toLocaleString()}</span>
          <button class="w-7 h-7 rounded-xl ${isOut ? 'bg-red-200 text-red-500' : 'bg-gray-900 hover:bg-[#9B72CF] text-white'} font-bold text-xs flex items-center justify-center transition-colors">
            +
          </button>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('[data-add-prod]').forEach(card => {
    card.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-add-prod');
      const prod = posProducts.find(p => p.id === id);
      if (prod) {
        if (prod.stock_quantity <= 0) {
          UI.showToast(`"${prod.name}" is currently OUT OF STOCK. Use "+ Add Product" or "Restock Excel" to restock.`, "Out of Stock", "error");
          return;
        }
        addToCart(prod);
      }
    });
  });
}

function addToCart(product) {
  const existingIdx = posCart.findIndex(i => i.id === product.id);
  if (existingIdx > -1) {
    if (posCart[existingIdx].quantity < product.stock_quantity) {
      posCart[existingIdx].quantity += 1;
    } else {
      UI.showToast(`Cannot add more than available stock (${product.stock_quantity}).`, "Stock Limit", "error");
    }
  } else {
    posCart.push({
      id: product.id,
      product_id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      stock_quantity: product.stock_quantity,
      quantity: 1
    });
  }
  renderCart();
}

function updateQuantity(index, delta) {
  if (index < 0 || index >= posCart.length) return;
  const newQty = posCart[index].quantity + delta;

  if (newQty <= 0) {
    posCart.splice(index, 1);
  } else if (newQty <= posCart[index].stock_quantity) {
    posCart[index].quantity = newQty;
  } else {
    UI.showToast(`Cannot exceed available stock (${posCart[index].stock_quantity}).`, "Stock Limit", "error");
  }
  renderCart();
}

function removeFromCart(index) {
  if (index < 0 || index >= posCart.length) return;
  posCart.splice(index, 1);
  renderCart();
}

function renderCart() {
  const container = document.getElementById('pos-cart-items');
  const subtotalEl = document.getElementById('pos-subtotal-text');
  const taxEl = document.getElementById('pos-tax-text');
  const totalEl = document.getElementById('pos-total-text');
  if (!container) return;

  const subtotal = posCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const tax = subtotal * 0.16;
  const total = subtotal;

  if (subtotalEl) subtotalEl.textContent = `KSh ${subtotal.toLocaleString()}`;
  if (taxEl) taxEl.textContent = `KSh ${Math.round(tax).toLocaleString()}`;
  if (totalEl) totalEl.textContent = `KSh ${total.toLocaleString()}`;

  if (posCart.length === 0) {
    UI.renderEmptyState(container, {
      icon: '🛒',
      title: 'POS Register Empty',
      message: 'Tap products on the left catalog grid to add items to current sale.'
    });
    return;
  }

  container.innerHTML = posCart.map((item, index) => `
    <div class="flex items-center justify-between py-2 gap-2 text-xs">
      <div class="flex items-center gap-2.5 min-w-0 flex-1">
        <img src="${item.image}" alt="${item.name}" class="w-9 h-9 object-cover rounded-lg bg-gray-100 border border-gray-100 shrink-0">
        <div class="min-w-0">
          <h5 class="font-bold text-gray-900 truncate">${item.name}</h5>
          <span class="text-[10px] text-gray-500">KSh ${(item.price * item.quantity).toLocaleString()}</span>
        </div>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <div class="flex items-center border border-gray-200 rounded-lg bg-gray-50">
          <button data-dec="${index}" class="px-2 py-0.5 font-bold hover:bg-gray-200 rounded-l-lg">-</button>
          <span class="px-2.5 font-semibold text-gray-900">${item.quantity}</span>
          <button data-inc="${index}" class="px-2 py-0.5 font-bold hover:bg-gray-200 rounded-r-lg">+</button>
        </div>

        <button data-del="${index}" class="text-gray-400 hover:text-red-500 font-bold p-1">✕</button>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('[data-inc]').forEach(b => {
    b.addEventListener('click', (e) => updateQuantity(parseInt(e.currentTarget.getAttribute('data-inc'), 10), 1));
  });

  container.querySelectorAll('[data-dec]').forEach(b => {
    b.addEventListener('click', (e) => updateQuantity(parseInt(e.currentTarget.getAttribute('data-dec'), 10), -1));
  });

  container.querySelectorAll('[data-del]').forEach(b => {
    b.addEventListener('click', (e) => removeFromCart(parseInt(e.currentTarget.getAttribute('data-del'), 10)));
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
  const searchInput = document.getElementById('pos-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderProductGrid();
    });
  }

  document.querySelectorAll('.pos-cat-pill').forEach(btn => {
    btn.addEventListener('click', (e) => {
      selectedCategory = e.currentTarget.getAttribute('data-cat');
      document.querySelectorAll('.pos-cat-pill').forEach(b => {
        b.className = "pos-cat-pill px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl shrink-0";
      });
      e.currentTarget.className = "pos-cat-pill px-4 py-1.5 bg-[#9B72CF] text-white rounded-xl shadow shrink-0";
      renderProductGrid();
    });
  });

  document.getElementById('pos-clear-cart')?.addEventListener('click', () => {
    posCart = [];
    renderCart();
  });

  document.getElementById('refresh-verif-queue-btn')?.addEventListener('click', () => {
    loadPendingVerifications();
    UI.showToast('SMS verification queue refreshed.', 'Queue Synced', 'info');
  });

  document.querySelectorAll('.pos-pay-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      selectedPaymentMethod = e.currentTarget.getAttribute('data-pay');
      document.querySelectorAll('.pos-pay-btn').forEach(b => {
        b.classList.remove('border-[#9B72CF]', 'bg-purple-50', 'text-[#9B72CF]');
        b.classList.add('border-gray-200', 'bg-white', 'text-gray-700');
      });
      e.currentTarget.classList.remove('border-gray-200', 'bg-white', 'text-gray-700');
      e.currentTarget.classList.add('border-[#9B72CF]', 'bg-purple-50', 'text-[#9B72CF]');

      const mpesaInputs = document.getElementById('pos-mpesa-inputs');
      const pbInputs = document.getElementById('pos-paybill-inputs');

      if (selectedPaymentMethod === 'mpesa_manual') {
        mpesaInputs?.classList.remove('hidden');
        pbInputs?.classList.add('hidden');
        document.getElementById('pos-mpesa-code-input')?.focus();
      } else if (selectedPaymentMethod === 'paybill_manual') {
        pbInputs?.classList.remove('hidden');
        mpesaInputs?.classList.add('hidden');
        document.getElementById('pos-paybill-code-input')?.focus();
      } else {
        mpesaInputs?.classList.add('hidden');
        pbInputs?.classList.add('hidden');
      }
    });
  });

  document.getElementById('pos-complete-sale-btn')?.addEventListener('click', submitPosSale);
  document.getElementById('close-receipt-modal')?.addEventListener('click', () => {
    document.getElementById('receipt-modal')?.classList.add('hidden');
  });

  // 1. ADD SINGLE PRODUCT MODAL HANDLERS
  const openAddBtn = document.getElementById('open-add-product-btn');
  const addModal = document.getElementById('add-product-modal');
  const addForm = document.getElementById('add-product-form');
  const fileInput = document.getElementById('prod-image-file');
  const urlInput = document.getElementById('prod-image-input');
  const previewImg = document.getElementById('prod-image-preview-img');
  const previewPlaceholder = document.getElementById('prod-image-preview-placeholder');

  function resetImagePreview() {
    if (previewImg) {
      previewImg.src = '';
      previewImg.classList.add('hidden');
    }
    if (previewPlaceholder) {
      previewPlaceholder.classList.remove('hidden');
    }
  }

  function showImagePreview(src) {
    if (previewImg && src) {
      previewImg.src = src;
      previewImg.classList.remove('hidden');
      if (previewPlaceholder) previewPlaceholder.classList.add('hidden');
    }
  }

  // Handle local file selection preview
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (loadEvt) => {
          showImagePreview(loadEvt.target.result);
        };
        reader.readAsDataURL(file);
      } else if (urlInput && urlInput.value.trim()) {
        showImagePreview(urlInput.value.trim());
      } else {
        resetImagePreview();
      }
    });
  }

  // Handle image URL input preview
  if (urlInput) {
    urlInput.addEventListener('input', (e) => {
      if ((!fileInput || !fileInput.files.length) && e.target.value.trim()) {
        showImagePreview(e.target.value.trim());
      } else if (!fileInput || !fileInput.files.length) {
        resetImagePreview();
      }
    });
  }

  if (openAddBtn) {
    openAddBtn.addEventListener('click', () => {
      clearInlineErrors();
      addForm?.reset();
      resetImagePreview();
      addModal?.classList.remove('hidden');
    });
  }

  document.getElementById('close-add-product-modal')?.addEventListener('click', () => {
    addModal?.classList.add('hidden');
    resetImagePreview();
  });

  document.getElementById('cancel-add-product')?.addEventListener('click', () => {
    addModal?.classList.add('hidden');
    resetImagePreview();
  });

  if (addForm) {
    addForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearInlineErrors();

      const nameEl = document.getElementById('prod-name-input');
      const priceEl = document.getElementById('prod-price-input');
      const stockEl = document.getElementById('prod-stock-input');
      const submitBtn = e.target.querySelector('button[type="submit"]');

      const name = nameEl.value.trim();
      const category_name = document.getElementById('prod-cat-input')?.value.trim() || 'General';
      const stock_quantity = parseInt(stockEl.value || 0, 10);
      const price = parseFloat(priceEl.value);
      const buying_price = parseFloat(document.getElementById('prod-buying-price-input')?.value || 0);
      const sizes = document.getElementById('prod-sizes-input')?.value.trim() || '';
      const colors = document.getElementById('prod-colors-input')?.value.trim() || '';
      const description = document.getElementById('prod-desc-input')?.value.trim() || '';
      const image_url = urlInput?.value.trim() || '';

      let isValid = true;
      if (!name) {
        showInlineError(nameEl, 'Product name is required.');
        isValid = false;
      }
      if (isNaN(price) || price < 0) {
        showInlineError(priceEl, 'Price must be a positive number.');
        isValid = false;
      }
      if (isNaN(stock_quantity) || stock_quantity < 0) {
        showInlineError(stockEl, 'Stock quantity must be 0 or greater.');
        isValid = false;
      }

      if (!isValid) return;

      const formData = new FormData();
      formData.append('name', name);
      formData.append('category_name', category_name);
      formData.append('stock_quantity', stock_quantity);
      formData.append('price', price);
      formData.append('buying_price', buying_price);
      formData.append('sizes', sizes);
      formData.append('colors', colors);
      formData.append('description', description);
      if (image_url) formData.append('image_url', image_url);

      if (fileInput && fileInput.files && fileInput.files[0]) {
        formData.append('imageFile', fileInput.files[0]);
      }

      UI.setButtonLoading(submitBtn, true, 'Saving Product...');

      try {
        const res = await fetch('/api/cashier/products', {
          method: 'POST',
          credentials: 'include',
          body: formData
        });
        const data = await res.json();
        if (data.success) {
          UI.showToast(data.message || `Product "${name}" added to catalog with picture!`, "Product Created", "success");
          addModal?.classList.add('hidden');
          addForm.reset();
          resetImagePreview();
          await loadPosProducts();
        } else {
          UI.showToast(data.error || 'Failed to add product', "Error", "error");
        }
      } catch (err) {
        UI.showToast('Error creating product', "Error", "error");
      } finally {
        UI.setButtonLoading(submitBtn, false);
      }
    });
  }

  // 2. RESTOCK EXCEL / CSV UPLOAD HANDLERS
  const openRestockBtn = document.getElementById('open-restock-excel-btn');
  if (openRestockBtn) {
    openRestockBtn.addEventListener('click', () => {
      restockParsedRows = [];
      const fileNameEl = document.getElementById('restock-file-name');
      if (fileNameEl) fileNameEl.textContent = 'No file selected';
      document.getElementById('restock-excel-modal')?.classList.remove('hidden');
    });
  }

  document.getElementById('close-restock-excel-modal')?.addEventListener('click', () => {
    document.getElementById('restock-excel-modal')?.classList.add('hidden');
  });

  document.getElementById('cancel-restock-excel')?.addEventListener('click', () => {
    document.getElementById('restock-excel-modal')?.classList.add('hidden');
  });

  document.getElementById('download-restock-template-btn')?.addEventListener('click', () => {
    downloadSampleCsv(
      "Product Name,Category,Price,Buying Price,Stock Quantity,Add Stock,Sizes,Colors\n" +
      "Celestial Damask Rose Body Oil,Skincare,12500,5500,30,10,\"30 ml, 50 ml\",\n" +
      "Italian Oxford Shoes (Men),Shoes,28000,12000,15,5,\"EU 42, EU 44\",\"Mahogany Brown, Black\"\n",
      "Restock_Inventory_Template.csv"
    );
  });

  const restockInput = document.getElementById('restock-file-input');
  if (restockInput) {
    restockInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      document.getElementById('restock-file-name').textContent = file.name;
      const reader = new FileReader();

      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.SheetNames[0];
          restockParsedRows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet]);
        } catch (err) {
          UI.showToast('Failed to parse Excel file.', "File Error", "error");
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  const submitRestockBtn = document.getElementById('submit-restock-excel');
  if (submitRestockBtn) {
    submitRestockBtn.addEventListener('click', async () => {
      if (restockParsedRows.length === 0) {
        UI.showToast("Please select a valid Excel or CSV file containing inventory rows.", "No File", "error");
        return;
      }

      UI.setButtonLoading(submitRestockBtn, true, 'Importing...');

      try {
        const res = await fetch('/api/cashier/upload-inventory-excel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ items: restockParsedRows })
        });

        const data = await res.json();
        if (data.success) {
          UI.showToast(data.message, "Restock Success", "success");
          document.getElementById('restock-excel-modal')?.classList.add('hidden');
          await loadPosProducts();
        } else {
          UI.showToast(data.error || 'Failed to process restock upload.', "Upload Error", "error");
        }
      } catch (err) {
        UI.showToast('Error uploading restock Excel file.', "Upload Error", "error");
      } finally {
        UI.setButtonLoading(submitRestockBtn, false);
      }
    });
  }

  // 3. OFFLINE SALES EXCEL / CSV UPLOAD HANDLERS
  const openSalesBtn = document.getElementById('open-offline-sales-btn');
  if (openSalesBtn) {
    openSalesBtn.addEventListener('click', () => {
      salesParsedRows = [];
      const fileNameEl = document.getElementById('sales-file-name');
      if (fileNameEl) fileNameEl.textContent = 'No file selected';
      document.getElementById('offline-sales-modal')?.classList.remove('hidden');
    });
  }

  document.getElementById('close-offline-sales-modal')?.addEventListener('click', () => {
    document.getElementById('offline-sales-modal')?.classList.add('hidden');
  });

  document.getElementById('cancel-offline-sales')?.addEventListener('click', () => {
    document.getElementById('offline-sales-modal')?.classList.add('hidden');
  });

  document.getElementById('download-sales-template-btn')?.addEventListener('click', () => {
    downloadSampleCsv(
      "Product Name,Quantity,Unit Price,Payment Method,Customer Name,Phone\n" +
      "Celestial Rose 24K Gold Youth Serum,2,14500,cash,John Smith,0712345678\n" +
      "Imperial Italian Leather Oxfords (Men),1,28000,mpesa,Walk-in VIP,0799887766\n",
      "Offline_Sales_Template.csv"
    );
  });

  const salesInput = document.getElementById('sales-file-input');
  if (salesInput) {
    salesInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      document.getElementById('sales-file-name').textContent = file.name;
      const reader = new FileReader();

      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.SheetNames[0];
          salesParsedRows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet]);
        } catch (err) {
          UI.showToast('Failed to parse Excel file.', "File Error", "error");
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  const submitSalesBtn = document.getElementById('submit-offline-sales');
  if (submitSalesBtn) {
    submitSalesBtn.addEventListener('click', async () => {
      if (salesParsedRows.length === 0) {
        UI.showToast("Please select a valid Excel or CSV file containing sales rows.", "No File", "error");
        return;
      }

      UI.setButtonLoading(submitSalesBtn, true, 'Importing...');

      try {
        const res = await fetch('/api/cashier/upload-offline-sales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ sales: salesParsedRows })
        });

        const data = await res.json();
        if (data.success) {
          UI.showToast(data.message, "Import Success", "success");
          document.getElementById('offline-sales-modal')?.classList.add('hidden');
          await loadPosProducts();
        } else {
          UI.showToast(data.error || 'Failed to process sales upload.', "Import Error", "error");
        }
      } catch (err) {
        UI.showToast('Error importing sales file.', "Import Error", "error");
      } finally {
        UI.setButtonLoading(submitSalesBtn, false);
      }
    });
  }
}

function downloadSampleCsv(content, filename) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

let posPendingOrderId = null;
let posPollingInterval = null;
let posPollingSecondsLeft = 60;
let posActiveSaleData = null;

function stopPosPolling() {
  if (posPollingInterval) {
    clearInterval(posPollingInterval);
    posPollingInterval = null;
  }
}

async function startPosMpesaPolling(orderId, orderNumber, custName, custPhone, total, items, paymentMode) {
  stopPosPolling();
  posPollingSecondsLeft = 60;
  posPendingOrderId = orderId;
  posActiveSaleData = { orderId, orderNumber, custName, custPhone, total, items: [...items], paymentMode };

  const modal = document.getElementById('pos-mpesa-modal');
  const waitingContainer = document.getElementById('pos-mpesa-waiting-container');
  const failureContainer = document.getElementById('pos-mpesa-failure-container');
  const nameEl = document.getElementById('pos-mpesa-cust-name');
  const phoneEl = document.getElementById('pos-mpesa-cust-phone');
  const amountEl = document.getElementById('pos-mpesa-amount');
  const progressBar = document.getElementById('pos-mpesa-progress-bar');
  const countdownEl = document.getElementById('pos-mpesa-countdown');

  if (nameEl) nameEl.textContent = custName;
  if (phoneEl) phoneEl.textContent = custPhone;
  if (amountEl) amountEl.textContent = `KSh ${parseFloat(total).toLocaleString()}`;

  failureContainer?.classList.add('hidden');
  waitingContainer?.classList.remove('hidden');
  modal?.classList.remove('hidden');

  const updateCountdownUI = () => {
    const percent = Math.max(0, (posPollingSecondsLeft / 60) * 100);
    if (progressBar) progressBar.style.width = `${percent}%`;
    if (countdownEl) countdownEl.textContent = `Awaiting customer PIN (${posPollingSecondsLeft}s)...`;
  };

  updateCountdownUI();

  let pollsCompleted = 0;
  const maxPolls = 30; // 60 seconds

  posPollingInterval = setInterval(async () => {
    pollsCompleted++;
    posPollingSecondsLeft = Math.max(0, 60 - (pollsCompleted * 2));
    updateCountdownUI();

    try {
      const res = await fetch(`/api/orders/${orderId}/status`);
      const data = await res.json();

      if (data.success) {
        if (data.payment_status === 'paid') {
          stopPosPolling();
          const paidMsg = data.payment_message || 'M-Pesa payment received! Sale completed.';
          UI.showToast(paidMsg, 'Payment Confirmed', 'success');
          handlePosPaymentSuccess();
          return;
        } else if (data.payment_status === 'failed') {
          stopPosPolling();
          const failMsg = data.payment_message || 'Customer cancelled the prompt or entered an incorrect PIN.';
          handlePosPaymentFailure(failMsg);
          return;
        }
      }
    } catch (e) {
      console.warn('POS polling error:', e);
    }

    if (pollsCompleted >= maxPolls) {
      stopPosPolling();
      handlePosPaymentFailure("M-Pesa request timed out without PIN entry. Choose an option below to proceed.");
    }
  }, 2000);
}

function handlePosPaymentSuccess() {
  const modal = document.getElementById('pos-mpesa-modal');
  modal?.classList.add('hidden');

  if (posActiveSaleData) {
    showReceiptModal(
      posActiveSaleData.orderNumber,
      posActiveSaleData.custName,
      'mpesa',
      posActiveSaleData.total,
      posActiveSaleData.items,
      posActiveSaleData.paymentMode || 'simulation'
    );

    // Decrement catalog grid in UI
    posActiveSaleData.items.forEach(item => {
      const prod = posProducts.find(p => p.id === (item.product_id || item.id));
      if (prod) {
        prod.stock_quantity = Math.max(0, prod.stock_quantity - item.quantity);
      }
    });
  }

  posCart = [];
  renderCart();
  renderProductGrid();

  if (document.getElementById('cust-name-input')) document.getElementById('cust-name-input').value = '';
  if (document.getElementById('cust-phone-input')) document.getElementById('cust-phone-input').value = '';

  UI.showToast("M-Pesa payment received! Sale completed.", "Sale Confirmed", "success");
}

function handlePosPaymentFailure(reason) {
  const waitingContainer = document.getElementById('pos-mpesa-waiting-container');
  const failureContainer = document.getElementById('pos-mpesa-failure-container');
  const failReasonEl = document.getElementById('pos-mpesa-fail-reason');

  waitingContainer?.classList.add('hidden');
  if (failReasonEl && reason) failReasonEl.textContent = reason;
  failureContainer?.classList.remove('hidden');

  const btn = document.getElementById('pos-complete-sale-btn');
  UI.setButtonLoading(btn, false);
}

async function submitPosSale() {
  if (posCart.length === 0) {
    UI.showToast("Please add at least one product to the sale cart.", "Empty Register", "error");
    return;
  }

  const custName = document.getElementById('cust-name-input')?.value.trim() || 'Walk-in Customer';
  const custPhone = document.getElementById('cust-phone-input')?.value.trim() || '';

  if (selectedPaymentMethod === 'mpesa' && !custPhone) {
    UI.showToast("Customer phone number is required for M-Pesa STK push.", "Phone Required", "error");
    document.getElementById('cust-phone-input')?.focus();
    return;
  }

  const subtotal = posCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const payload = {
    items: posCart.map(i => ({
      product_id: i.id,
      id: i.id,
      name: i.name,
      quantity: i.quantity,
      price: i.price
    })),
    payment_method: selectedPaymentMethod,
    customer_name: custName,
    customer_phone: custPhone || '—',
    subtotal: subtotal,
    total: subtotal
  };

  if (selectedPaymentMethod === 'mpesa_manual') {
    const mpCode = document.getElementById('pos-mpesa-code-input')?.value.trim();
    const mpPayer = document.getElementById('pos-mpesa-payer-input')?.value.trim();

    if (!mpCode) {
      UI.showToast("M-Pesa SMS confirmation transaction code is required.", "Transaction Code Required", "error");
      document.getElementById('pos-mpesa-code-input')?.focus();
      return;
    }

    payload.payment_method = 'mpesa';
    payload.transaction_reference = mpCode.toUpperCase();
    payload.payer_name_or_number = mpPayer || custName;
  } else if (selectedPaymentMethod === 'paybill_manual') {
    const pbCode = document.getElementById('pos-paybill-code-input')?.value.trim();
    const pbPayer = document.getElementById('pos-paybill-payer-input')?.value.trim();

    if (!pbCode) {
      UI.showToast("SMS confirmation transaction code is required for Paybill sales.", "Transaction Code Required", "error");
      document.getElementById('pos-paybill-code-input')?.focus();
      return;
    }

    payload.transaction_reference = pbCode.toUpperCase();
    payload.payer_name_or_number = pbPayer || custName;
  }

  const btn = document.getElementById('pos-complete-sale-btn');
  UI.setButtonLoading(btn, true, selectedPaymentMethod === 'mpesa' ? 'Prompting customer phone...' : 'Completing Sale...');

  try {
    const res = await fetch('/api/cashier/sale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (data.success) {
      if (selectedPaymentMethod === 'mpesa') {
        // Trigger STK push and start POS polling
        try {
          const pushRes = await fetch('/api/payments/mpesa-stk-push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: data.orderId,
              phone: custPhone,
              amount: subtotal
            })
          });

          const pushData = await pushRes.json();
          if (!pushData.success) {
            throw new Error(pushData.error || 'Failed to trigger M-Pesa STK push.');
          }

          startPosMpesaPolling(
            data.orderId,
            data.order_number,
            custName,
            pushData.phone || custPhone,
            subtotal,
            posCart,
            data.payment_mode || 'simulation'
          );

        } catch (pushErr) {
          UI.setButtonLoading(btn, false);
          handlePosPaymentFailure(pushErr.message || 'Error triggering STK prompt on customer phone.');
        }
      } else {
        // Cash / Card / Paybill / M-Pesa Manual: Instant completion
        showReceiptModal(
          data.order_number, 
          custName, 
          (selectedPaymentMethod === 'mpesa_manual' ? 'mpesa' : selectedPaymentMethod), 
          subtotal, 
          posCart, 
          data.payment_mode || 'simulation',
          payload.transaction_reference || data.transaction_reference,
          payload.payer_name_or_number || data.payer_name_or_number
        );
        
        // Decrement catalog grid in UI
        posCart.forEach(item => {
          const prod = posProducts.find(p => p.id === item.id);
          if (prod) {
            prod.stock_quantity = Math.max(0, prod.stock_quantity - item.quantity);
          }
        });

        posCart = [];
        renderCart();
        renderProductGrid();

        if (document.getElementById('cust-name-input')) document.getElementById('cust-name-input').value = '';
        if (document.getElementById('cust-phone-input')) document.getElementById('cust-phone-input').value = '';
        if (document.getElementById('pos-mpesa-code-input')) document.getElementById('pos-mpesa-code-input').value = '';
        if (document.getElementById('pos-mpesa-payer-input')) document.getElementById('pos-mpesa-payer-input').value = '';
        if (document.getElementById('pos-paybill-code-input')) document.getElementById('pos-paybill-code-input').value = '';
        if (document.getElementById('pos-paybill-payer-input')) document.getElementById('pos-paybill-payer-input').value = '';

        await loadPendingVerifications();
      }

    } else {
      UI.showToast(data.error || 'Failed to complete sale transaction.', "POS Error", "error");
    }
  } catch (err) {
    UI.showToast('Server connection error completing POS sale.', "POS Error", "error");
  } finally {
    if (selectedPaymentMethod !== 'mpesa') {
      UI.setButtonLoading(btn, false);
    }
  }
}

// Attach POS M-Pesa Modal Listeners
document.getElementById('close-pos-mpesa-modal')?.addEventListener('click', () => {
  stopPosPolling();
  document.getElementById('pos-mpesa-modal')?.classList.add('hidden');
  const btn = document.getElementById('pos-complete-sale-btn');
  UI.setButtonLoading(btn, false);
});

// POS Retry STK Push
document.getElementById('pos-retry-stk-btn')?.addEventListener('click', async () => {
  if (!posActiveSaleData) return;
  const waitingContainer = document.getElementById('pos-mpesa-waiting-container');
  const failureContainer = document.getElementById('pos-mpesa-failure-container');

  failureContainer?.classList.add('hidden');
  waitingContainer?.classList.remove('hidden');

  try {
    const res = await fetch('/api/payments/mpesa-stk-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: posActiveSaleData.orderId,
        phone: posActiveSaleData.custPhone,
        amount: posActiveSaleData.total
      })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    startPosMpesaPolling(
      posActiveSaleData.orderId,
      posActiveSaleData.orderNumber,
      posActiveSaleData.custName,
      data.phone || posActiveSaleData.custPhone,
      posActiveSaleData.total,
      posActiveSaleData.items,
      posActiveSaleData.paymentMode
    );
  } catch (err) {
    handlePosPaymentFailure(err.message || 'Failed to retry STK push');
  }
});

// POS STK Modal: Toggle Manual Code Entry Box
document.getElementById('pos-toggle-manual-code-btn')?.addEventListener('click', () => {
  const box = document.getElementById('pos-mpesa-modal-code-box');
  if (box) {
    box.classList.toggle('hidden');
    if (!box.classList.contains('hidden')) {
      document.getElementById('pos-modal-mpesa-code')?.focus();
    }
  }
});

// POS STK Modal: Confirm M-Pesa Payment via Manual Code
document.getElementById('pos-modal-confirm-code-btn')?.addEventListener('click', async () => {
  if (!posActiveSaleData) return;
  const code = document.getElementById('pos-modal-mpesa-code')?.value.trim().toUpperCase();
  const payer = document.getElementById('pos-modal-mpesa-payer')?.value.trim();
  const confirmBtn = document.getElementById('pos-modal-confirm-code-btn');

  if (!code) {
    UI.showToast("Please enter the customer's M-Pesa transaction code.", "Code Required", "error");
    document.getElementById('pos-modal-mpesa-code')?.focus();
    return;
  }

  UI.setButtonLoading(confirmBtn, true, 'Confirming...');

  try {
    const res = await fetch(`/api/cashier/orders/${posActiveSaleData.orderId}/verify-payment`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        transaction_reference: code,
        payer_name_or_number: payer || posActiveSaleData.custName,
        payment_method: 'mpesa'
      })
    });

    const data = await res.json();
    if (data.success) {
      stopPosPolling();
      document.getElementById('pos-mpesa-modal')?.classList.add('hidden');

      showReceiptModal(
        posActiveSaleData.orderNumber,
        posActiveSaleData.custName,
        'mpesa',
        posActiveSaleData.total,
        posActiveSaleData.items,
        posActiveSaleData.paymentMode,
        code,
        payer || posActiveSaleData.custName
      );

      // Decrement stock in catalog
      posActiveSaleData.items.forEach(item => {
        const prod = posProducts.find(p => p.id === (item.product_id || item.id));
        if (prod) prod.stock_quantity = Math.max(0, prod.stock_quantity - item.quantity);
      });

      posCart = [];
      renderCart();
      renderProductGrid();

      if (document.getElementById('cust-name-input')) document.getElementById('cust-name-input').value = '';
      if (document.getElementById('cust-phone-input')) document.getElementById('cust-phone-input').value = '';
      if (document.getElementById('pos-modal-mpesa-code')) document.getElementById('pos-modal-mpesa-code').value = '';
      if (document.getElementById('pos-modal-mpesa-payer')) document.getElementById('pos-modal-mpesa-payer').value = '';

      UI.showToast(`M-Pesa payment confirmed with code ${code}!`, "Sale Completed", "success");
      await loadPendingVerifications();
    } else {
      UI.showToast(data.error || 'Failed to verify M-Pesa payment.', "Error", "error");
    }
  } catch (err) {
    UI.showToast("Server error verifying M-Pesa payment.", "Error", "error");
  } finally {
    UI.setButtonLoading(confirmBtn, false);
  }
});

// POS Switch to Cash
document.getElementById('pos-switch-cash-btn')?.addEventListener('click', async () => {
  if (!posActiveSaleData) return;
  stopPosPolling();

  try {
    await fetch('/api/payments/switch-method', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: posActiveSaleData.orderId, payment_method: 'cash' })
    });

    document.getElementById('pos-mpesa-modal')?.classList.add('hidden');
    showReceiptModal(
      posActiveSaleData.orderNumber,
      posActiveSaleData.custName,
      'cash',
      posActiveSaleData.total,
      posActiveSaleData.items,
      posActiveSaleData.paymentMode
    );

    // Decrement stock in catalog
    posActiveSaleData.items.forEach(item => {
      const prod = posProducts.find(p => p.id === (item.product_id || item.id));
      if (prod) prod.stock_quantity = Math.max(0, prod.stock_quantity - item.quantity);
    });

    posCart = [];
    renderCart();
    renderProductGrid();

    if (document.getElementById('cust-name-input')) document.getElementById('cust-name-input').value = '';
    if (document.getElementById('cust-phone-input')) document.getElementById('cust-phone-input').value = '';

    UI.showToast("Payment switched to Cash. Sale completed!", "Cash Sale Complete", "success");

  } catch (e) {
    UI.showToast("Error switching payment method to Cash.", "Error", "error");
  }
});

// POS Switch to Card
document.getElementById('pos-switch-card-btn')?.addEventListener('click', async () => {
  if (!posActiveSaleData) return;
  stopPosPolling();

  try {
    await fetch('/api/payments/switch-method', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: posActiveSaleData.orderId, payment_method: 'card' })
    });

    document.getElementById('pos-mpesa-modal')?.classList.add('hidden');
    showReceiptModal(
      posActiveSaleData.orderNumber,
      posActiveSaleData.custName,
      'card',
      posActiveSaleData.total,
      posActiveSaleData.items,
      posActiveSaleData.paymentMode
    );

    // Decrement stock in catalog
    posActiveSaleData.items.forEach(item => {
      const prod = posProducts.find(p => p.id === (item.product_id || item.id));
      if (prod) prod.stock_quantity = Math.max(0, prod.stock_quantity - item.quantity);
    });

    posCart = [];
    renderCart();
    renderProductGrid();

    if (document.getElementById('cust-name-input')) document.getElementById('cust-name-input').value = '';
    if (document.getElementById('cust-phone-input')) document.getElementById('cust-phone-input').value = '';

    UI.showToast("Payment switched to Card. Sale completed!", "Card Sale Complete", "success");

  } catch (e) {
    UI.showToast("Error switching payment method to Card.", "Error", "error");
  }
});

function showReceiptModal(orderNumber, custName, paymentMethod, total, items, paymentMode = 'simulation', txRef = null, payerInfo = null) {
  const modal = document.getElementById('receipt-modal');
  const orderNoEl = document.getElementById('receipt-order-no');
  const summaryBox = document.getElementById('receipt-summary-box');
  if (!modal) return;

  const receiptOrder = {
    order_number: orderNumber,
    full_name: custName,
    payment_method: paymentMethod,
    payment_status: 'paid',
    transaction_reference: txRef || null,
    payer_name_or_number: payerInfo || null,
    subtotal: total,
    shipping: 0,
    total,
    items: items.map(item => ({
      name: item.name,
      quantity: item.quantity,
      price_at_purchase: item.price
    }))
  };
  document.getElementById('print-receipt-modal')?.replaceWith(document.getElementById('print-receipt-modal')?.cloneNode(true));
  document.getElementById('print-receipt-modal')?.addEventListener('click', () => printReceipt(receiptOrder, receiptSettings));

  if (orderNoEl) orderNoEl.textContent = `Order #${orderNumber}`;

  const isSimulated = paymentMode === 'simulation' || ['mpesa', 'card'].includes((paymentMethod || '').toLowerCase());

  if (summaryBox) {
    summaryBox.innerHTML = `
      <div class="flex justify-between border-b border-gray-200 pb-2">
        <span class="text-gray-500">Cashier:</span>
        <span class="font-bold text-gray-900">${activeCashier ? activeCashier.name : 'Cashier'}</span>
      </div>
      <div class="flex justify-between border-b border-gray-200 pb-2">
        <span class="text-gray-500">Customer:</span>
        <span class="font-bold text-gray-900">${custName}</span>
      </div>
      <div class="flex justify-between border-b border-gray-200 pb-2">
        <span class="text-gray-500">Payment Method:</span>
        <span class="font-bold text-emerald-700 uppercase">${paymentMethod}</span>
      </div>
      ${txRef ? `
        <div class="flex justify-between border-b border-gray-200 pb-2">
          <span class="text-gray-500">M-Pesa Tx Code:</span>
          <span class="font-mono font-bold text-purple-700">${txRef}</span>
        </div>
      ` : ''}
      ${payerInfo ? `
        <div class="flex justify-between border-b border-gray-200 pb-2">
          <span class="text-gray-500">Payer Details:</span>
          <span class="font-medium text-gray-800">${payerInfo}</span>
        </div>
      ` : ''}
      ${isSimulated && !txRef ? `
        <div class="p-2.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-[11px] font-semibold text-center flex items-center justify-center gap-1.5 my-1 shadow-sm">
          <span>⚠️ This order used simulated payment for testing purposes.</span>
        </div>
      ` : ''}
      <div class="py-1">
        <span class="font-bold text-gray-900 block mb-1">Purchased Items:</span>
        ${items.map(i => `
          <div class="flex justify-between text-[11px] text-gray-600">
            <span>${i.quantity}x ${i.name}</span>
            <span>KSh ${(i.price * i.quantity).toLocaleString()}</span>
          </div>
        `).join('')}
      </div>
      <div class="flex justify-between pt-2 border-t border-gray-300 font-bold text-sm text-gray-900">
        <span>Total Paid:</span>
        <span class="text-[#9B72CF]">KSh ${total.toLocaleString()}</span>
      </div>
    `;
  }

  modal.classList.remove('hidden');
  setTimeout(() => printReceipt(receiptOrder, receiptSettings), 150);
}
