-- Migration: Home Email Signups Table
-- Created: 2026-04-10
-- Purpose: Track email signups for home page waitlist (EXACT COPY of CPG pattern)

CREATE TABLE IF NOT EXISTS home_email_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  unsubscribed_at TIMESTAMP WITH TIME ZONE,

  -- Indexes for performance
  CONSTRAINT home_email_signups_email_key UNIQUE (email)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_home_email_signups_email ON home_email_signups(email);
CREATE INDEX IF NOT EXISTS idx_home_email_signups_created_at ON home_email_signups(created_at DESC);

-- Comment
COMMENT ON TABLE home_email_signups IS 'Stores email signups for home page waitlist';
