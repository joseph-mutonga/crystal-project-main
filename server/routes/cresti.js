const express = require('express');
const router = express.Router();
const db = require('../config/db');
const productsStore = require('../store/productsStore');

function parseJson(val) {
  if (!val) return [];
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch (e) { return []; }
}

const STORE_FACTS = {
  location: 'Crystal Crest Flagship Store, Kajiado Town opposite Crapas Hotel',
  fulfillment: 'In-store pickup only at our Kajiado Town boutique. We do not offer courier or home delivery to Nairobi or elsewhere.',
  payments: 'M-Pesa, Credit/Debit Card, Bank Transfer, and Cash upon pickup or checkout.',
  spaServices: [
    '24K Gold Gel Manicure & Hand Rituals',
    'Aromatherapy Damask Rose Body Massages',
    'Botanical Gold Facial & Skin Rituals',
    'Hair & Makeup Artistry'
  ],
  spaPageLink: 'spa.html',
  shopPageLink: 'shop.html'
};

async function getStoreProductsContext(userMessage = '') {
  const queryWords = (userMessage || '').toLowerCase().split(/\s+/).filter(w => w.length > 2);

  let allProducts = [];

  try {
    const [rows] = await db.query(
      `SELECT p.id, p.name, c.name as category_name, p.price, p.description, p.sizes, p.colors, p.stock_quantity 
       FROM products p 
       LEFT JOIN categories c ON p.category_id = c.id 
       WHERE p.is_active = TRUE 
       ORDER BY p.created_at DESC LIMIT 30`
    );
    if (rows && rows.length > 0) {
      allProducts = rows.map(r => ({
        id: r.id,
        name: r.name,
        category: r.category_name || 'General',
        price: Number(r.price) || 0,
        description: r.description || '',
        sizes: parseJson(r.sizes),
        colors: parseJson(r.colors),
        stock: r.stock_quantity
      }));
    }
  } catch (e) {}

  if (allProducts.length === 0) {
    allProducts = productsStore.getProducts().map(p => ({
      id: p.id,
      name: p.name,
      category: p.category_name || p.category || 'General',
      price: Number(p.price) || 0,
      description: p.description || '',
      sizes: p.sizes || [],
      colors: p.colors || [],
      stock: p.stock_quantity
    }));
  }

  // Filter & prioritize products: include keyword-matched items plus top featured
  const matched = [];
  const others = [];

  for (const prod of allProducts) {
    const text = `${prod.name} ${prod.category} ${prod.description}`.toLowerCase();
    const isMatch = queryWords.some(w => text.includes(w));
    if (isMatch) {
      matched.push(prod);
    } else {
      others.push(prod);
    }
  }

  // Return up to 10 prioritized products
  return [...matched, ...others].slice(0, 10);
}

