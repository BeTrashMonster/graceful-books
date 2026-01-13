/**
 * InvoiceList Component
 *
 * Displays a list of invoices with filtering and status indicators
 */

import type { Invoice } from '../../db/schema/invoices.schema';
import { getDaysUntilDue } from '../../db/schema/invoices.schema';

export interface InvoiceListProps {
  invoices: Invoice[];
  onSelect?: (invoice: Invoice) => void;
  onDelete?: (id: string) => void;
}

export const InvoiceList = ({ invoices, onSelect, onDelete }: InvoiceListProps) => {
  const getStatusBadge = (invoice: Invoice) => {
    const statusColors = {
      DRAFT: 'bg-gray-200 text-gray-800',
      SENT: 'bg-blue-200 text-blue-800',
      PAID: 'bg-green-200 text-green-800',
      OVERDUE: 'bg-red-200 text-red-800',
      VOID: 'bg-gray-400 text-gray-800',
    };

    return (
      <span
        className={`px-2 py-1 rounded text-xs font-semibold ${statusColors[invoice.status]}`}
      >
        {invoice.status}
      </span>
    );
  };

  const getDueDateInfo = (invoice: Invoice) => {
    if (invoice.status === 'PAID' || invoice.status === 'VOID') {
      return null;
    }

    const daysUntilDue = getDaysUntilDue(invoice);

    if (daysUntilDue < 0) {
      return (
        <span className="text-red-600 text-sm">
          Overdue by {Math.abs(daysUntilDue)} days
        </span>
      );
    } else if (daysUntilDue === 0) {
      return <span className="text-orange-600 text-sm">Due today</span>;
    } else if (daysUntilDue <= 7) {
      return (
        <span className="text-orange-600 text-sm">Due in {daysUntilDue} days</span>
      );
    }

    return <span className="text-gray-600 text-sm">Due in {daysUntilDue} days</span>;
  };

  if (invoices.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <p className="text-gray-600 text-lg mb-2">No invoices yet</p>
        <p className="text-gray-500">
          When you create your first invoice, it will show up right here.
        </p>
      </div>
    );
  }

  return (
    <div className="invoice-list">
      <table className="w-full">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-3 text-left">Invoice #</th>
            <th className="p-3 text-left">Customer</th>
            <th className="p-3 text-left">Date</th>
            <th className="p-3 text-right">Amount</th>
            <th className="p-3 text-left">Status</th>
            <th className="p-3 text-left">Due</th>
            <th className="p-3"></th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => (
            <tr
              key={invoice.id}
              className="border-b hover:bg-gray-50 cursor-pointer"
              onClick={() => onSelect?.(invoice)}
            >
              <td className="p-3 font-semibold">{invoice.invoice_number}</td>
              <td className="p-3">{/* Customer name to be populated */}</td>
              <td className="p-3">
                {new Date(invoice.invoice_date).toLocaleDateString()}
              </td>
              <td className="p-3 text-right font-semibold">${invoice.total}</td>
              <td className="p-3">{getStatusBadge(invoice)}</td>
              <td className="p-3">{getDueDateInfo(invoice)}</td>
              <td className="p-3">
                {invoice.status === 'DRAFT' && onDelete && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(invoice.id);
                    }}
                    className="text-red-600 hover:text-red-800"
                    aria-label={`Delete invoice ${invoice.invoice_number}`}
                  >
                    Delete
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
