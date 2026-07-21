/**
 * Procedure Service
 *
 * CRUD operations for ProcedureInstance entities.
 * Handles starting, updating, completing, and querying procedure instances.
 *
 * Procedures (SOPs) are templates that can be "started" multiple times,
 * creating instances that track progress independently.
 *
 * @see Roadmaps/ROADMAP_CHECKLIST_CALENDAR.md
 */

import { nanoid } from 'nanoid';
import { db } from '../../../db/database';
import type { DatabaseResult } from '../../../store/types';
import type {
  AdminChecklist,
  AdminTask,
  ProcedureInstance,
  ProcedureTaskCompletion,
  ProcedureInstanceStatus,
} from '../../../db/schema/checklistCalendar.schema';
import {
  createDefaultProcedureInstance,
  validateProcedureInstance,
} from '../../../db/schema/checklistCalendar.schema';
import { getDeviceId } from '../../../utils/device';
import { incrementVersionVector } from '../../../db/crdt';
import { logger } from '../../../utils/logger';
import { markTaskComplete, markTaskIncomplete } from './CompletionService';

const procedureLogger = logger.child('ProcedureService');

// =============================================================================
// TYPES
// =============================================================================

/**
 * Input for starting a new procedure instance
 */
export interface StartProcedureInput {
  checklistId: string; // The procedure template
  companyId: string;
  name: string; // User-provided label (e.g., "John Smith", "Acme Corp")
  userId: string;
  userName: string;
  selectedTaskIds?: string[] | null; // Optional: which tasks to include (null = all tasks)
}

/**
 * Input for updating a procedure instance
 */
export interface UpdateProcedureInstanceInput {
  name?: string;
  status?: ProcedureInstanceStatus;
}

/**
 * Options for querying procedure instances
 */
export interface GetProcedureInstancesOptions {
  status?: ProcedureInstanceStatus | ProcedureInstanceStatus[];
  checklistId?: string; // Filter by template
  sortBy?: 'started_at' | 'updated_at' | 'name';
  sortDirection?: 'asc' | 'desc';
  limit?: number;
}

/**
 * Procedure instance with its template checklist
 */
export interface ProcedureInstanceWithTemplate extends ProcedureInstance {
  checklist: AdminChecklist;
}

/**
 * Procedure instance with template and tasks
 */
export interface ProcedureInstanceWithTasks extends ProcedureInstanceWithTemplate {
  tasks: AdminTask[];
  completions: ProcedureTaskCompletion[];
}

// =============================================================================
// CREATE / START
// =============================================================================

/**
 * Start a new procedure instance
 * Creates an instance of a procedure template that can be worked through
 */
export async function startProcedure(
  input: StartProcedureInput
): Promise<DatabaseResult<ProcedureInstance>> {
  try {
    const deviceId = await getDeviceId();
    const id = nanoid();
    const now = Date.now();

    // Verify the checklist exists and is a procedure
    const checklist = await db.adminChecklists.get(input.checklistId);
    if (!checklist) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Procedure template not found',
        },
      };
    }

    if (checklist.checklist_type !== 'procedure') {
      return {
        success: false,
        error: {
          code: 'INVALID_TYPE',
          message: 'Checklist is not a procedure template',
        },
      };
    }

    // Get the total task count for this procedure
    const allTasks = await db.adminTasks
      .where('checklist_id')
      .equals(input.checklistId)
      .filter((t) => !t.deleted_at && !t.is_archived)
      .toArray();

    // If selectedTaskIds provided, filter to just those; otherwise include all
    const selectedTaskIds = input.selectedTaskIds;
    const taskCount = selectedTaskIds
      ? allTasks.filter((t) => selectedTaskIds.includes(t.id)).length
      : allTasks.length;

    const instance: ProcedureInstance = {
      id,
      checklist_id: input.checklistId,
      company_id: input.companyId,
      name: input.name,
      status: 'in_progress',
      started_at: now,
      started_by: input.userId,
      started_by_name: input.userName,
      completed_at: null,
      completed_by: null,
      selected_task_ids: selectedTaskIds ?? null,
      total_tasks: taskCount,
      completed_tasks: 0,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version_vector: { [deviceId]: 1 },
    };

    // Validate before saving
    const errors = validateProcedureInstance(instance);
    if (errors.length > 0) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: errors.join('; '),
        },
      };
    }

    await db.procedureInstances.add(instance);

    procedureLogger.info('Procedure instance started', {
      id: instance.id,
      checklistId: instance.checklist_id,
      name: instance.name,
      totalTasks: instance.total_tasks,
    });

    return {
      success: true,
      data: instance,
    };
  } catch (error) {
    procedureLogger.error('Failed to start procedure', { error, input });
    return {
      success: false,
      error: {
        code: 'CREATE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to start procedure',
      },
    };
  }
}

