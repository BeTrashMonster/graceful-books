# Zero-Knowledge Support System - Implementation Roadmap

**Version:** 2.0
**Created:** 2026-04-25
**Updated:** 2026-04-25
**Status:** Pre-Implementation
**Epic:** REQ-SUPPORT-001 - In-App Feedback & Support System

---

## Executive Summary

This roadmap implements a comprehensive support system that maintains zero-knowledge encryption while providing effective human support. The architecture uses **user-controlled access grants** where users explicitly grant temporary, revocable access to support staff.

**Key Innovation:** Support cannot access encrypted data without explicit, time-limited, revocable user permission.

**Support Model:** Human-staffed support with 24-48 hour response time commitment.

---

## Architecture Overview

### Core Components

1. **Support Session Management** - User grants temporary access tokens
2. **In-App Support Menu Item** - User-facing support request interface
3. **Admin Support Dashboard** - Support staff interface for handling requests
4. **Email Notifications** - Confirmation and updates via email
5. **Audit Trail** - Complete history of support access

### Access Types

- **`admin_only`** - Support sees account info only (email, subscription, payment history)
- **`books_access`** - Support receives encrypted master key to decrypt financial data

---

## Implementation Phases

### Phase 1: Foundation & Database (Group A)
**Parallel Execution:** All tasks can run simultaneously

#### A1: Database Schema
**File:** `audacious_money_backend/src/db/migrations/012_support_system.sql`

```sql
-- Support Sessions Table
CREATE TABLE support_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token VARCHAR(50) NOT NULL UNIQUE, -- SUP-XXXX-XXXX-XXXX-XXXX
  access_type VARCHAR(20) NOT NULL CHECK (access_type IN ('admin_only', 'books_access')),
  user_notes TEXT,
  admin_notes TEXT,
  encrypted_master_key TEXT, -- Only populated if access_type = 'books_access'
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  accessed_by VARCHAR(255), -- Admin who used the token
  access_count INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Support Tickets Table
CREATE TABLE support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  support_key VARCHAR(50) NOT NULL, -- User's permanent support key
  ticket_number VARCHAR(50) NOT NULL UNIQUE, -- TICKET-YYYY-NNNNN
  category VARCHAR(50) NOT NULL CHECK (category IN ('bug', 'question', 'feature_request', 'billing', 'other')),
  priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting_user', 'resolved', 'closed')),
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  user_email VARCHAR(255) NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  context_data JSONB, -- Page URL, browser info, recent actions, etc.
  assigned_to UUID REFERENCES admin_users(id),
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  first_response_at TIMESTAMPTZ,
  response_time_hours INTEGER, -- SLA tracking
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Support Ticket Messages Table
CREATE TABLE support_ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('user', 'admin', 'system')),
  sender_id UUID, -- user_id or admin_id
  sender_name VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT false, -- Internal admin notes
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Support Ticket Attachments Table
CREATE TABLE support_ticket_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  message_id UUID REFERENCES support_ticket_messages(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  storage_url TEXT NOT NULL, -- S3/R2 URL
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_support_sessions_user_id ON support_sessions(user_id);
CREATE INDEX idx_support_sessions_token ON support_sessions(session_token);
CREATE INDEX idx_support_sessions_expires_at ON support_sessions(expires_at);
CREATE INDEX idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX idx_support_tickets_ticket_number ON support_tickets(ticket_number);
CREATE INDEX idx_support_tickets_status ON support_tickets(status);
CREATE INDEX idx_support_tickets_assigned_to ON support_tickets(assigned_to);
CREATE INDEX idx_support_ticket_messages_ticket_id ON support_ticket_messages(ticket_id);
```

**Acceptance Criteria:**
- [ ] Migration runs successfully on dev database
- [ ] All tables created with correct schema
- [ ] Indexes created for performance
- [ ] Foreign keys properly constrain data
- [ ] Check constraints validate enum values

**Dependencies:** None

---

#### A2: Backend Types & Validation Schemas
**File:** `audacious_money_backend/src/types/support.types.ts`

