# Graceful Books Permission Model

**Version:** 1.0.0
**Created:** 2026-11-09
**Status:** Phase 1.4 - Foundation Security

---

## Overview

This document defines the role-based access control (RBAC) system for Graceful Books. The permission model is enforced at the data layer, not just the UI, ensuring security even if UI controls are bypassed.

**Key Principle:** Permissions are enforced at the service/data layer. UI permission checks are for UX only - security enforcement happens deeper in the stack.

---

## Roles

| Role | Description | Count Limit | Hierarchy Level |
|------|-------------|-------------|-----------------|
| **OWNER** | Company owner - full access, billing | 1 per company | 5 (highest) |
| **ADMIN** | Administrator - full access except billing | No limit | 4 |
| **ACCOUNTANT** | Full read + draft transactions, cannot modify posted | No limit | 3 |
| **BOOKKEEPER** | Transaction entry, cannot access settings/users | No limit | 2 |
| **VIEWER** | Read-only access, no export | No limit | 1 (lowest) |

---

## Permission Matrix

### Account Operations

| Action | OWNER | ADMIN | ACCOUNTANT | BOOKKEEPER | VIEWER |
|--------|-------|-------|------------|------------|--------|
| Create | ✅ | ✅ | ✅ | ❌ | ❌ |
| Read | ✅ | ✅ | ✅ | ✅ | ✅ |
| Update | ✅ | ✅ | ✅ | ❌ | ❌ |
| Delete | ✅ | ✅ | ❌ | ❌ | ❌ |

### Transaction Operations

| Action | OWNER | ADMIN | ACCOUNTANT | BOOKKEEPER | VIEWER |
|--------|-------|-------|------------|------------|--------|
| Create | ✅ | ✅ | ✅ | ✅ | ❌ |
| Read | ✅ | ✅ | ✅ | ✅ | ✅ |
| Update (Draft) | ✅ | ✅ | ✅ | ✅ | ❌ |
| Update (Posted) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Delete | ✅ | ✅ | ❌ | ❌ | ❌ |
| Post | ✅ | ✅ | ✅ | ❌ | ❌ |
| Void | ✅ | ✅ | ❌ | ❌ | ❌ |

### Contact Operations

| Action | OWNER | ADMIN | ACCOUNTANT | BOOKKEEPER | VIEWER |
|--------|-------|-------|------------|------------|--------|
| Create | ✅ | ✅ | ✅ | ✅ | ❌ |
| Read | ✅ | ✅ | ✅ | ✅ | ✅ |
| Update | ✅ | ✅ | ✅ | ✅ | ❌ |
| Delete | ✅ | ✅ | ❌ | ❌ | ❌ |

### Product Operations

| Action | OWNER | ADMIN | ACCOUNTANT | BOOKKEEPER | VIEWER |
|--------|-------|-------|------------|------------|--------|
| Create | ✅ | ✅ | ✅ | ✅ | ❌ |
| Read | ✅ | ✅ | ✅ | ✅ | ✅ |
| Update | ✅ | ✅ | ✅ | ✅ | ❌ |
| Delete | ✅ | ✅ | ❌ | ❌ | ❌ |

### Invoice Operations

| Action | OWNER | ADMIN | ACCOUNTANT | BOOKKEEPER | VIEWER |
|--------|-------|-------|------------|------------|--------|
| Create | ✅ | ✅ | ✅ | ✅ | ❌ |
| Read | ✅ | ✅ | ✅ | ✅ | ✅ |
| Update | ✅ | ✅ | ✅ | ✅ | ❌ |
| Delete | ✅ | ✅ | ❌ | ❌ | ❌ |

### Bill Operations

| Action | OWNER | ADMIN | ACCOUNTANT | BOOKKEEPER | VIEWER |
|--------|-------|-------|------------|------------|--------|
| Create | ✅ | ✅ | ✅ | ✅ | ❌ |
| Read | ✅ | ✅ | ✅ | ✅ | ✅ |
| Update | ✅ | ✅ | ✅ | ✅ | ❌ |
| Delete | ✅ | ✅ | ❌ | ❌ | ❌ |

### Report Operations

| Action | OWNER | ADMIN | ACCOUNTANT | BOOKKEEPER | VIEWER |
|--------|-------|-------|------------|------------|--------|
| Read | ✅ | ✅ | ✅ | ✅ | ✅ |
| Export | ✅ | ✅ | ✅ | ❌ | ❌ |

### User Management Operations

| Action | OWNER | ADMIN | ACCOUNTANT | BOOKKEEPER | VIEWER |
|--------|-------|-------|------------|------------|--------|
| Create | ✅ | ✅ | ❌ | ❌ | ❌ |
| Read | ✅ | ✅ | ✅ | ❌ | ❌ |
| Update | ✅ | ✅ | ❌ | ❌ | ❌ |
| Delete | ✅ | ✅ | ❌ | ❌ | ❌ |

### Company Operations

| Action | OWNER | ADMIN | ACCOUNTANT | BOOKKEEPER | VIEWER |
|--------|-------|-------|------------|------------|--------|
| Read | ✅ | ✅ | ✅ | ✅ | ✅ |
| Update | ✅ | ✅ | ❌ | ❌ | ❌ |
| Delete | ✅ | ❌ | ❌ | ❌ | ❌ |

