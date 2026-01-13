/**
 * DISC Profile Schema Definition
 *
 * Defines the structure for DISC personality assessment results.
 * Supports adaptive UI/messaging based on communication preferences.
 *
 * Requirements:
 * - Store DISC assessment scores per user
 * - Support retake capability
 * - ARCH-004: CRDT-Compatible Schema Design
 * - ONB-004: DISC-adapted communication
 */

import type { VersionVector } from '../../types/database.types';

/**
 * DISC personality types
 */
export enum DISCType {
  DOMINANCE = 'D',
  INFLUENCE = 'I',
  STEADINESS = 'S',
  CONSCIENTIOUSNESS = 'C',
}

/**
 * DISC Profile scores
 */
export interface DISCScores {
  dominance: number; // 0-100 percentage
  influence: number; // 0-100 percentage
  steadiness: number; // 0-100 percentage
  conscientiousness: number; // 0-100 percentage
}

/**
 * DISC Profile assessment result
 */
export interface DISCProfile {
  id: string; // UUID v4
  user_id: string; // UUID - links to User
  scores: DISCScores; // ENCRYPTED - Assessment scores
  primary_type: DISCType; // Primary DISC type (highest score)
  secondary_type: DISCType | null; // Secondary type if close to primary
  assessment_date: number; // Unix timestamp when assessment was taken
  assessment_version: string; // Version of assessment (e.g., "1.0")
  answers: number[]; // ENCRYPTED - Array of answer indices (for retake/analysis)
  created_at: number; // Unix timestamp in milliseconds
  updated_at: number; // Unix timestamp in milliseconds
  deleted_at: number | null; // Tombstone marker for soft deletes
  version_vector: VersionVector; // For CRDT conflict resolution
}

/**
 * Dexie.js schema definition for DISC Profiles table
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - user_id: For querying profiles by user
 * - primary_type: For querying by DISC type
 * - assessment_date: For sorting by date
 * - updated_at: For CRDT conflict resolution (Last-Write-Wins)
 */
export const discProfilesSchema = 'id, user_id, primary_type, assessment_date, updated_at, deleted_at';

/**
 * Table name constant
 */
export const DISC_PROFILES_TABLE = 'disc_profiles';

/**
 * Default values for new DISC Profile
 */
export function createDefaultDISCProfile(
  userId: string,
  scores: DISCScores,
  answers: number[],
  deviceId: string
): Partial<DISCProfile> {
  const now = Date.now();

  // Determine primary type (highest score)
  const primaryType = determinePrimaryType(scores);

  // Determine secondary type (second highest if within 15% of primary)
  const secondaryType = determineSecondaryType(scores, primaryType);

  return {
    user_id: userId,
    scores,
    primary_type: primaryType,
    secondary_type: secondaryType,
    assessment_date: now,
    assessment_version: '1.0',
    answers,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version_vector: {
      [deviceId]: 1,
    },
  };
}

/**
 * Determine primary DISC type from scores
 */
export function determinePrimaryType(scores: DISCScores): DISCType {
  const types: Array<{ type: DISCType; score: number }> = [
    { type: DISCType.DOMINANCE, score: scores.dominance },
    { type: DISCType.INFLUENCE, score: scores.influence },
    { type: DISCType.STEADINESS, score: scores.steadiness },
    { type: DISCType.CONSCIENTIOUSNESS, score: scores.conscientiousness },
  ];

  // Sort by score descending
  types.sort((a, b) => b.score - a.score);

  return types[0]!.type;
}

/**
 * Determine secondary DISC type from scores
 * Returns secondary type if it's within 15% of primary
 */
export function determineSecondaryType(
  scores: DISCScores,
  _primaryType: DISCType
): DISCType | null {
  const types: Array<{ type: DISCType; score: number }> = [
    { type: DISCType.DOMINANCE, score: scores.dominance },
    { type: DISCType.INFLUENCE, score: scores.influence },
    { type: DISCType.STEADINESS, score: scores.steadiness },
    { type: DISCType.CONSCIENTIOUSNESS, score: scores.conscientiousness },
  ];

  // Sort by score descending
  types.sort((a, b) => b.score - a.score);

  const primary = types[0]!;
  const secondary = types[1]!;

  // Return secondary if within 15 points of primary
  if (primary.score - secondary.score <= 15) {
    return secondary.type;
  }

  return null;
}

