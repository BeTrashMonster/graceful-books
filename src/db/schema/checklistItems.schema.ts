/**
 * Checklist Items Schema Definition
 *
 * Defines the structure for personalized checklist items generated based on
 * user assessment results and customized by business type and financial literacy level.
 *
 * Requirements:
 * - C3: Checklist Generation Engine
 * - CHECK-001: Personalized Checklist System
 * - ARCH-004: CRDT-Compatible Schema Design
 */

import type { BaseEntity, VersionVector } from '../../types/database.types';

/**
 * Checklist item phase - corresponds to user's current financial phase
 */
export enum ChecklistPhase {
  STABILIZE = 'STABILIZE', // Getting basic systems in place
  ORGANIZE = 'ORGANIZE', // Building consistent habits
  BUILD = 'BUILD', // Growing revenue and capabilities
  GROW = 'GROW', // Scaling and optimizing
}

/**
 * Checklist item category - determines when/how often to do the task
 */
export enum ChecklistCategory {
  SETUP = 'SETUP', // One-time setup tasks
  DAILY = 'DAILY', // Daily recurring tasks
  WEEKLY = 'WEEKLY', // Weekly recurring tasks
  MONTHLY = 'MONTHLY', // Monthly recurring tasks
  QUARTERLY = 'QUARTERLY', // Quarterly recurring tasks
  YEARLY = 'YEARLY', // Yearly recurring tasks
  AS_NEEDED = 'AS_NEEDED', // Do when needed
}

/**
 * Checklist item entity
 */
export interface ChecklistItem extends BaseEntity {
  user_id: string; // UUID - links to User
  company_id: string; // UUID - links to Company
  phase: ChecklistPhase; // Which phase this item belongs to
  category: ChecklistCategory; // When to do this task
  title: string; // ENCRYPTED - Short task title (e.g., "Review bank balance")
  description: string; // ENCRYPTED - Detailed description with guidance
  order: number; // Sort order within category
  completed: boolean; // Whether the item is completed
  completed_at: number | null; // Unix timestamp when completed
  snoozed_until: number | null; // Unix timestamp - item hidden until this time
  not_applicable: boolean; // User marked as not applicable to their situation
  streak_count: number; // Number of consecutive completions (for recurring items)
  last_completed_at: number | null; // For tracking streaks
  linked_feature: string | null; // Route/feature ID this links to (e.g., "/transactions/new")
  template_id: string | null; // ID of the template this was generated from
  business_type: string | null; // Business type this was customized for
  literacy_level: number | null; // Financial literacy level (1-5) this was generated for
  version_vector: VersionVector; // For CRDT conflict resolution
}

/**
 * Dexie.js schema definition for ChecklistItems table
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - user_id: For querying items by user
 * - [user_id+phase]: Compound index for phase-filtered queries
 * - [user_id+category]: Compound index for category-filtered queries
 * - [user_id+completed]: Compound index for completed/pending queries
 * - completed_at: For sorting by completion date
 * - updated_at: For CRDT conflict resolution (Last-Write-Wins)
 * - deleted_at: For soft delete tombstone filtering
 */
export const checklistItemsSchema =
  'id, user_id, [user_id+phase], [user_id+category], [user_id+completed], completed_at, updated_at, deleted_at';

/**
 * Table name constant
 */
export const CHECKLIST_ITEMS_TABLE = 'checklistItems';

/**
 * Default values for new ChecklistItem
 */
export const createDefaultChecklistItem = (
  userId: string,
  companyId: string,
  phase: ChecklistPhase,
  category: ChecklistCategory,
  title: string,
  description: string,
  deviceId: string
): Partial<ChecklistItem> => {
  const now = Date.now();

  return {
    user_id: userId,
    company_id: companyId,
    phase,
    category,
    title,
    description,
    order: 0,
    completed: false,
    completed_at: null,
    snoozed_until: null,
    not_applicable: false,
    streak_count: 0,
    last_completed_at: null,
    linked_feature: null,
    template_id: null,
    business_type: null,
    literacy_level: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version_vector: {
      [deviceId]: 1,
    },
  };
};

/**
 * Validation: Ensure checklist item has required fields
 */
