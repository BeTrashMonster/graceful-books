/**
 * Tests for Users Data Access Layer
 *
 * Tests CRUD operations, encryption integration, CRDT version vectors,
 * and soft delete functionality for the H1 Multi-User implementation.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { UserProfile, UserRole, BusinessPhase } from '../types';
import type { EncryptionContext, DatabaseResult } from './types';

// Mock nanoid
vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => 'test-id-' + Math.random().toString(36).substring(7)),
}));

// Mock database - must be defined in factory
vi.mock('./database', () => ({
  db: {
    users: {
      add: vi.fn(),
      get: vi.fn(),
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          and: vi.fn(() => ({
            first: vi.fn(),
            toArray: vi.fn(),
            count: vi.fn(),
          })),
          first: vi.fn(),
          toArray: vi.fn(),
        })),
        toArray: vi.fn(),
      })),
      put: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Import after mocks are set up
const { db } = await import('./database');
const {
  createUser,
  getUser,
  getUserByEmail,
  updateUser,
  updateUserPassword,
  updateLastLogin,
  deleteUser,
  getCompanyUsers,
} = await import('./users');

describe('Users Data Access Layer', () => {
  let mockEncryptionService: {
    encrypt: ReturnType<typeof vi.fn>;
    decrypt: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn(() => 'test-device-id'),
      setItem: vi.fn(),
    };
    Object.defineProperty(global, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });

    // Create mock encryption service
    mockEncryptionService = {
      encrypt: vi.fn((data: string) => Promise.resolve(`encrypted-${data}`)),
      decrypt: vi.fn((data: string) => Promise.resolve(data.replace('encrypted-', ''))),
    };
  });

  describe('createUser', () => {
    it('should create user with encrypted fields', async () => {
      const userData: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'> & {
        passwordHash?: string;
        salt?: string;
        encryptedMasterKey?: string;
      } = {
        companyId: 'company-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin' as UserRole,
        phase: 'organize' as BusinessPhase,
        passwordHash: 'hash123',
        salt: 'salt123',
        encryptedMasterKey: 'encrypted-key',
      };

      db.users.where.mockReturnValue({
        equals: vi.fn(() => ({
          and: vi.fn(() => ({
            first: vi.fn(() => Promise.resolve(null)),
          })),
        })),
      });

      db.users.add.mockResolvedValue('user-id');

      const context: EncryptionContext = {
        companyId: 'company-1',
        userId: 'user-1',
        encryptionService: mockEncryptionService,
      };

      const result = await createUser(userData, context);

      expect(result.success).toBe(true);
      // createUser returns encrypted data when encryption context is provided
      expect(result.data?.email).toBe('encrypted-test@example.com');
      expect(result.data?.name).toBe('encrypted-Test User');
      expect(mockEncryptionService.encrypt).toHaveBeenCalledWith('test@example.com');
      expect(mockEncryptionService.encrypt).toHaveBeenCalledWith('Test User');
      expect(db.users.add).toHaveBeenCalled();
    });

    it('should validate email format', async () => {
      const userData: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'> = {
        companyId: 'company-1',
        email: 'invalid-email',
        name: 'Test User',
        role: 'admin' as UserRole,
        phase: 'organize' as BusinessPhase,
      };

      const result = await createUser(userData);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
      expect(result.error?.message).toContain('email');
    });

    it('should reject duplicate email in same company', async () => {
      const userData: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'> = {
        companyId: 'company-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin' as UserRole,
        phase: 'organize' as BusinessPhase,
      };

      db.users.where.mockReturnValue({
        equals: vi.fn(() => ({
          and: vi.fn(() => ({
            first: vi.fn(() => Promise.resolve({ id: 'existing-user' })),
          })),
        })),
      });

      const result = await createUser(userData);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CONSTRAINT_VIOLATION');
      expect(result.error?.message).toContain('Email already exists');
    });

    it('should initialize version vector with device ID', async () => {
      const userData: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'> = {
        companyId: 'company-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin' as UserRole,
        phase: 'organize' as BusinessPhase,
      };

      db.users.where.mockReturnValue({
        equals: vi.fn(() => ({
          and: vi.fn(() => ({
            first: vi.fn(() => Promise.resolve(null)),
          })),
        })),
      });

      let savedEntity: any;
      db.users.add.mockImplementation((entity: any) => {
        savedEntity = entity;
        return Promise.resolve('user-id');
      });

      await createUser(userData);

      expect(savedEntity.versionVector).toBeDefined();
      expect(savedEntity.versionVector['test-device-id']).toBe(1);
    });

    it('should work without encryption context', async () => {
      const userData: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'> = {
        companyId: 'company-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin' as UserRole,
        phase: 'organize' as BusinessPhase,
      };

      db.users.where.mockReturnValue({
        equals: vi.fn(() => ({
          and: vi.fn(() => ({
            first: vi.fn(() => Promise.resolve(null)),
          })),
        })),
      });

      db.users.add.mockResolvedValue('user-id');

      const result = await createUser(userData);

      expect(result.success).toBe(true);
      expect(mockEncryptionService.encrypt).not.toHaveBeenCalled();
    });

    it('should set timestamps correctly', async () => {
      const userData: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'> = {
        companyId: 'company-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin' as UserRole,
        phase: 'organize' as BusinessPhase,
      };

      db.users.where.mockReturnValue({
        equals: vi.fn(() => ({
          and: vi.fn(() => ({
            first: vi.fn(() => Promise.resolve(null)),
          })),
        })),
      });

      let savedEntity: any;
      db.users.add.mockImplementation((entity: any) => {
        savedEntity = entity;
        return Promise.resolve('user-id');
      });

      const before = new Date();
      await createUser(userData);
      const after = new Date();

      expect(savedEntity.createdAt).toBeInstanceOf(Date);
      expect(savedEntity.updatedAt).toBeInstanceOf(Date);
      expect(savedEntity.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(savedEntity.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('getUser', () => {
    it('should get user by ID', async () => {
      const mockUser = {
        id: 'user-1',
        companyId: 'company-1',
        email: 'encrypted-test@example.com',
        name: 'encrypted-Test User',
        role: 'admin',
        phase: 'organize',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: undefined,
        versionVector: { 'device-1': 1 },
        lastModifiedBy: 'device-1',
        lastModifiedAt: new Date(),
        _encrypted: { email: true, name: true },
      };

      db.users.get.mockResolvedValue(mockUser);

      const context: EncryptionContext = {
        companyId: 'company-1',
        userId: 'user-1',
        encryptionService: mockEncryptionService,
      };

      const result = await getUser('user-1', context);

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('user-1');
      expect(result.data?.email).toBe('test@example.com');
      expect(result.data?.name).toBe('Test User');
      expect(mockEncryptionService.decrypt).toHaveBeenCalledWith('encrypted-test@example.com');
      expect(mockEncryptionService.decrypt).toHaveBeenCalledWith('encrypted-Test User');
    });

    it('should return error for non-existent user', async () => {
      db.users.get.mockResolvedValue(null);

      const result = await getUser('non-existent-id');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('should return error for soft-deleted user', async () => {
      const deletedUser = {
        id: 'user-1',
        deletedAt: new Date(),
      };

      db.users.get.mockResolvedValue(deletedUser);

      const result = await getUser('user-1');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
      expect(result.error?.message).toContain('deleted');
    });

    it('should work without encryption context', async () => {
      const mockUser = {
        id: 'user-1',
        companyId: 'company-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin',
        phase: 'organize',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: undefined,
        versionVector: { 'device-1': 1 },
        lastModifiedBy: 'device-1',
        lastModifiedAt: new Date(),
        _encrypted: { email: true, name: true },
      };

      db.users.get.mockResolvedValue(mockUser);

      const result = await getUser('user-1');

      expect(result.success).toBe(true);
      expect(mockEncryptionService.decrypt).not.toHaveBeenCalled();
    });
  });

  describe('getUserByEmail', () => {
    it('should find user by email', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          companyId: 'company-1',
          email: 'encrypted-test@example.com',
          name: 'encrypted-Test User',
          role: 'admin',
          phase: 'organize',
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: undefined,
          passwordHash: 'hash',
          salt: 'salt',
          encryptedMasterKey: 'key',
          versionVector: { 'device-1': 1 },
          lastModifiedBy: 'device-1',
          lastModifiedAt: new Date(),
          _encrypted: { email: true, name: true },
        },
      ];

      db.users.where.mockReturnValue({
        equals: vi.fn(() => ({
          and: vi.fn(() => ({
            toArray: vi.fn(() => Promise.resolve(mockUsers)),
          })),
        })),
      });

      const context: EncryptionContext = {
        companyId: 'company-1',
        userId: 'user-1',
        encryptionService: mockEncryptionService,
      };

      const result = await getUserByEmail('company-1', 'test@example.com', context);

      expect(result.success).toBe(true);
      expect(result.data?.email).toBe('test@example.com');
      expect(result.data?.passwordHash).toBe('hash');
      expect(result.data?.salt).toBe('salt');
    });

    it('should return error when email not found', async () => {
      db.users.where.mockReturnValue({
        equals: vi.fn(() => ({
          and: vi.fn(() => ({
            toArray: vi.fn(() => Promise.resolve([])),
          })),
        })),
      });

      const context: EncryptionContext = {
        companyId: 'company-1',
        userId: 'user-1',
        encryptionService: mockEncryptionService,
      };

      const result = await getUserByEmail('company-1', 'notfound@example.com', context);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('should filter out deleted users', async () => {
      db.users.where.mockReturnValue({
        equals: vi.fn(() => ({
          and: vi.fn((filterFn: any) => {
            const users = [
              { id: 'user-1', deletedAt: undefined },
              { id: 'user-2', deletedAt: new Date() },
            ];
            const filtered = users.filter(filterFn);
            return {
              toArray: vi.fn(() => Promise.resolve(filtered)),
            };
          }),
        })),
      });

      const result = await getUserByEmail('company-1', 'test@example.com');

      expect(db.users.where).toHaveBeenCalledWith('companyId');
    });
  });

  describe('updateUser', () => {
    it('should update user fields', async () => {
      const existingUser = {
        id: 'user-1',
        companyId: 'company-1',
        email: 'old@example.com',
        name: 'Old Name',
        role: 'admin',
        phase: 'organize',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        deletedAt: undefined,
        versionVector: { 'device-1': 1 },
        lastModifiedBy: 'device-1',
        lastModifiedAt: new Date('2024-01-01'),
        _encrypted: { email: true, name: true },
      };

      db.users.get.mockResolvedValue(existingUser);
      db.users.put.mockResolvedValue('user-1');

      const updates = {
        name: 'New Name',
        phase: 'build' as BusinessPhase,
      };

      const result = await updateUser('user-1', updates);

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('New Name');
      expect(result.data?.phase).toBe('build');
      expect(db.users.put).toHaveBeenCalled();
    });

    it('should increment version vector', async () => {
      const existingUser = {
        id: 'user-1',
        companyId: 'company-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin',
        phase: 'organize',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: undefined,
        versionVector: { 'device-1': 2, 'device-2': 1 },
        lastModifiedBy: 'device-1',
        lastModifiedAt: new Date(),
        _encrypted: { email: true, name: true },
      };

      db.users.get.mockResolvedValue(existingUser);

      let updatedEntity: any;
      db.users.put.mockImplementation((entity: any) => {
        updatedEntity = entity;
        return Promise.resolve('user-1');
      });

      await updateUser('user-1', { name: 'Updated' });

      expect(updatedEntity.versionVector['test-device-id']).toBe(1);
      expect(updatedEntity.versionVector['device-1']).toBe(2);
    });

    it('should preserve immutable fields', async () => {
      const existingUser = {
        id: 'user-1',
        companyId: 'company-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin',
        phase: 'organize',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        deletedAt: undefined,
        versionVector: { 'device-1': 1 },
        lastModifiedBy: 'device-1',
        lastModifiedAt: new Date(),
        _encrypted: { email: true, name: true },
      };

      db.users.get.mockResolvedValue(existingUser);

      let updatedEntity: any;
      db.users.put.mockImplementation((entity: any) => {
        updatedEntity = entity;
        return Promise.resolve('user-1');
      });

      await updateUser('user-1', { name: 'Updated' });

      expect(updatedEntity.id).toBe('user-1');
      expect(updatedEntity.companyId).toBe('company-1');
      expect(updatedEntity.createdAt).toEqual(existingUser.createdAt);
    });

    it('should reject updates to deleted user', async () => {
      const deletedUser = {
        id: 'user-1',
        deletedAt: new Date(),
      };

      db.users.get.mockResolvedValue(deletedUser);

      const result = await updateUser('user-1', { name: 'New Name' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('should validate email on update', async () => {
      const existingUser = {
        id: 'user-1',
        companyId: 'company-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin',
        phase: 'organize',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: undefined,
        versionVector: { 'device-1': 1 },
        lastModifiedBy: 'device-1',
        lastModifiedAt: new Date(),
        _encrypted: { email: true, name: true },
      };

      db.users.get.mockResolvedValue(existingUser);

      const result = await updateUser('user-1', { email: 'invalid-email' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should check for duplicate email on update', async () => {
      const existingUser = {
        id: 'user-1',
        companyId: 'company-1',
        email: 'old@example.com',
        name: 'Test User',
        role: 'admin',
        phase: 'organize',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: undefined,
        versionVector: { 'device-1': 1 },
        lastModifiedBy: 'device-1',
        lastModifiedAt: new Date(),
        _encrypted: { email: true, name: true },
      };

      db.users.get.mockResolvedValue(existingUser);
      db.users.where.mockReturnValue({
        equals: vi.fn(() => ({
          and: vi.fn(() => ({
            first: vi.fn(() => Promise.resolve({ id: 'user-2' })),
          })),
        })),
      });

      const result = await updateUser('user-1', { email: 'taken@example.com' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CONSTRAINT_VIOLATION');
    });
  });

  describe('updateUserPassword', () => {
    it('should update password hash and salt', async () => {
      const existingUser = {
        id: 'user-1',
        versionVector: { 'device-1': 1 },
        deletedAt: undefined,
      };

      db.users.get.mockResolvedValue(existingUser);
      db.users.update.mockResolvedValue(1);

      const result = await updateUserPassword('user-1', 'newhash', 'newsalt', 'newkey');

      expect(result.success).toBe(true);
      expect(db.users.update).toHaveBeenCalledWith('user-1', expect.objectContaining({
        passwordHash: 'newhash',
        salt: 'newsalt',
        encryptedMasterKey: 'newkey',
      }));
    });

    it('should increment version vector', async () => {
      const existingUser = {
        id: 'user-1',
        versionVector: { 'device-1': 2 },
        deletedAt: undefined,
      };

      db.users.get.mockResolvedValue(existingUser);
      db.users.update.mockResolvedValue(1);

      await updateUserPassword('user-1', 'hash', 'salt');

      expect(db.users.update).toHaveBeenCalledWith('user-1', expect.objectContaining({
        versionVector: expect.objectContaining({
          'test-device-id': 1,
        }),
      }));
    });

    it('should reject update for deleted user', async () => {
      const deletedUser = {
        id: 'user-1',
        deletedAt: new Date(),
      };

      db.users.get.mockResolvedValue(deletedUser);

      const result = await updateUserPassword('user-1', 'hash', 'salt');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });
  });

  describe('updateLastLogin', () => {
    it('should update last login timestamp', async () => {
      const existingUser = {
        id: 'user-1',
        lastLoginAt: undefined,
      };

      db.users.get.mockResolvedValue(existingUser);
      db.users.update.mockResolvedValue(1);

      const before = new Date();
      const result = await updateLastLogin('user-1');
      const after = new Date();

      expect(result.success).toBe(true);
      expect(db.users.update).toHaveBeenCalledWith('user-1', expect.objectContaining({
        lastLoginAt: expect.any(Date),
      }));
    });

    it('should return error for non-existent user', async () => {
      db.users.get.mockResolvedValue(null);

      const result = await updateLastLogin('non-existent-id');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });
  });

  describe('deleteUser', () => {
    it('should soft delete user', async () => {
      const existingUser = {
        id: 'user-1',
        companyId: 'company-1',
        role: 'bookkeeper',
        deletedAt: undefined,
        versionVector: { 'device-1': 1 },
      };

      db.users.get.mockResolvedValue(existingUser);
      db.users.where.mockReturnValue({
        equals: vi.fn(() => ({
          and: vi.fn(() => ({
            count: vi.fn(() => Promise.resolve(2)),
          })),
        })),
      });
      db.users.update.mockResolvedValue(1);

      const result = await deleteUser('user-1');

      expect(result.success).toBe(true);
      expect(db.users.update).toHaveBeenCalledWith('user-1', expect.objectContaining({
        deletedAt: expect.any(Date),
      }));
    });

    it('should prevent deleting last admin', async () => {
      const adminUser = {
        id: 'user-1',
        companyId: 'company-1',
        role: 'admin',
        deletedAt: undefined,
        versionVector: { 'device-1': 1 },
      };

      db.users.get.mockResolvedValue(adminUser);
      db.users.where.mockReturnValue({
        equals: vi.fn(() => ({
          and: vi.fn(() => ({
            count: vi.fn(() => Promise.resolve(1)),
          })),
        })),
      });

      const result = await deleteUser('user-1');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CONSTRAINT_VIOLATION');
      expect(result.error?.message).toContain('last admin');
    });

    it('should increment version vector on delete', async () => {
      const existingUser = {
        id: 'user-1',
        companyId: 'company-1',
        role: 'viewer',
        deletedAt: undefined,
        versionVector: { 'device-1': 3 },
      };

      db.users.get.mockResolvedValue(existingUser);
      db.users.where.mockReturnValue({
        equals: vi.fn(() => ({
          and: vi.fn(() => ({
            count: vi.fn(() => Promise.resolve(2)),
          })),
        })),
      });
      db.users.update.mockResolvedValue(1);

      await deleteUser('user-1');

      expect(db.users.update).toHaveBeenCalledWith('user-1', expect.objectContaining({
        versionVector: expect.objectContaining({
          'test-device-id': 1,
        }),
      }));
    });

    it('should return success for already deleted user', async () => {
      const deletedUser = {
        id: 'user-1',
        deletedAt: new Date(),
      };

      db.users.get.mockResolvedValue(deletedUser);

      const result = await deleteUser('user-1');

      expect(result.success).toBe(true);
      expect(db.users.update).not.toHaveBeenCalled();
    });

    it('should return error for non-existent user', async () => {
      db.users.get.mockResolvedValue(null);

      const result = await deleteUser('non-existent-id');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });
  });

  describe('getCompanyUsers', () => {
    it('should get all active users for a company', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          companyId: 'company-1',
          email: 'test1@example.com',
          name: 'User 1',
          role: 'admin',
          phase: 'organize',
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: undefined,
          versionVector: { 'device-1': 1 },
          lastModifiedBy: 'device-1',
          lastModifiedAt: new Date(),
          _encrypted: { email: true, name: true },
        },
        {
          id: 'user-2',
          companyId: 'company-1',
          email: 'test2@example.com',
          name: 'User 2',
          role: 'viewer',
          phase: 'stabilize',
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: undefined,
          versionVector: { 'device-1': 1 },
          lastModifiedBy: 'device-1',
          lastModifiedAt: new Date(),
          _encrypted: { email: true, name: true },
        },
      ];

      db.users.where.mockReturnValue({
        equals: vi.fn(() => ({
          and: vi.fn(() => ({
            toArray: vi.fn(() => Promise.resolve(mockUsers)),
          })),
          toArray: vi.fn(() => Promise.resolve(mockUsers)),
        })),
      });

      const result = await getCompanyUsers('company-1');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data?.[0].id).toBe('user-1');
      expect(result.data?.[1].id).toBe('user-2');
    });

    it('should decrypt user fields when encryption context provided', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          companyId: 'company-1',
          email: 'encrypted-test@example.com',
          name: 'encrypted-Test User',
          role: 'admin',
          phase: 'organize',
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: undefined,
          versionVector: { 'device-1': 1 },
          lastModifiedBy: 'device-1',
          lastModifiedAt: new Date(),
          _encrypted: { email: true, name: true },
        },
      ];

      db.users.where.mockReturnValue({
        equals: vi.fn(() => ({
          and: vi.fn(() => ({
            toArray: vi.fn(() => Promise.resolve(mockUsers)),
          })),
          toArray: vi.fn(() => Promise.resolve(mockUsers)),
        })),
      });

      const context: EncryptionContext = {
        companyId: 'company-1',
        userId: 'user-1',
        encryptionService: mockEncryptionService,
      };

      const result = await getCompanyUsers('company-1', false, context);

      expect(result.success).toBe(true);
      expect(result.data?.[0].email).toBe('test@example.com');
      expect(result.data?.[0].name).toBe('Test User');
    });

    it('should exclude deleted users by default', async () => {
      db.users.where.mockReturnValue({
        equals: vi.fn(() => ({
          and: vi.fn((filterFn: any) => {
            const users = [
              { id: 'user-1', deletedAt: undefined },
              { id: 'user-2', deletedAt: new Date() },
            ];
            const filtered = users.filter(filterFn);
            return {
              toArray: vi.fn(() => Promise.resolve(filtered)),
            };
          }),
        })),
      });

      const result = await getCompanyUsers('company-1', false);

      expect(result.success).toBe(true);
    });

    it('should include deleted users when requested', async () => {
      const mockUsers = [
        { id: 'user-1', deletedAt: undefined },
        { id: 'user-2', deletedAt: new Date() },
      ];

      db.users.where.mockReturnValue({
        equals: vi.fn(() => ({
          toArray: vi.fn(() => Promise.resolve(mockUsers)),
        })),
      });

      const result = await getCompanyUsers('company-1', true);

      expect(result.success).toBe(true);
    });

    it('should return empty array when no users found', async () => {
      db.users.where.mockReturnValue({
        equals: vi.fn(() => ({
          and: vi.fn(() => ({
            toArray: vi.fn(() => Promise.resolve([])),
          })),
          toArray: vi.fn(() => Promise.resolve([])),
        })),
      });

      const result = await getCompanyUsers('company-1');

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });
});
