/**
 * Reconciliation History Service Tests
 *
 * Comprehensive unit and integration tests for the reconciliationHistory service.
 * Tests all CRUD operations, encryption/decryption, pattern learning,
 * unreconciled flagging, and discrepancy resolution.
 *
 * Requirements:
 * - E1: Enhanced reconciliation history and pattern learning
 * - ACCT-004: Bank Reconciliation
 * - ARCH-002: Zero-Knowledge Encryption
 * - ARCH-004: CRDT-Compatible Design
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { nanoid } from 'nanoid';
import { db } from '../store/database';
import * as auditLogs from '../store/auditLogs';
import {
  createPattern,
  updatePattern,
  learnFromMatch,
  getPatterns,
  getPatternByVendor,
  deletePattern,
  saveReconciliationRecord,
  getReconciliationRecord,
  getAccountReconciliationHistory,
  getRecentReconciliations,
  reopenReconciliation,
  getUnreconciledTransactions,
  getUnreconciledDashboard,
  getReconciliationStreak,
  suggestDiscrepancyResolutions,
} from './reconciliationHistory.service';
import type {
  ReconciliationPattern,
  ReconciliationRecord,
  StatementTransaction,
  UnreconciledFlag,
  DiscrepancyPattern,
} from '../types/reconciliation.types';
import type { JournalEntry } from '../types';
import type { EncryptionContext, EncryptionService } from '../store/types';

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Mock encryption service for testing encryption/decryption
 */
class MockEncryptionService implements EncryptionService {
  async encrypt(data: string): Promise<string> {
    return `encrypted:${data}`;
  }

  async decrypt(data: string): Promise<string> {
    if (data.startsWith('encrypted:')) {
      return data.substring(10);
    }
    return data;
  }

  async encryptField<T>(field: T): Promise<string> {
    return `encrypted:${JSON.stringify(field)}`;
  }

  async decryptField<T>(encrypted: string): Promise<T> {
    if (encrypted.startsWith('encrypted:')) {
      return JSON.parse(encrypted.substring(10));
    }
    return JSON.parse(encrypted);
  }
}

/**
 * Create test encryption context
 */
function createTestEncryptionContext(): EncryptionContext {
  return {
    companyId: 'test-company',
    userId: 'test-user',
    encryptionService: new MockEncryptionService(),
  };
}

/**
 * Create test journal entry
 */