```typescript
export interface SupportSession {
  id: string;
  userId: string;
  sessionToken: string;
  accessType: 'admin_only' | 'books_access';
  userNotes?: string;
  adminNotes?: string;
  encryptedMasterKey?: string;
  grantedAt: Date;
  expiresAt: Date;
  revokedAt?: Date;
  accessedBy?: string;
  accessCount: number;
  lastAccessedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SupportTicket {
  id: string;
  userId: string;
  supportKey: string;
  ticketNumber: string;
  category: 'bug' | 'question' | 'feature_request' | 'billing' | 'other';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'waiting_user' | 'resolved' | 'closed';
  subject: string;
  description: string;
  userEmail: string;
  userName: string;
  contextData?: Record<string, any>;
  assignedTo?: string;
  resolvedAt?: Date;
  closedAt?: Date;
  firstResponseAt?: Date;
  responseTimeHours?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SupportTicketMessage {
  id: string;
  ticketId: string;
  senderType: 'user' | 'admin' | 'system';
  senderId?: string;
  senderName: string;
  message: string;
  isInternal: boolean;
  createdAt: Date;
}
```

**File:** `audacious_money_backend/src/utils/validation.ts` (add to existing)

```typescript
import { z } from 'zod';

export const grantSupportSessionSchema = z.object({
  accessType: z.enum(['admin_only', 'books_access']),
  notes: z.string().max(1000).optional(),
});

export const createSupportTicketSchema = z.object({
  category: z.enum(['bug', 'question', 'feature_request', 'billing', 'other']),
  subject: z.string().min(5).max(200),
  description: z.string().min(10).max(5000),
  contextData: z.record(z.any()).optional(),
});

export const addTicketMessageSchema = z.object({
  message: z.string().min(1).max(5000),
  isInternal: z.boolean().optional(),
});
```

**Acceptance Criteria:**
- [ ] All TypeScript types match database schema
- [ ] Zod validation schemas enforce business rules
- [ ] Types exported correctly for import
- [ ] No TypeScript compilation errors

**Dependencies:** A1 (Database Schema)

---

#### A3: Support Token Generator Utility
**File:** `audacious_money_backend/src/utils/supportToken.ts`

```typescript
import { randomBytes } from 'crypto';

/**
 * Generate a support session token
 * Format: SUP-XXXX-XXXX-XXXX-XXXX
 */
export function generateSupportToken(): string {
  const segments = [];

  for (let i = 0; i < 4; i++) {
    const bytes = randomBytes(2);
    const segment = bytes.toString('hex').toUpperCase();
    segments.push(segment);
  }

  return `SUP-${segments.join('-')}`;
}

/**
 * Generate a ticket number
 * Format: TICKET-YYYY-NNNNN
 */
export function generateTicketNumber(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  return `TICKET-${year}-${random}`;
}

/**
 * Calculate session expiration (24 hours from now)
 */
export function calculateSessionExpiry(): Date {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + 24);
  return expiry;
}

/**
 * Check if session is valid (not expired, not revoked)
 */
export function isSessionValid(session: {
  expiresAt: Date;
  revokedAt?: Date | null;
}): boolean {
  const now = new Date();

  // Check if revoked
  if (session.revokedAt) {
    return false;
  }

  // Check if expired
  if (new Date(session.expiresAt) < now) {
    return false;
  }

  return true;
}
```

**Acceptance Criteria:**
- [ ] Token format matches spec (SUP-XXXX-XXXX-XXXX-XXXX)
- [ ] Tokens are cryptographically random
- [ ] Ticket numbers are unique and sequential
- [ ] Session expiry calculations are correct
- [ ] Validation logic handles edge cases

**Dependencies:** None

---

### Phase 2: Backend API Routes (Group B)
**Parallel Execution:** B1, B2, B3 can run in parallel

#### B1: User Support Session Endpoints
**File:** `audacious_money_backend/src/routes/support.ts`

