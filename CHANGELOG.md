# Changelog

All notable changes to the Graceful Books Product Requirements Specification will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Full requirements specification aligned with requirements-reviewer.md rubric
- 26 main sections + 3 appendices covering all aspects of product development
- 36+ formal requirements with unique IDs and acceptance criteria
- 165+ acceptance criteria across all features
- Zero-knowledge encryption architecture with detailed specifications
- Progressive feature disclosure system (Stabilize, Organize, Build, Grow phases)
- Comprehensive user stories in INVEST format
- Detailed training and documentation requirements

## [2.0.0] - 2026-01-09

### Added - Batch 6: Governance & Continuous Improvement
- **Section 25**: Stakeholder Responsibilities
  - 8 key stakeholder roles defined (Product Owner, Tech Lead, Security, UX/UI, QA, DevOps, Legal, Support)
  - Responsibilities, decision authority, and deliverables documented
  - Escalation path established
- **Section 26**: Change Management Process
  - 4 change types defined (Minor, Moderate, Major, Critical)
  - Change request process (Submit → Triage → Decision → Implement → Document)
  - Change Control Board established for major changes
- **Appendix A**: Glossary Expansion
  - 25+ terms with plain English and technical definitions
  - Examples and related terms added for context
  - Accounting, technical, compliance, and financial terms covered

### Added - Batch 5: Professional Polish
- **Section 23**: Design Considerations
  - Information architecture with navigation hierarchy and URL structure
  - User flows (onboarding, invoicing, reconciliation) with ASCII diagrams
  - UI design principles (progressive disclosure, judgment-free language, accessibility)
  - Branding & style guidelines ([TBD] markers for designer decisions)
  - Responsive design requirements (mobile, tablet, desktop)
  - WCAG 2.1 AA accessibility compliance (CRITICAL requirement)
- **Section 1**: Introduction Expansion
  - Document audience (primary, secondary, tertiary) with reading strategies
  - Out of scope (v1.0 exclusions) to prevent scope creep
  - References & related documents (internal and external standards)
- **Appendix B**: Formal User Stories
  - 7 user stories in INVEST format (US-001 through US-007)
  - Coverage across all phases (Stabilize, Organize, Build, Grow)
  - Each story includes persona, journey, acceptance criteria, requirements mapping
  - INVEST validation and recommendations for missing requirements
- **Appendix C**: Architecture Diagrams
  - System architecture overview (ASCII diagram)
  - Placeholders for detailed diagrams (encryption, auth, CRDT, deployment)
  - References to existing specification sections for details
- **Section 24**: Training & Documentation
  - User training strategy with in-app onboarding (<15 min)
  - Video tutorial library (15+ videos, 3-8 min each)
  - Written help center (5 main categories)
  - Administrator training for multi-user features
  - Content maintenance process

### Added - Batch 4: Operational Readiness
- **Section 21**: Legal & Compliance
  - GDPR compliance (7 user rights documented)
  - CCPA compliance (California resident rights)
  - Data retention policies ([TBD] markers for legal counsel)
  - Privacy Policy template (11 sections)
  - Terms of Service template (15 sections)
  - Cookie Policy with consent banner example
  - Data Processing Agreement template for enterprise
- **Section 22**: Maintenance & Support
  - Support channels (knowledge base, email, in-app, live chat, phone)
  - SLA tiers (Free: 99.0%, Premium: 99.5%, Enterprise: 99.9%)
  - Priority levels (P1-P4) with response/resolution times
  - Maintenance schedule (patch, minor, major releases, emergency hotfixes)
  - Routine tasks (daily, weekly, monthly, quarterly, annual)
  - Proactive support with user health scores

### Added - Batch 3: Quality & Operations
- **Section 18**: Testing & Quality Assurance
  - Test pyramid (Unit > Integration > E2E)
  - Coverage targets (>85% overall, 100% cryptographic code)
  - Security testing (SAST, penetration testing)
  - Performance testing (load, stress, browser profiling)
  - UAT phases (alpha, closed beta, open beta)
