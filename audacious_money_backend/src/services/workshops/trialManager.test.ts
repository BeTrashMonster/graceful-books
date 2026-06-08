/**
 * Trial Manager Tests
 *
 * Tests for trial expiration and management logic
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { TrialExpirationSummary } from './trialManager.js';
import type { WorkshopEnrollmentRow, WorkshopRow } from '../../types/workshop.types.js';

// Mock database connection
const mockQuery = vi.fn();
const mockDb = {
  query: mockQuery,
};

vi.mock('../../db/connection.js', () => ({
  getDbConnection: () => mockDb,
}));

// Mock email service
const mockSendTrialExpirationEmail = vi.fn();
vi.mock('../email/workshopEmails.js', () => ({
  sendTrialExpirationEmail: mockSendTrialExpirationEmail,
}));

describe('Trial Manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('checkAndProcessExpiredTrials', () => {
    it('should return empty summary when no trials are expired', async () => {
      // Arrange
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      // Dynamically import to use mocked dependencies
      const { checkAndProcessExpiredTrials } = await import('./trialManager.js');

      // Act
      const result = await checkAndProcessExpiredTrials();

      // Assert
      expect(result.totalChecked).toBe(0);
      expect(result.totalExpired).toBe(0);
      expect(result.emailsSent).toBe(0);
      expect(result.emailsFailed).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should process expired trials with upgrade_prompt action', async () => {
      // Arrange
      const mockEnrollment: WorkshopEnrollmentRow = {
        id: 'enrollment-123',
        user_id: 'user-123',
        workshop_id: 'workshop-123',
        enrolled_at: new Date('2026-05-01'),
        first_login_at: new Date('2026-05-02'),
        trial_started_at: new Date('2026-05-05'),
        trial_expires_at: new Date('2026-06-01'),
        converted_to_paid_at: null,
        worksheet_completed_at: new Date('2026-05-01'),
        emails_sent: [],
        last_active_at: new Date('2026-06-07'),
        status: 'active',
        created_at: new Date('2026-05-01'),
        updated_at: new Date('2026-05-01'),
      };

      const mockWorkshop: WorkshopRow = {
        id: 'workshop-123',
        cohort_name: 'Spring 2026',
        slug: 'spring-2026',
        description: 'Test workshop',
        workshop_type: 'online',
        location: null,
        primary_timezone: 'America/Los_Angeles',
        secondary_timezone: null,
        access_grant_datetime: new Date('2026-05-05'),
        trial_start_datetime: new Date('2026-05-05'),
        trial_duration_days: 30,
        workshop_start_datetime: new Date('2026-05-10'),
        workshop_end_datetime: new Date('2026-05-10'),
        registration_deadline: null,
        max_enrollment: null,
        welcome_message: null,
        custom_email_templates: null,
        custom_email_schedule: null,
        post_workshop_resources: null,
        post_trial_action: 'upgrade_prompt',
        send_reminder: true,
        reminder_hours_before: 24,
        status: 'completed',
        created_by: 'admin-123',
        created_at: new Date('2026-04-01'),
        updated_at: new Date('2026-04-01'),
      };

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User',
      };

      // Mock queries
      mockQuery
        .mockResolvedValueOnce({ rows: [mockEnrollment], rowCount: 1 }) // Find expired trials
        .mockResolvedValueOnce({ rows: [mockWorkshop], rowCount: 1 }) // Get workshop
        .mockResolvedValueOnce({ rows: [mockUser], rowCount: 1 }) // Get user
        .mockResolvedValueOnce({ rows: [{ ...mockEnrollment, status: 'trial_expired' }], rowCount: 1 }); // Update enrollment

      mockSendTrialExpirationEmail.mockResolvedValueOnce(true);

      const { checkAndProcessExpiredTrials } = await import('./trialManager.js');

      // Act
      const result = await checkAndProcessExpiredTrials();

      // Assert
      expect(result.totalChecked).toBe(1);
      expect(result.totalExpired).toBe(1);
      expect(result.emailsSent).toBe(1);
      expect(result.emailsFailed).toBe(0);
      expect(result.errors).toHaveLength(0);

      // Verify email was sent
      expect(mockSendTrialExpirationEmail).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'test@example.com' }),
        expect.objectContaining({ cohort_name: 'Spring 2026' }),
        'upgrade_prompt'
      );

      // Verify enrollment status was updated
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE workshop_enrollments'),
        expect.arrayContaining(['trial_expired'])
      );
    });

    it('should handle email send failures gracefully', async () => {
      // Arrange
      const mockEnrollment: WorkshopEnrollmentRow = {
        id: 'enrollment-456',
        user_id: 'user-456',
        workshop_id: 'workshop-456',
        enrolled_at: new Date('2026-05-01'),
        first_login_at: new Date('2026-05-02'),
        trial_started_at: new Date('2026-05-05'),
        trial_expires_at: new Date('2026-06-01'),
        converted_to_paid_at: null,
        worksheet_completed_at: new Date('2026-05-01'),
        emails_sent: [],
        last_active_at: new Date('2026-06-07'),
        status: 'active',
        created_at: new Date('2026-05-01'),
        updated_at: new Date('2026-05-01'),
      };

      const mockWorkshop: WorkshopRow = {
        id: 'workshop-456',
        cohort_name: 'Summer 2026',
        slug: 'summer-2026',
        description: null,
        workshop_type: 'in_person',
        location: '123 Main St',
        primary_timezone: 'America/New_York',
        secondary_timezone: null,
        access_grant_datetime: new Date('2026-06-05'),
        trial_start_datetime: new Date('2026-06-05'),
        trial_duration_days: 30,
        workshop_start_datetime: new Date('2026-06-10'),
        workshop_end_datetime: new Date('2026-06-10'),
        registration_deadline: null,
        max_enrollment: 50,
        welcome_message: null,
        custom_email_templates: null,
        custom_email_schedule: null,
        post_workshop_resources: null,
        post_trial_action: 'account_freeze',
        send_reminder: true,
        reminder_hours_before: 48,
        status: 'completed',
        created_by: 'admin-456',
        created_at: new Date('2026-05-01'),
        updated_at: new Date('2026-05-01'),
      };

      const mockUser = {
        id: 'user-456',
        email: 'test2@example.com',
        first_name: 'Test2',
        last_name: 'User2',
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [mockEnrollment], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [mockWorkshop], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [mockUser], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ ...mockEnrollment, status: 'trial_expired' }], rowCount: 1 });

      mockSendTrialExpirationEmail.mockRejectedValueOnce(new Error('Email service unavailable'));

      const { checkAndProcessExpiredTrials } = await import('./trialManager.js');

      // Act
      const result = await checkAndProcessExpiredTrials();

      // Assert
      expect(result.totalChecked).toBe(1);
      expect(result.totalExpired).toBe(1);
      expect(result.emailsSent).toBe(0);
      expect(result.emailsFailed).toBe(1);
      // Status should still be updated even if email fails
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE workshop_enrollments'),
        expect.arrayContaining(['trial_expired'])
      );
    });

    it('should process multiple expired trials', async () => {
      // Arrange
      const mockEnrollments: WorkshopEnrollmentRow[] = [
        {
          id: 'enrollment-1',
          user_id: 'user-1',
          workshop_id: 'workshop-1',
          enrolled_at: new Date('2026-04-01'),
          first_login_at: new Date('2026-04-02'),
          trial_started_at: new Date('2026-04-05'),
          trial_expires_at: new Date('2026-05-01'),
          converted_to_paid_at: null,
          worksheet_completed_at: new Date('2026-04-01'),
          emails_sent: [],
          last_active_at: new Date('2026-06-07'),
          status: 'active',
          created_at: new Date('2026-04-01'),
          updated_at: new Date('2026-04-01'),
        },
        {
          id: 'enrollment-2',
          user_id: 'user-2',
          workshop_id: 'workshop-1',
          enrolled_at: new Date('2026-04-10'),
          first_login_at: new Date('2026-04-11'),
          trial_started_at: new Date('2026-04-15'),
          trial_expires_at: new Date('2026-05-10'),
          converted_to_paid_at: null,
          worksheet_completed_at: new Date('2026-04-10'),
          emails_sent: [],
          last_active_at: new Date('2026-06-07'),
          status: 'active',
          created_at: new Date('2026-04-10'),
          updated_at: new Date('2026-04-10'),
        },
      ];

      const mockWorkshop: WorkshopRow = {
        id: 'workshop-1',
        cohort_name: 'Spring 2026',
        slug: 'spring-2026',
        description: null,
        workshop_type: 'online',
        location: null,
        primary_timezone: 'America/Los_Angeles',
        secondary_timezone: null,
        access_grant_datetime: new Date('2026-04-05'),
        trial_start_datetime: new Date('2026-04-05'),
        trial_duration_days: 30,
        workshop_start_datetime: new Date('2026-04-10'),
        workshop_end_datetime: new Date('2026-04-10'),
        registration_deadline: null,
        max_enrollment: null,
        welcome_message: null,
        custom_email_templates: null,
        custom_email_schedule: null,
        post_workshop_resources: null,
        post_trial_action: 'upgrade_prompt',
        send_reminder: true,
        reminder_hours_before: 24,
        status: 'completed',
        created_by: 'admin-1',
        created_at: new Date('2026-03-01'),
        updated_at: new Date('2026-03-01'),
      };

      mockQuery
        .mockResolvedValueOnce({ rows: mockEnrollments, rowCount: 2 })
        // First enrollment
        .mockResolvedValueOnce({ rows: [mockWorkshop], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id: 'user-1', email: 'user1@test.com', first_name: 'User', last_name: '1' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ ...mockEnrollments[0], status: 'trial_expired' }], rowCount: 1 })
        // Second enrollment
        .mockResolvedValueOnce({ rows: [mockWorkshop], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id: 'user-2', email: 'user2@test.com', first_name: 'User', last_name: '2' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ ...mockEnrollments[1], status: 'trial_expired' }], rowCount: 1 });

      mockSendTrialExpirationEmail.mockResolvedValue(true);

      const { checkAndProcessExpiredTrials } = await import('./trialManager.js');

      // Act
      const result = await checkAndProcessExpiredTrials();

      // Assert
      expect(result.totalChecked).toBe(2);
      expect(result.totalExpired).toBe(2);
      expect(result.emailsSent).toBe(2);
      expect(result.emailsFailed).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle auto_convert post-trial action', async () => {
      // Arrange
      const mockEnrollment: WorkshopEnrollmentRow = {
        id: 'enrollment-789',
        user_id: 'user-789',
        workshop_id: 'workshop-789',
        enrolled_at: new Date('2026-05-01'),
        first_login_at: new Date('2026-05-02'),
        trial_started_at: new Date('2026-05-05'),
        trial_expires_at: new Date('2026-06-01'),
        converted_to_paid_at: null,
        worksheet_completed_at: new Date('2026-05-01'),
        emails_sent: [],
        last_active_at: new Date('2026-06-07'),
        status: 'active',
        created_at: new Date('2026-05-01'),
        updated_at: new Date('2026-05-01'),
      };

      const mockWorkshop: WorkshopRow = {
        id: 'workshop-789',
        cohort_name: 'Premium Workshop',
        slug: 'premium-2026',
        description: null,
        workshop_type: 'online',
        location: null,
        primary_timezone: 'America/Los_Angeles',
        secondary_timezone: null,
        access_grant_datetime: new Date('2026-05-05'),
        trial_start_datetime: new Date('2026-05-05'),
        trial_duration_days: 30,
        workshop_start_datetime: new Date('2026-05-10'),
        workshop_end_datetime: new Date('2026-05-10'),
        registration_deadline: null,
        max_enrollment: null,
        welcome_message: null,
        custom_email_templates: null,
        custom_email_schedule: null,
        post_workshop_resources: null,
        post_trial_action: 'auto_convert',
        send_reminder: true,
        reminder_hours_before: 24,
        status: 'completed',
        created_by: 'admin-789',
        created_at: new Date('2026-04-01'),
        updated_at: new Date('2026-04-01'),
      };

      const mockUser = {
        id: 'user-789',
        email: 'premium@example.com',
        first_name: 'Premium',
        last_name: 'User',
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [mockEnrollment], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [mockWorkshop], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [mockUser], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ ...mockEnrollment, status: 'converted' }], rowCount: 1 });

      mockSendTrialExpirationEmail.mockResolvedValueOnce(true);

      const { checkAndProcessExpiredTrials } = await import('./trialManager.js');

      // Act
      const result = await checkAndProcessExpiredTrials();

      // Assert
      expect(result.totalChecked).toBe(1);
      expect(result.totalExpired).toBe(1);
      expect(mockSendTrialExpirationEmail).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        'auto_convert'
      );
    });

    it('should collect errors when processing fails', async () => {
      // Arrange
      const mockEnrollment: WorkshopEnrollmentRow = {
        id: 'enrollment-error',
        user_id: 'user-error',
        workshop_id: 'workshop-error',
        enrolled_at: new Date('2026-05-01'),
        first_login_at: new Date('2026-05-02'),
        trial_started_at: new Date('2026-05-05'),
        trial_expires_at: new Date('2026-06-01'),
        converted_to_paid_at: null,
        worksheet_completed_at: new Date('2026-05-01'),
        emails_sent: [],
        last_active_at: new Date('2026-06-07'),
        status: 'active',
        created_at: new Date('2026-05-01'),
        updated_at: new Date('2026-05-01'),
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [mockEnrollment], rowCount: 1 })
        .mockRejectedValueOnce(new Error('Database connection failed'));

      const { checkAndProcessExpiredTrials } = await import('./trialManager.js');

      // Act
      const result = await checkAndProcessExpiredTrials();

      // Assert
      expect(result.totalChecked).toBe(1);
      expect(result.totalExpired).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('enrollment-error');
      expect(result.errors[0]).toContain('Database connection failed');
    });
  });
});
