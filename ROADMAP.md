# Graceful Books Implementation Roadmap

**Your Journey from Foundation to Flight**

---

```
                              THE GRACEFUL BOOKS JOURNEY

                                        * * *
                                       *     *
                                      * STARS *     <- "Reaching for the Stars"
                                       *     *         (Visionary Features)
                                        * * *
                                          |
                                          |
                                    ,~~~~~~~~~~~.
                                   /   WINGS     \   <- "Spreading Your Wings"
                                  /   (Advanced)  \     (Power Features)
                                 '~~~~~~~~~~~~~~~~~'
                                          |
                                          |
                                   .~~~~~~~~~~~~.
                                  /   RHYTHM     \   <- "Finding Your Rhythm"
                                 /  (Daily Use)   \     (Core Workflows)
                                '~~~~~~~~~~~~~~~~~~'
                                          |
                                          |
                                  .~~~~~~~~~~~~~~.
                                 /  FIRST STEPS   \  <- "First Steps"
                                /   (Onboarding)   \    (Welcome & Setup)
                               '~~~~~~~~~~~~~~~~~~~~'
                                          |
                                          |
                              .~~~~~~~~~~~~~~~~~~~~~.
                             /      FOUNDATION       \ <- "The Foundation"
                            /   (Infrastructure)      \    (Build it Solid)
                           '~~~~~~~~~~~~~~~~~~~~~~~~~~~'
                                        |||
                                     ___|||___
                                    |  START  |
                                    |  HERE!  |
                                    -----------

   Legend:  [MVP] = Must have for launch    [JOY] = Delight opportunity
            (Nice) = Enhancement            {Dep} = Dependency marker
```

---

## How to Read This Roadmap

This roadmap is designed for **agent-based development systems** and human developers alike.

**Group Structure:**
- **Group A** items can all be worked on simultaneously
- **Group B** items require Group A to be complete, but items within Group B can be done in parallel
- **Group C** requires Group B, and so on...

**Within each group**, items are ordered from:
1. Quickest wins / highest value (top)
2. Most complex / lower immediate value (bottom)

**Every item includes:**
- What it is
- What must exist first
- How it can bring joy to users
- Which spec requirement it fulfills

---

# Phase 1: The Foundation

*"Every great building starts with solid ground. Let's make yours unshakeable."*

## Group A - The Bedrock (All Parallel)

### A1. Database Schema & Core Data Models [MVP]
**What:** Design and implement the foundational data structures for all accounting entities.

**Dependencies:** None - this is where we begin!

**Joy Opportunity:** Name the database "TreasureChest" internally. When devs work on it, they're "organizing the treasure."

**Includes:**
- Accounts (Chart of Accounts structure)
- Transactions (journal entries, line items)
- Contacts (customers, vendors)
- Products/Services catalog
- User profiles and preferences
- Audit log structure

**Spec Reference:** ACCT-001, ACCT-011

---

### A2. Encryption Layer Foundation [MVP]
**What:** Implement the zero-knowledge encryption architecture that keeps user data private.

**Dependencies:** None

**Joy Opportunity:** When encryption is active, show a tiny shield icon with a sparkle animation. Users should feel *protected*, not paranoid.

**Delight Detail:** The key generation screen could say "Creating your secret handshake with your data..."

**Includes:**
- AES-256 encryption for data at rest
- Argon2id key derivation from passphrase
- Encryption/decryption utilities
- Secure key storage patterns

**Spec Reference:** ARCH-001, ARCH-002

---

### A3. Local-First Data Store [MVP]
**What:** Implement the local database that allows the app to work offline and own its data.

**Dependencies:** None (can start with A1, A2)

**Joy Opportunity:** When working offline, show a cozy "cabin mode" indicator: "You're working offline. Your data is safe and sound, right here with you."

**Includes:**
- IndexedDB or SQLite wrapper
- CRUD operations for all entities
- Transaction batching
- Offline queue management

**Spec Reference:** ARCH-003

---

### A4. Authentication & Session Management [MVP]
**What:** User authentication that works with zero-knowledge architecture.

**Dependencies:** None (coordinate with A2)

**Joy Opportunity:** Login success message: "Welcome back! Your books missed you."

**Delight Detail:** After 5 successful logins, show a small "Regular visitor!" badge.

**Includes:**
- Passphrase-based authentication
- Session token management
- Remember device functionality
- Logout and session cleanup

**Spec Reference:** ARCH-002

---

### A5. UI Component Library - Core [MVP]
**What:** Build the foundational UI components with accessibility baked in.

**Dependencies:** None

**Joy Opportunity:** Design components with subtle micro-animations. A button press should feel *satisfying*. Checkboxes should have a tiny bounce when checked.

**Delight Detail:** The primary action button color is named "Confident Coral" or "Brave Blue" in the design system.

**Includes:**
- Buttons, inputs, selects, checkboxes
- Cards and containers
- Navigation components
- Modal and drawer systems
- Form validation displays
- WCAG 2.1 AA compliance from day one

**Spec Reference:** TECH-003

---

### A6. Application Shell & Routing [MVP]
**What:** The main application container, navigation, and page routing.

**Dependencies:** None (coordinate with A5)

**Joy Opportunity:** Page transitions should feel like turning pages in a friendly notebook, not clinical screen changes.

**Includes:**
- Main layout structure
- Navigation sidebar
- Route definitions
- Page loading states
- Error boundary handling

**Spec Reference:** TECH-002

---

## Group B - The Frame (Requires Group A)

### B1. Chart of Accounts - Basic CRUD [MVP]
**What:** Create, read, update, and manage accounts.

**Dependencies:** {A1, A3, A5, A6}

**Joy Opportunity:** When creating their first account, celebrate: "Your first account! This is where the magic of organization begins."

