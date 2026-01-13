# Dashboard - Full Featured - Capability Specification

**Capability ID:** `dashboard-full`
**Related Roadmap Items:** F1
**SPEC Reference:** PFD-002
**Status:** In Development

## Overview

The Full-Featured Dashboard transforms the simplified onboarding dashboard into a comprehensive business command center. It provides at-a-glance financial health, actionable insights, and quick access to common tasks, becoming the daily hub for business owners.

## ADDED Requirements


### Functional Requirements

#### FR-1: Cash Position with Trend
**Priority:** Critical

The dashboard SHALL display current cash position with historical trend:

**ADDED Requirements:**

**Display Elements:**
- Current cash balance (all accounts combined)
- 30-day trend line visualization
- Month-over-month comparison (%)
- Runway calculation: "You have X.X months of expenses covered"
- Low balance alert threshold

**Trend Visualization:**
- Interactive line chart (last 30 days)
- Hover to see daily balances
- Color coding: green (increasing), yellow (stable), red (decreasing)
- Highlight significant changes

**Calculations:**
- Sum of all active bank/cash accounts
- Daily balance snapshots
- Average monthly expenses (last 3 months)
- Runway = Current Balance / Average Monthly Expenses

**Acceptance Criteria:**
- [ ] Cash balance updates in real-time
- [ ] Trend chart displays 30 days of history
- [ ] Runway calculation accurate
- [ ] Low balance alert triggers at configurable threshold
- [ ] Mobile-responsive visualization

---

#### FR-2: Revenue vs. Expenses Chart
**Priority:** Critical

The dashboard SHALL display visual comparison of revenue and expenses:

**ADDED Requirements:**

**Chart Features:**
- Interactive bar/line combination chart
- Current month vs. prior month comparison
- Drill-down to transaction details
- Profit margin visualization
- Filter by class/category (if enabled)

**Display Options:**
- View by: Month, Quarter, Year
- Chart types: Bar, Line, Area
- Show/hide specific data series
- Export chart image

**Insights:**
- Profit/loss amount and percentage
- Trend indicator (improving/declining)
- Comparison to previous period
- Year-to-date summary

**Acceptance Criteria:**
- [ ] Chart renders in <500ms
- [ ] Drill-down navigates to transactions
- [ ] Period selector works correctly
- [ ] Chart exports as PNG/PDF
- [ ] Accessible with screen readers

---

#### FR-3: Checklist Integration
**Priority:** High

The dashboard SHALL embed an interactive checklist widget:

**ADDED Requirements:**

**Widget Features:**
- Display current phase checklist
- Show completion progress (%)
- Display next 3-5 tasks
- Direct links to complete tasks
- Streak tracking display
- Expand/collapse functionality

**Interactions:**
- Check off items directly from dashboard
- Click to navigate to full checklist
- Snooze tasks from widget
- Mark "not applicable" option

**Progress Tracking:**
- Overall completion percentage
- Progress bar visualization
- Completion streak: "5 weeks in a row!"
- Category progress breakdown

**Acceptance Criteria:**
- [ ] Widget displays correct tasks for phase
- [ ] Check-off updates immediately
- [ ] Links navigate to correct features
- [ ] Streak calculation accurate
- [ ] CONFETTI on completion (if enabled)

---

#### FR-4: Overdue Invoices Highlight
**Priority:** Critical

The dashboard SHALL prominently display overdue invoices:

**ADDED Requirements:**

**Display Elements:**
- Count of overdue invoices
- Total amount overdue
- Age of oldest invoice
- List of top 5 overdue customers
- Quick-send reminder actions

**Actions:**
- Send reminder email (one-click)
- View invoice details
- Record payment
- Call customer (click-to-dial if configured)

**Analytics:**
- Average days overdue
- Trend: increasing/decreasing overdue count
- Collection rate this month
- Alert if overdue > $X or > X days

**Acceptance Criteria:**
- [ ] Overdue calculation accurate (based on payment terms)
- [ ] Quick-send reminder works
- [ ] Links to invoice details
- [ ] Alert threshold configurable
- [ ] Updates in real-time when payments recorded

