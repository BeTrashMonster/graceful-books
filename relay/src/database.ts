/**
 * Database operations for sync relay
 *
 * CRITICAL: This module stores ONLY encrypted payloads.
 * The server has ZERO knowledge of the actual data.
 *
 * Requirements:
 * - ARCH-001: Zero-knowledge encryption
 * - ARCH-003: Sync infrastructure
 * - H8: Sync Relay - Hosted [MVP]
 */

import type { Env, SyncChange, StoredChange } from './types';

/**
 * Database schema migration
 */
export const SCHEMA = `
-- Sync changes table
-- CRITICAL: encrypted_payload is NEVER decrypted by the server
CREATE TABLE IF NOT EXISTS sync_changes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  encrypted_payload TEXT NOT NULL, -- Zero-knowledge: server cannot read this
  version_vector TEXT NOT NULL, -- JSON string
  timestamp INTEGER NOT NULL,
  created_at INTEGER NOT NULL,

  -- Indexes for efficient queries
  INDEX idx_user_timestamp (user_id, timestamp),
  INDEX idx_user_device (user_id, device_id),
  INDEX idx_entity (entity_type, entity_id)
);

-- SLA metrics table
CREATE TABLE IF NOT EXISTS sla_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_time_ms REAL NOT NULL,
  region TEXT NOT NULL,
  success INTEGER NOT NULL, -- 0 or 1

  INDEX idx_timestamp (timestamp),
  INDEX idx_endpoint (endpoint)
);

-- Health check history
CREATE TABLE IF NOT EXISTS health_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL,
  region TEXT NOT NULL,
  status TEXT NOT NULL,
  database_latency_ms REAL,

  INDEX idx_timestamp (timestamp)
);
`;

/**
 * Initialize database schema
 */
