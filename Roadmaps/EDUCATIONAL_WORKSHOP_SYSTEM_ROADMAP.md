# Educational Workshop System - Implementation Roadmap

**Version:** 1.0
**Created:** 2026-06-07
**Status:** Pre-Implementation
**Epic:** Educational Workshop Cohort Management System

---

## Executive Summary

This roadmap implements a flexible educational workshop system that allows admin users to run cohort-based training programs with complete control over access timing, trial periods, and automated email sequences. The system maintains the integrity of the existing platform while adding workshop-specific pathways.

**Key Innovation:** Hybrid user model where regular purchasers get immediate access while workshop participants follow a structured, time-gated educational journey.

**Educational Model:** 30-day product cost journey with weekly email guidance and progressive support.

**Creative Freedom:** Admins have complete creative control over all 7 email templates with rich text editing, custom fonts, colors, sizes, and emoji support. Make each workshop uniquely yours.

---

## Architecture Overview

### Core Components

1. **Workshop Management System** - Admin creates and configures workshop cohorts
2. **Flexible Signup Flow** - Dedicated URLs for workshop registration
3. **Hybrid Access Control** - Regular users get instant access, workshop users wait for admin-set time
4. **Email Automation** - Welcome email + reminder + 5 weekly educational emails (7 total)
5. **Countdown Experience** - Pre-workshop engagement page with custom messaging
6. **Trial Management** - Flexible trial start timing and duration per workshop
7. **Worksheet Resume System** - Users can complete signup worksheet over multiple sessions

### User Journey

**Workshop Participant Path:**
1. Visit `/workshop/spring-2026` (unique URL per cohort)
2. Complete signup: email → passphrase → charity selection → worksheet
3. See thank you page: "We're excited to see you on [workshop date/time]"
4. Login before workshop: See countdown page with custom welcome message
5. Workshop access time arrives: Full platform unlocks
6. Trial period begins: Based on admin settings (could be signup, access grant, or first login)
7. Weekly emails: Receive educational content at admin-configured times
8. Trial ends: Based on admin-configured action (upgrade prompt, auto-convert, or account freeze)

**Regular User Path (unchanged):**
1. Visit `/signup`
2. Complete signup and worksheet
3. Purchase subscription
4. Immediate full platform access

---

## Admin Controls Specification

### Essential Workshop Settings

1. **Access Grant Date/Time** - When users can start using the full platform
2. **Trial Start Date/Time** - When the trial period countdown begins
3. **Trial Duration in Days** - How long the free trial lasts (e.g., 30 days)
4. **Workshop Start/End Times** - Actual workshop event timing for email scheduling

### Additional Flexible Controls (For Educator Success)

5. **Cohort Name/Label** - Display name like "Spring 2026 Small Business Bootcamp"
6. **Workshop Slug** - URL identifier like `spring-2026` for `/workshop/spring-2026`
7. **Workshop Type** - `in_person` or `online`
8. **Workshop Location** - Physical address or Zoom link (based on type)
9. **Display Timezone(s)** - Primary timezone (e.g., PST) and optional secondary (e.g., EST) for display
10. **Registration Deadline** - Stop accepting signups before workshop (optional)
11. **Maximum Enrollment** - Cap number of participants (optional)
12. **Custom Welcome Message** - Personalized content shown on countdown page (supports Markdown)
13. **Pre-Workshop Reminder** - Send "Workshop starts in X hours" email (configurable timing)
14. **Post-Trial Action** - What happens when trial ends:
    - `upgrade_prompt` - Show subscription purchase modal
    - `auto_convert` - Automatically start paid subscription (requires payment method)
    - `account_freeze` - Lock account until user upgrades
15. **Email Customization** - Full edit access to all 7 email templates per workshop with template tags
16. **Post-Workshop Resources** - Links to recordings, slides, materials (shown after workshop)
17. **Workshop Status** - `draft`, `open_registration`, `registration_closed`, `in_progress`, `completed`, `archived`

---

## Email Customization Capabilities

Admins have **full creative freedom** to make each workshop's email sequence uniquely their own:

### Rich Text Editing
- **WYSIWYG Editor** - What you see is what your users get
- **Live Preview** - See exactly how emails will look (desktop + mobile views)
- **Template Tags** - Insert dynamic data with one click (user name, workshop details, etc.)

### Formatting Options
- **Text Styling:** Bold, italic, underline, strikethrough, headings (H1-H3)
- **Font Control:**
  - Size: 8px to 72px
  - Family: Arial, Helvetica, Georgia, Times New Roman, Courier New, Verdana, and more
  - Color: Full color palette for text and background/highlights
- **Layout:** Left/center/right/justify alignment, bullet lists, numbered lists, blockquotes
- **Links:** Hyperlinks with custom colors

### Emoji Support 🌸
- **Native Emoji Picker** - Full emoji keyboard accessible from toolbar
- **All Emojis Supported** - ✨ 💜 🎉 😊 🌸 🚀 ✅ and thousands more
- **Cross-Platform Compatible** - Emojis render correctly across Gmail, Outlook, Apple Mail, Yahoo, etc.
- **Mobile-Friendly** - Emojis display beautifully on all devices

### Email Management
- **7 Fully Editable Templates** - Welcome, Reminder, Week 1-4, and Wrap-up emails
- **Subject & Preheader** - Customize every element including preview text
- **Copy/Paste Between Emails** - Reuse formatting and content across templates
- **Reset to Default** - Always have the option to return to baseline templates
- **Send Test Emails** - Preview how your formatting looks in your actual inbox

### Technical Excellence
- **Mobile Responsive** - Emails automatically adapt to any screen size
- **Email Client Tested** - Works across Gmail, Outlook (all versions), Apple Mail, Yahoo, Thunderbird
- **Plain Text Fallback** - Accessibility for text-only email clients
- **Security Sanitized** - XSS-safe while preserving your beautiful formatting

---

## Implementation Phases

### Phase 1: Foundation & Database (Group A)
**Parallel Execution:** All tasks can run simultaneously

#### A1: Workshop Database Schema
**File:** `audacious_money_backend/src/db/migrations/013_educational_workshops.sql`

```sql
-- Workshops Table
CREATE TABLE workshops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_name VARCHAR(255) NOT NULL, -- "Spring 2026 Small Business Bootcamp"
  slug VARCHAR(100) NOT NULL UNIQUE, -- "spring-2026"
  description TEXT,

  -- Workshop Type & Location
  workshop_type VARCHAR(20) NOT NULL DEFAULT 'in_person'
    CHECK (workshop_type IN ('in_person', 'online')),
  location TEXT, -- Physical address or Zoom link

  -- Timezone Display
  primary_timezone VARCHAR(50) NOT NULL DEFAULT 'America/Los_Angeles', -- IANA timezone (PST)
  secondary_timezone VARCHAR(50), -- Optional second timezone for display (EST)

  -- Access & Trial Settings
  access_grant_datetime TIMESTAMPTZ NOT NULL, -- When users unlock full platform
  trial_start_datetime TIMESTAMPTZ NOT NULL, -- When trial countdown begins
  trial_duration_days INTEGER NOT NULL DEFAULT 30, -- Length of free trial

  -- Workshop Event Timing
  workshop_start_datetime TIMESTAMPTZ NOT NULL, -- When workshop actually happens
  workshop_end_datetime TIMESTAMPTZ NOT NULL, -- When workshop ends

  -- Registration Settings
  registration_deadline TIMESTAMPTZ, -- Optional cutoff for signups
  max_enrollment INTEGER, -- Optional capacity limit

  -- Customization
  welcome_message TEXT, -- Shown on countdown page (Markdown supported)
  custom_email_templates JSONB, -- Full email template overrides per workshop
  custom_email_schedule JSONB, -- Override default email timing
  post_workshop_resources JSONB, -- [{title, url}, ...]

  -- Post-Trial Behavior
  post_trial_action VARCHAR(20) NOT NULL DEFAULT 'upgrade_prompt'
    CHECK (post_trial_action IN ('upgrade_prompt', 'auto_convert', 'account_freeze')),

  -- Reminder Settings
  send_reminder BOOLEAN NOT NULL DEFAULT true,
  reminder_hours_before INTEGER NOT NULL DEFAULT 24, -- Send reminder 24h before

  -- Status
  status VARCHAR(30) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'open_registration', 'registration_closed', 'in_progress', 'completed', 'archived')),

  -- Metadata
  created_by UUID NOT NULL REFERENCES admin_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Workshop Enrollments (links users to workshops)
CREATE TABLE workshop_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workshop_id UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,

  -- Enrollment tracking
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  first_login_at TIMESTAMPTZ, -- When they first logged in after access granted
  trial_started_at TIMESTAMPTZ, -- When their specific trial began
  trial_expires_at TIMESTAMPTZ, -- When their trial ends
  converted_to_paid_at TIMESTAMPTZ, -- When they upgraded to paid subscription
  worksheet_completed_at TIMESTAMPTZ, -- When they completed the initial worksheet

  -- Engagement tracking
  emails_sent JSONB DEFAULT '[]'::jsonb, -- [{email_type, sent_at}, ...]
  last_active_at TIMESTAMPTZ,

  -- Status
  status VARCHAR(30) NOT NULL DEFAULT 'enrolled'
    CHECK (status IN ('enrolled', 'active', 'trial_expired', 'converted', 'withdrawn')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, workshop_id) -- User can only enroll once per workshop
);

-- Add workshop_enrollment_id to users table
ALTER TABLE users ADD COLUMN current_workshop_enrollment_id UUID REFERENCES workshop_enrollments(id);

-- Indexes for performance
CREATE INDEX idx_workshops_slug ON workshops(slug);
CREATE INDEX idx_workshops_status ON workshops(status);
CREATE INDEX idx_workshops_access_grant ON workshops(access_grant_datetime);
CREATE INDEX idx_workshop_enrollments_user_id ON workshop_enrollments(user_id);
CREATE INDEX idx_workshop_enrollments_workshop_id ON workshop_enrollments(workshop_id);
CREATE INDEX idx_workshop_enrollments_status ON workshop_enrollments(status);
CREATE INDEX idx_users_workshop_enrollment ON users(current_workshop_enrollment_id);
```

**Acceptance Criteria:**
- [ ] Migration runs successfully on dev database
- [ ] All tables created with correct schema
- [ ] Indexes created for performance
- [ ] Foreign keys properly constrain data
- [ ] Check constraints validate enum values
- [ ] Users table updated with workshop enrollment reference

**Dependencies:** None

---

#### A2: Backend Types & Validation Schemas
**File:** `audacious_money_backend/src/types/workshop.types.ts`

