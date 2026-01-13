/**
 * PDF Parser for Bank Statements
 *
 * Parses PDF bank statements into a standardized format.
 * Uses pdf-parse to extract text and pattern matching to identify transactions.
 */

import pdf from 'pdf-parse';
import { nanoid } from 'nanoid';
import type {
  ParsedStatement,
  StatementTransaction,
  PDFParseResult,
} from '../../types/reconciliation.types';
import { logger } from '../logger';
import { AppError, ErrorCode } from '../errors';

/**
 * Parse PDF bank statement file
 */
export async function parsePDFStatement(file: File): Promise<ParsedStatement> {
  try {
    // Convert file to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract text from PDF
    const pdfData = await pdf(buffer);

    if (!pdfData.text || pdfData.text.trim().length === 0) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Could not extract text from this PDF. It might be an image-based PDF that requires OCR.'
      );
    }

    logger.info('Extracted text from PDF', {
      pages: pdfData.numpages,
      textLength: pdfData.text.length,
    });

    // Parse the extracted text
    const statement = parseStatementText(pdfData.text);

    logger.info('Successfully parsed PDF statement', {
      transactionCount: statement.transactions.length,
      period: {
        start: new Date(statement.statementPeriod.startDate).toISOString(),
        end: new Date(statement.statementPeriod.endDate).toISOString(),
      },
    });

    return statement;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    logger.error('Error parsing PDF statement:', error);
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      'We had trouble reading this PDF statement. Please make sure it\'s a valid bank statement or try uploading a CSV instead.'
    );
  }
}

/**
 * Parse statement text extracted from PDF
 */
function parseStatementText(text: string): ParsedStatement {
  // Extract statement period
  const period = extractStatementPeriod(text);

  // Extract balances
  const { openingBalance, closingBalance } = extractBalances(text);

  // Extract transactions
  const transactions = extractTransactions(text);

  if (transactions.length === 0) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      'No transactions found in this PDF. Please make sure it\'s a complete bank statement.'
    );
  }

  // Sort transactions by date
  transactions.sort((a, b) => a.date - b.date);

  const statement: ParsedStatement = {
    statementPeriod: period,
    openingBalance,
    closingBalance,
    transactions,
    format: 'pdf',
  };

  return statement;
}

/**
 * Extract statement period from text
 */
function extractStatementPeriod(text: string): { startDate: number; endDate: number } {
  // Common patterns for statement periods
  const patterns = [
    // "Statement Period: MM/DD/YYYY - MM/DD/YYYY"
    /statement\s+period[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})\s*[-–]\s*(\d{1,2}\/\d{1,2}\/\d{4})/i,
    // "From MM/DD/YYYY To MM/DD/YYYY"
    /from\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+to\s+(\d{1,2}\/\d{1,2}\/\d{4})/i,
    // "YYYY-MM-DD to YYYY-MM-DD"
    /(\d{4}-\d{2}-\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const startDate = parseDate(match[1]);
      const endDate = parseDate(match[2]);

      if (startDate && endDate) {
        return {
          startDate: startDate.getTime(),
          endDate: endDate.getTime(),
        };
      }
    }
  }

  // If no period found, try to extract from transactions
  logger.warn('Could not extract statement period from PDF, will derive from transactions');

  // Return placeholder dates (will be updated after parsing transactions)
  const now = new Date();
  return {
    startDate: new Date(now.getFullYear(), now.getMonth(), 1).getTime(),
    endDate: now.getTime(),
  };
}

/**
 * Extract opening and closing balances
 */
function extractBalances(text: string): { openingBalance?: number; closingBalance?: number } {
  const balances: { openingBalance?: number; closingBalance?: number } = {};

  // Patterns for opening balance
  const openingPatterns = [
    /opening\s+balance[:\s]+\$?([\d,]+\.\d{2})/i,
    /previous\s+balance[:\s]+\$?([\d,]+\.\d{2})/i,
    /beginning\s+balance[:\s]+\$?([\d,]+\.\d{2})/i,
  ];

  // Patterns for closing balance
  const closingPatterns = [
    /closing\s+balance[:\s]+\$?([\d,]+\.\d{2})/i,
    /ending\s+balance[:\s]+\$?([\d,]+\.\d{2})/i,
    /current\s+balance[:\s]+\$?([\d,]+\.\d{2})/i,
  ];

  // Extract opening balance
  for (const pattern of openingPatterns) {
    const match = text.match(pattern);
    if (match) {
      balances.openingBalance = parseAmount(match[1]);
      break;
    }
  }

  // Extract closing balance
  for (const pattern of closingPatterns) {
    const match = text.match(pattern);
    if (match) {
      balances.closingBalance = parseAmount(match[1]);
      break;
    }
  }

  return balances;
}

