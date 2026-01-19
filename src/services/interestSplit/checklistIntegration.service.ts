/**
 * Checklist Integration Service for Interest Splits
 *
 * Handles integration with the checklist system for deferred interest splits.
 *
 * Requirements:
 * - H7: Interest Split Prompt System
 * - CHECK-001: Checklist Integration
 */

import { nanoid } from 'nanoid';
import type { TreasureChestDB } from '../../db/database';
import type {
  LiabilityPaymentDetection,
  DeferredInterestSplitItem,
  InterestSplitPrompt,
  InterestSplitDecision,
} from '../../types/loanAmortization.types';
import type {
  ChecklistItem,
  ChecklistItemStatus,
} from '../../types/checklist.types';

/**
 * Checklist Integration Service
 */
export class ChecklistIntegrationService {
  private db: TreasureChestDB;

  constructor(db: TreasureChestDB) {
    this.db = db;
  }

  /**
   * Defer an interest split to the checklist
   */
  async deferToChecklist(
    detection: LiabilityPaymentDetection,
    companyId: string,
    userId: string,
    deviceId: string
  ): Promise<DeferredInterestSplitItem> {
    const now = Date.now();

    // Create deferred item
    const deferredItem: DeferredInterestSplitItem = {
      id: nanoid(),
      company_id: companyId,
      transaction_id: detection.transaction_id,
      detection,
      created_at: now,
      due_date: this.calculateDueDate(now), // End of month
      completed: false,
      completed_at: null,
      snoozed_until: null,
    };

    // Create corresponding checklist item
    const checklistItem = await this.createChecklistItem(
      deferredItem,
      companyId,
      userId,
      deviceId
    );

    // TODO: Save to database when deferred_interest_splits table exists
    // For now, we'll just create the checklist item

    return deferredItem;
  }

  /**
   * Create a checklist item for a deferred interest split
   */
  private async createChecklistItem(
    deferredItem: DeferredInterestSplitItem,
    companyId: string,
    userId: string,
    deviceId: string
  ): Promise<ChecklistItem> {
    const now = Date.now();

    const checklistItem: ChecklistItem = {
      id: nanoid(),
      categoryId: 'monthly',
      title: 'Split loan payment into principal and interest',
      description: this.generateChecklistDescription(deferredItem),
      explanationLevel: 'detailed',
      status: 'active' as ChecklistItemStatus,
      completedAt: null,
      snoozedUntil: null,
      snoozedReason: null,
      notApplicableReason: null,
      featureLink: `/transactions/${deferredItem.transaction_id}`,
      helpArticle: null,
      isCustom: false,
      isReordered: false,
      customOrder: null,
      recurrence: 'once',
      priority: 'medium',
      lastDueDate: null,
      nextDueDate: deferredItem.due_date ? new Date(deferredItem.due_date) : null,
      createdAt: new Date(now),
      updatedAt: new Date(now),
    };

    // TODO: Save to checklist_items table
    // For now, return the item

    return checklistItem;
  }

  /**
   * Generate description for checklist item
   */
  private generateChecklistDescription(
    deferredItem: DeferredInterestSplitItem
  ): string {
    const { detection } = deferredItem;
    const principal = detection.suggested_principal || 'TBD';
    const interest = detection.suggested_interest || 'TBD';

    return `Review transaction and split into principal ($${principal}) and interest ($${interest}) portions. This loan payment was detected with ${detection.confidence} confidence.`;
  }

  /**
   * Generate how-to-complete instructions
   */
  private generateHowToComplete(deferredItem: DeferredInterestSplitItem): string {
    return `1. Review the transaction to confirm it's a loan payment\n2. Verify the suggested principal and interest amounts\n3. Adjust amounts if needed\n4. Click "Split Payment" to create the journal entry\n5. The split will automatically reduce your loan balance and record interest expense`;
  }

  /**
   * Calculate due date (end of current month)
   */
  private calculateDueDate(timestamp: number): number {
    const date = new Date(timestamp);
    // Set to last day of the month
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    lastDay.setHours(23, 59, 59, 999);
    return lastDay.getTime();
  }

  /**
   * Mark a deferred item as completed
   */
  async completeDeferredItem(
    deferredItemId: string,
    checklistItemId: string
  ): Promise<void> {
    const now = Date.now();

    // TODO: Update deferred item in database
    // Set completed = true, completed_at = now

    // TODO: Update checklist item
    // Set status = 'completed', completedAt = new Date(now)
  }

  /**
   * Snooze a deferred item
   */
  async snoozeDeferredItem(
    deferredItemId: string,
    checklistItemId: string,
    snoozeUntil: number
  ): Promise<void> {
    // TODO: Update deferred item in database
    // Set snoozed_until = snoozeUntil

    // TODO: Update checklist item
    // Set snoozedUntil = new Date(snoozeUntil)
  }

  /**
   * Get all deferred items for a company
   */
  async getDeferredItems(companyId: string): Promise<DeferredInterestSplitItem[]> {
    // TODO: Query from database when table exists
    // For now, return empty array
    return [];
  }

  /**
   * Get deferred item by transaction ID
   */
  async getDeferredItemByTransaction(
    transactionId: string
  ): Promise<DeferredInterestSplitItem | null> {
    // TODO: Query from database when table exists
    // For now, return null
    return null;
  }

  /**
   * Delete a deferred item (when user skips permanently)
   */
  async deleteDeferredItem(
    deferredItemId: string,
    checklistItemId: string
  ): Promise<void> {
    // TODO: Soft delete from database
    // Set deleted_at timestamp

    // TODO: Update checklist item
    // Set status = 'not-applicable'
  }

  /**
   * Get statistics on deferred interest splits
   */
  async getDeferredItemStats(companyId: string): Promise<{
    total_deferred: number;
    completed: number;
    pending: number;
    snoozed: number;
    overdue: number;
  }> {
    const items = await this.getDeferredItems(companyId);
    const now = Date.now();

    return {
      total_deferred: items.length,
      completed: items.filter((item) => item.completed).length,
      pending: items.filter(
        (item) => !item.completed && (!item.snoozed_until || item.snoozed_until <= now)
      ).length,
      snoozed: items.filter(
        (item) => !item.completed && item.snoozed_until && item.snoozed_until > now
      ).length,
      overdue: items.filter(
        (item) =>
          !item.completed &&
          item.due_date &&
          item.due_date < now &&
          (!item.snoozed_until || item.snoozed_until <= now)
      ).length,
    };
  }
}
