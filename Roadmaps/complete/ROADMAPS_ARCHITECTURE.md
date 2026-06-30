# Audacious Money - System Architecture

> Complete system architecture for the zero-knowledge financial platform ecosystem

## 🚨 CONTRADICTIONS FLAGGED

**README.md vs. Current Architecture:**
1. ❌ README says "Graceful Books" - Now "Audacious Money"
2. ❌ README pricing: "$40/month" - Now multi-product with different pricing
3. ❌ README deployment: "Vercel" - Now Digital Ocean + Cloudflare Pages
4. ⚠️ README Business Phases: May not apply to multi-product structure

---

## Overview

Audacious Money is a zero-knowledge financial platform consisting of:
- **6 standalone products** (Budgeting, Debt Mgmt, CPG, CPU, Service Provider Mgmt, Fractional CFO)
- **1 full suite** (Bookkeeping - includes everything except CFO premium features)
- **Marketing site** to showcase products
- **Business backend** for accounts, payments, subscriptions
- **Sync relay** for zero-knowledge data synchronization
- **Admin dashboard** for business operations

---

## System Components

```
┌─────────────────────────────────────────────────────────────┐
│              AUDACIOUS MONEY ARCHITECTURE                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. MARKETING SITE                                         │
│     Domain: audacious.money                                │
│     Tech: Astro (static site generator)                    │
│     Hosting: Cloudflare Pages                              │
│     Purpose: Product pages, landing pages, marketing       │
│                                                             │
│  2. FRONTEND APPLICATION                                   │
│     Domain: app.audacious.money                            │
│     Tech: React 18 + TypeScript + Vite                     │
│     Hosting: Cloudflare Pages (static build)               │
│     Database: Dexie.js (IndexedDB, client-side)            │
│     Routes:                                                 │
│       /budgeting         → Budgeting tool                  │
│       /debt-management   → Debt management tool            │
│       /cpg               → CPG/Distributor management      │
│       /cpu               → CPU calculator                  │
│       /service-provider  → Service provider management     │
│       /cfo               → Fractional CFO views            │
│       /dashboard         → Bookkeeping suite dashboard     │
│                                                             │
│  3. BUSINESS BACKEND API                                   │
│     Domain: api.audacious.money                            │
│     Tech: Bun + Hono (TypeScript)                          │
│     Hosting: Digital Ocean App Platform                    │
│     Database: PostgreSQL (Digital Ocean Managed)           │
│     Purpose:                                                │
│       - User account management                            │
│       - Subscription/payment processing (Stripe)           │
│       - Product access control                             │
│       - Admin operations                                   │
│       - Support session management                         │
│       - Affiliate tracking                                 │
│       - Charity management                                 │
│                                                             │
│  4. SYNC RELAY SERVER                                      │
│     Domain: sync.audacious.money                           │
│     Tech: Bun + WebSocket                                  │
│     Hosting: Digital Ocean App Platform                    │
│     Purpose: Zero-knowledge data sync (encrypted only)     │
│     Note: Cannot decrypt any user data                     │
│                                                             │
│  5. ADMIN DASHBOARD                                        │
│     Domain: admin.audacious.money                          │
│     Tech: React 18 + TypeScript                            │
│     Hosting: Cloudflare Pages or Digital Ocean             │
│     Purpose: Business operations, analytics, support       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Flow Architecture

### User Signup Flow

```
1. User visits audacious.money/cpg (marketing page)
   ↓
2. Clicks "Get Started" → Redirected to app.audacious.money/signup?product=cpg
   ↓
3. Creates account (email/password) → POST api.audacious.money/auth/signup
   ↓
4. Selects charity → PUT api.audacious.money/users/:id/charity
   ↓
5. Payment flow:
   - If product = cpu: Shows pricing calculator
   - Else: Shows product price with "Upgrade to Bookkeeping Suite?" option
   - Stripe Checkout → api.audacious.money/stripe/create-checkout
   ↓
6. On successful payment:
   - Stripe webhook → api.audacious.money/stripe/webhook
   - Creates subscription record
   - Sends user to app.audacious.money/onboarding
   ↓
7. Master Passphrase Creation (client-side only):
   - User creates passphrase
   - Derives master key using Argon2id
   - Generates 5 recovery codes
   - Encrypts master key with each recovery code
   - Forces download of recovery codes
   ↓
8. For CPG users: Worksheet → Submit → Auto-populates CPG software
   For other products: Direct access to product interface
   ↓
9. User data encrypted with master key → Stored in IndexedDB
   ↓
