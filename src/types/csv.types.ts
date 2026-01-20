/**
 * CSV Import/Export Type Definitions for Graceful Books
 *
 * This file contains TypeScript types for CSV import/export functionality (J9).
 * Supports transactions, invoices, bills, contacts, and products.
 */

// ============================================================================
// Entity Types for CSV Operations
// ============================================================================

/**
 * Supported entity types for CSV import/export
 */
export type CSVEntityType = 'transactions' | 'invoices' | 'bills' | 'contacts' | 'products';

// ============================================================================
// Export Types
// ============================================================================

/**
 * Date range options for exports
 */
export type DateRangePreset = 'last30' | 'last90' | 'last365' | 'ytd' | 'lastYear' | 'allTime' | 'custom';

/**
 * Export configuration for generating CSV files
 */
export interface CSVExportConfig {
  entityType: CSVEntityType;
  dateRange?: DateRangePreset;
  customStartDate?: Date;
  customEndDate?: Date;
  selectedFields?: string[]; // Field names to include (null = all fields)
  includeHeaders?: boolean; // Default: true
  encoding?: 'utf-8' | 'utf-16'; // Default: utf-8
}

/**
 * Export result containing the CSV data
 */
export interface CSVExportResult {
  success: boolean;
  filename: string; // e.g., "graceful_books_transactions_2026-01-20.csv"
  csvContent: string; // CSV-formatted string
  rowCount: number;
  error?: string;
}

// ============================================================================
// Import Types
// ============================================================================

/**
 * Column mapping between CSV headers and entity fields
 */
export interface ColumnMapping {
  csvColumn: string; // Header from uploaded CSV
  entityField: string; // Field name in our entity type
  confidence: number; // 0-1, how confident the auto-mapping is
}

/**
 * Import mode options
 */
export type ImportMode = 'dryRun' | 'import';

/**
 * Import configuration
 */
export interface CSVImportConfig {
  entityType: CSVEntityType;
  mode: ImportMode; // dryRun = validate only, import = actually import
  columnMappings: ColumnMapping[];
  skipFirstRow?: boolean; // Skip header row (default: true)
  detectDuplicates?: boolean; // Check for duplicates (default: true)
  onDuplicateAction?: 'skip' | 'update' | 'create'; // Default: skip
}

/**
 * Validation error for a specific row
 */
export interface CSVRowError {
  rowNumber: number; // 1-based row number
  field: string; // Field name with error
  value: string; // Invalid value
  message: string; // Human-readable error message
}

/**
 * Validation result for CSV import
 */
export interface CSVValidationResult {
  valid: boolean;
  errors: CSVRowError[];
  warnings: CSVRowError[]; // Non-fatal issues (e.g., possible duplicates)
  rowsProcessed: number;
  validRows: number;
  invalidRows: number;
}

/**
 * Import result after processing
 */
export interface CSVImportResult {
  success: boolean;
  validation: CSVValidationResult;
  imported: number; // Number of rows actually imported
  skipped: number; // Number of rows skipped (duplicates, errors)
  updated: number; // Number of rows updated (if onDuplicateAction = 'update')
  error?: string;
}

/**
 * Parsed CSV data with preview
 */
export interface CSVParseResult {
  success: boolean;
  headers: string[];
  rows: string[][]; // Array of rows, each row is array of values
  totalRows: number;
  preview: string[][]; // First 10 rows for preview
  error?: string;
}

// ============================================================================
// Entity-Specific CSV Field Definitions
// ============================================================================

/**
 * Transaction CSV fields
 */
export interface TransactionCSVRow {
  Date: string; // ISO format YYYY-MM-DD or MM/DD/YYYY
  Description: string;
  Amount: string; // Numeric, optional negative sign
  Account: string; // Account name
  Category?: string; // Optional category
  Notes?: string; // Optional notes
}

/**
 * Invoice CSV fields
 */
export interface InvoiceCSVRow {
  'Invoice Number': string;
  Customer: string;
  Date: string; // ISO format
  Amount: string;
  Status: string; // 'Paid' | 'Unpaid' | 'Partial' | 'Overdue'
  'Due Date': string; // ISO format
  Notes?: string;
}

/**
 * Bill CSV fields
 */
export interface BillCSVRow {
  'Bill Number': string;
  Vendor: string;
  Date: string;
  Amount: string;
  Status: string; // 'Paid' | 'Unpaid' | 'Overdue'
  'Due Date': string;
  Notes?: string;
}

/**
 * Contact CSV fields
 */
export interface ContactCSVRow {
  Name: string;
  Email?: string;
  Phone?: string;
  Type: string; // 'Customer' | 'Vendor' | 'Both'
  Address?: string;
  City?: string;
  State?: string;
  'Postal Code'?: string;
  Country?: string;
  Notes?: string;
}

/**
 * Product/Service CSV fields
 */
export interface ProductCSVRow {
  Name: string;
  Description?: string;
  SKU?: string;
  Price: string;
  Type: string; // 'Product' | 'Service'
  Active?: string; // 'Yes' | 'No'
}

// ============================================================================
// Validation Rules
// ============================================================================

/**
 * Field validation rule
 */
export interface FieldValidationRule {
  field: string;
  required: boolean;
  type: 'string' | 'number' | 'date' | 'email' | 'enum';
  pattern?: RegExp; // For string validation
  min?: number; // For number validation
  max?: number; // For number validation
  enumValues?: string[]; // For enum validation
  customValidator?: (value: string) => boolean;
  errorMessage?: string; // Custom error message
}

/**
 * Entity validation rules
 */
export interface EntityValidationRules {
  entityType: CSVEntityType;
  fields: FieldValidationRule[];
  maxFileSize: number; // In bytes (default: 10MB)
  maxRows: number; // Default: 10,000
}

// ============================================================================
// File Upload Types
// ============================================================================

/**
 * File upload constraints
 */
export interface FileUploadConstraints {
  maxFileSize: number; // 10MB in bytes
  maxRows: number; // 10,000 rows
  allowedExtensions: string[]; // ['.csv']
  allowedMimeTypes: string[]; // ['text/csv', 'application/csv']
}

/**
 * File validation result
 */
export interface FileValidationResult {
  valid: boolean;
  error?: string; // e.g., "File too large (15MB). Maximum size is 10MB."
}

// ============================================================================
// Duplicate Detection Types
// ============================================================================

/**
 * Duplicate match for warning users
 */
export interface DuplicateMatch {
  rowNumber: number;
  existingRecordId: string;
  matchScore: number; // 0-1, how similar the records are
  matchFields: string[]; // Fields that matched (e.g., ['date', 'amount', 'description'])
  existingRecord: Record<string, unknown>; // The existing record for comparison
}

/**
 * Duplicate detection result
 */
export interface DuplicateDetectionResult {
  duplicates: DuplicateMatch[];
  totalDuplicates: number;
}

// ============================================================================
// Auto-Mapping Types
// ============================================================================

/**
 * Field mapping suggestion from auto-detection
 */
export interface MappingSuggestion {
  csvColumn: string;
  suggestedField: string;
  confidence: number; // 0-1
  alternativeSuggestions?: Array<{ field: string; confidence: number }>;
}

/**
 * Auto-mapping result
 */
export interface AutoMappingResult {
  suggestions: MappingSuggestion[];
  unmappedColumns: string[]; // CSV columns we couldn't map
  unmappedFields: string[]; // Required entity fields not found in CSV
  confidence: number; // Overall confidence (0-1)
}
