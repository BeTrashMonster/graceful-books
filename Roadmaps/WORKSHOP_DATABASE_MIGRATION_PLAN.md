# Workshop Database Migration Execution Plan

**Version:** 1.0
**Created:** 2026-06-08
**Migration File:** `015_educational_workshops.sql`
**Status:** Pre-Execution Planning

---

## Executive Summary

This document provides comprehensive guidance for executing the Educational Workshop System database migration (`015_educational_workshops.sql`). The migration adds 2 new tables, 1 view, 1 function, and modifies the existing `users` table to support the workshop enrollment system.

**Migration Complexity:** Medium
**Estimated Execution Time:** 2-5 seconds
**Estimated Downtime:** None (migration can run on live system)
**Rollback Complexity:** Low (clean rollback script provided)

---

## Pre-Migration Checklist

### 1. Database Backup

**CRITICAL: Always backup before migration!**

```bash
# Create timestamped backup of entire database
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -h localhost -U postgres -d audacious_money > "backups/pre_workshop_migration_${BACKUP_DATE}.sql"

# Verify backup was created
ls -lh backups/pre_workshop_migration_*.sql

# Optional: Test restore on a separate test database
createdb audacious_money_test
psql -h localhost -U postgres -d audacious_money_test < "backups/pre_workshop_migration_${BACKUP_DATE}.sql"
```

**Backup Verification Checklist:**
- [ ] Backup file created successfully
- [ ] Backup file size is reasonable (check against previous backups)
- [ ] Backup file is not empty (size > 1KB)
- [ ] Backup stored in secure location with proper permissions
- [ ] Backup file documented in backup log

### 2. Staging Environment Testing

**REQUIRED: Test migration in staging before production!**

```bash
# Switch to staging environment
export DATABASE_URL="postgresql://user:pass@staging-db-host:5432/audacious_money_staging"

# Run migration on staging
cd audacious_money_backend
npm run migrate:up

# Verify migration applied
npm run migrate:status

# Run verification queries (see section below)
psql $DATABASE_URL -f verification_queries.sql

# Test rollback procedure
npm run migrate:down
npm run migrate:up
```

**Staging Testing Checklist:**
- [ ] Migration executes without errors in staging
- [ ] All tables created with correct schema
- [ ] All indexes created successfully
- [ ] Foreign key constraints working properly
- [ ] View query executes without errors
- [ ] Trigger functions execute correctly
- [ ] Rollback procedure tested successfully
- [ ] Performance acceptable (migration < 10 seconds)
- [ ] No blocking locks observed

### 3. Review Migration File

**Review `015_educational_workshops.sql` for:**

```bash
# Display migration file
cat audacious_money_backend/src/db/migrations/015_educational_workshops.sql

# Count DDL statements
grep -E "^(CREATE|ALTER|DROP)" audacious_money_backend/src/db/migrations/015_educational_workshops.sql | wc -l
```

**Review Checklist:**
- [ ] Migration file exists and is readable
- [ ] SQL syntax is valid (no obvious errors)
- [ ] Table names follow naming conventions
- [ ] Column types are appropriate
- [ ] Indexes are necessary and well-placed
- [ ] Foreign key relationships are correct
- [ ] Check constraints are logical
- [ ] Comments are present for documentation

### 4. Dependency Verification

**Verify required database objects exist:**

```sql
-- Check that admin_users table exists (required for foreign key)
SELECT COUNT(*) FROM information_schema.tables
WHERE table_name = 'admin_users';
-- Expected: 1

-- Check that users table exists (required for foreign key)
SELECT COUNT(*) FROM information_schema.tables
WHERE table_name = 'users';
-- Expected: 1

-- Verify update_updated_at_column function exists (required for triggers)
SELECT COUNT(*) FROM pg_proc
WHERE proname = 'update_updated_at_column';
-- Expected: 1
```

**Dependency Checklist:**
- [ ] `admin_users` table exists
- [ ] `users` table exists
- [ ] `update_updated_at_column()` function exists
- [ ] PostgreSQL version is 12+ (for gen_random_uuid())
- [ ] Database user has CREATE TABLE privileges
- [ ] Database user has CREATE INDEX privileges
- [ ] Database user has ALTER TABLE privileges

### 5. Timing and Communication

