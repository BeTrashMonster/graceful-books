# Capability Spec: Chart of Accounts

## Overview
The `chart-of-accounts` capability provides account management and Chart of Accounts (COA) structure for the accounting system. It enables users to create, manage, and organize their accounts in a hierarchical structure following GAAP principles, while presenting everything in plain English.

## ADDED Requirements

## Requirements Reference
**Spec Reference:** ACCT-001

## Functional Requirements

### Account Management
- **Create accounts** with wizard guidance
  - Account type selection (Assets, Liabilities, Equity, Income, COGS, Expenses, Other Income/Expense)
  - Sub-type selection (Current Assets, Fixed Assets, Current Liabilities, Long-term Liabilities, etc.)
  - Account name input with validation (required, max 100 characters)
  - Optional account number (customizable numbering scheme)
  - Optional parent account for sub-accounts (unlimited depth)
  - Description and notes fields
  - Opening balance (for initial setup)

- **Read/View accounts**
  - Hierarchical list view with parent/child indentation
  - Account details view
  - Filter by account type
  - Filter by active/inactive status
  - Search by name or number
  - Sort by name, number, or type

- **Update accounts**
  - Edit account name
  - Edit account number
  - Edit description and notes
  - Change parent account (with validation)
  - Cannot change account type (would break transaction history)

- **Delete accounts**
  - Soft delete (mark inactive rather than hard delete)
  - Dependency checking - prevent deletion if:
    - Account has transactions
    - Account has sub-accounts
  - Confirmation dialog before deletion

### Account Types & Structure
- **GAAP-compliant account types:**
  - **Assets:** Things the business owns
    - Current Assets: Cash, bank accounts, accounts receivable, inventory
    - Fixed Assets: Equipment, vehicles, buildings
    - Other Assets: Long-term investments, intangible assets
  - **Liabilities:** Money the business owes
    - Current Liabilities: Accounts payable, credit cards, short-term loans
    - Long-term Liabilities: Mortgages, long-term loans
  - **Equity:** Owner's stake in the business
    - Owner's Equity, Retained Earnings, Distributions
  - **Income/Revenue:** Money coming in
    - Service Income, Product Sales, Other Income
  - **Cost of Goods Sold (COGS):** Direct costs of products/services
    - Materials, Direct Labor, Shipping Costs
  - **Expenses:** Operating costs
    - Rent, Utilities, Salaries, Marketing, Office Supplies, etc.
  - **Other Income/Expense:** Non-operating items
    - Interest Income, Interest Expense, Gains/Losses

- **Plain English descriptions** for every account type
  - "Assets are things your business owns"
  - "Accounts Receivable means money customers owe you"
  - "Accounts Payable means money you owe to vendors"
  - "Retained Earnings are profits kept in the business over time"

### Templates
- **Pre-built industry templates:**
  - "The Freelancer's Friend" - Service business template
  - "Shopkeeper's Starter Kit" - Product/retail business template
  - "The Hybrid Helper" - Mixed service and product business
  - Custom template option (start from scratch)

- **Template features:**
  - Pre-populated with common accounts for industry
  - User can accept all, remove unwanted, or add custom
  - Educational tooltips explain each suggested account
  - Template selection during initial setup

### Account Numbering
- **Customizable numbering schemes:**
  - Optional account numbers
  - Standard numbering convention (e.g., 1000-1999 Assets, 2000-2999 Liabilities, etc.)
  - Auto-suggest next available number
  - Manual override allowed
  - Validation prevents duplicate numbers

### Sub-Accounts
- **Unlimited hierarchy depth:**
  - Parent-child relationships
  - Example:
    - Cash (parent)
      - Checking Account (child)
      - Savings Account (child)
      - Petty Cash (child)
  - Visual indentation in list view
  - Roll-up balances to parent (parent balance = sum of children)
  - Prevent circular references (account cannot be its own ancestor)

### Active/Inactive Status
- **Account lifecycle management:**
  - Active accounts: Available for transaction entry
  - Inactive accounts: Hidden from dropdowns, still visible in reports for historical data
  - Toggle status with confirmation
  - Cannot inactivate if has active sub-accounts
  - Cannot delete, only inactivate (preserves data integrity)

## Technical Requirements

### Data Model
```javascript
Account {
  id: UUID (primary key)
  name: String (required, max 100 chars)
  type: Enum [Asset, Liability, Equity, Income, COGS, Expense, OtherIncome, OtherExpense]
  subType: String (e.g., "Current Assets", "Fixed Assets")
  number: String (optional, unique)
  parentId: UUID (foreign key to Account, optional)
  description: String (max 500 chars)
  notes: Text (unlimited)
  isActive: Boolean (default true)
  openingBalance: Decimal (default 0)
  createdAt: DateTime
  updatedAt: DateTime
  createdBy: UUID (foreign key to User)
}
```

