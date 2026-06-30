# Audacious Money - Deployment Guide

> Step-by-step deployment to Digital Ocean + Cloudflare

## Infrastructure Overview

```
HOSTING BREAKDOWN:

Cloudflare Pages (Static Hosting):
├─ audacious.money              → Marketing site (Astro)
└─ app.audacious.money          → React app (static build)

Digital Ocean App Platform:
├─ api.audacious.money          → Business Backend (Bun + Hono)
└─ sync.audacious.money         → Sync Relay (Bun WebSocket)

Digital Ocean Managed Database:
└─ PostgreSQL 15                → Business database

Optional:
└─ admin.audacious.money        → Admin Dashboard (Cloudflare Pages OR Digital Ocean)
```

---

## Prerequisites

### 1. Accounts Needed
- [ ] Digital Ocean account
- [ ] Cloudflare account (already have)
- [ ] Stripe account
- [ ] Postmark account (for emails)
- [ ] GitHub account (for repo hosting)

### 2. Domain Configuration
- [ ] Domain registered: audacious.money (already done)
- [ ] DNS managed by Cloudflare (already done)

### 3. Development Tools
- [ ] Bun installed locally (`curl -fsSL https://bun.sh/install | bash`)
- [ ] Git installed
- [ ] Digital Ocean CLI (`doctl`) installed (optional)

---

## Part 1: Database Setup (Digital Ocean Managed PostgreSQL)

### Step 1.1: Create PostgreSQL Database

**Via Digital Ocean Dashboard:**

1. Log into Digital Ocean
2. Navigate to "Databases" → "Create Database"
3. Configuration:
   - **Database Engine:** PostgreSQL 15
   - **Datacenter:** Choose closest to your users (e.g., SFO3, NYC3)
   - **Database Configuration:** Basic ($15/month to start)
     - 1 GB RAM, 1 vCPU, 10 GB disk
   - **Database Name:** `audacious_money_prod`
   - **Tags:** production, audacious-money

4. Click "Create Database Cluster"
5. Wait 3-5 minutes for provisioning

### Step 1.2: Configure Database

**Connection Info (save these securely):**
```
Host: db-postgresql-sfo3-xxxxx.ondigitalocean.com
Port: 25060
Database: audacious_money_prod
User: doadmin
Password: [generated password]
SSL Mode: require
```

**Create `.env` file locally:**
```bash
DATABASE_URL=postgresql://doadmin:[password]@db-postgresql-sfo3-xxxxx.ondigitalocean.com:25060/audacious_money_prod?sslmode=require
```

### Step 1.3: Run Database Migrations

**Option A: Using SQL file directly**

```bash
# Connect to database
psql $DATABASE_URL

# Run schema
\i src/db/schema.sql

# Verify tables created
\dt
```

**Option B: Using migration tool (Kysely)**

```bash
# In backend repo
cd audacious_money_backend

# Install dependencies
bun install

# Run migrations
bun run migrate
```

### Step 1.4: Seed Initial Data

```sql
-- Connect to database
psql $DATABASE_URL

-- Insert initial charities (5 to start)
INSERT INTO charities (name, short_description, ein, website, active) VALUES
  ('One Tree Planted', 'Global reforestation nonprofit planting trees in 80+ countries', '46-4664562', 'https://onetreeplanted.org', true),
  ('The Ocean Cleanup', 'Developing technology to remove plastic from oceans', '82-2606143', 'https://theoceancleanup.com', true),
  ('Rainforest Trust', 'Protecting endangered rainforests worldwide', '13-3500609', 'https://www.rainforesttrust.org', true),
  ('Cool Earth', 'Working with rainforest communities to halt deforestation', 'UK-1089101', 'https://www.coolearth.org', true),
  ('Eden Reforestation Projects', 'Employing locals to plant millions of trees annually', '47-2081836', 'https://www.edenprojects.org', true);

-- Insert products (prices match your structure)
-- (See ROADMAPS_DATABASE.md for full product insert statements)

-- Create first admin user
INSERT INTO admin_users (email, password_hash, first_name, last_name, role, active) VALUES
  ('admin@audacious.money', '[bcrypt_hash_of_password]', 'Admin', 'User', 'super_admin', true);
```

**Generate admin password hash:**
```bash
# Using Bun
bun run -e "console.log(await Bun.password.hash('YourSecurePassword123!'))"
```

---

## Part 2: Business Backend Deployment (Digital Ocean App Platform)

### Step 2.1: Prepare Backend Repository

