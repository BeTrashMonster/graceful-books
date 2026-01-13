# Change Proposal: Basic Features (The Frame)

## Why

Group B represents "The Frame" - building the core accounting functionality on top of the infrastructure laid in Group A (The Bedrock). This change transforms the foundational infrastructure (database, encryption, local-first storage, authentication, UI components, and routing) into a working accounting system with basic features.

This phase enables users to:
- Create and manage their chart of accounts
- Enter and track transactions (income and expenses)
- View a simplified dashboard with key financial metrics
- Store their DISC communication profile for personalized messaging
- Sync encrypted data across devices via relay client
- Select a charitable cause to support

Group B is critical for MVP launch as it builds the "frame" of the accounting house - the essential structure that all subsequent features will build upon. Without Group B, we have infrastructure but no usable product.

**Dependencies:**
- Group A must be complete (database schema, encryption, local-first data store, authentication, UI components, application shell & routing)

## Roadmap Reference

**Phase:** Phase 1: The Foundation
**Group:** Group B - The Frame
**Roadmap Items:** B1-B7 (Chart of Accounts - Basic CRUD, Transaction Entry - Basic, Dashboard - Simplified, DISC Profile Storage & Retrieval, Message Variant System, Sync Relay Client, Charity Selection)
**Roadmap Location:** [Roadmaps/ROADMAP.md - Phase 1, Group B](../../Roadmaps/ROADMAP.md#group-b-the-frame)
**Priority:** MVP

## What Changes

This change implements 7 major features organized as Group B in the ROADMAP:

### B1. Chart of Accounts - Basic CRUD
Create, read, update, and manage accounts with account creation wizard, list view, editing, active/inactive toggling, and plain English descriptions for every account type.

### B2. Transaction Entry - Basic
Enter income and expenses with proper double-entry accounting hidden from users. Simple income/expense entry with date, amount, description, and category. Auto-balancing hides debits/credits from beginners.

### B3. Dashboard - Simplified
Home screen that orients users and shows key information at a glance including cash position, recent transactions, quick actions, and getting started prompts.

### B4. DISC Profile Storage & Retrieval
Store and retrieve user's DISC profile for communication adaptation throughout the application, with manual override capability.

### B5. Message Variant System
Infrastructure for serving DISC-adapted messages throughout the app with 4 variants per message, DISC-based selection, and fallback handling.

### B6. Sync Relay Client
Client-side logic for syncing encrypted data to relay servers with sync queue management, encrypted payload preparation, conflict detection, retry logic with exponential backoff, and sync status indicators.

### B7. Charity Selection
Allow users to select their charitable cause during signup/onboarding, with selection storage in user profile, monthly change capability, and confirmation of choice.

## Capabilities

### New Capabilities

#### `chart-of-accounts`
**Purpose:** Account management and Chart of Accounts structure

**Components:**
- Account creation wizard with guidance
- Account CRUD operations (create, read, update, delete)
- Account list view with filtering
- Account types (Assets, Liabilities, Equity, Income, COGS, Expenses, Other)
- Sub-account support (unlimited depth)
- Active/inactive status toggling
- Account numbering (customizable scheme)
- Plain English descriptions for every account type
- Pre-built templates ("The Freelancer's Friend", "Shopkeeper's Starter Kit")

**Dependencies:**
- `data-store` (from Group A) - local storage and CRUD operations
- `encryption` (from Group A) - data encryption at rest
- `ui-components` (from Group A) - forms, lists, wizards
- `routing` (from Group A) - navigation to account management

#### `transactions`
**Purpose:** Basic transaction entry and management

**Components:**
- Simple income entry form
- Simple expense entry form
- Transaction data model (date, amount, description, category/account)
- Auto-balancing double-entry behind the scenes
- Transaction list view with filtering
- Hide debits/credits from beginners
- Transaction editing and deletion (with audit trail)
- Validation and error handling

**Dependencies:**
- `chart-of-accounts` - account selection for categorization
- `data-store` (from Group A) - transaction persistence
- `encryption` (from Group A) - transaction data encryption
- `ui-components` (from Group A) - forms and lists

#### `dashboard`
**Purpose:** User dashboard and overview screen

**Components:**
- Cash position display with visual indicator
- Recent transactions list (last 5-10)
- Quick action buttons (new transaction, new invoice)
- Getting started prompts for new users
- Empty state messaging with encouragement
- Time-based greeting ("Good morning! Let's see how your business is doing today")
- Responsive layout for all screen sizes

**Dependencies:**
- `transactions` - display recent transactions
- `chart-of-accounts` - cash account balance calculation
- `ui-components` (from Group A) - cards, charts, buttons
- `routing` (from Group A) - quick action navigation

#### `disc-profile`
**Purpose:** DISC personality adaptation system

**Components:**
- DISC profile data model (Dominance, Influence, Steadiness, Conscientiousness scores)
- Profile storage per user
- Profile retrieval for message adaptation
- Manual override capability in settings
- Default profile handling (Steadiness-style as default)
- Profile update and persistence

**Dependencies:**
- `data-store` (from Group A) - profile storage
- `encryption` (from Group A) - profile data encryption
- `auth` (from Group A) - user association

#### `message-variants`
**Purpose:** DISC-adapted messaging infrastructure

**Components:**
- Message template system with 4 variants per message:
  - D (Dominance): Direct, results-oriented
  - I (Influence): Enthusiastic, social
  - S (Steadiness): Patient, step-by-step
  - C (Conscientiousness): Detailed, analytical
- DISC-based message selection algorithm
- Fallback handling for missing variants
- Message preview for testing/debugging
- Message catalog with IDs for all system messages

**Dependencies:**
- `disc-profile` - user profile for variant selection
- Available throughout app for all user-facing messages

#### `sync-client`
**Purpose:** Sync relay client for multi-device data synchronization

**Components:**
- Sync queue management (outgoing changes)
- Encrypted payload preparation
- Conflict detection using timestamps and CRDT metadata
- Retry logic with exponential backoff
- Sync status indicators (syncing, synced, offline, error)
- Push and pull operations
- Batch sync for efficiency
- Network status monitoring

**Dependencies:**
- `encryption` (from Group A) - payload encryption
- `data-store` (from Group A) - local data access
- Sync relay server (deployed separately)

#### `charity-selection`
**Purpose:** Charitable cause selection and management

**Components:**
- Charity list display during onboarding
- Charity selection storage in user profile
- Monthly change capability (not more frequent)
- Confirmation message after selection
- Link to learn more about each charity
- Annual contribution summary (for user's records)

**Dependencies:**
- `data-store` (from Group A) - selection storage
- `auth` (from Group A) - user association
- `ui-components` (from Group A) - selection interface

## Impact

### User Experience
- **First accounting features:** Users can now create accounts and enter transactions
- **Personalized communication:** DISC-adapted messages feel natural and supportive
- **Data everywhere:** Sync enables multi-device access to encrypted data
- **Social impact:** Users feel good knowing part of their subscription helps others
- **Welcoming dashboard:** Clear starting point with encouraging empty states

### Business Value
- **Enables MVP launch:** Group B completion unlocks all core accounting workflows
- **Foundation for growth:** Chart of accounts and transactions are the backbone
- **Differentiation:** DISC adaptation and charity selection set product apart
- **Multi-device readiness:** Sync infrastructure enables mobile/tablet future
- **Reduces support burden:** Plain English and adapted messaging prevent confusion

### Technical
- **Modular architecture:** Each capability is independently testable and deployable
- **Encryption throughout:** Zero-knowledge maintained from storage through sync
- **Performance:** Transaction entry completes in <500ms including encryption
- **Scalability:** Chart of accounts and transactions support 10,000+ entries
- **Offline-first:** All core features work without network connection

### Dependencies Unlocked
Group B completion enables Group C (The Walls) features:
- C1: Assessment Engine (requires B4 DISC profile, B5 message variants)
- C2: Assessment UI (requires B5 message variants)
- C3: Checklist Generation (requires B4 profile storage)
- C4: Checklist UI (requires B3 dashboard for integration)
- C5: Phase-Based Feature Visibility (requires routing and dashboard)
- C6: Client/Customer Management (requires chart of accounts, transactions)
- C7: Invoice Creation (requires chart of accounts, transactions)
- C8: Receipt Capture (requires transactions for linking)

## Success Metrics

- Chart of accounts creation completion rate >90%
- First transaction entry within 24 hours >70%
- Average transaction entry time <90 seconds
- Sync success rate >99.5% (excluding network failures)
- DISC message variant coverage >95% of all system messages
- Charity selection completion during onboarding >85%
- Dashboard engagement (daily visits) >60% of active users

## Risk & Mitigation

**Risk:** Chart of accounts setup feels overwhelming to beginners
**Mitigation:** Pre-built templates, plain English descriptions, wizard flow with educational tooltips, optional guided setup in Group C/D

**Risk:** Double-entry accounting errors in auto-balancing
**Mitigation:** Comprehensive unit tests for all transaction types, validation layer prevents unbalanced entries, audit log tracks all changes

**Risk:** Sync conflicts cause data loss or corruption
**Mitigation:** CRDT-based conflict resolution, full audit trail, conflict history view, user notification for significant merges

**Risk:** DISC profiling feels invasive or gimmicky
**Mitigation:** Optional feature, default Steadiness-style tone works for all, clear explanation of benefit, manual override available

**Risk:** Charity selection feels forced or manipulative
**Mitigation:** Clear explanation during onboarding, genuine partnerships with reputable charities, transparent reporting of contributions
