/**
 * Stripe Service
 *
 * Centralized Stripe client and helper functions
 */

import Stripe from 'stripe';

// =============================================================================
// STRIPE CLIENT INITIALIZATION
// =============================================================================

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const IS_STRIPE_ENABLED = !!stripeSecretKey && stripeSecretKey.length > 0;

// Initialize Stripe client only if key is provided
// This allows the app to start without Stripe configured (e.g., for testing)
let stripe: Stripe | null = null;

if (IS_STRIPE_ENABLED) {
  stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2026-02-25.clover',
    typescript: true,
  });
} else {
  // Log warning only in non-test environments
  if (process.env.NODE_ENV !== 'test') {
    console.warn('[Stripe] STRIPE_SECRET_KEY not configured. Stripe functionality will not work.');
  }
}

/**
 * Check if Stripe is enabled
 */
export function isStripeEnabled(): boolean {
  return IS_STRIPE_ENABLED && stripe !== null;
}

/**
 * Get the Stripe client, throwing if not configured
 * Use this for operations that absolutely require Stripe
 */
export function getStripeClient(): Stripe {
  if (!stripe) {
    throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY environment variable.');
  }
  return stripe;
}

// Export stripe for backwards compatibility (may be null)
export { stripe };

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
  trialDays = 7, // Default 7-day trial, but can be customized (e.g., 30 days for workshops)
}: {
  priceId: string;
  userId: string; // Changed from number to string (UUID)
  userEmail: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
  trialDays?: number; // Allow dynamic trial length per product/workshop
}): Promise<Stripe.Checkout.Session> {
  // Build subscription_data - only include trial_period_days if > 0
  const subscriptionData: Stripe.Checkout.SessionCreateParams['subscription_data'] = {
    metadata: {
      userId: userId,
      ...metadata,
    },
  };

  // Only add trial if trialDays is greater than 0 (Stripe minimum is 1)
  if (trialDays > 0) {
    subscriptionData.trial_period_days = trialDays;
  }

  const session = await getStripeClient().checkout.sessions.create({
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
    client_reference_id: userId,
    allow_promotion_codes: true,
    metadata: {
      userId: userId,
      ...metadata,
    },
    subscription_data: subscriptionData,
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
  return getStripeClient().webhooks.constructEvent(payload, signature, webhookSecret);
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
      await getStripeClient().subscriptions.cancel(subscriptionId);
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
  return await getStripeClient().subscriptions.update(subscriptionId, {
    pause_collection: {
      behavior: 'void', // Don't collect payments while paused
    },
  });
}

/**
 * Resume a paused subscription (charges immediately)
 */
export async function resumeSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
  return await getStripeClient().subscriptions.update(subscriptionId, {
    pause_collection: null, // Resume billing
    billing_cycle_anchor: 'now', // Start new billing cycle immediately
    proration_behavior: 'create_prorations', // Charge for the current period
  });
}

/**
 * Get customer's payment methods
 */
export async function getPaymentMethods(customerId: string): Promise<Stripe.PaymentMethod[]> {
  const paymentMethods = await getStripeClient().paymentMethods.list({
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
  const customer = await getStripeClient().customers.retrieve(customerId);

  if (customer.deleted) {
    return null;
  }

  // First, check if customer has a default payment method
  const defaultPaymentMethodId =
    typeof customer.invoice_settings.default_payment_method === 'string'
      ? customer.invoice_settings.default_payment_method
      : customer.invoice_settings.default_payment_method?.id;

  if (defaultPaymentMethodId) {
    return await getStripeClient().paymentMethods.retrieve(defaultPaymentMethodId);
  }

  // If no default payment method, check active subscriptions
  // (Payment method might be on subscription from Checkout)
  const subscriptions = await getStripeClient().subscriptions.list({
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
      return await getStripeClient().paymentMethods.retrieve(subPaymentMethodId);
    }
  }

  // Also check trialing subscriptions
  const trialSubscriptions = await getStripeClient().subscriptions.list({
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
      return await getStripeClient().paymentMethods.retrieve(subPaymentMethodId);
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
  await getStripeClient().paymentMethods.attach(paymentMethodId, {
    customer: customerId,
  });

  // Set as default payment method
  return await getStripeClient().customers.update(customerId, {
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
  const invoices = await getStripeClient().invoices.list({
    customer: customerId,
    limit,
  });
  return invoices.data;
}

/**
 * Create a Setup Intent for updating payment method
 */
export async function createSetupIntent(customerId: string): Promise<Stripe.SetupIntent> {
  return await getStripeClient().setupIntents.create({
    customer: customerId,
    payment_method_types: ['card'],
  });
}