**Delight Detail:** Pre-built templates have friendly names like "The Freelancer's Friend" or "Shopkeeper's Starter Kit."

**Includes:**
- Account creation wizard
- Account list view
- Account editing
- Active/inactive toggling
- Plain English descriptions for every account type

**Spec Reference:** ACCT-001

---

### B2. Transaction Entry - Basic [MVP]
**What:** Enter income and expenses with proper double-entry accounting (hidden complexity).

**Dependencies:** {A1, A3, B1}

**Joy Opportunity:** After entering first transaction: "You just recorded your first transaction! You're officially doing bookkeeping. (And you didn't even need an accounting degree!)"

**Delight Detail:** The save button says "Record it!" instead of just "Save."

**Includes:**
- Simple income entry
- Simple expense entry
- Date, amount, description, category
- Auto-balancing (hide debits/credits from beginners)
- Transaction list view

**Spec Reference:** ACCT-005, PFD-002

---

### B3. Dashboard - Simplified [MVP]
**What:** The home screen that orients users and shows key information at a glance.

**Dependencies:** {A1, A3, A5, A6, B1, B2}

**Joy Opportunity:** Morning greeting based on time: "Good morning! Let's see how your business is doing today."

**Delight Detail:** If everything is caught up, show a "You're all caught up!" message with a small celebration animation (subtle confetti or a happy checkmark).

**Includes:**
- Cash position display
- Recent transactions
- Quick actions (new transaction, new invoice)
- Checklist preview (empty state initially)
- Getting started prompts

**Spec Reference:** PFD-002

---

### B4. DISC Profile Storage & Retrieval [MVP]
**What:** Store and retrieve user's DISC profile for communication adaptation.

**Dependencies:** {A1, A4}

**Joy Opportunity:** "We'll remember how you like to communicate. No judgment, just understanding."

**Includes:**
- DISC profile data model
- Profile storage per user
- Profile retrieval for message adaptation
- Manual override capability

**Spec Reference:** ONB-004

---

### B5. Message Variant System [MVP]
**What:** Infrastructure for serving DISC-adapted messages throughout the app.

**Dependencies:** {B4}

**Joy Opportunity:** Users won't consciously notice it, but everything will *feel* right. That's the real delight - feeling understood.

**Includes:**
- Message template system with 4 variants per message
- DISC-based message selection
- Fallback handling
- Message preview for testing

**Spec Reference:** ONB-004

---

### B6. Sync Relay Client [MVP]
**What:** Client-side logic for syncing encrypted data to relay servers.

**Dependencies:** {A2, A3}

**Joy Opportunity:** Sync indicator is a small, calm pulse when syncing. When complete: a tiny sparkle. Never stressful spinners.

**Delight Detail:** If sync happens fast, show "Synced in a snap!"

**Includes:**
- Sync queue management
- Encrypted payload preparation
- Conflict detection
- Retry logic with exponential backoff
- Sync status indicators

**Spec Reference:** ARCH-003

---

### B7. Charity Selection [MVP]
**What:** Allow users to select their charitable cause during signup/onboarding.

**Dependencies:** {A1, A4}

**Joy Opportunity:** "Part of your subscription helps others. Choose a cause close to your heart."

**Delight Detail:** After selection: "You've chosen to support [Charity Name]. Every month, $5 of your subscription goes directly to them."

**Includes:**
- Charity list display during onboarding
- Selection storage in user profile
- Change selection capability (monthly)
- Confirmation of choice
- Link to learn more about each charity

**Spec Reference:** CHARITY-001

---

### B8. Audit Log - Core [MVP]
**What:** Immutable record of all financial changes from day one.

**Dependencies:** {A1, A3}

**Joy Opportunity:** "Every change is recorded. This isn't about mistrust - it's about having a complete history."

**Includes:**
- Log all transaction creates/edits/deletes
- Timestamp and user tracking
- Before/after values for changes
- Cannot be modified or deleted
- Basic search capability

**Note:** This foundational audit infrastructure ensures GAAP compliance from the first transaction. Extended search/filter capabilities added in E7.

**Spec Reference:** ACCT-011

---

### B9. Error Handling & Empty States [MVP]
**What:** Graceful error messages and friendly empty states throughout.

**Dependencies:** {A5, B5}

**Joy Opportunity:** Errors should never feel like the user did something wrong. "Oops! Something unexpected happened. Don't worry - your data is safe. Let's try that again."

**Delight Detail:** Empty states have encouraging illustrations. Empty transaction list: "No transactions yet. Your first one is just a click away!"

**Includes:**
- Global error boundary
- User-friendly error messages (DISC-adapted)
- Empty state components for all major views
- Retry mechanisms

**Spec Reference:** ONB-004, TECH-001

---

## Group C - The Walls (Requires Group B)

### C1. Assessment Engine [MVP]
**What:** The core engine that processes assessment questions and determines user profiles.

**Dependencies:** {B4, B5}

**Joy Opportunity:** Progress bar during assessment says "Getting to know you..." with encouraging messages at milestones.

**Delight Detail:** At 50% complete: "Halfway there! You're doing great."

**Includes:**
- Question branching logic
- Answer scoring algorithms
- Phase determination (Stabilize/Organize/Build/Grow)
- Financial literacy scoring
- Business type categorization
- Save and resume capability

**Spec Reference:** ONB-001, ONB-002, ONB-003

---

### C2. Assessment UI - Complete Flow [MVP]
**What:** The full onboarding assessment experience.

**Dependencies:** {C1, A5, A6}

**Joy Opportunity:** Completion celebration! Confetti moment when assessment finishes. "Welcome to Graceful Books! We've prepared a personalized path just for you."

**Delight Detail:** Assessment questions use conversational language. Not "What is your business structure?" but "How is your business set up legally?"

**Includes:**
- All 5 assessment sections
- Progress indicator
- Section transitions
- Results summary page
- "What this means" explanations

