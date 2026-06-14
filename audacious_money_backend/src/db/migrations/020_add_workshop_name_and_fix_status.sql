-- Migration: 020_add_workshop_name_and_fix_status
-- Description: Add workshop_name field and fix status constraint to match frontend expectations
-- Author: Claude Sonnet 4.5
-- Date: 2026-06-14
-- Context: Separate workshop display name from cohort name (admin identifier)

-- =============================================================================
-- ADD WORKSHOP_NAME COLUMN
-- =============================================================================

-- Add workshop_name column (distinct from cohort_name which is used for admin/URL identification)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workshops' AND column_name = 'workshop_name'
  ) THEN
    -- Add the column
    ALTER TABLE workshops ADD COLUMN workshop_name VARCHAR(255);

    -- Backfill with cohort_name for existing records
    UPDATE workshops SET workshop_name = cohort_name WHERE workshop_name IS NULL;

    -- Make it NOT NULL after backfill
    ALTER TABLE workshops ALTER COLUMN workshop_name SET NOT NULL;

    COMMENT ON COLUMN workshops.workshop_name IS 'Display name for the workshop (shown to participants)';
  END IF;
END $$;

-- =============================================================================
-- FIX STATUS CONSTRAINT
-- =============================================================================

-- Drop the old constraint
ALTER TABLE workshops DROP CONSTRAINT IF EXISTS workshops_status_check;

-- Add new constraint with values matching frontend expectations
ALTER TABLE workshops ADD CONSTRAINT workshops_status_check
  CHECK (status IN ('draft', 'open_registration', 'registration_closed', 'in_progress', 'completed', 'archived'));

-- Update existing records to use new status values
UPDATE workshops SET status = 'open_registration' WHERE status = 'open';
UPDATE workshops SET status = 'registration_closed' WHERE status = 'closed';

COMMENT ON COLUMN workshops.status IS 'Workshop status: draft, open_registration, registration_closed, in_progress, completed, archived';
