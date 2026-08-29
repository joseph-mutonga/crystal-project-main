/**
 * Crystal Crest - Shared Admin Layout & Role Protection Module
 * Enforces admin role protection via GET /api/auth/me and renders the common sidebar & topbar.
 */

import { ApiService } from './api.js';

export const AdminLayout = {
  async init(activeModule = 'dashboard', pageTitle = 'Executive Dashboard') {
    // 1. Enforce Admin Authentication Check
    const user = await ApiService.getCurrentUser();
    if (!user || user.role !== 'admin') {
      window.location.href = '../account.html';
      return null;
    }

    // 2. Render Shared Layout Frames
    this.renderTopBar(pageTitle, user);
    this.renderSidebar(activeModule);

    return user;
  },

  renderTopBar(titleText, user) {
    const headerEl = document.getElementById('admin-header');
    if (!headerEl) return;

    headerEl.className = "bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm";
    headerEl.innerHTML = `
      <div class="flex items-center gap-3">
        <button id="admin-sidebar-toggle" class="md:hidden text-gray-600 hover:text-gray-900 focus:outline-none">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
          </svg>
        </button>
        <h1 class="font-serif-heading text-2xl font-bold text-gray-900">${titleText}</h1>
      </div>

      <div class="flex items-center gap-4 text-xs font-sans">
        <div class="flex items-center gap-2.5 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-full">
          <div class="w-6 h-6 rounded-full bg-[#E8C500] text-gray-900 font-bold flex items-center justify-center text-xs">
            ${(user.full_name || 'A').charAt(0).toUpperCase()}
          </div>
          <span class="font-semibold text-gray-800">${user.full_name || 'Administrator'}</span>
          <span class="px-2 py-0.5 bg-[#9B72CF] text-white text-[9px] font-bold uppercase rounded-md">ADMIN</span>
        </div>

        <button id="admin-logout-btn" class="px-3.5 py-1.5 border border-gray-300 text-gray-700 hover:bg-gray-100 rounded-full text-xs font-semibold transition-colors">
          Sign Out
        </button>
      </div>
    `;

    document.getElementById('admin-logout-btn')?.addEventListener('click', async () => {
      await ApiService.logout();
      window.location.href = '../account.html';
    });

    document.getElementById('admin-sidebar-toggle')?.addEventListener('click', () => {
      document.getElementById('admin-sidebar')?.classList.toggle('hidden');
    });
  },

  renderSidebar(activeModule) {
    const sidebarEl = document.getElementById('admin-sidebar');
    if (!sidebarEl) return;

    const navItems = [
      { id: 'dashboard', label: 'Dashboard', href: 'dashboard.html', icon: '📊' },
      { id: 'reports', label: 'Analytics & Reports', href: 'reports.html', icon: '📈' },
      { id: 'products', label: 'Products & Inventory', href: 'products.html', icon: '🏷️' },
      { id: 'categories', label: 'Categories', href: 'categories.html', icon: '📁' },
      { id: 'orders', label: 'Orders Fulfillment', href: 'orders.html', icon: '📦' },
      { id: 'spa-bookings', label: 'Spa Sessions & Slots', href: 'spa-bookings.html', icon: '💆' },
      { id: 'cashiers', label: 'Cashier Accounts & POS', href: 'cashiers.html', icon: '💳' },
      { id: 'customers', label: 'Customer Accounts', href: 'customers.html', icon: '👥' },
      { id: 'settings', label: 'Store & Paybill Settings', href: 'settings.html', icon: '⚙️' }
    ];

    sidebarEl.className = "w-64 bg-gray-900 text-gray-200 min-h-screen flex flex-col justify-between shrink-0 border-r border-gray-800 font-sans";
    sidebarEl.innerHTML = `
      <div>
        <!-- Brand Title -->
        <div class="p-6 border-b border-gray-800 flex items-center gap-3">
          <div class="w-8 h-8 rounded-full bg-[#E8C500] text-gray-900 flex items-center justify-center font-bold text-base">C</div>
          <div>
            <h2 class="font-serif-heading text-lg font-bold text-white tracking-wider">CRYSTAL CREST</h2>
            <p class="text-[9px] uppercase tracking-widest text-[#E8C500] font-semibold">Executive Portal</p>
          </div>
        </div>

        <!-- Navigation Links -->
        <nav class="p-4 space-y-1 text-xs font-medium">
          ${navItems.map(item => {
            const isActive = activeModule === item.id;
            return `
              <a href="${item.href}" class="flex items-center gap-3 px-3.5 py-2.5 rounded-lg transition-colors ${isActive ? 'bg-[#E8C500] text-gray-950 font-bold shadow' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}">
                <span>${item.icon}</span>
                <span>${item.label}</span>
              </a>
            `;
          }).join('')}
        </nav>
      </div>

      <!-- Bottom Exit Storefront Link -->
      <div class="p-4 border-t border-gray-800">
        <a href="../index.html" class="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
          <span>🛍️</span>
          <span>Exit to Customer Store</span>
        </a>
      </div>
    `;
  }
};
