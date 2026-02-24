/**
 * Role-Based Access Control (RBAC) System
 *
 * Implements role-based permissions for multi-user companies.
 * Works in conjunction with company ownership authorization (authorization.ts).
 *
 * SECURITY: Task S7-1 - Role-Based Access Control
 * Requirements: src/Roadmaps/SECURITY_HARDENING_ROADMAP.md (lines 1614-1634)
 *
 * Architecture:
 * - Company ownership MUST be checked first (using authorization.ts)
 * - RBAC permissions checked second (using this module)
 * - Pattern: Check ownership → Check RBAC → Perform action
 *
 * Role Mapping (Task requirement → Database enum):
 * - Admin → OWNER/ADMIN (full access)
 * - Manager → ACCOUNTANT (cannot delete/modify posted records)
 * - Bookkeeper → BOOKKEEPER (cannot access settings/users)
 * - View-Only → VIEWER (read-only access)
 */

import type { UserRole, CompanyUser } from '../types/database.types'
import { TransactionStatus } from '../types/database.types'

// ============================================================================
// Permission Actions
// ============================================================================

/**
 * Resource types that can have permissions
 */
export type Resource =
  | 'account'
  | 'transaction'
  | 'contact'
  | 'product'
  | 'invoice'
  | 'bill'
  | 'report'
  | 'user'
  | 'company'
  | 'settings'
  | 'audit_log'
  | 'reconciliation'
  | 'cpg_data'

/**
 * Actions that can be performed on resources
 */
export type Action = 'create' | 'read' | 'update' | 'delete' | 'export' | 'post' | 'void'

/**
 * Permission check context
 * Provides additional information needed for permission decisions
 */
export interface PermissionContext {
  /**
   * Transaction status - required when checking transaction permissions
   * Posted transactions have special rules (Manager cannot modify)
   */
  transactionStatus?: TransactionStatus

  /**
   * Whether the resource is a settings/configuration item
   */
  isSettingsRelated?: boolean

  /**
   * Whether action is destructive (delete, void)
   */
  isDestructive?: boolean
}

// ============================================================================
// Permission Matrix
// ============================================================================

/**
 * Complete Permission Matrix
 *
 * OWNER (Admin in task):
 *   - Full access to all resources and actions
 *   - Can manage users, company settings, billing
 *   - Can delete and modify posted financial records
 *   - Can access audit logs
 *
 * ADMIN (Admin in task):
 *   - Full access to all resources and actions
 *   - Can manage users and company settings
 *   - Can delete and modify posted financial records
 *   - Cannot delete company (only OWNER can)
 *
 * ACCOUNTANT (Manager in task):
 *   - Full read access to all data
 *   - Can create and edit draft transactions
 *   - CANNOT delete or modify posted financial records (key requirement)
 *   - Can view but not modify posted transactions
 *   - Can generate and export reports
 *   - Cannot access user management or company deletion
 *
 * BOOKKEEPER (Bookkeeper in task):
 *   - Can create, read, update transactions (draft only)
 *   - Can manage contacts and products
 *   - Can create invoices and bills
 *   - CANNOT access settings, users, or company management (key requirement)
 *   - Cannot delete posted transactions
 *   - Can view reports but cannot access audit logs
 *
 * VIEWER (View-Only in task):
 *   - Read-only access to all financial data (key requirement)
 *   - Can view accounts, transactions, contacts, products
 *   - Can view reports
 *   - CANNOT create, update, or delete anything
 *   - Cannot export data (prevents data exfiltration)
 *   - Cannot access settings or user management
 */
