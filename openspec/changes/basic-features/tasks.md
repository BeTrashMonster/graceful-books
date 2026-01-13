# Tasks: Basic Features (Group B - The Frame)

## Overview
Group B implements the core accounting functionality on top of Group A's infrastructure. All 7 tasks can be worked on in parallel once Group A is complete, though some logical sequencing may improve efficiency.

**Prerequisites:** Group A complete (Database Schema & Core Data Models, Encryption Layer Foundation, Local-First Data Store, Authentication & Session Management, UI Component Library - Core, Application Shell & Routing)

## Task List

### B1. Chart of Accounts - Basic CRUD [MVP]
**What:** Create, read, update, and manage accounts.

**Dependencies:** {A1: Database Schema, A3: Local-First Data Store, A5: UI Component Library, A6: Application Shell & Routing}

**Joy Opportunity:** When creating their first account, celebrate: "Your first account! This is where the magic of organization begins." Pre-built templates have friendly names like "The Freelancer's Friend" or "Shopkeeper's Starter Kit."

**Deliverables:**
- Account data model with fields:
  - Account ID (auto-generated)
  - Account name
  - Account type (Assets, Liabilities, Equity, Income, COGS, Expenses, Other Income/Expense)
  - Sub-type (Current Assets, Fixed Assets, etc.)
  - Account number (customizable numbering scheme)
  - Parent account (for sub-accounts, unlimited depth)
  - Description and notes
  - Active/inactive status
  - Opening balance
  - Created/modified timestamps
- Account creation wizard with:
  - Account type selection with plain English descriptions
  - Account name input with validation
  - Optional account number assignment
  - Parent account selection for sub-accounts
  - Description field with helpful prompts
- Account list view with:
  - Hierarchical display (parent/child indentation)
  - Filter by account type
  - Filter by active/inactive status
  - Search by name or number
  - Sort by name, number, or type
- Account editing form
- Active/inactive toggle functionality
- Account deletion (with dependency checking - prevent deletion if transactions exist)
- Pre-built templates:
  - Service business template
  - Product business template
  - Hybrid business template
  - Custom template option

**Technical Notes:**
- Encrypted storage of all account data
- Validation prevents duplicate account names within same parent
- Sub-account hierarchy must prevent circular references
- Support for account numbering schemes (e.g., 1000-1999 Assets, 2000-2999 Liabilities)
- GAAP-compliant account types enforced
- Performance target: Load chart of accounts with 500 accounts in <200ms

**Spec Reference:** ACCT-001

---

### B2. Transaction Entry - Basic [MVP]
**What:** Enter income and expenses with proper double-entry accounting (hidden complexity).

**Dependencies:** {A1: Database Schema, A3: Local-First Data Store, B1: Chart of Accounts CRUD}

**Joy Opportunity:** After entering first transaction: "You just recorded your first transaction! You're officially doing bookkeeping. (And you didn't even need an accounting degree!)" The save button says "Record it!" instead of just "Save."

**Deliverables:**
- Transaction data model with fields:
  - Transaction ID (auto-generated)
  - Transaction date
  - Description/memo
  - Amount
  - Transaction type (Income, Expense, Transfer)
  - Source account (for expenses: bank/cash account)
  - Destination account (for income: bank/cash account)
  - Category account (chart of accounts account)
  - Status (Draft, Posted)
  - Created/modified timestamps
  - Created by user
- Transaction line items model (for double-entry):
  - Line item ID
  - Transaction ID (foreign key)
  - Account ID (foreign key to chart of accounts)
  - Debit amount
  - Credit amount
  - Memo/description
- Simple income entry form:
  - Date picker (defaults to today)
  - Amount input (positive numbers only)
  - Description field
  - Category selection (income accounts from COA)
  - Bank/cash account selection (where money goes)
  - "Record it!" button
- Simple expense entry form:
  - Date picker (defaults to today)
  - Amount input (positive numbers only)
  - Description field
  - Category selection (expense accounts from COA)
  - Bank/cash account selection (where money comes from)
  - "Record it!" button
- Auto-balancing logic:
  - Income: Debit bank account, Credit income account
  - Expense: Debit expense account, Credit bank account
  - Validation ensures debits = credits
- Transaction list view with:
  - Date range filter
  - Transaction type filter
  - Account filter
  - Search by description
  - Sort by date, amount, or type
  - Display: Date, Description, Amount, Category, Account
- Transaction editing:
  - Edit any field
  - Recalculate balancing entries
  - Track changes in audit log
- Transaction deletion:
  - Soft delete (mark as void)
  - Confirmation dialog
  - Audit trail preservation

**Technical Notes:**
- All transactions stored encrypted
- Transaction validation before save (balanced, valid accounts, positive amounts)
- Auto-generate journal entries in background (hidden from user)
- Performance target: Save transaction in <500ms including encryption
- Support for future expansion to multi-line journal entries
- Transaction IDs must be globally unique for sync

