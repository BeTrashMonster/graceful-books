/**
 * Duplicate Detection Service
 *
 * Detects potentially duplicate transactions using fuzzy matching.
 * Helps users avoid accidentally entering the same transaction twice.
 *
 * Requirements:
 * - I3: UX Efficiency Shortcuts [Nice]
 * - Smart similarity threshold for accurate detection
 * - Easy dismissal of false positives
 */

import Fuse from 'fuse.js';
import { format, differenceInDays } from 'date-fns';
import { db } from '../db/database';
import type { Transaction } from '../types/database.types';
import type { Invoice } from '../db/schema/invoices.schema';
import type { Bill } from '../db/schema/bills.schema';
import { logger } from '../utils/logger';

const serviceLogger = logger.child('DuplicateDetectionService');

/**
 * Duplicate candidate
 */
export interface DuplicateCandidate {
  id: string;
  entity_type: 'TRANSACTION' | 'INVOICE' | 'BILL';
  description: string;
  amount: string;
  date: number;
  vendor_customer?: string;
  similarity_score: number; // 0-1 where 1 is exact match
  days_apart: number;
  confidence_level: 'high' | 'medium' | 'low';
}

/**
 * Duplicate check input
 */
export interface DuplicateCheckInput {
  description: string;
  amount: string;
  date: number;
  vendor_customer?: string;
  entity_type: 'TRANSACTION' | 'INVOICE' | 'BILL';
}

/**
 * Duplicate detection options
 */
export interface DuplicateDetectionOptions {
  time_window_days?: number; // How many days to look back (default: 30)
  similarity_threshold?: number; // Minimum similarity score (default: 0.7)
  amount_tolerance?: number; // Percentage tolerance for amount (default: 0.01 = 1%)
  max_results?: number; // Maximum results to return (default: 5)
}

/**
 * Duplicate Detection Service Class
 */
export class DuplicateDetectionService {
  private companyId: string;

  // Configuration
  private readonly DEFAULT_TIME_WINDOW_DAYS = 30;
  private readonly DEFAULT_SIMILARITY_THRESHOLD = 0.7;
  private readonly DEFAULT_AMOUNT_TOLERANCE = 0.01; // 1%
  private readonly MAX_RESULTS = 5;

  constructor(companyId: string) {
    this.companyId = companyId;
  }

  /**
   * Check for potential duplicates
   */
  async checkForDuplicates(
    input: DuplicateCheckInput,
    options?: DuplicateDetectionOptions
  ): Promise<DuplicateCandidate[]> {
    try {
      const timeWindowDays = options?.time_window_days || this.DEFAULT_TIME_WINDOW_DAYS;
      const similarityThreshold = options?.similarity_threshold || this.DEFAULT_SIMILARITY_THRESHOLD;
      const amountTolerance = options?.amount_tolerance || this.DEFAULT_AMOUNT_TOLERANCE;
      const maxResults = options?.max_results || this.MAX_RESULTS;

      // Get recent records based on entity type
      const recentRecords = await this.getRecentRecords(input.entity_type, input.date, timeWindowDays);

      if (recentRecords.length === 0) {
        return [];
      }

      // Filter by amount first (most restrictive)
      const amountFiltered = this.filterByAmount(recentRecords, input.amount, amountTolerance);

      if (amountFiltered.length === 0) {
        return [];
      }

      // Use fuzzy search for description matching
      const fuse = new Fuse(amountFiltered, {
        keys: [
          { name: 'description', weight: 0.7 },
          { name: 'vendor_customer', weight: 0.3 },
        ],
        threshold: 1 - similarityThreshold, // Fuse uses 0=perfect, 1=no match
        includeScore: true,
        ignoreLocation: true,
      });

      // Search with description only - vendor_customer will be matched via weighted keys
      const fuzzyResults = fuse.search(input.description);

      // Convert to duplicate candidates
      const candidates: DuplicateCandidate[] = fuzzyResults
        .map((result) => {
          const record = result.item;
          const similarityScore = 1 - (result.score || 0); // Convert back to 0-1 where 1 is perfect
          const daysApart = Math.abs(differenceInDays(new Date(input.date), new Date(record.date)));

          return {
            id: record.id,
            entity_type: input.entity_type,
            description: record.description,
            amount: record.amount,
            date: record.date,
            vendor_customer: record.vendor_customer,
            similarity_score: similarityScore,
            days_apart: daysApart,
            confidence_level: this.getConfidenceLevel(similarityScore, daysApart),
          };
        })
        .filter((candidate) => candidate.similarity_score >= similarityThreshold)
        .sort((a, b) => {
          // Sort by confidence, then similarity, then recency
          const confidenceOrder = { high: 0, medium: 1, low: 2 };
          if (a.confidence_level !== b.confidence_level) {
            return confidenceOrder[a.confidence_level] - confidenceOrder[b.confidence_level];
          }
          if (a.similarity_score !== b.similarity_score) {
            return b.similarity_score - a.similarity_score;
          }
          return a.days_apart - b.days_apart;
        })
        .slice(0, maxResults);

      serviceLogger.info('Duplicate check completed', {
        companyId: this.companyId,
        entityType: input.entity_type,
        candidatesFound: candidates.length,
      });

      return candidates;
    } catch (error) {
      serviceLogger.error('Failed to check for duplicates', { error, input });
      return [];
    }
  }