const PERMISSION_MATRIX: Record<UserRole, Record<string, boolean>> = {
  OWNER: {
    // Full access to everything
    'account:create': true,
    'account:read': true,
    'account:update': true,
    'account:delete': true,
    'transaction:create': true,
    'transaction:read': true,
    'transaction:update': true,
    'transaction:delete': true,
    'transaction:post': true,
    'transaction:void': true,
    'contact:create': true,
    'contact:read': true,
    'contact:update': true,
    'contact:delete': true,
    'product:create': true,
    'product:read': true,
    'product:update': true,
    'product:delete': true,
    'invoice:create': true,
    'invoice:read': true,
    'invoice:update': true,
    'invoice:delete': true,
    'bill:create': true,
    'bill:read': true,
    'bill:update': true,
    'bill:delete': true,
    'report:read': true,
    'report:export': true,
    'user:create': true,
    'user:read': true,
    'user:update': true,
    'user:delete': true,
    'company:read': true,
    'company:update': true,
    'company:delete': true,
    'settings:read': true,
    'settings:update': true,
    'audit_log:read': true,
    'reconciliation:create': true,
    'reconciliation:read': true,
    'reconciliation:update': true,
    'reconciliation:delete': true,
    'cpg_data:create': true,
    'cpg_data:read': true,
    'cpg_data:update': true,
    'cpg_data:delete': true,
  },

  ADMIN: {
    // Full access except company deletion
    'account:create': true,
    'account:read': true,
    'account:update': true,
    'account:delete': true,
    'transaction:create': true,
    'transaction:read': true,
    'transaction:update': true,
    'transaction:delete': true,
    'transaction:post': true,
    'transaction:void': true,
    'contact:create': true,
    'contact:read': true,
    'contact:update': true,
    'contact:delete': true,
    'product:create': true,
    'product:read': true,
    'product:update': true,
    'product:delete': true,
    'invoice:create': true,
    'invoice:read': true,
    'invoice:update': true,
    'invoice:delete': true,
    'bill:create': true,
    'bill:read': true,
    'bill:update': true,
    'bill:delete': true,
    'report:read': true,
    'report:export': true,
    'user:create': true,
    'user:read': true,
    'user:update': true,
    'user:delete': true,
    'company:read': true,
    'company:update': true,
    'company:delete': false, // Only OWNER can delete company
    'settings:read': true,
    'settings:update': true,
    'audit_log:read': true,
    'reconciliation:create': true,
    'reconciliation:read': true,
    'reconciliation:update': true,
    'reconciliation:delete': true,
    'cpg_data:create': true,
    'cpg_data:read': true,
    'cpg_data:update': true,
    'cpg_data:delete': true,
  },

  ACCOUNTANT: {
    // Manager role: Cannot delete/modify posted records
    'account:create': true,
    'account:read': true,
    'account:update': true,
    'account:delete': false, // Accountants typically don't delete accounts
    'transaction:create': true,
    'transaction:read': true,
    'transaction:update': true, // Only draft - checked in context
    'transaction:delete': false, // Cannot delete posted (checked in context)
    'transaction:post': true,
    'transaction:void': false, // Cannot void posted transactions
    'contact:create': true,
    'contact:read': true,
    'contact:update': true,
    'contact:delete': false,
    'product:create': true,
    'product:read': true,
    'product:update': true,
    'product:delete': false,
    'invoice:create': true,
    'invoice:read': true,
    'invoice:update': true,
    'invoice:delete': false,
    'bill:create': true,
    'bill:read': true,
    'bill:update': true,
    'bill:delete': false,
    'report:read': true,
    'report:export': true,
    'user:create': false,
    'user:read': true,
    'user:update': false,
    'user:delete': false,
    'company:read': true,
    'company:update': false,
    'company:delete': false,
    'settings:read': true,
    'settings:update': false,
    'audit_log:read': true,
    'reconciliation:create': true,
    'reconciliation:read': true,
    'reconciliation:update': true,
    'reconciliation:delete': false,
    'cpg_data:create': true,
    'cpg_data:read': true,
    'cpg_data:update': true,
    'cpg_data:delete': false,
  },

  BOOKKEEPER: {
    // Cannot access settings/users (key requirement)
    'account:create': false,
    'account:read': true,
    'account:update': false,
    'account:delete': false,
    'transaction:create': true,
    'transaction:read': true,
    'transaction:update': true, // Only draft transactions
    'transaction:delete': false,
    'transaction:post': false, // Cannot post transactions
    'transaction:void': false,
    'contact:create': true,
    'contact:read': true,
    'contact:update': true,
    'contact:delete': false,
    'product:create': true,
    'product:read': true,
    'product:update': true,
    'product:delete': false,
    'invoice:create': true,
    'invoice:read': true,
    'invoice:update': true,
    'invoice:delete': false,
    'bill:create': true,
    'bill:read': true,
    'bill:update': true,
    'bill:delete': false,
    'report:read': true,
    'report:export': false, // Limited export capability
    'user:create': false, // Cannot access users
    'user:read': false,
    'user:update': false,
    'user:delete': false,
    'company:read': true,
    'company:update': false,
    'company:delete': false,
    'settings:read': false, // Cannot access settings
    'settings:update': false,
    'audit_log:read': false, // Cannot access audit logs
    'reconciliation:create': true,
    'reconciliation:read': true,
    'reconciliation:update': true,
    'reconciliation:delete': false,
    'cpg_data:create': true,
    'cpg_data:read': true,
    'cpg_data:update': true,
    'cpg_data:delete': false,
  },

  VIEWER: {
    // Read-only access to all data (key requirement)
    'account:create': false,
    'account:read': true,
    'account:update': false,
    'account:delete': false,
    'transaction:create': false,
    'transaction:read': true,
    'transaction:update': false,
    'transaction:delete': false,
    'transaction:post': false,
    'transaction:void': false,
    'contact:create': false,
    'contact:read': true,
    'contact:update': false,
    'contact:delete': false,
    'product:create': false,
    'product:read': true,
    'product:update': false,
    'product:delete': false,
    'invoice:create': false,
    'invoice:read': true,
    'invoice:update': false,
    'invoice:delete': false,
    'bill:create': false,
    'bill:read': true,
    'bill:update': false,
    'bill:delete': false,
    'report:read': true,
    'report:export': false, // Cannot export (prevents data exfiltration)
    'user:create': false,
    'user:read': false, // Cannot view user list
    'user:update': false,
    'user:delete': false,
    'company:read': true, // Can view company info
    'company:update': false,
    'company:delete': false,
    'settings:read': false, // Cannot access settings
    'settings:update': false,
    'audit_log:read': false, // Cannot access audit logs
    'reconciliation:create': false,
    'reconciliation:read': true,
    'reconciliation:update': false,
    'reconciliation:delete': false,
    'cpg_data:create': false,
    'cpg_data:read': true,
    'cpg_data:update': false,
    'cpg_data:delete': false,
  },
}

