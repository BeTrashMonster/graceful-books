/**
 * JWT Token Generation & Verification Utilities
 *
 * Handles JWT token creation and verification for user and admin authentication
 */

import { sign, verify } from 'hono/jwt';
import type { Permission } from '../config/permissions.js';

/**
 * User token payload (7 day expiry)
 */
export interface UserTokenPayload {
  userId: string;
  email: string;
  role: 'user';
  exp: number;
}

/**
 * Admin token payload (24 hour expiry)
 */
export interface AdminTokenPayload {
  adminId: string;
  email: string;
  role: string;
  permissions: Permission[] | ['*'];
  exp: number;
}

/**
 * Token payload type (union of user and admin)
 */
export type TokenPayload = UserTokenPayload | AdminTokenPayload;

/**
 * Get JWT secret from environment
 */
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('[JWT] FATAL: JWT_SECRET is not set in environment');
    throw new Error('JWT_SECRET environment variable is not set');
  }
  console.log(`[JWT] Using JWT_SECRET: ${secret.substring(0, 8)}...${secret.substring(secret.length - 8)}`);
  return secret;
}

/**
 * Generate JWT token for regular user (7 day expiry)
 *
 * @param userId - User's UUID
 * @param email - User's email address
 * @param role - User role (always 'user')
 * @returns Promise<string> - JWT token
 *
 * @example
 * const token = await generateUserToken(user.id, user.email, 'user');
 */
export async function generateUserToken(
  userId: string,
  email: string,
  role: 'user' = 'user'
): Promise<string> {
  console.log(`[JWT] Generating token for user: ${userId}`);
  const secret = getJwtSecret();
  const expiresIn = 60 * 60 * 24 * 7; // 7 days in seconds

  const payload: UserTokenPayload = {
    userId,
    email,
    role,
    exp: Math.floor(Date.now() / 1000) + expiresIn,
  };

  const token = await sign(payload, secret);
  console.log(`[JWT] Token generated: ${token.substring(0, 30)}...`);
  return token;
}

/**
 * Generate JWT token for admin user (24 hour expiry)
 *
 * @param adminId - Admin user's UUID
 * @param email - Admin's email address
 * @param role - Admin role (super_admin, admin, support, finance)
 * @param permissions - Admin's permission array
 * @returns Promise<string> - JWT token
 *
 * @example
 * const token = await generateAdminToken(admin.id, admin.email, 'admin', permissions);
 */
export async function generateAdminToken(
  adminId: string,
  email: string,
  role: string,
  permissions: Permission[] | ['*']
): Promise<string> {
  const secret = getJwtSecret();
  const expiresIn = 60 * 60 * 24; // 24 hours in seconds

  const payload: AdminTokenPayload = {
    adminId,
    email,
    role,
    permissions,
    exp: Math.floor(Date.now() / 1000) + expiresIn,
  };

  return await sign(payload, secret);
}

/**
 * Verify and decode a JWT token
 *
 * @param token - JWT token to verify
 * @returns Promise<TokenPayload> - Decoded token payload
 * @throws Error if token is invalid or expired
 *
 * @example
 * try {
 *   const payload = await verifyToken(token);
 *   console.log('User ID:', payload.userId);
 * } catch (error) {
 *   console.error('Invalid token');
 * }
 */
export async function verifyToken(token: string): Promise<TokenPayload> {
  console.log(`[JWT] Verifying token: ${token.substring(0, 30)}...`);
  const secret = getJwtSecret();

  try {
    const payload = await verify(token, secret);
    console.log('[JWT] Token verified successfully:', { userId: (payload as any).userId });
    return payload as TokenPayload;
  } catch (error) {
    console.error('[JWT] Token verification failed');
    console.error('[JWT] Error details:', error);
    console.error('[JWT] Token that failed:', token.substring(0, 50));
    console.error('[JWT] Secret used (first 8):', secret.substring(0, 8));
    throw new Error('Invalid or expired token');
  }
}

/**
 * Type guard to check if payload is a user token
 */
export function isUserToken(payload: TokenPayload): payload is UserTokenPayload {
  return 'userId' in payload;
}

/**
 * Type guard to check if payload is an admin token
 */
export function isAdminToken(payload: TokenPayload): payload is AdminTokenPayload {
  return 'adminId' in payload;
}
