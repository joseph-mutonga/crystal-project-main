-- Adds time-limited discount/offer support to products.
-- When discount_expires_at passes, the app automatically treats the offer as inactive
-- and the product reverts to its normal `price` (no cron job required).
ALTER TABLE products
  ADD COLUMN discount_percentage DECIMAL(5, 2) DEFAULT 0.00 AFTER is_active,
  ADD COLUMN discount_expires_at DATETIME DEFAULT NULL AFTER discount_percentage;
