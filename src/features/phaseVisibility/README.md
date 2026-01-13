# Phase-Based Feature Visibility

This module implements progressive feature disclosure based on a user's current business phase (Stabilize, Organize, Build, Grow).

## Requirements

- **PFD-001**: Feature visibility rules by phase
- **PFD-002**: UI adaptation based on phase

## Overview

Features are progressively unlocked as users advance through business phases. This prevents overwhelming new users while giving advanced users access to powerful tools.

### Business Phases

1. **Stabilize** - Getting financial foundation in place
   - Dashboard
   - Basic transactions
   - Simple reports
   - Basic accounts
   - Help center

2. **Organize** - Organizing and categorizing finances
   - All Stabilize features
   - Categories & tags
   - Bank reconciliation
   - Advanced reports
   - Search & filters

3. **Build** - Building systems to grow business
   - All Organize features
   - Invoicing
   - Customer management
   - Inventory tracking
   - Products catalog
   - Recurring transactions

4. **Grow** - Scaling with advanced tools
   - All Build features
   - Financial forecasting
   - Business analytics
   - Third-party integrations
   - API access
   - Multi-currency
   - Custom report builder

## Usage

### Basic Feature Gating

```tsx
import { FeatureGate } from '@/features/phaseVisibility';

function MyPage() {
  const user = useUser();

  return (
    <FeatureGate
      feature="invoicing"
      visibilityOptions={{
        currentPhase: user.phase,
        userId: user.id
      }}
    >
      <InvoicingFeature />
    </FeatureGate>
  );
}
```

### With Custom Locked State

```tsx
import { FeatureGate } from '@/features/phaseVisibility';
import { LockedFeatureCard } from '@/components/phaseVisibility';

function MyPage() {
  return (
    <FeatureGate
      feature="forecasting"
      visibilityOptions={{ currentPhase: user.phase, userId: user.id }}
      showLocked={true}
      fallback={<LockedFeatureCard featureId="forecasting" />}
    >
      <ForecastingFeature />
    </FeatureGate>
  );
}
```

### Using the Hook Directly

```tsx
import { useFeatureVisibility } from '@/features/phaseVisibility';

function MyComponent() {
  const { canAccess, isVisible, state } = useFeatureVisibility({
    currentPhase: user.phase,
    userId: user.id,
  });

  if (!isVisible('invoicing')) {
    return null;
  }

  if (!canAccess('invoicing')) {
    return <LockedFeatureCard featureId="invoicing" />;
  }

  return <InvoicingFeature />;
}
```

### Show All Features Toggle

```tsx
import { useFeatureVisibility } from '@/features/phaseVisibility';

function SettingsPage() {
  const {
    showAllFeatures,
    toggleShowAllFeatures
  } = useFeatureVisibility({
    currentPhase: user.phase,
    userId: user.id,
  });

  return (
    <label>
      <input
        type="checkbox"
        checked={showAllFeatures}
        onChange={toggleShowAllFeatures}
      />
      Show all features (preview upcoming features)
    </label>
  );
}
```

### Handling Feature Unlocks

```tsx
import { useFeatureVisibility } from '@/features/phaseVisibility';
import { UnlockNotification } from '@/components/phaseVisibility';

function App() {
  const [unlockedFeature, setUnlockedFeature] = useState<FeatureId | null>(null);

  useFeatureVisibility({
    currentPhase: user.phase,
    userId: user.id,
    onFeatureUnlock: (event) => {
      setUnlockedFeature(event.featureId);
    },
  });

  return (
    <>
      {/* Your app */}
      {unlockedFeature && (
        <UnlockNotification
          featureId={unlockedFeature}
          show={true}
          onDismiss={() => setUnlockedFeature(null)}
          onExplore={() => navigate(`/features/${unlockedFeature}`)}
        />
      )}
    </>
  );
}
```

## Components

### FeatureGate

Conditionally renders content based on feature accessibility.

**Props:**
- `feature`: Feature ID to check
- `visibilityOptions`: User phase and ID
- `children`: Content to render if accessible
- `fallback`: Content to render if locked (optional)
- `showLocked`: Whether to show fallback for locked features (default: true)
- `hideIfNotVisible`: Hide completely if not visible (default: true)

### LockedFeatureCard

Displays a dimmed feature card with unlock information.

**Props:**
- `featureId`: Feature to display as locked
- `showPeek`: Show "curious? peek ahead" link (default: true)
- `onLearnMore`: Callback for learn more action
- `size`: 'small' | 'medium' | 'large'

### UnlockNotification

Celebratory notification when features unlock.

**Props:**
- `featureId`: Feature that was unlocked
- `show`: Whether notification is visible
- `onDismiss`: Callback when dismissed
- `onExplore`: Callback to explore the feature
- `duration`: Auto-dismiss duration in ms (default: 5000)

## API Reference

### Functions

#### `isFeatureAccessible(featureId, currentPhase): boolean`
Check if a feature is accessible in the current phase.

#### `isFeatureVisible(featureId, currentPhase): boolean`
Check if a feature is visible (but may be locked).

#### `getFeatureAccess(featureId, currentPhase, showAllFeatures?): FeatureAccessResult`
Get detailed access information for a feature.

#### `getUnlockedFeatures(oldPhase, newPhase): FeatureId[]`
Get features unlocked when transitioning between phases.

#### `getFeatureMetadata(featureId): FeatureMetadata | undefined`
Get metadata for a specific feature.

## Testing

All functionality is thoroughly tested with 88 tests covering:
- Visibility rules for all phases
- Feature accessibility logic
- React hook functionality
- Component rendering
- Phase transitions
- localStorage persistence

Run tests:
```bash
npm test -- src/features/phaseVisibility
```

## Accessibility

All components meet WCAG 2.1 AA standards:
- Keyboard navigable
- Proper ARIA labels
- Sufficient color contrast
- Respects reduced motion preferences
- High contrast mode support

## Communication Style

All user-facing messages follow the Steadiness personality:
- Patient and supportive
- Encouraging without being condescending
- Focuses on growth and progress
- "You're ready for..." instead of "You've unlocked..."
- Locked features are "coming soon" not "restricted"

## Examples

See test files for comprehensive usage examples:
- `visibilityRules.test.ts` - Rule logic
- `useFeatureVisibility.test.ts` - Hook usage
- `FeatureGate.test.tsx` - Component usage
