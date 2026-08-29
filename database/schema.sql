-- Crystal Crest Luxury Cosmetics Database Schema
-- Primary Keys: VARCHAR(36) UUIDs generated in Express via crypto.randomUUID()
-- All tables feature TIMESTAMP DEFAULT CURRENT_TIMESTAMP for created_at

CREATE DATABASE IF NOT EXISTS crystal_crest DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE crystal_crest;

-- 1. Categories Table
CREATE TABLE IF NOT EXISTS categories (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  image_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. Products Table (Includes Shoes & Spa Services)
CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category_id VARCHAR(36) DEFAULT NULL,
  price DECIMAL(10, 2) NOT NULL,
  buying_price DECIMAL(10, 2) DEFAULT 0.00,
  description TEXT,
  images JSON,
  sizes JSON,
  colors JSON,
  stock_quantity INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 3. Users Table (With role column)
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(50),
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'customer',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 4. Cashiers Table (For POS system with deactivated_at column)
CREATE TABLE IF NOT EXISTS cashiers (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  pin_hash VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deactivated_at TIMESTAMP DEFAULT NULL
) ENGINE=InnoDB;

-- 5. Wishlists Table
CREATE TABLE IF NOT EXISTS wishlists (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  product_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 6. Cart Items Table
CREATE TABLE IF NOT EXISTS cart_items (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  product_id VARCHAR(36) NOT NULL,
  quantity INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 7. Orders Table (With Paybill Verification & Cashier Tracking)
CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(36) PRIMARY KEY,
  order_number VARCHAR(100) NOT NULL UNIQUE,
  user_id VARCHAR(36) DEFAULT NULL,
  cashier_id VARCHAR(36) DEFAULT NULL,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  address TEXT,
  city VARCHAR(100),
  payment_method VARCHAR(50) NOT NULL,
  payment_status VARCHAR(50) DEFAULT 'pending',
  payment_mode VARCHAR(20) DEFAULT 'simulation',
  transaction_reference VARCHAR(255) DEFAULT NULL,
  payer_name_or_number VARCHAR(255) DEFAULT NULL,
  verified_by VARCHAR(36) DEFAULT NULL,
  verified_at TIMESTAMP NULL DEFAULT NULL,
  payment_message TEXT DEFAULT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  shipping DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  total DECIMAL(10, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  pickup_location TEXT,
  source VARCHAR(50) DEFAULT 'online',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (cashier_id) REFERENCES cashiers(id) ON DELETE SET NULL,
  FOREIGN KEY (verified_by) REFERENCES cashiers(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 7b. System Settings Table
CREATE TABLE IF NOT EXISTS settings (
  `key` VARCHAR(100) PRIMARY KEY,
  `value` TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT IGNORE INTO settings (`key`, `value`) VALUES 
('paybill_number', '400200'),
('paybill_account_number', '104514'),
('paybill_account_name', 'Crystal Crest');

-- 8. Order Items Table
CREATE TABLE IF NOT EXISTS order_items (
  id VARCHAR(36) PRIMARY KEY,
  order_id VARCHAR(36) NOT NULL,
  product_id VARCHAR(36) NOT NULL,
  quantity INT NOT NULL,
  price_at_purchase DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 9. Newsletter Subscribers Table
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 10. Spa Bookings Table (Includes Cashier Walk-in & Order Tracking)
CREATE TABLE IF NOT EXISTS spa_bookings (
  id VARCHAR(36) PRIMARY KEY,
  service_id VARCHAR(36) NOT NULL,
  service_name VARCHAR(255) NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(50),
  booking_date DATE NOT NULL,
  booking_time VARCHAR(20) NOT NULL,
  status VARCHAR(50) DEFAULT 'confirmed',
  cashier_id VARCHAR(36) DEFAULT NULL,
  cashier_name VARCHAR(255) DEFAULT NULL,
  order_id VARCHAR(36) DEFAULT NULL,
  price DECIMAL(10, 2) DEFAULT 0.00,
  payment_method VARCHAR(50) DEFAULT 'cash',
  source VARCHAR(50) DEFAULT 'online',
  cancellation_reason TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cashier_id) REFERENCES cashiers(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Seed Admin User (Password: admin123)
INSERT IGNORE INTO users (id, full_name, email, phone, password_hash, role) VALUES 
('usr-admin-001', 'Executive Administrator', 'admin@crystalcrest.com', '+254712345678', '$2b$10$9W7NkaD/6x5hkvogEwNOPOC4POciikYD5D4PtVF.5Ojbycwmvxame', 'admin');

-- Seed Test Cashier (PIN: 1234 -> SHA256: 03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4)
INSERT IGNORE INTO cashiers (id, name, pin_hash, is_active) VALUES 
('csh-test-001', 'Test Cashier', '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', TRUE);

-- Seed Initial Categories
INSERT IGNORE INTO categories (id, name, slug, image_url) VALUES 
('cat-skincare-001', 'Skincare', 'skincare', 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80'),
('cat-lipcare-002', 'Lip Care', 'lip-care', 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&w=800&q=80'),
('cat-fragrance-003', 'Fragrance', 'fragrance', 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=800&q=80'),
('cat-makeup-004', 'Makeup & Cosmetics', 'makeup-cosmetics', 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80'),
('cat-shoes-005', 'Luxury Shoes', 'luxury-shoes', 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=800&q=80'),
('cat-spa-006', 'Spa & Beauty Services', 'spa-services', 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80');

-- Seed Initial Products
INSERT IGNORE INTO products (id, name, category_id, price, buying_price, description, images, sizes, colors, stock_quantity, is_active) VALUES
(
  'prod-gold-serum-001',
  'Celestial Rose 24K Gold Youth Serum',
  'cat-skincare-001',
  14500.00,
  6500.00,
  'An elixir infused with pure 24K gold flakes, Damask rose extract, and triple-hyaluronic complex.',
  '["https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80"]',
  '["30 ml / 1.0 fl oz", "50 ml / 1.7 fl oz"]',
  '[]',
  45,
  TRUE
),
(
  'prod-lip-elixir-002',
  'Velvet Satin Lip Elixir - Royal Plum',
  'cat-lipcare-002',
  4800.00,
  1800.00,
  'Deeply nourishing hybrid lipstick oil that delivers rich velvet color with intense hydration.',
  '["https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&w=800&q=80"]',
  '["4.5 g / 0.15 oz"]',
  '["Royal Plum", "Dusty Rose", "Crimson Majesty"]',
  80,
  TRUE
),
(
  'prod-oud-perfume-004',
  'Imperial Oud & Rose Eau de Parfum',
  'cat-fragrance-003',
  22000.00,
  9500.00,
  'An opulent fragrance blending rare Cambodian agarwood, Bulgarian rose, and warm amber resin.',
  '["https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=800&q=80"]',
  '["50 ml", "100 ml"]',
  '[]',
  25,
  TRUE
),
(
  'prod-shoe-men-01',
  'Imperial Italian Leather Oxfords (Men)',
  'cat-shoes-005',
  28000.00,
  12000.00,
  'Handcrafted Italian calfskin leather dress shoes featuring Goodyear welt construction and mahogany shine.',
  '["https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?auto=format&fit=crop&w=800&q=80"]',
  '["EU 40 / US 7.5", "EU 42 / US 9", "EU 44 / US 10.5"]',
  '["Mahogany Brown", "Midnight Black"]',
  20,
  TRUE
);
