/**
 * Role-Based Backup Filtering Service
 *
 * Implements data filtering by user permission level per Task 1.3 of
 * ROADMAP_BACKUP_AND_SYNC.md. This service ensures that backup data is
 * properly filtered based on the user's role, preventing unauthorized
 * access to sensitive data (IDOR protection - OWASP A01: Broken Access Control).
 *
 * Role Hierarchy:
 * - Admin: Full access to all company data including audit logs
 * - Manager: Access to financial data, cannot see audit logs
 * - Bookkeeper: Access to transactions and accounts, cannot see settings
 * - View-Only: Read-only access to reports only, no raw transaction data
 *
 * Security Requirements:
 * - IDOR Protection: Users cannot access data they're not authorized for
 * - Zero-Knowledge: All data remains encrypted, filtering is structural only
 * - Audit Trail: All filtering operations are logged
 *
 * @see Roadmaps/ROADMAP_BACKUP_AND_SYNC.md - Phase 1, Task 1.3
 */

import type { DatabaseExport } from '../../db';
import { logger } from '../../utils/logger';
import { AppError, ErrorCode } from '../../utils/errors';

const filterLogger = logger.child('RoleFilterService');

/**
 * User roles for backup filtering
 * Mapped to existing UserRole enum values but using consistent casing
 */
export type UserRole = 'Admin' | 'Manager' | 'Bookkeeper' | 'View-Only';

/**
 * Data types that can be included in backups
 */
export type DataType =
  | 'transactions'
  | 'transactionLineItems'
  | 'accounts'
  | 'contacts'
  | 'products'
  | 'users'
  | 'companies'
  | 'companyUsers'
  | 'auditLogs'
  | 'sessions'
  | 'devices'
  | 'receipts'
  | 'categories'
  | 'reconciliationPatterns'
  | 'reconciliationRecords'
  | 'invoices'
  | 'bills'
  | 'preferences'
  | 'reports';

/**
 * Filtered backup data structure
 * Contains only the data types the user's role is authorized to access
 */
export interface FilteredBackupData {
  /** Database version */
  version: number;
  /** Filtered data by data type */
  data: Partial<DatabaseExport['data']>;
  /** Metadata about filtering */
  filterMetadata: {
    userRole: UserRole;
    filteredAt: number;
    includedDataTypes: DataType[];
    excludedDataTypes: DataType[];
  };
}

/**
 * Role permissions mapping
 * Defines which data types each role can access in backups
 */
const ROLE_PERMISSIONS: Record<UserRole, DataType[]> = {
  // Admin: Full access to all company data
  Admin: [
    'transactions',
    'transactionLineItems',
    'accounts',
    'contacts',
    'products',
    'users',
    'companies',
    'companyUsers',
    'auditLogs',
    'sessions',
    'devices',
    'receipts',
    'categories',
    'reconciliationPatterns',
    'reconciliationRecords',
    'invoices',
    'bills',
    'preferences',
    'reports',
  ],
  // Manager: Access to financial data, no audit logs
  Manager: [
    'transactions',
    'transactionLineItems',
    'accounts',
    'contacts',
    'products',
    'companies',
    'receipts',
    'categories',
    'reconciliationPatterns',
    'reconciliationRecords',
    'invoices',
    'bills',
    'reports',
  ],
  // Bookkeeper: Access to transactions and accounts, no settings or user data
  Bookkeeper: [
    'transactions',
    'transactionLineItems',
    'accounts',
    'contacts',
    'products',
    'receipts',
    'categories',
    'invoices',
    'bills',
    'reports',
  ],
  // View-Only: Reports only, no raw transaction data
  'View-Only': ['reports'],
};

/**
 * Role-Based Backup Filter Service
 *
 * Filters backup data based on user role to enforce access control
 */
