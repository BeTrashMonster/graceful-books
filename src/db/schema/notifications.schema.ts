/**
 * Notifications Schema Definition
 *
 * Defines the structure for user notifications including @mentions,
 * approval requests, checklist reminders, and system alerts.
 *
 * Requirements:
 * - I2: Activity Feed & Communication
 * - H3: Approval Workflows notifications
 * - ARCH-002: Zero-knowledge encryption
 * - ARCH-004: CRDT-Compatible Schema Design
 */

import type { BaseEntity, VersionVector } from '../../types/database.types';
import type { CommentableType } from './comments.schema';

// ============================================================================
// Notification Types
// ============================================================================

/**
 * Notification type categories
 */
export enum NotificationType {
  // Communication
  MENTION = 'MENTION', // @mentioned in a comment
  COMMENT_REPLY = 'COMMENT_REPLY', // Reply to your comment
  DIRECT_MESSAGE = 'DIRECT_MESSAGE', // Direct message from team member

  // Approvals
  APPROVAL_REQUEST = 'APPROVAL_REQUEST', // Transaction needs your approval
  APPROVAL_APPROVED = 'APPROVAL_APPROVED', // Your request was approved
  APPROVAL_REJECTED = 'APPROVAL_REJECTED', // Your request was rejected
  APPROVAL_DELEGATED = 'APPROVAL_DELEGATED', // Approval delegated to you

  // Checklists
  CHECKLIST_ASSIGNED = 'CHECKLIST_ASSIGNED', // New checklist item assigned
  CHECKLIST_DUE_SOON = 'CHECKLIST_DUE_SOON', // Checklist item due soon
  CHECKLIST_OVERDUE = 'CHECKLIST_OVERDUE', // Checklist item overdue

  // System
  SYNC_CONFLICT = 'SYNC_CONFLICT', // Data sync conflict needs resolution
  SYSTEM_ALERT = 'SYSTEM_ALERT', // Important system message
}

/**
 * Notification priority levels
 */
export enum NotificationPriority {
  LOW = 'LOW', // Can wait, batch notifications
  NORMAL = 'NORMAL', // Standard notification
  HIGH = 'HIGH', // Important, send immediately
  URGENT = 'URGENT', // Critical, requires attention
}

/**
 * Notification status
 */
export enum NotificationStatus {
  UNREAD = 'UNREAD',
  READ = 'READ',
  ARCHIVED = 'ARCHIVED',
  DISMISSED = 'DISMISSED',
}

/**
 * Notification entity
 * Central notification system for all user alerts
 */
export interface Notification extends BaseEntity {
  company_id: string; // UUID - links to Company
  recipient_user_id: string; // UUID - User receiving notification
  sender_user_id: string | null; // UUID - User who triggered notification (null for system)
  type: NotificationType; // Notification type
  priority: NotificationPriority; // Priority level
  status: NotificationStatus; // Read/unread status
  title: string; // ENCRYPTED - Notification title
  message: string; // ENCRYPTED - Notification message body
  link_url: string | null; // ENCRYPTED - Optional link to related entity
  link_text: string | null; // ENCRYPTED - Link text (e.g., "View Transaction")
  entity_type: CommentableType | null; // Type of related entity
  entity_id: string | null; // UUID - Related entity ID
  comment_id: string | null; // UUID - Related comment (for MENTION, COMMENT_REPLY)
  approval_request_id: string | null; // UUID - Related approval request
  checklist_item_id: string | null; // UUID - Related checklist item
  read_at: number | null; // Unix timestamp when read (null = unread)
  dismissed_at: number | null; // Unix timestamp when dismissed
  expires_at: number | null; // Unix timestamp when notification expires (auto-archive)
  metadata: Record<string, unknown>; // ENCRYPTED - Additional metadata
  version_vector: VersionVector; // For CRDT conflict resolution
}

/**
 * Notification preferences per user
 */
export interface NotificationPreferences extends BaseEntity {
  user_id: string; // UUID - links to User
  company_id: string; // UUID - links to Company