**Choose migration window:**
- **Recommended:** During low-traffic period (2-4 AM local time)
- **Alternative:** Any time (migration is non-blocking)
- **Avoid:** During peak business hours or known high-traffic events

**Communication Plan:**
- [ ] Notify team in Slack/Discord 24 hours before migration
- [ ] Post maintenance notice if planning downtime (none expected)
- [ ] Have rollback communication template ready
- [ ] Designate point person for migration execution
- [ ] Ensure database administrator is available during migration window

### 6. Migration Script Preparation

**Prepare migration execution environment:**

```bash
# Navigate to backend directory
cd audacious_money_backend

# Verify migration script location
ls -la src/db/migrations/015_educational_workshops.sql

# Check migration status (should show 014 as latest applied)
npm run migrate:status

# Set environment variables
export NODE_ENV=production
export DATABASE_URL="postgresql://user:pass@prod-db-host:5432/audacious_money"

# Test database connection
npm run db:test-connection
```

**Preparation Checklist:**
- [ ] Migration script located at correct path
- [ ] Environment variables set correctly
- [ ] Database connection verified
- [ ] Migration tool (migrate.ts) tested
- [ ] Terminal/console ready for execution
- [ ] Screen recording tool ready (optional but recommended)

---

## Migration Execution Steps

### Step 1: Final Pre-Migration Verification

```bash
# Verify no pending transactions
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';"

# Check current migration status
npm run migrate:status

# Expected output:
# Applied migrations:
# ✓ 001_initial_schema.sql
# ✓ 002_password_reset_tokens.sql
# ...
# ✓ 014_fix_subscription_status_values.sql
#
# Pending migrations:
# ○ 015_educational_workshops.sql
```

### Step 2: Execute Migration

```bash
# Navigate to backend directory
cd audacious_money_backend

# Execute migration with verbose logging
npm run migrate:up 2>&1 | tee migration_015_execution.log

# Expected output:
# Running migration: 015_educational_workshops.sql
# Creating table: workshops
# Creating table: workshop_enrollments
# Adding column: users.current_workshop_enrollment_id
# Creating view: workshop_analytics
# Creating function: update_expired_workshop_trials
# Migration completed successfully
```

**Expected Duration:** 2-5 seconds
**Expected Output:** Success message with all DDL statements executed

### Step 3: Verify Migration Success

```bash
# Check migration status
npm run migrate:status

# Expected: 015_educational_workshops.sql should now show as applied (✓)
```

### Step 4: Run Verification Queries

**Create verification script: `verify_workshop_migration.sql`**

```sql
-- ============================================================================
-- WORKSHOP MIGRATION VERIFICATION QUERIES
-- ============================================================================

-- Verify workshops table created
SELECT COUNT(*) as workshops_table_exists
FROM information_schema.tables
WHERE table_name = 'workshops';
-- Expected: 1

-- Verify workshop_enrollments table created
SELECT COUNT(*) as enrollments_table_exists
FROM information_schema.tables
WHERE table_name = 'workshop_enrollments';
-- Expected: 1

-- Verify users.current_workshop_enrollment_id column added
SELECT COUNT(*) as column_exists
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'current_workshop_enrollment_id';
-- Expected: 1

-- Verify all workshops indexes created
SELECT COUNT(*) as workshops_indexes
FROM pg_indexes
WHERE tablename = 'workshops';
-- Expected: 6 (idx_workshops_slug, idx_workshops_status, idx_workshops_access_grant,
--            idx_workshops_trial_start, idx_workshops_workshop_start, idx_workshops_created_by)

-- Verify all workshop_enrollments indexes created
SELECT COUNT(*) as enrollments_indexes
FROM pg_indexes
WHERE tablename = 'workshop_enrollments';
-- Expected: 5 (idx_workshop_enrollments_user_id, idx_workshop_enrollments_workshop_id,
--            idx_workshop_enrollments_status, idx_workshop_enrollments_trial_expires,
--            idx_workshop_enrollments_enrolled_at)

-- Verify workshop_analytics view created
SELECT COUNT(*) as view_exists
FROM information_schema.views
WHERE table_name = 'workshop_analytics';
-- Expected: 1

-- Verify update_expired_workshop_trials function created
SELECT COUNT(*) as function_exists
FROM pg_proc
WHERE proname = 'update_expired_workshop_trials';
-- Expected: 1

-- Verify foreign key constraints
SELECT COUNT(*) as fk_constraints
FROM information_schema.table_constraints
WHERE constraint_type = 'FOREIGN KEY'
  AND (table_name = 'workshops' OR table_name = 'workshop_enrollments');
-- Expected: 4 (workshops.created_by -> admin_users.id,
--            workshop_enrollments.user_id -> users.id,
--            workshop_enrollments.workshop_id -> workshops.id,
--            users.current_workshop_enrollment_id -> workshop_enrollments.id)

-- Verify check constraints
SELECT constraint_name, table_name
FROM information_schema.table_constraints
WHERE constraint_type = 'CHECK'
  AND table_name IN ('workshops', 'workshop_enrollments')
ORDER BY table_name, constraint_name;
-- Expected: Multiple check constraints for status, workshop_type, post_trial_action, check_workshop_dates

-- Verify triggers
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE event_object_table IN ('workshops', 'workshop_enrollments')
ORDER BY event_object_table, trigger_name;
-- Expected: update_workshops_updated_at, update_workshop_enrollments_updated_at

-- Test workshop_analytics view query
SELECT * FROM workshop_analytics LIMIT 1;
-- Expected: Query executes without error (may return 0 rows if no workshops exist)

-- Verify column data types
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'workshops'
ORDER BY ordinal_position;
-- Expected: All columns with correct types (UUID, VARCHAR, TEXT, TIMESTAMPTZ, INTEGER, BOOLEAN, JSONB)

-- Verify unique constraints
SELECT constraint_name, table_name
FROM information_schema.table_constraints
WHERE constraint_type = 'UNIQUE'
  AND table_name IN ('workshops', 'workshop_enrollments');
-- Expected: workshops.slug, workshop_enrollments(user_id, workshop_id)
```

