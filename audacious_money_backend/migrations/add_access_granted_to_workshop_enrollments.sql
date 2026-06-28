-- Add access_granted and access_granted_at columns to workshop_enrollments table
-- This allows us to track when users are granted access to the platform after completing the workshop flow

ALTER TABLE workshop_enrollments
  ADD COLUMN IF NOT EXISTS access_granted BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS access_granted_at TIMESTAMP WITH TIME ZONE;

-- Create index for faster queries on access_granted
CREATE INDEX IF NOT EXISTS idx_workshop_enrollments_access_granted
  ON workshop_enrollments(access_granted);

COMMENT ON COLUMN workshop_enrollments.access_granted IS 'Whether the user has been granted platform access (true when current time >= workshop access_grant_datetime)';
COMMENT ON COLUMN workshop_enrollments.access_granted_at IS 'Timestamp when platform access was granted';
