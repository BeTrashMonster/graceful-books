/**
 * Currency Conversion Service
 *
 * Handles currency conversions with perfect decimal precision.
 * Manages conversion metadata, gain/loss calculations, and revaluations.
 *
 * Requirements:
 * - H5: Multi-Currency - Basic
 * - 28 decimal precision using Decimal.js
 * - GAAP-compliant currency gain/loss calculations
 * - Historical rate tracking for audits
 */

import Decimal from 'decimal.js';
import type {
  CurrencyCode,
  CurrencyConversionRequest,
  CurrencyConversionResult,
  BatchCurrencyConversionRequest,
  BatchCurrencyConversionResult,
  CurrencyConversionMetadata,
  CurrencyGainLoss,
  CurrencyRevaluationRequest,
  CurrencyRevaluationResult,
} from '../types/currency.types';
import { GainLossType, ExchangeRateSource } from '../types/currency.types';
import type { IExchangeRateService } from './exchangeRate.service';

// Configure Decimal.js for 28 decimal places precision
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

// ============================================================================
// Currency Conversion Service
// ============================================================================

/**
 * Interface for currency conversion service operations
 */
export interface ICurrencyConversionService {
  // Single conversions
  convert(request: CurrencyConversionRequest): Promise<CurrencyConversionResult>;
  convertAmount(
    amount: string | Decimal,
    fromCurrency: CurrencyCode,
    toCurrency: CurrencyCode,
    date: number
  ): Promise<CurrencyConversionResult>;

  // Batch conversions
  convertBatch(request: BatchCurrencyConversionRequest): Promise<BatchCurrencyConversionResult>;

  // Conversion metadata
  createConversionMetadata(result: CurrencyConversionResult): CurrencyConversionMetadata;

  // Gain/loss calculations
  calculateRealizedGainLoss(
    transactionId: string,
    originalConversion: CurrencyConversionMetadata,
    settlementDate: number
  ): Promise<CurrencyGainLoss>;

  calculateUnrealizedGainLoss(
    accountId: string,
    originalConversion: CurrencyConversionMetadata,
    revaluationDate: number
  ): Promise<CurrencyGainLoss>;

  // Revaluation
  revaluateAccounts(request: CurrencyRevaluationRequest): Promise<CurrencyRevaluationResult[]>;
}

/**
 * Currency Conversion Service Implementation
 */
export class CurrencyConversionService implements ICurrencyConversionService {
  constructor(
    private exchangeRateService: IExchangeRateService,
    private companyId: string
  ) {}

  /**
   * Convert currency based on request
   */
  async convert(request: CurrencyConversionRequest): Promise<CurrencyConversionResult> {
    return this.convertAmount(
      request.amount,
      request.from_currency,
      request.to_currency,
      request.conversion_date
    );
  }

  /**
   * Convert amount from one currency to another
   */
  async convertAmount(
    amount: string | Decimal,
    fromCurrency: CurrencyCode,
    toCurrency: CurrencyCode,
    date: number
  ): Promise<CurrencyConversionResult> {
    // Convert to Decimal for precision
    const amountDecimal = amount instanceof Decimal ? amount : new Decimal(amount);

    // Handle same currency conversion
    if (fromCurrency === toCurrency) {
      return {
        original_amount: amountDecimal.toFixed(28),
        original_currency: fromCurrency,
        converted_amount: amountDecimal.toFixed(28),
        converted_currency: toCurrency,
        exchange_rate: '1.0000000000000000000000000000',
        conversion_date: date,
        rate_source: ExchangeRateSource.SYSTEM,
        exchange_rate_id: null,
      };
    }

    // Get exchange rate for the date
    const exchangeRate = await this.exchangeRateService.getExchangeRateForDate(
      this.companyId,
      fromCurrency,
      toCurrency,
      date
    );

    if (!exchangeRate) {
      throw new Error(
        `No exchange rate found for ${fromCurrency} to ${toCurrency} on ${new Date(date).toISOString()}`
      );
    }

    // Decrypt the rate (in production, would use actual decryption)
    const rate = new Decimal(exchangeRate.rate);

    // Perform conversion with 28 decimal precision
    const convertedAmount = amountDecimal.mul(rate);

    return {
      original_amount: amountDecimal.toFixed(28),
      original_currency: fromCurrency,
      converted_amount: convertedAmount.toFixed(28),
      converted_currency: toCurrency,
      exchange_rate: rate.toFixed(28),
      conversion_date: date,
      rate_source: exchangeRate.source,
      exchange_rate_id: exchangeRate.id,
    };
  }

