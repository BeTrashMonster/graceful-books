/**
 * Vendor Intel Sub-Tab Component
 *
 * Displays vendor intelligence analysis with master-detail layout.
 *
 * Features:
 * - Master-detail UI with vendor/component views
 * - Vendor editing with cascade updates to invoices
 * - Expandable component rows showing contributing invoices
 * - Price comparison and savings identification
 * - CSV/PDF export
 *
 * Requirements:
 * - WCAG 2.1 AA compliance
 * - Type-safe implementation
 * - Print-friendly PDF export
 */

import React, { useState, useEffect, useMemo } from 'react';
import type { CPGCategory, CPGInvoice, CPGVendor } from '../../../../db/schema/cpg.schema';
import { db } from '../../../../db/database';
import styles from './VendorIntelTab.module.css';

export interface VendorIntelTabProps {
  companyId: string;
  selectedProducts: Set<string>;
  productCPUData: Map<string, ProductCPUData>;
  invoices: CPGInvoice[];
  categories: CPGCategory[];
  dateRange: '3mo' | '6mo' | '12mo' | 'last-calendar-year' | 'this-calendar-year' | 'custom' | 'all';
  customDateRange?: { start: number; end: number };
  categoryFilter?: Set<string>;
  variantFilter?: Set<string>;
  vendorFilter?: Set<string>;
}

interface ProductCPUData {
  cpu: string | null;
  margin: number | null;
  trend: 'up' | 'down' | 'stable';
  trendValue: string | null;
  topDriver: string | null;
  isComplete: boolean;
  breakdown: ComponentBreakdown[];
}

interface ComponentBreakdown {
  categoryId: string;
  categoryName: string;
  variant?: string;
  subtotal: string | null;
  isComplete: boolean;
}

interface VendorOverview {
  vendorName: string;
  totalSpend: number;
  invoiceCount: number;
  componentCount: number;
}

interface VendorPrice {
  vendor: string;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  purchaseCount: number;
}

interface VariantComparison {
  variant: string;
  vendorPrices: VendorPrice[];
  bestPrice: number;
  bestVendor: string;
  worstPrice: number;
}

interface ComponentComparison {
  categoryName: string;
  categoryId: string;
  variants: VariantComparison[];
  isBest?: boolean;
}

type SortColumn = 'vendor' | 'spend' | 'invoices' | 'components' | 'component' | 'bestPrice' | 'savings' | 'yourPrice' | 'status';