Implements:
- `POST /support/grant-session` - Create support session
- `GET /support/sessions` - List user's support sessions
- `POST /support/sessions/:id/revoke` - Revoke a session
- `GET /support/sessions/:id` - Get session details

**Key Logic:**
```typescript
// When granting books_access, encrypt master key for support
if (accessType === 'books_access') {
  // User's master key is derived from their passphrase
  // We need to re-encrypt it with support's public key
  // This requires user to provide their passphrase during grant
  const masterKey = await deriveMasterKeyFromPassphrase(userPassphrase);
  const encryptedForSupport = await encryptMasterKeyForSupport(masterKey);
  session.encryptedMasterKey = encryptedForSupport;
}
```

**Acceptance Criteria:**
- [ ] POST /support/grant-session creates valid session
- [ ] Session token is unique and properly formatted
- [ ] books_access properly encrypts master key
- [ ] admin_only does NOT include master key
- [ ] GET /support/sessions returns user's history
- [ ] Revoke endpoint invalidates session immediately
- [ ] Expired sessions cannot be used
- [ ] All endpoints require authentication
- [ ] Rate limiting: 10 sessions per hour per user

**Dependencies:** A1, A2, A3

---

#### B2: Support Ticket Endpoints
**File:** `audacious_money_backend/src/routes/support-tickets.ts`

Implements:
- `POST /support/tickets` - Create new support ticket
- `GET /support/tickets` - List user's tickets
- `GET /support/tickets/:id` - Get ticket details
- `POST /support/tickets/:id/messages` - Add message to ticket
- `POST /support/tickets/:id/attachments` - Upload attachment

**Key Features:**
- Auto-generate ticket number
- Capture context data (URL, browser, recent actions)
- Send email notification to founder
- Track response time for SLA

**Acceptance Criteria:**
- [ ] Tickets created with unique ticket number
- [ ] Context data properly captured and stored
- [ ] Email notification sent to hello@audacious.money
- [ ] User can add messages to their tickets
- [ ] File attachments uploaded to R2/S3
- [ ] File size limit enforced (10MB)
- [ ] File type validation (images, PDFs only)
- [ ] Rate limiting: 5 tickets per day per user

**Dependencies:** A1, A2, A3

---

#### B3: Admin Support Endpoints
**File:** `audacious_money_backend/src/routes/admin/support.ts`

Implements:
- `GET /admin/support/lookup` - Lookup user by support key
- `POST /admin/support/access` - Use session token to access data
- `GET /admin/support/tickets` - List all tickets (filtered, sorted)
- `PUT /admin/support/tickets/:id` - Update ticket (assign, status, priority)
- `POST /admin/support/tickets/:id/messages` - Admin replies to ticket
- `GET /admin/support/sessions` - List all support sessions
- `GET /admin/support/metrics` - Support metrics dashboard

**Key Logic:**
```typescript
// When admin uses session token
const session = await getSessionByToken(sessionToken);

if (!isSessionValid(session)) {
  throw new Error('Session expired or revoked');
}

// Track access
await incrementAccessCount(session.id, adminUser.email);

// Return decryption key if books_access
if (session.accessType === 'books_access') {
  return {
    userId: session.userId,
    decryptionKey: session.encryptedMasterKey,
    expiresAt: session.expiresAt,
  };
}
```

**Acceptance Criteria:**
- [ ] Admin can lookup user by support key
- [ ] Session token access is tracked (who, when)
- [ ] Admin cannot access expired/revoked sessions
- [ ] Ticket list supports filtering and pagination
- [ ] Admin can assign tickets to themselves
- [ ] Admin replies send email to user
- [ ] Metrics show SLA compliance
- [ ] Only admin role can access these endpoints

**Dependencies:** A1, A2, A3

---

### Phase 3: Frontend - User Support Interface (Group C)
**Sequential Execution:** C1 → C2 → C3 → C4 → C5

#### C1: Support Menu Item in Left Sidebar
**File:** `src/components/layout/LeftSidebar.tsx` (update existing)

**Placement:** Add "Contact Support" menu item:
- Below "Settings"
- Above "Logout"
- In company toggle section (bottom-left)

