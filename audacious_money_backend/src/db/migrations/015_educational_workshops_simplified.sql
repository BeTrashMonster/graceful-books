-- Migration: 015_educational_workshops_simplified
-- Description: Add tables for educational workshop cohort management (integrated with existing Stripe/subscription system)
-- Author: Claude Sonnet 4.5
-- Date: 2026-06-08
-- Integration: Uses existing user_products table for trial/subscription tracking

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

  -- Stripe Integration
  stripe_price_id VARCHAR(255) NOT NULL, -- Which Stripe price to use for this workshop
  trial_duration_days INTEGER NOT NULL DEFAULT 30, -- Dynamic trial length per workshop

  -- Access & Event Timing
  access_grant_datetime TIMESTAMPTZ NOT NULL, -- When users unlock platform (after enrollment)
  workshop_start_datetime TIMESTAMPTZ NOT NULL, -- When workshop event begins
  workshop_end_datetime TIMESTAMPTZ NOT NULL, -- When workshop event ends

  -- Registration Settings
  registration_deadline TIMESTAMPTZ,
  max_enrollment INTEGER,

  -- Customization
  welcome_message TEXT,
  custom_email_templates JSONB, -- Overrides for the 7 default email templates
  post_workshop_resources JSONB, -- Links to recordings, slides, materials

  -- Reminder Settings
  send_reminder BOOLEAN NOT NULL DEFAULT true,
  reminder_hours_before INTEGER NOT NULL DEFAULT 24,

  -- Status
  status VARCHAR(30) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'open', 'closed', 'in_progress', 'completed', 'archived')),

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
CREATE INDEX idx_workshops_workshop_start ON workshops(workshop_start_datetime);

-- Auto-update trigger
CREATE TRIGGER update_workshops_updated_at
  BEFORE UPDATE ON workshops
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE workshops IS 'Educational workshop cohorts - trial/subscription tracking via existing user_products table';
COMMENT ON COLUMN workshops.stripe_price_id IS 'Stripe price ID for this workshop subscription';
COMMENT ON COLUMN workshops.trial_duration_days IS 'Length of free trial period (passed to Stripe)';
COMMENT ON COLUMN workshops.access_grant_datetime IS 'When users unlock full platform access';
COMMENT ON COLUMN workshops.workshop_start_datetime IS 'When workshop event actually begins';

-- =============================================================================
-- WORKSHOP ENROLLMENTS TABLE
-- =============================================================================

-- Links users to workshops and tracks their pre-workshop journey
-- NOTE: Trial/subscription tracking happens in user_products table (Stripe integration)
CREATE TABLE IF NOT EXISTS workshop_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workshop_id UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,

  -- Enrollment tracking
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  worksheet_completed_at TIMESTAMPTZ, -- When user completes pre-workshop worksheet

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- User can only enroll once per workshop
  UNIQUE(user_id, workshop_id)
);

-- Indexes
CREATE INDEX idx_workshop_enrollments_user_id ON workshop_enrollments(user_id);
CREATE INDEX idx_workshop_enrollments_workshop_id ON workshop_enrollments(workshop_id);

-- Auto-update trigger
CREATE TRIGGER update_workshop_enrollments_updated_at
  BEFORE UPDATE ON workshop_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE workshop_enrollments IS 'Links users to workshops - trial/payment via user_products table';
COMMENT ON COLUMN workshop_enrollments.worksheet_completed_at IS 'When they completed pre-workshop prep';

-- =============================================================================
-- ADD WORKSHOP REFERENCE TO USERS TABLE
-- =============================================================================

-- Add column to link users to their current workshop enrollment
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_workshop_enrollment_id UUID REFERENCES workshop_enrollments(id);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_users_workshop_enrollment ON users(current_workshop_enrollment_id);

COMMENT ON COLUMN users.current_workshop_enrollment_id IS 'Active workshop enrollment (null = regular user or graduated workshop participant)';

-- =============================================================================
-- VIEWS FOR WORKSHOP ANALYTICS
-- =============================================================================

-- View for workshop enrollment analytics (integrated with user_products for conversion data)
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
  w.trial_duration_days,

  -- Enrollment stats
  COALESCE(enrollments.total_enrolled, 0) as total_enrolled,
  COALESCE(enrollments.worksheet_completed_count, 0) as worksheet_completed_count,

  -- Subscription stats (from user_products table)
  COALESCE(conversions.trialing_count, 0) as trialing_count,
  COALESCE(conversions.active_count, 0) as active_count,
  COALESCE(conversions.converted_count, 0) as converted_count,

  -- Conversion rate
  CASE
    WHEN COALESCE(enrollments.total_enrolled, 0) > 0
    THEN ROUND((COALESCE(conversions.converted_count, 0)::NUMERIC / enrollments.total_enrolled * 100), 2)
    ELSE 0
  END as conversion_rate_percent,

  -- Capacity info
  CASE
    WHEN w.max_enrollment IS NULL THEN NULL
    ELSE w.max_enrollment - COALESCE(enrollments.total_enrolled, 0)
  END as spots_remaining,

  CASE
    WHEN w.max_enrollment IS NULL THEN false
    ELSE COALESCE(enrollments.total_enrolled, 0) >= w.max_enrollment
  END as is_full,

  w.created_at,
  w.updated_at
FROM workshops w
LEFT JOIN (
  SELECT
    workshop_id,
    COUNT(*) as total_enrolled,
    COUNT(*) FILTER (WHERE worksheet_completed_at IS NOT NULL) as worksheet_completed_count
  FROM workshop_enrollments
  GROUP BY workshop_id
) enrollments ON w.id = enrollments.workshop_id
LEFT JOIN (
  SELECT
    we.workshop_id,
    COUNT(*) FILTER (WHERE up.status = 'trialing') as trialing_count,
    COUNT(*) FILTER (WHERE up.status = 'active') as active_count,
    COUNT(*) FILTER (WHERE up.status = 'active' AND up.stripe_subscription_id IS NOT NULL) as converted_count
  FROM workshop_enrollments we
  JOIN user_products up ON up.user_id = we.user_id
  GROUP BY we.workshop_id
) conversions ON w.id = conversions.workshop_id;

COMMENT ON VIEW workshop_analytics IS 'Workshop analytics using user_products for subscription tracking';
