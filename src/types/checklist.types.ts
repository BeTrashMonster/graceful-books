/**
 * Checklist Type Definitions for Graceful Books
 *
 * Per CHECK-001 and CHECK-002: Defines types for personalized checklist
 * generation, interactive UI, progress tracking, and streak management.
 */

import type { BusinessPhase } from './index'

// =============================================================================
// Checklist Core Types
// =============================================================================

/**
 * Category types for checklist organization
 */
export type ChecklistCategoryType = 'foundation' | 'weekly' | 'monthly' | 'quarterly' | 'annual'

/**
 * Checklist item status
 */
export type ChecklistItemStatus = 'active' | 'completed' | 'snoozed' | 'not-applicable'

/**
 * Explanation depth based on financial literacy level
 */
export type ExplanationLevel = 'brief' | 'detailed'

/**
 * Recurrence pattern for checklist items
 */
export type RecurrenceType = 'once' | 'weekly' | 'monthly' | 'quarterly' | 'annual'

/**
 * Priority level for checklist items
 */
export type PriorityLevel = 'low' | 'medium' | 'high'

// =============================================================================
// Checklist Profile
// =============================================================================

/**
 * Main checklist profile generated from assessment
 * Per CHECK-001: Customized based on phase, business type, and literacy level
 */
export interface ChecklistProfile {
  id: string
  userId: string
  companyId: string
  assessmentProfileId: string

  // Generated based on assessment
  phase: BusinessPhase
  businessType: string
  literacyLevel: string

  // Categories
  categories: ChecklistCategory[]

  // Streak tracking (Per CHECK-002)
  streaks: StreakData

  // Milestones
  milestones: Milestone[]

  // Metadata
  createdAt: Date
  updatedAt: Date
  generatedAt: Date
}

// =============================================================================
// Category
// =============================================================================

/**
 * Checklist category with items and progress tracking
 * Per CHECK-002: Visual progress bars by category
 */
export interface ChecklistCategory {
  id: string
  name: string
  description: string
  type: ChecklistCategoryType
  items: ChecklistItem[]
  order: number

  // Progress tracking
  totalItems: number
  completedItems: number
  percentComplete: number
}

// =============================================================================
// Item
// =============================================================================

/**
 * Individual checklist item
 * Per CHECK-002: Interactive with snooze, not-applicable, and linking
 */
export interface ChecklistItem {
  id: string
  categoryId: string
  title: string
  description: string
  explanationLevel: ExplanationLevel

  // Status
  status: ChecklistItemStatus
  completedAt: Date | null
  snoozedUntil: Date | null
  snoozedReason: string | null
  notApplicableReason: string | null

  // Linking (Per CHECK-002: Link items to relevant features)
  featureLink: string | null
  helpArticle: string | null

  // Customization
  isCustom: boolean
  isReordered: boolean
  customOrder: number | null

  // Recurrence (for maintenance tasks)
  recurrence: RecurrenceType
  priority: PriorityLevel
  lastDueDate: Date | null
  nextDueDate: Date | null

  // Metadata
  createdAt: Date
  updatedAt: Date
}

// =============================================================================
// Streak Tracking
// =============================================================================

/**
 * Streak tracking data
 * Per CHECK-002: Display streak tracking with encouraging messages
 */
export interface StreakData {
  weekly: {
    current: number
    longest: number
    lastCompleted: Date | null
    isActiveThisWeek: boolean
  }
  monthly: {
    current: number
    longest: number
    lastCompleted: Date | null
    isActiveThisMonth: boolean
  }
  encouragement: string
}

// =============================================================================
// Milestones
// =============================================================================

/**
 * Achievement milestone
 * Per CHECK-002: Milestone celebrations with confetti
 */
export interface Milestone {
  id: string
  type: 'completion' | 'streak' | 'custom'
  title: string
  description: string
  achievedAt: Date
  celebrated: boolean
  icon?: string
}

// =============================================================================
// Progress Tracking
// =============================================================================

/**
 * Overall checklist progress
 */
export interface ChecklistProgress {
  overall: {
    totalItems: number
    completedItems: number
    percentComplete: number
  }
  byCategory: Record<string, CategoryProgress>
  recentCompletions: CompletionEvent[]
  upcomingDue: ChecklistItem[]
}

/**
 * Progress by category
 */
export interface CategoryProgress {
  name: string
  totalItems: number
  completedItems: number
  percentComplete: number
  trend: 'improving' | 'stable' | 'declining'
}

/**
 * Completion event for history
 */
export interface CompletionEvent {
  item: ChecklistItem
  completedAt: Date
  categoryName: string
}

// =============================================================================
// UI State Types
// =============================================================================

/**
 * Filter options for checklist view
 */
export interface ChecklistFilters {
  categoryType?: ChecklistCategoryType
  status?: ChecklistItemStatus
  priority?: PriorityLevel
  searchQuery?: string
}

/**
 * Sort options for checklist
 */
export interface ChecklistSort {
  field: 'priority' | 'dueDate' | 'createdAt' | 'title'
  order: 'asc' | 'desc'
}

/**
 * Checklist view state
 */
export type ChecklistViewMode = 'all' | 'active' | 'completed' | 'snoozed'

// =============================================================================
// Input Types
// =============================================================================

/**
 * Input for creating custom checklist items
 */
export interface CustomItemInput {
  categoryId: string
  title: string
  description: string
  recurrence: RecurrenceType
  priority: PriorityLevel
  featureLink?: string
  helpArticle?: string
}

/**
 * Input for snoozing an item
 */
export interface SnoozeItemInput {
  itemId: string
  snoozedUntil: Date
  reason?: string
}

/**
 * Input for marking item as not applicable
 */
export interface NotApplicableInput {
  itemId: string
  reason: string
}

// =============================================================================
// Result Types
// =============================================================================

/**
 * Result of checklist operations
 */
export type ChecklistResult<T> =
  | { success: true; data: T }
  | { success: false; error: ChecklistError }

/**
 * Checklist error types
 */
export interface ChecklistError {
  code: 'NOT_FOUND' | 'VALIDATION_ERROR' | 'GENERATION_ERROR' | 'UPDATE_FAILED'
  message: string
  details?: unknown
}
