/**
 * Billing Page
 *
 * Comprehensive billing management page where users can:
 * - View subscription status
 * - Pause/resume subscription
 * - Manage payment methods
 * - View invoice history
 * - Delete account
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SubscriptionStatusCard } from '../components/billing/SubscriptionStatusCard';
import { PaymentMethodCard } from '../components/billing/PaymentMethodCard';
import { InvoiceHistoryTable } from '../components/billing/InvoiceHistoryTable';
import { AccountDeletionSection } from '../components/billing/AccountDeletionSection';
import { Loading } from '../components/feedback/Loading';
import { Alert } from '../components/feedback/ErrorMessage';
import { getSubscription, getPaymentMethod, getInvoices } from '../services/billing.api';
import type { Subscription, PaymentMethod, Invoice } from '../services/billing.api';

export default function Billing() {
  const navigate = useNavigate();

  // State
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load billing data
  useEffect(() => {
    loadBillingData();
  }, []);

  const loadBillingData = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('[Billing] Loading billing data...');

      const subscriptionData = await getSubscription().catch((err) => {
        console.error('[Billing] Subscription error:', err);
        return null;
      });

      const paymentMethodData = await getPaymentMethod().catch((err) => {
        console.error('[Billing] Payment method error:', err);
        return null;
      });

      const invoicesData = await getInvoices().catch((err) => {
        console.error('[Billing] Invoices error:', err);
        return [];
      });

      console.log('[Billing] Loaded data:', { subscriptionData, paymentMethodData, invoicesData });

      setSubscription(subscriptionData);
      setPaymentMethod(paymentMethodData);
      setInvoices(invoicesData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load billing information';
      setError(message);
      console.error('[Billing] Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle subscription status change (pause/resume)
   */
  const handleSubscriptionChange = () => {
    loadBillingData();
  };

  /**
   * Handle payment method update
   */
  const handlePaymentMethodUpdated = () => {
    loadBillingData();
  };

  /**
   * Handle account deletion
   */
  const handleAccountDeleted = () => {
    // Clear session
    sessionStorage.clear();

    // Redirect to home
    navigate('/', { replace: true });

    // Show success message
    alert('Your account has been deleted successfully. You have been logged out.');
  };

  if (loading) {
    return (
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">Billing</h1>
        </div>
        <div className="page-content">
          <Loading message="Loading billing information..." />
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Billing</h1>
        <p className="page-description">
          Manage your subscription, payment methods, and billing history.
        </p>
      </div>

      <div className="page-content">
        {error && (
          <Alert variant="error" style={{ marginBottom: '1.5rem' }}>
            {error}
          </Alert>
        )}

        {/* Subscription Status */}
        <SubscriptionStatusCard
          subscription={subscription}
          onSubscriptionChange={handleSubscriptionChange}
        />

        {/* Payment Method */}
        <PaymentMethodCard
          paymentMethod={paymentMethod}
          onPaymentMethodUpdated={handlePaymentMethodUpdated}
        />

        {/* Invoice History */}
        <InvoiceHistoryTable invoices={invoices} />

        {/* Account Deletion */}
        <AccountDeletionSection onAccountDeleted={handleAccountDeleted} />
      </div>
    </div>
  );
}
