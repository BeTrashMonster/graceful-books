/**
 * DISC Message Adapter Utility
 *
 * Matches messages to DISC personality types and provides
 * fallback logic for missing variants.
 */

import type { DISCType } from '../features/messaging/messageLibrary';

export interface DISCProfile {
  dominanceScore: number;
  influenceScore: number;
  steadinessScore: number;
  conscientiousnessScore: number;
  primaryStyle: DISCType;
  secondaryStyle: DISCType;
  manualOverride?: boolean;
}

/**
 * Default DISC profile (Steadiness-focused)
 * Used for new users or when profile retrieval fails
 */
export const DEFAULT_DISC_PROFILE: DISCProfile = {
  dominanceScore: 25,
  influenceScore: 25,
  steadinessScore: 100,
  conscientiousnessScore: 25,
  primaryStyle: 'S',
  secondaryStyle: 'C',
  manualOverride: false,
};

/**
 * Get primary DISC style from profile
 * Returns 'S' (Steadiness) as default fallback
 */
export function getPrimaryStyle(profile: DISCProfile | null | undefined): DISCType {
  if (!profile) {
    return 'S';
  }

  // If manual override is enabled, use default Steadiness style
  if (profile.manualOverride) {
    return 'S';
  }

  return profile.primaryStyle || 'S';
}

/**
 * Get secondary DISC style from profile
 * Returns 'C' (Conscientiousness) as default fallback
 */
export function getSecondaryStyle(profile: DISCProfile | null | undefined): DISCType {
  if (!profile) {
    return 'C';
  }

  // If manual override is enabled, use default Conscientiousness style
  if (profile.manualOverride) {
    return 'C';
  }

  return profile.secondaryStyle || 'C';
}

/**
 * Calculate primary and secondary styles from DISC scores
 * Implements tiebreaker order: S, C, I, D (most supportive to most direct)
 */
export function calculateStyles(
  scores: Pick<DISCProfile, 'dominanceScore' | 'influenceScore' | 'steadinessScore' | 'conscientiousnessScore'>
): Pick<DISCProfile, 'primaryStyle' | 'secondaryStyle'> {
  const scoreMap: Array<[DISCType, number]> = [
    ['D', scores.dominanceScore],
    ['I', scores.influenceScore],
    ['S', scores.steadinessScore],
    ['C', scores.conscientiousnessScore],
  ];

  // Sort by score (descending), with tiebreaker order: S, C, I, D
  const tiebreaker: Record<DISCType, number> = { S: 4, C: 3, I: 2, D: 1 };
  scoreMap.sort((a, b) => {
    if (b[1] !== a[1]) {
      return b[1] - a[1]; // Higher score first
    }
    return tiebreaker[b[0]] - tiebreaker[a[0]]; // Tiebreaker order
  });

  return {
    primaryStyle: scoreMap[0]?.[0] ?? 'S',
    secondaryStyle: scoreMap[1]?.[0] ?? 'C',
  };
}

/**
 * Validate DISC scores
 * All scores must be 0-100, and at least one score must be >50
 */
export function validateDISCScores(scores: {
  dominanceScore: number;
  influenceScore: number;
  steadinessScore: number;
  conscientiousnessScore: number;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check all scores are in valid range
  const scoreEntries = Object.entries(scores);
  for (const [key, value] of scoreEntries) {
    if (typeof value !== 'number' || value < 0 || value > 100) {
      errors.push(`${key} must be between 0 and 100 (got ${value})`);
    }
  }

  // Check at least one score is >50
  const maxScore = Math.max(
    scores.dominanceScore,
    scores.influenceScore,
    scores.steadinessScore,
    scores.conscientiousnessScore
  );
  if (maxScore <= 50) {
    errors.push('At least one DISC score must be greater than 50');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Create a complete DISC profile from scores
 */
export function createDISCProfile(scores: {
  dominanceScore: number;
  influenceScore: number;
  steadinessScore: number;
  conscientiousnessScore: number;
}): DISCProfile {
  const validation = validateDISCScores(scores);
  if (!validation.valid) {
    throw new Error(`Invalid DISC scores: ${validation.errors.join(', ')}`);
  }

  const styles = calculateStyles(scores);

  return {
    ...scores,
    ...styles,
    manualOverride: false,
  };
}

/**
 * Get fallback DISC style when a variant is missing
 * Fallback order: primary -> secondary -> S (default) -> D
 */
export function getFallbackStyle(
  profile: DISCProfile | null | undefined,
  availableStyles: DISCType[]
): DISCType {
  const primary = getPrimaryStyle(profile);
  const secondary = getSecondaryStyle(profile);

  // Try primary style first
  if (availableStyles.includes(primary)) {
    return primary;
  }

  // Try secondary style
  if (availableStyles.includes(secondary)) {
    return secondary;
  }

  // Fall back to Steadiness (S) - most universally supportive
  if (availableStyles.includes('S')) {
    return 'S';
  }

  // Final fallback to first available style
  return availableStyles[0] || 'S';
}
