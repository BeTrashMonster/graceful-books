/**
 * PaymentMethodCard Component
 *
 * Displays current payment method and allows updating via Stripe Elements.
 */

import { useState } from 'react';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { Card, CardHeader, CardBody } from '../ui/Card';
import { Button } from '../core/Button';
import { Modal } from '../modals/Modal';
import { Alert } from '../feedback/ErrorMessage';
import { Loading } from '../feedback/Loading';
import { createSetupIntent, updatePaymentMethod } from '../../services/billing.api';
import type { PaymentMethod } from '../../services/billing.api';
import styles from './PaymentMethodCard.module.css';

// Initialize Stripe
const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLIC_KEY || ''
);

interface PaymentMethodCardProps {
  paymentMethod: PaymentMethod | null;
  onPaymentMethodUpdated: () => void;
}

/**
 * Inner component that uses Stripe hooks
 */
function PaymentForm({
  onSuccess,
  onError,
}: {
  onSuccess: () => void;
  onError: (error: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);

    try {
      // Confirm setup
      const { error, setupIntent } = await stripe.confirmSetup({
        elements,
        redirect: 'if_required',
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!setupIntent || !setupIntent.payment_method) {
        throw new Error('No payment method returned from Stripe');
      }

      // Update default payment method in our backend
      const paymentMethodId =
        typeof setupIntent.payment_method === 'string'
          ? setupIntent.payment_method
          : setupIntent.payment_method.id;

      await updatePaymentMethod(paymentMethodId);

      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update payment method';
      onError(message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.paymentForm}>
      <PaymentElement />
      <div className={styles.formActions}>
        <Button type="submit" variant="primary" disabled={!stripe || processing}>
          {processing ? 'Updating...' : 'Update Payment Method'}
        </Button>
      </div>
    </form>
  );
}

export function PaymentMethodCard({ paymentMethod, onPaymentMethodUpdated }: PaymentMethodCardProps) {
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  /**
   * Open update modal and create setup intent
   */
  const handleOpenUpdateModal = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      console.log('[PaymentMethodCard] Creating setup intent...');
      const secret = await createSetupIntent();
      console.log('[PaymentMethodCard] Setup intent created successfully');
      setClientSecret(secret);
      setShowUpdateModal(true);
    } catch (err) {
      console.error('[PaymentMethodCard] Setup intent error:', err);
      const message = err instanceof Error ? err.message : 'Failed to initialize payment update';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle successful payment method update
   */
  const handleSuccess = () => {
    setSuccess(true);
    setShowUpdateModal(false);
    setClientSecret(null);
    onPaymentMethodUpdated();
  };

  /**
   * Handle payment update error
   */
  const handleError = (errorMessage: string) => {
    setError(errorMessage);
  };

  /**
   * Close modal and reset
   */
  const handleCloseModal = () => {
    setShowUpdateModal(false);
    setClientSecret(null);
    setError(null);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <h2>Payment Method</h2>
        </CardHeader>
        <CardBody>
          {success && (
            <Alert variant="success" className={styles.successAlert}>
              Payment method updated successfully!
            </Alert>
          )}

          {error && !showUpdateModal && (
            <Alert variant="error" className={styles.errorAlert}>
              {error}
            </Alert>
          )}

          {paymentMethod ? (
            <div className={styles.paymentMethodInfo}>
              <div className={styles.cardDisplay}>
                <div className={styles.cardIcon}>
                  {paymentMethod.brand === 'visa' && '💳'}
                  {paymentMethod.brand === 'mastercard' && '💳'}
                  {paymentMethod.brand === 'amex' && '💳'}
                  {!['visa', 'mastercard', 'amex'].includes(paymentMethod.brand) && '💳'}
                </div>
                <div className={styles.cardDetails}>
                  <div className={styles.cardBrand}>
                    {paymentMethod.brand.charAt(0).toUpperCase() + paymentMethod.brand.slice(1)}
                  </div>
                  <div className={styles.cardNumber}>•••• •••• •••• {paymentMethod.last4}</div>
                  <div className={styles.cardExpiry}>
                    Expires {paymentMethod.expMonth}/{paymentMethod.expYear}
                  </div>
                </div>
              </div>
              <Button variant="secondary" onClick={handleOpenUpdateModal} disabled={loading}>
                {loading ? 'Loading...' : 'Update Payment Method'}
              </Button>
            </div>
          ) : (
            <div className={styles.noPaymentMethod}>
              <p>No payment method on file.</p>
              <Button variant="primary" onClick={handleOpenUpdateModal} disabled={loading}>
                {loading ? 'Loading...' : 'Add Payment Method'}
              </Button>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Update Payment Method Modal */}
      <Modal
        isOpen={showUpdateModal}
        onClose={handleCloseModal}
        title="Update Payment Method"
        size="md"
      >
        <div className={styles.modalContent}>
          <p className={styles.modalDescription}>
            Enter your new payment card details below. This will become your default payment
            method for all subscriptions.
          </p>

          {error && <Alert variant="error">{error}</Alert>}

          {clientSecret && stripePromise ? (
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: 'stripe',
                  variables: {
                    colorPrimary: '#4b006e',
                    colorBackground: '#ffffff',
                    colorText: '#1f2937',
                    colorDanger: '#ef4444',
                    fontFamily: 'system-ui, sans-serif',
                    spacingUnit: '4px',
                    borderRadius: '6px',
                  },
                },
              }}
            >
              <PaymentForm onSuccess={handleSuccess} onError={handleError} />
            </Elements>
          ) : (
            <Loading message="Loading payment form..." />
          )}

          <div className={styles.secureNotice}>
            <span className={styles.lockIcon}>🔒</span>
            <span>Your payment information is encrypted and secure</span>
          </div>
        </div>
      </Modal>
    </>
  );
}
