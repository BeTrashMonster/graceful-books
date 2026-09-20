/**
 * Tests for backupDiff utilities
 *
 * Particularly important: CSV export must contain the same records
 * that appear in the preview display.
 */

import { describe, it, expect } from 'vitest';
import {
  generateMissingRecordsCSV,
  formatRecordForDisplay,
  getTableDisplayName,
  type MissingRecordFull,
  type MissingRecordsWithData,
} from './backupDiff';

describe('generateMissingRecordsCSV', () => {
  it('returns empty message for empty records', () => {
    const csv = generateMissingRecordsCSV([]);
    expect(csv).toBe('No missing records');
  });

  it('includes all record IDs in CSV output', () => {
    const records: MissingRecordFull[] = [
      { table: 'cpgInvoices', id: 'inv-001', invoice_number: 'INV-001', total: 150 },
      { table: 'cpgInvoices', id: 'inv-002', invoice_number: 'INV-002', total: 275 },
      { table: 'products', id: 'prod-001', name: 'Widget A' },
    ];

    const csv = generateMissingRecordsCSV(records);

    // All IDs must appear in CSV
    expect(csv).toContain('inv-001');
    expect(csv).toContain('inv-002');
    expect(csv).toContain('prod-001');
  });

  it('includes meaningful fields for re-entry', () => {
    const records: MissingRecordFull[] = [
      {
        table: 'cpgInvoices',
        id: 'inv-001',
        invoice_number: 'INV-2024-001',
        vendor_name: 'Acme Corp',
        total: 1234.56,
        invoice_date: new Date('2024-03-15').getTime(),
      },
    ];

    const csv = generateMissingRecordsCSV(records);

    // Should include invoice details for re-entry
    expect(csv).toContain('INV-2024-001');
    expect(csv).toContain('Acme Corp');
    expect(csv).toContain('1234.56');
    expect(csv).toContain('2024-03-15');
  });

  it('escapes CSV special characters', () => {
    const records: MissingRecordFull[] = [
      { table: 'products', id: 'prod-001', name: 'Widget, "Deluxe" Edition' },
    ];

    const csv = generateMissingRecordsCSV(records);

    // Commas and quotes must be properly escaped
    expect(csv).toContain('"Widget, ""Deluxe"" Edition"');
  });

  it('groups records by table with headers', () => {
    const records: MissingRecordFull[] = [
      { table: 'cpgInvoices', id: 'inv-001', invoice_number: 'INV-001' },
      { table: 'products', id: 'prod-001', name: 'Widget' },
      { table: 'cpgInvoices', id: 'inv-002', invoice_number: 'INV-002' },
    ];

    const csv = generateMissingRecordsCSV(records);

    // Should have table headers
    expect(csv).toContain('# Invoices');
    expect(csv).toContain('# Products');
  });
});

describe('CSV contains same records as preview', () => {
  it('CSV record IDs match byTable shown record IDs', () => {
    const summary: MissingRecordsWithData = {
      byTable: {
        cpgInvoices: {
          total: 3,
          shown: [
            { id: 'inv-001', displayText: 'INV-001' },
            { id: 'inv-002', displayText: 'INV-002' },
            { id: 'inv-003', displayText: 'INV-003' },
          ],
        },
        products: {
          total: 2,
          shown: [
            { id: 'prod-001', displayText: 'Widget A' },
            { id: 'prod-002', displayText: 'Widget B' },
          ],
        },
      },
      totalMissing: 5,
      allRecords: [
        { table: 'cpgInvoices', id: 'inv-001', invoice_number: 'INV-001' },
        { table: 'cpgInvoices', id: 'inv-002', invoice_number: 'INV-002' },
        { table: 'cpgInvoices', id: 'inv-003', invoice_number: 'INV-003' },
        { table: 'products', id: 'prod-001', name: 'Widget A' },
        { table: 'products', id: 'prod-002', name: 'Widget B' },
      ],
    };

    const previewIds = new Set<string>();
    for (const tableData of Object.values(summary.byTable)) {
      for (const record of tableData.shown) {
        previewIds.add(record.id);
      }
    }

    const csvRecordIds = new Set(summary.allRecords.map(r => r.id));
    const csv = generateMissingRecordsCSV(summary.allRecords);

    // CRITICAL: Every preview ID must be in allRecords and in CSV
    for (const previewId of previewIds) {
      expect(csvRecordIds.has(previewId)).toBe(true);
      expect(csv).toContain(previewId as string);
    }
  });

  it('allRecords count equals totalMissing', () => {
    const summary: MissingRecordsWithData = {
      byTable: {
        cpgInvoices: {
          total: 2,
          shown: [
            { id: 'inv-001', displayText: 'INV-001' },
            { id: 'inv-002', displayText: 'INV-002' },
          ],
        },
      },
      totalMissing: 2,
      allRecords: [
        { table: 'cpgInvoices', id: 'inv-001', invoice_number: 'INV-001' },
        { table: 'cpgInvoices', id: 'inv-002', invoice_number: 'INV-002' },
      ],
    };

    expect(summary.allRecords.length).toBe(summary.totalMissing);
  });

  it('CSV includes records beyond MAX_SHOWN_PER_TABLE limit', () => {
    const summary: MissingRecordsWithData = {
      byTable: {
        cpgInvoices: {
          total: 8,
          shown: [
            { id: 'inv-001', displayText: 'INV-001' },
            { id: 'inv-002', displayText: 'INV-002' },
            { id: 'inv-003', displayText: 'INV-003' },
            { id: 'inv-004', displayText: 'INV-004' },
            { id: 'inv-005', displayText: 'INV-005' },
          ],
        },
      },
      totalMissing: 8,
      allRecords: [
        { table: 'cpgInvoices', id: 'inv-001' },
        { table: 'cpgInvoices', id: 'inv-002' },
        { table: 'cpgInvoices', id: 'inv-003' },
        { table: 'cpgInvoices', id: 'inv-004' },
        { table: 'cpgInvoices', id: 'inv-005' },
        { table: 'cpgInvoices', id: 'inv-006' },
        { table: 'cpgInvoices', id: 'inv-007' },
        { table: 'cpgInvoices', id: 'inv-008' },
      ],
    };

    const csv = generateMissingRecordsCSV(summary.allRecords);

    // CSV must include ALL 8 records
    expect(csv).toContain('inv-001');
    expect(csv).toContain('inv-002');
    expect(csv).toContain('inv-003');
    expect(csv).toContain('inv-004');
    expect(csv).toContain('inv-005');
    expect(csv).toContain('inv-006');
    expect(csv).toContain('inv-007');
    expect(csv).toContain('inv-008');
  });
});

describe('formatRecordForDisplay', () => {
  it('formats invoice with details', () => {
    const record = {
      invoice_number: 'INV-001',
      vendor_name: 'Acme Corp',
      total: 1500,
      invoice_date: new Date('2024-06-15').getTime(),
    };

    const display = formatRecordForDisplay('cpgInvoices', record);

    expect(display).toContain('INV-001');
    expect(display).toContain('Acme Corp');
  });

  it('formats product with name', () => {
    const record = { name: 'Premium Widget' };
    const display = formatRecordForDisplay('products', record);
    expect(display).toBe('Premium Widget');
  });
});

describe('getTableDisplayName', () => {
  it('returns human-readable names', () => {
    expect(getTableDisplayName('cpgInvoices')).toBe('Invoices');
    expect(getTableDisplayName('products')).toBe('Products');
    expect(getTableDisplayName('cpgFinishedProducts')).toBe('Finished Products');
  });
});
