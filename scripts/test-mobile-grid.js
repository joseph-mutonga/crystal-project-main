const fs = require('fs');
const path = require('path');
const http = require('http');

function get(urlPath) {
  return new Promise((resolve, reject) => {
    http.get({ hostname: 'localhost', port: 3000, path: urlPath }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

(async () => {
  console.log('================================================================');
  console.log('  TESTING COMPACT 2-COLUMN MOBILE PRODUCT GRID REDESIGN         ');
  console.log('================================================================\n');

  let allPass = true;

  // 1. Check shop.html
  const shopHtml = fs.readFileSync(path.join(__dirname, '../public/shop.html'), 'utf8');
  const shopHas2Col = shopHtml.includes('id="shop-product-grid" class="grid grid-cols-2 sm:grid-cols-3');
  console.log(`[${shopHas2Col ? 'PASS' : 'FAIL'}] shop.html has 2-column mobile grid class: ${shopHas2Col}`);
  if (!shopHas2Col) allPass = false;

  // 2. Check index.html
  const indexHtml = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  const indexHas2Col = indexHtml.includes('id="featured-grid" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4');
  console.log(`[${indexHas2Col ? 'PASS' : 'FAIL'}] index.html has 2-column mobile grid class: ${indexHas2Col}`);
  if (!indexHas2Col) allPass = false;

  // 3. Check product.html
  const productHtml = fs.readFileSync(path.join(__dirname, '../public/product.html'), 'utf8');
  const productHas2Col = productHtml.includes('id="related-products-grid" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4');
  console.log(`[${productHas2Col ? 'PASS' : 'FAIL'}] product.html has 2-column mobile grid class: ${productHas2Col}`);
  if (!productHas2Col) allPass = false;

  // 4. Check shop.js card template
  const shopJs = fs.readFileSync(path.join(__dirname, '../public/js/pages/shop.js'), 'utf8');
  const shopCardChecks = [
    { label: 'Aspect-square image', pass: shopJs.includes('aspect-square') },
    { label: 'Line-clamp-2 title', pass: shopJs.includes('line-clamp-2') },
    { label: 'Compact border & background', pass: shopJs.includes('bg-white') && shopJs.includes('border-[#F8E8E8]') },
    { label: 'Compact rating & category line', pass: shopJs.includes('truncate') && shopJs.includes('★') },
    { label: 'Compact quick-add button', pass: shopJs.includes('data-quick-add') }
  ];
  for (const c of shopCardChecks) {
    console.log(`  [${c.pass ? 'PASS' : 'FAIL'}] shop.js card: ${c.label}`);
    if (!c.pass) allPass = false;
  }

  // 5. Check index.js card template
  const indexJs = fs.readFileSync(path.join(__dirname, '../public/js/pages/index.js'), 'utf8');
  const indexCardChecks = [
    { label: 'Aspect-square image', pass: indexJs.includes('aspect-square') },
    { label: 'Line-clamp-2 title', pass: indexJs.includes('line-clamp-2') },
    { label: 'Compact border & background', pass: indexJs.includes('bg-white') && indexJs.includes('border-[#F8E8E8]') },
    { label: 'Compact rating & category line', pass: indexJs.includes('truncate') && indexJs.includes('★') },
    { label: 'Compact quick-add button', pass: indexJs.includes('data-quick-add') }
  ];
  for (const c of indexCardChecks) {
    console.log(`  [${c.pass ? 'PASS' : 'FAIL'}] index.js card: ${c.label}`);
    if (!c.pass) allPass = false;
  }

  // 6. Check product.js related products template
  const productJs = fs.readFileSync(path.join(__dirname, '../public/js/pages/product.js'), 'utf8');
  const productCardChecks = [
    { label: 'Aspect-square image', pass: productJs.includes('aspect-square') },
    { label: 'Line-clamp-2 title', pass: productJs.includes('line-clamp-2') },
    { label: 'Compact border & background', pass: productJs.includes('bg-white') && productJs.includes('border-[#F8E8E8]') },
    { label: 'Compact rating & category line', pass: productJs.includes('truncate') && productJs.includes('★') }
  ];
  for (const c of productCardChecks) {
    console.log(`  [${c.pass ? 'PASS' : 'FAIL'}] product.js related card: ${c.label}`);
    if (!c.pass) allPass = false;
  }

  // 7. Verify pages serve 200 OK from server
  console.log('\nVerifying HTTP Responses from Server:');
  const pages = ['/index.html', '/shop.html', '/product.html'];
  for (const p of pages) {
    const res = await get(p);
    console.log(`  ${p.padEnd(20)} -> Status ${res.status}`);
    if (res.status !== 200) allPass = false;
  }

  console.log(`\n================================================================`);
  console.log(`  OVERALL TEST RESULT: ${allPass ? 'SUCCESS (ALL TESTS PASSED)' : 'FAILURE'}`);
  console.log(`================================================================\n`);
})();
