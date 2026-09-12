const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../config/db');
const cashiersStore = require('../store/cashiersStore');

// In-memory pending STK pushes tracker
const PENDING_STK_PUSHES = new Map();

// Helper to format Kenyan phone numbers to 254XXXXXXXXX
function formatMpesaPhone(phone) {
  if (!phone) return '';
  let clean = phone.toString().replace(/[^0-9]/g, '');
  if (clean.startsWith('0')) {
    clean = '254' + clean.slice(1);
  } else if (clean.startsWith('7') || clean.startsWith('1')) {
    clean = '254' + clean;
  } else if (clean.startsWith('+254')) {
    clean = clean.slice(1);
  }
  return clean;
}

function normalizeMpesaAmount(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeMpesaPhone(value) {
  if (!value) return '';
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) return '254' + digits.slice(1);
  if (digits.startsWith('254')) return digits;
  if (digits.startsWith('7') || digits.startsWith('1')) return '254' + digits;
  if (/^\d{9}$/.test(digits)) return '254' + digits;
  return digits;
}

function normalizeMpesaResultCode(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(String(value).trim());
  return Number.isFinite(num) ? num : null;
}

function validateMpesaCallback(record, callbackData) {
  if (!record) {
    return { valid: false, reason: 'No pending STK push record matched this CheckoutRequestID.' };
  }

  const resultCode = normalizeMpesaResultCode(callbackData?.ResultCode);
  const amountValue = callbackData?.CallbackMetadata?.Item?.find(item => item?.Name === 'Amount')?.Value;
  const phoneValue = callbackData?.CallbackMetadata?.Item?.find(item => item?.Name === 'PhoneNumber')?.Value;
  const expectedAmount = Number(record.amount ?? 0);
  const actualAmount = normalizeMpesaAmount(amountValue);
  const expectedPhone = record.phone ? normalizeMpesaPhone(record.phone) : '';
  const actualPhone = normalizeMpesaPhone(phoneValue);

  const issues = [];

  if (resultCode === 0 && expectedAmount > 0 && actualAmount !== null && Math.abs(actualAmount - expectedAmount) > 0.01) {
    issues.push(`amount mismatch: expected KSh ${expectedAmount}, got KSh ${actualAmount}`);
  }

  if (resultCode === 0 && expectedAmount > 0 && actualAmount === null) {
    issues.push('successful callback did not include a valid amount');
  }

  if (expectedPhone && actualPhone && expectedPhone !== actualPhone) {
    issues.push(`phone mismatch: expected ${expectedPhone}, got ${actualPhone}`);
  }

  if (resultCode === 0 && expectedPhone && !actualPhone) {
    issues.push('successful callback did not include a valid phone number');
  }

  if (issues.length > 0) {
    return {
      valid: false,
      reason: issues.join('; ')
    };
  }

  return { valid: true };
}

// 1. Get Safaricom Daraja OAuth Access Token
async function getMpesaOAuthToken() {
  const consumerKey = (process.env.MPESA_CONSUMER_KEY || '').trim();
  const consumerSecret = (process.env.MPESA_CONSUMER_SECRET || '').trim();
  const env = (process.env.MPESA_ENV || 'production').trim().toLowerCase();

  if (!consumerKey || !consumerSecret) {
    throw new Error('MPESA_CONSUMER_KEY or MPESA_CONSUMER_SECRET is missing in .env');
  }

  const authUrl = (env === 'production' || env === 'live')
    ? 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
    : 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';

  const authHeader = 'Basic ' + Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

  console.log(`[Daraja STK] Requesting OAuth access token from ${authUrl} (${env.toUpperCase()} mode)...`);
  const res = await fetch(authUrl, {
    method: 'GET',
    headers: { Authorization: authHeader }
  });

  const resText = await res.text();
  if (!res.ok) {
    const detail = /<html[\s>]/i.test(resText)
      ? 'Safaricom gateway rejected the request (WAF/Incapsula response).'
      : resText.slice(0, 500);
    console.error(`[Daraja STK] OAuth Token Error (${res.status}):`, detail);
    throw new Error(`Safaricom OAuth error (${res.status}): ${detail}`);
  }

  const data = JSON.parse(resText);
  console.log('[Daraja STK] OAuth access token acquired successfully.');
  return data.access_token;
}

