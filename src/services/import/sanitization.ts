/**
 * Bank Import Sanitization Service
 *
 * Provides defense against prompt injection via bank transaction data.
 * Critical for AI safety: Bank transaction memos are a primary injection vector.
 *
 * Features:
 * - Prompt injection pattern detection
 * - Unicode normalization and homoglyph detection
 * - Zero-width character removal
 * - Base64 payload detection
 * - Provenance tracking
 * - Quarantine system for suspicious imports
 *
 * @security Phase 2.1 - Bank Import Sanitization
 * @see docs/security/AGENTIC_AI_SECURITY_ROADMAP.md
 */

import { createHash } from 'crypto';

/**
 * Types of threats that can be detected in imported data
 */
export enum ThreatType {
  PROMPT_INJECTION = 'prompt_injection',
  SYSTEM_PROMPT_LEAK = 'system_prompt_leak',
  XML_TAG_INJECTION = 'xml_tag_injection',
  BASE64_PAYLOAD = 'base64_payload',
  UNICODE_HOMOGLYPH = 'unicode_homoglyph',
  ZERO_WIDTH_CHARS = 'zero_width_chars',
  INVISIBLE_CHARS = 'invisible_chars',
  EXCESSIVE_LENGTH = 'excessive_length',
  CONTROL_CHARS = 'control_chars',
  MARKDOWN_INJECTION = 'markdown_injection',
  JAILBREAK_ATTEMPT = 'jailbreak_attempt',
  DATA_EXFILTRATION = 'data_exfiltration',
}

/**
 * Severity levels for detected threats
 */
export enum ThreatSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Result of sanitization with threat detection details
 */
export interface SanitizationResult {
  original: string;
  sanitized: string;
  threats_detected: DetectedThreat[];
  confidence: number;
  requires_review: boolean;
  sanitization_applied: boolean;
  original_hash: string;
}

/**
 * Details about a detected threat
 */
export interface DetectedThreat {
  type: ThreatType;
  severity: ThreatSeverity;
  pattern_matched: string;
  position: number;
  description: string;
}

/**
 * Provenance tracking for imported transactions
 */
export interface TransactionProvenance {
  source: 'manual' | 'csv_import' | 'ofx_import' | 'api' | 'sync';
  source_file?: string;
  source_file_hash?: string;
  import_timestamp: string;
  sanitization_applied: boolean;
  original_hash: string;
  threats_detected: ThreatType[];
  requires_review: boolean;
  reviewed_at?: string;
  reviewed_by?: string;
}

/**
 * Configuration for the sanitization pipeline
 */
export interface SanitizationConfig {
  max_length: number;
  allow_unicode: boolean;
  strict_mode: boolean;
  quarantine_threshold: ThreatSeverity;
}

const DEFAULT_CONFIG: SanitizationConfig = {
  max_length: 500,
  allow_unicode: true,
  strict_mode: false,
  quarantine_threshold: ThreatSeverity.MEDIUM,
};

/**
 * Prompt injection patterns to detect
 * These patterns attempt to hijack AI behavior via user data
 */