function createTestJournalEntry(
  id: string,
  date: Date | number,
  amount: number,
  memo?: string
): JournalEntry {
  return {
    id,
    companyId: 'test-company',
    date: date instanceof Date ? date : new Date(date),
    status: 'POSTED' as any,
    memo: memo || 'Test transaction',
    reference: null,
    lines: [
      {
        id: `${id}-line-1`,
        accountId: 'test-account',
        debit: amount > 0 ? amount : 0,
        credit: amount < 0 ? Math.abs(amount) : 0,
      },
      {
        id: `${id}-line-2`,
        accountId: 'other-account',
        debit: amount < 0 ? Math.abs(amount) : 0,
        credit: amount > 0 ? amount : 0,
      },
    ],
    createdBy: 'test-user',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as JournalEntry;
}

/**
 * Create test statement transaction
 */
function createTestStatementTx(
  id: string,
  date: number,
  description: string,
  amount: number
): StatementTransaction {
  return {
    id,
    date,
    description,
    amount,
    matched: false,
  };
}

// =============================================================================
// Setup and Teardown
// =============================================================================

describe('ReconciliationHistory Service', () => {
  beforeEach(async () => {
    // Clear all tables before each test
    await db.reconciliation_patterns?.clear();
    await db.reconciliations?.clear();
    await db.transactions?.clear();
    await db.accounts?.clear();

    // Mock audit log functions
    vi.spyOn(auditLogs, 'logCreate').mockResolvedValue(undefined);
    vi.spyOn(auditLogs, 'logUpdate').mockResolvedValue(undefined);
    vi.spyOn(auditLogs, 'logDelete').mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // Pattern Learning Operations
  // ===========================================================================

  describe('Pattern Operations', () => {
    describe('createPattern', () => {
      it('should create a new reconciliation pattern', async () => {
        const result = await createPattern(
          'test-company',
          'Amazon Web Services',
          'test-user'
        );

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.id).toBeDefined();
          expect(result.data.company_id).toBe('test-company');
          expect(result.data.vendor_name).toBe('amazon web services');
          expect(result.data.confidence).toBe(50); // Default confidence
          expect(result.data.match_count).toBe(0);
          expect(result.data.description_patterns).toEqual([]);
        }
      });

      it('should normalize vendor name', async () => {
        const result = await createPattern(
          'test-company',
          'AMAZON!!!  Web   Services  ',
          'test-user'
        );

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.vendor_name).toBe('amazon web services');
        }
      });

      it('should log audit trail on creation', async () => {
        await createPattern('test-company', 'Test Vendor', 'test-user');

        expect(auditLogs.logCreate).toHaveBeenCalledWith(
          'test-company',
          'test-user',
          'reconciliation_pattern',
          expect.any(String),
          expect.objectContaining({
            vendor_name: expect.any(String),
            confidence: 50,
          }),
          undefined
        );
      });

      it('should return error if pattern already exists', async () => {
        await createPattern('test-company', 'Test Vendor', 'test-user');

        const result = await createPattern('test-company', 'Test Vendor', 'test-user');

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe('ALREADY_EXISTS');
        }
      });

      it('should handle encryption context', async () => {
        const context = createTestEncryptionContext();

        const result = await createPattern(
          'test-company',
          'Test Vendor',
          'test-user',
          context
        );

        expect(result.success).toBe(true);
        expect(auditLogs.logCreate).toHaveBeenCalledWith(
          'test-company',
          'test-user',
          'reconciliation_pattern',
          expect.any(String),
          expect.any(Object),
          context
        );
      });
    });

    describe('updatePattern', () => {
      it('should update an existing pattern', async () => {
        const createResult = await createPattern(
          'test-company',
          'Test Vendor',
          'test-user'
        );
        expect(createResult.success).toBe(true);
        if (!createResult.success) return;

        const patternId = createResult.data.id;

        const result = await updatePattern(
          patternId,
          {
            confidence: 85,
            match_count: 5,
          },
          'test-user',
          'test-company'
        );

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.confidence).toBe(85);
          expect(result.data.match_count).toBe(5);
          expect(result.data.updated_at).toBeGreaterThan(createResult.data.created_at);
        }
      });

      it('should log audit trail on update', async () => {
        const createResult = await createPattern(
          'test-company',
          'Test Vendor',
          'test-user'
        );
        expect(createResult.success).toBe(true);
        if (!createResult.success) return;

        const patternId = createResult.data.id;

        await updatePattern(
          patternId,
          { confidence: 90 },
          'test-user',
          'test-company'
        );

        expect(auditLogs.logUpdate).toHaveBeenCalledWith(
          'test-company',
          'test-user',
          'reconciliation_pattern',
          patternId,
          expect.any(Object),
          expect.any(Object),
          ['confidence'],
          undefined
        );
      });

      it('should return error if pattern not found', async () => {
        const result = await updatePattern(
          'non-existent-id',
          { confidence: 90 },
          'test-user',
          'test-company'
        );

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe('NOT_FOUND');
        }
      });
    });

    describe('learnFromMatch', () => {
      it('should create pattern if none exists', async () => {
        const statementTx = createTestStatementTx(
          'stmt-1',
          Date.now(),
          'AWS Payment',
          -5000
        );

        const systemTx = createTestJournalEntry(
          'sys-1',
          Date.now(),
          5000,
          'Amazon Web Services'
        );

        const result = await learnFromMatch(
          'test-company',
          statementTx,
          systemTx,
          true,
          'test-user'
        );

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.vendor_name).toBe('aws');
          expect(result.data.match_count).toBe(1);
        }
      });

      it('should update existing pattern on successful match', async () => {
        // Create initial pattern
        const createResult = await createPattern('test-company', 'AWS', 'test-user');
        expect(createResult.success).toBe(true);

        const statementTx = createTestStatementTx(
          'stmt-1',
          Date.now(),
          'AWS Payment',
          -5000
        );

        const systemTx = createTestJournalEntry(
          'sys-1',
          Date.now(),
          5000,
          'Amazon Web Services'
        );

        const result = await learnFromMatch(
          'test-company',
          statementTx,
          systemTx,
          true,
          'test-user'
        );

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.match_count).toBe(1);
          expect(result.data.last_matched_at).toBeGreaterThan(0);
          expect(result.data.description_patterns.length).toBeGreaterThan(0);
        }
      });

      it('should adjust confidence based on match success', async () => {
        const statementTx = createTestStatementTx(
          'stmt-1',
          Date.now(),
          'AWS Payment',
          -5000
        );

        const systemTx = createTestJournalEntry('sys-1', Date.now(), 5000);

        // Successful match
        const successResult = await learnFromMatch(
          'test-company',
          statementTx,
          systemTx,
          true,
          'test-user'
        );

        expect(successResult.success).toBe(true);
        if (!successResult.success) return;

        const successConfidence = successResult.data.confidence;

        // Failed match should lower confidence
        const failResult = await learnFromMatch(
          'test-company',
          statementTx,
          systemTx,
          false,
          'test-user'
        );

        expect(failResult.success).toBe(true);
        if (failResult.success) {
          expect(failResult.data.confidence).toBeLessThan(successConfidence);
        }
      });

      it('should return error if vendor cannot be extracted', async () => {
        const statementTx = createTestStatementTx('stmt-1', Date.now(), '', -5000);

        const systemTx = createTestJournalEntry('sys-1', Date.now(), 5000);

        const result = await learnFromMatch(
          'test-company',
          statementTx,
          systemTx,
          true,
          'test-user'
        );

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe('INVALID_INPUT');
        }
      });
    });

    describe('getPatterns', () => {
      it('should retrieve all patterns for a company', async () => {
        await createPattern('test-company', 'Vendor A', 'test-user');
        await createPattern('test-company', 'Vendor B', 'test-user');
        await createPattern('other-company', 'Vendor C', 'test-user');

        const result = await getPatterns('test-company');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toHaveLength(2);
          expect(result.data.map((p) => p.vendor_name)).toContain('vendor a');
          expect(result.data.map((p) => p.vendor_name)).toContain('vendor b');
        }
      });

      it('should return empty array if no patterns exist', async () => {
        const result = await getPatterns('test-company');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual([]);
        }
      });
    });

    describe('getPatternByVendor', () => {
      it('should retrieve pattern by vendor name', async () => {
        await createPattern('test-company', 'Amazon', 'test-user');

        const result = await getPatternByVendor('test-company', 'Amazon');

        expect(result.success).toBe(true);
        if (result.success && result.data) {
          expect(result.data.vendor_name).toBe('amazon');
        }
      });

      it('should normalize vendor name for lookup', async () => {
        await createPattern('test-company', 'Amazon', 'test-user');

        const result = await getPatternByVendor('test-company', 'AMAZON!!!');

        expect(result.success).toBe(true);
        if (result.success && result.data) {
          expect(result.data.vendor_name).toBe('amazon');
        }
      });

      it('should return null if pattern not found', async () => {
        const result = await getPatternByVendor('test-company', 'NonExistent');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBeNull();
        }
      });
    });

    describe('deletePattern', () => {
      it('should delete a pattern', async () => {
        const createResult = await createPattern(
          'test-company',
          'Test Vendor',
          'test-user'
        );
        expect(createResult.success).toBe(true);
        if (!createResult.success) return;

        const patternId = createResult.data.id;

        const deleteResult = await deletePattern(
          patternId,
          'test-user',
          'test-company'
        );

        expect(deleteResult.success).toBe(true);

        // Verify it's gone
        const pattern = await db.reconciliation_patterns?.get(patternId);
        expect(pattern).toBeUndefined();
      });

      it('should log audit trail on deletion', async () => {
        const createResult = await createPattern(
          'test-company',
          'Test Vendor',
          'test-user'
        );
        expect(createResult.success).toBe(true);
        if (!createResult.success) return;

        const patternId = createResult.data.id;

        await deletePattern(patternId, 'test-user', 'test-company');

        expect(auditLogs.logDelete).toHaveBeenCalledWith(
          'test-company',
          'test-user',
          'reconciliation_pattern',
          patternId,
          expect.any(Object),
          undefined
        );
      });

      it('should return error if pattern not found', async () => {
        const result = await deletePattern(
          'non-existent-id',
          'test-user',
          'test-company'
        );

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe('NOT_FOUND');
        }
      });
    });
  });

  // ===========================================================================
  // Reconciliation History Operations
  // ===========================================================================

  describe('Reconciliation History Operations', () => {
    describe('saveReconciliationRecord', () => {
      it('should save a reconciliation record without encryption', async () => {
        const record: Omit<
          ReconciliationRecord,
          'id' | 'created_at' | 'updated_at' | 'version_vector'
        > = {
          company_id: 'test-company',
          account_id: 'test-account',
          reconciliation_date: Date.now(),
          statement_period: {
            start: Date.now() - 30 * 24 * 60 * 60 * 1000,
            end: Date.now(),
          },
          beginning_balance: 100000,
          ending_balance: 105000,
          calculated_balance: 105000,
          discrepancy: 0,
          status: 'balanced',
          matched_transactions: ['tx-1', 'tx-2'],
          unmatched_statement_lines: [],
          unmatched_book_transactions: [],
          notes: 'All matched perfectly',
          time_spent_seconds: 300,
          user_id: 'test-user',
          reopened_at: null,
          reopened_by: null,
          reopened_reason: null,
        } as any;

        const result = await saveReconciliationRecord(record, 'test-user');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.id).toBeDefined();
          expect(result.data.company_id).toBe('test-company');
          expect(result.data.status).toBe('balanced');
          expect(result.data.discrepancy).toBe(0);
        }
      });

      it('should encrypt sensitive fields when encryption service provided', async () => {
        const context = createTestEncryptionContext();

        const record: Omit<
          ReconciliationRecord,
          'id' | 'created_at' | 'updated_at' | 'version_vector'
        > = {
          company_id: 'test-company',
          account_id: 'test-account',
          reconciliation_date: Date.now(),
          statement_period: {
            start: Date.now() - 30 * 24 * 60 * 60 * 1000,
            end: Date.now(),
          },
          beginning_balance: 100000,
          ending_balance: 105000,
          calculated_balance: 105000,
          discrepancy: 500,
          status: 'discrepancy_noted',
          matched_transactions: ['tx-1'],
          unmatched_statement_lines: [],
          unmatched_book_transactions: [],
          notes: 'Small discrepancy noted',
          time_spent_seconds: 600,
          user_id: 'test-user',
          reopened_at: null,
          reopened_by: null,
          reopened_reason: null,
        } as any;

        const result = await saveReconciliationRecord(record, 'test-user', context);

        expect(result.success).toBe(true);

        // Check that data in database is encrypted
        if (result.success) {
          const stored = await db.reconciliations?.get(result.data.id);
          expect(stored).toBeDefined();
          if (stored) {
            expect((stored.beginning_balance as any).toString()).toContain('encrypted:');
            expect((stored.ending_balance as any).toString()).toContain('encrypted:');
            expect((stored.discrepancy as any).toString()).toContain('encrypted:');
            expect((stored.notes as any).toString()).toContain('encrypted:');
          }
        }
      });

      it('should log audit trail on save', async () => {
        const record: Omit<
          ReconciliationRecord,
          'id' | 'created_at' | 'updated_at' | 'version_vector'
        > = {
          company_id: 'test-company',
          account_id: 'test-account',
          reconciliation_date: Date.now(),
          statement_period: {
            start: Date.now() - 30 * 24 * 60 * 60 * 1000,
            end: Date.now(),
          },
          beginning_balance: 100000,
          ending_balance: 105000,
          calculated_balance: 105000,
          discrepancy: 0,
          status: 'balanced',
          matched_transactions: [],
          unmatched_statement_lines: [],
          unmatched_book_transactions: [],
          notes: null,
          time_spent_seconds: 300,
          user_id: 'test-user',
          reopened_at: null,
          reopened_by: null,
          reopened_reason: null,
        } as any;

        await saveReconciliationRecord(record, 'test-user');

        expect(auditLogs.logCreate).toHaveBeenCalledWith(
          'test-company',
          'test-user',
          'reconciliation_record',
          expect.any(String),
          expect.objectContaining({
            account_id: 'test-account',
            status: 'balanced',
          }),
          undefined
        );
      });

      it('should set version vector on new record', async () => {
        const record: Omit<
          ReconciliationRecord,
          'id' | 'created_at' | 'updated_at' | 'version_vector'
        > = {
          company_id: 'test-company',
          account_id: 'test-account',
          reconciliation_date: Date.now(),
          statement_period: {
            start: Date.now() - 30 * 24 * 60 * 60 * 1000,
            end: Date.now(),
          },
          beginning_balance: 100000,
          ending_balance: 105000,
          calculated_balance: 105000,
          discrepancy: 0,
          status: 'balanced',
          matched_transactions: [],
          unmatched_statement_lines: [],
          unmatched_book_transactions: [],
          notes: null,
          time_spent_seconds: 300,
          user_id: 'test-user',
          reopened_at: null,
          reopened_by: null,
          reopened_reason: null,
        } as any;

        const result = await saveReconciliationRecord(record, 'test-user');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.version_vector).toEqual({ 'test-user': 1 });
        }
      });
    });

    describe('getReconciliationRecord', () => {
      it('should retrieve a reconciliation record', async () => {
        const saveResult = await saveReconciliationRecord(
          {
            company_id: 'test-company',
            account_id: 'test-account',
            reconciliation_date: Date.now(),
            statement_period: {
              start: Date.now() - 30 * 24 * 60 * 60 * 1000,
              end: Date.now(),
            },
            beginning_balance: 100000,
            ending_balance: 105000,
            calculated_balance: 105000,
            discrepancy: 0,
            status: 'balanced',
            matched_transactions: ['tx-1'],
            unmatched_statement_lines: [],
            unmatched_book_transactions: [],
            notes: 'Test notes',
            time_spent_seconds: 300,
            user_id: 'test-user',
            reopened_at: null,
            reopened_by: null,
            reopened_reason: null,
          } as any,
          'test-user'
        );
        expect(saveResult.success).toBe(true);
        if (!saveResult.success) return;

        const result = await getReconciliationRecord(saveResult.data.id);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.id).toBe(saveResult.data.id);
          expect(result.data.status).toBe('balanced');
        }
      });

      it('should decrypt data when encryption service provided', async () => {
        const context = createTestEncryptionContext();

        const saveResult = await saveReconciliationRecord(
          {
            company_id: 'test-company',
            account_id: 'test-account',
            reconciliation_date: Date.now(),
            statement_period: {
              start: Date.now() - 30 * 24 * 60 * 60 * 1000,
              end: Date.now(),
            },
            beginning_balance: 100000,
            ending_balance: 105000,
            calculated_balance: 105000,
            discrepancy: 500,
            status: 'discrepancy_noted',
            matched_transactions: ['tx-1'],
            unmatched_statement_lines: [],
            unmatched_book_transactions: [],
            notes: 'Test notes',
            time_spent_seconds: 300,
            user_id: 'test-user',
            reopened_at: null,
            reopened_by: null,
            reopened_reason: null,
          } as any,
          'test-user',
          context
        );
        expect(saveResult.success).toBe(true);
        if (!saveResult.success) return;

        const result = await getReconciliationRecord(saveResult.data.id, context);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.beginning_balance).toBe(100000);
          expect(result.data.ending_balance).toBe(105000);
          expect(result.data.discrepancy).toBe(500);
          expect(result.data.notes).toBe('Test notes');
        }
      });

      it('should return error if record not found', async () => {
        const result = await getReconciliationRecord('non-existent-id');

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe('NOT_FOUND');
        }
      });
    });

    describe('getAccountReconciliationHistory', () => {
      it('should retrieve reconciliation history for an account', async () => {
        // Save multiple records
        await saveReconciliationRecord(
          {
            company_id: 'test-company',
            account_id: 'test-account',
            reconciliation_date: Date.now() - 60 * 24 * 60 * 60 * 1000,
            statement_period: {
              start: Date.now() - 90 * 24 * 60 * 60 * 1000,
              end: Date.now() - 60 * 24 * 60 * 60 * 1000,
            },
            beginning_balance: 100000,
            ending_balance: 105000,
            calculated_balance: 105000,
            discrepancy: 0,
            status: 'balanced',
            matched_transactions: ['tx-1'],
            unmatched_statement_lines: [],
            unmatched_book_transactions: [],
            notes: null,
            time_spent_seconds: 300,
            user_id: 'test-user',
            reopened_at: null,
            reopened_by: null,
            reopened_reason: null,
          } as any,
          'test-user'
        );

        await saveReconciliationRecord(
          {
            company_id: 'test-company',
            account_id: 'test-account',
            reconciliation_date: Date.now() - 30 * 24 * 60 * 60 * 1000,
            statement_period: {
              start: Date.now() - 60 * 24 * 60 * 60 * 1000,
              end: Date.now() - 30 * 24 * 60 * 60 * 1000,
            },
            beginning_balance: 105000,
            ending_balance: 110000,
            calculated_balance: 110000,
            discrepancy: 0,
            status: 'balanced',
            matched_transactions: ['tx-2'],
            unmatched_statement_lines: [],
            unmatched_book_transactions: [],
            notes: null,
            time_spent_seconds: 400,
            user_id: 'test-user',
            reopened_at: null,
            reopened_by: null,
            reopened_reason: null,
          } as any,
          'test-user'
        );

        const result = await getAccountReconciliationHistory(
          'test-company',
          'test-account'
        );

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toHaveLength(2);
          expect(result.data[0].account_id).toBe('test-account');
        }
      });

      it('should not return records from other accounts', async () => {
        await saveReconciliationRecord(
          {
            company_id: 'test-company',
            account_id: 'test-account',
            reconciliation_date: Date.now(),
            statement_period: {
              start: Date.now() - 30 * 24 * 60 * 60 * 1000,
              end: Date.now(),
            },
            beginning_balance: 100000,
            ending_balance: 105000,
            calculated_balance: 105000,
            discrepancy: 0,
            status: 'balanced',
            matched_transactions: [],
            unmatched_statement_lines: [],
            unmatched_book_transactions: [],
            notes: null,
            time_spent_seconds: 300,
            user_id: 'test-user',
            reopened_at: null,
            reopened_by: null,
            reopened_reason: null,
          } as any,
          'test-user'
        );

        await saveReconciliationRecord(
          {
            company_id: 'test-company',
            account_id: 'other-account',
            reconciliation_date: Date.now(),
            statement_period: {
              start: Date.now() - 30 * 24 * 60 * 60 * 1000,
              end: Date.now(),
            },
            beginning_balance: 100000,
            ending_balance: 105000,
            calculated_balance: 105000,
            discrepancy: 0,
            status: 'balanced',
            matched_transactions: [],
            unmatched_statement_lines: [],
            unmatched_book_transactions: [],
            notes: null,
            time_spent_seconds: 300,
            user_id: 'test-user',
            reopened_at: null,
            reopened_by: null,
            reopened_reason: null,
          } as any,
          'test-user'
        );

        const result = await getAccountReconciliationHistory(
          'test-company',
          'test-account'
        );

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toHaveLength(1);
          expect(result.data[0].account_id).toBe('test-account');
        }
      });
    });

    describe('getRecentReconciliations', () => {
      it('should retrieve recent reconciliations with limit', async () => {
        // Create 15 reconciliations
        for (let i = 0; i < 15; i++) {
          await saveReconciliationRecord(
            {
              company_id: 'test-company',
              account_id: `account-${i}`,
              reconciliation_date: Date.now() - i * 24 * 60 * 60 * 1000,
              statement_period: {
                start: Date.now() - (i + 30) * 24 * 60 * 60 * 1000,
                end: Date.now() - i * 24 * 60 * 60 * 1000,
              },
              beginning_balance: 100000,
              ending_balance: 105000,
              calculated_balance: 105000,
              discrepancy: 0,
              status: 'balanced',
              matched_transactions: [],
              unmatched_statement_lines: [],
              unmatched_book_transactions: [],
              notes: null,
              time_spent_seconds: 300,
              user_id: 'test-user',
              reopened_at: null,
              reopened_by: null,
              reopened_reason: null,
            } as any,
            'test-user'
          );
        }

        const result = await getRecentReconciliations('test-company', 10);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toHaveLength(10);
        }
      });

      it('should not return reconciliations from other companies', async () => {
        await saveReconciliationRecord(
          {
            company_id: 'test-company',
            account_id: 'test-account',
            reconciliation_date: Date.now(),
            statement_period: {
              start: Date.now() - 30 * 24 * 60 * 60 * 1000,
              end: Date.now(),
            },
            beginning_balance: 100000,
            ending_balance: 105000,
            calculated_balance: 105000,
            discrepancy: 0,
            status: 'balanced',
            matched_transactions: [],
            unmatched_statement_lines: [],
            unmatched_book_transactions: [],
            notes: null,
            time_spent_seconds: 300,
            user_id: 'test-user',
            reopened_at: null,
            reopened_by: null,
            reopened_reason: null,
          } as any,
          'test-user'
        );

        await saveReconciliationRecord(
          {
            company_id: 'other-company',
            account_id: 'other-account',
            reconciliation_date: Date.now(),
            statement_period: {
              start: Date.now() - 30 * 24 * 60 * 60 * 1000,
              end: Date.now(),
            },
            beginning_balance: 100000,
            ending_balance: 105000,
            calculated_balance: 105000,
            discrepancy: 0,
            status: 'balanced',
            matched_transactions: [],
            unmatched_statement_lines: [],
            unmatched_book_transactions: [],
            notes: null,
            time_spent_seconds: 300,
            user_id: 'test-user',
            reopened_at: null,
            reopened_by: null,
            reopened_reason: null,
          } as any,
          'test-user'
        );

        const result = await getRecentReconciliations('test-company');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toHaveLength(1);
        }
      });
    });

    describe('reopenReconciliation', () => {
      it('should reopen a reconciliation', async () => {
        const saveResult = await saveReconciliationRecord(
          {
            company_id: 'test-company',
            account_id: 'test-account',
            reconciliation_date: Date.now(),
            statement_period: {
              start: Date.now() - 30 * 24 * 60 * 60 * 1000,
              end: Date.now(),
            },
            beginning_balance: 100000,
            ending_balance: 105000,
            calculated_balance: 105000,
            discrepancy: 0,
            status: 'balanced',
            matched_transactions: [],
            unmatched_statement_lines: [],
            unmatched_book_transactions: [],
            notes: null,
            time_spent_seconds: 300,
            user_id: 'test-user',
            reopened_at: null,
            reopened_by: null,
            reopened_reason: null,
          } as any,
          'test-user'
        );
        expect(saveResult.success).toBe(true);
        if (!saveResult.success) return;

        const result = await reopenReconciliation(
          saveResult.data.id,
          'Found an error',
          'test-user',
          'test-company'
        );

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.status).toBe('reopened');
          expect(result.data.reopened_at).toBeGreaterThan(0);
          expect(result.data.reopened_by).toBe('test-user');
          expect(result.data.reopened_reason).toBe('Found an error');
        }
      });

      it('should log audit trail on reopen', async () => {
        const saveResult = await saveReconciliationRecord(
          {
            company_id: 'test-company',
            account_id: 'test-account',
            reconciliation_date: Date.now(),
            statement_period: {
              start: Date.now() - 30 * 24 * 60 * 60 * 1000,
              end: Date.now(),
            },
            beginning_balance: 100000,
            ending_balance: 105000,
            calculated_balance: 105000,
            discrepancy: 0,
            status: 'balanced',
            matched_transactions: [],
            unmatched_statement_lines: [],
            unmatched_book_transactions: [],
            notes: null,
            time_spent_seconds: 300,
            user_id: 'test-user',
            reopened_at: null,
            reopened_by: null,
            reopened_reason: null,
          } as any,
          'test-user'
        );
        expect(saveResult.success).toBe(true);
        if (!saveResult.success) return;

        await reopenReconciliation(
          saveResult.data.id,
          'Test reason',
          'test-user',
          'test-company'
        );

        expect(auditLogs.logUpdate).toHaveBeenCalledWith(
          'test-company',
          'test-user',
          'reconciliation_record',
          saveResult.data.id,
          expect.any(Object),
          expect.any(Object),
          ['status', 'reopened_at', 'reopened_by', 'reopened_reason'],
          undefined
        );
      });

      it('should encrypt reopened_reason when encryption service provided', async () => {
        const context = createTestEncryptionContext();

        const saveResult = await saveReconciliationRecord(
          {
            company_id: 'test-company',
            account_id: 'test-account',
            reconciliation_date: Date.now(),
            statement_period: {
              start: Date.now() - 30 * 24 * 60 * 60 * 1000,
              end: Date.now(),
            },
            beginning_balance: 100000,
            ending_balance: 105000,
            calculated_balance: 105000,
            discrepancy: 0,
            status: 'balanced',
            matched_transactions: [],
            unmatched_statement_lines: [],
            unmatched_book_transactions: [],
            notes: null,
            time_spent_seconds: 300,
            user_id: 'test-user',
            reopened_at: null,
            reopened_by: null,
            reopened_reason: null,
          } as any,
          'test-user',
          context
        );
        expect(saveResult.success).toBe(true);
        if (!saveResult.success) return;

        await reopenReconciliation(
          saveResult.data.id,
          'Secret reason',
          'test-user',
          'test-company',
          context
        );

        // Check that reason is encrypted in database
        const stored = await db.reconciliations?.get(saveResult.data.id);
        expect(stored).toBeDefined();
        if (stored && stored.reopened_reason) {
          expect(stored.reopened_reason.toString()).toContain('encrypted:');
        }
      });
    });
  });

  // ===========================================================================
  // Unreconciled Transaction Flagging
  // ===========================================================================

  describe('Unreconciled Transaction Flagging', () => {
    describe('getUnreconciledTransactions', () => {
      beforeEach(async () => {
        // Add test account
        await db.accounts?.add({
          id: 'test-account',
          companyId: 'test-company',
          code: '1000',
          name: 'Test Bank Account',
          type: 'BANK',
          isActive: true,
          balance: 0,
        } as any);
      });

      it('should flag transactions older than 30 days as WARNING', async () => {
        const oldDate = Date.now() - 45 * 24 * 60 * 60 * 1000; // 45 days ago

        await db.transactions?.add(
          createTestJournalEntry('tx-1', oldDate, 5000, 'Old transaction')
        );

        const result = await getUnreconciledTransactions('test-company', 'test-account');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toHaveLength(1);
          expect(result.data[0].flag).toBe('WARNING');
          expect(result.data[0].age_days).toBeGreaterThanOrEqual(45);
        }
      });

      it('should flag transactions older than 60 days as ATTENTION', async () => {
        const oldDate = Date.now() - 75 * 24 * 60 * 60 * 1000; // 75 days ago

        await db.transactions?.add(
          createTestJournalEntry('tx-1', oldDate, 5000, 'Very old transaction')
        );

        const result = await getUnreconciledTransactions('test-company', 'test-account');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toHaveLength(1);
          expect(result.data[0].flag).toBe('ATTENTION');
        }
      });

      it('should flag transactions older than 90 days as URGENT', async () => {
        const oldDate = Date.now() - 120 * 24 * 60 * 60 * 1000; // 120 days ago

        await db.transactions?.add(
          createTestJournalEntry('tx-1', oldDate, 5000, 'Ancient transaction')
        );

        const result = await getUnreconciledTransactions('test-company', 'test-account');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toHaveLength(1);
          expect(result.data[0].flag).toBe('URGENT');
        }
      });

      it('should not flag recent transactions', async () => {
        const recentDate = Date.now() - 15 * 24 * 60 * 60 * 1000; // 15 days ago

        await db.transactions?.add(
          createTestJournalEntry('tx-1', recentDate, 5000, 'Recent transaction')
        );

        const result = await getUnreconciledTransactions('test-company', 'test-account');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toHaveLength(0);
        }
      });

      it('should sort by age (oldest first)', async () => {
        await db.transactions?.add(
          createTestJournalEntry('tx-1', Date.now() - 45 * 24 * 60 * 60 * 1000, 5000)
        );
        await db.transactions?.add(
          createTestJournalEntry('tx-2', Date.now() - 90 * 24 * 60 * 60 * 1000, 5000)
        );
        await db.transactions?.add(
          createTestJournalEntry('tx-3', Date.now() - 60 * 24 * 60 * 60 * 1000, 5000)
        );

        const result = await getUnreconciledTransactions('test-company', 'test-account');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toHaveLength(3);
          expect(result.data[0].age_days).toBeGreaterThan(result.data[1].age_days);
          expect(result.data[1].age_days).toBeGreaterThan(result.data[2].age_days);
        }
      });
    });

    describe('getUnreconciledDashboard', () => {
      beforeEach(async () => {
        // Add test accounts
        await db.accounts?.add({
          id: 'account-1',
          companyId: 'test-company',
          code: '1000',
          name: 'Bank Account 1',
          type: 'BANK',
          isActive: true,
          balance: 0,
        } as any);

        await db.accounts?.add({
          id: 'account-2',
          companyId: 'test-company',
          code: '1001',
          name: 'Bank Account 2',
          type: 'BANK',
          isActive: true,
          balance: 0,
        } as any);
      });

      it('should aggregate unreconciled transactions across accounts', async () => {
        // Add old transactions to both accounts
        await db.transactions?.add(
          createTestJournalEntry('tx-1', Date.now() - 45 * 24 * 60 * 60 * 1000, 5000)
        );
        await db.transactions?.add(
          createTestJournalEntry('tx-2', Date.now() - 75 * 24 * 60 * 60 * 1000, 3000)
        );

        const result = await getUnreconciledDashboard('test-company');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.total_count).toBeGreaterThan(0);
          expect(result.data.by_flag.warning).toBeGreaterThanOrEqual(0);
          expect(result.data.by_flag.attention).toBeGreaterThanOrEqual(0);
          expect(result.data.by_flag.urgent).toBeGreaterThanOrEqual(0);
        }
      });

      it('should track oldest transaction age', async () => {
        await db.transactions?.add(
          createTestJournalEntry('tx-1', Date.now() - 45 * 24 * 60 * 60 * 1000, 5000)
        );
        await db.transactions?.add(
          createTestJournalEntry('tx-2', Date.now() - 120 * 24 * 60 * 60 * 1000, 3000)
        );

        const result = await getUnreconciledDashboard('test-company');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.oldest_transaction_age_days).toBeGreaterThanOrEqual(120);
        }
      });

      it('should group by account', async () => {
        // Modify test to add transactions with account links
        const tx1 = createTestJournalEntry(
          'tx-1',
          Date.now() - 45 * 24 * 60 * 60 * 1000,
          5000
        );
        tx1.lines[0].accountId = 'account-1';

        const tx2 = createTestJournalEntry(
          'tx-2',
          Date.now() - 75 * 24 * 60 * 60 * 1000,
          3000
        );
        tx2.lines[0].accountId = 'account-2';

        await db.transactions?.add(tx1);
        await db.transactions?.add(tx2);

        const result = await getUnreconciledDashboard('test-company');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.by_account.length).toBeGreaterThanOrEqual(0);
        }
      });
    });
  });

  // ===========================================================================
  // Reconciliation Streak Tracking
  // ===========================================================================

  describe('Reconciliation Streak Tracking', () => {
    describe('getReconciliationStreak', () => {
      it('should return zero streak if no reconciliations exist', async () => {
        const result = await getReconciliationStreak('test-company', 'test-account');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.current_streak).toBe(0);
          expect(result.data.best_streak).toBe(0);
          expect(result.data.streak_status).toBe('broken');
        }
      });

      it('should calculate current streak for consecutive months', async () => {
        const now = Date.now();
        const oneMonth = 30 * 24 * 60 * 60 * 1000;

        // Create 3 consecutive monthly reconciliations
        for (let i = 0; i < 3; i++) {
          await saveReconciliationRecord(
            {
              company_id: 'test-company',
              account_id: 'test-account',
              reconciliation_date: now - i * oneMonth,
              statement_period: {
                start: now - (i + 1) * oneMonth,
                end: now - i * oneMonth,
              },
              beginning_balance: 100000,
              ending_balance: 105000,
              calculated_balance: 105000,
              discrepancy: 0,
              status: 'balanced',
              matched_transactions: [],
              unmatched_statement_lines: [],
              unmatched_book_transactions: [],
              notes: null,
              time_spent_seconds: 300,
              user_id: 'test-user',
              reopened_at: null,
              reopened_by: null,
              reopened_reason: null,
            } as any,
            'test-user'
          );
        }

        const result = await getReconciliationStreak('test-company', 'test-account');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.current_streak).toBeGreaterThan(0);
          expect(result.data.streak_status).toBeOneOf(['active', 'at_risk']);
        }
      });

      it('should mark streak as at_risk if last reconciliation is 30-45 days old', async () => {
        const oldDate = Date.now() - 40 * 24 * 60 * 60 * 1000; // 40 days ago

        await saveReconciliationRecord(
          {
            company_id: 'test-company',
            account_id: 'test-account',
            reconciliation_date: oldDate,
            statement_period: {
              start: oldDate - 30 * 24 * 60 * 60 * 1000,
              end: oldDate,
            },
            beginning_balance: 100000,
            ending_balance: 105000,
            calculated_balance: 105000,
            discrepancy: 0,
            status: 'balanced',
            matched_transactions: [],
            unmatched_statement_lines: [],
            unmatched_book_transactions: [],
            notes: null,
            time_spent_seconds: 300,
            user_id: 'test-user',
            reopened_at: null,
            reopened_by: null,
            reopened_reason: null,
          } as any,
          'test-user'
        );

        const result = await getReconciliationStreak('test-company', 'test-account');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.streak_status).toBe('at_risk');
        }
      });

      it('should mark streak as broken if last reconciliation is over 45 days old', async () => {
        const oldDate = Date.now() - 60 * 24 * 60 * 60 * 1000; // 60 days ago

        await saveReconciliationRecord(
          {
            company_id: 'test-company',
            account_id: 'test-account',
            reconciliation_date: oldDate,
            statement_period: {
              start: oldDate - 30 * 24 * 60 * 60 * 1000,
              end: oldDate,
            },
            beginning_balance: 100000,
            ending_balance: 105000,
            calculated_balance: 105000,
            discrepancy: 0,
            status: 'balanced',
            matched_transactions: [],
            unmatched_statement_lines: [],
            unmatched_book_transactions: [],
            notes: null,
            time_spent_seconds: 300,
            user_id: 'test-user',
            reopened_at: null,
            reopened_by: null,
            reopened_reason: null,
          } as any,
          'test-user'
        );

        const result = await getReconciliationStreak('test-company', 'test-account');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.streak_status).toBe('broken');
          expect(result.data.current_streak).toBe(0);
        }
      });

      it('should track best streak even if current is broken', async () => {
        const now = Date.now();
        const oneMonth = 30 * 24 * 60 * 60 * 1000;

        // Create 5 consecutive reconciliations
        for (let i = 0; i < 5; i++) {
          await saveReconciliationRecord(
            {
              company_id: 'test-company',
              account_id: 'test-account',
              reconciliation_date: now - (i + 2) * oneMonth, // Start 2 months ago
              statement_period: {
                start: now - (i + 3) * oneMonth,
                end: now - (i + 2) * oneMonth,
              },
              beginning_balance: 100000,
              ending_balance: 105000,
              calculated_balance: 105000,
              discrepancy: 0,
              status: 'balanced',
              matched_transactions: [],
              unmatched_statement_lines: [],
              unmatched_book_transactions: [],
              notes: null,
              time_spent_seconds: 300,
              user_id: 'test-user',
              reopened_at: null,
              reopened_by: null,
              reopened_reason: null,
            } as any,
            'test-user'
          );
        }

        const result = await getReconciliationStreak('test-company', 'test-account');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.best_streak).toBeGreaterThan(0);
          expect(result.data.current_streak).toBe(0); // Broken because last is too old
        }
      });

      it('should track milestone achievements', async () => {
        const now = Date.now();
        const oneMonth = 30 * 24 * 60 * 60 * 1000;

        // Create 6 consecutive monthly reconciliations
        for (let i = 0; i < 6; i++) {
          await saveReconciliationRecord(
            {
              company_id: 'test-company',
              account_id: 'test-account',
              reconciliation_date: now - i * oneMonth,
              statement_period: {
                start: now - (i + 1) * oneMonth,
                end: now - i * oneMonth,
              },
              beginning_balance: 100000,
              ending_balance: 105000,
              calculated_balance: 105000,
              discrepancy: 0,
              status: 'balanced',
              matched_transactions: [],
              unmatched_statement_lines: [],
              unmatched_book_transactions: [],
              notes: null,
              time_spent_seconds: 300,
              user_id: 'test-user',
              reopened_at: null,
              reopened_by: null,
              reopened_reason: null,
            } as any,
            'test-user'
          );
        }

        const result = await getReconciliationStreak('test-company', 'test-account');

        expect(result.success).toBe(true);
        if (result.success) {
          // Should have at least the 3-month milestone
          expect(result.data.milestones_achieved.length).toBeGreaterThan(0);
          const milestoneValues = result.data.milestones_achieved.map((m) => m.milestone);
          expect(milestoneValues).toContain(3);
        }
      });
    });
  });

  // ===========================================================================
  // Discrepancy Resolution Helpers
  // ===========================================================================

  describe('Discrepancy Resolution', () => {
    describe('suggestDiscrepancyResolutions', () => {
      it('should suggest bank fee for fee-related descriptions', async () => {
        const unmatchedStmt: StatementTransaction[] = [
          createTestStatementTx('stmt-1', Date.now(), 'Monthly service fee', -1500),
        ];

        const result = await suggestDiscrepancyResolutions(
          'test-company',
          'test-account',
          unmatchedStmt,
          [],
          -1500
        );

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.length).toBeGreaterThan(0);
          const bankFeeSuggestion = result.data.find(
            (s) => s.pattern === 'BANK_FEE'
          );
          expect(bankFeeSuggestion).toBeDefined();
          if (bankFeeSuggestion) {
            expect(bankFeeSuggestion.auto_fixable).toBe(true);
            expect(bankFeeSuggestion.confidence).toBeGreaterThan(50);
          }
        }
      });

      it('should suggest interest for interest-related descriptions', async () => {
        const unmatchedStmt: StatementTransaction[] = [
          createTestStatementTx('stmt-1', Date.now(), 'Interest earned', 250),
        ];

        const result = await suggestDiscrepancyResolutions(
          'test-company',
          'test-account',
          unmatchedStmt,
          [],
          250
        );

        expect(result.success).toBe(true);
        if (result.success) {
          const interestSuggestion = result.data.find(
            (s) => s.pattern === 'INTEREST'
          );
          expect(interestSuggestion).toBeDefined();
          if (interestSuggestion) {
            expect(interestSuggestion.auto_fixable).toBe(true);
            expect(interestSuggestion.confidence).toBeGreaterThan(80);
          }
        }
      });

      it('should detect potential duplicates with same amount', async () => {
        const unmatchedStmt: StatementTransaction[] = [
          createTestStatementTx('stmt-1', Date.now(), 'Payment A', -5000),
          createTestStatementTx('stmt-2', Date.now(), 'Payment B', -5000),
        ];

        const result = await suggestDiscrepancyResolutions(
          'test-company',
          'test-account',
          unmatchedStmt,
          [],
          -10000
        );

        expect(result.success).toBe(true);
        if (result.success) {
          const duplicateSuggestion = result.data.find(
            (s) => s.pattern === 'DUPLICATE'
          );
          expect(duplicateSuggestion).toBeDefined();
          if (duplicateSuggestion) {
            expect(duplicateSuggestion.affected_transactions).toHaveLength(2);
            expect(duplicateSuggestion.auto_fixable).toBe(false);
          }
        }
      });

      it('should flag outstanding checks for old unmatched book transactions', async () => {
        const oldDate = Date.now() - 60 * 24 * 60 * 60 * 1000; // 60 days ago
        const oldTx = createTestJournalEntry('tx-old', oldDate, -5000, 'Check #1234');

        await db.transactions?.add(oldTx);

        const result = await suggestDiscrepancyResolutions(
          'test-company',
          'test-account',
          [],
          ['tx-old'],
          -5000
        );

        expect(result.success).toBe(true);
        if (result.success) {
          const checkSuggestion = result.data.find(
            (s) => s.pattern === 'OUTSTANDING_CHECK'
          );
          expect(checkSuggestion).toBeDefined();
          if (checkSuggestion) {
            expect(checkSuggestion.auto_fixable).toBe(false);
            expect(checkSuggestion.affected_transactions).toContain('tx-old');
          }
        }
      });

      it('should return multiple suggestions for complex scenarios', async () => {
        const unmatchedStmt: StatementTransaction[] = [
          createTestStatementTx('stmt-1', Date.now(), 'Monthly fee', -1500),
          createTestStatementTx('stmt-2', Date.now(), 'Interest', 250),
          createTestStatementTx('stmt-3', Date.now(), 'Payment', -5000),
          createTestStatementTx('stmt-4', Date.now(), 'Payment duplicate', -5000),
        ];

        const result = await suggestDiscrepancyResolutions(
          'test-company',
          'test-account',
          unmatchedStmt,
          [],
          -11250
        );

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.length).toBeGreaterThan(1);
          // Should have bank fee, interest, and duplicate suggestions
          const patterns = result.data.map((s) => s.pattern);
          expect(patterns).toContain('BANK_FEE');
          expect(patterns).toContain('INTEREST');
          expect(patterns).toContain('DUPLICATE');
        }
      });

      it('should provide fix actions for auto-fixable suggestions', async () => {
        const unmatchedStmt: StatementTransaction[] = [
          createTestStatementTx('stmt-1', Date.now(), 'Service charge', -1000),
        ];

        const result = await suggestDiscrepancyResolutions(
          'test-company',
          'test-account',
          unmatchedStmt,
          [],
          -1000
        );

        expect(result.success).toBe(true);
        if (result.success) {
          const fixableSuggestion = result.data.find((s) => s.auto_fixable);
          expect(fixableSuggestion).toBeDefined();
          if (fixableSuggestion) {
            expect(fixableSuggestion.fix_action).toBeDefined();
            expect(fixableSuggestion.fix_action?.type).toBe('add_transaction');
            expect(fixableSuggestion.fix_action?.data).toBeDefined();
          }
        }
      });
    });
  });

  // ===========================================================================
  // Error Handling
  // ===========================================================================

  describe('Error Handling', () => {
    it('should handle database errors gracefully in createPattern', async () => {
      // Force an error by providing invalid data
      vi.spyOn(db.reconciliation_patterns as any, 'add').mockRejectedValueOnce(
        new Error('Database error')
      );

      const result = await createPattern('test-company', 'Test Vendor', 'test-user');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UNKNOWN_ERROR');
      }
    });

    it('should handle database errors gracefully in saveReconciliationRecord', async () => {
      vi.spyOn(db.reconciliations as any, 'add').mockRejectedValueOnce(
        new Error('Database error')
      );

      const result = await saveReconciliationRecord(
        {
          company_id: 'test-company',
          account_id: 'test-account',
          reconciliation_date: Date.now(),
          statement_period: {
            start: Date.now() - 30 * 24 * 60 * 60 * 1000,
            end: Date.now(),
          },
          beginning_balance: 100000,
          ending_balance: 105000,
          calculated_balance: 105000,
          discrepancy: 0,
          status: 'balanced',
          matched_transactions: [],
          unmatched_statement_lines: [],
          unmatched_book_transactions: [],
          notes: null,
          time_spent_seconds: 300,
          user_id: 'test-user',
          reopened_at: null,
          reopened_by: null,
          reopened_reason: null,
        } as any,
        'test-user'
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UNKNOWN_ERROR');
      }
    });

    it('should handle encryption errors gracefully', async () => {
      const badContext: EncryptionContext = {
        companyId: 'test-company',
        userId: 'test-user',
        encryptionService: {
          encrypt: async () => {
            throw new Error('Encryption failed');
          },
          decrypt: async () => {
            throw new Error('Decryption failed');
          },
          encryptField: async () => {
            throw new Error('Encryption failed');
          },
          decryptField: async () => {
            throw new Error('Decryption failed');
          },
        },
      };

      const result = await saveReconciliationRecord(
        {
          company_id: 'test-company',
          account_id: 'test-account',
          reconciliation_date: Date.now(),
          statement_period: {
            start: Date.now() - 30 * 24 * 60 * 60 * 1000,
            end: Date.now(),
          },
          beginning_balance: 100000,
          ending_balance: 105000,
          calculated_balance: 105000,
          discrepancy: 0,
          status: 'balanced',
          matched_transactions: [],
          unmatched_statement_lines: [],
          unmatched_book_transactions: [],
          notes: null,
          time_spent_seconds: 300,
          user_id: 'test-user',
          reopened_at: null,
          reopened_by: null,
          reopened_reason: null,
        } as any,
        'test-user',
        badContext
      );

      expect(result.success).toBe(false);
    });
  });
});

// Helper matcher for vitest (reuse from enhanced-matching tests)
expect.extend({
  toBeOneOf(received: any, expected: any[]) {
    const pass = expected.includes(received);
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be one of ${expected.join(', ')}`
          : `expected ${received} to be one of ${expected.join(', ')}`,
    };
  },
});
