/**
 * Assessment Engine
 *
 * Core assessment logic that orchestrates:
 * - Question flow and branching
 * - Answer validation
 * - Progress tracking
 * - Score calculation
 * - Results generation
 *
 * Per ONB-001, ONB-002, ONB-003
 */

import type {
  AssessmentSession,
  AssessmentAnswer,
  AssessmentProgress,
  AssessmentResults,
  AssessmentSection,
  ValidationError,
  SectionStatus,
} from './types';
import {
  ASSESSMENT_QUESTIONS,
  getQuestionsBySection,
  getQuestionById,
  getSections,
  validateAnswer,
  shouldShowQuestion,
  getVisibleQuestionCount,
} from './questions';
import { calculateRawScores, normalizeScores } from './scoring';
import { generateAssessmentResults } from './phaseDetection';

/**
 * Create a new assessment session
 */
export function createAssessmentSession(userId: string): AssessmentSession {
  return {
    userId,
    answers: new Map(),
    currentSection: getSections()[0]!,
    startedAt: Date.now(),
    lastUpdatedAt: Date.now(),
    completedSections: [],
    isComplete: false,
  };
}

/**
 * Resume an existing assessment session
 */
export function resumeAssessmentSession(
  userId: string,
  savedAnswers: AssessmentAnswer[],
  currentSection?: AssessmentSection,
  startedAt?: number
): AssessmentSession {
  const answers = new Map<string, AssessmentAnswer>();

  // Convert array to map
  savedAnswers.forEach((answer) => {
    answers.set(answer.questionId, answer);
  });

  // Determine current section if not provided
  let section = currentSection;
  if (!section) {
    // Find first incomplete section
    const sections = getSections();
    for (const sec of sections) {
      const sectionStatus = getSectionStatus(sec, answers);
      if (!sectionStatus.isComplete) {
        section = sec;
        break;
      }
    }
    // If all complete, use last section
    if (!section) {
      section = sections[sections.length - 1]!;
    }
  }

  // Determine completed sections
  const completedSections: AssessmentSection[] = [];
  const sections = getSections();
  for (const sec of sections) {
    const status = getSectionStatus(sec, answers);
    if (status.isComplete) {
      completedSections.push(sec);
    }
  }

  return {
    userId,
    answers,
    currentSection: section,
    startedAt: startedAt || Date.now(),
    lastUpdatedAt: Date.now(),
    completedSections,
    isComplete: isAssessmentComplete(answers),
  };
}

/**
 * Answer a question
 */
export function answerQuestion(
  session: AssessmentSession,
  questionId: string,
  value: string | number | string[] | number[]
): { session: AssessmentSession; errors: ValidationError[] } {
  const question = getQuestionById(questionId);

  if (!question) {
    return {
      session,
      errors: [{ questionId, message: 'Question not found' }],
    };
  }

  // Validate answer
  if (!validateAnswer(question, value)) {
    return {
      session,
      errors: [
        {
          questionId,
          message: "That answer doesn't look quite right. Please check and try again.",
        },
      ],
    };
  }

  // Create answer
  const answer: AssessmentAnswer = {
    questionId,
    value,
    answeredAt: Date.now(),
  };

  // Update session
  const newAnswers = new Map(session.answers);
  newAnswers.set(questionId, answer);

  // Check if current section is now complete
  const sectionStatus = getSectionStatus(session.currentSection, newAnswers);
  const completedSections = [...session.completedSections];

  if (sectionStatus.isComplete && !completedSections.includes(session.currentSection)) {
    completedSections.push(session.currentSection);
  }

  return {
    session: {
      ...session,
      answers: newAnswers,
      lastUpdatedAt: Date.now(),
      completedSections,
      isComplete: isAssessmentComplete(newAnswers),
    },
    errors: [],
  };
}

/**
 * Navigate to a specific section
 */
export function navigateToSection(
  session: AssessmentSession,
  section: AssessmentSection
): AssessmentSession {
  return {
    ...session,
    currentSection: section,
    lastUpdatedAt: Date.now(),
  };
}

/**
 * Navigate to next section
 */
export function navigateToNextSection(session: AssessmentSession): AssessmentSession {
  const sections = getSections();
  const currentIndex = sections.indexOf(session.currentSection);

  if (currentIndex < sections.length - 1) {
    return navigateToSection(session, sections[currentIndex + 1]!);
  }

  return session; // Already at last section
}

/**
 * Navigate to previous section
 */
export function navigateToPreviousSection(session: AssessmentSession): AssessmentSession {
  const sections = getSections();
  const currentIndex = sections.indexOf(session.currentSection);

  if (currentIndex > 0) {
    return navigateToSection(session, sections[currentIndex - 1]!);
  }

  return session; // Already at first section
}

/**
 * Get assessment progress
 */
export function getAssessmentProgress(session: AssessmentSession): AssessmentProgress {
  const totalQuestions = getVisibleQuestionCount(
    new Map(
      Array.from(session.answers.entries()).map(([k, v]) => [k, { value: v.value }])
    )
  );
  const answeredQuestions = session.answers.size;
  const percentComplete = totalQuestions > 0
    ? Math.round((answeredQuestions / totalQuestions) * 100)
    : 0;

  const sections = getSections();
  const sectionsComplete = session.completedSections.length;

  return {
    totalQuestions,
    answeredQuestions,
    percentComplete,
    currentSection: session.currentSection,
    sectionsComplete,
    totalSections: sections.length,
    canSubmit: session.isComplete,
  };
}

/**
 * Get status for a specific section
 */
