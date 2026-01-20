/**
 * Currency Revaluation Service
 *
 * Handles periodic revaluation of foreign currency balances.
 * Implements GAAP-compliant currency revaluation process for outstanding balances.
 *
 * Requirements:
 * - I4: Multi-Currency - Full
 * - GAAP compliance for currency revaluation
 * - 28 decimal precision using Decimal.js
 * - Support for automated and manual revaluation
 *
 * Educational Context:
 * Currency revaluation is the process of adjusting the book value of foreign
 * currency assets and liabilities to reflect current exchange rates. This is
 * typically done at period end (monthly, quarterly, or annually) and results
 * in unrealized gains or losses.
 *
 * Why it matters:
 * - Provides accurate financial statements in your reporting currency
 * - Complies with GAAP/IFRS requirements
 * - Helps management understand currency exposure
 */

import Decimal from 'decimal.js';
import type {
  CurrencyCode,
  CurrencyRevaluationRequest,
  CurrencyRevaluationResult,
  CurrencyGainLoss,
} from '../types/currency.types';
import type { IExchangeRateService } from './exchangeRate.service';
import type { ICurrencyGainLossService } from './currencyGainLoss.service';

// Configure Decimal.js for 28 decimal places precision
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

// ============================================================================
// Currency Revaluation Service
// ============================================================================

/**
 * Account balance with currency information
 */
export interface ForeignCurrencyBalance {
  account_id: string;
  account_name: string;
  account_code: string;
  currency: CurrencyCode;
  balance: string; // Amount in foreign currency
  original_rate: string; // Rate at which balance was originally recorded
  original_base_currency_amount: string; // Original amount in base currency
  last_revaluation_date: number | null;
}

/**
 * Revaluation journal entry
 */
export interface RevaluationJournalEntry {
  id: string;
  revaluation_date: number;
  account_id: string;
  currency: CurrencyCode;
  foreign_currency_balance: string;
  old_rate: string;
  new_rate: string;
  old_base_currency_amount: string;
  new_base_currency_amount: string;
  unrealized_gain_loss: string; // Negative = loss, Positive = gain
  gain_loss_account_id: string; // Account to post gain/loss to
  notes: string | null;
}

/**
 * Revaluation report
 */
export interface RevaluationReport {
  revaluation_date: number;
  base_currency: CurrencyCode;
  accounts_revalued: number;
  total_unrealized_gain_loss: string;
  results_by_account: CurrencyRevaluationResult[];
  results_by_currency: Map<CurrencyCode, {
    total_balance: string;
    total_gain_loss: string;
    account_count: number;
  }>;
  journal_entries: RevaluationJournalEntry[];
}

/**
 * Interface for currency revaluation service operations
 */
export interface ICurrencyRevaluationService {
  // Revaluation operations
  revaluateAccounts(request: CurrencyRevaluationRequest): Promise<RevaluationReport>;

  revaluateSingleAccount(
    accountId: string,
    revaluationDate: number,
    baseCurrency: CurrencyCode
  ): Promise<CurrencyRevaluationResult>;

  // Balance queries
  getForeignCurrencyBalances(
    companyId: string,
    accountIds?: string[]
  ): Promise<ForeignCurrencyBalance[]>;

  getAccountsNeedingRevaluation(
    companyId: string,
    revaluationDate: number,
    minDaysSinceLastRevaluation?: number
  ): Promise<ForeignCurrencyBalance[]>;

  // Journal entry generation
  createRevaluationJournalEntries(
    results: CurrencyRevaluationResult[],
    gainLossAccountId: string,
    revaluationDate: number
  ): Promise<RevaluationJournalEntry[]>;

  // Reporting
  generateRevaluationReport(
    request: CurrencyRevaluationRequest
  ): Promise<RevaluationReport>;
}

/**
 * Currency Revaluation Service Implementation
 */
export class CurrencyRevaluationService implements ICurrencyRevaluationService {
  constructor(
    private exchangeRateService: IExchangeRateService,
    private gainLossService: ICurrencyGainLossService,
    private companyId: string,
    private db: any // Dexie database instance
  ) {}

