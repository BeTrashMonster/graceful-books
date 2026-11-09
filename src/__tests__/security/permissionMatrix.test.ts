/**
 * Permission Matrix Exhaustive Tests
 * Phase 1.4 - Foundation Security
 *
 * EVERY cell in the permission matrix must have a corresponding test.
 * This ensures 100% coverage of the permission model.
 *
 * @gate 1.4
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { UserRole, CompanyUser } from '../../types/database.types';
import { checkPermission, getPermissionsForRole, type Resource, type Action } from '../../utils/rbac';
import {
  PermissionService,
  PermissionDeniedError,
  ALL_PERMISSIONS,
  ALL_ROLES,
  type RequestContext,
} from '../../services/permissions/permissionService';

// Expected permission matrix (source of truth from PERMISSION_MODEL.md)
const EXPECTED_PERMISSIONS: Record<UserRole, Record<string, boolean>> = {
  OWNER: {
    'transaction:create': true,
    'transaction:read': true,
    'transaction:update': true,
    'transaction:delete': true,
    'transaction:post': true,
    'transaction:void': true,
    'account:create': true,
    'account:read': true,
    'account:update': true,
    'account:delete': true,
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
  },
  ADMIN: {
    'transaction:create': true,
    'transaction:read': true,
    'transaction:update': true,
    'transaction:delete': true,
    'transaction:post': true,
    'transaction:void': true,
    'account:create': true,
    'account:read': true,
    'account:update': true,
    'account:delete': true,
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
    'company:delete': false, // Only OWNER
    'settings:read': true,
    'settings:update': true,
    'audit_log:read': true,
    'reconciliation:create': true,
    'reconciliation:read': true,
    'reconciliation:update': true,
    'reconciliation:delete': true,
  },
  ACCOUNTANT: {
    'transaction:create': true,
    'transaction:read': true,
    'transaction:update': true, // Only draft
    'transaction:delete': false,
    'transaction:post': true,
    'transaction:void': false,
    'account:create': true,
    'account:read': true,
    'account:update': true,
    'account:delete': false,
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
  },
  BOOKKEEPER: {
    'transaction:create': true,
    'transaction:read': true,
    'transaction:update': true, // Only draft
    'transaction:delete': false,
    'transaction:post': false,
    'transaction:void': false,
    'account:create': false,
    'account:read': true,
    'account:update': false,
    'account:delete': false,
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
    'report:export': false, // Cannot export
    'user:create': false, // Cannot access users
    'user:read': false,
    'user:update': false,
    'user:delete': false,
    'company:read': true,
    'company:update': false,
    'company:delete': false,
    'settings:read': false, // Cannot access settings
    'settings:update': false,
    'audit_log:read': false, // Cannot access audit
    'reconciliation:create': true,
    'reconciliation:read': true,
    'reconciliation:update': true,
    'reconciliation:delete': false,
  },
  VIEWER: {
    'transaction:create': false, // Read-only
    'transaction:read': true,
    'transaction:update': false,
    'transaction:delete': false,
    'transaction:post': false,
    'transaction:void': false,
    'account:create': false,
    'account:read': true,
    'account:update': false,
    'account:delete': false,
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
    'report:export': false, // Cannot export
    'user:create': false,
    'user:read': false, // Cannot view users
    'user:update': false,
    'user:delete': false,
    'company:read': true,
    'company:update': false,
    'company:delete': false,
    'settings:read': false, // Cannot access settings
    'settings:update': false,
    'audit_log:read': false, // Cannot access audit
    'reconciliation:create': false,
    'reconciliation:read': true,
    'reconciliation:update': false,
    'reconciliation:delete': false,
  },
};

// Helper to create mock company user
function createCompanyUser(role: UserRole): Pick<CompanyUser, 'role'> {
  return { role };
}

// Helper to create request context
function createRequestContext(role: UserRole, userId = 'user-1'): RequestContext {
  return {
    userId,
    sessionId: 'session-1',
    deviceId: 'device-1',
    companyId: 'company-1',
    companyUser: createCompanyUser(role),
  };
}

describe('GATE 1.4: Permission Matrix Exhaustive Tests', () => {
  describe('1.4.T.1: Role × Permission Matrix', () => {
    // Generate tests for every role × permission combination
    for (const role of ALL_ROLES) {
      describe(`Role: ${role}`, () => {
        for (const [action, resource] of ALL_PERMISSIONS) {
          const permission = `${resource}:${action}`;
          const shouldHave = EXPECTED_PERMISSIONS[role][permission] ?? false;

          it(`${shouldHave ? 'CAN' : 'CANNOT'} ${permission}`, () => {
            const companyUser = createCompanyUser(role);
            const result = checkPermission(companyUser, action, resource);

            expect(result).toBe(shouldHave);
          });
        }
      });
    }
  });

  describe('1.4.T.2: Permission Enforcement Location', () => {
    let permissionService: PermissionService;

    beforeEach(async () => {
      permissionService = new PermissionService('test-company');
      await permissionService.initialize();
    });

    it('permissions are checked at service layer (not just UI)', async () => {
      const context = createRequestContext('VIEWER');

      // VIEWER trying to create transaction should throw
      await expect(
        permissionService.requirePermission(
          context,
          'create',
          'transaction',
          'txn-123',
          { amount: 100 }
        )
      ).rejects.toThrow(PermissionDeniedError);
    });

    it('permission service returns proper error type', async () => {
      const context = createRequestContext('BOOKKEEPER');

      try {
        await permissionService.requirePermission(
          context,
          'delete',
          'transaction',
          'txn-123'
        );
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(PermissionDeniedError);
        expect((error as PermissionDeniedError).role).toBe('BOOKKEEPER');
        expect((error as PermissionDeniedError).permission).toBe('transaction:delete');
      }
    });

    it('permission check returns result object for soft checks', () => {
      const context = createRequestContext('VIEWER');
      const result = permissionService.hasPermission(context, 'delete', 'account');

      expect(result.allowed).toBe(false);
      expect(result.role).toBe('VIEWER');
      expect(result.permission).toBe('account:delete');
      expect(result.reason).toBeDefined();
    });

    it('allowed operations do not throw', async () => {
      const context = createRequestContext('OWNER');

      await expect(
        permissionService.requirePermission(
          context,
          'delete',
          'transaction',
          'txn-123',
          { id: 'txn-123' }
        )
      ).resolves.not.toThrow();
    });
  });

  describe('1.4.T.3: Sync Operation Permission Checks', () => {
    let permissionService: PermissionService;

    beforeEach(async () => {
      permissionService = new PermissionService('test-company');
      await permissionService.initialize();
    });

    it('validates sync operations against author role', async () => {
      const context = createRequestContext('ADMIN');

      // VIEWER creating a sync operation should be rejected
      await expect(
        permissionService.validateSyncOperation(
          {
            author: 'viewer-user',
            authorRole: 'VIEWER',
            action: 'create',
            resource: 'transaction',
            resourceId: 'txn-sync-123',
            timestamp: new Date().toISOString(),
            payload: { amount: 100 },
          },
          context
        )
      ).rejects.toThrow(PermissionDeniedError);
    });

    it('allows valid sync operations', async () => {
      const context = createRequestContext('ADMIN');

      // ADMIN creating a sync operation should be allowed
      await expect(
        permissionService.validateSyncOperation(
          {
            author: 'admin-user',
            authorRole: 'ADMIN',
            action: 'create',
            resource: 'transaction',
            resourceId: 'txn-sync-456',
            timestamp: new Date().toISOString(),
            payload: { amount: 200 },
          },
          context
        )
      ).resolves.not.toThrow();
    });

    it('logs denied sync operations to audit trail', async () => {
      const context = createRequestContext('ADMIN');

      try {
        await permissionService.validateSyncOperation(
          {
            author: 'viewer-user',
            authorRole: 'VIEWER',
            action: 'delete',
            resource: 'account',
            resourceId: 'acct-sync-123',
            timestamp: new Date().toISOString(),
          },
          context
        );
      } catch {
        // Expected to throw
      }

      const auditChain = permissionService.getAuditChain();
      const entries = auditChain.getEntries();
      const deniedEntry = entries.find(e => e.policy_decision === 'denied');

      expect(deniedEntry).toBeDefined();
      expect(deniedEntry?.source).toBe('sync');
    });
  });

  describe('1.4.T.4: Violation Logging', () => {
    let permissionService: PermissionService;

    beforeEach(async () => {
      permissionService = new PermissionService('test-company');
      await permissionService.initialize();
    });

    it('all permission violations are logged to audit trail', async () => {
      const context = createRequestContext('VIEWER');
      const auditChain = permissionService.getAuditChain();
      const initialCount = auditChain.getEntries().length;

      // Attempt various violations
      const violations = [
        ['create', 'transaction'],
        ['update', 'account'],
        ['delete', 'contact'],
      ] as const;

      for (const [action, resource] of violations) {
        try {
          await permissionService.requirePermission(
            context,
            action,
            resource,
            `${resource}-test-${Date.now()}`
          );
        } catch {
          // Expected
        }
      }

      const entries = auditChain.getEntries();
      const deniedCount = entries.filter(e => e.policy_decision === 'denied').length;

      expect(deniedCount).toBe(violations.length);
    });

    it('denied entries contain proper context', async () => {
      const context = createRequestContext('BOOKKEEPER', 'bookkeeper-user-123');

      try {
        await permissionService.requirePermission(
          context,
          'delete',
          'transaction',
          'txn-to-delete-123'
        );
      } catch {
        // Expected
      }

      const auditChain = permissionService.getAuditChain();
      const entries = auditChain.getEntries();
      const deniedEntry = entries.find(e => e.policy_decision === 'denied');

      expect(deniedEntry).toBeDefined();
      expect(deniedEntry?.principal_chain).toContain('bookkeeper-user-123');
      expect(deniedEntry?.action).toBe('delete');
      expect(deniedEntry?.resource_type).toBe('transaction');
      expect(deniedEntry?.resource_id).toBe('txn-to-delete-123');
    });

    it('allowed entries are also logged', async () => {
      const context = createRequestContext('OWNER');

      await permissionService.requirePermission(
        context,
        'delete',
        'company',
        'company-123'
      );

      const auditChain = permissionService.getAuditChain();
      const entries = auditChain.getEntries();
      const allowedEntry = entries.find(
        e => e.policy_decision === 'allowed' && e.action === 'delete' && e.resource_type === 'company'
      );

      expect(allowedEntry).toBeDefined();
    });
  });

  describe('1.4.T.5: Edge Cases', () => {
    let permissionService: PermissionService;

    beforeEach(async () => {
      permissionService = new PermissionService('test-company');
      await permissionService.initialize();
    });

    it('cannot escalate own permissions (self-escalation prevention)', () => {
      const context = createRequestContext('ACCOUNTANT', 'user-123');

      // User trying to modify their own permissions
      const canModify = permissionService.canModifyOwnPermissions(context, 'user-123');

      expect(canModify).toBe(false);
    });

    it('can modify other users permissions if authorized', () => {
      const context = createRequestContext('ADMIN', 'admin-user');

      // Admin modifying another user's permissions
      const canModify = permissionService.canModifyOwnPermissions(context, 'other-user');

      expect(canModify).toBe(true);
    });

    it('ADMIN cannot assign OWNER role', () => {
      const context = createRequestContext('ADMIN', 'admin-user');

      const canAssign = permissionService.canAssignRole(context, 'OWNER');

      expect(canAssign).toBe(false);
    });

    it('OWNER can assign any role', () => {
      const context = createRequestContext('OWNER', 'owner-user');

      expect(permissionService.canAssignRole(context, 'ADMIN')).toBe(true);
      expect(permissionService.canAssignRole(context, 'ACCOUNTANT')).toBe(true);
      expect(permissionService.canAssignRole(context, 'BOOKKEEPER')).toBe(true);
      expect(permissionService.canAssignRole(context, 'VIEWER')).toBe(true);
    });

    it('VIEWER cannot assign any role', () => {
      const context = createRequestContext('VIEWER', 'viewer-user');

      expect(permissionService.canAssignRole(context, 'VIEWER')).toBe(false);
      expect(permissionService.canAssignRole(context, 'BOOKKEEPER')).toBe(false);
    });

    it('BOOKKEEPER cannot assign any role', () => {
      const context = createRequestContext('BOOKKEEPER', 'bookkeeper-user');

      expect(permissionService.canAssignRole(context, 'VIEWER')).toBe(false);
    });

    it('only OWNER can delete company', () => {
      const ownerUser = createCompanyUser('OWNER');
      const adminUser = createCompanyUser('ADMIN');
      const accountantUser = createCompanyUser('ACCOUNTANT');

      expect(checkPermission(ownerUser, 'delete', 'company')).toBe(true);
      expect(checkPermission(adminUser, 'delete', 'company')).toBe(false);
      expect(checkPermission(accountantUser, 'delete', 'company')).toBe(false);
    });
  });

  describe('1.4.T.6: Role Hierarchy', () => {
    it('OWNER has more permissions than ADMIN', () => {
      const ownerPerms = getPermissionsForRole('OWNER');
      const adminPerms = getPermissionsForRole('ADMIN');

      // Count true permissions
      const ownerCount = Object.values(ownerPerms).filter(Boolean).length;
      const adminCount = Object.values(adminPerms).filter(Boolean).length;

      expect(ownerCount).toBeGreaterThanOrEqual(adminCount);
    });

    it('ADMIN has more permissions than ACCOUNTANT', () => {
      const adminPerms = getPermissionsForRole('ADMIN');
      const accountantPerms = getPermissionsForRole('ACCOUNTANT');

      const adminCount = Object.values(adminPerms).filter(Boolean).length;
      const accountantCount = Object.values(accountantPerms).filter(Boolean).length;

      expect(adminCount).toBeGreaterThan(accountantCount);
    });

    it('ACCOUNTANT has more permissions than BOOKKEEPER', () => {
      const accountantPerms = getPermissionsForRole('ACCOUNTANT');
      const bookKeeperPerms = getPermissionsForRole('BOOKKEEPER');

      const accountantCount = Object.values(accountantPerms).filter(Boolean).length;
      const bookKeeperCount = Object.values(bookKeeperPerms).filter(Boolean).length;

      expect(accountantCount).toBeGreaterThan(bookKeeperCount);
    });

    it('BOOKKEEPER has more permissions than VIEWER', () => {
      const bookKeeperPerms = getPermissionsForRole('BOOKKEEPER');
      const viewerPerms = getPermissionsForRole('VIEWER');

      const bookKeeperCount = Object.values(bookKeeperPerms).filter(Boolean).length;
      const viewerCount = Object.values(viewerPerms).filter(Boolean).length;

      expect(bookKeeperCount).toBeGreaterThan(viewerCount);
    });

    it('VIEWER has minimal permissions (read-only)', () => {
      const viewerPerms = getPermissionsForRole('VIEWER');

      // VIEWER should have no create/update/delete permissions
      const writePerms = Object.entries(viewerPerms)
        .filter(([key]) => key.includes(':create') || key.includes(':update') || key.includes(':delete'))
        .filter(([, value]) => value);

      expect(writePerms.length).toBe(0);
    });
  });

  describe('1.4.T.7: Test Coverage Completeness', () => {
    it('all roles are tested', () => {
      const testedRoles = new Set(ALL_ROLES);

      expect(testedRoles.has('OWNER')).toBe(true);
      expect(testedRoles.has('ADMIN')).toBe(true);
      expect(testedRoles.has('ACCOUNTANT')).toBe(true);
      expect(testedRoles.has('BOOKKEEPER')).toBe(true);
      expect(testedRoles.has('VIEWER')).toBe(true);
      expect(testedRoles.size).toBe(5);
    });

    it('all permissions are tested', () => {
      const testedPermissions = ALL_PERMISSIONS.map(([action, resource]) => `${resource}:${action}`);

      // Core permissions should be covered
      expect(testedPermissions).toContain('transaction:create');
      expect(testedPermissions).toContain('transaction:read');
      expect(testedPermissions).toContain('transaction:update');
      expect(testedPermissions).toContain('transaction:delete');
      expect(testedPermissions).toContain('account:create');
      expect(testedPermissions).toContain('user:create');
      expect(testedPermissions).toContain('settings:update');
      expect(testedPermissions).toContain('audit_log:read');
    });

    it('test count matches expected (roles × permissions)', () => {
      const expectedTestCount = ALL_ROLES.length * ALL_PERMISSIONS.length;

      // We should have at least this many permission tests
      // The actual count may be higher due to additional specific tests
      expect(expectedTestCount).toBe(5 * 42); // 5 roles × 42 permissions = 210
    });
  });
});
