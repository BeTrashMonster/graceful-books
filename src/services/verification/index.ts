/**
 * Verification Services Module
 *
 * Provides formal verification of accounting invariants and business rules.
 * All transactions must pass through the proof gate before being saved.
 *
 * @security Phase 3.1 - Formal Verification of Accounting Invariants
 */

export {
  // Proof Gate (main entry point)
  validate,
  quickValidate,
  validateBatch,
  getStats,
  getHistory,
  getBlockedHistory,
  resetStats,
  clearHistory,
  isHealthy,
  type ProofGateRequest,
  type ProofGateResponse,
  type ProofGateStats,
} from './proofGate';

export {
  // Accounting Invariants
  validateEntry,
  isBalanced,
  getEntryTotals,
  getAllInvariantNames,
  AccountType,
  EntrySide,
  type JournalEntry,
  type JournalEntryLine,
  type AccountBalance,
  type ProofGateResult,
  type BusinessRuleContext,
  type InvariantViolation,
} from './accountingInvariants';
