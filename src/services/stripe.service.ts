/**
 * Stripe Integration Service
 *
 * Handles all Stripe API interactions for billing (IC2)
 * Includes subscription management, payment processing, and webhook handling
 */

import Stripe from 'stripe';
import { db } from '../db/database';
import type {
  Subscription,
  CreateSubscriptionParams,
  UpdateSubscriptionParams,
  CreatePaymentMethodParams,
  PaymentMethod,
  BillingInvoice,
  SubscriptionType,
  SubscriptionStatus,
  BillingError,
  StripeWebhookEvent,
} from '../types/billing.types';
import {
  calculateAdvisorMonthlyCost,
} from './billing.service';
import { logger } from '../utils/logger';

const stripeLogger = logger.child('StripeService');

// Initialize Stripe with API key from environment
// In production, this should come from secure environment variables
const stripeSecretKey = import.meta.env.VITE_STRIPE_SECRET_KEY || '';
const stripeWebhookSecret = import.meta.env.VITE_STRIPE_WEBHOOK_SECRET || '';

let stripe: Stripe | null = null;

/**
 * Initialize Stripe SDK
 */
export function initializeStripe(): void {
  if (!stripeSecretKey) {
    stripeLogger.warn(
      'Stripe secret key not configured - billing features will not work'
    );
    return;
  }

  stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2024-11-20.acacia',
    typescript: true,
  });

  stripeLogger.info('Stripe SDK initialized');
}

/**
 * Get Stripe instance (lazy initialization)
 */
function getStripe(): Stripe {
  if (!stripe) {
    initializeStripe();
  }

  if (!stripe) {
    throw new Error('Stripe not initialized - check VITE_STRIPE_SECRET_KEY');
  }

  return stripe;
}

/**
 * Create a Stripe customer
 */
export async function createStripeCustomer(
  email: string,
  name: string,
  userId: string
): Promise<string> {
  try {
    const stripe = getStripe();

    const customer = await stripe.customers.create({
      email,
      name,
      metadata: {
        user_id: userId,
      },
    });

    stripeLogger.info('Created Stripe customer', {
      customerId: customer.id,
      userId,
    });

    return customer.id;
  } catch (error) {
    stripeLogger.error('Error creating Stripe customer', error);
    throw handleStripeError(error);
  }
}

/**
 * Create a subscription for a user
 */
export async function createSubscription(
  params: CreateSubscriptionParams
): Promise<Subscription> {
  try {
    const stripe = getStripe();
    const now = Date.now();

    // Get or create Stripe customer
    let stripeCustomerId = await getStripeCustomerId(params.userId);

    if (!stripeCustomerId) {
      // Create new customer
      const user = await db.users.get(params.userId);
      if (!user) {
        throw new Error('User not found');
      }

      stripeCustomerId = await createStripeCustomer(
        user.email,
        user.name || user.email,
        params.userId
      );
    }

    // Attach payment method to customer
    await stripe.paymentMethods.attach(params.paymentMethodId, {
      customer: stripeCustomerId,
    });

    // Set as default payment method
    await stripe.customers.update(stripeCustomerId, {
      invoice_settings: {
        default_payment_method: params.paymentMethodId,
      },
    });

    // Determine price ID based on subscription type
    const priceId = getPriceIdForSubscriptionType(params.subscriptionType);

    // Create subscription
    const stripeSubscription = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [{ price: priceId }],
      default_payment_method: params.paymentMethodId,
      trial_period_days: params.trialDays,
      expand: ['latest_invoice'],
    });

    // Store subscription in database
    const subscription: Subscription = {
      id: crypto.randomUUID(),
      user_id: params.userId,
      company_id: params.companyId,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscription.id,
      subscription_type: params.subscriptionType,
      status: stripeSubscription.status as SubscriptionStatus,
      current_period_start: stripeSubscription.current_period_start * 1000,
      current_period_end: stripeSubscription.current_period_end * 1000,
      cancel_at_period_end: stripeSubscription.cancel_at_period_end,
      canceled_at: stripeSubscription.canceled_at
        ? stripeSubscription.canceled_at * 1000
        : null,
      trial_start: stripeSubscription.trial_start
        ? stripeSubscription.trial_start * 1000
        : null,
      trial_end: stripeSubscription.trial_end
        ? stripeSubscription.trial_end * 1000
        : null,
      client_charge: 0,
      team_member_charge: 0,
      charity_contribution: 0,
      total_amount: 0,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };

    await db.subscriptions.add(subscription);

    stripeLogger.info('Created subscription', {
      subscriptionId: subscription.id,
      userId: params.userId,
      type: params.subscriptionType,
    });

    return subscription;
  } catch (error) {
    stripeLogger.error('Error creating subscription', error);
    throw handleStripeError(error);
  }
}

