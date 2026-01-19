/**
 * Exchange Rate Service
 *
 * Manages exchange rates for multi-currency accounting.
 * Handles CRUD operations, historical rate tracking, and rate lookups.
 *
 * Requirements:
 * - H5: Multi-Currency - Basic
 * - Historical exchange rate tracking
 * - 28 decimal precision using Decimal.js
 * - GAAP-compliant rate management
 */

import { nanoid } from 'nanoid';
import Decimal from 'decimal.js';
import type {
  ExchangeRate,
  CurrencyCode,
  ExchangeRateValidationResult,
} from '../types/currency.types';
import { ExchangeRateSource } from '../types/currency.types';
import type { VersionVector } from '../types/database.types';

// Configure Decimal.js for 28 decimal places precision
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

// ============================================================================
// Exchange Rate Management
// ============================================================================

/**
 * Interface for exchange rate service operations
 */
export interface IExchangeRateService {
  // CRUD operations
  createExchangeRate(
    companyId: string,
    fromCurrency: CurrencyCode,
    toCurrency: CurrencyCode,
    rate: string | Decimal,
    effectiveDate: number,
    source?: ExchangeRateSource,
    notes?: string
  ): Promise<ExchangeRate>;

  getExchangeRate(id: string): Promise<ExchangeRate | null>;

  getExchangeRateForDate(
    companyId: string,
    fromCurrency: CurrencyCode,
    toCurrency: CurrencyCode,
    date: number
  ): Promise<ExchangeRate | null>;

  getLatestExchangeRate(
    companyId: string,
    fromCurrency: CurrencyCode,
    toCurrency: CurrencyCode
  ): Promise<ExchangeRate | null>;

  getExchangeRateHistory(
    companyId: string,
    fromCurrency: CurrencyCode,
    toCurrency: CurrencyCode,
    startDate?: number,
    endDate?: number
  ): Promise<ExchangeRate[]>;

  updateExchangeRate(id: string, updates: Partial<ExchangeRate>): Promise<ExchangeRate>;
  deleteExchangeRate(id: string): Promise<void>;

  // Validation
  validateExchangeRate(rate: Partial<ExchangeRate>): ExchangeRateValidationResult;

  // Rate calculations
  calculateInverseRate(rate: string | Decimal): Decimal;
  calculateCrossRate(rateAtoB: string | Decimal, rateBtoC: string | Decimal): Decimal;
}

/**
 * Mock encryption service interface for development
 */
interface IEncryptionService {
  encrypt(plaintext: string): Promise<string>;
  decrypt(ciphertext: string): Promise<string>;
}

/**
 * Exchange Rate Service Implementation
 */
export class ExchangeRateService implements IExchangeRateService {
  constructor(
    private encryptionService: IEncryptionService,
    private db: any // Dexie database instance
  ) {}

  /**
   * Create a new exchange rate
   */
  async createExchangeRate(
    companyId: string,
    fromCurrency: CurrencyCode,
    toCurrency: CurrencyCode,
    rate: string | Decimal,
    effectiveDate: number,
    source: ExchangeRateSource = ExchangeRateSource.MANUAL,
    notes?: string
  ): Promise<ExchangeRate> {
    // Validate rate
    const rateDecimal = rate instanceof Decimal ? rate : new Decimal(rate);
    if (rateDecimal.isNaN() || rateDecimal.lte(0)) {
      throw new Error('Exchange rate must be a positive number');
    }

    // Prevent same currency conversion
    if (fromCurrency === toCurrency) {
      throw new Error('Cannot create exchange rate for same currency');
    }

    // Create exchange rate entity
    const now = Date.now();
    const exchangeRate: ExchangeRate = {
      id: nanoid(),
      created_at: now,
      updated_at: now,
      deleted_at: null,
      company_id: companyId,
      from_currency: fromCurrency,
      to_currency: toCurrency,
      rate: await this.encryptionService.encrypt(rateDecimal.toFixed(28)),
      effective_date: effectiveDate,
      source,
      notes: notes ? await this.encryptionService.encrypt(notes) : null,
      version_vector: {},
    };

    // Validate
    const validation = this.validateExchangeRate(exchangeRate);
    if (!validation.isValid) {
      throw new Error(`Invalid exchange rate: ${validation.errors.join(', ')}`);
    }

    // Save to database
    await this.db.exchangeRates.add(exchangeRate);

    // Also create the inverse rate for convenience
    await this.createInverseRate(exchangeRate, rateDecimal);

    return exchangeRate;
  }

  /**
   * Get exchange rate by ID
   */
  async getExchangeRate(id: string): Promise<ExchangeRate | null> {
    const rate = await this.db.exchangeRates.get(id);
    if (!rate || rate.deleted_at) {
      return null;
    }
    return rate;
  }

