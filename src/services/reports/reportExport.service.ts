/**
 * Report Export Service
 *
 * Per I6: Scheduled Report Delivery
 * Generates PDF and Excel exports for scheduled report delivery.
 *
 * Dependencies:
 * - pdfmake (PDF generation)
 * - papaparse (CSV generation, can be opened as Excel)
 */

import type {
  BalanceSheetData,
  ProfitLossReport,
  PDFExportOptions,
  ExportResult,
} from '../../types/reports.types';
import type { SchedulableReportType } from '../../types/scheduledReports.types';
import { generateBalanceSheetPDF, exportProfitLossToPDF } from './pdfExport';
import { logger } from '../../utils/logger';
import { AppError, ErrorCode } from '../../utils/errors';
import Papa from 'papaparse';

const exportLogger = logger.child('ReportExport');

// =============================================================================
// Report Export Interface
// =============================================================================

/**
 * Export any report type to specified format
 */
export async function exportReport(
  reportType: SchedulableReportType,
  reportData: unknown,
  format: 'pdf' | 'csv',
  options: Partial<PDFExportOptions> = {}
): Promise<ExportResult> {
  try {
    exportLogger.info('Exporting report', { reportType, format });

    switch (reportType) {
      case 'balance-sheet':
        return await exportBalanceSheet(reportData as BalanceSheetData, format, options);
      case 'profit-loss':
        return await exportProfitLoss(reportData as ProfitLossReport, format, options);
      case 'cash-flow':
      case 'ar-aging':
      case 'ap-aging':
      case 'custom':
        // For MVP, these will use CSV export
        if (format === 'pdf') {
          return {
            success: false,
            format: 'pdf',
            error: `PDF export not yet implemented for ${reportType}`,
          };
        }
        return await exportGenericReport(reportData, reportType);
      default:
        return {
          success: false,
          format,
          error: `Unknown report type: ${reportType}`,
        };
    }
  } catch (error) {
    exportLogger.error('Report export failed', { error, reportType, format });
    return {
      success: false,
      format,
      error: error instanceof Error ? error.message : 'Export failed',
    };
  }
}

// =============================================================================
// Balance Sheet Export
// =============================================================================

/**
 * Export Balance Sheet to PDF or CSV
 */
async function exportBalanceSheet(
  data: BalanceSheetData,
  format: 'pdf' | 'csv',
  options: Partial<PDFExportOptions>
): Promise<ExportResult> {
  if (format === 'pdf') {
    const blob = await generateBalanceSheetPDF(data, options.title || 'Company');
    return {
      success: true,
      format: 'pdf',
      blob,
      filename: `balance-sheet-${new Date(data.asOfDate).toISOString().split('T')[0]}.pdf`,
    };
  }

  // CSV export
  const csvData = [
    ['Balance Sheet'],
    [`As of ${new Date(data.asOfDate).toLocaleDateString()}`],
    [''],
    ['ASSETS'],
    ...data.assets.lines.map((line) => [
      line.accountName,
      line.accountNumber || '',
      line.balance.toFixed(2),
    ]),
    ['Total Assets', '', data.totalAssets.toFixed(2)],
    [''],
    ['LIABILITIES'],
    ...data.liabilities.lines.map((line) => [
      line.accountName,
      line.accountNumber || '',
      line.balance.toFixed(2),
    ]),
    ['Total Liabilities', '', data.liabilities.total.toFixed(2)],
    [''],
    ['EQUITY'],
    ...data.equity.lines.map((line) => [
      line.accountName,
      line.accountNumber || '',
      line.balance.toFixed(2),
    ]),
    ['Total Equity', '', data.equity.total.toFixed(2)],
    [''],
    ['Total Liabilities and Equity', '', data.totalLiabilitiesAndEquity.toFixed(2)],
  ];

  const csv = Papa.unparse(csvData);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });

  return {
    success: true,
    format: 'csv',
    blob,
    filename: `balance-sheet-${new Date(data.asOfDate).toISOString().split('T')[0]}.csv`,
  };
}

// =============================================================================
// Profit & Loss Export
// =============================================================================

/**
 * Export Profit & Loss to PDF or CSV
 */