**Spec Reference:** ONB-001, ONB-002

---

### C3. Checklist Generation Engine [MVP]
**What:** Generate personalized checklists based on assessment results.

**Dependencies:** {C1}

**Joy Opportunity:** Checklists appear as a "personalized path" - "Based on what you told us, here's your roadmap to financial clarity."

**Includes:**
- Checklist item templates by phase
- Dynamic item selection logic
- Business type customization
- Financial literacy depth adjustment
- Checklist storage

**Spec Reference:** CHECK-001

---

### C4. Checklist UI - Interactive [MVP]
**What:** The visual checklist experience with satisfying interactions.

**Dependencies:** {C3, A5, B3}

**Joy Opportunity:** CONFETTI MOMENT when completing an item! (Subtle, tasteful confetti). Streak tracking with celebration: "5 weeks in a row! You're building real momentum."

**Delight Detail:** Checked items make a satisfying "pop" sound (optional, can be toggled off). Progress bar fills with a smooth, satisfying animation.

**Includes:**
- Check off interactions
- Progress bars by category
- Snooze functionality
- "Not applicable" with confirmation
- Link items to relevant features
- Streak tracking display

**Spec Reference:** CHECK-001, CHECK-002

---

### C5. Phase-Based Feature Visibility [MVP]
**What:** Show/hide features based on user's current phase.

**Dependencies:** {C1, A6}

**Joy Opportunity:** When features unlock: "New feature unlocked! You're ready for [feature name]." Make it feel like leveling up, not like something was hidden.

**Delight Detail:** Locked features are visible but "dimmed" with a tooltip: "This feature becomes available as you grow. Curious? Peek ahead!"

**Includes:**
- Feature visibility rules by phase
- UI adaptation based on phase
- "Show all features" setting
- Feature unlock notifications

**Spec Reference:** PFD-001, PFD-002

---

### C6. Client/Customer Management - Basic [MVP]
**What:** Create and manage customer records.

**Dependencies:** {A1, A3, B1}

**Joy Opportunity:** "Your first customer! Every business started with one."

**Delight Detail:** Customer count milestone celebrations: "10 customers! Your client base is growing."

**Includes:**
- Customer creation and editing
- Contact information
- Customer list view
- Search and filter
- Notes field

**Spec Reference:** ACCT-002

---

### C7. Invoice Creation - Basic [MVP]
**What:** Create and send simple invoices.

**Dependencies:** {C6, B1, B2}

**Joy Opportunity:** After sending first invoice: "Your first invoice is on its way! (How professional of you.)"

**Delight Detail:** Invoice preview shows "This is what [Customer Name] will see" to build confidence.

**Includes:**
- Invoice creation form
- Line items
- Basic templates (3-5 options)
- Invoice preview
- Send via email
- PDF generation
- Invoice status tracking

**Spec Reference:** ACCT-002

---

### C8. Receipt Capture - Basic (Nice)
**What:** Upload and store receipt images.

**Dependencies:** {A1, A3, B2}

**Joy Opportunity:** "Receipt saved! That's one less piece of paper to worry about."

**Delight Detail:** When a receipt is matched to a transaction: "Perfect match! Receipt and transaction are now best friends."

**Includes:**
- Image upload
- Receipt storage
- Link receipt to transaction
- Receipt gallery view

**Spec Reference:** ACCT-003

---

---

# Phase 2: First Steps

*"The journey of a thousand miles begins with a single step. Let's make your first steps feel amazing."*

## Group D - Welcome Home (Requires Group C)

### D1. Guided Chart of Accounts Setup [MVP]
**What:** Step-by-step wizard for setting up chart of accounts with education.

**Dependencies:** {B1, C3, C5}

**Joy Opportunity:** Each step explains WHY in plain English. "Assets are things your business owns. Think of them as your business's treasure chest."

**Delight Detail:** Industry templates have friendly descriptions: "The Creative's Canvas - Perfect for designers, writers, and artists."

**Includes:**
- Section-by-section walkthrough
- Industry template selection
- Plain English explanations
- Common accounts suggestions
- "Why do I need this?" tooltips

**Spec Reference:** ACCT-001

---

### D2. First Reconciliation Experience - Guided [MVP]
**What:** Hand-held first bank reconciliation with education.

**Dependencies:** {B1, B2}

**Joy Opportunity:** "Reconciliation is just a fancy word for 'making sure your records match the bank.' Let's do this together."

**Delight Detail:** Completion celebration: "You reconciled! This is a bigger deal than it sounds. Seriously, many business owners never do this."

**Includes:**
- Statement upload (PDF/CSV)
- Step-by-step matching guidance
- "What is reconciliation?" explainer
- Common discrepancy explanations
- Celebration on completion

**Spec Reference:** ACCT-004

---

### D3. Weekly Email Summary Setup [MVP]
**What:** Configure and enable weekly task reminder emails.

**Dependencies:** {C3, B5}

**Joy Opportunity:** Email subject lines are encouraging: "Your Week Ahead: Small Steps, Big Progress" instead of "Weekly Tasks Due."

**Delight Detail:** Users can preview their email before enabling. "This is what your Monday morning will look like."

**Includes:**
- Day/time selection
- Content preferences
- DISC-adapted email content
- Preview functionality
- Unsubscribe mechanism

**Spec Reference:** NOTIF-001

---

### D4. Tutorial System Framework [MVP]
**What:** Infrastructure for contextual tutorials and help.

**Dependencies:** {A5, B5, C5}

**Joy Opportunity:** Tutorials feel like a friendly guide, not a boring manual. "Let me show you a neat trick..."

**Delight Detail:** Tutorial completion badges (hidden in profile, not in-your-face).

**Includes:**
- Tutorial trigger system
- Step highlighting
- Progress tracking
- Skip and resume
- "Don't show again" options

