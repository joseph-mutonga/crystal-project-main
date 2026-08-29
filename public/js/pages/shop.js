/**
 * Crystal Crest - Shop Page Logic (shop.js)
 * Filtering for Cosmetics, Luxury Shoes (Men/Women/Kids), and Spa Services with Session Bookings in KSh.
 * Persistent search and category filter state across navigation.
 */

import { UI } from '../shared/ui.js';
import { ApiService } from '../shared/api.js';
import { CartStore } from '../shared/cart.js';

let state = {
  category: 'all',
  minPrice: 0,
  maxPrice: 50000,
  minRating: 0,
  searchQuery: '',
  sortBy: 'featured'
};

document.addEventListener('DOMContentLoaded', async () => {
  UI.initHeader('shop');
  UI.initFooter();

  // Restore search query & category from URL query parameters or sessionStorage
  const urlParams = new URLSearchParams(window.location.search);
  const categoryParam = urlParams.get('category') || sessionStorage.getItem('crystal_crest_cat');
  const searchParam = urlParams.get('search') || sessionStorage.getItem('crystal_crest_search');

  if (categoryParam) {
    state.category = categoryParam;
  }
  if (searchParam) {
    state.searchQuery = searchParam;
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = searchParam;
  }

  await renderCategoriesList();
  await loadAndRenderProducts();

  setupEventListeners();
});

function syncStateToUrlAndStorage() {
  try {
    sessionStorage.setItem('crystal_crest_cat', state.category);
    sessionStorage.setItem('crystal_crest_search', state.searchQuery);

    const newUrl = new URL(window.location);
    if (state.category && state.category !== 'all') {
      newUrl.searchParams.set('category', state.category);
    } else {
      newUrl.searchParams.delete('category');
    }

    if (state.searchQuery) {
      newUrl.searchParams.set('search', state.searchQuery);
    } else {
      newUrl.searchParams.delete('search');
    }

    window.history.replaceState({}, '', newUrl);
  } catch (e) {}
}

async function renderCategoriesList() {
  const container = document.getElementById('category-filter-list');
  const quickPillsContainer = document.querySelector('[data-quick-cat]')?.parentElement;
  
  try {
    const categories = await ApiService.getCategories();
    const allCat = { id: 'all', name: 'All Products', slug: 'all' };
    const list = [allCat, ...categories.filter(c => c.id !== 'all')];

    // 1. Sidebar radio list
    if (container) {
      container.innerHTML = list.map(cat => {
        const isSelected = state.category.toLowerCase() === cat.id.toLowerCase() || state.category.toLowerCase() === cat.slug.toLowerCase();
        return `
          <label class="flex items-center justify-between cursor-pointer p-1.5 rounded-lg hover:bg-blush/50 transition-colors">
            <div class="flex items-center gap-2">
              <input type="radio" name="category-filter" value="${cat.id}" ${isSelected ? 'checked' : ''} class="accent-deep-purple">
              <span class="${isSelected ? 'font-bold text-deep-purple' : 'text-charcoal'}">${cat.name}</span>
            </div>
          </label>
        `;
      }).join('');

      container.querySelectorAll('input[name="category-filter"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
          setCategory(e.target.value);
        });
      });
    }

    // 2. Mobile wrapping pills bar
    if (quickPillsContainer) {
      quickPillsContainer.className = "flex flex-wrap items-center gap-2 pb-2 text-xs font-semibold w-full";
      quickPillsContainer.innerHTML = list.map(cat => {
        const isSelected = state.category.toLowerCase() === cat.id.toLowerCase() || state.category.toLowerCase() === (cat.slug || '').toLowerCase();
        return `
          <button data-quick-cat="${cat.id}" class="quick-cat-btn px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full border text-[11px] sm:text-xs font-semibold transition-all ${isSelected ? 'border-deep-purple bg-deep-purple text-white shadow-sm' : 'border-blush bg-white text-charcoal hover:border-deep-purple'}">
            ${cat.name}
          </button>
        `;
      }).join('');

      quickPillsContainer.querySelectorAll('.quick-cat-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const catVal = e.currentTarget.getAttribute('data-quick-cat');
          setCategory(catVal);
        });
      });
    }

  } catch (e) {
    console.error('Failed to load categories:', e);
  }
}

function setCategory(catVal) {
  state.category = catVal;
  syncStateToUrlAndStorage();

  // Update pills UI
  document.querySelectorAll('.quick-cat-btn').forEach(b => {
    const val = b.getAttribute('data-quick-cat');
    const isSel = val.toLowerCase() === catVal.toLowerCase();
    b.className = `quick-cat-btn px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full border text-[11px] sm:text-xs font-semibold transition-all ${isSel ? 'border-deep-purple bg-deep-purple text-white shadow-sm' : 'border-blush bg-white text-charcoal hover:border-deep-purple'}`;
  });

  // Update sidebar radio
  const radio = document.querySelector(`input[name="category-filter"][value="${catVal}"]`);
  if (radio) radio.checked = true;

  loadAndRenderProducts();
}

