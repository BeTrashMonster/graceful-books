/**
 * Tests for Financial Metrics Calculation Utilities
 */

import { describe, it, expect } from 'vitest';
import {
  addDecimal,
  subtractDecimal,
  compareDecimal,
  calculateFinancialMetrics,
  getStartOfMonth,
  getEndOfMonth,
  getStartOfYear,
  getEndOfYear,
  formatCurrency,
  calculatePercentageChange,
  type TransactionWithLineItems,
  type AccountInfo,
} from './metricsCalculation';
import { AccountType, TransactionType, TransactionStatus } from '../types/database.types';

describe('Decimal Arithmetic', () => {
  describe('addDecimal', () => {
    it('should add two positive numbers', () => {
      expect(addDecimal('10.50', '5.25')).toBe('15.75');
    });

    it('should add positive and negative numbers', () => {
      expect(addDecimal('10.50', '-5.25')).toBe('5.25');
    });

    it('should handle zero', () => {
      expect(addDecimal('0.00', '5.25')).toBe('5.25');
      expect(addDecimal('5.25', '0.00')).toBe('5.25');
    });

    it('should maintain precision', () => {
      expect(addDecimal('0.01', '0.01')).toBe('0.02');
      expect(addDecimal('1.99', '0.01')).toBe('2.00');
    });
  });

  describe('subtractDecimal', () => {
    it('should subtract two positive numbers', () => {
      expect(subtractDecimal('10.50', '5.25')).toBe('5.25');
    });

    it('should handle negative results', () => {
      expect(subtractDecimal('5.25', '10.50')).toBe('-5.25');
    });

    it('should handle zero', () => {
      expect(subtractDecimal('5.25', '0.00')).toBe('5.25');
      expect(subtractDecimal('5.25', '5.25')).toBe('0.00');
    });
  });

  describe('compareDecimal', () => {
    it('should return -1 when first is less than second', () => {
      expect(compareDecimal('5.00', '10.00')).toBe(-1);
    });

    it('should return 1 when first is greater than second', () => {
      expect(compareDecimal('10.00', '5.00')).toBe(1);
    });

    it('should return 0 when values are equal', () => {
      expect(compareDecimal('10.00', '10.00')).toBe(0);
    });

    it('should handle negative numbers', () => {
      expect(compareDecimal('-5.00', '-10.00')).toBe(1);
      expect(compareDecimal('-10.00', '-5.00')).toBe(-1);
    });
  });
});