```typescript
export interface Workshop {
  id: string;
  cohortName: string;
  slug: string;
  description?: string;

  // Access & Trial Settings
  accessGrantDatetime: Date;
  trialStartDatetime: Date;
  trialDurationDays: number;

  // Workshop Event Timing
  workshopStartDatetime: Date;
  workshopEndDatetime: Date;

  // Registration Settings
  registrationDeadline?: Date;
  maxEnrollment?: number;

  // Customization
  welcomeMessage?: string;
  customEmailSchedule?: EmailScheduleOverride;
  postWorkshopResources?: WorkshopResource[];

  // Post-Trial Behavior
  postTrialAction: 'upgrade_prompt' | 'auto_convert' | 'account_freeze';

  // Reminder Settings
  sendReminder: boolean;
  reminderHoursBefore: number;

  // Status
  status: 'draft' | 'open_registration' | 'registration_closed' | 'in_progress' | 'completed' | 'archived';

  // Metadata
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkshopEnrollment {
  id: string;
  userId: string;
  workshopId: string;

  enrolledAt: Date;
  firstLoginAt?: Date;
  trialStartedAt?: Date;
  trialExpiresAt?: Date;

  emailsSent: EmailLog[];
  lastActiveAt?: Date;

  status: 'enrolled' | 'active' | 'trial_expired' | 'converted' | 'withdrawn';

  createdAt: Date;
  updatedAt: Date;
}

export interface EmailScheduleOverride {
  welcomeEmail?: { sendAt: 'signup' }; // Always on signup
  weeklyEmails?: {
    email1?: { hoursAfterWorkshopStart: number }; // Default: 2 hours after
    email2?: { daysAfterEmail1: number }; // Default: 7 days
    email3?: { daysAfterEmail2: number }; // Default: 7 days
    email4?: { daysAfterEmail3: number }; // Default: 7 days
  };
  reminderEmail?: { hoursBefore: number }; // Default: 24 hours before
}

export interface WorkshopResource {
  title: string;
  url: string;
  type?: 'recording' | 'slides' | 'worksheet' | 'other';
}

export interface EmailLog {
  emailType: 'welcome' | 'reminder' | 'week1' | 'week2' | 'week3' | 'week4';
  sentAt: Date;
  successful: boolean;
}
```

**File:** `audacious_money_backend/src/utils/validation.ts` (add to existing)

```typescript
import { z } from 'zod';

export const createWorkshopSchema = z.object({
  cohortName: z.string().min(3).max(255),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  description: z.string().max(2000).optional(),

  accessGrantDatetime: z.string().datetime(),
  trialStartDatetime: z.string().datetime(),
  trialDurationDays: z.number().int().min(1).max(365),

  workshopStartDatetime: z.string().datetime(),
  workshopEndDatetime: z.string().datetime(),

  registrationDeadline: z.string().datetime().optional(),
  maxEnrollment: z.number().int().positive().optional(),

  welcomeMessage: z.string().max(5000).optional(),
  customEmailSchedule: z.object({
    weeklyEmails: z.object({
      email1: z.object({ hoursAfterWorkshopStart: z.number() }).optional(),
      email2: z.object({ daysAfterEmail1: z.number() }).optional(),
      email3: z.object({ daysAfterEmail2: z.number() }).optional(),
      email4: z.object({ daysAfterEmail3: z.number() }).optional(),
    }).optional(),
    reminderEmail: z.object({ hoursBefore: z.number() }).optional(),
  }).optional(),
  postWorkshopResources: z.array(z.object({
    title: z.string().max(200),
    url: z.string().url(),
    type: z.enum(['recording', 'slides', 'worksheet', 'other']).optional(),
  })).optional(),

  postTrialAction: z.enum(['upgrade_prompt', 'auto_convert', 'account_freeze']),
  sendReminder: z.boolean(),
  reminderHoursBefore: z.number().int().positive(),
}).refine(
  (data) => new Date(data.workshopEndDatetime) > new Date(data.workshopStartDatetime),
  { message: "Workshop end must be after start" }
).refine(
  (data) => new Date(data.accessGrantDatetime) <= new Date(data.workshopStartDatetime),
  { message: "Access should be granted before or at workshop start" }
);

export const enrollInWorkshopSchema = z.object({
  workshopSlug: z.string(),
});
```

**Acceptance Criteria:**
- [ ] All TypeScript types match database schema
- [ ] Zod validation schemas enforce business rules
- [ ] Date validations ensure logical ordering
- [ ] Types exported correctly for import
- [ ] No TypeScript compilation errors

**Dependencies:** A1 (Database Schema)

---

#### A3: Workshop Access Control Utilities
**File:** `audacious_money_backend/src/utils/workshopAccess.ts`

```typescript
import { Workshop, WorkshopEnrollment } from '../types/workshop.types';

/**
 * Determine if workshop access should be granted to user
 */
export function hasWorkshopAccess(
  enrollment: WorkshopEnrollment,
  workshop: Workshop
): boolean {
  const now = new Date();
  const accessGrantTime = new Date(workshop.accessGrantDatetime);

  // Access granted if current time is past the access grant time
  return now >= accessGrantTime;
}

/**
 * Determine if user's trial has started
 */
export function hasTrialStarted(
  enrollment: WorkshopEnrollment,
  workshop: Workshop
): boolean {
  const now = new Date();
  const trialStartTime = new Date(workshop.trialStartDatetime);

  return now >= trialStartTime;
}

/**
 * Calculate trial expiration date for a user
 */
export function calculateTrialExpiration(
  workshop: Workshop,
  trialStartedAt: Date
): Date {
  const expiration = new Date(trialStartedAt);
  expiration.setDate(expiration.getDate() + workshop.trialDurationDays);
  return expiration;
}

/**
 * Check if user's trial has expired
 */
export function isTrialExpired(enrollment: WorkshopEnrollment): boolean {
  if (!enrollment.trialExpiresAt) return false;

  const now = new Date();
  const expiresAt = new Date(enrollment.trialExpiresAt);

  return now > expiresAt;
}

/**
 * Determine if workshop is accepting enrollments
 */
export function isWorkshopAcceptingEnrollments(workshop: Workshop): boolean {
  const now = new Date();

  // Check status
  if (workshop.status !== 'open_registration') {
    return false;
  }

  // Check registration deadline
  if (workshop.registrationDeadline) {
    const deadline = new Date(workshop.registrationDeadline);
    if (now > deadline) {
      return false;
    }
  }

  return true;
}

/**
 * Check if workshop has reached max enrollment
 */
export async function isWorkshopFull(
  workshopId: string,
  currentEnrollmentCount: number,
  workshop: Workshop
): Promise<boolean> {
  if (!workshop.maxEnrollment) return false;

  return currentEnrollmentCount >= workshop.maxEnrollment;
}

/**
 * Get default email schedule for workshop
 */
export function getEmailSchedule(workshop: Workshop): {
  welcome: Date;
  reminder: Date;
  week1: Date;
  week2: Date;
  week3: Date;
  week4: Date;
} {
  const workshopStart = new Date(workshop.workshopStartDatetime);
  const workshopEnd = new Date(workshop.workshopEndDatetime);

  // Apply custom overrides or use defaults
  const customSchedule = workshop.customEmailSchedule;

  // Week 1: 2 hours after workshop ends (or custom)
  const week1Hours = customSchedule?.weeklyEmails?.email1?.hoursAfterWorkshopStart ?? 2;
  const week1 = new Date(workshopEnd);
  week1.setHours(week1.getHours() + week1Hours);

  // Week 2: 7 days after week 1 (or custom)
  const week2Days = customSchedule?.weeklyEmails?.email2?.daysAfterEmail1 ?? 7;
  const week2 = new Date(week1);
  week2.setDate(week2.getDate() + week2Days);

  // Week 3: 7 days after week 2 (or custom)
  const week3Days = customSchedule?.weeklyEmails?.email3?.daysAfterEmail2 ?? 7;
  const week3 = new Date(week2);
  week3.setDate(week3.getDate() + week3Days);

  // Week 4: 7 days after week 3 (or custom)
  const week4Days = customSchedule?.weeklyEmails?.email4?.daysAfterEmail3 ?? 7;
  const week4 = new Date(week3);
  week4.setDate(week4.getDate() + week4Days);

  // Reminder: 24 hours before workshop (or custom)
  const reminderHours = customSchedule?.reminderEmail?.hoursBefore ?? workshop.reminderHoursBefore;
  const reminder = new Date(workshopStart);
  reminder.setHours(reminder.getHours() - reminderHours);

  // Welcome: Immediate on signup
  const welcome = new Date(); // Will be actual signup time

  return { welcome, reminder, week1, week2, week3, week4 };
}
```

**Acceptance Criteria:**
- [ ] Access control logic handles edge cases
- [ ] Trial calculations are accurate
- [ ] Email schedule properly applies custom overrides
- [ ] Enrollment validation checks all constraints
- [ ] Timezone handling is correct
- [ ] Unit tests cover all utility functions

**Dependencies:** A2 (Types)

---

### Phase 2: Backend API Routes (Group B)
**Parallel Execution:** B1, B2, B3 can run in parallel

#### B1: Workshop CRUD Endpoints (Admin Only)
**File:** `audacious_money_backend/src/routes/admin/workshops.ts`

Implements:
- `POST /admin/workshops` - Create new workshop
- `GET /admin/workshops` - List all workshops
- `GET /admin/workshops/:id` - Get workshop details
- `PUT /admin/workshops/:id` - Update workshop
- `DELETE /admin/workshops/:id` - Delete workshop (only if no enrollments)
- `POST /admin/workshops/:id/publish` - Change status to open_registration
- `GET /admin/workshops/:id/enrollments` - List enrolled users
- `GET /admin/workshops/:id/analytics` - Enrollment stats and engagement metrics

**Key Features:**
- Validate slug uniqueness
- Prevent deletion if enrollments exist
- Track created_by for audit trail
- Support filtering and pagination

**Acceptance Criteria:**
- [ ] Only admin users can access these endpoints
- [ ] Slug uniqueness enforced
- [ ] Workshops with enrollments cannot be deleted
- [ ] Status transitions validated (draft → open_registration → registration_closed → in_progress → completed)
- [ ] All fields validated with Zod schemas
- [ ] Proper error messages for validation failures
- [ ] Rate limiting: 100 requests per hour per admin

**Dependencies:** A1, A2, A3

---

#### B2: Workshop Enrollment Endpoints
**File:** `audacious_money_backend/src/routes/workshops.ts`

Implements:
- `GET /workshops/:slug` - Get workshop details (public, limited fields)
- `POST /workshops/:slug/enroll` - Enroll current user in workshop
- `GET /workshops/my-enrollment` - Get current user's enrollment status
- `POST /workshops/my-enrollment/withdraw` - Withdraw from workshop (before access granted)

**Key Logic:**
```typescript
// Enroll user in workshop
async function enrollInWorkshop(userId: string, workshopSlug: string) {
  const workshop = await getWorkshopBySlug(workshopSlug);

  // Validate enrollment eligibility
  if (!isWorkshopAcceptingEnrollments(workshop)) {
    throw new Error('Workshop is not accepting enrollments');
  }

  const enrollmentCount = await getEnrollmentCount(workshop.id);
  if (await isWorkshopFull(workshop.id, enrollmentCount, workshop)) {
    throw new Error('Workshop is full');
  }

  // Check if user already enrolled
  const existing = await getEnrollment(userId, workshop.id);
  if (existing) {
    throw new Error('Already enrolled in this workshop');
  }

  // Create enrollment
  const enrollment = await createEnrollment({
    userId,
    workshopId: workshop.id,
    status: 'enrolled',
    enrolledAt: new Date(),
  });

  // Update user's current workshop enrollment
  await updateUser(userId, {
    currentWorkshopEnrollmentId: enrollment.id,
  });

  // Send welcome email
  await sendWorkshopWelcomeEmail(userId, workshop);

  return enrollment;
}
```

