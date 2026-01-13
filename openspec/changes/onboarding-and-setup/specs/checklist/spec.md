# Capability Spec: Checklist

## Overview
The Checklist capability generates and manages personalized task lists based on user assessment results. It provides an interactive UI with progress tracking, gamification elements, and intelligent task management to guide users through their financial journey.

## ADDED Requirements


### CHECK-001: Customized Checklist Generation
**Priority:** Critical
**Category:** User Experience

The system SHALL generate personalized checklists based on assessment:

**CHECKLIST CATEGORIES:**
1. Foundation Building (one-time setup tasks)
2. Weekly Maintenance
3. Monthly Maintenance
4. Quarterly Tasks
5. Annual Tasks

**GENERATION LOGIC:**
- Assessment determines starting checklist
- Phase determines complexity level
- Business type customizes specific items
- Financial literacy adjusts explanation depth

**EXAMPLE STABILIZE CHECKLIST:**
```
Foundation Building:
□ Open dedicated business bank account
□ Gather last 3 months of bank statements
□ Set up chart of accounts (guided)
□ Enter opening balances
□ Categorize 50 transactions (to learn)
□ Complete first reconciliation (guided)
□ Set up first invoice template

Weekly Maintenance:
□ Categorize new transactions
□ Send pending invoices
□ Follow up on overdue invoices
□ File receipts
□ Review cash position
```

**ACCEPTANCE CRITERIA:**
- [ ] Checklist generates within 30 seconds of assessment
- [ ] All items have clear, actionable descriptions
- [ ] Progress persists across sessions
- [ ] Completion triggers celebration/encouragement

### CHECK-002: Checklist Interface
**Priority:** High
**Category:** User Experience

**VISUAL ELEMENTS:**
1. Progress bars by category
2. Completion percentages
3. Streak tracking (consecutive weeks completed)
4. Visual graphs of progress over time
5. Milestone celebrations

**INTERACTIVITY:**
1. Check off items
2. Snooze items (with return date)
3. Add custom items
4. Reorder within categories
5. Mark as "not applicable" (with confirmation)
6. Link items to relevant features

**GAMIFICATION (Professional Tone):**
1. Completion animations (subtle, satisfying)
2. Progress milestones ("First month complete!")
3. Encouraging messages (warm, supportive tone)
4. Badges for consistency (optional visibility)

**ACCEPTANCE CRITERIA:**
- [ ] Checklist visually appealing
- [ ] All interactions feel responsive
- [ ] Gamification is encouraging not condescending
- [ ] Users can customize their view

## Data Models

### ChecklistProfile
```typescript
interface ChecklistProfile {
  id: string;
  userId: string;
  assessmentProfileId: string;

  // Generated based on assessment
  phase: Phase;
  businessType: BusinessType;
  literacyLevel: LiteracyLevel;

  // Categories
  categories: ChecklistCategory[];

  // Streak tracking
  streaks: {
    currentWeeklyStreak: number;
    longestWeeklyStreak: number;
    lastCompletedWeek: Date | null;
    currentMonthlyStreak: number;
    longestMonthlyStreak: number;
    lastCompletedMonth: Date | null;
  };

  // Milestones
  milestones: Milestone[];

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  generatedAt: Date;
}

interface ChecklistCategory {
  id: string;
  name: string;
  description: string;
  type: 'foundation' | 'weekly' | 'monthly' | 'quarterly' | 'annual';
  items: ChecklistItem[];
  order: number;

  // Progress
  totalItems: number;
  completedItems: number;
  percentComplete: number;
}

interface ChecklistItem {
  id: string;
  categoryId: string;
  title: string;
  description: string;
  explanationLevel: 'brief' | 'detailed'; // Based on literacy level

  // Status
  status: 'active' | 'completed' | 'snoozed' | 'not-applicable';
  completedAt: Date | null;
  snoozedUntil: Date | null;
  notApplicableReason: string | null;

  // Linking
  featureLink: string | null; // Route to related feature
  helpArticle: string | null;

  // Customization
  isCustom: boolean; // User-added item
  isReordered: boolean;
  customOrder: number | null;

  // Recurrence (for maintenance tasks)
  recurrence: 'once' | 'weekly' | 'monthly' | 'quarterly' | 'annual';
  lastDueDate: Date | null;
  nextDueDate: Date | null;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

interface Milestone {
  id: string;
  type: 'completion' | 'streak' | 'custom';
  title: string;
  description: string;
  achievedAt: Date;
  celebrated: boolean; // Whether confetti shown
  icon?: string;
}
```