10. Encrypted data syncs to sync.audacious.money (WebSocket)
```

### Data Storage Strategy

**LOCAL (Client-Side):**
- All financial data (transactions, budgets, forecasts, etc.)
- Master key (encrypted with passphrase)
- Recovery codes (encrypted with account password)
- User preferences for UI

**BUSINESS BACKEND (PostgreSQL):**
- User account (email, hashed password, Support Key)
- Subscriptions (products owned, status, trial end dates)
- Payments (Stripe payment history)
- Charity selections
- Affiliate tracking
- Admin operations logs
- Support session grants

**SYNC RELAY:**
- Encrypted data blobs (zero-knowledge)
- Sync metadata (device IDs, timestamps)
- NO decryption keys

---

## Zero-Knowledge Architecture

### The Two-Key System

**1. Account Password** (Server-Side Hash)
- Used to log into app.audacious.money
- Hashed with bcrypt/argon2 and stored in PostgreSQL
- Can be reset via email
- Grants access to ACCOUNT

**2. Master Passphrase** (Client-Side Only)
- Used to derive encryption key
- NEVER sent to server
- NEVER stored anywhere (except encrypted in recovery codes)
- Cannot be reset (only recovered via recovery codes)
- Grants access to DATA

### Encryption Flow

```
User creates master passphrase
        ↓
Argon2id derives master key
        ↓
Master key encrypts all user data
        ↓
Master key itself is encrypted with:
  - Account password (for quick access)
  - 5 recovery codes (for recovery)
        ↓
Encrypted master key stored in IndexedDB
        ↓
User financial data encrypted with master key
        ↓
Encrypted data synced to relay (still encrypted)
```

### Recovery Process

**If user forgets account password:**
1. Email reset link → api.audacious.money/auth/reset-password
2. Create new account password
3. Re-encrypt master key with new password
4. User data unaffected

**If user forgets master passphrase:**
1. Use one of 5 recovery codes
2. Recovery code decrypts master key
3. User creates NEW master passphrase
4. Master key re-encrypted with new passphrase
5. User data unaffected

**If user loses BOTH passphrase AND all recovery codes:**
- Data is PERMANENTLY LOST
- This is the cost of zero-knowledge
- User can create new account, start fresh

---

## Product Access Control

### Product Entitlement System

**Database tracks:**
- `user_products` table links users to products
- `status`: 'trial', 'active', 'cancelled', 'expired'
- `trial_ends_at`: Date when trial ends
- `activated_at`: When user first activated this product
- `cancelled_at`: When subscription was cancelled

**Frontend checks:**
- On app load → GET api.audacious.money/users/me/products
- Returns array of entitled products
- React router shows/hides routes based on entitlements
- Inactive product nodes shown greyed out on financial web

**Financial Web Visualization:**
```
User with only CPG:
  [CPG] ← Active node (clickable, colorful)
  [Budgeting] ← Greyed out + "Upgrade" button
  [Debt Mgmt] ← Greyed out + "Upgrade" button
  [Dashboard] ← Greyed out + "Upgrade to Bookkeeping Suite" button

User with Bookkeeping Suite:
  [CPG] ← Active
  [Budgeting] ← Active
  [Debt Mgmt] ← Active
  [CPU] ← Active
  [Service Provider] ← Active
  [Dashboard] ← Active (central node)
  [CFO] ← Greyed out + "Upgrade to Fractional CFO"
```

---

## Multi-Product Subscription Logic

### Pricing Rules

```typescript
// Product pricing
const PRODUCTS = {
  budgeting: { price: 10, charity: 5, revenue: 5 },
  debt_management: { price: 20, charity: 5, revenue: 15 },
  service_provider: { price: 30, charity: 5, revenue: 25 },
  bookkeeping: { price: 40, charity: 5, revenue: 35 }, // Includes all except CFO
  cpu: { price: 5, perProduct: true, max: 50, charity: 5 }, // $5/product, max $50
  fractional_cfo: { price: 60, charity: 5, revenue: 55 }, // Includes everything + CFO features
}

// Charity calculation
// User has: Budgeting ($10) + CPG ($30) = $40/month total
// Charity donation: $5 + $5 = $10/month (per product)
// Revenue to Audacious Money: $5 + $25 = $30/month
```

### Upgrade Logic

**Standalone → Full Suite:**
```
User has: CPG ($30/mo, $5 to charity)
Upgrades to: Bookkeeping Suite ($40/mo, $5 to charity)

Stripe flow:
1. Cancel CPG subscription
2. Create Bookkeeping subscription
3. Prorate remaining CPG payment toward Bookkeeping
4. User now has access to all products (except CFO premium features)
```

**Full Suite → Fractional CFO:**
```
User has: Bookkeeping ($40/mo)
Upgrades to: Fractional CFO ($60/mo)

