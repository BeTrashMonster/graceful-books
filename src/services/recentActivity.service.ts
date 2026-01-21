/**
 * Recent Activity Service
 *
 * Tracks user activity for quick access features including searches,
 * views, and edits. Provides recent history with privacy controls.
 *
 * Requirements:
 * - I3: UX Efficiency Shortcuts [Nice]
 * - ARCH-002: Zero-Knowledge Encryption (activity data encrypted)
 * - ARCH-003: Local-First Data Store
 */

import { db } from '../db/database';
import { createDefaultRecentActivity, validateRecentActivity, deduplicateActivities } from '../db/schema/recentActivity.schema';
import { RecentActivityType } from '../types/recentActivity.types';
import type {
  RecentActivity,
  RecentActivityEntityType,
  CreateRecentActivityOptions,
  GetRecentActivityQuery,
  RecentSearchEntry,
  RecentViewEntry,
  RecentEditEntry,
  RecentEntrySuggestion,
  GroupedRecentActivity,
  RecentActivitySummary,
  ClearHistoryOptions,
} from '../types/recentActivity.types';
import { logger } from '../utils/logger';

const serviceLogger = logger.child('RecentActivityService');

/**
 * Recent Activity Service Class
 */
export class RecentActivityService {
  private userId: string;
  private companyId: string;
  private deviceId: string;

  // Configuration
  private readonly MAX_RECENT_SEARCHES = 10;
  private readonly MAX_RECENT_VIEWS = 20;
  private readonly MAX_RECENT_EDITS = 5;
  private readonly MAX_RECENT_ENTRIES = 20;
  private readonly CLEANUP_THRESHOLD_DAYS = 90; // Clean up activities older than 90 days

  constructor(userId: string, companyId: string, deviceId: string) {
    this.userId = userId;
    this.companyId = companyId;
    this.deviceId = deviceId;
  }

  /**
   * Track a search activity
   */
  async trackSearch(
    entityType: RecentActivityEntityType,
    query: string,
    resultCount?: number
  ): Promise<void> {
    try {
      const options: CreateRecentActivityOptions = {
        user_id: this.userId,
        company_id: this.companyId,
        activity_type: RecentActivityType.SEARCH,
        entity_type: entityType,
        entity_label: `Search: ${query}`,
        search_query: query,
        context: resultCount !== undefined ? { result_count: resultCount } : undefined,
      };

      await this.createActivity(options);

      serviceLogger.info('Tracked search activity', {
        userId: this.userId,
        entityType,
        query,
      });
    } catch (error) {
      serviceLogger.error('Failed to track search activity', { error, query });
    }
  }

  /**
   * Track a view activity
   */
  async trackView(
    entityType: RecentActivityEntityType,
    entityId: string,
    label: string,
    context?: Record<string, any>
  ): Promise<void> {
    try {
      const options: CreateRecentActivityOptions = {
        user_id: this.userId,
        company_id: this.companyId,
        activity_type: RecentActivityType.VIEW,
        entity_type: entityType,
        entity_id: entityId,
        entity_label: label,
        context,
      };

      await this.createActivity(options);

      serviceLogger.info('Tracked view activity', {
        userId: this.userId,
        entityType,
        entityId,
      });
    } catch (error) {
      serviceLogger.error('Failed to track view activity', { error, entityId });
    }
  }

  /**
   * Track an edit activity
   */
  async trackEdit(
    entityType: RecentActivityEntityType,
    entityId: string,
    label: string,
    context?: Record<string, any>
  ): Promise<void> {
    try {
      const options: CreateRecentActivityOptions = {
        user_id: this.userId,
        company_id: this.companyId,
        activity_type: RecentActivityType.EDIT,
        entity_type: entityType,
        entity_id: entityId,
        entity_label: label,
        context,
      };

      await this.createActivity(options);

      serviceLogger.info('Tracked edit activity', {
        userId: this.userId,
        entityType,
        entityId,
      });
    } catch (error) {
      serviceLogger.error('Failed to track edit activity', { error, entityId });
    }
  }

  /**
   * Track a create activity
   */
  async trackCreate(
    entityType: RecentActivityEntityType,
    entityId: string,
    label: string,
    context?: Record<string, any>
  ): Promise<void> {
    try {
      const options: CreateRecentActivityOptions = {
        user_id: this.userId,
        company_id: this.companyId,
        activity_type: RecentActivityType.CREATE,
        entity_type: entityType,
        entity_id: entityId,
        entity_label: label,
        context,
      };

      await this.createActivity(options);

      serviceLogger.info('Tracked create activity', {
        userId: this.userId,
        entityType,
        entityId,
      });
    } catch (error) {
      serviceLogger.error('Failed to track create activity', { error, entityId });
    }
  }