## API

### Checklist Generation API
```typescript
interface ChecklistEngine {
  // Generation
  generateChecklist(
    userId: string,
    assessmentProfile: AssessmentProfile
  ): Promise<ChecklistProfile>;

  regenerateChecklist(
    userId: string,
    options?: RegenerationOptions
  ): Promise<ChecklistProfile>;

  // Retrieval
  getChecklist(userId: string): Promise<ChecklistProfile>;
  getCategory(categoryId: string): Promise<ChecklistCategory>;

  // Item management
  completeItem(itemId: string): Promise<ChecklistItem>;
  uncompleteItem(itemId: string): Promise<ChecklistItem>;
  snoozeItem(itemId: string, until: Date, reason?: string): Promise<ChecklistItem>;
  markNotApplicable(itemId: string, reason: string): Promise<ChecklistItem>;

  // Custom items
  addCustomItem(
    categoryId: string,
    item: CustomItemInput
  ): Promise<ChecklistItem>;
  updateCustomItem(itemId: string, updates: Partial<ChecklistItem>): Promise<ChecklistItem>;
  deleteCustomItem(itemId: string): Promise<void>;

  // Reordering
  reorderItem(itemId: string, newOrder: number): Promise<void>;
  resetOrder(categoryId: string): Promise<void>;

  // Progress tracking
  getProgress(userId: string): Promise<ChecklistProgress>;
  getStreaks(userId: string): Promise<StreakData>;
  getMilestones(userId: string): Promise<Milestone[]>;

  // Recurrence handling
  checkDueItems(userId: string): Promise<ChecklistItem[]>;
  resetRecurringItem(itemId: string): Promise<ChecklistItem>;
}

interface RegenerationOptions {
  keepCustomItems: boolean;
  keepCompletedItems: boolean;
  newPhase?: Phase;
}

interface CustomItemInput {
  title: string;
  description: string;
  recurrence: 'once' | 'weekly' | 'monthly' | 'quarterly' | 'annual';
  featureLink?: string;
}

interface ChecklistProgress {
  overall: {
    totalItems: number;
    completedItems: number;
    percentComplete: number;
  };
  byCategory: Record<string, CategoryProgress>;
  recentCompletions: CompletionEvent[];
  upcomingDue: ChecklistItem[];
}

interface CategoryProgress {
  name: string;
  totalItems: number;
  completedItems: number;
  percentComplete: number;
  trend: 'improving' | 'stable' | 'declining';
}

interface CompletionEvent {
  item: ChecklistItem;
  completedAt: Date;
  categoryName: string;
}

interface StreakData {
  weekly: {
    current: number;
    longest: number;
    lastCompleted: Date | null;
    isActiveThisWeek: boolean;
  };
  monthly: {
    current: number;
    longest: number;
    lastCompleted: Date | null;
    isActiveThisMonth: boolean;
  };
  encouragement: string; // Personalized message
}
```

## Checklist Templates

