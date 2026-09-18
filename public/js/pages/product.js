/**
 * Crystal Crest - Product Details, Shoe Variants & Spa Booking Logic (product.js)
 * KSh Shillings currency, Shoes Target Group (Men/Women/Children) & Variant Colors, Spa Session Slot Booking.
 */

import { UI } from '../shared/ui.js';
import { ApiService } from '../shared/api.js';
import { CartStore } from '../shared/cart.js';

let currentProduct = null;
let selectedSize = null;
let selectedShade = null;
let selectedSpaDate = new Date().toISOString().split('T')[0];
let selectedSpaTime = null;
let quantity = 1;

document.addEventListener('DOMContentLoaded', async () => {
  UI.initHeader('shop');
  UI.initFooter();
  UI.startCountdownTicker();

  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get('id') || 'prod-gold-serum-001';

  try {
    currentProduct = await ApiService.getProductById(productId);
    renderProductDetails(currentProduct);
    loadRelatedProducts(currentProduct);
  } catch (e) {
    console.error('Failed to load product details', e);
  }

  document.addEventListener('countdown-expired', async () => {
    try {
      currentProduct = await ApiService.getProductById(productId);
      renderProductDetails(currentProduct);
    } catch (e) {}
  }, { passive: true });

  setupEventListeners();
});

