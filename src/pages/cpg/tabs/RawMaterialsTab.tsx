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
import { formatDateFromTimestamp } from '../../../utils/dateUtils';
import { useFrozenState } from '../../../contexts/FrozenStateContext';
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
  const { isFrozen, openReactivationFlow } = useFrozenState();

  // Helper to guard write actions on plain HTML buttons
  const guardAction = <T extends unknown[]>(action: (...args: T) => void) => {
    return (...args: T) => {
      if (isFrozen) {
        openReactivationFlow();
        return;
      }
      action(...args);
    };
  };

  // Tab-specific state
  const [rawMaterialsDatePreset, setRawMaterialsDatePreset] = useState<DateRangePreset>('12mo');
  const [rawMaterialsDateRange, setRawMaterialsDateRange] = useState<{ start: string; end: string }>({
    start: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  const [rawMaterialsCategoryFilter, setRawMaterialsCategoryFilter] = useState<string | undefined>(undefined);
  const [rawMaterialsVariantFilter, setRawMaterialsVariantFilter] = useState<string>('');
  const [rawMaterialsVendorFilter, setRawMaterialsVendorFilter] = useState<string>('');
  const [rawMaterialsSortBy, setRawMaterialsSortBy] = useState<'date-asc' | 'date-desc' | 'vendor' | 'total-asc' | 'total-desc'>('date-desc');
  const [showRawMaterialsExportMenu, setShowRawMaterialsExportMenu] = useState(false);
  const [deletingInvoiceId, setDeletingInvoiceId] = useState<string | null>(null);

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
    console.log('📊 RawMaterialsTab - Filtering invoices:', {
      totalInvoices: invoices.length,
      dateRange: rawMaterialsDateRange,
      vendorFilter: rawMaterialsVendorFilter,
      categoryFilter: rawMaterialsCategoryFilter,
      variantFilter: rawMaterialsVariantFilter,
    });

    let filtered = invoices.filter(inv => {
      // Date filter
      const invDate = new Date(inv.invoice_date);
      const startDate = new Date(rawMaterialsDateRange.start + 'T00:00:00.000Z'); // Midnight UTC
      const endDate = new Date(rawMaterialsDateRange.end + 'T23:59:59.999Z'); // End of day UTC

      if (invDate < startDate || invDate > endDate) {
        console.log('📅 Invoice filtered out by date:', {
          invoiceDate: inv.invoice_date,
          invoiceDateFormatted: new Date(inv.invoice_date).toISOString(),
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          comparison: `${invDate < startDate ? 'before start' : ''} ${invDate > endDate ? 'after end' : ''}`,
        });
        return false;
      }

      // Vendor filter (exact match, case-insensitive) - handle null vendor names
      if (rawMaterialsVendorFilter && inv.vendor_name && inv.vendor_name.toLowerCase() !== rawMaterialsVendorFilter.toLowerCase()) {
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

    console.log('✅ RawMaterialsTab - After filtering:', {
      filteredCount: filtered.length,
      filteredInvoices: filtered.map(inv => ({
        id: inv.id,
        date: new Date(inv.invoice_date).toISOString(),
        vendor: inv.vendor_name,
        total: inv.total_paid,
      })),
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
      // Set endDate to end of day to include all invoices on that date
      endDate.setHours(23, 59, 59, 999);
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
      formatDateFromTimestamp(inv.invoice_date),
      inv.vendor_name,
      inv.invoice_number || '-',
      inv.cost_attribution
        ? Object.values(inv.cost_attribution).map(attr => {
            // Check if personal item first
            if (attr.is_personal || attr.category_id === 'personal') {
              return 'Personal';
            }
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
        formatDateFromTimestamp(inv.invoice_date),
        inv.vendor_name,
        inv.invoice_number || '-',
        inv.cost_attribution
          ? Object.values(inv.cost_attribution).map(attr => {
              // Check if personal item first
              if (attr.is_personal || attr.category_id === 'personal') {
                return 'Personal';
              }
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
            formatDateFromTimestamp(inv.invoice_date),
            inv.vendor_name,
            inv.invoice_number || '-',
            (attr.is_personal || attr.category_id === 'personal') ? 'Personal' : (category?.name || 'Unknown'),
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
          formatDateFromTimestamp(inv.invoice_date),
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
      {/* SUMMARY STATS SECTION */}
      <div style={{
        background: '#ffffff',
        borderLeft: '4px solid #D4AF37',
        borderRight: '4px solid #D4AF37',
        borderBottom: '4px solid #D4AF37',
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(184, 134, 11, 0.15)',
        marginBottom: '1.5rem',
      }}>
        {/* Header with Export */}
        <div style={{
          background: '#4b006e',
          color: 'white',
          padding: '1.25rem 1.5rem',
          fontSize: '1.5rem',
          fontWeight: 600,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span>Summary</span>

          {/* Export Button */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowRawMaterialsExportMenu(!showRawMaterialsExportMenu)}
              style={{
                padding: '0.5rem 1rem',
                background: '#D4AF37',
                border: 'none',
                borderRadius: '6px',
                color: '#1a1a1a',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.875rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 150ms',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#C4A137';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#D4AF37';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
              aria-label="Export raw materials data"
              aria-expanded={showRawMaterialsExportMenu}
              aria-haspopup="menu"
            >
              <span>📊</span>
              <span>Export</span>
              <span aria-hidden="true">▼</span>
            </button>

            {showRawMaterialsExportMenu && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '0.5rem',
                background: 'white',
                border: '2px solid #D4AF37',
                borderRadius: '6px',
                boxShadow: '0 4px 12px rgba(184, 134, 11, 0.25)',
                overflow: 'hidden',
                zIndex: 1000,
                minWidth: '180px',
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
                    color: '#1a1a1a',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#E5F6DF'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  role="menuitem"
                >
                  📄 CSV Summary
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
                    color: '#1a1a1a',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#E5F6DF'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  role="menuitem"
                >
                  📑 PDF Summary
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
                    color: '#1a1a1a',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#E5F6DF'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  role="menuitem"
                >
                  📊 CSV Detailed
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Content - 3 Stat Cards */}
        <div style={{
          padding: '1.5rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '1.25rem',
        }}>
          {/* Total Spent */}
          <div style={{
            background: 'linear-gradient(135deg, #4b006e 0%, #6b21a8 100%)',
            borderRadius: '12px',
            padding: '1.25rem',
            color: 'white',
          }}>
            <div style={{ fontSize: '0.75rem', opacity: 0.9, fontWeight: 600, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
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
          <div style={{
            background: 'linear-gradient(135deg, #E8D4A0 0%, #D4AF37 100%)',
            borderRadius: '12px',
            padding: '1.25rem',
          }}>
            <div style={{ fontSize: '0.75rem', color: '#4b006e', fontWeight: 600, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Average Invoice
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#4b006e', lineHeight: 1 }}>
              {filteredRawMaterialInvoices.length > 0
                ? `$${formatNumberWithCommas(rawMaterialStats.averageInvoiceAmount)}`
                : '$0.00'}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#4b006e', marginTop: '0.5rem' }}>
              per invoice
            </div>
          </div>

          {/* Top Category/Variant/Vendor */}
          <div style={{
            background: 'linear-gradient(135deg, #D8E5D8 0%, #A8D5A8 100%)',
            borderRadius: '12px',
            padding: '1.25rem',
          }}>
            <div style={{ fontSize: '0.75rem', color: '#15803d', fontWeight: 600, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {rawMaterialsCategoryFilter && rawMaterialStats.topCategory ? 'Top Category' :
               rawMaterialsVariantFilter && rawMaterialStats.topVariant ? 'Top Variant' :
               'Top Vendor'}
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#166534', lineHeight: 1 }}>
              {rawMaterialsCategoryFilter && rawMaterialStats.topCategory
                ? `$${formatNumberWithCommas(rawMaterialStats.topCategory.total)}`
                : rawMaterialsVariantFilter && rawMaterialStats.topVariant
                ? `$${formatNumberWithCommas(rawMaterialStats.topVariant.total)}`
                : rawMaterialStats.topVendor
                ? `$${formatNumberWithCommas(rawMaterialStats.topVendor.total)}`
                : '$0.00'}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#15803d', marginTop: '0.5rem' }}>
              {rawMaterialsCategoryFilter && rawMaterialStats.topCategory
                ? rawMaterialStats.topCategory.name
                : rawMaterialsVariantFilter && rawMaterialStats.topVariant
                ? rawMaterialStats.topVariant.name
                : rawMaterialStats.topVendor
                ? rawMaterialStats.topVendor.name
                : 'No data'}
            </div>
          </div>
        </div>
      </div>

      {/* FILTERS SECTION - Horizontal */}
      <div style={{
        background: '#ffffff',
        borderLeft: '4px solid #D4AF37',
        borderRight: '4px solid #D4AF37',
        borderBottom: '4px solid #D4AF37',
        borderRadius: '8px',
        overflow: 'visible',
        boxShadow: '0 2px 8px rgba(184, 134, 11, 0.15)',
        marginBottom: '2rem',
      }}>
        {/* Header */}
        <div style={{
          background: '#4b006e',
          color: 'white',
          padding: '1rem 1.5rem',
          fontSize: '1.5rem',
          fontWeight: 600,
        }}>
          Filters
        </div>

        {/* Content - Horizontal Layout */}
        <div style={{
          padding: '1.25rem',
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
        }}>
          {/* Date Range */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#4b006e', whiteSpace: 'nowrap' }}>
              Date:
            </label>
            <select
              value={rawMaterialsDatePreset}
              onChange={(e) => handleRawMaterialsDatePresetChange(e.target.value as DateRangePreset)}
              style={{
                padding: '0.5rem',
                border: '2px solid #D4AF37',
                borderRadius: '6px',
                fontSize: '0.8125rem',
                backgroundColor: '#E5F6DF',
                outline: 'none',
                minWidth: '140px',
              }}
              aria-label="Select date range preset"
            >
              <option value="3mo">3 Months</option>
              <option value="6mo">6 Months</option>
              <option value="12mo">12 Months</option>
              <option value="last-calendar-year">Last Year</option>
              <option value="this-calendar-year">This Year</option>
              <option value="custom">Custom...</option>
              <option value="all">All Time</option>
            </select>
          </div>

          {/* Custom Date Inputs */}
          {rawMaterialsDatePreset === 'custom' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label htmlFor="rm-start-date" style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#4b006e', whiteSpace: 'nowrap' }}>
                  From:
                </label>
                <input
                  type="date"
                  id="rm-start-date"
                  value={rawMaterialsDateRange.start}
                  onChange={(e) => setRawMaterialsDateRange(prev => ({ ...prev, start: e.target.value }))}
                  onBlur={(e) => handleRawMaterialsDateBlur(e.target.value, (val) => setRawMaterialsDateRange(prev => ({ ...prev, start: val })))}
                  style={{
                    padding: '0.5rem',
                    border: '2px solid #D4AF37',
                    borderRadius: '6px',
                    fontSize: '0.8125rem',
                    backgroundColor: '#E5F6DF',
                    outline: 'none',
                  }}
                  aria-label="Start date"
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label htmlFor="rm-end-date" style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#4b006e', whiteSpace: 'nowrap' }}>
                  To:
                </label>
                <input
                  type="date"
                  id="rm-end-date"
                  value={rawMaterialsDateRange.end}
                  onChange={(e) => setRawMaterialsDateRange(prev => ({ ...prev, end: e.target.value }))}
                  onBlur={(e) => handleRawMaterialsDateBlur(e.target.value, (val) => setRawMaterialsDateRange(prev => ({ ...prev, end: val })))}
                  style={{
                    padding: '0.5rem',
                    border: '2px solid #D4AF37',
                    borderRadius: '6px',
                    fontSize: '0.8125rem',
                    backgroundColor: '#E5F6DF',
                    outline: 'none',
                  }}
                  aria-label="End date"
                />
              </div>
            </>
          )}

          {/* Category */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#4b006e', whiteSpace: 'nowrap' }}>
              Category:
            </label>
            <select
              value={rawMaterialsCategoryFilter || ''}
              onChange={(e) => setRawMaterialsCategoryFilter(e.target.value || undefined)}
              style={{
                padding: '0.5rem',
                border: '2px solid #D4AF37',
                borderRadius: '6px',
                fontSize: '0.8125rem',
                backgroundColor: '#E5F6DF',
                outline: 'none',
                minWidth: '140px',
              }}
              aria-label="Filter by category"
            >
              <option value="">All</option>
              {[...categories].sort((a, b) => a.name.localeCompare(b.name)).map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          {/* Variant */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#4b006e', whiteSpace: 'nowrap' }}>
              Variant:
            </label>
            <select
              value={rawMaterialsVariantFilter}
              onChange={(e) => setRawMaterialsVariantFilter(e.target.value)}
              style={{
                padding: '0.5rem',
                border: '2px solid #D4AF37',
                borderRadius: '6px',
                fontSize: '0.8125rem',
                backgroundColor: '#E5F6DF',
                outline: 'none',
                minWidth: '120px',
              }}
              aria-label="Filter by variant"
            >
              <option value="">All</option>
              {availableVariants.map((variant) => (
                <option key={variant} value={variant}>{variant}</option>
              ))}
            </select>
          </div>

          {/* Vendor */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#4b006e', whiteSpace: 'nowrap' }}>
              Vendor:
            </label>
            <input
              type="search"
              placeholder="Search..."
              value={rawMaterialsVendorFilter}
              onChange={(e) => setRawMaterialsVendorFilter(e.target.value)}
              style={{
                padding: '0.5rem',
                border: '2px solid #D4AF37',
                borderRadius: '6px',
                fontSize: '0.8125rem',
                backgroundColor: '#E5F6DF',
                outline: 'none',
                minWidth: '140px',
              }}
              aria-label="Filter by vendor"
              list="vendor-suggestions"
            />
            <datalist id="vendor-suggestions">
              {Array.from(new Set(invoices.map(inv => inv.vendor_name))).sort().map(vendor => (
                <option key={vendor} value={vendor} />
              ))}
            </datalist>
          </div>

          {/* Sort */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#4b006e', whiteSpace: 'nowrap' }}>
              Sort:
            </label>
            <select
              value={rawMaterialsSortBy}
              onChange={(e) => setRawMaterialsSortBy(e.target.value as any)}
              style={{
                padding: '0.5rem',
                border: '2px solid #D4AF37',
                borderRadius: '6px',
                fontSize: '0.8125rem',
                backgroundColor: '#E5F6DF',
                outline: 'none',
                minWidth: '100px',
              }}
              aria-label="Sort invoices"
            >
              <option value="date-desc">Date ↓</option>
              <option value="date-asc">Date ↑</option>
              <option value="vendor">Vendor</option>
              <option value="total-desc">Total ↓</option>
              <option value="total-asc">Total ↑</option>
            </select>
          </div>
        </div>
      </div>

      {/* Active Filter Indicator */}
      {(rawMaterialsCategoryFilter || rawMaterialsVariantFilter || rawMaterialsVendorFilter) && (
        <div style={{
          background: '#E5F6DF',
          border: '2px solid #D4AF37',
          borderRadius: '6px',
          padding: '0.75rem 1rem',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          <span style={{ fontSize: '0.875rem', color: '#4b006e', fontWeight: 500 }}>
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
              border: '2px solid #D4AF37',
              borderRadius: '4px',
              color: '#4b006e',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
            aria-label="Clear all filters"
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* Category Breakdown Visualization */}
      {rawMaterialStats.spendByCategory.size > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #E8D4A0 0%, #D4AF37 100%)',
          border: '2px solid #4b006e',
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '2rem',
        }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#4b006e', marginBottom: '1rem' }}>
            Spend by Category
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {Array.from(rawMaterialStats.spendByCategory.entries())
              .sort((a, b) => b[1].total - a[1].total)
              .map(([categoryId, data]) => {
                const percentage = (data.total / rawMaterialStats.totalSpent) * 100;
                return (
                  <div key={categoryId} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ minWidth: '120px', fontSize: '1rem', fontWeight: 500, color: '#374151' }}>
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
                    <div style={{ minWidth: '100px', textAlign: 'right', fontSize: '1rem', fontWeight: 600, color: '#4b006e' }}>
                      ${formatNumberWithCommas(data.total)}
                    </div>
                    <div style={{ minWidth: '50px', textAlign: 'right', fontSize: '1rem', color: '#64748b' }}>
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
                      // Check if personal item first
                      if (attr.is_personal || attr.category_id === 'personal') {
                        return 'Personal';
                      }
                      const category = categories.find(c => c.id === attr.category_id);
                      return category?.name || 'Unknown';
                    })
                  : [];

                const uniqueCategories = Array.from(new Set(invoiceCategories));

                return (
                  <tr key={invoice.id}>
                    <td>{formatDateFromTimestamp(invoice.invoice_date)}</td>
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
                          style={{ background: '#4b006e', color: 'white' }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#6b21a8'}
                          onMouseLeave={(e) => e.currentTarget.style.background = '#4b006e'}
                          aria-label={`View invoice ${invoice.invoice_number || 'details'}`}
                        >
                          View
                        </button>
                        <button
                          className={styles.actionButton}
                          onClick={guardAction(() => onEditInvoice(invoice.id))}
                          style={{ background: '#f3f4f6', color: '#374151' }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#e5e7eb'}
                          onMouseLeave={(e) => e.currentTarget.style.background = '#f3f4f6'}
                          aria-label={`Edit invoice ${invoice.invoice_number || ''}`}
                        >
                          Edit
                        </button>
                        <button
                          className={styles.actionButton}
                          onClick={guardAction(() => onDuplicateInvoice(invoice.id))}
                          style={{ background: '#f3f4f6', color: '#374151' }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#e5e7eb'}
                          onMouseLeave={(e) => e.currentTarget.style.background = '#f3f4f6'}
                          aria-label={`Duplicate invoice ${invoice.invoice_number || ''}`}
                        >
                          Duplicate
                        </button>
                        <button
                          className={styles.actionButton}
                          onClick={guardAction(() => setDeletingInvoiceId(invoice.id))}
                          style={{ background: '#dc2626', color: 'white' }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#b91c1c'}
                          onMouseLeave={(e) => e.currentTarget.style.background = '#dc2626'}
                          aria-label={`Delete invoice ${invoice.invoice_number || ''}`}
                        >
                          Delete
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

      {/* Delete Confirmation Dialog */}
      {deletingInvoiceId && (() => {
        const invoice = invoices.find(inv => inv.id === deletingInvoiceId);
        return (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
            }}
            onClick={() => setDeletingInvoiceId(null)}
          >
            <div
              style={{
                background: 'white',
                padding: '2rem',
                borderRadius: '0.5rem',
                maxWidth: '500px',
                width: '90%',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Delete Invoice?</h3>
              <p style={{ marginBottom: '1.5rem' }}>
                Are you sure you want to delete invoice <strong>{invoice?.invoice_number || 'this invoice'}</strong>
                {invoice?.vendor_name && ` from ${invoice.vendor_name}`}?
                This action cannot be undone.
              </p>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setDeletingInvoiceId(null)}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '0.375rem',
                    border: '1px solid #d1d5db',
                    background: 'white',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={guardAction(async () => {
                    await onArchiveInvoice(deletingInvoiceId);
                    setDeletingInvoiceId(null);
                  })}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '0.375rem',
                    border: 'none',
                    background: '#dc2626',
                    color: 'white',
                    cursor: 'pointer',
                  }}
                >
                  Delete Invoice
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
