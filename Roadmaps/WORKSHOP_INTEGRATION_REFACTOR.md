# Workshop System Integration Refactor

## Problem: Tunnel Vision Duplication

The workshop system was built as a standalone system, duplicating:
- Stripe subscription/trial management
- Postmark email sending
- Trial expiration logic
- Conversion tracking

**But you already have all this infrastructure working!**

## Existing Infrastructure (KEEP & USE)

### ✅ Stripe Service (`audacious_money_backend/src/services/stripe.service.ts`)
- ✅ `createCheckoutSession()` - Creates Stripe subscriptions
- ✅ `trial_period_days: 7` (line 57) - **We need to make this DYNAMIC**
- ✅ Payment method management
- ✅ Subscription pause/resume
- ✅ Invoice management

### ✅ Email Service (`audacious_money_backend/src/services/email.service.ts`)
- ✅ Postmark client initialized
- ✅ `sendTrialStartedEmail()`
- ✅ `sendTrialEndingSoonEmail()`
- ✅ `sendWelcomeEmail()`
- ✅ `sendPaymentFailedEmail()`
- ✅ All transactional emails

### ✅ Webhook Handler (`audacious_money_backend/src/routes/webhooks.ts`)
- ✅ `customer.subscription.created`
- ✅ `customer.subscription.updated`
- ✅ `customer.subscription.trial_will_end`
- ✅ `invoice.payment_succeeded`
- ✅ Updates `user_products` table with status

### ✅ Database Schema
- ✅ `user_products` table with Stripe subscription tracking
- ✅ `users` table
- ✅ Subscription status management

---

## What Workshops ACTUALLY Need (MINIMAL ADDITIONS)

### 1. Workshop-Specific Database Fields (Keep)
```sql
-- From migration 015 - These are unique to workshops
CREATE TABLE workshops (
  id UUID PRIMARY KEY,
  cohort_name VARCHAR(255),
  slug VARCHAR(100) UNIQUE,
  workshop_start_datetime TIMESTAMPTZ,
  workshop_end_datetime TIMESTAMPTZ,
  access_grant_datetime TIMESTAMPTZ,
  trial_duration_days INT NOT NULL DEFAULT 30, -- ⭐ KEY: Per-workshop trial length
  max_enrollment INT,
  custom_email_templates JSONB, -- Optional overrides
  welcome_message TEXT,
  -- ... other workshop config
);

CREATE TABLE workshop_enrollments (
  id UUID PRIMARY KEY,
  workshop_id UUID REFERENCES workshops(id),
  user_id UUID REFERENCES users(id),
  enrolled_at TIMESTAMPTZ,
  worksheet_completed_at TIMESTAMPTZ,
  -- 🔥 DON'T NEED: trial tracking (use user_products.status instead)
);

-- Link users to workshops
ALTER TABLE users
ADD COLUMN current_workshop_enrollment_id UUID REFERENCES workshop_enrollments(id);
```

### 2. Modified Stripe Integration (EXTEND EXISTING)

**Change `createCheckoutSession()` to accept dynamic trial:**

```typescript
// audacious_money_backend/src/services/stripe.service.ts

export async function createCheckoutSession({
  priceId,
  userId,
  userEmail,
  successUrl,
  cancelUrl,
  metadata,
  trialDays = 7, // ⭐ NEW: Allow dynamic trial length
}: {
  priceId: string;
  userId: string;
  userEmail: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
  trialDays?: number; // ⭐ NEW PARAMETER
}): Promise<Stripe.Checkout.Session> {
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    customer_email: userEmail,
    client_reference_id: userId,
    allow_promotion_codes: true,
    metadata: {
      userId: userId,
      ...metadata,
    },
    subscription_data: {
      trial_period_days: trialDays, // ⭐ USE DYNAMIC VALUE
      metadata: {
        userId: userId,
        ...metadata,
      },
    },
  });

  return session;
}
```

### 3. Workshop Enrollment Endpoint (NEW)

```typescript
// audacious_money_backend/src/routes/workshops.ts

// POST /api/workshops/:slug/enroll
workshopRoutes.post('/:slug/enroll', requireAuth, async (c) => {
  const { slug } = c.req.param();
  const user = c.get('user');
  const db = getDatabase();

  // 1. Get workshop details
  const workshop = await db.query(
    `SELECT * FROM workshops WHERE slug = $1 AND status = 'open'`,
    [slug]
  );

  if (!workshop.rows.length) {
    return c.json({ error: 'Workshop not found or closed' }, 404);
  }

  const { id: workshopId, trial_duration_days, price_id } = workshop.rows[0];

  // 2. Create enrollment record
  const enrollment = await db.query(
    `INSERT INTO workshop_enrollments (workshop_id, user_id, enrolled_at)
     VALUES ($1, $2, NOW())
     RETURNING id`,
    [workshopId, user.id]
  );

  // 3. Link user to workshop
  await db.query(
    `UPDATE users SET current_workshop_enrollment_id = $1 WHERE id = $2`,
    [enrollment.rows[0].id, user.id]
  );

  // 4. Create Stripe subscription with WORKSHOP TRIAL LENGTH ⭐
  const { createCheckoutSession } = await import('../services/stripe.service.js');

  const session = await createCheckoutSession({
    priceId: price_id, // Workshop's Stripe price
    userId: user.id,
    userEmail: user.email,
    successUrl: `${process.env.FRONTEND_URL}/workshops/${slug}/thank-you`,
    cancelUrl: `${process.env.FRONTEND_URL}/workshops/${slug}`,
    trialDays: trial_duration_days, // ⭐ USE WORKSHOP'S TRIAL LENGTH
    metadata: {
      workshopId: workshopId,
      workshopSlug: slug,
    },
  });

  return c.json({ sessionUrl: session.url });
});
```

