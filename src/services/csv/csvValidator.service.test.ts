/**
 * Tests for CSV Validator Service
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CSVValidatorService } from './csvValidator.service';

describe('CSVValidatorService', () => {
  let service: CSVValidatorService;

  beforeEach(() => {
    service = new CSVValidatorService();
  });

  describe('validateFile', () => {
    it('should accept valid CSV files', () => {
      const file = new File(['test'], 'test.csv', { type: 'text/csv' });
      const result = service.validateFile(file);
      expect(result.valid).toBe(true);
    });

    it('should reject non-CSV files', () => {
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });
      const result = service.validateFile(file);
      expect(result.valid).toBe(false);
      expect((result as any).error).toContain('Invalid file type');
    });

    it('should reject files larger than 10MB', () => {
      // Create a file larger than 10MB
      const largeSize = 11 * 1024 * 1024;
      const file = new File([new ArrayBuffer(largeSize)], 'large.csv', { type: 'text/csv' });
      const result = service.validateFile(file);
      expect(result.valid).toBe(false);
      expect((result as any).error).toContain('File too large');
    });

    it('should accept files at exactly 10MB', () => {
      const size = 10 * 1024 * 1024;
      const file = new File([new ArrayBuffer(size)], 'exact.csv', { type: 'text/csv' });
      const result = service.validateFile(file);
      expect(result.valid).toBe(true);
    });
  });

  describe('validateRows', () => {
    it('should validate transaction rows correctly', () => {
      const rows = [
        ['2026-01-20', 'Test transaction', '100.00', 'Cash', 'Income', 'Test notes'],
      ];
      const columnMap = new Map([
        ['Date', 'Date'],
        ['Description', 'Description'],
        ['Amount', 'Amount'],
        ['Account', 'Account'],
        ['Category', 'Category'],
        ['Notes', 'Notes'],
      ]);

      const result = service.validateRows(rows, columnMap, 'transactions');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.validRows).toBe(1);
    });

    it('should detect missing required fields', () => {
      const rows = [
        ['', 'Test transaction', '100.00', '', '', ''], // Missing Date and Account
      ];
      const columnMap = new Map([
        ['Date', 'Date'],
        ['Description', 'Description'],
        ['Amount', 'Amount'],
        ['Account', 'Account'],
        ['Category', 'Category'],
        ['Notes', 'Notes'],
      ]);

      const result = service.validateRows(rows, columnMap, 'transactions');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((err) => err.field === 'Date')).toBe(true);
      expect(result.errors.some((err) => err.field === 'Account')).toBe(true);
    });

    it('should validate date formats', () => {
      const rows = [
        ['invalid-date', 'Test', '100.00', 'Cash', '', ''],
      ];
      const columnMap = new Map([
        ['Date', 'Date'],
        ['Description', 'Description'],
        ['Amount', 'Amount'],
        ['Account', 'Account'],
      ]);

      const result = service.validateRows(rows, columnMap, 'transactions');
      expect(result.valid).toBe(false);
      expect(result.errors.some((err) => err.field === 'Date')).toBe(true);
    });

    it('should accept ISO date format (YYYY-MM-DD)', () => {
      const headers = ['Date', 'Description', 'Amount', 'Account', 'Category', 'Notes'];
      const rows = [
        ['2026-01-20', 'Test', '100.00', 'Cash', '', ''],
      ];
      const columnMap = new Map([
        ['Date', 'Date'],
        ['Amount', 'Amount'],
        ['Account', 'Account'],
      ]);

      const result = service.validateRows(rows, columnMap, 'transactions', headers);
      expect(result.valid).toBe(true);
    });

    it('should accept US date format (MM/DD/YYYY)', () => {
      const headers = ['Date', 'Description', 'Amount', 'Account', 'Category', 'Notes'];
      const rows = [
        ['01/20/2026', 'Test', '100.00', 'Cash', '', ''],
      ];
      const columnMap = new Map([
        ['Date', 'Date'],
        ['Amount', 'Amount'],
        ['Account', 'Account'],
      ]);

      const result = service.validateRows(rows, columnMap, 'transactions', headers);
      expect(result.valid).toBe(true);
    });

    it('should validate number fields', () => {
      const rows = [
        ['2026-01-20', 'Test', 'not-a-number', 'Cash', '', ''],
      ];
      const columnMap = new Map([
        ['Date', 'Date'],
        ['Amount', 'Amount'],
        ['Account', 'Account'],
      ]);

      const result = service.validateRows(rows, columnMap, 'transactions');
      expect(result.valid).toBe(false);
      expect(result.errors.some((err) => err.field === 'Amount')).toBe(true);
    });

    it('should accept negative numbers', () => {
      const headers = ['Date', 'Description', 'Amount', 'Account', 'Category', 'Notes'];
      const rows = [
        ['2026-01-20', 'Test', '-50.00', 'Cash', '', ''],
      ];
      const columnMap = new Map([
        ['Date', 'Date'],
        ['Amount', 'Amount'],
        ['Account', 'Account'],
      ]);

      const result = service.validateRows(rows, columnMap, 'transactions', headers);
      expect(result.valid).toBe(true);
    });

    it('should validate email fields', () => {
      const rows = [
        ['Test Customer', 'invalid-email', '555-1234', 'Customer', '', '', '', '', '', ''],
      ];
      const columnMap = new Map([
        ['Name', 'Name'],
        ['Email', 'Email'],
        ['Phone', 'Phone'],
        ['Type', 'Type'],
      ]);

      const result = service.validateRows(rows, columnMap, 'contacts');
      expect(result.valid).toBe(false);
      expect(result.errors.some((err) => err.field === 'Email')).toBe(true);
    });

    it('should accept valid email addresses', () => {
      const headers = ['Name', 'Email', 'Phone', 'Type', 'Address', 'City', 'State', 'Postal Code', 'Country', 'Notes'];
      const rows = [
        ['Test Customer', 'test@example.com', '555-1234', 'Customer', '', '', '', '', '', ''],
      ];
      const columnMap = new Map([
        ['Name', 'Name'],
        ['Email', 'Email'],
        ['Type', 'Type'],
      ]);

      const result = service.validateRows(rows, columnMap, 'contacts', headers);
      expect(result.valid).toBe(true);
    });

    it('should validate enum fields', () => {
      const rows = [
        ['INV-001', 'Customer', '2026-01-20', '1000.00', 'Invalid Status', '2026-02-20', ''],
      ];
      const columnMap = new Map([
        ['Invoice Number', 'Invoice Number'],
        ['Customer', 'Customer'],
        ['Date', 'Date'],
        ['Amount', 'Amount'],
        ['Status', 'Status'],
        ['Due Date', 'Due Date'],
      ]);

      const result = service.validateRows(rows, columnMap, 'invoices');
      expect(result.valid).toBe(false);
      expect(result.errors.some((err) => err.field === 'Status')).toBe(true);
    });

    it('should accept valid enum values', () => {
      const rows = [
        ['INV-001', 'Customer', '2026-01-20', '1000.00', 'Paid', '2026-02-20', ''],
      ];
      const columnMap = new Map([
        ['Invoice Number', 'Invoice Number'],
        ['Customer', 'Customer'],
        ['Date', 'Date'],
        ['Amount', 'Amount'],
        ['Status', 'Status'],
        ['Due Date', 'Due Date'],
      ]);

      const result = service.validateRows(rows, columnMap, 'invoices');
      expect(result.valid).toBe(true);
    });

    it('should reject files with more than 10,000 rows', () => {
      const rows = Array(10001).fill(['2026-01-20', 'Test', '100.00', 'Cash', '', '']);
      const columnMap = new Map([
        ['Date', 'Date'],
        ['Amount', 'Amount'],
        ['Account', 'Account'],
      ]);

      const result = service.validateRows(rows, columnMap, 'transactions');
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('Too many rows');
    });
  });

  describe('Validation rules by entity type', () => {
    it('should have correct required fields for transactions', () => {
      // Date, Amount, Account are required
      const rows = [
        ['', '', '', '', '', ''], // All empty
      ];
      const columnMap = new Map([
        ['Date', 'Date'],
        ['Amount', 'Amount'],
        ['Account', 'Account'],
      ]);

      const result = service.validateRows(rows, columnMap, 'transactions');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });

    it('should have correct required fields for invoices', () => {
      // Invoice Number, Customer, Date, Amount, Status, Due Date are required
      const rows = [
        ['', '', '', '', '', '', ''],
      ];
      const columnMap = new Map([
        ['Invoice Number', 'Invoice Number'],
        ['Customer', 'Customer'],
        ['Date', 'Date'],
        ['Amount', 'Amount'],
        ['Status', 'Status'],
        ['Due Date', 'Due Date'],
      ]);

      const result = service.validateRows(rows, columnMap, 'invoices');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(6);
    });

    it('should have correct required fields for contacts', () => {
      // Name and Type are required
      const rows = [
        ['', '', '', '', '', '', '', '', '', ''],
      ];
      const columnMap = new Map([
        ['Name', 'Name'],
        ['Type', 'Type'],
      ]);

      const result = service.validateRows(rows, columnMap, 'contacts');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });

    it('should have correct required fields for products', () => {
      // Name, Price, Type are required
      const rows = [
        ['', '', '', '', '', ''],
      ];
      const columnMap = new Map([
        ['Name', 'Name'],
        ['Price', 'Price'],
        ['Type', 'Type'],
      ]);

      const result = service.validateRows(rows, columnMap, 'products');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });
  });
});
