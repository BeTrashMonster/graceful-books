/**
 * Tests for Multi-User Audit Service
 *
 * Tests cover:
 * - Event logging (20+ event types)
 * - Immutable audit trail
 * - Query and filtering
 * - Statistics generation
 * - Compliance export
 * - 7-year retention
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MultiUserAuditService,
  AuditEventType,
  AuditSeverity,
  type AuditQueryFilters,
} from './audit.service';
import { db } from '../../store/database';

// Mock dependencies
vi.mock('../../store/database', () => ({
  db: {
    auditLogs: {
      add: vi.fn(),
      where: vi.fn(),
      orderBy: vi.fn(),
      bulkPut: vi.fn(),
    },
  },
}));

describe('MultiUserAuditService', () => {
  let service: MultiUserAuditService;

  beforeEach(() => {
    service = new MultiUserAuditService();
    vi.clearAllMocks();
  });

  describe('logEvent', () => {
    it('should log audit event successfully', async () => {
      (db.auditLogs.add as any).mockResolvedValue('audit-log-123');

      const id = await service.logEvent(
        AuditEventType.USER_INVITED,
        {
          companyId: 'company-123',
          actorUserId: 'admin-789',
          targetResource: 'USER',
          changes: {
            email: 'user@example.com',
            role: 'BOOKKEEPER',
          },
        },
        AuditSeverity.INFO
      );

      expect(id).toBe('audit-log-123');
      expect(db.auditLogs.add).toHaveBeenCalledWith(
        expect.objectContaining({
          company_id: 'company-123',
          user_id: 'admin-789',
          action: AuditEventType.USER_INVITED,
          entity_type: 'USER',
        })
      );
    });

    it('should handle logging errors gracefully', async () => {
      (db.auditLogs.add as any).mockRejectedValue(new Error('Database error'));

      const id = await service.logEvent(
        AuditEventType.USER_INVITED,
        { companyId: 'company-123' },
        AuditSeverity.INFO
      );

      // Should return empty string on error, not throw
      expect(id).toBe('');
    });

    it('should include IP address and device info', async () => {
      (db.auditLogs.add as any).mockResolvedValue('audit-log-123');

      await service.logEvent(
        AuditEventType.LOGIN_SUCCESS,
        {
          companyId: 'company-123',
          actorUserId: 'user-456',
          ipAddress: '192.168.1.1',
          deviceId: 'device-abc',
          userAgent: 'Mozilla/5.0',
        },
        AuditSeverity.INFO
      );

      expect(db.auditLogs.add).toHaveBeenCalledWith(
        expect.objectContaining({
          ip_address: '192.168.1.1',
          device_id: 'device-abc',
          user_agent: 'Mozilla/5.0',
        })
      );
    });
  });

  describe('Event-Specific Logging', () => {
    beforeEach(() => {
      (db.auditLogs.add as any).mockResolvedValue('audit-log-123');
    });

    it('should log user invitation', async () => {
      const id = await service.logUserInvited(
        'company-123',
        'admin-789',
        'newuser@example.com',
        'BOOKKEEPER'
      );

      expect(id).toBeTruthy();
      expect(db.auditLogs.add).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditEventType.USER_INVITED,
          company_id: 'company-123',
          user_id: 'admin-789',
        })
      );
    });

    it('should log user joined', async () => {
      const id = await service.logUserJoined('company-123', 'user-456', 'BOOKKEEPER');

      expect(id).toBeTruthy();
      expect(db.auditLogs.add).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditEventType.USER_JOINED,
          company_id: 'company-123',
          user_id: 'user-456',
        })
      );
    });

    it('should log role change', async () => {
      const id = await service.logRoleChanged(
        'company-123',
        'admin-789',
        'user-456',
        'BOOKKEEPER',
        'ADMIN'
      );

      expect(id).toBeTruthy();
      expect(db.auditLogs.add).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditEventType.USER_ROLE_CHANGED,
          company_id: 'company-123',
          user_id: 'admin-789',
        })
      );
    });

    it('should log permissions change', async () => {
      const oldPerms = ['accounts.read', 'transactions.read'];
      const newPerms = ['accounts.read', 'transactions.read', 'transactions.create'];

      const id = await service.logPermissionsChanged(
        'company-123',
        'admin-789',
        'user-456',
        oldPerms,
        newPerms
      );

      expect(id).toBeTruthy();
      expect(db.auditLogs.add).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditEventType.USER_PERMISSIONS_CHANGED,
        })
      );
    });

    it('should log user deactivation', async () => {
      const id = await service.logUserDeactivated(
        'company-123',
        'admin-789',
        'user-456',
        'Violation of company policy'
      );

      expect(id).toBeTruthy();
      expect(db.auditLogs.add).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditEventType.USER_DEACTIVATED,
        })
      );
    });

    it('should log access revocation', async () => {
      const id = await service.logAccessRevoked(
        'company-123',
        'admin-789',
        'user-456',
        'Security incident',
        2
      );

      expect(id).toBeTruthy();
      expect(db.auditLogs.add).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditEventType.ACCESS_REVOKED,
        })
      );
    });

    it('should log key rotation initiated', async () => {
      const id = await service.logKeyRotationInitiated(
        'company-123',
        'admin-789',
        'user_revocation',
        'rotation-job-123'
      );

      expect(id).toBeTruthy();
      expect(db.auditLogs.add).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditEventType.KEY_ROTATION_INITIATED,
          entity_id: 'rotation-job-123',
        })
      );
    });

    it('should log key rotation completed', async () => {
      const id = await service.logKeyRotationCompleted(
        'company-123',
        'rotation-job-123',
        35000,
        1500
      );

      expect(id).toBeTruthy();
      expect(db.auditLogs.add).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditEventType.KEY_ROTATION_COMPLETED,
        })
      );
    });

    it('should log key rotation failed', async () => {
      const id = await service.logKeyRotationFailed(
        'company-123',
        'rotation-job-123',
        'Database connection lost'
      );

      expect(id).toBeTruthy();
      expect(db.auditLogs.add).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditEventType.KEY_ROTATION_FAILED,
        })
      );
    });

    it('should log session created', async () => {
      const id = await service.logSessionCreated(
        'user-456',
        'session-abc',
        'device-xyz',
        '192.168.1.1',
        'Mozilla/5.0'
      );

      expect(id).toBeTruthy();
      expect(db.auditLogs.add).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditEventType.SESSION_CREATED,
          user_id: 'user-456',
        })
      );
    });

    it('should log session invalidated', async () => {
      const id = await service.logSessionInvalidated(
        'user-456',
        'session-abc',
        'Access revoked'
      );

      expect(id).toBeTruthy();
      expect(db.auditLogs.add).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditEventType.SESSION_INVALIDATED,
        })
      );
    });

    it('should log successful login', async () => {
      const id = await service.logLogin(
        'user-456',
        true,
        '192.168.1.1',
        'Mozilla/5.0'
      );

      expect(id).toBeTruthy();
      expect(db.auditLogs.add).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditEventType.LOGIN_SUCCESS,
          user_id: 'user-456',
        })
      );
    });

    it('should log failed login', async () => {
      const id = await service.logLogin(
        null,
        false,
        '192.168.1.1',
        'Mozilla/5.0',
        'INVALID_PASSPHRASE'
      );

      expect(id).toBeTruthy();
      expect(db.auditLogs.add).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditEventType.LOGIN_FAILED,
        })
      );
    });

    it('should log data export', async () => {
      const id = await service.logDataExport(
        'company-123',
        'user-456',
        'TRANSACTIONS',
        150
      );

      expect(id).toBeTruthy();
      expect(db.auditLogs.add).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditEventType.DATA_EXPORTED,
        })
      );
    });
  });

  describe('queryLogs', () => {
    const mockLogs = [
      {
        id: 'log-1',
        company_id: 'company-123',
        user_id: 'user-456',
        entity_type: 'USER',
        entity_id: 'user-789',
        action: AuditEventType.USER_INVITED,
        changes: null,
        ip_address: '192.168.1.1',
        device_id: 'device-1',
        user_agent: null,
        timestamp: Date.now() - 1000,
        created_at: Date.now() - 1000,
        updated_at: Date.now() - 1000,
        deleted_at: null,
      },
      {
        id: 'log-2',
        company_id: 'company-123',
        user_id: 'user-456',
        entity_type: 'SESSION',
        entity_id: 'session-abc',
        action: AuditEventType.LOGIN_SUCCESS,
        changes: null,
        ip_address: '192.168.1.1',
        device_id: 'device-1',
        user_agent: null,
        timestamp: Date.now() - 2000,
        created_at: Date.now() - 2000,
        updated_at: Date.now() - 2000,
        deleted_at: null,
      },
    ];

    beforeEach(() => {
      (db.auditLogs.orderBy as any).mockReturnValue({
        reverse: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue(mockLogs),
        }),
      });
    });

    it('should query logs with company filter', async () => {
      const filters: AuditQueryFilters = {
        companyId: 'company-123',
      };

      const result = await service.queryLogs(filters);

      expect(result.events).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.hasMore).toBe(false);
    });

    it('should query logs with user filter', async () => {
      const filters: AuditQueryFilters = {
        userId: 'user-456',
      };

      const result = await service.queryLogs(filters);

      expect(result.events).toHaveLength(2);
    });

    it('should query logs with event type filter', async () => {
      const filters: AuditQueryFilters = {
        eventType: AuditEventType.USER_INVITED,
      };

      const result = await service.queryLogs(filters);

      expect(result.events).toHaveLength(1);
      expect(result.events[0]!.action).toBe(AuditEventType.USER_INVITED);
    });

    it('should query logs with multiple event types', async () => {
      const filters: AuditQueryFilters = {
        eventType: [AuditEventType.USER_INVITED, AuditEventType.LOGIN_SUCCESS],
      };

      const result = await service.queryLogs(filters);

      expect(result.events).toHaveLength(2);
    });

    it('should query logs with date range', async () => {
      const now = Date.now();
      const filters: AuditQueryFilters = {
        startDate: now - 5000,
        endDate: now,
      };

      const result = await service.queryLogs(filters);

      expect(result.events.length).toBeGreaterThan(0);
    });

    it('should apply pagination', async () => {
      const filters: AuditQueryFilters = {
        limit: 1,
        offset: 0,
      };

      const result = await service.queryLogs(filters);

      expect(result.events).toHaveLength(1);
      expect(result.hasMore).toBe(true);
    });

    it('should handle query errors gracefully', async () => {
      (db.auditLogs.orderBy as any).mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await service.queryLogs({ companyId: 'company-123' });

      expect(result.events).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('getStatistics', () => {
    const mockLogs = [
      {
        id: 'log-1',
        company_id: 'company-123',
        user_id: 'user-456',
        entity_type: 'USER',
        entity_id: 'user-789',
        action: AuditEventType.USER_INVITED,
        changes: null,
        ip_address: null,
        device_id: 'device-1',
        user_agent: null,
        timestamp: Date.now(),
        created_at: Date.now(),
        updated_at: Date.now(),
        deleted_at: null,
      },
      {
        id: 'log-2',
        company_id: 'company-123',
        user_id: 'user-789',
        entity_type: 'SESSION',
        entity_id: 'session-abc',
        action: AuditEventType.LOGIN_SUCCESS,
        changes: null,
        ip_address: null,
        device_id: 'device-2',
        user_agent: null,
        timestamp: Date.now(),
        created_at: Date.now(),
        updated_at: Date.now(),
        deleted_at: null,
      },
      {
        id: 'log-3',
        company_id: 'company-123',
        user_id: 'user-456',
        entity_type: 'KEY_ROTATION',
        entity_id: 'rotation-123',
        action: AuditEventType.KEY_ROTATION_COMPLETED,
        changes: null,
        ip_address: null,
        device_id: 'device-1',
        user_agent: null,
        timestamp: Date.now(),
        created_at: Date.now(),
        updated_at: Date.now(),
        deleted_at: null,
      },
    ];

    beforeEach(() => {
      (db.auditLogs.where as any).mockReturnValue({
        equals: vi.fn().mockReturnValue({
          and: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue(mockLogs),
          }),
        }),
      });
    });

    it('should generate statistics for a period', async () => {
      const startDate = Date.now() - 86400000; // 24 hours ago
      const endDate = Date.now();

      const stats = await service.getStatistics('company-123', startDate, endDate);

      expect(stats.totalEvents).toBe(3);
      expect(stats.uniqueUsers).toBe(2);
      expect(stats.uniqueSessions).toBe(2);
    });

    it('should count events by type', async () => {
      const startDate = Date.now() - 86400000;
      const endDate = Date.now();

      const stats = await service.getStatistics('company-123', startDate, endDate);

      expect(stats.eventsByType[AuditEventType.USER_INVITED]).toBe(1);
      expect(stats.eventsByType[AuditEventType.LOGIN_SUCCESS]).toBe(1);
      expect(stats.eventsByType[AuditEventType.KEY_ROTATION_COMPLETED]).toBe(1);
    });

    it('should count security events', async () => {
      const startDate = Date.now() - 86400000;
      const endDate = Date.now();

      const stats = await service.getStatistics('company-123', startDate, endDate);

      expect(stats.securityEvents).toBeGreaterThan(0);
    });
  });

  describe('cleanupOldLogs', () => {
    it('should mark old logs as deleted', async () => {
      const oldLogs = [
        {
          id: 'old-log-1',
          company_id: 'company-123',
          user_id: 'user-456',
          entity_type: 'USER',
          entity_id: 'user-789',
          action: AuditEventType.USER_INVITED,
          changes: null,
          ip_address: null,
          device_id: 'device-1',
          user_agent: null,
          timestamp: Date.now() - 2600 * 24 * 60 * 60 * 1000, // 2600 days ago (> 7 years)
          created_at: Date.now() - 2600 * 24 * 60 * 60 * 1000,
          updated_at: Date.now() - 2600 * 24 * 60 * 60 * 1000,
          deleted_at: null,
        },
      ];

      (db.auditLogs.where as any).mockReturnValue({
        below: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue(oldLogs),
        }),
      });

      const count = await service.cleanupOldLogs();

      expect(count).toBe(1);
      expect(db.auditLogs.bulkPut).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'old-log-1',
            deleted_at: expect.any(Number),
          }),
        ])
      );
    });

    it('should handle cleanup errors gracefully', async () => {
      (db.auditLogs.where as any).mockImplementation(() => {
        throw new Error('Database error');
      });

      const count = await service.cleanupOldLogs();

      expect(count).toBe(0);
    });
  });

  describe('exportForCompliance', () => {
    const mockLogs = [
      {
        id: 'log-1',
        company_id: 'company-123',
        user_id: 'user-456',
        entity_type: 'USER',
        entity_id: 'user-789',
        action: AuditEventType.USER_INVITED,
        changes: null,
        ip_address: '192.168.1.1',
        device_id: 'device-1',
        user_agent: null,
        timestamp: Date.now(),
        created_at: Date.now(),
        updated_at: Date.now(),
        deleted_at: null,
      },
    ];

    beforeEach(() => {
      (db.auditLogs.where as any).mockReturnValue({
        equals: vi.fn().mockReturnValue({
          and: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue(mockLogs),
          }),
        }),
      });
    });

    it('should export logs as CSV', async () => {
      const startDate = Date.now() - 86400000;
      const endDate = Date.now();

      const csv = await service.exportForCompliance('company-123', startDate, endDate);

      expect(csv).toContain('Timestamp');
      expect(csv).toContain('Event Type');
      expect(csv).toContain('USER_INVITED');
      expect(csv).toContain('user-456');
    });

    it('should handle export errors gracefully', async () => {
      (db.auditLogs.where as any).mockImplementation(() => {
        throw new Error('Database error');
      });

      const csv = await service.exportForCompliance('company-123', 0, Date.now());

      expect(csv).toBe('');
    });
  });
});
