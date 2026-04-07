-- Add missing columns needed for Stripe webhook handling
ALTER TABLE user_products
ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT false;

-- Add index for faster stripe_customer_id lookups
CREATE INDEX IF NOT EXISTS idx_user_products_customer ON user_products(stripe_customer_id);

COMMENT ON COLUMN user_products.stripe_customer_id IS 'Stripe customer ID for this subscription';
COMMENT ON COLUMN user_products.current_period_start IS 'Current billing period start date';
COMMENT ON COLUMN user_products.current_period_end IS 'Current billing period end date';
COMMENT ON COLUMN user_products.cancel_at_period_end IS 'Whether subscription cancels at period end';
