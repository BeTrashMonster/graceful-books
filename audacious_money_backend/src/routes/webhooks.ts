/**
 * Stripe Webhook Handler
 *
 * Receives and processes Stripe webhook events for payment and subscription updates
 */

import { Hono } from 'hono';
import { getDatabase } from '../db/connection.js';

const webhooks = new Hono();

/**
 * DEBUG: Check if webhook secret is loaded
 * TODO: Remove this in production
 */
webhooks.get('/stripe/debug', async (c) => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  return c.json({
    secretConfigured: !!webhookSecret,
    secretPrefix: webhookSecret ? webhookSecret.substring(0, 10) + '...' : null,
    secretSuffix: webhookSecret ? '...' + webhookSecret.substring(webhookSecret.length - 5) : null,
    secretLength: webhookSecret ? webhookSecret.length : 0,
    startsWithQuote: webhookSecret ? webhookSecret[0] === '"' || webhookSecret[0] === "'" : false,
    endsWithQuote: webhookSecret ? webhookSecret[webhookSecret.length - 1] === '"' || webhookSecret[webhookSecret.length - 1] === "'" : false,
    hasWhitespace: webhookSecret ? webhookSecret !== webhookSecret.trim() : false,
  });
});

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

    // Debug logging
    console.log('[Webhook] Secret prefix:', webhookSecret.substring(0, 10) + '...');
    console.log('[Webhook] Secret length:', webhookSecret.length);
    console.log('[Webhook] Body length:', body.length);
    console.log('[Webhook] Signature present:', !!signature);

    // Verify Stripe signature
    const { verifyWebhookSignature } = await import('../services/stripe.service.js');

    let event;
    try {
      event = verifyWebhookSignature(body, signature, webhookSecret);
    } catch (err: any) {
      console.error('[Webhook] Signature verification failed:', err.message);
      console.error('[Webhook] Error details:', err);
      return c.json({ error: 'Invalid signature' }, 400);
    }

    console.log(`[Webhook] Received event: ${event.type}`);
    console.log(`[Webhook] Event ID: ${event.id}`);

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object);
        break;

      case 'checkout.session.async_payment_succeeded':
        await handleCheckoutSessionAsyncPaymentSucceeded(event.data.object);
        break;

      case 'checkout.session.async_payment_failed':
        await handleCheckoutSessionAsyncPaymentFailed(event.data.object);
        break;

      case 'checkout.session.expired':
        await handleCheckoutSessionExpired(event.data.object);
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

      case 'customer.subscription.pending_update_applied':
        await handleSubscriptionPendingUpdateApplied(event.data.object);
        break;

      case 'customer.subscription.pending_update_expired':
        await handleSubscriptionPendingUpdateExpired(event.data.object);
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

  const db = getDatabase();

  try {
    const userId = session.metadata?.userId || session.client_reference_id;
    const productId = session.metadata?.productId;

    if (!userId || !productId) {
      console.error('[Webhook] Missing userId or productId in session metadata');
      console.error('[Webhook] Session metadata:', session.metadata);
      return;
    }

    console.log('[Webhook] User ID:', userId);
    console.log('[Webhook] Product ID:', productId);

    // Fetch subscription details from Stripe to get the actual status
    let subscriptionStatus = 'active';
    let currentPeriodStart = null;
    let currentPeriodEnd = null;

    if (session.subscription) {
      try {
        const { stripe } = await import('../services/stripe.service.js');
        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        subscriptionStatus = subscription.status; // Will be 'trialing', 'active', etc.
        currentPeriodStart = subscription.current_period_start;
        currentPeriodEnd = subscription.current_period_end;
        console.log('[Webhook] Fetched subscription status:', subscriptionStatus);
      } catch (error) {
        console.error('[Webhook] Failed to fetch subscription details:', error);
        // Fall back to 'active' if we can't fetch
      }
    }

    // Check if user_product record already exists
    const existingRecord = await db.query(
      `SELECT id FROM user_products WHERE user_id = $1 AND product_id = $2`,
      [userId, productId]
    );

    if (existingRecord.rows.length > 0) {
      console.log('[Webhook] user_product record already exists, updating status');
      await db.query(
        `UPDATE user_products
         SET stripe_subscription_id = $1,
             stripe_customer_id = $2,
             status = $3,
             current_period_start = to_timestamp($4),
             current_period_end = to_timestamp($5),
             updated_at = NOW()
         WHERE user_id = $6 AND product_id = $7`,
        [
          session.subscription,
          session.customer,
          subscriptionStatus,
          currentPeriodStart,
          currentPeriodEnd,
          userId,
          productId,
        ]
      );
    } else {
      console.log('[Webhook] Creating new user_product record');
      await db.query(
        `INSERT INTO user_products (
          user_id,
          product_id,
          stripe_subscription_id,
          stripe_customer_id,
          status,
          current_period_start,
          current_period_end
        ) VALUES ($1, $2, $3, $4, $5, to_timestamp($6), to_timestamp($7))`,
        [userId, productId, session.subscription, session.customer, subscriptionStatus, currentPeriodStart, currentPeriodEnd]
      );
    }

    // Get user details for welcome email (optional - don't fail webhook if email fails)
    try {
      const userResult = await db.query(
        `SELECT email, first_name FROM users WHERE id = $1`,
        [userId]
      );

      if (userResult.rows.length > 0) {
        const user = userResult.rows[0];
        const workshopId = session.metadata?.workshopId;

        // Check if this is a workshop enrollment (detect workshop context)
        if (workshopId) {
          // Workshop-specific emails - schedule all 7 emails
          const workshopResult = await db.query(
            `SELECT cohort_name, workshop_start_datetime, workshop_end_datetime, workshop_type, location
             FROM workshops WHERE id = $1`,
            [workshopId]
          );

          if (workshopResult.rows.length > 0) {
            const workshop = workshopResult.rows[0];
            const {
              sendWorkshopWelcomeEmail,
              sendWorkshopReminderEmail,
              sendWorkshopChallengeWeek1Email,
              sendWorkshopChallengeWeek2Email,
              sendWorkshopChallengeWeek3Email,
              sendWorkshopChallengeWeek4Email,
              sendWorkshopWrapUpEmail,
            } = await import('../services/email.service.js');

            const workshopStart = new Date(workshop.workshop_start_datetime);
            const workshopEnd = new Date(workshop.workshop_end_datetime);
            const location = workshop.workshop_type === 'in_person' ? workshop.location : 'Online';

            // Email #1 - Send immediately (welcome)
            await sendWorkshopWelcomeEmail(
              user.email,
              user.first_name,
              workshop.cohort_name,
              workshop.workshop_start_datetime,
              location
            );
            console.log('[Webhook] Email #1 (Welcome) sent immediately to:', user.email);

            // Email #2 - Schedule for 24h before workshop
            const email2Time = new Date(workshopStart);
            email2Time.setHours(email2Time.getHours() - 24);
            await sendWorkshopReminderEmail(
              user.email,
              user.first_name,
              workshop.workshop_start_datetime,
              location,
              email2Time.toISOString()
            );
            console.log('[Webhook] Email #2 (24h reminder) scheduled for:', email2Time.toISOString());

            // Email #3 - Schedule for 1 week after workshop
            const email3Time = new Date(workshopEnd);
            email3Time.setDate(email3Time.getDate() + 7);
            await sendWorkshopChallengeWeek1Email(
              user.email,
              user.first_name,
              workshop.cohort_name,
              email3Time.toISOString()
            );
            console.log('[Webhook] Email #3 (Week 1 Challenge) scheduled for:', email3Time.toISOString());

            // Email #4 - Schedule for 2 weeks after workshop
            const email4Time = new Date(workshopEnd);
            email4Time.setDate(email4Time.getDate() + 14);
            await sendWorkshopChallengeWeek2Email(
              user.email,
              user.first_name,
              workshop.cohort_name,
              email4Time.toISOString()
            );
            console.log('[Webhook] Email #4 (Week 2 Challenge) scheduled for:', email4Time.toISOString());

            // Email #5 - Schedule for 3 weeks after workshop
            const email5Time = new Date(workshopEnd);
            email5Time.setDate(email5Time.getDate() + 21);
            await sendWorkshopChallengeWeek3Email(
              user.email,
              user.first_name,
              workshop.cohort_name,
              email5Time.toISOString()
            );
            console.log('[Webhook] Email #5 (Week 3 Challenge) scheduled for:', email5Time.toISOString());

            // Email #6 - Schedule for 4 weeks after workshop
            const email6Time = new Date(workshopEnd);
            email6Time.setDate(email6Time.getDate() + 28);
            await sendWorkshopChallengeWeek4Email(
              user.email,
              user.first_name,
              workshop.cohort_name,
              email6Time.toISOString()
            );
            console.log('[Webhook] Email #6 (Week 4 Challenge) scheduled for:', email6Time.toISOString());

            // Email #7 - Schedule for 30 days after workshop (wrap-up)
            const email7Time = new Date(workshopEnd);
            email7Time.setDate(email7Time.getDate() + 30);
            await sendWorkshopWrapUpEmail(
              user.email,
              user.first_name,
              workshop.cohort_name,
              email7Time.toISOString()
            );
            console.log('[Webhook] Email #7 (30-day Wrap-up) scheduled for:', email7Time.toISOString());

            console.log('[Webhook] All 7 workshop emails scheduled for:', user.email, 'workshop:', workshop.cohort_name);
          }
        } else {
          // Regular product welcome email
          const { sendProductWelcomeEmail } = await import('../services/email.service.js');

          // Get product details
          const productResult = await db.query(
            `SELECT name FROM products WHERE id = $1`,
            [productId]
          );

          if (productResult.rows.length > 0) {
            await sendProductWelcomeEmail(
              user.email,
              user.first_name,
              productResult.rows[0].name
            );
            console.log('[Webhook] Welcome email sent to:', user.email);
          }
        }
      }
    } catch (emailError) {
      console.warn('[Webhook] Failed to send welcome email (non-critical):', emailError instanceof Error ? emailError.message : emailError);
    }

    console.log('[Webhook] ✅ Product assigned successfully');
  } catch (error) {
    console.error('[Webhook] Error processing checkout session:', error);
    throw error;
  }
}

