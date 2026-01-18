/**
 * Currency Service
 *
 * Manages currency configurations for multi-currency accounting.
 * Handles CRUD operations for currencies with encryption support.
 *
 * Requirements:
 * - H5: Multi-Currency - Basic
 * - Zero-knowledge encryption for currency names
 * - CRDT-compatible operations
 */

import { nanoid } from 'nanoid';
import Decimal from 'decimal.js';
import type {
  Currency,
  CurrencyCode,
  CurrencyDisplayConfig,
  CurrencyFormatOptions,
  CurrencyValidationResult,
} from '../types/currency.types';

// Configure Decimal.js for 28 decimal places precision
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

// ============================================================================
// Currency Configuration Management
// ============================================================================

/**
 * Interface for currency service operations
 */
export interface ICurrencyService {
  // CRUD operations
  createCurrency(companyId: string, code: CurrencyCode, isBaseCurrency?: boolean): Promise<Currency>;
  getCurrency(id: string): Promise<Currency | null>;
  getCurrencyByCode(companyId: string, code: CurrencyCode): Promise<Currency | null>;
  getActiveCurrencies(companyId: string): Promise<Currency[]>;
  getBaseCurrency(companyId: string): Promise<Currency | null>;
  updateCurrency(id: string, updates: Partial<Currency>): Promise<Currency>;
  deactivateCurrency(id: string): Promise<void>;

  // Validation
  validateCurrency(currency: Partial<Currency>): CurrencyValidationResult;

  // Formatting
  formatAmount(amount: string | Decimal, options: CurrencyFormatOptions): string;
  parseAmount(input: string, currency: CurrencyCode): Decimal | null;
}

/**
 * Mock encryption service interface for development
 * In production, this would use the actual IEncryptionService
 */
interface IEncryptionService {
  encrypt(plaintext: string): Promise<string>;
  decrypt(ciphertext: string): Promise<string>;
}

/**
 * Currency Service Implementation
 */
export class CurrencyService implements ICurrencyService {
  constructor(
    private encryptionService: IEncryptionService,
    private db: any // Dexie database instance
  ) {}

  /**
   * Create a new currency configuration
   */
  async createCurrency(
    companyId: string,
    code: CurrencyCode,
    isBaseCurrency: boolean = false
  ): Promise<Currency> {
    // Check if currency already exists for this company
    const existing = await this.getCurrencyByCode(companyId, code);
    if (existing) {
      throw new Error(`Currency ${code} already exists for this company`);
    }

    // If this is set as base currency, ensure no other base currency exists
    if (isBaseCurrency) {
      const existingBase = await this.getBaseCurrency(companyId);
      if (existingBase) {
        throw new Error('Base currency already exists for this company. Deactivate it first.');
      }
    }

    // Get predefined configuration
    const config = this.getPredefinedConfig(code);

    // Create currency entity
    const now = Date.now();
    const currency: Currency = {
      id: nanoid(),
      created_at: now,
      updated_at: now,
      deleted_at: null,
      company_id: companyId,
      code,
      name: await this.encryptionService.encrypt(config.name),
      symbol: config.symbol,
      symbol_position: config.symbolPosition,
      decimal_places: config.decimalPlaces,
      thousands_separator: config.thousandsSeparator,
      decimal_separator: config.decimalSeparator,
      locale: config.locale,
      is_active: true,
      is_base_currency: isBaseCurrency,
      version_vector: {},
    };

    // Validate before saving
    const validation = this.validateCurrency(currency);
    if (!validation.isValid) {
      throw new Error(`Invalid currency: ${validation.errors.join(', ')}`);
    }

    // Save to database
    await this.db.currencies.add(currency);

    return currency;
  }

  /**
   * Get currency by ID
   */
  async getCurrency(id: string): Promise<Currency | null> {
    const currency = await this.db.currencies.get(id);
    if (!currency || currency.deleted_at) {
      return null;
    }
    return currency;
  }

  /**
   * Get currency by code for a specific company
   */
  async getCurrencyByCode(companyId: string, code: CurrencyCode): Promise<Currency | null> {
    const currency = await this.db.currencies
      .where(['company_id+code'])
      .equals([companyId, code])
      .first();

    if (!currency || currency.deleted_at) {
      return null;
    }
    return currency;
  }

  /**
   * Get all active currencies for a company
   */
  async getActiveCurrencies(companyId: string): Promise<Currency[]> {
    return await this.db.currencies
      .where('company_id')
      .equals(companyId)
      .and((c: Currency) => c.is_active && !c.deleted_at)
      .toArray();
  }

  /**
   * Get the base currency for a company
   */
  async getBaseCurrency(companyId: string): Promise<Currency | null> {
    const currency = await this.db.currencies
      .where(['company_id+is_base_currency'])
      .equals([companyId, true])
      .first();

    if (!currency || currency.deleted_at) {
      return null;
    }
    return currency;
  }

