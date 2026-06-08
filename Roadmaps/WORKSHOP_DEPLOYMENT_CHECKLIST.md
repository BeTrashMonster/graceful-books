# Workshop System Deployment Checklist

**Version:** 1.0
**Created:** 2026-06-08
**System:** Educational Workshop System
**Status:** Pre-Deployment Planning

---

## Executive Summary

This checklist ensures complete and correct deployment of the Educational Workshop System across all environments (development, staging, production). Use this document as a step-by-step guide for deployment operations.

**Deployment Complexity:** Medium-High
**Estimated Deployment Time:** 2-4 hours (initial), 30 minutes (subsequent)
**Dependencies:** Database, Email Service (Postmark), Payment Service (Stripe), Frontend, Backend

---

## Pre-Deployment Checklist

### Code Readiness

- [ ] All code reviewed and approved (PR merged to main branch)
- [ ] All tests passing (frontend + backend)
  ```bash
  # Frontend tests
  npm test

  # Backend tests
  cd audacious_money_backend && npm test
  ```
- [ ] TypeScript compilation successful (no errors)
  ```bash
  # Frontend
  npm run build

  # Backend
  cd audacious_money_backend && npx tsc --noEmit
  ```
- [ ] Linting passes with no errors
  ```bash
  npm run lint
  cd audacious_money_backend && npm run lint
  ```
- [ ] No console.log or debugging code left in production code
  ```bash
  # Check for console.log statements
  grep -r "console\\.log" src/ audacious_money_backend/src/ --exclude-dir=node_modules
  ```
- [ ] Version numbers updated (package.json)
- [ ] Changelog updated with new features

### Documentation Review

- [ ] WORKSHOP_DATABASE_MIGRATION_PLAN.md reviewed
- [ ] WORKSHOP_FEATURE_ROLLOUT_PLAN.md reviewed
- [ ] WORKSHOP_MONITORING_GUIDE.md reviewed
- [ ] This deployment checklist reviewed
- [ ] API documentation updated (if applicable)
- [ ] User-facing documentation created (help articles, FAQs)

### Security Review

- [ ] No secrets/API keys hardcoded in source code
- [ ] All secrets stored in environment variables or secrets manager
- [ ] SQL queries use parameterized queries (no string concatenation)
- [ ] HTML email templates sanitized with DOMPurify
- [ ] Rate limiting implemented on public endpoints
- [ ] CSRF protection enabled
- [ ] CORS configured correctly (no `*` wildcard in production)
- [ ] Input validation on all user inputs (Zod schemas)
- [ ] Authentication required on admin endpoints
- [ ] Authorization checks on workshop enrollment endpoints

---

## Environment Variables Configuration

### Backend Environment Variables

**Location:** `audacious_money_backend/.env`

**Required Variables:**

```bash
# ============================================================================
# DATABASE CONFIGURATION
# ============================================================================
DATABASE_URL=postgresql://username:password@hostname:5432/database_name

# Example for production:
# DATABASE_URL=postgresql://prod_user:secure_pass@prod-db.example.com:5432/audacious_money

# Example for staging:
# DATABASE_URL=postgresql://stage_user:secure_pass@stage-db.example.com:5432/audacious_money_staging

# ============================================================================
# POSTMARK EMAIL SERVICE
# ============================================================================
POSTMARK_API_KEY=your-postmark-api-key-here
POSTMARK_FROM_EMAIL=noreply@audaciousmoney.com
POSTMARK_REPLY_TO_EMAIL=support@audaciousmoney.com

# Get API key from: https://account.postmarkapp.com/servers/[server-id]/credentials
# CRITICAL: Use different Postmark servers for staging/production
#   Staging: Use "Sandbox" server (free, doesn't send real emails)
#   Production: Use production server with verified sender domain

# ============================================================================
# STRIPE PAYMENT PROCESSING
# ============================================================================
STRIPE_SECRET_KEY=sk_test_... # For development/staging
# STRIPE_SECRET_KEY=sk_live_... # For production (DO NOT commit to git!)

STRIPE_PUBLISHABLE_KEY=pk_test_... # For development/staging
# STRIPE_PUBLISHABLE_KEY=pk_live_... # For production

STRIPE_WEBHOOK_SECRET=whsec_...
# Get from Stripe Dashboard → Developers → Webhooks → Add endpoint

# Product/Price IDs (create in Stripe Dashboard)
STRIPE_WORKSHOP_TRIAL_PRICE_ID=price_...  # $0 for trial period
STRIPE_WORKSHOP_MONTHLY_PRICE_ID=price_... # $25/month after trial

# ============================================================================
# FEATURE FLAGS
# ============================================================================
WORKSHOP_SYSTEM_ENABLED=false              # Master on/off switch
WORKSHOP_SIGNUP_ENABLED=false              # Public signup availability
WORKSHOP_EMAILS_ENABLED=false              # Email automation
WORKSHOP_TRIALS_ENABLED=false              # Trial management
WORKSHOP_ADMIN_ONLY=true                   # Restrict to admins only
WORKSHOP_CONVERSION_TRACKING_ENABLED=false # Analytics tracking

# ============================================================================
# APPLICATION SETTINGS
# ============================================================================
NODE_ENV=production                        # development | staging | production
PORT=3001                                  # Backend server port
API_BASE_URL=https://api.audaciousmoney.com # Backend API base URL

# CORS settings
CORS_ORIGIN=https://app.audaciousmoney.com # Frontend URL (comma-separated for multiple)
# CORS_ORIGIN=http://localhost:3006,https://app.audaciousmoney.com

# ============================================================================
# SESSION & SECURITY
# ============================================================================
SESSION_SECRET=generate-random-64-char-string-here
JWT_SECRET=generate-random-64-char-string-here

# Generate secure random strings:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# ============================================================================
# LOGGING
# ============================================================================
LOG_LEVEL=info                             # debug | info | warn | error
LOG_FORMAT=json                            # json | pretty

# ============================================================================
# RATE LIMITING (Optional - Redis recommended for production)
# ============================================================================
REDIS_URL=redis://localhost:6379          # For distributed rate limiting
# REDIS_URL=redis://:password@redis-host:6379/0

# ============================================================================
# MONITORING (Optional)
# ============================================================================
SENTRY_DSN=https://...@sentry.io/...      # Error tracking
APM_SERVICE_NAME=audacious-money-backend  # For APM tools
```