async function exportProfitLoss(
  report: ProfitLossReport,
  format: 'pdf' | 'csv',
  options: Partial<PDFExportOptions>
): Promise<ExportResult> {
  if (format === 'pdf') {
    return await exportProfitLossToPDF(report, options);
  }

  // CSV export
  const csvData = [
    ['Profit & Loss Statement'],
    [report.companyName],
    [
      `${new Date(report.dateRange.startDate).toLocaleDateString()} to ${new Date(report.dateRange.endDate).toLocaleDateString()}`,
    ],
    [''],
    ['REVENUE'],
    ...report.revenue.lineItems.map((item) => [
      item.accountName,
      item.accountNumber || '',
      item.amount.toFixed(2),
    ]),
    ['Total Revenue', '', report.revenue.subtotal.toFixed(2)],
    [''],
    ['COST OF GOODS SOLD'],
    ...report.costOfGoodsSold.lineItems.map((item) => [
      item.accountName,
      item.accountNumber || '',
      item.amount.toFixed(2),
    ]),
    ['Total COGS', '', report.costOfGoodsSold.subtotal.toFixed(2)],
    [''],
    ['Gross Profit', '', report.grossProfit.amount.toFixed(2)],
    [''],
    ['OPERATING EXPENSES'],
    ...report.operatingExpenses.lineItems.map((item) => [
      item.accountName,
      item.accountNumber || '',
      item.amount.toFixed(2),
    ]),
    ['Total Operating Expenses', '', report.operatingExpenses.subtotal.toFixed(2)],
    [''],
    ['Operating Income', '', report.operatingIncome.amount.toFixed(2)],
    [''],
    ['NET INCOME', '', report.netIncome.amount.toFixed(2)],
  ];

  const csv = Papa.unparse(csvData);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });

  return {
    success: true,
    format: 'csv',
    blob,
    filename: `profit-loss-${new Date(report.dateRange.startDate).toISOString().split('T')[0]}-to-${new Date(report.dateRange.endDate).toISOString().split('T')[0]}.csv`,
  };
}

// =============================================================================
// Generic Report Export (for AR Aging, AP Aging, etc.)
// =============================================================================

/**
 * Export generic report data to CSV
 */
async function exportGenericReport(
  data: unknown,
  reportType: SchedulableReportType
): Promise<ExportResult> {
  try {
    // Convert data to CSV-friendly format
    let csvData: unknown[][] = [];

    if (Array.isArray(data)) {
      // If data is an array of objects, use keys as headers
      if (data.length > 0 && typeof data[0] === 'object') {
        const headers = Object.keys(data[0] as Record<string, unknown>);
        csvData = [
          headers,
          ...data.map((row) => headers.map((key) => (row as Record<string, unknown>)[key])),
        ];
      } else {
        csvData = data.map((item) => [item]);
      }
    } else if (typeof data === 'object' && data !== null) {
      // If data is an object, convert to key-value pairs
      csvData = Object.entries(data).map(([key, value]) => [key, value]);
    } else {
      throw new Error('Unsupported data format for CSV export');
    }

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });

    return {
      success: true,
      format: 'csv',
      blob,
      filename: `${reportType}-${new Date().toISOString().split('T')[0]}.csv`,
    };
  } catch (error) {
    exportLogger.error('Generic report export failed', { error, reportType });
    return {
      success: false,
      format: 'csv',
      error: error instanceof Error ? error.message : 'Export failed',
    };
  }
}

// =============================================================================
// Export Result to Buffer (for email attachments)
// =============================================================================

/**
 * Convert export result blob to buffer for email attachments
 */
export async function exportResultToBuffer(result: ExportResult): Promise<Buffer> {
  if (!result.success || !result.blob) {
    throw new AppError(
      ErrorCode.UNKNOWN_ERROR,
      'Export failed or no blob available',
      { result }
    );
  }

  // Convert Blob to Buffer
  const arrayBuffer = await result.blob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Get MIME type for export format
 */
export function getExportMimeType(format: 'pdf' | 'csv'): string {
  switch (format) {
    case 'pdf':
      return 'application/pdf';
    case 'csv':
      return 'text/csv';
    default:
      return 'application/octet-stream';
  }
}