---

#### FR-5: Reconciliation Status
**Priority:** High

The dashboard SHALL display current reconciliation status:

**ADDED Requirements:**

**Status Display:**
- Last reconciliation date per account
- Unreconciled transaction count
- Days since last reconciliation
- Reconciliation streak display
- Quick-start reconciliation button

**Visual Indicators:**
- Green: Reconciled within 7 days
- Yellow: Reconciled 8-30 days ago
- Red: Not reconciled >30 days
- Badge: Reconciliation streak count

**Multi-Account Support:**
- Show status for each connected account
- Aggregate view of all accounts
- Click to reconcile specific account

**Acceptance Criteria:**
- [ ] Status accurate for all accounts
- [ ] Quick-start launches correct reconciliation
- [ ] Streak calculation correct
- [ ] Visual indicators clear and intuitive

---

#### FR-6: Quick Actions Panel
**Priority:** High

The dashboard SHALL provide quick access to common tasks:

**ADDED Requirements:**

**Actions Included:**
- New Income Transaction
- New Expense Transaction
- New Invoice
- Record Bill Payment
- Add Receipt
- Create Journal Entry (if enabled)
- Start Reconciliation
- Generate Report

**Customization:**
- User can reorder actions
- User can hide/show actions
- Most-used actions highlighted
- Recently used actions list

**Smart Suggestions:**
- Context-aware action suggestions
- "You have 3 bills due this week - pay them?"
- "Haven't reconciled in 15 days - start now?"
- Personalized based on user patterns

**Acceptance Criteria:**
- [ ] All actions navigate correctly
- [ ] Customization persists across sessions
- [ ] Smart suggestions appear when relevant
- [ ] Mobile-optimized layout

---

#### FR-7: Upcoming Bills Preview
**Priority:** High

The dashboard SHALL display upcoming bill obligations:

**ADDED Requirements:**

**Display Elements:**
- Bills due in next 7 days
- Total amount due
- Count of overdue bills
- Payment status indicators
- Quick-pay links

**List Details:**
- Vendor name
- Bill amount
- Due date
- Days until due / days overdue
- Payment action button

**Alerts:**
- Red badge for overdue bills
- Yellow badge for bills due in 2 days
- Notification for new bills added
- Total amount due highlighted

**Acceptance Criteria:**
- [ ] 7-day window accurate
- [ ] Quick-pay navigates to payment form
- [ ] Overdue bills clearly marked
- [ ] Updates when bills paid

---

#### FR-8: Business Health Indicators
**Priority:** Medium

The dashboard SHALL display key business health metrics:

**ADDED Requirements:**

**Indicators Included:**
- Profit Margin (%)
- Current Ratio (if balance sheet data available)
- Quick Ratio (if balance sheet data available)
- Burn Rate (cash consumed per month)
- Revenue Growth (month-over-month %)
- Expense Ratio (expenses / revenue %)

**Display Format:**
- Metric value
- Trend indicator (↑↓→)
- Comparison to previous period
- Color coding (green/yellow/red)
- Plain English explanation

**Thresholds:**
- Configurable "healthy" ranges
- Alert if metrics outside healthy range
- Educational content about each metric
- Industry benchmark comparisons (optional)

**Acceptance Criteria:**
- [ ] All calculations accurate
- [ ] Trend indicators correct
- [ ] Plain English explanations clear
- [ ] Alerts appear when thresholds exceeded

---

### Non-Functional Requirements

#### NFR-1: Performance
**Priority:** Critical

**ADDED Requirements:**
- Dashboard MUST load in <1 second (90th percentile)
- Widget data MUST update in <500ms
- Charts MUST render in <300ms
- Support up to 50,000 transactions without degradation

**Optimization Strategies:**
- Widget data caching (5-minute TTL)
- Lazy loading for below-the-fold widgets
- Progressive enhancement
- Query optimization with database indexes

#### NFR-2: Responsiveness
**Priority:** Critical