**Execute verification:**

```bash
# Run verification queries
psql $DATABASE_URL -f verify_workshop_migration.sql > verification_results.txt

# Review results
cat verification_results.txt

# All counts should match expected values
```

### Step 5: Test Data Insertion

**Insert test workshop to verify schema integrity:**

```sql
-- Test workshop insertion
INSERT INTO workshops (
  cohort_name,
  slug,
  description,
  workshop_type,
  location,
  primary_timezone,
  access_grant_datetime,
  trial_start_datetime,
  trial_duration_days,
  workshop_start_datetime,
  workshop_end_datetime,
  status,
  created_by
) VALUES (
  'Test Migration Workshop',
  'test-migration-2026',
  'Test workshop to verify migration success',
  'online',
  'https://zoom.us/test',
  'America/Los_Angeles',
  NOW() + INTERVAL '7 days',
  NOW() + INTERVAL '7 days',
  30,
  NOW() + INTERVAL '7 days',
  NOW() + INTERVAL '8 days',
  'draft',
  (SELECT id FROM admin_users LIMIT 1)
) RETURNING id;

-- Verify insertion
SELECT cohort_name, slug, status FROM workshops WHERE slug = 'test-migration-2026';

-- Clean up test data
DELETE FROM workshops WHERE slug = 'test-migration-2026';
```

**Test enrollment insertion:**

```sql
-- Assuming test workshop and user exist
INSERT INTO workshop_enrollments (
  user_id,
  workshop_id,
  status
) VALUES (
  (SELECT id FROM users LIMIT 1),
  (SELECT id FROM workshops WHERE slug = 'test-migration-2026' LIMIT 1),
  'enrolled'
) RETURNING id;

-- Verify enrollment
SELECT * FROM workshop_enrollments WHERE workshop_id = (
  SELECT id FROM workshops WHERE slug = 'test-migration-2026'
);

-- Clean up
DELETE FROM workshop_enrollments WHERE workshop_id = (
  SELECT id FROM workshops WHERE slug = 'test-migration-2026'
);
```

### Step 6: Performance Check

**Verify index performance:**

```sql
-- Test index usage on workshops.slug
EXPLAIN ANALYZE
SELECT * FROM workshops WHERE slug = 'test-migration-2026';
-- Expected: Index Scan using idx_workshops_slug

-- Test index usage on workshop_enrollments.user_id
EXPLAIN ANALYZE
SELECT * FROM workshop_enrollments WHERE user_id = (SELECT id FROM users LIMIT 1);
-- Expected: Index Scan using idx_workshop_enrollments_user_id

-- Test view performance
EXPLAIN ANALYZE
SELECT * FROM workshop_analytics;
-- Expected: Executes in < 100ms for small datasets

-- Test function execution
SELECT update_expired_workshop_trials();
-- Expected: Function executes without error
```

