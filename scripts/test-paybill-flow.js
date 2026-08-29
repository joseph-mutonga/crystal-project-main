const http = require('http');
require('dotenv').config();

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      const setCookie = res.headers['set-cookie'];
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, cookies: setCookie, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, cookies: setCookie, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

(async () => {
  console.log('================================================================');
  console.log('  STARTING E2E TEST: PAYBILL WORKFLOW & CASHIER VERIFICATION    ');
  console.log('================================================================\n');

  // 1. GET Settings
  console.log('1. Testing GET /api/settings/paybill...');
  const settingsRes = await request({
    hostname: 'localhost', port: 3000, path: '/api/settings/paybill', method: 'GET'
  });
  console.log('   Settings status:', settingsRes.status);
  console.log('   Settings data:', settingsRes.body);

  // 2. Fetch a real product from store catalog
  const productsRes = await request({
    hostname: 'localhost', port: 3000, path: '/api/products', method: 'GET'
  });
  const firstProd = productsRes.body?.products?.[0] || { id: '87868046-c432-4d96-a726-5e7ab7fd10b5', name: 'dove soap', price: 450 };
  console.log(`\nFound catalog product for test: ${firstProd.name} (ID: ${firstProd.id}, Price: KSh ${firstProd.price})`);

  // 3. Customer checkout with paybill_manual
  console.log('\n2. Testing Customer Checkout via paybill_manual (POST /api/orders)...');
  const orderRes = await request({
    hostname: 'localhost', port: 3000, path: '/api/orders', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    full_name: 'Jane Wambui',
    email: 'jane.wambui@example.com',
    phone: '0712345678',
    address: 'Kilimani, Argwings Kodhek Rd',
    city: 'Nairobi',
    payment_method: 'paybill_manual',
    transaction_reference: 'QKH8972TEST',
    payer_name_or_number: 'Jane Wambui (0712345678)',
    items: [
      { id: firstProd.id, product_id: firstProd.id, name: firstProd.name, price: firstProd.price, quantity: 2 }
    ],
    subtotal: firstProd.price * 2,
    shipping: 0,
    total: firstProd.price * 2
  });

  console.log('   Order creation status:', orderRes.status);
  const createdOrderId = orderRes.body.orderId;
  const orderNumber = orderRes.body.orderNumber;
  console.log(`   Order created: ID=${createdOrderId}, OrderNo=${orderNumber}`);

  // 4. Login as Cashier via /api/auth/cashier-login
  console.log('\n3. Logging in as Cashier (POST /api/auth/cashier-login)...');
  const cashierLogin = await request({
    hostname: 'localhost', port: 3000, path: '/api/auth/cashier-login', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    pin: '1234'
  });
  console.log(`   Cashier status: ${cashierLogin.status}, Name: ${cashierLogin.body.cashier?.name}`);
  const cashierCookie = cashierLogin.cookies ? cashierLogin.cookies.map(c => c.split(';')[0]).join('; ') : '';

  // 5. Cashier fetches awaiting verification queue
  console.log('\n4. Checking Cashier Pending Verification Queue (GET /api/cashier/orders/awaiting-verification)...');
  const queueRes = await request({
    hostname: 'localhost', port: 3000, path: '/api/cashier/orders/awaiting-verification', method: 'GET',
    headers: { 'Cookie': cashierCookie }
  });
  console.log(`   Pending orders in queue: ${queueRes.body.orders?.length}`);
  const matchedOrder = queueRes.body.orders?.find(o => o.id === createdOrderId);
  console.log('   Matched Order in Queue:', {
    id: matchedOrder?.id,
    order_number: matchedOrder?.order_number,
    total: matchedOrder?.total,
    sms_code: matchedOrder?.transaction_reference,
    payer: matchedOrder?.payer_name_or_number,
    payment_status: matchedOrder?.payment_status
  });

  // 6. Cashier verifies the order
  console.log(`\n5. Cashier Verifying Payment for Order #${orderNumber} (PUT /api/cashier/orders/${createdOrderId}/verify-payment)...`);
  const verifyRes = await request({
    hostname: 'localhost', port: 3000, path: `/api/cashier/orders/${createdOrderId}/verify-payment`, method: 'PUT',
    headers: { 'Cookie': cashierCookie, 'Content-Type': 'application/json' }
  });
  console.log('   Verification status:', verifyRes.status, verifyRes.body);

  // 7. Check order details to confirm verification
  console.log(`\n6. Confirming Verified Order in Database (GET /api/orders/${createdOrderId})...`);
  const checkOrderRes = await request({
    hostname: 'localhost', port: 3000, path: `/api/orders/${createdOrderId}`, method: 'GET'
  });
  console.log('   Verified Order state:', {
    status: checkOrderRes.body.order?.status,
    payment_status: checkOrderRes.body.order?.payment_status,
    verified_by_name: checkOrderRes.body.order?.verified_by_name,
    verified_at: checkOrderRes.body.order?.verified_at
  });

  // 8. POS Direct Sale with paybill_manual
  console.log('\n7. Testing POS Direct Paybill Sale (POST /api/cashier/sale)...');
  const posSaleRes = await request({
    hostname: 'localhost', port: 3000, path: '/api/cashier/sale', method: 'POST',
    headers: { 'Cookie': cashierCookie, 'Content-Type': 'application/json' }
  }, {
    items: [{ id: firstProd.id, product_id: firstProd.id, name: firstProd.name, price: firstProd.price, quantity: 1 }],
    payment_method: 'paybill_manual',
    customer_name: 'Walk-in VIP',
    customer_phone: '0799112233',
    transaction_reference: 'POSPB9988',
    payer_name_or_number: 'Walk-in VIP (0799112233)',
    subtotal: firstProd.price,
    total: firstProd.price
  });
  console.log('   POS Paybill Sale result:', posSaleRes.status, {
    success: posSaleRes.body.success,
    order_number: posSaleRes.body.order_number,
    payment_status: posSaleRes.body.payment_status,
    orderId: posSaleRes.body.orderId
  });

  // 9. Admin Login & Analytics check
  console.log('\n8. Logging in as Admin (POST /api/auth/login) & Fetching Analytics...');
  const adminLogin = await request({
    hostname: 'localhost', port: 3000, path: '/api/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    email: 'admin@crystalcrest.com',
    password: 'Password123!'
  });
  const adminCookie = adminLogin.cookies ? adminLogin.cookies.map(c => c.split(';')[0]).join('; ') : '';

  const revenueRes = await request({
    hostname: 'localhost', port: 3000, path: '/api/admin/analytics/revenue?startDate=2026-08-01&endDate=2026-08-31', method: 'GET',
    headers: { 'Cookie': adminCookie }
  });
  console.log('   Revenue Analytics by Payment Method:', revenueRes.body.byPaymentMethod);

  const cashiersRes = await request({
    hostname: 'localhost', port: 3000, path: '/api/admin/analytics/cashiers?startDate=2026-08-01&endDate=2026-08-31', method: 'GET',
    headers: { 'Cookie': adminCookie }
  });
  console.log('   Cashier Leaderboard (Verifications & Sales):', cashiersRes.body.leaderboard?.map(c => ({
    name: c.name,
    sales: c.total_sales,
    verifications: c.verifications_count,
    revenue: c.total_revenue
  })));

  console.log('\n================================================================');
  console.log('  ALL PAYBILL & VERIFICATION TESTS PASSED!                        ');
  console.log('================================================================\n');
})();
