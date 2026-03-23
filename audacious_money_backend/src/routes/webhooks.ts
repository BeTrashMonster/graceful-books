/**
 * Stripe Webhook Handler
 *
 * Receives and processes Stripe webhook events for payment and subscription updates
 */

import { Hono } from 'hono';
import { getDatabase } from '../db/connection.js';

const webhooks = new Hono();

/**
 * Stripe webhook endpoint
 *
 * SECURITY: This endpoint must be accessible without authentication
 * Stripe signature verification happens inside the handler
 */
webhooks.post('/stripe', async (c) => {
  try {
    const body = await c.req.text();
    const signature = c.req.header('stripe-signature');

    // Get webhook secret from environment
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('[Webhook] STRIPE_WEBHOOK_SECRET not configured');
      return c.json({ error: 'Webhook not configured' }, 500);
    }

    if (!signature) {
      console.error('[Webhook] Missing Stripe signature header');
      return c.json({ error: 'Missing signature' }, 400);
    }

    // TODO: Verify Stripe signature
    // For now, we'll just parse and log the event
    // In production, MUST verify signature using stripe.webhooks.constructEvent()

    const event = JSON.parse(body);

    console.log(`[Webhook] Received event: ${event.type}`);
    console.log(`[Webhook] Event ID: ${event.id}`);

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object);
        break;

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;

      case 'customer.subscription.paused':
        await handleSubscriptionPaused(event.data.object);
        break;

      case 'customer.subscription.resumed':
        await handleSubscriptionResumed(event.data.object);
        break;

      case 'customer.subscription.trial_will_end':
        await handleSubscriptionTrialWillEnd(event.data.object);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }

    // Always return 200 to acknowledge receipt
    return c.json({ received: true });

  } catch (error) {
    console.error('[Webhook] Error processing webhook:', error);
    return c.json({ error: 'Webhook processing failed' }, 500);
  }
});

// ==========================================
// Event Handlers
// ==========================================

async function handleCheckoutSessionCompleted(session: any) {
  console.log('[Webhook] Processing checkout.session.completed');
  console.log('[Webhook] Customer:', session.customer);
  console.log('[Webhook] Subscription:', session.subscription);

  // TODO: Create user_product record
  // TODO: Update user subscription status
  // TODO: Send welcome email
}

async function handleSubscriptionCreated(subscription: any) {
  console.log('[Webhook] Processing customer.subscription.created');
  console.log('[Webhook] Subscription ID:', subscription.id);
  console.log('[Webhook] Customer:', subscription.customer);

  // TODO: Create user_product record if not from checkout
  // TODO: Update user subscription status
}

async function handleSubscriptionUpdated(subscription: any) {
  console.log('[Webhook] Processing customer.subscription.updated');
  console.log('[Webhook] Subscription ID:', subscription.id);
  console.log('[Webhook] Status:', subscription.status);

  // TODO: Update user_product record
  // TODO: Handle plan changes, upgrades, downgrades
}

async function handleSubscriptionDeleted(subscription: any) {
  console.log('[Webhook] Processing customer.subscription.deleted');
  console.log('[Webhook] Subscription ID:', subscription.id);

  // TODO: Update user_product status to cancelled
  // TODO: Update subscription end date
  // TODO: Send cancellation confirmation email
}

async function handleSubscriptionPaused(subscription: any) {
  console.log('[Webhook] Processing customer.subscription.paused');
  console.log('[Webhook] Subscription ID:', subscription.id);

  // TODO: Update user_product status to paused
  // TODO: Send pause confirmation email
}

async function handleSubscriptionResumed(subscription: any) {
  console.log('[Webhook] Processing customer.subscription.resumed');
  console.log('[Webhook] Subscription ID:', subscription.id);

  // TODO: Update user_product status to active
  // TODO: Send resume confirmation email
}

async function handleSubscriptionTrialWillEnd(subscription: any) {
  console.log('[Webhook] Processing customer.subscription.trial_will_end');
  console.log('[Webhook] Subscription ID:', subscription.id);
  console.log('[Webhook] Trial ends:', subscription.trial_end);

  // TODO: Send trial ending reminder email
  // TODO: Notify user to add payment method if needed
}

async function handleInvoicePaymentSucceeded(invoice: any) {
  console.log('[Webhook] Processing invoice.payment_succeeded');
  console.log('[Webhook] Invoice ID:', invoice.id);
  console.log('[Webhook] Amount paid:', invoice.amount_paid / 100, invoice.currency.toUpperCase());

  // TODO: Create payment record
  // TODO: Send payment receipt email
  // TODO: Update subscription status if needed
}

async function handleInvoicePaymentFailed(invoice: any) {
  console.log('[Webhook] Processing invoice.payment_failed');
  console.log('[Webhook] Invoice ID:', invoice.id);
  console.log('[Webhook] Amount due:', invoice.amount_due / 100, invoice.currency.toUpperCase());

  // TODO: Update subscription status to past_due
  // TODO: Send payment failure notification
  // TODO: Retry payment or pause subscription
}

export default webhooks;
