-- Migration: 028_add_trial_ending_email
-- Description: Add trialEnding email type for workshop trial expiration reminders
-- Author: Claude Opus 4.5
-- Date: 2026-10-23

-- =============================================================================
-- ADD trialEnding TO scheduled_emails email_type CHECK CONSTRAINT
-- =============================================================================

-- Drop the existing constraint
ALTER TABLE scheduled_emails DROP CONSTRAINT IF EXISTS scheduled_emails_email_type_check;

-- Add the new constraint with trialEnding included
ALTER TABLE scheduled_emails ADD CONSTRAINT scheduled_emails_email_type_check
  CHECK (email_type IN (
    'welcome', 'reminder', 'week1', 'week2', 'week3', 'week4', 'wrapUp', 'trialEnding', 'custom'
  ));

-- =============================================================================
-- UPDATE custom_email_schedule DEFAULT TO INCLUDE trialEnding
-- =============================================================================

-- Note: This only affects NEW workshops. Existing workshops keep their current config.
-- The application code will handle missing trialEnding config gracefully.

ALTER TABLE workshops
ALTER COLUMN custom_email_schedule SET DEFAULT '{
  "welcome": {"enabled": true, "when": "immediate"},
  "reminder": {"enabled": true, "when": {"hours_before": 24}},
  "week1": {"enabled": true, "when": {"days_after_workshop": 7}},
  "week2": {"enabled": true, "when": {"days_after_workshop": 14}},
  "week3": {"enabled": true, "when": {"days_after_workshop": 21}},
  "week4": {"enabled": true, "when": {"days_after_workshop": 28}},
  "wrapUp": {"enabled": true, "when": {"days_after_workshop": 30}},
  "trialEnding": {"enabled": true, "when": {"days_before_trial_expires": 3}}
}'::jsonb;

-- =============================================================================
-- ADD trialEnding TO custom_email_templates STRUCTURE
-- =============================================================================
-- Note: custom_email_templates is already JSONB and accepts any keys.
-- The application code will look for templates.trialEnding if present.
-- No schema change needed - just documenting the expected structure:
--
-- "trialEnding": {
--   "subject": "Your trial ends soon - action needed",
--   "htmlBody": "<html>...</html>",
--   "plainTextBody": "...",
--   "fromName": "Audrey"
-- }

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON CONSTRAINT scheduled_emails_email_type_check ON scheduled_emails IS
  'Valid email types: welcome, reminder, week1-4, wrapUp, trialEnding, custom';
