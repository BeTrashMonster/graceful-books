/**
 * Multi-User Notification Service with DISC Adaptation
 *
 * Implements H2: DISC-Adapted Notification System per ROADMAP.md
 *
 * Key Features:
 * - 4 DISC personality variants for every message
 * - Context-aware notifications for multi-user events
 * - In-app and email notification support
 * - User preference management
 * - Notification batching and throttling
 *
 * DISC Communication Styles:
 * - D (Dominance): Direct, concise, results-oriented
 * - I (Influence): Warm, encouraging, collaborative
 * - S (Steadiness): Patient, step-by-step, supportive
 * - C (Conscientiousness): Analytical, detailed, precise
 */

import type { User, CompanyUser } from '../../types/database.types';
import { logger } from '../../utils/logger';
import { generateId } from '../../utils/device';

const log = logger.child('MultiUserNotification');

/**
 * DISC personality type
 */
export type DISCType = 'D' | 'I' | 'S' | 'C';

/**
 * Notification type
 */
export enum NotificationType {
  // User Management
  USER_INVITED = 'USER_INVITED',
  USER_JOINED = 'USER_JOINED',
  USER_ROLE_CHANGED = 'USER_ROLE_CHANGED',
  USER_ACCESS_REVOKED = 'USER_ACCESS_REVOKED',
  USER_ACCESS_RESTORED = 'USER_ACCESS_RESTORED',

  // Key Rotation
  KEY_ROTATION_STARTED = 'KEY_ROTATION_STARTED',
  KEY_ROTATION_COMPLETED = 'KEY_ROTATION_COMPLETED',
  KEY_ROTATION_FAILED = 'KEY_ROTATION_FAILED',

  // Session
  SESSION_INVALIDATED = 'SESSION_INVALIDATED',
  CONCURRENT_SESSION_DETECTED = 'CONCURRENT_SESSION_DETECTED',

  // Security
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  EXPORT_REQUESTED = 'EXPORT_REQUESTED',
}

/**
 * Notification priority
 */
export enum NotificationPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

/**
 * Notification channel
 */
export enum NotificationChannel {
  IN_APP = 'IN_APP',
  EMAIL = 'EMAIL',
  BOTH = 'BOTH',
}

/**
 * DISC message variants for a notification
 */
export interface DISCMessageVariants {
  D: string; // Dominance: Direct and concise
  I: string; // Influence: Warm and encouraging
  S: string; // Steadiness: Patient and supportive
  C: string; // Conscientiousness: Analytical and detailed
}

/**
 * Notification template
 */
export interface NotificationTemplate {
  type: NotificationType;
  priority: NotificationPriority;
  defaultChannel: NotificationChannel;
  title: DISCMessageVariants;
  body: DISCMessageVariants;
  action?: {
    label: DISCMessageVariants;
    url: string;
  };
}

/**
 * Notification instance
 */
