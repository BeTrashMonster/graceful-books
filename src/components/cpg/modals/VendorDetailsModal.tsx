/**
 * Vendor Details Modal - Slide-Over Panel
 *
 * Quick vendor summary with link to full Vendor Intel analysis.
 * Shows recent invoices and spending overview from last 365 days.
 */

import { useState, useEffect } from 'react';
import { Modal } from '../../modals/Modal';
import { Button } from '../../core/Button';
import { db } from '../../../db/database';
import type { CPGInvoice } from '../../../db/schema/cpg.schema';
import styles from './CPGModals.module.css';

export interface VendorDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendorName: string;
  companyId: string;
  onViewFullVendorIntel?: (vendorName: string) => void;
}

interface VendorStats {
  totalSpend: number;
  invoiceCount: number;
  recentInvoices: CPGInvoice[];
  uniqueCategories: number;
}

export function VendorDetailsModal({
  isOpen,
  onClose,
  vendorName,
  companyId,
  onViewFullVendorIntel,
}: VendorDetailsModalProps) {
  const [stats, setStats] = useState<VendorStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !vendorName) return;

    const loadVendorStats = async () => {
      setIsLoading(true);
      try {
        // Calculate date range: last 365 days
        const now = Date.now();
        const last365Days = now - 365 * 24 * 60 * 60 * 1000;

        // Load vendor invoices from last 365 days
        const invoices = await db.cpgInvoices
          .where('company_id')
          .equals(companyId)
          .filter(
            (inv) =>
              inv.active &&
              inv.deleted_at === null &&
              inv.vendor_name === vendorName &&
              inv.invoice_date >= last365Days &&
              inv.invoice_date <= now
          )
          .toArray();

        // Calculate stats
        const totalSpend = invoices.reduce((sum, inv) => sum + parseFloat(inv.total_paid), 0);

        // Get unique categories from cost attribution
        const categorySet = new Set<string>();
        invoices.forEach((inv) => {
          if (inv.cost_attribution) {
            Object.values(inv.cost_attribution).forEach((attr) => {
              categorySet.add(attr.category_id);
            });
          }
        });

        // Sort by date descending, take top 5
        const recentInvoices = invoices
          .sort((a, b) => b.invoice_date - a.invoice_date)
          .slice(0, 5);

        setStats({
          totalSpend,
          invoiceCount: invoices.length,
          recentInvoices,
          uniqueCategories: categorySet.size,
        });
      } catch (error) {
        console.error('Failed to load vendor stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadVendorStats();
  }, [isOpen, vendorName, companyId]);

  const formatCurrency = (value: number): string => {
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={vendorName} size="md" closeOnBackdropClick={false}>
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
          Loading vendor details...
        </div>
      ) : !stats ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
          No data available
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Header Stats - Last 365 Days */}
          <div>
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#64748b',
                marginBottom: '0.75rem',
                textTransform: 'uppercase',
                letterSpacing: '0.025em',
              }}
            >
              Last 365 Days
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: '1rem',
              }}
            >
              {/* Total Spend */}
              <div
                style={{
                  padding: '1rem',
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '8px',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: '#16a34a', marginBottom: '0.25rem' }}>
                  Total Spend
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#15803d' }}>
                  {formatCurrency(stats.totalSpend)}
                </div>
              </div>

              {/* Invoice Count */}
              <div
                style={{
                  padding: '1rem',
                  background: '#f0f9ff',
                  border: '1px solid #bae6fd',
                  borderRadius: '8px',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: '#0284c7', marginBottom: '0.25rem' }}>
                  Invoices
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0369a1' }}>
                  {stats.invoiceCount.toLocaleString()}
                </div>
              </div>

              {/* Unique Categories */}
              <div
                style={{
                  padding: '1rem',
                  background: '#faf5ff',
                  border: '1px solid #e9d5ff',
                  borderRadius: '8px',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: '#9333ea', marginBottom: '0.25rem' }}>
                  Categories
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#7e22ce' }}>
                  {stats.uniqueCategories.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Recent Invoices */}
          <div>
            <div
              style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#374151',
                marginBottom: '0.75rem',
              }}
            >
              Recent Invoices
            </div>
            {stats.recentInvoices.length === 0 ? (
              <div
                style={{
                  padding: '2rem',
                  textAlign: 'center',
                  background: '#f9fafb',
                  borderRadius: '8px',
                  color: '#64748b',
                }}
              >
                No invoices found in the last 365 days
              </div>
            ) : (
              <div
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  overflow: 'hidden',
                }}
              >
                {stats.recentInvoices.map((invoice, index) => (
                  <div
                    key={invoice.id}
                    style={{
                      padding: '0.75rem 1rem',
                      background: 'white',
                      borderBottom: index < stats.recentInvoices.length - 1 ? '1px solid #f3f4f6' : 'none',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#1f2937' }}>
                        Invoice #{invoice.invoice_number || 'N/A'}
                      </div>
                      <div style={{ fontSize: '0.8125rem', color: '#64748b', marginTop: '0.125rem' }}>
                        {formatDate(invoice.invoice_date)}
                      </div>
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '1rem', color: '#4b006e' }}>
                      {formatCurrency(parseFloat(invoice.total_paid))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* View Full Vendor Intel Link */}
          <div
            style={{
              padding: '1rem',
              background: 'linear-gradient(135deg, #4b006e 0%, #6b1a8f 100%)',
              borderRadius: '8px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '0.875rem', color: 'white', opacity: 0.9, marginBottom: '0.75rem' }}>
              Want to see all-time data and detailed comparisons?
            </div>
            <Button
              onClick={() => {
                onViewFullVendorIntel?.(vendorName);
                onClose();
              }}
              style={{
                background: 'white',
                color: '#4b006e',
                fontWeight: 600,
                padding: '0.75rem 1.5rem',
                width: '100%',
              }}
            >
              View Full Vendor Intel →
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
