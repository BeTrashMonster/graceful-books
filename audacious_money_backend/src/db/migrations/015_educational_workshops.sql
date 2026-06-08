-- Migration: 015_educational_workshops
-- Description: Add tables for educational workshop cohort management system
-- Author: Claude Sonnet 4.5
-- Date: 2026-06-08

-- =============================================================================
-- WORKSHOPS TABLE
-- =============================================================================

-- Core workshop configuration and management
CREATE TABLE IF NOT EXISTS workshops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic Information
  cohort_name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,

  -- Workshop Type & Location
  workshop_type VARCHAR(20) NOT NULL DEFAULT 'in_person'
    CHECK (workshop_type IN ('in_person', 'online')),
  location TEXT,

  -- Timezone Display (IANA timezone identifiers)
  primary_timezone VARCHAR(50) NOT NULL DEFAULT 'America/Los_Angeles',
  secondary_timezone VARCHAR(50),

  -- Access & Trial Settings
  access_grant_datetime TIMESTAMPTZ NOT NULL,
  trial_start_datetime TIMESTAMPTZ NOT NULL,
  trial_duration_days INTEGER NOT NULL DEFAULT 30,

  -- Workshop Event Timing
  workshop_start_datetime TIMESTAMPTZ NOT NULL,
  workshop_end_datetime TIMESTAMPTZ NOT NULL,

  -- Registration Settings
  registration_deadline TIMESTAMPTZ,
  max_enrollment INTEGER,

  -- Customization
  welcome_message TEXT,
  custom_email_templates JSONB,
  custom_email_schedule JSONB,
  post_workshop_resources JSONB,

  -- Post-Trial Behavior
  post_trial_action VARCHAR(20) NOT NULL DEFAULT 'upgrade_prompt'
    CHECK (post_trial_action IN ('upgrade_prompt', 'auto_convert', 'account_freeze')),

  -- Reminder Settings
  send_reminder BOOLEAN NOT NULL DEFAULT true,
  reminder_hours_before INTEGER NOT NULL DEFAULT 24,

  -- Status
  status VARCHAR(30) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'open_registration', 'registration_closed', 'in_progress', 'completed', 'archived')),

  -- Metadata
  created_by UUID NOT NULL REFERENCES admin_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure workshop end is after start
  CONSTRAINT check_workshop_dates CHECK (workshop_end_datetime > workshop_start_datetime)
);

-- Indexes for performance
CREATE INDEX idx_workshops_slug ON workshops(slug);
CREATE INDEX idx_workshops_status ON workshops(status);
CREATE INDEX idx_workshops_access_grant ON workshops(access_grant_datetime);
CREATE INDEX idx_workshops_trial_start ON workshops(trial_start_datetime);
CREATE INDEX idx_workshops_workshop_start ON workshops(workshop_start_datetime);
CREATE INDEX idx_workshops_created_by ON workshops(created_by);

