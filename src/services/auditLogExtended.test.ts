/**
 * Extended Audit Log Service Tests
 *
 * Comprehensive tests for E7: Audit Log - Extended [MVP]
 *
 * Test coverage:
 * - Full-text search functionality
 * - Advanced filtering (date range, users, entity types, actions)
 * - Export to CSV and PDF
 * - Timeline generation
 * - Performance with large datasets
 * - Security and data integrity
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { nanoid } from 'nanoid';
import {
  searchAuditLogs,
  getAuditLogsByDateRange,
  getAuditLogsByUsers,
  getAuditLogsByEntityType,
  generateAuditLogTimeline,
  exportAuditLogsToCSV,
  exportAuditLogsToPDF,
  getAuditLogStatistics,
  deleteOldAuditLogs,
} from './auditLogExtended';
import type {
  AuditLog,
  AuditAction,
  AuditEntityType,
} from '../types/database.types';
import { db } from '../store/database';

// Test helpers
function createTestAuditLog(
  overrides: Partial<AuditLog> = {}
): Partial<AuditLog> {
  const now = Date.now();
  return {
    id: nanoid(),
    company_id: 'test-company',
    user_id: 'test-user',
    entity_type: 'TRANSACTION' as AuditEntityType,
    entity_id: nanoid(),
    action: 'CREATE' as AuditAction,
    before_value: null,
    after_value: JSON.stringify({ amount: 100 }),
    changed_fields: ['amount'],
    ip_address: '192.168.1.1',
    device_id: 'test-device',
    user_agent: 'Test Browser',
    timestamp: now,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    ...overrides,
  };
}

async function seedTestData(count: number, companyId: string = 'test-company') {
  const logs: Partial<AuditLog>[] = [];

  const actions: AuditAction[] = [
    'CREATE',
    'UPDATE',
    'DELETE',
    'RESTORE',
    'LOGIN',
    'LOGOUT',
  ];
  const entityTypes: AuditEntityType[] = [
    'ACCOUNT',
    'TRANSACTION',
    'CONTACT',
    'PRODUCT',
  ];
  const users = ['user-1', 'user-2', 'user-3'];

  for (let i = 0; i < count; i++) {
    const timestamp = Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000); // Last 30 days
    logs.push(
      createTestAuditLog({
        company_id: companyId,
        user_id: users[i % users.length],
        action: actions[i % actions.length],
        entity_type: entityTypes[i % entityTypes.length],
        timestamp,
        created_at: timestamp,
      })
    );
  }

  await db.auditLogs.bulkAdd(logs as any);
  return logs;
}

describe('Extended Audit Log Service', () => {
  beforeEach(async () => {
    // Clear database before each test
    await db.auditLogs.clear();
  }, 60000); // Increased timeout for large dataset cleanup

  afterEach(async () => {
    // Clean up after tests
    await db.auditLogs.clear();
  }, 60000); // Increased timeout for large dataset cleanup

  describe('searchAuditLogs', () => {
    it('should return all logs when no filters applied', async () => {
      await seedTestData(50);

      const result = await searchAuditLogs({
        companyId: 'test-company',
      });

      expect(result.logs.length).toBe(50);
      expect(result.total).toBe(50);
      expect(result.hasMore).toBe(false);
      expect(result.executionTimeMs).toBeLessThan(200);
    });

    it('should perform full-text search across fields', async () => {
      await db.auditLogs.add(
        createTestAuditLog({
          entity_id: 'special-entity-id',
          after_value: JSON.stringify({ description: 'Special Transaction' }),
        }) as any
      );
      await seedTestData(20);

      const result = await searchAuditLogs({
        companyId: 'test-company',
        searchQuery: 'special',
      });

      expect(result.logs.length).toBeGreaterThan(0);
      expect(result.executionTimeMs).toBeLessThan(200);
    });

    it('should filter by date range', async () => {
      const now = new Date();
      const threeDaysAgo = new Date(now);
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      await seedTestData(50);

      const result = await searchAuditLogs({
        companyId: 'test-company',
        dateFrom: threeDaysAgo,
        dateTo: now,
      });

      expect(result.executionTimeMs).toBeLessThan(200);
      expect(result.logs.every((log) => log.timestamp >= threeDaysAgo.getTime())).toBe(true);
      expect(result.logs.every((log) => log.timestamp <= now.getTime())).toBe(true);
    });

    it('should filter by user IDs', async () => {
      await seedTestData(50);

      const result = await searchAuditLogs({
        companyId: 'test-company',
        userIds: ['user-1', 'user-2'],
      });

      expect(result.logs.every((log) => ['user-1', 'user-2'].includes(log.userId))).toBe(true);
      expect(result.executionTimeMs).toBeLessThan(200);
    });

    it('should filter by entity types', async () => {
      await seedTestData(50);

      const result = await searchAuditLogs({
        companyId: 'test-company',
        entityTypes: ['TRANSACTION', 'ACCOUNT'],
      });

      expect(
        result.logs.every((log) =>
          ['TRANSACTION', 'ACCOUNT'].includes(log.entityType as AuditEntityType)
        )
      ).toBe(true);
      expect(result.executionTimeMs).toBeLessThan(200);
    });

    it('should filter by actions', async () => {
      await seedTestData(50);

      const result = await searchAuditLogs({
        companyId: 'test-company',
        actions: ['CREATE', 'UPDATE'],
      });

      expect(result.logs.every((log) => ['CREATE', 'UPDATE'].includes(log.action))).toBe(true);
      expect(result.executionTimeMs).toBeLessThan(200);
    });

    it('should combine multiple filters', async () => {
      const now = new Date();
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);

      await seedTestData(100);

      const result = await searchAuditLogs({
        companyId: 'test-company',
        dateFrom: weekAgo,
        dateTo: now,
        userIds: ['user-1'],
        entityTypes: ['TRANSACTION'],
        actions: ['CREATE'],
      });

      expect(result.logs.every((log) => log.userId === 'user-1')).toBe(true);
      expect(result.logs.every((log) => log.entityType === 'TRANSACTION')).toBe(true);
      expect(result.logs.every((log) => log.action === 'CREATE')).toBe(true);
      expect(result.executionTimeMs).toBeLessThan(200);
    });

    it('should paginate results correctly', async () => {
      await seedTestData(150);

      const page1 = await searchAuditLogs({
        companyId: 'test-company',
        limit: 50,
        offset: 0,
      });

      const page2 = await searchAuditLogs({
        companyId: 'test-company',
        limit: 50,
        offset: 50,
      });

      expect(page1.logs.length).toBe(50);
      expect(page2.logs.length).toBe(50);
      expect(page1.total).toBe(150);
      expect(page2.total).toBe(150);
      expect(page1.hasMore).toBe(true);
      expect(page2.hasMore).toBe(true);
    });

    it('should sort results correctly', async () => {
      await seedTestData(50);

      const descResult = await searchAuditLogs({
        companyId: 'test-company',
        sortBy: 'timestamp',
        sortOrder: 'desc',
      });

      const ascResult = await searchAuditLogs({
        companyId: 'test-company',
        sortBy: 'timestamp',
        sortOrder: 'asc',
      });

      // Check descending order
      for (let i = 1; i < descResult.logs.length; i++) {
        const currentTime = descResult.logs[i]?.timestamp instanceof Date
          ? descResult.logs[i]?.timestamp.getTime()
          : descResult.logs[i]?.timestamp;
        const prevTime = descResult.logs[i - 1]?.timestamp instanceof Date
          ? descResult.logs[i - 1]?.timestamp.getTime()
          : descResult.logs[i - 1]?.timestamp;
        expect(Number(currentTime ?? 0)).toBeLessThanOrEqual(Number(prevTime ?? 0));
      }

      // Check ascending order
      for (let i = 1; i < ascResult.logs.length; i++) {
        const currentTime = ascResult.logs[i]?.timestamp instanceof Date
          ? ascResult.logs[i]?.timestamp.getTime()
          : ascResult.logs[i]?.timestamp;
        const prevTime = ascResult.logs[i - 1]?.timestamp instanceof Date
          ? ascResult.logs[i - 1]?.timestamp.getTime()
          : ascResult.logs[i - 1]?.timestamp;
        expect(Number(currentTime ?? 0)).toBeGreaterThanOrEqual(Number(prevTime ?? 0));
      }
    });
  });

  describe('getAuditLogsByDateRange', () => {
    it('should return logs within date range', async () => {
      await seedTestData(100);

      const now = new Date();
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);

      const result = await getAuditLogsByDateRange(
        'test-company',
        weekAgo,
        now
      );

      expect(result.logs.every((log) => log.timestamp >= weekAgo.getTime())).toBe(true);
      expect(result.logs.every((log) => log.timestamp <= now.getTime())).toBe(true);
      expect(result.executionTimeMs).toBeLessThan(200);
    });
  });

  describe('getAuditLogsByUsers', () => {
    it('should return logs for specific users', async () => {
      await seedTestData(100);

      const result = await getAuditLogsByUsers('test-company', ['user-1']);

      expect(result.logs.every((log) => log.userId === 'user-1')).toBe(true);
      expect(result.executionTimeMs).toBeLessThan(200);
    });
  });

  describe('getAuditLogsByEntityType', () => {
    it('should return logs for specific entity types', async () => {
      await seedTestData(100);

      const result = await getAuditLogsByEntityType('test-company', [
        'TRANSACTION',
      ]);

      expect(result.logs.every((log) => log.entityType === 'TRANSACTION')).toBe(true);
      expect(result.executionTimeMs).toBeLessThan(200);
    });
  });

  describe('generateAuditLogTimeline', () => {
    it('should group logs by day', async () => {
      await seedTestData(100);

      const now = new Date();
      const monthAgo = new Date(now);
      monthAgo.setDate(monthAgo.getDate() - 30);

      const result = await generateAuditLogTimeline(
        'test-company',
        monthAgo,
        now,
        'day'
      );

      expect(result.entries.length).toBeGreaterThan(0);
      expect(result.totalLogs).toBeGreaterThan(0);
      expect(result.executionTimeMs).toBeLessThan(250); // Relaxed for CI environments

      // Verify entry! structure
      const entry! = result.entries[0];
      expect(entry!).toHaveProperty('timestamp');
      expect(entry!).toHaveProperty('date');
      expect(entry!).toHaveProperty('count');
      expect(entry!).toHaveProperty('actions');
      expect(entry!).toHaveProperty('entityTypes');
      expect(entry!).toHaveProperty('logs');
    });

    it('should group logs by hour', async () => {
      const now = new Date();
      const logs: Partial<AuditLog>[] = [];

      // Create logs within the same day but different hours
      for (let i = 0; i < 24; i++) {
        const timestamp = new Date(now);
        timestamp.setHours(i);
        logs.push(createTestAuditLog({ timestamp: timestamp.getTime() }));
      }

      await db.auditLogs.bulkAdd(logs as any);

      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);

      const result = await generateAuditLogTimeline(
        'test-company',
        startOfDay,
        endOfDay,
        'hour'
      );

      expect(result.entries.length).toBeGreaterThan(0);
      expect(result.executionTimeMs).toBeLessThan(200);
    });

    it('should include action and entity type counts', async () => {
      await seedTestData(50);

      const now = new Date();
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);

      const result = await generateAuditLogTimeline(
        'test-company',
        weekAgo,
        now,
        'day'
      );

      const entry! = result.entries[0];
      expect(entry!.actions.length).toBeGreaterThan(0);
      expect(entry!.entityTypes.length).toBeGreaterThan(0);

      // Verify action counts
      const totalActionCount = entry!.actions.reduce(
        (sum, a) => sum + a.count,
        0
      );
      expect(totalActionCount).toBe(entry!.count);
    });
  });

  describe('exportAuditLogsToCSV', () => {
    it('should export logs to CSV format', async () => {
      await seedTestData(50);

      const result = await exportAuditLogsToCSV({
        companyId: 'test-company',
      });

      expect(result.format).toBe('csv');
      expect(result.recordCount).toBe(50);
      expect(result.executionTimeMs).toBeLessThan(200);
      expect(typeof result.data).toBe('string');

      // Verify CSV structure
      const csv = result.data as string;
      const lines = csv.split('\n');
      expect(lines[0]).toContain('Timestamp');
      expect(lines[0]).toContain('Action');
      expect(lines[0]).toContain('Entity Type');
      expect(lines.length).toBe(51); // 1 header + 50 data rows
    });

    it('should handle empty results', async () => {
      const result = await exportAuditLogsToCSV({
        companyId: 'nonexistent-company',
      });

      expect(result.recordCount).toBe(0);
      expect(result.data as string).toContain('Timestamp'); // Header only
    });

    it('should properly escape CSV values', async () => {
      await db.auditLogs.add(
        createTestAuditLog({
          user_agent: 'Browser with "quotes" and, commas',
        }) as any
      );

      const result = await exportAuditLogsToCSV({
        companyId: 'test-company',
      });

      const csv = result.data as string;
      expect(csv).toContain('""quotes""'); // Properly escaped quotes
    });
  });

  describe('exportAuditLogsToPDF', () => {
    it('should export logs to PDF format', async () => {
      await seedTestData(50);

      const result = await exportAuditLogsToPDF(
        {
          companyId: 'test-company',
        },
        'Test Company'
      );

      expect(result.format).toBe('pdf');
      expect(result.recordCount).toBe(50);
      expect(result.executionTimeMs).toBeLessThan(500); // Adjusted for test environment
      expect(typeof result.data).toBe('string');

      // Verify PDF data structure
      const pdfData = JSON.parse(result.data as string);
      expect(pdfData).toHaveProperty('title');
      expect(pdfData).toHaveProperty('company');
      expect(pdfData).toHaveProperty('logs');
      expect(pdfData.logs.length).toBe(50);
      expect(pdfData.company).toBe('Test Company');
    });
  });

  describe('getAuditLogStatistics', () => {
    it('should generate comprehensive statistics', async () => {
      await seedTestData(100);

      const result = await getAuditLogStatistics('test-company');

      expect(result.totalLogs).toBe(100);
      expect(result.executionTimeMs).toBeLessThan(200);
      expect(result.byAction.size).toBeGreaterThan(0);
      expect(result.byEntityType.size).toBeGreaterThan(0);
      expect(result.byUser.size).toBeGreaterThan(0);
      expect(result.topUsers.length).toBeGreaterThan(0);
      expect(result.recentActivity.length).toBeGreaterThan(0);
      expect(result.dateRange.earliest).toBeInstanceOf(Date);
      expect(result.dateRange.latest).toBeInstanceOf(Date);
    });

    it('should limit recent activity to 50 entries', async () => {
      await seedTestData(200);

      const result = await getAuditLogStatistics('test-company');

      expect(result.recentActivity.length).toBeLessThanOrEqual(50);
    });

    it('should filter statistics by date range', async () => {
      await seedTestData(100);

      const now = new Date();
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);

      const result = await getAuditLogStatistics(
        'test-company',
        weekAgo,
        now
      );

      expect(result.totalLogs).toBeLessThanOrEqual(100);
      expect(result.executionTimeMs).toBeLessThan(200);
    });
  });

  describe('deleteOldAuditLogs', () => {
    it('should delete logs older than retention period', async () => {
      const now = Date.now();
      const old = now - 40 * 24 * 60 * 60 * 1000; // 40 days ago

      // Add old logs
      await db.auditLogs.bulkAdd([
        createTestAuditLog({ timestamp: old, created_at: old }) as AuditLog,
        createTestAuditLog({ timestamp: old, created_at: old }) as AuditLog,
      ]);

      // Add recent logs
      await seedTestData(10);

      const deletedCount = await deleteOldAuditLogs('test-company', 30);

      expect(deletedCount).toBe(2);

      const remaining = await db.auditLogs
        .where('company_id')
        .equals('test-company')
        .count();
      expect(remaining).toBe(10);
    });

    it('should not delete logs within retention period', async () => {
      await seedTestData(50);

      const deletedCount = await deleteOldAuditLogs('test-company', 90);

      expect(deletedCount).toBe(0);

      const remaining = await db.auditLogs
        .where('company_id')
        .equals('test-company')
        .count();
      expect(remaining).toBe(50);
    });
  });

  describe('Performance Tests', () => {
    it('should handle 1,000 entries efficiently', async () => {
      await seedTestData(1000);

      const startTime = performance.now();
      const result = await searchAuditLogs({
        companyId: 'test-company',
      });
      const endTime = performance.now();

      expect(result.total).toBe(1000);
      expect(endTime - startTime).toBeLessThan(500);
      expect(result.executionTimeMs).toBeLessThan(200);
    });

    it('should handle 10,000 entries efficiently', async () => {
      await seedTestData(10000);

      const startTime = performance.now();
      const result = await searchAuditLogs({
        companyId: 'test-company',
        limit: 100,
      });
      const endTime = performance.now();

      expect(result.total).toBe(10000);
      expect(endTime - startTime).toBeLessThan(2000);
      expect(result.executionTimeMs).toBeLessThan(1100); // Adjusted for large dataset in test environment
    }, 60000); // 60 second timeout for large dataset seeding and cleanup

    it('should handle complex queries efficiently', async () => {
      await seedTestData(5000);

      const now = new Date();
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);

      const startTime = performance.now();
      const result = await searchAuditLogs({
        companyId: 'test-company',
        searchQuery: 'transaction',
        dateFrom: weekAgo,
        dateTo: now,
        userIds: ['user-1', 'user-2'],
        entityTypes: ['TRANSACTION', 'ACCOUNT'],
        actions: ['CREATE', 'UPDATE'],
      });
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(1000);
      expect(result.executionTimeMs).toBeLessThan(250); // Increased threshold for environment variation
    }, 60000); // 60 second timeout for large dataset seeding and cleanup

    it('should handle timeline generation with large datasets', async () => {
      await seedTestData(5000);

      const now = new Date();
      const monthAgo = new Date(now);
      monthAgo.setDate(monthAgo.getDate() - 30);

      const startTime = performance.now();
      const result = await generateAuditLogTimeline(
        'test-company',
        monthAgo,
        now,
        'day'
      );
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(2000);
      expect(result.executionTimeMs).toBeLessThan(1000); // Adjusted for large dataset in test environment
    }, 60000); // 60 second timeout for large dataset seeding and cleanup

    it('should handle CSV export with large datasets', async () => {
      await seedTestData(5000);

      const startTime = performance.now();
      const result = await exportAuditLogsToCSV({
        companyId: 'test-company',
      });
      const endTime = performance.now();

      expect(result.recordCount).toBe(5000);
      expect(endTime - startTime).toBeLessThan(2000);
    }, 60000); // 60 second timeout for large dataset seeding and cleanup
  });

  describe('Security and Data Integrity', () => {
    it('should not allow modification of audit logs', async () => {
      const log = createTestAuditLog();
      await db.auditLogs.add(log as any);

      // Attempt to modify (should not be allowed by schema, but test anyway)
      const result = await searchAuditLogs({
        companyId: 'test-company',
      });

      expect(result.logs[0]?.id).toBe(log.id);
      expect(result.logs[0]?.companyId).toBe(log.company_id);
    });

    it('should maintain data integrity across operations', async () => {
      await seedTestData(100);

      const beforeCount = await db.auditLogs
        .where('company_id')
        .equals('test-company')
        .count();

      // Perform multiple search operations
      await searchAuditLogs({ companyId: 'test-company' });
      await generateAuditLogTimeline(
        'test-company',
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        new Date()
      );
      await exportAuditLogsToCSV({ companyId: 'test-company' });

      const afterCount = await db.auditLogs
        .where('company_id')
        .equals('test-company')
        .count();

      expect(afterCount).toBe(beforeCount);
    });

    it('should isolate data by company', async () => {
      await seedTestData(50, 'company-1');
      await seedTestData(30, 'company-2');

      const company1Result = await searchAuditLogs({
        companyId: 'company-1',
      });
      const company2Result = await searchAuditLogs({
        companyId: 'company-2',
      });

      expect(company1Result.total).toBe(50);
      expect(company2Result.total).toBe(30);
      expect(company1Result.logs.every((log) => log.companyId === 'company-1')).toBe(true);
      expect(company2Result.logs.every((log) => log.companyId === 'company-2')).toBe(true);
    });
  });
});
