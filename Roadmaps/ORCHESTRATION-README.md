# Orchestration System - Audacious Money Backend

**Last Updated:** 2026-03-20

---

## Overview

The orchestration system manages parallel agent deployment for building the **Audacious Money** backend API and sync relay. Agents work through tasks defined in `Roadmap_Tasks.md` following a security-first, dependency-based implementation plan.

---

## Project Structure

### What We're Building

**Audacious Money** is a zero-knowledge financial platform with three components:

1. **Backend API** (`audacious_money_backend/`)
   - Bun + Hono server
   - PostgreSQL database
   - Stripe integration
   - JWT authentication
   - Location: `C:/Users/Admin/audacious_money_backend/`

2. **Sync Relay** (`audacious_money_sync/`)
   - WebSocket server for encrypted data sync
   - Bun runtime
   - Zero-knowledge architecture
   - Location: `C:/Users/Admin/audacious_money_sync/`

3. **Frontend** (`graceful_books/src/`)
   - React + TypeScript (already exists)
   - Will connect to new backend
   - Location: `C:/Users/Admin/graceful_books/src/`

---

## Roadmap Structure

The implementation roadmap is in **`Roadmap_Tasks.md`** with the following phases:

### Phase 0: Foundation & Security Setup
**Objective:** Establish secure development environment and core infrastructure

**Tasks:**
- **0.1** Local Development Environment *(requires human setup)*
- **0.2** Database Schema Creation *(✅ COMPLETE - pre-created)*
- **0.3** Database Migration System
- **0.4** Backend Project Setup (Bun + Hono)
- **0.5** JWT Authentication Middleware
- **0.6** Input Validation System (Zod) *(✅ COMPLETE - pre-created)*

### Phase 1: Authentication & User Management
**Objective:** Implement secure two-key authentication system

**Tasks:**
- **1.1** User Signup Endpoint
- **1.2** User Login Endpoint
- **1.3** Password Reset Flow
- **1.4** Email Verification

### Phase 2: Product & Subscription Management
**Objective:** Implement secure product entitlements and trial system

**Tasks:**
- **2.1** Product Catalog Endpoint
- **2.2** User Product Entitlements Endpoint
- **2.3** Charity Selection Endpoints

### Phase 3: Stripe Payment Integration
**Objective:** Implement secure payment processing with Stripe

**Tasks:**
- **3.1** Stripe Configuration & Products
- **3.2** Checkout Session Creation
- **3.3** Stripe Webhook Handler
- **3.4** Subscription Cancellation

### Phase 4: Admin Dashboard Backend
**Objective:** Secure admin operations with role-based access control

**Tasks:**
- **4.1** Admin Authentication
- **4.2** Admin Authorization Middleware
- **4.3** Admin User Management Endpoints
- **4.4** Admin Analytics Endpoints

### Phase 5: Frontend Deployment
**Objective:** Deploy React app to Cloudflare Pages

**Tasks:**
- **5.1** Production Build Configuration
- **5.2** Cloudflare Pages Deployment

### Phase 6: Backend Deployment
**Objective:** Deploy backend to Digital Ocean

**Tasks:**
- **6.1** Digital Ocean Database Setup
- **6.2** Digital Ocean App Platform Deployment
- **6.3** Stripe Webhook Configuration

---

## Agent Orchestration Methods

### Method 1: Direct Parallel Agent Spawning (Recommended)

Launch multiple agents simultaneously using Claude Code's built-in Task tool:

```typescript
// Launch 3 agents in parallel for Phase 0
Task(Task 0.3: Database Migration System)
Task(Task 0.4: Backend Project Setup)
Task(Task 0.5: JWT Authentication Middleware)
```

**Advantages:**
- ✅ No external scripts needed
- ✅ Built into Claude Code
- ✅ Real-time monitoring
- ✅ Automatic context preservation
- ✅ Easy to pause/resume

**Usage:**
```
User: "Launch agents in parallel for Phase 0 tasks 0.3, 0.4, and 0.5"
Claude: [Spawns 3 Task tool calls in single message]
```

### Method 2: External Orchestration Scripts (Legacy)

Use bash scripts for automated scheduled orchestration:

**Available Scripts:**
- `orchestrator.sh` - Main orchestrator (requires Claude Code CLI)
- `orchestrator-sim.sh` - Simulation mode (for testing)
- `scheduler.sh` - Scheduled execution
- `run-scheduled-orchestration.sh` - Unified launcher