### Stabilize Phase Template
```typescript
const STABILIZE_FOUNDATION = [
  {
    title: 'Open dedicated business bank account',
    description: 'Separate your business finances from personal to simplify tracking and tax time',
    recurrence: 'once',
    priority: 'high'
  },
  {
    title: 'Gather last 3 months of bank statements',
    description: 'Collect your recent financial history to establish a baseline',
    recurrence: 'once',
    priority: 'high'
  },
  {
    title: 'Set up chart of accounts (guided)',
    description: 'Create categories for tracking income and expenses',
    recurrence: 'once',
    featureLink: '/chart-of-accounts/setup',
    priority: 'high'
  },
  {
    title: 'Enter opening balances',
    description: 'Record your starting financial position',
    recurrence: 'once',
    priority: 'high'
  },
  {
    title: 'Categorize 50 transactions',
    description: 'Practice categorizing to learn your expense patterns',
    recurrence: 'once',
    priority: 'medium'
  },
  {
    title: 'Complete first reconciliation (guided)',
    description: 'Match your records to your bank statement',
    recurrence: 'once',
    featureLink: '/reconciliation/guided',
    priority: 'high'
  }
];

const STABILIZE_WEEKLY = [
  {
    title: 'Categorize new transactions',
    description: 'Review and categorize this week\'s income and expenses (15-30 min)',
    recurrence: 'weekly',
    priority: 'high'
  },
  {
    title: 'File receipts',
    description: 'Upload or scan receipts for your expenses this week',
    recurrence: 'weekly',
    featureLink: '/receipts/capture',
    priority: 'medium'
  },
  {
    title: 'Review cash position',
    description: 'Check your bank balance and upcoming obligations',
    recurrence: 'weekly',
    priority: 'medium'
  }
];

const STABILIZE_MONTHLY = [
  {
    title: 'Reconcile bank accounts',
    description: 'Match your records to your bank statement for the month',
    recurrence: 'monthly',
    featureLink: '/reconciliation',
    priority: 'high'
  },
  {
    title: 'Review Profit & Loss',
    description: 'See how much you earned vs. spent this month',
    recurrence: 'monthly',
    featureLink: '/reports/profit-loss',
    priority: 'medium'
  }
];
```

### Organize Phase Template
```typescript
const ORGANIZE_FOUNDATION = [
  {
    title: 'Review and optimize chart of accounts',
    description: 'Ensure your account categories match your business needs',
    recurrence: 'once',
    priority: 'high'
  },
  {
    title: 'Set up invoice templates',
    description: 'Create professional invoice templates with your branding',
    recurrence: 'once',
    featureLink: '/invoices/templates',
    priority: 'high'
  },
  {
    title: 'Add your clients/customers',
    description: 'Import or enter your client contact information',
    recurrence: 'once',
    featureLink: '/clients',
    priority: 'high'
  },
  {
    title: 'Set up recurring transactions',
    description: 'Automate regular income and expenses',
    recurrence: 'once',
    featureLink: '/transactions/recurring',
    priority: 'medium'
  }
];

const ORGANIZE_WEEKLY = [
  {
    title: 'Categorize and reconcile new transactions',
    description: 'Keep your books up-to-date with this week\'s activity',
    recurrence: 'weekly',
    priority: 'high'
  },
  {
    title: 'Send pending invoices',
    description: 'Invoice clients for completed work',
    recurrence: 'weekly',
    featureLink: '/invoices',
    priority: 'high'
  },
  {
    title: 'Follow up on overdue invoices',
    description: 'Send friendly reminders for unpaid invoices',
    recurrence: 'weekly',
    priority: 'high'
  },
  {
    title: 'Pay bills due this week',
    description: 'Stay on top of your vendor payments',
    recurrence: 'weekly',
    priority: 'medium'
  }
];

const ORGANIZE_MONTHLY = [
  {
    title: 'Complete monthly reconciliation',
    description: 'Match all accounts to bank/credit card statements',
    recurrence: 'monthly',
    priority: 'high'
  },
  {
    title: 'Review financial reports',
    description: 'Analyze P&L, Balance Sheet, and Cash Flow',
    recurrence: 'monthly',
    featureLink: '/reports',
    priority: 'high'
  },
  {
    title: 'Review A/R aging report',
    description: 'Check who owes you money and follow up as needed',
    recurrence: 'monthly',
    featureLink: '/reports/ar-aging',
    priority: 'medium'
  }
];
```

## UI Components

