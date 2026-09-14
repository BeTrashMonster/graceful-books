/**
 * SPIKE: Verify argon2-browser loads and derives a key in Vite
 *
 * This test must pass before any Argon2id migration work proceeds.
 * If it fails, the WASM setup needs debugging.
 */

import { describe, it, expect } from 'vitest';

describe('Argon2-browser WASM Spike', () => {
  it('should import argon2-browser module', async () => {
    // Dynamic import to match how it would be used in production
    const argon2 = await import('argon2-browser');

    expect(argon2).toBeDefined();
    expect(argon2.hash).toBeDefined();
    expect(typeof argon2.hash).toBe('function');

    console.log('[SPIKE] argon2-browser module loaded successfully');
    console.log('[SPIKE] Available exports:', Object.keys(argon2));
  });

  it('should derive a key using Argon2id', async () => {
    const argon2 = await import('argon2-browser');

    const password = 'test-passphrase-for-spike';
    const salt = new Uint8Array(16);
    crypto.getRandomValues(salt);

    const startTime = performance.now();

    const result = await argon2.hash({
      pass: password,
      salt: salt,
      time: 3,        // iterations
      mem: 65536,     // 64MB in KB
      parallelism: 4,
      hashLen: 32,    // 256 bits
      type: argon2.ArgonType.Argon2id,
    });

    const duration = performance.now() - startTime;

    expect(result).toBeDefined();
    expect(result.hash).toBeDefined();
    expect(result.hash).toBeInstanceOf(Uint8Array);
    expect(result.hash.length).toBe(32);

    console.log(`[SPIKE] Argon2id key derivation successful`);
    console.log(`[SPIKE] Duration: ${duration.toFixed(0)}ms`);
    console.log(`[SPIKE] Hash length: ${result.hash.length} bytes`);
    console.log(`[SPIKE] Hash (first 8 bytes): ${Array.from(result.hash.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join('')}`);
  });

  it('should produce consistent results for same input', async () => {
    const argon2 = await import('argon2-browser');

    const password = 'consistent-test-password';
    // Fixed salt for consistency test
    const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);

    const params = {
      pass: password,
      salt: salt,
      time: 3,
      mem: 65536,
      parallelism: 4,
      hashLen: 32,
      type: argon2.ArgonType.Argon2id,
    };

    const result1 = await argon2.hash(params);
    const result2 = await argon2.hash(params);

    // Same input should produce same output
    expect(Array.from(result1.hash)).toEqual(Array.from(result2.hash));

    console.log('[SPIKE] Consistency check passed - same input produces same hash');
  });
});
