/**
 * Checklist Service
 *
 * CRUD operations for AdminChecklist entities.
 * Handles creation, updates, archival, and queries for checklists.
 *
 * Requirements:
 * - CK-B1: ChecklistService
 *
 * @see Roadmaps/ROADMAP_CHECKLIST_CALENDAR.md
 */

import { nanoid } from 'nanoid';
import { db } from '../../../db/database';
import type { DatabaseResult } from '../../../store/types';
import type {
  AdminChecklist,
  ChecklistRecurrenceType,
} from '../../../db/schema/checklistCalendar.schema';
import {
  createDefaultAdminChecklist,
  validateAdminChecklist,
  CHECKLIST_COLORS,
} from '../../../db/schema/checklistCalendar.schema';
import { getDeviceId } from '../../../utils/device';
import { incrementVersionVector } from '../../../db/crdt';
import { logger } from '../../../utils/logger';

const checklistLogger = logger.child('ChecklistService');

// =============================================================================
// TYPES
// =============================================================================

/**
 * Input for creating a new checklist
 */
export interface CreateChecklistInput {
  companyId: string;
  name: string;
  description?: string | null;
  color?: string;
  icon?: string | null;
  recurrenceType: ChecklistRecurrenceType;

  // Weekly options
  weeklyDays?: number[] | null;

  // Monthly options
  monthlyDay?: number | null;
  monthlyWeek?: number | null;
  monthlyDayOfWeek?: number | null;

  // Quarterly options
  quarterlyMonth?: number | null;
  quarterlyDay?: number | null;
  recurrenceMonths?: number[] | null; // Flexible month selection for quarterly

  // Annual options
  annualMonth?: number | null;
  annualDay?: number | null;

  // Custom interval options
  customIntervalValue?: number | null;
  customIntervalUnit?: 'days' | 'weeks' | 'months' | null;
  customStartDate?: Date | null;

  // Source tracking
  isTemplate?: boolean;
  isFromAssessment?: boolean;
  assessmentId?: string | null;
  templateId?: string | null;

  // Weekend and effective date settings
  excludeWeekends?: boolean;
  effectiveFrom?: Date | null; // Checklist only shows from this date forward
}

/**
 * Input for updating a checklist
 */
export interface UpdateChecklistInput {
  name?: string;
  description?: string | null;
  color?: string;
  icon?: string | null;
  recurrenceType?: ChecklistRecurrenceType;
  weeklyDays?: number[] | null;
  monthlyDay?: number | null;
  monthlyWeek?: number | null;
  monthlyDayOfWeek?: number | null;
  quarterlyMonth?: number | null;
  quarterlyDay?: number | null;
  recurrenceMonths?: number[] | null; // Flexible month selection for quarterly
  annualMonth?: number | null;
  annualDay?: number | null;
  customIntervalValue?: number | null;
  customIntervalUnit?: 'days' | 'weeks' | 'months' | null;
  customStartDate?: Date | null;
  order?: number;
  excludeWeekends?: boolean;
  effectiveFrom?: Date | null; // For schedule changes, when they take effect
}

/**
 * Options for querying checklists
 */
export interface GetChecklistsOptions {
  includeArchived?: boolean;
  sortBy?: 'order' | 'name' | 'updated_at';
  sortDirection?: 'asc' | 'desc';
}

// =============================================================================
// CREATE
// =============================================================================

/**
 * Create a new checklist
 */
