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
  console.log(`[Startup] JWT_SECRET loaded: ${process.env.JWT_SECRET.substring(0, 8)}...`);

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
