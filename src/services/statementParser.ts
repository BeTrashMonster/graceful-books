/**
 * Bank Statement Parser Service
 *
 * Parses bank statements from CSV and PDF formats to extract transactions
 * for reconciliation. Supports multiple bank formats with auto-detection.
 *
 * Per ACCT-004: Statement upload (PDF/CSV)
 */

import Papa from 'papaparse';
import type {
  ParsedStatement,
  StatementTransaction,
  CSVParseOptions,
  CSVColumnMapping,
  PDFParseResult,
} from '../types/reconciliation.types';
import { parseMoney } from '../utils/money';
import { nanoid } from 'nanoid';
import { logger } from '../utils/logger';
import { AppError, ErrorCode } from '../utils/errors';

// =============================================================================
// CSV Parsing
// =============================================================================

/**
 * Common bank CSV column patterns
 */
const COMMON_PATTERNS = {
  date: ['date', 'transaction date', 'post date', 'posting date', 'trans date'],
  description: ['description', 'memo', 'transaction', 'details', 'narrative'],
  amount: ['amount', 'total', 'transaction amount'],
  debit: ['debit', 'withdrawal', 'withdrawals'],
  credit: ['credit', 'deposit', 'deposits'],
  balance: ['balance', 'running balance', 'current balance'],
  reference: ['reference', 'check number', 'ref', 'check #', 'cheque number'],
};

/**
 * Detect column mapping from CSV header row
 */
function detectColumnMapping(headers: string[]): CSVColumnMapping | null {
  const normalized = headers.map((h) => h.toLowerCase().trim());

  const findColumn = (patterns: string[]): number | undefined => {
    const index = normalized.findIndex((header) =>
      patterns.some((pattern) => header.includes(pattern))
    );
    return index >= 0 ? index : undefined;
  };

  const dateColumn = findColumn(COMMON_PATTERNS.date);
  const descriptionColumn = findColumn(COMMON_PATTERNS.description);
  const amountColumn = findColumn(COMMON_PATTERNS.amount);
  const debitColumn = findColumn(COMMON_PATTERNS.debit);
  const creditColumn = findColumn(COMMON_PATTERNS.credit);
  const balanceColumn = findColumn(COMMON_PATTERNS.balance);
  const referenceColumn = findColumn(COMMON_PATTERNS.reference);

  // Need at least date and description
  if (dateColumn === undefined || descriptionColumn === undefined) {
    return null;
  }

  // Need either amount column OR both debit/credit columns
  if (amountColumn === undefined && (debitColumn === undefined || creditColumn === undefined)) {
    return null;
  }

  return {
    dateColumn,
    descriptionColumn,
    amountColumn: amountColumn ?? 0,
    debitColumn,
    creditColumn,
    balanceColumn,
    referenceColumn,
  };
}

/**
 * Parse date from various formats
 */
function parseDate(dateStr: string): number | null {
  if (!dateStr) return null;

  // Try ISO format first
  let date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date.getTime();
  }

  // Try common US formats: MM/DD/YYYY, M/D/YYYY
  const usDateMatch = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (usDateMatch) {
    const [, month, day, year] = usDateMatch;
    date = new Date(Number(year), Number(month) - 1, Number(day));
    if (!isNaN(date.getTime())) {
      return date.getTime();
    }
  }

  // Try UK/European formats: DD/MM/YYYY
  const ukDateMatch = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (ukDateMatch) {
    const [, day, month, year] = ukDateMatch;
    date = new Date(Number(year), Number(month) - 1, Number(day));
    if (!isNaN(date.getTime())) {
      return date.getTime();
    }
  }

  logger.warn('Failed to parse date', { dateStr });
  return null;
}

/**
 * Parse CSV bank statement
 */
