# Database Migration System - Complete Guide

This guide explains how to use the database migration system for the Audacious Money backend.

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Creating Migrations](#creating-migrations)
4. [Running Migrations](#running-migrations)
5. [Migration Best Practices](#migration-best-practices)
6. [Troubleshooting](#troubleshooting)
7. [Production Deployment](#production-deployment)

## Overview

The migration system provides:
- **Version control** for database schema changes
- **Transaction safety** - automatic rollback on failures
- **Audit trail** - all migrations logged
- **Idempotency** - migrations never run twice
- **Simple SQL** - no ORM, just pure PostgreSQL

### Architecture

```
Migration File (SQL) → Migration Runner (migrate.ts) → PostgreSQL Database
                                ↓
                      schema_migrations table
                      (tracks what's been run)
```

## Quick Start

### 1. Install Dependencies

```bash
cd audacious_money_backend
bun install
```

### 2. Configure Database

Set `DATABASE_URL` in `.env`:

```bash
DATABASE_URL=postgresql://postgres:BEtheCHANG3!@localhost:5432/audacious_money
```

### 3. Check Status

```bash
bun run migrate:status
```

This will:
- Create the `schema_migrations` table if it doesn't exist
- Show which migrations have been executed
- Show which migrations are pending

### 4. Run Migrations

```bash
bun run migrate:up
```

This will:
- Run all pending migrations in order
- Skip migrations that have already been executed
- Roll back automatically if any migration fails
- Log all results to `schema_migrations` table

## Creating Migrations

### Migration File Naming

Format: `{version}_{description}.sql`

- **Version**: 3-digit zero-padded number (001, 002, 003, etc.)
- **Description**: Snake_case description

**Examples:**
```
001_initial_schema.sql
002_add_user_indexes.sql
003_create_notifications_table.sql
004_add_email_verification.sql
```

### Step-by-Step Process

#### 1. Determine Next Version Number

```bash
# List existing migrations
ls src/db/migrations/

# Output:
# 001_initial_schema.sql
# 002_add_user_indexes.sql
# Next would be: 003
```

#### 2. Create Migration File

```bash
touch src/db/migrations/003_create_notifications_table.sql
```

#### 3. Write Migration SQL

```sql
-- 003_create_notifications_table.sql
-- Add notifications feature for user alerts

-- Create notifications table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('info', 'warning', 'success', 'error')),
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- Index for unread notifications (IDOR prevention)
CREATE INDEX idx_notifications_unread
  ON notifications(user_id, read_at)
  WHERE read_at IS NULL;

-- Add updated_at trigger
CREATE TRIGGER update_notifications_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comment for documentation
COMMENT ON TABLE notifications IS 'User notifications and alerts';
```

#### 4. Test Migration Locally

```bash
# Check what will be executed
bun run migrate:status

# Run migration
bun run migrate:up

# Verify in database
psql -U postgres audacious_money -c "\d notifications"
```

#### 5. Commit to Git

```bash
git add src/db/migrations/003_create_notifications_table.sql
git commit -m "Add notifications table migration"
```

## Running Migrations

### Commands

```bash
# Show status of all migrations
bun run migrate:status

# Run all pending migrations
bun run migrate:up

# Show rollback instructions (doesn't actually rollback)
bun run migrate:down
```

### What Happens During `migrate:up`

1. **Initialize** - Creates `schema_migrations` table if needed
2. **Read Files** - Scans `src/db/migrations/` for `.sql` files
3. **Check Executed** - Queries `schema_migrations` to find what's been run
4. **Find Pending** - Compares files vs executed to find pending migrations
5. **Execute Each**:
   - Begin transaction
   - Execute SQL from file
   - Insert record to `schema_migrations`
   - Commit transaction
6. **Rollback on Error** - If any step fails, rollback and log error

### Migration Status Output

```bash
$ bun run migrate:status

📊 Migration Status:

Version | Status    | Name                          | Executed At
--------|-----------|-------------------------------|---------------------------
001     | ✅ Done   | initial_schema                | 2026-03-21T10:30:00.000Z
002     | ✅ Done   | add_user_indexes              | 2026-03-21T11:15:00.000Z
003     | ⏳ Pending| create_notifications_table    | -

📈 Summary: 2 completed, 1 pending, 0 failed
```

## Migration Best Practices

### 1. Keep Migrations Small

✅ **Good**: One focused change per migration
```
002_add_user_email_index.sql
003_add_user_verified_column.sql
004_create_notifications_table.sql
```

❌ **Bad**: Multiple unrelated changes
```
002_update_everything.sql  (adds indexes, new tables, and modifies columns)
```

### 2. Use Idempotent SQL

Use `IF NOT EXISTS` to allow re-running:

✅ **Good**:
```sql
CREATE TABLE IF NOT EXISTS products (...);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
```

❌ **Bad**:
```sql
CREATE TABLE products (...);  -- Will fail if table exists
```

### 3. Add Proper Indexes

Always add indexes for:
- Foreign keys (automatic performance)
- User-scoped queries (IDOR prevention)
- Frequently filtered columns

**Example**:
```sql
-- Foreign key index
CREATE INDEX idx_notifications_user_id ON notifications(user_id);

-- IDOR prevention (compound index)
CREATE INDEX idx_user_notifications
  ON notifications(user_id, id);

-- Performance for common queries
CREATE INDEX idx_notifications_unread
  ON notifications(user_id, read_at)
  WHERE read_at IS NULL;
```

### 4. Include IDOR Prevention

Always filter user-owned data by `user_id`:

```sql
-- Add compound indexes for IDOR prevention
CREATE INDEX idx_user_products_user_product
  ON user_products(user_id, product_id);

-- This allows queries like:
-- SELECT * FROM user_products WHERE user_id = $1 AND product_id = $2
-- to use the index and prevent access to other users' data
```

### 5. Add Constraints

Use database constraints to enforce data integrity:

```sql
CREATE TABLE payments (
  -- ... other columns
  total_amount DECIMAL(10, 2) NOT NULL,
  charity_amount DECIMAL(10, 2) NOT NULL,
  revenue_amount DECIMAL(10, 2) NOT NULL,

  -- Constraint ensures amounts add up correctly
  CONSTRAINT check_payment_amounts
    CHECK (total_amount = charity_amount + revenue_amount)
);
```

### 6. Document Your Changes

Add comments to explain the purpose:

```sql
-- 003_create_notifications_table.sql
-- Add notifications feature for user alerts
-- This supports the notification center in the dashboard

COMMENT ON TABLE notifications IS 'User notifications and alerts';
COMMENT ON COLUMN notifications.type IS 'Notification type: info, warning, success, or error';
```

### 7. Test Before Committing

Always test migrations locally:

```bash
# 1. Check status
bun run migrate:status

# 2. Run migration
bun run migrate:up

# 3. Verify in database
psql -U postgres audacious_money -c "\d+ notifications"

# 4. Test queries
psql -U postgres audacious_money -c "SELECT * FROM notifications LIMIT 1;"

# 5. Check for errors in output
```

### 8. Handle Data Migrations Carefully

When migrating data, consider:

```sql
-- Bad: Could fail if table is large
UPDATE users SET status = 'active' WHERE status IS NULL;

-- Better: Batch updates
UPDATE users SET status = 'active'
WHERE status IS NULL
  AND id IN (
    SELECT id FROM users WHERE status IS NULL LIMIT 1000
  );

-- Or use a separate script for large data migrations
```

## Troubleshooting

### Migration Fails

**Symptom**: Migration exits with error

**Solution**:
1. Read the error message carefully
2. Check the failing migration file for syntax errors
3. Verify table/column names are correct
4. Check constraints are valid

**Fix and retry**:
```bash
# Delete failed migration record
psql -U postgres audacious_money

DELETE FROM schema_migrations WHERE version = '003' AND success = false;
\q

# Fix the migration file
nano src/db/migrations/003_create_notifications_table.sql

# Retry
bun run migrate:up
```

### "relation already exists"

**Cause**: Migration partially executed before failing

**Solution**:
1. Manually drop the created objects:
   ```sql
   DROP TABLE IF EXISTS notifications CASCADE;
   ```

2. Or modify migration to use `IF NOT EXISTS`:
   ```sql
   CREATE TABLE IF NOT EXISTS notifications (...);
   ```

3. Delete failed migration record and retry

### Migration Runs But Changes Not Visible

**Check**:
1. Connected to correct database
2. Transaction committed (automatic in our system)
3. No errors in output

**Verify**:
```bash
psql -U postgres audacious_money -c "\dt"  # List tables
```

### "schema_migrations does not exist"

**Cause**: First time running migrations

**Solution**: Run any migration command:
```bash
bun run migrate:status  # Will create the table
```

### Duplicate Migration Execution

**Cause**: Migration runs twice

**Check**: Should not happen! System checks `schema_migrations` first.

**Investigate**:
```sql
SELECT * FROM schema_migrations ORDER BY version;
-- Look for duplicates
```

## Production Deployment

### Pre-Deployment Checklist

- [ ] Migrations tested in development
- [ ] Migrations reviewed by team
- [ ] Rollback plan documented
- [ ] Backup created before deployment
- [ ] Downtime window scheduled (if needed)

### Deployment Steps

1. **Backup Database**
   ```bash
   pg_dump -U postgres audacious_money > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Review Pending Migrations**
   ```bash
   DATABASE_URL="postgresql://..." bun run migrate:status
   ```

3. **Run Migrations**
   ```bash
   DATABASE_URL="postgresql://..." bun run migrate:up
   ```

4. **Verify Success**
   ```bash
   # Check migration status
   DATABASE_URL="postgresql://..." bun run migrate:status

   # Verify in database
   psql "postgresql://..." -c "SELECT version, name, success FROM schema_migrations ORDER BY version;"
   ```

5. **Test Application**
   - Verify app starts without errors
   - Test critical features
   - Check logs for any issues

### Rollback Plan

If migration causes issues:

1. **Stop the application**

2. **Restore from backup**
   ```bash
   dropdb audacious_money_production
   createdb audacious_money_production
   psql audacious_money_production < backup_20260321_103000.sql
   ```

3. **Or create a reverse migration**
   ```bash
   # Create new migration to undo changes
   touch src/db/migrations/004_revert_notifications.sql
   ```

   ```sql
   -- 004_revert_notifications.sql
   DROP TABLE IF EXISTS notifications CASCADE;
   ```

### Production Safety

- **Never** delete migration files that have been executed
- **Never** modify executed migration files
- **Always** create new migrations to fix issues
- **Always** backup before running migrations
- **Test** migrations in staging first

## Advanced Topics

### Large Index Creation

For large tables, create indexes without blocking:

```sql
-- Cannot use in transaction, so run separately
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users(email);
```

Note: `CONCURRENTLY` cannot be used in our transaction-based system. For large indexes:
1. Create the index manually in production
2. Or accept brief table locks during migration

### Multiple Environments

Use different databases for each environment:

```bash
# Development
DATABASE_URL=postgresql://localhost/audacious_money_dev

# Staging
DATABASE_URL=postgresql://staging-host/audacious_money_staging

# Production
DATABASE_URL=postgresql://prod-host/audacious_money_prod
```

### Migration History

View all executed migrations:

```sql
SELECT
  version,
  name,
  success,
  executed_at,
  error_message
FROM schema_migrations
ORDER BY version;
```

### Custom Migration Scripts

For complex migrations, you can:

1. Create SQL migration for schema changes
2. Create Node.js/TypeScript script for data migration
3. Run both as part of deployment

## Summary

### Key Concepts

- ✅ Migrations are versioned and tracked
- ✅ All migrations run in transactions
- ✅ Failed migrations roll back automatically
- ✅ System prevents duplicate execution
- ✅ Simple SQL files, no ORM required

### Common Workflow

```bash
# Daily development
bun run migrate:status    # Check what's pending
bun run migrate:up        # Run pending migrations

# Creating new migration
touch src/db/migrations/00X_feature.sql
# Edit file with SQL
bun run migrate:up        # Test migration
git add src/db/migrations/00X_feature.sql
git commit -m "Add feature migration"
```

### Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Migration README](src/db/migrations/README.md)
- [Roadmap Tasks](../Roadmaps/Roadmap_Tasks.md)
- [Agent Review Checklist](../Roadmaps/agent_review_checklist.md)

## Questions?

For questions about:
- **Migration system** - Review this guide
- **Database schema** - See `001_initial_schema.sql`
- **Security** - See agent review checklist
- **Roadmap** - See `Roadmap_Tasks.md`
