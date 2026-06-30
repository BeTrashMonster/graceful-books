# Educational Workshop System - Agent Implementation Guide

**Version:** 1.0
**Created:** 2026-06-08
**Project:** Audacious Money (Monorepo)
**Status:** Active Development Guide

---

## 🎯 Purpose

This guide ensures all agents working on the Educational Workshop System understand:
1. **The ACTUAL codebase architecture** (not reference documents)
2. **Which parts of the system you're modifying** (frontend vs backend)
3. **Existing patterns to follow** (real code, not assumptions)
4. **How your work integrates** with the existing platform

**READ THIS FIRST. REFERENCE FREQUENTLY. PREVENT TUNNEL VISION.**

---

## 📐 Project Architecture (THE REAL THING)

### Monorepo Structure

```
graceful_books/                           ← YOU ARE HERE (root)
├── src/                                  ← FRONTEND (React + TypeScript)
│   ├── pages/                           ← Page components
│   │   ├── admin/                       ← Admin dashboard pages (EXISTING)
│   │   ├── auth/                        ← Auth pages (login, signup)
│   │   └── ...
│   ├── components/                      ← Reusable components
│   │   ├── admin/                       ← Admin components (EXISTING)
│   │   ├── forms/                       ← Form components
│   │   └── ...
│   ├── services/                        ← Frontend API services
│   │   ├── api.ts                       ← API client utilities
│   │   ├── auth.api.ts                  ← Auth API calls
│   │   └── ...
│   ├── hooks/                           ← React hooks
│   ├── contexts/                        ← React contexts
│   ├── utils/                           ← Frontend utilities
│   ├── types/                           ← TypeScript types
│   └── App.tsx                          ← Main app component
│
├── audacious_money_backend/             ← BACKEND (Node + Hono + PostgreSQL)
│   ├── src/
│   │   ├── routes/                      ← API route handlers
│   │   │   ├── admin.ts                 ← Admin endpoints (EXISTING)
│   │   │   ├── auth.ts                  ← Auth endpoints (EXISTING)
│   │   │   ├── users.ts                 ← User endpoints (EXISTING)
│   │   │   ├── webhooks.ts              ← Stripe webhooks (EXISTING)
│   │   │   └── charities.ts             ← Charity endpoints (EXISTING)
│   │   ├── middleware/                  ← Middleware (auth, security, etc.)
│   │   ├── services/                    ← Business logic services
│   │   ├── db/
│   │   │   ├── migrations/              ← Database migrations (EXISTING)
│   │   │   │   └── 001-014_*.sql        ← 14 migrations already exist
│   │   │   ├── connection.ts            ← Database connection
│   │   │   └── migrate.ts               ← Migration runner
│   │   ├── utils/                       ← Backend utilities
│   │   ├── types/                       ← TypeScript types
│   │   ├── config/                      ← Configuration
│   │   ├── emails/                      ← Email templates
│   │   ├── app.ts                       ← App setup (EXISTING)
│   │   └── index.ts                     ← Entry point
│   └── package.json                     ← Backend dependencies
│
├── package.json                         ← Frontend dependencies
├── vite.config.ts                       ← Vite configuration
└── tsconfig.json                        ← TypeScript configuration
```

### Technology Stack (VERIFIED FROM ACTUAL CODE)

**Frontend:**
- React 18.3.1
- TypeScript (strict mode)
- Vite 6.4.1 (build tool)
- React Router 6.22.0
- Stripe React (`@stripe/react-stripe-js`)
- NO Dexie/IndexedDB for workshop features (backend-driven)
- Path aliases configured (`@/*`, `@components/*`, etc.)

**Backend:**
- Node.js with `tsx` (NOT Bun)
- Hono 4.0.0 (web framework)
- PostgreSQL (via `pg` library)
- Stripe 20.4.1
- Postmark 4.0.7 (email service)
- Zod 3.22.4 (validation)
- Existing migrations: 001-014 (15th will be workshops)

**Development Commands:**
- Frontend: `npm run dev` (runs on port 3006 currently)
- Backend: `cd audacious_money_backend && npm run dev`
- Migrations: `cd audacious_money_backend && npm run migrate:up`