**Acceptance Criteria:**
- [ ] Users can enroll in open workshops
- [ ] Enrollment checks max capacity
- [ ] Enrollment checks registration deadline
- [ ] Users cannot enroll twice in same workshop
- [ ] Welcome email sent immediately after enrollment
- [ ] User's current_workshop_enrollment_id updated
- [ ] Withdrawal only allowed before access granted

**Dependencies:** A1, A2, A3

---

#### B3: Workshop Access Middleware
**File:** `audacious_money_backend/src/middleware/workshopAccess.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import { hasWorkshopAccess } from '../utils/workshopAccess';

/**
 * Middleware to check if user should have platform access
 * Handles both regular users and workshop users
 */
export async function checkPlatformAccess(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const user = req.user; // From auth middleware

  // If user is not in a workshop, grant access (regular user)
  if (!user.currentWorkshopEnrollmentId) {
    return next();
  }

  // User is in a workshop - check if access time has arrived
  const enrollment = await getEnrollment(user.currentWorkshopEnrollmentId);
  const workshop = await getWorkshop(enrollment.workshopId);

  if (hasWorkshopAccess(enrollment, workshop)) {
    // Access granted - update enrollment status if needed
    if (enrollment.status === 'enrolled') {
      await updateEnrollmentStatus(enrollment.id, 'active');

      // Start trial if it should start now
      if (hasTrialStarted(enrollment, workshop) && !enrollment.trialStartedAt) {
        const trialStartedAt = new Date();
        const trialExpiresAt = calculateTrialExpiration(workshop, trialStartedAt);

        await updateEnrollment(enrollment.id, {
          trialStartedAt,
          trialExpiresAt,
        });
      }
    }

    return next();
  }

  // Access not yet granted - show countdown page
  res.status(403).json({
    error: 'WORKSHOP_ACCESS_PENDING',
    message: 'Your workshop access begins soon',
    workshop: {
      cohortName: workshop.cohortName,
      accessGrantDatetime: workshop.accessGrantDatetime,
      workshopStartDatetime: workshop.workshopStartDatetime,
      welcomeMessage: workshop.welcomeMessage,
    },
  });
}
```

**Acceptance Criteria:**
- [ ] Regular users bypass workshop checks
- [ ] Workshop users blocked until access time
- [ ] Access time properly calculated across timezones
- [ ] Enrollment status automatically updated to 'active'
- [ ] Trial automatically started when applicable
- [ ] Clear error response for pending access

**Dependencies:** A1, A2, A3, B2

---

### Phase 3: Workshop Admin Interface (Group C)
**Sequential Execution:** C1 → C2 → C3 → C4

#### C1: Admin Workshop List Page
**File:** `src/pages/admin/workshops/WorkshopList.tsx`

**Features:**
- Table showing all workshops
- Columns: Cohort Name, Status, Workshop Date, Enrolled Count, Converted to Paid, Conversion Rate, Actions
- Filter by status
- Sort by date or conversion rate
- [Create Workshop] button
- Click row to edit
- **Conversion tracking:** Shows how many enrolled users upgraded to paid subscription
- **Main admin user list integration:** When viewing regular user list, display workshop origin badge for converted users (e.g., "From: Spring 2026")

**Visual Design:**
```
┌──────────────────────────────────────────────────────────────────────────┐
│  Workshops                              [Create Workshop]                │
├──────────────────────────────────────────────────────────────────────────┤
│  Filter: [All Statuses ▾]                                                │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ Cohort Name      Status  Date    Enrolled  Converted  Conv Rate  │   │
│  ├──────────────────────────────────────────────────────────────────┤   │
│  │ Spring 2026 ... Open    Mar 15   24/50     8          33%        │   │
│  │ Winter 2026 ... Complete Jan 10  18/30     12         67%        │   │
│  │ Fall 2025 ...   Archived Oct 5   42/50     28         67%        │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
```

**Main Admin User List Enhancement:**
```
┌────────────────────────────────────────────────────────────┐
│  Users                                                      │
├────────────────────────────────────────────────────────────┤
│  Name             Email              Status    Origin      │
│  Jane Doe         jane@ex.com        Active    [Spring 26] │
│  John Smith       john@ex.com        Active    Regular     │
└────────────────────────────────────────────────────────────┘
```

**Acceptance Criteria:**
- [ ] All workshops displayed in table
- [ ] Status badges color-coded
- [ ] Enrollment shows count/max (or count if no max)
- [ ] Conversion count and rate calculated accurately
- [ ] Filter works for all statuses
- [ ] Sort by date or conversion rate (ascending/descending)
- [ ] Create button opens creation form
- [ ] Click row navigates to edit page
- [ ] Empty state if no workshops exist
- [ ] Main admin user list shows workshop origin badge for converted users
- [ ] Badge links to workshop details
- [ ] Badge only shows for users who came from workshops

**Dependencies:** B1

---

#### C2: Create/Edit Workshop Form
**File:** `src/pages/admin/workshops/WorkshopForm.tsx`

**Multi-step form with tabs:**

**Tab 1: Basic Info**
- Cohort Name (required)
- Slug (required, auto-generated from name, editable)
- Description (optional, Markdown supported)
- Workshop Type (required, radio: In Person / Online)
- Location (required based on type):
  - If In Person: Physical address field with helper text
  - If Online: URL field (e.g., Zoom link) with helper text

**Tab 2: Schedule & Access**
- Workshop Start Date/Time (required)
- Workshop End Date/Time (required)
- Access Grant Date/Time (required) - with helper: "When should participants gain full platform access?"
- Trial Start Date/Time (required) - with helper: "When should the trial period countdown begin?"
- Trial Duration in Days (required, default: 30)
- Primary Timezone (required, dropdown of IANA timezones, default: America/Los_Angeles)
- Secondary Timezone (optional, dropdown) - with helper: "Show times in multiple zones (e.g., '10am PST / 1pm EST')"

**Tab 3: Registration**
- Registration Deadline (optional) - with helper: "Stop accepting signups before workshop"
- Maximum Enrollment (optional) - with helper: "Leave blank for unlimited"

**Tab 4: Customization**
- Welcome Message (required, Markdown editor with preview) - with helper: "This appears on the countdown page participants see before the workshop"
- Post-Workshop Resources (optional, dynamic list: title + URL)
- Post-Trial Action (required, radio buttons with descriptions)

**Tab 5: Email Templates**
- **Full editing access to all 7 email templates**
- Each email shows:
  - Subject line (editable text field with emoji support)
  - Preheader text (editable text field with emoji support)
  - Body content (rich text WYSIWYG editor with full formatting):
    - **Text Formatting:**
      - Bold, Italic, Underline, Strikethrough
      - Headings (H1, H2, H3)
      - Bullet lists and numbered lists
      - Blockquotes
      - Horizontal rules
    - **Font Styling:**
      - Font size selector (8px - 72px)
      - Font family dropdown (system fonts + web-safe fonts):
        - Arial, Helvetica, Georgia, Times New Roman, Courier New
        - Verdana, Trebuchet MS, Impact, Comic Sans MS
      - Font color picker (full color palette)
      - Background color/highlight (full color palette)
    - **Emoji Support:**
      - Native emoji picker button in toolbar
      - Full emoji keyboard access (😊 🌸 ✨ 💜 🎉 etc.)
      - Emojis render correctly in all major email clients
      - Fallback support for older email clients
    - **Alignment:**
      - Left, Center, Right, Justify
    - **Links:**
      - Hyperlink insertion/editing
      - Link color customization
    - **Images (optional enhancement):**
      - Image upload/insertion
      - Image alignment and sizing
  - **Template Tags** (shown as buttons to insert):
    - `{{firstName}}` - User's first name
    - `{{workshopName}}` - Cohort name
    - `{{workshopDate}}` - Workshop date formatted
    - `{{workshopTime}}` - Workshop time with timezone(s)
    - `{{workshopLocation}}` - Physical address or Zoom link
    - `{{accessGrantDate}}` - When platform access unlocks
    - `{{trialStartDate}}` - When trial begins
    - `{{trialDurationDays}}` - Length of trial
    - `{{charityName}}` - User's selected charity
    - `{{loginUrl}}` - Link to login page
  - **Live Preview:**
    - Side-by-side editor and preview panes
    - Preview renders with sample data
    - Shows desktop and mobile views
    - Updates in real-time as admin types
  - **Utility Buttons:**
    - [Save Changes]
    - [Preview with Sample Data]
    - [Send Test Email]
    - [Reset to Default Template]
    - [Copy from Another Email] (reuse formatting/content)