**Spec Reference:** LEARN-001 (from Ideas)

---

### D5. Vendor Management - Basic [MVP]
**What:** Create and manage vendor records for expenses.

**Dependencies:** {A1, A3}

**Joy Opportunity:** "Keeping track of who you pay helps you understand where your money goes. No judgment - just clarity."

**Includes:**
- Vendor creation and editing
- Contact information
- Vendor list view
- Link vendors to expenses

**Spec Reference:** ACCT-003

---

### D6. Basic Reports - P&L [MVP]
**What:** Profit and Loss statement with plain English explanations.

**Dependencies:** {B1, B2}

**Joy Opportunity:** Report has a "What does this mean?" toggle that explains each section. "Revenue minus Expenses equals Profit. You're profitable if this number is positive!"

**Delight Detail:** If profitable: show a subtle green glow. Include encouraging message: "You made money this period! Great work."

**Includes:**
- Date range selection
- P&L generation
- Plain English annotations
- Export to PDF
- Comparison periods (basic)

**Spec Reference:** ACCT-009

---

### D7. Basic Reports - Balance Sheet [MVP]
**What:** Balance sheet with educational context.

**Dependencies:** {B1, B2, D6}

**Joy Opportunity:** "The balance sheet is like a financial snapshot - it shows what you own, what you owe, and what's left over."

**Includes:**
- Balance sheet generation
- Assets, Liabilities, Equity sections
- Plain English explanations
- Export to PDF

**Spec Reference:** ACCT-009

---

## Group E - Building Confidence (Requires Group D)

### E1. Bank Reconciliation - Full Flow [MVP]
**What:** Complete reconciliation with auto-matching and discrepancy handling.

**Dependencies:** {D2}

**Joy Opportunity:** Auto-match success: "Found 47 matches automatically! You just need to review 3."

**Delight Detail:** Reconciliation streak: "3 months in a row! Your books are consistently accurate."

**Includes:**
- Auto-matching algorithm (>85% accuracy target)
- Manual matching interface
- Discrepancy identification
- Reconciliation history
- Unreconciled transaction flagging

**Spec Reference:** ACCT-004

---

### E2. Recurring Transactions [MVP]
**What:** Set up transactions that repeat automatically.

**Dependencies:** {B2}

**Joy Opportunity:** "Set it and forget it! This transaction will record itself."

**Delight Detail:** Show how much time recurring transactions have saved: "Recurring transactions have saved you from entering 47 transactions manually."

**Includes:**
- Create recurring income/expense
- Frequency options (weekly, monthly, etc.)
- Auto-create vs. draft for approval
- Edit series or single instance
- End date options

**Spec Reference:** ACCT-002, ACCT-003

---

### E3. Invoice Templates - Customizable (Nice)
**What:** Full template customization with branding.

**Dependencies:** {C7}

**Joy Opportunity:** Preview shows actual customer name: "Maria Garcia will receive an invoice that looks exactly like this."

**Delight Detail:** "Brand colors applied! Your invoices now match your business personality."

**Includes:**
- Logo upload with auto-resize
- Brand color picker (hex input)
- Multiple layout options
- Custom footer messages
- Template preview
- Multiple saved templates

**Spec Reference:** ACCT-002

---

### E4. Recurring Invoices (Nice)
**What:** Invoices that generate and send automatically.

**Dependencies:** {C7, E2}

**Joy Opportunity:** "Recurring invoice set! You'll get paid on autopilot."

**Delight Detail:** Show recurring invoice revenue: "$2,400/month in recurring invoices. Predictable income!"

**Includes:**
- Create recurring invoice
- Frequency and duration
- Auto-send vs. draft
- Customer notifications
- End date handling

**Spec Reference:** ACCT-002

---

### E5. Expense Categorization with Suggestions (Nice)
**What:** AI-powered category suggestions that learn from user corrections.

**Dependencies:** {B2, D5}

**Joy Opportunity:** "I noticed this looks like an 'Office Supplies' expense. Am I right?"

**Delight Detail:** Learning acknowledgment: "Got it! I'll remember that [Vendor] is usually 'Marketing.'"

**Includes:**
- Category suggestion algorithm
- Learning from corrections
- Suggestion accuracy tracking
- "Suggest for similar" option
- Bulk categorization

**Spec Reference:** ACCT-003, AI-001 (from Ideas)

---

### E6. Bill Entry & Management (Nice)
**What:** Track bills you owe to vendors.

**Dependencies:** {D5, B2}

**Joy Opportunity:** "Bills tracked! Knowing what you owe helps you plan."

**Delight Detail:** Upcoming bills summary: "You have $1,200 in bills due in the next 7 days."

**Includes:**
- Bill creation (manual)
- Due date tracking
- Bill status (draft, due, overdue, paid)
- Bill payment recording
- Bill list view

**Spec Reference:** ACCT-003

---

### E7. Audit Log - Basic [MVP]
**What:** Immutable record of all financial changes.

**Dependencies:** {A1, A3, B2}

**Joy Opportunity:** "Every change is recorded. This isn't about mistrust - it's about having a complete history."

**Includes:**
- Log all transaction changes
- Log user actions
- Timestamp and user tracking
- Basic search and filter
- Cannot be modified

**Spec Reference:** ACCT-011

---

---

# Phase 3: Finding Your Rhythm

*"Now you're cooking! Let's build the habits that make your financial life effortless."*

## Group F - The Daily Dance (Requires Group E)

### F1. Dashboard - Full Featured [MVP]
**What:** Complete dashboard with insights and actionable items.

**Dependencies:** {B3, C4, D6, E1}

**Joy Opportunity:** Dashboard adapts greeting to context: "Welcome back! Quick heads up - you have 2 invoices that could use a follow-up."

**Delight Detail:** Cash position includes encouraging context: "You have 3.2 months of expenses covered. That's solid!"

