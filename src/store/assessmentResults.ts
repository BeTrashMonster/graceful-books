/**
 * Assessment Results Data Access Layer
 *
 * Provides CRUD operations for assessment results and sessions with:
 * - Encryption/decryption integration points
 * - CRDT version vector management
 * - Soft delete with tombstone markers
 * - Save and resume capability
 *
 * Per ONB-001, ONB-003
 */

import { nanoid } from 'nanoid';
import { db } from './database';
import type { DatabaseResult, EncryptionContext } from './types';
import type {
  AssessmentResultEntity,
  AssessmentSessionEntity,
} from '../db/schema/assessmentResults.schema';
import {
  createDefaultAssessmentResult,
  createDefaultAssessmentSession,
  validateAssessmentResult,
  validateAssessmentSession,
} from '../db/schema/assessmentResults.schema';
import type {
  AssessmentResults,
  AssessmentAnswer,
  AssessmentSection,
} from '../features/assessment/types';
import { getDeviceId } from '../utils/device';

/**
 * Save assessment progress (create or update session)
 */
export async function saveAssessmentProgress(
  userId: string,
  answers: AssessmentAnswer[],
  currentSection: AssessmentSection,
  completedSections: AssessmentSection[],
  startedAt: number,
  context?: EncryptionContext
): Promise<DatabaseResult<AssessmentSessionEntity>> {
  try {
    const deviceId = getDeviceId();

    // Check if session already exists
    const existingSessions = await db.assessmentSessions
      .where('user_id')
      .equals(userId)
      .and((s) => !s.deleted_at)
      .toArray();

    let session: AssessmentSessionEntity;

    if (existingSessions.length > 0) {
      // Update existing session
      const existing = existingSessions[0]!;

      session = {
        ...existing,
        answers,
        current_section: currentSection,
        last_updated_at: Date.now(),
        completed_sections: completedSections,
        is_complete: false,
        updated_at: Date.now(),
        version_vector: {
          ...existing.version_vector,
          [deviceId]: (existing.version_vector[deviceId] || 0) + 1,
        },
      };

      // Apply encryption if service provided
      if (context?.encryptionService) {
        const { encryptionService } = context;
        session = {
          ...session,
          answers: JSON.parse(
            await encryptionService.encrypt(JSON.stringify(answers))
          ) as AssessmentAnswer[],
        };
      }

      await db.assessmentSessions.put(session);
    } else {
      // Create new session
      session = {
        id: nanoid(),
        ...createDefaultAssessmentSession(
          userId,
          answers,
          currentSection,
          completedSections,
          startedAt,
          deviceId
        ),
      } as AssessmentSessionEntity;

      // Validate
      const errors = validateAssessmentSession(session);
      if (errors.length > 0) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Validation failed: ${errors.join(', ')}`,
          },
        };
      }

      // Apply encryption if service provided
      if (context?.encryptionService) {
        const { encryptionService } = context;
        session = {
          ...session,
          answers: JSON.parse(
            await encryptionService.encrypt(JSON.stringify(answers))
          ) as AssessmentAnswer[],
        };
      }

      await db.assessmentSessions.add(session);
    }

    // Decrypt for return
    let result = session;
    if (context?.encryptionService) {
      const { encryptionService } = context;
      result = {
        ...session,
        answers: JSON.parse(
          await encryptionService.decrypt(JSON.stringify(session.answers))
        ) as AssessmentAnswer[],
      };
    }

    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}

/**
 * Get assessment progress for a user
 */
export async function getAssessmentProgress(
  userId: string,
  context?: EncryptionContext
): Promise<DatabaseResult<AssessmentSessionEntity | null>> {
  try {
    const sessions = await db.assessmentSessions
      .where('user_id')
      .equals(userId)
      .and((s) => !s.deleted_at)
      .sortBy('last_updated_at');

    if (sessions.length === 0) {
      return { success: true, data: null };
    }

    // Get most recent session
    let session = sessions[sessions.length - 1]!;

    // Decrypt if service provided
    if (context?.encryptionService) {
      const { encryptionService } = context;
      session = {
        ...session,
        answers: JSON.parse(
          await encryptionService.decrypt(JSON.stringify(session.answers))
        ) as AssessmentAnswer[],
      };
    }

    return { success: true, data: session };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}

/**
 * Complete assessment and save final results
 */
export async function completeAssessment(
  userId: string,
  results: AssessmentResults,
  answers: AssessmentAnswer[],
  context?: EncryptionContext
): Promise<DatabaseResult<AssessmentResultEntity>> {
  try {
    const deviceId = getDeviceId();

    // Create result entity
    let result: AssessmentResultEntity = {
      id: nanoid(),
      ...createDefaultAssessmentResult(userId, results, answers, deviceId),
    } as AssessmentResultEntity;

    // Validate
    const errors = validateAssessmentResult(result);
    if (errors.length > 0) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Validation failed: ${errors.join(', ')}`,
        },
      };
    }

    // Apply encryption if service provided
    if (context?.encryptionService) {
      const { encryptionService } = context;
      result = {
        ...result,
        results: JSON.parse(
          await encryptionService.encrypt(JSON.stringify(results))
        ) as AssessmentResults,
        answers: JSON.parse(
          await encryptionService.encrypt(JSON.stringify(answers))
        ) as AssessmentAnswer[],
      };
    }

    // Store in database
    await db.assessmentResults.add(result);

    // Delete any in-progress sessions
    const sessions = await db.assessmentSessions
      .where('user_id')
      .equals(userId)
      .and((s) => !s.deleted_at)
      .toArray();

    for (const session of sessions) {
      await db.assessmentSessions.update(session.id, {
        deleted_at: Date.now(),
        version_vector: {
          ...session.version_vector,
          [deviceId]: (session.version_vector[deviceId] || 0) + 1,
        },
      });
    }

    // Decrypt for return
    let decryptedResult = result;
    if (context?.encryptionService) {
      const { encryptionService } = context;
      decryptedResult = {
        ...result,
        results: JSON.parse(
          await encryptionService.decrypt(JSON.stringify(result.results))
        ) as AssessmentResults,
        answers: JSON.parse(
          await encryptionService.decrypt(JSON.stringify(result.answers))
        ) as AssessmentAnswer[],
      };
    }

    return { success: true, data: decryptedResult };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}

