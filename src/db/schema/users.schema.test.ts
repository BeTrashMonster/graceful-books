/**
 * Tests for Users Schema
 *
 * Tests schema validation, helper functions, and default value generation
 * for the H1 Multi-User implementation.
 */

import { describe, it, expect } from 'vitest';
import {
  createDefaultUser,
  createDefaultCompany,
  createDefaultCompanyUser,
  createDefaultSession,
  createDefaultDevice,
  getDefaultPermissionsForRole,
  validateUser,
  validateCompany,
  isSessionExpired,
  shouldRenewSession,
  getUserRoleDisplay,
  hasPermission,
  hasHigherOrEqualRole,
  generateDeviceFingerprint,
} from './users.schema';
import { UserRole } from '../../types/database.types';
import type { Session, CompanyUser } from '../../types/database.types';

describe('Users Schema', () => {
  describe('createDefaultUser', () => {
    it('should create user with correct defaults', () => {
      const email = 'test@example.com';
      const name = 'Test User';
      const passphraseHash = 'hash123';
      const masterKeyEncrypted = 'encrypted-key';
      const deviceId = 'device-1';

      const user = createDefaultUser(email, name, passphraseHash, masterKeyEncrypted, deviceId);

      expect(user.email).toBe(email);
      expect(user.name).toBe(name);
      expect(user.passphrase_hash).toBe(passphraseHash);
      expect(user.master_key_encrypted).toBe(masterKeyEncrypted);
      expect(user.preferences).toBeDefined();
      expect(user.preferences?.language).toBe('en');
      expect(user.created_at).toBeTypeOf('number');
      expect(user.updated_at).toBeTypeOf('number');
      expect(user.deleted_at).toBeNull();
      expect(user.version_vector).toBeDefined();
      expect(user.version_vector?.[deviceId]).toBe(1);
    });

    it('should create valid user preferences', () => {
      const user = createDefaultUser('test@example.com', 'Test', 'hash', 'key', 'device-1');

      expect(user.preferences).toEqual({
        language: 'en',
        timezone: expect.any(String),
        date_format: 'MM/DD/YYYY',
        currency_display: '$1,000.00',
        theme: 'auto',
        reduced_motion: false,
        high_contrast: false,
      });
    });

    it('should use current timezone from Intl API', () => {
      const user = createDefaultUser('test@example.com', 'Test', 'hash', 'key', 'device-1');
      const expectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      expect(user.preferences?.timezone).toBe(expectedTimezone);
    });

    it('should set timestamps to current time', () => {
      const before = Date.now();
      const user = createDefaultUser('test@example.com', 'Test', 'hash', 'key', 'device-1');
      const after = Date.now();

      expect(user.created_at).toBeGreaterThanOrEqual(before);
      expect(user.created_at).toBeLessThanOrEqual(after);
      expect(user.updated_at).toBeGreaterThanOrEqual(before);
      expect(user.updated_at).toBeLessThanOrEqual(after);
    });
  });

  describe('createDefaultCompany', () => {
    it('should create company with correct defaults', () => {
      const name = 'Test Company';
      const currency = 'USD';
      const deviceId = 'device-1';

      const company = createDefaultCompany(name, currency, deviceId);

      expect(company.name).toBe(name);
      expect(company.currency).toBe(currency);
      expect(company.fiscal_year_end).toBe('12-31');
      expect(company.settings).toBeDefined();
      expect(company.settings?.accounting_method).toBe('accrual');
      expect(company.settings?.multi_currency).toBe(false);
      expect(company.settings?.track_inventory).toBe(false);
      expect(company.settings?.auto_backup).toBe(true);
      expect(company.settings?.retention_period_days).toBe(2555);
    });

    it('should set null for optional fields', () => {
      const company = createDefaultCompany('Test', 'USD', 'device-1');

      expect(company.legal_name).toBeNull();
      expect(company.tax_id).toBeNull();
      expect(company.address).toBeNull();
      expect(company.phone).toBeNull();
      expect(company.email).toBeNull();
    });

    it('should initialize version vector with device ID', () => {
      const deviceId = 'device-123';
      const company = createDefaultCompany('Test', 'USD', deviceId);

      expect(company.version_vector).toBeDefined();
      expect(company.version_vector?.[deviceId]).toBe(1);
    });

    it('should set created_at and updated_at timestamps', () => {
      const before = Date.now();
      const company = createDefaultCompany('Test', 'USD', 'device-1');
      const after = Date.now();

      expect(company.created_at).toBeGreaterThanOrEqual(before);
      expect(company.created_at).toBeLessThanOrEqual(after);
      expect(company.updated_at).toBe(company.created_at);
    });
  });

  describe('createDefaultCompanyUser', () => {
    it('should create company user with correct role', () => {
      const companyId = 'company-1';
      const userId = 'user-1';
      const role: UserRole = UserRole.ADMIN;
      const deviceId = 'device-1';

      const companyUser = createDefaultCompanyUser(companyId, userId, role, deviceId);

      expect(companyUser.company_id).toBe(companyId);
      expect(companyUser.user_id).toBe(userId);
      expect(companyUser.role).toBe(role);
      expect(companyUser.active).toBe(true);
      expect(companyUser.permissions).toBeDefined();
      expect(Array.isArray(companyUser.permissions)).toBe(true);
    });

    it('should set permissions based on role', () => {
      const owner = createDefaultCompanyUser('c1', 'u1', 'OWNER' as any, 'd1');
      const admin = createDefaultCompanyUser('c1', 'u1', 'ADMIN' as any, 'd1');
      const viewer = createDefaultCompanyUser('c1', 'u1', 'VIEWER' as any, 'd1');

      expect(owner.permissions?.length).toBeGreaterThan(admin.permissions?.length || 0);
      expect(admin.permissions?.length).toBeGreaterThan(viewer.permissions?.length || 0);
    });

    it('should initialize version vector', () => {
      const deviceId = 'device-xyz';
      const companyUser = createDefaultCompanyUser('c1', 'u1', 'BOOKKEEPER' as any, deviceId);

      expect(companyUser.version_vector).toBeDefined();
      expect(companyUser.version_vector?.[deviceId]).toBe(1);
    });
  });

  describe('createDefaultSession', () => {
    it('should create session with default expiration', () => {
      const userId = 'user-1';
      const token = 'token-123';
      const deviceId = 'device-1';

      const session = createDefaultSession(userId, token, deviceId);

      expect(session.user_id).toBe(userId);
      expect(session.token).toBe(token);
      expect(session.device_id).toBe(deviceId);
      expect(session.company_id).toBeNull();
      expect(session.remember_device).toBe(false);
    });

    it('should set expiration 24 hours by default', () => {
      const now = Date.now();
      const session = createDefaultSession('u1', 't1', 'd1');
      const expectedExpiry = now + 24 * 60 * 60 * 1000;

      expect(session.expires_at).toBeGreaterThanOrEqual(expectedExpiry - 100);
      expect(session.expires_at).toBeLessThanOrEqual(expectedExpiry + 100);
    });

    it('should accept custom expiration time', () => {
      const customExpiry = 2 * 60 * 60 * 1000; // 2 hours
      const now = Date.now();
      const session = createDefaultSession('u1', 't1', 'd1', customExpiry);
      const expectedExpiry = now + customExpiry;

      expect(session.expires_at).toBeGreaterThanOrEqual(expectedExpiry - 100);
      expect(session.expires_at).toBeLessThanOrEqual(expectedExpiry + 100);
    });

    it('should set remember_device flag', () => {
      const session1 = createDefaultSession('u1', 't1', 'd1', undefined, false);
      const session2 = createDefaultSession('u1', 't1', 'd1', undefined, true);

      expect(session1.remember_device).toBe(false);
      expect(session2.remember_device).toBe(true);
    });

    it('should set user_agent from navigator if available', () => {
      const session = createDefaultSession('u1', 't1', 'd1');

      if (typeof navigator !== 'undefined') {
        expect(session.user_agent).toBe(navigator.userAgent);
      } else {
        expect(session.user_agent).toBeNull();
      }
    });

    it('should set last_activity_at to creation time', () => {
      const session = createDefaultSession('u1', 't1', 'd1');

      expect(session.last_activity_at).toBe(session.created_at);
    });
  });

  describe('createDefaultDevice', () => {
    it('should create device with correct properties', () => {
      const userId = 'user-1';
      const deviceId = 'device-1';
      const deviceName = 'My Laptop';
      const deviceType = 'browser';

      const device = createDefaultDevice(userId, deviceId, deviceName, deviceType);

      expect(device.user_id).toBe(userId);
      expect(device.device_id).toBe(deviceId);
      expect(device.device_name).toBe(deviceName);
      expect(device.device_type).toBe(deviceType);
      expect(device.trusted).toBe(false);
      expect(device.last_sync_at).toBeNull();
      expect(device.sync_vector).toEqual({});
    });

    it('should support all device types', () => {
      const browser = createDefaultDevice('u1', 'd1', 'Browser', 'browser');
      const desktop = createDefaultDevice('u1', 'd2', 'Desktop', 'desktop');
      const mobile = createDefaultDevice('u1', 'd3', 'Mobile', 'mobile');

      expect(browser.device_type).toBe('browser');
      expect(desktop.device_type).toBe('desktop');
      expect(mobile.device_type).toBe('mobile');
    });

    it('should initialize empty sync vector', () => {
      const device = createDefaultDevice('u1', 'd1', 'Test', 'browser');

      expect(device.sync_vector).toEqual({});
    });
  });

  describe('getDefaultPermissionsForRole', () => {
    it('should return permissions for OWNER role', () => {
      const permissions = getDefaultPermissionsForRole('OWNER' as any);

      expect(permissions).toContain('company.delete');
      expect(permissions).toContain('users.delete');
      expect(permissions).toContain('accounts.delete');
      expect(permissions.length).toBeGreaterThan(15);
    });

    it('should return permissions for ADMIN role', () => {
      const permissions = getDefaultPermissionsForRole('ADMIN' as any);

      expect(permissions).toContain('users.create');
      expect(permissions).toContain('accounts.delete');
      expect(permissions).not.toContain('company.delete');
      expect(permissions).not.toContain('users.delete');
    });

    it('should return permissions for ACCOUNTANT role', () => {
      const permissions = getDefaultPermissionsForRole('ACCOUNTANT' as any);

      expect(permissions).toContain('reports.read');
      expect(permissions).toContain('reports.export');
      expect(permissions).toContain('transactions.read');
      expect(permissions).not.toContain('users.create');
      expect(permissions).not.toContain('accounts.delete');
    });

    it('should return permissions for BOOKKEEPER role', () => {
      const permissions = getDefaultPermissionsForRole('BOOKKEEPER' as any);

      expect(permissions).toContain('transactions.create');
      expect(permissions).toContain('transactions.update');
      expect(permissions).toContain('contacts.create');
      expect(permissions).not.toContain('reports.export');
      expect(permissions).not.toContain('accounts.delete');
    });

    it('should return permissions for VIEWER role', () => {
      const permissions = getDefaultPermissionsForRole('VIEWER' as any);

      expect(permissions).toContain('accounts.read');
      expect(permissions).toContain('transactions.read');
      expect(permissions).toContain('reports.read');
      expect(permissions).not.toContain('transactions.create');
      expect(permissions).not.toContain('accounts.update');
      expect(permissions.length).toBe(5);
    });

    it('should return empty array for unknown role', () => {
      const permissions = getDefaultPermissionsForRole('UNKNOWN' as UserRole);

      expect(permissions).toEqual([]);
    });

    it('should maintain permission hierarchy', () => {
      const owner = getDefaultPermissionsForRole('OWNER' as any);
      const admin = getDefaultPermissionsForRole('ADMIN' as any);
      const accountant = getDefaultPermissionsForRole('ACCOUNTANT' as any);
      const bookkeeper = getDefaultPermissionsForRole('BOOKKEEPER' as any);
      const viewer = getDefaultPermissionsForRole('VIEWER' as any);

      expect(owner.length).toBeGreaterThan(admin.length);
      expect(admin.length).toBeGreaterThan(accountant.length);
      expect(bookkeeper.length).toBeGreaterThan(viewer.length);
    });
  });

  describe('validateUser', () => {
    it('should validate complete user', () => {
      const user = {
        email: 'test@example.com',
        name: 'Test User',
        passphrase_hash: 'hash123',
        master_key_encrypted: 'encrypted-key',
      };

      const errors = validateUser(user);

      expect(errors).toEqual([]);
    });

    it('should require email', () => {
      const user = {
        email: '',
        name: 'Test',
        passphrase_hash: 'hash',
        master_key_encrypted: 'key',
      };

      const errors = validateUser(user);

      expect(errors).toContain('email is required');
    });

    it('should validate email format', () => {
      const user = {
        email: 'invalid-email',
        name: 'Test',
        passphrase_hash: 'hash',
        master_key_encrypted: 'key',
      };

      const errors = validateUser(user);

      expect(errors).toContain('email format is invalid');
    });

    it('should accept valid email formats', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org',
      ];

      validEmails.forEach((email: any) => {
        const user = {
          email,
          name: 'Test',
          passphrase_hash: 'hash',
          master_key_encrypted: 'key',
        };
        const errors = validateUser(user);
        expect(errors).not.toContain('email format is invalid');
      });
    });

    it('should require name', () => {
      const user = {
        email: 'test@example.com',
        name: '',
        passphrase_hash: 'hash',
        master_key_encrypted: 'key',
      };

      const errors = validateUser(user);

      expect(errors).toContain('name is required');
    });

    it('should require passphrase_hash', () => {
      const user = {
        email: 'test@example.com',
        name: 'Test',
        master_key_encrypted: 'key',
      };

      const errors = validateUser(user);

      expect(errors).toContain('passphrase_hash is required');
    });

    it('should require master_key_encrypted', () => {
      const user = {
        email: 'test@example.com',
        name: 'Test',
        passphrase_hash: 'hash',
      };

      const errors = validateUser(user);

      expect(errors).toContain('master_key_encrypted is required');
    });

    it('should return multiple errors', () => {
      const user = {
        email: '',
        name: '',
      };

      const errors = validateUser(user);

      expect(errors.length).toBeGreaterThan(1);
      expect(errors).toContain('email is required');
      expect(errors).toContain('name is required');
    });
  });

  describe('validateCompany', () => {
    it('should validate complete company', () => {
      const company = {
        name: 'Test Company',
        currency: 'USD',
      };

      const errors = validateCompany(company);

      expect(errors).toEqual([]);
    });

    it('should require name', () => {
      const company = {
        name: '',
        currency: 'USD',
      };

      const errors = validateCompany(company);

      expect(errors).toContain('name is required');
    });

    it('should require currency', () => {
      const company = {
        name: 'Test',
        currency: '',
      };

      const errors = validateCompany(company);

      expect(errors).toContain('currency is required');
    });

    it('should validate currency code length', () => {
      const company1 = {
        name: 'Test',
        currency: 'US',
      };
      const company2 = {
        name: 'Test',
        currency: 'USDD',
      };

      const errors1 = validateCompany(company1);
      const errors2 = validateCompany(company2);

      expect(errors1).toContain('currency must be a 3-letter ISO 4217 code');
      expect(errors2).toContain('currency must be a 3-letter ISO 4217 code');
    });

    it('should accept valid 3-letter currency codes', () => {
      const validCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'CAD'];

      validCurrencies.forEach((currency: any) => {
        const company = { name: 'Test', currency };
        const errors = validateCompany(company);
        expect(errors).toEqual([]);
      });
    });
  });

  describe('isSessionExpired', () => {
    it('should return false for valid session', () => {
      const session: Session = {
        id: 's1',
        user_id: 'u1',
        company_id: null,
        token: 't1',
        device_id: 'd1',
        device_name: null,
        ip_address: null,
        user_agent: null,
        expires_at: Date.now() + 60000, // 1 minute from now
        last_activity_at: Date.now(),
        remember_device: false,
        created_at: Date.now(),
        updated_at: Date.now(),
        deleted_at: null,
        version_vector: { d1: 1 },
      };

      expect(isSessionExpired(session)).toBe(false);
    });

    it('should return true for expired session', () => {
      const session: Session = {
        id: 's1',
        user_id: 'u1',
        company_id: null,
        token: 't1',
        device_id: 'd1',
        device_name: null,
        ip_address: null,
        user_agent: null,
        expires_at: Date.now() - 60000, // 1 minute ago
        last_activity_at: Date.now(),
        remember_device: false,
        created_at: Date.now(),
        updated_at: Date.now(),
        deleted_at: null,
        version_vector: { d1: 1 },
      };

      expect(isSessionExpired(session)).toBe(true);
    });

    it('should return true for session expiring right now', () => {
      const session: Session = {
        id: 's1',
        user_id: 'u1',
        company_id: null,
        token: 't1',
        device_id: 'd1',
        device_name: null,
        ip_address: null,
        user_agent: null,
        expires_at: Date.now(),
        last_activity_at: Date.now(),
        remember_device: false,
        created_at: Date.now(),
        updated_at: Date.now(),
        deleted_at: null,
        version_vector: { d1: 1 },
      };

      expect(isSessionExpired(session)).toBe(true);
    });
  });

  describe('shouldRenewSession', () => {
    it('should return false when more than 25% time remaining', () => {
      const createdAt = Date.now() - 30 * 60 * 1000; // 30 minutes ago
      const expiresAt = Date.now() + 90 * 60 * 1000; // 90 minutes from now
      // Total duration: 120 minutes, remaining: 90 minutes (75%)

      const session: Session = {
        id: 's1',
        user_id: 'u1',
        company_id: null,
        token: 't1',
        device_id: 'd1',
        device_name: null,
        ip_address: null,
        user_agent: null,
        expires_at: expiresAt,
        last_activity_at: Date.now(),
        remember_device: false,
        created_at: createdAt,
        updated_at: Date.now(),
        deleted_at: null,
        version_vector: { d1: 1 },
      };

      expect(shouldRenewSession(session)).toBe(false);
    });

    it('should return true when less than 25% time remaining', () => {
      const createdAt = Date.now() - 100 * 60 * 1000; // 100 minutes ago
      const expiresAt = Date.now() + 20 * 60 * 1000; // 20 minutes from now
      // Total duration: 120 minutes, remaining: 20 minutes (16.7%)

      const session: Session = {
        id: 's1',
        user_id: 'u1',
        company_id: null,
        token: 't1',
        device_id: 'd1',
        device_name: null,
        ip_address: null,
        user_agent: null,
        expires_at: expiresAt,
        last_activity_at: Date.now(),
        remember_device: false,
        created_at: createdAt,
        updated_at: Date.now(),
        deleted_at: null,
        version_vector: { d1: 1 },
      };

      expect(shouldRenewSession(session)).toBe(true);
    });

    it('should return false at exactly 25% remaining', () => {
      const createdAt = Date.now() - 90 * 60 * 1000; // 90 minutes ago
      const expiresAt = Date.now() + 30 * 60 * 1000; // 30 minutes from now
      // Total duration: 120 minutes, remaining: 30 minutes (exactly 25%)

      const session: Session = {
        id: 's1',
        user_id: 'u1',
        company_id: null,
        token: 't1',
        device_id: 'd1',
        device_name: null,
        ip_address: null,
        user_agent: null,
        expires_at: expiresAt,
        last_activity_at: Date.now(),
        remember_device: false,
        created_at: createdAt,
        updated_at: Date.now(),
        deleted_at: null,
        version_vector: { d1: 1 },
      };

      // At exactly 25%, should not renew (uses < not <=)
      expect(shouldRenewSession(session)).toBe(false);
    });
  });

  describe('getUserRoleDisplay', () => {
    it('should return display names for all roles', () => {
      expect(getUserRoleDisplay('OWNER' as any)).toBe('Owner');
      expect(getUserRoleDisplay('ADMIN' as any)).toBe('Administrator');
      expect(getUserRoleDisplay('ACCOUNTANT' as any)).toBe('Accountant');
      expect(getUserRoleDisplay('BOOKKEEPER' as any)).toBe('Bookkeeper');
      expect(getUserRoleDisplay('VIEWER' as any)).toBe('Viewer');
    });
  });

  describe('hasPermission', () => {
    it('should return true when user has permission', () => {
      const companyUser: CompanyUser = {
        id: 'cu1',
        company_id: 'c1',
        user_id: 'u1',
        role: 'ADMIN' as any,
        permissions: ['accounts.read', 'accounts.update', 'transactions.create'],
        active: true,
        created_at: Date.now(),
        updated_at: Date.now(),
        deleted_at: null,
        version_vector: { d1: 1 },
      };

      expect(hasPermission(companyUser, 'accounts.read')).toBe(true);
      expect(hasPermission(companyUser, 'transactions.create')).toBe(true);
    });

    it('should return false when user lacks permission', () => {
      const companyUser: CompanyUser = {
        id: 'cu1',
        company_id: 'c1',
        user_id: 'u1',
        role: 'VIEWER' as any,
        permissions: ['accounts.read', 'transactions.read'],
        active: true,
        created_at: Date.now(),
        updated_at: Date.now(),
        deleted_at: null,
        version_vector: { d1: 1 },
      };

      expect(hasPermission(companyUser, 'accounts.delete')).toBe(false);
      expect(hasPermission(companyUser, 'transactions.create')).toBe(false);
    });
  });

  describe('hasHigherOrEqualRole', () => {
    it('should return true for same role', () => {
      expect(hasHigherOrEqualRole('ADMIN' as any, 'ADMIN' as any)).toBe(true);
      expect(hasHigherOrEqualRole('VIEWER' as any, 'VIEWER' as any)).toBe(true);
    });

    it('should return true for higher role', () => {
      expect(hasHigherOrEqualRole('OWNER' as any, 'ADMIN' as any)).toBe(true);
      expect(hasHigherOrEqualRole('ADMIN' as any, 'ACCOUNTANT' as any)).toBe(true);
      expect(hasHigherOrEqualRole('ACCOUNTANT' as any, 'BOOKKEEPER' as any)).toBe(true);
      expect(hasHigherOrEqualRole('BOOKKEEPER' as any, 'VIEWER' as any)).toBe(true);
    });

    it('should return false for lower role', () => {
      expect(hasHigherOrEqualRole('ADMIN' as any, 'OWNER' as any)).toBe(false);
      expect(hasHigherOrEqualRole('ACCOUNTANT' as any, 'ADMIN' as any)).toBe(false);
      expect(hasHigherOrEqualRole('BOOKKEEPER' as any, 'ACCOUNTANT' as any)).toBe(false);
      expect(hasHigherOrEqualRole('VIEWER' as any, 'BOOKKEEPER' as any)).toBe(false);
    });

    it('should handle complete hierarchy', () => {
      const roles: UserRole[] = [UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.BOOKKEEPER, UserRole.VIEWER];

      for (let i = 0; i < roles.length; i++) {
        for (let j = 0; j < roles.length; j++) {
          const result = hasHigherOrEqualRole(roles[i]!, roles[j]!);
          expect(result).toBe(i <= j);
        }
      }
    });
  });

  describe('generateDeviceFingerprint', () => {
    it('should return null in non-browser environment', () => {
      // In Node/test environment, window is not defined
      if (typeof window === 'undefined') {
        const fingerprint = generateDeviceFingerprint();
        expect(fingerprint).toBeNull();
      }
    });

    it('should generate fingerprint in browser environment', () => {
      if (typeof window !== 'undefined') {
        const fingerprint = generateDeviceFingerprint();

        expect(fingerprint).toBeDefined();
        expect(fingerprint?.user_agent).toBeDefined();
        expect(fingerprint?.screen_resolution).toMatch(/\d+x\d+/);
        expect(fingerprint?.timezone).toBeDefined();
        expect(fingerprint?.language).toBeDefined();
        expect(fingerprint?.platform).toBeDefined();
      }
    });
  });
});
