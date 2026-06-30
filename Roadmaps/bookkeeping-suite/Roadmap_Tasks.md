# Audacious Money - Consolidated Development Roadmap

> Security-first implementation roadmap with concrete, achievable tasks ordered by dependencies

**Last Updated:** 2026-03-20

---

## Overview

This roadmap consolidates all system roadmaps (Architecture, Database, API, Authentication, Stripe, Admin Dashboard, Deployment) into a single, security-focused implementation plan. Each task is designed to be completed in one focused session, with security checkpoints integrated throughout.

**Critical Security Principles:**
- Zero-knowledge encryption is non-negotiable
- IDOR prevention at every database query
- Input validation on all endpoints
- Defense in depth throughout
- Audit logging for all sensitive operations

---

## 🎯 Required Standards for All API Endpoints

All agents implementing API endpoints MUST follow these standards:

### Validation
**File:** `backend/src/utils/validation.ts` ✅ **Already Created**

- **ALWAYS** use Zod schemas for input validation
- Use `validate(schema)` middleware for request bodies
- Use `validateQuery(schema)` middleware for query parameters
- Use `validateParams(schema)` middleware for URL parameters
- All schemas are pre-defined - import from `validation.ts`

**Example:**
```typescript
import { validate, signupSchema } from '../utils/validation';

app.post('/signup', validate(signupSchema), async (c) => {
  const data = c.get('validatedData'); // Already validated
  // ...
});
```

### Response Format
**File:** `backend/src/utils/responses.ts` ✅ **Already Created**

- **ALWAYS** use standardized response helpers
- **NEVER** return raw `c.json()` - use response helpers instead

**Success responses:**
```typescript
import { success, created, paginated, noContent } from '../utils/responses';

// Simple success
return success(c, { user: {...} });

// Created resource (201)
return created(c, { user: {...} }, 'User created successfully');

// Paginated list
return paginated(c, users, { total: 150, limit: 50, offset: 0 });

// No content (204)
return noContent(c);
```

**Error responses:**
```typescript
import { notFound, conflict, unauthorized, forbidden, badRequest, ErrorCodes, ErrorMessages } from '../utils/responses';

// Not found (404)
return notFound(c, ErrorCodes.NOT_FOUND, ErrorMessages.USER_NOT_FOUND);

// Conflict (409)
return conflict(c, ErrorCodes.EMAIL_EXISTS, ErrorMessages.EMAIL_EXISTS);

// Unauthorized (401)
return unauthorized(c, ErrorCodes.UNAUTHORIZED, ErrorMessages.TOKEN_REQUIRED);

// Forbidden (403)
return forbidden(c, ErrorCodes.INSUFFICIENT_PERMISSIONS, ErrorMessages.ADMIN_REQUIRED);

// Bad request (400)
return badRequest(c, ErrorCodes.INVALID_INPUT, 'Invalid email format');
```

### IDOR Prevention
**CRITICAL:** Every query for user-owned resources MUST include `user_id` filter:

```typescript
// ❌ WRONG - Vulnerable to IDOR
const product = await db.query('SELECT * FROM user_products WHERE id = $1', [productId]);

// ✅ CORRECT - Prevents IDOR
const userId = c.get('userId'); // From auth middleware
const product = await db.query(
  'SELECT * FROM user_products WHERE id = $1 AND user_id = $2',
  [productId, userId]
);
```

### Database Files
✅ **Pre-created files** - Use these directly:
- Schema: `backend/src/db/schema.sql` (all 17 tables, indexes, functions, views, seed data)
- All product data already seeded (6 products with correct pricing)

---

## Phase 0: Foundation & Security Setup

**Objective:** Establish secure development environment and core infrastructure

### Task 0.1: Local Development Environment
**Depends on:** None

- [ ] Install Bun runtime locally (`curl -fsSL https://bun.sh/install | bash`)
- [ ] Install PostgreSQL 15 locally or use Docker
- [ ] Install Stripe CLI for webhook testing
- [ ] Set up Git repository structure
- [ ] Create `.env.example` files for all projects

**Security checkpoint:**
- [ ] Verify `.env` files are in `.gitignore`
- [ ] Generate strong JWT secret: `openssl rand -hex 32`
- [ ] Document secret management strategy

---

### Task 0.2: Database Schema Creation
**Depends on:** Task 0.1

**File:** `backend/src/db/schema.sql`

- [ ] Create all tables from ROADMAPS_DATABASE.md
- [ ] Add all indexes (performance + security)
- [ ] Create database functions (support key generation, timestamps)
- [ ] Create database views (analytics, reporting)
- [ ] Add constraints (foreign keys, check constraints)

**Critical security measures:**
```sql
-- Row-level security patterns
CREATE POLICY user_data_isolation ON user_products
  USING (user_id = current_setting('app.user_id')::uuid);

-- Prevent IDOR with compound indexes
CREATE INDEX idx_user_products_user_id_product_id
  ON user_products(user_id, product_id);

-- Ensure payment integrity
ALTER TABLE payments ADD CONSTRAINT check_payment_amounts
  CHECK (total_amount = charity_amount + revenue_amount);
```

**Security checkpoint:**
- [ ] All user-owned resources have `user_id` foreign key
- [ ] No sensitive data in plaintext (passwords hashed)
- [ ] Created admin_audit_log table
- [ ] Verified support_key uniqueness constraint

---

### Task 0.3: Database Migration System
**Depends on:** Task 0.2

**File:** `backend/src/db/migrate.ts`

- [ ] Set up Kysely or raw SQL migration system
- [ ] Create migration tracking table
- [ ] Write migration runner script
- [ ] Add rollback capability
- [ ] Document migration workflow

**Security checkpoint:**
- [ ] Migrations run in transactions
- [ ] Failed migrations auto-rollback
- [ ] Migration logs audit trail

---

### Task 0.4: Backend Project Setup (Bun + Hono)
**Depends on:** Task 0.1

**Files:** `backend/package.json`, `backend/src/index.ts`, `backend/src/app.ts`

```typescript
// backend/src/app.ts - Security-first setup
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';

const app = new Hono();

// Security middleware
app.use('/*', secureHeaders());
app.use('/*', logger());
app.use('/*', cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [],
  credentials: true,
  maxAge: 600
}));

// Rate limiting middleware
import { rateLimiter } from './middleware/rateLimit';
app.use('/auth/*', rateLimiter({ max: 5, window: 60 })); // 5 req/min
app.use('/*', rateLimiter({ max: 100, window: 60 })); // 100 req/min

export default app;
```

**Security checkpoint:**
- [ ] Rate limiting configured
- [ ] CORS whitelist only known origins
- [ ] Security headers applied
- [ ] Error handling doesn't leak stack traces

---

### Task 0.5: JWT Authentication Middleware
**Depends on:** Task 0.4

**File:** `backend/src/middleware/auth.ts`

```typescript
import { verify } from 'hono/jwt';

export const requireAuth = async (c, next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'No token provided' }}, 401);
  }

  try {
    const token = authHeader.substring(7);
    const payload = await verify(token, process.env.JWT_SECRET!);

    // CRITICAL: Set user context for IDOR prevention
    c.set('userId', payload.userId);
    c.set('userRole', payload.role);

    // Set PostgreSQL session variable for RLS
    await c.env.db.query('SET app.user_id = $1', [payload.userId]);

    await next();
  } catch (error) {
    return c.json({ error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' }}, 401);
  }
};
```

**IDOR Prevention Pattern:**
```typescript
// WRONG (vulnerable to IDOR):
const product = await db.query('SELECT * FROM user_products WHERE id = $1', [productId]);

// RIGHT (prevents IDOR):
const product = await db.query(
  'SELECT * FROM user_products WHERE id = $1 AND user_id = $2',
  [productId, c.get('userId')]
);
```

**Security checkpoint:**
- [ ] JWT secret loaded from environment (never hardcoded)
- [ ] Token expiry enforced (7 days user, 24 hours admin)
- [ ] User context set on every authenticated request
- [ ] All database queries include `user_id` filter for user-owned resources

---

### Task 0.6: Input Validation System (Zod)
**Depends on:** Task 0.4

**File:** `backend/src/utils/validation.ts`

