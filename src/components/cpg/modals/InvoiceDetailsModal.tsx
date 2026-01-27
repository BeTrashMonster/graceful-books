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
import styles from './CPGModals.module.css';

export interface InvoiceDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceId: string;
}

export function InvoiceDetailsModal({ isOpen, onClose, invoiceId }: InvoiceDetailsModalProps) {
  const [invoice, setInvoice] = useState<CPGInvoice | null>(null);
  const [categories, setCategories] = useState<CPGCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
            <Button variant="primary" onClick={onClose}>
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
      footer={
        <div className={styles.modalFooter}>
          <Button variant="primary" onClick={onClose}>
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
                const lineTotal = parseFloat(item.units_purchased) * parseFloat(item.unit_price);

                return (
                  <div key={item.key} className={styles.categoryRow}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div className={styles.categoryHeader}>
                          {categoryName}
                          {item.variant && (
                            <span style={{ fontWeight: 400, color: '#64748b' }}> - {item.variant}</span>
                          )}
                        </div>
                        {item.description && (
                          <div style={{ marginTop: '0.25rem', color: '#64748b', fontSize: '0.875rem' }}>
                            {item.description}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 600, color: '#4b006e' }}>
                          {formatCurrency(lineTotal.toFixed(2))}
                        </div>
                      </div>
                    </div>

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
                        <div style={{ color: '#64748b', marginBottom: '0.25rem' }}>Units Purchased</div>
                        <div style={{ fontWeight: 500 }}>{parseFloat(item.units_purchased).toFixed(2)}</div>
                      </div>
                      <div>
                        <div style={{ color: '#64748b', marginBottom: '0.25rem' }}>Unit Price</div>
                        <div style={{ fontWeight: 500 }}>{formatCurrency(item.unit_price)}</div>
                      </div>
                      <div>
                        <div style={{ color: '#64748b', marginBottom: '0.25rem' }}>Units Received</div>
                        <div style={{ fontWeight: 500 }}>
                          {item.units_received
                            ? parseFloat(item.units_received).toFixed(2)
                            : parseFloat(item.units_purchased).toFixed(2)
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
            <div className={styles.sectionHeader}>Cost Per Unit (CPU) Breakdown</div>
            <div className={styles.exampleBox}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {Object.entries(invoice.calculated_cpus).map(([variant, cpu]) => (
                  <div key={variant} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>{variant}:</span>
                    <strong style={{ color: '#4b006e' }}>{formatCurrency(cpu)}</strong>
                  </div>
                ))}
              </div>
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