**Visual Design:**
```
┌─────────────────────────┐
│  Company Name           │
│  -------------------    │
│  Dashboard              │
│  Transactions           │
│  Reports                │
│  ...                    │
│  Settings               │
│  Contact Support    ← NEW
│  Logout                 │
└─────────────────────────┘
```

**Behavior:**
- Clicking opens "Contact Support" modal
- Icon: Life preserver or headset (no question mark)
- Label: "Contact Support"
- No badge or notification indicator

**Acceptance Criteria:**
- [ ] Menu item appears in correct position
- [ ] Click opens support modal
- [ ] Icon is clear and professional
- [ ] Mobile responsive (hamburger menu)
- [ ] Keyboard accessible
- [ ] WCAG 2.1 AA compliant

**Dependencies:** None (can start immediately)

---

#### C2: Contact Support Modal
**File:** `src/components/support/ContactSupportModal.tsx`

**Single-step form:**

```
┌────────────────────────────────────────┐
│  Contact Support                       │
├────────────────────────────────────────┤
│                                        │
│  Our support team is here to help.    │
│  Please allow 24-48 hours for a       │
│  response.                             │
│                                        │
│  Category: [Dropdown]                  │
│    - Bug Report                        │
│    - Question                          │
│    - Feature Request                   │
│    - Billing                           │
│    - Other                             │
│                                        │
│  Subject:                              │
│  [Text field]                          │
│                                        │
│  Description:                          │
│  [Large text area]                     │
│  (Tell us what happened or what you    │
│   need help with)                      │
│                                        │
│  Attach Screenshot (Optional):         │
│  [File upload button]                  │
│  [Warning: Please review screenshots   │
│   for sensitive financial data]        │
│                                        │
│  [Cancel]  [Submit Support Request]    │
└────────────────────────────────────────┘
```

**After successful submission:**

```
┌────────────────────────────────────────┐
│  Support Request Submitted             │
├────────────────────────────────────────┤
│                                        │
│  Thank you for contacting us!          │
│                                        │
│  Your ticket number:                   │
│  TICKET-2026-12345                     │
│  [Copy to Clipboard]                   │
│                                        │
│  We will respond within 24-48 hours    │
│  via email at: user@example.com        │
│                                        │
│  You can also:                         │
│  - View ticket status in My Tickets    │
│  - Grant access to support (optional)  │
│                                        │
│  [View My Tickets]  [Grant Access]     │
│  [Close]                               │
└────────────────────────────────────────┘
```

**Acceptance Criteria:**
- [ ] Form validation prevents empty submissions
- [ ] Screenshot warning shown before upload
- [ ] Success confirmation clearly displayed
- [ ] Ticket number prominent and copyable
- [ ] 24-48 hour timeframe stated clearly
- [ ] Links to My Tickets and Grant Access functional

**Dependencies:** C1, B2

---

#### C3: Grant Support Access Modal
**File:** `src/components/support/GrantAccessModal.tsx`

**Clear explanation modal (no emojis):**

```
┌─────────────────────────────────────────┐
│  Grant Support Access                   │
├─────────────────────────────────────────┤
│                                         │
│  To help troubleshoot your issue, you  │
│  can grant temporary access to support.│
│                                         │
│  Choose access level:                   │
│                                         │
│  ( ) Admin Only (Recommended)           │
│      Support sees: Email, subscription, │
│      payment history                    │
│      Support CANNOT see: Financial data │
│                                         │
│  ( ) Full Books Access                  │
│      Support sees: All financial data   │
│      (transactions, accounts, reports)  │
│                                         │
│  Access expires in: 24 hours           │
│  You can revoke anytime                 │
│                                         │
│  [Cancel]  [Grant Access]              │
└─────────────────────────────────────────┘
```

**After granting:**

