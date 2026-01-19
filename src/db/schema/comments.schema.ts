/**
 * Comments Schema Definition
 *
 * Defines the structure for threaded comments on transactions, invoices, bills,
 * and checklist items with @mention support and role-based permissions.
 *
 * Requirements:
 * - I2: Activity Feed & Communication
 * - ARCH-002: Zero-knowledge encryption
 * - ARCH-004: CRDT-Compatible Schema Design
 */

import type { BaseEntity, VersionVector } from '../../types/database.types';

// ============================================================================
// Comment Types
// ============================================================================

/**
 * Entity type that can receive comments
 */
export enum CommentableType {
  TRANSACTION = 'TRANSACTION',
  INVOICE = 'INVOICE',
  BILL = 'BILL',
  CHECKLIST_ITEM = 'CHECKLIST_ITEM',
  JOURNAL_ENTRY = 'JOURNAL_ENTRY',
  RECEIPT = 'RECEIPT',
  CONTACT = 'CONTACT',
  PRODUCT = 'PRODUCT',
}

/**
 * Comment status
 */
export enum CommentStatus {
  ACTIVE = 'ACTIVE',
  EDITED = 'EDITED',
  DELETED = 'DELETED', // Soft delete - content hidden but thread preserved
}

/**
 * Comment entity
 * Supports threaded conversations with @mentions
 */
export interface Comment extends BaseEntity {
  company_id: string; // UUID - links to Company
  commentable_type: CommentableType; // Type of entity being commented on
  commentable_id: string; // UUID - ID of entity being commented on
  parent_comment_id: string | null; // UUID - For threaded replies (null = top-level)
  author_user_id: string; // UUID - User who created the comment
  content: string; // ENCRYPTED - Comment text with @mentions
  status: CommentStatus; // Comment status
  edited_at: number | null; // Unix timestamp when edited (null if never edited)
  mentioned_user_ids: string[]; // ENCRYPTED - Array of user IDs mentioned in comment
  checklist_item_id: string | null; // UUID - Optional checklist item created from @mention
  metadata: Record<string, unknown>; // ENCRYPTED - Additional metadata
  version_vector: VersionVector; // For CRDT conflict resolution
}

/**
 * Mention entity
 * Tracks @mentions for efficient querying and notification routing
 */
export interface Mention extends BaseEntity {
  company_id: string; // UUID - links to Company
  comment_id: string; // UUID - links to Comment
  mentioned_user_id: string; // UUID - User who was mentioned
  mentioning_user_id: string; // UUID - User who created the mention
  commentable_type: CommentableType; // Type of entity being commented on
  commentable_id: string; // UUID - ID of entity being commented on
  read_at: number | null; // Unix timestamp when mention was read (null = unread)
  notification_sent: boolean; // Whether notification was sent
  version_vector: VersionVector; // For CRDT conflict resolution
}

// ============================================================================
// Schema Definitions for Dexie.js
// ============================================================================

/**
 * Dexie.js schema definition for Comments table
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - company_id: For querying comments by company
 * - [commentable_type+commentable_id]: Compound index for finding comments on an entity
 * - parent_comment_id: For querying replies to a comment
 * - author_user_id: For querying user's comments
 * - status: For filtering deleted comments
 * - updated_at: For CRDT conflict resolution
 * - deleted_at: For soft delete tombstone filtering
 */
export const commentsSchema =
  'id, company_id, [commentable_type+commentable_id], parent_comment_id, author_user_id, status, updated_at, deleted_at';

/**
 * Dexie.js schema definition for Mentions table
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - company_id: For querying mentions by company
 * - comment_id: For finding mentions in a comment
 * - mentioned_user_id: For querying mentions for a user
 * - [mentioned_user_id+read_at]: Compound index for unread mentions
 * - [commentable_type+commentable_id]: Compound index for mentions on an entity
 * - notification_sent: For querying unsent notifications
 * - updated_at: For CRDT conflict resolution
 * - deleted_at: For soft delete tombstone filtering
 */
export const mentionsSchema =
  'id, company_id, comment_id, mentioned_user_id, [mentioned_user_id+read_at], [commentable_type+commentable_id], notification_sent, updated_at, deleted_at';

// ============================================================================
// Table Name Constants
// ============================================================================

export const COMMENTS_TABLE = 'comments';
export const MENTIONS_TABLE = 'mentions';

// ============================================================================
// Default Value Factories
// ============================================================================

/**
 * Default values for new Comment
 */
