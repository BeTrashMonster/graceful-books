/**
 * Currency Type Definitions for Graceful Books
 *
 * This file contains TypeScript types for multi-currency support.
 * Implements GAAP-compliant multi-currency accounting with 28 decimal precision.
 *
 * Requirements:
 * - H5: Multi-Currency - Basic
 * - GAAP compliance for foreign currency transactions
 * - Perfect decimal precision using Decimal.js
 * - Historical exchange rate tracking
 * - Currency gain/loss calculations
 */

import type { BaseEntity, VersionVector } from './database.types';

// ============================================================================
// Currency Configuration Types
// ============================================================================

/**
 * ISO 4217 Currency Codes
 * Supporting 20+ common currencies for global business
 */
export type CurrencyCode =
  | 'USD' // United States Dollar
  | 'EUR' // Euro
  | 'GBP' // British Pound Sterling
  | 'JPY' // Japanese Yen
  | 'CAD' // Canadian Dollar
  | 'AUD' // Australian Dollar
  | 'CHF' // Swiss Franc
  | 'CNY' // Chinese Yuan
  | 'HKD' // Hong Kong Dollar
  | 'NZD' // New Zealand Dollar
  | 'SEK' // Swedish Krona
  | 'KRW' // South Korean Won
  | 'SGD' // Singapore Dollar
  | 'NOK' // Norwegian Krone
  | 'MXN' // Mexican Peso
  | 'INR' // Indian Rupee
  | 'BRL' // Brazilian Real
  | 'ZAR' // South African Rand
  | 'RUB' // Russian Ruble
  | 'TRY' // Turkish Lira
  | 'PLN' // Polish Zloty
  | 'DKK' // Danish Krone
  | 'THB' // Thai Baht
  | 'MYR' // Malaysian Ringgit
  | 'IDR'; // Indonesian Rupiah

/**
 * Currency display configuration
 */
export interface CurrencyDisplayConfig {
  code: CurrencyCode;
  name: string; // Full currency name (e.g., "United States Dollar")
  symbol: string; // Currency symbol (e.g., "$")
  symbolPosition: 'before' | 'after'; // Symbol placement relative to amount
  decimalPlaces: number; // Standard decimal places for display (e.g., 2 for USD, 0 for JPY)
  thousandsSeparator: string; // Thousands separator (e.g., "," for US, "." for Europe)
  decimalSeparator: string; // Decimal separator (e.g., "." for US, "," for Europe)
  locale: string; // ISO locale code for formatting (e.g., "en-US")
}

/**
 * Currency entity for storing currency configurations
 */
export interface Currency extends BaseEntity {
  company_id: string; // UUID - links to Company
  code: CurrencyCode; // ISO 4217 currency code
  name: string; // ENCRYPTED - Full currency name
  symbol: string; // Currency symbol (plaintext for display)
  symbol_position: 'before' | 'after'; // Symbol placement
  decimal_places: number; // Standard decimal places for display
  thousands_separator: string; // Thousands separator
  decimal_separator: string; // Decimal separator
  locale: string; // ISO locale code
  is_active: boolean; // Whether this currency is currently in use
  is_base_currency: boolean; // Whether this is the company's base currency
  version_vector: VersionVector; // For CRDT conflict resolution
}

// ============================================================================
// Exchange Rate Types
// ============================================================================

/**
 * Exchange rate source
 */
export enum ExchangeRateSource {
  MANUAL = 'MANUAL', // Manually entered by user
  AUTOMATIC = 'AUTOMATIC', // Fetched from external API (future feature)
  SYSTEM = 'SYSTEM', // System-generated (e.g., base currency = 1.0)
}

/**
 * Exchange rate entity
 * Stores historical exchange rates for currency conversions
 */
export interface ExchangeRate extends BaseEntity {
  company_id: string; // UUID - links to Company
  from_currency: CurrencyCode; // Source currency
  to_currency: CurrencyCode; // Target currency
  rate: string; // ENCRYPTED - Exchange rate as string with 28 decimal precision
  effective_date: number; // Unix timestamp - when this rate becomes effective
  source: ExchangeRateSource; // How this rate was obtained
  notes: string | null; // ENCRYPTED - Optional notes about this rate
  version_vector: VersionVector; // For CRDT conflict resolution
}