**Includes:**
- Cash position with trend
- Revenue vs. expenses chart
- Checklist integration
- Overdue invoices highlight
- Reconciliation status
- Quick actions
- Upcoming bills preview

**Spec Reference:** PFD-002

---

### F2. Classes & Categories System [MVP]
**What:** Multi-dimensional tracking for deeper analysis.

**Dependencies:** {B1, B2}

**Joy Opportunity:** "Classes let you see your business from different angles. Like having X-ray vision for your finances."

**Delight Detail:** First class created: "Your first class! Now you can track [class name] separately."

**Includes:**
- Class creation and management
- Category creation (hierarchical)
- Assignment to transactions
- Assignment to invoice lines
- Reporting integration

**Spec Reference:** CLASS-001

---

### F3. Tags System (Nice)
**What:** Flexible, multi-tag system for cross-cutting analysis.

**Dependencies:** {F2}

**Joy Opportunity:** "Tags are like sticky notes for your transactions. Use them however makes sense to you."

**Includes:**
- Tag creation and management
- Multiple tags per transaction
- Tag-based filtering
- Tag reporting
- Tag suggestions

**Spec Reference:** CLASS-001

---

### F4. Cash Flow Report [MVP]
**What:** Where money came from and where it went.

**Dependencies:** {D6, D7}

**Joy Opportunity:** Visual flow shows money moving - makes abstract numbers concrete and understandable.

**Delight Detail:** "This month, you brought in $15,000 and spent $12,000. $3,000 stayed with you!"

**Includes:**
- Cash flow statement
- Operating/investing/financing sections
- Plain English explanations
- Visual representation
- Period comparison

**Spec Reference:** ACCT-009

---

### F5. A/R Aging Report [MVP]
**What:** Who owes you money and for how long.

**Dependencies:** {C7}

**Joy Opportunity:** Aging buckets use friendly language: "Current", "Getting older", "Needs attention", "Let's talk about this one"

**Delight Detail:** When A/R is healthy: "Great news - most of your receivables are current!"

**Includes:**
- Aging buckets (Current, 1-30, 31-60, 61-90, 90+)
- Customer breakdown
- Total outstanding
- Direct link to send reminder
- Export capability

**Spec Reference:** ACCT-009

---

### F6. A/P Aging Report [MVP]
**What:** What you owe and when it's due.

**Dependencies:** {E6}

**Joy Opportunity:** "Staying on top of what you owe keeps relationships healthy and avoids surprises."

**Includes:**
- Aging buckets
- Vendor breakdown
- Total outstanding
- Payment scheduling link
- Export capability

**Spec Reference:** ACCT-009

---

### F7. Journal Entries - Full [MVP]
**What:** Complete journal entry capability for adjustments.

**Dependencies:** {B2}

**Joy Opportunity:** "Journal entries are the accounting equivalent of writing a note in the margins. Sometimes you need to adjust things manually."

**Delight Detail:** Built-in templates for common adjustments: "Depreciation", "Prepaid expenses", etc.

**Includes:**
- Multi-line journal entries
- Debit/credit balancing (enforced)
- Entry templates
- Memo per line
- Attachment support
- Plain English explanations

**Spec Reference:** ACCT-005

---

### F8. Cash vs. Accrual Toggle [MVP]
**What:** Switch between accounting methods with education.

**Dependencies:** {D6, D7}

**Joy Opportunity:** Clear explanation: "Cash basis = record when money moves. Accrual = record when you earn/owe. Both are valid!"

**Includes:**
- Method selection in settings
- Reports adjust to method
- Warning when switching
- Education about implications
- Historical availability in both methods

**Spec Reference:** ACCT-010

---

## Group G - Growing Stronger (Requires Group F)

### G1. Custom Reports Builder (Nice)
**What:** Create saved, custom report configurations.

**Dependencies:** {F2, F3, F4, F5, F6}

**Joy Opportunity:** "Build reports that answer YOUR questions about YOUR business."

**Delight Detail:** Saved reports have user-chosen names and icons.

**Includes:**
- Column selection
- Filter configuration
- Date range templates
- Save configurations
- Schedule delivery (placeholder for email integration)

**Spec Reference:** ACCT-009

---

### G2. Product/Service Catalog [MVP for product businesses]
**What:** Manage what you sell with pricing and details.

**Dependencies:** {A1, A3}

**Joy Opportunity:** "Your catalog is like a menu for your business. What delicious things do you offer?"

**Delight Detail:** Product milestone: "100 products! You've got quite the selection."

**Includes:**
- Product creation and management
- Service creation and management
- Pricing tiers
- Categories
- Cost tracking (for COGS)
- Link to invoicing

**Spec Reference:** ACCT-006

---

### G3. Basic Inventory Tracking (Nice)
**What:** Track stock levels and movements.

**Dependencies:** {G2}

**Joy Opportunity:** "Knowing what you have means knowing what you can sell. Simple as that."

**Delight Detail:** Low stock alert: "Heads up! [Product] is running low. Only 3 left."

**Includes:**
- Quantity on hand
- Stock movements
- Reorder point alerts
- Simple valuation (weighted average)
- Manual adjustments

**Spec Reference:** ACCT-007

---

### G4. Sales Tax - Basic [MVP where applicable]
**What:** Track and calculate sales tax on invoices.

**Dependencies:** {C7, G2}

**Joy Opportunity:** "Sales tax is collected from customers and passed to the government. You're just the middleman!"

**Includes:**
- Tax rate setup
- Apply to invoices
- Tax collected tracking
- Tax liability report
- Filing reminders

**Spec Reference:** ACCT-008

---

### G5. Receipt OCR Processing (Nice)
**What:** Extract data from receipt images automatically.

**Dependencies:** {C8}

**Joy Opportunity:** "Just snap a photo. We'll read the receipt for you. (Magic? Maybe.)"

