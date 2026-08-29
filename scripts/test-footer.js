const http = require('http');
const fs = require('fs');
const path = require('path');

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
  console.log('  TESTING SITE-WIDE FOOTER & DIRECT PORTAL ACCESS               ');
  console.log('================================================================\n');

  // 1. Check HTML files contain footer element
  const pages = ['index.html', 'shop.html', 'product.html', 'checkout.html', 'spa.html', 'account.html', 'order-confirmation.html', '404.html'];
  for (const p of pages) {
    const filePath = path.join(__dirname, '../public', p);
    const content = fs.readFileSync(filePath, 'utf8');
    const hasFooter = content.includes('id="main-footer"');
    console.log(`Page ${p.padEnd(25)}: has footer container = ${hasFooter ? '✓' : '✗'}`);
    if (!hasFooter) console.error(`ERROR: ${p} missing main-footer!`);
  }

  // 2. Check ui.js footer content
  const uiJs = fs.readFileSync(path.join(__dirname, '../public/js/shared/ui.js'), 'utf8');
  
  const tests = [
    { label: 'Updated tagline present', pass: uiJs.includes('Crystal Crest Cosmetics — enhancing your natural beauty with quality cosmetics and carefully selected beauty essentials. Glow with confidence. Shine with elegance.') },
    { label: 'Staff & POS Portals column removed', pass: !uiJs.includes('Staff & POS Portals') },
    { label: 'Admin portal link removed', pass: !uiJs.includes('admin/dashboard.html') },
    { label: 'Cashier portal link removed', pass: !uiJs.includes('cashier/login.html') && !uiJs.includes('cashier/dashboard.html') },
    { label: 'Get In Touch heading present', pass: uiJs.includes('Get In Touch') },
    { label: 'Location info with Kajiado Opp Crapas Hotel', pass: uiJs.includes('Kajiado Town (Opp Crapas Hotel)') },
    { label: 'Phone number 0700 074 333 present and linked', pass: uiJs.includes('0700 074 333') && uiJs.includes('href="tel:0700074333"') },
    { label: 'Email crystalcrest17@gmail.com present and linked', pass: uiJs.includes('crystalcrest17@gmail.com') && uiJs.includes('href="mailto:crystalcrest17@gmail.com"') },
    { label: 'WhatsApp wa.me link present', pass: uiJs.includes('https://wa.me/254700074333') },
    { label: 'Instagram profile link present', pass: uiJs.includes('https://instagram.com/crystalcrestboutique') },
    { label: 'Facebook page link present', pass: uiJs.includes('https://facebook.com/crystalcrestboutique') },
    { label: 'TikTok profile link present', pass: uiJs.includes('https://tiktok.com/@crystalcrestboutique') },
    { label: 'Storefront navigation column preserved', pass: uiJs.includes('Storefront') && uiJs.includes('shop.html') && uiJs.includes('checkout.html') && uiJs.includes('account.html') },
    { label: 'Copyright notice preserved', pass: uiJs.includes('Crystal Crest Cosmetics & Luxury Footwear Ltd. All Rights Reserved.') }
  ];

  console.log('\nFooter Content Verifications:');
  let allPass = true;
  for (const t of tests) {
    console.log(`  [${t.pass ? 'PASS' : 'FAIL'}] ${t.label}`);
    if (!t.pass) allPass = false;
  }

  // 3. Verify Direct URLs for staff portals still respond with 200 OK
  console.log('\nVerifying Direct Staff Portal URLs:');
  const directUrls = ['/admin/dashboard.html', '/admin/orders.html', '/admin/settings.html', '/cashier/login.html', '/cashier/dashboard.html'];
  for (const u of directUrls) {
    const res = await get(u);
    console.log(`  Direct URL ${u.padEnd(28)} -> Status ${res.status}`);
    if (res.status !== 200) allPass = false;
  }

  console.log(`\n================================================================`);
  console.log(`  OVERALL TEST RESULT: ${allPass ? 'SUCCESS (ALL 14 CHECKS PASSED)' : 'FAILURE'}`);
  console.log(`================================================================\n`);
})();
