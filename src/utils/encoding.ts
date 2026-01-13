/**
 * Encoding Utilities
 *
 * Centralized base64 and other encoding functions.
 * All modules should use these instead of implementing their own.
 */

/**
 * Encode bytes to base64 string
 *
 * @param bytes - Uint8Array to encode
 * @returns Base64-encoded string
 */
export function bytesToBase64(bytes: Uint8Array): string {
  const binaryString = Array.from(bytes)
    .map((byte) => String.fromCharCode(byte))
    .join('')
  return btoa(binaryString)
}

/**
 * Decode base64 string to bytes
 *
 * @param base64 - Base64-encoded string
 * @returns Decoded Uint8Array
 */
export function base64ToBytes(base64: string): Uint8Array {
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}

/**
 * Encode bytes to URL-safe base64 (no padding)
 *
 * Used for tokens, URLs, and other contexts where standard
 * base64 characters (+, /, =) cause issues.
 *
 * @param bytes - Uint8Array to encode
 * @returns URL-safe base64 string without padding
 */
export function bytesToBase64Url(bytes: Uint8Array): string {
  const base64 = bytesToBase64(bytes)
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

/**
 * Decode URL-safe base64 string to bytes
 *
 * @param base64Url - URL-safe base64 string
 * @returns Decoded Uint8Array
 */
export function base64UrlToBytes(base64Url: string): Uint8Array {
  // Convert URL-safe chars back to standard base64
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')

  // Add padding if needed
  const padding = base64.length % 4
  if (padding) {
    base64 += '='.repeat(4 - padding)
  }

  return base64ToBytes(base64)
}

/**
 * Encode string to base64
 *
 * @param str - String to encode
 * @returns Base64-encoded string
 */
export function stringToBase64(str: string): string {
  const encoder = new TextEncoder()
  return bytesToBase64(encoder.encode(str))
}

/**
 * Decode base64 to string
 *
 * @param base64 - Base64-encoded string
 * @returns Decoded string
 */
export function base64ToString(base64: string): string {
  const bytes = base64ToBytes(base64)
  const decoder = new TextDecoder()
  return decoder.decode(bytes)
}

/**
 * Convert ArrayBuffer to hex string
 *
 * @param buffer - ArrayBuffer to convert
 * @returns Hex string representation
 */
export function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Convert hex string to Uint8Array
 *
 * @param hex - Hex string
 * @returns Uint8Array
 */
export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes
}
