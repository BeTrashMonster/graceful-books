/**
 * Currency Schema Definitions
 *
 * Defines the structure for currencies and exchange rates tables
 * for multi-currency support in double-entry accounting.
 *
 * Requirements:
 * - H5: Multi-Currency - Basic
 * - ARCH-004: CRDT-Compatible Schema Design
 */

import type { BaseEntity } from '../../types/database.types';

/**
 * Currency entity
 */
export interface Currency extends BaseEntity {
  id: string;
  company_id: string;
  code: string; // ISO 4217 code (e.g., "USD", "EUR")
  name: string;
  symbol: string;
  decimal_places: number;
  is_base_currency: boolean;
  is_active: boolean;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  version_vector: Record<string, number>;
}

/**
 * Exchange Rate entity
 */
export interface ExchangeRate extends BaseEntity {
  id: string;
  company_id: string;
  from_currency: string; // Currency code
  to_currency: string; // Currency code
  rate: string; // Decimal as string for precision
  effective_date: number; // Timestamp
  source: string | null; // e.g., "manual", "api", "bank"
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  version_vector: Record<string, number>;
}

/**
 * Dexie.js schema definition for Currencies table
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - company_id: For querying currencies by company
 * - code: For looking up currencies by ISO code
 * - [company_id+code]: Compound index for unique currency per company
 * - [company_id+is_base_currency]: For finding the base currency
 * - is_active: For querying active currencies
 * - updated_at: For CRDT conflict resolution (Last-Write-Wins)
 * - deleted_at: For soft delete filtering
 */
export const currenciesSchema = 'id, company_id, code, [company_id+code], [company_id+is_base_currency], is_active, updated_at, deleted_at';

/**
 * Dexie.js schema definition for ExchangeRates table
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - company_id: For querying exchange rates by company
 * - [from_currency+to_currency]: Compound index for currency pair lookups
 * - [company_id+from_currency+to_currency]: For company-specific pair lookups
 * - effective_date: For historical rate lookups
 * - [from_currency+to_currency+effective_date]: For finding rates at specific dates
 * - source: For filtering by rate source
 * - updated_at: For CRDT conflict resolution (Last-Write-Wins)
 * - deleted_at: For soft delete filtering
 */
export const exchangeRatesSchema = 'id, company_id, [from_currency+to_currency], [company_id+from_currency+to_currency], effective_date, [from_currency+to_currency+effective_date], source, updated_at, deleted_at';

/**
 * Table name constants
 */
export const CURRENCIES_TABLE = 'currencies';
export const EXCHANGE_RATES_TABLE = 'exchangeRates';
