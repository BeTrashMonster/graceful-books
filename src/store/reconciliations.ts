/**
 * Reconciliations Data Access Layer
 *
 * Provides CRUD operations for bank reconciliations with:
 * - Statement parsing and storage
 * - Transaction matching
 * - CRDT version vector management
 * - Encryption integration points
 */

import { db } from './database';
import type {
  ReconciliationEntity,
  DatabaseResult,
  DatabaseError,
} from './types';
import type {
  ParsedStatement,
  TransactionMatch,
} from '../types/reconciliation.types';
import { logger } from '../utils/logger';
import { ErrorCode } from '../utils/errors';
import { getDeviceId, generateId } from '../utils/device';
import { incrementVersionVector as incrementVV } from '../utils/versionVector';

/**
 * Create a new reconciliation
 */
export async function createReconciliation(data: {
  companyId: string;
  accountId: string;
  statement: ParsedStatement;
  isFirstReconciliation: boolean;
}): Promise<DatabaseResult<ReconciliationEntity>> {
  try {
    const now = new Date();
    const deviceId = getDeviceId();

    // Calculate opening and closing balances
    const openingBalance = data.statement.openingBalance || 0;
    const closingBalance = data.statement.closingBalance || 0;

    const reconciliation: ReconciliationEntity = {
      id: generateId(),
      companyId: data.companyId,
      accountId: data.accountId,
      statementPeriodStart: new Date(data.statement.statementPeriod.startDate),
      statementPeriodEnd: new Date(data.statement.statementPeriod.endDate),
      openingBalance,
      closingBalance,
      status: 'DRAFT',
      statementData: JSON.stringify(data.statement), // Should be encrypted
      matchedTransactions: JSON.stringify([]), // Should be encrypted
      unmatchedStatementItems: JSON.stringify(
        data.statement.transactions.map(t => t.id)
      ), // Should be encrypted
      unmatchedSystemItems: JSON.stringify([]), // Should be encrypted
      discrepancy: 0,
      isFirstReconciliation: data.isFirstReconciliation,
      completedAt: undefined,
      notes: undefined,
      createdAt: now,
      updatedAt: now,
      versionVector: { [deviceId]: 1 },
      lastModifiedBy: deviceId,
      lastModifiedAt: now,
      deletedAt: undefined,
      _encrypted: {
        statementData: true,
        matchedTransactions: true,
        unmatchedStatementItems: true,
        unmatchedSystemItems: true,
        notes: true,
      },
    };

    await db.reconciliations.add(reconciliation);

    logger.info('Created reconciliation', { id: reconciliation.id });

    return {
      success: true,
      data: reconciliation,
    };
  } catch (error) {
    logger.error('Error creating reconciliation:', error);

    return {
      success: false,
      error: {
        code: ErrorCode.UNKNOWN_ERROR,
        message: 'We had trouble starting this reconciliation. Please try again.',
        details: error,
      } as DatabaseError,
    };
  }
}

/**
 * Update reconciliation with matches
 */
export async function updateReconciliationMatches(
  id: string,
  matches: TransactionMatch[],
  unmatchedStatementIds: string[],
  unmatchedSystemIds: string[]
): Promise<DatabaseResult<ReconciliationEntity>> {
  try {
    const reconciliation = await db.reconciliations.get(id);

    if (!reconciliation) {
      return {
        success: false,
        error: {
          code: ErrorCode.NOT_FOUND,
          message: 'Reconciliation not found',
        } as DatabaseError,
      };
    }

    const now = new Date();
    const deviceId = getDeviceId();

    const updated: ReconciliationEntity = {
      ...reconciliation,
      matchedTransactions: JSON.stringify(matches), // Should be encrypted
      unmatchedStatementItems: JSON.stringify(unmatchedStatementIds), // Should be encrypted
      unmatchedSystemItems: JSON.stringify(unmatchedSystemIds), // Should be encrypted
      updatedAt: now,
      versionVector: incrementVV(reconciliation.versionVector),
      lastModifiedBy: deviceId,
      lastModifiedAt: now,
    };

    await db.reconciliations.put(updated);

    logger.info('Updated reconciliation matches', {
      id,
      matchedCount: matches.length,
    });

    return {
      success: true,
      data: updated,
    };
  } catch (error) {
    logger.error('Error updating reconciliation matches:', error);

    return {
      success: false,
      error: {
        code: ErrorCode.UNKNOWN_ERROR,
        message: 'We had trouble saving your matches. Please try again.',
        details: error,
      } as DatabaseError,
    };
  }
}

