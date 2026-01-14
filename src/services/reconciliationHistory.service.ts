/**
 * Reconciliation History Service
 *
 * Provides CRUD operations for:
 * - Pattern learning (create, update, query patterns)
 * - Reconciliation history (save, retrieve records)
 * - Unreconciled transaction flagging
 * - Discrepancy resolution helpers
 *
 * Requirements:
 * - E1: Enhanced reconciliation history and pattern learning
 * - ACCT-004: Bank Reconciliation
 * - ARCH-002: Zero-Knowledge Encryption
 * - ARCH-004: CRDT-Compatible Design
 *
 * Communication Style: Steadiness (patient, supportive, step-by-step)
 */

import { nanoid } from 'nanoid';
import { db } from '../store/database';
import { logger } from '../utils/logger';
import { logCreate, logUpdate, logDelete } from '../store/auditLogs';
import { AuditEntityType } from '../types/database.types';
import type {
  ReconciliationPattern,
  ReconciliationRecord,
  ReconciliationHistorySummary,
  UnreconciledTransaction,
  UnreconciledDashboard,
  ReconciliationStreak,
  DiscrepancySuggestion,
  StatementTransaction,
} from '../types/reconciliation.types';
import { UnreconciledFlag, DiscrepancyPattern } from '../types/reconciliation.types';
import type { JournalEntry } from '../types';
import type { EncryptionContext, DatabaseResult } from '../store/types';
import {
  extractVendorFromDescription,
  normalizeVendorName,
  createDefaultReconciliationPattern,
  updatePatternConfidence,
  addDescriptionPattern,
  calculateAmountRange,
  calculateTypicalDayOfMonth,
} from '../db/schema/reconciliationPatterns.schema';

const serviceLogger = logger.child('ReconciliationHistory');

// =============================================================================
// Pattern Learning Operations
// =============================================================================

/**
 * Create a new reconciliation pattern
 */
export async function createPattern(
  companyId: string,
  vendorName: string,
  userId: string,
  context?: EncryptionContext
): Promise<DatabaseResult<ReconciliationPattern>> {
  try {
    const normalizedVendor = normalizeVendorName(vendorName);

    // Check if pattern already exists
    const existing = await db.reconciliation_patterns
      ?.where('[company_id+vendor_name]')
      .equals([companyId, normalizedVendor])
      .first();

    if (existing) {
      return {
        success: false,
        error: {
          code: 'CONSTRAINT_VIOLATION',
          message: `A pattern already exists for vendor: ${vendorName}`,
        },
      };
    }

    // Create new pattern
    const pattern: ReconciliationPattern = {
      id: nanoid(),
      ...createDefaultReconciliationPattern(companyId, normalizedVendor),
    } as ReconciliationPattern;

    // Store in database
    await db.reconciliation_patterns?.add(pattern);

    // Audit log
    await logCreate(
      companyId,
      userId,
      AuditEntityType.RECONCILIATION_PATTERN,
      pattern.id,
      {
        vendor_name: pattern.vendor_name,
        confidence: pattern.confidence,
      },
      context
    );

    serviceLogger.info('Created reconciliation pattern', {
      patternId: pattern.id,
      vendorName: normalizedVendor,
    });

    return { success: true, data: pattern };
  } catch (error) {
    serviceLogger.error('Failed to create pattern', { error, vendorName });
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Failed to create pattern',
        details: error,
      },
    };
  }
}

/**
 * Update an existing reconciliation pattern
 */
