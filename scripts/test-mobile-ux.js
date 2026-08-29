/**
 * Verification script for Mobile Product Grid and Cart UX Redesign
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`❌ FAIL: ${message}`);
  }
}

console.log('🧪 Testing Mobile Product Grid & Cart UX Redesign...\n');

// 1. Check shop.html, index.html, product.html, account.html grid container classes
const shopHtml = fs.readFileSync(path.join(root, 'public', 'shop.html'), 'utf-8');
const indexHtml = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf-8');
const productHtml = fs.readFileSync(path.join(root, 'public', 'product.html'), 'utf-8');
const accountHtml = fs.readFileSync(path.join(root, 'public', 'account.html'), 'utf-8');

assert(shopHtml.includes('grid-cols-2') && shopHtml.includes('sm:grid-cols-3') && shopHtml.includes('lg:grid-cols-3'), 'shop.html has 2-col mobile, 3-col tablet/desktop grid');
assert(indexHtml.includes('grid-cols-2') && indexHtml.includes('sm:grid-cols-3') && indexHtml.includes('lg:grid-cols-4'), 'index.html trending section has 2-col mobile grid');
assert(productHtml.includes('grid-cols-2') && productHtml.includes('sm:grid-cols-3') && productHtml.includes('lg:grid-cols-4'), 'product.html related products has 2-col mobile grid');
assert(accountHtml.includes('grid-cols-2') && accountHtml.includes('sm:grid-cols-3') && accountHtml.includes('lg:grid-cols-4'), 'account.html wishlist has 2-col mobile grid');

// 2. Check ui.js for Persistent Mobile Bottom Navigation, Sticky Cart Drawer Bar, Compact Rows, and Wishlist Drawer
const uiJs = fs.readFileSync(path.join(root, 'public', 'js', 'shared', 'ui.js'), 'utf-8');

assert(uiJs.includes('id="mobile-bottom-nav"') && uiJs.includes('md:hidden fixed bottom-0'), 'ui.js contains persistent mobile bottom navigation');
assert(uiJs.includes('id="mobile-bottom-wishlist-btn"') && uiJs.includes('id="mobile-bottom-cart-btn"'), 'Mobile nav contains Wishlist and Cart drawer triggers');
assert(uiJs.includes('id="cart-drawer-footer"') && uiJs.includes('shrink-0'), 'Cart drawer has sticky pinned footer bar');
assert(uiJs.includes('rose-glow-btn') && uiJs.includes('Checkout'), 'Cart drawer sticky footer contains rose-glow checkout button');
assert(uiJs.includes('w-16 h-16') || uiJs.includes('w-20 h-20'), 'Cart items use compact horizontal layout with square thumbnail');
assert(uiJs.includes('initWishlistDrawer') && uiJs.includes('id="wishlist-drawer-panel"'), 'ui.js contains slide-over wishlist drawer');

// 3. Check cart.js for Wishlist store methods
const cartJs = fs.readFileSync(path.join(root, 'public', 'js', 'shared', 'cart.js'), 'utf-8');

assert(cartJs.includes('getWishlist()') && cartJs.includes('isWishlisted(') && cartJs.includes('toggleWishlist('), 'CartStore supports getWishlist, isWishlisted, and toggleWishlist');
assert(cartJs.includes('crystal_crest_wishlist'), 'CartStore uses crystal_crest_wishlist localStorage key');
assert(cartJs.includes('wishlistUpdated'), 'CartStore dispatches wishlistUpdated event on toggle');

// 4. Check shop.js, index.js, product.js for Card UX and search persistence
const shopJs = fs.readFileSync(path.join(root, 'public', 'js', 'pages', 'shop.js'), 'utf-8');
const indexJs = fs.readFileSync(path.join(root, 'public', 'js', 'pages', 'index.js'), 'utf-8');
const productJs = fs.readFileSync(path.join(root, 'public', 'js', 'pages', 'product.js'), 'utf-8');

assert(shopJs.includes('data-wishlist-toggle') && shopJs.includes('wishlist-heart-btn'), 'shop.js product cards have top-right wishlist heart overlay button');
assert(indexJs.includes('data-wishlist-toggle') && indexJs.includes('wishlist-heart-btn'), 'index.js product cards have top-right wishlist heart overlay button');
assert(productJs.includes('data-wishlist-toggle') && productJs.includes('wishlist-heart-btn'), 'product.js related product cards have top-right wishlist heart overlay button');

assert(shopJs.includes('crystal_crest_search') && shopJs.includes('crystal_crest_cat'), 'shop.js persists search query and category in sessionStorage');
assert(shopJs.includes('quick-cat-btn') && shopJs.includes('setCategory('), 'shop.js supports quick horizontally scrollable category pills');

console.log(`\n📊 Summary: ${passedTests}/${totalTests} tests passed.`);

if (passedTests === totalTests) {
  console.log('🎉 All mobile UX and cart tests passed successfully!');
  process.exit(0);
} else {
  console.error('❌ Some tests failed.');
  process.exit(1);
}
