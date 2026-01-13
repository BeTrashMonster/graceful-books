# Capability Spec: Transactions

## Overview
The `transactions` capability provides basic transaction entry and management for recording income and expenses. It implements proper double-entry accounting behind the scenes while presenting a simplified interface that hides debits and credits from beginners.

## ADDED Requirements

## Requirements Reference
**Spec Reference:** ACCT-005, PFD-002

## Functional Requirements

### Transaction Entry
- **Simple Income Entry:**
  - Date selection (defaults to today)
  - Amount input (positive numbers only, currency format)
  - Description/memo field
  - Category selection (income accounts from chart of accounts)
  - Bank/cash account selection (where money is deposited)
  - "Record it!" button

- **Simple Expense Entry:**
  - Date selection (defaults to today)
  - Amount input (positive numbers only, currency format)
  - Description/memo field
  - Category selection (expense accounts from chart of accounts)
  - Bank/cash account selection (where money is withdrawn)
  - "Record it!" button

- **Auto-Balancing Logic:**
  - System automatically creates double-entry journal entries
  - Income transaction:
    - Debit: Bank/Cash account (increases asset)
    - Credit: Income account (increases revenue)
  - Expense transaction:
    - Debit: Expense account (increases expense)
    - Credit: Bank/Cash account (decreases asset)
  - Validation ensures debits always equal credits
  - User never sees "debit" or "credit" terminology in UI

### Transaction Management
- **Transaction List View:**
  - Display all transactions in reverse chronological order
  - Columns: Date, Description, Category, Amount, Account, Status
  - Filter by:
    - Date range (preset ranges: This Week, This Month, This Quarter, This Year, Custom)
    - Transaction type (All, Income, Expense)
    - Account
    - Category
    - Status (All, Posted, Draft)
  - Search by description (full-text search)
  - Sort by date, amount, description, category
  - Pagination (50 transactions per page)

- **Transaction Details:**
  - View full transaction details
  - Show created date and user
  - Show last modified date and user
  - Show underlying journal entries (advanced view, hidden by default)
  - Link to related documents (receipts in Group C)

- **Transaction Editing:**
  - Edit date, amount, description, category, account
  - Recalculate balancing journal entries automatically
  - Track changes in audit log
  - Confirmation dialog for significant changes
  - Warning if editing transaction from previous closed period (future feature)

