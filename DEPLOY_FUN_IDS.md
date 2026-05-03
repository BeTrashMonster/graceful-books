# Deploy Fun Company IDs

The backend code is ready to generate fun company IDs (e.g., `ocean_elephant_614`), but the database migration needs to be run first.

## Quick Fix (Run Migration)

### Option 1: Via DigitalOcean Database Console

1. Go to your DigitalOcean database dashboard
2. Open the database console
3. Copy and paste the SQL from `audacious_money_backend/src/db/migrations/014_support_fun_company_ids.sql`
4. Run it
5. Restart the backend app

### Option 2: Via SSH to Backend Server

```bash
# SSH to your backend server
ssh your-backend-server

# Navigate to the backend directory
cd /path/to/audacious_money_backend

# Pull latest code
git pull origin main

# Run migrations
npm run migrate:up

# Restart the backend service
pm2 restart audacious-money-backend
# OR if using systemd:
systemctl restart audacious-money-backend
```

## What the Migration Does

1. Changes `users.id` column from `UUID` to `VARCHAR(100)`
2. Updates foreign key columns in related tables
3. Adds constraint to ensure IDs are either UUIDs (existing users) or fun IDs (new users)
4. **Backward compatible** - existing beta tester UUIDs will continue to work

## Testing After Migration

After running the migration and restarting:

1. Try creating a new account
2. Check the user ID in the database - should be like `ocean_elephant_614`
3. Existing beta testers should still be able to log in with their UUID-based accounts

## Rollback (If Needed)

If something goes wrong, you can revert the column type:

```sql
BEGIN;

ALTER TABLE users ALTER COLUMN id TYPE UUID USING id::uuid;
ALTER TABLE user_products ALTER COLUMN user_id TYPE UUID USING user_id::uuid;
-- (similar for other tables)

COMMIT;
```

Note: This will ONLY work if no fun IDs have been created yet.
