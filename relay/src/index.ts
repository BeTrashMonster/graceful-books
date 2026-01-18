/**
 * Graceful Books Sync Relay Server
 *
 * A zero-knowledge sync relay built on Cloudflare Workers + Hono.
 * Enables multi-device sync while maintaining end-to-end encryption.
 *
 * CRITICAL: Server NEVER has access to plaintext user data.
 * All payloads are encrypted client-side before transmission.
 *
 * Requirements:
 * - ARCH-001: Zero-knowledge encryption
 * - ARCH-003: Sync infrastructure
 * - H8: Sync Relay - Hosted [MVP]
 *
 * Tech Stack:
 * - Cloudflare Workers (edge runtime)
 * - Hono (edge-native web framework)
 * - Turso/D1 (database for encrypted payloads)
 * - WebSockets (real-time sync notifications)
 */

import { Hono } from 'hono';
import type { Env } from './types';
import {
  rateLimiter,
  validateRequestSize,
  cors,
  securityHeaders,
  slaTracking,
  errorHandler,
  requestLogger,
} from './middleware';
import { createSyncRoutes } from './routes';
import { initDatabase } from './database';

/**
 * Create main application
 */
const app = new Hono<{ Bindings: Env }>();

/**
 * Global middleware
 */
app.use('*', errorHandler); // Must be first
app.use('*', requestLogger);
app.use('*', cors);
app.use('*', securityHeaders);
app.use('*', slaTracking);
app.use('*', rateLimiter);
app.use('*', validateRequestSize);

/**
 * Mount sync routes
 */
app.route('/', createSyncRoutes());

/**
 * 404 handler
 */
app.notFound(c => {
  return c.json(
    {
      error: {
        code: 'NOT_FOUND',
        message: 'Endpoint not found',
      },
      timestamp: Date.now(),
    },
    404
  );
});

/**
 * Worker fetch handler
 */
export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    // Initialize database on first request
    ctx.waitUntil(initDatabase(env));

    return app.fetch(request, env, ctx);
  },

  /**
   * Scheduled handler for cleanup tasks
   */
  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    // Run cleanup tasks
    const { cleanupOldChanges } = await import('./database');

    ctx.waitUntil(
      cleanupOldChanges(env).then(deleted => {
        console.log(`Cleaned up ${deleted} old changes`);
      })
    );
  },
};

/**
 * Export types for client usage
 */
export type * from './types';
