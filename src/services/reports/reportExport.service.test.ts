/**
 * Report Export Service Tests
 *
 * Per I6: Scheduled Report Delivery - Unit Tests for Export
 */

import { describe, it, expect } from 'vitest';
import { exportReport, exportResultToBuffer, getExportMimeType } from './reportExport.service';
import type { BalanceSheetData } from '../../types/reports.types';

describe('ReportExport Service', () => {
  describe('exportReport', () => {
    it('should export balance sheet to PDF', async () => {
      const mockData: Partial<BalanceSheetData> = {
        companyId: 'company-123',
        asOfDate: new Date('2026-01-18'),
        generatedAt: new Date(),
        assets: {
          title: 'Assets',
          plainEnglishTitle: 'What you own',
          description: 'Assets',
          lines: [
            {
              accountId: 'acc-1',
              accountName: 'Cash',
              balance: 10000,
              isSubAccount: false,
              level: 0,
            },
          ],
          total: 10000,
        },
        liabilities: {
          title: 'Liabilities',
          plainEnglishTitle: 'What you owe',
          description: 'Liabilities',
          lines: [],
          total: 0,
        },
        equity: {
          title: 'Equity',
          plainEnglishTitle: 'Your ownership',
          description: 'Equity',
          lines: [],
          total: 10000,
        },
        totalAssets: 10000,
        totalLiabilitiesAndEquity: 10000,
        isBalanced: true,
        balanceDifference: 0,
      };

      const result = await exportReport('balance-sheet', mockData, 'pdf');

      expect(result.success).toBe(true);
      expect(result.format).toBe('pdf');
      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.filename).toContain('balance-sheet');
      expect(result.filename).toContain('.pdf');
    });

    it('should export balance sheet to CSV', async () => {
      const mockData: Partial<BalanceSheetData> = {
        companyId: 'company-123',
        asOfDate: new Date('2026-01-18'),
        generatedAt: new Date(),
        assets: {
          title: 'Assets',
          plainEnglishTitle: 'What you own',
          description: 'Assets',
          lines: [
            {
              accountId: 'acc-1',
              accountName: 'Checking Account',
              accountNumber: '1000',
              balance: 5000,
              isSubAccount: false,
              level: 0,
            },
          ],
          total: 5000,
        },
        liabilities: {
          title: 'Liabilities',
          plainEnglishTitle: 'What you owe',
          description: 'Liabilities',
          lines: [],
          total: 0,
        },
        equity: {
          title: 'Equity',
          plainEnglishTitle: 'Your ownership',
          description: 'Equity',
          lines: [],
          total: 5000,
        },
        totalAssets: 5000,
        totalLiabilitiesAndEquity: 5000,
        isBalanced: true,
        balanceDifference: 0,
      };

      const result = await exportReport('balance-sheet', mockData, 'csv');

      expect(result.success).toBe(true);
      expect(result.format).toBe('csv');
      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.filename).toContain('.csv');
    });

    it('should handle unsupported report types gracefully', async () => {
      const result = await exportReport('custom' as any, {}, 'pdf');

      expect(result.success).toBe(false);
      expect((result as any).error).toBeDefined();
    });
  });

  describe('exportResultToBuffer', () => {
    it('should convert blob to buffer', async () => {
      const mockResult = {
        success: true,
        format: 'pdf' as const,
        blob: new Blob(['test content']),
        filename: 'test.pdf',
      };

      const buffer = await exportResultToBuffer(mockResult);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should throw error for failed export', async () => {
      const mockResult = {
        success: false,
        format: 'pdf' as const,
        error: 'Export failed',
      };

      await expect(exportResultToBuffer(mockResult)).rejects.toThrow();
    });
  });

  describe('getExportMimeType', () => {
    it('should return correct MIME type for PDF', () => {
      expect(getExportMimeType('pdf')).toBe('application/pdf');
    });

    it('should return correct MIME type for CSV', () => {
      expect(getExportMimeType('csv')).toBe('text/csv');
    });
  });
});
