/**
 * Comments Service Unit Tests
 *
 * Comprehensive tests for comment CRUD operations, threading,
 * permissions, and integration with mentions.
 *
 * Requirements:
 * - I2: Activity Feed & Communication
 * - Target: 100% coverage
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../db/database';
import {
  CommentsService,
  createCommentsService,
} from './comments.service';
import {
  CommentableType,
  CommentStatus,
  type Comment,
} from '../db/schema/comments.schema';
import type { CompanyUser, User, TransactionType, TransactionStatus } from '../types/database.types';

// ============================================================================
// Test Setup
// ============================================================================

const TEST_COMPANY_ID = 'company-test-001';
const TEST_USER_ID = 'user-test-001';
const TEST_USER_ID_2 = 'user-test-002';
const TEST_DEVICE_ID = 'device-test-001';
const TEST_TRANSACTION_ID = 'transaction-test-001';

describe('CommentsService', () => {
  let service: CommentsService;

  beforeEach(async () => {
    // Clear all relevant tables
    await db.comments.clear();
    await db.mentions.clear();
    await db.companyUsers.clear();
    await db.users.clear();
    await db.transactions.clear();
    await db.invoices.clear();

    // Create test users
    await db.users.add({
      id: TEST_USER_ID,
      email: 'testuser@example.com',
      name: 'Test User',
      hashed_password: 'hashed',
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted_at: null,
      version_vector: { [TEST_DEVICE_ID]: 1 },
    } as User);

    await db.users.add({
      id: TEST_USER_ID_2,
      email: 'testuser2@example.com',
      name: 'Test User 2',
      hashed_password: 'hashed',
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted_at: null,
      version_vector: { [TEST_DEVICE_ID]: 1 },
    } as User);

    // Create test company user with full permissions
    await db.companyUsers.add({
      id: 'cu-001',
      company_id: TEST_COMPANY_ID,
      user_id: TEST_USER_ID,
      role: 'ADMIN',
      permissions: [
        'transactions.read',
        'transactions.update',
        'transactions.delete',
        'contacts.read',
        'contacts.update',
        'contacts.delete',
        'accounts.read',
        'accounts.update',
        'products.read',
      ],
      active: true,
      invited_at: Date.now(),
      joined_at: Date.now(),
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted_at: null,
      version_vector: { [TEST_DEVICE_ID]: 1 },
    } as CompanyUser);

    await db.companyUsers.add({
      id: 'cu-002',
      company_id: TEST_COMPANY_ID,
      user_id: TEST_USER_ID_2,
      role: 'BOOKKEEPER',
      permissions: [
        'transactions.read',
        'transactions.update',
        'contacts.read',
        'contacts.update',
        'accounts.read',
      ],
      active: true,
      invited_at: Date.now(),
      joined_at: Date.now(),
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted_at: null,
      version_vector: { [TEST_DEVICE_ID]: 1 },
    } as CompanyUser);

    // Create test transaction
    await db.transactions.add({
      id: TEST_TRANSACTION_ID,
      company_id: TEST_COMPANY_ID,
      transaction_number: 'TXN-001',
      date: Date.now(),
      description: 'Test transaction',
      type: TransactionType.INCOME,
      amount: '100.00',
      balance: '100.00',
      status: TransactionStatus.PENDING,
      reconciled: false,
      account_id: 'account-001',
      category_id: null,
      contact_id: null,
      tags: [],
      attachments: [],
      metadata: {},
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted_at: null,
      version_vector: { [TEST_DEVICE_ID]: 1 },
    });

    // Create service instance
    service = createCommentsService(TEST_COMPANY_ID, TEST_USER_ID, TEST_DEVICE_ID);
  });

  afterEach(async () => {
    await db.comments.clear();
    await db.mentions.clear();
    await db.companyUsers.clear();
    await db.users.clear();
    await db.transactions.clear();
    await db.invoices.clear();
  });

  // ============================================================================
  // Create Comment Tests
  // ============================================================================

  describe('createComment', () => {
    it('should create a basic comment successfully', async () => {
      const result = await service.createComment(
        CommentableType.TRANSACTION,
        TEST_TRANSACTION_ID,
        'This is a test comment'
      );

      expect(result.comment).toBeDefined();
      expect(result.comment.id).toBeDefined();
      expect(result.comment.company_id).toBe(TEST_COMPANY_ID);
      expect(result.comment.commentable_type).toBe(CommentableType.TRANSACTION);
      expect(result.comment.commentable_id).toBe(TEST_TRANSACTION_ID);
      expect(result.comment.author_user_id).toBe(TEST_USER_ID);
      expect(result.comment.content).toBe('This is a test comment');
      expect(result.comment.status).toBe(CommentStatus.ACTIVE);
      expect(result.comment.parent_comment_id).toBeNull();
      expect(result.comment.edited_at).toBeNull();
    });

    it('should create a threaded reply comment', async () => {
      // Create parent comment
      const parentResult = await service.createComment(
        CommentableType.TRANSACTION,
        TEST_TRANSACTION_ID,
        'Parent comment'
      );

      // Create reply
      const replyResult = await service.createComment(
        CommentableType.TRANSACTION,
        TEST_TRANSACTION_ID,
        'Reply comment',
        { parentCommentId: parentResult.comment.id }
      );

      expect(replyResult.comment.parent_comment_id).toBe(parentResult.comment.id);
      expect(replyResult.comment.commentable_id).toBe(TEST_TRANSACTION_ID);
    });

    it('should create comment with metadata', async () => {
      const metadata = { source: 'mobile', priority: 'high' };
      const result = await service.createComment(
        CommentableType.TRANSACTION,
        TEST_TRANSACTION_ID,
        'Comment with metadata',
        { metadata }
      );

      expect(result.comment.metadata).toEqual(metadata);
    });

    it('should process @mentions in comment', async () => {
      const result = await service.createComment(
        CommentableType.TRANSACTION,
        TEST_TRANSACTION_ID,
        'Hey @testuser2, please review this transaction'
      );

      expect(result.mentionsResult).toBeDefined();
      expect(result.mentionsResult!.mentions.length).toBeGreaterThan(0);
      expect(result.comment.mentioned_user_ids).toContain(TEST_USER_ID_2);
    });

    it('should reject comment with empty content', async () => {
      await expect(
        service.createComment(
          CommentableType.TRANSACTION,
          TEST_TRANSACTION_ID,
          ''
        )
      ).rejects.toThrow();
    });

    it('should reject comment with content exceeding max length', async () => {
      const longContent = 'a'.repeat(10001); // Assuming max is 10000
      await expect(
        service.createComment(
          CommentableType.TRANSACTION,
          TEST_TRANSACTION_ID,
          longContent
        )
      ).rejects.toThrow();
    });

    it('should reject reply to non-existent parent', async () => {
      await expect(
        service.createComment(
          CommentableType.TRANSACTION,
          TEST_TRANSACTION_ID,
          'Reply to nothing',
          { parentCommentId: 'non-existent-id' }
        )
      ).rejects.toThrow('Parent comment not found');
    });

    it('should reject reply to deleted parent comment', async () => {
      // Create and delete parent
      const parentResult = await service.createComment(
        CommentableType.TRANSACTION,
        TEST_TRANSACTION_ID,
        'Parent comment'
      );
      await service.deleteComment(parentResult.comment.id);

      // Try to reply
      await expect(
        service.createComment(
          CommentableType.TRANSACTION,
          TEST_TRANSACTION_ID,
          'Reply to deleted',
          { parentCommentId: parentResult.comment.id }
        )
      ).rejects.toThrow('Cannot reply to deleted comment');
    });

    it('should reject comment from user without permission', async () => {
      // Create service for user without permissions
      const restrictedService = createCommentsService(
        TEST_COMPANY_ID,
        'unauthorized-user-id',
        TEST_DEVICE_ID
      );

      await expect(
        restrictedService.createComment(
          CommentableType.TRANSACTION,
          TEST_TRANSACTION_ID,
          'Unauthorized comment'
        )
      ).rejects.toThrow();
    });
  });

  // ============================================================================
  // Get Comments Tests
  // ============================================================================

  describe('getComments', () => {
    beforeEach(async () => {
      // Create test comments
      await service.createComment(
        CommentableType.TRANSACTION,
        TEST_TRANSACTION_ID,
        'First comment'
      );
      await service.createComment(
        CommentableType.TRANSACTION,
        TEST_TRANSACTION_ID,
        'Second comment'
      );
    });

    it('should retrieve all comments for entity', async () => {
      const comments = await service.getComments({
        company_id: TEST_COMPANY_ID,
        commentable_type: CommentableType.TRANSACTION,
        commentable_id: TEST_TRANSACTION_ID,
      });

      expect(comments).toHaveLength(2);
      expect(comments[0]?.content).toBe('First comment');
      expect(comments[1]?.content).toBe('Second comment');
    });

    it('should filter top-level comments only', async () => {
      // Create parent and reply
      const parent = await service.createComment(
        CommentableType.TRANSACTION,
        TEST_TRANSACTION_ID,
        'Parent'
      );
      await service.createComment(
        CommentableType.TRANSACTION,
        TEST_TRANSACTION_ID,
        'Reply',
        { parentCommentId: parent.comment.id }
      );

      const topLevelComments = await service.getComments({
        company_id: TEST_COMPANY_ID,
        commentable_type: CommentableType.TRANSACTION,
        commentable_id: TEST_TRANSACTION_ID,
        parent_comment_id: null,
      });

      expect(topLevelComments).toHaveLength(3); // 2 initial + 1 parent
      expect(topLevelComments.every((c) => c.parent_comment_id === null)).toBe(true);
    });

    it('should exclude deleted comments by default', async () => {
      const result = await service.createComment(
        CommentableType.TRANSACTION,
        TEST_TRANSACTION_ID,
        'To be deleted'
      );
      await service.deleteComment(result.comment.id);

      const comments = await service.getComments({
        company_id: TEST_COMPANY_ID,
        commentable_type: CommentableType.TRANSACTION,
        commentable_id: TEST_TRANSACTION_ID,
      });

      expect(comments.every((c) => c.status !== CommentStatus.DELETED)).toBe(true);
    });

    it('should include deleted comments when requested', async () => {
      const result = await service.createComment(
        CommentableType.TRANSACTION,
        TEST_TRANSACTION_ID,
        'To be deleted'
      );
      await service.deleteComment(result.comment.id);

      const comments = await service.getComments({
        company_id: TEST_COMPANY_ID,
        commentable_type: CommentableType.TRANSACTION,
        commentable_id: TEST_TRANSACTION_ID,
        include_deleted: true,
      });

      const deletedComment = comments.find((c) => c.id === result.comment.id);
      expect(deletedComment).toBeDefined();
      expect(deletedComment?.status).toBe(CommentStatus.DELETED);
    });

    it('should return empty array for entity with no comments', async () => {
      const comments = await service.getComments({
        company_id: TEST_COMPANY_ID,
        commentable_type: CommentableType.INVOICE,
        commentable_id: 'non-existent-invoice',
      });

      expect(comments).toEqual([]);
    });
  });

  // ============================================================================
  // Get Single Comment Tests
  // ============================================================================

  describe('getComment', () => {
    it('should retrieve single comment by ID', async () => {
      const created = await service.createComment(
        CommentableType.TRANSACTION,
        TEST_TRANSACTION_ID,
        'Test comment'
      );

      const retrieved = await service.getComment(created.comment.id);

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(created.comment.id);
      expect(retrieved!.content).toBe('Test comment');
    });

    it('should return null for non-existent comment', async () => {
      const retrieved = await service.getComment('non-existent-id');
      expect(retrieved).toBeNull();
    });

    it('should reject comment from different company', async () => {
      // Create comment in test company
      const created = await service.createComment(
        CommentableType.TRANSACTION,
        TEST_TRANSACTION_ID,
        'Test comment'
      );

      // Try to access from different company
      const otherService = createCommentsService(
        'other-company-id',
        TEST_USER_ID,
        TEST_DEVICE_ID
      );

      await expect(otherService.getComment(created.comment.id)).rejects.toThrow(
        'Comment does not belong to this company'
      );
    });
  });

  // ============================================================================
  // Build Comment Thread Tests
  // ============================================================================

  describe('buildCommentThread', () => {
    it('should build simple thread with one level of replies', async () => {
      // Create parent
      const parent = await service.createComment(
        CommentableType.TRANSACTION,
        TEST_TRANSACTION_ID,
        'Parent'
      );

      // Create replies
      await service.createComment(
        CommentableType.TRANSACTION,
        TEST_TRANSACTION_ID,
        'Reply 1',
        { parentCommentId: parent.comment.id }
      );
      await service.createComment(
        CommentableType.TRANSACTION,
        TEST_TRANSACTION_ID,
        'Reply 2',
        { parentCommentId: parent.comment.id }
      );

      const threads = await service.buildCommentThread(
        CommentableType.TRANSACTION,
        TEST_TRANSACTION_ID
      );

      expect(threads).toHaveLength(1);
      expect(threads[0]?.comment.id).toBe(parent.comment.id);
      expect(threads[0]?.replies).toHaveLength(2);
      expect(threads[0]?.replyCount).toBe(2);
      expect(threads[0]?.depth).toBe(0);
    });

    it('should build nested thread with multiple levels', async () => {
      // Level 0
      const parent = await service.createComment(
        CommentableType.TRANSACTION,
        TEST_TRANSACTION_ID,
        'Level 0'
      );

      // Level 1
      const reply1 = await service.createComment(
        CommentableType.TRANSACTION,
        TEST_TRANSACTION_ID,
        'Level 1',
        { parentCommentId: parent.comment.id }
      );

      // Level 2
      await service.createComment(
        CommentableType.TRANSACTION,
        TEST_TRANSACTION_ID,
        'Level 2',
        { parentCommentId: reply1.comment.id }
      );

      const threads = await service.buildCommentThread(
        CommentableType.TRANSACTION,
        TEST_TRANSACTION_ID
      );

      expect(threads).toHaveLength(1);
      expect(threads[0]?.replies).toHaveLength(1);
      expect(threads[0]?.replies[0]?.replies).toHaveLength(1);
      expect(threads[0]?.replyCount).toBe(2); // Total replies
    });

    it('should respect maxDepth parameter', async () => {
      // Create 6 levels deep
      let parentId = null;
      for (let i = 0; i < 6; i++) {
        const result = await service.createComment(
          CommentableType.TRANSACTION,
          TEST_TRANSACTION_ID,
          `Level ${i}`,
          { parentCommentId: parentId }
        );
        parentId = result.comment.id;
      }

      const threads = await service.buildCommentThread(
        CommentableType.TRANSACTION,
        TEST_TRANSACTION_ID,
        2 // Max depth of 2
      );

      // Navigate to deepest level
      let current = threads[0]!;
      let depth = 0;
      while (current.replies.length > 0) {
        current = current.replies[0]!;
        depth++;
      }

      expect(depth).toBeLessThanOrEqual(2);
    });

    it('should handle multiple top-level threads', async () => {
      // Create 3 separate top-level comments
      await service.createComment(
        CommentableType.TRANSACTION,
        TEST_TRANSACTION_ID,
        'Thread 1'
      );
      await service.createComment(
        CommentableType.TRANSACTION,
        TEST_TRANSACTION_ID,
        'Thread 2'
      );
      await service.createComment(
        CommentableType.TRANSACTION,
        TEST_TRANSACTION_ID,
        'Thread 3'
      );

      const threads = await service.buildCommentThread(
        CommentableType.TRANSACTION,
        TEST_TRANSACTION_ID
      );

      expect(threads).toHaveLength(3);
      expect(threads.every((t) => t.depth === 0)).toBe(true);
    });
  });

  // ============================================================================
  // Update Comment Tests
  // ============================================================================

  describe('updateComment', () => {
    it('should update comment content successfully', async () => {
      const created = await service.createComment(
        CommentableType.TRANSACTION,
        TEST_TRANSACTION_ID,
        'Original content'
      );

      const updated = await service.updateComment(created.comment.id, {
        content: 'Updated content',
      });

      expect(updated.content).toBe('Updated content');
      expect(updated.status).toBe(CommentStatus.EDITED);
      expect(updated.edited_at).not.toBeNull();
    });

    it('should update comment metadata', async () => {
      const created = await service.createComment(
        CommentableType.TRANSACTION,
        TEST_TRANSACTION_ID,
        'Test comment',
        { metadata: { priority: 'low' } }
      );

      const updated = await service.updateComment(created.comment.id, {
        metadata: { priority: 'high', reviewed: true },
      });

      expect(updated.metadata).toEqual({ priority: 'high', reviewed: true });
    });

    it('should reprocess mentions when content changes', async () => {
      const created = await service.createComment(
        CommentableType.TRANSACTION,
        TEST_TRANSACTION_ID,
        'Original comment'
      );

      const updated = await service.updateComment(created.comment.id, {
        content: 'Hey @testuser2, check this out',
      });

      expect(updated.mentioned_user_ids).toContain(TEST_USER_ID_2);
    });

    it('should reject update after 15 minute window', async () => {
      const created = await service.createComment(
        CommentableType.TRANSACTION,
        TEST_TRANSACTION_ID,
        'Old comment'
      );

      // Manually update created_at to be 16 minutes ago
      await db.comments.update(created.comment.id, {
        created_at: Date.now() - 16 * 60 * 1000,
      });

      await expect(
        service.updateComment(created.comment.id, {
          content: 'Updated after timeout',
        })
      ).rejects.toThrow('Cannot edit this comment');
    });

    it('should reject update by non-author', async () => {
      const created = await service.createComment(
        CommentableType.TRANSACTION,
        TEST_TRANSACTION_ID,
        'User 1 comment'
      );

      // Try to update as different user
      const service2 = createCommentsService(
        TEST_COMPANY_ID,
        TEST_USER_ID_2,
        TEST_DEVICE_ID
      );

      await expect(
        service2.updateComment(created.comment.id, {
          content: 'Unauthorized update',
        })
      ).rejects.toThrow('Cannot edit this comment');
    });

    it('should reject update of non-existent comment', async () => {
      await expect(
        service.updateComment('non-existent-id', {
          content: 'Update nothing',
        })
      ).rejects.toThrow('Comment not found');
    });

    it('should increment version vector on update', async () => {
      const created = await service.createComment(
        CommentableType.TRANSACTION,
        TEST_TRANSACTION_ID,
        'Original'
      );

      const originalVersion = created.comment.version_vector[TEST_DEVICE_ID] || 0;

      const updated = await service.updateComment(created.comment.id, {
        content: 'Updated',
      });

      expect(updated.version_vector[TEST_DEVICE_ID]).toBe(originalVersion + 1);
    });
  });

  // ============================================================================
  // Delete Comment Tests
  // ============================================================================

  describe('deleteComment', () => {
    it('should soft delete comment successfully', async () => {
      const created = await service.createComment(
        CommentableType.TRANSACTION,
        TEST_TRANSACTION_ID,
        'To be deleted'
      );

      await service.deleteComment(created.comment.id);

      const deleted = await db.comments.get(created.comment.id);
      expect(deleted).toBeDefined();
      expect(deleted!.status).toBe(CommentStatus.DELETED);
      expect(deleted!.deleted_at).not.toBeNull();
    });

    it('should reject delete by non-author', async () => {
      const created = await service.createComment(
        CommentableType.TRANSACTION,
        TEST_TRANSACTION_ID,
        'User 1 comment'
      );

      const service2 = createCommentsService(
        TEST_COMPANY_ID,
        TEST_USER_ID_2,
        TEST_DEVICE_ID
      );

      await expect(service2.deleteComment(created.comment.id)).rejects.toThrow(
        'Cannot delete this comment'
      );
    });

    it('should reject delete of already deleted comment', async () => {
      const created = await service.createComment(
        CommentableType.TRANSACTION,
        TEST_TRANSACTION_ID,
        'To be deleted'
      );

      await service.deleteComment(created.comment.id);

      await expect(service.deleteComment(created.comment.id)).rejects.toThrow(
        'Cannot delete this comment'
      );
    });

    it('should reject delete of non-existent comment', async () => {
      await expect(service.deleteComment('non-existent-id')).rejects.toThrow(
        'Comment not found'
      );
    });

    it('should increment version vector on delete', async () => {
      const created = await service.createComment(
        CommentableType.TRANSACTION,
        TEST_TRANSACTION_ID,
        'To be deleted'
      );

      const originalVersion = created.comment.version_vector[TEST_DEVICE_ID] || 0;

      await service.deleteComment(created.comment.id);

      const deleted = await db.comments.get(created.comment.id);
      expect(deleted!.version_vector[TEST_DEVICE_ID]).toBe(originalVersion + 1);
    });
  });

  // ============================================================================
  // Comment Count Tests
  // ============================================================================

  describe('getCommentCount', () => {
    it('should count active comments only', async () => {
      await service.createComment(
        CommentableType.TRANSACTION,
        TEST_TRANSACTION_ID,
        'Comment 1'
      );
      await service.createComment(
        CommentableType.TRANSACTION,
        TEST_TRANSACTION_ID,
        'Comment 2'
      );
      const deleted = await service.createComment(
        CommentableType.TRANSACTION,
        TEST_TRANSACTION_ID,
        'Comment 3'
      );
      await service.deleteComment(deleted.comment.id);

      const count = await service.getCommentCount(
        CommentableType.TRANSACTION,
        TEST_TRANSACTION_ID
      );

      expect(count).toBe(2);
    });

    it('should return 0 for entity with no comments', async () => {
      const count = await service.getCommentCount(
        CommentableType.INVOICE,
        'non-existent-invoice'
      );

      expect(count).toBe(0);
    });
  });

  // ============================================================================
  // Search Comments Tests
  // ============================================================================

  describe('searchComments', () => {
    beforeEach(async () => {
      await service.createComment(
        CommentableType.TRANSACTION,
        TEST_TRANSACTION_ID,
        'This contains the word apple'
      );
      await service.createComment(
        CommentableType.TRANSACTION,
        TEST_TRANSACTION_ID,
        'This contains the word banana'
      );
      await service.createComment(
        CommentableType.TRANSACTION,
        TEST_TRANSACTION_ID,
        'This contains the word APPLE in uppercase'
      );
    });

    it('should search comments by content (case-insensitive)', async () => {
      const results = await service.searchComments('apple');

      expect(results).toHaveLength(2);
      expect(results.every((c) => c.content.toLowerCase().includes('apple'))).toBe(true);
    });

    it('should filter by commentable type', async () => {
      const results = await service.searchComments('apple', {
        commentableType: CommentableType.TRANSACTION,
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results.every((c) => c.commentable_type === CommentableType.TRANSACTION)).toBe(true);
    });

    it('should limit search results', async () => {
      const results = await service.searchComments('the', { limit: 2 });

      expect(results).toHaveLength(2);
    });

    it('should exclude deleted comments from search', async () => {
      const deleted = await service.createComment(
        CommentableType.TRANSACTION,
        TEST_TRANSACTION_ID,
        'Contains apple but deleted'
      );
      await service.deleteComment(deleted.comment.id);

      const results = await service.searchComments('apple');

      expect(results.every((c) => c.id !== deleted.comment.id)).toBe(true);
    });

    it('should return empty array when no matches', async () => {
      const results = await service.searchComments('zzzzzzz');

      expect(results).toEqual([]);
    });
  });

  // ============================================================================
  // Recent Comments Tests
  // ============================================================================

  describe('getRecentComments', () => {
    it('should retrieve recent comments across all entities', async () => {
      await service.createComment(
        CommentableType.TRANSACTION,
        TEST_TRANSACTION_ID,
        'Transaction comment'
      );

      // Add small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      await service.createComment(
        CommentableType.TRANSACTION,
        'other-transaction',
        'Other transaction comment'
      );

      const recent = await service.getRecentComments(10);

      expect(recent.length).toBeGreaterThan(0);
      // Should be in reverse chronological order (most recent first)
      for (let i = 1; i < recent.length; i++) {
        expect(recent[i - 1]?.created_at ?? 0).toBeGreaterThanOrEqual(recent[i]?.created_at ?? 0);
      }
    });

    it('should respect limit parameter', async () => {
      // Create many comments
      for (let i = 0; i < 25; i++) {
        await service.createComment(
          CommentableType.TRANSACTION,
          TEST_TRANSACTION_ID,
          `Comment ${i}`
        );
      }

      const recent = await service.getRecentComments(10);

      expect(recent).toHaveLength(10);
    });

    it('should exclude deleted comments', async () => {
      const deleted = await service.createComment(
        CommentableType.TRANSACTION,
        TEST_TRANSACTION_ID,
        'Deleted'
      );
      await service.deleteComment(deleted.comment.id);

      await service.createComment(
        CommentableType.TRANSACTION,
        TEST_TRANSACTION_ID,
        'Active'
      );

      const recent = await service.getRecentComments(10);

      expect(recent.every((c) => c.status !== CommentStatus.DELETED)).toBe(true);
    });

    it('should only return accessible comments', async () => {
      // This test verifies permission filtering
      // Create comment that user can access
      await service.createComment(
        CommentableType.TRANSACTION,
        TEST_TRANSACTION_ID,
        'Accessible comment'
      );

      const recent = await service.getRecentComments(10);

      expect(recent.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Permission Tests
  // ============================================================================

  describe('permissions', () => {
    it('should allow comment creation with proper permissions', async () => {
      const result = await service.createComment(
        CommentableType.TRANSACTION,
        TEST_TRANSACTION_ID,
        'Authorized comment'
      );

      expect(result.comment).toBeDefined();
    });

    it('should enforce read permissions on getComments', async () => {
      // Create comment
      await service.createComment(
        CommentableType.TRANSACTION,
        TEST_TRANSACTION_ID,
        'Test comment'
      );

      // Try to read as user without permissions
      const restrictedService = createCommentsService(
        TEST_COMPANY_ID,
        'unauthorized-user',
        TEST_DEVICE_ID
      );

      await expect(
        restrictedService.getComments({
          company_id: TEST_COMPANY_ID,
          commentable_type: CommentableType.TRANSACTION,
          commentable_id: TEST_TRANSACTION_ID,
        })
      ).rejects.toThrow();
    });

    it('should enforce update permissions', async () => {
      const created = await service.createComment(
        CommentableType.TRANSACTION,
        TEST_TRANSACTION_ID,
        'Test comment'
      );

      // Remove update permission by creating restricted company user
      await db.companyUsers.update('cu-001', {
        permissions: ['transactions.read'], // Only read, no update
      });

      await expect(
        service.updateComment(created.comment.id, {
          content: 'Updated',
        })
      ).rejects.toThrow();
    });

    it('should enforce delete permissions', async () => {
      const created = await service.createComment(
        CommentableType.TRANSACTION,
        TEST_TRANSACTION_ID,
        'Test comment'
      );

      // Remove delete permission
      await db.companyUsers.update('cu-001', {
        permissions: ['transactions.read', 'transactions.update'], // No delete
      });

      await expect(service.deleteComment(created.comment.id)).rejects.toThrow();
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    it('should handle very long comment threads gracefully', async () => {
      // Create deeply nested thread (beyond max depth)
      let parentId = null;
      for (let i = 0; i < 10; i++) {
        const result = await service.createComment(
          CommentableType.TRANSACTION,
          TEST_TRANSACTION_ID,
          `Level ${i}`,
          { parentCommentId: parentId }
        );
        parentId = result.comment.id;
      }

      const threads = await service.buildCommentThread(
        CommentableType.TRANSACTION,
        TEST_TRANSACTION_ID,
        5
      );

      expect(threads).toBeDefined();
      expect(threads.length).toBeGreaterThan(0);
    });

    it('should handle special characters in comment content', async () => {
      const specialContent = 'Special chars: @#$%^&*() "quotes" \'apostrophes\' <html>';
      const result = await service.createComment(
        CommentableType.TRANSACTION,
        TEST_TRANSACTION_ID,
        specialContent
      );

      expect(result.comment.content).toBe(specialContent);
    });

    it('should handle multiple mentions of same user', async () => {
      const result = await service.createComment(
        CommentableType.TRANSACTION,
        TEST_TRANSACTION_ID,
        '@testuser2 please review. Hey @testuser2, did you see this?'
      );

      // Should only mention user once
      const uniqueMentions = [...new Set(result.comment.mentioned_user_ids)];
      expect(result.comment.mentioned_user_ids.length).toBe(uniqueMentions.length);
    });

    it('should handle concurrent! comment creation', async () => {
      // Create multiple comments simultaneously
      const promises = Array.from({ length: 10 }, (_, i) =>
        service.createComment(
          CommentableType.TRANSACTION,
          TEST_TRANSACTION_ID,
          `Concurrent! comment ${i}`
        )
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      // All should have unique IDs
      const ids = results.map((r) => r.comment.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(10);
    });

    it('should preserve comment order by creation time', async () => {
      const comments: Comment[] = [];

      for (let i = 0; i < 5; i++) {
        const result = await service.createComment(
          CommentableType.TRANSACTION,
          TEST_TRANSACTION_ID,
          `Comment ${i}`
        );
        comments.push(result.comment);
        // Small delay to ensure different timestamps
        await new Promise((resolve) => setTimeout(resolve, 5));
      }

      const retrieved = await service.getComments({
        company_id: TEST_COMPANY_ID,
        commentable_type: CommentableType.TRANSACTION,
        commentable_id: TEST_TRANSACTION_ID,
      });

      // Should be in chronological order
      for (let i = 1; i < retrieved.length; i++) {
        expect(retrieved[i]?.created_at ?? 0).toBeGreaterThanOrEqual(
          retrieved[i - 1]?.created_at ?? 0
        );
      }
    });
  });
});
