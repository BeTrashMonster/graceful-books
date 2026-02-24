/**
 * Tests for Role-Based Access Control (RBAC) System
 *
 * Validates permission matrix and role hierarchy for all user roles.
 * Tests S7-1 requirements from SECURITY_HARDENING_ROADMAP.md
 */

import { describe, it, expect } from 'vitest'
import {
  checkPermission,
  hasAnyPermission,
  hasAllPermissions,
  getPermissionsForRole,
  canAccessSettings,
  canManageUsers,
  canModifyPostedTransactions,
  canExportData,
  getRoleDescription,
  getRoleHierarchyLevel,
  hasMinimumRole,
  getPermissionError,
  PERMISSION_DENIED_ERROR,
  CANNOT_MODIFY_POSTED_ERROR,
  CANNOT_ACCESS_SETTINGS_ERROR,
} from '../../utils/rbac'
import type { CompanyUser } from '../../types/database.types'
import { UserRole, TransactionStatus } from '../../types/database.types'

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a mock CompanyUser for testing
 */
function createMockCompanyUser(role: UserRole): CompanyUser {
  return {
    id: 'test-company-user-id',
    company_id: 'test-company-id',
    user_id: 'test-user-id',
    role,
    permissions: [],
    active: true,
    created_at: Date.now(),
    updated_at: Date.now(),
    deleted_at: null,
    version_vector: { 'test-device': 1 },
  }
}

// ============================================================================
// OWNER Role Tests (Admin in task requirements)
// ============================================================================

describe('RBAC - OWNER Role (Admin)', () => {
  const ownerUser = createMockCompanyUser(UserRole.OWNER)

  it('should have full access to all account operations', () => {
    expect(checkPermission(ownerUser, 'create', 'account')).toBe(true)
    expect(checkPermission(ownerUser, 'read', 'account')).toBe(true)
    expect(checkPermission(ownerUser, 'update', 'account')).toBe(true)
    expect(checkPermission(ownerUser, 'delete', 'account')).toBe(true)
  })

  it('should have full access to all transaction operations', () => {
    expect(checkPermission(ownerUser, 'create', 'transaction')).toBe(true)
    expect(checkPermission(ownerUser, 'read', 'transaction')).toBe(true)
    expect(checkPermission(ownerUser, 'update', 'transaction')).toBe(true)
    expect(checkPermission(ownerUser, 'delete', 'transaction')).toBe(true)
    expect(checkPermission(ownerUser, 'post', 'transaction')).toBe(true)
    expect(checkPermission(ownerUser, 'void', 'transaction')).toBe(true)
  })

  it('should be able to modify posted transactions', () => {
    expect(
      checkPermission(ownerUser, 'update', 'transaction', {
        transactionStatus: TransactionStatus.POSTED,
      })
    ).toBe(true)
    expect(
      checkPermission(ownerUser, 'delete', 'transaction', {
        transactionStatus: TransactionStatus.POSTED,
      })
    ).toBe(true)
    expect(
      checkPermission(ownerUser, 'void', 'transaction', {
        transactionStatus: TransactionStatus.RECONCILED,
      })
    ).toBe(true)
  })

  it('should have full access to user management', () => {
    expect(checkPermission(ownerUser, 'create', 'user')).toBe(true)
    expect(checkPermission(ownerUser, 'read', 'user')).toBe(true)
    expect(checkPermission(ownerUser, 'update', 'user')).toBe(true)
    expect(checkPermission(ownerUser, 'delete', 'user')).toBe(true)
  })

  it('should have full access to company management', () => {
    expect(checkPermission(ownerUser, 'read', 'company')).toBe(true)
    expect(checkPermission(ownerUser, 'update', 'company')).toBe(true)
    expect(checkPermission(ownerUser, 'delete', 'company')).toBe(true)
  })

  it('should have access to settings', () => {
    expect(checkPermission(ownerUser, 'read', 'settings')).toBe(true)
    expect(checkPermission(ownerUser, 'update', 'settings')).toBe(true)
    expect(canAccessSettings(UserRole.OWNER)).toBe(true)
  })

  it('should be able to export data', () => {
    expect(checkPermission(ownerUser, 'export', 'report')).toBe(true)
    expect(canExportData(UserRole.OWNER)).toBe(true)
  })

  it('should have access to audit logs', () => {
    expect(checkPermission(ownerUser, 'read', 'audit_log')).toBe(true)
  })

  it('should have access to CPG data', () => {
    expect(checkPermission(ownerUser, 'create', 'cpg_data')).toBe(true)
    expect(checkPermission(ownerUser, 'read', 'cpg_data')).toBe(true)
    expect(checkPermission(ownerUser, 'update', 'cpg_data')).toBe(true)
    expect(checkPermission(ownerUser, 'delete', 'cpg_data')).toBe(true)
  })
})

