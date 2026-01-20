/**
 * CSV Exporter Service for Graceful Books
 *
 * Handles exporting transactions, invoices, bills, contacts, and products to CSV format.
 * Supports RFC 4180 CSV standard with UTF-8 encoding.
 */

import type {
  CSVExportConfig,
  CSVExportResult,
  CSVEntityType,
  DateRangePreset,
  TransactionCSVRow,
  InvoiceCSVRow,
  BillCSVRow,
  ContactCSVRow,
  ProductCSVRow,
} from '../../types/csv.types';

/**
 * CSV Exporter Service
 * Exports entity data to CSV format with customizable field selection
 */
export class CSVExporterService {
  /**
   * Export entities to CSV format
   */
  async exportToCSV(config: CSVExportConfig): Promise<CSVExportResult> {
    try {
      // Get data based on entity type
      const data = await this.fetchEntityData(config);

      if (data.length === 0) {
        return {
          success: false,
          filename: '',
          csvContent: '',
          rowCount: 0,
          error: 'No data found for the selected criteria',
        };
      }

      // Convert to CSV
      const csvContent = this.convertToCSV(data, config);

      // Generate filename
      const filename = this.generateFilename(config.entityType);

      return {
        success: true,
        filename,
        csvContent,
        rowCount: data.length,
      };
    } catch (error) {
      return {
        success: false,
        filename: '',
        csvContent: '',
        rowCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Fetch entity data based on configuration
   */
  private async fetchEntityData(config: CSVExportConfig): Promise<Record<string, unknown>[]> {
    const { entityType, dateRange, customStartDate, customEndDate } = config;

    // Calculate date range
    const { startDate, endDate } = this.calculateDateRange(dateRange, customStartDate, customEndDate);

    switch (entityType) {
      case 'transactions':
        return this.fetchTransactions(startDate, endDate);
      case 'invoices':
        return this.fetchInvoices(startDate, endDate);
      case 'bills':
        return this.fetchBills(startDate, endDate);
      case 'contacts':
        return this.fetchContacts();
      case 'products':
        return this.fetchProducts();
      default:
        throw new Error(`Unsupported entity type: ${entityType}`);
    }
  }

  /**
   * Calculate date range based on preset or custom dates
   */
  private calculateDateRange(
    preset?: DateRangePreset,
    customStart?: Date,
    customEnd?: Date
  ): { startDate: Date | null; endDate: Date | null } {
    if (preset === 'custom') {
      return {
        startDate: customStart || null,
        endDate: customEnd || null,
      };
    }

    if (!preset || preset === 'allTime') {
      return { startDate: null, endDate: null };
    }

    const now = new Date();
    const endDate = new Date(now);
    let startDate = new Date(now);

    switch (preset) {
      case 'last30':
        startDate.setDate(now.getDate() - 30);
        break;
      case 'last90':
        startDate.setDate(now.getDate() - 90);
        break;
      case 'last365':
        startDate.setDate(now.getDate() - 365);
        break;
      case 'ytd':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case 'lastYear':
        startDate = new Date(now.getFullYear() - 1, 0, 1);
        endDate.setFullYear(now.getFullYear() - 1, 11, 31);
        break;
    }

    return { startDate, endDate };
  }

  /**
   * Fetch transactions (placeholder - will integrate with actual database)
   */
  private async fetchTransactions(startDate: Date | null, endDate: Date | null): Promise<TransactionCSVRow[]> {
    // TODO: Integrate with actual transaction store
    // For now, return empty array
    return [];
  }

  /**
   * Fetch invoices (placeholder - will integrate with actual database)
   */
  private async fetchInvoices(startDate: Date | null, endDate: Date | null): Promise<InvoiceCSVRow[]> {
    // TODO: Integrate with actual invoice store
    return [];
  }

  /**
   * Fetch bills (placeholder - will integrate with actual database)
   */
  private async fetchBills(startDate: Date | null, endDate: Date | null): Promise<BillCSVRow[]> {
    // TODO: Integrate with actual bill store
    return [];
  }

  /**
   * Fetch contacts (placeholder - will integrate with actual database)
   */
  private async fetchContacts(): Promise<ContactCSVRow[]> {
    // TODO: Integrate with actual contact store
    return [];
  }

  /**
   * Fetch products (placeholder - will integrate with actual database)
   */
  private async fetchProducts(): Promise<ProductCSVRow[]> {
    // TODO: Integrate with actual product store
    return [];
  }

  /**
   * Convert data to CSV format (RFC 4180 compliant)
   */
  private convertToCSV(data: Record<string, unknown>[], config: CSVExportConfig): string {
    if (data.length === 0) {
      return '';
    }

    const { selectedFields, includeHeaders = true } = config;

    // Determine which fields to include
    const fields = selectedFields || Object.keys(data[0]);

    // Build CSV content
    const lines: string[] = [];

    // Add headers if requested
    if (includeHeaders) {
      lines.push(this.escapeCSVRow(fields));
    }

    // Add data rows
    for (const row of data) {
      const values = fields.map((field) => {
        const value = row[field];
        return value !== null && value !== undefined ? String(value) : '';
      });
      lines.push(this.escapeCSVRow(values));
    }

    return lines.join('\n');
  }

  /**
   * Escape a CSV row according to RFC 4180
   * - Fields containing comma, quote, or newline must be quoted
   * - Quotes inside fields must be doubled
   */
  private escapeCSVRow(values: string[]): string {
    return values
      .map((value) => {
        // Check if field needs quoting
        if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
          // Escape quotes by doubling them
          const escaped = value.replace(/"/g, '""');
          return `"${escaped}"`;
        }
        return value;
      })
      .join(',');
  }

  /**
   * Generate filename with timestamp
   * Format: graceful_books_[entityType]_YYYY-MM-DD.csv
   */
  private generateFilename(entityType: CSVEntityType): string {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    return `graceful_books_${entityType}_${dateStr}.csv`;
  }

  /**
   * Download CSV file in browser
   */
  downloadCSV(filename: string, csvContent: string): void {
    // Create blob with UTF-8 BOM for Excel compatibility
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

    // Create download link
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up
    URL.revokeObjectURL(url);
  }

  /**
   * Get available fields for an entity type
   */
  getAvailableFields(entityType: CSVEntityType): string[] {
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
}

// Export singleton instance
export const csvExporterService = new CSVExporterService();
