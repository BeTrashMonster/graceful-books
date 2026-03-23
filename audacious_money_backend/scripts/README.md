# Backend Scripts

This directory contains utility scripts for testing and verifying the Audacious Money backend.

---

## Scripts Overview

### 1. `verify-stripe-integration.ts`

**Purpose:** Verify Stripe configuration is correct before deployment

**Usage:**
```bash
cd audacious_money_backend
bun run scripts/verify-stripe-integration.ts
```

**Checks:**
- ✅ Environment variables are set
- ✅ API key format is valid
- ✅ Webhook secret format is valid
- ✅ Stripe API connection works
- ✅ Products and prices are configured
- ✅ Webhook endpoints are configured (production only)

**When to Use:**
- Before deploying to production
- After updating Stripe configuration
- When debugging Stripe integration issues
- As part of CI/CD pipeline

**Example Output:**
```
🔍 Verifying Stripe Integration
================================

1️⃣  Environment Variables
   ----------------------
   ✅ STRIPE_SECRET_KEY is set
   ✅ STRIPE_WEBHOOK_SECRET is set

2️⃣  API Key Format
   ---------------
   ✅ Using live Stripe key in production

3️⃣  Webhook Secret Format
   ----------------------
   ✅ Webhook secret format is valid

4️⃣  Stripe API Connection
   ----------------------
   ✅ Connected to Stripe account: Audacious Money
   Account ID: acct_xxxxx
   Country: US
   Charges Enabled: true
   Payouts Enabled: true

5️⃣  Products and Prices
   --------------------
   ✅ Found 6 products and 12 prices

6️⃣  Webhook Endpoints
   ------------------
   ✅ Production webhook configured: https://api.audacious.money/stripe/webhook

================================
✅ Stripe integration verified successfully!
```

---

### 2. `test-webhook.sh` (Linux/macOS)

**Purpose:** Test Stripe webhooks locally using Stripe CLI

**Prerequisites:**
- Stripe CLI installed
- Backend running on localhost:3001
- Stripe account authenticated

**Usage:**
```bash
cd audacious_money_backend
chmod +x scripts/test-webhook.sh
./scripts/test-webhook.sh
```

**What It Does:**
1. Checks Stripe CLI is installed and authenticated
2. Checks backend is running
3. Forwards webhooks to localhost
4. Triggers all 8 webhook events
5. Stops forwarding when complete

**Events Tested:**
1. `checkout.session.completed`
2. `invoice.payment_succeeded`
3. `invoice.payment_failed`
4. `customer.subscription.created`
5. `customer.subscription.updated`
6. `customer.subscription.deleted`
7. `payment_intent.succeeded`
8. `payment_intent.payment_failed`

---

### 3. `test-webhook.bat` (Windows)

**Purpose:** Same as `test-webhook.sh` but for Windows

**Prerequisites:**
- Stripe CLI installed via Scoop or direct download
- Backend running on localhost:3001
- Stripe account authenticated

**Usage:**
```bash
cd audacious_money_backend
scripts\test-webhook.bat
```

**Note:** This version starts the webhook listener and keeps it running. You'll need to manually trigger events in another terminal using:

```bash
stripe trigger checkout.session.completed
stripe trigger invoice.payment_succeeded
# ... etc
```

Press `Ctrl+C` to stop the webhook listener when done.

---

## Common Workflows

### Before Production Deployment

1. **Verify Stripe integration:**
   ```bash
   bun run scripts/verify-stripe-integration.ts
   ```

2. **Fix any issues** reported by the verification script

3. **Test locally** (if making changes):
   ```bash
   # Start backend
   bun run src/index.ts

   # In another terminal, run tests
   ./scripts/test-webhook.sh
   ```

4. **Deploy** when all checks pass

---

### Testing Webhook Changes

1. **Start backend:**
   ```bash
   bun run src/index.ts
   ```

2. **Run webhook tests:**
   ```bash
   ./scripts/test-webhook.sh
   ```

3. **Check logs** for webhook processing

4. **Query database** to verify updates:
   ```sql
   SELECT * FROM stripe_webhook_events ORDER BY created_at DESC LIMIT 10;
   ```

---

### Debugging Webhook Issues

1. **Check Stripe configuration:**
   ```bash
   bun run scripts/verify-stripe-integration.ts
   ```

2. **Check backend logs:**
   ```bash
   # If using systemd
   sudo journalctl -u audacious-money-backend -f

   # If using Docker
   docker logs audacious-money-backend -f

   # If using Digital Ocean
   # Check Logs tab in App Platform
   ```

3. **Check Stripe Dashboard:**
   - Go to Developers → Webhooks → Your Endpoint
   - Check "Webhook attempts" tab
   - Look for failed deliveries

4. **Test locally:**
   ```bash
   ./scripts/test-webhook.sh
   ```

---

## Troubleshooting

### "Stripe CLI not found"

**Install Stripe CLI:**

**macOS:**
```bash
brew install stripe/stripe-cli/stripe
```

**Windows (Scoop):**
```bash
scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
scoop install stripe
```

**Windows (Direct):**
1. Download: https://github.com/stripe/stripe-cli/releases
2. Extract to a folder (e.g., `C:\stripe`)
3. Add to PATH

**Linux:**
```bash
wget https://github.com/stripe/stripe-cli/releases/download/v1.19.4/stripe_1.19.4_linux_x86_64.tar.gz
tar -xvf stripe_1.19.4_linux_x86_64.tar.gz
sudo mv stripe /usr/local/bin
```

---

### "Stripe CLI not authenticated"

**Login to Stripe:**
```bash
stripe login
```

This opens your browser for authentication.

**Verify login:**
```bash
stripe config --list
```

---

### "Backend not running"

**Start backend:**
```bash
cd audacious_money_backend
bun run src/index.ts
```

**Verify backend is running:**
```bash
curl http://localhost:3001/health
```

Should return:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "database": {
      "healthy": true,
      "responseTime": 5
    }
  }
}
```

---

### "Environment variable not set"

**Create `.env` file:**
```bash
cd audacious_money_backend
cp .env.example .env
```

**Edit `.env` and add:**
```bash
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

For local testing, use test mode keys from Stripe Dashboard.

---

## Additional Resources

- **Stripe Webhook Documentation:** https://stripe.com/docs/webhooks
- **Stripe CLI Documentation:** https://stripe.com/docs/stripe-cli
- **Full Webhook Setup Guide:** `docs/STRIPE_WEBHOOK_CONFIGURATION.md`

---

## Contributing

When adding new scripts:

1. Add documentation here
2. Include usage examples
3. Add error handling
4. Test on multiple platforms
5. Update this README

---

**Last Updated:** 2026-03-22