-- Auto-update trigger
CREATE TRIGGER update_workshops_updated_at
  BEFORE UPDATE ON workshops
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE workshops IS 'Educational workshop cohorts with configurable settings, timings, and email templates';
COMMENT ON COLUMN workshops.cohort_name IS 'Display name like "Spring 2026 Small Business Bootcamp"';
COMMENT ON COLUMN workshops.slug IS 'URL identifier like "spring-2026" for /workshop/spring-2026';
COMMENT ON COLUMN workshops.workshop_type IS 'Whether workshop is in-person or online';
COMMENT ON COLUMN workshops.location IS 'Physical address or Zoom/video conference link';
COMMENT ON COLUMN workshops.primary_timezone IS 'Primary timezone for display (IANA format)';
COMMENT ON COLUMN workshops.secondary_timezone IS 'Optional secondary timezone for display';
COMMENT ON COLUMN workshops.access_grant_datetime IS 'When users unlock full platform access';
COMMENT ON COLUMN workshops.trial_start_datetime IS 'When trial countdown begins';
COMMENT ON COLUMN workshops.trial_duration_days IS 'Length of free trial period';
COMMENT ON COLUMN workshops.workshop_start_datetime IS 'When workshop event actually begins';
COMMENT ON COLUMN workshops.workshop_end_datetime IS 'When workshop event ends';
COMMENT ON COLUMN workshops.registration_deadline IS 'Optional cutoff for new signups';
COMMENT ON COLUMN workshops.max_enrollment IS 'Optional capacity limit';
COMMENT ON COLUMN workshops.welcome_message IS 'Custom message shown on countdown page (Markdown supported)';
COMMENT ON COLUMN workshops.custom_email_templates IS 'Full email template overrides with rich text formatting';
COMMENT ON COLUMN workshops.custom_email_schedule IS 'Override default email timing';
COMMENT ON COLUMN workshops.post_workshop_resources IS 'Links to recordings, slides, materials (JSON array)';
COMMENT ON COLUMN workshops.post_trial_action IS 'What happens when trial ends';
COMMENT ON COLUMN workshops.send_reminder IS 'Whether to send pre-workshop reminder email';
COMMENT ON COLUMN workshops.reminder_hours_before IS 'How many hours before workshop to send reminder';
COMMENT ON COLUMN workshops.status IS 'Current workshop status';

-- =============================================================================
-- WORKSHOP ENROLLMENTS TABLE
-- =============================================================================

-- Links users to workshops and tracks their journey
CREATE TABLE IF NOT EXISTS workshop_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workshop_id UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,

  -- Enrollment tracking
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  first_login_at TIMESTAMPTZ,
  trial_started_at TIMESTAMPTZ,
  trial_expires_at TIMESTAMPTZ,
  converted_to_paid_at TIMESTAMPTZ,
  worksheet_completed_at TIMESTAMPTZ,

  -- Engagement tracking
  emails_sent JSONB DEFAULT '[]'::jsonb,
  last_active_at TIMESTAMPTZ,

  -- Status
  status VARCHAR(30) NOT NULL DEFAULT 'enrolled'
    CHECK (status IN ('enrolled', 'active', 'trial_expired', 'converted', 'withdrawn')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- User can only enroll once per workshop
  UNIQUE(user_id, workshop_id)
);

-- Indexes for performance and queries
CREATE INDEX idx_workshop_enrollments_user_id ON workshop_enrollments(user_id);
CREATE INDEX idx_workshop_enrollments_workshop_id ON workshop_enrollments(workshop_id);
CREATE INDEX idx_workshop_enrollments_status ON workshop_enrollments(status);
CREATE INDEX idx_workshop_enrollments_trial_expires ON workshop_enrollments(trial_expires_at) WHERE trial_expires_at IS NOT NULL;
CREATE INDEX idx_workshop_enrollments_enrolled_at ON workshop_enrollments(enrolled_at);

-- Auto-update trigger
CREATE TRIGGER update_workshop_enrollments_updated_at
  BEFORE UPDATE ON workshop_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE workshop_enrollments IS 'Links users to workshops and tracks enrollment journey';
COMMENT ON COLUMN workshop_enrollments.user_id IS 'User enrolled in the workshop';
COMMENT ON COLUMN workshop_enrollments.workshop_id IS 'Workshop they enrolled in';
COMMENT ON COLUMN workshop_enrollments.enrolled_at IS 'When user signed up for workshop';
COMMENT ON COLUMN workshop_enrollments.first_login_at IS 'When user first logged in after access granted';
COMMENT ON COLUMN workshop_enrollments.trial_started_at IS 'When their specific trial began';
COMMENT ON COLUMN workshop_enrollments.trial_expires_at IS 'When their trial ends';
COMMENT ON COLUMN workshop_enrollments.converted_to_paid_at IS 'When they upgraded to paid subscription';
COMMENT ON COLUMN workshop_enrollments.worksheet_completed_at IS 'When they completed initial worksheet';
COMMENT ON COLUMN workshop_enrollments.emails_sent IS 'Array of email log objects {emailType, sentAt, successful}';
COMMENT ON COLUMN workshop_enrollments.last_active_at IS 'Last platform activity timestamp';
COMMENT ON COLUMN workshop_enrollments.status IS 'Current enrollment status';