---

## 🗺️ Workshop Roadmap Phase Mapping

### Where Each Phase Touches the Codebase

| Phase | Location | Type | What You're Building |
|-------|----------|------|---------------------|
| **Phase 1** | `audacious_money_backend/src/db/migrations/` | Database | Migration 015: workshops tables |
| **Phase 1** | `audacious_money_backend/src/types/` | Backend | TypeScript types for workshops |
| **Phase 1** | `audacious_money_backend/src/utils/` | Backend | Workshop access utilities |
| **Phase 2** | `audacious_money_backend/src/routes/` | Backend | API endpoints (CRUD, enrollment) |
| **Phase 2** | `audacious_money_backend/src/middleware/` | Backend | Workshop access middleware |
| **Phase 3** | `src/pages/admin/workshops/` | Frontend | Admin UI (NEW directory) |
| **Phase 3** | `src/components/admin/workshops/` | Frontend | Rich text editor (NEW directory) |
| **Phase 4** | `src/pages/` | Frontend | Workshop signup/countdown pages |
| **Phase 4** | `src/App.tsx` | Frontend | Route integration |
| **Phase 5** | `audacious_money_backend/src/services/email/` | Backend | Email templates & scheduler |
| **Phase 6** | `audacious_money_backend/src/services/` | Backend | Trial management services |
| **Phase 7** | All locations | Both | Security hardening & tests |
| **Phase 8** | Deployment | Both | Database migration & rollout |

---

## 🔧 Existing Patterns YOU MUST FOLLOW

### Backend Patterns (audacious_money_backend/)

#### 1. Route File Structure (REQUIRED)

**Example from existing `routes/admin.ts`:**
```typescript
/**
 * Admin routes
 *
 * Handles admin authentication and admin-only endpoints
 */

import { Hono } from 'hono';
import type { HonoEnv } from '../types/hono.js';
import { validate } from '../utils/validation.js';
import { requireAdmin } from '../middleware/auth.js';
import {
  success,
  badRequest,
  unauthorized,
  notFound,
  ErrorCodes,
  ErrorMessages,
} from '../utils/responses.js';

const admin = new Hono<HonoEnv>();

/**
 * POST /admin/login
 *
 * Admin login endpoint
 */
admin.post('/login', validate(loginSchema), async (c) => {
  // Implementation
});

export default admin;
```

**YOU MUST:**
- Use `.js` extensions in imports (NOT `.ts`)
- Import `HonoEnv` type for Hono context
- Use `validate()` middleware for input validation
- Use response helpers from `utils/responses.js`
- Export default Hono instance
- Add JSDoc comments for each route

#### 2. Database Migration Pattern (REQUIRED)

**Existing migrations in `db/migrations/`:**
- Numbered sequentially: `001_`, `002_`, etc.
- Next workshop migration: `015_educational_workshops.sql`

**Pattern:**
```sql
-- Migration: 015_educational_workshops
-- Description: Add tables for educational workshop system
-- Author: Claude Sonnet 4.5
-- Date: 2026-06-08

-- Workshops table
CREATE TABLE workshops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- columns here
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_workshops_slug ON workshops(slug);

-- Comments
COMMENT ON TABLE workshops IS 'Educational workshop cohorts with configurable settings';
```

#### 3. Validation Schema Pattern (REQUIRED)

**Location:** Add to `src/utils/validation.ts` OR create `src/utils/validation-workshops.ts`

**Pattern (from existing code):**
```typescript
import { z } from 'zod';

export const createWorkshopSchema = z.object({
  cohortName: z.string().min(3).max(255),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  // ... more fields
});

export const enrollInWorkshopSchema = z.object({
  workshopSlug: z.string(),
});
```

#### 4. Response Pattern (REQUIRED)

**Always use helpers from `utils/responses.js`:**
```typescript
import { success, badRequest, notFound, unauthorized } from '../utils/responses.js';

// Success
return success(c, { workshop: workshopData });

// Error
return badRequest(c, 'Invalid workshop slug format');

// Not found
return notFound(c, 'Workshop not found');
```

