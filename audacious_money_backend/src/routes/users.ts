/**
 * User routes
 *
 * Protected endpoints for user account management
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { HonoEnv } from '../types/hono.js';
import { requireAuth } from '../middleware/auth.js';
import { requireNotFrozen } from '../middleware/frozenState.js';
import {
  success,
  badRequest,
  notFound,
  unauthorized,
  ErrorCodes,
  ErrorMessages,
} from '../utils/responses.js';
import {
  stripe,
  createCheckoutSession,
  cancelAllUserSubscriptions,
  pauseSubscription,
  resumeSubscription,
  getDefaultPaymentMethod,
  createSetupIntent,
  updateDefaultPaymentMethod,
  getInvoiceHistory,
} from '../services/stripe.service.js';
import { hashPassword, timingSafeVerify } from '../utils/password.js';
import {
  sendAccountDeletedEmail,
  sendSubscriptionPausedEmail,
  sendSubscriptionResumedEmail,
} from '../services/email.service.js';

const users = new Hono<HonoEnv>();

// All routes require authentication
users.use('*', requireAuth);

// Block write operations when account is frozen
// (except for reactivation, payment, and subscription endpoints)
users.use('*', requireNotFrozen);

/**
 * POST /users/me/products
 *
 * Create a Stripe checkout session for a product subscription
 */
const createCheckoutSchema = z.object({
  productId: z.string().uuid(),
});

users.post('/me/products', async (c) => {
  const userId = c.get('userId');
  const userEmail = c.get('userEmail');
  const db = c.get('db');

  // Validate request body
  const parseResult = createCheckoutSchema.safeParse(await c.req.json());
  if (!parseResult.success) {
    return badRequest(
      c,
      ErrorCodes.VALIDATION_ERROR,
      'Invalid request data',
      parseResult.error.errors
    );
  }

  const { productId } = parseResult.data;

  try {
    // Get product details including Stripe price ID
    const productResult = await db.query(
      `SELECT id, name, slug, stripe_price_id, price_monthly
       FROM products
       WHERE id = $1 AND active = true`,
      [productId]
    );

    if (productResult.rows.length === 0) {
      return notFound(c, ErrorCodes.NOT_FOUND, ErrorMessages.PRODUCT_NOT_FOUND);
    }

    const product = productResult.rows[0];

    if (!product.stripe_price_id) {
      console.error(
        `[Checkout] Product ${product.slug} has no Stripe price ID`
      );
      return badRequest(
        c,
        ErrorCodes.VALIDATION_ERROR,
        'Product is not available for purchase at this time'
      );
    }

    // Check if user already has an active subscription for this product
    const existingSubscription = await db.query(
      `SELECT id FROM user_products
       WHERE user_id = $1 AND product_id = $2 AND status = 'active'`,
      [userId, productId]
    );

    if (existingSubscription.rows.length > 0) {
      return badRequest(
        c,
        ErrorCodes.VALIDATION_ERROR,
        'You already have an active subscription for this product'
      );
    }

    // Construct success and cancel URLs
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3006';
    const successUrl = `${frontendUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${frontendUrl}/checkout/cancel`;

    // Create Stripe checkout session
    const session = await createCheckoutSession({
      priceId: product.stripe_price_id,
      userId,
      userEmail,
      successUrl,
      cancelUrl,
      metadata: {
        productId: productId, // Already a string (UUID)
        productSlug: product.slug,
      },
    });

    return success(c, {
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error('[Checkout] Error creating checkout session:', error);
    throw error;
  }
});

/**
 * PUT /users/me/password
 *
 * Change user password
 */
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});

