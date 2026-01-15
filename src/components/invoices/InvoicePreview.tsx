/**
 * Invoice Preview Component
 *
 * Renders a live preview of an invoice with actual customer data
 * using the current template customization.
 *
 * Requirements:
 * - E3: Invoice Templates - Customizable (Nice)
 * - Show preview with actual customer data
 * - "Maria Garcia will receive an invoice that looks exactly like this"
 */

import React, { useMemo } from 'react';
import type {
  BrandColors,
  LogoConfig,
  InvoiceTemplateLayout,
  FontFamily,
} from '../../db/schema/invoiceTemplates.schema';
import { generateCustomTemplateCSS } from '../../db/schema/invoiceTemplates.schema';
import type { Invoice, InvoiceLineItem } from '../../db/schema/invoices.schema';

export interface InvoicePreviewProps {
  /**
   * Template configuration (optional - for template customization preview)
   */
  template?: {
    logo: LogoConfig | null;
    logoPosition: string;
    showLogo: boolean;
    colors: BrandColors;
    layout: InvoiceTemplateLayout;
    fontFamily: FontFamily;
    fontSize: number;
    showLineItemBorders: boolean;
    showItemNumbers: boolean;
    showTaxIdOnInvoice: boolean;
    showPageNumbers: boolean;
    headerMessage?: string;
    footerMessage?: string;
    paymentTerms?: string;
    paymentInstructions?: string;
  };

  /**
   * Invoice data (can be partial for preview)
   */
  invoice: Partial<Invoice>;

  /**
   * Line items (parsed from invoice.line_items)
   */
  lineItems: InvoiceLineItem[];

  /**
   * Customer name
   */
  customerName: string;

  /**
   * Customer address (optional)
   */
  customerAddress?: string;

  /**
   * Company information
   */
  companyInfo?: {
    name: string;
    address?: string;
    phone?: string;
    email?: string;
    taxId?: string;
    logoUrl?: string;
  };

  /**
   * Scale factor for preview (default: 0.75)
   */
  scale?: number;

  /**
   * Show customer name in preview message
   */
  showCustomerMessage?: boolean;
}

/**
 * Default brand colors for fallback
 */
const DEFAULT_COLORS: BrandColors = {
  primary: '#2c3e50',
  secondary: '#ecf0f1',
  headerText: '#ffffff',
  bodyText: '#2c3e50',
  border: '#bdc3c7',
  background: '#ffffff',
};

const DEFAULT_COMPANY_INFO = {
  name: 'Your Company Name',
  address: '456 Business Ave\nCity, State 67890',
  phone: '(555) 123-4567',
  email: 'hello@yourcompany.com',
  taxId: '12-3456789',
};

/**
 * InvoicePreview Component
 */