- **Section 19**: Deployment & Release
  - CI/CD pipeline (GitHub Actions recommended)
  - Environments (Development, Staging, Production)
  - Release criteria (tests, security scans, performance benchmarks)
  - Rollback procedures
  - Deployment architecture (CDN → LB → App → DB)
- **Section 20**: Error Handling & Logging
  - Error classification (user, system, integration errors)
  - Error handling patterns with retry strategies
  - Logging levels (debug, info, warn, error, fatal)
  - Log retention policies ([TBD] for DevOps + Legal)
  - Monitoring thresholds and alerting

### Added - Batch 2: Technology Decisions
- **Section 16.4**: Technology Stack Decision Framework
  - Frontend stack (DECIDED: React 18.3+, TypeScript 5.3+, Vite 5.1+, Dexie 4.0+)
  - Backend stack ([DECISION POINT]: Node.js + Fastify [RECOMMENDED], Go + Fiber, Deno + Fresh)
  - CRDT library ([DECISION POINT]: Automerge 2.0+ [RECOMMENDED], Yjs, Custom)
  - API design ([DECISION POINT]: REST + WebSocket [RECOMMENDED], GraphQL, gRPC)
  - Testing frameworks (DECIDED: Vitest, @testing-library/react, Playwright)
  - Decision matrices with evaluation criteria
- **Section 16.4.7**: API Specification
  - REST + WebSocket API design
  - Endpoints (auth, sync, push, pull, live)
  - Rate limiting (per-endpoint limits)
  - API versioning (URL-based /v1/, /v2/)
  - Error response format and codes
  - Request/response examples

### Added - Batch 1: Technical Foundation
- **Section 2.2**: Database Architecture & Schema
  - Dual-database architecture (client IndexedDB + sync relay)
  - 15+ table specifications with encryption strategy
  - Field encryption levels (encrypted, hashed, plaintext)
  - ASCII Entity-Relationship Diagram
  - Data migration strategy (QuickBooks, Xero, CSV import)
- **Section 2.1.5**: Authentication & Authorization (ARCH-006)
  - Zero-knowledge authentication flow
  - Key derivation (Master Key → K_enc + K_auth via HKDF)
  - Server stores hash(K_auth), never sees K_enc
  - Recovery mechanism (24-word BIP39 mnemonic, optional)
  - Session management (JWT 24h, refresh token 30d)
  - RBAC roles (Admin, Manager, Bookkeeper, View-Only) with permission matrix
- **Appendix A**: Glossary Initial Terms
  - CRDT, Argon2id, KDF definitions added

## [1.0.0] - 2026-01-09 (Initial Draft)

### Added
- Initial product requirements specification
- 18 main sections covering:
  - Executive Summary with vision statement
  - System Architecture (zero-knowledge local-first sync)
  - User Onboarding & Assessment (phase-based)
  - Progressive Feature Disclosure (Stabilize → Organize → Build → Grow)
  - Core Accounting Features (chart of accounts, transactions, reconciliation, reporting)
  - Classification & Tagging
  - Checklist & Task Management
  - Notification System
  - Multi-Currency Support (future)
  - Barter/Trade Accounting
  - Financial Visualization (3D money flow)
  - Liability Payment Handling
  - Pricing & Charitable Component
  - Future Considerations
  - Additional Feature Ideas
  - Technical Requirements (partial)
  - Success Metrics
- 36+ functional requirements with unique IDs
- 165+ acceptance criteria
- User personas and narrative journeys (Stabilize, Organize, Build phases)

---

## Version History Summary

- **v1.0.0** (2026-01-09): Initial draft with core feature specifications (78/100 rubric alignment)
- **v2.0.0** (2026-01-09): Full rubric alignment with 6 batches of enhancements (estimated 97-98/100 alignment)
  - Batch 1: Database & Authentication (~1,400 lines)
  - Batch 2: Technology Stack & API (~940 lines)
  - Batch 3: Testing, Deployment, Error Handling (~2,119 lines)
  - Batch 4: Legal & Compliance, Support (~1,300 lines)
  - Batch 5: Design, User Stories, Architecture, Training (~2,262 lines)
  - Batch 6: Stakeholder Responsibilities, Change Management, Glossary (~200 lines)
  - **Total added: ~8,200+ lines**

