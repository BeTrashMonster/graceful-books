/**
 * Type definitions for Graceful Books Sync Relay
 *
 * Requirements:
 * - ARCH-003: Sync infrastructure
 * - ARCH-001: Zero-knowledge encryption
 * - H8: Sync Relay - Hosted [MVP]
 */

/**
 * Cloudflare Workers environment bindings
 */
export interface Env {
  // D1 Database binding (Turso compatible)
  DB: D1Database;

  // KV namespace for rate limiting
  RATE_LIMIT: KVNamespace;

  // Analytics Engine for SLA tracking
  ANALYTICS: AnalyticsEngineDataset;

  // Durable Object binding for WebSocket sessions
  SYNC_SESSIONS: DurableObjectNamespace;

  // Environment variables
  ENVIRONMENT: string;
  TURSO_DATABASE_URL?: string;
  TURSO_AUTH_TOKEN?: string;
  MAX_REQUESTS_PER_MINUTE?: string;
  MAX_PAYLOAD_SIZE_MB?: string;
  SLA_TARGET_UPTIME?: string;
  SLA_ALERT_WEBHOOK?: string;
}

/**
 * Sync protocol version (must match client)
 */
export const SYNC_PROTOCOL_VERSION = '1.0.0';

/**
 * Sync change - encrypted data from client
 */
export interface SyncChange {
  id: string;
  entity_type: string;
  entity_id: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  encrypted_payload: string; // Base64 encoded encrypted data
  version_vector: Record<string, number>;
  timestamp: number;
  device_id?: string;
}

/**
 * Push request from client
 */
export interface SyncPushRequest {
  protocol_version: string;
  device_id: string;
  timestamp: number;
  changes: SyncChange[];
}

/**
 * Push response to client
 */
export interface SyncPushResponse {
  protocol_version: string;
  success: boolean;
  accepted: string[];
  rejected: Array<{
    id: string;
    reason: string;
  }>;
  timestamp: number;
}

/**
 * Pull request from client
 */
export interface SyncPullRequest {
  protocol_version: string;
  device_id: string;
  since_timestamp: number;
  sync_vector: Record<string, number>;
}

/**
 * Pull response to client
 */
export interface SyncPullResponse {
  protocol_version: string;
  changes: SyncChange[];
  has_more: boolean;
  timestamp: number;
}

/**
 * Health check response
 */
export interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  timestamp: number;
  region: string;
  version: string;
  database: {
    status: 'ok' | 'error';
    latency_ms?: number;
  };
  uptime_seconds: number;
}

/**
 * SLA metrics
 */
export interface SLAMetrics {
  uptime_percentage: number;
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  avg_response_time_ms: number;
  p95_response_time_ms: number;
  p99_response_time_ms: number;
  period_start: number;
  period_end: number;
}

/**
 * Region information
 */
export interface RegionInfo {
  id: string;
  name: string;
  location: string;
  endpoint: string;
  status: 'online' | 'offline' | 'degraded';
  latency_ms?: number;
}

/**
 * Database stored change record
 */
export interface StoredChange {
  id: string;
  user_id: string;
  device_id: string;
  entity_type: string;
  entity_id: string;
  operation: string;
  encrypted_payload: string; // Never decrypted by server
  version_vector: string; // JSON string
  timestamp: number;
  created_at: number;
}

/**
 * Rate limit info
 */
export interface RateLimitInfo {
  requests: number;
  window_start: number;
  limit: number;
  remaining: number;
  reset_at: number;
}

/**
 * Error codes
 */
export enum ErrorCode {
  INVALID_REQUEST = 'INVALID_REQUEST',
  PROTOCOL_MISMATCH = 'PROTOCOL_MISMATCH',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  PAYLOAD_TOO_LARGE = 'PAYLOAD_TOO_LARGE',
  DATABASE_ERROR = 'DATABASE_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

/**
 * Error response
 */
export interface ErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
  timestamp: number;
}
