/**
 * Report Scheduler Service
 *
 * Per I6: Scheduled Report Delivery
 * Manages report schedules, calculates next run times, and processes pending deliveries.
 *
 * Uses rrule for schedule calculations (already in dependencies for E2 recurring transactions).
 */

import { RRule, Frequency } from 'rrule';
import { db } from '../db/database';
import { nanoid } from 'nanoid';
import { logger } from '../utils/logger';
import { AppError, ErrorCode } from '../utils/errors';
import type {
  ReportSchedule,
  CreateScheduleInput,
  UpdateScheduleInput,
  ScheduleFrequency,
  DayOfWeek,
  NextRunCalculation,
  ScheduleValidation,
  ScheduleResult,
} from '../types/scheduledReports.types';
import type { ReportScheduleEntity } from '../db/schema/scheduledReports.schema';
import {
  createDefaultReportSchedule,
  validateEmailAddresses,
} from '../db/schema/scheduledReports.schema';

const scheduleLogger = logger.child('ReportScheduler');

// =============================================================================
// CRUD Operations
// =============================================================================

/**
 * Create a new report schedule
 */
export async function createReportSchedule(
  companyId: string,
  userId: string,
  input: CreateScheduleInput,
  deviceId: string = 'default-device'
): Promise<ScheduleResult<ReportSchedule>> {
  try {
    scheduleLogger.info('Creating report schedule', { companyId, userId, reportType: input.reportType });

    // Validate input
    const validation = validateScheduleInput(input);
    if (!validation.isValid) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: validation.errors.join('; '),
          details: validation.errors,
        },
      };
    }

    // Calculate next run time
    const nextRun = calculateNextRunTime(
      input.frequency,
      input.timeOfDay,
      input.timezone,
      {
        dayOfWeek: input.dayOfWeek,
        dayOfMonth: input.dayOfMonth,
        monthOfYear: input.monthOfYear,
        cronExpression: input.cronExpression,
      }
    );

    if (!nextRun.isValid) {
      return {
        success: false,
        error: {
          code: 'INVALID_CRON',
          message: nextRun.error || 'Invalid schedule configuration',
        },
      };
    }

    // Create entity
    const defaults = createDefaultReportSchedule(
      companyId,
      userId,
      deviceId,
      input.reportType,
      input.reportName
    );

    const entity: ReportScheduleEntity = {
      ...defaults,
      id: nanoid(),
      saved_report_id: input.savedReportId || null,
      frequency: input.frequency,
      cron_expression: nextRun.cronExpression,
      day_of_week: input.dayOfWeek || null,
      day_of_month: input.dayOfMonth || null,
      month_of_year: input.monthOfYear || null,
      time_of_day: input.timeOfDay,
      timezone: input.timezone,
      recipients: input.recipients,
      format: input.format,
      include_comparison: input.includeComparison || false,
      include_educational_content: input.includeEducationalContent || false,
      report_parameters: input.reportParameters,
      next_run_at: nextRun.nextRun,
      created_at: new Date(),
      updated_at: new Date(),
    };

    // Save to database
    await db.reportSchedules.add(entity);

    scheduleLogger.info('Report schedule created', { scheduleId: entity.id, nextRun: nextRun.nextRun });

    return {
      success: true,
      data: entityToSchedule(entity),
    };
  } catch (error) {
    scheduleLogger.error('Failed to create report schedule', { error, companyId, userId });
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Failed to create schedule',
        details: error,
      },
    };
  }
}

/**
 * Get report schedule by ID
 */
export async function getReportSchedule(scheduleId: string): Promise<ScheduleResult<ReportSchedule>> {
  try {
    const entity = await db.reportSchedules.get(scheduleId);

    if (!entity || entity.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Schedule not found',
        },
      };
    }

    return {
      success: true,
      data: entityToSchedule(entity),
    };
  } catch (error) {
    scheduleLogger.error('Failed to get report schedule', { error, scheduleId });
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: 'Failed to retrieve schedule',
      },
    };
  }
}

/**
 * List all schedules for a company
 */
export async function listReportSchedules(companyId: string): Promise<ReportSchedule[]> {
  try {
    const entities = await db.reportSchedules
      .where('company_id')
      .equals(companyId)
      .and((schedule) => !schedule.deleted_at)
      .toArray();

    return entities.map(entityToSchedule);
  } catch (error) {
    scheduleLogger.error('Failed to list report schedules', { error, companyId });
    return [];
  }
}

/**
 * Update report schedule
 */