users.put('/me/password', async (c) => {
  const userId = c.get('userId');
  const db = c.get('db');

  // Validate request body
  const parseResult = changePasswordSchema.safeParse(await c.req.json());
  if (!parseResult.success) {
    return badRequest(
      c,
      ErrorCodes.VALIDATION_ERROR,
      'Invalid request data',
      parseResult.error.errors
    );
  }

  const { currentPassword, newPassword } = parseResult.data;

  try {
    // Get current password hash
    const userResult = await db.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return notFound(c, ErrorCodes.NOT_FOUND, 'User not found');
    }

    const user = userResult.rows[0];

    // Verify current password
    const isValid = await timingSafeVerify(currentPassword, user.password_hash);
    if (!isValid) {
      return unauthorized(c, ErrorCodes.INVALID_CREDENTIALS, 'Current password is incorrect');
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password
    await db.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newPasswordHash, userId]
    );

    // Create audit log entry
    const ipAddressRaw =
      c.req.header('x-forwarded-for') ||
      c.req.header('x-real-ip') ||
      c.req.header('cf-connecting-ip') ||
      '';
    const ipAddress = ipAddressRaw.split(',')[0].trim() || null;

    await db.query(
      `INSERT INTO admin_audit_log (action, resource_type, resource_id, ip_address)
       VALUES ('password_changed', 'user', $1, $2)`,
      [userId, ipAddress]
    );

    return success(c, { message: 'Password changed successfully' });
  } catch (error) {
    console.error('[Users] Change password error:', error);
    throw error;
  }
});

/**
 * DELETE /users/me
 *
 * Permanently delete user account
 * Requires password confirmation for security
 */
const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Password is required for account deletion'),
  confirmText: z.string().refine((val) => val === 'DELETE', {
    message: 'Must type DELETE to confirm',
  }),
});

