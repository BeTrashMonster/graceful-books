-- Migration: Create user activity log for admin diagnostics
-- Purpose: Track user activities for the Activity Timeline in admin panel

CREATE TABLE user_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Activity categorization
  activity_type VARCHAR(50) NOT NULL,  -- 'login', 'page_view', 'action', 'system', 'email', 'payment'
  activity_name VARCHAR(100) NOT NULL, -- 'Logged in', 'Viewed dashboard', 'Completed worksheet', etc.

  -- Additional context (flexible JSON for varying activity types)
  metadata JSONB DEFAULT '{}',

  -- Source tracking
  ip_address INET,
  user_agent TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX idx_user_activity_user_id ON user_activity_log(user_id);
CREATE INDEX idx_user_activity_created ON user_activity_log(created_at DESC);
CREATE INDEX idx_user_activity_type ON user_activity_log(activity_type);
CREATE INDEX idx_user_activity_user_created ON user_activity_log(user_id, created_at DESC);

-- Partial index for recent activity (last 90 days) - most common query
CREATE INDEX idx_user_activity_recent ON user_activity_log(user_id, created_at DESC)
  WHERE created_at > NOW() - INTERVAL '90 days';

COMMENT ON TABLE user_activity_log IS 'Tracks user activities for admin support diagnostics';
COMMENT ON COLUMN user_activity_log.activity_type IS 'Category: login, page_view, action, system, email, payment';
COMMENT ON COLUMN user_activity_log.activity_name IS 'Human-readable description of the activity';
COMMENT ON COLUMN user_activity_log.metadata IS 'Additional context specific to the activity type';
