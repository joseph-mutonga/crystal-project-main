/**
 * Crystal Crest - Product Discount/Offer Helper
 * A discount is only "active" while discount_percentage > 0 AND discount_expires_at is in the future.
 * Once the expiry moment passes, callers simply stop applying the discount - no scheduled job needed.
 */

function isDiscountActive(row) {
  const pct = Number(row?.discount_percentage) || 0;
  if (pct <= 0 || !row?.discount_expires_at) return false;
  return new Date(row.discount_expires_at).getTime() > Date.now();
}

// Returns the price the customer should actually pay right now.
function getEffectivePrice(row) {
  const price = Number(row?.price) || 0;
  if (!isDiscountActive(row)) return price;
  const pct = Number(row.discount_percentage) || 0;
  const discounted = price * (1 - pct / 100);
  return Math.round(discounted * 100) / 100;
}

// Enriches a product row with discount_active + original_price/price fields for storefront responses.
function withStorefrontPricing(row) {
  const originalPrice = Number(row.price) || 0;
  const active = isDiscountActive(row);
  const effectivePrice = active ? getEffectivePrice(row) : originalPrice;

  return {
    ...row,
    price: effectivePrice,
    original_price: active ? originalPrice : undefined,
    discount_percentage: Number(row.discount_percentage) || 0,
    discount_expires_at: row.discount_expires_at || null,
    discount_active: active
  };
}

module.exports = { isDiscountActive, getEffectivePrice, withStorefrontPricing };