users.delete('/me', async (c) => {
  const userId = c.get('userId');
  const userEmail = c.get('userEmail');
  const db = c.get('db');

  // Validate request body
  const parseResult = deleteAccountSchema.safeParse(await c.req.json());
  if (!parseResult.success) {
    return badRequest(
      c,
      ErrorCodes.VALIDATION_ERROR,
      'Invalid request data',
      parseResult.error.errors
    );
  }

  const { password } = parseResult.data;

  try {
    // Get user details
    const userResult = await db.query(
      `SELECT id, email, password_hash, first_name, last_name, account_status
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return notFound(c, ErrorCodes.NOT_FOUND, 'User not found');
    }

    const user = userResult.rows[0];

    // Verify password
    const isValid = await timingSafeVerify(password, user.password_hash);
    if (!isValid) {
      return unauthorized(c, ErrorCodes.INVALID_CREDENTIALS, 'Password is incorrect');
    }

    // Get all active Stripe subscriptions
    const subscriptionsResult = await db.query(
      `SELECT stripe_subscription_id
       FROM user_products
       WHERE user_id = $1 AND stripe_subscription_id IS NOT NULL AND status IN ('trialing', 'active')`,
      [userId]
    );

    const subscriptionIds = subscriptionsResult.rows
      .map((row) => row.stripe_subscription_id)
      .filter((id): id is string => id !== null);

    // Cancel all Stripe subscriptions
    if (subscriptionIds.length > 0) {
      console.log(`[Users] Cancelling ${subscriptionIds.length} Stripe subscriptions for user ${userId}`);
      const { cancelled, errors } = await cancelAllUserSubscriptions(subscriptionIds);
      console.log(`[Users] Cancelled ${cancelled}/${subscriptionIds.length} subscriptions`);

      if (errors.length > 0) {
        console.error('[Users] Errors cancelling subscriptions:', errors);
        // Continue with deletion even if some subscriptions failed to cancel
      }
    }

    // Update user_products to cancelled status
    await db.query(
      `UPDATE user_products
       SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
       WHERE user_id = $1 AND status IN ('trialing', 'active')`,
      [userId]
    );

    // Delete user (CASCADE will delete related records)
    await db.query('DELETE FROM users WHERE id = $1', [userId]);

    // Create audit log entry
    const ipAddressRaw =
      c.req.header('x-forwarded-for') ||
      c.req.header('x-real-ip') ||
      c.req.header('cf-connecting-ip') ||
      '';
    const ipAddress = ipAddressRaw.split(',')[0].trim() || null;

    await db.query(
      `INSERT INTO admin_audit_log (action, resource_type, resource_id, old_values, ip_address)
       VALUES ('account_deleted', 'user', $1, $2, $3)`,
      [userId, JSON.stringify({ email: user.email }), ipAddress]
    );

    // Send confirmation email
    try {
      await sendAccountDeletedEmail(userEmail, user.first_name);
    } catch (emailError) {
      console.error('[Users] Failed to send account deleted email:', emailError);
      // Don't fail the request if email fails
    }

    console.log(`[Users] Account deleted successfully: ${userId} (${userEmail})`);

    return success(c, {
      message: 'Account deleted successfully',
      deleted: true,
    });
  } catch (error) {
    console.error('[Users] Delete account error:', error);
    throw error;
  }
});

/**
 * GET /users/me/billing-debug
 *
 * TEMPORARY: Diagnostic endpoint to debug billing issues
 * Returns all relevant data for troubleshooting
 */
users.get('/me/billing-debug', async (c) => {
  const userId = c.get('userId');
  const db = c.get('db');

  try {
    // Get user data
    const userResult = await db.query(
      `SELECT id, email, stripe_customer_id, current_workshop_enrollment_id, is_beta
       FROM users WHERE id = $1`,
      [userId]
    );

    // Get ALL user_products records
    const productsResult = await db.query(
      `SELECT up.*, p.name as product_name, p.slug as product_slug
       FROM user_products up
       JOIN products p ON up.product_id = p.id
       WHERE up.user_id = $1
       ORDER BY up.created_at DESC`,
      [userId]
    );

    // Get ALL workshop enrollments
    const enrollmentsResult = await db.query(
      `SELECT we.*, w.workshop_name, w.cohort_name
       FROM workshop_enrollments we
       JOIN workshops w ON we.workshop_id = w.id
       WHERE we.user_id = $1
       ORDER BY we.created_at DESC`,
      [userId]
    );

    return success(c, {
      user: userResult.rows[0] || null,
      userProducts: productsResult.rows,
      workshopEnrollments: enrollmentsResult.rows,
      debug: {
        userId,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[Users] Billing debug error:', error);
    throw error;
  }
});

/**
 * GET /users/me/subscription
 *
 * Get current subscription status and details
 */
users.get('/me/subscription', async (c) => {
  const userId = c.get('userId');
  const db = c.get('db');

  try {
    // Get user's subscription
    const subscriptionResult = await db.query(
      `SELECT up.id, up.status, up.trial_ends_at, up.trial_converted, up.activated_at,
              up.paused_at, up.resumed_at, up.grace_period_ends_at, up.stripe_subscription_id,
              up.current_period_end,
              p.id as product_id, p.name as product_name, p.slug as product_slug,
              p.price_monthly, u.is_beta
       FROM user_products up
       JOIN products p ON up.product_id = p.id
       JOIN users u ON up.user_id = u.id
       WHERE up.user_id = $1 AND up.status IN ('trialing', 'active', 'paused')
       ORDER BY up.activated_at DESC
       LIMIT 1`,
      [userId]
    );

    if (subscriptionResult.rows.length === 0) {
      return success(c, { subscription: null });
    }

    const subscription = subscriptionResult.rows[0];

    // Get actual price from Stripe if subscription exists
    let actualPrice = subscription.price_monthly; // Fallback to database value
    if (subscription.stripe_subscription_id) {
      try {
        const stripeSubscription = await stripe.subscriptions.retrieve(
          subscription.stripe_subscription_id
        );

        // Extract price from subscription items (in cents, convert to dollars)
        if (stripeSubscription.items.data.length > 0) {
          const priceInCents = stripeSubscription.items.data[0].price.unit_amount;
          if (priceInCents) {
            actualPrice = priceInCents / 100; // Convert cents to dollars
          }
        }
      } catch (stripeError) {
        console.error('[Users] Failed to fetch Stripe subscription price:', stripeError);
        // Continue with database price as fallback
      }
    }

    // Map database status to frontend-expected values
    // Database stores 'trialing' but frontend expects 'trial'
    const mappedStatus = subscription.status === 'trialing' ? 'trial' : subscription.status;

    return success(c, {
      subscription: {
        id: subscription.id,
        status: mappedStatus,
        productId: subscription.product_id,
        productName: subscription.product_name,
        productSlug: subscription.product_slug,
        priceMonthly: actualPrice,
        trialEndsAt: subscription.trial_ends_at,
        trialConverted: subscription.trial_converted,
        activatedAt: subscription.activated_at,
        pausedAt: subscription.paused_at,
        resumedAt: subscription.resumed_at,
        gracePeriodEndsAt: subscription.grace_period_ends_at,
        currentPeriodEnd: subscription.current_period_end,
        stripeSubscriptionId: subscription.stripe_subscription_id,
        isBeta: subscription.is_beta || false,
      },
    });
  } catch (error) {
    console.error('[Users] Get subscription error:', error);
    throw error;
  }
});

/**
 * POST /users/me/subscription/pause
 *
 * Pause subscription (user keeps view-only access, no charges)
 */
users.post('/me/subscription/pause', async (c) => {
  const userId = c.get('userId');
  const userEmail = c.get('userEmail');
  const db = c.get('db');

  try {
    // Get user's active subscription
    const subscriptionResult = await db.query(
      `SELECT up.id, up.stripe_subscription_id, u.first_name, p.name as product_name
       FROM user_products up
       JOIN users u ON up.user_id = u.id
       JOIN products p ON up.product_id = p.id
       WHERE up.user_id = $1 AND up.status IN ('trialing', 'active')
       ORDER BY up.activated_at DESC
       LIMIT 1`,
      [userId]
    );

    if (subscriptionResult.rows.length === 0) {
      return notFound(c, ErrorCodes.NOT_FOUND, 'No active subscription found');
    }

    const subscription = subscriptionResult.rows[0];

    // Pause Stripe subscription if it exists
    if (subscription.stripe_subscription_id) {
      await pauseSubscription(subscription.stripe_subscription_id);
      console.log(`[Users] Paused Stripe subscription: ${subscription.stripe_subscription_id}`);
    }

    // Update user_products to paused status
    await db.query(
      `UPDATE user_products
       SET status = 'paused', paused_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [subscription.id]
    );

    // Create audit log entry
    const ipAddress =
      c.req.header('x-forwarded-for')?.split(',')[0].trim() ||
      c.req.header('x-real-ip') ||
      c.req.header('cf-connecting-ip') ||
      '';

    await db.query(
      `INSERT INTO admin_audit_log (action, resource_type, resource_id, ip_address)
       VALUES ('subscription_paused', 'user_product', $1, $2)`,
      [subscription.id, ipAddress]
    );

    // Send confirmation email
    try {
      await sendSubscriptionPausedEmail(
        userEmail,
        subscription.first_name,
        subscription.product_name
      );
    } catch (emailError) {
      console.error('[Users] Failed to send subscription paused email:', emailError);
    }

    console.log(`[Users] Subscription paused successfully: ${subscription.id}`);

    return success(c, {
      message: 'Subscription paused successfully',
      paused: true,
    });
  } catch (error) {
    console.error('[Users] Pause subscription error:', error);
    throw error;
  }
});

