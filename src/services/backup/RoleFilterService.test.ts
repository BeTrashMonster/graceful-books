/**
 * Tests for Role-Based Backup Filtering Service
 *
 * Comprehensive test suite for Task 1.3 of ROADMAP_BACKUP_AND_SYNC.md
 * Tests all four permission levels and IDOR protection
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RoleFilterService, type UserRole, type DataType } from './RoleFilterService';
import type { DatabaseExport } from '../../db';
import { ErrorCode } from '../../utils/errors';

/**
 * Create a mock full database export with all data types
 */
function createMockDatabaseExport(): DatabaseExport {
  return {
    version: 1,
    exportedAt: Date.now(),
    data: {
      accounts: [
        { id: 'acc1', name: 'Cash', type: 'ASSET', balance: '1000' } as any,
        { id: 'acc2', name: 'Revenue', type: 'INCOME', balance: '5000' } as any,
      ],
      transactions: [
        { id: 'txn1', transaction_number: 'TXN-001', status: 'POSTED' } as any,
        { id: 'txn2', transaction_number: 'TXN-002', status: 'DRAFT' } as any,
      ],
      transactionLineItems: [
        { id: 'li1', transaction_id: 'txn1', amount: '100' } as any,
        { id: 'li2', transaction_id: 'txn1', amount: '-100' } as any,
      ],
      contacts: [
        { id: 'cnt1', name: 'ACME Corp', type: 'CUSTOMER' } as any,
        { id: 'cnt2', name: 'Supplier Inc', type: 'VENDOR' } as any,
      ],
      products: [
        { id: 'prd1', name: 'Widget', price: '99.99' } as any,
        { id: 'prd2', name: 'Gadget', price: '49.99' } as any,
      ],
      users: [
        { id: 'usr1', email: 'admin@example.com', name: 'Admin User' } as any,
        { id: 'usr2', email: 'bookkeeper@example.com', name: 'Bookkeeper' } as any,
      ],
      companies: [
        { id: 'cmp1', name: 'Test Company', currency: 'USD' } as any,
      ],
      companyUsers: [
        { id: 'cu1', company_id: 'cmp1', user_id: 'usr1', role: 'ADMIN' } as any,
        { id: 'cu2', company_id: 'cmp1', user_id: 'usr2', role: 'BOOKKEEPER' } as any,
      ],
      auditLogs: [
        { id: 'aud1', action: 'CREATE', entity_type: 'TRANSACTION' } as any,
        { id: 'aud2', action: 'UPDATE', entity_type: 'ACCOUNT' } as any,
      ],
      sessions: [
        { id: 'ses1', user_id: 'usr1', device_id: 'dev1' } as any,
      ],
      devices: [
        { id: 'dev1', user_id: 'usr1', device_name: 'Browser' } as any,
      ],
    },
  };
}

