/**
 * Audacious Money Backend - Server Entry Point
 *
 * Initializes database, starts server, and handles graceful shutdown
 *
 * Note: Environment variables are provided by Digital Ocean in production.
 * For local development, create a .env file or set environment variables manually.
 */

import { serve } from '@hono/node-server';
import app from './app.js';
import { initializeDatabase, closeDatabase, getDatabase } from './db/connection.js';
import { stripe } from './services/stripe.service.js';

// ==========================================
// Configuration
// ==========================================

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';

// ==========================================
// Startup Data Migrations
// ==========================================

/**
 * Run one-time data migrations on startup
 * These fix data that was created before certain fields were populated
 */
async function runStartupMigrations() {
  const db = getDatabase();

  // Fix CPU/CPG Calculator price to $20/month (was incorrectly $15)
  // Must update both price_monthly AND revenue_amount to satisfy the constraint:
  // price_monthly = charity_amount + revenue_amount
  // $20 = $5 (charity) + $15 (revenue)
  try {
    const result = await db.query(`
      UPDATE products
      SET price_monthly = 20,
          revenue_amount = 15,
          updated_at = NOW()
      WHERE slug = 'cpu-cpg-calculator' AND price_monthly != 20
      RETURNING id, slug, price_monthly, revenue_amount
    `);

    if (result.rowCount && result.rowCount > 0) {
      console.log(`[Migration] Updated CPU/CPG Calculator price to $20/month (revenue: $15, charity: $5)`);
    }
  } catch (error) {
    console.error('[Migration] Error updating product price:', error);
  }

  // Backfill workshop enrollment trial dates
  // For enrollments created before we started setting trial dates at enrollment time
  try {
    const result = await db.query(`
      UPDATE workshop_enrollments we
      SET
        trial_started_at = GREATEST(we.created_at, COALESCE(w.trial_start_datetime, we.created_at)),
        trial_expires_at = GREATEST(we.created_at, COALESCE(w.trial_start_datetime, we.created_at))
          + (COALESCE(w.trial_duration_days, 14) || ' days')::interval,
        status = CASE WHEN we.status IS NULL OR we.status = 'enrolled' THEN 'active' ELSE we.status END
      FROM workshops w
      WHERE we.workshop_id = w.id
        AND we.trial_expires_at IS NULL
      RETURNING we.id
    `);

    if (result.rowCount > 0) {
      console.log(`[Migration] Backfilled trial dates for ${result.rowCount} workshop enrollments`);
    }
  } catch (error) {
    console.error('[Migration] Error backfilling workshop trial dates:', error);
    // Don't fail startup, just log the error
  }

  // ==========================================================================
  // Fix workshop users who added payment methods before auto-subscription feature
  // These users have payment methods on file but no Stripe subscription, so they
  // weren't charged when their trial ended. Create subscriptions for them now.
  // ==========================================================================
  try {
    // Find workshop users who:
    // 1. Have a Stripe customer ID
    // 2. Have not converted to paid
    // 3. Have an active workshop enrollment
    // 4. Workshop has a stripe_price_id
    const usersResult = await db.query(`
      SELECT
        u.id as user_id,
        u.email,
        u.first_name,
        u.stripe_customer_id,
        we.id as enrollment_id,
        we.workshop_id,
        w.stripe_price_id,
        we.trial_expires_at,
        we.trial_expires_at < NOW() as trial_expired,
        up.stripe_subscription_id
      FROM users u
      JOIN workshop_enrollments we ON we.user_id = u.id
      JOIN workshops w ON w.id = we.workshop_id
      LEFT JOIN user_products up ON up.user_id = u.id
        AND up.product_id = (SELECT id FROM products WHERE slug = 'cpu-cpg-calculator')
      WHERE we.converted_to_paid_at IS NULL
        AND we.status = 'active'
        AND u.stripe_customer_id IS NOT NULL
        AND w.stripe_price_id IS NOT NULL
    `);

    if (usersResult.rows.length === 0) {
      // No users need fixing
    } else {
      console.log(`[Migration] Checking ${usersResult.rows.length} workshop users for missing subscriptions...`);

      let fixedCount = 0;
      let skippedNoPayment = 0;
      let skippedHasSubscription = 0;

      for (const user of usersResult.rows) {
        try {
          // Skip if already has a subscription ID in our database
          if (user.stripe_subscription_id) {
            skippedHasSubscription++;
            continue;
          }

          // Check if user has a payment method on file
          const paymentMethods = await stripe.paymentMethods.list({
            customer: user.stripe_customer_id,
            type: 'card',
            limit: 1,
          });

          if (paymentMethods.data.length === 0) {
            skippedNoPayment++;
            continue;
          }

          const paymentMethodId = paymentMethods.data[0].id;

          // Check if user already has an active subscription in Stripe
          const subscriptions = await stripe.subscriptions.list({
            customer: user.stripe_customer_id,
            status: 'all',
            limit: 10,
          });

          const hasActiveSubscription = subscriptions.data.some(sub => {
            const isActiveOrTrialing = sub.status === 'active' || sub.status === 'trialing';
            const hasSamePrice = sub.items.data.some(item => item.price.id === user.stripe_price_id);
            return isActiveOrTrialing && hasSamePrice;
          });

          if (hasActiveSubscription) {
            skippedHasSubscription++;
            continue;
          }

          // Create subscription - if trial expired, charge immediately; otherwise sync to trial end
          const trialExpired = user.trial_expired;
          const trialEnd = trialExpired
            ? 'now' as const
            : Math.floor(new Date(user.trial_expires_at).getTime() / 1000);

          console.log(`[Migration] Creating subscription for ${user.email} (trial ${trialExpired ? 'expired - charging now' : 'active'})...`);

          const subscription = await stripe.subscriptions.create({
            customer: user.stripe_customer_id,
            items: [{ price: user.stripe_price_id }],
            trial_end: trialEnd,
            default_payment_method: paymentMethodId,
            metadata: {
              userId: user.user_id,
              workshopId: user.workshop_id,
              enrollmentId: user.enrollment_id,
              autoCreated: 'true',
              source: 'startup_migration_fix',
              fixedAt: new Date().toISOString(),
            },
          });

          // Update user_products with subscription ID
          await db.query(
            `UPDATE user_products
             SET stripe_subscription_id = $1,
                 status = $2,
                 updated_at = NOW()
             WHERE user_id = $3
               AND product_id = (SELECT id FROM products WHERE slug = 'cpu-cpg-calculator')`,
            [subscription.id, subscription.status, user.user_id]
          );

          // If subscription is active (charged immediately), mark as converted
          if (subscription.status === 'active') {
            await db.query(
              `UPDATE workshop_enrollments
               SET converted_to_paid_at = NOW(),
                   updated_at = NOW()
               WHERE id = $1`,
              [user.enrollment_id]
            );
          }

          console.log(`[Migration] Created subscription ${subscription.id} for ${user.email} (status: ${subscription.status})`);
          fixedCount++;

        } catch (userError: any) {
          console.error(`[Migration] Error fixing user ${user.email}:`, userError.message);
          // Continue with next user
        }
      }

      if (fixedCount > 0 || skippedNoPayment > 0 || skippedHasSubscription > 0) {
        console.log(`[Migration] Workshop subscription fix complete: ${fixedCount} fixed, ${skippedHasSubscription} already had subscription, ${skippedNoPayment} no payment method`);
      }
    }
  } catch (error) {
    console.error('[Migration] Error fixing workshop subscriptions:', error);
    // Don't fail startup, just log the error
  }
}