  /**
   * Update currency configuration
   */
  async updateCurrency(id: string, updates: Partial<Currency>): Promise<Currency> {
    const existing = await this.getCurrency(id);
    if (!existing) {
      throw new Error('Currency not found');
    }

    // Prevent changing certain immutable fields
    if (updates.id || updates.created_at || updates.company_id || updates.code) {
      throw new Error('Cannot modify immutable currency fields');
    }

    // If setting as base currency, ensure no other base exists
    if (updates.is_base_currency && !existing.is_base_currency) {
      const existingBase = await this.getBaseCurrency(existing.company_id);
      if (existingBase && existingBase.id !== id) {
        throw new Error('Another base currency exists. Deactivate it first.');
      }
    }

    // Update currency
    const updated: Currency = {
      ...existing,
      ...updates,
      updated_at: Date.now(),
    };

    // Validate
    const validation = this.validateCurrency(updated);
    if (!validation.isValid) {
      throw new Error(`Invalid currency update: ${validation.errors.join(', ')}`);
    }

    // Save
    await this.db.currencies.put(updated);

    return updated;
  }

  /**
   * Deactivate a currency (soft delete)
   */
  async deactivateCurrency(id: string): Promise<void> {
    const currency = await this.getCurrency(id);
    if (!currency) {
      throw new Error('Currency not found');
    }

    // Prevent deactivating base currency
    if (currency.is_base_currency) {
      throw new Error('Cannot deactivate the base currency');
    }

    // Check if currency is in use (this would need to check transactions)
    // For now, we'll just mark as inactive
    await this.db.currencies.update(id, {
      is_active: false,
      updated_at: Date.now(),
    });
  }

  /**
   * Validate currency configuration
   */
  validateCurrency(currency: Partial<Currency>): CurrencyValidationResult {
    const errors: string[] = [];

    if (!currency.company_id) {
      errors.push('Company ID is required');
    }

    if (!currency.code) {
      errors.push('Currency code is required');
    }

    if (!currency.symbol) {
      errors.push('Currency symbol is required');
    }

    if (!currency.symbol_position || !['before', 'after'].includes(currency.symbol_position)) {
      errors.push('Symbol position must be "before" or "after"');
    }

    if (currency.decimal_places === undefined || currency.decimal_places < 0 || currency.decimal_places > 10) {
      errors.push('Decimal places must be between 0 and 10');
    }

    if (!currency.locale) {
      errors.push('Locale is required');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Format an amount according to currency configuration
   */
  formatAmount(amount: string | Decimal, options: CurrencyFormatOptions): string {
    const config = this.getPredefinedConfig(options.currency);
    const decimal = amount instanceof Decimal ? amount : new Decimal(amount);

    const precision = options.precision ?? config.decimalPlaces;

    // Format the number
    let formatted = decimal.toFixed(precision);

    // Split into integer and decimal parts
    const parts = formatted.split('.');
    const integerPart = parts[0] || '0';
    const decimalPart = parts[1];

    // Add thousands separators
    const withSeparators = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, config.thousandsSeparator);

    // Combine with decimal separator
    formatted = decimalPart ? `${withSeparators}${config.decimalSeparator}${decimalPart}` : withSeparators;

    // Add symbol and/or code
    if (options.showSymbol !== false) {
      formatted = config.symbolPosition === 'before'
        ? `${config.symbol}${formatted}`
        : `${formatted} ${config.symbol}`;
    }

    if (options.showCode) {
      formatted = `${formatted} ${options.currency}`;
    }

    return formatted;
  }

  /**
   * Parse a user-entered amount string to Decimal
   */
  parseAmount(input: string, currency: CurrencyCode): Decimal | null {
    if (!input || typeof input !== 'string') {
      return null;
    }

    const config = this.getPredefinedConfig(currency);

    // Remove currency symbols and code
    let cleaned = input
      .replace(new RegExp(config.symbol, 'g'), '')
      .replace(currency, '')
      .trim();

    // Remove thousands separators
    cleaned = cleaned.replace(new RegExp(`\\${config.thousandsSeparator}`, 'g'), '');

    // Replace decimal separator with standard dot
    if (config.decimalSeparator !== '.') {
      cleaned = cleaned.replace(config.decimalSeparator, '.');
    }

    // Try to parse
    try {
      const decimal = new Decimal(cleaned);
      return decimal;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get predefined currency configuration
   */
  private getPredefinedConfig(code: CurrencyCode): CurrencyDisplayConfig {
    // Import PREDEFINED_CURRENCIES at runtime to avoid circular dependencies
    const { PREDEFINED_CURRENCIES } = require('../types/currency.types');
    const config = PREDEFINED_CURRENCIES[code];

    if (!config) {
      throw new Error(`No predefined configuration for currency: ${code}`);
    }

    return {
      code,
      ...config,
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get all supported currency codes
 */
export function getSupportedCurrencies(): CurrencyCode[] {
  const { PREDEFINED_CURRENCIES } = require('../types/currency.types');
  return Object.keys(PREDEFINED_CURRENCIES) as CurrencyCode[];
}

/**
 * Check if a currency code is supported
 */
export function isSupportedCurrency(code: string): code is CurrencyCode {
  const { PREDEFINED_CURRENCIES } = require('../types/currency.types');
  return code in PREDEFINED_CURRENCIES;
}

/**
 * Get currency display name
 */
export function getCurrencyName(code: CurrencyCode): string {
  const { PREDEFINED_CURRENCIES } = require('../types/currency.types');
  return PREDEFINED_CURRENCIES[code]?.name || code;
}

/**
 * Get currency symbol
 */
export function getCurrencySymbol(code: CurrencyCode): string {
  const { PREDEFINED_CURRENCIES } = require('../types/currency.types');
  return PREDEFINED_CURRENCIES[code]?.symbol || code;
}
