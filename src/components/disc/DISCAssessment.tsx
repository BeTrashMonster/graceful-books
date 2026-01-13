/**
 * DISC Assessment Component
 *
 * Interactive assessment flow for determining DISC personality type.
 * Features progress tracking, navigation, and submission.
 */

import { useState, useCallback } from 'react';
import {
  createAssessmentSession,
  answerQuestion,
  getAssessmentProgress,
  navigateToNext,
  navigateToPrevious,
  submitAssessment,
} from '../../features/disc/assessment';
import type { AssessmentSession } from '../../features/disc/assessment';
import { ANSWER_OPTIONS, DISC_QUESTIONS } from '../../features/disc/questions';
import type { EncryptionContext } from '../../store/types';

export interface DISCAssessmentProps {
  userId: string;
  onComplete?: (result: { profileId: string; scores: any }) => void;
  onCancel?: () => void;
  encryptionContext?: EncryptionContext;
  className?: string;
}

export function DISCAssessment({
  userId,
  onComplete,
  onCancel,
  encryptionContext,
  className = '',
}: DISCAssessmentProps) {
  const [session, setSession] = useState<AssessmentSession>(() =>
    createAssessmentSession(userId)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const progress = getAssessmentProgress(session);
  const currentQuestion = DISC_QUESTIONS[session.currentQuestionIndex];

  const handleAnswerSelect = useCallback((value: number) => {
    setSession((prev) => answerQuestion(prev, prev.currentQuestionIndex, value));
    setError(null);
  }, []);

  const handleNext = useCallback(() => {
    if (session.currentQuestionIndex < DISC_QUESTIONS.length - 1) {
      setSession(navigateToNext);
    }
  }, [session.currentQuestionIndex]);

  const handlePrevious = useCallback(() => {
    if (session.currentQuestionIndex > 0) {
      setSession(navigateToPrevious);
    }
  }, [session.currentQuestionIndex]);

  const handleSubmit = useCallback(async () => {
    if (!progress.canSubmit) {
      setError('Please answer all questions before submitting');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await submitAssessment(session, encryptionContext);

      if (result.success && result.data) {
        onComplete?.({
          profileId: result.data.profile.id!,
          scores: result.data.result.scores,
        });
      } else {
        setError('error' in result ? result.error?.message || 'Failed to submit assessment' : 'Failed to submit assessment');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  }, [progress.canSubmit, session, encryptionContext, onComplete]);

  const currentAnswer = session.answers[session.currentQuestionIndex];

  return (
    <div className={`disc-assessment ${className}`} data-testid="disc-assessment">
      {/* Progress Bar */}
      <div className="disc-assessment__progress" role="progressbar" aria-valuenow={progress.percentComplete} aria-valuemin={0} aria-valuemax={100}>
        <div className="disc-assessment__progress-label">
          Question {session.currentQuestionIndex + 1} of {DISC_QUESTIONS.length}
        </div>
        <div className="disc-assessment__progress-bar">
          <div
            className="disc-assessment__progress-fill"
            style={{ width: `${progress.percentComplete}%` }}
            aria-hidden="true"
          />
        </div>
        <div className="disc-assessment__progress-text">
          {progress.percentComplete}% Complete
        </div>
      </div>

      {/* Question */}
      {currentQuestion && (
        <div className="disc-assessment__question">
          <h2 className="disc-assessment__question-text">
            {currentQuestion.text}
          </h2>
          <p className="disc-assessment__question-category">
            Category: {currentQuestion.category.replace(/_/g, ' ')}
          </p>
        </div>
      )}

      {/* Answer Options */}
      <div className="disc-assessment__answers" role="radiogroup" aria-label="Answer options">
        {ANSWER_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={currentAnswer === option.value}
            className={`disc-assessment__answer-option ${
              currentAnswer === option.value ? 'disc-assessment__answer-option--selected' : ''
            }`}
            onClick={() => handleAnswerSelect(option.value)}
            disabled={isSubmitting}
          >
            <span className="disc-assessment__answer-radio" aria-hidden="true">
              {currentAnswer === option.value && (
                <span className="disc-assessment__answer-radio-dot" />
              )}
            </span>
            <span className="disc-assessment__answer-text">{option.text}</span>
          </button>
        ))}
      </div>

      {/* Error Message */}
      {error && (
        <div className="disc-assessment__error" role="alert">
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="disc-assessment__navigation">
        <button
          type="button"
          className="disc-assessment__nav-button disc-assessment__nav-button--previous"
          onClick={handlePrevious}
          disabled={session.currentQuestionIndex === 0 || isSubmitting}
          aria-label="Previous question"
        >
          Previous
        </button>

        <div className="disc-assessment__nav-spacer" />

        {session.currentQuestionIndex < DISC_QUESTIONS.length - 1 ? (
          <button
            type="button"
            className="disc-assessment__nav-button disc-assessment__nav-button--next"
            onClick={handleNext}
            disabled={currentAnswer === null || isSubmitting}
            aria-label="Next question"
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            className="disc-assessment__nav-button disc-assessment__nav-button--submit"
            onClick={handleSubmit}
            disabled={!progress.canSubmit || isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Assessment'}
          </button>
        )}
      </div>

      {/* Cancel Button */}
      {onCancel && (
        <div className="disc-assessment__cancel">
          <button
            type="button"
            className="disc-assessment__cancel-button"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
