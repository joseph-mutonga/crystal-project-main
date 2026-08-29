/**
 * Crystal Crest - Homepage Logic (index.js - KSh Shillings Currency)
 * Bestsellers grid, quick add to cart, newsletter subscription.
 */

import { UI } from '../shared/ui.js';
import { ApiService } from '../shared/api.js';
import { CartStore } from '../shared/cart.js';

document.addEventListener('DOMContentLoaded', async () => {
  UI.initHeader('home');
  UI.initFooter();

  await loadBestsellers();
  setupNewsletterForm();
});

async function loadBestsellers() {
  const container = document.getElementById('featured-grid') || document.getElementById('bestsellers-grid');
  if (!container) return;

  try {
    const products = await ApiService.getProducts();
    const bestsellers = products.filter(p => p.is_bestseller || p.isBestseller).slice(0, 8);
    const displayItems = bestsellers.length > 0 ? bestsellers : products.slice(0, 8);

    if (!displayItems || displayItems.length === 0) {
      container.innerHTML = `<div class="col-span-full text-center text-xs text-gray-400 py-8">Loading catalog...</div>`;
      return;
    }

    container.innerHTML = displayItems.map(product => {
      const priceNum = typeof product.price === 'number' ? product.price : (parseFloat(product.price) || 0);
      const ratingNum = typeof product.rating === 'number' ? product.rating : (parseFloat(product.rating) || 4.9);
      const mainImg = (product.images && product.images[0]) || product.image || 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80';
      const categoryName = product.category || product.category_name || 'Cosmetics';
      const isWish = CartStore.isWishlisted(product.id);

      return `
        <div class="glass-card rounded-2xl border border-rose/25 hover:border-rose/60 hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col group relative bg-white/95 backdrop-blur-sm cursor-pointer" onclick="window.location.href='product.html?id=${product.id}'">
          
          <!-- Target Group / Spa Badge (if any) -->
          ${product.target_group ? `
            <span class="absolute top-2 left-2 z-10 px-2 py-0.5 bg-deep-purple/90 backdrop-blur-md text-ivory text-[9px] sm:text-[10px] font-bold uppercase tracking-wider rounded-md shadow-xs">
              ${product.target_group}'s
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

    // Attach Wishlist heart click handlers
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

  } catch (e) {
    console.error('Error loading bestsellers:', e);
  }
}

function setupNewsletterForm() {
  const form = document.getElementById('newsletter-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const emailInput = form.querySelector('input[type="email"]');
    const email = emailInput ? emailInput.value.trim() : '';

    if (!email) return;

    try {
      await ApiService.subscribeNewsletter(email);
      UI.showToast("Thank you for subscribing to Crystal Crest.", "Subscribed");
      if (emailInput) emailInput.value = '';
    } catch (err) {
      UI.showToast(err.message || "Newsletter subscription error.");
    }
  });
}
