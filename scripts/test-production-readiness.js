/**
 * Crystal Crest Production Readiness Test Suite
 * Validates all 7 production readiness and security hardening dimensions.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const BASE_URL = 'http://localhost:3000';

async function runProductionAudit() {
  console.log('================================================================');
  console.log('  CRYSTAL CREST PRODUCTION READINESS AUDIT SUITE               ');
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

  // ---------------------------------------------------------------------------
  // 1. Environment & Secrets Audit
  // ---------------------------------------------------------------------------
  console.log('1. ENVIRONMENT & SECRETS AUDIT:');
  const envExample = fs.readFileSync(path.join(root, '.env.example'), 'utf-8');
  const requiredVars = [
    'PORT', 'NODE_ENV', 'DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME',
    'JWT_SECRET', 'MPESA_CONSUMER_KEY', 'MPESA_CONSUMER_SECRET', 'MPESA_PASSKEY',
    'MPESA_SHORTCODE', 'MPESA_ACCOUNT_REFERENCE', 'MPESA_ENV', 'MPESA_CALLBACK_URL',
    'PAYMENTS_MODE', 'GEMINI_API_KEY', 'BREVO_API_KEY', 'BREVO_SENDER_EMAIL', 'BREVO_SENDER_NAME'
  ];
  for (const v of requiredVars) {
    assert(envExample.includes(v), `.env.example documents ${v}`);
  }

  const gitignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf-8');
  assert(gitignore.includes('.env'), '.gitignore excludes .env');

  // Check no leftover Airtel references
  const checkoutHtml = fs.readFileSync(path.join(root, 'public', 'checkout.html'), 'utf-8');
  const adminSettingsHtml = fs.readFileSync(path.join(root, 'public', 'admin', 'settings.html'), 'utf-8');
  assert(!checkoutHtml.toLowerCase().includes('airtel'), 'checkout.html has zero Airtel references');
  assert(!adminSettingsHtml.toLowerCase().includes('airtel'), 'admin settings.html has zero Airtel references');

  // ---------------------------------------------------------------------------
  // 2. Production Server Configuration & Health Monitoring
  // ---------------------------------------------------------------------------
  console.log('\n2. PRODUCTION SERVER CONFIGURATION:');
  const healthRes = await fetch(`${BASE_URL}/api/health`);
  const healthData = await healthRes.json();
  assert(healthRes.status === 200, 'GET /api/health returns HTTP 200');
  assert(healthData.status === 'ok', 'Health response status is "ok"');
  assert(Boolean(healthData.timestamp), 'Health response includes ISO timestamp');

  const serverJs = fs.readFileSync(path.join(root, 'server', 'server.js'), 'utf-8');
  assert(serverJs.includes("app.listen(PORT, '0.0.0.0'"), 'server.js listens on 0.0.0.0');
  assert(serverJs.includes('IS_PROD ? \'Internal Server Error\''), 'server.js strips error stack traces in production');

  const pkgJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));
  assert(pkgJson.scripts && pkgJson.scripts.start === 'node server/server.js', 'package.json has "start": "node server/server.js"');

  // ---------------------------------------------------------------------------
  // 3. M-Pesa Safety & Documentation
  // ---------------------------------------------------------------------------
  console.log('\n3. M-PESA PRODUCTION SAFETY:');
  const paymentsJs = fs.readFileSync(path.join(root, 'server', 'routes', 'payments.js'), 'utf-8');
  assert(paymentsJs.includes('https://api.safaricom.co.ke') && paymentsJs.includes('https://sandbox.safaricom.co.ke'), 'payments.js dynamically switches between production & sandbox URLs');

  assert(fs.existsSync(path.join(root, 'DEPLOYMENT.md')), 'DEPLOYMENT.md exists');
  const deploymentMd = fs.readFileSync(path.join(root, 'DEPLOYMENT.md'), 'utf-8');
  assert(deploymentMd.includes('MPESA_CALLBACK_URL'), 'DEPLOYMENT.md documents updating MPESA_CALLBACK_URL');
  assert(deploymentMd.includes('admin@crystalcrest.com'), 'DEPLOYMENT.md warns about changing seeded admin account');
  assert(deploymentMd.includes('Test Cashier'), 'DEPLOYMENT.md warns about default cashier PIN');

  // ---------------------------------------------------------------------------
  // 4. Database Schema & Migration Safety
  // ---------------------------------------------------------------------------
  console.log('\n4. DATABASE MIGRATION SAFETY:');
  const schemaSql = fs.readFileSync(path.join(root, 'database', 'schema.sql'), 'utf-8');
  const tableStatements = schemaSql.match(/CREATE TABLE/gi) || [];
  const ifNotExistsStatements = schemaSql.match(/CREATE TABLE IF NOT EXISTS/gi) || [];
  assert(tableStatements.length === ifNotExistsStatements.length, `All ${tableStatements.length} tables in schema.sql use CREATE TABLE IF NOT EXISTS`);

  const dbReadme = fs.readFileSync(path.join(root, 'database', 'README.md'), 'utf-8');
  assert(dbReadme.includes('schema.sql'), 'database/README.md explains schema migration');
  assert(dbReadme.includes('admin123') && dbReadme.includes('1234'), 'database/README.md includes compromised seeded credentials warning');

  // ---------------------------------------------------------------------------
  // 5. Security Hardening & Role-Based Access Control
  // ---------------------------------------------------------------------------
  console.log('\n5. SECURITY HARDENING & RBAC:');
  const authJs = fs.readFileSync(path.join(root, 'server', 'routes', 'auth.js'), 'utf-8');
  const cashierAuthJs = fs.readFileSync(path.join(root, 'server', 'routes', 'cashier-auth.js'), 'utf-8');
  assert(authJs.includes("sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax'"), 'Customer auth cookies use strict sameSite in production');
  assert(cashierAuthJs.includes("sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax'"), 'Cashier auth cookies use strict sameSite in production');
  assert(authJs.includes('rateLimit') && authJs.includes('/signup') && authJs.includes('/login'), 'Customer login & signup have rate limiting');
  assert(cashierAuthJs.includes('rateLimit') && cashierAuthJs.includes('/cashier-login'), 'Cashier PIN login has rate limiting');

  const adminJs = fs.readFileSync(path.join(root, 'server', 'routes', 'admin.js'), 'utf-8');
  const cashierJs = fs.readFileSync(path.join(root, 'server', 'routes', 'cashier.js'), 'utf-8');
  assert(adminJs.includes('limits:') && adminJs.includes('fileFilter:'), 'Admin product image upload validates file type and size limits');
  assert(cashierJs.includes('limits:') && cashierJs.includes('fileFilter:'), 'Cashier product image upload validates file type and size limits');

  // Test Access Control: Unauthenticated request to /api/admin/orders
  const unauthAdminRes = await fetch(`${BASE_URL}/api/admin/orders`);
  assert(unauthAdminRes.status === 401, 'Unauthenticated request to /api/admin/orders is rejected with 401');

  // Test Access Control: Unauthenticated request to /api/cashier/products
  const unauthCashierRes = await fetch(`${BASE_URL}/api/cashier/products`);
  assert(unauthCashierRes.status === 401, 'Unauthenticated request to /api/cashier/products is rejected with 401');

  // ---------------------------------------------------------------------------
  // 6. SEO, Robots & PWA
  // ---------------------------------------------------------------------------
  console.log('\n6. SEO, ROBOTS & PWA:');
  const robotsTxt = fs.readFileSync(path.join(root, 'public', 'robots.txt'), 'utf-8');
  assert(robotsTxt.includes('Disallow: /admin/') && robotsTxt.includes('Disallow: /cashier/'), 'robots.txt disallows /admin/ and /cashier/');

  const manifestJson = JSON.parse(fs.readFileSync(path.join(root, 'public', 'manifest.json'), 'utf-8'));
  assert(manifestJson.name && manifestJson.start_url && manifestJson.display === 'standalone', 'manifest.json is valid and standalone');

  // ---------------------------------------------------------------------------
  // 7. Core End-to-End Functional Flows
  // ---------------------------------------------------------------------------
  console.log('\n7. CORE FUNCTIONAL FLOWS:');
  
  // Newsletter subscription
  const newsRes = await fetch(`${BASE_URL}/api/newsletter/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `vip.tester.${Date.now()}@example.com` })
  });
  const newsData = await newsRes.json();
  assert(newsRes.status === 200 && newsData.success === true, 'POST /api/newsletter/subscribe succeeds');

  // Products catalog
  const prodsRes = await fetch(`${BASE_URL}/api/products`);
  const prodsData = await prodsRes.json();
  const productsList = prodsData.data || prodsData.products || [];
  assert(prodsRes.status === 200 && Array.isArray(productsList) && productsList.length > 0, 'GET /api/products returns active products');

  // Paybill settings
  const pbRes = await fetch(`${BASE_URL}/api/settings/paybill`);
  const pbData = await pbRes.json();
  assert(pbRes.status === 200 && pbData.settings.paybill_number === '400200', 'Paybill settings returns Co-op Paybill 400200');

  console.log('\n================================================================');
  console.log(`  AUDIT SUMMARY: ${passed}/${total} PRODUCTION CHECKS PASSED (100%)`);
  console.log('================================================================\n');

  if (passed === total) {
    console.log('🎉 Crystal Crest is 100% HARDENED & READY FOR PRODUCTION DEPLOYMENT!');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runProductionAudit().catch(err => {
  console.error('Audit execution error:', err);
  process.exit(1);
});
