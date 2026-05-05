/**
 * Stripe Service
 *
 * Centralized Stripe client and helper functions
 */

import Stripe from 'stripe';

// Initialize Stripe client
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY environment variable is required');
}

export const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2024-09-30.acacia',
  typescript: true,
});

/**
 * Create a Stripe checkout session for a product subscription
 */
export async function createCheckoutSession({
  priceId,
  userId,
  userEmail,
  successUrl,
  cancelUrl,
  metadata,
}: {
  priceId: string;
  userId: string; // Changed from number to string (UUID)
  userEmail: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}): Promise<Stripe.Checkout.Session> {
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    customer_email: userEmail,
    client_reference_id: userId, // Already a string, no need to convert
    allow_promotion_codes: true, // Enable promo code field in checkout
    metadata: {
      userId: userId, // Already a string
      ...metadata,
    },
    subscription_data: {
      trial_period_days: 7, // 7-day free trial for all new subscriptions
      metadata: {
        userId: userId, // Already a string
        ...metadata,
      },
    },
  });

  return session;
}

/**
 * Verify Stripe webhook signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  webhookSecret: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

/**
 * Cancel all active subscriptions for a user
 * Used when user permanently deletes their account
 */
export async function cancelAllUserSubscriptions(
  subscriptionIds: string[]
): Promise<{ cancelled: number; errors: string[] }> {
  const errors: string[] = [];
  let cancelled = 0;

  for (const subscriptionId of subscriptionIds) {
    try {
      await stripe.subscriptions.cancel(subscriptionId);
      cancelled++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Failed to cancel subscription ${subscriptionId}: ${errorMessage}`);
      console.error(`[Stripe] Failed to cancel subscription ${subscriptionId}:`, error);
    }
  }

  return { cancelled, errors };
}

/**
 * Pause a subscription (user still has read-only access)
 */
export async function pauseSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
  return await stripe.subscriptions.update(subscriptionId, {
    pause_collection: {
      behavior: 'void', // Don't collect payments while paused
    },
  });
}

/**
 * Resume a paused subscription (charges immediately)
 */
export async function resumeSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
  return await stripe.subscriptions.update(subscriptionId, {
    pause_collection: null, // Resume billing
    billing_cycle_anchor: 'now', // Start new billing cycle immediately
    proration_behavior: 'create_prorations', // Charge for the current period
  });
}

/**
 * Get customer's payment methods
 */
export async function getPaymentMethods(customerId: string): Promise<Stripe.PaymentMethod[]> {
  const paymentMethods = await stripe.paymentMethods.list({
    customer: customerId,
    type: 'card',
  });
  return paymentMethods.data;
}

/**
 * Get customer's default payment method
 *
 * Checks both customer default and active subscription payment methods
 */
export async function getDefaultPaymentMethod(
  customerId: string
): Promise<Stripe.PaymentMethod | null> {
  const customer = await stripe.customers.retrieve(customerId);

  if (customer.deleted) {
    return null;
  }

  // First, check if customer has a default payment method
  const defaultPaymentMethodId =
    typeof customer.invoice_settings.default_payment_method === 'string'
      ? customer.invoice_settings.default_payment_method
      : customer.invoice_settings.default_payment_method?.id;

  if (defaultPaymentMethodId) {
    return await stripe.paymentMethods.retrieve(defaultPaymentMethodId);
  }

  // If no default payment method, check active subscriptions
  // (Payment method might be on subscription from Checkout)
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: 'active',
    limit: 1,
  });

  if (subscriptions.data.length > 0) {
    const subscription = subscriptions.data[0];
    const subPaymentMethodId =
      typeof subscription.default_payment_method === 'string'
        ? subscription.default_payment_method
        : subscription.default_payment_method?.id;

    if (subPaymentMethodId) {
      return await stripe.paymentMethods.retrieve(subPaymentMethodId);
    }
  }

  // Also check trialing subscriptions
  const trialSubscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: 'trialing',
    limit: 1,
  });

  if (trialSubscriptions.data.length > 0) {
    const subscription = trialSubscriptions.data[0];
    const subPaymentMethodId =
      typeof subscription.default_payment_method === 'string'
        ? subscription.default_payment_method
        : subscription.default_payment_method?.id;

    if (subPaymentMethodId) {
      return await stripe.paymentMethods.retrieve(subPaymentMethodId);
    }
  }

  return null;
}

/**
 * Update customer's default payment method
 */
export async function updateDefaultPaymentMethod(
  customerId: string,
  paymentMethodId: string
): Promise<Stripe.Customer> {
  // Attach payment method to customer
  await stripe.paymentMethods.attach(paymentMethodId, {
    customer: customerId,
  });

  // Set as default payment method
  return await stripe.customers.update(customerId, {
    invoice_settings: {
      default_payment_method: paymentMethodId,
    },
  });
}

/**
 * Get customer's invoice history
 */
export async function getInvoiceHistory(
  customerId: string,
  limit: number = 10
): Promise<Stripe.Invoice[]> {
  const invoices = await stripe.invoices.list({
    customer: customerId,
    limit,
  });
  return invoices.data;
}

/**
 * Create a Setup Intent for updating payment method
 */
export async function createSetupIntent(customerId: string): Promise<Stripe.SetupIntent> {
  return await stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: ['card'],
  });
}