describe('calculateFinancialMetrics', () => {
  const createAccount = (id: string, type: AccountInfo['type']): AccountInfo => ({
    id,
    type,
  });

  const createTransaction = (
    id: string,
    date: number,
    lineItems: Array<{ account_id: string; debit: string; credit: string }>
  ): TransactionWithLineItems => ({
    id,
    company_id: 'company-1',
    transaction_number: `TXN-${id}`,
    transaction_date: date,
    type: TransactionType.JOURNAL_ENTRY,
    status: TransactionStatus.POSTED,
    description: null,
    reference: null,
    memo: null,
    attachments: [],
    created_at: date,
    updated_at: date,
    deleted_at: null,
    version_vector: {},
    lineItems: lineItems.map((item, index) => ({
      id: `${id}-line-${index}`,
      transaction_id: id,
      account_id: item.account_id,
      debit: item.debit,
      credit: item.credit,
      description: null,
      contact_id: null,
      product_id: null,
      created_at: date,
      updated_at: date,
      deleted_at: null,
      version_vector: {},
    })),
  });

  it('should calculate metrics with income and expenses', () => {
    const accounts = new Map<string, AccountInfo>([
      ['income-1', createAccount('income-1', AccountType.INCOME)],
      ['expense-1', createAccount('expense-1', AccountType.EXPENSE)],
      ['cash', createAccount('cash', AccountType.ASSET)],
    ]);

    const jan1 = new Date('2024-01-01').getTime();
    const jan15 = new Date('2024-01-15').getTime();
    const feb1 = new Date('2024-02-01').getTime();

    const transactions: TransactionWithLineItems[] = [
      // Income transaction in January
      createTransaction('txn-1', jan1, [
        { account_id: 'cash', debit: '1000.00', credit: '0.00' },
        { account_id: 'income-1', debit: '0.00', credit: '1000.00' },
      ]),
      // Expense transaction in January
      createTransaction('txn-2', jan15, [
        { account_id: 'expense-1', debit: '300.00', credit: '0.00' },
        { account_id: 'cash', debit: '0.00', credit: '300.00' },
      ]),
      // Income transaction in February (should be excluded)
      createTransaction('txn-3', feb1, [
        { account_id: 'cash', debit: '500.00', credit: '0.00' },
        { account_id: 'income-1', debit: '0.00', credit: '500.00' },
      ]),
    ];

    const startDate = new Date('2024-01-01').getTime();
    const endDate = new Date('2024-01-31T23:59:59.999Z').getTime();

    const metrics = calculateFinancialMetrics(transactions, accounts, startDate, endDate);

    expect(metrics.revenue).toBe('1000.00');
    expect(metrics.expenses).toBe('300.00');
    expect(metrics.netProfit).toBe('700.00');
    expect(metrics.isProfitable).toBe(true);
  });

  it('should handle negative profit', () => {
    const accounts = new Map<string, AccountInfo>([
      ['income-1', createAccount('income-1', AccountType.INCOME)],
      ['expense-1', createAccount('expense-1', AccountType.EXPENSE)],
      ['cash', createAccount('cash', AccountType.ASSET)],
    ]);

    const jan1 = new Date('2024-01-01').getTime();

    const transactions: TransactionWithLineItems[] = [
      createTransaction('txn-1', jan1, [
        { account_id: 'cash', debit: '100.00', credit: '0.00' },
        { account_id: 'income-1', debit: '0.00', credit: '100.00' },
      ]),
      createTransaction('txn-2', jan1, [
        { account_id: 'expense-1', debit: '500.00', credit: '0.00' },
        { account_id: 'cash', debit: '0.00', credit: '500.00' },
      ]),
    ];

    const startDate = new Date('2024-01-01').getTime();
    const endDate = new Date('2024-01-31T23:59:59.999Z').getTime();

    const metrics = calculateFinancialMetrics(transactions, accounts, startDate, endDate);

    expect(metrics.revenue).toBe('100.00');
    expect(metrics.expenses).toBe('500.00');
    expect(metrics.netProfit).toBe('-400.00');
    expect(metrics.isProfitable).toBe(false);
  });

  it('should exclude draft transactions', () => {
    const accounts = new Map<string, AccountInfo>([
      ['income-1', createAccount('income-1', AccountType.INCOME)],
      ['cash', createAccount('cash', AccountType.ASSET)],
    ]);

    const jan1 = new Date('2024-01-01').getTime();

    const draftTransaction: TransactionWithLineItems = {
      ...createTransaction('txn-1', jan1, [
        { account_id: 'cash', debit: '1000.00', credit: '0.00' },
        { account_id: 'income-1', debit: '0.00', credit: '1000.00' },
      ]),
      status: TransactionStatus.DRAFT,
    };

    const startDate = new Date('2024-01-01').getTime();
    const endDate = new Date('2024-01-31T23:59:59.999Z').getTime();

    const metrics = calculateFinancialMetrics([draftTransaction], accounts, startDate, endDate);

    expect(metrics.revenue).toBe('0.00');
    expect(metrics.expenses).toBe('0.00');
    expect(metrics.netProfit).toBe('0.00');
  });

  it('should exclude deleted transactions', () => {
    const accounts = new Map<string, AccountInfo>([
      ['income-1', createAccount('income-1', AccountType.INCOME)],
      ['cash', createAccount('cash', AccountType.ASSET)],
    ]);

    const jan1 = new Date('2024-01-01').getTime();

    const deletedTransaction: TransactionWithLineItems = {
      ...createTransaction('txn-1', jan1, [
        { account_id: 'cash', debit: '1000.00', credit: '0.00' },
        { account_id: 'income-1', debit: '0.00', credit: '1000.00' },
      ]),
      deleted_at: jan1,
    };

    const startDate = new Date('2024-01-01').getTime();
    const endDate = new Date('2024-01-31T23:59:59.999Z').getTime();

    const metrics = calculateFinancialMetrics([deletedTransaction], accounts, startDate, endDate);

    expect(metrics.revenue).toBe('0.00');
    expect(metrics.expenses).toBe('0.00');
  });

  it('should handle multiple income and expense types', () => {
    const accounts = new Map<string, AccountInfo>([
      ['income-1', createAccount('income-1', AccountType.INCOME)],
      ['other-income', createAccount('other-income', AccountType.OTHER_INCOME)],
      ['expense-1', createAccount('expense-1', AccountType.EXPENSE)],
      ['cogs', createAccount('cogs', AccountType.COGS)],
      ['cash', createAccount('cash', AccountType.ASSET)],
    ]);

    const jan1 = new Date('2024-01-01').getTime();

    const transactions: TransactionWithLineItems[] = [
      createTransaction('txn-1', jan1, [
        { account_id: 'cash', debit: '500.00', credit: '0.00' },
        { account_id: 'income-1', debit: '0.00', credit: '500.00' },
      ]),
      createTransaction('txn-2', jan1, [
        { account_id: 'cash', debit: '100.00', credit: '0.00' },
        { account_id: 'other-income', debit: '0.00', credit: '100.00' },
      ]),
      createTransaction('txn-3', jan1, [
        { account_id: 'expense-1', debit: '200.00', credit: '0.00' },
        { account_id: 'cash', debit: '0.00', credit: '200.00' },
      ]),
      createTransaction('txn-4', jan1, [
        { account_id: 'cogs', debit: '50.00', credit: '0.00' },
        { account_id: 'cash', debit: '0.00', credit: '50.00' },
      ]),
    ];

    const startDate = new Date('2024-01-01').getTime();
    const endDate = new Date('2024-01-31T23:59:59.999Z').getTime();

    const metrics = calculateFinancialMetrics(transactions, accounts, startDate, endDate);

    expect(metrics.revenue).toBe('600.00');
    expect(metrics.expenses).toBe('250.00');
    expect(metrics.netProfit).toBe('350.00');
    expect(metrics.isProfitable).toBe(true);
  });

  it('should handle empty transactions', () => {
    const accounts = new Map<string, AccountInfo>();
    const startDate = new Date('2024-01-01').getTime();
    const endDate = new Date('2024-01-31T23:59:59.999Z').getTime();

    const metrics = calculateFinancialMetrics([], accounts, startDate, endDate);

    expect(metrics.revenue).toBe('0.00');
    expect(metrics.expenses).toBe('0.00');
    expect(metrics.netProfit).toBe('0.00');
    expect(metrics.isProfitable).toBe(false);
  });
});