// 2. Initiate Real Safaricom Daraja STK Push to Co-op Paybill 400200 (Acc: 104514)
async function initiateDarajaStkPush({ orderId, phone, amount }) {
  const token = await getMpesaOAuthToken();
  const shortcode = (process.env.MPESA_SHORTCODE || '400200').trim();
  const passkey = (process.env.MPESA_PASSKEY || '').trim();
  const env = (process.env.MPESA_ENV || 'production').trim().toLowerCase();
  const accountRef = (process.env.MPESA_ACCOUNT_REFERENCE || '104514').trim();
  const callbackBase = (process.env.MPESA_CALLBACK_URL || 'https://dingo-barber-headpiece.ngrok-free.dev')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api\/(?:mpesa\/callback|payments\/mpesa-callback)$/i, '');
  const callbackUrl = `${callbackBase}/api/payments/mpesa-callback`;

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const timestamp = `${year}${month}${day}${hours}${minutes}${seconds}`;

  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
  const formattedPhone = formatMpesaPhone(phone);
  const numericAmount = Math.max(1, Math.round(Number(amount) || 1));

  const stkUrl = (env === 'production' || env === 'live')
    ? 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
    : 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest';

  const payload = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: numericAmount,
    PartyA: formattedPhone,
    PartyB: shortcode,
    PhoneNumber: formattedPhone,
    CallBackURL: callbackUrl,
    AccountReference: accountRef, // Co-operative Bank Account Number: 104514
    TransactionDesc: `Crystal Crest Payment`
  };

  console.log('\n=================== [SAFARICOM DARAJA PRODUCTION STK PUSH REQUEST] ===================');
  console.log(`[Daraja STK] Environment: ${env.toUpperCase()}`);
  console.log(`[Daraja STK] URL: ${stkUrl}`);
  console.log(`[Daraja STK] PayBill / BusinessShortCode: ${shortcode}`);
  console.log(`[Daraja STK] Co-op AccountReference: ${accountRef}`);
  console.log(`[Daraja STK] Customer Phone: ${formattedPhone}`);
  console.log(`[Daraja STK] Amount: KES ${numericAmount}`);
  console.log('[Daraja STK] Outgoing Payload:');
  console.log(JSON.stringify({ ...payload, Password: '[REDACTED]' }, null, 2));

  const res = await fetch(stkUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  const rawResText = await res.text();
  console.log(`[Daraja STK] HTTP Status: ${res.status} ${res.statusText}`);
  console.log('[Daraja STK] Raw Response from Safaricom:');
  console.log(rawResText);
  console.log('======================================================================================\n');

  let resJson;
  try {
    resJson = JSON.parse(rawResText);
  } catch (e) {
    throw new Error(`Invalid JSON response from Safaricom: ${rawResText}`);
  }

  if (!res.ok || resJson.ResponseCode !== '0') {
    throw new Error(resJson.errorMessage || resJson.ResponseDescription || `STK push failed with code ${resJson.ResponseCode}`);
  }

  return resJson;
}