- **Transaction Deletion:**
  - Soft delete (mark as void, don't actually delete)
  - Confirmation dialog: "Are you sure you want to delete this transaction? This cannot be undone."
  - Show voided transactions in list (grayed out, with "VOID" label)
  - Preserve in audit trail
  - Option to permanently delete voided transactions (admin only, with extra confirmation)

### Transaction Types
- **Income:** Money coming in
  - Examples: Client payment, product sale, interest income
  - Increases bank account, increases income account

- **Expense:** Money going out
  - Examples: Rent payment, office supplies, utilities
  - Decreases bank account, increases expense account

- **Transfer:** Money moving between accounts (future feature in Group D)
  - Example: Transfer from checking to savings
  - Decreases source account, increases destination account

### Transaction Status
- **Draft:** Transaction saved but not posted
  - Can be edited freely
  - Not included in reports
  - Use case: Recording transaction details for later completion

- **Posted:** Transaction recorded and final
  - Included in reports and balances
  - Can be edited with audit trail
  - Default status for new transactions

### Validation & Safeguards
- **Required fields:**
  - Date (required)
  - Amount (required, must be positive)
  - Description (required, min 3 characters)
  - Category account (required)
  - Bank/cash account (required)

- **Amount validation:**
  - Must be positive number
  - Maximum 2 decimal places
  - Maximum value: $999,999,999.99
  - Minimum value: $0.01
  - Warning for unusually large amounts (>$10,000)

- **Date validation:**
  - Cannot be more than 1 year in the future
  - Warning if more than 90 days in the past
  - Date picker defaults to today

- **Account validation:**
  - Category must be appropriate type (Income for income transactions, Expense for expense transactions)
  - Bank/cash account must be Asset type (Cash or Bank)
  - Cannot select inactive accounts

## Technical Requirements

### Data Models

#### Transaction Model
```javascript
Transaction {
  id: UUID (primary key)
  date: Date (required)
  description: String (required, max 200 chars)
  amount: Decimal (required, precision 2)
  type: Enum [Income, Expense, Transfer]
  sourceAccountId: UUID (foreign key to Account - bank/cash)
  destinationAccountId: UUID (foreign key to Account - category)
  status: Enum [Draft, Posted, Void]
  createdAt: DateTime
  updatedAt: DateTime
  createdBy: UUID (foreign key to User)
  modifiedBy: UUID (foreign key to User)
  voidedAt: DateTime (nullable)
  voidedBy: UUID (foreign key to User, nullable)
}
```

#### Transaction Line Model (Journal Entries)
```javascript
TransactionLine {
  id: UUID (primary key)
  transactionId: UUID (foreign key to Transaction)
  accountId: UUID (foreign key to Account)
  debitAmount: Decimal (nullable, precision 2)
  creditAmount: Decimal (nullable, precision 2)
  description: String (max 200 chars)
  lineNumber: Integer (order of lines in transaction)
  createdAt: DateTime
}
```

### Business Rules
- Every transaction must have at least 2 lines (double-entry)
- Sum of debits must equal sum of credits
- Each line has either debit OR credit (not both, not neither)
- Transaction lines automatically generated from simple entry form
- Complex multi-line entries supported for future (Group D journal entries)

### Storage
- **Encrypted at rest** using encryption layer from Group A
- **Local-first** storage in IndexedDB (Group A data store)
- **Indexed fields:** id, date, type, sourceAccountId, destinationAccountId, status, createdAt
- **Full-text search index** on description field
- **Sync enabled** via Group B sync relay client

### Performance
- **Save transaction:** <500ms including encryption and journal entry creation
- **Load transaction list:** <200ms for 50 transactions
- **Search:** <100ms for full-text search across 1000 transactions
- **Filter/sort:** <50ms for client-side operations
- **Balance calculation:** <100ms for account balance (sum of all transaction lines)

## User Interface

### Income Entry Form
```
┌─────────────────────────────────────┐
│  Record Income                      │
├─────────────────────────────────────┤
│  Date:  [📅 01/10/2026]            │
│         (Today)                     │
│                                     │
│  Amount: $ [________]               │
│                                     │
│  Description:                       │
│  [_____________________________]    │
│  (e.g., "Payment from Client ABC")  │
│                                     │
│  Category:                          │
│  [Service Income ▼]                 │
│  (What type of income?)             │
│                                     │
│  Deposit To:                        │
│  [Business Checking ▼]              │
│  (Which bank account?)              │
│                                     │
│  [Cancel]  [Record it!] ←          │
└─────────────────────────────────────┘
```

### Expense Entry Form
```
┌─────────────────────────────────────┐
│  Record Expense                     │
├─────────────────────────────────────┤
│  Date:  [📅 01/10/2026]            │
│         (Today)                     │
│                                     │
│  Amount: $ [________]               │
│                                     │
│  Description:                       │
│  [_____________________________]    │
│  (e.g., "Office supplies at Staples")│
│                                     │
│  Category:                          │
│  [Office Supplies ▼]                │
│  (What did you spend on?)           │
│                                     │
│  Paid From:                         │
│  [Business Checking ▼]              │
│  (Which account did you pay from?)  │
│                                     │
│  [Cancel]  [Record it!] ←          │
└─────────────────────────────────────┘
```

### Transaction List View
```
┌──────────────────────────────────────────────────────────┐
│  Transactions                                   [+ New ▼] │
├──────────────────────────────────────────────────────────┤
│  Filters: [This Month ▼] [All Types ▼] [🔍 Search...]   │
│                                                           │
│  Date       Description        Category        Amount    │
│  ────────────────────────────────────────────────────── │
│  01/10/26   Payment from ABC   Service Income  $1,500   │
│  01/09/26   Office supplies    Office Supplies   $47    │
│  01/08/26   Rent payment        Rent Expense   $1,200   │
│  01/05/26   Product sale        Product Sales    $350   │
│  01/03/26   VOID - Duplicate    Office Supplies   $25   │
│  ────────────────────────────────────────────────────── │
│  Showing 1-5 of 47 transactions          [1] 2 3 ... 10 │
└──────────────────────────────────────────────────────────┘
```

### Success Message (DISC-adapted via B5)
After saving first transaction:
- **D variant:** "Done. Transaction recorded. What's next?"
- **I variant:** "Woohoo! You just recorded your first transaction! You're doing great!"
- **S variant:** "You just recorded your first transaction! You're officially doing bookkeeping. (And you didn't even need an accounting degree!)"
- **C variant:** "Transaction successfully recorded. Entry ID: T-001. Date: 01/10/2026. Amount: $1,500.00. Category: Service Income. All fields validated and saved."

## Dependencies

### Requires (from Group B)
- `chart-of-accounts` - Account selection for categorization, balance calculations
- `data-store` (from Group A) - Transaction persistence
- `encryption` (from Group A) - Transaction data encryption
- `ui-components` (from Group A) - Forms, lists, date pickers, buttons
- `message-variants` (from Group B) - DISC-adapted success/error messages

### Provides to (Group B and beyond)
- Transaction data for dashboard display (B3)
- Transaction history for account balances
- Transaction data for reports (Group D)
- Transaction data for reconciliation (Group D)

## Success Metrics
- First transaction entry within 24 hours of account creation: >70%
- Average transaction entry time: <90 seconds
- Transaction entry completion rate (started vs. saved): >95%
- Transaction edit rate: <10% (indicates initial accuracy)
- Search usage: >30% of users (finding transactions easily)

## Accessibility
- All form fields keyboard navigable
- Date picker accessible via keyboard
- Screen reader labels for all inputs
- Amount field supports currency input ($1,500 or 1500 both accepted)
- Error messages clearly associated with fields
- WCAG 2.1 AA compliance

## Error Handling

### Validation Errors
- **Amount too large:** "That's a big number! Maximum transaction amount is $999,999,999.99. Please check and try again."
- **Amount zero or negative:** "Amount must be greater than zero. Enter the amount as a positive number."
- **Missing description:** "Please add a description so you remember what this transaction was for."
- **No category selected:** "Please select a category for this transaction. This helps you understand where your money goes."
- **Transaction doesn't balance (internal error):** "Oops! Something went wrong with the accounting math. Our developers have been notified. Your data is safe - please try again."

### System Errors
- **Save failed:** "We couldn't save that transaction right now. Don't worry - we'll keep trying. Check your internet connection."
- **Load failed:** "We're having trouble loading your transactions. Checking your connection..."

## Future Enhancements (Beyond Group B)
- Recurring transactions (Group E)
- Split transactions (multiple categories in one transaction)
- Multi-currency support (Group H)
- Bulk import from CSV
- Transaction attachments (link receipts in Group C)
- Transaction tags for additional categorization
- Transaction comments/notes
- Advanced journal entries with manual debit/credit entry (Group F)
- Transaction rules (auto-categorization)
- Transaction templates
