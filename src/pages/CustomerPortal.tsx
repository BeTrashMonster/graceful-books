/**
 * Customer Portal Page
 *
 * Customer-facing invoice portal with:
 * - Mobile-first responsive design
 * - WCAG 2.1 AA compliance
 * - Secure token-based access
 * - Payment processing integration
 *
 * Requirements:
 * - H4: Client Portal
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../components/core/Button';
import { validateToken } from '../services/portalService';
import { createPaymentIntent, confirmPayment } from '../services/paymentGateway';
import type { Invoice } from '../db/schema/invoices.schema';
import type { InvoiceLineItem } from '../db/schema/invoices.schema';
import type { PortalToken } from '../db/schema/portalTokens.schema';
import { ErrorCode } from '../utils/errors';
import styles from './CustomerPortal.module.css';

/**
 * Portal state
 */
type PortalState = 'loading' | 'valid' | 'invalid' | 'payment' | 'success' | 'error';

/**
 * Customer Portal Page
 */
export default function CustomerPortal() {
  const { token } = useParams<{ token: string }>();
  const _navigate = useNavigate();

  const [state, setState] = useState<PortalState>('loading');
  const [portalToken, setPortalToken] = useState<PortalToken | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [paymentProcessing, setPaymentProcessing] = useState(false);

  // Get client IP for rate limiting
  const getClientIp = (): string => {
    // In production, this would come from request headers or a service
    return 'customer-ip-placeholder';
  };

  // Load invoice data on mount
  useEffect(() => {
    const loadInvoice = async () => {
      if (!token) {
        setState('invalid');
        setErrorMessage('No portal link provided');
        return;
      }

      const result = await validateToken(token, getClientIp());

      if (!result.success) {
        setState('invalid');
        setErrorMessage(
          result.error?.code === ErrorCode.RATE_LIMITED
            ? "We've noticed a few attempts. For your security, please wait a moment."
            : 'This portal link is invalid or has expired. Please request a new one from the sender.'
        );
        return;
      }

      setPortalToken(result.data.token);
      setInvoice(result.data.invoice);

      // Parse line items
      try {
        const items: InvoiceLineItem[] = JSON.parse(result.data.invoice.line_items);
        setLineItems(items);
      } catch (error) {
        setLineItems([]);
      }

      setState('valid');
    };

    loadInvoice();
  }, [token]);

  // Handle payment initiation
  const handlePayNow = async () => {
    if (!invoice || !portalToken) return;

    setState('payment');
    setPaymentProcessing(true);

    try {
      // Create payment intent
      const result = await createPaymentIntent(
        invoice.company_id,
        invoice.id,
        portalToken.id,
        'STRIPE', // Default to Stripe, could be configurable
        invoice.total,
        'USD',
        portalToken.email
      );

      if (!result.success) {
        setState('error');
        setErrorMessage('Unable to process payment at this time. Please try again later.');
        setPaymentProcessing(false);
        return;
      }

      // In production, this would integrate with Stripe Elements or Square Web SDK
      // For now, we'll simulate a successful payment
      setTimeout(async () => {
        const confirmResult = await confirmPayment(result.data.paymentId, {
          type: 'card',
          last4: '4242',
        });

        if (confirmResult.success) {
          setState('success');
        } else {
          setState('error');
          setErrorMessage('Payment processing failed. Please try again.');
        }

        setPaymentProcessing(false);
      }, 2000);
    } catch (error) {
      setState('error');
      setErrorMessage('An unexpected error occurred. Please try again.');
      setPaymentProcessing(false);
    }
  };

  // Format currency
  const formatCurrency = (amount: string): string => {
    const num = parseFloat(amount);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num);
  };

  // Format date
  const formatDate = (timestamp: number): string => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(timestamp));
  };

  // Render loading state
  if (state === 'loading') {
    return (
      <div className={styles.container} role="main">
        <div className={styles.loadingContainer} aria-live="polite" aria-busy="true">
          <div className={styles.spinner} aria-label="Loading invoice"></div>
          <p className={styles.loadingText}>Getting your invoice ready...</p>
        </div>
      </div>
    );
  }

  // Render invalid token state
  if (state === 'invalid') {
    return (
      <div className={styles.container} role="main">
        <div className={styles.errorContainer} role="alert">
          <div className={styles.errorIcon} aria-hidden="true">
            ⚠️
          </div>
          <h1 className={styles.errorTitle}>Access Denied</h1>
          <p className={styles.errorMessage}>{errorMessage}</p>
          <p className={styles.errorHint}>
            If you believe this is an error, please contact the sender for a new portal link.
          </p>
        </div>
      </div>
    );
  }

  // Render success state
  if (state === 'success') {
    return (
      <div className={styles.container} role="main">
        <div className={styles.successContainer} role="status" aria-live="polite">
          <div className={styles.successIcon} aria-hidden="true">
            ✓
          </div>
          <h1 className={styles.successTitle}>Payment Successful!</h1>
          <p className={styles.successMessage}>
            Thank you for your payment. Your invoice has been marked as paid.
          </p>
          <p className={styles.successDetails}>
            You'll receive a confirmation email at {portalToken?.email} shortly.
          </p>
          <div className={styles.successAmount}>
            <span className={styles.successAmountLabel}>Amount Paid:</span>
            <span className={styles.successAmountValue}>{formatCurrency(invoice?.total || '0')}</span>
          </div>
        </div>
      </div>
    );
  }

  // Render error state
  if (state === 'error') {
    return (
      <div className={styles.container} role="main">
        <div className={styles.errorContainer} role="alert">
          <div className={styles.errorIcon} aria-hidden="true">
            ❌
          </div>
          <h1 className={styles.errorTitle}>Payment Error</h1>
          <p className={styles.errorMessage}>{errorMessage}</p>
          <Button
            variant="primary"
            onClick={() => setState('valid')}
            className={styles.retryButton}
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Render invoice and payment UI
  return (
    <div className={styles.container} role="main">
      <div className={styles.invoiceContainer}>
        {/* Header */}
        <header className={styles.header}>
          <h1 className={styles.title}>Invoice</h1>
          <div className={styles.invoiceNumber} aria-label={`Invoice number ${invoice?.invoice_number}`}>
            {invoice?.invoice_number}
          </div>
        </header>

        {/* Invoice Status Badge */}
        <div className={styles.statusBadge} aria-label={`Status: ${invoice?.status}`}>
          <span className={styles.statusDot} aria-hidden="true"></span>
          {invoice?.status === 'PAID' ? 'Paid' : 'Outstanding'}
        </div>

        {/* Invoice Details */}
        <section className={styles.details} aria-labelledby="invoice-details-heading">
          <h2 id="invoice-details-heading" className={styles.sectionHeading}>
            Invoice Details
          </h2>
          <dl className={styles.detailsList}>
            <div className={styles.detailItem}>
              <dt className={styles.detailLabel}>Invoice Date:</dt>
              <dd className={styles.detailValue}>{formatDate(invoice?.invoice_date || 0)}</dd>
            </div>
            <div className={styles.detailItem}>
              <dt className={styles.detailLabel}>Due Date:</dt>
              <dd className={styles.detailValue}>{formatDate(invoice?.due_date || 0)}</dd>
            </div>
            <div className={styles.detailItem}>
              <dt className={styles.detailLabel}>To:</dt>
              <dd className={styles.detailValue}>{portalToken?.email}</dd>
            </div>
          </dl>
        </section>

        {/* Line Items */}
        <section className={styles.lineItems} aria-labelledby="line-items-heading">
          <h2 id="line-items-heading" className={styles.sectionHeading}>
            Items
          </h2>
          <table className={styles.itemsTable} role="table" aria-label="Invoice line items">
            <thead>
              <tr>
                <th scope="col" className={styles.tableHeader}>
                  Description
                </th>
                <th scope="col" className={styles.tableHeader} align="right">
                  Qty
                </th>
                <th scope="col" className={styles.tableHeader} align="right">
                  Price
                </th>
                <th scope="col" className={styles.tableHeader} align="right">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item) => (
                <tr key={item.id} className={styles.tableRow}>
                  <td className={styles.tableCell}>{item.description}</td>
                  <td className={styles.tableCell} align="right">
                    {item.quantity}
                  </td>
                  <td className={styles.tableCell} align="right">
                    {formatCurrency(item.unitPrice)}
                  </td>
                  <td className={styles.tableCell} align="right">
                    {formatCurrency(item.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Totals */}
        <section className={styles.totals} aria-labelledby="totals-heading">
          <h2 id="totals-heading" className="sr-only">
            Invoice Totals
          </h2>
          <dl className={styles.totalsList}>
            <div className={styles.totalItem}>
              <dt className={styles.totalLabel}>Subtotal:</dt>
              <dd className={styles.totalValue}>{formatCurrency(invoice?.subtotal || '0')}</dd>
            </div>
            {parseFloat(invoice?.tax || '0') > 0 && (
              <div className={styles.totalItem}>
                <dt className={styles.totalLabel}>Tax:</dt>
                <dd className={styles.totalValue}>{formatCurrency(invoice?.tax || '0')}</dd>
              </div>
            )}
            <div className={styles.totalItemFinal}>
              <dt className={styles.totalLabelFinal}>Total:</dt>
              <dd className={styles.totalValueFinal}>{formatCurrency(invoice?.total || '0')}</dd>
            </div>
          </dl>
        </section>

        {/* Notes */}
        {invoice?.notes && (
          <section className={styles.notes} aria-labelledby="notes-heading">
            <h2 id="notes-heading" className={styles.sectionHeading}>
              Notes
            </h2>
            <p className={styles.notesText}>{invoice.notes}</p>
          </section>
        )}

        {/* Payment Section */}
        {invoice?.status !== 'PAID' && state === 'valid' && (
          <section className={styles.paymentSection} aria-labelledby="payment-heading">
            <h2 id="payment-heading" className={styles.sectionHeading}>
              Make a Payment
            </h2>
            <p className={styles.paymentDescription}>
              Pay securely using your credit card. Your payment information is encrypted and secure.
            </p>
            <div className={styles.paymentActions}>
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={handlePayNow}
                loading={paymentProcessing}
                disabled={paymentProcessing}
                aria-label={`Pay ${formatCurrency(invoice?.total || '0')} now`}
              >
                {paymentProcessing ? 'Processing...' : `Pay ${formatCurrency(invoice?.total || '0')}`}
              </Button>
            </div>
            <div className={styles.securityBadge} aria-label="Secure payment badge">
              <span aria-hidden="true">🔒</span> Secure Payment
            </div>
          </section>
        )}

        {/* Already Paid Message */}
        {invoice?.status === 'PAID' && (
          <section className={styles.paidSection} role="status" aria-live="polite">
            <div className={styles.paidBadge}>
              <span aria-hidden="true">✓</span> This invoice has been paid
            </div>
            {invoice.paid_at && (
              <p className={styles.paidDate}>Paid on {formatDate(invoice.paid_at)}</p>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