// Natural, conversational fallback responder without robotic menus or bulleted capability lists
function generateFallbackReply(message, catalog, conversationHistory = []) {
  const msg = (message || '').toLowerCase().trim();

  // 1. Delivery inquiries
  if (msg.includes('deliver') || msg.includes('shipping') || msg.includes('courier') || msg.includes('nairobi') || msg.includes('send') || msg.includes('transport') || msg.includes('locat')) {
    return `All Crystal Crest orders are for in-store pickup only at our boutique in Kajiado Town, directly opposite Crapas Hotel. We don't offer courier delivery to Nairobi at the moment, but your order will be beautifully packaged and ready for pickup whenever you stop by!`;
  }

  // 2. Breakouts / Acne / Medical skin conditions
  if (msg.includes('breakout') || msg.includes('breaking out') || msg.includes('acne') || msg.includes('pimple') || msg.includes('rash') || msg.includes('eczema') || msg.includes('dermat') || msg.includes('itch') || msg.includes('burn')) {
    const gentleSerum = catalog.find(p => p.name.toLowerCase().includes('gold') || p.category.toLowerCase().includes('skin')) || catalog[0];
    return `For active breakouts or persistent irritation, I recommend checking with a dermatologist first to address the underlying cause. Once your skin is calm and ready for gentle hydration, our soothing **[${gentleSerum.name}](product.html?id=${gentleSerum.id})** (KSh ${gentleSerum.price.toLocaleString()}) is a wonderful option. What is your everyday skin type?`;
  }

  // 3. Dry skin / Hydration
  if (msg.includes('dry') || msg.includes('hydrate') || msg.includes('flaky') || msg.includes('moistur') || msg.includes('serum')) {
    const serum = catalog.find(p => p.name.toLowerCase().includes('gold') || p.category.toLowerCase().includes('skin')) || catalog[0];
    return `For dry or dehydrated skin, I recommend our signature **[${serum.name}](product.html?id=${serum.id})** (KSh ${serum.price.toLocaleString()}), which infuses pure 24K gold flakes and Damask rose extract to deeply restore your moisture barrier. Are you looking for a daily hydration routine or an evening elixir?`;
  }

  // 4. Lip care / Lipstick
  if (msg.includes('lip') || msg.includes('shade') || msg.includes('lipstick') || msg.includes('gloss') || msg.includes('balm') || msg.includes('tint')) {
    const lip = catalog.find(p => p.name.toLowerCase().includes('lip') || p.category.toLowerCase().includes('lip')) || catalog[1];
    return `Our **[${lip.name}](product.html?id=${lip.id})** (KSh ${lip.price.toLocaleString()}) gives a gorgeous velvet finish enriched with botanical oils for all-day comfort. It comes in Royal Plum, Dusty Rose, and Crimson Majesty — what color palette do you usually love wearing?`;
  }

  // 5. Fragrance / Perfume
  if (msg.includes('perfume') || msg.includes('fragrance') || msg.includes('scent') || msg.includes('smell') || msg.includes('oud')) {
    const fragrance = catalog.find(p => p.name.toLowerCase().includes('oud') || p.category.toLowerCase().includes('fragrance')) || catalog[2];
    return `If you love captivating scents, our **[${fragrance.name}](product.html?id=${fragrance.id})** (KSh ${fragrance.price.toLocaleString()}) blends rare Cambodian agarwood with Bulgarian Damask rose. Do you lean towards warm woody fragrances or lighter floral notes?`;
  }

  // 6. Shoes / Footwear
  if (msg.includes('shoe') || msg.includes('footwear') || msg.includes('heels') || msg.includes('oxford') || msg.includes('leather')) {
    const shoe = catalog.find(p => p.name.toLowerCase().includes('shoe') || p.category.toLowerCase().includes('shoes')) || catalog[3];
    return `Our handcrafted **[${shoe.name}](product.html?id=${shoe.id})** (KSh ${shoe.price.toLocaleString()}) is tailored from premium Italian calfskin leather. Are you looking for men's formal dress shoes, crystal heels, or luxury footwear for children?`;
  }

  // 7. Spa & Wellness Services
  if (msg.includes('spa') || msg.includes('massage') || msg.includes('facial') || msg.includes('nail') || msg.includes('manicure') || msg.includes('pedicure') || msg.includes('treatment')) {
    return `Our private sanctuary in Kajiado Town offers 24K Gold Gel Manicures, Damask Rose Body Massages, and Gold Facials. You can view all available session times and reserve your spot directly on our **[Spa Services](spa.html)** page!`;
  }

  // 8. Payment & Checkout questions
  if (msg.includes('pay') || msg.includes('mpesa') || msg.includes('m-pesa') || msg.includes('card') || msg.includes('cash') || msg.includes('buy') || msg.includes('order')) {
    return `We accept M-Pesa, Card, Bank Transfer, and Cash upon pickup. Just add your favorite items to your shopping bag, proceed to Checkout, and collect your packaged order at our Kajiado Town boutique. What can I help you find today?`;
  }

  // 9. Natural greeting
  return `Hey! Welcome to Crystal Crest — what can I help you find today? Feel free to share your skin type, what you're shopping for, or any questions you have!`;
}

const { GoogleGenerativeAI } = require('@google/generative-ai');