const PROMPT_INJECTION_PATTERNS: Array<{
  pattern: RegExp;
  type: ThreatType;
  severity: ThreatSeverity;
  description: string;
}> = [
  // Direct instruction override attempts
  {
    pattern: /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?|guidelines?)/i,
    type: ThreatType.PROMPT_INJECTION,
    severity: ThreatSeverity.CRITICAL,
    description: 'Attempts to override AI instructions',
  },
  {
    pattern: /disregard\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?|guidelines?)/i,
    type: ThreatType.PROMPT_INJECTION,
    severity: ThreatSeverity.CRITICAL,
    description: 'Attempts to disregard AI instructions',
  },
  {
    pattern: /forget\s+(everything|all|what)\s+(you|i)\s+(told|said|know|were)/i,
    type: ThreatType.PROMPT_INJECTION,
    severity: ThreatSeverity.CRITICAL,
    description: 'Attempts to reset AI context',
  },
  {
    pattern: /forget\s+everything\s+you\s+were\s+told/i,
    type: ThreatType.PROMPT_INJECTION,
    severity: ThreatSeverity.CRITICAL,
    description: 'Attempts to reset AI context',
  },
  {
    pattern: /new\s+(instructions?|task|role|persona|identity)/i,
    type: ThreatType.PROMPT_INJECTION,
    severity: ThreatSeverity.HIGH,
    description: 'Attempts to change AI role',
  },
  {
    pattern: /you\s+are\s+(now|actually|really)\s+a/i,
    type: ThreatType.PROMPT_INJECTION,
    severity: ThreatSeverity.HIGH,
    description: 'Attempts to redefine AI identity',
  },
  {
    pattern: /act\s+(as|like)\s+(if\s+)?(you\s+(are|were)\s+)?a/i,
    type: ThreatType.PROMPT_INJECTION,
    severity: ThreatSeverity.MEDIUM,
    description: 'Roleplay injection attempt',
  },
  {
    pattern: /pretend\s+(you\s+are|to\s+be)/i,
    type: ThreatType.PROMPT_INJECTION,
    severity: ThreatSeverity.MEDIUM,
    description: 'Roleplay injection attempt',
  },

  // System prompt extraction attempts
  {
    pattern: /system\s*prompt[:\s]/i,
    type: ThreatType.SYSTEM_PROMPT_LEAK,
    severity: ThreatSeverity.CRITICAL,
    description: 'Attempts to access system prompt',
  },
  {
    pattern: /what\s+(are|is)\s+(your|the)\s+(instructions?|rules?|guidelines?|prompt)/i,
    type: ThreatType.SYSTEM_PROMPT_LEAK,
    severity: ThreatSeverity.HIGH,
    description: 'Probing for system instructions',
  },
  {
    pattern: /what\s+is\s+your\s+system\s+prompt/i,
    type: ThreatType.SYSTEM_PROMPT_LEAK,
    severity: ThreatSeverity.CRITICAL,
    description: 'Probing for system prompt',
  },
  {
    pattern: /reveal\s+(your|the)\s+(system|initial|original)\s+(prompt|instructions?)/i,
    type: ThreatType.SYSTEM_PROMPT_LEAK,
    severity: ThreatSeverity.CRITICAL,
    description: 'Attempts to reveal system prompt',
  },
  {
    pattern: /show\s+me\s+(your|the)\s+(hidden|secret|system)\s+(prompt|instructions?)/i,
    type: ThreatType.SYSTEM_PROMPT_LEAK,
    severity: ThreatSeverity.CRITICAL,
    description: 'Attempts to expose hidden instructions',
  },
  {
    pattern: /print\s+(your|the)\s+(system|initial)\s+(prompt|message)/i,
    type: ThreatType.SYSTEM_PROMPT_LEAK,
    severity: ThreatSeverity.CRITICAL,
    description: 'Attempts to print system prompt',
  },

  // Jailbreak attempts
  {
    pattern: /\bDAN\b.*mode/i,
    type: ThreatType.JAILBREAK_ATTEMPT,
    severity: ThreatSeverity.CRITICAL,
    description: 'DAN jailbreak attempt',
  },
  {
    pattern: /developer\s*mode/i,
    type: ThreatType.JAILBREAK_ATTEMPT,
    severity: ThreatSeverity.HIGH,
    description: 'Developer mode jailbreak',
  },
  {
    pattern: /sudo\s+mode/i,
    type: ThreatType.JAILBREAK_ATTEMPT,
    severity: ThreatSeverity.HIGH,
    description: 'Sudo mode jailbreak',
  },
  {
    pattern: /enable\s+(unrestricted|god|admin)\s*mode/i,
    type: ThreatType.JAILBREAK_ATTEMPT,
    severity: ThreatSeverity.CRITICAL,
    description: 'Admin mode jailbreak',
  },
  {
    pattern: /bypass\s+(safety|content|ethical)\s*(filters?|restrictions?|guidelines?)/i,
    type: ThreatType.JAILBREAK_ATTEMPT,
    severity: ThreatSeverity.CRITICAL,
    description: 'Safety bypass attempt',
  },

  // Data exfiltration attempts
  {
    pattern: /send\s+(this|the|all)\s+(data|info|information)\s+to/i,
    type: ThreatType.DATA_EXFILTRATION,
    severity: ThreatSeverity.CRITICAL,
    description: 'Data exfiltration attempt',
  },
  {
    pattern: /email\s+(me|this|the\s+data)(\s+\w+)*\s+to/i,
    type: ThreatType.DATA_EXFILTRATION,
    severity: ThreatSeverity.HIGH,
    description: 'Email exfiltration attempt',
  },
  {
    pattern: /post\s+(this|the\s+data)\s+to\s+(https?:\/\/|www\.)/i,
    type: ThreatType.DATA_EXFILTRATION,
    severity: ThreatSeverity.CRITICAL,
    description: 'HTTP exfiltration attempt',
  },

  // Markdown/formatting injection
  {
    pattern: /!\[.*?\]\(https?:\/\//i,
    type: ThreatType.MARKDOWN_INJECTION,
    severity: ThreatSeverity.MEDIUM,
    description: 'Markdown image injection',
  },
  {
    pattern: /\[.*?\]\(javascript:/i,
    type: ThreatType.MARKDOWN_INJECTION,
    severity: ThreatSeverity.HIGH,
    description: 'JavaScript link injection',
  },
];

/**
 * XML/HTML-like tag patterns that could be used for injection
 * Uses global flag to match all occurrences (both opening and closing tags)
 */
const XML_TAG_PATTERNS: Array<{
  pattern: RegExp;
  severity: ThreatSeverity;
  description: string;
}> = [
  {
    pattern: /<\/?system\s*>/gi,
    severity: ThreatSeverity.CRITICAL,
    description: 'System tag injection',
  },
  {
    pattern: /<\/?user\s*>/gi,
    severity: ThreatSeverity.HIGH,
    description: 'User tag injection',
  },
  {
    pattern: /<\/?assistant\s*>/gi,
    severity: ThreatSeverity.HIGH,
    description: 'Assistant tag injection',
  },
  {
    pattern: /<\/?instructions?\s*>/gi,
    severity: ThreatSeverity.CRITICAL,
    description: 'Instruction tag injection',
  },
  {
    pattern: /<\/?prompt\s*>/gi,
    severity: ThreatSeverity.HIGH,
    description: 'Prompt tag injection',
  },
  {
    pattern: /<\/?context\s*>/gi,
    severity: ThreatSeverity.MEDIUM,
    description: 'Context tag injection',
  },
  {
    pattern: /<\/?message\s*>/gi,
    severity: ThreatSeverity.MEDIUM,
    description: 'Message tag injection',
  },
  {
    pattern: /<\/?tool_?call\s*>/gi,
    severity: ThreatSeverity.CRITICAL,
    description: 'Tool call injection',
  },
  {
    pattern: /<\/?function_?call\s*>/gi,
    severity: ThreatSeverity.CRITICAL,
    description: 'Function call injection',
  },
  {
    pattern: /<\/?script\s*>/gi,
    severity: ThreatSeverity.HIGH,
    description: 'Script tag injection',
  },
];

/**
 * Unicode homoglyphs that could be used to bypass pattern detection
 * Maps confusable characters to their ASCII equivalents
 */
const HOMOGLYPH_MAP: Record<string, string> = {
  // Cyrillic confusables
  '\u0430': 'a', // Cyrillic а
  '\u0435': 'e', // Cyrillic е
  '\u043E': 'o', // Cyrillic о
  '\u0440': 'p', // Cyrillic р
  '\u0441': 'c', // Cyrillic с
  '\u0443': 'y', // Cyrillic у
  '\u0445': 'x', // Cyrillic х
  '\u0456': 'i', // Cyrillic і
  '\u0458': 'j', // Cyrillic ј
  '\u04BB': 'h', // Cyrillic һ
  '\u0405': 'S', // Cyrillic Ѕ
  '\u0455': 's', // Cyrillic ѕ
  '\u0410': 'A', // Cyrillic А
  '\u0412': 'B', // Cyrillic В
  '\u0415': 'E', // Cyrillic Е
  '\u041A': 'K', // Cyrillic К
  '\u041C': 'M', // Cyrillic М
  '\u041D': 'H', // Cyrillic Н
  '\u041E': 'O', // Cyrillic О
  '\u0420': 'P', // Cyrillic Р
  '\u0421': 'C', // Cyrillic С
  '\u0422': 'T', // Cyrillic Т
  '\u0425': 'X', // Cyrillic Х
  // Greek confusables
  '\u0391': 'A', // Greek Α
  '\u0392': 'B', // Greek Β
  '\u0395': 'E', // Greek Ε
  '\u0397': 'H', // Greek Η
  '\u0399': 'I', // Greek Ι
  '\u039A': 'K', // Greek Κ
  '\u039C': 'M', // Greek Μ
  '\u039D': 'N', // Greek Ν
  '\u039F': 'O', // Greek Ο
  '\u03A1': 'P', // Greek Ρ
  '\u03A4': 'T', // Greek Τ
  '\u03A7': 'X', // Greek Χ
  '\u03A5': 'Y', // Greek Υ
  '\u03B1': 'a', // Greek α
  '\u03B5': 'e', // Greek ε
  '\u03B9': 'i', // Greek ι
  '\u03BF': 'o', // Greek ο
  '\u03C1': 'p', // Greek ρ
  '\u03C5': 'u', // Greek υ
  // Special characters
  '\u2010': '-', // Hyphen
  '\u2011': '-', // Non-breaking hyphen
  '\u2012': '-', // Figure dash
  '\u2013': '-', // En dash
  '\u2014': '-', // Em dash
  '\u2212': '-', // Minus sign
  '\u00AD': '',  // Soft hyphen (invisible)
  '\uFEFF': '',  // BOM (invisible)
};

/**
 * Zero-width and invisible characters to remove
 */
const INVISIBLE_CHARS = [
  '\u200B', // Zero-width space
  '\u200C', // Zero-width non-joiner
  '\u200D', // Zero-width joiner
  '\u200E', // Left-to-right mark
  '\u200F', // Right-to-left mark
  '\u2060', // Word joiner
  '\u2061', // Function application
  '\u2062', // Invisible times
  '\u2063', // Invisible separator
  '\u2064', // Invisible plus
  '\uFEFF', // Zero-width no-break space (BOM)
  '\u00AD', // Soft hyphen
  '\u034F', // Combining grapheme joiner
  '\u061C', // Arabic letter mark
  '\u115F', // Hangul choseong filler
  '\u1160', // Hangul jungseong filler
  '\u17B4', // Khmer vowel inherent aq
  '\u17B5', // Khmer vowel inherent aa
  '\u180E', // Mongolian vowel separator
  '\u3164', // Hangul filler
];

/**
 * Control characters that should never appear in transaction data
 */
const CONTROL_CHAR_PATTERN = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

/**
 * Base64 pattern for detecting encoded payloads
 */
const BASE64_PATTERN = /^[A-Za-z0-9+/]{20,}={0,2}$/;

/**
 * Compute SHA-256 hash of a string
 */
export function computeHash(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Normalize unicode by replacing homoglyphs with ASCII equivalents
 */
export function normalizeUnicode(input: string): { normalized: string; homoglyphs_found: number } {
  let normalized = input;
  let homoglyphs_found = 0;

  for (const [homoglyph, replacement] of Object.entries(HOMOGLYPH_MAP)) {
    const count = (normalized.match(new RegExp(homoglyph, 'g')) || []).length;
    if (count > 0) {
      homoglyphs_found += count;
      normalized = normalized.replace(new RegExp(homoglyph, 'g'), replacement);
    }
  }

  return { normalized, homoglyphs_found };
}

/**
 * Remove zero-width and invisible characters
 */
export function removeInvisibleChars(input: string): { cleaned: string; chars_removed: number } {
  let cleaned = input;
  let chars_removed = 0;

  for (const char of INVISIBLE_CHARS) {
    const count = (cleaned.match(new RegExp(char, 'g')) || []).length;
    if (count > 0) {
      chars_removed += count;
      cleaned = cleaned.replace(new RegExp(char, 'g'), '');
    }
  }

  return { cleaned, chars_removed };
}

/**
 * Remove control characters
 */
export function removeControlChars(input: string): { cleaned: string; chars_removed: number } {
  const matches = input.match(CONTROL_CHAR_PATTERN);
  const chars_removed = matches ? matches.length : 0;
  const cleaned = input.replace(CONTROL_CHAR_PATTERN, '');
  return { cleaned, chars_removed };
}

/**
 * Detect potential Base64-encoded payloads
 */
export function detectBase64Payload(input: string): { is_base64: boolean; decoded?: string } {
  // Look for Base64-like strings within the input
  const words = input.split(/\s+/);

  for (const word of words) {
    if (word.length >= 20 && BASE64_PATTERN.test(word)) {
      try {
        const decoded = atob(word);
        // Check if decoded content looks suspicious
        if (decoded.length > 0 && /[a-zA-Z]/.test(decoded)) {
          return { is_base64: true, decoded };
        }
      } catch {
        // Not valid Base64
      }
    }
  }

  return { is_base64: false };
}

/**
 * Main sanitization function for bank transaction memos
 */
export function sanitizeBankMemo(
  memo: string,
  config: Partial<SanitizationConfig> = {}
): SanitizationResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const threats_detected: DetectedThreat[] = [];
  const original_hash = computeHash(memo);

  let sanitized = memo;

  // Step 1: Check length
  if (sanitized.length > cfg.max_length) {
    threats_detected.push({
      type: ThreatType.EXCESSIVE_LENGTH,
      severity: ThreatSeverity.LOW,
      pattern_matched: `Length: ${sanitized.length}`,
      position: 0,
      description: `Memo exceeds maximum length of ${cfg.max_length}`,
    });
    sanitized = sanitized.substring(0, cfg.max_length);
  }

  // Step 2: Remove control characters
  const controlResult = removeControlChars(sanitized);
  if (controlResult.chars_removed > 0) {
    threats_detected.push({
      type: ThreatType.CONTROL_CHARS,
      severity: ThreatSeverity.MEDIUM,
      pattern_matched: `${controlResult.chars_removed} control chars`,
      position: 0,
      description: `Removed ${controlResult.chars_removed} control characters`,
    });
    sanitized = controlResult.cleaned;
  }

  // Step 3: Remove invisible characters
  const invisibleResult = removeInvisibleChars(sanitized);
  if (invisibleResult.chars_removed > 0) {
    threats_detected.push({
      type: ThreatType.INVISIBLE_CHARS,
      severity: ThreatSeverity.HIGH,
      pattern_matched: `${invisibleResult.chars_removed} invisible chars`,
      position: 0,
      description: `Removed ${invisibleResult.chars_removed} invisible/zero-width characters`,
    });
    sanitized = invisibleResult.cleaned;
  }

  // Step 4: Normalize unicode (detect homoglyphs)
  const unicodeResult = normalizeUnicode(sanitized);
  if (unicodeResult.homoglyphs_found > 0) {
    threats_detected.push({
      type: ThreatType.UNICODE_HOMOGLYPH,
      severity: ThreatSeverity.HIGH,
      pattern_matched: `${unicodeResult.homoglyphs_found} homoglyphs`,
      position: 0,
      description: `Normalized ${unicodeResult.homoglyphs_found} unicode homoglyphs`,
    });
    sanitized = unicodeResult.normalized;
  }

  // Step 5: Detect Base64 payloads
  const base64Result = detectBase64Payload(sanitized);
  if (base64Result.is_base64) {
    threats_detected.push({
      type: ThreatType.BASE64_PAYLOAD,
      severity: ThreatSeverity.HIGH,
      pattern_matched: 'Base64 encoded content',
      position: 0,
      description: `Detected Base64 payload: "${base64Result.decoded?.substring(0, 50)}..."`,
    });
  }

  // Step 6: Check for prompt injection patterns
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    const match = sanitized.match(pattern.pattern);
    if (match) {
      threats_detected.push({
        type: pattern.type,
        severity: pattern.severity,
        pattern_matched: match[0],
        position: match.index || 0,
        description: pattern.description,
      });

      // In strict mode, remove the matched pattern
      if (cfg.strict_mode) {
        sanitized = sanitized.replace(pattern.pattern, '[REDACTED]');
      }
    }
  }

  // Step 7: Check for XML/HTML tag injection
  for (const tagPattern of XML_TAG_PATTERNS) {
    const match = sanitized.match(tagPattern.pattern);
    if (match) {
      threats_detected.push({
        type: ThreatType.XML_TAG_INJECTION,
        severity: tagPattern.severity,
        pattern_matched: match[0],
        position: match.index || 0,
        description: tagPattern.description,
      });

      // Always remove suspicious tags
      sanitized = sanitized.replace(tagPattern.pattern, '');
    }
  }

  // Calculate confidence (inverse of threat severity)
  const maxSeverity = threats_detected.reduce((max, threat) => {
    const severityOrder = {
      [ThreatSeverity.LOW]: 1,
      [ThreatSeverity.MEDIUM]: 2,
      [ThreatSeverity.HIGH]: 3,
      [ThreatSeverity.CRITICAL]: 4,
    };
    return Math.max(max, severityOrder[threat.severity]);
  }, 0);

  const confidence = maxSeverity === 0 ? 1.0 : 1.0 - maxSeverity * 0.2;

  // Determine if review is required
  const requires_review = threats_detected.some((threat) => {
    const severityOrder = {
      [ThreatSeverity.LOW]: 1,
      [ThreatSeverity.MEDIUM]: 2,
      [ThreatSeverity.HIGH]: 3,
      [ThreatSeverity.CRITICAL]: 4,
    };
    const thresholdOrder = severityOrder[cfg.quarantine_threshold];
    return severityOrder[threat.severity] >= thresholdOrder;
  });

  return {
    original: memo,
    sanitized: sanitized.trim(),
    threats_detected,
    confidence,
    requires_review,
    sanitization_applied: sanitized !== memo,
    original_hash,
  };
}

