-- Migration: Add customer email OTP login verification table
-- Date: 2026-09-17
--
-- This migration is applied automatically on server startup (see server/server.js
-- initDatabaseSchema()), and is provided here for manual/production database runs.
--
-- Usage:
--   mysql -u <DB_USER> -p <DB_NAME> < database/migrations/2026-09-17-add-otp-verifications.sql

CREATE TABLE IF NOT EXISTS otp_verifications (
  email VARCHAR(255) PRIMARY KEY,
  otp_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  last_sent_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;
