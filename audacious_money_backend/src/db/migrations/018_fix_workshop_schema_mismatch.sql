-- Migration: 018_fix_workshop_schema_mismatch
-- Description: Fix schema mismatch from old migration 015
-- Author: Claude Sonnet 4.5
-- Date: 2026-06-11
-- Context: Old migration 015 created columns we don't use in simplified schema

-- Drop columns that exist in old schema but not in simplified schema
DO $$
BEGIN
  -- Drop trial_start_datetime (we use access_grant_datetime instead)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workshops' AND column_name = 'trial_start_datetime'
  ) THEN
    ALTER TABLE workshops DROP COLUMN trial_start_datetime;
  END IF;

  -- Drop custom_email_schedule (not in simplified schema)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workshops' AND column_name = 'custom_email_schedule'
  ) THEN
    ALTER TABLE workshops DROP COLUMN custom_email_schedule;
  END IF;

  -- Drop post_trial_action (not in simplified schema)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workshops' AND column_name = 'post_trial_action'
  ) THEN
    ALTER TABLE workshops DROP COLUMN post_trial_action;
  END IF;

END $$;
