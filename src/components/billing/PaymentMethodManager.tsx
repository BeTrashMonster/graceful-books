/**
 * Payment Method Manager Component
 *
 * Manages user payment methods with Stripe Elements
 * Part of IC2 Billing Infrastructure
 */

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import { Card } from '../ui/Card';
import { Button } from '../core/Button';
import { Loading } from '../feedback/Loading';
import { ErrorMessage } from '../feedback/ErrorMessage';
import type { PaymentMethod } from '../../types/billing.types';
import { logger } from '../../utils/logger';

const paymentLogger = logger.child('PaymentMethodManager');

interface PaymentMethodManagerProps {
  userId: string;
}

export function PaymentMethodManager({
  userId,
}: PaymentMethodManagerProps): JSX.Element {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Live query for payment methods
  const paymentMethods = useLiveQuery(
    () =>
      db.paymentMethods
        .where('user_id')
        .equals(userId)
        .and((pm) => pm.deleted_at === null)
        .toArray(),
    [userId]
  );

  const handleAddPaymentMethod = () => {
    setShowAddForm(true);
  };

  const handleSetDefault = async (paymentMethodId: string) => {
    setLoading(true);
    setError(null);

    try {
      // Unset all other default payment methods
      await db.paymentMethods
        .where('user_id')
        .equals(userId)
        .modify({ is_default: false });

      // Set this one as default
      await db.paymentMethods.update(paymentMethodId, { is_default: true });

      paymentLogger.info('Set default payment method', { paymentMethodId });
    } catch (err: any) {
      paymentLogger.error('Error setting default payment method', err);
      setError(err.message || 'Failed to set default payment method');
    } finally {
      setLoading(false);
    }
  };

  const handleRemovePaymentMethod = async (paymentMethodId: string) => {
    if (
      !window.confirm('Are you sure you want to remove this payment method?')
    ) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await db.paymentMethods.update(paymentMethodId, {
        deleted_at: Date.now(),
      });

      paymentLogger.info('Removed payment method', { paymentMethodId });
    } catch (err: any) {
      paymentLogger.error('Error removing payment method', err);
      setError(err.message || 'Failed to remove payment method');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Payment Methods</h2>
          <Button onClick={handleAddPaymentMethod} variant="primary">
            Add Payment Method
          </Button>
        </div>

        {error && (
          <div className="mb-4">
            <ErrorMessage message={error} />
          </div>
        )}

        {!paymentMethods || paymentMethods.length === 0 ? (
          <p className="text-gray-600">
            No payment methods added yet. Add one to manage your subscription.
          </p>
        ) : (
          <div className="space-y-3">
            {paymentMethods.map((pm) => (
              <PaymentMethodItem
                key={pm.id}
                paymentMethod={pm}
                onSetDefault={handleSetDefault}
                onRemove={handleRemovePaymentMethod}
                loading={loading}
              />
            ))}
          </div>
        )}

        {showAddForm && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800 mb-2">
              To add a payment method, you'll need to integrate Stripe Elements
              in your application. This is a placeholder for the payment method
              form.
            </p>
            <Button onClick={() => setShowAddForm(false)} variant="secondary">
              Close
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

interface PaymentMethodItemProps {
  paymentMethod: PaymentMethod;
  onSetDefault: (id: string) => void;
  onRemove: (id: string) => void;
  loading: boolean;
}

function PaymentMethodItem({
  paymentMethod,
  onSetDefault,
  onRemove,
  loading,
}: PaymentMethodItemProps): JSX.Element {
  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-4">
        {/* Card Icon */}
        <div className="w-12 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded flex items-center justify-center text-white font-semibold text-xs">
          {paymentMethod.card_brand?.toUpperCase() || 'CARD'}
        </div>

        <div>
          <div className="font-medium text-gray-900">
            {paymentMethod.card_brand &&
              `${
                paymentMethod.card_brand.charAt(0).toUpperCase() +
                paymentMethod.card_brand.slice(1)
              } •••• ${paymentMethod.card_last4}`}
          </div>
          {paymentMethod.card_exp_month && paymentMethod.card_exp_year && (
            <div className="text-sm text-gray-600">
              Expires {paymentMethod.card_exp_month}/
              {paymentMethod.card_exp_year}
            </div>
          )}
        </div>

        {paymentMethod.is_default && (
          <span className="px-2 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded-full">
            Default
          </span>
        )}
      </div>

      <div className="flex gap-2">
        {!paymentMethod.is_default && (
          <Button
            onClick={() => onSetDefault(paymentMethod.id)}
            disabled={loading}
            variant="secondary"
            size="small"
          >
            Set as Default
          </Button>
        )}
        <Button
          onClick={() => onRemove(paymentMethod.id)}
          disabled={loading}
          variant="secondary"
          size="small"
        >
          Remove
        </Button>
      </div>
    </div>
  );
}
