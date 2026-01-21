/**
 * JournalEntry Matching Algorithm
 *
 * Automatically matches bank statement transactions with system transactions.
 * Uses multiple matching strategies with confidence scores.
 */

import type {
  StatementTransaction,
  TransactionMatch,
  MatchingOptions,
} from '../../types/reconciliation.types';
import { DEFAULT_MATCHING_OPTIONS, MatchConfidence } from '../../types/reconciliation.types';
import type { JournalEntry } from '../../types';
import { logger } from '../logger';

/**
 * Match statement transactions with system transactions
 */
export function matchJournalEntrys(
  statementJournalEntrys: StatementTransaction[],
  systemJournalEntrys: JournalEntry[],
  options: Partial<MatchingOptions> = {}
): TransactionMatch[] {
  const opts: MatchingOptions = {
    ...DEFAULT_MATCHING_OPTIONS,
    ...options,
  };

  const matches: TransactionMatch[] = [];
  const usedSystemJournalEntrys = new Set<string>();

  // Sort statement transactions by date for better matching
  const sortedStatementTxs = [...statementJournalEntrys].sort((a, b) => a.date - b.date);

  for (const statementTx of sortedStatementTxs) {
    // Find potential matches
    const potentialMatches = findPotentialMatches(
      statementTx,
      systemJournalEntrys,
      usedSystemJournalEntrys,
      opts
    );

    // If we have high-confidence matches, use the best one
    if (potentialMatches.length > 0) {
      const bestMatch = potentialMatches[0]!; // Already sorted by score

      if (bestMatch.score >= opts.minConfidenceScore) {
        matches.push(bestMatch);
        usedSystemJournalEntrys.add(bestMatch.systemTransactionId);
      }
    }
  }

  logger.info('Auto-matching completed', {
    statementCount: statementJournalEntrys.length,
    systemCount: systemJournalEntrys.length,
    matchedCount: matches.length,
    matchRate: `${((matches.length / statementJournalEntrys.length) * 100).toFixed(1)}%`,
  });

  return matches;
}

/**
 * Find potential matches for a statement transaction
 */
function findPotentialMatches(
  statementTx: StatementTransaction,
  systemJournalEntrys: JournalEntry[],
  usedJournalEntrys: Set<string>,
  options: MatchingOptions
): TransactionMatch[] {
  const potentialMatches: TransactionMatch[] = [];

  for (const sysTx of systemJournalEntrys) {
    // Skip already matched transactions
    if (usedJournalEntrys.has(sysTx.id)) {
      continue;
    }

    // Skip reconciled transactions
    if (sysTx.status === ('RECONCILED' as any)) {
      continue;
    }

    const match = evaluateMatch(statementTx, sysTx, options);

    if (match && match.score >= options.minConfidenceScore) {
      potentialMatches.push(match);
    }
  }

  // Sort by score (highest first)
  potentialMatches.sort((a, b) => b.score - a.score);

  return potentialMatches;
}

/**
 * Evaluate if two transactions match and calculate confidence score
 */
function evaluateMatch(
  statementTx: StatementTransaction,
  sysTx: JournalEntry,
  options: MatchingOptions
): TransactionMatch | null {
  const reasons: string[] = [];
  let score = 0;

  // Calculate transaction amount from line items
  const sysAmount = calculateTransactionAmount(sysTx);

  // 1. Check amount match (most important - 40 points)
  const amountMatch = checkAmountMatch(statementTx.amount, sysAmount, options.amountTolerance);

  if (!amountMatch.matches) {
    return null; // Amount must match (within tolerance)
  }

  score += 40;
  reasons.push(`Amount matches: ${formatCents(statementTx.amount)}`);

  // 2. Check date match (30 points for exact, sliding scale for near matches)
  const sysDate = sysTx.date instanceof Date ? sysTx.date.getTime() : sysTx.date;
  const dateMatch = checkDateMatch(statementTx.date, sysDate, options.dateTolerance);

  if (dateMatch.exactMatch) {
    score += 30;
    reasons.push('Date matches exactly');
  } else if (dateMatch.daysDiff <= options.dateTolerance) {
    const dateScore = 30 * (1 - dateMatch.daysDiff / options.dateTolerance);
    score += dateScore;
    reasons.push(`Date within ${dateMatch.daysDiff} day(s)`);
  }

  // 3. Check description similarity (30 points)
  const descriptionScore = calculateDescriptionSimilarity(
    statementTx.description,
    sysTx.memo || sysTx.reference || ''
  );

  if (descriptionScore >= options.descriptionSimilarityThreshold) {
    score += 30 * (descriptionScore / 100);
    reasons.push(`Description ${descriptionScore.toFixed(0)}% similar`);
  }

  // Determine confidence level based on score
  let confidence: MatchConfidence;

  if (score >= 90 && dateMatch.exactMatch) {
    confidence = MatchConfidence.EXACT;
  } else if (score >= 75) {
    confidence = MatchConfidence.HIGH;
  } else if (score >= 60) {
    confidence = MatchConfidence.MEDIUM;
  } else {
    confidence = MatchConfidence.LOW;
  }

  return {
    statementTransactionId: statementTx.id,
    systemTransactionId: sysTx.id,
    confidence,
    score,
    reasons,
  };
}

