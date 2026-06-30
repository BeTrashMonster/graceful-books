# Workshop System - Pre-Launch Checklist

**Date**: 2026-06-08
**Status**: Ready for Testing with 2 Critical Gaps Identified

---

## ✅ What's Built and Working

### Backend Infrastructure

#### Database Schema
- ✅ `workshops` table - Workshop configuration
- ✅ `workshop_enrollments` table - User enrollments
- ✅ `workshop_analytics` view - Conversion metrics
- ✅ `users.current_workshop_enrollment_id` - Links users to workshops
- **⚠️ ACTION NEEDED**: Two migration files exist, need to use the correct one

#### API Endpoints - Admin
- ✅ `POST /api/workshops` - Create workshop (admin only)
- ✅ `GET /api/workshops` - List all workshops (admin only)
- ✅ `GET /api/workshops/:id` - Get single workshop (admin only)
- ✅ `PUT /api/workshops/:id` - Update workshop (admin only)
- ✅ `DELETE /api/workshops/:id` - Archive workshop (admin only)
- ✅ `GET /api/workshops/:id/enrollments` - List enrollments (admin only)
- ✅ `GET /api/admin/workshops/:id/conversions` - Conversion analytics (admin only)
- ✅ `GET /api/admin/conversions/stats` - Overall stats (admin only)

#### API Endpoints - User Facing
- ✅ `GET /api/workshops/slug/:slug` - Get workshop by slug (public, rate-limited)
- ✅ `POST /api/workshops/:id/enroll` - Enroll in workshop (authenticated, creates Stripe checkout)
- ✅ `PUT /api/enrollments/:id/grant-access` - Grant platform access (admin only)

#### Stripe Integration
- ✅ Dynamic trial length per workshop (e.g., 30 days)
- ✅ `createCheckoutSession()` accepts `trialDays` parameter
- ✅ Workshop metadata passed to Stripe (`workshopId`, `workshopSlug`, `enrollmentId`)
- ✅ Enrollment creates Stripe checkout and returns URL

#### Webhook Handlers
- ✅ `checkout.session.completed` - Detects workshop context, creates `user_products` record
- ✅ `checkout.session.completed` - Sends Email #1 (Workshop Welcome) to workshop participants
- ✅ `customer.subscription.trial_will_end` - Detects workshop enrollment, sends workshop trial reminder
- ✅ `customer.subscription.updated` - Graduates users from workshop when trial converts to paid
- ✅ All webhooks maintain separation between workshop and regular product users

#### Email Service (7 Workshop Emails)
- ✅ Email #1: `sendWorkshopWelcomeEmail()` - "IN! Here's your first steps"
- ✅ Email #2: `sendWorkshopReminderEmail()` - "Ready for tomorrow?" (24h before)
- ✅ Email #3: `sendWorkshopChallengeWeek1Email()` - "Following the Trail" (1 week post)
- ✅ Email #4: `sendWorkshopChallengeWeek2Email()` - "Seeing the Whole Picture" (2 weeks post)
- ✅ Email #5: `sendWorkshopChallengeWeek3Email()` - "Now We're Talking" (3 weeks post)
- ✅ Email #6: `sendWorkshopChallengeWeek4Email()` - "Making My Move" (4 weeks post)
- ✅ Email #7: `sendWorkshopWrapUpEmail()` - "Different Now" (30-day wrap-up)

**Note**: Email functions exist but scheduling is missing (see Critical Gaps below)

---

### Frontend Infrastructure

#### Admin Dashboard
- ✅ Navigation button: "🎓 Workshop Management" in AdminDashboard.tsx
- ✅ Routes configured:
  - `/admin/workshops` → WorkshopsPage
  - `/admin/workshops/:id/enrollments` → WorkshopEnrollmentsPage

#### Admin Pages
- ✅ `WorkshopsPage.tsx` - List and manage workshops
- ✅ `WorkshopEnrollmentsPage.tsx` - View enrollments for specific workshop

