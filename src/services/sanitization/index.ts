/**
 * Sanitization Services Module
 *
 * Provides comprehensive input sanitization for all user-provided content.
 * Protects against prompt injection, XSS, and other input-based attacks.
 *
 * @security Phase 2 - Input Validation & Supply Chain Hardening
 */

// Re-export from import sanitization
export {
  sanitizeBankMemo,
  sanitizeTransactionBatch,
  createProvenance,
  containsInjectionPatterns,
  getThreatSummary,
  computeHash,
  normalizeUnicode,
  removeInvisibleChars,
  removeControlChars,
  detectBase64Payload,
  ThreatType,
  ThreatSeverity,
  type SanitizationResult,
  type DetectedThreat,
  type TransactionProvenance,
  type SanitizationConfig,
} from '../import/sanitization';

// Export document sanitization
export {
  sanitizeField,
  sanitizeDocument,
  sanitizeInvoiceLineItems,
  sanitizeContactData,
  sanitizeProductData,
  containsDangerousContent,
  getSanitizationSummary,
  FieldType,
  type DocumentSanitizationResult,
  type SanitizedDocument,
} from './documentSanitization';
