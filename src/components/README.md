# Graceful Books UI Component Library

A comprehensive, accessible component library built from scratch with WCAG 2.1 AA compliance, micro-animations, and keyboard navigation.

## Features

All components in this library support:

- ✅ **WCAG 2.1 AA Compliance** - Screen readers, keyboard navigation, proper ARIA attributes
- ✅ **Keyboard Navigation** - Full keyboard support with visible focus indicators
- ✅ **Touch Targets** - Minimum 44x44px for mobile accessibility
- ✅ **Reduced Motion** - Respects `prefers-reduced-motion` setting
- ✅ **High Contrast Mode** - Adapts to high contrast preferences
- ✅ **Focus Indicators** - 3:1 contrast ratio for all interactive elements
- ✅ **Color Contrast** - 4.5:1 minimum for text, 3:1 for interactive elements
- ✅ **Micro-animations** - Delightful interactions with accessibility in mind
- ✅ **TypeScript** - Full type safety with comprehensive interfaces

## Component Categories

### Core Components (`/core`)

Basic building blocks for the UI:

- **Button** - Primary, secondary, outline, ghost, and danger variants with loading states
  - Keyboard navigation (Enter/Space)
  - Focus indicators
  - Loading states with spinners
  - Icon support

### Form Components (`/forms`)

Accessible form components with validation:

- **Input** - Text input with labels, validation, icons, and character counting
- **Select** - Native select dropdown for better accessibility
- **Checkbox** - Checkbox with bounce animation and indeterminate state
- **Radio** - Radio buttons with group management
- **Label** - Labels with required indicators

All form components include:
- Error and success states
- Helper text
- Screen reader announcements
- Validation feedback

### Modal Components (`/modals`)

Overlay components with focus management:

- **Modal** - Dialog modals with focus trap and keyboard navigation
- **Drawer** - Slide-in panels from any edge

Features:
- Focus trap within modal/drawer
- Escape key to close
- Tab cycling
- Return focus on close
- Body scroll lock

### Feedback Components (`/feedback`)

Loading states and error messages:

- **Loading** - Spinner, dots, and pulse variants
- **LoadingOverlay** - Full-screen loading states
- **ErrorMessage** - Error/warning/info messages with actions
- **Alert** - Inline notifications

## Installation & Usage

### Import Components

```tsx
// Import individual components
import { Button, Input, Modal } from '@/components'

// Or import from specific categories
import { Button } from '@/components/core'
import { Input, Checkbox } from '@/components/forms'
import { Modal, Drawer } from '@/components/modals'
import { Loading, ErrorMessage } from '@/components/feedback'
```

### Basic Examples

#### Button

```tsx
import { Button } from '@/components'

function MyComponent() {
  return (
    <div>
      <Button variant="primary" onClick={handleSave}>
        Save Changes
      </Button>

      <Button variant="secondary" loading>
        Processing...
      </Button>

      <Button variant="outline" iconBefore="📧">
        Send Email
      </Button>
    </div>
  )
}
```

#### Input with Validation

```tsx
import { Input } from '@/components'

function MyForm() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')

  return (
    <Input
      label="Email Address"
      type="email"
      value={email}
      onChange={(e) => setEmail(e.target.value)}
      error={error}
      helperText="We'll never share your email"
      required
    />
  )
}
```

#### Modal

```tsx
import { Modal, Button } from '@/components'

function MyComponent() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        Open Modal
      </Button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Confirm Action"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleConfirm}>
              Confirm
            </Button>
          </>
        }
      >
        Are you sure you want to proceed?
      </Modal>
    </>
  )
}
```

#### Checkbox Group

```tsx
import { Checkbox } from '@/components'

function MyForm() {
  const [preferences, setPreferences] = useState({
    newsletter: false,
    notifications: false,
  })

  return (
    <div>
      <Checkbox
        label="Subscribe to newsletter"
        checked={preferences.newsletter}
        onChange={(e) => setPreferences({
          ...preferences,
          newsletter: e.target.checked
        })}
      />

      <Checkbox
        label="Enable push notifications"
        helperText="Receive updates about your account"
        checked={preferences.notifications}
        onChange={(e) => setPreferences({
          ...preferences,
          notifications: e.target.checked
        })}
      />
    </div>
  )
}
```

#### Loading States

```tsx
import { Loading, LoadingOverlay } from '@/components'

function MyComponent() {
  const [isLoading, setIsLoading] = useState(false)

  return (
    <div>
      {/* Inline loading */}
      <Loading variant="spinner" message="Loading data..." />

      {/* Dots variant */}
      <Loading variant="dots" size="sm" />

      {/* Full-screen overlay */}
      <LoadingOverlay
        isVisible={isLoading}
        message="Processing your request..."
      />
    </div>
  )
}
```

## Accessibility Guidelines

### Keyboard Navigation

All components support keyboard navigation:

- **Tab** - Move focus between interactive elements
- **Shift+Tab** - Move focus backwards
- **Enter/Space** - Activate buttons and checkboxes
- **Arrow Keys** - Navigate radio groups and select options
- **Escape** - Close modals and drawers

### Screen Readers

Components are tested with:
- NVDA (Windows)
- JAWS (Windows)
- VoiceOver (macOS/iOS)

All components include:
- Proper ARIA attributes
- Descriptive labels
- Error announcements
- State changes

### Focus Management

- Focus indicators meet WCAG 2.1 AA contrast requirements (3:1)
- Focus is properly managed in modals and drawers
- Focus returns to trigger element when closing overlays
- Tab order is logical and predictable

### Color and Contrast

- Text contrast: 4.5:1 minimum
- Large text: 3:1 minimum
- Interactive elements: 3:1 minimum
- Color is never the only indicator of state
- Icons accompany color changes

### Touch Targets

- Minimum 44x44px touch targets
- Adequate spacing between interactive elements
- Works on mobile browsers and touch devices

### Reduced Motion

All animations respect `prefers-reduced-motion`:
- Animations are disabled when motion is reduced
- Functionality remains the same
- Instant state changes instead of transitions

## Theming & Customization

Components use CSS modules for styling. You can customize by:

1. **Override CSS variables** (when implemented)
2. **Pass custom className** prop to any component
3. **Modify component CSS modules** directly

### Design Tokens

The library uses these design tokens:

**Colors:**
- Primary: Brave Blue (#4a90e2)
- Secondary: Confident Coral (#ff6b6b)
- Danger: Red (#dc2626)
- Success: Green (#059669)

**Spacing:**
- Base unit: 4px
- Scale: 0.25rem, 0.5rem, 0.75rem, 1rem, 1.5rem, 2rem, 3rem

**Border Radius:**
- Small: 0.25rem
- Medium: 0.375rem
- Large: 0.5rem

**Shadows:**
- sm: 0 1px 2px rgba(0, 0, 0, 0.05)
- md: 0 4px 6px rgba(0, 0, 0, 0.1)
- lg: 0 10px 15px rgba(0, 0, 0, 0.1)

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile Safari (iOS)
- Chrome Mobile (Android)

## Contributing

When adding new components:

1. Follow WCAG 2.1 AA guidelines
2. Include proper ARIA attributes
3. Support keyboard navigation
4. Add TypeScript types
5. Create Storybook stories
6. Test with screen readers
7. Test reduced motion
8. Document props and examples

## Testing

Components should be tested for:

- Keyboard navigation
- Screen reader compatibility
- Focus management
- Color contrast
- Touch target sizes
- Reduced motion
- Cross-browser compatibility
- Mobile responsiveness

## License

Proprietary - Graceful Books
