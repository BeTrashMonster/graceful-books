-- Migration: CPG Launch Signups Table
-- Created: 2026-04-07
-- Purpose: Track email signups for CPG Product Costing Tool launch (May 4, 2026)

CREATE TABLE IF NOT EXISTS cpg_launch_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  business_name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  notified_at TIMESTAMP WITH TIME ZONE,
  converted_to_user_id UUID REFERENCES users(id),

  -- Indexes for performance
  CONSTRAINT cpg_launch_signups_email_key UNIQUE (email)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_cpg_launch_signups_email ON cpg_launch_signups(email);
CREATE INDEX IF NOT EXISTS idx_cpg_launch_signups_created_at ON cpg_launch_signups(created_at DESC);

-- Comment
COMMENT ON TABLE cpg_launch_signups IS 'Stores email signups for CPG Product Costing Tool pre-launch (May 4, 2026)';
COMMENT ON COLUMN cpg_launch_signups.notified_at IS 'Timestamp when launch notification was sent';
COMMENT ON COLUMN cpg_launch_signups.converted_to_user_id IS 'Set when signup converts to full user account';
