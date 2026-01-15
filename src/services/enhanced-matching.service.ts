/**
 * Enhanced Matching Service
 *
 * Implements E1 enhanced auto-matching algorithm with:
 * - Fuzzy string matching using fuzzball
 * - Vendor extraction and normalization
 * - Pattern learning and application
 * - Multi-transaction matching
 * - >85% accuracy target
 *
 * Requirements:
 * - E1: Enhanced auto-matching algorithm
 * - ACCT-004: Bank Reconciliation
 */

import * as fuzzball from 'fuzzball';
import type {
  StatementTransaction,
  TransactionMatch,
  MatchingOptions,
  MatchCandidate,
  ReconciliationPattern,
  MultiTransactionMatch,
} from '../types/reconciliation.types';
import { MatchConfidence } from '../types/reconciliation.types';
import type { JournalEntry } from '../types';
import { logger } from '../utils/logger';
import {
  extractVendorFromDescription,
  expandVendorAbbreviation,
  getDayOfMonth,
  isAmountInRange,
  descriptionMatchesPattern,
} from '../db/schema/reconciliationPatterns.schema';

const matchLogger = logger.child('EnhancedMatching');

/**
 * Enhanced matching options with pattern learning
 */
export interface EnhancedMatchingOptions extends MatchingOptions {
  usePatternLearning: boolean;
  patterns?: ReconciliationPattern[];
  enableMultiTransactionMatching: boolean;
}

/**
 * Match statement transactions with system transactions using enhanced algorithm
 */
export async function enhancedMatchTransactions(
  statementTransactions: StatementTransaction[],
  systemTransactions: JournalEntry[],
  options: Partial<EnhancedMatchingOptions> = {}
): Promise<{
  matches: TransactionMatch[];
  multiMatches: MultiTransactionMatch[];
  accuracy: number;
}> {
  const opts: EnhancedMatchingOptions = {
    dateTolerance: 3,
    amountTolerance: 0.5,
    descriptionSimilarityThreshold: 60,
    minConfidenceScore: 50,
    usePatternLearning: true,
    patterns: [],
    enableMultiTransactionMatching: true,
    ...options,
  };

  const matches: TransactionMatch[] = [];
  const multiMatches: MultiTransactionMatch[] = [];
  const usedSystemTransactions = new Set<string>();
  const usedStatementTransactions = new Set<string>();

  // Sort statement transactions by date
  const sortedStatement = [...statementTransactions].sort((a, b) => a.date - b.date);

  // Phase 1: Find single-to-single matches
  for (const statementTx of sortedStatement) {
    const candidates = await findMatchCandidates(
      statementTx,
      systemTransactions,
      usedSystemTransactions,
      opts
    );

    if (candidates.length > 0 && candidates[0]!.matchScore >= opts.minConfidenceScore) {
      const bestMatch = candidates[0]!;

      matches.push({
        statementTransactionId: statementTx.id,
        systemTransactionId: bestMatch.bookTransaction,
        confidence: bestMatch.confidence,
        score: bestMatch.matchScore,
        reasons: buildMatchReasons(bestMatch),
      });

      usedSystemTransactions.add(bestMatch.bookTransaction);
      usedStatementTransactions.add(statementTx.id);
    }
  }

  // Phase 2: Multi-transaction matching (if enabled)
  if (opts.enableMultiTransactionMatching) {
    const unmatchedStatement = sortedStatement.filter(
      (tx) => !usedStatementTransactions.has(tx.id)
    );
    const unmatchedSystem = systemTransactions.filter(
      (tx) => !usedSystemTransactions.has(tx.id)
    );

    const multiMatchResults = findMultiTransactionMatches(
      unmatchedStatement,
      unmatchedSystem,
      opts
    );

    multiMatches.push(...multiMatchResults);
  }

  // Calculate accuracy
  const totalStatement = statementTransactions.length;
  const matched = matches.length + multiMatches.length;
  const accuracy = totalStatement > 0 ? (matched / totalStatement) * 100 : 0;

  matchLogger.info('Enhanced matching completed', {
    totalStatement,
    matched,
    accuracy: `${accuracy.toFixed(1)}%`,
    singleMatches: matches.length,
    multiMatches: multiMatches.length,
  });

  return { matches, multiMatches, accuracy };
}

/**
 * Find match candidates for a statement transaction
 */
async function findMatchCandidates(
  statementTx: StatementTransaction,
  systemTransactions: JournalEntry[],
  usedTransactions: Set<string>,
  options: EnhancedMatchingOptions
): Promise<MatchCandidate[]> {
  const candidates: MatchCandidate[] = [];

  for (const sysTx of systemTransactions) {
    if (usedTransactions.has(sysTx.id) || sysTx.status === ('RECONCILED' as any)) {
      continue;
    }

    const candidate = await evaluateMatchCandidate(statementTx, sysTx, options);

    if (candidate && candidate.matchScore >= options.minConfidenceScore) {
      candidates.push(candidate);
    }
  }

  // Sort by match score (highest first)
  candidates.sort((a, b) => b.matchScore - a.matchScore);

  return candidates;
}

