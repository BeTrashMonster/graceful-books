/**
 * Reconciliation Patterns Schema Definition
 *
 * Stores learned patterns from historical reconciliations to improve
 * auto-matching accuracy over time (E1 requirement).
 *
 * Requirements:
 * - E1: Pattern learning for >85% auto-match accuracy
 * - ARCH-004: CRDT-Compatible Schema Design
 */

import type { ReconciliationPattern } from '../../types/reconciliation.types';

/**
 * Dexie.js schema definition for ReconciliationPatterns table
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - company_id: For querying patterns by company
 * - vendor_name: For quick vendor lookup
 * - [company_id+vendor_name]: Compound index for vendor queries
 * - last_matched_at: For sorting by recency
 * - updated_at: For CRDT conflict resolution
 */
export const reconciliationPatternsSchema =
  'id, company_id, vendor_name, [company_id+vendor_name], last_matched_at, updated_at';

/**
 * Table name constant
 */
export const RECONCILIATION_PATTERNS_TABLE = 'reconciliation_patterns';

/**
 * Default values for new ReconciliationPattern
 */
export const createDefaultReconciliationPattern = (
  companyId: string,
  vendorName: string
): Partial<ReconciliationPattern> => {
  const now = Date.now();

  return {
    company_id: companyId,
    vendor_name: vendorName.toLowerCase().trim(),
    description_patterns: [],
    typical_amount_range: null,
    typical_day_of_month: null,
    confidence: 50, // Start with moderate confidence
    last_matched_at: now,
    match_count: 0,
    created_at: now,
    updated_at: now,
  };
};

/**
 * Normalize vendor name for consistent matching
 */
export const normalizeVendorName = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' '); // Normalize whitespace
};

/**
 * Extract vendor name from transaction description
 * Uses common patterns to identify vendor names
 */
export const extractVendorFromDescription = (description: string): string | null => {
  if (!description) return null;

  const normalized = description.toLowerCase().trim();

  // Common prefixes to remove
  const prefixesToRemove = [
    'pos ',
    'ach ',
    'check ',
    'debit ',
    'credit ',
    'payment to ',
    'payment from ',
    'transfer to ',
    'transfer from ',
    'withdrawal ',
    'deposit ',
  ];

  let cleaned = normalized;
  for (const prefix of prefixesToRemove) {
    if (cleaned.startsWith(prefix)) {
      cleaned = cleaned.substring(prefix.length);
    }
  }

  // Common suffixes to remove
  const suffixesToRemove = [
    ' inc',
    ' llc',
    ' ltd',
    ' corp',
    ' co',
    ' company',
  ];

  for (const suffix of suffixesToRemove) {
    if (cleaned.endsWith(suffix)) {
      cleaned = cleaned.substring(0, cleaned.length - suffix.length);
    }
  }

  // Extract first meaningful word group (up to first number or special sequence)
  const match = cleaned.match(/^([a-z\s]+)/);
  if (match) {
    return normalizeVendorName(match[1]!);
  }

  return normalizeVendorName(cleaned);
};

/**
 * Common vendor abbreviations mapping
 */
export const VENDOR_ABBREVIATIONS: Record<string, string> = {
  amzn: 'amazon',
  amz: 'amazon',
  'amazon mktplace': 'amazon',
  'amazon marketplace': 'amazon',
  goog: 'google',
  googl: 'google',
  msft: 'microsoft',
  fb: 'facebook',
  meta: 'facebook',
  aapl: 'apple',
  nflx: 'netflix',
  spot: 'spotify',
  sq: 'square',
  pypl: 'paypal',
  venmo: 'paypal',
  stripe: 'stripe',
  shopify: 'shopify',
  wix: 'wix',
  godaddy: 'godaddy',
  squarespace: 'squarespace',
  mailchimp: 'mailchimp',
  'constant contact': 'constant contact',
  zoom: 'zoom',
  slack: 'slack',
  dropbox: 'dropbox',
  'google drive': 'google',
  'g suite': 'google',
  'google workspace': 'google',
  'office 365': 'microsoft',
  'microsoft 365': 'microsoft',
};

