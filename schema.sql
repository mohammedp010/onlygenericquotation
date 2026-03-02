-- OnlyGeneric Quotation Generator — Database Schema
-- Run this script once to set up the database

CREATE DATABASE IF NOT EXISTS onlygeneric
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE onlygeneric;

-- ─── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id           INT          AUTO_INCREMENT PRIMARY KEY,
  username     VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- ─── Medicine Mappings ────────────────────────────────────────────────────────
-- prescribed_name/generic_name are stored in lowercase for case-insensitive matching
CREATE TABLE IF NOT EXISTS medicine_mappings (
  id               INT             AUTO_INCREMENT PRIMARY KEY,
  prescribed_name  VARCHAR(255)    NOT NULL,
  generic_name     VARCHAR(255)    NOT NULL,
  prescribed_price DECIMAL(10, 2)  NOT NULL DEFAULT 0.00,
  generic_price    DECIMAL(10, 2)  NOT NULL DEFAULT 0.00,
  updated_at       TIMESTAMP       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_mapping (prescribed_name, generic_name)
);

-- ─── Customers ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id            INT          AUTO_INCREMENT PRIMARY KEY,
  mobile        VARCHAR(10)  NOT NULL UNIQUE,
  customer_name VARCHAR(255) NOT NULL DEFAULT '',
  updated_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Migration: add prescribed_price to existing medicine_mappings (safe to run multiple times)
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME    = 'medicine_mappings'
    AND COLUMN_NAME   = 'prescribed_price'
);
SET @add_col = IF(@col_exists = 0,
  'ALTER TABLE medicine_mappings ADD COLUMN prescribed_price DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER generic_name',
  'SELECT 1');
PREPARE _stmt FROM @add_col; EXECUTE _stmt; DEALLOCATE PREPARE _stmt;

-- ─── Quotation Counter ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quotation_counter (
  id          INT  AUTO_INCREMENT PRIMARY KEY,
  last_number INT  NOT NULL DEFAULT 0
);

-- Seed the counter row (only insert if table is empty)
INSERT INTO quotation_counter (last_number)
SELECT 0 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM quotation_counter LIMIT 1);