### Step 7: Final Verification

```bash
# Confirm migration status
npm run migrate:status

# Check application logs
tail -f logs/application.log

# Verify no errors in database logs
psql $DATABASE_URL -c "SELECT * FROM pg_stat_database WHERE datname = 'audacious_money';"
```

---

## Post-Migration Validation

### Database Schema Validation

**Complete validation checklist:**

- [ ] `workshops` table exists with all 24 columns
- [ ] `workshop_enrollments` table exists with all 14 columns
- [ ] `users.current_workshop_enrollment_id` column added
- [ ] 6 indexes created on `workshops` table
- [ ] 5 indexes created on `workshop_enrollments` table
- [ ] 1 index created on `users.current_workshop_enrollment_id`
- [ ] `workshop_analytics` view created and queryable
- [ ] `update_expired_workshop_trials()` function created
- [ ] 2 triggers created (update_workshops_updated_at, update_workshop_enrollments_updated_at)
- [ ] 4 foreign key constraints working correctly
- [ ] 6+ check constraints enforcing data integrity
- [ ] 2 unique constraints (workshops.slug, workshop_enrollments unique pair)
- [ ] All column comments present
- [ ] Table comments present

### Foreign Key Validation

**Test foreign key constraints:**

```sql
-- Test workshops.created_by -> admin_users.id
INSERT INTO workshops (
  cohort_name, slug, workshop_type, access_grant_datetime, trial_start_datetime,
  workshop_start_datetime, workshop_end_datetime, created_by
) VALUES (
  'FK Test', 'fk-test', 'online', NOW(), NOW(), NOW(), NOW() + INTERVAL '1 day',
  '00000000-0000-0000-0000-000000000000'  -- Invalid UUID
);
-- Expected: ERROR: foreign key constraint violation

-- Test workshop_enrollments.user_id -> users.id
INSERT INTO workshop_enrollments (user_id, workshop_id)
VALUES ('00000000-0000-0000-0000-000000000000', (SELECT id FROM workshops LIMIT 1));
-- Expected: ERROR: foreign key constraint violation

-- Test workshop_enrollments.workshop_id -> workshops.id
INSERT INTO workshop_enrollments (user_id, workshop_id)
VALUES ((SELECT id FROM users LIMIT 1), '00000000-0000-0000-0000-000000000000');
-- Expected: ERROR: foreign key constraint violation

-- Test CASCADE DELETE on workshop_enrollments when user deleted
BEGIN;
  INSERT INTO users (email, passphrase_hash) VALUES ('test@delete.com', 'hash');
  INSERT INTO workshops (cohort_name, slug, ...) VALUES (...);
  INSERT INTO workshop_enrollments (user_id, workshop_id) VALUES (...);
  DELETE FROM users WHERE email = 'test@delete.com';
  SELECT COUNT(*) FROM workshop_enrollments WHERE user_id = ...;
  -- Expected: 0 (enrollment deleted via CASCADE)
ROLLBACK;
```

### Trigger Validation

**Test updated_at triggers:**

```sql
-- Test workshops.updated_at trigger
BEGIN;
  INSERT INTO workshops (...) VALUES (...) RETURNING id, created_at, updated_at;
  -- Note created_at and updated_at

  SELECT pg_sleep(2);  -- Wait 2 seconds

  UPDATE workshops SET cohort_name = 'Updated Name' WHERE id = ...;
  SELECT id, created_at, updated_at FROM workshops WHERE id = ...;
  -- Expected: updated_at > created_at
ROLLBACK;

-- Test workshop_enrollments.updated_at trigger
BEGIN;
  INSERT INTO workshop_enrollments (...) VALUES (...) RETURNING id, created_at, updated_at;

  SELECT pg_sleep(2);

  UPDATE workshop_enrollments SET status = 'active' WHERE id = ...;
  SELECT id, created_at, updated_at FROM workshop_enrollments WHERE id = ...;
  -- Expected: updated_at > created_at
ROLLBACK;
```

### View Query Validation

**Test workshop_analytics view:**