### Settings Operations

| Action | OWNER | ADMIN | ACCOUNTANT | BOOKKEEPER | VIEWER |
|--------|-------|-------|------------|------------|--------|
| Read | ✅ | ✅ | ✅ | ❌ | ❌ |
| Update | ✅ | ✅ | ❌ | ❌ | ❌ |

### Audit Log Operations

| Action | OWNER | ADMIN | ACCOUNTANT | BOOKKEEPER | VIEWER |
|--------|-------|-------|------------|------------|--------|
| Read | ✅ | ✅ | ✅ | ❌ | ❌ |

### Reconciliation Operations

| Action | OWNER | ADMIN | ACCOUNTANT | BOOKKEEPER | VIEWER |
|--------|-------|-------|------------|------------|--------|
| Create | ✅ | ✅ | ✅ | ✅ | ❌ |
| Read | ✅ | ✅ | ✅ | ✅ | ✅ |
| Update | ✅ | ✅ | ✅ | ✅ | ❌ |
| Delete | ✅ | ✅ | ❌ | ❌ | ❌ |

### Key/Encryption Operations

| Action | OWNER | ADMIN | ACCOUNTANT | BOOKKEEPER | VIEWER |
|--------|-------|-------|------------|------------|--------|
| Rotate | ✅ | ✅ | ❌ | ❌ | ❌ |
| Revoke User | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## Enforcement Layers

### Layer 1: Company Ownership (IDOR Prevention)

Before any permission check, verify the resource belongs to the requesting company:

```typescript
// Always check ownership first
const authCheck = requireCompanyOwnership(resource, companyId);
if (!authCheck.authorized) {
  return { success: false, error: authCheck.error };
}
```

### Layer 2: Role-Based Permissions (RBAC)

After ownership is verified, check role permissions:

```typescript
// Check role permission
if (!checkPermission(companyUser, action, resource, context)) {
  await auditChain.addEntry({
    action,
    resource_type: resource,
    resource_id: resourceId,
    policy_decision: 'denied',
    ...
  });
  throw new PermissionDeniedError(companyUser.role, `${resource}:${action}`);
}
```

### Layer 3: Contextual Rules

Special rules applied based on context:

1. **Posted Transaction Rule**: ACCOUNTANT and BOOKKEEPER cannot modify posted/reconciled transactions
2. **Draft-Only Rule**: BOOKKEEPER can only update draft transactions
3. **Company Deletion Rule**: Only OWNER can delete the company

---

## Sync Permission Enforcement

When processing CRDT sync operations, permissions are validated:

1. Extract author's role at time of operation creation
2. Validate the operation against permission matrix
3. Reject operations where author lacked permission
4. Log all denied sync operations to audit trail

```typescript
async function mergeCRDTOperation(operation: CRDTOperation): Promise<void> {
  const authorRole = await getUserRoleAtTime(operation.author, operation.timestamp);
  const requiredPermission = getPermissionForOperation(operation);

  if (!hasPermission(authorRole, requiredPermission)) {
    await auditChain.addEntry({
      action: 'sync',
      policy_decision: 'denied',
      source: 'sync',
      ...
    });
    throw new InvalidSyncOperationError('Author lacks permission');
  }
}
```

---

## Audit Trail Integration

All permission checks are logged to the audit trail:

### Allowed Operations

```typescript
{
  action: 'create',
  resource_type: 'transaction',
  resource_id: 'txn-123',
  policy_decision: 'allowed',
  principal_chain: ['user-1', 'session-1', 'device-1'],
  ...
}
```

### Denied Operations

```typescript
{
  action: 'delete',
  resource_type: 'transaction',
  resource_id: 'txn-123',
  policy_decision: 'denied',
  principal_chain: ['user-1', 'session-1', 'device-1'],
  source: 'manual',
  ...
}
```

---

## Edge Cases

### Self-Escalation Prevention

Users cannot escalate their own permissions:

- Users cannot change their own role
- Users cannot grant themselves higher permissions
- Only OWNER/ADMIN can manage user roles

### Resource Scope Limits

Some resources may have additional scope restrictions:

- Payroll accounts may be restricted to OWNER/ADMIN only
- Certain reports may require ACCOUNTANT or higher

---

## Implementation Files

| File | Purpose |
|------|---------|
| `src/utils/rbac.ts` | Core RBAC implementation |
| `src/utils/authorization.ts` | Company ownership checks (IDOR prevention) |
| `src/services/permissions/permissionService.ts` | Permission service with audit integration |
| `src/__tests__/security/permissionMatrix.test.ts` | Gate 1.4 exhaustive tests |

---

## Verification Test Requirements

Every cell in the permission matrix has a corresponding test case in `src/__tests__/security/permissionMatrix.test.ts`:

```typescript
describe('Permission Matrix Exhaustive Tests', () => {
  for (const role of ROLES) {
    describe(`Role: ${role}`, () => {
      for (const permission of PERMISSIONS) {
        it(`${shouldHave ? 'CAN' : 'CANNOT'} ${permission}`, ...);
      }
    });
  }
});
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-11-09 | Security Implementation | Initial permission model |

---

*This document is part of the Agentic AI Security Implementation Roadmap, Phase 1: Foundation Security.*