export class RoleFilterService {
  /**
   * Filter backup data by user role
   *
   * Takes a full database export and returns only the data types
   * that the user's role is authorized to access.
   *
   * @param fullData - Complete database export
   * @param userRole - User's role for filtering
   * @returns Filtered backup data containing only authorized data types
   *
   * @throws {AppError} If userRole is invalid
   *
   * @example
   * ```typescript
   * const fullBackup = await db.exportAllData();
   * const filtered = RoleFilterService.filterDataByRole(fullBackup, 'Bookkeeper');
   * // filtered.data contains only transactions, accounts, etc. (no audit logs)
   * ```
   */
  static filterDataByRole(
    fullData: DatabaseExport,
    userRole: UserRole
  ): FilteredBackupData {
    try {
      filterLogger.info('Filtering backup data by role', { userRole });

      // Validate user role
      if (!this.isValidRole(userRole)) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          `Invalid user role: ${userRole}. Must be one of: Admin, Manager, Bookkeeper, View-Only.`
        );
      }

      // Get allowed data types for this role
      const allowedDataTypes = this.getRolePermissions(userRole);
      filterLogger.debug('Role permissions determined', {
        userRole,
        allowedCount: allowedDataTypes.length,
      });

      // Create filtered data object
      const filteredData: Partial<DatabaseExport['data']> = {};

      // Get all available data types from the full export
      const availableDataTypes = Object.keys(fullData.data) as DataType[];

      // Filter data based on role permissions
      for (const dataType of availableDataTypes) {
        if (this.validateRoleAccess(userRole, dataType)) {
          // User has access to this data type
          filteredData[dataType] = fullData.data[dataType];
        }
      }

      // Determine excluded data types for metadata
      const includedDataTypes = Object.keys(filteredData) as DataType[];
      const excludedDataTypes = availableDataTypes.filter(
        (dt) => !includedDataTypes.includes(dt)
      );

      filterLogger.info('Backup data filtered successfully', {
        userRole,
        includedCount: includedDataTypes.length,
        excludedCount: excludedDataTypes.length,
      });