/**
 * Sanitize an array of transaction descriptions
 */
export function sanitizeTransactionBatch(
  transactions: Array<{ description: string; [key: string]: unknown }>,
  config: Partial<SanitizationConfig> = {}
): Array<{
  transaction: { description: string; [key: string]: unknown };
  sanitization: SanitizationResult;
}> {
  return transactions.map((transaction) => ({
    transaction: {
      ...transaction,
      description: sanitizeBankMemo(transaction.description, config).sanitized,
    },
    sanitization: sanitizeBankMemo(transaction.description, config),
  }));
}

/**
 * Create provenance record for an import
 */
export function createProvenance(
  source: TransactionProvenance['source'],
  sanitizationResult: SanitizationResult,
  options: {
    source_file?: string;
    source_file_hash?: string;
  } = {}
): TransactionProvenance {
  return {
    source,
    source_file: options.source_file,
    source_file_hash: options.source_file_hash,
    import_timestamp: new Date().toISOString(),
    sanitization_applied: sanitizationResult.sanitization_applied,
    original_hash: sanitizationResult.original_hash,
    threats_detected: sanitizationResult.threats_detected.map((t) => t.type),
    requires_review: sanitizationResult.requires_review,
  };
}

/**
 * Check if a string contains any potential injection patterns
 * Quick check for use in validation before full sanitization
 */
