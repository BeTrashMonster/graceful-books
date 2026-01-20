/**
 * CSV Importer Service for Graceful Books
 *
 * Handles CSV file parsing, column mapping, duplicate detection, and data import.
 * Supports dry-run mode for validation before actual import.
 */

import type {
  CSVEntityType,
  CSVParseResult,
  CSVImportConfig,
  CSVImportResult,
  ColumnMapping,
  AutoMappingResult,
  MappingSuggestion,
  DuplicateDetectionResult,
  DuplicateMatch,
} from '../../types/csv.types';
import { csvValidatorService } from './csvValidator.service';

/**
 * CSV Importer Service
 * Parses CSV files and imports data with validation and duplicate detection
 */
export class CSVImporterService {
  /**
   * Parse CSV file content
   */
  async parseCSV(file: File): Promise<CSVParseResult> {
    try {
      const content = await this.readFileContent(file);
      const lines = this.parseLines(content);

      if (lines.length === 0) {
        return {
          success: false,
          headers: [],
          rows: [],
          totalRows: 0,
          preview: [],
          error: 'File is empty',
        };
      }

      // First line is headers
      const headers = lines[0];
      const rows = lines.slice(1);

      // Get preview (first 10 rows)
      const preview = rows.slice(0, 10);

      return {
        success: true,
        headers,
        rows,
        totalRows: rows.length,
        preview,
      };
    } catch (error) {
      return {
        success: false,
        headers: [],
        rows: [],
        totalRows: 0,
        preview: [],
        error: error instanceof Error ? error.message : 'Failed to parse CSV file',
      };
    }
  }

