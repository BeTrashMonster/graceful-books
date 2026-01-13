# Tutorial System Framework - Capability Specification

**Capability ID:** `tutorials`
**Related Roadmap Items:** D4
**SPEC Reference:** LEARN-001 (Ideas section)
**Status:** In Development

## Overview

The Tutorial System Framework provides contextual, interactive tutorials that guide users through features and workflows. This reusable infrastructure powers all future guided experiences, from feature introductions to complex workflow walkthroughs.

## ADDED Requirements

### Functional Requirements

#### FR-1: Tutorial Trigger System
**Priority:** Critical

The system SHALL support multiple trigger types:

**First-Use Triggers:**
- Automatically launch when user first accesses a feature
- Detect: "User has never created an invoice" → Show invoice tutorial
- Only trigger once per user per tutorial

**Manual Triggers:**
- "Show Tutorial" button on feature pages
- Help menu: "Tutorials" section lists all available tutorials
- Search functionality in tutorial library

**Contextual Triggers:**
- Feature unlock: When phase advancement unlocks new feature
- Error recovery: After multiple failed attempts at a task
- Time-based: "You haven't reconciled in 60 days - need a refresher?"

**Acceptance Criteria:**
- [ ] First-use detection works reliably
- [ ] Manual trigger always accessible
- [ ] Contextual triggers don't annoy users (max once per week)
- [ ] Tutorial state persisted per user

#### FR-2: Step Highlighting & Overlay
**Priority:** Critical

Tutorials SHALL provide visual guidance:

**Highlight Features:**
- Dim background (semi-transparent overlay)
- Spotlight specific UI element
- Tooltip/popover with explanation
- Arrow pointing to target element
- Step number indicator (e.g., "Step 2 of 5")

**Overlay Content:**
- Step title (clear, action-oriented)
- Step description (plain English, 1-2 sentences)
- Screenshot or animation (optional)
- "Next" and "Back" buttons
- "Skip Tutorial" option (always available)

**Positioning:**
- Auto-position tooltip to avoid covering target
- Responsive positioning on small screens
- Accessible on mobile devices

**Acceptance Criteria:**
- [ ] Target element highlighted clearly
- [ ] Overlay doesn't block interaction with highlighted element
- [ ] Tooltips readable on all screen sizes
- [ ] Z-index layers managed correctly

#### FR-3: Interactive Step Progression
**Priority:** High

Tutorials SHALL support multiple progression modes:

**Click-Through Mode:**
- User clicks "Next" to advance
- Can navigate "Back" to previous steps
- Skip to end at any time

**Action-Required Mode:**
- User must complete action to advance
- System detects completion automatically
- Example: "Create your first account" waits for account creation

**Hybrid Mode:**
- Mix of click-through and action-required steps
- Clear indicators which type each step is

**Acceptance Criteria:**
- [ ] Both modes implemented
- [ ] Action detection works reliably
- [ ] Users can skip action-required tutorials
- [ ] Progress saved if user exits mid-tutorial

#### FR-4: Tutorial Progress Tracking
**Priority:** High

The system SHALL track:
- Tutorials completed per user
- Tutorials in progress (with resume capability)
- Tutorials skipped
- Step completion within each tutorial
- Time spent per tutorial
- Tutorial effectiveness (did user complete target task after?)

**Progress Indicators:**
- "2 of 5 steps complete" within tutorial
- Tutorial library shows completed badges
- Dashboard widget: "3 tutorials completed"
- Optional: Hidden achievement badges

**Acceptance Criteria:**
- [ ] Progress persisted across sessions
- [ ] Resume from last incomplete step
- [ ] Completed tutorials marked in library
- [ ] Analytics track tutorial effectiveness

#### FR-5: Skip, Pause, and Resume
**Priority:** High

Users SHALL be able to:
- **Skip:** Exit tutorial at any step (with confirmation)
- **Pause:** Close tutorial and resume later from same step
- **Restart:** Begin tutorial from step 1
- **Mark as Complete:** If user already knows the feature

**Don't Show Again:**
- Per-tutorial preference
- Disables first-use auto-trigger
- Manual trigger still available
- Reversible in settings

**Acceptance Criteria:**
- [ ] "Skip Tutorial" always visible
- [ ] Skip confirmation prevents accidental exits
- [ ] Resume link appears on dashboard/feature page
- [ ] "Don't show again" honored
- [ ] Preferences manageable in settings

### Non-Functional Requirements

#### NFR-1: Performance
- Tutorial overlay renders in < 300ms
- Step transitions < 200ms
- No impact on page load time when not active
- Supports 50+ defined tutorials without performance degradation

#### NFR-2: Accessibility
- WCAG 2.1 AA compliant
- Keyboard navigation: Tab, Enter, Esc keys
- Screen reader announces tutorial start, steps, and completion
- High contrast mode supported
- Focus management: Trapped within tutorial overlay

#### NFR-3: Mobile Responsiveness
- Tutorials work on mobile devices (phone/tablet)
- Touch-friendly tap targets (min 44x44px)
- Tooltips positioned appropriately on small screens
- Simplified step content on mobile (shorter text)

## Design Considerations

### User Experience

**Tutorial Flow Example:**
```
[User Opens Invoice Page]
    → [System Detects: First Invoice]
    → [Overlay: "Welcome! Let's create your first invoice together."]
    → [Step 1: Highlight customer field - "First, select a customer"]
    → [User Selects Customer]
    → [Step 2: Highlight line items - "Now add what you're charging for"]
    → [User Adds Line Items]
    → [Step 3: Highlight send button - "Ready to send?"]
    → [User Clicks Send]
    → [Celebration: "Your first invoice is on its way! 🎉"]
```

