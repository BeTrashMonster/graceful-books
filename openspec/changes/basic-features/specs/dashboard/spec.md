# Capability Spec: Dashboard

## Overview
The `dashboard` capability provides the main user interface home screen that orients users and shows key financial information at a glance. It serves as the central hub for accessing all features and understanding business financial health.

## ADDED Requirements

## Requirements Reference
**Spec Reference:** PFD-002

## Functional Requirements

### Dashboard Components

#### 1. Header with Greeting
- **Time-based personalized greeting:**
  - 5am-11am: "Good morning!"
  - 11am-5pm: "Good afternoon!"
  - 5pm-9pm: "Good evening!"
  - 9pm-5am: "Burning the midnight oil? Your dedication is impressive. (But also, go to bed!)"
- **User name display** (if available)
- **Current date** in user's locale format
- **Consistent, warm tone** using message variant system (B5)

#### 2. Cash Position Card
- **Current cash balance:**
  - Sum of all bank and cash accounts from chart of accounts
  - Large, prominent display
  - Currency formatted (e.g., "$12,345.67")
  - Visual indicator (color coding):
    - Green: Positive balance
    - Yellow: Low balance (<$1,000 configurable threshold)
    - Red: Negative balance (overdraft)

- **Trend indicator:**
  - Compare to previous period (last 30 days)
  - Up/down arrow with percentage
  - Example: "↑ 12% from last month"
  - Green for increases, red for decreases

- **Visual representation:**
  - Simple gauge or progress indicator
  - Mini line chart showing 30-day trend (optional, if data available)

- **Empty state:**
  - "Let's set up your bank accounts to see your cash position"
  - Link to chart of accounts setup

#### 3. Recent Transactions Widget
- **Display last 5-10 transactions:**
  - Date
  - Description (truncated if long)
  - Amount (colored: green for income, black for expense)
  - Category

- **Quick actions:**
  - Click transaction to view/edit details
  - "View all transactions" link at bottom

- **Empty state:**
  - "No transactions yet. Your first one is just a click away!"
  - Visual encouragement (friendly icon or illustration)
  - "New Transaction" button

#### 4. Quick Actions Section
- **Primary actions:**
  - **"New Transaction"** button (prominent, primary color)
    - Quick add income or expense
    - Opens transaction entry modal or navigates to form

  - **"New Invoice"** button (secondary)
    - Placeholder for Group C (grayed out or hidden in Phase system)
    - Tooltip: "Coming soon! You'll be able to create invoices here."

  - **"View Reports"** button (secondary)
    - Placeholder for Group D (grayed out or hidden in Phase system)
    - Tooltip: "Reports unlock as you build your financial foundation"

- **Accessibility:**
  - Large click targets (min 44x44px)
  - Clear button labels
  - Keyboard accessible

#### 5. Getting Started Checklist Preview
- **Simplified checklist card:**
  - Title: "Get Started" or "Your Path Forward"
  - 3-5 suggested first steps (hardcoded for Group B, dynamic in Group C)
  - Progress indicator (e.g., "2 of 5 complete")
  - Checkboxes for completed items

- **Example items (Group B):**
  1. ✓ Create your first account
  2. ✓ Record your first transaction
  3. ☐ Set up your bank accounts
  4. ☐ Add your regular expenses
  5. ☐ Review your dashboard daily for a week

- **Empty state handling:**
  - If checklist not yet generated (Group C), show basic getting started tips
  - Link to full checklist view (in Group C)

- **Completion celebration:**
  - When all items checked: "You're all caught up!" with subtle confetti animation
  - Encouraging message about progress

#### 6. Phase-Appropriate Content
- **Stabilize phase (Group B baseline):**
  - Focus on basic transaction entry
  - Emphasis on "catch up" tasks
  - Simplified metrics
  - Educational tooltips

- **Future phases (Group C onward):**
  - Organize: Add reconciliation status, categorization prompts
  - Build: Add reporting shortcuts, class/category insights
  - Grow: Add forecasting, team activity, advanced metrics

### Responsive Layout

#### Mobile (< 768px)
- Single column layout
- Stack all widgets vertically
- Collapsible sections to save space
- Prominent quick action buttons
- Simplified cash position (number only, no chart)

#### Tablet (768px - 1024px)
- Two column layout
- Cash position and recent transactions side by side
- Quick actions in horizontal row
- Checklist below

#### Desktop (> 1024px)
- Three column grid or flexible dashboard layout
- Cash position: Left column (wide)
- Recent transactions: Center column
- Quick actions + Checklist: Right column
- Optional: User can customize layout (future enhancement)

### Real-Time Updates
- **Automatic refresh** when:
  - New transaction added
  - Transaction edited or deleted
  - Account balance changes
  - User completes checklist item

- **Update strategy:**
  - Optimistic UI updates (show change immediately)
  - Background refresh from data store
  - Sync indicator shows when syncing to relay

- **No full page reload required**

## Technical Requirements

### Data Sources
- **Cash position:** Query chart of accounts for all accounts with type "Cash" or "Bank", sum current balances
- **Recent transactions:** Query transactions ordered by date DESC, limit 10
- **Checklist status:** Query user profile for checklist completion (Group C) or use hardcoded list (Group B)
- **Greeting:** Calculate based on current time in user's timezone

