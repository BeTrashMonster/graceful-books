/**
 * Admin Permissions & Role-Based Access Control (RBAC)
 *
 * Defines all permission types and role-to-permission mappings for admin users
 */

/**
 * Complete list of admin permissions
 */
export const Permissions = {
  // User Management
  VIEW_USERS: 'view_users',
  MANAGE_USERS: 'manage_users',
  SUSPEND_USERS: 'suspend_users',
  DELETE_USERS: 'delete_users',

  // Product & Subscription Management
  VIEW_PRODUCTS: 'view_products',
  MANAGE_PRODUCTS: 'manage_products',
  VIEW_SUBSCRIPTIONS: 'view_subscriptions',
  MANAGE_SUBSCRIPTIONS: 'manage_subscriptions',

  // Financial Operations
  VIEW_PAYMENTS: 'view_payments',
  PROCESS_REFUNDS: 'process_refunds',
  MANAGE_PAYOUTS: 'manage_payouts',
  EXPORT_FINANCIAL_DATA: 'export_financial_data',

  // Charity Management
  VIEW_CHARITIES: 'view_charities',
  MANAGE_CHARITIES: 'manage_charities',

  // Affiliate Management
  VIEW_AFFILIATES: 'view_affiliates',
  MANAGE_AFFILIATES: 'manage_affiliates',

  // Discount Management
  VIEW_DISCOUNTS: 'view_discounts',
  MANAGE_DISCOUNTS: 'manage_discounts',

  // Analytics & Reporting
  VIEW_ANALYTICS: 'view_analytics',
  EXPORT_REPORTS: 'export_reports',

  // Admin User Management
  MANAGE_ADMIN_USERS: 'manage_admin_users',

  // System Configuration
  MANAGE_SETTINGS: 'manage_settings',
  VIEW_AUDIT_LOG: 'view_audit_log',
} as const;

export type Permission = (typeof Permissions)[keyof typeof Permissions];

/**
 * Admin role definitions with permissions
 */
export const AdminRoles = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  SUPPORT: 'support',
  FINANCE: 'finance',
} as const;

export type AdminRole = (typeof AdminRoles)[keyof typeof AdminRoles];

/**
 * Role to permissions mapping
 */
export const RolePermissions: Record<AdminRole, Permission[] | ['*']> = {
  // Super Admin has all permissions
  [AdminRoles.SUPER_ADMIN]: ['*'],

  // Admin: General administrative access (cannot manage other admins)
  [AdminRoles.ADMIN]: [
    Permissions.VIEW_USERS,
    Permissions.MANAGE_USERS,
    Permissions.SUSPEND_USERS,
    Permissions.VIEW_PRODUCTS,
    Permissions.MANAGE_PRODUCTS,
    Permissions.VIEW_SUBSCRIPTIONS,
    Permissions.MANAGE_SUBSCRIPTIONS,
    Permissions.VIEW_PAYMENTS,
    Permissions.VIEW_CHARITIES,
    Permissions.MANAGE_CHARITIES,
    Permissions.VIEW_AFFILIATES,
    Permissions.MANAGE_AFFILIATES,
    Permissions.VIEW_DISCOUNTS,
    Permissions.MANAGE_DISCOUNTS,
    Permissions.VIEW_ANALYTICS,
    Permissions.EXPORT_REPORTS,
    Permissions.VIEW_AUDIT_LOG,
  ],

  // Support: Customer support access (view-only financial data)
  [AdminRoles.SUPPORT]: [
    Permissions.VIEW_USERS,
    Permissions.VIEW_PRODUCTS,
    Permissions.VIEW_SUBSCRIPTIONS,
    Permissions.VIEW_PAYMENTS,
    Permissions.VIEW_CHARITIES,
    Permissions.VIEW_AFFILIATES,
    Permissions.VIEW_DISCOUNTS,
  ],

  // Finance: Financial operations only
  [AdminRoles.FINANCE]: [
    Permissions.VIEW_USERS,
    Permissions.VIEW_PAYMENTS,
    Permissions.PROCESS_REFUNDS,
    Permissions.MANAGE_PAYOUTS,
    Permissions.EXPORT_FINANCIAL_DATA,
    Permissions.VIEW_CHARITIES,
    Permissions.VIEW_ANALYTICS,
    Permissions.EXPORT_REPORTS,
  ],
};

/**
 * Check if a user has a specific permission
 */
export function hasPermission(
  userPermissions: Permission[] | ['*'],
  requiredPermission: Permission
): boolean {
  // Super admin wildcard
  if (userPermissions.includes('*' as Permission)) {
    return true;
  }

  return userPermissions.includes(requiredPermission);
}

/**
 * Check if a role has a specific permission
 */
export function roleHasPermission(role: AdminRole, permission: Permission): boolean {
  const rolePerms = RolePermissions[role];
  return hasPermission(rolePerms, permission);
}

/**
 * Check if user has any of the specified permissions
 */
export function hasAnyPermission(
  userPermissions: Permission[] | ['*'],
  requiredPermissions: Permission[]
): boolean {
  if (userPermissions.includes('*' as Permission)) {
    return true;
  }

  return requiredPermissions.some((perm) => userPermissions.includes(perm));
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: AdminRole): Permission[] {
  const permissions = RolePermissions[role];
  if (permissions[0] === '*') {
    // Return all available permissions for super admin
    return Object.values(Permissions);
  }
  return permissions;
}

/**
 * Permission groups for UI organization
 */
export const PermissionGroups = {
  'User Management': [
    Permissions.VIEW_USERS,
    Permissions.MANAGE_USERS,
    Permissions.SUSPEND_USERS,
    Permissions.DELETE_USERS,
  ],
  'Product & Subscriptions': [
    Permissions.VIEW_PRODUCTS,
    Permissions.MANAGE_PRODUCTS,
    Permissions.VIEW_SUBSCRIPTIONS,
    Permissions.MANAGE_SUBSCRIPTIONS,
  ],
  'Financial Operations': [
    Permissions.VIEW_PAYMENTS,
    Permissions.PROCESS_REFUNDS,
    Permissions.MANAGE_PAYOUTS,
    Permissions.EXPORT_FINANCIAL_DATA,
  ],
  'Charity Management': [Permissions.VIEW_CHARITIES, Permissions.MANAGE_CHARITIES],
  'Affiliate Management': [Permissions.VIEW_AFFILIATES, Permissions.MANAGE_AFFILIATES],
  'Discount Management': [Permissions.VIEW_DISCOUNTS, Permissions.MANAGE_DISCOUNTS],
  'Analytics & Reporting': [Permissions.VIEW_ANALYTICS, Permissions.EXPORT_REPORTS],
  'System Administration': [
    Permissions.MANAGE_ADMIN_USERS,
    Permissions.MANAGE_SETTINGS,
    Permissions.VIEW_AUDIT_LOG,
  ],
} as const;
