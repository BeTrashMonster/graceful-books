/**
 * API routes for sync relay
 *
 * CRITICAL: All payloads are encrypted end-to-end.
 * Server has ZERO KNOWLEDGE of actual data.
 *
 * Requirements:
 * - ARCH-001: Zero-knowledge encryption
 * - ARCH-003: Sync infrastructure
 * - H8: Sync Relay - Hosted [MVP]
 */

import { Hono } from 'hono';
import type {
  Env,
  SyncPushRequest,
  SyncPushResponse,
  SyncPullRequest,
  SyncPullResponse,
  HealthResponse,
  ErrorResponse,
  ErrorCode,
  RegionInfo,
} from './types';
import {
  storeChanges,
  getChangesSince,
  getSLAMetrics,
  recordHealthCheck,
} from './database';
import { validateProtocol } from './middleware';

const SYNC_PROTOCOL_VERSION = '1.0.0';

/**
 * Create sync routes
 */
export function createSyncRoutes() {
  const app = new Hono<{ Bindings: Env }>();

  /**
   * Health check endpoint
   */
  app.get('/health', async c => {
    const env = c.env;
    const region = c.req.header('CF-Ray')?.split('-')[1] || 'unknown';
    const startTime = Date.now();

    try {
      // Test database connection
      const dbStart = Date.now();
      await env.DB.prepare('SELECT 1').first();
      const dbLatency = Date.now() - dbStart;

      const response: HealthResponse = {
        status: 'ok',
        timestamp: Date.now(),
        region,
        version: SYNC_PROTOCOL_VERSION,
        database: {
          status: 'ok',
          latency_ms: dbLatency,
        },
        uptime_seconds: Math.floor(startTime / 1000),
      };

      // Record health check
      c.executionCtx.waitUntil(
        recordHealthCheck(env, region, 'ok', dbLatency)
      );

      return c.json(response);
    } catch (error) {
      const response: HealthResponse = {
        status: 'error',
        timestamp: Date.now(),
        region,
        version: SYNC_PROTOCOL_VERSION,
        database: {
          status: 'error',
        },
        uptime_seconds: Math.floor(startTime / 1000),
      };

      c.executionCtx.waitUntil(recordHealthCheck(env, region, 'error'));

      return c.json(response, 503);
    }
  });

  /**
   * Push changes endpoint
   *
   * Accepts encrypted changes from client and stores them.
   * Server NEVER decrypts the payloads.
   */
  app.post('/sync/push', validateProtocol, async c => {
    const env = c.env;

    try {
      const request: SyncPushRequest = await c.req.json();

      // Validate request
      if (!request.device_id || !Array.isArray(request.changes)) {
        const error: ErrorResponse = {
          error: {
            code: 'INVALID_REQUEST' as ErrorCode,
            message: 'Invalid push request',
            details: {
              required: ['device_id', 'changes'],
            },
          },
          timestamp: Date.now(),
        };
        return c.json(error, 400);
      }

      // TODO: Extract user_id from authentication token
      // For MVP, use device_id as user_id (single-user mode)
      const userId = request.device_id;

      // Store changes (encrypted payloads stored as-is)
      const { accepted, rejected } = await storeChanges(
        env,
        userId,
        request.device_id,
        request.changes
      );

      const response: SyncPushResponse = {
        protocol_version: SYNC_PROTOCOL_VERSION,
        success: rejected.length === 0,
        accepted,
        rejected,
        timestamp: Date.now(),
      };

      return c.json(response);
    } catch (error) {
      console.error('Push error:', error);

      const errorResponse: ErrorResponse = {
        error: {
          code: 'DATABASE_ERROR' as ErrorCode,
          message: 'Failed to store changes',
          details:
            env.ENVIRONMENT === 'development'
              ? { error: error instanceof Error ? error.message : 'Unknown' }
              : undefined,
        },
        timestamp: Date.now(),
      };

      return c.json(errorResponse, 500);
    }
  });

  /**
   * Pull changes endpoint
   *
   * Returns encrypted changes for client to decrypt.
   * Server NEVER decrypts the payloads.
   */
  app.post('/sync/pull', validateProtocol, async c => {
    const env = c.env;

    try {
      const request: SyncPullRequest = await c.req.json();

      // Validate request
      if (!request.device_id || typeof request.since_timestamp !== 'number') {
        const error: ErrorResponse = {
          error: {
            code: 'INVALID_REQUEST' as ErrorCode,
            message: 'Invalid pull request',
            details: {
              required: ['device_id', 'since_timestamp'],
            },
          },
          timestamp: Date.now(),
        };
        return c.json(error, 400);
      }

      // TODO: Extract user_id from authentication token
      const userId = request.device_id;

      // Get changes since timestamp
      const changes = await getChangesSince(
        env,
        userId,
        request.device_id,
        request.since_timestamp,
        100 // Max 100 changes per pull
      );

      const response: SyncPullResponse = {
        protocol_version: SYNC_PROTOCOL_VERSION,
        changes, // Changes are still encrypted
        has_more: changes.length === 100,
        timestamp: Date.now(),
      };

      return c.json(response);
    } catch (error) {
      console.error('Pull error:', error);

      const errorResponse: ErrorResponse = {
        error: {
          code: 'DATABASE_ERROR' as ErrorCode,
          message: 'Failed to retrieve changes',
          details:
            env.ENVIRONMENT === 'development'
              ? { error: error instanceof Error ? error.message : 'Unknown' }
              : undefined,
        },
        timestamp: Date.now(),
      };

      return c.json(errorResponse, 500);
    }
  });

  /**
   * SLA metrics endpoint
   */
  app.get('/metrics/sla', async c => {
    const env = c.env;

    try {
      // Get metrics for last 24 hours
      const endTime = Date.now();
      const startTime = endTime - 24 * 60 * 60 * 1000;

      const metrics = await getSLAMetrics(env, startTime, endTime);

      return c.json({
        ...metrics,
        period_start: startTime,
        period_end: endTime,
      });
    } catch (error) {
      console.error('SLA metrics error:', error);

      const errorResponse: ErrorResponse = {
        error: {
          code: 'DATABASE_ERROR' as ErrorCode,
          message: 'Failed to retrieve SLA metrics',
        },
        timestamp: Date.now(),
      };

      return c.json(errorResponse, 500);
    }
  });

  /**
   * Regions endpoint
   *
   * Returns available sync regions with status
   */
  app.get('/regions', async c => {
    const regions: RegionInfo[] = [
      {
        id: 'us',
        name: 'United States',
        location: 'North America',
        endpoint: 'https://sync-us.gracefulbooks.com',
        status: 'online',
      },
      {
        id: 'eu',
        name: 'Europe',
        location: 'Europe',
        endpoint: 'https://sync-eu.gracefulbooks.com',
        status: 'online',
      },
      {
        id: 'ap',
        name: 'Asia Pacific',
        location: 'Asia Pacific',
        endpoint: 'https://sync-ap.gracefulbooks.com',
        status: 'online',
      },
    ];

    return c.json({ regions, timestamp: Date.now() });
  });

  /**
   * Version endpoint
   */
  app.get('/version', c => {
    return c.json({
      protocol_version: SYNC_PROTOCOL_VERSION,
      server_version: '1.0.0',
      environment: c.env.ENVIRONMENT || 'unknown',
      timestamp: Date.now(),
    });
  });

  /**
   * Root endpoint
   */
  app.get('/', c => {
    return c.json({
      service: 'Graceful Books Sync Relay',
      version: SYNC_PROTOCOL_VERSION,
      status: 'online',
      endpoints: {
        health: '/health',
        push: '/sync/push',
        pull: '/sync/pull',
        regions: '/regions',
        version: '/version',
        metrics: '/metrics/sla',
      },
      timestamp: Date.now(),
    });
  });

  return app;
}
