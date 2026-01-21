/**
 * Goal Progress Service
 *
 * Implements J5: Financial Goals Tracking - Metric integration and auto-update
 *
 * Features:
 * - Automatic progress updates from J4 metrics and J6 runway
 * - Goal CRUD operations
 * - Progress snapshot creation (historical tracking)
 * - Milestone celebration event generation
 * - Integration with database
 *
 * Integration Points:
 * - J4 metrics (revenue, profit via profitability metrics)
 * - J6 runway calculator (runway goals)
 * - Database (financial_goals, goal_progress_snapshots)
 */

import { nanoid } from 'nanoid';
import Decimal from 'decimal.js';
import { db } from '../../db/database';
import { goalCalculatorService } from './goalCalculator.service';
import { ProfitabilityMetricsService } from '../metrics/profitabilityMetrics.service';
import { runwayCalculatorService } from '../runway/runwayCalculator.service';
import type {
  FinancialGoal,
  GoalType,
  CreateGoalRequest,
  UpdateGoalRequest,
  UpdateGoalProgressRequest,
  UpdateGoalProgressResponse,
  GoalsDashboardRequest,
  GoalsDashboardResponse,
  GoalProgressSnapshot,
  MilestoneCelebration,
  GoalCardData,
  GoalWinEntry,
} from '../../types/goals.types';
import {
  createDefaultFinancialGoal,
  createDefaultGoalProgressSnapshot,
} from '../../db/schema/goals.schema';
import { logger } from '../../utils/logger';

const goalsLogger = logger.child('GoalProgressService');

// Configure Decimal.js
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/**
 * Goal Progress Service
 */
export class GoalProgressService {
  /**
   * Create a new financial goal
   */
  async createGoal(request: CreateGoalRequest, userId: string): Promise<FinancialGoal> {
    const goalId = nanoid();
    const now = Date.now();

    // Validate custom goals have required fields
    if (request.type === 'custom') {
      if (!request.custom_metric_name) {
        throw new Error('Custom goals require a metric name');
      }
      if (!request.custom_metric_formula) {
        throw new Error('Custom goals require a formula');
      }
    }

    // Format target amount
    const targetDecimal = new Decimal(request.target_amount);
    const targetFormatted = this.formatAmount(targetDecimal, request.type);

    const goal: FinancialGoal = {
      ...createDefaultFinancialGoal(),
      id: goalId,
      company_id: request.company_id,
      name: request.name,
      description: request.description || '',
      type: request.type,
      period: request.period,
      target_amount: targetDecimal.toString(),
      target_amount_formatted: targetFormatted,
      deadline: request.deadline,
      personal_note: request.personal_note,
      custom_metric_name: request.custom_metric_name,
      custom_metric_formula: request.custom_metric_formula,
      created_at: now,
      updated_at: now,
      last_modified_by: userId,
    };

    // Save to database
    await db.financialGoals.add(goal);

    goalsLogger.info('Goal created', { goalId, type: goal.type, targetAmount: goal.target_amount });

    // Calculate initial progress
    await this.updateGoalProgress({
      goal_id: goalId,
      company_id: request.company_id,
    });

    return goal;
  }

  /**
   * Update a goal
   */
  async updateGoal(request: UpdateGoalRequest, userId: string): Promise<FinancialGoal> {
    const goal = await db.financialGoals.get(request.goal_id);

    if (!goal) {
      throw new Error(`Goal not found: ${request.goal_id}`);
    }

    const updates: Partial<FinancialGoal> = {
      updated_at: Date.now(),
      last_modified_by: userId,
      version: goal.version + 1,
    };

    if (request.name !== undefined) {
      updates.name = request.name;
    }

    if (request.description !== undefined) {
      updates.description = request.description;
    }

    if (request.target_amount !== undefined) {
      const targetDecimal = new Decimal(request.target_amount);
      updates.target_amount = targetDecimal.toString();
      updates.target_amount_formatted = this.formatAmount(targetDecimal, goal.type);
    }

    if (request.deadline !== undefined) {
      updates.deadline = request.deadline;
    }

    if (request.personal_note !== undefined) {
      updates.personal_note = request.personal_note;
    }

    if (request.status !== undefined) {
      updates.status = request.status;
    }

    await db.financialGoals.update(request.goal_id, updates);

    const updatedGoal = await db.financialGoals.get(request.goal_id);
    if (!updatedGoal) {
      throw new Error(`Failed to retrieve updated goal: ${request.goal_id}`);
    }

    goalsLogger.info('Goal updated', { goalId: request.goal_id });

    return updatedGoal;
  }

  /**
   * Delete a goal (soft delete)
   */
  async deleteGoal(goalId: string, userId: string): Promise<void> {
    const goal = await db.financialGoals.get(goalId);

    if (!goal) {
      throw new Error(`Goal not found: ${goalId}`);
    }

    await db.financialGoals.update(goalId, {
      is_deleted: true,
      updated_at: Date.now(),
      last_modified_by: userId,
      version: goal.version + 1,
    });

    goalsLogger.info('Goal deleted', { goalId });
  }