**Delight Detail:** Show OCR confidence: "I'm 95% sure this is a $47.50 expense at Office Depot."

**Includes:**
- OCR processing pipeline
- Amount extraction
- Date extraction
- Vendor detection
- Manual correction interface
- Learning from corrections

**Spec Reference:** ACCT-003

---

### G6. Bill OCR Processing (Nice)
**What:** Extract bill details from uploaded images.

**Dependencies:** {E6, G5}

**Joy Opportunity:** "Upload a bill, and we'll fill in the details. Less typing, more doing."

**Includes:**
- Bill image upload
- OCR data extraction
- Pre-fill bill entry
- Manual corrections
- Confidence indicators

**Spec Reference:** ACCT-003

---

### G7. 1099 Tracking (Nice)
**What:** Track payments to contractors for 1099 reporting.

**Dependencies:** {D5, E6}

**Joy Opportunity:** "Tax time is easier when 1099 tracking is automatic all year."

**Delight Detail:** End of year: "You have 5 vendors who need 1099s. All the info is ready!"

**Includes:**
- Mark vendor as 1099-eligible
- Track payments over threshold
- W-9 storage
- 1099 summary report
- Generation guidance

**Spec Reference:** ACCT-003

---

---

# Phase 4: Spreading Your Wings

*"Look at you go! Time to unlock the power features."*

## Group H - Taking Flight (Requires Group G)

### H1. Multi-User Support [MVP for teams]
**What:** Invite team members with role-based access.

**Dependencies:** {A2, A4, E7}

**Joy Opportunity:** "Your business is growing! Adding team members means your financial records can too."

**Delight Detail:** First team member invited: "Your first teammate! Business is better together."

**Includes:**
- User invitation system
- Role definitions (Admin, Manager, Bookkeeper, View-Only)
- Permission-based key derivation
- Activity visibility by role
- User management interface

**Spec Reference:** ARCH-002, FUTURE-002

---

### H2. Key Rotation & Access Revocation [MVP for teams]
**What:** Rotate encryption keys and revoke access instantly.

**Dependencies:** {H1}

**Joy Opportunity:** Security messages are reassuring, not scary: "Access updated. Your data remains secure and private."

**Includes:**
- Key rotation mechanism
- Instant access revocation
- Active session handling
- Audit logging of changes
- User notification

**Spec Reference:** ARCH-002

---

### H3. Approval Workflows (Nice)
**What:** Require approval for bills, expenses, or large transactions.

**Dependencies:** {H1, E6}

**Joy Opportunity:** "Trust, but verify. Approvals keep everyone on the same page."

**Delight Detail:** Approval notification: "Marcus approved your expense report!"

**Includes:**
- Configure approval rules
- Approval notifications
- Approve/reject interface
- Approval history
- Delegation options

**Spec Reference:** FUTURE-002

---

### H4. Client Portal (Nice)
**What:** Customers can view and pay invoices online.

**Dependencies:** {C7}

**Joy Opportunity:** "Give your customers a professional portal. They'll be impressed."

**Delight Detail:** Customer sees: "Invoice from [Your Business]. Easy to view, easy to pay."

**Includes:**
- Unique portal links per customer
- Invoice view (no account required)
- Payment integration
- Invoice history
- Simple, professional design

**Spec Reference:** ACCT-002

---

### H5. Multi-Currency - Basic (Nice)
**What:** Handle transactions in foreign currencies.

**Dependencies:** {B2, B1}

**Joy Opportunity:** "Going global! Multi-currency lets you work with customers and vendors anywhere."

**Includes:**
- Currency setup
- Exchange rates (manual entry)
- Transaction in foreign currency
- Conversion to home currency
- Currency display on transactions

**Spec Reference:** CURR-001

---

### H6. Advanced Inventory (Nice)
**What:** Full inventory with multiple valuation methods.

**Dependencies:** {G3}

**Joy Opportunity:** "Level up your inventory! FIFO, LIFO, weighted average - choose your adventure."

**Includes:**
- FIFO/LIFO/Weighted Average selection
- Inventory valuation reports
- COGS calculation
- Stock take functionality
- Inventory adjustments with audit trail

**Spec Reference:** ACCT-007

---

### H7. Interest Split Prompt System (Nice)
**What:** Prompt to split principal and interest on loan payments.

**Dependencies:** {B2, F7}

**Joy Opportunity:** "This looks like a loan payment. Should we split out the interest? (It's tax-deductible!)"

**Delight Detail:** "Not now" adds a checklist item: "Split interest from [Loan] payment" so nothing is forgotten.

**Includes:**
- Liability payment detection
- Split workflow
- Journal entry generation
- Checklist integration for "later"
- Settings to disable

**Spec Reference:** LIAB-001

---

### H8. Sync Relay - Hosted [MVP]
**What:** Managed sync relay service for multi-device access.

**Dependencies:** {B6}

**Joy Opportunity:** "Your data travels with you. Work on any device, stay in sync."

**Includes:**
- Production relay deployment
- Geographic distribution
- Health monitoring
- SLA tracking
- User region selection

**Spec Reference:** ARCH-003

---

### H9. Sync Relay - Self-Hosted Documentation (Nice)
**What:** Enable users to run their own sync relay.

**Dependencies:** {H8}

**Joy Opportunity:** "Full control. Your data on your servers. We'll show you how."

**Includes:**
- Docker container
- Binary builds
- Setup documentation
- Configuration guide
- Health check endpoints

**Spec Reference:** ARCH-003

---

## Group I - Soaring High (Requires Group H)

### I1. CRDT Conflict Resolution [MVP for multi-user]
**What:** Handle simultaneous edits without data loss.

**Dependencies:** {H1, B6}

**Joy Opportunity:** "Two people edited this at once, and we kept both changes. No drama."

