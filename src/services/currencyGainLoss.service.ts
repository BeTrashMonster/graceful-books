/**
 * Currency Gain/Loss Service
 *
 * Handles calculation of realized and unrealized foreign currency gains/losses.
 * Implements GAAP-compliant methodology for multi-currency accounting.
 *
 * Requirements:
 * - I4: Multi-Currency - Full
 * - GAAP compliance for foreign currency gain/loss
 * - 28 decimal precision using Decimal.js
 * - Support for both realized and unrealized gain/loss
 *
 * Educational Context:
 * - Realized Gain/Loss: Occurs when a foreign currency transaction is settled
 *   at a different exchange rate than when it was recorded. This is a real,
 *   actual gain or loss that affects your bottom line.
 *
 * - Unrealized Gain/Loss: Occurs when outstanding foreign currency balances
 *   are revalued at period end. This is a "paper" gain or loss that reflects
 *   current market value but hasn't been realized yet.
 */

import Decimal from 'decimal.js';
import type {
  CurrencyCode,
  CurrencyGainLoss,
  CurrencyConversionMetadata,
} from '../types/currency.types';
import { GainLossType } from '../types/currency.types';
import type { IExchangeRateService } from './exchangeRate.service';

// Configure Decimal.js for 28 decimal places precision
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

// ============================================================================
// Currency Gain/Loss Service
// ============================================================================

/**
 * Interface for currency gain/loss service operations
 */
export interface ICurrencyGainLossService {
  // Realized gain/loss
  calculateRealizedGainLoss(
    transactionId: string,
    lineItemId: string | null,
    originalConversion: CurrencyConversionMetadata,
    settlementDate: number,
    baseCurrency: CurrencyCode
  ): Promise<CurrencyGainLoss>;

  calculateRealizedGainLossForPayment(
    paymentId: string,
    invoiceId: string,
    originalAmount: string,
    originalCurrency: CurrencyCode,
    originalRate: string,
    paymentDate: number,
    baseCurrency: CurrencyCode
  ): Promise<CurrencyGainLoss>;

  // Unrealized gain/loss
  calculateUnrealizedGainLoss(
    accountId: string,
    originalConversion: CurrencyConversionMetadata,
    revaluationDate: number,
    baseCurrency: CurrencyCode
  ): Promise<CurrencyGainLoss>;

  calculateUnrealizedGainLossForBalance(
    accountId: string,
    currency: CurrencyCode,
    foreignCurrencyBalance: string,
    originalRate: string,
    revaluationDate: number,
    baseCurrency: CurrencyCode
  ): Promise<CurrencyGainLoss>;

  // Batch calculations
  calculateAllRealizedGainLoss(
    transactionIds: string[],
    baseCurrency: CurrencyCode
  ): Promise<CurrencyGainLoss[]>;

  calculateAllUnrealizedGainLoss(
    accountIds: string[],
    revaluationDate: number,
    baseCurrency: CurrencyCode
  ): Promise<CurrencyGainLoss[]>;

  // Reporting
  getTotalGainLoss(gainLosses: CurrencyGainLoss[]): Decimal;
  separateByType(gainLosses: CurrencyGainLoss[]): {
    realized: CurrencyGainLoss[];
    unrealized: CurrencyGainLoss[];
  };
  groupByCurrency(gainLosses: CurrencyGainLoss[]): Map<CurrencyCode, CurrencyGainLoss[]>;
}

/**
 * Currency Gain/Loss Service Implementation
 */
export class CurrencyGainLossService implements ICurrencyGainLossService {
  constructor(
    private exchangeRateService: IExchangeRateService,
    private companyId: string,
    private db: any // Dexie database instance
  ) {}

