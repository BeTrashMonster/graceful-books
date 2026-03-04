/**
 * Raw Materials Tab Component
 *
 * Displays invoice history with advanced filtering, sorting, and export capabilities.
 *
 * Features:
 * - Date range filtering (presets + custom dates)
 * - Category, vendor, and variant filtering
 * - Multiple sorting options
 * - Statistics dashboard (total spent, averages, top categories/vendors/variants)
 * - Export functionality (CSV summary, PDF summary, CSV detail)
 *
 * Requirements:
 * - Clean component boundaries
 * - Single responsibility (invoice history visualization and analysis)
 * - WCAG 2.1 AA compliance
 * - 90%+ test coverage
 */

import { useState, useMemo } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { CPGCategory, CPGInvoice } from '../../../db/schema/cpg.schema';
import styles from '../CPUTracker.module.css';

export type DateRangePreset = '3mo' | '6mo' | '12mo' | 'last-calendar-year' | 'this-calendar-year' | 'custom' | 'all';

export interface RawMaterialsTabProps {
  companyId: string;
  invoices: CPGInvoice[];
  categories: CPGCategory[];
  onViewInvoice: (id: string) => void;
  onEditInvoice: (id: string) => void;
  onDuplicateInvoice: (id: string) => void;
  onArchiveInvoice: (id: string) => Promise<void>;
}

