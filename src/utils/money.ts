/**
 * Money Utilities
 *
 * All monetary calculations use integer cents to avoid floating point errors.
 * Display functions convert back to dollars for user presentation.
 */

/**
 * Zero cents constant
 */
export const ZERO_CENTS = 0

/**
 * Convert dollars (with decimals) to cents (integer)
 *
 * @param dollars - Amount in dollars (e.g., 10.99)
 * @returns Amount in cents as integer (e.g., 1099)
 *
 * @example
 * toCents(10.99) // Returns 1099
 * toCents(0.01) // Returns 1
 */
export function toCents(dollars: number): number {
  // Round to handle floating point imprecision
  return Math.round(dollars * 100)
}

/**
 * Convert cents (integer) to dollars (with decimals)
 *
 * @param cents - Amount in cents (e.g., 1099)
 * @returns Amount in dollars (e.g., 10.99)
 *
 * @example
 * fromCents(1099) // Returns 10.99
 * fromCents(1) // Returns 0.01
 */
export function fromCents(cents: number): number {
  return cents / 100
}

/**
 * Add two money amounts (in cents)
 *
 * @param a - First amount in cents
 * @param b - Second amount in cents
 * @returns Sum in cents
 */
export function addMoney(a: number, b: number): number {
  return a + b
}

/**
 * Subtract money amounts (in cents)
 *
 * @param a - Amount to subtract from (cents)
 * @param b - Amount to subtract (cents)
 * @returns Difference in cents
 */
export function subtractMoney(a: number, b: number): number {
  return a - b
}

/**
 * Multiply money by a factor
 *
 * @param cents - Amount in cents
 * @param factor - Multiplier
 * @returns Result in cents (rounded)
 */
export function multiplyMoney(cents: number, factor: number): number {
  return Math.round(cents * factor)
}

/**
 * Format cents as a currency string
 *
 * @param cents - Amount in cents
 * @param currency - Currency code (default: USD)
 * @param locale - Locale for formatting (default: en-US)
 * @returns Formatted currency string
 *
 * @example
 * formatMoney(1099) // Returns "$10.99"
 * formatMoney(-1099) // Returns "-$10.99"
 * formatMoney(1099, 'EUR', 'de-DE') // Returns "10,99 €"
 */
export function formatMoney(
  cents: number,
  currency: string = 'USD',
  locale: string = 'en-US'
): string {
  const dollars = fromCents(cents)
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(dollars)
}

/**
 * Check if debits and credits are balanced
 *
 * For double-entry accounting, total debits must equal total credits.
 *
 * @param totalDebitsCents - Total debits in cents
 * @param totalCreditsCents - Total credits in cents
 * @returns True if balanced (debits === credits)
 *
 * @example
 * isBalanced(1000, 1000) // Returns true
 * isBalanced(1000, 999) // Returns false
 */
export function isBalanced(
  totalDebitsCents: number,
  totalCreditsCents: number
): boolean {
  // With integer cents, we can do exact comparison
  return totalDebitsCents === totalCreditsCents
}

/**
 * Parse a user-entered money string to cents
 *
 * Handles various formats:
 * - "10.99" -> 1099
 * - "$10.99" -> 1099
 * - "10,99" -> 1099 (European format)
 * - "1,000.00" -> 100000
 *
 * @param input - User-entered string
 * @returns Amount in cents, or null if invalid
 */
export function parseMoney(input: string): number | null {
  if (!input || typeof input !== 'string') {
    return null
  }

  // Remove currency symbols and whitespace
  let cleaned = input.replace(/[$€£¥]/g, '').trim()

  // Handle European format (1.000,00) vs US format (1,000.00)
  const hasEuropeanFormat = /^\d{1,3}(\.\d{3})*,\d{2}$/.test(cleaned)

  if (hasEuropeanFormat) {
    // European: 1.000,00 -> 1000.00
    cleaned = cleaned.replace(/\./g, '').replace(',', '.')
  } else {
    // US: 1,000.00 -> 1000.00
    cleaned = cleaned.replace(/,/g, '')
  }

  const dollars = parseFloat(cleaned)

  if (isNaN(dollars)) {
    return null
  }

  return toCents(dollars)
}

/**
 * Sum an array of cent amounts
 *
 * @param amounts - Array of amounts in cents
 * @returns Total in cents
 */
export function sumMoney(amounts: number[]): number {
  return amounts.reduce((sum, amount) => sum + amount, 0)
}

/**
 * Calculate percentage of an amount
 *
 * @param cents - Base amount in cents
 * @param percentage - Percentage (e.g., 8.25 for 8.25%)
 * @returns Percentage amount in cents (rounded)
 */
export function calculatePercentage(cents: number, percentage: number): number {
  return Math.round((cents * percentage) / 100)
}
