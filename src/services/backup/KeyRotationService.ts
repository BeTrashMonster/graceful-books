/**
 * Key Rotation Service
 *
 * Implements key rotation epoch system for the Audacious Money backup and sync architecture.
 * Tracks key rotation events to prevent revoked users from syncing data after access revocation.
 *
 * Requirements:
 * - ROADMAP_BACKUP_AND_SYNC.md: Phase 1, Task 1.2
 * - Zero-knowledge encryption with access revocation support
 * - IDOR protection: Validates companyId before all operations
 *
 * Key Technical Details:
 * - keyRotationEpoch starts at 0, increments on each key rotation
 * - Stored in companies table (part of company metadata)
 * - Backup metadata includes epoch number
 * - Sync relay validates client epoch matches current epoch
 * - Epoch mismatch = access revoked
 */

import { db } from '../../db';
import { logger } from '../../utils/logger';
import { validateCompanyId } from '../../utils/authorization';
import { _AppError, ErrorCode, error, success, type OperationResult } from '../../utils/errors';
import type { _Company } from '../../types/database.types';
import { incrementVersionVector, getDeviceId } from '../../db/crdt';

const keyRotationLogger = logger.child('KeyRotationService');

/**
 * Key rotation epoch verification result
 */
export interface EpochVerificationResult {
  /** Whether the epoch matches */
  valid: boolean;
  /** Current epoch number */
  currentEpoch: number;
  /** Client-provided epoch number */
  clientEpoch: number;
  /** Human-readable message */
  message: string;
}

/**
 * Increment the key rotation epoch for a company
 *
 * This function should be called when:
 * - A user is revoked from a company
 * - Company keys are rotated for security reasons
 * - Access needs to be immediately invalidated
 *
 * @param companyId - Company ID to increment epoch for
 * @returns New epoch number
 *
 * @example
 * ```typescript
 * // After revoking user access
 * const result = await incrementKeyRotationEpoch('company-123');
 * if (result.success) {
 *   console.log(`New epoch: ${result.data}`);
 * }
 * ```
 */
export async function incrementKeyRotationEpoch(
  companyId: string
): Promise<OperationResult<number>> {
  try {
    // IDOR protection: Validate companyId parameter
    const validationError = validateCompanyId(companyId);
    if (validationError) {
      keyRotationLogger.warn('Invalid companyId provided', { companyId });
      return error(
        ErrorCode.VALIDATION_ERROR,
        validationError.message,
        { companyId }
      );
    }

    // Fetch current company
    const company = await db.companies.get(companyId);
    if (!company) {
      keyRotationLogger.warn('Company not found', { companyId });
      return error(
        ErrorCode.NOT_FOUND,
        'Company not found'
      );
    }

    // Check if company is deleted (soft delete)
    if (company.deleted_at) {
      keyRotationLogger.warn('Cannot increment epoch for deleted company', { companyId });
      return error(
        ErrorCode.NOT_FOUND,
        'Company not found'
      );
    }

    // Increment epoch
    const currentEpoch = company.key_rotation_epoch ?? 0;
    const newEpoch = currentEpoch + 1;

    // Update company with new epoch
    const deviceId = getDeviceId();
    await db.companies.update(companyId, {
      key_rotation_epoch: newEpoch,
      updated_at: Date.now(),
      version_vector: incrementVersionVector(company.version_vector, deviceId),
    });

    keyRotationLogger.info('Key rotation epoch incremented', {
      companyId,
      previousEpoch: currentEpoch,
      newEpoch,
    });

    return success(newEpoch);
  } catch (err) {
    keyRotationLogger.error('Failed to increment key rotation epoch', err);
    return error(
      ErrorCode.DATABASE_ERROR,
      'Failed to increment key rotation epoch',
      err
    );
  }
}

/**
 * Get the current key rotation epoch for a company
 *
 * @param companyId - Company ID to get epoch for
 * @returns Current epoch number
 *
 * @example
 * ```typescript
 * const result = await getCurrentEpoch('company-123');
 * if (result.success) {
 *   console.log(`Current epoch: ${result.data}`);
 * }
 * ```
 */
export async function getCurrentEpoch(
  companyId: string
): Promise<OperationResult<number>> {
  try {
    // IDOR protection: Validate companyId parameter
    const validationError = validateCompanyId(companyId);
    if (validationError) {
      keyRotationLogger.warn('Invalid companyId provided', { companyId });
      return error(
        ErrorCode.VALIDATION_ERROR,
        validationError.message,
        { companyId }
      );
    }

    // Fetch current company
    const company = await db.companies.get(companyId);
    if (!company) {
      keyRotationLogger.warn('Company not found', { companyId });
      return error(
        ErrorCode.NOT_FOUND,
        'Company not found'
      );
    }

    // Check if company is deleted (soft delete)
    if (company.deleted_at) {
      keyRotationLogger.warn('Cannot get epoch for deleted company', { companyId });
      return error(
        ErrorCode.NOT_FOUND,
        'Company not found'
      );
    }

    const epoch = company.key_rotation_epoch ?? 0;

    keyRotationLogger.debug('Retrieved current epoch', { companyId, epoch });

    return success(epoch);
  } catch (err) {
    keyRotationLogger.error('Failed to get current epoch', err);
    return error(
      ErrorCode.DATABASE_ERROR,
      'Failed to get current epoch',
      err
    );
  }
}