  /**
   * Calculate realized gain/loss on a foreign currency transaction
   *
   * Example: You record an invoice for €1,000 when EUR/USD = 1.10 ($1,100)
   * When customer pays, EUR/USD = 1.15 ($1,150)
   * Realized gain = $1,150 - $1,100 = $50
   */
  async calculateRealizedGainLoss(
    transactionId: string,
    lineItemId: string | null,
    originalConversion: CurrencyConversionMetadata,
    settlementDate: number,
    baseCurrency: CurrencyCode
  ): Promise<CurrencyGainLoss> {
    // Get exchange rate at settlement date
    const settlementRate = await this.getExchangeRateForDate(
      originalConversion.original_currency,
      baseCurrency,
      settlementDate
    );

    // Calculate amounts
    const originalAmount = new Decimal(originalConversion.original_amount);
    const originalBaseCurrencyAmount = new Decimal(originalConversion.base_currency_amount);
    const settlementBaseCurrencyAmount = originalAmount.mul(settlementRate);

    // Calculate gain/loss
    const gainLossAmount = settlementBaseCurrencyAmount.minus(originalBaseCurrencyAmount);

    return {
      transaction_id: transactionId,
      line_item_id: lineItemId,
      type: GainLossType.REALIZED,
      currency: originalConversion.original_currency,
      original_amount: originalConversion.original_amount,
      original_rate: originalConversion.exchange_rate,
      current_rate: settlementRate.toFixed(28),
      gain_loss_amount: gainLossAmount.toFixed(28),
      calculation_date: settlementDate,
    };
  }

  /**
   * Calculate realized gain/loss for a payment against an invoice
   * This is the most common scenario for realized gain/loss
   */
  async calculateRealizedGainLossForPayment(
    paymentId: string,
    invoiceId: string,
    originalAmount: string,
    originalCurrency: CurrencyCode,
    originalRate: string,
    paymentDate: number,
    baseCurrency: CurrencyCode
  ): Promise<CurrencyGainLoss> {
    // Get exchange rate at payment date
    const paymentRate = await this.getExchangeRateForDate(
      originalCurrency,
      baseCurrency,
      paymentDate
    );

    // Calculate amounts
    const amount = new Decimal(originalAmount);
    const origRate = new Decimal(originalRate);
    const originalBaseCurrencyAmount = amount.mul(origRate);
    const paymentBaseCurrencyAmount = amount.mul(paymentRate);

    // Calculate gain/loss
    const gainLossAmount = paymentBaseCurrencyAmount.minus(originalBaseCurrencyAmount);

    return {
      transaction_id: paymentId,
      line_item_id: invoiceId,
      type: GainLossType.REALIZED,
      currency: originalCurrency,
      original_amount: originalAmount,
      original_rate: originalRate,
      current_rate: paymentRate.toFixed(28),
      gain_loss_amount: gainLossAmount.toFixed(28),
      calculation_date: paymentDate,
    };
  }

  /**
   * Calculate unrealized gain/loss on outstanding foreign currency balance
   *
   * Example: You have an outstanding receivable of €1,000 recorded at EUR/USD = 1.10 ($1,100)
   * At period end, EUR/USD = 1.15
   * Current value = €1,000 × 1.15 = $1,150
   * Unrealized gain = $1,150 - $1,100 = $50
   */
  async calculateUnrealizedGainLoss(
    accountId: string,
    originalConversion: CurrencyConversionMetadata,
    revaluationDate: number,
    baseCurrency: CurrencyCode
  ): Promise<CurrencyGainLoss> {
    // Get exchange rate at revaluation date
    const currentRate = await this.getExchangeRateForDate(
      originalConversion.original_currency,
      baseCurrency,
      revaluationDate
    );

    // Calculate amounts
    const originalAmount = new Decimal(originalConversion.original_amount);
    const originalBaseCurrencyAmount = new Decimal(originalConversion.base_currency_amount);
    const currentBaseCurrencyAmount = originalAmount.mul(currentRate);

    // Calculate gain/loss
    const gainLossAmount = currentBaseCurrencyAmount.minus(originalBaseCurrencyAmount);

    return {
      transaction_id: accountId,
      line_item_id: null,
      type: GainLossType.UNREALIZED,
      currency: originalConversion.original_currency,
      original_amount: originalConversion.original_amount,
      original_rate: originalConversion.exchange_rate,
      current_rate: currentRate.toFixed(28),
      gain_loss_amount: gainLossAmount.toFixed(28),
      calculation_date: revaluationDate,
    };
  }