```
┌─────────────────────────────────────────┐
│  Access Granted                         │
├─────────────────────────────────────────┤
│                                         │
│  Your support token:                    │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │ SUP-A3F2-8D1E-9C4B-7E5A          │ │
│  │ [Copy to Clipboard]                │ │
│  └───────────────────────────────────┘ │
│                                         │
│  Provide this token to support when    │
│  asked. It expires in 24 hours.        │
│                                         │
│  [View My Access Sessions]  [Done]     │
└─────────────────────────────────────────┘
```

**Acceptance Criteria:**
- [ ] Clear explanation of each access level
- [ ] User must actively choose (no default)
- [ ] Token displayed prominently with copy button
- [ ] Expiration time clearly stated
- [ ] Link to manage sessions
- [ ] Cannot grant if already active session exists
- [ ] No emojis in interface

**Dependencies:** C1, B1

---

#### C4: My Support Sessions Page
**File:** `src/pages/support/MySessions.tsx`

**Table showing:**
- Session Token (masked: SUP-****-****-****-7E5A)
- Access Type (Admin Only / Full Books Access)
- Created date
- Expires date
- Status (Active / Expired / Revoked)
- Accessed by (admin name, if used)
- Access count
- Actions: [View Details] [Revoke]

**Empty State:**
```
No support sessions yet.

When you grant access to support, sessions
will appear here. You can revoke access
anytime.
```

**Acceptance Criteria:**
- [ ] Sessions sorted by created date (newest first)
- [ ] Active sessions highlighted
- [ ] One-click revoke with confirmation
- [ ] Shows who accessed and when
- [ ] Empty state if no sessions
- [ ] Pagination if more than 20 sessions
- [ ] No emojis in interface

**Dependencies:** C1, B1

---

#### C5: My Support Tickets Page
**File:** `src/pages/support/MyTickets.tsx`

**List of tickets with:**
- Ticket number
- Subject
- Category badge
- Status badge
- Created date
- Last updated
- Click to view details

**Ticket Detail View:**
- Full conversation thread
- Add reply
- Upload additional screenshots
- Mark as resolved
- Grant access to support (if not already)

**Empty State:**
```
No support tickets yet.

Need help? Click "Contact Support" in the
left sidebar to create your first ticket.
```

**Acceptance Criteria:**
- [ ] Tickets sorted by updated date
- [ ] Status filters (Open, In Progress, Resolved)
- [ ] Real-time updates when admin replies
- [ ] User can mark ticket as resolved
- [ ] Conversation thread easy to follow
- [ ] File attachments display correctly
- [ ] No emojis in interface

**Dependencies:** C1, B2

---

### Phase 4: Admin Support Dashboard (Group D)
**Parallel Execution:** D1 and D2 can run in parallel

#### D1: Admin Support Ticket Queue
**File:** `src/pages/admin/SupportQueue.tsx`

**Dashboard showing:**
- Open tickets (prioritized)
- Assigned to me
- Waiting for user
- Recently resolved
- SLA breach warnings

**Filters:**
- Status
- Priority
- Category
- Assigned to
- Date range

**Ticket Detail View:**
- User info panel (email, support key, subscription)
- Full conversation
- Internal notes (not visible to user)
- Quick actions: Assign, Change Priority, Change Status
- User lookup button
- Request context data

**Acceptance Criteria:**
- [ ] Tickets load performantly
- [ ] Real-time updates when new tickets arrive
- [ ] SLA timer shows time remaining
- [ ] Can assign tickets to team members
- [ ] Internal notes clearly marked
- [ ] Quick reply templates available
- [ ] No emojis in interface

**Dependencies:** B3

---

#### D2: Admin Support Session Access
**File:** `src/components/admin/SupportSessionAccess.tsx`

**Interface for using support tokens:**

```
┌─────────────────────────────────────────┐
│  Access User Data                       │
├─────────────────────────────────────────┤
│                                         │
│  Support Token:                         │
│  ┌───────────────────────────────────┐ │
│  │ [Enter token...]                  │ │
│  └───────────────────────────────────┘ │
│                                         │
│  [Access Data]                          │
└─────────────────────────────────────────┘
```

**After successful access:**
- Shows user's encrypted data
- Decryption key provided (if books_access)
- Access tracked and logged
- Timer showing expiration

