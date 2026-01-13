# Tutorial System Framework

## Overview

The Tutorial System Framework provides a complete infrastructure for contextual, interactive tutorials with step highlighting, progress tracking, skip/resume functionality, and "Don't show again" options.

## Features

- **Step Highlighting**: Clear, visually distinct highlighting of UI elements with automatic positioning
- **Progress Tracking**: Tutorial progress is persisted and resumable across sessions
- **Skip & Resume**: Users can skip tutorials and resume later from where they left off
- **"Don't Show Again"**: Users can permanently dismiss tutorials
- **Keyboard Accessible**: Full keyboard navigation (Arrow keys, Enter, Escape, Tab)
- **Badge System**: Optional badges for tutorial completion (hidden in profile)
- **Encouraging Language**: All tutorial content uses judgment-free, supportive language
- **Responsive**: Works on all screen sizes with intelligent tooltip positioning

## Architecture

### Components

- **TutorialEngine**: Main orchestrator that wraps your application
- **TutorialOverlay**: Renders the tutorial overlay with step highlighting and tooltip
- **useTutorial**: React hook for managing tutorial state and interactions

### Data Layer

- **tutorials.ts**: Data access layer for tutorial progress (CRUD operations)
- **tutorialDefinitions.ts**: Tutorial definitions with steps and content
- **tutorial.types.ts**: TypeScript types for the entire system

### Database

Tutorial progress is stored in IndexedDB with the following schema:

```typescript
interface TutorialProgress {
  id: string;
  user_id: string;
  tutorial_id: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED' | 'DISMISSED';
  current_step: number;
  total_steps: number;
  started_at: number | null;
  completed_at: number | null;
  last_viewed_at: number | null;
  attempt_count: number;
  dont_show_again: boolean;
  badge_data: TutorialBadge | null;
  version_vector: VersionVector;
}
```

## Usage

### 1. Wrap your application with TutorialEngine

```tsx
import { TutorialEngine } from './components/tutorials';

function App() {
  const { user } = useAuth();

  return (
    <>
      <TutorialEngine userId={user.id} />
      <YourAppComponents />
    </>
  );
}
```

### 2. Create tutorial definitions

```typescript
import { TutorialDefinition, TutorialTrigger, StepPosition } from './types/tutorial.types';

export const myTutorial: TutorialDefinition = {
  id: 'my-tutorial',
  title: 'My Feature Tutorial',
  description: 'Let me show you how this works!',
  category: 'feature',
  trigger: TutorialTrigger.FIRST_TIME,
  estimatedMinutes: 3,
  steps: [
    {
      id: 'step1',
      title: 'Welcome!',
      description: 'Let\'s explore this feature together.',
      element: null, // Center modal
      position: StepPosition.CENTER,
    },
    {
      id: 'step2',
      title: 'Here\'s the button',
      description: 'Click here to start using this feature.',
      element: '[data-tutorial="my-button"]', // CSS selector
      position: StepPosition.BOTTOM,
    },
  ],
};
```

### 3. Trigger tutorials in your components

```tsx
import { useTutorial } from './hooks/useTutorial';

function MyFeature() {
  const tutorial = useTutorial(userId);

  useEffect(() => {
    // Check if tutorial should be shown
    tutorial.shouldShowTutorial('my-tutorial').then((shouldShow) => {
      if (shouldShow) {
        tutorial.startTutorial('my-tutorial');
      }
    });
  }, []);

  return (
    <div>
      <button data-tutorial="my-button">Click Me</button>
    </div>
  );
}
```

### 4. Add tutorial markers to your UI

Use `data-tutorial` attributes to mark elements for highlighting:

```tsx
<button data-tutorial="invoice-save-button">Save Invoice</button>
<div data-tutorial="dashboard-metrics">
  {/* Metrics content */}
</div>
```

## Tutorial Hook API

```typescript
const tutorial = useTutorial(userId);

// State
tutorial.state.isActive          // Is a tutorial currently active?
tutorial.state.tutorial          // Current tutorial definition
tutorial.state.currentStepIndex  // Current step index (0-based)
tutorial.state.isLoading         // Is loading?
tutorial.state.error             // Error message if any

tutorial.currentStep             // Current step object
tutorial.progressPercentage      // Progress (0-100)
tutorial.canGoNext               // Can go to next step?
tutorial.canGoPrevious           // Can go to previous step?

// Actions
tutorial.startTutorial(id)       // Start a tutorial
tutorial.resumeTutorial(id)      // Resume from saved progress
tutorial.nextStep()              // Go to next step
tutorial.previousStep()          // Go to previous step
tutorial.skipTutorial(dontShowAgain) // Skip tutorial
tutorial.completeTutorial()      // Complete tutorial
tutorial.stopTutorial()          // Stop without saving state

// Utilities
tutorial.getTutorialProgressData(id)  // Get progress for tutorial
tutorial.shouldShowTutorial(id)       // Should tutorial be shown?
tutorial.getAvailableTutorials()      // Get all tutorials
tutorial.getTutorialStats()           // Get statistics
tutorial.getBadges()                  // Get earned badges
```

## Tutorial Definition Reference