**Delight Detail:** Conflict notification is calm: "Heads up: this record was updated by both you and [User]. We merged the changes."

**Includes:**
- CRDT implementation per data type
- Merge algorithm
- Conflict notification
- Conflict history view
- Manual resolution for complex cases

**Spec Reference:** ARCH-004

---

### I2. Activity Feed (Nice)
**What:** See what's happening across the team.

**Dependencies:** {H1, E7}

**Joy Opportunity:** "Stay in the loop without endless meetings."

**Includes:**
- Activity stream
- Filter by user/type
- Click to view related item
- Notification preferences

**Spec Reference:** FUTURE-002

---

### I3. Comments on Transactions (Nice)
**What:** Leave notes and questions on specific transactions.

**Dependencies:** {H1, B2}

**Joy Opportunity:** "Have a question about a transaction? Ask right there."

**Includes:**
- Add comments to any transaction
- @mention team members
- Comment notifications
- Comment history

**Spec Reference:** FUTURE-002

---

### I4. Multi-Currency - Full (Nice)
**What:** Complete multi-currency with automatic rates and gain/loss.

**Dependencies:** {H5}

**Joy Opportunity:** "Exchange rates update automatically. Gain and loss tracked perfectly."

**Includes:**
- Automatic exchange rate updates
- Realized gain/loss on payments
- Unrealized gain/loss reporting
- Currency revaluation
- Multi-currency aging reports

**Spec Reference:** CURR-001

---

### I5. Barter/Trade Transactions (Nice)
**What:** Record barter exchanges properly.

**Dependencies:** {F7, B2}

**Joy Opportunity:** "Traded services? We've got you covered. Barter is real income (and the IRS agrees)."

**Delight Detail:** Educational explainer about barter tax implications included.

**Includes:**
- Barter transaction type
- Fair market value entry
- Automatic offsetting entries
- Barter income/expense tracking
- 1099-B guidance

**Spec Reference:** BARTER-001

---

### I6. Scheduled Report Delivery (Nice)
**What:** Receive reports automatically by email.

**Dependencies:** {G1, D3}

**Joy Opportunity:** "P&L delivered to your inbox every Monday. Automatic financial awareness."

**Includes:**
- Schedule configuration per report
- Email delivery
- Multiple recipients
- Delivery history

**Spec Reference:** ACCT-009

---

---

# Phase 5: Reaching for the Stars

*"Dream big. These features push the boundaries of what accounting software can be."*

## Group J - Moonshots (Requires Group I)

### J1. 3D Financial Visualization (Nice)
**What:** Interactive 3D representation of money flow.

**Dependencies:** {F4, D6, D7}

**Joy Opportunity:** "See your finances in a whole new dimension. Watch money flow through your business like a river."

**Delight Detail:** Time-lapse mode: watch a year of finances unfold like a beautiful animation.

**Includes:**
- 3D engine integration
- Cash flow visualization
- Balance sheet visualization
- P&L flow diagram
- Interactive controls
- 2D fallback
- Accessibility descriptions

**Spec Reference:** VIZ-001

---

### J2. AI-Powered Insights (Nice)
**What:** Intelligent analysis and recommendations.

**Dependencies:** {F1, F4, G1}

**Joy Opportunity:** "I noticed your expenses grew faster than revenue this quarter. Want to dig into why?"

**Delight Detail:** Insights are helpful, never judgmental: "Here's something interesting..." not "Warning!"

**Includes:**
- Anomaly detection
- Trend analysis
- Natural language insights
- Cash flow forecasting
- Expense pattern recognition

**Spec Reference:** AI-001 (from Ideas)

---

### J3. "What-If" Scenario Planner (Nice)
**What:** Model business decisions before making them.

**Dependencies:** {J2, F4}

**Joy Opportunity:** "What if you hired an employee? Let's find out... without the commitment."

**Delight Detail:** Scenarios can be named: "The Expansion Dream" or "Conservative Growth"

**Includes:**
- Scenario creation
- Adjust variables
- See projected impact
- Compare scenarios
- Save and share scenarios

**Spec Reference:** AI-002 (from Ideas)

---

### J4. Financial Health Score (Nice)
**What:** Simple 0-100 score representing overall business health.

**Dependencies:** {F4, D6, D7, F5, F6}

**Joy Opportunity:** "Your Financial Health Score is 73. Here's what that means and how to improve."

**Delight Detail:** Score improvements celebrated: "Your score went up 5 points this month!"

**Includes:**
- Score calculation algorithm
- Component breakdown (liquidity, profitability, etc.)
- Trend tracking
- Improvement recommendations
- Industry benchmarking (if data available)

**Spec Reference:** HEALTH-001 (from Ideas)

---

### J5. Goal Setting & Tracking (Nice)
**What:** Set and track financial goals.

**Dependencies:** {J4, C4}

**Joy Opportunity:** "Set a goal, watch your progress. Celebrate when you hit it!"

**CONFETTI MOMENT: Goal achievement = full confetti celebration.

**Includes:**
- Goal creation (revenue, profit, expense reduction)
- Progress visualization
- Milestone notifications
- Goal history
- Connect goals to checklist items

**Spec Reference:** GOAL-001 (from Ideas)

---

### J6. Emergency Fund & Runway Calculator (Nice)
**What:** Know how long your business can survive.

**Dependencies:** {F4}

**Joy Opportunity:** "You have 4.2 months of runway. That's peace of mind."

**Delight Detail:** Runway alerts are helpful, not scary: "Just a heads up - runway is at 2 months. Here are some ideas..."

**Includes:**
- Runway calculation
- Emergency fund recommendations
- Threshold alerts
- Scenario modeling for extension
- Visual runway representation

**Spec Reference:** RUNWAY-001 (from Ideas)

---

### J7. Mentor/Advisor Portal (Nice)
**What:** Invite accountants or advisors for collaborative access.

