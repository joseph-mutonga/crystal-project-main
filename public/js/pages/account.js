/**
 * Crystal Crest - Customer Account Page Logic (account.js)
 * Signup, Login, Logout, Order History display, Password visibility toggle, and Admin Role Redirection.
 */

import { UI } from '../shared/ui.js';
import { http, ApiService } from '../shared/api.js';
import { CartStore } from '../shared/cart.js';

document.addEventListener('DOMContentLoaded', async () => {
  UI.initHeader('account');
  UI.initFooter();

  await checkAuthStatus();
  setupAuthTabs();
  setupForms();
  setupPasswordToggle();
});

async function checkAuthStatus() {
  const user = await ApiService.getCurrentUser();
  const authSection = document.getElementById('auth-section');
  const profileSection = document.getElementById('profile-section');

  if (user) {
    if (user.role === 'admin') {
      window.location.href = 'admin/dashboard.html';
      return;
    }

    authSection.classList.add('hidden');
    profileSection.classList.remove('hidden');
    
    document.getElementById('user-name-heading').textContent = user.full_name || 'Valued Customer';
    document.getElementById('user-email-label').textContent = user.email;
    document.getElementById('user-avatar').textContent = (user.full_name || 'U').charAt(0).toUpperCase();

    await loadOrderHistory();
    loadAccountWishlist();
  } else {
    profileSection.classList.add('hidden');
    authSection.classList.remove('hidden');
  }
}