/**
 * Verify that a client's key rotation epoch matches the current epoch
 *
 * This function is used to validate that a client is authorized to sync data.
 * If the client's epoch doesn't match, their access has been revoked through key rotation.
 *
 * @param companyId - Company ID to verify epoch for
 * @param clientEpoch - Epoch number from client
 * @returns Verification result
 *
 * @example
 * ```typescript
 * // During sync operation
 * const result = await verifyKeyRotationEpoch('company-123', clientEpoch);
 * if (result.success && result.data.valid) {
 *   // Allow sync
 * } else {
 *   // Reject sync - access revoked
 * }
 * ```
 */
export async function verifyKeyRotationEpoch(
  companyId: string,
  clientEpoch: number
): Promise<OperationResult<EpochVerificationResult>> {
  try {
    // IDOR protection: Validate companyId parameter
    const validationError = validateCompanyId(companyId);
    if (validationError) {
      keyRotationLogger.warn('Invalid companyId provided', { companyId });
      return error(
        ErrorCode.VALIDATION_ERROR,
        validationError.message,
        { companyId }
      );
    }

    // Validate clientEpoch
    if (!Number.isInteger(clientEpoch) || clientEpoch < 0) {
      keyRotationLogger.warn('Invalid client epoch', { companyId, clientEpoch });
      return error(
        ErrorCode.VALIDATION_ERROR,
        'Client epoch must be a non-negative integer',
        { clientEpoch }
      );
    }

    // Get current epoch
    const currentEpochResult = await getCurrentEpoch(companyId);
    if (!currentEpochResult.success) {
      return error(
        currentEpochResult.error!.code,
        currentEpochResult.error!.message,
        currentEpochResult.error!.details
      );
    }

    const currentEpoch = currentEpochResult.data!;
    const valid = clientEpoch === currentEpoch;

    if (!valid) {
      keyRotationLogger.warn('Epoch mismatch detected - access may be revoked', {
        companyId,
        currentEpoch,
        clientEpoch,
        difference: currentEpoch - clientEpoch,
      });
    }

    const result: EpochVerificationResult = {
      valid,
      currentEpoch,
      clientEpoch,
      message: valid
        ? 'Epoch verification successful'
        : 'Epoch mismatch - access may have been revoked',
    };

    return success(result);
  } catch (err) {
    keyRotationLogger.error('Failed to verify key rotation epoch', err);
    return error(
      ErrorCode.DATABASE_ERROR,
      'Failed to verify key rotation epoch',
      err
    );
  }
}

/**
 * Initialize key rotation epoch for a company if not set
 *
 * This is useful for migrating existing companies to the epoch system.
 *
 * @param companyId - Company ID to initialize epoch for
 * @returns Whether initialization was successful
 *
 * @example
 * ```typescript
 * // During migration or company setup
 * await initializeKeyRotationEpoch('company-123');
 * ```
 */
export async function initializeKeyRotationEpoch(
  companyId: string
): Promise<OperationResult<void>> {
  try {
    // IDOR protection: Validate companyId parameter
    const validationError = validateCompanyId(companyId);
    if (validationError) {
      keyRotationLogger.warn('Invalid companyId provided', { companyId });
      return error(
        ErrorCode.VALIDATION_ERROR,
        validationError.message,
        { companyId }
      );
    }

    // Fetch current company
    const company = await db.companies.get(companyId);
    if (!company) {
      keyRotationLogger.warn('Company not found', { companyId });
      return error(
        ErrorCode.NOT_FOUND,
        'Company not found'
      );
    }

    // Check if company is deleted (soft delete)
    if (company.deleted_at) {
      keyRotationLogger.warn('Cannot initialize epoch for deleted company', { companyId });
      return error(
        ErrorCode.NOT_FOUND,
        'Company not found'
      );
    }

    // Check if already initialized
    if (company.key_rotation_epoch !== undefined && company.key_rotation_epoch !== null) {
      keyRotationLogger.debug('Epoch already initialized', {
        companyId,
        epoch: company.key_rotation_epoch,
      });
      return success(undefined);
    }

    // Initialize to 0
    const deviceId = getDeviceId();
    await db.companies.update(companyId, {
      key_rotation_epoch: 0,
      updated_at: Date.now(),
      version_vector: incrementVersionVector(company.version_vector, deviceId),
    });

    keyRotationLogger.info('Key rotation epoch initialized', { companyId });

    return success(undefined);
  } catch (err) {
    keyRotationLogger.error('Failed to initialize key rotation epoch', err);
    return error(
      ErrorCode.DATABASE_ERROR,
      'Failed to initialize key rotation epoch',
      err
    );
  }
}
