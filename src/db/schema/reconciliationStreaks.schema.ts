/**
 * Reconciliation Streaks Schema Definition
 *
 * Tracks reconciliation streaks for gamification and user motivation (E1 requirement).
 *
 * Requirements:
 * - E1: Reconciliation streak tracking
 * - ARCH-004: CRDT-Compatible Schema Design
 */

import type { ReconciliationStreak } from '../../types/reconciliation.types';
import { STREAK_MILESTONES } from '../../types/reconciliation.types';

/**
 * Dexie.js schema definition for ReconciliationStreaks table
 *
 * Indexes:
 * - [company_id+account_id]: Primary key (compound)
 * - company_id: For querying all streaks by company
 * - streak_status: For filtering active/broken streaks
 * - next_due_date: For finding upcoming due dates
 * - updated_at: For CRDT conflict resolution
 */
export const reconciliationStreaksSchema =
  '[company_id+account_id], company_id, streak_status, next_due_date, updated_at';

/**
 * Table name constant
 */
export const RECONCILIATION_STREAKS_TABLE = 'reconciliation_streaks';

/**
 * Default values for new ReconciliationStreak
 */
export const createDefaultReconciliationStreak = (
  companyId: string,
  accountId: string
): Partial<ReconciliationStreak> => {
  const now = Date.now();

  return {
    company_id: companyId,
    account_id: accountId,
    current_streak: 0,
    best_streak: 0,
    last_reconciliation_date: 0,
    next_due_date: getNextDueDate(now),
    streak_status: 'broken',
    milestones_achieved: [],
  };
};

/**
 * Calculate next due date (10 days after month end)
 */
export const getNextDueDate = (fromDate: number): number => {
  const date = new Date(fromDate);

  // Move to next month
  date.setMonth(date.getMonth() + 1);

  // Set to first day of month
  date.setDate(1);

  // Add 10 days grace period
  date.setDate(11);

  return date.getTime();
};

/**
 * Calculate if reconciliation is within streak window
 * Streak is maintained if reconciled within 10 days of month end
 */
export const isWithinStreakWindow = (
  reconciliationDate: number,
  statementPeriodEnd: number
): boolean => {
  const periodEnd = new Date(statementPeriodEnd);
  const reconDate = new Date(reconciliationDate);

  // Get last day of month for statement period
  const lastDay = new Date(periodEnd.getFullYear(), periodEnd.getMonth() + 1, 0);

  // Allow 10 days after month end
  const deadline = new Date(lastDay);
  deadline.setDate(lastDay.getDate() + 10);

  return reconDate <= deadline;
};

/**
 * Check if reconciliation covers the expected month
 */
export const coversExpectedMonth = (
  statementPeriodStart: number,
  statementPeriodEnd: number,
  expectedMonth: Date
): boolean => {
  const periodStart = new Date(statementPeriodStart);
  const periodEnd = new Date(statementPeriodEnd);

  const expectedYear = expectedMonth.getFullYear();
  const expectedMonthNum = expectedMonth.getMonth();

  // Check if statement period overlaps with expected month
  const startMatches =
    periodStart.getFullYear() === expectedYear &&
    periodStart.getMonth() === expectedMonthNum;

  const endMatches =
    periodEnd.getFullYear() === expectedYear &&
    periodEnd.getMonth() === expectedMonthNum;

  return startMatches || endMatches;
};

/**
 * Update streak based on new reconciliation
 */
export const updateStreak = (
  currentStreak: ReconciliationStreak,
  reconciliationDate: number,
  statementPeriodEnd: number,
  discrepancy: number
): ReconciliationStreak => {
  const now = Date.now();

  // Check if reconciliation qualifies for streak
  const qualifiesForStreak =
    isWithinStreakWindow(reconciliationDate, statementPeriodEnd) &&
    Math.abs(discrepancy) < 500; // Less than $5 discrepancy

  if (!qualifiesForStreak) {
    // Streak broken
    return {
      ...currentStreak,
      current_streak: 0,
      last_reconciliation_date: reconciliationDate,
      next_due_date: getNextDueDate(statementPeriodEnd),
      streak_status: 'broken',
    };
  }

  // Check if this is consecutive month
  const lastReconDate = new Date(currentStreak.last_reconciliation_date);
  const thisStatementEnd = new Date(statementPeriodEnd);

  const isConsecutive = isConsecutiveMonth(lastReconDate, thisStatementEnd);

  const newStreak = isConsecutive ? currentStreak.current_streak + 1 : 1;
  const newBestStreak = Math.max(newStreak, currentStreak.best_streak);

  // Check for new milestones
  const newMilestones = [...currentStreak.milestones_achieved];
  for (const milestone of STREAK_MILESTONES) {
    const alreadyAchieved = newMilestones.some((m) => m.milestone === milestone.months);

    if (!alreadyAchieved && newStreak >= milestone.months) {
      newMilestones.push({
        milestone: milestone.months,
        achieved_at: now,
      });
    }
  }

  // Determine streak status
  let streakStatus: 'active' | 'broken' | 'at_risk';
  const daysUntilDue = getDaysUntilDue(getNextDueDate(statementPeriodEnd));

  if (daysUntilDue <= 5) {
    streakStatus = 'at_risk';
  } else {
    streakStatus = 'active';
  }

  return {
    ...currentStreak,
    current_streak: newStreak,
    best_streak: newBestStreak,
    last_reconciliation_date: reconciliationDate,
    next_due_date: getNextDueDate(statementPeriodEnd),
    streak_status: streakStatus,
    milestones_achieved: newMilestones,
  };
};

