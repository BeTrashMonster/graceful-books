/**
 * Task Service
 *
 * CRUD operations for AdminTask entities.
 * Handles creation, updates, sub-task operations, reordering, and queries.
 *
 * Requirements:
 * - CK-B2: TaskService
 *
 * @see Roadmaps/ROADMAP_CHECKLIST_CALENDAR.md
 */

import { nanoid } from 'nanoid';
import { db } from '../../../db/database';
import type { DatabaseResult } from '../../../store/types';
import type {
  AdminTask,
  TaskPriority,
} from '../../../db/schema/checklistCalendar.schema';
import {
  createDefaultAdminTask,
  validateAdminTask,
} from '../../../db/schema/checklistCalendar.schema';
import { getDeviceId } from '../../../utils/device';
import { incrementVersionVector } from '../../../db/crdt';
import { logger } from '../../../utils/logger';

const taskLogger = logger.child('TaskService');

// =============================================================================
// TYPES
// =============================================================================

/**
 * Input for creating a new task
 */
export interface CreateTaskInput {
  checklistId: string;
  companyId: string;
  title: string;
  description?: string;
  descriptionFormat?: 'html' | 'markdown';
  priority?: TaskPriority;
  assigneeId?: string | null;
  assigneeName?: string | null;
  featureLink?: string | null;
  featureLinkLabel?: string | null;
  parentTaskId?: string | null;
  scheduledDate?: Date | null;
  userId: string;
  // Task-level recurrence overrides
  daysOfWeek?: number[] | null;
  taskExcludeWeekends?: boolean | null;
}

/**
 * Input for updating a task
 */
export interface UpdateTaskInput {
  title?: string;
  description?: string;
  descriptionFormat?: 'html' | 'markdown';
  priority?: TaskPriority;
  assigneeId?: string | null;
  assigneeName?: string | null;
  featureLink?: string | null;
  featureLinkLabel?: string | null;
  scheduledDate?: Date | null;
  order?: number;
  userId: string;
  // Task-level recurrence overrides
  daysOfWeek?: number[] | null;
  taskExcludeWeekends?: boolean | null;
}

/**
 * Task with its sub-tasks
 */
export interface TaskWithSubTasks extends AdminTask {
  subTasks: AdminTask[];
}

/**
 * Options for querying tasks
 */
export interface GetTasksOptions {
  includeArchived?: boolean;
  includeSubTasks?: boolean;
  sortBy?: 'order' | 'priority' | 'title' | 'updated_at';
  sortDirection?: 'asc' | 'desc';
}

// =============================================================================
// PRIORITY ORDER (for sorting)
// =============================================================================

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
  none: 3,
};

// =============================================================================
// CREATE
// =============================================================================

/**
 * Create a new task
 */
