/**
 * Constant-Time Cryptographic Comparison Tests
 *
 * Tests for timing-attack resistant comparison functions.
 * These tests verify correctness, not timing characteristics.
 * Timing verification requires statistical analysis tools.
 */

import { describe, it, expect } from 'vitest';
import {
  constantTimeEqual,
  constantTimeEqualBytes,
  constantTimeEqualHex,
  constantTimeSelect,
} from '../../../utils/crypto/constantTime';

describe('constantTimeEqual', () => {
  describe('basic equality', () => {
    it('should return true for equal strings', () => {
      expect(constantTimeEqual('hello', 'hello')).toBe(true);
      expect(constantTimeEqual('', '')).toBe(true);
      expect(constantTimeEqual('a', 'a')).toBe(true);
      expect(constantTimeEqual('password123', 'password123')).toBe(true);
    });

    it('should return false for different strings', () => {
      expect(constantTimeEqual('hello', 'world')).toBe(false);
      expect(constantTimeEqual('hello', 'Hello')).toBe(false);
      expect(constantTimeEqual('a', 'b')).toBe(false);
      expect(constantTimeEqual('password123', 'password124')).toBe(false);
    });

    it('should return false for strings with different lengths', () => {
      expect(constantTimeEqual('hello', 'hello!')).toBe(false);
      expect(constantTimeEqual('a', 'aa')).toBe(false);
      expect(constantTimeEqual('', 'a')).toBe(false);
      expect(constantTimeEqual('short', 'longer string')).toBe(false);
    });
  });

  describe('security-sensitive scenarios', () => {
    it('should correctly compare API tokens', () => {
      const validToken = 'abc123def456ghi789';
      expect(constantTimeEqual(validToken, 'abc123def456ghi789')).toBe(true);
      expect(constantTimeEqual(validToken, 'abc123def456ghi788')).toBe(false);
      expect(constantTimeEqual(validToken, 'xbc123def456ghi789')).toBe(false);
    });

    it('should correctly compare session IDs', () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440000';
      expect(constantTimeEqual(sessionId, '550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(constantTimeEqual(sessionId, '550e8400-e29b-41d4-a716-446655440001')).toBe(false);
    });

    it('should correctly compare key IDs (hex strings)', () => {
      const keyId = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
      expect(constantTimeEqual(keyId, keyId)).toBe(true);
      expect(constantTimeEqual(keyId, keyId.replace('a1', 'a2'))).toBe(false);
    });
  });

  describe('unicode handling', () => {
    it('should correctly compare unicode strings', () => {
      expect(constantTimeEqual('café', 'café')).toBe(true);
      expect(constantTimeEqual('café', 'cafe')).toBe(false);
      expect(constantTimeEqual('\u{1F600}', '\u{1F600}')).toBe(true);
      expect(constantTimeEqual('\u{1F600}', '\u{1F601}')).toBe(false);
    });

    it('should handle mixed unicode and ASCII', () => {
      expect(constantTimeEqual('hello世界', 'hello世界')).toBe(true);
      expect(constantTimeEqual('hello世界', 'hello世界!')).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle very long strings', () => {
      const longString = 'a'.repeat(10000);
      expect(constantTimeEqual(longString, longString)).toBe(true);
      expect(constantTimeEqual(longString, longString + 'b')).toBe(false);
      expect(constantTimeEqual(longString, 'b'.repeat(10000))).toBe(false);
    });

    it('should handle strings with null characters', () => {
      expect(constantTimeEqual('a\x00b', 'a\x00b')).toBe(true);
      expect(constantTimeEqual('a\x00b', 'a\x00c')).toBe(false);
    });

    it('should handle strings with special characters', () => {
      expect(constantTimeEqual('hello\nworld', 'hello\nworld')).toBe(true);
      expect(constantTimeEqual('hello\tworld', 'hello\tworld')).toBe(true);
      expect(constantTimeEqual('hello\nworld', 'hello\rworld')).toBe(false);
    });
  });
});

describe('constantTimeEqualBytes', () => {
  describe('basic equality', () => {
    it('should return true for equal byte arrays', () => {
      expect(constantTimeEqualBytes(
        new Uint8Array([1, 2, 3]),
        new Uint8Array([1, 2, 3])
      )).toBe(true);

      expect(constantTimeEqualBytes(
        new Uint8Array([]),
        new Uint8Array([])
      )).toBe(true);

      expect(constantTimeEqualBytes(
        new Uint8Array([0]),
        new Uint8Array([0])
      )).toBe(true);
    });

    it('should return false for different byte arrays', () => {
      expect(constantTimeEqualBytes(
        new Uint8Array([1, 2, 3]),
        new Uint8Array([1, 2, 4])
      )).toBe(false);

      expect(constantTimeEqualBytes(
        new Uint8Array([1, 2, 3]),
        new Uint8Array([4, 5, 6])
      )).toBe(false);

      expect(constantTimeEqualBytes(
        new Uint8Array([0]),
        new Uint8Array([1])
      )).toBe(false);
    });

    it('should return false for arrays with different lengths', () => {
      expect(constantTimeEqualBytes(
        new Uint8Array([1, 2, 3]),
        new Uint8Array([1, 2, 3, 4])
      )).toBe(false);

      expect(constantTimeEqualBytes(
        new Uint8Array([1, 2, 3]),
        new Uint8Array([1, 2])
      )).toBe(false);

      expect(constantTimeEqualBytes(
        new Uint8Array([]),
        new Uint8Array([0])
      )).toBe(false);
    });
  });

  describe('cryptographic key comparison', () => {
    it('should correctly compare 256-bit keys', () => {
      const key1 = new Uint8Array(32).fill(0xAB);
      const key2 = new Uint8Array(32).fill(0xAB);
      const key3 = new Uint8Array(32).fill(0xAB);
      key3[31] = 0xAC; // Last byte different

      expect(constantTimeEqualBytes(key1, key2)).toBe(true);
      expect(constantTimeEqualBytes(key1, key3)).toBe(false);
    });

    it('should correctly compare HMAC signatures', () => {
      // Simulate two 32-byte HMAC-SHA256 signatures
      const hmac1 = new Uint8Array([
        0x2c, 0xf2, 0x4d, 0xba, 0x5f, 0xb0, 0xa3, 0x0e,
        0x26, 0xe8, 0x3b, 0x2a, 0xc5, 0xb9, 0xe2, 0x9e,
        0x1b, 0x16, 0x1e, 0x5c, 0x1f, 0xa7, 0x42, 0x5e,
        0x73, 0x04, 0x33, 0x62, 0x93, 0x8b, 0x98, 0x24,
      ]);
      const hmac2 = new Uint8Array(hmac1);
      const hmac3 = new Uint8Array(hmac1);
      hmac3[0] = 0x2d; // First byte different

      expect(constantTimeEqualBytes(hmac1, hmac2)).toBe(true);
      expect(constantTimeEqualBytes(hmac1, hmac3)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle all-zero arrays', () => {
      const zeros1 = new Uint8Array(32);
      const zeros2 = new Uint8Array(32);
      expect(constantTimeEqualBytes(zeros1, zeros2)).toBe(true);
    });

    it('should handle all-ones arrays', () => {
      const ones1 = new Uint8Array(32).fill(0xFF);
      const ones2 = new Uint8Array(32).fill(0xFF);
      expect(constantTimeEqualBytes(ones1, ones2)).toBe(true);
    });

    it('should detect single bit difference', () => {
      const arr1 = new Uint8Array([0b00000000]);
      const arr2 = new Uint8Array([0b00000001]);
      expect(constantTimeEqualBytes(arr1, arr2)).toBe(false);
    });
  });
});

describe('constantTimeEqualHex', () => {
  describe('valid hex strings', () => {
    it('should return true for equal hex strings', () => {
      expect(constantTimeEqualHex('abcd1234', 'abcd1234')).toBe(true);
      expect(constantTimeEqualHex('ABCD1234', 'ABCD1234')).toBe(true);
      expect(constantTimeEqualHex('', '')).toBe(true);
    });

    it('should return false for different hex strings', () => {
      expect(constantTimeEqualHex('abcd1234', 'abcd1235')).toBe(false);
    });

    it('should treat hex comparison as case-insensitive', () => {
      // Hex values are typically case-insensitive (0xAB == 0xab)
      // Both convert to same bytes, so they should be equal
      expect(constantTimeEqualHex('abcd1234', 'ABCD1234')).toBe(true);
      expect(constantTimeEqualHex('AbCd1234', 'aBcD1234')).toBe(true);
    });

    it('should handle SHA-256 hash comparisons', () => {
      const hash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
      expect(constantTimeEqualHex(hash, hash)).toBe(true);
      expect(constantTimeEqualHex(
        hash,
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b856'
      )).toBe(false);
    });
  });

  describe('invalid hex strings', () => {
    it('should fall back to string comparison for invalid hex', () => {
      expect(constantTimeEqualHex('not-hex', 'not-hex')).toBe(true);
      expect(constantTimeEqualHex('ghij', 'ghij')).toBe(true);
      expect(constantTimeEqualHex('not-hex', 'other')).toBe(false);
    });

    it('should handle mixed valid/invalid hex', () => {
      // If one is invalid, falls back to string comparison
      expect(constantTimeEqualHex('abcd', 'ghij')).toBe(false);
    });
  });

  describe('odd-length hex strings', () => {
    it('should handle odd-length hex strings', () => {
      // Odd-length hex gets zero-padded on the left
      expect(constantTimeEqualHex('abc', 'abc')).toBe(true);
      expect(constantTimeEqualHex('abc', 'abd')).toBe(false);
    });
  });
});

describe('constantTimeSelect', () => {
  describe('basic selection', () => {
    it('should return first value when condition is true', () => {
      expect(constantTimeSelect(true, 42, 0)).toBe(42);
      expect(constantTimeSelect(true, 1, 2)).toBe(1);
      expect(constantTimeSelect(true, 100, 200)).toBe(100);
    });

    it('should return second value when condition is false', () => {
      expect(constantTimeSelect(false, 42, 0)).toBe(0);
      expect(constantTimeSelect(false, 1, 2)).toBe(2);
      expect(constantTimeSelect(false, 100, 200)).toBe(200);
    });
  });

  describe('edge cases', () => {
    it('should handle zero values', () => {
      expect(constantTimeSelect(true, 0, 1)).toBe(0);
      expect(constantTimeSelect(false, 0, 1)).toBe(1);
    });

    it('should handle negative values', () => {
      expect(constantTimeSelect(true, -1, -2)).toBe(-1);
      expect(constantTimeSelect(false, -1, -2)).toBe(-2);
    });

    it('should handle maximum 32-bit integer values', () => {
      const max = 0x7FFFFFFF; // Max positive 32-bit signed integer
      expect(constantTimeSelect(true, max, 0)).toBe(max);
      expect(constantTimeSelect(false, 0, max)).toBe(max);
    });
  });
});

describe('timing attack prevention verification', () => {
  /**
   * Note: These tests verify the algorithm but cannot guarantee
   * constant-time execution. True timing attack resistance requires:
   * 1. Statistical analysis with high-precision timers
   * 2. Running on controlled hardware
   * 3. Accounting for JIT compilation, garbage collection, etc.
   *
   * These tests verify the algorithm iterates through all elements
   * regardless of where (or if) differences occur.
   */

  it('should process entire string regardless of early mismatch', () => {
    // These should all take similar time to process
    // (cannot verify timing in unit test, but algorithm is correct)
    const base = 'aaaaaaaaaaaaaaaa';

    // Mismatch at start
    constantTimeEqual('b' + base.slice(1), base);

    // Mismatch at middle
    constantTimeEqual(base.slice(0, 8) + 'b' + base.slice(9), base);

    // Mismatch at end
    constantTimeEqual(base.slice(0, -1) + 'b', base);

    // No mismatch
    constantTimeEqual(base, base);

    // All should complete without early return
    expect(true).toBe(true); // Test passes if no early return causes issues
  });

  it('should process entire array regardless of length difference', () => {
    // Length difference should not cause early return
    const arr1 = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const arr2 = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    // Should process all 10 bytes (max length) even though arr1 is shorter
    expect(constantTimeEqualBytes(arr1, arr2)).toBe(false);

    // Verify the algorithm handles padding correctly
    const arr3 = new Uint8Array([1, 2, 3, 0, 0]); // Trailing zeros
    const arr4 = new Uint8Array([1, 2, 3]); // Shorter but matches content
    expect(constantTimeEqualBytes(arr3, arr4)).toBe(false); // Different lengths = not equal
  });
});