function loadAccountWishlist() {
  const container = document.getElementById('account-wishlist-grid');
  const countBadge = document.getElementById('account-wishlist-count-badge');
  if (!container) return;

  const wishlist = CartStore.getWishlist();

  if (countBadge) {
    countBadge.textContent = `${wishlist.length} Saved Item${wishlist.length === 1 ? '' : 's'}`;
  }

  if (wishlist.length === 0) {
    UI.renderEmptyState(container, {
      icon: '🤍',
      title: 'No Saved Wishlist Items',
      message: 'Explore our boutique catalog and tap the heart on any product to save it here.',
      actionText: 'Browse Collection',
      actionUrl: 'shop.html'
    });
    return;
  }

  container.innerHTML = wishlist.map(product => {
    const priceNum = typeof product.price === 'number' ? product.price : (parseFloat(product.price) || 0);
    const mainImg = (product.images && product.images[0]) || product.image || 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80';
    const prodId = product.id || product.product_id;

    return `
      <div class="glass-card rounded-2xl border border-rose/25 hover:border-rose/60 hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col group relative bg-white/95 backdrop-blur-sm cursor-pointer" onclick="window.location.href='product.html?id=${prodId}'">
        
        <!-- Wishlist Remove Overlay Button -->
        <button data-account-wishlist-remove="${prodId}" class="absolute top-2 right-2 z-10 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/90 backdrop-blur-md border border-rose/30 flex items-center justify-center text-[#E8C500] hover:text-red-500 hover:scale-110 active:scale-95 transition-all shadow-sm" title="Remove from wishlist" aria-label="Remove from wishlist">
          <svg class="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" viewBox="0 0 24 24">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
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
            <span class="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-deep-purple truncate block">${product.category || 'Cosmetics'}</span>
            <h4 class="font-semibold text-xs sm:text-sm text-charcoal leading-snug line-clamp-2 group-hover:text-deep-purple transition-colors" title="${product.name}">
              ${product.name}
            </h4>
          </div>

          <div class="pt-1.5 border-t border-blush/60 flex items-center justify-between">
            <span class="font-serif-heading font-bold text-sm sm:text-base text-charcoal block truncate">
              KSh ${priceNum.toLocaleString()}
            </span>
            <span class="text-[10px] text-deep-purple font-bold uppercase tracking-wider">View</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('[data-account-wishlist-remove]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const prodId = e.currentTarget.getAttribute('data-account-wishlist-remove');
      CartStore.toggleWishlist(prodId);
      UI.showToast('Item removed from wishlist');
      loadAccountWishlist();
    });
  });
}

function setupPasswordToggle() {
  document.querySelectorAll('.toggle-password-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetId = e.currentTarget.getAttribute('data-target');
      const input = document.getElementById(targetId);
      if (!input) return;

      if (input.type === 'password') {
        input.type = 'text';
        e.currentTarget.innerHTML = `
          <svg class="w-4 h-4 text-deep-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a10.025 10.025 0 013.98-.863c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m-2.73-2.73a3 3 0 00-4.243-4.243M3 3l18 18"/>
          </svg>
        `;
      } else {
        input.type = 'password';
        e.currentTarget.innerHTML = `
          <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
          </svg>
        `;
      }
    });
  });
}

function setupAuthTabs() {
  const tabLogin = document.getElementById('tab-btn-login');
  const tabSignup = document.getElementById('tab-btn-signup');
  const formLogin = document.getElementById('login-form');
  const formSignup = document.getElementById('signup-form');
  const forgotPasswordForm = document.getElementById('forgot-password-form');
  const otpLoginForm = document.getElementById('otp-login-form');
  const alertBox = document.getElementById('auth-alert');

  tabLogin.addEventListener('click', () => {
    alertBox.classList.add('hidden');
    tabLogin.className = "flex-1 pb-3 border-b-2 border-deep-purple text-deep-purple transition-colors";
    tabSignup.className = "flex-1 pb-3 border-b-2 border-transparent text-charcoal/60 hover:text-charcoal transition-colors";
    formLogin.classList.remove('hidden');
    formSignup.classList.add('hidden');
    forgotPasswordForm.classList.add('hidden');
    otpLoginForm?.classList.add('hidden');
  });

  tabSignup.addEventListener('click', () => {
    alertBox.classList.add('hidden');
    tabSignup.className = "flex-1 pb-3 border-b-2 border-deep-purple text-deep-purple transition-colors";
    tabLogin.className = "flex-1 pb-3 border-b-2 border-transparent text-charcoal/60 hover:text-charcoal transition-colors";
    formSignup.classList.remove('hidden');
    formLogin.classList.add('hidden');
    forgotPasswordForm.classList.add('hidden');
    otpLoginForm?.classList.add('hidden');
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

function setupForms() {
  const formLogin = document.getElementById('login-form');
  const formSignup = document.getElementById('signup-form');
  const forgotPasswordForm = document.getElementById('forgot-password-form');
  const otpLoginForm = document.getElementById('otp-login-form');
  const alertBox = document.getElementById('auth-alert');
  const logoutBtn = document.getElementById('logout-btn');
  let cashierOtpRequired = false;
  let otpLoginCooldownTimer = null;

  function showAlert(msg, isError = true) {
    alertBox.textContent = msg;
    alertBox.className = `p-3 rounded-xl text-xs text-center border font-medium ${isError ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`;
    alertBox.classList.remove('hidden');
  }

  function showLoginForm() {
    forgotPasswordForm.reset();
    document.getElementById('reset-verification-step').classList.add('hidden');
    otpLoginForm?.reset();
    document.getElementById('otp-login-verify-step')?.classList.add('hidden');
    document.getElementById('otp-login-email-step')?.classList.remove('hidden');
    if (otpLoginCooldownTimer) {
      clearInterval(otpLoginCooldownTimer);
      otpLoginCooldownTimer = null;
    }
    formLogin.classList.remove('hidden');
    formSignup.classList.add('hidden');
    forgotPasswordForm.classList.add('hidden');
    otpLoginForm?.classList.add('hidden');
  }

  document.getElementById('open-forgot-password-btn')?.addEventListener('click', () => {
    alertBox.classList.add('hidden');
    document.getElementById('reset-email').value = document.getElementById('login-email').value.trim();
    formLogin.classList.add('hidden');
    formSignup.classList.add('hidden');
    forgotPasswordForm.classList.remove('hidden');
    document.getElementById('reset-email').focus();
  });

  document.getElementById('back-to-login-btn')?.addEventListener('click', showLoginForm);

  document.getElementById('send-reset-code-btn')?.addEventListener('click', async (event) => {
    const email = document.getElementById('reset-email').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showAlert('Enter a valid email address.', true);
      return;
    }

    UI.setButtonLoading(event.currentTarget, true, 'Sending...');
    try {
      const response = await http.post('/api/auth/forgot-password', { email });
      if (!response.success) throw new Error(response.error || 'Unable to send reset code.');
      document.getElementById('reset-verification-step').classList.remove('hidden');
      document.getElementById('reset-otp').focus();
      showAlert(response.message, false);
    } catch (error) {
      showAlert(error.message || 'Unable to send reset code.', true);
    } finally {
      UI.setButtonLoading(event.currentTarget, false);
    }
  });

  forgotPasswordForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.getElementById('reset-email').value.trim();
    const otp = document.getElementById('reset-otp').value.trim();
    const password = document.getElementById('reset-password').value;
    const passwordConfirm = document.getElementById('reset-password-confirm').value;
    const submitButton = document.getElementById('reset-password-submit-btn');

    if (!/^\d{6}$/.test(otp)) {
      showAlert('Enter the 6-digit verification code.', true);
      return;
    }
    if (password.length < 6) {
      showAlert('Password must be at least 6 characters long.', true);
      return;
    }
    if (password !== passwordConfirm) {
      showAlert('The new passwords do not match.', true);
      return;
    }

    UI.setButtonLoading(submitButton, true, 'Updating...');
    try {
      const response = await http.post('/api/auth/reset-password', { email, otp, password });
      if (!response.success) throw new Error(response.error || 'Unable to reset password.');
      document.getElementById('login-email').value = email;
      showAlert('Password updated. Sign in with your new password.', false);
      showLoginForm();
    } catch (error) {
      showAlert(error.message || 'Unable to reset password.', true);
    } finally {
      UI.setButtonLoading(submitButton, false);
    }
  });

  // ---------------------------------------------------------------------
  // EMAIL OTP (PASSWORDLESS) LOGIN
  // ---------------------------------------------------------------------
  function startOtpLoginCooldown(seconds) {
    const resendBtn = document.getElementById('resend-otp-login-btn');
    const cooldownLabel = document.getElementById('otp-login-cooldown');
    if (!resendBtn || !cooldownLabel) return;

    if (otpLoginCooldownTimer) clearInterval(otpLoginCooldownTimer);
    let remaining = seconds;
    resendBtn.disabled = true;
    cooldownLabel.textContent = remaining;

    otpLoginCooldownTimer = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(otpLoginCooldownTimer);
        otpLoginCooldownTimer = null;
        resendBtn.disabled = false;
        resendBtn.innerHTML = 'Resend code';
      } else {
        cooldownLabel.textContent = remaining;
      }
    }, 1000);
  }

  async function requestLoginOtp(email, { isResend = false } = {}) {
    const response = await http.post('/api/auth/request-otp', { email });
    if (!response.success) throw new Error(response.error || 'Unable to send verification code.');
    const cooldownSeconds = Number(response.cooldownSeconds) || 60;
    const resendBtn = document.getElementById('resend-otp-login-btn');
    if (resendBtn) {
      resendBtn.innerHTML = `Resend code in <span id="otp-login-cooldown">${cooldownSeconds}</span>s`;
    }
    startOtpLoginCooldown(cooldownSeconds);
    showAlert(response.message || 'If an account exists for this email, a verification code has been sent.', false);
    return response;
  }

  document.getElementById('open-otp-login-btn')?.addEventListener('click', () => {
    alertBox.classList.add('hidden');
    clearInlineErrors();
    document.getElementById('otp-login-email').value = document.getElementById('login-email').value.trim();
    document.getElementById('otp-login-verify-step')?.classList.add('hidden');
    document.getElementById('otp-login-email-step')?.classList.remove('hidden');
    formLogin.classList.add('hidden');
    formSignup.classList.add('hidden');
    forgotPasswordForm.classList.add('hidden');
    otpLoginForm?.classList.remove('hidden');
    document.getElementById('otp-login-email').focus();
  });

  document.getElementById('otp-back-to-login-btn')?.addEventListener('click', showLoginForm);

  document.getElementById('send-otp-login-code-btn')?.addEventListener('click', async (event) => {
    const emailEl = document.getElementById('otp-login-email');
    const email = emailEl.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showAlert('Enter a valid email address.', true);
      return;
    }

    UI.setButtonLoading(event.currentTarget, true, 'Sending...');
    try {
      await requestLoginOtp(email);
      document.getElementById('otp-login-email-step').classList.add('hidden');
      document.getElementById('otp-login-verify-step').classList.remove('hidden');
      document.getElementById('otp-login-code').focus();
    } catch (error) {
      showAlert(error.message || 'Unable to send verification code.', true);
    } finally {
      UI.setButtonLoading(event.currentTarget, false);
    }
  });

  document.getElementById('resend-otp-login-btn')?.addEventListener('click', async (event) => {
    const email = document.getElementById('otp-login-email').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showAlert('Enter a valid email address.', true);
      return;
    }
    try {
      await requestLoginOtp(email, { isResend: true });
    } catch (error) {
      showAlert(error.message || 'Unable to resend verification code.', true);
    }
  });

  otpLoginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    alertBox.classList.add('hidden');

    const email = document.getElementById('otp-login-email').value.trim();
    const otp = document.getElementById('otp-login-code').value.trim();
    const submitBtn = document.getElementById('verify-otp-login-btn');

    if (!/^\d{6}$/.test(otp)) {
      showAlert('Enter the 6-digit verification code.', true);
      return;
    }

    UI.setButtonLoading(submitBtn, true, 'Verifying...');
    try {
      const response = await http.post('/api/auth/verify-otp', { email, otp });
      if (!response.success) throw new Error(response.error || 'Invalid or expired verification code.');
      if (otpLoginCooldownTimer) {
        clearInterval(otpLoginCooldownTimer);
        otpLoginCooldownTimer = null;
      }
      if (response.user) {
        UI.showToast(`Welcome back, ${response.user.full_name}!`, "Authenticated", "success");
        await CartStore.handleUserLogin(response.user);
        if (response.user.role === 'admin') {
          window.location.href = 'admin/dashboard.html';
        } else {
          await checkAuthStatus();
        }
      }
    } catch (error) {
      showAlert(error.message || 'Invalid or expired verification code.', true);
    } finally {
      UI.setButtonLoading(submitBtn, false);
    }
  });

  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearInlineErrors();
    alertBox.classList.add('hidden');

    const emailEl = document.getElementById('login-email');
    const passEl = document.getElementById('login-password');
    const submitBtn = formLogin.querySelector('button[type="submit"]');

    const email = emailEl.value.trim();
    const password = passEl.value;
    const otp = document.getElementById('cashier-login-otp')?.value.trim() || '';

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let isValid = true;

    if (!email || !emailRegex.test(email)) {
      showInlineError(emailEl, 'Please enter a valid email address.');
      isValid = false;
    }
    if (!password) {
      showInlineError(passEl, 'Password is required.');
      isValid = false;
    }

    if (!isValid) return;

    UI.setButtonLoading(submitBtn, true, 'Signing in...');

    try {
      const res = await ApiService.login(cashierOtpRequired ? { email, password, otp } : { email, password });
      if (res.requiresCashierOtp) {
        cashierOtpRequired = true;
        document.getElementById('cashier-otp-step')?.classList.remove('hidden');
        document.getElementById('cashier-login-otp')?.focus();
        showAlert('Enter the 4-digit OTP provided by your administrator.', false);
        return;
      }
      if (res.cashierLogin) {
        window.location.href = 'cashier/dashboard.html';
        return;
      }
      if (res.user) {
        UI.showToast(`Welcome back, ${res.user.full_name}!`, "Authenticated", "success");
        await CartStore.handleUserLogin(res.user);

        if (res.user.role === 'admin') {
          window.location.href = 'admin/dashboard.html';
        } else {
          await checkAuthStatus();
        }
      }
    } catch (err) {
      showAlert(err.message || 'Login failed. Invalid email or password.');
    } finally {
      UI.setButtonLoading(submitBtn, false);
    }
  });

  formSignup.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearInlineErrors();
    alertBox.classList.add('hidden');

    const nameEl = document.getElementById('signup-name');
    const emailEl = document.getElementById('signup-email');
    const phoneEl = document.getElementById('signup-phone');
    const passEl = document.getElementById('signup-password');
    const submitBtn = formSignup.querySelector('button[type="submit"]');

    const full_name = nameEl.value.trim();
    const email = emailEl.value.trim();
    const phone = phoneEl.value.trim();
    const password = passEl.value;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let isValid = true;

    if (!full_name) {
      showInlineError(nameEl, 'Full name is required.');
      isValid = false;
    }
    if (!email || !emailRegex.test(email)) {
      showInlineError(emailEl, 'Please enter a valid email address.');
      isValid = false;
    }
    if (password.length < 6) {
      showInlineError(passEl, 'Password must be at least 6 characters.');
      isValid = false;
    }

    if (!isValid) return;

    UI.setButtonLoading(submitBtn, true, 'Creating Account...');

    try {
      const res = await ApiService.signup({ full_name, email, phone, password });
      if (res.user) {
        UI.showToast(`Welcome to Crystal Crest, ${res.user.full_name}!`, "Account Created", "success");
        await CartStore.handleUserLogin(res.user);

        if (res.user.role === 'admin') {
          window.location.href = 'admin/dashboard.html';
        } else {
          await checkAuthStatus();
        }
      }
    } catch (err) {
      showAlert(err.message || 'Registration failed. Email may already exist.');
    } finally {
      UI.setButtonLoading(submitBtn, false);
    }
  });

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await ApiService.logout();
        await CartStore.handleUserLogout();
        UI.showToast("Signed out successfully.", "Logged Out");
        await checkAuthStatus();
      } catch (e) {
        console.error('Logout error', e);
      }
    });
  }
}

async function loadOrderHistory() {
  const container = document.getElementById('order-history-list');
  const countBadge = document.getElementById('order-count-badge');
  if (!container) return;

  container.innerHTML = `
    <div class="space-y-4 animate-pulse">
      <div class="h-24 bg-blush/60 rounded-2xl"></div>
      <div class="h-24 bg-blush/60 rounded-2xl"></div>
    </div>
  `;

  try {
    const orders = await ApiService.getMyOrders();
    
    if (countBadge) {
      countBadge.textContent = `${orders.length} Order${orders.length === 1 ? '' : 's'} Placed`;
    }

    if (!orders || orders.length === 0) {
      UI.renderEmptyState(container, {
        icon: '📦',
        title: 'No Orders Placed Yet',
        message: 'Explore our haute-couture cosmetics, luxury shoes, and rare fragrances.',
        actionText: 'Start Shopping',
        actionUrl: 'shop.html'
      });
      return;
    }

    container.innerHTML = orders.map(order => {
      const orderDate = new Date(order.created_at || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      const orderTotal = typeof order.total === 'number' ? order.total : (parseFloat(order.total) || 0);

      return `
        <div class="glass-card rounded-2xl p-6 space-y-4 border border-blush hover:border-rose/50 transition-colors">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-blush gap-2 text-xs">
            <div>
              <span class="font-bold text-charcoal text-sm">Order #${order.order_number || order.id}</span>
              <span class="text-gray-400 ml-2">• Placed on ${orderDate}</span>
            </div>

            <div class="flex items-center gap-3">
              <span class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${order.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose/20 text-charcoal'}">
                ${order.status || 'Processing'}
              </span>
              <span class="font-serif-heading text-lg font-bold text-deep-purple">KSh ${orderTotal.toLocaleString()}</span>
            </div>
          </div>

          <div class="space-y-2">
            ${(order.items || []).map(item => `
              <div class="flex items-center justify-between text-xs p-2 bg-white/60 rounded-xl">
                <div class="flex items-center gap-3">
                  <img src="${item.image || (item.images && item.images[0]) || 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80'}" alt="${item.name}" class="w-10 h-10 object-cover rounded-lg bg-blush">
                  <div>
                    <h4 class="font-bold text-charcoal">${item.name || 'Cosmetics Item'}</h4>
                    <p class="text-[10px] text-gray-500">${item.quantity}x @ KSh ${parseFloat(item.price_at_purchase || item.price || 0).toLocaleString()}</p>
                  </div>
                </div>
                <a href="order-confirmation.html?orderId=${order.id}" class="text-xs text-deep-purple font-semibold hover:underline">View Receipt</a>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('Order history query error:', err);
    UI.renderEmptyState(container, {
      icon: '⚠️',
      title: 'Unable to Load Orders',
      message: 'Please check your connection and refresh.'
    });
  }
}
