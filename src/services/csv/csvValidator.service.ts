/**
 * CSV Validator Service for Graceful Books
 *
 * Handles validation of CSV imports with entity-specific rules.
 * Validates required fields, formats, and data types.
 */

import type {
  CSVEntityType,
  CSVRowError,
  CSVValidationResult,
  FieldValidationRule,
  EntityValidationRules,
  FileValidationResult,
  FileUploadConstraints,
} from '../../types/csv.types';

/**
 * CSV Validator Service
 * Validates CSV data before import
 */
export class CSVValidatorService {
  private readonly constraints: FileUploadConstraints = {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxRows: 10000,
    allowedExtensions: ['.csv'],
    allowedMimeTypes: ['text/csv', 'application/csv', 'text/plain'],
  };

  /**
   * Validate uploaded file
   */
  validateFile(file: File): FileValidationResult {
    // Check file extension
    const extension = `.${file.name.split('.').pop()?.toLowerCase()}`;
    if (!this.constraints.allowedExtensions.includes(extension)) {
      return {
        valid: false,
        error: `Invalid file type. Please upload a CSV file.`,
      };
    }

    // Check file size
    if (file.size > this.constraints.maxFileSize) {
      const maxSizeMB = this.constraints.maxFileSize / (1024 * 1024);
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      return {
        valid: false,
        error: `File too large (${fileSizeMB}MB). Maximum size is ${maxSizeMB}MB.`,
      };
    }

    // Check MIME type
    if (file.type && !this.constraints.allowedMimeTypes.includes(file.type)) {
      return {
        valid: false,
        error: `Invalid file type. Please upload a CSV file.`,
      };
    }

    return { valid: true };
  }

