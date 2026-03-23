# Webhook Testing Guide

This document describes how to test Stripe webhooks locally and verify integration.

---

## Quick Start

### 1. Verify Stripe Integration

Before testing webhooks, verify your Stripe configuration:

```bash
cd audacious_money_backend
bun run scripts/verify-stripe-integration.ts
```

This checks:
- ✅ Environment variables are set
- ✅ API key format is valid
- ✅ Webhook secret is configured
- ✅ Stripe API connection works
- ✅ Products and prices exist
- ✅ Webhook endpoints are configured (production only)

---

### 2. Test Webhooks Locally

**Prerequisites:**
- Backend running on localhost:3001
- Stripe CLI installed and authenticated

**Linux/macOS:**
```bash
./scripts/test-webhook.sh
```

**Windows:**
```bash
scripts\test-webhook.bat
```

These scripts will:
1. Check prerequisites (Stripe CLI, backend running)
2. Forward webhooks to localhost
3. Trigger all 8 required webhook events
4. Verify events are processed

---

## Webhook Events Tested

The test script triggers these 8 events:

1. **checkout.session.completed** - User completes checkout
2. **invoice.payment_succeeded** - Payment succeeds
3. **invoice.payment_failed** - Payment fails
4. **customer.subscription.created** - New subscription
5. **customer.subscription.updated** - Subscription changes
6. **customer.subscription.deleted** - Subscription canceled
7. **payment_intent.succeeded** - One-time payment succeeds
8. **payment_intent.payment_failed** - One-time payment fails

---

## Manual Testing

### Step 1: Start Backend

```bash
cd audacious_money_backend
bun run src/index.ts
```

### Step 2: Start Webhook Forwarding

```bash
stripe listen --forward-to localhost:3001/stripe/webhook
```

Copy the webhook signing secret shown (starts with `whsec_`).

### Step 3: Update Local Environment

Add to `.env.local`:
```bash
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

Restart backend to pick up new secret.

### Step 4: Trigger Events

In another terminal:

```bash
# Test individual events
stripe trigger checkout.session.completed
stripe trigger invoice.payment_succeeded
stripe trigger customer.subscription.deleted
```

### Step 5: Verify Processing

Check backend logs for:
```
[STRIPE WEBHOOK] Received event: checkout.session.completed
[STRIPE WEBHOOK] Processing event ID: evt_xxxxx
[STRIPE WEBHOOK] Successfully processed
```

Check database:
```sql
SELECT * FROM stripe_webhook_events
ORDER BY created_at DESC
LIMIT 10;
```

---

## Production Setup

For production webhook configuration, see the comprehensive guide:

**[docs/STRIPE_WEBHOOK_CONFIGURATION.md](../docs/STRIPE_WEBHOOK_CONFIGURATION.md)**

This guide covers:
- Step-by-step webhook setup in Stripe Dashboard
- Security configuration
- Monitoring and debugging
- Troubleshooting common issues
- Event processing details

---

## Troubleshooting

### Stripe CLI Not Found

**Install Stripe CLI:**

**macOS:**
```bash
brew install stripe/stripe-cli/stripe
```

**Windows:**
```bash
scoop install stripe
```

**Or download:** https://github.com/stripe/stripe-cli/releases

### Backend Not Running

```bash
cd audacious_money_backend
bun run src/index.ts
```

Verify:
```bash
curl http://localhost:3001/health
```

### Signature Verification Fails

1. Check webhook secret matches:
   ```bash
   # Should match output from 'stripe listen'
   echo $STRIPE_WEBHOOK_SECRET
   ```

2. Restart backend after changing .env

3. Verify raw body parsing (Stripe needs raw bytes)

---

## Next Steps

After local testing succeeds:

1. ✅ Deploy backend to production (Task 6.2)
2. ✅ Configure production webhook in Stripe Dashboard (Task 6.3)
3. ✅ Test production webhook delivery
4. ✅ Monitor webhook success rate

---

## Resources

- **Full Webhook Guide:** [docs/STRIPE_WEBHOOK_CONFIGURATION.md](../docs/STRIPE_WEBHOOK_CONFIGURATION.md)
- **Script Documentation:** [scripts/README.md](scripts/README.md)
- **Stripe Webhook Docs:** https://stripe.com/docs/webhooks
- **Stripe CLI Docs:** https://stripe.com/docs/stripe-cli

---

**Last Updated:** 2026-03-22
