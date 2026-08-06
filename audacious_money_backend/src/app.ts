/**
 * Audacious Money Backend API
 *
 * Main application setup with security-first middleware configuration
 */

import { Hono } from 'hono';
import { logger } from 'hono/logger';
import {
  securityHeadersMiddleware,
  corsMiddleware,
  requestIdMiddleware,
} from './middleware/security.js';
import { rateLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { getDatabase, checkDatabaseHealth } from './db/connection.js';
import { success } from './utils/responses.js';
import authRoutes from './routes/auth.js';
import webhookRoutes from './routes/webhooks.js';
import testEmailRoutes from './routes/test-email.js';
import productRoutes from './routes/products.js';
import userRoutes from './routes/users.js';
import adminRoutes from './routes/admin.js';
import contactRoutes from './routes/contact.js';
import charityRoutes from './routes/charities.js';
import workshopRoutes from './routes/workshops.js';
import subscriptionRoutes from './routes/subscriptions.js';
import cronRoutes from './routes/cron.js';

// Create Hono app
const app = new Hono();

// ==========================================
// Global Middleware (Order matters!)
// ==========================================

// 1. Security headers (apply to all routes)
app.use('*', securityHeadersMiddleware());

// 2. Request ID (for tracing and logging)
app.use('*', requestIdMiddleware);

// 3. Logger (log all requests EXCEPT webhooks - webhooks need raw body for signature verification)
app.use('*', async (c, next) => {
  // Skip logger for webhook routes (they need raw body for signature verification)
  if (c.req.path.startsWith('/webhooks')) {
    await next();
  } else {
    return logger()(c, next);
  }
});

// 4. CORS (allow only configured origins)
app.use('*', corsMiddleware());

// 5. Make database available in context
app.use('*', async (c, next) => {
  c.set('db', getDatabase());
  await next();
});

// ==========================================
// Rate Limiting (Stricter for auth endpoints)
// ==========================================

// Webhook routes (must be before rate limiting)
app.route('/webhooks', webhookRoutes);

// Cron routes (must be before rate limiting, uses its own auth)
app.route('/api/cron', cronRoutes);

// Auth endpoints: 10 requests per 5 minutes (prevents brute force, allows testing)
app.use('/auth/*', rateLimiter({ max: 10, window: 300 }));

// All other endpoints: 100 requests per minute
app.use('*', rateLimiter({ max: 100, window: 60 }));

// ==========================================
// ONE-TIME STRIPE SETUP ENDPOINT (REMOVE AFTER USE)
// ==========================================

app.post('/setup/stripe-product-id', async (c) => {
  const db = c.get('db');
  const body = await c.req.json().catch(() => ({}));
  const { secret, stripePriceId, productSlug } = body;

  // Simple secret check (use JWT_SECRET as the secret)
  if (secret !== process.env.JWT_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    console.log('[SETUP] Updating Stripe price ID for product:', productSlug);

    // Check product exists
    const checkResult = await db.query(
      'SELECT id, name, slug, stripe_price_id FROM products WHERE slug = $1',
      [productSlug]
    );

    if (checkResult.rowCount === 0) {
      return c.json({ error: `Product "${productSlug}" not found` }, 404);
    }

    const beforeState = checkResult.rows[0];
    console.log('[SETUP] Before:', beforeState);

    // Update the Stripe price ID
    const updateResult = await db.query(
      `UPDATE products
       SET stripe_price_id = $1, updated_at = NOW()
       WHERE slug = $2
       RETURNING id, name, slug, stripe_price_id, updated_at`,
      [stripePriceId, productSlug]
    );

    const afterState = updateResult.rows[0];
    console.log('[SETUP] After:', afterState);

    return c.json({
      success: true,
      message: 'Stripe price ID updated successfully',
      product: afterState,
    });
  } catch (error) {
    console.error('[SETUP] Error:', error);
    return c.json({ error: 'Database error', details: error.message }, 500);
  }
});

// ==========================================
// ONE-TIME FIX: Repair corrupted subscription data (REMOVE AFTER USE)
// ==========================================

app.post('/setup/fix-user-subscription', async (c) => {
  const db = c.get('db');
  const body = await c.req.json().catch(() => ({}));
  const {
    secret,
    userId,
    stripeCustomerId,
    stripeSubscriptionId,
    workshopEnrollmentId
  } = body;

  // Simple secret check (use JWT_SECRET as the secret)
  if (secret !== process.env.JWT_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  if (!userId) {
    return c.json({ error: 'userId is required' }, 400);
  }

  try {
    console.log('[FIX-SUBSCRIPTION] Starting fix for user:', userId);
    const results: any = { userId, updates: [] };

    // 1. Update user_products table
    const upResult = await db.query(
      `UPDATE user_products
       SET status = 'active',
           trial_converted = true,
           activated_at = COALESCE(activated_at, NOW()),
           stripe_subscription_id = COALESCE($2, stripe_subscription_id),
           updated_at = NOW()
       WHERE user_id = $1
       RETURNING id, status, trial_converted, activated_at, stripe_subscription_id`,
      [userId, stripeSubscriptionId]
    );

    if (upResult.rowCount > 0) {
      results.updates.push({
        table: 'user_products',
        rowsUpdated: upResult.rowCount,
        data: upResult.rows
      });
      console.log('[FIX-SUBSCRIPTION] Updated user_products:', upResult.rows);
    }

    // 2. Update users table with stripe_customer_id
    if (stripeCustomerId) {
      const userResult = await db.query(
        `UPDATE users
         SET stripe_customer_id = $2,
             updated_at = NOW()
         WHERE id = $1
         RETURNING id, email, stripe_customer_id`,
        [userId, stripeCustomerId]
      );

      if (userResult.rowCount > 0) {
        results.updates.push({
          table: 'users',
          rowsUpdated: userResult.rowCount,
          data: userResult.rows
        });
        console.log('[FIX-SUBSCRIPTION] Updated users:', userResult.rows);
      }
    }

    // 3. Graduate workshop enrollment if provided
    if (workshopEnrollmentId) {
      const weResult = await db.query(
        `UPDATE workshop_enrollments
         SET status = 'graduated',
             converted_to_paid_at = NOW(),
             updated_at = NOW()
         WHERE id = $1 AND user_id = $2
         RETURNING id, status, converted_to_paid_at`,
        [workshopEnrollmentId, userId]
      );

      if (weResult.rowCount > 0) {
        results.updates.push({
          table: 'workshop_enrollments',
          rowsUpdated: weResult.rowCount,
          data: weResult.rows
        });
        console.log('[FIX-SUBSCRIPTION] Updated workshop_enrollments:', weResult.rows);
      }
    }

    // 4. Verify final state
    const verifyResult = await db.query(
      `SELECT
         up.status as product_status,
         up.trial_converted,
         up.activated_at,
         up.stripe_subscription_id,
         u.stripe_customer_id,
         we.status as workshop_status,
         we.converted_to_paid_at as workshop_converted_at
       FROM user_products up
       JOIN users u ON u.id = up.user_id
       LEFT JOIN workshop_enrollments we ON we.user_id = up.user_id
       WHERE up.user_id = $1`,
      [userId]
    );

    results.finalState = verifyResult.rows[0];
    console.log('[FIX-SUBSCRIPTION] Final state:', results.finalState);

    return c.json({
      success: true,
      message: 'Subscription data fixed successfully',
      results
    });
  } catch (error: any) {
    console.error('[FIX-SUBSCRIPTION] Error:', error);
    return c.json({ error: 'Database error', details: error.message }, 500);
  }
});

// ==========================================
// Health Check Endpoint
// ==========================================

app.get('/health', async (c) => {
  const dbHealth = await checkDatabaseHealth();

  if (!dbHealth.healthy) {
    return c.json(
      {
        status: 'unhealthy',
        database: {
          healthy: false,
          error: dbHealth.error,
        },
      },
      503
    );
  }

  return success(c, {
    status: 'healthy',
    database: {
      healthy: true,
      responseTime: dbHealth.responseTime,
    },
    timestamp: new Date().toISOString(),
  });
});

// ==========================================
// API Routes
// ==========================================

app.route('/auth', authRoutes);

// Public contact form route
app.route('/contact', contactRoutes);

// Public product routes
app.route('/products', productRoutes);

// Charity routes (public and protected)
app.route('/charities', charityRoutes);

// Protected user routes
app.route('/users', userRoutes);

// Test email routes (DELETE IN PRODUCTION!)
app.route('/test', testEmailRoutes);

// Admin routes
app.route('/admin', adminRoutes);

// Workshop routes
app.route('/api/workshops', workshopRoutes);

// Subscription routes (reactivation, etc.)
app.route('/api/subscriptions', subscriptionRoutes);

// ==========================================
// Error Handling (Must be last)
// ==========================================

// 404 handler
app.notFound(notFoundHandler);

// Global error handler
app.onError(errorHandler);

// ==========================================
// Export
// ==========================================

export default app;

/**
 * AUTHENTICATION MIDDLEWARE USAGE
 *
 * The authentication middleware is now available for protecting routes.
 * Import from './middleware/auth.js':
 *
 * import { requireAuth, requireAdmin, requirePermission } from './middleware/auth.js';
 *
 * PROTECTED USER ROUTES:
 * ----------------------
 * app.get('/api/user/profile', requireAuth, async (c) => {
 *   const userId = c.get('userId');       // Get authenticated user ID
 *   const userEmail = c.get('userEmail'); // Get user email
 *   // CRITICAL: Always filter by userId in queries
 *   const profile = await db.query(
 *     'SELECT * FROM users WHERE id = $1',
 *     [userId]
 *   );
 *   return success(c, profile.rows[0]);
 * });
 *
 * PROTECTED ADMIN ROUTES:
 * -----------------------
 * import { Permissions } from './config/permissions.js';
 *
 * app.get('/admin/users', requireAdmin, requirePermission([Permissions.VIEW_USERS]), async (c) => {
 *   const adminId = c.get('adminId');
 *   const adminPermissions = c.get('adminPermissions');
 *   // Admin logic
 * });
 *
 * IDOR PREVENTION PATTERN:
 * ------------------------
 * ❌ WRONG (vulnerable):
 * const product = await db.query('SELECT * FROM user_products WHERE id = $1', [productId]);
 *
 * ✅ RIGHT (secure):
 * const userId = c.get('userId');
 * const product = await db.query(
 *   'SELECT * FROM user_products WHERE id = $1 AND user_id = $2',
 *   [productId, userId]
 * );
 * if (!product.rows[0]) {
 *   return notFound(c, ErrorCodes.NOT_FOUND, ErrorMessages.PRODUCT_NOT_FOUND);
 * }
 */
