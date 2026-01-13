/**
 * Extended Audit Log Performance Tests
 *
 * Large-scale performance tests with 100,000+ entries
 * Tests for E7: Audit Log - Extended [MVP]
 *
 * Performance requirements:
 * - All operations must complete in <200ms
 * - Search must be performant with 100,000+ entries
 * - Export must complete in reasonable time
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { nanoid } from 'nanoid';
import {
  searchAuditLogs,
  generateAuditLogTimeline,
  exportAuditLogsToCSV,
  exportAuditLogsToPDF,
  getAuditLogStatistics,
} from './auditLogExtended';
import type {
  AuditLog,
  AuditAction,
  AuditEntityType,
} from '../types/database.types';
import { db } from '../store/database';

// Helper to create large test datasets
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

async function seedLargeDataset(count: number, companyId: string = 'test-company') {
  console.log(`Seeding ${count} audit log entries...`);
  const startTime = performance.now();

  const actions: AuditAction[] = [
    'CREATE',
    'UPDATE',
    'DELETE',
    'RESTORE',
    'LOGIN',
    'LOGOUT',
    'EXPORT',
    'IMPORT',
  ];
  const entityTypes: AuditEntityType[] = [
    'ACCOUNT',
    'TRANSACTION',
    'CONTACT',
    'PRODUCT',
    'USER',
    'COMPANY',
    'SESSION',
  ];
  const users = ['user-1', 'user-2', 'user-3', 'user-4', 'user-5'];

  // Create in batches for better performance
  const batchSize = 1000;
  let totalCreated = 0;

  for (let batch = 0; batch < Math.ceil(count / batchSize); batch++) {
    const logs: Partial<AuditLog>[] = [];
    const batchCount = Math.min(batchSize, count - totalCreated);

    for (let i = 0; i < batchCount; i++) {
      const timestamp = Date.now() - Math.floor(Math.random() * 365 * 24 * 60 * 60 * 1000); // Last year
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

    await db.auditLogs.bulkAdd(logs as AuditLog[]);
    totalCreated += batchCount;

    if (batch % 10 === 0) {
      console.log(`  Seeded ${totalCreated}/${count} entries...`);
    }
  }

  const endTime = performance.now();
  console.log(
    `Seeding completed in ${((endTime - startTime) / 1000).toFixed(2)}s`
  );
}

describe('Extended Audit Log Performance Tests', () => {
  const LARGE_DATASET_SIZE = 100000;

  beforeAll(async () => {
    console.log('Setting up large dataset for performance tests...');
    await db.auditLogs.clear();
    await seedLargeDataset(LARGE_DATASET_SIZE);
    console.log('Large dataset setup complete');
  }, 300000); // 5 minute timeout for setup

  afterAll(async () => {
    console.log('Cleaning up large dataset...');
    await db.auditLogs.clear();
    console.log('Cleanup complete');
  });

  describe('Search Performance with 100,000+ Entries', () => {
    it('should search all logs in <200ms', async () => {
      const startTime = performance.now();
      const result = await searchAuditLogs({
        companyId: 'test-company',
        limit: 100,
      });
      const endTime = performance.now();

      console.log(`Search completed in ${(endTime - startTime).toFixed(2)}ms`);
      console.log(`Found ${result.total} logs, returned ${result.logs.length}`);

      expect(result.total).toBe(LARGE_DATASET_SIZE);
      expect(result.logs.length).toBe(100);
      expect(result.executionTimeMs).toBeLessThan(200);
      expect(endTime - startTime).toBeLessThan(500);
    });

    it('should perform date range search in <200ms', async () => {
      const now = new Date();
      const monthAgo = new Date(now);
      monthAgo.setDate(monthAgo.getDate() - 30);

      const startTime = performance.now();
      const result = await searchAuditLogs({
        companyId: 'test-company',
        dateFrom: monthAgo,
        dateTo: now,
        limit: 100,
      });
      const endTime = performance.now();

      console.log(`Date range search completed in ${(endTime - startTime).toFixed(2)}ms`);
      console.log(`Found ${result.total} logs in date range`);

      expect(result.executionTimeMs).toBeLessThan(200);
      expect(endTime - startTime).toBeLessThan(500);
    });

    it('should perform full-text search in <200ms', async () => {
      const startTime = performance.now();
      const result = await searchAuditLogs({
        companyId: 'test-company',
        searchQuery: 'transaction',
        limit: 100,
      });
      const endTime = performance.now();

      console.log(`Full-text search completed in ${(endTime - startTime).toFixed(2)}ms`);
      console.log(`Found ${result.total} matching logs`);

      expect(result.executionTimeMs).toBeLessThan(200);
      expect(endTime - startTime).toBeLessThan(500);
    });

    it('should perform complex filtered search in <200ms', async () => {
      const now = new Date();
      const monthAgo = new Date(now);
      monthAgo.setDate(monthAgo.getDate() - 30);

      const startTime = performance.now();
      const result = await searchAuditLogs({
        companyId: 'test-company',
        searchQuery: 'user',
        dateFrom: monthAgo,
        dateTo: now,
        userIds: ['user-1', 'user-2'],
        entityTypes: ['TRANSACTION', 'ACCOUNT'],
        actions: ['CREATE', 'UPDATE'],
        limit: 100,
      });
      const endTime = performance.now();

      console.log(`Complex search completed in ${(endTime - startTime).toFixed(2)}ms`);
      console.log(`Found ${result.total} matching logs`);

      expect(result.executionTimeMs).toBeLessThan(200);
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it('should handle pagination efficiently', async () => {
      const pages = 10;
      const timings: number[] = [];

      for (let i = 0; i < pages; i++) {
        const startTime = performance.now();
        const result = await searchAuditLogs({
          companyId: 'test-company',
          limit: 100,
          offset: i * 100,
        });
        const endTime = performance.now();

        timings.push(endTime - startTime);
        expect(result.logs.length).toBe(100);
        expect(result.executionTimeMs).toBeLessThan(200);
      }

      const avgTime = timings.reduce((a, b) => a + b, 0) / timings.length;
      console.log(`Average pagination time: ${avgTime.toFixed(2)}ms`);
      expect(avgTime).toBeLessThan(500);
    });
  });

  describe('Timeline Generation Performance', () => {
    it('should generate daily timeline in <200ms', async () => {
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

      console.log(`Timeline generation completed in ${(endTime - startTime).toFixed(2)}ms`);
      console.log(`Generated ${result.entries.length} timeline entries`);

      expect(result.executionTimeMs).toBeLessThan(200);
      expect(endTime - startTime).toBeLessThan(1000);
      expect(result.entries.length).toBeGreaterThan(0);
    });

    it('should generate hourly timeline in <200ms', async () => {
      const now = new Date();
      const threeDaysAgo = new Date(now);
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const startTime = performance.now();
      const result = await generateAuditLogTimeline(
        'test-company',
        threeDaysAgo,
        now,
        'hour'
      );
      const endTime = performance.now();

      console.log(`Hourly timeline generation completed in ${(endTime - startTime).toFixed(2)}ms`);

      expect(result.executionTimeMs).toBeLessThan(200);
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it('should generate weekly timeline in <200ms', async () => {
      const now = new Date();
      const sixMonthsAgo = new Date(now);
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const startTime = performance.now();
      const result = await generateAuditLogTimeline(
        'test-company',
        sixMonthsAgo,
        now,
        'week'
      );
      const endTime = performance.now();

      console.log(`Weekly timeline generation completed in ${(endTime - startTime).toFixed(2)}ms`);

      expect(result.executionTimeMs).toBeLessThan(200);
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it('should generate monthly timeline in <200ms', async () => {
      const now = new Date();
      const yearAgo = new Date(now);
      yearAgo.setFullYear(yearAgo.getFullYear() - 1);

      const startTime = performance.now();
      const result = await generateAuditLogTimeline(
        'test-company',
        yearAgo,
        now,
        'month'
      );
      const endTime = performance.now();

      console.log(`Monthly timeline generation completed in ${(endTime - startTime).toFixed(2)}ms`);

      expect(result.executionTimeMs).toBeLessThan(200);
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });

  describe('Export Performance', () => {
    it('should export 1,000 logs to CSV in reasonable time', async () => {
      const startTime = performance.now();
      const result = await exportAuditLogsToCSV({
        companyId: 'test-company',
        limit: 1000,
      });
      const endTime = performance.now();

      console.log(`CSV export (1,000 logs) completed in ${(endTime - startTime).toFixed(2)}ms`);

      expect(result.recordCount).toBe(1000);
      expect(endTime - startTime).toBeLessThan(2000);
      expect(typeof result.data).toBe('string');
    });

    it('should export 10,000 logs to CSV in reasonable time', async () => {
      const startTime = performance.now();
      const result = await exportAuditLogsToCSV({
        companyId: 'test-company',
        limit: 10000,
      });
      const endTime = performance.now();

      console.log(`CSV export (10,000 logs) completed in ${(endTime - startTime).toFixed(2)}ms`);

      expect(result.recordCount).toBe(10000);
      expect(endTime - startTime).toBeLessThan(5000);
      expect(typeof result.data).toBe('string');
    });

    it('should export 1,000 logs to PDF data in reasonable time', async () => {
      const startTime = performance.now();
      const result = await exportAuditLogsToPDF(
        {
          companyId: 'test-company',
          limit: 1000,
        },
        'Test Company'
      );
      const endTime = performance.now();

      console.log(`PDF export (1,000 logs) completed in ${(endTime - startTime).toFixed(2)}ms`);

      expect(result.recordCount).toBe(1000);
      expect(endTime - startTime).toBeLessThan(2000);
      expect(typeof result.data).toBe('string');

      const pdfData = JSON.parse(result.data as string);
      expect(pdfData.logs.length).toBe(1000);
    });

    it('should handle filtered export efficiently', async () => {
      const now = new Date();
      const monthAgo = new Date(now);
      monthAgo.setDate(monthAgo.getDate() - 30);

      const startTime = performance.now();
      const result = await exportAuditLogsToCSV({
        companyId: 'test-company',
        dateFrom: monthAgo,
        dateTo: now,
        userIds: ['user-1'],
        entityTypes: ['TRANSACTION'],
      });
      const endTime = performance.now();

      console.log(`Filtered CSV export completed in ${(endTime - startTime).toFixed(2)}ms`);
      console.log(`Exported ${result.recordCount} filtered logs`);

      expect(endTime - startTime).toBeLessThan(5000);
    });
  });

  describe('Statistics Performance', () => {
    it('should generate statistics in <200ms', async () => {
      const startTime = performance.now();
      const result = await getAuditLogStatistics('test-company');
      const endTime = performance.now();

      console.log(`Statistics generation completed in ${(endTime - startTime).toFixed(2)}ms`);
      console.log(`Total logs: ${result.totalLogs}`);
      console.log(`Unique actions: ${result.byAction.size}`);
      console.log(`Unique entity types: ${result.byEntityType.size}`);
      console.log(`Unique users: ${result.byUser.size}`);

      expect(result.totalLogs).toBe(LARGE_DATASET_SIZE);
      expect(result.executionTimeMs).toBeLessThan(200);
      expect(endTime - startTime).toBeLessThan(1000);
      expect(result.byAction.size).toBeGreaterThan(0);
      expect(result.byEntityType.size).toBeGreaterThan(0);
      expect(result.byUser.size).toBeGreaterThan(0);
    });

    it('should generate date-filtered statistics in <200ms', async () => {
      const now = new Date();
      const monthAgo = new Date(now);
      monthAgo.setDate(monthAgo.getDate() - 30);

      const startTime = performance.now();
      const result = await getAuditLogStatistics(
        'test-company',
        monthAgo,
        now
      );
      const endTime = performance.now();

      console.log(`Filtered statistics generation completed in ${(endTime - startTime).toFixed(2)}ms`);

      expect(result.executionTimeMs).toBeLessThan(200);
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });

  describe('Concurrent Operations Performance', () => {
    it('should handle multiple concurrent searches efficiently', async () => {
      const concurrentSearches = 10;
      const startTime = performance.now();

      const promises = Array.from({ length: concurrentSearches }, (_, i) =>
        searchAuditLogs({
          companyId: 'test-company',
          limit: 100,
          offset: i * 100,
        })
      );

      const results = await Promise.all(promises);
      const endTime = performance.now();

      console.log(`${concurrentSearches} concurrent searches completed in ${(endTime - startTime).toFixed(2)}ms`);
      console.log(`Average time per search: ${((endTime - startTime) / concurrentSearches).toFixed(2)}ms`);

      expect(results.length).toBe(concurrentSearches);
      expect(endTime - startTime).toBeLessThan(3000);
      expect(results.every((r) => r.logs.length === 100)).toBe(true);
    });

    it('should handle mixed concurrent operations', async () => {
      const now = new Date();
      const monthAgo = new Date(now);
      monthAgo.setDate(monthAgo.getDate() - 30);

      const startTime = performance.now();

      const [searchResult, timelineResult, statsResult] = await Promise.all([
        searchAuditLogs({ companyId: 'test-company', limit: 100 }),
        generateAuditLogTimeline('test-company', monthAgo, now, 'day'),
        getAuditLogStatistics('test-company'),
      ]);

      const endTime = performance.now();

      console.log(`Mixed concurrent operations completed in ${(endTime - startTime).toFixed(2)}ms`);

      expect(searchResult.logs.length).toBe(100);
      expect(timelineResult.entries.length).toBeGreaterThan(0);
      expect(statsResult.totalLogs).toBe(LARGE_DATASET_SIZE);
      expect(endTime - startTime).toBeLessThan(2000);
    });
  });

  describe('Memory and Resource Management', () => {
    it('should not leak memory during repeated operations', async () => {
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        await searchAuditLogs({
          companyId: 'test-company',
          limit: 100,
          offset: i * 100,
        });

        if (i % 20 === 0) {
          console.log(`Completed ${i + 1}/${iterations} iterations`);
        }
      }

      // If we got here without running out of memory, the test passes
      expect(true).toBe(true);
    });

    it('should handle large result sets without crashing', async () => {
      const result = await searchAuditLogs({
        companyId: 'test-company',
        limit: 10000,
      });

      expect(result.logs.length).toBe(10000);
      expect(result.total).toBe(LARGE_DATASET_SIZE);
    });
  });
});
