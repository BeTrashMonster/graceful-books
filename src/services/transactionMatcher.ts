/**
 * Transaction Matching Service
 *
 * Automatically matches bank statement transactions with system transactions
 * using a multi-factor scoring algorithm.
 *
 * Target: >85% auto-match accuracy (per ROADMAP E1)
 * Per ACCT-004: Auto-matching algorithm
 */

import {
  DEFAULT_MATCHING_OPTIONS,
  MatchConfidence,
  type StatementTransaction,
  type TransactionMatch,
  type MatchingOptions,
} from '../types/reconciliation.types';
import type { JournalEntry } from '../types';
import { logger } from '../utils/logger';

// =============================================================================
// String Similarity
// =============================================================================

/**
 * Calculate Levenshtein distance between two strings
 * (number of edits needed to transform one string into another)
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = [];

  for (let i = 0; i <= m; i++) {
    dp[i] = [];
    for (let j = 0; j <= n; j++) {
      if (i === 0) {
        dp[i][j] = j;
      } else if (j === 0) {
        dp[i][j] = i;
      } else {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j]! + 1, // deletion
          dp[i][j - 1]! + 1, // insertion
          dp[i - 1][j - 1]! + cost // substitution
        );
      }
    }
  }

  return dp[m][n]!;
}

/**
 * Calculate similarity score between two strings (0-100)
 * Higher score = more similar
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;

  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 100;

  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 100;

  const distance = levenshteinDistance(s1, s2);
  const similarity = ((maxLen - distance) / maxLen) * 100;

  return Math.round(similarity);
}

/**
 * Extract and normalize key terms from description
 */
function extractKeyTerms(description: string): string[] {
  // Remove common words and normalize
  const stopWords = new Set([
    'the',
    'a',
    'an',
    'and',
    'or',
    'but',
    'in',
    'on',
    'at',
    'to',
    'for',
    'from',
    'with',
  ]);

  const normalized = description
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word));

  return normalized;
}

/**
 * Calculate semantic similarity based on shared key terms
 */
function calculateSemanticSimilarity(desc1: string, desc2: string): number {
  const terms1 = new Set(extractKeyTerms(desc1));
  const terms2 = new Set(extractKeyTerms(desc2));

  if (terms1.size === 0 && terms2.size === 0) return 100;
  if (terms1.size === 0 || terms2.size === 0) return 0;

  // Calculate Jaccard similarity (intersection / union)
  const intersection = new Set([...terms1].filter((x) => terms2.has(x)));
  const union = new Set([...terms1, ...terms2]);

  return Math.round((intersection.size / union.size) * 100);
}

/**
 * Calculate combined description similarity
 */
function calculateDescriptionSimilarity(desc1: string, desc2: string): number {
  const stringSimilarity = calculateStringSimilarity(desc1, desc2);
  const semanticSimilarity = calculateSemanticSimilarity(desc1, desc2);

  // Weight both approaches
  return Math.round(stringSimilarity * 0.6 + semanticSimilarity * 0.4);
}

// =============================================================================
// Matching Logic
// =============================================================================

/**
 * Check if dates match within tolerance
 */
function datesMatch(
  statementDate: number,
  systemDate: Date,
  toleranceDays: number
): boolean {
  const systemTimestamp = systemDate.getTime();
  const diffMs = Math.abs(statementDate - systemTimestamp);
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  return diffDays <= toleranceDays;
}

/**
 * Check if amounts match within tolerance
 */
function amountsMatch(
  statementAmount: number,
  systemAmount: number,
  tolerancePercent: number
): boolean {
  if (statementAmount === systemAmount) return true;

  const diff = Math.abs(statementAmount - systemAmount);
  const larger = Math.max(Math.abs(statementAmount), Math.abs(systemAmount));

  if (larger === 0) return statementAmount === systemAmount;

  const percentDiff = (diff / larger) * 100;
  return percentDiff <= tolerancePercent;
}

/**
 * Get total amount from journal entry
 * For reconciliation, we typically look at one side (debit or credit) depending on account type
 */
function getJournalEntryAmount(entry: JournalEntry, accountId: string): number {
  // Find the line for the specific account being reconciled
  const accountLine = entry.lines.find((line) => line.accountId === accountId);

  if (!accountLine) {
    // If the account isn't directly referenced, sum all debits or credits
    const totalDebits = entry.lines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredits = entry.lines.reduce((sum, line) => sum + line.credit, 0);

    // Return the non-zero side (in cents)
    return totalDebits > 0 ? Math.round(totalDebits * 100) : Math.round(-totalCredits * 100);
  }

  // Return debit (positive) or credit (negative) in cents
  if (accountLine.debit > 0) {
    return Math.round(accountLine.debit * 100);
  } else {
    return Math.round(-accountLine.credit * 100);
  }
}

/**
 * Calculate match score between statement transaction and system transaction
 */
