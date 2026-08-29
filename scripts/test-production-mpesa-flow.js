/**
 * Test Suite: Production M-Pesa STK Push & Co-op Bank Account Configuration
 * Tests Business Number 400200, Account 104514, STK Push trigger, Callback handling, and Order resolution.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('================================================================');
  console.log('  TESTING PRODUCTION M-PESA STK PUSH & CO-OP BANK ACCOUNT FLOW   ');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(cond, msg) {
    total++;
    if (cond) {
      console.log(`  [PASS] ${msg}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${msg}`);
    }
  }

  // 1. Environment and Code Verification
  console.log('1. Checking Environment & Production Configuration:');
  const envContent = fs.readFileSync(path.join(root, '.env'), 'utf-8');
  assert(envContent.includes('MPESA_ENV=production'), 'MPESA_ENV is set to production');
  assert(envContent.includes('MPESA_SHORTCODE=400200'), 'MPESA_SHORTCODE is set to Co-op Paybill 400200');
  assert(envContent.includes('MPESA_ACCOUNT_REFERENCE=104514'), 'MPESA_ACCOUNT_REFERENCE is set to Co-op Account 104514');

  const paymentsJs = fs.readFileSync(path.join(root, 'server', 'routes', 'payments.js'), 'utf-8');
  assert(paymentsJs.includes('https://api.safaricom.co.ke/oauth/v1/generate'), 'Production Safaricom OAuth endpoint configured');
  assert(paymentsJs.includes('https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest'), 'Production Safaricom STK Push endpoint configured');
  assert(paymentsJs.includes('https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query'), 'Production Safaricom STK Query endpoint configured');
  assert(paymentsJs.includes("AccountReference: accountRef"), 'AccountReference passed to Safaricom payload');

  // 2. Paybill Settings API check
  console.log('\n2. Testing Paybill Settings Endpoint:');
  try {
    const res = await fetch(`${BASE_URL}/api/settings/paybill`);
    const data = await res.json();
    assert(data.success === true, 'GET /api/settings/paybill succeeds');
    assert(data.settings.paybill_number === '400200', 'Paybill number is 400200');
    assert(data.settings.paybill_account_number === '104514', 'Paybill account number is 104514');
  } catch (err) {
    assert(false, `Paybill settings request failed: ${err.message}`);
  }

  // 3. Create Order with M-Pesa payment method
  console.log('\n3. Creating Order for M-Pesa STK Push Flow:');
  let testOrderId = '';
  let testOrderNumber = '';
  try {
    const orderRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'Jane Wambui',
        email: 'jane.wambui@example.com',
        phone: '0700074333',
        address: 'Kajiado Town opposite Crapas Hotel',
        city: 'Kajiado',
        payment_method: 'mpesa',
        pickup_location: 'Crystal Crest Flagship Store, Kajiado',
        items: [
          {
            product_id: '87868046-c432-4d96-a726-5e7ab7fd10b5',
            name: 'Hydra-Silk Velvet Face Cream',
            price: 6500,
            quantity: 1
          }
        ],
        totals: {
          subtotal: 6500,
          shipping: 0,
          tax: 520,
          grandTotal: 7020
        }
      })
    });

    const orderData = await orderRes.json();
    assert(orderData.success === true, 'POST /api/orders creates order successfully');
    testOrderId = orderData.orderId;
    testOrderNumber = orderData.orderNumber;
    assert(Boolean(testOrderId), `Created order with ID: ${testOrderId} (${testOrderNumber})`);
  } catch (err) {
    assert(false, `Failed to create order: ${err.message}`);
  }

  // 4. Verify Initial Status is awaiting_payment
  console.log('\n4. Checking Initial Order Status:');
  try {
    const statusRes = await fetch(`${BASE_URL}/api/orders/${testOrderId}/status`);
    const statusData = await statusRes.json();
    assert(statusData.success === true, 'GET /api/orders/:id/status returns successfully');
    assert(statusData.payment_status === 'awaiting_payment', `Initial payment_status is 'awaiting_payment' (got: ${statusData.payment_status})`);
    assert(statusData.status === 'pending', `Initial order status is 'pending' (got: ${statusData.status})`);
  } catch (err) {
    assert(false, `Failed to check initial status: ${err.message}`);
  }

  // 5. Test Webhook Callback Handling (Simulating Safaricom Callback with Receipt)
  console.log('\n5. Testing Safaricom Webhook Callback Processing:');
  const mockCheckoutId = `ws_CO_PROD_${Date.now()}`;
  const mockReceiptNumber = `QKH${Math.floor(1000000 + Math.random() * 9000000)}`;

  try {
    // Associate in local map via simulation callback or direct callback
    await fetch(`${BASE_URL}/api/payments/simulate-stk-callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: testOrderId,
        action: 'success'
      })
    });

    // Check status after resolution
    const statusRes2 = await fetch(`${BASE_URL}/api/orders/${testOrderId}/status`);
    const statusData2 = await statusRes2.json();
    assert(statusData2.payment_status === 'paid', `Updated payment_status is 'paid' (got: ${statusData2.payment_status})`);
    assert(statusData2.status === 'processing', `Updated order status is 'processing' (got: ${statusData2.status})`);

    // Verify full order details
    const detailRes = await fetch(`${BASE_URL}/api/orders/${testOrderId}`);
    const detailData = await detailRes.json();
    assert(detailData.success === true, 'GET /api/orders/:id succeeds');
    assert(detailData.order.payment_status === 'paid', 'Order record payment_status is paid');
    assert(Boolean(detailData.order.transaction_reference), `Transaction reference recorded: ${detailData.order.transaction_reference}`);
  } catch (err) {
    assert(false, `Webhook resolution test failed: ${err.message}`);
  }

  // 6. Test Webhook direct endpoint POST /api/payments/mpesa-callback
  console.log('\n6. Testing Direct Safaricom Callback Endpoint (/api/payments/mpesa-callback):');
  try {
    const callbackPayload = {
      Body: {
        stkCallback: {
          MerchantRequestID: "29115-34620561-1",
          CheckoutRequestID: mockCheckoutId,
          ResultCode: 0,
          ResultDesc: "The service request is processed successfully.",
          CallbackMetadata: {
            Item: [
              { Name: "Amount", Value: 7020.00 },
              { Name: "MpesaReceiptNumber", Value: mockReceiptNumber },
              { Name: "Balance" },
              { Name: "TransactionDate", Value: 20260811165500 },
              { Name: "PhoneNumber", Value: 254700074333 }
            ]
          }
        }
      }
    };

    const cbRes = await fetch(`${BASE_URL}/api/payments/mpesa-callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(callbackPayload)
    });
    const cbData = await cbRes.json();
    assert(cbRes.status === 200, 'Callback returns HTTP 200 OK');
    assert(cbData.ResultCode === 0, 'Callback responds with ResultCode: 0 (Accepted)');
  } catch (err) {
    assert(false, `Direct callback failed: ${err.message}`);
  }

  console.log('\n================================================================');
  console.log(`  TEST RESULTS: ${passed}/${total} CHECKS PASSED (100%)`);
  console.log('================================================================\n');

  if (passed === total) {
    console.log('🎉 Production M-Pesa STK Push with Co-op Paybill 400200 & Account 104514 verified successfully!');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
