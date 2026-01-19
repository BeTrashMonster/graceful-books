/**
 * Mentions Service
 *
 * Handles @mention parsing, validation, and routing for comments.
 * Creates mentions, sends notifications, and optionally creates checklist items.
 *
 * Requirements:
 * - I2: Activity Feed & Communication
 * - Parse @mentions from comment text
 * - Validate mentioned users exist and have access
 * - Create mention records and notifications
 * - Optionally create checklist items from @mentions
 * - ARCH-002: Zero-Knowledge Encryption
 */

import { nanoid } from 'nanoid';
import { db } from '../db/database';
import { createDefaultMention, validateMention } from '../db/schema/comments.schema';
import type { Mention, CommentableType } from '../db/schema/comments.schema';
import type { CompanyUser } from '../types/database.types';
import { logger } from '../utils/logger';

const serviceLogger = logger.child('MentionsService');

/**
 * Parsed mention from comment text
 */
export interface ParsedMention {
  username: string; // Username without @
  startIndex: number; // Start position in text
  endIndex: number; // End position in text
}

/**
 * Validated mention with user info
 */
export interface ValidatedMention extends ParsedMention {
  userId: string; // User ID
  userName: string; // Full name
  hasAccess: boolean; // Whether user has access to entity
}

/**
 * Options for creating mentions
 */
export interface CreateMentionsOptions {
  createChecklistItem?: boolean; // Create checklist item for mention
  checklistItemTitle?: string; // Custom checklist title
  notifyImmediately?: boolean; // Send notification immediately
}

/**
 * Result of creating mentions
 */
export interface CreateMentionsResult {
  mentions: Mention[]; // Created mention records
  notifications: string[]; // Notification IDs created
  checklistItems: string[]; // Checklist item IDs created
  errors: string[]; // Any errors encountered
}

/**
 * Mentions Service Class
 */
export class MentionsService {
  private companyId: string;
  private deviceId: string;

  constructor(companyId: string, deviceId: string) {
    this.companyId = companyId;
    this.deviceId = deviceId;
  }