### Performance
- **Load time:** Dashboard must load in <1 second
  - Initial render: <500ms
  - Data fetch and display: <1000ms total
- **Query optimization:**
  - Cash position: Single query, indexed on account type
  - Recent transactions: Single query, indexed on date, limit 10
  - Cache results for 60 seconds to prevent excessive queries
- **Lazy loading:**
  - Non-critical widgets load after critical content
  - Images/icons load progressively

### Caching Strategy
- **Cache dashboard data:**
  - Cache key: `dashboard-${userId}-${timestamp}`
  - TTL: 60 seconds
  - Invalidate on: transaction create/update/delete, account balance change
- **Session storage** for current session
- **IndexedDB** for offline access

### Error Handling
- **Graceful degradation:**
  - If cash position query fails: Show "---" with explanation
  - If transactions fail to load: Show empty state with retry button
  - If checklist unavailable: Hide section rather than show error

- **Error messages (DISC-adapted via B5):**
  - S variant (default): "We're having trouble loading your dashboard. Let's try refreshing..."
  - D variant: "Dashboard load failed. Refresh."
  - I variant: "Oops! Dashboard didn't quite load. Give it another try!"
  - C variant: "Error loading dashboard data. Error code: D-001. Possible causes: network connectivity, data store unavailable. Retry in 5 seconds."

## User Interface

### Dashboard Layout (Desktop)
```
┌─────────────────────────────────────────────────────────────┐
│  Good morning, Alex! 🌅                    January 10, 2026 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ ┌───────────────────┐  ┌──────────────────┐ ┌────────────┐ │
│ │ Cash Position     │  │ Recent Txns      │ │ Quick      │ │
│ │                   │  │                  │ │ Actions    │ │
│ │    $12,345.67     │  │ 01/10 Payment... │ │            │ │
│ │    ↑ 12%         │  │       +$1,500    │ │ [New Txn]  │ │
│ │                   │  │ 01/09 Office...  │ │            │ │
│ │ [Gauge display]   │  │       -$47       │ │ [New Inv]  │ │
│ │                   │  │ 01/08 Rent...    │ │            │ │
│ │ "3.2 months of    │  │       -$1,200    │ │ [Reports]  │ │
│ │  expenses covered"│  │                  │ │            │ │
│ │                   │  │ [View all →]     │ └────────────┘ │
│ └───────────────────┘  └──────────────────┘                │
│                                                              │
│ ┌───────────────────────────────────────────────────────┐   │
│ │ Get Started                                     2/5 ✓ │   │
│ │                                                        │   │
│ │ ✓ Create your first account                           │   │
│ │ ✓ Record your first transaction                       │   │
│ │ ☐ Set up your bank accounts                           │   │
│ │ ☐ Add your regular expenses                           │   │
│ │ ☐ Review dashboard daily for a week                   │   │
│ └───────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Empty State (No Transactions)
```
┌─────────────────────────────────────────────────────────────┐
│  Good afternoon! 👋                        January 10, 2026 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ ┌───────────────────────────────────────────────────────┐   │
│ │                                                        │   │
│ │              Welcome to Graceful Books!               │   │
│ │                                                        │   │
│ │  You're ready to start tracking your business         │   │
│ │  finances. Here's how to begin:                       │   │
│ │                                                        │   │
│ │  1. Record your first transaction                     │   │
│ │  2. Set up your chart of accounts                     │   │
│ │  3. Check your dashboard daily                        │   │
│ │                                                        │   │
│ │          [Get Started with First Transaction]         │   │
│ │                                                        │   │
│ └───────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Dependencies

### Requires (from Group B)
- `chart-of-accounts` - Account data for cash position calculation
- `transactions` - Transaction data for recent transactions display
- `data-store` (from Group A) - Data retrieval
- `ui-components` (from Group A) - Cards, charts, buttons, lists
- `routing` (from Group A) - Quick action navigation
- `message-variants` (from Group B) - DISC-adapted greetings and messages

### Provides to
- Central navigation hub for entire application
- Quick access to common features
- Financial health at-a-glance
- Onboarding guidance integration point (Group C)

## Success Metrics
- Dashboard engagement: >60% of active users visit daily
- Average time on dashboard: 30-60 seconds (quick check-in)
- Quick action usage: >40% of users use at least one quick action per week
- Cash position viewed: >80% of dashboard visits
- Recent transactions clicked: >30% of dashboard visits
- Getting started checklist interaction: >50% of new users

## Accessibility
- All widgets keyboard navigable
- Screen reader announces dashboard sections
- High contrast mode support
- Reduced motion option (disable animations for users who prefer)
- ARIA labels for all interactive elements
- Focus indicators clearly visible
- WCAG 2.1 AA compliance

## Future Enhancements (Beyond Group B)
- Customizable dashboard layout (drag-and-drop widgets)
- Additional widgets: Profit/loss summary, upcoming bills, invoice status, etc.
- Charts and visualizations (revenue trend, expense breakdown)
- Notifications and alerts (overdue invoices, low cash, etc.)
- Multi-business support (switch between companies)
- Dashboard export (PDF snapshot)
- Dashboard sharing (view-only link for accountant)
- AI-powered insights ("Your expenses are 15% higher this month. Want to dig into why?")