**DO NOT create custom response objects!**

#### 5. Email Service Pattern (REQUIRED)

**Existing email service:** Postmark integration already exists

**Check:** `audacious_money_backend/src/services/` for email patterns

**YOU MUST:**
- Use Postmark for sending emails
- Store templates in database (existing pattern for admin-editable templates)
- Use UTF-8 encoding for emojis
- Generate both HTML and plain text versions

### Frontend Patterns (src/)

#### 1. Page Component Pattern (REQUIRED)

**Example from existing `src/pages/Dashboard.tsx`:**
```typescript
import React from 'react';
import styles from './Dashboard.module.css'; // CSS Modules
import { Button } from '../components/core/Button';

export default function Dashboard() {
  // Component logic

  return (
    <div className={styles.container}>
      {/* JSX */}
    </div>
  );
}
```

**YOU MUST:**
- Use default export for page components
- Use CSS Modules (`.module.css`)
- Import components from existing component library
- Follow React 18 patterns (hooks, functional components)

#### 2. Admin Page Pattern (REQUIRED)

**Existing admin pages in:** `src/pages/admin/`

**Pattern:**
- Pages: `src/pages/admin/workshops/WorkshopList.tsx`
- Styles: `src/pages/admin/workshops/WorkshopList.module.css`

**YOU MUST:**
- Check existing admin layout patterns
- Reuse admin components from `src/components/admin/`
- Follow existing navigation structure

#### 3. API Service Pattern (REQUIRED)

**Existing pattern in `src/services/api.ts`:**
```typescript
import { API_BASE_URL } from '../config/constants';

export async function createWorkshop(data: CreateWorkshopRequest) {
  const response = await fetch(`${API_BASE_URL}/admin/workshops`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`, // Get from auth service
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to create workshop');
  }

  return response.json();
}
```

**YOU MUST:**
- Use existing API client patterns
- Check `src/services/auth.api.ts` for auth patterns
- Use `API_BASE_URL` from config
- Handle errors consistently

#### 4. Component Library (USE EXISTING)

**Located in:** `src/components/`

**REUSE THESE (do NOT reinvent):**
- Forms: `src/components/forms/` (Input, Select, Checkbox, etc.)
- Buttons: `src/components/core/Button`
- Modals: `src/components/modals/`
- Admin components: `src/components/admin/`

**Check what exists BEFORE creating new components!**

---

## 🚨 CRITICAL: What NOT to Do

### DON'T Assume - VERIFY

❌ **DON'T assume** file locations exist
✅ **DO check** `ls -la path/to/dir` before importing

❌ **DON'T assume** patterns from reference docs
✅ **DO read** existing code files to see real patterns

❌ **DON'T create** custom response/error handling
✅ **DO use** existing `utils/responses.js`

❌ **DON'T use** different validation library
✅ **DO use** Zod (existing dependency)

❌ **DON'T create** new database connection logic
✅ **DO use** existing `db/connection.ts`

❌ **DON'T use** Bun-specific features
✅ **DO remember** backend runs on Node with tsx

❌ **DON'T create** new component patterns
✅ **DO follow** existing component structure

### Common Pitfalls

**Pitfall 1: Import Extensions**
```typescript
// ❌ WRONG (TypeScript extension)
import { validateWorkshop } from './utils/validation.ts';

// ✅ CORRECT (JavaScript extension for Hono)
import { validateWorkshop } from './utils/validation.js';
```

**Pitfall 2: Path Aliases**
```typescript
// ❌ WRONG (backend doesn't use aliases)
import { success } from '@/utils/responses';

// ✅ CORRECT (relative imports in backend)
import { success } from '../utils/responses.js';

// ✅ CORRECT (frontend CAN use aliases)
import { Button } from '@components/core/Button';
```

**Pitfall 3: Database Client**
```typescript
// ❌ WRONG (assuming Dexie/IndexedDB)
const db = useLiveQuery(() => db.workshops.toArray());