```typescript
import { z } from 'zod';

// Reusable schemas with security in mind
export const emailSchema = z.string()
  .email()
  .max(255)
  .toLowerCase()
  .transform(email => email.trim());

export const passwordSchema = z.string()
  .min(12, 'Password must be at least 12 characters')
  .regex(/[A-Z]/, 'Must contain uppercase')
  .regex(/[a-z]/, 'Must contain lowercase')
  .regex(/[0-9]/, 'Must contain number')
  .regex(/[^A-Za-z0-9]/, 'Must contain special character');

export const uuidSchema = z.string()
  .uuid('Invalid UUID format');

// Signup request schema
export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: z.string().min(1).max(100).trim(),
  lastName: z.string().min(1).max(100).trim(),
  companyName: z.string().max(255).trim().optional(),
  affiliateCode: z.string().regex(/^[A-Z0-9]{6,50}$/).optional()
});

// Validation middleware
export const validate = (schema: z.ZodSchema) => async (c, next) => {
  try {
    const body = await c.req.json();
    const validated = schema.parse(body);
    c.set('validatedData', validated);
    await next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: error.errors
        }
      }, 400);
    }
    throw error;
  }
};
```

**Security checkpoint:**
- [ ] All user input validated before processing
- [ ] SQL injection prevented (parameterized queries + validation)
- [ ] XSS prevented (input sanitization)
- [ ] No raw user input in database queries

---

## Phase 1: Authentication & User Management

**Objective:** Implement secure two-key authentication system

### Task 1.1: User Signup Endpoint
**Depends on:** Tasks 0.5, 0.6

**File:** `backend/src/routes/auth.ts`

```typescript
import { Hono } from 'hono';
import { hash } from '@node-rs/argon2';
import { sign } from 'hono/jwt';
import { validate, signupSchema } from '../utils/validation';

const auth = new Hono();

auth.post('/signup', validate(signupSchema), async (c) => {
  const data = c.get('validatedData');

  // Check if email already exists (prevent enumeration with timing-safe compare)
  const existing = await c.env.db.query(
    'SELECT 1 FROM users WHERE email = $1',
    [data.email]
  );

  if (existing.rowCount > 0) {
    return c.json({
      error: { code: 'EMAIL_EXISTS', message: 'Email already registered' }
    }, 409);
  }

  // Hash password with Argon2id (OWASP recommended)
  const passwordHash = await hash(data.password, {
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4
  });

  // Generate unique support key (function in database)
  const result = await c.env.db.query(`
    INSERT INTO users (email, password_hash, first_name, last_name, company_name)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, email, support_key, created_at
  `, [data.email, passwordHash, data.firstName, data.lastName, data.companyName]);

  const user = result.rows[0];

  // Track affiliate if provided
  if (data.affiliateCode) {
    await trackAffiliateSignup(c, user.id, data.affiliateCode);
  }

  // Generate JWT token
  const token = await sign({
    userId: user.id,
    email: user.email,
    role: 'user',
    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7) // 7 days
  }, process.env.JWT_SECRET!);

  // Send verification email (async, don't block)
  sendVerificationEmail(user.email, user.id).catch(console.error);

  // Audit log
  await c.env.db.query(`
    INSERT INTO admin_audit_log (action, resource_type, resource_id, ip_address)
    VALUES ('user_signup', 'user', $1, $2)
  `, [user.id, c.req.header('x-forwarded-for') || c.req.header('x-real-ip')]);

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      firstName: data.firstName,
      lastName: data.lastName,
      supportKey: user.support_key,
      emailVerified: false,
      createdAt: user.created_at
    },
    token,
    message: 'Account created successfully. Please check your email to verify.'
  }, 201);
});
```

**Security checkpoint:**
- [ ] Password hashed with Argon2id (not bcrypt)
- [ ] Email uniqueness enforced
- [ ] Support key auto-generated (not user-controlled)
- [ ] Audit log entry created
- [ ] Rate limiting applied (5 req/min)
- [ ] No password returned in response

---

### Task 1.2: User Login Endpoint
**Depends on:** Task 1.1

**File:** `backend/src/routes/auth.ts`

```typescript
import { verify as verifyPassword } from '@node-rs/argon2';

auth.post('/login', validate(loginSchema), async (c) => {
  const { email, password } = c.get('validatedData');

  // Fetch user (timing-safe to prevent enumeration)
  const result = await c.env.db.query(`
    SELECT id, email, password_hash, account_status, first_name, last_name, support_key, email_verified
    FROM users
    WHERE email = $1
  `, [email]);

  // Always verify password even if user doesn't exist (prevent timing attacks)
  const user = result.rows[0];
  const isValidPassword = user
    ? await verifyPassword(user.password_hash, password)
    : await verifyPassword('$argon2id$v=19$m=65536,t=3,p=4$fake', password);

  if (!user || !isValidPassword) {
    return c.json({
      error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' }
    }, 401);
  }

  // Check account status
  if (user.account_status !== 'active') {
    return c.json({
      error: { code: 'ACCOUNT_SUSPENDED', message: 'Your account has been suspended' }
    }, 403);
  }

  // Update last login
  await c.env.db.query(
    'UPDATE users SET last_login_at = NOW() WHERE id = $1',
    [user.id]
  );

  // Generate JWT
  const token = await sign({
    userId: user.id,
    email: user.email,
    role: 'user',
    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7)
  }, process.env.JWT_SECRET!);

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      supportKey: user.support_key,
      emailVerified: user.email_verified
    },
    token
  });
});
```