**Tab 6: Email Schedule**
- Send Reminder Email (checkbox, default: true)
- Reminder Timing (hours before, default: 24)
- Custom Email Schedule (advanced accordion):
  - Email 1 (Welcome): Sent immediately on signup (not configurable)
  - Email 2 (Reminder): X hours before workshop (configured above)
  - Email 3 (Following the Trail): X hours after workshop ends (default: 2)
  - Email 4 (Seeing the Whole Picture): X days after Email 3 (default: 7)
  - Email 5 (Now We're Talking): X days after Email 4 (default: 7)
  - Email 6 (Making My Move): X days after Email 5 (default: 7)
  - Email 7 (Different Now - Wrap-up): X days after Email 6 (default: 7)

**Tab 7: Review & Publish**
- Summary of all settings
- Preview of countdown page
- Preview of first email
- [Save as Draft] [Publish Workshop]

**Acceptance Criteria:**
- [ ] All required fields validated
- [ ] Date/time fields show selected primary timezone
- [ ] Slug auto-generated but editable
- [ ] Workshop type changes location field appropriately
- [ ] Timezone selector includes all IANA zones
- [ ] Secondary timezone is truly optional
- [ ] Markdown preview works for welcome message
- [ ] Post-trial action options clearly explained
- [ ] All 7 email templates editable with rich text editor
- [ ] **Email editor supports emojis** - emoji picker accessible from toolbar
- [ ] **Font formatting works** - size, family, color, background color all functional
- [ ] **Text formatting works** - bold, italic, underline, headings, lists, alignment
- [ ] **Emojis render correctly** in email preview and actual sent emails
- [ ] **Font choices are email-safe** - tested across Gmail, Outlook, Apple Mail, etc.
- [ ] Template tags insert correctly at cursor position
- [ ] Email preview renders with sample data (both desktop and mobile views)
- [ ] Live preview updates in real-time as admin edits
- [ ] Can reset individual emails to defaults
- [ ] Can copy formatting/content from another email
- [ ] Can send test email to admin's address with all formatting preserved
- [ ] Can save as draft and return later
- [ ] Publishing changes status to 'open_registration'
- [ ] Form pre-filled when editing existing workshop
- [ ] Helpful tooltips on complex fields
- [ ] Welcome message field prominently placed and clearly labeled
- [ ] Email formatting saved to database as HTML
- [ ] HTML sanitized to prevent XSS but allows safe formatting tags

**Dependencies:** C1, B1

---

#### C2b: Rich Text Email Editor Component
**File:** `src/components/admin/workshops/RichTextEmailEditor.tsx`

**Purpose:** Reusable WYSIWYG email editor component used in Tab 5 of workshop form

**Recommended Library:** **Quill** - Clean API, emoji support, good email HTML output

```bash
npm install quill react-quill emoji-mart dompurify
```

**Component Features:**

**Toolbar Configuration:**
```javascript
const modules = {
  toolbar: [
    // Text formatting
    [{ 'header': [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],

    // Font styling
    [{ 'size': ['8px', '10px', '12px', '14px', '16px', '18px', '24px', '36px', '48px', '72px'] }],
    [{ 'font': ['Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana'] }],
    [{ 'color': [] }, { 'background': [] }],

    // Alignment and lists
    [{ 'align': [] }],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],

    // Links and media
    ['link'],
    ['blockquote', 'code-block'],

    // Custom buttons
    ['emoji', 'template-tags'],

    // Utilities
    ['clean']
  ],
  emoji: true, // Custom emoji module
};
```

**Custom Toolbar Buttons:**
1. **Emoji Picker Button:**
   - Integrates `emoji-mart` library
   - Opens emoji picker popover
   - Inserts emoji at cursor position
   - Supports search and categories

2. **Template Tags Dropdown:**
   - Shows all available tags
   - Inserts tag syntax when clicked
   - Tooltips explain what each tag does
   - Visual distinction from regular text (e.g., badge styling)

**Email-Safe HTML Output:**
```javascript
import DOMPurify from 'dompurify';

function sanitizeEmailHTML(html) {
  const config = {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3',
                   'ul', 'ol', 'li', 'a', 'span', 'div', 'blockquote'],
    ALLOWED_ATTR: ['style', 'href', 'target'],
    ALLOWED_STYLE_PROPS: ['color', 'font-size', 'font-family',
                          'background-color', 'text-align'],
  };

  return DOMPurify.sanitize(html, config);
}
```

**Live Preview Panel:**
- Split-pane view: Editor on left, preview on right
- Desktop/mobile toggle for preview
- Real-time rendering as admin types
- Template tags rendered with sample data
- Preview matches actual email appearance

**Email Client Compatibility:**
- Inline CSS (no external stylesheets)
- Email-safe font stacks with fallbacks
- UTF-8 encoding for emoji support
- Responsive table-based layout (for Outlook compatibility)
- Tested across: Gmail, Outlook (2016/2019/365/web), Apple Mail, Yahoo, Thunderbird

**Acceptance Criteria:**
- [ ] Quill editor initialized with full toolbar
- [ ] Emoji picker opens and inserts emojis correctly
- [ ] Font size dropdown offers email-safe sizes
- [ ] Font family dropdown offers email-safe fonts
- [ ] Color pickers work for text and background
- [ ] Text formatting (bold, italic, etc.) works
- [ ] Lists, alignment, and links functional
- [ ] Template tags button shows dropdown with all tags
- [ ] Template tags insert at cursor position
- [ ] Live preview updates in real-time (debounced)
- [ ] Preview shows desktop and mobile views
- [ ] HTML output is sanitized (XSS-safe)
- [ ] HTML output is email-client compatible
- [ ] Component reusable for all 7 email templates
- [ ] Can paste formatted text and it preserves safe formatting
- [ ] Can save and load HTML content
- [ ] Emojis display correctly in editor and preview

**Dependencies:** C1, B1

---

#### C3: Workshop Enrollment Dashboard
**File:** `src/pages/admin/workshops/WorkshopEnrollments.tsx`

**Features:**
- List of all enrolled users for selected workshop
- Search by name or email
- Filter by enrollment status
- Export to CSV
- View individual enrollment details

**Visual Design:**
```
┌────────────────────────────────────────────────────────────┐
│  Spring 2026 Bootcamp - Enrollments (24/50)                │
├────────────────────────────────────────────────────────────┤
│  Search: [________]  Status: [All ▾]      [Export CSV]    │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │ Name          Email            Status    Enrolled  │   │
│  ├────────────────────────────────────────────────────┤   │
│  │ Jane Doe      jane@ex.com      Active   Feb 1      │   │
│  │ John Smith    john@ex.com      Enrolled Jan 28     │   │
│  │ Alice Jones   alice@ex.com     Active   Feb 3      │   │
│  └────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────┘
```

**Enrollment Detail View (modal or side panel):**
- User name and email
- Enrolled date
- First login date
- Trial started date
- Trial expires date
- Status
- Emails sent (list with timestamps)
- Last active date
- Actions: [Send Test Email] [Extend Trial] [Withdraw User]

**Acceptance Criteria:**
- [ ] All enrolled users displayed
- [ ] Search works for name and email
- [ ] Status filter shows correct counts
- [ ] CSV export includes all relevant fields
- [ ] Detail view shows complete enrollment history
- [ ] Admin can manually trigger test email
- [ ] Admin can extend trial period
- [ ] Admin can withdraw user (with confirmation)

**Dependencies:** C1, B1

---

#### C4: Workshop Analytics Dashboard
**File:** `src/pages/admin/workshops/WorkshopAnalytics.tsx`

**Metrics displayed:**
- Total enrollments over time (line chart)
- Enrollment status breakdown (pie chart)
- Email engagement rates (bar chart)
- Trial conversion rate
- Average time to first login
- Active users per day

**Acceptance Criteria:**
- [ ] Charts render correctly
- [ ] Metrics update in real-time
- [ ] Date range filter works
- [ ] Comparison to previous workshops
- [ ] Export analytics to PDF

**Dependencies:** C1, B1

---

### Phase 4: Workshop Signup Flow (Group D)
**Sequential Execution:** D1 → D2 → D3 → D4

#### D1: Workshop Landing Page
**File:** `src/pages/WorkshopSignup.tsx`

**Route:** `/workshop/:slug`

**Features:**
- Fetch workshop by slug
- Display cohort name and description
- Show workshop date/time
- Show enrollment count (if max enrollment set)
- If full: Show waitlist message
- If past registration deadline: Show closed message
- Otherwise: Show signup form (same as regular signup)

**Visual Design:**
```
┌────────────────────────────────────────────────────────────┐
│                                                             │
│          Spring 2026 Small Business Bootcamp               │
│                                                             │
│  Join us for a transformative 30-day journey where         │
│  you'll discover the true cost of your products and        │
│  make confident pricing decisions.                         │
│                                                             │
│  Workshop Date: March 15, 2026 at 10:00 AM EST            │
│  Enrolled: 24 / 50 participants                            │
│                                                             │
│  ──────────────────────────────────────────────────────    │
│                                                             │
│  Step 1: Create Your Account                              │
│  Email: [________________]                                 │
│                                                             │
│  [Continue]                                                │
└────────────────────────────────────────────────────────────┘
```

**Signup Flow (reuse existing components):**
1. Email input
2. Create passphrase
3. Confirm passphrase
4. Choose charity
5. Complete worksheet
6. Enrollment confirmation (replaces payment page)

**CRITICAL: Same login as regular users**
- Workshop users sign up using the same email/passphrase system as regular users
- After signup, they use the same login page as everyone else: `/login`
- Backend detects workshop enrollment via `currentWorkshopEnrollmentId` field
- If workshop access not yet granted, redirect to countdown page
- If workshop access granted, allow normal platform access

**Worksheet Progress Saving:**
- If user closes browser before completing worksheet, progress is saved
- When they return and log in, worksheet resumes from where they left off
- Worksheet completion is tracked in `worksheet_completed_at` field
- Incomplete worksheet does not block enrollment - they can finish it later
- System reminds users to complete worksheet in reminder email

**Acceptance Criteria:**
- [ ] Workshop details fetch from API
- [ ] Enrollment count updates in real-time
- [ ] Signup flow matches existing flow exactly
- [ ] Charity selection works identically
- [ ] Worksheet progress saves automatically
- [ ] Incomplete worksheet resumable on next login
- [ ] Worksheet completion tracked in database
- [ ] No payment step for workshop users
- [ ] Same login page used for all users (`/login`)
- [ ] Backend detects workshop enrollment and routes appropriately
- [ ] 404 page if workshop slug not found
- [ ] Clear message if workshop full or closed

**Dependencies:** B2

---

#### D2: Workshop Thank You Page
**File:** `src/pages/WorkshopThankYou.tsx`

**Shown after successful enrollment:**

```
┌────────────────────────────────────────────────────────────┐
│                                                             │
│              You're All Set!                               │
│                                                             │
│  Thank you for enrolling in the Spring 2026                │
│  Small Business Bootcamp.                                  │
│                                                             │
│  We're excited to see you on:                              │
│                                                             │
│      📅  March 15, 2026 at 10:00 AM EST                    │
│                                                             │
│  What happens next:                                        │
│                                                             │
│  ✓  You'll receive a welcome email shortly                │
│  ✓  We'll send a reminder 24 hours before the workshop    │
│  ✓  Your full platform access begins on March 15          │
│  ✓  Your 30-day free trial starts on March 15             │
│                                                             │
│  You can log in anytime to see your countdown.            │
│                                                             │
│  [Go to Login]                                             │
└────────────────────────────────────────────────────────────┘
```

**Acceptance Criteria:**
- [ ] Workshop date/time displayed prominently
- [ ] Clear expectations set
- [ ] Welcome email mention
- [ ] Reminder email mention
- [ ] Access and trial timing explained
- [ ] Login button navigates to /login

**Dependencies:** D1, B2

---

#### D3: Workshop Countdown Page
**File:** `src/pages/WorkshopCountdown.tsx`

**Shown when workshop user logs in before access granted:**

```
┌────────────────────────────────────────────────────────────┐
│                                                             │
│          Spring 2026 Small Business Bootcamp               │
│                                                             │
│  Your workshop begins in:                                  │
│                                                             │
│      ┌─────────────────────────────────────┐              │
│      │    5 days  12 hours  34 minutes     │              │
│      └─────────────────────────────────────┘              │
│                                                             │
│  Workshop starts:                                          │
│    March 15, 2026 at 10:00 AM PST / 1:00 PM EST          │
│                                                             │
│  Platform access:                                          │
│    March 15, 2026 at 10:00 AM PST / 1:00 PM EST          │
│                                                             │
│  Location: [Physical Address or Zoom Link]                │
│                                                             │
│  ──────────────────────────────────────────────────────    │
│                                                             │
│  {Custom welcome message from admin - Markdown rendered}   │
│                                                             │
│  Example: "We're thrilled to have you! Before the         │
│  workshop, think about one product you'd like to           │
│  analyze in depth. Bring questions!"                       │
│                                                             │
│  ──────────────────────────────────────────────────────    │
│                                                             │
│  Need help? [Contact Support]                             │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

**Features:**
- Live countdown timer (updates every second)
- Display workshop start time with timezone(s) based on admin config
  - If only primary timezone set: "10:00 AM PST"
  - If both primary and secondary set: "10:00 AM PST / 1:00 PM EST"
- Display workshop location (physical address or Zoom link)
  - If Zoom link, make it clickable
  - If physical address, show as text
- Display custom welcome message (Markdown rendered)
- Show post-workshop resources (if added by admin after workshop)
- Auto-redirect when access time arrives

**Acceptance Criteria:**
- [ ] Countdown timer accurate and updates in real-time
- [ ] Primary timezone always displayed
- [ ] Secondary timezone displayed if configured by admin
- [ ] Timezone abbreviations correct (PST, EST, etc.)
- [ ] Location shown appropriately based on workshop type
- [ ] Zoom links are clickable
- [ ] Markdown rendering works for welcome message
- [ ] Auto-refresh when access time arrives
- [ ] Page detects access grant and redirects to dashboard
- [ ] Responsive design for mobile
- [ ] WCAG 2.1 AA compliant
- [ ] Handles DST transitions correctly

**Dependencies:** D1, B3

---

#### D4: Access Control Integration
**File:** `src/App.tsx` (update routing)

**Key Changes:**
1. Add workshop countdown route
2. Update protected route logic to check workshop access
3. Regular users skip workshop checks entirely

**Logic:**
```typescript
// In route guard
if (user.currentWorkshopEnrollmentId) {
  const enrollment = await getEnrollment(user.currentWorkshopEnrollmentId);
  const workshop = await getWorkshop(enrollment.workshopId);

  if (!hasWorkshopAccess(enrollment, workshop)) {
    // Redirect to countdown page
    navigate('/workshop/countdown');
    return;
  }
}

// Otherwise, allow access to platform
```

**Acceptance Criteria:**
- [ ] Workshop users redirected to countdown before access time
- [ ] Regular users never see countdown page
- [ ] Access check happens on every protected route
- [ ] Access grant is instant (no delay)
- [ ] Trial starts according to admin settings

**Dependencies:** D1, D2, D3, B3

---

### Phase 5: Email Automation System (Group E)
**Parallel Execution:** E1 and E2 can run in parallel

#### E1: Workshop Email Templates
**File:** `audacious_money_backend/src/services/email/workshopEmails.ts`

**IMPORTANT:** These are the default templates shown below in plain text format for reference. In the actual implementation:
- Admins have **full editing access** via rich text WYSIWYG editor in workshop creation form (Tab 5)
- Admins can customize **all content**: subjects, preheaders, body text, formatting, colors, fonts, emojis
- Emails are sent as **HTML with full formatting** (not plain text)
- Emails include **mobile-responsive design** and **plain text fallback** for accessibility
- All **emojis and custom formatting preserved** in sent emails

Templates support these template tags (dynamically replaced at send-time):
- `{{firstName}}` - User's first name
- `{{workshopName}}` - Cohort name
- `{{workshopDate}}` - Workshop date formatted
- `{{workshopTime}}` - Workshop time with timezone(s)
- `{{workshopLocation}}` - Physical address or Zoom link
- `{{accessGrantDate}}` - When platform access unlocks
- `{{trialStartDate}}` - When trial begins
- `{{trialDurationDays}}` - Length of trial
- `{{charityName}}` - User's selected charity
- `{{loginUrl}}` - Link to login page

---

**Email 1: Welcome Email (sent immediately after signup)**

**Subject:** [AM] IN! Here's your first steps
**Preheader:** A little prework, one product, and a promise about your recipes

**Body:**
```
Hey {{firstName}},

Welcome — I am so glad you're here!

Good on you for signing up and leaning into the part most entrepreneurs avoid: the numbers 😬

Here is what I want you to know before we begin — you are wildly capable. You don't have to become a different person to understand your business. You just need a little guidance and a place that feels safe enough to be honest.

So let's get you ready.

**Before class, there's about an hour of prework.** It isn't busywork — it is the foundation everything else sits on. Here's what it looks like:

1. **Pick ONE product.** Just one. Your bestseller, your favorite, or the one you are most curious (or most nervous) about. We're going to follow it all the way through.
2. **Gather your invoices & receipts.** Ingredients, packaging, labels — whatever goes into that one product. Recent ones, so we're working off today's prices, not last year's.
3. **Fill out the worksheet.** We'll walk you through your product's information line by line. No accounting degree required, I promise.
4. **Add your invoices.** Put them in so your costs reflect what you're actually paying now.

→ **Have this complete by the beginning of the workshop.**

{{loginUrl}}

Log in to pick up where you left off.

**Now, about your recipes.** I know your formulations are sacred — they are the heart of everything you have built. So let me be completely clear: this software is *zero-knowledge*. Your recipes, your invoices, your numbers are encrypted in a way that even I cannot see them. Not me. Not anyone. I'm a true believer in sovereignty — your business is yours and your data belongs to you and only you.

One more thing — and this one's just for fun:

Before we get into the software, what do you *think* it costs you to make one unit of that product right now? Go with what you currently know to be true. **Hit reply and send me your number.**

Once your worksheet is done, you'll land on the **countdown page** — it'll tick down to {{workshopDate}} for our workshop and when the full app opens up for you.

That's it. One product. A few invoices. Your current number. You've got this.

See you {{workshopDate}},
Audrey
*Audacious Money*

**P.S.** If anything feels stuck or unclear, just reply to this email. A real human (me) is on the other end.

---

Your chosen charity: {{charityName}}
Audacious Money will contribute: $5/mo (starts after {{trialDurationDays}}-day free trial)
```

**Acceptance Criteria:**
- [ ] Template tags properly replaced with dynamic data at send-time
- [ ] Charity selection confirmed and displayed
- [ ] All links functional and trackable
- [ ] Tone is encouraging and non-judgmental
- [ ] **Mobile responsive HTML** - emails render beautifully on all devices
- [ ] **Plain text fallback** - accessible for text-only email clients
- [ ] **Emojis render correctly** across all major email clients
- [ ] **Custom formatting preserved** - fonts, colors, sizes all display as admin designed
- [ ] **HTML properly sanitized** - XSS prevention while allowing safe formatting
- [ ] Reply-to: hello@audacious.money
- [ ] Admin can edit all content, formatting, and styling in workshop setup (Tab 5)
- [ ] Template tags available as insert buttons in WYSIWYG editor
- [ ] UTF-8 encoding ensures emoji support
- [ ] Tested across Gmail, Outlook (web/desktop), Apple Mail, Yahoo Mail

---

**Email 2: Workshop Reminder (sent 24 hours before workshop, or admin-configured time)**

**Subject:** [AM] Ready for tomorrow?
**Preheader:** What to expect and what to bring

**Body:**
```
Hey {{firstName}},

Tomorrow is the day. ✨

In about 24 hours, we are getting together to connect you deeper with your business — and I cannot wait.

A tiny checklist so you walk in ready:

- ✅ **Your worksheet is complete** — one product, invoices added. If it's not quite finished, that's okay. Do what you can. → **[Finish your worksheet]** {{loginUrl}}
- ✅ **Your laptop is charged and connects to WiFi.** This is hands-on — you'll have your product clarity on screen *and* in hand.
- ✅ **You've brought yourself, exactly as you are.**

📅 {{workshopDate}} at {{workshopTime}}
📍 {{workshopLocation}}

Can't wait to get a little curious (and maybe a little uncomfortable — that's where the good stuff lives).