// =============================================================================
// READ
// =============================================================================

/**
 * Get a procedure instance by ID
 */
export async function getProcedureInstance(
  id: string
): Promise<DatabaseResult<ProcedureInstance>> {
  try {
    const instance = await db.procedureInstances.get(id);

    if (!instance || instance.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Procedure instance not found',
        },
      };
    }

    return {
      success: true,
      data: instance,
    };
  } catch (error) {
    procedureLogger.error('Failed to get procedure instance', { error, id });
    return {
      success: false,
      error: {
        code: 'FETCH_FAILED',
        message: error instanceof Error ? error.message : 'Failed to get procedure instance',
      },
    };
  }
}

/**
 * Get a procedure instance with its template checklist
 */
export async function getProcedureInstanceWithTemplate(
  id: string
): Promise<DatabaseResult<ProcedureInstanceWithTemplate>> {
  try {
    const instance = await db.procedureInstances.get(id);

    if (!instance || instance.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Procedure instance not found',
        },
      };
    }

    const checklist = await db.adminChecklists.get(instance.checklist_id);
    if (!checklist) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Procedure template not found',
        },
      };
    }

    return {
      success: true,
      data: { ...instance, checklist },
    };
  } catch (error) {
    procedureLogger.error('Failed to get procedure instance with template', { error, id });
    return {
      success: false,
      error: {
        code: 'FETCH_FAILED',
        message: error instanceof Error ? error.message : 'Failed to get procedure instance',
      },
    };
  }
}

/**
 * Get a procedure instance with template, tasks, and completions
 */
export async function getProcedureInstanceWithTasks(
  id: string
): Promise<DatabaseResult<ProcedureInstanceWithTasks>> {
  try {
    const instanceResult = await getProcedureInstanceWithTemplate(id);
    if (!instanceResult.success) {
      return instanceResult as DatabaseResult<ProcedureInstanceWithTasks>;
    }

    // Get tasks for this procedure
    let tasks = await db.adminTasks
      .where('checklist_id')
      .equals(instanceResult.data.checklist_id)
      .filter((t) => !t.deleted_at && !t.is_archived)
      .sortBy('order');

    // Filter by selected_task_ids if present
    const selectedTaskIds = instanceResult.data.selected_task_ids;
    if (selectedTaskIds && selectedTaskIds.length > 0) {
      tasks = tasks.filter((t) => selectedTaskIds.includes(t.id));
    }

    // Get completions for this instance
    const completions = await db.procedureTaskCompletions
      .where('instance_id')
      .equals(id)
      .filter((c) => !c.deleted_at)
      .toArray();

    return {
      success: true,
      data: {
        ...instanceResult.data,
        tasks,
        completions,
      },
    };
  } catch (error) {
    procedureLogger.error('Failed to get procedure instance with tasks', { error, id });
    return {
      success: false,
      error: {
        code: 'FETCH_FAILED',
        message: error instanceof Error ? error.message : 'Failed to get procedure instance',
      },
    };
  }
}

/**
 * Get all procedure instances for a company
 */
