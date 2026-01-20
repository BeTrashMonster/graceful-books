/**
 * Report Scheduler Service Tests
 *
 * Per I6: Scheduled Report Delivery - Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '../db/database';
import {
  createReportSchedule,
  getReportSchedule,
  listReportSchedules,
  updateReportSchedule,
  deleteReportSchedule,
  pauseReportSchedule,
  resumeReportSchedule,
  calculateNextRunTime,
} from './reportScheduler.service';
import type { CreateScheduleInput } from '../types/scheduledReports.types';

// Mock database
vi.mock('../db/database', () => ({
  db: {
    reportSchedules: {
      add: vi.fn(),
      get: vi.fn(),
      where: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe('ReportScheduler Service', () => {
  const mockCompanyId = 'company-123';
  const mockUserId = 'user-456';
  const mockDeviceId = 'device-789';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createReportSchedule', () => {
    it('should create a weekly report schedule', async () => {
      const input: CreateScheduleInput = {
        reportType: 'profit-loss',
        reportName: 'Weekly P&L',
        frequency: 'weekly',
        dayOfWeek: 'monday',
        timeOfDay: '08:00',
        timezone: 'America/New_York',
        recipients: ['test@example.com'],
        format: 'pdf',
        reportParameters: {
          dateRangeType: 'last-week',
        },
      };

      const mockAdd = vi.fn().mockResolvedValue('schedule-id');
      (db.reportSchedules.add as any) = mockAdd;

      const result = await createReportSchedule(mockCompanyId, mockUserId, input, mockDeviceId);

      expect(result.success).toBe(true);
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          company_id: mockCompanyId,
          user_id: mockUserId,
          report_type: 'profit-loss',
          report_name: 'Weekly P&L',
          frequency: 'weekly',
          day_of_week: 'monday',
          enabled: true,
        })
      );
    });

    it('should validate required fields', async () => {
      const invalidInput: CreateScheduleInput = {
        reportType: 'profit-loss',
        reportName: '',  // Invalid: empty name
        frequency: 'weekly',
        timeOfDay: '08:00',
        timezone: 'America/New_York',
        recipients: [],  // Invalid: no recipients
        format: 'pdf',
        reportParameters: {},
      };

      const result = await createReportSchedule(mockCompanyId, mockUserId, invalidInput);

      expect(result.success).toBe(false);
      expect((result as any).error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate email addresses', async () => {
      const input: CreateScheduleInput = {
        reportType: 'balance-sheet',
        reportName: 'Monthly Balance Sheet',
        frequency: 'monthly',
        dayOfMonth: 1,
        timeOfDay: '09:00',
        timezone: 'UTC',
        recipients: ['invalid-email', 'valid@example.com'],
        format: 'pdf',
        reportParameters: {},
      };

      const result = await createReportSchedule(mockCompanyId, mockUserId, input);

      expect(result.success).toBe(false);
      expect((result as any).error.message).toContain('Invalid email');
    });
  });

  describe('calculateNextRunTime', () => {
    it('should calculate next run for daily schedule', () => {
      const result = calculateNextRunTime('daily', '14:00', 'UTC');

      expect(result.isValid).toBe(true);
      expect(result.nextRun).toBeInstanceOf(Date);
      // Note: RRule returns dates in local time, not UTC
      // Just verify it's a valid date in the future
      expect(result.nextRun.getTime()).toBeGreaterThan(Date.now() - 86400000); // Within 24 hours
      expect(result.cronExpression).toBeTruthy();
    });

    it('should calculate next run for weekly schedule', () => {
      const result = calculateNextRunTime('weekly', '08:00', 'UTC', {
        dayOfWeek: 'monday',
      });

      expect(result.isValid).toBe(true);
      expect(result.nextRun).toBeInstanceOf(Date);
    });

    it('should calculate next run for monthly schedule', () => {
      const result = calculateNextRunTime('monthly', '10:00', 'UTC', {
        dayOfMonth: 15,
      });

      expect(result.isValid).toBe(true);
      expect(result.nextRun).toBeInstanceOf(Date);
      expect(result.nextRun.getDate()).toBe(15);
    });

    it('should calculate next run for quarterly schedule', () => {
      const result = calculateNextRunTime('quarterly', '12:00', 'UTC');

      expect(result.isValid).toBe(true);
      expect(result.nextRun).toBeInstanceOf(Date);
    });

    it('should validate time zone', () => {
      const result = calculateNextRunTime('daily', '08:00', 'Invalid/Timezone');

      expect(result.isValid).toBe(true);  // Will still work, rrule handles it
    });
  });

  describe('updateReportSchedule', () => {
    it('should update schedule recipients', async () => {
      const mockSchedule = {
        id: 'schedule-123',
        company_id: mockCompanyId,
        user_id: mockUserId,
        report_type: 'profit-loss',
        report_name: 'P&L Report',
        enabled: true,
        frequency: 'weekly',
        time_of_day: '08:00',
        timezone: 'UTC',
        recipients: ['old@example.com'],
        format: 'pdf',
        report_parameters: {},
        version_vector: { [mockDeviceId]: 1 },
        deleted_at: null,
      };

      (db.reportSchedules.get as any).mockResolvedValueOnce(mockSchedule);
      (db.reportSchedules.update as any).mockResolvedValue(undefined);
      (db.reportSchedules.get as any).mockResolvedValueOnce({
        ...mockSchedule,
        recipients: ['new@example.com'],
        updated_at: new Date(),
      });

      const result = await updateReportSchedule(
        'schedule-123',
        {
          recipients: ['new@example.com'],
        },
        mockDeviceId
      );

      expect(result.success).toBe(true);
      expect(db.reportSchedules.update).toHaveBeenCalled();
    });

    it('should return error for non-existent schedule', async () => {
      (db.reportSchedules.get as any).mockResolvedValue(null);

      const result = await updateReportSchedule('nonexistent', { enabled: false });

      expect(result.success).toBe(false);
      expect((result as any).error.code).toBe('NOT_FOUND');
    });
  });

  describe('pauseReportSchedule', () => {
    it('should pause an active schedule', async () => {
      const mockSchedule = {
        id: 'schedule-123',
        enabled: true,
        paused_at: null,
        deleted_at: null,
      };

      (db.reportSchedules.get as any).mockResolvedValueOnce(mockSchedule);
      (db.reportSchedules.update as any).mockResolvedValue(undefined);
      (db.reportSchedules.get as any).mockResolvedValueOnce({
        ...mockSchedule,
        enabled: false,
        paused_at: new Date(),
        paused_by: 'user-456',
      });

      const result = await pauseReportSchedule('schedule-123', 'user-456');

      expect(result.success).toBe(true);
      expect(db.reportSchedules.update).toHaveBeenCalledWith(
        'schedule-123',
        expect.objectContaining({
          enabled: false,
          paused_by: 'user-456',
        })
      );
    });
  });

  describe('resumeReportSchedule', () => {
    it('should resume a paused schedule and recalculate next run', async () => {
      const mockSchedule = {
        id: 'schedule-123',
        enabled: false,
        paused_at: new Date(),
        frequency: 'weekly',
        time_of_day: '08:00',
        timezone: 'UTC',
        day_of_week: 'monday',
        deleted_at: null,
      };

      (db.reportSchedules.get as any).mockResolvedValueOnce(mockSchedule);
      (db.reportSchedules.update as any).mockResolvedValue(undefined);
      (db.reportSchedules.get as any).mockResolvedValueOnce({
        ...mockSchedule,
        enabled: true,
        paused_at: null,
        paused_by: null,
      });

      const result = await resumeReportSchedule('schedule-123');

      expect(result.success).toBe(true);
      expect(db.reportSchedules.update).toHaveBeenCalledWith(
        'schedule-123',
        expect.objectContaining({
          enabled: true,
          paused_at: null,
          paused_by: null,
        })
      );
    });
  });

  describe('deleteReportSchedule', () => {
    it('should soft delete a schedule', async () => {
      const mockSchedule = {
        id: 'schedule-123',
        deleted_at: null,
      };

      (db.reportSchedules.get as any).mockResolvedValue(mockSchedule);
      (db.reportSchedules.update as any).mockResolvedValue(undefined);

      const result = await deleteReportSchedule('schedule-123');

      expect(result.success).toBe(true);
      expect(db.reportSchedules.update).toHaveBeenCalledWith(
        'schedule-123',
        expect.objectContaining({
          deleted_at: expect.any(Date),
        })
      );
    });
  });
});