-- =============================================================================
-- ADD WORKSHOP REFERENCE TO USERS TABLE
-- =============================================================================

-- Add column to link users to their current workshop enrollment
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_workshop_enrollment_id UUID REFERENCES workshop_enrollments(id);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_users_workshop_enrollment ON users(current_workshop_enrollment_id);

COMMENT ON COLUMN users.current_workshop_enrollment_id IS 'Reference to active workshop enrollment (null for regular users)';

-- =============================================================================
-- VIEWS FOR WORKSHOP ANALYTICS
-- =============================================================================

-- View for workshop enrollment analytics
CREATE OR REPLACE VIEW workshop_analytics AS
SELECT
  w.id,
  w.cohort_name,
  w.slug,
  w.workshop_type,
  w.status,
  w.workshop_start_datetime,
  w.workshop_end_datetime,
  w.max_enrollment,

  -- Enrollment stats
  COALESCE(enrollments.total_enrolled, 0) as total_enrolled,
  COALESCE(enrollments.active_count, 0) as active_count,
  COALESCE(enrollments.converted_count, 0) as converted_count,
  COALESCE(enrollments.withdrawn_count, 0) as withdrawn_count,
  COALESCE(enrollments.trial_expired_count, 0) as trial_expired_count,

  -- Engagement stats
  COALESCE(enrollments.worksheet_completed_count, 0) as worksheet_completed_count,
  COALESCE(enrollments.first_login_count, 0) as first_login_count,

  -- Capacity info
  CASE
    WHEN w.max_enrollment IS NULL THEN NULL
    ELSE w.max_enrollment - COALESCE(enrollments.total_enrolled, 0)
  END as spots_remaining,

  CASE
    WHEN w.max_enrollment IS NULL THEN false
    ELSE COALESCE(enrollments.total_enrolled, 0) >= w.max_enrollment
  END as is_full,

  -- Timing info
  CASE
    WHEN NOW() < w.access_grant_datetime THEN 'before_access'
    WHEN NOW() >= w.access_grant_datetime AND NOW() < w.workshop_start_datetime THEN 'access_granted'
    WHEN NOW() >= w.workshop_start_datetime AND NOW() < w.workshop_end_datetime THEN 'in_progress'
    ELSE 'completed'
  END as current_phase,

  w.created_at,
  w.updated_at
FROM workshops w
LEFT JOIN (
  SELECT
    workshop_id,
    COUNT(*) as total_enrolled,
    COUNT(*) FILTER (WHERE status = 'active') as active_count,
    COUNT(*) FILTER (WHERE status = 'converted') as converted_count,
    COUNT(*) FILTER (WHERE status = 'withdrawn') as withdrawn_count,
    COUNT(*) FILTER (WHERE status = 'trial_expired') as trial_expired_count,
    COUNT(*) FILTER (WHERE worksheet_completed_at IS NOT NULL) as worksheet_completed_count,
    COUNT(*) FILTER (WHERE first_login_at IS NOT NULL) as first_login_count
  FROM workshop_enrollments
  GROUP BY workshop_id
) enrollments ON w.id = enrollments.workshop_id;

COMMENT ON VIEW workshop_analytics IS 'Comprehensive analytics for workshop enrollment and engagement tracking';

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to automatically update enrollment status based on trial expiration
CREATE OR REPLACE FUNCTION update_expired_workshop_trials()
RETURNS void AS $$
BEGIN
  -- Mark trials as expired when trial_expires_at has passed
  UPDATE workshop_enrollments
  SET status = 'trial_expired'
  WHERE status IN ('enrolled', 'active')
    AND trial_expires_at IS NOT NULL
    AND trial_expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_expired_workshop_trials IS 'Updates enrollment status for expired trials (run via cron)';
