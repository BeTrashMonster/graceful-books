-- Migration: 039_user_soft_delete_schema.sql
-- Description: Schema changes to support soft delete with anonymization
-- Date: 2026-11-17
-- Related: USER_DATA_LIFECYCLE_REFACTOR.md roadmap
--
-- This migration prepares the schema for soft delete WITHOUT changing CASCADE behavior.
-- CASCADE constraints only trigger on DELETE statements. Our soft delete uses UPDATE,
-- so CASCADE never triggers and all FK relationships remain intact.

-- =============================================================================
-- PHASE 2.2: ADD 'deleted' TO ACCOUNT STATUS CHECK CONSTRAINT
-- =============================================================================

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_account_status_check;
ALTER TABLE users ADD CONSTRAINT users_account_status_check
  CHECK (account_status IN ('active', 'suspended', 'cancelled', 'deleted'));

COMMENT ON COLUMN users.account_status IS 'Account status: active, suspended, cancelled, or deleted (soft delete)';

-- =============================================================================
-- PHASE 2.3: ADD DELETION TRACKING COLUMNS
-- =============================================================================

-- Timestamp when user was deleted
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Reason for deletion (optional, may be provided by user or admin)
ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

-- Who requested the deletion: 'user' or 'admin'
ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_requested_by VARCHAR(20)
  CHECK (deletion_requested_by IN ('user', 'admin'));

-- If admin-initiated, which admin
ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL;

-- Anonymous identifier for deleted users (format: GracefulExit-xxxxxxxx)
ALTER TABLE users ADD COLUMN IF NOT EXISTS graceful_exit_id VARCHAR(30);

-- SHA-256 hash of original email for fraud detection (admin-only, one-way)
-- Cannot be reversed to recover email. Used to detect re-signup patterns.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_hash VARCHAR(64);

COMMENT ON COLUMN users.deleted_at IS 'Timestamp when user account was soft-deleted';
COMMENT ON COLUMN users.deletion_reason IS 'Optional reason for account deletion';
COMMENT ON COLUMN users.deletion_requested_by IS 'Who initiated deletion: user or admin';
COMMENT ON COLUMN users.deletion_admin_id IS 'Admin who initiated deletion (if admin-requested)';
COMMENT ON COLUMN users.graceful_exit_id IS 'Anonymous identifier for deleted users (GracefulExit-xxxxxxxx)';
COMMENT ON COLUMN users.email_hash IS 'SHA-256 hash of email for fraud detection (admin-only, cannot recover email)';

-- =============================================================================
-- PHASE 2.4: MODIFY EMAIL UNIQUENESS CONSTRAINT
-- =============================================================================

-- Drop existing unique constraint on email
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;

-- Drop any existing unique index on email (some DBs create index separately)
DROP INDEX IF EXISTS users_email_key;
DROP INDEX IF EXISTS idx_users_email;

-- Create partial unique index that only applies to non-deleted users with non-null email
-- This allows:
--   - Active users: email must be unique
--   - Deleted users: email is NULL, no constraint violation
--   - Re-signup: User can create new account with same email after deletion
CREATE UNIQUE INDEX idx_users_email_active ON users(email)
  WHERE account_status != 'deleted' AND email IS NOT NULL;

COMMENT ON INDEX idx_users_email_active IS 'Email uniqueness enforced only for non-deleted users';

-- =============================================================================
-- PHASE 2.5: ADD TRIGGER TO PREVENT DELETED STATUS REVERSAL
-- =============================================================================

-- Function to prevent status change from 'deleted' back to any other status
CREATE OR REPLACE FUNCTION prevent_deleted_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.account_status = 'deleted' AND NEW.account_status != 'deleted' THEN
    RAISE EXCEPTION 'Cannot change status of deleted user. Deletion is permanent. User ID: %', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to users table
DROP TRIGGER IF EXISTS enforce_deleted_permanent ON users;
CREATE TRIGGER enforce_deleted_permanent
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION prevent_deleted_status_change();

COMMENT ON FUNCTION prevent_deleted_status_change IS 'Prevents reactivation of deleted user accounts';
COMMENT ON TRIGGER enforce_deleted_permanent ON users IS 'Ensures deleted users cannot be reactivated';

-- =============================================================================
-- PHASE 2.6: CREATE INDEXES FOR DELETED USERS
-- =============================================================================

-- Index for finding deleted users by deletion date
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at)
  WHERE deleted_at IS NOT NULL;

-- Index for looking up users by GracefulExit ID
CREATE INDEX IF NOT EXISTS idx_users_graceful_exit ON users(graceful_exit_id)
  WHERE graceful_exit_id IS NOT NULL;

-- Index for filtering by deleted status
CREATE INDEX IF NOT EXISTS idx_users_status_deleted ON users(account_status)
  WHERE account_status = 'deleted';

-- Index for fraud detection lookups by email hash
CREATE INDEX IF NOT EXISTS idx_users_email_hash ON users(email_hash)
  WHERE email_hash IS NOT NULL;

-- =============================================================================
-- PHASE 2.7: MAKE PII COLUMNS NULLABLE (users table)
-- =============================================================================

-- Allow email to be NULL (will be nulled on deletion)
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

-- Allow first_name to be NULL (will be nulled on deletion)
ALTER TABLE users ALTER COLUMN first_name DROP NOT NULL;

-- Allow last_name to be NULL (will be nulled on deletion)
ALTER TABLE users ALTER COLUMN last_name DROP NOT NULL;

-- Note: password_hash stays NOT NULL but we'll set to random unusable hash on deletion

-- =============================================================================
-- PHASE 2.8: MAKE PII COLUMNS NULLABLE (related tables)
-- =============================================================================

-- email_suppressions.email needs to allow NULL
ALTER TABLE email_suppressions ALTER COLUMN email DROP NOT NULL;

-- email_tracking_events.recipient_email needs to allow NULL
ALTER TABLE email_tracking_events ALTER COLUMN recipient_email DROP NOT NULL;

-- =============================================================================
-- PHASE 2.9: ADD GRACEFULEXIT ID UNIQUENESS CONSTRAINT
-- =============================================================================

-- Ensure GracefulExit IDs are unique (prevents collision issues)
ALTER TABLE users ADD CONSTRAINT users_graceful_exit_id_unique
  UNIQUE (graceful_exit_id);

-- =============================================================================
-- VERIFICATION QUERIES (run manually to verify migration)
-- =============================================================================

-- Check account_status constraint includes 'deleted':
-- SELECT constraint_name, check_clause
-- FROM information_schema.check_constraints
-- WHERE constraint_name = 'users_account_status_check';

-- Check new columns exist:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'users'
-- AND column_name IN ('deleted_at', 'deletion_reason', 'graceful_exit_id', 'email_hash');

-- Check email is now nullable:
-- SELECT column_name, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'users' AND column_name = 'email';

-- Check trigger exists:
-- SELECT trigger_name, event_manipulation, action_statement
-- FROM information_schema.triggers
-- WHERE trigger_name = 'enforce_deleted_permanent';