/**
 * Get most recent assessment results for a user
 */
export async function getUserAssessmentResults(
  userId: string,
  context?: EncryptionContext
): Promise<DatabaseResult<AssessmentResultEntity | null>> {
  try {
    const results = await db.assessmentResults
      .where('user_id')
      .equals(userId)
      .and((r) => !r.deleted_at)
      .sortBy('completed_at');

    if (results.length === 0) {
      return { success: true, data: null };
    }

    // Get most recent result
    let result = results[results.length - 1]!;

    // Decrypt if service provided
    if (context?.encryptionService) {
      const { encryptionService } = context;
      result = {
        ...result,
        results: JSON.parse(
          await encryptionService.decrypt(JSON.stringify(result.results))
        ) as AssessmentResults,
        answers: JSON.parse(
          await encryptionService.decrypt(JSON.stringify(result.answers))
        ) as AssessmentAnswer[],
      };
    }

    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}

/**
 * Get all assessment results for a user (history)
 */
export async function getUserAssessmentHistory(
  userId: string,
  includeDeleted: boolean = false,
  context?: EncryptionContext
): Promise<DatabaseResult<AssessmentResultEntity[]>> {
  try {
    let query = db.assessmentResults.where('user_id').equals(userId);

    if (!includeDeleted) {
      query = query.and((r) => !r.deleted_at);
    }

    const results = await query.sortBy('completed_at');

    // Decrypt if service provided
    let decryptedResults = results;
    if (context?.encryptionService) {
      const { encryptionService } = context;
      decryptedResults = await Promise.all(
        results.map(async (result) => ({
          ...result,
          results: JSON.parse(
            await encryptionService.decrypt(JSON.stringify(result.results))
          ) as AssessmentResults,
          answers: JSON.parse(
            await encryptionService.decrypt(JSON.stringify(result.answers))
          ) as AssessmentAnswer[],
        }))
      );
    }

    return { success: true, data: decryptedResults };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}

/**
 * Delete assessment results (soft delete)
 */
export async function deleteAssessmentResults(
  id: string
): Promise<DatabaseResult<void>> {
  try {
    const existing = await db.assessmentResults.get(id);

    if (!existing) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Assessment results not found: ${id}`,
        },
      };
    }

    if (existing.deleted_at) {
      return { success: true, data: undefined }; // Already deleted
    }

    // Soft delete
    const deviceId = getDeviceId();
    await db.assessmentResults.update(id, {
      deleted_at: Date.now(),
      version_vector: {
        ...existing.version_vector,
        [deviceId]: (existing.version_vector[deviceId] || 0) + 1,
      },
    });

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}

/**
 * Delete assessment session (soft delete)
 */
export async function deleteAssessmentSession(
  id: string
): Promise<DatabaseResult<void>> {
  try {
    const existing = await db.assessmentSessions.get(id);

    if (!existing) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Assessment session not found: ${id}`,
        },
      };
    }

    if (existing.deleted_at) {
      return { success: true, data: undefined }; // Already deleted
    }

    // Soft delete
    const deviceId = getDeviceId();
    await db.assessmentSessions.update(id, {
      deleted_at: Date.now(),
      version_vector: {
        ...existing.version_vector,
        [deviceId]: (existing.version_vector[deviceId] || 0) + 1,
      },
    });

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}