```sql
-- Query analytics view
SELECT
  cohort_name,
  total_enrolled,
  active_count,
  converted_count,
  spots_remaining,
  is_full,
  current_phase
FROM workshop_analytics
ORDER BY created_at DESC;

-- Expected: Query executes successfully, returns workshop data with calculated fields

-- Test with WHERE clause
SELECT * FROM workshop_analytics WHERE status = 'draft';

-- Test with JOIN
SELECT
  wa.cohort_name,
  wa.total_enrolled,
  w.created_by
FROM workshop_analytics wa
JOIN workshops w ON wa.id = w.id;
```

### Function Validation

**Test update_expired_workshop_trials function:**

```sql
-- Create test data with expired trial
BEGIN;
  INSERT INTO workshops (...) VALUES (...) RETURNING id;
  INSERT INTO workshop_enrollments (
    user_id, workshop_id, status, trial_expires_at
  ) VALUES (
    (SELECT id FROM users LIMIT 1),
    (SELECT id FROM workshops WHERE slug = 'test'),
    'active',
    NOW() - INTERVAL '1 day'  -- Expired yesterday
  );

  -- Run function
  SELECT update_expired_workshop_trials();

  -- Verify status changed
  SELECT status FROM workshop_enrollments WHERE trial_expires_at < NOW();
  -- Expected: 'trial_expired'
ROLLBACK;
```

---

## Rollback Procedure

### When to Rollback

**Rollback if any of these occur:**
- Migration fails with SQL error
- Foreign key constraints cannot be satisfied
- Indexes fail to create
- View creation fails
- Function creation fails
- Application cannot connect to database after migration
- Significant performance degradation observed
- Data integrity issues discovered

### Rollback Method 1: Migration Tool

```bash
# Use migration tool to rollback
cd audacious_money_backend
npm run migrate:down

# Verify rollback
npm run migrate:status

# Expected: 015_educational_workshops.sql should show as pending (○)
```

### Rollback Method 2: Manual SQL Script

**Create rollback script: `rollback_015_workshops.sql`**

```sql
-- ============================================================================
-- ROLLBACK SCRIPT: 015_educational_workshops
-- ============================================================================
-- WARNING: This will delete all workshop data!
-- ============================================================================

BEGIN;

-- Drop function
DROP FUNCTION IF EXISTS update_expired_workshop_trials();

-- Drop view
DROP VIEW IF EXISTS workshop_analytics;

-- Remove column from users table
ALTER TABLE users DROP COLUMN IF EXISTS current_workshop_enrollment_id;

-- Drop tables (CASCADE to handle foreign keys)
DROP TABLE IF EXISTS workshop_enrollments CASCADE;
DROP TABLE IF EXISTS workshops CASCADE;

-- Verify tables dropped
SELECT COUNT(*) FROM information_schema.tables
WHERE table_name IN ('workshops', 'workshop_enrollments');
-- Expected: 0

COMMIT;
```

**Execute rollback:**

```bash
# Execute rollback script
psql $DATABASE_URL -f rollback_015_workshops.sql

# Verify rollback successful
psql $DATABASE_URL -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name IN ('workshops', 'workshop_enrollments');"
# Expected: 0
```

### Rollback Method 3: Restore from Backup

**If rollback scripts fail, restore from backup:**

```bash
# Stop application to prevent new connections
sudo systemctl stop audacious-money-backend

# Drop current database
dropdb audacious_money

# Create fresh database
createdb audacious_money

# Restore from backup
BACKUP_FILE="backups/pre_workshop_migration_20260608_140000.sql"
psql -h localhost -U postgres -d audacious_money < $BACKUP_FILE

# Verify restoration
psql audacious_money -c "SELECT COUNT(*) FROM users;"

# Restart application
sudo systemctl start audacious-money-backend
```

### Post-Rollback Verification

**After rollback, verify:**

```sql
-- Verify workshops tables do not exist
SELECT COUNT(*) FROM information_schema.tables
WHERE table_name IN ('workshops', 'workshop_enrollments');
-- Expected: 0

-- Verify view does not exist
SELECT COUNT(*) FROM information_schema.views
WHERE table_name = 'workshop_analytics';
-- Expected: 0

-- Verify function does not exist
SELECT COUNT(*) FROM pg_proc
WHERE proname = 'update_expired_workshop_trials';
-- Expected: 0

-- Verify users.current_workshop_enrollment_id column removed
SELECT COUNT(*) FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'current_workshop_enrollment_id';
-- Expected: 0

-- Verify application still functions
SELECT COUNT(*) FROM users;
-- Expected: Normal user count
```

