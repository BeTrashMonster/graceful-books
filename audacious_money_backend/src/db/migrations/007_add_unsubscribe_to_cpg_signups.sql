-- Migration: Add unsubscribe tracking to CPG Launch Signups
-- Created: 2026-04-07
-- Purpose: Add unsubscribed_at column to track email unsubscribes

ALTER TABLE cpg_launch_signups
ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMP WITH TIME ZONE;

-- Index for filtering out unsubscribed users
CREATE INDEX IF NOT EXISTS idx_cpg_launch_signups_unsubscribed_at ON cpg_launch_signups(unsubscribed_at) WHERE unsubscribed_at IS NOT NULL;

-- Comment
COMMENT ON COLUMN cpg_launch_signups.unsubscribed_at IS 'Timestamp when user unsubscribed from launch notifications';