### 4. Custom Workshop Emails (EXTEND EXISTING)

**Add workshop-specific email templates to existing email service:**

```typescript
// audacious_money_backend/src/services/email.service.ts

// Add new functions using EXISTING Postmark client:

export async function sendWorkshopWelcomeEmail(
  to: string,
  firstName: string,
  workshopName: string,
  workshopDate: string
): Promise<void> {
  await client.sendEmail({
    From: `${FROM_NAME} <${FROM_EMAIL}>`,
    To: to,
    Subject: `[AM] IN! Here's your first steps - ${workshopName}`,
    HtmlBody: `
      <!-- Use template from audacious-money-email-sequence.md -->
      Hey ${firstName}, Welcome — I am so glad you're here!
      ...
    `,
    TextBody: `...`,
    MessageStream: 'outbound'
  });
}

export async function sendWorkshopReminderEmail(
  to: string,
  firstName: string,
  workshopName: string,
  workshopDate: string
): Promise<void> {
  // 24h before workshop email
}

// ... 5 more workshop emails
```

### 5. Webhook Integration (EXTEND EXISTING)

**Modify existing webhook handlers to detect workshop context:**

```typescript
// audacious_money_backend/src/routes/webhooks.ts

async function handleCheckoutSessionCompleted(session: any) {
  const db = getDatabase();
  const userId = session.metadata?.userId;
  const productId = session.metadata?.productId;
  const workshopId = session.metadata?.workshopId; // ⭐ NEW

  // Existing code creates user_product record...

  // ⭐ NEW: If workshop enrollment, send workshop welcome email
  if (workshopId) {
    const workshop = await db.query(
      `SELECT cohort_name, workshop_start_datetime FROM workshops WHERE id = $1`,
      [workshopId]
    );

    if (workshop.rows.length > 0) {
      const { cohort_name, workshop_start_datetime } = workshop.rows[0];
      const { sendWorkshopWelcomeEmail } = await import('../services/email.service.js');

      await sendWorkshopWelcomeEmail(
        userEmail,
        firstName,
        cohort_name,
        workshop_start_datetime
      );
    }
  } else {
    // Regular product welcome email (existing code)
    await sendProductWelcomeEmail(...);
  }
}

async function handleSubscriptionTrialWillEnd(subscription: any) {
  const db = getDatabase();

  // Check if this is a workshop subscription
  const workshopEnrollment = await db.query(
    `SELECT w.* FROM workshop_enrollments we
     JOIN workshops w ON w.id = we.workshop_id
     JOIN user_products up ON up.user_id = we.user_id
     WHERE up.stripe_subscription_id = $1`,
    [subscription.id]
  );

  if (workshopEnrollment.rows.length > 0) {
    // Send workshop-specific trial ending email
    const { sendWorkshopTrialEndingEmail } = await import('../services/email.service.js');
    // ...
  } else {
    // Regular trial ending email (existing code)
    const { sendTrialEndingSoonEmail } = await import('../services/email.service.js');
    // ...
  }
}
```

---

## What to DELETE from Workshop System

### ❌ DELETE: Duplicate Trial Management
- `audacious_money_backend/src/services/workshops/trialManager.ts` - **USE STRIPE WEBHOOKS INSTEAD**
- `audacious_money_backend/src/services/workshops/conversionTracker.ts` - **USE user_products.status INSTEAD**

### ❌ DELETE: Duplicate Email Infrastructure
- `audacious_money_backend/src/services/email/workshopEmailScheduler.ts` - **USE WEBHOOK EVENTS INSTEAD**
- `audacious_money_backend/src/services/email/workshopEmailRenderer.ts` - **USE EXISTING email.service.ts**

### ⚠️ KEEP BUT SIMPLIFY: Email Templates
- `audacious_money_backend/src/services/email/workshopEmails.ts` - **MOVE TO email.service.ts**

---

## Migration 015 Changes Needed

**Remove duplicate trial tracking:**

```sql
-- REMOVE these columns (use user_products instead):
-- trial_start_datetime
-- trial_expires_at
-- trial_started_at
-- emails_sent (Postmark tracks this)