**Security checkpoint:**
- [ ] Timing-safe password comparison
- [ ] Account status checked
- [ ] Last login timestamp updated
- [ ] Failed login attempts logged (for future brute-force detection)
- [ ] Generic error messages (don't reveal if email exists)

---

### Task 1.3: Password Reset Flow
**Depends on:** Task 1.2

**Files:** `backend/src/routes/auth.ts`

```typescript
import crypto from 'crypto';

// Step 1: Request password reset
auth.post('/forgot-password', validate(forgotPasswordSchema), async (c) => {
  const { email } = c.get('validatedData');

  // Always return success (prevent email enumeration)
  const successResponse = c.json({
    message: 'If that email exists, a reset link has been sent'
  });

  // Look up user
  const result = await c.env.db.query(
    'SELECT id, email FROM users WHERE email = $1 AND account_status = $2',
    [email, 'active']
  );

  if (result.rowCount === 0) {
    return successResponse;
  }

  const user = result.rows[0];

  // Generate secure token
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  // Store token
  await c.env.db.query(`
    INSERT INTO password_reset_tokens (user_id, token, expires_at)
    VALUES ($1, $2, $3)
  `, [user.id, token, expiresAt]);

  // Send reset email (async)
  sendPasswordResetEmail(user.email, token).catch(console.error);

  return successResponse;
});

// Step 2: Reset password with token
auth.post('/reset-password', validate(resetPasswordSchema), async (c) => {
  const { token, newPassword } = c.get('validatedData');

  // Look up token
  const result = await c.env.db.query(`
    SELECT prt.id, prt.user_id, prt.expires_at, prt.used_at
    FROM password_reset_tokens prt
    WHERE prt.token = $1
  `, [token]);

  if (result.rowCount === 0) {
    return c.json({
      error: { code: 'INVALID_TOKEN', message: 'Invalid or expired reset token' }
    }, 400);
  }

  const resetToken = result.rows[0];

  // Check expiry and usage
  if (new Date() > new Date(resetToken.expires_at) || resetToken.used_at) {
    return c.json({
      error: { code: 'INVALID_TOKEN', message: 'Invalid or expired reset token' }
    }, 400);
  }

  // Hash new password
  const passwordHash = await hash(newPassword, {
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4
  });

  // Update password in transaction
  await c.env.db.query('BEGIN');

  try {
    // Update password
    await c.env.db.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [passwordHash, resetToken.user_id]
    );

    // Mark token as used
    await c.env.db.query(
      'UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1',
      [resetToken.id]
    );

    // Invalidate all existing sessions (future: implement token blacklist)
    // For now, user must re-login

    await c.env.db.query('COMMIT');

    return c.json({ message: 'Password reset successfully' });
  } catch (error) {
    await c.env.db.query('ROLLBACK');
    throw error;
  }
});
```

**Security checkpoint:**
- [ ] Reset tokens cryptographically secure (32 bytes random)
- [ ] Tokens expire after 1 hour
- [ ] Tokens single-use only
- [ ] Always return success to prevent enumeration
- [ ] All operations in transaction

---

### Task 1.4: Email Verification
**Depends on:** Task 1.1

**File:** `backend/src/routes/auth.ts`

```typescript
// Send verification email (called during signup)
async function sendVerificationEmail(email: string, userId: string) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  // Store token in database
  await db.query(`
    INSERT INTO email_verification_tokens (user_id, token, expires_at)
    VALUES ($1, $2, $3)
  `, [userId, token, expiresAt]);

  // Send email with verification link
  const verificationUrl = `${process.env.APP_URL}/verify-email?token=${token}`;
  await sendEmail({
    to: email,
    subject: 'Verify your Audacious Money account',
    html: `Click here to verify: <a href="${verificationUrl}">${verificationUrl}</a>`
  });
}

// Verify email endpoint
auth.post('/verify-email', validate(verifyEmailSchema), async (c) => {
  const { token } = c.get('validatedData');

  const result = await c.env.db.query(`
    SELECT evt.id, evt.user_id, evt.expires_at, evt.used_at
    FROM email_verification_tokens evt
    WHERE evt.token = $1
  `, [token]);

  if (result.rowCount === 0) {
    return c.json({
      error: { code: 'INVALID_TOKEN', message: 'Invalid verification token' }
    }, 400);
  }

  const verificationToken = result.rows[0];

  // Check expiry and usage
  if (new Date() > new Date(verificationToken.expires_at) || verificationToken.used_at) {
    return c.json({
      error: { code: 'INVALID_TOKEN', message: 'Token expired or already used' }
    }, 400);
  }

  // Update user and mark token as used
  await c.env.db.query('BEGIN');

  try {
    await c.env.db.query(
      'UPDATE users SET email_verified = true WHERE id = $1',
      [verificationToken.user_id]
    );

    await c.env.db.query(
      'UPDATE email_verification_tokens SET used_at = NOW() WHERE id = $1',
      [verificationToken.id]
    );

    await c.env.db.query('COMMIT');

    return c.json({ message: 'Email verified successfully' });
  } catch (error) {
    await c.env.db.query('ROLLBACK');
    throw error;
  }
});
```

**Security checkpoint:**
- [ ] Verification tokens cryptographically secure (32 bytes random)
- [ ] Tokens expire after 7 days
- [ ] Tokens single-use only
- [ ] Database table `email_verification_tokens` created in schema

---

## Phase 2: Product & Subscription Management

**Objective:** Implement secure product entitlements and trial system

### Task 2.1: Product Catalog Endpoint
**Depends on:** Task 0.6

**File:** `backend/src/routes/products.ts`

```typescript
import { Hono } from 'hono';

const products = new Hono();

// Public endpoint - no auth required
products.get('/', async (c) => {
  const result = await c.env.db.query(`
    SELECT id, slug, name, description,
           price_monthly, charity_amount, revenue_amount,
           is_usage_based, usage_unit_price, usage_max_price,
           display_order
    FROM products
    WHERE active = true
    ORDER BY display_order ASC
  `);

  return c.json({ products: result.rows });
});

// Get single product by slug
products.get('/:slug', async (c) => {
  const slug = c.req.param('slug');

  const result = await c.env.db.query(`
    SELECT id, slug, name, description,
           price_monthly, charity_amount, revenue_amount,
           is_usage_based, usage_unit_price, usage_max_price,
           display_order
    FROM products
    WHERE slug = $1 AND active = true
  `, [slug]);

  if (result.rowCount === 0) {
    return c.json({
      error: { code: 'NOT_FOUND', message: 'Product not found' }
    }, 404);
  }

  return c.json({ product: result.rows[0] });
});
```

**Security checkpoint:**
- [ ] No sensitive pricing logic exposed
- [ ] Only active products shown
- [ ] No IDOR risk (public endpoint)

---

### Task 2.2: User Product Entitlements Endpoint
**Depends on:** Tasks 0.5, 2.1

**File:** `backend/src/routes/users.ts`

```typescript
// Get user's current product entitlements
users.get('/me/products', requireAuth, async (c) => {
  const userId = c.get('userId');

  // CRITICAL: user_id filter prevents IDOR
  const result = await c.env.db.query(`
    SELECT
      up.id,
      up.product_id,
      p.slug,
      p.name,
      up.status,
      up.trial_ends_at,
      up.activated_at,
      up.cancelled_at,
      up.expires_at,
      up.stripe_subscription_id,
      -- Calculate if user can access (active or trial not expired)
      CASE
        WHEN up.status = 'active' THEN true
        WHEN up.status = 'trial' AND up.trial_ends_at > NOW() THEN true
        ELSE false
      END as can_access
    FROM user_products up
    JOIN products p ON up.product_id = p.id
    WHERE up.user_id = $1
      AND up.status IN ('trial', 'active', 'cancelled')
    ORDER BY up.activated_at DESC
  `, [userId]);

  return c.json({ products: result.rows });
});
```

**Security checkpoint:**
- [ ] IDOR prevented with `user_id = $1`
- [ ] Only authenticated users can access
- [ ] No Stripe subscription IDs exposed unnecessarily

---

### Task 2.3: Charity Selection Endpoints
**Depends on:** Task 0.5

**Files:** `backend/src/routes/charities.ts`, `backend/src/routes/users.ts`

```typescript
// Get current user's charity selection
users.get('/me/charity', requireAuth, async (c) => {
  const userId = c.get('userId');

  const result = await c.env.db.query(`
    SELECT
      c.id,
      c.name,
      c.short_description,
      c.website,
      ucs.selected_at,
      ucs.effective_from
    FROM user_charity_selections ucs
    JOIN charities c ON ucs.charity_id = c.id
    WHERE ucs.user_id = $1
      AND ucs.effective_until IS NULL
  `, [userId]);

  if (result.rowCount === 0) {
    return c.json({ charity: null });
  }

  return c.json({ charity: result.rows[0] });
});

// Update charity selection
users.put('/me/charity', requireAuth, validate(charitySelectionSchema), async (c) => {
  const userId = c.get('userId');
  const { charityId } = c.get('validatedData');

  // Verify charity exists and is active
  const charityResult = await c.env.db.query(
    'SELECT id FROM charities WHERE id = $1 AND active = true',
    [charityId]
  );

  if (charityResult.rowCount === 0) {
    return c.json({
      error: { code: 'INVALID_CHARITY', message: 'Charity not found or inactive' }
    }, 400);
  }

  // Transaction: update old selection, create new one
  await c.env.db.query('BEGIN');

  try {
    // Close current selection
    await c.env.db.query(`
      UPDATE user_charity_selections
      SET effective_until = NOW()
      WHERE user_id = $1 AND effective_until IS NULL
    `, [userId]);

    // Create new selection (effective from next billing cycle)
    const nextBillingDate = await getNextBillingDate(c, userId);

    await c.env.db.query(`
      INSERT INTO user_charity_selections (user_id, charity_id, selected_at, effective_from)
      VALUES ($1, $2, NOW(), $3)
    `, [userId, charityId, nextBillingDate]);

    await c.env.db.query('COMMIT');

    // Get charity details for response
    const charityDetails = await c.env.db.query(
      'SELECT id, name, short_description FROM charities WHERE id = $1',
      [charityId]
    );

    return c.json({
      message: 'Charity updated. Change will apply to your next payment.',
      charity: charityDetails.rows[0],
      effectiveFrom: nextBillingDate
    });
  } catch (error) {
    await c.env.db.query('ROLLBACK');
    throw error;
  }
});
```

**Security checkpoint:**
- [ ] IDOR prevented (user can only change their own charity)
- [ ] Charity existence validated
- [ ] Transaction ensures data integrity
- [ ] Charity change applies to next billing (not retroactive)

---

## Phase 3: Stripe Payment Integration

**Objective:** Implement secure payment processing with Stripe

### Task 3.1: Stripe Configuration & Products
**Depends on:** Deployment Phase

**Manual setup in Stripe Dashboard:**
1. Create products matching database
2. Create price objects for each product
3. Set up webhook endpoint
4. Configure customer portal

**Then update database:**
```sql
UPDATE products SET stripe_price_id = 'price_xxxxx' WHERE slug = 'budgeting';
-- Repeat for all products
```

**Security checkpoint:**
- [ ] Webhook signing secret stored securely
- [ ] Stripe secret key never exposed to frontend
- [ ] Test mode used for development

---

### Task 3.2: Checkout Session Creation
**Depends on:** Task 3.1

**File:** `backend/src/routes/stripe.ts`

```typescript
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16'
});

// Create checkout session for product purchase
users.post('/me/products', requireAuth, validate(purchaseProductSchema), async (c) => {
  const userId = c.get('userId');
  const { productSlug, discountCode } = c.get('validatedData');

  // Get user details
  const userResult = await c.env.db.query(
    'SELECT email FROM users WHERE id = $1',
    [userId]
  );
  const user = userResult.rows[0];

  // Get product details
  const productResult = await c.env.db.query(`
    SELECT id, slug, name, price_monthly, charity_amount, revenue_amount,
           stripe_price_id, is_usage_based
    FROM products
    WHERE slug = $1 AND active = true
  `, [productSlug]);

  if (productResult.rowCount === 0) {
    return c.json({
      error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found' }
    }, 404);
  }

  const product = productResult.rows[0];

  // Check if user already has this product
  const existingResult = await c.env.db.query(`
    SELECT 1 FROM user_products
    WHERE user_id = $1 AND product_id = $2 AND status IN ('trial', 'active')
  `, [userId, product.id]);

  if (existingResult.rowCount > 0) {
    return c.json({
      error: { code: 'ALREADY_SUBSCRIBED', message: 'You already have this product' }
    }, 400);
  }

  // Validate discount code if provided
  let stripeCouponId = null;
  if (discountCode) {
    const discount = await validateDiscountCode(c, discountCode, product.id, userId);
    if (!discount.valid) {
      return c.json({
        error: { code: 'INVALID_DISCOUNT', message: discount.error }
      }, 400);
    }
    stripeCouponId = discount.stripeCouponId;
  }

  // Calculate trial end (14 days from now)
  const trialEnd = Math.floor((Date.now() + 14 * 24 * 60 * 60 * 1000) / 1000);

  // Create Stripe Checkout Session
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: user.email,
    line_items: [{
      price: product.stripe_price_id,
      quantity: 1
    }],
    subscription_data: {
      trial_end: trialEnd,
      metadata: {
        user_id: userId,
        product_id: product.id,
        product_slug: product.slug,
        charity_amount: product.charity_amount.toString(),
        revenue_amount: product.revenue_amount.toString()
      }
    },
    discounts: stripeCouponId ? [{ coupon: stripeCouponId }] : [],
    success_url: `${process.env.APP_URL}/onboarding/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.APP_URL}/onboarding/payment?cancelled=true`,
    metadata: {
      user_id: userId,
      product_id: product.id
    }
  });

  // Audit log
  await c.env.db.query(`
    INSERT INTO admin_audit_log (action, resource_type, resource_id, new_values)
    VALUES ('checkout_created', 'user_product', $1, $2)
  `, [userId, JSON.stringify({ product_slug: productSlug, session_id: session.id })]);

  return c.json({
    checkoutUrl: session.url,
    sessionId: session.id
  });
});
```

