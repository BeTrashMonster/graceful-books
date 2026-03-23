# Digital Ocean App Platform Deployment Guide

Complete step-by-step guide for deploying the Audacious Money backend API and sync relay to Digital Ocean App Platform.

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Architecture Diagram](#architecture-diagram)
4. [Part A: Backend API Deployment](#part-a-backend-api-deployment)
5. [Part B: Sync Relay Deployment](#part-b-sync-relay-deployment)
6. [Database Firewall Configuration](#database-firewall-configuration)
7. [Testing Deployments](#testing-deployments)
8. [Monitoring and Alerts](#monitoring-and-alerts)
9. [Troubleshooting](#troubleshooting)
10. [Scaling and Optimization](#scaling-and-optimization)

---

## Overview

### What This Accomplishes

This guide will help you deploy two critical services to Digital Ocean App Platform:

1. **Backend API** - RESTful API server serving the main application logic
2. **Sync Relay** - WebSocket server handling real-time data synchronization

Both services will be:
- Deployed from your GitHub repository
- Connected to the PostgreSQL database created in Task 6.1
- Accessible via custom domains with HTTPS
- Configured for auto-deployment on code changes
- Monitored for performance and availability

### Estimated Time

- **Initial deployment:** 30-40 minutes
- **Testing and verification:** 15-20 minutes
- **Total:** 45-60 minutes

### Prerequisites

Before starting, ensure you have:

- [ ] **GitHub repository** - Your Audacious Money codebase pushed to GitHub
- [ ] **Digital Ocean account** - Active account with billing configured
- [ ] **PostgreSQL database** - Completed Task 6.1 with connection pool URL
- [ ] **Domain registered** - `audacious.money` domain (or your chosen domain)
- [ ] **DNS access** - Ability to add CNAME records (Cloudflare recommended)
- [ ] **Stripe account** - Production API keys from Stripe dashboard
- [ ] **SendGrid account** - API key for email sending
- [ ] **JWT secret** - Generated using `openssl rand -hex 32`

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    GitHub Repository                         │
│           (main branch triggers auto-deploy)                 │
└────────────┬──────────────────────┬─────────────────────────┘
             │                      │
             │ Auto-deploy          │ Auto-deploy
             ▼                      ▼
   ┌─────────────────┐    ┌─────────────────┐
   │  Backend API    │    │   Sync Relay    │
   │  App Platform   │    │  App Platform   │
   │                 │    │                 │
   │ api.audacious   │    │ sync.audacious  │
   │    .money       │    │    .money       │
   │                 │    │                 │
   │ Port: 3001      │    │ Port: 8080      │
   │ HTTP + JSON     │    │ WebSocket       │
   └────────┬────────┘    └────────┬────────┘
            │                      │
            │                      │
            └──────────┬───────────┘
                       │
                       ▼
            ┌──────────────────────┐
            │  PostgreSQL Database │
            │    (from Task 6.1)   │
            │                      │
            │  Connection Pool     │
            │  SSL Required        │
            └──────────────────────┘
```

**Data Flow:**
1. User pushes code to GitHub `main` branch
2. Digital Ocean detects push and starts build
3. App Platform pulls code, runs `bun install`, starts app
4. Apps connect to database via connection pool URL
5. DNS routes traffic: `api.audacious.money` → Backend, `sync.audacious.money` → Sync
6. HTTPS enforced automatically via Let's Encrypt

---

## Part A: Backend API Deployment

### Step 1: Create App from GitHub

1. **Navigate to Digital Ocean Apps**
   - Log in to Digital Ocean dashboard
   - Click **Apps** in left sidebar
   - Click **Create App** button

2. **Connect GitHub Repository**
   - Click **GitHub** as source provider
   - Authorize Digital Ocean to access your GitHub account
   - Select your repository: `[YOUR_USERNAME]/audacious-money` (or your repo name)
   - Select branch: `main`
   - Click **Next**

3. **Auto-Detect Resources**
   - Digital Ocean will scan your repository
   - It should detect the backend as a **Web Service**
   - If it doesn't detect properly, click **Edit** to configure manually

---

### Step 2: Configure Backend Service

1. **Service Configuration**
   - **Name:** `audacious-money-api`
   - **Source Directory:** `/audacious_money_backend`
     - Note: If your repo is structured differently, adjust path accordingly
     - Leave blank if backend is at repository root
   - **Resource Type:** Web Service

2. **Build Settings**
   - **Build Command:** `bun install`
     - This installs dependencies using Bun package manager
     - App Platform auto-detects Bun from `package.json`
   - **Run Command:** `bun run src/index.ts`
     - Starts the Hono server

3. **HTTP Configuration**
   - **HTTP Port:** `3001`
     - Must match the port your app listens on
     - Defined in your `.env` as `PORT=3001`
   - **Routes:** Leave default (`/`)

4. **Instance Configuration**

   **For Development/Testing:**
   - **Instance Size:** Basic (512MB RAM / $5/month)
   - **Instance Count:** 1

   **For Production:**
   - **Instance Size:** Professional-XS (1GB RAM / $12/month)
   - **Instance Count:** 2-3 (for high availability)

   **Recommendation:** Start with Basic, scale up based on usage

---

### Step 3: Configure Environment Variables

Click **Environment Variables** section and add the following:

#### Required Variables

| Key | Value | Type | Source |
|-----|-------|------|--------|
| `NODE_ENV` | `production` | Plain | Static |
| `PORT` | `3001` | Plain | Static |
| `DATABASE_URL` | [connection-pool-url] | Secret | Task 6.1 output |
| `JWT_SECRET` | [generated-secret] | Secret | Generate: `openssl rand -hex 32` |
| `STRIPE_SECRET_KEY` | `sk_live_...` | Secret | Stripe Dashboard → Developers → API Keys |
| `STRIPE_WEBHOOK_SECRET` | [leave-blank-for-now] | Secret | Will add in Task 6.3 |
| `SENDGRID_API_KEY` | `SG.xxxxx` | Secret | SendGrid Dashboard → API Keys |
| `APP_URL` | `https://app.audacious.money` | Plain | Your frontend URL |
| `ADMIN_URL` | `https://admin.audacious.money` | Plain | Your admin panel URL |
| `ALLOWED_ORIGINS` | `https://app.audacious.money,https://admin.audacious.money` | Plain | Comma-separated list |

#### Optional Variables (with defaults)

| Key | Value | Type | Notes |
|-----|-------|------|-------|
| `ARGON2_MEMORY_COST` | `65536` | Plain | Password hashing memory cost |
| `ARGON2_TIME_COST` | `3` | Plain | Password hashing time cost |
| `ARGON2_PARALLELISM` | `4` | Plain | Password hashing parallelism |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Plain | Rate limit window (1 minute) |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | Plain | Max requests per window |
| `RATE_LIMIT_AUTH_MAX` | `5` | Plain | Max auth attempts per window |

#### Environment Variable Notes

**DATABASE_URL:**
- Use the **connection pool URL** from Task 6.1, NOT the direct database URL
- Format: `postgresql://username:password@host:25060/database?sslmode=require`
- Should end with `?sslmode=require` to enforce SSL

**JWT_SECRET:**
- Generate a new secret for production: `openssl rand -hex 32`
- NEVER reuse development secrets
- Must be the same across backend and sync relay

**STRIPE_SECRET_KEY:**
- Use **live mode** key for production: `sk_live_...`
- Use **test mode** key for staging: `sk_test_...`
- Found in Stripe Dashboard → Developers → API Keys

**STRIPE_WEBHOOK_SECRET:**
- Leave blank for now
- Will be configured in Task 6.3 after deployment
- Webhook endpoint: `https://api.audacious.money/webhooks/stripe`

**SENDGRID_API_KEY:**
- Create API key in SendGrid Dashboard
- Requires Full Access permissions
- Format: `SG.xxxxxxxxxxxxx`

**ALLOWED_ORIGINS:**
- Critical for CORS security
- Must match your frontend domains exactly (including https://)
- No trailing slashes

---

### Step 4: Configure Custom Domain

1. **Add Domain in App Platform**
   - In your app settings, click **Domains** tab
   - Click **Add Domain**
   - Enter: `api.audacious.money`
   - Click **Add Domain**

2. **Configure DNS in Cloudflare**
   - Log in to Cloudflare
   - Select your `audacious.money` domain
   - Click **DNS** in the left sidebar
   - Click **Add record**

   **DNS Record:**
   - **Type:** `CNAME`
   - **Name:** `api`
   - **Target:** `[your-app-name].ondigitalocean.app`
     - Example: `audacious-money-api-xyz12.ondigitalocean.app`
     - Digital Ocean will show this URL in the Domains section
   - **Proxy status:** DNS only (gray cloud)
   - **TTL:** Auto

3. **Enable Force HTTPS**
   - Back in Digital Ocean App settings
   - Under Domains, find `api.audacious.money`
   - Toggle **Force HTTPS** to ON
   - SSL certificate will auto-provision via Let's Encrypt (takes 5-10 minutes)

4. **Verify Domain**
   - Wait 5-10 minutes for DNS propagation
   - Check status in Digital Ocean Domains tab
   - Should show green checkmark when ready

---

### Step 5: Configure Health Checks

Health checks ensure your app is running and responding correctly.

1. **Access Health Check Settings**
   - In app settings, find **Health Checks** section
   - Click **Edit**

2. **Configure Health Check**
   - **HTTP Path:** `/health`
   - **Initial Delay:** `30` seconds
     - Time to wait before first health check (allows app to start)
   - **Period:** `10` seconds
     - How often to check
   - **Timeout:** `5` seconds
     - How long to wait for response
   - **Success Threshold:** `1`
     - Consecutive successes to mark healthy
   - **Failure Threshold:** `3`
     - Consecutive failures to mark unhealthy and restart

3. **Health Check Endpoint**
   - Your backend must implement `GET /health`
   - Should return HTTP 200 with JSON:
     ```json
     {
       "status": "healthy",
       "timestamp": "2026-03-22T12:00:00Z",
       "database": "connected"
     }
     ```

**Note:** If health checks fail consistently, App Platform will restart your service automatically.

---

### Step 6: Configure Auto-Deploy

Enable automatic deployments when you push to GitHub.

1. **Access Auto-Deploy Settings**
   - In app settings, find **Source** section
   - Look for **Auto-deploy** toggle

2. **Configure Auto-Deploy**
   - **Enable Auto-Deploy:** ON
   - **Branch:** `main`
   - **Deploy on push:** Enabled
   - **Deploy on PR:** Disabled (recommended)

3. **Deployment Notifications**
   - Click **Notifications** in app settings
   - Add notification channels:
     - **Email:** Your email address
     - **Slack:** (optional) Add Slack webhook URL

   **Events to notify:**
   - [x] Deployment Started
   - [x] Deployment Failed
   - [x] Deployment Succeeded
   - [x] Domain Failed
   - [x] Alert Triggered

---

### Step 7: Deploy Backend

1. **Review Configuration**
   - Double-check all environment variables
   - Verify domain settings
   - Confirm build/run commands

2. **Click "Create Resources"**
   - Digital Ocean will start building your app
   - Build process takes 3-5 minutes
   - You can watch logs in real-time

3. **Monitor Build Logs**
   - Click on your app name
   - Go to **Runtime Logs** tab
   - Watch for:
     ```
     Starting deployment...
     Installing dependencies...
     ✓ bun install completed
     Starting service...
     ✓ Server listening on port 3001
     ✓ Health check passed
     Deployment successful!
     ```

4. **Verify Deployment**
   - Status should show **Deployed**
   - Health check should show **Healthy**
   - Domain should show **Active**

---

## Part B: Sync Relay Deployment

The sync relay handles WebSocket connections for real-time data synchronization.

### Step 1: Create Second App

**Option A: Separate App (Recommended)**
- Go to Digital Ocean Apps dashboard
- Click **Create App** again
- Follow same GitHub connection process

**Option B: Add Service to Existing App**
- Open your existing backend app
- Click **Create → Component**
- Add new Web Service

**Recommendation:** Use Option A (separate app) for easier scaling and independent monitoring.

---

### Step 2: Configure Sync Service

1. **Service Configuration**
   - **Name:** `audacious-money-sync`
   - **Source Directory:** `/audacious_money_sync`
     - Adjust if your sync relay is in a different location
   - **Resource Type:** Web Service

2. **Build Settings**
   - **Build Command:** `bun install`
   - **Run Command:** `bun run src/index.ts`

3. **HTTP Configuration**
   - **HTTP Port:** `8080`
     - Default port for sync relay
     - Must match port in sync relay code
   - **Routes:** Leave default (`/`)

4. **Instance Configuration**
   - **Instance Size:** Basic (512MB RAM / $5/month)
   - **Instance Count:** 1
     - Can scale to 2-3 for production if needed

**WebSocket Support:**
- Digital Ocean App Platform fully supports WebSocket connections
- No special configuration needed
- Connections are automatically upgraded from HTTP

---

### Step 3: Configure Environment Variables

Add these environment variables for the sync relay:

| Key | Value | Type | Source |
|-----|-------|------|--------|
| `NODE_ENV` | `production` | Plain | Static |
| `PORT` | `8080` | Plain | Static |
| `DATABASE_URL` | [same-as-backend] | Secret | Task 6.1 output |
| `JWT_SECRET` | [same-as-backend] | Secret | **CRITICAL: Must match backend** |

**Important Notes:**

**DATABASE_URL:**
- Use the **exact same connection pool URL** as backend
- Both services share the same database

**JWT_SECRET:**
- **MUST be identical** to backend JWT_SECRET
- Sync relay validates JWTs issued by backend
- Mismatch will cause authentication failures

---

### Step 4: Configure Custom Domain

1. **Add Domain in App Platform**
   - In sync app settings, click **Domains** tab
   - Click **Add Domain**
   - Enter: `sync.audacious.money`
   - Click **Add Domain**

2. **Configure DNS in Cloudflare**
   - Add another CNAME record:

   **DNS Record:**
   - **Type:** `CNAME`
   - **Name:** `sync`
   - **Target:** `[sync-app-name].ondigitalocean.app`
     - Example: `audacious-money-sync-abc34.ondigitalocean.app`
   - **Proxy status:** DNS only (gray cloud)
   - **TTL:** Auto

3. **Enable Force HTTPS**
   - Toggle **Force HTTPS** to ON
   - SSL certificate will auto-provision

**WebSocket-Specific DNS Notes:**
- No special DNS configuration needed for WebSockets
- HTTPS/WSS uses the same CNAME record
- Clients connect to `wss://sync.audacious.money`
- Protocol is automatically upgraded

---

### Step 5: Configure Health Checks

1. **Health Check Settings**
   - **HTTP Path:** `/health`
   - **Initial Delay:** `30` seconds
   - **Period:** `10` seconds
   - **Timeout:** `5` seconds
   - **Success Threshold:** `1`
   - **Failure Threshold:** `3`

2. **Health Check Endpoint**
   - Sync relay must implement `GET /health`
   - Should return HTTP 200:
     ```json
     {
       "status": "healthy",
       "timestamp": "2026-03-22T12:00:00Z",
       "connections": 42
     }
     ```

---

### Step 6: Configure Auto-Deploy

Same configuration as backend:
- **Enable Auto-Deploy:** ON
- **Branch:** `main`
- **Notifications:** Email + Slack

---

### Step 7: Deploy Sync Relay

1. **Click "Create Resources"**
2. **Monitor Build Logs**
3. **Verify Deployment:**
   - Status: **Deployed**
   - Health: **Healthy**
   - Domain: **Active**

---

## Database Firewall Configuration

After both apps are deployed, you need to whitelist their IP addresses in the database firewall.

### Step 1: Get App Platform IP Addresses

Digital Ocean App Platform uses NAT gateways with static outbound IPs.

1. **Find Outbound IPs**
   - Open your app in Digital Ocean dashboard
   - Go to **Settings** tab
   - Scroll to **App-Level Information**
   - Look for **Outbound IP Addresses**
   - You should see 2-3 IP addresses listed

2. **Repeat for Both Apps**
   - Get IPs for backend app: `api.audacious.money`
   - Get IPs for sync app: `sync.audacious.money`
   - May be the same if in same region, but verify both

**Example IPs:**
```
Backend Outbound IPs:
- 159.89.123.45
- 159.89.123.46

Sync Outbound IPs:
- 159.89.123.45
- 159.89.123.46
```

---

### Step 2: Add IPs to Database Firewall

1. **Navigate to Database**
   - Digital Ocean dashboard → Databases
   - Select your `audacious-money-db` database
   - Click **Settings** tab

2. **Configure Trusted Sources**
   - Scroll to **Trusted Sources**
   - Click **Edit**
   - Click **Add source**

3. **Add Each IP Address**
   - **Source Type:** IP Address
   - **IP Address:** `159.89.123.45`
   - **Note:** `Backend App (api.audacious.money)`
   - Click **Add**

   Repeat for each unique IP:
   - Add backend IPs with note: "Backend App"
   - Add sync IPs with note: "Sync Relay"

4. **Save Changes**
   - Click **Save**
   - Changes take effect immediately

**Important:** Without this step, your apps cannot connect to the database!

---

### Step 3: Test Database Connectivity

1. **Check App Logs**
   - Open backend app → Runtime Logs
   - Look for successful database connection:
     ```
     ✓ Database connected
     ✓ Connection pool ready
     ```

2. **If Connection Fails**
   - Check error message in logs
   - Common issues:
     - "Connection refused" → IP not whitelisted
     - "SSL required" → Missing `?sslmode=require` in DATABASE_URL
     - "Authentication failed" → Wrong credentials in DATABASE_URL

---

## Testing Deployments

Comprehensive testing to verify everything works.

### Backend API Tests

#### 1. Health Check Test

```bash
curl https://api.audacious.money/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-03-22T14:30:00Z",
  "database": "connected",
  "version": "0.1.0"
}
```

**What to check:**
- [x] HTTP 200 status code
- [x] `status: "healthy"`
- [x] `database: "connected"`

---

#### 2. CORS Test

```bash
curl -H "Origin: https://app.audacious.money" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     https://api.audacious.money/api/auth/signup
```

**Expected Response Headers:**
```
Access-Control-Allow-Origin: https://app.audacious.money
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

**What to check:**
- [x] `Access-Control-Allow-Origin` matches your frontend URL
- [x] No errors about CORS

---

#### 3. Database Connectivity Test

```bash
curl -X POST https://api.audacious.money/api/auth/check-email \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "exists": false,
    "available": true
  }
}
```

**What to check:**
- [x] HTTP 200 status code
- [x] Response confirms database query executed
- [x] No database connection errors

---

#### 4. Authentication Endpoint Test

Test that protected routes require authentication:

```bash
curl https://api.audacious.money/api/user/profile
```

**Expected Response:**
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

**What to check:**
- [x] HTTP 401 status code
- [x] Proper error format
- [x] Authentication middleware working

---

### Sync Relay Tests

#### 1. Health Check Test

```bash
curl https://sync.audacious.money/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-03-22T14:30:00Z",
  "connections": 0
}
```

---

#### 2. WebSocket Connection Test

Create a test HTML file:

```html
<!DOCTYPE html>
<html>
<head>
  <title>WebSocket Test</title>
</head>
<body>
  <h1>WebSocket Connection Test</h1>
  <div id="status">Connecting...</div>
  <script>
    const ws = new WebSocket('wss://sync.audacious.money');

    ws.onopen = () => {
      document.getElementById('status').textContent = '✅ Connected!';
      console.log('WebSocket connected');
    };

    ws.onerror = (error) => {
      document.getElementById('status').textContent = '❌ Connection failed';
      console.error('WebSocket error:', error);
    };

    ws.onmessage = (event) => {
      console.log('Message received:', event.data);
    };
  </script>
</body>
</html>
```

Open in browser and check:
- [x] Status shows "✅ Connected!"
- [x] No errors in browser console
- [x] WebSocket connection established

---

#### 3. Authentication Flow Test

Test authenticated WebSocket connection:

```javascript
// Get JWT token from backend first
const token = 'your-jwt-token';

const ws = new WebSocket('wss://sync.audacious.money');

ws.onopen = () => {
  // Send authentication message
  ws.send(JSON.stringify({
    type: 'authenticate',
    token: token
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.type === 'authenticated') {
    console.log('✅ Authentication successful');
  }
};
```

---

### Integration Tests

#### 1. Frontend → Backend Communication

From your frontend app:

```javascript
// Test API call
const response = await fetch('https://api.audacious.money/health');
const data = await response.json();
console.log('Backend health:', data);
```

**Expected:** Health check response with CORS headers

---

#### 2. Frontend → Sync Relay WebSocket

From your frontend app:

```javascript
const ws = new WebSocket('wss://sync.audacious.money');
ws.onopen = () => console.log('✅ Sync connected');
```

**Expected:** WebSocket connection established

---

#### 3. Backend → Database

Check backend logs for:
```
✓ Database connection pool created
✓ Test query successful
✓ Migrations up to date
```

---

#### 4. End-to-End Flow Test

1. **Create account** via frontend → Backend creates user in database
2. **Login** → Backend returns JWT
3. **Connect to sync** → Sync relay authenticates JWT
4. **Make change** in frontend → Syncs via WebSocket
5. **Verify change** persisted in database

---

## Monitoring and Alerts

Configure monitoring to catch issues before users do.

### Step 1: Enable Digital Ocean Monitoring

Monitoring is automatically enabled for App Platform apps.

**Metrics Collected:**
- CPU usage (%)
- Memory usage (MB)
- Request rate (requests/second)
- Response time (ms)
- Error rate (%)
- Active connections (WebSocket only)

**Access Metrics:**
1. Open your app in Digital Ocean dashboard
2. Click **Metrics** tab
3. View graphs for all metrics
4. Customize time range (1h, 24h, 7d, 30d)

---

### Step 2: Configure Alerts

Set up alerts to notify you of issues.

1. **Navigate to Alerts**
   - App dashboard → **Alerts** tab
   - Click **Create Alert**

2. **Create CPU Alert**
   - **Name:** High CPU Usage
   - **Metric:** CPU Usage
   - **Condition:** Greater than 80%
   - **Duration:** 5 minutes
   - **Notification:** Email
   - **Severity:** Warning

3. **Create Memory Alert**
   - **Name:** High Memory Usage
   - **Metric:** Memory Usage
   - **Condition:** Greater than 90%
   - **Duration:** 3 minutes
   - **Notification:** Email
   - **Severity:** Critical

4. **Create Error Rate Alert**
   - **Name:** High Error Rate
   - **Metric:** Error Rate
   - **Condition:** Greater than 5%
   - **Duration:** 2 minutes
   - **Notification:** Email + Slack
   - **Severity:** Critical

5. **Create Crash Alert**
   - **Name:** App Crash Detected
   - **Metric:** App Status
   - **Condition:** Unhealthy
   - **Duration:** 1 minute
   - **Notification:** Email + Slack + SMS
   - **Severity:** Critical

6. **Create Failed Deployment Alert**
   - **Name:** Deployment Failed
   - **Metric:** Deployment Status
   - **Condition:** Failed
   - **Duration:** Immediate
   - **Notification:** Email + Slack
   - **Severity:** High

---

### Step 3: Custom Alert Channels

**Email:**
- Default channel
- Add multiple email addresses
- Settings → Notifications → Add Email

**Slack:**
1. Create incoming webhook in Slack
2. Digital Ocean → Settings → Notifications
3. Add Slack webhook URL
4. Test notification

**PagerDuty/Opsgenie:**
- Available for critical alerts
- Configure via API integration
- Escalation policies for on-call

---

### Step 4: Log Access and Retention

**Real-Time Logs:**
1. App dashboard → **Runtime Logs** tab
2. Live tail of application logs
3. Filter by:
   - Log level (info, warn, error)
   - Time range
   - Search term

**Log Retention:**
- **Free tier:** 7 days
- **Pro tier:** 30 days
- **Business tier:** 90 days

**Log Export:**
```bash
# Export logs via CLI
doctl apps logs <app-id> --type run > logs.txt

# Export logs for specific time range
doctl apps logs <app-id> --type run --since 2h > recent-logs.txt
```

**Recommendation:** Set up external log aggregation for long-term retention:
- Papertrail
- Logtail
- Datadog
- New Relic

---

## Troubleshooting

Common issues and solutions.

### Issue 1: Build Fails - "bun install" Errors

**Symptoms:**
```
Error: Failed to install dependencies
bun: command not found
```

**Cause:** Bun not detected or unsupported

**Solutions:**

**Solution A: Verify Bun in package.json**
```json
{
  "devDependencies": {
    "bun-types": "latest"
  }
}
```

**Solution B: Add buildpack detection**
Create `runtime.txt` in repository root:
```
bun-1.0.0
```

**Solution C: Use explicit Dockerfile**
If Bun detection fails, create `Dockerfile`:
```dockerfile
FROM oven/bun:1.0
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install
COPY . .
CMD ["bun", "run", "src/index.ts"]
```

Then change build command to: `(leave blank - uses Dockerfile)`

---

### Issue 2: App Crashes on Startup

**Symptoms:**
```
Error: Application exited with code 1
Health check failed
Container restarting...
```

**Cause:** Usually environment variable or port mismatch

**Diagnosis:**
1. Check Runtime Logs for error message
2. Common errors:
   - `DATABASE_URL is required`
   - `Cannot bind to port 3001`
   - `JWT_SECRET is missing`

**Solutions:**

**Missing Environment Variable:**
- Go to app Settings → Environment Variables
- Add missing variable
- Redeploy

**Port Mismatch:**
- Verify `PORT` env var matches HTTP Port setting
- Verify your code uses `process.env.PORT`
- Update and redeploy

**Database Connection Error:**
- Verify DATABASE_URL is correct
- Check database firewall has app IPs
- Test connection manually

---

### Issue 3: Database Connection Refused

**Symptoms:**
```
Error: Connection refused
ECONNREFUSED 159.89.xxx.xxx:25060
```

**Cause:** App IP not whitelisted in database firewall

**Solution:**
1. Get app's outbound IP addresses (Settings → App-Level Information)
2. Add to database firewall (Database → Settings → Trusted Sources)
3. Wait 30 seconds for change to propagate
4. Restart app deployment

---

### Issue 4: Environment Variables Not Loading

**Symptoms:**
```
Error: JWT_SECRET is undefined
Config validation failed
```

**Cause:** Variable not saved or not marked as secret

**Solution:**
1. Go to Settings → Environment Variables
2. Verify variable exists
3. For secrets, ensure **Type: Secret** is selected
4. Click **Save** (required!)
5. Manually trigger new deployment

**Note:** Changing env vars doesn't auto-deploy. Click "Deploy" after saving.

---

### Issue 5: Health Check Failing

**Symptoms:**
```
Health check failed: timeout
Container marked unhealthy
Restarting container...
```

**Causes:**
- App not implementing `/health` endpoint
- App takes too long to respond
- App crashes before health check

**Solutions:**

**Implement Health Check:**
```typescript
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: 'connected' // test DB connection
  });
});
```

**Increase Initial Delay:**
- If app takes >30s to start, increase Initial Delay to 60s
- Settings → Health Checks → Initial Delay: 60

**Check App Logs:**
- Look for startup errors
- Verify database connection succeeds
- Check all required env vars present

---

### Issue 6: Custom Domain Not Working

**Symptoms:**
- `api.audacious.money` shows "Page not found"
- SSL certificate not provisioning
- Domain shows "Pending" status

**Causes:**
- DNS not propagated
- CNAME pointing to wrong target
- Cloudflare proxy enabled (orange cloud)

**Solutions:**

**Verify DNS:**
```bash
dig api.audacious.money CNAME
# Should show: CNAME points to [app-name].ondigitalocean.app
```

**Check Cloudflare Proxy:**
- Cloudflare DNS → Find `api` record
- Ensure proxy status is **DNS only** (gray cloud)
- Orange cloud (proxied) can interfere with App Platform

**Wait for Propagation:**
- DNS changes take 5-10 minutes
- SSL certificate takes 5-15 minutes
- Refresh domain status in Digital Ocean

**Force SSL Reissue:**
- Remove domain from app
- Wait 2 minutes
- Re-add domain
- SSL will re-provision

---

### Issue 7: WebSocket Connections Drop

**Symptoms:**
- WebSocket connects then immediately disconnects
- Intermittent connection losses
- "WebSocket closed unexpectedly"

**Causes:**
- App idle timeout
- Load balancer timeout
- Client-side ping/pong not implemented

**Solutions:**

**Implement Keep-Alive:**
Server-side (sync relay):
```typescript
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000); // Every 30 seconds

ws.on('pong', () => {
  ws.isAlive = true;
});
```

Client-side:
```javascript
setInterval(() => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'ping' }));
  }
}, 25000); // Every 25 seconds
```

**Increase Idle Timeout:**
- Digital Ocean has 60s default timeout
- Keep-alive prevents reaching timeout

---

### Issue 8: High Memory Usage

**Symptoms:**
- Memory usage at 90%+
- App crashes with "Out of memory"
- Slow response times

**Causes:**
- Memory leak in application code
- Too many simultaneous connections
- Large result sets loaded into memory
- Instance size too small

**Solutions:**

**Vertical Scaling:**
- Upgrade instance size:
  - Basic (512MB) → Professional-XS (1GB)
  - Professional-XS (1GB) → Professional-S (2GB)

**Fix Memory Leaks:**
- Profile application with Bun's built-in profiler
- Check for:
  - Event listeners not removed
  - Interval/timeout not cleared
  - Database connections not closed
  - Large objects kept in memory

**Database Query Optimization:**
- Use pagination for large result sets
- Limit query results
- Stream large responses instead of buffering

**Connection Pooling:**
- Verify database connection pool configured:
  ```typescript
  max: 10, // Maximum connections
  min: 2,  // Minimum connections
  ```

---

## Scaling and Optimization

### Horizontal Scaling (Add Instances)

**When to Scale:**
- CPU consistently >70%
- Response times increasing
- Request queue building up
- High availability requirements

**How to Scale:**
1. App Settings → **Components**
2. Click your service component
3. **Instance Count:** Change from 1 to 2 (or 3)
4. Click **Save**
5. Digital Ocean will deploy additional instances
6. Load balancer automatically distributes traffic

**Pricing:**
- Each instance billed separately
- 2 instances = 2x cost
- Pro tip: Scale up during business hours, down at night

---

### Vertical Scaling (Increase Instance Size)

**Instance Size Options:**

| Size | RAM | CPU | Price/month | Use Case |
|------|-----|-----|-------------|----------|
| Basic | 512MB | 0.5 vCPU | $5 | Development, low traffic |
| Professional-XS | 1GB | 1 vCPU | $12 | Small production apps |
| Professional-S | 2GB | 1 vCPU | $24 | Medium traffic |
| Professional-M | 4GB | 2 vCPU | $48 | High traffic |
| Professional-L | 8GB | 4 vCPU | $96 | Very high traffic |

**How to Scale:**
1. App Settings → **Components**
2. Click your service component
3. **Instance Size:** Select larger size
4. Click **Save**
5. App will redeploy with new size (30-60s downtime)

---

### Database Connection Pooling

Optimize database connections to reduce overhead.

**Configure in Database URL:**
```
postgresql://user:pass@host:25060/db?sslmode=require&pool_max=10&pool_min=2
```

**Recommended Settings:**

| Instance Size | pool_max | pool_min |
|---------------|----------|----------|
| Basic (512MB) | 5 | 2 |
| Professional-XS (1GB) | 10 | 2 |
| Professional-S (2GB) | 20 | 5 |
| Professional-M (4GB) | 40 | 10 |

**Why It Matters:**
- Each connection consumes memory
- Too many connections = resource waste
- Too few connections = connection bottleneck
- Pool reuses connections = better performance

---

### CDN Configuration (Optional)

For static assets served by your API (rare).

**If Serving Static Files:**
1. Use Cloudflare CDN (already using for DNS)
2. Change DNS proxy to **Proxied** (orange cloud)
3. Configure Cloudflare caching rules:
   - Cache static assets (images, CSS, JS)
   - Don't cache API responses
   - Set appropriate TTLs

**Page Rules:**
```
https://api.audacious.money/static/*
  Cache Level: Cache Everything
  Edge Cache TTL: 1 month

