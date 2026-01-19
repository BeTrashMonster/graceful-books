/**
 * Scheduled Report Delivery Types
 *
 * Per I6: Scheduled Report Delivery
 * Defines types for automatic email delivery of reports on configurable schedules.
 */

import type { ReportExportFormat } from './reports.types';

// =============================================================================
// Schedule Configuration Types
// =============================================================================

/**
 * Report schedule frequency
 */
export type ScheduleFrequency =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'yearly'
  | 'custom';

/**
 * Days of the week for weekly schedules
 */
export type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

/**
 * Report type identifier
 */
export type SchedulableReportType =
  | 'profit-loss'
  | 'balance-sheet'
  | 'cash-flow'
  | 'ar-aging'
  | 'ap-aging'
  | 'custom';

/**
 * Schedule configuration for a report
 */
export interface ReportSchedule {
  id: string;
  companyId: string;
  userId: string;

  // Report configuration
  reportType: SchedulableReportType;
  reportName: string;
  savedReportId?: string; // Reference to saved custom report (G1)

  // Schedule configuration
  enabled: boolean;
  frequency: ScheduleFrequency;
  cronExpression?: string; // For custom schedules (POSIX cron syntax)

  // Frequency-specific settings
  dayOfWeek?: DayOfWeek; // For weekly schedules
  dayOfMonth?: number; // For monthly schedules (1-31)
  monthOfYear?: number; // For yearly schedules (1-12)
  timeOfDay: string; // HH:MM format in user's timezone
  timezone: string; // IANA timezone identifier

  // Delivery configuration
  recipients: string[]; // Email addresses
  format: ReportExportFormat; // 'pdf' or 'excel'
  includeComparison: boolean;
  includeEducationalContent: boolean;

  // Report parameters (stored as JSON)
  reportParameters: ReportParameters;

  // Tracking
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  runCount: number;
  failureCount: number;

  // Pause/resume
  pausedAt: Date | null;
  pausedBy: string | null;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  deletedAt: Date | null;
}

/**
 * Report parameters (flexible structure)
 */
export interface ReportParameters {
  // Date range
  dateRangeType?: 'this-month' | 'last-month' | 'this-quarter' | 'last-quarter' | 'this-year' | 'last-year' | 'year-to-date' | 'custom';
  startDate?: string; // ISO string
  endDate?: string; // ISO string

  // Comparison
  comparisonType?: 'previous-period' | 'previous-year' | 'custom';
  comparisonStartDate?: string;
  comparisonEndDate?: string;

  // Filters
  includeZeroBalances?: boolean;
  includeInactive?: boolean;
  accountingMethod?: 'cash' | 'accrual';

  // Custom report specific (G1)
  customReportConfig?: Record<string, unknown>;
}

// =============================================================================
// Delivery History Types
// =============================================================================

/**
 * Delivery status
 */
export type DeliveryStatus =
  | 'pending'
  | 'processing'
  | 'sent'
  | 'failed'
  | 'retrying';

/**
 * Delivery record for a scheduled report
 */
export interface ScheduledReportDelivery {
  id: string;
  scheduleId: string;
  companyId: string;
  userId: string;

  // Report details
  reportType: SchedulableReportType;
  reportName: string;
  generatedAt: Date;

  // Delivery details
  recipients: string[];
  format: ReportExportFormat;
  status: DeliveryStatus;

  // Timing
  scheduledAt: Date;
  sentAt: Date | null;
  deliveredAt: Date | null;

  // Failure tracking
  failureReason: string | null;
  retryCount: number;
  maxRetries: number;
  lastRetryAt: Date | null;

  // Attachment info
  attachmentSize: number | null; // Bytes
  attachmentUrl: string | null; // For temporary download links

  // Email details
  emailSubject: string;
  emailBody: string;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// Input Types
// =============================================================================

/**
 * Input for creating a report schedule
 */
export interface CreateScheduleInput {
  reportType: SchedulableReportType;
  reportName: string;
  savedReportId?: string;

  frequency: ScheduleFrequency;
  cronExpression?: string;

  dayOfWeek?: DayOfWeek;
  dayOfMonth?: number;
  monthOfYear?: number;
  timeOfDay: string;
  timezone: string;

  recipients: string[];
  format: ReportExportFormat;
  includeComparison?: boolean;
  includeEducationalContent?: boolean;

  reportParameters: ReportParameters;
}

/**
 * Input for updating a report schedule
 */
export interface UpdateScheduleInput {
  reportName?: string;
  enabled?: boolean;

  frequency?: ScheduleFrequency;
  cronExpression?: string;

  dayOfWeek?: DayOfWeek;
  dayOfMonth?: number;
  monthOfYear?: number;
  timeOfDay?: string;
  timezone?: string;

  recipients?: string[];
  format?: ReportExportFormat;
  includeComparison?: boolean;
  includeEducationalContent?: boolean;

  reportParameters?: Partial<ReportParameters>;
}

// =============================================================================
// Cron and Scheduling Types
// =============================================================================

/**
 * Next run calculation result
 */
export interface NextRunCalculation {
  nextRun: Date;
  cronExpression: string;
  isValid: boolean;
  error?: string;
}

/**
 * Schedule validation result
 */
export interface ScheduleValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// =============================================================================
// Email Template Types
// =============================================================================

/**
 * Email content for scheduled report delivery
 */
export interface ScheduledReportEmail {
  to: string[];
  subject: string;
  htmlBody: string;
  textBody: string;
  attachments: EmailAttachment[];
  replyTo?: string;
}

/**
 * Email attachment
 */
export interface EmailAttachment {
  filename: string;
  content: Buffer | Blob;
  contentType: string;
  size: number;
}

// =============================================================================
// Result Types
// =============================================================================

/**
 * Result of schedule operations
 */
export type ScheduleResult<T> =
  | { success: true; data: T }
  | { success: false; error: ScheduleError };

/**
 * Schedule error types
 */
export interface ScheduleError {
  code:
    | 'NOT_FOUND'
    | 'VALIDATION_ERROR'
    | 'INVALID_CRON'
    | 'INVALID_TIMEZONE'
    | 'INVALID_EMAIL'
    | 'REPORT_GENERATION_FAILED'
    | 'DELIVERY_FAILED'
    | 'RATE_LIMITED'
    | 'QUOTA_EXCEEDED'
    | 'UNKNOWN_ERROR';
  message: string;
  details?: unknown;
}

// =============================================================================
// Statistics and Analytics
// =============================================================================

/**
 * Schedule statistics
 */
export interface ScheduleStats {
  totalSchedules: number;
  activeSchedules: number;
  pausedSchedules: number;
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  successRate: number;
  avgDeliveryTime: number; // Milliseconds
  mostPopularReport: SchedulableReportType | null;
}

/**
 * Delivery history summary
 */
export interface DeliveryHistorySummary {
  scheduleId: string;
  reportName: string;
  lastDelivery: Date | null;
  nextDelivery: Date | null;
  recentDeliveries: ScheduledReportDelivery[];
  successCount: number;
  failureCount: number;
  avgDeliveryTime: number;
}