/**
 * POST /users/me/subscription/resume
 *
 * Resume paused subscription (charges immediately)
 */
users.post('/me/subscription/resume', async (c) => {
  const userId = c.get('userId');
  const userEmail = c.get('userEmail');
  const db = c.get('db');

  try {
    // Get user's paused subscription
    const subscriptionResult = await db.query(
      `SELECT up.id, up.stripe_subscription_id, u.first_name, p.name as product_name
       FROM user_products up
       JOIN users u ON up.user_id = u.id
       JOIN products p ON up.product_id = p.id
       WHERE up.user_id = $1 AND up.status = 'paused'
       ORDER BY up.paused_at DESC
       LIMIT 1`,
      [userId]
    );

    if (subscriptionResult.rows.length === 0) {
      return notFound(c, ErrorCodes.NOT_FOUND, 'No paused subscription found');
    }

    const subscription = subscriptionResult.rows[0];

    // Resume Stripe subscription if it exists (charges immediately)
    if (subscription.stripe_subscription_id) {
      await resumeSubscription(subscription.stripe_subscription_id);
      console.log(`[Users] Resumed Stripe subscription: ${subscription.stripe_subscription_id}`);
    }

    // Update user_products to active status
    await db.query(
      `UPDATE user_products
       SET status = 'active', resumed_at = NOW(), grace_period_ends_at = NULL, updated_at = NOW()
       WHERE id = $1`,
      [subscription.id]
    );

    // Create audit log entry
    const ipAddress =
      c.req.header('x-forwarded-for')?.split(',')[0].trim() ||
      c.req.header('x-real-ip') ||
      c.req.header('cf-connecting-ip') ||
      '';

    await db.query(
      `INSERT INTO admin_audit_log (action, resource_type, resource_id, ip_address)
       VALUES ('subscription_resumed', 'user_product', $1, $2)`,
      [subscription.id, ipAddress]
    );

    // Send confirmation email
    try {
      await sendSubscriptionResumedEmail(
        userEmail,
        subscription.first_name,
        subscription.product_name
      );
    } catch (emailError) {
      console.error('[Users] Failed to send subscription resumed email:', emailError);
    }

    console.log(`[Users] Subscription resumed successfully: ${subscription.id}`);

    return success(c, {
      message: 'Subscription resumed successfully. Your card has been charged.',
      resumed: true,
    });
  } catch (error) {
    console.error('[Users] Resume subscription error:', error);
    throw error;
  }
});

