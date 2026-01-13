# Customer Management Components

Components for managing customer records in Graceful Books.

**Spec Reference:** ACCT-002
**Feature:** C6: Client/Customer Management - Basic

## Components

### CustomerForm

Form component for creating and editing customers.

**Features:**
- Name, email, phone, and address fields
- Email and phone validation with user-friendly error messages
- Optional mailing address section
- Notes field for internal information
- Active/inactive status toggle
- Steadiness communication style throughout

**Usage:**
```tsx
import { CustomerForm } from '@/components/customers'

<CustomerForm
  companyId="company-123"
  onSubmit={handleSubmit}
  onCancel={handleCancel}
  isSubmitting={false}
/>

// Edit mode
<CustomerForm
  customer={existingCustomer}
  companyId="company-123"
  onSubmit={handleUpdate}
  onCancel={handleCancel}
/>
```

### CustomerCard

Display component for individual customer information.

**Features:**
- Customer name and status
- Contact information (email, phone, address)
- Notes display
- Quick action buttons (edit, delete)
- Clickable for detail views
- Compact variant available

**Usage:**
```tsx
import { CustomerCard } from '@/components/customers'

<CustomerCard
  customer={customer}
  showActions
  onEdit={handleEdit}
  onDelete={handleDelete}
  variant="default"
/>
```

### CustomerList

List view with search, filter, and sort capabilities.

**Features:**
- Search by name, email, phone, or address
- Filter by active/inactive status
- Sort by name, email, or recent
- Milestone celebrations (1st, 10th, 25th, 50th, 100th customer)
- Empty state with encouraging message
- Loading state

**Usage:**
```tsx
import { CustomerList } from '@/components/customers'

<CustomerList
  customers={customers}
  onEdit={handleEdit}
  onDelete={handleDelete}
  onCreate={handleCreate}
  isLoading={false}
  customerCount={customers.length}
/>
```

## Joy Opportunities

The customer management feature includes several celebration moments:

- **First customer:** "Your first customer! Every business started with one."
- **10 customers:** "10 customers! Your client base is growing."
- **25 customers:** "25 customers! You're building something special."
- **50 customers:** "50 customers! Half a hundred strong!"
- **100 customers:** "100 customers! What an incredible milestone!"

## Validation

### Email Validation
- Format: `name@domain.com`
- Error message: "That email doesn't look quite right. It should be something like name@example.com"

### Phone Validation
- Requires at least 10 digits
- Flexible format (accepts various formats)
- Error message: "Please enter a valid phone number with at least 10 digits"

### Required Fields
- **Name:** Required for all customers
- **Address fields:** All required if any address field is filled (line1, city, state, postal code, country)

## Accessibility

All components meet WCAG 2.1 AA standards:

- Keyboard navigation support
- ARIA labels and descriptions
- Focus indicators with 3:1 contrast
- Screen reader announcements for validation
- Reduced motion support
- High contrast mode support

## Data Encryption

The following fields are encrypted at rest:
- Name
- Email
- Phone
- Address (all fields)
- Notes

See `src/store/contacts.ts` for encryption implementation.

## Testing

Tests are located in:
- `CustomerForm.test.tsx`

Run tests with:
```bash
npm test -- CustomerForm.test.tsx
```

## Dependencies

- Uses `src/hooks/useCustomers.ts` for data operations
- Leverages `src/store/contacts.ts` for CRUD operations
- Integrates with existing form components (`Input`, `Checkbox`)
- Uses `Modal` component for dialogs