export const InvoicePreview: React.FC<InvoicePreviewProps> = ({
  template,
  invoice,
  lineItems,
  customerName,
  customerAddress,
  companyInfo,
  scale = 0.75,
  showCustomerMessage = true,
}) => {
  const companyData = useMemo(
    () => ({
      ...DEFAULT_COMPANY_INFO,
      ...companyInfo,
    }),
    [companyInfo]
  );

  // Use template if provided, otherwise use defaults
  const colors = template?.colors || DEFAULT_COLORS;
  const layout = template?.layout || 'left-aligned';
  const fontFamily = template?.fontFamily || 'Arial';
  const fontSize = template?.fontSize || 11;
  const showLineItemBorders = template?.showLineItemBorders ?? true;
  const showItemNumbers = template?.showItemNumbers ?? false;
  const showTaxIdOnInvoice = template?.showTaxIdOnInvoice ?? true;
  const logo = template?.logo || null;
  const showLogo = template?.showLogo ?? false;
  const headerMessage = template?.headerMessage;
  const footerMessage = template?.footerMessage;
  const paymentTerms = template?.paymentTerms;
  const paymentInstructions = template?.paymentInstructions;

  // Generate CSS for template
  const templateCSS = useMemo(() => {
    if (!template) {
      // Use default styles
      return '';
    }

    return generateCustomTemplateCSS(
      {
        ...template,
        id: 'preview',
        company_id: 'preview',
        name: 'Preview',
        description: null,
        isDefault: false,
        active: true,
        logo: template.logo,
        logoPosition: template.logoPosition as any,
        showLogo: template.showLogo,
        colors: JSON.stringify(template.colors),
        layout: template.layout,
        fontFamily: template.fontFamily,
        fontSize: template.fontSize,
        showLineItemBorders: template.showLineItemBorders,
        showItemNumbers: template.showItemNumbers,
        showTaxIdOnInvoice: template.showTaxIdOnInvoice,
        showPageNumbers: template.showPageNumbers,
        headerMessage: template.headerMessage || null,
        footerMessage: template.footerMessage || null,
        paymentTerms: template.paymentTerms || null,
        paymentInstructions: template.paymentInstructions || null,
        created_at: Date.now(),
        updated_at: Date.now(),
        deleted_at: null,
        version_vector: {},
      },
      template.colors
    );
  }, [template]);

  // Format date
  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="invoice-preview-container">
      {/* Customer Message */}
      {showCustomerMessage && (
        <div className="preview-message">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          <span>
            <strong>{customerName}</strong> will receive an invoice that looks exactly like this.
          </span>
        </div>
      )}

      {/* Invoice Preview */}
      <div className="invoice-preview-wrapper" style={{ transform: `scale(${scale})` }}>
        <div className="invoice">
          {/* Header */}
          <div className="invoice-header">
            {showLogo && logo && (
              <img
                src={logo.data}
                alt={companyData.name}
                className="company-logo"
                style={{
                  maxWidth: `${logo.maxWidth}px`,
                  maxHeight: `${logo.maxHeight}px`,
                }}
              />
            )}
            <h1>INVOICE</h1>
            <div className="invoice-number">{invoice.invoice_number || 'INV-2026-0001'}</div>
            {headerMessage && <div className="header-message">{headerMessage}</div>}
          </div>

          {/* Invoice Details */}
          <div className="invoice-details">
            <div>
              <div className="invoice-section">
                <h3>From</h3>
                <div>
                  <strong>{companyData.name}</strong>
                  <br />
                  {companyData.address && (
                    <>
                      {companyData.address.split('\n').map((line, i) => (
                        <React.Fragment key={i}>
                          {line}
                          <br />
                        </React.Fragment>
                      ))}
                    </>
                  )}
                  {companyData.phone && (
                    <>
                      Phone: {companyData.phone}
                      <br />
                    </>
                  )}
                  {companyData.email && <>Email: {companyData.email}</>}
                  {showTaxIdOnInvoice && companyData.taxId && (
                    <>
                      <br />
                      Tax ID: {companyData.taxId}
                    </>
                  )}
                </div>
              </div>

              <div className="invoice-section">
                <h3>Bill To</h3>
                <div>
                  <strong>{customerName}</strong>
                  <br />
                  {customerAddress && (
                    <>
                      {customerAddress.split('\n').map((line, i) => (
                        <React.Fragment key={i}>
                          {line}
                          <br />
                        </React.Fragment>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </div>

            <div>
              <div className="invoice-section">
                <h3>Invoice Date</h3>
                <div>{formatDate(invoice.invoice_date || Date.now())}</div>
              </div>

              <div className="invoice-section">
                <h3>Due Date</h3>
                <div>{formatDate(invoice.due_date || Date.now() + 30 * 24 * 60 * 60 * 1000)}</div>
              </div>

              {paymentTerms && (
                <div className="invoice-section">
                  <h3>Payment Terms</h3>
                  <div>{paymentTerms}</div>
                </div>
              )}
            </div>
          </div>

          {/* Line Items */}
          <table className="invoice-table">
            <thead>
              <tr>
                {showItemNumbers && <th className="text-center">#</th>}
                <th>Description</th>
                <th className="text-center">Quantity</th>
                <th className="text-right">Unit Price</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, index) => (
                <tr key={item.id}>
                  {showItemNumbers && <td className="text-center">{index + 1}</td>}
                  <td>{item.description}</td>
                  <td className="text-center">{item.quantity}</td>
                  <td className="text-right">${item.unitPrice}</td>
                  <td className="text-right">${item.total}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="invoice-totals">
            <div className="invoice-total-row subtotal">
              <span>Subtotal</span>
              <span>${invoice.subtotal || '0.00'}</span>
            </div>
            <div className="invoice-total-row tax">
              <span>Tax</span>
              <span>${invoice.tax || '0.00'}</span>
            </div>
            <div className="invoice-total-row total">
              <span>Total</span>
              <span>${invoice.total || '0.00'}</span>
            </div>
          </div>

          {/* Payment Instructions */}
          {paymentInstructions && (
            <div className="invoice-notes">
              <h4>Payment Instructions</h4>
              <pre>{paymentInstructions}</pre>
            </div>
          )}

          {/* Footer */}
          {footerMessage && <div className="invoice-footer">{footerMessage}</div>}
        </div>
      </div>

      <style>{`
        .invoice-preview-container {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .preview-message {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          background-color: #eff6ff;
          border-left: 3px solid #3b82f6;
          border-radius: 6px;
          color: #1e40af;
          font-size: 14px;
        }

        .preview-message svg {
          flex-shrink: 0;
          color: #3b82f6;
        }

        .invoice-preview-wrapper {
          transform-origin: top center;
          transition: transform 0.3s ease;
          background: white;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
          border-radius: 8px;
          overflow: hidden;
          max-height: 800px;
          overflow-y: auto;
        }

        ${templateCSS || `
          .invoice {
            font-family: ${fontFamily}, sans-serif;
            font-size: ${fontSize}pt;
            color: ${colors.bodyText};
            background-color: ${colors.background};
            max-width: 800px;
            margin: 0 auto;
            padding: 40px;
          }

          .invoice-header {
            background-color: ${colors.primary};
            color: ${colors.headerText};
            padding: 30px;
            margin-bottom: 40px;
            ${layout === 'centered' ? 'text-align: center;' : ''}
          }

          .invoice-header h1 {
            margin: 0 0 10px 0;
            font-size: ${fontSize + 10}pt;
            font-weight: bold;
          }

          .invoice-header .invoice-number {
            font-size: ${fontSize + 2}pt;
            opacity: 0.9;
          }

          .header-message {
            margin-top: 10px;
            font-size: ${fontSize - 1}pt;
            opacity: 0.9;
          }

          .invoice-details {
            display: ${layout === 'two-column' || layout === 'modern-split' ? 'grid' : 'block'};
            ${layout === 'two-column' || layout === 'modern-split' ? 'grid-template-columns: 1fr 1fr;' : ''}
            gap: 30px;
            margin-bottom: 40px;
          }

          .invoice-section {
            margin-bottom: 20px;
          }

          .invoice-section h3 {
            color: ${colors.primary};
            font-size: ${fontSize - 1}pt;
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
            background-color: ${colors.secondary};
          }

          .invoice-table th {
            padding: 15px;
            text-align: left;
            font-weight: bold;
            color: ${colors.primary};
            ${showLineItemBorders ? `border-bottom: 2px solid ${colors.border};` : ''}
          }

          .invoice-table td {
            padding: 15px;
            ${showLineItemBorders ? `border-bottom: 1px solid ${colors.border};` : ''}
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
            ${showLineItemBorders ? `border-bottom: 1px solid ${colors.border};` : ''}
          }

          .invoice-total-row.total {
            background-color: ${colors.primary};
            color: ${colors.headerText};
            font-weight: bold;
            font-size: ${fontSize + 4}pt;
            margin-top: 10px;
          }

          .invoice-notes {
            background-color: ${colors.secondary};
            padding: 20px;
            border-radius: 5px;
            margin-bottom: 30px;
          }

          .invoice-notes h4 {
            margin-top: 0;
            color: ${colors.primary};
          }

          .invoice-notes pre {
            margin: 10px 0 0 0;
            white-space: pre-wrap;
            font-family: inherit;
            font-size: inherit;
          }

          .invoice-footer {
            text-align: center;
            padding-top: 30px;
            border-top: 2px solid ${colors.border};
            color: #6c757d;
            font-size: ${fontSize - 2}pt;
          }

          .company-logo {
            max-width: 150px;
            max-height: 80px;
            margin-bottom: 20px;
            ${layout === 'centered' ? 'margin-left: auto; margin-right: auto; display: block;' : ''}
          }
        `}
      `}</style>
    </div>
  );
};

export default InvoicePreview;
