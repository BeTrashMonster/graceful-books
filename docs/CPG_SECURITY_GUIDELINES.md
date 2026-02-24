# CPG Module Security Guidelines

**Purpose:** Developer guidelines for maintaining secure access to CPG (Consumer Packaged Goods) data.
**Last Updated:** 2026-02-23
**Related Task:** S6-5 CPG Data Sharing Controls

---

## Overview

The CPG module uses a **company-scoped access model** where all CPG data is accessible to all authorized users within the company. No user-level ownership or selective sharing is implemented.

**Access Model:**
- ✅ Company-scoped: All company users can access company CPG data
- ✅ RBAC-controlled: Role-based permissions control actions
- ❌ No user-level ownership: CPG data has no `created_by_id` field
- ❌ No selective sharing: No `shared_with` or similar fields

---

## Security Principles

### 1. Company Boundary Enforcement

**Rule:** ALL CPG data queries MUST filter by `company_id`

**Correct Pattern:**
```typescript
// ✅ CORRECT: Filter by company_id
async function getCPGCategories(companyId: string) {
  const error = validateCompanyId(companyId);
  if (error) throw error;

  return db.cpgCategories
    .where('company_id')
    .equals(companyId)
    .and((cat) => cat.deleted_at === null)
    .toArray();
}
```

**Incorrect Pattern:**
```typescript
// ❌ WRONG: No company_id filter (IDOR vulnerability)
async function getCPGCategory(categoryId: string) {
  return db.cpgCategories.get(categoryId);
  // Any user could access any category by guessing ID!
}
```

**Fixed Pattern:**
```typescript
// ✅ CORRECT: Verify company ownership
async function getCPGCategory(categoryId: string, companyId: string) {
  const error = validateCompanyId(companyId);
  if (error) throw error;

  const category = await db.cpgCategories.get(categoryId);

  const authCheck = requireCompanyOwnership(category, companyId);
  if (!authCheck.authorized) {
    throw new Error(authCheck.error.message);
  }

  return authCheck.resource;
}
```

### 2. Authorization Helper Usage

**Always use authorization helpers from `src/utils/authorization.ts`:**

```typescript
import {
  requireCompanyOwnership,
  requireBatchCompanyOwnership,
  validateCompanyId,
  type AuthorizationResult
} from '../utils/authorization';
```

**Single Entity Check:**
```typescript
async function updateCPGDistributor(
  distributorId: string,
  companyId: string,
  updates: Partial<CPGDistributor>
) {
  // 1. Validate companyId parameter
  const error = validateCompanyId(companyId);
  if (error) throw error;

  // 2. Fetch entity
  const distributor = await db.cpgDistributors.get(distributorId);

  // 3. Verify ownership
  const authCheck = requireCompanyOwnership(distributor, companyId);
  if (!authCheck.authorized) {
    throw new Error(authCheck.error.message);
  }

  // 4. Safe to update - ownership verified
  await db.cpgDistributors.update(distributorId, {
    ...updates,
    updated_at: Date.now()
  });
}
```

**Batch Entity Check:**
```typescript
async function deleteCPGCategories(
  categoryIds: string[],
  companyId: string
) {
  const error = validateCompanyId(companyId);
  if (error) throw error;

  // Fetch all entities
  const categories = await db.cpgCategories.bulkGet(categoryIds);

  // Verify all belong to company
  const authCheck = requireBatchCompanyOwnership(categories, companyId);
  if (!authCheck.authorized) {
    throw new Error(authCheck.error.message);
  }

  // Safe to delete - all verified
  await db.cpgCategories.bulkUpdate(
    categoryIds.map(id => ({ key: id, changes: { deleted_at: Date.now() } }))
  );
}
```

### 3. Never Reveal Resource Existence

**Security Principle:** If user lacks access, return `NOT_FOUND` (not `FORBIDDEN`)

**Why:** Prevents information leakage about other companies' data

```typescript
// ✅ CORRECT: Returns NOT_FOUND for unauthorized access
const authCheck = requireCompanyOwnership(entity, companyId);
if (!authCheck.authorized) {
  // Always returns: { code: 'NOT_FOUND', message: 'Resource not found' }
  throw new Error(authCheck.error.message);
}
```

**Never do this:**
```typescript
// ❌ WRONG: Reveals entity exists
if (entity.company_id !== companyId) {
  throw new Error('Access denied to this entity');
  // Attacker learns: "Entity exists but I can't access it"
}
```

---

## CPG Entity Types

### Entity Overview

All CPG entities follow the same authorization pattern:

