/**
 * CPU Display Component
 *
 * Shows current manufacturing costs for finished products with component breakdowns.
 *
 * Features:
 * - Finished product CPU with expandable breakdown
 * - Missing cost data warnings
 * - Color-coded complete vs incomplete CPUs
 * - Accessible cards with keyboard navigation
 *
 * Requirements:
 * - Clean visual layout
 * - Clear breakdown of component costs
 * - WCAG 2.1 AA compliance
 */

import { useState, useEffect } from 'react';
import type { FinishedProductCPUBreakdown } from '../../services/cpg/cpuCalculator.service';
import { cpuCalculatorService } from '../../services/cpg/cpuCalculator.service';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../db/database';
import { HelpTooltip } from '../help/HelpTooltip';
import { CPUBreakdownModal } from './modals/CPUBreakdownModal';
import { ProductBreakdownModal } from './modals/ProductBreakdownModal';
import { InvoiceDetailsModal } from './modals/InvoiceDetailsModal';
import { AddInvoiceModal } from './modals/AddInvoiceModal';
import styles from './CPUDisplay.module.css';

export interface CPUDisplayProps {
  isLoading?: boolean;
  searchFilter?: string;
  statusFilter?: 'all' | 'complete' | 'incomplete';
  sortBy?: 'name' | 'cpu-asc' | 'cpu-desc' | 'missing';
}

