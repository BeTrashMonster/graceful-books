/**
 * Scheduled Reports Database Schema
 *
 * Per I6: Scheduled Report Delivery
 * Stores schedules and delivery history for automatic report emails.
 */

import type { Table } from 'dexie';
import type { VersionVector } from '../../types/database.types';
import type {
  ScheduleFrequency,
  DayOfWeek,
  SchedulableReportType,
  ReportParameters,
  DeliveryStatus,
} from '../../types/scheduledReports.types';
import type { ReportExportFormat } from '../../types/reports.types';

// =============================================================================
// Report Schedule Entity
// =============================================================================

/**
 * Report schedule entity (stored in IndexedDB)
 */
export interface ReportScheduleEntity {
  id: string; // Primary key
  company_id: string; // Indexed
  user_id: string; // Indexed

  // Report configuration
  report_type: SchedulableReportType;
  report_name: string; // Indexed
  saved_report_id: string | null;

  // Schedule configuration
  enabled: boolean; // Indexed
  frequency: ScheduleFrequency;
  cron_expression: string | null;

  // Frequency-specific settings
  day_of_week: DayOfWeek | null;
  day_of_month: number | null;
  month_of_year: number | null;
  time_of_day: string; // HH:MM
  timezone: string;

  // Delivery configuration
  recipients: string[]; // JSON array
  format: ReportExportFormat;
  include_comparison: boolean;
  include_educational_content: boolean;

  // Report parameters (JSON)
  report_parameters: ReportParameters;

  // Tracking
  last_run_at: Date | null; // Indexed
  next_run_at: Date | null; // Indexed
  last_success_at: Date | null;
  last_failure_at: Date | null;
  run_count: number;
  failure_count: number;

  // Pause/resume
  paused_at: Date | null;
  paused_by: string | null;

  // CRDT fields
  version_vector: VersionVector;
  last_modified_by: string;
  last_modified_at: Date;

  // Soft delete
  deleted_at: Date | null;

  // Timestamps
  created_at: Date;
  updated_at: Date;
  created_by: string;
}

// =============================================================================
// Delivery History Entity
// =============================================================================

/**
 * Scheduled report delivery entity
 */
export interface ScheduledReportDeliveryEntity {
  id: string; // Primary key
  schedule_id: string; // Indexed
  company_id: string; // Indexed
  user_id: string; // Indexed

  // Report details
  report_type: SchedulableReportType;
  report_name: string;
  generated_at: Date;

  // Delivery details
  recipients: string[]; // JSON array
  format: ReportExportFormat;
  status: DeliveryStatus; // Indexed

  // Timing
  scheduled_at: Date; // Indexed
  sent_at: Date | null;
  delivered_at: Date | null;

  // Failure tracking
  failure_reason: string | null;
  retry_count: number;
  max_retries: number;
  last_retry_at: Date | null;

  // Attachment info
  attachment_size: number | null;
  attachment_url: string | null;

  // Email details
  email_subject: string;
  email_body: string;

  // CRDT fields
  version_vector: VersionVector;
  last_modified_by: string;
  last_modified_at: Date;

  // Soft delete
  deleted_at: Date | null;

  // Timestamps
  created_at: Date;
  updated_at: Date;
}

// =============================================================================
// Type Exports
// =============================================================================

export type ReportScheduleTable = Table<ReportScheduleEntity, string>;
export type ScheduledReportDeliveryTable = Table<ScheduledReportDeliveryEntity, string>;

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create default report schedule
 */
export function createDefaultReportSchedule(
  companyId: string,
  userId: string,
  deviceId: string,
  reportType: SchedulableReportType,
  reportName: string
): Omit<ReportScheduleEntity, 'id' | 'created_at' | 'updated_at'> {
  const now = new Date();

  return {
    company_id: companyId,
    user_id: userId,

    // Report configuration
    report_type: reportType,
    report_name: reportName,
    saved_report_id: null,

    // Default: Weekly on Monday at 8 AM
    enabled: true,
    frequency: 'weekly',
    cron_expression: null,

    day_of_week: 'monday',
    day_of_month: null,
    month_of_year: null,
    time_of_day: '08:00',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,

    // Delivery configuration
    recipients: [],
    format: 'pdf',
    include_comparison: false,
    include_educational_content: false,

    // Report parameters
    report_parameters: {
      dateRangeType: 'last-month',
    },

    // Tracking
    last_run_at: null,
    next_run_at: null,
    last_success_at: null,
    last_failure_at: null,
    run_count: 0,
    failure_count: 0,

    // Pause/resume
    paused_at: null,
    paused_by: null,

    // CRDT fields
    version_vector: { [deviceId]: 1 },
    last_modified_by: deviceId,
    last_modified_at: now,

    // Soft delete
    deleted_at: null,

    // Metadata
    created_by: userId,
  };
}

