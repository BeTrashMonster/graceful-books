/**
 * File Validation Tests
 *
 * Comprehensive tests for the FileValidator utility.
 * Tests magic number verification, size limits, CSV structure validation,
 * and user-friendly error messages.
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { FileValidator, validateFile, validateStatementFile } from '../../utils/fileValidation';

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

// Helper to create a mock File with specific content
function createMockFile(
  content: Uint8Array | string,
  filename: string,
  type: string = 'application/octet-stream'
): File {
  const blob = content instanceof Uint8Array
    ? new Blob([content], { type })
    : new Blob([content], { type });
  return new File([blob], filename, { type });
}

// Helper to create a file with specific magic bytes
function createFileWithMagic(magic: number[], filename: string, additionalBytes: number = 100): File {
  const bytes = new Uint8Array(magic.length + additionalBytes);
  magic.forEach((byte, i) => {
    bytes[i] = byte;
  });
  // Fill remaining bytes with random data
  for (let i = magic.length; i < bytes.length; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return createMockFile(bytes, filename);
}

describe('FileValidator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateNotEmpty', () => {
    it('should reject null file', () => {
      const result = FileValidator.validateNotEmpty(null as unknown as File);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('No file was selected');
    });

    it('should reject undefined file', () => {
      const result = FileValidator.validateNotEmpty(undefined as unknown as File);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('No file was selected');
    });

    it('should reject empty file (0 bytes)', () => {
      const emptyFile = createMockFile(new Uint8Array(0), 'empty.pdf');
      const result = FileValidator.validateNotEmpty(emptyFile);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('appears to be empty');
    });

    it('should accept non-empty file', () => {
      const file = createMockFile('some content', 'test.txt');
      const result = FileValidator.validateNotEmpty(file);
      expect(result.valid).toBe(true);
    });
  });

  describe('validateFileSize', () => {
    it('should accept file under 10MB', () => {
      // Create a 1KB file
      const content = new Uint8Array(1024);
      const file = createMockFile(content, 'small.pdf');
      const result = FileValidator.validateFileSize(file);
      expect(result.valid).toBe(true);
    });

    it('should accept file exactly at 10MB', () => {
      // Create exactly 10MB file
      const tenMB = 10 * 1024 * 1024;
      const content = new Uint8Array(tenMB);
      const file = createMockFile(content, 'exact10mb.pdf');
      const result = FileValidator.validateFileSize(file);
      expect(result.valid).toBe(true);
    });

    it('should reject file over 10MB', () => {
      // Create 11MB file
      const elevenMB = 11 * 1024 * 1024;
      const content = new Uint8Array(elevenMB);
      const file = createMockFile(content, 'large.pdf');
      const result = FileValidator.validateFileSize(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds our 10MB limit');
      expect(result.error).toContain('11.0MB');
    });

    it('should provide helpful error message for large files', () => {
      const largeMB = 25 * 1024 * 1024;
      const content = new Uint8Array(largeMB);
      const file = createMockFile(content, 'huge.pdf');
      const result = FileValidator.validateFileSize(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('contact support');
    });
  });

  describe('validatePDF (magic number)', () => {
    it('should accept valid PDF with correct magic number', () => {
      // PDF magic number: %PDF (0x25504446)
      const pdfMagic = [0x25, 0x50, 0x44, 0x46];
      const bytes = new Uint8Array([...pdfMagic, 0x2d, 0x31, 0x2e, 0x34]); // %PDF-1.4
      const result = FileValidator.validatePDF(bytes);
      expect(result.valid).toBe(true);
      expect(result.fileType).toBe('pdf');
    });

    it('should reject file without PDF magic number', () => {
      const fakeBytes = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
      const result = FileValidator.validatePDF(fakeBytes);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("doesn't appear to be a valid PDF");
    });

    it('should reject file with partial PDF magic number', () => {
      // Only %PD, missing F
      const partialMagic = new Uint8Array([0x25, 0x50, 0x44, 0x00]);
      const result = FileValidator.validatePDF(partialMagic);
      expect(result.valid).toBe(false);
    });

    it('should reject file with too few bytes', () => {
      const shortBytes = new Uint8Array([0x25, 0x50]);
      const result = FileValidator.validatePDF(shortBytes);
      expect(result.valid).toBe(false);
    });
  });

  describe('validatePNG (magic number)', () => {
    it('should accept valid PNG with correct magic number', () => {
      // PNG magic number: 89 50 4E 47
      const pngMagic = [0x89, 0x50, 0x4e, 0x47];
      const bytes = new Uint8Array([...pngMagic, 0x0d, 0x0a, 0x1a, 0x0a]);
      const result = FileValidator.validatePNG(bytes);
      expect(result.valid).toBe(true);
      expect(result.fileType).toBe('png');
    });

    it('should reject file without PNG magic number', () => {
      const fakeBytes = new Uint8Array([0x00, 0x50, 0x4e, 0x47]);
      const result = FileValidator.validatePNG(fakeBytes);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("doesn't appear to be a valid PNG");
    });
  });

  describe('validateJPG (magic number)', () => {
    it('should accept valid JPEG with correct magic number', () => {
      // JPEG magic number: FF D8 FF
      const jpgMagic = [0xff, 0xd8, 0xff];
      const bytes = new Uint8Array([...jpgMagic, 0xe0, 0x00, 0x10]);
      const result = FileValidator.validateJPG(bytes);
      expect(result.valid).toBe(true);
      expect(result.fileType).toBe('jpg');
    });

    it('should reject file without JPEG magic number', () => {
      const fakeBytes = new Uint8Array([0xff, 0xd8, 0x00]);
      const result = FileValidator.validateJPG(fakeBytes);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("doesn't appear to be a valid JPEG");
    });
  });

  describe('validateCSV', () => {
    it('should accept valid CSV with headers and data', async () => {
      const csvContent = `Date,Description,Amount
01/15/2024,Coffee Shop,-12.50
01/16/2024,Salary,2500.00`;
      const file = createMockFile(csvContent, 'statement.csv', 'text/csv');
      const result = await FileValidator.validateCSV(file);
      expect(result.valid).toBe(true);
      expect(result.fileType).toBe('csv');
    });

    it('should accept CSV with semicolon delimiter', async () => {
      const csvContent = `Date;Description;Amount
01/15/2024;Coffee Shop;-12.50
01/16/2024;Salary;2500.00`;
      const file = createMockFile(csvContent, 'statement.csv', 'text/csv');
      const result = await FileValidator.validateCSV(file);
      expect(result.valid).toBe(true);
    });

    it('should accept CSV with tab delimiter', async () => {
      const csvContent = `Date\tDescription\tAmount
01/15/2024\tCoffee Shop\t-12.50
01/16/2024\tSalary\t2500.00`;
      const file = createMockFile(csvContent, 'statement.csv', 'text/csv');
      const result = await FileValidator.validateCSV(file);
      expect(result.valid).toBe(true);
    });

    it('should reject empty CSV file', async () => {
      const file = createMockFile('', 'empty.csv', 'text/csv');
      const result = await FileValidator.validateCSV(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('appears to be empty');
    });

    it('should reject CSV with only whitespace', async () => {
      const file = createMockFile('   \n\n  \t  ', 'whitespace.csv', 'text/csv');
      const result = await FileValidator.validateCSV(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('appears to be empty');
    });

    it('should reject CSV with only header row (no data)', async () => {
      const csvContent = 'Date,Description,Amount';
      const file = createMockFile(csvContent, 'header-only.csv', 'text/csv');
      const result = await FileValidator.validateCSV(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('at least a header row and one transaction');
    });

    it('should reject CSV with dangerous control characters', async () => {
      // Include a null byte (0x00) which is dangerous
      const csvContent = `Date,Description,Amount\x00
01/15/2024,Evil,100.00`;
      const file = createMockFile(csvContent, 'malicious.csv', 'text/csv');
      const result = await FileValidator.validateCSV(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('unexpected characters');
    });

    it('should reject CSV with bell character', async () => {
      // Bell character (0x07)
      const csvContent = `Date,Description,Amount
01/15/2024,Test\x07,100.00`;
      const file = createMockFile(csvContent, 'bell.csv', 'text/csv');
      const result = await FileValidator.validateCSV(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('unexpected characters');
    });

    it('should allow normal whitespace characters (tab, newline, CR)', async () => {
      const csvContent = `Date,Description,Amount\r\n01/15/2024,Coffee\tShop,-12.50\r\n01/16/2024,Salary,2500.00`;
      const file = createMockFile(csvContent, 'normal.csv', 'text/csv');
      const result = await FileValidator.validateCSV(file);
      expect(result.valid).toBe(true);
    });

    it('should reject CSV with only one column', async () => {
      // Single column CSV without delimiters will be rejected for missing delimiter
      const csvContent = `OnlyOneColumn
Value1
Value2`;
      const file = createMockFile(csvContent, 'single-column.csv', 'text/csv');
      const result = await FileValidator.validateCSV(file);
      expect(result.valid).toBe(false);
      // Rejected because no delimiter is detected
      expect(result.error).toContain('commas, semicolons, or tabs');
    });

    it('should reject CSV without recognizable delimiter', async () => {
      const csvContent = `DateDescriptionAmount
01152024CoffeeShop1250
01162024Salary250000`;
      const file = createMockFile(csvContent, 'no-delimiter.csv', 'text/csv');
      const result = await FileValidator.validateCSV(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('commas, semicolons, or tabs');
    });

    it('should accept CSV with quoted fields containing delimiters', async () => {
      const csvContent = `Date,Description,Amount
01/15/2024,"Coffee, Tea, and More",-12.50
01/16/2024,"Salary Deposit",2500.00`;
      const file = createMockFile(csvContent, 'quoted.csv', 'text/csv');
      const result = await FileValidator.validateCSV(file);
      expect(result.valid).toBe(true);
    });
  });

  describe('validate (full validation)', () => {
    it('should validate PDF file end-to-end', async () => {
      const pdfMagic = [0x25, 0x50, 0x44, 0x46]; // %PDF
      const file = createFileWithMagic(pdfMagic, 'statement.pdf', 100);
      const result = await FileValidator.validate(file);
      expect(result.valid).toBe(true);
      expect(result.fileType).toBe('pdf');
    });

    it('should validate CSV file end-to-end', async () => {
      const csvContent = `Date,Description,Amount
01/15/2024,Test Transaction,-50.00`;
      const file = createMockFile(csvContent, 'statement.csv', 'text/csv');
      const result = await FileValidator.validate(file);
      expect(result.valid).toBe(true);
      expect(result.fileType).toBe('csv');
    });

    it('should reject PDF with wrong magic number', async () => {
      // Create a file named .pdf but with wrong content
      const wrongMagic = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]);
      const file = createMockFile(wrongMagic, 'fake.pdf');
      const result = await FileValidator.validate(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("doesn't appear to be a valid PDF");
    });

    it('should reject unsupported file types', async () => {
      const content = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
      const file = createMockFile(content, 'document.docx');
      const result = await FileValidator.validate(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('PDF or CSV');
      expect(result.fileType).toBe('unknown');
    });

    it('should check size before magic number', async () => {
      // Create an oversized PDF
      const pdfMagic = [0x25, 0x50, 0x44, 0x46];
      const largePDF = new Uint8Array(11 * 1024 * 1024); // 11MB
      pdfMagic.forEach((byte, i) => {
        largePDF[i] = byte;
      });
      const file = createMockFile(largePDF, 'large.pdf');
      const result = await FileValidator.validate(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds');
    });

    it('should check empty before size', async () => {
      const emptyFile = createMockFile(new Uint8Array(0), 'empty.pdf');
      const result = await FileValidator.validate(emptyFile);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('empty');
    });
  });

  describe('validateStatementFile', () => {
    it('should accept PDF statements', async () => {
      const pdfMagic = [0x25, 0x50, 0x44, 0x46];
      const file = createFileWithMagic(pdfMagic, 'statement.pdf', 100);
      const result = await validateStatementFile(file);
      expect(result.valid).toBe(true);
      expect(result.fileType).toBe('pdf');
    });

    it('should accept CSV statements', async () => {
      const csvContent = `Date,Description,Amount
01/15/2024,Test,-50.00`;
      const file = createMockFile(csvContent, 'statement.csv', 'text/csv');
      const result = await validateStatementFile(file);
      expect(result.valid).toBe(true);
      expect(result.fileType).toBe('csv');
    });

    it('should reject PNG images even if valid', async () => {
      const pngMagic = [0x89, 0x50, 0x4e, 0x47];
      const file = createFileWithMagic(pngMagic, 'statement.png', 100);
      const result = await validateStatementFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Images are not supported');
    });

    it('should reject JPG images even if valid', async () => {
      const jpgMagic = [0xff, 0xd8, 0xff];
      const file = createFileWithMagic(jpgMagic, 'statement.jpg', 100);
      const result = await validateStatementFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Images are not supported');
    });
  });

  describe('convenience function: validateFile', () => {
    it('should work the same as FileValidator.validate', async () => {
      const csvContent = `Date,Description,Amount
01/15/2024,Test,-50.00`;
      const file = createMockFile(csvContent, 'test.csv', 'text/csv');

      const result1 = await validateFile(file);
      const result2 = await FileValidator.validate(file);

      expect(result1.valid).toBe(result2.valid);
      expect(result1.fileType).toBe(result2.fileType);
    });
  });

  describe('utility methods', () => {
    it('should return correct max file size', () => {
      const maxSize = FileValidator.getMaxFileSize();
      expect(maxSize).toBe(10 * 1024 * 1024); // 10MB
    });

    it('should return human-readable max file size', () => {
      const display = FileValidator.getMaxFileSizeDisplay();
      expect(display).toBe('10MB');
    });
  });

  describe('error message style (Steadiness communication)', () => {
    it('should use friendly language in error messages', async () => {
      const emptyFile = createMockFile(new Uint8Array(0), 'empty.pdf');
      const result = await FileValidator.validate(emptyFile);

      // Should not use technical jargon
      expect(result.error).not.toMatch(/invalid|error|fail/i);
      // Should use friendly language
      expect(result.error).toMatch(/please|appears|select/i);
    });

    it('should provide helpful next steps in errors', async () => {
      const largePDF = new Uint8Array(11 * 1024 * 1024);
      const file = createMockFile(largePDF, 'large.pdf');
      const result = await FileValidator.validate(file);

      // Should suggest what to do
      expect(result.error).toMatch(/try|please|contact support/i);
    });
  });

  describe('edge cases', () => {
    it('should handle file with no extension', async () => {
      const content = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
      const file = createMockFile(content, 'noextension');
      const result = await FileValidator.validate(file);
      expect(result.valid).toBe(false);
      expect(result.fileType).toBe('unknown');
    });

    it('should handle file with multiple dots in name', async () => {
      const csvContent = `Date,Amount
01/15/2024,-50.00`;
      const file = createMockFile(csvContent, 'my.bank.statement.csv', 'text/csv');
      const result = await FileValidator.validate(file);
      expect(result.valid).toBe(true);
      expect(result.fileType).toBe('csv');
    });

    it('should handle uppercase extensions', async () => {
      const csvContent = `Date,Amount
01/15/2024,-50.00`;
      const file = createMockFile(csvContent, 'STATEMENT.CSV', 'text/csv');
      const result = await FileValidator.validate(file);
      expect(result.valid).toBe(true);
      expect(result.fileType).toBe('csv');
    });

    it('should handle mixed case extensions', async () => {
      const pdfMagic = [0x25, 0x50, 0x44, 0x46];
      const file = createFileWithMagic(pdfMagic, 'Statement.Pdf', 100);
      const result = await FileValidator.validate(file);
      expect(result.valid).toBe(true);
      expect(result.fileType).toBe('pdf');
    });
  });
});
