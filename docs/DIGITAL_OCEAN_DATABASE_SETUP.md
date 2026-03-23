# Digital Ocean Database Setup Guide

**Platform:** Audacious Money Backend
**Database:** PostgreSQL 15 (Managed Database)
**Estimated Time:** 15-20 minutes
**Last Updated:** March 22, 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Database Creation](#database-creation)
4. [Security Configuration](#security-configuration)
5. [Firewall Configuration](#firewall-configuration)
6. [Backup Configuration](#backup-configuration)
7. [Connection Pool Setup](#connection-pool-setup)
8. [Running Migrations](#running-migrations)
9. [Environment Variable Setup](#environment-variable-setup)
10. [Testing & Verification](#testing--verification)
11. [Security Checklist](#security-checklist)
12. [Troubleshooting](#troubleshooting)

---

## Overview

This guide walks you through setting up a production-grade PostgreSQL 15 database on Digital Ocean for the Audacious Money backend. Digital Ocean's managed database service provides:

- **Automated backups** with point-in-time recovery
- **SSL/TLS encryption** for data in transit
- **Connection pooling** for better performance
- **Automatic failover** for high availability
- **Monitoring & alerts** built-in
- **Easy scaling** as your needs grow

**What you'll accomplish:**
- Create a PostgreSQL 15 managed database
- Configure security settings (SSL, firewall, strong passwords)
- Set up automated backups
- Create a connection pool for optimal performance
- Run database migrations
- Test and verify the connection

**Security importance:** This database will store sensitive user data including payment information, subscription records, and charity selections. Proper security configuration is critical.

---

## Prerequisites

Before starting, ensure you have:

- [ ] **Digital Ocean account** with payment method on file
- [ ] **Account access** - Ability to create managed databases (not blocked by account limits)
- [ ] **Local PostgreSQL client** installed (`psql` command-line tool)
  - **Windows:** Download from [PostgreSQL official site](https://www.postgresql.org/download/windows/)
  - **macOS:** `brew install postgresql`
  - **Linux:** `sudo apt-get install postgresql-client`
- [ ] **Schema file ready** - `audacious_money_backend/src/db/migrations/001_initial_schema.sql` exists
- [ ] **Secure password manager** - To store database credentials safely
- [ ] **SSH access** - For running migrations from your local machine

---

## Database Creation

### Step 1: Navigate to Database Creation

1. Log into your **Digital Ocean account** at https://cloud.digitalocean.com
2. Click **Create** in the top-right corner
3. Select **Databases** from the dropdown menu

**Screenshot description:** You should see a "Create Database" page with database engine options.

### Step 2: Choose Database Engine

1. Select **PostgreSQL** as the database engine
2. Choose version **15** (or the latest stable PostgreSQL 15.x version)
   - **Why PostgreSQL 15?** Better performance, improved security features, and full JSONB support

### Step 3: Select Datacenter Region

Choose a datacenter region closest to your primary users:

- **US East Coast:** `nyc3` (New York City)
- **US West Coast:** `sfo3` (San Francisco)
- **Europe:** `ams3` (Amsterdam) or `fra1` (Frankfurt)
- **Asia:** `sgp1` (Singapore)

**Recommendation:** Start with `nyc3` for US-based users. You can add read replicas in other regions later if needed.

### Step 4: Choose Database Plan

Digital Ocean offers several plan tiers. Choose based on your stage:

#### Development/Staging Environment
- **Plan:** Basic
- **RAM:** 1 GB
- **vCPUs:** 1
- **Storage:** 10 GB
- **Max Connections:** 25
- **Cost:** ~$15/month

**Best for:** Testing, staging environments, low-traffic development

#### Production Environment (Recommended)
- **Plan:** Professional
- **RAM:** 4 GB
- **vCPUs:** 2
- **Storage:** 61 GB (80 GB usable with compression)
- **Max Connections:** 97
- **Cost:** ~$60/month

**Best for:** Production applications with moderate traffic (up to 10,000 active users)

**Note:** You can upgrade seamlessly later without downtime. Start with Basic for initial testing, then upgrade to Professional before launch.

### Step 5: Configure Database Settings

1. **Database cluster name:** `audacious-money-production`
   - This is for your reference only; users won't see this name

2. **Database name:** `audacious_money_production`
   - **Important:** Use underscores, not hyphens (PostgreSQL naming convention)

3. **Enable Trusted Sources:** Check this box
   - This enables the firewall feature (we'll configure it in Section 5)

4. **Tags (optional):** Add `production`, `backend`, `postgresql`
   - Helps with billing organization and resource management

### Step 6: Review and Create

1. Review your configuration:
   - PostgreSQL 15
   - Correct region
   - Correct plan size
   - Database name: `audacious_money_production`

2. Click **Create Database Cluster**

3. **Wait for provisioning** (usually 3-5 minutes)
   - You'll see a progress indicator
   - Once complete, the status will show "Available"

---

## Security Configuration

### Step 1: Locate Connection Details

Once your database is created:

1. Navigate to your database cluster in the Digital Ocean dashboard
2. Click the **Connection Details** tab
3. You should see connection information including:
   - Host
   - Port
   - Database name
   - Username
   - Password

### Step 2: Download SSL Certificate

**Critical for security:** Always use SSL connections to your database.

1. In the Connection Details section, find **SSL Certificate**
2. Click **Download CA Certificate**
3. Save the file as `ca-certificate.crt` in a secure location
   - **Windows:** `C:\Users\[YourName]\.postgresql\ca-certificate.crt`
   - **macOS/Linux:** `~/.postgresql/ca-certificate.crt`

**Why SSL?** Encrypts all data transmitted between your application and the database, preventing interception.

### Step 3: Enable "Require SSL" Mode

1. In the database settings, find **SSL Mode**
2. Select **require** (or **verify-full** for maximum security)
   - `require`: Encrypts connection, doesn't verify certificate
   - `verify-full`: Encrypts connection AND verifies server identity (recommended for production)

3. Click **Save**

### Step 4: Save Connection Details Securely

**IMPORTANT:** Never store these credentials in code or version control.

Copy the following information to your password manager:

```
Database Host: db-postgresql-nyc3-xxxxx-do-user-xxxxx-0.x.db.ondigitalocean.com
Database Port: 25060
Database Name: audacious_money_production
Username: doadmin
Password: [generated-password]
SSL Mode: require
```

**Connection String Format:**
```
postgresql://doadmin:[PASSWORD]@[HOST]:25060/audacious_money_production?sslmode=require
```

**Replace placeholders:**
- `[PASSWORD]` - The auto-generated password from Digital Ocean
- `[HOST]` - The full hostname (e.g., `db-postgresql-nyc3-12345-do-user-67890-0.x.db.ondigitalocean.com`)

---

## Firewall Configuration

Digital Ocean's "Trusted Sources" firewall allows you to whitelist specific IP addresses that can connect to your database.

### Step 1: Add Your Local Development IP

You'll need to add your IP to run migrations:

1. Go to the **Settings** tab of your database cluster
2. Find **Trusted Sources** section
3. Click **Add Trusted Source**
4. Select **This computer's IP address** or enter manually
   - To find your IP: Visit https://whatismyipaddress.com
5. Add a note: `Dev machine - for migrations`
6. Click **Save**

### Step 2: Remove Default Public Access

**Security Check:** Ensure `0.0.0.0/0` (all IPs) is NOT in your trusted sources list.

1. If you see `0.0.0.0/0` in the trusted sources list, click the **X** to remove it
2. Confirm removal

**Why?** Public database access is a major security risk. Only trusted IPs should connect.

### Step 3: Plan for Backend Server IP

After deploying your backend (Task 6.2), you'll need to:

1. Get the backend server's outbound IP address
2. Add it to Trusted Sources with note: `Production backend server`

**Note:** Digital Ocean App Platform uses dynamic IPs, so you may need to use Digital Ocean VPC or allow all App Platform IPs. See Task 6.2 documentation for details.

---

## Backup Configuration

Digital Ocean managed databases include automated backups.

### Step 1: Verify Backup Schedule

1. Go to the **Backups & Snapshots** tab
2. Verify **Daily Backups** are enabled (should be enabled by default)

### Step 2: Configure Backup Window

Choose a time when database usage is lowest:

1. Click **Edit Backup Window**
2. Select backup time (UTC timezone)
   - **Recommended:** 3:00 AM - 4:00 AM UTC (covers US nighttime)
3. Click **Save**

**Why a backup window?** Backups can slightly impact performance, so running during low-traffic hours minimizes user impact.

### Step 3: Set Retention Period

1. Check **Backup Retention** setting
2. Default is **7 days** (sufficient for most cases)
3. For compliance requirements, consider upgrading to Professional tier with longer retention

**Note:** Professional plans support longer retention periods and point-in-time recovery.

### Step 4: Test Restore Process

**Best practice:** Test your backup restore process before you need it.

1. Click on a backup in the list
2. Review the restore options:
   - **Restore to existing cluster** (replaces current data - DANGEROUS in production)
   - **Restore to new cluster** (creates a copy - SAFE for testing)
3. For testing, choose **Restore to new cluster**
4. Name it `audacious-money-backup-test`
5. Verify the restored database contains your data
6. Delete the test cluster when done

---

## Connection Pool Setup

Connection pooling improves performance by reusing database connections instead of creating new ones for each query.

### Why Connection Pooling?

- **Better performance:** Reduces connection overhead
- **Handles more requests:** Multiplexes many application connections over fewer database connections
- **Prevents connection exhaustion:** Limits max connections to the database

### Step 1: Create Connection Pool

1. Go to the **Connection Pools** tab in your database cluster
2. Click **Create Connection Pool**

### Step 2: Configure Pool Settings

Fill in the following:

- **Pool Name:** `audacious-money-pool`
- **Database:** `audacious_money_production`
- **User:** `doadmin`
- **Mode:** Select **Transaction**
- **Pool Size:** `25` connections

**Pool Modes Explained:**

- **Session mode:** One database connection per client connection (simple but less efficient)
- **Transaction mode:** Reuses connections after each transaction (recommended for most apps)
- **Statement mode:** Reuses connections after each statement (only for read-only workloads)

**Recommendation:** Use **Transaction mode** for the Audacious Money backend.

### Step 3: Save Pool Connection String

After creating the pool, Digital Ocean will provide a **pooled connection string**:

```
postgresql://doadmin:[PASSWORD]@[HOST]:25060/audacious_money_production?sslmode=require&pool=audacious-money-pool
```

**Important:** Use this pooled connection string in your backend `.env.production` file, NOT the direct database connection string.

---

## Running Migrations

Now that the database is created and secured, it's time to set up the schema.

### Step 1: Verify Local PostgreSQL Client

Test that `psql` is installed:

```bash
psql --version
```

**Expected output:** `psql (PostgreSQL) 15.x` or higher

If not installed, see [Prerequisites](#prerequisites) for installation instructions.

### Step 2: Test Database Connection

Try connecting to your database:

```bash
psql "postgresql://doadmin:[PASSWORD]@[HOST]:25060/audacious_money_production?sslmode=require"
```

**Replace placeholders:**
- `[PASSWORD]` - Your database password
- `[HOST]` - Your database host from Digital Ocean

**Troubleshooting connection issues:**

- **Error: `could not connect to server`**
  - Check your IP is in Trusted Sources (see Section 5)
  - Verify the hostname is correct

- **Error: `SSL connection has been closed unexpectedly`**
  - Download and install the CA certificate (see Section 4, Step 2)
  - Set `sslmode=require` in the connection string

- **Error: `password authentication failed`**
  - Double-check the password (it's case-sensitive)
  - Ensure you're using the `doadmin` username

If connected successfully, you'll see:

```
psql (15.x)
SSL connection (protocol: TLSv1.3, cipher: TLS_AES_256_GCM_SHA384, bits: 256, compression: off)
Type "help" for help.

audacious_money_production=>
```

Type `\q` to exit.

### Step 3: Set DATABASE_URL Environment Variable

For easier migration running, set the `DATABASE_URL` environment variable:

**Windows (PowerShell):**
```powershell
$env:DATABASE_URL="postgresql://doadmin:[PASSWORD]@[HOST]:25060/audacious_money_production?sslmode=require"
```

**macOS/Linux (Bash):**
```bash
export DATABASE_URL="postgresql://doadmin:[PASSWORD]@[HOST]:25060/audacious_money_production?sslmode=require"
```

**Verify it's set:**
```bash
echo $DATABASE_URL
```

### Step 4: Run Initial Schema Migration

Navigate to your backend directory:

```bash
cd C:/Users/Admin/graceful_books/audacious_money_backend
```

Run the migration script:

```bash
bash scripts/run-migrations.sh
```

**Expected output:**

```
🚀 Running database migrations...
📁 Found schema.sql (450 lines)
🔄 Applying schema...
CREATE TABLE
CREATE TABLE
CREATE TABLE
... (multiple CREATE TABLE statements)
✅ Migrations complete!
🔍 Verifying tables...
              List of relations
 Schema |        Name        | Type  |  Owner
--------+--------------------+-------+---------
 public | users              | table | doadmin
 public | products           | table | doadmin
 public | user_products      | table | doadmin
 public | charities          | table | doadmin
 ... (additional tables)
✅ Database setup complete!
```

### Step 5: Verify Tables Created

Connect to the database again:

```bash
psql "$DATABASE_URL"
```

Run verification queries:

```sql
-- List all tables
\dt

-- Check users table structure
\d users

-- Verify products are seeded (if seed data was included)
SELECT COUNT(*) FROM products;

-- Verify charities are seeded
SELECT COUNT(*) FROM charities;

-- Exit
\q
```

---

## Environment Variable Setup

### Step 1: Copy Production Environment Template

In your backend directory:

```bash
cd C:/Users/Admin/graceful_books/audacious_money_backend
cp .env.production.example .env.production
```

### Step 2: Update Database Connection

Edit `.env.production` and update the `DATABASE_URL`:

**Use the POOLED connection string from Section 7:**

```bash
DATABASE_URL=postgresql://doadmin:[PASSWORD]@[HOST]:25060/audacious_money_production?sslmode=require&pool=audacious-money-pool
```

### Step 3: Generate JWT Secret

Generate a secure JWT secret:

```bash
openssl rand -hex 32
```

Copy the output and paste it in `.env.production`:

```bash
JWT_SECRET=<your-generated-secret-here>
```

### Step 4: Update Other Variables

Fill in the remaining variables (some will be completed in later tasks):

```bash
# From Stripe dashboard (Task 6.3)
STRIPE_SECRET_KEY=sk_live_[YOUR_STRIPE_SECRET_KEY]
STRIPE_WEBHOOK_SECRET=[FROM_TASK_6.3]

# From SendGrid dashboard
SENDGRID_API_KEY=[YOUR_SENDGRID_API_KEY]
FROM_EMAIL=noreply@audacious.money

# Your production frontend URLs (Task 6.2)
APP_URL=https://app.audacious.money
ADMIN_URL=https://admin.audacious.money
ALLOWED_ORIGINS=https://app.audacious.money,https://admin.audacious.money
```

### Step 5: Secure the File

**CRITICAL:** Never commit `.env.production` to version control.

Verify it's in `.gitignore`:

```bash
grep ".env.production" .gitignore
```

If not present, add it:

```bash
echo ".env.production" >> .gitignore
```

---

## Testing & Verification

### Step 1: Run Connection Verification Script

From your backend directory:

```bash
bun run scripts/verify-db-connection.ts
```

**Expected output:**

```
🔍 Testing database connection...
📍 Host: db-postgresql-nyc3-12345-do-user-67890-0.x.db.ondigitalocean.com
✅ Basic connection successful
✅ Found 17 tables
📋 Tables: users, products, user_products, charities, user_charity_selections, payments, donations, affiliate_links, affiliate_clicks, affiliate_signups, admin_users, admin_sessions, admin_permissions, support_sessions, email_verification_tokens, password_reset_tokens, schema_migrations
✅ Users table accessible (0 users)
✅ Connection pool: 1 active, 0 idle
✅ All checks passed! Database is ready.
```

### Step 2: Test Write Permissions

Connect to the database and test insert:

```bash
psql "$DATABASE_URL"
```

```sql
-- Test insert (we'll delete this after)
INSERT INTO users (email, password_hash, first_name, last_name, support_key)
VALUES ('test@example.com', 'test_hash', 'Test', 'User', 'TEST-12345');

-- Verify
SELECT email, first_name, last_name FROM users WHERE email = 'test@example.com';

-- Clean up
DELETE FROM users WHERE email = 'test@example.com';

-- Verify deletion
SELECT COUNT(*) FROM users WHERE email = 'test@example.com';
-- Should return 0

\q
```

### Step 3: Test Connection Pool

The verification script already tested the connection pool, but you can manually verify:

```bash
psql "$DATABASE_URL"
```

```sql
-- Check connection pool status
SELECT
  count(*) as total_connections,
  count(*) FILTER (WHERE state = 'active') as active_connections,
  count(*) FILTER (WHERE state = 'idle') as idle_connections
FROM pg_stat_activity
WHERE datname = 'audacious_money_production';
```

**Expected:** Should show active connections from your pool.

---

## Security Checklist

Before considering setup complete, verify all security measures:

- [ ] **SSL/TLS enforced** - Connection string uses `sslmode=require`
- [ ] **Strong database password** - Auto-generated password saved in password manager
- [ ] **Firewall configured** - Trusted Sources allows only backend server and admin IPs
- [ ] **No public access** - `0.0.0.0/0` is NOT in Trusted Sources
- [ ] **Automated backups enabled** - Daily backups with 7-day retention minimum
- [ ] **Backup window set** - Configured to run during low-traffic hours
- [ ] **Connection pooling configured** - Using transaction mode with appropriate pool size
- [ ] **Database credentials never committed** - `.env.production` in `.gitignore`
- [ ] **CA certificate downloaded** - Saved securely for SSL verification
- [ ] **Connection verified** - Ran `verify-db-connection.ts` successfully

**Additional Security Best Practices:**

- [ ] **Enable two-factor authentication** on your Digital Ocean account
- [ ] **Use read-only replicas** for reporting/analytics (optional, can add later)
- [ ] **Monitor connection usage** - Set up alerts if connection count exceeds 80% of max
- [ ] **Review access logs regularly** - Check for unauthorized connection attempts
- [ ] **Rotate database password** - Schedule quarterly password rotation
- [ ] **Enable query logging** (for debugging only, disable in production for performance)

---

## Troubleshooting

### Problem: Cannot connect to database

**Error message:** `could not connect to server: Connection timed out`

**Solutions:**
1. Verify your IP is in Trusted Sources (see Section 5)
2. Check that you're using the correct hostname and port
3. Ensure your firewall isn't blocking outbound connections on port 25060
4. Try connecting from a different network (to rule out ISP blocking)

### Problem: SSL connection errors

**Error message:** `SSL connection has been closed unexpectedly`

**Solutions:**
1. Download the CA certificate from Digital Ocean (see Section 4, Step 2)
2. Place it in the correct location:
   - Windows: `C:\Users\[YourName]\.postgresql\ca-certificate.crt`
   - macOS/Linux: `~/.postgresql/ca-certificate.crt`
3. Update connection string to use `sslmode=require` or `sslmode=verify-full`
4. Verify PostgreSQL client supports SSL (update to latest version)

### Problem: Password authentication failed

**Error message:** `FATAL: password authentication failed for user "doadmin"`

**Solutions:**
1. Double-check the password (it's case-sensitive and may contain special characters)
2. Ensure there are no extra spaces when copying the password
3. Try resetting the password in Digital Ocean dashboard:
   - Go to Settings → Users & Databases → Reset Password
4. Make sure you're using username `doadmin`, not `postgres` or other

### Problem: Migration script fails partway through

**Error message:** `ERROR: relation "table_name" already exists`

**Solutions:**
1. This means some tables were created but not all
2. Check which tables exist: `psql "$DATABASE_URL" -c "\dt"`
3. Option A: Drop all tables and start over (if no data):
   ```sql
   DROP SCHEMA public CASCADE;
   CREATE SCHEMA public;
   ```
4. Option B: Modify the migration script to use `CREATE TABLE IF NOT EXISTS`
5. Re-run the migration script

### Problem: Connection pool not working

**Error message:** Slow queries or connection timeouts

**Solutions:**
1. Verify the pool was created: Check Connection Pools tab in Digital Ocean
2. Ensure you're using the POOLED connection string (has `&pool=` parameter)
3. Check pool size is appropriate for your workload:
   - Too small: Increase pool size
   - Too large: Decrease pool size (more isn't always better)
4. Verify pool mode is set to **Transaction** (not Session)

### Problem: Database running out of connections

**Error message:** `FATAL: sorry, too many clients already`

**Solutions:**
1. You've exceeded the max connections for your plan tier
2. Short-term fix: Upgrade to a larger plan with more connections
3. Long-term fix:
   - Ensure you're using connection pooling
   - Check for connection leaks in your application code
   - Reduce pool size to allow headroom for admin connections
4. Monitor connection usage in Digital Ocean dashboard

### Problem: Slow query performance

**Symptoms:** Queries taking longer than expected

**Solutions:**
1. Check database metrics in Digital Ocean dashboard:
   - CPU usage
   - Memory usage
   - Disk I/O
2. If metrics are high, consider upgrading to a larger plan
3. Check for missing indexes:
   ```sql
   SELECT schemaname, tablename, attname, n_distinct, correlation
   FROM pg_stats
   WHERE schemaname = 'public'
   ORDER BY tablename, attname;
   ```
4. Enable query logging temporarily to identify slow queries:
   - Digital Ocean dashboard → Settings → Database Configuration
   - Set `log_min_duration_statement = 1000` (logs queries over 1 second)
   - Review logs after a test period
   - **Remember to disable after debugging** (impacts performance)

### Problem: Need to connect from new IP address

**Scenario:** Your IP changed or you need to grant access to a team member

**Solutions:**
1. Go to Digital Ocean dashboard → Your database → Settings
2. Scroll to **Trusted Sources**
3. Click **Add Trusted Source**
4. Enter the new IP address
5. Add a descriptive note (e.g., "John's dev machine")
6. Click **Save**

### Problem: Backup restore fails

**Error message:** Various errors during restore process

**Solutions:**
1. Verify the backup is not corrupted:
   - Check backup date/time
   - Ensure backup completed successfully
2. Try restoring to a NEW cluster first (safer than overwriting existing)
3. If restore to new cluster works, your backup is good
4. If restoring to existing cluster, ensure:
   - Database is not actively being used
   - You have sufficient storage space
   - You're using the same PostgreSQL version

### Getting Help

If you encounter issues not covered here:

1. **Digital Ocean Support:**
   - Click "Support" in Digital Ocean dashboard
   - Submit a ticket with error details
   - Support response time depends on your plan tier

2. **PostgreSQL Documentation:**
   - https://www.postgresql.org/docs/15/
   - Comprehensive reference for PostgreSQL 15

3. **Audacious Money Team:**
   - Check internal documentation
   - Ask in team chat
   - Review previous deployment logs

---

## Next Steps

After completing this database setup:

1. **Task 6.2:** Deploy backend to Digital Ocean App Platform
   - You'll need to add the backend server IP to Trusted Sources
   - Configure environment variables in App Platform to use this database

2. **Task 6.3:** Configure Stripe webhooks
   - Webhooks will write payment data to this database

3. **Monitor database performance:**
   - Set up alerts for high CPU, memory, or connection usage
   - Review slow query logs periodically
   - Consider read replicas if read traffic grows

4. **Schedule regular maintenance:**
   - Review backup retention policy
   - Test restore process quarterly
   - Update PostgreSQL version when new releases are available
   - Rotate database password quarterly

---

## Summary

You've successfully:

- ✅ Created a PostgreSQL 15 managed database on Digital Ocean
- ✅ Configured SSL/TLS encryption for secure connections
- ✅ Set up firewall rules to restrict access
- ✅ Enabled automated daily backups
- ✅ Created a connection pool for better performance
- ✅ Ran database migrations to set up schema
- ✅ Verified the database is working correctly
- ✅ Secured database credentials in `.env.production`

Your database is now ready for the Audacious Money backend!

**Important Reminders:**

- Never commit `.env.production` to Git
- Store database password in a secure password manager
- Test backup restore process before you need it
- Monitor connection usage and set up alerts
- Add backend server IP to Trusted Sources after deploying (Task 6.2)

---

**Document Version:** 1.0
**Last Reviewed:** March 22, 2026
**Next Review:** June 22, 2026
