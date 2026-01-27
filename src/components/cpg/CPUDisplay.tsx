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
import { InvoiceDetailsModal } from './modals/InvoiceDetailsModal';
import { AddInvoiceModal } from './modals/AddInvoiceModal';
import styles from './CPUDisplay.module.css';

export interface CPUDisplayProps {
  isLoading?: boolean;
}

interface ExpandedState {
  [productId: string]: boolean;
}

export function CPUDisplay({ isLoading = false }: CPUDisplayProps) {
  const { companyId } = useAuth();
  const activeCompanyId = companyId || 'demo-company-id';

  const [products, setProducts] = useState<FinishedProductCPUBreakdown[]>([]);
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [loading, setLoading] = useState(true);
  const [showBreakdownModal, setShowBreakdownModal] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState<{ categoryId: string; variant: string | null } | null>(null);
  const [showInvoiceDetails, setShowInvoiceDetails] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);

  useEffect(() => {
    loadFinishedProductCPUs();
  }, [activeCompanyId]);

  // Listen for data updates (e.g., invoice edited, recipe changed)
  useEffect(() => {
    const handleDataUpdate = () => {
      console.log('CPUDisplay: Received data update event, reloading...');
      loadFinishedProductCPUs();
    };

    window.addEventListener('cpg-data-updated', handleDataUpdate);
    return () => window.removeEventListener('cpg-data-updated', handleDataUpdate);
  }, [activeCompanyId]);

  const loadFinishedProductCPUs = async () => {
    try {
      setLoading(true);

      // Get all finished products for this company
      const finishedProducts = await db.cpgFinishedProducts
        .where('company_id')
        .equals(activeCompanyId)
        .filter(product => product.active && product.deleted_at === null)
        .toArray();

      // Calculate CPU for each product
      const productCPUs: FinishedProductCPUBreakdown[] = [];
      for (const product of finishedProducts) {
        try {
          const cpuBreakdown = await cpuCalculatorService.getFinishedProductCPUBreakdown(
            product.id,
            activeCompanyId
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

  const toggleExpanded = (index: number) => {
    setExpanded(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
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

  return (
    <div className={styles.container}>
      <div className={styles.grid}>
        {products.map((product, index) => {
          const isExpanded = expanded[index] || false;
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
                <>
                  <button
                    className={styles.breakdownToggle}
                    onClick={() => toggleExpanded(index)}
                    aria-expanded={isExpanded}
                    aria-controls={`breakdown-${index}`}
                  >
                    <span>{isExpanded ? 'Hide' : 'Show'} Breakdown</span>
                    <span className={styles.toggleIcon} aria-hidden="true">
                      {isExpanded ? '▲' : '▼'}
                    </span>
                  </button>

                  {isExpanded && (
                    <div
                      id={`breakdown-${index}`}
                      className={styles.breakdown}
                      role="region"
                      aria-label="Cost breakdown"
                    >
                      <div className={styles.breakdownHeader}>
                        <span className={styles.breakdownTitle}>Component Costs:</span>
                      </div>
                      <ul className={styles.breakdownList}>
                        {product.breakdown.map((component, idx) => (
                          <li
                            key={idx}
                            className={`${styles.breakdownItem} ${component.hasCostData ? styles.clickable : ''}`}
                            onClick={() => component.hasCostData && component.categoryId && handleComponentClick(component.categoryId, component.variant || null)}
                            role={component.hasCostData ? 'button' : undefined}
                            tabIndex={component.hasCostData ? 0 : undefined}
                            onKeyDown={(e) => {
                              if (component.hasCostData && component.categoryId && (e.key === 'Enter' || e.key === ' ')) {
                                e.preventDefault();
                                handleComponentClick(component.categoryId, component.variant || null);
                              }
                            }}
                            style={{ cursor: component.hasCostData ? 'pointer' : 'default' }}
                            title={component.hasCostData ? 'Click to see detailed cost breakdown' : undefined}
                          >
                            <div className={styles.componentInfo}>
                              <span className={styles.componentName}>
                                {component.categoryName}
                                {component.variant && ` (${component.variant})`}
                                {component.hasCostData && (
                                  <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: '#4a90e2' }}>
                                    🔍
                                  </span>
                                )}
                              </span>
                              <span className={styles.componentQty}>
                                {component.quantity} {component.unitOfMeasure}
                              </span>
                            </div>
                            <div className={styles.componentCost}>
                              {component.hasCostData && component.subtotal ? (
                                <span className={styles.costValue}>${component.subtotal}</span>
                              ) : (
                                <span className={styles.awaitingData} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <span className={styles.warningIcon} aria-hidden="true">⚠️</span>
                                  <span>Add invoices to calculate</span>
                                  <HelpTooltip
                                    content={`Once you enter invoices for ${component.categoryName}${component.variant ? ` (${component.variant})` : ''}, we'll automatically calculate the cost per unit. Go to the Invoice Timeline to add your invoices.`}
                                    position="left"
                                  />
                                </span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>

                      {!product.isComplete && product.missingComponents.length > 0 && (
                        <div className={styles.missingData}>
                          <p className={styles.missingDataTitle}>
                            <span className={styles.warningIcon} aria-hidden="true">⚠️</span>
                            Missing cost data for:
                          </p>
                          <ul className={styles.missingList}>
                            {product.missingComponents.map((component, idx) => (
                              <li key={idx} className={styles.missingItem}>{component}</li>
                            ))}
                          </ul>
                          <p className={styles.missingHelp}>
                            Enter an invoice for these raw materials to complete CPU calculation.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </article>
          );
        })}
      </div>

      {/* Summary Section */}
      {products.length > 0 && (
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
          companyId={activeCompanyId}
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
    </div>
  );
}