**Acceptance Criteria:**
- [ ] Invalid tokens show clear error
- [ ] Expired tokens rejected
- [ ] Revoked tokens rejected
- [ ] Access logged with admin email
- [ ] Decryption instructions shown
- [ ] Cannot access twice (increment only)
- [ ] No emojis in interface

**Dependencies:** B3

---

#### D3: Admin Support Metrics Dashboard
**File:** `src/pages/admin/SupportMetrics.tsx`

**Metrics displayed:**
- Total tickets (today, week, month)
- Average response time
- SLA compliance percentage
- Tickets by category (pie chart)
- Tickets by priority (bar chart)
- Resolution time distribution
- Active support sessions

**Acceptance Criteria:**
- [ ] Metrics update in real-time
- [ ] Charts render correctly
- [ ] Can filter by date range
- [ ] Export to CSV available
- [ ] Drill-down into categories
- [ ] No emojis in interface

**Dependencies:** B3

---

### Phase 5: Email Notifications (Group E)
**Parallel Execution:** All tasks can run in parallel

#### E1: Email Templates
**File:** `audacious_money_backend/src/services/email.service.ts` (add to existing)

**New email templates:**

**1. Support Ticket Created (to user):**
- Ticket number
- Subject and description echo
- 24-48 hour response promise
- Link to view ticket
- Support team is human-staffed

**2. Support Ticket Reply (to user when admin responds):**
- Admin's message
- Link to reply
- Ticket status

**3. Support Ticket Resolved (to user):**
- Resolution summary
- Satisfaction survey link
- Ticket marked resolved

**4. New Support Ticket (to founder/support team):**
- User info (name, email, support key)
- Ticket category and priority
- Description
- Link to admin dashboard

**5. Critical Issue Alert (to founder):**
- Immediate notification for critical priority
- User details
- Issue description
- Direct link to ticket