/**
 * Create delivery record
 */
export function createDeliveryRecord(
  scheduleId: string,
  companyId: string,
  userId: string,
  reportType: SchedulableReportType,
  reportName: string,
  recipients: string[],
  format: ReportExportFormat,
  scheduledAt: Date,
  emailSubject: string,
  emailBody: string,
  deviceId: string
): Omit<ScheduledReportDeliveryEntity, 'id' | 'created_at' | 'updated_at'> {
  const now = new Date();

  return {
    schedule_id: scheduleId,
    company_id: companyId,
    user_id: userId,

    // Report details
    report_type: reportType,
    report_name: reportName,
    generated_at: now,

    // Delivery details
    recipients,
    format,
    status: 'pending',

    // Timing
    scheduled_at: scheduledAt,
    sent_at: null,
    delivered_at: null,

    // Failure tracking
    failure_reason: null,
    retry_count: 0,
    max_retries: 3,
    last_retry_at: null,

    // Attachment info
    attachment_size: null,
    attachment_url: null,

    // Email details
    email_subject: emailSubject,
    email_body: emailBody,

    // CRDT fields
    version_vector: { [deviceId]: 1 },
    last_modified_by: deviceId,
    last_modified_at: now,

    // Soft delete
    deleted_at: null,
  };
}

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Validate report schedule
 */
export function validateReportSchedule(
  schedule: Partial<ReportScheduleEntity>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate frequency
  if (schedule.frequency !== undefined) {
    const validFrequencies: ScheduleFrequency[] = [
      'daily',
      'weekly',
      'monthly',
      'quarterly',
      'yearly',
      'custom',
    ];
    if (!validFrequencies.includes(schedule.frequency)) {
      errors.push(`frequency must be one of: ${validFrequencies.join(', ')}`);
    }
  }

  // Validate day of week for weekly schedules
  if (schedule.frequency === 'weekly' && !schedule.day_of_week) {
    errors.push('day_of_week is required for weekly schedules');
  }

  // Validate day of month for monthly schedules
  if (schedule.frequency === 'monthly') {
    if (!schedule.day_of_month) {
      errors.push('day_of_month is required for monthly schedules');
    } else if (schedule.day_of_month < 1 || schedule.day_of_month > 31) {
      errors.push('day_of_month must be between 1 and 31');
    }
  }

  // Validate month of year for yearly schedules
  if (schedule.frequency === 'yearly') {
    if (!schedule.month_of_year) {
      errors.push('month_of_year is required for yearly schedules');
    } else if (schedule.month_of_year < 1 || schedule.month_of_year > 12) {
      errors.push('month_of_year must be between 1 and 12');
    }
  }

  // Validate cron expression for custom schedules
  if (schedule.frequency === 'custom' && !schedule.cron_expression) {
    errors.push('cron_expression is required for custom schedules');
  }

  // Validate time format (HH:MM)
  if (schedule.time_of_day && !/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(schedule.time_of_day)) {
    errors.push('time_of_day must be in HH:MM format (e.g., 08:00)');
  }

  // Validate recipients
  if (schedule.recipients !== undefined) {
    if (!Array.isArray(schedule.recipients)) {
      errors.push('recipients must be an array');
    } else if (schedule.recipients.length === 0) {
      errors.push('At least one recipient is required');
    } else {
      // Validate each email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      schedule.recipients.forEach((email, index) => {
        if (!emailRegex.test(email)) {
          errors.push(`Invalid email address at index ${index}: ${email}`);
        }
      });
    }
  }

  // Validate report type
  if (schedule.report_type !== undefined) {
    const validTypes: SchedulableReportType[] = [
      'profit-loss',
      'balance-sheet',
      'cash-flow',
      'ar-aging',
      'ap-aging',
      'custom',
    ];
    if (!validTypes.includes(schedule.report_type)) {
      errors.push(`report_type must be one of: ${validTypes.join(', ')}`);
    }
  }

  // Validate format
  if (schedule.format !== undefined) {
    const validFormats: ReportExportFormat[] = ['pdf', 'csv', 'json'];
    if (!validFormats.includes(schedule.format)) {
      errors.push(`format must be one of: ${validFormats.join(', ')}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate email addresses
 */
export function validateEmailAddresses(emails: string[]): { valid: boolean; invalidEmails: string[] } {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const invalidEmails = emails.filter((email) => !emailRegex.test(email));

  return {
    valid: invalidEmails.length === 0,
    invalidEmails,
  };
}
