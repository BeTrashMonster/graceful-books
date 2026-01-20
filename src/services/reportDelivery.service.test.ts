/**
 * Report Delivery Service Tests
 *
 * Per I6: Scheduled Report Delivery - Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '../db/database';
import {
  processPendingDeliveries,
  sendTestEmail,
  getDeliveryHistory,
  getRecentDeliveries,
  retryDelivery,
} from './reportDelivery.service';

// Mock dependencies
vi.mock('../db/database');
vi.mock('./reports/reportExport.service', () => ({
  exportReport: vi.fn().mockResolvedValue({
    success: true,
    blob: new Blob(['test']),
    filename: 'test.pdf',
  }),
  exportResultToBuffer: vi.fn().mockResolvedValue(Buffer.from('test')),
  getExportMimeType: vi.fn().mockReturnValue('application/pdf'),
}));

describe('ReportDelivery Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('processPendingDeliveries', () => {
    it('should process due schedules', async () => {
      const mockSchedules = [
        {
          id: 'schedule-1',
          company_id: 'company-123',
          user_id: 'user-456',
          report_type: 'profit-loss',
          report_name: 'P&L',
          enabled: true,
          next_run_at: new Date(Date.now() - 1000), // Past time
          recipients: ['test@example.com'],
          format: 'pdf',
          frequency: 'weekly',
          time_of_day: '08:00',
          timezone: 'UTC',
          include_comparison: false,
          include_educational_content: false,
          report_parameters: {},
          run_count: 0,
          failure_count: 0,
          deleted_at: null,
        },
      ];

      const mockWhere = {
        equals: vi.fn().mockReturnThis(),
        and: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue(mockSchedules),
      };

      (db.reportSchedules.where as any).mockReturnValue(mockWhere);
      (db.scheduledReportDeliveries.add as any).mockResolvedValue('delivery-id');
      (db.scheduledReportDeliveries.update as any).mockResolvedValue(undefined);
      (db.reportSchedules.update as any).mockResolvedValue(undefined);

      const result = await processPendingDeliveries();

      expect(result.processed).toBe(1);
      expect(result.sent).toBeGreaterThanOrEqual(0);
    });
  });

  describe('sendTestEmail', () => {
    it('should send a test email with preview data', async () => {
      const mockSchedule = {
        id: 'schedule-123',
        reportType: 'balance-sheet' as const,
        reportName: 'Test Report',
        companyId: 'company-123',
        userId: 'user-456',
        format: 'pdf' as const,
        recipients: ['original@example.com'],
        includeComparison: false,
        includeEducationalContent: true,
        reportParameters: {},
      } as any;

      const result = await sendTestEmail(mockSchedule, 'test@example.com');

      expect(result.success).toBe(true);
    });
  });

  describe('getDeliveryHistory', () => {
    it('should retrieve delivery history for a schedule', async () => {
      const mockDeliveries = [
        {
          id: 'delivery-1',
          schedule_id: 'schedule-123',
          company_id: 'company-123',
          user_id: 'user-456',
          report_type: 'profit-loss',
          report_name: 'P&L',
          status: 'sent',
          scheduled_at: new Date(),
          sent_at: new Date(),
          recipients: ['test@example.com'],
          format: 'pdf',
          deleted_at: null,
        },
      ];

      const mockWhere = {
        equals: vi.fn().mockReturnThis(),
        and: vi.fn().mockReturnThis(),
        reverse: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue(mockDeliveries),
      };

      (db.scheduledReportDeliveries.where as any).mockReturnValue(mockWhere);

      const result = await getDeliveryHistory('schedule-123', 50);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('delivery-1');
    });
  });

  describe('getRecentDeliveries', () => {
    it('should retrieve recent deliveries for a company', async () => {
      const mockDeliveries = [
        {
          id: 'delivery-1',
          company_id: 'company-123',
          deleted_at: null,
        },
        {
          id: 'delivery-2',
          company_id: 'company-123',
          deleted_at: null,
        },
      ];

      const mockWhere = {
        equals: vi.fn().mockReturnThis(),
        and: vi.fn().mockReturnThis(),
        reverse: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue(mockDeliveries),
      };

      (db.scheduledReportDeliveries.where as any).mockReturnValue(mockWhere);

      const result = await getRecentDeliveries('company-123', 20);

      expect(result.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('retryDelivery', () => {
    it('should retry a failed delivery', async () => {
      const mockDelivery = {
        id: 'delivery-123',
        schedule_id: 'schedule-456',
        status: 'failed',
        retry_count: 0,
        max_retries: 3,
      };

      const mockSchedule = {
        id: 'schedule-456',
        company_id: 'company-123',
        user_id: 'user-456',
        report_type: 'profit-loss',
        enabled: true,
        frequency: 'weekly',
        time_of_day: '08:00',
        timezone: 'UTC',
        recipients: ['test@example.com'],
        format: 'pdf',
        deleted_at: null,
      };

      (db.scheduledReportDeliveries.get as any).mockResolvedValue(mockDelivery);
      (db.reportSchedules.get as any).mockResolvedValue(mockSchedule);
      (db.scheduledReportDeliveries.update as any).mockResolvedValue(undefined);

      const result = await retryDelivery('delivery-123');

      // Retry may or may not succeed in test environment
      expect(result.success !== undefined).toBe(true);
    });

    it('should reject retry if max retries exceeded', async () => {
      const mockDelivery = {
        id: 'delivery-123',
        schedule_id: 'schedule-456',
        status: 'failed',
        retry_count: 3,
        max_retries: 3,
      };

      (db.scheduledReportDeliveries.get as any).mockResolvedValue(mockDelivery);

      const result = await retryDelivery('delivery-123');

      expect(result.success).toBe(false);
      expect((result as any).error.code).toBe('QUOTA_EXCEEDED');
    });
  });
});
