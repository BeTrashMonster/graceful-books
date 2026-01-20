/**
 * Goal Card Component
 *
 * Displays a single financial goal with progress bar, status indicators,
 * and countdown to deadline.
 *
 * WCAG 2.1 AA Compliant:
 * - Color + icon + text for status (not color alone)
 * - Keyboard accessible
 * - Screen reader friendly with ARIA labels
 * - 4.5:1 color contrast for text
 */

import React from 'react';
import type { GoalCardData } from '../../types/goals.types';
import styles from './GoalCard.module.css';

interface GoalCardProps {
  goalData: GoalCardData;
  onClick?: () => void;
  showDetailButton?: boolean;
}

export const GoalCard: React.FC<GoalCardProps> = ({
  goalData,
  onClick,
  showDetailButton = true,
}) => {
  const { goal, calculation, display_color, icon_name, status_icon, countdown_text, progress_text } =
    goalData;

  // Determine status text for accessibility
  const getStatusText = () => {
    switch (calculation.progress_status) {
      case 'on-track':
        return 'On track';
      case 'behind':
        return 'Behind pace';
      case 'at-risk':
        return 'At risk';
    }
  };

  // Create accessible description
  const ariaLabel = `${goal.name}. ${progress_text}. ${calculation.progress_percentage}% complete. ${getStatusText()}. ${countdown_text}.`;

  return (
    <div
      className={`${styles.goalCard} ${onClick ? styles.clickable : ''}`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      tabIndex={onClick ? 0 : undefined}
      role={onClick ? 'button' : undefined}
      aria-label={ariaLabel}
    >
      {/* Header */}
      <div className={styles.cardHeader}>
        <div className={styles.headerLeft}>
          {/* Goal type icon */}
          <div className={styles.goalIcon} aria-hidden="true">
            <i className={`icon-${icon_name}`} />
          </div>

          {/* Goal name and type */}
          <div>
            <h3 className={styles.goalName}>{goal.name}</h3>
            <p className={styles.goalType}>{goal.type.charAt(0).toUpperCase() + goal.type.slice(1)} goal</p>
          </div>
        </div>

        {/* Status indicator */}
        <div
          className={`${styles.statusBadge} ${styles[`status-${display_color}`]}`}
          aria-label={getStatusText()}
        >
          <i className={`icon-${status_icon}`} aria-hidden="true" />
          <span>{getStatusText()}</span>
        </div>
      </div>

      {/* Progress section */}
      <div className={styles.progressSection}>
        {/* Progress text */}
        <div className={styles.progressText}>
          <span className={styles.progressAmount}>{progress_text}</span>
          <span className={styles.progressPercentage}>{calculation.progress_percentage}%</span>
        </div>

        {/* Progress bar */}
        <div
          className={styles.progressBarContainer}
          role="progressbar"
          aria-valuenow={calculation.progress_percentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Progress: ${calculation.progress_percentage}% complete`}
        >
          <div className={styles.progressTrack}>
            <div
              className={`${styles.progressFill} ${styles[`fill-${display_color}`]}`}
              style={{ width: `${calculation.progress_percentage}%` }}
            />

            {/* Milestone markers */}
            {[25, 50, 75].map((milestone) => (
              <div
                key={milestone}
                className={`${styles.milestoneMarker} ${
                  calculation.progress_percentage >= milestone ? styles.reached : ''
                }`}
                style={{ left: `${milestone}%` }}
                aria-hidden="true"
              >
                <div className={styles.markerDot} />
              </div>
            ))}
          </div>
        </div>

        {/* Milestone labels */}
        <div className={styles.milestoneLabels} aria-hidden="true">
          <span className={styles.milestoneLabel}>25%</span>
          <span className={styles.milestoneLabel}>50%</span>
          <span className={styles.milestoneLabel}>75%</span>
          <span className={styles.milestoneLabel}>100%</span>
        </div>
      </div>

      {/* Footer */}
      <div className={styles.cardFooter}>
        {/* Countdown */}
        <div className={styles.countdown}>
          <i className="icon-clock" aria-hidden="true" />
          <span>{countdown_text}</span>
        </div>

        {/* Personal note (if exists) */}
        {goal.personal_note && (
          <div className={styles.personalNote}>
            <i className="icon-message-circle" aria-hidden="true" />
            <span className={styles.noteText}>{goal.personal_note}</span>
          </div>
        )}

        {/* View detail button */}
        {showDetailButton && (
          <button
            className={styles.detailButton}
            onClick={(e) => {
              e.stopPropagation();
              if (onClick) onClick();
            }}
            aria-label={`View details for ${goal.name}`}
          >
            View Details
            <i className="icon-chevron-right" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
};