function renderProductDetails(product) {
  const categoryName = product.category || product.category_name || 'Cosmetics';
  const priceNum = typeof product.price === 'number' ? product.price : (parseFloat(product.price) || 0);

  // Breadcrumbs & Header
  document.getElementById('breadcrumb-category').textContent = categoryName;
  document.getElementById('breadcrumb-title').textContent = product.name;

  document.getElementById('product-category-tag').textContent = categoryName;
  document.getElementById('product-title').textContent = product.name;
  document.getElementById('product-rating-num').textContent = product.rating || 4.9;
  document.getElementById('product-reviews-count').textContent = `${product.review_count || product.reviewCount || 48} Verified Customer Reviews`;
  
  // Format Price in KSh
  document.getElementById('product-price').textContent = `KSh ${priceNum.toLocaleString()}`;

  if (product.originalPrice || product.original_price) {
    const orig = parseFloat(product.originalPrice || product.original_price);
    const origEl = document.getElementById('product-original-price');
    origEl.textContent = `KSh ${orig.toLocaleString()}`;
    origEl.classList.remove('hidden');
  } else {
    document.getElementById('product-original-price')?.classList.add('hidden');
  }

  const discountBadge = document.getElementById('product-discount-badge');
  const discountExpiry = document.getElementById('product-discount-expiry');
  discountExpiry.removeAttribute('data-countdown-expires');
  discountExpiry.removeAttribute('data-countdown-expired');
  if (product.discount_active && product.discount_percentage) {
    discountBadge.textContent = `-${Math.round(product.discount_percentage)}%`;
    discountBadge.classList.remove('hidden');
    if (product.discount_expires_at) {
      discountExpiry.setAttribute('data-countdown-expires', product.discount_expires_at);
      discountExpiry.textContent = `Ends in ${UI.formatCountdown(product.discount_expires_at) || ''}`;
      discountExpiry.classList.remove('hidden');
    }
  } else {
    discountBadge.classList.add('hidden');
    discountExpiry.classList.add('hidden');
  }

  document.getElementById('product-short-desc').textContent = product.description || product.shortDescription || '';

  // Gallery
  const mainImage = document.getElementById('main-product-image');
  const mainImgUrl = (product.images && product.images[0]) || product.image || 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80';
  mainImage.src = mainImgUrl;

  const thumbsContainer = document.getElementById('product-thumbnails');
  const galleryImages = (product.images && product.images.length > 0) ? product.images : [mainImgUrl];

  thumbsContainer.innerHTML = galleryImages.map((imgUrl, idx) => `
    <button class="thumb-btn w-16 h-16 rounded-xl overflow-hidden border-2 ${idx === 0 ? 'border-deep-purple' : 'border-blush'} shrink-0 glass-card">
      <img src="${imgUrl}" alt="Thumbnail ${idx + 1}" class="w-full h-full object-cover">
    </button>
  `).join('');

  thumbsContainer.querySelectorAll('.thumb-btn').forEach((btn, idx) => {
    btn.addEventListener('click', () => {
      mainImage.src = galleryImages[idx];
      thumbsContainer.querySelectorAll('.thumb-btn').forEach(b => b.classList.replace('border-deep-purple', 'border-blush'));
      btn.classList.replace('border-blush', 'border-deep-purple');
    });
  });

  // Target Group Badge for Shoes (Men, Women, Children)
  const isShoe = categoryName.toLowerCase().includes('shoe') || product.category_id === 'cat-shoes-005';
  const badgeEl = document.getElementById('product-badge');

  if (isShoe && product.target_group) {
    badgeEl.textContent = `${product.target_group}'s Footwear`;
    badgeEl.classList.remove('hidden');
  } else if (product.is_bestseller) {
    badgeEl.textContent = 'Bestseller';
    badgeEl.classList.remove('hidden');
  }

  // Check if Product is a SPA SERVICE
  const isSpaService = categoryName.toLowerCase().includes('spa') || (product.category_id === 'cat-spa-006');
  const spaWidget = document.getElementById('spa-booking-widget');
  const actionLabel = document.getElementById('action-btn-label');

  if (isSpaService) {
    spaWidget.classList.remove('hidden');
    actionLabel.textContent = 'Reserve Spa Session Slot';
    initSpaBookingWidget(product);
  } else {
    spaWidget.classList.add('hidden');
    actionLabel.textContent = 'Add to Shopping Bag';
  }

  // Sizes / Shoe Sizes
  const sizeLabel = document.getElementById('size-label');
  const sizeContainer = document.getElementById('size-options');
  const sizesList = product.sizes || [];

  if (isShoe) {
    sizeLabel.textContent = `Select Shoe Size (${product.target_group || 'Footwear'}):`;
  } else {
    sizeLabel.textContent = 'Select Size / Volume:';
  }

  if (sizesList.length > 0) {
    selectedSize = sizesList[0];
    sizeContainer.innerHTML = sizesList.map((size, idx) => `
      <button data-size="${size}" class="size-btn px-4 py-2.5 text-xs font-semibold rounded-xl border ${idx === 0 ? 'border-deep-purple bg-deep-purple text-white shadow-md' : 'border-blush bg-white text-charcoal'} hover:border-deep-purple transition-all">
        ${size}
      </button>
    `).join('');

    sizeContainer.querySelectorAll('.size-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        selectedSize = e.currentTarget.getAttribute('data-size');
        sizeContainer.querySelectorAll('.size-btn').forEach(b => {
          b.className = "size-btn px-4 py-2.5 text-xs font-semibold rounded-xl border border-blush bg-white text-charcoal hover:border-deep-purple transition-all";
        });
        btn.className = "size-btn px-4 py-2.5 text-xs font-semibold rounded-xl border border-deep-purple bg-deep-purple text-white shadow-md transition-all";
      });
    });
  }

  // Colors / Shades (For Shoes / Lipsticks / Cosmetics)
  const shadeContainer = document.getElementById('shade-options');
  const shadeWrapper = document.getElementById('shade-selector-container');
  const shadeLabel = document.getElementById('shade-label');
  const colorsList = product.colors || product.shades || [];

  if (isShoe) {
    shadeLabel.textContent = 'Select Shoe Color Finish:';
  } else {
    shadeLabel.textContent = 'Select Shade / Color:';
  }

  if (colorsList.length > 0) {
    shadeWrapper.classList.remove('hidden');
    selectedShade = colorsList[0];
    shadeContainer.innerHTML = colorsList.map((color, idx) => `
      <button data-shade="${color}" class="shade-btn px-4 py-2 text-xs font-semibold rounded-xl border ${idx === 0 ? 'border-rose bg-rose/20 text-charcoal font-bold shadow-sm' : 'border-blush bg-white text-charcoal/80'} transition-all">
        ${color}
      </button>
    `).join('');

    shadeContainer.querySelectorAll('.shade-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        selectedShade = e.currentTarget.getAttribute('data-shade');
        shadeContainer.querySelectorAll('.shade-btn').forEach(b => {
          b.className = "shade-btn px-4 py-2 text-xs font-semibold rounded-xl border border-blush bg-white text-charcoal/80 transition-all";
        });
        btn.className = "shade-btn px-4 py-2 text-xs font-semibold rounded-xl border border-rose bg-rose/20 text-charcoal font-bold shadow-sm transition-all";
      });
    });
  } else {
    shadeWrapper.classList.add('hidden');
  }

  // Description & Usage
  document.getElementById('full-description').textContent = product.description || '';
  document.getElementById('how-to-use').textContent = product.howToUse || product.description || '';
}

