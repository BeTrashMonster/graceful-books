/**
 * Import Services Module
 *
 * Provides secure data import functionality with:
 * - Prompt injection defense
 * - Unicode normalization
 * - Provenance tracking
 * - Quarantine system
 *
 * @security Phase 2 - Input Validation & Supply Chain Hardening
 */

export {
  // Main functions
  sanitizeBankMemo,
  sanitizeTransactionBatch,
  createProvenance,
  containsInjectionPatterns,
  getThreatSummary,

  // Utility functions
  computeHash,
  normalizeUnicode,
  removeInvisibleChars,
  removeControlChars,
  detectBase64Payload,

  // Types
  ThreatType,
  ThreatSeverity,
  type SanitizationResult,
  type DetectedThreat,
  type TransactionProvenance,
  type SanitizationConfig,
} from './sanitization';