### Communication After Rollback

**If rollback is required:**

1. **Immediate notification:** Post in team Slack/Discord channel
2. **Status update:** "Migration 015 rolled back, investigating issue"
3. **Issue documentation:** Create issue with migration error logs
4. **Fix and retry:** Address root cause before attempting migration again
5. **Post-mortem:** Document what went wrong and how to prevent in future

---

## Migration Execution Commands

### Command Reference

```bash
# ============================================================================
# MIGRATION EXECUTION COMMAND REFERENCE
# ============================================================================

# PRE-MIGRATION
# -----------------------------------------------------------------------------

# 1. Create database backup
pg_dump -h localhost -U postgres -d audacious_money > "backups/pre_workshop_migration_$(date +%Y%m%d_%H%M%S).sql"

# 2. Check migration status
cd audacious_money_backend && npm run migrate:status

# 3. Test database connection
psql $DATABASE_URL -c "SELECT version();"

# MIGRATION EXECUTION
# -----------------------------------------------------------------------------

# 4. Execute migration
cd audacious_money_backend && npm run migrate:up

# 5. Verify migration applied
npm run migrate:status

# POST-MIGRATION VERIFICATION
# -----------------------------------------------------------------------------

# 6. Run verification queries
psql $DATABASE_URL -f verify_workshop_migration.sql

# 7. Test workshop insertion
psql $DATABASE_URL -c "INSERT INTO workshops (cohort_name, slug, ...) VALUES (...);"

# 8. Check indexes
psql $DATABASE_URL -c "SELECT tablename, indexname FROM pg_indexes WHERE tablename IN ('workshops', 'workshop_enrollments');"

# 9. Test view query
psql $DATABASE_URL -c "SELECT * FROM workshop_analytics LIMIT 5;"

# 10. Test function execution
psql $DATABASE_URL -c "SELECT update_expired_workshop_trials();"

# ROLLBACK (IF NEEDED)
# -----------------------------------------------------------------------------

# 11. Rollback migration
cd audacious_money_backend && npm run migrate:down

# 12. Verify rollback
npm run migrate:status

# 13. Manual rollback (if migration tool fails)
psql $DATABASE_URL -f rollback_015_workshops.sql
```

### Expected Output Examples

**Successful migration output:**

```
$ npm run migrate:up

> audacious-money-backend@1.0.0 migrate:up
> tsx src/db/migrate.ts up

🔍 Checking database connection...
✓ Database connected successfully

📋 Checking migration status...
Applied migrations: 14
Pending migrations: 1

🚀 Running pending migrations...

Executing: 015_educational_workshops.sql
  ✓ CREATE TABLE workshops
  ✓ CREATE TABLE workshop_enrollments
  ✓ ALTER TABLE users
  ✓ CREATE INDEX (6 indexes)
  ✓ CREATE VIEW workshop_analytics
  ✓ CREATE FUNCTION update_expired_workshop_trials

✅ Migration 015_educational_workshops.sql completed successfully (2.3s)

Migration summary:
  Total migrations applied: 1
  Total time: 2.3s
  Status: SUCCESS
```

**Migration status after success:**

```
$ npm run migrate:status

Applied migrations:
✓ 001_initial_schema.sql
✓ 002_password_reset_tokens.sql
...
✓ 014_fix_subscription_status_values.sql
✓ 015_educational_workshops.sql

Pending migrations:
(none)
```

**Verification query output:**

```
$ psql $DATABASE_URL -f verify_workshop_migration.sql

 workshops_table_exists
-----------------------
                     1
(1 row)

 enrollments_table_exists
-------------------------
                        1
(1 row)

 workshops_indexes
------------------
                6
(1 row)

...

✅ All verification checks passed
```

### Error Handling

**Common errors and solutions:**

**Error: Permission denied**
```
ERROR: permission denied to create table "workshops"
```
**Solution:** Ensure database user has CREATE privileges
```sql
GRANT CREATE ON DATABASE audacious_money TO your_db_user;
```