async function handleSubscriptionCreated(subscription: any) {
  console.log('[Webhook] Processing customer.subscription.created');
  console.log('[Webhook] Subscription ID:', subscription.id);
  console.log('[Webhook] Customer:', subscription.customer);
  console.log('[Webhook] Status:', subscription.status);

  const db = getDatabase();

  try {
    const userId = subscription.metadata?.userId;

    if (!userId) {
      console.log('[Webhook] No userId in subscription metadata, likely handled by checkout.session.completed');
      return;
    }

    console.log('[Webhook] User ID from subscription metadata:', userId);

    // Update subscription details if record exists, including status
    await db.query(
      `UPDATE user_products
       SET status = $1,
           current_period_start = to_timestamp($2),
           current_period_end = to_timestamp($3),
           updated_at = NOW()
       WHERE stripe_subscription_id = $4`,
      [subscription.status, subscription.current_period_start, subscription.current_period_end, subscription.id]
    );

    console.log('[Webhook] Subscription created successfully with status:', subscription.status);
  } catch (error) {
    console.error('[Webhook] Error processing subscription created:', error);
  }
}

async function handleSubscriptionUpdated(subscription: any) {
  console.log('[Webhook] Processing customer.subscription.updated');
  console.log('[Webhook] Subscription ID:', subscription.id);
  console.log('[Webhook] Status:', subscription.status);
  console.log('[Webhook] Pause collection:', subscription.pause_collection);

  const db = getDatabase();

  try {
    // Map Stripe status to our status
    let status = subscription.status;

    // Check if subscription is paused (Stripe keeps status as 'active' but sets pause_collection)
    if (subscription.pause_collection && subscription.pause_collection.behavior) {
      status = 'paused';
      console.log('[Webhook] Subscription is paused (pause_collection detected)');
    } else if (status === 'trialing') {
      status = 'trialing';
    } else if (status === 'active') {
      status = 'active';
    } else if (status === 'past_due') {
      status = 'past_due';
    } else if (status === 'canceled' || status === 'unpaid') {
      status = 'cancelled';
    }

    await db.query(
      `UPDATE user_products
       SET status = $1,
           current_period_start = to_timestamp($2),
           current_period_end = to_timestamp($3),
           cancel_at_period_end = $4,
           updated_at = NOW()
       WHERE stripe_subscription_id = $5`,
      [
        status,
        subscription.current_period_start,
        subscription.current_period_end,
        subscription.cancel_at_period_end || false,
        subscription.id,
      ]
    );

    // Workshop graduation: If trial converted to active, remove current_workshop_enrollment_id
    if (status === 'active') {
      // Get user from this subscription
      const userResult = await db.query(
        `SELECT user_id FROM user_products WHERE stripe_subscription_id = $1`,
        [subscription.id]
      );

      if (userResult.rows.length > 0) {
        const userId = userResult.rows[0].user_id;

        // Check if user has a workshop enrollment
        const checkWorkshop = await db.query(
          `SELECT current_workshop_enrollment_id FROM users WHERE id = $1`,
          [userId]
        );

        if (checkWorkshop.rows.length > 0 && checkWorkshop.rows[0].current_workshop_enrollment_id) {
          // User graduated from workshop to paying customer - remove workshop link
          await db.query(
            `UPDATE users SET current_workshop_enrollment_id = NULL WHERE id = $1`,
            [userId]
          );
          console.log('[Webhook] User graduated from workshop to paying customer:', userId);
        }
      }
    }

    console.log('[Webhook] Subscription updated successfully');
  } catch (error) {
    console.error('[Webhook] Error processing subscription updated:', error);
  }
}

