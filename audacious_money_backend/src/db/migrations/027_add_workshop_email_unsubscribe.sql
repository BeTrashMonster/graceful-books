-- Migration: Add email unsubscribe tracking to workshop enrollments
-- Purpose: Allow workshop participants to unsubscribe from automated emails

ALTER TABLE workshop_enrollments
ADD COLUMN IF NOT EXISTS email_unsubscribed_at TIMESTAMP WITH TIME ZONE;

-- Index for filtering out unsubscribed users when sending emails
CREATE INDEX IF NOT EXISTS idx_workshop_enrollments_email_unsubscribed
ON workshop_enrollments(email_unsubscribed_at)
WHERE email_unsubscribed_at IS NOT NULL;

COMMENT ON COLUMN workshop_enrollments.email_unsubscribed_at IS 'Timestamp when user unsubscribed from workshop emails';
