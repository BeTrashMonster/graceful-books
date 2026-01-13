# Checklist Generation Engine (C3)

> **Personalized financial task management based on user assessment**

## Overview

The Checklist Generation Engine creates personalized, actionable task lists for users based on their assessment results. Each checklist is customized according to:

- **Phase**: Current financial management phase (Stabilize, Organize, Build, Grow)
- **Business Type**: Type of business (Freelancer, Consultant, Product Business, etc.)
- **Financial Literacy Level**: User's comfort level with financial concepts (1-5)
- **Business Characteristics**: Employees, inventory, invoicing needs, etc.

## Architecture

```
src/features/checklist/
├── types.ts                    # Type definitions
├── templates.ts                # 50+ checklist item templates
├── selectionRules.ts           # Logic for filtering templates
├── checklistGenerator.ts       # Core generation engine
├── selectionRules.test.ts      # Selection rules tests (33 tests)
├── checklistGenerator.test.ts  # Generator tests (27 tests)
└── index.ts                    # Public API exports

src/db/schema/
└── checklistItems.schema.ts    # Database schema and helpers

src/store/
└── checklistItems.ts           # Data access layer
```

## Key Features

### 1. Template-Based Generation

Over 50 pre-built templates organized by:
- **Phase**: Stabilize → Organize → Build → Grow
- **Category**: Setup, Daily, Weekly, Monthly, Quarterly, Yearly, As-Needed

### 2. Smart Selection

Templates are filtered based on:
- User's current phase
- Business type matching
- Literacy level requirements (min/max)
- Conditional requirements (has employees, needs invoicing, etc.)

### 3. Customization

Templates can have variants for:
- **Title customization** by business type
- **Description depth** by literacy level
- **Content adaptation** to user context

### 4. Priority Scoring

Items are automatically prioritized based on:
- Task category importance (Setup > Daily > Monthly)
- Phase relevance (Setup tasks higher in early phases)
- User needs matching (boost items user specifically needs)
- Literacy level alignment

## Usage Examples

### Generate Checklist for New User

```typescript
import { generateChecklist } from '@/store';
import { createAssessmentResults } from '@/features/checklist';

const assessment = createAssessmentResults({
  userId: 'user-123',
  companyId: 'company-123',
  phase: 'STABILIZE',
  businessType: 'FREELANCER',
  literacyLevel: 2,
  hasEmployees: false,
  sellsServices: true,
  needsInvoicing: true,
});

const result = await generateChecklist(assessment);

if (result.success) {
  console.log(`Generated ${result.data.generated} items`);
  console.log(`Total checklist size: ${result.data.total}`);
}
```

### Preview Without Creating

```typescript
import { previewChecklistGeneration } from '@/features/checklist';

const preview = previewChecklistGeneration(assessment);

console.log(`Would generate ${preview.totalItems} items`);
console.log('By phase:', preview.byPhase);
console.log('By category:', preview.byCategory);
```

### Get User's Checklist

```typescript
import { getChecklistItems } from '@/store';

const result = await getChecklistItems({
  user_id: 'user-123',
  phase: 'STABILIZE',
  completed: false,
});

if (result.success) {
  const items = result.data;
  // Display items to user
}
```

### Mark Item Complete

```typescript
import { markComplete } from '@/store';

const result = await markComplete('item-id-123');

if (result.success) {
  const item = result.data;
  console.log(`Streak: ${item.streak_count}`);
}
```

### Get Statistics

```typescript
import { getChecklistStats } from '@/store';

const result = await getChecklistStats('user-123');

if (result.success) {
  const stats = result.data;
  console.log(`Completion rate: ${stats.completionRate}%`);
  console.log(`Highest streak: ${stats.streakCount}`);
}
```

## Template Structure

Each template includes:

```typescript
{
  id: 'unique-template-id',
  phase: ChecklistPhase.STABILIZE,
  category: ChecklistCategory.WEEKLY,
  title: 'Record expenses from the past week',
  description: 'Gather your receipts and record what you spent...',
  order: 1,
  linkedFeature: '/transactions/new',

  selectionRules: {
    // Who should see this?
    businessTypes: [BusinessType.FREELANCER],
    minLiteracyLevel: 2,
    requiresInvoicing: true,
  },

  customization: {
    // Adapt content to user
    titleVariants: {
      [BusinessType.CONSULTANT]: 'Custom title for consultants',
    },
    literacyLevelDescriptions: {
      1: 'Very simple explanation',
      2: 'Standard explanation',
      3: 'More detailed explanation',
    },
  },
}
```

