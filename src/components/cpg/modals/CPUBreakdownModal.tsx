/**
 * CPU Breakdown Modal
 *
 * Shows detailed cost breakdown for a specific recipe component or finished product.
 * Displays all invoices that contributed to the cost calculation.
 *
 * Features:
 * - Invoice-by-invoice breakdown
 * - Category and variant details
 * - Units purchased, unit price, and cost contribution
 * - Final CPU calculation explanation
 * - Links to view invoice details
 *
 * This helps users understand and audit CPU calculations.
 */

import { useState, useEffect } from 'react';
import { Modal } from '../../modals/Modal';
import { Button } from '../../core/Button';
import { db } from '../../../db/database';
import type { CPGInvoice, CPGCategory } from '../../../db/schema/cpg.schema';
import styles from './CPGModals.module.css';

export interface CPUBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  categoryId: string;
  variant: string | null;
  companyId: string;
  onViewInvoice?: (invoiceId: string) => void;
}

interface InvoiceContribution {
  invoice: CPGInvoice;
  unitsPurchased: number;
  unitPrice: number;
  unitsReceived: number;
  totalCost: number;
  description?: string;
  hasManualOverride: boolean;
  calculatedTotal: number;
}

export function CPUBreakdownModal({
  isOpen,
  onClose,
  categoryId,
  variant,
  companyId,
  onViewInvoice,
}: CPUBreakdownModalProps) {
  const [category, setCategory] = useState<CPGCategory | null>(null);
  const [contributions, setContributions] = useState<InvoiceContribution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !categoryId) return;

    const loadBreakdown = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Load category
        const cat = await db.cpgCategories.get(categoryId);
        if (!cat) {
          setError('Category not found');
          return;
        }
        setCategory(cat);

        // Load all invoices for this company
        const invoices = await db.cpgInvoices
          .where('company_id')
          .equals(companyId)
          .filter(inv => inv.active && inv.deleted_at === null)
          .toArray();

        // Find invoices that contributed to this category/variant
        const relevantContributions: InvoiceContribution[] = [];

        for (const invoice of invoices) {
          if (!invoice.cost_attribution) continue;

          // Check each line item in the invoice
          for (const [key, item] of Object.entries(invoice.cost_attribution)) {
            if (item.category_id === categoryId) {
              // Check if variant matches (null means no variant specified)
              const itemVariant = item.variant || null;
              if (itemVariant === variant) {
                const calculatedTotal = parseFloat(item.units_purchased) * parseFloat(item.unit_price);
                const hasManualOverride = !!item.manual_line_total;
                const totalCost = hasManualOverride ? parseFloat(item.manual_line_total!) : calculatedTotal;

                relevantContributions.push({
                  invoice,
                  unitsPurchased: parseFloat(item.units_purchased),
                  unitPrice: parseFloat(item.unit_price),
                  unitsReceived: parseFloat(item.units_received || item.units_purchased),
                  totalCost,
                  description: item.description,
                  hasManualOverride,
                  calculatedTotal,
                });
              }
            }
          }
        }

        // Sort by invoice date (newest first)
        relevantContributions.sort((a, b) => b.invoice.invoice_date - a.invoice.invoice_date);

        setContributions(relevantContributions);
      } catch (err) {
        console.error('Failed to load CPU breakdown:', err);
        setError('Failed to load cost breakdown. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    loadBreakdown();
  }, [isOpen, categoryId, variant, companyId]);

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatCurrency = (value: number): string => {
    return `$${value.toFixed(2)}`;
  };

  // Calculate total units and total cost
  const totalUnits = contributions.reduce((sum, c) => sum + c.unitsReceived, 0);
  const totalCost = contributions.reduce((sum, c) => sum + c.totalCost, 0);
  const costPerUnit = totalUnits > 0 ? totalCost / totalUnits : 0;

  if (isLoading) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Cost Breakdown"
        size="lg"
      >
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ color: 'var(--color-text-secondary)' }}>
            Loading cost breakdown...
          </p>
        </div>
      </Modal>
    );
  }

  if (error || !category) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Cost Breakdown"
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
          {error || 'Category not found'}
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Cost Breakdown: ${category.name}${variant ? ` (${variant})` : ''}`}
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
        {/* Summary */}
        <div className={styles.exampleBox}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 500, color: '#64748b' }}>Category:</span>
              <strong>{category.name}</strong>
            </div>
            {variant && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 500, color: '#64748b' }}>Variant:</span>
                <strong>{variant}</strong>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.75rem', borderTop: '1px solid #e2e8f0' }}>
              <span style={{ fontWeight: 500, color: '#64748b' }}>Total Units Received:</span>
              <strong>{totalUnits.toFixed(2)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 500, color: '#64748b' }}>Total Cost Paid:</span>
              <strong>{formatCurrency(totalCost)}</strong>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              paddingTop: '0.75rem',
              borderTop: '2px solid #4b006e',
            }}>
              <span style={{ fontWeight: 600, color: '#4b006e', fontSize: '1.125rem' }}>Cost Per Unit:</span>
              <strong style={{ color: '#4b006e', fontSize: '1.25rem' }}>
                {formatCurrency(costPerUnit)}
              </strong>
            </div>
          </div>
        </div>

        {/* Calculation Explanation */}
        <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '8px', fontSize: '0.9375rem' }}>
          <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: '#4b006e' }}>
            How this was calculated:
          </div>
          <div style={{ color: '#64748b' }}>
            Cost Per Unit = Total Cost Paid ÷ Total Units Received
            <br />
            {formatCurrency(costPerUnit)} = {formatCurrency(totalCost)} ÷ {totalUnits.toFixed(2)} units
          </div>
        </div>

        {/* Invoice Contributions */}
        <div>
          <div className={styles.sectionHeader}>
            Invoice Contributions ({contributions.length} {contributions.length === 1 ? 'invoice' : 'invoices'})
          </div>

          {contributions.length === 0 ? (
            <div className={styles.categoryRow} style={{ textAlign: 'center' }}>
              <span style={{ color: '#64748b' }}>No invoices found for this category/variant</span>
              <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#94a3b8' }}>
                Add invoices in the "New Invoice" section to calculate costs.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {contributions.map((contribution, index) => (
                <div key={contribution.invoice.id} className={styles.categoryRow}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div>
                      <div className={styles.categoryHeader}>
                        Invoice #{index + 1}
                        {contribution.invoice.invoice_number && (
                          <span style={{ fontWeight: 400, color: '#64748b', marginLeft: '0.5rem' }}>
                            ({contribution.invoice.invoice_number})
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.25rem' }}>
                        {formatDate(contribution.invoice.invoice_date)}
                        {contribution.invoice.vendor_name && ` • ${contribution.invoice.vendor_name}`}
                      </div>
                      {contribution.description && (
                        <div style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.25rem', fontStyle: 'italic' }}>
                          {contribution.description}
                        </div>
                      )}
                    </div>
                    {onViewInvoice && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onViewInvoice(contribution.invoice.id)}
                      >
                        View Invoice
                      </Button>
                    )}
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: '1rem',
                    padding: '0.75rem',
                    backgroundColor: '#f8fafc',
                    borderRadius: '6px',
                  }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>
                        Units Purchased
                      </div>
                      <div style={{ fontWeight: 600 }}>
                        {contribution.unitsPurchased.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>
                        Unit Price
                      </div>
                      <div style={{ fontWeight: 600 }}>
                        {formatCurrency(contribution.unitPrice)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>
                        Units Received
                      </div>
                      <div style={{ fontWeight: 600 }}>
                        {contribution.unitsReceived.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {contribution.hasManualOverride && (
                    <div style={{
                      marginTop: '0.75rem',
                      padding: '0.5rem',
                      backgroundColor: '#fef3c7',
                      border: '1px solid #fde68a',
                      borderRadius: '4px',
                      fontSize: '0.8125rem',
                    }}>
                      <div style={{ fontWeight: 600, color: '#92400e', marginBottom: '0.25rem' }}>
                        ⚠️ Manual Total Override Applied
                      </div>
                      <div style={{ color: '#78350f', fontSize: '0.75rem' }}>
                        Calculated: {formatCurrency(contribution.calculatedTotal)} → Actual: {formatCurrency(contribution.totalCost)}
                      </div>
                    </div>
                  )}

                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: '0.75rem',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid #e2e8f0',
                  }}>
                    <span style={{ fontWeight: 500, color: '#64748b' }}>Cost from this invoice:</span>
                    <span style={{ fontWeight: 600, color: '#4b006e' }}>
                      {formatCurrency(contribution.totalCost)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Help Text */}
        <div style={{ padding: '1rem', backgroundColor: '#fef3c7', border: '1px solid #fde68a', borderRadius: '8px', fontSize: '0.875rem' }}>
          <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: '#92400e' }}>
            💡 How we calculate Cost Per Unit:
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.5rem', color: '#78350f' }}>
            <li>We use <strong>Units Received</strong> (not Units Purchased) for CPU calculation</li>
            <li>Manual line total overrides affect the total cost</li>
            <li>Only active, non-archived invoices are included</li>
            <li>All invoices contributing to this category/variant are shown above</li>
          </ul>
        </div>
      </div>
    </Modal>
  );
}