https://api.audacious.money/api/*
  Cache Level: Bypass
```

**Note:** Most API responses shouldn't be cached. Use with caution.

---

### Caching Strategies

**Application-Level Caching:**

**Redis Cache (Future Enhancement):**
```typescript
// Cache frequently accessed data
const user = await cache.get(`user:${userId}`);
if (!user) {
  user = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
  await cache.set(`user:${userId}`, user, { ttl: 300 }); // 5 minutes
}
```

**In-Memory Caching (Simple):**
```typescript
const cache = new Map();

function getCachedData(key, fetchFn, ttl = 60000) {
  const cached = cache.get(key);
  if (cached && Date.now() < cached.expires) {
    return cached.data;
  }

  const data = fetchFn();
  cache.set(key, { data, expires: Date.now() + ttl });
  return data;
}
```

**What to Cache:**
- User profiles (low change frequency)
- Subscription status (check every 5 minutes)
- Product list (rarely changes)

**What NOT to Cache:**
- Financial transactions (always fresh)
- Authentication tokens (security risk)
- Real-time sync data (defeats purpose)

---

## Security Checklist

Before going to production, verify these security measures:

- [ ] **Environment variables encrypted** (Digital Ocean handles this automatically)
- [ ] **JWT_SECRET rotated from development** (never reuse dev secrets)
- [ ] **Stripe secret keys are production keys** (not test mode)
- [ ] **Database connection uses SSL** (`?sslmode=require` in URL)
- [ ] **Health checks configured and responding** (both apps)
- [ ] **Auto-deploy only from main branch** (not feature branches)
- [ ] **HTTPS enforced on all domains** (Force HTTPS enabled)
- [ ] **Database firewall updated with app IPs** (both backend and sync)
- [ ] **Monitoring and alerts active** (CPU, memory, errors)
- [ ] **ALLOWED_ORIGINS configured correctly** (exact frontend URLs)
- [ ] **CORS headers tested** (no wildcard `*` in production)
- [ ] **Rate limiting enabled** (protect against abuse)
- [ ] **Error messages sanitized** (no stack traces to clients)
- [ ] **Logs don't contain secrets** (no passwords, keys in logs)

---

## Next Steps

After successful deployment:

1. **Task 6.3: Configure Stripe Webhooks**
   - Add webhook endpoint: `https://api.audacious.money/webhooks/stripe`
   - Update `STRIPE_WEBHOOK_SECRET` environment variable

