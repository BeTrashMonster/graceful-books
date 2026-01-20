/**
 * Liability Payment Detection Service
 *
 * Implements multi-factor detection algorithm to identify loan/liability payments
 * with 97% accuracy target.
 *
 * Requirements:
 * - H7: Interest Split Prompt System
 * - ACCT-009: Loan Payment Detection (97% accuracy)
 */

import type { TreasureChestDB } from '../../db/database';
import type {
  Transaction,
  TransactionLineItem,
  Account,
  AccountType,
} from '../../types/database.types';
import type {
  LiabilityPaymentDetection,
  DetectionFactors,
  DetectionConfidence,
  BatchDetectionRequest,
  BatchDetectionResponse,
  LoanAccount,
} from '../../types/loanAmortization.types';
import Decimal from 'decimal.js';

/**
 * Keywords that suggest a loan payment in memos/descriptions
 */
const LOAN_KEYWORDS = [
  'loan',
  'payment',
  'principal',
  'interest',
  'mortgage',
  'financing',
  'installment',
  'monthly payment',
  'auto loan',
  'business loan',
  'line of credit',
  'loc payment',
  'credit card',
];

/**
 * Liability Payment Detection Service
 */
export class LiabilityDetectionService {
  private db: TreasureChestDB;

  constructor(db: TreasureChestDB) {
    this.db = db;
  }

  /**
   * Detect if a transaction is likely a loan/liability payment
   *
   * Uses multi-factor algorithm:
   * 1. Account type is LIABILITY (40 points)
   * 2. Regular payment pattern detected (25 points)
   * 3. Amount matches amortization schedule (20 points)
   * 4. Memo contains loan keywords (10 points)
   * 5. Payee matches known lender (3 points)
   * 6. Date matches scheduled payment date (2 points)
   *
   * Total: 100 points
   * High confidence: 80+
   * Medium confidence: 60-79
   * Low confidence: 40-59
   */
  async detectLiabilityPayment(
    transactionId: string
  ): Promise<LiabilityPaymentDetection> {
    // Get transaction with line items
    const transaction = await this.db.transactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    const lineItems = await this.db.transactionLineItems
      .where('transaction_id')
      .equals(transactionId)
      .and((item) => !item.deleted_at)
      .toArray();

    // Initialize factors
    const factors: DetectionFactors = {
      account_is_liability: false,
      regular_payment_pattern: false,
      amount_matches_schedule: false,
      memo_contains_loan_keywords: false,
      payee_matches_lender: false,
      date_matches_schedule: false,
    };

    let score = 0;
    let suggestedLoanAccountId: string | null = null;
    let suggestedPrincipal: string | null = null;
    let suggestedInterest: string | null = null;

    // Factor 1: Check if any line item credits a LIABILITY account (40 points)
    const liabilityLineItems = await this.findLiabilityLineItems(lineItems);
    if (liabilityLineItems.length > 0) {
      factors.account_is_liability = true;
      score += 40;

      // Use the first liability account as suggestion
      const liabilityAccount = await this.db.accounts.get(
        liabilityLineItems[0].account_id
      );
      if (liabilityAccount) {
        suggestedLoanAccountId = liabilityAccount.id;
      }
    }

    // Factor 2: Check for regular payment pattern (25 points)
    if (suggestedLoanAccountId) {
      const hasPattern = await this.checkRegularPaymentPattern(
        suggestedLoanAccountId,
        transaction.transaction_date
      );
      if (hasPattern) {
        factors.regular_payment_pattern = true;
        score += 25;
      }
    }

    // Factor 3: Check if amount matches amortization schedule (20 points)
    if (suggestedLoanAccountId) {
      const scheduleMatch = await this.checkScheduleMatch(
        suggestedLoanAccountId,
        transaction.transaction_date,
        this.getTotalAmount(lineItems, suggestedLoanAccountId)
      );
      if (scheduleMatch.matches) {
        factors.amount_matches_schedule = true;
        score += 20;
        suggestedPrincipal = scheduleMatch.principal;
        suggestedInterest = scheduleMatch.interest;
      }
    }

    // Factor 4: Check memo for loan keywords (10 points)
    const memoText = (
      transaction.description +
      ' ' +
      transaction.memo +
      ' ' +
      transaction.reference
    ).toLowerCase();
    if (this.containsLoanKeywords(memoText)) {
      factors.memo_contains_loan_keywords = true;
      score += 10;
    }

    // Factor 5: Check if payee matches known lender (3 points)
    if (suggestedLoanAccountId) {
      const loanAccount = await this.getLoanAccount(suggestedLoanAccountId);
      if (loanAccount && this.payeeMatchesLender(memoText, loanAccount)) {
        factors.payee_matches_lender = true;
        score += 3;
      }
    }

    // Factor 6: Check if date matches scheduled payment date (2 points)
    if (suggestedLoanAccountId) {
      const dateMatches = await this.checkScheduledDate(
        suggestedLoanAccountId,
        transaction.transaction_date
      );
      if (dateMatches) {
        factors.date_matches_schedule = true;
        score += 2;
      }
    }

    // Determine confidence based on score
    const confidence = this.scoreToConfidence(score);
    const isLikely = score >= 60; // Medium confidence or higher

    return {
      transaction_id: transactionId,
      is_likely_loan_payment: isLikely,
      confidence,
      confidence_score: score,
      factors,
      suggested_loan_account_id: suggestedLoanAccountId,
      suggested_principal: suggestedPrincipal,
      suggested_interest: suggestedInterest,
      detection_timestamp: Date.now(),
    };
  }