describe('Date Utilities', () => {
  describe('getStartOfMonth', () => {
    it('should return start of current month', () => {
      const testDate = new Date('2024-06-15T14:30:00');
      const start = getStartOfMonth(testDate);
      const startDate = new Date(start);

      expect(startDate.getFullYear()).toBe(2024);
      expect(startDate.getMonth()).toBe(5); // June (0-indexed)
      expect(startDate.getDate()).toBe(1);
      expect(startDate.getHours()).toBe(0);
      expect(startDate.getMinutes()).toBe(0);
      expect(startDate.getSeconds()).toBe(0);
    });
  });

  describe('getEndOfMonth', () => {
    it('should return end of current month', () => {
      const testDate = new Date('2024-06-15T14:30:00');
      const end = getEndOfMonth(testDate);
      const endDate = new Date(end);

      expect(endDate.getFullYear()).toBe(2024);
      expect(endDate.getMonth()).toBe(5); // June (0-indexed)
      expect(endDate.getDate()).toBe(30);
      expect(endDate.getHours()).toBe(23);
      expect(endDate.getMinutes()).toBe(59);
      expect(endDate.getSeconds()).toBe(59);
    });

    it('should handle February correctly', () => {
      const testDate = new Date('2024-02-15T14:30:00'); // Leap year
      const end = getEndOfMonth(testDate);
      const endDate = new Date(end);

      expect(endDate.getDate()).toBe(29);
    });

    it('should handle non-leap year February', () => {
      const testDate = new Date('2023-02-15T14:30:00');
      const end = getEndOfMonth(testDate);
      const endDate = new Date(end);

      expect(endDate.getDate()).toBe(28);
    });
  });

  describe('getStartOfYear', () => {
    it('should return start of current year', () => {
      const testDate = new Date('2024-06-15T14:30:00');
      const start = getStartOfYear(testDate);
      const startDate = new Date(start);

      expect(startDate.getFullYear()).toBe(2024);
      expect(startDate.getMonth()).toBe(0); // January
      expect(startDate.getDate()).toBe(1);
    });
  });

  describe('getEndOfYear', () => {
    it('should return end of current year', () => {
      const testDate = new Date('2024-06-15T14:30:00');
      const end = getEndOfYear(testDate);
      const endDate = new Date(end);

      expect(endDate.getFullYear()).toBe(2024);
      expect(endDate.getMonth()).toBe(11); // December
      expect(endDate.getDate()).toBe(31);
    });
  });
});

describe('formatCurrency', () => {
  it('should format positive amounts', () => {
    expect(formatCurrency('1000.00')).toBe('$1,000.00');
    expect(formatCurrency('1234.56')).toBe('$1,234.56');
  });

  it('should format negative amounts', () => {
    expect(formatCurrency('-1000.00')).toBe('-$1,000.00');
    expect(formatCurrency('-1234.56')).toBe('-$1,234.56');
  });

  it('should handle zero', () => {
    expect(formatCurrency('0.00')).toBe('$0.00');
  });

  it('should handle custom currency symbols', () => {
    expect(formatCurrency('1000.00', '€')).toBe('€1,000.00');
    expect(formatCurrency('1000.00', '£')).toBe('£1,000.00');
  });

  it('should handle large amounts', () => {
    expect(formatCurrency('1000000.00')).toBe('$1,000,000.00');
  });

  it('should maintain two decimal places', () => {
    expect(formatCurrency('100.10')).toBe('$100.10');
    expect(formatCurrency('100.01')).toBe('$100.01');
  });
});

describe('calculatePercentageChange', () => {
  it('should calculate positive percentage change', () => {
    expect(calculatePercentageChange('100.00', '150.00')).toBe('50.00');
  });

  it('should calculate negative percentage change', () => {
    expect(calculatePercentageChange('150.00', '100.00')).toBe('-33.33');
  });

  it('should handle zero old value', () => {
    expect(calculatePercentageChange('0.00', '100.00')).toBe('100.00');
    expect(calculatePercentageChange('0.00', '0.00')).toBe('0.00');
  });

  it('should handle no change', () => {
    expect(calculatePercentageChange('100.00', '100.00')).toBe('0.00');
  });

  it('should handle 100% decrease', () => {
    expect(calculatePercentageChange('100.00', '0.00')).toBe('-100.00');
  });

  it('should handle negative values', () => {
    expect(calculatePercentageChange('-100.00', '-50.00')).toBe('50.00');
  });
});