// ============================================================================
// ADMIN Role Tests (Admin in task requirements)
// ============================================================================

describe('RBAC - ADMIN Role (Admin)', () => {
  const adminUser = createMockCompanyUser(UserRole.ADMIN)

  it('should have full access to all account operations', () => {
    expect(checkPermission(adminUser, 'create', 'account')).toBe(true)
    expect(checkPermission(adminUser, 'read', 'account')).toBe(true)
    expect(checkPermission(adminUser, 'update', 'account')).toBe(true)
    expect(checkPermission(adminUser, 'delete', 'account')).toBe(true)
  })

  it('should have full access to all transaction operations including posted', () => {
    expect(checkPermission(adminUser, 'create', 'transaction')).toBe(true)
    expect(checkPermission(adminUser, 'read', 'transaction')).toBe(true)
    expect(checkPermission(adminUser, 'update', 'transaction')).toBe(true)
    expect(checkPermission(adminUser, 'delete', 'transaction')).toBe(true)
    expect(
      checkPermission(adminUser, 'update', 'transaction', {
        transactionStatus: TransactionStatus.POSTED,
      })
    ).toBe(true)
  })

  it('should have access to user management', () => {
    expect(checkPermission(adminUser, 'create', 'user')).toBe(true)
    expect(checkPermission(adminUser, 'read', 'user')).toBe(true)
    expect(checkPermission(adminUser, 'update', 'user')).toBe(true)
    expect(checkPermission(adminUser, 'delete', 'user')).toBe(true)
  })

  it('should NOT be able to delete company (only OWNER can)', () => {
    expect(checkPermission(adminUser, 'read', 'company')).toBe(true)
    expect(checkPermission(adminUser, 'update', 'company')).toBe(true)
    expect(checkPermission(adminUser, 'delete', 'company')).toBe(false)
  })

  it('should have access to settings', () => {
    expect(checkPermission(adminUser, 'read', 'settings')).toBe(true)
    expect(checkPermission(adminUser, 'update', 'settings')).toBe(true)
    expect(canAccessSettings(UserRole.ADMIN)).toBe(true)
  })
})

// ============================================================================
// ACCOUNTANT Role Tests (Manager in task requirements)
// ============================================================================

