/**
 * Backup Diff Utilities
 *
 * Computes differences between backup data and current database.
 * Used by the preview feature to show which records would be lost on restore.
 */

import { db } from '../../db';
import type { DatabaseExport } from '../../db';

/**
 * A single missing record with identifying details
 */
export interface MissingRecord {
  id: string;
  displayText: string;
}

/**
 * Summary of records that exist in current DB but not in backup
 */
export interface MissingRecordsSummary {
  /** Per-table list of missing records */
  byTable: Record<string, {
    total: number;
    shown: MissingRecord[];
  }>;
  /** Total missing across all tables */
  totalMissing: number;
}

/**
 * Format a record for display based on its table type
 */
export function formatRecordForDisplay(tableName: string, record: Record<string, unknown>): string {
  switch (tableName) {
    case 'cpgInvoices': {
      const num = record.invoice_number || record.invoiceNumber || 'Unknown';
      const vendor = record.vendor_name || record.vendorName || '';
      const amount = typeof record.total === 'number' ? `$${record.total.toLocaleString()}` : '';
      const date = record.invoice_date || record.invoiceDate;
      const dateStr = date ? new Date(date as number).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
      return [num, vendor, amount, dateStr].filter(Boolean).join(' — ');
    }
    case 'products':
    case 'cpgFinishedProducts': {
      return String(record.name || record.product_name || 'Unnamed product');
    }
    case 'cpgCategories': {
      return String(record.name || record.category_name || 'Unnamed category');
    }
    case 'cpgVendors': {
      return String(record.name || record.vendor_name || 'Unnamed vendor');
    }
    case 'cpgRecipes': {
      return String(record.name || record.recipe_name || 'Unnamed recipe');
    }
    case 'contacts': {
      return String(record.name || record.contact_name || 'Unnamed contact');
    }
    case 'accounts': {
      const num = record.accountNumber || record.account_number || '';
      const name = record.name || '';
      return num ? `${num} — ${name}` : String(name);
    }
    case 'transactions': {
      const date = record.date || record.transaction_date;
      const dateStr = date ? new Date(date as number).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
      const desc = record.description || record.memo || '';
      const amount = typeof record.amount === 'number' ? `$${Math.abs(record.amount).toLocaleString()}` : '';
      return [dateStr, desc, amount].filter(Boolean).join(' — ') || 'Transaction';
    }
    default: {
      return String(record.name || record.title || record.id || 'Record');
    }
  }
}

/**
 * Tables that contain user-meaningful data worth diffing
 */
export const TABLES_TO_DIFF = [
  'cpgInvoices', 'products', 'cpgFinishedProducts', 'cpgCategories',
  'cpgVendors', 'cpgRecipes', 'contacts', 'accounts', 'transactions'
];

/**
 * Maximum records to show per table in the summary
 */
export const MAX_SHOWN_PER_TABLE = 5;

/**
 * Extract record IDs from backup data by table
 */
/**
 * Safely extract ID from a backup record
 * Returns the ID as a string, or null if missing/invalid
 */
function extractId(record: unknown): string | null {
  if (record === null || typeof record !== 'object') {
    return null;
  }
  const r = record as Record<string, unknown>;
  const id = r.id;
  if (id === undefined || id === null || id === '') {
    return null;
  }
  return String(id);
}

export function extractBackupIds(backupData: DatabaseExport): Record<string, Set<string>> {
  const backupIdsByTable: Record<string, Set<string>> = {};

  // Handle v3 tables format
  if (backupData.tables) {
    for (const [tableName, tableData] of Object.entries(backupData.tables)) {
      if (Array.isArray(tableData)) {
        const ids = tableData
          .map(extractId)
          .filter((id): id is string => id !== null);
        backupIdsByTable[tableName] = new Set(ids);
      }
    }
  }
  // Handle v1/v2 data format
  else if (backupData.data) {
    const data = backupData.data as Record<string, unknown[]>;
    for (const [tableName, tableData] of Object.entries(data)) {
      if (Array.isArray(tableData)) {
        const ids = tableData
          .map(extractId)
          .filter((id): id is string => id !== null);
        backupIdsByTable[tableName] = new Set(ids);
      }
    }
  }

  return backupIdsByTable;
}

/**
 * Get human-readable table name
 */
export function getTableDisplayName(tableName: string): string {
  const names: Record<string, string> = {
    cpgInvoices: 'Invoices',
    products: 'Products',
    cpgFinishedProducts: 'Finished Products',
    cpgCategories: 'Categories',
    cpgVendors: 'Vendors',
    cpgRecipes: 'Recipes',
    contacts: 'Contacts',
    accounts: 'Accounts',
    transactions: 'Transactions',
  };
  return names[tableName] || tableName.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^cpg/i, '');
}

/**
 * Full record data for CSV export
 */
export interface MissingRecordFull {
  table: string;
  id: string;
  [key: string]: unknown;
}

/**
 * Extended summary that includes full record data for CSV export
 */
export interface MissingRecordsWithData extends MissingRecordsSummary {
  /** Full record data for CSV export */
  allRecords: MissingRecordFull[];
}

/**
 * Compute which records in current DB are missing from backup
 *
 * @param backupData - The decrypted backup data
 * @param companyId - Optional company ID to filter current records
 * @returns Summary of missing records by table
 */