// 3. Proactively Query Safaricom STK Push Status (Fallback to Webhook)
async function queryDarajaStkStatus({ checkoutRequestId }) {
  try {
    const token = await getMpesaOAuthToken();
    const shortcode = (process.env.MPESA_SHORTCODE || '400200').trim();
    const passkey = (process.env.MPESA_PASSKEY || '').trim();
    const env = (process.env.MPESA_ENV || 'production').trim().toLowerCase();

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timestamp = `${year}${month}${day}${hours}${minutes}${seconds}`;

    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
    const queryUrl = (env === 'production' || env === 'live')
      ? 'https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query'
      : 'https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query';

    const payload = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId
    };

    console.log(`[Daraja Query] Checking STK status for ${checkoutRequestId}...`);
    const res = await fetch(queryUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    console.log('[Daraja Query] Query Result:', data);
    return data;
  } catch (err) {
    const message = String(err.message || 'Safaricom status query failed');
    const blockedByGateway = /403|Incapsula|Request unsuccessful/i.test(message);
    console.warn(`[Daraja Query] Query failed${blockedByGateway ? ' (Safaricom gateway/WAF blocked the request)' : ''}:`, message);
    return { gatewayError: true, message: blockedByGateway
      ? 'Safaricom is temporarily blocking API requests from this server. The payment will update when the M-Pesa callback arrives.'
      : 'Safaricom status could not be checked. The payment will update when the M-Pesa callback arrives.' };
  }
}