describe('RoleFilterService', () => {
  let mockFullData: DatabaseExport;

  beforeEach(() => {
    mockFullData = createMockDatabaseExport();
  });

  describe('filterDataByRole', () => {
    describe('Admin role', () => {
      it('should include all data types for Admin', () => {
        const filtered = RoleFilterService.filterDataByRole(mockFullData, 'Admin');

        expect(filtered.filterMetadata.userRole).toBe('Admin');
        expect(filtered.data.accounts).toBeDefined();
        expect(filtered.data.transactions).toBeDefined();
        expect(filtered.data.transactionLineItems).toBeDefined();
        expect(filtered.data.contacts).toBeDefined();
        expect(filtered.data.products).toBeDefined();
        expect(filtered.data.users).toBeDefined();
        expect(filtered.data.companies).toBeDefined();
        expect(filtered.data.companyUsers).toBeDefined();
        expect(filtered.data.auditLogs).toBeDefined();
        expect(filtered.data.sessions).toBeDefined();
        expect(filtered.data.devices).toBeDefined();
      });

      it('should preserve all data records for Admin', () => {
        const filtered = RoleFilterService.filterDataByRole(mockFullData, 'Admin');

        expect(filtered.data.accounts?.length).toBe(2);
        expect(filtered.data.transactions?.length).toBe(2);
        expect(filtered.data.transactionLineItems?.length).toBe(2);
        expect(filtered.data.auditLogs?.length).toBe(2);
      });

      it('should include audit logs for Admin only', () => {
        const filtered = RoleFilterService.filterDataByRole(mockFullData, 'Admin');

        expect(filtered.data.auditLogs).toBeDefined();
        expect(filtered.data.auditLogs?.length).toBe(2);
      });

      it('should have no excluded data types for Admin', () => {
        const filtered = RoleFilterService.filterDataByRole(mockFullData, 'Admin');

        expect(filtered.filterMetadata.excludedDataTypes).toHaveLength(0);
      });
    });

    describe('Manager role', () => {
      it('should include financial data for Manager', () => {
        const filtered = RoleFilterService.filterDataByRole(mockFullData, 'Manager');

        expect(filtered.filterMetadata.userRole).toBe('Manager');
        expect(filtered.data.accounts).toBeDefined();
        expect(filtered.data.transactions).toBeDefined();
        expect(filtered.data.transactionLineItems).toBeDefined();
        expect(filtered.data.contacts).toBeDefined();
        expect(filtered.data.products).toBeDefined();
        expect(filtered.data.companies).toBeDefined();
      });

      it('should exclude audit logs for Manager', () => {
        const filtered = RoleFilterService.filterDataByRole(mockFullData, 'Manager');

        expect(filtered.data.auditLogs).toBeUndefined();
        expect(filtered.filterMetadata.excludedDataTypes).toContain('auditLogs');
      });

      it('should exclude user management data for Manager', () => {
        const filtered = RoleFilterService.filterDataByRole(mockFullData, 'Manager');

        expect(filtered.data.users).toBeUndefined();
        expect(filtered.data.companyUsers).toBeUndefined();
        expect(filtered.data.sessions).toBeUndefined();
        expect(filtered.data.devices).toBeUndefined();
      });

      it('should preserve financial records for Manager', () => {
        const filtered = RoleFilterService.filterDataByRole(mockFullData, 'Manager');

        expect(filtered.data.accounts?.length).toBe(2);
        expect(filtered.data.transactions?.length).toBe(2);
        expect(filtered.data.contacts?.length).toBe(2);
      });
    });

    describe('Bookkeeper role', () => {
      it('should include transaction data for Bookkeeper', () => {
        const filtered = RoleFilterService.filterDataByRole(mockFullData, 'Bookkeeper');

        expect(filtered.filterMetadata.userRole).toBe('Bookkeeper');
        expect(filtered.data.accounts).toBeDefined();
        expect(filtered.data.transactions).toBeDefined();
        expect(filtered.data.transactionLineItems).toBeDefined();
        expect(filtered.data.contacts).toBeDefined();
        expect(filtered.data.products).toBeDefined();
      });

      it('should exclude settings and user data for Bookkeeper', () => {
        const filtered = RoleFilterService.filterDataByRole(mockFullData, 'Bookkeeper');

        expect(filtered.data.auditLogs).toBeUndefined();
        expect(filtered.data.users).toBeUndefined();
        expect(filtered.data.companyUsers).toBeUndefined();
        expect(filtered.data.sessions).toBeUndefined();
        expect(filtered.data.devices).toBeUndefined();
        expect(filtered.data.companies).toBeUndefined();
      });

      it('should preserve transaction records for Bookkeeper', () => {
        const filtered = RoleFilterService.filterDataByRole(mockFullData, 'Bookkeeper');

        expect(filtered.data.accounts?.length).toBe(2);
        expect(filtered.data.transactions?.length).toBe(2);
        expect(filtered.data.transactionLineItems?.length).toBe(2);
      });

      it('should have more exclusions than Manager', () => {
        const managerFiltered = RoleFilterService.filterDataByRole(mockFullData, 'Manager');
        const bookkeeperFiltered = RoleFilterService.filterDataByRole(mockFullData, 'Bookkeeper');

        expect(bookkeeperFiltered.filterMetadata.excludedDataTypes.length).toBeGreaterThan(
          managerFiltered.filterMetadata.excludedDataTypes.length
        );
      });
    });

    describe('View-Only role', () => {
      it('should include only reports for View-Only', () => {
        const filtered = RoleFilterService.filterDataByRole(mockFullData, 'View-Only');

        expect(filtered.filterMetadata.userRole).toBe('View-Only');
        // Mock data doesn't have reports, so includedDataTypes will be empty
        expect(filtered.filterMetadata.includedDataTypes).toEqual([]);
      });

      it('should exclude all raw transaction data for View-Only', () => {
        const filtered = RoleFilterService.filterDataByRole(mockFullData, 'View-Only');

        expect(filtered.data.transactions).toBeUndefined();
        expect(filtered.data.transactionLineItems).toBeUndefined();
        expect(filtered.data.accounts).toBeUndefined();
        expect(filtered.data.contacts).toBeUndefined();
        expect(filtered.data.products).toBeUndefined();
        expect(filtered.data.auditLogs).toBeUndefined();
        expect(filtered.data.users).toBeUndefined();
      });

      it('should have maximum exclusions for View-Only', () => {
        const filtered = RoleFilterService.filterDataByRole(mockFullData, 'View-Only');

        // View-Only should have the most exclusions (all data types except reports)
        expect(filtered.filterMetadata.excludedDataTypes.length).toBeGreaterThanOrEqual(10);
      });

      it('should include empty reports array if no reports exist', () => {
        const filtered = RoleFilterService.filterDataByRole(mockFullData, 'View-Only');

        // reports data type exists but may be empty
        expect(filtered.data.reports).toBeUndefined(); // since mockFullData doesn't have reports
        // When no reports exist in source data, includedDataTypes will be empty
        expect(filtered.filterMetadata.includedDataTypes).toEqual([]);
      });
    });

    describe('Edge cases', () => {
      it('should throw error for invalid role', () => {
        expect(() => {
          RoleFilterService.filterDataByRole(mockFullData, 'InvalidRole' as UserRole);
        }).toThrow();
      });

      it('should handle empty database export', () => {
        const emptyExport: DatabaseExport = {
          version: 1,
          exportedAt: Date.now(),
          data: {
            accounts: [],
            transactions: [],
            transactionLineItems: [],
            contacts: [],
            products: [],
            users: [],
            companies: [],
            companyUsers: [],
            auditLogs: [],
            sessions: [],
            devices: [],
          },
        };

        const filtered = RoleFilterService.filterDataByRole(emptyExport, 'Admin');

        expect(filtered.data.accounts).toEqual([]);
        expect(filtered.data.transactions).toEqual([]);
      });

      it('should include metadata with timestamp', () => {
        const beforeFilter = Date.now();
        const filtered = RoleFilterService.filterDataByRole(mockFullData, 'Manager');
        const afterFilter = Date.now();

        expect(filtered.filterMetadata.filteredAt).toBeGreaterThanOrEqual(beforeFilter);
        expect(filtered.filterMetadata.filteredAt).toBeLessThanOrEqual(afterFilter);
      });

      it('should preserve database version', () => {
        const filtered = RoleFilterService.filterDataByRole(mockFullData, 'Admin');

        expect(filtered.version).toBe(mockFullData.version);
      });
    });
  });

  describe('getRolePermissions', () => {
    it('should return correct permissions for Admin', () => {
      const permissions = RoleFilterService.getRolePermissions('Admin');

      expect(permissions).toContain('transactions');
      expect(permissions).toContain('accounts');
      expect(permissions).toContain('auditLogs');
      expect(permissions).toContain('users');
      expect(permissions).toContain('companies');
      expect(permissions.length).toBeGreaterThan(10);
    });

    it('should return correct permissions for Manager', () => {
      const permissions = RoleFilterService.getRolePermissions('Manager');

      expect(permissions).toContain('transactions');
      expect(permissions).toContain('accounts');
      expect(permissions).not.toContain('auditLogs');
      expect(permissions).not.toContain('users');
      expect(permissions).not.toContain('sessions');
    });

    it('should return correct permissions for Bookkeeper', () => {
      const permissions = RoleFilterService.getRolePermissions('Bookkeeper');

      expect(permissions).toContain('transactions');
      expect(permissions).toContain('accounts');
      expect(permissions).toContain('contacts');
      expect(permissions).not.toContain('auditLogs');
      expect(permissions).not.toContain('users');
      expect(permissions).not.toContain('companies');
    });

    it('should return correct permissions for View-Only', () => {
      const permissions = RoleFilterService.getRolePermissions('View-Only');

      expect(permissions).toEqual(['reports']);
      expect(permissions.length).toBe(1);
    });

    it('should throw error for invalid role', () => {
      expect(() => {
        RoleFilterService.getRolePermissions('InvalidRole' as UserRole);
      }).toThrow();
    });
  });

  describe('validateRoleAccess', () => {
    it('should allow Admin access to all data types', () => {
      const dataTypes: DataType[] = [
        'transactions',
        'accounts',
        'auditLogs',
        'users',
        'companies',
        'sessions',
      ];

      for (const dataType of dataTypes) {
        expect(RoleFilterService.validateRoleAccess('Admin', dataType)).toBe(true);
      }
    });

    it('should deny Manager access to audit logs', () => {
      expect(RoleFilterService.validateRoleAccess('Manager', 'auditLogs')).toBe(false);
      expect(RoleFilterService.validateRoleAccess('Manager', 'users')).toBe(false);
      expect(RoleFilterService.validateRoleAccess('Manager', 'sessions')).toBe(false);
    });

    it('should allow Manager access to financial data', () => {
      expect(RoleFilterService.validateRoleAccess('Manager', 'transactions')).toBe(true);
      expect(RoleFilterService.validateRoleAccess('Manager', 'accounts')).toBe(true);
      expect(RoleFilterService.validateRoleAccess('Manager', 'contacts')).toBe(true);
    });

    it('should deny Bookkeeper access to user data', () => {
      expect(RoleFilterService.validateRoleAccess('Bookkeeper', 'users')).toBe(false);
      expect(RoleFilterService.validateRoleAccess('Bookkeeper', 'companies')).toBe(false);
      expect(RoleFilterService.validateRoleAccess('Bookkeeper', 'auditLogs')).toBe(false);
    });

    it('should allow Bookkeeper access to transaction data', () => {
      expect(RoleFilterService.validateRoleAccess('Bookkeeper', 'transactions')).toBe(true);
      expect(RoleFilterService.validateRoleAccess('Bookkeeper', 'accounts')).toBe(true);
      expect(RoleFilterService.validateRoleAccess('Bookkeeper', 'products')).toBe(true);
    });

    it('should deny View-Only access to raw data', () => {
      expect(RoleFilterService.validateRoleAccess('View-Only', 'transactions')).toBe(false);
      expect(RoleFilterService.validateRoleAccess('View-Only', 'accounts')).toBe(false);
      expect(RoleFilterService.validateRoleAccess('View-Only', 'auditLogs')).toBe(false);
      expect(RoleFilterService.validateRoleAccess('View-Only', 'users')).toBe(false);
    });

    it('should allow View-Only access to reports only', () => {
      expect(RoleFilterService.validateRoleAccess('View-Only', 'reports')).toBe(true);
    });

    it('should return false for invalid role', () => {
      expect(RoleFilterService.validateRoleAccess('InvalidRole' as UserRole, 'transactions')).toBe(
        false
      );
    });

    it('should return false for invalid data type', () => {
      expect(RoleFilterService.validateRoleAccess('Admin', 'invalidDataType' as DataType)).toBe(
        false
      );
    });
  });

  describe('getRoleHierarchyLevel', () => {
    it('should return correct hierarchy levels', () => {
      expect(RoleFilterService.getRoleHierarchyLevel('Admin')).toBe(3);
      expect(RoleFilterService.getRoleHierarchyLevel('Manager')).toBe(2);
      expect(RoleFilterService.getRoleHierarchyLevel('Bookkeeper')).toBe(1);
      expect(RoleFilterService.getRoleHierarchyLevel('View-Only')).toBe(0);
    });

    it('should have ascending hierarchy', () => {
      expect(RoleFilterService.getRoleHierarchyLevel('Admin')).toBeGreaterThan(
        RoleFilterService.getRoleHierarchyLevel('Manager')
      );
      expect(RoleFilterService.getRoleHierarchyLevel('Manager')).toBeGreaterThan(
        RoleFilterService.getRoleHierarchyLevel('Bookkeeper')
      );
      expect(RoleFilterService.getRoleHierarchyLevel('Bookkeeper')).toBeGreaterThan(
        RoleFilterService.getRoleHierarchyLevel('View-Only')
      );
    });
  });

  describe('compareRoles', () => {
    it('should correctly compare Admin with other roles', () => {
      expect(RoleFilterService.compareRoles('Admin', 'Manager')).toBe(true);
      expect(RoleFilterService.compareRoles('Admin', 'Bookkeeper')).toBe(true);
      expect(RoleFilterService.compareRoles('Admin', 'View-Only')).toBe(true);
      expect(RoleFilterService.compareRoles('Admin', 'Admin')).toBe(true);
    });

    it('should correctly compare Manager with other roles', () => {
      expect(RoleFilterService.compareRoles('Manager', 'Admin')).toBe(false);
      expect(RoleFilterService.compareRoles('Manager', 'Bookkeeper')).toBe(true);
      expect(RoleFilterService.compareRoles('Manager', 'View-Only')).toBe(true);
      expect(RoleFilterService.compareRoles('Manager', 'Manager')).toBe(true);
    });

    it('should correctly compare Bookkeeper with other roles', () => {
      expect(RoleFilterService.compareRoles('Bookkeeper', 'Admin')).toBe(false);
      expect(RoleFilterService.compareRoles('Bookkeeper', 'Manager')).toBe(false);
      expect(RoleFilterService.compareRoles('Bookkeeper', 'View-Only')).toBe(true);
      expect(RoleFilterService.compareRoles('Bookkeeper', 'Bookkeeper')).toBe(true);
    });

    it('should correctly compare View-Only with other roles', () => {
      expect(RoleFilterService.compareRoles('View-Only', 'Admin')).toBe(false);
      expect(RoleFilterService.compareRoles('View-Only', 'Manager')).toBe(false);
      expect(RoleFilterService.compareRoles('View-Only', 'Bookkeeper')).toBe(false);
      expect(RoleFilterService.compareRoles('View-Only', 'View-Only')).toBe(true);
    });
  });

  describe('getRoleDescription', () => {
    it('should return description for Admin', () => {
      const description = RoleFilterService.getRoleDescription('Admin');
      expect(description).toContain('Full access');
      expect(description).toContain('audit logs');
    });

    it('should return description for Manager', () => {
      const description = RoleFilterService.getRoleDescription('Manager');
      expect(description).toContain('financial data');
      expect(description).toContain('Cannot view audit logs');
    });

    it('should return description for Bookkeeper', () => {
      const description = RoleFilterService.getRoleDescription('Bookkeeper');
      expect(description).toContain('transactions');
      expect(description).toContain('accounts');
    });

    it('should return description for View-Only', () => {
      const description = RoleFilterService.getRoleDescription('View-Only');
      expect(description).toContain('Read-only');
      expect(description).toContain('reports');
    });
  });

  describe('countFilteredRecords', () => {
    it('should count all records for Admin', () => {
      const filtered = RoleFilterService.filterDataByRole(mockFullData, 'Admin');
      const count = RoleFilterService.countFilteredRecords(filtered);

      // Total: 2 accounts + 2 transactions + 2 lineItems + 2 contacts + 2 products
      //        + 2 users + 1 company + 2 companyUsers + 2 auditLogs + 1 session + 1 device
      expect(count).toBe(19);
    });

    it('should count fewer records for Manager', () => {
      const adminFiltered = RoleFilterService.filterDataByRole(mockFullData, 'Admin');
      const managerFiltered = RoleFilterService.filterDataByRole(mockFullData, 'Manager');

      const adminCount = RoleFilterService.countFilteredRecords(adminFiltered);
      const managerCount = RoleFilterService.countFilteredRecords(managerFiltered);

      expect(managerCount).toBeLessThan(adminCount);
    });

    it('should count fewest records for View-Only', () => {
      const filtered = RoleFilterService.filterDataByRole(mockFullData, 'View-Only');
      const count = RoleFilterService.countFilteredRecords(filtered);

      // View-Only only has reports, which don't exist in mock data
      expect(count).toBe(0);
    });

    it('should handle empty filtered data', () => {
      const emptyExport: DatabaseExport = {
        version: 1,
        exportedAt: Date.now(),
        data: {
          accounts: [],
          transactions: [],
          transactionLineItems: [],
          contacts: [],
          products: [],
          users: [],
          companies: [],
          companyUsers: [],
          auditLogs: [],
          sessions: [],
          devices: [],
        },
      };

      const filtered = RoleFilterService.filterDataByRole(emptyExport, 'Admin');
      const count = RoleFilterService.countFilteredRecords(filtered);

      expect(count).toBe(0);
    });
  });

  describe('validateFilteredBackup', () => {
    it('should validate correctly filtered Admin backup', () => {
      const filtered = RoleFilterService.filterDataByRole(mockFullData, 'Admin');
      const isValid = RoleFilterService.validateFilteredBackup(filtered);

      expect(isValid).toBe(true);
    });

    it('should validate correctly filtered Manager backup', () => {
      const filtered = RoleFilterService.filterDataByRole(mockFullData, 'Manager');
      const isValid = RoleFilterService.validateFilteredBackup(filtered);

      expect(isValid).toBe(true);
    });

    it('should validate correctly filtered Bookkeeper backup', () => {
      const filtered = RoleFilterService.filterDataByRole(mockFullData, 'Bookkeeper');
      const isValid = RoleFilterService.validateFilteredBackup(filtered);

      expect(isValid).toBe(true);
    });

    it('should validate correctly filtered View-Only backup', () => {
      const filtered = RoleFilterService.filterDataByRole(mockFullData, 'View-Only');
      const isValid = RoleFilterService.validateFilteredBackup(filtered);

      expect(isValid).toBe(true);
    });

    it('should detect unauthorized data in filtered backup', () => {
      const filtered = RoleFilterService.filterDataByRole(mockFullData, 'View-Only');

      // Manually inject unauthorized data
      filtered.data.auditLogs = mockFullData.data.auditLogs;
      filtered.filterMetadata.includedDataTypes.push('auditLogs');

      const isValid = RoleFilterService.validateFilteredBackup(filtered);

      expect(isValid).toBe(false);
    });

    it('should detect metadata mismatch', () => {
      const filtered = RoleFilterService.filterDataByRole(mockFullData, 'Manager');

      // Create metadata mismatch
      filtered.filterMetadata.includedDataTypes = ['transactions'];
      // But data object still has more data types

      const isValid = RoleFilterService.validateFilteredBackup(filtered);

      expect(isValid).toBe(false);
    });
  });

  describe('IDOR Protection Tests', () => {
    it('should never allow View-Only to access transaction data', () => {
      const filtered = RoleFilterService.filterDataByRole(mockFullData, 'View-Only');

      // IDOR Test: Ensure no sensitive data leaks
      expect(filtered.data.transactions).toBeUndefined();
      expect(filtered.data.transactionLineItems).toBeUndefined();
      expect(filtered.data.accounts).toBeUndefined();
      expect(filtered.data.users).toBeUndefined();
      expect(filtered.data.auditLogs).toBeUndefined();
    });

    it('should never allow Bookkeeper to access audit logs', () => {
      const filtered = RoleFilterService.filterDataByRole(mockFullData, 'Bookkeeper');

      // IDOR Test: Audit logs should never be accessible
      expect(filtered.data.auditLogs).toBeUndefined();
      expect(filtered.filterMetadata.includedDataTypes).not.toContain('auditLogs');
    });

    it('should never allow Manager to access user credentials', () => {
      const filtered = RoleFilterService.filterDataByRole(mockFullData, 'Manager');

      // IDOR Test: User management data should be protected
      expect(filtered.data.users).toBeUndefined();
      expect(filtered.data.companyUsers).toBeUndefined();
      expect(filtered.data.sessions).toBeUndefined();
      expect(filtered.data.devices).toBeUndefined();
    });

    it('should enforce fail-closed on invalid role', () => {
      // IDOR Test: Invalid role should deny all access
      const hasAccess = RoleFilterService.validateRoleAccess(
        'HackerRole' as UserRole,
        'auditLogs'
      );

      expect(hasAccess).toBe(false);
    });

    it('should enforce consistent filtering across multiple calls', () => {
      // IDOR Test: Same role should always get same permissions
      const filtered1 = RoleFilterService.filterDataByRole(mockFullData, 'Bookkeeper');
      const filtered2 = RoleFilterService.filterDataByRole(mockFullData, 'Bookkeeper');

      expect(filtered1.filterMetadata.includedDataTypes).toEqual(
        filtered2.filterMetadata.includedDataTypes
      );
      expect(filtered1.filterMetadata.excludedDataTypes).toEqual(
        filtered2.filterMetadata.excludedDataTypes
      );
    });
  });

  describe('Performance and edge cases', () => {
    it('should handle large dataset efficiently', () => {
      // Create large mock dataset
      const largeExport: DatabaseExport = {
        version: 1,
        exportedAt: Date.now(),
        data: {
          accounts: Array(1000).fill(null).map((_, i) => ({
            id: `acc${i}`,
            name: `Account ${i}`,
          })) as any,
          transactions: Array(5000).fill(null).map((_, i) => ({
            id: `txn${i}`,
            transaction_number: `TXN-${i}`,
          })) as any,
          transactionLineItems: [],
          contacts: [],
          products: [],
          users: [],
          companies: [],
          companyUsers: [],
          auditLogs: [],
          sessions: [],
          devices: [],
        },
      };

      const startTime = Date.now();
      const filtered = RoleFilterService.filterDataByRole(largeExport, 'Manager');
      const endTime = Date.now();

      expect(filtered.data.accounts?.length).toBe(1000);
      expect(filtered.data.transactions?.length).toBe(5000);
      expect(endTime - startTime).toBeLessThan(1000); // Should be fast (<1 second)
    });

    it('should handle missing data types gracefully', () => {
      const partialExport: DatabaseExport = {
        version: 1,
        exportedAt: Date.now(),
        data: {
          accounts: [{ id: 'acc1', name: 'Cash' } as any],
          transactions: [],
          transactionLineItems: [],
          contacts: [],
          products: [],
          users: [],
          companies: [],
          companyUsers: [],
          auditLogs: [],
          sessions: [],
          devices: [],
        },
      };

      const filtered = RoleFilterService.filterDataByRole(partialExport, 'Admin');

      expect(filtered.data.accounts).toBeDefined();
      expect(filtered.data.transactions).toEqual([]);
    });
  });
});
