/**
 * Crystal Crest - Shared In-Memory Cashiers & POS Store
 * Manages cashier accounts, PIN generation, deactivation, shift sales, and performance tracking.
 */

const crypto = require('crypto');

// SHA256 helper
function hashPin(pin) {
  return crypto.createHash('sha256').update(pin.toString().trim()).digest('hex');
}

// SHA256 of '1234' = '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4'
const DEFAULT_CASHIER_PIN_HASH = hashPin('1234');

const cashiersList = [
  {
    id: 'csh-test-001',
    name: 'Test Cashier',
    pin_hash: DEFAULT_CASHIER_PIN_HASH,
    is_active: true,
    created_at: new Date().toISOString(),
    deactivated_at: null
  }
];

const posOrdersList = [];
const spaBookingsList = [
  {
    id: 'mock-b-1',
    service_id: 'prod-spa-massage-02',
    service_name: 'Aromatherapy Damask Rose Body Massage',
    customer_name: 'Jane Doe',
    customer_email: 'jane.test@example.com',
    customer_phone: '0712345678',
    booking_date: new Date().toISOString().split('T')[0],
    booking_time: '11:00 AM',
    status: 'confirmed',
    cashier_id: null,
    cashier_name: null,
    price: 12500,
    payment_method: 'mpesa',
    source: 'online',
    created_at: new Date().toISOString()
  }
];

module.exports = {
  getCashiers() {
    return cashiersList.map(c => ({
      id: c.id,
      name: c.name,
      is_active: c.is_active,
      created_at: c.created_at,
      deactivated_at: c.deactivated_at
    }));
  },

  getCashierById(id) {
    return cashiersList.find(c => c.id === id);
  },

  findCashierByPinHash(pinHash) {
    return cashiersList.find(c => c.pin_hash === pinHash && c.is_active);
  },

  findAnyCashierByPinHash(pinHash) {
    return cashiersList.find(c => c.pin_hash === pinHash);
  },

  createCashier(name) {
    const id = crypto.randomUUID();
    // Server-generates random 4-digit PIN
    const plainPin = Math.floor(1000 + Math.random() * 9000).toString();
    const pin_hash = hashPin(plainPin);

    const newCashier = {
      id,
      name: name.trim(),
      pin_hash,
      is_active: true,
      created_at: new Date().toISOString(),
      deactivated_at: null
    };

    cashiersList.unshift(newCashier);
    return { cashier: newCashier, pin: plainPin };
  },

  regeneratePin(id) {
    const cashier = cashiersList.find(c => c.id === id);
    if (!cashier) return null;

    const plainPin = Math.floor(1000 + Math.random() * 9000).toString();
    cashier.pin_hash = hashPin(plainPin);
    return { cashier, pin: plainPin };
  },

  deactivateCashier(id) {
    const cashier = cashiersList.find(c => c.id === id);
    if (!cashier) return null;

    cashier.is_active = false;
    cashier.deactivated_at = new Date().toISOString();
    return cashier;
  },

  reactivateCashier(id) {
    const cashier = cashiersList.find(c => c.id === id);
    if (!cashier) return null;

    cashier.is_active = true;
    cashier.deactivated_at = null;
    return cashier;
  },

  addPosOrder(order) {
    posOrdersList.unshift(order);
    return order;
  },

  getPosOrdersByCashier(cashierId) {
    const today = new Date().toISOString().split('T')[0];
    return posOrdersList.filter(o => o.cashier_id === cashierId && (o.created_at || '').startsWith(today));
  },

  getAllPosOrders() {
    return posOrdersList;
  },

  getCashierPerformance(cashierId, startDate, endDate) {
    const cashierOrders = posOrdersList.filter(o => {
      if (o.cashier_id !== cashierId || o.source !== 'pos') return false;
      const orderDate = (o.created_at || '').split('T')[0];

      if (startDate && orderDate < startDate) return false;
      if (endDate && orderDate > endDate) return false;
      return true;
    });

    const totalSales = cashierOrders.length;
    const totalRevenue = cashierOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const avgSaleValue = totalSales > 0 ? (totalRevenue / totalSales) : 0;

    // Daily breakdown map YYYY-MM-DD -> { count, revenue }
    const dailyMap = {};
    cashierOrders.forEach(o => {
      const date = (o.created_at || '').split('T')[0] || new Date().toISOString().split('T')[0];
      if (!dailyMap[date]) {
        dailyMap[date] = { date, count: 0, revenue: 0 };
      }
      dailyMap[date].count += 1;
      dailyMap[date].revenue += Number(o.total) || 0;
    });

    const dailySales = Object.values(dailyMap).sort((a, b) => b.date.localeCompare(a.date));

    return {
      total_sales: totalSales,
      total_revenue: totalRevenue,
      avg_sale_value: avgSaleValue,
      daily_sales: dailySales,
      orders: cashierOrders
    };
  },

  addSpaBooking(booking) {
    spaBookingsList.unshift(booking);
    return booking;
  },

  getSpaBookings(date) {
    if (date) {
      return spaBookingsList.filter(b => b.booking_date === date);
    }
    return spaBookingsList;
  },

  findSpaBookingById(id) {
    return spaBookingsList.find(b => b.id === id);
  },

  updateSpaBooking(id, fields) {
    const idx = spaBookingsList.findIndex(b => b.id === id);
    if (idx > -1) {
      spaBookingsList[idx] = { ...spaBookingsList[idx], ...fields };
      return spaBookingsList[idx];
    }
    return null;
  }
};
