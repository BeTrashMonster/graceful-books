# Capability Spec: Message Variants

## Overview
The `message-variants` capability provides infrastructure for serving DISC-adapted messages throughout the application. It enables personalized communication by presenting the same information in different tones based on each user's DISC personality profile, creating a more natural and comfortable user experience.

## ADDED Requirements

## Requirements Reference
**Spec Reference:** ONB-004

## Functional Requirements

### Message Template System
- **Message catalog:**
  - Centralized repository of all user-facing messages
  - Unique message ID for each message point in the application
  - Four variants per message (D, I, S, C)
  - Fallback message (used if variants missing)
  - Metadata: Category, context, usage location

- **Message variants:**
  - **D variant (Dominance):** Direct, bottom-line focused, results-oriented, concise
  - **I variant (Influence):** Enthusiastic, social, encouraging, energetic
  - **S variant (Steadiness):** Patient, step-by-step, reassuring, supportive (default)
  - **C variant (Conscientiousness):** Detailed, accurate, analytical, precise

- **Message categories:**
  - Success messages (transaction saved, account created, etc.)
  - Error messages (validation failed, network error, etc.)
  - Empty states (no transactions yet, no accounts, etc.)
  - Onboarding prompts (welcome, getting started, next steps)
  - Help tooltips (explain features, provide context)
  - Confirmation dialogs (delete, change, submit)
  - Notifications (sync complete, reminder, alert)

### Message Selection Algorithm
- **Input:** Message ID, User ID
- **Process:**
  1. Retrieve user's DISC profile (from B4)
  2. Get primary style from profile
  3. Look up message variants for message ID
  4. Select variant matching primary style
  5. If primary style variant missing, try secondary style
  6. If both missing, use Steadiness variant (default)
  7. If Steadiness variant missing, use fallback message

- **Output:** Appropriate message text

### Message API
```javascript
// Main API
getMessage(messageId: string, userId: string): string

// Additional APIs
getMessagePreview(messageId: string): MessageVariants
addMessage(messageId: string, variants: MessageVariants): void
updateMessage(messageId: string, variants: MessageVariants): void
getAllMessages(): MessageCatalog
```

### Message Preview System (for Testing)
- **Developer/admin tool:**
  - View all 4 variants side-by-side
  - Test with different DISC profiles
  - Identify missing variants
  - Preview messages in context

- **Variant completeness check:**
  - Report on variant coverage by category
  - Highlight messages missing variants
  - Prioritize by usage frequency

### Message Interpolation
- **Dynamic content insertion:**
  - Support placeholders: `{name}`, `{amount}`, `{date}`, etc.
  - Type-safe interpolation (validate placeholder types)
  - Format values appropriately (currency, dates, percentages)

- **Example:**
  ```javascript
  // Template
  S: "Welcome back, {name}! You have {count} transactions today."

  // With data
  getMessage('dashboard.greeting', userId, {
    name: 'Alex',
    count: 5
  })
  // Returns: "Welcome back, Alex! You have 5 transactions today."
  ```

## Technical Requirements

### Data Model

#### Message Model
```javascript
Message {
  id: String (primary key, e.g., "transaction.save.success")
  category: Enum [Success, Error, EmptyState, Onboarding, Help, Confirmation, Notification]
  context: String (where message appears, e.g., "Transaction entry form")
  variants: {
    D: String (Dominance variant)
    I: String (Influence variant)
    S: String (Steadiness variant, required - default)
    C: String (Conscientiousness variant)
  }
  fallback: String (used if all variants missing - should never happen)
  placeholders: [String] (list of {placeholder} names)
  usageCount: Integer (track how often message is used)
  createdAt: DateTime
  updatedAt: DateTime
}
```

### Storage
- **Message catalog:**
  - Stored in JSON config file or database
  - Not encrypted (not user data, same for all users)
  - Loaded at app startup
  - Cached in memory for performance

- **Performance:**
  - Message lookup: <10ms
  - Cache hit rate: >95%
  - Memory footprint: <5MB for entire catalog

### Initial Message Coverage
- **Target coverage:**
  - Error messages: >95% have all 4 variants
  - Success messages: >95% have all 4 variants
  - Empty states: >90% have all 4 variants
  - Onboarding prompts: 100% have all 4 variants (critical for first impression)
  - Help tooltips: >80% have all 4 variants
  - Confirmation dialogs: >90% have all 4 variants

### Validation
- **Message ID:**
  - Format: `category.subcategory.action` (e.g., "transaction.save.success")
  - Unique across catalog
  - Descriptive naming

- **Variants:**
  - At minimum, S variant must exist (default)
  - All variants should convey same information
  - Tone differences only, not content differences
  - Length: Keep variants roughly similar length (±30%)

- **Placeholders:**
  - Must be declared in `placeholders` array
  - Must be used consistently across variants
  - Type validation on interpolation

## Message Examples

### Success Messages

