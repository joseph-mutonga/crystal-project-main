/**
 * Crystal Crest - Instant Cart State Manager (KSh Shillings Currency)
 * Instant synchronous UI updates for guest & authenticated modes, background DB sync, automatic merge.
 */

import { ApiService } from './api.js';

const STORAGE_KEY = 'crystal_crest_cart';

let currentUser = null;
let cachedCartItems = [];

function getLocalGuestCart() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

function saveLocalGuestCart(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (e) {}
}

function clearLocalGuestCart() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {}
}

cachedCartItems = getLocalGuestCart();

export const CartStore = {
  async init() {
    try {
      currentUser = await ApiService.getCurrentUser();
    } catch (e) {
      currentUser = null;
    }

    if (currentUser) {
      const localGuestItems = getLocalGuestCart();
      if (localGuestItems.length > 0) {
        try {
          await ApiService.mergeGuestCart(localGuestItems);
          clearLocalGuestCart();
        } catch (e) {}
      }
      try {
        cachedCartItems = await ApiService.getCart();
      } catch (e) {}
    } else {
      cachedCartItems = getLocalGuestCart();
    }

    this.notifyUpdate();
  },

  async handleUserLogin(user) {
    currentUser = user;
    const localGuestItems = getLocalGuestCart();

    if (localGuestItems.length > 0) {
      try {
        await ApiService.mergeGuestCart(localGuestItems);
        clearLocalGuestCart();
      } catch (e) {}
    }

    try {
      cachedCartItems = await ApiService.getCart();
    } catch (e) {}
    this.notifyUpdate();
  },

  async handleUserLogout() {
    currentUser = null;
    cachedCartItems = [];
    clearLocalGuestCart();
    this.notifyUpdate();
  },

  notifyUpdate() {
    window.dispatchEvent(new CustomEvent('cartUpdated', { detail: cachedCartItems }));
  },

  getCart() {
    return cachedCartItems;
  },

  isLoggedIn() {
    return !!currentUser;
  },

  getUser() {
    return currentUser;
  },

  async addItem(product, quantity = 1, selectedSize = null, selectedShade = null) {
    const prodId = product.id || product.product_id;
    const size = selectedSize || (product.sizes && product.sizes[0]) || 'Standard';
    const shade = selectedShade || (product.colors && product.colors[0]) || (product.shades && product.shades[0]) || null;
    const price = typeof product.price === 'number' ? product.price : (parseFloat(product.price) || 0);
    const image = (product.images && product.images[0]) || product.image || '';

    const existingIndex = cachedCartItems.findIndex(i =>
      (i.product_id || i.id) === prodId &&
      i.selectedSize === size &&
      i.selectedShade === shade
    );

    if (existingIndex > -1) {
      cachedCartItems[existingIndex].quantity += quantity;
    } else {
      cachedCartItems.push({
        id: prodId,
        product_id: prodId,
        name: product.name,
        category: product.category || product.category_name || 'Cosmetics',
        price: price,
        image: image,
        selectedSize: size,
        selectedShade: shade,
        quantity: quantity
      });
    }

    if (!currentUser) {
      saveLocalGuestCart(cachedCartItems);
    }

    this.notifyUpdate();

    if (currentUser) {
      try {
        const item = cachedCartItems.find(i => (i.product_id || i.id) === prodId);
        const newQty = item ? item.quantity : quantity;
        await ApiService.updateCartItem(prodId, newQty);
        cachedCartItems = await ApiService.getCart();
        this.notifyUpdate();
      } catch (e) {}
    }

    return cachedCartItems;
  },

  async updateQuantity(index, newQty) {
    if (index < 0 || index >= cachedCartItems.length) return cachedCartItems;

    const item = cachedCartItems[index];
    const prodId = item.product_id || item.id;

    if (newQty <= 0) {
      cachedCartItems.splice(index, 1);
    } else {
      cachedCartItems[index].quantity = newQty;
    }

    if (!currentUser) {
      saveLocalGuestCart(cachedCartItems);
    }

    this.notifyUpdate();

    if (currentUser) {
      try {
        if (newQty <= 0) {
          await ApiService.removeCartItem(prodId);
        } else {
          await ApiService.updateCartItem(prodId, newQty);
        }
        cachedCartItems = await ApiService.getCart();
        this.notifyUpdate();
      } catch (e) {}
    }

    return cachedCartItems;
  },

  async removeItem(index) {
    if (index < 0 || index >= cachedCartItems.length) return cachedCartItems;

    const item = cachedCartItems[index];
    const prodId = item.product_id || item.id;

    cachedCartItems.splice(index, 1);

    if (!currentUser) {
      saveLocalGuestCart(cachedCartItems);
    }

    this.notifyUpdate();

    if (currentUser) {
      try {
        await ApiService.removeCartItem(prodId);
        cachedCartItems = await ApiService.getCart();
        this.notifyUpdate();
      } catch (e) {}
    }

    return cachedCartItems;
  },

  async clearCart() {
    cachedCartItems = [];
    clearLocalGuestCart();
    this.notifyUpdate();
  },

  getItemCount() {
    return cachedCartItems.reduce((total, item) => total + (parseInt(item.quantity) || 0), 0);
  },

  getTotals(fulfillmentType = 'delivery') {
    const subtotal = cachedCartItems.reduce((total, item) => {
      const p = typeof item.price === 'number' ? item.price : (parseFloat(item.price) || 0);
      const q = parseInt(item.quantity) || 1;
      return total + (p * q);
    }, 0);

    const isPickup = (fulfillmentType || '').toLowerCase() === 'pickup';
    // When picking up in store: FREE (KSh 0); When for delivery around Kajiado Town: default KSh 100
    const shipping = isPickup || subtotal === 0 ? 0 : 100;
    const tax = 0; // Tax included in formulation prices
    const grandTotal = subtotal + shipping + tax;

    return {
      subtotal,
      shipping,
      tax,
      grandTotal,
      fulfillmentType: isPickup ? 'pickup' : 'delivery'
    };
  },

  // Wishlist State Management
  getWishlist() {
    try {
      const data = localStorage.getItem('crystal_crest_wishlist');
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },

  isWishlisted(productId) {
    if (!productId) return false;
    const list = this.getWishlist();
    return list.some(item => (item.id || item) === productId);
  },

  toggleWishlist(product) {
    if (!product) return false;
    const list = this.getWishlist();
    const prodId = typeof product === 'string' ? product : (product.id || product.product_id);
    const existingIndex = list.findIndex(item => (item.id || item) === prodId);

    let isAdded = false;
    if (existingIndex > -1) {
      list.splice(existingIndex, 1);
      isAdded = false;
    } else {
      const itemObj = typeof product === 'object' ? {
        id: product.id || prodId,
        name: product.name,
        price: product.price,
        image: (product.images && product.images[0]) || product.image,
        category: product.category || product.category_name
      } : { id: prodId };
      list.push(itemObj);
      isAdded = true;
    }

    try {
      localStorage.setItem('crystal_crest_wishlist', JSON.stringify(list));
    } catch (e) {}

    window.dispatchEvent(new CustomEvent('wishlistUpdated', { detail: { list, isAdded, productId: prodId } }));
    return isAdded;
  },

  getWishlistCount() {
    return this.getWishlist().length;
  }
};

CartStore.init();