async function handleSubscriptionDeleted(subscription: any) {
  console.log('[Webhook] Processing customer.subscription.deleted');
  console.log('[Webhook] Subscription ID:', subscription.id);

  const db = getDatabase();

  try {
    await db.query(
      `UPDATE user_products
       SET status = 'cancelled',
           cancelled_at = to_timestamp($1),
           updated_at = NOW()
       WHERE stripe_subscription_id = $2`,
      [subscription.canceled_at || Math.floor(Date.now() / 1000), subscription.id]
    );

    // Get user details for cancellation email (optional - don't fail if email fails)
    try {
      const result = await db.query(
        `SELECT u.email, u.first_name, p.name as product_name
         FROM user_products up
         JOIN users u ON u.id = up.user_id
         JOIN products p ON p.id = up.product_id
         WHERE up.stripe_subscription_id = $1`,
        [subscription.id]
      );

      if (result.rows.length > 0) {
        const { email, first_name, product_name } = result.rows[0];
        const { sendSubscriptionCancelledEmail } = await import('../services/email.service.js');
        await sendSubscriptionCancelledEmail(email, first_name, product_name);
        console.log('[Webhook] Cancellation email sent');
      }
    } catch (emailError) {
      console.warn('[Webhook] Failed to send cancellation email (non-critical):', emailError instanceof Error ? emailError.message : emailError);
    }

    console.log('[Webhook] Subscription deleted successfully');
  } catch (error) {
    console.error('[Webhook] Error processing subscription deleted:', error);
  }
}