Remember: your numbers are the language your business has been speaking to you this whole time. Tomorrow, we start listening together.

There is liberation in knowledge that can't be expressed until it's felt. Come ready to feel it.

See you in the morning,
Audrey

**P.S.** Didn't get to that initial cost number question yet? Hit reply and send it now.
```

**Acceptance Criteria:**
- [ ] Sent at admin-configured time before workshop
- [ ] Workshop details dynamically inserted (date, time, location)
- [ ] If online workshop, location shows Zoom link (clickable)
- [ ] If in-person workshop, location shows physical address
- [ ] Preparation guidance included
- [ ] Encouraging, non-pressuring tone
- [ ] Template tags properly replaced
- [ ] Admin can edit all content

---

**Email 3: Week 1 - Following the Trail (sent 2 hours after workshop ends, or admin-configured time)**

**Subject:** [AM] Following the Trail
**Preheader:** Get curious and just notice everything

**Body:**
```
HEYO!

Am I just nerdy or was that a great workshop - thank you for joining us! 🌸

Now the real magic begins: 30 days of small, intentional steps. Not a big, overwhelming overhaul. Just one focused move each week. (This is exactly how lasting change actually forms — tiny and consistent beats heroic and unsustainable, every time.)

**This week: follow ONE product, start to finish.**

Take the product we worked with — and this time, watch it move through it's cycle to bring it to life. From raw materials all the way to your customer's hands. As you go, just notice:

- How much **time** it actually takes you (mixing, packaging, labeling — all of it)
- Every **touchpoint** it passes through on its way to a customer

You're not fixing anything yet. You're just paying attention. Awareness first. Always.

Here's your question for the week:

**How many separate touchpoints did your product pass through before it reached your customer? Reply with just the number**

I read every reply - the language of numbers is beautiful in all it's forms.

Talk soon,
{{firstName}}

**P.S.** Presence, not performance. There is no wrong number here — there's just what is true.
```

**Acceptance Criteria:**
- [ ] Sent at configured time after workshop (default: 2 hours after)
- [ ] Clear, single focus for the week
- [ ] Step-by-step guidance
- [ ] Emphasizes "one product" (not overwhelming)
- [ ] Encouraging, non-judgmental tone
- [ ] Encourages email replies
- [ ] Template tags properly replaced
- [ ] Admin can edit all content

---

**Email 4: Week 2 - Seeing the Whole Picture (sent 7 days after Email 3, or admin-configured schedule)**

**Subject:** [AM] Seeing the Whole Picture
**Preheader:** The math is done - here's what to do with what you found

**Body:**
```
Hey {{firstName}},

Last week you watched your product travel. This week, we put a number on it.

**This week: update the complete cost per unit in the software**

Not just materials. The whole truth:

> **Materials + Labor (your time has value) + Distribution (the journey to your customer)**

Most entrepreneurs are stunned by one part in particular — and for so many, it's their own labor. Your time is one of your largest costs, even (*especially*) when you're the one doing the work. So count it. If your business grew, you'd have to pay someone to do this, right? That's the number.

This is the moment your business stops being a mystery and starts being yours.

And here's your question:

**Remember your number from Day 1? What are you seeing now that you've done the math? Hit reply and tell me.**

I genuinely want to know — and there's no judgment in either direction. It is just information. Beautiful, useful information.

Cheering you on,
Audrey
```

**Acceptance Criteria:**
- [ ] Builds on previous week's work
- [ ] Clear formula provided (Materials + Labor + Distribution)
- [ ] Non-judgmental language
- [ ] Encourages email replies
- [ ] Template tags properly replaced
- [ ] Admin can edit all content

---

**Email 5: Week 3 - Now We're Talking (sent 7 days after Email 4, or admin-configured schedule)**

**Subject:** [AM] Now We're Talking
**Preheader:** Your number, your price and what your business is telling you

**Body:**
```
Hey {{firstName}},

You know your number now and going at this with your eyes wide open.

That's game changer energy, my friend.

This week, we put it next to your price.

**This week: compare your complete cost to what you're currently charging.**

That's it. Line them up and look. What you see is your business telling you something specific — not a judgment, not a grade. Just a signal. And now you speak the language, so you can actually hear it.

Some of what you find will feel like momentum. Some of it might point to your next move. Either way, you earned this clarity — and clarity is where confident decisions are made.

Here's your question:

**What is your cost per unit telling you right now? Hit reply with one word.**

One word. I'll know exactly what you mean.