/**
 * GET /users/me/payment-methods
 *
 * Get user's payment method on file
 */
users.get('/me/payment-methods', async (c) => {
  const userId = c.get('userId');
  const db = c.get('db');

  try {
    console.log(`[Users] Getting payment method for user: ${userId}`);

    // Get user's Stripe customer ID
    const userResult = await db.query(
      'SELECT stripe_customer_id FROM users WHERE id = $1',
      [userId]
    );

    console.log(`[Users] User query result:`, {
      found: userResult.rows.length > 0,
      hasCustomerId: userResult.rows.length > 0 && !!userResult.rows[0].stripe_customer_id,
      customerId: userResult.rows.length > 0 ? userResult.rows[0].stripe_customer_id : null,
    });

    if (userResult.rows.length === 0 || !userResult.rows[0].stripe_customer_id) {
      console.log('[Users] No Stripe customer ID found, returning null');
      return success(c, { paymentMethod: null });
    }

    const customerId = userResult.rows[0].stripe_customer_id;

    // Get default payment method from Stripe
    console.log(`[Users] Fetching payment method from Stripe for customer: ${customerId}`);
    const paymentMethod = await getDefaultPaymentMethod(customerId);

    console.log(`[Users] Stripe returned payment method:`, paymentMethod ? 'Found' : 'Not found');

    if (!paymentMethod) {
      console.log('[Users] No payment method found in Stripe, returning null');
      return success(c, { paymentMethod: null });
    }

    // DEBUG: Log full payment method to see what Stripe actually provides
    console.log('[Users] Full Stripe PaymentMethod object:', JSON.stringify(paymentMethod, null, 2));

    // Return appropriate data based on payment method type
    const methodData: any = {
      id: paymentMethod.id,
      type: paymentMethod.type,
    };

    // Card payment method
    if (paymentMethod.card) {
      methodData.brand = paymentMethod.card.brand;
      methodData.last4 = paymentMethod.card.last4;
      methodData.expMonth = paymentMethod.card.exp_month;
      methodData.expYear = paymentMethod.card.exp_year;
    }

    // US Bank Account payment method
    if (paymentMethod.us_bank_account) {
      methodData.brand = 'us_bank_account';
      methodData.bankName = paymentMethod.us_bank_account.bank_name;
      methodData.last4 = paymentMethod.us_bank_account.last4;
      methodData.accountType = paymentMethod.us_bank_account.account_type; // 'checking' or 'savings'
    }

    // Link payment method
    if (paymentMethod.link) {
      methodData.brand = 'link';
      methodData.email = paymentMethod.link.email;
    }

    return success(c, {
      paymentMethod: methodData,
    });
  } catch (error) {
    console.error('[Users] Get payment methods error:', error);
    throw error;
  }
});

/**
 * POST /users/me/setup-intent
 *
 * Create a Stripe Setup Intent for updating payment method
 */
users.post('/me/setup-intent', async (c) => {
  const userId = c.get('userId');
  const db = c.get('db');

  try {
    // Get user's Stripe customer ID
    const userResult = await db.query(
      'SELECT stripe_customer_id FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return notFound(c, ErrorCodes.NOT_FOUND, 'User not found');
    }

    let customerId = userResult.rows[0].stripe_customer_id;

    // Create Stripe customer if doesn't exist
    if (!customerId) {
      const userEmailResult = await db.query(
        'SELECT email FROM users WHERE id = $1',
        [userId]
      );
      const userEmail = userEmailResult.rows[0].email;

      const { stripe } = await import('../services/stripe.service.js');
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: { userId },
      });

      customerId = customer.id;

      // Store customer ID in database
      await db.query('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [
        customerId,
        userId,
      ]);
    }

    // Create Setup Intent
    const setupIntent = await createSetupIntent(customerId);

    return success(c, {
      clientSecret: setupIntent.client_secret,
    });
  } catch (error) {
    console.error('[Users] Create setup intent error:', error);
    throw error;
  }
});

