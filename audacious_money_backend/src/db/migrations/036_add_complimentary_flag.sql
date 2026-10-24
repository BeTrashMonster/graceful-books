-- Migration: Add complimentary access flag
-- Purpose: Track products granted by admin vs paid subscriptions

-- Add is_complimentary flag to user_products
ALTER TABLE user_products ADD COLUMN IF NOT EXISTS is_complimentary BOOLEAN DEFAULT FALSE;

-- Add cancelled_at if it doesn't exist (for explicit cancellation tracking)
ALTER TABLE user_products ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE;

-- Create index for finding complimentary accounts
CREATE INDEX IF NOT EXISTS idx_user_products_complimentary
  ON user_products(is_complimentary) WHERE is_complimentary = TRUE;

-- Add comment
COMMENT ON COLUMN user_products.is_complimentary IS 'Whether this product was granted by admin (not paid)';