**Checklist:**
- [ ] All required variables are set
- [ ] Secrets are NOT hardcoded (use environment variables)
- [ ] Staging uses test/sandbox credentials
- [ ] Production uses live credentials
- [ ] Variables validated with deployment script

**Validation Script:**

```bash
# Create: audacious_money_backend/scripts/validate-env.sh
#!/bin/bash

REQUIRED_VARS=(
  "DATABASE_URL"
  "POSTMARK_API_KEY"
  "STRIPE_SECRET_KEY"
  "STRIPE_WEBHOOK_SECRET"
  "SESSION_SECRET"
  "JWT_SECRET"
)

for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    echo "❌ ERROR: $var is not set"
    exit 1
  else
    echo "✅ $var is set"
  fi
done

echo "✅ All required environment variables are set"
```

### Frontend Environment Variables

**Location:** `.env` (root of frontend project)

**Required Variables:**

```bash
# ============================================================================
# API CONFIGURATION
# ============================================================================
VITE_API_BASE_URL=https://api.audaciousmoney.com
# Development: http://localhost:3001
# Staging: https://api-staging.audaciousmoney.com
# Production: https://api.audaciousmoney.com

# ============================================================================
# STRIPE CONFIGURATION (Frontend)
# ============================================================================
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
# Production: pk_live_...

# ============================================================================
# FEATURE FLAGS (Optional - can query from backend instead)
# ============================================================================
VITE_WORKSHOP_SYSTEM_ENABLED=false

# ============================================================================
# ANALYTICS (Optional)
# ============================================================================
VITE_GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX    # Google Analytics 4
VITE_SENTRY_DSN=https://...@sentry.io/... # Frontend error tracking

# ============================================================================
# APPLICATION SETTINGS
# ============================================================================
VITE_APP_ENV=production                   # development | staging | production
VITE_APP_VERSION=1.0.0
```

**Checklist:**
- [ ] VITE_API_BASE_URL points to correct backend
- [ ] VITE_STRIPE_PUBLISHABLE_KEY matches environment (test vs live)
- [ ] No secrets included (frontend is public)
- [ ] Variables available in build process (all start with VITE_)

---

## Stripe Configuration

### Stripe Account Setup

