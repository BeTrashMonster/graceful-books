-- Migration: Add frozen account columns
-- Purpose: Allow admins to freeze user accounts with a reason

-- Add frozen status to user_products status check
ALTER TABLE user_products DROP CONSTRAINT IF EXISTS user_products_status_check;
ALTER TABLE user_products ADD CONSTRAINT user_products_status_check
  CHECK (status IN (
    'trialing',
    'active',
    'paused',
    'frozen',
    'cancelled',
    'canceled',
    'expired',
    'past_due',
    'incomplete',
    'incomplete_expired',
    'unpaid'
  ));

-- Add frozen tracking columns to user_products
ALTER TABLE user_products ADD COLUMN IF NOT EXISTS frozen_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE user_products ADD COLUMN IF NOT EXISTS frozen_reason TEXT;
ALTER TABLE user_products ADD COLUMN IF NOT EXISTS frozen_by_admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL;

-- Add needs_attention flag to users table for admin highlighting
ALTER TABLE users ADD COLUMN IF NOT EXISTS needs_attention BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS needs_attention_reason TEXT;

-- Create index for finding frozen accounts
CREATE INDEX IF NOT EXISTS idx_user_products_frozen ON user_products(frozen_at) WHERE frozen_at IS NOT NULL;

-- Create index for finding accounts needing attention
CREATE INDEX IF NOT EXISTS idx_users_needs_attention ON users(needs_attention) WHERE needs_attention = TRUE;