**Dependencies:** {H1, I3}

**Joy Opportunity:** "Invite your accountant to see your books. Collaboration without file sharing."

**Includes:**
- Advisor invitation
- View-only or collaborative roles
- Secure document sharing
- Feedback/comments
- Access control

**Spec Reference:** MENTOR-001 (from Ideas)

---

### J8. Tax Time Preparation Mode (Nice)
**What:** Guided workflow to prepare for tax season.

**Dependencies:** {D6, D7, G7, G4}

**Joy Opportunity:** "Tax season doesn't have to be scary. We'll get you ready, step by step."

**Delight Detail:** Checklist turns green as items complete. "You're 80% ready for taxes!"

**Includes:**
- Tax prep workflow activation
- Documents checklist
- Missing info identification
- Tax-ready report bundle
- Accountant export package
- Deduction suggestions (educational)

**Spec Reference:** TAX-001 (from Ideas)

---

### J9. Integration Hub - First Integrations (Nice)
**What:** Connect to external services.

**Dependencies:** {A1, A4}

**Joy Opportunity:** "Connect your tools. Less copy-paste, more automation."

**Includes:**
- Integration framework
- First integrations (e.g., Stripe, Square)
- Data mapping
- Sync scheduling
- Error handling

**Spec Reference:** INTEG-001 (from Ideas)

---

### J10. Mobile Receipt Capture App (Nice)
**What:** Dedicated mobile app for on-the-go receipt capture.

**Dependencies:** {G5, H8}

**Joy Opportunity:** "Snap a receipt at lunch. It'll be categorized by dinner."

**Delight Detail:** Quick-capture widget on phone home screen.

**Includes:**
- Native mobile app
- Camera integration
- Offline capture with sync
- Mileage tracking with GPS
- Quick expense entry

**Spec Reference:** MOBILE-001 (from Ideas)

---

### J11. API Access for Developers (Nice)
**What:** Public API for custom integrations.

**Dependencies:** {H1, A4}

**Joy Opportunity:** "Build your own integrations. Your data, your rules."

**Includes:**
- RESTful API
- Authentication (API keys)
- Rate limiting
- Documentation
- Sandbox environment

**Spec Reference:** FUTURE-001

---

---

# Bonus: Easter Eggs & Hidden Delights

*"These are the surprises that make users smile and tell their friends."*

### Easter Egg Ideas (Implement When Time Allows)

1. **The Konami Code** - Entering the Konami code anywhere triggers a brief celebration animation with the message "You found a secret! We appreciate the curious ones."

2. **Transaction #1000** - When a user enters their 1000th transaction, a special message: "Transaction ONE THOUSAND! If bookkeeping were a video game, you'd be beating it."

3. **Midnight Bookkeeper** - If reconciling after midnight: "Burning the midnight oil? Your dedication is impressive. (But also, go to bed!)"

4. **April 15th Greeting** - On tax day (US): "Happy Tax Day! We hope your books are as ready as your tax preparer is caffeinated."

5. **Anniversary Badge** - On the user's signup anniversary: "Happy Graceful Books anniversary! Another year of financial clarity."

6. **Zero Balance Celebration** - If A/R hits zero: "Everyone's paid up! This calls for celebration."

7. **The Perfect Reconciliation** - If a reconciliation matches perfectly on first try: "PERFECT MATCH! The accounting gods smile upon you today."

8. **Seasonal Themes** - Subtle seasonal touches (falling leaves in autumn, gentle snowflakes in winter) that can be toggled off.

---

# Appendix: Spec Reference Quick Index

| Code | Description | Roadmap Items |
|------|-------------|---------------|
| ARCH-001 | Zero-knowledge encryption | A2 |
| ARCH-002 | Key management | A2, H1, H2 |
| ARCH-003 | Sync infrastructure | A3, B6, H8, H9 |
| ARCH-004 | Conflict resolution | I1 |
| ONB-001 | Assessment framework | C1, C2 |
| ONB-002 | Assessment structure | C1, C2 |
| ONB-003 | Phase determination | C1 |
| ONB-004 | DISC communication | B4, B5, B7 |
| PFD-001 | Feature revelation | C5 |
| PFD-002 | Phase-based interface | B2, B3, C5, F1 |
| ACCT-001 | Chart of accounts | A1, B1, D1 |
| ACCT-002 | Invoicing & clients | C6, C7, E3, E4, H4 |
| ACCT-003 | Bills & expenses | C8, D5, E5, E6, G5, G6, G7 |
| ACCT-004 | Bank reconciliation | D2, E1 |
| ACCT-005 | Journal entries | B2, F7 |
| ACCT-006 | Products/services | G2 |
| ACCT-007 | Inventory | G3, H6 |
| ACCT-008 | Sales tax | G4 |
| ACCT-009 | Reporting | D6, D7, F4, F5, F6, G1, I6 |
| ACCT-010 | Cash vs. accrual | F8 |
| ACCT-011 | Audit log | A1, E7 |
| CLASS-001 | Classification & tagging | F2, F3 |
| CHECK-001 | Checklist generation | C3, C4 |
| CHECK-002 | Checklist interface | C4 |
| NOTIF-001 | Weekly email | D3 |
| CURR-001 | Multi-currency | H5, I4 |
| BARTER-001 | Barter transactions | I5 |
| VIZ-001 | 3D visualization | J1 |
| LIAB-001 | Interest prompt | H7 |
| FUTURE-001 | API architecture | J11 |
| FUTURE-002 | Team collaboration | H1, H3, I2, I3 |
| TECH-001 | Performance | B7 |
| TECH-002 | Platform support | A6 |
| TECH-003 | Accessibility | A5 |

---

*"Remember: every big journey is just a series of small steps. You've got this. And so do your users."*

**Now go build something graceful.**