**Repository structure:**
```
audacious_money_backend/
├── src/
│   ├── index.ts           # Entry point
│   ├── app.ts             # Hono app
│   ├── routes/            # API routes
│   ├── services/          # Business logic
│   ├── db/                # Database client
│   └── middleware/        # Middleware
├── Dockerfile             # For Digital Ocean
├── package.json
├── bunfig.toml
├── .env.example
└── README.md
```

**Create `Dockerfile`:**

```dockerfile
FROM oven/bun:latest

WORKDIR /app

# Copy package files
COPY package.json bun.lockb ./

# Install dependencies
RUN bun install --production

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start server
CMD ["bun", "run", "start"]
```

**Update `package.json`:**

```json
{
  "name": "audacious-money-backend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "bun run --watch src/index.ts",
    "start": "bun run src/index.ts",
    "migrate": "bun run src/db/migrate.ts"
  },
  "dependencies": {
    "hono": "^4.0.0",
    "stripe": "^14.0.0",
    "postgres": "^3.4.0",
    "zod": "^3.22.0",
    "@hono/node-server": "^1.8.0"
  }
}
```

### Step 2.2: Deploy to Digital Ocean App Platform

**Via GitHub Integration (Recommended):**

1. Push code to GitHub:
```bash
git init
git add .
git commit -m "Initial backend setup"
git remote add origin https://github.com/yourusername/audacious-money-backend.git
git push -u origin main
```

2. Digital Ocean Dashboard:
   - Navigate to "Apps" → "Create App"
   - Select "GitHub" as source
   - Choose repository: `audacious-money-backend`
   - Branch: `main`

3. Configure App:
   - **Name:** audacious-money-api
   - **Region:** Same as database (e.g., SFO3)
   - **Build Command:** `bun install`
   - **Run Command:** `bun run start`
   - **Dockerfile Path:** `/Dockerfile`
   - **HTTP Port:** 3000
   - **Plan:** Basic ($5/month to start)

4. Add Environment Variables:
   ```
   DATABASE_URL=[from database connection]
   STRIPE_SECRET_KEY=[from Stripe dashboard]
   STRIPE_WEBHOOK_SECRET=[from Stripe webhook setup]
   JWT_SECRET=[generate with: openssl rand -hex 32]
   APP_URL=https://app.audacious.money
   POSTMARK_SERVER_TOKEN=[from Postmark]
   NODE_ENV=production
   ```

5. Custom Domain:
   - Add custom domain: `api.audacious.money`
   - Digital Ocean provides instructions for DNS
   - Add CNAME in Cloudflare:
     ```
     Type: CNAME
     Name: api
     Target: [app-name].ondigitalocean.app
     Proxy: DNS only (grey cloud)
     ```

6. Deploy:
   - Click "Create Resources"
   - Wait for build (~3-5 minutes)
   - Check logs for errors

### Step 2.3: Verify Backend Deployment

```bash
# Test health endpoint
curl https://api.audacious.money/health

# Expected response:
# {"status":"healthy","database":"connected","stripe":"configured"}

# Test public endpoint
curl https://api.audacious.money/products

# Should return list of products
```

---

## Part 3: Sync Relay Deployment

### Step 3.1: Prepare Sync Relay Repository

**Repository structure:**
```
audacious_money_sync/
├── src/
│   ├── index.ts           # WebSocket server entry
│   ├── handlers/          # Connection, sync, broadcast
│   └── types/             # Type definitions
├── Dockerfile
├── package.json
└── README.md
```

**Create `Dockerfile`:**

```dockerfile
FROM oven/bun:latest

WORKDIR /app

COPY package.json bun.lockb ./
RUN bun install --production

COPY . .

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

CMD ["bun", "run", "start"]
```

**`src/index.ts` (simplified):**

```typescript
import { ServerWebSocket } from "bun";

const server = Bun.serve({
  port: 8080,
  fetch(req, server) {
    const url = new URL(req.url);

    // Health check
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "healthy" }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // Upgrade to WebSocket
    if (url.pathname === "/sync") {
      const upgraded = server.upgrade(req);
      if (!upgraded) {
        return new Response("WebSocket upgrade failed", { status: 400 });
      }
      return undefined;
    }

    return new Response("Not found", { status: 404 });
  },
  websocket: {
    message(ws, message) {
      // Handle encrypted sync data
      // Broadcast to user's other devices
      console.log("Received encrypted sync data");
    },
    open(ws) {
      console.log("WebSocket connection opened");
    },
    close(ws) {
      console.log("WebSocket connection closed");
    }
  }
});

console.log(`Sync relay running on ${server.hostname}:${server.port}`);
```

### Step 3.2: Deploy Sync Relay

**Same process as backend:**

1. Push to GitHub
2. Digital Ocean Apps → Create App
3. Configure:
   - **Name:** audacious-money-sync
   - **Region:** Same as backend/database
   - **HTTP Port:** 8080
   - **Custom Domain:** sync.audacious.money