-- KEEP these columns:
CREATE TABLE workshop_enrollments (
  id UUID PRIMARY KEY,
  workshop_id UUID REFERENCES workshops(id),
  user_id UUID REFERENCES users(id),
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  worksheet_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Rely on existing `user_products` for trial/subscription tracking:**
- `status` - 'trialing', 'active', 'past_due', 'cancelled'
- `stripe_subscription_id`
- `stripe_customer_id`
- `current_period_start`
- `current_period_end`

---

## How Workshops Work with Existing System

### User Journey with Integration:

1. **User signs up for workshop** → POST `/api/workshops/:slug/enroll`
   - Creates `workshop_enrollments` record
   - Links user with `current_workshop_enrollment_id`
   - Creates Stripe checkout with **workshop's custom trial length**
   - Redirects to Stripe

2. **Stripe checkout completes** → `checkout.session.completed` webhook
   - **EXISTING CODE**: Creates `user_products` record with status='trialing'
   - **NEW**: Detects `workshopId` in metadata
   - **NEW**: Sends workshop welcome email (not regular welcome email)

3. **During trial** → User status tracked in `user_products`
   - Status: 'trialing'
   - **EXISTING SYSTEM** handles everything
   - No custom trial manager needed

4. **7 days before trial ends** → `customer.subscription.trial_will_end` webhook
   - **EXISTING CODE**: Detects subscription
   - **NEW**: Checks if workshop enrollment exists
   - **NEW**: Sends workshop trial reminder (not regular reminder)

5. **Trial converts** → `customer.subscription.updated` webhook
   - **EXISTING CODE**: Updates `user_products.status` to 'active'
   - **NEW**: Removes `current_workshop_enrollment_id` (user graduates)

6. **Payment fails** → `invoice.payment_failed` webhook
   - **EXISTING CODE**: Updates status to 'past_due'
   - **EXISTING CODE**: Sends payment failed email
   - No custom handling needed

---

## Refactor Checklist

### Phase 1: Stripe Integration
- [ ] Add `trialDays` parameter to `createCheckoutSession()`
- [ ] Test with different trial lengths (30 days for workshops)

### Phase 2: Database Simplification
- [ ] Remove trial tracking columns from `workshop_enrollments`
- [ ] Add `price_id` to `workshops` table (each workshop has a Stripe price)
- [ ] Test migration

### Phase 3: Email Integration
- [ ] Move workshop email templates into `email.service.ts`
- [ ] Add workshop detection to webhook handlers
- [ ] Remove standalone email scheduler

### Phase 4: Webhook Enhancement
- [ ] Add `workshopId` metadata to Stripe checkout
- [ ] Modify `handleCheckoutSessionCompleted()` for workshop detection
- [ ] Modify `handleSubscriptionTrialWillEnd()` for workshop-specific emails

### Phase 5: Cleanup
- [ ] Delete `trialManager.ts`
- [ ] Delete `conversionTracker.ts`
- [ ] Delete `workshopEmailScheduler.ts`
- [ ] Delete `workshopEmailRenderer.ts`

---

## Key Benefits of Integration

✅ **One source of truth**: `user_products.status` for all subscription states
✅ **Stripe handles everything**: Trial periods, conversions, payments
✅ **Webhooks drive actions**: No cron jobs or background services needed
✅ **Existing infrastructure**: Postmark, Stripe, webhooks all working
✅ **Simpler codebase**: Remove ~3,000 lines of duplicate code
✅ **Flexible trial lengths**: Each workshop sets its own trial duration
✅ **Battle-tested**: Your existing subscription system already works

---

## Example: 30-Day Workshop Trial

```typescript
// Workshop configuration
const workshop = {
  cohort_name: "Spring 2026 Product Costing",
  trial_duration_days: 30, // ⭐ Custom per workshop
  price_id: "price_xyz123", // Stripe price for this workshop
  // ... other config
};

// Enrollment creates checkout with 30-day trial
const session = await createCheckoutSession({
  priceId: workshop.price_id,
  trialDays: workshop.trial_duration_days, // ⭐ 30 days
  metadata: { workshopId: workshop.id },
});

// Stripe handles:
// - 30 day trial period
// - Trial expiration
// - Automatic conversion
// - Webhook events
```

No custom trial management needed - Stripe does it all!

---

## Questions to Answer

1. **What Stripe price should workshops use?**
   - Same as existing products? Or separate workshop-specific prices?

2. **How do we differentiate workshop users in analytics?**
   - Use `metadata.workshopId` on Stripe subscription
   - Query `workshop_enrollments` table

3. **Do workshop participants get a different product or same product?**
   - Recommend: Same product (e.g., "cpu-cpg-calculator")
   - Workshop is just a different *acquisition channel*

4. **What happens after trial expires?**
   - User keeps product access (as paying customer)
   - Remove `current_workshop_enrollment_id` (they graduated)

---

## Next Steps

**Ready to refactor?** Let's:

1. ✅ Make Stripe trial length dynamic
2. ✅ Add workshop emails to existing email service
3. ✅ Simplify database migration 015
4. ✅ Enhance webhooks to detect workshop context
5. ✅ Delete duplicate services

**Result:** Workshop system integrated seamlessly with your existing, working infrastructure!
