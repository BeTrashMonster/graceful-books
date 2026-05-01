/**
 * Invoice Details Modal
 *
 * Displays full details of a CPG invoice including:
 * - Invoice metadata (number, date, vendor)
 * - All line items with descriptions
 * - Cost attribution breakdown by category and variant
 * - Total paid
 * - Notes
 *
 * Handles deleted categories gracefully by showing "Unknown Category (deleted)"
 */

import { useState, useEffect } from 'react';
import { Modal } from '../../modals/Modal';
import { Button } from '../../core/Button';
import { db } from '../../../db/database';
import type { CPGInvoice, CPGCategory } from '../../../db/schema/cpg.schema';
import { ShippingDistributionService } from '../../../services/cpg/shippingDistribution.service';
import styles from './CPGModals.module.css';

export interface InvoiceDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceId: string;
  onEdit?: (invoiceId: string) => void;
}

export function InvoiceDetailsModal({ isOpen, onClose, invoiceId, onEdit }: InvoiceDetailsModalProps) {
  const [invoice, setInvoice] = useState<CPGInvoice | null>(null);
  const [categories, setCategories] = useState<CPGCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Apply purple header styling when modal is open
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      // Find elements using more specific selectors
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return;

      // Modal header is the first child with h2 inside
      const modalTitle = dialog.querySelector('#modal-title') as HTMLElement;
      const modalHeader = modalTitle?.parentElement as HTMLElement;
      const closeButton = dialog.querySelector('[aria-label="Close modal"]') as HTMLElement;

      if (modalHeader) {
        modalHeader.style.backgroundColor = '#4b006e';
        modalHeader.style.padding = '0.75rem 1.5rem';
        modalHeader.style.borderBottom = 'none';
      }

      if (modalTitle) {
        modalTitle.style.color = '#ffffff';
      }

      if (closeButton) {
        closeButton.style.color = '#ffffff';
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !invoiceId) return;

    const loadInvoiceDetails = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Load the invoice
        const invoiceData = await db.cpgInvoices.get(invoiceId);
        if (!invoiceData) {
          setError('Invoice not found');
          return;
        }
        setInvoice(invoiceData);

        // Load all categories (including deleted ones to show their names)
        const categoriesData = await db.cpgCategories
          .where('company_id')
          .equals(invoiceData.company_id)
          .toArray();
        setCategories(categoriesData);

      } catch (err) {
        console.error('Failed to load invoice details:', err);
        setError('Oops! We had trouble loading this invoice. Let\'s try that again.');
      } finally {
        setIsLoading(false);
      }
    };

    loadInvoiceDetails();
  }, [isOpen, invoiceId]);

  const getCategoryName = (categoryId: string): string => {
    const category = categories.find(c => c.id === categoryId);
    if (!category) {
      return 'Unknown Category (deleted)';
    }
    if (category.deleted_at !== null) {
      return `${category.name} (deleted)`;
    }
    return category.name;
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatCurrency = (value: string): string => {
    return `$${parseFloat(value).toFixed(2)}`;
  };

  if (isLoading) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Invoice Details"
        size="lg"
      >
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ color: 'var(--color-text-secondary)' }}>
            Loading invoice details...
          </p>
        </div>
      </Modal>
    );
  }

  if (error || !invoice) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Invoice Details"
        size="lg"
        footer={
          <div className={styles.modalFooter}>
            <Button variant="gold" onClick={onClose}>
              Close
            </Button>
          </div>
        }
      >
        <div className={styles.errorAlert} role="alert">
          {error || 'Invoice not found'}
        </div>
      </Modal>
    );
  }

  // Extract line items from cost_attribution
  const lineItems = Object.entries(invoice.cost_attribution || {}).map(([key, item]) => ({
    key,
    ...item,
  }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Invoice Details"
      size="lg"
      closeOnBackdropClick={false}
      footer={
        <div className={styles.modalFooter}>
          {onEdit && !invoice?.deleted_at && (
            <Button
              variant="outline"
              onClick={() => {
                onEdit(invoiceId);
                onClose();
              }}
            >
              Edit Invoice
            </Button>
          )}
          <Button variant="gold" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <div className={styles.form}>
        {/* Invoice Metadata */}
        <div className={styles.exampleBox}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {invoice.invoice_number && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 500, color: '#64748b' }}>Invoice Number:</span>
                <strong>{invoice.invoice_number}</strong>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 500, color: '#64748b' }}>Date:</span>
              <strong>{formatDate(invoice.invoice_date)}</strong>
            </div>
            {invoice.vendor_name && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 500, color: '#64748b' }}>Vendor:</span>
                <strong>{invoice.vendor_name}</strong>
              </div>
            )}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              paddingTop: '0.75rem',
              borderTop: '1px solid #e2e8f0',
            }}>
              <span style={{ fontWeight: 500, color: '#64748b' }}>Total Paid:</span>
              <strong style={{ color: '#4b006e', fontSize: '1.125rem' }}>
                {formatCurrency(invoice.total_paid)}
              </strong>
            </div>
          </div>
        </div>

        {/* Line Items */}
        {lineItems.length > 0 && (
          <div>
            <div className={styles.sectionHeader}>Line Items</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {lineItems.map((item) => {
                const categoryName = getCategoryName(item.category_id);
                const unitsPurchased = parseFloat(item.units_purchased);
                const unitsReceived = item.units_received ? parseFloat(item.units_received) : unitsPurchased;
                const hasReconciliation = unitsReceived !== unitsPurchased;

                // Use manual line total if available, otherwise calculate
                const lineTotal = item.manual_line_total
                  ? parseFloat(item.manual_line_total)
                  : unitsPurchased * parseFloat(item.unit_price);

                return (
                  <div key={item.key} className={styles.categoryRow}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div className={styles.categoryHeader}>
                          {categoryName}
                          {item.variant && (
                            <span style={{ fontWeight: 400, color: '#64748b' }}> - {item.variant}</span>
                          )}
                          {item.distribution_method && (
                            <span style={{
                              marginLeft: '0.5rem',
                              fontSize: '0.75rem',
                              fontWeight: 400,
                              color: '#64748b',
                              fontStyle: 'italic'
                            }}>
                              ({item.distribution_method === 'equal' ? 'Equal Split' : 'Weighted'})
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 600, color: '#4b006e', fontSize: '1.125rem' }}>
                          {formatCurrency(lineTotal.toFixed(2))}
                        </div>
                      </div>
                    </div>

                    {/* For S+H lines, don't show unit breakdown - just a note */}
                    {!item.distribution_method ? (
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr 1fr',
                        gap: '1rem',
                        marginTop: '0.75rem',
                        paddingTop: '0.75rem',
                        borderTop: '1px solid #e2e8f0',
                        fontSize: '0.875rem',
                      }}>
                        <div>
                          <div style={{ color: '#64748b', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                            Units Purchased
                            {item.unit_of_measurement && (
                              <span style={{ fontWeight: 600, color: '#4b006e' }}> ({item.unit_of_measurement})</span>
                            )}
                          </div>
                          <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{unitsPurchased.toFixed(2)}</div>
                        </div>
                        <div>
                          <div style={{ color: '#64748b', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Unit Price</div>
                          <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{formatCurrency(item.unit_price)}</div>
                        </div>
                        <div>
                          <div style={{ color: '#64748b', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Units Received</div>
                          <div style={{
                            fontWeight: 600,
                            fontSize: '0.9375rem',
                            color: hasReconciliation ? '#f59e0b' : 'inherit'
                          }}>
                            {unitsReceived.toFixed(2)}
                            {hasReconciliation && (
                              <span style={{
                                marginLeft: '0.375rem',
                                fontSize: '0.75rem',
                                color: '#f59e0b',
                                fontWeight: 500
                              }}>
                                ({(unitsPurchased - unitsReceived).toFixed(0)} short)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{
                        marginTop: '0.75rem',
                        paddingTop: '0.75rem',
                        borderTop: '1px solid #e2e8f0',
                        fontSize: '0.875rem',
                        color: '#64748b',
                        fontStyle: 'italic'
                      }}>
                        This cost is distributed across material line items (see breakdown below)
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* S+H Distribution Breakdown */}
        {(() => {
          const shippingBreakdown = ShippingDistributionService.getInvoiceShippingBreakdown(invoice, categories);
          if (shippingBreakdown.length === 0) return null;

          return (
            <div>
              <div className={styles.sectionHeader}>
                Shipping + Handling Distribution
                <span style={{
                  marginLeft: '0.5rem',
                  fontSize: '0.75rem',
                  fontWeight: 400,
                  color: '#64748b',
                  fontStyle: 'italic'
                }}>
                  (allocated to material costs)
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {shippingBreakdown.map((shItem) => (
                  <div key={shItem.lineKey} className={styles.categoryRow}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <div>
                        <div className={styles.categoryHeader}>{shItem.lineName}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                          Method: {shItem.distributionMethod === 'equal' ? 'Equal Split' : 'Weighted by Value'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 600, color: '#4b006e', fontSize: '1.125rem' }}>
                          {formatCurrency(shItem.shTotal)}
                        </div>
                      </div>
                    </div>

                    <div style={{
                      paddingTop: '0.75rem',
                      borderTop: '1px solid #e2e8f0',
                    }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem', fontWeight: 500 }}>
                        Distributed to:
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', fontSize: '0.875rem' }}>
                        {Object.entries(shItem.breakdown.distribution).map(([lineKey, amount]) => {
                          const lineItem = invoice.cost_attribution[lineKey];
                          if (!lineItem) return null;

                          const lineCategoryName = getCategoryName(lineItem.category_id);
                          return (
                            <div key={lineKey} style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '1rem' }}>
                              <span style={{ color: '#64748b' }}>
                                {lineCategoryName}
                                {lineItem.variant && <span> - {lineItem.variant}</span>}
                              </span>
                              <span style={{ fontWeight: 600 }}>{formatCurrency(amount)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Additional Costs */}
        {invoice.additional_costs && Object.keys(invoice.additional_costs).length > 0 && (
          <div>
            <div className={styles.sectionHeader}>Additional Costs</div>
            <div className={styles.exampleBox}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {Object.entries(invoice.additional_costs).map(([name, amount]) => (
                  <div key={name} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>{name}:</span>
                    <strong>{formatCurrency(amount)}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Calculated CPUs */}
        {invoice.calculated_cpus && Object.keys(invoice.calculated_cpus).length > 0 && (
          <div>
            <div className={styles.sectionHeader}>
              True Cost Per Unit
              <span style={{
                marginLeft: '0.5rem',
                fontSize: '0.75rem',
                fontWeight: 400,
                color: '#64748b',
                fontStyle: 'italic'
              }}>
                (based on units received)
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {Object.entries(invoice.calculated_cpus).map(([categoryVariantKey, cpu]) => {
                // Parse the key to extract category ID and variant
                const lastUnderscoreIndex = categoryVariantKey.lastIndexOf('_');
                let categoryId: string;
                let variant: string | null = null;

                if (lastUnderscoreIndex !== -1) {
                  categoryId = categoryVariantKey.substring(0, lastUnderscoreIndex);
                  variant = categoryVariantKey.substring(lastUnderscoreIndex + 1);
                } else {
                  categoryId = categoryVariantKey;
                }

                const categoryName = getCategoryName(categoryId);
                const displayName = variant ? `${categoryName} (${variant})` : categoryName;

                return (
                  <div
                    key={categoryVariantKey}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.75rem 1rem',
                      background: '#f9fafb',
                      borderRadius: '6px',
                      border: '1px solid #e5e7eb',
                    }}
                  >
                    <span style={{ fontWeight: 500, color: '#374151' }}>{displayName}</span>
                    <strong style={{ color: '#4b006e', fontSize: '1.125rem' }}>{formatCurrency(cpu)}</strong>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Notes */}
        {invoice.notes && (
          <div>
            <div className={styles.sectionHeader}>Notes</div>
            <div className={styles.exampleBox}>
              <div style={{ color: '#64748b', whiteSpace: 'pre-wrap' }}>
                {invoice.notes}
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