  /**
   * Revaluate foreign currency accounts
   */
  async revaluateAccounts(request: CurrencyRevaluationRequest): Promise<RevaluationReport> {
    const results: CurrencyRevaluationResult[] = [];

    // Get foreign currency balances for specified accounts
    const balances = await this.getForeignCurrencyBalances(
      this.companyId,
      request.account_ids
    );

    // Revaluate each balance
    for (const balance of balances) {
      // Skip if balance currency is same as target currency
      if (balance.currency === request.target_currency) {
        continue;
      }

      try {
        // Get current exchange rate at revaluation date
        const currentRate = await this.getExchangeRateForDate(
          balance.currency,
          request.target_currency,
          request.revaluation_date
        );

        // Calculate new base currency amount
        const foreignBalance = new Decimal(balance.balance);
        const newBaseCurrencyAmount = foreignBalance.mul(currentRate);

        // Calculate unrealized gain/loss
        const originalAmount = new Decimal(balance.original_base_currency_amount);
        const unrealizedGainLoss = newBaseCurrencyAmount.minus(originalAmount);

        // Create result
        const result: CurrencyRevaluationResult = {
          account_id: balance.account_id,
          currency: balance.currency,
          outstanding_balance: balance.balance,
          original_rate: balance.original_rate,
          current_rate: currentRate.toFixed(28),
          unrealized_gain_loss: unrealizedGainLoss.toFixed(28),
          revaluation_date: request.revaluation_date,
        };

        results.push(result);
      } catch (error) {
        console.error(`Failed to revaluate account ${balance.account_id}:`, error);
        // Continue with other accounts
      }
    }

    // Generate journal entries
    const gainLossAccountId = await this.getGainLossAccountId();
    const journalEntries = await this.createRevaluationJournalEntries(
      results,
      gainLossAccountId,
      request.revaluation_date
    );

    // Calculate totals
    let totalUnrealizedGainLoss = new Decimal(0);
    const resultsByCurrency = new Map<CurrencyCode, {
      total_balance: string;
      total_gain_loss: string;
      account_count: number;
    }>();

    for (const result of results) {
      totalUnrealizedGainLoss = totalUnrealizedGainLoss.plus(result.unrealized_gain_loss);

      // Update currency totals
      const currencyData = resultsByCurrency.get(result.currency) || {
        total_balance: '0',
        total_gain_loss: '0',
        account_count: 0,
      };

      const balance = new Decimal(currencyData.total_balance).plus(result.outstanding_balance);
      const gainLoss = new Decimal(currencyData.total_gain_loss).plus(result.unrealized_gain_loss);

      resultsByCurrency.set(result.currency, {
        total_balance: balance.toFixed(28),
        total_gain_loss: gainLoss.toFixed(28),
        account_count: currencyData.account_count + 1,
      });
    }

    return {
      revaluation_date: request.revaluation_date,
      base_currency: request.target_currency,
      accounts_revalued: results.length,
      total_unrealized_gain_loss: totalUnrealizedGainLoss.toFixed(28),
      results_by_account: results,
      results_by_currency: resultsByCurrency,
      journal_entries: journalEntries,
    };
  }

  /**
   * Revaluate a single account
   */
  async revaluateSingleAccount(
    accountId: string,
    revaluationDate: number,
    baseCurrency: CurrencyCode
  ): Promise<CurrencyRevaluationResult> {
    // Get account balance
    const balances = await this.getForeignCurrencyBalances(this.companyId, [accountId]);

    if (balances.length === 0) {
      throw new Error(`No foreign currency balance found for account ${accountId}`);
    }

    const balance = balances[0];

    // Get current exchange rate
    const currentRate = await this.getExchangeRateForDate(
      balance.currency,
      baseCurrency,
      revaluationDate
    );

    // Calculate new base currency amount
    const foreignBalance = new Decimal(balance.balance);
    const newBaseCurrencyAmount = foreignBalance.mul(currentRate);

    // Calculate unrealized gain/loss
    const originalAmount = new Decimal(balance.original_base_currency_amount);
    const unrealizedGainLoss = newBaseCurrencyAmount.minus(originalAmount);

    return {
      account_id: balance.account_id,
      currency: balance.currency,
      outstanding_balance: balance.balance,
      original_rate: balance.original_rate,
      current_rate: currentRate.toFixed(28),
      unrealized_gain_loss: unrealizedGainLoss.toFixed(28),
      revaluation_date: revaluationDate,
    };
  }

  /**
   * Get all foreign currency balances
   */
  async getForeignCurrencyBalances(
    _companyId: string,
    _accountIds?: string[]
  ): Promise<ForeignCurrencyBalance[]> {
    // This would typically query the database for foreign currency balances
    // For now, we'll return an empty array as a placeholder
    // In production, this would:
    // 1. Query accounts table for accounts with foreign currency
    // 2. Calculate current balances from transaction line items
    // 3. Get original rates from first transaction or account setup
    // 4. Return formatted balances

    return [];
  }