  /**
   * Quick duplicate check (optimized for real-time suggestions)
   */
  async quickCheck(input: DuplicateCheckInput): Promise<DuplicateCandidate | null> {
    const candidates = await this.checkForDuplicates(input, {
      time_window_days: 7, // Only look back 1 week
      similarity_threshold: 0.85, // Higher threshold for quick check
      max_results: 1,
    });

    return candidates[0] || null;
  }

  /**
   * Get recent records based on entity type
   */
  private async getRecentRecords(
    entityType: 'TRANSACTION' | 'INVOICE' | 'BILL',
    fromDate: number,
    timeWindowDays: number
  ): Promise<Array<{
    id: string;
    description: string;
    amount: string;
    date: number;
    vendor_customer?: string;
  }>> {
    const cutoffDate = fromDate - timeWindowDays * 24 * 60 * 60 * 1000;

    try {
      if (entityType === 'TRANSACTION') {
        const transactions = await db.transactions
          .where('company_id')
          .equals(this.companyId)
          .and((t) => t.transaction_date >= cutoffDate && t.deleted_at === null)
          .toArray();

        return transactions.map((t) => ({
          id: t.id,
          description: t.description || '',
          amount: '0.00', // Would need to calculate from line items
          date: t.transaction_date,
        }));
      } else if (entityType === 'INVOICE') {
        const invoices = await db.invoices
          .where('company_id')
          .equals(this.companyId)
          .filter((i) => i.invoice_date >= cutoffDate && i.deleted_at === null)
          .toArray();

        // Get customer names
        const customerIds = [...new Set(invoices.map((i) => i.customer_id))];
        const customers = await db.contacts.bulkGet(customerIds);
        const customerMap = new Map(customers.filter((c) => c).map((c) => [c!.id, c!.name]));

        return invoices.map((i) => ({
          id: i.id,
          description: i.notes || '',
          amount: i.total,
          date: i.invoice_date,
          vendor_customer: customerMap.get(i.customer_id),
        }));
      } else if (entityType === 'BILL') {
        // Bills table may not exist yet, handle gracefully
        try {
          const bills = await db.table('bills')
            .where('company_id')
            .equals(this.companyId)
            .toArray();

          const filtered = bills.filter(
            (b: any) => b.bill_date >= cutoffDate && b.deleted_at === null
          );

          // Get vendor names
          const vendorIds = [...new Set(filtered.map((b: any) => b.vendor_id))];
          const vendors = await db.contacts.bulkGet(vendorIds);
          const vendorMap = new Map(vendors.filter((v) => v).map((v) => [v!.id, v!.name]));

          return filtered.map((b: any) => ({
            id: b.id,
            description: b.notes || '',
            amount: b.total,
            date: b.bill_date,
            vendor_customer: vendorMap.get(b.vendor_id),
          }));
        } catch (error) {
          serviceLogger.warn('Bills table not available', { error });
          return [];
        }
      }

      return [];
    } catch (error) {
      serviceLogger.error('Failed to get recent records', { error, entityType });
      return [];
    }
  }

  /**
   * Filter records by amount with tolerance
   */
  private filterByAmount(
    records: Array<{ amount: string }>,
    targetAmount: string,
    tolerance: number
  ): Array<any> {
    const target = parseFloat(targetAmount);
    const minAmount = target * (1 - tolerance);
    const maxAmount = target * (1 + tolerance);

    return records.filter((record) => {
      const amount = parseFloat(record.amount);
      return amount >= minAmount && amount <= maxAmount;
    });
  }

  /**
   * Determine confidence level based on similarity and time proximity
   */
  private getConfidenceLevel(
    similarityScore: number,
    daysApart: number
  ): 'high' | 'medium' | 'low' {
    // High confidence: very similar and within 7 days
    if (similarityScore >= 0.9 && daysApart <= 7) {
      return 'high';
    }

    // Medium confidence: similar and within 14 days, or very similar but older
    if (
      (similarityScore >= 0.8 && daysApart <= 14) ||
      (similarityScore >= 0.9 && daysApart <= 30)
    ) {
      return 'medium';
    }

    // Low confidence: everything else
    return 'low';
  }

  /**
   * Format duplicate message for display
   */
  formatDuplicateMessage(candidate: DuplicateCandidate): string {
    const dateStr = format(new Date(candidate.date), 'MMM d, yyyy');
    const daysAgo = candidate.days_apart === 0 ? 'today' : `${candidate.days_apart} days ago`;

    if (candidate.vendor_customer) {
      return `This looks similar to ${candidate.vendor_customer} - ${candidate.description} (${candidate.amount}) from ${daysAgo} (${dateStr})`;
    }

    return `This looks similar to ${candidate.description} (${candidate.amount}) from ${daysAgo} (${dateStr})`;
  }

  /**
   * Get user-friendly confidence message
   */
  getConfidenceMessage(confidenceLevel: 'high' | 'medium' | 'low'): string {
    const messages = {
      high: 'This is very likely a duplicate.',
      medium: 'This might be a duplicate.',
      low: 'This could be similar to an existing entry.',
    };

    return messages[confidenceLevel];
  }
}

/**
 * Create duplicate detection service instance
 */
export function createDuplicateDetectionService(companyId: string): DuplicateDetectionService {
  return new DuplicateDetectionService(companyId);
}