async function handleSubscriptionPaused(subscription: any) {
  console.log('[Webhook] Processing customer.subscription.paused');
  console.log('[Webhook] Subscription ID:', subscription.id);

  const db = getDatabase();

  try {
    await db.query(
      `UPDATE user_products
       SET status = 'paused',
           updated_at = NOW()
       WHERE stripe_subscription_id = $1`,
      [subscription.id]
    );

    console.log('[Webhook] Subscription paused successfully');
  } catch (error) {
    console.error('[Webhook] Error processing subscription paused:', error);
  }
}

async function handleSubscriptionResumed(subscription: any) {
  console.log('[Webhook] Processing customer.subscription.resumed');
  console.log('[Webhook] Subscription ID:', subscription.id);

  const db = getDatabase();

  try {
    await db.query(
      `UPDATE user_products
       SET status = 'active',
           updated_at = NOW()
       WHERE stripe_subscription_id = $1`,
      [subscription.id]
    );

    console.log('[Webhook] Subscription resumed successfully');
  } catch (error) {
    console.error('[Webhook] Error processing subscription resumed:', error);
  }
}

async function handleSubscriptionPendingUpdateApplied(subscription: any) {
  console.log('[Webhook] Processing customer.subscription.pending_update_applied');
  console.log('[Webhook] Subscription ID:', subscription.id);

  const db = getDatabase();

  try {
    // A pending update has been applied - update subscription details
    // This happens when a scheduled plan change goes into effect
    let status = subscription.status;
    if (status === 'trialing') status = 'trialing';
    else if (status === 'active') status = 'active';
    else if (status === 'past_due') status = 'past_due';
    else if (status === 'canceled' || status === 'unpaid') status = 'cancelled';
    else if (status === 'paused') status = 'paused';

    await db.query(
      `UPDATE user_products
       SET status = $1,
           current_period_start = to_timestamp($2),
           current_period_end = to_timestamp($3),
           updated_at = NOW()
       WHERE stripe_subscription_id = $4`,
      [
        status,
        subscription.current_period_start,
        subscription.current_period_end,
        subscription.id,
      ]
    );

    console.log('[Webhook] Pending update applied successfully');
  } catch (error) {
    console.error('[Webhook] Error processing pending update applied:', error);
  }
}

