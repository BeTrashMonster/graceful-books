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
import { useCPGSettingsContext } from '../../../contexts/CPGSettingsContext';
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

  // Get formatting functions from context (respects user decimal settings)
  const { formatCurrency } = useCPGSettingsContext();

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
        closeOnBackdropClick={false}
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
        closeOnBackdropClick={false}
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
      title={`${category.name}${variant ? ` (${variant})` : ''}`}
      size="lg"
      closeOnBackdropClick={false}
      footer={
        <div className={styles.modalFooter}>
          <Button variant="primary" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <div className={styles.form}>
        {/* Hero Answer */}
        <div style={{
          padding: '1.5rem',
          background: 'linear-gradient(135deg, #4b006e 0%, #6b1a8f 100%)',
          borderRadius: '12px',
          textAlign: 'center',
          color: 'white',
        }}>
          <div style={{ fontSize: '0.875rem', opacity: 0.9, marginBottom: '0.5rem' }}>
            Current Cost Per Unit
          </div>
          <div style={{ fontSize: '3rem', fontWeight: 700, lineHeight: 1 }}>
            {formatCurrency(costPerUnit)}
          </div>
          <div style={{ fontSize: '0.875rem', opacity: 0.8, marginTop: '0.75rem' }}>
            {totalUnits.toFixed(0)} units from {contributions.length} {contributions.length === 1 ? 'invoice' : 'invoices'}
          </div>
        </div>

        {/* Invoice Table */}
        {contributions.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '3rem 2rem',
            background: '#f9fafb',
            borderRadius: '8px',
            border: '2px dashed #e5e7eb',
          }}>
            <span style={{ fontSize: '2rem', display: 'block', marginBottom: '1rem' }}>📋</span>
            <span style={{ color: '#64748b', fontSize: '1.125rem', display: 'block', marginBottom: '0.5rem' }}>
              No invoices found
            </span>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#94a3b8' }}>
              Add invoices to calculate costs for this item
            </p>
          </div>
        ) : (
          <>
            <div>
              <div className={styles.sectionHeader}>Invoice Breakdown</div>
              <div style={{
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                overflow: 'hidden',
              }}>
                {/* Table Header */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1.5fr 1.5fr 1.2fr 1.2fr auto',
                  gap: '1rem',
                  padding: '0.75rem 1rem',
                  background: '#f9fafb',
                  borderBottom: '2px solid #e5e7eb',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.025em',
                }}>
                  <div>Vendor / Invoice</div>
                  <div>Date</div>
                  <div>Units</div>
                  <div>Cost</div>
                  <div></div>
                </div>

                {/* Table Rows */}
                {contributions.map((contribution) => {
                  const hasReconciliation = contribution.unitsReceived !== contribution.unitsPurchased;
                  const contributionPercent = totalCost > 0 ? (contribution.totalCost / totalCost) * 100 : 0;

                  return (
                    <div
                      key={contribution.invoice.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1.5fr 1.5fr 1.2fr 1.2fr auto',
                        gap: '1rem',
                        padding: '1rem',
                        background: 'white',
                        borderBottom: '1px solid #f0f0f0',
                        alignItems: 'center',
                        transition: 'background-color 150ms',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fafafa'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                    >
                      {/* Vendor / Invoice Number */}
                      <div>
                        <div style={{ fontWeight: 600, color: '#1f2937', fontSize: '0.9375rem' }}>
                          {contribution.invoice.vendor_name || 'No Vendor'}
                        </div>
                        <div style={{ fontSize: '0.8125rem', color: '#64748b', marginTop: '0.125rem' }}>
                          Invoice #{contribution.invoice.invoice_number || 'N/A'}
                        </div>
                      </div>

                      {/* Date */}
                      <div style={{ color: '#64748b', fontSize: '0.9375rem' }}>
                        {formatDate(contribution.invoice.invoice_date)}
                      </div>

                      {/* Units */}
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>
                          {contribution.unitsReceived.toFixed(0)}
                        </div>
                        {hasReconciliation && (
                          <div style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: '0.125rem' }}>
                            ({(contribution.unitsPurchased - contribution.unitsReceived).toFixed(0)} short)
                          </div>
                        )}
                      </div>

                      {/* Cost with percentage bar */}
                      <div>
                        <div style={{ fontWeight: 600, color: '#4b006e', fontSize: '0.9375rem' }}>
                          {formatCurrency(contribution.totalCost)}
                        </div>
                        <div
                          style={{
                            marginTop: '0.375rem',
                            height: '4px',
                            background: '#e5e7eb',
                            borderRadius: '2px',
                            overflow: 'hidden',
                            cursor: 'help',
                          }}
                          title={`${contributionPercent.toFixed(1)}% of total cost`}
                        >
                          <div style={{
                            width: `${contributionPercent}%`,
                            height: '100%',
                            background: '#4b006e',
                            transition: 'width 300ms ease-out',
                          }} />
                        </div>
                      </div>

                      {/* View Button */}
                      {onViewInvoice && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onViewInvoice(contribution.invoice.id)}
                          style={{ whiteSpace: 'nowrap' }}
                        >
                          View
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Simple Calculation */}
            <div style={{
              padding: '1rem 1.25rem',
              background: '#f9fafb',
              borderRadius: '8px',
              fontSize: '0.9375rem',
              color: '#64748b',
            }}>
              <strong style={{ color: '#4b006e' }}>Calculation:</strong>{' '}
              {formatCurrency(totalCost)} total cost ÷ {totalUnits.toFixed(0)} units received = {formatCurrency(costPerUnit)} per unit
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