function calculateMatchScore(
  statementTxn: StatementTransaction,
  systemTxn: JournalEntry,
  accountId: string,
  options: MatchingOptions
): { score: number; confidence: MatchConfidence; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  // 1. Date matching (40 points max)
  const dateMatches = datesMatch(
    statementTxn.date,
    systemTxn.date,
    options.dateTolerance
  );

  if (dateMatches) {
    const dateDiffMs = Math.abs(statementTxn.date - systemTxn.date.getTime());
    const dateDiffDays = dateDiffMs / (1000 * 60 * 60 * 24);

    if (dateDiffDays === 0) {
      score += 40;
      reasons.push('Exact date match');
    } else if (dateDiffDays <= 1) {
      score += 35;
      reasons.push('Date within 1 day');
    } else {
      score += 25;
      reasons.push(`Date within ${Math.ceil(dateDiffDays)} days`);
    }
  }

  // 2. Amount matching (40 points max)
  const systemAmount = getJournalEntryAmount(systemTxn, accountId);
  const amountMatches = amountsMatch(
    statementTxn.amount,
    systemAmount,
    options.amountTolerance
  );

  if (amountMatches) {
    if (statementTxn.amount === systemAmount) {
      score += 40;
      reasons.push('Exact amount match');
    } else {
      score += 30;
      reasons.push('Amount within tolerance');
    }
  }

  // 3. Description similarity (20 points max)
  const systemDescription = systemTxn.memo || systemTxn.reference || '';
  const descriptionSimilarity = calculateDescriptionSimilarity(
    statementTxn.description,
    systemDescription
  );

  if (descriptionSimilarity >= options.descriptionSimilarityThreshold) {
    const descScore = Math.round((descriptionSimilarity / 100) * 20);
    score += descScore;
    reasons.push(`Description ${descriptionSimilarity}% similar`);
  }

  // 4. Reference number match (bonus 10 points)
  if (statementTxn.reference && systemTxn.reference) {
    if (statementTxn.reference === systemTxn.reference) {
      score += 10;
      reasons.push('Reference number matches');
    }
  }

  // Determine confidence level
  let confidence: MatchConfidence;
  if (score >= 90 && dateMatches && amountMatches) {
    confidence = MatchConfidence.EXACT;
  } else if (score >= 75 && dateMatches && amountMatches) {
    confidence = MatchConfidence.HIGH;
  } else if (score >= 60 && amountMatches) {
    confidence = MatchConfidence.MEDIUM;
  } else if (score >= options.minConfidenceScore) {
    confidence = MatchConfidence.LOW;
  } else {
    // Below minimum confidence
    confidence = MatchConfidence.LOW;
    score = 0;
    return { score, confidence, reasons: [] };
  }

  return { score, confidence, reasons };
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Find best matches for statement transactions
 *
 * Returns suggested matches sorted by confidence score
 */
export function matchTransactions(
  statementTransactions: StatementTransaction[],
  systemTransactions: JournalEntry[],
  accountId: string,
  options: MatchingOptions = DEFAULT_MATCHING_OPTIONS
): TransactionMatch[] {
  const matches: TransactionMatch[] = [];

  // Filter out already reconciled transactions
  const unreconciledSystem = systemTransactions.filter(
    (txn) => txn.status !== 'reconciled' && !txn.deletedAt
  );

  // Track which system transactions have been matched
  const matchedSystemIds = new Set<string>();

  for (const statementTxn of statementTransactions) {
    if (statementTxn.matched) continue;

    let bestMatch: TransactionMatch | null = null;
    let bestScore = 0;

    for (const systemTxn of unreconciledSystem) {
      // Skip if already matched to another statement transaction
      if (matchedSystemIds.has(systemTxn.id)) continue;

      const { score, confidence, reasons } = calculateMatchScore(
        statementTxn,
        systemTxn,
        accountId,
        options
      );

      if (score > bestScore && score >= options.minConfidenceScore) {
        bestScore = score;
        bestMatch = {
          statementTransactionId: statementTxn.id,
          systemTransactionId: systemTxn.id,
          confidence,
          score,
          reasons,
        };
      }
    }

    if (bestMatch) {
      matches.push(bestMatch);
      matchedSystemIds.add(bestMatch.systemTransactionId);
    }
  }

  // Sort by confidence and score
  const confidenceOrder = { EXACT: 4, HIGH: 3, MEDIUM: 2, LOW: 1, MANUAL: 0 };
  matches.sort((a, b) => {
    const confDiff = confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
    if (confDiff !== 0) return confDiff;
    return b.score - a.score;
  });

  logger.info('Auto-matching complete', {
    totalStatementTxns: statementTransactions.length,
    totalSystemTxns: systemTransactions.length,
    matchesFound: matches.length,
    matchRate: `${Math.round((matches.length / statementTransactions.length) * 100)}%`,
  });

  return matches;
}

/**
 * Get match statistics
 */
export function getMatchStatistics(matches: TransactionMatch[]): {
  total: number;
  exact: number;
  high: number;
  medium: number;
  low: number;
  manual: number;
} {
  return {
    total: matches.length,
    exact: matches.filter((m) => m.confidence === 'EXACT').length,
    high: matches.filter((m) => m.confidence === 'HIGH').length,
    medium: matches.filter((m) => m.confidence === 'MEDIUM').length,
    low: matches.filter((m) => m.confidence === 'LOW').length,
    manual: matches.filter((m) => m.confidence === 'MANUAL').length,
  };
}