export async function getProcedureInstances(
  companyId: string,
  options: GetProcedureInstancesOptions = {}
): Promise<DatabaseResult<ProcedureInstanceWithTemplate[]>> {
  try {
    let collection = db.procedureInstances
      .where('company_id')
      .equals(companyId)
      .filter((i) => !i.deleted_at);

    // Filter by status
    if (options.status) {
      const statuses = Array.isArray(options.status) ? options.status : [options.status];
      collection = collection.filter((i) => statuses.includes(i.status));
    }

    // Filter by checklist (template)
    if (options.checklistId) {
      collection = collection.filter((i) => i.checklist_id === options.checklistId);
    }

    let instances = await collection.toArray();

    // Sort
    const sortBy = options.sortBy ?? 'started_at';
    const sortDir = options.sortDirection ?? 'desc';

    instances.sort((a, b) => {
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
        case 'started_at':
        default:
          aVal = a.started_at;
          bVal = b.started_at;
      }

      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    // Limit
    if (options.limit && options.limit > 0) {
      instances = instances.slice(0, options.limit);
    }

    // Fetch checklists for each instance
    const checklistIds = [...new Set(instances.map((i) => i.checklist_id))];
    const checklists = await db.adminChecklists.bulkGet(checklistIds);
    const checklistMap = new Map(
      checklists.filter((c) => c).map((c) => [c!.id, c!])
    );

    const instancesWithTemplates: ProcedureInstanceWithTemplate[] = instances
      .map((instance) => ({
        ...instance,
        checklist: checklistMap.get(instance.checklist_id)!,
      }))
      .filter((i) => i.checklist); // Filter out any with missing templates

    return {
      success: true,
      data: instancesWithTemplates,
    };
  } catch (error) {
    procedureLogger.error('Failed to get procedure instances', { error, companyId, options });
    return {
      success: false,
      error: {
        code: 'FETCH_FAILED',
        message: error instanceof Error ? error.message : 'Failed to get procedure instances',
      },
    };
  }
}

/**
 * Get all procedure templates (checklists with type 'procedure')
 */
export async function getProcedureTemplates(
  companyId: string
): Promise<DatabaseResult<AdminChecklist[]>> {
  try {
    const templates = await db.adminChecklists
      .where('company_id')
      .equals(companyId)
      .filter((c) => !c.deleted_at && !c.is_archived && c.checklist_type === 'procedure')
      .sortBy('order');

    return {
      success: true,
      data: templates,
    };
  } catch (error) {
    procedureLogger.error('Failed to get procedure templates', { error, companyId });
    return {
      success: false,
      error: {
        code: 'FETCH_FAILED',
        message: error instanceof Error ? error.message : 'Failed to get procedure templates',
      },
    };
  }
}

/**
 * Get tasks for a procedure template (for task selection when starting)
 */
export async function getProcedureTemplateTasks(
  checklistId: string
): Promise<DatabaseResult<AdminTask[]>> {
  try {
    const tasks = await db.adminTasks
      .where('checklist_id')
      .equals(checklistId)
      .filter((t) => !t.deleted_at && !t.is_archived && !t.parent_task_id)
      .sortBy('order');

    return {
      success: true,
      data: tasks,
    };
  } catch (error) {
    procedureLogger.error('Failed to get procedure template tasks', { error, checklistId });
    return {
      success: false,
      error: {
        code: 'FETCH_FAILED',
        message: error instanceof Error ? error.message : 'Failed to get template tasks',
      },
    };
  }
}

// =============================================================================
// UPDATE
// =============================================================================

/**
 * Update a procedure instance
 */
export async function updateProcedureInstance(
  id: string,
  input: UpdateProcedureInstanceInput
): Promise<DatabaseResult<ProcedureInstance>> {
  try {
    const deviceId = await getDeviceId();
    const instance = await db.procedureInstances.get(id);

    if (!instance || instance.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Procedure instance not found',
        },
      };
    }

    const updates: Partial<ProcedureInstance> = {
      updated_at: Date.now(),
      version_vector: incrementVersionVector(instance.version_vector, deviceId),
    };

    if (input.name !== undefined) {
      updates.name = input.name;
    }

    if (input.status !== undefined) {
      updates.status = input.status;
    }

    await db.procedureInstances.update(id, updates);

    const updatedInstance = await db.procedureInstances.get(id);

    procedureLogger.info('Procedure instance updated', { id, updates: Object.keys(input) });

    return {
      success: true,
      data: updatedInstance!,
    };
  } catch (error) {
    procedureLogger.error('Failed to update procedure instance', { error, id, input });
    return {
      success: false,
      error: {
        code: 'UPDATE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to update procedure instance',
      },
    };
  }
}