  // Mention preferences
  mentions_enabled: boolean; // Receive @mention notifications
  mentions_email: boolean; // Send email for mentions
  mentions_digest: boolean; // Batch mentions in digest (vs immediate)

  // Comment preferences
  comment_replies_enabled: boolean; // Notify on replies to your comments
  comment_replies_email: boolean; // Send email for replies

  // Approval preferences
  approvals_enabled: boolean; // Receive approval notifications
  approvals_email: boolean; // Send email for approvals
  approvals_urgent_only: boolean; // Only notify for urgent approvals

  // Checklist preferences
  checklist_enabled: boolean; // Receive checklist notifications
  checklist_email: boolean; // Send email for checklist reminders
  checklist_due_days: number; // Days before due to send reminder (default: 1)

  // System preferences
  system_alerts_enabled: boolean; // Receive system alerts
  system_alerts_email: boolean; // Send email for system alerts

  // General preferences
  quiet_hours_enabled: boolean; // Enable quiet hours
  quiet_hours_start: string | null; // Start time (HH:MM format, e.g., "22:00")
  quiet_hours_end: string | null; // End time (HH:MM format, e.g., "08:00")
  timezone: string; // User's timezone for quiet hours

  // Digest preferences
  digest_enabled: boolean; // Enable digest mode
  digest_frequency: 'daily' | 'weekly' | null; // Digest frequency
  digest_time: string | null; // Time to send digest (HH:MM format)

  version_vector: VersionVector; // For CRDT conflict resolution
}

// ============================================================================
// Schema Definitions for Dexie.js
// ============================================================================

/**
 * Dexie.js schema definition for Notifications table
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - company_id: For querying notifications by company
 * - recipient_user_id: For querying user's notifications
 * - [recipient_user_id+status]: Compound index for unread notifications
 * - [recipient_user_id+read_at]: Compound index for sorting by read status
 * - type: For filtering by notification type
 * - priority: For filtering by priority
 * - status: For filtering by status
 * - entity_id: For finding notifications related to an entity
 * - comment_id: For finding notifications related to a comment
 * - expires_at: For cleaning up expired notifications
 * - updated_at: For CRDT conflict resolution
 * - deleted_at: For soft delete tombstone filtering
 */
export const notificationsSchema =
  'id, company_id, recipient_user_id, [recipient_user_id+status], [recipient_user_id+read_at], type, priority, status, entity_id, comment_id, expires_at, updated_at, deleted_at';

/**
 * Dexie.js schema definition for NotificationPreferences table
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - user_id: For querying preferences by user (UNIQUE)
 * - company_id: For querying preferences by company
 * - [user_id+company_id]: Compound index for user-company preferences
 * - updated_at: For CRDT conflict resolution
 * - deleted_at: For soft delete tombstone filtering
 */
export const notificationPreferencesSchema =
  'id, user_id, company_id, [user_id+company_id], updated_at, deleted_at';

// ============================================================================
// Table Name Constants
// ============================================================================

export const NOTIFICATIONS_TABLE = 'notifications';
export const NOTIFICATION_PREFERENCES_TABLE = 'notification_preferences';

// ============================================================================
// Default Value Factories
// ============================================================================

/**
 * Default values for new Notification
 */