// ✅ CORRECT (backend uses PostgreSQL via pg)
const result = await db.query('SELECT * FROM workshops');
```

---

## 📋 Pre-Flight Checklist for Each Task

Before starting ANY task, verify:

### Phase 1-2 (Backend Tasks)
- [ ] I've read an existing route file to see the pattern
- [ ] I've checked existing migrations to see numbering
- [ ] I've verified backend uses Node (NOT Bun)
- [ ] I've confirmed imports use `.js` extensions
- [ ] I've located existing utilities I'll reuse

### Phase 3-4 (Frontend Tasks)
- [ ] I've checked existing admin pages for patterns
- [ ] I've located existing components I can reuse
- [ ] I've verified path aliases in `tsconfig.json`
- [ ] I've seen how existing pages make API calls
- [ ] I've confirmed styling approach (CSS Modules)

### Phase 5-6 (Email & Services)
- [ ] I've checked existing email service implementation
- [ ] I've verified Postmark is the email provider
- [ ] I've seen how cron/scheduled jobs are handled
- [ ] I've located existing service patterns

### All Phases
- [ ] I've run `ls -la` to confirm directories exist
- [ ] I've read actual code (not just docs)
- [ ] I've identified dependencies already installed
- [ ] I've checked if similar functionality exists

---

## 🔍 How to Explore the Codebase

### Finding Patterns

**To understand route patterns:**
```bash
cat audacious_money_backend/src/routes/admin.ts | head -100
```

**To see existing migrations:**
```bash
ls -la audacious_money_backend/src/db/migrations/
cat audacious_money_backend/src/db/migrations/011_charity_management_system.sql | head -50
```

**To check existing admin pages:**
```bash
ls -la src/pages/admin/
cat src/pages/admin/AdminDashboard.tsx | head -50
```

**To see API patterns:**
```bash
ls -la src/services/
cat src/services/api.ts | head -50
```

**To verify dependencies:**
```bash
cat package.json | grep "dependencies" -A 20
cat audacious_money_backend/package.json | grep "dependencies" -A 20
```

### Understanding Data Flow

**Workshop Enrollment Flow:**
1. **User visits** → `src/pages/WorkshopSignup.tsx` (frontend)
2. **Submits form** → Calls `src/services/workshop.api.ts`
3. **API call** → `POST /workshops/:slug/enroll` (backend)
4. **Route handler** → `audacious_money_backend/src/routes/workshops.ts`
5. **Database write** → PostgreSQL via `pg`
6. **Email trigger** → `audacious_money_backend/src/services/email/workshopEmails.ts`

**Admin Creates Workshop:**
1. **Admin visits** → `src/pages/admin/workshops/WorkshopForm.tsx`
2. **Fills form** → Rich text editor for emails
3. **Submits** → `POST /admin/workshops` (backend)
4. **Validation** → Zod schema
5. **Database write** → PostgreSQL
6. **Response** → Admin sees workshop in list

---

## 📝 File Verification Protocol

### Before Claiming Task Complete

**YOU MUST verify every file you create:**

```bash
# Verify file exists
ls -la /absolute/path/to/file.ts

# Show line count
wc -l /absolute/path/to/file.ts

# Show first 10 lines
head -10 /absolute/path/to/file.ts

# Show last 10 lines (to verify no TODOs left)
tail -10 /absolute/path/to/file.ts
```

**YOU MUST verify imports work:**

```bash
# If you imported from another file, verify it exists
ls -la audacious_money_backend/src/utils/validation.js

# Check that exported function actually exists in the file
grep "export.*createWorkshopSchema" audacious_money_backend/src/utils/validation.ts
```

**See `AGENT_COMPLETION_PROTOCOL.md` for full verification requirements.**

---

## 🎨 Design & UX Requirements

### Communication Tone (Steadiness)

All user-facing text MUST be:
- **Patient**: "Take your time with this"
- **Clear**: Step-by-step instructions
- **Supportive**: "We're here to help"
- **Non-judgmental**: Never blame users

**Examples:**
```typescript
// ❌ BAD
error: "Invalid input"

// ✅ GOOD
error: "That doesn't look quite right. Please check your entry and try again."

// ❌ BAD
message: "Saved"