async function initSpaBookingWidget(product) {
  const dateInput = document.getElementById('spa-date-input');
  if (dateInput) {
    dateInput.value = selectedSpaDate;
    dateInput.min = new Date().toISOString().split('T')[0];

    dateInput.addEventListener('change', async (e) => {
      selectedSpaDate = e.target.value;
      await loadSpaSlots(selectedSpaDate);
    });
  }

  await loadSpaSlots(selectedSpaDate);
}

async function loadSpaSlots(date) {
  const container = document.getElementById('spa-time-slots');
  if (!container) return;

  container.innerHTML = `<div class="col-span-full text-xs text-gray-400">Checking slot availability...</div>`;

  try {
    const slots = await ApiService.getSpaSlots(date);
    selectedSpaTime = null;

    if (!slots || slots.length === 0) {
      UI.renderEmptyState(container, {
        icon: '📅',
        title: 'No Spa Slots Available',
        message: 'No available appointment slots for the selected date. Please pick another date.'
      });
      return;
    }

    container.innerHTML = slots.map(slot => {
      if (slot.isBooked || slot.status === 'booked') {
        return `
          <div class="p-2.5 rounded-xl border border-red-200 bg-red-50 text-red-700 text-xs text-center cursor-not-allowed opacity-75">
            <span class="block font-bold">${slot.time}</span>
            <span class="text-[9px] font-semibold uppercase tracking-wider text-red-500">🔒 Reserved</span>
          </div>
        `;
      } else {
        return `
          <label class="p-2.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 cursor-pointer text-xs text-center flex flex-col items-center transition-colors">
            <input type="radio" name="spa-slot" value="${slot.time}" class="accent-emerald-600 mb-1">
            <span class="font-bold text-emerald-900">${slot.time}</span>
            <span class="text-[9px] font-bold uppercase tracking-wider text-emerald-700">Available</span>
          </label>
        `;
      }
    }).join('');

    container.querySelectorAll('input[name="spa-slot"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        selectedSpaTime = e.target.value;
      });
    });

  } catch (e) {
    container.innerHTML = `<div class="col-span-full text-xs text-red-400">Failed to load time slots.</div>`;
  }
}

