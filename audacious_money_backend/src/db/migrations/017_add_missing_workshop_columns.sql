-- Migration: 017_add_missing_workshop_columns
-- Description: Add stripe_price_id and other missing columns to workshops table
-- Author: Claude Sonnet 4.5
-- Date: 2026-06-10
-- Context: Old migration 015 ran before we simplified the schema, need to alter existing table

-- Add missing columns if they don't exist
DO $$
BEGIN
  -- Add stripe_price_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workshops' AND column_name = 'stripe_price_id'
  ) THEN
    ALTER TABLE workshops ADD COLUMN stripe_price_id VARCHAR(255) NOT NULL DEFAULT 'price_placeholder';
    COMMENT ON COLUMN workshops.stripe_price_id IS 'Stripe price ID for this workshop subscription';
  END IF;

  -- Add trial_duration_days column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workshops' AND column_name = 'trial_duration_days'
  ) THEN
    ALTER TABLE workshops ADD COLUMN trial_duration_days INTEGER NOT NULL DEFAULT 30;
    COMMENT ON COLUMN workshops.trial_duration_days IS 'Length of free trial period (passed to Stripe)';
  END IF;

END $$;

-- Remove the placeholder default after adding the column
ALTER TABLE workshops ALTER COLUMN stripe_price_id DROP DEFAULT;
