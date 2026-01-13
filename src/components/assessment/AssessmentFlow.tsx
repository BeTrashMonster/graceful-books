/**
 * Assessment Flow Component
 *
 * Main container for the complete onboarding assessment experience.
 * Manages section progression, state, and overall flow.
 *
 * Per ONB-001, ONB-002: Complete assessment flow with 5 sections
 */

import { useState, useCallback, useMemo } from 'react';
import type { AssessmentSession } from '../../features/disc/assessment';
import { AssessmentQuestion } from './AssessmentQuestion';
import { AssessmentProgress } from './AssessmentProgress';
import { SectionTransition } from './SectionTransition';
import { Button } from '../core/Button';
import styles from './AssessmentFlow.module.css';

export interface AssessmentFlowProps {
  /**
   * Initial session state
   */
  initialSession: AssessmentSession;
  /**
   * Callback when answer changes
   */
  onAnswerChange: (questionIndex: number, value: number) => void;
  /**
   * Callback when navigating between questions
   */
  onNavigate: (direction: 'next' | 'previous') => void;
  /**
   * Callback when submitting assessment
   */
  onSubmit: () => void;
  /**
   * Current session state
   */
  session: AssessmentSession;
  /**
   * Current questions for display
   */
  questions: Array<{
    id: number;
    text: string;
    description?: string;
    category: string;
  }>;
  /**
   * Whether submission is in progress
   */
  isSubmitting?: boolean;
  /**
   * Error message if any
   */
  error?: string | null;
  /**
   * Callback to clear error
   */
  onClearError?: () => void;
  /**
   * Optional cancel callback
   */
  onCancel?: () => void;
}

/**
 * Section definitions for the assessment
 * Per ONB-002: 5 sections with specific purposes
 */
const SECTIONS = [
  {
    id: 'business-fundamentals',
    name: 'Business Fundamentals',
    description: 'Tell us about your business basics',
    questionRange: [0, 4],
  },
  {
    id: 'financial-state',
    name: 'Current Financial State',
    description: 'How are you managing your finances today?',
    questionRange: [4, 8],
  },
  {
    id: 'financial-literacy',
    name: 'Financial Understanding',
    description: 'Your comfort with financial concepts',
    questionRange: [8, 12],
  },
  {
    id: 'business-specific',
    name: 'Your Business Type',
    description: 'Questions tailored to your business',
    questionRange: [12, 14],
  },
  {
    id: 'communication',
    name: 'Communication Style',
    description: 'How you prefer to work and communicate',
    questionRange: [14, 16],
  },
];

