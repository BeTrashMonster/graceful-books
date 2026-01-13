# HierarchyIndicator Integration Guide

Quick guide for integrating the HierarchyIndicator component into your contact views.

## Installation

The component is already installed in `src/components/contacts/`. No additional dependencies required.

## Import

```typescript
import { HierarchyIndicator } from '@/components/contacts'
// or
import { HierarchyIndicator } from './components/contacts'
```

## Basic Usage

### 1. In a Contact List (Compact View)

```tsx
import { HierarchyIndicator } from '@/components/contacts'
import type { Contact } from '@/types/database.types'

function ContactListItem({ contact }: { contact: Contact }) {
  return (
    <div className="contact-item">
      <h3>{contact.name}</h3>

      {/* Only shows for parent/child accounts */}
      <HierarchyIndicator
        contact={contact}
        view="compact"
        subAccountCount={contact.account_type === 'parent' ? 3 : 0}
      />

      <p>{contact.email}</p>
    </div>
  )
}
```

### 2. In a Contact Detail View (Expanded View)

```tsx
import { HierarchyIndicator } from '@/components/contacts'
import { useNavigate } from 'react-router-dom'

function ContactDetailView({ contact, parentContact }: Props) {
  const navigate = useNavigate()

  return (
    <div className="contact-details">
      <h1>{contact.name}</h1>

      {/* Full hierarchy information */}
      <HierarchyIndicator
        contact={contact}
        view="expanded"
        subAccountCount={subAccounts.length}
        parentName={parentContact?.name}
        onNavigateToParent={(parentId) => navigate(`/contacts/${parentId}`)}
      />

      {/* Rest of contact details */}
    </div>
  )
}
```

### 3. In a Contact Form

```tsx
import { HierarchyIndicator } from '@/components/contacts'

function ContactForm({ contact }: Props) {
  return (
    <form>
      {/* Other form fields */}

      <div className="form-section">
        <label>Account Hierarchy</label>
        <HierarchyIndicator
          contact={contact}
          view="expanded"
          parentName={selectedParent?.name}
        />
      </div>

      {/* More form fields */}
    </form>
  )
}
```

## Getting Sub-account Count

You'll need to query the sub-account count for parent accounts:

```typescript
import { queryContacts } from '@/store/contacts'

async function getSubAccountCount(contactId: string, companyId: string): Promise<number> {
  const result = await queryContacts({
    companyId,
    includeDeleted: false,
  })

  if (!result.success) return 0

  return result.data.filter(c => c.parent_id === contactId).length
}
```

Or with a React hook:

```typescript
function useSubAccountCount(contactId: string | null) {
  const [count, setCount] = useState(0)
  const { contacts } = useContacts()

  useEffect(() => {
    if (!contactId) {
      setCount(0)
      return
    }

    const subAccounts = contacts.filter(c => c.parent_id === contactId)
    setCount(subAccounts.length)
  }, [contactId, contacts])

  return count
}

// Usage
function ContactCard({ contact }: Props) {
  const subAccountCount = useSubAccountCount(
    contact.account_type === 'parent' ? contact.id : null
  )

  return (
    <HierarchyIndicator
      contact={contact}
      view="expanded"
      subAccountCount={subAccountCount}
    />
  )
}
```

## Getting Parent Contact

For child accounts, you may want to fetch the parent contact:

```typescript
function useParentContact(parentId: string | null) {
  const [parent, setParent] = useState<Contact | null>(null)
  const { contacts } = useContacts()

  useEffect(() => {
    if (!parentId) {
      setParent(null)
      return
    }

    const parentContact = contacts.find(c => c.id === parentId)
    setParent(parentContact || null)
  }, [parentId, contacts])

  return parent
}

// Usage
function ContactCard({ contact }: Props) {
  const parent = useParentContact(contact.parent_id)

  return (
    <HierarchyIndicator
      contact={contact}
      view="expanded"
      parentName={parent?.name}
      onNavigateToParent={(id) => navigate(`/contacts/${id}`)}
    />
  )
}
```

## Complete Example

Full integration example with all features:

```tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { HierarchyIndicator } from '@/components/contacts'
import type { Contact } from '@/types/database.types'

interface ContactCardProps {
  contact: Contact
  allContacts: Contact[]
}

function ContactCard({ contact, allContacts }: ContactCardProps) {
  const navigate = useNavigate()

  // Get sub-account count for parent accounts
  const subAccountCount = contact.account_type === 'parent'
    ? allContacts.filter(c => c.parent_id === contact.id).length
    : 0

  // Get parent contact for child accounts
  const parentContact = contact.parent_id
    ? allContacts.find(c => c.id === contact.parent_id)
    : null

  const handleNavigateToParent = (parentId: string) => {
    navigate(`/contacts/${parentId}`)
  }

  return (
    <div className="contact-card">
      <h2>{contact.name}</h2>

      {/* Hierarchy Indicator */}
      <HierarchyIndicator
        contact={contact}
        view="expanded"
        subAccountCount={subAccountCount}
        parentName={parentContact?.name}
        onNavigateToParent={handleNavigateToParent}
      />

      {/* Contact details */}
      <div className="contact-details">
        {contact.email && <p>Email: {contact.email}</p>}
        {contact.phone && <p>Phone: {contact.phone}</p>}
      </div>

      {/* Sub-accounts list (for parent accounts) */}
      {contact.account_type === 'parent' && subAccountCount > 0 && (
        <div className="sub-accounts">
          <h3>Sub-Accounts ({subAccountCount})</h3>
          <ul>
            {allContacts
              .filter(c => c.parent_id === contact.id)
              .map(sub => (
                <li key={sub.id}>
                  <a href={`/contacts/${sub.id}`}>{sub.name}</a>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default ContactCard
```

## Styling

The component uses CSS Modules and respects your app's CSS custom properties:

```css
/* Your global styles or theme */
:root {
  --primary: #3b82f6;
  --primary-dark: #2563eb;
  --primary-bg: #eff6ff;
  --text-secondary: #6b7280;
  --bg-secondary: #f3f4f6;
  --focus-ring: #93c5fd;
}
```

### Custom Styling

Add custom styles via the `className` prop:

```tsx
<HierarchyIndicator
  contact={contact}
  view="expanded"
  className="my-custom-class"
/>
```

```css
/* Your custom CSS */
.my-custom-class {
  border: 1px solid #e5e7eb;
  padding: 1rem;
  border-radius: 0.5rem;
  background: #fafafa;
}
```

## Accessibility

The component is fully accessible out of the box:

- Screen reader announcements
- Keyboard navigation
- Focus indicators
- High contrast mode support
- Reduced motion support

No additional configuration needed!

## Conditional Rendering

Show hierarchy info only when relevant:

```tsx
// Only show for non-standalone accounts
{contact.account_type !== 'standalone' && (
  <HierarchyIndicator
    contact={contact}
    view="compact"
    subAccountCount={subAccountCount}
  />
)}

// Or always show (compact view hides standalone automatically)
<HierarchyIndicator contact={contact} view="compact" />
```

## Best Practices

1. **Use compact view in lists** - Saves space, shows only essential info
2. **Use expanded view in details** - Shows full hierarchy information
3. **Provide navigation callback** - Allows users to quickly jump to parent
4. **Cache sub-account counts** - Avoid recalculating on every render
5. **Show parent name** - Helps users understand hierarchy context
6. **Handle loading states** - Show placeholder while loading counts

## Performance Tips

```tsx
// Memoize sub-account count calculation
const subAccountCount = useMemo(() => {
  if (contact.account_type !== 'parent') return 0
  return allContacts.filter(c => c.parent_id === contact.id).length
}, [contact.account_type, contact.id, allContacts])

// Memoize parent lookup
const parentContact = useMemo(() => {
  if (!contact.parent_id) return null
  return allContacts.find(c => c.id === contact.parent_id) || null
}, [contact.parent_id, allContacts])
```

## Troubleshooting

### Component not showing anything
- Check if contact has `account_type !== 'standalone'` for compact view
- Verify `contact` prop has all required hierarchy fields

### Parent navigation not working
- Ensure `onNavigateToParent` callback is provided
- Check that `parent_id` is not null
- Verify navigation function is correct

### Sub-account count not showing
- Ensure `subAccountCount > 0`
- Check that `account_type === 'parent'`
- Verify prop is being passed correctly

### Styling issues
- Check that CSS custom properties are defined
- Verify CSS Module import is working
- Check browser dev tools for CSS conflicts

## Need Help?

- Check the [README](./README.md) for detailed documentation
- See [examples](./HierarchyIndicator.example.tsx) for more use cases
- Review [tests](./HierarchyIndicator.test.tsx) for edge cases
- Refer to [IMPLEMENTATION_SUMMARY](./IMPLEMENTATION_SUMMARY.md) for technical details