  /**
   * Get exchange rate for a specific date
   * Uses the most recent rate on or before the specified date
   */
  async getExchangeRateForDate(
    companyId: string,
    fromCurrency: CurrencyCode,
    toCurrency: CurrencyCode,
    date: number
  ): Promise<ExchangeRate | null> {
    // Handle same currency (always 1.0)
    if (fromCurrency === toCurrency) {
      return this.createSameCurrencyRate(companyId, fromCurrency, date);
    }

    // Find the most recent rate on or before the date
    const rates = await this.db.exchangeRates
      .where(['company_id+from_currency+to_currency'])
      .equals([companyId, fromCurrency, toCurrency])
      .and((r: ExchangeRate) => !r.deleted_at && r.effective_date <= date)
      .sortBy('effective_date');

    if (!rates || rates.length === 0) {
      return null;
    }

    // Return the most recent rate
    return rates[rates.length - 1];
  }

  /**
   * Get the latest exchange rate for a currency pair
   */
  async getLatestExchangeRate(
    companyId: string,
    fromCurrency: CurrencyCode,
    toCurrency: CurrencyCode
  ): Promise<ExchangeRate | null> {
    return this.getExchangeRateForDate(companyId, fromCurrency, toCurrency, Date.now());
  }

  /**
   * Get exchange rate history for a currency pair
   */
  async getExchangeRateHistory(
    companyId: string,
    fromCurrency: CurrencyCode,
    toCurrency: CurrencyCode,
    startDate?: number,
    endDate?: number
  ): Promise<ExchangeRate[]> {
    let query = this.db.exchangeRates
      .where(['company_id+from_currency+to_currency'])
      .equals([companyId, fromCurrency, toCurrency])
      .and((r: ExchangeRate) => !r.deleted_at);

    // Apply date filters
    if (startDate || endDate) {
      query = query.and((r: ExchangeRate) => {
        if (startDate && r.effective_date < startDate) return false;
        if (endDate && r.effective_date > endDate) return false;
        return true;
      });
    }

    const rates = await query.sortBy('effective_date');
    return rates;
  }

  /**
   * Update exchange rate
   */
  async updateExchangeRate(id: string, updates: Partial<ExchangeRate>): Promise<ExchangeRate> {
    const existing = await this.getExchangeRate(id);
    if (!existing) {
      throw new Error('Exchange rate not found');
    }

    // Prevent changing certain immutable fields
    if (updates.id || updates.created_at || updates.company_id) {
      throw new Error('Cannot modify immutable exchange rate fields');
    }

    // If updating the rate value, encrypt it
    if (updates.rate) {
      const rateDecimal = new Decimal(updates.rate);
      updates.rate = await this.encryptionService.encrypt(rateDecimal.toFixed(28));
    }

    // If updating notes, encrypt them
    if (updates.notes) {
      updates.notes = await this.encryptionService.encrypt(updates.notes);
    }

    // Update
    const updated: ExchangeRate = {
      ...existing,
      ...updates,
      updated_at: Date.now(),
    };

    // Validate
    const validation = this.validateExchangeRate(updated);
    if (!validation.isValid) {
      throw new Error(`Invalid exchange rate update: ${validation.errors.join(', ')}`);
    }

    // Save
    await this.db.exchangeRates.put(updated);

    return updated;
  }

  /**
   * Delete exchange rate (soft delete)
   */
  async deleteExchangeRate(id: string): Promise<void> {
    const rate = await this.getExchangeRate(id);
    if (!rate) {
      throw new Error('Exchange rate not found');
    }

    // Soft delete
    await this.db.exchangeRates.update(id, {
      deleted_at: Date.now(),
      updated_at: Date.now(),
    });
  }

