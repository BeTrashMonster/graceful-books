/**
 * Comments Service
 *
 * Handles CRUD operations for threaded comments on transactions, invoices, bills,
 * and checklist items. Integrates with mentions and notifications services.
 *
 * Requirements:
 * - I2: Activity Feed & Communication
 * - Create, read, update, delete comments
 * - Support threaded conversations (parent/child comments)
 * - Integrate with @mentions
 * - Respect role-based permissions
 * - ARCH-002: Zero-Knowledge Encryption
 * - ARCH-004: CRDT conflict resolution
 */

import { nanoid } from 'nanoid';
import { db } from '../db/database';
import {
  createDefaultComment,
  validateComment,
  canEditComment,
  canDeleteComment,
  isCommentDeleted,
  CommentStatus,
} from '../db/schema/comments.schema';
import type {
  Comment,
  CommentableType,
  GetCommentsQuery,
} from '../db/schema/comments.schema';
import { createMentionsService } from './mentions.service';
import type { CreateMentionsOptions, CreateMentionsResult } from './mentions.service';
import { logger } from '../utils/logger';

const serviceLogger = logger.child('CommentsService');

/**
 * Options for creating a comment
 */
export interface CreateCommentOptions {
  parentCommentId?: string | null; // For threaded replies
  mentionOptions?: CreateMentionsOptions; // Options for @mentions
  metadata?: Record<string, unknown>; // Additional metadata
}

/**
 * Result of creating a comment
 */
export interface CreateCommentResult {
  comment: Comment;
  mentionsResult?: CreateMentionsResult;
}

/**
 * Options for updating a comment
 */
export interface UpdateCommentOptions {
  content?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Comment with nested replies
 */
export interface CommentThread {
  comment: Comment;
  replies: CommentThread[];
  replyCount: number;
  depth: number;
}

/**
 * Comments Service Class
 */
export class CommentsService {
  private companyId: string;
  private userId: string;
  private deviceId: string;

  constructor(companyId: string, userId: string, deviceId: string) {
    this.companyId = companyId;
    this.userId = userId;
    this.deviceId = deviceId;
  }

  /**
   * Create a new comment
   */
  async createComment(
    commentableType: CommentableType,
    commentableId: string,
    content: string,
    options: CreateCommentOptions = {}
  ): Promise<CreateCommentResult> {
    try {
      // Validate permissions
      await this.checkPermissions(commentableType, commentableId, 'create');

      // Create comment record
      const commentId = nanoid();
      const comment = createDefaultComment(
        this.companyId,
        commentableType,
        commentableId,
        this.userId,
        content,
        this.deviceId,
        options.parentCommentId || null
      );

      // Add metadata if provided
      if (options.metadata) {
        comment.metadata = options.metadata;
      }

      // Validate comment
      const errors = validateComment(comment);
      if (errors.length > 0) {
        throw new Error(`Invalid comment: ${errors.join(', ')}`);
      }

      // If this is a reply, validate parent exists
      if (options.parentCommentId) {
        const parentComment = await db.comments.get(options.parentCommentId);
        if (!parentComment) {
          throw new Error('Parent comment not found');
        }
        if (parentComment.company_id !== this.companyId) {
          throw new Error('Parent comment does not belong to this company');
        }
        if (isCommentDeleted(parentComment)) {
          throw new Error('Cannot reply to deleted comment');
        }
      }

      // Save comment
      await db.comments.add({
        ...comment,
        id: commentId,
      } as Comment);

      const savedComment = (await db.comments.get(commentId))!;

      serviceLogger.info('Created comment', {
        commentId,
        commentableType,
        commentableId,
        authorUserId: this.userId,
        parentCommentId: options.parentCommentId,
      });

      // Process @mentions if present
      let mentionsResult: CreateMentionsResult | undefined;
      const mentionsService = createMentionsService(this.companyId, this.deviceId);
      const mentionOptions = options.mentionOptions || {};

      mentionsResult = await mentionsService.createMentions(
        commentId,
        content,
        this.userId,
        commentableType,
        commentableId,
        mentionOptions
      );

      // Update comment with mentioned user IDs
      if (mentionsResult.mentions.length > 0) {
        const mentionedUserIds = mentionsResult.mentions.map((m) => m.mentioned_user_id);
        await db.comments.update(commentId, {
          mentioned_user_ids: mentionedUserIds,
          updated_at: Date.now(),
        });

        savedComment.mentioned_user_ids = mentionedUserIds;
      }

      return {
        comment: savedComment,
        mentionsResult,
      };
    } catch (error) {
      serviceLogger.error('Failed to create comment', { error });
      throw error;
    }
  }