  /**
   * Detect loan payments in a batch of transactions
   */
  async detectBatch(
    request: BatchDetectionRequest
  ): Promise<BatchDetectionResponse> {
    const detections: LiabilityPaymentDetection[] = [];

    for (const transactionId of request.transaction_ids) {
      try {
        const detection = await this.detectLiabilityPayment(transactionId);
        if (detection.confidence_score >= request.confidence_threshold) {
          detections.push(detection);
        }
      } catch (error) {
        // Skip transactions that fail detection
        console.error(`Detection failed for ${transactionId}:`, error);
      }
    }

    // Count by confidence level
    const highCount = detections.filter((d) => d.confidence === 'HIGH').length;
    const mediumCount = detections.filter((d) => d.confidence === 'MEDIUM').length;
    const lowCount = detections.filter((d) => d.confidence === 'LOW').length;

    return {
      detections,
      total_checked: request.transaction_ids.length,
      total_detected: detections.length,
      high_confidence_count: highCount,
      medium_confidence_count: mediumCount,
      low_confidence_count: lowCount,
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Find line items that credit LIABILITY accounts
   */
  private async findLiabilityLineItems(
    lineItems: TransactionLineItem[]
  ): Promise<TransactionLineItem[]> {
    const liabilityItems: TransactionLineItem[] = [];

    for (const item of lineItems) {
      const account = await this.db.accounts.get(item.account_id);
      if (account && account.type === 'LIABILITY' && item.credit !== '0') {
        liabilityItems.push(item);
      }
    }

    return liabilityItems;
  }

  /**
   * Check if there's a regular payment pattern to this account
   */
  private async checkRegularPaymentPattern(
    accountId: string,
    currentDate: number
  ): Promise<boolean> {
    // Look for previous transactions in the last 6 months
    const sixMonthsAgo = currentDate - 6 * 30 * 24 * 60 * 60 * 1000;

    const lineItems = await this.db.transactionLineItems
      .where('account_id')
      .equals(accountId)
      .and((item) => !item.deleted_at)
      .toArray();

    // Get transactions for these line items
    const transactionIds = Array.from(new Set(lineItems.map((item) => item.transaction_id)));
    const transactions = await this.db.transactions
      .where('id')
      .anyOf(transactionIds)
      .and((t) => !t.deleted_at && t.transaction_date >= sixMonthsAgo)
      .toArray();

    // Need at least 3 payments to establish a pattern
    if (transactions.length < 3) {
      return false;
    }

    // Check if payments are roughly monthly (within 5 days of each other)
    const dates = transactions
      .map((t) => t.transaction_date)
      .sort((a, b) => a - b);

    let regularIntervals = 0;
    for (let i = 1; i < dates.length; i++) {
      const daysDiff = (dates[i] - dates[i - 1]) / (24 * 60 * 60 * 1000);
      // Check if roughly monthly (25-35 days)
      if (daysDiff >= 25 && daysDiff <= 35) {
        regularIntervals++;
      }
    }

    // At least 2 regular intervals indicates a pattern
    return regularIntervals >= 2;
  }

  /**
   * Check if amount matches amortization schedule
   */
  private async checkScheduleMatch(
    _loanAccountId: string,
    _transactionDate: number,
    _amount: string
  ): Promise<{ matches: boolean; principal?: string; interest?: string }> {
    // TODO: Implement when amortization_schedule_entries table exists
    // For now, return no match
    return { matches: false };
  }

  /**
   * Check if transaction date matches scheduled payment date
   */
  private async checkScheduledDate(
    _loanAccountId: string,
    _transactionDate: number
  ): Promise<boolean> {
    // TODO: Implement when amortization_schedule_entries table exists
    // For now, return false
    return false;
  }

  /**
   * Get total amount for a specific account in line items
   */
  private getTotalAmount(
    lineItems: TransactionLineItem[],
    accountId: string
  ): string {
    const accountItems = lineItems.filter((item) => item.account_id === accountId);
    let total = new Decimal(0);

    for (const item of accountItems) {
      // For liabilities, credit reduces the liability (payment)
      if (item.credit !== '0') {
        total = total.plus(new Decimal(item.credit));
      }
    }

    return total.toString();
  }

  /**
   * Check if memo contains loan-related keywords
   */
  private containsLoanKeywords(text: string): boolean {
    const lowerText = text.toLowerCase();
    return LOAN_KEYWORDS.some((keyword) => lowerText.includes(keyword));
  }

  /**
   * Get loan account details
   */
  private async getLoanAccount(_accountId: string): Promise<LoanAccount | null> {
    // TODO: Implement when loan_accounts table exists
    // For now, return null
    return null;
  }

  /**
   * Check if payee matches lender name
   */
  private payeeMatchesLender(_memoText: string, _loanAccount: LoanAccount): boolean {
    // TODO: Implement fuzzy matching when loan_accounts table exists
    // For now, return false
    return false;
  }

  /**
   * Convert score to confidence level
   */
  private scoreToConfidence(score: number): DetectionConfidence {
    if (score >= 80) return 'HIGH';
    if (score >= 60) return 'MEDIUM';
    return 'LOW';
  }
}