  /**
   * Convert multiple amounts in batch
   */
  async convertBatch(request: BatchCurrencyConversionRequest): Promise<BatchCurrencyConversionResult> {
    const conversions: CurrencyConversionResult[] = [];
    let totalConverted = new Decimal(0);

    // Process each conversion
    for (const conversionRequest of request.conversions) {
      const result = await this.convertAmount(
        conversionRequest.amount,
        conversionRequest.from_currency,
        request.to_currency,
        conversionRequest.conversion_date
      );

      conversions.push(result);
      totalConverted = totalConverted.plus(result.converted_amount);
    }

    return {
      conversions,
      total_converted_amount: totalConverted.toFixed(28),
      target_currency: request.to_currency,
    };
  }

  /**
   * Create conversion metadata for storing with transactions
   */
  createConversionMetadata(result: CurrencyConversionResult): CurrencyConversionMetadata {
    return {
      original_currency: result.original_currency,
      original_amount: result.original_amount,
      exchange_rate: result.exchange_rate,
      conversion_date: result.conversion_date,
      base_currency_amount: result.converted_amount,
      exchange_rate_id: result.exchange_rate_id,
    };
  }

  /**
   * Calculate realized gain/loss on foreign currency transaction
   * Occurs when a transaction is settled at a different rate than when recorded
   */
  async calculateRealizedGainLoss(
    transactionId: string,
    originalConversion: CurrencyConversionMetadata,
    settlementDate: number
  ): Promise<CurrencyGainLoss> {
    // Get current exchange rate at settlement
    const currentConversion = await this.convertAmount(
      originalConversion.original_amount,
      originalConversion.original_currency,
      'USD', // Assuming USD as base currency
      settlementDate
    );

    // Calculate gain/loss
    const originalAmount = new Decimal(originalConversion.base_currency_amount);
    const currentAmount = new Decimal(currentConversion.converted_amount);
    const gainLoss = currentAmount.minus(originalAmount);

    return {
      transaction_id: transactionId,
      line_item_id: null,
      type: GainLossType.REALIZED,
      currency: originalConversion.original_currency,
      original_amount: originalConversion.original_amount,
      original_rate: originalConversion.exchange_rate,
      current_rate: currentConversion.exchange_rate,
      gain_loss_amount: gainLoss.toFixed(28),
      calculation_date: settlementDate,
    };
  }

  /**
   * Calculate unrealized gain/loss on outstanding foreign currency balances
   * Occurs when revaluing balances at period end
   */
  async calculateUnrealizedGainLoss(
    accountId: string,
    originalConversion: CurrencyConversionMetadata,
    revaluationDate: number
  ): Promise<CurrencyGainLoss> {
    // Get current exchange rate at revaluation date
    const currentConversion = await this.convertAmount(
      originalConversion.original_amount,
      originalConversion.original_currency,
      'USD', // Assuming USD as base currency
      revaluationDate
    );

    // Calculate gain/loss
    const originalAmount = new Decimal(originalConversion.base_currency_amount);
    const currentAmount = new Decimal(currentConversion.converted_amount);
    const gainLoss = currentAmount.minus(originalAmount);

    return {
      transaction_id: accountId, // Using accountId since this is for balances
      line_item_id: null,
      type: GainLossType.UNREALIZED,
      currency: originalConversion.original_currency,
      original_amount: originalConversion.original_amount,
      original_rate: originalConversion.exchange_rate,
      current_rate: currentConversion.exchange_rate,
      gain_loss_amount: gainLoss.toFixed(28),
      calculation_date: revaluationDate,
    };
  }

