/**
 * Scheduled Reports Schema Index Definition
 *
 * Defines Dexie index schema for scheduled reports and delivery tables.
 */

/**
 * Report Schedule table schema
 * Indexed fields for efficient queries
 */
export const reportScheduleSchema =
  'id, company_id, user_id, report_name, enabled, frequency, last_run_at, next_run_at, deleted_at';

/**
 * Scheduled Report Delivery table schema
 * Indexed fields for efficient queries
 */
export const scheduledReportDeliverySchema =
  'id, schedule_id, company_id, user_id, status, scheduled_at, sent_at, deleted_at';
