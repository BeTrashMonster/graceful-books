/**
 * Financial Goals Database Schema
 *
 * Schema for J5: Financial Goals Tracking
 *
 * Features:
 * - Goal tracking with milestones
 * - Progress snapshots for historical analysis
 * - CRDT-compatible design for sync
 * - Soft deletes with audit trail
 */

import type { FinancialGoal, GoalProgressSnapshot } from '../../types/goals.types';

/**
 * Financial Goals Schema
 *
 * Indexed fields:
 * - id: Primary key
 * - company_id: For filtering by company
 * - [company_id+status]: For dashboard queries
 * - [company_id+type]: For filtering by goal type
 * - created_at: For sorting
 * - deadline: For deadline tracking
 */
export const financialGoalsSchema = `
  ++id,
  company_id,
  [company_id+status],
  [company_id+type],
  created_at,
  deadline,
  is_deleted
`;

/**
 * Goal Progress Snapshots Schema
 *
 * Historical tracking of goal progress over time
 *
 * Indexed fields:
 * - id: Primary key
 * - goal_id: For querying snapshots by goal
 * - [goal_id+snapshot_date]: For trend analysis
 * - company_id: For company-level queries
 */
export const goalProgressSnapshotsSchema = `
  ++id,
  goal_id,
  [goal_id+snapshot_date],
  company_id,
  snapshot_date
`;

/**
 * Default financial goal entity
 */
export function createDefaultFinancialGoal(): Omit<
  FinancialGoal,
  'id' | 'company_id' | 'name' | 'type' | 'target_amount' | 'deadline'
> {
  const now = Date.now();

  return {
    description: '',
    period: 'annual',
    target_amount_formatted: '',
    current_amount: '0',
    current_amount_formatted: '$0',
    progress_percentage: 0,
    status: 'active',
    progress_status: 'on-track',
    milestones_reached: [],
    created_at: now,
    updated_at: now,
    version: 1,
    is_deleted: false,
    last_modified_by: '',
  };
}

/**
 * Default goal progress snapshot
 */
export function createDefaultGoalProgressSnapshot(): Omit<
  GoalProgressSnapshot,
  'id' | 'goal_id' | 'company_id' | 'current_amount'
> {
  return {
    snapshot_date: Date.now(),
    progress_percentage: 0,
    created_at: Date.now(),
  };
}