/**
 * Refresh the total_tasks count for a procedure instance
 * Call this after adding or removing tasks from the procedure's checklist
 */
export async function refreshProcedureTaskCount(
  instanceId: string
): Promise<DatabaseResult<ProcedureInstance>> {
  try {
    const deviceId = await getDeviceId();
    const instance = await db.procedureInstances.get(instanceId);

    if (!instance || instance.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Procedure instance not found',
        },
      };
    }

    // Count active tasks for this procedure's checklist
    let tasks = await db.adminTasks
      .where('checklist_id')
      .equals(instance.checklist_id)
      .filter((t) => !t.deleted_at && !t.is_archived)
      .toArray();

    // Filter by selected_task_ids if present
    const selectedTaskIds = instance.selected_task_ids;
    if (selectedTaskIds && selectedTaskIds.length > 0) {
      tasks = tasks.filter((t) => selectedTaskIds.includes(t.id));
    }

    const now = Date.now();
    await db.procedureInstances.update(instanceId, {
      total_tasks: tasks.length,
      updated_at: now,
      version_vector: incrementVersionVector(instance.version_vector, deviceId),
    });

    const updatedInstance = await db.procedureInstances.get(instanceId);

    procedureLogger.info('Procedure task count refreshed', {
      instanceId,
      totalTasks: tasks.length,
    });

    return {
      success: true,
      data: updatedInstance!,
    };
  } catch (error) {
    procedureLogger.error('Failed to refresh procedure task count', { error, instanceId });
    return {
      success: false,
      error: {
        code: 'UPDATE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to refresh task count',
      },
    };
  }
}

/**
 * Complete a procedure instance
 */
export async function completeProcedureInstance(
  id: string,
  userId: string
): Promise<DatabaseResult<ProcedureInstance>> {
  try {
    const deviceId = await getDeviceId();
    const instance = await db.procedureInstances.get(id);

    if (!instance || instance.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Procedure instance not found',
        },
      };
    }

    if (instance.status === 'completed') {
      return {
        success: false,
        error: {
          code: 'ALREADY_COMPLETED',
          message: 'Procedure instance is already completed',
        },
      };
    }

    const now = Date.now();
    const updates: Partial<ProcedureInstance> = {
      status: 'completed',
      completed_at: now,
      completed_by: userId,
      updated_at: now,
      version_vector: incrementVersionVector(instance.version_vector, deviceId),
    };

    await db.procedureInstances.update(id, updates);

    const updatedInstance = await db.procedureInstances.get(id);

    procedureLogger.info('Procedure instance completed', { id, userId });

    return {
      success: true,
      data: updatedInstance!,
    };
  } catch (error) {
    procedureLogger.error('Failed to complete procedure instance', { error, id, userId });
    return {
      success: false,
      error: {
        code: 'UPDATE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to complete procedure instance',
      },
    };
  }
}

/**
 * Cancel a procedure instance
 */