**Prerequisites:**
- [ ] Stripe account created (https://dashboard.stripe.com/register)
- [ ] Business details filled out
- [ ] Bank account connected (for payouts)
- [ ] Identity verification completed (required for live mode)

### Create Products and Prices

**Product 1: Workshop Trial (Free)**

1. Navigate to: Stripe Dashboard → Products → Add Product
2. Name: "Workshop Trial"
3. Description: "Free trial period for workshop participants"
4. Pricing:
   - Type: Recurring
   - Price: $0.00
   - Billing period: Monthly
5. Save and copy Price ID → `STRIPE_WORKSHOP_TRIAL_PRICE_ID`

**Product 2: Workshop Subscription (Paid)**

1. Navigate to: Stripe Dashboard → Products → Add Product
2. Name: "Workshop Monthly Subscription"
3. Description: "Full platform access after trial"
4. Pricing:
   - Type: Recurring
   - Price: $25.00
   - Billing period: Monthly
5. Save and copy Price ID → `STRIPE_WORKSHOP_MONTHLY_PRICE_ID`

**Checklist:**
- [ ] Workshop Trial product created
- [ ] Workshop Subscription product created
- [ ] Price IDs copied to environment variables
- [ ] Test mode products created for staging
- [ ] Live mode products created for production

### Configure Webhooks

**Webhook Endpoint URL:**
- Staging: `https://api-staging.audaciousmoney.com/webhooks/stripe`
- Production: `https://api.audaciousmoney.com/webhooks/stripe`

**Setup Steps:**

1. Navigate to: Stripe Dashboard → Developers → Webhooks
2. Click "Add endpoint"
3. Enter endpoint URL
4. Select events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.trial_will_end`
5. Click "Add endpoint"
6. Copy "Signing secret" → `STRIPE_WEBHOOK_SECRET`

**Checklist:**
- [ ] Webhook endpoint created for staging
- [ ] Webhook endpoint created for production
- [ ] All required events selected
- [ ] Webhook secret stored in environment variables
- [ ] Webhook tested with Stripe CLI:
  ```bash
  stripe listen --forward-to localhost:3001/webhooks/stripe
  stripe trigger checkout.session.completed
  ```

### Test Stripe Integration

**Test Card Numbers:**
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- Requires authentication: `4000 0025 0000 3155`

**Test Scenarios:**
- [ ] Create workshop enrollment
- [ ] Start trial (subscription with trial period)
- [ ] Trial expires and converts to paid
- [ ] Payment succeeds
- [ ] Payment fails (test card decline)
- [ ] Subscription cancellation
- [ ] Webhook events received and processed

---

## Postmark Configuration

### Postmark Account Setup

**Prerequisites:**
- [ ] Postmark account created (https://account.postmarkapp.com/sign_up)
- [ ] Sender domain added (audaciousmoney.com)
- [ ] DNS records configured (SPF, DKIM, DMARC)
- [ ] Domain verified (green checkmark in Postmark)

### DNS Configuration

**Add these DNS records to your domain:**

**SPF Record:**
```
Type: TXT
Host: @
Value: v=spf1 include:spf.mtasv.net ~all
TTL: 3600
```

**DKIM Record:**
```
Type: TXT
Host: [provided by Postmark, e.g., "20240101._domainkey"]
Value: [provided by Postmark, long string]
TTL: 3600
```

**DMARC Record:**
```
Type: TXT
Host: _dmarc
Value: v=DMARC1; p=none; pct=100; rua=mailto:dmarc@audaciousmoney.com
TTL: 3600
```

**Return-Path Record:**
```
Type: CNAME
Host: pm-bounces
Value: pm.mtasv.net
TTL: 3600
```

**Verification:**
```bash
# Check SPF
dig TXT audaciousmoney.com +short

# Check DKIM
dig TXT 20240101._domainkey.audaciousmoney.com +short

# Check DMARC
dig TXT _dmarc.audaciousmoney.com +short
```

**Checklist:**
- [ ] SPF record added and verified
- [ ] DKIM record added and verified
- [ ] DMARC record added and verified
- [ ] Return-Path record added and verified
- [ ] Domain shows "Verified" in Postmark dashboard

### Create Postmark Servers

**Recommendation:** Separate servers for different environments

**Server 1: Staging/Development**
1. Server name: "Audacious Money - Staging"
2. Type: "Sandbox" (doesn't send real emails)
3. Copy API token → `POSTMARK_API_KEY` (staging)

**Server 2: Production**
1. Server name: "Audacious Money - Production"
2. Type: "Transactional"
3. Copy API token → `POSTMARK_API_KEY` (production)

**Checklist:**
- [ ] Staging server created (Sandbox)
- [ ] Production server created (Transactional)
- [ ] API tokens stored in environment variables
- [ ] From address configured: `noreply@audaciousmoney.com`
- [ ] Reply-to address configured: `support@audaciousmoney.com`

### Test Email Delivery

**Test sending an email:**

```bash
# Using Postmark API directly
curl -X POST "https://api.postmarkapp.com/email" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -H "X-Postmark-Server-Token: YOUR_SERVER_TOKEN" \
  -d '{
    "From": "noreply@audaciousmoney.com",
    "To": "test@example.com",
    "Subject": "Postmark Test",
    "TextBody": "This is a test email from Audacious Money workshop system.",
    "MessageStream": "outbound"
  }'
```

**Checklist:**
- [ ] Test email sent successfully
- [ ] Email received in inbox (not spam)
- [ ] Sender shows correct name/email
- [ ] Reply-to works correctly
- [ ] Email renders correctly in Gmail
- [ ] Email renders correctly in Outlook
- [ ] Email renders correctly on mobile

---

## Database Configuration

### Database Connection Settings

**Production Database Specifications:**
- PostgreSQL version: 14.x or higher
- Required extensions: `uuid-ossp`, `pg_stat_statements`
- Encoding: UTF8
- Timezone: UTC
- Connection pooling: Recommended (e.g., PgBouncer)

**Connection String Format:**
```
postgresql://username:password@hostname:5432/database_name?sslmode=require
```

**Checklist:**
- [ ] Database server running PostgreSQL 14+
- [ ] Database created: `audacious_money` (production) or `audacious_money_staging` (staging)
- [ ] Database user created with appropriate privileges
- [ ] SSL/TLS enabled for connections (`sslmode=require`)
- [ ] Connection pool configured (max connections: 20-50)
- [ ] Backup schedule configured (daily recommended)
- [ ] Point-in-time recovery enabled

### Database User Privileges

**Required privileges:**

```sql
-- Create database user
CREATE USER workshop_app_user WITH PASSWORD 'secure_random_password';