**Limitation:** These scripts are designed for the old Graceful Books ROADMAP.md format and would need updating to work with Roadmap_Tasks.md.

---

## Pre-Agent Setup (COMPLETED ✅)

Before agents start, the following files were created to eliminate ambiguity:

### Files Created:
1. ✅ **Database Schema** (`audacious_money_backend/src/db/schema.sql`)
   - All 17 tables
   - 6 products seeded with correct pricing
   - Indexes, functions, views, constraints

2. ✅ **Validation Schemas** (`audacious_money_backend/src/utils/validation.ts`)
   - All Zod schemas for API endpoints
   - Validation middleware

3. ✅ **API Response Format** (`audacious_money_backend/src/utils/responses.ts`)
   - Standardized success/error responses
   - Error codes and messages

4. ✅ **Admin Permissions** (`audacious_money_backend/src/config/permissions.ts`)
   - 25 permissions defined
   - 4 roles configured (super_admin, admin, support, finance)

5. ✅ **Email Templates** (`audacious_money_backend/src/emails/templates.ts`)
   - 5 beautiful templates
   - Editable via admin dashboard

6. ✅ **Environment Variables**
   - `.env.example` for backend, sync relay, and frontend
   - All variables documented

**Reference:** See `PRE_AGENT_SETUP_COMPLETE.md` for full details.

---

## Agent Requirements

### Before Starting Implementation

All agents MUST:

1. **Read Required Files:**
   - `Roadmaps/PRE_AGENT_SETUP_COMPLETE.md` - Setup summary
   - `Roadmaps/agent_review_checklist.md` - Quality standards
   - `Roadmaps/Roadmap_Tasks.md` - Task details
   - Section "🎯 Required Standards for All API Endpoints" in Roadmap_Tasks.md

2. **Use Pre-Created Files:**
   - ✅ Import validation schemas from `validation.ts`
   - ✅ Use response helpers from `responses.ts`
   - ✅ Reference database schema from `schema.sql`
   - ✅ Use permissions from `permissions.ts`

3. **Follow Security Standards:**
   - ✅ IDOR prevention on ALL queries
   - ✅ Input validation on ALL endpoints
   - ✅ Standardized error responses
   - ✅ Audit logging for sensitive operations

---

## Dependency Order

Tasks must be completed in dependency order:

### Phase 0 Dependencies:
```
0.1 (human setup)
  └─→ 0.2 (✅ done)
        └─→ 0.3
  └─→ 0.4
        └─→ 0.5
        └─→ 0.6 (✅ done)
```

**Can run in parallel:**
- 0.3, 0.4 (both depend only on 0.1)
- 0.5 depends on 0.4 completing

### Phase 1 Dependencies:
```
0.5, 0.6 (✅ done)
  └─→ 1.1
        └─→ 1.2
              └─→ 1.3
        └─→ 1.4
```

**Can run in parallel:**
- 1.1, 1.2, 1.3, 1.4 all depend on Phase 0 but are independent of each other

---

## Launching Parallel Agents

### Example: Phase 0

**Human Task First:**
Task 0.1 requires you to:
- Install Bun runtime
- Install PostgreSQL 15
- Install Stripe CLI
- Generate JWT secret

**Then Launch Agents:**
```
Launch 2 agents in parallel:
- Agent A: Task 0.3 (Database Migration System)
- Agent B: Task 0.4 (Backend Project Setup)

After Agent B completes:
- Agent C: Task 0.5 (JWT Authentication Middleware)
```

### Example: Phase 1

After Phase 0 is complete:
```
Launch 4 agents in parallel:
- Agent A: Task 1.1 (User Signup Endpoint)
- Agent B: Task 1.2 (User Login Endpoint)
- Agent C: Task 1.3 (Password Reset Flow)
- Agent D: Task 1.4 (Email Verification)
```

---

## Monitoring Progress

### Check Task Status

**In Roadmap_Tasks.md:**
- `- [ ]` Unchecked checkbox = Not started
- `- [x]` Checked checkbox = Complete

**Security Checkpoints:**
Each task has security checkpoints that must be verified before marking complete.

### Agent Output

Each agent returns:
- Summary of work completed
- Files created/modified
- Security checkpoints verified
- Any blockers or issues

---

## Important Limitations

### Running from Within Claude Code