export async function cancelProcedureInstance(
  id: string,
  userId: string
): Promise<DatabaseResult<ProcedureInstance>> {
  try {
    const deviceId = await getDeviceId();
    const instance = await db.procedureInstances.get(id);

    if (!instance || instance.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Procedure instance not found',
        },
      };
    }

    if (instance.status !== 'in_progress') {
      return {
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: 'Only in-progress procedures can be cancelled',
        },
      };
    }

    const now = Date.now();
    const updates: Partial<ProcedureInstance> = {
      status: 'cancelled',
      completed_at: now,
      completed_by: userId,
      updated_at: now,
      version_vector: incrementVersionVector(instance.version_vector, deviceId),
    };

    await db.procedureInstances.update(id, updates);

    const updatedInstance = await db.procedureInstances.get(id);

    procedureLogger.info('Procedure instance cancelled', { id, userId });

    return {
      success: true,
      data: updatedInstance!,
    };
  } catch (error) {
    procedureLogger.error('Failed to cancel procedure instance', { error, id, userId });
    return {
      success: false,
      error: {
        code: 'UPDATE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to cancel procedure instance',
      },
    };
  }
}

// =============================================================================
// TASK COMPLETION
// =============================================================================

/**
 * Complete a task within a procedure instance
 */
export async function completeProcedureTask(
  instanceId: string,
  taskId: string,
  userId: string,
  userName: string,
  notes?: string | null
): Promise<DatabaseResult<ProcedureTaskCompletion>> {
  try {
    const deviceId = await getDeviceId();
    const id = nanoid();
    const now = Date.now();

    // Verify instance exists and is in progress
    const instance = await db.procedureInstances.get(instanceId);
    if (!instance || instance.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Procedure instance not found',
        },
      };
    }

    if (instance.status !== 'in_progress') {
      return {
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: 'Cannot complete tasks on a finished procedure',
        },
      };
    }

    // Check if task is already completed in this instance
    const existingCompletion = await db.procedureTaskCompletions
      .where('[instance_id+task_id]')
      .equals([instanceId, taskId])
      .filter((c) => !c.deleted_at)
      .first();

    if (existingCompletion) {
      return {
        success: false,
        error: {
          code: 'ALREADY_COMPLETED',
          message: 'Task is already completed in this procedure instance',
        },
      };
    }

    const completion: ProcedureTaskCompletion = {
      id,
      instance_id: instanceId,
      task_id: taskId,
      company_id: instance.company_id,
      completed_at: now,
      completed_by: userId,
      completed_by_name: userName,
      notes: notes ?? null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version_vector: { [deviceId]: 1 },
    };

    await db.procedureTaskCompletions.add(completion);

    // Update instance progress
    const newCompletedTasks = instance.completed_tasks + 1;
    await db.procedureInstances.update(instanceId, {
      completed_tasks: newCompletedTasks,
      updated_at: now,
      version_vector: incrementVersionVector(instance.version_vector, deviceId),
    });

    // Sync to calendar if task has a scheduled date
    const task = await db.adminTasks.get(taskId);
    if (task?.scheduled_date) {
      const scheduledDate = new Date(task.scheduled_date);
      await markTaskComplete({
        taskId,
        companyId: instance.company_id,
        userId,
        userName,
        date: scheduledDate,
        notes,
      });
      procedureLogger.info('Synced procedure task completion to calendar', {
        taskId,
        scheduledDate: scheduledDate.toISOString(),
      });
    }

    procedureLogger.info('Procedure task completed', {
      instanceId,
      taskId,
      completedTasks: newCompletedTasks,
      totalTasks: instance.total_tasks,
    });

    return {
      success: true,
      data: completion,
    };
  } catch (error) {
    procedureLogger.error('Failed to complete procedure task', { error, instanceId, taskId });
    return {
      success: false,
      error: {
        code: 'CREATE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to complete task',
      },
    };
  }
}

/**
 * Uncomplete a task within a procedure instance
 */
