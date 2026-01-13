/**
 * Assessment Progress Component
 *
 * Displays progress through the assessment with encouraging milestone messages.
 * Features smooth animations and accessible progress indicators.
 *
 * Per Requirements: Progress indicator with "joy opportunities" at milestones
 */

import { useMemo } from 'react';
import styles from './AssessmentProgress.module.css';

export interface AssessmentProgressProps {
  /**
   * Current question number (1-indexed)
   */
  currentQuestion: number;
  /**
   * Total number of questions
   */
  totalQuestions: number;
  /**
   * Percentage complete (0-100)
   */
  percentComplete: number;
  /**
   * Current section name
   */
  sectionName: string;
}

/**
 * Get encouraging message based on progress
 * Per Requirements: Milestones at 25%, 50%, 75%, 100%
 */
function getEncouragingMessage(percent: number): string {
  if (percent >= 100) {
    return "Welcome to Graceful Books! We've prepared a personalized path just for you.";
  } else if (percent >= 75) {
    return "Almost there! You're doing wonderfully.";
  } else if (percent >= 50) {
    return "Halfway there! You're doing great.";
  } else if (percent >= 25) {
    return "You're making great progress!";
  } else {
    return "Getting to know you...";
  }
}

/**
 * Get emoji for current milestone
 */
function getMilestoneEmoji(percent: number): string {
  if (percent >= 100) {
    return '🎉';
  } else if (percent >= 75) {
    return '⭐';
  } else if (percent >= 50) {
    return '💪';
  } else if (percent >= 25) {
    return '🌱';
  } else {
    return '👋';
  }
}

/**
 * AssessmentProgress component
 *
 * Features:
 * - Animated progress bar
 * - Milestone celebrations
 * - WCAG 2.1 AA compliance
 * - Screen reader announcements
 * - Reduced motion support
 */
export function AssessmentProgress({
  currentQuestion,
  totalQuestions,
  percentComplete,
  sectionName,
}: AssessmentProgressProps) {
  // Memoize encouraging message
  const encouragingMessage = useMemo(
    () => getEncouragingMessage(percentComplete),
    [percentComplete]
  );

  // Memoize milestone emoji
  const milestoneEmoji = useMemo(
    () => getMilestoneEmoji(percentComplete),
    [percentComplete]
  );

  // Determine if we're at a milestone
  const isAtMilestone = useMemo(() => {
    return percentComplete === 25 || percentComplete === 50 || percentComplete === 75 || percentComplete === 100;
  }, [percentComplete]);

  return (
    <div className={styles.progressContainer} data-testid="assessment-progress">
      {/* Screen Reader Announcement */}
      <div className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">
        Question {currentQuestion} of {totalQuestions}. {percentComplete}% complete. {encouragingMessage}
      </div>

      {/* Visual Progress Indicator */}
      <div className={styles.progressHeader}>
        <div className={styles.questionCounter}>
          <span className={styles.emoji} aria-hidden="true">
            {milestoneEmoji}
          </span>
          <span className={styles.counterText}>
            Question <strong>{currentQuestion}</strong> of <strong>{totalQuestions}</strong>
          </span>
        </div>
        <span className={styles.percentText} aria-hidden="true">
          {percentComplete}%
        </span>
      </div>

      {/* Progress Bar */}
      <div
        className={styles.progressBar}
        role="progressbar"
        aria-valuenow={percentComplete}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Assessment progress"
      >
        <div
          className={`${styles.progressFill} ${isAtMilestone ? styles.milestone : ''}`}
          style={{ width: `${percentComplete}%` }}
        >
          <div className={styles.progressGlow} />
        </div>
      </div>

      {/* Encouraging Message */}
      <div className={styles.encouragingMessage} aria-hidden="true">
        <p className={styles.messageText}>{encouragingMessage}</p>
        <p className={styles.sectionText}>{sectionName}</p>
      </div>
    </div>
  );
}

AssessmentProgress.displayName = 'AssessmentProgress';