Still cheering,
Audrey
```

**Acceptance Criteria:**
- [ ] Builds on previous weeks
- [ ] Simple comparison task
- [ ] Normalizes all outcomes (no judgment)
- [ ] Prepares for decision-making week
- [ ] Encouraging, empowering tone
- [ ] Encourages email replies
- [ ] Template tags properly replaced
- [ ] Admin can edit all content

---

**Email 6: Week 4 - Making My Move (sent 7 days after Email 5, or admin-configured schedule)**

**Subject:** [AM] Making My Move
**Preheader:** One decision

**Body:**
```
Hi {{firstName}},

You've watched. You've calculated. You've listened. Now we move.

**This week: make ONE informed decision.**

Just one. You don't have to overhaul everything — that's how people burn out and abandon the whole thing. One decision, made on purpose, is how real change actually sticks.

It could be:

- Adjusting a price
- Focusing on the channel that actually serves you
- Streamlining one part of your process
- Saying a respectful *"no"* to an opportunity that doesn't fit

Saying yes to what serves your goals — and no to what doesn't — isn't being difficult. It's being intentional. That's the whole point.

Your question this week is really a commitment:

**What is the ONE decision you're making this week — and *when exactly* will you make it? Reply and put it in writing.**

Saying it out loud (or typing it to me) makes it real. So hit reply, tell me your decision and your day, and I'll be in your corner when it happens.

Proud of you,
Audrey
```

**Acceptance Criteria:**
- [ ] Celebrates progress
- [ ] Encourages one decision (not overwhelming)
- [ ] Lists possible actions without prescribing
- [ ] Non-judgmental, empowering tone
- [ ] Encourages email replies with commitment
- [ ] Template tags properly replaced
- [ ] Admin can edit all content
- [ ] Note: Trial expiration handled separately in Email 7

---

**Email 7: 30-Day Wrap-Up (sent 7 days after Email 6, or admin-configured schedule)**

**Subject:** [AM] Different Now
**Preheader:** 30 days. One product. A whole new way of seeing your business

**Body:**
```
Hey {{firstName}},

Thirty days ago you showed up - for your numbers, for your buisness, for yourself.

And you did the work.

You followed one product all the way through. You learned what it actually costs to make it.

You lined up your price and looked it in the eye. And then you made a decision - on purpose, with clarity - because now you speak the language.

So here's my favorite question of this entire journey:

**What feels different now? Hit reply and let me know** 🌸

I read every single one.

And one more thing on a more personal note - because you've spent 30 days inside this software, your experience matters more to me than almost anyone else's right now:

**What would make this tool work even harder for you and your business?**

I'm actively building and I want to build it for *you*. No suggestion is too small or too bold. Hit reply and tell me that too.

Thank you for trusting this process - and for trusting me with your numbers. It's not lost on me what that takes.

Money matters, but the heart counts.. here's to knowing your worth, my friend.

Audrey *Audacious Money*

**P.S.** This was never about becoming perfect with your numbers. It was about becoming *connected* to them. And you did exactly that. 🌸

---

**Continue Your Journey:**

Your {{trialDurationDays}}-day free trial ends soon. To keep building on this foundation and supporting {{charityName}}, upgrade to $20/month:

✓ Full access to all features
✓ Unlimited transactions and reports
✓ $5/month donated to {{charityName}}
✓ Ongoing support and updates

[Upgrade Now] {{loginUrl}}
```

**Acceptance Criteria:**
- [ ] Celebrates completion of 30-day journey
- [ ] Requests feedback on experience
- [ ] Requests feedback on product improvements
- [ ] Encourages email replies
- [ ] Includes upgrade prompt with clear benefits
- [ ] Mentions charity contribution continuing
- [ ] Warm, personal, celebratory tone
- [ ] Template tags properly replaced
- [ ] Admin can edit all content

**Dependencies:** None (templates only)

---

#### E2: Email Scheduling Service
**File:** `audacious_money_backend/src/services/email/workshopEmailScheduler.ts`

**Features:**
- Cron job checks for emails to send every 5 minutes
- Query enrollments where email should be sent
- Send email and log in enrollment.emails_sent
- Handle failures with retry logic (3 attempts)
- Track delivery status

**Logic:**
```typescript
// Cron job runs every 5 minutes
async function checkAndSendWorkshopEmails() {
  const enrollments = await getEnrollmentsNeedingEmails();

  for (const enrollment of enrollments) {
    const workshop = await getWorkshop(enrollment.workshopId);
    const schedule = getEmailSchedule(workshop);
    const now = new Date();

    // Check which emails should be sent
    const emailsToSend = [];

    // Welcome email (sent at enrollment, already handled in enrollment endpoint)

    // Reminder email
    if (shouldSendReminder(enrollment, schedule.reminder, now)) {
      emailsToSend.push('reminder');
    }

    // Weekly emails (Emails 3-7)
    if (shouldSendWeeklyEmail(enrollment, schedule.week1, now, 'week1')) {
      emailsToSend.push('week1'); // Email 3: Following the Trail
    }
    if (shouldSendWeeklyEmail(enrollment, schedule.week2, now, 'week2')) {
      emailsToSend.push('week2'); // Email 4: Seeing the Whole Picture
    }
    if (shouldSendWeeklyEmail(enrollment, schedule.week3, now, 'week3')) {
      emailsToSend.push('week3'); // Email 5: Now We're Talking
    }
    if (shouldSendWeeklyEmail(enrollment, schedule.week4, now, 'week4')) {
      emailsToSend.push('week4'); // Email 6: Making My Move
    }
    if (shouldSendWeeklyEmail(enrollment, schedule.wrapup, now, 'wrapup')) {
      emailsToSend.push('wrapup'); // Email 7: Different Now (30-day wrap-up)
    }

    // Send emails
    for (const emailType of emailsToSend) {
      await sendWorkshopEmail(enrollment, workshop, emailType);
      await logEmailSent(enrollment.id, emailType);
    }
  }
}

function shouldSendWeeklyEmail(
  enrollment: WorkshopEnrollment,
  scheduledTime: Date,
  currentTime: Date,
  emailType: string
): boolean {
  // Check if already sent
  const alreadySent = enrollment.emailsSent.some(
    log => log.emailType === emailType && log.successful
  );
  if (alreadySent) return false;

  // Check if scheduled time has arrived (within 5-minute window)
  const fiveMinutesAgo = new Date(currentTime.getTime() - 5 * 60 * 1000);
  return scheduledTime <= currentTime && scheduledTime > fiveMinutesAgo;
}
```

**Acceptance Criteria:**
- [ ] Cron job runs reliably every 5 minutes
- [ ] Emails sent within 5-minute window of scheduled time
- [ ] No duplicate emails sent
- [ ] Failed sends retried up to 3 times
- [ ] All sends logged in database
- [ ] Email delivery tracked
- [ ] Unsubscribe link honored (user can opt out)

**Dependencies:** E1, B2

---

#### E2b: HTML Email Rendering Service
**File:** `audacious_money_backend/src/services/email/htmlEmailRenderer.ts`

**Purpose:** Convert admin's custom HTML with template tags into properly formatted, email-client-compatible HTML

**Key Functions:**

```typescript
/**
 * Render email template with user data
 */
async function renderEmailTemplate(
  workshop: Workshop,
  enrollment: WorkshopEnrollment,
  user: User,
  emailType: EmailType
): Promise<{ html: string; text: string; subject: string; preheader: string }> {

  // Get custom template or fall back to default
  const template = workshop.customEmailTemplates?.[emailType] || getDefaultTemplate(emailType);

  // Replace template tags with actual data
  const renderedSubject = replaceTags(template.subject, workshop, user);
  const renderedPreheader = replaceTags(template.preheader, workshop, user);
  const renderedBody = replaceTags(template.body, workshop, user);

  // Wrap body in responsive email layout
  const html = wrapInEmailLayout(renderedBody, workshop);

  // Generate plain text version
  const text = htmlToPlainText(renderedBody);

  return { html, text, subject: renderedSubject, preheader: renderedPreheader };
}

/**
 * Replace template tags with actual values
 */
function replaceTags(content: string, workshop: Workshop, user: User): string {
  const tags = {
    '{{firstName}}': user.firstName || 'there',
    '{{workshopName}}': workshop.cohortName,
    '{{workshopDate}}': formatDate(workshop.workshopStartDatetime),
    '{{workshopTime}}': formatTime(workshop.workshopStartDatetime, workshop.primaryTimezone, workshop.secondaryTimezone),
    '{{workshopLocation}}': workshop.location,
    '{{accessGrantDate}}': formatDate(workshop.accessGrantDatetime),
    '{{trialStartDate}}': formatDate(workshop.trialStartDatetime),
    '{{trialDurationDays}}': workshop.trialDurationDays.toString(),
    '{{charityName}}': user.selectedCharity?.name || 'your chosen charity',
    '{{loginUrl}}': 'https://app.audacious.money/login',
  };

  let result = content;
  for (const [tag, value] of Object.entries(tags)) {
    result = result.replace(new RegExp(tag, 'g'), value);
  }

  return result;
}

/**
 * Format time with timezone(s)
 */
function formatTime(
  datetime: Date,
  primaryTz: string,
  secondaryTz?: string
): string {
  const primaryTime = formatInTimezone(datetime, primaryTz);

  if (secondaryTz) {
    const secondaryTime = formatInTimezone(datetime, secondaryTz);
    return `${primaryTime} / ${secondaryTime}`;
  }

  return primaryTime;
}

/**
 * Wrap content in responsive email layout
 */
function wrapInEmailLayout(bodyHtml: string, workshop: Workshop): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${workshop.cohortName}</title>
  <style>
    /* Email-safe CSS */
    body {
      margin: 0;
      padding: 0;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 16px;
      line-height: 1.6;
      color: #333333;
      background-color: #f4f4f4;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      padding: 20px;
    }
    a {
      color: #4b006e; /* Royal purple */
      text-decoration: underline;
    }
    /* Responsive */
    @media only screen and (max-width: 600px) {
      .email-container {
        padding: 10px !important;
      }
    }
  </style>
</head>
<body>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding: 20px 0;">
        <table class="email-container" role="presentation" width="600" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding: 20px;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding: 20px; text-align: center; font-size: 12px; color: #666666; border-top: 1px solid #dddddd;">
              <p>Audacious Money | Building your business with confidence</p>
              <p><a href="{{unsubscribeUrl}}" style="color: #666666;">Unsubscribe</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * Convert HTML to plain text for fallback
 */
function htmlToPlainText(html: string): string {
  // Remove HTML tags
  let text = html.replace(/<[^>]*>/g, '');

  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');

  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}
```

**Email Sending Integration:**

```typescript
import { sendEmail } from './emailService';