export async function createChecklist(
  input: CreateChecklistInput
): Promise<DatabaseResult<AdminChecklist>> {
  try {
    const deviceId = await getDeviceId();
    const id = nanoid();
    const now = Date.now();

    // Get the next order value
    const existingChecklists = await db.adminChecklists
      .where('company_id')
      .equals(input.companyId)
      .filter((c) => !c.deleted_at)
      .toArray();
    const maxOrder = existingChecklists.reduce(
      (max, c) => Math.max(max, c.order),
      -1
    );

    const checklist: AdminChecklist = {
      id,
      company_id: input.companyId,
      name: input.name,
      description: input.description ?? null,
      color: input.color ?? CHECKLIST_COLORS[0].value,
      icon: input.icon ?? null,
      recurrence_type: input.recurrenceType,
      weekly_days: input.weeklyDays ?? null,
      monthly_day: input.monthlyDay ?? null,
      monthly_week: input.monthlyWeek ?? null,
      monthly_day_of_week: input.monthlyDayOfWeek ?? null,
      quarterly_month: input.quarterlyMonth ?? null,
      quarterly_day: input.quarterlyDay ?? null,
      recurrence_months: input.recurrenceMonths ?? null,
      annual_month: input.annualMonth ?? null,
      annual_day: input.annualDay ?? null,
      custom_interval_value: input.customIntervalValue ?? null,
      custom_interval_unit: input.customIntervalUnit ?? null,
      custom_start_date: input.customStartDate?.getTime() ?? null,
      is_template: input.isTemplate ?? false,
      is_from_assessment: input.isFromAssessment ?? false,
      assessment_id: input.assessmentId ?? null,
      template_id: input.templateId ?? null,
      is_archived: false,
      order: maxOrder + 1,
      exclude_weekends: input.excludeWeekends ?? false,
      effective_from: input.effectiveFrom?.getTime() ?? now, // Default to now (today forward)
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version_vector: { [deviceId]: 1 },
    };

    // Validate before saving
    const errors = validateAdminChecklist(checklist);
    if (errors.length > 0) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: errors.join('; '),
        },
      };
    }

    await db.adminChecklists.add(checklist);

    checklistLogger.info('Checklist created', {
      id: checklist.id,
      name: checklist.name,
      recurrenceType: checklist.recurrence_type,
    });

    return {
      success: true,
      data: checklist,
    };
  } catch (error) {
    checklistLogger.error('Failed to create checklist', { error, input });
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

// =============================================================================
// READ
// =============================================================================

/**
 * Get a single checklist by ID
 */
export async function getChecklist(
  id: string
): Promise<DatabaseResult<AdminChecklist>> {
  try {
    const checklist = await db.adminChecklists.get(id);

    if (!checklist || checklist.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Checklist not found: ${id}`,
        },
      };
    }

    return {
      success: true,
      data: checklist,
    };
  } catch (error) {
    checklistLogger.error('Failed to get checklist', { error, id });
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

/**
 * Get all checklists for a company
 */
export async function getChecklists(
  companyId: string,
  options: GetChecklistsOptions = {}
): Promise<DatabaseResult<AdminChecklist[]>> {
  try {
    const { includeArchived = false, sortBy = 'order', sortDirection = 'asc' } =
      options;

    let collection = db.adminChecklists
      .where('company_id')
      .equals(companyId)
      .filter((c) => !c.deleted_at);

    if (!includeArchived) {
      collection = collection.filter((c) => !c.is_archived);
    }

    let checklists = await collection.toArray();

    // Sort
    checklists.sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      switch (sortBy) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'updated_at':
          aVal = a.updated_at;
          bVal = b.updated_at;
          break;
        case 'order':
        default:
          aVal = a.order;
          bVal = b.order;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return {
      success: true,
      data: checklists,
    };
  } catch (error) {
    checklistLogger.error('Failed to get checklists', { error, companyId });
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

/**
 * Get checklists by recurrence type
 */
export async function getChecklistsByRecurrenceType(
  companyId: string,
  recurrenceType: ChecklistRecurrenceType
): Promise<DatabaseResult<AdminChecklist[]>> {
  try {
    const checklists = await db.adminChecklists
      .where('company_id')
      .equals(companyId)
      .filter(
        (c) =>
          !c.deleted_at && !c.is_archived && c.recurrence_type === recurrenceType
      )
      .sortBy('order');

    return {
      success: true,
      data: checklists,
    };
  } catch (error) {
    checklistLogger.error('Failed to get checklists by recurrence type', {
      error,
      companyId,
      recurrenceType,
    });
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

// =============================================================================
// UPDATE
// =============================================================================

/**
 * Update a checklist
 */
export async function updateChecklist(
  id: string,
  input: UpdateChecklistInput
): Promise<DatabaseResult<AdminChecklist>> {
  try {
    const existing = await db.adminChecklists.get(id);

    if (!existing || existing.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Checklist not found: ${id}`,
        },
      };
    }

    const deviceId = await getDeviceId();
    const now = Date.now();

    const updated: AdminChecklist = {
      ...existing,
      name: input.name ?? existing.name,
      description:
        input.description !== undefined
          ? input.description
          : existing.description,
      color: input.color ?? existing.color,
      icon: input.icon !== undefined ? input.icon : existing.icon,
      recurrence_type: input.recurrenceType ?? existing.recurrence_type,
      weekly_days:
        input.weeklyDays !== undefined
          ? input.weeklyDays
          : existing.weekly_days,
      monthly_day:
        input.monthlyDay !== undefined
          ? input.monthlyDay
          : existing.monthly_day,
      monthly_week:
        input.monthlyWeek !== undefined
          ? input.monthlyWeek
          : existing.monthly_week,
      monthly_day_of_week:
        input.monthlyDayOfWeek !== undefined
          ? input.monthlyDayOfWeek
          : existing.monthly_day_of_week,
      quarterly_month:
        input.quarterlyMonth !== undefined
          ? input.quarterlyMonth
          : existing.quarterly_month,
      quarterly_day:
        input.quarterlyDay !== undefined
          ? input.quarterlyDay
          : existing.quarterly_day,
      recurrence_months:
        input.recurrenceMonths !== undefined
          ? input.recurrenceMonths
          : existing.recurrence_months,
      annual_month:
        input.annualMonth !== undefined
          ? input.annualMonth
          : existing.annual_month,
      annual_day:
        input.annualDay !== undefined ? input.annualDay : existing.annual_day,
      custom_interval_value:
        input.customIntervalValue !== undefined
          ? input.customIntervalValue
          : existing.custom_interval_value,
      custom_interval_unit:
        input.customIntervalUnit !== undefined
          ? input.customIntervalUnit
          : existing.custom_interval_unit,
      custom_start_date:
        input.customStartDate !== undefined
          ? input.customStartDate?.getTime() ?? null
          : existing.custom_start_date,
      order: input.order ?? existing.order,
      exclude_weekends:
        input.excludeWeekends !== undefined
          ? input.excludeWeekends
          : existing.exclude_weekends,
      effective_from:
        input.effectiveFrom !== undefined
          ? input.effectiveFrom?.getTime() ?? null
          : existing.effective_from,
      updated_at: now,
      version_vector: incrementVersionVector(existing.version_vector, deviceId),
    };

    // Validate before saving
    const errors = validateAdminChecklist(updated);
    if (errors.length > 0) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: errors.join('; '),
        },
      };
    }

    await db.adminChecklists.put(updated);

    checklistLogger.info('Checklist updated', { id: updated.id });

    return {
      success: true,
      data: updated,
    };
  } catch (error) {
    checklistLogger.error('Failed to update checklist', { error, id, input });
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

/**
 * Reorder checklists
 */
export async function reorderChecklists(
  companyId: string,
  orderedIds: string[]
): Promise<DatabaseResult<void>> {
  try {
    const deviceId = await getDeviceId();
    const now = Date.now();

    await db.transaction('rw', db.adminChecklists, async () => {
      for (let i = 0; i < orderedIds.length; i++) {
        const id = orderedIds[i];
        const checklist = await db.adminChecklists.get(id);

        if (checklist && checklist.company_id === companyId) {
          await db.adminChecklists.update(id, {
            order: i,
            updated_at: now,
            version_vector: incrementVersionVector(
              checklist.version_vector,
              deviceId
            ),
          });
        }
      }
    });

    checklistLogger.info('Checklists reordered', { companyId, count: orderedIds.length });

    return { success: true, data: undefined };
  } catch (error) {
    checklistLogger.error('Failed to reorder checklists', {
      error,
      companyId,
      orderedIds,
    });
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

// =============================================================================
// ARCHIVE / DELETE
// =============================================================================

/**
 * Archive a checklist (soft delete from view, keeps data)
 */
export async function archiveChecklist(
  id: string
): Promise<DatabaseResult<AdminChecklist>> {
  try {
    const existing = await db.adminChecklists.get(id);

    if (!existing || existing.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Checklist not found: ${id}`,
        },
      };
    }

    const deviceId = await getDeviceId();
    const now = Date.now();

    const updated: AdminChecklist = {
      ...existing,
      is_archived: true,
      updated_at: now,
      version_vector: incrementVersionVector(existing.version_vector, deviceId),
    };

    await db.adminChecklists.put(updated);

    checklistLogger.info('Checklist archived', { id: updated.id });

    return {
      success: true,
      data: updated,
    };
  } catch (error) {
    checklistLogger.error('Failed to archive checklist', { error, id });
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

/**
 * Unarchive a checklist
 */
export async function unarchiveChecklist(
  id: string
): Promise<DatabaseResult<AdminChecklist>> {
  try {
    const existing = await db.adminChecklists.get(id);

    if (!existing || existing.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Checklist not found: ${id}`,
        },
      };
    }

    const deviceId = await getDeviceId();
    const now = Date.now();

    const updated: AdminChecklist = {
      ...existing,
      is_archived: false,
      updated_at: now,
      version_vector: incrementVersionVector(existing.version_vector, deviceId),
    };

    await db.adminChecklists.put(updated);

    checklistLogger.info('Checklist unarchived', { id: updated.id });

    return {
      success: true,
      data: updated,
    };
  } catch (error) {
    checklistLogger.error('Failed to unarchive checklist', { error, id });
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

/**
 * Permanently delete a checklist (soft delete with deleted_at)
 * Also deletes all associated tasks and completions
 */
export async function deleteChecklist(
  id: string
): Promise<DatabaseResult<void>> {
  try {
    const existing = await db.adminChecklists.get(id);

    if (!existing) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Checklist not found: ${id}`,
        },
      };
    }

    const deviceId = await getDeviceId();
    const now = Date.now();

    await db.transaction(
      'rw',
      [db.adminChecklists, db.adminTasks, db.adminTaskCompletions, db.adminTaskComments],
      async () => {
        // Get all tasks for this checklist
        const tasks = await db.adminTasks
          .where('checklist_id')
          .equals(id)
          .toArray();

        const taskIds = tasks.map((t) => t.id);

        // Soft delete all completions for these tasks
        for (const taskId of taskIds) {
          const completions = await db.adminTaskCompletions
            .where('task_id')
            .equals(taskId)
            .toArray();

          for (const completion of completions) {
            await db.adminTaskCompletions.update(completion.id, {
              deleted_at: now,
              updated_at: now,
            });
          }

          // Soft delete all comments for these tasks
          const comments = await db.adminTaskComments
            .where('task_id')
            .equals(taskId)
            .toArray();

          for (const comment of comments) {
            await db.adminTaskComments.update(comment.id, {
              deleted_at: now,
              updated_at: now,
            });
          }
        }

        // Soft delete all tasks
        for (const task of tasks) {
          await db.adminTasks.update(task.id, {
            deleted_at: now,
            updated_at: now,
            version_vector: incrementVersionVector(
              task.version_vector,
              deviceId
            ),
          });
        }

        // Soft delete the checklist
        await db.adminChecklists.update(id, {
          deleted_at: now,
          updated_at: now,
          version_vector: incrementVersionVector(
            existing.version_vector,
            deviceId
          ),
        });
      }
    );

    checklistLogger.info('Checklist deleted', { id });

    return { success: true, data: undefined };
  } catch (error) {
    checklistLogger.error('Failed to delete checklist', { error, id });
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

// =============================================================================
// DUPLICATE / TEMPLATE
// =============================================================================

/**
 * Duplicate a checklist (including all its tasks)
 */
export async function duplicateChecklist(
  id: string,
  newName?: string
): Promise<DatabaseResult<AdminChecklist>> {
  try {
    const source = await db.adminChecklists.get(id);

    if (!source || source.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Checklist not found: ${id}`,
        },
      };
    }

    const deviceId = await getDeviceId();
    const newId = nanoid();
    const now = Date.now();

    // Get the next order value
    const existingChecklists = await db.adminChecklists
      .where('company_id')
      .equals(source.company_id)
      .filter((c) => !c.deleted_at)
      .toArray();
    const maxOrder = existingChecklists.reduce(
      (max, c) => Math.max(max, c.order),
      -1
    );

    const newChecklist: AdminChecklist = {
      ...source,
      id: newId,
      name: newName ?? `${source.name} (Copy)`,
      is_template: false,
      template_id: source.is_template ? source.id : source.template_id,
      order: maxOrder + 1,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version_vector: { [deviceId]: 1 },
    };

    await db.transaction('rw', [db.adminChecklists, db.adminTasks], async () => {
      // Create the new checklist
      await db.adminChecklists.add(newChecklist);

      // Get all tasks from source checklist
      const sourceTasks = await db.adminTasks
        .where('checklist_id')
        .equals(id)
        .filter((t) => !t.deleted_at && !t.parent_task_id)
        .sortBy('order');

      // Map old task IDs to new task IDs for parent relationships
      const taskIdMap = new Map<string, string>();

      // Create top-level tasks first
      for (const task of sourceTasks) {
        const newTaskId = nanoid();
        taskIdMap.set(task.id, newTaskId);

        await db.adminTasks.add({
          ...task,
          id: newTaskId,
          checklist_id: newId,
          parent_task_id: null,
          created_at: now,
          updated_at: now,
          deleted_at: null,
          version_vector: { [deviceId]: 1 },
        });
      }

      // Create sub-tasks
      const subTasks = await db.adminTasks
        .where('checklist_id')
        .equals(id)
        .filter((t) => !t.deleted_at && t.parent_task_id !== null)
        .sortBy('order');

      for (const task of subTasks) {
        const newTaskId = nanoid();
        const newParentId = taskIdMap.get(task.parent_task_id!);

        if (newParentId) {
          await db.adminTasks.add({
            ...task,
            id: newTaskId,
            checklist_id: newId,
            parent_task_id: newParentId,
            created_at: now,
            updated_at: now,
            deleted_at: null,
            version_vector: { [deviceId]: 1 },
          });
        }
      }
    });

    checklistLogger.info('Checklist duplicated', {
      sourceId: id,
      newId: newChecklist.id,
    });

    return {
      success: true,
      data: newChecklist,
    };
  } catch (error) {
    checklistLogger.error('Failed to duplicate checklist', { error, id });
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

/**
 * Create a checklist from a template
 */
export async function createFromTemplate(
  templateId: string,
  companyId: string,
  name?: string
): Promise<DatabaseResult<AdminChecklist>> {
  try {
    const template = await db.adminChecklists.get(templateId);

    if (!template || template.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Template not found: ${templateId}`,
        },
      };
    }

    if (!template.is_template) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Source checklist is not a template',
        },
      };
    }

    // Use duplicate with modified company_id
    const deviceId = await getDeviceId();
    const newId = nanoid();
    const now = Date.now();

    // Get the next order value
    const existingChecklists = await db.adminChecklists
      .where('company_id')
      .equals(companyId)
      .filter((c) => !c.deleted_at)
      .toArray();
    const maxOrder = existingChecklists.reduce(
      (max, c) => Math.max(max, c.order),
      -1
    );

    const newChecklist: AdminChecklist = {
      ...template,
      id: newId,
      company_id: companyId,
      name: name ?? template.name,
      is_template: false,
      template_id: templateId,
      order: maxOrder + 1,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version_vector: { [deviceId]: 1 },
    };

    await db.transaction('rw', [db.adminChecklists, db.adminTasks], async () => {
      await db.adminChecklists.add(newChecklist);

      // Copy tasks (similar to duplicate but for different company)
      const sourceTasks = await db.adminTasks
        .where('checklist_id')
        .equals(templateId)
        .filter((t) => !t.deleted_at && !t.parent_task_id)
        .sortBy('order');

      const taskIdMap = new Map<string, string>();

      for (const task of sourceTasks) {
        const newTaskId = nanoid();
        taskIdMap.set(task.id, newTaskId);

        await db.adminTasks.add({
          ...task,
          id: newTaskId,
          checklist_id: newId,
          company_id: companyId,
          parent_task_id: null,
          created_at: now,
          updated_at: now,
          deleted_at: null,
          version_vector: { [deviceId]: 1 },
        });
      }

      const subTasks = await db.adminTasks
        .where('checklist_id')
        .equals(templateId)
        .filter((t) => !t.deleted_at && t.parent_task_id !== null)
        .sortBy('order');

      for (const task of subTasks) {
        const newTaskId = nanoid();
        const newParentId = taskIdMap.get(task.parent_task_id!);

        if (newParentId) {
          await db.adminTasks.add({
            ...task,
            id: newTaskId,
            checklist_id: newId,
            company_id: companyId,
            parent_task_id: newParentId,
            created_at: now,
            updated_at: now,
            deleted_at: null,
            version_vector: { [deviceId]: 1 },
          });
        }
      }
    });

    checklistLogger.info('Checklist created from template', {
      templateId,
      newId: newChecklist.id,
      companyId,
    });

    return {
      success: true,
      data: newChecklist,
    };
  } catch (error) {
    checklistLogger.error('Failed to create from template', {
      error,
      templateId,
      companyId,
    });
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}