export interface Notification {
  id: string;
  userId: string;
  companyId: string;
  type: NotificationType;
  priority: NotificationPriority;
  channel: NotificationChannel;
  title: string;
  body: string;
  actionLabel?: string;
  actionUrl?: string;
  read: boolean;
  createdAt: number;
  readAt?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Notification preferences
 */
export interface NotificationPreferences {
  userId: string;
  discType: DISCType;
  enableInApp: boolean;
  enableEmail: boolean;
  quietHoursStart?: string; // HH:MM format
  quietHoursEnd?: string; // HH:MM format
  disabledTypes: NotificationType[];
}

/**
 * Notification templates with DISC variants
 */
const NOTIFICATION_TEMPLATES: Record<NotificationType, NotificationTemplate> = {
  [NotificationType.USER_INVITED]: {
    type: NotificationType.USER_INVITED,
    priority: NotificationPriority.MEDIUM,
    defaultChannel: NotificationChannel.BOTH,
    title: {
      D: 'New team member invited',
      I: "You've invited someone to join!",
      S: 'Team invitation sent',
      C: 'User invitation processed',
    },
    body: {
      D: '{invitedEmail} invited as {role}. They can access the system once they accept.',
      I: "Great news! You've invited {invitedEmail} to join as {role}. They'll love working with the team!",
      S: "Your invitation to {invitedEmail} has been sent. When they accept, they'll join as {role}. Everything is set up and ready for them.",
      C: 'Invitation sent to {invitedEmail} with role assignment: {role}. Access will be granted upon acceptance of invitation.',
    },
  },

  [NotificationType.USER_JOINED]: {
    type: NotificationType.USER_JOINED,
    priority: NotificationPriority.MEDIUM,
    defaultChannel: NotificationChannel.IN_APP,
    title: {
      D: 'New team member joined',
      I: 'Welcome the newest member!',
      S: 'Someone new joined your team',
      C: 'New user account activated',
    },
    body: {
      D: '{userName} joined as {role}.',
      I: '{userName} just joined the team as {role}! Say hello and help them feel welcome.',
      S: '{userName} has joined your team as {role}. They might appreciate a warm welcome and some guidance getting started.',
      C: 'User account for {userName} has been activated with role: {role}. Access permissions have been applied.',
    },
  },

  [NotificationType.USER_ROLE_CHANGED]: {
    type: NotificationType.USER_ROLE_CHANGED,
    priority: NotificationPriority.HIGH,
    defaultChannel: NotificationChannel.BOTH,
    title: {
      D: 'Your role changed',
      I: 'Your responsibilities have been updated',
      S: 'Your role has been adjusted',
      C: 'Role assignment modified',
    },
    body: {
      D: 'Role changed from {oldRole} to {newRole}. Your access has been updated.',
      I: "Good news! You've been promoted from {oldRole} to {newRole}. Congratulations on your new responsibilities!",
      S: "Your role has been updated from {oldRole} to {newRole}. Take your time exploring your new permissions. We're here if you need any help.",
      C: 'Your role assignment has been modified. Previous role: {oldRole}. New role: {newRole}. Associated permissions have been updated accordingly.',
    },
  },

  [NotificationType.USER_ACCESS_REVOKED]: {
    type: NotificationType.USER_ACCESS_REVOKED,
    priority: NotificationPriority.URGENT,
    defaultChannel: NotificationChannel.BOTH,
    title: {
      D: 'Access revoked',
      I: 'Access update required',
      S: 'Your access has been changed',
      C: 'Access privileges revoked',
    },
    body: {
      D: 'Your access to {companyName} has been revoked. Contact your administrator for questions.',
      I: 'Your access to {companyName} has been updated. If you have questions, your administrator is happy to help.',
      S: "Your access to {companyName} has been changed. If you need clarification or think this was done in error, please reach out to your administrator. They'll be glad to help.",
      C: 'Access privileges for {companyName} have been revoked. All active sessions have been terminated. For clarification, contact system administrator.',
    },
  },

  [NotificationType.USER_ACCESS_RESTORED]: {
    type: NotificationType.USER_ACCESS_RESTORED,
    priority: NotificationPriority.HIGH,
    defaultChannel: NotificationChannel.BOTH,
    title: {
      D: 'Access restored',
      I: 'Welcome back!',
      S: 'Your access is back',
      C: 'Access privileges restored',
    },
    body: {
      D: 'Your access to {companyName} is active again. Sign in to continue.',
      I: 'Great news! Your access to {companyName} has been restored. Welcome back to the team!',
      S: "Your access to {companyName} has been restored. You can sign in again whenever you're ready. Everything is set up for you.",
      C: 'Access privileges for {companyName} have been restored. Authentication and authorization are now active.',
    },
  },

  [NotificationType.KEY_ROTATION_STARTED]: {
    type: NotificationType.KEY_ROTATION_STARTED,
    priority: NotificationPriority.MEDIUM,
    defaultChannel: NotificationChannel.IN_APP,
    title: {
      D: 'Security update in progress',
      I: "We're making things more secure!",
      S: 'Security enhancement underway',
      C: 'Encryption key rotation initiated',
    },
    body: {
      D: 'Security keys are being updated. This takes under a minute. Your data remains secure.',
      I: "We're updating your security keys to keep everything safe and sound! This'll just take a moment.",
      S: "We're updating the security keys that protect your data. This process is automatic and will complete in less than a minute. Your information is safe throughout the process.",
      C: 'Encryption key rotation process initiated. Estimated completion time: 30-45 seconds. All data encryption remains active during rotation.',
    },
  },

  [NotificationType.KEY_ROTATION_COMPLETED]: {
    type: NotificationType.KEY_ROTATION_COMPLETED,
    priority: NotificationPriority.LOW,
    defaultChannel: NotificationChannel.IN_APP,
    title: {
      D: 'Security update complete',
      I: 'All secure!',
      S: 'Security update finished',
      C: 'Key rotation completed successfully',
    },
    body: {
      D: 'Security keys updated successfully. Your data remains secure and private.',
      I: 'Perfect! Your security keys are all updated. Everything is safe and you can keep working without any interruption.',
      S: 'The security update is complete. All your data remains safe and private, just as before. You can continue working normally.',
      C: 'Encryption key rotation completed in {duration}ms. All data re-encrypted successfully. Zero-knowledge architecture maintained.',
    },
  },

  [NotificationType.KEY_ROTATION_FAILED]: {
    type: NotificationType.KEY_ROTATION_FAILED,
    priority: NotificationPriority.URGENT,
    defaultChannel: NotificationChannel.BOTH,
    title: {
      D: 'Security update issue',
      I: 'We hit a snag',
      S: 'Security update needs attention',
      C: 'Key rotation failure detected',
    },
    body: {
      D: 'Security update failed. Your data is still secure. Contact support.',
      I: "We ran into an issue updating the security keys. Don't worry - your data is still completely safe! We're looking into it.",
      S: 'The security update encountered a problem and needs to be retried. Your data remains protected and secure. Our team is aware and working on it.',
      C: 'Encryption key rotation process failed. Error: {errorMessage}. Data integrity maintained. Automatic rollback completed. System administrator notified.',
    },
  },

  [NotificationType.SESSION_INVALIDATED]: {
    type: NotificationType.SESSION_INVALIDATED,
    priority: NotificationPriority.HIGH,
    defaultChannel: NotificationChannel.IN_APP,
    title: {
      D: 'Session ended',
      I: 'Time to sign in again',
      S: 'Your session has ended',
      C: 'Session invalidation occurred',
    },
    body: {
      D: 'Your session was ended for security. Sign in again to continue.',
      I: 'For your security, we signed you out. Just sign back in to pick up where you left off!',
      S: "Your session has been ended for security purposes. Take a moment to sign in again when you're ready to continue.",
      C: 'Session invalidated due to: {reason}. Re-authentication required to restore access. All local data remains encrypted.',
    },
  },

  [NotificationType.CONCURRENT_SESSION_DETECTED]: {
    type: NotificationType.CONCURRENT_SESSION_DETECTED,
    priority: NotificationPriority.MEDIUM,
    defaultChannel: NotificationChannel.IN_APP,
    title: {
      D: 'Multiple devices detected',
      I: 'Signed in elsewhere?',
      S: 'We noticed another login',
      C: 'Concurrent session authentication',
    },
    body: {
      D: "You're signed in on {deviceCount} devices. If this wasn't you, secure your account immediately.",
      I: "Looks like you're signed in on {deviceCount} devices! If that's not you, you might want to check your account security.",
      S: "We noticed you're signed in on {deviceCount} different devices. If you don't recognize all of them, you can review and sign them out from your security settings.",
      C: 'Multiple concurrent sessions detected: {deviceCount} active devices. Review active sessions in Security Settings if unauthorized access is suspected.',
    },
  },

  [NotificationType.PASSWORD_CHANGED]: {
    type: NotificationType.PASSWORD_CHANGED,
    priority: NotificationPriority.HIGH,
    defaultChannel: NotificationChannel.BOTH,
    title: {
      D: 'Password changed',
      I: 'Password updated!',
      S: 'Your password was changed',
      C: 'Password modification confirmed',
    },
    body: {
      D: "Password changed successfully. Contact support if you didn't make this change.",
      I: "Your password has been updated! If you didn't make this change, reach out to us right away.",
      S: "Your password was changed. If you made this change, you're all set. If not, please contact support immediately so we can help secure your account.",
      C: 'Password modification completed at {timestamp}. If this change was unauthorized, initiate account recovery procedure immediately.',
    },
  },

  [NotificationType.SUSPICIOUS_ACTIVITY]: {
    type: NotificationType.SUSPICIOUS_ACTIVITY,
    priority: NotificationPriority.URGENT,
    defaultChannel: NotificationChannel.BOTH,
    title: {
      D: 'Unusual activity detected',
      I: 'Something seems off',
      S: 'We noticed something unusual',
      C: 'Anomalous access pattern detected',
    },
    body: {
      D: 'Unusual activity on your account. Review your recent activity and secure your account if needed.',
      I: "We noticed some unusual activity on your account. It might be nothing, but it's worth a quick check to make sure everything's okay!",
      S: 'We detected some activity that seems different from your normal patterns. This might be completely fine, but we wanted to let you know so you can take a look and make sure everything is as it should be.',
      C: 'Anomalous access pattern detected: {activityType} from {location}. Review security log for details. Initiate security measures if unauthorized.',
    },
  },

  [NotificationType.EXPORT_REQUESTED]: {
    type: NotificationType.EXPORT_REQUESTED,
    priority: NotificationPriority.LOW,
    defaultChannel: NotificationChannel.IN_APP,
    title: {
      D: 'Export ready',
      I: 'Your export is ready!',
      S: 'Your data export is complete',
      C: 'Data export process completed',
    },
    body: {
      D: 'Your {exportType} export is ready. Download it now.',
      I: 'Great news! Your {exportType} export is all ready for you to download. Click here to get it!',
      S: "Your {exportType} export has finished processing and is ready for download. Take your time - it'll be available whenever you need it.",
      C: 'Data export completed: {exportType}. File size: {fileSize}. Retention period: 7 days. Download available via secure link.',
    },
  },
};

/**
 * Multi-User Notification Service
 */
export class MultiUserNotificationService {
  private notifications: Map<string, Notification> = new Map();
  private preferences: Map<string, NotificationPreferences> = new Map();
  private readonly MAX_IN_APP_NOTIFICATIONS = 100;