export async function parseCSVStatement(
  csvContent: string,
  options: Partial<CSVParseOptions> = {}
): Promise<ParsedStatement> {
  const {
    hasHeader = true,
    delimiter,
    skipRows = 0,
    columnMapping,
  } = options;

  return new Promise((resolve, reject) => {
    Papa.parse(csvContent, {
      delimiter,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const rows = results.data as string[][];

          if (rows.length < 2) {
            throw new AppError(
              ErrorCode.VALIDATION_ERROR,
              "The CSV file doesn't have enough data. Please check your file and try again."
            );
          }

          // Skip initial rows if needed
          const dataRows = skipRows > 0 ? rows.slice(skipRows) : rows;

          // Detect or use provided column mapping
          let mapping = columnMapping;
          let startRow = 0;

          if (hasHeader && !mapping) {
            const headers = dataRows[0];
            if (!headers) {
              throw new AppError(
                ErrorCode.VALIDATION_ERROR,
                "Couldn't read the header row. Please check your file format."
              );
            }
            mapping = detectColumnMapping(headers) ?? undefined;
            startRow = 1;

            if (!mapping) {
              throw new AppError(
                ErrorCode.VALIDATION_ERROR,
                "We couldn't identify the columns in your file. The file should have at least Date, Description, and Amount columns."
              );
            }
          } else if (!mapping) {
            throw new AppError(
              ErrorCode.VALIDATION_ERROR,
              'Column mapping is required when the file has no header row.'
            );
          }

          // Parse transactions
          const transactions: StatementTransaction[] = [];
          let minDate: number | null = null;
          let maxDate: number | null = null;

          for (let i = startRow; i < dataRows.length; i++) {
            const row = dataRows[i];
            if (!row || row.length === 0) continue;

            const dateStr = row[mapping.dateColumn as number];
            const description = row[mapping.descriptionColumn as number];

            if (!dateStr || !description) continue;

            const date = parseDate(dateStr);
            if (!date) continue;

            // Parse amount
            let amountCents = 0;

            if (mapping.amountColumn !== undefined) {
              const amountStr = row[mapping.amountColumn as number];
              const parsed = parseMoney(amountStr || '0');
              amountCents = parsed ?? 0;
            } else if (mapping.debitColumn !== undefined && mapping.creditColumn !== undefined) {
              const debitStr = row[mapping.debitColumn as number] || '0';
              const creditStr = row[mapping.creditColumn as number] || '0';
              const debit = parseMoney(debitStr) ?? 0;
              const credit = parseMoney(creditStr) ?? 0;
              // Debits are negative (money out), credits are positive (money in)
              amountCents = credit - debit;
            }

            // Parse balance if available
            let balanceCents: number | undefined;
            if (mapping.balanceColumn !== undefined) {
              const balanceStr = row[mapping.balanceColumn as number];
              const parsed = parseMoney(balanceStr || '0');
              balanceCents = parsed ?? undefined;
            }

            // Parse reference if available
            let reference: string | undefined;
            if (mapping.referenceColumn !== undefined) {
              reference = row[mapping.referenceColumn as number];
            }

            transactions.push({
              id: nanoid(),
              date,
              description: description.trim(),
              amount: amountCents,
              balance: balanceCents,
              reference,
              matched: false,
            });

            // Track date range
            if (minDate === null || date < minDate) minDate = date;
            if (maxDate === null || date > maxDate) maxDate = date;
          }

          if (transactions.length === 0) {
            throw new AppError(
              ErrorCode.VALIDATION_ERROR,
              "We couldn't find any valid transactions in your file. Please check the format and try again."
            );
          }

          // Sort by date (oldest first)
          transactions.sort((a, b) => a.date - b.date);

          // Try to detect opening/closing balance from balance column
          let openingBalance: number | undefined;
          let closingBalance: number | undefined;

          if (transactions[0]?.balance !== undefined) {
            openingBalance = transactions[0].balance - transactions[0].amount;
          }
          if (transactions[transactions.length - 1]?.balance !== undefined) {
            closingBalance = transactions[transactions.length - 1]!.balance;
          }

          const statement: ParsedStatement = {
            statementPeriod: {
              startDate: minDate || Date.now(),
              endDate: maxDate || Date.now(),
            },
            openingBalance,
            closingBalance,
            transactions,
            format: 'csv',
          };

          resolve(statement);
        } catch (error) {
          if (error instanceof AppError) {
            reject(error);
          } else {
            logger.error('CSV parsing error', error);
            reject(
              new AppError(
                ErrorCode.VALIDATION_ERROR,
                "Something went wrong while reading your file. Please check the format and try again."
              )
            );
          }
        }
      },
      error: (error) => {
        logger.error('Papa Parse error', error);
        reject(
          new AppError(
            ErrorCode.VALIDATION_ERROR,
            "We couldn't read your CSV file. Please make sure it's a valid CSV format."
          )
        );
      },
    });
  });
}

