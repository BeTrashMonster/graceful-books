-- Migration 014: Fix subscription status values to match Stripe
--
-- Stripe uses 'trialing' not 'trial', and also has 'past_due', 'incomplete', etc.
-- This migration updates the CHECK constraint to accept all valid Stripe subscription statuses.

-- Drop the old constraint
ALTER TABLE user_products DROP CONSTRAINT IF EXISTS user_products_status_check;

-- Add new constraint with correct Stripe statuses
ALTER TABLE user_products ADD CONSTRAINT user_products_status_check
  CHECK (status IN (
    'trialing',      -- Free trial period
    'active',        -- Active subscription
    'past_due',      -- Payment failed but still active (grace period)
    'paused',        -- Manually paused by user
    'cancelled',     -- Cancelled by user
    'canceled',      -- Stripe also uses 'canceled' (American spelling)
    'expired',       -- Trial expired without conversion
    'incomplete',    -- Initial payment still pending
    'incomplete_expired',  -- Initial payment failed
    'unpaid'         -- Payment failed and out of grace period
  ));

-- Update any existing 'trial' values to 'trialing' (if any exist)
UPDATE user_products SET status = 'trialing' WHERE status = 'trial';

-- Update any 'canceled' to 'cancelled' for consistency (we'll use British spelling)
UPDATE user_products SET status = 'cancelled' WHERE status = 'canceled';