export default function RawMaterialsTab({
  companyId,
  invoices,
  categories,
  onViewInvoice,
  onEditInvoice,
  onDuplicateInvoice,
  onArchiveInvoice,
}: RawMaterialsTabProps) {
  // Tab-specific state
  const [rawMaterialsDatePreset, setRawMaterialsDatePreset] = useState<DateRangePreset>('3mo');
  const [rawMaterialsDateRange, setRawMaterialsDateRange] = useState<{ start: string; end: string }>({
    start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  const [rawMaterialsCategoryFilter, setRawMaterialsCategoryFilter] = useState<string | undefined>(undefined);
  const [rawMaterialsVariantFilter, setRawMaterialsVariantFilter] = useState<string>('');
  const [rawMaterialsVendorFilter, setRawMaterialsVendorFilter] = useState<string>('');
  const [rawMaterialsSortBy, setRawMaterialsSortBy] = useState<'date-asc' | 'date-desc' | 'vendor' | 'total-asc' | 'total-desc'>('date-desc');
  const [showRawMaterialsExportMenu, setShowRawMaterialsExportMenu] = useState(false);

  // Handle date preset changes
  const handleRawMaterialsDatePresetChange = (preset: DateRangePreset) => {
    setRawMaterialsDatePreset(preset);
    const today = new Date();
    let start: Date;
    let end: Date = today;

    switch (preset) {
      case '3mo':
        start = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '6mo':
        start = new Date(today.getTime() - 180 * 24 * 60 * 60 * 1000);
        break;
      case '12mo':
        start = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      case 'last-calendar-year':
        start = new Date(today.getFullYear() - 1, 0, 1);
        end = new Date(today.getFullYear() - 1, 11, 31);
        break;
      case 'this-calendar-year':
        start = new Date(today.getFullYear(), 0, 1);
        end = today;
        break;
      case 'all':
        start = new Date('2000-01-01');
        end = today;
        break;
      case 'custom':
        return; // Don't update dates for custom
      default:
        start = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
    }

    setRawMaterialsDateRange({
      start: start.toISOString().split('T')[0] || '',
      end: end.toISOString().split('T')[0] || '',
    });
  };

  // Smart year detection for date inputs - handles 2-digit year entries
  const handleRawMaterialsDateBlur = (value: string | undefined, setter: (val: string) => void) => {
    if (!value) return;

    const parts = value.split('-');
    if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
      const year = parseInt(parts[0], 10);

      // Handle 2-digit years (26 -> 2026)
      if (parts[0].length === 2 && year >= 0 && year <= 99) {
        const fullYear = `20${parts[0].padStart(2, '0')}`;
        setter(`${fullYear}-${parts[1]}-${parts[2]}`);
      }
      // Handle browser-converted 4-digit years like "0026" -> "2026"
      else if (parts[0].length === 4 && year >= 0 && year <= 99) {
        const fullYear = `20${year.toString().padStart(2, '0')}`;
        setter(`${fullYear}-${parts[1]}-${parts[2]}`);
      }
    }
  };

  // Format number with commas
  const formatNumberWithCommas = (num: number): string => {
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Filter and sort invoices (Single source of truth)
  const filteredRawMaterialInvoices = useMemo(() => {
    let filtered = invoices.filter(inv => {
      // Date filter
      const invDate = new Date(inv.invoice_date);
      const startDate = new Date(rawMaterialsDateRange.start);
      const endDate = new Date(rawMaterialsDateRange.end);
      if (invDate < startDate || invDate > endDate) return false;

      // Vendor filter (exact match, case-insensitive)
      if (rawMaterialsVendorFilter && inv.vendor_name.toLowerCase() !== rawMaterialsVendorFilter.toLowerCase()) {
        return false;
      }

      // Category filter
      if (rawMaterialsCategoryFilter) {
        const hasCategory = inv.cost_attribution && Object.values(inv.cost_attribution).some(
          attr => attr.category_id === rawMaterialsCategoryFilter
        );
        if (!hasCategory) return false;
      }

      // Variant filter
      if (rawMaterialsVariantFilter) {
        if (!inv.cost_attribution) return false;
        const hasVariant = Object.values(inv.cost_attribution).some(attr => {
          const variant = attr.variant || '';
          return variant.toLowerCase().includes(rawMaterialsVariantFilter.toLowerCase());
        });
        if (!hasVariant) return false;
      }

      return true;
    });

    // Sort invoices
    filtered.sort((a, b) => {
      switch (rawMaterialsSortBy) {
        case 'date-asc':
          return a.invoice_date - b.invoice_date;
        case 'date-desc':
          return b.invoice_date - a.invoice_date;
        case 'vendor':
          return a.vendor_name.localeCompare(b.vendor_name);
        case 'total-asc': {
          const aTotal = typeof a.total_paid === 'number' ? a.total_paid : parseFloat(a.total_paid || '0');
          const bTotal = typeof b.total_paid === 'number' ? b.total_paid : parseFloat(b.total_paid || '0');
          return aTotal - bTotal;
        }
        case 'total-desc': {
          const aTotal = typeof a.total_paid === 'number' ? a.total_paid : parseFloat(a.total_paid || '0');
          const bTotal = typeof b.total_paid === 'number' ? b.total_paid : parseFloat(b.total_paid || '0');
          return bTotal - aTotal;
        }
        default:
          return b.invoice_date - a.invoice_date;
      }
    });

    return filtered;
  }, [invoices, rawMaterialsDateRange, rawMaterialsVendorFilter, rawMaterialsCategoryFilter, rawMaterialsVariantFilter, rawMaterialsSortBy]);

  // Calculate statistics
  const rawMaterialStats = useMemo(() => {
    // Total spent in filtered invoices
    const totalSpent = filteredRawMaterialInvoices.reduce((sum, inv) => {
      const amount = typeof inv.total_paid === 'number' ? inv.total_paid : parseFloat(inv.total_paid || '0');
      return sum + amount;
    }, 0);

    // Invoice count
    const invoiceCount = filteredRawMaterialInvoices.length;

    // Spend by category
    const spendByCategory = new Map<string, { name: string; total: number }>();
    filteredRawMaterialInvoices.forEach(inv => {
      if (inv.cost_attribution) {
        Object.values(inv.cost_attribution).forEach(attr => {
          const category = categories.find(c => c.id === attr.category_id);
          if (category) {
            const lineTotal = attr.manual_line_total
              ? parseFloat(attr.manual_line_total)
              : parseFloat(attr.units_purchased) * parseFloat(attr.unit_price);

            const existing = spendByCategory.get(category.id);
            if (existing) {
              existing.total += lineTotal;
            } else {
              spendByCategory.set(category.id, { name: category.name, total: lineTotal });
            }
          }
        });
      }
    });

    // Average invoice amount
    const averageInvoiceAmount = filteredRawMaterialInvoices.length > 0
      ? totalSpent / filteredRawMaterialInvoices.length
      : 0;

    // Top vendor by spend (from date-filtered only)
    const dateFilteredInvoices = invoices.filter(inv => {
      const invDate = new Date(inv.invoice_date);
      const startDate = new Date(rawMaterialsDateRange.start);
      const endDate = new Date(rawMaterialsDateRange.end);
      return invDate >= startDate && invDate <= endDate;
    });

    const allVendorsSpend = new Map<string, number>();
    dateFilteredInvoices.forEach(inv => {
      const amount = typeof inv.total_paid === 'number' ? inv.total_paid : parseFloat(inv.total_paid || '0');
      const existing = allVendorsSpend.get(inv.vendor_name);
      allVendorsSpend.set(inv.vendor_name, (existing || 0) + amount);
    });

    let topVendor: { name: string; total: number } | null = null;
    allVendorsSpend.forEach((total, name) => {
      if (!topVendor || total > topVendor.total) {
        topVendor = { name, total };
      }
    });

    // Top category by spend
    const allCategoriesSpend = new Map<string, { name: string; total: number }>();
    dateFilteredInvoices.forEach(inv => {
      if (inv.cost_attribution) {
        Object.values(inv.cost_attribution).forEach(attr => {
          const category = categories.find(c => c.id === attr.category_id);
          if (category) {
            const lineTotal = attr.manual_line_total
              ? parseFloat(attr.manual_line_total)
              : parseFloat(attr.units_purchased) * parseFloat(attr.unit_price);

            const existing = allCategoriesSpend.get(category.id);
            if (existing) {
              existing.total += lineTotal;
            } else {
              allCategoriesSpend.set(category.id, { name: category.name, total: lineTotal });
            }
          }
        });
      }
    });

    let topCategory: { name: string; total: number } | null = null;
    allCategoriesSpend.forEach((categoryData) => {
      if (!topCategory || categoryData.total > topCategory.total) {
        topCategory = categoryData;
      }
    });

    // Top variant by spend
    const allVariantsSpend = new Map<string, number>();
    dateFilteredInvoices.forEach(inv => {
      if (inv.cost_attribution) {
        Object.values(inv.cost_attribution).forEach(attr => {
          if (attr.variant) {
            const lineTotal = attr.manual_line_total
              ? parseFloat(attr.manual_line_total)
              : parseFloat(attr.units_purchased) * parseFloat(attr.unit_price);

            const existing = allVariantsSpend.get(attr.variant);
            allVariantsSpend.set(attr.variant, (existing || 0) + lineTotal);
          }
        });
      }
    });

    let topVariant: { name: string; total: number } | null = null;
    allVariantsSpend.forEach((total, name) => {
      if (!topVariant || total > topVariant.total) {
        topVariant = { name, total };
      }
    });

    return {
      totalSpent,
      invoiceCount,
      averageInvoiceAmount,
      topVendor,
      topCategory,
      topVariant,
      spendByCategory,
    };
  }, [filteredRawMaterialInvoices, categories, rawMaterialsDateRange, invoices]);

  // Get all unique variants for dropdown
  const availableVariants = useMemo(() => {
    const variants = new Set<string>();
    invoices.forEach(inv => {
      if (inv.cost_attribution) {
        Object.values(inv.cost_attribution).forEach(attr => {
          if (attr.variant) {
            variants.add(attr.variant);
          }
        });
      }
    });
    return Array.from(variants).sort();
  }, [invoices]);

  // Export functions
  const exportRawMaterialsCSVSummary = () => {
    const headers = ['Date', 'Vendor', 'Invoice #', 'Categories', 'Total Paid'];
    const rows = filteredRawMaterialInvoices.map(inv => [
      new Date(inv.invoice_date).toLocaleDateString(),
      inv.vendor_name,
      inv.invoice_number || '-',
      inv.cost_attribution
        ? Object.values(inv.cost_attribution).map(attr => {
            const category = categories.find(c => c.id === attr.category_id);
            return category?.name || 'Unknown';
          }).join(', ')
        : '-',
      `$${typeof inv.total_paid === 'number' ? inv.total_paid.toFixed(2) : parseFloat(inv.total_paid || '0').toFixed(2)}`,
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `raw-materials-summary-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportRawMaterialsPDFSummary = () => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text('Raw Material Invoice Summary', 14, 20);

    doc.setFontSize(10);
    doc.text(`Date Range: ${new Date(rawMaterialsDateRange.start).toLocaleDateString()} - ${new Date(rawMaterialsDateRange.end).toLocaleDateString()}`, 14, 30);
    doc.text(`Total Spent: $${rawMaterialStats.totalSpent.toFixed(2)}`, 14, 36);
    doc.text(`Invoice Count: ${filteredRawMaterialInvoices.length}`, 14, 42);

    autoTable(doc, {
      startY: 50,
      head: [['Date', 'Vendor', 'Invoice #', 'Categories', 'Total']],
      body: filteredRawMaterialInvoices.map(inv => [
        new Date(inv.invoice_date).toLocaleDateString(),
        inv.vendor_name,
        inv.invoice_number || '-',
        inv.cost_attribution
          ? Object.values(inv.cost_attribution).map(attr => {
              const category = categories.find(c => c.id === attr.category_id);
              return category?.name || 'Unknown';
            }).join(', ')
          : '-',
        `$${typeof inv.total_paid === 'number' ? inv.total_paid.toFixed(2) : parseFloat(inv.total_paid || '0').toFixed(2)}`,
      ]),
      theme: 'striped',
      headStyles: { fillColor: [75, 0, 110], textColor: 255 },
      styles: { fontSize: 9 },
    });

    doc.save(`raw-materials-summary-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const exportRawMaterialsCSVDetail = () => {
    const headers = [
      'Date',
      'Vendor',
      'Invoice #',
      'Category',
      'Variant',
      'Units Purchased',
      'Unit Price',
      'Units Received',
      'Line Total',
      'Invoice Total',
    ];

    const rows: string[][] = [];
    filteredRawMaterialInvoices.forEach(inv => {
      if (inv.cost_attribution) {
        Object.values(inv.cost_attribution).forEach(attr => {
          const category = categories.find(c => c.id === attr.category_id);
          const lineTotal = attr.manual_line_total
            ? parseFloat(attr.manual_line_total)
            : parseFloat(attr.units_purchased) * parseFloat(attr.unit_price);

          rows.push([
            new Date(inv.invoice_date).toLocaleDateString(),
            inv.vendor_name,
            inv.invoice_number || '-',
            category?.name || 'Unknown',
            attr.variant || '-',
            attr.units_purchased,
            `$${parseFloat(attr.unit_price).toFixed(2)}`,
            attr.units_received || attr.units_purchased,
            `$${lineTotal.toFixed(2)}`,
            `$${typeof inv.total_paid === 'number' ? inv.total_paid.toFixed(2) : parseFloat(inv.total_paid || '0').toFixed(2)}`,
          ]);
        });
      } else {
        // Invoice with no cost attribution
        rows.push([
          new Date(inv.invoice_date).toLocaleDateString(),
          inv.vendor_name,
          inv.invoice_number || '-',
          '-',
          '-',
          '-',
          '-',
          '-',
          '-',
          `$${typeof inv.total_paid === 'number' ? inv.total_paid.toFixed(2) : parseFloat(inv.total_paid || '0').toFixed(2)}`,
        ]);
      }
    });

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `raw-materials-detail-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div id="raw-materials-panel" role="tabpanel" aria-labelledby="raw-materials-tab">
      {/* Date Range & Export Controls */}
      <div style={{
        display: 'flex',
        gap: '1rem',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        {/* Date Range Preset */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#64748b' }}>
            Date Range:
          </label>
          <select
            value={rawMaterialsDatePreset}
            onChange={(e) => handleRawMaterialsDatePresetChange(e.target.value as DateRangePreset)}
            style={{
              padding: '0.5rem 0.75rem',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              fontSize: '0.875rem',
            }}
            aria-label="Select date range preset"
          >
            <option value="3mo">Last 3 Months</option>
            <option value="6mo">Last 6 Months</option>
            <option value="12mo">Last 12 Months</option>
            <option value="last-calendar-year">Last Calendar Year ({new Date().getFullYear() - 1})</option>
            <option value="this-calendar-year">This Calendar Year ({new Date().getFullYear()})</option>
            <option value="custom">Custom Range...</option>
            <option value="all">All Time</option>
          </select>
        </div>

        {/* Custom Date Inputs */}
        {rawMaterialsDatePreset === 'custom' && (
          <>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <label htmlFor="rm-start-date" style={{ fontSize: '0.875rem', fontWeight: 500, color: '#64748b' }}>
                From:
              </label>
              <input
                type="date"
                id="rm-start-date"
                value={rawMaterialsDateRange.start}
                onChange={(e) => setRawMaterialsDateRange(prev => ({ ...prev, start: e.target.value }))}
                onBlur={(e) => handleRawMaterialsDateBlur(e.target.value, (val) => setRawMaterialsDateRange(prev => ({ ...prev, start: val })))}
                style={{
                  padding: '0.5rem 0.75rem',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                }}
                aria-label="Start date for raw materials filter"
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <label htmlFor="rm-end-date" style={{ fontSize: '0.875rem', fontWeight: 500, color: '#64748b' }}>
                To:
              </label>
              <input
                type="date"
                id="rm-end-date"
                value={rawMaterialsDateRange.end}
                onChange={(e) => setRawMaterialsDateRange(prev => ({ ...prev, end: e.target.value }))}
                onBlur={(e) => handleRawMaterialsDateBlur(e.target.value, (val) => setRawMaterialsDateRange(prev => ({ ...prev, end: val })))}
                style={{
                  padding: '0.5rem 0.75rem',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                }}
                aria-label="End date for raw materials filter"
              />
            </div>
          </>
        )}

        {/* Category Filter */}
        <select
          value={rawMaterialsCategoryFilter || ''}
          onChange={(e) => setRawMaterialsCategoryFilter(e.target.value || undefined)}
          className={styles.filterSelect}
          aria-label="Filter by category"
          style={{
            padding: '0.5rem 0.75rem',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            fontSize: '0.875rem',
          }}
        >
          <option value="">All Categories</option>
          {[...categories].sort((a, b) => a.name.localeCompare(b.name)).map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>

        {/* Variant Filter */}
        <select
          value={rawMaterialsVariantFilter}
          onChange={(e) => setRawMaterialsVariantFilter(e.target.value)}
          className={styles.filterSelect}
          aria-label="Filter by variant"
          style={{
            padding: '0.5rem 0.75rem',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            fontSize: '0.875rem',
          }}
        >
          <option value="">All Variants</option>
          {availableVariants.map((variant) => (
            <option key={variant} value={variant}>{variant}</option>
          ))}
        </select>

        {/* Vendor Filter */}
        <input
          type="search"
          placeholder="Filter by vendor..."
          value={rawMaterialsVendorFilter}
          onChange={(e) => setRawMaterialsVendorFilter(e.target.value)}
          className={styles.searchInput}
          aria-label="Filter by vendor"
          style={{
            minWidth: '150px',
            padding: '0.5rem 0.75rem',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            fontSize: '0.875rem',
          }}
          list="vendor-suggestions"
        />
        <datalist id="vendor-suggestions">
          {Array.from(new Set(invoices.map(inv => inv.vendor_name))).sort().map(vendor => (
            <option key={vendor} value={vendor} />
          ))}
        </datalist>

        {/* Export Dropdown */}
        <div style={{ marginLeft: 'auto', position: 'relative' }}>
          <button
            onClick={() => setShowRawMaterialsExportMenu(!showRawMaterialsExportMenu)}
            style={{
              padding: '0.5rem 1rem',
              background: '#4b006e',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
            aria-label="Export raw materials data"
            aria-expanded={showRawMaterialsExportMenu}
            aria-haspopup="menu"
          >
            Export
            <span style={{ fontSize: '0.75rem' }} aria-hidden="true">▼</span>
          </button>

          {showRawMaterialsExportMenu && (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '0.25rem',
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden',
              zIndex: 1000,
              minWidth: '200px',
            }}
            role="menu"
            >
              <button
                onClick={() => {
                  exportRawMaterialsCSVSummary();
                  setShowRawMaterialsExportMenu(false);
                }}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  border: 'none',
                  background: 'transparent',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                role="menuitem"
              >
                CSV Summary
              </button>
              <button
                onClick={() => {
                  exportRawMaterialsPDFSummary();
                  setShowRawMaterialsExportMenu(false);
                }}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  border: 'none',
                  background: 'transparent',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  borderTop: '1px solid #e5e7eb',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                role="menuitem"
              >
                PDF Summary
              </button>
              <button
                onClick={() => {
                  exportRawMaterialsCSVDetail();
                  setShowRawMaterialsExportMenu(false);
                }}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  border: 'none',
                  background: 'transparent',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  borderTop: '1px solid #e5e7eb',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                role="menuitem"
              >
                CSV Detail
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Active Filter Indicator */}
      {(rawMaterialsCategoryFilter || rawMaterialsVariantFilter || rawMaterialsVendorFilter) && (
        <div style={{
          background: '#dbeafe',
          border: '1px solid #0c4a6e',
          borderRadius: '6px',
          padding: '0.75rem 1rem',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          <span style={{ fontSize: '0.875rem', color: '#0c4a6e', fontWeight: 500 }}>
            Active Filters:
            {rawMaterialsCategoryFilter && ` • Category: "${categories.find(c => c.id === rawMaterialsCategoryFilter)?.name}"`}
            {rawMaterialsVariantFilter && ` • Variant: "${rawMaterialsVariantFilter}"`}
            {rawMaterialsVendorFilter && ` • Vendor: "${rawMaterialsVendorFilter}"`}
          </span>
          <button
            onClick={() => {
              setRawMaterialsCategoryFilter(undefined);
              setRawMaterialsVariantFilter('');
              setRawMaterialsVendorFilter('');
            }}
            style={{
              marginLeft: 'auto',
              padding: '0.25rem 0.75rem',
              background: 'transparent',
              border: '1px solid #0c4a6e',
              borderRadius: '4px',
              color: '#0c4a6e',
              fontSize: '0.75rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
            aria-label="Clear all filters"
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* Stat Boxes */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem',
      }}>
        {/* Total Spent */}
        <div style={{
          background: 'linear-gradient(135deg, #4b006e 0%, #6b21a8 100%)',
          borderRadius: '12px',
          padding: '1.5rem',
          color: 'white',
        }}>
          <div style={{ fontSize: '0.75rem', opacity: 0.9, fontWeight: 500, marginBottom: '0.5rem' }}>
            Total Spent
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, lineHeight: 1 }}>
            ${formatNumberWithCommas(rawMaterialStats.totalSpent)}
          </div>
          <div style={{ fontSize: '0.75rem', opacity: 0.9, marginTop: '0.5rem' }}>
            {filteredRawMaterialInvoices.length} {filteredRawMaterialInvoices.length === 1 ? 'invoice' : 'invoices'}
          </div>
        </div>

        {/* Average Invoice Amount */}
        {filteredRawMaterialInvoices.length > 0 && (
          <div style={{
            background: '#f3e8ff',
            border: '2px solid #9333ea',
            borderRadius: '12px',
            padding: '1.5rem',
          }}>
            <div style={{ fontSize: '0.75rem', color: '#6b21a8', fontWeight: 600, marginBottom: '0.5rem' }}>
              Average Invoice Amount
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#4b006e', lineHeight: 1 }}>
              ${formatNumberWithCommas(rawMaterialStats.averageInvoiceAmount)}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#6b21a8', marginTop: '0.5rem' }}>
              per invoice
            </div>
          </div>
        )}

        {/* Top Category/Variant/Vendor by Spend */}
        {rawMaterialsCategoryFilter && rawMaterialStats.topCategory ? (
          <div style={{
            background: '#dcfce7',
            border: '2px solid #16a34a',
            borderRadius: '12px',
            padding: '1.5rem',
          }}>
            <div style={{ fontSize: '0.75rem', color: '#15803d', fontWeight: 600, marginBottom: '0.5rem' }}>
              Top Category by Spend
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#166534', lineHeight: 1 }}>
              ${formatNumberWithCommas(rawMaterialStats.topCategory.total)}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#15803d', marginTop: '0.5rem' }}>
              {rawMaterialStats.topCategory.name}
            </div>
          </div>
        ) : rawMaterialsVariantFilter && rawMaterialStats.topVariant ? (
          <div style={{
            background: '#dcfce7',
            border: '2px solid #16a34a',
            borderRadius: '12px',
            padding: '1.5rem',
          }}>
            <div style={{ fontSize: '0.75rem', color: '#15803d', fontWeight: 600, marginBottom: '0.5rem' }}>
              Top Variant by Spend
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#166534', lineHeight: 1 }}>
              ${formatNumberWithCommas(rawMaterialStats.topVariant.total)}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#15803d', marginTop: '0.5rem' }}>
              {rawMaterialStats.topVariant.name}
            </div>
          </div>
        ) : rawMaterialStats.topVendor && (
          <div style={{
            background: '#dcfce7',
            border: '2px solid #16a34a',
            borderRadius: '12px',
            padding: '1.5rem',
          }}>
            <div style={{ fontSize: '0.75rem', color: '#15803d', fontWeight: 600, marginBottom: '0.5rem' }}>
              Top Vendor by Spend
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#166534', lineHeight: 1 }}>
              ${formatNumberWithCommas(rawMaterialStats.topVendor.total)}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#15803d', marginTop: '0.5rem' }}>
              {rawMaterialStats.topVendor.name}
            </div>
          </div>
        )}
      </div>

      {/* Category Breakdown Visualization */}
      {rawMaterialStats.spendByCategory.size > 0 && (
        <div style={{
          background: '#fef3c7',
          border: '2px solid #f59e0b',
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '2rem',
        }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#78350f', marginBottom: '1rem' }}>
            📊 Spend by Category
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {Array.from(rawMaterialStats.spendByCategory.entries())
              .sort((a, b) => b[1].total - a[1].total)
              .map(([categoryId, data]) => {
                const percentage = (data.total / rawMaterialStats.totalSpent) * 100;
                return (
                  <div key={categoryId} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ minWidth: '120px', fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>
                      {data.name}
                    </div>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <div style={{
                        height: '24px',
                        background: '#f3f4f6',
                        borderRadius: '4px',
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${percentage}%`,
                          background: '#4b006e',
                          transition: 'width 300ms ease-out',
                        }} />
                      </div>
                    </div>
                    <div style={{ minWidth: '100px', textAlign: 'right', fontSize: '0.875rem', fontWeight: 600, color: '#4b006e' }}>
                      ${formatNumberWithCommas(data.total)}
                    </div>
                    <div style={{ minWidth: '50px', textAlign: 'right', fontSize: '0.875rem', color: '#64748b' }}>
                      {percentage.toFixed(1)}%
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Invoice History Table */}
      <div style={{
        background: 'white',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
        overflow: 'hidden',
      }}>
        {filteredRawMaterialInvoices.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '3rem 2rem',
            background: '#f9fafb',
          }}>
            {invoices.length === 0 ? (
              <>
                <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>📦</span>
                <span style={{ color: '#64748b', fontSize: '1.125rem', display: 'block', marginBottom: '0.5rem' }}>
                  No invoices yet
                </span>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#94a3b8', marginBottom: '1.5rem' }}>
                  Ready to track your raw material costs? Add your first invoice to get started.
                </p>
              </>
            ) : (
              <>
                <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '1rem' }}>🔍</span>
                <span style={{ color: '#64748b', fontSize: '1.125rem', display: 'block', marginBottom: '0.5rem' }}>
                  No invoices match your filters
                </span>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#94a3b8', marginBottom: '1.5rem' }}>
                  Try adjusting your date range, vendor, category, or variant filters.
                </p>
                <button
                  onClick={() => {
                    setRawMaterialsCategoryFilter(undefined);
                    setRawMaterialsVariantFilter('');
                    setRawMaterialsVendorFilter('');
                    handleRawMaterialsDatePresetChange('all');
                  }}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#4b006e',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Clear All Filters
                </button>
              </>
            )}
          </div>
        ) : (
          <table className={styles.table} aria-label="Raw material invoice history" aria-describedby="invoice-count-status">
            <caption id="invoice-count-status" style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', borderWidth: 0 }}>
              Showing {filteredRawMaterialInvoices.length} invoices
            </caption>
            <thead>
              <tr>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => setRawMaterialsSortBy(rawMaterialsSortBy === 'date-desc' ? 'date-asc' : 'date-desc')}
                  aria-sort={rawMaterialsSortBy === 'date-desc' ? 'descending' : rawMaterialsSortBy === 'date-asc' ? 'ascending' : 'none'}
                >
                  Date {rawMaterialsSortBy === 'date-desc' ? '▼' : rawMaterialsSortBy === 'date-asc' ? '▲' : ''}
                </th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => setRawMaterialsSortBy('vendor')}
                  aria-sort={rawMaterialsSortBy === 'vendor' ? 'ascending' : 'none'}
                >
                  Vendor {rawMaterialsSortBy === 'vendor' ? '▲' : ''}
                </th>
                <th>Invoice #</th>
                <th>Categories</th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => setRawMaterialsSortBy(rawMaterialsSortBy === 'total-desc' ? 'total-asc' : 'total-desc')}
                  aria-sort={rawMaterialsSortBy === 'total-desc' ? 'descending' : rawMaterialsSortBy === 'total-asc' ? 'ascending' : 'none'}
                >
                  Total Paid {rawMaterialsSortBy === 'total-desc' ? '▼' : rawMaterialsSortBy === 'total-asc' ? '▲' : ''}
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRawMaterialInvoices.map((invoice) => {
                const invoiceCategories = invoice.cost_attribution
                  ? Object.values(invoice.cost_attribution).map(attr => {
                      const category = categories.find(c => c.id === attr.category_id);
                      return category?.name || 'Unknown';
                    })
                  : [];

                const uniqueCategories = Array.from(new Set(invoiceCategories));

                return (
                  <tr key={invoice.id}>
                    <td>{new Date(invoice.invoice_date).toLocaleDateString()}</td>
                    <td>{invoice.vendor_name}</td>
                    <td>{invoice.invoice_number || '-'}</td>
                    <td>
                      {uniqueCategories.length > 0 ? (
                        <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                          {uniqueCategories.slice(0, 3).map((catName, idx) => (
                            <span
                              key={idx}
                              style={{
                                padding: '0.125rem 0.5rem',
                                background: '#f3f4f6',
                                color: '#374151',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 500,
                                border: '1px solid #e5e7eb',
                              }}
                            >
                              {catName}
                            </span>
                          ))}
                          {uniqueCategories.length > 3 && (
                            <span
                              style={{
                                padding: '0.125rem 0.5rem',
                                background: '#f3f4f6',
                                color: '#64748b',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 500,
                                border: '1px solid #e5e7eb',
                              }}
                              title={uniqueCategories.slice(3).join(', ')}
                            >
                              +{uniqueCategories.length - 3} more
                            </span>
                          )}
                        </div>
                      ) : '-'}
                    </td>
                    <td style={{ fontWeight: 600, color: '#4b006e' }}>
                      ${formatNumberWithCommas(typeof invoice.total_paid === 'number' ? invoice.total_paid : parseFloat(invoice.total_paid || '0'))}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          className={styles.actionButton}
                          onClick={() => onViewInvoice(invoice.id)}
                          aria-label={`View invoice ${invoice.invoice_number || 'details'}`}
                        >
                          View
                        </button>
                        <button
                          className={styles.actionButton}
                          onClick={() => onEditInvoice(invoice.id)}
                          style={{ background: '#f3f4f6', color: '#374151' }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#e5e7eb'}
                          onMouseLeave={(e) => e.currentTarget.style.background = '#f3f4f6'}
                          aria-label={`Edit invoice ${invoice.invoice_number || ''}`}
                        >
                          Edit
                        </button>
                        <button
                          className={styles.actionButton}
                          onClick={() => onDuplicateInvoice(invoice.id)}
                          style={{ background: '#f3f4f6', color: '#374151' }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#e5e7eb'}
                          onMouseLeave={(e) => e.currentTarget.style.background = '#f3f4f6'}
                          aria-label={`Duplicate invoice ${invoice.invoice_number || ''}`}
                        >
                          Duplicate
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