      // Return filtered backup with metadata
      return {
        version: fullData.version,
        data: filteredData,
        filterMetadata: {
          userRole,
          filteredAt: Date.now(),
          includedDataTypes,
          excludedDataTypes,
        },
      };
    } catch (error) {
      filterLogger.error('Failed to filter backup data by role', {
        error,
        userRole,
      });

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        ErrorCode.UNKNOWN_ERROR,
        error instanceof Error
          ? `Something unexpected happened while filtering backup data: ${error.message}`
          : 'An unexpected error occurred while filtering backup data.'
      );
    }
  }

  /**
   * Get allowed data types for a user role
   *
   * Returns an array of data types that the specified role
   * is authorized to access in backups.
   *
   * @param userRole - User's role
   * @returns Array of allowed data types
   *
   * @throws {AppError} If userRole is invalid
   *
   * @example
   * ```typescript
   * const permissions = RoleFilterService.getRolePermissions('Manager');
   * // ['transactions', 'accounts', 'contacts', ...]
   * ```
   */
  static getRolePermissions(userRole: UserRole): DataType[] {
    if (!this.isValidRole(userRole)) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        `Invalid user role: ${userRole}. Must be one of: Admin, Manager, Bookkeeper, View-Only.`
      );
    }

    return ROLE_PERMISSIONS[userRole];
  }

  /**
   * Validate if a user role has access to a specific data type
   *
   * Checks whether the specified role is authorized to access
   * the given data type in backups.
   *
   * @param userRole - User's role
   * @param dataType - Data type to check access for
   * @returns True if role has access, false otherwise
   *
   * @example
   * ```typescript
   * const canAccess = RoleFilterService.validateRoleAccess('Bookkeeper', 'auditLogs');
   * // false - Bookkeepers cannot access audit logs
   * ```
   */
  static validateRoleAccess(userRole: UserRole, dataType: DataType): boolean {
    try {
      if (!this.isValidRole(userRole)) {
        filterLogger.warn('Invalid role in access validation', { userRole });
        return false;
      }

      const allowedDataTypes = ROLE_PERMISSIONS[userRole];
      const hasAccess = allowedDataTypes.includes(dataType);

      filterLogger.debug('Role access validation', {
        userRole,
        dataType,
        hasAccess,
      });

      return hasAccess;
    } catch (error) {
      filterLogger.error('Access validation error', { error, userRole, dataType });
      // Fail closed: deny access on error
      return false;
    }
  }

  /**
   * Check if a role is valid
   *
   * @param role - Role to validate
   * @returns True if valid role, false otherwise
   */
  private static isValidRole(role: string): role is UserRole {
    return role === 'Admin' || role === 'Manager' || role === 'Bookkeeper' || role === 'View-Only';
  }

  /**
   * Get role hierarchy level
   *
   * Returns a numeric value representing the role's access level.
   * Higher numbers mean more access.
   *
   * @param userRole - User's role
   * @returns Numeric hierarchy level (0-3)
   */
  static getRoleHierarchyLevel(userRole: UserRole): number {
    const hierarchy: Record<UserRole, number> = {
      'View-Only': 0,
      Bookkeeper: 1,
      Manager: 2,
      Admin: 3,
    };

    return hierarchy[userRole] ?? -1;
  }

  /**
   * Compare two roles
   *
   * Determines if role1 has equal or greater permissions than role2.
   *
   * @param role1 - First role to compare
   * @param role2 - Second role to compare
   * @returns True if role1 >= role2 in hierarchy
   *
   * @example
   * ```typescript
   * const hasGreaterAccess = RoleFilterService.compareRoles('Manager', 'Bookkeeper');
   * // true - Manager has more access than Bookkeeper
   * ```
   */
  static compareRoles(role1: UserRole, role2: UserRole): boolean {
    return this.getRoleHierarchyLevel(role1) >= this.getRoleHierarchyLevel(role2);
  }

  /**
   * Get human-readable role description
   *
   * Returns a user-friendly description of what each role can access.
   *
   * @param userRole - User's role
   * @returns Description of role permissions
   */
  static getRoleDescription(userRole: UserRole): string {
    const descriptions: Record<UserRole, string> = {
      Admin: 'Full access to all company data including audit logs, settings, and user management.',
      Manager: 'Access to all financial data and reports. Cannot view audit logs or manage users.',
      Bookkeeper: 'Access to transactions, accounts, and related financial records. Cannot view settings or user data.',
      'View-Only': 'Read-only access to reports and summaries. Cannot view raw transaction data.',
    };

    return descriptions[userRole] || 'Unknown role';
  }

  /**
   * Count filtered records
   *
   * Counts the total number of records in filtered backup data.
   *
   * @param filteredData - Filtered backup data
   * @returns Total record count
   */
  static countFilteredRecords(filteredData: FilteredBackupData): number {
    let count = 0;

    for (const dataType of Object.keys(filteredData.data)) {
      const records = filteredData.data[dataType as keyof typeof filteredData.data];
      if (Array.isArray(records)) {
        count += records.length;
      }
    }

    return count;
  }

  /**
   * Validate filtered backup integrity
   *
   * Ensures that filtered backup data contains only authorized data types
   * and no unauthorized data leaked through.
   *
   * @param filteredData - Filtered backup data to validate
   * @returns True if valid, false if unauthorized data detected
   */
  static validateFilteredBackup(filteredData: FilteredBackupData): boolean {
    try {
      const { userRole, includedDataTypes } = filteredData.filterMetadata;
      const allowedDataTypes = this.getRolePermissions(userRole);

      // Check that all included data types are authorized
      for (const dataType of includedDataTypes) {
        if (!allowedDataTypes.includes(dataType)) {
          filterLogger.error('Unauthorized data type in filtered backup', {
            userRole,
            unauthorizedType: dataType,
          });
          return false;
        }
      }

      // Check that data object matches metadata
      const actualDataTypes = Object.keys(filteredData.data) as DataType[];
      const metadataMatch =
        actualDataTypes.length === includedDataTypes.length &&
        actualDataTypes.every((dt) => includedDataTypes.includes(dt));

      if (!metadataMatch) {
        filterLogger.error('Filtered backup metadata mismatch', {
          actual: actualDataTypes,
          metadata: includedDataTypes,
        });
        return false;
      }

      return true;
    } catch (error) {
      filterLogger.error('Filtered backup validation error', error);
      return false;
    }
  }
}
