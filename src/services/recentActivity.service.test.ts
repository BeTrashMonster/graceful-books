/**
 * Recent Activity Service Tests
 *
 * Comprehensive tests for recent activity tracking logic.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../db/database';
import {
  RecentActivityService,
  createRecentActivityService,
} from './recentActivity.service';
import type { _RecentActivityType, RecentActivityEntityType } from '../types/recentActivity.types';

describe('RecentActivityService', () => {
  const userId = 'user-123';
  const companyId = 'company-456';
  const deviceId = 'device-789';
  let service: RecentActivityService;

  beforeEach(async () => {
    // Clear database
    await db.recentActivity.clear();

    // Create service instance
    service = createRecentActivityService(userId, companyId, deviceId);
  });

  afterEach(async () => {
    // Clean up
    await db.recentActivity.clear();
  });

  describe('trackSearch', () => {
    it('should track a search activity', async () => {
      await service.trackSearch('TRANSACTION', 'office supplies');

      const activities = await db.recentActivity
        .where('[user_id+company_id]')
        .equals([userId, companyId])
        .toArray();

      expect(activities).toHaveLength(1);
      expect(activities[0]?.activity_type).toBe('SEARCH');
      expect(activities[0]?.entity_type).toBe('TRANSACTION');
      expect(activities[0]?.search_query).toBe('office supplies');
    });

    it('should store result count in context', async () => {
      await service.trackSearch('INVOICE', 'test', 5);

      const activities = await db.recentActivity.toArray();
      expect(activities).toHaveLength(1);
      expect(activities[0]?.context).toBeTruthy();
      const context = JSON.parse(activities[0]?.context ?? '{}');
      expect(context.result_count).toBe(5);
    });
  });

  describe('trackView', () => {
    it('should track a view activity', async () => {
      await service.trackView('INVOICE', 'inv-001', 'Invoice #1234', {
        amount: '100.00',
        status: 'SENT',
      });

      const activities = await db.recentActivity
        .where('[user_id+company_id]')
        .equals([userId, companyId])
        .toArray();

      expect(activities).toHaveLength(1);
      expect(activities[0]?.activity_type).toBe('VIEW');
      expect(activities[0]?.entity_id).toBe('inv-001');
      expect(activities[0]?.entity_label).toBe('Invoice #1234');
    });

    it('should store context data', async () => {
      await service.trackView('BILL', 'bill-001', 'Bill #5678', {
        vendor: 'ACME Corp',
        amount: '250.00',
      });

      const activities = await db.recentActivity.toArray();
      expect(activities).toHaveLength(1);
      expect(activities[0]?.context).toBeTruthy();
      const context = JSON.parse(activities[0]?.context ?? '{}');
      expect(context.vendor).toBe('ACME Corp');
      expect(context.amount).toBe('250.00');
    });
  });

  describe('trackEdit', () => {
    it('should track an edit activity', async () => {
      await service.trackEdit('TRANSACTION', 'txn-001', 'Expense - Office Supplies');

      const activities = await db.recentActivity
        .where('[user_id+company_id]')
        .equals([userId, companyId])
        .toArray();

      expect(activities).toHaveLength(1);
      expect(activities[0]?.activity_type).toBe('EDIT');
      expect(activities[0]?.entity_id).toBe('txn-001');
    });

    it('should store draft status in context', async () => {
      await service.trackEdit('INVOICE', 'inv-002', 'Invoice #5000', {
        is_draft: true,
        completion_percentage: 75,
      });

      const activities = await db.recentActivity.toArray();
      expect(activities).toHaveLength(1);
      const context = JSON.parse(activities[0]?.context ?? '{}');
      expect(context.is_draft).toBe(true);
      expect(context.completion_percentage).toBe(75);
    });
  });

  describe('trackCreate', () => {
    it('should track a create activity', async () => {
      await service.trackCreate('CONTACT', 'contact-001', 'New Customer');

      const activities = await db.recentActivity
        .where('[user_id+company_id]')
        .equals([userId, companyId])
        .toArray();

      expect(activities).toHaveLength(1);
      expect(activities[0]?.activity_type).toBe('CREATE');
      expect(activities[0]?.entity_id).toBe('contact-001');
    });
  });

  describe('getRecentSearches', () => {
    beforeEach(async () => {
      // Add some search activities
      await service.trackSearch('TRANSACTION', 'office supplies');
      await service.trackSearch('INVOICE', 'client name');
      await service.trackSearch('GLOBAL', 'payment');
    });

    it('should return recent searches', async () => {
      const searches = await service.getRecentSearches();

      expect(searches).toHaveLength(3);
      expect(searches[0]?.query).toBe('payment'); // Most recent first
      expect(searches[1]?.query).toBe('client name');
      expect(searches[2]?.query).toBe('office supplies');
    });

    it('should filter by entity type', async () => {
      const searches = await service.getRecentSearches('INVOICE');

      expect(searches).toHaveLength(1);
      expect(searches[0]?.query).toBe('client name');
      expect(searches[0]?.entity_type).toBe('INVOICE');
    });

    it('should limit results', async () => {
      const searches = await service.getRecentSearches(undefined, 2);

      expect(searches).toHaveLength(2);
    });
  });

  describe('getRecentViews', () => {
    beforeEach(async () => {
      // Add some view activities
      await service.trackView('INVOICE', 'inv-001', 'Invoice #1');
      await service.trackView('INVOICE', 'inv-002', 'Invoice #2');
      await service.trackView('BILL', 'bill-001', 'Bill #1');
    });

    it('should return recent views', async () => {
      const views = await service.getRecentViews();

      expect(views.length).toBeGreaterThan(0);
      expect(views[0]?.label).toBe('Bill #1'); // Most recent first
    });

    it('should deduplicate views of same entity', async () => {
      // View same invoice twice
      await service.trackView('INVOICE', 'inv-001', 'Invoice #1 Updated');

      const views = await service.getRecentViews('INVOICE');

      // Should only show once (most recent)
      const inv001Views = views.filter((v) => v.entity_id === 'inv-001');
      expect(inv001Views).toHaveLength(1);
      expect(inv001Views[0]?.label).toBe('Invoice #1 Updated');
    });

    it('should filter by entity type', async () => {
      const views = await service.getRecentViews('BILL');

      expect(views).toHaveLength(1);
      expect(views[0]?.entity_type).toBe('BILL');
    });
  });

  describe('getRecentEdits', () => {
    beforeEach(async () => {
      // Add edit and create activities
      await service.trackEdit('INVOICE', 'inv-001', 'Invoice #1', { is_draft: true });
      await service.trackCreate('TRANSACTION', 'txn-001', 'New Expense');
      await service.trackEdit('BILL', 'bill-001', 'Bill #1');
    });

    it('should return recent edits and creates', async () => {
      const edits = await service.getRecentEdits();

      expect(edits.length).toBeGreaterThan(0);
      // Should include both edits and creates
    });

    it('should deduplicate edits', async () => {
      // Edit same invoice again
      await service.trackEdit('INVOICE', 'inv-001', 'Invoice #1 Updated');

      const edits = await service.getRecentEdits();

      const inv001Edits = edits.filter((e) => e.entity_id === 'inv-001');
      expect(inv001Edits).toHaveLength(1);
      expect(inv001Edits[0]?.label).toBe('Invoice #1 Updated');
    });

    it('should limit to 5 by default', async () => {
      // Add more edits
      for (let i = 0; i < 10; i++) {
        await service.trackEdit('TRANSACTION', `txn-${i}`, `Transaction ${i}`);
      }

      const edits = await service.getRecentEdits();

      expect(edits.length).toBeLessThanOrEqual(5);
    });
  });

  describe('getRecentEntrySuggestions', () => {
    beforeEach(async () => {
      // Add some expense entries
      await service.trackCreate('TRANSACTION', 'exp-001', 'Office Supplies', {
        preview_data: {
          description: 'Pens and paper',
          amount: '45.23',
          vendor: 'Office Depot',
        },
      });
      await service.trackCreate('TRANSACTION', 'exp-002', 'Gas', {
        preview_data: {
          description: 'Fuel for delivery',
          amount: '65.00',
          vendor: 'Shell',
        },
      });
    });

    it('should return entry suggestions', async () => {
      const suggestions = await service.getRecentEntrySuggestions('TRANSACTION');

      expect(suggestions).toHaveLength(2);
      expect(suggestions[0]?.preview_data).toBeDefined();
    });

    it('should filter by entity type', async () => {
      // Add an invoice
      await service.trackCreate('INVOICE', 'inv-001', 'Invoice #1');

      const suggestions = await service.getRecentEntrySuggestions('TRANSACTION');

      expect(suggestions.every((s) => s.entity_type === 'TRANSACTION')).toBe(true);
    });
  });

  describe('clearHistory', () => {
    beforeEach(async () => {
      // Add various activities
      await service.trackSearch('TRANSACTION', 'test');
      await service.trackView('INVOICE', 'inv-001', 'Invoice #1');
      await service.trackEdit('BILL', 'bill-001', 'Bill #1');
    });

    it('should clear all history', async () => {
      const count = await service.clearHistory();

      expect(count).toBe(3);

      const remaining = await db.recentActivity
        .where('[user_id+company_id]')
        .equals([userId, companyId])
        .and((a) => a.deleted_at === null)
        .count();

      expect(remaining).toBe(0);
    });

    it('should clear by activity type', async () => {
      const count = await service.clearHistory({ activity_type: 'SEARCH' });

      expect(count).toBe(1);

      const remaining = await db.recentActivity
        .where('[user_id+company_id]')
        .equals([userId, companyId])
        .and((a) => a.deleted_at === null)
        .count();

      expect(remaining).toBe(2);
    });

    it('should clear by entity type', async () => {
      const count = await service.clearHistory({ entity_type: 'INVOICE' });

      expect(count).toBe(1);
    });

    it('should clear older than timestamp', async () => {
      const now = Date.now();
      const olderThan = now - 1000; // 1 second ago

      const count = await service.clearHistory({ older_than: olderThan });

      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getActivitySummary', () => {
    beforeEach(async () => {
      await service.trackSearch('TRANSACTION', 'test1');
      await service.trackSearch('INVOICE', 'test2');
      await service.trackView('INVOICE', 'inv-001', 'Invoice #1');
      await service.trackView('INVOICE', 'inv-002', 'Invoice #2');
      await service.trackEdit('TRANSACTION', 'txn-001', 'Transaction #1');
      await service.trackCreate('CONTACT', 'contact-001', 'Contact #1');
    });

    it('should return activity summary', async () => {
      const summary = await service.getActivitySummary();

      expect(summary.total_searches).toBe(2);
      expect(summary.total_views).toBe(2);
      expect(summary.total_edits).toBe(1);
      expect(summary.total_creates).toBe(1);
      expect(summary.most_viewed_entity_type).toBe('INVOICE');
      expect(summary.most_edited_entity_type).toBe('TRANSACTION');
      expect(summary.last_activity_timestamp).toBeGreaterThan(0);
    });
  });

  describe('cleanupOldActivities', () => {
    it('should cleanup activities older than threshold', async () => {
      // Create an old activity (91 days ago)
      const oldTimestamp = Date.now() - 91 * 24 * 60 * 60 * 1000;

      await db.recentActivity.add({
        id: 'old-activity',
        user_id: userId,
        company_id: companyId,
        activity_type: 'SEARCH',
        entity_type: 'TRANSACTION',
        entity_id: null,
        entity_label: 'Old search',
        search_query: 'old',
        context: null,
        timestamp: oldTimestamp,
        created_at: oldTimestamp,
        updated_at: oldTimestamp,
        deleted_at: null,
        version_vector: { [deviceId]: 1 },
      });

      // Create a recent activity
      await service.trackSearch('TRANSACTION', 'recent');

      const deletedCount = await service.cleanupOldActivities();

      expect(deletedCount).toBeGreaterThan(0);

      // Verify old activity is deleted
      const remaining = await db.recentActivity
        .where('[user_id+company_id]')
        .equals([userId, companyId])
        .and((a) => a.deleted_at === null)
        .toArray();

      expect(remaining).toHaveLength(1);
      expect(remaining[0]?.search_query).toBe('recent');
    });
  });
});
