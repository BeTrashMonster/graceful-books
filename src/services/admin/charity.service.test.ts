/**
 * Admin Charity Service Tests
 *
 * Tests for charity CRUD operations, verification workflow, and authorization.
 *
 * Requirements:
 * - IC3: Admin Panel - Charity Management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '../../db';
import type { Charity, CharityStatus } from '../../types/database.types';
import {
  createCharity,
  getAllCharities,
  getVerifiedCharities,
  addVerificationNote,
  verifyCharity,
  rejectCharity,
  removeCharity,
  getCharityStatistics,
  validateEINFormat,
} from './charity.service';

// Mock the database
vi.mock('../../db', () => ({
  db: {
    charities: {
      add: vi.fn(),
      get: vi.fn(),
      update: vi.fn(),
      toCollection: vi.fn(() => ({
        toArray: vi.fn(),
      })),
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          toArray: vi.fn(),
        })),
      })),
      toArray: vi.fn(),
    },
  },
}));

describe('Admin Charity Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createCharity', () => {
    it('should create a charity with PENDING status', async () => {
      (db.charities.add as any).mockResolvedValue('charity-id');

      const result = await createCharity({
        name: 'Test Charity',
        ein: '12-3456789',
        description: 'A test charity for education',
        category: 'EDUCATION',
        website: 'https://testcharity.org',
        createdBy: 'admin-123',
      });

      expect(result).toMatchObject({
        name: 'Test Charity',
        ein: '12-3456789',
        status: 'PENDING',
      });
      expect(db.charities.add).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Charity',
          ein: '12-3456789',
          status: 'PENDING',
        })
      );
    });

    it('should validate EIN format', async () => {
      await expect(
        createCharity({
          name: 'Test Charity',
          ein: 'invalid-ein',
          description: 'A test charity for education',
          category: 'EDUCATION',
          website: 'https://testcharity.org',
          createdBy: 'admin-123',
        })
      ).rejects.toThrow('EIN must be in format XX-XXXXXXX');
    });

    it('should validate required fields', async () => {
      await expect(
        createCharity({
          name: '',
          ein: '12-3456789',
          description: 'A test charity',
          category: 'EDUCATION',
          website: 'https://testcharity.org',
          createdBy: 'admin-123',
        })
      ).rejects.toThrow('name is required');
    });
  });

  describe('getAllCharities', () => {
    it('should return all charities', async () => {
      const mockCharities: Charity[] = [
        {
          id: '1',
          name: 'Charity 1',
          ein: '12-3456789',
          description: 'Test',
          category: 'EDUCATION',
          website: 'https://charity1.org',
          logo: null,
          status: 'VERIFIED',
          verification_notes: null,
          rejection_reason: null,
          created_by: 'admin-123',
          created_at: Date.now(),
          updated_at: Date.now(),
          active: true,
        },
      ];

      const mockToArray = vi.fn().mockResolvedValue(mockCharities);
      (db.charities.toCollection as any).mockReturnValue({
        toArray: mockToArray,
      });

      const result = await getAllCharities();

      expect(result).toEqual(mockCharities);
      expect(mockToArray).toHaveBeenCalled();
    });

    it('should filter by status', async () => {
      const mockCharities: Charity[] = [
        {
          id: '1',
          name: 'Pending Charity',
          ein: '12-3456789',
          description: 'Test',
          category: 'EDUCATION',
          website: 'https://charity1.org',
          logo: null,
          status: 'PENDING',
          verification_notes: null,
          rejection_reason: null,
          created_by: 'admin-123',
          created_at: Date.now(),
          updated_at: Date.now(),
          active: true,
        },
      ];

      const mockToArray = vi.fn().mockResolvedValue(mockCharities);
      const mockEquals = vi.fn().mockReturnValue({
        toArray: mockToArray,
      });
      (db.charities.where as any).mockReturnValue({
        equals: mockEquals,
      });

      await getAllCharities({ status: 'pending' });

      expect(db.charities.where).toHaveBeenCalledWith('status');
      expect(mockEquals).toHaveBeenCalledWith('PENDING');
    });

    it('should filter by search term', async () => {
      const mockCharities: Charity[] = [
        {
          id: '1',
          name: 'Khan Academy',
          ein: '12-3456789',
          description: 'Education for all',
          category: 'EDUCATION',
          website: 'https://khanacademy.org',
          logo: null,
          status: 'VERIFIED',
          verification_notes: null,
          rejection_reason: null,
          created_by: 'admin-123',
          created_at: Date.now(),
          updated_at: Date.now(),
          active: true,
        },
        {
          id: '2',
          name: 'Other Charity',
          ein: '98-7654321',
          description: 'Other mission',
          category: 'HEALTH',
          website: 'https://other.org',
          logo: null,
          status: 'VERIFIED',
          verification_notes: null,
          rejection_reason: null,
          created_by: 'admin-123',
          created_at: Date.now(),
          updated_at: Date.now(),
          active: true,
        },
      ];

      const mockToArray = vi.fn().mockResolvedValue(mockCharities);
      (db.charities.toCollection as any).mockReturnValue({
        toArray: mockToArray,
      });

      const result = await getAllCharities({ searchTerm: 'Khan' });

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Khan Academy');
    });
  });

  describe('getVerifiedCharities', () => {
    it('should return only verified charities', async () => {
      const mockCharities: Charity[] = [
        {
          id: '1',
          name: 'Verified Charity',
          ein: '12-3456789',
          description: 'Test',
          category: 'EDUCATION',
          website: 'https://charity.org',
          logo: null,
          status: 'VERIFIED',
          verification_notes: null,
          rejection_reason: null,
          created_by: 'admin-123',
          created_at: Date.now(),
          updated_at: Date.now(),
          active: true,
        },
      ];

      const mockToArray = vi.fn().mockResolvedValue(mockCharities);
      const mockEquals = vi.fn().mockReturnValue({
        toArray: mockToArray,
      });
      (db.charities.where as any).mockReturnValue({
        equals: mockEquals,
      });

      const result = await getVerifiedCharities();

      expect(db.charities.where).toHaveBeenCalledWith('status');
      expect(mockEquals).toHaveBeenCalledWith('VERIFIED');
      expect(result).toEqual(mockCharities);
    });
  });

  describe('addVerificationNote', () => {
    it('should add a timestamped note to charity', async () => {
      const mockCharity: Charity = {
        id: 'charity-1',
        name: 'Test Charity',
        ein: '12-3456789',
        description: 'Test',
        category: 'EDUCATION',
        website: 'https://testcharity.org',
        logo: null,
        status: 'PENDING',
        verification_notes: null,
        rejection_reason: null,
        created_by: 'admin-123',
        created_at: Date.now(),
        updated_at: Date.now(),
        active: true,
      };

      (db.charities.get as any).mockResolvedValue(mockCharity);
      (db.charities.update as any).mockResolvedValue(1);

      await addVerificationNote({
        charityId: 'charity-1',
        note: 'Verified via IRS EOS. Status: Active PC.',
      });

      expect(db.charities.update).toHaveBeenCalledWith(
        'charity-1',
        expect.objectContaining({
          verification_notes: expect.stringContaining('Verified via IRS EOS'),
        })
      );
    });

    it('should append to existing notes', async () => {
      const mockCharity: Charity = {
        id: 'charity-1',
        name: 'Test Charity',
        ein: '12-3456789',
        description: 'Test',
        category: 'EDUCATION',
        website: 'https://testcharity.org',
        logo: null,
        status: 'PENDING',
        verification_notes: 'Existing note',
        rejection_reason: null,
        created_by: 'admin-123',
        created_at: Date.now(),
        updated_at: Date.now(),
        active: true,
      };

      (db.charities.get as any).mockResolvedValue(mockCharity);
      (db.charities.update as any).mockResolvedValue(1);

      await addVerificationNote({
        charityId: 'charity-1',
        note: 'New note',
      });

      expect(db.charities.update).toHaveBeenCalledWith(
        'charity-1',
        expect.objectContaining({
          verification_notes: expect.stringContaining('Existing note'),
        })
      );
    });
  });

  describe('verifyCharity', () => {
    it('should change status from PENDING to VERIFIED', async () => {
      const mockCharity: Charity = {
        id: 'charity-1',
        name: 'Test Charity',
        ein: '12-3456789',
        description: 'Test',
        category: 'EDUCATION',
        website: 'https://testcharity.org',
        logo: null,
        status: 'PENDING',
        verification_notes: 'IRS verified',
        rejection_reason: null,
        created_by: 'admin-123',
        created_at: Date.now(),
        updated_at: Date.now(),
        active: true,
      };

      (db.charities.get as any).mockResolvedValue(mockCharity);
      (db.charities.update as any).mockResolvedValue(1);

      await verifyCharity({
        charityId: 'charity-1',
        verifiedBy: 'admin-456',
      });

      expect(db.charities.update).toHaveBeenCalledWith(
        'charity-1',
        expect.objectContaining({
          status: 'VERIFIED',
          verification_notes: expect.stringContaining('Verified by admin user admin-456'),
        })
      );
    });

    it('should reject verification if status is not PENDING', async () => {
      const mockCharity: Charity = {
        id: 'charity-1',
        name: 'Test Charity',
        ein: '12-3456789',
        description: 'Test',
        category: 'EDUCATION',
        website: 'https://testcharity.org',
        logo: null,
        status: 'VERIFIED',
        verification_notes: null,
        rejection_reason: null,
        created_by: 'admin-123',
        created_at: Date.now(),
        updated_at: Date.now(),
        active: true,
      };

      (db.charities.get as any).mockResolvedValue(mockCharity);

      await expect(
        verifyCharity({
          charityId: 'charity-1',
          verifiedBy: 'admin-456',
        })
      ).rejects.toThrow('Cannot verify charity with status: VERIFIED');
    });
  });

  describe('rejectCharity', () => {
    it('should change status from PENDING to REJECTED with reason', async () => {
      const mockCharity: Charity = {
        id: 'charity-1',
        name: 'Test Charity',
        ein: '12-3456789',
        description: 'Test',
        category: 'EDUCATION',
        website: 'https://testcharity.org',
        logo: null,
        status: 'PENDING',
        verification_notes: null,
        rejection_reason: null,
        created_by: 'admin-123',
        created_at: Date.now(),
        updated_at: Date.now(),
        active: true,
      };

      (db.charities.get as any).mockResolvedValue(mockCharity);
      (db.charities.update as any).mockResolvedValue(1);

      await rejectCharity({
        charityId: 'charity-1',
        reason: 'Invalid EIN on IRS database',
        rejectedBy: 'admin-456',
      });

      expect(db.charities.update).toHaveBeenCalledWith(
        'charity-1',
        expect.objectContaining({
          status: 'REJECTED',
          rejection_reason: 'Invalid EIN on IRS database',
          verification_notes: expect.stringContaining('Invalid EIN on IRS database'),
        })
      );
    });

    it('should reject rejection if status is not PENDING', async () => {
      const mockCharity: Charity = {
        id: 'charity-1',
        name: 'Test Charity',
        ein: '12-3456789',
        description: 'Test',
        category: 'EDUCATION',
        website: 'https://testcharity.org',
        logo: null,
        status: 'REJECTED',
        verification_notes: null,
        rejection_reason: null,
        created_by: 'admin-123',
        created_at: Date.now(),
        updated_at: Date.now(),
        active: true,
      };

      (db.charities.get as any).mockResolvedValue(mockCharity);

      await expect(
        rejectCharity({
          charityId: 'charity-1',
          reason: 'Invalid',
          rejectedBy: 'admin-456',
        })
      ).rejects.toThrow('Cannot reject charity with status: REJECTED');
    });
  });

  describe('removeCharity', () => {
    it('should mark charity as INACTIVE', async () => {
      const mockCharity: Charity = {
        id: 'charity-1',
        name: 'Test Charity',
        ein: '12-3456789',
        description: 'Test',
        category: 'EDUCATION',
        website: 'https://testcharity.org',
        logo: null,
        status: 'VERIFIED',
        verification_notes: null,
        rejection_reason: null,
        created_by: 'admin-123',
        created_at: Date.now(),
        updated_at: Date.now(),
        active: true,
      };

      (db.charities.get as any).mockResolvedValue(mockCharity);
      (db.charities.update as any).mockResolvedValue(1);

      await removeCharity('charity-1');

      expect(db.charities.update).toHaveBeenCalledWith(
        'charity-1',
        expect.objectContaining({
          status: 'INACTIVE',
          active: false,
        })
      );
    });
  });

  describe('getCharityStatistics', () => {
    it('should return statistics grouped by status', async () => {
      const mockCharities: Charity[] = [
        {
          id: '1',
          name: 'Verified 1',
          ein: '12-3456789',
          description: 'Test',
          category: 'EDUCATION',
          website: 'https://charity1.org',
          logo: null,
          status: 'VERIFIED',
          verification_notes: null,
          rejection_reason: null,
          created_by: 'admin-123',
          created_at: Date.now(),
          updated_at: Date.now(),
          active: true,
        },
        {
          id: '2',
          name: 'Verified 2',
          ein: '23-4567890',
          description: 'Test',
          category: 'HEALTH',
          website: 'https://charity2.org',
          logo: null,
          status: 'VERIFIED',
          verification_notes: null,
          rejection_reason: null,
          created_by: 'admin-123',
          created_at: Date.now(),
          updated_at: Date.now(),
          active: true,
        },
        {
          id: '3',
          name: 'Pending 1',
          ein: '34-5678901',
          description: 'Test',
          category: 'environment',
          website: 'https://charity3.org',
          logo: null,
          status: 'PENDING',
          verification_notes: null,
          rejection_reason: null,
          created_by: 'admin-123',
          created_at: Date.now(),
          updated_at: Date.now(),
          active: true,
        },
      ];

      (db.charities.toArray as any).mockResolvedValue(mockCharities);

      const result = await getCharityStatistics();

      expect(result).toEqual({
        total: 3,
        verified: 2,
        pending: 1,
        rejected: 0,
        inactive: 0,
      });
    });
  });

  describe('validateEINFormat', () => {
    it('should validate correct EIN format', () => {
      expect(validateEINFormat('12-3456789')).toEqual({ valid: true });
    });

    it('should reject invalid EIN formats', () => {
      expect(validateEINFormat('123456789')).toEqual({
        valid: false,
        error: 'EIN must be in format XX-XXXXXXX (e.g., 12-3456789)',
      });

      expect(validateEINFormat('12-345678')).toEqual({
        valid: false,
        error: 'EIN must be in format XX-XXXXXXX (e.g., 12-3456789)',
      });

      expect(validateEINFormat('')).toEqual({
        valid: false,
        error: 'EIN is required',
      });
    });
  });
});
