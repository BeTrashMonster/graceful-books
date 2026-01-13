# Tasks: Onboarding and Setup (Group C)

## Overview
Group C implements the complete onboarding experience and first transaction capabilities. All 8 tasks can be worked on in parallel once Group B is complete, though some logical sequencing may improve efficiency.

**Prerequisites:** Group B complete (Chart of Accounts CRUD, basic transactions, dashboard, DISC profile storage, message variants, sync client, charity selection, audit log, error handling)

## Task List

### C1. Assessment Engine [MVP]
**What:** Core engine that processes assessment questions and determines user profiles.

**Dependencies:** {B4: DISC Profile Storage, B5: Message Variant System}

**Joy Opportunity:** Progress bar during assessment says "Getting to know you..." with encouraging messages at milestones like "Halfway there! You're doing great."

**Deliverables:**
- Question branching logic implementation
- Answer scoring algorithms
- Phase determination logic (Stabilize/Organize/Build/Grow)
- Financial literacy scoring (Beginner/Developing/Proficient/Advanced)
- Business type categorization (Service/Product/Hybrid)
- Save and resume capability
- Assessment data model and storage

**Technical Notes:**
- Maximum 40 questions total with branching
- Save progress after each section
- Algorithm for phase determination must be documented and tested
- All four phases correctly identified in testing

**Spec Reference:** ONB-001, ONB-002, ONB-003

---

### C2. Assessment UI - Complete Flow [MVP]
**What:** Full onboarding assessment experience with all sections and educational content.

**Dependencies:** {C1: Assessment Engine, A5: UI Component Library, A6: Application Shell & Routing}

**Joy Opportunity:** Completion celebration with confetti moment when assessment finishes. "Welcome to Graceful Books! We've prepared a personalized path just for you."

**Deliverables:**
- All 5 assessment sections:
  1. Business Fundamentals (5-8 questions)
  2. Current Financial State (8-12 questions)
  3. Financial Literacy (10-15 questions)
  4. Business-Type Specific (5-10 questions)
  5. Communication Preferences (DISC assessment)
- Progress indicator component
- Section transitions with validation
- Results summary page
- "What this means" educational explanations
- Conversational, judgment-free language throughout

**Technical Notes:**
- Each section validates before proceeding
- Skip logic reduces questions for clear-path users
- Results page summarizes findings clearly
- Assessment feels quick and focused (<10 minutes average)

**Spec Reference:** ONB-001, ONB-002

---

### C3. Checklist Generation Engine [MVP]
**What:** Generate personalized checklists based on assessment results.

**Dependencies:** {C1: Assessment Engine}

**Joy Opportunity:** Checklists appear as a "personalized path" - "Based on what you told us, here's your roadmap to financial clarity."

**Deliverables:**
- Checklist item templates by phase (Stabilize/Organize/Build/Grow)
- Checklist categories:
  1. Foundation Building (one-time setup)
  2. Weekly Maintenance
  3. Monthly Maintenance
  4. Quarterly Tasks
  5. Annual Tasks
- Dynamic item selection logic
- Business type customization
- Financial literacy depth adjustment
- Checklist storage and retrieval
- Generation completes in <30 seconds

**Technical Notes:**
- All items have clear, actionable descriptions
- Link items to relevant features for one-click access
- Support for custom items added by users
- Progress persists across sessions

**Spec Reference:** CHECK-001

---

### C4. Checklist UI - Interactive [MVP]
**What:** Visual checklist experience with satisfying interactions and progress tracking.

**Dependencies:** {C3: Checklist Generation Engine, A5: UI Components, B3: Dashboard}

**Joy Opportunity:** CONFETTI MOMENT when completing an item (subtle, tasteful). Streak tracking with celebration: "5 weeks in a row! You're building real momentum."

**Deliverables:**
- Visual Elements:
  - Progress bars by category
  - Completion percentages
  - Streak tracking (consecutive weeks completed)
  - Progress graphs over time
  - Milestone celebrations
- Interactivity:
  - Check off interactions (with satisfying animation)
  - Snooze functionality with return date
  - Add custom items
  - Reorder within categories
  - Mark as "not applicable" (with confirmation)
  - Link items to relevant features
- Dashboard integration (preview)
- Optional sound effects (can be toggled off)

**Technical Notes:**
- All interactions feel responsive (<100ms)
- Gamification is encouraging not condescending
- Users can customize their view
- Mobile-responsive design

**Spec Reference:** CHECK-001, CHECK-002

---

### C5. Phase-Based Feature Visibility [MVP]
**What:** Show/hide features based on user's current phase to prevent overwhelm.

**Dependencies:** {C1: Assessment Engine, A6: Application Shell & Routing}

**Joy Opportunity:** When features unlock: "New feature unlocked! You're ready for [feature name]." Make it feel like leveling up, not like something was hidden.

**Deliverables:**
- Feature visibility rules by phase:
  - Stabilize: Dashboard, basic transactions, receipt capture, basic categorization
  - Organize: + Chart of accounts (full), reconciliation, basic invoicing, basic reports
  - Build: + Advanced invoicing, bill management, classes/categories, custom reports
  - Grow: + Multi-currency, advanced inventory, forecasting, team collaboration