export const createDefaultComment = (
  companyId: string,
  commentableType: CommentableType,
  commentableId: string,
  authorUserId: string,
  content: string,
  deviceId: string,
  parentCommentId: string | null = null
): Partial<Comment> => {
  const now = Date.now();

  return {
    company_id: companyId,
    commentable_type: commentableType,
    commentable_id: commentableId,
    parent_comment_id: parentCommentId,
    author_user_id: authorUserId,
    content,
    status: CommentStatus.ACTIVE,
    edited_at: null,
    mentioned_user_ids: [],
    checklist_item_id: null,
    metadata: {},
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version_vector: {
      [deviceId]: 1,
    },
  };
};

/**
 * Default values for new Mention
 */
export const createDefaultMention = (
  companyId: string,
  commentId: string,
  mentionedUserId: string,
  mentioningUserId: string,
  commentableType: CommentableType,
  commentableId: string,
  deviceId: string
): Partial<Mention> => {
  const now = Date.now();

  return {
    company_id: companyId,
    comment_id: commentId,
    mentioned_user_id: mentionedUserId,
    mentioning_user_id: mentioningUserId,
    commentable_type: commentableType,
    commentable_id: commentableId,
    read_at: null,
    notification_sent: false,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version_vector: {
      [deviceId]: 1,
    },
  };
};

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate Comment has required fields
 */
export const validateComment = (comment: Partial<Comment>): string[] => {
  const errors: string[] = [];

  if (!comment.company_id) {
    errors.push('company_id is required');
  }

  if (!comment.commentable_type) {
    errors.push('commentable_type is required');
  }

  if (!comment.commentable_id) {
    errors.push('commentable_id is required');
  }

  if (!comment.author_user_id) {
    errors.push('author_user_id is required');
  }

  if (!comment.content || comment.content.trim() === '') {
    errors.push('content is required');
  }

  if (comment.content && comment.content.length > 5000) {
    errors.push('content must not exceed 5000 characters');
  }

  return errors;
};

/**
 * Validate Mention has required fields
 */
export const validateMention = (mention: Partial<Mention>): string[] => {
  const errors: string[] = [];

  if (!mention.company_id) {
    errors.push('company_id is required');
  }

  if (!mention.comment_id) {
    errors.push('comment_id is required');
  }

  if (!mention.mentioned_user_id) {
    errors.push('mentioned_user_id is required');
  }

  if (!mention.mentioning_user_id) {
    errors.push('mentioning_user_id is required');
  }

  if (!mention.commentable_type) {
    errors.push('commentable_type is required');
  }

  if (!mention.commentable_id) {
    errors.push('commentable_id is required');
  }

  return errors;
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if mention is unread
 */
export const isMentionUnread = (mention: Mention): boolean => {
  return mention.read_at === null;
};

/**
 * Check if comment is deleted
 */
export const isCommentDeleted = (comment: Comment): boolean => {
  return comment.status === CommentStatus.DELETED || comment.deleted_at !== null;
};

/**
 * Check if comment was edited
 */
export const wasCommentEdited = (comment: Comment): boolean => {
  return comment.edited_at !== null;
};

/**
 * Get comment age in milliseconds
 */
export const getCommentAge = (comment: Comment): number => {
  return Date.now() - comment.created_at;
};

/**
 * Get mention age in milliseconds
 */
export const getMentionAge = (mention: Mention): number => {
  return Date.now() - mention.created_at;
};

/**
 * Check if comment can be edited by user
 * Users can only edit their own comments within 15 minutes
 */
export const canEditComment = (comment: Comment, userId: string): boolean => {
  if (comment.author_user_id !== userId) {
    return false;
  }

  if (isCommentDeleted(comment)) {
    return false;
  }

  const EDIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
  return getCommentAge(comment) <= EDIT_WINDOW_MS;
};

/**
 * Check if comment can be deleted by user
 * Users can delete their own comments at any time
 */
export const canDeleteComment = (comment: Comment, userId: string): boolean => {
  if (comment.author_user_id !== userId) {
    return false;
  }

  return !isCommentDeleted(comment);
};

// ============================================================================
// Query Helpers
// ============================================================================

/**
 * Query helper: Get comments for an entity
 */
export interface GetCommentsQuery {
  company_id: string;
  commentable_type: CommentableType;
  commentable_id: string;
  include_deleted?: boolean;
  parent_comment_id?: string | null; // null = top-level only, undefined = all
}

/**
 * Query helper: Get mentions for a user
 */
export interface GetMentionsQuery {
  company_id: string;
  mentioned_user_id: string;
  unread_only?: boolean;
  commentable_type?: CommentableType;
  limit?: number;
}

/**
 * Query helper: Get unsent notifications
 */
export interface GetUnsentNotificationsQuery {
  company_id: string;
  notification_sent?: false;
}
