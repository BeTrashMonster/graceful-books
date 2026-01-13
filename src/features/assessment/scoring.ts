/**
 * Assessment Scoring Algorithms
 *
 * Calculates phase and literacy scores from assessment answers.
 * Uses weighted scoring based on question responses.
 *
 * Per ONB-003
 */

import {
  BusinessPhase,
  FinancialLiteracyLevel,
  RevenueRange,
} from './types';
import type {
  AssessmentAnswer,
  RawAssessmentScores,
} from './types';
import { ASSESSMENT_QUESTIONS, getQuestionById } from './questions';

/**
 * Calculate raw scores from answers
 */
export function calculateRawScores(answers: Map<string, AssessmentAnswer>): RawAssessmentScores {
  const phaseScores = {
    [BusinessPhase.STABILIZE]: 0,
    [BusinessPhase.ORGANIZE]: 0,
    [BusinessPhase.BUILD]: 0,
    [BusinessPhase.GROW]: 0,
  };

  const literacyScores = {
    [FinancialLiteracyLevel.BEGINNER]: 0,
    [FinancialLiteracyLevel.INTERMEDIATE]: 0,
    [FinancialLiteracyLevel.ADVANCED]: 0,
  };

  // Process each answer
  answers.forEach((answer, questionId) => {
    const question = getQuestionById(questionId);
    if (!question || !question.weights) {
      return;
    }

    // Apply phase weights
    if (question.weights.phase) {
      const phaseWeights = question.weights.phase;
      const multiplier = getAnswerMultiplier(question.id, answer.value);

      Object.entries(phaseWeights).forEach(([phase, weight]) => {
        if (weight) {
          phaseScores[phase as BusinessPhase] += weight * multiplier;
        }
      });
    }

    // Apply literacy weights
    if (question.weights.literacy) {
      const literacyWeights = question.weights.literacy;
      const multiplier = getAnswerMultiplier(question.id, answer.value);

      Object.entries(literacyWeights).forEach(([level, weight]) => {
        if (weight) {
          literacyScores[level as FinancialLiteracyLevel] += weight * multiplier;
        }
      });
    }
  });

  return {
    phaseScores,
    literacyScores,
  };
}

/**
 * Get scoring multiplier based on answer value
 * Different questions have different scoring patterns
 */
function getAnswerMultiplier(
  questionId: string,
  value: string | number | string[] | number[]
): number {
  // Revenue-based scoring (higher revenue = more advanced phase)
  if (questionId === 'revenue_range') {
    const revenueMultipliers: Record<string, number> = {
      [RevenueRange.ZERO_TO_25K]: 1.0,
      [RevenueRange.TWENTY_FIVE_TO_100K]: 0.7,
      [RevenueRange.ONE_HUNDRED_TO_500K]: 0.4,
      [RevenueRange.FIVE_HUNDRED_K_TO_1M]: 0.2,
      [RevenueRange.OVER_1M]: 0.1,
    };
    return revenueMultipliers[value as string] || 1.0;
  }

  // Cash knowledge scoring (not knowing = beginner/stabilize)
  if (questionId === 'knows_current_cash') {
    const cashMultipliers: Record<string, number> = {
      yes_exact: 0.2,
      yes_roughly: 0.5,
      no: 0.8,
      no_idea: 1.0,
    };
    return cashMultipliers[value as string] || 1.0;
  }

  // Expense tracking scoring
  if (questionId === 'tracks_expenses') {
    const trackingMultipliers: Record<string, number> = {
      none: 1.0,
      shoebox: 0.8,
      spreadsheet: 0.5,
      software: 0.2,
      accountant: 0.1,
    };
    return trackingMultipliers[value as string] || 1.0;
  }

  // Reconciliation frequency scoring
  if (questionId === 'reconciles_bank') {
    const reconMultipliers: Record<string, number> = {
      never: 1.0,
      rarely: 0.8,
      quarterly: 0.6,
      monthly: 0.3,
      weekly: 0.1,
    };
    return reconMultipliers[value as string] || 1.0;
  }

  // Separate accounts scoring
  if (questionId === 'separates_accounts') {
    const separateMultipliers: Record<string, number> = {
      no: 1.0,
      planning: 0.7,
      yes: 0.2,
    };
    return separateMultipliers[value as string] || 1.0;
  }

  // Accounting knowledge scoring
  if (questionId === 'understands_debits_credits') {
    const debitMultipliers: Record<string, number> = {
      no_idea: 1.0,
      heard: 0.8,
      basic: 0.5,
      comfortable: 0.2,
      expert: 0.0,
    };
    return debitMultipliers[value as string] || 1.0;
  }

  // Report reading scoring
  if (questionId === 'reads_financial_reports') {
    const reportMultipliers: Record<string, number> = {
      never_seen: 1.0,
      confused: 0.8,
      basics: 0.5,
      comfortable: 0.2,
      expert: 0.0,
    };
    return reportMultipliers[value as string] || 1.0;
  }

  // Bookkeeping time scoring (more time = more complex business)
  if (questionId === 'bookkeeping_time') {
    const timeMultipliers: Record<string, number> = {
      none: 1.0,
      less_than_hour: 0.8,
      few_hours: 0.6,
      many_hours: 0.4,
      full_time: 0.2,
    };
    return timeMultipliers[value as string] || 1.0;
  }

  // Software experience scoring
  if (questionId === 'previous_software') {
    const softwareMultipliers: Record<string, number> = {
      never: 1.0,
      tried: 0.8,
      basic: 0.4,
      experienced: 0.1,
    };
    return softwareMultipliers[value as string] || 1.0;
  }

  // Goal-based scoring
  if (questionId === 'primary_goal') {
    const goalMultipliers: Record<string, number> = {
      tax_ready: 1.0,
      understand_finances: 0.9,
      save_time: 0.6,
      grow_business: 0.4,
      peace_of_mind: 0.8,
    };
    return goalMultipliers[value as string] || 1.0;
  }

  // Timeline scoring
  if (questionId === 'timeline') {
    const timelineMultipliers: Record<string, number> = {
      urgent: 1.0,
      soon: 0.8,
      few_months: 0.5,
      building: 0.3,
    };
    return timelineMultipliers[value as string] || 1.0;
  }

  // Stress level scoring (scale 1-5)
  if (questionId === 'stress_level') {
    if (typeof value === 'number') {
      // Higher stress = more likely in stabilize phase
      return value / 5; // Normalize to 0-1
    }
    return 0.5;
  }

  // Multiple choice questions - count selections
  if (questionId === 'biggest_challenge' && Array.isArray(value)) {
    // More challenges = more complex situation
    return Math.min(value.length / 3, 1.0);
  }

  // Boolean questions
  if (questionId === 'has_employees' || questionId === 'has_sales_tax' || questionId === 'has_inventory') {
    return value === 'yes' || value === 'both' ? 0.8 : 1.0;
  }

  // Default: use answer as-is
  return 1.0;
}