describe('RBAC - ACCOUNTANT Role (Manager)', () => {
  const accountantUser = createMockCompanyUser(UserRole.ACCOUNTANT)

  it('should have read access to all financial data', () => {
    expect(checkPermission(accountantUser, 'read', 'account')).toBe(true)
    expect(checkPermission(accountantUser, 'read', 'transaction')).toBe(true)
    expect(checkPermission(accountantUser, 'read', 'contact')).toBe(true)
    expect(checkPermission(accountantUser, 'read', 'product')).toBe(true)
    expect(checkPermission(accountantUser, 'read', 'invoice')).toBe(true)
    expect(checkPermission(accountantUser, 'read', 'bill')).toBe(true)
  })

  it('should be able to create and update draft transactions', () => {
    expect(checkPermission(accountantUser, 'create', 'transaction')).toBe(true)
    expect(
      checkPermission(accountantUser, 'update', 'transaction', {
        transactionStatus: TransactionStatus.DRAFT,
      })
    ).toBe(true)
  })

  it('should NOT be able to modify posted transactions (KEY REQUIREMENT)', () => {
    expect(
      checkPermission(accountantUser, 'update', 'transaction', {
        transactionStatus: TransactionStatus.POSTED,
      })
    ).toBe(false)
    expect(
      checkPermission(accountantUser, 'delete', 'transaction', {
        transactionStatus: TransactionStatus.POSTED,
      })
    ).toBe(false)
    expect(
      checkPermission(accountantUser, 'void', 'transaction', {
        transactionStatus: TransactionStatus.POSTED,
      })
    ).toBe(false)
  })

  it('should NOT be able to void transactions', () => {
    expect(checkPermission(accountantUser, 'void', 'transaction')).toBe(false)
  })

  it('should NOT be able to delete accounts/transactions', () => {
    expect(checkPermission(accountantUser, 'delete', 'account')).toBe(false)
    expect(checkPermission(accountantUser, 'delete', 'transaction')).toBe(false)
    expect(checkPermission(accountantUser, 'delete', 'contact')).toBe(false)
  })

  it('should be able to generate and export reports', () => {
    expect(checkPermission(accountantUser, 'read', 'report')).toBe(true)
    expect(checkPermission(accountantUser, 'export', 'report')).toBe(true)
    expect(canExportData(UserRole.ACCOUNTANT)).toBe(true)
  })

  it('should NOT be able to manage users', () => {
    expect(checkPermission(accountantUser, 'create', 'user')).toBe(false)
    expect(checkPermission(accountantUser, 'update', 'user')).toBe(false)
    expect(checkPermission(accountantUser, 'delete', 'user')).toBe(false)
    expect(canManageUsers(UserRole.ACCOUNTANT)).toBe(false)
  })

  it('should be able to read settings but not update', () => {
    expect(checkPermission(accountantUser, 'read', 'settings')).toBe(true)
    expect(checkPermission(accountantUser, 'update', 'settings')).toBe(false)
  })

  it('should have access to audit logs', () => {
    expect(checkPermission(accountantUser, 'read', 'audit_log')).toBe(true)
  })

  it('should NOT be able to modify posted transactions', () => {
    expect(canModifyPostedTransactions(UserRole.ACCOUNTANT)).toBe(false)
  })
})

// ============================================================================
// BOOKKEEPER Role Tests
// ============================================================================

