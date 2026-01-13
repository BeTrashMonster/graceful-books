/**
 * Tutorial System Type Definitions
 *
 * Types for the contextual tutorial framework supporting step highlighting,
 * progress tracking, skip/resume functionality, and "Don't show again" options.
 *
 * Requirements:
 * - D4: Tutorial System Framework
 * - LEARN-001: Contextual Tutorial System
 */

import type { BaseEntity, VersionVector } from './database.types';

/**
 * Tutorial trigger types
 * Defines when a tutorial should be shown to the user
 */
export enum TutorialTrigger {
  MANUAL = 'MANUAL', // User manually starts tutorial
  FIRST_TIME = 'FIRST_TIME', // Triggered on first access to feature
  FEATURE_UNLOCK = 'FEATURE_UNLOCK', // Triggered when feature becomes available
  ONBOARDING = 'ONBOARDING', // Part of initial onboarding flow
  PROMPT = 'PROMPT', // Prompted after specific user action
}

/**
 * Tutorial status
 */
export enum TutorialStatus {
  NOT_STARTED = 'NOT_STARTED', // User hasn't started this tutorial
  IN_PROGRESS = 'IN_PROGRESS', // Tutorial is partially complete
  COMPLETED = 'COMPLETED', // Tutorial fully completed
  SKIPPED = 'SKIPPED', // User skipped the tutorial
  DISMISSED = 'DISMISSED', // User chose "Don't show again"
}

/**
 * Step position relative to highlighted element
 */
export enum StepPosition {
  TOP = 'top',
  RIGHT = 'right',
  BOTTOM = 'bottom',
  LEFT = 'left',
  CENTER = 'center',
  AUTO = 'auto', // Automatically determine best position
}

/**
 * Tutorial step definition
 * Represents a single step in a multi-step tutorial
 */
export interface TutorialStep {
  /**
   * Unique identifier for this step within the tutorial
   */
  id: string;

  /**
   * Step title
   */
  title: string;

  /**
   * Step description with encouraging, judgment-free language
   */
  description: string;

  /**
   * CSS selector for element to highlight
   * If null, shows centered modal without highlighting
   */
  element: string | null;

  /**
   * Position of tooltip relative to highlighted element
   */
  position: StepPosition;

  /**
   * Whether to allow clicking on the highlighted element
   * Useful for "now try clicking this button" type steps
   */
  allowInteraction?: boolean;

  /**
   * Optional image or illustration URL
   */
  image?: string;

  /**
   * Optional action to perform when step is shown
   * (e.g., scroll element into view, expand section)
   */
  onShow?: () => void | Promise<void>;

  /**
   * Optional validation function to check if step can proceed
   */
  canProceed?: () => boolean | Promise<boolean>;
}

/**
 * Tutorial definition
 * Complete definition of a tutorial flow
 */
export interface TutorialDefinition {
  /**
   * Unique identifier for the tutorial
   */
  id: string;

  /**
   * Tutorial title
   */
  title: string;

  /**
   * Brief description of what the tutorial covers
   */
  description: string;

  /**
   * Tutorial category for grouping
   */
  category: 'onboarding' | 'feature' | 'workflow' | 'advanced';

  /**
   * Trigger condition for showing this tutorial
   */
  trigger: TutorialTrigger;

  /**
   * Steps in the tutorial
   */
  steps: TutorialStep[];

  /**
   * Estimated time to complete (in minutes)
   */
  estimatedMinutes: number;

  /**
   * Whether this tutorial is required for onboarding
   */
  required?: boolean;

  /**
   * Prerequisites - tutorial IDs that must be completed first
   */
  prerequisites?: string[];

  /**
   * Feature flag or phase requirement
   */
  requiredPhase?: 'stabilize' | 'organize' | 'optimize' | 'expand';
}

/**
 * Tutorial progress tracking entity
 * Stored per user to track which tutorials have been completed
 */
export interface TutorialProgress extends BaseEntity {
  /**
   * User ID
   */
  user_id: string;

  /**
   * Tutorial ID from TutorialDefinition
   */
  tutorial_id: string;

