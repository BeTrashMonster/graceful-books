/**
 * Financial Goals Type Definitions
 *
 * Type definitions for J5: Financial Goals Tracking
 * Supports setting and tracking financial targets with milestone celebrations.
 */

// ============================================================================
// Goal Types & Enums
// ============================================================================

/**
 * Type of financial goal
 */
export type GoalType =
  | 'revenue'       // Target revenue amount
  | 'profit'        // Target profit amount
  | 'runway'        // Target months of runway
  | 'savings'       // Target cash reserves
  | 'custom';       // User-defined metric

/**
 * Goal period/frequency
 */
export type GoalPeriod =
  | 'monthly'       // Monthly target
  | 'quarterly'     // Quarterly target
  | 'annual'        // Annual target
  | 'one-time';     // One-time goal with deadline

/**
 * Goal status indicator
 */
export type GoalStatus =
  | 'active'        // Currently tracking
  | 'achieved'      // Target reached
  | 'paused'        // Temporarily paused
  | 'archived';     // No longer active

/**
 * Progress status (traffic light system)
 */
export type GoalProgressStatus =
  | 'on-track'      // Green: Meeting or exceeding target pace
  | 'behind'        // Yellow: Behind pace but recoverable
  | 'at-risk';      // Red: Significantly behind pace

/**
 * Milestone marker
 */
export type GoalMilestone =
  | '25'            // 25% complete
  | '50'            // 50% complete
  | '75'            // 75% complete
  | '100';          // 100% complete (achieved)

// ============================================================================
// Goal Entities
// ============================================================================

/**
 * Financial goal entity
 */
export interface FinancialGoal {
  id: string;                          // Unique goal ID
  company_id: string;                  // Company this goal belongs to

  // Goal definition
  name: string;                        // User-defined name
  description: string;                 // Optional description
  type: GoalType;                      // Type of goal
  period: GoalPeriod;                  // Period/frequency

  // Target
  target_amount: string;               // Decimal target amount
  target_amount_formatted: string;     // Formatted for display
  deadline: number;                    // Unix timestamp deadline

  // Current progress
  current_amount: string;              // Current value (Decimal as string)
  current_amount_formatted: string;    // Formatted for display
  progress_percentage: number;         // 0-100 percentage complete

  // Status
  status: GoalStatus;                  // Current status
  progress_status: GoalProgressStatus; // On track, behind, at-risk

  // Milestones
  milestones_reached: GoalMilestone[]; // Milestones already reached
  last_milestone_date?: number;        // When last milestone was reached

  // Metadata
  created_at: number;                  // Unix timestamp
  updated_at: number;                  // Unix timestamp
  achieved_at?: number;                // Unix timestamp when achieved
  personal_note?: string;              // Why this goal matters (user-defined)

  // Custom goal specifics
  custom_metric_name?: string;         // For custom goals
  custom_metric_formula?: string;      // Calculation formula for custom metrics

  // CRDT fields
  version: number;                     // Version counter for CRDT
  is_deleted: boolean;                 // Soft delete flag
  last_modified_by: string;            // User ID who last modified
}

/**
 * Goal calculation result
 */
export interface GoalCalculation {
  goal_id: string;
  current_amount: string;              // Current metric value
  target_amount: string;               // Target amount
  progress_percentage: number;         // 0-100
  progress_status: GoalProgressStatus; // On track, behind, at-risk

  // Time analysis
  days_remaining: number;              // Days until deadline
  days_elapsed: number;                // Days since goal created
  total_days: number;                  // Total days from creation to deadline

  // Pace analysis
  required_monthly_progress: string;   // Amount needed per month
  actual_monthly_progress: string;     // Actual average progress per month
  pace_vs_target: string;              // Percentage ahead or behind pace

  // Milestone detection
  next_milestone?: GoalMilestone;      // Next milestone to reach
  newly_reached_milestones: GoalMilestone[]; // Just reached (trigger celebration)

  // Recommendations
  recommendation?: string;             // Action recommendation if behind
}

/**
 * Goal progress snapshot (historical tracking)
 */
export interface GoalProgressSnapshot {
  id: string;
  goal_id: string;
  company_id: string;

  snapshot_date: number;               // Unix timestamp
  current_amount: string;              // Value at this snapshot
  progress_percentage: number;         // Percentage at this snapshot

  created_at: number;
}

/**
 * Milestone celebration event
 */
export interface MilestoneCelebration {
  goal_id: string;
  milestone: GoalMilestone;
  reached_at: number;                  // Unix timestamp
  message: string;                     // Celebration message
  show_confetti: boolean;              // Whether to show confetti
}

// ============================================================================
// Request/Response Types
// ============================================================================

/**
 * Create goal request
 */
export interface CreateGoalRequest {
  company_id: string;
  name: string;
  description?: string;
  type: GoalType;
  period: GoalPeriod;
  target_amount: string;               // Decimal as string
  deadline: number;                    // Unix timestamp
  personal_note?: string;
  custom_metric_name?: string;         // Required for custom goals
  custom_metric_formula?: string;      // Required for custom goals
}

/**
 * Update goal request
 */
export interface UpdateGoalRequest {
  goal_id: string;
  name?: string;
  description?: string;
  target_amount?: string;
  deadline?: number;
  personal_note?: string;
  status?: GoalStatus;
}

/**
 * Goal progress update request
 */
export interface UpdateGoalProgressRequest {
  goal_id: string;
  company_id: string;
  force_recalculate?: boolean;         // Force full recalculation
}

/**
 * Goal progress update response
 */
export interface UpdateGoalProgressResponse {
  goal: FinancialGoal;
  calculation: GoalCalculation;
  celebrations: MilestoneCelebration[]; // Any new milestones to celebrate
}

/**
 * Goals dashboard request
 */
export interface GoalsDashboardRequest {
  company_id: string;
  status_filter?: GoalStatus[];        // Filter by status
  type_filter?: GoalType[];            // Filter by type
}

/**
 * Goals dashboard response
 */
export interface GoalsDashboardResponse {
  active_goals: FinancialGoal[];
  achieved_goals: FinancialGoal[];
  paused_goals: FinancialGoal[];
  total_goals_created: number;
  total_goals_achieved: number;
  achievement_rate: number;            // Percentage of goals achieved
}

// ============================================================================
// Goal Templates
// ============================================================================

/**
 * Pre-defined goal template
 */
export interface GoalTemplate {
  type: GoalType;
  name: string;
  description: string;
  default_period: GoalPeriod;
  placeholder_target: string;          // Example target amount
  help_text: string;                   // Guidance for user
  icon: string;                        // Icon name
  example: string;                     // Example goal
}

/**
 * Goal recommendation (action to take if behind)
 */
export interface GoalRecommendation {
  goal_type: GoalType;
  progress_status: GoalProgressStatus;
  recommendation_text: string;
  action_items: string[];              // Specific actions to take
}

// ============================================================================
// Dashboard Display
// ============================================================================

/**
 * Goal card display data
 */
export interface GoalCardData {
  goal: FinancialGoal;
  calculation: GoalCalculation;
  display_color: 'green' | 'yellow' | 'red'; // Color coding
  icon_name: string;                   // Icon for goal type
  status_icon: string;                 // Icon for progress status
  countdown_text: string;              // "45 days left" or "Deadline passed"
  progress_text: string;               // "$8,000 of $10,000"
}

/**
 * Wins section entry (achieved goals)
 */
export interface GoalWinEntry {
  goal: FinancialGoal;
  achieved_date: number;
  days_to_achieve: number;
  celebration_message: string;
}