export default function VendorIntelTab({
  companyId,
  selectedProducts,
  productCPUData,
  invoices,
  categories,
  dateRange,
  customDateRange,
  categoryFilter = new Set(),
  variantFilter = new Set(),
  vendorFilter = new Set(),
}: VendorIntelTabProps) {
  // View mode and selection state
  const [viewMode, setViewMode] = useState<'component' | 'vendor'>('vendor');
  const [selectedVendor, setSelectedVendor] = useState<VendorOverview | null>(null);
  const [currentVendorRecord, setCurrentVendorRecord] = useState<CPGVendor | null>(null);
  const [isEditingVendor, setIsEditingVendor] = useState(false);
  const [editVendorName, setEditVendorName] = useState('');
  const [editVendorNotes, setEditVendorNotes] = useState('');

  // Expanded component state
  const [expandedComponent, setExpandedComponent] = useState<string | null>(null);

  // Local invoice state (for immediate updates)
  const [localInvoices, setLocalInvoices] = useState<CPGInvoice[]>(invoices);

  // Export and data state
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [vendorOverviews, setVendorOverviews] = useState<VendorOverview[]>([]);
  const [componentComparisons, setComponentComparisons] = useState<ComponentComparison[]>([]);

  // Sorting state
  const [vendorSortColumn, setVendorSortColumn] = useState<SortColumn>('spend');
  const [vendorSortDirection, setVendorSortDirection] = useState<'asc' | 'desc'>('desc');
  const [componentSortColumn, setComponentSortColumn] = useState<SortColumn>('component');
  const [componentSortDirection, setComponentSortDirection] = useState<'asc' | 'desc'>('asc');
  const [invoiceSortColumn, setInvoiceSortColumn] = useState<'invoice' | 'date' | 'total' | 'components'>('date');
  const [invoiceSortDirection, setInvoiceSortDirection] = useState<'asc' | 'desc'>('desc');

  // Update local invoices when props change
  useEffect(() => {
    setLocalInvoices(invoices);
  }, [invoices]);

  // Load vendor record when vendor is selected
  useEffect(() => {
    if (!selectedVendor) {
      setCurrentVendorRecord(null);
      return;
    }

    const loadVendor = async () => {
      try {
        const existing = await db.cpgVendors
          .where('company_id')
          .equals(companyId)
          .filter(v => v.name === selectedVendor.vendorName && !v.deleted_at)
          .first();

        if (existing) {
          setCurrentVendorRecord(existing);
        } else {
          // Auto-create vendor if doesn't exist
          const newVendor: CPGVendor = {
            id: crypto.randomUUID(),
            company_id: companyId,
            name: selectedVendor.vendorName,
            notes: null,
            active: true,
            created_at: Date.now(),
            updated_at: Date.now(),
            deleted_at: null,
            version_vector: { [companyId]: 1 },
          };
          await db.cpgVendors.add(newVendor);
          setCurrentVendorRecord(newVendor);
        }
      } catch (error) {
        console.error('Failed to load/create vendor:', error);
      }
    };

    loadVendor();
  }, [selectedVendor, companyId]);

  // Load vendor intelligence data
  useEffect(() => {
    loadVendorIntelligence();
  }, [selectedProducts, productCPUData, localInvoices, dateRange, customDateRange, categoryFilter, variantFilter, vendorFilter]);

  const loadVendorIntelligence = () => {
    if (selectedProducts.size === 0) {
      setVendorOverviews([]);
      setComponentComparisons([]);
      return;
    }

    try {
      const today = Date.now();
      let startDate = 0;
      let endDate = today;

      // Calculate date range
      switch (dateRange) {
        case '3mo':
          startDate = today - (90 * 24 * 60 * 60 * 1000);
          break;
        case '6mo':
          startDate = today - (180 * 24 * 60 * 60 * 1000);
          break;
        case '12mo':
          startDate = today - (365 * 24 * 60 * 60 * 1000);
          break;
        case 'last-calendar-year':
          const lastYear = new Date().getFullYear() - 1;
          startDate = new Date(lastYear, 0, 1).getTime();
          endDate = new Date(lastYear, 11, 31, 23, 59, 59).getTime();
          break;
        case 'this-calendar-year':
          const thisYear = new Date().getFullYear();
          startDate = new Date(thisYear, 0, 1).getTime();
          break;
        case 'custom':
          if (customDateRange) {
            startDate = customDateRange.start;
            endDate = customDateRange.end;
          }
          break;
        case 'all':
          startDate = 0;
          endDate = today;
          break;
      }

      // Filter invoices by date range
      const relevantInvoices = localInvoices.filter(inv => {
        if (inv.deleted_at) return false;
        if (startDate > 0 && inv.invoice_date < startDate) return false;
        if (endDate > 0 && inv.invoice_date > endDate) return false;
        return true;
      });

      // Normalize vendor names for comparison
      const normalizedVendorFilter = vendorFilter.size > 0
        ? new Set(Array.from(vendorFilter).map(v => v.trim().toLowerCase()))
        : new Set();

      // Filter by vendor
      const vendorFilteredInvoices = relevantInvoices.filter(inv => {
        if (normalizedVendorFilter.size > 0) {
          const vendorName = (inv.vendor_name || '').trim().toLowerCase();
          if (!normalizedVendorFilter.has(vendorName)) return false;
        }
        return true;
      });

      // Get all components from selected products
      const componentCategories = new Map<string, Set<string>>();

      selectedProducts.forEach(productId => {
        const cpuData = productCPUData.get(productId);
        if (cpuData?.breakdown) {
          cpuData.breakdown.forEach(comp => {
            if (categoryFilter.size > 0 && !categoryFilter.has(comp.categoryId)) return;
            if (variantFilter.size > 0 && !variantFilter.has(comp.variant || '')) return;

            if (!componentCategories.has(comp.categoryId)) {
              componentCategories.set(comp.categoryId, new Set());
            }
            componentCategories.get(comp.categoryId)!.add(comp.variant || '');
          });
        }
      });

      // Calculate vendor overviews
      const vendorStats = new Map<string, { spend: number; invoices: Set<string>; components: Set<string> }>();

      vendorFilteredInvoices.forEach(inv => {
        const vendor = inv.vendor_name || 'Unknown';

        if (!vendorStats.has(vendor)) {
          vendorStats.set(vendor, { spend: 0, invoices: new Set(), components: new Set() });
        }

        const stats = vendorStats.get(vendor)!;
        stats.invoices.add(inv.id);

        Object.entries(inv.cost_attribution || {}).forEach(([key, attr]) => {
          const variants = componentCategories.get(attr.category_id);
          if (variants && (variants.size === 0 || variants.has(attr.variant || ''))) {
            const unitPrice = parseFloat(attr.unit_price);
            const unitsPurchased = parseFloat(attr.units_purchased);

            if (!isNaN(unitPrice) && !isNaN(unitsPurchased)) {
              stats.spend += unitPrice * unitsPurchased;
              stats.components.add(`${attr.category_id}:${attr.variant || ''}`);
            }
          }
        });
      });

      const overviews: VendorOverview[] = Array.from(vendorStats.entries())
        .map(([vendorName, stats]) => ({
          vendorName,
          totalSpend: stats.spend,
          invoiceCount: stats.invoices.size,
          componentCount: stats.components.size,
        }))
        .filter(vendor => vendor.componentCount > 0); // Filter out vendors with 0 components

      setVendorOverviews(overviews);

      // Calculate component comparisons
      const categoryMap = new Map<string, VariantComparison[]>();

      for (const [categoryId, variants] of componentCategories.entries()) {
        const category = categories.find(c => c.id === categoryId);
        const categoryName = category?.name || 'Unknown';

        const variantComparisons: VariantComparison[] = [];

        for (const variant of variants) {
          const vendorPriceData = new Map<string, number[]>();

          relevantInvoices.forEach(inv => {
            const vendor = inv.vendor_name || 'Unknown';
            const normalizedVendor = vendor.trim().toLowerCase();

            if (normalizedVendorFilter.size > 0 && !normalizedVendorFilter.has(normalizedVendor)) {
              return;
            }

            Object.entries(inv.cost_attribution || {}).forEach(([key, attr]) => {
              if (attr.category_id === categoryId && (attr.variant || '') === variant) {
                const unitPrice = parseFloat(attr.unit_price);
                if (!isNaN(unitPrice) && unitPrice > 0) {
                  if (!vendorPriceData.has(vendor)) {
                    vendorPriceData.set(vendor, []);
                  }
                  vendorPriceData.get(vendor)!.push(unitPrice);
                }
              }
            });
          });

          if (vendorPriceData.size === 0) continue;

          const vendorPrices: VendorPrice[] = Array.from(vendorPriceData.entries())
            .map(([vendor, prices]) => ({
              vendor,
              avgPrice: prices.reduce((sum, p) => sum + p, 0) / prices.length,
              minPrice: Math.min(...prices),
              maxPrice: Math.max(...prices),
              purchaseCount: prices.length,
            }))
            .sort((a, b) => a.vendor.localeCompare(b.vendor));

          const allAvgPrices = vendorPrices.map(vp => vp.avgPrice);
          const bestPrice = Math.min(...allAvgPrices);
          const worstPrice = Math.max(...allAvgPrices);
          const bestVendor = vendorPrices.find(vp => vp.avgPrice === bestPrice)?.vendor || '';

          variantComparisons.push({
            variant,
            vendorPrices,
            bestPrice,
            bestVendor,
            worstPrice,
          });
        }

        if (variantComparisons.length > 0) {
          categoryMap.set(categoryId, variantComparisons);
        }
      }

      // Convert to array and sort
      const comparisons: ComponentComparison[] = Array.from(categoryMap.entries())
        .map(([categoryId, variants]) => {
          const category = categories.find(c => c.id === categoryId);
          return {
            categoryId,
            categoryName: category?.name || 'Unknown',
            variants: variants.sort((a, b) => a.variant.localeCompare(b.variant)),
          };
        })
        .sort((a, b) => a.categoryName.localeCompare(b.categoryName));

      setComponentComparisons(comparisons);
    } catch (err) {
      console.error('Failed to load vendor intelligence:', err);
    }
  };

  // Handle vendor save with cascade
  const handleSaveVendor = async () => {
    if (!currentVendorRecord) return;

    const oldName = currentVendorRecord.name;
    const newName = editVendorName.trim();
    const nameChanged = oldName !== newName;

    try {
      // Update vendor record
      await db.cpgVendors.update(currentVendorRecord.id, {
        name: newName,
        notes: editVendorNotes.trim() || null,
        updated_at: Date.now(),
      });

      // Cascade to invoices if name changed
      if (nameChanged) {
        const affectedInvoices = await db.cpgInvoices
          .where('company_id')
          .equals(companyId)
          .filter(inv => inv.vendor_name === oldName && !inv.deleted_at)
          .toArray();

        for (const invoice of affectedInvoices) {
          await db.cpgInvoices.update(invoice.id, {
            vendor_name: newName,
            updated_at: Date.now(),
          });
        }

        // Update local state immediately
        setLocalInvoices(prev =>
          prev.map(inv =>
            inv.vendor_name === oldName
              ? { ...inv, vendor_name: newName }
              : inv
          )
        );

        // Update selected vendor
        if (selectedVendor) {
          setSelectedVendor({
            ...selectedVendor,
            vendorName: newName,
          });
        }
      }

      setIsEditingVendor(false);
    } catch (error) {
      console.error('Failed to save vendor:', error);
    }
  };

  // Handle edit mode
  const handleEditVendor = () => {
    if (currentVendorRecord) {
      setEditVendorName(currentVendorRecord.name);
      setEditVendorNotes(currentVendorRecord.notes || '');
      setIsEditingVendor(true);
    }
  };

  // Get sorted vendor list
  const sortedVendors = useMemo(() => {
    return [...vendorOverviews].sort((a, b) => {
      let aVal: any, bVal: any;

      switch (vendorSortColumn) {
        case 'vendor':
          aVal = a.vendorName;
          bVal = b.vendorName;
          break;
        case 'spend':
          aVal = a.totalSpend;
          bVal = b.totalSpend;
          break;
        case 'invoices':
          aVal = a.invoiceCount;
          bVal = b.invoiceCount;
          break;
        case 'components':
          aVal = a.componentCount;
          bVal = b.componentCount;
          break;
        default:
          return 0;
      }

      if (typeof aVal === 'string') {
        return vendorSortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return vendorSortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [vendorOverviews, vendorSortColumn, vendorSortDirection]);

  // Get sorted component list
  const sortedComponents = useMemo(() => {
    return [...componentComparisons].sort((a, b) => {
      if (componentSortColumn === 'component') {
        return componentSortDirection === 'asc'
          ? a.categoryName.localeCompare(b.categoryName)
          : b.categoryName.localeCompare(a.categoryName);
      }
      return 0;
    });
  }, [componentComparisons, componentSortColumn, componentSortDirection]);

  // Export CSV
  const handleExportCSV = () => {
    const rows: string[] = [];
    rows.push('Vendor,Component,Variant,Average Price,Best Price,Savings');

    componentComparisons.forEach(comp => {
      comp.variants.forEach(variant => {
        variant.vendorPrices.forEach(vp => {
          const variantName = variant.variant || '';
          const savings = variant.worstPrice - vp.avgPrice;
          rows.push(
            `"${vp.vendor}","${comp.categoryName}","${variantName}","$${vp.avgPrice.toFixed(2)}","${vp.avgPrice === variant.bestPrice ? 'YES' : ''}","${savings > 0 ? '$' + savings.toFixed(2) : ''}"`
          );
        });
      });
    });

    const csv = rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vendor-intel-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  // Export PDF
  const handleExportPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.setTextColor(75, 0, 110);
    doc.text('Vendor Intelligence Report', 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 28);

    const tableData: any[] = [];
    componentComparisons.forEach(comp => {
      comp.variants.forEach(variant => {
        const componentName = variant.variant ? `${comp.categoryName} (${variant.variant})` : comp.categoryName;
        variant.vendorPrices.forEach(vp => {
          tableData.push([
            vp.vendor,
            componentName,
            `$${vp.avgPrice.toFixed(2)}`,
            vp.avgPrice === variant.bestPrice ? 'YES' : '',
          ]);
        });
      });
    });

    autoTable(doc, {
      head: [['Vendor', 'Component', 'Price', 'Best?']],
      body: tableData,
      startY: 35,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [75, 0, 110] },
    });

    doc.save(`vendor-intel-${new Date().toISOString().split('T')[0]}.pdf`);
    setShowExportMenu(false);
  };

  if (componentComparisons.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>🏪</div>
        <div className={styles.emptyTitle}>No vendor data available</div>
        <div className={styles.emptyDescription}>
          {selectedProducts.size === 0
            ? 'Select products to analyze vendor pricing'
            : 'No vendor data available for selected products'}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header with view mode toggle */}
      <div className={styles.header}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setViewMode('vendor')}
            style={{
              padding: '0.5rem 1rem',
              background: viewMode === 'vendor' ? '#4b006e' : 'white',
              color: viewMode === 'vendor' ? 'white' : '#64748b',
              border: viewMode === 'vendor' ? 'none' : '1px solid #e5e7eb',
              borderRadius: '6px',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            By Vendor
          </button>
          <button
            onClick={() => setViewMode('component')}
            style={{
              padding: '0.5rem 1rem',
              background: viewMode === 'component' ? '#4b006e' : 'white',
              color: viewMode === 'component' ? 'white' : '#64748b',
              border: viewMode === 'component' ? 'none' : '1px solid #e5e7eb',
              borderRadius: '6px',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            By Component
          </button>
        </div>

        <div className={styles.headerControls}>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className={styles.exportButton}
            >
              Export ▼
            </button>
            {showExportMenu && (
              <div className={styles.exportMenu}>
                <button onClick={handleExportCSV} className={styles.exportMenuItem}>
                  Export CSV
                </button>
                <button onClick={handleExportPDF} className={styles.exportMenuItem}>
                  Export PDF
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Master-Detail Layout */}
      <div style={{ display: 'flex', gap: '1.5rem', minHeight: '500px' }}>
        {/* Left Panel - Master List */}
        <div style={{
          width: '280px',
          flexShrink: 0,
          background: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          overflow: 'hidden',
        }}>
          {viewMode === 'vendor' ? (
            <>
              <div style={{
                padding: '1rem',
                background: 'linear-gradient(135deg, #4b006e 0%, #6b21a8 100%)',
                color: 'white',
                fontWeight: 600,
                fontSize: '0.875rem',
              }}>
                Vendors ({sortedVendors.length})
              </div>
              <div style={{ maxHeight: 'calc(100vh - 400px)', overflowY: 'auto' }}>
                {sortedVendors.map(vendor => {
                  const isSelected = selectedVendor?.vendorName === vendor.vendorName;
                  return (
                    <div
                      key={vendor.vendorName}
                      onClick={() => setSelectedVendor(vendor)}
                      style={{
                        padding: '0.875rem 1rem',
                        cursor: 'pointer',
                        borderBottom: '1px solid #f1f5f9',
                        background: isSelected ? '#f3e8ff' : 'white',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.background = '#fafbfc';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.background = 'white';
                      }}
                    >
                      <div style={{
                        fontWeight: 600,
                        fontSize: '0.875rem',
                        color: '#1e293b',
                        marginBottom: '0.25rem',
                      }}>
                        {vendor.vendorName}
                      </div>
                      <div style={{
                        fontSize: '0.75rem',
                        color: '#64748b',
                      }}>
                        ${vendor.totalSpend.toFixed(2)} · {vendor.componentCount} components
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <div style={{
                padding: '1rem',
                background: 'linear-gradient(135deg, #4b006e 0%, #6b21a8 100%)',
                color: 'white',
                fontWeight: 600,
                fontSize: '0.875rem',
              }}>
                Components ({sortedComponents.length})
              </div>
              <div style={{ maxHeight: 'calc(100vh - 400px)', overflowY: 'auto' }}>
                {sortedComponents.map(comp => (
                  <div
                    key={comp.categoryId}
                    style={{
                      padding: '0.875rem 1rem',
                      borderBottom: '1px solid #f1f5f9',
                      background: 'white',
                    }}
                  >
                    <div style={{
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      color: '#1e293b',
                      marginBottom: '0.25rem',
                    }}>
                      {comp.categoryName}
                    </div>
                    <div style={{
                      fontSize: '0.75rem',
                      color: '#64748b',
                    }}>
                      {comp.variants.length} variant{comp.variants.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Right Panel - Details */}
        <div style={{ flex: 1 }}>
          {viewMode === 'vendor' && selectedVendor ? (
            <div style={{
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '1.5rem',
            }}>
              {/* Vendor Details Header */}
              <div style={{
                background: 'linear-gradient(135deg, #4b006e 0%, #6b21a8 100%)',
                color: 'white',
                padding: '1.5rem',
                borderRadius: '8px',
                marginBottom: '1.5rem',
              }}>
                {isEditingVendor ? (
                  <div>
                    <input
                      type="text"
                      value={editVendorName}
                      onChange={(e) => setEditVendorName(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        fontSize: '1.25rem',
                        fontWeight: 700,
                        marginBottom: '0.5rem',
                        border: '1px solid white',
                        borderRadius: '4px',
                      }}
                    />
                    <textarea
                      value={editVendorNotes}
                      onChange={(e) => setEditVendorNotes(e.target.value)}
                      placeholder="Notes..."
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        fontSize: '0.875rem',
                        marginBottom: '0.75rem',
                        border: '1px solid white',
                        borderRadius: '4px',
                      }}
                    />
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={handleSaveVendor}
                        style={{
                          padding: '0.5rem 1rem',
                          background: 'white',
                          color: '#4b006e',
                          border: 'none',
                          borderRadius: '4px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setIsEditingVendor(false)}
                        style={{
                          padding: '0.5rem 1rem',
                          background: 'transparent',
                          color: 'white',
                          border: '1px solid white',
                          borderRadius: '4px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                          {selectedVendor.vendorName}
                        </div>
                        {currentVendorRecord?.notes && (
                          <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>
                            {currentVendorRecord.notes}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={handleEditVendor}
                        style={{
                          padding: '0.375rem 0.75rem',
                          background: 'rgba(255,255,255,0.2)',
                          color: 'white',
                          border: '1px solid rgba(255,255,255,0.3)',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Edit
                      </button>
                    </div>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '1rem',
                      marginTop: '1rem',
                    }}>
                      <div>
                        <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Total Spend</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                          ${selectedVendor.totalSpend.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Invoices</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                          {selectedVendor.invoiceCount}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Components</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                          {selectedVendor.componentCount}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Components from this vendor */}
              <h5 style={{
                fontSize: '1rem',
                fontWeight: 600,
                color: '#4b006e',
                marginBottom: '1rem',
              }}>
                Components from {selectedVendor.vendorName}
              </h5>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {componentComparisons
                  .filter(comp => comp.variants.some(v => v.vendorPrices.some(vp => vp.vendor === selectedVendor.vendorName)))
                  .map(comp => {
                    const relevantVariants = comp.variants.filter(v =>
                      v.vendorPrices.some(vp => vp.vendor === selectedVendor.vendorName)
                    );

                    return relevantVariants.map(variant => {
                      const vendorPrice = variant.vendorPrices.find(vp => vp.vendor === selectedVendor.vendorName);
                      if (!vendorPrice) return null;

                      const isBest = vendorPrice.avgPrice === variant.bestPrice;

                      return (
                        <div
                          key={`${comp.categoryId}-${variant.variant}`}
                          style={{
                            padding: '1rem',
                            background: isBest ? '#f3e8ff' : '#fafbfc',
                            border: `1px solid ${isBest ? '#e9d5ff' : '#e5e7eb'}`,
                            borderRadius: '6px',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#1e293b' }}>
                                {comp.categoryName}
                                {variant.variant && <span style={{ color: '#64748b' }}> · {variant.variant}</span>}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                                {vendorPrice.purchaseCount} purchase{vendorPrice.purchaseCount !== 1 ? 's' : ''}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#4b006e' }}>
                                ${vendorPrice.avgPrice.toFixed(2)}
                              </div>
                              {isBest && (
                                <div style={{
                                  fontSize: '0.6875rem',
                                  fontWeight: 600,
                                  color: '#6b21a8',
                                  background: '#f3e8ff',
                                  padding: '0.125rem 0.5rem',
                                  borderRadius: '3px',
                                  display: 'inline-block',
                                  marginTop: '0.25rem',
                                }}>
                                  Best Price
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })}
              </div>
            </div>
          ) : viewMode === 'component' ? (
            <div style={{
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '1.5rem',
            }}>
              <h5 style={{
                fontSize: '1rem',
                fontWeight: 600,
                color: '#4b006e',
                marginBottom: '1rem',
              }}>
                Component Price Comparison
              </h5>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {sortedComponents.map(comp => {
                  return comp.variants.map(variant => {
                    const bestVendorPrice = variant.vendorPrices.find(vp => vp.avgPrice === variant.bestPrice);

                    return (
                      <div
                        key={`${comp.categoryId}-${variant.variant}`}
                        style={{
                          border: '1px solid #e5e7eb',
                          borderRadius: '6px',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            padding: '1rem',
                            background: '#f3e8ff',
                            cursor: 'pointer',
                          }}
                          onClick={() => {
                            const key = `${comp.categoryId}-${variant.variant}`;
                            setExpandedComponent(expandedComponent === key ? null : key);
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#1e293b' }}>
                                {comp.categoryName}
                                {variant.variant && <span style={{ color: '#64748b' }}> · {variant.variant}</span>}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                                {variant.vendorPrices.length} vendor{variant.vendorPrices.length !== 1 ? 's' : ''}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#4b006e' }}>
                                ${variant.bestPrice.toFixed(2)}
                              </div>
                              {bestVendorPrice && (
                                <div style={{
                                  fontSize: '0.6875rem',
                                  fontWeight: 600,
                                  color: '#6b21a8',
                                  marginTop: '0.25rem',
                                }}>
                                  {bestVendorPrice.vendor}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {expandedComponent === `${comp.categoryId}-${variant.variant}` && (
                          <div style={{ padding: '1rem', background: 'white' }}>
                            <div style={{
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              color: '#64748b',
                              marginBottom: '0.75rem',
                            }}>
                              All Vendors
                            </div>
                            {variant.vendorPrices.map((vp, idx) => {
                              const isBest = vp.avgPrice === variant.bestPrice;
                              return (
                                <div
                                  key={idx}
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    padding: '0.75rem',
                                    background: isBest ? '#f3e8ff' : '#fafbfc',
                                    borderRadius: '4px',
                                    marginBottom: '0.5rem',
                                  }}
                                >
                                  <div>
                                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                                      {vp.vendor}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                      {vp.purchaseCount} purchase{vp.purchaseCount !== 1 ? 's' : ''}
                                    </div>
                                  </div>
                                  <div style={{ textAlign: 'right' }}>
                                    <div style={{
                                      fontSize: '1rem',
                                      fontWeight: 700,
                                      color: isBest ? '#4b006e' : '#64748b',
                                    }}>
                                      ${vp.avgPrice.toFixed(2)}
                                    </div>
                                    {isBest && (
                                      <div style={{
                                        fontSize: '0.625rem',
                                        fontWeight: 600,
                                        color: '#6b21a8',
                                      }}>
                                        Best Price
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  });
                })}
              </div>
            </div>
          ) : (
            <div style={{
              background: '#fafbfc',
              border: '2px dashed #e5e7eb',
              borderRadius: '8px',
              padding: '3rem',
              textAlign: 'center',
              color: '#64748b',
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👈</div>
              <div style={{ fontSize: '1rem', fontWeight: 500 }}>
                Select a vendor to view details
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