#### User-Facing Pages
- ✅ `WorkshopSignupPage.tsx` - Public signup page (`/workshops/:slug`)
- ✅ `WorkshopThankYouPage.tsx` - Post-enrollment confirmation (`/workshops/:slug/thank-you`)
- ✅ `WorkshopWorksheetPage.tsx` - Pre-workshop worksheet (protected route)
- ✅ `WorkshopCountdownPage.tsx` - Countdown to workshop day (protected route)
- ✅ `TrialExpiredPage.tsx` - Trial expiration page
- ✅ `UpgradePage.tsx` - Upgrade flow

#### Routing
- ✅ Public routes: `/workshops/:slug`, `/workshops/:slug/thank-you`
- ✅ Protected routes: `/workshops/worksheet`, `/workshops/countdown`
- ✅ Admin routes: `/admin/workshops`, `/admin/workshops/:id/enrollments`

---

## 🚨 Critical Gaps - MUST FIX Before Launch

### 1. Email Scheduler Service (MISSING)

**Problem**: We have 7 email functions but no way to trigger emails #2-7 at scheduled times.

**What's Missing**:
- Email #2 needs to send 24h before `workshop_start_datetime`
- Emails #3-7 need to send weekly after workshop (1, 2, 3, 4 weeks post-workshop)

**Current State**:
- ✅ Email #1 - Triggers via webhook (`checkout.session.completed`) ✅ WORKING
- ❌ Email #2 - NO SCHEDULER (24h before workshop)
- ❌ Email #3 - NO SCHEDULER (1 week after workshop)
- ❌ Email #4 - NO SCHEDULER (2 weeks after workshop)
- ❌ Email #5 - NO SCHEDULER (3 weeks after workshop)
- ❌ Email #6 - NO SCHEDULER (4 weeks after workshop)
- ❌ Email #7 - NO SCHEDULER (30 days after workshop)

**Solutions**:

**Option A: Postmark Triggered Emails (Recommended for MVP)**
- Use Postmark's email automation/templates
- Create 6 email templates in Postmark dashboard
- Set up triggers based on custom events
- Pro: No backend cron job needed
- Con: Requires Postmark setup, less flexible

**Option B: Cron Job + Queue Service**
- Create `workshopEmailScheduler.ts` service
- Run cron job daily (checks for emails to send)
- Query `workshop_enrollments` + `workshops` to find who needs emails
- Send emails via existing `email.service.ts` functions
- Pro: Full control, can customize scheduling
- Con: Needs cron setup, more complex

**Option C: Stripe Scheduled Webhooks (Hybrid)**
- Use Stripe's webhook event scheduling
- Not ideal for workshop-specific timing
- Only works for trial-related emails

**Recommendation**: Start with **Option B** (cron job) for full control, migrate to Option A later for scale.

---

### 2. Database Migration Conflict

**Problem**: Two migration files exist for `015`:
1. `015_educational_workshops.sql` (original, with duplicate trial tracking)
2. `015_educational_workshops_simplified.sql` (refactored, Stripe-integrated)

**Action Required**:
```bash
# Delete or rename the old migration
mv audacious_money_backend/src/db/migrations/015_educational_workshops.sql \
   audacious_money_backend/src/db/migrations/015_educational_workshops_OLD_BACKUP.sql

# Ensure the simplified version is used
# Rename it to 015 if needed
```

**Which Migration to Use**: `015_educational_workshops_simplified.sql`

**Why**: This version integrates with existing `user_products` table and Stripe webhooks (no duplicate trial tracking).

---

## ⚠️ Pre-Launch Configuration Required

### 1. Stripe Setup

**Actions**:
- [ ] Create Stripe Price for workshops
  - Recommended: $49/month or appropriate pricing
  - Set up in Stripe Dashboard → Products → Prices
- [ ] Copy Price ID (e.g., `price_1ABC123xyz`)
- [ ] When creating first workshop, paste this Price ID into `stripe_price_id` field
- [ ] Test checkout with Stripe test cards
- [ ] Verify webhook secret is configured: `STRIPE_WEBHOOK_SECRET`

**Test Cards**:
- `4242 4242 4242 4242` - Success
- `4000 0025 0000 3155` - Requires authentication
- Any future expiry date, any CVC