function setupEventListeners() {
  const qtyVal = document.getElementById('qty-value');
  const qtyDec = document.getElementById('qty-dec');
  const qtyInc = document.getElementById('qty-inc');

  if (qtyDec && qtyInc && qtyVal) {
    qtyDec.addEventListener('click', () => {
      if (quantity > 1) {
        quantity--;
        qtyVal.textContent = quantity;
      }
    });

    qtyInc.addEventListener('click', () => {
      quantity++;
      qtyVal.textContent = quantity;
    });
  }

  const addBtn = document.getElementById('add-to-cart-btn');
  if (addBtn) {
    addBtn.addEventListener('click', async () => {
      if (!currentProduct) return;

      const categoryName = (currentProduct.category || currentProduct.category_name || '').toLowerCase();
      const isSpaService = categoryName.includes('spa') || currentProduct.category_id === 'cat-spa-006';

      UI.setButtonLoading(addBtn, true, isSpaService ? 'Reserving...' : 'Adding...');

      try {
        if (isSpaService) {
          if (!selectedSpaTime) {
            UI.showToast('Please select an available time slot for your spa session.', 'Select Time Slot', 'error');
            return;
          }

          const user = CartStore.getUser();
          await ApiService.bookSpaSession({
            service_id: currentProduct.id,
            service_name: currentProduct.name,
            customer_name: user ? user.full_name : 'Guest Client',
            customer_email: user ? user.email : 'client@crystalcrest.com',
            booking_date: selectedSpaDate,
            booking_time: selectedSpaTime
          });

          const bookedSizeLabel = `Session: ${selectedSpaDate} @ ${selectedSpaTime}`;
          await CartStore.addItem(currentProduct, quantity, bookedSizeLabel, null);

          UI.showToast(`Spa session reserved for ${selectedSpaDate} at ${selectedSpaTime}!`, "Session Booked", "success");
          UI.openCartDrawer();

          await loadSpaSlots(selectedSpaDate);

        } else {
          await CartStore.addItem(currentProduct, quantity, selectedSize, selectedShade);
          UI.showToast(`Added ${quantity}x ${currentProduct.name} (${selectedSize || ''}) to your shopping bag.`, "Added to Bag", "success");
          UI.openCartDrawer();
        }
      } catch (err) {
        UI.showToast(err.message || 'Action failed. Please try again.', 'Error', 'error');
      } finally {
        UI.setButtonLoading(addBtn, false);
      }
    });
  }

  const wishlistBtn = document.getElementById('wishlist-toggle-btn');
  if (wishlistBtn) {
    let wishlisted = false;
    wishlistBtn.addEventListener('click', () => {
      wishlisted = !wishlisted;
      if (wishlisted) {
        wishlistBtn.classList.add('text-rose', 'bg-blush');
        UI.showToast(`Added ${currentProduct.name} to your private wishlist.`, "Wishlist Saved", "success");
      } else {
        wishlistBtn.classList.remove('text-rose', 'bg-blush');
        UI.showToast(`Removed from wishlist.`, "Wishlist Updated");
      }
    });
  }

  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetId = e.currentTarget.getAttribute('data-tab');
      tabBtns.forEach(b => {
        b.classList.remove('border-deep-purple', 'text-deep-purple');
        b.classList.add('border-transparent', 'text-charcoal/60');
      });

      btn.classList.remove('border-transparent', 'text-charcoal/60');
      btn.classList.add('border-deep-purple', 'text-deep-purple');

      document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
      const targetPanel = document.getElementById(targetId);
      if (targetPanel) targetPanel.classList.remove('hidden');
    });
  });
}