function setupEventListeners() {
  const priceRange = document.getElementById('price-range');
  const priceVal = document.getElementById('price-slider-value');
  if (priceRange && priceVal) {
    priceRange.addEventListener('input', (e) => {
      state.maxPrice = parseFloat(e.target.value);
      priceVal.textContent = `KSh ${state.maxPrice.toLocaleString()}`;
      loadAndRenderProducts();
    });
  }

  document.querySelectorAll('input[name="rating-filter"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      state.minRating = parseFloat(e.target.value);
      loadAndRenderProducts();
    });
  });

  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    let timeout = null;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        state.searchQuery = e.target.value.trim();
        syncStateToUrlAndStorage();
        loadAndRenderProducts();
      }, 300);
    });
  }

  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      state.sortBy = e.target.value;
      loadAndRenderProducts();
    });
  }

  const resetBtn = document.getElementById('reset-filters-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      state = {
        category: 'all',
        minPrice: 0,
        maxPrice: 50000,
        minRating: 0,
        searchQuery: '',
        sortBy: 'featured'
      };

      if (priceRange) priceRange.value = 50000;
      if (priceVal) priceVal.textContent = 'KSh 50,000';
      if (searchInput) searchInput.value = '';
      if (sortSelect) sortSelect.value = 'featured';

      syncStateToUrlAndStorage();
      setCategory('all');
      document.querySelectorAll('input[name="rating-filter"]').forEach(r => r.checked = r.value === "0");
      loadAndRenderProducts();
    });
  }
}

async function loadAndRenderProducts() {
  const container = document.getElementById('shop-product-grid');
  const countEl = document.getElementById('results-count');
  if (!container) return;

  UI.renderSkeletonGrid(container, 6);

  try {
    const params = {
      category: state.category,
      minPrice: state.minPrice,
      maxPrice: state.maxPrice,
      search: state.searchQuery,
      sort: state.sortBy
    };

    const products = await ApiService.getProducts(params);

    const filtered = products.filter(item => {
      const r = typeof item.rating === 'number' ? item.rating : (parseFloat(item.rating) || 5.0);
      return r >= state.minRating;
    });

    if (countEl) {
      countEl.textContent = `Showing ${filtered.length} item${filtered.length === 1 ? '' : 's'}`;
    }

    if (filtered.length === 0) {
      UI.renderEmptyState(container, {
        icon: '🔍',
        title: 'No Matching Formulations Found',
        message: 'No items match your search or filter settings. Try adjusting your search query.',
        actionText: 'Reset Filters',
        onAction: () => {
          document.getElementById('reset-filters-btn')?.click();
        }
      });
      return;
    }

    renderProductGrid(filtered, container);

  } catch (e) {
    console.error('Error fetching catalog:', e);
    UI.renderEmptyState(container, {
      icon: '⚠️',
      title: 'Unable to Load Products',
      message: 'Please check your connection and try again.',
      actionText: 'Retry Loading',
      onAction: () => loadAndRenderProducts()
    });
  }
}

function renderProductGrid(products, container) {
  container.innerHTML = products.map(product => {
    const mainImg = (product.images && product.images[0]) || product.image || 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80';
    const categoryName = product.category || product.category_name || 'Cosmetics';
    const priceNum = typeof product.price === 'number' ? product.price : (parseFloat(product.price) || 0);
    const ratingNum = typeof product.rating === 'number' ? product.rating : (parseFloat(product.rating) || 5.0);
    const isWish = CartStore.isWishlisted(product.id);

    return `
      <div class="glass-card rounded-2xl border border-rose/25 hover:border-rose/60 hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col group relative bg-white/95 backdrop-blur-sm cursor-pointer" onclick="window.location.href='product.html?id=${product.id}'">
        
        <!-- Target Group / Spa Badge (if any) -->
        ${product.target_group ? `
          <span class="absolute top-2 left-2 z-10 px-2 py-0.5 bg-deep-purple/90 backdrop-blur-md text-ivory text-[9px] sm:text-[10px] font-bold uppercase tracking-wider rounded-md shadow-xs">
            ${product.target_group}'s
          </span>
        ` : product.spa_type ? `
          <span class="absolute top-2 left-2 z-10 px-2 py-0.5 bg-rose/90 backdrop-blur-md text-charcoal text-[9px] sm:text-[10px] font-bold uppercase tracking-wider rounded-md shadow-xs">
            ${product.spa_type}
          </span>
        ` : ''}

        <!-- Wishlist Heart Overlay Button -->
        <button data-wishlist-toggle="${product.id}" class="wishlist-heart-btn absolute top-2 right-2 z-10 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/90 backdrop-blur-md border border-rose/30 flex items-center justify-center text-charcoal/60 hover:text-rose hover:scale-110 active:scale-95 transition-all shadow-sm" title="Add to Wishlist" aria-label="Toggle wishlist">
          <svg class="w-3.5 h-3.5 sm:w-4 sm:h-4 ${isWish ? 'fill-[#E8C500] text-[#E8C500]' : 'fill-none text-current'}" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.684a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
          </svg>
        </button>

        <!-- Square Product Image -->
        <div class="relative aspect-square overflow-hidden bg-blush/20">
          <img src="${mainImg}" alt="${product.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy">
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
            
            <h3 class="font-semibold text-xs sm:text-sm text-charcoal leading-snug line-clamp-2 group-hover:text-deep-purple transition-colors" title="${product.name}">
              ${product.name}
            </h3>
          </div>

          <div class="pt-1.5 border-t border-blush/60 flex items-center justify-between">
            <span class="font-serif-heading font-bold text-sm sm:text-base text-charcoal block truncate">
              KSh ${priceNum.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Attach Wishlist heart click handlers (stops card navigation)
  container.querySelectorAll('[data-wishlist-toggle]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const prodId = e.currentTarget.getAttribute('data-wishlist-toggle');
      const prod = products.find(p => p.id === prodId);
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
}