---

## Notes on Versioning

- **MAJOR** version (x.0.0): Breaking changes to requirements, major scope changes
- **MINOR** version (1.x.0): New sections added, significant enhancements
- **PATCH** version (1.0.x): Clarifications, typo fixes, formatting improvements

---

## Decision Log

This section tracks major decisions made during specification development:

| Date | Decision | Rationale | Decided By | Impact |
|------|----------|-----------|------------|--------|
| 2026-01-09 | Frontend stack: React 18.3+, TypeScript 5.3+, Vite 5.1+, Dexie 4.0+ | Already defined in package.json, proven technologies | Tech Lead | Foundation for client-side development |
| 2026-01-09 | Accessibility: WCAG 2.1 AA compliance (CRITICAL) | Legal requirement, moral imperative, broader user base | Product Owner + Legal | All UI design must meet AA standards |
| 2026-01-09 | Use [TBD] markers for stakeholder decisions | Maintains flexibility while documenting decision points | Product Owner | ~40 decisions tracked for stakeholder input |
| 2026-01-09 | ASCII diagrams for architecture | Version control friendly, easy to update | Tech Lead | All diagrams maintainable in Git |
| 2026-01-09 | No timelines in specification | Timelines always wrong, creates false expectations | Product Owner | Focus on scope and quality, not arbitrary dates |
| [Future] | [Additional decisions to be added as made] | | | |

---

## [TBD] - Pending Decisions Requiring Stakeholder Input

The following decisions are documented in the specification with [TBD] markers and require stakeholder input before implementation:

### Technology Decisions
- [ ] Backend runtime selection (Node.js vs Go vs Deno) - **Tech Lead + DevOps Lead**
- [ ] CRDT library selection (Automerge vs Yjs vs Custom) - **Architect (after prototype phase)**
- [ ] API protocol selection (REST+WS vs GraphQL vs gRPC) - **Tech Lead**
- [ ] Performance testing tool (k6 vs Artillery) - **QA Lead**

### Legal/Compliance Decisions
- [ ] GDPR data retention periods - **Legal Counsel**
- [ ] CCPA applicability assessment - **Legal Counsel**
- [ ] Privacy Policy finalization - **Legal Counsel**
- [ ] Terms of Service finalization - **Legal Counsel**

### Operational Decisions
- [ ] SLA response/resolution times for each priority level - **Product Manager + Support Manager**
- [ ] Uptime targets (99.0%, 99.5%, 99.9%) per plan tier - **DevOps Lead**
- [ ] Support channels (email, in-app, live chat, phone) - **Support Manager**
- [ ] On-call rotation structure - **DevOps Lead**
- [ ] Monitoring tool selection (DataDog, Sentry, New Relic, etc.) - **DevOps Lead**

### Deployment Decisions
- [ ] Cloud provider selection (AWS, Azure, GCP, Fly.io) - **DevOps Lead**
- [ ] CI/CD tool (GitHub Actions, GitLab CI, Jenkins) - **DevOps Lead**
- [ ] Rollout strategy (blue-green vs canary deployment) - **DevOps Lead + Product Manager**

### Design Decisions
- [ ] Design tool selection (Figma, Sketch, Adobe XD) - **UX/UI Designer**
- [ ] Color palette (primary, secondary, semantic colors) - **Brand Designer + UX/UI Designer**
- [ ] Typography system (display, body, monospace fonts) - **UX/UI Designer**
- [ ] Icon library (Heroicons, Lucide, Phosphor, custom) - **UX/UI Designer**

### Security Decisions
- [ ] Penetration test vendor selection and scheduling - **Security Architect**
- [ ] Security audit timing (before alpha vs before beta) - **Security Architect**

---

*Last Updated: 2026-01-09*
*Next Review: After P1 gaps resolved and stakeholder decisions made*
