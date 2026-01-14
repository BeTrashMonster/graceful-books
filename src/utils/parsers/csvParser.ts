/**
 * CSV Parser for Bank Statements
 *
 * Parses CSV files from various banks into a standardized format.
 * Uses papaparse for robust CSV parsing with auto-detection.
 */

import Papa from 'papaparse';
import { nanoid } from 'nanoid';
import type {
  ParsedStatement,
  StatementTransaction,
  CSVParseOptions,
  CSVColumnMapping,
} from '../../types/reconciliation.types';
import { logger } from '../logger';
import { AppError, ErrorCode } from '../errors';

/**
 * Parse CSV bank statement file
 */
export async function parseCSVStatement(
  file: File,
  options?: CSVParseOptions
): Promise<ParsedStatement> {
  try {
    // Read file as text
    const text = await file.text();

    // Parse CSV with papaparse
    const parseResult = await new Promise<Papa.ParseResult<string[]>>((resolve, reject) => {
      Papa.parse(text, {
        delimiter: options?.delimiter || '', // Auto-detect if not specified
        skipEmptyLines: true,
        complete: resolve,
        error: reject,
      });
    });

    if (parseResult.errors.length > 0) {
      logger.warn('CSV parsing encountered errors:', parseResult.errors);
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'The CSV file contains formatting errors. Please check the file and try again.'
      );
    }

    const rows = parseResult.data;

    if (rows.length === 0) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'The CSV file appears to be empty. Please check the file and try again.'
      );
    }

    // Skip rows if specified
    const startRow = (options?.skipRows || 0) + (options?.hasHeader !== false ? 1 : 0);
    const dataRows = rows.slice(startRow);

    if (dataRows.length === 0) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'No transaction data found in the CSV file.'
      );
    }

    // Detect or use provided column mapping
    const columnMapping = options?.columnMapping || detectColumnMapping(rows[0] || []);

    // Parse transactions
    const transactions = parseTransactions(dataRows, columnMapping, options?.dateFormat);

    if (transactions.length === 0) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'No valid transactions could be parsed from the CSV file.'
      );
    }

    // Sort transactions by date (oldest first)
    transactions.sort((a, b) => a.date - b.date);

    // Determine statement period
    const dates = transactions.map(t => t.date);
    const startDate = Math.min(...dates);
    const endDate = Math.max(...dates);

    // Extract opening and closing balances if available
    let openingBalance: number | undefined;
    let closingBalance: number | undefined;

    if (transactions.length > 0 && transactions[0].balance !== undefined) {
      // Calculate opening balance from first transaction
      const firstTx = transactions[0];
      if (firstTx.balance !== undefined) {
        openingBalance = firstTx.balance - firstTx.amount;
      }

      // Closing balance is the last transaction's balance
      const lastTx = transactions[transactions.length - 1];
      closingBalance = lastTx.balance;
    }

    const statement: ParsedStatement = {
      statementPeriod: {
        startDate,
        endDate,
      },
      openingBalance,
      closingBalance,
      transactions,
      format: 'csv',
    };

    logger.info('Successfully parsed CSV statement', {
      transactionCount: transactions.length,
      period: {
        start: new Date(startDate).toISOString(),
        end: new Date(endDate).toISOString(),
      },
    });

    return statement;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    logger.error('Error parsing CSV statement:', error);
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      'We had trouble reading this CSV file. Please make sure it\'s a valid bank statement.'
    );
  }
}

/**
 * Detect column mapping from CSV header row
 */
function detectColumnMapping(headerRow: string[]): CSVColumnMapping {
  const mapping: CSVColumnMapping = {
    dateColumn: -1,
    descriptionColumn: -1,
    amountColumn: -1,
  };

  // Common column name patterns (case-insensitive)
  const datePatterns = /date|posted|transaction\s*date/i;
  const descriptionPatterns = /description|memo|details|narrative|payee/i;
  const amountPatterns = /amount|total/i;
  const debitPatterns = /debit|withdrawal|payment|out/i;
  const creditPatterns = /credit|deposit|in/i;
  const balancePatterns = /balance|running\s*balance|available/i;
  const referencePatterns = /reference|ref|check|cheque|number/i;

  headerRow.forEach((col, index) => {
    const normalized = col.trim().toLowerCase();

    if (datePatterns.test(normalized) && mapping.dateColumn === -1) {
      mapping.dateColumn = index;
    } else if (descriptionPatterns.test(normalized) && mapping.descriptionColumn === -1) {
      mapping.descriptionColumn = index;
    } else if (debitPatterns.test(normalized) && !mapping.debitColumn) {
      mapping.debitColumn = index;
    } else if (creditPatterns.test(normalized) && !mapping.creditColumn) {
      mapping.creditColumn = index;
    } else if (amountPatterns.test(normalized) && mapping.amountColumn === -1 && !debitPatterns.test(normalized) && !creditPatterns.test(normalized)) {
      mapping.amountColumn = index;
    } else if (balancePatterns.test(normalized) && !mapping.balanceColumn) {
      mapping.balanceColumn = index;
    } else if (referencePatterns.test(normalized) && !mapping.referenceColumn) {
      mapping.referenceColumn = index;
    }
  });

  // Validate required columns found
  if (mapping.dateColumn === -1 || mapping.descriptionColumn === -1) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      'Could not detect date and description columns. Please try uploading a different format or contact support.'
    );
  }

  // Check if amount is in separate debit/credit columns
  if (mapping.amountColumn === -1 && (!mapping.debitColumn || !mapping.creditColumn)) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      'Could not detect amount columns. Please try uploading a different format or contact support.'
    );
  }

  return mapping;
}