/**
 * Extract transactions from text
 */
function extractTransactions(text: string): StatementTransaction[] {
  const transactions: StatementTransaction[] = [];

  // Split text into lines
  const lines = text.split('\n').map(line => line.trim());

  // Common transaction line patterns
  // Pattern: MM/DD/YYYY Description Amount [Balance]
  const pattern1 = /^(\d{1,2}\/\d{1,2}\/\d{4})\s+(.+?)\s+([-+]?\$?[\d,]+\.\d{2})(?:\s+([\d,]+\.\d{2}))?$/;

  // Pattern: MM/DD Description Amount Balance (year in header)
  const pattern2 = /^(\d{1,2}\/\d{1,2})\s+(.+?)\s+([-+]?\$?[\d,]+\.\d{2})(?:\s+([\d,]+\.\d{2}))?$/;

  // Pattern: YYYY-MM-DD Description Amount Balance
  const pattern3 = /^(\d{4}-\d{2}-\d{2})\s+(.+?)\s+([-+]?\$?[\d,]+\.\d{2})(?:\s+([\d,]+\.\d{2}))?$/;

  const currentYear = new Date().getFullYear();

  for (const line of lines) {
    // Try pattern 1 (full date)
    let match = line.match(pattern1);
    if (match) {
      const [, dateStr, description, amountStr, balanceStr] = match;
      const date = parseDate(dateStr);

      if (date) {
        transactions.push({
          id: nanoid(),
          date: date.getTime(),
          description: description.trim(),
          amount: parseAmount(amountStr),
          balance: balanceStr ? parseAmount(balanceStr) : undefined,
          matched: false,
        });
        continue;
      }
    }

    // Try pattern 2 (MM/DD without year)
    match = line.match(pattern2);
    if (match) {
      const [, dateStr, description, amountStr, balanceStr] = match;
      const date = parseDate(`${dateStr}/${currentYear}`);

      if (date) {
        transactions.push({
          id: nanoid(),
          date: date.getTime(),
          description: description.trim(),
          amount: parseAmount(amountStr),
          balance: balanceStr ? parseAmount(balanceStr) : undefined,
          matched: false,
        });
        continue;
      }
    }

    // Try pattern 3 (ISO date)
    match = line.match(pattern3);
    if (match) {
      const [, dateStr, description, amountStr, balanceStr] = match;
      const date = parseDate(dateStr);

      if (date) {
        transactions.push({
          id: nanoid(),
          date: date.getTime(),
          description: description.trim(),
          amount: parseAmount(amountStr),
          balance: balanceStr ? parseAmount(balanceStr) : undefined,
          matched: false,
        });
      }
    }
  }

  // Remove duplicates (sometimes PDF extraction duplicates content)
  const uniqueTransactions = removeDuplicateTransactions(transactions);

  return uniqueTransactions;
}

/**
 * Remove duplicate transactions
 */
function removeDuplicateTransactions(transactions: StatementTransaction[]): StatementTransaction[] {
  const seen = new Set<string>();
  const unique: StatementTransaction[] = [];

  for (const tx of transactions) {
    // Create unique key from date, description, and amount
    const key = `${tx.date}-${tx.description}-${tx.amount}`;

    if (!seen.has(key)) {
      seen.add(key);
      unique.push(tx);
    }
  }

  return unique;
}

/**
 * Parse date string to Date object
 */
function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  // Try ISO format first
  const isoDate = new Date(dateStr);
  if (!isNaN(isoDate.getTime())) {
    return isoDate;
  }

  // Try MM/DD/YYYY
  const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, month, day, year] = match;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  // Try YYYY-MM-DD
  const matchISO = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (matchISO) {
    const [, year, month, day] = matchISO;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  return null;
}

/**
 * Parse amount string to cents (integer)
 */
function parseAmount(amountStr: string): number {
  if (!amountStr) return 0;

  // Remove currency symbols, commas, and whitespace
  const cleaned = amountStr
    .replace(/[$£€¥,\s]/g, '')
    .replace(/[()]/g, '-') // Handle parentheses as negative
    .trim();

  if (!cleaned) return 0;

  const value = parseFloat(cleaned);

  if (isNaN(value)) {
    return 0;
  }

  // Convert to cents (integer) to avoid floating point issues
  return Math.round(value * 100);
}

/**
 * Extract PDF text (utility function for testing)
 */
export async function extractPDFText(file: File): Promise<PDFParseResult> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const pdfData = await pdf(buffer);

    return {
      text: pdfData.text,
      pages: pdfData.numpages,
      success: true,
    };
  } catch (error) {
    logger.error('Error extracting PDF text:', error);
    return {
      text: '',
      pages: 0,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