4. Environment Variables:
   ```
   DATABASE_URL=[from database - for device tracking]
   NODE_ENV=production
   ```

5. Deploy and verify:
```bash
# Test WebSocket connection
wscat -c wss://sync.audacious.money/sync
```

---

## Part 4: Frontend Deployment (Cloudflare Pages)

### Step 4.1: Marketing Site (Astro)

**Already set up at:** `audacious_money_marketing/`

**Deploy to Cloudflare Pages:**

1. Cloudflare Dashboard → Pages → "Create a project"
2. Connect GitHub repo: `audacious_money_marketing`
3. Build settings:
   - **Build command:** `npm run build`
   - **Build output:** `dist`
   - **Node version:** 18
4. Custom domain: `audacious.money`
5. Deploy

### Step 4.2: React App (Graceful Books / Main App)

**Current repo:** `graceful_books/`

**Build for production:**

```bash
cd graceful_books

# Update .env.production
echo "VITE_API_URL=https://api.audacious.money" > .env.production
echo "VITE_SYNC_URL=wss://sync.audacious.money" >> .env.production
echo "VITE_STRIPE_PUBLIC_KEY=pk_live_xxxx" >> .env.production

# Build
npm run build
```

**Deploy to Cloudflare Pages:**

1. Cloudflare Pages → Create project
2. Connect GitHub: `graceful_books`
3. Build settings:
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Build output:** `dist`
4. Environment variables:
   ```
   VITE_API_URL=https://api.audacious.money
   VITE_SYNC_URL=wss://sync.audacious.money
   VITE_STRIPE_PUBLIC_KEY=pk_live_xxxx
   ```
5. Custom domain: `app.audacious.money`
6. Deploy

---

## Part 5: Stripe Configuration

### Step 5.1: Create Products in Stripe

**Stripe Dashboard → Products:**

1. Create each product:
   - Budgeting Tool - $10/month
   - Debt Management - $20/month
   - Service Provider Management - $30/month
   - CPG/Distributor Management - $30/month
   - CPU Calculator - $5/product (metered)
   - Bookkeeping Suite - $40/month
   - Fractional CFO - $60/month

2. For each product, note the `price_id` (e.g., `price_xxxxx`)

3. Update database:
```sql
UPDATE products SET stripe_price_id = 'price_xxxxx' WHERE slug = 'budgeting';
-- Repeat for all products
```

### Step 5.2: Configure Webhooks

**Stripe Dashboard → Developers → Webhooks:**

1. Add endpoint: `https://api.audacious.money/stripe/webhook`
2. Select events:
   - `checkout.session.completed`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.deleted`
   - `customer.subscription.updated`
3. Note webhook signing secret
4. Add to Digital Ocean environment variables:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_xxxxx
   ```

### Step 5.3: Test Webhook

```bash
# Install Stripe CLI
stripe login

# Forward webhooks to local (for testing)
stripe listen --forward-to https://api.audacious.money/stripe/webhook

# Trigger test event
stripe trigger checkout.session.completed
```

---

## Part 6: Email Configuration (Postmark)

### Step 6.1: Postmark Setup

1. Create Postmark account at https://postmarkapp.com
2. Create a new server (or use Default Server)
3. Get Server API token from API Tokens tab
4. Add to Digital Ocean environment variables:
   ```
   POSTMARK_SERVER_TOKEN=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   POSTMARK_FROM_EMAIL=noreply@audacious.money
   POSTMARK_FROM_NAME=Audacious Money
   ```

### Step 6.2: Verify Domain

**Postmark → Sender Signatures → Domains:**

1. Click "Add Domain"
2. Enter: `audacious.money`
3. Postmark provides DNS records to add
4. Add DNS records to Cloudflare:
   ```
   Type: TXT
   Name: 20240320._domainkey.audacious.money
   Value: k=rsa; p=MIGfMA0GCSqGSIb3DQEBA... (from Postmark)
   Proxy: DNS only (grey cloud)

   Type: CNAME
   Name: pm-bounces.audacious.money
   Target: pm.mtasv.net
   Proxy: DNS only (grey cloud)
   ```

5. Click "Verify" in Postmark (may take a few minutes)
6. Once verified, you can send from any @audacious.money address

### Step 6.3: Email Templates

**No external templates needed!**

Email templates are built into the code at:
`audacious_money_backend/src/services/email.service.ts`

All emails include:
- Welcome email
- Trial started
- Trial ending soon (7 days before)
- Payment failed
- Subscription cancelled
- Password reset
- Email verification

To customize: Edit the HTML/text in email.service.ts

---

## Part 7: SSL & Security

