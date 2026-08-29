/**
 * Crystal Crest - Cashier Guard & POS Header Layout Component
 * Protects cashier pages via GET /api/auth/cashier-me and renders touch-friendly POS topbar.
 */

export const CashierGuard = {
  async init(activePage = 'dashboard') {
    const cashier = await this.checkAuth();
    if (!cashier) {
      window.location.href = 'login.html';
      return null;
    }

    this.renderHeader(cashier, activePage);
    return cashier;
  },

  async checkAuth() {
    try {
      const res = await fetch('/api/auth/cashier-me', { credentials: 'include' });
      if (!res.ok) return null;
      const data = await res.json();
      return (data && data.success && data.cashier) ? data.cashier : null;
    } catch (e) {
      return null;
    }
  },

  async logout() {
    try {
      await fetch('/api/auth/cashier-logout', { method: 'POST', credentials: 'include' });
    } catch (e) {}
    window.location.href = 'login.html';
  },

  renderHeader(cashier, activePage) {
    const headerContainer = document.getElementById('cashier-header');
    if (!headerContainer) return;

    const currentTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    headerContainer.className = "bg-[#1C1C1E] text-white border-b border-[#E8C500]/30 px-4 py-3 sticky top-0 z-40 shadow-lg";
    headerContainer.innerHTML = `
      <div class="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        
        <!-- Left: Logo & Station Info -->
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-full bg-gradient-to-tr from-[#9B72CF] via-[#E8C500] to-[#F8E8E8] flex items-center justify-center p-[2px] shrink-0">
            <div class="w-full h-full bg-[#1C1C1E] rounded-full flex items-center justify-center">
              <span class="font-serif-heading text-lg font-bold gold-gradient-text">C</span>
            </div>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h1 class="font-serif-heading text-xl font-bold tracking-wider gold-gradient-text">CRYSTAL CREST POS</h1>
              <span class="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold uppercase rounded-full">Register #1</span>
            </div>
            <p class="text-[10px] text-gray-400">Kajiado Town Promenade Flagship Store</p>
          </div>
        </div>

        <!-- Center: Shift Navigation Tabs -->
        <div class="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/10 text-xs font-semibold">
          <a href="dashboard.html" class="px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 ${activePage === 'dashboard' ? 'bg-[#9B72CF] text-white font-bold shadow-md' : 'text-gray-300 hover:text-white hover:bg-white/10'}">
            <span>🛒 POS Register</span>
          </a>
          <a href="spa.html" class="px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 ${activePage === 'spa' ? 'bg-[#9B72CF] text-white font-bold shadow-md' : 'text-gray-300 hover:text-white hover:bg-white/10'}">
            <span>💆‍♀️ Spa Walk-ins</span>
          </a>
          <a href="my-sales.html" class="px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 ${activePage === 'my-sales' ? 'bg-[#9B72CF] text-white font-bold shadow-md' : 'text-gray-300 hover:text-white hover:bg-white/10'}">
            <span>📊 Today's Shift Sales</span>
          </a>
        </div>

        <!-- Right: Logged Cashier Profile & Shift Time -->
        <div class="flex items-center gap-4">
          <div class="text-right hidden sm:block">
            <div class="text-xs font-bold text-white flex items-center justify-end gap-1.5">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>${cashier.name || 'Test Cashier'}</span>
            </div>
            <div class="text-[10px] text-gray-400 font-mono">Shift Active • ${currentTimeStr}</div>
          </div>

          <button id="cashier-logout-btn" class="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 font-bold text-xs rounded-xl transition-colors shrink-0">
            Sign Out Shift
          </button>
        </div>

      </div>
    `;

    document.getElementById('cashier-logout-btn')?.addEventListener('click', () => this.logout());
  }
};