  /**
   * Update goal progress from current metrics
   */
  async updateGoalProgress(
    request: UpdateGoalProgressRequest
  ): Promise<UpdateGoalProgressResponse> {
    const goal = await db.financialGoals.get(request.goal_id);

    if (!goal) {
      throw new Error(`Goal not found: ${request.goal_id}`);
    }

    // Get current metric value
    const currentAmount = await this.getCurrentMetricValue(goal);

    // Calculate progress
    const calculation = goalCalculatorService.calculateProgress(goal, currentAmount);

    // Determine if any new milestones were reached
    const celebrations: MilestoneCelebration[] = [];

    for (const milestone of calculation.newly_reached_milestones) {
      const celebration: MilestoneCelebration = {
        goal_id: goal.id,
        milestone,
        reached_at: Date.now(),
        message: this.getMilestoneMessage(milestone, goal.name),
        show_confetti: milestone === '100', // Only confetti at achievement
      };

      celebrations.push(celebration);
    }

    // Update goal with new progress
    const updatedMilestones = [
      ...goal.milestones_reached,
      ...calculation.newly_reached_milestones,
    ];

    const updates: Partial<FinancialGoal> = {
      current_amount: calculation.current_amount,
      current_amount_formatted: this.formatAmount(
        new Decimal(calculation.current_amount),
        goal.type
      ),
      progress_percentage: calculation.progress_percentage,
      progress_status: calculation.progress_status,
      milestones_reached: updatedMilestones,
      updated_at: Date.now(),
    };

    // If 100% milestone reached, mark as achieved
    if (calculation.newly_reached_milestones.includes('100')) {
      updates.status = 'achieved';
      updates.achieved_at = Date.now();
      updates.last_milestone_date = Date.now();
    } else if (calculation.newly_reached_milestones.length > 0) {
      updates.last_milestone_date = Date.now();
    }

    await db.financialGoals.update(goal.id, updates);

    // Create progress snapshot for historical tracking
    await this.createProgressSnapshot(goal.id, goal.company_id, calculation.current_amount);

    const updatedGoal = await db.financialGoals.get(goal.id);
    if (!updatedGoal) {
      throw new Error(`Failed to retrieve updated goal: ${goal.id}`);
    }

    goalsLogger.info('Goal progress updated', {
      goalId: goal.id,
      progress: calculation.progress_percentage,
      newMilestones: calculation.newly_reached_milestones,
    });

    return {
      goal: updatedGoal,
      calculation,
      celebrations,
    };
  }

  /**
   * Get current metric value for a goal
   */
  private async getCurrentMetricValue(goal: FinancialGoal): Promise<string> {
    const now = Date.now();
    const startOfYear = new Date(new Date().getFullYear(), 0, 1).getTime();

    switch (goal.type) {
      case 'revenue': {
        // Use J4 profitability metrics to get revenue
        const profitabilityService = new ProfitabilityMetricsService(db);
        const metrics = await profitabilityService.calculateProfitabilityMetrics({
          company_id: goal.company_id,
          date_range: { start_date: startOfYear, end_date: now },
          include_barter: true,
        });

        // Get total revenue from breakdown
        return metrics.revenue_breakdown?.total_revenue || '0';
      }

      case 'profit': {
        // Use J4 profitability metrics to get net profit
        const profitabilityService = new ProfitabilityMetricsService(db);
        const metrics = await profitabilityService.calculateProfitabilityMetrics({
          company_id: goal.company_id,
          date_range: { start_date: startOfYear, end_date: now },
          include_barter: true,
        });

        // Calculate net profit from margin
        const totalRevenue = new Decimal(metrics.revenue_breakdown?.total_revenue || '0');
        const netMargin = new Decimal(metrics.net_profit_margin.value).dividedBy(100);
        const netProfit = totalRevenue.times(netMargin);

        return netProfit.toString();
      }

      case 'runway': {
        // Use J6 runway calculator
        const now = new Date();
        const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        const dateRange = {
          preset: 'last-90-days' as const,
          startDate: ninetyDaysAgo,
          endDate: now,
          label: 'Last 90 Days',
        };
        const calculation = await runwayCalculatorService.calculateRunway(
          goal.company_id,
          'simple',
          dateRange
        );

        return calculation.months_of_runway.toString();
      }

      case 'savings': {
        // Get cash account balances (implementation depends on account structure)
        // For now, return current amount from goal
        return goal.current_amount;
      }

      case 'custom': {
        // Custom goals require manual update or formula evaluation
        // For now, return current amount from goal
        return goal.current_amount;
      }

      default:
        return '0';
    }
  }

  /**
   * Create progress snapshot for historical tracking
   */
  private async createProgressSnapshot(
    goalId: string,
    companyId: string,
    currentAmount: string
  ): Promise<void> {
    const goal = await db.financialGoals.get(goalId);
    if (!goal) return;

    const snapshot: GoalProgressSnapshot = {
      ...createDefaultGoalProgressSnapshot(),
      id: nanoid(),
      goal_id: goalId,
      company_id: companyId,
      current_amount: currentAmount,
      progress_percentage: goal.progress_percentage,
    };

    await db.goalProgressSnapshots.add(snapshot);
  }

