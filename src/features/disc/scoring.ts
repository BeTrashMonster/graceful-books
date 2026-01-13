/**
 * DISC Scoring Algorithm
 *
 * Calculates DISC personality scores from assessment answers.
 * Uses weighted scoring based on question responses.
 */

import { DISCType } from '../../db/schema/discProfile.schema';
import type { DISCScores } from '../../db/schema/discProfile.schema';
import { DISC_QUESTIONS, validateAnswers, validateAnswerValue } from './questions';

/**
 * Result of scoring calculation
 */
export interface ScoringResult {
  scores: DISCScores;
  rawScores: DISCScores; // Unormalized scores
  confidence: number; // 0-100 confidence in the assessment
}

/**
 * Calculate DISC scores from answers
 *
 * @param answers Array of answer values (0-3 for each question)
 * @returns Scoring result with normalized scores
 */
export function calculateDISCScores(answers: number[]): ScoringResult {
  // Validate inputs
  if (!validateAnswers(answers)) {
    throw new Error(
      `Invalid answers length: expected ${DISC_QUESTIONS.length}, got ${answers.length}`
    );
  }

  for (let i = 0; i < answers.length; i++) {
    if (!validateAnswerValue(answers[i]!)) {
      throw new Error(`Invalid answer value at index ${i}: ${answers[i]}`);
    }
  }

  // Initialize raw scores
  const rawScores: DISCScores = {
    dominance: 0,
    influence: 0,
    steadiness: 0,
    conscientiousness: 0,
  };

  // Calculate weighted scores
  DISC_QUESTIONS.forEach((question, index) => {
    const answerValue = answers[index]!;
    const weights = question.weights;

    // Apply weights to each dimension
    rawScores.dominance += answerValue * weights[DISCType.DOMINANCE];
    rawScores.influence += answerValue * weights[DISCType.INFLUENCE];
    rawScores.steadiness += answerValue * weights[DISCType.STEADINESS];
    rawScores.conscientiousness += answerValue * weights[DISCType.CONSCIENTIOUSNESS];
  });

  // Normalize scores to 0-100 scale
  const normalizedScores = normalizeScores(rawScores);

  // Calculate confidence based on answer variance
  const confidence = calculateConfidence(answers, normalizedScores);

  return {
    scores: normalizedScores,
    rawScores,
    confidence,
  };
}

/**
 * Normalize raw scores to 0-100 scale
 *
 * Uses min-max normalization to ensure all scores are on the same scale.
 * This accounts for negative weights and different ranges.
 */
function normalizeScores(rawScores: DISCScores): DISCScores {
  // Find theoretical min and max possible scores
  // Based on weights and answer range (0-3)
  const theoreticalMin = calculateTheoreticalMin();
  const theoreticalMax = calculateTheoreticalMax();

  // Normalize each dimension
  const normalize = (score: number, min: number, max: number): number => {
    if (max === min) return 50; // Avoid division by zero
    const normalized = ((score - min) / (max - min)) * 100;
    return Math.max(0, Math.min(100, normalized)); // Clamp to 0-100
  };

  return {
    dominance: Math.round(
      normalize(rawScores.dominance, theoreticalMin.dominance, theoreticalMax.dominance)
    ),
    influence: Math.round(
      normalize(rawScores.influence, theoreticalMin.influence, theoreticalMax.influence)
    ),
    steadiness: Math.round(
      normalize(rawScores.steadiness, theoreticalMin.steadiness, theoreticalMax.steadiness)
    ),
    conscientiousness: Math.round(
      normalize(
        rawScores.conscientiousness,
        theoreticalMin.conscientiousness,
        theoreticalMax.conscientiousness
      )
    ),
  };
}

/**
 * Calculate theoretical minimum scores for each dimension
 * For each question, choose the answer (0 or 3) that produces the lowest score
 */
function calculateTheoreticalMin(): DISCScores {
  const min: DISCScores = {
    dominance: 0,
    influence: 0,
    steadiness: 0,
    conscientiousness: 0,
  };

  DISC_QUESTIONS.forEach((question) => {
    const weights = question.weights;

    // For each dimension, pick the answer value that minimizes the score
    // If weight is positive, answer 0 minimizes; if negative, answer 3 minimizes
    min.dominance += weights[DISCType.DOMINANCE] < 0
      ? weights[DISCType.DOMINANCE] * 3
      : 0;
    min.influence += weights[DISCType.INFLUENCE] < 0
      ? weights[DISCType.INFLUENCE] * 3
      : 0;
    min.steadiness += weights[DISCType.STEADINESS] < 0
      ? weights[DISCType.STEADINESS] * 3
      : 0;
    min.conscientiousness += weights[DISCType.CONSCIENTIOUSNESS] < 0
      ? weights[DISCType.CONSCIENTIOUSNESS] * 3
      : 0;
  });

  return min;
}