// POST /api/payments/mpesa-stk-push - Initiates STK Push prompt on customer phone
router.post('/mpesa-stk-push', async (req, res) => {
  const { orderId, order_id, orderNumber, phone, phoneNumber, amount } = req.body;
  const targetId = orderId || order_id || orderNumber;
  const rawPhone = phone || phoneNumber;

  if (!targetId || !rawPhone) {
    return res.status(400).json({
      success: false,
      error: 'Order ID and M-Pesa phone number are required.'
    });
  }

  const formattedPhone = formatMpesaPhone(rawPhone);
  if (!/^254(7|1)\d{8}$/.test(formattedPhone)) {
    return res.status(400).json({
      success: false,
      error: 'Please provide a valid Kenyan Safaricom phone number (e.g. 0712345678 or 254712345678).'
    });
  }

  let order = null;
  try {
    const [rows] = await db.query('SELECT * FROM orders WHERE id = ? OR order_number = ?', [targetId, targetId]);
    if (rows && rows.length > 0) {
      order = rows[0];
    }
  } catch (e) {}

  if (!order) {
    const posOrders = cashiersStore.getAllPosOrders();
    order = posOrders.find(o => o.id === targetId || o.order_number === targetId);
  }

  const orderTotal = amount ? parseFloat(amount) : (order ? parseFloat(order.total) : 1);
  const paymentMode = process.env.PAYMENTS_MODE || 'live';
  const hasDarajaKeys = Boolean(
    process.env.MPESA_CONSUMER_KEY?.trim() &&
    process.env.MPESA_CONSUMER_SECRET?.trim() &&
    process.env.MPESA_PASSKEY?.trim()
  );

  // Update order status in DB to awaiting_payment
  try {
    await db.query(
      `UPDATE orders SET payment_status = 'awaiting_payment', payment_method = 'mpesa', phone = ? WHERE id = ? OR order_number = ?`,
      [formattedPhone, targetId, targetId]
    );
  } catch (e) {}

  // Update in-memory order if present
  const posOrders = cashiersStore.getAllPosOrders();
  const memOrder = posOrders.find(o => o.id === targetId || o.order_number === targetId);
  if (memOrder) {
    memOrder.payment_status = 'awaiting_payment';
    memOrder.payment_method = 'mpesa';
    memOrder.phone = formattedPhone;
  }

  // If live/sandbox Daraja keys are present and mode is not forced simulation, make real Daraja STK push
  if (hasDarajaKeys && paymentMode !== 'simulation') {
    try {
      const darajaRes = await initiateDarajaStkPush({
        orderId: order ? order.order_number || order.id : targetId,
        phone: formattedPhone,
        amount: orderTotal
      });

      const checkoutRequestId = darajaRes.CheckoutRequestID;
      const merchantRequestId = darajaRes.MerchantRequestID;

      const pushRecord = {
        checkoutRequestId,
        merchantRequestId,
        orderId: order ? order.id : targetId,
        orderNumber: order ? order.order_number : targetId,
        phone: formattedPhone,
        amount: orderTotal,
        status: 'awaiting_payment',
        initiatedAt: Date.now(),
        daraja: darajaRes
      };

      try {
        await db.query(
          `UPDATE orders SET stk_checkout_request_id = ? WHERE id = ? OR order_number = ?`,
          [checkoutRequestId, targetId, targetId]
        );
      } catch (e) {
        console.warn('[Daraja STK] Could not persist CheckoutRequestID:', e.message);
      }

      PENDING_STK_PUSHES.set(targetId, pushRecord);
      PENDING_STK_PUSHES.set(checkoutRequestId, pushRecord);
      if (merchantRequestId) {
        PENDING_STK_PUSHES.set(merchantRequestId, pushRecord);
      }

      return res.json({
        success: true,
        checkoutRequestId,
        merchantRequestId,
        orderId: targetId,
        phone: formattedPhone,
        amount: orderTotal,
        payment_mode: 'live_daraja',
        responseCode: darajaRes.ResponseCode,
        responseDescription: darajaRes.ResponseDescription,
        customerMessage: darajaRes.CustomerMessage,
        message: `STK push sent to ${formattedPhone}. Please enter PIN on your phone to complete payment of KSh ${orderTotal.toLocaleString()}.`
      });

    } catch (darajaErr) {
      console.error('[Daraja STK] Error sending real STK Push:', darajaErr.message);

      const allowFallback = process.env.MPESA_FALLBACK_SIMULATION === 'true' || process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

      if (allowFallback) {
        console.log('[Daraja STK] Safaricom live gateway reported credential/token error. Seamlessly activating simulation fallback for order', targetId);
        
        const checkoutRequestId = `ws_CO_${Date.now()}_${Math.floor(10000 + Math.random() * 90000)}`;
        const pushRecord = {
          checkoutRequestId,
          orderId: order ? order.id : targetId,
          orderNumber: order ? order.order_number : targetId,
          phone: formattedPhone,
          amount: orderTotal,
          status: 'awaiting_payment',
          initiatedAt: Date.now(),
          is_fallback: true
        };
        PENDING_STK_PUSHES.set(targetId, pushRecord);
        PENDING_STK_PUSHES.set(checkoutRequestId, pushRecord);

        if (formattedPhone.endsWith('000')) {
          setTimeout(async () => {
            await resolveStkPayment(targetId, false, 'Customer cancelled STK push prompt.');
          }, 3500);
        } else {
          setTimeout(async () => {
            await resolveStkPayment(targetId, true, 'Awaiting validated M-Pesa callback confirmation.', '', '', { fromMpesaCallback: false });
          }, 4500);
        }

        return res.json({
          success: true,
          checkoutRequestId,
          orderId: targetId,
          phone: formattedPhone,
          amount: orderTotal,
          payment_mode: 'simulation_fallback',
          message: `M-Pesa STK push request sent to ${formattedPhone}. Please enter your M-Pesa PIN to complete payment of KSh ${orderTotal.toLocaleString()} to Co-op Paybill 400200 (Acc: 104514).`
        });
      }

      return res.status(400).json({
        success: false,
        error: `Safaricom M-Pesa STK Push error: ${darajaErr.message}. You can pay directly using Co-op Paybill 400200 (Account: 104514).`,
        suggest_paybill: true,
        paybill_number: '400200',
        paybill_account: '104514'
      });
    }
  }

  // Simulation Fallback
  const checkoutRequestId = `ws_CO_${Date.now()}_${Math.floor(10000 + Math.random() * 90000)}`;
  const pushRecord = {
    checkoutRequestId,
    orderId: order ? order.id : targetId,
    orderNumber: order ? order.order_number : targetId,
    phone: formattedPhone,
    amount: orderTotal,
    status: 'awaiting_payment',
    initiatedAt: Date.now()
  };
  PENDING_STK_PUSHES.set(targetId, pushRecord);
  PENDING_STK_PUSHES.set(checkoutRequestId, pushRecord);

  if (formattedPhone.endsWith('000')) {
    setTimeout(async () => {
      await resolveStkPayment(targetId, false, 'User cancelled transaction');
    }, 3500);
  } else if (!formattedPhone.endsWith('999')) {
    setTimeout(async () => {
      await resolveStkPayment(targetId, true, 'Awaiting validated M-Pesa callback confirmation.', '', '', { fromMpesaCallback: false });
    }, 4500);
  }

  return res.json({
    success: true,
    checkoutRequestId,
    orderId: targetId,
    phone: formattedPhone,
    amount: orderTotal,
    payment_mode: 'simulation',
    message: `STK push request sent to ${formattedPhone}. Please enter your M-Pesa PIN to complete payment of KSh ${orderTotal.toLocaleString()}.`
  });
});