export async function initDatabase(env: Env): Promise<void> {
  try {
    await env.DB.exec(SCHEMA);
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

/**
 * Store sync changes
 *
 * CRITICAL: Payloads are stored encrypted. Server never decrypts.
 */
export async function storeChanges(
  env: Env,
  userId: string,
  deviceId: string,
  changes: SyncChange[]
): Promise<{
  accepted: string[];
  rejected: Array<{ id: string; reason: string }>;
}> {
  const accepted: string[] = [];
  const rejected: Array<{ id: string; reason: string }> = [];
  const now = Date.now();

  // Process each change
  for (const change of changes) {
    try {
      // Validate change
      if (!change.id || !change.entity_type || !change.entity_id) {
        rejected.push({
          id: change.id || 'unknown',
          reason: 'Missing required fields',
        });
        continue;
      }

      // Check for existing change (prevent duplicates)
      const existing = await env.DB.prepare(
        'SELECT id FROM sync_changes WHERE user_id = ? AND entity_type = ? AND entity_id = ? AND timestamp >= ?'
      )
        .bind(userId, change.entity_type, change.entity_id, change.timestamp)
        .first();

      if (existing) {
        rejected.push({
          id: change.id,
          reason: 'Duplicate or outdated change',
        });
        continue;
      }

      // Store the change (encrypted payload is never touched)
      await env.DB.prepare(
        `INSERT INTO sync_changes
         (id, user_id, device_id, entity_type, entity_id, operation, encrypted_payload, version_vector, timestamp, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          change.id,
          userId,
          deviceId,
          change.entity_type,
          change.entity_id,
          change.operation,
          change.encrypted_payload, // Stored as-is, never decrypted
          JSON.stringify(change.version_vector),
          change.timestamp,
          now
        )
        .run();

      accepted.push(change.id);
    } catch (error) {
      console.error(`Failed to store change ${change.id}:`, error);
      rejected.push({
        id: change.id,
        reason: 'Database error',
      });
    }
  }

  return { accepted, rejected };
}

/**
 * Retrieve changes since timestamp
 *
 * Returns encrypted payloads without decryption.
 */
export async function getChangesSince(
  env: Env,
  userId: string,
  deviceId: string,
  sinceTimestamp: number,
  limit: number = 100
): Promise<SyncChange[]> {
  try {
    const results = await env.DB.prepare(
      `SELECT * FROM sync_changes
       WHERE user_id = ? AND device_id != ? AND timestamp > ?
       ORDER BY timestamp ASC
       LIMIT ?`
    )
      .bind(userId, deviceId, sinceTimestamp, limit)
      .all<StoredChange>();

    if (!results.results) {
      return [];
    }

    // Convert stored changes to sync changes
    return results.results.map(row => ({
      id: row.id,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      operation: row.operation as 'CREATE' | 'UPDATE' | 'DELETE',
      encrypted_payload: row.encrypted_payload, // Still encrypted
      version_vector: JSON.parse(row.version_vector),
      timestamp: row.timestamp,
      device_id: row.device_id,
    }));
  } catch (error) {
    console.error('Failed to retrieve changes:', error);
    throw error;
  }
}

/**
 * Record SLA metric
 */
export async function recordSLAMetric(
  env: Env,
  endpoint: string,
  method: string,
  statusCode: number,
  responseTimeMs: number,
  region: string,
  success: boolean
): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO sla_metrics
       (timestamp, endpoint, method, status_code, response_time_ms, region, success)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        Date.now(),
        endpoint,
        method,
        statusCode,
        responseTimeMs,
        region,
        success ? 1 : 0
      )
      .run();

    // Also send to Analytics Engine for real-time monitoring
    env.ANALYTICS.writeDataPoint({
      blobs: [endpoint, method, region],
      doubles: [responseTimeMs],
      indexes: [success ? 'success' : 'failure'],
    });
  } catch (error) {
    console.error('Failed to record SLA metric:', error);
    // Don't throw - metrics recording shouldn't break requests
  }
}

/**
 * Record health check
 */
export async function recordHealthCheck(
  env: Env,
  region: string,
  status: string,
  databaseLatencyMs?: number
): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO health_checks
       (timestamp, region, status, database_latency_ms)
       VALUES (?, ?, ?, ?)`
    )
      .bind(Date.now(), region, status, databaseLatencyMs || null)
      .run();
  } catch (error) {
    console.error('Failed to record health check:', error);
  }
}

/**
 * Get SLA metrics for period
 */
export async function getSLAMetrics(
  env: Env,
  startTimestamp: number,
  endTimestamp: number
): Promise<{
  uptime_percentage: number;
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  avg_response_time_ms: number;
}> {
  try {
    const result = await env.DB.prepare(
      `SELECT
         COUNT(*) as total_requests,
         SUM(success) as successful_requests,
         AVG(response_time_ms) as avg_response_time_ms
       FROM sla_metrics
       WHERE timestamp >= ? AND timestamp <= ?`
    )
      .bind(startTimestamp, endTimestamp)
      .first<{
        total_requests: number;
        successful_requests: number;
        avg_response_time_ms: number;
      }>();

    if (!result) {
      return {
        uptime_percentage: 100,
        total_requests: 0,
        successful_requests: 0,
        failed_requests: 0,
        avg_response_time_ms: 0,
      };
    }

    const totalRequests = result.total_requests || 0;
    const successfulRequests = result.successful_requests || 0;
    const failedRequests = totalRequests - successfulRequests;
    const uptimePercentage =
      totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 100;

    return {
      uptime_percentage: uptimePercentage,
      total_requests: totalRequests,
      successful_requests: successfulRequests,
      failed_requests: failedRequests,
      avg_response_time_ms: result.avg_response_time_ms || 0,
    };
  } catch (error) {
    console.error('Failed to get SLA metrics:', error);
    throw error;
  }
}

/**
 * Clean up old changes (retention policy)
 *
 * Keep changes for 30 days, then delete
 */
export async function cleanupOldChanges(env: Env): Promise<number> {
  try {
    const retentionDays = 30;
    const cutoffTimestamp = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

    const result = await env.DB.prepare(
      'DELETE FROM sync_changes WHERE created_at < ?'
    )
      .bind(cutoffTimestamp)
      .run();

    return result.meta.changes || 0;
  } catch (error) {
    console.error('Failed to cleanup old changes:', error);
    throw error;
  }
}