// ============================================================================
// Multi-Currency Transaction Types
// ============================================================================

/**
 * Currency conversion metadata for transaction line items
 * Tracks original amounts and exchange rates used
 */
export interface CurrencyConversionMetadata {
  original_currency: CurrencyCode; // Currency of the original transaction
  original_amount: string; // Original amount in foreign currency (28 decimal precision)
  exchange_rate: string; // Exchange rate used for conversion (28 decimal precision)
  conversion_date: number; // Unix timestamp - when conversion occurred
  base_currency_amount: string; // Converted amount in base currency (28 decimal precision)
  exchange_rate_id: string | null; // UUID - links to ExchangeRate (if using saved rate)
}

/**
 * Extended transaction line item with currency support
 * Extends the base TransactionLineItem type
 */
export interface MultiCurrencyTransactionLineItem {
  currency: CurrencyCode; // Currency for this line item
  currency_conversion: CurrencyConversionMetadata | null; // Conversion details if not in base currency
}

// ============================================================================
// Currency Conversion Types
// ============================================================================

/**
 * Currency conversion request
 */
export interface CurrencyConversionRequest {
  amount: string; // Amount to convert (28 decimal precision)
  from_currency: CurrencyCode; // Source currency
  to_currency: CurrencyCode; // Target currency
  conversion_date: number; // Unix timestamp - date for exchange rate lookup
  use_latest_rate?: boolean; // If true, use the latest rate instead of historical
}

/**
 * Currency conversion result
 */
export interface CurrencyConversionResult {
  original_amount: string; // Original amount (28 decimal precision)
  original_currency: CurrencyCode; // Original currency
  converted_amount: string; // Converted amount (28 decimal precision)
  converted_currency: CurrencyCode; // Converted currency
  exchange_rate: string; // Exchange rate used (28 decimal precision)
  conversion_date: number; // Unix timestamp - when conversion occurred
  rate_source: ExchangeRateSource; // How the rate was obtained
  exchange_rate_id: string | null; // UUID - links to ExchangeRate if applicable
}

/**
 * Batch currency conversion request
 */
export interface BatchCurrencyConversionRequest {
  conversions: CurrencyConversionRequest[];
  to_currency: CurrencyCode; // Target currency for all conversions
}

/**
 * Batch currency conversion result
 */
export interface BatchCurrencyConversionResult {
  conversions: CurrencyConversionResult[];
  total_converted_amount: string; // Sum of all converted amounts (28 decimal precision)
  target_currency: CurrencyCode; // Target currency
}

// ============================================================================
// Currency Gain/Loss Types
// ============================================================================

/**
 * Currency gain/loss type
 */
export enum GainLossType {
  REALIZED = 'REALIZED', // Gain/loss from completed transaction
  UNREALIZED = 'UNREALIZED', // Gain/loss from revaluation of outstanding balances
}

/**
 * Currency gain/loss calculation
 */
export interface CurrencyGainLoss {
  transaction_id: string; // UUID - links to Transaction
  line_item_id: string | null; // UUID - links to TransactionLineItem (if applicable)
  type: GainLossType; // Realized or unrealized
  currency: CurrencyCode; // Foreign currency
  original_amount: string; // Original amount in foreign currency (28 decimal precision)
  original_rate: string; // Original exchange rate (28 decimal precision)
  current_rate: string; // Current exchange rate (28 decimal precision)
  gain_loss_amount: string; // Gain/loss in base currency (28 decimal precision, negative = loss)
  calculation_date: number; // Unix timestamp - when calculated
}

/**
 * Currency revaluation request
 * For calculating unrealized gains/losses on outstanding foreign currency balances
 */
export interface CurrencyRevaluationRequest {
  account_ids: string[]; // Account IDs to revaluate
  revaluation_date: number; // Unix timestamp - date for revaluation
  target_currency: CurrencyCode; // Base currency for revaluation
}

/**
 * Currency revaluation result
 */
