/**
 * Subscription routes
 *
 * Handles subscription management including reactivation after trial expiration
 */

import { Hono } from 'hono';
import type { HonoEnv } from '../types/hono.js';
import { requireAuth } from '../middleware/auth.js';
import { createCheckoutSession } from '../services/stripe.service.js';
import {
  success,
  badRequest,
  notFound,
  ErrorCodes,
} from '../utils/responses.js';

const subscriptions = new Hono<HonoEnv>();

// =============================================================================
// REACTIVATION ENDPOINT
// =============================================================================

/**
 * POST /api/subscriptions/reactivate
 *
 * Create a Stripe checkout session for reactivating a subscription
 * after trial expiration. No trial period is given since they already had one.
 */
subscriptions.post('/reactivate', requireAuth, async (c) => {
  const userId = c.get('userId');
  const userEmail = c.get('userEmail');
  const db = c.get('db');

  try {
    const body = await c.req.json();
    const { charityId, workshopId, billingInterval = 'monthly' } = body;

    // Validate charity selection
    if (!charityId) {
      return badRequest(c, ErrorCodes.INVALID_INPUT, 'Please select a charity');
    }

    // Validate billing interval
    if (billingInterval !== 'monthly' && billingInterval !== 'annual') {
      return badRequest(c, ErrorCodes.INVALID_INPUT, 'Invalid billing interval');
    }

    // Get user info
    const userResult = await db.query(
      'SELECT id, email, first_name, last_name FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rowCount === 0) {
      return notFound(c, ErrorCodes.NOT_FOUND, 'User not found');
    }

    const user = userResult.rows[0];

    // Determine which product/price to use based on billing interval
    let stripePriceId: string | null = null;
    let productSlug: string | null = null;
    const priceColumn = billingInterval === 'annual' ? 'stripe_price_id_annual' : 'stripe_price_id';

    // If workshopId provided, get the workshop's Stripe price
    if (workshopId) {
      const workshopResult = await db.query(
        `SELECT stripe_price_id, stripe_price_id_annual FROM workshops WHERE id = $1`,
        [workshopId]
      );

      if (workshopResult.rowCount > 0) {
        const workshop = workshopResult.rows[0];
        // Use annual if selected and available, otherwise fall back to monthly
        stripePriceId = billingInterval === 'annual' && workshop.stripe_price_id_annual
          ? workshop.stripe_price_id_annual
          : workshop.stripe_price_id;
        productSlug = 'workshop';
      }
    }

    // If no workshop price, try to get from user's current product
    if (!stripePriceId) {
      const productResult = await db.query(
        `SELECT p.stripe_price_id, p.stripe_price_id_annual, p.slug
         FROM user_products up
         JOIN products p ON up.product_id = p.id
         WHERE up.user_id = $1
         ORDER BY up.created_at DESC
         LIMIT 1`,
        [userId]
      );

      if (productResult.rowCount > 0) {
        const product = productResult.rows[0];
        // Use annual if selected and available, otherwise fall back to monthly
        stripePriceId = billingInterval === 'annual' && product.stripe_price_id_annual
          ? product.stripe_price_id_annual
          : product.stripe_price_id;
        productSlug = product.slug;
      }
    }

    // Fallback to CPG Calculator if nothing else found
    if (!stripePriceId) {
      const cpgResult = await db.query(
        `SELECT stripe_price_id, stripe_price_id_annual, slug FROM products WHERE slug = 'cpu-cpg-calculator'`
      );

      if (cpgResult.rowCount > 0) {
        const cpg = cpgResult.rows[0];
        // Use annual if selected and available, otherwise fall back to monthly
        stripePriceId = billingInterval === 'annual' && cpg.stripe_price_id_annual
          ? cpg.stripe_price_id_annual
          : cpg.stripe_price_id;
        productSlug = cpg.slug;
      }
    }

    if (!stripePriceId) {
      console.error('[Subscriptions] No Stripe price ID found for reactivation');
      return badRequest(c, ErrorCodes.INTERNAL_ERROR, 'Unable to process subscription. Please contact support.');
    }

    // Update user's charity selection (end current, insert new)
    // First, end any active charity selection
    await db.query(
      `UPDATE user_charity_selections
       SET effective_until = NOW()
       WHERE user_id = $1 AND effective_until IS NULL`,
      [userId]
    );

    // Then insert the new selection
    await db.query(
      `INSERT INTO user_charity_selections (user_id, charity_id, selected_at, effective_from)
       VALUES ($1, $2, NOW(), NOW())`,
      [userId, charityId]
    );

    console.log('[Subscriptions] Updated charity selection for user:', userId, 'to charity:', charityId);

    // Create Stripe checkout session (NO TRIAL - they already had one)
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3006';

    const session = await createCheckoutSession({
      priceId: stripePriceId,
      userId: user.id,
      userEmail: user.email,
      successUrl: `${frontendUrl}/reactivation/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${frontendUrl}/reactivation/cancelled`,
      trialDays: 0, // NO TRIAL for reactivation
      metadata: {
        reactivation: 'true',
        charityId,
        workshopId: workshopId || '',
        productSlug: productSlug || '',
        billingInterval,
      },
    });

    console.log('[Subscriptions] Created reactivation checkout session:', session.id, 'billing:', billingInterval);

    return success(c, {
      url: session.url,
      sessionId: session.id,
    });
  } catch (error: any) {
    console.error('[Subscriptions] Error creating reactivation checkout:', error);
    return badRequest(c, ErrorCodes.INTERNAL_ERROR, error.message || 'Failed to create checkout session');
  }
});

// =============================================================================
// SAVE CHARITY SELECTION (for Pricing Table flow)
// =============================================================================

/**
 * POST /api/subscriptions/save-charity
 *
 * Save charity selection before user proceeds to Stripe Pricing Table.
 * The Pricing Table handles plan selection and checkout, so we just need
 * to save the charity here.
 */
subscriptions.post('/save-charity', requireAuth, async (c) => {
  const userId = c.get('userId');
  const db = c.get('db');

  try {
    const body = await c.req.json();
    const { charityId } = body;

    // Validate charity selection
    if (!charityId) {
      return badRequest(c, ErrorCodes.INVALID_INPUT, 'Please select a charity');
    }

    // Verify charity exists and is active
    const charityResult = await db.query(
      'SELECT id FROM charities WHERE id = $1 AND active = true',
      [charityId]
    );

    if (charityResult.rowCount === 0) {
      return badRequest(c, ErrorCodes.INVALID_INPUT, 'Invalid charity selection');
    }

    // Update user's charity selection (end current, insert new)
    // First, end any active charity selection
    await db.query(
      `UPDATE user_charity_selections
       SET effective_until = NOW()
       WHERE user_id = $1 AND effective_until IS NULL`,
      [userId]
    );

    // Then insert the new selection
    await db.query(
      `INSERT INTO user_charity_selections (user_id, charity_id, selected_at, effective_from)
       VALUES ($1, $2, NOW(), NOW())`,
      [userId, charityId]
    );

    console.log('[Subscriptions] Saved charity selection for user:', userId, 'charity:', charityId);

    return success(c, {
      saved: true,
      charityId,
    });
  } catch (error: any) {
    console.error('[Subscriptions] Error saving charity selection:', error);
    return badRequest(c, ErrorCodes.INTERNAL_ERROR, error.message || 'Failed to save charity selection');
  }
});

export default subscriptions;
