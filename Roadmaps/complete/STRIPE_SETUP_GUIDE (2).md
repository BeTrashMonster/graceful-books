# Stripe API Keys Setup Guide

## Overview

Audacious Money uses Stripe for payment processing. You'll need to configure API keys in your environment files to enable subscription billing.

**IMPORTANT:** Never commit your actual API keys to git. The .gitignore files are already configured to exclude .env files.

---

## Step 1: Get Your Stripe API Keys

1. Go to: https://dashboard.stripe.com/test/apikeys
2. Sign in to your Stripe account (or create one if needed)
3. You'll see two types of keys:

   **Secret key** (starts with `sk_test_`)
   - Used by your backend server
   - NEVER expose this in frontend code
   - Keep this confidential
   
   **Publishable key** (starts with `pk_test_`)
   - Used by your frontend/React app
   - Safe to expose in client-side code

---

## Step 2: Update Backend .env File

**File location:** `C:\Users\Admin\audacious_money_backend\.env`

Find these lines:
```bash
# Stripe (get from https://dashboard.stripe.com/test/apikeys)
STRIPE_SECRET_KEY=sk_test_CHANGEME
STRIPE_WEBHOOK_SECRET=whsec_CHANGEME
```

Replace `sk_test_CHANGEME` with your actual secret key:
```bash
STRIPE_SECRET_KEY=sk_test_51AbCdEf...your_actual_key
```

**Note:** The `STRIPE_WEBHOOK_SECRET` will be configured later when you set up webhook endpoints. Leave it as-is for now.

---

## Step 3: Update Frontend .env File

**File location:** `C:\Users\Admin\graceful_books\.env`

Find this line:
```bash
# Stripe (get from https://dashboard.stripe.com/test/apikeys)
VITE_STRIPE_PUBLIC_KEY=pk_test_CHANGEME
```

Replace `pk_test_CHANGEME` with your publishable key:
```bash
VITE_STRIPE_PUBLIC_KEY=pk_test_51AbCdEf...your_actual_key
```

---

## Step 4: Verify Configuration

After updating both files:

1. **Backend:** Check that `STRIPE_SECRET_KEY` starts with `sk_test_`
2. **Frontend:** Check that `VITE_STRIPE_PUBLIC_KEY` starts with `pk_test_`
3. **Never commit these files:** Verify `.env` is in your `.gitignore`

---

## Test vs Production Keys

Currently you're using **test mode** keys (indicated by `_test_` in the key).

When you're ready for production:
- Switch to **live mode** in Stripe dashboard
- Get your production keys (they'll start with `sk_live_` and `pk_live_`)
- Update your production .env files

**Do NOT use production keys during development!**

---

## Webhook Setup (Later)

When you're ready to handle Stripe webhooks:

1. Install Stripe CLI: https://stripe.com/docs/stripe-cli
2. Run: `stripe listen --forward-to localhost:3001/api/webhooks/stripe`
3. Copy the webhook signing secret (starts with `whsec_`)
4. Update `STRIPE_WEBHOOK_SECRET` in backend .env

---

## Security Checklist

- [ ] .env files are in .gitignore
- [ ] Never shared API keys in chat/email/Slack
- [ ] Using test keys for development
- [ ] Backend uses secret key, frontend uses publishable key
- [ ] Verified keys are correct length and format

---

## Products Already Configured

Your database already has these 6 Stripe products configured:

1. **Budgeting** - $10/month ($5 charity, $5 revenue)
2. **Debt Management** - $20/month ($5 charity, $15 revenue)
3. **Service Provider Management** - $30/month ($5 charity, $25 revenue)
4. **CPU/CPG** - $15/month ($5 charity, $10 revenue)
5. **Bookkeeping Suite** - $40/month ($5 charity, $35 revenue)
6. **Fractional CFO** - $60/month ($5 charity, $55 revenue)

You'll need to create matching products in your Stripe dashboard and update the `stripe_product_id` and `stripe_price_id` fields in the database once you have them.

---

## Need Help?

- Stripe Test Keys: https://dashboard.stripe.com/test/apikeys
- Stripe Documentation: https://stripe.com/docs/api
- Stripe CLI: https://stripe.com/docs/stripe-cli

