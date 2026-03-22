# Quick Start - Database Migration System

**5-minute setup guide for the Audacious Money database migration system**

## Prerequisites

- PostgreSQL 15+ running locally
- Database `audacious_money` created with password `BEtheCHANG3!`
- Bun runtime installed ([install here](https://bun.sh))

## Setup (3 steps)

### 1. Install Dependencies

```bash
cd audacious_money_backend
bun install
```

### 2. Check Migration Status

```bash
bun run migrate:status
```

**Expected output:**
```
✅ Migration system initialized

📊 Migration Status:

Version | Status    | Name                          | Executed At
--------|-----------|-------------------------------|---------------------------
001     | ⏳ Pending| initial_schema                | -

📈 Summary: 0 completed, 1 pending, 0 failed
```

### 3. Run Migrations

```bash
bun run migrate:up
```

**Expected output:**
```
📋 Found 1 pending migration(s):
   - 001: initial_schema

🔄 Running migration 001: initial_schema
✅ Migration 001 completed successfully

✨ All migrations completed successfully!
```

## Verify Setup

Check that tables were created:

```bash
psql -U postgres audacious_money -c "\dt"
```

**Expected output:**
```
               List of relations
 Schema |          Name           | Type  |  Owner
--------+-------------------------+-------+----------
 public | admin_audit_log         | table | postgres
 public | admin_users             | table | postgres
 public | affiliate_conversions   | table | postgres
 public | affiliates              | table | postgres
 public | charities               | table | postgres
 public | payments                | table | postgres
 public | products                | table | postgres
 public | schema_migrations       | table | postgres
 public | user_charity_selections | table | postgres
 public | user_products           | table | postgres
 public | users                   | table | postgres
```

Check seed data:

```bash
psql -U postgres audacious_money -c "SELECT slug, name, price_monthly FROM products;"
```

**Expected output:**
```
            slug             |            name             | price_monthly
-----------------------------+-----------------------------+---------------
 budgeting                   | Budgeting                   |         10.00
 debt-management             | Debt Management             |         20.00
 service-provider-management | Service Provider Management |         30.00
 cpu-cpg-calculator          | CPU/CPG Calculator          |         15.00
 bookkeeping-suite           | Bookkeeping Suite           |         40.00
 fractional-cfo              | Fractional CFO              |         60.00
```

## Common Commands

```bash
# View migration status
bun run migrate:status

# Run pending migrations
bun run migrate:up

# Show rollback instructions
bun run migrate:down
```

## Creating Your First Migration

### 1. Create Migration File

```bash
touch src/db/migrations/002_add_notifications.sql
```

### 2. Write SQL

```sql
-- 002_add_notifications.sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
```

### 3. Run Migration

```bash
bun run migrate:up
```

### 4. Verify

```bash
psql -U postgres audacious_money -c "\d notifications"
```

## Troubleshooting

### "bun: command not found"

Install Bun:
```bash
curl -fsSL https://bun.sh/install | bash
```

### "Connection refused"

Start PostgreSQL:
```bash
# Windows
net start postgresql

# Verify it's running
psql -U postgres -c "SELECT version();"
```

### "Database does not exist"

Create the database:
```bash
createdb audacious_money
# or
psql -U postgres -c "CREATE DATABASE audacious_money;"
```

### Migration fails

1. Check the error message
2. Fix the SQL in the migration file
3. Delete the failed migration record:
   ```sql
   DELETE FROM schema_migrations WHERE version = '002' AND success = false;
   ```
4. Re-run: `bun run migrate:up`

## Next Steps

- ✅ Migrations set up
- 📖 Read the [comprehensive guide](MIGRATION_GUIDE.md)
- 🏗️ Proceed to Task 0.4 (Backend setup with Hono)
- 📋 Check [Roadmap Tasks](../Roadmaps/Roadmap_Tasks.md)

## Full Documentation

- **Quick Reference**: This file (QUICK_START.md)
- **Complete Guide**: [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md) - 500+ lines
- **Best Practices**: [src/db/migrations/README.md](src/db/migrations/README.md) - 300+ lines
- **Project README**: [README.md](README.md) - Setup and architecture
- **Verification**: [SETUP_VERIFICATION.md](SETUP_VERIFICATION.md) - Testing checklist

## Support

Having issues? Check:
1. This quick start guide
2. [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md) - Comprehensive troubleshooting
3. [README.md](README.md) - Full setup instructions

---

**You're ready to go!** 🚀

The migration system is fully set up. Run `bun run migrate:up` and start building.