  /**
   * Get comments for an entity
   */
  async getComments(query: GetCommentsQuery): Promise<Comment[]> {
    try {
      // Validate permissions
      await this.checkPermissions(query.commentable_type, query.commentable_id, 'read');

      let dbQuery = db.comments
        .where('[commentable_type+commentable_id]')
        .equals([query.commentable_type, query.commentable_id])
        .and((comment) => comment.company_id === this.companyId);

      // Filter by parent comment ID if specified
      if (query.parent_comment_id !== undefined) {
        dbQuery = dbQuery.and((comment) => comment.parent_comment_id === query.parent_comment_id);
      }

      // Filter deleted comments unless explicitly requested
      if (!query.include_deleted) {
        dbQuery = dbQuery.and((comment) => comment.status !== CommentStatus.DELETED && comment.deleted_at === null);
      }

      const comments = await dbQuery.sortBy('created_at');

      return comments;
    } catch (error) {
      serviceLogger.error('Failed to get comments', { error, query });
      throw error;
    }
  }

  /**
   * Get a single comment by ID
   */
  async getComment(commentId: string): Promise<Comment | null> {
    try {
      const comment = await db.comments.get(commentId);

      if (!comment) {
        return null;
      }

      if (comment.company_id !== this.companyId) {
        throw new Error('Comment does not belong to this company');
      }

      // Check permissions
      await this.checkPermissions(comment.commentable_type, comment.commentable_id, 'read');

      return comment;
    } catch (error) {
      serviceLogger.error('Failed to get comment', { error, commentId });
      throw error;
    }
  }

  /**
   * Build threaded comment tree
   * Organizes comments into parent-child hierarchy
   */
  async buildCommentThread(
    commentableType: CommentableType,
    commentableId: string,
    maxDepth: number = 5
  ): Promise<CommentThread[]> {
    try {
      // Get all comments for this entity
      const allComments = await this.getComments({
        company_id: this.companyId,
        commentable_type: commentableType,
        commentable_id: commentableId,
        include_deleted: false,
      });

      // Build comment map for quick lookup
      const commentMap = new Map<string, Comment>();
      allComments.forEach((comment) => commentMap.set(comment.id, comment));

      // Build thread structure
      const buildThread = (comment: Comment, depth: number): CommentThread => {
        // Get direct replies to this comment
        const replies = allComments
          .filter((c) => c.parent_comment_id === comment.id)
          .sort((a, b) => a.created_at - b.created_at);

        // Recursively build reply threads (up to maxDepth)
        const replyThreads =
          depth < maxDepth
            ? replies.map((reply) => buildThread(reply, depth + 1))
            : [];

        // Count total replies (including nested)
        const replyCount = replies.length + replyThreads.reduce((sum, thread) => sum + thread.replyCount, 0);

        return {
          comment,
          replies: replyThreads,
          replyCount,
          depth,
        };
      };

      // Get top-level comments (no parent)
      const topLevelComments = allComments
        .filter((c) => c.parent_comment_id === null)
        .sort((a, b) => a.created_at - b.created_at);

      // Build threads for each top-level comment
      const threads = topLevelComments.map((comment) => buildThread(comment, 0));

      serviceLogger.debug('Built comment thread', {
        commentableType,
        commentableId,
        totalComments: allComments.length,
        topLevelComments: topLevelComments.length,
        threads: threads.length,
      });

      return threads;
    } catch (error) {
      serviceLogger.error('Failed to build comment thread', { error });
      throw error;
    }
  }