async function handleSubscriptionPendingUpdateExpired(subscription: any) {
  console.log('[Webhook] Processing customer.subscription.pending_update_expired');
  console.log('[Webhook] Subscription ID:', subscription.id);

  const db = getDatabase();

  try {
    // A pending update has expired without being applied
    // This could happen if customer cancelled the scheduled change
    // Generally no action needed, but log it for tracking
    console.log('[Webhook] Pending update expired - no action taken');

    // Optional: Could send notification to user that scheduled change was cancelled
    const result = await db.query(
      `SELECT u.email, u.first_name, p.name as product_name
       FROM user_products up
       JOIN users u ON u.id = up.user_id
       JOIN products p ON p.id = up.product_id
       WHERE up.stripe_subscription_id = $1`,
      [subscription.id]
    );

    if (result.rows.length > 0) {
      const { email, first_name } = result.rows[0];
      console.log(`[Webhook] Scheduled change expired for ${email}`);
    }
  } catch (error) {
    console.error('[Webhook] Error processing pending update expired:', error);
  }
}

async function handleSubscriptionTrialWillEnd(subscription: any) {
  console.log('[Webhook] Processing customer.subscription.trial_will_end');
  console.log('[Webhook] Subscription ID:', subscription.id);
  console.log('[Webhook] Trial ends:', subscription.trial_end);

  const db = getDatabase();

  try {
    // Get user details for trial reminder email
    const result = await db.query(
      `SELECT u.id as user_id, u.email, u.first_name, p.name as product_name
       FROM user_products up
       JOIN users u ON u.id = up.user_id
       JOIN products p ON p.id = up.product_id
       WHERE up.stripe_subscription_id = $1`,
      [subscription.id]
    );

    if (result.rows.length > 0) {
      const { user_id, email, first_name, product_name } = result.rows[0];

      // Check if this is a workshop enrollment (detect workshop context)
      const workshopResult = await db.query(
        `SELECT w.id, w.cohort_name, w.workshop_start_datetime, w.workshop_type, w.location
         FROM workshop_enrollments we
         JOIN workshops w ON w.id = we.workshop_id
         WHERE we.user_id = $1`,
        [user_id]
      );

      if (workshopResult.rows.length > 0) {
        // Workshop-specific trial ending email
        const workshop = workshopResult.rows[0];
        const { sendWorkshopTrialEndingEmail } = await import('../services/email.service.js');

        await sendWorkshopTrialEndingEmail(
          email,
          first_name,
          workshop.cohort_name,
          workshop.workshop_start_datetime,
          workshop.workshop_type === 'in_person' ? workshop.location : 'Online'
        );
        console.log(`[Webhook] Workshop trial ending email sent to ${email} for workshop: ${workshop.cohort_name}`);
      } else {
        // Regular product trial ending email
        const { sendTrialEndingSoonEmail } = await import('../services/email.service.js');
        await sendTrialEndingSoonEmail(email, first_name, product_name);
        console.log(`[Webhook] Trial ending soon for ${email} - ${product_name}`);
      }
    }

    console.log('[Webhook] Trial will end notification processed');
  } catch (error) {
    console.error('[Webhook] Error processing trial will end:', error);
  }
}