## Selection Rules

Templates are included when ALL conditions match:

### Phase Matching
```typescript
requiredPhases: [ChecklistPhase.STABILIZE, ChecklistPhase.ORGANIZE]
// Only show in these phases
```

### Business Type
```typescript
businessTypes: [BusinessType.FREELANCER, BusinessType.CONSULTANT]
// Only for these business types
```

### Literacy Level
```typescript
minLiteracyLevel: 3,  // Only if user is at level 3+
maxLiteracyLevel: 4,  // Only if user is at level 4 or below
```

### Conditional Requirements
```typescript
requiresEmployees: true,      // Only if has employees
requiresInventory: true,      // Only if tracks inventory
requiresInvoicing: true,      // Only if needs invoicing
requiresProducts: true,       // Only if sells products
requiresServices: true,       // Only if sells services
```

## Database Schema

Checklist items are stored with full CRDT support:

```typescript
interface ChecklistItem {
  // Identity
  id: string;
  user_id: string;
  company_id: string;

  // Classification
  phase: ChecklistPhase;
  category: ChecklistCategory;

  // Content (encrypted)
  title: string;
  description: string;

  // Metadata
  order: number;
  linked_feature: string | null;
  template_id: string | null;
  business_type: string | null;
  literacy_level: number | null;

  // Status
  completed: boolean;
  completed_at: number | null;
  snoozed_until: number | null;
  not_applicable: boolean;

  // Streaks (for recurring items)
  streak_count: number;
  last_completed_at: number | null;

  // CRDT fields
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  version_vector: VersionVector;
}
```

## Streak Tracking

For recurring items (Daily, Weekly, Monthly, etc.), the system automatically tracks streaks:

- **Continues streak** if completed within expected interval (+ 1 day grace)
- **Resets streak** if too much time has passed
- **Stores highest streak** for gamification/motivation

Example intervals:
- Daily: Complete within 25 hours
- Weekly: Complete within 8 days
- Monthly: Complete within 31 days

## Regeneration Logic

The system knows when to regenerate a user's checklist:

### Always Regenerate When:
- Phase changes (Stabilize → Organize)
- Business type changes
- Literacy level changes by 2+ levels

### Regenerate When:
- 2+ major characteristics change (hasEmployees, hasInventory, etc.)

### Don't Regenerate When:
- Single minor characteristic changes
- Small literacy level change (1 level)
- Nothing changes

## Testing

The checklist engine has comprehensive test coverage:

- **Selection Rules**: 33 tests covering all filtering logic
- **Generator**: 27 tests covering generation, customization, and regeneration
- **Total Coverage**: 60 tests, 100% pass rate

Run tests:
```bash
npm test -- selectionRules.test
npm test -- checklistGenerator.test
```

## Joy Opportunities

The checklist system includes several "joy moments":

1. **Personalized Path**: "Based on what you told us, here's your roadmap to financial clarity."
2. **Streak Celebrations**: "5 weeks in a row! You're building real momentum."
3. **Confetti Moments**: Subtle celebration when completing items
4. **Progress Tracking**: Visual progress bars by category
5. **Encouraging Messages**: Plain English, supportive tone throughout

## Future Enhancements

Potential future additions:

- [ ] Adaptive templates that learn from user behavior
- [ ] Team collaboration on checklist items
- [ ] Time-based notifications for due items
- [ ] Integration with calendar systems
- [ ] Custom user-created templates
- [ ] Checklist sharing between users
- [ ] Analytics on completion patterns

## Related Specifications

- **CHECK-001**: Personalized Checklist System
- **ONB-001**: Assessment Framework
- **PFD-001**: Progressive Feature Disclosure
- **ARCH-004**: CRDT-Compatible Schema Design

## Dependencies

- C1: Assessment Engine (provides assessment results)
- B4: DISC Profile System (for communication adaptation)
- A3: Local-First Data Store (IndexedDB storage)
- A2: Encryption Layer (for sensitive data)

---

**Implementation Status**: ✅ Complete (2026-01-11)

**Test Status**: 60/60 tests passing (100%)

**Ready for**: UI integration (C4: Checklist UI - Interactive)
