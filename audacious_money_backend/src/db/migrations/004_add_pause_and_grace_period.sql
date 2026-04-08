-- 002_add_pause_and_grace_period.sql
-- Add support for paused subscriptions and grace periods

-- Add 'paused' status to user_products
ALTER TABLE user_products DROP CONSTRAINT IF EXISTS user_products_status_check;
ALTER TABLE user_products ADD CONSTRAINT user_products_status_check
  CHECK (status IN ('trial', 'active', 'paused', 'cancelled', 'expired'));

-- Add grace period tracking
ALTER TABLE user_products ADD COLUMN IF NOT EXISTS grace_period_ends_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE user_products ADD COLUMN IF NOT EXISTS paused_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE user_products ADD COLUMN IF NOT EXISTS resumed_at TIMESTAMP WITH TIME ZONE;

-- Add Stripe customer ID to users table for easier payment method management
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);

-- Add index for efficient grace period queries
CREATE INDEX IF NOT EXISTS idx_user_products_grace_period
  ON user_products(grace_period_ends_at)
  WHERE grace_period_ends_at IS NOT NULL;

-- Add index for subscription status queries
CREATE INDEX IF NOT EXISTS idx_user_products_status
  ON user_products(status);