  /**
   * Update a comment
   * Only author can edit within 15 minute window
   */
  async updateComment(
    commentId: string,
    updates: UpdateCommentOptions
  ): Promise<Comment> {
    try {
      const comment = await db.comments.get(commentId);

      if (!comment) {
        throw new Error('Comment not found');
      }

      if (comment.company_id !== this.companyId) {
        throw new Error('Comment does not belong to this company');
      }

      // Check edit permissions
      if (!canEditComment(comment, this.userId)) {
        throw new Error('Cannot edit this comment (must be author and within 15 minute window)');
      }

      // Check entity permissions
      await this.checkPermissions(comment.commentable_type, comment.commentable_id, 'update');

      const now = Date.now();
      const updateData: Partial<Comment> = {
        updated_at: now,
        edited_at: now,
        status: CommentStatus.EDITED,
        version_vector: {
          ...comment.version_vector,
          [this.deviceId]: (comment.version_vector[this.deviceId] || 0) + 1,
        },
      };

      // Update content if provided
      if (updates.content !== undefined) {
        updateData.content = updates.content;

        // Validate updated content
        const errors = validateComment({ ...comment, ...updateData });
        if (errors.length > 0) {
          throw new Error(`Invalid comment update: ${errors.join(', ')}`);
        }

        // Reprocess mentions if content changed
        const mentionsService = createMentionsService(this.companyId, this.deviceId);
        const mentionsResult = await mentionsService.createMentions(
          commentId,
          updates.content,
          this.userId,
          comment.commentable_type,
          comment.commentable_id
        );

        if (mentionsResult.mentions.length > 0) {
          updateData.mentioned_user_ids = mentionsResult.mentions.map((m) => m.mentioned_user_id);
        }
      }

      // Update metadata if provided
      if (updates.metadata !== undefined) {
        updateData.metadata = { ...comment.metadata, ...updates.metadata };
      }

      await db.comments.update(commentId, updateData);

      const updatedComment = (await db.comments.get(commentId))!;

      serviceLogger.info('Updated comment', {
        commentId,
        userId: this.userId,
        contentChanged: updates.content !== undefined,
      });

      return updatedComment;
    } catch (error) {
      serviceLogger.error('Failed to update comment', { error, commentId });
      throw error;
    }
  }

  /**
   * Delete a comment (soft delete)
   * Only author can delete their own comments
   */
  async deleteComment(commentId: string): Promise<void> {
    try {
      const comment = await db.comments.get(commentId);

      if (!comment) {
        throw new Error('Comment not found');
      }

      if (comment.company_id !== this.companyId) {
        throw new Error('Comment does not belong to this company');
      }

      // Check delete permissions
      if (!canDeleteComment(comment, this.userId)) {
        throw new Error('Cannot delete this comment (must be author and not already deleted)');
      }

      // Check entity permissions
      await this.checkPermissions(comment.commentable_type, comment.commentable_id, 'delete');

      const now = Date.now();
      await db.comments.update(commentId, {
        status: CommentStatus.DELETED,
        deleted_at: now,
        updated_at: now,
        version_vector: {
          ...comment.version_vector,
          [this.deviceId]: (comment.version_vector[this.deviceId] || 0) + 1,
        },
      });

      serviceLogger.info('Deleted comment', {
        commentId,
        userId: this.userId,
      });
    } catch (error) {
      serviceLogger.error('Failed to delete comment', { error, commentId });
      throw error;
    }
  }

  /**
   * Get comment count for entity
   */
  async getCommentCount(
    commentableType: CommentableType,
    commentableId: string
  ): Promise<number> {
    try {
      const count = await db.comments
        .where('[commentable_type+commentable_id]')
        .equals([commentableType, commentableId])
        .and((comment) =>
          comment.company_id === this.companyId &&
          comment.status !== CommentStatus.DELETED &&
          comment.deleted_at === null
        )
        .count();

      return count;
    } catch (error) {
      serviceLogger.error('Failed to get comment count', { error });
      throw error;
    }
  }