export async function updatePattern(
  patternId: string,
  updates: Partial<ReconciliationPattern>,
  userId: string,
  companyId: string,
  context?: EncryptionContext
): Promise<DatabaseResult<ReconciliationPattern>> {
  try {
    const existing = await db.reconciliation_patterns?.get(patternId);

    if (!existing) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Pattern not found: ${patternId}`,
        },
      };
    }

    // Create updated pattern
    const updated: ReconciliationPattern = {
      ...existing,
      ...updates,
      updated_at: Date.now(),
    };

    // Store in database
    await db.reconciliation_patterns?.put(updated);

    // Audit log
    const changedFields = Object.keys(updates);
    await logUpdate(
      companyId,
      userId,
      AuditEntityType.RECONCILIATION_PATTERN,
      patternId,
      existing as unknown as Record<string, unknown>,
      updated as unknown as Record<string, unknown>,
      changedFields,
      context
    );

    serviceLogger.info('Updated reconciliation pattern', {
      patternId,
      changedFields,
    });

    return { success: true, data: updated };
  } catch (error) {
    serviceLogger.error('Failed to update pattern', { error, patternId });
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Failed to update pattern',
        details: error,
      },
    };
  }
}

/**
 * Learn from a successful match and update pattern
 */
export async function learnFromMatch(
  companyId: string,
  statementTx: StatementTransaction,
  systemTx: JournalEntry,
  matchSuccessful: boolean,
  userId: string,
  context?: EncryptionContext
): Promise<DatabaseResult<ReconciliationPattern>> {
  try {
    // Extract vendor from statement description
    const vendorName = extractVendorFromDescription(statementTx.description);

    if (!vendorName) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Could not extract vendor name from transaction description',
        },
      };
    }

    const normalizedVendor = normalizeVendorName(vendorName);

    // Get or create pattern
    let pattern = await db.reconciliation_patterns
      ?.where('[company_id+vendor_name]')
      .equals([companyId, normalizedVendor])
      .first();

    if (!pattern) {
      // Create new pattern
      const createResult = await createPattern(companyId, vendorName, userId, context);
      if (!createResult.success) {
        return createResult;
      }
      pattern = createResult.data;
    }

    // Update pattern based on this match
    const updatedDescriptionPatterns = addDescriptionPattern(
      pattern.description_patterns,
      systemTx.memo || systemTx.reference || ''
    );

    const updatedConfidence = updatePatternConfidence(
      pattern.confidence,
      matchSuccessful,
      pattern.match_count
    );

    // Calculate amount range if we have enough data
    const historicalAmounts = [
      Math.abs(statementTx.amount),
      ...(pattern.typical_amount_range
        ? [pattern.typical_amount_range.min, pattern.typical_amount_range.max]
        : []),
    ];
    const updatedAmountRange = calculateAmountRange(historicalAmounts);

    // Calculate typical day of month
    const sysDate = systemTx.date instanceof Date ? systemTx.date.getTime() : systemTx.date;
    const historicalDates = [sysDate];
    const updatedTypicalDay = calculateTypicalDayOfMonth(historicalDates);

    // Update pattern
    return updatePattern(
      pattern.id,
      {
        description_patterns: updatedDescriptionPatterns,
        typical_amount_range: updatedAmountRange,
        typical_day_of_month: updatedTypicalDay,
        confidence: updatedConfidence,
        last_matched_at: Date.now(),
        match_count: pattern.match_count + 1,
      },
      userId,
      companyId,
      context
    );
  } catch (error) {
    serviceLogger.error('Failed to learn from match', { error });
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Failed to learn from match',
        details: error,
      },
    };
  }
}

/**
 * Get all patterns for a company
 */
export async function getPatterns(
  companyId: string
): Promise<DatabaseResult<ReconciliationPattern[]>> {
  try {
    const patterns = await db.reconciliation_patterns
      ?.where('company_id')
      .equals(companyId)
      .toArray();

    return { success: true, data: patterns || [] };
  } catch (error) {
    serviceLogger.error('Failed to get patterns', { error, companyId });
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get patterns',
        details: error,
      },
    };
  }
}

/**
 * Get pattern by vendor name
 */
export async function getPatternByVendor(
  companyId: string,
  vendorName: string
): Promise<DatabaseResult<ReconciliationPattern | null>> {
  try {
    const normalizedVendor = normalizeVendorName(vendorName);

    const pattern = await db.reconciliation_patterns
      ?.where('[company_id+vendor_name]')
      .equals([companyId, normalizedVendor])
      .first();

    return { success: true, data: pattern || null };
  } catch (error) {
    serviceLogger.error('Failed to get pattern by vendor', { error, vendorName });
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get pattern',
        details: error,
      },
    };
  }
}

/**
 * Delete a pattern (soft delete by marking as inactive)
 */
export async function deletePattern(
  patternId: string,
  userId: string,
  companyId: string,
  context?: EncryptionContext
): Promise<DatabaseResult<void>> {
  try {
    const existing = await db.reconciliation_patterns?.get(patternId);

    if (!existing) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Pattern not found: ${patternId}`,
        },
      };
    }

    // Remove from database
    await db.reconciliation_patterns?.delete(patternId);

    // Audit log
    await logDelete(companyId, userId, AuditEntityType.RECONCILIATION_PATTERN, patternId, existing as unknown as Record<string, unknown>, context);

    serviceLogger.info('Deleted reconciliation pattern', { patternId });

    return { success: true, data: undefined };
  } catch (error) {
    serviceLogger.error('Failed to delete pattern', { error, patternId });
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Failed to delete pattern',
        details: error,
      },
    };
  }
}