/**
 * Update subscription based on client/team member count changes
 */
export async function updateSubscription(
  params: UpdateSubscriptionParams
): Promise<void> {
  try {
    const stripe = getStripe();

    const subscription = await db.subscriptions.get(params.subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    if (!subscription.stripe_subscription_id) {
      throw new Error('Stripe subscription ID not found');
    }

    // For advisor subscriptions, recalculate billing
    if (subscription.subscription_type === 'advisor') {
      const billing = await calculateAdvisorMonthlyCost(subscription.user_id);

      // Update Stripe subscription if amount changed
      const currentAmount = subscription.total_amount;
      const newAmount = billing.totalMonthlyCost;

      if (currentAmount !== newAmount) {
        const stripeSubscription = await stripe.subscriptions.retrieve(
          subscription.stripe_subscription_id
        );

        // Update subscription items with new price
        const newPriceId = getPriceIdForAmount(newAmount);

        await stripe.subscriptions.update(subscription.stripe_subscription_id, {
          items: [
            {
              id: stripeSubscription.items.data[0].id,
              price: newPriceId,
            },
          ],
          proration_behavior: 'always_invoice',
        });

        // Update local subscription record
        await db.subscriptions.update(params.subscriptionId, {
          client_charge: billing.clientCharge,
          team_member_charge: billing.teamMemberCharge,
          charity_contribution: billing.charityContribution,
          total_amount: billing.totalMonthlyCost,
          updated_at: Date.now(),
        });

        stripeLogger.info('Updated subscription', {
          subscriptionId: params.subscriptionId,
          oldAmount: currentAmount,
          newAmount,
          tier: billing.tier,
        });
      }
    }

    // Handle cancel at period end
    if (params.cancelAtPeriodEnd !== undefined) {
      await stripe.subscriptions.update(subscription.stripe_subscription_id, {
        cancel_at_period_end: params.cancelAtPeriodEnd,
      });

      await db.subscriptions.update(params.subscriptionId, {
        cancel_at_period_end: params.cancelAtPeriodEnd,
        updated_at: Date.now(),
      });
    }
  } catch (error) {
    stripeLogger.error('Error updating subscription', error);
    throw handleStripeError(error);
  }
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(
  subscriptionId: string,
  cancelImmediately: boolean = false
): Promise<void> {
  try {
    const stripe = getStripe();

    const subscription = await db.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    if (!subscription.stripe_subscription_id) {
      throw new Error('Stripe subscription ID not found');
    }

    if (cancelImmediately) {
      await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
    } else {
      await stripe.subscriptions.update(subscription.stripe_subscription_id, {
        cancel_at_period_end: true,
      });
    }

    await db.subscriptions.update(subscriptionId, {
      cancel_at_period_end: !cancelImmediately,
      canceled_at: cancelImmediately ? Date.now() : null,
      status: cancelImmediately ? 'canceled' : subscription.status,
      updated_at: Date.now(),
    });

    stripeLogger.info('Canceled subscription', {
      subscriptionId,
      immediate: cancelImmediately,
    });
  } catch (error) {
    stripeLogger.error('Error canceling subscription', error);
    throw handleStripeError(error);
  }
}

/**
 * Reactivate a canceled subscription
 */
export async function reactivateSubscription(
  subscriptionId: string
): Promise<void> {
  try {
    const stripe = getStripe();

    const subscription = await db.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    if (!subscription.stripe_subscription_id) {
      throw new Error('Stripe subscription ID not found');
    }

    await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      cancel_at_period_end: false,
    });

    await db.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
      canceled_at: null,
      updated_at: Date.now(),
    });

    stripeLogger.info('Reactivated subscription', { subscriptionId });
  } catch (error) {
    stripeLogger.error('Error reactivating subscription', error);
    throw handleStripeError(error);
  }
}

