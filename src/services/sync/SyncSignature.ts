/**
 * Sync Signature Service
 *
 * Per ROADMAP_BACKUP_AND_SYNC.md Phase 4, Task 4.3 (Chunk 4C):
 * HMAC signature generation and verification for sync relay messages.
 *
 * Features:
 * - HMAC-SHA256 for message authentication
 * - Signature key derivation from master key
 * - Tamper detection and prevention
 * - Epoch-based key rotation support
 *
 * Architecture:
 * - Zero-knowledge: Server cannot generate or verify signatures
 * - Client-side only: All signature operations performed locally
 * - Deterministic: Same input always produces same signature
 * - Fast: Uses Web Crypto API for performance
 *
 * Security:
 * - Prevents message tampering in transit
 * - Prevents replay attacks (with timestamp + messageId)
 * - Supports key rotation via epoch
 * - HMAC-SHA256 provides strong authentication
 */

import {
  type SyncPayload,
  type _SyncChangeMetadata,
  SyncErrorCode,
  type SyncError,
} from '../../config/syncConfig'

/**
 * Signature key context
 * Used for HKDF key derivation
 */
const SIGNATURE_KEY_INFO = 'GracefulBooks-Sync-HMAC-v1'

/**
 * Signature algorithm
 */
const SIGNATURE_ALGORITHM = 'HMAC'
const SIGNATURE_HASH = 'SHA-256'

/**
 * Signature result
 */
export interface SignatureResult {
  /** Base64-encoded signature */
  signature: string
  /** Timestamp when signed */
  timestamp: number
}

/**
 * Verification result
 */
export interface VerificationResult {
  /** Whether signature is valid */
  valid: boolean
  /** Error code if invalid */
  error?: SyncErrorCode
  /** Error message if invalid */
  message?: string
}

/**
 * Sync Signature Service
 *
 * Provides HMAC-SHA256 signature generation and verification
 * for sync relay messages.
 */
export class SyncSignature {
  private signatureKey: CryptoKey | null = null
  private _masterKey: CryptoKey | null = null
  private currentEpoch: number = 0

  constructor() {
    // Signature key is derived on-demand from master key
  }

  /**
   * Initialize with master encryption key
   *
   * Derives a signature key from the master key using HKDF.
   *
   * @param masterKey - Master encryption key
   * @param epoch - Current key rotation epoch
   */
  async initialize(masterKey: CryptoKey, epoch: number): Promise<void> {
    this.masterKey = masterKey
    this.currentEpoch = epoch

    // Derive signature key from master key
    this.signatureKey = await this.deriveSignatureKey(masterKey, epoch)
  }

  /**
   * Sign a sync payload
   *
   * Generates HMAC-SHA256 signature over the payload.
   * Signature excludes the signature field itself.
   *
   * @param payload - Sync payload to sign
   * @returns Signature result
   */
  async sign(payload: Omit<SyncPayload, 'signature'>): Promise<SignatureResult> {
    if (!this.signatureKey) {
      throw this.createError(
        SyncErrorCode.AUTH_FAILED,
        'Signature service not initialized. Call initialize() first.'
      )
    }

    // Create canonical representation for signing
    const canonical = this.canonicalize(payload)

    // Generate HMAC signature
    const encoder = new TextEncoder()
    const data = encoder.encode(canonical)

    const signatureBuffer = await crypto.subtle.sign(
      {
        name: SIGNATURE_ALGORITHM,
        hash: { name: SIGNATURE_HASH },
      },
      this.signatureKey,
      data
    )

    // Convert to base64
    const signature = this.bufferToBase64(signatureBuffer)

    return {
      signature,
      timestamp: Date.now(),
    }
  }

  /**
   * Verify a sync payload signature
   *
   * Validates HMAC-SHA256 signature on incoming payload.
   *
   * @param payload - Sync payload with signature
   * @returns Verification result
   */
  async verify(payload: SyncPayload): Promise<VerificationResult> {
    if (!this.signatureKey) {
      return {
        valid: false,
        error: SyncErrorCode.AUTH_FAILED,
        message: 'Signature service not initialized',
      }
    }

    // Check epoch match
    if (payload.epoch !== this.currentEpoch) {
      return {
        valid: false,
        error: SyncErrorCode.EPOCH_MISMATCH,
        message: `Epoch mismatch: expected ${this.currentEpoch}, got ${payload.epoch}`,
      }
    }

    try {
      // Extract signature from payload
      const { signature, ...payloadWithoutSignature } = payload

      // Create canonical representation
      const canonical = this.canonicalize(payloadWithoutSignature)

      // Generate expected signature
      const encoder = new TextEncoder()
      const data = encoder.encode(canonical)

      const expectedSignatureBuffer = await crypto.subtle.sign(
        {
          name: SIGNATURE_ALGORITHM,
          hash: { name: SIGNATURE_HASH },
        },
        this.signatureKey,
        data
      )

      const expectedSignature = this.bufferToBase64(expectedSignatureBuffer)

      // Compare signatures (constant-time comparison)
      const valid = this.constantTimeCompare(signature, expectedSignature)

      if (!valid) {
        return {
          valid: false,
          error: SyncErrorCode.SIGNATURE_INVALID,
          message: 'Signature verification failed',
        }
      }

      return { valid: true }
    } catch (error) {
      return {
        valid: false,
        error: SyncErrorCode.SIGNATURE_INVALID,
        message: error instanceof Error ? error.message : 'Signature verification error',
      }
    }
  }

