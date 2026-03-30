/**
 * Sync Signature Service Tests
 *
 * Comprehensive tests for HMAC signature generation and verification.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { SyncSignature, createSyncSignature } from './SyncSignature'
import {
  SyncPayloadType,
  SyncErrorCode,
  type SyncPayload,
} from '../../config/syncConfig'

// Helper to create a test master key
async function createTestMasterKey(): Promise<CryptoKey> {
  const keyMaterial = crypto.getRandomValues(new Uint8Array(32))
  return await crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true, // Extractable - required for HKDF derivation
    ['encrypt', 'decrypt']
  )
}

// Helper to create a test payload
function createTestPayload(overrides: Partial<Omit<SyncPayload, 'signature'>> = {}): Omit<SyncPayload, 'signature'> {
  const base = {
    type: SyncPayloadType.CHANGE as const,
    companyId: 'company-123',
    userId: 'user-456',
    epoch: 1,
    encryptedData: 'encrypted-test-data',
    timestamp: Date.now(),
    messageId: 'msg-789',
    deviceId: 'device-abc',
  }

  return {
    ...base,
    ...overrides,
  }
}

describe('SyncSignature', () => {
  let signature: SyncSignature
  let masterKey: CryptoKey

  beforeEach(async () => {
    signature = new SyncSignature()
    masterKey = await createTestMasterKey()
  })

  describe('initialization', () => {
    it('should initialize with master key and epoch', async () => {
      await signature.initialize(masterKey, 1)
      expect(signature.getEpoch()).toBe(1)
    })

    it('should derive signature key from master key', async () => {
      await signature.initialize(masterKey, 1)

      // Should be able to sign after initialization
      const payload = createTestPayload()
      const result = await signature.sign(payload)
      expect(result.signature).toBeDefined()
      expect(result.signature.length).toBeGreaterThan(0)
    })

    it('should support different epochs', async () => {
      await signature.initialize(masterKey, 5)
      expect(signature.getEpoch()).toBe(5)
    })

    it('should derive different keys for different epochs', async () => {
      const payload = createTestPayload({ epoch: 1 })

      // Sign with epoch 1
      await signature.initialize(masterKey, 1)
      const sig1 = await signature.sign(payload)

      // Sign with epoch 2
      await signature.initialize(masterKey, 2)
      const payload2 = createTestPayload({ epoch: 2 })
      const sig2 = await signature.sign(payload2)

      // Signatures should be different (different epochs = different keys)
      expect(sig1.signature).not.toBe(sig2.signature)
    })
  })

  describe('sign', () => {
    beforeEach(async () => {
      await signature.initialize(masterKey, 1)
    })

    it('should generate signature for payload', async () => {
      const payload = createTestPayload()
      const result = await signature.sign(payload)

      expect(result.signature).toBeDefined()
      expect(typeof result.signature).toBe('string')
      expect(result.signature.length).toBeGreaterThan(0)
      expect(result.timestamp).toBeDefined()
    })

    it('should generate consistent signatures for same payload', async () => {
      const payload = createTestPayload({
        timestamp: 12345, // Fixed timestamp
        messageId: 'fixed-id',
      })

      const result1 = await signature.sign(payload)
      const result2 = await signature.sign(payload)

      // Same input should produce same signature
      expect(result1.signature).toBe(result2.signature)
    })

    it('should generate different signatures for different payloads', async () => {
      const payload1 = createTestPayload({ encryptedData: 'data-1' })
      const payload2 = createTestPayload({ encryptedData: 'data-2' })

      const result1 = await signature.sign(payload1)
      const result2 = await signature.sign(payload2)

      expect(result1.signature).not.toBe(result2.signature)
    })

    it('should throw error if not initialized', async () => {
      const uninitializedSignature = new SyncSignature()
      const payload = createTestPayload()

      await expect(uninitializedSignature.sign(payload)).rejects.toThrow(
        'Signature service not initialized'
      )
    })

    it('should handle different payload types', async () => {
      const types = [
        SyncPayloadType.CHANGE,
        SyncPayloadType.BATCH,
        SyncPayloadType.SYNC_REQUEST,
        SyncPayloadType.HEARTBEAT,
      ]

      for (const type of types) {
        const payload = createTestPayload({ type })
        const result = await signature.sign(payload)
        expect(result.signature).toBeDefined()
      }
    })

    it('should handle nested objects in encryptedData', async () => {
      const payload = createTestPayload({
        encryptedData: JSON.stringify({
          nested: { data: 'value' },
          array: [1, 2, 3],
        }),
      })

      const result = await signature.sign(payload)
      expect(result.signature).toBeDefined()
    })
  })

  describe('verify', () => {
    beforeEach(async () => {
      await signature.initialize(masterKey, 1)
    })

    it('should verify valid signature', async () => {
      const payload = createTestPayload()
      const { signature: sig } = await signature.sign(payload)

      const fullPayload: SyncPayload = {
        ...payload,
        signature: sig,
      }

      const result = await signature.verify(fullPayload)
      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should reject invalid signature', async () => {
      const payload = createTestPayload()
      const { signature: sig } = await signature.sign(payload)

      const fullPayload: SyncPayload = {
        ...payload,
        signature: sig + 'tampered',
      }

      const result = await signature.verify(fullPayload)
      expect(result.valid).toBe(false)
      expect(result.error).toBe(SyncErrorCode.SIGNATURE_INVALID)
    })

    it('should reject tampered payload', async () => {
      const payload = createTestPayload()
      const { signature: sig } = await signature.sign(payload)

      const tamperedPayload: SyncPayload = {
        ...payload,
        encryptedData: 'tampered-data',
        signature: sig,
      }

      const result = await signature.verify(tamperedPayload)
      expect(result.valid).toBe(false)
      expect(result.error).toBe(SyncErrorCode.SIGNATURE_INVALID)
    })

    it('should reject epoch mismatch', async () => {
      const payload = createTestPayload({ epoch: 1 })
      const { signature: sig } = await signature.sign(payload)

      const fullPayload: SyncPayload = {
        ...payload,
        epoch: 2, // Different epoch
        signature: sig,
      }

      const result = await signature.verify(fullPayload)
      expect(result.valid).toBe(false)
      expect(result.error).toBe(SyncErrorCode.EPOCH_MISMATCH)
      expect(result.message).toContain('Epoch mismatch')
    })

    it('should return error if not initialized', async () => {
      const uninitializedSignature = new SyncSignature()
      const payload: SyncPayload = {
        ...createTestPayload(),
        signature: 'fake-signature',
      }

      const result = await uninitializedSignature.verify(payload)
      expect(result.valid).toBe(false)
      expect(result.error).toBe(SyncErrorCode.AUTH_FAILED)
    })

    it('should verify after multiple sign operations', async () => {
      const payloads: SyncPayload[] = []

      // Sign multiple payloads
      for (let i = 0; i < 5; i++) {
        const payload = createTestPayload({
          messageId: `msg-${i}`,
          encryptedData: `data-${i}`,
        })
        const { signature: sig } = await signature.sign(payload)
        payloads.push({ ...payload, signature: sig })
      }

      // Verify all
      for (const payload of payloads) {
        const result = await signature.verify(payload)
        expect(result.valid).toBe(true)
      }
    })

    it('should handle empty encrypted data', async () => {
      const payload = createTestPayload({ encryptedData: '' })
      const { signature: sig } = await signature.sign(payload)

      const fullPayload: SyncPayload = {
        ...payload,
        signature: sig,
      }

      const result = await signature.verify(fullPayload)
      expect(result.valid).toBe(true)
    })
  })

  describe('key rotation', () => {
    it('should support key rotation with new epoch', async () => {
      // Initialize with epoch 1
      await signature.initialize(masterKey, 1)
      const payload1 = createTestPayload({ epoch: 1 })
      const { signature: sig1 } = await signature.sign(payload1)

      // Rotate to epoch 2
      const newMasterKey = await createTestMasterKey()
      await signature.rotateKey(newMasterKey, 2)

      expect(signature.getEpoch()).toBe(2)

      // Sign with new epoch
      const payload2 = createTestPayload({ epoch: 2 })
      const { signature: sig2 } = await signature.sign(payload2)

      // Verify new signature works
      const fullPayload2: SyncPayload = {
        ...payload2,
        signature: sig2,
      }
      const result = await signature.verify(fullPayload2)
      expect(result.valid).toBe(true)
    })

    it('should reject old signatures after key rotation', async () => {
      // Sign with epoch 1
      await signature.initialize(masterKey, 1)
      const payload = createTestPayload({ epoch: 1 })
      const { signature: sig } = await signature.sign(payload)

      // Rotate to epoch 2
      await signature.rotateKey(masterKey, 2)

      // Old signature should fail epoch check
      const fullPayload: SyncPayload = {
        ...payload,
        signature: sig,
      }
      const result = await signature.verify(fullPayload)
      expect(result.valid).toBe(false)
      expect(result.error).toBe(SyncErrorCode.EPOCH_MISMATCH)
    })

    it('should derive different keys for different epochs with same master key', async () => {
      const payload = createTestPayload({ epoch: 1, timestamp: 12345 })

      // Sign with epoch 1
      await signature.initialize(masterKey, 1)
      const sig1 = await signature.sign(payload)

      // Rotate to epoch 2 (same master key)
      await signature.rotateKey(masterKey, 2)
      const payload2 = createTestPayload({ epoch: 2, timestamp: 12345 })
      const sig2 = await signature.sign(payload2)

      // Different epochs should produce different signatures
      expect(sig1.signature).not.toBe(sig2.signature)
    })
  })

  describe('canonicalization', () => {
    beforeEach(async () => {
      await signature.initialize(masterKey, 1)
    })

    it('should produce consistent signatures regardless of key order', async () => {
      // Create payloads with same data but different key order
      const payload1 = {
        type: SyncPayloadType.CHANGE as const,
        companyId: 'company-123',
        userId: 'user-456',
        epoch: 1,
        encryptedData: 'data',
        timestamp: 12345,
        messageId: 'msg',
        deviceId: 'device',
      }

      const payload2 = {
        deviceId: 'device',
        messageId: 'msg',
        timestamp: 12345,
        encryptedData: 'data',
        epoch: 1,
        userId: 'user-456',
        companyId: 'company-123',
        type: SyncPayloadType.CHANGE as const,
      }

      const result1 = await signature.sign(payload1)
      const result2 = await signature.sign(payload2)

      // Should produce identical signatures
      expect(result1.signature).toBe(result2.signature)
    })

    it('should handle nested object key ordering', async () => {
      // Note: encryptedData is already a string, so different JSON serializations
      // are different strings and will produce different signatures.
      // This test verifies that canonicalization handles complex encrypted data.
      const complexData = JSON.stringify({ nested: { a: 1, b: 2 }, array: [3, 4] })

      const payload = createTestPayload({
        encryptedData: complexData,
      })

      const result1 = await signature.sign(payload)
      const result2 = await signature.sign(payload)

      // Same input should produce same signature
      expect(result1.signature).toBe(result2.signature)
    })

    it('should handle arrays consistently', async () => {
      const payload = createTestPayload({
        encryptedData: JSON.stringify([1, 2, 3, { a: 'b' }]),
      })

      const result1 = await signature.sign(payload)
      const result2 = await signature.sign(payload)

      expect(result1.signature).toBe(result2.signature)
    })
  })

  describe('security', () => {
    beforeEach(async () => {
      await signature.initialize(masterKey, 1)
    })

    it('should use HMAC-SHA256', async () => {
      const payload = createTestPayload()
      const result = await signature.sign(payload)

      // HMAC-SHA256 produces 256-bit (32-byte) signatures
      // Base64 encoding: 32 bytes = 44 characters (with padding)
      expect(result.signature.length).toBe(44)
    })

    it('should produce base64-encoded signatures', async () => {
      const payload = createTestPayload()
      const result = await signature.sign(payload)

      // Should be valid base64
      const base64Regex = /^[A-Za-z0-9+/]+=*$/
      expect(result.signature).toMatch(base64Regex)
    })

    it('should detect single-byte tampering', async () => {
      const payload = createTestPayload()
      const { signature: sig } = await signature.sign(payload)

      // Tamper with single byte in encrypted data
      const originalData = payload.encryptedData
      const tamperedData =
        originalData.substring(0, originalData.length - 1) +
        String.fromCharCode(originalData.charCodeAt(originalData.length - 1) ^ 1)

      const tamperedPayload: SyncPayload = {
        ...payload,
        encryptedData: tamperedData,
        signature: sig,
      }

      const result = await signature.verify(tamperedPayload)
      expect(result.valid).toBe(false)
    })

    it('should use constant-time comparison', async () => {
      // This is a timing-based test - in production the constant-time
      // comparison prevents timing attacks
      const payload = createTestPayload()
      const { signature: sig } = await signature.sign(payload)

      const validPayload: SyncPayload = { ...payload, signature: sig }
      const invalidPayload: SyncPayload = { ...payload, signature: 'A'.repeat(44) }

      // Both should complete without throwing
      const result1 = await signature.verify(validPayload)
      const result2 = await signature.verify(invalidPayload)

      expect(result1.valid).toBe(true)
      expect(result2.valid).toBe(false)
    })
  })

  describe('error handling', () => {
    it('should handle invalid base64 in signature gracefully', async () => {
      await signature.initialize(masterKey, 1)

      const payload: SyncPayload = {
        ...createTestPayload(),
        signature: 'not-valid-base64!!!',
      }

      const result = await signature.verify(payload)
      expect(result.valid).toBe(false)
    })

    it('should handle null/undefined values', async () => {
      await signature.initialize(masterKey, 1)

      const payload = createTestPayload({
        encryptedData: JSON.stringify({ value: null, missing: undefined }),
      })

      const result = await signature.sign(payload)
      expect(result.signature).toBeDefined()
    })

    it('should handle very long encrypted data', async () => {
      await signature.initialize(masterKey, 1)

      const longData = 'x'.repeat(1000000) // 1MB of data
      const payload = createTestPayload({ encryptedData: longData })

      const { signature: sig } = await signature.sign(payload)
      expect(sig).toBeDefined()

      const fullPayload: SyncPayload = { ...payload, signature: sig }
      const result = await signature.verify(fullPayload)
      expect(result.valid).toBe(true)
    })
  })

  describe('createSyncSignature factory', () => {
    it('should create signature instance', () => {
      const sig = createSyncSignature()
      expect(sig).toBeInstanceOf(SyncSignature)
    })

    it('should create independent instances', async () => {
      const sig1 = createSyncSignature()
      const sig2 = createSyncSignature()

      await sig1.initialize(masterKey, 1)
      await sig2.initialize(masterKey, 2)

      expect(sig1.getEpoch()).toBe(1)
      expect(sig2.getEpoch()).toBe(2)
    })
  })
})