export interface CurrencyRevaluationResult {
  account_id: string; // Account ID
  currency: CurrencyCode; // Foreign currency
  outstanding_balance: string; // Outstanding balance in foreign currency (28 decimal precision)
  original_rate: string; // Original exchange rate (28 decimal precision)
  current_rate: string; // Current exchange rate (28 decimal precision)
  unrealized_gain_loss: string; // Unrealized gain/loss (28 decimal precision, negative = loss)
  revaluation_date: number; // Unix timestamp
}

// ============================================================================
// Currency Report Types
// ============================================================================

/**
 * Dual-currency report configuration
 */
export interface DualCurrencyReportConfig {
  base_currency: CurrencyCode; // Company's base currency
  reporting_currency: CurrencyCode; // Additional currency for reporting
  use_average_rate: boolean; // If true, use average rate for period; if false, use end rate
  period_start: number; // Unix timestamp
  period_end: number; // Unix timestamp
}

/**
 * Dual-currency amount
 * Shows same amount in two currencies
 */
export interface DualCurrencyAmount {
  base_currency: CurrencyCode; // Base currency
  base_amount: string; // Amount in base currency (28 decimal precision)
  reporting_currency: CurrencyCode; // Reporting currency
  reporting_amount: string; // Amount in reporting currency (28 decimal precision)
  exchange_rate: string; // Exchange rate used (28 decimal precision)
}

/**
 * Multi-currency balance sheet line item
 */
export interface MultiCurrencyBalanceSheetLine {
  account_id: string; // Account ID
  account_name: string; // Account name
  amounts_by_currency: Map<CurrencyCode, string>; // Amounts in each currency (28 decimal precision)
  base_currency_total: string; // Total in base currency (28 decimal precision)
  dual_currency?: DualCurrencyAmount; // Optional dual-currency display
}

/**
 * Multi-currency income statement line item
 */
export interface MultiCurrencyIncomeStatementLine {
  account_id: string; // Account ID
  account_name: string; // Account name
  amounts_by_currency: Map<CurrencyCode, string>; // Amounts in each currency (28 decimal precision)
  base_currency_total: string; // Total in base currency (28 decimal precision)
  dual_currency?: DualCurrencyAmount; // Optional dual-currency display
}

// ============================================================================
// Predefined Currency Configurations
// ============================================================================

/**
 * Predefined currency configurations for 20+ common currencies
 * These can be used to seed the database with standard currency settings
 */
