-- Migration: 024_add_enrollment_tracking_columns
-- Description: Add missing tracking columns to workshop_enrollments table
-- These columns track user engagement and status for admin dashboard display

-- Add enrollment status column
ALTER TABLE workshop_enrollments
  ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'enrolled'
    CHECK (status IN ('enrolled', 'active', 'trial_active', 'trial_expired', 'converted', 'cancelled'));

-- Add first login tracking
ALTER TABLE workshop_enrollments
  ADD COLUMN IF NOT EXISTS first_login_at TIMESTAMPTZ;

-- Add last active tracking
ALTER TABLE workshop_enrollments
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

-- Add trial tracking (mirrors user_products but useful for enrollment-specific queries)
ALTER TABLE workshop_enrollments
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ;

ALTER TABLE workshop_enrollments
  ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMPTZ;

-- Add conversion tracking
ALTER TABLE workshop_enrollments
  ADD COLUMN IF NOT EXISTS converted_to_paid_at TIMESTAMPTZ;

-- Add email tracking (JSON array of sent emails)
ALTER TABLE workshop_enrollments
  ADD COLUMN IF NOT EXISTS emails_sent JSONB DEFAULT '[]'::jsonb;

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_workshop_enrollments_status ON workshop_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_workshop_enrollments_last_active ON workshop_enrollments(last_active_at);

-- Comments
COMMENT ON COLUMN workshop_enrollments.status IS 'Current enrollment status: enrolled, active, trial_active, trial_expired, converted, cancelled';
COMMENT ON COLUMN workshop_enrollments.first_login_at IS 'When user first logged in after enrollment';
COMMENT ON COLUMN workshop_enrollments.last_active_at IS 'Most recent user activity timestamp';
COMMENT ON COLUMN workshop_enrollments.trial_started_at IS 'When trial period began';
COMMENT ON COLUMN workshop_enrollments.trial_expires_at IS 'When trial period ends';
COMMENT ON COLUMN workshop_enrollments.converted_to_paid_at IS 'When user converted from trial to paid';
COMMENT ON COLUMN workshop_enrollments.emails_sent IS 'Array of sent email records: [{emailType, sentAt}]';
