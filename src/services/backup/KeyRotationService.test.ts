/**
 * Key Rotation Service Tests
 *
 * Tests for key rotation epoch system per ROADMAP_BACKUP_AND_SYNC.md Phase 1, Task 1.2.
 * Verifies epoch increment, verification, and IDOR protection.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  incrementKeyRotationEpoch,
  getCurrentEpoch,
  verifyKeyRotationEpoch,
  initializeKeyRotationEpoch,
} from './KeyRotationService';
import { db } from '../../db';
import { ErrorCode } from '../../utils/errors';

// Mock the database
vi.mock('../../db', () => ({
  db: {
    companies: {
      get: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Mock logger
vi.mock('../../utils/logger', () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    }),
  },
}));

// Mock CRDT utilities
vi.mock('../../db/crdt', () => ({
  incrementVersionVector: vi.fn((vv, deviceId) => ({
    ...vv,
    [deviceId]: (vv[deviceId] || 0) + 1,
  })),
  getDeviceId: vi.fn(() => 'test-device-123'),
}));

describe('KeyRotationService', () => {
  const testCompanyId = 'company-123';
  const testDeviceId = 'test-device-123';

  const mockCompany = {
    id: testCompanyId,
    name: 'Test Company',
    legal_name: 'Test Company LLC',
    tax_id: null,
    address: null,
    phone: null,
    email: null,
    fiscal_year_end: '12-31',
    currency: 'USD',
    settings: {
      accounting_method: 'accrual' as const,
      multi_currency: false,
      track_inventory: false,
      auto_backup: true,
      retention_period_days: 2555,
    },
    key_rotation_epoch: 0,
    created_at: Date.now(),
    updated_at: Date.now(),
    deleted_at: null,
    version_vector: {
      [testDeviceId]: 1,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('getCurrentEpoch', () => {
    it('should return current epoch for valid company', async () => {
      vi.mocked(db.companies.get).mockResolvedValue(mockCompany);

      const result = await getCurrentEpoch(testCompanyId);

      expect(result.success).toBe(true);
      expect(result.data).toBe(0);
      expect(db.companies.get).toHaveBeenCalledWith(testCompanyId);
    });

    it('should return 0 for company with undefined epoch', async () => {
      const companyWithoutEpoch = { ...mockCompany, key_rotation_epoch: undefined };
      vi.mocked(db.companies.get).mockResolvedValue(companyWithoutEpoch as any);

      const result = await getCurrentEpoch(testCompanyId);

      expect(result.success).toBe(true);
      expect(result.data).toBe(0);
    });

    it('should return error for invalid companyId', async () => {
      const result = await getCurrentEpoch('');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(result.error?.message).toContain('Company ID is required');
    });

    it('should return error for null companyId', async () => {
      const result = await getCurrentEpoch(null as any);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('should return error for non-existent company', async () => {
      vi.mocked(db.companies.get).mockResolvedValue(undefined);

      const result = await getCurrentEpoch(testCompanyId);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.NOT_FOUND);
      expect(result.error?.message).toBe('Company not found');
    });

    it('should return error for soft-deleted company', async () => {
      const deletedCompany = { ...mockCompany, deleted_at: Date.now() };
      vi.mocked(db.companies.get).mockResolvedValue(deletedCompany);

      const result = await getCurrentEpoch(testCompanyId);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.NOT_FOUND);
      expect(result.error?.message).toBe('Company not found');
    });

    it('should handle database errors gracefully', async () => {
      vi.mocked(db.companies.get).mockRejectedValue(new Error('Database connection lost'));

      const result = await getCurrentEpoch(testCompanyId);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.DATABASE_ERROR);
    });
  });

  describe('incrementKeyRotationEpoch', () => {
    it('should increment epoch from 0 to 1', async () => {
      vi.mocked(db.companies.get).mockResolvedValue(mockCompany);
      vi.mocked(db.companies.update).mockResolvedValue(1);

      const result = await incrementKeyRotationEpoch(testCompanyId);

      expect(result.success).toBe(true);
      expect(result.data).toBe(1);
      expect(db.companies.update).toHaveBeenCalledWith(testCompanyId, {
        key_rotation_epoch: 1,
        updated_at: expect.any(Number),
        version_vector: expect.any(Object),
      });
    });

    it('should increment epoch from 5 to 6', async () => {
      const companyWithEpoch5 = { ...mockCompany, key_rotation_epoch: 5 };
      vi.mocked(db.companies.get).mockResolvedValue(companyWithEpoch5);
      vi.mocked(db.companies.update).mockResolvedValue(1);

      const result = await incrementKeyRotationEpoch(testCompanyId);

      expect(result.success).toBe(true);
      expect(result.data).toBe(6);
      expect(db.companies.update).toHaveBeenCalledWith(testCompanyId, {
        key_rotation_epoch: 6,
        updated_at: expect.any(Number),
        version_vector: expect.any(Object),
      });
    });

    it('should handle company with undefined epoch (treat as 0)', async () => {
      const companyWithoutEpoch = { ...mockCompany, key_rotation_epoch: undefined };
      vi.mocked(db.companies.get).mockResolvedValue(companyWithoutEpoch as any);
      vi.mocked(db.companies.update).mockResolvedValue(1);

      const result = await incrementKeyRotationEpoch(testCompanyId);

      expect(result.success).toBe(true);
      expect(result.data).toBe(1);
    });

    it('should return error for invalid companyId', async () => {
      const result = await incrementKeyRotationEpoch('');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(db.companies.get).not.toHaveBeenCalled();
      expect(db.companies.update).not.toHaveBeenCalled();
    });

    it('should return error for non-existent company', async () => {
      vi.mocked(db.companies.get).mockResolvedValue(undefined);

      const result = await incrementKeyRotationEpoch(testCompanyId);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.NOT_FOUND);
      expect(db.companies.update).not.toHaveBeenCalled();
    });

    it('should return error for soft-deleted company', async () => {
      const deletedCompany = { ...mockCompany, deleted_at: Date.now() };
      vi.mocked(db.companies.get).mockResolvedValue(deletedCompany);

      const result = await incrementKeyRotationEpoch(testCompanyId);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.NOT_FOUND);
      expect(db.companies.update).not.toHaveBeenCalled();
    });

    it('should update version vector when incrementing', async () => {
      vi.mocked(db.companies.get).mockResolvedValue(mockCompany);
      vi.mocked(db.companies.update).mockResolvedValue(1);

      await incrementKeyRotationEpoch(testCompanyId);

      const updateCall = vi.mocked(db.companies.update).mock.calls[0];
      expect(updateCall[1].version_vector).toBeDefined();
      expect(updateCall[1].version_vector[testDeviceId]).toBe(2); // Incremented from 1 to 2
    });

    it('should update timestamp when incrementing', async () => {
      const now = Date.now();
      vi.mocked(db.companies.get).mockResolvedValue(mockCompany);
      vi.mocked(db.companies.update).mockResolvedValue(1);

      await incrementKeyRotationEpoch(testCompanyId);

      const updateCall = vi.mocked(db.companies.update).mock.calls[0];
      expect(updateCall[1].updated_at).toBe(now);
    });

    it('should handle database errors gracefully', async () => {
      vi.mocked(db.companies.get).mockRejectedValue(new Error('Database connection lost'));

      const result = await incrementKeyRotationEpoch(testCompanyId);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.DATABASE_ERROR);
    });
  });

  describe('verifyKeyRotationEpoch', () => {
    it('should return valid=true when epochs match', async () => {
      vi.mocked(db.companies.get).mockResolvedValue(mockCompany);

      const result = await verifyKeyRotationEpoch(testCompanyId, 0);

      expect(result.success).toBe(true);
      expect(result.data?.valid).toBe(true);
      expect(result.data?.currentEpoch).toBe(0);
      expect(result.data?.clientEpoch).toBe(0);
      expect(result.data?.message).toContain('successful');
    });

    it('should return valid=false when epochs do not match', async () => {
      const companyWithEpoch2 = { ...mockCompany, key_rotation_epoch: 2 };
      vi.mocked(db.companies.get).mockResolvedValue(companyWithEpoch2);

      const result = await verifyKeyRotationEpoch(testCompanyId, 0);

      expect(result.success).toBe(true);
      expect(result.data?.valid).toBe(false);
      expect(result.data?.currentEpoch).toBe(2);
      expect(result.data?.clientEpoch).toBe(0);
      expect(result.data?.message).toContain('mismatch');
    });

    it('should detect when client is behind by 1 epoch', async () => {
      const companyWithEpoch1 = { ...mockCompany, key_rotation_epoch: 1 };
      vi.mocked(db.companies.get).mockResolvedValue(companyWithEpoch1);

      const result = await verifyKeyRotationEpoch(testCompanyId, 0);

      expect(result.success).toBe(true);
      expect(result.data?.valid).toBe(false);
      expect(result.data?.currentEpoch).toBe(1);
      expect(result.data?.clientEpoch).toBe(0);
    });

    it('should detect when client is behind by multiple epochs', async () => {
      const companyWithEpoch5 = { ...mockCompany, key_rotation_epoch: 5 };
      vi.mocked(db.companies.get).mockResolvedValue(companyWithEpoch5);

      const result = await verifyKeyRotationEpoch(testCompanyId, 0);

      expect(result.success).toBe(true);
      expect(result.data?.valid).toBe(false);
      expect(result.data?.currentEpoch).toBe(5);
      expect(result.data?.clientEpoch).toBe(0);
    });

    it('should return error for negative client epoch', async () => {
      const result = await verifyKeyRotationEpoch(testCompanyId, -1);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(result.error?.message).toContain('non-negative integer');
    });

    it('should return error for non-integer client epoch', async () => {
      const result = await verifyKeyRotationEpoch(testCompanyId, 1.5);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('should return error for invalid companyId', async () => {
      const result = await verifyKeyRotationEpoch('', 0);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(db.companies.get).not.toHaveBeenCalled();
    });

    it('should return error for non-existent company', async () => {
      vi.mocked(db.companies.get).mockResolvedValue(undefined);

      const result = await verifyKeyRotationEpoch(testCompanyId, 0);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.NOT_FOUND);
    });

    it('should handle database errors gracefully', async () => {
      vi.mocked(db.companies.get).mockRejectedValue(new Error('Database connection lost'));

      const result = await verifyKeyRotationEpoch(testCompanyId, 0);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.DATABASE_ERROR);
    });
  });

  describe('initializeKeyRotationEpoch', () => {
    it('should initialize epoch to 0 for company without epoch', async () => {
      const companyWithoutEpoch = { ...mockCompany, key_rotation_epoch: undefined };
      vi.mocked(db.companies.get).mockResolvedValue(companyWithoutEpoch as any);
      vi.mocked(db.companies.update).mockResolvedValue(1);

      const result = await initializeKeyRotationEpoch(testCompanyId);

      expect(result.success).toBe(true);
      expect(db.companies.update).toHaveBeenCalledWith(testCompanyId, {
        key_rotation_epoch: 0,
        updated_at: expect.any(Number),
        version_vector: expect.any(Object),
      });
    });

    it('should not reinitialize if epoch already exists', async () => {
      vi.mocked(db.companies.get).mockResolvedValue(mockCompany);

      const result = await initializeKeyRotationEpoch(testCompanyId);

      expect(result.success).toBe(true);
      expect(db.companies.update).not.toHaveBeenCalled();
    });

    it('should not reinitialize if epoch is 5', async () => {
      const companyWithEpoch5 = { ...mockCompany, key_rotation_epoch: 5 };
      vi.mocked(db.companies.get).mockResolvedValue(companyWithEpoch5);

      const result = await initializeKeyRotationEpoch(testCompanyId);

      expect(result.success).toBe(true);
      expect(db.companies.update).not.toHaveBeenCalled();
    });

    it('should initialize even if epoch is null', async () => {
      const companyWithNullEpoch = { ...mockCompany, key_rotation_epoch: null };
      vi.mocked(db.companies.get).mockResolvedValue(companyWithNullEpoch as any);
      vi.mocked(db.companies.update).mockResolvedValue(1);

      const result = await initializeKeyRotationEpoch(testCompanyId);

      expect(result.success).toBe(true);
      expect(db.companies.update).toHaveBeenCalledWith(testCompanyId, {
        key_rotation_epoch: 0,
        updated_at: expect.any(Number),
        version_vector: expect.any(Object),
      });
    });

    it('should return error for invalid companyId', async () => {
      const result = await initializeKeyRotationEpoch('');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(db.companies.get).not.toHaveBeenCalled();
    });

    it('should return error for non-existent company', async () => {
      vi.mocked(db.companies.get).mockResolvedValue(undefined);

      const result = await initializeKeyRotationEpoch(testCompanyId);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.NOT_FOUND);
      expect(db.companies.update).not.toHaveBeenCalled();
    });

    it('should return error for soft-deleted company', async () => {
      const deletedCompany = { ...mockCompany, deleted_at: Date.now() };
      vi.mocked(db.companies.get).mockResolvedValue(deletedCompany);

      const result = await initializeKeyRotationEpoch(testCompanyId);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.NOT_FOUND);
      expect(db.companies.update).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      vi.mocked(db.companies.get).mockRejectedValue(new Error('Database connection lost'));

      const result = await initializeKeyRotationEpoch(testCompanyId);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.DATABASE_ERROR);
    });
  });

  describe('IDOR Protection', () => {
    it('should prevent access with empty string companyId', async () => {
      const result1 = await getCurrentEpoch('');
      const result2 = await incrementKeyRotationEpoch('');
      const result3 = await verifyKeyRotationEpoch('', 0);
      const result4 = await initializeKeyRotationEpoch('');

      expect(result1.success).toBe(false);
      expect(result2.success).toBe(false);
      expect(result3.success).toBe(false);
      expect(result4.success).toBe(false);
    });

    it('should prevent access with null companyId', async () => {
      const result1 = await getCurrentEpoch(null as any);
      const result2 = await incrementKeyRotationEpoch(null as any);
      const result3 = await verifyKeyRotationEpoch(null as any, 0);
      const result4 = await initializeKeyRotationEpoch(null as any);

      expect(result1.success).toBe(false);
      expect(result2.success).toBe(false);
      expect(result3.success).toBe(false);
      expect(result4.success).toBe(false);
    });

    it('should prevent access with whitespace-only companyId', async () => {
      const result1 = await getCurrentEpoch('   ');
      const result2 = await incrementKeyRotationEpoch('   ');
      const result3 = await verifyKeyRotationEpoch('   ', 0);
      const result4 = await initializeKeyRotationEpoch('   ');

      expect(result1.success).toBe(false);
      expect(result2.success).toBe(false);
      expect(result3.success).toBe(false);
      expect(result4.success).toBe(false);
    });

    it('should return NOT_FOUND for unauthorized company access (not reveal existence)', async () => {
      vi.mocked(db.companies.get).mockResolvedValue(undefined);

      const result = await getCurrentEpoch('company-not-mine');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.NOT_FOUND);
      expect(result.error?.message).toBe('Company not found');
    });
  });

  describe('Integration Scenarios', () => {
    it('should support complete key rotation workflow', async () => {
      // Step 1: Initialize epoch
      const companyWithoutEpoch = { ...mockCompany, key_rotation_epoch: undefined };
      vi.mocked(db.companies.get).mockResolvedValue(companyWithoutEpoch as any);
      vi.mocked(db.companies.update).mockResolvedValue(1);

      const initResult = await initializeKeyRotationEpoch(testCompanyId);
      expect(initResult.success).toBe(true);

      // Step 2: Verify client can sync with epoch 0
      vi.mocked(db.companies.get).mockResolvedValue(mockCompany);
      const verifyResult1 = await verifyKeyRotationEpoch(testCompanyId, 0);
      expect(verifyResult1.success).toBe(true);
      expect(verifyResult1.data?.valid).toBe(true);

      // Step 3: Revoke user (increment epoch)
      const incrementResult = await incrementKeyRotationEpoch(testCompanyId);
      expect(incrementResult.success).toBe(true);
      expect(incrementResult.data).toBe(1);

      // Step 4: Verify old client is now rejected
      const companyWithEpoch1 = { ...mockCompany, key_rotation_epoch: 1 };
      vi.mocked(db.companies.get).mockResolvedValue(companyWithEpoch1);
      const verifyResult2 = await verifyKeyRotationEpoch(testCompanyId, 0);
      expect(verifyResult2.success).toBe(true);
      expect(verifyResult2.data?.valid).toBe(false);

      // Step 5: Verify new client with epoch 1 can sync
      const verifyResult3 = await verifyKeyRotationEpoch(testCompanyId, 1);
      expect(verifyResult3.success).toBe(true);
      expect(verifyResult3.data?.valid).toBe(true);
    });

    it('should handle multiple consecutive rotations', async () => {
      // Start with epoch 0
      let currentCompany = { ...mockCompany, key_rotation_epoch: 0 };
      vi.mocked(db.companies.get).mockResolvedValue(currentCompany);
      vi.mocked(db.companies.update).mockResolvedValue(1);

      // Rotate 5 times
      for (let i = 1; i <= 5; i++) {
        const result = await incrementKeyRotationEpoch(testCompanyId);
        expect(result.success).toBe(true);
        expect(result.data).toBe(i);

        currentCompany = { ...currentCompany, key_rotation_epoch: i };
        vi.mocked(db.companies.get).mockResolvedValue(currentCompany);
      }

      // Verify final epoch
      const getCurrentResult = await getCurrentEpoch(testCompanyId);
      expect(getCurrentResult.success).toBe(true);
      expect(getCurrentResult.data).toBe(5);
    });

    it('should prevent sync for clients behind by multiple epochs', async () => {
      const companyWithEpoch10 = { ...mockCompany, key_rotation_epoch: 10 };
      vi.mocked(db.companies.get).mockResolvedValue(companyWithEpoch10);

      // Client with epoch 0 (very old)
      const verifyResult1 = await verifyKeyRotationEpoch(testCompanyId, 0);
      expect(verifyResult1.data?.valid).toBe(false);

      // Client with epoch 5 (still old)
      const verifyResult2 = await verifyKeyRotationEpoch(testCompanyId, 5);
      expect(verifyResult2.data?.valid).toBe(false);

      // Client with epoch 9 (one behind)
      const verifyResult3 = await verifyKeyRotationEpoch(testCompanyId, 9);
      expect(verifyResult3.data?.valid).toBe(false);

      // Client with epoch 10 (current)
      const verifyResult4 = await verifyKeyRotationEpoch(testCompanyId, 10);
      expect(verifyResult4.data?.valid).toBe(true);
    });
  });
});
