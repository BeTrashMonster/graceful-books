-- Migration: 038_lifetime_access_codes.sql
-- Description: Create tables for lifetime access codes system
-- Date: 2026-11-03

-- Lifetime codes table
CREATE TABLE IF NOT EXISTS lifetime_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  max_redemptions INTEGER,                  -- NULL = unlimited
  redemptions_used INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,                   -- NULL = never expires
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by_admin_id UUID NOT NULL REFERENCES admin_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Junction table: code -> products (multi-select)
CREATE TABLE IF NOT EXISTS lifetime_code_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lifetime_code_id UUID NOT NULL REFERENCES lifetime_codes(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(lifetime_code_id, product_id)
);

-- Redemption tracking
CREATE TABLE IF NOT EXISTS lifetime_code_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lifetime_code_id UUID NOT NULL REFERENCES lifetime_codes(id),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  UNIQUE(lifetime_code_id, user_id)  -- Each user can only redeem a code once
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_lifetime_codes_code ON lifetime_codes(code);
CREATE INDEX IF NOT EXISTS idx_lifetime_codes_active ON lifetime_codes(is_active);
CREATE INDEX IF NOT EXISTS idx_lifetime_codes_expires ON lifetime_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_lifetime_code_products_code_id ON lifetime_code_products(lifetime_code_id);
CREATE INDEX IF NOT EXISTS idx_lifetime_code_products_product_id ON lifetime_code_products(product_id);
CREATE INDEX IF NOT EXISTS idx_lifetime_code_redemptions_code_id ON lifetime_code_redemptions(lifetime_code_id);
CREATE INDEX IF NOT EXISTS idx_lifetime_code_redemptions_user_id ON lifetime_code_redemptions(user_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_lifetime_codes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_lifetime_codes_updated_at ON lifetime_codes;
CREATE TRIGGER update_lifetime_codes_updated_at
  BEFORE UPDATE ON lifetime_codes
  FOR EACH ROW
  EXECUTE FUNCTION update_lifetime_codes_updated_at();

-- Add comment for documentation
COMMENT ON TABLE lifetime_codes IS 'Stores lifetime access codes that can be redeemed for product access without payment';
COMMENT ON TABLE lifetime_code_products IS 'Junction table linking codes to products they grant access to';
COMMENT ON TABLE lifetime_code_redemptions IS 'Tracks who redeemed which codes and when';