export const PREDEFINED_CURRENCIES: Readonly<Record<CurrencyCode, Omit<CurrencyDisplayConfig, 'code'>>> = {
  USD: {
    name: 'United States Dollar',
    symbol: '$',
    symbolPosition: 'before',
    decimalPlaces: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.',
    locale: 'en-US',
  },
  EUR: {
    name: 'Euro',
    symbol: '€',
    symbolPosition: 'before',
    decimalPlaces: 2,
    thousandsSeparator: '.',
    decimalSeparator: ',',
    locale: 'de-DE',
  },
  GBP: {
    name: 'British Pound Sterling',
    symbol: '£',
    symbolPosition: 'before',
    decimalPlaces: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.',
    locale: 'en-GB',
  },
  JPY: {
    name: 'Japanese Yen',
    symbol: '¥',
    symbolPosition: 'before',
    decimalPlaces: 0,
    thousandsSeparator: ',',
    decimalSeparator: '.',
    locale: 'ja-JP',
  },
  CAD: {
    name: 'Canadian Dollar',
    symbol: 'CA$',
    symbolPosition: 'before',
    decimalPlaces: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.',
    locale: 'en-CA',
  },
  AUD: {
    name: 'Australian Dollar',
    symbol: 'A$',
    symbolPosition: 'before',
    decimalPlaces: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.',
    locale: 'en-AU',
  },
  CHF: {
    name: 'Swiss Franc',
    symbol: 'CHF',
    symbolPosition: 'before',
    decimalPlaces: 2,
    thousandsSeparator: "'",
    decimalSeparator: '.',
    locale: 'de-CH',
  },
  CNY: {
    name: 'Chinese Yuan',
    symbol: '¥',
    symbolPosition: 'before',
    decimalPlaces: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.',
    locale: 'zh-CN',
  },
  HKD: {
    name: 'Hong Kong Dollar',
    symbol: 'HK$',
    symbolPosition: 'before',
    decimalPlaces: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.',
    locale: 'zh-HK',
  },
  NZD: {
    name: 'New Zealand Dollar',
    symbol: 'NZ$',
    symbolPosition: 'before',
    decimalPlaces: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.',
    locale: 'en-NZ',
  },
  SEK: {
    name: 'Swedish Krona',
    symbol: 'kr',
    symbolPosition: 'after',
    decimalPlaces: 2,
    thousandsSeparator: ' ',
    decimalSeparator: ',',
    locale: 'sv-SE',
  },
  KRW: {
    name: 'South Korean Won',
    symbol: '₩',
    symbolPosition: 'before',
    decimalPlaces: 0,
    thousandsSeparator: ',',
    decimalSeparator: '.',
    locale: 'ko-KR',
  },
  SGD: {
    name: 'Singapore Dollar',
    symbol: 'S$',
    symbolPosition: 'before',
    decimalPlaces: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.',
    locale: 'en-SG',
  },
  NOK: {
    name: 'Norwegian Krone',
    symbol: 'kr',
    symbolPosition: 'after',
    decimalPlaces: 2,
    thousandsSeparator: ' ',
    decimalSeparator: ',',
    locale: 'nb-NO',
  },
  MXN: {
    name: 'Mexican Peso',
    symbol: '$',
    symbolPosition: 'before',
    decimalPlaces: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.',
    locale: 'es-MX',
  },
  INR: {
    name: 'Indian Rupee',
    symbol: '₹',
    symbolPosition: 'before',
    decimalPlaces: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.',
    locale: 'en-IN',
  },
  BRL: {
    name: 'Brazilian Real',
    symbol: 'R$',
    symbolPosition: 'before',
    decimalPlaces: 2,
    thousandsSeparator: '.',
    decimalSeparator: ',',
    locale: 'pt-BR',
  },
  ZAR: {
    name: 'South African Rand',
    symbol: 'R',
    symbolPosition: 'before',
    decimalPlaces: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.',
    locale: 'en-ZA',
  },
  RUB: {
    name: 'Russian Ruble',
    symbol: '₽',
    symbolPosition: 'after',
    decimalPlaces: 2,
    thousandsSeparator: ' ',
    decimalSeparator: ',',
    locale: 'ru-RU',
  },
  TRY: {
    name: 'Turkish Lira',
    symbol: '₺',
    symbolPosition: 'before',
    decimalPlaces: 2,
    thousandsSeparator: '.',
    decimalSeparator: ',',
    locale: 'tr-TR',
  },
  PLN: {
    name: 'Polish Zloty',
    symbol: 'zł',
    symbolPosition: 'after',
    decimalPlaces: 2,
    thousandsSeparator: ' ',
    decimalSeparator: ',',
    locale: 'pl-PL',
  },
  DKK: {
    name: 'Danish Krone',
    symbol: 'kr',
    symbolPosition: 'after',
    decimalPlaces: 2,
    thousandsSeparator: '.',
    decimalSeparator: ',',
    locale: 'da-DK',
  },
  THB: {
    name: 'Thai Baht',
    symbol: '฿',
    symbolPosition: 'before',
    decimalPlaces: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.',
    locale: 'th-TH',
  },
  MYR: {
    name: 'Malaysian Ringgit',
    symbol: 'RM',
    symbolPosition: 'before',
    decimalPlaces: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.',
    locale: 'ms-MY',
  },
  IDR: {
    name: 'Indonesian Rupiah',
    symbol: 'Rp',
    symbolPosition: 'before',
    decimalPlaces: 0,
    thousandsSeparator: '.',
    decimalSeparator: ',',
    locale: 'id-ID',
  },
} as const;

// ============================================================================
// Currency Utility Types
// ============================================================================

/**
 * Currency formatting options
 */
export interface CurrencyFormatOptions {
  currency: CurrencyCode;
  showSymbol?: boolean; // If true, include currency symbol
  showCode?: boolean; // If true, include currency code
  precision?: number; // Number of decimal places (overrides default)
  locale?: string; // Locale for formatting (overrides default)
}

/**
 * Currency validation result
 */
export interface CurrencyValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Exchange rate validation result
 */
export interface ExchangeRateValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}