  /**
   * Calculate unrealized gain/loss for an account balance
   */
  async calculateUnrealizedGainLossForBalance(
    accountId: string,
    currency: CurrencyCode,
    foreignCurrencyBalance: string,
    originalRate: string,
    revaluationDate: number,
    baseCurrency: CurrencyCode
  ): Promise<CurrencyGainLoss> {
    // Get exchange rate at revaluation date
    const currentRate = await this.getExchangeRateForDate(
      currency,
      baseCurrency,
      revaluationDate
    );

    // Calculate amounts
    const balance = new Decimal(foreignCurrencyBalance);
    const origRate = new Decimal(originalRate);
    const originalBaseCurrencyAmount = balance.mul(origRate);
    const currentBaseCurrencyAmount = balance.mul(currentRate);

    // Calculate gain/loss
    const gainLossAmount = currentBaseCurrencyAmount.minus(originalBaseCurrencyAmount);

    return {
      transaction_id: accountId,
      line_item_id: null,
      type: GainLossType.UNREALIZED,
      currency,
      original_amount: foreignCurrencyBalance,
      original_rate: originalRate,
      current_rate: currentRate.toFixed(28),
      gain_loss_amount: gainLossAmount.toFixed(28),
      calculation_date: revaluationDate,
    };
  }

  /**
   * Calculate realized gain/loss for multiple transactions
   */
  async calculateAllRealizedGainLoss(
    _transactionIds: string[],
    _baseCurrency: CurrencyCode
  ): Promise<CurrencyGainLoss[]> {
    const gainLosses: CurrencyGainLoss[] = [];

    // This would typically query the database for transaction details
    // For now, we'll return an empty array as a placeholder
    // In production, this would:
    // 1. Query all transactions by IDs
    // 2. Find foreign currency transactions that have been settled
    // 3. Calculate realized gain/loss for each

    return gainLosses;
  }

  /**
   * Calculate unrealized gain/loss for multiple accounts
   */
  async calculateAllUnrealizedGainLoss(
    _accountIds: string[],
    _revaluationDate: number,
    _baseCurrency: CurrencyCode
  ): Promise<CurrencyGainLoss[]> {
    const gainLosses: CurrencyGainLoss[] = [];

    // This would typically query the database for account balances
    // For now, we'll return an empty array as a placeholder
    // In production, this would:
    // 1. Query all accounts by IDs
    // 2. Find accounts with foreign currency balances
    // 3. Calculate unrealized gain/loss for each

    return gainLosses;
  }

  /**
   * Calculate total gain/loss from multiple entries
   */
  getTotalGainLoss(gainLosses: CurrencyGainLoss[]): Decimal {
    let total = new Decimal(0);

    for (const gl of gainLosses) {
      const amount = new Decimal(gl.gain_loss_amount);
      total = total.plus(amount);
    }

    return total;
  }

  /**
   * Separate realized and unrealized gains/losses
   */
  separateByType(gainLosses: CurrencyGainLoss[]): {
    realized: CurrencyGainLoss[];
    unrealized: CurrencyGainLoss[];
  } {
    const realized: CurrencyGainLoss[] = [];
    const unrealized: CurrencyGainLoss[] = [];

    for (const gl of gainLosses) {
      if (gl.type === GainLossType.REALIZED) {
        realized.push(gl);
      } else {
        unrealized.push(gl);
      }
    }

    return { realized, unrealized };
  }

