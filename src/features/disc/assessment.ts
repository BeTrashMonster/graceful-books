/**
 * DISC Assessment Logic
 *
 * Manages the complete assessment flow including:
 * - Answer collection and validation
 * - Progress tracking
 * - Score calculation
 * - Profile creation and storage
 */

import { calculateDISCScores } from './scoring';
import type { ScoringResult } from './scoring';
import { DISC_QUESTIONS,  validateAnswerValue } from './questions';
import type { DISCQuestion } from './questions';
import { createDISCProfile } from '../../store/discProfiles';
import type { DISCProfile,  } from '../../db/schema/discProfile.schema';
import type { DatabaseResult, EncryptionContext } from '../../store/types';

/**
 * Assessment session state
 */
export interface AssessmentSession {
  userId: string;
  answers: (number | null)[]; // null = not yet answered
  startedAt: number; // Unix timestamp
  currentQuestionIndex: number;
  isComplete: boolean;
}

/**
 * Assessment progress info
 */
export interface AssessmentProgress {
  totalQuestions: number;
  answeredQuestions: number;
  percentComplete: number;
  currentQuestion: DISCQuestion | null;
  canSubmit: boolean;
}

/**
 * Create a new assessment session
 */
export function createAssessmentSession(userId: string): AssessmentSession {
  return {
    userId,
    answers: new Array(DISC_QUESTIONS.length).fill(null),
    startedAt: Date.now(),
    currentQuestionIndex: 0,
    isComplete: false,
  };
}

/**
 * Answer a question in the assessment
 */
export function answerQuestion(
  session: AssessmentSession,
  questionIndex: number,
  answerValue: number
): AssessmentSession {
  // Validate question index
  if (questionIndex < 0 || questionIndex >= DISC_QUESTIONS.length) {
    throw new Error(`Invalid question index: ${questionIndex}`);
  }

  // Validate answer value
  if (!validateAnswerValue(answerValue)) {
    throw new Error(`Invalid answer value: ${answerValue}`);
  }

  // Create updated session
  const updatedAnswers = [...session.answers];
  updatedAnswers[questionIndex] = answerValue;

  // Check if complete
  const isComplete = updatedAnswers.every((a) => a !== null);

  return {
    ...session,
    answers: updatedAnswers,
    currentQuestionIndex: session.currentQuestionIndex,
    isComplete,
  };
}

/**
 * Get assessment progress
 */
export function getAssessmentProgress(session: AssessmentSession): AssessmentProgress {
  const answeredCount = session.answers.filter((a) => a !== null).length;
  const percentComplete = Math.round((answeredCount / DISC_QUESTIONS.length) * 100);

  let currentQuestion: DISCQuestion | null = null;
  if (session.currentQuestionIndex < DISC_QUESTIONS.length) {
    currentQuestion = DISC_QUESTIONS[session.currentQuestionIndex]!;
  }

  return {
    totalQuestions: DISC_QUESTIONS.length,
    answeredQuestions: answeredCount,
    percentComplete,
    currentQuestion,
    canSubmit: session.isComplete,
  };
}

/**
 * Navigate to a specific question
 */
export function navigateToQuestion(
  session: AssessmentSession,
  questionIndex: number
): AssessmentSession {
  if (questionIndex < 0 || questionIndex >= DISC_QUESTIONS.length) {
    throw new Error(`Invalid question index: ${questionIndex}`);
  }

  return {
    ...session,
    currentQuestionIndex: questionIndex,
  };
}

/**
 * Navigate to next question
 */
export function navigateToNext(session: AssessmentSession): AssessmentSession {
  const nextIndex = Math.min(
    session.currentQuestionIndex + 1,
    DISC_QUESTIONS.length - 1
  );
  return navigateToQuestion(session, nextIndex);
}

/**
 * Navigate to previous question
 */
export function navigateToPrevious(session: AssessmentSession): AssessmentSession {
  const prevIndex = Math.max(session.currentQuestionIndex - 1, 0);
  return navigateToQuestion(session, prevIndex);
}

