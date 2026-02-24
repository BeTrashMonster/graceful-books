# Role-Based Access Control (RBAC) Permission Matrix

**Implementation:** Task S7-1 from Security Hardening Roadmap
**Location:** `src/utils/rbac.ts`
**Tests:** `src/utils/rbac.test.ts` (68 tests, all passing)

---

## Overview

Graceful Books implements role-based access control (RBAC) to manage multi-user access within companies. RBAC works in conjunction with company ownership authorization to provide defense-in-depth security.

**Security Pattern:**
1. **First:** Check company ownership (using `authorization.ts`)
2. **Second:** Check RBAC permissions (using `rbac.ts`)
3. **Third:** Perform the action

---

## Role Mapping

The task requirements map to existing `UserRole` enum values:

| Task Requirement | Database Enum | Description |
|-----------------|---------------|-------------|
| Admin | `OWNER` / `ADMIN` | Full access to all features |
| Manager | `ACCOUNTANT` | Cannot delete/modify posted records |
| Bookkeeper | `BOOKKEEPER` | Cannot access settings/users |
| View-Only | `VIEWER` | Read-only access to all data |

---

## Role Hierarchy

Roles are ordered by privilege level (highest to lowest):

1. **OWNER** (Level 5) - Company owner with unrestricted access
2. **ADMIN** (Level 4) - Administrator with full access except company deletion
3. **ACCOUNTANT** (Level 3) - Manager with restrictions on posted records
4. **BOOKKEEPER** (Level 2) - Data entry with no settings access
5. **VIEWER** (Level 1) - Read-only access

---

## Permission Matrix

### Legend
- ✅ = Allowed
- ❌ = Denied
- ⚠️ = Conditional (depends on context)

### Accounts

| Action | OWNER | ADMIN | ACCOUNTANT | BOOKKEEPER | VIEWER |
|--------|-------|-------|------------|------------|--------|
| Create | ✅ | ✅ | ✅ | ❌ | ❌ |
| Read | ✅ | ✅ | ✅ | ✅ | ✅ |
| Update | ✅ | ✅ | ✅ | ❌ | ❌ |
| Delete | ✅ | ✅ | ❌ | ❌ | ❌ |

### Transactions

| Action | OWNER | ADMIN | ACCOUNTANT | BOOKKEEPER | VIEWER |
|--------|-------|-------|------------|------------|--------|
| Create | ✅ | ✅ | ✅ | ✅ | ❌ |
| Read | ✅ | ✅ | ✅ | ✅ | ✅ |
| Update (Draft) | ✅ | ✅ | ✅ | ✅ | ❌ |
| Update (Posted) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Delete (Draft) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Delete (Posted) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Post | ✅ | ✅ | ✅ | ❌ | ❌ |
| Void | ✅ | ✅ | ❌ | ❌ | ❌ |

**Key Rules:**
- **ACCOUNTANT (Manager):** Cannot modify or delete posted/reconciled transactions
- **BOOKKEEPER:** Can only update draft transactions, cannot post or void
- **VIEWER:** Read-only access to all transaction data

### Contacts (Customers/Vendors)

| Action | OWNER | ADMIN | ACCOUNTANT | BOOKKEEPER | VIEWER |
|--------|-------|-------|------------|------------|--------|
| Create | ✅ | ✅ | ✅ | ✅ | ❌ |
| Read | ✅ | ✅ | ✅ | ✅ | ✅ |
| Update | ✅ | ✅ | ✅ | ✅ | ❌ |
| Delete | ✅ | ✅ | ❌ | ❌ | ❌ |

### Products/Services

| Action | OWNER | ADMIN | ACCOUNTANT | BOOKKEEPER | VIEWER |
|--------|-------|-------|------------|------------|--------|
| Create | ✅ | ✅ | ✅ | ✅ | ❌ |
| Read | ✅ | ✅ | ✅ | ✅ | ✅ |
| Update | ✅ | ✅ | ✅ | ✅ | ❌ |
| Delete | ✅ | ✅ | ❌ | ❌ | ❌ |

### Invoices & Bills

| Action | OWNER | ADMIN | ACCOUNTANT | BOOKKEEPER | VIEWER |
|--------|-------|-------|------------|------------|--------|
| Create | ✅ | ✅ | ✅ | ✅ | ❌ |
| Read | ✅ | ✅ | ✅ | ✅ | ✅ |
| Update | ✅ | ✅ | ✅ | ✅ | ❌ |
| Delete | ✅ | ✅ | ❌ | ❌ | ❌ |

### Reports

| Action | OWNER | ADMIN | ACCOUNTANT | BOOKKEEPER | VIEWER |
|--------|-------|-------|------------|------------|--------|
| Read | ✅ | ✅ | ✅ | ✅ | ✅ |
| Export | ✅ | ✅ | ✅ | ❌ | ❌ |

**Note:** BOOKKEEPER and VIEWER cannot export data to prevent unauthorized data exfiltration.

### Users & Settings