---

### 2. Postmark Setup

**Actions**:
- [ ] Verify `POSTMARK_SERVER_TOKEN` is set
- [ ] Verify `POSTMARK_FROM_EMAIL` is set (e.g., `audrey@audacious.money`)
- [ ] Verify `POSTMARK_FROM_NAME` is set (e.g., `Audrey - Audacious Money`)
- [ ] Test email sending:
  ```bash
  # Use test endpoint
  POST /api/workshops/:id/emails/test
  ```
- [ ] Check Postmark dashboard for delivery/bounce rates

---

### 3. Database Migration

**Actions**:
```bash
# 1. Backup production database first!
pg_dump your_database > backup_before_workshop_migration.sql

# 2. Remove old migration file
rm audacious_money_backend/src/db/migrations/015_educational_workshops.sql

# 3. Run the simplified migration
npm run migrate:up

# 4. Verify tables created
psql -d your_database -c "\dt workshops*"

# Expected output:
# workshops
# workshop_enrollments
# workshop_analytics (view)
```

---

### 4. Environment Variables

**Required Variables**:
```bash
# Stripe
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Postmark
POSTMARK_SERVER_TOKEN=xxx
POSTMARK_FROM_EMAIL=audrey@audacious.money
POSTMARK_FROM_NAME=Audrey - Audacious Money

# Frontend URL (for Stripe redirects)
FRONTEND_URL=https://audacious.money

# Feature Flags (optional)
WORKSHOP_SYSTEM_ENABLED=true
WORKSHOP_EMAILS_ENABLED=true
WORKSHOP_SIGNUP_ENABLED=true
```

---

## 📋 End-to-End Flow (What Happens)

### Admin Creates Workshop

1. Admin logs in → clicks "🎓 Workshop Management"
2. Admin fills out workshop form:
   - Cohort name: "Understanding Your True Costs - July 2026"
   - Slug: `july-2026-costing`
   - Workshop type: `in_person` or `online`
   - Location: "2130 SW 5th Ave, Portland, OR"
   - **Stripe Price ID**: `price_xxx` (from Stripe Dashboard)
   - **Trial duration**: 30 days
   - Access grant datetime: When users can access platform
   - Workshop start datetime: July 8, 2026 10:00 AM
   - Workshop end datetime: July 8, 2026 12:00 PM
   - Max enrollment: 20 (optional)
3. Admin clicks "Create Workshop"
4. Workshop appears in list with status: `draft`
5. Admin changes status to `open` to accept enrollments

---

### User Discovers and Signs Up

1. User visits public URL: `https://audacious.money/workshops/july-2026-costing`
2. Sees workshop details:
   - Name, description, date/time, location
   - Spots remaining (if max_enrollment set)
   - "Enroll Now" button
3. User clicks "Enroll Now"
   - If not logged in → redirected to sign up/login
   - If logged in → enrollment begins
4. **Backend**: `POST /api/workshops/:id/enroll`
   - Creates `workshop_enrollments` record
   - Sets `users.current_workshop_enrollment_id`
   - Creates Stripe checkout session with **30-day trial**
   - Returns `checkoutUrl`
5. **Frontend**: Redirects user to Stripe checkout
6. User enters payment details (trial, no charge yet)
7. User completes checkout

---

### Stripe Webhook: Checkout Complete

1. Stripe sends `checkout.session.completed` webhook
2. **Backend**: `handleCheckoutSessionCompleted()`
   - Creates `user_products` record with `status='trialing'`
   - Detects `workshopId` in metadata
   - Sends **Email #1**: Workshop Welcome ("IN! Here's your first steps")
3. User receives email with prework instructions
4. User redirected to: `/workshops/july-2026-costing/thank-you`

---

### Pre-Workshop Period (30-Day Trial)

**Day 1-28**: User completes worksheet
- User logs in → `/workshops/worksheet`
- Fills out product costing worksheet
- When complete → redirected to `/workshops/countdown`
- Countdown page shows days until workshop

