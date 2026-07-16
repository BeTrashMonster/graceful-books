-- Migration: 025_scheduled_emails
-- Description: Create scheduled_emails table for robust email scheduling system
-- Author: Claude Opus 4.5
-- Date: 2026-07-16
-- Integration: Replaces Postmark SendAt approach with database-backed scheduling

-- =============================================================================
-- SCHEDULED EMAILS TABLE
-- =============================================================================

-- Stores all scheduled emails with status tracking for workshop email sequences
CREATE TABLE IF NOT EXISTS scheduled_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  enrollment_id UUID NOT NULL REFERENCES workshop_enrollments(id) ON DELETE CASCADE,
  workshop_id UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Email details
  email_type VARCHAR(30) NOT NULL CHECK (email_type IN (
    'welcome', 'reminder', 'week1', 'week2', 'week3', 'week4', 'wrapUp', 'custom'
  )),
  recipient_email VARCHAR(255) NOT NULL,
  recipient_name VARCHAR(255),

  -- Scheduling
  scheduled_for TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'sent', 'failed', 'cancelled'
  )),

  -- Execution tracking
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  last_attempt_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,

  -- Error handling
  last_error TEXT,

  -- Postmark tracking
  postmark_message_id VARCHAR(255),

  -- Custom content (for custom emails only - templates fetched at send time)
  custom_subject TEXT,
  custom_html_body TEXT,
  custom_text_body TEXT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES admin_users(id)
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Primary index for worker queries - find pending emails ready to send
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_pending_ready
  ON scheduled_emails(scheduled_for)
  WHERE status = 'pending';

-- Index for finding emails by enrollment
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_enrollment
  ON scheduled_emails(enrollment_id);

-- Index for finding emails by workshop
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_workshop
  ON scheduled_emails(workshop_id);

-- Index for finding emails by user
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_user
  ON scheduled_emails(user_id);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_status
  ON scheduled_emails(status);

-- Prevent duplicate emails of same type for same enrollment (excluding cancelled/failed)
CREATE UNIQUE INDEX IF NOT EXISTS idx_scheduled_emails_unique_type
  ON scheduled_emails(enrollment_id, email_type)
  WHERE status NOT IN ('cancelled', 'failed');

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Auto-update updated_at timestamp
CREATE TRIGGER update_scheduled_emails_updated_at
  BEFORE UPDATE ON scheduled_emails
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE scheduled_emails IS 'Database-backed email scheduling for workshop email sequences';
COMMENT ON COLUMN scheduled_emails.email_type IS 'Type of email: welcome, reminder, week1-4, wrapUp, or custom';
COMMENT ON COLUMN scheduled_emails.scheduled_for IS 'When the email should be sent';
COMMENT ON COLUMN scheduled_emails.status IS 'pending=waiting, processing=being sent, sent=delivered, failed=gave up, cancelled=admin cancelled';
COMMENT ON COLUMN scheduled_emails.attempts IS 'Number of send attempts made';
COMMENT ON COLUMN scheduled_emails.max_attempts IS 'Maximum retry attempts before marking as failed';
COMMENT ON COLUMN scheduled_emails.postmark_message_id IS 'Postmark MessageID for tracking after send';
COMMENT ON COLUMN scheduled_emails.custom_subject IS 'For custom emails only - standard emails fetch template at send time';