| Entity | Table | Company Field | Purpose |
|--------|-------|---------------|---------|
| CPGCategory | `cpgCategories` | `company_id` | Cost categories (Oil, Bottle, etc.) |
| CPGInvoice | `cpgInvoices` | `company_id` | Invoice entries with cost attribution |
| CPGDistributor | `cpgDistributors` | `company_id` | Distributor profiles & fees |
| CPGDistributionCalculation | `cpgDistributionCalculations` | `company_id` | Saved distribution scenarios |
| CPGSalesPromo | `cpgSalesPromos` | `company_id` | Trade spend analysis |
| CPGFinishedProduct | `cpgFinishedProducts` | `company_id` | Manufactured products |
| CPGRecipe | `cpgRecipes` | `company_id` | Bill of materials |
| CPGSettings | `cpgSettings` | `company_id` | Company CPG settings |

### Database Schema Indexes

All CPG tables have indexes that include `company_id`:

```typescript
// Examples from cpg.schema.ts
export const cpgCategoriesSchema =
  'id, company_id, active, [company_id+active], sort_order, updated_at, deleted_at';

export const cpgDistributorsSchema =
  'id, company_id, name, active, [company_id+active], linked_contact_id, updated_at, deleted_at';

export const cpgDistributionCalculationsSchema =
  'id, company_id, distributor_id, [company_id+distributor_id], [company_id+is_draft], calculation_date, is_draft, active, updated_at, deleted_at';
```

**Performance Benefit:** Compound indexes with `company_id` first enable efficient querying.

---

## Common Patterns

### Pattern 1: Query by Company

```typescript
// List all active distributors for company
async function getActiveDistributors(companyId: string) {
  const error = validateCompanyId(companyId);
  if (error) throw error;

  return db.cpgDistributors
    .where('[company_id+active]')
    .equals([companyId, true])
    .and((dist) => dist.deleted_at === null)
    .toArray();
}
```

### Pattern 2: Get Single Entity

```typescript
// Get single distributor with authorization check
async function getDistributor(distributorId: string, companyId: string) {
  const error = validateCompanyId(companyId);
  if (error) throw error;

  const distributor = await db.cpgDistributors.get(distributorId);

  const authCheck = requireCompanyOwnership(distributor, companyId);
  if (!authCheck.authorized) {
    throw new Error(authCheck.error.message);
  }

  return authCheck.resource;
}
```

### Pattern 3: Create Entity

```typescript
// Create new CPG category
async function createCPGCategory(
  companyId: string,
  deviceId: string,
  data: Partial<CPGCategory>
) {
  const error = validateCompanyId(companyId);
  if (error) throw error;

  const category = createDefaultCPGCategory(
    companyId,
    data.name!,
    deviceId,
    data.variants,
    data.unit_of_measure
  );

  const id = crypto.randomUUID();
  await db.cpgCategories.add({ ...category, id });

  return { ...category, id };
}
```

### Pattern 4: Update Entity

```typescript
// Update CPG category with ownership verification
async function updateCPGCategory(
  categoryId: string,
  companyId: string,
  updates: Partial<CPGCategory>
) {
  const error = validateCompanyId(companyId);
  if (error) throw error;

  const category = await db.cpgCategories.get(categoryId);

  const authCheck = requireCompanyOwnership(category, companyId);
  if (!authCheck.authorized) {
    throw new Error(authCheck.error.message);
  }

  await db.cpgCategories.update(categoryId, {
    ...updates,
    updated_at: Date.now()
  });
}
```

### Pattern 5: Soft Delete

```typescript
// Soft delete CPG category
async function deleteCPGCategory(categoryId: string, companyId: string) {
  const error = validateCompanyId(companyId);
  if (error) throw error;

  const category = await db.cpgCategories.get(categoryId);

  const authCheck = requireCompanyOwnership(category, companyId);
  if (!authCheck.authorized) {
    throw new Error(authCheck.error.message);
  }

  await db.cpgCategories.update(categoryId, {
    active: false,
    deleted_at: Date.now(),
    updated_at: Date.now()
  });
}
```

---

## UI Component Guidelines

### Component Props

**Always require `companyId` prop:**

```typescript
interface CPGComponentProps {
  companyId: string;  // ← REQUIRED
  deviceId: string;
  // ... other props
}

export function CPGComponent({ companyId, deviceId }: CPGComponentProps) {
  // Use companyId in all queries
}
```

### Data Fetching

```typescript
// ✅ CORRECT: Pass companyId to query
useEffect(() => {
  async function loadData() {
    const categories = await db.cpgCategories
      .where('company_id')
      .equals(companyId)  // ← From props
      .toArray();

    setCategories(categories);
  }

  loadData();
}, [companyId]);
```

```typescript
// ❌ WRONG: No company filtering
useEffect(() => {
  async function loadData() {
    const categories = await db.cpgCategories.toArray();
    // Returns ALL categories from ALL companies!
    setCategories(categories);
  }

  loadData();
}, []);
```