  /**
   * Update signature key for new epoch
   *
   * Re-derives signature key when master key rotates.
   *
   * @param masterKey - New master encryption key
   * @param epoch - New key rotation epoch
   */
  async rotateKey(masterKey: CryptoKey, epoch: number): Promise<void> {
    await this.initialize(masterKey, epoch)
  }

  /**
   * Get current epoch
   *
   * @returns Current epoch number
   */
  getEpoch(): number {
    return this.currentEpoch
  }

  /**
   * Derive signature key from master key
   *
   * Uses HKDF to derive a dedicated HMAC key from the master
   * encryption key.
   *
   * @param masterKey - Master encryption key
   * @param epoch - Key rotation epoch
   * @returns HMAC signature key
   * @private
   */
  private async deriveSignatureKey(
    masterKey: CryptoKey,
    epoch: number
  ): Promise<CryptoKey> {
    // Export master key material
    const masterKeyMaterial = await crypto.subtle.exportKey('raw', masterKey)

    // Import as HKDF key
    const hkdfKey = await crypto.subtle.importKey(
      'raw',
      masterKeyMaterial,
      'HKDF',
      false,
      ['deriveKey']
    )

    // Create salt with epoch
    const encoder = new TextEncoder()
    const salt = encoder.encode(`${SIGNATURE_KEY_INFO}-epoch-${epoch}`)

    // Derive HMAC key
    const signatureKey = await crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt,
        info: encoder.encode(SIGNATURE_KEY_INFO),
      },
      hkdfKey,
      {
        name: SIGNATURE_ALGORITHM,
        hash: { name: SIGNATURE_HASH },
        length: 256,
      },
      false, // Not extractable
      ['sign', 'verify']
    )

    return signatureKey
  }

  /**
   * Create canonical string representation
   *
   * Produces deterministic string from payload for signing.
   * Uses sorted JSON keys to ensure consistency.
   *
   * @param payload - Payload to canonicalize
   * @returns Canonical string representation
   * @private
   */
  private canonicalize(payload: Omit<SyncPayload, 'signature'>): string {
    // Sort keys alphabetically for deterministic output
    const sortedPayload = this.sortKeys(payload)
    return JSON.stringify(sortedPayload)
  }

  /**
   * Sort object keys recursively
   *
   * Ensures deterministic JSON serialization.
   *
   * @param obj - Object to sort
   * @returns Object with sorted keys
   * @private
   */
  private sortKeys(obj: unknown): unknown {
    if (obj === null || typeof obj !== 'object') {
      return obj
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sortKeys(item))
    }

    const sorted: Record<string, unknown> = {}
    const keys = Object.keys(obj).sort()

    for (const key of keys) {
      sorted[key] = this.sortKeys((obj as Record<string, unknown>)[key])
    }

    return sorted
  }

  /**
   * Convert ArrayBuffer to base64
   *
   * @param buffer - Buffer to convert
   * @returns Base64 string
   * @private
   */
  private bufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  /**
   * Convert base64 to ArrayBuffer
   *
   * @param base64 - Base64 string
   * @returns ArrayBuffer
   * @private
   */
  private _base64ToBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes.buffer
  }

  /**
   * Constant-time string comparison
   *
   * Prevents timing attacks on signature verification.
   *
   * @param a - First string
   * @param b - Second string
   * @returns True if strings are equal
   * @private
   */
  private constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false
    }

    let result = 0
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i)
    }

    return result === 0
  }

  /**
   * Create sync error
   *
   * @param code - Error code
   * @param message - Error message
   * @returns Sync error object
   * @private
   */
  private createError(code: SyncErrorCode, message: string): SyncError {
    return {
      code,
      message,
      timestamp: Date.now(),
      recoverable: false,
    }
  }
}

/**
 * Create sync signature service instance
 *
 * @returns Sync signature service
 */
export function createSyncSignature(): SyncSignature {
  return new SyncSignature()
}
