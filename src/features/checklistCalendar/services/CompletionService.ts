/**
 * Completion Service
 *
 * Handles task completion tracking, marking tasks complete/incomplete,
 * and querying completion history.
 *
 * Requirements:
 * - CK-B3: CompletionService
 *
 * @see Roadmaps/ROADMAP_CHECKLIST_CALENDAR.md
 */

import { nanoid } from 'nanoid';
import { db } from '../../../db/database';
import type { DatabaseResult } from '../../../store/types';
import type { AdminTaskCompletion } from '../../../db/schema/checklistCalendar.schema';
import { getDeviceId } from '../../../utils/device';
import { logger } from '../../../utils/logger';
import {
  getPeriodValue,
  getPeriodTypeForRecurrence,
} from '../utils/recurrence';

const completionLogger = logger.child('CompletionService');

// =============================================================================
// PROCEDURE SYNC HELPERS (to avoid circular imports)
// =============================================================================

/**
 * Sync completion to procedure instance if applicable
 * This is defined here to avoid circular imports with ProcedureService
 */
async function syncToProcedureInstance(
  taskId: string,
  companyId: string,
  userId: string,
  userName: string,
  isComplete: boolean,
  notes?: string | null
): Promise<void> {
  try {
    // Get the task to find its checklist
    const task = await db.adminTasks.get(taskId);
    if (!task) return;

    // Get the checklist to check if it's a procedure
    const checklist = await db.adminChecklists.get(task.checklist_id);
    if (!checklist || checklist.checklist_type !== 'procedure') return;

    // Find active procedure instances for this checklist
    const activeInstances = await db.procedureInstances
      .where('checklist_id')
      .equals(checklist.id)
      .filter((i) => !i.deleted_at && i.status === 'in_progress')
      .toArray();

    // Only sync if there's exactly one active instance (to avoid ambiguity)
    if (activeInstances.length !== 1) {
      if (activeInstances.length > 1) {
        completionLogger.info('Multiple active procedure instances found, skipping sync', {
          taskId,
          checklistId: checklist.id,
          instanceCount: activeInstances.length,
        });
      }
      return;
    }

    const instance = activeInstances[0]!;
    const { getDeviceId } = await import('../../../utils/device');
    const { incrementVersionVector } = await import('../../../db/crdt');
    const deviceId = await getDeviceId();
    const now = Date.now();

    const instanceId = instance.id;
    const instanceCompletedTasks = instance.completed_tasks;
    const instanceVersionVector = instance.version_vector;

    if (isComplete) {
      // Check if task is already completed in this instance
      const existingCompletion = await db.procedureTaskCompletions
        .where('[instance_id+task_id]')
        .equals([instanceId, taskId])
        .filter((c) => !c.deleted_at)
        .first();

      if (!existingCompletion) {
        // Create procedure task completion
        const { nanoid } = await import('nanoid');
        const completion = {
          id: nanoid(),
          instance_id: instanceId,
          task_id: taskId,
          company_id: companyId,
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
        await db.procedureInstances.update(instanceId, {
          completed_tasks: instanceCompletedTasks + 1,
          updated_at: now,
          version_vector: incrementVersionVector(instanceVersionVector, deviceId),
        });

        completionLogger.info('Synced calendar completion to procedure', {
          taskId,
          instanceId,
        });
      }
    } else {
      // Find and delete the procedure completion
      const completion = await db.procedureTaskCompletions
        .where('[instance_id+task_id]')
        .equals([instanceId, taskId])
        .filter((c) => !c.deleted_at)
        .first();

      if (completion) {
        await db.procedureTaskCompletions.update(completion.id, {
          deleted_at: now,
          updated_at: now,
        });

        // Update instance progress
        await db.procedureInstances.update(instanceId, {
          completed_tasks: Math.max(0, instanceCompletedTasks - 1),
          updated_at: now,
          version_vector: incrementVersionVector(instanceVersionVector, deviceId),
        });

        completionLogger.info('Synced calendar uncompletion to procedure', {
          taskId,
          instanceId,
        });
      }
    }
  } catch (error) {
    completionLogger.error('Failed to sync to procedure instance', { error, taskId });
    // Don't throw - this is a secondary operation
  }
}

// =============================================================================
// TYPES
// =============================================================================

/**
 * Input for marking a task complete
 */
export interface MarkCompleteInput {
  taskId: string;
  companyId: string;
  userId: string;
  userName: string;
  date: Date;
  notes?: string | null;
}

/**
 * Completion status for a task
 */
export interface TaskCompletionStatus {
  taskId: string;
  isComplete: boolean;
  completedAt?: number;
  completedBy?: string;
  completedByName?: string;
  notes?: string | null;
}

/**
 * Completion statistics for a checklist
 */
export interface ChecklistCompletionStats {
  checklistId: string;
  totalTasks: number;
  completedTasks: number;
  percentComplete: number;
  lastCompletedAt?: number;
}

// =============================================================================
// MARK COMPLETE / INCOMPLETE
// =============================================================================

/**
 * Mark a task as complete for a specific date/period
 */
export async function markTaskComplete(
  input: MarkCompleteInput
): Promise<DatabaseResult<AdminTaskCompletion>> {
  try {
    // Verify task exists
    const task = await db.adminTasks.get(input.taskId);
    if (!task || task.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Task not found: ${input.taskId}`,
        },
      };
    }

    // Get the checklist to determine period type
    const checklist = await db.adminChecklists.get(task.checklist_id);
    if (!checklist || checklist.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Checklist not found: ${task.checklist_id}`,
        },
      };
    }

    const periodType = getPeriodTypeForRecurrence(checklist.recurrence_type);
    const periodValue = getPeriodValue(input.date, periodType);

    // Check if already completed for this period
    const existing = await db.adminTaskCompletions
      .where('[task_id+period_type+period_value]')
      .equals([input.taskId, periodType, periodValue])
      .filter((c) => !c.deleted_at)
      .first();

    if (existing) {
      // Already completed, return the existing completion
      return {
        success: true,
        data: existing,
      };
    }

    const deviceId = await getDeviceId();
    const id = nanoid();
    const now = Date.now();

    const completion: AdminTaskCompletion = {
      id,
      task_id: input.taskId,
      company_id: input.companyId,
      period_type: periodType,
      period_value: periodValue,
      completed_at: now,
      completed_by: input.userId,
      completed_by_name: input.userName,
      notes: input.notes ?? null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };

    await db.adminTaskCompletions.add(completion);

    completionLogger.info('Task marked complete', {
      taskId: input.taskId,
      periodType,
      periodValue,
      userId: input.userId,
    });

    return {
      success: true,
      data: completion,
    };
  } catch (error) {
    completionLogger.error('Failed to mark task complete', { error, input });
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
 * Mark a task as incomplete for a specific date/period (removes completion)
 */
export async function markTaskIncomplete(
  taskId: string,
  date: Date
): Promise<DatabaseResult<void>> {
  try {
    // Verify task exists
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

    // Get the checklist to determine period type
    const checklist = await db.adminChecklists.get(task.checklist_id);
    if (!checklist || checklist.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Checklist not found: ${task.checklist_id}`,
        },
      };
    }

    const periodType = getPeriodTypeForRecurrence(checklist.recurrence_type);
    const periodValue = getPeriodValue(date, periodType);
    const now = Date.now();

    // Find and soft delete the completion
    const existing = await db.adminTaskCompletions
      .where('[task_id+period_type+period_value]')
      .equals([taskId, periodType, periodValue])
      .filter((c) => !c.deleted_at)
      .first();

    if (existing) {
      await db.adminTaskCompletions.update(existing.id, {
        deleted_at: now,
        updated_at: now,
      });

      completionLogger.info('Task marked incomplete', {
        taskId,
        periodType,
        periodValue,
      });
    }

    return { success: true, data: undefined };
  } catch (error) {
    completionLogger.error('Failed to mark task incomplete', {
      error,
      taskId,
      date,
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
 * Toggle task completion status
 */
export async function toggleTaskCompletion(
  input: MarkCompleteInput
): Promise<DatabaseResult<{ isComplete: boolean; completion?: AdminTaskCompletion }>> {
  try {
    // Verify task exists
    const task = await db.adminTasks.get(input.taskId);
    if (!task || task.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Task not found: ${input.taskId}`,
        },
      };
    }

    // Get the checklist to determine period type
    const checklist = await db.adminChecklists.get(task.checklist_id);
    if (!checklist || checklist.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Checklist not found: ${task.checklist_id}`,
        },
      };
    }

    const periodType = getPeriodTypeForRecurrence(checklist.recurrence_type);
    const periodValue = getPeriodValue(input.date, periodType);

    // Check current completion status
    const existing = await db.adminTaskCompletions
      .where('[task_id+period_type+period_value]')
      .equals([input.taskId, periodType, periodValue])
      .filter((c) => !c.deleted_at)
      .first();

    if (existing) {
      // Currently complete, mark incomplete
      const result = await markTaskIncomplete(input.taskId, input.date);
      if (!result.success) {
        return result as { success: false; error: { code: 'NOT_FOUND' | 'VALIDATION_ERROR' | 'CONSTRAINT_VIOLATION' | 'ENCRYPTION_ERROR' | 'CONFLICT_ERROR' | 'UNBALANCED_TRANSACTION' | 'UNKNOWN_ERROR'; message: string } };
      }

      // Sync to procedure instance if applicable
      await syncToProcedureInstance(
        input.taskId,
        input.companyId,
        input.userId,
        input.userName,
        false
      );

      return {
        success: true,
        data: { isComplete: false },
      };
    } else {
      // Currently incomplete, mark complete
      const result = await markTaskComplete(input);
      if (!result.success) {
        return result as { success: false; error: { code: 'NOT_FOUND' | 'VALIDATION_ERROR' | 'CONSTRAINT_VIOLATION' | 'ENCRYPTION_ERROR' | 'CONFLICT_ERROR' | 'UNBALANCED_TRANSACTION' | 'UNKNOWN_ERROR'; message: string } };
      }

      // Sync to procedure instance if applicable
      await syncToProcedureInstance(
        input.taskId,
        input.companyId,
        input.userId,
        input.userName,
        true,
        input.notes
      );

      return {
        success: true,
        data: { isComplete: true, completion: result.data },
      };
    }
  } catch (error) {
    completionLogger.error('Failed to toggle task completion', { error, input });
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
// COMPLETION QUERIES
// =============================================================================

/**
 * Check if a task is complete for a specific date
 */
export async function isTaskComplete(
  taskId: string,
  date: Date
): Promise<DatabaseResult<TaskCompletionStatus>> {
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

    const checklist = await db.adminChecklists.get(task.checklist_id);
    if (!checklist || checklist.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Checklist not found: ${task.checklist_id}`,
        },
      };
    }

    const periodType = getPeriodTypeForRecurrence(checklist.recurrence_type);
    const periodValue = getPeriodValue(date, periodType);

    const completion = await db.adminTaskCompletions
      .where('[task_id+period_type+period_value]')
      .equals([taskId, periodType, periodValue])
      .filter((c) => !c.deleted_at)
      .first();

    return {
      success: true,
      data: {
        taskId,
        isComplete: !!completion,
        completedAt: completion?.completed_at,
        completedBy: completion?.completed_by,
        completedByName: completion?.completed_by_name,
        notes: completion?.notes,
      },
    };
  } catch (error) {
    completionLogger.error('Failed to check task completion', {
      error,
      taskId,
      date,
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
 * Get completion statuses for multiple tasks on a specific date
 */
export async function getCompletionStatusesForDate(
  taskIds: string[],
  date: Date
): Promise<DatabaseResult<Map<string, TaskCompletionStatus>>> {
  try {
    const statusMap = new Map<string, TaskCompletionStatus>();

    for (const taskId of taskIds) {
      const result = await isTaskComplete(taskId, date);
      if (result.success && result.data) {
        statusMap.set(taskId, result.data);
      } else {
        // Task not found or error - mark as not complete
        statusMap.set(taskId, {
          taskId,
          isComplete: false,
        });
      }
    }

    return {
      success: true,
      data: statusMap,
    };
  } catch (error) {
    completionLogger.error('Failed to get completion statuses', {
      error,
      taskIds,
      date,
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
 * Get completion history for a task
 */
export async function getCompletionHistory(
  taskId: string,
  limit = 50
): Promise<DatabaseResult<AdminTaskCompletion[]>> {
  try {
    const completions = await db.adminTaskCompletions
      .where('task_id')
      .equals(taskId)
      .filter((c) => !c.deleted_at)
      .reverse()
      .limit(limit)
      .sortBy('completed_at');

    // Sort by completed_at descending
    completions.sort((a, b) => b.completed_at - a.completed_at);

    return {
      success: true,
      data: completions,
    };
  } catch (error) {
    completionLogger.error('Failed to get completion history', {
      error,
      taskId,
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
 * Get completions for a date range
 */
export async function getCompletionsInRange(
  companyId: string,
  startDate: Date,
  endDate: Date
): Promise<DatabaseResult<AdminTaskCompletion[]>> {
  try {
    const startTime = startDate.getTime();
    const endTime = endDate.getTime();

    const completions = await db.adminTaskCompletions
      .where('company_id')
      .equals(companyId)
      .filter(
        (c) =>
          !c.deleted_at &&
          c.completed_at >= startTime &&
          c.completed_at <= endTime
      )
      .sortBy('completed_at');

    return {
      success: true,
      data: completions,
    };
  } catch (error) {
    completionLogger.error('Failed to get completions in range', {
      error,
      companyId,
      startDate,
      endDate,
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
 * Get completions by user
 */
export async function getCompletionsByUser(
  companyId: string,
  userId: string,
  limit = 100
): Promise<DatabaseResult<AdminTaskCompletion[]>> {
  try {
    const completions = await db.adminTaskCompletions
      .where('company_id')
      .equals(companyId)
      .filter((c) => !c.deleted_at && c.completed_by === userId)
      .reverse()
      .limit(limit)
      .sortBy('completed_at');

    // Sort by completed_at descending
    completions.sort((a, b) => b.completed_at - a.completed_at);

    return {
      success: true,
      data: completions,
    };
  } catch (error) {
    completionLogger.error('Failed to get completions by user', {
      error,
      companyId,
      userId,
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
// STATISTICS
// =============================================================================

/**
 * Get completion statistics for a checklist on a specific date
 */
export async function getChecklistCompletionStats(
  checklistId: string,
  date: Date
): Promise<DatabaseResult<ChecklistCompletionStats>> {
  try {
    const checklist = await db.adminChecklists.get(checklistId);
    if (!checklist || checklist.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Checklist not found: ${checklistId}`,
        },
      };
    }

    // Get all active tasks for this checklist
    const tasks = await db.adminTasks
      .where('checklist_id')
      .equals(checklistId)
      .filter((t) => !t.deleted_at && !t.is_archived)
      .toArray();

    const taskIds = tasks.map((t) => t.id);
    const totalTasks = taskIds.length;

    if (totalTasks === 0) {
      return {
        success: true,
        data: {
          checklistId,
          totalTasks: 0,
          completedTasks: 0,
          percentComplete: 100, // Empty checklist is "complete"
        },
      };
    }

    // Get completion status for each task
    const periodType = getPeriodTypeForRecurrence(checklist.recurrence_type);
    const periodValue = getPeriodValue(date, periodType);

    const completions = await db.adminTaskCompletions
      .where('[period_type+period_value]')
      .equals([periodType, periodValue])
      .filter((c) => !c.deleted_at && taskIds.includes(c.task_id))
      .toArray();

    const completedTasks = completions.length;
    const percentComplete = Math.round((completedTasks / totalTasks) * 100);

    // Get most recent completion
    let lastCompletedAt: number | undefined;
    if (completions.length > 0) {
      lastCompletedAt = Math.max(...completions.map((c) => c.completed_at));
    }

    return {
      success: true,
      data: {
        checklistId,
        totalTasks,
        completedTasks,
        percentComplete,
        lastCompletedAt,
      },
    };
  } catch (error) {
    completionLogger.error('Failed to get checklist completion stats', {
      error,
      checklistId,
      date,
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
 * Get completion streak for a task
 * Returns the number of consecutive periods the task has been completed
 */
export async function getCompletionStreak(
  taskId: string
): Promise<DatabaseResult<number>> {
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

    const checklist = await db.adminChecklists.get(task.checklist_id);
    if (!checklist || checklist.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Checklist not found: ${task.checklist_id}`,
        },
      };
    }

    // Get all completions for this task, sorted by period
    const completions = await db.adminTaskCompletions
      .where('task_id')
      .equals(taskId)
      .filter((c) => !c.deleted_at)
      .sortBy('period_value');

    if (completions.length === 0) {
      return {
        success: true,
        data: 0,
      };
    }

    // Sort by period value descending (most recent first)
    const sortedCompletions = completions.sort((a, b) =>
      b.period_value.localeCompare(a.period_value)
    );

    // Count consecutive completions from most recent
    // This is a simplified version - a full implementation would need to
    // check if periods are actually consecutive based on recurrence type
    let streak = 1;
    for (let i = 1; i < sortedCompletions.length; i++) {
      // For now, just count completions (proper implementation would check period gaps)
      streak++;
    }

    return {
      success: true,
      data: streak,
    };
  } catch (error) {
    completionLogger.error('Failed to get completion streak', {
      error,
      taskId,
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
 * Add or update notes on a completion
 */
export async function updateCompletionNotes(
  completionId: string,
  notes: string | null
): Promise<DatabaseResult<AdminTaskCompletion>> {
  try {
    const completion = await db.adminTaskCompletions.get(completionId);

    if (!completion || completion.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Completion not found: ${completionId}`,
        },
      };
    }

    const now = Date.now();

    await db.adminTaskCompletions.update(completionId, {
      notes,
      updated_at: now,
    });

    const updated = await db.adminTaskCompletions.get(completionId);

    completionLogger.info('Completion notes updated', { completionId });

    return {
      success: true,
      data: updated!,
    };
  } catch (error) {
    completionLogger.error('Failed to update completion notes', {
      error,
      completionId,
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