  /**
   * Send a notification to a user
   *
   * @param userId - User ID to send to
   * @param companyId - Company ID
   * @param type - Notification type
   * @param variables - Template variables
   * @param priority - Override default priority
   * @param channel - Override default channel
   * @returns Promise resolving to notification ID
   */
  async sendNotification(
    userId: string,
    companyId: string,
    type: NotificationType,
    variables: Record<string, unknown> = {},
    priority?: NotificationPriority,
    channel?: NotificationChannel
  ): Promise<string> {
    try {
      // Get template
      const template = NOTIFICATION_TEMPLATES[type];
      if (!template) {
        log.error('Unknown notification type', { type });
        return '';
      }

      // Get user DISC type
      const discType = await this.getUserDISCType(userId);

      // Get user preferences
      const prefs = await this.getUserPreferences(userId);

      // Check if user has disabled this notification type
      if (prefs.disabledTypes.includes(type)) {
        log.debug('Notification disabled by user', { userId, type });
        return '';
      }

      // Check quiet hours
      if (this.isInQuietHours(prefs)) {
        log.debug('User in quiet hours', { userId });
        // Queue for later or skip non-urgent
        if (priority !== NotificationPriority.URGENT) {
          return '';
        }
      }

      // Select message based on DISC type
      const title = this.interpolate(template.title[discType], variables);
      const body = this.interpolate(template.body[discType], variables);
      const actionLabel = template.action
        ? this.interpolate(template.action.label[discType], variables)
        : undefined;

      // Create notification
      const notification: Notification = {
        id: generateId(),
        userId,
        companyId,
        type,
        priority: priority || template.priority,
        channel: channel || template.defaultChannel,
        title,
        body,
        actionLabel,
        actionUrl: template.action?.url,
        read: false,
        createdAt: Date.now(),
        metadata: variables,
      };

      // Store in-app notification
      if (
        notification.channel === NotificationChannel.IN_APP ||
        notification.channel === NotificationChannel.BOTH
      ) {
        this.notifications.set(notification.id, notification);
        this.pruneOldNotifications(userId);
      }

      // Send email notification (stub - would integrate with email service)
      if (
        notification.channel === NotificationChannel.EMAIL ||
        notification.channel === NotificationChannel.BOTH
      ) {
        if (prefs.enableEmail) {
          await this.sendEmailNotification(userId, notification);
        }
      }

      log.debug('Notification sent', { userId, type, channel: notification.channel });
      return notification.id;
    } catch (error) {
      log.error('Failed to send notification', { userId, type, error });
      return '';
    }
  }