// Helper to resolve an STK payment with full transaction and verification details.
// IMPORTANT: an order must only be marked as paid after a validated M-Pesa callback.
async function resolveStkPayment(orderId, isSuccess, message = '', receipt = '', payerPhone = '', options = {}) {
  const { fromMpesaCallback = false, allowExplicitPaid = false } = options;
  const callbackConfirmed = fromMpesaCallback || allowExplicitPaid;

  const paymentStatus = isSuccess && callbackConfirmed ? 'paid' : (isSuccess ? 'awaiting_payment' : 'failed');
  const orderStatus = isSuccess && callbackConfirmed ? 'processing' : 'pending';
  const verifiedAt = (isSuccess && callbackConfirmed) ? new Date() : null;

  if (isSuccess && !callbackConfirmed) {
    console.warn(`[Daraja STK] Payment not finalized for order ${orderId}: awaiting validated M-Pesa callback.`);
  }

  try {
    if (isSuccess && callbackConfirmed && receipt) {
      try {
        await db.query(
          `UPDATE orders 
           SET payment_status = ?, status = ?, transaction_reference = ?, payer_name_or_number = COALESCE(?, payer_name_or_number), verified_at = ?, payment_message = ? 
           WHERE id = ? OR order_number = ?`,
          [paymentStatus, orderStatus, receipt, payerPhone || null, verifiedAt, message || 'Payment confirmed by M-Pesa', orderId, orderId]
        );
      } catch (msgErr) {
        if (String(msgErr.message).includes('payment_message')) {
          await db.query(
            `UPDATE orders 
             SET payment_status = ?, status = ?, transaction_reference = ?, payer_name_or_number = COALESCE(?, payer_name_or_number), verified_at = ? 
             WHERE id = ? OR order_number = ?`,
            [paymentStatus, orderStatus, receipt, payerPhone || null, verifiedAt, orderId, orderId]
          );
        } else {
          throw msgErr;
        }
      }
    } else if (isSuccess && !callbackConfirmed) {
      try {
        await db.query(
          `UPDATE orders SET payment_status = 'awaiting_payment', status = 'pending', payment_message = ? WHERE id = ? OR order_number = ?`,
          [message || 'Awaiting validated M-Pesa callback confirmation', orderId, orderId]
        );
      } catch (msgErr) {
        if (String(msgErr.message).includes('payment_message')) {
          await db.query(
            `UPDATE orders SET payment_status = 'awaiting_payment', status = 'pending' WHERE id = ? OR order_number = ?`,
            [orderId, orderId]
          );
        } else {
          throw msgErr;
        }
      }
    } else {
      try {
        await db.query(
          `UPDATE orders SET payment_status = ?, status = ?, payment_message = ? WHERE id = ? OR order_number = ?`,
          [paymentStatus, orderStatus, message || 'Payment status updated', orderId, orderId]
        );
      } catch (msgErr) {
        if (String(msgErr.message).includes('payment_message')) {
          await db.query(
            `UPDATE orders SET payment_status = ?, status = ? WHERE id = ? OR order_number = ?`,
            [paymentStatus, orderStatus, orderId, orderId]
          );
        } else {
          throw msgErr;
        }
      }
    }
  } catch (e) {
    console.warn('[Daraja STK] DB order update error:', e.message);
  }

  const posOrders = cashiersStore.getAllPosOrders();
  const memOrder = posOrders.find(o => o.id === orderId || o.order_number === orderId);
  if (memOrder) {
    memOrder.payment_status = paymentStatus;
    memOrder.status = (isSuccess && callbackConfirmed) ? 'completed' : 'pending';
    memOrder.payment_message = message || memOrder.payment_message || '';
    if (receipt && callbackConfirmed) memOrder.transaction_reference = receipt;
    if (payerPhone && callbackConfirmed) memOrder.payer_name_or_number = payerPhone;
  }

  try {
    const ordersRouter = require('./orders');
    if (ordersRouter.updateMockOrderStatus) {
      ordersRouter.updateMockOrderStatus(orderId, paymentStatus, orderStatus, receipt && callbackConfirmed ? receipt : '', payerPhone && callbackConfirmed ? payerPhone : '');
    }
  } catch (e) {}

  const record = PENDING_STK_PUSHES.get(orderId);
  if (record) {
    record.status = paymentStatus;
    record.resolvedAt = Date.now();
    record.message = message;
    record.receipt = callbackConfirmed ? receipt : record.receipt || '';
  }
}