  /**
   * Current status of this tutorial for the user
   */
  status: TutorialStatus;

  /**
   * Current step index (0-based)
   */
  current_step: number;

  /**
   * Total number of steps
   */
  total_steps: number;

  /**
   * Timestamp when tutorial was started
   */
  started_at: number | null;

  /**
   * Timestamp when tutorial was completed
   */
  completed_at: number | null;

  /**
   * Timestamp when tutorial was last viewed
   */
  last_viewed_at: number | null;

  /**
   * Number of times user has attempted this tutorial
   */
  attempt_count: number;

  /**
   * Whether user selected "Don't show again"
   */
  dont_show_again: boolean;

  /**
   * Optional completion badge data
   */
  badge_data: TutorialBadge | null;

  /**
   * CRDT version vector
   */
  version_vector: VersionVector;
}

/**
 * Tutorial badge data
 * Hidden in profile, not in-your-face per joy requirements
 */
export interface TutorialBadge {
  /**
   * Badge ID
   */
  id: string;

  /**
   * Badge name
   */
  name: string;

  /**
   * Badge icon or emoji
   */
  icon: string;

  /**
   * When the badge was earned
   */
  earned_at: number;

  /**
   * Optional badge description
   */
  description?: string;
}

/**
 * Tutorial state (in-memory, not persisted)
 * Represents the current state of an active tutorial
 */
export interface TutorialState {
  /**
   * Whether tutorial is currently active
   */
  isActive: boolean;

  /**
   * Current tutorial definition
   */
  tutorial: TutorialDefinition | null;

  /**
   * Current step index
   */
  currentStepIndex: number;

  /**
   * Whether tutorial is loading
   */
  isLoading: boolean;

  /**
   * Error message if any
   */
  error: string | null;
}

/**
 * Tutorial context for React hooks
 */
export interface TutorialContextValue {
  /**
   * Current tutorial state
   */
  state: TutorialState;

  /**
   * Start a tutorial by ID
   */
  startTutorial: (tutorialId: string) => Promise<void>;

  /**
   * Resume a tutorial
   */
  resumeTutorial: (tutorialId: string) => Promise<void>;

  /**
   * Go to next step
   */
  nextStep: () => void;

  /**
   * Go to previous step
   */
  previousStep: () => void;

  /**
   * Skip tutorial
   */
  skipTutorial: (dontShowAgain?: boolean) => Promise<void>;

  /**
   * Complete tutorial
   */
  completeTutorial: () => Promise<void>;

  /**
   * Get tutorial progress for current user
   */
  getTutorialProgress: (tutorialId: string) => Promise<TutorialProgress | null>;

  /**
   * Get all available tutorials
   */
  getAvailableTutorials: () => TutorialDefinition[];

  /**
   * Check if tutorial should be shown based on trigger conditions
   */
  shouldShowTutorial: (tutorialId: string) => Promise<boolean>;
}

/**
 * Tutorial statistics for analytics
 */
export interface TutorialStats {
  /**
   * Total number of tutorials
   */
  total: number;

  /**
   * Number completed
   */
  completed: number;

  /**
   * Number in progress
   */
  inProgress: number;

  /**
   * Number skipped
   */
  skipped: number;

  /**
   * Number dismissed
   */
  dismissed: number;

  /**
   * Completion rate (percentage)
   */
  completionRate: number;

  /**
   * Most recently completed tutorial
   */
  recentlyCompleted: TutorialProgress[];

  /**
   * Available tutorials not yet started
   */
  available: TutorialDefinition[];
}

/**
 * Tutorial event for analytics tracking
 */
export interface TutorialEvent {
  /**
   * Event type
   */
  type: 'started' | 'completed' | 'skipped' | 'dismissed' | 'step_viewed' | 'step_completed';

  /**
   * Tutorial ID
   */
  tutorialId: string;

  /**
   * User ID
   */
  userId: string;

  /**
   * Step index (for step events)
   */
  stepIndex?: number;

  /**
   * Timestamp
   */
  timestamp: number;

  /**
   * Additional metadata
   */
  metadata?: Record<string, unknown>;
}