describe('RBAC - BOOKKEEPER Role', () => {
  const bookkeeperUser = createMockCompanyUser(UserRole.BOOKKEEPER)

  it('should be able to create and read transactions', () => {
    expect(checkPermission(bookkeeperUser, 'create', 'transaction')).toBe(true)
    expect(checkPermission(bookkeeperUser, 'read', 'transaction')).toBe(true)
  })

  it('should be able to update ONLY draft transactions', () => {
    expect(
      checkPermission(bookkeeperUser, 'update', 'transaction', {
        transactionStatus: TransactionStatus.DRAFT,
      })
    ).toBe(true)
    expect(
      checkPermission(bookkeeperUser, 'update', 'transaction', {
        transactionStatus: TransactionStatus.POSTED,
      })
    ).toBe(false)
  })

  it('should NOT be able to post, delete, or void transactions', () => {
    expect(checkPermission(bookkeeperUser, 'post', 'transaction')).toBe(false)
    expect(checkPermission(bookkeeperUser, 'delete', 'transaction')).toBe(false)
    expect(checkPermission(bookkeeperUser, 'void', 'transaction')).toBe(false)
  })

  it('should be able to manage contacts', () => {
    expect(checkPermission(bookkeeperUser, 'create', 'contact')).toBe(true)
    expect(checkPermission(bookkeeperUser, 'read', 'contact')).toBe(true)
    expect(checkPermission(bookkeeperUser, 'update', 'contact')).toBe(true)
    expect(checkPermission(bookkeeperUser, 'delete', 'contact')).toBe(false)
  })

  it('should be able to manage products', () => {
    expect(checkPermission(bookkeeperUser, 'create', 'product')).toBe(true)
    expect(checkPermission(bookkeeperUser, 'read', 'product')).toBe(true)
    expect(checkPermission(bookkeeperUser, 'update', 'product')).toBe(true)
  })

  it('should be able to create and manage invoices', () => {
    expect(checkPermission(bookkeeperUser, 'create', 'invoice')).toBe(true)
    expect(checkPermission(bookkeeperUser, 'read', 'invoice')).toBe(true)
    expect(checkPermission(bookkeeperUser, 'update', 'invoice')).toBe(true)
  })

  it('should NOT have access to settings (KEY REQUIREMENT)', () => {
    expect(checkPermission(bookkeeperUser, 'read', 'settings')).toBe(false)
    expect(checkPermission(bookkeeperUser, 'update', 'settings')).toBe(false)
    expect(canAccessSettings(UserRole.BOOKKEEPER)).toBe(false)
  })

  it('should NOT have access to user management (KEY REQUIREMENT)', () => {
    expect(checkPermission(bookkeeperUser, 'create', 'user')).toBe(false)
    expect(checkPermission(bookkeeperUser, 'read', 'user')).toBe(false)
    expect(checkPermission(bookkeeperUser, 'update', 'user')).toBe(false)
    expect(checkPermission(bookkeeperUser, 'delete', 'user')).toBe(false)
    expect(canManageUsers(UserRole.BOOKKEEPER)).toBe(false)
  })

  it('should NOT have access to audit logs', () => {
    expect(checkPermission(bookkeeperUser, 'read', 'audit_log')).toBe(false)
  })

  it('should be able to read reports but NOT export', () => {
    expect(checkPermission(bookkeeperUser, 'read', 'report')).toBe(true)
    expect(checkPermission(bookkeeperUser, 'export', 'report')).toBe(false)
    expect(canExportData(UserRole.BOOKKEEPER)).toBe(false)
  })

  it('should NOT be able to modify accounts', () => {
    expect(checkPermission(bookkeeperUser, 'create', 'account')).toBe(false)
    expect(checkPermission(bookkeeperUser, 'update', 'account')).toBe(false)
    expect(checkPermission(bookkeeperUser, 'delete', 'account')).toBe(false)
  })
})

// ============================================================================
// VIEWER Role Tests (View-Only in task requirements)
// ============================================================================

