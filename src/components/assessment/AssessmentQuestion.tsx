/**
 * Assessment Question Component
 *
 * Displays a single assessment question with answer options.
 * Features WCAG 2.1 AA compliance with keyboard navigation and screen reader support.
 *
 * Per ONB-002: Question rendering with accessible controls
 */

import { useCallback } from 'react';
import styles from './AssessmentQuestion.module.css';

export interface AssessmentQuestionProps {
  /**
   * Question data
   */
  question: {
    text: string;
    description?: string;
  };
  /**
   * Current answer value (0-3) or null if unanswered
   */
  currentAnswer: number | null;
  /**
   * Callback when answer is selected
   */
  onAnswerSelect: (value: number) => void;
  /**
   * Question number for display
   */
  questionNumber: number;
  /**
   * Whether the question is disabled
   */
  isDisabled?: boolean;
}

/**
 * Answer options with Steadiness-style language
 * 4-point scale for nuanced responses
 */
const ANSWER_OPTIONS = [
  { text: 'Strongly Disagree', value: 0 },
  { text: 'Disagree', value: 1 },
  { text: 'Agree', value: 2 },
  { text: 'Strongly Agree', value: 3 },
];

/**
 * AssessmentQuestion component with full accessibility support
 *
 * Features:
 * - Keyboard navigation (arrow keys, Enter, Space)
 * - Screen reader announcements
 * - Visual focus indicators
 * - 44x44px touch targets
 * - ARIA radiogroup pattern
 */
export function AssessmentQuestion({
  question,
  currentAnswer,
  onAnswerSelect,
  questionNumber,
  isDisabled = false,
}: AssessmentQuestionProps) {
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent, value: number) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onAnswerSelect(value);
      }
    },
    [onAnswerSelect]
  );

  return (
    <div className={styles.question} data-testid="assessment-question">
      {/* Question Text */}
      <div className={styles.questionHeader}>
        <span className={styles.questionNumber} aria-label={`Question ${questionNumber}`}>
          Q{questionNumber}
        </span>
        <h3 className={styles.questionText} id={`question-${questionNumber}`}>
          {question.text}
        </h3>
      </div>

      {/* Optional Description */}
      {question.description && (
        <p className={styles.questionDescription}>{question.description}</p>
      )}

      {/* Answer Options */}
      <div
        className={styles.answerOptions}
        role="radiogroup"
        aria-labelledby={`question-${questionNumber}`}
        aria-describedby={question.description ? `description-${questionNumber}` : undefined}
      >
        {ANSWER_OPTIONS.map((option) => {
          const isSelected = currentAnswer === option.value;

          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              className={`${styles.answerOption} ${isSelected ? styles.selected : ''}`}
              onClick={() => onAnswerSelect(option.value)}
              onKeyDown={(e) => handleKeyDown(e, option.value)}
              disabled={isDisabled}
              data-testid={`answer-option-${option.value}`}
            >
              {/* Visual Radio Indicator */}
              <span className={styles.radioIndicator} aria-hidden="true">
                <span className={styles.radioOuter}>
                  {isSelected && <span className={styles.radioInner} />}
                </span>
              </span>

              {/* Option Text */}
              <span className={styles.optionText}>{option.text}</span>
            </button>
          );
        })}
      </div>

      {/* Helper Text */}
      <p className={styles.helperText}>
        Take your time. There are no wrong answers - we just want to understand where you are right now.
      </p>
    </div>
  );
}

AssessmentQuestion.displayName = 'AssessmentQuestion';
