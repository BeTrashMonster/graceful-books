/**
 * File Validation Utility
 *
 * Provides comprehensive file validation including magic number verification,
 * size limits, and content structure validation. Uses a security-first approach
 * to prevent malicious file uploads while maintaining user-friendly error messages.
 */

import { logger } from './logger';

/**
 * File validation result
 */
export interface FileValidationResult {
  valid: boolean;
  error?: string;
  fileType?: 'pdf' | 'csv' | 'png' | 'jpg' | 'unknown';
}

/**
 * Magic numbers for supported file types
 * These are the byte sequences at the start of files that identify their true type
 */
const MAGIC_NUMBERS = {
  PDF: [0x25, 0x50, 0x44, 0x46], // %PDF
  PNG: [0x89, 0x50, 0x4e, 0x47], // .PNG
  JPG: [0xff, 0xd8, 0xff],       // JPEG SOI marker
} as const;

/**
 * Maximum file size in bytes (10MB)
 */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Dangerous control characters that should not appear in CSV files
 * Excludes normal characters: tab (0x09), newline (0x0A), carriage return (0x0D)
 */
const DANGEROUS_CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/;

/**
 * FileValidator class for comprehensive file validation
 */
export class FileValidator {
  /**
   * Validate a file before processing
   * Performs all validation checks in sequence
   */
  static async validate(file: File): Promise<FileValidationResult> {
    // Check if file exists and is not empty
    const emptyCheck = this.validateNotEmpty(file);
    if (!emptyCheck.valid) {
      return emptyCheck;
    }

    // Check file size
    const sizeCheck = this.validateFileSize(file);
    if (!sizeCheck.valid) {
      return sizeCheck;
    }

    // Read file bytes for magic number verification
    const bytes = await this.readFileBytes(file, 8);
    if (bytes.length === 0 && file.size > 0) {
      return {
        valid: false,
        error: "We couldn't read this file. Please try uploading it again.",
      };
    }

    // Determine file type from extension
    const extension = this.getFileExtension(file.name);

    // Validate based on expected file type
    if (extension === 'pdf') {
      return this.validatePDF(bytes);
    } else if (extension === 'csv') {
      return await this.validateCSV(file);
    } else if (extension === 'png') {
      return this.validatePNG(bytes);
    } else if (extension === 'jpg' || extension === 'jpeg') {
      return this.validateJPG(bytes);
    }

    // Unknown file type
    return {
      valid: false,
      error: 'Please upload a PDF or CSV file. Other formats are not supported yet.',
      fileType: 'unknown',
    };
  }

  /**
   * Validate that file is not empty
   */
  static validateNotEmpty(file: File): FileValidationResult {
    if (!file) {
      return {
        valid: false,
        error: 'No file was selected. Please choose a file to upload.',
      };
    }

    if (file.size === 0) {
      return {
        valid: false,
        error: 'This file appears to be empty. Please select a different file.',
      };
    }

    return { valid: true };
  }

  /**
   * Validate file size is within limits
   */
  static validateFileSize(file: File): FileValidationResult {
    if (file.size > MAX_FILE_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      return {
        valid: false,
        error: `This file is ${sizeMB}MB, which exceeds our 10MB limit. Please try a smaller file or contact support for help.`,
      };
    }

    return { valid: true };
  }

  /**
   * Validate PDF file by checking magic number
   */
  static validatePDF(bytes: Uint8Array): FileValidationResult {
    if (this.checkMagicNumber(bytes, MAGIC_NUMBERS.PDF)) {
      logger.debug('PDF magic number verified');
      return { valid: true, fileType: 'pdf' };
    }

    return {
      valid: false,
      error: "This doesn't appear to be a valid PDF file. Please check the file and try again.",
      fileType: 'unknown',
    };
  }

  /**
   * Validate PNG file by checking magic number
   */
  static validatePNG(bytes: Uint8Array): FileValidationResult {
    if (this.checkMagicNumber(bytes, MAGIC_NUMBERS.PNG)) {
      logger.debug('PNG magic number verified');
      return { valid: true, fileType: 'png' };
    }

    return {
      valid: false,
      error: "This doesn't appear to be a valid PNG image. Please check the file and try again.",
      fileType: 'unknown',
    };
  }

  /**
   * Validate JPG file by checking magic number
   */
  static validateJPG(bytes: Uint8Array): FileValidationResult {
    if (this.checkMagicNumber(bytes, MAGIC_NUMBERS.JPG)) {
      logger.debug('JPG magic number verified');
      return { valid: true, fileType: 'jpg' };
    }

    return {
      valid: false,
      error: "This doesn't appear to be a valid JPEG image. Please check the file and try again.",
      fileType: 'unknown',
    };
  }

