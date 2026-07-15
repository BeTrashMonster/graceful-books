/**
 * Comment Service
 *
 * CRUD operations for AdminTaskComment entities.
 * Handles creating, updating, and querying comments on tasks.
 *
 * Requirements:
 * - CK-B4: CommentService
 *
 * @see Roadmaps/ROADMAP_CHECKLIST_CALENDAR.md
 */

import { nanoid } from 'nanoid';
import { db } from '../../../db/database';
import type { DatabaseResult } from '../../../store/types';
import type { AdminTaskComment } from '../../../db/schema/checklistCalendar.schema';
import { logger } from '../../../utils/logger';

const commentLogger = logger.child('CommentService');

// =============================================================================
// TYPES
// =============================================================================

/**
 * Input for creating a comment
 */
export interface CreateCommentInput {
  taskId: string;
  authorId: string;
  authorName: string;
  authorInitials: string;
  content: string;
  contentFormat?: 'html' | 'markdown';
}

/**
 * Input for updating a comment
 */
export interface UpdateCommentInput {
  content: string;
  contentFormat?: 'html' | 'markdown';
}

/**
 * Comment with author info
 */
export interface CommentWithMeta extends AdminTaskComment {
  isOwn: boolean; // True if the comment was written by the current user
  canEdit: boolean; // True if the current user can edit this comment
}

// =============================================================================
// CREATE
// =============================================================================

/**
 * Create a new comment on a task
 */
