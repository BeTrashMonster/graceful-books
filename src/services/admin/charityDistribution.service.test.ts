/**
 * Charity Distribution Service Tests
 *
 * Comprehensive tests for IC2.5 charity distribution service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '../../db';
import {
  calculateMonthlyContributions,
  generateMonthlyReport,
  exportReportToCSV,
  createDistributionRecords,
  markPaymentSent,
  confirmPayment,
  getUnpaidDistributions,
  reconcileContributions,
} from './charityDistribution.service';
import type { CharityDistribution } from '../../types/billing.types';
import type { Subscription } from '../../types/billing.types';
import type { Charity } from '../../types/database.types';
import type { User } from '../../types/database.types';
import { PRICING } from '../../types/billing.types';
import { CharityStatus } from '../../types/database.types';

// Mock database
vi.mock('../../db', () => ({
  db: {
    subscriptions: {
      filter: vi.fn(),
      where: vi.fn(),
      toArray: vi.fn(),
    },
    charities: {
      toArray: vi.fn(),
      get: vi.fn(),
    },
    users: {
      toArray: vi.fn(),
      get: vi.fn(),
    },
    charityDistributions: {
      where: vi.fn(),
      filter: vi.fn(),
      toArray: vi.fn(),
      add: vi.fn(),
      update: vi.fn(),
      get: vi.fn(),
    },
  },
}));

describe('CharityDistributionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateMonthlyContributions', () => {
    it('should calculate total contributions per charity for a month', async () => {
      const mockSubscriptions: Partial<Subscription>[] = [
        {
          id: 'sub-1',
          user_id: 'user-1',
          status: 'active',
          created_at: new Date('2026-01-01').getTime(),
          canceled_at: null,
          deleted_at: null,
        },
        {
          id: 'sub-2',
          user_id: 'user-2',
          status: 'active',
          created_at: new Date('2026-01-01').getTime(),
          canceled_at: null,
          deleted_at: null,
        },
      ];

      const mockCharities: Partial<Charity>[] = [
        {
          id: 'charity-1',
          name: 'Khan Academy',
          ein: '12-3456789',
          status: CharityStatus.VERIFIED,
          website: 'https://khanacademy.org',
          payment_address: '123 Main St',
        },
        {
          id: 'charity-2',
          name: 'GiveDirectly',
          ein: '98-7654321',
          status: CharityStatus.VERIFIED,
          website: 'https://givedirectly.org',
          payment_address: '456 Elm St',
        },
      ];

      const mockUsers: Partial<User>[] = [
        {
          id: 'user-1',
          selected_charity_id: 'charity-1',
        },
        {
          id: 'user-2',
          selected_charity_id: 'charity-2',
        },
      ];

      vi.mocked(db.subscriptions.filter).mockReturnValue({
        toArray: vi.fn().mockResolvedValue(mockSubscriptions),
      } as any);

      vi.mocked(db.charities.toArray).mockResolvedValue(mockCharities as Charity[]);
      vi.mocked(db.users.toArray).mockResolvedValue(mockUsers as User[]);

      const result = await calculateMonthlyContributions('2026-01');

      expect(result).toHaveLength(2);
      expect(result[0]!.charity_id).toBe('charity-1');
      expect(result[0]!.charity_name).toBe('Khan Academy');
      expect(result[0]!.total_amount).toBe(PRICING.CHARITY_CONTRIBUTION);
      expect(result[0]!.contributor_count).toBe(1);
    });

    it('should handle month with no contributions', async () => {
      vi.mocked(db.subscriptions.filter).mockReturnValue({
        toArray: vi.fn().mockResolvedValue([]),
      } as any);

      vi.mocked(db.charities.toArray).mockResolvedValue([]);
      vi.mocked(db.users.toArray).mockResolvedValue([]);

      const result = await calculateMonthlyContributions('2026-01');

      expect(result).toHaveLength(0);
    });

    it('should only include verified charities', async () => {
      const mockSubscriptions: Partial<Subscription>[] = [
        {
          id: 'sub-1',
          user_id: 'user-1',
          status: 'active',
          created_at: new Date('2026-01-01').getTime(),
          canceled_at: null,
          deleted_at: null,
        },
      ];

      const mockCharities: Partial<Charity>[] = [
        {
          id: 'charity-1',
          name: 'Pending Charity',
          ein: '12-3456789',
          status: CharityStatus.PENDING,
          website: 'https://example.org',
          payment_address: '123 Main St',
        },
      ];

      const mockUsers: Partial<User>[] = [
        {
          id: 'user-1',
          selected_charity_id: 'charity-1',
        },
      ];

      vi.mocked(db.subscriptions.filter).mockReturnValue({
        toArray: vi.fn().mockResolvedValue(mockSubscriptions),
      } as any);

      vi.mocked(db.charities.toArray).mockResolvedValue(mockCharities as Charity[]);
      vi.mocked(db.users.toArray).mockResolvedValue(mockUsers as User[]);

      const result = await calculateMonthlyContributions('2026-01');

      expect(result).toHaveLength(0);
    });

    it('should group multiple users contributing to same charity', async () => {
      const mockSubscriptions: Partial<Subscription>[] = [
        {
          id: 'sub-1',
          user_id: 'user-1',
          status: 'active',
          created_at: new Date('2026-01-01').getTime(),
          canceled_at: null,
          deleted_at: null,
        },
        {
          id: 'sub-2',
          user_id: 'user-2',
          status: 'active',
          created_at: new Date('2026-01-01').getTime(),
          canceled_at: null,
          deleted_at: null,
        },
      ];

      const mockCharities: Partial<Charity>[] = [
        {
          id: 'charity-1',
          name: 'Khan Academy',
          ein: '12-3456789',
          status: CharityStatus.VERIFIED,
          website: 'https://khanacademy.org',
          payment_address: '123 Main St',
        },
      ];

      const mockUsers: Partial<User>[] = [
        {
          id: 'user-1',
          selected_charity_id: 'charity-1',
        },
        {
          id: 'user-2',
          selected_charity_id: 'charity-1',
        },
      ];

      vi.mocked(db.subscriptions.filter).mockReturnValue({
        toArray: vi.fn().mockResolvedValue(mockSubscriptions),
      } as any);

      vi.mocked(db.charities.toArray).mockResolvedValue(mockCharities as Charity[]);
      vi.mocked(db.users.toArray).mockResolvedValue(mockUsers as User[]);

      const result = await calculateMonthlyContributions('2026-01');

      expect(result).toHaveLength(1);
      expect(result[0]!.total_amount).toBe(PRICING.CHARITY_CONTRIBUTION * 2);
      expect(result[0]!.contributor_count).toBe(2);
    });
  });

  describe('generateMonthlyReport', () => {
    it('should generate complete monthly report', async () => {
      vi.mocked(db.subscriptions.filter).mockReturnValue({
        toArray: vi.fn().mockResolvedValue([
          {
            id: 'sub-1',
            user_id: 'user-1',
            status: 'active',
            created_at: new Date('2026-01-01').getTime(),
            canceled_at: null,
            deleted_at: null,
          },
        ]),
      } as any);

      vi.mocked(db.charities.toArray).mockResolvedValue([
        {
          id: 'charity-1',
          name: 'Khan Academy',
          ein: '12-3456789',
          status: CharityStatus.VERIFIED,
          website: 'https://khanacademy.org',
          payment_address: '123 Main St',
        },
      ] as Charity[]);

      vi.mocked(db.users.toArray).mockResolvedValue([
        {
          id: 'user-1',
          selected_charity_id: 'charity-1',
        },
      ] as User[]);

      const report = await generateMonthlyReport('2026-01');

      expect(report.month).toBe('2026-01');
      expect(report.charity_count).toBeGreaterThan(0);
      expect(report.total_amount).toBeGreaterThan(0);
      expect(report.contributions).toBeDefined();
      expect(report.generated_at).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('exportReportToCSV', () => {
    it('should export report to CSV format', () => {
      const report = {
        month: '2026-01',
        generated_at: Date.now(),
        total_amount: 1000,
        charity_count: 1,
        contributions: [
          {
            charity_id: 'charity-1',
            charity_name: 'Khan Academy',
            charity_ein: '12-3456789',
            total_amount: 1000,
            contributor_count: 2,
            payment_address: '123 Main St',
            website: 'https://khanacademy.org',
          },
        ],
      };

      const csv = exportReportToCSV(report);

      expect(csv).toContain('Charity Name');
      expect(csv).toContain('EIN');
      expect(csv).toContain('Khan Academy');
      expect(csv).toContain('12-3456789');
      expect(csv).toContain('10.00');
    });

    it('should handle payment address being null', () => {
      const report = {
        month: '2026-01',
        generated_at: Date.now(),
        total_amount: 500,
        charity_count: 1,
        contributions: [
          {
            charity_id: 'charity-1',
            charity_name: 'Test Charity',
            charity_ein: '11-1111111',
            total_amount: 500,
            contributor_count: 1,
            payment_address: null,
            website: 'https://test.org',
          },
        ],
      };

      const csv = exportReportToCSV(report);

      expect(csv).toContain('N/A');
    });
  });

  describe('createDistributionRecords', () => {
    it('should create new distribution records', async () => {
      const mockSubscriptions: Partial<Subscription>[] = [
        {
          id: 'sub-1',
          user_id: 'user-1',
          status: 'active',
          created_at: new Date('2026-01-01').getTime(),
          canceled_at: null,
          deleted_at: null,
        },
      ];

      const mockCharities: Partial<Charity>[] = [
        {
          id: 'charity-1',
          name: 'Khan Academy',
          ein: '12-3456789',
          status: CharityStatus.VERIFIED,
          website: 'https://khanacademy.org',
          payment_address: '123 Main St',
        },
      ];

      const mockUsers: Partial<User>[] = [
        {
          id: 'user-1',
          selected_charity_id: 'charity-1',
        },
      ];

      vi.mocked(db.subscriptions.filter).mockReturnValue({
        toArray: vi.fn().mockResolvedValue(mockSubscriptions),
      } as any);

      vi.mocked(db.charities.toArray).mockResolvedValue(mockCharities as Charity[]);
      vi.mocked(db.users.toArray).mockResolvedValue(mockUsers as User[]);

      vi.mocked(db.charityDistributions.where).mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      vi.mocked(db.charityDistributions.add).mockResolvedValue('dist-1');

      const records = await createDistributionRecords('2026-01');

      expect(records.length).toBeGreaterThan(0);
      expect(db.charityDistributions.add).toHaveBeenCalled();
    });

    it('should update existing distribution records', async () => {
      const mockSubscriptions: Partial<Subscription>[] = [
        {
          id: 'sub-1',
          user_id: 'user-1',
          status: 'active',
          created_at: new Date('2026-01-01').getTime(),
          canceled_at: null,
          deleted_at: null,
        },
      ];

      const mockCharities: Partial<Charity>[] = [
        {
          id: 'charity-1',
          name: 'Khan Academy',
          ein: '12-3456789',
          status: CharityStatus.VERIFIED,
          website: 'https://khanacademy.org',
          payment_address: '123 Main St',
        },
      ];

      const mockUsers: Partial<User>[] = [
        {
          id: 'user-1',
          selected_charity_id: 'charity-1',
        },
      ];

      const existingDistribution: Partial<CharityDistribution> = {
        id: 'dist-1',
        month: '2026-01',
        charity_id: 'charity-1',
        charity_name: 'Khan Academy',
        charity_ein: '12-3456789',
        total_amount: 500,
        contributor_count: 1,
        status: 'pending',
        payment_method: null,
        sent_at: null,
        confirmed_at: null,
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      vi.mocked(db.subscriptions.filter).mockReturnValue({
        toArray: vi.fn().mockResolvedValue(mockSubscriptions),
      } as any);

      vi.mocked(db.charities.toArray).mockResolvedValue(mockCharities as Charity[]);
      vi.mocked(db.users.toArray).mockResolvedValue(mockUsers as User[]);

      vi.mocked(db.charityDistributions.where).mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([existingDistribution]),
        }),
      } as any);

      vi.mocked(db.charityDistributions.update).mockResolvedValue(1);

      await createDistributionRecords('2026-01');

      expect(db.charityDistributions.update).toHaveBeenCalled();
    });
  });

  describe('markPaymentSent', () => {
    it('should mark payment as sent', async () => {
      const distribution: Partial<CharityDistribution> = {
        id: 'dist-1',
        month: '2026-01',
        charity_id: 'charity-1',
        charity_name: 'Khan Academy',
        charity_ein: '12-3456789',
        total_amount: 500,
        contributor_count: 1,
        status: 'pending',
        payment_method: null,
        sent_at: null,
        confirmed_at: null,
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      vi.mocked(db.charityDistributions.get).mockResolvedValue(
        distribution as CharityDistribution
      );
      vi.mocked(db.charityDistributions.update).mockResolvedValue(1);

      const result = await markPaymentSent({
        distributionId: 'dist-1',
        paymentMethod: 'ach',
        confirmationNumber: 'TXN-123',
        sentBy: 'admin-1',
      });

      expect(result.status).toBe('sent');
      expect(result.payment_method).toBe('ach');
      expect(result.sent_at).toBeTruthy();
      expect(db.charityDistributions.update).toHaveBeenCalledWith('dist-1', expect.any(Object));
    });

    it('should throw error if distribution not found', async () => {
      vi.mocked(db.charityDistributions.get).mockResolvedValue(undefined);

      await expect(
        markPaymentSent({
          distributionId: 'invalid-id',
          paymentMethod: 'ach',
          sentBy: 'admin-1',
        })
      ).rejects.toThrow('Distribution record not found');
    });

    it('should throw error if status is not pending', async () => {
      const distribution: Partial<CharityDistribution> = {
        id: 'dist-1',
        month: '2026-01',
        charity_id: 'charity-1',
        charity_name: 'Khan Academy',
        charity_ein: '12-3456789',
        total_amount: 500,
        contributor_count: 1,
        status: 'sent',
        payment_method: 'ach',
        sent_at: Date.now(),
        confirmed_at: null,
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      vi.mocked(db.charityDistributions.get).mockResolvedValue(
        distribution as CharityDistribution
      );

      await expect(
        markPaymentSent({
          distributionId: 'dist-1',
          paymentMethod: 'check',
          sentBy: 'admin-1',
        })
      ).rejects.toThrow('Cannot mark payment as sent');
    });
  });

  describe('confirmPayment', () => {
    it('should confirm payment', async () => {
      const distribution: Partial<CharityDistribution> = {
        id: 'dist-1',
        month: '2026-01',
        charity_id: 'charity-1',
        charity_name: 'Khan Academy',
        charity_ein: '12-3456789',
        total_amount: 500,
        contributor_count: 1,
        status: 'sent',
        payment_method: 'ach',
        sent_at: Date.now(),
        confirmed_at: null,
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      vi.mocked(db.charityDistributions.get).mockResolvedValue(
        distribution as CharityDistribution
      );
      vi.mocked(db.charityDistributions.update).mockResolvedValue(1);

      const result = await confirmPayment({
        distributionId: 'dist-1',
        confirmedBy: 'admin-1',
      });

      expect(result.status).toBe('confirmed');
      expect(result.confirmed_at).toBeTruthy();
      expect(db.charityDistributions.update).toHaveBeenCalled();
    });

    it('should throw error if status is not sent', async () => {
      const distribution: Partial<CharityDistribution> = {
        id: 'dist-1',
        month: '2026-01',
        charity_id: 'charity-1',
        charity_name: 'Khan Academy',
        charity_ein: '12-3456789',
        total_amount: 500,
        contributor_count: 1,
        status: 'pending',
        payment_method: null,
        sent_at: null,
        confirmed_at: null,
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      vi.mocked(db.charityDistributions.get).mockResolvedValue(
        distribution as CharityDistribution
      );

      await expect(
        confirmPayment({
          distributionId: 'dist-1',
          confirmedBy: 'admin-1',
        })
      ).rejects.toThrow('Cannot confirm payment');
    });
  });

  describe('getUnpaidDistributions', () => {
    it('should return overdue distributions', async () => {
      const fifteenDaysAgo = Date.now() - 16 * 24 * 60 * 60 * 1000;

      const overdueDistribution: Partial<CharityDistribution> = {
        id: 'dist-1',
        month: '2025-12',
        charity_id: 'charity-1',
        charity_name: 'Khan Academy',
        charity_ein: '12-3456789',
        total_amount: 500,
        contributor_count: 1,
        status: 'pending',
        payment_method: null,
        sent_at: null,
        confirmed_at: null,
        created_at: fifteenDaysAgo,
        updated_at: fifteenDaysAgo,
      };

      vi.mocked(db.charityDistributions.filter).mockReturnValue({
        toArray: vi.fn().mockResolvedValue([overdueDistribution]),
      } as any);

      const result = await getUnpaidDistributions();

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]!.status).toBe('pending');
    });
  });

  describe('reconcileContributions', () => {
    it('should verify contributions match distributions', async () => {
      const mockSubscriptions: Partial<Subscription>[] = [
        {
          id: 'sub-1',
          user_id: 'user-1',
          status: 'active',
          created_at: new Date('2026-01-01').getTime(),
          canceled_at: null,
          deleted_at: null,
        },
      ];

      const mockCharities: Partial<Charity>[] = [
        {
          id: 'charity-1',
          name: 'Khan Academy',
          ein: '12-3456789',
          status: CharityStatus.VERIFIED,
          website: 'https://khanacademy.org',
          payment_address: '123 Main St',
        },
      ];

      const mockUsers: Partial<User>[] = [
        {
          id: 'user-1',
          selected_charity_id: 'charity-1',
        },
      ];

      const mockDistributions: Partial<CharityDistribution>[] = [
        {
          id: 'dist-1',
          month: '2026-01',
          charity_id: 'charity-1',
          charity_name: 'Khan Academy',
          charity_ein: '12-3456789',
          total_amount: PRICING.CHARITY_CONTRIBUTION,
          contributor_count: 1,
          status: 'pending',
          payment_method: null,
          sent_at: null,
          confirmed_at: null,
          created_at: Date.now(),
          updated_at: Date.now(),
        },
      ];

      vi.mocked(db.subscriptions.filter).mockReturnValue({
        toArray: vi.fn().mockResolvedValue(mockSubscriptions),
      } as any);

      vi.mocked(db.charities.toArray).mockResolvedValue(mockCharities as Charity[]);
      vi.mocked(db.users.toArray).mockResolvedValue(mockUsers as User[]);

      vi.mocked(db.charityDistributions.where).mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue(mockDistributions),
        }),
      } as any);

      const result = await reconcileContributions('2026-01');

      expect(result.is_balanced).toBe(true);
      expect(result.difference).toBe(0);
    });
  });
});
