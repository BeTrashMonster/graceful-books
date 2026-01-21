/**
 * Subscription Manager Component
 *
 * Displays current subscription details and allows tier management
 * Part of IC2 Billing Infrastructure
 */

import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import { Card } from '../ui/Card';
import { Button } from '../core/Button';
import { Loading } from '../feedback/Loading';
import { ErrorMessage } from '../feedback/ErrorMessage';
import type { Subscription, BillingCalculation } from '../../types/billing.types';
import {
  calculateAdvisorMonthlyCost,
  formatCurrency,
} from '../../services/billing.service';
import {
  cancelSubscription,
  reactivateSubscription,
} from '../../services/stripe.service';
import { logger } from '../../utils/logger';

const subscriptionLogger = logger.child('SubscriptionManager');

interface SubscriptionManagerProps {
  userId: string;
}

export function SubscriptionManager({
  userId,
}: SubscriptionManagerProps): JSX.Element {
  const [billing, setBilling] = useState<BillingCalculation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live query for subscription
  const subscription = useLiveQuery(
    () => db.subscriptions.where('user_id').equals(userId).first(),
    [userId]
  );

  // Load billing calculation for advisors
  useEffect(() => {
    if (subscription?.subscription_type === 'advisor') {
      loadBillingCalculation();
    }
  }, [subscription]);

  const loadBillingCalculation = async () => {
    try {
      const calc = await calculateAdvisorMonthlyCost(userId);
      setBilling(calc);
    } catch (err) {
      subscriptionLogger.error('Error loading billing calculation', err);
      setError('Failed to load billing information');
    }
  };

  const handleCancelSubscription = async () => {
    if (!subscription) return;

    if (
      !window.confirm(
        'Are you sure you want to cancel your subscription? You will continue to have access until the end of your current billing period.'
      )
    ) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await cancelSubscription(subscription.id, false);
      subscriptionLogger.info('Subscription canceled', {
        subscriptionId: subscription.id,
      });
    } catch (err: any) {
      subscriptionLogger.error('Error canceling subscription', err);
      setError(err.message || 'Failed to cancel subscription');
    } finally {
      setLoading(false);
    }
  };

  const handleReactivateSubscription = async () => {
    if (!subscription) return;

    setLoading(true);
    setError(null);

    try {
      await reactivateSubscription(subscription.id);
      subscriptionLogger.info('Subscription reactivated', {
        subscriptionId: subscription.id,
      });
    } catch (err: any) {
      subscriptionLogger.error('Error reactivating subscription', err);
      setError(err.message || 'Failed to reactivate subscription');
    } finally {
      setLoading(false);
    }
  };

  if (!subscription) {
    return (
      <Card>
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">Subscription</h2>
          <p className="text-gray-600">
            You don't have an active subscription. Set up billing to get
            started.
          </p>
        </div>
      </Card>
    );
  }

  const isPastDue = subscription.status === 'past_due';
  const isActive = subscription.status === 'active';
  const isCanceled = subscription.status === 'canceled';
  const willCancel = subscription.cancel_at_period_end;

  return (
    <Card>
      <div className="p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-xl font-semibold mb-2">Your Subscription</h2>
            <p className="text-gray-600">
              Manage your Graceful Books subscription
            </p>
          </div>
          <StatusBadge status={subscription.status} willCancel={willCancel} />
        </div>

        {error && (
          <div className="mb-4">
            <ErrorMessage message={error} />
          </div>
        )}

        {/* Subscription Type */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Plan Type
          </label>
          <div className="text-lg font-semibold capitalize">
            {subscription.subscription_type === 'individual'
              ? 'Individual'
              : 'Advisor'}
          </div>
        </div>

        {/* Billing Summary */}
        {subscription.subscription_type === 'advisor' && billing && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold mb-3">Billing Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Clients:</span>
                <span className="font-medium">{billing.clientCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Team Members:</span>
                <span className="font-medium">{billing.teamMemberCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Tier:</span>
                <span className="font-medium">{billing.tierDescription}</span>
              </div>
              {billing.clientCharge > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Client charge:</span>
                  <span className="font-medium">
                    {formatCurrency(billing.clientCharge)}
                  </span>
                </div>
              )}
              {billing.teamMemberCharge > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Team member charge:</span>
                  <span className="font-medium">
                    {formatCurrency(billing.teamMemberCharge)}
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-gray-200">
                <span className="font-semibold">Total:</span>
                <span className="font-semibold text-lg">
                  {formatCurrency(billing.totalMonthlyCost)}/month
                </span>
              </div>
              {billing.charityContribution > 0 && (
                <div className="text-xs text-gray-500 pt-2">
                  Includes {formatCurrency(billing.charityContribution)}/month
                  to your selected charity
                </div>
              )}
            </div>
          </div>
        )}

        {subscription.subscription_type === 'individual' && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Monthly Cost
            </label>
            <div className="text-2xl font-bold">$40/month</div>
            <p className="text-sm text-gray-500 mt-1">
              Includes $5/month to your selected charity
            </p>
          </div>
        )}

        {/* Billing Period */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Current Billing Period
          </label>
          <div className="text-sm text-gray-900">
            {new Date(subscription.current_period_start).toLocaleDateString()} -{' '}
            {new Date(subscription.current_period_end).toLocaleDateString()}
          </div>
        </div>

        {/* Trial Period */}
        {subscription.trial_end && subscription.trial_end > Date.now() && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center">
              <svg
                className="h-5 w-5 text-blue-600 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-sm text-blue-800">
                Trial ends on{' '}
                {new Date(subscription.trial_end).toLocaleDateString()}
              </span>
            </div>
          </div>
        )}

        {/* Past Due Warning */}
        {isPastDue && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <svg
                className="h-5 w-5 text-red-600 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div>
                <div className="text-sm font-semibold text-red-800">
                  Payment Failed
                </div>
                <div className="text-sm text-red-700">
                  Please update your payment method to continue using Graceful
                  Books.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Cancellation Warning */}
        {willCancel && !isCanceled && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center">
              <svg
                className="h-5 w-5 text-yellow-600 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div>
                <div className="text-sm font-semibold text-yellow-800">
                  Subscription Scheduled to Cancel
                </div>
                <div className="text-sm text-yellow-700">
                  Your subscription will end on{' '}
                  {new Date(
                    subscription.current_period_end
                  ).toLocaleDateString()}
                  . You can reactivate it anytime before then.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {willCancel && !isCanceled && (
            <Button
              onClick={handleReactivateSubscription}
              disabled={loading}
              variant="primary"
            >
              {loading ? <Loading size="sm" /> : 'Reactivate Subscription'}
            </Button>
          )}

          {isActive && !willCancel && (
            <Button
              onClick={handleCancelSubscription}
              disabled={loading}
              variant="secondary"
            >
              {loading ? <Loading size="sm" /> : 'Cancel Subscription'}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

interface StatusBadgeProps {
  status: string;
  willCancel: boolean;
}

function StatusBadge({ status, willCancel }: StatusBadgeProps): JSX.Element {
  let color = 'bg-gray-100 text-gray-800';
  let label = status;

  if (status === 'active') {
    color = willCancel
      ? 'bg-yellow-100 text-yellow-800'
      : 'bg-green-100 text-green-800';
    label = willCancel ? 'Canceling' : 'Active';
  } else if (status === 'past_due') {
    color = 'bg-red-100 text-red-800';
    label = 'Past Due';
  } else if (status === 'canceled') {
    color = 'bg-gray-100 text-gray-800';
    label = 'Canceled';
  } else if (status === 'trialing') {
    color = 'bg-blue-100 text-blue-800';
    label = 'Trial';
  }

  return (
    <span
      className={`px-3 py-1 text-xs font-semibold rounded-full ${color}`}
    >
      {label}
    </span>
  );
}
