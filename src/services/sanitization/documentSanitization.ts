/**
 * Document Sanitization Service
 *
 * Secures text inputs that future AI features will process.
 * Applies sanitization to invoices, customer data, notes, and custom fields.
 *
 * Features:
 * - Raw and safe view separation
 * - AI-safe content generation
 * - Field-specific sanitization rules
 * - Content Security Policy enforcement
 *
 * @security Phase 2.2 - Invoice/Document Input Hardening
 * @see docs/security/AGENTIC_AI_SECURITY_ROADMAP.md
 */

import {
  sanitizeBankMemo,
  containsInjectionPatterns,
  normalizeUnicode,
  removeInvisibleChars,
  removeControlChars,
  computeHash,
  ThreatType,
  ThreatSeverity,
  type SanitizationResult,
  type DetectedThreat,
} from '../import/sanitization';

/**
 * Field types that require sanitization
 */
export enum FieldType {
  INVOICE_DESCRIPTION = 'invoice_description',
  LINE_ITEM = 'line_item',
  CUSTOMER_NAME = 'customer_name',
  VENDOR_NAME = 'vendor_name',
  CONTACT_NAME = 'contact_name',
  NOTE = 'note',
  MEMO = 'memo',
  CUSTOM_FIELD = 'custom_field',
  PRODUCT_NAME = 'product_name',
  PRODUCT_DESCRIPTION = 'product_description',
  ACCOUNT_NAME = 'account_name',
  CATEGORY_NAME = 'category_name',
  TAG = 'tag',
}

/**
 * Configuration for field-specific sanitization
 */
interface FieldConfig {
  max_length: number;
  allow_html: boolean;
  allow_urls: boolean;
  strict_mode: boolean;
}

/**
 * Default configurations per field type
 */
const FIELD_CONFIGS: Record<FieldType, FieldConfig> = {
  [FieldType.INVOICE_DESCRIPTION]: {
    max_length: 1000,
    allow_html: false,
    allow_urls: true,
    strict_mode: false,
  },
  [FieldType.LINE_ITEM]: {
    max_length: 500,
    allow_html: false,
    allow_urls: false,
    strict_mode: true,
  },
  [FieldType.CUSTOMER_NAME]: {
    max_length: 200,
    allow_html: false,
    allow_urls: false,
    strict_mode: true,
  },
  [FieldType.VENDOR_NAME]: {
    max_length: 200,
    allow_html: false,
    allow_urls: false,
    strict_mode: true,
  },
  [FieldType.CONTACT_NAME]: {
    max_length: 200,
    allow_html: false,
    allow_urls: false,
    strict_mode: true,
  },
  [FieldType.NOTE]: {
    max_length: 2000,
    allow_html: false,
    allow_urls: true,
    strict_mode: false,
  },
  [FieldType.MEMO]: {
    max_length: 500,
    allow_html: false,
    allow_urls: false,
    strict_mode: true,
  },
  [FieldType.CUSTOM_FIELD]: {
    max_length: 500,
    allow_html: false,
    allow_urls: false,
    strict_mode: true,
  },
  [FieldType.PRODUCT_NAME]: {
    max_length: 200,
    allow_html: false,
    allow_urls: false,
    strict_mode: true,
  },
  [FieldType.PRODUCT_DESCRIPTION]: {
    max_length: 1000,
    allow_html: false,
    allow_urls: true,
    strict_mode: false,
  },
  [FieldType.ACCOUNT_NAME]: {
    max_length: 100,
    allow_html: false,
    allow_urls: false,
    strict_mode: true,
  },
  [FieldType.CATEGORY_NAME]: {
    max_length: 100,
    allow_html: false,
    allow_urls: false,
    strict_mode: true,
  },
  [FieldType.TAG]: {
    max_length: 50,
    allow_html: false,
    allow_urls: false,
    strict_mode: true,
  },
};

/**
 * Result of document field sanitization
 */
export interface DocumentSanitizationResult extends SanitizationResult {
  field_type: FieldType;
  ai_safe: string;
  display_safe: string;
}

/**
 * Document with raw and safe views
 */
export interface SanitizedDocument<T extends Record<string, unknown>> {
  raw: T;
  safe: T;
  ai_safe: T;
  threats: DetectedThreat[];
  requires_review: boolean;
}

/**
 * URL patterns that should be stripped (not just sanitized)
 */
const DANGEROUS_URL_PATTERN = /(javascript|data|vbscript):/gi;

/**
 * Email-like patterns (potential exfiltration targets)
 */
const EMAIL_PATTERN = /\S+@\S+\.\S+/g;

