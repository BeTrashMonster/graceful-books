/**
 * Password Hashing & Verification Utilities
 *
 * Uses Argon2id (OWASP recommended) for secure password hashing
 */

import { hash, verify } from '@node-rs/argon2';

/**
 * Argon2id configuration from environment (with secure defaults)
 */
const getArgon2Config = () => ({
  memoryCost: parseInt(process.env.ARGON2_MEMORY_COST || '65536'),
  timeCost: parseInt(process.env.ARGON2_TIME_COST || '3'),
  parallelism: parseInt(process.env.ARGON2_PARALLELISM || '4'),
});

/**
 * Hash a password using Argon2id
 *
 * @param password - Plain text password to hash
 * @returns Promise<string> - Hashed password with salt and parameters embedded
 *
 * @example
 * const hashedPassword = await hashPassword('MySecurePassword123!');
 */
export async function hashPassword(password: string): Promise<string> {
  const config = getArgon2Config();

  try {
    const hashed = await hash(password, {
      memoryCost: config.memoryCost,
      timeCost: config.timeCost,
      parallelism: config.parallelism,
    });

    return hashed;
  } catch (error) {
    console.error('[Password] Error hashing password:', error);
    throw new Error('Failed to hash password');
  }
}

/**
 * Verify a password against its hash
 *
 * @param password - Plain text password to verify
 * @param hash - Hashed password to compare against
 * @returns Promise<boolean> - True if password matches, false otherwise
 *
 * @example
 * const isValid = await verifyPassword('MySecurePassword123!', hashedPassword);
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    const isValid = await verify(hash, password);
    return isValid;
  } catch (error) {
    console.error('[Password] Error verifying password:', error);
    return false;
  }
}

/**
 * Timing-safe password verification (prevents timing attacks during login)
 *
 * Always performs hashing even if user doesn't exist to prevent user enumeration
 * via response timing differences.
 *
 * @param password - Password to verify
 * @param hash - Hash to compare against (or null if user doesn't exist)
 * @returns Promise<boolean> - True if password matches, false otherwise
 *
 * @example
 * const user = await getUserByEmail(email);
 * const isValid = await timingSafeVerify(password, user?.password_hash || null);
 */
export async function timingSafeVerify(
  password: string,
  hash: string | null
): Promise<boolean> {
  // Always hash even if user doesn't exist (prevents timing attacks)
  const fakeHash = '$argon2id$v=19$m=65536,t=3,p=4$dGVzdHNhbHQ$abc123';

  const hashToVerify = hash || fakeHash;
  const isValid = await verifyPassword(password, hashToVerify);

  // If user doesn't exist, always return false
  return hash ? isValid : false;
}