export async function updateReportSchedule(
  scheduleId: string,
  input: UpdateScheduleInput,
  deviceId: string = 'default-device'
): Promise<ScheduleResult<ReportSchedule>> {
  try {
    const existing = await db.reportSchedules.get(scheduleId);

    if (!existing || existing.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Schedule not found',
        },
      };
    }

    // Build update object
    const updates: Partial<ReportScheduleEntity> = {
      updated_at: new Date(),
      last_modified_at: new Date(),
      last_modified_by: deviceId,
    };

    if (input.reportName) updates.report_name = input.reportName;
    if (input.enabled !== undefined) updates.enabled = input.enabled;
    if (input.recipients) updates.recipients = input.recipients;
    if (input.format) updates.format = input.format;
    if (input.includeComparison !== undefined) updates.include_comparison = input.includeComparison;
    if (input.includeEducationalContent !== undefined)
      updates.include_educational_content = input.includeEducationalContent;
    if (input.reportParameters) {
      updates.report_parameters = {
        ...existing.report_parameters,
        ...input.reportParameters,
      };
    }

    // If schedule configuration changed, recalculate next run time
    if (
      input.frequency ||
      input.timeOfDay ||
      input.timezone ||
      input.dayOfWeek ||
      input.dayOfMonth ||
      input.monthOfYear ||
      input.cronExpression
    ) {
      const frequency = input.frequency || existing.frequency;
      const timeOfDay = input.timeOfDay || existing.time_of_day;
      const timezone = input.timezone || existing.timezone;

      const nextRun = calculateNextRunTime(frequency, timeOfDay, timezone, {
        dayOfWeek: input.dayOfWeek || existing.day_of_week || undefined,
        dayOfMonth: input.dayOfMonth || existing.day_of_month || undefined,
        monthOfYear: input.monthOfYear || existing.month_of_year || undefined,
        cronExpression: input.cronExpression || existing.cron_expression || undefined,
      });

      if (!nextRun.isValid) {
        return {
          success: false,
          error: {
            code: 'INVALID_CRON',
            message: nextRun.error || 'Invalid schedule configuration',
          },
        };
      }

      updates.frequency = frequency;
      updates.time_of_day = timeOfDay;
      updates.timezone = timezone;
      updates.cron_expression = nextRun.cronExpression;
      updates.next_run_at = nextRun.nextRun;

      if (input.dayOfWeek) updates.day_of_week = input.dayOfWeek;
      if (input.dayOfMonth) updates.day_of_month = input.dayOfMonth;
      if (input.monthOfYear) updates.month_of_year = input.monthOfYear;
    }

    // Update version vector for CRDT
    updates.version_vector = {
      ...existing.version_vector,
      [deviceId]: (existing.version_vector[deviceId] || 0) + 1,
    };

    // Apply updates
    await db.reportSchedules.update(scheduleId, updates);

    // Fetch updated entity
    const updated = await db.reportSchedules.get(scheduleId);
    if (!updated) {
      throw new Error('Failed to retrieve updated schedule');
    }

    scheduleLogger.info('Report schedule updated', { scheduleId });

    return {
      success: true,
      data: entityToSchedule(updated),
    };
  } catch (error) {
    scheduleLogger.error('Failed to update report schedule', { error, scheduleId });
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: 'Failed to update schedule',
      },
    };
  }
}

/**
 * Delete report schedule (soft delete)
 */
export async function deleteReportSchedule(scheduleId: string): Promise<ScheduleResult<void>> {
  try {
    const existing = await db.reportSchedules.get(scheduleId);

    if (!existing || existing.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Schedule not found',
        },
      };
    }

    await db.reportSchedules.update(scheduleId, {
      deleted_at: new Date(),
      updated_at: new Date(),
    });

    scheduleLogger.info('Report schedule deleted', { scheduleId });

    return {
      success: true,
      data: undefined,
    };
  } catch (error) {
    scheduleLogger.error('Failed to delete report schedule', { error, scheduleId });
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: 'Failed to delete schedule',
      },
    };
  }
}

/**
 * Pause report schedule
 */
export async function pauseReportSchedule(
  scheduleId: string,
  pausedBy: string
): Promise<ScheduleResult<ReportSchedule>> {
  try {
    const existing = await db.reportSchedules.get(scheduleId);

    if (!existing || existing.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Schedule not found',
        },
      };
    }

    await db.reportSchedules.update(scheduleId, {
      enabled: false,
      paused_at: new Date(),
      paused_by: pausedBy,
      updated_at: new Date(),
    });

    const updated = await db.reportSchedules.get(scheduleId);
    if (!updated) throw new Error('Failed to retrieve updated schedule');

    scheduleLogger.info('Report schedule paused', { scheduleId, pausedBy });

    return {
      success: true,
      data: entityToSchedule(updated),
    };
  } catch (error) {
    scheduleLogger.error('Failed to pause report schedule', { error, scheduleId });
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: 'Failed to pause schedule',
      },
    };
  }
}

