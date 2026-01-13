/**
 * Email Preferences Schema Index Definition
 *
 * Defines Dexie index schema for email preferences and delivery tables.
 */

/**
 * Email Preferences table schema
 * Indexed fields for efficient queries
 */
export const emailPreferencesSchema =
  'id, user_id, company_id, enabled, frequency, day_of_week, next_scheduled_at, unsubscribed_at, deleted_at';

/**
 * Email Delivery table schema
 * Indexed fields for efficient queries
 */
export const emailDeliverySchema =
  'id, user_id, company_id, status, scheduled_at, sent_at, email_type, deleted_at';