  /**
   * Search comments by content
   */
  async searchComments(
    searchTerm: string,
    options: {
      commentableType?: CommentableType;
      limit?: number;
    } = {}
  ): Promise<Comment[]> {
    try {
      let query = db.comments
        .where('company_id')
        .equals(this.companyId)
        .and((comment) => comment.status !== CommentStatus.DELETED && comment.deleted_at === null);

      if (options.commentableType) {
        query = query.and((comment) => comment.commentable_type === options.commentableType);
      }

      // Note: This is a simple case-insensitive search
      // In production, you might want to use a full-text search library
      const searchLower = searchTerm.toLowerCase();
      query = query.and((comment) => comment.content.toLowerCase().includes(searchLower));

      let comments = await query.sortBy('created_at');

      if (options.limit) {
        comments = comments.slice(0, options.limit);
      }

      // Filter by permissions
      const accessibleComments: Comment[] = [];
      for (const comment of comments) {
        try {
          await this.checkPermissions(comment.commentable_type, comment.commentable_id, 'read');
          accessibleComments.push(comment);
        } catch {
          // Skip comments user doesn't have access to
        }
      }

      return accessibleComments;
    } catch (error) {
      serviceLogger.error('Failed to search comments', { error, searchTerm });
      throw error;
    }
  }

  /**
   * Check if user has permission to perform action on entity
   */
  private async checkPermissions(
    commentableType: CommentableType,
    _commentableId: string,
    action: 'create' | 'read' | 'update' | 'delete'
  ): Promise<void> {
    try {
      // Get user's company role
      const companyUser = await db.companyUsers
        .where('[company_id+user_id]')
        .equals([this.companyId, this.userId])
        .and((cu) => cu.active === true && cu.deleted_at === null)
        .first();

      if (!companyUser) {
        throw new Error('User is not a member of this company');
      }

      // Map commentable types to permission namespaces
      const permissionMap: Record<CommentableType, string> = {
        TRANSACTION: 'transactions',
        INVOICE: 'contacts',
        BILL: 'contacts',
        CHECKLIST_ITEM: 'accounts', // Anyone can comment on checklists
        JOURNAL_ENTRY: 'transactions',
        RECEIPT: 'transactions',
        CONTACT: 'contacts',
        PRODUCT: 'products',
      };

      const namespace = permissionMap[commentableType];
      const permission = `${namespace}.${action === 'create' ? 'update' : action}`;

      if (!companyUser.permissions.includes(permission)) {
        throw new Error(`Missing permission: ${permission}`);
      }
    } catch (error) {
      serviceLogger.error('Permission check failed', { error, commentableType, action });
      throw error;
    }
  }

  /**
   * Get recent comments across all entities
   * Useful for activity feeds
   */
  async getRecentComments(limit: number = 20): Promise<Comment[]> {
    try {
      const allComments = await db.comments
        .where('company_id')
        .equals(this.companyId)
        .and((comment) => comment.status !== CommentStatus.DELETED && comment.deleted_at === null)
        .reverse()
        .sortBy('created_at');

      // Filter by permissions
      const accessibleComments: Comment[] = [];
      for (const comment of allComments) {
        if (accessibleComments.length >= limit) {
          break;
        }

        try {
          await this.checkPermissions(comment.commentable_type, comment.commentable_id, 'read');
          accessibleComments.push(comment);
        } catch {
          // Skip comments user doesn't have access to
        }
      }

      return accessibleComments.slice(0, limit);
    } catch (error) {
      serviceLogger.error('Failed to get recent comments', { error });
      throw error;
    }
  }
}

/**
 * Factory function to create CommentsService instance
 */
export const createCommentsService = (
  companyId: string,
  userId: string,
  deviceId: string
): CommentsService => {
  return new CommentsService(companyId, userId, deviceId);
};