/**
 * Add payment method for a user
 */
export async function addPaymentMethod(
  params: CreatePaymentMethodParams
): Promise<PaymentMethod> {
  try {
    const stripe = getStripe();

    const stripePaymentMethod = await stripe.paymentMethods.retrieve(
      params.stripePaymentMethodId
    );

    const now = Date.now();

    const paymentMethod: PaymentMethod = {
      id: crypto.randomUUID(),
      user_id: params.userId,
      stripe_payment_method_id: params.stripePaymentMethodId,
      type: stripePaymentMethod.type as any,
      card_brand: stripePaymentMethod.card?.brand || null,
      card_last4: stripePaymentMethod.card?.last4 || null,
      card_exp_month: stripePaymentMethod.card?.exp_month || null,
      card_exp_year: stripePaymentMethod.card?.exp_year || null,
      bank_name: null,
      bank_last4: null,
      is_default: params.setAsDefault || false,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };

    await db.paymentMethods.add(paymentMethod);

    // If set as default, unset other default payment methods
    if (params.setAsDefault) {
      await db.paymentMethods
        .where('user_id')
        .equals(params.userId)
        .and((pm) => pm.id !== paymentMethod.id && pm.is_default)
        .modify({ is_default: false });
    }

    stripeLogger.info('Added payment method', {
      paymentMethodId: paymentMethod.id,
      userId: params.userId,
    });

    return paymentMethod;
  } catch (error) {
    stripeLogger.error('Error adding payment method', error);
    throw handleStripeError(error);
  }
}

/**
 * Get invoices for a user
 */
export async function getInvoices(userId: string): Promise<BillingInvoice[]> {
  return db.billingInvoices
    .where('user_id')
    .equals(userId)
    .reverse()
    .sortBy('created_at');
}

/**
 * Handle Stripe webhook events
 */
export async function handleWebhook(
  payload: string,
  signature: string
): Promise<void> {
  try {
    const stripe = getStripe();

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        payload,
        signature,
        stripeWebhookSecret
      );
    } catch (err) {
      stripeLogger.error('Webhook signature verification failed', err);
      throw new Error('Webhook signature invalid');
    }

    // Store webhook event
    const webhookEvent: StripeWebhookEvent = {
      id: event.id,
      type: event.type,
      data: event.data,
      created_at: event.created * 1000,
      processed_at: null,
      error: null,
    };

    await db.stripeWebhookEvents.add(webhookEvent);

    // Handle different event types
    switch (event.type) {
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        stripeLogger.debug('Unhandled webhook event type', {
          type: event.type,
        });
    }

    // Mark webhook as processed
    await db.stripeWebhookEvents.update(event.id, {
      processed_at: Date.now(),
    });

    stripeLogger.info('Processed webhook event', {
      eventId: event.id,
      type: event.type,
    });
  } catch (error) {
    stripeLogger.error('Error handling webhook', error);
    throw error;
  }
}

/**
 * Handle subscription updated event
 */
async function handleSubscriptionUpdated(
  stripeSubscription: Stripe.Subscription
): Promise<void> {
  const subscription = await db.subscriptions
    .where('stripe_subscription_id')
    .equals(stripeSubscription.id)
    .first();

  if (!subscription) {
    stripeLogger.warn('Subscription not found for webhook', {
      stripeSubscriptionId: stripeSubscription.id,
    });
    return;
  }

  await db.subscriptions.update(subscription.id, {
    status: stripeSubscription.status as SubscriptionStatus,
    current_period_start: stripeSubscription.current_period_start * 1000,
    current_period_end: stripeSubscription.current_period_end * 1000,
    cancel_at_period_end: stripeSubscription.cancel_at_period_end,
    canceled_at: stripeSubscription.canceled_at
      ? stripeSubscription.canceled_at * 1000
      : null,
    updated_at: Date.now(),
  });
}

/**
 * Handle subscription deleted event
 */
async function handleSubscriptionDeleted(
  stripeSubscription: Stripe.Subscription
): Promise<void> {
  const subscription = await db.subscriptions
    .where('stripe_subscription_id')
    .equals(stripeSubscription.id)
    .first();

  if (!subscription) {
    stripeLogger.warn('Subscription not found for webhook', {
      stripeSubscriptionId: stripeSubscription.id,
    });
    return;
  }

  await db.subscriptions.update(subscription.id, {
    status: 'canceled',
    canceled_at: Date.now(),
    updated_at: Date.now(),
  });
}