async function loadRelatedProducts(product) {
  const container = document.getElementById('related-products-grid');
  if (!container) return;

  const allProducts = await ApiService.getProducts();
  const related = allProducts.filter(p => p.id !== product.id).slice(0, 4);

  container.innerHTML = related.map(item => {
    const priceNum = typeof item.price === 'number' ? item.price : (parseFloat(item.price) || 0);
    const ratingNum = typeof item.rating === 'number' ? item.rating : (parseFloat(item.rating) || 4.9);
    const mainImg = (item.images && item.images[0]) || item.image || 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80';
    const categoryName = item.category || item.category_name || 'Cosmetics';
    const isWish = CartStore.isWishlisted(item.id);
    const isOutOfStock = Number(item.stock_quantity) <= 0;
    const isInCartNow = CartStore.isInCart(item.id);

    return `
      <div class="glass-card rounded-2xl border border-[#F8E8E8] hover:border-rose/60 hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col group relative bg-white/95 backdrop-blur-sm cursor-pointer" onclick="window.location.href='product.html?id=${item.id}'">
        
        <!-- Wishlist Heart Overlay Button -->
        <button data-wishlist-toggle="${item.id}" class="wishlist-heart-btn absolute top-2 right-2 z-10 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/90 backdrop-blur-md border border-rose/30 flex items-center justify-center text-charcoal/60 hover:text-rose hover:scale-110 active:scale-95 transition-all shadow-sm" title="Add to Wishlist" aria-label="Toggle wishlist">
          <svg class="w-3.5 h-3.5 sm:w-4 sm:h-4 ${isWish ? 'fill-[#E8C500] text-[#E8C500]' : 'fill-none text-current'}" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.684a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
          </svg>
        </button>

        <!-- Square Product Image -->
        <div class="relative aspect-square overflow-hidden bg-blush/20">
          <img src="${mainImg}" alt="${item.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy">
          <div class="absolute inset-0 bg-charcoal/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
        </div>

        <!-- Card Body -->
        <div class="p-2.5 sm:p-3.5 flex-1 flex flex-col justify-between space-y-1.5">
          <div>
            <div class="flex items-center justify-between gap-1 mb-0.5">
              <span class="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-deep-purple truncate max-w-[70%]">${categoryName}</span>
              <span class="flex items-center gap-0.5 text-[10px] sm:text-xs text-rose font-semibold shrink-0">
                ★ ${ratingNum.toFixed(1)}
              </span>
            </div>
            
            <h4 class="font-semibold text-xs sm:text-sm text-charcoal leading-snug line-clamp-2 group-hover:text-deep-purple transition-colors" title="${item.name}">
              ${item.name}
            </h4>
          </div>

          <div class="pt-1.5 border-t border-blush/60 flex items-center justify-between">
            <span class="font-serif-heading font-bold text-sm sm:text-base text-charcoal block truncate">
              KSh ${priceNum.toLocaleString()}
            </span>
            <button data-quick-add="${item.id}" ${isOutOfStock ? 'disabled' : ''} class="px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-colors ${isOutOfStock ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : (isInCartNow ? 'bg-emerald-600 text-white hover:bg-rose-600' : 'bg-gray-900 text-white hover:bg-deep-purple')}" title="${isOutOfStock ? 'Out of Stock' : (isInCartNow ? 'Click to remove from cart' : 'Add to Cart')}">
              ${isOutOfStock ? 'Out of Stock' : (isInCartNow ? 'Remove from Cart' : 'Add to Cart')}
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Attach Wishlist heart click handlers
  container.querySelectorAll('[data-wishlist-toggle]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const prodId = e.currentTarget.getAttribute('data-wishlist-toggle');
      const prod = related.find(p => p.id === prodId);
      if (prod) {
        const isAdded = CartStore.toggleWishlist(prod);
        const svg = e.currentTarget.querySelector('svg');
        if (svg) {
          if (isAdded) {
            svg.classList.remove('fill-none', 'text-current');
            svg.classList.add('fill-[#E8C500]', 'text-[#E8C500]');
            UI.showToast(`Saved ${prod.name} to your private wishlist.`, "Wishlist Saved", "success");
          } else {
            svg.classList.remove('fill-[#E8C500]', 'text-[#E8C500]');
            svg.classList.add('fill-none', 'text-current');
            UI.showToast(`Removed from wishlist.`, "Wishlist Updated");
          }
        }
      }
    });
  });

  container.querySelectorAll('[data-quick-add]').forEach(btn => {
    btn.addEventListener('click', async (event) => {
      event.stopPropagation();
      event.preventDefault();
      const btnEl = event.currentTarget;
      const productId = btnEl.getAttribute('data-quick-add');
      const item = related.find(product => product.id === productId);
      if (!item) return;

      if (CartStore.isInCart(productId)) {
        await CartStore.removeItemByProductId(productId);
        UI.setQuickAddButtonState(btnEl, false);
        UI.showToast(`${item.name} removed from your shopping bag.`, 'Removed from Cart');
      } else {
        await CartStore.addItem(item);
        UI.setQuickAddButtonState(btnEl, true);
        UI.showToast(`${item.name} added to your shopping bag.`, 'Added to Cart', 'success');
      }
    });
  });

  window.addEventListener('cartUpdated', () => {
    container.querySelectorAll('[data-quick-add]').forEach(btnEl => {
      const productId = btnEl.getAttribute('data-quick-add');
      if (btnEl.disabled) return;
      UI.setQuickAddButtonState(btnEl, CartStore.isInCart(productId));
    });
  });
}