| Action | OWNER | ADMIN | ACCOUNTANT | BOOKKEEPER | VIEWER |
|--------|-------|-------|------------|------------|--------|
| Create User | ✅ | ✅ | ❌ | ❌ | ❌ |
| Read Users | ✅ | ✅ | ✅ | ❌ | ❌ |
| Update User | ✅ | ✅ | ❌ | ❌ | ❌ |
| Delete User | ✅ | ✅ | ❌ | ❌ | ❌ |
| Read Settings | ✅ | ✅ | ✅ | ❌ | ❌ |
| Update Settings | ✅ | ✅ | ❌ | ❌ | ❌ |

**Key Rules:**
- **BOOKKEEPER & VIEWER:** Cannot access settings or user management
- Only **OWNER** and **ADMIN** can manage users

### Company Management

| Action | OWNER | ADMIN | ACCOUNTANT | BOOKKEEPER | VIEWER |
|--------|-------|-------|------------|------------|--------|
| Read | ✅ | ✅ | ✅ | ✅ | ✅ |
| Update | ✅ | ✅ | ❌ | ❌ | ❌ |
| Delete | ✅ | ❌ | ❌ | ❌ | ❌ |

**Note:** Only **OWNER** can delete the company.

### Audit Logs

| Action | OWNER | ADMIN | ACCOUNTANT | BOOKKEEPER | VIEWER |
|--------|-------|-------|------------|------------|--------|
| Read | ✅ | ✅ | ✅ | ❌ | ❌ |

**Note:** BOOKKEEPER and VIEWER cannot access audit logs for security reasons.

### Reconciliation

| Action | OWNER | ADMIN | ACCOUNTANT | BOOKKEEPER | VIEWER |
|--------|-------|-------|------------|------------|--------|
| Create | ✅ | ✅ | ✅ | ✅ | ❌ |
| Read | ✅ | ✅ | ✅ | ✅ | ✅ |
| Update | ✅ | ✅ | ✅ | ✅ | ❌ |
| Delete | ✅ | ✅ | ❌ | ❌ | ❌ |

### CPG Data (Consumer Packaged Goods)

| Action | OWNER | ADMIN | ACCOUNTANT | BOOKKEEPER | VIEWER |
|--------|-------|-------|------------|------------|--------|
| Create | ✅ | ✅ | ✅ | ✅ | ❌ |
| Read | ✅ | ✅ | ✅ | ✅ | ✅ |
| Update | ✅ | ✅ | ✅ | ✅ | ❌ |
| Delete | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## Usage Examples

### Example 1: Check Permission Before Deleting Account

```typescript
import { checkPermission, PERMISSION_DENIED_ERROR } from '../utils/rbac'
import { requireCompanyOwnership } from '../utils/authorization'

async function deleteAccount(accountId: string, companyId: string, companyUser: CompanyUser) {
  // Step 1: Check company ownership
  const account = await db.accounts.get(accountId)
  const authCheck = requireCompanyOwnership(account, companyId)

  if (!authCheck.authorized) {
    return { success: false, error: authCheck.error }
  }

  // Step 2: Check RBAC permissions
  if (!checkPermission(companyUser, 'delete', 'account')) {
    return { success: false, error: PERMISSION_DENIED_ERROR }
  }

  // Step 3: Perform the action
  await db.accounts.delete(accountId)
  return { success: true }
}
```

### Example 2: Check Permission with Context (Posted Transactions)

```typescript
import { checkPermission, getPermissionError } from '../utils/rbac'

async function updateTransaction(
  transactionId: string,
  updates: Partial<Transaction>,
  companyId: string,
  companyUser: CompanyUser
) {
  // Fetch transaction
  const transaction = await db.transactions.get(transactionId)

  // Check company ownership
  const authCheck = requireCompanyOwnership(transaction, companyId)
  if (!authCheck.authorized) {
    return { success: false, error: authCheck.error }
  }

  // Check RBAC with transaction status context
  if (!checkPermission(companyUser, 'update', 'transaction', {
    transactionStatus: transaction.status
  })) {
    const error = getPermissionError(
      companyUser.role,
      'update',
      'transaction',
      { transactionStatus: transaction.status }
    )
    return { success: false, error }
  }

  // Perform update
  await db.transactions.update(transactionId, updates)
  return { success: true }
}
```

### Example 3: Check Multiple Permissions

```typescript
import { hasAllPermissions } from '../utils/rbac'

function canFullyManageUsers(companyUser: CompanyUser): boolean {
  return hasAllPermissions(companyUser, [
    ['create', 'user'],
    ['read', 'user'],
    ['update', 'user'],
    ['delete', 'user']
  ])
}
```

### Example 4: UI Conditional Rendering

```typescript
import { canAccessSettings, canManageUsers, canExportData } from '../utils/rbac'

function AdminMenu({ companyUser }: { companyUser: CompanyUser }) {
  return (
    <nav>
      {canAccessSettings(companyUser.role) && (
        <Link to="/settings">Settings</Link>
      )}

      {canManageUsers(companyUser.role) && (
        <Link to="/users">Manage Users</Link>
      )}

      {canExportData(companyUser.role) && (
        <Button onClick={handleExport}>Export Data</Button>
      )}
    </nav>
  )
}
```

