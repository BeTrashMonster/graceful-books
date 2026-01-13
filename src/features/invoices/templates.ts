/**
 * Invoice Templates
 *
 * Provides pre-defined invoice templates with different styles for PDF generation.
 * Each template defines the layout and visual appearance of invoices.
 */

export interface InvoiceTemplate {
  id: string;
  name: string;
  description: string;
  preview: string; // Preview image or icon
  styles: InvoiceTemplateStyles;
}

export interface InvoiceTemplateStyles {
  /** Primary color for headers and accents */
  primaryColor: string;
  /** Secondary color for backgrounds */
  secondaryColor: string;
  /** Font family */
  fontFamily: string;
  /** Header text color */
  headerTextColor: string;
  /** Body text color */
  bodyTextColor: string;
  /** Border color */
  borderColor: string;
  /** Layout style */
  layout: 'left-aligned' | 'centered' | 'two-column';
  /** Show company logo */
  showLogo: boolean;
  /** Show line item borders */
  showLineItemBorders: boolean;
}

/**
 * Classic Template
 * Professional, traditional invoice layout
 */
export const classicTemplate: InvoiceTemplate = {
  id: 'classic',
  name: 'Classic',
  description: 'Professional, traditional invoice layout',
  preview: '📄',
  styles: {
    primaryColor: '#2c3e50',
    secondaryColor: '#ecf0f1',
    fontFamily: 'Georgia, serif',
    headerTextColor: '#ffffff',
    bodyTextColor: '#2c3e50',
    borderColor: '#bdc3c7',
    layout: 'left-aligned',
    showLogo: true,
    showLineItemBorders: true,
  },
};

/**
 * Modern Template
 * Clean, minimal design with bold typography
 */
export const modernTemplate: InvoiceTemplate = {
  id: 'modern',
  name: 'Modern',
  description: 'Clean, minimal design with bold typography',
  preview: '✨',
  styles: {
    primaryColor: '#3498db',
    secondaryColor: '#f8f9fa',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    headerTextColor: '#ffffff',
    bodyTextColor: '#212529',
    borderColor: '#dee2e6',
    layout: 'two-column',
    showLogo: true,
    showLineItemBorders: false,
  },
};

/**
 * Minimal Template
 * Simple, understated design focusing on content
 */
export const minimalTemplate: InvoiceTemplate = {
  id: 'minimal',
  name: 'Minimal',
  description: 'Simple, understated design focusing on content',
  preview: '📋',
  styles: {
    primaryColor: '#495057',
    secondaryColor: '#ffffff',
    fontFamily: 'Arial, Helvetica, sans-serif',
    headerTextColor: '#495057',
    bodyTextColor: '#495057',
    borderColor: '#e9ecef',
    layout: 'centered',
    showLogo: false,
    showLineItemBorders: true,
  },
};

/**
 * Professional Template
 * Corporate style with subtle colors
 */
export const professionalTemplate: InvoiceTemplate = {
  id: 'professional',
  name: 'Professional',
  description: 'Corporate style with subtle colors',
  preview: '💼',
  styles: {
    primaryColor: '#0056b3',
    secondaryColor: '#e7f1ff',
    fontFamily: 'Calibri, "Trebuchet MS", sans-serif',
    headerTextColor: '#ffffff',
    bodyTextColor: '#212529',
    borderColor: '#ced4da',
    layout: 'left-aligned',
    showLogo: true,
    showLineItemBorders: true,
  },
};

/**
 * Bold Template
 * Eye-catching design with strong colors
 */
export const boldTemplate: InvoiceTemplate = {
  id: 'bold',
  name: 'Bold',
  description: 'Eye-catching design with strong colors',
  preview: '⚡',
  styles: {
    primaryColor: '#e74c3c',
    secondaryColor: '#fadbd8',
    fontFamily: 'Impact, "Arial Black", sans-serif',
    headerTextColor: '#ffffff',
    bodyTextColor: '#2c3e50',
    borderColor: '#e74c3c',
    layout: 'two-column',
    showLogo: true,
    showLineItemBorders: false,
  },
};

/**
 * All available templates
 */
export const invoiceTemplates: InvoiceTemplate[] = [
  classicTemplate,
  modernTemplate,
  minimalTemplate,
  professionalTemplate,
  boldTemplate,
];

/**
 * Get template by ID
 */
export function getTemplateById(id: string): InvoiceTemplate | undefined {
  return invoiceTemplates.find((template) => template.id === id);
}

/**
 * Get default template
 */
export function getDefaultTemplate(): InvoiceTemplate {
  return classicTemplate;
}

/**
 * Generate CSS styles for a template
 */