**Joy Opportunities:**
- Tutorial completion celebration with confetti
- Encouraging messages throughout: "You're doing great!"
- Progress milestones: "Halfway there!"
- Hidden badge for completing 10 tutorials (optional)

**DISC Adaptations:**
- **D:** Minimal text, fast-paced, skip-friendly
- **I:** Friendly tone, encouraging messages
- **S:** Step-by-step, reassuring, patient pacing
- **C:** Detailed explanations, comprehensive coverage

### Technical Architecture


**Tutorial Definition Format:**
```typescript
interface Tutorial {
  id: string;
  title: string;
  description: string;
  category: 'getting-started' | 'invoicing' | 'expenses' | 'reporting' | 'advanced';
  estimatedTime: number; // minutes
  steps: TutorialStep[];
  triggers: TriggerCondition[];
  requiredFeatures: string[]; // Feature flags
}

interface TutorialStep {
  id: string;
  title: string;
  content: string; // Markdown supported
  targetElement?: string; // CSS selector
  position?: 'top' | 'right' | 'bottom' | 'left' | 'center';
  action?: {
    type: 'click' | 'input' | 'navigate' | 'wait';
    target?: string;
    validation?: (state: any) => boolean;
  };
  media?: {
    type: 'image' | 'video' | 'animation';
    url: string;
  };
}

interface TriggerCondition {
  type: 'first-use' | 'manual' | 'contextual' | 'time-based';
  condition?: (userState: UserState) => boolean;
  cooldown?: number; // Days before re-triggering
}
```

**Tutorial Engine Components:**
```typescript
// Core tutorial engine
TutorialEngine.ts          // Main orchestrator
TutorialOverlay.tsx        // Overlay UI component
TutorialTooltip.tsx        // Step tooltip component
TutorialProgress.tsx       // Progress indicator
TutorialLibrary.tsx        // Tutorial browser/library
TutorialStateManager.ts    // Persistence and tracking
TutorialTriggerService.ts  // Trigger detection

// Tutorial content
tutorials/
  getting-started/
    first-invoice.json
    first-expense.json
    first-reconciliation.json
  invoicing/
    recurring-invoices.json
    payment-tracking.json
  reporting/
    p-and-l-explained.json
    cash-flow-analysis.json
```

**State Management:**
```typescript
interface TutorialState {
  activeTutorial: string | null;
  currentStep: number;
  completedTutorials: string[];
  skippedTutorials: string[];
  inProgressTutorials: Map<string, number>; // tutorialId -> stepIndex
  preferences: {
    dontShowAgain: Set<string>;
    autoTriggerEnabled: boolean;
  };
  analytics: {
    tutorialsStarted: number;
    tutorialsCompleted: number;
    averageCompletionTime: number;
  };
}
```

**Example Tutorial Definition:**
```json
{
  "id": "first-invoice",
  "title": "Create Your First Invoice",
  "description": "Learn how to create and send a professional invoice in 5 easy steps.",
  "category": "getting-started",
  "estimatedTime": 3,
  "triggers": [
    {
      "type": "first-use",
      "condition": "user.invoiceCount === 0 && user.visitedInvoicePage"
    }
  ],
  "steps": [
    {
      "id": "intro",
      "title": "Welcome to Invoicing!",
      "content": "Let's create your first invoice together. This should take about 3 minutes.",
      "position": "center"
    },
    {
      "id": "select-customer",
      "title": "Choose Your Customer",
      "content": "First, select who you're invoicing. You can create a new customer or select an existing one.",
      "targetElement": "#invoice-customer-select",
      "position": "right",
      "action": {
        "type": "input",
        "validation": "invoice.customerId !== null"
      }
    },
    {
      "id": "add-line-items",
      "title": "Add What You're Charging For",
      "content": "Add the products or services you're billing for. Include a description and amount.",
      "targetElement": "#invoice-line-items",
      "position": "bottom"
    }
  ]
}
```

## Testing Strategy

### Unit Tests
- Tutorial definition parsing
- Step progression logic
- Trigger condition evaluation
- State persistence
- Action validation

### Integration Tests
- Complete tutorial flow
- Save and resume functionality
- Multi-tutorial management
- Analytics tracking

### User Acceptance Tests
- Complete each defined tutorial
- Skip and resume tutorials
- Don't show again preference
- Keyboard navigation
- Screen reader compatibility
- Mobile device testing

## Open Questions

1. **Tutorial Content Management:** Should tutorials be defined in JSON files or in a CMS?
   - **Decision Needed By:** Technical Architect + Product Manager
   - **Impact:** High - affects maintainability and localization

2. **Video Tutorials:** Should we support embedded video in tutorial steps?
   - **Decision Needed By:** UX Designer + Product Manager
   - **Impact:** Medium - affects content creation effort

3. **Gamification:** Should tutorial completion earn badges or rewards?
   - **Decision Needed By:** Product Manager + UX Designer
   - **Impact:** Low - affects engagement strategy

4. **AI Assistance:** Should tutorials adapt based on user struggles?
   - **Decision Needed By:** Product Manager + ML Engineer
   - **Impact:** Future - Phase 5 consideration

## Success Metrics

- **Tutorial Completion Rate:** 60%+ complete vs. skip
- **Feature Adoption:** Users who complete tutorial 3x more likely to use feature regularly
- **Time to Proficiency:** Tutorial users complete tasks 50% faster
- **User Satisfaction:** Tutorial usefulness rating > 4.0/5
- **Support Reduction:** 20% reduction in support tickets for tutorial-covered features
- **Retention:** Tutorial completers have 1.5x higher 90-day retention

## Related Documentation

- SPEC.md § LEARN-001 (Learning Library)
- ROADMAP.md Group D (D4)
- Design system: Overlay and tooltip components
- Accessibility guidelines: WCAG 2.1 AA
- Tutorial content style guide (to be created)
