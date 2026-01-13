/**
 * Email Preferences Database Schema
 *
 * Per D3: Weekly Email Summary Setup
 * Stores user email notification preferences with CRDT support.
 */

import type { Table } from 'dexie';
import type { VersionVector } from '../../types/crdt.types';
import type { DayOfWeek, EmailFrequency, EmailContentSection } from '../../types/email.types';

/**
 * Email preferences entity (stored in IndexedDB)
 */
export interface EmailPreferencesEntity {
  id: string; // Primary key
  user_id: string; // Indexed
  company_id: string; // Indexed

  // Scheduling
  enabled: boolean;
  frequency: EmailFrequency;
  day_of_week: DayOfWeek;
  time_of_day: string; // HH:MM format
  timezone: string; // IANA timezone

  // Content preferences (stored as JSON array)
  include_sections: EmailContentSection[];
  max_tasks_to_show: number;

  // DISC adaptation
  disc_profile_id: string | null;
  use_disc_adaptation: boolean;

  // Delivery tracking
  last_sent_at: Date | null;
  next_scheduled_at: Date | null;

  // Unsubscribe
  unsubscribed_at: Date | null;
  unsubscribe_reason: string | null;

  // CRDT fields
  version_vector: VersionVector;
  last_modified_by: string; // Device ID
  last_modified_at: Date;

  // Soft delete
  deleted_at: Date | null;

  // Timestamps
  created_at: Date;
  updated_at: Date;
}

/**
 * Email delivery record entity
 */
export interface EmailDeliveryEntity {
  id: string; // Primary key
  user_id: string; // Indexed
  company_id: string; // Indexed

  // Email details
  email_type: 'weekly-summary' | 'reminder' | 'notification';
  recipient_email: string;
  subject: string;

  // Status
  status: 'pending' | 'sending' | 'sent' | 'failed' | 'bounced' | 'unsubscribed';
  scheduled_at: Date; // Indexed
  sent_at: Date | null;
  delivered_at: Date | null;
  opened_at: Date | null;
  clicked_at: Date | null;
  failed_at: Date | null;
  failure_reason: string | null;

  // Retry tracking
  retry_count: number;
  max_retries: number;
  last_retry_at: Date | null;

  // Content reference
  content_hash: string;

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

/**
 * Type for Dexie table
 */
export type EmailPreferencesTable = Table<EmailPreferencesEntity, string>;
export type EmailDeliveryTable = Table<EmailDeliveryEntity, string>;

/**
 * Default email preferences factory
 */
export function createDefaultEmailPreferences(
  userId: string,
  companyId: string,
  deviceId: string
): Omit<EmailPreferencesEntity, 'id' | 'created_at' | 'updated_at'> {
  const now = new Date();

  return {
    user_id: userId,
    company_id: companyId,

    // Default to Monday morning, 8 AM
    enabled: false, // Opt-in by default
    frequency: 'weekly',
    day_of_week: 'monday',
    time_of_day: '08:00',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,

    // Default sections
    include_sections: [
      'checklist-summary',
      'foundation-tasks',
      'upcoming-deadlines',
      'quick-tips',
      'progress-update',
    ],
    max_tasks_to_show: 5,

    // DISC adaptation
    disc_profile_id: null,
    use_disc_adaptation: true,

    // Delivery tracking
    last_sent_at: null,
    next_scheduled_at: null,

    // Unsubscribe
    unsubscribed_at: null,
    unsubscribe_reason: null,

    // CRDT fields
    version_vector: { [deviceId]: 1 },
    last_modified_by: deviceId,
    last_modified_at: now,

    // Soft delete
    deleted_at: null,
  };
}

/**
 * Default email delivery record factory
 */
export function createEmailDeliveryRecord(
  userId: string,
  companyId: string,
  recipientEmail: string,
  subject: string,
  scheduledAt: Date,
  deviceId: string,
  emailType: 'weekly-summary' | 'reminder' | 'notification' = 'weekly-summary'
): Omit<EmailDeliveryEntity, 'id' | 'created_at' | 'updated_at'> {
  const now = new Date();

  return {
    user_id: userId,
    company_id: companyId,

    // Email details
    email_type: emailType,
    recipient_email: recipientEmail,
    subject,

    // Status
    status: 'pending',
    scheduled_at: scheduledAt,
    sent_at: null,
    delivered_at: null,
    opened_at: null,
    clicked_at: null,
    failed_at: null,
    failure_reason: null,

    // Retry tracking
    retry_count: 0,
    max_retries: 3,
    last_retry_at: null,

    // Content hash (for deduplication)
    content_hash: '',

    // CRDT fields
    version_vector: { [deviceId]: 1 },
    last_modified_by: deviceId,
    last_modified_at: now,

    // Soft delete
    deleted_at: null,
  };
}

/**
 * Validate email preferences
 */
export function validateEmailPreferences(
  prefs: Partial<EmailPreferencesEntity>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate time format (HH:MM)
  if (prefs.time_of_day && !/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(prefs.time_of_day)) {
    errors.push('time_of_day must be in HH:MM format (e.g., 08:00)');
  }

  // Validate max tasks
  if (prefs.max_tasks_to_show !== undefined) {
    if (prefs.max_tasks_to_show < 1 || prefs.max_tasks_to_show > 20) {
      errors.push('max_tasks_to_show must be between 1 and 20');
    }
  }

  // Validate sections array
  if (prefs.include_sections !== undefined) {
    if (!Array.isArray(prefs.include_sections)) {
      errors.push('include_sections must be an array');
    } else if (prefs.include_sections.length === 0) {
      errors.push('At least one section must be included in emails');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