/**
 * Handle invoice payment succeeded event
 */
async function handleInvoicePaymentSucceeded(
  invoice: Stripe.Invoice
): Promise<void> {
  const now = Date.now();

  // Store or update invoice
  const existingInvoice = await db.billingInvoices
    .where('stripe_invoice_id')
    .equals(invoice.id)
    .first();

  if (existingInvoice) {
    await db.billingInvoices.update(existingInvoice.id, {
      status: 'paid',
      amount_paid: invoice.amount_paid,
      paid_at: now,
      updated_at: now,
    });
  } else {
    const subscription = await db.subscriptions
      .where('stripe_subscription_id')
      .equals(invoice.subscription as string)
      .first();

    if (!subscription) {
      stripeLogger.warn('Subscription not found for invoice', {
        invoiceId: invoice.id,
      });
      return;
    }

    const billingInvoice: BillingInvoice = {
      id: crypto.randomUUID(),
      user_id: subscription.user_id,
      stripe_invoice_id: invoice.id,
      stripe_customer_id: invoice.customer as string,
      subscription_id: subscription.id,
      status: 'paid',
      amount_due: invoice.amount_due,
      amount_paid: invoice.amount_paid,
      currency: invoice.currency,
      created_at: invoice.created * 1000,
      due_date: invoice.due_date ? invoice.due_date * 1000 : null,
      paid_at: now,
      voided_at: null,
      invoice_pdf_url: invoice.invoice_pdf || null,
      hosted_invoice_url: invoice.hosted_invoice_url || null,
      description: invoice.description || null,
      updated_at: now,
      deleted_at: null,
    };

    await db.billingInvoices.add(billingInvoice);
  }
}

/**
 * Handle invoice payment failed event
 */
async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice
): Promise<void> {
  const subscription = await db.subscriptions
    .where('stripe_subscription_id')
    .equals(invoice.subscription as string)
    .first();

  if (!subscription) {
    stripeLogger.warn('Subscription not found for failed invoice', {
      invoiceId: invoice.id,
    });
    return;
  }

  // Update subscription status to past_due
  await db.subscriptions.update(subscription.id, {
    status: 'past_due',
    updated_at: Date.now(),
  });

  stripeLogger.warn('Invoice payment failed', {
    invoiceId: invoice.id,
    subscriptionId: subscription.id,
  });

  // TODO: Send notification to user about failed payment
}

/**
 * Get Stripe customer ID for a user
 */
async function getStripeCustomerId(userId: string): Promise<string | null> {
  const subscription = await db.subscriptions
    .where('user_id')
    .equals(userId)
    .first();

  return subscription?.stripe_customer_id || null;
}

/**
 * Get price ID for subscription type
 * These should be configured in Stripe dashboard and environment variables
 */
function getPriceIdForSubscriptionType(type: SubscriptionType): string {
  const priceIds = {
    individual: import.meta.env.VITE_STRIPE_PRICE_INDIVIDUAL || '',
    advisor: import.meta.env.VITE_STRIPE_PRICE_ADVISOR_TIER_1 || '',
    archived: '',
  };

  return priceIds[type] || priceIds.individual;
}

/**
 * Get price ID for specific amount
 * This is a placeholder - in production, you'd create prices in Stripe for each tier
 */
function getPriceIdForAmount(_amount: number): string {
  // TODO: Map amount to price ID based on tier
  // For now, return tier 1 price ID
  return import.meta.env.VITE_STRIPE_PRICE_ADVISOR_TIER_1 || '';
}

/**
 * Handle Stripe errors and convert to BillingError
 */
function handleStripeError(error: any): BillingError {
  if (error.type === 'StripeCardError') {
    return {
      type: 'card_declined',
      message: error.message,
      code: error.code,
      details: error,
    };
  } else if (error.type === 'StripeInvalidRequestError') {
    return {
      type: 'payment_method_invalid',
      message: error.message,
      code: error.code,
      details: error,
    };
  } else {
    return {
      type: 'stripe_api_error',
      message: error.message || 'An error occurred with Stripe',
      details: error,
    };
  }
}

// Initialize Stripe on module load
initializeStripe();