// ✅ GOOD
message: "All saved! Your changes are safe and sound."
```

### Accessibility (WCAG 2.1 AA)

**Every component MUST:**
- Support keyboard navigation
- Have visible focus states
- Include ARIA labels where needed
- Meet 4.5:1 contrast ratio for text
- Have 44x44px touch targets

**Use existing accessible components!** Don't reinvent.

---

## 🔐 Security Requirements

### Authentication

**Backend routes require auth:**
```typescript
// Admin routes
import { requireAdmin } from '../middleware/auth.js';
admin.use('*', requireAdmin);

// User routes
import { requireAuth } from '../middleware/auth.js';
users.use('*', requireAuth);
```

**Frontend auth check:**
- Use existing auth context/service
- Check `src/services/auth.service.ts` for patterns

### Input Validation

**ALWAYS validate on backend:**
```typescript
import { validate } from '../utils/validation.js';
import { createWorkshopSchema } from '../utils/validation-workshops.js';

workshop.post('/', validate(createWorkshopSchema), async (c) => {
  const data = c.get('validatedData');
  // Data is now validated
});
```

### XSS Prevention

**For rich text email editor:**
- Use DOMPurify for HTML sanitization
- Allow ONLY safe HTML tags
- Sanitize on backend (never trust frontend)

### SQL Injection Prevention

**ALWAYS use parameterized queries:**
```typescript
// ✅ CORRECT
const result = await db.query(
  'SELECT * FROM workshops WHERE slug = $1',
  [slug]
);

// ❌ WRONG
const result = await db.query(
  `SELECT * FROM workshops WHERE slug = '${slug}'`
);
```

---

## 🧪 Testing Requirements

### What to Test

**Backend:**
- Unit tests for utilities
- Route handler tests
- Validation schema tests
- Email template rendering

**Frontend:**
- Component rendering tests
- User interaction tests
- API call mocking
- Form validation

**Integration:**
- Full enrollment flow
- Email sending
- Trial expiration
- Access control

### Test File Location

**Co-locate with source:**
```
audacious_money_backend/src/routes/
├── workshops.ts
└── workshops.test.ts

src/pages/admin/workshops/
├── WorkshopForm.tsx
└── WorkshopForm.test.tsx
```

### Running Tests

```bash
# Frontend tests
npm test

# Backend tests
cd audacious_money_backend && npm test

# Specific test file
npm test WorkshopForm.test.tsx
```

---

## 📦 Dependencies

### Adding New Dependencies

**Before adding ANY dependency:**
1. Check if similar functionality exists
2. Verify it's not already installed
3. Consider bundle size impact
4. Check license compatibility

**To add frontend dependency:**
```bash
npm install package-name
```

**To add backend dependency:**
```bash
cd audacious_money_backend && npm install package-name
```

### Recommended Libraries

**Rich Text Editor (Phase 3):**
- `quill` (already used in project for similar features)
- `react-quill` (React wrapper)
- `emoji-mart` (emoji picker)
- `dompurify` (HTML sanitization)

**These align with existing patterns!**

---

## 🚀 Development Workflow

### Starting Development

```bash
# 1. Start frontend dev server
npm run dev
# Runs on http://localhost:3006

# 2. In another terminal, start backend
cd audacious_money_backend
npm run dev
# Runs on http://localhost:3001 (check .env for PORT)
```

### Making Changes

**Backend Changes:**
1. Edit code in `audacious_money_backend/src/`
2. Backend auto-reloads with `tsx watch`
3. Test endpoint with curl or Postman
4. Write tests
5. Verify with `npm test`

**Frontend Changes:**
1. Edit code in `src/`
2. Vite hot-reloads automatically
3. Check browser at localhost:3006
4. Write tests
5. Verify with `npm test`

**Database Changes:**
1. Create migration file: `015_educational_workshops.sql`
2. Run migration: `npm run migrate:up`
3. Verify in PostgreSQL
4. Update types to match schema

### Git Workflow

**Commit after each completed subtask:**
```bash
git add .
git commit -m "$(cat <<'EOF'
feat: Add workshop enrollment endpoints

- POST /workshops/:slug/enroll
- GET /workshops/my-enrollment
- Validation with Zod schemas
- Email notification on enrollment

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## 🎯 Phase-Specific Guidance