export async function computeMissingRecords(
  backupData: DatabaseExport,
  companyId?: string
): Promise<MissingRecordsWithData> {
  const summary: MissingRecordsWithData = {
    byTable: {},
    totalMissing: 0,
    allRecords: [],
  };

  const backupIdsByTable = extractBackupIds(backupData);

  // For each table, find records in current DB but not in backup
  for (const tableName of TABLES_TO_DIFF) {
    try {
      const table = db.table(tableName);
      if (!table) continue;

      let currentRecords: Record<string, unknown>[];

      // Filter by companyId if provided
      if (companyId) {
        const all = await table.toArray();
        currentRecords = all.filter((r: Record<string, unknown>) =>
          r.company_id === companyId || r.companyId === companyId
        );
      } else {
        currentRecords = await table.toArray();
      }

      const backupIds = backupIdsByTable[tableName] || new Set<string>();
      const missing = currentRecords.filter(r => !backupIds.has(String(r.id)));

      if (missing.length > 0) {
        // Show up to MAX_SHOWN_PER_TABLE with identifying details
        const shown = missing.slice(0, MAX_SHOWN_PER_TABLE).map(r => ({
          id: String(r.id),
          displayText: formatRecordForDisplay(tableName, r),
        }));

        summary.byTable[tableName] = {
          total: missing.length,
          shown,
        };
        summary.totalMissing += missing.length;

        // Store full records for CSV export
        for (const record of missing) {
          summary.allRecords.push({
            table: tableName,
            id: String(record.id),
            ...record,
          });
        }
      }
    } catch {
      // Table doesn't exist or error reading - skip silently
    }
  }

  return summary;
}

/**
 * CSV field definitions per table type
 * These are the fields most useful for re-entering records manually
 */
const CSV_FIELDS_BY_TABLE: Record<string, string[]> = {
  cpgInvoices: ['invoice_number', 'invoiceNumber', 'vendor_name', 'vendorName', 'total', 'invoice_date', 'invoiceDate', 'notes', 'line_items', 'lineItems'],
  products: ['name', 'sku', 'description', 'price', 'cost', 'unit'],
  cpgFinishedProducts: ['name', 'product_name', 'sku', 'description', 'price', 'cost', 'unit', 'recipe_id', 'recipeId'],
  cpgCategories: ['name', 'category_name', 'description'],
  cpgVendors: ['name', 'vendor_name', 'contact_name', 'contactName', 'email', 'phone', 'address'],
  cpgRecipes: ['name', 'recipe_name', 'description', 'yield_quantity', 'yieldQuantity', 'yield_unit', 'yieldUnit', 'ingredients'],
  contacts: ['name', 'contact_name', 'email', 'phone', 'company', 'address', 'type'],
  accounts: ['accountNumber', 'account_number', 'name', 'type', 'description', 'parentId', 'parent_id'],
  transactions: ['date', 'transaction_date', 'description', 'memo', 'amount', 'account_id', 'accountId', 'type'],
};

/**
 * Escape a value for CSV (handle quotes and commas)
 */
function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  // Stringify objects/arrays
  const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
  // If contains comma, newline, or quote, wrap in quotes and escape internal quotes
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Format date values to readable format
 */
function formatDateValue(value: unknown): string {
  if (typeof value === 'number' && value > 946684800000) { // After year 2000
    try {
      const isoString = new Date(value).toISOString();
      return isoString.split('T')[0] ?? isoString;
    } catch {
      return String(value);
    }
  }
  return String(value ?? '');
}

/**
 * Generate CSV content from missing records
 *
 * @param records - Full missing records with table info
 * @returns CSV string with headers
 */
export function generateMissingRecordsCSV(records: MissingRecordFull[]): string {
  if (records.length === 0) {
    return 'No missing records';
  }

  // Group records by table to organize output
  const byTable = new Map<string, MissingRecordFull[]>();
  for (const record of records) {
    const existing = byTable.get(record.table) || [];
    existing.push(record);
    byTable.set(record.table, existing);
  }

  const lines: string[] = [];

  // Header explaining the file
  lines.push('# Records not in backup - for manual re-entry');
  lines.push('# This file lists records that exist on your device but not in the backup.');
  lines.push('# You can use this information to re-enter these records after restoring.');
  lines.push('');

  // Process each table
  for (const [tableName, tableRecords] of byTable) {
    const displayName = getTableDisplayName(tableName);
    lines.push(`# ${displayName} (${tableRecords.length})`);

    // Get fields for this table type
    const fieldDefs = CSV_FIELDS_BY_TABLE[tableName] || ['id', 'name'];

    // Collect all actual fields present in records
    const actualFields = new Set<string>();
    actualFields.add('id');
    for (const record of tableRecords) {
      for (const field of fieldDefs) {
        if (record[field] !== undefined && record[field] !== null) {
          actualFields.add(field);
        }
      }
    }
    const headers = Array.from(actualFields);

    // Write headers
    lines.push(headers.join(','));

    // Write data rows
    for (const record of tableRecords) {
      const values = headers.map(field => {
        const value = record[field];
        // Format dates nicely
        if (field.toLowerCase().includes('date')) {
          return escapeCSV(formatDateValue(value));
        }
        return escapeCSV(value);
      });
      lines.push(values.join(','));
    }

    lines.push(''); // Blank line between tables
  }

  return lines.join('\n');
}

/**
 * Download missing records as CSV file
 *
 * @param records - Full missing records with table info
 */
export function downloadMissingRecordsCSV(records: MissingRecordFull[]): void {
  const csv = generateMissingRecordsCSV(records);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `records-not-in-backup-${timestamp}.csv`;

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}