**Spec Reference:** ACCT-005, PFD-002

---

### B3. Dashboard - Simplified [MVP]
**What:** The home screen that orients users and shows key information at a glance.

**Dependencies:** {A1: Database Schema, A3: Local-First Data Store, A5: UI Component Library, A6: Application Shell & Routing, B1: Chart of Accounts, B2: Transaction Entry}

**Joy Opportunity:** Morning greeting based on time: "Good morning! Let's see how your business is doing today." If everything is caught up, show a "You're all caught up!" message with a small celebration animation (subtle confetti or a happy checkmark).

**Deliverables:**
- Dashboard layout with sections:
  - Header with time-based greeting
  - Cash position card with:
    - Current cash balance (sum of bank/cash accounts)
    - Trend indicator (up/down from last period)
    - Visual gauge or simple chart
  - Recent transactions widget:
    - Last 5-10 transactions
    - Date, description, amount
    - Link to view all transactions
  - Quick actions section:
    - "New Transaction" button
    - "New Invoice" button (placeholder for Group C)
    - "View Reports" button (placeholder for Group D)
  - Getting started checklist preview (empty state for now, populated in Group C):
    - "Get Started" card
    - 3-5 suggested first steps
    - Progress indicator
  - Empty states with encouraging messages:
    - No transactions yet: "No transactions yet. Your first one is just a click away!"
    - No cash accounts: "Let's set up your bank accounts to see your cash position"
- Time-based greeting logic:
  - 5am-11am: "Good morning!"
  - 11am-5pm: "Good afternoon!"
  - 5pm-9pm: "Good evening!"
  - 9pm-5am: "Burning the midnight oil? Your dedication is impressive."
- Responsive layout:
  - Mobile: Single column
  - Tablet: Two columns
  - Desktop: Three columns or dashboard grid
- Real-time updates:
  - Cash position updates when transactions change
  - Recent transactions refresh automatically

**Technical Notes:**
- Dashboard must load in <1 second
- Cash position calculation from chart of accounts (sum of Cash and Bank account types)
- Query optimization for recent transactions (limit 10, order by date desc)
- Empty state handling for new users
- Lazy loading for non-critical widgets
- Cache dashboard data with refresh on transaction changes

**Spec Reference:** PFD-002

---

### B4. DISC Profile Storage & Retrieval [MVP]
**What:** Store and retrieve user's DISC profile for communication adaptation.

**Dependencies:** {A1: Database Schema, A4: Authentication & Session Management}

**Joy Opportunity:** "We'll remember how you like to communicate. No judgment, just understanding."

**Deliverables:**
- DISC profile data model:
  - User ID (foreign key to user)
  - Dominance score (0-100)
  - Influence score (0-100)
  - Steadiness score (0-100)
  - Conscientiousness score (0-100)
  - Primary style (D, I, S, or C - highest score)
  - Secondary style (second highest score)
  - Manual override flag (user can opt out)
  - Assessment completion date
  - Last updated timestamp
- Profile storage API:
  - Create profile (after assessment in Group C)
  - Update profile
  - Retrieve profile by user ID
  - Delete profile (reset to default)
- Default profile handling:
  - If no profile exists, default to Steadiness-style (S)
  - Steadiness is patient, step-by-step, reassuring
- Manual override capability:
  - User setting to disable DISC adaptation
  - Falls back to Steadiness-style default
  - Clear explanation of what this means
- Profile retrieval for message selection:
  - Fast lookup (<10ms)
  - Cached in session for performance
  - Used by message variant system (B5)

**Technical Notes:**
- Profile data encrypted at rest
- Profile associated with user account
- Default profile constants defined (Steadiness: S=100, D=25, I=25, C=25)
- Profile must be available even if assessment not yet completed
- Support for future: team member profiles in multi-user accounts
- Validation: scores must sum to reasonable range (allow flexibility for future scoring adjustments)

**Spec Reference:** ONB-004

---

### B5. Message Variant System [MVP]
**What:** Infrastructure for serving DISC-adapted messages throughout the app.

**Dependencies:** {B4: DISC Profile Storage}

**Joy Opportunity:** Users won't consciously notice it, but everything will feel right. That's the real delight - feeling understood.

**Deliverables:**
- Message template system:
  - Message ID (unique identifier for each message point)
  - Message variants (4 per message):
    - D variant: Direct, bottom-line, results-oriented
    - I variant: Enthusiastic, social, encouraging
    - S variant: Patient, step-by-step, reassuring (default)
    - C variant: Detailed, accurate, analytical
  - Fallback message (if variant missing)
- Message catalog structure:
  - JSON or database table of all messages
  - Organized by feature/context
  - Version tracking for updates
