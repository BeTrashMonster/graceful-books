/**
 * Checklist Items Data Access Layer
 *
 * Provides CRUD operations for checklist items with:
 * - Encryption/decryption integration points
 * - CRDT version vector management
 * - Soft delete with tombstone markers
 * - Streak tracking and completion logic
 *
 * Requirements:
 * - C3: Checklist Generation Engine
 * - CHECK-001: Personalized Checklist System
 */

import { nanoid } from 'nanoid';
import { db } from './database';
import type { DatabaseResult, EncryptionContext } from './types';
import type {
  ChecklistItem,
  GetChecklistItemsQuery,
} from '../db/schema/checklistItems.schema';
import {
  isItemSnoozed,
} from '../db/schema/checklistItems.schema';
import type {
  AssessmentResults,
  ChecklistGenerationOptions,
  ChecklistGenerationResult,
  ChecklistStats,
} from '../features/checklist/types';
import {
  generateChecklistItems,
  generateChecklistItemsForPhase,
} from '../features/checklist/checklistGenerator';
import type { VersionVector } from '../types/database.types';

/**
 * Generate device ID (stored in localStorage)
 */
function getDeviceId(): string {
  let deviceId = localStorage.getItem('deviceId');
  if (!deviceId) {
    deviceId = nanoid();
    localStorage.setItem('deviceId', deviceId);
  }
  return deviceId;
}

/**
 * Increment version vector for an update
 */
function incrementVersionVector(current: VersionVector): VersionVector {
  const deviceId = getDeviceId();
  return {
    ...current,
    [deviceId]: (current[deviceId] || 0) + 1,
  };
}

/**
 * Generate personalized checklist based on assessment results
 *
 * @param assessmentResults - User's assessment results
 * @param options - Generation options
 * @param context - Encryption context
 * @returns Result with statistics about generation
 */