  /**
   * Get recent searches
   */
  async getRecentSearches(
    entityType?: RecentActivityEntityType,
    limit: number = this.MAX_RECENT_SEARCHES
  ): Promise<RecentSearchEntry[]> {
    try {
      const query: GetRecentActivityQuery = {
        user_id: this.userId,
        company_id: this.companyId,
        activity_type: RecentActivityType.SEARCH,
        entity_type: entityType,
        limit,
      };

      const activities = await this.getRecentActivity(query);

      return activities.map((activity) => ({
        id: activity.id,
        query: activity.search_query || '',
        entity_type: activity.entity_type,
        timestamp: activity.timestamp,
        result_count: activity.context ? JSON.parse(activity.context).result_count : undefined,
      }));
    } catch (error) {
      serviceLogger.error('Failed to get recent searches', { error });
      return [];
    }
  }

  /**
   * Get recently viewed items
   */
  async getRecentViews(
    entityType?: RecentActivityEntityType,
    limit: number = this.MAX_RECENT_VIEWS
  ): Promise<RecentViewEntry[]> {
    try {
      const query: GetRecentActivityQuery = {
        user_id: this.userId,
        company_id: this.companyId,
        activity_type: RecentActivityType.VIEW,
        entity_type: entityType,
        limit,
      };

      const activities = await this.getRecentActivity(query);
      const deduplicated = deduplicateActivities(activities);

      return deduplicated.map((activity) => ({
        id: activity.entity_id || activity.id,
        entity_type: activity.entity_type,
        entity_id: activity.entity_id || '',
        label: activity.entity_label,
        timestamp: activity.timestamp,
        context: activity.context ? JSON.parse(activity.context) : undefined,
      }));
    } catch (error) {
      serviceLogger.error('Failed to get recent views', { error });
      return [];
    }
  }

  /**
   * Get recently edited items ("Resume where you left off")
   */
  async getRecentEdits(limit: number = this.MAX_RECENT_EDITS): Promise<RecentEditEntry[]> {
    try {
      const query: GetRecentActivityQuery = {
        user_id: this.userId,
        company_id: this.companyId,
        activity_type: [RecentActivityType.EDIT, RecentActivityType.CREATE],
        limit,
      };

      const activities = await this.getRecentActivity(query);
      const deduplicated = deduplicateActivities(activities);

      return deduplicated.map((activity) => {
        const context = activity.context ? JSON.parse(activity.context) : {};
        return {
          id: activity.entity_id || activity.id,
          entity_type: activity.entity_type,
          entity_id: activity.entity_id || '',
          label: activity.entity_label,
          timestamp: activity.timestamp,
          is_draft: context.is_draft,
          completion_percentage: context.completion_percentage,
        };
      });
    } catch (error) {
      serviceLogger.error('Failed to get recent edits', { error });
      return [];
    }
  }

  /**
   * Get recent entry suggestions (for forms)
   */
  async getRecentEntrySuggestions(
    entityType: RecentActivityEntityType,
    limit: number = this.MAX_RECENT_ENTRIES
  ): Promise<RecentEntrySuggestion[]> {
    try {
      const query: GetRecentActivityQuery = {
        user_id: this.userId,
        company_id: this.companyId,
        activity_type: [RecentActivityType.CREATE, RecentActivityType.EDIT],
        entity_type: entityType,
        limit,
      };

      const activities = await this.getRecentActivity(query);
      const deduplicated = deduplicateActivities(activities);

      return deduplicated.map((activity) => {
        const context = activity.context ? JSON.parse(activity.context) : {};
        return {
          id: activity.entity_id || activity.id,
          entity_type: activity.entity_type,
          entity_id: activity.entity_id || '',
          label: activity.entity_label,
          timestamp: activity.timestamp,
          preview_data: context.preview_data || {},
        };
      });
    } catch (error) {
      serviceLogger.error('Failed to get recent entry suggestions', { error });
      return [];
    }
  }

