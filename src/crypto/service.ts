/**
 * Encryption Service Interface
 *
 * Defines the contract for encryption services used by the data layer.
 * This interface allows different encryption implementations to be used
 * interchangeably (e.g., for testing or different encryption backends).
 */

import type { MasterKey, DerivedKey, EncryptedData } from './types'
import { encrypt, decrypt, encryptObject, decryptObject } from './encryption'

/**
 * Encryption service interface
 *
 * All data layer modules use this interface for encryption operations.
 */
export interface IEncryptionService {
  /**
   * Encrypt a string value
   *
   * @param plaintext - Value to encrypt
   * @returns Encrypted data or throws on error
   */
  encrypt(plaintext: string): Promise<string>

  /**
   * Decrypt a string value
   *
   * @param ciphertext - Encrypted value (serialized)
   * @returns Decrypted plaintext or throws on error
   */
  decrypt(ciphertext: string): Promise<string>

  /**
   * Encrypt an object
   *
   * @param obj - Object to encrypt
   * @returns Serialized encrypted data
   */
  encryptObject<T>(obj: T): Promise<string>

  /**
   * Decrypt to an object
   *
   * @param ciphertext - Serialized encrypted data
   * @returns Decrypted object
   */
  decryptObject<T>(ciphertext: string): Promise<T>

  /**
   * Check if encryption is available
   */
  isReady(): boolean
}

/**
 * Context passed to data layer operations for encryption
 */
export interface EncryptionContext {
  encryptionService?: IEncryptionService
}

/**
 * Create an encryption service with the given key
 *
 * @param key - Master or derived key for encryption
 * @returns Encryption service instance
 */
export function createEncryptionService(
  key: MasterKey | DerivedKey
): IEncryptionService {
  return new EncryptionServiceImpl(key)
}

/**
 * Implementation of IEncryptionService
 */
class EncryptionServiceImpl implements IEncryptionService {
  private key: MasterKey | DerivedKey

  constructor(key: MasterKey | DerivedKey) {
    this.key = key
  }

  async encrypt(plaintext: string): Promise<string> {
    const result = await encrypt(plaintext, this.key)
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Encryption failed')
    }
    return this.serializeEncryptedData(result.data)
  }

  async decrypt(ciphertext: string): Promise<string> {
    const encryptedData = this.deserializeEncryptedData(ciphertext)
    const result = await decrypt(encryptedData, this.key)
    if (!result.success || result.data === undefined) {
      throw new Error(result.error || 'Decryption failed')
    }
    return result.data
  }

  async encryptObject<T>(obj: T): Promise<string> {
    const result = await encryptObject(obj, this.key)
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Encryption failed')
    }
    return this.serializeEncryptedData(result.data)
  }

  async decryptObject<T>(ciphertext: string): Promise<T> {
    const encryptedData = this.deserializeEncryptedData(ciphertext)
    const result = await decryptObject<T>(encryptedData, this.key)
    if (!result.success || result.data === undefined) {
      throw new Error(result.error || 'Decryption failed')
    }
    return result.data
  }

  isReady(): boolean {
    return !!this.key && !!this.key.keyMaterial
  }

  private serializeEncryptedData(data: EncryptedData): string {
    return JSON.stringify({
      c: this.bytesToBase64(data.ciphertext),
      i: this.bytesToBase64(data.iv),
      t: this.bytesToBase64(data.authTag),
      k: data.keyId,
      a: data.algorithm,
      e: data.encryptedAt,
    })
  }

  private deserializeEncryptedData(serialized: string): EncryptedData {
    const parsed = JSON.parse(serialized)
    return {
      ciphertext: this.base64ToBytes(parsed.c),
      iv: this.base64ToBytes(parsed.i),
      authTag: this.base64ToBytes(parsed.t),
      keyId: parsed.k,
      algorithm: parsed.a,
      encryptedAt: parsed.e,
    }
  }

  private bytesToBase64(bytes: Uint8Array): string {
    const binaryString = Array.from(bytes)
      .map((byte) => String.fromCharCode(byte))
      .join('')
    return btoa(binaryString)
  }

  private base64ToBytes(base64: string): Uint8Array {
    const binaryString = atob(base64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes
  }
}

/**
 * No-op encryption service for testing or unencrypted storage
 */
export class NoOpEncryptionService implements IEncryptionService {
  async encrypt(plaintext: string): Promise<string> {
    return plaintext
  }

  async decrypt(ciphertext: string): Promise<string> {
    return ciphertext
  }

  async encryptObject<T>(obj: T): Promise<string> {
    return JSON.stringify(obj)
  }

  async decryptObject<T>(ciphertext: string): Promise<T> {
    return JSON.parse(ciphertext)
  }

  isReady(): boolean {
    return true
  }
}