/**
 * Normalize scores to 0-100 scale
 */
export function normalizeScores(rawScores: RawAssessmentScores): RawAssessmentScores {
  // Find max scores for normalization
  const maxPhaseScore = Math.max(...Object.values(rawScores.phaseScores));
  const maxLiteracyScore = Math.max(...Object.values(rawScores.literacyScores));

  // Avoid division by zero
  const phaseNormalizer = maxPhaseScore > 0 ? 100 / maxPhaseScore : 1;
  const literacyNormalizer = maxLiteracyScore > 0 ? 100 / maxLiteracyScore : 1;

  return {
    phaseScores: {
      [BusinessPhase.STABILIZE]: Math.round(rawScores.phaseScores[BusinessPhase.STABILIZE] * phaseNormalizer),
      [BusinessPhase.ORGANIZE]: Math.round(rawScores.phaseScores[BusinessPhase.ORGANIZE] * phaseNormalizer),
      [BusinessPhase.BUILD]: Math.round(rawScores.phaseScores[BusinessPhase.BUILD] * phaseNormalizer),
      [BusinessPhase.GROW]: Math.round(rawScores.phaseScores[BusinessPhase.GROW] * phaseNormalizer),
    },
    literacyScores: {
      [FinancialLiteracyLevel.BEGINNER]: Math.round(rawScores.literacyScores[FinancialLiteracyLevel.BEGINNER] * literacyNormalizer),
      [FinancialLiteracyLevel.INTERMEDIATE]: Math.round(rawScores.literacyScores[FinancialLiteracyLevel.INTERMEDIATE] * literacyNormalizer),
      [FinancialLiteracyLevel.ADVANCED]: Math.round(rawScores.literacyScores[FinancialLiteracyLevel.ADVANCED] * literacyNormalizer),
    },
  };
}

/**
 * Calculate confidence score based on answer patterns
 * Higher confidence when answers are consistent and decisive
 */
