/**
 * Crystal Crest - UI Shared Component & Renderer Module (KSh Shillings Currency)
 * Handles header navbar, footer, slide-in cart drawer component, toast notifications,
 * confirmation modals, button loading states, skeleton loaders, and empty states.
 */

import { CartStore } from './cart.js';
import { CrestiWidget } from './cresti-widget.js';

export const UI = {
  initHeader(activePage = 'home') {
    const headerContainer = document.getElementById('main-header');
    if (!headerContainer) return;

    // Enable PWA installation & mobile standalone metadata
    this.initPWA();

    // Initialize Cresti AI Concierge widget on customer-facing pages
    CrestiWidget.init();

    // Initialize Wishlist drawer
    this.initWishlistDrawer();

    const cartCount = CartStore.getItemCount();

    headerContainer.className = "sticky top-0 z-40 glass-nav transition-all duration-300";
    headerContainer.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-20">
          
          <!-- Brand Logo -->
          <a href="index.html" class="flex items-center gap-3 group">
            <div class="w-10 h-10 rounded-full bg-gradient-to-tr from-[#9B72CF] via-[#E8C500] to-[#F8E8E8] flex items-center justify-center p-[2px] shadow-md group-hover:scale-105 transition-transform duration-300">
              <div class="w-full h-full bg-[#1C1C1E] rounded-full flex items-center justify-center">
                <span class="font-serif-heading text-xl font-bold gold-gradient-text">C</span>
              </div>
            </div>
            <div class="flex flex-col">
              <span class="font-serif-heading text-2xl font-bold tracking-wider text-[#1C1C1E] group-hover:text-[#9B72CF] transition-colors">CRYSTAL CREST</span>
              <span class="text-[9px] uppercase tracking-[0.25em] text-[#9B72CF] font-semibold">Luxury Cosmetics & Shoes</span>
            </div>
          </a>

          <!-- Navigation Links (Desktop) -->
          <nav class="hidden md:flex items-center gap-8 text-sm font-medium tracking-wide">
            <a href="index.html" class="transition-colors ${activePage === 'home' ? 'text-[#9B72CF] font-bold border-b-2 border-[#E8C500] pb-1' : 'text-[#1C1C1E] hover:text-[#9B72CF]'}">Home</a>
            <a href="shop.html" class="transition-colors ${activePage === 'shop' ? 'text-[#9B72CF] font-bold border-b-2 border-[#E8C500] pb-1' : 'text-[#1C1C1E] hover:text-[#9B72CF]'}">Shop Collection</a>
            <a href="spa.html" class="transition-colors ${activePage === 'spa' ? 'text-[#9B72CF] font-bold border-b-2 border-[#E8C500] pb-1' : 'text-[#1C1C1E] hover:text-[#9B72CF]'}">Spa Services</a>
            <a href="checkout.html" class="transition-colors ${activePage === 'checkout' ? 'text-[#9B72CF] font-bold border-b-2 border-[#E8C500] pb-1' : 'text-[#1C1C1E] hover:text-[#9B72CF]'}">Checkout</a>
            <a href="account.html" class="transition-colors ${activePage === 'account' ? 'text-[#9B72CF] font-bold border-b-2 border-[#E8C500] pb-1' : 'text-[#1C1C1E] hover:text-[#9B72CF]'}">My Account</a>
          </nav>

          <!-- Quick Action Icons -->
          <div class="flex items-center gap-4">
            <a href="shop.html" aria-label="Search Collection" class="p-2 text-[#1C1C1E] hover:text-[#9B72CF] transition-colors rounded-full hover:bg-[#F8E8E8]/50">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
            </a>

            <!-- Wishlist Drawer Trigger Button (Desktop & Header) -->
            <button id="header-wishlist-btn" aria-label="Open Wishlist" class="relative p-2 text-[#1C1C1E] hover:text-[#9B72CF] transition-colors rounded-full hover:bg-[#F8E8E8]/50 focus:outline-none">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.684a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
              </svg>
              <span id="header-wishlist-badge" class="${CartStore.getWishlistCount() === 0 ? 'hidden' : 'flex'} absolute -top-1 -right-1 w-4 h-4 bg-[#E8C500] text-charcoal text-[10px] font-bold rounded-full items-center justify-center border border-white shadow-sm">
                ${CartStore.getWishlistCount()}
              </span>
            </button>

            <!-- Cart Drawer Trigger Button -->
            <button id="cart-drawer-btn" aria-label="Open Cart" class="relative p-2 text-[#1C1C1E] hover:text-[#9B72CF] transition-colors rounded-full hover:bg-[#F8E8E8]/50 focus:outline-none">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/>
              </svg>
              <span id="cart-badge-count" class="${cartCount === 0 ? 'hidden' : 'flex'} absolute -top-1 -right-1 w-5 h-5 bg-[#9B72CF] text-[#FDFAF5] text-[11px] font-bold rounded-full items-center justify-center border-2 border-[#FDFAF5] shadow-sm animate-pulse">
                ${cartCount}
              </span>
            </button>

            <!-- Mobile Menu Toggle -->
            <button id="mobile-menu-toggle" aria-label="Toggle Navigation Menu" class="md:hidden p-2 text-[#1C1C1E] hover:text-[#9B72CF] focus:outline-none">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16m-7 6h7"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Mobile Navigation Menu -->
        <div id="mobile-menu" class="hidden md:hidden pb-4 border-t border-[#F8E8E8] mt-2 pt-3 flex flex-col gap-3 text-sm font-medium">
          <a href="index.html" class="px-3 py-2 rounded-lg hover:bg-[#F8E8E8]">Home</a>
          <a href="shop.html" class="px-3 py-2 rounded-lg hover:bg-[#F8E8E8]">Shop Collection</a>
          <a href="spa.html" class="px-3 py-2 rounded-lg hover:bg-[#F8E8E8]">Spa Services</a>
          <a href="checkout.html" class="px-3 py-2 rounded-lg hover:bg-[#F8E8E8]">Checkout</a>
          <a href="account.html" class="px-3 py-2 rounded-lg hover:bg-[#F8E8E8]">My Account</a>
        </div>
      </div>
    `;

    const mobileBtn = document.getElementById('mobile-menu-toggle');
    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileBtn && mobileMenu) {
      mobileBtn.addEventListener('click', () => {
        mobileMenu.classList.toggle('hidden');
      });
    }

    const cartBtn = document.getElementById('cart-drawer-btn');
    if (cartBtn) {
      cartBtn.addEventListener('click', () => this.openCartDrawer());
    }

    const headerWishlistBtn = document.getElementById('header-wishlist-btn');
    if (headerWishlistBtn) {
      headerWishlistBtn.addEventListener('click', () => this.openWishlistDrawer());
    }

    window.addEventListener('cartUpdated', (e) => {
      const badge = document.getElementById('cart-badge-count');
      const mobileBadge = document.getElementById('mobile-nav-cart-badge');
      const count = CartStore.getItemCount();
      
      [badge, mobileBadge].forEach(b => {
        if (b) {
          b.textContent = count;
          if (count > 0) {
            b.classList.remove('hidden');
            b.classList.add('flex');
          } else {
            b.classList.add('hidden');
            b.classList.remove('flex');
          }
        }
      });
      this.renderCartDrawerContent();
    });

    window.addEventListener('wishlistUpdated', (e) => {
      const headerBadge = document.getElementById('header-wishlist-badge');
      const mobileBadge = document.getElementById('mobile-nav-wishlist-badge');
      const count = CartStore.getWishlistCount();

      [headerBadge, mobileBadge].forEach(b => {
        if (b) {
          b.textContent = count;
          if (count > 0) {
            b.classList.remove('hidden');
            b.classList.add('flex');
          } else {
            b.classList.add('hidden');
            b.classList.remove('flex');
          }
        }
      });
      this.renderWishlistDrawerContent();
    });

    // Initialize Persistent Mobile Bottom Navigation
    this.initMobileBottomNav(activePage);
  },

  initMobileBottomNav(activePage = 'home') {
    if (document.getElementById('mobile-bottom-nav')) return;

    const cartCount = CartStore.getItemCount();
    const wishlistCount = CartStore.getWishlistCount();

    const navHTML = `
      <nav id="mobile-bottom-nav" class="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-rose/30 shadow-[0_-4px_25px_rgba(0,0,0,0.08)] px-2 py-1.5 flex items-center justify-around text-center safe-area-bottom">
        
        <!-- 1. Home -->
        <a href="index.html" class="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all ${activePage === 'home' ? 'text-[#9B72CF] font-bold' : 'text-charcoal/60 hover:text-[#9B72CF]'}">
          <svg class="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="${activePage === 'home' ? '2.4' : '1.8'}" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
          </svg>
          <span class="text-[10px] tracking-tight">Home</span>
        </a>

        <!-- 2. Shop Collection -->
        <a href="shop.html" class="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all ${activePage === 'shop' ? 'text-[#9B72CF] font-bold' : 'text-charcoal/60 hover:text-[#9B72CF]'}">
          <svg class="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="${activePage === 'shop' ? '2.4' : '1.8'}" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/>
          </svg>
          <span class="text-[10px] tracking-tight">Shop</span>
        </a>

        <!-- 3. Wishlist (Opens Wishlist Drawer) -->
        <button id="mobile-bottom-wishlist-btn" class="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all relative ${activePage === 'wishlist' ? 'text-[#9B72CF] font-bold' : 'text-charcoal/60 hover:text-[#9B72CF]'}">
          <svg class="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="${activePage === 'wishlist' ? '2.4' : '1.8'}" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.684a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
          </svg>
          <span id="mobile-nav-wishlist-badge" class="${wishlistCount === 0 ? 'hidden' : 'flex'} absolute -top-0.5 right-2 w-4 h-4 bg-[#E8C500] text-charcoal text-[9px] font-bold rounded-full items-center justify-center shadow-xs">
            ${wishlistCount}
          </span>
          <span class="text-[10px] tracking-tight">Wishlist</span>
        </button>

        <!-- 4. Bag / Cart (Opens Cart Drawer) -->
        <button id="mobile-bottom-cart-btn" class="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all relative ${activePage === 'cart' ? 'text-[#9B72CF] font-bold' : 'text-charcoal/60 hover:text-[#9B72CF]'}">
          <svg class="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
          </svg>
          <span id="mobile-nav-cart-badge" class="${cartCount === 0 ? 'hidden' : 'flex'} absolute -top-0.5 right-1 w-4 h-4 bg-[#9B72CF] text-white text-[9px] font-bold rounded-full items-center justify-center shadow-xs">
            ${cartCount}
          </span>
          <span class="text-[10px] tracking-tight">Bag</span>
        </button>

        <!-- 5. My Account -->
        <a href="account.html" class="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all ${activePage === 'account' ? 'text-[#9B72CF] font-bold' : 'text-charcoal/60 hover:text-[#9B72CF]'}">
          <svg class="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="${activePage === 'account' ? '2.4' : '1.8'}" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
          </svg>
          <span class="text-[10px] tracking-tight">Account</span>
        </a>

      </nav>
    `;

    document.body.insertAdjacentHTML('beforeend', navHTML);

    // Add bottom padding to body/main for mobile nav clearance
    document.body.classList.add('pb-16', 'md:pb-0');

    const mobileCartBtn = document.getElementById('mobile-bottom-cart-btn');
    if (mobileCartBtn) {
      mobileCartBtn.addEventListener('click', () => this.openCartDrawer());
    }

    const mobileWishlistBtn = document.getElementById('mobile-bottom-wishlist-btn');
    if (mobileWishlistBtn) {
      mobileWishlistBtn.addEventListener('click', () => this.openWishlistDrawer());
    }
  },

  initWishlistDrawer() {
    if (document.getElementById('wishlist-drawer-backdrop')) return;

    const drawerHTML = `
      <div id="wishlist-drawer-backdrop" class="fixed inset-0 z-50 bg-[#1C1C1E]/60 backdrop-blur-sm opacity-0 pointer-events-none transition-opacity duration-300"></div>
      
      <div id="wishlist-drawer-panel" class="fixed top-0 right-0 z-50 w-full max-w-md h-full bg-[#FDFAF5] shadow-2xl transform translate-x-full transition-transform duration-300 ease-in-out flex flex-col border-l border-[#E8C500]/30">
        
        <!-- Wishlist Header -->
        <div class="p-5 border-b border-[#F8E8E8] flex items-center justify-between bg-gradient-to-r from-[#FDFAF5] to-[#F8E8E8]/50 shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-[#E8C500] text-charcoal flex items-center justify-center font-bold">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
            </div>
            <div>
              <h2 class="font-serif-heading text-xl font-bold text-[#1C1C1E]">Private Wishlist</h2>
              <span class="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Your Saved Formulations</span>
            </div>
          </div>
          <button id="close-wishlist-drawer" class="p-2 text-[#1C1C1E]/70 hover:text-[#1C1C1E] rounded-full hover:bg-[#F8E8E8] transition-colors">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Wishlist Content / Items List -->
        <div id="wishlist-drawer-items" class="flex-1 overflow-y-auto p-4 space-y-3">
        </div>

        <!-- Wishlist Footer -->
        <div class="p-4 border-t border-[#F8E8E8] bg-white space-y-3 shrink-0 shadow-lg">
          <a href="shop.html" class="block w-full py-3 border border-[#1C1C1E] text-[#1C1C1E] font-medium text-xs tracking-wider uppercase rounded-full text-center hover:bg-[#F8E8E8] transition-colors">
            Explore Full Catalog
          </a>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', drawerHTML);

    const backdrop = document.getElementById('wishlist-drawer-backdrop');
    const closeBtn = document.getElementById('close-wishlist-drawer');

    backdrop?.addEventListener('click', () => this.closeWishlistDrawer());
    closeBtn?.addEventListener('click', () => this.closeWishlistDrawer());

    this.renderWishlistDrawerContent();
  },

  openWishlistDrawer() {
    this.initWishlistDrawer();
    this.renderWishlistDrawerContent();

    const backdrop = document.getElementById('wishlist-drawer-backdrop');
    const panel = document.getElementById('wishlist-drawer-panel');

    backdrop?.classList.remove('opacity-0', 'pointer-events-none');
    backdrop?.classList.add('opacity-100');

    panel?.classList.remove('translate-x-full');
    panel?.classList.add('translate-x-0');
  },

  closeWishlistDrawer() {
    const backdrop = document.getElementById('wishlist-drawer-backdrop');
    const panel = document.getElementById('wishlist-drawer-panel');

    if (!backdrop || !panel) return;

    panel.classList.remove('translate-x-0');
    panel.classList.add('translate-x-full');

    backdrop.classList.remove('opacity-100');
    backdrop.classList.add('opacity-0', 'pointer-events-none');
  },

  renderWishlistDrawerContent() {
    const container = document.getElementById('wishlist-drawer-items');
    if (!container) return;

    const wishlist = CartStore.getWishlist();

    if (wishlist.length === 0) {
      this.renderEmptyState(container, {
        icon: '🤍',
        title: 'Your Wishlist is Empty',
        message: 'Tap the heart icon on any formulation or Italian shoe to save it here for later.',
        actionText: 'Browse Shop',
        actionUrl: 'shop.html'
      });
      return;
    }

    container.innerHTML = wishlist.map((item, index) => {
      const priceNum = typeof item.price === 'number' ? item.price : (parseFloat(item.price) || 0);
      const img = item.image || (item.images && item.images[0]) || 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80';
      const prodId = item.id || item.product_id;

      return `
        <div class="flex items-center gap-3 p-3 bg-white rounded-xl border border-[#F8E8E8] shadow-xs relative group hover:border-[#E8C500]/50 transition-all">
          <a href="product.html?id=${prodId}" class="shrink-0">
            <img src="${img}" alt="${item.name || 'Product'}" class="w-16 h-16 object-cover rounded-lg bg-[#F8E8E8] border border-blush/60">
          </a>
          
          <div class="flex-1 min-w-0 flex flex-col justify-between py-0.5">
            <div class="flex items-start justify-between gap-1">
              <a href="product.html?id=${prodId}" class="block truncate">
                <h4 class="font-semibold text-xs sm:text-sm text-[#1C1C1E] hover:text-[#9B72CF] truncate leading-tight">${item.name || 'Luxury Item'}</h4>
              </a>
              <button data-wishlist-remove="${prodId}" class="text-charcoal/40 hover:text-red-500 p-1 -mr-1 -mt-1 transition-colors" title="Remove from wishlist">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <span class="text-[10px] text-[#9B72CF] font-medium uppercase tracking-wider mt-0.5">${item.category || 'Cosmetics'}</span>

            <div class="flex items-center justify-between mt-1.5 pt-1 border-t border-blush/40">
              <span class="font-serif-heading font-bold text-xs sm:text-sm text-[#1C1C1E]">KSh ${priceNum.toLocaleString()}</span>
              
              <a href="product.html?id=${prodId}" class="px-3 py-1 rose-glow-btn text-[10px] font-bold uppercase tracking-wider rounded-full shadow-xs">
                View & Buy
              </a>
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('[data-wishlist-remove]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const prodId = e.currentTarget.getAttribute('data-wishlist-remove');
        CartStore.toggleWishlist(prodId);
        UI.showToast('Item removed from wishlist');
      });
    });
  },

  initCartDrawer() {
    if (document.getElementById('cart-drawer-backdrop')) return;

    const drawerHTML = `
      <div id="cart-drawer-backdrop" class="fixed inset-0 z-50 bg-[#1C1C1E]/60 backdrop-blur-sm opacity-0 pointer-events-none transition-opacity duration-300"></div>
      
      <div id="cart-drawer-panel" class="fixed top-0 right-0 z-50 w-full max-w-md h-full bg-[#FDFAF5] shadow-2xl transform translate-x-full transition-transform duration-300 ease-in-out flex flex-col border-l border-[#E8C500]/30">
        
        <!-- Drawer Header (Fixed at top of panel) -->
        <div class="p-5 border-b border-[#F8E8E8] flex items-center justify-between bg-gradient-to-r from-[#FDFAF5] to-[#F8E8E8]/50 shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-[#9B72CF] text-white flex items-center justify-center font-bold">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/>
              </svg>
            </div>
            <div>
              <h2 class="font-serif-heading text-xl sm:text-2xl font-bold text-[#1C1C1E]">Your Shopping Bag</h2>
              <span id="drawer-item-count-label" class="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">0 items</span>
            </div>
          </div>
          <button id="close-cart-drawer" class="p-2 text-[#1C1C1E]/70 hover:text-[#1C1C1E] rounded-full hover:bg-[#F8E8E8] transition-colors">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Drawer Free Shipping Progress (Fixed below header) -->
        <div id="cart-shipping-banner" class="px-5 py-2.5 bg-[#F8E8E8]/70 border-b border-[#E8C500]/20 text-xs text-[#1C1C1E] shrink-0">
        </div>

        <!-- Drawer Content / Items List (Scrollable middle container) -->
        <div id="cart-drawer-items" class="flex-1 overflow-y-auto p-4 space-y-3">
        </div>

        <!-- Sticky Checkout Bar (Pinned to the bottom of the drawer panel, never scrolls away!) -->
        <div id="cart-drawer-footer" class="p-4 sm:p-5 border-t border-[#F8E8E8] bg-white/95 backdrop-blur-md space-y-3 shadow-[0_-4px_25px_rgba(0,0,0,0.06)] shrink-0 z-10">
          <div class="flex justify-between items-baseline">
            <div>
              <span class="text-xs text-charcoal/70 font-semibold block">Estimated Subtotal</span>
              <span class="text-[10px] text-charcoal/50">Taxes & shipping calculated at checkout</span>
            </div>
            <span id="drawer-subtotal" class="font-serif-heading text-xl sm:text-2xl font-bold text-charcoal">KSh 0</span>
          </div>

          <div class="grid grid-cols-2 gap-2.5 pt-1">
            <a href="shop.html" id="drawer-continue-shop-btn" class="px-3 py-3 border border-charcoal/30 text-charcoal font-semibold text-xs tracking-wider uppercase rounded-full text-center hover:bg-[#F8E8E8] hover:border-charcoal transition-all">
              Continue
            </a>
            <a href="checkout.html" class="px-4 py-3 rose-glow-btn text-xs font-bold tracking-wider uppercase rounded-full text-center shadow-lg hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-1.5">
              <span>Checkout</span>
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
              </svg>
            </a>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', drawerHTML);

    const backdrop = document.getElementById('cart-drawer-backdrop');
    const closeBtn = document.getElementById('close-cart-drawer');
    const continueBtn = document.getElementById('drawer-continue-shop-btn');

    backdrop?.addEventListener('click', () => this.closeCartDrawer());
    closeBtn?.addEventListener('click', () => this.closeCartDrawer());
    continueBtn?.addEventListener('click', () => this.closeCartDrawer());

    this.renderCartDrawerContent();
  },

  openCartDrawer() {
    this.initCartDrawer();
    this.renderCartDrawerContent();

    const backdrop = document.getElementById('cart-drawer-backdrop');
    const panel = document.getElementById('cart-drawer-panel');

    backdrop?.classList.remove('opacity-0', 'pointer-events-none');
    backdrop?.classList.add('opacity-100');

    panel?.classList.remove('translate-x-full');
    panel?.classList.add('translate-x-0');
  },

  closeCartDrawer() {
    const backdrop = document.getElementById('cart-drawer-backdrop');
    const panel = document.getElementById('cart-drawer-panel');

    if (!backdrop || !panel) return;

    panel.classList.remove('translate-x-0');
    panel.classList.add('translate-x-full');

    backdrop.classList.remove('opacity-100');
    backdrop.classList.add('opacity-0', 'pointer-events-none');
  },

  renderCartDrawerContent() {
    const container = document.getElementById('cart-drawer-items');
    const shippingBanner = document.getElementById('cart-shipping-banner');
    const subtotalEl = document.getElementById('drawer-subtotal');
    const countLabel = document.getElementById('drawer-item-count-label');
    const footerEl = document.getElementById('cart-drawer-footer');
    if (!container) return;

    const cart = CartStore.getCart();
    const totals = CartStore.getTotals();
    const count = CartStore.getItemCount();

    if (countLabel) {
      countLabel.textContent = `${count} item${count === 1 ? '' : 's'}`;
    }

    if (shippingBanner) {
      shippingBanner.innerHTML = `
        <div class="flex items-center justify-between text-[11px] font-medium text-[#1C1C1E]">
          <span class="flex items-center gap-1.5 text-emerald-800 font-bold">
            <span>🏬</span>
            <span>Store Pickup: <strong>FREE</strong></span>
          </span>
          <span class="text-gray-300">|</span>
          <span class="flex items-center gap-1.5 text-[#9B72CF] font-bold">
            <span>🚚</span>
            <span>Kajiado Delivery: <strong>KSh 100</strong></span>
          </span>
        </div>
      `;
    }

    if (subtotalEl) {
      subtotalEl.textContent = `KSh ${totals.subtotal.toLocaleString()}`;
    }

    if (cart.length === 0) {
      if (footerEl) footerEl.classList.add('hidden');
      this.renderEmptyState(container, {
        icon: '🛍️',
        title: 'Your Bag is Empty',
        message: 'Discover handcrafted botanical cosmetics, rare fragrances, and bespoke Italian shoes.',
        actionText: 'Explore Shop',
        actionUrl: 'shop.html'
      });
      return;
    }

    if (footerEl) footerEl.classList.remove('hidden');

    // Compact horizontal card layout
    container.innerHTML = cart.map((item, index) => {
      const p = typeof item.price === 'number' ? item.price : (parseFloat(item.price) || 0);
      const q = parseInt(item.quantity) || 1;
      const img = item.image || (item.images && item.images[0]) || 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80';
      const prodId = item.product_id || item.id;

      return `
        <div class="flex items-center gap-3 p-2.5 sm:p-3 bg-white rounded-xl border border-[#F8E8E8] shadow-xs relative group hover:border-[#E8C500]/50 transition-all">
          <a href="product.html?id=${prodId}" class="shrink-0">
            <img src="${img}" alt="${item.name}" class="w-16 h-16 object-cover rounded-lg bg-[#F8E8E8] border border-blush/60">
          </a>
          
          <div class="flex-1 min-w-0 flex flex-col justify-between py-0.5">
            <div class="flex items-start justify-between gap-1">
              <a href="product.html?id=${prodId}" class="block truncate">
                <h4 class="font-semibold text-xs sm:text-sm text-[#1C1C1E] hover:text-[#9B72CF] truncate leading-tight">${item.name}</h4>
              </a>
              <button data-cart-remove="${index}" class="text-charcoal/40 hover:text-red-500 p-1 -mr-1 -mt-1 transition-colors" title="Remove item">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <p class="text-[10px] text-[#9B72CF] font-medium truncate mt-0.5">${item.selectedSize || 'Standard'} ${item.selectedShade ? `• ${item.selectedShade}` : ''}</p>

            <div class="flex items-center justify-between mt-1.5 pt-1 border-t border-blush/40">
              <!-- Compact Stepper -->
              <div class="flex items-center border border-[#F8E8E8] rounded-md bg-[#FDFAF5]">
                <button data-cart-dec="${index}" class="px-2 py-0.5 text-[11px] text-[#1C1C1E] hover:bg-[#F8E8E8] rounded-l-md transition-colors font-bold">-</button>
                <span class="px-2 text-[11px] font-semibold">${q}</span>
                <button data-cart-inc="${index}" class="px-2 py-0.5 text-[11px] text-[#1C1C1E] hover:bg-[#F8E8E8] rounded-r-md transition-colors font-bold">+</button>
              </div>

              <!-- Inline Line Total -->
              <span class="font-serif-heading font-bold text-xs sm:text-sm text-[#1C1C1E]">KSh ${(p * q).toLocaleString()}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('[data-cart-inc]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const idx = parseInt(e.currentTarget.getAttribute('data-cart-inc'), 10);
        const currentQty = cart[idx].quantity;
        await CartStore.updateQuantity(idx, currentQty + 1);
      });
    });

    container.querySelectorAll('[data-cart-dec]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const idx = parseInt(e.currentTarget.getAttribute('data-cart-dec'), 10);
        const currentQty = cart[idx].quantity;
        await CartStore.updateQuantity(idx, currentQty - 1);
      });
    });

    container.querySelectorAll('[data-cart-remove]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const idx = parseInt(e.currentTarget.getAttribute('data-cart-remove'), 10);
        const confirmed = await UI.showConfirm({
          title: 'Remove Item',
          message: 'Are you sure you want to remove this formulation from your shopping bag?',
          confirmText: 'Remove Item',
          danger: true
        });
        if (confirmed) {
          await CartStore.removeItem(idx);
          UI.showToast('Item removed from bag');
        }
      });
    });
  },

  initFooter() {
    const footerContainer = document.getElementById('main-footer');
    if (!footerContainer) return;

    footerContainer.className = "bg-[#1C1C1E] text-[#FDFAF5] pt-16 pb-12 border-t border-[#E8C500]/30 mt-20";
    footerContainer.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="grid grid-cols-1 md:grid-cols-12 gap-10 pb-12 border-b border-white/10">
          
          <!-- Column 1: Brand Logo, Updated Tagline & Social Media Icons -->
          <div class="space-y-4 md:col-span-6">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-gradient-to-tr from-[#9B72CF] to-[#E8C500] flex items-center justify-center p-[2px]">
                <div class="w-full h-full bg-[#1C1C1E] rounded-full flex items-center justify-center">
                  <span class="font-serif-heading text-xl font-bold gold-gradient-text">C</span>
                </div>
              </div>
              <span class="font-serif-heading text-2xl font-bold tracking-wider gold-gradient-text">CRYSTAL CREST</span>
            </div>
            <p class="text-xs text-gray-300 leading-relaxed max-w-md font-light">
              Crystal Crest Cosmetics — enhancing your natural beauty with quality cosmetics and carefully selected beauty essentials. Glow with confidence. Shine with elegance.
            </p>

            <!-- Social Media Links -->
            <div class="flex items-center gap-3 pt-2">
              <a href="https://wa.me/254700074333" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" class="w-9 h-9 rounded-full bg-white/5 border border-white/15 flex items-center justify-center text-gray-300 hover:text-[#E8C500] hover:border-[#E8C500]/60 hover:bg-[#E8C500]/10 transition-all shadow-sm" title="Chat with us on WhatsApp">
                <svg class="w-4 h-4 fill-currentColor" viewBox="0 0 24 24">
                  <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0012.04 2zm5.79 14.36c-.24.67-1.38 1.25-1.92 1.32-.49.07-1.12.1-3.23-.78-2.69-1.13-4.42-3.86-4.56-4.04-.13-.18-1.09-1.45-1.09-2.77 0-1.32.69-1.96.94-2.22.25-.26.54-.33.72-.33.18 0 .36 0 .52.01.17.01.4.07.61.53.24.52.82 2 .89 2.15.07.15.12.33.02.53-.1.2-.15.33-.3.51-.15.18-.31.4-.44.54-.15.15-.31.31-.13.62.18.31.78 1.29 1.68 2.09 1.15 1.03 2.13 1.35 2.44 1.5.31.15.49.13.67-.08.18-.2.78-.91.99-1.22.2-.31.41-.26.69-.15.28.1.1.78 2.37 3.86 2.49.12.08.2.13.25.21.05.08.05.47-.19 1.14z"/>
                </svg>
              </a>
              <a href="https://instagram.com/crystalcrestboutique" target="_blank" rel="noopener noreferrer" aria-label="Instagram" class="w-9 h-9 rounded-full bg-white/5 border border-white/15 flex items-center justify-center text-gray-300 hover:text-[#E8C500] hover:border-[#E8C500]/60 hover:bg-[#E8C500]/10 transition-all shadow-sm" title="Follow us on Instagram">
                <svg class="w-4 h-4 fill-currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>
              <a href="https://facebook.com/crystalcrestboutique" target="_blank" rel="noopener noreferrer" aria-label="Facebook" class="w-9 h-9 rounded-full bg-white/5 border border-white/15 flex items-center justify-center text-gray-300 hover:text-[#E8C500] hover:border-[#E8C500]/60 hover:bg-[#E8C500]/10 transition-all shadow-sm" title="Follow us on Facebook">
                <svg class="w-4 h-4 fill-currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </a>
              <a href="https://tiktok.com/@crystalcrestboutique" target="_blank" rel="noopener noreferrer" aria-label="TikTok" class="w-9 h-9 rounded-full bg-white/5 border border-white/15 flex items-center justify-center text-gray-300 hover:text-[#E8C500] hover:border-[#E8C500]/60 hover:bg-[#E8C500]/10 transition-all shadow-sm" title="Follow us on TikTok">
                <svg class="w-4 h-4 fill-currentColor" viewBox="0 0 24 24">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.298-.002.595.042.88.13V9.4a6.33 6.33 0 0 0-1-.08A6.34 6.34 0 0 0 3 15.66a6.34 6.34 0 0 0 10.82 4.47 6.27 6.27 0 0 0 1.94-4.46V8.71a8.21 8.21 0 0 0 4.83 1.56V6.83a4.85 4.85 0 0 1-1-.14z"/>
                </svg>
              </a>
            </div>
          </div>

          <!-- Column 2: Storefront Navigation -->
          <div class="md:col-span-3">
            <h4 class="font-serif-heading text-lg font-bold text-[#E8C500] mb-4">Storefront</h4>
            <ul class="space-y-2.5 text-xs text-gray-300">
              <li><a href="index.html" class="hover:text-[#C9A0DC] transition-colors">Home</a></li>
              <li><a href="shop.html" class="hover:text-[#C9A0DC] transition-colors">Shop All Products</a></li>
              <li><a href="checkout.html" class="hover:text-[#C9A0DC] transition-colors">Checkout & Pickup</a></li>
              <li><a href="account.html" class="hover:text-[#C9A0DC] transition-colors">Customer Account</a></li>
            </ul>
          </div>

          <!-- Column 3: Get In Touch / Contact Info with Icons -->
          <div class="space-y-3 md:col-span-3">
            <h4 class="font-serif-heading text-lg font-bold text-[#E8C500] mb-4">Get In Touch</h4>
            <ul class="space-y-3 text-xs text-gray-300">
              <li class="flex items-start gap-2.5">
                <svg class="w-4 h-4 text-[#E8C500] shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
                <span class="leading-relaxed">Kajiado Town (Opp Crapas Hotel)</span>
              </li>
              <li class="flex items-center gap-2.5">
                <svg class="w-4 h-4 text-[#E8C500] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                </svg>
                <a href="tel:0700074333" class="hover:text-[#C9A0DC] transition-colors font-medium">0700 074 333</a>
              </li>
              <li class="flex items-center gap-2.5">
                <svg class="w-4 h-4 text-[#E8C500] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
                <a href="mailto:crystalcrest17@gmail.com" class="hover:text-[#C9A0DC] transition-colors break-all">crystalcrest17@gmail.com</a>
              </li>
            </ul>
          </div>
        </div>

        <div class="pt-8 flex flex-col md:flex-row items-center justify-between text-xs text-gray-500 gap-4">
          <p>© ${new Date().getFullYear()} Crystal Crest Cosmetics & Luxury Footwear Ltd. All Rights Reserved.</p>
        </div>
      </div>
    `;
  },

  showToast(message, title = "Crystal Crest", type = "info") {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm pointer-events-none';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const borderClass = type === 'error' ? 'border-l-red-500' : (type === 'success' ? 'border-l-emerald-500' : 'border-l-[#E8C500]');
    const iconSymbol = type === 'error' ? '✕' : (type === 'success' ? '✓' : 'ℹ️');

    toast.className = `glass-card pointer-events-auto p-4 rounded-xl shadow-2xl flex items-start gap-3 border-l-4 ${borderClass} animate-fade-in bg-white`;
    toast.innerHTML = `
      <div class="w-7 h-7 rounded-full bg-[#1C1C1E]/10 text-[#1C1C1E] flex items-center justify-center shrink-0 font-bold text-xs">
        ${iconSymbol}
      </div>
      <div>
        <h5 class="font-serif-heading font-bold text-sm text-[#1C1C1E]">${title}</h5>
        <p class="text-xs text-[#1C1C1E]/80 mt-0.5">${message}</p>
      </div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('opacity-0', 'transition-opacity', 'duration-500');
      setTimeout(() => toast.remove(), 500);
    }, 3200);
  },

  showConfirm({ title = 'Confirm Action', message = 'Are you sure you want to perform this action?', confirmText = 'Confirm', cancelText = 'Cancel', danger = false }) {
    return new Promise((resolve) => {
      const existingModal = document.getElementById('global-confirm-modal');
      if (existingModal) existingModal.remove();

      const modalHTML = `
        <div id="global-confirm-modal" class="fixed inset-0 z-50 bg-[#1C1C1E]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-gray-200 text-center animate-fade-in">
            <div class="w-14 h-14 rounded-full ${danger ? 'bg-red-100 text-red-600' : 'bg-purple-100 text-[#9B72CF]'} flex items-center justify-center mx-auto text-xl font-bold">
              ${danger ? '⚠️' : '❓'}
            </div>
            
            <div class="space-y-1">
              <h3 class="font-serif-heading text-xl font-bold text-gray-900">${title}</h3>
              <p class="text-xs text-gray-600 leading-relaxed">${message}</p>
            </div>

            <div class="flex gap-3 pt-2">
              <button id="confirm-cancel-btn" class="flex-1 py-2.5 border border-gray-300 hover:bg-gray-100 text-gray-700 font-bold text-xs uppercase tracking-wider rounded-xl transition-colors">
                ${cancelText}
              </button>
              <button id="confirm-ok-btn" class="flex-1 py-2.5 ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-[#1C1C1E] hover:bg-[#9B72CF]'} text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-colors shadow">
                ${confirmText}
              </button>
            </div>
          </div>
        </div>
      `;

      document.body.insertAdjacentHTML('beforeend', modalHTML);
      const modal = document.getElementById('global-confirm-modal');

      const cleanup = (val) => {
        modal.remove();
        resolve(val);
      };

      document.getElementById('confirm-cancel-btn').addEventListener('click', () => cleanup(false));
      document.getElementById('confirm-ok-btn').addEventListener('click', () => cleanup(true));
    });
  },

  renderEmptyState(container, { icon = '📦', title = 'No Items Found', message = 'There are currently no items to display.', actionText, actionUrl, onAction }) {
    if (!container) return;
    container.innerHTML = `
      <div class="col-span-full py-16 px-4 text-center space-y-4 max-w-md mx-auto">
        <div class="w-16 h-16 rounded-full bg-[#F8E8E8] text-[#9B72CF] flex items-center justify-center mx-auto text-2xl shadow-inner">
          ${icon}
        </div>
        <h3 class="font-serif-heading text-2xl font-bold text-[#1C1C1E]">${title}</h3>
        <p class="text-xs text-gray-500 leading-relaxed">${message}</p>
        ${actionText ? `
          <button id="empty-state-action-btn" class="inline-block mt-2 px-6 py-2.5 bg-[#1C1C1E] hover:bg-[#9B72CF] text-white text-xs font-bold uppercase tracking-wider rounded-full shadow transition-colors">
            ${actionText}
          </button>
        ` : ''}
      </div>
    `;

    if (actionText) {
      const btn = container.querySelector('#empty-state-action-btn');
      if (btn) {
        btn.addEventListener('click', () => {
          if (onAction) onAction();
          else if (actionUrl) window.location.href = actionUrl;
        });
      }
    }
  },

  setButtonLoading(btn, isLoading, loadingText = 'Processing...') {
    if (!btn) return;
    if (isLoading) {
      if (!btn.dataset.origText) btn.dataset.origText = btn.innerHTML;
      btn.disabled = true;
      btn.classList.add('opacity-75', 'cursor-not-allowed');
      btn.innerHTML = `
        <span class="inline-flex items-center gap-2">
          <svg class="animate-spin h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>${loadingText}</span>
        </span>
      `;
    } else {
      btn.disabled = false;
      btn.classList.remove('opacity-75', 'cursor-not-allowed');
      if (btn.dataset.origText) {
        btn.innerHTML = btn.dataset.origText;
        delete btn.dataset.origText;
      }
    }
  },

  renderSkeletonGrid(container, count = 6) {
    if (!container) return;
    container.innerHTML = Array(count).fill(0).map(() => `
      <div class="bg-white rounded-xl sm:rounded-2xl border border-[#F8E8E8] shadow-xs animate-pulse overflow-hidden flex flex-col">
        <div class="w-full aspect-square bg-gray-200"></div>
        <div class="p-2.5 sm:p-4 space-y-2 flex-1 flex flex-col justify-between">
          <div class="space-y-1.5">
            <div class="flex justify-between">
              <div class="h-3 bg-gray-200 rounded w-1/3"></div>
              <div class="h-3 bg-gray-200 rounded w-1/5"></div>
            </div>
            <div class="h-3.5 bg-gray-200 rounded w-3/4"></div>
            <div class="h-3.5 bg-gray-200 rounded w-1/2"></div>
          </div>
          <div class="flex justify-between items-center pt-2 border-t border-[#F8E8E8]">
            <div class="h-4 bg-gray-200 rounded w-2/5"></div>
            <div class="h-6 w-6 sm:h-7 sm:w-12 bg-gray-200 rounded-lg"></div>
          </div>
        </div>
      </div>
    `).join('');
  },

  renderSkeletonTable(container, rows = 4, cols = 5) {
    if (!container) return;
    container.innerHTML = Array(rows).fill(0).map(() => `
      <tr class="animate-pulse border-b border-gray-100">
        ${Array(cols).fill(0).map(() => `
          <td class="px-6 py-4"><div class="h-4 bg-gray-200 rounded w-full"></div></td>
        `).join('')}
      </tr>
    `).join('');
  },

  initPWA() {
    if (typeof document === 'undefined') return;

    if (!document.querySelector('link[rel="manifest"]')) {
      const manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      manifestLink.href = '/manifest.json';
      document.head.appendChild(manifestLink);
    }
    if (!document.querySelector('meta[name="theme-color"]')) {
      const metaTheme = document.createElement('meta');
      metaTheme.name = 'theme-color';
      metaTheme.content = '#1C1C1E';
      document.head.appendChild(metaTheme);
    }
    if (!document.querySelector('link[rel="apple-touch-icon"]')) {
      const appleIcon = document.createElement('link');
      appleIcon.rel = 'apple-touch-icon';
      appleIcon.href = '/favicon.svg';
      document.head.appendChild(appleIcon);
    }
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }
};

// Global attachment for convenience in plain scripts
if (typeof window !== 'undefined') {
  window.UI = UI;
}
