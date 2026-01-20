/**
 * Tests for Multi-User Notification Service with DISC Adaptation
 *
 * Tests cover:
 * - DISC message variants (D/I/S/C)
 * - Notification sending and delivery
 * - User preferences
 * - Quiet hours
 * - Batch notifications
 * - Read/unread tracking
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MultiUserNotificationService,
  NotificationType,
  NotificationPriority,
  NotificationChannel,
  type DISCType,
} from './notification.service';
import { db } from '../../store/database';

// Mock dependencies
vi.mock('../../store/database', () => ({
  db: {
    users: {
      get: vi.fn(),
    },
  },
}));

describe('MultiUserNotificationService', () => {
  let service: MultiUserNotificationService;

  beforeEach(() => {
    service = new MultiUserNotificationService();
    vi.clearAllMocks();
  });

  describe('sendNotification', () => {
    beforeEach(() => {
      (db.users.get as any).mockResolvedValue({
        id: 'user-456',
        email: 'user@example.com',
        name: 'Test User',
        preferences: {
          disc_type: 'S', // Steadiness
        },
      });
    });

    it('should send notification with DISC-adapted message', async () => {
      const id = await service.sendNotification(
        'user-456',
        'company-123',
        NotificationType.USER_INVITED,
        {
          invitedEmail: 'newuser@example.com',
          role: 'BOOKKEEPER',
        }
      );

      expect(id).toBeTruthy();

      const notifications = service.getUnreadNotifications('user-456');
      expect(notifications).toHaveLength(1);
      expect(notifications[0]?.type).toBe(NotificationType.USER_INVITED);
    });

    it('should use correct DISC variant for Dominance (D)', async () => {
      // Mock Dominance user
      (service as any).getUserDISCType = vi.fn().mockResolvedValue('D');

      await service.sendNotification(
        'user-456',
        'company-123',
        NotificationType.KEY_ROTATION_STARTED,
        {}
      );

      const notifications = service.getUnreadNotifications('user-456');
      expect(notifications[0]?.title).toContain('Security update in progress');
      expect(notifications[0]?.body).toContain('takes under a minute');
    });

    it('should use correct DISC variant for Influence (I)', async () => {
      (service as any).getUserDISCType = vi.fn().mockResolvedValue('I');

      await service.sendNotification(
        'user-456',
        'company-123',
        NotificationType.KEY_ROTATION_COMPLETED,
        { duration: 35000 }
      );

      const notifications = service.getUnreadNotifications('user-456');
      expect(notifications[0]?.title).toContain('All secure!');
      expect(notifications[0]?.body).toContain('Perfect!');
    });

    it('should use correct DISC variant for Steadiness (S)', async () => {
      (service as any).getUserDISCType = vi.fn().mockResolvedValue('S');

      await service.sendNotification(
        'user-456',
        'company-123',
        NotificationType.USER_ACCESS_REVOKED,
        { companyName: 'Acme Corp' }
      );

      const notifications = service.getUnreadNotifications('user-456');
      expect(notifications[0]?.title).toContain('Your access has been changed');
      expect(notifications[0]?.body).toContain('reach out to your administrator');
    });

    it('should use correct DISC variant for Conscientiousness (C)', async () => {
      (service as any).getUserDISCType = vi.fn().mockResolvedValue('C');

      await service.sendNotification(
        'user-456',
        'company-123',
        NotificationType.KEY_ROTATION_COMPLETED,
        { duration: 35000 }
      );

      const notifications = service.getUnreadNotifications('user-456');
      expect(notifications[0]?.title).toContain('Key rotation completed successfully');
      expect(notifications[0]?.body).toContain('Encryption key rotation completed');
    });

    it('should interpolate variables in messages', async () => {
      await service.sendNotification(
        'user-456',
        'company-123',
        NotificationType.USER_ROLE_CHANGED,
        {
          oldRole: 'BOOKKEEPER',
          newRole: 'ADMIN',
        }
      );

      const notifications = service.getUnreadNotifications('user-456');
      expect(notifications[0]?.body).toContain('BOOKKEEPER');
      expect(notifications[0]?.body).toContain('ADMIN');
    });

    it('should respect user disabled notification types', async () => {
      // Update user preferences to disable USER_INVITED
      await service.updatePreferences('user-456', {
        disabledTypes: [NotificationType.USER_INVITED],
      });

      const id = await service.sendNotification(
        'user-456',
        'company-123',
        NotificationType.USER_INVITED,
        {}
      );

      expect(id).toBe('');
      const notifications = service.getUnreadNotifications('user-456');
      expect(notifications).toHaveLength(0);
    });

    it('should respect quiet hours for non-urgent notifications', async () => {
      // Set quiet hours to current time
      const now = new Date();
      const currentHour = now.getHours().toString().padStart(2, '0');
      const currentMinute = now.getMinutes().toString().padStart(2, '0');

      await service.updatePreferences('user-456', {
        quietHoursStart: `${currentHour}:00`,
        quietHoursEnd: `${currentHour}:59`,
      });

      const id = await service.sendNotification(
        'user-456',
        'company-123',
        NotificationType.USER_INVITED,
        {},
        NotificationPriority.LOW
      );

      expect(id).toBe('');
    });

    it('should bypass quiet hours for urgent notifications', async () => {
      const now = new Date();
      const currentHour = now.getHours().toString().padStart(2, '0');

      await service.updatePreferences('user-456', {
        quietHoursStart: `${currentHour}:00`,
        quietHoursEnd: `${currentHour}:59`,
      });

      const id = await service.sendNotification(
        'user-456',
        'company-123',
        NotificationType.SUSPICIOUS_ACTIVITY,
        { activityType: 'Multiple failed logins', location: 'Unknown' },
        NotificationPriority.URGENT
      );

      expect(id).toBeTruthy();
    });

    it('should create in-app notification', async () => {
      await service.sendNotification(
        'user-456',
        'company-123',
        NotificationType.USER_JOINED,
        { userName: 'Jane Doe', role: 'ACCOUNTANT' },
        undefined,
        NotificationChannel.IN_APP
      );

      const notifications = service.getAllNotifications('user-456');
      expect(notifications).toHaveLength(1);
      expect(notifications[0]?.channel).toBe(NotificationChannel.IN_APP);
    });
  });

  describe('Notification Types Coverage', () => {
    beforeEach(() => {
      (service as any).getUserDISCType = vi.fn().mockResolvedValue('S');
    });

    const notificationTypes = [
      {
        type: NotificationType.USER_INVITED,
        vars: { invitedEmail: 'user@example.com', role: 'BOOKKEEPER' },
      },
      {
        type: NotificationType.USER_JOINED,
        vars: { userName: 'Jane Doe', role: 'ACCOUNTANT' },
      },
      {
        type: NotificationType.USER_ROLE_CHANGED,
        vars: { oldRole: 'BOOKKEEPER', newRole: 'ADMIN' },
      },
      {
        type: NotificationType.USER_ACCESS_REVOKED,
        vars: { companyName: 'Acme Corp' },
      },
      {
        type: NotificationType.USER_ACCESS_RESTORED,
        vars: { companyName: 'Acme Corp' },
      },
      {
        type: NotificationType.KEY_ROTATION_STARTED,
        vars: {},
      },
      {
        type: NotificationType.KEY_ROTATION_COMPLETED,
        vars: { duration: 35000 },
      },
      {
        type: NotificationType.KEY_ROTATION_FAILED,
        vars: { errorMessage: 'Database error' },
      },
      {
        type: NotificationType.SESSION_INVALIDATED,
        vars: { reason: 'Access revoked' },
      },
      {
        type: NotificationType.CONCURRENT_SESSION_DETECTED,
        vars: { deviceCount: 3 },
      },
      {
        type: NotificationType.PASSWORD_CHANGED,
        vars: { timestamp: new Date().toISOString() },
      },
      {
        type: NotificationType.SUSPICIOUS_ACTIVITY,
        vars: { activityType: 'Multiple failed logins', location: 'Unknown' },
      },
      {
        type: NotificationType.EXPORT_REQUESTED,
        vars: { exportType: 'TRANSACTIONS', fileSize: '2.5 MB' },
      },
    ];

    it.each(notificationTypes)(
      'should send notification for $type',
      async ({ type, vars }) => {
        const id = await service.sendNotification(
          'user-456',
          'company-123',
          type,
          vars
        );

        expect(id).toBeTruthy();
        const notifications = service.getUnreadNotifications('user-456');
        expect(notifications.some((n) => n.type === type)).toBe(true);
      }
    );
  });

  describe('getUnreadNotifications', () => {
    beforeEach(async () => {
      (service as any).getUserDISCType = vi.fn().mockResolvedValue('S');

      // Create some notifications
      await service.sendNotification(
        'user-456',
        'company-123',
        NotificationType.USER_INVITED,
        {}
      );

      await service.sendNotification(
        'user-456',
        'company-123',
        NotificationType.USER_JOINED,
        { userName: 'Jane Doe', role: 'ACCOUNTANT' }
      );
    });

    it('should return all unread notifications for user', () => {
      const notifications = service.getUnreadNotifications('user-456');
      expect(notifications).toHaveLength(2);
      expect(notifications.every((n) => !n.read)).toBe(true);
    });

    it('should order notifications by creation time (newest first)', () => {
      const notifications = service.getUnreadNotifications('user-456');
      expect(notifications[0]?.createdAt ?? 0).toBeGreaterThanOrEqual(
        notifications[1]?.createdAt ?? 0
      );
    });

    it('should not include read notifications', async () => {
      const allNotifications = service.getAllNotifications('user-456');
      service.markAsRead(allNotifications[0]?.id ?? '');

      const unread = service.getUnreadNotifications('user-456');
      expect(unread).toHaveLength(1);
    });
  });

  describe('getAllNotifications', () => {
    beforeEach(async () => {
      (service as any).getUserDISCType = vi.fn().mockResolvedValue('S');

      // Create notifications
      for (let i = 0; i < 5; i++) {
        await service.sendNotification(
          'user-456',
          'company-123',
          NotificationType.USER_JOINED,
          { userName: `User ${i}`, role: 'BOOKKEEPER' }
        );
      }
    });

    it('should return all notifications for user', () => {
      const notifications = service.getAllNotifications('user-456');
      expect(notifications).toHaveLength(5);
    });

    it('should respect limit parameter', () => {
      const notifications = service.getAllNotifications('user-456', 3);
      expect(notifications).toHaveLength(3);
    });

    it('should include both read and unread notifications', () => {
      const allNotifications = service.getAllNotifications('user-456');
      service.markAsRead(allNotifications[0]?.id ?? '');

      const notifications = service.getAllNotifications('user-456');
      expect(notifications).toHaveLength(5);
    });
  });

  describe('markAsRead', () => {
    let notificationId: string;

    beforeEach(async () => {
      (service as any).getUserDISCType = vi.fn().mockResolvedValue('S');

      notificationId = await service.sendNotification(
        'user-456',
        'company-123',
        NotificationType.USER_INVITED,
        {}
      );
    });

    it('should mark notification as read', () => {
      const success = service.markAsRead(notificationId);
      expect(success).toBe(true);

      const notifications = service.getAllNotifications('user-456');
      expect(notifications[0]?.read).toBe(true);
      expect(notifications[0]?.readAt).toBeDefined();
    });

    it('should return false for non-existent notification', () => {
      const success = service.markAsRead('non-existent-id');
      expect(success).toBe(false);
    });
  });

  describe('markAllAsRead', () => {
    beforeEach(async () => {
      (service as any).getUserDISCType = vi.fn().mockResolvedValue('S');

      // Create multiple notifications
      await service.sendNotification(
        'user-456',
        'company-123',
        NotificationType.USER_INVITED,
        {}
      );

      await service.sendNotification(
        'user-456',
        'company-123',
        NotificationType.USER_JOINED,
        { userName: 'Jane Doe', role: 'ACCOUNTANT' }
      );
    });

    it('should mark all notifications as read', () => {
      const count = service.markAllAsRead('user-456');
      expect(count).toBe(2);

      const unread = service.getUnreadNotifications('user-456');
      expect(unread).toHaveLength(0);
    });

    it('should not count already read notifications', () => {
      const notifications = service.getAllNotifications('user-456');
      service.markAsRead(notifications[0]?.id ?? '');

      const count = service.markAllAsRead('user-456');
      expect(count).toBe(1);
    });
  });

  describe('deleteNotification', () => {
    let notificationId: string;

    beforeEach(async () => {
      (service as any).getUserDISCType = vi.fn().mockResolvedValue('S');

      notificationId = await service.sendNotification(
        'user-456',
        'company-123',
        NotificationType.USER_INVITED,
        {}
      );
    });

    it('should delete notification', () => {
      const success = service.deleteNotification(notificationId);
      expect(success).toBe(true);

      const notifications = service.getAllNotifications('user-456');
      expect(notifications).toHaveLength(0);
    });

    it('should return false for non-existent notification', () => {
      const success = service.deleteNotification('non-existent-id');
      expect(success).toBe(false);
    });
  });

  describe('updatePreferences', () => {
    it('should update notification preferences', async () => {
      await service.updatePreferences('user-456', {
        enableEmail: false,
        disabledTypes: [NotificationType.USER_INVITED],
      });

      const prefs = await (service as any).getUserPreferences('user-456');
      expect(prefs.enableEmail).toBe(false);
      expect(prefs.disabledTypes).toContain(NotificationType.USER_INVITED);
    });

    it('should merge with existing preferences', async () => {
      await service.updatePreferences('user-456', {
        enableEmail: false,
      });

      await service.updatePreferences('user-456', {
        enableInApp: false,
      });

      const prefs = await (service as any).getUserPreferences('user-456');
      expect(prefs.enableEmail).toBe(false);
      expect(prefs.enableInApp).toBe(false);
    });
  });

  describe('sendBatchNotification', () => {
    beforeEach(() => {
      (service as any).getUserDISCType = vi.fn().mockResolvedValue('S');
    });

    it('should send notification to multiple users', async () => {
      const userIds = ['user-1', 'user-2', 'user-3'];

      const results = await service.sendBatchNotification(
        userIds,
        'company-123',
        NotificationType.USER_JOINED,
        { userName: 'New Member', role: 'BOOKKEEPER' }
      );

      expect(results).toHaveLength(3);
      expect(results.every((id) => id !== '')).toBe(true);
    });

    it('should filter out failed sends', async () => {
      // Mock one user to fail
      (service as any).sendNotification = vi
        .fn()
        .mockResolvedValueOnce('id-1')
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('id-3');

      const userIds = ['user-1', 'user-2', 'user-3'];

      const results = await service.sendBatchNotification(
        userIds,
        'company-123',
        NotificationType.USER_JOINED,
        {}
      );

      expect(results).toHaveLength(2);
    });
  });

  describe('Notification Pruning', () => {
    it('should prune old notifications when limit exceeded', async () => {
      (service as any).getUserDISCType = vi.fn().mockResolvedValue('S');

      // Create more than MAX_IN_APP_NOTIFICATIONS
      for (let i = 0; i < 105; i++) {
        await service.sendNotification(
          'user-456',
          'company-123',
          NotificationType.USER_JOINED,
          { userName: `User ${i}`, role: 'BOOKKEEPER' }
        );
      }

      const notifications = service.getAllNotifications('user-456', 200);
      expect(notifications.length).toBeLessThanOrEqual(100);
    });
  });

  describe('DISC Message Quality', () => {
    it('should have different messages for each DISC type', async () => {
      const discTypes: DISCType[] = ['D', 'I', 'S', 'C'];
      const messages: Record<DISCType, string> = {} as any;

      for (const discType of discTypes) {
        (service as any).getUserDISCType = vi.fn().mockResolvedValue(discType);

        await service.sendNotification(
          `user-${discType}`,
          'company-123',
          NotificationType.KEY_ROTATION_STARTED,
          {}
        );

        const notifications = service.getAllNotifications(`user-${discType}`);
        messages[discType] = notifications[0]?.body ?? '';
      }

      // All messages should be different
      const uniqueMessages = new Set(Object.values(messages));
      expect(uniqueMessages.size).toBe(4);
    });
  });
});