/**
 * Expand vendor abbreviation to full name
 */
export const expandVendorAbbreviation = (vendor: string): string => {
  const normalized = vendor.toLowerCase().trim();

  // Check for exact match
  if (VENDOR_ABBREVIATIONS[normalized]) {
    return VENDOR_ABBREVIATIONS[normalized];
  }

  // Check for partial match
  for (const [abbrev, fullName] of Object.entries(VENDOR_ABBREVIATIONS)) {
    if (normalized.includes(abbrev)) {
      return fullName;
    }
  }

  return vendor;
};

/**
 * Calculate day of month from timestamp
 */
export const getDayOfMonth = (timestamp: number): number => {
  const date = new Date(timestamp);
  return date.getDate();
};

/**
 * Check if amount falls within range
 */
export const isAmountInRange = (
  amount: number,
  range: { min: number; max: number } | null
): boolean => {
  if (!range) return false;

  const absAmount = Math.abs(amount);
  return absAmount >= range.min && absAmount <= range.max;
};

/**
 * Update pattern confidence based on match success
 */
export const updatePatternConfidence = (
  currentConfidence: number,
  matchSuccessful: boolean,
  matchCount: number
): number => {
  // Increase confidence on successful match, decrease on failure
  const delta = matchSuccessful ? 2 : -5;

  // Weight decreases as match count increases (more stable over time)
  const weight = Math.max(0.1, 1 / Math.sqrt(matchCount + 1));

  const newConfidence = currentConfidence + delta * weight;

  // Clamp between 0 and 100
  return Math.max(0, Math.min(100, newConfidence));
};

/**
 * Add description pattern if not already present
 */
export const addDescriptionPattern = (
  patterns: string[],
  newPattern: string,
  maxPatterns = 10
): string[] => {
  const normalized = newPattern.toLowerCase().trim();

  if (!normalized || patterns.includes(normalized)) {
    return patterns;
  }

  const updated = [...patterns, normalized];

  // Keep only the most recent patterns
  if (updated.length > maxPatterns) {
    return updated.slice(-maxPatterns);
  }

  return updated;
};

/**
 * Check if description matches any stored patterns
 */
export const descriptionMatchesPattern = (
  description: string,
  patterns: string[]
): boolean => {
  if (!description || patterns.length === 0) return false;

  const normalized = description.toLowerCase().trim();

  for (const pattern of patterns) {
    if (
      normalized.includes(pattern) ||
      pattern.includes(normalized) ||
      normalized === pattern
    ) {
      return true;
    }
  }

  return false;
};

/**
 * Calculate amount range from historical amounts
 */
export const calculateAmountRange = (
  amounts: number[],
  tolerance = 0.1 // 10% tolerance
): { min: number; max: number } | null => {
  if (amounts.length === 0) return null;

  const absAmounts = amounts.map(Math.abs);
  const min = Math.min(...absAmounts);
  const max = Math.max(...absAmounts);

  // Add tolerance buffer
  const range = max - min;
  const buffer = range * tolerance;

  return {
    min: Math.floor(min - buffer),
    max: Math.ceil(max + buffer),
  };
};

/**
 * Calculate typical day of month from historical dates
 */
export const calculateTypicalDayOfMonth = (timestamps: number[]): number | null => {
  if (timestamps.length === 0) return null;

  const days = timestamps.map(getDayOfMonth);

  // Find mode (most common day)
  const dayCounts = new Map<number, number>();
  for (const day of days) {
    dayCounts.set(day, (dayCounts.get(day) || 0) + 1);
  }

  let maxCount = 0;
  let typicalDay: number | null = null;

  const entries = Array.from(dayCounts.entries());
  for (const [day, count] of entries) {
    if (count > maxCount) {
      maxCount = count;
      typicalDay = day;
    }
  }

  // Only return if it appears in at least 30% of cases
  if (typicalDay && maxCount >= timestamps.length * 0.3) {
    return typicalDay;
  }

  return null;
};
