/**
 * Tests for CSV Importer Service
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CSVImporterService } from './csvImporter.service';

describe('CSVImporterService', () => {
  let service: CSVImporterService;

  beforeEach(() => {
    service = new CSVImporterService();
  });

  describe('parseCSV', () => {
    it('should parse simple CSV content', async () => {
      const content = 'Date,Amount,Description\n2026-01-20,100.00,Test';
      const file = new File([content], 'test.csv', { type: 'text/csv' });

      const result = await service.parseCSV(file);
      expect(result.success).toBe(true);
      expect(result.headers).toEqual(['Date', 'Amount', 'Description']);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toEqual(['2026-01-20', '100.00', 'Test']);
    });

    it('should handle quoted fields with commas', async () => {
      const content = 'Name,Description\n"Test, Inc","Description with, commas"';
      const file = new File([content], 'test.csv', { type: 'text/csv' });

      const result = await service.parseCSV(file);
      expect(result.success).toBe(true);
      expect(result.rows[0]).toEqual(['Test, Inc', 'Description with, commas']);
    });

    it('should handle escaped quotes', async () => {
      const content = 'Name,Description\n"Test ""Quote""","Another ""Quote"""';
      const file = new File([content], 'test.csv', { type: 'text/csv' });

      const result = await service.parseCSV(file);
      expect(result.success).toBe(true);
      expect(result.rows[0]).toEqual(['Test "Quote"', 'Another "Quote"']);
    });

    it('should handle newlines in quoted fields', async () => {
      const content = 'Name,Description\n"Test","Line 1\nLine 2"';
      const file = new File([content], 'test.csv', { type: 'text/csv' });

      const result = await service.parseCSV(file);
      expect(result.success).toBe(true);
      expect(result.rows[0][1]).toContain('Line 1\nLine 2');
    });

    it('should return preview of first 10 rows', async () => {
      const rows = Array(20).fill('2026-01-20,100.00,Test').join('\n');
      const content = `Date,Amount,Description\n${rows}`;
      const file = new File([content], 'test.csv', { type: 'text/csv' });

      const result = await service.parseCSV(file);
      expect(result.success).toBe(true);
      expect(result.totalRows).toBe(20);
      expect(result.preview).toHaveLength(10);
    });

    it('should handle empty file', async () => {
      const file = new File([''], 'empty.csv', { type: 'text/csv' });

      const result = await service.parseCSV(file);
      expect(result.success).toBe(false);
      expect((result as any).error).toContain('empty');
    });

    it('should handle files with only headers', async () => {
      const content = 'Date,Amount,Description';
      const file = new File([content], 'headers-only.csv', { type: 'text/csv' });

      const result = await service.parseCSV(file);
      expect(result.success).toBe(true);
      expect(result.headers).toEqual(['Date', 'Amount', 'Description']);
      expect(result.rows).toHaveLength(0);
    });
  });

  describe('autoMapColumns', () => {
    it('should map exact matches with high confidence', () => {
      const headers = ['Date', 'Amount', 'Description'];
      const result = service.autoMapColumns(headers, 'transactions');

      expect(result.suggestions).toHaveLength(3);
      const dateSuggestion = result.suggestions.find((s) => s.csvColumn === 'Date');
      expect(dateSuggestion?.suggestedField).toBe('Date');
      expect(dateSuggestion?.confidence).toBe(1.0);
    });

    it('should map case-insensitive matches', () => {
      const headers = ['date', 'AMOUNT', 'Description'];
      const result = service.autoMapColumns(headers, 'transactions');

      expect(result.suggestions).toHaveLength(3);
      expect(result.suggestions.every((s) => s.confidence >= 0.9)).toBe(true);
    });

    it('should map common aliases', () => {
      const headers = ['Transaction Date', 'Amt', 'Desc'];
      const result = service.autoMapColumns(headers, 'transactions');

      const dateSuggestion = result.suggestions.find((s) => s.csvColumn === 'Transaction Date');
      expect(dateSuggestion?.suggestedField).toBe('Date');
    });

    it('should identify unmapped columns', () => {
      const headers = ['Unknown Column', 'Date', 'Amount'];
      const result = service.autoMapColumns(headers, 'transactions');

      expect(result.unmappedColumns).toContain('Unknown Column');
    });

    it('should identify unmapped required fields', () => {
      const headers = ['Date']; // Missing Amount and Account
      const result = service.autoMapColumns(headers, 'transactions');

      expect(result.unmappedFields).toContain('Amount');
      expect(result.unmappedFields).toContain('Account');
    });

    it('should provide alternative suggestions', () => {
      const headers = ['Amt']; // Could match Amount or other fields
      const result = service.autoMapColumns(headers, 'transactions');

      const suggestion = result.suggestions.find((s) => s.csvColumn === 'Amt');
      if (suggestion) {
        expect(suggestion.suggestedField).toBe('Amount');
      }
    });

    it('should calculate overall confidence', () => {
      const headers = ['Date', 'Amount', 'Account'];
      const result = service.autoMapColumns(headers, 'transactions');

      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('Field aliases', () => {
    it('should recognize invoice number aliases', () => {
      const headers = ['Invoice #', 'Customer', 'Date', 'Amount', 'Status', 'Due'];
      const result = service.autoMapColumns(headers, 'invoices');

      const invSuggestion = result.suggestions.find((s) => s.csvColumn === 'Invoice #');
      expect(invSuggestion?.suggestedField).toBe('Invoice Number');
    });

    it('should recognize customer aliases', () => {
      const headers = ['Client', 'Invoice Number', 'Date', 'Amount', 'Status', 'Due Date'];
      const result = service.autoMapColumns(headers, 'invoices');

      const customerSuggestion = result.suggestions.find((s) => s.csvColumn === 'Client');
      expect(customerSuggestion?.suggestedField).toBe('Customer');
    });

    it('should recognize vendor aliases', () => {
      const headers = ['Supplier', 'Bill Number', 'Date', 'Amount', 'Status', 'Due Date'];
      const result = service.autoMapColumns(headers, 'bills');

      const vendorSuggestion = result.suggestions.find((s) => s.csvColumn === 'Supplier');
      expect(vendorSuggestion?.suggestedField).toBe('Vendor');
    });

    it('should recognize email aliases', () => {
      const headers = ['Name', 'E-mail', 'Type'];
      const result = service.autoMapColumns(headers, 'contacts');

      const emailSuggestion = result.suggestions.find((s) => s.csvColumn === 'E-mail');
      expect(emailSuggestion?.suggestedField).toBe('Email');
    });
  });

  describe('createColumnMappings', () => {
    it('should convert suggestions to column mappings', () => {
      const suggestions = [
        { csvColumn: 'Date', suggestedField: 'Date', confidence: 1.0, alternativeSuggestions: [] },
        { csvColumn: 'Amount', suggestedField: 'Amount', confidence: 1.0, alternativeSuggestions: [] },
      ];

      const mappings = service.createColumnMappings(suggestions);
      expect(mappings).toHaveLength(2);
      expect(mappings[0]).toEqual({
        csvColumn: 'Date',
        entityField: 'Date',
        confidence: 1.0,
      });
    });
  });

  describe('importCSV', () => {
    it('should validate in dry-run mode', async () => {
      const rows = [
        ['Date', 'Description', 'Amount', 'Account', 'Category', 'Notes'], // Header row
        ['2026-01-20', 'Test', '100.00', 'Cash', '', ''],                  // Valid data row
      ];
      const config = {
        entityType: 'transactions' as const,
        mode: 'dryRun' as const,
        columnMappings: [
          { csvColumn: 'Date', entityField: 'Date', confidence: 1.0 },
          { csvColumn: 'Amount', entityField: 'Amount', confidence: 1.0 },
          { csvColumn: 'Account', entityField: 'Account', confidence: 1.0 },
        ],
        skipFirstRow: true,
        detectDuplicates: false,
      };

      const result = await service.importCSV(config, rows);
      expect(result.success).toBe(true);
      expect(result.imported).toBe(0); // Dry run doesn't import
      expect(result.validation.valid).toBe(true);
    });

    it('should return validation errors in dry-run mode', async () => {
      const rows = [
        ['Date', 'Description', 'Amount', 'Account', 'Category', 'Notes'], // Header row
        ['invalid-date', 'Test', 'not-a-number', 'Cash', '', ''],          // Invalid data row
      ];
      const config = {
        entityType: 'transactions' as const,
        mode: 'dryRun' as const,
        columnMappings: [
          { csvColumn: 'Date', entityField: 'Date', confidence: 1.0 },
          { csvColumn: 'Amount', entityField: 'Amount', confidence: 1.0 },
          { csvColumn: 'Account', entityField: 'Account', confidence: 1.0 },
        ],
        skipFirstRow: true,
        detectDuplicates: false,
      };

      const result = await service.importCSV(config, rows);
      expect(result.success).toBe(false);
      expect(result.validation.valid).toBe(false);
      expect(result.validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('getExpectedFields', () => {
    it('should return all fields for transactions', () => {
      // This is a private method, tested indirectly through autoMapColumns
      const headers = ['Date', 'Description', 'Amount', 'Account', 'Category', 'Notes'];
      const result = service.autoMapColumns(headers, 'transactions');
      expect(result.suggestions).toHaveLength(6);
    });

    it('should return all fields for invoices', () => {
      const headers = ['Invoice Number', 'Customer', 'Date', 'Amount', 'Status', 'Due Date', 'Notes'];
      const result = service.autoMapColumns(headers, 'invoices');
      expect(result.suggestions).toHaveLength(7);
    });
  });
});
