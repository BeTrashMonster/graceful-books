# Roadmaps - Flags & Contradictions

> Issues found between README.md and current architecture decisions

## Overview

While creating the backend roadmaps, several contradictions were found between the existing `README.md` documentation and the new multi-product architecture we discussed. This document compiles all flags for review and resolution.

---

## 🚩 Critical Contradictions (Require Updates)

### 1. Project Name

**README.md says:** "Graceful Books"
```markdown
# Graceful Books

An educational accounting platform for entrepreneurs who are numbers-adverse.
```

**Current Reality:** "Audacious Money"
- Marketing site is at audacious.money
- Branding is "Audacious Money"
- User discussed this as the umbrella brand

**Recommendation:**
- [ ] Update README.md title to "Audacious Money"
- [ ] Update all references from "Graceful Books" to "Audacious Money"
- [ ] Clarify: "Graceful Books" may have been the original name, but "Audacious Money" is the current brand

**Impact:** Documentation accuracy, branding consistency

---

### 2. Pricing Structure

**README.md says:**
```markdown
## Pricing

- $40/month ($5 goes to a charity of your choice)
- 14-day free trial
```

**Current Reality:** Multiple products with different pricing
- Budgeting: $10/month ($5 to charity, $5 revenue)
- Debt Management: $20/month ($5 to charity, $15 revenue)
- Service Provider Management: $30/month
- CPG: $30/month
- CPU: $5/product, max $50/month
- Bookkeeping Suite: $40/month (includes all except CFO)
- Fractional CFO: $60/month (includes everything + CFO features)

**Recommendation:**
- [ ] Update README pricing section to reflect multi-product structure
- [ ] Add table of all products with pricing
- [ ] Clarify that $40/month was for the full Bookkeeping Suite specifically

**Impact:** User expectations, sales clarity, documentation accuracy

---

### 3. Business Phases (User Journey)

**README.md says:**
```markdown
## Business Phases

Users are guided through four phases based on their assessment:

1. **Stabilize** - Separate accounts, catch up on records
2. **Organize** - Consistent processes, proper categorization
3. **Build** - Advanced features, reporting, forecasting
4. **Grow** - Multi-entity, analytics, team collaboration
```

**Current Reality:** Multi-product ecosystem
- Users can buy individual products (Budgeting, CPG, etc.)
- Products are NOT necessarily phase-based
- User might buy CPG without going through Stabilize/Organize phases

**Question:**
- Do these phases still apply to the multi-product model?
- Or are phases only for Bookkeeping Suite users?
- Should README be updated to reflect product-based approach?

**Recommendation:**
- [ ] Clarify if business phases apply to all products or just Bookkeeping Suite
- [ ] Update README to explain multi-product approach
- [ ] Consider: Phases might be internal framework, not user-facing

**Impact:** Product strategy, user onboarding flow, feature disclosure

---

### 4. Deployment Strategy

**README.md says:**
```bash
# Deployment
npm run deploy:staging      # Deploy to staging (requires VERCEL_TOKEN)
npm run deploy:production   # Deploy to production (requires VERCEL_TOKEN)
```

**Current Reality:** Different deployment targets
- **Frontend (React):** Cloudflare Pages (NOT Vercel)
- **Backend (Bun + Hono):** Digital Ocean App Platform
- **Sync Relay:** Digital Ocean App Platform
- **Database:** Digital Ocean Managed PostgreSQL

**Recommendation:**
- [ ] Remove Vercel references from README
- [ ] Update deployment section to reflect:
  - Cloudflare Pages for frontend
  - Digital Ocean for backend/database
- [ ] Update deployment scripts in package.json
- [ ] Reference ROADMAPS_DEPLOYMENT.md for full guide

**Impact:** Developer onboarding, CI/CD setup, deployment confusion

---

## ⚠️ Minor Inconsistencies (Should Update)

### 5. Technology Stack - Backend

**README.md says:**
```markdown
## Technology Stack

- **Frontend:** React 18+ with TypeScript
- **Build Tool:** Vite
- **Local Database:** Dexie.js (IndexedDB wrapper)
- **Encryption:** Web Crypto API with argon2-browser for key derivation
```

**Current Reality:** Frontend is correct, but missing backend
- **Backend:** Bun + Hono (TypeScript)
- **Business Database:** PostgreSQL (Digital Ocean Managed)
- **Sync Relay:** Bun + WebSocket

**Recommendation:**
- [ ] Add "Backend" section to Technology Stack in README
- [ ] Clarify frontend vs backend tech separation
- [ ] Mention Digital Ocean as infrastructure provider

**Impact:** Developer understanding, recruitment, technical transparency

---

### 6. Repository Name

**README.md is in:** `graceful_books/` repository

**Current Reality:**
- Marketing site: `audacious_money_marketing/`
- Frontend app: `graceful_books/` (contains React app with CPG, etc.)
- Backend: Will be `audacious_money_backend/` (new, to be created)
- Sync Relay: Will be `audacious_money_sync/` (new, to be created)