/**
 * Calculate scores from current session
 * Throws error if not all questions are answered
 */
export function calculateSessionScores(session: AssessmentSession): ScoringResult {
  if (!session.isComplete) {
    const progress = getAssessmentProgress(session);
    throw new Error(
      `Cannot calculate scores: ${progress.answeredQuestions}/${progress.totalQuestions} questions answered`
    );
  }

  // Convert answers to number array (safe because we checked isComplete)
  const answers = session.answers as number[];

  return calculateDISCScores(answers);
}

/**
 * Submit assessment and create profile
 */
export async function submitAssessment(
  session: AssessmentSession,
  context?: EncryptionContext
): Promise<DatabaseResult<{ profile: DISCProfile; result: ScoringResult }>> {
  try {
    // Validate session is complete
    if (!session.isComplete) {
      const progress = getAssessmentProgress(session);
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Assessment incomplete: ${progress.answeredQuestions}/${progress.totalQuestions} questions answered`,
        },
      };
    }

    // Calculate scores
    const scoringResult = calculateSessionScores(session);
    const answers = session.answers as number[];

    // Create profile
    const profileResult = await createDISCProfile(
      session.userId,
      scoringResult.scores,
      answers,
      context
    );

    if (!profileResult.success) {
      return profileResult as DatabaseResult<never>;
    }

    return {
      success: true,
      data: {
        profile: profileResult.data!,
        result: scoringResult,
      },
    };
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
 * Resume assessment from saved answers
 */
export function resumeAssessment(
  userId: string,
  savedAnswers: (number | null)[],
  startedAt?: number
): AssessmentSession {
  // Validate saved answers length
  if (savedAnswers.length !== DISC_QUESTIONS.length) {
    throw new Error(
      `Invalid saved answers length: expected ${DISC_QUESTIONS.length}, got ${savedAnswers.length}`
    );
  }

  // Find first unanswered question
  let currentIndex = 0;
  for (let i = 0; i < savedAnswers.length; i++) {
    if (savedAnswers[i] === null) {
      currentIndex = i;
      break;
    }
  }

  // If all answered, set to last question
  if (savedAnswers.every((a) => a !== null)) {
    currentIndex = DISC_QUESTIONS.length - 1;
  }

  const isComplete = savedAnswers.every((a) => a !== null);

  return {
    userId,
    answers: [...savedAnswers],
    startedAt: startedAt || Date.now(),
    currentQuestionIndex: currentIndex,
    isComplete,
  };
}

/**
 * Export session for persistence
 */
export function exportSession(session: AssessmentSession): object {
  return {
    userId: session.userId,
    answers: session.answers,
    startedAt: session.startedAt,
    currentQuestionIndex: session.currentQuestionIndex,
    isComplete: session.isComplete,
  };
}

/**
 * Import session from persistence
 */
export function importSession(data: any): AssessmentSession {
  if (!data.userId || !Array.isArray(data.answers)) {
    throw new Error('Invalid session data');
  }

  return {
    userId: data.userId,
    answers: data.answers,
    startedAt: data.startedAt || Date.now(),
    currentQuestionIndex: data.currentQuestionIndex || 0,
    isComplete: data.isComplete || false,
  };
}

/**
 * Get time spent on assessment (in milliseconds)
 */
export function getTimeSpent(session: AssessmentSession): number {
  return Date.now() - session.startedAt;
}

/**
 * Get estimated time remaining (in milliseconds)
 * Based on average time per question so far
 */
export function getEstimatedTimeRemaining(session: AssessmentSession): number {
  const timeSpent = getTimeSpent(session);
  const answeredCount = session.answers.filter((a) => a !== null).length;

  if (answeredCount === 0) {
    // Estimate 30 seconds per question
    return DISC_QUESTIONS.length * 30 * 1000;
  }

  const avgTimePerQuestion = timeSpent / answeredCount;
  const remainingQuestions = DISC_QUESTIONS.length - answeredCount;

  return Math.round(avgTimePerQuestion * remainingQuestions);
}