// =============================================================================
// Reconciliation History Operations
// =============================================================================

/**
 * Save a completed reconciliation record
 */
export async function saveReconciliationRecord(
  record: Omit<ReconciliationRecord, 'id' | 'created_at' | 'updated_at' | 'version_vector'>,
  userId: string,
  context?: EncryptionContext
): Promise<DatabaseResult<ReconciliationRecord>> {
  try {
    const now = Date.now();

    // Create full record
    const fullRecord: ReconciliationRecord = {
      ...record,
      id: nanoid(),
      created_at: now,
      updated_at: now,
      version_vector: { [userId]: 1 },
    };

    // Apply encryption if service provided
    let encryptedRecord = fullRecord;
    if (context?.encryptionService) {
      const { encryptionService } = context;
      encryptedRecord = {
        ...fullRecord,
        beginning_balance: await encryptionService.encrypt(
          fullRecord.beginning_balance.toString()
        ),
        ending_balance: await encryptionService.encrypt(fullRecord.ending_balance.toString()),
        calculated_balance: await encryptionService.encrypt(
          fullRecord.calculated_balance.toString()
        ),
        discrepancy: await encryptionService.encrypt(fullRecord.discrepancy.toString()),
        matched_transactions: await encryptionService.encrypt(
          JSON.stringify(fullRecord.matched_transactions)
        ),
        unmatched_statement_lines: await encryptionService.encrypt(
          JSON.stringify(fullRecord.unmatched_statement_lines)
        ),
        unmatched_book_transactions: await encryptionService.encrypt(
          JSON.stringify(fullRecord.unmatched_book_transactions)
        ),
        notes: fullRecord.notes ? await encryptionService.encrypt(fullRecord.notes) : null,
        reopened_reason: fullRecord.reopened_reason
          ? await encryptionService.encrypt(fullRecord.reopened_reason)
          : null,
      } as any;
    }

    // Store in database
    await db.reconciliation_records?.add(encryptedRecord as any);

    // Audit log
    await logCreate(
      record.company_id,
      userId,
      AuditEntityType.RECONCILIATION_RECORD,
      fullRecord.id,
      {
        account_id: fullRecord.account_id,
        status: fullRecord.status,
        reconciliation_date: fullRecord.reconciliation_date,
      },
      context
    );

    serviceLogger.info('Saved reconciliation record', {
      recordId: fullRecord.id,
      accountId: record.account_id,
      status: record.status,
    });

    return { success: true, data: fullRecord };
  } catch (error) {
    serviceLogger.error('Failed to save reconciliation record', { error });
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Failed to save reconciliation',
        details: error,
      },
    };
  }
}

/**
 * Get reconciliation record by ID
 */