#### Transaction Saved
```javascript
{
  id: "transaction.save.success",
  category: "Success",
  context: "Transaction entry form - after save",
  variants: {
    D: "Done. Transaction recorded. What's next?",
    I: "Woohoo! You just recorded your first transaction! You're doing great!",
    S: "You just recorded your first transaction! You're officially doing bookkeeping. (And you didn't even need an accounting degree!)",
    C: "Transaction successfully recorded. Entry ID: {id}. Date: {date}. Amount: {amount}. Category: {category}. All fields validated and saved."
  },
  fallback: "Transaction saved successfully.",
  placeholders: ["id", "date", "amount", "category"]
}
```

#### Account Created
```javascript
{
  id: "account.create.success",
  category: "Success",
  context: "Chart of accounts - after creating account",
  variants: {
    D: "Account created. Add another?",
    I: "Amazing! Your first account is created! This is so exciting!",
    S: "Your first account! This is where the magic of organization begins.",
    C: "Account created successfully. Name: {name}. Type: {type}. Number: {number}. Status: Active."
  },
  fallback: "Account created successfully.",
  placeholders: ["name", "type", "number"]
}
```

### Error Messages

#### Transaction Doesn't Balance
```javascript
{
  id: "transaction.validation.unbalanced",
  category: "Error",
  context: "Transaction entry - validation error",
  variants: {
    D: "Transaction doesn't balance. Fix debits/credits and try again.",
    I: "Oops! This one's a bit off-balance. Let's adjust those numbers!",
    S: "Oops! Something unexpected happened. Don't worry - your data is safe. The debits and credits don't quite match up. Let's adjust the amounts and try again.",
    C: "Validation error: Transaction not balanced. Debits: {debits}. Credits: {credits}. Difference: {difference}. Please adjust entries to balance before saving."
  },
  fallback: "Transaction must balance. Debits must equal credits.",
  placeholders: ["debits", "credits", "difference"]
}
```

#### Network Error
```javascript
{
  id: "sync.error.network",
  category: "Error",
  context: "Sync - network unavailable",
  variants: {
    D: "Sync failed. No connection. Will retry when online.",
    I: "Oh no! We lost the connection. No worries - we'll sync up as soon as you're back online!",
    S: "We can't reach our servers right now. Don't worry - all your changes are saved on this device. We'll sync them automatically when your connection is back.",
    C: "Sync operation failed. Error: ERR_NETWORK. Network unavailable. Local changes queued. Automatic retry will occur when connectivity is restored. Last successful sync: {lastSync}."
  },
  fallback: "Network connection unavailable. Changes saved locally.",
  placeholders: ["lastSync"]
}
```

### Empty States

#### No Transactions Yet
```javascript
{
  id: "transactions.empty_state",
  category: "EmptyState",
  context: "Transaction list - no transactions",
  variants: {
    D: "No transactions. Record your first one now.",
    I: "No transactions yet! Ready to record your first one? It's easy and kind of fun!",
    S: "No transactions yet. Your first one is just a click away! Don't worry - we'll walk you through it.",
    C: "Transaction count: 0. The transaction list is currently empty. Click 'New Transaction' to create your first entry."
  },
  fallback: "No transactions to display.",
  placeholders: []
}
```

### Onboarding Prompts

#### Welcome Message
```javascript
{
  id: "onboarding.welcome",
  category: "Onboarding",
  context: "Dashboard - first login",
  variants: {
    D: "Welcome to Graceful Books. Let's get your accounts set up.",
    I: "Welcome to Graceful Books! We're so excited to have you here! Let's get started on your financial journey together!",
    S: "Welcome to Graceful Books! We're here to help you understand and manage your business finances. Take your time - we'll guide you through everything step by step.",
    C: "Welcome to Graceful Books. This system provides comprehensive accounting functionality with zero-knowledge encryption. Begin by completing the onboarding assessment to customize your experience."
  },
  fallback: "Welcome to Graceful Books!",
  placeholders: []
}
```

### Help Tooltips

#### What is Chart of Accounts?
```javascript
{
  id: "help.chart_of_accounts.tooltip",
  category: "Help",
  context: "Chart of accounts - help icon",
  variants: {
    D: "Chart of Accounts: Categories for all your money. Assets, income, expenses, etc.",
    I: "Your Chart of Accounts is like a filing system for your money! Everything has its perfect place!",
    S: "The Chart of Accounts is a list of all the places money can go in your business. Think of it as organizing your finances into categories like 'Income,' 'Expenses,' and 'Assets.' Don't worry - it's simpler than it sounds!",
    C: "Chart of Accounts: A systematic classification of all accounts used in the general ledger, organized by account type (Assets, Liabilities, Equity, Income, Expenses) following GAAP principles."
  },
  fallback: "Chart of Accounts organizes your financial accounts by category.",
  placeholders: []
}
```

## User Interface

