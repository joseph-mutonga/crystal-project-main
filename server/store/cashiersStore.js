/**
 * Crystal Crest - Shared In-Memory Cashiers & POS Store
 * Manages cashier accounts, PIN generation, deactivation, shift sales, and performance tracking.
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// SHA256 helper
function hashPin(pin) {
  return crypto.createHash('sha256').update(pin.toString().trim()).digest('hex');
}

const cashiersList = [];

const posOrdersList = [];
const spaBookingsList = [];

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

  findCashierByUsername(username) {
    return cashiersList.find(c => c.username === String(username).trim().toLowerCase());
  },

  regenerateOtp(id) {
    const cashier = cashiersList.find(c => c.id === id);
    if (!cashier) return null;
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    cashier.otp_hash = bcrypt.hashSync(otp, 10);
    cashier.otp_expires_at = null;
    return { cashier, otp };
  },

  createCashier(name, username, password) {
    const id = crypto.randomUUID();
    // Server-generates random 4-digit PIN
    const plainPin = Math.floor(1000 + Math.random() * 9000).toString();
    const pin_hash = hashPin(plainPin);
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    const newCashier = {
      id,
      name: name.trim(),
      username: username.trim().toLowerCase(),
      password_hash: bcrypt.hashSync(password, 10),
      otp_hash: bcrypt.hashSync(otp, 10),
      otp_expires_at: null,
      pin_hash,
      is_active: true,
      created_at: new Date().toISOString(),
      deactivated_at: null
    };

    cashiersList.unshift(newCashier);
    return { cashier: newCashier, pin: plainPin, otp };
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