### Phase 1: Foundation & Database

**Your Focus:** Database tables and utilities

**Key Files to Create:**
- `audacious_money_backend/src/db/migrations/015_educational_workshops.sql`
- `audacious_money_backend/src/types/workshop.types.ts`
- `audacious_money_backend/src/utils/workshopAccess.ts`

**Existing Patterns to Study:**
- `audacious_money_backend/src/db/migrations/011_charity_management_system.sql` (complex multi-table migration)
- `audacious_money_backend/src/types/hono.ts` (type patterns)

**Success Criteria:**
- Migration runs without errors: `npm run migrate:up`
- Can rollback: `npm run migrate:down`
- Types compile: `tsc --noEmit`

### Phase 2: Backend API Routes

**Your Focus:** API endpoints for workshops and enrollment

**Key Files to Create:**
- `audacious_money_backend/src/routes/workshops.ts`
- `audacious_money_backend/src/routes/admin/workshops.ts`
- `audacious_money_backend/src/middleware/workshopAccess.ts`
- `audacious_money_backend/src/utils/validation-workshops.ts`

**Existing Patterns to Study:**
- `audacious_money_backend/src/routes/admin.ts` (admin route pattern)
- `audacious_money_backend/src/routes/users.ts` (user route pattern)
- `audacious_money_backend/src/middleware/auth.ts` (auth middleware pattern)

**Success Criteria:**
- Routes registered in `app.ts`
- Endpoints testable with curl
- Validation works (test with invalid data)
- Returns consistent response format

### Phase 3: Admin Dashboard UI

**Your Focus:** Admin pages for managing workshops

**Key Files to Create:**
- `src/pages/admin/workshops/WorkshopList.tsx`
- `src/pages/admin/workshops/WorkshopForm.tsx`
- `src/pages/admin/workshops/WorkshopEnrollments.tsx`
- `src/components/admin/workshops/RichTextEmailEditor.tsx`
- Corresponding `.module.css` files

**Existing Patterns to Study:**
- `src/pages/admin/` (admin page structure)
- `src/components/admin/` (admin component patterns)
- `src/services/admin/` (admin API service patterns)

**Success Criteria:**
- Pages accessible at correct routes
- Forms submit successfully
- Data displays from API
- Rich text editor works
- Mobile responsive

### Phase 4: Workshop Signup Flow

**Your Focus:** User-facing workshop pages

**Key Files to Create:**
- `src/pages/WorkshopSignup.tsx`
- `src/pages/WorkshopThankYou.tsx`
- `src/pages/WorkshopCountdown.tsx`
- Update `src/App.tsx` for routing

**Existing Patterns to Study:**
- `src/pages/auth/` (signup flow patterns)
- `src/App.tsx` (routing patterns)
- `src/pages/checkout/` (multi-step flow patterns)

**Success Criteria:**
- Signup flow works end-to-end
- Countdown timer accurate
- Redirects work correctly
- Same login page for all users

### Phase 5: Email Automation

**Your Focus:** Email templates and scheduling

**Key Files to Create:**
- `audacious_money_backend/src/services/email/workshopEmails.ts`
- `audacious_money_backend/src/services/email/htmlEmailRenderer.ts`
- `audacious_money_backend/src/services/email/workshopEmailScheduler.ts`

**Existing Patterns to Study:**
- `audacious_money_backend/src/emails/` (existing email patterns)
- Check for Postmark integration code

**Success Criteria:**
- Test email sends successfully
- HTML renders correctly in Gmail/Outlook
- Template tags replaced with real data
- Emojis display correctly
- Cron job pattern established

### Phase 6: Trial Management

**Your Focus:** Trial start/end logic

**Key Files to Create:**
- `audacious_money_backend/src/services/trialManagement.ts`
- `audacious_money_backend/src/services/trialExpiration.ts`
- `src/components/subscription/WorkshopUpgrade.tsx`

**Existing Patterns to Study:**
- `audacious_money_backend/src/routes/users.ts` (subscription logic)
- Stripe integration patterns

