/**
 * Global error handler middleware
 *
 * Catches all unhandled errors and returns standardized error responses
 * Never leaks stack traces or sensitive information in production
 */

import { Context } from 'hono';
import { ErrorCodes, ErrorMessages, internalError } from '../utils/responses.js';

/**
 * Global error handler middleware
 */
export async function errorHandler(err: Error, c: Context) {
  const requestId = c.get('requestId') || 'unknown';

  // Log error details server-side
  console.error('[Error Handler]', {
    requestId,
    error: err.message,
    stack: err.stack,
    path: c.req.path,
    method: c.req.method,
  });

  // In production, never leak stack traces
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Return generic error response
  return internalError(
    c,
    ErrorCodes.INTERNAL_ERROR,
    isDevelopment
      ? `${ErrorMessages.INTERNAL_ERROR}: ${err.message}`
      : ErrorMessages.INTERNAL_ERROR
  );
}

/**
 * Not found handler (404)
 */
export function notFoundHandler(c: Context) {
  return c.json(
    {
      error: {
        code: ErrorCodes.NOT_FOUND,
        message: 'The requested resource was not found',
        path: c.req.path,
      },
    },
    404
  );
}