/**
 * Validation: Ensure DISC profile has valid fields
 */
export function validateDISCProfile(profile: Partial<DISCProfile>): string[] {
  const errors: string[] = [];

  if (!profile.user_id) {
    errors.push('user_id is required');
  }

  if (!profile.scores) {
    errors.push('scores is required');
  } else {
    // Validate score ranges
    const { dominance, influence, steadiness, conscientiousness } = profile.scores;

    if (dominance < 0 || dominance > 100) {
      errors.push('dominance score must be between 0 and 100');
    }
    if (influence < 0 || influence > 100) {
      errors.push('influence score must be between 0 and 100');
    }
    if (steadiness < 0 || steadiness > 100) {
      errors.push('steadiness score must be between 0 and 100');
    }
    if (conscientiousness < 0 || conscientiousness > 100) {
      errors.push('conscientiousness score must be between 0 and 100');
    }
  }

  if (!profile.primary_type) {
    errors.push('primary_type is required');
  }

  if (!profile.answers || profile.answers.length === 0) {
    errors.push('answers array is required and cannot be empty');
  }

  if (!profile.assessment_version) {
    errors.push('assessment_version is required');
  }

  return errors;
}

/**
 * Helper: Get DISC type display name
 */
export function getDISCTypeDisplay(type: DISCType): string {
  const displays: Record<DISCType, string> = {
    [DISCType.DOMINANCE]: 'Dominance',
    [DISCType.INFLUENCE]: 'Influence',
    [DISCType.STEADINESS]: 'Steadiness',
    [DISCType.CONSCIENTIOUSNESS]: 'Conscientiousness',
  };
  return displays[type];
}

/**
 * Helper: Get DISC type description
 */
export function getDISCTypeDescription(type: DISCType): string {
  const descriptions: Record<DISCType, string> = {
    [DISCType.DOMINANCE]:
      'Direct, results-oriented, decisive. Prefers efficiency and clear outcomes.',
    [DISCType.INFLUENCE]:
      'Enthusiastic, optimistic, collaborative. Values relationships and positive experiences.',
    [DISCType.STEADINESS]:
      'Patient, supportive, reliable. Appreciates stability and sincere communication.',
    [DISCType.CONSCIENTIOUSNESS]:
      'Analytical, detail-oriented, systematic. Focuses on accuracy and thorough information.',
  };
  return descriptions[type];
}

/**
 * Helper: Get communication preferences for DISC type
 */
export interface CommunicationPreferences {
  tone: string;
  length: 'brief' | 'moderate' | 'detailed';
  emphasis: string;
  avoid: string;
}

export function getCommunicationPreferences(type: DISCType): CommunicationPreferences {
  const preferences: Record<DISCType, CommunicationPreferences> = {
    [DISCType.DOMINANCE]: {
      tone: 'Direct and confident',
      length: 'brief',
      emphasis: 'Results, efficiency, bottom line',
      avoid: 'Excessive detail, indecisiveness, wasting time',
    },
    [DISCType.INFLUENCE]: {
      tone: 'Enthusiastic and encouraging',
      length: 'moderate',
      emphasis: 'Positive outcomes, collaboration, recognition',
      avoid: 'Negativity, isolation, excessive criticism',
    },
    [DISCType.STEADINESS]: {
      tone: 'Warm and supportive',
      length: 'moderate',
      emphasis: 'Stability, sincerity, step-by-step guidance',
      avoid: 'Rushed decisions, conflict, sudden changes',
    },
    [DISCType.CONSCIENTIOUSNESS]: {
      tone: 'Professional and precise',
      length: 'detailed',
      emphasis: 'Accuracy, logic, thorough explanations',
      avoid: 'Vagueness, errors, emotional appeals',
    },
  };
  return preferences[type];
}

/**
 * Helper: Determine if profile is recent (within last 6 months)
 */
export function isProfileRecent(profile: DISCProfile): boolean {
  const sixMonthsAgo = Date.now() - 6 * 30 * 24 * 60 * 60 * 1000;
  return profile.assessment_date >= sixMonthsAgo;
}

/**
 * Helper: Calculate profile completion percentage from answers
 */
export function calculateCompletionPercentage(
  answersGiven: number,
  totalQuestions: number
): number {
  if (totalQuestions === 0) return 0;
  return Math.round((answersGiven / totalQuestions) * 100);
}