  /**
   * Read file content as text
   */
  private readFileContent(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result;
        if (typeof content === 'string') {
          resolve(content);
        } else {
          reject(new Error('Failed to read file content'));
        }
      };
      reader.onerror = () => reject(new Error('File reading failed'));
      reader.readAsText(file);
    });
  }

  /**
   * Parse CSV content into lines (RFC 4180 compliant)
   */
  private parseLines(content: string): string[][] {
    const lines: string[][] = [];
    let currentLine: string[] = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      const nextChar = i < content.length - 1 ? content[i + 1] : '';

      if (inQuotes) {
        if (char === '"') {
          if (nextChar === '"') {
            // Escaped quote
            currentField += '"';
            i++; // Skip next quote
          } else {
            // End of quoted field
            inQuotes = false;
          }
        } else {
          currentField += char;
        }
      } else {
        if (char === '"') {
          // Start of quoted field
          inQuotes = true;
        } else if (char === ',') {
          // End of field
          currentLine.push(currentField);
          currentField = '';
        } else if (char === '\n') {
          // End of line
          currentLine.push(currentField);
          if (currentLine.some((field) => field.trim() !== '')) {
            lines.push(currentLine);
          }
          currentLine = [];
          currentField = '';
        } else if (char === '\r') {
          // Skip carriage return (will be followed by \n)
          continue;
        } else {
          currentField += char;
        }
      }
    }

    // Add last field and line if not empty
    if (currentField || currentLine.length > 0) {
      currentLine.push(currentField);
      if (currentLine.some((field) => field.trim() !== '')) {
        lines.push(currentLine);
      }
    }

    return lines;
  }

  /**
   * Auto-detect column mappings based on headers
   */
  autoMapColumns(headers: string[], entityType: CSVEntityType): AutoMappingResult {
    const suggestions: MappingSuggestion[] = [];
    const expectedFields = this.getExpectedFields(entityType);
    const unmappedColumns: string[] = [];
    const mappedFields = new Set<string>();

    // Try to map each header
    for (const header of headers) {
      const suggestion = this.findBestMatch(header, expectedFields);
      if (suggestion && suggestion.confidence > 0.5) {
        suggestions.push({
          csvColumn: header,
          suggestedField: suggestion.field,
          confidence: suggestion.confidence,
          alternativeSuggestions: suggestion.alternatives,
        });
        mappedFields.add(suggestion.field);
      } else {
        unmappedColumns.push(header);
      }
    }

    // Find unmapped required fields
    const unmappedFields = expectedFields.filter((field) => !mappedFields.has(field));

    // Calculate overall confidence
    const confidence = suggestions.length > 0 ? suggestions.reduce((sum, s) => sum + s.confidence, 0) / suggestions.length : 0;

    return {
      suggestions,
      unmappedColumns,
      unmappedFields,
      confidence,
    };
  }

  /**
   * Find best matching field for a CSV column header
   */
  private findBestMatch(
    header: string,
    expectedFields: string[]
  ): { field: string; confidence: number; alternatives: Array<{ field: string; confidence: number }> } | null {
    const normalizedHeader = header.toLowerCase().trim();
    const matches: Array<{ field: string; confidence: number }> = [];

    for (const field of expectedFields) {
      const normalizedField = field.toLowerCase();

      // Exact match
      if (normalizedHeader === normalizedField) {
        return { field, confidence: 1.0, alternatives: [] };
      }

      // Contains match
      if (normalizedHeader.includes(normalizedField) || normalizedField.includes(normalizedHeader)) {
        matches.push({ field, confidence: 0.8 });
        continue;
      }

      // Common aliases
      const aliases = this.getFieldAliases(field);
      for (const alias of aliases) {
        if (normalizedHeader === alias.toLowerCase()) {
          matches.push({ field, confidence: 0.9 });
          break;
        }
        if (normalizedHeader.includes(alias.toLowerCase()) || alias.toLowerCase().includes(normalizedHeader)) {
          matches.push({ field, confidence: 0.7 });
          break;
        }
      }
    }

    if (matches.length === 0) {
      return null;
    }

    // Sort by confidence
    matches.sort((a, b) => b.confidence - a.confidence);

    return {
      field: matches[0].field,
      confidence: matches[0].confidence,
      alternatives: matches.slice(1, 3), // Top 2 alternatives
    };
  }

  /**
   * Get common aliases for field names
   */
  private getFieldAliases(field: string): string[] {
    const aliasMap: Record<string, string[]> = {
      Date: ['date', 'transaction date', 'trans date', 'dt'],
      Description: ['description', 'desc', 'memo', 'details', 'note'],
      Amount: ['amount', 'amt', 'total', 'value'],
      Account: ['account', 'acct', 'account name'],
      Category: ['category', 'cat', 'class'],
      Notes: ['notes', 'note', 'memo', 'comments'],
      'Invoice Number': ['invoice number', 'invoice #', 'inv #', 'invoice no', 'number'],
      Customer: ['customer', 'client', 'customer name'],
      Status: ['status', 'state'],
      'Due Date': ['due date', 'due', 'payment due'],
      'Bill Number': ['bill number', 'bill #', 'bill no'],
      Vendor: ['vendor', 'supplier', 'vendor name'],
      Name: ['name', 'company name', 'business name'],
      Email: ['email', 'e-mail', 'email address'],
      Phone: ['phone', 'telephone', 'phone number', 'tel'],
      Type: ['type', 'contact type'],
      Address: ['address', 'street', 'street address', 'address 1'],
      City: ['city', 'town'],
      State: ['state', 'province', 'region'],
      'Postal Code': ['postal code', 'zip', 'zip code', 'postcode'],
      Country: ['country', 'nation'],
      SKU: ['sku', 'product code', 'item code'],
      Price: ['price', 'rate', 'unit price'],
      Active: ['active', 'status', 'enabled'],
    };

    return aliasMap[field] || [];
  }

  /**
   * Get expected fields for entity type
   */
  private getExpectedFields(entityType: CSVEntityType): string[] {
    switch (entityType) {
      case 'transactions':
        return ['Date', 'Description', 'Amount', 'Account', 'Category', 'Notes'];
      case 'invoices':
        return ['Invoice Number', 'Customer', 'Date', 'Amount', 'Status', 'Due Date', 'Notes'];
      case 'bills':
        return ['Bill Number', 'Vendor', 'Date', 'Amount', 'Status', 'Due Date', 'Notes'];
      case 'contacts':
        return ['Name', 'Email', 'Phone', 'Type', 'Address', 'City', 'State', 'Postal Code', 'Country', 'Notes'];
      case 'products':
        return ['Name', 'Description', 'SKU', 'Price', 'Type', 'Active'];
      default:
        return [];
    }
  }

  /**
   * Import CSV data
   */
  async importCSV(config: CSVImportConfig, rows: string[][]): Promise<CSVImportResult> {
    try {
      // Create column mapping map
      const columnMap = new Map<string, string>();
      config.columnMappings.forEach((mapping) => {
        columnMap.set(mapping.csvColumn, mapping.entityField);
      });

      // Extract headers and data rows
      let headers: string[] | undefined;
      let dataRows: string[][];

      if (config.skipFirstRow !== false) {
        // Default is to skip first row (treat as headers)
        headers = rows[0] || [];
        dataRows = rows.slice(1);
      } else {
        // Don't skip first row - no headers
        headers = undefined;
        dataRows = rows;
      }

      // Validate rows
      const validation = csvValidatorService.validateRows(dataRows, columnMap, config.entityType, headers);

      if (!validation.valid && config.mode === 'import') {
        return {
          success: false,
          validation,
          imported: 0,
          skipped: validation.invalidRows,
          updated: 0,
          error: `Validation failed with ${validation.errors.length} errors`,
        };
      }

      // Dry run mode - just return validation
      if (config.mode === 'dryRun') {
        return {
          success: validation.valid,
          validation,
          imported: 0,
          skipped: 0,
          updated: 0,
        };
      }

      // Import mode - detect duplicates if enabled
      let duplicates: DuplicateDetectionResult = { duplicates: [], totalDuplicates: 0 };
      if (config.detectDuplicates) {
        duplicates = await this.detectDuplicates(dataRows, columnMap, config.entityType);
      }

      // Process imports
      let imported = 0;
      let skipped = 0;
      let updated = 0;

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];

        // Skip invalid rows
        const hasError = validation.errors.some((err) => err.rowNumber === i + 2);
        if (hasError) {
          skipped++;
          continue;
        }

        // Check for duplicate
        const isDuplicate = duplicates.duplicates.some((dup) => dup.rowNumber === i + 2);
        if (isDuplicate) {
          if (config.onDuplicateAction === 'skip') {
            skipped++;
            continue;
          } else if (config.onDuplicateAction === 'update') {
            // TODO: Implement update logic
            updated++;
            continue;
          }
        }

        // Import row
        await this.importRow(row, columnMap, config.entityType);
        imported++;
      }

      return {
        success: true,
        validation,
        imported,
        skipped,
        updated,
      };
    } catch (error) {
      return {
        success: false,
        validation: {
          valid: false,
          errors: [],
          warnings: [],
          rowsProcessed: 0,
          validRows: 0,
          invalidRows: 0,
        },
        imported: 0,
        skipped: 0,
        updated: 0,
        error: error instanceof Error ? error.message : 'Import failed',
      };
    }
  }

  /**
   * Detect duplicate records
   */
  private async detectDuplicates(
    _rows: string[][],
    _columnMap: Map<string, string>,
    _entityType: CSVEntityType
  ): Promise<DuplicateDetectionResult> {
    // TODO: Implement duplicate detection logic
    // This would query the database for similar records
    return {
      duplicates: [],
      totalDuplicates: 0,
    };
  }

  /**
   * Import a single row
   */
  private async importRow(_row: string[], _columnMap: Map<string, string>, _entityType: CSVEntityType): Promise<void> {
    // TODO: Implement actual import logic
    // This would create the entity in the database
    // For now, this is a placeholder
  }

  /**
   * Convert column mappings array to ColumnMapping objects
   */
  createColumnMappings(suggestions: MappingSuggestion[]): ColumnMapping[] {
    return suggestions.map((suggestion) => ({
      csvColumn: suggestion.csvColumn,
      entityField: suggestion.suggestedField,
      confidence: suggestion.confidence,
    }));
  }
}

// Export singleton instance
export const csvImporterService = new CSVImporterService();
