/**
 * CSV Parser Tests
 *
 * Tests for bank statement CSV parsing functionality.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { parseCSVStatement, validateParsedStatement } from './csvParser';

// Mock File.prototype.text() for test environment
beforeAll(() => {
  if (!File.prototype.text) {
    File.prototype.text = async function() {
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(this);
      });
    };
  }
});

describe('CSV Parser', () => {
  describe('parseCSVStatement', () => {
    it('should parse a valid CSV with headers', async () => {
      const csvContent = `Date,Description,Amount,Balance
01/15/2024,Coffee Shop Purchase,-12.50,1000.00
01/16/2024,Salary Deposit,2500.00,2500.00
01/17/2024,Rent Payment,-1200.00,1300.00`;

      const file = new File([csvContent], 'statement.csv', { type: 'text/csv' });

      const statement = await parseCSVStatement(file);

      expect(statement).toBeDefined();
      expect(statement.format).toBe('csv');
      expect(statement.transactions).toHaveLength(3);
      expect(statement.transactions[0]!.description).toBe('Coffee Shop Purchase');
      expect(statement.transactions[0]!.amount).toBe(-1250); // -12.50 in cents
    });

    it('should parse CSV with separate debit/credit columns', async () => {
      const csvContent = `Date,Description,Debit,Credit,Balance
01/15/2024,Coffee Shop,12.50,,987.50
01/16/2024,Salary,,2500.00,3487.50`;

      const file = new File([csvContent], 'statement.csv', { type: 'text/csv' });

      const statement = await parseCSVStatement(file);

      expect(statement.transactions).toHaveLength(2);
      expect(statement.transactions[0]!.amount).toBe(-1250); // Debit is negative
      expect(statement.transactions[1]!.amount).toBe(250000); // Credit is positive
    });

    it('should handle different date formats', async () => {
      const csvContent = `Date,Description,Amount
2024-01-15,Purchase,-12.50
2024-01-16,Deposit,100.00`;

      const file = new File([csvContent], 'statement.csv', { type: 'text/csv' });

      const statement = await parseCSVStatement(file);

      expect(statement.transactions).toHaveLength(2);
      const firstDate = new Date(statement.transactions[0]!.date);
      expect(firstDate.getMonth()).toBe(0); // January
      expect(firstDate.getDate()).toBe(15);
    });

    it('should extract opening and closing balances', async () => {
      const csvContent = `Date,Description,Amount,Balance
01/15/2024,Starting Balance,0.00,1000.00
01/16/2024,Purchase,-50.00,950.00
01/17/2024,Deposit,100.00,1050.00`;

      const file = new File([csvContent], 'statement.csv', { type: 'text/csv' });

      const statement = await parseCSVStatement(file);

      // Opening balance is first transaction's balance minus its amount
      expect(statement.openingBalance).toBeDefined();
      // Closing balance is last transaction's balance
      expect(statement.closingBalance).toBe(105000); // 1050.00 in cents
    });

    it('should sort transactions by date', async () => {
      const csvContent = `Date,Description,Amount
01/20/2024,Transaction 3,-10.00
01/15/2024,Transaction 1,-5.00
01/18/2024,Transaction 2,-7.50`;

      const file = new File([csvContent], 'statement.csv', { type: 'text/csv' });

      const statement = await parseCSVStatement(file);

      expect(statement.transactions[0]!.description).toBe('Transaction 1');
      expect(statement.transactions[1]!.description).toBe('Transaction 2');
      expect(statement.transactions[2]!.description).toBe('Transaction 3');
    });

    it('should handle currency symbols and commas in amounts', async () => {
      const csvContent = `Date,Description,Amount
01/15/2024,Large Purchase,"$1,250.00"
01/16/2024,Small Purchase,€12.50`;

      const file = new File([csvContent], 'statement.csv', { type: 'text/csv' });

      const statement = await parseCSVStatement(file);

      expect(statement.transactions[0]!.amount).toBe(125000); // 1250.00 in cents
      expect(statement.transactions[1]!.amount).toBe(1250); // 12.50 in cents
    });

    it('should throw error for empty CSV', async () => {
      const file = new File([''], 'empty.csv', { type: 'text/csv' });

      await expect(parseCSVStatement(file)).rejects.toThrow();
    });

    it('should throw error for CSV without required columns', async () => {
      const csvContent = `OnlyOneColumn
Value1
Value2`;

      const file = new File([csvContent], 'invalid.csv', { type: 'text/csv' });

      await expect(parseCSVStatement(file)).rejects.toThrow();
    });
  });

  describe('validateParsedStatement', () => {
    it('should validate a correct statement', () => {
      const statement = {
        statementPeriod: {
          startDate: Date.now() - 30 * 24 * 60 * 60 * 1000,
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

      expect(validateParsedStatement(statement)).toBe(true);
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

      expect(validateParsedStatement(statement)).toBe(false);
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

      expect(validateParsedStatement(statement)).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle transactions with parentheses for negative amounts', async () => {
      const csvContent = `Date,Description,Amount
01/15/2024,Refund,(25.00)`;

      const file = new File([csvContent], 'statement.csv', { type: 'text/csv' });

      const statement = await parseCSVStatement(file);

      expect(statement.transactions[0]!.amount).toBe(-2500); // (25.00) = -25.00
    });

    it('should handle very large transaction counts efficiently', async () => {
      // Generate CSV with 1000 transactions
      let csvContent = 'Date,Description,Amount\n';
      for (let i = 0; i < 1000; i++) {
        csvContent += `01/${(i % 28) + 1}/2024,Transaction ${i},${i * 10}.00\n`;
      }

      const file = new File([csvContent], 'large-statement.csv', { type: 'text/csv' });

      const startTime = Date.now();
      const statement = await parseCSVStatement(file);
      const endTime = Date.now();

      expect(statement.transactions).toHaveLength(1000);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete in under 5 seconds
    });
  });
});
