/**
 * Vendor Intel Sub-Tab Component
 *
 * Displays vendor intelligence analysis for selected products.
 *
 * Features:
 * - Multi-vendor price comparison per component
 * - Best price identification
 * - Savings opportunity calculations
 * - Vendor statistics overview
 * - Sortable comparison table
 * - Export functionality
 *
 * Requirements:
 * - Receives selected products from parent CostIntelligenceTab
 * - Calculates vendor pricing analytics from invoices
 * - WCAG 2.1 AA compliance
 * - Type-safe implementation
 */

import { useState, useEffect, useMemo } from 'react';
import type { CPGCategory, CPGInvoice } from '../../../../db/schema/cpg.schema';

export interface VendorIntelTabProps {
  companyId: string;
  selectedProducts: Set<string>;
  productCPUData: Map<string, ProductCPUData>;
  invoices: CPGInvoice[];
  categories: CPGCategory[];
}

interface ProductCPUData {
  cpu: string | null;
  margin: number | null;
  trend: 'up' | 'down' | 'stable';
  trendValue: string | null;
  topDriver: string | null;
  isComplete: boolean;
  breakdown: any[];
}

interface VendorIntelData {
  vendors: Map<string, number[]>;
  vendorAvgPrices: Map<string, number>;
  bestPrice: number;
  avgPrice: number;
  maxSavings: number;
  topVendor: string;
  topVendorSpend: number;
  topVendorPercent: number;
  vendorConcentration: boolean;
  priceAnomaly: boolean;
  anomalyVendor: string;
  anomalyDeviation: number;
}

type VendorSortColumn = 'component' | 'bestPrice' | 'savings';
type SortDirection = 'asc' | 'desc';