### User Context

```typescript
// Get companyId from authenticated user context
function CPGPage() {
  const { user, currentCompany } = useAuth();

  if (!currentCompany) {
    return <div>Please select a company</div>;
  }

  return (
    <CPGComponent
      companyId={currentCompany.id}
      deviceId={user.deviceId}
    />
  );
}
```

---

## RBAC Integration

### Role-Based Permissions

CPG data access is controlled by user roles:

| Role | View | Create | Edit | Delete | Settings |
|------|------|--------|------|--------|----------|
| View-Only | ✅ | ❌ | ❌ | ❌ | ❌ |
| Bookkeeper | ✅ | ✅ | ✅ | ✅ | ❌ |
| Manager | ✅ | ✅ | ✅ | ✅ | ✅ |
| Admin | ✅ | ✅ | ✅ | ✅ | ✅ |

### Permission Checks

```typescript
// Check user has permission for action
function canEditCPGData(userRole: UserRole): boolean {
  return ['BOOKKEEPER', 'MANAGER', 'ADMIN'].includes(userRole);
}

// In component
const canEdit = canEditCPGData(user.role);

return (
  <Button
    onClick={handleEdit}
    disabled={!canEdit}
  >
    Edit
  </Button>
);
```

### UI Conditional Rendering

```typescript
// Show/hide features based on role
{user.role !== 'VIEW_ONLY' && (
  <Button onClick={handleCreate}>
    Add Category
  </Button>
)}

{['MANAGER', 'ADMIN'].includes(user.role) && (
  <Link to="/cpg/settings">
    Settings
  </Link>
)}
```

---

## Testing Requirements

### 1. Authorization Tests

**Test cross-company isolation:**

```typescript
describe('CPG Category Authorization', () => {
  it('should not return categories from other companies', async () => {
    const company1 = await createTestCompany();
    const company2 = await createTestCompany();

    await createCPGCategory(company1.id, 'Oil');
    await createCPGCategory(company1.id, 'Bottle');
    await createCPGCategory(company2.id, 'Box');

    const company1Categories = await db.cpgCategories
      .where('company_id')
      .equals(company1.id)
      .toArray();

    expect(company1Categories).toHaveLength(2);
    expect(company1Categories.every(c => c.company_id === company1.id)).toBe(true);
  });
});
```

**Test ownership verification:**

```typescript
it('should prevent updating categories from other companies', async () => {
  const company1 = await createTestCompany();
  const company2 = await createTestCompany();

  const category = await createCPGCategory(company1.id, 'Oil');

  await expect(
    updateCPGCategory(category.id, company2.id, { name: 'Modified' })
  ).rejects.toThrow('Resource not found');
});
```

### 2. RBAC Tests

```typescript
describe('CPG RBAC Permissions', () => {
  it('should allow View-Only role to read CPG data', async () => {
    const user = await createTestUser('VIEW_ONLY');
    const categories = await getCPGCategoriesWithRBAC(companyId, user.role);
    expect(categories.length).toBeGreaterThan(0);
  });

  it('should prevent View-Only role from editing', async () => {
    const user = await createTestUser('VIEW_ONLY');
    await expect(
      updateCPGCategoryWithRBAC(categoryId, companyId, updates, user.role)
    ).rejects.toThrow('Insufficient permissions');
  });
});
```

### 3. Integration Tests

```typescript
describe('CPG Distribution Calculation Flow', () => {
  it('should create calculation only for user company', async () => {
    const company = await createTestCompany();
    const distributor = await createCPGDistributor(company.id, 'Acme');

    const calculation = await createDistributionCalculation(
      company.id,
      distributor.id,
      { /* data */ }
    );

    expect(calculation.company_id).toBe(company.id);

    // Verify cannot access from other company
    const otherCompany = await createTestCompany();
    const calculations = await getDistributionCalculations(otherCompany.id);
    expect(calculations).not.toContainEqual(
      expect.objectContaining({ id: calculation.id })
    );
  });
});
```

---

## Anti-Patterns to Avoid

### ❌ Anti-Pattern 1: Direct Entity Access

```typescript
// ❌ WRONG: Get entity without company check
async function getCategory(categoryId: string) {
  return db.cpgCategories.get(categoryId);
}
```

**Fix:**
```typescript
// ✅ CORRECT: Verify company ownership
async function getCategory(categoryId: string, companyId: string) {
  const error = validateCompanyId(companyId);
  if (error) throw error;

  const category = await db.cpgCategories.get(categoryId);
  const authCheck = requireCompanyOwnership(category, companyId);

  if (!authCheck.authorized) {
    throw new Error(authCheck.error.message);
  }

  return authCheck.resource;
}
```