  /**
   * Parse @mentions from comment text
   * Supports formats: @username, @user.name, @user_name
   */
  parseMentions(text: string): ParsedMention[] {
    const mentions: ParsedMention[] = [];

    // Regex to match @username (alphanumeric, dots, underscores, hyphens)
    // Must start with letter, can contain letters, numbers, dots, underscores, hyphens
    // Must end with alphanumeric (not special char)
    const mentionRegex = /@([a-zA-Z][a-zA-Z0-9._-]*[a-zA-Z0-9])/g;

    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
      mentions.push({
        username: match[1],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    }

    // Remove duplicates (same username mentioned multiple times)
    const uniqueMentions = mentions.filter(
      (mention, index, self) =>
        index === self.findIndex((m) => m.username === mention.username)
    );

    serviceLogger.debug('Parsed mentions from text', {
      text,
      mentionsCount: uniqueMentions.length,
      usernames: uniqueMentions.map((m) => m.username),
    });

    return uniqueMentions;
  }

  /**
   * Validate mentions against company users
   * Checks if mentioned users exist and have access to the entity
   */
  async validateMentions(
    mentions: ParsedMention[],
    commentableType: CommentableType,
    commentableId: string
  ): Promise<ValidatedMention[]> {
    try {
      // Get all company users
      const companyUsers = await db.companyUsers
        .where('company_id')
        .equals(this.companyId)
        .and((cu) => cu.active === true && cu.deleted_at === null)
        .toArray();

      // Get user details
      const userIds = companyUsers.map((cu) => cu.user_id);
      const users = await db.users
        .where('id')
        .anyOf(userIds)
        .and((user) => user.deleted_at === null)
        .toArray();

      // Create username to user mapping (lowercase for case-insensitive matching)
      const usernameMap = new Map<string, { userId: string; userName: string; companyUser: CompanyUser }>();

      users.forEach((user) => {
        // Extract username from email (before @)
        const username = user.email.split('@')[0].toLowerCase();
        const companyUser = companyUsers.find((cu) => cu.user_id === user.id);

        if (companyUser) {
          usernameMap.set(username, {
            userId: user.id,
            userName: user.name,
            companyUser,
          });
        }
      });

      // Validate each mention
      const validatedMentions: ValidatedMention[] = [];

      for (const mention of mentions) {
        const usernameLower = mention.username.toLowerCase();
        const userInfo = usernameMap.get(usernameLower);

        if (!userInfo) {
          serviceLogger.warn('Mention username not found', {
            username: mention.username,
            companyId: this.companyId,
          });
          continue;
        }

        // Check if user has access to the entity
        const hasAccess = await this.checkEntityAccess(
          userInfo.companyUser,
          commentableType,
          commentableId
        );

        validatedMentions.push({
          ...mention,
          userId: userInfo.userId,
          userName: userInfo.userName,
          hasAccess,
        });
      }

      serviceLogger.info('Validated mentions', {
        totalMentions: mentions.length,
        validMentions: validatedMentions.length,
        invalidMentions: mentions.length - validatedMentions.length,
      });

      return validatedMentions;
    } catch (error) {
      serviceLogger.error('Failed to validate mentions', { error });
      throw error;
    }
  }

  /**
   * Check if user has access to entity
   * Based on role permissions and entity type
   */
  private async checkEntityAccess(
    companyUser: CompanyUser,
    commentableType: CommentableType,
    commentableId: string
  ): Promise<boolean> {
    try {
      // For now, check basic read permissions
      // In real implementation, would check specific entity permissions

      const permissionMap: Record<CommentableType, string> = {
        TRANSACTION: 'transactions.read',
        INVOICE: 'contacts.read',
        BILL: 'contacts.read',
        CHECKLIST_ITEM: 'accounts.read', // Anyone can see checklists
        JOURNAL_ENTRY: 'transactions.read',
        RECEIPT: 'transactions.read',
        CONTACT: 'contacts.read',
        PRODUCT: 'products.read',
      };

      const requiredPermission = permissionMap[commentableType];
      const hasPermission = companyUser.permissions.includes(requiredPermission);

      return hasPermission;
    } catch (error) {
      serviceLogger.error('Failed to check entity access', { error });
      return false; // Default to no access on error
    }
  }

  /**
   * Create mentions for a comment
   * Validates mentions, creates records, sends notifications, and optionally creates checklist items
   */
  async createMentions(
    commentId: string,
    commentText: string,
    authorUserId: string,
    commentableType: CommentableType,
    commentableId: string,
    options: CreateMentionsOptions = {}
  ): Promise<CreateMentionsResult> {
    const result: CreateMentionsResult = {
      mentions: [],
      notifications: [],
      checklistItems: [],
      errors: [],
    };

    try {
      // Parse mentions from text
      const parsedMentions = this.parseMentions(commentText);

      if (parsedMentions.length === 0) {
        return result; // No mentions found
      }

      // Validate mentions
      const validatedMentions = await this.validateMentions(
        parsedMentions,
        commentableType,
        commentableId
      );

      // Create mention records
      for (const validatedMention of validatedMentions) {
        try {
          // Don't create mention if user doesn't have access
          if (!validatedMention.hasAccess) {
            result.errors.push(
              `User @${validatedMention.username} does not have access to this ${commentableType.toLowerCase()}`
            );
            continue;
          }

          // Don't create self-mentions
          if (validatedMention.userId === authorUserId) {
            continue;
          }

          // Create mention record
          const mentionId = nanoid();
          const mention = createDefaultMention(
            this.companyId,
            commentId,
            validatedMention.userId,
            authorUserId,
            commentableType,
            commentableId,
            this.deviceId
          );

          await db.mentions.add({
            ...mention,
            id: mentionId,
          } as Mention);

          result.mentions.push({ ...mention, id: mentionId } as Mention);

          // Create notification
          // (NotificationsService will handle this in integration)
          // For now, just track that we need to create one
          result.notifications.push(validatedMention.userId);

          // Create checklist item if requested
          if (options.createChecklistItem) {
            const checklistItemId = await this.createChecklistItemForMention(
              validatedMention.userId,
              commentId,
              commentableType,
              commentableId,
              options.checklistItemTitle
            );

            if (checklistItemId) {
              result.checklistItems.push(checklistItemId);
            }
          }

          serviceLogger.info('Created mention', {
            mentionId,
            mentionedUserId: validatedMention.userId,
            mentioningUserId: authorUserId,
            commentId,
          });
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push(`Failed to create mention for @${validatedMention.username}: ${errorMsg}`);
          serviceLogger.error('Failed to create individual mention', {
            username: validatedMention.username,
            error,
          });
        }
      }

      serviceLogger.info('Created mentions for comment', {
        commentId,
        mentionsCreated: result.mentions.length,
        notificationsScheduled: result.notifications.length,
        checklistItemsCreated: result.checklistItems.length,
        errors: result.errors.length,
      });

      return result;
    } catch (error) {
      serviceLogger.error('Failed to create mentions', { error });
      throw error;
    }
  }

  /**
   * Create checklist item from mention
   * Optional feature: create actionable checklist item when mentioned
   */
  private async createChecklistItemForMention(
    assignedUserId: string,
    commentId: string,
    commentableType: CommentableType,
    commentableId: string,
    customTitle?: string
  ): Promise<string | null> {
    try {
      // Get entity details for context
      const entityName = await this.getEntityName(commentableType, commentableId);

      // Generate checklist item title
      const title = customTitle || `Review ${commentableType.toLowerCase()} ${entityName}`;
      const description = `You were mentioned in a comment. Please review and respond.`;

      // Create checklist item
      // (This would integrate with ChecklistService in full implementation)
      // For now, just return a placeholder
      serviceLogger.debug('Would create checklist item', {
        assignedUserId,
        commentId,
        title,
      });

      // Return placeholder ID
      return nanoid();
    } catch (error) {
      serviceLogger.error('Failed to create checklist item for mention', { error });
      return null;
    }
  }

  /**
   * Get human-readable entity name for context
   */
  private async getEntityName(
    commentableType: CommentableType,
    commentableId: string
  ): Promise<string> {
    try {
      switch (commentableType) {
        case 'TRANSACTION': {
          const transaction = await db.transactions.get(commentableId);
          return transaction?.transaction_number || `#${commentableId.slice(0, 8)}`;
        }
        case 'INVOICE': {
          const invoice = await db.invoices.get(commentableId);
          return invoice?.invoice_number || `#${commentableId.slice(0, 8)}`;
        }
        case 'BILL': {
          // TODO: Add bills table when implemented
          // const bill = await db.bills.get(commentableId);
          // return bill?.bill_number || `#${commentableId.slice(0, 8)}`;
          return `Bill #${commentableId.slice(0, 8)}`;
        }
        case 'CHECKLIST_ITEM': {
          // TODO: Add checklistItems table when implemented
          // const item = await db.checklistItems.get(commentableId);
          // return item?.title || `Item #${commentableId.slice(0, 8)}`;
          return `Item #${commentableId.slice(0, 8)}`;
        }
        default:
          return `#${commentableId.slice(0, 8)}`;
      }
    } catch (error) {
      return `#${commentableId.slice(0, 8)}`;
    }
  }

  /**
   * Get mentions for a user
   */
  async getMentionsForUser(
    userId: string,
    options: {
      unreadOnly?: boolean;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<Mention[]> {
    try {
      let query = db.mentions
        .where('mentioned_user_id')
        .equals(userId);

      // Filter by company, deleted status, and optionally read status
      if (options.unreadOnly) {
        query = query.and((mention) =>
          mention.company_id === this.companyId &&
          mention.deleted_at === null &&
          mention.read_at === null
        );
      } else {
        query = query.and((mention) =>
          mention.company_id === this.companyId &&
          mention.deleted_at === null
        );
      }

      if (options.offset) {
        query = query.offset(options.offset);
      }

      if (options.limit) {
        query = query.limit(options.limit);
      }

      const mentions = await query
        .reverse() // Most recent first
        .sortBy('created_at');

      return mentions;
    } catch (error) {
      serviceLogger.error('Failed to get mentions for user', { error, userId });
      throw error;
    }
  }

  /**
   * Get unread mention count for user
   */
  async getUnreadMentionCount(userId: string): Promise<number> {
    try {
      const count = await db.mentions
        .where('mentioned_user_id')
        .equals(userId)
        .and((mention) =>
          mention.company_id === this.companyId &&
          mention.deleted_at === null &&
          mention.read_at === null
        )
        .count();

      return count;
    } catch (error) {
      serviceLogger.error('Failed to get unread mention count', { error, userId });
      throw error;
    }
  }

  /**
   * Mark mention as read
   */
  async markMentionAsRead(mentionId: string): Promise<void> {
    try {
      const mention = await db.mentions.get(mentionId);

      if (!mention) {
        throw new Error(`Mention ${mentionId} not found`);
      }

      if (mention.company_id !== this.companyId) {
        throw new Error('Mention does not belong to this company');
      }

      await db.mentions.update(mentionId, {
        read_at: Date.now(),
        updated_at: Date.now(),
        version_vector: {
          ...mention.version_vector,
          [this.deviceId]: (mention.version_vector[this.deviceId] || 0) + 1,
        },
      });

      serviceLogger.info('Marked mention as read', { mentionId });
    } catch (error) {
      serviceLogger.error('Failed to mark mention as read', { error, mentionId });
      throw error;
    }
  }

  /**
   * Mark all mentions as read for user
   */
  async markAllMentionsAsRead(userId: string): Promise<number> {
    try {
      const unreadMentions = await db.mentions
        .where('mentioned_user_id')
        .equals(userId)
        .and((mention) =>
          mention.company_id === this.companyId &&
          mention.deleted_at === null &&
          mention.read_at === null
        )
        .toArray();

      const now = Date.now();

      await Promise.all(
        unreadMentions.map((mention) =>
          db.mentions.update(mention.id, {
            read_at: now,
            updated_at: now,
            version_vector: {
              ...mention.version_vector,
              [this.deviceId]: (mention.version_vector[this.deviceId] || 0) + 1,
            },
          })
        )
      );

      serviceLogger.info('Marked all mentions as read', {
        userId,
        count: unreadMentions.length,
      });

      return unreadMentions.length;
    } catch (error) {
      serviceLogger.error('Failed to mark all mentions as read', { error, userId });
      throw error;
    }
  }

  /**
   * Get mention statistics for user
   */
  async getMentionStats(userId: string): Promise<{
    total: number;
    unread: number;
    readRate: number;
  }> {
    try {
      const allMentions = await db.mentions
        .where('mentioned_user_id')
        .equals(userId)
        .and((mention) => mention.company_id === this.companyId && mention.deleted_at === null)
        .toArray();

      const total = allMentions.length;
      const unread = allMentions.filter((m) => m.read_at === null).length;
      const readRate = total > 0 ? ((total - unread) / total) * 100 : 0;

      return {
        total,
        unread,
        readRate: Math.round(readRate * 10) / 10, // Round to 1 decimal
      };
    } catch (error) {
      serviceLogger.error('Failed to get mention stats', { error, userId });
      throw error;
    }
  }
}

/**
 * Factory function to create MentionsService instance
 */
export const createMentionsService = (companyId: string, deviceId: string): MentionsService => {
  return new MentionsService(companyId, deviceId);
};
