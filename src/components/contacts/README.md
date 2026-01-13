# Contacts Components

React components for managing and displaying contact hierarchy information in Graceful Books.

## Components

### HierarchyIndicator

Displays visual hierarchy information for a contact (customer or vendor), showing parent/child/standalone status with appropriate icons, badges, and navigation.

#### Features

- Visual hierarchy status indicators (parent/child/standalone)
- SVG icons for each account type
- Hierarchy level badges (Level 0-3)
- Sub-account count for parent accounts
- Breadcrumb navigation to parent accounts
- Compact and expanded view modes
- WCAG 2.1 AA accessible
- Dark mode and high contrast support
- Responsive design

#### Usage

```tsx
import { HierarchyIndicator } from '@/components/contacts'

// Standalone account (compact view)
<HierarchyIndicator
  contact={standaloneContact}
  view="compact"
/>

// Parent account with sub-accounts (expanded view)
<HierarchyIndicator
  contact={parentContact}
  view="expanded"
  subAccountCount={5}
/>

// Child account with parent navigation (expanded view)
<HierarchyIndicator
  contact={childContact}
  view="expanded"
  parentName="Acme Corp (Main)"
  onNavigateToParent={(parentId) => navigate(`/contacts/${parentId}`)}
/>
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `contact` | `Contact` | Required | Contact data with hierarchy information |
| `view` | `'compact' \| 'expanded'` | `'compact'` | Display mode |
| `subAccountCount` | `number` | `0` | Number of sub-accounts (for parent accounts) |
| `parentName` | `string` | `undefined` | Parent contact name (for breadcrumb) |
| `onNavigateToParent` | `(parentId: string) => void` | `undefined` | Callback when parent link is clicked |
| `className` | `string` | `undefined` | Additional CSS class |

#### Account Types

- **Standalone**: Default account type with no hierarchy
- **Parent**: Account that has sub-accounts beneath it
- **Child**: Sub-account that belongs to a parent account

#### View Modes

**Compact View**
- Minimal display for space-constrained layouts
- Shows only essential hierarchy information
- Standalone accounts display nothing in compact mode

**Expanded View**
- Full hierarchy information display
- Shows level badges, sub-account counts, and breadcrumbs
- Recommended for detail views and forms

#### Accessibility

- Proper ARIA labels for all interactive elements
- Keyboard navigation support for parent links
- Focus indicators for keyboard users
- High contrast mode support
- Reduced motion support for animations
- Screen reader friendly status announcements

#### Implementation Details

Per G3: Hierarchical Contacts Infrastructure:
- Maximum hierarchy depth: 3 levels (0-3)
- Parent accounts can have multiple sub-accounts
- Child accounts reference parent via `parent_id`
- Hierarchy level auto-calculated from depth

## Related Documentation

- [SPEC.md](../../SPEC.md) - Full specification
- [HIERARCHICAL_ACCOUNTS_INTEGRATION_PLAN.md](../../HIERARCHICAL_ACCOUNTS_INTEGRATION_PLAN.md) - Integration plan
- [Contact Schema](../../db/schema/contacts.schema.ts) - Database schema

### ParentAccountSelector

A searchable dropdown component for selecting a parent account when creating or editing contacts. Implements hierarchical account management with validation and progressive disclosure.

**Location**: `ParentAccountSelector.tsx`

**Quick Start**:
```tsx
import { ParentAccountSelector } from './components/contacts'

<ParentAccountSelector
  value={contact.parent_id}
  onChange={(parentId) => setContact({ ...contact, parent_id: parentId })}
  currentContactId={contact.id}
  companyId={contact.company_id}
/>
```

**Features**:
- Progressive disclosure (collapsed by default)
- Real-time validation (prevents circular references)
- Visual hierarchy indicators (📄 📁 └─)
- WCAG 2.1 AA accessible
- Only renders if user has 2+ contacts

**Documentation**:
- [Full Documentation](../../docs/components/ParentAccountSelector.md)
- [Architecture Diagrams](../../docs/components/ParentAccountSelector_ARCHITECTURE.md)
- [Implementation Summary](../../docs/components/ParentAccountSelector_IMPLEMENTATION_SUMMARY.md)
- [Usage Examples](./ParentAccountSelector.example.tsx)
- [Component Tests](./ParentAccountSelector.test.tsx)