**⚠️ MISSING**: Email #2 should be sent 24h before workshop
**Solution**: Need email scheduler (see Critical Gap #1)

---

### Workshop Day

**July 8, 2026, 10am-12pm**:
- Users attend in-person or online workshop
- Work through product costing together
- Complete worksheet during session

**⚠️ MISSING**: Emails #3-7 should be sent weekly after workshop
**Solution**: Need email scheduler (see Critical Gap #1)

---

### Post-Workshop (Trial Period)

**Current State**:
- User has full platform access (status: `trialing`)
- User can use all features for 30 days
- `user_products.current_period_end` = trial end date

**What Should Happen** (but scheduler missing):
- Week 1: Email #3 "Following the Trail"
- Week 2: Email #4 "Seeing the Whole Picture"
- Week 3: Email #5 "Now We're Talking"
- Week 4: Email #6 "Making My Move"
- Day 30: Email #7 "Different Now" (wrap-up)

**What DOES Happen** (via Stripe webhook):
- 7 days before trial ends: Stripe sends `customer.subscription.trial_will_end`
- Backend detects workshop enrollment
- Sends workshop trial ending email ✅

---

### Trial Converts to Paid

**Stripe automatically charges** user on trial end date:
1. Stripe sends `customer.subscription.updated` webhook
2. **Backend**: Updates `user_products.status` to `'active'`
3. **Backend**: Removes `current_workshop_enrollment_id` (user "graduated")
4. User is now a regular paying customer (no longer in workshop cohort)

---

## 🧪 Testing Checklist

### Local Testing

**Setup**:
```bash
# 1. Run backend
cd audacious_money_backend
npm run dev

# 2. Run frontend
cd ..
npm run dev

# 3. Use Stripe CLI for webhooks
stripe listen --forward-to localhost:3006/api/webhooks/stripe
```

**Test Cases**:

#### Admin Flow
- [ ] Log in as admin
- [ ] Click "🎓 Workshop Management" button
- [ ] Create new workshop with all fields
- [ ] Verify workshop appears in list
- [ ] Edit workshop details
- [ ] Change status from `draft` to `open`

#### User Enrollment Flow
- [ ] Visit `/workshops/test-workshop-slug` (public page)
- [ ] Click "Enroll Now" as logged-in user
- [ ] Verify redirect to Stripe checkout
- [ ] Complete checkout with test card `4242 4242 4242 4242`
- [ ] Verify redirect to `/workshops/test-workshop-slug/thank-you`
- [ ] Check email inbox for Email #1 (Workshop Welcome)

#### Webhook Testing
- [ ] Verify `user_products` record created with `status='trialing'`
- [ ] Verify `workshop_enrollments` record exists
- [ ] Verify `users.current_workshop_enrollment_id` is set
- [ ] Check backend logs for webhook processing

#### Database Verification
```sql
-- Check workshop created
SELECT * FROM workshops WHERE slug = 'test-workshop-slug';

-- Check enrollment
SELECT * FROM workshop_enrollments WHERE workshop_id = 'xxx';

-- Check user_products (trial status)
SELECT * FROM user_products WHERE user_id = 'xxx';

-- Check analytics view
SELECT * FROM workshop_analytics WHERE slug = 'test-workshop-slug';
```

---

### Production Testing (Stripe Test Mode)

**Before going live with real payments**:

- [ ] Deploy to staging/production
- [ ] Use Stripe **test mode** keys
- [ ] Test full enrollment flow
- [ ] Test webhook delivery (check Stripe Dashboard → Webhooks)
- [ ] Verify emails send via Postmark
- [ ] Test trial conversion (use Stripe test clock to fast-forward)
- [ ] Test webhook for trial ending
- [ ] Test webhook for subscription update (graduation)

---

## 🔧 What Needs to Be Built (Email Scheduler)

### Recommended Implementation: Cron Job Email Scheduler

**File**: `audacious_money_backend/src/services/workshopEmailScheduler.ts`

**What It Does**:
1. Runs every day at 9:00 AM (configurable)
2. Queries database for emails that need to be sent today
3. Sends emails via existing `email.service.ts` functions
4. Tracks sent emails to avoid duplicates

**Logic**:
```typescript
// Check for Email #2 (24h before workshop)
SELECT we.*, u.email, u.first_name, w.*
FROM workshop_enrollments we
JOIN users u ON u.id = we.user_id
JOIN workshops w ON w.id = we.workshop_id
WHERE w.workshop_start_datetime BETWEEN NOW() AND NOW() + INTERVAL '24 hours'
  AND w.send_reminder = true
  -- AND email not already sent (track in separate table or JSONB field)

// Check for Email #3 (1 week after workshop)
SELECT we.*, u.email, u.first_name, w.*
FROM workshop_enrollments we
JOIN users u ON u.id = we.user_id
JOIN workshops w ON w.id = we.workshop_id
WHERE w.workshop_end_datetime BETWEEN NOW() - INTERVAL '7 days' AND NOW() - INTERVAL '6 days'
  -- AND email not already sent

// Repeat for emails #4, #5, #6, #7...
```

**Cron Setup** (Node.js with `node-cron`):
```typescript
import cron from 'node-cron';

// Run every day at 9:00 AM
cron.schedule('0 9 * * *', async () => {
  console.log('[Scheduler] Running daily workshop email check...');
  await sendScheduledWorkshopEmails();
});
```

**Alternative**: Use external cron service (e.g., GitHub Actions, Render Cron Jobs, Vercel Cron)

---

## 📊 Analytics and Monitoring

**Admin Can View**:
- Total enrollments per workshop
- Trialing count (via `workshop_analytics` view)
- Active subscriptions (converted from trial)
- Conversion rate percentage
- Spots remaining (if max_enrollment set)

**Endpoints**:
- `GET /api/admin/workshops/:id/conversions` - Workshop-specific metrics
- `GET /api/admin/conversions/stats` - All workshops aggregated

**Database View**:
```sql
SELECT * FROM workshop_analytics WHERE id = 'workshop-id';
-- Returns: total_enrolled, trialing_count, active_count, converted_count, conversion_rate_percent
```

---

## 🎯 Priority Action Items

### Before Testing Live

1. **CRITICAL**: Build email scheduler service (see above)
   - Estimated time: 2-4 hours
   - Blocks: Emails #2-7 won't send without this

2. **CRITICAL**: Resolve migration file conflict
   - Delete old `015_educational_workshops.sql`
   - Use `015_educational_workshops_simplified.sql`

3. **HIGH**: Create Stripe price for workshops
   - Get price ID from Stripe Dashboard
   - Required for creating first workshop

4. **HIGH**: Test full enrollment flow locally
   - Verify webhook delivery
   - Verify Email #1 sends

5. **MEDIUM**: Set up email tracking
   - Track which emails have been sent
   - Prevent duplicate emails

6. **MEDIUM**: Add admin UI for email scheduling config
   - Allow admins to enable/disable specific emails per workshop
   - Currently all emails are enabled by default

---

## ✅ Summary

**What Works**:
- ✅ Admin can create/manage workshops
- ✅ Users can discover and enroll in workshops
- ✅ Stripe integration with dynamic trial length (30 days)
- ✅ Webhooks detect workshop context
- ✅ Email #1 (Welcome) sends on enrollment
- ✅ Trial converts to paid subscription automatically
- ✅ User "graduates" from workshop when converted
- ✅ Analytics and conversion tracking

**What's Missing**:
- ❌ Email scheduler for emails #2-7 (CRITICAL)
- ⚠️ Migration file conflict needs resolution
- ⚠️ No email tracking (could send duplicates)

**Estimated Time to Launch-Ready**: 3-5 hours (mostly email scheduler)

---

## 🚀 Next Steps

1. Build email scheduler service
2. Test locally end-to-end
3. Deploy to staging with Stripe test mode
4. Create first workshop
5. Test with real enrollment flow
6. Monitor webhook delivery and emails
7. Launch! 🎉

Let me know which gap you want to tackle first - I recommend starting with the email scheduler since that's the critical blocker for the full workshop experience.
