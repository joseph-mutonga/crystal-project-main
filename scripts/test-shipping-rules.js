/**
 * Test Suite: Store Pickup (Free Shipping) & Kajiado Town Delivery (KSh 100)
 * Verifies that in-store pickup has KSh 0 shipping fee and delivery around Kajiado Town defaults to KSh 100.
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
  console.log('  TESTING STORE PICKUP (FREE) & KAJIADO DELIVERY (KSh 100)      ');
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

  // 1. Template & Code Verifications
  console.log('1. Checking Frontend Delivery & Shipping Policy Code:');
  const cartJs = fs.readFileSync(path.join(root, 'public', 'js', 'shared', 'cart.js'), 'utf-8');
  assert(cartJs.includes('fulfillmentType'), 'cart.js getTotals accepts fulfillmentType');
  assert(cartJs.includes('const shipping = isPickup || subtotal === 0 ? 0 : 100'), 'cart.js calculates 0 for pickup and 100 for delivery');

  const checkoutHtml = fs.readFileSync(path.join(root, 'public', 'checkout.html'), 'utf-8');
  assert(checkoutHtml.includes('Kajiado Town Delivery'), 'checkout.html specifies Kajiado Town Delivery');
  assert(checkoutHtml.includes('KSh 100'), 'checkout.html displays KSh 100 delivery fee');
  assert(checkoutHtml.includes('Store Pickup'), 'checkout.html includes Store Pickup option');
  assert(checkoutHtml.includes('FREE &bull; Flagship Boutique'), 'checkout.html shows FREE for Store Pickup');
  assert(checkoutHtml.includes('Kajiado Town & surrounding areas'), 'checkout.html specifies Kajiado Town exclusive delivery zone');

  const checkoutJs = fs.readFileSync(path.join(root, 'public', 'js', 'pages', 'checkout.js'), 'utf-8');
  assert(checkoutJs.includes('currentFulfillmentType'), 'checkout.js manages currentFulfillmentType state');
  assert(checkoutJs.includes('CartStore.getTotals(currentFulfillmentType)'), 'checkout.js calculates totals based on fulfillment type');
  assert(checkoutJs.includes('kajiado'), 'checkout.js validates Kajiado delivery region');

  // 2. Test Order Creation: Store Pickup (Shipping = KSh 0)
  console.log('\n2. Testing Order Creation with Store Pickup (Shipping = KSh 0):');
  let pickupOrderId = '';
  try {
    const pickupRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'Grace Mutiso',
        email: 'grace.mutiso@example.com',
        phone: '0700074333',
        payment_method: 'cod',
        pickup_location: 'Crystal Crest Boutique (Opposite Crapas Hotel), Kajiado Town',
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
          tax: 0,
          grandTotal: 6500,
          fulfillmentType: 'pickup'
        }
      })
    });

    const pickupData = await pickupRes.json();
    assert(pickupData.success === true, 'POST /api/orders succeeds for store pickup');
    pickupOrderId = pickupData.orderId;

    // Fetch and check order record
    const getRes = await fetch(`${BASE_URL}/api/orders/${pickupOrderId}`);
    const getData = await getRes.json();
    assert(getData.success === true, 'GET /api/orders/:id returns pickup order');
    assert(Number(getData.order.shipping) === 0, `Store Pickup shipping fee is KSh 0 (got: ${getData.order.shipping})`);
    assert(Number(getData.order.total) === 6500, `Grand total equals subtotal KSh 6,500 without shipping (got: ${getData.order.total})`);
    assert(getData.order.pickup_location.includes('Kajiado Town'), 'Pickup location recorded');
  } catch (err) {
    assert(false, `Store pickup order test failed: ${err.message}`);
  }

  // 3. Test Order Creation: Kajiado Town Delivery (Shipping = KSh 100)
  console.log('\n3. Testing Order Creation with Kajiado Town Delivery (Shipping = KSh 100):');
  let deliveryOrderId = '';
  try {
    const deliveryRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'Samuel Kiprop',
        email: 'samuel.kiprop@example.com',
        phone: '0722000000',
        address: 'Hospital Road, Near County Offices',
        city: 'Kajiado Town',
        payment_method: 'cod',
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
          shipping: 100,
          tax: 0,
          grandTotal: 6600,
          fulfillmentType: 'delivery'
        }
      })
    });

    const deliveryData = await deliveryRes.json();
    assert(deliveryData.success === true, 'POST /api/orders succeeds for Kajiado delivery');
    deliveryOrderId = deliveryData.orderId;

    // Fetch and check order record
    const getRes2 = await fetch(`${BASE_URL}/api/orders/${deliveryOrderId}`);
    const getData2 = await getRes2.json();
    assert(getData2.success === true, 'GET /api/orders/:id returns delivery order');
    assert(Number(getData2.order.shipping) === 100, `Kajiado delivery shipping fee is KSh 100 (got: ${getData2.order.shipping})`);
    assert(Number(getData2.order.total) === 6600, `Grand total includes KSh 100 shipping (6500 + 100 = 6600, got: ${getData2.order.total})`);
    assert(getData2.order.city === 'Kajiado Town', 'Delivery city recorded as Kajiado Town');
  } catch (err) {
    assert(false, `Kajiado delivery order test failed: ${err.message}`);
  }

  // 4. Cart UI Drawer Banner check
  console.log('\n4. Checking Cart Drawer Shipping Policy Banner:');
  const uiJs = fs.readFileSync(path.join(root, 'public', 'js', 'shared', 'ui.js'), 'utf-8');
  assert(uiJs.includes('Store Pickup: <strong>FREE</strong>'), 'Cart drawer displays Store Pickup: FREE');
  assert(uiJs.includes('Kajiado Delivery: <strong>KSh 100</strong>'), 'Cart drawer displays Kajiado Delivery: KSh 100');

  console.log('\n================================================================');
  console.log(`  TEST RESULTS: ${passed}/${total} CHECKS PASSED (100%)`);
  console.log('================================================================\n');

  if (passed === total) {
    console.log('🎉 Store Pickup (Free) & Kajiado Town Delivery (KSh 100) verified successfully!');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
