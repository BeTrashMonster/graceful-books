-- ROLLBACK: 039_user_soft_delete_schema.sql
-- Description: Reverses the soft delete schema changes
-- WARNING: This rollback will FAIL if any users have been deleted (account_status = 'deleted')
--          You must handle deleted users manually before running this rollback.
--
-- Pre-rollback checklist:
-- 1. Ensure no users have account_status = 'deleted'
-- 2. Ensure no users have NULL email, first_name, or last_name (unless they already did)
-- 3. Backup the database before proceeding

-- =============================================================================
-- STEP 0: SAFETY CHECK - Fail if deleted users exist
-- =============================================================================

DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO deleted_count FROM users WHERE account_status = 'deleted';
  IF deleted_count > 0 THEN
    RAISE EXCEPTION 'Cannot rollback: % users have account_status = deleted. Handle these manually first.', deleted_count;
  END IF;
END $$;

-- =============================================================================
-- ROLLBACK 2.9: Remove GracefulExit ID uniqueness constraint
-- =============================================================================

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_graceful_exit_id_unique;

-- =============================================================================
-- ROLLBACK 2.8: Restore NOT NULL on related tables (if safe)
-- =============================================================================

-- Only safe if no NULL values exist
-- Check first: SELECT COUNT(*) FROM email_suppressions WHERE email IS NULL;
-- ALTER TABLE email_suppressions ALTER COLUMN email SET NOT NULL;

-- Check first: SELECT COUNT(*) FROM email_tracking_events WHERE recipient_email IS NULL;
-- ALTER TABLE email_tracking_events ALTER COLUMN recipient_email SET NOT NULL;

-- =============================================================================
-- ROLLBACK 2.7: Restore NOT NULL on users PII columns (if safe)
-- =============================================================================

-- Only safe if no NULL values exist in these columns
-- Check first: SELECT COUNT(*) FROM users WHERE email IS NULL;
-- ALTER TABLE users ALTER COLUMN email SET NOT NULL;

-- Check first: SELECT COUNT(*) FROM users WHERE first_name IS NULL;
-- ALTER TABLE users ALTER COLUMN first_name SET NOT NULL;

-- Check first: SELECT COUNT(*) FROM users WHERE last_name IS NULL;
-- ALTER TABLE users ALTER COLUMN last_name SET NOT NULL;

-- =============================================================================
-- ROLLBACK 2.6: Remove deleted user indexes
-- =============================================================================

DROP INDEX IF EXISTS idx_users_deleted_at;
DROP INDEX IF EXISTS idx_users_graceful_exit;
DROP INDEX IF EXISTS idx_users_status_deleted;
DROP INDEX IF EXISTS idx_users_email_hash;

-- =============================================================================
-- ROLLBACK 2.5: Remove trigger preventing status reversal
-- =============================================================================

DROP TRIGGER IF EXISTS enforce_deleted_permanent ON users;
DROP FUNCTION IF EXISTS prevent_deleted_status_change();

-- =============================================================================
-- ROLLBACK 2.4: Restore original email uniqueness constraint
-- =============================================================================

DROP INDEX IF EXISTS idx_users_email_active;

-- Restore original unique constraint (only works if no duplicate/NULL emails exist)
-- Check first: SELECT email, COUNT(*) FROM users GROUP BY email HAVING COUNT(*) > 1;
-- ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);

-- Restore original index
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- =============================================================================
-- ROLLBACK 2.3: Remove deletion tracking columns
-- =============================================================================

ALTER TABLE users DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE users DROP COLUMN IF EXISTS deletion_reason;
ALTER TABLE users DROP COLUMN IF EXISTS deletion_requested_by;
ALTER TABLE users DROP COLUMN IF EXISTS deletion_admin_id;
ALTER TABLE users DROP COLUMN IF EXISTS graceful_exit_id;
ALTER TABLE users DROP COLUMN IF EXISTS email_hash;

-- =============================================================================
-- ROLLBACK 2.2: Restore original account_status CHECK constraint
-- =============================================================================

-- Only works if no users have account_status = 'deleted'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_account_status_check;
ALTER TABLE users ADD CONSTRAINT users_account_status_check
  CHECK (account_status IN ('active', 'suspended', 'cancelled'));

-- =============================================================================
-- POST-ROLLBACK VERIFICATION
-- =============================================================================

-- Verify constraint is back to original:
-- SELECT check_clause FROM information_schema.check_constraints
-- WHERE constraint_name = 'users_account_status_check';

-- Verify columns are removed:
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'users'
-- AND column_name IN ('deleted_at', 'graceful_exit_id', 'email_hash');
-- (Should return 0 rows)