/**
 * Check if two dates are in consecutive months
 */
export const isConsecutiveMonth = (date1: Date, date2: Date): boolean => {
  const year1 = date1.getFullYear();
  const month1 = date1.getMonth();

  const year2 = date2.getFullYear();
  const month2 = date2.getMonth();

  // Same month doesn't count as consecutive
  if (year1 === year2 && month1 === month2) {
    return false;
  }

  // Check if date2 is exactly one month after date1
  const expectedYear = month1 === 11 ? year1 + 1 : year1;
  const expectedMonth = (month1 + 1) % 12;

  return year2 === expectedYear && month2 === expectedMonth;
};

/**
 * Get days until next reconciliation is due
 */
export const getDaysUntilDue = (dueDate: number): number => {
  const now = Date.now();
  const diffMs = dueDate - now;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
};

/**
 * Get next milestone for streak
 */
export const getNextMilestone = (
  currentStreak: number
): { months: 3 | 6 | 12 | 24; name: string; description: string } | null => {
  for (const milestone of STREAK_MILESTONES) {
    if (currentStreak < milestone.months) {
      return {
        months: milestone.months,
        name: milestone.badge_name,
        description: milestone.description,
      };
    }
  }

  return null; // Already achieved all milestones
};

/**
 * Get achieved milestone badges
 */
export const getAchievedBadges = (
  streak: ReconciliationStreak
): Array<{
  months: 3 | 6 | 12 | 24;
  badge_name: string;
  description: string;
  icon: string;
  achieved_at: number;
}> => {
  return streak.milestones_achieved.map((achieved) => {
    const milestone = STREAK_MILESTONES.find((m) => m.months === achieved.milestone);
    return {
      months: achieved.milestone,
      badge_name: milestone?.badge_name || 'Unknown',
      description: milestone?.description || '',
      icon: milestone?.icon || '✓',
      achieved_at: achieved.achieved_at,
    };
  });
};

/**
 * Calculate progress to next milestone
 */
export const getMilestoneProgress = (
  currentStreak: number
): { current: number; target: number; percentage: number } | null => {
  const next = getNextMilestone(currentStreak);

  if (!next) {
    return null; // All milestones achieved
  }

  return {
    current: currentStreak,
    target: next.months,
    percentage: Math.round((currentStreak / next.months) * 100),
  };
};

/**
 * Check if streak is at risk (due soon or overdue)
 */
export const isStreakAtRisk = (streak: ReconciliationStreak): boolean => {
  if (streak.current_streak === 0) return false;

  const daysUntilDue = getDaysUntilDue(streak.next_due_date);
  return daysUntilDue <= 5;
};

/**
 * Get encouragement message based on streak status
 */
export const getStreakMessage = (
  streak: ReconciliationStreak,
  discProfileType?: 'D' | 'I' | 'S' | 'C'
): string => {
  const { current_streak, streak_status } = streak;

  if (current_streak === 0) {
    return getNewStreakMessage(discProfileType);
  }

  if (streak_status === 'at_risk') {
    return getAtRiskMessage(current_streak, discProfileType);
  }

  if (current_streak >= 3) {
    return getActiveStreakMessage(current_streak, discProfileType);
  }

  return getStartingStreakMessage(current_streak, discProfileType);
};

const getNewStreakMessage = (profile?: 'D' | 'I' | 'S' | 'C'): string => {
  const messages = {
    D: 'Start a new streak this month. Consistent reconciliation = better business insights.',
    I: "Let's start a new streak together! You've got this! 🎯",
    S: "It's okay to start fresh. Take your time and reconcile when you're ready.",
    C: 'Begin a new reconciliation streak to maintain accurate financial records.',
  };

  return messages[profile || 'S'];
};

const getAtRiskMessage = (streak: number, profile?: 'D' | 'I' | 'S' | 'C'): string => {
  const messages = {
    D: `Don't lose your ${streak}-month streak. Reconcile now.`,
    I: `You're on a ${streak}-month roll! Keep it going! ⭐`,
    S: `You've done great for ${streak} months. A little more to keep your streak going.`,
    C: `Your ${streak}-month streak requires reconciliation soon to maintain consistency.`,
  };

  return messages[profile || 'S'];
};

const getActiveStreakMessage = (streak: number, profile?: 'D' | 'I' | 'S' | 'C'): string => {
  const messages = {
    D: `${streak} months straight. Efficient.`,
    I: `Amazing! ${streak} months in a row! You're a rockstar! 🌟`,
    S: `You've been consistent for ${streak} months. That's wonderful progress.`,
    C: `${streak} consecutive months reconciled. Excellent attention to detail.`,
  };

  return messages[profile || 'S'];
};

const getStartingStreakMessage = (streak: number, profile?: 'D' | 'I' | 'S' | 'C'): string => {
  const messages = {
    D: `${streak} month${streak > 1 ? 's' : ''}. Keep going.`,
    I: `${streak} month${streak > 1 ? 's' : ''} down! You're building great habits! 🎉`,
    S: `You're building a habit. ${streak} month${streak > 1 ? 's' : ''} so far.`,
    C: `${streak} month${streak > 1 ? 's' : ''} of consistent reconciliation documented.`,
  };

  return messages[profile || 'S'];
};