/**
 * PUT /users/me/payment-method
 *
 * Update default payment method
 */
const updatePaymentMethodSchema = z.object({
  paymentMethodId: z.string().min(1, 'Payment method ID is required'),
});

users.put('/me/payment-method', async (c) => {
  const userId = c.get('userId');
  const db = c.get('db');

  // Validate request body
  const parseResult = updatePaymentMethodSchema.safeParse(await c.req.json());
  if (!parseResult.success) {
    return badRequest(
      c,
      ErrorCodes.VALIDATION_ERROR,
      'Invalid request data',
      parseResult.error.errors
    );
  }

  const { paymentMethodId } = parseResult.data;

  try {
    // Get user's Stripe customer ID
    const userResult = await db.query(
      'SELECT stripe_customer_id FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return notFound(c, ErrorCodes.NOT_FOUND, 'User not found');
    }

    const customerId = userResult.rows[0].stripe_customer_id;

    if (!customerId) {
      return badRequest(c, ErrorCodes.VALIDATION_ERROR, 'No Stripe customer found');
    }

    // Update default payment method
    await updateDefaultPaymentMethod(customerId, paymentMethodId);

    // Create audit log entry
    const ipAddress =
      c.req.header('x-forwarded-for')?.split(',')[0].trim() ||
      c.req.header('x-real-ip') ||
      c.req.header('cf-connecting-ip') ||
      '';

    await db.query(
      `INSERT INTO admin_audit_log (action, resource_type, resource_id, ip_address)
       VALUES ('payment_method_updated', 'user', $1, $2)`,
      [userId, ipAddress]
    );

    console.log(`[Users] Payment method updated successfully: ${userId}`);

    return success(c, {
      message: 'Payment method updated successfully',
      updated: true,
    });
  } catch (error) {
    console.error('[Users] Update payment method error:', error);
    throw error;
  }
});

/**
 * GET /users/me/invoices
 *
 * Get invoice history
 */
users.get('/me/invoices', async (c) => {
  const userId = c.get('userId');
  const db = c.get('db');

  try {
    console.log(`[Users] Getting invoices for user: ${userId}`);

    // Get user's Stripe customer ID
    const userResult = await db.query(
      'SELECT stripe_customer_id FROM users WHERE id = $1',
      [userId]
    );

    console.log(`[Users] User query result:`, {
      found: userResult.rows.length > 0,
      hasCustomerId: userResult.rows.length > 0 && !!userResult.rows[0].stripe_customer_id,
      customerId: userResult.rows.length > 0 ? userResult.rows[0].stripe_customer_id : null,
    });

    if (userResult.rows.length === 0 || !userResult.rows[0].stripe_customer_id) {
      console.log('[Users] No Stripe customer ID found, returning empty array');
      return success(c, { invoices: [] });
    }

    const customerId = userResult.rows[0].stripe_customer_id;

    // Get invoices from Stripe
    console.log(`[Users] Fetching invoices from Stripe for customer: ${customerId}`);
    const invoices = await getInvoiceHistory(customerId, 12); // Last 12 invoices

    console.log(`[Users] Stripe returned ${invoices.length} invoices`);

    const formattedInvoices = invoices.map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      amount: invoice.amount_paid,
      currency: invoice.currency,
      status: invoice.status,
      paidAt: invoice.status_transitions?.paid_at
        ? new Date(invoice.status_transitions.paid_at * 1000).toISOString()
        : null,
      invoicePdf: invoice.invoice_pdf,
      hostedInvoiceUrl: invoice.hosted_invoice_url,
      created: new Date(invoice.created * 1000).toISOString(),
    }));

    return success(c, { invoices: formattedInvoices });
  } catch (error) {
    console.error('[Users] Get invoices error:', error);
    throw error;
  }
});

// =============================================================================
// REACTIVATION ENDPOINTS
// =============================================================================

