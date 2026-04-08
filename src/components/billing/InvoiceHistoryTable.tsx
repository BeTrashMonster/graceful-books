/**
 * InvoiceHistoryTable Component
 *
 * Displays invoice history with download links.
 */

import { Card, CardHeader, CardBody } from '../ui/Card';
import type { Invoice } from '../../services/billing.api';
import styles from './InvoiceHistoryTable.module.css';

interface InvoiceHistoryTableProps {
  invoices: Invoice[];
}

export function InvoiceHistoryTable({ invoices }: InvoiceHistoryTableProps) {
  if (invoices.length === 0) {
    return (
      <Card>
        <CardHeader>
          <h2>Billing History</h2>
        </CardHeader>
        <CardBody>
          <p className={styles.emptyMessage}>No invoices yet. Your billing history will appear here.</p>
        </CardBody>
      </Card>
    );
  }

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100); // Stripe amounts are in cents
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const statusClass = styles[status] || styles.default;
    return <span className={`${styles.statusBadge} ${statusClass}`}>{status}</span>;
  };

  return (
    <Card>
      <CardHeader>
        <h2>Billing History</h2>
      </CardHeader>
      <CardBody>
        <div className={styles.tableContainer}>
          <table className={styles.invoiceTable}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Invoice</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td>{formatDate(invoice.created)}</td>
                  <td>{invoice.number || 'Pending'}</td>
                  <td className={styles.amount}>{formatAmount(invoice.amount, invoice.currency)}</td>
                  <td>{getStatusBadge(invoice.status)}</td>
                  <td>
                    {invoice.hostedInvoiceUrl && (
                      <a
                        href={invoice.hostedInvoiceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.viewLink}
                      >
                        View
                      </a>
                    )}
                    {invoice.invoicePdf && (
                      <a
                        href={invoice.invoicePdf}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.downloadLink}
                        download
                      >
                        Download PDF
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}