  /**
   * Validate CSV data rows
   */
  validateRows(
    rows: string[][],
    columnMappings: Map<string, string>,
    entityType: CSVEntityType,
    headers?: string[]
  ): CSVValidationResult {
    const errors: CSVRowError[] = [];
    const warnings: CSVRowError[] = [];
    const rules = this.getValidationRules(entityType);

    // Check row count
    if (rows.length > this.constraints.maxRows) {
      errors.push({
        rowNumber: 0,
        field: 'file',
        value: '',
        message: `Too many rows (${rows.length}). Maximum is ${this.constraints.maxRows} rows.`,
      });
      return {
        valid: false,
        errors,
        warnings,
        rowsProcessed: 0,
        validRows: 0,
        invalidRows: 0,
      };
    }

    let validRows = 0;
    let invalidRows = 0;

    // Validate each row
    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2; // +2 because row 1 is headers, and we're 0-indexed
      const row = rows[i];
      const rowErrors = this.validateRow(row, columnMappings || [], rules, rowNumber, headers);

      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
        invalidRows++;
      } else {
        validRows++;
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      rowsProcessed: rows.length,
      validRows,
      invalidRows,
    };
  }

  /**
   * Validate a single row
   */
  private validateRow(
    row: string[],
    columnMappings: Map<string, string>,
    rules: EntityValidationRules,
    rowNumber: number,
    headers?: string[]
  ): CSVRowError[] {
    const errors: CSVRowError[] = [];

    // Create field value map
    const fieldValues = new Map<string, string>();

    if (headers) {
      // Use headers to find column indices
      columnMappings.forEach((entityField, csvColumn) => {
        const columnIndex = headers.indexOf(csvColumn);
        if (columnIndex >= 0 && columnIndex < row.length) {
          fieldValues.set(entityField, row[columnIndex] || '');
        } else {
          // Field not found in headers, set empty string
          fieldValues.set(entityField, '');
        }
      });
    } else {
      // No headers provided - assume column mappings are in order matching the row
      // This is for backward compatibility when headers aren't provided
      const csvColumns = Array.from(columnMappings.keys());
      columnMappings.forEach((entityField, csvColumn) => {
        const columnIndex = csvColumns.indexOf(csvColumn);
        if (columnIndex >= 0 && columnIndex < row.length) {
          fieldValues.set(entityField, row[columnIndex] || '');
        } else {
          // Field not found in this row, set empty string
          fieldValues.set(entityField, '');
        }
      });
    }

    // Validate each field that has a rule
    for (const rule of rules.fields) {
      // Only validate if field is mapped
      if (!fieldValues.has(rule.field)) {
        // If required field is not mapped, that's an error
        if (rule.required) {
          errors.push({
            rowNumber,
            field: rule.field,
            value: '',
            message: `${rule.field} is required but not mapped`,
          });
        }
        continue;
      }

      const value = fieldValues.get(rule.field) || '';
      const error = this.validateField(value, rule, rowNumber);
      if (error) {
        errors.push(error);
      }
    }

    return errors;
  }

  /**
   * Validate a single field value
   */
  private validateField(value: string, rule: FieldValidationRule, rowNumber: number): CSVRowError | null {
    const trimmedValue = value.trim();

    // Check required
    if (rule.required && !trimmedValue) {
      return {
        rowNumber,
        field: rule.field,
        value,
        message: rule.errorMessage || `${rule.field} is required`,
      };
    }

    // Skip validation if value is empty and not required
    if (!trimmedValue && !rule.required) {
      return null;
    }

    // Type-specific validation
    switch (rule.type) {
      case 'number':
        if (!this.isValidNumber(trimmedValue)) {
          return {
            rowNumber,
            field: rule.field,
            value,
            message: rule.errorMessage || `${rule.field} must be a valid number`,
          };
        }
        if (rule.min !== undefined && parseFloat(trimmedValue) < rule.min) {
          return {
            rowNumber,
            field: rule.field,
            value,
            message: `${rule.field} must be at least ${rule.min}`,
          };
        }
        if (rule.max !== undefined && parseFloat(trimmedValue) > rule.max) {
          return {
            rowNumber,
            field: rule.field,
            value,
            message: `${rule.field} must be at most ${rule.max}`,
          };
        }
        break;

      case 'date':
        if (!this.isValidDate(trimmedValue)) {
          return {
            rowNumber,
            field: rule.field,
            value,
            message: rule.errorMessage || `${rule.field} must be a valid date (YYYY-MM-DD or MM/DD/YYYY)`,
          };
        }
        break;

      case 'email':
        if (!this.isValidEmail(trimmedValue)) {
          return {
            rowNumber,
            field: rule.field,
            value,
            message: rule.errorMessage || `${rule.field} must be a valid email address`,
          };
        }
        break;

      case 'enum':
        if (rule.enumValues && !rule.enumValues.includes(trimmedValue)) {
          return {
            rowNumber,
            field: rule.field,
            value,
            message: `${rule.field} must be one of: ${rule.enumValues.join(', ')}`,
          };
        }
        break;

      case 'string':
        if (rule.pattern && !rule.pattern.test(trimmedValue)) {
          return {
            rowNumber,
            field: rule.field,
            value,
            message: rule.errorMessage || `${rule.field} has invalid format`,
          };
        }
        break;
    }

    // Custom validator
    if (rule.customValidator && !rule.customValidator(trimmedValue)) {
      return {
        rowNumber,
        field: rule.field,
        value,
        message: rule.errorMessage || `${rule.field} failed validation`,
      };
    }

    return null;
  }

  /**
   * Check if value is a valid number
   */
  private isValidNumber(value: string): boolean {
    const num = parseFloat(value.replace(/,/g, '')); // Remove commas
    return !isNaN(num) && isFinite(num);
  }

  /**
   * Check if value is a valid date
   * Supports: YYYY-MM-DD and MM/DD/YYYY
   */
  private isValidDate(value: string): boolean {
    // Try ISO format (YYYY-MM-DD)
    const isoPattern = /^\d{4}-\d{2}-\d{2}$/;
    if (isoPattern.test(value)) {
      const date = new Date(value);
      return !isNaN(date.getTime());
    }

    // Try US format (MM/DD/YYYY)
    const usPattern = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
    if (usPattern.test(value)) {
      const parts = value.split('/');
      const month = parseInt(parts[0] || '0', 10);
      const day = parseInt(parts[1] || '0', 10);
      const year = parseInt(parts[2] || '0', 10);
      const date = new Date(year, month - 1, day);
      return !isNaN(date.getTime()) && date.getMonth() === month - 1;
    }

    return false;
  }

  /**
   * Check if value is a valid email
   */
  private isValidEmail(value: string): boolean {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailPattern.test(value);
  }

  /**
   * Get validation rules for entity type
   */
  private getValidationRules(entityType: CSVEntityType): EntityValidationRules {
    switch (entityType) {
      case 'transactions':
        return this.getTransactionRules();
      case 'invoices':
        return this.getInvoiceRules();
      case 'bills':
        return this.getBillRules();
      case 'contacts':
        return this.getContactRules();
      case 'products':
        return this.getProductRules();
      default:
        throw new Error(`Unsupported entity type: ${entityType}`);
    }
  }

  /**
   * Transaction validation rules
   */
  private getTransactionRules(): EntityValidationRules {
    return {
      entityType: 'transactions',
      maxFileSize: this.constraints.maxFileSize,
      maxRows: this.constraints.maxRows,
      fields: [
        {
          field: 'Date',
          required: true,
          type: 'date',
          errorMessage: 'Date is required and must be in YYYY-MM-DD or MM/DD/YYYY format',
        },
        {
          field: 'Description',
          required: false,
          type: 'string',
        },
        {
          field: 'Amount',
          required: true,
          type: 'number',
          errorMessage: 'Amount is required and must be a valid number',
        },
        {
          field: 'Account',
          required: true,
          type: 'string',
          errorMessage: 'Account is required',
        },
        {
          field: 'Category',
          required: false,
          type: 'string',
        },
        {
          field: 'Notes',
          required: false,
          type: 'string',
        },
      ],
    };
  }

  /**
   * Invoice validation rules
   */
  private getInvoiceRules(): EntityValidationRules {
    return {
      entityType: 'invoices',
      maxFileSize: this.constraints.maxFileSize,
      maxRows: this.constraints.maxRows,
      fields: [
        {
          field: 'Invoice Number',
          required: true,
          type: 'string',
        },
        {
          field: 'Customer',
          required: true,
          type: 'string',
        },
        {
          field: 'Date',
          required: true,
          type: 'date',
        },
        {
          field: 'Amount',
          required: true,
          type: 'number',
        },
        {
          field: 'Status',
          required: true,
          type: 'enum',
          enumValues: ['Paid', 'Unpaid', 'Partial', 'Overdue', 'Draft'],
        },
        {
          field: 'Due Date',
          required: true,
          type: 'date',
        },
        {
          field: 'Notes',
          required: false,
          type: 'string',
        },
      ],
    };
  }

  /**
   * Bill validation rules
   */
  private getBillRules(): EntityValidationRules {
    return {
      entityType: 'bills',
      maxFileSize: this.constraints.maxFileSize,
      maxRows: this.constraints.maxRows,
      fields: [
        {
          field: 'Bill Number',
          required: true,
          type: 'string',
        },
        {
          field: 'Vendor',
          required: true,
          type: 'string',
        },
        {
          field: 'Date',
          required: true,
          type: 'date',
        },
        {
          field: 'Amount',
          required: true,
          type: 'number',
        },
        {
          field: 'Status',
          required: true,
          type: 'enum',
          enumValues: ['Paid', 'Unpaid', 'Overdue', 'Draft'],
        },
        {
          field: 'Due Date',
          required: true,
          type: 'date',
        },
        {
          field: 'Notes',
          required: false,
          type: 'string',
        },
      ],
    };
  }

  /**
   * Contact validation rules
   */
  private getContactRules(): EntityValidationRules {
    return {
      entityType: 'contacts',
      maxFileSize: this.constraints.maxFileSize,
      maxRows: this.constraints.maxRows,
      fields: [
        {
          field: 'Name',
          required: true,
          type: 'string',
        },
        {
          field: 'Email',
          required: false,
          type: 'email',
        },
        {
          field: 'Phone',
          required: false,
          type: 'string',
        },
        {
          field: 'Type',
          required: true,
          type: 'enum',
          enumValues: ['Customer', 'Vendor', 'Both'],
        },
        {
          field: 'Address',
          required: false,
          type: 'string',
        },
        {
          field: 'City',
          required: false,
          type: 'string',
        },
        {
          field: 'State',
          required: false,
          type: 'string',
        },
        {
          field: 'Postal Code',
          required: false,
          type: 'string',
        },
        {
          field: 'Country',
          required: false,
          type: 'string',
        },
        {
          field: 'Notes',
          required: false,
          type: 'string',
        },
      ],
    };
  }

  /**
   * Product validation rules
   */
  private getProductRules(): EntityValidationRules {
    return {
      entityType: 'products',
      maxFileSize: this.constraints.maxFileSize,
      maxRows: this.constraints.maxRows,
      fields: [
        {
          field: 'Name',
          required: true,
          type: 'string',
        },
        {
          field: 'Description',
          required: false,
          type: 'string',
        },
        {
          field: 'SKU',
          required: false,
          type: 'string',
        },
        {
          field: 'Price',
          required: true,
          type: 'number',
          min: 0,
        },
        {
          field: 'Type',
          required: true,
          type: 'enum',
          enumValues: ['Product', 'Service'],
        },
        {
          field: 'Active',
          required: false,
          type: 'enum',
          enumValues: ['Yes', 'No', 'yes', 'no', 'true', 'false', '1', '0'],
        },
      ],
    };
  }
}

// Export singleton instance
export const csvValidatorService = new CSVValidatorService();