export function calculateConfidence(
  scores: { [key: string]: number },
  answers: Map<string, AssessmentAnswer>
): number {
  let confidence = 100;

  // Factor 1: Score differentiation (30 points)
  const scoreValues = Object.values(scores);
  const maxScore = Math.max(...scoreValues);
  const minScore = Math.min(...scoreValues);
  const differentiation = maxScore - minScore;

  if (differentiation < 15) {
    confidence -= 30; // Very low differentiation
  } else if (differentiation < 30) {
    confidence -= 15; // Moderate differentiation
  }
  // High differentiation (30+) = no penalty

  // Factor 2: Answer completeness (20 points)
  const totalQuestions = ASSESSMENT_QUESTIONS.length;
  const answeredQuestions = answers.size;
  const completeness = answeredQuestions / totalQuestions;

  if (completeness < 0.7) {
    confidence -= 20; // Many unanswered questions
  } else if (completeness < 0.9) {
    confidence -= 10; // Some unanswered questions
  }
  // Complete (90%+) = no penalty

  // Factor 3: Decisive answers (20 points)
  // Check for "not sure" or middle-ground answers
  let indecisiveCount = 0;
  answers.forEach((answer) => {
    const value = answer.value;
    if (value === 'not_sure' || value === 'planning') {
      indecisiveCount++;
    }
    // Middle scale values (2-3 on a 1-5 scale) are also less decisive
    if (typeof value === 'number' && value >= 2 && value <= 3) {
      indecisiveCount += 0.5;
    }
  });

  const indecisiveRatio = indecisiveCount / answeredQuestions;
  if (indecisiveRatio > 0.3) {
    confidence -= 20; // Many indecisive answers
  } else if (indecisiveRatio > 0.15) {
    confidence -= 10; // Some indecisive answers
  }

  // Factor 4: Consistency (30 points)
  // Check for contradictory answers
  const hasContradictions = checkForContradictions(answers);
  if (hasContradictions) {
    confidence -= 30;
  }

  return Math.max(0, Math.min(100, confidence));
}

/**
 * Check for contradictory answers
 */
function checkForContradictions(answers: Map<string, AssessmentAnswer>): boolean {
  // Example contradictions:
  // - Says they reconcile never, but tracks expenses in software
  const reconciles = answers.get('reconciles_bank')?.value;
  const tracks = answers.get('tracks_expenses')?.value;

  if (reconciles === 'weekly' && tracks === 'none') {
    return true;
  }

  // - Says they're expert at debits/credits but never read reports
  const debits = answers.get('understands_debits_credits')?.value;
  const reports = answers.get('reads_financial_reports')?.value;

  if (debits === 'expert' && reports === 'never_seen') {
    return true;
  }

  // - High revenue but no separate accounts
  const revenue = answers.get('revenue_range')?.value;
  const separate = answers.get('separates_accounts')?.value;

  if (
    (revenue === RevenueRange.FIVE_HUNDRED_K_TO_1M || revenue === RevenueRange.OVER_1M) &&
    separate === 'no'
  ) {
    return true;
  }

  return false;
}

/**
 * Get score interpretation text
 */
export function getScoreInterpretation(score: number): string {
  if (score >= 70) {
    return 'Very High';
  } else if (score >= 50) {
    return 'High';
  } else if (score >= 30) {
    return 'Moderate';
  } else if (score >= 15) {
    return 'Low';
  } else {
    return 'Very Low';
  }
}

/**
 * Get phase name
 */
export function getPhaseName(phase: BusinessPhase): string {
  const names: Record<BusinessPhase, string> = {
    [BusinessPhase.STABILIZE]: 'Stabilize',
    [BusinessPhase.ORGANIZE]: 'Organize',
    [BusinessPhase.BUILD]: 'Build',
    [BusinessPhase.GROW]: 'Grow',
  };
  return names[phase];
}

/**
 * Get phase description
 */
export function getPhaseDescription(phase: BusinessPhase): string {
  const descriptions: Record<BusinessPhase, string> = {
    [BusinessPhase.STABILIZE]:
      "You're focused on getting your finances under control and building a solid foundation.",
    [BusinessPhase.ORGANIZE]:
      "You're setting up systems and processes to make your financial life easier.",
    [BusinessPhase.BUILD]:
      "You're ready to scale your operations with more sophisticated tools.",
    [BusinessPhase.GROW]:
      "You're using advanced features to drive strategic business decisions.",
  };
  return descriptions[phase];
}

/**
 * Get literacy level name
 */
export function getLiteracyLevelName(level: FinancialLiteracyLevel): string {
  const names: Record<FinancialLiteracyLevel, string> = {
    [FinancialLiteracyLevel.BEGINNER]: 'Beginner',
    [FinancialLiteracyLevel.INTERMEDIATE]: 'Intermediate',
    [FinancialLiteracyLevel.ADVANCED]: 'Advanced',
  };
  return names[level];
}

/**
 * Get literacy level description
 */
export function getLiteracyLevelDescription(level: FinancialLiteracyLevel): string {
  const descriptions: Record<FinancialLiteracyLevel, string> = {
    [FinancialLiteracyLevel.BEGINNER]:
      "You're new to bookkeeping. We'll guide you through every step with clear explanations.",
    [FinancialLiteracyLevel.INTERMEDIATE]:
      "You know the basics. We'll help you build on that foundation with some advanced features.",
    [FinancialLiteracyLevel.ADVANCED]:
      "You're comfortable with accounting. We'll give you powerful tools and get out of your way.",
  };
  return descriptions[level];
}