/**
 * Resume report schedule
 */
export async function resumeReportSchedule(scheduleId: string): Promise<ScheduleResult<ReportSchedule>> {
  try {
    const existing = await db.reportSchedules.get(scheduleId);

    if (!existing || existing.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Schedule not found',
        },
      };
    }

    // Recalculate next run time
    const nextRun = calculateNextRunTime(
      existing.frequency,
      existing.time_of_day,
      existing.timezone,
      {
        dayOfWeek: existing.day_of_week || undefined,
        dayOfMonth: existing.day_of_month || undefined,
        monthOfYear: existing.month_of_year || undefined,
        cronExpression: existing.cron_expression || undefined,
      }
    );

    await db.reportSchedules.update(scheduleId, {
      enabled: true,
      paused_at: null,
      paused_by: null,
      next_run_at: nextRun.nextRun,
      updated_at: new Date(),
    });

    const updated = await db.reportSchedules.get(scheduleId);
    if (!updated) throw new Error('Failed to retrieve updated schedule');

    scheduleLogger.info('Report schedule resumed', { scheduleId });

    return {
      success: true,
      data: entityToSchedule(updated),
    };
  } catch (error) {
    scheduleLogger.error('Failed to resume report schedule', { error, scheduleId });
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: 'Failed to resume schedule',
      },
    };
  }
}

// =============================================================================
// Schedule Calculation (using rrule)
// =============================================================================

/**
 * Calculate next run time for a schedule
 */
export function calculateNextRunTime(
  frequency: ScheduleFrequency,
  timeOfDay: string,
  _timezone: string,
  options: {
    dayOfWeek?: DayOfWeek;
    dayOfMonth?: number;
    monthOfYear?: number;
    cronExpression?: string;
  } = {}
): NextRunCalculation {
  try {
    // TODO: Use timezone for proper time calculation
    const now = new Date();
    const [hours, minutes] = timeOfDay.split(':').map(Number);

    let rule: RRule;

    switch (frequency) {
      case 'daily':
        rule = new RRule({
          freq: Frequency.DAILY,
          dtstart: now,
          byhour: hours,
          byminute: minutes,
        });
        break;

      case 'weekly':
        if (!options.dayOfWeek) {
          return {
            nextRun: new Date(),
            cronExpression: '',
            isValid: false,
            error: 'Day of week required for weekly schedules',
          };
        }
        const weekday = dayOfWeekToRRuleDay(options.dayOfWeek);
        rule = new RRule({
          freq: Frequency.WEEKLY,
          dtstart: now,
          byweekday: weekday,
          byhour: hours,
          byminute: minutes,
        });
        break;

      case 'monthly':
        if (!options.dayOfMonth) {
          return {
            nextRun: new Date(),
            cronExpression: '',
            isValid: false,
            error: 'Day of month required for monthly schedules',
          };
        }
        rule = new RRule({
          freq: Frequency.MONTHLY,
          dtstart: now,
          bymonthday: options.dayOfMonth,
          byhour: hours,
          byminute: minutes,
        });
        break;

      case 'quarterly':
        // Quarterly on the 1st day of Jan, Apr, Jul, Oct
        rule = new RRule({
          freq: Frequency.MONTHLY,
          dtstart: now,
          interval: 3,
          bymonthday: 1,
          byhour: hours,
          byminute: minutes,
        });
        break;

      case 'yearly':
        if (!options.monthOfYear) {
          return {
            nextRun: new Date(),
            cronExpression: '',
            isValid: false,
            error: 'Month of year required for yearly schedules',
          };
        }
        rule = new RRule({
          freq: Frequency.YEARLY,
          dtstart: now,
          bymonth: options.monthOfYear,
          bymonthday: options.dayOfMonth || 1,
          byhour: hours,
          byminute: minutes,
        });
        break;

      case 'custom':
        // For custom schedules, use provided cron expression
        // Note: RRule doesn't parse cron directly, so we'd need a cron parser
        // For MVP, we'll skip custom cron and handle it later
        return {
          nextRun: new Date(),
          cronExpression: options.cronExpression || '',
          isValid: false,
          error: 'Custom cron schedules not yet implemented',
        };

      default:
        return {
          nextRun: new Date(),
          cronExpression: '',
          isValid: false,
          error: `Unknown frequency: ${frequency}`,
        };
    }

    // Get next occurrence after now
    const nextRun = rule.after(now, true);

    if (!nextRun) {
      return {
        nextRun: new Date(),
        cronExpression: '',
        isValid: false,
        error: 'No future occurrences found',
      };
    }

    return {
      nextRun,
      cronExpression: rule.toString(),
      isValid: true,
    };
  } catch (error) {
    scheduleLogger.error('Failed to calculate next run time', { error, frequency });
    return {
      nextRun: new Date(),
      cronExpression: '',
      isValid: false,
      error: error instanceof Error ? error.message : 'Calculation failed',
    };
  }
}