  /**
   * Get accounts that need revaluation
   */
  async getAccountsNeedingRevaluation(
    companyId: string,
    revaluationDate: number,
    minDaysSinceLastRevaluation: number = 30
  ): Promise<ForeignCurrencyBalance[]> {
    const allBalances = await this.getForeignCurrencyBalances(companyId);

    // Filter to accounts that need revaluation
    return allBalances.filter((balance) => {
      // If never revalued, needs revaluation
      if (!balance.last_revaluation_date) {
        return true;
      }

      // Check if enough time has passed since last revaluation
      const daysSinceRevaluation =
        (revaluationDate - balance.last_revaluation_date) / (1000 * 60 * 60 * 24);

      return daysSinceRevaluation >= minDaysSinceLastRevaluation;
    });
  }

  /**
   * Create journal entries for revaluation
   */
  async createRevaluationJournalEntries(
    results: CurrencyRevaluationResult[],
    gainLossAccountId: string,
    revaluationDate: number
  ): Promise<RevaluationJournalEntry[]> {
    const entries: RevaluationJournalEntry[] = [];

    for (const result of results) {
      // Skip if no gain/loss
      const gainLoss = new Decimal(result.unrealized_gain_loss);
      if (gainLoss.isZero()) {
        continue;
      }

      // Calculate old base currency amount
      const balance = new Decimal(result.outstanding_balance);
      const oldRate = new Decimal(result.original_rate);
      const oldBaseCurrencyAmount = balance.mul(oldRate);

      // Calculate new base currency amount
      const newRate = new Decimal(result.current_rate);
      const newBaseCurrencyAmount = balance.mul(newRate);

      entries.push({
        id: this.generateEntryId(),
        revaluation_date: result.revaluation_date,
        account_id: result.account_id,
        currency: result.currency,
        foreign_currency_balance: result.outstanding_balance,
        old_rate: result.original_rate,
        new_rate: result.current_rate,
        old_base_currency_amount: oldBaseCurrencyAmount.toFixed(28),
        new_base_currency_amount: newBaseCurrencyAmount.toFixed(28),
        unrealized_gain_loss: result.unrealized_gain_loss,
        gain_loss_account_id: gainLossAccountId,
        notes: `Currency revaluation for ${result.currency} at ${new Date(revaluationDate).toISOString()}`,
      });
    }

    return entries;
  }

  /**
   * Generate comprehensive revaluation report
   */
  async generateRevaluationReport(
    request: CurrencyRevaluationRequest
  ): Promise<RevaluationReport> {
    return this.revaluateAccounts(request);
  }

  /**
   * Helper: Get exchange rate for a specific date
   */
  private async getExchangeRateForDate(
    fromCurrency: CurrencyCode,
    toCurrency: CurrencyCode,
    date: number
  ): Promise<Decimal> {
    const rate = await this.exchangeRateService.getExchangeRateForDate(
      this.companyId,
      fromCurrency,
      toCurrency,
      date
    );

    if (!rate) {
      throw new Error(
        `No exchange rate found for ${fromCurrency} to ${toCurrency} on ${new Date(date).toISOString()}`
      );
    }

    // Decrypt the rate (handle mock encryption)
    let rateString = rate.rate;
    if (rateString.startsWith('encrypted_')) {
      rateString = rateString.replace('encrypted_', '');
    }

    return new Decimal(rateString);
  }

  /**
   * Helper: Get the gain/loss account ID
   */
  private async getGainLossAccountId(): Promise<string> {
    // This would typically query the database for the unrealized gain/loss account
    // For now, we'll return a placeholder
    // In production, this would look for an account with type "Other Income/Expense"
    // and specific code/name for unrealized currency gains/losses

    return 'unrealized-currency-gain-loss';
  }