- DISC-based message selection:
  - Input: Message ID, User's DISC profile
  - Output: Appropriate message variant
  - Selection algorithm:
    - Use primary style variant if available
    - Fall back to secondary style if primary missing
    - Fall back to Steadiness variant if both missing
    - Fall back to default message if all missing
- Message preview system (for testing):
  - View all 4 variants side-by-side
  - Test with different profiles
  - Identify missing variants
- Initial message coverage:
  - Error messages (>95% coverage)
  - Success messages (>95% coverage)
  - Empty states (>90% coverage)
  - Onboarding prompts (100% coverage)
  - Help tooltips (>80% coverage)
- Message API:
  - `getMessage(messageId, userId)` - returns appropriate variant
  - `getMessagePreview(messageId)` - returns all 4 variants for testing
  - `addMessage(messageId, variants)` - add new message to catalog
  - `updateMessage(messageId, variants)` - update existing message

**Technical Notes:**
- Message catalog stored in database or JSON config
- Message lookup must be fast (<10ms)
- Cache frequently used messages in memory
- Support for dynamic message interpolation (e.g., "Welcome back, {name}!")
- Logging for missing variants (identify gaps)
- Support for future: A/B testing of variants

**Example Messages:**

**Success: First Transaction Recorded**
- D: "Done. Transaction recorded. What's next?"
- I: "Woohoo! You just recorded your first transaction! You're doing great!"
- S: "You just recorded your first transaction! You're officially doing bookkeeping. (And you didn't even need an accounting degree!)"
- C: "Transaction successfully recorded. Entry ID: T-001. Date: [date]. Amount: [amount]. Category: [category]. All fields validated and saved."

**Error: Transaction Doesn't Balance**
- D: "Transaction doesn't balance. Fix debits/credits and try again."
- I: "Oops! This one's a bit off-balance. Let's adjust those numbers!"
- S: "Oops! Something unexpected happened. Don't worry - your data is safe. The debits and credits don't quite match up. Let's adjust the amounts and try again."
- C: "Validation error: Transaction not balanced. Debits: $[amount]. Credits: $[amount]. Difference: $[amount]. Please adjust entries to balance before saving."

**Spec Reference:** ONB-004

---

### B6. Sync Relay Client [MVP]
**What:** Client-side logic for syncing encrypted data to relay servers.

**Dependencies:** {A2: Encryption Layer, A3: Local-First Data Store}

**Joy Opportunity:** Sync indicator is a small, calm pulse when syncing. When complete: a tiny sparkle. Never stressful spinners. If sync happens fast, show "Synced in a snap!"

**Deliverables:**
- Sync queue management:
  - Track local changes (creates, updates, deletes)
  - Queue changes for sync
  - Prioritize sync order (critical changes first)
  - Batch changes for efficiency
- Encrypted payload preparation:
  - Serialize local changes to JSON
  - Encrypt payload with user's encryption key (from A2)
  - Add metadata: timestamp, device ID, user ID
  - Compress payload (optional, if size >10KB)
- Push operation:
  - Send encrypted payload to relay server
  - Retry on failure (exponential backoff)
  - Track sync status (pending, in-progress, synced, failed)
  - Handle server responses (success, conflict, error)
- Pull operation:
  - Request changes from relay server
  - Download encrypted payloads
  - Decrypt payloads
  - Deserialize JSON
  - Apply changes to local database
- Conflict detection:
  - Compare timestamps for same record
  - Use CRDT metadata for resolution strategy
  - Flag conflicts for user review (if needed)
  - Automatic merge for simple conflicts
  - Manual merge UI for complex conflicts (Group I)
- Retry logic with exponential backoff:
  - Initial retry: 1 second
  - Subsequent retries: 2s, 4s, 8s, 16s, 32s
  - Max retries: 5 attempts
  - Notify user after max retries
- Sync status indicators:
  - States: Offline, Syncing, Synced, Error
  - Visual indicators:
    - Offline: Gray cloud icon
    - Syncing: Animated pulse (blue)
    - Synced: Green checkmark with tiny sparkle
    - Error: Red warning icon
  - Tooltip shows last sync time
- Network status monitoring:
  - Detect online/offline state
  - Pause sync when offline
  - Resume sync when back online
  - Queue changes while offline
- Sync settings:
  - Auto-sync on/off (default: on)
  - Sync frequency (default: real-time)
  - Wifi-only option (for mobile)

**Technical Notes:**
- Sync relay server API:
  - POST /sync/push - upload encrypted changes
  - GET /sync/pull?since=[timestamp] - download changes
  - GET /sync/status - check relay health
- Payload format:
  ```json
  {
    "deviceId": "uuid",
    "userId": "uuid",
    "timestamp": "ISO8601",
    "changes": [
      {
        "id": "record-uuid",
        "table": "transactions",
        "operation": "create|update|delete",
        "data": "encrypted-blob",
        "version": 1
      }
    ]
  }
  ```