async function handleInvoicePaymentSucceeded(invoice: any) {
  console.log('[Webhook] Processing invoice.payment_succeeded');
  console.log('[Webhook] Invoice ID:', invoice.id);
  console.log('[Webhook] Amount paid:', invoice.amount_paid / 100, invoice.currency.toUpperCase());

  const db = getDatabase();

  try {
    // Find the user_product record for this subscription
    if (invoice.subscription) {
      const result = await db.query(
        `SELECT up.user_id, up.product_id, u.email, u.first_name, p.name as product_name
         FROM user_products up
         JOIN users u ON u.id = up.user_id
         JOIN products p ON p.id = up.product_id
         WHERE up.stripe_subscription_id = $1`,
        [invoice.subscription]
      );

      if (result.rows.length > 0) {
        const { user_id, product_id, email, first_name, product_name } = result.rows[0];

        // Create payment record (if payments table exists)
        // For now, just log it
        console.log(`[Webhook] Payment successful for user ${user_id}, product ${product_id}`);

        // Send receipt email (optional - don't fail if email fails)
        try {
          const { sendPaymentReceiptEmail } = await import('../services/email.service.js');
          await sendPaymentReceiptEmail(
            email,
            first_name,
            product_name,
            invoice.amount_paid / 100,
            invoice.currency.toUpperCase()
          );
          console.log('[Webhook] Payment receipt sent');
        } catch (emailError) {
          console.warn('[Webhook] Failed to send payment receipt (non-critical):', emailError instanceof Error ? emailError.message : emailError);
        }
      }
    }

    console.log('[Webhook] Invoice payment succeeded processed');
  } catch (error) {
    console.error('[Webhook] Error processing invoice payment succeeded:', error);
  }
}

