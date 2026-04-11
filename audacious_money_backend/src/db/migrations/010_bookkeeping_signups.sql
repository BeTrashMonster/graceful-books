-- Migration: Bookkeeping Signups Table
-- Created: 2026-04-10
-- Purpose: Track email signups for bookkeeping suite waitlist (EXACT COPY of CPG/Home pattern)

CREATE TABLE IF NOT EXISTS bookkeeping_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  unsubscribed_at TIMESTAMP WITH TIME ZONE,

  -- Indexes for performance
  CONSTRAINT bookkeeping_signups_email_key UNIQUE (email)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_bookkeeping_signups_email ON bookkeeping_signups(email);
CREATE INDEX IF NOT EXISTS idx_bookkeeping_signups_created_at ON bookkeeping_signups(created_at DESC);

-- Comment
COMMENT ON TABLE bookkeeping_signups IS 'Stores email signups for bookkeeping suite waitlist';