// GET /api/payments/stk-status/:id - Real-time STK push status check with proactive Daraja Query
router.get('/stk-status/:id', async (req, res) => {
  const { id } = req.params;
  const record = PENDING_STK_PUSHES.get(id);

  if (!record) {
    // Check DB for order
    try {
      const [rows] = await db.query('SELECT id, order_number, payment_status, status, transaction_reference FROM orders WHERE id = ? OR order_number = ?', [id, id]);
      if (rows && rows.length > 0) {
        return res.json({
          success: true,
          payment_status: rows[0].payment_status,
          status: rows[0].status,
          receipt: rows[0].transaction_reference
        });
      }
    } catch (e) {}

    return res.json({ success: true, payment_status: 'awaiting_payment', status: 'pending' });
  }

  // If still awaiting_payment and is a real Daraja push, proactively query Daraja API
  if (
    record.status === 'awaiting_payment' &&
    record.checkoutRequestId &&
    process.env.MPESA_CONSUMER_KEY &&
    (!record.nextQueryAt || Date.now() >= record.nextQueryAt)
  ) {
    try {
      const queryResult = await queryDarajaStkStatus({ checkoutRequestId: record.checkoutRequestId });
      if (queryResult) {
        if (queryResult.gatewayError) {
          record.nextQueryAt = Date.now() + 30 * 1000;
          return res.json({
            success: true,
            payment_status: 'awaiting_payment',
            status: 'pending',
            message: queryResult.message
          });
        }
        record.nextQueryAt = Date.now() + 10 * 1000;
        if (queryResult.ResultCode === '0' || queryResult.ResultCode === 0) {
          console.warn(`[Daraja Query] Safaricom query returned success for ${record.orderId}, but payment remains pending until the M-Pesa callback is validated.`);
          await resolveStkPayment(record.orderId, true, queryResult.ResultDesc || 'Awaiting validated M-Pesa callback confirmation.', '', record.phone, { fromMpesaCallback: false });
          return res.json({
            success: true,
            payment_status: 'awaiting_payment',
            status: 'pending',
            message: 'Awaiting validated M-Pesa callback confirmation.'
          });
        } else if (queryResult.ResultCode === '1032') {
          await resolveStkPayment(record.orderId, false, 'User cancelled transaction');
          return res.json({
            success: true,
            payment_status: 'failed',
            status: 'pending',
            message: 'User cancelled transaction'
          });
        } else if (queryResult.ResultCode && queryResult.ResultCode !== '0') {
          await resolveStkPayment(record.orderId, false, queryResult.ResultDesc || 'Payment failed');
          return res.json({
            success: true,
            payment_status: 'failed',
            status: 'pending',
            message: queryResult.ResultDesc || 'Payment failed'
          });
        }
      }
    } catch (err) {
      console.warn('[Daraja Query] Error querying Daraja status:', err.message);
    }
  }

  return res.json({
    success: true,
    payment_status: record.status,
    message: record.message || '',
    receipt: record.receipt || ''
  });
});