async function handleInvoicePaymentFailed(invoice: any) {
  console.log('[Webhook] Processing invoice.payment_failed');
  console.log('[Webhook] Invoice ID:', invoice.id);
  console.log('[Webhook] Amount due:', invoice.amount_due / 100, invoice.currency.toUpperCase());

  const db = getDatabase();

  try {
    // Update subscription status to past_due
    if (invoice.subscription) {
      await db.query(
        `UPDATE user_products
         SET status = 'past_due',
             updated_at = NOW()
         WHERE stripe_subscription_id = $1`,
        [invoice.subscription]
      );

      // Get user details for payment failure notification (optional - don't fail if email fails)
      try {
        const result = await db.query(
          `SELECT u.email, u.first_name, p.name as product_name
           FROM user_products up
           JOIN users u ON u.id = up.user_id
           JOIN products p ON p.id = up.product_id
           WHERE up.stripe_subscription_id = $1`,
          [invoice.subscription]
        );

        if (result.rows.length > 0) {
          const { email, first_name, product_name } = result.rows[0];
          const { sendPaymentFailedEmail } = await import('../services/email.service.js');
          await sendPaymentFailedEmail(
            email,
            first_name,
            product_name,
            invoice.amount_due / 100,
            invoice.currency.toUpperCase()
          );
          console.log('[Webhook] Payment failure notification sent');
        }
      } catch (emailError) {
        console.warn('[Webhook] Failed to send payment failure email (non-critical):', emailError instanceof Error ? emailError.message : emailError);
      }
    }

    console.log('[Webhook] Invoice payment failed processed');
  } catch (error) {
    console.error('[Webhook] Error processing invoice payment failed:', error);
  }
}

async function handleCheckoutSessionAsyncPaymentSucceeded(session: any) {
  console.log('[Webhook] Processing checkout.session.async_payment_succeeded');
  console.log('[Webhook] Session ID:', session.id);
  console.log('[Webhook] Customer:', session.customer);
  console.log('[Webhook] Subscription:', session.subscription);

  // Async payment methods (ACH, bank transfers, etc.) complete after checkout
  // Treat this the same as checkout.session.completed
  await handleCheckoutSessionCompleted(session);
}

async function handleCheckoutSessionAsyncPaymentFailed(session: any) {
  console.log('[Webhook] Processing checkout.session.async_payment_failed');
  console.log('[Webhook] Session ID:', session.id);

  const db = getDatabase();

  try {
    const userId = session.metadata?.userId || session.client_reference_id;
    const productId = session.metadata?.productId;

    if (!userId || !productId) {
      console.error('[Webhook] Missing userId or productId in session metadata');
      return;
    }

    // Check if user_product record was created (might have been created optimistically)
    const existingRecord = await db.query(
      `SELECT id FROM user_products WHERE user_id = $1 AND product_id = $2`,
      [userId, productId]
    );

    if (existingRecord.rows.length > 0) {
      // Mark subscription as failed
      await db.query(
        `UPDATE user_products
         SET status = 'payment_failed',
             updated_at = NOW()
         WHERE user_id = $1 AND product_id = $2`,
        [userId, productId]
      );
      console.log('[Webhook] Marked subscription as payment_failed');
    }

    // Send payment failure notification (optional)
    try {
      const userResult = await db.query(
        `SELECT email, first_name FROM users WHERE id = $1`,
        [userId]
      );

      if (userResult.rows.length > 0) {
        const user = userResult.rows[0];
        const productResult = await db.query(
          `SELECT name FROM products WHERE id = $1`,
          [productId]
        );

        if (productResult.rows.length > 0) {
          console.log(`[Webhook] Async payment failed for ${user.email}`);
          // TODO: Send async payment failed email
        }
      }
    } catch (emailError) {
      console.warn('[Webhook] Failed to send async payment failure email (non-critical):', emailError instanceof Error ? emailError.message : emailError);
    }

    console.log('[Webhook] Async payment failure processed');
  } catch (error) {
    console.error('[Webhook] Error processing async payment failure:', error);
  }
}

async function handleCheckoutSessionExpired(session: any) {
  console.log('[Webhook] Processing checkout.session.expired');
  console.log('[Webhook] Session ID:', session.id);

  // Checkout session expired (customer didn't complete payment in time)
  // Usually happens after 24 hours
  // No action needed - just log it for analytics
  const userId = session.metadata?.userId || session.client_reference_id;
  const productId = session.metadata?.productId;

  if (userId && productId) {
    console.log(`[Webhook] Checkout expired for user ${userId}, product ${productId}`);
    // Could track this for conversion analytics
  }

  console.log('[Webhook] Checkout session expiration logged');
}

export default webhooks;
