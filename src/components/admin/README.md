# Admin Components

Admin-only UI components for managing charities and other platform administration tasks.

## Components

### CharityManagement
Main dashboard for charity administration. Displays statistics and integrates CharityList.

**Usage:**
```tsx
import { CharityManagement } from './CharityManagement';

<CharityManagement />
```

**Features:**
- Statistics cards (Total, Verified, Pending, Rejected, Inactive)
- Filter by status (click cards)
- Add new charity button
- Auto-refresh on updates

### CharityVerificationForm
Form for adding new charities with 5-step verification workflow.

**Usage:**
```tsx
import { CharityVerificationForm } from './CharityVerificationForm';

<CharityVerificationForm
  onSuccess={() => console.log('Charity created')}
  onCancel={() => console.log('Form cancelled')}
/>
```

**5-Step Workflow:**
1. Initial submission (form fields)
2. EIN format validation (automated)
3. IRS verification (manual, post-creation)
4. Website verification (manual, post-creation)
5. Final approval (manual, post-creation)

### CharityList
Displays charities in a table with search, filters, and detail modal.

**Usage:**
```tsx
import { CharityList } from './CharityList';

<CharityList
  statusFilter="PENDING"
  onCharityUpdated={() => console.log('Charity updated')}
  refreshTrigger={0}
/>
```

**Features:**
- Search by name, EIN, description
- Status badges with color coding
- Detail modal with verification workflow
- Add notes, verify, reject, remove actions

## Access Control

All admin routes are protected by `AdminRoute` wrapper.

**Example:**
```tsx
import { AdminRoute } from '../../routes/AdminRoute';

<AdminRoute>
  <CharityManagement />
</AdminRoute>
```

**Requirements:**
- User must be authenticated
- User must have `role === 'admin'` OR `isAdmin === true` in localStorage

**Non-admin behavior:**
- Redirects to `/login` if not authenticated
- Redirects to `/forbidden` if authenticated but not admin

## Service API

All operations use `src/services/admin/charity.service.ts`.

**Example:**
```typescript
import {
  createCharity,
  verifyCharity,
  getVerifiedCharities
} from '../../services/admin/charity.service';

// Create charity
await createCharity({
  name: 'Charity Name',
  ein: '12-3456789',
  description: 'Mission',
  category: 'EDUCATION',
  website: 'https://example.org',
  createdBy: 'admin-id',
});

// Verify charity
await verifyCharity({
  charityId: 'charity-id',
  verifiedBy: 'admin-id',
});

// Get verified charities (for user dropdown)
const verified = await getVerifiedCharities();
```

## WCAG 2.1 AA Compliance

All admin components meet WCAG 2.1 AA standards:

- ✅ Keyboard navigation (Tab, Enter, ESC)
- ✅ Focus indicators on all interactive elements
- ✅ ARIA labels and roles
- ✅ Color contrast ≥ 4.5:1
- ✅ Form labels and error messages
- ✅ Modal focus traps

## Testing

```bash
# Run admin service tests
npm test src/services/admin/charity.service.test.ts

# Run admin route tests
npm test src/routes/AdminRoute.test.tsx

# Run all admin tests
npm test admin
```

## Seed Data

Seed database with 15 pre-verified charities:

```typescript
import { seedCharities } from '../../db/seeds';

await seedCharities();
```

See `src/db/seeds/charities.seed.ts` for list of seeded charities.
