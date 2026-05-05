/**
 * Migration 009: Update user_products status constraint
 *
 * Add Stripe subscription statuses to the allowed values:
 * - trialing (Stripe's trial status)
 * - past_due (payment failed but subscription still active)
 * - payment_failed (used for checkout failures)
 */

-- Drop old constraint
ALTER TABLE user_products DROP CONSTRAINT IF EXISTS user_products_status_check;

-- Add new constraint with all Stripe statuses
ALTER TABLE user_products ADD CONSTRAINT user_products_status_check
  CHECK (status IN (
    'trial',      -- Our custom trial status
    'trialing',   -- Stripe's trial status
    'active',     -- Subscription is active
    'past_due',   -- Payment failed but subscription not cancelled yet
    'paused',     -- Subscription paused
    'cancelled',  -- Subscription cancelled
    'canceled',   -- Stripe uses 'canceled' (US spelling)
    'expired',    -- Subscription expired
    'payment_failed',  -- Checkout payment failed
    'incomplete',      -- Stripe subscription incomplete
    'incomplete_expired', -- Stripe subscription incomplete and expired
    'unpaid'      -- Stripe subscription unpaid
  ));

-- Update any existing 'trial' to 'trialing' for consistency with Stripe
UPDATE user_products SET status = 'trialing' WHERE status = 'trial';

COMMENT ON CONSTRAINT user_products_status_check ON user_products IS
  'Allows all Stripe subscription statuses plus custom statuses (trial, payment_failed)';