Stripe flow:
1. Cancel Bookkeeping subscription
2. Create Fractional CFO subscription
3. Prorate remaining Bookkeeping payment
4. User now has access to EVERYTHING + client accounts
```

### Trial Logic

- **14 days per product**
- First product: Gets trial
- Additional products added during trial: Get their own 14-day trial
- Additional products added after trial: Paid immediately
- Trial status tracked per product in `user_products.trial_ends_at`

---

## Support Session Architecture

### The Support Key System

**On user signup:**
```
1. Generate unique Support Key (e.g., "AM-7K3M-9PQR-5XWZ")
2. Store in users.support_key (indexed for fast lookup)
3. Display to user: "Save this key! Provide it to support if you need help."
4. Also visible in app settings at all times
```

**When user needs support:**
```
1. User contacts support, provides Support Key
2. Admin looks up user by Support Key in admin dashboard
3. Admin can see:
   - Email, subscription status, products owned
   - Payment history
   - Support session history
   - But CANNOT see financial data (zero-knowledge)

4. If user wants support to see their books:
   - User clicks "Grant Support Access" in app
   - Generates temporary session token (24hr expiry)
   - User provides token to support
   - Support enters token in admin dashboard
   - Admin can now decrypt and view user's data (read-only)
   - User can revoke access anytime
```

**Database tables:**
```sql
support_sessions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  session_token VARCHAR(64) UNIQUE, -- User provides this to support
  decryption_key TEXT, -- Encrypted master key, admin can decrypt
  granted_at TIMESTAMP,
  expires_at TIMESTAMP,
  revoked_at TIMESTAMP,
  accessed_by UUID REFERENCES admin_users(id),
  access_type VARCHAR(20) -- 'admin_only' or 'books_access'
)
```

---

## Deactivation & Reactivation

### When User Cancels Subscription

**What happens:**
1. Subscription status → 'cancelled'
2. Access continues until billing period ends
3. On period end:
   - Product features disabled in UI
   - Financial web node greyed out
   - Data export STILL AVAILABLE (CSV + JSON)
   - Filter/search STILL WORKS (for generating exports)
   - Visualizations, dashboards, insights DISABLED

**Data retention:**
- User account data: **Kept indefinitely**
- Subscription history: **Kept indefinitely**
- User's financial data: **Kept indefinitely** (it's local + encrypted on relay)

**What user CAN do while deactivated:**
- Log in
- View read-only data
- Export data (CSV/JSON)
- Use search/filters to generate exports
- Reactivate subscription

**What user CANNOT do while deactivated:**
- Add/edit/delete transactions
- Generate reports/visualizations
- Use dashboards
- Access insights/forecasting

### Reactivation

```
1. User logs in → Sees "Reactivate" button on deactivated product node
2. Clicks reactivate → Shows CURRENT pricing (not old pricing)
3. Stripe checkout for current price
4. No trial (trial only for NEW products)
5. On payment success:
   - Product reactivated immediately
   - All features unlocked
   - Data intact (was never deleted)
```

---

## Affiliate System

### Affiliate Link Structure

```
https://audacious.money/cpg?ref=PARTNER123
https://audacious.money/budgeting?ref=COACH456
https://app.audacious.money/signup?product=cpg&ref=PARTNER123
```

**Tracking Flow:**
```
1. User clicks affiliate link
2. Frontend stores ref code in localStorage (90-day cookie)
3. On signup → Sends ref code to API
4. API creates affiliate_conversions record
5. On payment → Updates conversion with revenue data
6. Commission calculated based on admin-set rules
```

**Database Schema:**
```sql
affiliates (
  id UUID PRIMARY KEY,
  code VARCHAR(50) UNIQUE, -- e.g., "PARTNER123"
  name VARCHAR(255),
  email VARCHAR(255),
  commission_type VARCHAR(20), -- 'percentage' or 'flat'
  commission_value DECIMAL, -- e.g., 20.00 for 20% or 10.00 for $10
  commission_duration INTEGER, -- months of recurring commission (0 = first payment only)
  created_at TIMESTAMP,
  active BOOLEAN DEFAULT true
)