export async function getReconciliationRecord(
  recordId: string,
  context?: EncryptionContext
): Promise<DatabaseResult<ReconciliationRecord>> {
  try {
    const record = await db.reconciliation_records?.get(recordId);

    if (!record) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Reconciliation record not found: ${recordId}`,
        },
      };
    }

    // Decrypt if service provided
    let decryptedRecord = record;
    if (context?.encryptionService) {
      const { encryptionService } = context;
      // Note: In database, encrypted fields are stored as strings but typed as their decrypted types
      const encrypted = record as any;
      decryptedRecord = {
        ...record,
        beginning_balance: parseFloat(await encryptionService.decrypt(encrypted.beginning_balance)),
        ending_balance: parseFloat(await encryptionService.decrypt(encrypted.ending_balance)),
        calculated_balance: parseFloat(await encryptionService.decrypt(encrypted.calculated_balance)),
        discrepancy: parseFloat(await encryptionService.decrypt(encrypted.discrepancy)),
        matched_transactions: JSON.parse(
          await encryptionService.decrypt(encrypted.matched_transactions)
        ),
        unmatched_statement_lines: JSON.parse(
          await encryptionService.decrypt(encrypted.unmatched_statement_lines)
        ),
        unmatched_book_transactions: JSON.parse(
          await encryptionService.decrypt(encrypted.unmatched_book_transactions)
        ),
        notes: encrypted.notes ? await encryptionService.decrypt(encrypted.notes) : null,
        reopened_reason: encrypted.reopened_reason
          ? await encryptionService.decrypt(encrypted.reopened_reason)
          : null,
      } as ReconciliationRecord;
    }

    return { success: true, data: decryptedRecord };
  } catch (error) {
    serviceLogger.error('Failed to get reconciliation record', { error, recordId });
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get reconciliation',
        details: error,
      },
    };
  }
}

/**
 * Get reconciliation history for an account
 */
export async function getAccountReconciliationHistory(
  companyId: string,
  accountId: string,
  context?: EncryptionContext
): Promise<DatabaseResult<ReconciliationHistorySummary[]>> {
  try {
    const records = await db.reconciliation_records
      ?.where('[company_id+account_id]')
      .equals([companyId, accountId])
      .reverse()
      .sortBy('reconciliation_date');

    if (!records) {
      return { success: true, data: [] };
    }

    // Convert to summaries (decrypt minimal data)
    const summaries: ReconciliationHistorySummary[] = [];

    for (const record of records) {
      let discrepancy = record.discrepancy as any;
      let matchedCount = 0;
      let unmatchedCount = 0;

      if (context?.encryptionService) {
        const { encryptionService } = context;
        const encrypted = record as any;
        discrepancy = parseFloat(await encryptionService.decrypt(encrypted.discrepancy));
        const matched = JSON.parse(await encryptionService.decrypt(encrypted.matched_transactions));
        const unmatchedStmt = JSON.parse(
          await encryptionService.decrypt(encrypted.unmatched_statement_lines)
        );
        const unmatchedBook = JSON.parse(
          await encryptionService.decrypt(encrypted.unmatched_book_transactions)
        );
        matchedCount = matched.length;
        unmatchedCount = unmatchedStmt.length + unmatchedBook.length;
      }

      summaries.push({
        id: record.id,
        account_id: record.account_id,
        account_name: 'Account', // Would need to fetch from accounts table
        reconciliation_date: record.reconciliation_date,
        statement_period: record.statement_period,
        status: record.status,
        discrepancy,
        matched_count: matchedCount,
        unmatched_count: unmatchedCount,
        user_name: 'User', // Would need to fetch from users table
      });
    }

    return { success: true, data: summaries };
  } catch (error) {
    serviceLogger.error('Failed to get account reconciliation history', { error, accountId });
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get history',
        details: error,
      },
    };
  }
}

/**
 * Get recent reconciliations across all accounts
 */
export async function getRecentReconciliations(
  companyId: string,
  limit: number = 10,
  context?: EncryptionContext
): Promise<DatabaseResult<ReconciliationHistorySummary[]>> {
  try {
    const records = await db.reconciliation_records
      ?.where('company_id')
      .equals(companyId)
      .reverse()
      .sortBy('reconciliation_date');

    if (!records) {
      return { success: true, data: [] };
    }

    const limited = records.slice(0, limit);

    // Convert to summaries
    const summaries: ReconciliationHistorySummary[] = [];

    for (const record of limited) {
      let discrepancy = record.discrepancy as any;
      let matchedCount = 0;
      let unmatchedCount = 0;

      if (context?.encryptionService) {
        const { encryptionService } = context;
        const encrypted = record as any;
        discrepancy = parseFloat(await encryptionService.decrypt(encrypted.discrepancy));
        const matched = JSON.parse(await encryptionService.decrypt(encrypted.matched_transactions));
        const unmatchedStmt = JSON.parse(
          await encryptionService.decrypt(encrypted.unmatched_statement_lines)
        );
        const unmatchedBook = JSON.parse(
          await encryptionService.decrypt(encrypted.unmatched_book_transactions)
        );
        matchedCount = matched.length;
        unmatchedCount = unmatchedStmt.length + unmatchedBook.length;
      }

      summaries.push({
        id: record.id,
        account_id: record.account_id,
        account_name: 'Account',
        reconciliation_date: record.reconciliation_date,
        statement_period: record.statement_period,
        status: record.status,
        discrepancy,
        matched_count: matchedCount,
        unmatched_count: unmatchedCount,
        user_name: 'User',
      });
    }

    return { success: true, data: summaries };
  } catch (error) {
    serviceLogger.error('Failed to get recent reconciliations', { error, companyId });
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get reconciliations',
        details: error,
      },
    };
  }
}

/**
 * Reopen a reconciliation
 */
export async function reopenReconciliation(
  recordId: string,
  reason: string,
  userId: string,
  companyId: string,
  context?: EncryptionContext
): Promise<DatabaseResult<ReconciliationRecord>> {
  try {
    const getResult = await getReconciliationRecord(recordId, context);

    if (!getResult.success) {
      return getResult;
    }

    const existing = getResult.data;

    // Update record
    const updated: ReconciliationRecord = {
      ...existing,
      status: 'reopened',
      reopened_at: Date.now(),
      reopened_by: userId,
      reopened_reason: reason,
      updated_at: Date.now(),
    };

    // Apply encryption if service provided
    let encryptedUpdate = updated;
    if (context?.encryptionService) {
      const { encryptionService } = context;
      encryptedUpdate = {
        ...updated,
        reopened_reason: await encryptionService.encrypt(reason),
      } as any;
    }

    await db.reconciliation_records?.put(encryptedUpdate as any);

    // Audit log
    await logUpdate(
      companyId,
      userId,
      AuditEntityType.RECONCILIATION_RECORD,
      recordId,
      existing as unknown as Record<string, unknown>,
      updated as unknown as Record<string, unknown>,
      ['status', 'reopened_at', 'reopened_by', 'reopened_reason'],
      context
    );

    serviceLogger.info('Reopened reconciliation', { recordId });

    return { success: true, data: updated };
  } catch (error) {
    serviceLogger.error('Failed to reopen reconciliation', { error, recordId });
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Failed to reopen reconciliation',
        details: error,
      },
    };
  }
}

// =============================================================================
// Unreconciled Transaction Flagging
// =============================================================================

/**
 * Calculate age-based flag for a transaction
 */
function calculateUnreconciledFlag(ageDays: number): UnreconciledFlag {
  if (ageDays <= 30) return UnreconciledFlag.NONE;
  if (ageDays <= 60) return UnreconciledFlag.WARNING;
  if (ageDays <= 90) return UnreconciledFlag.ATTENTION;
  return UnreconciledFlag.URGENT;
}

/**
 * Get unreconciled transactions for an account
 */
export async function getUnreconciledTransactions(
  companyId: string,
  accountId: string,
  _context?: EncryptionContext
): Promise<DatabaseResult<UnreconciledTransaction[]>> {
  try {
    // Get all transactions for the account that are not reconciled
    const transactions = await db.transactions
      .where('companyId')
      .equals(companyId)
      .and((tx) => {
        // Check if transaction involves this account
        const hasAccount = tx.lines?.some(
          (line) => line.accountId === accountId && (tx as any).status !== 'RECONCILED'
        );
        return hasAccount;
      })
      .toArray();

    const now = Date.now();
    const unreconciledList: UnreconciledTransaction[] = [];

    for (const tx of transactions) {
      const txDate = tx.date instanceof Date ? tx.date.getTime() : tx.date;
      const ageDays = Math.floor((now - txDate) / (1000 * 60 * 60 * 24));
      const flag = calculateUnreconciledFlag(ageDays);

      if (flag !== UnreconciledFlag.NONE) {
        // Calculate transaction amount
        let amount = 0;
        for (const line of tx.lines || []) {
          if (line.accountId === accountId) {
            amount += line.debit || -line.credit;
          }
        }

        unreconciledList.push({
          transaction_id: tx.id,
          transaction_date: txDate,
          age_days: ageDays,
          flag,
          account_id: accountId,
          amount,
          description: tx.memo || tx.reference || 'No description',
        });
      }
    }

    // Sort by age (oldest first)
    unreconciledList.sort((a, b) => b.age_days - a.age_days);

    serviceLogger.info('Retrieved unreconciled transactions', {
      accountId,
      count: unreconciledList.length,
    });

    return { success: true, data: unreconciledList };
  } catch (error) {
    serviceLogger.error('Failed to get unreconciled transactions', { error, accountId });
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message:
          error instanceof Error ? error.message : 'Failed to get unreconciled transactions',
        details: error,
      },
    };
  }
}

/**
 * Get unreconciled transaction dashboard data
 */
export async function getUnreconciledDashboard(
  companyId: string,
  context?: EncryptionContext
): Promise<DatabaseResult<UnreconciledDashboard>> {
  try {
    // Get all bank accounts (asset type includes cash and bank accounts)
    const accounts = await db.accounts
      .where('companyId')
      .equals(companyId)
      .and((acc) => acc.type === 'asset' && acc.isActive && !acc.deletedAt)
      .toArray();

    const dashboard: UnreconciledDashboard = {
      total_count: 0,
      by_flag: {
        warning: 0,
        attention: 0,
        urgent: 0,
      },
      by_account: [],
      oldest_transaction_age_days: 0,
    };

    for (const account of accounts) {
      const result = await getUnreconciledTransactions(companyId, account.id, context);

      if (result.success && result.data) {
        const accountData = result.data;

        dashboard.total_count += accountData.length;

        for (const tx of accountData) {
          if (tx.flag === UnreconciledFlag.WARNING) dashboard.by_flag.warning++;
          if (tx.flag === UnreconciledFlag.ATTENTION) dashboard.by_flag.attention++;
          if (tx.flag === UnreconciledFlag.URGENT) dashboard.by_flag.urgent++;

          if (tx.age_days > dashboard.oldest_transaction_age_days) {
            dashboard.oldest_transaction_age_days = tx.age_days;
          }
        }

        if (accountData.length > 0) {
          dashboard.by_account.push({
            account_id: account.id,
            account_name: account.name || 'Unnamed Account',
            count: accountData.length,
          });
        }
      }
    }

    serviceLogger.info('Generated unreconciled dashboard', {
      totalCount: dashboard.total_count,
    });

    return { success: true, data: dashboard };
  } catch (error) {
    serviceLogger.error('Failed to get unreconciled dashboard', { error, companyId });
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get dashboard',
        details: error,
      },
    };
  }
}

// =============================================================================
// Reconciliation Streak Tracking
// =============================================================================

/**
 * Get reconciliation streak for an account
 */
export async function getReconciliationStreak(
  companyId: string,
  accountId: string
): Promise<DatabaseResult<ReconciliationStreak>> {
  try {
    // Get all reconciliations for this account, sorted by date
    const records = await db.reconciliation_records
      ?.where('[company_id+account_id]')
      .equals([companyId, accountId])
      .sortBy('reconciliation_date');

    if (!records || records.length === 0) {
      // No reconciliations yet
      const streak: ReconciliationStreak = {
        company_id: companyId,
        account_id: accountId,
        current_streak: 0,
        best_streak: 0,
        last_reconciliation_date: 0,
        next_due_date: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days from now
        streak_status: 'broken',
        milestones_achieved: [],
      };

      return { success: true, data: streak };
    }

    // Calculate streaks
    let currentStreak = 0;
    let bestStreak = 0;
    let tempStreak = 0;
    const milestones: ReconciliationStreak['milestones_achieved'] = [];

    const lastRecord = records[records.length - 1];
    if (!lastRecord) {
      // This shouldn't happen since we checked records.length > 0, but handle it for type safety
      const streak: ReconciliationStreak = {
        company_id: companyId,
        account_id: accountId,
        current_streak: 0,
        best_streak: 0,
        last_reconciliation_date: 0,
        next_due_date: Date.now() + 30 * 24 * 60 * 60 * 1000,
        streak_status: 'broken',
        milestones_achieved: [],
      };
      return { success: true, data: streak };
    }

    const lastDate = lastRecord.reconciliation_date;
    const now = Date.now();
    const daysSinceLastReconciliation = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));

    // Check for consecutive months
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const nextRecord = records[i + 1];

      if (!record) continue;

      tempStreak++;

      if (nextRecord) {
        const monthsDiff = Math.floor(
          (nextRecord.reconciliation_date - record.reconciliation_date) / (1000 * 60 * 60 * 24 * 30)
        );

        // If next reconciliation is more than 2 months away, streak is broken
        if (monthsDiff > 2) {
          if (tempStreak > bestStreak) {
            bestStreak = tempStreak;
          }
          tempStreak = 0;
        }
      } else {
        // Last record
        if (tempStreak > bestStreak) {
          bestStreak = tempStreak;
        }
        // Current streak is only valid if last reconciliation was recent
        if (daysSinceLastReconciliation <= 45) {
          // 45 days grace period
          currentStreak = tempStreak;
        }
      }
    }

    // Check milestones
    const milestoneMonths = [3, 6, 12, 24];
    for (const months of milestoneMonths) {
      if (bestStreak >= months) {
        milestones.push({
          milestone: months as 3 | 6 | 12 | 24,
          achieved_at: lastDate,
        });
      }
    }

    // Determine streak status
    let streakStatus: ReconciliationStreak['streak_status'] = 'broken';
    if (currentStreak > 0) {
      if (daysSinceLastReconciliation <= 30) {
        streakStatus = 'active';
      } else if (daysSinceLastReconciliation <= 45) {
        streakStatus = 'at_risk';
      }
    }

    const streak: ReconciliationStreak = {
      company_id: companyId,
      account_id: accountId,
      current_streak: currentStreak,
      best_streak: bestStreak,
      last_reconciliation_date: lastDate,
      next_due_date: lastDate + 30 * 24 * 60 * 60 * 1000, // 30 days after last
      streak_status: streakStatus,
      milestones_achieved: milestones,
    };

    return { success: true, data: streak };
  } catch (error) {
    serviceLogger.error('Failed to get reconciliation streak', { error, accountId });
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get streak',
        details: error,
      },
    };
  }
}

// =============================================================================
// Discrepancy Resolution Helpers
// =============================================================================

/**
 * Analyze discrepancies and suggest resolutions
 */
export async function suggestDiscrepancyResolutions(
  _companyId: string,
  accountId: string,
  unmatchedStatementLines: StatementTransaction[],
  unmatchedBookTransactions: string[],
  _discrepancyAmount: number
): Promise<DatabaseResult<DiscrepancySuggestion[]>> {
  try {
    const suggestions: DiscrepancySuggestion[] = [];

    // Analyze unmatched statement lines for common patterns
    for (const stmt of unmatchedStatementLines) {
      const description = stmt.description.toLowerCase();
      const amount = stmt.amount;

      // Check for bank fees
      if (
        description.includes('fee') ||
        description.includes('charge') ||
        description.includes('service')
      ) {
        suggestions.push({
          pattern: DiscrepancyPattern.BANK_FEE,
          description: 'This looks like a bank fee that needs to be recorded in your books.',
          suggested_action:
            'You can add a transaction for this fee to bring your records into balance.',
          affected_transactions: [stmt.id],
          amount: amount,
          confidence: 85,
          auto_fixable: true,
          fix_action: {
            type: 'add_transaction',
            data: {
              description: stmt.description,
              amount: amount,
              type: 'bank_fee',
            },
          },
        });
      }

      // Check for interest
      if (description.includes('interest') || description.includes('dividend')) {
        suggestions.push({
          pattern: DiscrepancyPattern.INTEREST,
          description: 'This appears to be interest income that should be recorded.',
          suggested_action:
            'You can add a transaction for this interest to keep your records accurate.',
          affected_transactions: [stmt.id],
          amount: amount,
          confidence: 90,
          auto_fixable: true,
          fix_action: {
            type: 'add_transaction',
            data: {
              description: stmt.description,
              amount: amount,
              type: 'interest',
            },
          },
        });
      }
    }

    // Check for duplicates
    if (unmatchedStatementLines.length > 1) {
      for (let i = 0; i < unmatchedStatementLines.length; i++) {
        for (let j = i + 1; j < unmatchedStatementLines.length; j++) {
          const stmt1 = unmatchedStatementLines[i];
          const stmt2 = unmatchedStatementLines[j];

          if (stmt1 && stmt2 && Math.abs(stmt1.amount) === Math.abs(stmt2.amount)) {
            suggestions.push({
              pattern: DiscrepancyPattern.DUPLICATE,
              description: 'These transactions have the same amount and may be duplicates.',
              suggested_action:
                'Take a moment to review these carefully to ensure one isn\'t recorded twice.',
              affected_transactions: [stmt1.id, stmt2.id],
              amount: stmt1.amount,
              confidence: 60,
              auto_fixable: false,
            });
          }
        }
      }
    }

    // Check for outstanding checks (book transactions not on statement)
    if (unmatchedBookTransactions.length > 0) {
      const bookTransactions = await db.transactions
        .bulkGet(unmatchedBookTransactions)
        .then((txs) => txs.filter((tx) => tx !== undefined));

      for (const tx of bookTransactions) {
        const txDate = tx.date instanceof Date ? tx.date.getTime() : tx.date;
        const ageDays = Math.floor((Date.now() - txDate) / (1000 * 60 * 60 * 24));

        if (ageDays > 45 && ageDays <= 180) {
          suggestions.push({
            pattern: DiscrepancyPattern.OUTSTANDING_CHECK,
            description:
              'This check has been in your books for a while but hasn\'t cleared your bank yet.',
            suggested_action:
              'You might want to check if this check was lost or if the recipient hasn\'t cashed it.',
            affected_transactions: [tx.id],
            amount: 0,
            confidence: 70,
            auto_fixable: false,
          });
        }
      }
    }

    serviceLogger.info('Generated discrepancy suggestions', {
      accountId,
      suggestionCount: suggestions.length,
    });

    return { success: true, data: suggestions };
  } catch (error) {
    serviceLogger.error('Failed to suggest discrepancy resolutions', { error, accountId });
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Failed to generate suggestions',
        details: error,
      },
    };
  }
}

/**
 * Export service functions
 */
export const ReconciliationHistoryService = {
  // Pattern operations
  createPattern,
  updatePattern,
  learnFromMatch,
  getPatterns,
  getPatternByVendor,
  deletePattern,

  // History operations
  saveReconciliationRecord,
  getReconciliationRecord,
  getAccountReconciliationHistory,
  getRecentReconciliations,
  reopenReconciliation,

  // Unreconciled tracking
  getUnreconciledTransactions,
  getUnreconciledDashboard,

  // Streak tracking
  getReconciliationStreak,

  // Discrepancy resolution
  suggestDiscrepancyResolutions,
};