/**
 * Calculate total amount from transaction line items
 */
function calculateTransactionAmount(transaction: JournalEntry): number {
  // Handle transactions without lines (test data or incomplete transactions)
  if (!transaction.lines || !Array.isArray(transaction.lines) || transaction.lines.length === 0) {
    return 0
  }

  // Calculate net amount from transaction lines
  // For matching purposes, we use the absolute value of the larger side (debit or credit)
  // This represents the transaction amount regardless of direction

  let totalDebits = 0
  let totalCredits = 0

  for (const line of transaction.lines) {
    totalDebits += line.debit
    totalCredits += line.credit
  }

  // Return the larger of the two (they should be equal in double-entry, but just in case)
  return Math.max(totalDebits, totalCredits)
}

/**
 * Check if amounts match within tolerance
 * Compares absolute values since statement and system may have opposite signs
 */
function checkAmountMatch(
  amount1: number,
  amount2: number,
  tolerancePercent: number
): { matches: boolean; diff: number } {
  const abs1 = Math.abs(amount1);
  const abs2 = Math.abs(amount2);
  const diff = Math.abs(abs1 - abs2);
  const tolerance = abs1 * (tolerancePercent / 100);

  return {
    matches: diff <= tolerance,
    diff,
  };
}

/**
 * Check if dates match within tolerance
 */
function checkDateMatch(
  date1: number,
  date2: number,
  _toleranceDays: number
): { exactMatch: boolean; daysDiff: number } {
  const diffMs = Math.abs(date1 - date2);
  const daysDiff = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return {
    exactMatch: daysDiff === 0,
    daysDiff,
  };
}

/**
 * Calculate similarity between two description strings
 * Uses a simple approach based on common words
 */
function calculateDescriptionSimilarity(desc1: string, desc2: string): number {
  if (!desc1 || !desc2) return 0;

  // Normalize descriptions
  const normalize = (str: string) =>
    str
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2); // Ignore short words

  const words1 = normalize(desc1);
  const words2 = normalize(desc2);

  if (words1.length === 0 || words2.length === 0) return 0;

  // Count common words
  const set1 = new Set(words1);
  const set2 = new Set(words2);

  const commonWords = [...set1].filter(word => set2.has(word));

  // Calculate Jaccard similarity
  const union = new Set([...words1, ...words2]);
  const similarity = (commonWords.length / union.size) * 100;

  // Bonus for exact match
  if (desc1.toLowerCase().trim() === desc2.toLowerCase().trim()) {
    return 100;
  }

  // Bonus for one string containing the other
  if (desc1.toLowerCase().includes(desc2.toLowerCase()) ||
      desc2.toLowerCase().includes(desc1.toLowerCase())) {
    return Math.max(similarity, 80);
  }

  return similarity;
}

/**
 * Format cents to dollar string (for logging)
 */
function formatCents(cents: number): string {
  const dollars = Math.abs(cents) / 100;
  const sign = cents < 0 ? '-' : '';
  return `${sign}$${dollars.toFixed(2)}`;
}

/**
 * Get match confidence description for UI
 */
export function getConfidenceDescription(confidence: MatchConfidence): string {
  switch (confidence) {
    case 'EXACT':
      return 'Perfect match - date, amount, and description all match';
    case 'HIGH':
      return 'Very likely match - date and amount match, description similar';
    case 'MEDIUM':
      return 'Possible match - amount matches, date is close';
    case 'LOW':
      return 'Uncertain match - only amount matches';
    case 'MANUAL':
      return 'Manually matched by you';
    default:
      return 'Unknown confidence level';
  }
}

/**
 * Calculate match statistics
 */
export function calculateMatchStats(matches: TransactionMatch[]): {
  total: number;
  exact: number;
  high: number;
  medium: number;
  low: number;
  manual: number;
} {
  return {
    total: matches.length,
    exact: matches.filter(m => m.confidence === 'EXACT').length,
    high: matches.filter(m => m.confidence === 'HIGH').length,
    medium: matches.filter(m => m.confidence === 'MEDIUM').length,
    low: matches.filter(m => m.confidence === 'LOW').length,
    manual: matches.filter(m => m.confidence === 'MANUAL').length,
  };
}

/**
 * Backwards-compatible alias for matchJournalEntrys
 * @deprecated Use matchJournalEntrys instead
 */
export const matchTransactions = matchJournalEntrys;
