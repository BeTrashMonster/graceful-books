/**
 * Sync Relay Configuration
 *
 * Per ROADMAP_BACKUP_AND_SYNC.md Phase 4 (Chunk 4A):
 * Configuration and types for encrypted sync relay system.
 *
 * Architecture:
 * - Zero-knowledge: Server cannot decrypt data
 * - WebSocket-based real-time sync
 * - HMAC signature verification
 * - Epoch-based authorization (instant revocation)
 * - CRDT conflict resolution
 *
 * Features:
 * - Auto-reconnect with exponential backoff
 * - Offline queue
 * - Rate limiting (client and server)
 * - Self-hosted or Audacious-hosted relay options
 *
 * Security:
 * - All payloads encrypted before transmission
 * - HMAC signatures prevent tampering
 * - Epoch verification enables instant access revocation
 * - TLS required for all connections
 */

/**
 * Sync relay configuration
 */
export interface SyncConfig {
  /** Relay server URL (WebSocket) */
  relayUrl: string
  /** Whether to use self-hosted relay */
  selfHosted: boolean
  /** Auto-reconnect on disconnect */
  autoReconnect: boolean
  /** Maximum reconnection attempts (0 = infinite) */
  maxReconnectAttempts: number
  /** Initial reconnection delay in ms */
  reconnectDelayMs: number
  /** Maximum reconnection delay in ms */
  maxReconnectDelayMs: number
  /** Exponential backoff multiplier */
  reconnectBackoffMultiplier: number
  /** Connection timeout in ms */
  connectionTimeoutMs: number
  /** Heartbeat interval in ms */
  heartbeatIntervalMs: number
  /** Maximum payload size in bytes */
  maxPayloadSizeBytes: number
  /** Batch changes for efficiency */
  batchChanges: boolean
  /** Batch delay in ms (wait for more changes) */
  batchDelayMs: number
  /** Maximum batch size */
  maxBatchSize: number
  /** Enable sync (can be toggled by user) */
  enabled: boolean
}

/**
 * Default sync configuration
 * Uses Audacious-hosted relay with sensible defaults
 */
export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  relayUrl: 'wss://sync.audaciousmoney.com',
  selfHosted: false,
  autoReconnect: true,
  maxReconnectAttempts: 0, // Infinite
  reconnectDelayMs: 1000, // 1 second
  maxReconnectDelayMs: 30000, // 30 seconds
  reconnectBackoffMultiplier: 2,
  connectionTimeoutMs: 10000, // 10 seconds
  heartbeatIntervalMs: 30000, // 30 seconds
  maxPayloadSizeBytes: 50 * 1024 * 1024, // 50MB
  batchChanges: true,
  batchDelayMs: 500, // 500ms
  maxBatchSize: 100,
  enabled: false, // User must opt-in
}

/**
 * Self-hosted relay configuration template
 * Users can provide their own relay URL
 */
export const SELF_HOSTED_SYNC_CONFIG: Partial<SyncConfig> = {
  relayUrl: '', // User provides
  selfHosted: true,
  // Other settings inherit from defaults
}

/**
 * WebSocket connection status
 */
export enum SyncConnectionStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  RECONNECTING = 'RECONNECTING',
  ERROR = 'ERROR',
}

/**
 * Sync payload type
 */
export enum SyncPayloadType {
  /** Initial handshake */
  HANDSHAKE = 'HANDSHAKE',
  /** Data change (transaction, account, etc.) */
  CHANGE = 'CHANGE',
  /** Batch of changes */
  BATCH = 'BATCH',
  /** Request full sync */
  SYNC_REQUEST = 'SYNC_REQUEST',
  /** Response to sync request */
  SYNC_RESPONSE = 'SYNC_RESPONSE',
  /** Heartbeat (keep-alive) */
  HEARTBEAT = 'HEARTBEAT',
  /** Acknowledgment */
  ACK = 'ACK',
  /** Error */
  ERROR = 'ERROR',
}

/**
 * Sync operation type
 */
export enum SyncOperationType {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}

/**
 * Encrypted sync payload
 *
 * All data is encrypted client-side before transmission.
 * Server only routes encrypted payloads between devices.
 */
export interface SyncPayload {
  /** Payload type */
  type: SyncPayloadType
  /** Company ID (for routing) */
  companyId: string
  /** User ID (for routing) */
  userId: string
  /** Key rotation epoch (for access revocation) */
  epoch: number
  /** Encrypted data (JSON stringified then encrypted) */
  encryptedData: string
  /** HMAC signature (prevents tampering) */
  signature: string
  /** Timestamp (client-side) */
  timestamp: number
  /** Message ID (for deduplication) */
  messageId: string
  /** Client device ID */
  deviceId: string
}

/**
 * Sync change metadata
 *
 * Included in encrypted payload for conflict resolution.
 */
export interface SyncChangeMetadata {
  /** Operation type */
  operation: SyncOperationType
  /** Entity type (transaction, account, etc.) */
  entityType: string
  /** Entity ID */
  entityId: string
  /** Last modified timestamp */
  lastModified: number
  /** User who made the change */
  modifiedBy: string
  /** Device that made the change */
  deviceId: string
  /** CRDT vector clock (for conflict resolution) */
  vectorClock?: Record<string, number>
}

/**
 * Sync error codes
 */
