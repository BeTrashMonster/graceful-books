/**
 * Recent Activity Schema Definition
 *
 * Defines the structure for tracking recent user activity including
 * searches, views, and edits for quick access features.
 *
 * Requirements:
 * - I3: UX Efficiency Shortcuts [Nice]
 * - ARCH-002: Zero-Knowledge Encryption (activity data encrypted)
 * - ARCH-004: CRDT-Compatible Schema Design
 */

import type {
  RecentActivity,
  RecentActivityType,
  RecentActivityEntityType,
  CreateRecentActivityOptions,
} from '../../types/recentActivity.types';

/**
 * Dexie.js schema definition for RecentActivity table
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - user_id: For querying by user
 * - company_id: For querying by company
 * - [user_id+company_id]: Compound index for user's company activities
 * - [user_id+activity_type]: For filtering by activity type
 * - [user_id+entity_type]: For filtering by entity type
 * - timestamp: For sorting by recency
 * - updated_at: For CRDT conflict resolution
 * - deleted_at: For soft delete queries
 */
export const recentActivitySchema =
  'id, user_id, company_id, [user_id+company_id], [user_id+activity_type], [user_id+entity_type], timestamp, updated_at, deleted_at';

/**
 * Table name constant
 */
export const RECENT_ACTIVITY_TABLE = 'recent_activity';

/**
 * Default values for new RecentActivity
 */
export const createDefaultRecentActivity = (
  options: CreateRecentActivityOptions,
  deviceId: string
): Partial<RecentActivity> => {
  const now = Date.now();

  return {
    user_id: options.user_id,
    company_id: options.company_id,
    activity_type: options.activity_type,
    entity_type: options.entity_type,
    entity_id: options.entity_id || null,
    entity_label: options.entity_label,
    search_query: options.search_query || null,
    context: options.context ? JSON.stringify(options.context) : null,
    timestamp: now,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version_vector: {
      [deviceId]: 1,
    },
  };
};

/**
 * Validation: Ensure recent activity has valid fields
 */
export const validateRecentActivity = (activity: Partial<RecentActivity>): string[] => {
  const errors: string[] = [];

  if (!activity.user_id) {
    errors.push('user_id is required');
  }

  if (!activity.company_id) {
    errors.push('company_id is required');
  }

  if (!activity.activity_type) {
    errors.push('activity_type is required');
  }

  if (!activity.entity_type) {
    errors.push('entity_type is required');
  }

  if (!activity.entity_label || activity.entity_label.trim() === '') {
    errors.push('entity_label is required');
  }

  if (!activity.timestamp) {
    errors.push('timestamp is required');
  }

  // Search activities should have a search_query
  if (activity.activity_type === 'SEARCH' && !activity.search_query) {
    errors.push('search_query is required for SEARCH activities');
  }

  // View/Edit/Create activities should have an entity_id
  if (
    activity.activity_type &&
    ['VIEW', 'EDIT', 'CREATE'].includes(activity.activity_type) &&
    !activity.entity_id
  ) {
    errors.push('entity_id is required for VIEW, EDIT, and CREATE activities');
  }

  return errors;
};

/**
 * Helper: Get activity type display name
 */
export const getActivityTypeDisplayName = (type: RecentActivityType): string => {
  const displayNames: Record<RecentActivityType, string> = {
    SEARCH: 'Search',
    VIEW: 'Viewed',
    EDIT: 'Edited',
    CREATE: 'Created',
  };

  return displayNames[type] || type;
};

/**
 * Helper: Get entity type display name
 */
export const getEntityTypeDisplayName = (type: RecentActivityEntityType): string => {
  const displayNames: Record<RecentActivityEntityType, string> = {
    TRANSACTION: 'Transaction',
    INVOICE: 'Invoice',
    BILL: 'Bill',
    CONTACT: 'Contact',
    PRODUCT: 'Product',
    ACCOUNT: 'Account',
    REPORT: 'Report',
    CHECKLIST_ITEM: 'Checklist Item',
    GLOBAL: 'All',
  };

  return displayNames[type] || type;
};

/**
 * Helper: Get entity type icon/emoji
 */
export const getEntityTypeIcon = (type: RecentActivityEntityType): string => {
  const icons: Record<RecentActivityEntityType, string> = {
    TRANSACTION: '💳',
    INVOICE: '📄',
    BILL: '🧾',
    CONTACT: '👤',
    PRODUCT: '📦',
    ACCOUNT: '🏦',
    REPORT: '📊',
    CHECKLIST_ITEM: '✓',
    GLOBAL: '🔍',
  };

  return icons[type] || '📝';
};

/**
 * Helper: Get relative time string
 */
export const getRelativeTimeString = (timestamp: number): string => {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin === 1) return '1 minute ago';
  if (diffMin < 60) return `${diffMin} minutes ago`;
  if (diffHour === 1) return '1 hour ago';
  if (diffHour < 24) return `${diffHour} hours ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay} days ago`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)} weeks ago`;
  if (diffDay < 365) return `${Math.floor(diffDay / 30)} months ago`;
  return `${Math.floor(diffDay / 365)} years ago`;
};

/**
 * Helper: Check if activity is recent (within last 7 days)
 */
export const isRecentActivity = (timestamp: number): boolean => {
  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  return now - timestamp < sevenDaysMs;
};

/**
 * Helper: Group activities by date
 */
export interface ActivityDateGroup {
  label: string; // "Today", "Yesterday", "Last 7 days", etc.
  timestamp_start: number;
  timestamp_end: number;
}

export const getActivityDateGroups = (): ActivityDateGroup[] => {
  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;
  const oneWeekMs = 7 * oneDayMs;
  const oneMonthMs = 30 * oneDayMs;

  return [
    {
      label: 'Today',
      timestamp_start: now - oneDayMs,
      timestamp_end: now,
    },
    {
      label: 'Yesterday',
      timestamp_start: now - 2 * oneDayMs,
      timestamp_end: now - oneDayMs,
    },
    {
      label: 'Last 7 days',
      timestamp_start: now - oneWeekMs,
      timestamp_end: now - 2 * oneDayMs,
    },
    {
      label: 'Last 30 days',
      timestamp_start: now - oneMonthMs,
      timestamp_end: now - oneWeekMs,
    },
    {
      label: 'Older',
      timestamp_start: 0,
      timestamp_end: now - oneMonthMs,
    },
  ];
};

/**
 * Helper: Deduplicate recent activities
 * Keeps only the most recent activity for each unique entity
 */
export const deduplicateActivities = (activities: RecentActivity[]): RecentActivity[] => {
  const seen = new Map<string, RecentActivity>();

  // Sort by timestamp descending (newest first)
  const sorted = [...activities].sort((a, b) => b.timestamp - a.timestamp);

  for (const activity of sorted) {
    // Create a unique key based on entity type and id
    const key = activity.entity_id
      ? `${activity.entity_type}:${activity.entity_id}`
      : `${activity.entity_type}:${activity.search_query}`;

    // Only keep the first (newest) occurrence
    if (!seen.has(key)) {
      seen.set(key, activity);
    }
  }

  return Array.from(seen.values()).sort((a, b) => b.timestamp - a.timestamp);
};