### Message Preview Tool (Admin/Developer)
```
┌────────────────────────────────────────────────────────┐
│  Message Preview: transaction.save.success            │
├────────────────────────────────────────────────────────┤
│                                                         │
│  Category: Success                                     │
│  Context: Transaction entry form - after save          │
│                                                         │
│  Variants:                                             │
│  ┌──────────────────────────────────────────────────┐ │
│  │ D (Dominance)                                    │ │
│  │ Done. Transaction recorded. What's next?         │ │
│  └──────────────────────────────────────────────────┘ │
│                                                         │
│  ┌──────────────────────────────────────────────────┐ │
│  │ I (Influence)                                    │ │
│  │ Woohoo! You just recorded your first             │ │
│  │ transaction! You're doing great!                 │ │
│  └──────────────────────────────────────────────────┘ │
│                                                         │
│  ┌──────────────────────────────────────────────────┐ │
│  │ S (Steadiness) ⭐ Default                        │ │
│  │ You just recorded your first transaction!        │ │
│  │ You're officially doing bookkeeping. (And you    │ │
│  │ didn't even need an accounting degree!)          │ │
│  └──────────────────────────────────────────────────┘ │
│                                                         │
│  ┌──────────────────────────────────────────────────┐ │
│  │ C (Conscientiousness)                            │ │
│  │ Transaction successfully recorded. Entry ID:     │ │
│  │ {id}. Date: {date}. Amount: {amount}.            │ │
│  │ Category: {category}. All fields validated       │ │
│  │ and saved.                                        │ │
│  └──────────────────────────────────────────────────┘ │
│                                                         │
│  Placeholders: id, date, amount, category              │
│  Usage count: 1,247 (last 30 days)                    │
│                                                         │
│  [Edit Message]  [Test with Profile]  [Close]         │
│                                                         │
└────────────────────────────────────────────────────────┘
```

## Dependencies

### Requires (from Group B)
- `disc-profile` - User DISC profile for variant selection

### Provides to
- All user-facing features throughout application
- Personalized user experience
- DISC-adapted communication

## Success Metrics
- Variant coverage: >95% of messages have all 4 variants
- Message lookup performance: <10ms (P95)
- Cache hit rate: >95%
- User perception: "Messages feel natural and clear" >80% agree
- Missing variant errors: <0.1% of message displays
- A/B test (future): DISC-adapted vs. default messages - improved engagement >10%

## Content Guidelines

### Writing Effective Variants

#### D (Dominance) Style
- **Characteristics:** Direct, brief, action-oriented
- **Length:** Aim for shortest variant
- **Tone:** Professional, no-nonsense, results-focused
- **Avoid:** Excessive detail, emotional language, apologies
- **Example:** "Done. Next steps: [action list]"

#### I (Influence) Style
- **Characteristics:** Enthusiastic, friendly, encouraging
- **Length:** Can be longer if adds warmth
- **Tone:** Upbeat, social, celebratory
- **Avoid:** Coldness, excessive data, pessimism
- **Example:** "Woohoo! You did it! What a great step forward!"

#### S (Steadiness) Style
- **Characteristics:** Patient, supportive, reassuring
- **Length:** Medium, enough detail for comfort
- **Tone:** Calm, warm, judgment-free
- **Avoid:** Rushing, pressure, assuming knowledge
- **Example:** "Great job! Let's take this one step at a time. Here's what comes next..."

#### C (Conscientiousness) Style
- **Characteristics:** Detailed, accurate, systematic
- **Length:** Often longest variant (provides specifics)
- **Tone:** Precise, analytical, informative
- **Avoid:** Vagueness, emotional appeals, informality
- **Example:** "Operation completed successfully. Details: [specific data]. Next recommended action: [precise instruction]."

### Quality Checklist
For each message set:
- [ ] All 4 variants convey same core information
- [ ] Tone matches DISC style guidelines
- [ ] Placeholders used consistently
- [ ] No critical information omitted in any variant
- [ ] Lengths are reasonable (D shortest, C often longest)
- [ ] Grammar and spelling correct in all variants
- [ ] Tested in context (not just in isolation)

## Accessibility
- Message content accessible to screen readers
- No information conveyed by tone alone
- All critical information present in all variants
- WCAG 2.1 AA compliance

## Internationalization (Future)
- Message catalog structure supports localization
- Each language would have its own 4 variants per message
- Example: Spanish messages still have D/I/S/C variants
- Maintains personalization across languages

## Logging & Analytics
- Track message display frequency
- Identify most-used messages (prioritize for variant completion)
- Log missing variant errors for improvement
- A/B test effectiveness of different variants (future)

## Error Handling
- **Missing message ID:** Log error, return fallback generic message
- **Missing variant:** Fall back to secondary style, then S, then fallback
- **Placeholder mismatch:** Log error, return message with {placeholder} intact (visible to user as bug indicator)
- **Interpolation error:** Log error, return message without interpolation

## Testing Strategy
- Unit tests: Variant selection algorithm with all DISC profiles
- Integration tests: Message retrieval in various contexts
- Content tests: Verify all critical messages have 4 variants
- User tests: Verify messages feel natural to different DISC types

## Future Enhancements (Beyond Group B)
- Machine learning to optimize variant effectiveness
- User feedback on message clarity
- A/B testing framework for variant comparison
- Context-aware variant selection (time of day, user stress level)
- Message templates for common patterns
- Bulk message editing UI
- Message versioning and history
- Sentiment analysis of variants
- Auto-generation of missing variants (AI-assisted)