-- Grant necessary privileges
GRANT CONNECT ON DATABASE audacious_money TO workshop_app_user;
GRANT USAGE ON SCHEMA public TO workshop_app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO workshop_app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO workshop_app_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO workshop_app_user;

-- For future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO workshop_app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO workshop_app_user;
```

**Checklist:**
- [ ] Database user created
- [ ] Privileges granted
- [ ] Connection tested from application server
- [ ] Connection pooling configured

### Database Performance Tuning

**Recommended PostgreSQL settings (postgresql.conf):**

```conf
# Memory settings (adjust based on server RAM)
shared_buffers = 256MB              # 25% of RAM
effective_cache_size = 1GB          # 50-75% of RAM
work_mem = 16MB
maintenance_work_mem = 128MB

# Connection settings
max_connections = 100               # Adjust based on load

# Query planning
random_page_cost = 1.1              # For SSD storage
effective_io_concurrency = 200      # For SSD storage

# Logging
log_min_duration_statement = 1000   # Log queries > 1 second
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
log_checkpoints = on
log_connections = on
log_disconnections = on
log_lock_waits = on

# Performance monitoring
shared_preload_libraries = 'pg_stat_statements'
pg_stat_statements.track = all
```

**Checklist:**
- [ ] PostgreSQL settings tuned for workload
- [ ] `pg_stat_statements` extension enabled
- [ ] Slow query logging enabled (> 1 second)
- [ ] Connection limits appropriate for server

---

## Frontend Build and Deployment

### Build Process

**Build frontend for production:**

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build for production
npm run build

# Output directory: dist/
# Verify build output:
ls -lh dist/

# Expected output: index.html, assets/ folder with JS/CSS bundles
```

**Build Optimization Checklist:**
- [ ] Dead code elimination (tree shaking) enabled
- [ ] Code splitting configured (separate vendor bundle)
- [ ] CSS minification enabled
- [ ] Image optimization enabled
- [ ] Gzip/Brotli compression enabled
- [ ] Source maps generated (for debugging, but not served to users)
- [ ] Environment variables embedded in build

### Static File Hosting

**Option 1: Serve from Backend (Simple)**

```bash
# Backend serves static files from dist/
# Configure in Hono app.ts:
app.use('/*', serveStatic({ root: '../dist' }))
```

**Option 2: CDN/Object Storage (Recommended for Production)**

**Using AWS S3 + CloudFront:**

1. Create S3 bucket: `audacious-money-app`
2. Upload dist/ contents to S3
3. Configure bucket for static website hosting
4. Create CloudFront distribution pointing to S3
5. Configure custom domain: `app.audaciousmoney.com`

**Using Netlify/Vercel (Easiest):**

1. Connect GitHub repository
2. Configure build command: `npm run build`
3. Configure publish directory: `dist/`
4. Add environment variables
5. Deploy automatically on git push

**Checklist:**
- [ ] Static files hosted on CDN or web server
- [ ] Custom domain configured (app.audaciousmoney.com)
- [ ] SSL certificate installed (HTTPS)
- [ ] Cache headers configured (immutable for hashed assets)
- [ ] 404 fallback to index.html (for client-side routing)

### DNS Configuration for Frontend

**DNS Records:**

```
Type: A or CNAME
Host: app
Value: [CDN distribution URL or server IP]
TTL: 3600

Type: CNAME
Host: www
Value: app.audaciousmoney.com
TTL: 3600
```