/**
 * Convert day of week string to RRule weekday
 */
function dayOfWeekToRRuleDay(day: DayOfWeek): number {
  const mapping: Record<DayOfWeek, number> = {
    monday: RRule.MO.weekday,
    tuesday: RRule.TU.weekday,
    wednesday: RRule.WE.weekday,
    thursday: RRule.TH.weekday,
    friday: RRule.FR.weekday,
    saturday: RRule.SA.weekday,
    sunday: RRule.SU.weekday,
  };
  return mapping[day];
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Validate schedule input
 */
function validateScheduleInput(input: CreateScheduleInput): ScheduleValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate report type
  if (!input.reportType) {
    errors.push('Report type is required');
  }

  // Validate report name
  if (!input.reportName || input.reportName.trim().length === 0) {
    errors.push('Report name is required');
  }

  // Validate frequency
  const validFrequencies: ScheduleFrequency[] = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom'];
  if (!validFrequencies.includes(input.frequency)) {
    errors.push(`Frequency must be one of: ${validFrequencies.join(', ')}`);
  }

  // Frequency-specific validation
  if (input.frequency === 'weekly' && !input.dayOfWeek) {
    errors.push('Day of week is required for weekly schedules');
  }

  if (input.frequency === 'monthly' && !input.dayOfMonth) {
    errors.push('Day of month is required for monthly schedules');
  }

  if (input.frequency === 'yearly' && !input.monthOfYear) {
    errors.push('Month of year is required for yearly schedules');
  }

  if (input.frequency === 'custom' && !input.cronExpression) {
    errors.push('Cron expression is required for custom schedules');
  }

  // Validate time format
  if (!/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(input.timeOfDay)) {
    errors.push('Time of day must be in HH:MM format (e.g., 08:00)');
  }

  // Validate timezone
  try {
    Intl.DateTimeFormat(undefined, { timeZone: input.timezone });
  } catch {
    errors.push('Invalid timezone');
  }

  // Validate recipients
  const emailValidation = validateEmailAddresses(input.recipients);
  if (!emailValidation.valid) {
    errors.push(`Invalid email addresses: ${emailValidation.invalidEmails.join(', ')}`);
  }

  if (input.recipients.length === 0) {
    errors.push('At least one recipient is required');
  }

  // Validate format
  if (!['pdf', 'csv', 'json'].includes(input.format)) {
    errors.push('Format must be pdf, csv, or json');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// =============================================================================
// Entity Conversion
// =============================================================================

/**
 * Convert database entity to domain model
 */
function entityToSchedule(entity: ReportScheduleEntity): ReportSchedule {
  return {
    id: entity.id,
    companyId: entity.company_id,
    userId: entity.user_id,
    reportType: entity.report_type,
    reportName: entity.report_name,
    savedReportId: entity.saved_report_id || undefined,
    enabled: entity.enabled,
    frequency: entity.frequency,
    cronExpression: entity.cron_expression || undefined,
    dayOfWeek: entity.day_of_week || undefined,
    dayOfMonth: entity.day_of_month || undefined,
    monthOfYear: entity.month_of_year || undefined,
    timeOfDay: entity.time_of_day,
    timezone: entity.timezone,
    recipients: entity.recipients,
    format: entity.format,
    includeComparison: entity.include_comparison,
    includeEducationalContent: entity.include_educational_content,
    reportParameters: entity.report_parameters,
    lastRunAt: entity.last_run_at,
    nextRunAt: entity.next_run_at,
    lastSuccessAt: entity.last_success_at,
    lastFailureAt: entity.last_failure_at,
    runCount: entity.run_count,
    failureCount: entity.failure_count,
    pausedAt: entity.paused_at,
    pausedBy: entity.paused_by,
    createdAt: entity.created_at,
    updatedAt: entity.updated_at,
    createdBy: entity.created_by,
    deletedAt: entity.deleted_at,
  };
}