- Encryption: AES-256-GCM for each change blob
- Performance target: Sync 100 transactions in <2 seconds
- Conflict resolution: Prefer last-write-wins for most data (CRDT for complex types in ARCH-004)
- Audit trail: Log all sync operations
- Error handling: Distinguish network errors from server errors from conflict errors

**Spec Reference:** ARCH-003

---

### B7. Charity Selection [MVP]
**What:** Allow users to select their charitable cause during signup/onboarding.

**Dependencies:** {A1: Database Schema, A4: Authentication & Session Management}

**Joy Opportunity:** "Part of your subscription helps others. Choose a cause close to your heart." After selection: "You've chosen to support [Charity Name]. Every month, $5 of your subscription goes directly to them."

**Deliverables:**
- Charity data model:
  - Charity ID
  - Charity name
  - Description (mission statement)
  - Logo/image URL
  - Website URL
  - Category (Education, Health, Environment, Social Justice, etc.)
  - Active/inactive status
  - Order/priority for display
- User charity selection model:
  - User ID (foreign key)
  - Selected charity ID (foreign key)
  - Selection date
  - Last changed date
  - Monthly change count (track frequency)
- Charity list display:
  - Card layout with charity logos
  - Charity name and brief description
  - "Learn more" link to charity website
  - Selection radio button or card selection
  - Filter by category (optional)
- Selection flow during onboarding:
  - Show charity list after account creation
  - Required step (cannot skip)
  - Confirmation message after selection
  - Option to change later (in settings)
- Change selection capability:
  - Available in user settings
  - Monthly limit enforced (prevent frequent changes)
  - Confirmation dialog before changing
  - Message: "You can change your charity selection once per month. Current selection: [Charity]. Are you sure you want to change to [New Charity]?"
- Charity selection storage:
  - Save to user profile
  - Track change history (for analytics)
  - Encrypted storage
- Link to learn more:
  - External link to charity website
  - Opens in new tab
  - Disclaimer: "You're leaving Graceful Books to visit [Charity]. We don't control their website."
- Annual contribution summary (for user):
  - Show in user profile/settings
  - Message: "In [Year], your subscription contributed $60 to [Charity Name]. Thank you for making a difference!"
  - Link to public transparency page

**Technical Notes:**
- Initial charity list (5-7 charities):
  - Education (e.g., First Book, DonorsChoose)
  - Health (e.g., Doctors Without Borders, American Cancer Society)
  - Environment (e.g., The Nature Conservancy, Ocean Conservancy)
  - Social Justice (e.g., ACLU, Southern Poverty Law Center)
  - Poverty Relief (e.g., Feeding America, Habitat for Humanity)
  - User choice of focus area
- Admin capability to manage charity list (add/remove/update) - simple admin panel
- Validation: User cannot select inactive charity
- Monthly change limit: Track `last_changed_date`, prevent changes if <30 days
- Public transparency page (simple, static for MVP):
  - Total donated to date (across all users)
  - Breakdown by charity
  - Number of supporters per charity
  - Updated monthly
- Future: User badge as supporter (optional display)

**Spec Reference:** CHARITY-001

---

## Implementation Notes

### Recommended Sequencing
While all tasks can be done in parallel, this logical sequence may be efficient:

**Phase 1 (Core Data):**
1. B1: Chart of Accounts - Basic CRUD
2. B4: DISC Profile Storage & Retrieval

**Phase 2 (User Experience):**
3. B2: Transaction Entry - Basic
4. B5: Message Variant System
5. B7: Charity Selection

**Phase 3 (Infrastructure & Integration):**
6. B6: Sync Relay Client
7. B3: Dashboard - Simplified (integrates transactions and COA)

### Testing Requirements
- Chart of accounts supports 500+ accounts without performance degradation
- Transaction entry validates all double-entry balancing
- Dashboard loads in <1 second with 1000+ transactions
- DISC profile retrieval <10ms
- Message variant selection covers >95% of system messages
- Sync client handles network interruptions gracefully
- Charity selection change limit enforced (monthly)
- All UIs are accessible (WCAG 2.1 AA)

### Integration Points
- Chart of accounts used by transaction entry for category selection
- Transactions displayed on dashboard
- DISC profile used by message variant system
- Message variants used throughout all UIs
- Sync client syncs all data models (accounts, transactions, profiles, selections)
- Dashboard integrates with routing for quick actions

### Success Criteria
- Chart of accounts creation >90% completion
- First transaction within 24 hours >70%
- Sync success rate >99.5%
- DISC message variant coverage >95%
- Charity selection completion >85%
- Dashboard engagement >60% daily visits
- Zero data loss in sync operations
- Transaction entry time <90 seconds average