- UI adaptation engine
- Feature unlock notifications
- "Show all features" setting in preferences
- Locked feature tooltips ("This feature becomes available as you grow. Curious? Peek ahead!")
- Dimmed/visible but locked feature styling

**Technical Notes:**
- Core accounting features accessible regardless of phase
- Progressive disclosure doesn't block critical functions
- Manual phase override available (with confirmation)
- Feature visibility updates in real-time when phase changes

**Spec Reference:** PFD-001, PFD-002

---

### C6. Client/Customer Management - Basic [MVP]
**What:** Create and manage customer records for invoicing.

**Dependencies:** {A1: Database Schema, A3: Local-First Data Store, B1: Chart of Accounts CRUD}

**Joy Opportunity:** "Your first customer! Every business started with one." Customer count milestone celebrations: "10 customers! Your client base is growing."

**Deliverables:**
- Customer data model (name, contact info, billing address, email, phone)
- Customer creation form
- Customer editing
- Customer list view
- Search and filter capabilities
- Notes field for customer-specific information
- Active/inactive status
- Customer deletion (with confirmation and dependency checking)
- Link to invoices and transactions

**Technical Notes:**
- Encrypted storage of customer data
- Validation for email format and required fields
- Search indexes for performance
- Export customer list capability

**Spec Reference:** ACCT-002 (Client Management section)

---

### C7. Invoice Creation - Basic [MVP]
**What:** Create and send simple invoices to customers.

**Dependencies:** {C6: Client/Customer Management, B1: Chart of Accounts, B2: Transaction Entry}

**Joy Opportunity:** After sending first invoice: "Your first invoice is on its way! (How professional of you.)" Invoice preview shows "This is what [Customer Name] will see" to build confidence.

**Deliverables:**
- Invoice creation form with:
  - Customer selection
  - Invoice date and due date
  - Payment terms (Net 15, 30, 60, custom)
  - Line items (description, quantity, rate, amount)
  - Subtotal, tax (optional), total
  - Notes/memo field
- 3-5 basic professional templates
- Invoice preview (matches PDF exactly)
- PDF generation
- Send via email
- Invoice status tracking:
  - Draft (not sent)
  - Sent (emailed to customer)
  - Viewed (customer opened)
  - Paid (payment recorded)
  - Overdue (past due date)
- Invoice list view with filtering by status
- Invoice number auto-generation (customizable prefix)
- Link invoice to transaction when paid

**Technical Notes:**
- PDF generation must be reliable and fast (<2 seconds)
- Email sending with retry logic
- Invoice preview matches PDF output exactly
- Status updates reflected in real-time
- Double-entry accounting when invoice is created and paid

**Spec Reference:** ACCT-002 (Invoicing Features section)

---

### C8. Receipt Capture - Basic (Nice)
**What:** Upload and store receipt images linked to transactions.

**Dependencies:** {A1: Database Schema, A3: Local-First Data Store, B2: Transaction Entry}

**Joy Opportunity:** "Receipt saved! That's one less piece of paper to worry about." When a receipt is matched to a transaction: "Perfect match! Receipt and transaction are now best friends."

**Deliverables:**
- Image upload interface (drag-drop and file select)
- Camera capture on mobile devices
- Receipt storage (encrypted)
- Link receipt to transaction (one-to-many: multiple receipts per transaction)
- Receipt gallery view
- Thumbnail generation
- Receipt metadata:
  - Upload date
  - File size
  - Image dimensions
  - Linked transaction reference
- Image viewer (full-size preview)
- Delete receipt (with confirmation)

**Technical Notes:**
- Support common image formats (JPEG, PNG, PDF)
- Image compression for storage efficiency
- Encrypted blob storage
- Max file size limit (e.g., 10MB per image)
- Lazy loading in gallery view for performance
- Future-ready for OCR integration (Group G)

**Spec Reference:** ACCT-003 (Expense Tracking - Receipt Capture section)

---

## Implementation Notes

### Recommended Sequencing
While all tasks can be done in parallel, this logical sequence may be efficient:

**Phase 1 (Foundation):**
1. C1: Assessment Engine
2. C3: Checklist Generation Engine
3. C6: Client/Customer Management

**Phase 2 (User Experience):**
4. C2: Assessment UI
5. C4: Checklist UI
6. C5: Feature Visibility

**Phase 3 (Transactions):**
7. C7: Invoice Creation
8. C8: Receipt Capture

### Testing Requirements
- All assessment phases correctly identified (test with diverse user profiles)
- Checklist generation completes in <30 seconds
- Feature visibility rules enforce correctly for each phase
- Invoice PDF matches preview exactly
- Receipt upload handles large files gracefully
- All UIs are accessible (WCAG 2.1 AA)

### Integration Points
- Assessment results stored in user profile (use DISC profile infrastructure from B4)
- Checklist preview appears on dashboard (integrate with B3)
- Message variants adapt to DISC profile (use B5 message system)
- Invoices create transactions (use B2 transaction entry)
- Feature visibility integrates with navigation (A6 routing)

### Success Criteria
- Assessment completion rate >85%
- Average assessment time <10 minutes
- Checklist engagement (weekly) >60%
- First invoice sent within 7 days >40%
- Receipt captured within 7 days >30%
- User reports "feeling welcomed and understood" in feedback
