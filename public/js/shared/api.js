/**
 * Crystal Crest - Standardized API Client & Fetch Wrapper
 * Includes credentials (cookies) for authentication, cart management, spa session booking, and order queries.
 */

const BASE_URL = window.location.origin;

async function request(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;
  
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(options.headers || {})
  };

  const config = {
    credentials: 'include',
    ...options,
    headers
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMsg = data.error || data.message || `HTTP ${response.status} ${response.statusText}`;
      const err = new Error(errorMsg);
      err.status = response.status;
      throw err;
    }

    return data;
  } catch (error) {
    if (error.status !== 401) {
      console.warn(`[API Error] ${options.method || 'GET'} ${endpoint}:`, error.message);
      if (typeof window !== 'undefined' && window.UI && typeof window.UI.showToast === 'function') {
        window.UI.showToast(error.message || "Something went wrong, please try again", "Connection Error");
      }
    }
    throw error;
  }
}

export const http = {
  get(endpoint, params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    });

    const queryString = query.toString();
    const fullEndpoint = queryString ? `${endpoint}?${queryString}` : endpoint;
    return request(fullEndpoint, { method: 'GET' });
  },

  post(endpoint, body = {}) {
    return request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },

  put(endpoint, body = {}) {
    return request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  },

  patch(endpoint, body = {}) {
    return request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body)
    });
  },

  delete(endpoint) {
    return request(endpoint, { method: 'DELETE' });
  }
};

export const ApiService = {
  // Auth API
  async signup(data) {
    return http.post('/api/auth/signup', data);
  },

  async login(data) {
    return http.post('/api/auth/login', data);
  },

  async logout() {
    return http.post('/api/auth/logout');
  },

  async getCurrentUser() {
    try {
      const res = await http.get('/api/auth/me');
      return res.user;
    } catch (e) {
      return null;
    }
  },

  // Products & Categories API
  async getProducts(params = {}) {
    try {
      const res = await http.get('/api/products', params);
      return res.data || [];
    } catch (e) {
      return [];
    }
  },

  async getProductById(id) {
    const res = await http.get(`/api/products/${id}`);
    return res.data;
  },

  async getCategories() {
    try {
      const res = await http.get('/api/categories');
      return res.data || [];
    } catch (e) {
      return [];
    }
  },

  // Spa Booking & Time Slots API
  async getSpaSlots(date) {
    try {
      const res = await http.get('/api/spa/slots', { date });
      return res.slots || [];
    } catch (e) {
      return [
        { time: '09:00 AM', isBooked: false, status: 'available' },
        { time: '11:00 AM', isBooked: true, status: 'booked' },
        { time: '01:00 PM', isBooked: false, status: 'available' },
        { time: '03:00 PM', isBooked: false, status: 'available' },
        { time: '05:00 PM', isBooked: true, status: 'booked' },
        { time: '07:00 PM', isBooked: false, status: 'available' }
      ];
    }
  },

  async bookSpaSession(bookingData) {
    return http.post('/api/spa/book', bookingData);
  },

  // Cart API
  async getCart() {
    const res = await http.get('/api/cart');
    return res.items || [];
  },

  async updateCartItem(productId, quantity, selectedSize = null, selectedShade = null) {
    return http.post('/api/cart', { product_id: productId, quantity, selected_size: selectedSize, selected_color: selectedShade });
  },

  async removeCartItem(productId) {
    return http.delete(`/api/cart/${productId}`);
  },

  async mergeGuestCart(items) {
    return http.post('/api/cart/merge', { items });
  },

  // Orders API
  async createOrder(orderData) {
    return http.post('/api/orders', orderData);
  },

  async getMyOrders() {
    const res = await http.get('/api/orders');
    return res.orders || [];
  },

  async getOrderById(id) {
    const res = await http.get(`/api/orders/${id}`);
    return res.order;
  },

  // Newsletter API
  async subscribeNewsletter(email) {
    return http.post('/api/newsletter/subscribe', { email });
  }
};
