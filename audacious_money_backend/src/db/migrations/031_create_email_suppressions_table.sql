-- Migration: 031_create_email_suppressions_table.sql
-- Description: Track users who should not receive emails (bounced, unsubscribed, spam complaints)
-- This protects email deliverability by preventing sends to problematic addresses

CREATE TABLE email_suppressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who is suppressed (email is primary key for lookups, user_id optional for linked accounts)
  email VARCHAR(255) NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Why suppressed
  suppression_type VARCHAR(30) NOT NULL CHECK (suppression_type IN (
    'unsubscribed',    -- User opted out
    'hard_bounce',     -- Email address doesn't exist
    'soft_bounce',     -- Temporary delivery failure (after repeated failures)
    'spam_complaint',  -- User marked email as spam
    'manual'           -- Admin manually suppressed
  )),
  suppression_reason TEXT,

  -- What emails are suppressed (empty array = all emails)
  email_types TEXT[] DEFAULT '{}',

  -- Tracking
  suppressed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  suppressed_by_admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,

  -- Source of suppression
  source_email_id UUID REFERENCES sent_emails(id) ON DELETE SET NULL,  -- Which email caused this
  source_provider VARCHAR(50),  -- 'resend', 'postmark', etc.
  source_event_id VARCHAR(255),  -- Provider's event ID

  -- Reactivation (if user is removed from suppression)
  reactivated_at TIMESTAMPTZ,
  reactivated_by_admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  reactivation_reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one active suppression per email (can have history via reactivated records)
CREATE UNIQUE INDEX idx_email_suppressions_active_email
  ON email_suppressions(email)
  WHERE reactivated_at IS NULL;

-- Find suppressions by user
CREATE INDEX idx_email_suppressions_user
  ON email_suppressions(user_id)
  WHERE user_id IS NOT NULL;

-- Find by suppression type for reporting
CREATE INDEX idx_email_suppressions_type
  ON email_suppressions(suppression_type);

-- Find active suppressions quickly
CREATE INDEX idx_email_suppressions_active
  ON email_suppressions(suppressed_at DESC)
  WHERE reactivated_at IS NULL;

-- Comments
COMMENT ON TABLE email_suppressions IS 'Email suppression list - users who should not receive emails';
COMMENT ON COLUMN email_suppressions.email IS 'The email address that is suppressed';
COMMENT ON COLUMN email_suppressions.suppression_type IS 'Reason for suppression: unsubscribed, hard_bounce, soft_bounce, spam_complaint, or manual';
COMMENT ON COLUMN email_suppressions.email_types IS 'Specific email types suppressed (empty = all emails)';
COMMENT ON COLUMN email_suppressions.reactivated_at IS 'If set, this suppression is no longer active';