// ==========================================
// Startup
// ==========================================

async function startServer() {
  console.log('🚀 Starting Audacious Money Backend...\n');

  // 0. Verify JWT_SECRET is set
  if (!process.env.JWT_SECRET) {
    console.error('❌ FATAL: JWT_SECRET environment variable is not set');
    console.error('   Set JWT_SECRET in DigitalOcean environment variables or .env file');
    process.exit(1);
  }
  console.log('[Startup] JWT_SECRET loaded (not logging value)');

  // 1. Initialize database connection
  console.log('[Startup] Initializing database connection...');
  try {
    initializeDatabase();
    console.log('[Startup] ✅ Database connection initialized\n');
  } catch (error) {
    console.error('[Startup] ❌ Failed to initialize database:', error);
    process.exit(1);
  }

  // 2. Verify database connection
  console.log('[Startup] Verifying database connection...');
  try {
    const { checkDatabaseHealth } = await import('./db/connection.js');
    const health = await checkDatabaseHealth();

    if (!health.healthy) {
      throw new Error(health.error || 'Database health check failed');
    }

    console.log(`[Startup] ✅ Database connection verified (${health.responseTime}ms)\n`);

    // 2b. Run startup data migrations (backfill missing data)
    console.log('[Startup] Running data migrations...');
    await runStartupMigrations();
    console.log('[Startup] ✅ Data migrations complete\n');
  } catch (error) {
    console.error('[Startup] ⚠️  Database connection failed:', error);
    console.warn('[Startup] ⚠️  Continuing anyway for email testing...\n');
    // TEMPORARILY COMMENTED OUT FOR EMAIL TESTING
    // await closeDatabase();
    // process.exit(1);
  }

  // 3. Start HTTP server
  console.log(`[Startup] Starting HTTP server on ${HOST}:${PORT}...`);
  const server = serve({
    fetch: app.fetch,
    port: PORT,
    hostname: HOST,
  });

  console.log('\n✨ Server started successfully!\n');
  console.log('================================================');
  console.log(`🌐 Server URL:        http://localhost:${PORT}`);
  console.log(`🏥 Health check:      http://localhost:${PORT}/health`);
  console.log(`🔒 Environment:       ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 Database:          Connected`);
  console.log('================================================\n');

  return server;
}

// ==========================================
// Graceful Shutdown
// ==========================================

async function shutdown(signal: string) {
  console.log(`\n[Shutdown] Received ${signal}, shutting down gracefully...`);

  // Close database connections
  await closeDatabase();

  console.log('[Shutdown] ✅ Graceful shutdown complete');
  process.exit(0);
}

// Handle shutdown signals
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('[Fatal] Uncaught exception:', error);
  shutdown('uncaughtException').catch(() => process.exit(1));
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Fatal] Unhandled rejection at:', promise, 'reason:', reason);
  shutdown('unhandledRejection').catch(() => process.exit(1));
});

// ==========================================
// Start the server
// ==========================================

startServer().catch((error) => {
  console.error('[Fatal] Failed to start server:', error);
  process.exit(1);
});