export async function createTask(
  input: CreateTaskInput
): Promise<DatabaseResult<AdminTask>> {
  try {
    // Verify checklist exists
    const checklist = await db.adminChecklists.get(input.checklistId);
    if (!checklist || checklist.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Checklist not found: ${input.checklistId}`,
        },
      };
    }

    // If parent task is specified, verify it exists
    if (input.parentTaskId) {
      const parentTask = await db.adminTasks.get(input.parentTaskId);
      if (!parentTask || parentTask.deleted_at) {
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Parent task not found: ${input.parentTaskId}`,
          },
        };
      }

      // Prevent deep nesting (only one level of sub-tasks)
      if (parentTask.parent_task_id) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Cannot create sub-task of a sub-task (max depth is 1)',
          },
        };
      }
    }

    const deviceId = await getDeviceId();
    const id = nanoid();
    const now = Date.now();

    // Get the next order value within the same parent context
    const existingTasks = await db.adminTasks
      .where('checklist_id')
      .equals(input.checklistId)
      .filter(
        (t) =>
          !t.deleted_at &&
          (input.parentTaskId
            ? t.parent_task_id === input.parentTaskId
            : t.parent_task_id === null)
      )
      .toArray();
    const maxOrder = existingTasks.reduce((max, t) => Math.max(max, t.order), -1);

    const task: AdminTask = {
      id,
      checklist_id: input.checklistId,
      parent_task_id: input.parentTaskId ?? null,
      company_id: input.companyId,
      title: input.title,
      description: input.description ?? '',
      description_format: input.descriptionFormat ?? 'html',
      priority: input.priority ?? 'none',
      assignee_id: input.assigneeId ?? null,
      assignee_name: input.assigneeName ?? null,
      feature_link: input.featureLink ?? null,
      feature_link_label: input.featureLinkLabel ?? null,
      order: maxOrder + 1,
      scheduled_date: input.scheduledDate?.getTime() ?? null,
      days_of_week: input.daysOfWeek ?? null,
      exclude_weekends: input.taskExcludeWeekends ?? null,
      is_archived: false,
      created_by: input.userId,
      updated_by: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version_vector: { [deviceId]: 1 },
    };

    // Validate before saving
    const errors = validateAdminTask(task);
    if (errors.length > 0) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: errors.join('; '),
        },
      };
    }

    await db.adminTasks.add(task);

    taskLogger.info('Task created', {
      id: task.id,
      title: task.title,
      checklistId: task.checklist_id,
      parentTaskId: task.parent_task_id,
    });

    return {
      success: true,
      data: task,
    };
  } catch (error) {
    taskLogger.error('Failed to create task', { error, input });
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
 * Create a sub-task
 */
export async function createSubTask(
  parentTaskId: string,
  input: Omit<CreateTaskInput, 'parentTaskId' | 'checklistId' | 'companyId'>
): Promise<DatabaseResult<AdminTask>> {
  try {
    const parentTask = await db.adminTasks.get(parentTaskId);

    if (!parentTask || parentTask.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Parent task not found: ${parentTaskId}`,
        },
      };
    }

    return createTask({
      ...input,
      checklistId: parentTask.checklist_id,
      companyId: parentTask.company_id,
      parentTaskId,
    });
  } catch (error) {
    taskLogger.error('Failed to create sub-task', { error, parentTaskId, input });
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
 * Get a single task by ID
 */
export async function getTask(
  id: string
): Promise<DatabaseResult<AdminTask>> {
  try {
    const task = await db.adminTasks.get(id);

    if (!task || task.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Task not found: ${id}`,
        },
      };
    }

    return {
      success: true,
      data: task,
    };
  } catch (error) {
    taskLogger.error('Failed to get task', { error, id });
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
 * Get a task with its sub-tasks
 */
export async function getTaskWithSubTasks(
  id: string
): Promise<DatabaseResult<TaskWithSubTasks>> {
  try {
    const task = await db.adminTasks.get(id);

    if (!task || task.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Task not found: ${id}`,
        },
      };
    }

    const subTasks = await db.adminTasks
      .where('parent_task_id')
      .equals(id)
      .filter((t) => !t.deleted_at && !t.is_archived)
      .sortBy('order');

    return {
      success: true,
      data: {
        ...task,
        subTasks,
      },
    };
  } catch (error) {
    taskLogger.error('Failed to get task with sub-tasks', { error, id });
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
 * Get all tasks for a checklist
 */
export async function getTasksForChecklist(
  checklistId: string,
  options: GetTasksOptions = {}
): Promise<DatabaseResult<TaskWithSubTasks[]>> {
  try {
    const {
      includeArchived = false,
      includeSubTasks = true,
      sortBy = 'order',
      sortDirection = 'asc',
    } = options;

    // Get top-level tasks
    let tasks = await db.adminTasks
      .where('checklist_id')
      .equals(checklistId)
      .filter((t) => !t.deleted_at && t.parent_task_id === null)
      .toArray();

    if (!includeArchived) {
      tasks = tasks.filter((t) => !t.is_archived);
    }

    // Sort tasks
    tasks.sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      switch (sortBy) {
        case 'priority':
          aVal = PRIORITY_ORDER[a.priority];
          bVal = PRIORITY_ORDER[b.priority];
          break;
        case 'title':
          aVal = a.title.toLowerCase();
          bVal = b.title.toLowerCase();
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

    // Add sub-tasks if requested
    const result: TaskWithSubTasks[] = [];

    for (const task of tasks) {
      let subTasks: AdminTask[] = [];

      if (includeSubTasks) {
        subTasks = await db.adminTasks
          .where('parent_task_id')
          .equals(task.id)
          .filter(
            (t) =>
              !t.deleted_at && (includeArchived || !t.is_archived)
          )
          .sortBy('order');
      }

      result.push({
        ...task,
        subTasks,
      });
    }

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    taskLogger.error('Failed to get tasks for checklist', {
      error,
      checklistId,
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

/**
 * Get sub-tasks for a task
 */
export async function getSubTasks(
  parentTaskId: string,
  includeArchived = false
): Promise<DatabaseResult<AdminTask[]>> {
  try {
    let subTasks = await db.adminTasks
      .where('parent_task_id')
      .equals(parentTaskId)
      .filter((t) => !t.deleted_at)
      .sortBy('order');

    if (!includeArchived) {
      subTasks = subTasks.filter((t) => !t.is_archived);
    }

    return {
      success: true,
      data: subTasks,
    };
  } catch (error) {
    taskLogger.error('Failed to get sub-tasks', { error, parentTaskId });
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
 * Get tasks assigned to a user
 */
export async function getTasksForAssignee(
  companyId: string,
  assigneeId: string,
  includeArchived = false
): Promise<DatabaseResult<AdminTask[]>> {
  try {
    let tasks = await db.adminTasks
      .where('assignee_id')
      .equals(assigneeId)
      .filter((t) => !t.deleted_at && t.company_id === companyId)
      .toArray();

    if (!includeArchived) {
      tasks = tasks.filter((t) => !t.is_archived);
    }

    // Sort by order
    tasks.sort((a, b) => a.order - b.order);

    return {
      success: true,
      data: tasks,
    };
  } catch (error) {
    taskLogger.error('Failed to get tasks for assignee', {
      error,
      companyId,
      assigneeId,
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

/**
 * Get tasks by priority
 */
export async function getTasksByPriority(
  companyId: string,
  priority: TaskPriority
): Promise<DatabaseResult<AdminTask[]>> {
  try {
    const tasks = await db.adminTasks
      .where('priority')
      .equals(priority)
      .filter((t) => !t.deleted_at && !t.is_archived && t.company_id === companyId)
      .sortBy('order');

    return {
      success: true,
      data: tasks,
    };
  } catch (error) {
    taskLogger.error('Failed to get tasks by priority', {
      error,
      companyId,
      priority,
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
 * Update a task
 */
export async function updateTask(
  id: string,
  input: UpdateTaskInput
): Promise<DatabaseResult<AdminTask>> {
  try {
    const existing = await db.adminTasks.get(id);

    if (!existing || existing.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Task not found: ${id}`,
        },
      };
    }

    const deviceId = await getDeviceId();
    const now = Date.now();

    const updated: AdminTask = {
      ...existing,
      title: input.title ?? existing.title,
      description: input.description ?? existing.description,
      description_format: input.descriptionFormat ?? existing.description_format,
      priority: input.priority ?? existing.priority,
      assignee_id:
        input.assigneeId !== undefined
          ? input.assigneeId
          : existing.assignee_id,
      assignee_name:
        input.assigneeName !== undefined
          ? input.assigneeName
          : existing.assignee_name,
      feature_link:
        input.featureLink !== undefined
          ? input.featureLink
          : existing.feature_link,
      feature_link_label:
        input.featureLinkLabel !== undefined
          ? input.featureLinkLabel
          : existing.feature_link_label,
      scheduled_date:
        input.scheduledDate !== undefined
          ? input.scheduledDate?.getTime() ?? null
          : existing.scheduled_date,
      days_of_week:
        input.daysOfWeek !== undefined
          ? input.daysOfWeek
          : existing.days_of_week,
      exclude_weekends:
        input.taskExcludeWeekends !== undefined
          ? input.taskExcludeWeekends
          : existing.exclude_weekends,
      order: input.order ?? existing.order,
      updated_by: input.userId,
      updated_at: now,
      version_vector: incrementVersionVector(existing.version_vector, deviceId),
    };

    // Validate before saving
    const errors = validateAdminTask(updated);
    if (errors.length > 0) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: errors.join('; '),
        },
      };
    }

    await db.adminTasks.put(updated);

    taskLogger.info('Task updated', { id: updated.id });

    return {
      success: true,
      data: updated,
    };
  } catch (error) {
    taskLogger.error('Failed to update task', { error, id, input });
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
 * Reorder tasks within a checklist or parent
 */
export async function reorderTasks(
  checklistId: string,
  orderedIds: string[],
  parentTaskId: string | null = null
): Promise<DatabaseResult<void>> {
  try {
    const deviceId = await getDeviceId();
    const now = Date.now();

    await db.transaction('rw', db.adminTasks, async () => {
      for (let i = 0; i < orderedIds.length; i++) {
        const id = orderedIds[i];
        const task = await db.adminTasks.get(id);

        if (
          task &&
          task.checklist_id === checklistId &&
          task.parent_task_id === parentTaskId
        ) {
          await db.adminTasks.update(id, {
            order: i,
            updated_at: now,
            version_vector: incrementVersionVector(
              task.version_vector,
              deviceId
            ),
          });
        }
      }
    });

    taskLogger.info('Tasks reordered', {
      checklistId,
      parentTaskId,
      count: orderedIds.length,
    });

    return { success: true, data: undefined };
  } catch (error) {
    taskLogger.error('Failed to reorder tasks', {
      error,
      checklistId,
      parentTaskId,
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

/**
 * Move a task to a different checklist
 */
export async function moveTaskToChecklist(
  taskId: string,
  targetChecklistId: string,
  userId: string
): Promise<DatabaseResult<AdminTask>> {
  try {
    const task = await db.adminTasks.get(taskId);

    if (!task || task.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Task not found: ${taskId}`,
        },
      };
    }

    const targetChecklist = await db.adminChecklists.get(targetChecklistId);

    if (!targetChecklist || targetChecklist.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Target checklist not found: ${targetChecklistId}`,
        },
      };
    }

    // Verify same company
    if (task.company_id !== targetChecklist.company_id) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Cannot move task to checklist in different company',
        },
      };
    }

    const deviceId = await getDeviceId();
    const now = Date.now();

    // Get the next order value in target checklist
    const existingTasks = await db.adminTasks
      .where('checklist_id')
      .equals(targetChecklistId)
      .filter((t) => !t.deleted_at && t.parent_task_id === null)
      .toArray();
    const maxOrder = existingTasks.reduce((max, t) => Math.max(max, t.order), -1);

    await db.transaction('rw', db.adminTasks, async () => {
      // Move the task
      const updated = {
        ...task,
        checklist_id: targetChecklistId,
        parent_task_id: null, // Moving to checklist makes it top-level
        order: maxOrder + 1,
        updated_by: userId,
        updated_at: now,
        version_vector: incrementVersionVector(task.version_vector, deviceId),
      };

      await db.adminTasks.put(updated);

      // Also move all sub-tasks
      const subTasks = await db.adminTasks
        .where('parent_task_id')
        .equals(taskId)
        .toArray();

      for (const subTask of subTasks) {
        await db.adminTasks.update(subTask.id, {
          checklist_id: targetChecklistId,
          updated_at: now,
          version_vector: incrementVersionVector(
            subTask.version_vector,
            deviceId
          ),
        });
      }
    });

    const movedTask = await db.adminTasks.get(taskId);

    taskLogger.info('Task moved to checklist', {
      taskId,
      targetChecklistId,
    });

    return {
      success: true,
      data: movedTask!,
    };
  } catch (error) {
    taskLogger.error('Failed to move task to checklist', {
      error,
      taskId,
      targetChecklistId,
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

/**
 * Convert a task to a sub-task
 */
export async function convertToSubTask(
  taskId: string,
  newParentId: string,
  userId: string
): Promise<DatabaseResult<AdminTask>> {
  try {
    const task = await db.adminTasks.get(taskId);

    if (!task || task.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Task not found: ${taskId}`,
        },
      };
    }

    const parentTask = await db.adminTasks.get(newParentId);

    if (!parentTask || parentTask.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Parent task not found: ${newParentId}`,
        },
      };
    }

    // Validate same checklist
    if (task.checklist_id !== parentTask.checklist_id) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Task and parent must be in the same checklist',
        },
      };
    }

    // Prevent deep nesting
    if (parentTask.parent_task_id) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Cannot create sub-task of a sub-task (max depth is 1)',
        },
      };
    }

    // Prevent circular reference
    if (task.id === newParentId) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Task cannot be its own parent',
        },
      };
    }

    const deviceId = await getDeviceId();
    const now = Date.now();

    // Get the next order value in parent
    const existingSubTasks = await db.adminTasks
      .where('parent_task_id')
      .equals(newParentId)
      .filter((t) => !t.deleted_at)
      .toArray();
    const maxOrder = existingSubTasks.reduce(
      (max, t) => Math.max(max, t.order),
      -1
    );

    const updated: AdminTask = {
      ...task,
      parent_task_id: newParentId,
      order: maxOrder + 1,
      updated_by: userId,
      updated_at: now,
      version_vector: incrementVersionVector(task.version_vector, deviceId),
    };

    await db.adminTasks.put(updated);

    taskLogger.info('Task converted to sub-task', {
      taskId,
      newParentId,
    });

    return {
      success: true,
      data: updated,
    };
  } catch (error) {
    taskLogger.error('Failed to convert to sub-task', {
      error,
      taskId,
      newParentId,
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

/**
 * Promote a sub-task to a top-level task
 */
export async function promoteToTopLevel(
  taskId: string,
  userId: string
): Promise<DatabaseResult<AdminTask>> {
  try {
    const task = await db.adminTasks.get(taskId);

    if (!task || task.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Task not found: ${taskId}`,
        },
      };
    }

    if (!task.parent_task_id) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Task is already a top-level task',
        },
      };
    }

    const deviceId = await getDeviceId();
    const now = Date.now();

    // Get the next order value at top level
    const existingTasks = await db.adminTasks
      .where('checklist_id')
      .equals(task.checklist_id)
      .filter((t) => !t.deleted_at && t.parent_task_id === null)
      .toArray();
    const maxOrder = existingTasks.reduce((max, t) => Math.max(max, t.order), -1);

    const updated: AdminTask = {
      ...task,
      parent_task_id: null,
      order: maxOrder + 1,
      updated_by: userId,
      updated_at: now,
      version_vector: incrementVersionVector(task.version_vector, deviceId),
    };

    await db.adminTasks.put(updated);

    taskLogger.info('Sub-task promoted to top-level', { taskId });

    return {
      success: true,
      data: updated,
    };
  } catch (error) {
    taskLogger.error('Failed to promote to top-level', { error, taskId });
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
 * Archive a task (soft delete from view, keeps data)
 */
export async function archiveTask(
  id: string,
  userId: string
): Promise<DatabaseResult<AdminTask>> {
  try {
    const existing = await db.adminTasks.get(id);

    if (!existing || existing.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Task not found: ${id}`,
        },
      };
    }

    const deviceId = await getDeviceId();
    const now = Date.now();

    await db.transaction('rw', db.adminTasks, async () => {
      // Archive the task
      await db.adminTasks.update(id, {
        is_archived: true,
        updated_by: userId,
        updated_at: now,
        version_vector: incrementVersionVector(
          existing.version_vector,
          deviceId
        ),
      });

      // Also archive all sub-tasks
      const subTasks = await db.adminTasks
        .where('parent_task_id')
        .equals(id)
        .toArray();

      for (const subTask of subTasks) {
        await db.adminTasks.update(subTask.id, {
          is_archived: true,
          updated_at: now,
          version_vector: incrementVersionVector(
            subTask.version_vector,
            deviceId
          ),
        });
      }
    });

    const updated = await db.adminTasks.get(id);

    taskLogger.info('Task archived', { id });

    return {
      success: true,
      data: updated!,
    };
  } catch (error) {
    taskLogger.error('Failed to archive task', { error, id });
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
 * Unarchive a task
 */
export async function unarchiveTask(
  id: string,
  userId: string
): Promise<DatabaseResult<AdminTask>> {
  try {
    const existing = await db.adminTasks.get(id);

    if (!existing || existing.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Task not found: ${id}`,
        },
      };
    }

    const deviceId = await getDeviceId();
    const now = Date.now();

    await db.transaction('rw', db.adminTasks, async () => {
      // Unarchive the task
      await db.adminTasks.update(id, {
        is_archived: false,
        updated_by: userId,
        updated_at: now,
        version_vector: incrementVersionVector(
          existing.version_vector,
          deviceId
        ),
      });

      // Also unarchive all sub-tasks
      const subTasks = await db.adminTasks
        .where('parent_task_id')
        .equals(id)
        .toArray();

      for (const subTask of subTasks) {
        await db.adminTasks.update(subTask.id, {
          is_archived: false,
          updated_at: now,
          version_vector: incrementVersionVector(
            subTask.version_vector,
            deviceId
          ),
        });
      }
    });

    const updated = await db.adminTasks.get(id);

    taskLogger.info('Task unarchived', { id });

    return {
      success: true,
      data: updated!,
    };
  } catch (error) {
    taskLogger.error('Failed to unarchive task', { error, id });
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
 * Permanently delete a task (soft delete with deleted_at)
 */
export async function deleteTask(id: string): Promise<DatabaseResult<void>> {
  try {
    const existing = await db.adminTasks.get(id);

    if (!existing) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Task not found: ${id}`,
        },
      };
    }

    const deviceId = await getDeviceId();
    const now = Date.now();

    await db.transaction(
      'rw',
      [db.adminTasks, db.adminTaskCompletions, db.adminTaskComments],
      async () => {
        // Soft delete all sub-tasks
        const subTasks = await db.adminTasks
          .where('parent_task_id')
          .equals(id)
          .toArray();

        for (const subTask of subTasks) {
          // Delete completions for sub-task
          const completions = await db.adminTaskCompletions
            .where('task_id')
            .equals(subTask.id)
            .toArray();

          for (const completion of completions) {
            await db.adminTaskCompletions.update(completion.id, {
              deleted_at: now,
              updated_at: now,
            });
          }

          // Delete comments for sub-task
          const comments = await db.adminTaskComments
            .where('task_id')
            .equals(subTask.id)
            .toArray();

          for (const comment of comments) {
            await db.adminTaskComments.update(comment.id, {
              deleted_at: now,
              updated_at: now,
            });
          }

          await db.adminTasks.update(subTask.id, {
            deleted_at: now,
            updated_at: now,
            version_vector: incrementVersionVector(
              subTask.version_vector,
              deviceId
            ),
          });
        }

        // Delete completions for this task
        const completions = await db.adminTaskCompletions
          .where('task_id')
          .equals(id)
          .toArray();

        for (const completion of completions) {
          await db.adminTaskCompletions.update(completion.id, {
            deleted_at: now,
            updated_at: now,
          });
        }

        // Delete comments for this task
        const comments = await db.adminTaskComments
          .where('task_id')
          .equals(id)
          .toArray();

        for (const comment of comments) {
          await db.adminTaskComments.update(comment.id, {
            deleted_at: now,
            updated_at: now,
          });
        }

        // Soft delete the task
        await db.adminTasks.update(id, {
          deleted_at: now,
          updated_at: now,
          version_vector: incrementVersionVector(
            existing.version_vector,
            deviceId
          ),
        });
      }
    );

    taskLogger.info('Task deleted', { id });

    return { success: true, data: undefined };
  } catch (error) {
    taskLogger.error('Failed to delete task', { error, id });
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}