  /**
   * Revaluate foreign currency accounts at period end
   */
  async revaluateAccounts(_request: CurrencyRevaluationRequest): Promise<CurrencyRevaluationResult[]> {
    const results: CurrencyRevaluationResult[] = [];

    // This would typically query the database for outstanding foreign currency balances
    // For now, we'll return an empty array as a placeholder
    // In production, this would:
    // 1. Query all accounts with foreign currency balances
    // 2. Get original conversion rates
    // 3. Get current rates at revaluation date
    // 4. Calculate unrealized gains/losses

    return results;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Round amount to currency's standard decimal places
 */
export function roundToCurrencyPrecision(
  amount: string | Decimal,
  decimalPlaces: number
): Decimal {
  const amountDecimal = amount instanceof Decimal ? amount : new Decimal(amount);
  return amountDecimal.toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP);
}

/**
 * Calculate percentage difference between two amounts
 */
export function calculatePercentageDifference(
  original: string | Decimal,
  current: string | Decimal
): Decimal {
  const originalDecimal = original instanceof Decimal ? original : new Decimal(original);
  const currentDecimal = current instanceof Decimal ? current : new Decimal(current);

  if (originalDecimal.isZero()) {
    throw new Error('Cannot calculate percentage difference from zero');
  }

  const difference = currentDecimal.minus(originalDecimal);
  return difference.div(originalDecimal).mul(100);
}

/**
 * Format gain/loss amount with sign
 */
export function formatGainLoss(amount: string | Decimal, precision: number = 2): string {
  const amountDecimal = amount instanceof Decimal ? amount : new Decimal(amount);

  if (amountDecimal.isPositive()) {
    return `+${amountDecimal.toFixed(precision)}`;
  } else {
    return amountDecimal.toFixed(precision);
  }
}

/**
 * Check if amount is a gain or loss
 */
export function isGain(amount: string | Decimal): boolean {
  const amountDecimal = amount instanceof Decimal ? amount : new Decimal(amount);
  return amountDecimal.isPositive();
}

/**
 * Check if amount is a loss
 */
export function isLoss(amount: string | Decimal): boolean {
  const amountDecimal = amount instanceof Decimal ? amount : new Decimal(amount);
  return amountDecimal.isNegative();
}

/**
 * Calculate total gain/loss from multiple transactions
 */
export function calculateTotalGainLoss(gainLosses: CurrencyGainLoss[]): Decimal {
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
export function separateGainLossByType(gainLosses: CurrencyGainLoss[]): {
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
export function groupGainLossByCurrency(
  gainLosses: CurrencyGainLoss[]
): Map<CurrencyCode, CurrencyGainLoss[]> {
  const grouped = new Map<CurrencyCode, CurrencyGainLoss[]>();

  for (const gl of gainLosses) {
    const existing = grouped.get(gl.currency) || [];
    existing.push(gl);
    grouped.set(gl.currency, existing);
  }

  return grouped;
}

/**
 * Calculate total gain/loss by currency
 */
export function calculateTotalGainLossByCurrency(
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
 * Validate conversion metadata
 */
export function validateConversionMetadata(metadata: CurrencyConversionMetadata): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!metadata.original_currency) {
    errors.push('Original currency is required');
  }

  if (!metadata.original_amount) {
    errors.push('Original amount is required');
  } else {
    try {
      const amount = new Decimal(metadata.original_amount);
      if (amount.isNaN()) {
        errors.push('Original amount must be a valid number');
      }
    } catch (e) {
      errors.push('Original amount must be a valid number');
    }
  }

  if (!metadata.exchange_rate) {
    errors.push('Exchange rate is required');
  } else {
    try {
      const rate = new Decimal(metadata.exchange_rate);
      if (rate.isNaN() || rate.lte(0)) {
        errors.push('Exchange rate must be a positive number');
      }
    } catch (e) {
      errors.push('Exchange rate must be a positive number');
    }
  }

  if (!metadata.conversion_date) {
    errors.push('Conversion date is required');
  }

  if (!metadata.base_currency_amount) {
    errors.push('Base currency amount is required');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Recalculate base currency amount from original amount and rate
 */
export function recalculateBaseCurrencyAmount(metadata: CurrencyConversionMetadata): Decimal {
  const originalAmount = new Decimal(metadata.original_amount);
  const exchangeRate = new Decimal(metadata.exchange_rate);

  return originalAmount.mul(exchangeRate);
}

/**
 * Check if conversion metadata needs revaluation
 */
export function needsRevaluation(
  metadata: CurrencyConversionMetadata,
  currentDate: number,
  daysSinceConversion: number = 30
): boolean {
  const conversionDate = metadata.conversion_date;
  const daysDifference = (currentDate - conversionDate) / (1000 * 60 * 60 * 24);

  return daysDifference >= daysSinceConversion;
}