  /**
   * Validate CSV file structure
   * CSVs don't have a magic number, so we validate content structure
   */
  static async validateCSV(file: File): Promise<FileValidationResult> {
    try {
      // Read the entire file as text for validation
      const text = await file.text();

      // Check for empty content
      if (!text.trim()) {
        return {
          valid: false,
          error: 'This CSV file appears to be empty. Please select a file with transaction data.',
          fileType: 'csv',
        };
      }

      // Check for dangerous control characters
      if (DANGEROUS_CONTROL_CHARS.test(text)) {
        logger.warn('CSV contains dangerous control characters');
        return {
          valid: false,
          error: 'This file contains unexpected characters and cannot be processed. Please try exporting a fresh copy from your bank.',
          fileType: 'unknown',
        };
      }

      // Validate CSV structure - must have at least a header row and one data row
      const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);

      if (lines.length < 2) {
        return {
          valid: false,
          error: 'This CSV file needs at least a header row and one transaction. Please check the file format.',
          fileType: 'csv',
        };
      }

      // Detect delimiter (comma, semicolon, or tab)
      const firstLine = lines[0]!;
      const delimiter = this.detectDelimiter(firstLine);

      if (!delimiter) {
        return {
          valid: false,
          error: "We couldn't determine the format of this CSV file. Please make sure it uses commas, semicolons, or tabs as separators.",
          fileType: 'csv',
        };
      }

      // Validate consistent column count
      const headerColumnCount = this.countColumns(firstLine, delimiter);

      if (headerColumnCount < 2) {
        return {
          valid: false,
          error: 'This CSV file needs at least two columns (like Date and Amount). Please check the file format.',
          fileType: 'csv',
        };
      }

      // Check that at least some data rows have consistent column count
      let validRows = 0;
      for (let i = 1; i < Math.min(lines.length, 10); i++) {
        const columnCount = this.countColumns(lines[i]!, delimiter);
        // Allow some flexibility (within 1 column) for quoted fields that might span lines
        if (Math.abs(columnCount - headerColumnCount) <= 1) {
          validRows++;
        }
      }

      if (validRows === 0) {
        return {
          valid: false,
          error: 'The columns in this CSV file seem inconsistent. Please check that all rows have the same number of columns.',
          fileType: 'csv',
        };
      }

      logger.debug('CSV structure validated', { lines: lines.length, columns: headerColumnCount });
      return { valid: true, fileType: 'csv' };
    } catch (error) {
      logger.error('Error validating CSV:', error);
      return {
        valid: false,
        error: "We had trouble reading this CSV file. Please make sure it's a valid text file.",
        fileType: 'unknown',
      };
    }
  }

  /**
   * Read first N bytes of a file
   * Uses FileReader for better test environment compatibility
   */
  private static async readFileBytes(file: File, count: number): Promise<Uint8Array> {
    try {
      const slice = file.slice(0, count);
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (reader.result instanceof ArrayBuffer) {
            resolve(new Uint8Array(reader.result));
          } else {
            resolve(new Uint8Array(0));
          }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(slice);
      });
    } catch (error) {
      logger.error('Error reading file bytes:', error);
      return new Uint8Array(0);
    }
  }

  /**
   * Check if file bytes match a magic number sequence
   */
  private static checkMagicNumber(bytes: Uint8Array, magic: readonly number[]): boolean {
    if (bytes.length < magic.length) {
      return false;
    }

    for (let i = 0; i < magic.length; i++) {
      if (bytes[i] !== magic[i]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Extract file extension from filename
   */
  private static getFileExtension(filename: string): string {
    const parts = filename.toLowerCase().split('.');
    return parts.length > 1 ? parts[parts.length - 1]! : '';
  }

  /**
   * Detect CSV delimiter from a line
   */
  private static detectDelimiter(line: string): string | null {
    const delimiters = [',', ';', '\t'];

    for (const delimiter of delimiters) {
      // Check if delimiter appears in the line
      if (line.includes(delimiter)) {
        return delimiter;
      }
    }

    return null;
  }

  /**
   * Count columns in a CSV line (basic implementation)
   * Handles quoted fields but not all edge cases
   */
  private static countColumns(line: string, delimiter: string): number {
    let count = 1;
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        count++;
      }
    }

    return count;
  }

  /**
   * Get maximum file size in bytes
   */
  static getMaxFileSize(): number {
    return MAX_FILE_SIZE;
  }

  /**
   * Get maximum file size formatted for display
   */
  static getMaxFileSizeDisplay(): string {
    return '10MB';
  }
}

/**
 * Convenience function for quick file validation
 */
export async function validateFile(file: File): Promise<FileValidationResult> {
  return FileValidator.validate(file);
}

/**
 * Validate that a file is a supported statement format (PDF or CSV)
 */
export async function validateStatementFile(file: File): Promise<FileValidationResult> {
  const result = await FileValidator.validate(file);

  if (result.valid && result.fileType !== 'pdf' && result.fileType !== 'csv') {
    return {
      valid: false,
      error: 'Please upload a PDF or CSV bank statement. Images are not supported for statements.',
      fileType: result.fileType,
    };
  }

  return result;
}