/**
 * URL pattern for detection
 */
const URL_PATTERN = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;

/**
 * Strip dangerous URLs from content
 */
function stripDangerousUrls(input: string): string {
  return input.replace(DANGEROUS_URL_PATTERN, '[removed]');
}

/**
 * Redact URLs if not allowed
 */
function redactUrls(input: string): string {
  return input.replace(URL_PATTERN, '[URL]');
}

/**
 * Generate AI-safe content
 * More aggressive sanitization for content that will be processed by AI
 */
function generateAiSafeContent(
  input: string,
  fieldType: FieldType
): { content: string; threats: DetectedThreat[] } {
  const threats: DetectedThreat[] = [];
  let content = input;

  // Step 1: Remove invisible characters (critical for AI safety)
  const invisibleResult = removeInvisibleChars(content);
  if (invisibleResult.chars_removed > 0) {
    threats.push({
      type: ThreatType.INVISIBLE_CHARS,
      severity: ThreatSeverity.HIGH,
      pattern_matched: `${invisibleResult.chars_removed} chars`,
      position: 0,
      description: 'Removed invisible characters',
    });
    content = invisibleResult.cleaned;
  }

  // Step 2: Normalize unicode (homoglyph protection)
  const unicodeResult = normalizeUnicode(content);
  if (unicodeResult.homoglyphs_found > 0) {
    threats.push({
      type: ThreatType.UNICODE_HOMOGLYPH,
      severity: ThreatSeverity.HIGH,
      pattern_matched: `${unicodeResult.homoglyphs_found} homoglyphs`,
      position: 0,
      description: 'Normalized unicode homoglyphs',
    });
    content = unicodeResult.normalized;
  }

  // Step 3: Remove control characters
  const controlResult = removeControlChars(content);
  if (controlResult.chars_removed > 0) {
    threats.push({
      type: ThreatType.CONTROL_CHARS,
      severity: ThreatSeverity.MEDIUM,
      pattern_matched: `${controlResult.chars_removed} chars`,
      position: 0,
      description: 'Removed control characters',
    });
    content = controlResult.cleaned;
  }

  // Step 4: Strip dangerous URLs
  content = stripDangerousUrls(content);

  // Step 5: Apply field-specific rules
  const config = FIELD_CONFIGS[fieldType];

  // Redact URLs if not allowed
  if (!config.allow_urls) {
    const urlMatches = content.match(URL_PATTERN);
    if (urlMatches && urlMatches.length > 0) {
      threats.push({
        type: ThreatType.DATA_EXFILTRATION,
        severity: ThreatSeverity.MEDIUM,
        pattern_matched: `${urlMatches.length} URLs`,
        position: 0,
        description: 'Redacted URLs in restricted field',
      });
      content = redactUrls(content);
    }
  }

  // Step 6: Truncate to max length
  if (content.length > config.max_length) {
    threats.push({
      type: ThreatType.EXCESSIVE_LENGTH,
      severity: ThreatSeverity.LOW,
      pattern_matched: `${content.length} chars`,
      position: 0,
      description: `Truncated to ${config.max_length} chars`,
    });
    content = content.substring(0, config.max_length);
  }

  // Step 7: Check for injection patterns using the bank memo sanitizer
  // This provides comprehensive prompt injection detection
  if (containsInjectionPatterns(content)) {
    const memoResult = sanitizeBankMemo(content, {
      max_length: config.max_length,
      strict_mode: config.strict_mode,
    });
    threats.push(...memoResult.threats_detected);
    if (config.strict_mode) {
      content = memoResult.sanitized;
    }
  }

  return { content: content.trim(), threats };
}

/**
 * Generate display-safe content
 * Less aggressive, preserves more original content for display
 */
function generateDisplaySafeContent(input: string, fieldType: FieldType): string {
  let content = input;

  // Remove control characters (always)
  content = removeControlChars(content).cleaned;

  // Strip dangerous URLs (always)
  content = stripDangerousUrls(content);

  // Truncate to max length
  const config = FIELD_CONFIGS[fieldType];
  if (content.length > config.max_length) {
    content = content.substring(0, config.max_length);
  }

  return content.trim();
}

/**
 * Sanitize a single document field
 */
