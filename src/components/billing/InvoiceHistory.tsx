/**
 * Invoice History Component
 *
 * Displays billing invoice history with download links
 * Part of IC2 Billing Infrastructure
 */

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import { Card } from '../ui/Card';
import { Button } from '../core/Button';
import { formatCurrency } from '../../services/billing.service';
import type { BillingInvoice } from '../../types/billing.types';

interface InvoiceHistoryProps {
  userId: string;
}

export function InvoiceHistory({ userId }: InvoiceHistoryProps): JSX.Element {
  // Live query for invoices
  const invoices = useLiveQuery(
    () =>
      db.billingInvoices
        .where('user_id')
        .equals(userId)
        .reverse()
        .sortBy('created_at'),
    [userId]
  );

  if (!invoices || invoices.length === 0) {
    return (
      <Card>
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">Invoice History</h2>
          <p className="text-gray-600">No invoices yet.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-6">Invoice History</h2>

        <div className="space-y-3">
          {invoices.map((invoice) => (
            <InvoiceItem key={invoice.id} invoice={invoice} />
          ))}
        </div>
      </div>
    </Card>
  );
}

interface InvoiceItemProps {
  invoice: BillingInvoice;
}

function InvoiceItem({ invoice }: InvoiceItemProps): JSX.Element {
  const handleDownloadPDF = () => {
    if (invoice.invoice_pdf_url) {
      window.open(invoice.invoice_pdf_url, '_blank');
    }
  };

  const handleViewInvoice = () => {
    if (invoice.hosted_invoice_url) {
      window.open(invoice.hosted_invoice_url, '_blank');
    }
  };

  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
      <div className="flex-1">
        <div className="flex items-center gap-3">
          <div>
            <div className="font-medium text-gray-900">
              {new Date(invoice.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </div>
            {invoice.description && (
              <div className="text-sm text-gray-600">{invoice.description}</div>
            )}
          </div>
          <InvoiceStatusBadge status={invoice.status} />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="font-semibold text-gray-900">
            {formatCurrency(invoice.amount_due)}
          </div>
          {invoice.paid_at && (
            <div className="text-xs text-gray-500">
              Paid {new Date(invoice.paid_at).toLocaleDateString()}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          {invoice.invoice_pdf_url && (
            <Button
              onClick={handleDownloadPDF}
              variant="secondary"
              size="sm"
            >
              Download PDF
            </Button>
          )}
          {invoice.hosted_invoice_url && (
            <Button
              onClick={handleViewInvoice}
              variant="secondary"
              size="sm"
            >
              View Invoice
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

interface InvoiceStatusBadgeProps {
  status: string;
}

function InvoiceStatusBadge({ status }: InvoiceStatusBadgeProps): JSX.Element {
  let color = 'bg-gray-100 text-gray-800';
  let label = status;

  if (status === 'paid') {
    color = 'bg-green-100 text-green-800';
    label = 'Paid';
  } else if (status === 'open') {
    color = 'bg-blue-100 text-blue-800';
    label = 'Due';
  } else if (status === 'void') {
    color = 'bg-gray-100 text-gray-800';
    label = 'Void';
  } else if (status === 'uncollectible') {
    color = 'bg-red-100 text-red-800';
    label = 'Uncollectible';
  }

  return (
    <span
      className={`px-2 py-1 text-xs font-semibold rounded-full ${color}`}
    >
      {label}
    </span>
  );
}