async function sendWorkshopEmail(
  enrollment: WorkshopEnrollment,
  workshop: Workshop,
  emailType: EmailType
) {
  const user = await getUser(enrollment.userId);

  // Render email with custom formatting
  const { html, text, subject, preheader } = await renderEmailTemplate(
    workshop,
    enrollment,
    user,
    emailType
  );

  // Send via email service (e.g., SendGrid, Postmark)
  await sendEmail({
    to: user.email,
    from: 'hello@audacious.money',
    replyTo: 'hello@audacious.money',
    subject: subject,
    html: html,
    text: text,
    customArgs: {
      workshopId: workshop.id,
      enrollmentId: enrollment.id,
      emailType: emailType,
    },
  });

  // Log email sent
  await logEmailSent(enrollment.id, emailType);
}
```

**Acceptance Criteria:**
- [ ] Template tags replaced with correct user/workshop data
- [ ] HTML output is email-client compatible (tested across all major clients)
- [ ] Emojis preserved and display correctly in sent emails
- [ ] Custom formatting (fonts, colors, sizes) preserved
- [ ] Responsive layout works on mobile devices
- [ ] Plain text fallback generated automatically
- [ ] Royal purple brand color used for links
- [ ] Unsubscribe link included in footer
- [ ] UTF-8 encoding set correctly
- [ ] Preheader text included in email headers
- [ ] Email service integration works (SendGrid/Postmark/etc.)
- [ ] Failed sends logged and retried
- [ ] Default templates used if custom template not set

**Dependencies:** E1, E2, C2b

---

#### E3: Admin Email Preview & Test
**File:** `src/pages/admin/workshops/EmailPreview.tsx`

**Features:**
- Select which email to preview (Welcome, Reminder, Week 1, Week 2, Week 3, Week 4, Wrap-up)
- Live preview with sample data
- Send test email to admin's address
- Edit custom timing
- See all template tags available for each email

**Visual Design:**
```
┌────────────────────────────────────────────────────────────┐
│  Email Preview - Spring 2026 Bootcamp                      │
├────────────────────────────────────────────────────────────┤
│  Select Email: [Week 1 ▾]                                  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  PREVIEW                                             │ │
│  │  ─────────────────────────────────────────────────── │ │
│  │                                                       │ │
│  │  Subject: Week 1: Choose Your Product               │ │
│  │                                                       │ │
│  │  Hi [First Name],                                    │ │
│  │                                                       │ │
│  │  Great to see you at the workshop! Now it's time... │ │
│  │  ...                                                  │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                             │
│  Schedule: 2 hours after workshop ends                    │
│  [Edit Timing]                                             │
│                                                             │
│  [Send Test Email to Me]                                  │
└────────────────────────────────────────────────────────────┘
```

**Acceptance Criteria:**
- [ ] All email templates previewed accurately
- [ ] HTML rendering matches actual emails
- [ ] Test emails deliver successfully
- [ ] Admin can customize timing from preview
- [ ] Changes save and affect future sends

**Dependencies:** E1, E2, C2

---

### Phase 6: Trial Management & Post-Trial Actions (Group F)
**Sequential Execution:** F1 → F2 → F3

#### F1: Flexible Trial Start Logic
**File:** `audacious_money_backend/src/services/trialManagement.ts`

**Features:**
- Cron job checks enrollments every hour
- Start trial according to admin setting (trialStartDatetime)
- Calculate expiration based on trial duration
- Update enrollment record

**Logic:**
```typescript
async function checkAndStartTrials() {
  const enrollments = await getEnrollmentsNeedingTrialStart();

  for (const enrollment of enrollments) {
    const workshop = await getWorkshop(enrollment.workshopId);
    const now = new Date();

    if (hasTrialStarted(enrollment, workshop)) {
      const trialStartedAt = new Date();
      const trialExpiresAt = calculateTrialExpiration(workshop, trialStartedAt);

      await updateEnrollment(enrollment.id, {
        trialStartedAt,
        trialExpiresAt,
        status: 'active',
      });

      // Send trial started email (optional)
      await sendTrialStartedEmail(enrollment, workshop);
    }
  }
}
```

**Acceptance Criteria:**
- [ ] Trials start at admin-configured time
- [ ] Trial expiration calculated accurately
- [ ] Timezone handling correct
- [ ] Enrollment status updated
- [ ] No duplicate trial starts

**Dependencies:** A3, B2

---

#### F2: Trial Expiration Handling
**File:** `audacious_money_backend/src/services/trialExpiration.ts`

**Features:**
- Cron job checks expiring trials every hour
- Execute post-trial action based on workshop setting
- Send trial expiration email

**Logic:**
```typescript
async function checkExpiredTrials() {
  const expiredEnrollments = await getExpiredTrials();

  for (const enrollment of expiredEnrollments) {
    const workshop = await getWorkshop(enrollment.workshopId);

    // Update enrollment status
    await updateEnrollment(enrollment.id, {
      status: 'trial_expired',
    });

    // Execute post-trial action
    switch (workshop.postTrialAction) {
      case 'upgrade_prompt':
        await sendUpgradePromptEmail(enrollment);
        // User can continue using platform with modal prompt
        break;

      case 'auto_convert':
        await attemptAutoConversion(enrollment);
        // If successful, status becomes 'converted'
        // If fails (no payment method), fallback to upgrade_prompt
        break;

      case 'account_freeze':
        await freezeAccount(enrollment.userId);
        await sendAccountFrozenEmail(enrollment);
        // User cannot access platform until upgrade
        break;
    }
  }
}
```

**Acceptance Criteria:**
- [ ] Trials expire at correct time
- [ ] Post-trial action executed correctly
- [ ] upgrade_prompt shows modal but allows access
- [ ] auto_convert attempts payment and handles failure
- [ ] account_freeze blocks platform access
- [ ] Clear email sent explaining next steps
- [ ] User can manually upgrade from any state

**Dependencies:** F1

---

#### F3: Upgrade Flow for Workshop Users
**File:** `src/components/subscription/WorkshopUpgrade.tsx`

**Features:**
- Modal shown based on post-trial action
- Stripe payment form (reuse existing)
- Upon successful payment:
  - Create subscription
  - Update enrollment status to 'converted'
  - Remove currentWorkshopEnrollmentId (graduate to regular user)
  - Grant full ongoing access

**Visual Design:**
```
┌────────────────────────────────────────────────────────────┐
│  Your Free Trial Has Ended                                 │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  You've completed your 30-day journey!                     │
│                                                             │
│  To continue accessing Audacious Money and supporting       │
│  [Charity Name], upgrade to our monthly plan:             │
│                                                             │
│  $20/month includes:                                       │
│  ✓  Full access to all features                           │
│  ✓  Unlimited transactions and reports                    │
│  ✓  $5/month donated to your chosen charity                       │
│  ✓  Ongoing support and updates                           │
│                                                             │
│  [Credit Card Form]                                        │
│                                                             │
│  [Upgrade Now]  [Maybe Later]                             │
└────────────────────────────────────────────────────────────┘
```

**Acceptance Criteria:**
- [ ] Modal appearance based on post-trial action
- [ ] Stripe integration works correctly
- [ ] Payment success creates subscription
- [ ] Enrollment status updated to 'converted'
- [ ] User graduated to regular user (no workshop restrictions)
- [ ] Charity contribution starts automatically
- [ ] "Maybe Later" allows continued access if upgrade_prompt
- [ ] "Maybe Later" blocked if account_freeze

**Dependencies:** F2

---

### Phase 7: Security & Testing (Group G)
**Sequential Execution:** G1 → G2 → G3

#### G1: Security Hardening

**Tasks:**
1. Audit all workshop endpoints for authorization
2. Validate only admin can create/edit workshops
3. Ensure users can only enroll in open workshops
4. Prevent enrollment duplication
5. Sanitize all user input (workshop description, welcome message)
6. Rate limiting on enrollment endpoints
7. CSRF protection on POST endpoints
8. Validate slug format (no XSS via URL)

**Acceptance Criteria:**
- [ ] All endpoints require proper authentication
- [ ] Admin-only endpoints reject non-admin users
- [ ] User input sanitized (XSS prevention)
- [ ] Rate limits prevent abuse
- [ ] SQL injection tests pass
- [ ] CSRF tokens validate correctly
- [ ] No sensitive data in logs

**Dependencies:** All B, C, D, E, F tasks

---

#### G2: Unit & Integration Tests

**Backend Tests:**
- `workshops.routes.test.ts` - Workshop CRUD endpoints
- `workshopEnrollments.routes.test.ts` - Enrollment endpoints
- `workshopAccess.test.ts` - Access control utilities
- `workshopEmailScheduler.test.ts` - Email scheduling logic
- `trialManagement.test.ts` - Trial start and expiration

**Frontend Tests:**
- `WorkshopSignup.test.tsx` - Signup flow
- `WorkshopCountdown.test.tsx` - Countdown page
- `WorkshopForm.test.tsx` - Admin workshop creation
- `WorkshopEnrollments.test.tsx` - Admin enrollment management

**Target Coverage:** Greater than 85%

**Acceptance Criteria:**
- [ ] All endpoints have test coverage
- [ ] Happy path tests pass
- [ ] Error cases handled
- [ ] Edge cases tested (timezone, leap years, etc.)
- [ ] Integration tests for full enrollment flow

**Dependencies:** G1

---

#### G3: End-to-End Testing

**Test Scenarios:**
1. Admin creates workshop → Publishes → Workshop accessible at URL
2. User enrolls in workshop → Receives welcome email → Sees countdown page
3. User logs in before access time → Sees countdown → Access time arrives → Dashboard unlocks
4. Trial starts at configured time → Expiration calculated correctly
5. Weekly emails send at scheduled times → Content correct
6. Trial expires → Post-trial action executes correctly
7. User upgrades → Subscription created → Workshop enrollment converted

**Tools:** Playwright

**Acceptance Criteria:**
- [ ] All critical paths have E2E tests
- [ ] Tests run in CI/CD pipeline
- [ ] Email delivery verified in tests
- [ ] Time-based tests handle scheduling
- [ ] Screenshots captured on failure
- [ ] Test data cleanup after runs

**Dependencies:** G2

---

### Phase 8: Deployment & Monitoring (Group H)
**Sequential Execution:** H1 → H2 → H3

#### H1: Database Migration

**Tasks:**
1. Review migration script (013_educational_workshops.sql)
2. Test on staging database
3. Backup production database
4. Run migration on production
5. Verify schema changes
6. Rollback plan prepared

**Acceptance Criteria:**
- [ ] Migration tested on staging
- [ ] Backup created before production migration
- [ ] Migration completes without errors
- [ ] All indexes created successfully
- [ ] Foreign keys working correctly
- [ ] Rollback script tested

**Dependencies:** G3 (all testing complete)

---

#### H2: Feature Flags & Gradual Rollout

**File:** `src/config/featureFlags.ts` (update)

```typescript
export const FEATURE_FLAGS = {
  WORKSHOP_SYSTEM: false, // Start disabled
  WORKSHOP_ENROLLMENTS: false,
  WORKSHOP_EMAILS: false,
};
```

**Rollout Plan:**
1. Enable for admin/founder only (internal testing)
2. Create first workshop and enroll test users
3. Validate email delivery and scheduling
4. Enable for all users

**Acceptance Criteria:**
- [ ] Feature flags control visibility
- [ ] Can enable/disable without deployment
- [ ] Admin interface hidden until enabled
- [ ] Workshop signup URLs return 404 until enabled
- [ ] Metrics tracked per cohort

**Dependencies:** H1

---

#### H3: Monitoring & Alerts

**Metrics to Track:**
- Workshop enrollments per day
- Email delivery success rate
- Trial conversion rate
- Average time to first login after access granted
- Weekly email engagement (open/click rates)
- Trial expiration actions executed

**Alerts to Configure:**
- Email delivery failures (greater than 5% failure rate)
- Workshop enrollment failures
- Trial expiration job failures
- Access control errors

**Tools:** Grafana + Prometheus (already in place)

**Acceptance Criteria:**
- [ ] All metrics visible in dashboard
- [ ] Alerts configured with correct thresholds
- [ ] Email failures trigger immediate notification
- [ ] Cron job failures logged and alerted
- [ ] Dashboard shows per-workshop analytics

**Dependencies:** H2

---

## Success Metrics

### Launch Criteria (All must be met)

- [ ] All acceptance criteria in Phases 1-8 complete
- [ ] Security audit passed
- [ ] Greater than 85% test coverage
- [ ] Zero critical bugs
- [ ] Email delivery rate greater than 95%
- [ ] Admin trained on workshop creation
- [ ] Test workshop successfully completed
- [ ] Rollback plan tested
- [ ] Documentation complete

### Post-Launch Metrics

- **Enrollment Rate:** Track signups per workshop
- **Email Engagement:** Open rate greater than 40%, click rate greater than 15%
- **Trial Conversion:** Greater than 30% of workshop users convert to paid
- **Time to First Login:** Average less than 24 hours after access granted
- **Support Tickets:** Less than 5% of workshop users need support
- **User Satisfaction:** Post-workshop survey greater than 4.0/5.0

---

## Dependencies Graph

```
Phase 1 (Foundation)
├── A1 (Database) ────────┬──────────────┬──────────────┐
├── A2 (Types)            │              │              │
└── A3 (Utilities)        │              │              │
                          ↓              ↓              ↓