// POST /api/cresti/chat
router.post('/chat', async (req, res) => {
  const { message, conversationHistory } = req.body;

  const rawKey = (process.env.GEMINI_API_KEY || '').trim();
  const hasKey = Boolean(rawKey && rawKey !== 'your_gemini_api_key_here');

  console.log('\n=================== [CRESTI CHAT REQUEST] ===================');
  console.log(`[Cresti] Incoming user message: "${message}"`);
  console.log(`[Cresti] GEMINI_API_KEY present: ${hasKey}`);
  console.log(`[Cresti] Conversation history length: ${Array.isArray(conversationHistory) ? conversationHistory.length : 0}`);

  if (!message || !message.trim()) {
    console.log('[Cresti] Validation Error: Message text is empty.');
    return res.status(400).json({ success: false, error: 'Message text is required.' });
  }

  const catalog = await getStoreProductsContext(message);

  // 1. Fallback ONLY if GEMINI_API_KEY is completely missing/unset
  if (!hasKey) {
    console.log('[Cresti] GEMINI_API_KEY is missing/unset. Using rule-based fallback engine.');
    const fallbackReply = generateFallbackReply(message, catalog, conversationHistory);
    console.log(`[Cresti] Fallback reply produced: "${fallbackReply}"`);
    console.log('=============================================================\n');
    return res.json({
      success: true,
      reply: fallbackReply,
      source: 'fallback'
    });
  }

  // 2. Live Google Gemini API Integration
  console.log('[Cresti] Calling Google Gemini API...');
  try {
    const catalogContext = catalog.map(p => 
      `- ID: ${p.id} | Name: ${p.name} | Category: ${p.category} | Price: KSh ${p.price.toLocaleString()} | Description: ${p.description}`
    ).join('\n');

    const systemPrompt = `You are Cresti, the warm, knowledgeable, and attentive beauty and styling concierge for Crystal Crest Luxury Boutique.

YOUR CONVERSATIONAL STYLE & PERSONALITY:
- Speak naturally and warmly, like a friendly expert behind the counter ("Hey! Welcome to Crystal Crest — what can I help you find today?").
- Default to plain conversational sentences (typically 2–3 sentences), NOT bullet lists.
- NEVER open a message with a scripted capability menu or feature list (never say "I can recommend X, Y, Z... Try asking me: - question 1 - question 2"). Let the conversation unfold organically from what the customer actually says.
- Avoid starting subsequent replies with self-introductions ("I am Cresti...", "I can...").
- Only use a concise list if the customer explicitly asks to compare multiple specific products or options where a list genuinely improves clarity.
- Keep emoji use minimal and occasional (at most one subtle emoji, not on every message).
- Ask natural, friendly clarifying questions (e.g. skin type, preferred shade, budget, occasion) before making extensive recommendations.

CRITICAL BOUNDARIES & ACCURACY:
1. NO MEDICAL DIAGNOSES: If a customer mentions acne breakouts, eczema, rashes, or medical skin issues, gently advise consulting a certified dermatologist. Suggest gentle general hydration only after their skin calms.
2. NEVER INVENT PRODUCTS OR PRICES: Only reference real products from the CATALOG below. Always quote exact prices in Kenyan Shillings (e.g. "KSh 14,500").
3. CLICKABLE PRODUCT LINKS: Use markdown format [Product Name](product.html?id=ID) for physical items, and [Spa Services](spa.html) for spa rituals.
4. ORDER GUIDANCE: You do not process transactions directly in chat. Guide customers to click the product link, add items to their shopping bag, and proceed to Checkout or reserve a slot on the Spa page.
5. STORE FACTS (STICK STRICTLY TO THESE):
   - Fulfillment: In-store pickup ONLY at our Kajiado Town boutique (opposite Crapas Hotel). We do NOT deliver to Nairobi or offer courier delivery.
   - Payment Methods: M-Pesa, Credit/Debit Card, Bank Transfer, and Cash upon pickup or checkout.
   - Spa Services: Nails & Gel Manicure, Damask Rose Aromatherapy Massage, Gold Facials, and Hair/Makeup Artistry hosted on [Spa Services](spa.html).

CURRENT STORE FACTS:
- Location: ${STORE_FACTS.location}
- Delivery Policy: ${STORE_FACTS.fulfillment}
- Accepted Payments: ${STORE_FACTS.payments}
- Available Spa Rituals: ${STORE_FACTS.spaServices.join(', ')}

CURRENT PRODUCT CATALOG CONTEXT:
${catalogContext}`;

    const genAI = new GoogleGenerativeAI(rawKey);

    // Format conversation history for Gemini (roles: 'user' and 'model')
    const contents = [];
    if (Array.isArray(conversationHistory)) {
      conversationHistory.slice(-10).forEach(m => {
        const text = (m.text || m.content || '').trim();
        if (text) {
          contents.push({
            role: (m.sender === 'user' || m.role === 'user') ? 'user' : 'model',
            parts: [{ text }]
          });
        }
      });
    }

    contents.push({
      role: 'user',
      parts: [{ text: message.trim() }]
    });

    const modelsToTry = [process.env.GEMINI_MODEL || 'gemini-2.0-flash', 'gemini-flash-latest', 'gemini-3.5-flash'];
    let assistantReply = null;
    let lastError = null;

    for (const modelName of modelsToTry) {
      try {
        console.log(`[Cresti] Trying Gemini model: "${modelName}"...`);
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: systemPrompt
        });

        const result = await model.generateContent({ contents });
        const response = await result.response;
        assistantReply = response.text();
        console.log(`[Cresti] Successfully generated response using model "${modelName}".`);
        break;
      } catch (modelErr) {
        console.warn(`[Cresti] Model "${modelName}" failed:`, modelErr.message.slice(0, 150));
        lastError = modelErr;
      }
    }

    if (!assistantReply) {
      throw lastError || new Error('All Gemini model attempts failed.');
    }

    console.log('\n[Cresti] === GEMINI RAW RESPONSE RECEIVED ===');
    console.log(assistantReply);
    console.log('=============================================\n');

    return res.json({
      success: true,
      reply: assistantReply,
      source: 'gemini'
    });

  } catch (err) {
    // Explicit, LOUD error logging — not silent fallback
    console.error('\n🚨 [Cresti] GOOGLE GEMINI API CALL FAILED! FULL ERROR DETAILS:');
    console.error(err);
    console.error('=============================================================\n');

    // Return clear error message to frontend instead of silently pretending with canned greeting
    return res.status(500).json({
      success: false,
      error: 'Cresti is having trouble connecting right now, please try again in a moment.',
      reply: 'Cresti is having trouble connecting right now, please try again in a moment.',
      details: err.message
    });
  }
});

module.exports = router;