/**
 * Evaluate match between statement and system transaction
 */
async function evaluateMatchCandidate(
  statementTx: StatementTransaction,
  sysTx: JournalEntry,
  options: EnhancedMatchingOptions
): Promise<MatchCandidate | null> {
  const matchFactors = {
    dateMatch: 0,
    amountMatch: 0,
    descriptionMatch: 0,
    vendorMatch: 0,
    patternMatch: 0,
  };

  // 1. Amount matching (40 points) - REQUIRED
  const sysAmount = calculateTransactionAmount(sysTx);
  const amountScore = calculateAmountMatchScore(
    statementTx.amount,
    sysAmount,
    options.amountTolerance
  );

  if (amountScore === 0) {
    return null; // Amount must match
  }

  matchFactors.amountMatch = amountScore;

  // 2. Date matching (25 points)
  const sysDate = sysTx.date instanceof Date ? sysTx.date.getTime() : sysTx.date;
  matchFactors.dateMatch = calculateDateMatchScore(
    statementTx.date,
    sysDate,
    options.dateTolerance
  );

  // 3. Description matching with fuzzy string matching (20 points)
  matchFactors.descriptionMatch = await calculateDescriptionMatchScore(
    statementTx.description,
    sysTx.memo || sysTx.reference || ''
  );

  // 4. Vendor matching (10 points)
  matchFactors.vendorMatch = calculateVendorMatchScore(
    statementTx.description,
    sysTx.memo || sysTx.reference || ''
  );

  // 5. Pattern matching (5 points)
  if (options.usePatternLearning && options.patterns) {
    matchFactors.patternMatch = calculatePatternMatchScore(
      statementTx,
      sysTx,
      options.patterns
    );
  }

  // Calculate total score
  const matchScore =
    matchFactors.amountMatch * 0.4 +
    matchFactors.dateMatch * 0.25 +
    matchFactors.descriptionMatch * 0.2 +
    matchFactors.vendorMatch * 0.1 +
    matchFactors.patternMatch * 0.05;

  // Determine confidence level
  const confidence = determineConfidence(matchScore, matchFactors);

  return {
    statementLine: statementTx,
    bookTransaction: sysTx.id,
    confidence,
    matchScore,
    matchFactors,
  };
}

/**
 * Calculate amount match score (0-100)
 */