// ============================================================================
// Permission Check Functions
// ============================================================================

/**
 * Check if a user has permission to perform an action on a resource
 *
 * IMPORTANT: This function ONLY checks RBAC permissions.
 * You MUST check company ownership FIRST using authorization.ts helpers:
 * - requireCompanyOwnership() for single entity
 * - requireBatchCompanyOwnership() for multiple entities
 * - validateCompanyId() for query operations
 *
 * @param companyUser - The user's role and permissions in the company
 * @param action - The action to perform (create, read, update, delete, etc.)
 * @param resource - The resource type (account, transaction, etc.)
 * @param context - Optional context for permission decisions
 * @returns true if user has permission, false otherwise
 *
 * @example
 * ```typescript
 * // Step 1: Check company ownership
 * const authCheck = requireCompanyOwnership(account, companyId)
 * if (!authCheck.authorized) {
 *   return { success: false, error: authCheck.error }
 * }
 *
 * // Step 2: Check RBAC permissions
 * if (!checkPermission(companyUser, 'delete', 'account')) {
 *   return {
 *     success: false,
 *     error: { code: 'FORBIDDEN', message: 'Insufficient permissions' }
 *   }
 * }
 *
 * // Step 3: Perform the action
 * await deleteAccount(account.id)
 * ```
 */
export function checkPermission(
  companyUser: CompanyUser | Pick<CompanyUser, 'role'>,
  action: Action,
  resource: Resource,
  context?: PermissionContext
): boolean {
  const { role } = companyUser
  const permissionKey = `${resource}:${action}`

  // Get base permission from matrix
  const hasBasePermission = PERMISSION_MATRIX[role]?.[permissionKey] ?? false

  // If no base permission, deny immediately
  if (!hasBasePermission) {
    return false
  }

  // Apply contextual rules for special cases
  return applyContextualRules(role, action, resource, context, hasBasePermission)
}

/**
 * Apply contextual rules for special permission cases
 *
 * @internal
 */
