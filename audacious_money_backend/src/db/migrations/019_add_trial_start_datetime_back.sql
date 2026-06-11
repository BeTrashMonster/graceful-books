-- Migration: 019_add_trial_start_datetime_back
-- Description: Re-add trial_start_datetime - it's needed for workshop trial tracking
-- Author: Claude Sonnet 4.5
-- Date: 2026-06-11
-- Context: This field is essential - each workshop can have different trial start timing

-- Add trial_start_datetime back if 018 removed it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workshops' AND column_name = 'trial_start_datetime'
  ) THEN
    -- Add as nullable first, then we'll handle defaults in the application
    ALTER TABLE workshops ADD COLUMN trial_start_datetime TIMESTAMPTZ;
    COMMENT ON COLUMN workshops.trial_start_datetime IS 'When the trial period begins counting down (can differ from enrollment time)';
  END IF;
END $$;