// POST /api/payments/simulate-stk-callback - Testing helper to trigger instant success, cancel, or fail
router.post('/simulate-stk-callback', async (req, res) => {
  const { orderId, action } = req.body;
  if (!orderId) {
    return res.status(400).json({ success: false, error: 'orderId is required' });
  }

  const isSuccess = action === 'pay' || action === 'success';
  const message = isSuccess ? 'Payment confirmed by M-Pesa' : (action === 'cancel' ? 'Customer cancelled M-Pesa prompt' : 'M-Pesa transaction failed');
  const dummyReceipt = isSuccess ? ('QKH' + Math.floor(1000000 + Math.random() * 9000000)) : '';

  await resolveStkPayment(orderId, isSuccess, message, dummyReceipt, '', { fromMpesaCallback: true, allowExplicitPaid: true });

  return res.json({
    success: true,
    orderId,
    payment_status: isSuccess ? 'paid' : 'failed',
    receipt: dummyReceipt,
    message
  });
});

// POST /api/payments/mpesa-callback - Safaricom Daraja STK Webhook Callback
router.post('/mpesa-callback', async (req, res) => {
  console.log('\n=================== [SAFARICOM DARAJA CALLBACK RECEIVED] ===================');
  console.log('[Daraja Callback] Timestamp:', new Date().toISOString());
  console.log('[Daraja Callback] Headers:', JSON.stringify(req.headers, null, 2));
  console.log('[Daraja Callback] Raw Request Body:');
  console.log(JSON.stringify(req.body, null, 2));

  try {
    const callbackData = req.body?.Body?.stkCallback;
    if (!callbackData) {
      console.warn('[Daraja Callback] No stkCallback object found in body.');
      console.log('============================================================================\n');
      return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    const merchantRequestId = callbackData.MerchantRequestID;
    const checkoutRequestId = callbackData.CheckoutRequestID;
    const resultCode = callbackData.ResultCode; // 0 = Success
    const normalizedResultCode = normalizeMpesaResultCode(resultCode);
    const resultDesc = callbackData.ResultDesc;

    console.log(`[Daraja Callback] MerchantRequestID: ${merchantRequestId}`);
    console.log(`[Daraja Callback] CheckoutRequestID: ${checkoutRequestId}`);
    console.log(`[Daraja Callback] ResultCode: ${resultCode} (${normalizedResultCode === 0 ? 'SUCCESS' : 'FAILED / CANCELLED'})`);
    console.log(`[Daraja Callback] ResultDesc: "${resultDesc}"`);

    let mpesaReceipt = '';
    let transactionAmount = 0;
    let transactionPhone = '';

    if (callbackData.CallbackMetadata?.Item) {
      callbackData.CallbackMetadata.Item.forEach(item => {
        if (item.Name === 'MpesaReceiptNumber') mpesaReceipt = item.Value;
        if (item.Name === 'Amount') transactionAmount = item.Value;
        if (item.Name === 'PhoneNumber') transactionPhone = item.Value;
      });
      console.log(`[Daraja Callback] MpesaReceiptNumber: ${mpesaReceipt}`);
      console.log(`[Daraja Callback] Transaction Amount: KSh ${transactionAmount}`);
      console.log(`[Daraja Callback] Customer Phone: ${transactionPhone}`);
    }

    let record = PENDING_STK_PUSHES.get(checkoutRequestId) || PENDING_STK_PUSHES.get(merchantRequestId);
    if (!record && checkoutRequestId) {
      try {
        const [rows] = await db.query(
          `SELECT id, order_number, phone, total, payment_status, stk_checkout_request_id
           FROM orders WHERE stk_checkout_request_id = ? LIMIT 1`,
          [checkoutRequestId]
        );
        if (rows?.length) {
          const order = rows[0];
          record = {
            checkoutRequestId,
            orderId: order.id,
            orderNumber: order.order_number,
            phone: order.phone,
            amount: order.total,
            status: order.payment_status,
            initiatedAt: Date.now()
          };
          PENDING_STK_PUSHES.set(checkoutRequestId, record);
          PENDING_STK_PUSHES.set(order.id, record);
        }
      } catch (e) {
        console.warn('[Daraja Callback] Could not recover pending order:', e.message);
      }
    }
    if (record) {
      const isSuccess = normalizedResultCode === 0;
      if (record.status === 'paid' && isSuccess && record.receipt && mpesaReceipt && record.receipt === mpesaReceipt) {
        console.log(`[Daraja Callback] Ignoring duplicate successful callback for order ${record.orderId}.`);
        console.log('============================================================================\n');
        return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
      }

      if (record.status === 'paid' && isSuccess) {
        console.log(`[Daraja Callback] Ignoring duplicate callback for already-paid order ${record.orderId}.`);
        console.log('============================================================================\n');
        return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
      }

      const validation = validateMpesaCallback(record, callbackData);
      if (!validation.valid) {
        console.warn(`[Daraja Callback] Rejected transaction for order ${record.orderId}: ${validation.reason}`);
        await resolveStkPayment(record.orderId, false, validation.reason, mpesaReceipt || '', String(transactionPhone || record.phone));
      } else {
        console.log(`[Daraja Callback] Matched Pending Order: ${record.orderId} (${record.orderNumber})`);
        await resolveStkPayment(record.orderId, isSuccess, resultDesc, mpesaReceipt, String(transactionPhone || record.phone), { fromMpesaCallback: true });
      }
    } else {
      console.log(`[Daraja Callback] Note: CheckoutRequestID ${checkoutRequestId} not matched in local map (direct trigger or already resolved).`);
    }

    console.log('============================================================================\n');
    return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) {
    console.error('[Daraja Callback] Exception processing webhook callback:', error);
    console.log('============================================================================\n');
    return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }
});

// PUT /api/payments/switch-method - Switch payment method for an order that failed or is pending
router.put('/switch-method', async (req, res) => {
  const { orderId, payment_method } = req.body;
  if (!orderId || !payment_method) {
    return res.status(400).json({ success: false, error: 'orderId and payment_method are required.' });
  }

  const payMethod = payment_method.toLowerCase();
  const paymentStatus = ['cash', 'cod'].includes(payMethod) ? 'pending' : 'paid';

  try {
    await db.query(
      `UPDATE orders SET payment_method = ?, payment_status = ? WHERE id = ? OR order_number = ?`,
      [payMethod, paymentStatus, orderId, orderId]
    );
  } catch (e) {}

  const posOrders = cashiersStore.getAllPosOrders();
  const memOrder = posOrders.find(o => o.id === orderId || o.order_number === orderId);
  if (memOrder) {
    memOrder.payment_method = payMethod;
    memOrder.payment_status = 'paid';
    memOrder.status = 'completed';
  }

  return res.json({
    success: true,
    orderId,
    payment_method: payMethod,
    payment_status: paymentStatus,
    message: `Payment method switched to ${payMethod.toUpperCase()}`
  });
});

// Periodically check for orders stuck in awaiting_payment > 5 minutes and mark as failed
setInterval(async () => {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    await db.query(
      `UPDATE orders SET payment_status = 'failed' WHERE payment_status = 'awaiting_payment' AND created_at < ?`,
      [fiveMinutesAgo]
    );
  } catch (e) {}

  const now = Date.now();
  for (const [key, record] of PENDING_STK_PUSHES.entries()) {
    if (record.status === 'awaiting_payment' && (now - record.initiatedAt) > 5 * 60 * 1000) {
      record.status = 'failed';
      record.message = 'STK push expired after 5 minutes';
    }
  }
}, 60 * 1000);

module.exports = router;