**Error: Foreign key constraint**
```
ERROR: foreign key constraint "workshops_created_by_fkey" cannot be implemented
```
**Solution:** Verify admin_users table exists
```sql
SELECT COUNT(*) FROM admin_users;
```

**Error: Function not found**
```
ERROR: function update_updated_at_column() does not exist
```
**Solution:** Run earlier migrations first to create the function

**Error: Migration already applied**
```
ERROR: Migration 015_educational_workshops.sql already applied
```
**Solution:** Check migration status, possibly already migrated
```bash
npm run migrate:status
```

---

## Migration Timeline

**Recommended execution timeline:**

| Time | Action | Duration | Responsible |
|------|--------|----------|-------------|
| T-24h | Notify team of planned migration | - | Tech Lead |
| T-4h | Create database backup | 1-2 min | Database Admin |
| T-2h | Test migration on staging | 5-10 min | Backend Developer |
| T-1h | Verify staging results | 10 min | Backend Developer + QA |
| T-0 | Execute production migration | 2-5 sec | Database Admin |
| T+5min | Run verification queries | 5 min | Database Admin |
| T+15min | Test application endpoints | 10 min | Backend Developer |
| T+30min | Monitor application logs | 15 min | DevOps |
| T+1h | Confirm migration success | - | Tech Lead |
| T+24h | Post-migration review | 30 min | Team |

---

## Success Criteria

**Migration is considered successful when:**

- [ ] Migration executes without errors
- [ ] All 2 tables created (workshops, workshop_enrollments)
- [ ] All 12 indexes created (6 + 5 + 1)
- [ ] 1 view created (workshop_analytics)
- [ ] 1 function created (update_expired_workshop_trials)
- [ ] 4 foreign key constraints working
- [ ] 2 triggers created and functioning
- [ ] All verification queries return expected results
- [ ] Test data insertion/deletion succeeds
- [ ] Application starts without errors
- [ ] API endpoints respond normally
- [ ] No performance degradation observed
- [ ] Backup created and verified
- [ ] Migration documented in migration log

---

## Contact and Escalation

**If issues arise during migration:**

1. **Stop immediately** if errors occur
2. **Do not proceed** with subsequent steps
3. **Document error message** in full
4. **Check error handling section** of this document
5. **Contact database administrator** if unable to resolve
6. **Consider rollback** if issue cannot be quickly resolved
7. **Notify team** of migration status

**Escalation path:**
1. Backend Developer → Database Administrator → Tech Lead → CTO

---

## Appendix A: Migration File Contents

**File:** `audacious_money_backend/src/db/migrations/015_educational_workshops.sql`

**Line count:** ~261 lines
**Tables created:** 2 (workshops, workshop_enrollments)
**Columns added:** 1 (users.current_workshop_enrollment_id)
**Indexes created:** 12 total
**Views created:** 1 (workshop_analytics)
**Functions created:** 1 (update_expired_workshop_trials)

**Dependencies:**
- admin_users table (foreign key)
- users table (foreign key, column addition)
- update_updated_at_column() function (triggers)

---

## Appendix B: Quick Reference

**One-command migration execution:**

```bash
# Full migration in one command (with logging)
cd audacious_money_backend && \
  pg_dump -h localhost -U postgres -d audacious_money > "../backups/pre_workshop_$(date +%Y%m%d_%H%M%S).sql" && \
  npm run migrate:up 2>&1 | tee migration_015.log && \
  npm run migrate:status
```

**One-command verification:**

```bash
# Verify all schema objects created
psql $DATABASE_URL << EOF
  SELECT
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'workshops') as workshops,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'workshop_enrollments') as enrollments,
    (SELECT COUNT(*) FROM pg_indexes WHERE tablename IN ('workshops', 'workshop_enrollments')) as indexes,
    (SELECT COUNT(*) FROM information_schema.views WHERE table_name = 'workshop_analytics') as views,
    (SELECT COUNT(*) FROM pg_proc WHERE proname = 'update_expired_workshop_trials') as functions;
EOF
```

**Expected output:** `workshops: 1 | enrollments: 1 | indexes: 11 | views: 1 | functions: 1`

---

**End of Migration Plan**

*Last Updated: 2026-06-08*
*For: Educational Workshop System (Sprint 8, Phase 8)*
*Next: WORKSHOP_FEATURE_ROLLOUT_PLAN.md*