  /**
   * Helper: Generate unique entry ID
   */
  private generateEntryId(): string {
    return `reval-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate total revaluation impact
 */
export function calculateTotalRevaluationImpact(
  results: CurrencyRevaluationResult[]
): Decimal {
  let total = new Decimal(0);

  for (const result of results) {
    total = total.plus(result.unrealized_gain_loss);
  }

  return total;
}

/**
 * Group revaluation results by currency
 */
export function groupRevaluationByCurrency(
  results: CurrencyRevaluationResult[]
): Map<CurrencyCode, CurrencyRevaluationResult[]> {
  const grouped = new Map<CurrencyCode, CurrencyRevaluationResult[]>();

  for (const result of results) {
    const existing = grouped.get(result.currency) || [];
    existing.push(result);
    grouped.set(result.currency, existing);
  }

  return grouped;
}

/**
 * Filter results by gain/loss threshold
 */
export function filterByGainLossThreshold(
  results: CurrencyRevaluationResult[],
  minAbsoluteAmount: string | Decimal
): CurrencyRevaluationResult[] {
  const threshold = minAbsoluteAmount instanceof Decimal
    ? minAbsoluteAmount
    : new Decimal(minAbsoluteAmount);

  return results.filter((result) => {
    const gainLoss = new Decimal(result.unrealized_gain_loss);
    return gainLoss.abs().gte(threshold);
  });
}

/**
 * Calculate average exchange rate change
 */
export function calculateAverageRateChange(results: CurrencyRevaluationResult[]): Decimal {
  if (results.length === 0) {
    return new Decimal(0);
  }

  let totalChange = new Decimal(0);

  for (const result of results) {
    const oldRate = new Decimal(result.original_rate);
    const newRate = new Decimal(result.current_rate);

    if (!oldRate.isZero()) {
      const change = newRate.minus(oldRate).div(oldRate).mul(100);
      totalChange = totalChange.plus(change);
    }
  }

  return totalChange.div(results.length);
}

/**
 * Identify accounts with significant currency exposure
 */
export function identifyHighExposureAccounts(
  results: CurrencyRevaluationResult[],
  exposureThreshold: string | Decimal
): CurrencyRevaluationResult[] {
  const threshold = exposureThreshold instanceof Decimal
    ? exposureThreshold
    : new Decimal(exposureThreshold);

  return results.filter((result) => {
    const balance = new Decimal(result.outstanding_balance);
    const rate = new Decimal(result.current_rate);
    const baseCurrencyValue = balance.mul(rate);

    return baseCurrencyValue.abs().gte(threshold);
  });
}

/**
 * Format revaluation result for display
 */
export function formatRevaluationResult(
  result: CurrencyRevaluationResult,
  precision: number = 2
): {
  currency: string;
  balance: string;
  oldRate: string;
  newRate: string;
  gainLoss: string;
  rateChange: string;
} {
  const oldRate = new Decimal(result.original_rate);
  const newRate = new Decimal(result.current_rate);
  const gainLoss = new Decimal(result.unrealized_gain_loss);

  const rateChangePercent = oldRate.isZero()
    ? new Decimal(0)
    : newRate.minus(oldRate).div(oldRate).mul(100);

  return {
    currency: result.currency,
    balance: new Decimal(result.outstanding_balance).toFixed(precision),
    oldRate: oldRate.toFixed(6),
    newRate: newRate.toFixed(6),
    gainLoss: gainLoss.isPositive()
      ? `+$${gainLoss.toFixed(precision)}`
      : `-$${gainLoss.abs().toFixed(precision)}`,
    rateChange: `${rateChangePercent.toFixed(2)}%`,
  };
}

/**
 * Validate revaluation request
 */
export function validateRevaluationRequest(
  request: CurrencyRevaluationRequest
): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!request.account_ids || request.account_ids.length === 0) {
    errors.push('At least one account ID is required');
  }

  if (!request.revaluation_date) {
    errors.push('Revaluation date is required');
  }

  if (!request.target_currency) {
    errors.push('Target currency is required');
  }

  if (request.revaluation_date && request.revaluation_date > Date.now()) {
    errors.push('Revaluation date cannot be in the future');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Compare revaluation results between periods
 */
export function compareRevaluationPeriods(
  previousResults: CurrencyRevaluationResult[],
  currentResults: CurrencyRevaluationResult[]
): Map<string, {
  previous: CurrencyRevaluationResult;
  current: CurrencyRevaluationResult;
  change: string;
}> {
  const comparison = new Map<string, {
    previous: CurrencyRevaluationResult;
    current: CurrencyRevaluationResult;
    change: string;
  }>();

  // Create a map of previous results by account ID
  const previousMap = new Map<string, CurrencyRevaluationResult>();
  for (const result of previousResults) {
    previousMap.set(result.account_id, result);
  }

  // Compare with current results
  for (const current of currentResults) {
    const previous = previousMap.get(current.account_id);
    if (previous) {
      const prevGainLoss = new Decimal(previous.unrealized_gain_loss);
      const currGainLoss = new Decimal(current.unrealized_gain_loss);
      const change = currGainLoss.minus(prevGainLoss);

      comparison.set(current.account_id, {
        previous,
        current,
        change: change.toFixed(28),
      });
    }
  }

  return comparison;
}
