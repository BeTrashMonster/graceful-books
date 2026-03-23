# Environment Variables for Digital Ocean App Platform Deployment

**Created:** March 22, 2026
**Purpose:** Complete list of environment variables needed for backend deployment

---

## Required Environment Variables

### Database Connection (from Phase A)
```
DATABASE_URL=postgresql://doadmin:[YOUR_PASSWORD]@audacious-money-production-do-user-34914337-0.a.db.ondigitalocean.com:25060/defaultdb
```
**Source:** Digital Ocean Database → Connection Details
**Type:** SECRET (encrypted)

---

### JWT Authentication
```
JWT_SECRET=[PASTE_YOUR_GENERATED_SECRET_HERE]
```
**Generate:** `openssl rand -hex 32`
**Type:** SECRET (encrypted)
**Note:** This secret is used to sign user authentication tokens. Keep it safe!

---

### Stripe (Payment Processing)
```
STRIPE_SECRET_KEY=sk_live_[YOUR_STRIPE_SECRET_KEY]
STRIPE_WEBHOOK_SECRET=whsec_[WILL_BE_SET_IN_PHASE_C]
```
**Source:** Stripe Dashboard → Developers → API Keys
**Type:** SECRET (encrypted)
**Note:** Use LIVE keys for production, TEST keys for staging

---

### SendGrid (Email Sending) - OPTIONAL FOR NOW
```
SENDGRID_API_KEY=SG.[YOUR_API_KEY_OR_PLACEHOLDER]
```
**Source:** SendGrid Dashboard → Settings → API Keys
**Type:** SECRET (encrypted)
**Temporary:** Use `placeholder_sendgrid_key` for now if not set up
**Impact:** Password reset emails won't work until this is configured

---

### Application URLs
```
FRONTEND_URL=https://app.audacious.money
BACKEND_URL=https://api.audacious.money
SYNC_URL=wss://sync.audacious.money
```
**Type:** PLAIN TEXT (not encrypted)
**Note:** Used for CORS configuration and webhook URLs

---

### Node Environment
```
NODE_ENV=production
```
**Type:** PLAIN TEXT
**Note:** Tells the app to run in production mode

---

## Quick Copy Template (Fill in YOUR values)

**For Digital Ocean App Platform:**

```bash
# Database
DATABASE_URL=postgresql://doadmin:[YOUR_PASSWORD]@audacious-money-production-do-user-34914337-0.a.db.ondigitalocean.com:25060/defaultdb

# Authentication
JWT_SECRET=[PASTE_FROM_openssl_rand_-hex_32]

# Stripe
STRIPE_SECRET_KEY=sk_live_[YOUR_KEY]
STRIPE_WEBHOOK_SECRET=placeholder_webhook_secret

# Email (placeholder for now)
SENDGRID_API_KEY=placeholder_sendgrid_key

# URLs
FRONTEND_URL=https://app.audacious.money
BACKEND_URL=https://api.audacious.money
SYNC_URL=wss://sync.audacious.money

# Environment
NODE_ENV=production
```

---

## Security Notes

⚠️ **NEVER commit these to git!**
- These are production secrets
- Set them ONLY in Digital Ocean dashboard
- Use "Secret" encryption for sensitive values

✅ **Safe to commit:**
- `.env.example` files with placeholders
- This documentation file (no actual secrets)

---

## What Happens If You Don't Set One?

| Variable | Impact if Missing |
|----------|-------------------|
| DATABASE_URL | ❌ App won't start (critical) |
| JWT_SECRET | ❌ Authentication won't work (critical) |
| STRIPE_SECRET_KEY | ⚠️ Payments won't work |
| STRIPE_WEBHOOK_SECRET | ⚠️ Webhook events won't process (set in Phase C) |
| SENDGRID_API_KEY | ⚠️ Password reset emails won't send |
| FRONTEND_URL | ⚠️ CORS might fail |
| BACKEND_URL | ℹ️ Minor issues with absolute URLs |
| SYNC_URL | ℹ️ Minor issues with WebSocket URLs |
| NODE_ENV | ⚠️ Will run in development mode (less secure) |

---

## Next Steps

1. ✅ Generate JWT secret
2. ✅ Collect Stripe keys from dashboard
3. ✅ Prepare this list
4. → Go to Digital Ocean App Platform
5. → Create new app
6. → Paste these variables (we'll do this together!)