When you are already in a Claude Code session (like now), you **cannot** use external orchestration scripts (`orchestrator.sh`) because:
- Scripts launch new Claude Code processes
- Can't launch Claude Code from within Claude Code

**Solution:** Use **Method 1: Direct Parallel Agent Spawning** with the Task tool.

### External Scripts Use Case

The external orchestration scripts would be useful if:
- Running from a regular terminal (not Claude Code)
- Claude Code CLI is installed
- Fully automated scheduled execution needed

But they would need updating to work with Roadmap_Tasks.md instead of the old ROADMAP.md.

---

## Testing Roadmap Progression

### Phase 0 Completion Criteria:
- [x] Task 0.1: Local environment set up (human)
- [x] Task 0.2: Database schema created (✅ pre-created)
- [ ] Task 0.3: Migration system implemented
- [ ] Task 0.4: Backend project initialized
- [ ] Task 0.5: JWT middleware implemented
- [x] Task 0.6: Validation system created (✅ pre-created)

**Phase 0 Ready When:**
All checkboxes checked + all security checkpoints verified

### Phase 1 Readiness:
Phase 1 can only start after Phase 0 is complete.

---

## Expected Behavior

### With Parallel Agents:

**Starting Point:**
```
Phase 0: 2/6 complete (0.2, 0.6 pre-created)
Phase 1: 0/4 complete
```

**After launching 2 agents in parallel:**
```
Agent A working on: Task 0.3 (Database Migration System)
Agent B working on: Task 0.4 (Backend Project Setup)
```

**After both complete:**
```
Phase 0: 4/6 complete
Agent C can start: Task 0.5 (JWT Authentication Middleware)
```

**After all Phase 0 completes:**
```
Phase 0: 6/6 complete ✅
Ready to launch 4 agents for Phase 1
```

---

## Files Generated

### By Agents:
- Implementation files (routes, middleware, services)
- Test files
- Documentation updates
- Git commits with Co-Authored-By

### Pre-Created (Don't Modify):
- `schema.sql` - Database schema
- `validation.ts` - Validation schemas
- `responses.ts` - Response helpers
- `permissions.ts` - RBAC permissions
- `templates.ts` - Email templates
- `.env.example` files

---

## Next Steps

1. ✅ Read this README
2. ✅ Review `PRE_AGENT_SETUP_COMPLETE.md`
3. ✅ Review `agent_review_checklist.md`
4. ⏳ Complete Task 0.1 (human setup: install Bun, PostgreSQL, Stripe CLI)
5. 🚀 Launch parallel agents for Phase 0 tasks
6. 👀 Monitor agent progress
7. ✅ Verify security checkpoints
8. 🚀 Launch parallel agents for Phase 1 after Phase 0 completes
9. 🔁 Repeat for each phase

---

## Quick Reference

### Launch Agents in Parallel (Method 1):
```
User: "Launch agents in parallel for tasks 0.3, 0.4, and 0.5"
Claude: [Creates 3 Task tool calls in single message]
```

### Check Progress:
```bash
# View Roadmap_Tasks.md
code Roadmaps/Roadmap_Tasks.md

# Check completed tasks (look for [x])
grep "\[x\]" Roadmaps/Roadmap_Tasks.md
```

### Pre-Created Files Location:
```
audacious_money_backend/
├── src/
│   ├── db/
│   │   └── schema.sql           ✅ Use this
│   ├── utils/
│   │   ├── validation.ts        ✅ Import from here
│   │   └── responses.ts         ✅ Import from here
│   ├── config/
│   │   └── permissions.ts       ✅ Import from here
│   └── emails/
│       └── templates.ts         ✅ Import from here
└── .env.example                 ✅ Copy to .env
```

---

## Differences from Old System

### Old System (Graceful Books):
- Roadmap: `ROADMAP.md`
- Structure: Groups A, B, C, D, E
- Project: React frontend only
- Scripts: `orchestrator.sh`, `scheduler.sh`

### New System (Audacious Money):
- Roadmap: `Roadmap_Tasks.md`
- Structure: Phases 0, 1, 2, 3, 4, 5, 6
- Project: Backend API + Sync Relay + Frontend integration
- Method: Direct parallel agent spawning with Task tool
- Pre-Setup: Foundational files pre-created to eliminate ambiguity

---

*This orchestration system ensures systematic, secure, parallel development of the Audacious Money platform.*