**ADDED Requirements:**
- Dashboard MUST be fully functional on mobile (320px+ width)
- Widgets MUST reflow gracefully on tablet/desktop
- Touch-optimized interactions on mobile
- Landscape and portrait orientation support

#### NFR-3: Customization
**Priority:** Medium

**ADDED Requirements:**
- Users CAN reorder widgets (drag-and-drop)
- Users CAN hide/show widgets
- Layout preferences MUST persist across sessions
- Default layout MUST be sensible for new users

#### NFR-4: Accessibility
**Priority:** Critical

**ADDED Requirements:**
- WCAG 2.1 AA compliance maintained
- All charts MUST have text alternatives
- Keyboard navigation fully supported
- Screen reader announcements for dynamic content
- Color not sole indicator of status

---

## Technical Implementation

### Data Sources
- Cash balances: ACCOUNTS table (type = 'Bank', 'Cash')
- Transactions: TRANSACTIONS, TRANSACTION_LINES tables
- Invoices: INVOICES table (status filtering)
- Bills: INVOICES table (type = 'Bill', due date filtering)
- Reconciliations: RECONCILIATIONS table

### Caching Strategy
- Widget data: 5-minute cache per user
- Chart data: 10-minute cache
- Aggregated metrics: 15-minute cache
- Invalidate cache on user action (transaction, payment, etc.)

### Widget Architecture
```typescript
interface DashboardWidget {
  id: string;
  title: string;
  component: React.ComponentType;
  dataSource: () => Promise<any>;
  refreshInterval?: number;
  size: 'small' | 'medium' | 'large';
  order: number;
  visible: boolean;
  userCustomizable: boolean;
}
```

### Real-Time Updates
- WebSocket connection for live updates
- Fallback to polling (30-second interval)
- Optimistic UI updates
- Conflict resolution for concurrent edits

---

## User Experience

### DISC Adaptations

**D (Decisive/Driver):**
- "Quick wins today: 2 invoices ready to send"
- Bottom-line metrics prominent
- Action-oriented language

**I (Interactive/Influencer):**
- "You're doing great! Here's what's happening..."
- Visual, colorful charts
- Celebration moments prominent

**S (Steady/Supporter):**
- "Everything is under control. Here's your progress..."
- Calm, reassuring tone
- Consistency highlighted

**C (Cautious/Analytical):**
- "Here are the numbers. All reconciled and accurate."
- Detailed metrics
- Precision and accuracy emphasized

### Encouraging Messaging
- "You're all caught up! Time for a victory lap."
- "3.2 months of runway - that's solid!"
- "Your reconciliation streak is impressive!"
- "Revenue up 15% this month. Nice work!"

---

## Testing Requirements

### Unit Tests
- [ ] Cash position calculation
- [ ] Runway calculation
- [ ] Overdue invoice identification
- [ ] Bill due date calculations
- [ ] Health indicator calculations

### Integration Tests
- [ ] Widget data loading
- [ ] Quick action navigation
- [ ] Dashboard customization persistence
- [ ] Real-time update handling

### Performance Tests
- [ ] Load time with 50,000 transactions
- [ ] Concurrent user dashboard loads
- [ ] Widget rendering performance
- [ ] Memory usage over time

### UAT Scenarios
- [ ] Daily check-in workflow
- [ ] Quick task completion
- [ ] Dashboard customization
- [ ] Mobile usage
- [ ] Accessibility with screen reader

---

## Migration & Rollout

### Phase 1: Enhanced Layout (Week 1)
- Deploy new dashboard layout
- Migrate existing widget data
- Enable customization features

### Phase 2: New Widgets (Week 2)
- Add Business Health Indicators
- Add Reconciliation Status
- Add Upcoming Bills Preview

### Phase 3: Optimization (Week 3)
- Implement caching
- Optimize queries
- Performance tuning

### User Communication
- In-app tour of new dashboard
- Email highlighting key features
- Tutorial for customization
- Blog post about dashboard insights

---

## Success Metrics

- 70%+ daily active users access dashboard
- 50%+ users customize widget layout
- 30%+ users use quick actions daily
- <1 second average load time
- >4.0 user satisfaction rating