### ChecklistDashboard
Main checklist view component.

**Props:**
- `userId: string`
- `view: 'all' | 'active' | 'completed'`
- `filter?: CategoryType`

**Features:**
- Category tabs/filters
- Overall progress visualization
- Streak display
- Quick actions (add custom item, regenerate)
- Responsive grid layout

### ChecklistCategory
Individual category section.

**Props:**
- `category: ChecklistCategory`
- `expanded: boolean`
- `onItemComplete: (itemId: string) => void`
- `onItemSnooze: (itemId: string, until: Date) => void`

**Features:**
- Collapsible/expandable
- Progress bar
- Item list with actions
- "Add custom item" button

### ChecklistItem
Individual task component.

**Props:**
- `item: ChecklistItem`
- `onComplete: () => void`
- `onSnooze: (until: Date) => void`
- `onMarkNotApplicable: (reason: string) => void`
- `onDelete?: () => void` (for custom items)

**Features:**
- Checkbox with satisfying animation on complete
- Title and description
- Action menu (snooze, not applicable, delete if custom)
- Feature link button (if applicable)
- Due date indicator (for recurring)
- Recurrence badge

### ProgressVisualization
Progress charts and stats.

**Props:**
- `progress: ChecklistProgress`
- `streaks: StreakData`

**Features:**
- Overall completion donut chart
- Category breakdown bar chart
- Streak indicator with flame/fire icon
- Milestone timeline
- Encouraging messages

### MilestoneCelebration
Celebration modal/overlay for achievements.

**Props:**
- `milestone: Milestone`
- `onDismiss: () => void`

**Features:**
- Confetti animation (using canvas or CSS)
- Milestone badge/icon
- Encouraging message
- Share option (future: social sharing)
- Dismissible

## Business Logic

### Generation Algorithm
```typescript
function generateChecklist(
  assessment: AssessmentProfile
): ChecklistProfile {
  const template = getTemplateForPhase(assessment.phase);
  const items: ChecklistItem[] = [];

  // Foundation items
  const foundationItems = template.foundation
    .filter(item => isRelevantForBusiness(item, assessment))
    .map(item => adaptItemForLiteracy(item, assessment.literacyLevel));

  // Recurring items
  const weeklyItems = template.weekly
    .filter(item => isRelevantForBusiness(item, assessment))
    .map(item => adaptItemForLiteracy(item, assessment.literacyLevel));

  const monthlyItems = template.monthly
    .filter(item => isRelevantForBusiness(item, assessment))
    .map(item => adaptItemForLiteracy(item, assessment.literacyLevel));

  // Business-type specific additions
  const specificItems = getBusinessTypeItems(
    assessment.businessType,
    assessment.phase
  );

  return {
    id: generateId(),
    userId: assessment.userId,
    assessmentProfileId: assessment.id,
    phase: assessment.phase,
    businessType: assessment.businessType,
    literacyLevel: assessment.literacyLevel,
    categories: [
      createCategory('foundation', foundationItems),
      createCategory('weekly', weeklyItems),
      createCategory('monthly', monthlyItems),
      ...specificItems
    ],
    streaks: initializeStreaks(),
    milestones: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    generatedAt: new Date()
  };
}

function adaptItemForLiteracy(
  item: TemplateItem,
  level: LiteracyLevel
): ChecklistItem {
  // Adjust explanation depth based on literacy
  if (level === 'beginner' || level === 'developing') {
    return {
      ...item,
      description: item.detailedDescription,
      explanationLevel: 'detailed'
    };
  }
  return {
    ...item,
    description: item.briefDescription,
    explanationLevel: 'brief'
  };
}
```

