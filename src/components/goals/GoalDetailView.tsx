/**
 * Goal Detail View Component
 *
 * Detailed view of a single goal with trend chart, recommendations, and actions
 *
 * WCAG 2.1 AA Compliant:
 * - Keyboard accessible
 * - Screen reader friendly
 * - Clear visual hierarchy
 */

import React, { useState, useEffect } from 'react';
import { goalProgressService } from '../../services/goals';
import type { GoalProgressSnapshot, GoalCardData } from '../../types/goals.types';
import { GoalCard } from './GoalCard';
import styles from './GoalDetailView.module.css';

interface GoalDetailViewProps {
  goalId: string;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export const GoalDetailView: React.FC<GoalDetailViewProps> = ({
  goalId,
  onClose,
  onEdit,
  onDelete,
}) => {
  const [goalData, setGoalData] = useState<GoalCardData | null>(null);
  const [progressHistory, setProgressHistory] = useState<GoalProgressSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadGoalData();
  }, [goalId]);

  const loadGoalData = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await goalProgressService.getGoalCardData(goalId);
      const history = await goalProgressService.getProgressHistory(goalId);

      setGoalData(data);
      setProgressHistory(history);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load goal');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.detailView}>
        <div className={styles.loading}>Loading goal details...</div>
      </div>
    );
  }

  if (error || !goalData) {
    return (
      <div className={styles.detailView}>
        <div className={styles.error} role="alert">
          {error || 'Goal not found'}
        </div>
        <button onClick={onClose} className={styles.closeButton}>
          Close
        </button>
      </div>
    );
  }

  const { goal, calculation } = goalData;

  return (
    <div className={styles.detailView}>
      {/* Header */}
      <div className={styles.header}>
        <h2 className={styles.title}>Goal Details</h2>
        <button
          onClick={onClose}
          className={styles.closeButton}
          aria-label="Close goal details"
        >
          ×
        </button>
      </div>

      {/* Goal card */}
      <div className={styles.goalCardSection}>
        <GoalCard goalData={goalData} showDetailButton={false} />
      </div>

      {/* Recommendation (if behind) */}
      {calculation.recommendation && (
        <div className={styles.recommendationSection} role="region" aria-labelledby="recommendation-heading">
          <h3 id="recommendation-heading" className={styles.sectionTitle}>
            <i className="icon-lightbulb" aria-hidden="true" />
            Recommendation
          </h3>
          <p className={styles.recommendationText}>{calculation.recommendation}</p>
        </div>
      )}

      {/* Progress history */}
      {progressHistory.length > 0 && (
        <div className={styles.historySection} role="region" aria-labelledby="history-heading">
          <h3 id="history-heading" className={styles.sectionTitle}>
            <i className="icon-trending-up" aria-hidden="true" />
            Progress History
          </h3>

          <div className={styles.historyList}>
            {progressHistory.slice(-10).reverse().map((snapshot, _index) => (
              <div key={snapshot.id} className={styles.historyItem}>
                <span className={styles.historyDate}>
                  {new Date(snapshot.snapshot_date).toLocaleDateString()}
                </span>
                <span className={styles.historyProgress}>
                  {snapshot.progress_percentage.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Description */}
      {goal.description && (
        <div className={styles.descriptionSection}>
          <h3 className={styles.sectionTitle}>Description</h3>
          <p className={styles.descriptionText}>{goal.description}</p>
        </div>
      )}

      {/* Actions */}
      <div className={styles.actions}>
        {onEdit && (
          <button onClick={onEdit} className={styles.editButton}>
            <i className="icon-edit" aria-hidden="true" />
            Edit Goal
          </button>
        )}

        {onDelete && goal.status !== 'achieved' && (
          <button onClick={onDelete} className={styles.deleteButton}>
            <i className="icon-trash" aria-hidden="true" />
            Delete Goal
          </button>
        )}

        {goal.status === 'active' && (
          <button
            onClick={async () => {
              // Pause goal
              await goalProgressService.updateGoal(
                { goal_id: goalId, status: 'paused' },
                'current-user'
              );
              loadGoalData();
            }}
            className={styles.pauseButton}
          >
            <i className="icon-pause" aria-hidden="true" />
            Pause Goal
          </button>
        )}

        {goal.status === 'paused' && (
          <button
            onClick={async () => {
              // Resume goal
              await goalProgressService.updateGoal(
                { goal_id: goalId, status: 'active' },
                'current-user'
              );
              loadGoalData();
            }}
            className={styles.resumeButton}
          >
            <i className="icon-play" aria-hidden="true" />
            Resume Goal
          </button>
        )}
      </div>
    </div>
  );
};