### Storage
- **Encrypted at rest** using encryption layer from Group A
- **Local-first** storage in IndexedDB (Group A data store)
- **Indexed fields:** id, type, number, parentId, isActive
- **Sync enabled** via Group B sync relay client

### Performance
- **Load time:** Chart of accounts with 500 accounts loads in <200ms
- **Search performance:** Search by name/number returns results in <50ms
- **Hierarchy calculation:** Parent-child relationships resolved in <100ms

### Validation
- **Account name:** Required, 1-100 characters, unique within same parent
- **Account type:** Must be valid enum value, cannot change after creation
- **Account number:** If provided, must be unique across all accounts
- **Parent account:**
  - Must be same account type
  - Cannot create circular reference
  - Cannot be self
- **Deletion:** Cannot delete if has transactions or active sub-accounts

## User Interface

### Account Creation Wizard
1. **Step 1: Account Type Selection**
   - Visual cards for each account type
   - Plain English title and description
   - Icon for each type
   - "What is this?" tooltip with detailed explanation

2. **Step 2: Account Details**
   - Name input (with helpful examples)
   - Optional number input (with auto-suggest)
   - Optional parent account dropdown (only shows accounts of same type)
   - Description field (with prompts)

3. **Step 3: Confirmation**
   - Review all entered information
   - "Create Account" button
   - Success message: "Your first account! This is where the magic of organization begins."

### Account List View
- **Hierarchical tree display:**
  - Parent accounts bold
  - Child accounts indented
  - Expand/collapse parent accounts
  - Visual hierarchy indicators (└─, ├─)

- **Columns:**
  - Account Number (if using numbers)
  - Account Name
  - Account Type
  - Balance (current)
  - Status (Active/Inactive)
  - Actions (Edit, Activate/Deactivate)

- **Filters & Search:**
  - Filter dropdown: All Types, Assets, Liabilities, etc.
  - Status filter: All, Active, Inactive
  - Search bar: Search by name or number
  - Sort options: Name, Number, Type, Balance

### Account Edit Form
- All fields editable except Account Type
- "Save Changes" button
- "Cancel" button
- Confirmation for significant changes

### Template Selection
- **During initial setup:**
  - "Choose a starting point" screen
  - Visual cards for each template
  - Template preview (list of accounts included)
  - "Start from Scratch" option
  - Educational content: "Templates give you common accounts for your business type. You can add, remove, or modify any account."

## Dependencies

### Requires (from Group A)
- `data-store` - Local storage and CRUD operations
- `encryption` - Data encryption at rest
- `ui-components` - Forms, lists, wizards, buttons, cards
- `routing` - Navigation to account management pages

### Provides to (Group B and beyond)
- Account data for transaction categorization (B2)
- Account list for dashboard cash position calculation (B3)
- Account structure for reporting (Group D)
- Account hierarchy for financial statements (Group D)

## Success Metrics
- Chart of accounts creation completion rate >90%
- Average setup time <10 minutes (with template)
- User can find and select correct account >95% of time
- Template usage rate >70% (vs. starting from scratch)
- Account hierarchy usage >50% (at least one sub-account)

## Plain English Examples

### Account Type Descriptions
- **Assets:** "Things your business owns - cash, equipment, money owed to you"
- **Liabilities:** "Money your business owes - credit cards, loans, bills to pay"
- **Equity:** "Your stake in the business - what's left after subtracting liabilities from assets"
- **Income:** "Money coming into your business from sales and services"
- **Cost of Goods Sold:** "Direct costs to make or buy what you sell"
- **Expenses:** "Operating costs to run your business - rent, utilities, supplies"

### Common Account Names & Descriptions
- **Checking Account** → "Your main business bank account"
- **Accounts Receivable** → "Money customers owe you for work you've done"
- **Accounts Payable** → "Bills you need to pay to vendors and suppliers"
- **Owner's Equity** → "Money you've invested in your business"
- **Service Income** → "Money earned from services you provide"
- **Rent Expense** → "Cost of your office or workspace"
- **Office Supplies** → "Pens, paper, printer ink, and other supplies"

## Accessibility
- All wizard steps keyboard navigable
- Screen reader labels for all form fields
- Color is not the only indicator of account type
- Focus indicators visible on all interactive elements
- WCAG 2.1 AA compliance

## Error Handling
- **Duplicate account name:** "An account with this name already exists under [Parent]. Try a different name or add details to make it unique."
- **Circular reference:** "An account can't be its own parent or grandparent. Choose a different parent account."
- **Delete with transactions:** "This account can't be deleted because it has transactions. You can make it inactive instead."
- **Invalid account type change:** "Account type can't be changed after creation because it would affect your transaction history."

## Future Enhancements (Beyond Group B)
- Import chart of accounts from CSV
- Export chart of accounts to Excel/CSV
- Bulk edit operations
- Account merge functionality
- Account archiving (vs. inactive)
- Custom account type fields
- Account tags for additional categorization
