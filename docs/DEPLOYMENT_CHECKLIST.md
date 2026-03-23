# Deployment Checklist

Comprehensive pre-deployment, deployment, and post-deployment checklist for Audacious Money backend and sync relay on Digital Ocean App Platform.

---

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Backend API Deployment Steps](#backend-api-deployment-steps)
3. [Sync Relay Deployment Steps](#sync-relay-deployment-steps)
4. [Post-Deployment Verification](#post-deployment-verification)
5. [Rollback Procedures](#rollback-procedures)
6. [Emergency Contacts](#emergency-contacts)

---

## Pre-Deployment Checklist

Complete these items before starting deployment.

### Code Preparation

- [ ] **Code pushed to GitHub** - All changes committed and pushed to `main` branch
- [ ] **Tests passing locally** - Run `bun test` and verify all tests pass
- [ ] **Build successful locally** - Run `bun run build` (if applicable) without errors
- [ ] **Linting clean** - Run `bun run lint` and fix all warnings
- [ ] **Dependencies up to date** - Run `bun update` and test
- [ ] **No console.log statements** - Remove or replace with proper logging
- [ ] **Environment variables documented** - All required vars listed in `.env.example`

### Database Preparation

- [ ] **Database created** - Completed Task 6.1 successfully
- [ ] **Connection pool URL obtained** - Saved from Task 6.1 output
- [ ] **Database schema migrated** - All migrations run successfully
- [ ] **Seed data loaded** - Products and default data inserted
- [ ] **Database backup created** - Manual backup before deployment
- [ ] **Connection tested** - Can connect from local machine with connection pool URL
- [ ] **SSL mode enabled** - URL includes `?sslmode=require`
- [ ] **Firewall configured** - Your IP whitelisted for testing

### Secrets and Keys

- [ ] **JWT_SECRET generated** - Run `openssl rand -hex 32` and save output
- [ ] **Stripe production keys obtained** - Live mode keys from Stripe Dashboard
  - [ ] Secret key: `sk_live_...`
  - [ ] Publishable key: `pk_live_...`
- [ ] **SendGrid API key created** - Full Access key from SendGrid Dashboard
- [ ] **Secrets stored securely** - Use password manager (1Password, LastPass, etc.)
- [ ] **Old secrets rotated** - Never reuse development secrets in production
- [ ] **Backup secrets stored** - Keep encrypted backup of all production secrets

### Domain and DNS

- [ ] **Domain registered** - `audacious.money` (or your domain) active
- [ ] **Cloudflare account active** - Domain using Cloudflare nameservers
- [ ] **DNS access verified** - Can create CNAME records
- [ ] **Email working** - Can receive emails at domain (for SSL verification)
- [ ] **Subdomains planned** - Know which subdomains to use:
  - `api.audacious.money` - Backend API
  - `sync.audacious.money` - Sync relay
  - `app.audacious.money` - Frontend (Task 5.2)
  - `admin.audacious.money` - Admin panel (Task 5.2)

### Digital Ocean Account

- [ ] **Account created** - Active Digital Ocean account
- [ ] **Billing configured** - Valid payment method added
- [ ] **Billing alerts set** - Notifications for $50, $100, $200 spending
- [ ] **GitHub connected** - Authorized Digital Ocean to access GitHub
- [ ] **CLI installed** (optional) - `doctl` for command-line management
- [ ] **Team access configured** (if applicable) - All team members invited

### Documentation Review

- [ ] **Read deployment guide** - `DIGITAL_OCEAN_APP_DEPLOYMENT.md` reviewed
- [ ] **Backend app.yaml reviewed** - `audacious_money_backend/.do/app.yaml`
- [ ] **Sync app.yaml reviewed** - `audacious_money_sync/.do/app.yaml`
- [ ] **Database setup guide available** - `DIGITAL_OCEAN_DATABASE_SETUP.md`
- [ ] **Production build guide available** - `PRODUCTION_BUILD_CONFIGURATION.md`

### Communication Preparation

- [ ] **Team notified** - All team members aware of deployment
- [ ] **Maintenance window scheduled** (if replacing existing system)
- [ ] **User notification prepared** (if downtime expected)
- [ ] **Rollback plan reviewed** - Know how to revert if needed
- [ ] **Support team briefed** - Know how to handle deployment-related issues

---

## Backend API Deployment Steps

Follow these steps in order for backend deployment.

### Step 1: Create App in Digital Ocean

- [ ] Navigate to Digital Ocean dashboard
- [ ] Click **Apps** in left sidebar
- [ ] Click **Create App** button
- [ ] Select **GitHub** as source provider
- [ ] Authorize Digital Ocean to access GitHub (if first time)
- [ ] Select repository: `[YOUR_USERNAME]/audacious-money`
- [ ] Select branch: `main`
- [ ] Click **Next**

### Step 2: Configure Service Detection

- [ ] Verify Digital Ocean detected **Web Service**
- [ ] If not detected, click **Edit** to configure manually
- [ ] Set resource type to **Web Service**
- [ ] Click **Next**

### Step 3: Configure Backend Service

- [ ] Set name: `audacious-money-api`
- [ ] Set source directory: `/audacious_money_backend`
- [ ] Set build command: `bun install`
- [ ] Set run command: `bun run src/index.ts`
- [ ] Set HTTP port: `3001`
- [ ] Set instance size: **Basic (512MB)** for development, **Professional-XS (1GB)** for production
- [ ] Set instance count: `1` (or `2-3` for production high availability)
- [ ] Click **Next**

### Step 4: Add Environment Variables

Add each variable with correct type (Plain or Secret):

**Plain Variables:**
- [ ] `NODE_ENV` = `production`
- [ ] `PORT` = `3001`
- [ ] `APP_URL` = `https://app.audacious.money`
- [ ] `ADMIN_URL` = `https://admin.audacious.money`
- [ ] `ALLOWED_ORIGINS` = `https://app.audacious.money,https://admin.audacious.money`
- [ ] `ARGON2_MEMORY_COST` = `65536`
- [ ] `ARGON2_TIME_COST` = `3`
- [ ] `ARGON2_PARALLELISM` = `4`
- [ ] `RATE_LIMIT_WINDOW_MS` = `60000`
- [ ] `RATE_LIMIT_MAX_REQUESTS` = `100`
- [ ] `RATE_LIMIT_AUTH_MAX` = `5`

**Secret Variables:**
- [ ] `DATABASE_URL` = [connection-pool-url from Task 6.1] (type: SECRET)
- [ ] `JWT_SECRET` = [generated with openssl rand -hex 32] (type: SECRET)
- [ ] `STRIPE_SECRET_KEY` = [sk_live_... from Stripe] (type: SECRET)
- [ ] `STRIPE_WEBHOOK_SECRET` = [leave blank for now] (type: SECRET)
- [ ] `SENDGRID_API_KEY` = [SG.... from SendGrid] (type: SECRET)

- [ ] **CRITICAL:** Verify `DATABASE_URL` ends with `?sslmode=require`
- [ ] **CRITICAL:** Save JWT_SECRET - will need for sync relay
- [ ] Click **Save** (required!)
- [ ] Click **Next**

### Step 5: Configure Custom Domain

- [ ] Click **Add Domain**
- [ ] Enter domain: `api.audacious.money`
- [ ] Click **Add Domain**
- [ ] Note the CNAME target: `[app-name].ondigitalocean.app`
- [ ] Leave Digital Ocean tab open
- [ ] Open Cloudflare in new tab

**In Cloudflare:**
- [ ] Select `audacious.money` domain
- [ ] Click **DNS**
- [ ] Click **Add record**
- [ ] Type: `CNAME`
- [ ] Name: `api`
- [ ] Target: `[app-name].ondigitalocean.app` (from Digital Ocean)
- [ ] Proxy status: **DNS only** (gray cloud)
- [ ] TTL: Auto
- [ ] Click **Save**

**Back in Digital Ocean:**
- [ ] Enable **Force HTTPS** for `api.audacious.money`
- [ ] Click **Next**

### Step 6: Configure Health Checks

- [ ] HTTP Path: `/health`
- [ ] Initial Delay: `30` seconds
- [ ] Period: `10` seconds
- [ ] Timeout: `5` seconds
- [ ] Success Threshold: `1`
- [ ] Failure Threshold: `3`
- [ ] Click **Next**

### Step 7: Configure Auto-Deploy

- [ ] Enable **Auto-deploy**: ON
- [ ] Branch: `main`
- [ ] Deploy on push: Enabled
- [ ] Deploy on PR: Disabled
- [ ] Click **Next**

### Step 8: Configure Alerts

- [ ] Add notification email
- [ ] Add Slack webhook (optional)
- [ ] Enable alerts for:
  - [ ] Deployment Failed
  - [ ] Deployment Succeeded
  - [ ] Domain Failed
  - [ ] Alert Triggered
- [ ] Click **Next**

### Step 9: Review and Deploy

- [ ] Review all settings on summary page
- [ ] Verify environment variables (expand to check)
- [ ] Verify domain configuration
- [ ] Click **Create Resources**

### Step 10: Monitor Deployment

- [ ] Watch deployment progress (3-5 minutes)
- [ ] Monitor **Runtime Logs** tab for:
  - [ ] `Starting deployment...`
  - [ ] `Installing dependencies...`
  - [ ] `✓ bun install completed`
  - [ ] `Starting service...`
  - [ ] `✓ Server listening on port 3001`
  - [ ] `✓ Health check passed`
  - [ ] `Deployment successful!`

### Step 11: Wait for SSL Certificate

- [ ] Wait 5-10 minutes for SSL provisioning
- [ ] Check **Domains** tab
- [ ] Verify `api.audacious.money` shows **Active** with green checkmark
- [ ] If stuck in **Pending**, check:
  - [ ] DNS propagation (use `dig api.audacious.money CNAME`)
  - [ ] Cloudflare proxy disabled (gray cloud)
  - [ ] Email verification not required

### Step 12: Get Outbound IP Addresses

- [ ] Go to app **Settings** tab
- [ ] Scroll to **App-Level Information**
- [ ] Find **Outbound IP Addresses**
- [ ] Copy all IP addresses (2-3 IPs)
- [ ] Save for database firewall configuration (later step)

---

## Sync Relay Deployment Steps

Follow these steps for sync relay deployment.

### Step 1: Create Sync App

- [ ] Go to Digital Ocean Apps dashboard
- [ ] Click **Create App** button
- [ ] Select **GitHub** as source
- [ ] Select same repository: `[YOUR_USERNAME]/audacious-money`
- [ ] Select branch: `main`
- [ ] Click **Next**

### Step 2: Configure Sync Service

- [ ] Set name: `audacious-money-sync`
- [ ] Set source directory: `/audacious_money_sync`
- [ ] Set build command: `bun install`
- [ ] Set run command: `bun run src/index.ts`
- [ ] Set HTTP port: `8080`
- [ ] Set instance size: **Basic (512MB)**
- [ ] Set instance count: `1`
- [ ] Click **Next**

### Step 3: Add Environment Variables

**Plain Variables:**
- [ ] `NODE_ENV` = `production`
- [ ] `PORT` = `8080`

**Secret Variables:**
- [ ] `DATABASE_URL` = [SAME as backend - copy exact value] (type: SECRET)
- [ ] `JWT_SECRET` = [SAME as backend - CRITICAL: must match exactly] (type: SECRET)

- [ ] **CRITICAL:** Verify `DATABASE_URL` matches backend exactly
- [ ] **CRITICAL:** Verify `JWT_SECRET` matches backend exactly
- [ ] Click **Save**
- [ ] Click **Next**

### Step 4: Configure Custom Domain

- [ ] Click **Add Domain**
- [ ] Enter domain: `sync.audacious.money`
- [ ] Click **Add Domain**
- [ ] Note CNAME target

**In Cloudflare:**
- [ ] Add new DNS record
- [ ] Type: `CNAME`
- [ ] Name: `sync`
- [ ] Target: `[sync-app-name].ondigitalocean.app`
- [ ] Proxy status: **DNS only** (gray cloud)
- [ ] TTL: Auto
- [ ] Click **Save**

**Back in Digital Ocean:**
- [ ] Enable **Force HTTPS** for `sync.audacious.money`
- [ ] Click **Next**

### Step 5: Configure Health Checks

- [ ] HTTP Path: `/health`
- [ ] Initial Delay: `30` seconds
- [ ] Period: `10` seconds
- [ ] Timeout: `5` seconds
- [ ] Success Threshold: `1`
- [ ] Failure Threshold: `3`
- [ ] Click **Next**

### Step 6: Configure Auto-Deploy and Alerts

- [ ] Enable **Auto-deploy**: ON
- [ ] Branch: `main`
- [ ] Add notification email
- [ ] Enable same alerts as backend
- [ ] Click **Next**

### Step 7: Review and Deploy

- [ ] Review all settings
- [ ] **DOUBLE-CHECK:** JWT_SECRET matches backend
- [ ] Click **Create Resources**

### Step 8: Monitor Deployment

- [ ] Watch deployment progress
- [ ] Monitor **Runtime Logs**
- [ ] Verify successful deployment
- [ ] Wait for SSL certificate (5-10 minutes)
- [ ] Verify domain shows **Active**

### Step 9: Get Outbound IP Addresses

- [ ] Go to sync app **Settings** tab
- [ ] Find **Outbound IP Addresses**
- [ ] Copy all IP addresses
- [ ] Save for database firewall configuration

---

## Post-Deployment Verification

Complete all verification steps to ensure deployment success.

### Database Firewall Configuration

- [ ] Open Digital Ocean dashboard
- [ ] Go to **Databases**
- [ ] Select `audacious-money-db`
- [ ] Click **Settings** tab
- [ ] Scroll to **Trusted Sources**
- [ ] Click **Edit**

**Add Backend IPs:**
- [ ] Click **Add source**
- [ ] Type: **IP Address**
- [ ] Enter first backend IP
- [ ] Note: `Backend App (api.audacious.money)`
- [ ] Click **Add**
- [ ] Repeat for each backend IP

**Add Sync IPs:**
- [ ] Click **Add source**
- [ ] Type: **IP Address**
- [ ] Enter first sync IP
- [ ] Note: `Sync Relay (sync.audacious.money)`
- [ ] Click **Add**
- [ ] Repeat for each sync IP

- [ ] Click **Save**
- [ ] Wait 30 seconds for changes to propagate

### Backend API Verification

**Health Check:**
- [ ] Test: `curl https://api.audacious.money/health`
- [ ] Verify HTTP 200 response
- [ ] Verify JSON: `{"status": "healthy", "database": "connected"}`

**CORS Test:**
- [ ] Test: `curl -H "Origin: https://app.audacious.money" -X OPTIONS https://api.audacious.money/api/auth/signup`
- [ ] Verify `Access-Control-Allow-Origin` header present
- [ ] Verify header value: `https://app.audacious.money`

**Database Connection Test:**
- [ ] Test: `curl -X POST https://api.audacious.money/api/auth/check-email -H "Content-Type: application/json" -d '{"email":"test@example.com"}'`
- [ ] Verify HTTP 200 response
- [ ] Verify database query executed successfully

**Authentication Test:**
- [ ] Test: `curl https://api.audacious.money/api/user/profile`
- [ ] Verify HTTP 401 response
- [ ] Verify error: `{"error": {"code": "UNAUTHORIZED"}}`

**SSL/HTTPS Test:**
- [ ] Open in browser: `https://api.audacious.money/health`
- [ ] Verify green padlock icon
- [ ] Click padlock → View certificate
- [ ] Verify certificate issuer: Let's Encrypt
- [ ] Verify certificate valid and not expired

**Logs Review:**
- [ ] Open backend app → **Runtime Logs**
- [ ] Verify no errors in last 10 minutes
- [ ] Verify database connection messages
- [ ] Verify health check requests logging

### Sync Relay Verification

**Health Check:**
- [ ] Test: `curl https://sync.audacious.money/health`
- [ ] Verify HTTP 200 response
- [ ] Verify JSON: `{"status": "healthy", "connections": 0}`

**WebSocket Connection Test:**
- [ ] Create test HTML file (see deployment guide)
- [ ] Open in browser
- [ ] Verify connection status: "✅ Connected!"
- [ ] Open browser DevTools → Network → WS tab
- [ ] Verify WebSocket connection established
- [ ] Verify connection shows `wss://sync.audacious.money`

**SSL/WSS Test:**
- [ ] Verify WebSocket uses `wss://` (not `ws://`)
- [ ] Verify certificate same as domain (Let's Encrypt)
- [ ] Verify no SSL warnings in browser console

**Logs Review:**
- [ ] Open sync app → **Runtime Logs**
- [ ] Verify no errors
- [ ] Verify WebSocket server started
- [ ] Verify health check requests

### Integration Testing

**Frontend → Backend:**
- [ ] Test API call from frontend app
- [ ] Verify CORS working
- [ ] Verify response received
- [ ] Verify no console errors

**Frontend → Sync:**
- [ ] Test WebSocket connection from frontend
- [ ] Verify connection established
- [ ] Verify can send/receive messages
- [ ] Verify authentication flow

**Backend → Database:**
- [ ] Create test user via API
- [ ] Verify user created in database
- [ ] Query user via API
- [ ] Verify data retrieved correctly

**End-to-End Flow:**
- [ ] Sign up new user
- [ ] Verify user in database
- [ ] Login user
- [ ] Verify JWT issued
- [ ] Connect to sync with JWT
- [ ] Verify sync authenticated
- [ ] Make data change
- [ ] Verify change synced
- [ ] Verify change persisted in database

### Monitoring and Alerts

**Metrics Verification:**
- [ ] Backend app → **Metrics** tab
- [ ] Verify CPU usage < 50%
- [ ] Verify Memory usage < 70%
- [ ] Verify Request rate showing data
- [ ] Verify Response time < 500ms average

**Sync Metrics:**
- [ ] Sync app → **Metrics** tab
- [ ] Verify CPU usage < 30%
- [ ] Verify Memory usage < 50%
- [ ] Verify metrics updating

**Alert Configuration:**
- [ ] Backend app → **Alerts** tab
- [ ] Verify alerts created:
  - [ ] High CPU (>80%)
  - [ ] High Memory (>90%)
  - [ ] App Crash
  - [ ] Deployment Failed
- [ ] Repeat for sync app

**Test Alert:**
- [ ] Trigger test alert (optional)
- [ ] Verify email received
- [ ] Verify Slack notification (if configured)

### Security Verification

- [ ] **Environment variables encrypted** - Digital Ocean dashboard shows "Secret" type
- [ ] **JWT_SECRET unique to production** - Not reused from development
- [ ] **Stripe keys are live mode** - Keys start with `sk_live_` (not `sk_test_`)
- [ ] **Database uses SSL** - Connection string includes `?sslmode=require`
- [ ] **HTTPS enforced** - HTTP requests redirect to HTTPS
- [ ] **CORS configured correctly** - Only allowed origins permitted
- [ ] **Health checks responding** - Both apps show "Healthy" status
- [ ] **Auto-deploy on main only** - Feature branches don't auto-deploy
- [ ] **Database firewall active** - Only app IPs whitelisted
- [ ] **No secrets in logs** - Review logs for exposed passwords/keys
- [ ] **Error messages sanitized** - No stack traces sent to clients
- [ ] **Rate limiting enabled** - Test by sending rapid requests

### Performance Verification

**Backend Performance:**
- [ ] Test response time: < 200ms for simple endpoints
- [ ] Test database query time: < 100ms for simple queries
- [ ] Test concurrent requests: 50 simultaneous = no errors
- [ ] Test health check latency: < 50ms

**Sync Performance:**
- [ ] Test WebSocket connection time: < 500ms to establish
- [ ] Test message latency: < 100ms round-trip
- [ ] Test concurrent connections: 50 clients = no drops
- [ ] Test connection stability: 5 minutes = no disconnects

**Database Performance:**
- [ ] Check connection pool status
- [ ] Verify pool has available connections
- [ ] Verify no connection timeout errors
- [ ] Test query performance via API

### Documentation Updates

- [ ] Update internal wiki with deployment date
- [ ] Document production URLs:
  - [ ] `https://api.audacious.money` - Backend API
  - [ ] `https://sync.audacious.money` - Sync relay
- [ ] Document environment variable locations (Digital Ocean dashboard)
- [ ] Update team communication with deployment success
- [ ] Create deployment changelog entry
- [ ] Update status page (if applicable)

---

## Rollback Procedures

If deployment fails or critical issues arise, follow these rollback procedures.

### Immediate Rollback (App Platform)

**Scenario:** New deployment has critical bug

**Steps:**
1. [ ] Open Digital Ocean dashboard → Apps
2. [ ] Select affected app (backend or sync)
3. [ ] Click **Deployments** tab
4. [ ] Find previous successful deployment
5. [ ] Click **•••** (three dots) → **Rollback**
6. [ ] Confirm rollback
7. [ ] Wait 2-3 minutes for rollback to complete
8. [ ] Verify app health: `curl https://api.audacious.money/health`
9. [ ] Monitor logs for errors
10. [ ] Notify team of rollback

**Rollback time:** 3-5 minutes

### Environment Variable Rollback

**Scenario:** Wrong environment variable value

**Steps:**
1. [ ] Open app → **Settings** → **Environment Variables**
2. [ ] Find incorrect variable
3. [ ] Click **Edit**
4. [ ] Restore previous value (check password manager backup)
5. [ ] Click **Save**
6. [ ] Manually trigger new deployment (changes don't auto-deploy)
7. [ ] Wait for deployment to complete
8. [ ] Verify issue resolved

**Rollback time:** 5-7 minutes

### Database Rollback

**Scenario:** Database migration caused issues

**Steps:**
1. [ ] Connect to database: `psql [DATABASE_URL]`
2. [ ] Run migration rollback: `\i migrations/rollback/XXX_rollback.sql`
3. [ ] Verify schema state: `\dt` (list tables)
4. [ ] Exit: `\q`
5. [ ] Redeploy app with previous migration version
6. [ ] Verify app connects successfully
7. [ ] Test critical functionality

**Rollback time:** 10-15 minutes

### Full System Rollback

**Scenario:** Complete deployment failure

**Steps:**
1. [ ] Rollback backend deployment (see Immediate Rollback)
2. [ ] Rollback sync deployment (see Immediate Rollback)
3. [ ] Restore database from backup:
   - [ ] Digital Ocean → Databases → Backups
   - [ ] Select backup from before deployment
   - [ ] Click **Restore**
   - [ ] Wait 5-10 minutes
4. [ ] Update database connection string if database restored to new instance
5. [ ] Test all systems
6. [ ] Notify team and users (if downtime occurred)

**Rollback time:** 15-25 minutes

### Rollback Decision Tree

```
Issue detected
    │
    ├─ App crash / won't start
    │  → Immediate rollback (3-5 min)
    │
    ├─ Wrong environment variable
    │  → Environment variable rollback (5-7 min)
    │
    ├─ Database migration issue
    │  → Database rollback (10-15 min)
    │
    ├─ Multiple systems failing
    │  → Full system rollback (15-25 min)
    │
    └─ Minor bug, not critical
       → Fix forward (deploy fix), no rollback needed
```

### Post-Rollback Actions

- [ ] Document what went wrong
- [ ] Identify root cause
- [ ] Create fix in development
- [ ] Test fix thoroughly
- [ ] Create incident report
- [ ] Schedule re-deployment
- [ ] Notify stakeholders of resolution plan

---

## Emergency Contacts

### Internal Team

**Technical Lead:**
- Name: [Your Name]
- Email: [your.email@company.com]
- Phone: [+1-XXX-XXX-XXXX]
- Slack: @yourusername
- Availability: 24/7 for critical issues

**DevOps Engineer:**
- Name: [Name]
- Email: [email@company.com]
- Phone: [phone]
- Slack: @username
- Availability: Business hours + on-call rotation

**Backend Developer:**
- Name: [Name]
- Email: [email@company.com]
- Slack: @username
- Availability: Business hours

### External Services

**Digital Ocean Support:**
- Ticket: https://cloud.digitalocean.com/support/tickets
- Urgency: Critical for production issues
- Response time: 1-4 hours (depending on plan)
- Status page: https://status.digitalocean.com

**Cloudflare Support:**
- Dashboard: https://dash.cloudflare.com/
- Support: support@cloudflare.com
- Community: https://community.cloudflare.com/
- Status: https://www.cloudflarestatus.com/

**Stripe Support:**
- Dashboard: https://dashboard.stripe.com/
- Email: support@stripe.com
- Phone: 1-888-926-2289 (US)
- Priority support: Available for paid plans

**SendGrid Support:**
- Dashboard: https://app.sendgrid.com/
- Support: https://support.sendgrid.com/
- Status: http://status.sendgrid.com/

### Escalation Path

**Severity 1 (Critical - System Down):**
1. Contact Technical Lead immediately
2. Create ticket with Digital Ocean Support (Critical priority)
3. Post in team Slack #incidents channel
4. If no response in 15 minutes, escalate to CEO/CTO

**Severity 2 (High - Partial Outage):**
1. Contact DevOps Engineer
2. Create ticket with relevant service provider
3. Post in team Slack #engineering channel
4. If no resolution in 1 hour, escalate to Technical Lead

**Severity 3 (Medium - Degraded Performance):**
1. Create issue in project management system
2. Notify team in Slack
3. Schedule fix in next sprint

**Severity 4 (Low - Minor Issues):**
1. Create issue in backlog
2. Fix in regular development cycle

### Communication Channels

**During Incident:**
- Primary: Slack #incidents channel
- Secondary: Email to engineering@company.com
- Customer-facing: Status page (if applicable)

**Post-Incident:**
- Incident report in wiki
- Post-mortem meeting within 48 hours
- Lessons learned document

---

## Deployment Sign-Off

**Deployment completed by:** ___________________________

**Date and time:** ___________________________

**Backend URL:** https://api.audacious.money

**Sync URL:** https://sync.audacious.money

**Database:** audacious-money-db (Digital Ocean)

**All verification steps completed:** [ ] Yes [ ] No

**Any issues encountered:** ___________________________

**Issues resolved:** [ ] Yes [ ] No [ ] N/A

**Rollback plan tested:** [ ] Yes [ ] No

**Team notified of deployment:** [ ] Yes [ ] No

**Documentation updated:** [ ] Yes [ ] No

**Next steps (Task 6.3):** Configure Stripe webhooks

---

**Signature:** ___________________________

**Date:** ___________________________

---

## Appendix: Quick Reference Commands

### Health Checks

```bash
# Backend health
curl https://api.audacious.money/health

# Sync health
curl https://sync.audacious.money/health
```

### Database Connection Test

```bash
# Test database from local machine
psql "[CONNECTION_POOL_URL]"

# Within psql:
\dt                    # List tables
SELECT COUNT(*) FROM users;  # Test query
\q                     # Exit
```

### Digital Ocean CLI Commands

```bash
# List apps
doctl apps list

# Get app info
doctl apps get <app-id>

# View logs
doctl apps logs <app-id> --type run

# Trigger deployment
doctl apps create-deployment <app-id>

# List deployments
doctl apps list-deployments <app-id>
```

### DNS Verification

```bash
# Check DNS propagation
dig api.audacious.money CNAME
dig sync.audacious.money CNAME

# Check SSL certificate
openssl s_client -connect api.audacious.money:443 -servername api.audacious.money
```

### WebSocket Test (JavaScript)

```javascript
// Test WebSocket connection
const ws = new WebSocket('wss://sync.audacious.money');
ws.onopen = () => console.log('✅ Connected');
ws.onerror = (e) => console.error('❌ Error:', e);
ws.onclose = () => console.log('Disconnected');
```

---

**Document Version:** 1.0
**Last Updated:** 2026-03-22
**Author:** Agent U2
**Related Documents:** DIGITAL_OCEAN_APP_DEPLOYMENT.md, DIGITAL_OCEAN_DATABASE_SETUP.md