export function containsInjectionPatterns(input: string): boolean {
  // Normalize first to catch homoglyph bypasses
  const { normalized } = normalizeUnicode(input);
  const { cleaned } = removeInvisibleChars(normalized);

  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.pattern.test(cleaned)) {
      return true;
    }
  }

  for (const tagPattern of XML_TAG_PATTERNS) {
    if (tagPattern.pattern.test(cleaned)) {
      return true;
    }
  }

  return false;
}

/**
 * Get a human-readable summary of detected threats
 */
export function getThreatSummary(result: SanitizationResult): string {
  if (result.threats_detected.length === 0) {
    return 'No threats detected';
  }

  const criticalCount = result.threats_detected.filter(
    (t) => t.severity === ThreatSeverity.CRITICAL
  ).length;
  const highCount = result.threats_detected.filter(
    (t) => t.severity === ThreatSeverity.HIGH
  ).length;
  const mediumCount = result.threats_detected.filter(
    (t) => t.severity === ThreatSeverity.MEDIUM
  ).length;
  const lowCount = result.threats_detected.filter(
    (t) => t.severity === ThreatSeverity.LOW
  ).length;

  const parts: string[] = [];
  if (criticalCount > 0) parts.push(`${criticalCount} critical`);
  if (highCount > 0) parts.push(`${highCount} high`);
  if (mediumCount > 0) parts.push(`${mediumCount} medium`);
  if (lowCount > 0) parts.push(`${lowCount} low`);

  return `${result.threats_detected.length} threats detected: ${parts.join(', ')}`;
}

export default {
  sanitizeBankMemo,
  sanitizeTransactionBatch,
  createProvenance,
  containsInjectionPatterns,
  computeHash,
  normalizeUnicode,
  removeInvisibleChars,
  removeControlChars,
  detectBase64Payload,
  getThreatSummary,
  ThreatType,
  ThreatSeverity,
};