  /**
   * Get grouped recent activity
   */
  async getGroupedRecentActivity(): Promise<GroupedRecentActivity[]> {
    try {
      const query: GetRecentActivityQuery = {
        user_id: this.userId,
        company_id: this.companyId,
        activity_type: [RecentActivityType.VIEW, RecentActivityType.EDIT],
        limit: 50, // Get more for grouping
      };

      const activities = await this.getRecentActivity(query);
      const deduplicated = deduplicateActivities(activities);

      // Group by entity type
      const grouped = deduplicated.reduce((acc, activity) => {
        const entityType = activity.entity_type;
        if (!acc[entityType]) {
          acc[entityType] = [];
        }
        acc[entityType].push({
          id: activity.entity_id || activity.id,
          entity_type: activity.entity_type,
          entity_id: activity.entity_id || '',
          label: activity.entity_label,
          timestamp: activity.timestamp,
          context: activity.context ? JSON.parse(activity.context) : undefined,
        });
        return acc;
      }, {} as Record<RecentActivityEntityType, RecentViewEntry[]>);

      return Object.entries(grouped).map(([entityType, activities]) => ({
        entity_type: entityType as RecentActivityEntityType,
        activities: activities.slice(0, 10), // Limit per type
        count: activities.length,
      }));
    } catch (error) {
      serviceLogger.error('Failed to get grouped recent activity', { error });
      return [];
    }
  }

