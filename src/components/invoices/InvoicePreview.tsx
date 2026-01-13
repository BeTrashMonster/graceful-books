/**
 * InvoicePreview Component
 *
 * Shows a preview of the invoice as it will appear to the customer
 */

import type { Invoice, InvoiceLineItem } from '../../db/schema/invoices.schema';
import { getTemplateById, generateInvoiceHTML } from '../../features/invoices/templates';

export interface InvoicePreviewProps {
  invoice: Invoice;
  lineItems: InvoiceLineItem[];
  customerName: string;
  customerAddress?: string;
  companyInfo?: {
    name: string;
    address?: string;
    phone?: string;
    email?: string;
    logoUrl?: string;
  };
}

export const InvoicePreview = ({
  invoice,
  lineItems,
  customerName,
  customerAddress,
  companyInfo,
}: InvoicePreviewProps) => {
  const template = getTemplateById(invoice.template_id);

  if (!template) {
    return <div>Template not found</div>;
  }

  const html = generateInvoiceHTML(
    {
      invoiceNumber: invoice.invoice_number,
      invoiceDate: new Date(invoice.invoice_date),
      dueDate: new Date(invoice.due_date),
      customerName,
      customerAddress,
      lineItems,
      subtotal: invoice.subtotal,
      tax: invoice.tax,
      total: invoice.total,
      notes: invoice.notes || undefined,
    },
    template,
    companyInfo
  );

  return (
    <div className="invoice-preview">
      <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded">
        <p className="text-sm text-blue-800">
          This is what {customerName} will see
        </p>
      </div>
      <div
        className="border rounded shadow-sm bg-white"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
};