function applyContextualRules(
  role: UserRole,
  action: Action,
  resource: Resource,
  context: PermissionContext | undefined,
  hasBasePermission: boolean
): boolean {
  // If no context provided, use base permission
  if (!context) {
    return hasBasePermission
  }

  // Special rule: ACCOUNTANT cannot modify/delete posted transactions
  if (role === 'ACCOUNTANT' && resource === 'transaction') {
    const { transactionStatus } = context

    // If transaction is posted or reconciled, ACCOUNTANT cannot update/delete/void
    if (
      transactionStatus === TransactionStatus.POSTED ||
      transactionStatus === TransactionStatus.RECONCILED
    ) {
      if (action === 'update' || action === 'delete' || action === 'void') {
        return false
      }
    }
  }

  // Special rule: BOOKKEEPER can only modify draft transactions
  if (role === 'BOOKKEEPER' && resource === 'transaction') {
    const { transactionStatus } = context

    // BOOKKEEPER can only update draft transactions
    if (transactionStatus && transactionStatus !== TransactionStatus.DRAFT) {
      if (action === 'update') {
        return false
      }
    }
  }

  return hasBasePermission
}

/**
 * Check if user has any of the specified permissions
 *
 * @param companyUser - The user's role in the company
 * @param permissions - Array of [action, resource] tuples
 * @param context - Optional context for permission decisions
 * @returns true if user has ANY of the permissions
 *
 * @example
 * ```typescript
 * const canModify = hasAnyPermission(
 *   companyUser,
 *   [['update', 'transaction'], ['delete', 'transaction']],
 *   { transactionStatus: 'DRAFT' }
 * )
 * ```
 */
export function hasAnyPermission(
  companyUser: CompanyUser | Pick<CompanyUser, 'role'>,
  permissions: Array<[Action, Resource]>,
  context?: PermissionContext
): boolean {
  return permissions.some(([action, resource]) =>
    checkPermission(companyUser, action, resource, context)
  )
}

/**
 * Check if user has all of the specified permissions
 *
 * @param companyUser - The user's role in the company
 * @param permissions - Array of [action, resource] tuples
 * @param context - Optional context for permission decisions
 * @returns true if user has ALL of the permissions
 *
 * @example
 * ```typescript
 * const canManageUsers = hasAllPermissions(
 *   companyUser,
 *   [['create', 'user'], ['update', 'user'], ['delete', 'user']]
 * )
 * ```
 */
export function hasAllPermissions(
  companyUser: CompanyUser | Pick<CompanyUser, 'role'>,
  permissions: Array<[Action, Resource]>,
  context?: PermissionContext
): boolean {
  return permissions.every(([action, resource]) =>
    checkPermission(companyUser, action, resource, context)
  )
}

/**
 * Get all permissions for a given role
 *
 * Useful for debugging or displaying user capabilities in UI.
 *
 * @param role - The user role
 * @returns Object mapping permission keys to boolean values
 */
export function getPermissionsForRole(role: UserRole): Record<string, boolean> {
  return { ...PERMISSION_MATRIX[role] }
}

/**
 * Check if role can access settings
 *
 * Settings include: company settings, user management, billing
 *
 * @param role - The user role
 * @returns true if role can access settings
 */
export function canAccessSettings(role: UserRole): boolean {
  return role === 'OWNER' || role === 'ADMIN' || role === 'ACCOUNTANT'
}

/**
 * Check if role can manage users
 *
 * @param role - The user role
 * @returns true if role can manage users
 */
export function canManageUsers(role: UserRole): boolean {
  return role === 'OWNER' || role === 'ADMIN'
}

/**
 * Check if role can modify posted transactions
 *
 * @param role - The user role
 * @returns true if role can modify posted transactions
 */
export function canModifyPostedTransactions(role: UserRole): boolean {
  return role === 'OWNER' || role === 'ADMIN'
}

/**
 * Check if role can export data
 *
 * @param role - The user role
 * @returns true if role can export data
 */
export function canExportData(role: UserRole): boolean {
  return role === 'OWNER' || role === 'ADMIN' || role === 'ACCOUNTANT'
}

/**
 * Get user-friendly role description
 *
 * @param role - The user role
 * @returns Human-readable description of role capabilities
 */
