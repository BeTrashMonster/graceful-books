-- Migration: Add Annual Pricing Support
-- =============================================================================
-- Adds columns for annual subscription pricing to both products and workshops
-- =============================================================================

-- Add annual pricing columns to products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS price_annual DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS stripe_price_id_annual VARCHAR(255);

-- Add annual pricing columns to workshops table
ALTER TABLE workshops
ADD COLUMN IF NOT EXISTS stripe_price_id_annual VARCHAR(255);

-- Comments
COMMENT ON COLUMN products.price_annual IS 'Annual subscription price (typically discounted vs 12x monthly)';
COMMENT ON COLUMN products.stripe_price_id_annual IS 'Stripe price ID for annual billing';
COMMENT ON COLUMN workshops.stripe_price_id_annual IS 'Stripe price ID for annual workshop subscription';
