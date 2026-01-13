# Change Proposal: Onboarding and Setup

## Why

Group C represents the completion of the onboarding system and introduction of first transaction capabilities. This change builds upon Group B's foundation (Chart of Accounts, basic transactions, dashboard, DISC profile system, and message variants) to deliver a complete user onboarding experience with personalized assessment, customized checklists, and progressive feature disclosure.

This phase enables users to:
- Complete a comprehensive assessment that determines their business phase and needs
- Receive a personalized checklist tailored to their situation
- Experience phase-appropriate feature visibility that prevents overwhelm
- Start managing clients and creating invoices
- Capture and track receipts

Group C is critical for MVP launch as it transforms the bare-bones accounting infrastructure from Group B into a welcoming, user-friendly experience that adapts to each user's unique situation.

**Dependencies:**
- Group B must be complete (DISC profile storage, message variant system, basic CRUD operations, dashboard, sync client)

## Roadmap Reference

**Phase:** Phase 1: The Foundation
**Group:** Group C - The Walls
**Roadmap Items:** C1-C8 (Assessment Engine, Assessment UI - Complete Flow, Checklist Generation Engine, Checklist UI - Interactive, Phase-Based Feature Visibility, Client/Customer Management - Basic, Invoice Creation - Basic, Receipt Capture - Basic)
**Roadmap Location:** [Roadmaps/ROADMAP.md - Phase 1, Group C](../../Roadmaps/ROADMAP.md#group-c-the-walls)
**Priority:** MVP

## What Changes

This change implements 8 major features organized as Group C in the ROADMAP:

### C1. Assessment Engine
Core engine that processes assessment questions and determines user profiles including phase (Stabilize/Organize/Build/Grow), financial literacy level, and business type categorization.

### C2. Assessment UI - Complete Flow
Full onboarding assessment experience with all 5 sections, progress indicators, section transitions, results summary, and educational explanations.

### C3. Checklist Generation Engine
Dynamic checklist generation based on assessment results, customized by phase, business type, and financial literacy level.

### C4. Checklist UI - Interactive
Visual checklist interface with progress tracking, check-off interactions, snooze functionality, streak tracking, and celebration moments.

### C5. Phase-Based Feature Visibility
Progressive disclosure system that shows/hides features based on user's current phase, with "unlock" notifications and optional "show all features" override.

### C6. Client/Customer Management - Basic
Create and manage customer records with contact information, search/filter capabilities, and notes.

### C7. Invoice Creation - Basic
Simple invoice creation with line items, basic templates, email sending, PDF generation, and status tracking.

### C8. Receipt Capture - Basic
Upload and store receipt images with transaction linking and gallery view.

## Capabilities

### New Capabilities

#### `assessment`
**Purpose:** Onboarding assessment engine and user interface

**Components:**
- Assessment question engine with branching logic
- Phase determination algorithm (Stabilize/Organize/Build/Grow)
- Financial literacy scoring (Beginner/Developing/Proficient/Advanced)
- Business type categorization (Service/Product/Hybrid)
- Save and resume functionality
- Complete 5-section assessment UI with progress tracking
- Results summary and educational explanations

**Dependencies:**
- `disc-profile` (from Group B) - for storing DISC communication preferences
- `message-variants` (from Group B) - for adapted messaging

#### `checklist`
**Purpose:** Personalized checklist generation and interactive UI

**Components:**
- Checklist generation engine based on assessment results
- Dynamic item selection by phase, business type, and literacy level
- Interactive checklist UI with check-off, snooze, and custom items
- Progress tracking by category
- Streak tracking (consecutive weeks completed)
- Milestone celebrations
- Link checklist items to relevant features

**Dependencies:**
- `assessment` - provides user profile data for personalization
- `dashboard` (from Group B) - displays checklist preview

#### `feature-visibility`
**Purpose:** Phase-based progressive feature disclosure

**Components:**
- Feature visibility rules by phase
- UI adaptation engine based on current phase
- Feature unlock notification system
- "Show all features" override setting
- Educational tooltips for locked features

**Dependencies:**
- `assessment` - provides phase determination
- `routing` (from Group A) - integrates with navigation system

#### `client-management`
**Purpose:** Basic client/customer management

**Components:**
- Customer creation and editing
- Contact information storage
- Customer list view with search and filter
- Notes and attachments
- Customer record CRUD operations

**Dependencies:**
- `data-store` (from Group A) - local storage
- `encryption` (from Group A) - data encryption
- `ui-components` (from Group A) - forms and lists

#### `invoicing`
**Purpose:** Basic invoice creation and management

**Components:**
- Invoice creation form with line items
- 3-5 basic templates
- Invoice preview
- Email sending
- PDF generation
- Invoice status tracking (Draft/Sent/Viewed/Paid/Overdue)
- Link to customer records

**Dependencies:**
- `client-management` - customer data
- `chart-of-accounts` (from Group B) - account assignment
- `transactions` (from Group B) - recording invoice transactions

#### `receipt-capture`
**Purpose:** Basic receipt upload and storage

**Components:**
- Image upload (camera/file)
- Receipt storage (encrypted)
- Link receipt to transaction
- Receipt gallery view
- Basic metadata (date uploaded, file size, transaction link)

**Dependencies:**
- `data-store` (from Group A) - file storage
- `encryption` (from Group A) - image encryption
- `transactions` (from Group B) - transaction linking

## Impact

### User Experience
- **First-time users** experience a welcoming, personalized onboarding that adapts to their needs
- **Assessment** feels quick and focused, not overwhelming (max 40 questions with branching)
- **Checklist** provides clear path forward with actionable, phase-appropriate tasks
- **Progressive disclosure** prevents overwhelm by hiding advanced features until needed
- **Celebrations and encouragement** at key milestones build confidence and momentum

### Business Value
- **Enables first transactions:** Users can now manage clients, send invoices, and track receipts
- **Reduces churn:** Personalized onboarding increases engagement and reduces abandonment
- **Scales to all user types:** Same system serves beginners (Stabilize) through advanced users (Grow)
- **Foundation for growth:** Phase system enables natural progression as users advance

### Technical
- **Modular architecture:** Each capability is independently deployable
- **Extensible:** Easy to add new assessment questions, checklist items, or templates
- **Performance:** Assessment and checklist generation complete in <30 seconds
- **Accessibility:** All UI components meet WCAG 2.1 AA standards

### Dependencies Unlocked
Group C completion enables Group D (Welcome Home) features:
- D1: Guided Chart of Accounts Setup (requires C3 checklist, C5 feature visibility)
- D2: First Reconciliation Experience (requires C3 checklist)
- D3: Weekly Email Summary Setup (requires C3 checklist generation)
- D4: Tutorial System Framework (requires C5 feature visibility)

## Success Metrics

- Assessment completion rate >85%
- Average assessment time <10 minutes
- Checklist engagement (weekly interaction) >60%
- Phase-appropriate feature usage >90% (users primarily use features for their phase)
- Invoice creation within first week >40%
- Receipt capture within first week >30%

## Risk & Mitigation

**Risk:** Assessment feels too long or intrusive
**Mitigation:** Branching logic reduces questions, progress indicator shows advancement, save/resume prevents loss

**Risk:** Users confused by hidden features
**Mitigation:** Educational tooltips explain locked features, "peek ahead" capability in settings, clear unlock notifications

**Risk:** Generated checklists don't match user needs
**Mitigation:** Users can customize checklists (add/remove/snooze items), manual phase override available

**Risk:** Invoice/receipt features feel incomplete
**Mitigation:** Clear labeling as "Basic" features, roadmap view shows upcoming enhancements, core functionality is solid
