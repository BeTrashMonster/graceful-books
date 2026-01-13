/**
 * Statement Parser Tests
 *
 * Tests for CSV and PDF parsing functionality
 */

import { describe, it, expect } from 'vitest';
import { parseCSVStatement, validateStatement } from './statementParser';

describe('statementParser', () => {
  describe('parseCSVStatement', () => {
    it('should parse a basic CSV with header row', async () => {
      const csvContent = `Date,Description,Amount,Balance
01/15/2024,Coffee Shop,-4.50,1245.50
01/16/2024,Paycheck,2500.00,3745.50
01/17/2024,Rent Payment,-1200.00,2545.50`;

      const result = await parseCSVStatement(csvContent, { hasHeader: true });

      expect(result.transactions).toHaveLength(3);
      expect(result.transactions[0]).toMatchObject({
        description: 'Coffee Shop',
        amount: -450, // -4.50 in cents
      });
      expect(result.format).toBe('csv');
    });

    it('should parse CSV with debit/credit columns', async () => {
      const csvContent = `Date,Description,Debit,Credit,Balance
01/15/2024,Coffee Shop,4.50,,1245.50
01/16/2024,Paycheck,,2500.00,3745.50`;

      const result = await parseCSVStatement(csvContent, { hasHeader: true });

      expect(result.transactions).toHaveLength(2);
      expect(result.transactions[0]?.amount).toBe(-450); // Debit is negative
      expect(result.transactions[1]?.amount).toBe(250000); // Credit is positive
    });

    it('should handle various date formats', async () => {
      const csvContent = `Date,Description,Amount
01/15/2024,Test 1,10.00
2024-01-16,Test 2,20.00
1/17/2024,Test 3,30.00`;

      const result = await parseCSVStatement(csvContent, { hasHeader: true });

      expect(result.transactions).toHaveLength(3);
      expect(result.transactions[0]?.date).toBeDefined();
      expect(result.transactions[1]?.date).toBeDefined();
      expect(result.transactions[2]?.date).toBeDefined();
    });

    it('should handle comma-formatted amounts', async () => {
      const csvContent = `Date,Description,Amount
01/15/2024,Large Payment,"1,234.56"
01/16/2024,Small Payment,12.34`;

      const result = await parseCSVStatement(csvContent, { hasHeader: true });

      expect(result.transactions[0]?.amount).toBe(123456); // 1,234.56 in cents
      expect(result.transactions[1]?.amount).toBe(1234); // 12.34 in cents
    });

    it('should reject CSV without required columns', async () => {
      const csvContent = `Date,Something
01/15/2024,Test`;

      await expect(
        parseCSVStatement(csvContent, { hasHeader: true })
      ).rejects.toThrow();
    });

    it('should reject empty CSV', async () => {
      const csvContent = ``;

      await expect(
        parseCSVStatement(csvContent, { hasHeader: true })
      ).rejects.toThrow();
    });

    it('should detect opening and closing balance', async () => {
      const csvContent = `Date,Description,Amount,Balance
01/15/2024,Transaction 1,10.00,1010.00
01/16/2024,Transaction 2,-5.00,1005.00`;

      const result = await parseCSVStatement(csvContent, { hasHeader: true });

      expect(result.openingBalance).toBe(100000); // 1000.00 in cents
      expect(result.closingBalance).toBe(100500); // 1005.00 in cents
    });

    it('should detect statement period from transactions', async () => {
      const csvContent = `Date,Description,Amount
01/01/2024,First,10.00
01/31/2024,Last,20.00`;

      const result = await parseCSVStatement(csvContent, { hasHeader: true });

      const startDate = new Date(result.statementPeriod.startDate);
      const endDate = new Date(result.statementPeriod.endDate);

      expect(startDate.getMonth()).toBe(0); // January
      expect(startDate.getDate()).toBe(1);
      expect(endDate.getDate()).toBe(31);
    });

    it('should assign unique IDs to transactions', async () => {
      const csvContent = `Date,Description,Amount
01/15/2024,Test 1,10.00
01/16/2024,Test 2,20.00`;

      const result = await parseCSVStatement(csvContent, { hasHeader: true });

      const ids = result.transactions.map((t) => t.id);
      expect(ids[0]).toBeTruthy();
      expect(ids[1]).toBeTruthy();
      expect(ids[0]).not.toBe(ids[1]);
    });
  });

  describe('validateStatement', () => {
    it('should validate a valid statement', () => {
      const statement = {
        statementPeriod: {
          startDate: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
          endDate: Date.now(),
        },
        transactions: [
          {
            id: '1',
            date: Date.now(),
            description: 'Test',
            amount: 1000,
            matched: false,
          },
        ],
        format: 'csv' as const,
      };

      const result = validateStatement(statement);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject statement with no transactions', () => {
      const statement = {
        statementPeriod: {
          startDate: Date.now() - 30 * 24 * 60 * 60 * 1000,
          endDate: Date.now(),
        },
        transactions: [],
        format: 'csv' as const,
      };

      const result = validateStatement(statement);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject statement with invalid date range', () => {
      const statement = {
        statementPeriod: {
          startDate: Date.now(),
          endDate: Date.now() - 30 * 24 * 60 * 60 * 1000, // End before start
        },
        transactions: [
          {
            id: '1',
            date: Date.now(),
            description: 'Test',
            amount: 1000,
            matched: false,
          },
        ],
        format: 'csv' as const,
      };

      const result = validateStatement(statement);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject statement with future dates', () => {
      const futureDate = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days in future

      const statement = {
        statementPeriod: {
          startDate: Date.now(),
          endDate: futureDate,
        },
        transactions: [
          {
            id: '1',
            date: Date.now(),
            description: 'Test',
            amount: 1000,
            matched: false,
          },
        ],
        format: 'csv' as const,
      };

      const result = validateStatement(statement);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('future'))).toBe(true);
    });

    it('should reject very old statements', () => {
      const veryOld = Date.now() - 11 * 365 * 24 * 60 * 60 * 1000; // 11 years ago

      const statement = {
        statementPeriod: {
          startDate: veryOld,
          endDate: veryOld + 30 * 24 * 60 * 60 * 1000,
        },
        transactions: [
          {
            id: '1',
            date: veryOld,
            description: 'Test',
            amount: 1000,
            matched: false,
          },
        ],
        format: 'csv' as const,
      };

      const result = validateStatement(statement);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('10 years'))).toBe(true);
    });
  });
});