  /**
   * Get goals dashboard
   */
  async getGoalsDashboard(request: GoalsDashboardRequest): Promise<GoalsDashboardResponse> {
    let query = db.financialGoals.where('company_id').equals(request.company_id);

    // Filter out deleted goals
    let allGoals = await query.filter((goal) => !goal.is_deleted).toArray();

    // Apply status filter
    if (request.status_filter && request.status_filter.length > 0) {
      allGoals = allGoals.filter((goal) => request.status_filter!.includes(goal.status));
    }

    // Apply type filter
    if (request.type_filter && request.type_filter.length > 0) {
      allGoals = allGoals.filter((goal) => request.type_filter!.includes(goal.type));
    }

    // Separate by status
    const activeGoals = allGoals.filter((goal) => goal.status === 'active');
    const achievedGoals = allGoals.filter((goal) => goal.status === 'achieved');
    const pausedGoals = allGoals.filter((goal) => goal.status === 'paused');

    const totalGoalsCreated = allGoals.length;
    const totalGoalsAchieved = achievedGoals.length;
    const achievementRate =
      totalGoalsCreated > 0 ? (totalGoalsAchieved / totalGoalsCreated) * 100 : 0;

    return {
      active_goals: activeGoals,
      achieved_goals: achievedGoals,
      paused_goals: pausedGoals,
      total_goals_created: totalGoalsCreated,
      total_goals_achieved: totalGoalsAchieved,
      achievement_rate: Math.round(achievementRate),
    };
  }

  /**
   * Get goal by ID
   */
  async getGoal(goalId: string): Promise<FinancialGoal | null> {
    const goal = await db.financialGoals.get(goalId);

    if (!goal || goal.is_deleted) {
      return null;
    }

    return goal;
  }

  /**
   * Get goal card data for display
   */
  async getGoalCardData(goalId: string): Promise<GoalCardData> {
    const goal = await this.getGoal(goalId);

    if (!goal) {
      throw new Error(`Goal not found: ${goalId}`);
    }

    const calculation = goalCalculatorService.calculateProgress(goal, goal.current_amount);

    const displayColor = goalCalculatorService.getDisplayColor(calculation.progress_status);
    const iconName = goalCalculatorService.getGoalTypeIcon(goal.type);
    const statusIcon = goalCalculatorService.getStatusIcon(calculation.progress_status);
    const countdownText = goalCalculatorService.formatCountdownText(calculation.days_remaining);
    const progressText = goalCalculatorService.formatProgressText(
      goal.current_amount,
      goal.target_amount,
      goal.type
    );

    return {
      goal,
      calculation,
      display_color: displayColor,
      icon_name: iconName,
      status_icon: statusIcon,
      countdown_text: countdownText,
      progress_text: progressText,
    };
  }

  /**
   * Get wins (achieved goals) for display
   */
  async getGoalWins(companyId: string): Promise<GoalWinEntry[]> {
    const achievedGoals = await db.financialGoals
      .where('company_id')
      .equals(companyId)
      .filter((goal) => goal.status === 'achieved' && !goal.is_deleted)
      .toArray();

    const wins: GoalWinEntry[] = achievedGoals.map((goal) => {
      const daysToAchieve = goal.achieved_at
        ? Math.ceil((goal.achieved_at - goal.created_at) / (1000 * 60 * 60 * 24))
        : 0;

      return {
        goal,
        achieved_date: goal.achieved_at || goal.updated_at,
        days_to_achieve: daysToAchieve,
        celebration_message: `You achieved your ${goal.name} goal! Great work!`,
      };
    });

    // Sort by achievement date (most recent first)
    wins.sort((a, b) => b.achieved_date - a.achieved_date);

    return wins;
  }

  /**
   * Get progress history for a goal
   */
  async getProgressHistory(goalId: string): Promise<GoalProgressSnapshot[]> {
    const snapshots = await db.goalProgressSnapshots
      .where('goal_id')
      .equals(goalId)
      .sortBy('snapshot_date');

    return snapshots;
  }

  /**
   * Format amount based on goal type
   */
  private formatAmount(amount: Decimal, goalType: GoalType): string {
    switch (goalType) {
      case 'revenue':
      case 'profit':
      case 'savings':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(amount.toNumber());

      case 'runway':
        return `${amount.toFixed(1)} months`;

      case 'custom':
        return amount.toFixed(0);

      default:
        return amount.toString();
    }
  }

  /**
   * Get milestone celebration message
   */
  private getMilestoneMessage(milestone: string, goalName: string): string {
    switch (milestone) {
      case '25':
        return `You're 25% of the way to ${goalName}. You're making progress!`;
      case '50':
        return `Halfway there on ${goalName}! Keep going!`;
      case '75':
        return `You're 75% of the way to ${goalName}. Almost there!`;
      case '100':
        return `Goal achieved: ${goalName}! 🎉 You did it!`;
      default:
        return `Milestone reached on ${goalName}!`;
    }
  }
}

// Export singleton instance
export const goalProgressService = new GoalProgressService();
