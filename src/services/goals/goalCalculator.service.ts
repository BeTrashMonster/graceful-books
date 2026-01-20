/**
 * Goal Calculator Service
 *
 * Implements J5: Financial Goals Tracking - Progress calculation and milestone detection
 *
 * Features:
 * - Progress percentage calculation
 * - On-track / behind / at-risk status determination
 * - Milestone detection (25%, 50%, 75%, 100%)
 * - Required monthly progress calculation
 * - Pace analysis (actual vs required)
 * - Action recommendations when behind
 *
 * Philosophy (from ROADMAP):
 * - No milestone spam - celebrations only at achievement
 * - No pressure tactics - calm, motivating presentation
 * - Transparent calculations - show the math
 * - User in control - easy to adjust or pause goals
 */

import Decimal from 'decimal.js';
import type {
  FinancialGoal,
  GoalCalculation,
  GoalProgressStatus,
  GoalMilestone,
  GoalType,
} from '../../types/goals.types';

// Configure Decimal.js for currency precision
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/**
 * Calculate goal progress and status
 */
export class GoalCalculatorService {
  /**
   * Calculate current progress for a goal
   *
   * @param goal The financial goal
   * @param currentAmount Current value of the metric
   * @returns Complete goal calculation
   */
  calculateProgress(goal: FinancialGoal, currentAmount: string): GoalCalculation {
    const target = new Decimal(goal.target_amount);
    const current = new Decimal(currentAmount);

    // Calculate percentage (0-100)
    let progressPercentage = 0;
    if (target.greaterThan(0)) {
      progressPercentage = current.dividedBy(target).times(100).toDecimalPlaces(1).toNumber();
      // Cap at 100% for display (can exceed for over-achievement)
      progressPercentage = Math.min(progressPercentage, 100);
    }

    // Time analysis
    const now = Date.now();
    const createdAt = goal.created_at;
    const deadline = goal.deadline;

    const totalDays = Math.ceil((deadline - createdAt) / (1000 * 60 * 60 * 24));
    const daysElapsed = Math.ceil((now - createdAt) / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.max(0, Math.ceil((deadline - now) / (1000 * 60 * 60 * 24)));

    // Pace analysis
    const requiredMonthlyProgress = this.calculateRequiredMonthlyProgress(
      target,
      current,
      daysRemaining
    );

    const actualMonthlyProgress = this.calculateActualMonthlyProgress(
      current,
      daysElapsed
    );

    const paceVsTarget = this.calculatePaceVsTarget(
      actualMonthlyProgress,
      requiredMonthlyProgress
    );

    // Progress status (on-track, behind, at-risk)
    const progressStatus = this.determineProgressStatus(
      progressPercentage,
      daysElapsed,
      totalDays,
      paceVsTarget
    );

    // Milestone detection
    const previousMilestones = goal.milestones_reached;
    const newlyReachedMilestones = this.detectNewMilestones(
      progressPercentage,
      previousMilestones
    );

    const nextMilestone = this.getNextMilestone(progressPercentage);

    // Recommendation if behind
    const recommendation = this.generateRecommendation(
      goal.type,
      progressStatus,
      paceVsTarget,
      daysRemaining
    );

    return {
      goal_id: goal.id,
      current_amount: currentAmount,
      target_amount: goal.target_amount,
      progress_percentage: progressPercentage,
      progress_status: progressStatus,
      days_remaining: daysRemaining,
      days_elapsed: daysElapsed,
      total_days: totalDays,
      required_monthly_progress: requiredMonthlyProgress.toFixed(2),
      actual_monthly_progress: actualMonthlyProgress.toFixed(2),
      pace_vs_target: paceVsTarget.toFixed(1),
      next_milestone: nextMilestone,
      newly_reached_milestones: newlyReachedMilestones,
      recommendation,
    };
  }

  /**
   * Calculate required monthly progress to reach goal
   */
  private calculateRequiredMonthlyProgress(
    target: Decimal,
    current: Decimal,
    daysRemaining: number
  ): Decimal {
    if (daysRemaining <= 0) {
      return new Decimal(0);
    }

    const remaining = target.minus(current);
    if (remaining.lessThanOrEqualTo(0)) {
      return new Decimal(0); // Goal already achieved
    }

    // Convert days to approximate months (30 days per month)
    const monthsRemaining = new Decimal(daysRemaining).dividedBy(30);

    if (monthsRemaining.lessThanOrEqualTo(0)) {
      return remaining; // Less than a month left, need full remaining amount
    }

    return remaining.dividedBy(monthsRemaining);
  }

  /**
   * Calculate actual monthly progress so far
   */
  private calculateActualMonthlyProgress(
    current: Decimal,
    daysElapsed: number
  ): Decimal {
    if (daysElapsed <= 0) {
      return new Decimal(0);
    }

    // Convert days to approximate months
    const monthsElapsed = new Decimal(daysElapsed).dividedBy(30);

    if (monthsElapsed.lessThanOrEqualTo(0)) {
      return current; // Less than a month elapsed
    }

    return current.dividedBy(monthsElapsed);
  }

  /**
   * Calculate pace vs target (percentage ahead or behind)
   *
   * Positive = ahead of pace
   * Negative = behind pace
   */
  private calculatePaceVsTarget(
    actualMonthly: Decimal,
    requiredMonthly: Decimal
  ): Decimal {
    if (requiredMonthly.equals(0)) {
      return new Decimal(100); // Goal already achieved
    }

    const ratio = actualMonthly.dividedBy(requiredMonthly);
    const percentage = ratio.minus(1).times(100);

    return percentage;
  }

  /**
   * Determine progress status (on-track, behind, at-risk)
   */
  private determineProgressStatus(
    progressPercentage: number,
    daysElapsed: number,
    totalDays: number,
    paceVsTarget: Decimal
  ): GoalProgressStatus {
    // Calculate expected progress based on time elapsed
    const timeProgress = totalDays > 0 ? (daysElapsed / totalDays) * 100 : 0;

    // If goal is achieved or exceeding, always on-track
    if (progressPercentage >= 100) {
      return 'on-track';
    }

    // If significantly ahead of pace (20%+)
    if (paceVsTarget.greaterThanOrEqualTo(20)) {
      return 'on-track';
    }

    // If behind time progress by more than 20 percentage points
    if (progressPercentage < timeProgress - 20) {
      return 'at-risk';
    }

    // If behind time progress by 10-20 percentage points
    if (progressPercentage < timeProgress - 10) {
      return 'behind';
    }

    // Otherwise, on track
    return 'on-track';
  }

  /**
   * Detect newly reached milestones
   *
   * Returns milestones that have just been reached (not previously reached)
   */
  private detectNewMilestones(
    progressPercentage: number,
    previousMilestones: GoalMilestone[]
  ): GoalMilestone[] {
    const allPossibleMilestones: GoalMilestone[] = ['25', '50', '75', '100'];
    const newlyReached: GoalMilestone[] = [];

    for (const milestone of allPossibleMilestones) {
      const milestoneValue = parseInt(milestone, 10);

      // Check if milestone is reached but wasn't previously
      if (
        progressPercentage >= milestoneValue &&
        !previousMilestones.includes(milestone)
      ) {
        newlyReached.push(milestone);
      }
    }

    return newlyReached;
  }

  /**
   * Get next milestone to reach
   */
  private getNextMilestone(progressPercentage: number): GoalMilestone | undefined {
    const milestones: GoalMilestone[] = ['25', '50', '75', '100'];

    for (const milestone of milestones) {
      const milestoneValue = parseInt(milestone, 10);
      if (progressPercentage < milestoneValue) {
        return milestone;
      }
    }

    return undefined; // All milestones reached
  }

  /**
   * Generate action recommendation when behind
   */
  private generateRecommendation(
    goalType: GoalType,
    progressStatus: GoalProgressStatus,
    paceVsTarget: Decimal,
    daysRemaining: number
  ): string | undefined {
    // No recommendation if on track
    if (progressStatus === 'on-track') {
      return undefined;
    }

    // Recommendations based on goal type and status
    const recommendations: Record<GoalType, Record<GoalProgressStatus, string>> = {
      revenue: {
        'on-track': '',
        'behind': 'You\'re a bit behind pace. Consider reaching out to past clients or promoting current services.',
        'at-risk': 'You\'re significantly behind pace. Consider adjusting your pricing, increasing marketing efforts, or extending your deadline.',
      },
      profit: {
        'on-track': '',
        'behind': 'Profit is lagging. Review your expenses and look for areas to optimize without sacrificing quality.',
        'at-risk': 'Profit is significantly behind. Consider both increasing revenue and reducing non-essential expenses.',
      },
      runway: {
        'on-track': '',
        'behind': 'Runway progress is slower than expected. Focus on reducing burn rate or increasing cash reserves.',
        'at-risk': 'Runway is significantly behind target. This needs immediate attention - review all expenses and accelerate revenue.',
      },
      savings: {
        'on-track': '',
        'behind': 'Savings goal is behind pace. Try automating transfers to savings or finding areas to reduce discretionary spending.',
        'at-risk': 'Savings significantly behind. Consider adjusting your goal deadline or increasing your monthly savings commitment.',
      },
      custom: {
        'on-track': '',
        'behind': 'You\'re behind pace on this goal. Review your strategy and consider what adjustments might help.',
        'at-risk': 'This goal needs attention. Consider whether your target or timeline need adjustment.',
      },
    };

    const recommendation = recommendations[goalType]?.[progressStatus] || '';

    // Add urgency note if deadline is very close
    if (daysRemaining <= 30 && progressStatus === 'at-risk') {
      return `${recommendation} With only ${daysRemaining} days remaining, you may want to consider extending your deadline.`;
    }

    return recommendation || undefined;
  }

  /**
   * Calculate days until deadline
   */
  calculateDaysUntilDeadline(deadline: number): number {
    const now = Date.now();
    const daysRemaining = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
    return Math.max(0, daysRemaining);
  }

  /**
   * Format countdown text
   */
  formatCountdownText(daysRemaining: number): string {
    if (daysRemaining === 0) {
      return 'Deadline today';
    }

    if (daysRemaining < 0) {
      const daysOverdue = Math.abs(daysRemaining);
      if (daysOverdue === 1) {
        return '1 day overdue';
      }
      return `${daysOverdue} days overdue`;
    }

    if (daysRemaining === 1) {
      return '1 day left';
    }

    if (daysRemaining <= 30) {
      return `${daysRemaining} days left`;
    }

    const monthsRemaining = Math.floor(daysRemaining / 30);
    if (monthsRemaining === 1) {
      return '1 month left';
    }

    return `${monthsRemaining} months left`;
  }

  /**
   * Format progress text (e.g., "$8,000 of $10,000")
   */
  formatProgressText(current: string, target: string, goalType: GoalType): string {
    const currentDecimal = new Decimal(current);
    const targetDecimal = new Decimal(target);

    // Format based on goal type
    switch (goalType) {
      case 'revenue':
      case 'profit':
      case 'savings':
        return `${this.formatCurrency(currentDecimal)} of ${this.formatCurrency(targetDecimal)}`;

      case 'runway':
        return `${currentDecimal.toFixed(1)} of ${targetDecimal.toFixed(1)} months`;

      case 'custom':
        return `${currentDecimal.toFixed(0)} of ${targetDecimal.toFixed(0)}`;

      default:
        return `${currentDecimal.toFixed(2)} of ${targetDecimal.toFixed(2)}`;
    }
  }

  /**
   * Format currency
   */
  private formatCurrency(amount: Decimal): string {
    const value = amount.toNumber();

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }

  /**
   * Determine display color based on progress status
   */
  getDisplayColor(status: GoalProgressStatus): 'green' | 'yellow' | 'red' {
    switch (status) {
      case 'on-track':
        return 'green';
      case 'behind':
        return 'yellow';
      case 'at-risk':
        return 'red';
    }
  }

  /**
   * Get status icon name
   */
  getStatusIcon(status: GoalProgressStatus): string {
    switch (status) {
      case 'on-track':
        return 'check-circle';
      case 'behind':
        return 'alert-circle';
      case 'at-risk':
        return 'x-circle';
    }
  }

  /**
   * Get icon for goal type
   */
  getGoalTypeIcon(goalType: GoalType): string {
    switch (goalType) {
      case 'revenue':
        return 'trending-up';
      case 'profit':
        return 'dollar-sign';
      case 'runway':
        return 'clock';
      case 'savings':
        return 'piggy-bank';
      case 'custom':
        return 'target';
    }
  }
}

// Export singleton instance
export const goalCalculatorService = new GoalCalculatorService();