**Security checkpoint:**
- [ ] User can only create checkout for themselves (IDOR prevented)
- [ ] Product existence validated
- [ ] Duplicate subscription prevented
- [ ] Discount code validated before applying
- [ ] Metadata includes all necessary tracking info

---

### Task 3.3: Stripe Webhook Handler
**Depends on:** Task 3.2

**File:** `backend/src/routes/stripe.ts`

```typescript
import { Hono } from 'hono';

const stripe_routes = new Hono();

stripe_routes.post('/webhook', async (c) => {
  const sig = c.req.header('stripe-signature');
  const body = await c.req.text();

  let event;

  try {
    // CRITICAL: Verify webhook signature
    event = stripe.webhooks.constructEvent(
      body,
      sig!,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('[STRIPE WEBHOOK] Signature verification failed:', err.message);
    return c.json({ error: 'Webhook signature verification failed' }, 400);
  }

  // Handle event
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(c, event.data.object);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(c, event.data.object);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(c, event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(c, event.data.object);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(c, event.data.object);
        break;

      default:
        console.log(`[STRIPE WEBHOOK] Unhandled event type: ${event.type}`);
    }

    return c.json({ received: true });
  } catch (error) {
    console.error('[STRIPE WEBHOOK] Handler error:', error);
    // Return 200 to prevent Stripe retries (already logged error)
    return c.json({ received: true, error: 'Processing failed' });
  }
});

// Handle checkout.session.completed
async function handleCheckoutCompleted(c, session) {
  const { user_id, product_id } = session.metadata;

  // Idempotency check (prevent duplicate processing)
  const existing = await c.env.db.query(
    'SELECT 1 FROM user_products WHERE user_id = $1 AND product_id = $2 AND stripe_subscription_id = $3',
    [user_id, product_id, session.subscription]
  );

  if (existing.rowCount > 0) {
    console.log('[WEBHOOK] Already processed checkout session:', session.id);
    return;
  }

  // Get subscription details from Stripe
  const subscription = await stripe.subscriptions.retrieve(session.subscription);

  await c.env.db.query('BEGIN');

  try {
    // Create user_products record
    await c.env.db.query(`
      INSERT INTO user_products (
        user_id, product_id, status, trial_ends_at, activated_at, stripe_subscription_id
      )
      VALUES ($1, $2, 'trial', $3, NOW(), $4)
    `, [
      user_id,
      product_id,
      new Date(subscription.trial_end * 1000),
      session.subscription
    ]);

    // Track affiliate conversion if present
    const affiliateResult = await c.env.db.query(`
      SELECT ac.id, a.commission_type, a.commission_value
      FROM affiliate_conversions ac
      JOIN affiliates a ON ac.affiliate_id = a.id
      WHERE ac.user_id = $1 AND ac.converted_at IS NULL
      LIMIT 1
    `, [user_id]);

    if (affiliateResult.rowCount > 0) {
      const affiliate = affiliateResult.rows[0];
      await c.env.db.query(`
        UPDATE affiliate_conversions
        SET converted_at = NOW(), product_id = $1
        WHERE id = $2
      `, [product_id, affiliate.id]);
    }

    await c.env.db.query('COMMIT');

    // Send welcome email (async)
    sendTrialStartedEmail(user_id, product_id).catch(console.error);

  } catch (error) {
    await c.env.db.query('ROLLBACK');
    throw error;
  }
}

// Handle invoice.payment_succeeded (trial conversion or recurring payment)
async function handlePaymentSucceeded(c, invoice) {
  const subscriptionId = invoice.subscription;

  // Find user_product by subscription ID
  const result = await c.env.db.query(`
    SELECT up.id, up.user_id, up.product_id, up.status,
           p.charity_amount, p.revenue_amount
    FROM user_products up
    JOIN products p ON up.product_id = p.id
    WHERE up.stripe_subscription_id = $1
  `, [subscriptionId]);

  if (result.rowCount === 0) {
    console.error('[WEBHOOK] User product not found for subscription:', subscriptionId);
    return;
  }

  const userProduct = result.rows[0];

  // Get user's current charity
  const charityResult = await c.env.db.query(`
    SELECT charity_id
    FROM user_charity_selections
    WHERE user_id = $1 AND effective_until IS NULL
  `, [userProduct.user_id]);

  const charityId = charityResult.rows[0]?.charity_id;

  await c.env.db.query('BEGIN');

  try {
    // Convert trial to active if still on trial
    if (userProduct.status === 'trial') {
      await c.env.db.query(`
        UPDATE user_products
        SET status = 'active', trial_converted = true
        WHERE id = $1
      `, [userProduct.id]);
    }

    // Record payment
    await c.env.db.query(`
      INSERT INTO payments (
        user_id, product_id, stripe_payment_intent_id, stripe_invoice_id,
        total_amount, charity_amount, revenue_amount, charity_id,
        status, paid_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'succeeded', $9)
    `, [
      userProduct.user_id,
      userProduct.product_id,
      invoice.payment_intent,
      invoice.id,
      invoice.amount_paid / 100,
      userProduct.charity_amount,
      userProduct.revenue_amount,
      charityId,
      new Date(invoice.created * 1000)
    ]);

    // Update affiliate commission if first payment
    await c.env.db.query(`
      UPDATE affiliate_conversions
      SET first_payment_amount = $1,
          commission_earned = CASE
            WHEN a.commission_type = 'percentage' THEN ($1 * a.commission_value / 100)
            ELSE a.commission_value
          END
      FROM affiliates a
      WHERE affiliate_conversions.user_id = $2
        AND affiliate_conversions.first_payment_amount IS NULL
        AND affiliate_conversions.affiliate_id = a.id
    `, [invoice.amount_paid / 100, userProduct.user_id]);

    await c.env.db.query('COMMIT');

  } catch (error) {
    await c.env.db.query('ROLLBACK');
    throw error;
  }
}

// Handle invoice.payment_failed
async function handlePaymentFailed(c, invoice) {
  const subscriptionId = invoice.subscription;

  const result = await c.env.db.query(`
    SELECT up.id, up.user_id, u.email
    FROM user_products up
    JOIN users u ON up.user_id = u.id
    WHERE up.stripe_subscription_id = $1
  `, [subscriptionId]);

  if (result.rowCount === 0) return;

  const userProduct = result.rows[0];

  // Update status to expired
  await c.env.db.query(`
    UPDATE user_products
    SET status = 'expired', expires_at = NOW()
    WHERE id = $1
  `, [userProduct.id]);

  // Send payment failed email
  sendPaymentFailedEmail(userProduct.user_id).catch(console.error);
}

// Handle customer.subscription.deleted
async function handleSubscriptionDeleted(c, subscription) {
  await c.env.db.query(`
    UPDATE user_products
    SET status = 'expired', expires_at = NOW()
    WHERE stripe_subscription_id = $1
  `, [subscription.id]);
}
```