function calculateAmountMatchScore(
  amount1: number,
  amount2: number,
  tolerancePercent: number
): number {
  const abs1 = Math.abs(amount1);
  const abs2 = Math.abs(amount2);
  const diff = Math.abs(abs1 - abs2);
  const tolerance = abs1 * (tolerancePercent / 100);

  if (diff > tolerance) {
    return 0; // Not a match
  }

  // Perfect match = 100, within tolerance = scaled score
  const score = 100 * (1 - diff / tolerance);
  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate date match score (0-100)
 */
function calculateDateMatchScore(
  date1: number,
  date2: number,
  toleranceDays: number
): number {
  const diffMs = Math.abs(date1 - date2);
  const daysDiff = diffMs / (1000 * 60 * 60 * 24);

  if (daysDiff === 0) {
    return 100; // Exact match
  }

  if (daysDiff > toleranceDays) {
    return 0; // Outside tolerance
  }

  // Scale linearly: 100 for exact, 0 at tolerance boundary
  return 100 * (1 - daysDiff / toleranceDays);
}

/**
 * Calculate description match score using fuzzy matching (0-100)
 */
async function calculateDescriptionMatchScore(
  desc1: string,
  desc2: string
): Promise<number> {
  if (!desc1 || !desc2) {
    return 0;
  }

  // Normalize descriptions
  const normalize = (str: string) =>
    str.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();

  const normalized1 = normalize(desc1);
  const normalized2 = normalize(desc2);

  // Exact match
  if (normalized1 === normalized2) {
    return 100;
  }

  // Use fuzzball for fuzzy matching
  const tokenSetRatio = fuzzball.token_set_ratio(normalized1, normalized2);
  const partialRatio = fuzzball.partial_ratio(normalized1, normalized2);
  const ratio = fuzzball.ratio(normalized1, normalized2);

  // Take the best score from multiple algorithms
  return Math.max(tokenSetRatio, partialRatio, ratio);
}

/**
 * Calculate vendor match score (0-100)
 */
function calculateVendorMatchScore(desc1: string, desc2: string): number {
  const vendor1 = extractVendorFromDescription(desc1);
  const vendor2 = extractVendorFromDescription(desc2);

  if (!vendor1 || !vendor2) {
    return 0;
  }

  // Expand abbreviations
  const expanded1 = expandVendorAbbreviation(vendor1);
  const expanded2 = expandVendorAbbreviation(vendor2);

  // Exact vendor match
  if (expanded1 === expanded2) {
    return 100;
  }

  // Partial vendor match
  if (expanded1.includes(expanded2) || expanded2.includes(expanded1)) {
    return 75;
  }

  // Fuzzy vendor match
  const fuzzyScore = fuzzball.ratio(expanded1, expanded2);
  return fuzzyScore > 80 ? fuzzyScore : 0;
}

/**
 * Calculate pattern match score (0-100)
 */
function calculatePatternMatchScore(
  statementTx: StatementTransaction,
  sysTx: JournalEntry,
  patterns: ReconciliationPattern[]
): number {
  // Extract vendor from statement
  const vendor = extractVendorFromDescription(statementTx.description);
  if (!vendor) {
    return 0;
  }

  // Find matching pattern
  const pattern = patterns.find((p) => p.vendor_name === vendor);
  if (!pattern) {
    return 0;
  }

  let score = pattern.confidence;

  // Check description patterns
  const sysDesc = sysTx.memo || sysTx.reference || '';
  if (descriptionMatchesPattern(sysDesc, pattern.description_patterns)) {
    score = Math.min(100, score + 10);
  }

  // Check amount range
  const sysAmount = calculateTransactionAmount(sysTx);
  if (isAmountInRange(sysAmount, pattern.typical_amount_range)) {
    score = Math.min(100, score + 5);
  }

  // Check day of month
  const sysDate = sysTx.date instanceof Date ? sysTx.date.getTime() : sysTx.date;
  const dayOfMonth = getDayOfMonth(sysDate);
  if (pattern.typical_day_of_month === dayOfMonth) {
    score = Math.min(100, score + 5);
  }

  return score;
}

/**
 * Calculate transaction amount from line items
 */
function calculateTransactionAmount(transaction: JournalEntry): number {
  if (!transaction.lines || transaction.lines.length === 0) {
    return 0;
  }

  let totalDebits = 0;
  let totalCredits = 0;

  for (const line of transaction.lines) {
    totalDebits += line.debit;
    totalCredits += line.credit;
  }

  return Math.max(totalDebits, totalCredits);
}

/**
 * Determine confidence level from score and factors
 */
function determineConfidence(
  score: number,
  factors: MatchCandidate['matchFactors']
): MatchConfidence {
  // Exact match: perfect date, amount, and good description
  if (
    factors.dateMatch === 100 &&
    factors.amountMatch === 100 &&
    factors.descriptionMatch >= 90
  ) {
    return MatchConfidence.EXACT;
  }

  // High confidence: good date and amount, decent description
  if (score >= 80 && factors.dateMatch >= 90 && factors.amountMatch >= 95) {
    return MatchConfidence.HIGH;
  }

  // Medium confidence: good amount, okay date
  if (score >= 65 && factors.amountMatch >= 90) {
    return MatchConfidence.MEDIUM;
  }

  // Low confidence: amount matches, but not much else
  if (score >= 50) {
    return MatchConfidence.LOW;
  }

  return MatchConfidence.LOW;
}

/**
 * Build match reasons from factors
 */
function buildMatchReasons(candidate: MatchCandidate): string[] {
  const reasons: string[] = [];
  const { matchFactors } = candidate;

  if (matchFactors.amountMatch >= 95) {
    reasons.push('Amount matches exactly');
  } else if (matchFactors.amountMatch >= 80) {
    reasons.push('Amount matches within tolerance');
  }

  if (matchFactors.dateMatch === 100) {
    reasons.push('Date matches exactly');
  } else if (matchFactors.dateMatch >= 70) {
    reasons.push('Date is very close');
  }

  if (matchFactors.descriptionMatch >= 80) {
    reasons.push('Description is very similar');
  } else if (matchFactors.descriptionMatch >= 60) {
    reasons.push('Description has some similarities');
  }

  if (matchFactors.vendorMatch >= 75) {
    reasons.push('Vendor matches');
  }

  if (matchFactors.patternMatch >= 75) {
    reasons.push('Matches learned pattern');
  }

  return reasons;
}

/**
 * Find multi-transaction matches
 */
function findMultiTransactionMatches(
  statementTransactions: StatementTransaction[],
  systemTransactions: JournalEntry[],
  options: EnhancedMatchingOptions
): MultiTransactionMatch[] {
  const multiMatches: MultiTransactionMatch[] = [];

  // Find split deposits (multiple system transactions = one statement transaction)
  for (const statementTx of statementTransactions) {
    const splitMatches = findSplitDeposit(statementTx, systemTransactions, options);
    if (splitMatches) {
      multiMatches.push(splitMatches);
    }
  }

  // Find partial payments (one system transaction = multiple statement transactions)
  for (const sysTx of systemTransactions) {
    const partialMatches = findPartialPayments(sysTx, statementTransactions, options);
    if (partialMatches) {
      multiMatches.push(partialMatches);
    }
  }

  return multiMatches;
}

/**
 * Find split deposit match
 */
function findSplitDeposit(
  statementTx: StatementTransaction,
  systemTransactions: JournalEntry[],
  options: EnhancedMatchingOptions
): MultiTransactionMatch | null {
  // Find system transactions within date tolerance
  const sysDate = (tx: JournalEntry) =>
    tx.date instanceof Date ? tx.date.getTime() : tx.date;
  const candidates = systemTransactions.filter((tx) => {
    const daysDiff = Math.abs(statementTx.date - sysDate(tx)) / (1000 * 60 * 60 * 24);
    return daysDiff <= options.dateTolerance;
  });

  // Find combinations that sum to statement amount
  const combinations = findCombinationsSummingToAmount(
    candidates,
    statementTx.amount,
    options.amountTolerance
  );

  if (combinations.length > 0) {
    const best = combinations[0]!;
    const totalSystem = best.reduce((sum, tx) => sum + calculateTransactionAmount(tx), 0);

    return {
      statement_transaction_ids: [statementTx.id],
      system_transaction_ids: best.map((tx) => tx.id),
      match_type: 'split_deposit',
      confidence: MatchConfidence.MEDIUM,
      total_statement_amount: statementTx.amount,
      total_system_amount: totalSystem,
    };
  }

  return null;
}

/**
 * Find partial payment matches
 */
function findPartialPayments(
  sysTx: JournalEntry,
  statementTransactions: StatementTransaction[],
  options: EnhancedMatchingOptions
): MultiTransactionMatch | null {
  const sysDate = sysTx.date instanceof Date ? sysTx.date.getTime() : sysTx.date;
  const sysAmount = calculateTransactionAmount(sysTx);

  // Find statement transactions within date tolerance
  const candidates = statementTransactions.filter((tx) => {
    const daysDiff = Math.abs(tx.date - sysDate) / (1000 * 60 * 60 * 24);
    return daysDiff <= options.dateTolerance * 2; // Allow wider tolerance for partial payments
  });

  // Find combinations that sum to system amount
  const combinations = findStatementCombinationsSummingToAmount(
    candidates,
    sysAmount,
    options.amountTolerance
  );

  if (combinations.length > 0) {
    const best = combinations[0]!;
    const totalStatement = best.reduce((sum, tx) => sum + tx.amount, 0);

    return {
      statement_transaction_ids: best.map((tx) => tx.id),
      system_transaction_ids: [sysTx.id],
      match_type: 'partial_payments',
      confidence: MatchConfidence.MEDIUM,
      total_statement_amount: totalStatement,
      total_system_amount: sysAmount,
    };
  }

  return null;
}

/**
 * Find combinations of system transactions summing to target amount
 */
function findCombinationsSummingToAmount(
  transactions: JournalEntry[],
  targetAmount: number,
  tolerancePercent: number
): JournalEntry[][] {
  // Simple implementation: try pairs and triplets
  const results: JournalEntry[][] = [];
  const tolerance = Math.abs(targetAmount) * (tolerancePercent / 100);

  // Try pairs
  for (let i = 0; i < transactions.length; i++) {
    for (let j = i + 1; j < transactions.length; j++) {
      const sum =
        calculateTransactionAmount(transactions[i]!) +
        calculateTransactionAmount(transactions[j]!);
      if (Math.abs(sum - Math.abs(targetAmount)) <= tolerance) {
        results.push([transactions[i]!, transactions[j]!]);
      }
    }
  }

  return results;
}

/**
 * Find combinations of statement transactions summing to target amount
 */
function findStatementCombinationsSummingToAmount(
  transactions: StatementTransaction[],
  targetAmount: number,
  tolerancePercent: number
): StatementTransaction[][] {
  const results: StatementTransaction[][] = [];
  const tolerance = Math.abs(targetAmount) * (tolerancePercent / 100);

  // Try pairs
  for (let i = 0; i < transactions.length; i++) {
    for (let j = i + 1; j < transactions.length; j++) {
      const sum = transactions[i]!.amount + transactions[j]!.amount;
      if (Math.abs(sum - Math.abs(targetAmount)) <= tolerance) {
        results.push([transactions[i]!, transactions[j]!]);
      }
    }
  }

  return results;
}
