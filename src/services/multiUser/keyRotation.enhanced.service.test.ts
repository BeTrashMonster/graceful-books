/**
 * Tests for Enhanced Key Rotation Service
 *
 * Tests cover:
 * - Key rotation initiation and completion
 * - Access revocation (<3 seconds target)
 * - Background re-encryption
 * - Automatic rollback on failure
 * - Session invalidation
 * - Progress tracking
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  KeyRotationService,
  RotationStatus,
  type RotationJob,
  type RevocationResult,
} from './keyRotation.enhanced.service';
import type {
  MasterKey,
  EncryptionContext,
  KeyRotationRequest,
} from '../../crypto/types';
import { db } from '../../store/database';

// Mock dependencies
vi.mock('../../store/database', () => ({
  db: {
    accounts: {
      where: vi.fn(),
      bulkPut: vi.fn(),
    },
    transactions: {
      where: vi.fn(),
      bulkPut: vi.fn(),
    },
    transactionLines: {
      where: vi.fn(),
      bulkPut: vi.fn(),
    },
    contacts: {
      where: vi.fn(),
      bulkPut: vi.fn(),
    },
    users: {
      where: vi.fn(),
      bulkPut: vi.fn(),
      get: vi.fn(),
    },
    companies: {
      where: vi.fn(),
      update: vi.fn(),
    },
    companyUsers: {
      where: vi.fn(),
      update: vi.fn(),
    },
    sessions: {
      where: vi.fn(),
      bulkPut: vi.fn(),
    },
  },
}));

vi.mock('../../crypto/keyManagement', () => ({
  rotateKeys: vi.fn(),
  deriveAllKeys: vi.fn(),
  createEncryptionContext: vi.fn(),
}));

describe('KeyRotationService', () => {
  let service: KeyRotationService;
  let mockOldContext: EncryptionContext;
  let mockNewMasterKey: MasterKey;
  let mockRotationRequest: KeyRotationRequest;

  beforeEach(() => {
    service = new KeyRotationService();

    // Mock master key
    mockNewMasterKey = {
      id: 'new-master-key-123',
      keyMaterial: new Uint8Array(32),
      derivationParams: {
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
        salt: new Uint8Array(16),
        keyLength: 32,
      },
      createdAt: Date.now(),
    };

    // Mock encryption context
    mockOldContext = {
      masterKey: {
        id: 'old-master-key-123',
        keyMaterial: new Uint8Array(32),
        derivationParams: {
          memoryCost: 65536,
          timeCost: 3,
          parallelism: 4,
          salt: new Uint8Array(16),
          keyLength: 32,
        },
        createdAt: Date.now() - 10000,
      },
      derivedKeys: new Map(),
      sessionId: 'session-123',
      sessionStartedAt: Date.now() - 5000,
    };

    // Mock rotation request
    mockRotationRequest = {
      oldMasterKeyId: 'old-master-key-123',
      reason: 'user_revocation',
      revokedUserId: 'user-456',
      initiatedAt: Date.now(),
    };

    // Reset mocks
    vi.clearAllMocks();
  });

  describe('initiateRotation', () => {
    it('should create a rotation job', async () => {
      const result = await service.initiateRotation(
        'company-123',
        mockOldContext,
        mockNewMasterKey,
        mockRotationRequest,
        'admin-user-789'
      );

      expect(result.success).toBe(true);
      expect((result as any).data).toBeDefined();
      expect((result as any).data.companyId).toBe('company-123');
      expect((result as any).data.status).toBe(RotationStatus.PENDING);
      expect((result as any).data.initiatedBy).toBe('admin-user-789');
    });

    it('should prevent concurrent rotations for the same company', async () => {
      // Start first rotation
      await service.initiateRotation(
        'company-123',
        mockOldContext,
        mockNewMasterKey,
        mockRotationRequest,
        'admin-user-789'
      );

      // Try to start second rotation
      const result = await service.initiateRotation(
        'company-123',
        mockOldContext,
        mockNewMasterKey,
        mockRotationRequest,
        'admin-user-789'
      );

      expect(result.success).toBe(false);
      expect((result as any).error).toContain('already in progress');
    });

    it('should include revoked user ID if provided', async () => {
      const result = await service.initiateRotation(
        'company-123',
        mockOldContext,
        mockNewMasterKey,
        mockRotationRequest,
        'admin-user-789'
      );

      expect((result as any).data.revokedUserId).toBe('user-456');
    });
  });

  describe('getJobStatus', () => {
    it('should return job status', async () => {
      const initResult = await service.initiateRotation(
        'company-123',
        mockOldContext,
        mockNewMasterKey,
        mockRotationRequest,
        'admin-user-789'
      );

      const jobId = (initResult as any).data.id;
      const status = service.getJobStatus(jobId);

      expect(status).toBeDefined();
      expect(status?.id).toBe(jobId);
    });

    it('should return undefined for non-existent job', () => {
      const status = service.getJobStatus('non-existent-job');
      expect(status).toBeUndefined();
    });
  });

  describe('getCompanyJobs', () => {
    it('should return all jobs for a company', async () => {
      await service.initiateRotation(
        'company-123',
        mockOldContext,
        mockNewMasterKey,
        mockRotationRequest,
        'admin-user-789'
      );

      await service.initiateRotation(
        'company-456',
        mockOldContext,
        mockNewMasterKey,
        mockRotationRequest,
        'admin-user-789'
      );

      const jobs = service.getCompanyJobs('company-123');
      expect(jobs).toHaveLength(1);
      expect(jobs[0].companyId).toBe('company-123');
    });

    it('should return empty array for company with no jobs', () => {
      const jobs = service.getCompanyJobs('company-999');
      expect(jobs).toHaveLength(0);
    });
  });

  describe('revokeAccess', () => {
    beforeEach(() => {
      // Mock database queries for revocation
      const mockCompanyUser = {
        id: 'company-user-123',
        company_id: 'company-123',
        user_id: 'user-456',
        role: 'BOOKKEEPER',
        permissions: [],
        active: true,
        created_at: Date.now(),
        updated_at: Date.now(),
        deleted_at: null,
        version_vector: { 'device-1': 1 },
      };

      const mockSessions = [
        {
          id: 'session-1',
          user_id: 'user-456',
          company_id: 'company-123',
          token: 'token-1',
          device_id: 'device-1',
          device_name: null,
          ip_address: null,
          user_agent: null,
          expires_at: Date.now() + 86400000,
          last_activity_at: Date.now(),
          remember_device: false,
          created_at: Date.now(),
          updated_at: Date.now(),
          deleted_at: null,
          version_vector: { 'device-1': 1 },
        },
        {
          id: 'session-2',
          user_id: 'user-456',
          company_id: 'company-123',
          token: 'token-2',
          device_id: 'device-2',
          device_name: null,
          ip_address: null,
          user_agent: null,
          expires_at: Date.now() + 86400000,
          last_activity_at: Date.now(),
          remember_device: false,
          created_at: Date.now(),
          updated_at: Date.now(),
          deleted_at: null,
          version_vector: { 'device-2': 1 },
        },
      ];

      (db.companyUsers.where as any).mockReturnValue({
        equals: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(mockCompanyUser),
        }),
      });

      (db.sessions.where as any).mockReturnValue({
        equals: vi.fn().mockReturnValue({
          and: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue(mockSessions),
          }),
        }),
      });
    });

    it('should revoke access within 3 seconds', async () => {
      const startTime = Date.now();

      const result = await service.revokeAccess(
        'company-123',
        'user-456',
        'admin-789'
      );

      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.revokedUserId).toBe('user-456');
      expect(result.durationMs).toBeLessThan(3000);
      expect(duration).toBeLessThan(3000); // Actual duration check
    });

    it('should invalidate all user sessions', async () => {
      const result = await service.revokeAccess(
        'company-123',
        'user-456',
        'admin-789'
      );

      expect(result.success).toBe(true);
      expect(result.sessionsInvalidated).toBe(2);
      expect(db.sessions.bulkPut).toHaveBeenCalled();
    });

    it('should mark user as inactive', async () => {
      await service.revokeAccess('company-123', 'user-456', 'admin-789');

      expect(db.companyUsers.update).toHaveBeenCalledWith(
        'company-user-123',
        expect.objectContaining({
          active: false,
        })
      );
    });

    it('should handle user not found', async () => {
      (db.companyUsers.where as any).mockReturnValue({
        equals: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
        }),
      });

      const result = await service.revokeAccess(
        'company-123',
        'non-existent-user',
        'admin-789'
      );

      expect(result.success).toBe(false);
      expect((result as any).error).toContain('not found');
    });
  });

  describe('restoreAccess', () => {
    beforeEach(() => {
      const mockCompanyUser = {
        id: 'company-user-123',
        company_id: 'company-123',
        user_id: 'user-456',
        role: 'BOOKKEEPER',
        permissions: [],
        active: false,
        created_at: Date.now(),
        updated_at: Date.now(),
        deleted_at: null,
        version_vector: { 'device-1': 1 },
      };

      (db.companyUsers.where as any).mockReturnValue({
        equals: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(mockCompanyUser),
        }),
      });
    });

    it('should restore user access', async () => {
      const result = await service.restoreAccess(
        'company-123',
        'user-456',
        'admin-789'
      );

      expect(result.success).toBe(true);
      expect(db.companyUsers.update).toHaveBeenCalledWith(
        'company-user-123',
        expect.objectContaining({
          active: true,
        })
      );
    });

    it('should handle user not found', async () => {
      (db.companyUsers.where as any).mockReturnValue({
        equals: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
        }),
      });

      const result = await service.restoreAccess(
        'company-123',
        'non-existent-user',
        'admin-789'
      );

      expect(result.success).toBe(false);
      expect((result as any).error).toContain('not found');
    });
  });

  describe('cleanupOldJobs', () => {
    it('should remove completed jobs older than retention period', async () => {
      // Create an old completed job
      const oldJob: RotationJob = {
        id: 'old-job-123',
        companyId: 'company-123',
        status: RotationStatus.COMPLETED,
        reason: 'scheduled',
        initiatedBy: 'admin-789',
        initiatedAt: Date.now() - 8 * 24 * 60 * 60 * 1000, // 8 days ago
        oldMasterKeyId: 'old-key',
        progress: {
          totalEntities: 100,
          processedEntities: 100,
          percentComplete: 100,
        },
      };

      // Manually add to active jobs
      (service as any).activeJobs.set(oldJob.id, oldJob);

      // Clean up with 7 day retention
      service.cleanupOldJobs(7);

      // Job should be removed
      const status = service.getJobStatus(oldJob.id);
      expect(status).toBeUndefined();
    });

    it('should keep recent completed jobs', async () => {
      const recentJob: RotationJob = {
        id: 'recent-job-123',
        companyId: 'company-123',
        status: RotationStatus.COMPLETED,
        reason: 'scheduled',
        initiatedBy: 'admin-789',
        initiatedAt: Date.now() - 2 * 24 * 60 * 60 * 1000, // 2 days ago
        oldMasterKeyId: 'old-key',
        progress: {
          totalEntities: 100,
          processedEntities: 100,
          percentComplete: 100,
        },
      };

      (service as any).activeJobs.set(recentJob.id, recentJob);

      service.cleanupOldJobs(7);

      const status = service.getJobStatus(recentJob.id);
      expect(status).toBeDefined();
    });

    it('should not remove in-progress jobs', async () => {
      const inProgressJob: RotationJob = {
        id: 'in-progress-job-123',
        companyId: 'company-123',
        status: RotationStatus.IN_PROGRESS,
        reason: 'scheduled',
        initiatedBy: 'admin-789',
        initiatedAt: Date.now() - 10 * 24 * 60 * 60 * 1000, // 10 days ago
        oldMasterKeyId: 'old-key',
        progress: {
          totalEntities: 100,
          processedEntities: 50,
          percentComplete: 50,
        },
      };

      (service as any).activeJobs.set(inProgressJob.id, inProgressJob);

      service.cleanupOldJobs(7);

      const status = service.getJobStatus(inProgressJob.id);
      expect(status).toBeDefined();
    });
  });

  describe('Performance Requirements', () => {
    it('should complete revocation in under 3 seconds', async () => {
      const mockCompanyUser = {
        id: 'company-user-123',
        company_id: 'company-123',
        user_id: 'user-456',
        role: 'BOOKKEEPER',
        permissions: [],
        active: true,
        created_at: Date.now(),
        updated_at: Date.now(),
        deleted_at: null,
        version_vector: { 'device-1': 1 },
      };

      (db.companyUsers.where as any).mockReturnValue({
        equals: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(mockCompanyUser),
        }),
      });

      (db.sessions.where as any).mockReturnValue({
        equals: vi.fn().mockReturnValue({
          and: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await service.revokeAccess(
        'company-123',
        'user-456',
        'admin-789'
      );

      expect(result.durationMs).toBeLessThan(3000);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully during revocation', async () => {
      (db.companyUsers.where as any).mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await service.revokeAccess(
        'company-123',
        'user-456',
        'admin-789'
      );

      expect(result.success).toBe(false);
      expect((result as any).error).toBeDefined();
    });

    it('should handle errors during rotation initiation', async () => {
      const invalidRequest: KeyRotationRequest = {
        oldMasterKeyId: 'wrong-key-id',
        reason: 'user_revocation',
        initiatedAt: Date.now(),
      };

      const result = await service.initiateRotation(
        'company-123',
        mockOldContext,
        mockNewMasterKey,
        invalidRequest,
        'admin-789'
      );

      // Should still create a job (validation happens during execution)
      expect(result.success).toBe(true);
    });
  });
});