### Step 7.1: SSL Certificates

**Cloudflare (automatic):**
- audacious.money - Auto SSL
- app.audacious.money - Auto SSL

**Digital Ocean (automatic):**
- api.audacious.money - Auto SSL
- sync.audacious.money - Auto SSL

### Step 7.2: Security Headers

**Cloudflare Pages Settings → Add headers:**

```
# Headers for app.audacious.money
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

### Step 7.3: CORS Configuration

**Backend (`src/app.ts`):**

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

app.use('/*', cors({
  origin: [
    'https://audacious.money',
    'https://app.audacious.money',
    'https://admin.audacious.money'
  ],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length', 'X-Request-Id'],
  maxAge: 600,
  credentials: true
}));
```

---

## Part 8: Monitoring & Logging

### Step 8.1: Digital Ocean Monitoring

**Enable for each app:**
- CPU usage alerts (>80% for 5 min)
- Memory usage alerts (>80%)
- Error rate alerts (>5% 5xx responses)

### Step 8.2: Application Logging

**Backend logging:**

```typescript
// Simple console logging (Digital Ocean captures)
console.log('[INFO]', 'User signed up:', userId);
console.error('[ERROR]', 'Payment failed:', error);

// For production, consider structured logging:
import pino from 'pino';
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label })
  }
});
```

### Step 8.3: Uptime Monitoring

**Options:**
- UptimeRobot (free tier)
- Pingdom
- Digital Ocean monitoring (built-in)

**Endpoints to monitor:**
- https://api.audacious.money/health
- https://app.audacious.money
- https://audacious.money

---

## Part 9: Backup Strategy

### Step 9.1: Database Backups

**Digital Ocean Managed PostgreSQL:**
- Automatic daily backups (included)
- Point-in-time recovery (7 days)
- Manual backup before major changes:
  ```bash
  pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql
  ```

### Step 9.2: Code Backups

- Git repository (GitHub) - automatic
- Tag releases:
  ```bash
  git tag -a v1.0.0 -m "Production release 1.0.0"
  git push origin v1.0.0
  ```

---

## Part 10: Go Live Checklist

### Pre-Launch

- [ ] All environment variables set
- [ ] Database migrations run
- [ ] Initial data seeded (charities, products)
- [ ] Stripe products created
- [ ] Stripe webhook configured
- [ ] Postmark domain verified
- [ ] Email service tested
- [ ] SSL certificates active
- [ ] CORS configured
- [ ] Monitoring enabled
- [ ] Backup strategy in place

### Testing

- [ ] User signup flow (end-to-end)
- [ ] Payment processing (test mode)
- [ ] Trial expiration (adjust dates for testing)
- [ ] Password reset
- [ ] Email delivery
- [ ] Admin dashboard login
- [ ] Support session creation
- [ ] Affiliate tracking
- [ ] Discount codes

### Launch

- [ ] Switch Stripe to live mode
- [ ] Update Stripe keys in environment
- [ ] Test live payment
- [ ] Monitor logs for 24 hours
- [ ] Announce launch!

---

## Maintenance

### Daily
- Check error logs
- Monitor payment failures
- Review trial conversions

### Weekly
- Review analytics
- Process affiliate payouts
- Check charity donations owed

### Monthly
- Generate charity payout report
- Review database performance
- Update dependencies
- Security audit

---

## Rollback Plan

**If deployment fails:**

1. **Backend/Sync Relay:**
   - Digital Ocean Apps → Previous deployment → "Rollback"
   - Or: Push previous commit to main branch

2. **Frontend:**
   - Cloudflare Pages → Deployments → Previous build → "Rollback"

3. **Database:**
   - Restore from backup:
     ```bash
     psql $DATABASE_URL < backup-20260320.sql
     ```

---

## Cost Estimate (Monthly)

```
Digital Ocean:
├─ PostgreSQL (Basic)     $15/month
├─ App Platform (Backend) $5/month
└─ App Platform (Sync)    $5/month
                          -------
                          $25/month

Cloudflare Pages:         $0 (free tier sufficient)

Stripe:                   $0 base + 2.9% + 30¢ per transaction

Postmark:                 $0 (free tier: 100 emails/month)
                          OR $15/month (10,000 emails)

Total Infrastructure:     ~$25-40/month to start
```

---

## Scaling Plan

**When you hit 1,000 users:**
- Upgrade PostgreSQL to Standard ($60/month)
- Upgrade App Platform to Pro ($12/month each)
- Consider CDN for static assets

**When you hit 10,000 users:**
- Multiple app instances for high availability
- Redis for caching
- Dedicated monitoring (Datadog, New Relic)

---

**Last Updated:** 2026-03-20