**Checklist:**
- [ ] DNS A/CNAME record points to hosting provider
- [ ] SSL certificate valid (check https://app.audaciousmoney.com)
- [ ] HTTP redirects to HTTPS
- [ ] www redirects to non-www (or vice versa)

---

## Backend Build and Deployment

### Backend Deployment Options

**Option 1: Traditional Server (VPS, EC2)**

**Deployment steps:**

```bash
# SSH to server
ssh user@server-ip

# Clone repository
git clone https://github.com/yourorg/graceful_books.git
cd graceful_books/audacious_money_backend

# Install dependencies
npm install --production

# Set up environment variables
cp .env.example .env
nano .env  # Edit with production values

# Run database migrations
npm run migrate:up

# Build TypeScript (if needed)
npm run build

# Start application with process manager
pm2 start src/index.ts --name audacious-money-backend --interpreter tsx
pm2 save
pm2 startup  # Configure auto-start on reboot
```

**Checklist:**
- [ ] Application running on server
- [ ] Process manager configured (PM2, systemd)
- [ ] Auto-restart on crash enabled
- [ ] Auto-start on server reboot enabled
- [ ] Logs being written to file
- [ ] Reverse proxy configured (Nginx, Caddy)

**Nginx Configuration Example:**

```nginx
server {
  listen 80;
  server_name api.audaciousmoney.com;

  # Redirect HTTP to HTTPS
  return 301 https://$server_name$request_uri;
}

server {
  listen 443 ssl http2;
  server_name api.audaciousmoney.com;

  # SSL configuration
  ssl_certificate /etc/letsencrypt/live/api.audaciousmoney.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/api.audaciousmoney.com/privkey.pem;

  # Security headers
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
  add_header X-Frame-Options "SAMEORIGIN" always;
  add_header X-Content-Type-Options "nosniff" always;

  # Proxy to Node.js backend
  location / {
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;

    # Timeouts
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
  }

  # Rate limiting
  limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
  limit_req zone=api_limit burst=20 nodelay;
}
```

**Option 2: Container Deployment (Docker)**

**Dockerfile:**

```dockerfile
# audacious_money_backend/Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --production

# Copy source code
COPY . .

# Expose port
EXPOSE 3001

# Start application
CMD ["npm", "start"]
```

**Docker Compose:**

```yaml
# docker-compose.yml
version: '3.8'

services:
  backend:
    build: ./audacious_money_backend
    ports:
      - "3001:3001"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - POSTMARK_API_KEY=${POSTMARK_API_KEY}
      - STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
    restart: unless-stopped
    depends_on:
      - postgres

  postgres:
    image: postgres:14-alpine
    environment:
      - POSTGRES_DB=audacious_money
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  postgres_data:
```

**Checklist:**
- [ ] Docker image builds successfully
- [ ] Container runs without errors
- [ ] Environment variables passed to container
- [ ] Volumes configured for data persistence
- [ ] Health check configured
- [ ] Container restarts on failure

**Option 3: Platform as a Service (Railway, Render, Heroku)**

**Deployment steps (Railway example):**

1. Connect GitHub repository
2. Select backend directory: `audacious_money_backend`
3. Add environment variables in Railway dashboard
4. Configure build command: `npm install && npm run build`
5. Configure start command: `npm start`
6. Add PostgreSQL plugin
7. Deploy

**Checklist:**
- [ ] Platform connected to repository
- [ ] Environment variables configured
- [ ] Database provisioned
- [ ] Auto-deploy on git push enabled
- [ ] Custom domain configured

---

## Routing Configuration

### Workshop Routes

**Routes to configure:**

| Route | Handler | Purpose |
|-------|---------|---------|
| `/workshops/:slug` | Frontend (React Router) | Workshop signup page |
| `/workshops/:slug/thank-you` | Frontend | Post-signup thank you page |
| `/workshops/:slug/countdown` | Frontend | Pre-workshop countdown page |
| `/admin/workshops` | Frontend | Admin workshop management |
| `/admin/workshops/create` | Frontend | Create new workshop |
| `/admin/workshops/:id/edit` | Frontend | Edit workshop |
| `/api/workshops` | Backend (Hono) | Workshop CRUD endpoints |
| `/api/workshops/:slug/enroll` | Backend | Enrollment endpoint |
| `/api/workshops/health` | Backend | Health check endpoint |

**Frontend Routing (React Router):**

**Update `src/App.tsx`:**

```tsx
import WorkshopSignup from './pages/WorkshopSignup';
import WorkshopThankYou from './pages/WorkshopThankYou';
import WorkshopCountdown from './pages/WorkshopCountdown';

// In Routes configuration:
<Route path="/workshops/:slug" element={<WorkshopSignup />} />
<Route path="/workshops/:slug/thank-you" element={<WorkshopThankYou />} />
<Route path="/workshops/:slug/countdown" element={<WorkshopCountdown />} />
```

**Backend Routing (Hono):**

**Update `audacious_money_backend/src/app.ts`:**

```typescript
import workshops from './routes/workshops.js';

// Register workshop routes
app.route('/api/workshops', workshops);
```

**Checklist:**
- [ ] Frontend routes configured in App.tsx
- [ ] Backend routes registered in app.ts
- [ ] Route parameters working (`:slug`, `:id`)
- [ ] 404 handling configured (fallback to index.html)
- [ ] Deep linking works (refresh on /workshops/:slug loads correctly)

---

## SSL Certificate Configuration

### Option 1: Let's Encrypt (Free, Auto-Renew)

**Install Certbot:**

```bash
# Ubuntu/Debian
sudo apt-get install certbot python3-certbot-nginx

# CentOS/RHEL
sudo yum install certbot python3-certbot-nginx
```

**Obtain Certificate:**

```bash
# For app.audaciousmoney.com
sudo certbot --nginx -d app.audaciousmoney.com

# For api.audaciousmoney.com
sudo certbot --nginx -d api.audaciousmoney.com

# Auto-renewal (cron job)
sudo certbot renew --dry-run
```

**Checklist:**
- [ ] Certbot installed
- [ ] Certificates obtained for all domains
- [ ] Nginx configured to use certificates
- [ ] Auto-renewal tested (dry run successful)
- [ ] Cron job configured for auto-renewal

### Option 2: Cloudflare (Free SSL + CDN)

**Setup steps:**

1. Add domain to Cloudflare
2. Update nameservers to Cloudflare
3. Enable "Full (Strict)" SSL mode
4. Configure page rules for caching
5. Enable "Always Use HTTPS"

**Checklist:**
- [ ] Domain added to Cloudflare
- [ ] Nameservers updated
- [ ] SSL mode: Full (Strict)
- [ ] HTTPS enforcement enabled
- [ ] HSTS enabled

### SSL Verification

**Test SSL configuration:**

```bash
# Check certificate validity
openssl s_client -connect app.audaciousmoney.com:443 -servername app.audaciousmoney.com

# Test with SSL Labs
# Visit: https://www.ssllabs.com/ssltest/analyze.html?d=app.audaciousmoney.com
# Goal: A or A+ rating
```

**Checklist:**
- [ ] SSL certificate valid and trusted
- [ ] SSL Labs grade: A or A+
- [ ] HTTPS redirect working (HTTP → HTTPS)
- [ ] Mixed content warnings resolved
- [ ] HSTS header present

---

## CORS Configuration

### Backend CORS Settings

**In `audacious_money_backend/src/app.ts`:**

```typescript
import { cors } from 'hono/cors';

// CORS configuration
app.use('/*', cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3006'],
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length', 'X-Request-ID'],
  maxAge: 86400, // 24 hours
}));
```

**Environment-Specific CORS:**

```bash
# Development
CORS_ORIGIN=http://localhost:3006

# Staging
CORS_ORIGIN=https://app-staging.audaciousmoney.com

# Production
CORS_ORIGIN=https://app.audaciousmoney.com

# Multiple origins (comma-separated)
CORS_ORIGIN=https://app.audaciousmoney.com,https://www.audaciousmoney.com
```

**Checklist:**
- [ ] CORS origin matches frontend domain
- [ ] Credentials enabled (for cookies/sessions)
- [ ] Allowed methods include all used by frontend
- [ ] Preflight requests (OPTIONS) handled correctly
- [ ] No `*` wildcard in production

### CORS Testing

**Test CORS configuration:**

```bash
# Preflight request (OPTIONS)
curl -X OPTIONS https://api.audaciousmoney.com/workshops \
  -H "Origin: https://app.audaciousmoney.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v

# Expected headers in response:
# Access-Control-Allow-Origin: https://app.audaciousmoney.com
# Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
# Access-Control-Allow-Headers: Content-Type, Authorization
# Access-Control-Allow-Credentials: true
```

**Checklist:**
- [ ] Preflight requests return correct headers
- [ ] Actual requests include CORS headers
- [ ] Credentials (cookies) sent/received correctly
- [ ] Frontend can make API calls without CORS errors

---

## Rate Limiting Configuration

### Rate Limiter Setup

**Option 1: In-Memory (Development/Staging)**

**In `audacious_money_backend/src/middleware/rateLimit.ts`:**

```typescript
import { rateLimiter } from 'hono-rate-limiter';

export const workshopRateLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  keyGenerator: (c) => c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown',
});

export const signupRateLimiter = rateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 signups per hour
  message: 'Too many signup attempts, please try again later.',
});
```

**Option 2: Redis-Based (Production)**

```typescript
import { RedisStore } from 'rate-limit-redis';
import { createClient } from 'redis';

const redisClient = createClient({
  url: process.env.REDIS_URL,
});
await redisClient.connect();

export const workshopRateLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:workshop:',
  }),
});
```

**Apply Rate Limiting:**

```typescript
// In workshops.ts routes
import { workshopRateLimiter, signupRateLimiter } from '../middleware/rateLimit.js';

// Apply to all workshop routes
workshops.use('*', workshopRateLimiter);

// Stricter limit on enrollment endpoint
workshops.post('/:slug/enroll', signupRateLimiter, async (c) => {
  // ... enrollment logic
});
```

**Checklist:**
- [ ] Rate limiter configured
- [ ] Redis connection configured (production)
- [ ] Rate limits appropriate for endpoints
- [ ] Rate limit headers included in response
- [ ] Rate limit bypass for internal/admin requests (optional)

---

## Deployment Commands

### Staging Deployment

```bash
# ============================================================================
# STAGING DEPLOYMENT
# ============================================================================

# 1. Ensure on correct branch
git checkout staging  # or main if deploying from main

# 2. Pull latest code
git pull origin staging

# 3. Install dependencies
npm install
cd audacious_money_backend && npm install && cd ..

# 4. Run tests
npm test
cd audacious_money_backend && npm test && cd ..

# 5. Build frontend
npm run build

# 6. Build backend (if needed)
cd audacious_money_backend && npm run build && cd ..

# 7. Run database migrations (staging database)
cd audacious_money_backend
export DATABASE_URL="postgresql://stage_user:pass@stage-db:5432/audacious_money_staging"
npm run migrate:up
cd ..

# 8. Deploy frontend (upload to staging CDN/server)
# Example: AWS S3
aws s3 sync dist/ s3://audacious-money-staging --delete

# 9. Deploy backend (restart staging server)
# Example: PM2
pm2 restart audacious-money-backend-staging

# 10. Verify deployment
curl https://api-staging.audaciousmoney.com/workshops/health
# Expected: {"status":"healthy"}

# 11. Smoke test
# Visit https://app-staging.audaciousmoney.com
# Test workshop signup flow
```

### Production Deployment

```bash
# ============================================================================
# PRODUCTION DEPLOYMENT
# ============================================================================

# CRITICAL: Create database backup FIRST!
pg_dump -h prod-db-host -U prod_user -d audacious_money > "backup_pre_deploy_$(date +%Y%m%d_%H%M%S).sql"

# 1. Ensure on correct branch
git checkout main

# 2. Pull latest code (already reviewed and approved)
git pull origin main

# 3. Install dependencies
npm install
cd audacious_money_backend && npm install && cd ..

# 4. Run tests (should already be passing, but verify)
npm test
cd audacious_money_backend && npm test && cd ..

# 5. Build frontend
npm run build

# 6. Build backend
cd audacious_money_backend && npm run build && cd ..

# 7. Run database migrations
# See WORKSHOP_DATABASE_MIGRATION_PLAN.md for detailed steps
cd audacious_money_backend
export DATABASE_URL="$PRODUCTION_DATABASE_URL"
npm run migrate:up
cd ..

# 8. Deploy frontend
aws s3 sync dist/ s3://audacious-money-app --delete
aws cloudfront create-invalidation --distribution-id E123ABC --paths "/*"

# 9. Deploy backend
# Option A: PM2 (zero-downtime restart)
pm2 reload audacious-money-backend

# Option B: Docker
docker-compose -f docker-compose.prod.yml up -d --build

# Option C: Systemd
sudo systemctl reload audacious-money-backend

# 10. Verify health check
curl https://api.audaciousmoney.com/workshops/health
# Expected: {"status":"healthy"}

# 11. Monitor logs for 15 minutes
pm2 logs audacious-money-backend --lines 100

# 12. Smoke test production
# Visit https://app.audaciousmoney.com
# Test critical paths (signup, login, workshop enrollment)

# 13. Monitor metrics
# Check error rates, response times, email deliverability
```

---

## Post-Deployment Verification

### Automated Tests

**Run post-deployment tests:**

```bash
# Health check
curl https://api.audaciousmoney.com/workshops/health | jq

# Workshop list (public)
curl https://api.audaciousmoney.com/api/workshops | jq

# Create workshop (admin - requires auth)
curl -X POST https://api.audaciousmoney.com/api/workshops \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cohortName":"Test Workshop","slug":"test-2026",...}'

# Enroll in workshop
curl -X POST https://api.audaciousmoney.com/api/workshops/test-2026/enroll \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json"
```

**Checklist:**
- [ ] Health check returns "healthy"
- [ ] API endpoints respond without errors
- [ ] Database queries execute successfully
- [ ] Email service responds (test email sent)
- [ ] Stripe API accessible
- [ ] Frontend loads without errors
- [ ] JavaScript console shows no errors
- [ ] CSS/images load correctly

### Manual Testing

**Critical paths to test:**

1. **Workshop Signup Flow**
   - [ ] Visit `/workshops/test-slug`
   - [ ] Complete signup form
   - [ ] Receive welcome email
   - [ ] See thank you page
   - [ ] Enrollment recorded in database

2. **Admin Workshop Creation**
   - [ ] Login as admin
   - [ ] Navigate to `/admin/workshops/create`
   - [ ] Fill out workshop form
   - [ ] Customize email templates
   - [ ] Save workshop
   - [ ] Workshop appears in list

3. **Trial and Access Control**
   - [ ] User logs in before access grant time
   - [ ] Sees countdown page
   - [ ] Access grant time passes (or manually set to past)
   - [ ] User refreshes and sees full platform

4. **Email Automation**
   - [ ] Welcome email received within 1 minute of signup
   - [ ] Email formatting correct (emojis, rich text)
   - [ ] Links in email work
   - [ ] Unsubscribe link works (if applicable)

5. **Payment Flow**
   - [ ] Trial expires (or manually set to past)
   - [ ] User sees upgrade prompt
   - [ ] User clicks "Subscribe"
   - [ ] Stripe checkout loads
   - [ ] Test payment succeeds
   - [ ] User status updated to "converted"

### Performance Testing

**Measure response times:**

```bash
# API response time
curl -w "@curl-format.txt" -o /dev/null -s https://api.audaciousmoney.com/api/workshops

# Where curl-format.txt contains:
# time_namelookup:  %{time_namelookup}\n
# time_connect:  %{time_connect}\n
# time_starttransfer:  %{time_starttransfer}\n
# time_total:  %{time_total}\n
```

**Target metrics:**
- API response time (p50): < 500ms
- API response time (p95): < 2s
- Frontend load time: < 2s
- Database query time: < 100ms

**Checklist:**
- [ ] Response times meet targets
- [ ] No slow queries (> 1s) in database logs
- [ ] Frontend Lighthouse score > 90
- [ ] No memory leaks observed (monitor over 1 hour)

---

## Rollback Procedure

### When to Rollback

**Rollback if any of these occur:**
- Critical functionality broken (signups failing)
- High error rate (> 10%)
- Database migration failed
- Security vulnerability discovered
- Payment processing broken

### Quick Rollback (Code Only)

```bash
# 1. Identify last known good commit
git log --oneline -10

# 2. Revert to previous version
git revert <commit-hash>
# OR
git reset --hard <last-good-commit-hash>

# 3. Rebuild and redeploy
npm run build
cd audacious_money_backend && npm run build

# 4. Redeploy (use same commands as deployment)
pm2 reload audacious-money-backend

# 5. Verify rollback successful
curl https://api.audaciousmoney.com/workshops/health
```

### Full Rollback (Code + Database)

```bash
# 1. Disable workshop system immediately
# Option A: Feature flag
psql $DATABASE_URL -c "UPDATE feature_flags SET enabled = false WHERE flag_name = 'WORKSHOP_SYSTEM_ENABLED';"

# Option B: Environment variable (requires restart)
export WORKSHOP_SYSTEM_ENABLED=false
pm2 restart audacious-money-backend

# 2. Rollback database migration
cd audacious_money_backend
npm run migrate:down

# 3. Restore from backup (if migration rollback failed)
# See WORKSHOP_DATABASE_MIGRATION_PLAN.md for detailed steps
psql $DATABASE_URL < backup_pre_deploy_20260608_140000.sql

# 4. Rollback code (see above)

# 5. Notify team and users
# Post on status page: "Workshop system temporarily disabled for maintenance"
```

**Checklist:**
- [ ] Issue severity assessed
- [ ] Rollback decision made by tech lead
- [ ] Feature flag disabled OR code reverted
- [ ] Database migration rolled back (if needed)
- [ ] System verified functional after rollback
- [ ] Team notified
- [ ] Users notified (if outage was public)
- [ ] Post-mortem scheduled

---

## Monitoring and Alerts Setup

### Enable Monitoring

**See WORKSHOP_MONITORING_GUIDE.md for detailed setup**

**Quick checklist:**
- [ ] Health check endpoint responding
- [ ] Uptime monitoring configured (UptimeRobot, Pingdom)
- [ ] Error tracking configured (Sentry)
- [ ] Log aggregation configured (CloudWatch, Logtail)
- [ ] APM configured (New Relic, Datadog) - optional
- [ ] Alerts configured for critical metrics
- [ ] On-call rotation established (if applicable)

### Post-Launch Monitoring

**Monitor these metrics closely for first 48 hours:**

- Error rate (target: < 1%)
- API response time (target: < 2s p95)
- Email deliverability (target: > 90%)
- Signup conversion rate (track baseline)
- Database connection pool usage (target: < 70%)
- Memory/CPU usage (target: < 80%)

**Daily check for first week:**
- Review error logs
- Check email bounce/spam rates
- Verify trial expirations processing correctly
- Monitor conversion rates
- Review user feedback/support tickets

---

## Team Checklist

### Roles and Responsibilities

**Before deployment, assign:**

- [ ] **Deployment Lead:** Executes deployment commands, monitors progress
- [ ] **Database Administrator:** Runs migrations, verifies database health
- [ ] **QA Engineer:** Runs post-deployment tests, verifies functionality
- [ ] **DevOps Engineer:** Monitors infrastructure, handles rollback if needed
- [ ] **Product Owner:** Approves deployment, makes go/no-go decision
- [ ] **Support Lead:** Monitors user feedback, handles support tickets
- [ ] **On-Call Engineer:** Available for emergencies during/after deployment

### Communication Plan

**Before deployment:**
- [ ] Notify team 24 hours in advance (Slack, email)
- [ ] Schedule deployment window (low-traffic time recommended)
- [ ] Post maintenance notice on status page (if downtime expected)
- [ ] Prepare rollback plan

**During deployment:**
- [ ] Live updates in Slack deployment channel
- [ ] Status updates every 15 minutes
- [ ] Escalation path defined if issues arise

**After deployment:**
- [ ] Success announcement in team Slack
- [ ] Post-deployment report (what worked, what didn't)
- [ ] Schedule post-mortem (within 48 hours)

---

## Final Checklist

### Pre-Deployment

- [ ] All code merged to main branch
- [ ] All tests passing (CI/CD green)
- [ ] Security review completed
- [ ] Database backup created
- [ ] Environment variables configured
- [ ] Stripe/Postmark accounts configured
- [ ] DNS records configured
- [ ] SSL certificates valid
- [ ] Team notified
- [ ] Deployment window scheduled

### Deployment

- [ ] Database migration executed successfully
- [ ] Frontend built and deployed
- [ ] Backend built and deployed
- [ ] Health check responding
- [ ] Post-deployment tests passed
- [ ] Manual smoke tests passed
- [ ] Performance metrics acceptable
- [ ] No critical errors in logs

### Post-Deployment

- [ ] Monitoring configured
- [ ] Alerts configured
- [ ] Team notified of successful deployment
- [ ] Status page updated
- [ ] Documentation updated
- [ ] Post-deployment report created
- [ ] Post-mortem scheduled

---

**End of Deployment Checklist**

*Last Updated: 2026-06-08*
*For: Educational Workshop System (Sprint 8, Phase 8)*
*Previous: WORKSHOP_MONITORING_GUIDE.md*
