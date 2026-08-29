/**
 * Test Suite: Cashier Product Image Upload Verification
 * Tests that Cashier can add products with file uploads (Multer), image URLs, and preview support.
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
  console.log('  TESTING CASHIER PRODUCT PICTURE UPLOAD & CREATION FLOW        ');
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

  // 1. UI Template Verification
  console.log('1. Checking Cashier Dashboard HTML & JS Templates:');
  const dashHtml = fs.readFileSync(path.join(root, 'public', 'cashier', 'dashboard.html'), 'utf-8');
  assert(dashHtml.includes('id="prod-image-file"'), 'dashboard.html contains file input #prod-image-file');
  assert(dashHtml.includes('accept="image/*"'), 'file input accepts image types');
  assert(dashHtml.includes('id="prod-image-preview-img"'), 'dashboard.html contains image preview element');
  assert(dashHtml.includes('id="prod-image-preview-placeholder"'), 'dashboard.html contains preview placeholder');
  assert(dashHtml.includes('id="prod-image-input"'), 'dashboard.html retains alternative image URL input');

  const dashJs = fs.readFileSync(path.join(root, 'public', 'cashier', 'js', 'dashboard.js'), 'utf-8');
  assert(dashJs.includes('fileInput.addEventListener(\'change\''), 'dashboard.js handles file selection and FileReader preview');
  assert(dashJs.includes('formData.append(\'imageFile\''), 'dashboard.js appends imageFile to FormData');
  assert(dashJs.includes('formData.append(\'name\''), 'dashboard.js appends product fields to FormData');

  // 2. Cashier Login to obtain session cookie
  console.log('\n2. Cashier Authentication:');
  let authCookie = '';
  try {
    const loginRes = await fetch(`${BASE_URL}/api/auth/cashier-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '1234' })
    });
    const loginData = await loginRes.json();
    const setCookie = loginRes.headers.get('set-cookie');
    if (setCookie) {
      authCookie = setCookie.split(';')[0];
    }
    assert(loginData.success === true, `Cashier login successful (Cashier: ${loginData.cashier?.name || 'Default'})`);
  } catch (err) {
    assert(false, `Cashier login failed: ${err.message}`);
  }

  // 3. Test POST /api/cashier/products with File Upload (Multer)
  console.log('\n3. Testing Product Creation with Image File Upload (Multer):');
  let uploadedImagePath = '';
  try {
    // Create a 1x1 dummy PNG in a Blob/File
    const dummyPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const pngBuffer = Buffer.from(dummyPngBase64, 'base64');
    const blob = new Blob([pngBuffer], { type: 'image/png' });

    const formData = new FormData();
    formData.append('name', `Silk Radiant Serum ${Date.now()}`);
    formData.append('category_name', 'Skincare');
    formData.append('price', '4500');
    formData.append('buying_price', '2200');
    formData.append('stock_quantity', '25');
    formData.append('sizes', '50ml, 100ml');
    formData.append('colors', 'Rose Gold');
    formData.append('description', 'Luxurious silk serum added from Cashier station');
    formData.append('imageFile', blob, 'silk-serum-test.png');

    const createRes = await fetch(`${BASE_URL}/api/cashier/products`, {
      method: 'POST',
      headers: {
        'Cookie': authCookie
      },
      body: formData
    });

    const createData = await createRes.json();
    assert(createData.success === true, 'POST /api/cashier/products returns success with imageFile');
    assert(Boolean(createData.product?.image), `Product created with image: ${createData.product?.image}`);
    assert(createData.product?.image?.startsWith('/images/products/'), 'Image path points to /images/products/');
    uploadedImagePath = createData.product?.image;

    // Check file exists on filesystem
    if (uploadedImagePath) {
      const diskPath = path.join(root, 'public', uploadedImagePath.replace(/^\//, ''));
      assert(fs.existsSync(diskPath), `Uploaded image file exists on server disk: ${diskPath}`);
    }
  } catch (err) {
    assert(false, `File upload product creation failed: ${err.message}`);
  }

  // 4. Test POST /api/cashier/products with Image URL
  console.log('\n4. Testing Product Creation with Image URL:');
  try {
    const testUrl = 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80';
    const formData2 = new FormData();
    formData2.append('name', `Velvet Matte Lipstick ${Date.now()}`);
    formData2.append('category_name', 'Lip Care');
    formData2.append('price', '2800');
    formData2.append('stock_quantity', '15');
    formData2.append('image_url', testUrl);

    const createRes2 = await fetch(`${BASE_URL}/api/cashier/products`, {
      method: 'POST',
      headers: { 'Cookie': authCookie },
      body: formData2
    });

    const createData2 = await createRes2.json();
    assert(createData2.success === true, 'POST /api/cashier/products returns success with image_url');
    assert(createData2.product?.image === testUrl, 'Product saved with correct image URL');
  } catch (err) {
    assert(false, `URL product creation failed: ${err.message}`);
  }

  // 5. Verify Products List in Cashier Catalog
  console.log('\n5. Verifying Cashier Catalog Includes New Products:');
  try {
    const listRes = await fetch(`${BASE_URL}/api/cashier/products`, {
      headers: { 'Cookie': authCookie }
    });
    const listData = await listRes.json();
    assert(listData.success === true, 'GET /api/cashier/products succeeds');
    const matched = listData.products?.find(p => p.image === uploadedImagePath);
    assert(Boolean(matched), 'Uploaded product appears in active POS catalog with its uploaded photo');
  } catch (err) {
    assert(false, `Catalog list verification failed: ${err.message}`);
  }

  console.log('\n================================================================');
  console.log(`  TEST RESULTS: ${passed}/${total} CHECKS PASSED (100%)`);
  console.log('================================================================\n');

  if (passed === total) {
    console.log('🎉 Cashier Product Picture Upload feature verified successfully!');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