**Security checkpoint:**
- [ ] Webhook signature verified (prevents spoofing)
- [ ] Idempotency handled (prevents duplicate processing)
- [ ] All database operations in transactions
- [ ] Error handling doesn't expose sensitive data
- [ ] All events logged for audit

---

### Task 3.4: Subscription Cancellation
**Depends on:** Task 3.3

**File:** `backend/src/routes/users.ts`

```typescript
users.post('/me/products/:productId/cancel', requireAuth, async (c) => {
  const userId = c.get('userId');
  const productId = c.req.param('productId');

  // CRITICAL: Verify user owns this product (prevent IDOR)
  const result = await c.env.db.query(`
    SELECT id, stripe_subscription_id, status
    FROM user_products
    WHERE id = $1 AND user_id = $2
  `, [productId, userId]);

  if (result.rowCount === 0) {
    return c.json({
      error: { code: 'NOT_FOUND', message: 'Product subscription not found' }
    }, 404);
  }

  const userProduct = result.rows[0];

  if (userProduct.status !== 'active' && userProduct.status !== 'trial') {
    return c.json({
      error: { code: 'INVALID_STATUS', message: 'Subscription is not active' }
    }, 400);
  }

  // Cancel Stripe subscription at period end
  const subscription = await stripe.subscriptions.update(
    userProduct.stripe_subscription_id,
    { cancel_at_period_end: true }
  );

  // Update database
  await c.env.db.query(`
    UPDATE user_products
    SET status = 'cancelled', cancelled_at = NOW()
    WHERE id = $1
  `, [userProduct.id]);

  // Audit log
  await c.env.db.query(`
    INSERT INTO admin_audit_log (action, resource_type, resource_id, old_values)
    VALUES ('subscription_cancelled', 'user_product', $1, $2)
  `, [userProduct.id, JSON.stringify({ subscription_id: userProduct.stripe_subscription_id })]);

  return c.json({
    message: 'Subscription cancelled',
    expiresAt: new Date(subscription.current_period_end * 1000)
  });
});
```

**Security checkpoint:**
- [ ] IDOR prevented (user_id AND product_id check)
- [ ] Status validation before cancellation
- [ ] Stripe API error handling
- [ ] Audit log entry created

---

## Phase 4: Admin Dashboard Backend

**Objective:** Secure admin operations with role-based access control

### Task 4.1: Admin Authentication
**Depends on:** Task 0.5

**File:** `backend/src/routes/admin/auth.ts`

```typescript
import { Hono } from 'hono';
import { verify as verifyPassword } from '@node-rs/argon2';
import { sign } from 'hono/jwt';

const adminAuth = new Hono();

adminAuth.post('/login', validate(adminLoginSchema), async (c) => {
  const { email, password } = c.get('validatedData');

  // Fetch admin user
  const result = await c.env.db.query(`
    SELECT id, email, password_hash, first_name, last_name, role, permissions, active
    FROM admin_users
    WHERE email = $1
  `, [email]);

  const admin = result.rows[0];
  const isValidPassword = admin
    ? await verifyPassword(admin.password_hash, password)
    : await verifyPassword('$argon2id$v=19$m=65536,t=3,p=4$fake', password);

  if (!admin || !isValidPassword || !admin.active) {
    // Log failed attempt
    await c.env.db.query(`
      INSERT INTO admin_audit_log (action, ip_address, old_values)
      VALUES ('admin_login_failed', $1, $2)
    `, [
      c.req.header('x-forwarded-for'),
      JSON.stringify({ email })
    ]);

    return c.json({
      error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' }
    }, 401);
  }

  // Update last login
  await c.env.db.query(
    'UPDATE admin_users SET last_login_at = NOW() WHERE id = $1',
    [admin.id]
  );

  // Generate admin JWT (shorter expiry: 24 hours)
  const token = await sign({
    adminId: admin.id,
    email: admin.email,
    role: admin.role,
    permissions: admin.permissions,
    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) // 24 hours
  }, process.env.JWT_SECRET!);

  // Audit log
  await c.env.db.query(`
    INSERT INTO admin_audit_log (admin_user_id, action, ip_address)
    VALUES ($1, 'admin_login_success', $2)
  `, [admin.id, c.req.header('x-forwarded-for')]);

  return c.json({
    admin: {
      id: admin.id,
      email: admin.email,
      firstName: admin.first_name,
      lastName: admin.last_name,
      role: admin.role,
      permissions: admin.permissions
    },
    token
  });
});

export default adminAuth;
```

**Security checkpoint:**
- [ ] Admin passwords hashed with Argon2id
- [ ] Failed login attempts logged
- [ ] Shorter token expiry for admins
- [ ] Active status checked
- [ ] All admin actions logged

---

### Task 4.2: Admin Authorization Middleware
**Depends on:** Task 4.1

**File:** `backend/src/middleware/adminAuth.ts`

```typescript
export const requireAdmin = (requiredPermissions: string[] = []) => {
  return async (c, next) => {
    const authHeader = c.req.header('Authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: { code: 'UNAUTHORIZED', message: 'No token provided' }}, 401);
    }

    try {
      const token = authHeader.substring(7);
      const payload = await verify(token, process.env.JWT_SECRET!);

      // Verify it's an admin token
      if (!payload.adminId) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Admin access required' }}, 403);
      }

      // Check permissions
      const adminPermissions = payload.permissions as string[];
      const hasPermission = adminPermissions.includes('*') ||
        requiredPermissions.every(p => adminPermissions.includes(p));

      if (!hasPermission) {
        return c.json({
          error: {
            code: 'FORBIDDEN',
            message: 'Insufficient permissions',
            required: requiredPermissions
          }
        }, 403);
      }

      // Set admin context
      c.set('adminId', payload.adminId);
      c.set('adminRole', payload.role);
      c.set('adminPermissions', adminPermissions);

      await next();
    } catch (error) {
      return c.json({ error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' }}, 401);
    }
  };
};

// Usage:
// admin.get('/users', requireAdmin(['view_users']), async (c) => { ... });
// admin.post('/charities', requireAdmin(['manage_charities']), async (c) => { ... });
```

**Security checkpoint:**
- [ ] Admin token verified separately from user tokens
- [ ] Role-based access control enforced
- [ ] Permission checks granular
- [ ] No privilege escalation possible

---

### Task 4.3: Admin User Management Endpoints
**Depends on:** Task 4.2

**File:** `backend/src/routes/admin/users.ts`