describe('RBAC - VIEWER Role (View-Only)', () => {
  const viewerUser = createMockCompanyUser(UserRole.VIEWER)

  it('should have read-only access to all financial data (KEY REQUIREMENT)', () => {
    expect(checkPermission(viewerUser, 'read', 'account')).toBe(true)
    expect(checkPermission(viewerUser, 'read', 'transaction')).toBe(true)
    expect(checkPermission(viewerUser, 'read', 'contact')).toBe(true)
    expect(checkPermission(viewerUser, 'read', 'product')).toBe(true)
    expect(checkPermission(viewerUser, 'read', 'invoice')).toBe(true)
    expect(checkPermission(viewerUser, 'read', 'bill')).toBe(true)
    expect(checkPermission(viewerUser, 'read', 'report')).toBe(true)
  })

  it('should NOT be able to create anything', () => {
    expect(checkPermission(viewerUser, 'create', 'account')).toBe(false)
    expect(checkPermission(viewerUser, 'create', 'transaction')).toBe(false)
    expect(checkPermission(viewerUser, 'create', 'contact')).toBe(false)
    expect(checkPermission(viewerUser, 'create', 'product')).toBe(false)
    expect(checkPermission(viewerUser, 'create', 'invoice')).toBe(false)
    expect(checkPermission(viewerUser, 'create', 'bill')).toBe(false)
  })

  it('should NOT be able to update anything', () => {
    expect(checkPermission(viewerUser, 'update', 'account')).toBe(false)
    expect(checkPermission(viewerUser, 'update', 'transaction')).toBe(false)
    expect(checkPermission(viewerUser, 'update', 'contact')).toBe(false)
    expect(checkPermission(viewerUser, 'update', 'product')).toBe(false)
  })

  it('should NOT be able to delete anything', () => {
    expect(checkPermission(viewerUser, 'delete', 'account')).toBe(false)
    expect(checkPermission(viewerUser, 'delete', 'transaction')).toBe(false)
    expect(checkPermission(viewerUser, 'delete', 'contact')).toBe(false)
    expect(checkPermission(viewerUser, 'delete', 'product')).toBe(false)
  })

  it('should NOT be able to export data', () => {
    expect(checkPermission(viewerUser, 'export', 'report')).toBe(false)
    expect(canExportData(UserRole.VIEWER)).toBe(false)
  })

  it('should NOT have access to settings', () => {
    expect(checkPermission(viewerUser, 'read', 'settings')).toBe(false)
    expect(checkPermission(viewerUser, 'update', 'settings')).toBe(false)
    expect(canAccessSettings(UserRole.VIEWER)).toBe(false)
  })

  it('should NOT have access to user management', () => {
    expect(checkPermission(viewerUser, 'read', 'user')).toBe(false)
    expect(checkPermission(viewerUser, 'create', 'user')).toBe(false)
    expect(canManageUsers(UserRole.VIEWER)).toBe(false)
  })

  it('should NOT have access to audit logs', () => {
    expect(checkPermission(viewerUser, 'read', 'audit_log')).toBe(false)
  })

  it('should be able to read company info', () => {
    expect(checkPermission(viewerUser, 'read', 'company')).toBe(true)
  })
})

// ============================================================================
// Role Hierarchy Tests
// ============================================================================

describe('RBAC - Role Hierarchy', () => {
  it('should return correct hierarchy levels', () => {
    expect(getRoleHierarchyLevel(UserRole.OWNER)).toBe(5)
    expect(getRoleHierarchyLevel(UserRole.ADMIN)).toBe(4)
    expect(getRoleHierarchyLevel(UserRole.ACCOUNTANT)).toBe(3)
    expect(getRoleHierarchyLevel(UserRole.BOOKKEEPER)).toBe(2)
    expect(getRoleHierarchyLevel(UserRole.VIEWER)).toBe(1)
  })

  it('should correctly compare role privileges', () => {
    expect(hasMinimumRole(UserRole.OWNER, UserRole.ADMIN)).toBe(true)
    expect(hasMinimumRole(UserRole.ADMIN, UserRole.OWNER)).toBe(false)
    expect(hasMinimumRole(UserRole.ACCOUNTANT, UserRole.BOOKKEEPER)).toBe(true)
    expect(hasMinimumRole(UserRole.BOOKKEEPER, UserRole.ACCOUNTANT)).toBe(false)
    expect(hasMinimumRole(UserRole.VIEWER, UserRole.VIEWER)).toBe(true)
  })
})

// ============================================================================
// Helper Function Tests
// ============================================================================