export async function uncompleteProcedureTask(
  instanceId: string,
  taskId: string
): Promise<DatabaseResult<void>> {
  try {
    const deviceId = await getDeviceId();
    const now = Date.now();

    // Verify instance exists and is in progress
    const instance = await db.procedureInstances.get(instanceId);
    if (!instance || instance.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Procedure instance not found',
        },
      };
    }

    if (instance.status !== 'in_progress') {
      return {
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: 'Cannot modify tasks on a finished procedure',
        },
      };
    }

    // Find and delete the completion
    const completion = await db.procedureTaskCompletions
      .where('[instance_id+task_id]')
      .equals([instanceId, taskId])
      .filter((c) => !c.deleted_at)
      .first();

    if (!completion) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Task completion not found',
        },
      };
    }

    // Soft delete the completion
    await db.procedureTaskCompletions.update(completion.id, {
      deleted_at: now,
      updated_at: now,
    });

    // Update instance progress
    const newCompletedTasks = Math.max(0, instance.completed_tasks - 1);
    await db.procedureInstances.update(instanceId, {
      completed_tasks: newCompletedTasks,
      updated_at: now,
      version_vector: incrementVersionVector(instance.version_vector, deviceId),
    });

    // Sync to calendar if task has a scheduled date
    const task = await db.adminTasks.get(taskId);
    if (task?.scheduled_date) {
      const scheduledDate = new Date(task.scheduled_date);
      await markTaskIncomplete(taskId, scheduledDate);
      procedureLogger.info('Synced procedure task uncompletion to calendar', {
        taskId,
        scheduledDate: scheduledDate.toISOString(),
      });
    }

    procedureLogger.info('Procedure task uncompleted', {
      instanceId,
      taskId,
      completedTasks: newCompletedTasks,
    });

    return {
      success: true,
      data: undefined,
    };
  } catch (error) {
    procedureLogger.error('Failed to uncomplete procedure task', { error, instanceId, taskId });
    return {
      success: false,
      error: {
        code: 'DELETE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to uncomplete task',
      },
    };
  }
}

/**
 * Update notes on a task completion
 */
export async function updateProcedureTaskNotes(
  instanceId: string,
  taskId: string,
  notes: string | null
): Promise<DatabaseResult<ProcedureTaskCompletion>> {
  try {
    const deviceId = await getDeviceId();
    const now = Date.now();

    const completion = await db.procedureTaskCompletions
      .where('[instance_id+task_id]')
      .equals([instanceId, taskId])
      .filter((c) => !c.deleted_at)
      .first();

    if (!completion) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Task completion not found',
        },
      };
    }

    await db.procedureTaskCompletions.update(completion.id, {
      notes,
      updated_at: now,
      version_vector: incrementVersionVector(completion.version_vector, deviceId),
    });

    const updatedCompletion = await db.procedureTaskCompletions.get(completion.id);

    return {
      success: true,
      data: updatedCompletion!,
    };
  } catch (error) {
    procedureLogger.error('Failed to update procedure task notes', { error, instanceId, taskId });
    return {
      success: false,
      error: {
        code: 'UPDATE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to update notes',
      },
    };
  }
}

// =============================================================================
// DELETE
// =============================================================================

/**
 * Delete a procedure instance (soft delete)
 */
export async function deleteProcedureInstance(
  id: string
): Promise<DatabaseResult<void>> {
  try {
    const now = Date.now();
    const instance = await db.procedureInstances.get(id);

    if (!instance || instance.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Procedure instance not found',
        },
      };
    }

    // Soft delete the instance
    await db.procedureInstances.update(id, {
      deleted_at: now,
      updated_at: now,
    });

    // Soft delete all task completions for this instance
    const completions = await db.procedureTaskCompletions
      .where('instance_id')
      .equals(id)
      .filter((c) => !c.deleted_at)
      .toArray();

    for (const completion of completions) {
      await db.procedureTaskCompletions.update(completion.id, {
        deleted_at: now,
        updated_at: now,
      });
    }

    procedureLogger.info('Procedure instance deleted', { id });

    return {
      success: true,
      data: undefined,
    };
  } catch (error) {
    procedureLogger.error('Failed to delete procedure instance', { error, id });
    return {
      success: false,
      error: {
        code: 'DELETE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to delete procedure instance',
      },
    };
  }
}