/**
 * Complete a reconciliation
 */
export async function completeReconciliation(
  id: string,
  discrepancy: number,
  notes?: string
): Promise<DatabaseResult<ReconciliationEntity>> {
  try {
    const reconciliation = await db.reconciliations.get(id);

    if (!reconciliation) {
      return {
        success: false,
        error: {
          code: ErrorCode.NOT_FOUND,
          message: 'Reconciliation not found',
        } as DatabaseError,
      };
    }

    const now = new Date();
    const deviceId = getDeviceId();

    const updated: ReconciliationEntity = {
      ...reconciliation,
      status: 'COMPLETED',
      discrepancy,
      notes,
      completedAt: now,
      updatedAt: now,
      versionVector: incrementVV(reconciliation.versionVector),
      lastModifiedBy: deviceId,
      lastModifiedAt: now,
    };

    await db.reconciliations.put(updated);

    logger.info('Completed reconciliation', { id, discrepancy });

    return {
      success: true,
      data: updated,
    };
  } catch (error) {
    logger.error('Error completing reconciliation:', error);

    return {
      success: false,
      error: {
        code: ErrorCode.UNKNOWN_ERROR,
        message: 'We had trouble completing this reconciliation. Please try again.',
        details: error,
      } as DatabaseError,
    };
  }
}

/**
 * Get reconciliation by ID
 */
export async function getReconciliation(
  id: string
): Promise<DatabaseResult<ReconciliationEntity>> {
  try {
    const reconciliation = await db.reconciliations.get(id);

    if (!reconciliation || reconciliation.deletedAt) {
      return {
        success: false,
        error: {
          code: ErrorCode.NOT_FOUND,
          message: 'Reconciliation not found',
        } as DatabaseError,
      };
    }

    return {
      success: true,
      data: reconciliation,
    };
  } catch (error) {
    logger.error('Error getting reconciliation:', error);

    return {
      success: false,
      error: {
        code: ErrorCode.UNKNOWN_ERROR,
        message: 'We had trouble loading this reconciliation.',
        details: error,
      } as DatabaseError,
    };
  }
}

/**
 * Get all reconciliations for an account
 */
export async function getReconciliationsByAccount(
  companyId: string,
  accountId: string
): Promise<DatabaseResult<ReconciliationEntity[]>> {
  try {
    const reconciliations = await db.reconciliations
      .where('[companyId+accountId]')
      .equals([companyId, accountId])
      .and(r => !r.deletedAt)
      .reverse()
      .sortBy('statementPeriodEnd');

    return {
      success: true,
      data: reconciliations,
    };
  } catch (error) {
    logger.error('Error getting reconciliations by account:', error);

    return {
      success: false,
      error: {
        code: ErrorCode.UNKNOWN_ERROR,
        message: 'We had trouble loading reconciliations.',
        details: error,
      } as DatabaseError,
    };
  }
}

/**
 * Check if user has completed any reconciliations
 */
export async function hasCompletedReconciliation(
  companyId: string
): Promise<boolean> {
  try {
    const count = await db.reconciliations
      .where('[companyId+status]')
      .equals([companyId, 'COMPLETED'])
      .and(r => !r.deletedAt)
      .count();

    return count > 0;
  } catch (error) {
    logger.error('Error checking for completed reconciliations:', error);
    return false;
  }
}

/**
 * Soft delete reconciliation
 */
export async function deleteReconciliation(
  id: string
): Promise<DatabaseResult<void>> {
  try {
    const reconciliation = await db.reconciliations.get(id);

    if (!reconciliation) {
      return {
        success: false,
        error: {
          code: ErrorCode.NOT_FOUND,
          message: 'Reconciliation not found',
        } as DatabaseError,
      };
    }

    const now = new Date();
    const deviceId = getDeviceId();

    const updated: ReconciliationEntity = {
      ...reconciliation,
      deletedAt: now,
      updatedAt: now,
      versionVector: incrementVV(reconciliation.versionVector),
      lastModifiedBy: deviceId,
      lastModifiedAt: now,
    };

    await db.reconciliations.put(updated);

    logger.info('Deleted reconciliation', { id });

    return {
      success: true,
      data: undefined,
    };
  } catch (error) {
    logger.error('Error deleting reconciliation:', error);

    return {
      success: false,
      error: {
        code: ErrorCode.UNKNOWN_ERROR,
        message: 'We had trouble deleting this reconciliation.',
        details: error,
      } as DatabaseError,
    };
  }
}