2. **Frontend Deployment (Task 5.2)**
   - Deploy frontend to Cloudflare Pages
   - Configure environment variables to point to `api.audacious.money` and `sync.audacious.money`

3. **End-to-End Testing**
   - Test complete user flows
   - Verify payment processing
   - Test real-time sync

4. **Performance Testing**
   - Load test API endpoints
   - Test WebSocket connection limits
   - Monitor response times under load

5. **Set Up Backups**
   - Database automated backups (already configured in Task 6.1)
   - Test restore procedure
   - Document recovery process

---

## Support and Resources

**Digital Ocean Documentation:**
- [App Platform Overview](https://docs.digitalocean.com/products/app-platform/)
- [Deployment Guide](https://docs.digitalocean.com/products/app-platform/how-to/deploy/)
- [Environment Variables](https://docs.digitalocean.com/products/app-platform/how-to/use-environment-variables/)
- [Custom Domains](https://docs.digitalocean.com/products/app-platform/how-to/manage-domains/)

**Digital Ocean CLI:**
```bash
# Install doctl
brew install doctl  # macOS
# or
snap install doctl  # Linux

# Authenticate
doctl auth init

# List apps
doctl apps list

# View app logs
doctl apps logs <app-id>

# Trigger deployment
doctl apps create-deployment <app-id>
```

**Digital Ocean Support:**
- Community Forums: https://www.digitalocean.com/community
- Support Tickets: Dashboard → Get Help → Create Ticket
- Status Page: https://status.digitalocean.com

**Internal Resources:**
- Database Setup: See `DIGITAL_OCEAN_DATABASE_SETUP.md`
- Deployment Checklist: See `DEPLOYMENT_CHECKLIST.md`
- Production Build: See `PRODUCTION_BUILD_CONFIGURATION.md`

---

## Deployment Timeline

**Typical deployment timeline:**

| Phase | Duration | Notes |
|-------|----------|-------|
| Backend app creation | 5 min | GitHub connection, settings |
| Backend environment variables | 5 min | 15+ variables to configure |
| Backend custom domain | 10 min | DNS + SSL provisioning |
| Backend first deployment | 5 min | Build + deploy |
| Sync app creation | 5 min | Same as backend |
| Sync environment variables | 2 min | Only 4 variables |
| Sync custom domain | 10 min | DNS + SSL provisioning |
| Sync deployment | 5 min | Build + deploy |
| Database firewall update | 3 min | Add app IPs |
| Testing and verification | 15 min | All health checks |
| **Total** | **60-65 min** | First-time deployment |

**Subsequent deployments:**
- Auto-deploy from Git push: 3-5 minutes
- Manual deployment: 2-3 minutes

---

## Conclusion

You have successfully deployed the Audacious Money backend API and sync relay to Digital Ocean App Platform!

**What You've Accomplished:**
- Backend API running at `https://api.audacious.money`
- Sync relay running at `https://sync.audacious.money` (WebSocket)
- Both connected to PostgreSQL database with connection pooling
- HTTPS enforced via Let's Encrypt SSL certificates
- Health checks monitoring application status
- Auto-deployment configured for main branch
- Alerts configured for critical issues
- Database firewall protecting against unauthorized access

**Your infrastructure is now:**
- Scalable (add instances as needed)
- Monitored (metrics and alerts)
- Secure (HTTPS, SSL, firewall, secrets management)
- Automated (deploy on push)
- Reliable (health checks and auto-restart)

Proceed to Task 6.3 to configure Stripe webhooks and complete the payment integration.

---

**Document Version:** 1.0
**Last Updated:** 2026-03-22
**Author:** Agent U2
**Related Documents:** DIGITAL_OCEAN_DATABASE_SETUP.md, DEPLOYMENT_CHECKLIST.md, PRODUCTION_BUILD_CONFIGURATION.md
