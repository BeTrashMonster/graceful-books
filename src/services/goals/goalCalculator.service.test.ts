/**
 * Goal Calculator Service Tests
 *
 * Tests for J5: Financial Goals Tracking - Progress calculation and milestone detection
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GoalCalculatorService } from './goalCalculator.service';
import type { FinancialGoal, GoalType } from '../../types/goals.types';
import { createDefaultFinancialGoal } from '../../db/schema/goals.schema';

describe('GoalCalculatorService', () => {
  let service: GoalCalculatorService;
  let mockGoal: FinancialGoal;

  beforeEach(() => {
    service = new GoalCalculatorService();

    // Create a mock goal
    const now = Date.now();
    const deadline = now + 365 * 24 * 60 * 60 * 1000; // 1 year from now

    mockGoal = {
      ...createDefaultFinancialGoal(),
      id: 'test-goal-1',
      company_id: 'test-company',
      name: 'Test Revenue Goal',
      type: 'revenue',
      target_amount: '100000',
      target_amount_formatted: '$100,000',
      deadline,
    };
  });

  describe('calculateProgress', () => {
    it('should calculate progress percentage correctly', () => {
      const calculation = service.calculateProgress(mockGoal, '50000');

      expect(calculation.progress_percentage).toBe(50);
      expect(calculation.current_amount).toBe('50000');
      expect(calculation.target_amount).toBe('100000');
    });

    it('should cap progress at 100% for display', () => {
      const calculation = service.calculateProgress(mockGoal, '150000');

      expect(calculation.progress_percentage).toBe(100);
    });

    it('should handle zero progress', () => {
      const calculation = service.calculateProgress(mockGoal, '0');

      expect(calculation.progress_percentage).toBe(0);
    });

    it('should calculate days remaining correctly', () => {
      const calculation = service.calculateProgress(mockGoal, '50000');

      expect(calculation.days_remaining).toBeGreaterThan(360);
      expect(calculation.days_remaining).toBeLessThanOrEqual(365);
      expect(calculation.total_days).toBeGreaterThanOrEqual(365);
    });

    it('should determine on-track status when ahead of pace', () => {
      // Set deadline to 1 year, but already at 50% after only 3 months
      const createdAt = Date.now() - 90 * 24 * 60 * 60 * 1000; // 3 months ago
      const deadline = Date.now() + 275 * 24 * 60 * 60 * 1000; // 9 months remaining

      mockGoal.created_at = createdAt;
      mockGoal.deadline = deadline;

      const calculation = service.calculateProgress(mockGoal, '50000');

      expect(calculation.progress_status).toBe('on-track');
    });

    it('should detect behind status when moderately behind pace', () => {
      // Set deadline to 1 year, at 35% after 6 months (should be ~50%, so 15% behind)
      const createdAt = Date.now() - 180 * 24 * 60 * 60 * 1000; // 6 months ago
      const deadline = Date.now() + 185 * 24 * 60 * 60 * 1000; // 6 months remaining

      mockGoal.created_at = createdAt;
      mockGoal.deadline = deadline;

      const calculation = service.calculateProgress(mockGoal, '35000');

      expect(calculation.progress_status).toBe('behind');
    });

    it('should detect at-risk status when very far behind', () => {
      // Set deadline to 1 year, but only at 5% after 9 months
      const createdAt = Date.now() - 270 * 24 * 60 * 60 * 1000; // 9 months ago
      const deadline = Date.now() + 95 * 24 * 60 * 60 * 1000; // 3 months remaining

      mockGoal.created_at = createdAt;
      mockGoal.deadline = deadline;

      const calculation = service.calculateProgress(mockGoal, '5000');

      expect(calculation.progress_status).toBe('at-risk');
    });
  });

  describe('milestone detection', () => {
    it('should detect newly reached 25% milestone', () => {
      const calculation = service.calculateProgress(mockGoal, '25000');

      expect(calculation.newly_reached_milestones).toContain('25');
      expect(calculation.newly_reached_milestones.length).toBe(1);
    });

    it('should detect newly reached 50% milestone', () => {
      const calculation = service.calculateProgress(mockGoal, '50000');

      expect(calculation.newly_reached_milestones).toContain('25');
      expect(calculation.newly_reached_milestones).toContain('50');
      expect(calculation.newly_reached_milestones.length).toBe(2);
    });

    it('should detect newly reached 100% milestone', () => {
      const calculation = service.calculateProgress(mockGoal, '100000');

      expect(calculation.newly_reached_milestones).toContain('100');
    });

    it('should not detect milestones already reached', () => {
      mockGoal.milestones_reached = ['25'];

      const calculation = service.calculateProgress(mockGoal, '25000');

      expect(calculation.newly_reached_milestones).not.toContain('25');
      expect(calculation.newly_reached_milestones.length).toBe(0);
    });

    it('should detect multiple milestones at once if jumping ahead', () => {
      const calculation = service.calculateProgress(mockGoal, '80000');

      expect(calculation.newly_reached_milestones).toContain('25');
      expect(calculation.newly_reached_milestones).toContain('50');
      expect(calculation.newly_reached_milestones).toContain('75');
      expect(calculation.newly_reached_milestones.length).toBe(3);
    });

    it('should identify next milestone correctly', () => {
      mockGoal.milestones_reached = ['25'];

      const calculation = service.calculateProgress(mockGoal, '30000');

      expect(calculation.next_milestone).toBe('50');
    });

    it('should return undefined for next milestone when all reached', () => {
      mockGoal.milestones_reached = ['25', '50', '75', '100'];

      const calculation = service.calculateProgress(mockGoal, '100000');

      expect(calculation.next_milestone).toBeUndefined();
    });
  });

  describe('required monthly progress', () => {
    it('should calculate required monthly progress correctly', () => {
      const calculation = service.calculateProgress(mockGoal, '50000');

      const requiredMonthly = parseFloat(calculation.required_monthly_progress);

      // Should need ~$4,166/month to get remaining $50k over 12 months
      expect(requiredMonthly).toBeGreaterThan(4000);
      expect(requiredMonthly).toBeLessThan(4500);
    });

    it('should handle zero remaining amount (goal achieved)', () => {
      const calculation = service.calculateProgress(mockGoal, '100000');

      expect(parseFloat(calculation.required_monthly_progress)).toBe(0);
    });
  });

  describe('recommendations', () => {
    it('should provide revenue-specific recommendation when behind', () => {
      mockGoal.type = 'revenue';
      const createdAt = Date.now() - 180 * 24 * 60 * 60 * 1000;
      const deadline = Date.now() + 185 * 24 * 60 * 60 * 1000;

      mockGoal.created_at = createdAt;
      mockGoal.deadline = deadline;

      const calculation = service.calculateProgress(mockGoal, '10000');

      expect(calculation.recommendation).toBeDefined();
      expect(calculation.recommendation).toContain('behind pace');
    });

    it('should provide profit-specific recommendation when at-risk', () => {
      mockGoal.type = 'profit';
      const createdAt = Date.now() - 270 * 24 * 60 * 60 * 1000;
      const deadline = Date.now() + 95 * 24 * 60 * 60 * 1000;

      mockGoal.created_at = createdAt;
      mockGoal.deadline = deadline;

      const calculation = service.calculateProgress(mockGoal, '5000');

      expect(calculation.recommendation).toBeDefined();
      expect(calculation.recommendation).toContain('significantly behind');
    });

    it('should not provide recommendation when on-track', () => {
      const calculation = service.calculateProgress(mockGoal, '50000');

      expect(calculation.recommendation).toBeUndefined();
    });
  });

  describe('countdown formatting', () => {
    it('should format days remaining correctly', () => {
      const daysRemaining = 45;
      const text = service.formatCountdownText(daysRemaining);

      // 45 days is 1.5 months, rounds to 1 month
      expect(text).toBe('1 month left');
    });

    it('should format single day correctly', () => {
      const text = service.formatCountdownText(1);

      expect(text).toBe('1 day left');
    });

    it('should format months remaining for longer periods', () => {
      const daysRemaining = 150;
      const text = service.formatCountdownText(daysRemaining);

      expect(text).toBe('5 months left');
    });

    it('should handle deadline today', () => {
      const text = service.formatCountdownText(0);

      expect(text).toBe('Deadline today');
    });

    it('should handle overdue deadlines', () => {
      const text = service.formatCountdownText(-5);

      expect(text).toBe('5 days overdue');
    });
  });

  describe('progress text formatting', () => {
    it('should format revenue goal progress correctly', () => {
      const text = service.formatProgressText('50000', '100000', 'revenue');

      expect(text).toContain('$50,000');
      expect(text).toContain('$100,000');
    });

    it('should format runway goal progress correctly', () => {
      const text = service.formatProgressText('6.5', '12', 'runway');

      expect(text).toContain('6.5');
      expect(text).toContain('12');
      expect(text).toContain('months');
    });

    it('should format custom goal progress correctly', () => {
      const text = service.formatProgressText('75', '100', 'custom');

      expect(text).toContain('75');
      expect(text).toContain('100');
    });
  });

  describe('display helpers', () => {
    it('should return correct color for on-track status', () => {
      const color = service.getDisplayColor('on-track');

      expect(color).toBe('green');
    });

    it('should return correct color for behind status', () => {
      const color = service.getDisplayColor('behind');

      expect(color).toBe('yellow');
    });

    it('should return correct color for at-risk status', () => {
      const color = service.getDisplayColor('at-risk');

      expect(color).toBe('red');
    });

    it('should return correct icon for goal type', () => {
      expect(service.getGoalTypeIcon('revenue')).toBe('trending-up');
      expect(service.getGoalTypeIcon('profit')).toBe('dollar-sign');
      expect(service.getGoalTypeIcon('runway')).toBe('clock');
      expect(service.getGoalTypeIcon('savings')).toBe('piggy-bank');
      expect(service.getGoalTypeIcon('custom')).toBe('target');
    });

    it('should return correct status icon', () => {
      expect(service.getStatusIcon('on-track')).toBe('check-circle');
      expect(service.getStatusIcon('behind')).toBe('alert-circle');
      expect(service.getStatusIcon('at-risk')).toBe('x-circle');
    });
  });
});