### Streak Calculation
```typescript
function updateStreaks(
  userId: string,
  category: CategoryType
): StreakData {
  const now = new Date();
  const currentWeek = getWeekNumber(now);
  const currentMonth = getMonthNumber(now);

  const profile = getChecklistProfile(userId);
  const categoryItems = profile.categories.find(c => c.type === category);

  if (!categoryItems) return profile.streaks;

  const allCompleted = categoryItems.items
    .filter(i => i.status !== 'not-applicable')
    .every(i => i.status === 'completed');

  if (allCompleted) {
    if (category === 'weekly') {
      profile.streaks.currentWeeklyStreak++;
      profile.streaks.longestWeeklyStreak = Math.max(
        profile.streaks.currentWeeklyStreak,
        profile.streaks.longestWeeklyStreak
      );
      profile.streaks.lastCompletedWeek = now;
    }
    // Similar for monthly...
  } else {
    // Check if streak broken
    const lastCompleted = profile.streaks.lastCompletedWeek;
    if (lastCompleted && weeksBetween(lastCompleted, now) > 1) {
      profile.streaks.currentWeeklyStreak = 0;
    }
  }

  return profile.streaks;
}
```

### Milestone Detection
```typescript
function checkForMilestones(
  profile: ChecklistProfile
): Milestone[] {
  const newMilestones: Milestone[] = [];

  // First item completed
  if (getTotalCompletedItems(profile) === 1) {
    newMilestones.push({
      id: generateId(),
      type: 'completion',
      title: 'First Task Complete!',
      description: 'You\'re off to a great start',
      achievedAt: new Date(),
      celebrated: false
    });
  }

  // Foundation 50% complete
  const foundation = profile.categories.find(c => c.type === 'foundation');
  if (foundation && foundation.percentComplete >= 50 && !hasMilestone(profile, 'foundation-50')) {
    newMilestones.push({
      id: generateId(),
      type: 'completion',
      title: 'Foundation Half Done!',
      description: 'Your financial foundation is taking shape',
      achievedAt: new Date(),
      celebrated: false
    });
  }

  // Streak milestones
  if (profile.streaks.currentWeeklyStreak === 4) {
    newMilestones.push({
      id: generateId(),
      type: 'streak',
      title: '4 Week Streak!',
      description: 'A month of consistency - you\'re building great habits',
      achievedAt: new Date(),
      celebrated: false
    });
  }

  // Custom milestones...

  return newMilestones;
}
```

## User Experience

### Celebration Moments
- **First item completed:** Small confetti, encouraging message
- **Category completed:** Medium confetti, achievement badge
- **Streak milestone:** Flame animation, "You're on fire!" message
- **Foundation 100%:** Large confetti, "Foundation complete! You're ready to build."

### Encouraging Messages
- **No items completed yet:** "Ready to get started? Check off your first task!"
- **10% complete:** "Great start! Every journey begins with a single step."
- **50% complete:** "Halfway there! Your financial foundation is taking shape."
- **Streak broken:** "No worries! Let's start a new streak this week."
- **Behind on weekly:** "Life happens. When you're ready, your checklist is here."

### Smart Suggestions
- Suggest snoozing items if user seems stuck
- Offer "not applicable" option if item ignored for 3+ weeks
- Recommend regenerating checklist if phase should advance

## Testing Requirements

### Unit Tests
- Checklist generation from assessment profile
- Streak calculation logic
- Milestone detection
- Item filtering by business type
- Literacy-based explanation adaptation

### Integration Tests
- Complete flow: generate → complete items → celebrate milestones
- Streak persistence across sessions
- Recurrence reset logic
- Custom item CRUD

### User Testing
- Checklist feels achievable, not overwhelming
- Gamification encourages without annoying
- Users complete >60% of foundation items
- Weekly engagement rate >60%

## Performance Requirements
- Checklist generation <30 seconds
- Item completion action <200ms
- Progress recalculation <500ms
- Dashboard render with 100+ items <1 second

## Accessibility
- Full keyboard navigation
- Screen reader announcements for completions and celebrations
- High contrast mode for progress bars
- WCAG 2.1 AA compliance
- Reduced motion option (disable confetti)

## Future Enhancements
- Team checklists (shared progress)
- Checklist templates marketplace
- AI-suggested custom items based on behavior
- Integration with calendar for due date reminders
- Export/print checklist