export function generateTemplateCSS(template: InvoiceTemplate): string {
  const { styles } = template;

  return `
    .invoice {
      font-family: ${styles.fontFamily};
      color: ${styles.bodyTextColor};
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
    }

    .invoice-header {
      background-color: ${styles.primaryColor};
      color: ${styles.headerTextColor};
      padding: 30px;
      margin-bottom: 40px;
      ${styles.layout === 'centered' ? 'text-align: center;' : ''}
    }

    .invoice-header h1 {
      margin: 0 0 10px 0;
      font-size: 32px;
      font-weight: bold;
    }

    .invoice-header .invoice-number {
      font-size: 18px;
      opacity: 0.9;
    }

    .invoice-details {
      display: ${styles.layout === 'two-column' ? 'grid' : 'block'};
      ${styles.layout === 'two-column' ? 'grid-template-columns: 1fr 1fr;' : ''}
      gap: 30px;
      margin-bottom: 40px;
    }

    .invoice-section {
      margin-bottom: 20px;
    }

    .invoice-section h3 {
      color: ${styles.primaryColor};
      font-size: 14px;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 10px;
      letter-spacing: 0.5px;
    }

    .invoice-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }

    .invoice-table thead {
      background-color: ${styles.secondaryColor};
    }

    .invoice-table th {
      padding: 15px;
      text-align: left;
      font-weight: bold;
      color: ${styles.primaryColor};
      ${styles.showLineItemBorders ? `border-bottom: 2px solid ${styles.borderColor};` : ''}
    }

    .invoice-table td {
      padding: 15px;
      ${styles.showLineItemBorders ? `border-bottom: 1px solid ${styles.borderColor};` : ''}
    }

    .invoice-table th.text-right,
    .invoice-table td.text-right {
      text-align: right;
    }

    .invoice-table th.text-center,
    .invoice-table td.text-center {
      text-align: center;
    }

    .invoice-totals {
      margin-left: auto;
      max-width: 350px;
      margin-bottom: 40px;
    }

    .invoice-total-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 15px;
      ${styles.showLineItemBorders ? `border-bottom: 1px solid ${styles.borderColor};` : ''}
    }

    .invoice-total-row.subtotal {
      font-weight: normal;
    }

    .invoice-total-row.tax {
      font-weight: normal;
    }

    .invoice-total-row.total {
      background-color: ${styles.primaryColor};
      color: ${styles.headerTextColor};
      font-weight: bold;
      font-size: 18px;
      margin-top: 10px;
    }

    .invoice-notes {
      background-color: ${styles.secondaryColor};
      padding: 20px;
      border-radius: 5px;
      margin-bottom: 30px;
    }

    .invoice-notes h4 {
      margin-top: 0;
      color: ${styles.primaryColor};
    }

    .invoice-footer {
      text-align: center;
      padding-top: 30px;
      border-top: 2px solid ${styles.borderColor};
      color: #6c757d;
      font-size: 14px;
    }

    .company-logo {
      max-width: 150px;
      max-height: 80px;
      margin-bottom: 20px;
      ${styles.layout === 'centered' ? 'margin-left: auto; margin-right: auto; display: block;' : ''}
    }

    @media print {
      .invoice {
        padding: 0;
      }

      .invoice-header {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
    }
  `;
}

/**
 * Generate HTML for invoice preview
 */
export function generateInvoiceHTML(
  invoice: {
    invoiceNumber: string;
    invoiceDate: Date;
    dueDate: Date;
    customerName: string;
    customerAddress?: string;
    lineItems: Array<{
      description: string;
      quantity: number;
      unitPrice: string;
      total: string;
    }>;
    subtotal: string;
    tax: string;
    total: string;
    notes?: string;
  },
  template: InvoiceTemplate,
  companyInfo?: {
    name: string;
    address?: string;
    phone?: string;
    email?: string;
    logoUrl?: string;
  }
): string {
  const css = generateTemplateCSS(template);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${invoice.invoiceNumber}</title>
  <style>
    ${css}
  </style>
</head>
<body>
  <div class="invoice">
    <div class="invoice-header">
      ${template.styles.showLogo && companyInfo?.logoUrl ? `<img src="${companyInfo.logoUrl}" alt="${companyInfo.name}" class="company-logo">` : ''}
      <h1>INVOICE</h1>
      <div class="invoice-number">${invoice.invoiceNumber}</div>
    </div>

    <div class="invoice-details">
      <div>
        <div class="invoice-section">
          <h3>From</h3>
          <div>
            ${companyInfo?.name || 'Your Company Name'}<br>
            ${companyInfo?.address ? `${companyInfo.address}<br>` : ''}
            ${companyInfo?.phone ? `Phone: ${companyInfo.phone}<br>` : ''}
            ${companyInfo?.email ? `Email: ${companyInfo.email}` : ''}
          </div>
        </div>

        <div class="invoice-section">
          <h3>Bill To</h3>
          <div>
            ${invoice.customerName}<br>
            ${invoice.customerAddress ? `${invoice.customerAddress}` : ''}
          </div>
        </div>
      </div>

      <div>
        <div class="invoice-section">
          <h3>Invoice Date</h3>
          <div>${invoice.invoiceDate.toLocaleDateString()}</div>
        </div>

        <div class="invoice-section">
          <h3>Due Date</h3>
          <div>${invoice.dueDate.toLocaleDateString()}</div>
        </div>
      </div>
    </div>

    <table class="invoice-table">
      <thead>
        <tr>
          <th>Description</th>
          <th class="text-center">Quantity</th>
          <th class="text-right">Unit Price</th>
          <th class="text-right">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${invoice.lineItems
          .map(
            (item) => `
          <tr>
            <td>${item.description}</td>
            <td class="text-center">${item.quantity}</td>
            <td class="text-right">$${item.unitPrice}</td>
            <td class="text-right">$${item.total}</td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>

    <div class="invoice-totals">
      <div class="invoice-total-row subtotal">
        <span>Subtotal</span>
        <span>$${invoice.subtotal}</span>
      </div>
      <div class="invoice-total-row tax">
        <span>Tax</span>
        <span>$${invoice.tax}</span>
      </div>
      <div class="invoice-total-row total">
        <span>Total</span>
        <span>$${invoice.total}</span>
      </div>
    </div>

    ${
      invoice.notes
        ? `
    <div class="invoice-notes">
      <h4>Notes</h4>
      <p>${invoice.notes}</p>
    </div>
    `
        : ''
    }

    <div class="invoice-footer">
      Thank you for your business!
    </div>
  </div>
</body>
</html>
  `;
}