Phase 2 (Backend)         │              │              │
├── B1 (Workshop CRUD) ←──┘              │              │
├── B2 (Enrollment) ←────────────────────┘              │
└── B3 (Access MW) ←─────────────────────────────────────┘
                          ↓              ↓
Phase 3 (Admin UI)        │              │
├── C1 (List) ←───────────┤              │
├── C2 (Form) ←───────────┤              │
├── C2b (Email Editor) ←──┤              │
├── C3 (Enrollments) ←────┤              │
└── C4 (Analytics) ←──────┘              │
                                         ↓
Phase 4 (Signup)                         │
├── D1 (Landing) ←───────────────────────┤
├── D2 (Thank You) ←─────────────────────┤
├── D3 (Countdown) ←─────────────────────┤
└── D4 (Integration) ←───────────────────┘
                          ↓              ↓
Phase 5 (Email)           │              │
├── E1 (Templates)        │              │
├── E2 (Scheduler) ←──────┤              │
├── E2b (HTML Renderer) ←─┤              │
└── E3 (Preview) ←────────┴──────────────┘
                          ↓
Phase 6 (Trial)           │
├── F1 (Start Logic) ←────┤
├── F2 (Expiration) ←─────┤
└── F3 (Upgrade) ←────────┘
                          ↓
Phase 7 (Security)        │
├── G1 (Hardening) ←──────┤
├── G2 (Unit Tests) ←─────┤
└── G3 (E2E Tests) ←──────┘
                          ↓
Phase 8 (Deploy)          │
├── H1 (Migration) ←──────┤
├── H2 (Rollout) ←────────┤
└── H3 (Monitoring) ←─────┘
```

---

## Parallel Execution Plan

### Sprint 1: Foundation
**Parallel Tasks:**
- Agent A: Phase 1 (A1, A2, A3) - Database, types, utilities
- Agent B: Phase 5 (E1) - Email templates (no dependencies)

### Sprint 2: Backend
**Parallel Tasks:**
- Agent A: Phase 2 (B1, B2) - Workshop and enrollment endpoints
- Agent B: Phase 2 (B3) - Access control middleware

### Sprint 3: Admin Interface
**Parallel Tasks:**
- Agent A: Phase 3 (C1, C2, C2b) - Workshop list, form, and rich text email editor
- Agent B: Phase 3 (C3, C4) - Enrollments and analytics

### Sprint 4: User Experience
**Sequential:**
- Agent A: Phase 4 (D1, D2, D3, D4) - Signup flow and countdown

### Sprint 5: Email Automation
**Parallel Tasks:**
- Agent A: Phase 5 (E2, E2b) - Email scheduler and HTML rendering service
- Agent B: Phase 5 (E3) - Admin email preview and testing

### Sprint 6: Trial Management
**Sequential:**
- Agent A: Phase 6 (F1, F2, F3) - Trial logic and upgrade flow

### Sprint 7: Security & Testing
**Sequential:**
- Agent A: Phase 7 (G1, G2, G3) - Security, unit tests, E2E tests

### Sprint 8: Deployment
**Sequential:**
- Agent A: Phase 8 (H1, H2, H3) - Migration, rollout, monitoring

---

## User Experience Improvements

### Suggested Enhancements (While Maintaining Integrity)

1. **Progress Tracking**
   - Show visual progress bar in emails ("Week 2 of 4")
   - Display completion percentage on countdown page
   - Celebrate milestones (first login, worksheet completion)

2. **Community Features**
   - Optional cohort discussion board
   - Peer accountability check-ins
   - Share progress anonymously with cohort

3. **Resource Library**
   - Pre-workshop preparation materials
   - Post-workshop recordings and slides
   - Downloadable worksheets

4. **Engagement Boosters**
   - Optional SMS reminders (in addition to email)
   - Push notifications for platform access unlock
   - Celebration animation when access grants

5. **Accessibility**
   - Countdown timer with screen reader support
   - High contrast mode for countdown page
   - Keyboard navigation for all workshop flows
   - WCAG 2.1 AA compliance throughout

---

## Risk Mitigation

### High Risk Items

1. **Email Deliverability**
   - Risk: Workshop emails might not reach users
   - Mitigation: Use reputable email service, monitor delivery rates, provide in-app notifications as backup
   - Fallback: Manual email sends by admin if automation fails

2. **Time Zone Complexity**
   - Risk: Access times calculated incorrectly across time zones
   - Mitigation: Store all times in UTC, display in user's local timezone, thorough testing
   - Fallback: Manual access grants by admin if issues occur

3. **Trial Start Confusion**
   - Risk: Users confused about when trial starts vs. when access grants
   - Mitigation: Clear language in all communications, visual timeline on countdown page
   - Fallback: Admin can manually adjust trial dates per user

4. **Enrollment Overflow**
   - Risk: Workshop fills up instantly, late enrollers disappointed
   - Mitigation: Max enrollment caps, registration deadlines, waitlist option
   - Fallback: Admin can increase max enrollment or create second cohort

5. **Email Schedule Complexity**
   - Risk: Custom schedules result in emails sent at wrong times
   - Mitigation: Admin preview with calculated send times, test email functionality
   - Fallback: Cron job monitoring, manual sends if needed



## Acceptance Sign-Off

### Phase Completion Checklist

Each phase requires sign-off before proceeding to next:

- [ ] **Phase 1:** Database schema reviewed and approved
- [ ] **Phase 2:** API endpoints tested and approved
- [ ] **Phase 3:** Admin UI reviewed and approved
- [ ] **Phase 4:** User signup flow tested and approved
- [ ] **Phase 5:** Email templates approved, scheduler tested
- [ ] **Phase 6:** Trial logic tested and approved
- [ ] **Phase 7:** Security audit passed, tests at 85%+
- [ ] **Phase 8:** Production deployment successful

---

## Key Architectural Decisions

### Hybrid User Model Rationale
The hybrid approach (workshop users vs. regular users) maintains platform integrity by:
- Allowing existing users to continue with immediate access
- Providing time-gated education for workshop cohorts
- Using a single codebase with conditional logic
- Avoiding separate databases or user types
- Enabling smooth graduation from workshop to regular user

### Flexible Trial Start Rationale
Admin control over trial start timing enables:
- Starting trial on signup (standard approach)
- Starting trial on access grant (workshop day)
- Starting trial on first login (engagement-based)
- Different strategies for different educational models

### Email Automation Rationale
Scheduled emails based on workshop timing (not enrollment timing) ensures:
- All cohort members receive emails simultaneously
- Educational content aligns with workshop progress
- Admin can customize timing per cohort needs
- Users experience structured, predictable communication

---

## Future Enhancements (Post-Launch)

### Potential Additions
1. **Multi-Session Workshops** - Workshops with multiple live sessions over several weeks
2. **Recurring Workshops** - Templates for workshops that repeat quarterly
3. **Waitlist Management** - Automatic enrollment when spots open up
4. **Cohort Messaging** - Admin can send custom broadcasts to entire cohort
5. **Advanced Analytics** - Cohort comparisons, A/B testing on email timing
6. **Integration with Zoom** - Automatic calendar invites and join links
7. **Certificate Generation** - Completion certificates for workshop graduates
8. **Referral System** - Workshop participants can invite others to next cohort

---

## Key Documents

- This roadmap: `Roadmaps/EDUCATIONAL_WORKSHOP_SYSTEM_ROADMAP.md`
- Database schema: `audacious_money_backend/src/db/migrations/013_educational_workshops.sql`
- Email templates: `audacious_money_backend/src/services/email/workshopEmails.ts`
- Access control utilities: `audacious_money_backend/src/utils/workshopAccess.ts`

---

**Last Updated:** 2026-06-07
**Version:** 1.0
**Status:** Ready for Review and Implementation

---


**Notes for Implementation:**
- All dates/times should be stored in UTC in database (not PST)
- Display all dates/times in admin-configured timezone(s)
- Email send times calculated in UTC, sent regardless of user timezone
- Admin interface should clearly indicate timezone (primary + optional secondary)
- Test thoroughly with users in different timezones
- Consider daylight saving time transitions
- Email HTML sanitization must balance security (XSS prevention) with creative freedom (formatting preservation)
- Emoji support requires UTF-8 encoding throughout entire email pipeline
- Rich text editor component (C2b) is reusable for any future HTML editing needs

---

## Email Customization Summary

### What Admins Can Control

**Content:**
- All 7 email subjects, preheaders, and body text
- Template tags for dynamic personalization

**Formatting:**
- Font families (email-safe options)
- Font sizes (8px - 72px)
- Font colors and background highlights (full color palette)
- Text styles (bold, italic, underline, strikethrough, headings)
- Alignment (left, center, right, justify)
- Lists (bulleted, numbered)
- Links with custom colors
- Blockquotes and code blocks

**Visual Elements:**
- Full emoji support 🌸 ✨ 💜
- Native emoji picker in editor
- Custom brand colors throughout

**Technical Implementation:**
- **C2b: Rich Text Email Editor Component** - WYSIWYG editor with Quill
- **E2b: HTML Email Rendering Service** - Converts custom HTML to email-safe format
- Live preview with desktop/mobile views
- Send test emails to verify formatting
- Reset to default templates anytime
- Copy formatting between emails

### Email Client Compatibility

Tested and supported:
- Gmail (web, iOS, Android)
- Outlook (2016, 2019, 365, web)
- Apple Mail (macOS, iOS)
- Yahoo Mail
- Thunderbird
- Others (via responsive HTML and plain text fallback)

Emojis render correctly across all platforms with UTF-8 encoding.
