-- Migration: 032_enhance_scheduled_emails.sql
-- Description: Add trialEnding email type and link to sent_emails table
-- This connects scheduled emails to their sent records for complete email tracking

-- Add trialEnding to email_type check constraint
ALTER TABLE scheduled_emails DROP CONSTRAINT IF EXISTS scheduled_emails_email_type_check;
ALTER TABLE scheduled_emails ADD CONSTRAINT scheduled_emails_email_type_check
  CHECK (email_type IN (
    'welcome', 'reminder', 'week1', 'week2', 'week3', 'week4', 'wrapUp', 'trialEnding', 'custom'
  ));

-- Add link to sent_emails table (populated when email is actually sent)
ALTER TABLE scheduled_emails
  ADD COLUMN IF NOT EXISTS sent_email_id UUID REFERENCES sent_emails(id) ON DELETE SET NULL;

-- Add index for finding scheduled emails by sent_email
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_sent_email
  ON scheduled_emails(sent_email_id)
  WHERE sent_email_id IS NOT NULL;

-- Update comment
COMMENT ON COLUMN scheduled_emails.email_type IS 'Type of email: welcome, reminder, week1-4, wrapUp, trialEnding, or custom';
COMMENT ON COLUMN scheduled_emails.sent_email_id IS 'Links to sent_emails record after email is sent';
