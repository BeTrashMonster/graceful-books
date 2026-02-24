/**
 * Authorization Utilities
 *
 * Provides authorization helpers to prevent IDOR (Insecure Direct Object Reference) vulnerabilities.
 * All data access must verify that the requesting user has permission to access the resource.
 *
 * SECURITY FIX: Addresses OWASP A01:2021 - Broken Access Control
 */

import type { DatabaseError } from '../store/types'

/**
 * Result of authorization check
 */
export type AuthorizationResult<T> =
  | { authorized: true; resource: T }
  | { authorized: false; error: DatabaseError }

/**
 * Require that a resource belongs to the requesting company
 *
 * Prevents IDOR attacks by verifying resource ownership before allowing access.
 *
 * @param resource - The resource to check (must have companyId field)
 * @param requestingCompanyId - The company ID making the request
 * @returns Authorization result with resource or error
 *
 * @example
 * ```typescript
 * const entity = await db.accounts.get(accountId)
 * const authCheck = requireCompanyOwnership(entity, companyId)
 * if (!authCheck.authorized) {
 *   return { success: false, error: authCheck.error }
 * }
 * // Safe to use authCheck.resource - ownership verified
 * ```
 */
export function requireCompanyOwnership<T extends { companyId: string }>(
  resource: T | null | undefined,
  requestingCompanyId: string
): AuthorizationResult<T> {
  // Resource not found
  if (!resource) {
    return {
      authorized: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Resource not found',
      },
    }
  }

  // Resource belongs to different company - FORBIDDEN
  if (resource.companyId !== requestingCompanyId) {
    // Security: Don't reveal that resource exists, return NOT_FOUND instead
    // This prevents information leakage about other companies' data
    return {
      authorized: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Resource not found',
      },
    }
  }

  // Authorized - resource belongs to requesting company
  return {
    authorized: true,
    resource,
  }
}

/**
 * Require that multiple resources all belong to the requesting company
 *
 * Used for batch operations to ensure all resources are authorized.
 *
 * @param resources - Array of resources to check
 * @param requestingCompanyId - The company ID making the request
 * @returns Authorization result with resources or error
 *
 * @example
 * ```typescript
 * const entities = await db.accounts.bulkGet(accountIds)
 * const authCheck = requireBatchCompanyOwnership(entities, companyId)
 * if (!authCheck.authorized) {
 *   return { success: false, error: authCheck.error }
 * }
 * // Safe to use authCheck.resources - all ownership verified
 * ```
 */
export function requireBatchCompanyOwnership<T extends { companyId: string }>(
  resources: (T | undefined)[],
  requestingCompanyId: string
): AuthorizationResult<T[]> {
  const validResources: T[] = []

  for (const resource of resources) {
    if (!resource) {
      return {
        authorized: false,
        error: {
          code: 'NOT_FOUND',
          message: 'One or more resources not found',
        },
      }
    }

    if (resource.companyId !== requestingCompanyId) {
      return {
        authorized: false,
        error: {
          code: 'NOT_FOUND',
          message: 'One or more resources not found',
        },
      }
    }

    validResources.push(resource)
  }

  return {
    authorized: true,
    resource: validResources,
  }
}

/**
 * Validate that a companyId parameter is provided
 *
 * Ensures all data access functions receive required authorization context.
 *
 * @param companyId - Company ID to validate
 * @returns Error if invalid, undefined if valid
 */
export function validateCompanyId(
  companyId: string | undefined | null
): DatabaseError | undefined {
  if (!companyId || companyId.trim() === '') {
    return {
      code: 'VALIDATION_ERROR',
      message: 'Company ID is required for authorization',
    }
  }
  return undefined
}
