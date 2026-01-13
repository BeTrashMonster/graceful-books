/**
 * Assessment Results Schema Definition
 *
 * Stores completed onboarding assessments and their results.
 * Supports retake capability and progress tracking.
 *
 * Per ONB-001, ONB-003
 * Per ARCH-004: CRDT-Compatible Schema Design
 */

import type { VersionVector } from '../../types/database.types';
import type { AssessmentResults, AssessmentAnswer } from '../../features/assessment/types';

/**
 * Assessment result entity (database record)
 */
export interface AssessmentResultEntity {
  id: string; // UUID v4
  user_id: string; // UUID - links to User
  results: AssessmentResults; // ENCRYPTED - Complete assessment results
  answers: AssessmentAnswer[]; // ENCRYPTED - All answers for retake/analysis
  completed_at: number; // Unix timestamp when assessment was completed
  version: string; // Assessment version (e.g., "1.0")
  created_at: number; // Unix timestamp in milliseconds
  updated_at: number; // Unix timestamp in milliseconds
  deleted_at: number | null; // Tombstone marker for soft deletes
  version_vector: VersionVector; // For CRDT conflict resolution
}

/**
 * In-progress assessment session (for save/resume)
 */
export interface AssessmentSessionEntity {
  id: string; // UUID v4
  user_id: string; // UUID - links to User
  answers: AssessmentAnswer[]; // ENCRYPTED - Answers so far
  current_section: string; // Current section ID
  started_at: number; // Unix timestamp when started
  last_updated_at: number; // Unix timestamp of last update
  completed_sections: string[]; // Array of completed section IDs
  is_complete: boolean; // Whether all required questions answered
  created_at: number; // Unix timestamp in milliseconds
  updated_at: number; // Unix timestamp in milliseconds
  deleted_at: number | null; // Tombstone marker for soft deletes
  version_vector: VersionVector; // For CRDT conflict resolution
}

/**
 * Dexie.js schema definition for Assessment Results table
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - user_id: For querying results by user
 * - completed_at: For sorting by completion date
 * - updated_at: For CRDT conflict resolution (Last-Write-Wins)
 */
export const assessmentResultsSchema = 'id, user_id, completed_at, updated_at, deleted_at';

/**
 * Dexie.js schema definition for Assessment Sessions table
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - user_id: For querying sessions by user
 * - last_updated_at: For finding most recent session
 * - updated_at: For CRDT conflict resolution
 */
export const assessmentSessionsSchema = 'id, user_id, last_updated_at, updated_at, deleted_at';

/**
 * Table name constants
 */
export const ASSESSMENT_RESULTS_TABLE = 'assessment_results';
export const ASSESSMENT_SESSIONS_TABLE = 'assessment_sessions';

/**
 * Create default assessment result entity
 */
export function createDefaultAssessmentResult(
  userId: string,
  results: AssessmentResults,
  answers: AssessmentAnswer[],
  deviceId: string
): Partial<AssessmentResultEntity> {
  const now = Date.now();

  return {
    user_id: userId,
    results,
    answers,
    completed_at: now,
    version: '1.0',
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version_vector: {
      [deviceId]: 1,
    },
  };
}

/**
 * Create default assessment session entity
 */
export function createDefaultAssessmentSession(
  userId: string,
  answers: AssessmentAnswer[],
  currentSection: string,
  completedSections: string[],
  startedAt: number,
  deviceId: string
): Partial<AssessmentSessionEntity> {
  const now = Date.now();

  return {
    user_id: userId,
    answers,
    current_section: currentSection,
    started_at: startedAt,
    last_updated_at: now,
    completed_sections: completedSections,
    is_complete: false,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version_vector: {
      [deviceId]: 1,
    },
  };
}

/**
 * Validation: Ensure assessment result has valid fields
 */
export function validateAssessmentResult(result: Partial<AssessmentResultEntity>): string[] {
  const errors: string[] = [];

  if (!result.user_id) {
    errors.push('user_id is required');
  }

  if (!result.results) {
    errors.push('results is required');
  } else {
    // Validate results structure
    if (!result.results.phase) {
      errors.push('results.phase is required');
    }
    if (!result.results.literacyLevel) {
      errors.push('results.literacyLevel is required');
    }
    if (!result.results.businessType) {
      errors.push('results.businessType is required');
    }
  }

  if (!result.answers || !Array.isArray(result.answers)) {
    errors.push('answers array is required');
  }

  if (!result.version) {
    errors.push('version is required');
  }

  if (!result.completed_at) {
    errors.push('completed_at is required');
  }

  return errors;
}

/**
 * Validation: Ensure assessment session has valid fields
 */
export function validateAssessmentSession(session: Partial<AssessmentSessionEntity>): string[] {
  const errors: string[] = [];

  if (!session.user_id) {
    errors.push('user_id is required');
  }

  if (!session.answers || !Array.isArray(session.answers)) {
    errors.push('answers array is required');
  }

  if (!session.current_section) {
    errors.push('current_section is required');
  }

  if (!session.started_at) {
    errors.push('started_at is required');
  }

  if (!session.completed_sections || !Array.isArray(session.completed_sections)) {
    errors.push('completed_sections array is required');
  }

  return errors;
}

/**
 * Helper: Check if assessment result is recent (within last 6 months)
 */
export function isAssessmentRecent(result: AssessmentResultEntity): boolean {
  const sixMonthsAgo = Date.now() - 6 * 30 * 24 * 60 * 60 * 1000;
  return result.completed_at >= sixMonthsAgo;
}

/**
 * Helper: Check if session is stale (older than 7 days)
 */
export function isSessionStale(session: AssessmentSessionEntity): boolean {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return session.last_updated_at < sevenDaysAgo;
}

/**
 * Helper: Calculate session progress percentage
 */
export function calculateSessionProgress(session: AssessmentSessionEntity): number {
  if (!session.answers || session.answers.length === 0) {
    return 0;
  }

  // Assuming average of 17 questions (from question definitions)
  const estimatedTotalQuestions = 17;
  const progress = (session.answers.length / estimatedTotalQuestions) * 100;

  return Math.min(100, Math.round(progress));
}