// =============================================================================
// PDF Parsing
// =============================================================================

/**
 * Extract text from PDF (simplified - in production would use pdf-parse)
 */
async function extractPDFText(_pdfBuffer: ArrayBuffer): Promise<PDFParseResult> {
  // Note: In a real implementation, we would use pdf-parse here
  // For now, returning a placeholder structure
  try {
    // This would use: const pdfParse = await import('pdf-parse');
    // const data = await pdfParse(Buffer.from(pdfBuffer));

    return {
      text: '',
      pages: 1,
      success: false,
      error: 'PDF parsing is not yet fully implemented. Please use CSV format for now.',
    };
  } catch (error) {
    logger.error('PDF extraction error', error);
    return {
      text: '',
      pages: 0,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown PDF error',
    };
  }
}

/**
 * Parse PDF bank statement
 * Note: This is a simplified implementation. Full PDF parsing would require
 * more sophisticated text extraction and pattern matching.
 */
export async function parsePDFStatement(
  pdfBuffer: ArrayBuffer
): Promise<ParsedStatement> {
  const result = await extractPDFText(pdfBuffer);

  if (!result.success) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      result.error || 'PDF parsing is not yet available. Please use CSV format for now.'
    );
  }

  // In a full implementation, we would:
  // 1. Use regex patterns to identify transaction lines
  // 2. Parse dates, descriptions, and amounts
  // 3. Detect statement period and balances
  // 4. Return structured ParsedStatement

  throw new AppError(
    ErrorCode.VALIDATION_ERROR,
    'PDF parsing is coming soon. For now, please export your statement as CSV and upload that instead.'
  );
}

// =============================================================================
// File Upload Handler
// =============================================================================

/**
 * Parse uploaded bank statement file
 */
export async function parseStatementFile(file: File): Promise<ParsedStatement> {
  const fileType = file.type;
  const fileName = file.name.toLowerCase();

  // Determine file type
  const isCSV =
    fileType === 'text/csv' ||
    fileType === 'application/vnd.ms-excel' ||
    fileName.endsWith('.csv');

  const isPDF = fileType === 'application/pdf' || fileName.endsWith('.pdf');

  if (!isCSV && !isPDF) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      "We support CSV and PDF files. Please upload a file in one of these formats."
    );
  }

  // Check file size (max 10MB)
  const MAX_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      "That file is too large. Please upload a file smaller than 10MB."
    );
  }

  if (isCSV) {
    const content = await file.text();
    return parseCSVStatement(content);
  } else {
    const buffer = await file.arrayBuffer();
    return parsePDFStatement(buffer);
  }
}

/**
 * Validate parsed statement
 */
export function validateStatement(statement: ParsedStatement): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (statement.transactions.length === 0) {
    errors.push("The statement doesn't contain any transactions.");
  }

  if (statement.statementPeriod.startDate >= statement.statementPeriod.endDate) {
    errors.push("The statement dates don't look right. The start date should be before the end date.");
  }

  // Validate that dates are reasonable (not in future, not more than 10 years ago)
  const now = Date.now();
  const tenYearsAgo = now - 10 * 365 * 24 * 60 * 60 * 1000;

  if (statement.statementPeriod.endDate > now) {
    errors.push("The statement end date is in the future. Please check your file.");
  }

  if (statement.statementPeriod.startDate < tenYearsAgo) {
    errors.push("The statement appears to be more than 10 years old. Please check your file.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
