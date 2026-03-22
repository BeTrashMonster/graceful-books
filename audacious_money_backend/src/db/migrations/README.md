# Database Migrations

This directory contains SQL migration files for the Audacious Money database.

## Overview

The migration system provides:
- **Versioned migrations** - Each migration has a unique version number
- **Transaction safety** - All migrations run in transactions with automatic rollback on failure
- **Audit trail** - All migrations are logged in the `schema_migrations` table
- **Idempotency** - Migrations are never run twice
- **Simple SQL** - Write plain SQL, no ORM required

## Migration File Format

Migration files must follow this naming pattern:

```
{version}_{description}.sql
```

Where:
- `version` - 3-digit zero-padded number (001, 002, 003, etc.)
- `description` - Snake_case description of the migration

**Examples:**
- `001_initial_schema.sql`
- `002_add_user_indexes.sql`
- `003_create_payments_table.sql`

## Creating a New Migration

1. **Determine the next version number**
   ```bash
   # List existing migrations
   ls migrations/
   ```

2. **Create the migration file**
   ```bash
   # Example: Adding a new table
   touch migrations/004_create_notifications_table.sql
   ```

3. **Write your SQL migration**
   ```sql
   -- migrations/004_create_notifications_table.sql

   -- Create notifications table
   CREATE TABLE notifications (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     title VARCHAR(255) NOT NULL,
     message TEXT NOT NULL,
     read_at TIMESTAMP WITH TIME ZONE,
     created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
   );

   -- Add indexes
   CREATE INDEX idx_notifications_user_id ON notifications(user_id);
   CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
   CREATE INDEX idx_notifications_unread ON notifications(user_id, read_at)
     WHERE read_at IS NULL;

   -- Add trigger for updated_at
   CREATE TRIGGER update_notifications_updated_at
     BEFORE UPDATE ON notifications
     FOR EACH ROW
     EXECUTE FUNCTION update_updated_at_column();
   ```

4. **Test your migration**
   ```bash
   # Check status
   bun run migrate:status

   # Run migration
   bun run migrate:up
   ```

## Running Migrations

### Run all pending migrations
```bash
bun run migrate:up
```

This will:
1. Check which migrations have already been executed
2. Run any pending migrations in order
3. Roll back automatically if any migration fails
4. Log all results to `schema_migrations` table

### Check migration status
```bash
bun run migrate:status
```

Shows:
- Which migrations have been executed
- Which migrations are pending
- Any failed migrations with error messages

### Rollback instructions
```bash
bun run migrate:down
```

Note: Automatic rollback is not implemented for safety. To reverse a migration:
1. Create a new migration with the reverse operations
2. Run `bun run migrate:up` to apply the reversal

## Best Practices

### 1. Keep migrations small and focused
✅ Good:
```
002_add_user_email_index.sql
003_add_user_verified_column.sql
```

❌ Bad:
```
002_update_all_user_stuff.sql
```

### 2. Use transactions implicitly
Migrations automatically run in transactions. Don't add `BEGIN`/`COMMIT`:

✅ Good:
```sql
CREATE TABLE products (...);
CREATE INDEX idx_products_name ON products(name);
```

❌ Bad:
```sql
BEGIN;
CREATE TABLE products (...);
COMMIT;
```

### 3. Make migrations idempotent when possible
Use `IF NOT EXISTS` to allow re-running:

✅ Good:
```sql
CREATE TABLE IF NOT EXISTS products (...);
```

### 4. Add indexes with CONCURRENTLY in production
For large tables, create indexes without blocking:

```sql
-- For production databases with existing data
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email
  ON users(email);
```

Note: `CONCURRENTLY` cannot be used inside a transaction. For large indexes, consider:
1. Running the index creation manually outside migrations
2. Or accepting brief table locks during off-peak hours

### 5. Include both DDL and data changes
Migrations can include:
- Schema changes (CREATE, ALTER, DROP)
- Data migrations (INSERT, UPDATE, DELETE)
- Index creation
- Function/trigger creation

### 6. Test rollback procedures
Before running in production:
1. Test migration in development
2. Document how to reverse the changes
3. Create a reverse migration if needed

### 7. Use security best practices
- Always use parameterized queries in application code
- Add IDOR prevention indexes (compound indexes with user_id)
- Set appropriate constraints and foreign keys
- Use triggers for automatic timestamp updates

Example security-conscious migration:
```sql
-- Create table with proper constraints
CREATE TABLE user_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  status VARCHAR(50) NOT NULL CHECK (status IN ('trial', 'active', 'cancelled', 'expired')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Prevent duplicate subscriptions
  UNIQUE(user_id, product_id)
);

-- IDOR prevention: compound index for user-scoped queries
CREATE INDEX idx_user_products_user_id_product_id
  ON user_products(user_id, product_id);

-- Performance: status queries
CREATE INDEX idx_user_products_status
  ON user_products(status)
  WHERE status IN ('trial', 'active');
```

## Migration Table Schema

The `schema_migrations` table tracks all migration executions:

```sql
CREATE TABLE schema_migrations (
  id SERIAL PRIMARY KEY,
  version VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

**Columns:**
- `id` - Auto-incrementing primary key
- `version` - Migration version (e.g., "001", "002")
- `name` - Migration name from filename
- `executed_at` - When the migration was executed
- `success` - Whether migration succeeded
- `error_message` - Error details if migration failed
- `created_at` - When record was created

## Troubleshooting

### Migration fails with "relation already exists"
The migration may have partially executed before failing. Options:
1. Drop the created objects manually
2. Modify the migration to use `IF NOT EXISTS`
3. Create a new migration to fix the issue

### How to fix a failed migration
1. Check the error in `schema_migrations` table:
   ```sql
   SELECT * FROM schema_migrations WHERE success = false;
   ```

2. Fix the issue in the migration file

3. Delete the failed migration record:
   ```sql
   DELETE FROM schema_migrations WHERE version = '003' AND success = false;
   ```

4. Re-run migrations:
   ```bash
   bun run migrate:up
   ```

### Migration runs but table doesn't appear
Check:
1. Connected to correct database
2. Transaction was committed (should be automatic)
3. No errors in migration output
4. Database permissions are correct

## Example Migrations

See the example migration in this directory:
- `001_initial_schema.sql` - Complete initial database schema

## Environment Variables

Migrations require the `DATABASE_URL` environment variable:

```bash
# Development
DATABASE_URL="postgresql://user:password@localhost:5432/audacious_money"

# Production
DATABASE_URL="postgresql://user:password@host:5432/audacious_money_production?sslmode=require"
```

## Further Reading

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Database Best Practices](../../docs/DATABASE_BEST_PRACTICES.md)
- Task 0.3 in Roadmap_Tasks.md
