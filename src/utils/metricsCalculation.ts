/**
 * Financial Metrics Calculation Utilities
 *
 * Provides pure functions for calculating financial metrics from transaction data.
 * All calculations use string-based decimal arithmetic to maintain precision.
 */

import type { Transaction, TransactionLineItem, AccountType } from '@/types/database.types';

/**
 * Decimal precision for financial calculations
 */
const PRECISION = 2;

/**
 * Add two decimal strings with precision
 */
export function addDecimal(a: string, b: string): string {
  const result = parseFloat(a) + parseFloat(b);
  return result.toFixed(PRECISION);
}

/**
 * Subtract two decimal strings with precision
 */
export function subtractDecimal(a: string, b: string): string {
  const result = parseFloat(a) - parseFloat(b);
  return result.toFixed(PRECISION);
}

/**
 * Compare two decimal strings
 * Returns: -1 if a < b, 0 if a === b, 1 if a > b
 */
export function compareDecimal(a: string, b: string): number {
  const aNum = parseFloat(a);
  const bNum = parseFloat(b);
  if (aNum < bNum) return -1;
  if (aNum > bNum) return 1;
  return 0;
}

/**
 * Financial metrics for a given period
 */
export interface FinancialMetrics {
  revenue: string; // Total income
  expenses: string; // Total expenses
  netProfit: string; // Revenue - Expenses
  isProfitable: boolean; // Whether netProfit > 0
}

/**
 * Transaction with line items
 */
export interface TransactionWithLineItems extends Transaction {
  lineItems: TransactionLineItem[];
}

/**
 * Account with type information
 */
export interface AccountInfo {
  id: string;
  type: AccountType;
}

/**
 * Calculate financial metrics from transactions
 *
 * @param transactions - Array of transactions with line items
 * @param accounts - Map of account ID to account info
 * @param startDate - Start of period (Unix timestamp)
 * @param endDate - End of period (Unix timestamp)
 * @returns Financial metrics for the period
 */
export function calculateFinancialMetrics(
  transactions: TransactionWithLineItems[],
  accounts: Map<string, AccountInfo>,
  startDate: number,
  endDate: number
): FinancialMetrics {
  let revenue = '0.00';
  let expenses = '0.00';

  // Filter transactions within the date range and that are posted
  const relevantTransactions = transactions.filter(
    (txn) =>
      txn.transaction_date >= startDate &&
      txn.transaction_date <= endDate &&
      txn.status === 'POSTED' &&
      txn.deleted_at === null
  );

  // Process each transaction's line items
  for (const transaction of relevantTransactions) {
    for (const lineItem of transaction.lineItems) {
      if (lineItem.deleted_at !== null) continue;

      const account = accounts.get(lineItem.account_id);
      if (!account) continue;

      // For income accounts, credits increase revenue
      if (account.type === 'INCOME' || account.type === 'OTHER_INCOME') {
        const creditAmount = parseFloat(lineItem.credit);
        const debitAmount = parseFloat(lineItem.debit);
        const netAmount = creditAmount - debitAmount;
        if (netAmount > 0) {
          revenue = addDecimal(revenue, netAmount.toFixed(PRECISION));
        }
      }

      // For expense accounts, debits increase expenses
      if (account.type === 'EXPENSE' || account.type === 'OTHER_EXPENSE' || account.type === 'COGS') {
        const debitAmount = parseFloat(lineItem.debit);
        const creditAmount = parseFloat(lineItem.credit);
        const netAmount = debitAmount - creditAmount;
        if (netAmount > 0) {
          expenses = addDecimal(expenses, netAmount.toFixed(PRECISION));
        }
      }
    }
  }

  const netProfit = subtractDecimal(revenue, expenses);
  const isProfitable = compareDecimal(netProfit, '0.00') > 0;

  return {
    revenue,
    expenses,
    netProfit,
    isProfitable,
  };
}

/**
 * Get the start of the current month (Unix timestamp)
 */
export function getStartOfMonth(date: Date = new Date()): number {
  const start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  return start.getTime();
}

/**
 * Get the end of the current month (Unix timestamp)
 */
export function getEndOfMonth(date: Date = new Date()): number {
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return end.getTime();
}

/**
 * Get the start of the current year (Unix timestamp)
 */
export function getStartOfYear(date: Date = new Date()): number {
  const start = new Date(date.getFullYear(), 0, 1, 0, 0, 0, 0);
  return start.getTime();
}

/**
 * Get the end of the current year (Unix timestamp)
 */
export function getEndOfYear(date: Date = new Date()): number {
  const end = new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999);
  return end.getTime();
}

/**
 * Format a decimal string as currency
 */
export function formatCurrency(amount: string, currencySymbol: string = '$'): string {
  const num = parseFloat(amount);
  const isNegative = num < 0;
  const absNum = Math.abs(num);
  const formatted = absNum.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (isNegative) {
    return `-${currencySymbol}${formatted}`;
  }
  return `${currencySymbol}${formatted}`;
}

/**
 * Calculate percentage change between two values
 */
export function calculatePercentageChange(oldValue: string, newValue: string): string {
  const oldNum = parseFloat(oldValue);
  const newNum = parseFloat(newValue);

  if (oldNum === 0) {
    return newNum > 0 ? '100.00' : '0.00';
  }

  const change = ((newNum - oldNum) / Math.abs(oldNum)) * 100;
  return change.toFixed(2);
}