**Acceptance Criteria:**
- [ ] All emails use royal purple (#4b006e)
- [ ] Steadiness communication tone
- [ ] Mobile responsive HTML
- [ ] Plain text fallback
- [ ] Unsubscribe link (except critical alerts)
- [ ] Reply-to: hello@audacious.money
- [ ] 24-48 hour timeframe stated clearly
- [ ] Emphasize human support (not AI)

**Dependencies:** None

---

#### E2: Email Service Integration
**File:** `audacious_money_backend/src/routes/support-tickets.ts` (update)

**Send emails at these trigger points:**
- Ticket created → User confirmation + Founder notification
- Admin replies → User notification
- Ticket resolved → User confirmation
- Critical priority → Immediate founder alert

**Acceptance Criteria:**
- [ ] Emails sent within 30 seconds of trigger
- [ ] Email delivery tracked
- [ ] Failed emails logged for retry
- [ ] Rate limiting on user emails (max 10/hour)

**Dependencies:** E1, B2

---

### Phase 6: Security & Testing (Group F)
**Sequential Execution:** F1 → F2 → F3

#### F1: Security Hardening

**Tasks:**
1. Audit all support endpoints for authorization
2. Ensure session tokens are cryptographically secure
3. Validate no PII leaks in logs
4. Implement rate limiting on all endpoints
5. Add CSRF protection on POST endpoints
6. Sanitize all user input (XSS prevention)
7. Encrypt attachments at rest in R2/S3
8. Audit trail for all support access

**Acceptance Criteria:**
- [ ] All endpoints require proper authentication
- [ ] Session tokens pass security audit
- [ ] No sensitive data in application logs
- [ ] Rate limits prevent abuse
- [ ] XSS attacks blocked by sanitization
- [ ] File uploads validated for type and size
- [ ] All support access logged

**Dependencies:** All B group tasks

---

#### F2: Unit & Integration Tests

**Backend Tests:**
- `support.routes.test.ts` - User support endpoints
- `support-tickets.routes.test.ts` - Ticket management
- `admin/support.routes.test.ts` - Admin endpoints
- `supportToken.test.ts` - Token generation/validation

**Frontend Tests:**
- `ContactSupportModal.test.tsx` - Ticket creation flow
- `GrantAccessModal.test.tsx` - Access grant flow
- `MySessions.test.tsx` - Session management
- `MyTickets.test.tsx` - Ticket viewing

**Target Coverage:** Greater than 85%

**Acceptance Criteria:**
- [ ] All endpoints have test coverage
- [ ] Happy path tests pass
- [ ] Error cases handled
- [ ] Edge cases tested
- [ ] Integration tests for full flows

**Dependencies:** F1

---

#### F3: End-to-End Testing

**Test Scenarios:**
1. User creates ticket → Receives email confirmation
2. User grants admin_only access → Admin uses token
3. User grants books_access → Admin decrypts data
4. User revokes access → Admin token rejected
5. Support session expires → Cannot be used
6. Admin assigns ticket → User receives email
7. Admin resolves ticket → User receives confirmation

**Tools:** Playwright

**Acceptance Criteria:**
- [ ] All critical paths have E2E tests
- [ ] Tests run in CI/CD pipeline
- [ ] Screenshots captured on failure
- [ ] Test data cleanup after runs

**Dependencies:** F2

---

### Phase 7: Deployment & Monitoring (Group G)
**Sequential Execution:** G1 → G2 → G3

#### G1: Database Migration

**Tasks:**
1. Review migration script
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
- [ ] Rollback script ready if needed

**Dependencies:** F3 (all testing complete)

---

#### G2: Feature Flags & Gradual Rollout

**File:** `src/config/featureFlags.ts` (update)

```typescript
export const FEATURE_FLAGS = {
  SUPPORT_CONTACT: false, // Start disabled
  SUPPORT_FILE_UPLOADS: false,
  SUPPORT_ACCESS_GRANTS: false,
};
```

**Rollout Plan:**
1. Enable for internal team only
2. Enable for 10% of beta users
3. Enable for 50% of beta users
4. Enable for 100% of users

**Acceptance Criteria:**
- [ ] Feature flags control visibility
- [ ] Can enable/disable without deployment
- [ ] Gradual rollout percentages work
- [ ] Metrics tracked per cohort

**Dependencies:** G1

---

#### G3: Monitoring & Alerts

**Metrics to Track:**
- Support ticket creation rate
- Average response time
- SLA compliance percentage (24-48 hours)
- Support session grants per day
- Failed support token uses
- Email delivery success rate

**Alerts to Configure:**
- SLA breach (response greater than 48 hours)
- Critical ticket created
- Support session grant rate spike
- Email delivery failures
- Database connection issues

**Tools:** Grafana + Prometheus (already spec'd)

**Acceptance Criteria:**
- [ ] All metrics visible in dashboard
- [ ] Alerts configured with correct thresholds
- [ ] On-call rotation notified
- [ ] Alert fatigue minimized

**Dependencies:** G2

---

## Success Metrics

### Launch Criteria (All must be met)

- [ ] All acceptance criteria in Phases 1-7 complete
- [ ] Security audit passed
- [ ] Greater than 85% test coverage
- [ ] Zero critical bugs
- [ ] Documentation complete
- [ ] Team trained on support workflow
- [ ] Rollback plan tested

### Post-Launch Metrics

- **Response Time:** Less than 48 hours (target: 95% of tickets)
- **Resolution Time:** Less than 5 days average
- **User Satisfaction:** Greater than 4.0/5.0 rating
- **Support Load:** Less than 20 tickets/day (manageable volume)
- **Session Grant Rate:** Track for abuse patterns

---

## Dependencies Graph

```
Phase 1 (Foundation)
├── A1 (Database) ────────┬──────────────┐
├── A2 (Types)            │              │
└── A3 (Utilities)        │              │
                          ↓              ↓
Phase 2 (Backend)         │              │
├── B1 (Sessions) ←───────┘              │
├── B2 (Tickets) ←───────────────────────┘
└── B3 (Admin) ←─────────────────────────┘
                          ↓
Phase 3 (User UI)         │
├── C1 (Menu Item)        │
├── C2 (Contact Modal) ←──┤
├── C3 (Grant Access) ←───┤
├── C4 (Sessions Page) ←──┤
└── C5 (Tickets Page) ←───┘
                          ↓
Phase 4 (Admin UI)        │
├── D1 (Ticket Queue) ←───┤
├── D2 (Session Access) ←─┤
└── D3 (Metrics) ←────────┘
                          ↓
Phase 5 (Email)           │
├── E1 (Templates)        │
└── E2 (Integration) ←────┘
                          ↓
Phase 6 (Security)        │
├── F1 (Hardening) ←──────┘
├── F2 (Unit Tests) ←─────┘
└── F3 (E2E Tests) ←──────┘
                          ↓
Phase 7 (Deploy)          │
├── G1 (Migration) ←──────┘
├── G2 (Rollout) ←────────┘
└── G3 (Monitoring) ←─────┘
```

---

## Parallel Execution Plan

### Sprint 1
**Parallel Agents:**
- Agent A: Phase 1 (A1, A2, A3) - Foundation
- Agent B: Phase 5 (E1) - Email Templates

### Sprint 2
**Parallel Agents:**
- Agent A: Phase 2 (B1) - User Support Sessions
- Agent B: Phase 2 (B2) - Support Tickets
- Agent C: Phase 2 (B3) - Admin Support

### Sprint 3
**Parallel Agents:**
- Agent A: Phase 3 (C1, C2, C3, C4, C5) - User UI
- Agent B: Phase 4 (D1, D2, D3) - Admin UI
- Agent C: Phase 5 (E2) - Email Integration

### Sprint 4
**Sequential:**
- Agent A: Phase 6 (F1, F2, F3) - Security & Testing

### Sprint 5
**Sequential:**
- Agent A: Phase 7 (G1, G2, G3) - Deployment

---

## Risk Mitigation

### High Risk Items

1. **Master Key Encryption for Support**
   - Risk: Complex cryptography could have vulnerabilities
   - Mitigation: Security audit before launch, gradual rollout
   - Fallback: Start with admin_only access type only

2. **Email Delivery**
   - Risk: Support emails might not reach users
   - Mitigation: Monitor delivery rates, backup notification methods
   - Fallback: In-app notifications if email fails

3. **Support Overload**
   - Risk: Too many tickets, cannot meet SLA
   - Mitigation: Monitor ticket volume, hire support staff if needed
   - Fallback: Extend SLA to 72 hours temporarily

4. **Session Token Security**
   - Risk: Tokens could be intercepted or misused
   - Mitigation: 24-hour expiration, revocable, audit trail
   - Fallback: Disable access grants, support only via description

---

## Documentation Requirements

### For Users
- [ ] Help center article: "How to Contact Support"
- [ ] Help center article: "Granting Support Access"
- [ ] Help center article: "Managing Support Sessions"

### For Support Team
- [ ] Support workflow handbook
- [ ] Using support tokens guide
- [ ] Common issues and responses
- [ ] Escalation procedures
- [ ] SLA compliance tracking

### For Developers
- [ ] API documentation for support endpoints
- [ ] Database schema documentation
- [ ] Architecture decision records
- [ ] Troubleshooting guide

---

## Acceptance Sign-Off

### Phase Completion Checklist

Each phase requires sign-off before proceeding to next:

- [ ] **Phase 1:** Database schema reviewed
- [ ] **Phase 2:** API endpoints tested
- [ ] **Phase 3:** User UI approved
- [ ] **Phase 4:** Admin UI approved
- [ ] **Phase 5:** Email templates approved
- [ ] **Phase 6:** Security audit passed
- [ ] **Phase 7:** Production deployment successful

---

## Key Documents

- REQ-SUPPORT-001 in REQUIREMENTS.md
- Support API spec in ROADMAPS_API.md
- Zero-knowledge architecture in SPEC.md

---

**Last Updated:** 2026-04-25
**Version:** 2.0
**Status:** Ready for Implementation