  /**
   * Get user's DISC personality type
   */
  private async getUserDISCType(_userId: string): Promise<DISCType> {
    try {
      // TODO: Fetch user preferences to get actual DISC type
      // In a real implementation, this would be stored in user preferences
      // For now, default to Steadiness (most supportive)
      return 'S';
    } catch (error) {
      log.error('Failed to get user DISC type', { userId, error });
      return 'S'; // Default to Steadiness
    }
  }

  /**
   * Get user notification preferences
   */
  private async getUserPreferences(userId: string): Promise<NotificationPreferences> {
    // Check cache first
    const cached = this.preferences.get(userId);
    if (cached) {
      return cached;
    }

    // Load from database (stub - would be in user preferences)
    const prefs: NotificationPreferences = {
      userId,
      discType: 'S',
      enableInApp: true,
      enableEmail: true,
      disabledTypes: [],
    };

    this.preferences.set(userId, prefs);
    return prefs;
  }

  /**
   * Check if current time is in user's quiet hours
   */
  private isInQuietHours(prefs: NotificationPreferences): boolean {
    if (!prefs.quietHoursStart || !prefs.quietHoursEnd) {
      return false;
    }

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    // Simple time range check (doesn't handle overnight ranges)
    return (
      currentTime >= prefs.quietHoursStart && currentTime <= prefs.quietHoursEnd
    );
  }

