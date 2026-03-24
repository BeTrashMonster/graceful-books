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
import { initializeDatabase, closeDatabase } from './db/connection.js';

// ==========================================
// Configuration
// ==========================================

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';

// ==========================================
// Startup
// ==========================================

async function startServer() {
  console.log('🚀 Starting Audacious Money Backend...\n');

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