export const validateChecklistItem = (item: Partial<ChecklistItem>): string[] => {
  const errors: string[] = [];

  if (!item.user_id) {
    errors.push('user_id is required');
  }

  if (!item.company_id) {
    errors.push('company_id is required');
  }

  if (!item.phase) {
    errors.push('phase is required');
  }

  if (!item.category) {
    errors.push('category is required');
  }

  if (!item.title || item.title.trim() === '') {
    errors.push('title is required');
  }

  if (!item.description || item.description.trim() === '') {
    errors.push('description is required');
  }

  return errors;
};

/**
 * Query helper: Get checklist items for a user
 */
export interface GetChecklistItemsQuery {
  user_id: string;
  phase?: ChecklistPhase;
  category?: ChecklistCategory;
  completed?: boolean;
  not_applicable?: boolean;
  include_snoozed?: boolean;
}

/**
 * Helper: Check if item is currently snoozed
 */
export const isItemSnoozed = (item: ChecklistItem): boolean => {
  if (!item.snoozed_until) {
    return false;
  }
  return Date.now() < item.snoozed_until;
};

/**
 * Helper: Check if item is overdue (for recurring items)
 */
export const isItemOverdue = (item: ChecklistItem): boolean => {
  if (item.completed || item.not_applicable || isItemSnoozed(item)) {
    return false;
  }

  // For non-recurring items, not overdue
  if (item.category === ChecklistCategory.SETUP || item.category === ChecklistCategory.AS_NEEDED) {
    return false;
  }

  if (!item.last_completed_at) {
    // Never completed, not overdue (just pending)
    return false;
  }

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  switch (item.category) {
    case ChecklistCategory.DAILY:
      return now - item.last_completed_at > dayMs;
    case ChecklistCategory.WEEKLY:
      return now - item.last_completed_at > 7 * dayMs;
    case ChecklistCategory.MONTHLY:
      return now - item.last_completed_at > 30 * dayMs;
    case ChecklistCategory.QUARTERLY:
      return now - item.last_completed_at > 90 * dayMs;
    case ChecklistCategory.YEARLY:
      return now - item.last_completed_at > 365 * dayMs;
    default:
      return false;
  }
};

/**
 * Helper: Calculate progress percentage for a set of items
 */
export const calculateProgress = (items: ChecklistItem[]): number => {
  if (items.length === 0) {
    return 0;
  }

  // Filter out N/A items from calculation
  const applicableItems = items.filter((item) => !item.not_applicable);

  if (applicableItems.length === 0) {
    return 100; // All items are N/A
  }

  const completedCount = applicableItems.filter((item) => item.completed).length;
  return Math.round((completedCount / applicableItems.length) * 100);
};

/**
 * Helper: Group items by category
 */
export const groupItemsByCategory = (
  items: ChecklistItem[]
): Record<ChecklistCategory, ChecklistItem[]> => {
  const groups: Record<ChecklistCategory, ChecklistItem[]> = {
    [ChecklistCategory.SETUP]: [],
    [ChecklistCategory.DAILY]: [],
    [ChecklistCategory.WEEKLY]: [],
    [ChecklistCategory.MONTHLY]: [],
    [ChecklistCategory.QUARTERLY]: [],
    [ChecklistCategory.YEARLY]: [],
    [ChecklistCategory.AS_NEEDED]: [],
  };

  items.forEach((item) => {
    groups[item.category].push(item);
  });

  return groups;
};

/**
 * Helper: Get next due date for recurring item
 */
export const getNextDueDate = (item: ChecklistItem): number | null => {
  if (item.category === ChecklistCategory.SETUP || item.category === ChecklistCategory.AS_NEEDED) {
    return null; // Non-recurring
  }

  const lastDate = item.last_completed_at || item.created_at;
  const dayMs = 24 * 60 * 60 * 1000;

  switch (item.category) {
    case ChecklistCategory.DAILY:
      return lastDate + dayMs;
    case ChecklistCategory.WEEKLY:
      return lastDate + 7 * dayMs;
    case ChecklistCategory.MONTHLY:
      return lastDate + 30 * dayMs;
    case ChecklistCategory.QUARTERLY:
      return lastDate + 90 * dayMs;
    case ChecklistCategory.YEARLY:
      return lastDate + 365 * dayMs;
    default:
      return null;
  }
};