/**
 * GET /users/me/reactivate/status
 *
 * Get the user's reactivation status (whether they need to reactivate and why)
 */
users.get('/me/reactivate/status', async (c) => {
  const userId = c.get('userId');
  const db = c.get('db');

  try {
    // Check for workshop enrollment with expired trial
    const workshopResult = await db.query(
      `SELECT we.id, we.workshop_id, we.trial_expires_at, we.converted_to_paid_at, we.status,
              w.stripe_price_id, w.workshop_name
       FROM workshop_enrollments we
       JOIN workshops w ON we.workshop_id = w.id
       WHERE we.user_id = $1
       ORDER BY we.enrolled_at DESC
       LIMIT 1`,
      [userId]
    );

    const workshopEnrollment = workshopResult.rows[0];

    // Check for regular subscription
    const subscriptionResult = await db.query(
      `SELECT up.id, up.status, up.trial_ends_at, up.trial_converted, up.stripe_subscription_id,
              p.id as product_id, p.stripe_price_id, p.price_monthly
       FROM user_products up
       JOIN products p ON up.product_id = p.id
       WHERE up.user_id = $1
       ORDER BY up.activated_at DESC
       LIMIT 1`,
      [userId]
    );

    const subscription = subscriptionResult.rows[0];

    // Determine reactivation status
    let needsReactivation = false;
    let reason: string | null = null;
    let canResume = false;
    let workshopId: string | null = null;
    let productId: string | null = null;
    let priceInCents: number | null = null;

    // Check workshop trial expiration
    if (workshopEnrollment && !workshopEnrollment.converted_to_paid_at) {
      const now = new Date();
      const trialExpiresAt = new Date(workshopEnrollment.trial_expires_at);
      if (now > trialExpiresAt) {
        needsReactivation = true;
        reason = 'workshop_trial_expired';
        workshopId = workshopEnrollment.workshop_id;
        // Workshop price would come from stripe_price_id lookup
      }
    }

    // Check regular subscription trial expiration (if not a workshop user)
    if (!needsReactivation && subscription && !subscription.trial_converted) {
      const now = new Date();
      const trialEndsAt = subscription.trial_ends_at ? new Date(subscription.trial_ends_at) : null;
      if (trialEndsAt && now > trialEndsAt) {
        needsReactivation = true;
        reason = 'subscription_trial_expired';
        productId = subscription.product_id;
        priceInCents = subscription.price_monthly ? Math.round(subscription.price_monthly * 100) : null;
      }
    }

    // Check for cancelled subscription
    if (!needsReactivation && subscription && subscription.status === 'cancelled') {
      needsReactivation = true;
      reason = 'subscription_cancelled';
      productId = subscription.product_id;
      priceInCents = subscription.price_monthly ? Math.round(subscription.price_monthly * 100) : null;
      // Can potentially resume if it was a soft cancel
      canResume = !!subscription.stripe_subscription_id;
    }

    // Check for expired subscription
    if (!needsReactivation && subscription && subscription.status === 'expired') {
      needsReactivation = true;
      reason = 'subscription_expired';
      productId = subscription.product_id;
      priceInCents = subscription.price_monthly ? Math.round(subscription.price_monthly * 100) : null;
    }

    return success(c, {
      needsReactivation,
      reason,
      canResume,
      workshopId,
      productId,
      priceInCents,
    });
  } catch (error) {
    console.error('[Users] Get reactivation status error:', error);
    throw error;
  }
});

/**
 * POST /users/me/reactivate/checkout
 *
 * Create a Stripe checkout session for account reactivation
 * Works for both workshop and regular signup users
 */
const reactivateCheckoutSchema = z.object({
  charityId: z.string().uuid('Invalid charity ID'),
  workshopId: z.string().uuid('Invalid workshop ID').optional(),
  productId: z.string().uuid('Invalid product ID').optional(),
});