affiliate_conversions (
  id UUID PRIMARY KEY,
  affiliate_id UUID REFERENCES affiliates(id),
  user_id UUID REFERENCES users(id),
  product VARCHAR(50),
  converted_at TIMESTAMP,
  first_payment_amount DECIMAL,
  commission_earned DECIMAL,
  commission_paid BOOLEAN DEFAULT false,
  commission_paid_at TIMESTAMP
)
```

---

## Technology Decisions

### Frontend
- **React 18.3+** - Component framework (already chosen)
- **TypeScript 5.3+** - Type safety
- **Vite** - Build tool, fast dev server
- **Dexie.js** - IndexedDB wrapper for local data
- **argon2-browser** - Key derivation
- **Web Crypto API** - Encryption
- **Recharts** - Data visualization (already in use for CPG)

### Backend
- **Bun** - JavaScript runtime (3x faster than Node.js)
- **Hono** - Web framework (lightweight, fast)
- **PostgreSQL** - Relational database
- **Stripe SDK** - Payment processing
- **Zod** - Runtime validation (already in package.json)

### Infrastructure
- **Cloudflare Pages** - Frontend hosting (static)
- **Digital Ocean App Platform** - Backend hosting
- **Digital Ocean Managed PostgreSQL** - Database
- **SendGrid/Twilio** - Transactional emails

---

## Security Architecture

### Rate Limiting
- API endpoints: 100 req/min per IP
- Auth endpoints: 5 req/min per IP
- Stripe webhooks: Verified signatures only

### CORS Policy
```
Allowed Origins:
- https://audacious.money
- https://app.audacious.money
- https://admin.audacious.money
```

### API Authentication
```
Public endpoints (no auth):
- POST /auth/signup
- POST /auth/login
- POST /auth/reset-password
- POST /stripe/webhook (verified via Stripe signature)

Protected endpoints (requires JWT):
- GET /users/me
- GET /users/me/products
- PUT /users/:id/charity
- All other user-specific endpoints

Admin endpoints (requires admin JWT):
- All /admin/* routes
- Support session creation/management
```

### Data Encryption Standards
- **At rest:** AES-256-GCM (user data)
- **In transit:** TLS 1.3+ (all connections)
- **Key derivation:** Argon2id (time=3, memory=65536, parallelism=4)
- **Password hashing:** Argon2id or bcrypt (account passwords)

---

## File Structure (Recommended)

```
audacious_money_backend/
├── src/
│   ├── index.ts              # Bun server entry point
│   ├── app.ts                # Hono app configuration
│   ├── routes/
│   │   ├── auth.ts           # Auth endpoints
│   │   ├── users.ts          # User management
│   │   ├── products.ts       # Product entitlements
│   │   ├── stripe.ts         # Stripe integration
│   │   ├── support.ts        # Support sessions
│   │   ├── affiliates.ts     # Affiliate tracking
│   │   ├── charities.ts      # Charity management
│   │   └── admin/
│   │       ├── analytics.ts  # Business analytics
│   │       ├── users.ts      # User management
│   │       ├── discounts.ts  # Discount codes
│   │       └── support.ts    # Support dashboard
│   ├── services/
│   │   ├── auth.service.ts
│   │   ├── stripe.service.ts
│   │   ├── email.service.ts
│   │   └── crypto.service.ts
│   ├── db/
│   │   ├── client.ts         # PostgreSQL client
│   │   ├── migrations/       # Database migrations
│   │   └── schema.sql        # Database schema
│   ├── middleware/
│   │   ├── auth.ts           # JWT verification
│   │   ├── rateLimit.ts      # Rate limiting
│   │   └── errorHandler.ts   # Error handling
│   ├── types/
│   │   ├── api.ts            # API request/response types
│   │   └── database.ts       # Database types
│   └── utils/
│       ├── validation.ts     # Zod schemas
│       └── constants.ts      # Constants
├── Dockerfile                # For Digital Ocean deployment
├── package.json
├── bunfig.toml              # Bun configuration
└── README.md

audacious_money_sync/
├── src/
│   ├── index.ts              # WebSocket server
│   ├── handlers/
│   │   ├── connection.ts     # Connection handling
│   │   ├── sync.ts           # Sync logic
│   │   └── broadcast.ts      # Broadcast to devices
│   ├── types/
│   │   └── sync.ts           # Sync protocol types
│   └── utils/
│       └── encryption.ts     # Verify encrypted payloads
├── Dockerfile
└── package.json
```

---

## Next Steps

See individual roadmaps for detailed implementation:

1. **ROADMAPS_DATABASE.md** - Complete database schema
2. **ROADMAPS_API.md** - All API endpoints
3. **ROADMAPS_AUTHENTICATION.md** - Auth flows
4. **ROADMAPS_STRIPE.md** - Payment integration
5. **ROADMAPS_ADMIN_DASHBOARD.md** - Admin features
6. **ROADMAPS_DEPLOYMENT.md** - Digital Ocean setup

---

**Last Updated:** 2026-03-20