**Success Criteria:**
- Trial starts at correct time
- Trial expires correctly
- Upgrade flow works
- Stripe integration functions

---

## 💡 Pro Tips

### Avoid Wasted Work

**Before writing ANY code:**
1. Read 2-3 similar existing files
2. Identify the patterns they follow
3. Copy their structure
4. Adapt for your specific use case

**Example:** Before creating `workshops.ts` route, read `users.ts` and `charities.ts` to see the pattern, then adapt.

### When Stuck

**If something doesn't work:**
1. Check if the file you're importing actually exists
2. Verify the export name matches what you're importing
3. Confirm you're in the right directory (frontend vs backend)
4. Read error messages carefully (import path? missing dependency?)

**If unsure about a pattern:**
1. Search for similar code: `grep -r "pattern" src/`
2. Read existing implementations
3. Ask for clarification rather than guessing

### Communication

**Report progress clearly:**
```markdown
### Completed: Phase 2, Task B1 - Workshop CRUD Endpoints

**Files Created:**
- audacious_money_backend/src/routes/admin/workshops.ts (247 lines)
- audacious_money_backend/src/utils/validation-workshops.ts (89 lines)

**Verification:**
$ ls -la audacious_money_backend/src/routes/admin/workshops.ts
-rw-r--r-- 1 user group 8234 Jun 08 14:32 workshops.ts

$ curl -X POST http://localhost:3001/admin/workshops -H "Authorization: Bearer $TOKEN" -d '{"cohortName":"Test"}'
{"success":true,"data":{"id":"..."}}

**Tests Added:**
✅ 12 tests passing

**Next:** Ready for Phase 2, Task B2
```

---

## ✅ Final Checklist Before Claiming "Done"

- [ ] All files I claimed to create actually exist (verified with `ls -la`)
- [ ] All imports reference files that exist (verified)
- [ ] Code compiles without TypeScript errors
- [ ] Tests written and passing (or explicitly noted why not)
- [ ] Followed existing patterns (not invented new ones)
- [ ] Used existing utilities/components (not reinvented)
- [ ] Proper error handling with existing error utilities
- [ ] User-facing text uses Steadiness tone
- [ ] Security best practices followed
- [ ] Git commit includes "Co-Authored-By: Claude Sonnet 4.5"
- [ ] Verification commands included in completion report

---

## 📚 Quick Reference

### Key Files to Know

**Backend:**
- `audacious_money_backend/src/app.ts` - Main app setup
- `audacious_money_backend/src/routes/` - All route handlers
- `audacious_money_backend/src/middleware/auth.js` - Auth middleware
- `audacious_money_backend/src/utils/responses.js` - Response helpers
- `audacious_money_backend/src/utils/validation.ts` - Zod schemas
- `audacious_money_backend/src/db/connection.ts` - Database client

**Frontend:**
- `src/App.tsx` - Main app with routing
- `src/services/api.ts` - API client utilities
- `src/components/` - Reusable components
- `src/pages/admin/` - Admin dashboard pages
- `vite.config.ts` - Build configuration
- `tsconfig.json` - TypeScript configuration

### Command Cheat Sheet

```bash
# Frontend
npm run dev                    # Start dev server (port 3006)
npm test                       # Run tests
npm run build                  # Build for production
npm run lint                   # Check code quality

# Backend
cd audacious_money_backend
npm run dev                    # Start dev server (auto-reload)
npm run migrate:up             # Run migrations
npm run migrate:status         # Check migration status
npm test                       # Run tests

# Verification
ls -la path/to/file           # File exists?
wc -l path/to/file            # Line count
head -10 path/to/file         # First 10 lines
grep "pattern" path/to/file   # Search in file
```

---

**Remember:** This is a REAL, WORKING codebase with EXISTING patterns. Your job is to EXTEND it, not reinvent it. When in doubt, LOOK at existing code and FOLLOW the pattern.

**Good luck! You've got this. 🚀**

---

*Last Updated: 2026-06-08*
*For: Educational Workshop System Implementation*
*Roadmap: EDUCATIONAL_WORKSHOP_SYSTEM_ROADMAP.md*
