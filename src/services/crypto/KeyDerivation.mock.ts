/**
 * Mock implementation of argon2-browser for testing
 *
 * This provides a simulated Argon2id implementation for tests that
 * don't have access to WASM. For security reasons, this ONLY uses
 * PBKDF2 in the mock and should never be used in production.
 */

export const mockArgon2 = {
  ArgonType: {
    Argon2d: 0,
    Argon2i: 1,
    Argon2id: 2,
  },

  async hash(options: {
    pass: string;
    salt: Uint8Array;
    time: number;
    mem: number;
    parallelism: number;
    hashLen: number;
    type: number;
  }): Promise<{ hash: Uint8Array; hashHex: string }> {
    // Use PBKDF2 as a mock (for testing only)
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(options.pass);

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      'PBKDF2',
      false,
      ['deriveBits']
    );

    // Use higher iterations to simulate Argon2's computational cost
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: options.salt,
        iterations: options.time * 100000, // Scale up for security
        hash: 'SHA-256',
      },
      keyMaterial,
      options.hashLen * 8
    );

    const hash = new Uint8Array(derivedBits);
    const hashHex = Array.from(hash)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return { hash, hashHex };
  },
};