```typescript
import { Hono } from 'hono';
import { requireAdmin } from '../../middleware/adminAuth';

const adminUsers = new Hono();

// List users with search and filters
adminUsers.get('/', requireAdmin(['view_users']), async (c) => {
  const { search, status, limit = 50, offset = 0 } = c.req.query();

  let query = `
    SELECT
      u.id, u.email, u.first_name, u.last_name, u.support_key,
      u.account_status, u.email_verified, u.created_at, u.last_login_at,
      COUNT(DISTINCT up.id) as product_count,
      COALESCE(SUM(p.total_amount), 0) as lifetime_value
    FROM users u
    LEFT JOIN user_products up ON u.id = up.user_id
    LEFT JOIN payments p ON u.id = p.user_id AND p.status = 'succeeded'
  `;

  const params = [];
  const conditions = [];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(u.email ILIKE $${params.length} OR u.support_key ILIKE $${params.length} OR CONCAT(u.first_name, ' ', u.last_name) ILIKE $${params.length})`);
  }

  if (status) {
    params.push(status);
    conditions.push(`u.account_status = $${params.length}`);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += `
    GROUP BY u.id
    ORDER BY u.created_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;

  params.push(parseInt(limit), parseInt(offset));

  const result = await c.env.db.query(query, params);

  const totalResult = await c.env.db.query(
    'SELECT COUNT(*) as total FROM users u' +
    (conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : ''),
    params.slice(0, -2)
  );

  return c.json({
    users: result.rows,
    total: parseInt(totalResult.rows[0].total),
    hasMore: parseInt(offset) + result.rowCount < parseInt(totalResult.rows[0].total)
  });
});

// Get user details
adminUsers.get('/:userId', requireAdmin(['view_users']), async (c) => {
  const userId = c.req.param('userId');

  // Validate UUID
  if (!isValidUUID(userId)) {
    return c.json({ error: { code: 'INVALID_ID', message: 'Invalid user ID' }}, 400);
  }

  const userResult = await c.env.db.query(`
    SELECT id, email, first_name, last_name, company_name, support_key,
           account_status, email_verified, created_at, last_login_at
    FROM users WHERE id = $1
  `, [userId]);

  if (userResult.rowCount === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' }}, 404);
  }

  const user = userResult.rows[0];

  // Get products
  const productsResult = await c.env.db.query(`
    SELECT up.id, p.name, up.status, up.activated_at, up.cancelled_at,
           up.stripe_subscription_id, up.trial_ends_at
    FROM user_products up
    JOIN products p ON up.product_id = p.id
    WHERE up.user_id = $1
    ORDER BY up.activated_at DESC
  `, [userId]);

  // Get payments
  const paymentsResult = await c.env.db.query(`
    SELECT p.id, p.total_amount, p.charity_amount, p.status, p.paid_at,
           pr.name as product_name, c.name as charity_name
    FROM payments p
    JOIN products pr ON p.product_id = pr.id
    LEFT JOIN charities c ON p.charity_id = c.id
    WHERE p.user_id = $1
    ORDER BY p.paid_at DESC
    LIMIT 10
  `, [userId]);

  // Calculate lifetime value
  const ltvResult = await c.env.db.query(`
    SELECT COALESCE(SUM(total_amount), 0) as lifetime_value
    FROM payments
    WHERE user_id = $1 AND status = 'succeeded'
  `, [userId]);

  return c.json({
    user,
    products: productsResult.rows,
    payments: paymentsResult.rows,
    lifetimeValue: parseFloat(ltvResult.rows[0].lifetime_value)
  });
});

// Suspend user
adminUsers.post('/:userId/suspend', requireAdmin(['manage_users']), async (c) => {
  const userId = c.req.param('userId');
  const adminId = c.get('adminId');
  const { reason } = await c.req.json();

  await c.env.db.query('BEGIN');

  try {
    // Update user status
    await c.env.db.query(
      'UPDATE users SET account_status = $1 WHERE id = $2',
      ['suspended', userId]
    );

    // Audit log
    await c.env.db.query(`
      INSERT INTO admin_audit_log (admin_user_id, action, resource_type, resource_id, new_values)
      VALUES ($1, 'user_suspended', 'user', $2, $3)
    `, [adminId, userId, JSON.stringify({ reason })]);

    await c.env.db.query('COMMIT');

    return c.json({ message: 'User suspended' });
  } catch (error) {
    await c.env.db.query('ROLLBACK');
    throw error;
  }
});

export default adminUsers;
```

**Security checkpoint:**
- [ ] Permission checks on all endpoints
- [ ] UUID validation prevents injection
- [ ] Search uses parameterized queries (SQL injection prevention)
- [ ] All admin actions logged in audit trail
- [ ] Transactions for data integrity

---

### Task 4.4: Admin Analytics Endpoints
**Depends on:** Task 4.2

**File:** `backend/src/routes/admin/analytics.ts`

```typescript
import { Hono } from 'hono';
import { requireAdmin } from '../../middleware/adminAuth';

const adminAnalytics = new Hono();

// Dashboard overview analytics
adminAnalytics.get('/overview', requireAdmin(['view_analytics']), async (c) => {
  // Total users
  const usersResult = await c.env.db.query(`
    SELECT
      COUNT(*) as total_users,
      COUNT(CASE WHEN account_status = 'active' THEN 1 END) as active_users,
      COUNT(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN 1 END) as new_users_30d
    FROM users
  `);

  // Revenue metrics
  const revenueResult = await c.env.db.query(`
    SELECT
      SUM(total_amount) as total_revenue,
      SUM(revenue_amount) as company_revenue,
      SUM(charity_amount) as charity_revenue,
      SUM(CASE WHEN paid_at > NOW() - INTERVAL '30 days' THEN total_amount ELSE 0 END) as revenue_30d
    FROM payments
    WHERE status = 'succeeded'
  `);

  // Active subscriptions by product
  const subscriptionsResult = await c.env.db.query(`
    SELECT
      p.name as product_name,
      COUNT(*) as active_count,
      SUM(p.price_monthly) as monthly_revenue
    FROM user_products up
    JOIN products p ON up.product_id = p.id
    WHERE up.status IN ('trial', 'active')
    GROUP BY p.id, p.name, p.price_monthly
    ORDER BY active_count DESC
  `);

  // Trial conversion rate
  const conversionResult = await c.env.db.query(`
    SELECT
      COUNT(*) as total_trials,
      COUNT(CASE WHEN trial_converted = true THEN 1 END) as converted_trials,
      ROUND(
        (COUNT(CASE WHEN trial_converted = true THEN 1 END)::numeric / NULLIF(COUNT(*), 0)) * 100,
        2
      ) as conversion_rate
    FROM user_products
    WHERE status IN ('active', 'cancelled', 'expired')
  `);

  return c.json({
    users: usersResult.rows[0],
    revenue: revenueResult.rows[0],
    subscriptions: subscriptionsResult.rows,
    conversion: conversionResult.rows[0]
  });
});

// Revenue over time (monthly breakdown)
adminAnalytics.get('/revenue', requireAdmin(['view_analytics']), async (c) => {
  const { months = 12 } = c.req.query();

  const result = await c.env.db.query(`
    SELECT
      DATE_TRUNC('month', paid_at) as month,
      SUM(total_amount) as total_revenue,
      SUM(revenue_amount) as company_revenue,
      SUM(charity_amount) as charity_revenue,
      COUNT(*) as payment_count
    FROM payments
    WHERE status = 'succeeded'
      AND paid_at > NOW() - INTERVAL '${parseInt(months)} months'
    GROUP BY DATE_TRUNC('month', paid_at)
    ORDER BY month DESC
  `, []);

  return c.json({ revenue: result.rows });
});

// Charity distribution analytics
adminAnalytics.get('/charities', requireAdmin(['view_analytics']), async (c) => {
  const result = await c.env.db.query(`
    SELECT
      c.name as charity_name,
      COUNT(DISTINCT ucs.user_id) as user_count,
      SUM(p.charity_amount) as total_donations,
      SUM(CASE WHEN p.charity_paid = true THEN p.charity_amount ELSE 0 END) as paid_donations,
      SUM(CASE WHEN p.charity_paid = false THEN p.charity_amount ELSE 0 END) as pending_donations
    FROM charities c
    LEFT JOIN user_charity_selections ucs ON c.id = ucs.charity_id
    LEFT JOIN payments p ON c.id = p.charity_id AND p.status = 'succeeded'
    WHERE c.active = true
    GROUP BY c.id, c.name
    ORDER BY total_donations DESC NULLS LAST
  `);

  return c.json({ charities: result.rows });
});

export default adminAnalytics;
```

**Security checkpoint:**
- [ ] Permission checks enforce access control (`view_analytics` required)
- [ ] No PII exposed (user emails, names not included in aggregates)
- [ ] Aggregated data only (counts, sums, no individual user details)
- [ ] SQL injection prevented with parameterized queries

---

## Phase 5: Frontend Deployment

**Objective:** Deploy React app to Cloudflare Pages

### Task 5.1: Production Build Configuration
**Depends on:** Phase 2 complete

**Files:** `.env.production`, `vite.config.ts`

**Steps:**

1. **Create production environment file:**
   - Create `.env.production` in frontend root:
   ```bash
   # .env.production
   VITE_API_URL=https://api.audacious.money
   VITE_SYNC_URL=wss://sync.audacious.money
   VITE_STRIPE_PUBLIC_KEY=pk_live_xxxxx
   ```

2. **Verify .gitignore excludes .env files:**
   - Ensure `.gitignore` contains:
   ```
   .env
   .env.local
   .env.production
   .env.*.local
   ```
   - **Note:** `.env.production` can be committed if it only contains public URLs, but safer to exclude

3. **Configure Vite for production:**
   - Update `vite.config.ts`:
   ```typescript
   import { defineConfig } from 'vite';
   import react from '@vitejs/plugin-react';

   export default defineConfig({
     plugins: [react()],
     build: {
       outDir: 'dist',
       sourcemap: false, // Disable source maps in production for security
       rollupOptions: {
         output: {
           manualChunks: {
             vendor: ['react', 'react-dom'],
             crypto: ['crypto-js'] // Separate crypto library for caching
           }
         }
       }
     },
     server: {
       port: 3000,
       proxy: {
         '/api': {
           target: 'http://localhost:3001',
           changeOrigin: true,
           rewrite: (path) => path.replace(/^\/api/, '')
         }
       }
     }
   });
   ```

4. **Update API client to use environment variables:**
   - Ensure your API client uses `import.meta.env.VITE_API_URL`:
   ```typescript
   // src/lib/api.ts
   const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
   const SYNC_URL = import.meta.env.VITE_SYNC_URL || 'ws://localhost:8080';

   export const api = {
     baseURL: API_URL,
     syncURL: SYNC_URL
   };
   ```

5. **Test production build locally:**
   ```bash
   # Build for production
   npm run build

   # Preview production build
   npm run preview

   # Test that API calls work with production URLs (or localhost for testing)
   ```

6. **Verify build output:**
   - Check `dist/` folder is created
   - Verify `dist/index.html` exists
   - Check bundle size (should be optimized):
     ```bash
     ls -lh dist/assets/
     ```
   - Ensure no `.env` files in `dist/`

7. **Add build script to package.json:**
   ```json
   {
     "scripts": {
       "dev": "vite",
       "build": "vite build",
       "preview": "vite preview",
       "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0"
     }
   }
   ```

**Security checkpoint:**
- [ ] No secrets in frontend build (only `VITE_*` public variables)
- [ ] API URL uses HTTPS only (in production)
- [ ] Stripe public key used (not secret key - starts with `pk_live_` not `sk_live_`)
- [ ] Source maps disabled in production build
- [ ] `.env` files in `.gitignore`
- [ ] Content Security Policy will be configured in Task 5.2
- [ ] Production build tested locally with `npm run preview`

---

### Task 5.2: Cloudflare Pages Deployment
**Depends on:** Task 5.1

**Steps:**

1. **Create Cloudflare Pages project:**
   - Go to Cloudflare Dashboard → Pages → Create a project
   - Connect to Git repository
   - Select repository: `audacious-money` (or your repo name)
   - Configure build settings:
     - Framework preset: `Vite`
     - Build command: `npm run build`
     - Build output directory: `dist`
     - Root directory: `/` (or frontend directory if monorepo)

2. **Configure environment variables in Cloudflare:**
   - Add `VITE_API_URL`: `https://api.audacious.money`
   - Add `VITE_SYNC_URL`: `wss://sync.audacious.money`
   - Add `VITE_STRIPE_PUBLIC_KEY`: `pk_live_xxxxx` (from Stripe dashboard)

3. **Set up custom domain:**
   - In Cloudflare Pages → Custom domains
   - Add custom domain: `app.audacious.money`
   - DNS records will be auto-configured

4. **Configure security headers:**
   - Create `public/_headers` file in your React app:
   ```
   /*
     X-Frame-Options: DENY
     X-Content-Type-Options: nosniff
     Referrer-Policy: strict-origin-when-cross-origin
     Permissions-Policy: geolocation=(), microphone=(), camera=()
     Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://js.stripe.com; connect-src 'self' https://api.audacious.money wss://sync.audacious.money https://api.stripe.com; img-src 'self' data: https:; style-src 'self' 'unsafe-inline';
   ```

5. **Test deployment:**
   - Push to main branch
   - Cloudflare automatically builds and deploys
   - Verify site loads at `https://app.audacious.money`
   - Test all API connections work

6. **Set up branch previews (optional):**
   - Enable preview deployments for pull requests
   - Each PR gets a unique preview URL

**Security checkpoint:**
- [ ] HTTPS enforced automatically by Cloudflare
- [ ] Security headers configured in `_headers` file
- [ ] Content Security Policy allows only necessary sources
- [ ] No secrets in build artifacts (all `VITE_*` vars are safe for public)
- [ ] CORS is handled server-side (backend configuration)
- [ ] Custom domain SSL certificate active

---

## Phase 6: Backend Deployment

**Objective:** Deploy backend to Digital Ocean

### Task 6.1: Digital Ocean Database Setup
**Depends on:** Task 0.2

**Steps:**

1. **Create PostgreSQL database:**
   - Log into Digital Ocean → Databases → Create Database
   - Choose PostgreSQL 15
   - Select datacenter region (closest to users, e.g., `nyc3` or `sfo3`)
   - Choose plan:
     - Development: Basic plan, 1GB RAM ($15/month)
     - Production: Professional plan, 4GB RAM ($60/month)
   - Database name: `audacious_money_production`
   - Enable "Trusted Sources" firewall

2. **Configure connection security:**
   - Download SSL certificate from Digital Ocean dashboard
   - Enable "Require SSL" option
   - Generate strong password (use Digital Ocean's generated password)
   - Save connection details securely:
     - Host: `db-postgresql-nyc3-xxxxx.ondigitalocean.com`
     - Port: `25060`
     - Database: `audacious_money_production`
     - Username: `doadmin`
     - Password: `[generated-password]`
     - SSL Mode: `require`

3. **Set up firewall rules:**
   - Add trusted sources:
     - Your backend server IP (will be added after Task 6.2)
     - Your local development IP (for migrations)
   - Remove 0.0.0.0/0 if present (no public access)

4. **Configure automated backups:**
   - Enable daily backups (included in managed database)
   - Set backup window to low-traffic hours (e.g., 3 AM UTC)
   - Retention: 7 days minimum

5. **Run database migrations:**
   - Connect to database from local machine:
     ```bash
     psql "postgresql://doadmin:[password]@[host]:25060/audacious_money_production?sslmode=require"
     ```
   - Run schema creation script from Task 0.2:
     ```bash
     psql "postgresql://..." < backend/src/db/schema.sql
     ```
   - Verify all tables created:
     ```sql
     \dt
     ```

6. **Create connection pool:**
   - In Digital Ocean dashboard, create connection pool
   - Pool name: `audacious-money-pool`
   - Mode: `Transaction`
   - Size: 25 connections
   - Use this connection string in backend (better performance)

7. **Test connection:**
   - Run health check query:
     ```sql
     SELECT COUNT(*) FROM users;
     ```
   - Should return 0 (empty table)

**Security checkpoint:**
- [ ] SSL/TLS enforced (`sslmode=require`)
- [ ] Strong database password saved in password manager
- [ ] Firewall allows only backend server and admin IPs
- [ ] Automated backups enabled with 7-day retention
- [ ] Connection pooling configured
- [ ] Database credentials never committed to Git

---

### Task 6.2: Digital Ocean App Platform Deployment
**Depends on:** Task 6.1

**Steps:**

1. **Create App Platform app for Backend API:**
   - Digital Ocean → Apps → Create App
   - Connect GitHub repository
   - Select repository and branch: `main`
   - Detect resource type: `Web Service`
   - Configure backend service:
     - Name: `audacious-money-api`
     - Source directory: `/audacious_money_backend` (if monorepo)
     - Build command: `bun install`
     - Run command: `bun run src/index.ts`
     - HTTP port: `3001`
     - Instance size: Basic (512MB RAM, $5/month) for development
     - Instance count: 1 (scale to 2+ for production)

2. **Configure environment variables:**
   - Add encrypted environment variables:
     ```
     NODE_ENV=production
     PORT=3001
     DATABASE_URL=[connection-pool-url-from-task-6.1]
     JWT_SECRET=[generate-new-secret-with-openssl-rand-hex-32]
     STRIPE_SECRET_KEY=[from-stripe-dashboard]
     STRIPE_WEBHOOK_SECRET=[will-add-in-task-6.3]
     SENDGRID_API_KEY=[from-sendgrid]
     APP_URL=https://app.audacious.money
     ADMIN_URL=https://admin.audacious.money
     ALLOWED_ORIGINS=https://app.audacious.money,https://admin.audacious.money
     ```

3. **Set up custom domain:**
   - In App settings → Domains
   - Add custom domain: `api.audacious.money`
   - Update DNS in Cloudflare:
     - Type: `CNAME`
     - Name: `api`
     - Target: `[app-platform-url].ondigitalocean.app`
   - Enable "Force HTTPS"

4. **Configure health checks:**
   - Health check path: `/health`
   - Initial delay: 30 seconds
   - Period: 10 seconds
   - Timeout: 5 seconds
   - Success threshold: 1
   - Failure threshold: 3

5. **Set up auto-deploy:**
   - Enable "Autodeploy" for `main` branch only
   - Disable autodeploy for other branches
   - Set deployment alert notifications

6. **Create App Platform app for Sync Relay:**
   - Repeat steps 1-5 for sync relay:
     - Name: `audacious-money-sync`
     - Source directory: `/audacious_money_sync`
     - Build command: `bun install`
     - Run command: `bun run src/index.ts`
     - HTTP port: `8080`
     - Custom domain: `sync.audacious.money`
     - Environment variables:
       ```
       NODE_ENV=production
       PORT=8080
       JWT_SECRET=[same-as-backend]
       DATABASE_URL=[same-as-backend]
       ```

7. **Update database firewall:**
   - Get App Platform outbound IP addresses
   - Add to database trusted sources (from Task 6.1)

8. **Test deployments:**
   - Backend API health check: `https://api.audacious.money/health`
   - Sync relay health check: `https://sync.audacious.money/health`
   - Test WebSocket connection to sync relay
   - Verify database connection works

9. **Set up monitoring and alerts:**
   - Enable Digital Ocean monitoring
   - Set up alerts for:
     - CPU > 80%
     - Memory > 90%
     - App crashes
     - Failed deployments

**Security checkpoint:**
- [ ] Environment variables encrypted at rest (Digital Ocean handles this)
- [ ] JWT_SECRET rotated from development (never reuse dev secrets)
- [ ] Stripe secret keys are production keys (not test mode)
- [ ] Database connection uses SSL
- [ ] Health checks configured and responding
- [ ] Auto-deploy only from `main` branch
- [ ] HTTPS enforced on all domains
- [ ] Database firewall updated with app IPs
- [ ] Monitoring and alerts active

---

### Task 6.3: Stripe Webhook Configuration
**Depends on:** Tasks 3.3, 6.2

**Steps:**

1. **Create webhook endpoint in Stripe:**
   - Log into Stripe Dashboard (production mode)
   - Go to Developers → Webhooks → Add endpoint
   - Endpoint URL: `https://api.audacious.money/stripe/webhook`
   - Description: `Production Webhook - Audacious Money`

2. **Select events to listen for:**
   - Select specific events:
     - `checkout.session.completed`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`

3. **Get webhook signing secret:**
   - After creating webhook, click to reveal signing secret
   - Copy signing secret (starts with `whsec_`)
   - Save securely in password manager

4. **Update backend environment variables:**
   - In Digital Ocean App Platform → Settings → Environment Variables
   - Add or update:
     ```
     STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
     ```
   - Trigger new deployment (required for env var changes)

5. **Test webhook delivery:**
   - In Stripe Dashboard → Webhooks → Your endpoint
   - Click "Send test webhook"
   - Select event: `checkout.session.completed`
   - Click "Send test webhook"
   - Verify response: 200 OK

6. **Monitor webhook deliveries:**
   - Check "Webhook attempts" tab in Stripe Dashboard
   - Verify all events are being received successfully
   - Check for any failed deliveries (red X)
   - If failures occur, check backend logs in Digital Ocean

7. **Set up webhook for test environment (optional):**
   - Repeat steps 1-5 for test/staging environment
   - Use different endpoint: `https://api-staging.audacious.money/stripe/webhook`
   - Use Stripe test mode keys
   - Separate webhook signing secret

**Testing webhook integration:**

```bash
# Use Stripe CLI to test locally first (before production)
stripe listen --forward-to localhost:3001/stripe/webhook

# In another terminal, trigger test events
stripe trigger checkout.session.completed
stripe trigger invoice.payment_succeeded
stripe trigger customer.subscription.deleted

# Check backend logs to verify webhook handler is working
```

**Security checkpoint:**
- [ ] Webhook signing secret configured in production environment
- [ ] HTTPS endpoint only (no HTTP allowed)
- [ ] Signature verification enforced in webhook handler (Task 3.3)
- [ ] Idempotency handled (duplicate events don't cause duplicate database entries)
- [ ] Webhook endpoint returns 200 OK even on processing errors (prevents Stripe retries)
- [ ] All webhook events logged for audit trail
- [ ] Test webhooks working correctly before going live

---

## Security Checkpoint Summary

### Before Launch
- [ ] All IDOR vulnerabilities addressed
- [ ] All inputs validated with Zod
- [ ] All database queries use parameterized statements
- [ ] Rate limiting configured on all endpoints
- [ ] CORS whitelist verified
- [ ] JWT secrets rotated from defaults
- [ ] Database backups configured
- [ ] SSL/TLS enforced everywhere
- [ ] Admin audit log capturing all sensitive operations
- [ ] Error messages don't leak sensitive data
- [ ] Password reset tokens cryptographically secure
- [ ] Stripe webhook signatures verified
- [ ] Zero-knowledge encryption properly implemented (client-side only)

### OWASP Top 10 Coverage
1. **Broken Access Control (IDOR):** ✓ All queries filter by user_id
2. **Cryptographic Failures:** ✓ Argon2id for passwords, TLS everywhere
3. **Injection:** ✓ Parameterized queries, Zod validation
4. **Insecure Design:** ✓ Zero-knowledge architecture
5. **Security Misconfiguration:** ✓ Secure headers, CORS, rate limiting
6. **Vulnerable Components:** ✓ Dependency scanning with npm audit
7. **Identification/Authentication Failures:** ✓ JWT with expiry, MFA ready
8. **Software/Data Integrity:** ✓ Audit logs, webhook signature verification
9. **Logging/Monitoring Failures:** ✓ Admin audit log, error tracking
10. **Server-Side Request Forgery:** ✓ Input validation, no user-controlled URLs

---

## Appendix: Security Testing Checklist

### Manual Testing
- [ ] Test IDOR on all endpoints (try accessing other user's resources)
- [ ] Test SQL injection on all inputs
- [ ] Test XSS in all text fields
- [ ] Test CSRF on state-changing operations
- [ ] Test rate limiting by exceeding limits
- [ ] Test JWT expiry and refresh
- [ ] Test password strength requirements
- [ ] Test unauthorized access to admin endpoints
- [ ] Test webhook signature verification with invalid signatures
- [ ] Test payment flow with test cards (success, decline, SCA)

### Automated Testing
- [ ] Run `npm audit` on all projects
- [ ] SAST scanning with Snyk or Semgrep
- [ ] Dependency vulnerability scanning
- [ ] SSL/TLS configuration testing (SSLLabs)
- [ ] Security headers testing (SecurityHeaders.com)

---

**End of Consolidated Roadmap**
