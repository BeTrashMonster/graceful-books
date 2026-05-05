/**
 * PaymentMethodCard Component
 *
 * Displays current payment method and allows updating via Stripe Elements.
 */

import { useState, useEffect } from 'react';
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
  const [editingNickname, setEditingNickname] = useState(false);
  const [nickname, setNickname] = useState<string>('');

  // Load nickname from localStorage on mount
  useEffect(() => {
    if (paymentMethod) {
      const storageKey = `payment_nickname_${paymentMethod.id}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setNickname(saved);
      }
    }
  }, [paymentMethod]);

  /**
   * Save nickname to localStorage
   */
  const handleSaveNickname = (value: string) => {
    if (paymentMethod) {
      const storageKey = `payment_nickname_${paymentMethod.id}`;
      if (value.trim()) {
        localStorage.setItem(storageKey, value.trim());
        setNickname(value.trim());
      } else {
        localStorage.removeItem(storageKey);
        setNickname('');
      }
    }
    setEditingNickname(false);
  };

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
              {/* Nickname/Label Section */}
              <div className={styles.nicknameSection}>
                {editingNickname ? (
                  <input
                    type="text"
                    className={styles.nicknameInput}
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    onBlur={() => handleSaveNickname(nickname)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveNickname(nickname);
                      if (e.key === 'Escape') { setEditingNickname(false); setNickname(localStorage.getItem(`payment_nickname_${paymentMethod.id}`) || ''); }
                    }}
                    placeholder="Add a label (e.g., Business Card)"
                    autoFocus
                    maxLength={30}
                  />
                ) : (
                  <div className={styles.nicknameDisplay} onClick={() => setEditingNickname(true)}>
                    <span className={styles.nicknameText}>
                      {nickname || 'Add a label (click to edit)'}
                    </span>
                    <span className={styles.editIcon}>✏️</span>
                  </div>
                )}
              </div>

              <div className={styles.paymentMethodContent}>
                <div className={styles.cardDisplay}>
                  <div className={styles.cardIcon}>
                    {/* Stripe Link */}
                    {paymentMethod.brand === 'link' && '🔗'}
                    {/* US Bank Account */}
                    {paymentMethod.type === 'us_bank_account' && '🏦'}
                    {paymentMethod.type === 'link' && '🔗'}
                    {/* Credit Cards */}
                    {paymentMethod.brand === 'visa' && '💳'}
                    {paymentMethod.brand === 'mastercard' && '💳'}
                    {paymentMethod.brand === 'amex' && '💳'}
                    {paymentMethod.brand === 'discover' && '💳'}
                    {paymentMethod.type === 'card' && !['visa', 'mastercard', 'amex', 'discover', 'link'].includes(paymentMethod.brand) && '💳'}
                  </div>
                  <div className={styles.cardDetails}>
                    {/* Payment Type */}
                    <div className={styles.cardBrand}>
                      {paymentMethod.brand === 'link' ? (
                        'Stripe Link Payment Method'
                      ) : paymentMethod.type === 'us_bank_account' && paymentMethod.bankName ? (
                        `${paymentMethod.bankName} ${paymentMethod.accountType === 'checking' ? 'Checking' : 'Savings'}`
                      ) : paymentMethod.type === 'link' ? (
                        'Bank Account (Stripe Link)'
                      ) : paymentMethod.brand === 'visa' ? (
                        'Visa'
                      ) : paymentMethod.brand === 'mastercard' ? (
                        'Mastercard'
                      ) : paymentMethod.brand === 'amex' ? (
                        'American Express'
                      ) : paymentMethod.brand === 'discover' ? (
                        'Discover'
                      ) : (
                        paymentMethod.brand?.charAt(0).toUpperCase() + paymentMethod.brand?.slice(1)
                      )}
                    </div>

                    {/* Account/Card Number - Hide for Link since it's placeholder data */}
                    {paymentMethod.last4 && paymentMethod.brand !== 'link' && (
                      <div className={styles.cardNumber}>
                        {paymentMethod.type === 'card' ?
                          `•••• •••• •••• ${paymentMethod.last4}` :
                          `Account ending in ${paymentMethod.last4}`}
                      </div>
                    )}

                    {/* Helpful message for Link users */}
                    {paymentMethod.brand === 'link' && (
                      <div className={styles.cardExpiry}>
                        Use the label above to identify this payment method
                      </div>
                    )}

                    {/* Email for Link */}
                    {paymentMethod.email && (
                      <div className={styles.cardExpiry}>
                        {paymentMethod.email}
                      </div>
                    )}

                    {/* Expiry for cards only - Hide for Link */}
                    {paymentMethod.type === 'card' && paymentMethod.brand !== 'link' && paymentMethod.expMonth && paymentMethod.expYear && (
                      <div className={styles.cardExpiry}>
                        Expires {paymentMethod.expMonth}/{paymentMethod.expYear}
                      </div>
                    )}
                  </div>
                </div>
                <Button variant="outline" onClick={handleOpenUpdateModal} disabled={loading}>
                  {loading ? 'Loading...' : 'Update Payment Method'}
                </Button>
              </div>
            </div>
          ) : (
            <div className={styles.noPaymentMethod}>
              <p>No payment method on file.</p>
              <Button variant="purple" onClick={handleOpenUpdateModal} disabled={loading}>
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