export async function generateChecklist(
  assessmentResults: AssessmentResults,
  options?: ChecklistGenerationOptions,
  context?: EncryptionContext
): Promise<DatabaseResult<ChecklistGenerationResult>> {
  try {
    // Generate items from templates
    const itemsToCreate = options?.regenerate
      ? generateChecklistItems(assessmentResults, options)
      : generateChecklistItemsForPhase(assessmentResults, options);

    // If regenerate, delete existing items first (soft delete)
    if (options?.regenerate) {
      const existing = await db.checklistItems
        .where('user_id')
        .equals(assessmentResults.userId)
        .and((item) => !item.deleted_at)
        .toArray();

      const now = Date.now();
      for (const item of existing) {
        await db.checklistItems.update(item.id, {
          deleted_at: now,
          version_vector: incrementVersionVector(item.version_vector),
          updated_at: now,
        });
      }
    }

    // Check which items already exist (by template_id)
    const existingItems = await db.checklistItems
      .where('user_id')
      .equals(assessmentResults.userId)
      .and((item) => !item.deleted_at && !options?.includeCompleted ? !item.completed : true)
      .toArray();

    const existingTemplateIds = new Set(
      existingItems.map((item) => item.template_id).filter((id): id is string => id !== null)
    );

    // Filter out items that already exist (unless regenerating)
    const newItems = options?.regenerate
      ? itemsToCreate
      : itemsToCreate.filter((item) => !existingTemplateIds.has(item.template_id || ''));

    const skipped = itemsToCreate.length - newItems.length;

    // Create new items
    const createdIds: string[] = [];

    for (const itemData of newItems) {
      const deviceId = getDeviceId();
      const now = Date.now();

      let entity: ChecklistItem = {
        id: nanoid(),
        ...itemData,
        created_at: now,
        updated_at: now,
        deleted_at: null,
        version_vector: {
          [deviceId]: 1,
        },
      } as ChecklistItem;

      // Apply encryption if service provided
      if (context?.encryptionService) {
        const { encryptionService } = context;
        entity = {
          ...entity,
          title: await encryptionService.encrypt(entity.title),
          description: await encryptionService.encrypt(entity.description),
        };
      }

      // Store in database
      await db.checklistItems.add(entity);
      createdIds.push(entity.id);
    }

    // Get total count
    const totalCount = await db.checklistItems
      .where('user_id')
      .equals(assessmentResults.userId)
      .and((item) => !item.deleted_at)
      .count();

    return {
      success: true,
      data: {
        generated: createdIds.length,
        skipped,
        total: totalCount,
        itemIds: createdIds,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}

/**
 * Get checklist items for a user
 *
 * @param query - Query filters
 * @param context - Encryption context
 * @returns Filtered checklist items
 */
export async function getChecklistItems(
  query: GetChecklistItemsQuery,
  context?: EncryptionContext
): Promise<DatabaseResult<ChecklistItem[]>> {
  try {
    let collection = db.checklistItems.where('user_id').equals(query.user_id);

    // Apply filters
    if (query.phase) {
      collection = collection.and((item) => item.phase === query.phase);
    }

    if (query.category) {
      collection = collection.and((item) => item.category === query.category);
    }

    if (query.completed !== undefined) {
      collection = collection.and((item) => item.completed === query.completed);
    }

    if (query.not_applicable !== undefined) {
      collection = collection.and((item) => item.not_applicable === query.not_applicable);
    }

    if (!query.include_snoozed) {
      collection = collection.and((item) => !isItemSnoozed(item));
    }

    // Always filter out deleted
    collection = collection.and((item) => !item.deleted_at);

    const entities = await collection.toArray();

    // Decrypt if service provided
    let results = entities;
    if (context?.encryptionService) {
      const { encryptionService } = context;
      results = await Promise.all(
        entities.map(async (entity) => ({
          ...entity,
          title: await encryptionService.decrypt(entity.title),
          description: await encryptionService.decrypt(entity.description),
        }))
      );
    }

    return {
      success: true,
      data: results,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}

/**
 * Get a single checklist item by ID
 *
 * @param id - Item ID
 * @param context - Encryption context
 * @returns The checklist item
 */
export async function getChecklistItem(
  id: string,
  context?: EncryptionContext
): Promise<DatabaseResult<ChecklistItem>> {
  try {
    const entity = await db.checklistItems.get(id);

    if (!entity) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Checklist item not found: ${id}`,
        },
      };
    }

    if (entity.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Checklist item has been deleted: ${id}`,
        },
      };
    }

    // Decrypt if service provided
    let result = entity;
    if (context?.encryptionService) {
      const { encryptionService } = context;
      result = {
        ...entity,
        title: await encryptionService.decrypt(entity.title),
        description: await encryptionService.decrypt(entity.description),
      };
    }

    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}

/**
 * Update a checklist item
 *
 * @param id - Item ID
 * @param updates - Fields to update
 * @param context - Encryption context
 * @returns Updated item
 */
export async function updateChecklistItem(
  id: string,
  updates: Partial<Omit<ChecklistItem, 'id' | 'user_id' | 'company_id' | 'created_at' | 'version_vector'>>,
  context?: EncryptionContext
): Promise<DatabaseResult<ChecklistItem>> {
  try {
    const existing = await db.checklistItems.get(id);

    if (!existing) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Checklist item not found: ${id}`,
        },
      };
    }

    if (existing.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Checklist item has been deleted: ${id}`,
        },
      };
    }

    const now = Date.now();

    const updated: ChecklistItem = {
      ...existing,
      ...updates,
      id,
      user_id: existing.user_id,
      company_id: existing.company_id,
      created_at: existing.created_at,
      updated_at: now,
      version_vector: incrementVersionVector(existing.version_vector),
    };

    // Apply encryption if service provided
    if (context?.encryptionService) {
      const { encryptionService } = context;
      if (updates.title) {
        updated.title = await encryptionService.encrypt(updates.title);
      }
      if (updates.description) {
        updated.description = await encryptionService.encrypt(updates.description);
      }
    }

    await db.checklistItems.put(updated);

    // Decrypt for return
    let result = updated;
    if (context?.encryptionService) {
      const { encryptionService } = context;
      result = {
        ...updated,
        title: await encryptionService.decrypt(updated.title),
        description: await encryptionService.decrypt(updated.description),
      };
    }

    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}

/**
 * Mark a checklist item as complete
 * Handles streak tracking for recurring items
 *
 * @param id - Item ID
 * @param context - Encryption context
 * @returns Updated item
 */
export async function markComplete(
  id: string,
  context?: EncryptionContext
): Promise<DatabaseResult<ChecklistItem>> {
  try {
    const existing = await db.checklistItems.get(id);

    if (!existing) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Checklist item not found: ${id}`,
        },
      };
    }

    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    // Calculate streak
    let newStreakCount = 1;
    if (existing.last_completed_at) {
      const timeSinceLastCompletion = now - existing.last_completed_at;

      // Determine expected interval based on category
      let expectedInterval = 0;
      switch (existing.category) {
        case 'DAILY':
          expectedInterval = oneDayMs;
          break;
        case 'WEEKLY':
          expectedInterval = 7 * oneDayMs;
          break;
        case 'MONTHLY':
          expectedInterval = 30 * oneDayMs;
          break;
        case 'QUARTERLY':
          expectedInterval = 90 * oneDayMs;
          break;
        case 'YEARLY':
          expectedInterval = 365 * oneDayMs;
          break;
      }

      // If completed within expected interval (+1 day grace period), continue streak
      if (expectedInterval > 0 && timeSinceLastCompletion <= expectedInterval + oneDayMs) {
        newStreakCount = existing.streak_count + 1;
      }
    }

    const updated: ChecklistItem = {
      ...existing,
      completed: true,
      completed_at: now,
      last_completed_at: now,
      streak_count: newStreakCount,
      updated_at: now,
      version_vector: incrementVersionVector(existing.version_vector),
    };

    await db.checklistItems.put(updated);

    // Decrypt for return
    let result = updated;
    if (context?.encryptionService) {
      const { encryptionService } = context;
      result = {
        ...updated,
        title: await encryptionService.decrypt(updated.title),
        description: await encryptionService.decrypt(updated.description),
      };
    }

    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}

/**
 * Snooze a checklist item until a specified time
 *
 * @param id - Item ID
 * @param until - Unix timestamp to snooze until
 * @param context - Encryption context
 * @returns Updated item
 */
export async function snoozeItem(
  id: string,
  until: number,
  context?: EncryptionContext
): Promise<DatabaseResult<ChecklistItem>> {
  return updateChecklistItem(id, { snoozed_until: until }, context);
}

/**
 * Mark item as not applicable to user's situation
 *
 * @param id - Item ID
 * @param context - Encryption context
 * @returns Updated item
 */
export async function markNotApplicable(
  id: string,
  context?: EncryptionContext
): Promise<DatabaseResult<ChecklistItem>> {
  return updateChecklistItem(id, { not_applicable: true }, context);
}

/**
 * Delete a checklist item (soft delete)
 *
 * @param id - Item ID
 * @returns Success result
 */
export async function deleteChecklistItem(id: string): Promise<DatabaseResult<void>> {
  try {
    const existing = await db.checklistItems.get(id);

    if (!existing) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Checklist item not found: ${id}`,
        },
      };
    }

    if (existing.deleted_at) {
      return { success: true, data: undefined };
    }

    const now = Date.now();

    await db.checklistItems.update(id, {
      deleted_at: now,
      version_vector: incrementVersionVector(existing.version_vector),
      updated_at: now,
    });

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}