users.post('/me/reactivate/checkout', async (c) => {
  const userId = c.get('userId');
  const userEmail = c.get('userEmail');
  const db = c.get('db');

  // Validate request body
  const parseResult = reactivateCheckoutSchema.safeParse(await c.req.json());
  if (!parseResult.success) {
    return badRequest(
      c,
      ErrorCodes.VALIDATION_ERROR,
      'Invalid request data',
      parseResult.error.errors
    );
  }

  const { charityId, workshopId, productId: requestedProductId } = parseResult.data;

  try {
    // Verify charity exists and is active
    const charityResult = await db.query(
      `SELECT id, name FROM charities WHERE id = $1 AND active = true AND status = 'VERIFIED'`,
      [charityId]
    );

    if (charityResult.rows.length === 0) {
      return badRequest(c, ErrorCodes.VALIDATION_ERROR, 'Invalid or inactive charity selected');
    }

    let priceId: string;
    let productSlug: string;
    let enrollmentId: string | null = null;

    // Determine pricing based on user type
    if (workshopId) {
      // Workshop user: get price from workshop
      const workshopResult = await db.query(
        `SELECT w.stripe_price_id, w.workshop_name, we.id as enrollment_id
         FROM workshops w
         JOIN workshop_enrollments we ON we.workshop_id = w.id
         WHERE w.id = $1 AND we.user_id = $2`,
        [workshopId, userId]
      );

      if (workshopResult.rows.length === 0) {
        return badRequest(c, ErrorCodes.VALIDATION_ERROR, 'Workshop enrollment not found');
      }

      const workshop = workshopResult.rows[0];

      if (!workshop.stripe_price_id) {
        return badRequest(c, ErrorCodes.VALIDATION_ERROR, 'Workshop does not have pricing configured');
      }

      priceId = workshop.stripe_price_id;
      productSlug = 'workshop';
      enrollmentId = workshop.enrollment_id;
    } else {
      // Regular user: get price from their previous subscription or requested product
      let productIdToUse = requestedProductId;

      // If no product specified, try to get from previous subscription
      if (!productIdToUse) {
        const prevSubscription = await db.query(
          `SELECT product_id FROM user_products WHERE user_id = $1 ORDER BY activated_at DESC LIMIT 1`,
          [userId]
        );

        if (prevSubscription.rows.length > 0) {
          productIdToUse = prevSubscription.rows[0].product_id;
        }
      }

      // If still no product, use default product
      if (!productIdToUse) {
        const defaultProduct = await db.query(
          `SELECT id, stripe_price_id, slug FROM products WHERE slug = 'audacious-money' AND active = true`
        );
        if (defaultProduct.rows.length > 0) {
          productIdToUse = defaultProduct.rows[0].id;
        }
      }

      if (!productIdToUse) {
        return badRequest(c, ErrorCodes.VALIDATION_ERROR, 'No product found for subscription');
      }

      // Get product details
      const productResult = await db.query(
        `SELECT id, stripe_price_id, slug FROM products WHERE id = $1 AND active = true`,
        [productIdToUse]
      );

      if (productResult.rows.length === 0) {
        return badRequest(c, ErrorCodes.VALIDATION_ERROR, 'Product not found');
      }

      const product = productResult.rows[0];

      if (!product.stripe_price_id) {
        return badRequest(c, ErrorCodes.VALIDATION_ERROR, 'Product does not have pricing configured');
      }

      priceId = product.stripe_price_id;
      productSlug = product.slug;
    }

    // Close any existing charity selection and create new one
    // First, mark current selection as ended
    await db.query(
      `UPDATE user_charity_selections
       SET effective_until = NOW()
       WHERE user_id = $1 AND effective_until IS NULL`,
      [userId]
    );

    // Then insert new selection
    await db.query(
      `INSERT INTO user_charity_selections (user_id, charity_id, selected_at, effective_from)
       VALUES ($1, $2, NOW(), NOW())`,
      [userId, charityId]
    );

    // Construct success and cancel URLs
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3006';
    const successUrl = `${frontendUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}&reactivation=true`;
    const cancelUrl = `${frontendUrl}/dashboard?reactivation_cancelled=true`;

    // Create Stripe checkout session
    const session = await createCheckoutSession({
      priceId,
      userId,
      userEmail,
      successUrl,
      cancelUrl,
      metadata: {
        reactivation: 'true',
        charityId,
        productSlug,
        workshopId: workshopId || '',
        enrollmentId: enrollmentId || '',
      },
    });

    console.log(`[Users] Created reactivation checkout session: ${session.id} for user ${userId}`);

    return success(c, {
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error('[Users] Create reactivation checkout error:', error);
    throw error;
  }
});

export default users;
