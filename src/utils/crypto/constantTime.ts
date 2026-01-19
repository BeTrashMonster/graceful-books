/**
 * Constant-Time Cryptographic Comparison Utilities
 *
 * Implements timing-attack resistant comparison functions for security-sensitive
 * string and byte array comparisons. These functions ensure that comparison
 * time is independent of the data being compared, preventing attackers from
 * inferring information about secret values through timing analysis.
 *
 * IMPORTANT: Always use these functions when comparing:
 * - Cryptographic keys or key IDs
 * - Authentication tokens or signatures
 * - Session identifiers
 * - Password hashes
 * - Any other security-sensitive values
 *
 * @module utils/crypto/constantTime
 */

/**
 * Constant-time string comparison
 *
 * Compares two strings in constant time to prevent timing attacks.
 * The comparison time is determined by the length of the longer string,
 * regardless of where (or if) the strings differ.
 *
 * Algorithm:
 * 1. Encode both strings as UTF-8 byte arrays
 * 2. Pad both arrays to the same length (max of both)
 * 3. XOR each byte pair and accumulate differences
 * 4. Also XOR the original lengths to detect length differences
 * 5. Result is zero only if all bytes AND lengths match
 *
 * @param a - First string to compare
 * @param b - Second string to compare
 * @returns True if strings are equal, false otherwise
 *
 * @example
 * ```typescript
 * // Comparing API tokens (timing-safe)
 * const isValid = constantTimeEqual(providedToken, storedToken);
 *
 * // Comparing key IDs (timing-safe)
 * const keysMatch = constantTimeEqual(derivedKeyId, expectedKeyId);
 * ```
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const bytesA = encoder.encode(a);
  const bytesB = encoder.encode(b);

  return constantTimeEqualBytes(bytesA, bytesB);
}

/**
 * Constant-time byte array comparison
 *
 * Compares two Uint8Array values in constant time to prevent timing attacks.
 * The comparison time is determined by the length of the longer array,
 * regardless of where (or if) the arrays differ.
 *
 * Algorithm:
 * 1. Determine the maximum length of both arrays
 * 2. Create padded arrays of equal length (zero-padded)
 * 3. XOR each byte pair and accumulate differences using OR
 * 4. Also XOR the original lengths to detect length differences
 * 5. Result is zero only if all bytes AND lengths match
 *
 * @param a - First byte array to compare
 * @param b - Second byte array to compare
 * @returns True if byte arrays are equal, false otherwise
 *
 * @example
 * ```typescript
 * // Comparing encryption keys (timing-safe)
 * const keysMatch = constantTimeEqualBytes(derivedKey, storedKey);
 *
 * // Comparing HMAC signatures (timing-safe)
 * const signatureValid = constantTimeEqualBytes(computedHmac, providedHmac);
 * ```
 */
export function constantTimeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  // Get the maximum length to ensure we always iterate the same number of times
  const maxLength = Math.max(a.length, b.length);

  // Create zero-padded arrays of equal length
  // This ensures we don't access out-of-bounds indices
  const paddedA = new Uint8Array(maxLength);
  const paddedB = new Uint8Array(maxLength);
  paddedA.set(a);
  paddedB.set(b);

  // Accumulate XOR differences
  // Any difference will set bits in `result`
  let result = 0;
  for (let i = 0; i < maxLength; i++) {
    result |= paddedA[i] ^ paddedB[i];
  }

  // Also compare original lengths
  // Different lengths should return false even if content matches after padding
  result |= a.length ^ b.length;

  // Result is 0 only if all bytes matched AND lengths are equal
  return result === 0;
}

/**
 * Constant-time comparison for hex-encoded strings
 *
 * Specialized comparison for hex-encoded values (like key IDs, hashes).
 * Validates hex format and performs constant-time comparison.
 *
 * @param a - First hex string to compare
 * @param b - Second hex string to compare
 * @returns True if hex strings are equal, false otherwise
 *
 * @example
 * ```typescript
 * // Comparing SHA-256 hash hex strings
 * const hashesMatch = constantTimeEqualHex(computedHash, expectedHash);
 * ```
 */
export function constantTimeEqualHex(a: string, b: string): boolean {
  // Convert hex strings to byte arrays for comparison
  const bytesA = hexToBytes(a);
  const bytesB = hexToBytes(b);

  // If either conversion failed (invalid hex), compare as strings
  // This handles edge cases with invalid input
  if (bytesA === null || bytesB === null) {
    return constantTimeEqual(a, b);
  }

  return constantTimeEqualBytes(bytesA, bytesB);
}

/**
 * Convert a hex string to a byte array
 *
 * @param hex - Hex string to convert
 * @returns Byte array, or null if invalid hex
 */
function hexToBytes(hex: string): Uint8Array | null {
  // Validate hex string format
  if (!/^[0-9a-fA-F]*$/.test(hex)) {
    return null;
  }

  // Handle odd-length hex strings by padding
  const normalizedHex = hex.length % 2 === 0 ? hex : '0' + hex;

  const bytes = new Uint8Array(normalizedHex.length / 2);
  for (let i = 0; i < normalizedHex.length; i += 2) {
    const byte = parseInt(normalizedHex.slice(i, i + 2), 16);
    if (isNaN(byte)) {
      return null;
    }
    bytes[i / 2] = byte;
  }

  return bytes;
}

/**
 * Constant-time select operation
 *
 * Returns `a` if `condition` is true, `b` otherwise, in constant time.
 * This is useful for avoiding branches that could leak timing information.
 *
 * Note: This works correctly for 32-bit integers. For larger values,
 * consider using BigInt or splitting into multiple operations.
 *
 * @param condition - Boolean condition
 * @param a - Value to return if true
 * @param b - Value to return if false
 * @returns Either `a` or `b` based on condition
 *
 * @example
 * ```typescript
 * // Timing-safe conditional selection
 * const result = constantTimeSelect(isAuthenticated, secretValue, defaultValue);
 * ```
 */
export function constantTimeSelect(
  condition: boolean,
  a: number,
  b: number
): number {
  // Convert boolean to all-ones or all-zeros mask
  // true -> 0xFFFFFFFF, false -> 0x00000000
  const mask = -Number(condition) | 0;

  // Use bitwise operations to select value
  // mask & a: either 'a' or 0
  // ~mask & b: either 0 or 'b'
  return (mask & a) | (~mask & b);
}