/**
 * Parse individual transactions from data rows
 */
function parseTransactions(
  rows: string[][],
  mapping: CSVColumnMapping,
  dateFormat?: string
): StatementTransaction[] {
  const transactions: StatementTransaction[] = [];

  for (const row of rows) {
    try {
      const transaction = parseTransaction(row, mapping, dateFormat);
      if (transaction) {
        transactions.push(transaction);
      }
    } catch (error) {
      // Log error but continue parsing other rows
      logger.warn('Failed to parse transaction row:', { row, error });
    }
  }

  return transactions;
}

/**
 * Parse a single transaction row
 */
function parseTransaction(
  row: string[],
  mapping: CSVColumnMapping,
  dateFormat?: string
): StatementTransaction | null {
  // Extract values using column mapping
  const dateStr = getColumnValue(row, mapping.dateColumn);
  const description = getColumnValue(row, mapping.descriptionColumn);

  if (!dateStr || !description) {
    return null; // Skip rows with missing required fields
  }

  // Parse date
  const date = parseDate(dateStr, dateFormat);
  if (!date) {
    return null;
  }

  // Parse amount (handle both single amount column and separate debit/credit)
  let amount: number;

  if (mapping.amountColumn !== undefined && mapping.amountColumn !== -1) {
    const amountStr = getColumnValue(row, mapping.amountColumn);
    amount = parseAmount(amountStr);
  } else if (mapping.debitColumn !== undefined && mapping.creditColumn !== undefined) {
    const debitStr = getColumnValue(row, mapping.debitColumn);
    const creditStr = getColumnValue(row, mapping.creditColumn);

    const debit = parseAmount(debitStr);
    const credit = parseAmount(creditStr);

    // Debits are negative (money out), credits are positive (money in)
    amount = credit - debit;
  } else {
    return null;
  }

  // Parse optional fields
  const balance = mapping.balanceColumn !== undefined
    ? parseAmount(getColumnValue(row, mapping.balanceColumn))
    : undefined;

  const reference = mapping.referenceColumn !== undefined
    ? getColumnValue(row, mapping.referenceColumn)
    : undefined;

  return {
    id: nanoid(),
    date: date.getTime(),
    description: description.trim(),
    amount,
    balance,
    reference,
    matched: false,
  };
}

/**
 * Get column value from row by index or name
 */
function getColumnValue(row: string[], column: number | string): string {
  if (typeof column === 'number') {
    return row[column]?.trim() || '';
  }
  return ''; // Named columns not supported in current implementation
}

/**
 * Parse date string to Date object
 */
function parseDate(dateStr: string, _format?: string): Date | null {
  if (!dateStr) return null;

  // Try YYYY-MM-DD format first (most common in CSV exports)
  const matchISO = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (matchISO) {
    const [, year, month, day] = matchISO;
    // Use local timezone by constructing Date with year, month, day
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  // Try MM/DD/YYYY (common in US)
  const matchUS = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (matchUS) {
    const [, month, day, year] = matchUS;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  // Try DD/MM/YYYY (common in Europe)
  const matchEU = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (matchEU) {
    const [, day, month, year] = matchEU;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  // Try DD-MM-YYYY
  const matchDash = dateStr.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (matchDash) {
    const [, day, month, year] = matchDash;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  // Last resort: try ISO string parser (UTC)
  const isoDate = new Date(dateStr);
  if (!isNaN(isoDate.getTime())) {
    // Convert UTC to local timezone
    return new Date(isoDate.getUTCFullYear(), isoDate.getUTCMonth(), isoDate.getUTCDate());
  }

  logger.warn('Could not parse date:', dateStr);
  return null;
}

/**
 * Parse amount string to cents (integer)
 */
function parseAmount(amountStr: string | undefined): number {
  if (!amountStr) return 0;

  // Remove currency symbols, commas, and whitespace
  const cleaned = amountStr
    .replace(/[$£€¥,\s]/g, '')
    .replace(/[()]/g, '-') // Handle parentheses as negative
    .trim();

  if (!cleaned) return 0;

  const value = parseFloat(cleaned);

  if (isNaN(value)) {
    logger.warn('Could not parse amount:', amountStr);
    return 0;
  }

  // Convert to cents (integer) to avoid floating point issues
  return Math.round(value * 100);
}

/**
 * Validate parsed statement
 */
export function validateParsedStatement(statement: ParsedStatement): boolean {
  if (!statement.transactions || statement.transactions.length === 0) {
    return false;
  }

  if (!statement.statementPeriod.startDate || !statement.statementPeriod.endDate) {
    return false;
  }

  if (statement.statementPeriod.startDate > statement.statementPeriod.endDate) {
    return false;
  }

  return true;
}
