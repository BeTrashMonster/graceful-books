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
export function extractBackupIds(backupData: DatabaseExport): Record<string, Set<string>> {
  const backupIdsByTable: Record<string, Set<string>> = {};

  // Handle v3 tables format
  if (backupData.tables) {
    for (const [tableName, tableData] of Object.entries(backupData.tables)) {
      if (Array.isArray(tableData)) {
        backupIdsByTable[tableName] = new Set(
          tableData.map((r: Record<string, unknown>) => String(r.id)).filter(Boolean)
        );
      }
    }
  }
  // Handle v1/v2 data format
  else if (backupData.data) {
    const data = backupData.data as Record<string, unknown[]>;
    for (const [tableName, tableData] of Object.entries(data)) {
      if (Array.isArray(tableData)) {
        backupIdsByTable[tableName] = new Set(
          tableData.map((r: Record<string, unknown>) => String(r.id)).filter(Boolean)
        );
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
 * Compute which records in current DB are missing from backup
 *
 * @param backupData - The decrypted backup data
 * @param companyId - Optional company ID to filter current records
 * @returns Summary of missing records by table
 */
export async function computeMissingRecords(
  backupData: DatabaseExport,
  companyId?: string
): Promise<MissingRecordsSummary> {
  const summary: MissingRecordsSummary = {
    byTable: {},
    totalMissing: 0,
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
      }
    } catch {
      // Table doesn't exist or error reading - skip silently
    }
  }

  return summary;
}
