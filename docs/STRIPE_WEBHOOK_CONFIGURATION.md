# Stripe Webhook Configuration Guide

**Purpose:** Step-by-step guide for configuring Stripe webhooks in production and testing locally.

**Estimated Time:** 15-20 minutes

**Prerequisites:**
- Backend deployed to Digital Ocean (Task 6.2 complete)
- Stripe account with production access
- Stripe CLI installed (for local testing)

---

## Table of Contents

1. [Overview](#overview)
2. [Production Webhook Setup](#production-webhook-setup)
3. [Testing Webhook Delivery](#testing-webhook-delivery)
4. [Local Testing Setup](#local-testing-setup)
5. [Staging/Test Environment](#stagingtest-environment-optional)
6. [Monitoring & Debugging](#monitoring--debugging)
7. [Webhook Security](#webhook-security)
8. [Event Processing Details](#event-processing-details)
9. [Troubleshooting](#troubleshooting)

---

## Overview

### What Webhooks Accomplish

Stripe webhooks enable real-time processing of payment events:
- Subscription lifecycle management (created, updated, canceled)
- Payment success and failure handling
- Invoice processing
- Database synchronization with Stripe state

### Why Webhooks are Critical

Without webhooks, your application cannot:
- Automatically activate subscriptions after payment
- Handle failed payments and update user access
- Process subscription upgrades/downgrades
- Keep database in sync with Stripe billing state

### Architecture

```
Stripe Event → Webhook → Backend Handler → Database Update → User Notification
```

**Security:** All webhook payloads are cryptographically signed by Stripe to prevent spoofing.

---

## Production Webhook Setup

### Step 1: Access Stripe Dashboard

1. Log into [Stripe Dashboard](https://dashboard.stripe.com)
2. **Toggle to Production Mode** (top-right corner - ensure "Live" is selected, not "Test")
3. Navigate: **Developers → Webhooks**
4. Click **"Add endpoint"** button

### Step 2: Configure Webhook Endpoint

Enter the following configuration:

**Endpoint URL:**
```
https://api.audacious.money/stripe/webhook
```

**Description:**
```
Production Webhook - Audacious Money
```

**API Version:**
- Select latest version: `2024-11-20.acacia` or newer
- **Important:** This should match the API version in your backend code

**Events to send:**
- Select "Select events" (not "Listen to all events")

### Step 3: Select Events to Listen

Add the following 8 events (click "Select events" button):

#### Checkout Events
- **`checkout.session.completed`**
  - **Why:** Triggered when a user completes checkout
  - **Action:** Create subscription record in database, activate user access

#### Invoice Events
- **`invoice.payment_succeeded`**
  - **Why:** Payment successfully charged
  - **Action:** Store invoice record, update payment history, send receipt email

- **`invoice.payment_failed`**
  - **Why:** Payment attempt failed (expired card, insufficient funds)
  - **Action:** Update subscription to "past_due", send payment failed email to user

#### Subscription Events
- **`customer.subscription.created`**
  - **Why:** New subscription created
  - **Action:** Create subscription record, grant product access

- **`customer.subscription.updated`**
  - **Why:** Subscription changed (plan upgrade, renewal, cancellation scheduled)
  - **Action:** Update subscription status, period dates, cancellation flags

- **`customer.subscription.deleted`**
  - **Why:** Subscription permanently canceled or expired
  - **Action:** Revoke product access, update status to "canceled"

#### Payment Intent Events
- **`payment_intent.succeeded`**
  - **Why:** One-time payment succeeded
  - **Action:** Process one-time purchases, credits

- **`payment_intent.payment_failed`**
  - **Why:** One-time payment failed
  - **Action:** Log failure, notify user

**Save Events** after selecting all 8.

### Step 4: Get Signing Secret

After creating the webhook endpoint:

1. You'll see your new webhook endpoint listed
2. Click on the endpoint to view details
3. In the "Signing secret" section, click **"Reveal"**
4. Copy the signing secret (starts with `whsec_`)
5. **CRITICAL:** Store this in your password manager immediately
   - Never commit to git
   - Never share publicly
   - Treat like a password

**Example format:**
```
whsec_1234567890abcdefghijklmnopqrstuvwxyz1234567890
```

### Step 5: Update Backend Environment

Now you need to add the signing secret to your backend environment:

1. Log into **Digital Ocean**
2. Navigate: **Apps → Your Backend App → Settings**
3. Click **"Environment Variables"** section
4. Click **"Edit"** button
5. Add new variable:
   - **Key:** `STRIPE_WEBHOOK_SECRET`
   - **Value:** `whsec_xxxxxxxxxxxxx` (paste your signing secret)
   - **Type:** `Secret` (check "Encrypt" option)
6. Click **"Save"**
7. **Trigger New Deployment:**
   - Click **"Actions"** → **"Force Rebuild and Deploy"**
   - **Why:** Environment variable changes require restart

**Wait 2-3 minutes** for deployment to complete.

### Step 6: Verify Endpoint is Active

Back in Stripe Dashboard:

1. Your webhook endpoint should show **"Enabled"** status
2. Should show **"0 events sent"** (until first event)
3. Should list your 8 selected events

---

## Testing Webhook Delivery

### Send Test Webhook from Stripe

1. In Stripe Dashboard → **Webhooks** → Select your endpoint
2. Click **"Send test webhook"** button (top right)
3. Select event type: **`checkout.session.completed`**
4. Click **"Send test webhook"**

### Expected Response

- **Success:** Green checkmark with "200 OK"
- **Failure:** Red X with error code

**If you see 200 OK:** Webhook is working! ✅

**If you see an error:**
- `401 Unauthorized` → Signature verification failed (check signing secret)
- `404 Not Found` → Endpoint URL incorrect
- `500 Internal Server Error` → Backend error (check logs)
- `Timeout` → Backend not responding (check deployment)

### Monitor Webhook Attempts

1. Click on your endpoint in Stripe Dashboard
2. Go to **"Webhook attempts"** tab
3. You'll see a list of all webhook deliveries:
   - **Green checkmark:** Successful (200 OK)
   - **Red X:** Failed (see error details)

Click on any attempt to see:
- Request body (full JSON payload)
- Response body (from your backend)
- Timestamp
- Retry information

### Check Backend Logs

1. Go to **Digital Ocean → Apps → Your Backend**
2. Click **"Logs"** tab
3. Search for: `[STRIPE WEBHOOK]`

**Expected log output:**
```
[STRIPE WEBHOOK] Received event: checkout.session.completed
[STRIPE WEBHOOK] Processing event ID: evt_xxxxx
[STRIPE WEBHOOK] Successfully processed checkout.session.completed
```

**If you don't see logs:**
- Webhook might not be reaching backend
- Check endpoint URL is correct
- Check backend is running

---

## Local Testing Setup (Development)

### Step 1: Install Stripe CLI

**macOS (Homebrew):**
```bash
brew install stripe/stripe-cli/stripe
```

**Windows (Scoop):**
```bash
scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
scoop install stripe
```

**Windows (Direct Download):**
1. Download from: https://github.com/stripe/stripe-cli/releases
2. Extract to `C:\stripe`
3. Add to PATH: `C:\stripe`

**Linux:**
```bash
wget https://github.com/stripe/stripe-cli/releases/download/v1.19.4/stripe_1.19.4_linux_x86_64.tar.gz
tar -xvf stripe_1.19.4_linux_x86_64.tar.gz
sudo mv stripe /usr/local/bin
```

**Verify Installation:**
```bash
stripe --version
```

### Step 2: Login to Stripe CLI

```bash
stripe login
```

This will:
1. Open browser for authentication
2. Connect CLI to your Stripe account
3. Store API credentials locally

**Verify login:**
```bash
stripe config --list
```

### Step 3: Forward Webhooks to Localhost

**Start your backend locally first:**
```bash
cd audacious_money_backend
bun run src/index.ts
```

Backend should be running on `http://localhost:3001`

**In a new terminal, forward webhooks:**
```bash
stripe listen --forward-to localhost:3001/stripe/webhook
```

**You'll see output:**
```
> Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxx (^C to quit)
```

**Copy this signing secret!** This is your **local development webhook secret**.

### Step 4: Add Local Webhook Secret to .env

Edit `audacious_money_backend/.env.local`:

```bash
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

**Restart backend** to pick up new environment variable.

### Step 5: Trigger Test Events

**In another terminal:**

```bash
# Test checkout completion
stripe trigger checkout.session.completed

# Test successful invoice payment
stripe trigger invoice.payment_succeeded

# Test subscription created
stripe trigger customer.subscription.created

# Test subscription updated
stripe trigger customer.subscription.updated

# Test subscription deleted
stripe trigger customer.subscription.deleted

# Test failed payment
stripe trigger invoice.payment_failed
```

**Check backend logs** to verify events are being processed.

### Step 6: Test Real Checkout Flow

1. Create a test product in Stripe (test mode)
2. Create a checkout session from your frontend
3. Complete checkout with test card: `4242 4242 4242 4242`
4. Watch webhook events flow through in real-time

**Test cards:**
- `4242 4242 4242 4242` - Success
- `4000 0000 0000 0002` - Declined
- `4000 0000 0000 9995` - Insufficient funds

---

## Staging/Test Environment (Optional)

If you have a staging environment, create a separate webhook:

### Create Staging Webhook

1. In Stripe Dashboard, **switch to Test Mode**
2. Navigate: **Developers → Webhooks**
3. Click **"Add endpoint"**
4. Configure:
   - **Endpoint URL:** `https://api-staging.audacious.money/stripe/webhook`
   - **Description:** `Staging Webhook - Audacious Money`
   - **Events:** Same 8 events as production
5. Get signing secret (different from production)
6. Add to staging environment variables

### Benefits of Staging Webhook

- Test production-like webhook flow
- Test with real Stripe test mode data
- Verify deployments before production
- Safe environment for testing edge cases

---

## Monitoring & Debugging

### Stripe Dashboard Monitoring

**View Webhook Health:**
1. Stripe Dashboard → **Developers → Webhooks**
2. Click on your endpoint
3. Check metrics:
   - **Delivery rate:** Should be 100%
   - **Error rate:** Should be 0%
   - **Average response time:** < 500ms recommended
   - **Events sent:** Total count

**Set Up Alerts:**
1. Stripe Dashboard → **Developers → Webhooks → Alerts**
2. Configure email alerts for:
   - Failed deliveries
   - High error rate
   - Slow response times

### Backend Monitoring

**Log All Webhook Processing:**

Your backend should log:
- ✅ Successful webhook processing
- ❌ Failed webhook processing
- ⚠️ Partial failures (event received but database update failed)
- 🔍 Event details (type, ID, timestamp)

**Check Database Updates:**

After webhook processing, verify:
- `user_products` table updated (subscription access)
- `payments` table updated (payment records)
- `stripe_webhook_events` table has record
- User received email notification (if applicable)

**Query webhook events:**
```sql
SELECT id, type, created_at, processed_at, error
FROM stripe_webhook_events
ORDER BY created_at DESC
LIMIT 20;
```

### Common Monitoring Queries

**Find failed webhooks:**
```sql
SELECT id, type, error, created_at
FROM stripe_webhook_events
WHERE error IS NOT NULL
ORDER BY created_at DESC;
```

**Find unprocessed webhooks:**
```sql
SELECT id, type, created_at
FROM stripe_webhook_events
WHERE processed_at IS NULL
AND created_at < NOW() - INTERVAL '5 minutes';
```

**Webhook processing time:**
```sql
SELECT type,
       AVG(processed_at - created_at) as avg_processing_time,
       MAX(processed_at - created_at) as max_processing_time
FROM stripe_webhook_events
WHERE processed_at IS NOT NULL
GROUP BY type;
```

---

## Webhook Security

### Signature Verification

**How Stripe Signs Webhooks:**

1. Stripe creates a signature using your webhook secret
2. Signature includes timestamp to prevent replay attacks
3. Signature sent in `Stripe-Signature` header

**How Backend Verifies:**

```typescript
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const event = stripe.webhooks.constructEvent(
  request.body,
  request.headers['stripe-signature'],
  process.env.STRIPE_WEBHOOK_SECRET
);
```

**If signature is invalid:**
- Returns `401 Unauthorized`
- Event is not processed
- Stripe will retry (up to 3 days)

### Why This Prevents Spoofing

Without signature verification, attackers could:
- Send fake subscription events (grant themselves access)
- Send fake cancellation events (revoke competitor access)
- Send fake payment events (trigger unwanted actions)

**Signature verification ensures:**
- ✅ Event actually came from Stripe
- ✅ Payload wasn't modified in transit
- ✅ Event is recent (not replayed)

### Idempotency

**Problem:** Stripe may send the same webhook multiple times if:
- Network error during delivery
- Timeout waiting for response
- Manual retry from dashboard

**Solution:** Use event ID to prevent duplicate processing:

```typescript
// Check if event already processed
const existing = await db.query(
  'SELECT id FROM stripe_webhook_events WHERE id = $1',
  [event.id]
);

if (existing.rows.length > 0) {
  // Already processed, return 200 OK
  return res.status(200).json({ received: true });
}

// Process event...
// Store event ID to prevent future duplicates
```

**Best Practice:**
- Store all webhook event IDs
- Check for duplicates before processing
- Return `200 OK` for duplicates (prevents retries)

### Error Handling Best Practices

**Return 200 OK for Processed Events:**

Even if processing fails, return `200 OK` if event was received correctly:

```typescript
try {
  await processWebhook(event);
  return res.status(200).json({ received: true });
} catch (error) {
  // Log error for investigation
  logger.error('Webhook processing failed', error);

  // Still return 200 OK to prevent retries
  // (We'll manually retry after fixing issue)
  return res.status(200).json({ received: true, error: error.message });
}
```

**When to Return Error Status:**

Only return error status if:
- ❌ Signature verification fails → `401 Unauthorized`
- ❌ Invalid JSON payload → `400 Bad Request`
- ❌ Missing required headers → `400 Bad Request`

**Don't return error status for:**
- ✅ Database update fails → Log error, return 200 OK
- ✅ Email sending fails → Log error, return 200 OK
- ✅ External API call fails → Log error, return 200 OK

**Why:** Returning error causes Stripe to retry indefinitely, which can cause duplicate processing issues.

---

## Event Processing Details

### 1. checkout.session.completed

**What Triggers It:**
- User completes checkout flow
- Payment is successful
- Subscription is created

**Backend Actions:**
1. Extract `customer_id`, `subscription_id` from event
2. Create or update `user_products` record
3. Grant access to purchased product
4. Send welcome email to user

**Expected Outcome:**
- User has active subscription in database
- User can access product features
- User receives confirmation email

**Common Errors:**
- User not found (customer_id doesn't match database)
- Product not found (price_id doesn't match product)
- Duplicate subscription (user already has active subscription)

---

### 2. invoice.payment_succeeded

**What Triggers It:**
- Subscription renewal payment succeeds
- One-time payment succeeds
- Trial period ends and payment succeeds

**Backend Actions:**
1. Create or update `payments` table record
2. Update subscription `current_period_end`
3. Ensure user access is active
4. Send receipt email

**Expected Outcome:**
- Payment record in database
- Subscription period extended
- User receives receipt

**Common Errors:**
- Subscription not found
- Invoice amount mismatch
- Email sending failure

---

### 3. invoice.payment_failed

**What Triggers It:**
- Subscription renewal payment fails
- Card declined
- Card expired
- Insufficient funds

**Backend Actions:**
1. Update subscription status to `past_due`
2. Create failed payment record
3. Send payment failed email to user
4. Trigger dunning sequence (retry logic)

**Expected Outcome:**
- Subscription status updated
- User notified of failure
- Stripe automatically retries (default: 4 attempts over 3 weeks)

**Common Errors:**
- User email not found
- Notification sending failure

**User Experience:**
- Access may be limited (depending on grace period)
- User sees "Payment Failed" banner
- User prompted to update payment method

---

### 4. customer.subscription.created

**What Triggers It:**
- New subscription created via API
- Checkout session completes
- Customer upgrades from trial

**Backend Actions:**
1. Create `user_products` record
2. Set `status = 'active'` or `status = 'trialing'`
3. Set `current_period_start` and `current_period_end`
4. Grant product access

**Expected Outcome:**
- User has active subscription
- Access enabled immediately
- Trial period respected if applicable

**Common Errors:**
- Duplicate subscription
- Invalid product mapping
- User not found

---

### 5. customer.subscription.updated

**What Triggers It:**
- Subscription plan changed (upgrade/downgrade)
- Subscription canceled (but still active until period end)
- Payment method updated
- Trial ends
- Renewal occurs

**Backend Actions:**
1. Update subscription record fields:
   - `status`
   - `current_period_start`
   - `current_period_end`
   - `cancel_at_period_end`
2. Update `user_products` access if plan changed
3. Send notification if significant change (upgrade, cancellation)

**Expected Outcome:**
- Database matches Stripe state
- User access reflects current plan
- User notified of changes

**Common Errors:**
- Subscription not found
- Field mapping errors

---

### 6. customer.subscription.deleted

**What Triggers It:**
- Subscription period ended after cancellation
- Trial expired without payment method
- Subscription manually deleted in Stripe
- All payment retries failed (after past_due period)

**Backend Actions:**
1. Update subscription `status = 'canceled'`
2. Set `canceled_at` timestamp
3. Revoke product access in `user_products`
4. Send cancellation confirmation email

**Expected Outcome:**
- User loses access to product
- Subscription marked canceled
- User receives confirmation

**Common Errors:**
- Subscription already canceled
- Access revocation failure

---

### 7. payment_intent.succeeded

**What Triggers It:**
- One-time payment succeeds
- Manual payment processed
- Payment Intent confirmed

**Backend Actions:**
1. Create payment record
2. Process one-time purchase (if applicable)
3. Add credits/usage (if applicable)
4. Send receipt

**Expected Outcome:**
- Payment recorded
- Purchase fulfilled
- Receipt sent

**Common Errors:**
- Payment already processed (duplicate)
- Product fulfillment failure

---

### 8. payment_intent.payment_failed

**What Triggers It:**
- One-time payment fails
- Card declined
- Authentication required but not completed

**Backend Actions:**
1. Create failed payment record
2. Send payment failed notification
3. Log for manual review

**Expected Outcome:**
- Failure logged
- User notified
- Manual review if needed

**Common Errors:**
- Notification sending failure

---

## Troubleshooting

### Issue 1: Signature Verification Fails

**Symptoms:**
- Webhook attempts show `401 Unauthorized`
- Backend logs: "Webhook signature verification failed"

**Causes:**
- Wrong webhook secret in environment variables
- Webhook secret from test mode used in production
- Environment variable not loaded (need deployment)

**Solutions:**

1. **Verify signing secret:**
   ```bash
   # Check Digital Ocean environment variables
   # Ensure STRIPE_WEBHOOK_SECRET matches Stripe Dashboard
   ```

2. **Check mode (test vs live):**
   - Production webhook needs live mode secret (starts with `whsec_`)
   - Test webhook needs test mode secret (different value)

3. **Redeploy backend:**
   ```bash
   # In Digital Ocean: Actions → Force Rebuild and Deploy
   ```

4. **Check raw body parsing:**
   - Backend must receive raw body (not parsed JSON)
   - Stripe needs raw bytes to verify signature

---

### Issue 2: Events Not Being Received

**Symptoms:**
- Stripe Dashboard shows events sent
- Backend logs show no webhook events
- "Webhook attempts" tab shows timeouts

**Causes:**
- Endpoint URL incorrect
- Backend not running
- Firewall blocking requests
- Route not configured

**Solutions:**

1. **Verify endpoint URL:**
   ```
   https://api.audacious.money/stripe/webhook
   ```
   Not: `http://` (must be HTTPS)
   Not: `localhost` (not accessible from internet)

2. **Check backend deployment:**
   ```bash
   curl https://api.audacious.money/health
   # Should return 200 OK
   ```

3. **Check route exists:**
   - Verify `/stripe/webhook` route defined in backend
   - Check middleware not blocking requests

4. **Check firewall:**
   - Ensure port 443 open
   - Ensure no IP whitelist blocking Stripe IPs

---

### Issue 3: Backend Returns 500 Errors

**Symptoms:**
- Webhook attempts show `500 Internal Server Error`
- Events received but not processed
- Backend logs show exceptions

**Causes:**
- Database connection error
- Null reference exception
- Invalid event data structure
- Missing environment variables

**Solutions:**

1. **Check backend logs:**
   ```bash
   # Digital Ocean → Logs
   # Look for error stack traces
   ```

2. **Common fixes:**
   - Verify database connection string
   - Check all environment variables set
   - Verify event handler can process test events
   - Add error handling for edge cases

3. **Test locally:**
   ```bash
   stripe listen --forward-to localhost:3001/stripe/webhook
   stripe trigger checkout.session.completed
   # Debug locally to see full stack trace
   ```

---

### Issue 4: Database Updates Not Happening

**Symptoms:**
- Webhook returns 200 OK
- No database records created/updated
- Logs show event processed

**Causes:**
- Transaction rolled back (error during processing)
- Wrong database query (no rows affected)
- Event ID mismatch (can't find related records)
- Idempotency check preventing duplicate

**Solutions:**

1. **Check database logs:**
   ```sql
   SELECT * FROM stripe_webhook_events
   WHERE type = 'checkout.session.completed'
   ORDER BY created_at DESC;
   ```

2. **Verify event data:**
   - Check `customer_id` matches user in database
   - Check `subscription_id` exists in Stripe
   - Check product/price mapping correct

3. **Check for errors in webhook event record:**
   ```sql
   SELECT id, type, error FROM stripe_webhook_events
   WHERE error IS NOT NULL;
   ```

---

### Issue 5: Email Notifications Not Sending

**Symptoms:**
- Webhook processed successfully
- Database updated
- No email received by user

**Causes:**
- Email service not configured
- Email sending disabled in environment
- Invalid email address
- Email service quota exceeded

**Solutions:**

1. **Check email configuration:**
   ```bash
   # Verify environment variables:
   # SENDGRID_API_KEY
   # EMAIL_FROM_ADDRESS
   ```

2. **Check email logs:**
   - SendGrid dashboard → Activity Feed
   - Look for bounces, drops, blocks

3. **Test email service:**
   ```bash
   # Send test email via backend API
   curl -X POST https://api.audacious.money/test/email \
     -H "Content-Type: application/json" \
     -d '{"to":"test@example.com"}'
   ```

---

### Issue 6: Duplicate Event Processing

**Symptoms:**
- Same webhook event processed multiple times
- Duplicate database records
- Multiple emails sent

**Causes:**
- Missing idempotency check
- Event ID not stored/checked
- Race condition (multiple servers)

**Solutions:**

1. **Add idempotency check:**
   ```typescript
   const existing = await db.query(
     'SELECT id FROM stripe_webhook_events WHERE id = $1',
     [event.id]
   );
   if (existing.rows.length > 0) {
     return res.status(200).json({ received: true });
   }
   ```

2. **Use database constraints:**
   ```sql
   ALTER TABLE stripe_webhook_events
   ADD CONSTRAINT unique_event_id UNIQUE (id);
   ```

3. **Check for race conditions:**
   - Multiple servers processing same event
   - Use database locks or transactions

---

### Issue 7: Webhook Delivery Delays

**Symptoms:**
- Events appear in Stripe dashboard
- Backend receives events 5+ minutes later
- Out-of-order event processing

**Causes:**
- Stripe retry logic (after initial failure)
- Network latency
- Backend slow response time
- Event queue backlog

**Solutions:**

1. **Check backend response time:**
   - Should be < 500ms
   - Optimize slow database queries
   - Move heavy processing to background jobs

2. **Check Stripe retry schedule:**
   - Stripe retries failed webhooks for up to 3 days
   - Delays increase: 5s, 15s, 30s, 1m, 5m, 30m, 1h, 3h, 12h

3. **Process events asynchronously:**
   ```typescript
   // Return 200 OK immediately
   res.status(200).json({ received: true });

   // Process in background
   queue.add('process-webhook', { eventId: event.id });
   ```

---

### Issue 8: Test Mode vs Production Mode Confusion

**Symptoms:**
- Test webhooks work, production webhooks fail
- Can't find subscription in database
- Events appear in wrong mode

**Causes:**
- Using test API key in production
- Using production webhook secret with test events
- Wrong mode selected in Stripe dashboard

**Solutions:**

1. **Verify API keys match environment:**
   - Test mode: `sk_test_xxxxx`
   - Production mode: `sk_live_xxxxx`

2. **Verify webhook secrets match mode:**
   - Test webhook: Test mode secret
   - Production webhook: Live mode secret
   - Different values!

3. **Check Stripe dashboard mode:**
   - Look for "Test Mode" toggle (top right)
   - Production should show "Live Mode"

---

## Quick Reference

### Webhook Events Summary

| Event | Trigger | Action | Database Tables |
|-------|---------|--------|----------------|
| `checkout.session.completed` | Checkout complete | Create subscription | `user_products` |
| `invoice.payment_succeeded` | Payment succeeds | Record payment | `payments` |
| `invoice.payment_failed` | Payment fails | Update status | `payments`, `user_products` |
| `customer.subscription.created` | New subscription | Grant access | `user_products` |
| `customer.subscription.updated` | Subscription changes | Update status | `user_products` |
| `customer.subscription.deleted` | Subscription ends | Revoke access | `user_products` |
| `payment_intent.succeeded` | One-time payment OK | Record payment | `payments` |
| `payment_intent.payment_failed` | One-time payment fails | Log failure | `payments` |

### Response Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Event processed |
| 401 | Unauthorized | Signature verification failed |
| 404 | Not Found | Endpoint doesn't exist |
| 500 | Server Error | Backend exception |
| Timeout | No response | Backend not reachable |

### Stripe CLI Commands

```bash
# Login to Stripe
stripe login

# Forward webhooks to localhost
stripe listen --forward-to localhost:3001/stripe/webhook

# Trigger test events
stripe trigger checkout.session.completed
stripe trigger invoice.payment_succeeded
stripe trigger customer.subscription.deleted

# View recent events
stripe events list

# View specific event
stripe events retrieve evt_xxxxx

# Test API connection
stripe config --list
```

### Environment Variables

```bash
# Production
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx

# Test/Local
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx  # Different from production!
```

---

## Next Steps

After webhook configuration is complete:

1. ✅ Test all 8 webhook events
2. ✅ Verify database updates for each event type
3. ✅ Test email notifications
4. ✅ Monitor webhook delivery rate (should be 100%)
5. ✅ Set up alerts for webhook failures
6. ✅ Document any custom event processing logic

**Your webhook integration is now production-ready!** 🎉

---

## Support

**Issues with webhooks?**
1. Check troubleshooting section above
2. Review backend logs in Digital Ocean
3. Check Stripe Dashboard webhook attempts
4. Test locally with Stripe CLI

**Still stuck?**
- Stripe support: https://support.stripe.com
- Stripe community: https://discord.gg/stripe
- Documentation: https://stripe.com/docs/webhooks

---

**Document Version:** 1.0
**Last Updated:** 2026-03-22
**Stripe API Version:** 2024-11-20.acacia