describe('RBAC - Helper Functions', () => {
  const ownerUser = createMockCompanyUser(UserRole.OWNER)
  const accountantUser = createMockCompanyUser(UserRole.ACCOUNTANT)
  const bookkeeperUser = createMockCompanyUser(UserRole.BOOKKEEPER)

  describe('hasAnyPermission', () => {
    it('should return true if user has any of the permissions', () => {
      expect(
        hasAnyPermission(ownerUser, [
          ['delete', 'account'],
          ['delete', 'transaction'],
        ])
      ).toBe(true)

      expect(
        hasAnyPermission(bookkeeperUser, [
          ['create', 'transaction'],
          ['delete', 'account'],
        ])
      ).toBe(true)
    })

    it('should return false if user has none of the permissions', () => {
      expect(
        hasAnyPermission(bookkeeperUser, [
          ['delete', 'account'],
          ['update', 'settings'],
        ])
      ).toBe(false)
    })
  })

  describe('hasAllPermissions', () => {
    it('should return true if user has all of the permissions', () => {
      expect(
        hasAllPermissions(ownerUser, [
          ['create', 'account'],
          ['update', 'account'],
          ['delete', 'account'],
        ])
      ).toBe(true)
    })

    it('should return false if user is missing any permission', () => {
      expect(
        hasAllPermissions(accountantUser, [
          ['create', 'transaction'],
          ['delete', 'transaction'],
        ])
      ).toBe(false)
    })
  })

  describe('getPermissionsForRole', () => {
    it('should return all permissions for a role', () => {
      const permissions = getPermissionsForRole(UserRole.OWNER)
      expect(permissions['account:create']).toBe(true)
      expect(permissions['transaction:delete']).toBe(true)
      expect(permissions['user:create']).toBe(true)
    })
  })

  describe('getRoleDescription', () => {
    it('should return user-friendly descriptions for all roles', () => {
      expect(getRoleDescription(UserRole.OWNER)).toContain('Full access')
      expect(getRoleDescription(UserRole.ADMIN)).toContain('Full access')
      expect(getRoleDescription(UserRole.ACCOUNTANT)).toContain('Cannot modify or delete posted')
      expect(getRoleDescription(UserRole.BOOKKEEPER)).toContain('Cannot access settings')
      expect(getRoleDescription(UserRole.VIEWER)).toContain('Read-only')
    })
  })
})

// ============================================================================
// Permission Error Tests
// ============================================================================

describe('RBAC - Permission Errors', () => {
  it('should return posted transaction error for ACCOUNTANT', () => {
    const error = getPermissionError(
      UserRole.ACCOUNTANT,
      'update',
      'transaction',
      { transactionStatus: TransactionStatus.POSTED }
    )
    expect(error).toEqual(CANNOT_MODIFY_POSTED_ERROR)
  })

  it('should return settings access error for BOOKKEEPER', () => {
    const error = getPermissionError(UserRole.BOOKKEEPER, 'read', 'settings')
    expect(error).toEqual(CANNOT_ACCESS_SETTINGS_ERROR)
  })

  it('should return view-only error for VIEWER on write operations', () => {
    const error = getPermissionError(UserRole.VIEWER, 'create', 'transaction')
    expect(error.code).toBe('FORBIDDEN')
    expect(error.message).toContain('View-only users')
  })

  it('should return generic permission denied for other cases', () => {
    const error = getPermissionError(UserRole.ACCOUNTANT, 'delete', 'account')
    expect(error).toEqual(PERMISSION_DENIED_ERROR)
  })
})

// ============================================================================
// Contextual Permission Tests
// ============================================================================

describe('RBAC - Contextual Permissions', () => {
  const accountantUser = createMockCompanyUser(UserRole.ACCOUNTANT)
  const bookkeeperUser = createMockCompanyUser(UserRole.BOOKKEEPER)

  describe('Transaction Status Context', () => {
    it('ACCOUNTANT can update DRAFT transactions', () => {
      expect(
        checkPermission(accountantUser, 'update', 'transaction', {
          transactionStatus: TransactionStatus.DRAFT,
        })
      ).toBe(true)
    })

    it('ACCOUNTANT cannot update POSTED transactions', () => {
      expect(
        checkPermission(accountantUser, 'update', 'transaction', {
          transactionStatus: TransactionStatus.POSTED,
        })
      ).toBe(false)
    })

    it('ACCOUNTANT cannot update RECONCILED transactions', () => {
      expect(
        checkPermission(accountantUser, 'update', 'transaction', {
          transactionStatus: TransactionStatus.RECONCILED,
        })
      ).toBe(false)
    })

    it('BOOKKEEPER can update DRAFT transactions', () => {
      expect(
        checkPermission(bookkeeperUser, 'update', 'transaction', {
          transactionStatus: TransactionStatus.DRAFT,
        })
      ).toBe(true)
    })

    it('BOOKKEEPER cannot update POSTED transactions', () => {
      expect(
        checkPermission(bookkeeperUser, 'update', 'transaction', {
          transactionStatus: TransactionStatus.POSTED,
        })
      ).toBe(false)
    })

    it('BOOKKEEPER cannot update VOID transactions', () => {
      expect(
        checkPermission(bookkeeperUser, 'update', 'transaction', {
          transactionStatus: TransactionStatus.VOID,
        })
      ).toBe(false)
    })
  })
})