export function CPUDisplay({
  isLoading = false,
  searchFilter = '',
  statusFilter = 'all',
  sortBy = 'name'
}: CPUDisplayProps) {
  const { companyId } = useAuth();

  const [products, setProducts] = useState<FinishedProductCPUBreakdown[]>([]);
  const [loading, setLoading] = useState(true);

  // Component breakdown modal (for individual raw materials)
  const [showBreakdownModal, setShowBreakdownModal] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState<{ categoryId: string; variant: string | null } | null>(null);

  // Product breakdown modal (for entire product)
  const [showProductBreakdown, setShowProductBreakdown] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<FinishedProductCPUBreakdown | null>(null);

  const [showInvoiceDetails, setShowInvoiceDetails] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);

  useEffect(() => {
    loadFinishedProductCPUs();
  }, [companyId]);

  // Listen for data updates (e.g., invoice edited, recipe changed)
  useEffect(() => {
    const handleDataUpdate = () => {
      console.log('CPUDisplay: Received data update event, reloading...');
      loadFinishedProductCPUs();
    };

    window.addEventListener('cpg-data-updated', handleDataUpdate);
    return () => window.removeEventListener('cpg-data-updated', handleDataUpdate);
  }, [companyId]);

  const loadFinishedProductCPUs = async () => {
    try {
      setLoading(true);

      // Get all finished products for this company
      const finishedProducts = await db.cpgFinishedProducts
        .where('company_id')
        .equals(companyId)
        .filter(product => product.active && product.deleted_at === null)
        .toArray();

      // Calculate CPU for each product
      const productCPUs: FinishedProductCPUBreakdown[] = [];
      for (const product of finishedProducts) {
        try {
          const cpuBreakdown = await cpuCalculatorService.getFinishedProductCPUBreakdown(
            product.id,
            companyId
          );
          productCPUs.push(cpuBreakdown);
        } catch (error) {
          console.error(`Failed to calculate CPU for product ${product.id}:`, error);
        }
      }

      setProducts(productCPUs);
    } catch (error) {
      console.error('Failed to load finished product CPUs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleShowProductBreakdown = (product: FinishedProductCPUBreakdown) => {
    setSelectedProduct(product);
    setShowProductBreakdown(true);
  };

  const handleComponentClick = (categoryId: string, variant: string | null) => {
    setSelectedComponent({ categoryId, variant });
    setShowBreakdownModal(true);
  };

  const handleViewInvoice = (invoiceId: string) => {
    setShowBreakdownModal(false);
    setSelectedInvoiceId(invoiceId);
    setShowInvoiceDetails(true);
  };

  const handleEditInvoice = (invoiceId: string) => {
    setShowInvoiceDetails(false);
    setShowBreakdownModal(false);
    setEditingInvoiceId(invoiceId);
    setShowInvoiceForm(true);
  };

  const handleInvoiceSaved = () => {
    setShowInvoiceForm(false);
    setEditingInvoiceId(null);
    loadFinishedProductCPUs();
  };

  if (isLoading || loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingGrid}>
          {[1, 2, 3].map((i) => (
            <div key={i} className={styles.skeletonCard} aria-label="Loading">
              <div className={styles.skeletonHeader} />
              <div className={styles.skeletonValue} />
              <div className={styles.skeletonLabel} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon} aria-hidden="true">
          📦
        </div>
        <p className={styles.emptyText}>
          No products defined yet. Add your first product to see manufacturing costs.
        </p>
      </div>
    );
  }

  // Apply filters and sorting
  let filteredProducts = products.filter((product) => {
    // Search filter
    if (searchFilter) {
      const searchLower = searchFilter.toLowerCase();
      const matchesName = product.productName.toLowerCase().includes(searchLower);
      const matchesSKU = product.sku?.toLowerCase().includes(searchLower);
      if (!matchesName && !matchesSKU) return false;
    }

    // Status filter
    if (statusFilter === 'complete' && !product.isComplete) return false;
    if (statusFilter === 'incomplete' && product.isComplete) return false;

    return true;
  });

  // Apply sorting
  filteredProducts = [...filteredProducts].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.productName.localeCompare(b.productName);
      case 'cpu-asc': {
        const aCPU = a.cpu ? parseFloat(a.cpu) : Infinity;
        const bCPU = b.cpu ? parseFloat(b.cpu) : Infinity;
        return aCPU - bCPU;
      }
      case 'cpu-desc': {
        const aCPU = a.cpu ? parseFloat(a.cpu) : -Infinity;
        const bCPU = b.cpu ? parseFloat(b.cpu) : -Infinity;
        return bCPU - aCPU;
      }
      case 'missing':
        return b.missingComponents.length - a.missingComponents.length;
      default:
        return 0;
    }
  });

  return (
    <div className={styles.container}>
      {filteredProducts.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon} aria-hidden="true">
            🔍
          </div>
          <p className={styles.emptyText}>
            No products match your filters. Try adjusting your search or filters.
          </p>
        </div>
      ) : (
        <div className={styles.grid}>
          {filteredProducts.map((product, index) => {
          const hasRecipe = product.breakdown.length > 0;
          const statusColor = product.isComplete ? '#10b981' : '#f59e0b'; // green : amber

          return (
            <article
              key={`${product.sku || product.productName}-${index}`}
              className={styles.card}
              style={{ '--category-color': statusColor } as React.CSSProperties}
            >
              <div className={styles.cardHeader}>
                <div
                  className={styles.categoryIndicator}
                  style={{ backgroundColor: statusColor }}
                  aria-hidden="true"
                />
                <div className={styles.cardTitle}>
                  <span className={styles.variantName}>{product.productName}</span>
                  {product.sku && (
                    <>
                      <span className={styles.variantSeparator}>•</span>
                      <span className={styles.categoryLabel}>{product.sku}</span>
                    </>
                  )}
                </div>
              </div>

              <div className={styles.cardContent}>
                {!hasRecipe ? (
                  <div className={styles.noRecipe}>
                    <span className={styles.warningIcon} aria-hidden="true">⚠️</span>
                    <span className={styles.noRecipeText}>No recipe defined</span>
                  </div>
                ) : product.cpu !== null ? (
                  <>
                    <div className={styles.cpuValue}>
                      <span className={styles.currency}>$</span>
                      <span className={styles.amount}>{product.cpu}</span>
                    </div>
                    <div className={styles.cpuLabel}>
                      Total Manufacturing Cost
                      <HelpTooltip content="This is the total cost to manufacture one unit, calculated from your recipe and raw material costs." />
                    </div>
                  </>
                ) : (
                  <>
                    <div className={styles.incompleteCPU}>
                      <span className={styles.incompleteText}>Incomplete</span>
                      <span className={styles.warningIcon} aria-hidden="true">⚠️</span>
                    </div>
                    <div className={styles.cpuLabel}>
                      Missing Cost Data
                    </div>
                  </>
                )}

                {product.msrp && (
                  <div className={styles.msrpInfo}>
                    <span className={styles.msrpLabel}>MSRP:</span>
                    <span className={styles.msrpValue}>${product.msrp}</span>
                  </div>
                )}
              </div>

              {hasRecipe && (
                <button
                  className={styles.breakdownToggle}
                  onClick={() => handleShowProductBreakdown(product)}
                  aria-label={`View cost breakdown for ${product.productName}`}
                >
                  <span>Show Breakdown</span>
                  <span className={styles.toggleIcon} aria-hidden="true">
                    →
                  </span>
                </button>
              )}
            </article>
          );
        })}
        </div>
      )}

      {/* Summary Section */}
      {filteredProducts.length > 0 && (
        <div className={styles.summary}>
          <div className={styles.summaryContent}>
            <span className={styles.summaryIcon} aria-hidden="true">
              ℹ️
            </span>
            <p className={styles.summaryText}>
              Manufacturing costs are calculated from your product recipes and the most recent raw material invoices. As you enter new invoices, these values will update automatically.
            </p>
          </div>
        </div>
      )}

      {/* CPU Breakdown Modal */}
      {showBreakdownModal && selectedComponent && (
        <CPUBreakdownModal
          isOpen={showBreakdownModal}
          onClose={() => {
            setShowBreakdownModal(false);
            setSelectedComponent(null);
          }}
          categoryId={selectedComponent.categoryId}
          variant={selectedComponent.variant}
          companyId={companyId}
          onViewInvoice={handleViewInvoice}
        />
      )}

      {/* Invoice Details Modal */}
      {showInvoiceDetails && selectedInvoiceId && (
        <InvoiceDetailsModal
          isOpen={showInvoiceDetails}
          onClose={() => {
            setShowInvoiceDetails(false);
            setSelectedInvoiceId(null);
          }}
          invoiceId={selectedInvoiceId}
          onEdit={handleEditInvoice}
        />
      )}

      {/* Invoice Edit Modal */}
      {(showInvoiceForm || editingInvoiceId) && (
        <AddInvoiceModal
          isOpen={showInvoiceForm || !!editingInvoiceId}
          onClose={() => {
            setShowInvoiceForm(false);
            setEditingInvoiceId(null);
          }}
          onSuccess={handleInvoiceSaved}
          invoiceId={editingInvoiceId || undefined}
        />
      )}

      {/* Product Breakdown Modal */}
      {showProductBreakdown && selectedProduct && (
        <ProductBreakdownModal
          isOpen={showProductBreakdown}
          onClose={() => {
            setShowProductBreakdown(false);
            setSelectedProduct(null);
          }}
          productName={selectedProduct.name}
          totalCPU={selectedProduct.totalCPU}
          isComplete={selectedProduct.isComplete}
          breakdown={selectedProduct.breakdown}
          missingComponents={selectedProduct.missingComponents}
          msrp={selectedProduct.msrp}
          onComponentClick={handleComponentClick}
        />
      )}
    </div>
  );
}
