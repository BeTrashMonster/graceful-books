/**
 * Validation schemas and middleware for Audacious Money backend
 *
 * All API endpoints should use these validation schemas to ensure
 * consistent input validation across the entire API
 */

import { z } from 'zod';
import type { Context, Next } from 'hono';
import { badRequest, ErrorCodes } from './responses.js';

// =============================================================================
// REUSABLE BASE SCHEMAS
// =============================================================================

/**
 * Email validation schema
 */
export const emailSchema = z
  .string()
  .email('Please enter a valid email address')
  .toLowerCase()
  .trim();

/**
 * Password validation schema
 * Requires: 8+ characters, uppercase, lowercase, number, special char
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

/**
 * UUID validation schema
 */
export const uuidSchema = z.string().uuid('Invalid ID format');

/**
 * Name validation schema
 */
export const nameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(100, 'Name must be less than 100 characters')
  .trim();

/**
 * Company name validation schema (optional)
 */
export const companyNameSchema = z
  .string()
  .max(255, 'Company name must be less than 255 characters')
  .trim()
  .optional();

/**
 * Affiliate code validation schema (optional)
 */
export const affiliateCodeSchema = z
  .string()
  .min(3, 'Affiliate code must be at least 3 characters')
  .max(50, 'Affiliate code must be less than 50 characters')
  .toUpperCase()
  .trim()
  .optional();

// =============================================================================
// AUTH SCHEMAS
// =============================================================================

/**
 * User signup schema
 */
export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: nameSchema,
  lastName: nameSchema,
  companyName: companyNameSchema,
  affiliateCode: affiliateCodeSchema,
});

/**
 * User login schema
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

/**
 * Email verification schema
 */
export const emailVerificationSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

/**
 * Password reset request schema
 */
export const passwordResetRequestSchema = z.object({
  email: emailSchema,
});

/**
 * Password reset schema
 */
export const passwordResetSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: passwordSchema,
});

// =============================================================================
// VALIDATION MIDDLEWARE
// =============================================================================

/**
 * Validation middleware for request body
 *
 * @param schema - Zod schema to validate against
 * @returns Middleware function
 *
 * @example
 * app.post('/signup', validate(signupSchema), async (c) => {
 *   const data = c.get('validatedData');
 *   // data is fully typed and validated
 * });
 */
export function validate<T extends z.ZodTypeAny>(schema: T) {
  return async (c: Context, next: Next) => {
    try {
      const body = await c.req.json();
      const validatedData = schema.parse(body);
      c.set('validatedData', validatedData);
      await next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return badRequest(c, ErrorCodes.VALIDATION_ERROR, 'Validation failed', {
          errors: error.errors.map((err) => ({
            path: err.path.join('.'),
            message: err.message,
          })),
        });
      }
      return badRequest(c, ErrorCodes.INVALID_INPUT, 'Invalid request body');
    }
  };
}

/**
 * Validation middleware for query parameters
 *
 * @param schema - Zod schema to validate against
 * @returns Middleware function
 *
 * @example
 * app.get('/users', validateQuery(userQuerySchema), async (c) => {
 *   const query = c.get('validatedQuery');
 *   // query is fully typed and validated
 * });
 */
export function validateQuery<T extends z.ZodTypeAny>(schema: T) {
  return async (c: Context, next: Next) => {
    try {
      const query = c.req.query();
      const validatedQuery = schema.parse(query);
      c.set('validatedQuery', validatedQuery);
      await next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return badRequest(c, ErrorCodes.VALIDATION_ERROR, 'Validation failed', {
          errors: error.errors.map((err) => ({
            path: err.path.join('.'),
            message: err.message,
          })),
        });
      }
      return badRequest(c, ErrorCodes.INVALID_INPUT, 'Invalid query parameters');
    }
  };
}

/**
 * Validation middleware for URL parameters
 *
 * @param schema - Zod schema to validate against
 * @returns Middleware function
 *
 * @example
 * app.get('/users/:id', validateParams(z.object({ id: uuidSchema })), async (c) => {
 *   const params = c.get('validatedParams');
 *   // params is fully typed and validated
 * });
 */
export function validateParams<T extends z.ZodTypeAny>(schema: T) {
  return async (c: Context, next: Next) => {
    try {
      const params = c.req.param();
      const validatedParams = schema.parse(params);
      c.set('validatedParams', validatedParams);
      await next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return badRequest(c, ErrorCodes.VALIDATION_ERROR, 'Validation failed', {
          errors: error.errors.map((err) => ({
            path: err.path.join('.'),
            message: err.message,
          })),
        });
      }
      return badRequest(c, ErrorCodes.INVALID_INPUT, 'Invalid URL parameters');
    }
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if a string is a valid UUID
 */
export function isValidUUID(value: string): boolean {
  try {
    uuidSchema.parse(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a string is a valid email
 */
export function isValidEmail(value: string): boolean {
  try {
    emailSchema.parse(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitize string input (remove control characters, trim)
 */
export function sanitizeString(value: string): string {
  return value.replace(/[\x00-\x1F\x7F]/g, '').trim();
}

/**
 * Check if a string is a valid date string
 */
export function isValidDateString(value: string): boolean {
  const date = new Date(value);
  return !isNaN(date.getTime());
}