/**
 * Get checklist statistics for a user
 *
 * @param userId - User ID
 * @param context - Encryption context
 * @returns Statistics summary
 */
export async function getChecklistStats(
  userId: string,
  context?: EncryptionContext
): Promise<DatabaseResult<ChecklistStats>> {
  try {
    const itemsResult = await getChecklistItems({ user_id: userId }, context);

    if (!itemsResult.success) {
      return itemsResult as DatabaseResult<never>;
    }

    const items = itemsResult.data;
    const total = items.length;
    const completed = items.filter((i) => i.completed).length;
    const notApplicable = items.filter((i) => i.not_applicable).length;
    const snoozed = items.filter((i) => isItemSnoozed(i)).length;
    const pending = items.filter((i) => !i.completed && !i.not_applicable && !isItemSnoozed(i)).length;
    const overdue = items.filter((i) => {
      if (i.completed || i.not_applicable) return false;
      // Simple overdue check - item is recurring and hasn't been completed in expected interval
      return false; // TODO: implement with isItemOverdue from schema
    }).length;

    const maxStreak = items.reduce((max, item) => Math.max(max, item.streak_count), 0);
    const applicableItems = items.filter((i) => !i.not_applicable);
    const completionRate = applicableItems.length > 0
      ? Math.round((completed / applicableItems.length) * 100)
      : 0;

    // Group by category
    const byCategory: ChecklistStats['byCategory'] = {
      SETUP: { total: 0, completed: 0, pending: 0 },
      DAILY: { total: 0, completed: 0, pending: 0 },
      WEEKLY: { total: 0, completed: 0, pending: 0 },
      MONTHLY: { total: 0, completed: 0, pending: 0 },
      QUARTERLY: { total: 0, completed: 0, pending: 0 },
      YEARLY: { total: 0, completed: 0, pending: 0 },
      AS_NEEDED: { total: 0, completed: 0, pending: 0 },
    };

    items.forEach((item) => {
      if (item.not_applicable) return;

      byCategory[item.category].total++;
      if (item.completed) {
        byCategory[item.category].completed++;
      } else {
        byCategory[item.category].pending++;
      }
    });

    return {
      success: true,
      data: {
        total,
        completed,
        pending,
        snoozed,
        notApplicable,
        overdue,
        streakCount: maxStreak,
        completionRate,
        byCategory,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}