```typescript
interface TutorialDefinition {
  id: string;                    // Unique ID
  title: string;                 // Tutorial title
  description: string;           // Brief description
  category: 'onboarding' | 'feature' | 'workflow' | 'advanced';
  trigger: TutorialTrigger;      // When to show
  steps: TutorialStep[];         // Tutorial steps
  estimatedMinutes: number;      // Time estimate
  required?: boolean;            // Required for onboarding?
  prerequisites?: string[];      // Prerequisites
  requiredPhase?: string;        // Phase requirement
}

interface TutorialStep {
  id: string;                    // Step ID
  title: string;                 // Step title
  description: string;           // Step description
  element: string | null;        // CSS selector to highlight
  position: StepPosition;        // Tooltip position
  allowInteraction?: boolean;    // Allow clicking element?
  image?: string;                // Optional image URL
  onShow?: () => void;           // Callback when shown
  canProceed?: () => boolean;    // Validation function
}
```

## Keyboard Navigation

- **Escape**: Close tutorial
- **Enter** or **Arrow Right**: Next step
- **Arrow Left**: Previous step
- **Tab**: Navigate between buttons
- **Space** or **Enter**: Activate buttons

## Accessibility

- Full WCAG 2.1 AA compliance
- Screen reader support with ARIA labels
- Focus management and keyboard navigation
- High contrast mode support
- Reduced motion support (prefers-reduced-motion)
- Touch targets minimum 44x44px

## Styling

The tutorial system uses CSS modules for styling. You can customize the appearance by overriding CSS variables:

```css
:root {
  --color-primary: #4f46e5;
  --color-primary-dark: #4338ca;
  --color-success: #10b981;
  --color-text-primary: #1f2937;
  --color-text-secondary: #6b7280;
  --color-gray-100: #f3f4f6;
  --color-gray-200: #e5e7eb;
  --color-gray-300: #d1d5db;
}
```

## Testing

The tutorial system includes comprehensive tests:

```bash
# Run all tests
npm test

# Run tutorial tests specifically
npm test -- tutorials.test.ts

# Run with coverage
npm run test:coverage
```

### Test Coverage

- Unit tests for all data access functions
- Integration tests for tutorial state management
- Hook tests for useTutorial
- Component tests for TutorialOverlay (add as needed)
- E2E tests for complete flows (add as needed)

## Built-in Tutorials

The system comes with 5 pre-defined tutorials:

1. **Dashboard Overview** (onboarding): Welcome tour of the dashboard
2. **First Invoice**: Create your first invoice
3. **First Expense**: Record your first expense
4. **Chart of Accounts**: Understanding your accounts
5. **First Reconciliation**: Bank reconciliation walkthrough

Add more tutorials by creating definitions in `tutorialDefinitions.ts`.

## Best Practices

### Writing Tutorial Content

1. **Use encouraging language**: "Let's do this together" not "You must do this"
2. **Be judgment-free**: "This might seem complex" not "This is easy"
3. **Break down steps**: One clear action per step
4. **Explain why**: Help users understand the purpose
5. **Keep it short**: 5 steps or fewer when possible

### Tutorial Triggers

- **FIRST_TIME**: Show on first access to a feature
- **FEATURE_UNLOCK**: Show when feature becomes available
- **ONBOARDING**: Part of initial onboarding
- **MANUAL**: User manually starts from help menu
- **PROMPT**: After specific user action

### Element Selection

Use specific, stable selectors:

```tsx
// Good
<button data-tutorial="save-button">Save</button>

// Avoid
<button id="btn-123">Save</button>  // Generated IDs may change
<button className="btn">Save</button> // Too generic
```

## Troubleshooting

### Tutorial not showing

1. Check if element exists: `document.querySelector('[data-tutorial="your-element"]')`
2. Verify tutorial is registered in `allTutorials` array
3. Check if user dismissed it: `tutorial.shouldShowTutorial(id)`
4. Look for console errors

### Positioning issues

1. Ensure target element is visible and not hidden
2. Check viewport size - tutorialmay adjust position automatically
3. Use `StepPosition.AUTO` for automatic positioning
4. Test on different screen sizes

### State not persisting

1. Check IndexedDB is available in browser
2. Verify localStorage is accessible for deviceId
3. Look for CRDT version vector errors
4. Check for database transaction errors in console

## Performance Considerations

- Tutorial progress is stored locally in IndexedDB
- No network requests required for tutorial operation
- Lazy loading of tutorial definitions
- Efficient DOM queries with query selectors
- Debounced window resize handlers

## Future Enhancements

- [ ] Video tutorials
- [ ] Interactive quizzes within tutorials
- [ ] Tutorial analytics dashboard
- [ ] A/B testing for tutorial content
- [ ] Multi-step branching tutorials
- [ ] Tutorial export/import for sharing
- [ ] Custom theme support

## Contributing

When adding new tutorials:

1. Create tutorial definition in `tutorialDefinitions.ts`
2. Add tutorial to `allTutorials` array
3. Add `data-tutorial` attributes to target elements
4. Test on multiple screen sizes
5. Verify keyboard navigation
6. Add to relevant documentation

## License

Proprietary - Graceful Books