export async function createComment(
  input: CreateCommentInput
): Promise<DatabaseResult<AdminTaskComment>> {
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

    const id = nanoid();
    const now = Date.now();

    const comment: AdminTaskComment = {
      id,
      task_id: input.taskId,
      author_id: input.authorId,
      author_name: input.authorName,
      author_initials: input.authorInitials,
      content: input.content,
      content_format: input.contentFormat ?? 'html',
      is_edited: false,
      edited_at: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };

    await db.adminTaskComments.add(comment);

    commentLogger.info('Comment created', {
      id: comment.id,
      taskId: comment.task_id,
      authorId: comment.author_id,
    });

    return {
      success: true,
      data: comment,
    };
  } catch (error) {
    commentLogger.error('Failed to create comment', { error, input });
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
 * Get a single comment by ID
 */
export async function getComment(
  id: string
): Promise<DatabaseResult<AdminTaskComment>> {
  try {
    const comment = await db.adminTaskComments.get(id);

    if (!comment || comment.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Comment not found: ${id}`,
        },
      };
    }

    return {
      success: true,
      data: comment,
    };
  } catch (error) {
    commentLogger.error('Failed to get comment', { error, id });
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
 * Get all comments for a task
 */
export async function getCommentsForTask(
  taskId: string,
  currentUserId?: string
): Promise<DatabaseResult<CommentWithMeta[]>> {
  try {
    const comments = await db.adminTaskComments
      .where('task_id')
      .equals(taskId)
      .filter((c) => !c.deleted_at)
      .sortBy('created_at');

    const commentsWithMeta: CommentWithMeta[] = comments.map((comment) => ({
      ...comment,
      isOwn: currentUserId ? comment.author_id === currentUserId : false,
      canEdit: currentUserId ? comment.author_id === currentUserId : false,
    }));

    return {
      success: true,
      data: commentsWithMeta,
    };
  } catch (error) {
    commentLogger.error('Failed to get comments for task', { error, taskId });
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
 * Get comment count for a task
 */
export async function getCommentCount(
  taskId: string
): Promise<DatabaseResult<number>> {
  try {
    const count = await db.adminTaskComments
      .where('task_id')
      .equals(taskId)
      .filter((c) => !c.deleted_at)
      .count();

    return {
      success: true,
      data: count,
    };
  } catch (error) {
    commentLogger.error('Failed to get comment count', { error, taskId });
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
 * Get recent comments across all tasks for a company
 */
export async function getRecentComments(
  companyId: string,
  limit = 20
): Promise<DatabaseResult<AdminTaskComment[]>> {
  try {
    // Get all tasks for the company
    const tasks = await db.adminTasks
      .where('company_id')
      .equals(companyId)
      .filter((t) => !t.deleted_at)
      .toArray();

    const taskIds = new Set(tasks.map((t) => t.id));

    // Get comments for those tasks
    const allComments = await db.adminTaskComments
      .filter((c) => !c.deleted_at && taskIds.has(c.task_id))
      .sortBy('created_at');

    // Sort by created_at descending and limit
    const recentComments = allComments
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, limit);

    return {
      success: true,
      data: recentComments,
    };
  } catch (error) {
    commentLogger.error('Failed to get recent comments', { error, companyId });
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
 * Get comments by a specific user
 */
export async function getCommentsByUser(
  authorId: string,
  limit = 50
): Promise<DatabaseResult<AdminTaskComment[]>> {
  try {
    const comments = await db.adminTaskComments
      .where('author_id')
      .equals(authorId)
      .filter((c) => !c.deleted_at)
      .reverse()
      .limit(limit)
      .sortBy('created_at');

    // Sort by created_at descending
    comments.sort((a, b) => b.created_at - a.created_at);

    return {
      success: true,
      data: comments,
    };
  } catch (error) {
    commentLogger.error('Failed to get comments by user', { error, authorId });
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
 * Update a comment
 */
export async function updateComment(
  id: string,
  input: UpdateCommentInput,
  userId: string
): Promise<DatabaseResult<AdminTaskComment>> {
  try {
    const existing = await db.adminTaskComments.get(id);

    if (!existing || existing.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Comment not found: ${id}`,
        },
      };
    }

    // Only the author can edit their own comments
    if (existing.author_id !== userId) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'You can only edit your own comments',
        },
      };
    }

    const now = Date.now();

    const updated: AdminTaskComment = {
      ...existing,
      content: input.content,
      content_format: input.contentFormat ?? existing.content_format,
      is_edited: true,
      edited_at: now,
      updated_at: now,
    };

    await db.adminTaskComments.put(updated);

    commentLogger.info('Comment updated', { id: updated.id });

    return {
      success: true,
      data: updated,
    };
  } catch (error) {
    commentLogger.error('Failed to update comment', { error, id, input });
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
// DELETE
// =============================================================================

/**
 * Delete a comment (soft delete)
 */
export async function deleteComment(
  id: string,
  userId: string
): Promise<DatabaseResult<void>> {
  try {
    const existing = await db.adminTaskComments.get(id);

    if (!existing || existing.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Comment not found: ${id}`,
        },
      };
    }

    // Only the author can delete their own comments
    if (existing.author_id !== userId) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'You can only delete your own comments',
        },
      };
    }

    const now = Date.now();

    await db.adminTaskComments.update(id, {
      deleted_at: now,
      updated_at: now,
    });

    commentLogger.info('Comment deleted', { id });

    return { success: true, data: undefined };
  } catch (error) {
    commentLogger.error('Failed to delete comment', { error, id });
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
 * Admin delete - allows deleting any comment (for moderation)
 */
export async function adminDeleteComment(
  id: string
): Promise<DatabaseResult<void>> {
  try {
    const existing = await db.adminTaskComments.get(id);

    if (!existing || existing.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Comment not found: ${id}`,
        },
      };
    }

    const now = Date.now();

    await db.adminTaskComments.update(id, {
      deleted_at: now,
      updated_at: now,
    });

    commentLogger.info('Comment admin deleted', { id });

    return { success: true, data: undefined };
  } catch (error) {
    commentLogger.error('Failed to admin delete comment', { error, id });
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
// BULK OPERATIONS
// =============================================================================

/**
 * Get comment counts for multiple tasks
 */
export async function getCommentCountsForTasks(
  taskIds: string[]
): Promise<DatabaseResult<Map<string, number>>> {
  try {
    const countMap = new Map<string, number>();

    // Initialize all to 0
    for (const taskId of taskIds) {
      countMap.set(taskId, 0);
    }

    // Get all comments for these tasks
    const comments = await db.adminTaskComments
      .filter((c) => !c.deleted_at && taskIds.includes(c.task_id))
      .toArray();

    // Count comments per task
    for (const comment of comments) {
      const current = countMap.get(comment.task_id) ?? 0;
      countMap.set(comment.task_id, current + 1);
    }

    return {
      success: true,
      data: countMap,
    };
  } catch (error) {
    commentLogger.error('Failed to get comment counts', { error, taskIds });
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}