export enum SyncErrorCode {
  /** Connection failed */
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  /** Authentication failed */
  AUTH_FAILED = 'AUTH_FAILED',
  /** Signature verification failed */
  SIGNATURE_INVALID = 'SIGNATURE_INVALID',
  /** Epoch mismatch (access revoked) */
  EPOCH_MISMATCH = 'EPOCH_MISMATCH',
  /** Rate limit exceeded */
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  /** Payload too large */
  PAYLOAD_TOO_LARGE = 'PAYLOAD_TOO_LARGE',
  /** Server error */
  SERVER_ERROR = 'SERVER_ERROR',
  /** Network error */
  NETWORK_ERROR = 'NETWORK_ERROR',
  /** Unknown error */
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Sync error
 */
export interface SyncError {
  code: SyncErrorCode
  message: string
  details?: unknown
  timestamp: number
  recoverable: boolean
}

/**
 * Sync statistics
 */
export interface SyncStatistics {
  /** Connection status */
  status: SyncConnectionStatus
  /** Last successful sync timestamp */
  lastSyncAt?: number
  /** Total messages sent */
  messagesSent: number
  /** Total messages received */
  messagesReceived: number
  /** Pending messages in queue */
  pendingMessages: number
  /** Current reconnection attempt */
  reconnectAttempt: number
  /** Total bytes sent */
  bytesSent: number
  /** Total bytes received */
  bytesReceived: number
  /** Average latency in ms */
  averageLatencyMs?: number
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  /** Maximum requests per minute */
  maxRequestsPerMinute: number
  /** Maximum concurrent connections */
  maxConcurrentConnections: number
  /** Maximum payload size */
  maxPayloadSize: number
  /** Storage limit per company */
  storageLimitBytes: number
}

/**
 * Client-side rate limits
 * Server may have stricter limits
 */
export const CLIENT_RATE_LIMITS: RateLimitConfig = {
  maxRequestsPerMinute: 100,
  maxConcurrentConnections: 5,
  maxPayloadSize: 50 * 1024 * 1024, // 50MB
  storageLimitBytes: 5 * 1024 * 1024 * 1024, // 5GB
}

/**
 * Validate sync configuration
 *
 * @param config - Configuration to validate
 * @returns Validation result
 */
export function validateSyncConfig(config: Partial<SyncConfig>): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  // Validate relay URL
  if (config.relayUrl !== undefined) {
    if (!config.relayUrl) {
      errors.push('Relay URL is required')
    } else if (!config.relayUrl.startsWith('ws://') && !config.relayUrl.startsWith('wss://')) {
      errors.push('Relay URL must be a WebSocket URL (ws:// or wss://)')
    } else if (!config.relayUrl.startsWith('wss://') && !config.relayUrl.includes('localhost')) {
      errors.push('Production relay URL must use wss:// (TLS required)')
    }
  }

  // Validate numeric values
  if (
    config.reconnectDelayMs !== undefined &&
    (config.reconnectDelayMs < 0 || config.reconnectDelayMs > 60000)
  ) {
    errors.push('Reconnect delay must be between 0 and 60000ms')
  }

  if (
    config.maxReconnectDelayMs !== undefined &&
    (config.maxReconnectDelayMs < 0 || config.maxReconnectDelayMs > 300000)
  ) {
    errors.push('Max reconnect delay must be between 0 and 300000ms')
  }

  if (
    config.connectionTimeoutMs !== undefined &&
    (config.connectionTimeoutMs < 1000 || config.connectionTimeoutMs > 60000)
  ) {
    errors.push('Connection timeout must be between 1000 and 60000ms')
  }

  if (
    config.heartbeatIntervalMs !== undefined &&
    (config.heartbeatIntervalMs < 5000 || config.heartbeatIntervalMs > 120000)
  ) {
    errors.push('Heartbeat interval must be between 5000 and 120000ms')
  }

  if (
    config.maxPayloadSizeBytes !== undefined &&
    (config.maxPayloadSizeBytes < 1024 ||
      config.maxPayloadSizeBytes > CLIENT_RATE_LIMITS.maxPayloadSize)
  ) {
    errors.push(
      `Max payload size must be between 1KB and ${CLIENT_RATE_LIMITS.maxPayloadSize / 1024 / 1024}MB`
    )
  }

  if (
    config.batchDelayMs !== undefined &&
    (config.batchDelayMs < 0 || config.batchDelayMs > 5000)
  ) {
    errors.push('Batch delay must be between 0 and 5000ms')
  }

  if (config.maxBatchSize !== undefined && (config.maxBatchSize < 1 || config.maxBatchSize > 1000)) {
    errors.push('Max batch size must be between 1 and 1000')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Get user-friendly error message for sync error
 *
 * @param error - Sync error
 * @returns User-friendly message
 */
export function getSyncErrorMessage(error: SyncError): string {
  const messages: Record<SyncErrorCode, string> = {
    [SyncErrorCode.CONNECTION_FAILED]:
      'We couldn\'t connect to the sync server. Please check your internet connection and try again.',
    [SyncErrorCode.AUTH_FAILED]:
      'Authentication failed. Please check your credentials and try again.',
    [SyncErrorCode.SIGNATURE_INVALID]:
      'Data verification failed. This might indicate a security issue. Please contact support.',
    [SyncErrorCode.EPOCH_MISMATCH]:
      'Your access has been revoked. If you believe this is an error, please contact your account administrator.',
    [SyncErrorCode.RATE_LIMIT_EXCEEDED]:
      'You\'re syncing too frequently. Please wait a moment and try again.',
    [SyncErrorCode.PAYLOAD_TOO_LARGE]:
      'The data you\'re trying to sync is too large. Please try syncing smaller batches.',
    [SyncErrorCode.SERVER_ERROR]:
      'The sync server encountered an error. We\'re looking into it - please try again in a few minutes.',
    [SyncErrorCode.NETWORK_ERROR]:
      'Network connection interrupted. Your changes are saved locally and will sync when you\'re back online.',
    [SyncErrorCode.UNKNOWN_ERROR]:
      'Something unexpected happened. Your data is safe, but syncing paused. Please try again.',
  }

  return messages[error.code] || error.message
}
