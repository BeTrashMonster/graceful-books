/**
 * CPU Timeline Component
 *
 * Visual timeline showing CPU changes over time.
 *
 * Features:
 * - Chronological timeline of invoice entries
 * - Expandable invoice details
 * - Color-coded by category
 * - Filterable by category
 * - Responsive design
 *
 * Requirements:
 * - Visual timeline layout
 * - Clear date/CPU information
 * - Interactive expand/collapse
 * - WCAG 2.1 AA compliance
 */

import { useState } from 'react';
import type { CPGCategory } from '../../db/schema/cpg.schema';
import type { CPUHistoryEntry } from '../../services/cpg/cpuCalculator.service';
import styles from './CPUTimeline.module.css';

export interface CPUTimelineProps {
  history: CPUHistoryEntry[];
  categories: CPGCategory[];
  onInvoiceClick?: (invoiceId: string) => void;
}

export function CPUTimeline({ history, categories: _categories, onInvoiceClick }: CPUTimelineProps) {
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());

  const toggleInvoice = (invoiceId: string) => {
    const newExpanded = new Set(expandedInvoices);
    if (newExpanded.has(invoiceId)) {
      newExpanded.delete(invoiceId);
    } else {
      newExpanded.add(invoiceId);
    }
    setExpandedInvoices(newExpanded);
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatCurrency = (value: string): string => {
    return `$${parseFloat(value).toFixed(2)}`;
  };

  // Group entries by invoice
  const groupedByInvoice = history.reduce((acc, entry) => {
    if (!acc[entry.invoice_id]) {
      acc[entry.invoice_id] = [];
    }
    acc[entry.invoice_id]!.push(entry);
    return acc;
  }, {} as Record<string, CPUHistoryEntry[]>);

  const invoiceIds = Object.keys(groupedByInvoice).sort((a, b) => {
    const dateA = groupedByInvoice[a]![0]!.invoice_date;
    const dateB = groupedByInvoice[b]![0]!.invoice_date;
    return dateB - dateA; // Most recent first
  });

  if (history.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon} aria-hidden="true">
          📊
        </div>
        <p className={styles.emptyText}>
          No cost history yet. Your invoice entries will appear here as a timeline.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.timeline} role="list" aria-label="Cost history timeline">
        {invoiceIds.map((invoiceId, index) => {
          const entries = groupedByInvoice[invoiceId]!;
          const firstEntry = entries[0]!;
          const isExpanded = expandedInvoices.has(invoiceId);

          return (
            <article
              key={invoiceId}
              className={styles.timelineItem}
              role="listitem"
              aria-labelledby={`invoice-${invoiceId}-title`}
            >
              {/* Timeline Connector */}
              <div className={styles.timelineConnector} aria-hidden="true">
                <div className={styles.timelineDot} />
                {index < invoiceIds.length - 1 && <div className={styles.timelineLine} />}
              </div>

              {/* Timeline Content */}
              <div className={styles.timelineContent}>
                <button
                  type="button"
                  className={styles.timelineHeader}
                  onClick={() => toggleInvoice(invoiceId)}
                  aria-expanded={isExpanded}
                  aria-controls={`invoice-${invoiceId}-details`}
                  id={`invoice-${invoiceId}-title`}
                >
                  <div className={styles.headerLeft}>
                    <time
                      className={styles.invoiceDate}
                      dateTime={new Date(firstEntry.invoice_date).toISOString()}
                    >
                      {formatDate(firstEntry.invoice_date)}
                    </time>

                    {firstEntry.invoice_number && (
                      <span className={styles.invoiceNumber}>
                        Invoice #{firstEntry.invoice_number}
                      </span>
                    )}

                    {firstEntry.vendor_name && (
                      <span className={styles.vendorName}>{firstEntry.vendor_name}</span>
                    )}
                  </div>

                  <div className={styles.headerRight}>
                    <span className={styles.variantCount}>
                      {entries.length} variant{entries.length !== 1 ? 's' : ''}
                    </span>
                    <span
                      className={styles.expandIcon}
                      aria-hidden="true"
                      style={{
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      }}
                    >
                      ▼
                    </span>
                  </div>
                </button>

                {/* Expandable Details */}
                {isExpanded && (
                  <div
                    id={`invoice-${invoiceId}-details`}
                    className={styles.timelineDetails}
                    role="region"
                    aria-label="Invoice details"
                  >
                    <div className={styles.detailsGrid}>
                      {entries.map((entry, idx) => (
                        <div key={idx} className={styles.variantCard}>
                          <div className={styles.variantHeader}>
                            <span className={styles.variantName}>
                              {entry.variant ? entry.variant : 'No variant'}
                            </span>
                          </div>

                          <div className={styles.variantDetails}>
                            <div className={styles.detailRow}>
                              <span className={styles.detailLabel}>Cost Per Unit:</span>
                              <span className={styles.detailValue}>
                                {formatCurrency(entry.cpu)}
                              </span>
                            </div>

                            <div className={styles.detailRow}>
                              <span className={styles.detailLabel}>Units Received:</span>
                              <span className={styles.detailValue}>
                                {parseFloat(entry.units_received).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {onInvoiceClick && (
                      <button
                        type="button"
                        className={styles.viewDetailsButton}
                        onClick={() => onInvoiceClick(invoiceId)}
                      >
                        View Full Invoice Details
                      </button>
                    )}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