  /**
   * Interpolate template variables
   */
  private interpolate(template: string, variables: Record<string, unknown>): string {
    let result = template;

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{${key}}`;
      result = result.replace(new RegExp(placeholder, 'g'), String(value));
    }

    return result;
  }

  /**
   * Send email notification (stub for future implementation)
   */
  private async sendEmailNotification(
    userId: string,
    notification: Notification
  ): Promise<void> {
    log.debug('Email notification queued', { userId, notificationId: notification.id });
    // Would integrate with email service here
  }

  /**
   * Prune old notifications to maintain max limit
   */
  private pruneOldNotifications(userId: string): void {
    const userNotifications = Array.from(this.notifications.values())
      .filter((n) => n.userId === userId)
      .sort((a, b) => b.createdAt - a.createdAt);

    if (userNotifications.length > this.MAX_IN_APP_NOTIFICATIONS) {
      const toRemove = userNotifications.slice(this.MAX_IN_APP_NOTIFICATIONS);
      for (const notification of toRemove) {
        this.notifications.delete(notification.id);
      }
    }
  }

  /**
   * Get unread notifications for a user
   */
  getUnreadNotifications(userId: string): Notification[] {
    return Array.from(this.notifications.values())
      .filter((n) => n.userId === userId && !n.read)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Get all notifications for a user
   */
  getAllNotifications(userId: string, limit: number = 50): Notification[] {
    return Array.from(this.notifications.values())
      .filter((n) => n.userId === userId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }

  /**
   * Mark notification as read
   */
  markAsRead(notificationId: string): boolean {
    const notification = this.notifications.get(notificationId);
    if (!notification) {
      return false;
    }

    notification.read = true;
    notification.readAt = Date.now();
    this.notifications.set(notificationId, notification);
    return true;
  }

  /**
   * Mark all notifications as read for a user
   */
  markAllAsRead(userId: string): number {
    let count = 0;
    for (const [id, notification] of this.notifications.entries()) {
      if (notification.userId === userId && !notification.read) {
        notification.read = true;
        notification.readAt = Date.now();
        this.notifications.set(id, notification);
        count++;
      }
    }
    return count;
  }

  /**
   * Delete a notification
   */
  deleteNotification(notificationId: string): boolean {
    return this.notifications.delete(notificationId);
  }

  /**
   * Update user notification preferences
   */
  async updatePreferences(
    userId: string,
    updates: Partial<NotificationPreferences>
  ): Promise<void> {
    const current = await this.getUserPreferences(userId);
    const updated = { ...current, ...updates, userId };
    this.preferences.set(userId, updated);
    log.debug('Notification preferences updated', { userId });
  }

  /**
   * Batch send notifications to multiple users
   */
  async sendBatchNotification(
    userIds: string[],
    companyId: string,
    type: NotificationType,
    variables: Record<string, unknown> = {}
  ): Promise<string[]> {
    const results = await Promise.all(
      userIds.map((userId) => this.sendNotification(userId, companyId, type, variables))
    );

    return results.filter((id) => id !== '');
  }
}

/**
 * Singleton instance
 */
export const multiUserNotificationService = new MultiUserNotificationService();