export function sanitizeField(
  value: string,
  fieldType: FieldType
): DocumentSanitizationResult {
  const config = FIELD_CONFIGS[fieldType];

  // Generate both AI-safe and display-safe versions
  const { content: aiSafe, threats: aiThreats } = generateAiSafeContent(value, fieldType);
  const displaySafe = generateDisplaySafeContent(value, fieldType);

  // Get full sanitization result using bank memo sanitizer
  const fullResult = sanitizeBankMemo(value, {
    max_length: config.max_length,
    strict_mode: config.strict_mode,
  });

  // Combine threats from both sources (deduplicated)
  const allThreats = [...fullResult.threats_detected];
  for (const threat of aiThreats) {
    if (!allThreats.some((t) => t.type === threat.type && t.pattern_matched === threat.pattern_matched)) {
      allThreats.push(threat);
    }
  }

  return {
    ...fullResult,
    field_type: fieldType,
    ai_safe: aiSafe,
    display_safe: displaySafe,
    threats_detected: allThreats,
    sanitized: config.strict_mode ? fullResult.sanitized : displaySafe,
    requires_review: allThreats.some(
      (t) => t.severity === ThreatSeverity.HIGH || t.severity === ThreatSeverity.CRITICAL
    ),
  };
}

/**
 * Sanitize multiple fields in a document
 */
export function sanitizeDocument<T extends Record<string, unknown>>(
  document: T,
  fieldMappings: Partial<Record<keyof T, FieldType>>
): SanitizedDocument<T> {
  const raw = { ...document };
  const safe = { ...document };
  const ai_safe = { ...document };
  const allThreats: DetectedThreat[] = [];
  let requires_review = false;

  for (const [field, fieldType] of Object.entries(fieldMappings) as Array<[keyof T, FieldType]>) {
    const value = document[field];
    if (typeof value === 'string') {
      const result = sanitizeField(value, fieldType);
      safe[field] = result.display_safe as T[keyof T];
      ai_safe[field] = result.ai_safe as T[keyof T];
      allThreats.push(...result.threats_detected);
      if (result.requires_review) {
        requires_review = true;
      }
    }
  }

  return {
    raw,
    safe,
    ai_safe,
    threats: allThreats,
    requires_review,
  };
}

/**
 * Quick check if any field contains potentially dangerous content
 */
export function containsDangerousContent(
  document: Record<string, unknown>,
  fieldMappings: Partial<Record<string, FieldType>>
): boolean {
  for (const [field, _fieldType] of Object.entries(fieldMappings)) {
    const value = document[field];
    if (typeof value === 'string') {
      if (containsInjectionPatterns(value)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Sanitize invoice line items
 */
export function sanitizeInvoiceLineItems(
  lineItems: Array<{ description: string; [key: string]: unknown }>
): Array<{
  item: { description: string; [key: string]: unknown };
  sanitization: DocumentSanitizationResult;
}> {
  return lineItems.map((item) => ({
    item: {
      ...item,
      description: sanitizeField(item.description, FieldType.LINE_ITEM).ai_safe,
    },
    sanitization: sanitizeField(item.description, FieldType.LINE_ITEM),
  }));
}

/**
 * Sanitize customer/vendor contact data
 */
export function sanitizeContactData(contact: {
  name?: string;
  company?: string;
  notes?: string;
  [key: string]: unknown;
}): SanitizedDocument<typeof contact> {
  return sanitizeDocument(contact, {
    name: FieldType.CONTACT_NAME,
    company: FieldType.CUSTOMER_NAME,
    notes: FieldType.NOTE,
  });
}

/**
 * Sanitize product data
 */
export function sanitizeProductData(product: {
  name?: string;
  description?: string;
  [key: string]: unknown;
}): SanitizedDocument<typeof product> {
  return sanitizeDocument(product, {
    name: FieldType.PRODUCT_NAME,
    description: FieldType.PRODUCT_DESCRIPTION,
  });
}

/**
 * Get sanitization summary for audit logging
 */
export function getSanitizationSummary(
  result: DocumentSanitizationResult | SanitizedDocument<unknown>
): {
  threats_count: number;
  critical_count: number;
  high_count: number;
  requires_review: boolean;
  threat_types: ThreatType[];
} {
  const threats = 'threats' in result ? result.threats : result.threats_detected;

  return {
    threats_count: threats.length,
    critical_count: threats.filter((t) => t.severity === ThreatSeverity.CRITICAL).length,
    high_count: threats.filter((t) => t.severity === ThreatSeverity.HIGH).length,
    requires_review: result.requires_review,
    threat_types: [...new Set(threats.map((t) => t.type))],
  };
}

export default {
  sanitizeField,
  sanitizeDocument,
  sanitizeInvoiceLineItems,
  sanitizeContactData,
  sanitizeProductData,
  containsDangerousContent,
  getSanitizationSummary,
  FieldType,
};