// ============================================================================
// Integration Pattern Tests
// ============================================================================

describe('RBAC - Integration Patterns', () => {
  it('should demonstrate correct usage pattern with authorization.ts', () => {
    // This test documents the correct pattern for using RBAC with authorization
    const companyUser = createMockCompanyUser(UserRole.ACCOUNTANT)
    const companyId = 'test-company-id'

    // Step 1: Would check company ownership first (using authorization.ts)
    // const authCheck = requireCompanyOwnership(resource, companyId)
    // if (!authCheck.authorized) return error

    // Step 2: Check RBAC permissions
    const hasPermission = checkPermission(companyUser, 'update', 'account')

    // Step 3: Perform action if both checks pass
    expect(hasPermission).toBe(true)
  })

  it('should demonstrate permission check with context', () => {
    const companyUser = createMockCompanyUser(UserRole.ACCOUNTANT)

    // Check permission with transaction context
    const canUpdatePosted = checkPermission(
      companyUser,
      'update',
      'transaction',
      { transactionStatus: TransactionStatus.POSTED }
    )

    expect(canUpdatePosted).toBe(false)

    // Get appropriate error message
    const error = getPermissionError(
      companyUser.role,
      'update',
      'transaction',
      { transactionStatus: TransactionStatus.POSTED }
    )

    expect(error.code).toBe('FORBIDDEN')
    expect(error.message).toContain('Posted transactions cannot be modified')
  })
})

// ============================================================================
// Special Permission Tests
// ============================================================================

describe('RBAC - Special Permission Checks', () => {
  it('should identify roles that can access settings', () => {
    expect(canAccessSettings(UserRole.OWNER)).toBe(true)
    expect(canAccessSettings(UserRole.ADMIN)).toBe(true)
    expect(canAccessSettings(UserRole.ACCOUNTANT)).toBe(true)
    expect(canAccessSettings(UserRole.BOOKKEEPER)).toBe(false)
    expect(canAccessSettings(UserRole.VIEWER)).toBe(false)
  })

  it('should identify roles that can manage users', () => {
    expect(canManageUsers(UserRole.OWNER)).toBe(true)
    expect(canManageUsers(UserRole.ADMIN)).toBe(true)
    expect(canManageUsers(UserRole.ACCOUNTANT)).toBe(false)
    expect(canManageUsers(UserRole.BOOKKEEPER)).toBe(false)
    expect(canManageUsers(UserRole.VIEWER)).toBe(false)
  })

  it('should identify roles that can modify posted transactions', () => {
    expect(canModifyPostedTransactions(UserRole.OWNER)).toBe(true)
    expect(canModifyPostedTransactions(UserRole.ADMIN)).toBe(true)
    expect(canModifyPostedTransactions(UserRole.ACCOUNTANT)).toBe(false)
    expect(canModifyPostedTransactions(UserRole.BOOKKEEPER)).toBe(false)
    expect(canModifyPostedTransactions(UserRole.VIEWER)).toBe(false)
  })

  it('should identify roles that can export data', () => {
    expect(canExportData(UserRole.OWNER)).toBe(true)
    expect(canExportData(UserRole.ADMIN)).toBe(true)
    expect(canExportData(UserRole.ACCOUNTANT)).toBe(true)
    expect(canExportData(UserRole.BOOKKEEPER)).toBe(false)
    expect(canExportData(UserRole.VIEWER)).toBe(false)
  })
})