  /**
   * Group gains/losses by currency
   */
  groupByCurrency(gainLosses: CurrencyGainLoss[]): Map<CurrencyCode, CurrencyGainLoss[]> {
    const grouped = new Map<CurrencyCode, CurrencyGainLoss[]>();

    for (const gl of gainLosses) {
      const existing = grouped.get(gl.currency) || [];
      existing.push(gl);
      grouped.set(gl.currency, existing);
    }

    return grouped;
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
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a gain/loss is material (exceeds threshold)
 */
export function isGainLossMaterial(
  gainLoss: CurrencyGainLoss,
  materialityThreshold: string | Decimal
): boolean {
  const amount = new Decimal(gainLoss.gain_loss_amount);
  const threshold = materialityThreshold instanceof Decimal
    ? materialityThreshold
    : new Decimal(materialityThreshold);

  return amount.abs().gte(threshold);
}

/**
 * Calculate percentage change between original and current rate
 */
export function calculateRateChangePercentage(gainLoss: CurrencyGainLoss): Decimal {
  const originalRate = new Decimal(gainLoss.original_rate);
  const currentRate = new Decimal(gainLoss.current_rate);

  if (originalRate.isZero()) {
    return new Decimal(0);
  }

  const change = currentRate.minus(originalRate);
  return change.div(originalRate).mul(100);
}

/**
 * Format gain/loss for display with appropriate sign
 */
export function formatGainLossAmount(
  gainLoss: CurrencyGainLoss,
  precision: number = 2
): string {
  const amount = new Decimal(gainLoss.gain_loss_amount);

  if (amount.isPositive()) {
    return `+$${amount.toFixed(precision)}`;
  } else if (amount.isNegative()) {
    return `-$${amount.abs().toFixed(precision)}`;
  } else {
    return `$${amount.toFixed(precision)}`;
  }
}

/**
 * Determine if a gain/loss represents a gain (positive) or loss (negative)
 */
export function isGain(gainLoss: CurrencyGainLoss): boolean {
  const amount = new Decimal(gainLoss.gain_loss_amount);
  return amount.gt(0);
}

/**
 * Determine if a gain/loss represents a loss (negative)
 */
export function isLoss(gainLoss: CurrencyGainLoss): boolean {
  const amount = new Decimal(gainLoss.gain_loss_amount);
  return amount.lt(0);
}

/**
 * Calculate cumulative gain/loss by currency
 */
export function calculateCumulativeGainLossByCurrency(
  gainLosses: CurrencyGainLoss[]
): Map<CurrencyCode, Decimal> {
  const totals = new Map<CurrencyCode, Decimal>();

  for (const gl of gainLosses) {
    const existing = totals.get(gl.currency) || new Decimal(0);
    const amount = new Decimal(gl.gain_loss_amount);
    totals.set(gl.currency, existing.plus(amount));
  }

  return totals;
}

/**
 * Filter gain/losses by date range
 */
export function filterByDateRange(
  gainLosses: CurrencyGainLoss[],
  startDate: number,
  endDate: number
): CurrencyGainLoss[] {
  return gainLosses.filter(
    (gl) => gl.calculation_date >= startDate && gl.calculation_date <= endDate
  );
}

/**
 * Sort gain/losses by calculation date (ascending or descending)
 */
export function sortByDate(
  gainLosses: CurrencyGainLoss[],
  ascending: boolean = true
): CurrencyGainLoss[] {
  return [...gainLosses].sort((a, b) => {
    const diff = a.calculation_date - b.calculation_date;
    return ascending ? diff : -diff;
  });
}

/**
 * Sort gain/losses by amount (ascending or descending)
 */
export function sortByAmount(
  gainLosses: CurrencyGainLoss[],
  ascending: boolean = true
): CurrencyGainLoss[] {
  return [...gainLosses].sort((a, b) => {
    const amountA = new Decimal(a.gain_loss_amount);
    const amountB = new Decimal(b.gain_loss_amount);
    const diff = amountA.minus(amountB).toNumber();
    return ascending ? diff : -diff;
  });
}

/**
 * Calculate average gain/loss
 */
export function calculateAverageGainLoss(gainLosses: CurrencyGainLoss[]): Decimal {
  if (gainLosses.length === 0) {
    return new Decimal(0);
  }

  let total = new Decimal(0);
  for (const gl of gainLosses) {
    total = total.plus(gl.gain_loss_amount);
  }

  return total.div(gainLosses.length);
}

/**
 * Calculate standard deviation of gain/loss amounts
 */
export function calculateGainLossStdDev(gainLosses: CurrencyGainLoss[]): Decimal {
  if (gainLosses.length === 0) {
    return new Decimal(0);
  }

  const average = calculateAverageGainLoss(gainLosses);
  let sumSquaredDiff = new Decimal(0);

  for (const gl of gainLosses) {
    const amount = new Decimal(gl.gain_loss_amount);
    const diff = amount.minus(average);
    sumSquaredDiff = sumSquaredDiff.plus(diff.pow(2));
  }

  const variance = sumSquaredDiff.div(gainLosses.length);
  return variance.sqrt();
}

/**
 * Validate currency gain/loss entry
 */
export function validateGainLoss(gainLoss: CurrencyGainLoss): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!gainLoss.transaction_id) {
    errors.push('Transaction ID is required');
  }

  if (!gainLoss.type || !Object.values(GainLossType).includes(gainLoss.type)) {
    errors.push('Valid gain/loss type is required');
  }

  if (!gainLoss.currency) {
    errors.push('Currency is required');
  }

  if (!gainLoss.original_amount) {
    errors.push('Original amount is required');
  }

  if (!gainLoss.original_rate) {
    errors.push('Original rate is required');
  }

  if (!gainLoss.current_rate) {
    errors.push('Current rate is required');
  }

  if (!gainLoss.gain_loss_amount) {
    errors.push('Gain/loss amount is required');
  }

  if (!gainLoss.calculation_date) {
    errors.push('Calculation date is required');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