export function getSectionStatus(
  section: AssessmentSection,
  answers: Map<string, AssessmentAnswer>
): SectionStatus {
  const sectionQuestions = getQuestionsBySection(section);

  // Filter to only visible questions based on conditionals
  const answerValues = new Map(
    Array.from(answers.entries()).map(([k, v]) => [k, { value: v.value }])
  );
  const visibleQuestions = sectionQuestions.filter((q) => shouldShowQuestion(q, answerValues));

  const questionsTotal = visibleQuestions.length;
  const questionsAnswered = visibleQuestions.filter((q) => answers.has(q.id)).length;

  return {
    section,
    questionsTotal,
    questionsAnswered,
    isComplete: questionsTotal > 0 && questionsAnswered === questionsTotal,
  };
}

/**
 * Get statuses for all sections
 */
export function getAllSectionStatuses(
  answers: Map<string, AssessmentAnswer>
): SectionStatus[] {
  const sections = getSections();
  return sections.map((section) => getSectionStatus(section, answers));
}

/**
 * Check if assessment is complete
 */
export function isAssessmentComplete(answers: Map<string, AssessmentAnswer>): boolean {
  // Get all required questions
  const requiredQuestions = ASSESSMENT_QUESTIONS.filter((q) => q.required);

  // Filter to only visible questions
  const answerValues = new Map(
    Array.from(answers.entries()).map(([k, v]) => [k, { value: v.value }])
  );
  const visibleRequired = requiredQuestions.filter((q) => shouldShowQuestion(q, answerValues));

  // Check all are answered
  return visibleRequired.every((q) => answers.has(q.id));
}

/**
 * Validate all answers before submission
 */
export function validateAllAnswers(session: AssessmentSession): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check all required questions are answered
  const requiredQuestions = ASSESSMENT_QUESTIONS.filter((q) => q.required);
  const answerValues = new Map(
    Array.from(session.answers.entries()).map(([k, v]) => [k, { value: v.value }])
  );
  const visibleRequired = requiredQuestions.filter((q) => shouldShowQuestion(q, answerValues));

  for (const question of visibleRequired) {
    const answer = session.answers.get(question.id);

    if (!answer) {
      errors.push({
        questionId: question.id,
        message: `We need an answer for: "${question.text}"`,
      });
      continue;
    }

    // Validate answer format
    if (!validateAnswer(question, answer.value)) {
      errors.push({
        questionId: question.id,
        message: `The answer for "${question.text}" doesn't look quite right.`,
      });
    }
  }

  return errors;
}

/**
 * Calculate and generate assessment results
 */
export function generateResults(session: AssessmentSession): {
  results: AssessmentResults | null;
  errors: ValidationError[];
} {
  // Validate completeness
  const validationErrors = validateAllAnswers(session);
  if (validationErrors.length > 0) {
    return { results: null, errors: validationErrors };
  }

  // Calculate raw scores
  const rawScores = calculateRawScores(session.answers);

  // Normalize scores
  const normalizedScores = normalizeScores(rawScores);

  // Generate results
  const results = generateAssessmentResults(rawScores, normalizedScores, session.answers);

  return { results, errors: [] };
}

/**
 * Get time spent on assessment (in milliseconds)
 */
export function getTimeSpent(session: AssessmentSession): number {
  return Date.now() - session.startedAt;
}

/**
 * Get estimated time remaining (in milliseconds)
 */
export function getEstimatedTimeRemaining(session: AssessmentSession): number {
  const timeSpent = getTimeSpent(session);
  const progress = getAssessmentProgress(session);

  if (progress.answeredQuestions === 0) {
    // Estimate 45 seconds per question
    return progress.totalQuestions * 45 * 1000;
  }

  const avgTimePerQuestion = timeSpent / progress.answeredQuestions;
  const remainingQuestions = progress.totalQuestions - progress.answeredQuestions;

  return Math.round(avgTimePerQuestion * remainingQuestions);
}

/**
 * Export session for persistence
 */
export function exportSession(session: AssessmentSession): {
  userId: string;
  answers: AssessmentAnswer[];
  currentSection: AssessmentSection;
  startedAt: number;
  lastUpdatedAt: number;
  completedSections: AssessmentSection[];
  isComplete: boolean;
} {
  return {
    userId: session.userId,
    answers: Array.from(session.answers.values()),
    currentSection: session.currentSection,
    startedAt: session.startedAt,
    lastUpdatedAt: session.lastUpdatedAt,
    completedSections: session.completedSections,
    isComplete: session.isComplete,
  };
}

/**
 * Get next question to answer in current section
 */
export function getNextQuestion(session: AssessmentSession): string | null {
  const sectionQuestions = getQuestionsBySection(session.currentSection);
  const answerValues = new Map(
    Array.from(session.answers.entries()).map(([k, v]) => [k, { value: v.value }])
  );

  // Find first unanswered visible question
  for (const question of sectionQuestions) {
    if (shouldShowQuestion(question, answerValues) && !session.answers.has(question.id)) {
      return question.id;
    }
  }

  return null; // Section complete
}

/**
 * Get completion message based on progress
 */
export function getProgressMessage(progress: AssessmentProgress): string {
  if (progress.percentComplete === 0) {
    return "Let's get started! This will only take a few minutes.";
  } else if (progress.percentComplete < 25) {
    return "You're off to a great start!";
  } else if (progress.percentComplete < 50) {
    return "Halfway there! You're doing great.";
  } else if (progress.percentComplete < 75) {
    return "Almost done! Keep going.";
  } else if (progress.percentComplete < 100) {
    return "Just a little more! You're almost finished.";
  } else {
    return "All done! Ready to see your personalized recommendations?";
  }
}