export const createDefaultNotification = (
  companyId: string,
  recipientUserId: string,
  type: NotificationType,
  title: string,
  message: string,
  deviceId: string,
  senderUserId: string | null = null
): Partial<Notification> => {
  const now = Date.now();

  // Set default priority based on type
  const priorityMap: Record<NotificationType, NotificationPriority> = {
    [NotificationType.MENTION]: NotificationPriority.NORMAL,
    [NotificationType.COMMENT_REPLY]: NotificationPriority.NORMAL,
    [NotificationType.DIRECT_MESSAGE]: NotificationPriority.HIGH,
    [NotificationType.APPROVAL_REQUEST]: NotificationPriority.HIGH,
    [NotificationType.APPROVAL_APPROVED]: NotificationPriority.NORMAL,
    [NotificationType.APPROVAL_REJECTED]: NotificationPriority.NORMAL,
    [NotificationType.APPROVAL_DELEGATED]: NotificationPriority.HIGH,
    [NotificationType.CHECKLIST_ASSIGNED]: NotificationPriority.NORMAL,
    [NotificationType.CHECKLIST_DUE_SOON]: NotificationPriority.NORMAL,
    [NotificationType.CHECKLIST_OVERDUE]: NotificationPriority.HIGH,
    [NotificationType.SYNC_CONFLICT]: NotificationPriority.URGENT,
    [NotificationType.SYSTEM_ALERT]: NotificationPriority.HIGH,
  };

  // Set expiration based on type
  const expirationMap: Record<NotificationType, number | null> = {
    [NotificationType.MENTION]: 30 * 24 * 60 * 60 * 1000, // 30 days
    [NotificationType.COMMENT_REPLY]: 30 * 24 * 60 * 60 * 1000, // 30 days
    [NotificationType.DIRECT_MESSAGE]: null, // Never expire
    [NotificationType.APPROVAL_REQUEST]: null, // Never expire
    [NotificationType.APPROVAL_APPROVED]: 7 * 24 * 60 * 60 * 1000, // 7 days
    [NotificationType.APPROVAL_REJECTED]: 7 * 24 * 60 * 60 * 1000, // 7 days
    [NotificationType.APPROVAL_DELEGATED]: null, // Never expire
    [NotificationType.CHECKLIST_ASSIGNED]: null, // Never expire
    [NotificationType.CHECKLIST_DUE_SOON]: 3 * 24 * 60 * 60 * 1000, // 3 days
    [NotificationType.CHECKLIST_OVERDUE]: null, // Never expire
    [NotificationType.SYNC_CONFLICT]: null, // Never expire
    [NotificationType.SYSTEM_ALERT]: 14 * 24 * 60 * 60 * 1000, // 14 days
  };

  const expirationMs = expirationMap[type];
  const expiresAt = expirationMs ? now + expirationMs : null;

  return {
    company_id: companyId,
    recipient_user_id: recipientUserId,
    sender_user_id: senderUserId,
    type,
    priority: priorityMap[type],
    status: NotificationStatus.UNREAD,
    title,
    message,
    link_url: null,
    link_text: null,
    entity_type: null,
    entity_id: null,
    comment_id: null,
    approval_request_id: null,
    checklist_item_id: null,
    read_at: null,
    dismissed_at: null,
    expires_at: expiresAt,
    metadata: {},
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version_vector: {
      [deviceId]: 1,
    },
  };
};

/**
 * Default values for new NotificationPreferences
 */
export const createDefaultNotificationPreferences = (
  userId: string,
  companyId: string,
  deviceId: string
): Partial<NotificationPreferences> => {
  const now = Date.now();

  return {
    user_id: userId,
    company_id: companyId,

    // Mention preferences (enabled by default)
    mentions_enabled: true,
    mentions_email: false,
    mentions_digest: false,

    // Comment preferences (enabled by default)
    comment_replies_enabled: true,
    comment_replies_email: false,

    // Approval preferences (enabled by default)
    approvals_enabled: true,
    approvals_email: true, // Email for approvals by default
    approvals_urgent_only: false,

    // Checklist preferences (enabled by default)
    checklist_enabled: true,
    checklist_email: false,
    checklist_due_days: 1, // Remind 1 day before due

    // System preferences (enabled by default)
    system_alerts_enabled: true,
    system_alerts_email: true, // Email for system alerts by default

    // Quiet hours (disabled by default)
    quiet_hours_enabled: false,
    quiet_hours_start: null,
    quiet_hours_end: null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,

    // Digest (disabled by default)
    digest_enabled: false,
    digest_frequency: null,
    digest_time: null,

    created_at: now,
    updated_at: now,
    deleted_at: null,
    version_vector: {
      [deviceId]: 1,
    },
  };
};

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate Notification has required fields
 */