export function getRoleDescription(role: UserRole): string {
  const descriptions: Record<UserRole, string> = {
    OWNER:
      'Full access to all features including company deletion and billing. Can manage all users and settings.',
    ADMIN:
      'Full access to all features except company deletion. Can manage users, settings, and all financial data including posted transactions.',
    ACCOUNTANT:
      'Full read access and can manage draft transactions. Cannot modify or delete posted financial records. Can generate reports and access settings.',
    BOOKKEEPER:
      'Can create and manage draft transactions, contacts, invoices, and bills. Cannot access settings, users, or posted transactions.',
    VIEWER:
      'Read-only access to all financial data and reports. Cannot create, modify, or delete any records. Cannot export data.',
  }

  return descriptions[role]
}

/**
 * Get role hierarchy level
 *
 * Higher number = more privileges
 * Useful for comparing roles or determining if one role supersedes another
 *
 * @param role - The user role
 * @returns Numeric hierarchy level (1-5)
 */
export function getRoleHierarchyLevel(role: UserRole): number {
  const hierarchy: Record<UserRole, number> = {
    OWNER: 5,
    ADMIN: 4,
    ACCOUNTANT: 3,
    BOOKKEEPER: 2,
    VIEWER: 1,
  }

  return hierarchy[role]
}

/**
 * Check if one role has higher or equal privileges than another
 *
 * @param userRole - The user's role
 * @param requiredRole - The minimum required role
 * @returns true if userRole >= requiredRole in hierarchy
 *
 * @example
 * ```typescript
 * // Check if user has at least Manager (ACCOUNTANT) privileges
 * if (!hasMinimumRole(companyUser.role, 'ACCOUNTANT')) {
 *   return { success: false, error: { code: 'FORBIDDEN' } }
 * }
 * ```
 */
export function hasMinimumRole(
  userRole: UserRole,
  requiredRole: UserRole
): boolean {
  return getRoleHierarchyLevel(userRole) >= getRoleHierarchyLevel(requiredRole)
}

// ============================================================================
// Permission Error Helpers
// ============================================================================

/**
 * Standard error for permission denied
 */
export const PERMISSION_DENIED_ERROR = {
  code: 'FORBIDDEN' as const,
  message: 'You do not have permission to perform this action.',
}

/**
 * Error for insufficient role
 */
export const INSUFFICIENT_ROLE_ERROR = {
  code: 'FORBIDDEN' as const,
  message: 'Your role does not have sufficient privileges for this action.',
}

/**
 * Error for posted transaction modification (for ACCOUNTANT/BOOKKEEPER)
 */
export const CANNOT_MODIFY_POSTED_ERROR = {
  code: 'FORBIDDEN' as const,
  message: 'Posted transactions cannot be modified. Only draft transactions can be edited.',
}

/**
 * Error for settings access (for BOOKKEEPER/VIEWER)
 */
export const CANNOT_ACCESS_SETTINGS_ERROR = {
  code: 'FORBIDDEN' as const,
  message: 'You do not have permission to access settings.',
}

/**
 * Get appropriate permission error based on context
 *
 * @param role - The user's role
 * @param action - The action attempted
 * @param resource - The resource attempted
 * @param context - Optional context
 * @returns Appropriate error object with user-friendly message
 */
export function getPermissionError(
  role: UserRole,
  action: Action,
  resource: Resource,
  context?: PermissionContext
) {
  // Check for posted transaction modification
  if (
    resource === 'transaction' &&
    (action === 'update' || action === 'delete' || action === 'void') &&
    context?.transactionStatus &&
    (context.transactionStatus === TransactionStatus.POSTED || context.transactionStatus === TransactionStatus.RECONCILED)
  ) {
    if (role === 'ACCOUNTANT' || role === 'BOOKKEEPER') {
      return CANNOT_MODIFY_POSTED_ERROR
    }
  }

  // Check for settings access
  if (resource === 'settings' || resource === 'user') {
    if (role === 'BOOKKEEPER' || role === 'VIEWER') {
      return CANNOT_ACCESS_SETTINGS_ERROR
    }
  }

  // Check for role-based restriction
  if (role === 'VIEWER' && action !== 'read') {
    return {
      code: 'FORBIDDEN' as const,
      message: 'View-only users cannot modify data. Please contact your administrator for access.',
    }
  }

  // Default permission denied
  return PERMISSION_DENIED_ERROR
}