**Question:**
- Should `graceful_books` repo be renamed to `audacious_money_frontend` or `audacious_money_app`?
- Or keep as-is since it's established?

**Recommendation:**
- [ ] Document the repository structure clearly
- [ ] Consider renaming `graceful_books` to `audacious_money_app` for consistency
- [ ] OR keep name but update README to clarify it's the frontend for Audacious Money

**Impact:** Repository organization, team clarity

---

### 7. Progressive Feature Disclosure

**README.md says:**
```markdown
### Progressive Feature Disclosure
- All features technically available from day one
- UI shows only features relevant to user's current phase
- Hidden features accessible through intentional exploration
```

**Current Reality:** Product-based access control
- Features determined by which products user purchased
- Not phase-based (unless in Bookkeeping Suite)
- CPG users see CPG features, Budgeting users see Budgeting features

**Recommendation:**
- [ ] Clarify that "phase-based disclosure" applies to Bookkeeping Suite
- [ ] Standalone products show all features for that product
- [ ] Update README to reflect product entitlement model

**Impact:** Feature design, product separation, user expectations

---

## 📋 Documentation Updates Needed

### README.md Updates Checklist

**Section: Project Name**
- [ ] Change "Graceful Books" → "Audacious Money"
- [ ] Update description to reflect multi-product ecosystem

**Section: Overview**
- [ ] Add mention of standalone products
- [ ] Explain Bookkeeping Suite vs. individual products

**Section: Business Phases**
- [ ] Clarify these apply to Bookkeeping Suite
- [ ] OR remove if no longer relevant

**Section: Pricing**
- [ ] Replace single pricing with product table
- [ ] Show all 7 products with individual prices
- [ ] Explain charity donation ($5/product)

**Section: Technology Stack**
- [ ] Add Backend section (Bun + Hono)
- [ ] Add Infrastructure section (Digital Ocean)
- [ ] Keep Frontend section as-is

**Section: Deployment**
- [ ] Remove Vercel references
- [ ] Add Cloudflare Pages + Digital Ocean instructions
- [ ] Reference ROADMAPS_DEPLOYMENT.md

**Section: Architecture Highlights**
- [ ] Add Business Backend API
- [ ] Clarify Sync Relay vs. Business Backend separation
- [ ] Update zero-knowledge explanation (two-key system)

**New Sections to Add**
- [ ] Product Lineup (with all 7 products)
- [ ] Multi-Repository Structure
- [ ] Admin Dashboard (for business ops)

---

## 🔄 Other Files That Need Updates

### CLAUDE.md
- [ ] Update project name
- [ ] Update pricing information
- [ ] Add backend development guidance
- [ ] Reference new roadmaps

### SPEC.md
- [ ] Review product structure (if it still assumes single product)
- [ ] Update pricing
- [ ] Add multi-product user flows

### ROADMAP.md
- [ ] Add backend development roadmap
- [ ] Add sync relay development
- [ ] Add admin dashboard development
- [ ] Integrate with new roadmaps in Roadmaps/ folder

---

## 🎯 Recommendations Summary

### High Priority (Do First)
1. Update README.md project name and pricing
2. Create backend repositories (audacious_money_backend, audacious_money_sync)
3. Update deployment documentation
4. Clarify product vs. phase-based approach

### Medium Priority
5. Update CLAUDE.md and SPEC.md
6. Consider renaming graceful_books repo
7. Document repository structure

### Low Priority
8. Archive old/outdated docs
9. Create CONTRIBUTING.md for new contributors
10. Add backend-specific documentation to each repo

---

## ✅ What's Already Correct

**Good news - these are aligned:**
- React 18 + TypeScript frontend ✅
- Vite build tool ✅
- Dexie.js for local storage ✅
- Zero-knowledge encryption concept ✅
- 14-day trial (per product) ✅
- Charity giving concept ✅
- Local-first architecture ✅

---

## 💬 Questions for User

Before making these updates, please confirm:

1. **Project Name:** Is "Audacious Money" the final name, or is there a chance it changes back to "Graceful Books"?

2. **Phases:** Do the 4 business phases (Stabilize/Organize/Build/Grow) still apply? If so, to which products?

3. **Repository Naming:** Should we rename `graceful_books` to `audacious_money_app` or keep it as-is?

4. **Documentation Priority:** Which docs should be updated first? (README, CLAUDE.md, SPEC.md?)

5. **Legacy Compatibility:** Are there any external references to "Graceful Books" we need to maintain for backwards compatibility?

---

## 📝 Next Steps

Once user confirms answers to questions above:

1. Update README.md with approved changes
2. Update CLAUDE.md to reflect backend architecture
3. Create placeholder repos for backend & sync relay
4. Update package.json scripts for correct deployment targets
5. Archive or update ROADMAP.md to reference new roadmaps

---

**Created:** 2026-03-20
**Review Status:** Pending user feedback