/**
 * Calculate theoretical maximum scores for each dimension
 * For each question, choose the answer (0 or 3) that produces the highest score
 */
function calculateTheoreticalMax(): DISCScores {
  const max: DISCScores = {
    dominance: 0,
    influence: 0,
    steadiness: 0,
    conscientiousness: 0,
  };

  DISC_QUESTIONS.forEach((question) => {
    const weights = question.weights;

    // For each dimension, pick the answer value that maximizes the score
    // If weight is positive, answer 3 maximizes; if negative, answer 0 maximizes (contributes 0)
    max.dominance += weights[DISCType.DOMINANCE] > 0
      ? weights[DISCType.DOMINANCE] * 3
      : 0;
    max.influence += weights[DISCType.INFLUENCE] > 0
      ? weights[DISCType.INFLUENCE] * 3
      : 0;
    max.steadiness += weights[DISCType.STEADINESS] > 0
      ? weights[DISCType.STEADINESS] * 3
      : 0;
    max.conscientiousness += weights[DISCType.CONSCIENTIOUSNESS] > 0
      ? weights[DISCType.CONSCIENTIOUSNESS] * 3
      : 0;
  });

  return max;
}

/**
 * Calculate confidence in the assessment results
 *
 * Confidence is higher when:
 * - Clear differentiation between scores
 * - Consistent answer patterns
 * - Fewer neutral answers (1 or 2)
 *
 * @returns Confidence score 0-100
 */
function calculateConfidence(answers: number[], scores: DISCScores): number {
  let confidenceScore = 100;

  // Factor 1: Score differentiation (30 points)
  // Higher differentiation = more confidence
  const scoreArray = Object.values(scores);
  const maxScore = Math.max(...scoreArray);
  const minScore = Math.min(...scoreArray);
  const scoreDifferentiation = maxScore - minScore;

  if (scoreDifferentiation < 20) {
    confidenceScore -= 30; // Very low differentiation
  } else if (scoreDifferentiation < 35) {
    confidenceScore -= 15; // Moderate differentiation
  }
  // High differentiation (35+) = no penalty

  // Factor 2: Answer extremity (34 points)
  // More extreme answers (0 or 3) = more confidence
  const extremeAnswers = answers.filter((a) => a === 0 || a === 3).length;
  const extremeRatio = extremeAnswers / answers.length;

  if (extremeRatio < 0.2) {
    confidenceScore -= 34; // Very few extreme answers
  } else if (extremeRatio < 0.4) {
    confidenceScore -= 14; // Some extreme answers
  }
  // High extreme ratio (0.4+) = no penalty

  // Factor 3: Answer variance (30 points)
  // Higher variance = more discriminating answers
  const mean = answers.reduce((sum, a) => sum + a, 0) / answers.length;
  const variance =
    answers.reduce((sum, a) => sum + Math.pow(a - mean, 2), 0) / answers.length;

  if (variance < 0.5) {
    confidenceScore -= 30; // Very low variance (all similar answers)
  } else if (variance < 1.0) {
    confidenceScore -= 15; // Moderate variance
  }
  // High variance (1.0+) = no penalty

  return Math.max(0, Math.min(100, confidenceScore));
}

/**
 * Get score interpretation text
 */
export function getScoreInterpretation(score: number): string {
  if (score >= 70) {
    return 'Very High';
  } else if (score >= 55) {
    return 'High';
  } else if (score >= 45) {
    return 'Moderate';
  } else if (score >= 30) {
    return 'Low';
  } else {
    return 'Very Low';
  }
}

/**
 * Compare two DISC profiles
 * Returns similarity score (0-100)
 */
export function compareProfiles(profile1: DISCScores, profile2: DISCScores): number {
  const dimensions: Array<keyof DISCScores> = [
    'dominance',
    'influence',
    'steadiness',
    'conscientiousness',
  ];

  let totalDifference = 0;

  dimensions.forEach((dimension) => {
    const diff = Math.abs(profile1[dimension] - profile2[dimension]);
    totalDifference += diff;
  });

  // Average difference across all dimensions
  const avgDifference = totalDifference / dimensions.length;

  // Convert to similarity score (0-100)
  // Maximum possible average difference is 100
  const similarity = 100 - avgDifference;

  return Math.round(similarity);
}

/**
 * Export scoring result to plain object (for storage)
 */
export function exportScoringResult(result: ScoringResult): {
  scores: DISCScores;
  confidence: number;
} {
  return {
    scores: result.scores,
    confidence: result.confidence,
  };
}
