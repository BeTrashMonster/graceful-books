/**
 * Standardized API response helpers for Audacious Money backend
 *
 * All API endpoints MUST use these response helpers instead of raw c.json()
 * This ensures consistent error handling and response format across the entire API
 */

import { Context } from 'hono';

/**
 * Standard API response format
 */
export interface ApiResponse<T = any> {
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

/**
 * Error codes enum
 */
export const ErrorCodes = {
  // Authentication & Authorization
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_REQUIRED: 'TOKEN_REQUIRED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  FORBIDDEN: 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  ADMIN_REQUIRED: 'ADMIN_REQUIRED',

  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  INVALID_ID: 'INVALID_ID',

  // Resources
  NOT_FOUND: 'NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  PRODUCT_NOT_FOUND: 'PRODUCT_NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  EMAIL_EXISTS: 'EMAIL_EXISTS',

  // Business Logic
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  ACCOUNT_FROZEN: 'ACCOUNT_FROZEN',
  ALREADY_SUBSCRIBED: 'ALREADY_SUBSCRIBED',
  INVALID_DISCOUNT: 'INVALID_DISCOUNT',
  INVALID_CHARITY: 'INVALID_CHARITY',
  INVALID_STATUS: 'INVALID_STATUS',

  // System
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
} as const;

/**
 * Friendly error messages
 */
export const ErrorMessages = {
  // Authentication & Authorization
  UNAUTHORIZED: 'Authentication required',
  TOKEN_REQUIRED: 'No token provided',
  TOKEN_EXPIRED: 'Token has expired',
  INVALID_TOKEN: 'Invalid or expired token',
  FORBIDDEN: 'You do not have permission to access this resource',
  INSUFFICIENT_PERMISSIONS: 'Insufficient permissions',
  ADMIN_REQUIRED: 'Admin access required',

  // Resources
  NOT_FOUND: 'Resource not found',
  USER_NOT_FOUND: 'User not found',
  PRODUCT_NOT_FOUND: 'Product not found',
  EMAIL_EXISTS: 'Email already registered',

  // Business Logic
  INVALID_CREDENTIALS: 'Invalid email or password',
  ACCOUNT_SUSPENDED: 'Your account has been suspended',
  ACCOUNT_FROZEN: 'Your account is frozen. Please subscribe to continue.',

  // System
  INTERNAL_ERROR: 'An unexpected error occurred',
  RATE_LIMITED: 'Too many requests. Please try again later.',
} as const;

/**
 * Success response (200 OK)
 */
export function success<T>(c: Context, data: T, message?: string): Response {
  const response: ApiResponse<T> = { data };
  if (message) {
    (response as any).message = message;
  }
  return c.json(response, 200);
}

/**
 * Created response (201 Created)
 */
export function created<T>(c: Context, data: T, message?: string): Response {
  const response: ApiResponse<T> = { data };
  if (message) {
    (response as any).message = message;
  }
  return c.json(response, 201);
}

/**
 * No content response (204 No Content)
 */
export function noContent(c: Context): Response {
  return c.body(null, 204);
}

/**
 * Paginated response (200 OK)
 */
export function paginated<T>(
  c: Context,
  data: T[],
  pagination: { total: number; limit: number; offset: number }
): Response {
  const response: ApiResponse<T[]> = {
    data,
    pagination: {
      ...pagination,
      hasMore: pagination.offset + data.length < pagination.total,
    },
  };
  return c.json(response, 200);
}

/**
 * Bad request error (400)
 */
export function badRequest(c: Context, code: string, message: string, details?: any): Response {
  const response: ApiResponse = {
    error: { code, message, details },
  };
  return c.json(response, 400);
}

/**
 * Unauthorized error (401)
 */
export function unauthorized(c: Context, code: string, message: string): Response {
  const response: ApiResponse = {
    error: { code, message },
  };
  return c.json(response, 401);
}

/**
 * Forbidden error (403)
 */
export function forbidden(c: Context, code: string, message: string): Response {
  const response: ApiResponse = {
    error: { code, message },
  };
  return c.json(response, 403);
}

/**
 * Not found error (404)
 */
export function notFound(c: Context, code: string, message: string): Response {
  const response: ApiResponse = {
    error: { code, message },
  };
  return c.json(response, 404);
}

/**
 * Conflict error (409)
 */
export function conflict(c: Context, code: string, message: string): Response {
  const response: ApiResponse = {
    error: { code, message },
  };
  return c.json(response, 409);
}

/**
 * Too many requests error (429)
 */
export function tooManyRequests(c: Context, code: string, message: string): Response {
  const response: ApiResponse = {
    error: { code, message },
  };
  return c.json(response, 429);
}

/**
 * Internal server error (500)
 */
export function internalError(c: Context, code: string, message: string): Response {
  const response: ApiResponse = {
    error: { code, message },
  };
  return c.json(response, 500);
}
