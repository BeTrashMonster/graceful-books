/**
 * Goals Dashboard Component
 *
 * Main dashboard displaying all financial goals with filtering and celebrations
 *
 * WCAG 2.1 AA Compliant:
 * - Keyboard navigation
 * - Screen reader announcements
 * - Clear visual hierarchy
 * - Confetti celebration on achievement
 */

import React, { useState, useEffect } from 'react';
import { goalProgressService } from '../../services/goals';
import { triggerCelebration } from '../../utils/confetti';
import type { FinancialGoal, GoalsDashboardResponse, CreateGoalRequest } from '../../types/goals.types';
import { GoalCard } from './GoalCard';
import { GoalCreationWizard } from './GoalCreationWizard';
import { GoalDetailView } from './GoalDetailView';
import styles from './GoalsDashboard.module.css';

interface GoalsDashboardProps {
  companyId: string;
}

export const GoalsDashboard: React.FC<GoalsDashboardProps> = ({ companyId }) => {
  const [dashboard, setDashboard] = useState<GoalsDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [celebrationMessage, setCelebrationMessage] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
  }, [companyId]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const data = await goalProgressService.getGoalsDashboard({ company_id: companyId });
      setDashboard(data);
    } catch (error) {
      console.error('Failed to load goals dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGoal = async (request: CreateGoalRequest) => {
    try {
      await goalProgressService.createGoal(request, 'current-user');
      setShowWizard(false);
      loadDashboard();
    } catch (error) {
      console.error('Failed to create goal:', error);
    }
  };

  const handleGoalClick = (goalId: string) => {
    setSelectedGoalId(goalId);
  };

  const handleUpdateProgress = async (goalId: string) => {
    try {
      const result = await goalProgressService.updateGoalProgress({
        goal_id: goalId,
        company_id: companyId,
      });

      // Check for celebrations
      if (result.celebrations.length > 0) {
        const achievementCelebration = result.celebrations.find((c) => c.show_confetti);

        if (achievementCelebration) {
          setCelebrationMessage(achievementCelebration.message);
          triggerCelebration();

          // Clear celebration message after 5 seconds
          setTimeout(() => setCelebrationMessage(null), 5000);
        }
      }

      loadDashboard();
    } catch (error) {
      console.error('Failed to update goal progress:', error);
    }
  };

  if (loading) {
    return (
      <div className={styles.dashboard}>
        <div className={styles.loading}>Loading goals...</div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className={styles.dashboard}>
        <div className={styles.error}>Failed to load goals</div>
      </div>
    );
  }

  return (
    <div className={styles.dashboard}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Financial Goals</h1>
          <p className={styles.subtitle}>
            Track your progress toward key financial targets
          </p>
        </div>

        <button
          onClick={() => setShowWizard(true)}
          className={styles.createButton}
          aria-label="Create new goal"
        >
          <i className="icon-plus" aria-hidden="true" />
          New Goal
        </button>
      </div>

      {/* Celebration message */}
      {celebrationMessage && (
        <div
          className={styles.celebration}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <i className="icon-trophy" aria-hidden="true" />
          <span>{celebrationMessage}</span>
        </div>
      )}

      {/* Stats */}
      {dashboard.total_goals_created > 0 && (
        <div className={styles.stats}>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{dashboard.active_goals.length}</div>
            <div className={styles.statLabel}>Active Goals</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{dashboard.total_goals_achieved}</div>
            <div className={styles.statLabel}>Achieved</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{dashboard.achievement_rate}%</div>
            <div className={styles.statLabel}>Success Rate</div>
          </div>
        </div>
      )}

      {/* Active goals */}
      {dashboard.active_goals.length > 0 && (
        <section className={styles.section} aria-labelledby="active-goals-heading">
          <h2 id="active-goals-heading" className={styles.sectionTitle}>
            Active Goals
          </h2>

          <div className={styles.goalsGrid}>
            {dashboard.active_goals.map((goal) => (
              <GoalCardWrapper
                key={goal.id}
                goal={goal}
                onClick={() => handleGoalClick(goal.id)}
                onUpdate={() => handleUpdateProgress(goal.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Paused goals */}
      {dashboard.paused_goals.length > 0 && (
        <section className={styles.section} aria-labelledby="paused-goals-heading">
          <h2 id="paused-goals-heading" className={styles.sectionTitle}>
            Paused Goals
          </h2>

          <div className={styles.goalsGrid}>
            {dashboard.paused_goals.map((goal) => (
              <GoalCardWrapper
                key={goal.id}
                goal={goal}
                onClick={() => handleGoalClick(goal.id)}
                onUpdate={() => handleUpdateProgress(goal.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Wins (achieved goals) */}
      {dashboard.achieved_goals.length > 0 && (
        <section className={styles.section} aria-labelledby="wins-heading">
          <h2 id="wins-heading" className={styles.sectionTitle}>
            <i className="icon-trophy" aria-hidden="true" />
            Wins - Goals You've Achieved
          </h2>

          <div className={styles.goalsGrid}>
            {dashboard.achieved_goals.map((goal) => (
              <GoalCardWrapper
                key={goal.id}
                goal={goal}
                onClick={() => handleGoalClick(goal.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {dashboard.total_goals_created === 0 && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <i className="icon-target" aria-hidden="true" />
          </div>
          <h3 className={styles.emptyTitle}>No Goals Yet</h3>
          <p className={styles.emptyDescription}>
            Set a financial goal to start tracking your progress. Whether it's revenue, profit,
            runway, or savings - we'll help you stay motivated and on track.
          </p>
          <button onClick={() => setShowWizard(true)} className={styles.emptyButton}>
            Create Your First Goal
          </button>
        </div>
      )}

      {/* Wizard modal */}
      {showWizard && (
        <div className={styles.modal} role="dialog" aria-modal="true">
          <div className={styles.modalBackdrop} onClick={() => setShowWizard(false)} />
          <div className={styles.modalContent}>
            <GoalCreationWizard
              companyId={companyId}
              onComplete={handleCreateGoal}
              onCancel={() => setShowWizard(false)}
            />
          </div>
        </div>
      )}

      {/* Detail view modal */}
      {selectedGoalId && (
        <div className={styles.modal} role="dialog" aria-modal="true">
          <div className={styles.modalBackdrop} onClick={() => setSelectedGoalId(null)} />
          <div className={styles.modalContent}>
            <GoalDetailView
              goalId={selectedGoalId}
              onClose={() => setSelectedGoalId(null)}
              onDelete={async () => {
                await goalProgressService.deleteGoal(selectedGoalId, 'current-user');
                setSelectedGoalId(null);
                loadDashboard();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// Helper component to load goal card data
const GoalCardWrapper: React.FC<{
  goal: FinancialGoal;
  onClick: () => void;
  onUpdate?: () => void;
}> = ({ goal, onClick, onUpdate }) => {
  const [cardData, setCardData] = useState<any>(null);

  useEffect(() => {
    loadCardData();
  }, [goal.id]);

  const loadCardData = async () => {
    try {
      const data = await goalProgressService.getGoalCardData(goal.id);
      setCardData(data);
    } catch (error) {
      console.error('Failed to load goal card data:', error);
    }
  };

  if (!cardData) {
    return <div className={styles.cardLoading}>Loading...</div>;
  }

  return <GoalCard goalData={cardData} onClick={onClick} />;
};
