/**
 * Type declarations for argon2-browser
 *
 * argon2-browser is a UMD module that exports via window.argon2 when loaded.
 * This declaration file describes its actual exported interface.
 *
 * Source: https://github.com/nicehash/argon2-browser
 */

declare module 'argon2-browser' {
  /**
   * Argon2 algorithm variants
   * - Argon2d: Data-dependent (vulnerable to side-channel attacks, fastest)
   * - Argon2i: Data-independent (recommended for password hashing)
   * - Argon2id: Hybrid (recommended by OWASP, used by us)
   */
  export const ArgonType: {
    readonly Argon2d: 0;
    readonly Argon2i: 1;
    readonly Argon2id: 2;
  };

  /**
   * Hash result from Argon2 operations
   */
  export interface Argon2HashResult {
    /** Raw hash bytes */
    hash: Uint8Array;
    /** Hex-encoded hash string */
    hashHex: string;
    /** Encoded hash in PHC string format (optional) */
    encoded?: string;
  }

  /**
   * Options for the hash function
   */
  export interface Argon2HashOptions {
    /** Password/passphrase to hash */
    pass: string | Uint8Array;
    /** Salt (must be at least 8 bytes, recommended 16 bytes) */
    salt: Uint8Array;
    /** Time cost (iterations). Higher = more secure but slower. Default: 3 */
    time: number;
    /** Memory cost in KB. Higher = more secure. Default: 65536 (64MB) */
    mem: number;
    /** Parallelism factor. Default: 4 */
    parallelism: number;
    /** Desired hash length in bytes. Default: 32 */
    hashLen: number;
    /** Algorithm type: 0=Argon2d, 1=Argon2i, 2=Argon2id */
    type: 0 | 1 | 2;
  }

  /**
   * Options for the verify function
   */
  export interface Argon2VerifyOptions {
    /** Password/passphrase to verify */
    pass: string | Uint8Array;
    /** The PHC-encoded hash string to verify against */
    encoded: string;
    /** Algorithm type (optional, can be detected from encoded string) */
    type?: 0 | 1 | 2;
  }

  /**
   * Derive a hash from a password using Argon2
   * @param options Hash options including password, salt, and parameters
   * @returns Promise resolving to the hash result
   */
  export function hash(options: Argon2HashOptions): Promise<Argon2HashResult>;

  /**
   * Verify a password against an encoded hash
   * @param options Verify options including password and encoded hash
   * @returns Promise resolving to true if password matches, false otherwise
   */
  export function verify(options: Argon2VerifyOptions): Promise<boolean>;

  /**
   * Unload the Argon2 WASM runtime to free memory
   * Call this when you're done using Argon2 in a session
   */
  export function unloadRuntime(): void;
}
