/**
 * Sync Configuration Tests
 *
 * Comprehensive tests for sync relay configuration and utilities.
 */

import { describe, it, expect } from 'vitest'
import {
  DEFAULT_SYNC_CONFIG,
  SELF_HOSTED_SYNC_CONFIG,
  CLIENT_RATE_LIMITS,
  SyncConnectionStatus,
  SyncPayloadType,
  SyncOperationType,
  SyncErrorCode,
  validateSyncConfig,
  getSyncErrorMessage,
  type SyncConfig,
  type SyncError,
} from './syncConfig'

describe('syncConfig', () => {
  describe('DEFAULT_SYNC_CONFIG', () => {
    it('should have Audacious-hosted relay URL', () => {
      expect(DEFAULT_SYNC_CONFIG.relayUrl).toBe('wss://sync.audaciousmoney.com')
    })

    it('should not be self-hosted', () => {
      expect(DEFAULT_SYNC_CONFIG.selfHosted).toBe(false)
    })

    it('should enable auto-reconnect', () => {
      expect(DEFAULT_SYNC_CONFIG.autoReconnect).toBe(true)
    })

    it('should have infinite reconnect attempts', () => {
      expect(DEFAULT_SYNC_CONFIG.maxReconnectAttempts).toBe(0)
    })

    it('should be disabled by default (user must opt-in)', () => {
      expect(DEFAULT_SYNC_CONFIG.enabled).toBe(false)
    })

    it('should enable batching by default', () => {
      expect(DEFAULT_SYNC_CONFIG.batchChanges).toBe(true)
    })

    it('should have reasonable timeout values', () => {
      expect(DEFAULT_SYNC_CONFIG.connectionTimeoutMs).toBeGreaterThan(0)
      expect(DEFAULT_SYNC_CONFIG.heartbeatIntervalMs).toBeGreaterThan(0)
    })

    it('should use exponential backoff for reconnections', () => {
      expect(DEFAULT_SYNC_CONFIG.reconnectBackoffMultiplier).toBeGreaterThan(1)
    })
  })

  describe('SELF_HOSTED_SYNC_CONFIG', () => {
    it('should have empty relay URL (user provides)', () => {
      expect(SELF_HOSTED_SYNC_CONFIG.relayUrl).toBe('')
    })

    it('should be marked as self-hosted', () => {
      expect(SELF_HOSTED_SYNC_CONFIG.selfHosted).toBe(true)
    })
  })

  describe('CLIENT_RATE_LIMITS', () => {
    it('should limit requests per minute', () => {
      expect(CLIENT_RATE_LIMITS.maxRequestsPerMinute).toBe(100)
    })

    it('should limit concurrent connections', () => {
      expect(CLIENT_RATE_LIMITS.maxConcurrentConnections).toBe(5)
    })

    it('should have 50MB payload limit', () => {
      expect(CLIENT_RATE_LIMITS.maxPayloadSize).toBe(50 * 1024 * 1024)
    })

    it('should have 5GB storage limit', () => {
      expect(CLIENT_RATE_LIMITS.storageLimitBytes).toBe(5 * 1024 * 1024 * 1024)
    })
  })

  describe('SyncConnectionStatus enum', () => {
    it('should have all expected statuses', () => {
      expect(SyncConnectionStatus.DISCONNECTED).toBe('DISCONNECTED')
      expect(SyncConnectionStatus.CONNECTING).toBe('CONNECTING')
      expect(SyncConnectionStatus.CONNECTED).toBe('CONNECTED')
      expect(SyncConnectionStatus.RECONNECTING).toBe('RECONNECTING')
      expect(SyncConnectionStatus.ERROR).toBe('ERROR')
    })
  })

  describe('SyncPayloadType enum', () => {
    it('should have all expected payload types', () => {
      expect(SyncPayloadType.HANDSHAKE).toBe('HANDSHAKE')
      expect(SyncPayloadType.CHANGE).toBe('CHANGE')
      expect(SyncPayloadType.BATCH).toBe('BATCH')
      expect(SyncPayloadType.SYNC_REQUEST).toBe('SYNC_REQUEST')
      expect(SyncPayloadType.SYNC_RESPONSE).toBe('SYNC_RESPONSE')
      expect(SyncPayloadType.HEARTBEAT).toBe('HEARTBEAT')
      expect(SyncPayloadType.ACK).toBe('ACK')
      expect(SyncPayloadType.ERROR).toBe('ERROR')
    })
  })

  describe('SyncOperationType enum', () => {
    it('should have CRUD operations', () => {
      expect(SyncOperationType.CREATE).toBe('CREATE')
      expect(SyncOperationType.UPDATE).toBe('UPDATE')
      expect(SyncOperationType.DELETE).toBe('DELETE')
    })
  })

  describe('SyncErrorCode enum', () => {
    it('should have all error codes', () => {
      expect(SyncErrorCode.CONNECTION_FAILED).toBe('CONNECTION_FAILED')
      expect(SyncErrorCode.AUTH_FAILED).toBe('AUTH_FAILED')
      expect(SyncErrorCode.SIGNATURE_INVALID).toBe('SIGNATURE_INVALID')
      expect(SyncErrorCode.EPOCH_MISMATCH).toBe('EPOCH_MISMATCH')
      expect(SyncErrorCode.RATE_LIMIT_EXCEEDED).toBe('RATE_LIMIT_EXCEEDED')
      expect(SyncErrorCode.PAYLOAD_TOO_LARGE).toBe('PAYLOAD_TOO_LARGE')
      expect(SyncErrorCode.SERVER_ERROR).toBe('SERVER_ERROR')
      expect(SyncErrorCode.NETWORK_ERROR).toBe('NETWORK_ERROR')
      expect(SyncErrorCode.UNKNOWN_ERROR).toBe('UNKNOWN_ERROR')
    })
  })

  describe('validateSyncConfig', () => {
    describe('relay URL validation', () => {
      it('should accept valid wss:// URL', () => {
        const result = validateSyncConfig({ relayUrl: 'wss://sync.example.com' })
        expect(result.valid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })

      it('should accept ws://localhost for development', () => {
        const result = validateSyncConfig({ relayUrl: 'ws://localhost:3000' })
        expect(result.valid).toBe(true)
      })

      it('should reject empty relay URL', () => {
        const result = validateSyncConfig({ relayUrl: '' })
        expect(result.valid).toBe(false)
        expect(result.errors).toContain('Relay URL is required')
      })

      it('should reject non-WebSocket URL', () => {
        const result = validateSyncConfig({ relayUrl: 'https://example.com' })
        expect(result.valid).toBe(false)
        expect(result.errors[0]).toContain('must be a WebSocket URL')
      })

      it('should reject ws:// for production (require wss://)', () => {
        const result = validateSyncConfig({ relayUrl: 'ws://sync.example.com' })
        expect(result.valid).toBe(false)
        expect(result.errors[0]).toContain('must use wss://')
      })
    })

    describe('numeric value validation', () => {
      it('should reject negative reconnect delay', () => {
        const result = validateSyncConfig({ reconnectDelayMs: -100 })
        expect(result.valid).toBe(false)
        expect(result.errors[0]).toContain('Reconnect delay')
      })

      it('should reject reconnect delay over 60 seconds', () => {
        const result = validateSyncConfig({ reconnectDelayMs: 61000 })
        expect(result.valid).toBe(false)
      })

      it('should accept valid reconnect delay', () => {
        const result = validateSyncConfig({ reconnectDelayMs: 1000 })
        expect(result.valid).toBe(true)
      })

      it('should reject connection timeout under 1 second', () => {
        const result = validateSyncConfig({ connectionTimeoutMs: 500 })
        expect(result.valid).toBe(false)
        expect(result.errors[0]).toContain('Connection timeout')
      })

      it('should reject connection timeout over 60 seconds', () => {
        const result = validateSyncConfig({ connectionTimeoutMs: 61000 })
        expect(result.valid).toBe(false)
      })

      it('should accept valid connection timeout', () => {
        const result = validateSyncConfig({ connectionTimeoutMs: 10000 })
        expect(result.valid).toBe(true)
      })

      it('should reject heartbeat interval under 5 seconds', () => {
        const result = validateSyncConfig({ heartbeatIntervalMs: 4000 })
        expect(result.valid).toBe(false)
        expect(result.errors[0]).toContain('Heartbeat interval')
      })

      it('should reject heartbeat interval over 2 minutes', () => {
        const result = validateSyncConfig({ heartbeatIntervalMs: 121000 })
        expect(result.valid).toBe(false)
      })

      it('should accept valid heartbeat interval', () => {
        const result = validateSyncConfig({ heartbeatIntervalMs: 30000 })
        expect(result.valid).toBe(true)
      })

      it('should reject payload size under 1KB', () => {
        const result = validateSyncConfig({ maxPayloadSizeBytes: 512 })
        expect(result.valid).toBe(false)
        expect(result.errors[0]).toContain('Max payload size')
      })

      it('should reject payload size over 50MB', () => {
        const result = validateSyncConfig({ maxPayloadSizeBytes: 51 * 1024 * 1024 })
        expect(result.valid).toBe(false)
      })

      it('should accept valid payload size', () => {
        const result = validateSyncConfig({ maxPayloadSizeBytes: 10 * 1024 * 1024 })
        expect(result.valid).toBe(true)
      })

      it('should reject negative batch delay', () => {
        const result = validateSyncConfig({ batchDelayMs: -1 })
        expect(result.valid).toBe(false)
        expect(result.errors[0]).toContain('Batch delay')
      })

      it('should reject batch delay over 5 seconds', () => {
        const result = validateSyncConfig({ batchDelayMs: 5001 })
        expect(result.valid).toBe(false)
      })

      it('should accept valid batch delay', () => {
        const result = validateSyncConfig({ batchDelayMs: 500 })
        expect(result.valid).toBe(true)
      })

      it('should reject batch size under 1', () => {
        const result = validateSyncConfig({ maxBatchSize: 0 })
        expect(result.valid).toBe(false)
        expect(result.errors[0]).toContain('Max batch size')
      })

      it('should reject batch size over 1000', () => {
        const result = validateSyncConfig({ maxBatchSize: 1001 })
        expect(result.valid).toBe(false)
      })

      it('should accept valid batch size', () => {
        const result = validateSyncConfig({ maxBatchSize: 100 })
        expect(result.valid).toBe(true)
      })
    })

    describe('multiple errors', () => {
      it('should return all validation errors', () => {
        const result = validateSyncConfig({
          relayUrl: '',
          reconnectDelayMs: -1,
          connectionTimeoutMs: 500,
        })
        expect(result.valid).toBe(false)
        expect(result.errors.length).toBeGreaterThanOrEqual(3)
      })
    })

    describe('valid configurations', () => {
      it('should accept empty config (no validation needed)', () => {
        const result = validateSyncConfig({})
        expect(result.valid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })

      it('should accept complete valid config', () => {
        const config: Partial<SyncConfig> = {
          relayUrl: 'wss://sync.example.com',
          selfHosted: true,
          autoReconnect: true,
          maxReconnectAttempts: 10,
          reconnectDelayMs: 1000,
          maxReconnectDelayMs: 30000,
          reconnectBackoffMultiplier: 2,
          connectionTimeoutMs: 10000,
          heartbeatIntervalMs: 30000,
          maxPayloadSizeBytes: 10 * 1024 * 1024,
          batchChanges: true,
          batchDelayMs: 500,
          maxBatchSize: 100,
          enabled: true,
        }
        const result = validateSyncConfig(config)
        expect(result.valid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })
    })
  })

  describe('getSyncErrorMessage', () => {
    it('should return user-friendly message for CONNECTION_FAILED', () => {
      const error: SyncError = {
        code: SyncErrorCode.CONNECTION_FAILED,
        message: 'Connection failed',
        timestamp: Date.now(),
        recoverable: true,
      }
      const message = getSyncErrorMessage(error)
      expect(message).toContain('couldn\'t connect')
      expect(message).toContain('check your internet connection')
    })

    it('should return user-friendly message for AUTH_FAILED', () => {
      const error: SyncError = {
        code: SyncErrorCode.AUTH_FAILED,
        message: 'Auth failed',
        timestamp: Date.now(),
        recoverable: true,
      }
      const message = getSyncErrorMessage(error)
      expect(message).toContain('Authentication failed')
      expect(message).toContain('credentials')
    })

    it('should return user-friendly message for EPOCH_MISMATCH', () => {
      const error: SyncError = {
        code: SyncErrorCode.EPOCH_MISMATCH,
        message: 'Epoch mismatch',
        timestamp: Date.now(),
        recoverable: false,
      }
      const message = getSyncErrorMessage(error)
      expect(message).toContain('access has been revoked')
    })

    it('should return user-friendly message for RATE_LIMIT_EXCEEDED', () => {
      const error: SyncError = {
        code: SyncErrorCode.RATE_LIMIT_EXCEEDED,
        message: 'Rate limit',
        timestamp: Date.now(),
        recoverable: true,
      }
      const message = getSyncErrorMessage(error)
      expect(message).toContain('syncing too frequently')
      expect(message).toContain('wait a moment')
    })

    it('should return user-friendly message for NETWORK_ERROR', () => {
      const error: SyncError = {
        code: SyncErrorCode.NETWORK_ERROR,
        message: 'Network error',
        timestamp: Date.now(),
        recoverable: true,
      }
      const message = getSyncErrorMessage(error)
      expect(message).toContain('saved locally')
      expect(message).toContain('back online')
    })

    it('should use Steadiness communication style', () => {
      const error: SyncError = {
        code: SyncErrorCode.UNKNOWN_ERROR,
        message: 'Unknown',
        timestamp: Date.now(),
        recoverable: true,
      }
      const message = getSyncErrorMessage(error)
      // Should be reassuring, not blaming
      expect(message).toContain('safe')
      expect(message.toLowerCase()).not.toContain('failed')
      expect(message.toLowerCase()).not.toContain('error')
    })

    it('should fallback to error message if code not found', () => {
      const error: SyncError = {
        code: 'CUSTOM_ERROR' as SyncErrorCode,
        message: 'Custom error message',
        timestamp: Date.now(),
        recoverable: true,
      }
      const message = getSyncErrorMessage(error)
      expect(message).toBe('Custom error message')
    })
  })
})