export function AssessmentFlow({
  onAnswerChange,
  onNavigate,
  onSubmit,
  session,
  questions,
  isSubmitting = false,
  error = null,
  onClearError,
  onCancel,
}: AssessmentFlowProps) {
  const [showTransition, setShowTransition] = useState(false);
  const [transitionSection, setTransitionSection] = useState<string>('');

  // Determine current section based on question index
  const currentSection = useMemo(() => {
    const current = session.currentQuestionIndex;
    const found = SECTIONS.find(
      (section) =>
        current >= (section.questionRange[0] ?? 0) && current < (section.questionRange[1] ?? Number.MAX_SAFE_INTEGER)
    );
    return found || SECTIONS[0]!;
  }, [session.currentQuestionIndex]);

  // Calculate progress
  const progress = useMemo(() => {
    const answeredCount = session.answers.filter((a) => a !== null).length;
    const totalQuestions = questions.length;
    const percentComplete = Math.round((answeredCount / totalQuestions) * 100);

    return {
      answeredCount,
      totalQuestions,
      percentComplete,
      canSubmit: session.isComplete,
    };
  }, [session.answers, questions.length, session.isComplete]);

  // Get current question
  const currentQuestion = useMemo(() => {
    if (session.currentQuestionIndex < questions.length) {
      return questions[session.currentQuestionIndex];
    }
    return null;
  }, [session.currentQuestionIndex, questions]);

  // Get current answer
  const currentAnswer = session.answers[session.currentQuestionIndex] ?? null;

  // Check if we're at section boundary
  const isLastQuestionInSection = useMemo(() => {
    const nextIndex = session.currentQuestionIndex + 1;
    const nextSection = SECTIONS.find(
      (section) =>
        nextIndex >= (section.questionRange[0] ?? 0) && nextIndex < (section.questionRange[1] ?? Number.MAX_SAFE_INTEGER)
    );
    return !!nextSection && nextSection.id !== currentSection.id;
  }, [session.currentQuestionIndex, currentSection]);

  const handleNext = useCallback(() => {
    if (session.currentQuestionIndex < questions.length - 1) {
      // Check if moving to new section
      if (isLastQuestionInSection) {
        const nextIndex = session.currentQuestionIndex + 1;
        const nextSection = SECTIONS.find(
          (section) =>
            nextIndex >= (section.questionRange[0] ?? 0) && nextIndex < (section.questionRange[1] ?? Number.MAX_SAFE_INTEGER)
        );

        if (nextSection) {
          setTransitionSection(nextSection.name);
          setShowTransition(true);

          // Show transition for 2 seconds
          setTimeout(() => {
            setShowTransition(false);
            onNavigate('next');
          }, 2000);
        } else {
          onNavigate('next');
        }
      } else {
        onNavigate('next');
      }
    }
  }, [session.currentQuestionIndex, questions.length, isLastQuestionInSection, onNavigate]);

  const handlePrevious = useCallback(() => {
    if (session.currentQuestionIndex > 0) {
      onNavigate('previous');
    }
  }, [session.currentQuestionIndex, onNavigate]);

  const handleAnswerSelect = useCallback((value: number) => {
    onAnswerChange(session.currentQuestionIndex, value);
    if (onClearError) {
      onClearError();
    }
  }, [session.currentQuestionIndex, onAnswerChange, onClearError]);

  const isFirstQuestion = session.currentQuestionIndex === 0;
  const isLastQuestion = session.currentQuestionIndex === questions.length - 1;
  const canProceed = currentAnswer !== null;

  // Show transition overlay
  if (showTransition) {
    return (
      <SectionTransition
        sectionName={transitionSection}
        progress={progress.percentComplete}
      />
    );
  }

  return (
    <div className={styles.assessmentFlow} data-testid="assessment-flow">
      {/* Progress Indicator */}
      <AssessmentProgress
        currentQuestion={session.currentQuestionIndex + 1}
        totalQuestions={questions.length}
        percentComplete={progress.percentComplete}
        sectionName={currentSection.name}
      />

      {/* Section Header */}
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionName}>{currentSection.name}</h2>
        <p className={styles.sectionDescription}>{currentSection.description}</p>
      </div>

      {/* Current Question */}
      {currentQuestion && (
        <div className={styles.questionContainer}>
          <AssessmentQuestion
            question={{
              text: currentQuestion.text,
              description: currentQuestion.description ?? undefined,
            }}
            currentAnswer={currentAnswer}
            onAnswerSelect={handleAnswerSelect}
            questionNumber={session.currentQuestionIndex + 1}
            isDisabled={isSubmitting}
          />
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className={styles.error} role="alert" aria-live="assertive">
          <span className={styles.errorIcon} aria-hidden="true">⚠</span>
          <span className={styles.errorMessage}>{error}</span>
        </div>
      )}

      {/* Navigation Controls */}
      <div className={styles.navigation}>
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={isFirstQuestion || isSubmitting}
          aria-label="Previous question"
          className={styles.navButton}
        >
          Previous
        </Button>

        <div className={styles.navSpacer} />

        {isLastQuestion ? (
          <Button
            variant="primary"
            onClick={onSubmit}
            disabled={!progress.canSubmit || isSubmitting}
            loading={isSubmitting}
            aria-busy={isSubmitting}
            className={styles.navButton}
          >
            {isSubmitting ? 'Completing...' : 'Complete Assessment'}
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={handleNext}
            disabled={!canProceed || isSubmitting}
            aria-label="Next question"
            className={styles.navButton}
          >
            Next
          </Button>
        )}
      </div>

      {/* Cancel Button (optional) */}
      {onCancel && (
        <div className={styles.cancelContainer}>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Save and finish later
          </button>
        </div>
      )}
    </div>
  );
}

AssessmentFlow.displayName = 'AssessmentFlow';