  /**
   * Get activity summary
   */
  async getActivitySummary(): Promise<RecentActivitySummary> {
    try {
      const allActivities = await db.recentActivity
        .where('[user_id+company_id]')
        .equals([this.userId, this.companyId])
        .and((a) => a.deleted_at === null)
        .toArray();

      const total_searches = allActivities.filter((a) => a.activity_type === 'SEARCH').length;
      const total_views = allActivities.filter((a) => a.activity_type === 'VIEW').length;
      const total_edits = allActivities.filter((a) => a.activity_type === 'EDIT').length;
      const total_creates = allActivities.filter((a) => a.activity_type === 'CREATE').length;

      // Find most viewed entity type
      const viewsByType = allActivities
        .filter((a) => a.activity_type === 'VIEW')
        .reduce((acc, a) => {
          acc[a.entity_type] = (acc[a.entity_type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

      const most_viewed_entity_type =
        Object.entries(viewsByType).sort(([, a], [, b]) => b - a)[0]?.[0] as
          | RecentActivityEntityType
          | null || null;

      // Find most edited entity type
      const editsByType = allActivities
        .filter((a) => a.activity_type === 'EDIT')
        .reduce((acc, a) => {
          acc[a.entity_type] = (acc[a.entity_type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

      const most_edited_entity_type =
        Object.entries(editsByType).sort(([, a], [, b]) => b - a)[0]?.[0] as
          | RecentActivityEntityType
          | null || null;

      const last_activity_timestamp =
        allActivities.length > 0
          ? Math.max(...allActivities.map((a) => a.timestamp))
          : null;

      return {
        total_searches,
        total_views,
        total_edits,
        total_creates,
        most_viewed_entity_type,
        most_edited_entity_type,
        last_activity_timestamp,
      };
    } catch (error) {
      serviceLogger.error('Failed to get activity summary', { error });
      return {
        total_searches: 0,
        total_views: 0,
        total_edits: 0,
        total_creates: 0,
        most_viewed_entity_type: null,
        most_edited_entity_type: null,
        last_activity_timestamp: null,
      };
    }
  }

  /**
   * Clear history
   */
  async clearHistory(options?: Omit<ClearHistoryOptions, 'user_id' | 'company_id'>): Promise<number> {
    try {
      let query = db.recentActivity
        .where('[user_id+company_id]')
        .equals([this.userId, this.companyId])
        .and((a) => a.deleted_at === null);

      if (options?.activity_type) {
        const types = Array.isArray(options.activity_type) ? options.activity_type : [options.activity_type];
        query = query.and((a) => types.includes(a.activity_type));
      }

      if (options?.entity_type) {
        const types = Array.isArray(options.entity_type) ? options.entity_type : [options.entity_type];
        query = query.and((a) => types.includes(a.entity_type));
      }

      if (options?.older_than) {
        query = query.and((a) => a.timestamp < options.older_than!);
      }

      const activities = await query.toArray();
      const now = Date.now();

      // Soft delete
      await Promise.all(
        activities.map((activity) =>
          db.recentActivity.update(activity.id, {
            deleted_at: now,
            updated_at: now,
          })
        )
      );

      serviceLogger.info('Cleared history', {
        userId: this.userId,
        count: activities.length,
        options,
      });

      return activities.length;
    } catch (error) {
      serviceLogger.error('Failed to clear history', { error, options });
      throw error;
    }
  }

  /**
   * Cleanup old activities
   * Removes activities older than the threshold
   */
  async cleanupOldActivities(): Promise<number> {
    try {
      const thresholdMs = this.CLEANUP_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
      const cutoffTimestamp = Date.now() - thresholdMs;

      return await this.clearHistory({ older_than: cutoffTimestamp });
    } catch (error) {
      serviceLogger.error('Failed to cleanup old activities', { error });
      return 0;
    }
  }

  /**
   * Create a recent activity record
   */
  private async createActivity(options: CreateRecentActivityOptions): Promise<void> {
    const activityData = createDefaultRecentActivity(options, this.deviceId);

    // Validate
    const errors = validateRecentActivity(activityData);
    if (errors.length > 0) {
      throw new Error(`Invalid recent activity: ${errors.join(', ')}`);
    }

    // Create unique ID
    const id = crypto.randomUUID();

    // Save to database
    await db.recentActivity.add({
      ...activityData,
      id,
    } as RecentActivity);

    // Cleanup if we have too many activities
    await this.maybeCleanup(options.activity_type, options.entity_type);
  }

  /**
   * Get recent activity
   */
  private async getRecentActivity(query: GetRecentActivityQuery): Promise<RecentActivity[]> {
    let dbQuery = db.recentActivity
      .where('[user_id+company_id]')
      .equals([query.user_id, query.company_id])
      .and((a) => a.deleted_at === null);

    if (query.activity_type) {
      const types = Array.isArray(query.activity_type) ? query.activity_type : [query.activity_type];
      dbQuery = dbQuery.and((a) => types.includes(a.activity_type));
    }

    if (query.entity_type) {
      const types = Array.isArray(query.entity_type) ? query.entity_type : [query.entity_type];
      dbQuery = dbQuery.and((a) => types.includes(a.entity_type));
    }

    if (query.since) {
      dbQuery = dbQuery.and((a) => a.timestamp >= query.since!);
    }

    const activities = await dbQuery.reverse().sortBy('timestamp');

    const limit = query.limit || 20;
    const offset = query.offset || 0;

    return activities.slice(offset, offset + limit);
  }

  /**
   * Maybe cleanup old activities to prevent database bloat
   */
  private async maybeCleanup(
    activityType: RecentActivityType,
    entityType: RecentActivityEntityType
  ): Promise<void> {
    try {
      // Get count for this activity type and entity type
      const count = await db.recentActivity
        .where('[user_id+activity_type]')
        .equals([this.userId, activityType])
        .and((a) => a.entity_type === entityType && a.deleted_at === null)
        .count();

      // Determine max based on activity type
      let maxCount = 100; // Default max
      if (activityType === 'SEARCH') {
        maxCount = this.MAX_RECENT_SEARCHES * 2;
      } else if (activityType === 'VIEW') {
        maxCount = this.MAX_RECENT_VIEWS * 2;
      } else if (activityType === 'EDIT' || activityType === 'CREATE') {
        maxCount = this.MAX_RECENT_EDITS * 2;
      }

      // If we're over the limit, delete oldest
      if (count > maxCount) {
        const toDelete = await db.recentActivity
          .where('[user_id+activity_type]')
          .equals([this.userId, activityType])
          .and((a) => a.entity_type === entityType && a.deleted_at === null)
          .sortBy('timestamp');

        const deleteCount = count - maxCount;
        const now = Date.now();

        await Promise.all(
          toDelete.slice(0, deleteCount).map((activity) =>
            db.recentActivity.update(activity.id, {
              deleted_at: now,
              updated_at: now,
            })
          )
        );

        serviceLogger.info('Cleaned up old activities', {
          userId: this.userId,
          activityType,
          entityType,
          deletedCount: deleteCount,
        });
      }
    } catch (error) {
      serviceLogger.error('Failed to cleanup activities', { error });
      // Don't throw - this is optional cleanup
    }
  }
}

/**
 * Create recent activity service instance
 */
export function createRecentActivityService(
  userId: string,
  companyId: string,
  deviceId: string
): RecentActivityService {
  return new RecentActivityService(userId, companyId, deviceId);
}