### ❌ Anti-Pattern 2: Optional Company Filter

```typescript
// ❌ WRONG: Company filter is optional
async function getCPGCategories(companyId?: string) {
  let query = db.cpgCategories.toCollection();

  if (companyId) {
    query = query.filter(c => c.company_id === companyId);
  }

  return query.toArray();
}
```

**Fix:**
```typescript
// ✅ CORRECT: Company filter is required
async function getCPGCategories(companyId: string) {
  const error = validateCompanyId(companyId);
  if (error) throw error;

  return db.cpgCategories
    .where('company_id')
    .equals(companyId)
    .toArray();
}
```

### ❌ Anti-Pattern 3: Client-Side Filtering Only

```typescript
// ❌ WRONG: Fetch all, then filter client-side
async function getCPGCategories(companyId: string) {
  const allCategories = await db.cpgCategories.toArray();
  return allCategories.filter(c => c.company_id === companyId);
}
```

**Problems:**
- Inefficient (loads unnecessary data)
- Security risk (all data in memory momentarily)
- No database index benefit

**Fix:**
```typescript
// ✅ CORRECT: Filter at database level
async function getCPGCategories(companyId: string) {
  return db.cpgCategories
    .where('company_id')
    .equals(companyId)
    .toArray();
}
```

### ❌ Anti-Pattern 4: Revealing Forbidden Access

```typescript
// ❌ WRONG: Different error messages leak information
if (!entity) {
  throw new Error('Entity not found');
}
if (entity.company_id !== companyId) {
  throw new Error('Access denied');  // ← Reveals entity exists!
}
```

**Fix:**
```typescript
// ✅ CORRECT: Consistent NOT_FOUND for both cases
const authCheck = requireCompanyOwnership(entity, companyId);
if (!authCheck.authorized) {
  // Always: 'Resource not found'
  throw new Error(authCheck.error.message);
}
```

---

## Migration & Future Considerations

### If Sharing Becomes Needed

If future requirements demand user-level sharing:

1. **Add ownership fields:**
   ```typescript
   interface CPGDistributionCalculation {
     // ... existing fields
     created_by_user_id: string | null;
     shared_with: string[] | null;
     is_public: boolean;
   }
   ```

2. **Create sharing service:**
   ```typescript
   shareCPGCalculation(calcId: string, targetUserId: string, permissions: string[])
   revokeCPGCalculationShare(calcId: string, targetUserId: string)
   ```

3. **Update authorization logic:**
   ```typescript
   function canAccessCPGCalculation(calc, userId, companyId) {
     return calc.company_id === companyId &&
            (calc.created_by_user_id === userId ||
             calc.shared_with?.includes(userId) ||
             calc.is_public);
   }
   ```

4. **Database migration:**
   ```typescript
   // Set existing records to public
   await db.cpgDistributionCalculations.toCollection().modify({
     created_by_user_id: null,
     shared_with: null,
     is_public: true
   });
   ```

**See:** `docs/TASK_S6-5_CPG_DATA_SHARING_ANALYSIS.md` Section 8.2 for complete migration plan.

---

## Quick Reference

### ✅ Security Checklist

- [ ] All CPG functions require `companyId` parameter
- [ ] All database queries filter by `company_id`
- [ ] `validateCompanyId()` called before queries
- [ ] `requireCompanyOwnership()` used for single entity access
- [ ] `requireBatchCompanyOwnership()` used for bulk operations
- [ ] Unauthorized access returns `NOT_FOUND` (not `FORBIDDEN`)
- [ ] UI components receive `companyId` from auth context
- [ ] RBAC permissions checked for actions
- [ ] Tests verify cross-company isolation
- [ ] Tests verify RBAC enforcement

### 📚 Key Files

- **Authorization helpers:** `src/utils/authorization.ts`
- **CPG schema:** `src/db/schema/cpg.schema.ts`
- **Review checklist:** `Roadmaps/AGENT_REVIEW_CHECKLIST.md`
- **Security audit:** `SECURITY_AUDIT_REPORT.md`
- **Task analysis:** `docs/TASK_S6-5_CPG_DATA_SHARING_ANALYSIS.md`

### 🔗 Related Documentation

- OWASP A01:2021 - Broken Access Control
- Zero-Knowledge Encryption Architecture (SPEC.md)
- IDOR Prevention Patterns (Security Audit Report)
- Group H1: Multi-User Support (ROADMAP.md)
- Agent Review Checklist (Authorization section)

---

**Last Updated:** 2026-02-23
**Task:** S6-5 CPG Data Sharing Controls
**Status:** Company-scoped access model - no sharing needed
**Reviewed By:** Claude Sonnet 4.5
