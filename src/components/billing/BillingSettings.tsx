/**
 * Billing Settings Component
 *
 * Main billing page that combines subscription management, payment methods, and invoices
 * Part of IC2 Billing Infrastructure
 */

import React from 'react';
import { SubscriptionManager } from './SubscriptionManager';
import { PaymentMethodManager } from './PaymentMethodManager';
import { InvoiceHistory } from './InvoiceHistory';

interface BillingSettingsProps {
  userId: string;
}

export function BillingSettings({ userId }: BillingSettingsProps): JSX.Element {
  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Billing & Subscription
        </h1>
        <p className="text-gray-600">
          Manage your subscription, payment methods, and view your billing
          history.
        </p>
      </div>

      {/* Subscription Overview */}
      <section>
        <SubscriptionManager userId={userId} />
      </section>

      {/* Payment Methods */}
      <section>
        <PaymentMethodManager userId={userId} />
      </section>

      {/* Invoice History */}
      <section>
        <InvoiceHistory userId={userId} />
      </section>
    </div>
  );
}