  /**
   * Validate exchange rate
   */
  validateExchangeRate(rate: Partial<ExchangeRate>): ExchangeRateValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!rate.company_id) {
      errors.push('Company ID is required');
    }

    if (!rate.from_currency) {
      errors.push('From currency is required');
    }

    if (!rate.to_currency) {
      errors.push('To currency is required');
    }

    if (rate.from_currency === rate.to_currency) {
      errors.push('From and to currencies must be different');
    }

    if (!rate.rate) {
      errors.push('Exchange rate is required');
    }

    if (rate.effective_date === undefined) {
      errors.push('Effective date is required');
    }

    if (!rate.source || !Object.values(ExchangeRateSource).includes(rate.source)) {
      errors.push('Valid rate source is required');
    }

    // Warnings for unusual rates
    if (rate.rate) {
      try {
        const decrypted = rate.rate; // In production, would decrypt first
        const rateValue = new Decimal(decrypted);

        // Warn if rate is extremely high or low
        if (rateValue.gt(1000)) {
          warnings.push('Exchange rate is unusually high (>1000)');
        } else if (rateValue.lt(0.001)) {
          warnings.push('Exchange rate is unusually low (<0.001)');
        }
      } catch (error) {
        errors.push('Exchange rate must be a valid number');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Calculate inverse exchange rate
   * If USD to EUR is 0.85, then EUR to USD is 1/0.85 = 1.176470588
   */
  calculateInverseRate(rate: string | Decimal): Decimal {
    const rateDecimal = rate instanceof Decimal ? rate : new Decimal(rate);

    if (rateDecimal.isZero()) {
      throw new Error('Cannot calculate inverse of zero rate');
    }

    return new Decimal(1).div(rateDecimal);
  }

  /**
   * Calculate cross rate from two exchange rates
   * If A to B is rateAtoB and B to C is rateBtoC, then A to C is rateAtoB * rateBtoC
   */
  calculateCrossRate(rateAtoB: string | Decimal, rateBtoC: string | Decimal): Decimal {
    const rateAB = rateAtoB instanceof Decimal ? rateAtoB : new Decimal(rateAtoB);
    const rateBC = rateBtoC instanceof Decimal ? rateBtoC : new Decimal(rateBtoC);

    return rateAB.mul(rateBC);
  }

  /**
   * Create inverse rate automatically
   */
  private async createInverseRate(originalRate: ExchangeRate, rateValue: Decimal): Promise<void> {
    const inverseRate = this.calculateInverseRate(rateValue);

    const now = Date.now();
    const inverse: ExchangeRate = {
      id: nanoid(),
      created_at: now,
      updated_at: now,
      deleted_at: null,
      company_id: originalRate.company_id,
      from_currency: originalRate.to_currency,
      to_currency: originalRate.from_currency,
      rate: await this.encryptionService.encrypt(inverseRate.toFixed(28)),
      effective_date: originalRate.effective_date,
      source: originalRate.source,
      notes: originalRate.notes
        ? await this.encryptionService.encrypt(`Inverse of ${originalRate.from_currency} to ${originalRate.to_currency}`)
        : null,
      version_vector: {},
    };

    await this.db.exchangeRates.add(inverse);
  }

  /**
   * Create a same-currency rate (always 1.0)
   */
  private async createSameCurrencyRate(
    companyId: string,
    currency: CurrencyCode,
    date: number
  ): Promise<ExchangeRate> {
    const now = Date.now();
    return {
      id: nanoid(),
      created_at: now,
      updated_at: now,
      deleted_at: null,
      company_id: companyId,
      from_currency: currency,
      to_currency: currency,
      rate: await this.encryptionService.encrypt('1.0000000000000000000000000000'),
      effective_date: date,
      source: ExchangeRateSource.SYSTEM,
      notes: null,
      version_vector: {},
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format exchange rate for display
 * Shows rates with appropriate precision
 */
export function formatExchangeRate(rate: string | Decimal, precision: number = 6): string {
  const rateDecimal = rate instanceof Decimal ? rate : new Decimal(rate);
  return rateDecimal.toFixed(precision);
}

/**
 * Calculate average exchange rate for a period
 */
export async function calculateAverageRate(
  rates: ExchangeRate[],
  encryptionService: IEncryptionService
): Promise<Decimal> {
  if (rates.length === 0) {
    throw new Error('Cannot calculate average of empty rate list');
  }

  let sum = new Decimal(0);

  for (const rate of rates) {
    const decrypted = await encryptionService.decrypt(rate.rate);
    const rateValue = new Decimal(decrypted);
    sum = sum.plus(rateValue);
  }

  return sum.div(rates.length);
}

/**
 * Calculate weighted average exchange rate
 * Weights are typically transaction amounts
 */
export function calculateWeightedAverageRate(
  rates: Decimal[],
  weights: Decimal[]
): Decimal {
  if (rates.length !== weights.length) {
    throw new Error('Rates and weights arrays must have same length');
  }

  if (rates.length === 0) {
    throw new Error('Cannot calculate average of empty arrays');
  }

  let weightedSum = new Decimal(0);
  let totalWeight = new Decimal(0);

  for (let i = 0; i < rates.length; i++) {
    weightedSum = weightedSum.plus(rates[i].mul(weights[i]));
    totalWeight = totalWeight.plus(weights[i]);
  }

  if (totalWeight.isZero()) {
    throw new Error('Total weight cannot be zero');
  }

  return weightedSum.div(totalWeight);
}
