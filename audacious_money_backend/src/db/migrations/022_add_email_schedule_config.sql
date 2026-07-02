-- Migration: 022_add_email_schedule_config
-- Description: Add email scheduling configuration to workshops table
-- Author: Claude Sonnet 4.5
-- Date: 2026-07-02

-- =============================================================================
-- ADD EMAIL SCHEDULE CONFIGURATION
-- =============================================================================
-- Allows admins to configure which emails are enabled and when they go out

ALTER TABLE workshops
ADD COLUMN IF NOT EXISTS custom_email_schedule JSONB DEFAULT '{
  "welcome": {"enabled": true, "when": "immediate"},
  "reminder": {"enabled": true, "when": {"hours_before": 24}},
  "week1": {"enabled": true, "when": {"days_after_workshop": 7}},
  "week2": {"enabled": true, "when": {"days_after_workshop": 14}},
  "week3": {"enabled": true, "when": {"days_after_workshop": 21}},
  "week4": {"enabled": true, "when": {"days_after_workshop": 28}},
  "wrapUp": {"enabled": true, "when": {"days_after_workshop": 30}}
}'::jsonb;

COMMENT ON COLUMN workshops.custom_email_schedule IS 'Configuration for which emails are enabled and when they are sent';

-- =============================================================================
-- EMAIL SCHEDULE CONFIGURATION STRUCTURE
-- =============================================================================
--
-- The custom_email_schedule JSON structure:
-- {
--   "welcome": {
--     "enabled": true,
--     "when": "immediate"  // Sent immediately on enrollment
--   },
--   "reminder": {
--     "enabled": true,
--     "when": {
--       "hours_before": 24  // Hours before workshop_start_datetime
--     }
--   },
--   "week1": {
--     "enabled": true,
--     "when": {
--       "days_after_workshop": 7  // Days after workshop_end_datetime
--     }
--   },
--   "week2": {
--     "enabled": true,
--     "when": {
--       "days_after_workshop": 14
--     }
--   },
--   "week3": {
--     "enabled": true,
--     "when": {
--       "days_after_workshop": 21
--     }
--   },
--   "week4": {
--     "enabled": true,
--     "when": {
--       "days_after_workshop": 28
--     }
--   },
--   "wrapUp": {
--     "enabled": true,
--     "when": {
--       "days_after_workshop": 30
--     }
--   }
-- }