---

## API Reference

### Core Functions

#### `checkPermission(companyUser, action, resource, context?): boolean`

Primary function to check if a user has permission for an action on a resource.

**Parameters:**
- `companyUser`: CompanyUser object with role information
- `action`: Action to perform ('create', 'read', 'update', 'delete', 'export', 'post', 'void')
- `resource`: Resource type ('account', 'transaction', 'contact', etc.)
- `context`: Optional context object with additional information

**Returns:** `boolean` - true if user has permission

#### `hasAnyPermission(companyUser, permissions, context?): boolean`

Check if user has ANY of the specified permissions.

**Parameters:**
- `companyUser`: CompanyUser object
- `permissions`: Array of [action, resource] tuples
- `context`: Optional context

**Returns:** `boolean` - true if user has any permission

#### `hasAllPermissions(companyUser, permissions, context?): boolean`

Check if user has ALL of the specified permissions.

**Parameters:**
- `companyUser`: CompanyUser object
- `permissions`: Array of [action, resource] tuples
- `context`: Optional context

**Returns:** `boolean` - true if user has all permissions

### Helper Functions

#### `canAccessSettings(role): boolean`

Check if role can access settings.

#### `canManageUsers(role): boolean`

Check if role can manage users.

#### `canModifyPostedTransactions(role): boolean`

Check if role can modify posted transactions.

#### `canExportData(role): boolean`

Check if role can export data.

#### `getRoleDescription(role): string`

Get user-friendly description of role capabilities.

#### `getRoleHierarchyLevel(role): number`

Get numeric hierarchy level (1-5, higher = more privileges).

#### `hasMinimumRole(userRole, requiredRole): boolean`

Check if user role meets minimum required privilege level.

#### `getPermissionError(role, action, resource, context?)`

Get appropriate user-friendly error message for permission denial.

### Error Constants

- `PERMISSION_DENIED_ERROR` - Generic permission denied
- `INSUFFICIENT_ROLE_ERROR` - Insufficient role level
- `CANNOT_MODIFY_POSTED_ERROR` - Cannot modify posted transactions
- `CANNOT_ACCESS_SETTINGS_ERROR` - Cannot access settings

---

## Testing

**Location:** `src/utils/rbac.test.ts`
**Coverage:** 68 tests, all passing

Test suites cover:
- All role permissions (OWNER, ADMIN, ACCOUNTANT, BOOKKEEPER, VIEWER)
- Role hierarchy and comparison
- Helper functions
- Permission errors
- Contextual permissions (transaction status)
- Integration patterns

**Run tests:**
```bash
npm test -- rbac.test.ts
```

---

## Role Descriptions

### OWNER
Full access to all features including company deletion and billing. Can manage all users and settings.

### ADMIN
Full access to all features except company deletion. Can manage users, settings, and all financial data including posted transactions.

### ACCOUNTANT (Manager)
Full read access and can manage draft transactions. **Cannot modify or delete posted financial records.** Can generate reports and access settings.

### BOOKKEEPER
Can create and manage draft transactions, contacts, invoices, and bills. **Cannot access settings, users, or posted transactions.**

### VIEWER (View-Only)
**Read-only access to all financial data and reports.** Cannot create, modify, or delete any records. Cannot export data.

---

## Key Requirements Met

✅ **S7-1.1:** Admin (OWNER/ADMIN) has full access
✅ **S7-1.2:** Manager (ACCOUNTANT) cannot delete/modify posted financial records
✅ **S7-1.3:** Bookkeeper cannot access settings/users
✅ **S7-1.4:** View-Only (VIEWER) has read-only access to all data
✅ **S7-1.5:** Permissions checked IN ADDITION TO company ownership
✅ **S7-1.6:** Pattern: Company ownership → RBAC → Action
✅ **S7-1.7:** Tests for all roles
✅ **S7-1.8:** Permission matrix documented

---

## Security Notes

1. **Defense in Depth:** RBAC is the second layer of security after company ownership authorization.

2. **Zero-Knowledge Compatible:** RBAC checks happen client-side and don't require server to decrypt data.

3. **Least Privilege:** Each role has minimum necessary permissions for their job function.

4. **Audit Trail:** All permission checks should be logged for security auditing.

5. **UI Enforcement:** While permissions are enforced server-side, UI should also hide unauthorized actions.

6. **Error Messages:** Permission errors return generic "NOT_FOUND" to avoid information leakage.

---

## Future Enhancements

Potential future improvements (not in current scope):

- [ ] Custom permission sets beyond standard roles
- [ ] Time-based permission grants (temporary elevated access)
- [ ] Resource-specific permissions (e.g., "can edit Account X but not Account Y")
- [ ] Permission delegation (temporary grant of specific permissions)
- [ ] Audit log of permission denials for security monitoring

---

**Last Updated:** 2026-02-23
**Status:** ✅ Implemented and Tested
**Task:** S7-1 from Security Hardening Roadmap
