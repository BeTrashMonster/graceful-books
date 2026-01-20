# Conflict Resolution UI Components

CRDT conflict resolution interface components for multi-user collaboration.

## Components

### ConflictBadge

Displays notification count of unresolved conflicts.

```tsx
import { ConflictBadge } from './components/conflicts'

<ConflictBadge
  onClick={() => setShowModal(true)}
  size="md"
  variant="floating"
/>
```

**Props:**
- `onClick?: () => void` - Callback when clicked
- `className?: string` - Additional CSS class
- `size?: 'sm' | 'md' | 'lg'` - Size variant (default: 'md')
- `variant?: 'inline' | 'floating'` - Style variant (default: 'inline')

**Features:**
- Auto-updates every 30 seconds
- Hides when count is 0
- Keyboard accessible
- Screen reader friendly

### ConflictListModal

Main modal for viewing and resolving all conflicts.

```tsx
import { ConflictListModal } from './components/conflicts'

<ConflictListModal
  isOpen={isOpen}
  onClose={handleClose}
  onConflictResolved={handleResolved}
/>
```

**Props:**
- `isOpen: boolean` - Whether modal is open
- `onClose: () => void` - Callback to close modal
- `onConflictResolved?: (conflictId: string) => void` - Callback after resolution

**Features:**
- List view with quick actions
- Expandable detail view
- Success message notifications
- Empty state handling
- Loading states

### ConflictDetailView

Field-by-field comparison for manual resolution.

```tsx
import { ConflictDetailView } from './components/conflicts'

<ConflictDetailView
  conflict={conflict}
  onKeepLocal={handleKeepLocal}
  onKeepRemote={handleKeepRemote}
  onCustomMerge={handleCustomMerge}
  onBack={handleBack}
  loading={loading}
/>
```

**Props:**
- `conflict: DetectedConflict` - Conflict to display
- `onKeepLocal: (conflictId: string) => void` - Keep local version
- `onKeepRemote: (conflictId: string) => void` - Keep remote version
- `onCustomMerge: (conflictId: string, customMerge: Record<string, unknown>) => void` - Custom field selection
- `onBack?: () => void` - Optional back button callback
- `loading?: boolean` - Loading state (default: false)

**Features:**
- Side-by-side diff view
- Field-level selection
- Suggested resolutions
- Quick action buttons
- Value formatting

### ConflictResolutionButtons

Reusable action buttons for conflict resolution.

```tsx
import { ConflictResolutionButtons } from './components/conflicts'

<ConflictResolutionButtons
  conflict={conflict}
  onKeepLocal={handleKeepLocal}
  onKeepRemote={handleKeepRemote}
  onMergeFields={handleMerge}
  onCustom={handleCustom}
  layout="horizontal"
  size="md"
  showAllOptions={true}
/>
```

**Props:**
- `conflict: DetectedConflict` - Conflict to resolve
- `onKeepLocal: (conflictId: string) => void` - Keep local callback
- `onKeepRemote: (conflictId: string) => void` - Keep remote callback
- `onMergeFields?: (conflictId: string) => void` - Optional merge callback
- `onCustom?: (conflictId: string) => void` - Optional custom callback
- `loading?: boolean` - Loading state (default: false)
- `layout?: 'horizontal' | 'vertical'` - Layout direction (default: 'horizontal')
- `size?: 'sm' | 'md' | 'lg'` - Button size (default: 'md')
- `showAllOptions?: boolean` - Show merge/custom buttons (default: true)

## Accessibility

All components are WCAG 2.1 AA compliant:

- ✅ Keyboard navigation (Tab, Enter, Space, Esc)
- ✅ Screen reader support (ARIA labels, live regions)
- ✅ Color contrast ≥ 4.5:1
- ✅ Focus indicators ≥ 3:1 contrast
- ✅ Touch targets ≥ 44x44px
- ✅ Reduced motion support

## Integration

These components integrate with:

- `src/services/conflictResolution.service.ts` - Resolution logic
- `src/store/conflicts.ts` - Conflict storage and notifications
- `src/types/crdt.types.ts` - Type definitions

## Usage Example

Complete integration example:

```tsx
import { useState } from 'react'
import { ConflictBadge, ConflictListModal } from './components/conflicts'

function App() {
  const [modalOpen, setModalOpen] = useState(false)

  const handleConflictResolved = (conflictId: string) => {
    console.log(`Conflict ${conflictId} resolved!`)
    // Optionally show celebration or refresh data
  }

  return (
    <div>
      <header>
        <h1>My App</h1>
        <ConflictBadge
          onClick={() => setModalOpen(true)}
          size="md"
          variant="floating"
        />
      </header>

      <ConflictListModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onConflictResolved={handleConflictResolved}
      />
    </div>
  )
}
```

## Testing

Run tests:

```bash
npm test -- src/components/conflicts
```

Test coverage:
- ConflictBadge: 22 tests
- ConflictResolutionButtons: 26 tests
- ConflictDetailView: 32 tests
- ConflictListModal: 30 tests

Total: 110 unit tests

## Requirements

- React 18+
- TypeScript 4.9+
- Vitest (for testing)
- @testing-library/react (for testing)