export const validateNotification = (notification: Partial<Notification>): string[] => {
  const errors: string[] = [];

  if (!notification.company_id) {
    errors.push('company_id is required');
  }

  if (!notification.recipient_user_id) {
    errors.push('recipient_user_id is required');
  }

  if (!notification.type) {
    errors.push('type is required');
  }

  if (!notification.title || notification.title.trim() === '') {
    errors.push('title is required');
  }

  if (!notification.message || notification.message.trim() === '') {
    errors.push('message is required');
  }

  if (notification.title && notification.title.length > 200) {
    errors.push('title must not exceed 200 characters');
  }

  if (notification.message && notification.message.length > 1000) {
    errors.push('message must not exceed 1000 characters');
  }

  return errors;
};

/**
 * Validate NotificationPreferences has required fields
 */
export const validateNotificationPreferences = (
  preferences: Partial<NotificationPreferences>
): string[] => {
  const errors: string[] = [];

  if (!preferences.user_id) {
    errors.push('user_id is required');
  }

  if (!preferences.company_id) {
    errors.push('company_id is required');
  }

  // Validate quiet hours format
  if (preferences.quiet_hours_enabled) {
    if (!preferences.quiet_hours_start || !preferences.quiet_hours_end) {
      errors.push('quiet_hours_start and quiet_hours_end required when enabled');
    }

    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (preferences.quiet_hours_start && !timeRegex.test(preferences.quiet_hours_start)) {
      errors.push('quiet_hours_start must be in HH:MM format (00:00-23:59)');
    }
    if (preferences.quiet_hours_end && !timeRegex.test(preferences.quiet_hours_end)) {
      errors.push('quiet_hours_end must be in HH:MM format (00:00-23:59)');
    }
  }

  // Validate digest settings
  if (preferences.digest_enabled) {
    if (!preferences.digest_frequency) {
      errors.push('digest_frequency required when digest enabled');
    }
    if (!preferences.digest_time) {
      errors.push('digest_time required when digest enabled');
    }

    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (preferences.digest_time && !timeRegex.test(preferences.digest_time)) {
      errors.push('digest_time must be in HH:MM format (00:00-23:59)');
    }
  }

  // Validate checklist_due_days
  if (preferences.checklist_due_days !== undefined) {
    if (preferences.checklist_due_days < 0 || preferences.checklist_due_days > 30) {
      errors.push('checklist_due_days must be between 0 and 30');
    }
  }

  return errors;
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if notification is unread
 */
export const isNotificationUnread = (notification: Notification): boolean => {
  return notification.status === NotificationStatus.UNREAD && notification.read_at === null;
};

/**
 * Check if notification is expired
 */
export const isNotificationExpired = (notification: Notification): boolean => {
  if (!notification.expires_at) {
    return false;
  }
  return Date.now() >= notification.expires_at;
};

/**
 * Check if notification should be sent (respects quiet hours)
 */
export const shouldSendNotification = (
  preferences: NotificationPreferences,
  notificationType: NotificationType
): boolean => {
  // Check if notification type is enabled
  const typeEnabledMap: Record<NotificationType, boolean> = {
    [NotificationType.MENTION]: preferences.mentions_enabled,
    [NotificationType.COMMENT_REPLY]: preferences.comment_replies_enabled,
    [NotificationType.DIRECT_MESSAGE]: preferences.mentions_enabled, // Use mentions setting
    [NotificationType.APPROVAL_REQUEST]: preferences.approvals_enabled,
    [NotificationType.APPROVAL_APPROVED]: preferences.approvals_enabled,
    [NotificationType.APPROVAL_REJECTED]: preferences.approvals_enabled,
    [NotificationType.APPROVAL_DELEGATED]: preferences.approvals_enabled,
    [NotificationType.CHECKLIST_ASSIGNED]: preferences.checklist_enabled,
    [NotificationType.CHECKLIST_DUE_SOON]: preferences.checklist_enabled,
    [NotificationType.CHECKLIST_OVERDUE]: preferences.checklist_enabled,
    [NotificationType.SYNC_CONFLICT]: preferences.system_alerts_enabled,
    [NotificationType.SYSTEM_ALERT]: preferences.system_alerts_enabled,
  };

  if (!typeEnabledMap[notificationType]) {
    return false;
  }

  // Check quiet hours
  if (preferences.quiet_hours_enabled && preferences.quiet_hours_start && preferences.quiet_hours_end) {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const start = preferences.quiet_hours_start;
    const end = preferences.quiet_hours_end;

    // Handle quiet hours that span midnight
    if (start > end) {
      // Quiet hours like 22:00 to 08:00 (spans midnight)
      if (currentTime >= start || currentTime < end) {
        // Urgent notifications bypass quiet hours
        return false;
      }
    } else {
      // Quiet hours like 08:00 to 22:00 (same day)
      if (currentTime >= start && currentTime < end) {
        return false;
      }
    }
  }

  return true;
};

/**
 * Check if email should be sent for notification
 */
export const shouldSendEmail = (
  preferences: NotificationPreferences,
  notificationType: NotificationType
): boolean => {
  const typeEmailMap: Record<NotificationType, boolean> = {
    [NotificationType.MENTION]: preferences.mentions_email,
    [NotificationType.COMMENT_REPLY]: preferences.comment_replies_email,
    [NotificationType.DIRECT_MESSAGE]: preferences.mentions_email, // Use mentions setting
    [NotificationType.APPROVAL_REQUEST]: preferences.approvals_email,
    [NotificationType.APPROVAL_APPROVED]: preferences.approvals_email,
    [NotificationType.APPROVAL_REJECTED]: preferences.approvals_email,
    [NotificationType.APPROVAL_DELEGATED]: preferences.approvals_email,
    [NotificationType.CHECKLIST_ASSIGNED]: preferences.checklist_email,
    [NotificationType.CHECKLIST_DUE_SOON]: preferences.checklist_email,
    [NotificationType.CHECKLIST_OVERDUE]: preferences.checklist_email,
    [NotificationType.SYNC_CONFLICT]: preferences.system_alerts_email,
    [NotificationType.SYSTEM_ALERT]: preferences.system_alerts_email,
  };

  return typeEmailMap[notificationType];
};

/**
 * Get notification type display name
 */
export const getNotificationTypeDisplay = (type: NotificationType): string => {
  const displays: Record<NotificationType, string> = {
    [NotificationType.MENTION]: 'Mention',
    [NotificationType.COMMENT_REPLY]: 'Comment Reply',
    [NotificationType.DIRECT_MESSAGE]: 'Direct Message',
    [NotificationType.APPROVAL_REQUEST]: 'Approval Request',
    [NotificationType.APPROVAL_APPROVED]: 'Approved',
    [NotificationType.APPROVAL_REJECTED]: 'Rejected',
    [NotificationType.APPROVAL_DELEGATED]: 'Delegated',
    [NotificationType.CHECKLIST_ASSIGNED]: 'Checklist Assigned',
    [NotificationType.CHECKLIST_DUE_SOON]: 'Due Soon',
    [NotificationType.CHECKLIST_OVERDUE]: 'Overdue',
    [NotificationType.SYNC_CONFLICT]: 'Sync Conflict',
    [NotificationType.SYSTEM_ALERT]: 'System Alert',
  };
  return displays[type];
};

/**
 * Get notification priority display name
 */
export const getNotificationPriorityDisplay = (priority: NotificationPriority): string => {
  const displays: Record<NotificationPriority, string> = {
    [NotificationPriority.LOW]: 'Low',
    [NotificationPriority.NORMAL]: 'Normal',
    [NotificationPriority.HIGH]: 'High',
    [NotificationPriority.URGENT]: 'Urgent',
  };
  return displays[priority];
};

// ============================================================================
// Query Helpers
// ============================================================================

/**
 * Query helper: Get notifications for a user
 */
export interface GetNotificationsQuery {
  company_id: string;
  recipient_user_id: string;
  status?: NotificationStatus;
  type?: NotificationType;
  unread_only?: boolean;
  limit?: number;
  include_expired?: boolean;
}

/**
 * Query helper: Get unread notification count
 */
export interface GetUnreadCountQuery {
  company_id: string;
  recipient_user_id: string;
  type?: NotificationType;
}