export default function VendorIntelTab({
  companyId,
  selectedProducts,
  productCPUData,
  invoices,
  categories,
}: VendorIntelTabProps) {
  // State
  const [vendorIntelData, setVendorIntelData] = useState<Map<string, VendorIntelData>>(new Map());
  const [vendorSortColumn, setVendorSortColumn] = useState<VendorSortColumn>('component');
  const [vendorSortDirection, setVendorSortDirection] = useState<SortDirection>('asc');
  const [showVendorExportMenu, setShowVendorExportMenu] = useState(false);

  // Calculate vendor intelligence data
  useEffect(() => {
    if (!companyId || selectedProducts.size === 0) {
      setVendorIntelData(new Map());
      return;
    }

    const loadVendorIntelData = async () => {
      try {
        const intelMap = new Map<string, VendorIntelData>();

        // Get all unique component categories from selected products
        const componentCategories = new Set<string>();
        selectedProducts.forEach(productId => {
          const cpuData = productCPUData.get(productId);
          if (cpuData?.breakdown) {
            cpuData.breakdown.forEach(comp => componentCategories.add(comp.categoryId));
          }
        });

        // Analyze each component
        for (const categoryId of componentCategories) {
          const relevantInvoices = invoices.filter(inv =>
            Object.entries(inv.cost_attribution || {}).some(([_, attr]) =>
              attr.category_id === categoryId
            )
          );

          if (relevantInvoices.length === 0) continue;

          // Group by vendor
          const vendorPrices = new Map<string, number[]>();
          const vendorTotals = new Map<string, number>();

          relevantInvoices.forEach(inv => {
            const vendor = inv.vendor_name || 'Unknown';
            Object.entries(inv.cost_attribution || {}).forEach(([_, attr]) => {
              if (attr.category_id === categoryId) {
                const unitPrice = parseFloat(attr.unit_price);
                const unitsPurchased = parseFloat(attr.units_purchased);
                const lineTotal = unitPrice * unitsPurchased;

                if (!isNaN(unitPrice) && unitPrice > 0) {
                  if (!vendorPrices.has(vendor)) {
                    vendorPrices.set(vendor, []);
                    vendorTotals.set(vendor, 0);
                  }
                  vendorPrices.get(vendor)!.push(unitPrice);
                  vendorTotals.set(vendor, (vendorTotals.get(vendor) || 0) + lineTotal);
                }
              }
            });
          });

          if (vendorPrices.size === 0) continue;

          // Calculate vendor stats
          const vendorAvgPrices = new Map<string, number>();
          vendorPrices.forEach((prices, vendor) => {
            const avg = prices.reduce((sum, p) => sum + p, 0) / prices.length;
            vendorAvgPrices.set(vendor, avg);
          });

          const bestPrice = Math.min(...Array.from(vendorAvgPrices.values()));
          const avgPrice = Array.from(vendorAvgPrices.values()).reduce((sum, p) => sum + p, 0) / vendorAvgPrices.size;
          const maxSavings = avgPrice - bestPrice;

          // Find top vendor by spend
          let topVendor = '';
          let topVendorSpend = 0;
          vendorTotals.forEach((spend, vendor) => {
            if (spend > topVendorSpend) {
              topVendorSpend = spend;
              topVendor = vendor;
            }
          });

          const totalSpend = Array.from(vendorTotals.values()).reduce((sum, s) => sum + s, 0);
          const topVendorPercent = (topVendorSpend / totalSpend) * 100;

          // Detect price anomalies
          const priceValues = Array.from(vendorAvgPrices.values());
          const priceAvg = priceValues.reduce((sum, p) => sum + p, 0) / priceValues.length;

          let anomalyVendor = '';
          let anomalyDeviation = 0;
          vendorAvgPrices.forEach((price, vendor) => {
            const deviation = ((price - priceAvg) / priceAvg) * 100;
            if (Math.abs(deviation) > Math.abs(anomalyDeviation) && Math.abs(deviation) > 20) {
              anomalyVendor = vendor;
              anomalyDeviation = deviation;
            }
          });

          intelMap.set(categoryId, {
            vendors: vendorPrices,
            vendorAvgPrices,
            bestPrice,
            avgPrice,
            maxSavings,
            topVendor,
            topVendorSpend,
            topVendorPercent,
            vendorConcentration: topVendorPercent > 80,
            priceAnomaly: anomalyVendor !== '',
            anomalyVendor,
            anomalyDeviation,
          });
        }

        setVendorIntelData(intelMap);
      } catch (err) {
        console.error('Failed to load vendor intel data:', err);
      }
    };

    loadVendorIntelData();
  }, [companyId, selectedProducts, productCPUData, invoices]);

  // Calculate overall vendor statistics
  const overallStats = useMemo(() => {
    const allVendors = new Set<string>();
    let totalSpend = 0;
    let totalInvoices = 0;

    vendorIntelData.forEach(intel => {
      intel.vendors?.forEach((_prices: number[], vendor: string) => allVendors.add(vendor));
    });

    invoices.forEach(inv => {
      totalInvoices++;
      // Calculate total spend from cost_attribution
      Object.values(inv.cost_attribution || {}).forEach(attr => {
        const unitPrice = parseFloat(attr.unit_price);
        const unitsPurchased = parseFloat(attr.units_purchased);
        if (!isNaN(unitPrice) && !isNaN(unitsPurchased)) {
          totalSpend += unitPrice * unitsPurchased;
        }
      });
    });

    return {
      vendorCount: allVendors.size,
      totalSpend,
      invoiceCount: totalInvoices,
      componentCount: vendorIntelData.size,
    };
  }, [vendorIntelData, invoices]);

  // Sort vendor intel data
  const sortedVendorData = useMemo(() => {
    return Array.from(vendorIntelData.entries())
      .map(([categoryId, intel]) => {
        const category = categories.find(c => c.id === categoryId);
        return { categoryId, intel, categoryName: category?.name || 'Unknown' };
      })
      .sort((a, b) => {
        let aVal: any, bVal: any;
        switch (vendorSortColumn) {
          case 'component':
            aVal = a.categoryName;
            bVal = b.categoryName;
            break;
          case 'bestPrice':
            aVal = a.intel.bestPrice;
            bVal = b.intel.bestPrice;
            break;
          case 'savings':
            aVal = a.intel.maxSavings;
            bVal = b.intel.maxSavings;
            break;
          default:
            return 0;
        }
        if (typeof aVal === 'string') {
          return vendorSortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        return vendorSortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      });
  }, [vendorIntelData, categories, vendorSortColumn, vendorSortDirection]);

  // Handle column sort
  const handleSort = (column: VendorSortColumn) => {
    if (vendorSortColumn === column) {
      setVendorSortDirection(vendorSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setVendorSortColumn(column);
      setVendorSortDirection('asc');
    }
  };

  if (vendorIntelData.size === 0) {
    return (
      <div
        role="tabpanel"
        id="vendors-panel"
        aria-labelledby="vendors-tab"
        style={{
          padding: '3rem',
          textAlign: 'center',
          color: '#64748b',
          background: '#f8fafc',
          borderRadius: '8px',
        }}
      >
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }} aria-hidden="true">
          🏪
        </div>
        <p style={{ fontSize: '1rem', fontWeight: 500 }}>
          Select products to analyze vendor pricing
        </p>
      </div>
    );
  }

  return (
    <div role="tabpanel" id="vendors-panel" aria-labelledby="vendors-tab">
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.25rem' }}>
            Vendor Intelligence
          </h3>
          <p style={{ fontSize: '0.875rem', color: '#64748b' }}>
            Compare vendor pricing and identify savings opportunities
          </p>
        </div>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowVendorExportMenu(!showVendorExportMenu)}
            aria-expanded={showVendorExportMenu}
            aria-label="Export vendor intelligence data"
            style={{
              padding: '0.5rem 1rem',
              background: '#4b006e',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Export {showVendorExportMenu ? '▲' : '▼'}
          </button>
          {showVendorExportMenu && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: '100%',
                marginTop: '0.25rem',
                background: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                zIndex: 10,
                minWidth: '150px',
              }}
            >
              <button
                onClick={() => {
                  setShowVendorExportMenu(false);
                  // TODO: Implement CSV export
                }}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  border: 'none',
                  background: 'white',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Export CSV
              </button>
              <button
                onClick={() => {
                  setShowVendorExportMenu(false);
                  // TODO: Implement PDF export
                }}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  border: 'none',
                  background: 'white',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  borderTop: '1px solid #e5e7eb',
                }}
              >
                Export PDF
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Vendor Overview Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div
          style={{
            padding: '1rem',
            background: 'linear-gradient(135deg, #4b006e 0%, #6b21a8 100%)',
            color: 'white',
            borderRadius: '8px',
          }}
        >
          <div style={{ fontSize: '0.75rem', opacity: 0.9, marginBottom: '0.25rem' }}>
            TOTAL VENDORS
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>{overallStats.vendorCount}</div>
        </div>
        <div
          style={{
            padding: '1rem',
            background: '#f8fafc',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>
            TOTAL SPEND
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>
            ${overallStats.totalSpend.toFixed(2)}
          </div>
        </div>
        <div
          style={{
            padding: '1rem',
            background: '#f8fafc',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>
            INVOICES
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>{overallStats.invoiceCount}</div>
        </div>
        <div
          style={{
            padding: '1rem',
            background: '#f8fafc',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>
            COMPONENTS
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>{overallStats.componentCount}</div>
        </div>
      </div>

      {/* Vendor Comparison Table */}
      <div
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
              <th
                onClick={() => handleSort('component')}
                style={{
                  padding: '0.75rem 1rem',
                  textAlign: 'left',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#64748b',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
                role="columnheader"
                aria-sort={vendorSortColumn === 'component' ? (vendorSortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                COMPONENT {vendorSortColumn === 'component' && (vendorSortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th
                style={{
                  padding: '0.75rem 1rem',
                  textAlign: 'right',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#64748b',
                }}
                role="columnheader"
              >
                VENDORS
              </th>
              <th
                onClick={() => handleSort('bestPrice')}
                style={{
                  padding: '0.75rem 1rem',
                  textAlign: 'right',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#64748b',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
                role="columnheader"
                aria-sort={vendorSortColumn === 'bestPrice' ? (vendorSortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                BEST PRICE {vendorSortColumn === 'bestPrice' && (vendorSortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th
                style={{
                  padding: '0.75rem 1rem',
                  textAlign: 'right',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#64748b',
                }}
                role="columnheader"
              >
                AVG PRICE
              </th>
              <th
                onClick={() => handleSort('savings')}
                style={{
                  padding: '0.75rem 1rem',
                  textAlign: 'right',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#64748b',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
                role="columnheader"
                aria-sort={vendorSortColumn === 'savings' ? (vendorSortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                POTENTIAL SAVINGS {vendorSortColumn === 'savings' && (vendorSortDirection === 'asc' ? '↑' : '↓')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedVendorData.map(({ categoryId, intel, categoryName }) => {
              const savingsPercent = intel.avgPrice > 0 ? (intel.maxSavings / intel.avgPrice) * 100 : 0;
              const hasSavings = savingsPercent > 0;

              return (
                <tr key={categoryId} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{categoryName}</td>
                  <td
                    style={{
                      padding: '0.75rem 1rem',
                      textAlign: 'right',
                      color: '#64748b',
                      fontSize: '0.875rem',
                    }}
                  >
                    {intel.vendors?.size || 0}
                  </td>
                  <td
                    style={{
                      padding: '0.75rem 1rem',
                      textAlign: 'right',
                      color: '#16a34a',
                      fontWeight: 600,
                    }}
                  >
                    ${intel.bestPrice.toFixed(2)}
                  </td>
                  <td
                    style={{
                      padding: '0.75rem 1rem',
                      textAlign: 'right',
                      color: '#64748b',
                    }}
                  >
                    ${intel.avgPrice.toFixed(2)}
                  </td>
                  <td
                    style={{
                      padding: '0.75rem 1rem',
                      textAlign: 'right',
                      color: hasSavings ? '#dc2626' : '#64748b',
                      fontWeight: hasSavings ? 600 : 400,
                    }}
                  >
                    {hasSavings ? (
                      <>
                        ${intel.maxSavings.toFixed(2)} ({savingsPercent.toFixed(1)}%)
                      </>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
