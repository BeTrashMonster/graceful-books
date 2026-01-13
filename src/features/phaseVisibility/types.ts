/**
 * Phase-Based Feature Visibility Types
 *
 * TypeScript interfaces and types for managing feature visibility
 * based on user's current business phase.
 *
 * Requirements:
 * - PFD-001: Feature visibility rules by phase
 * - PFD-002: UI adaptation based on phase
 */

import type { BusinessPhase } from '../../types';

/**
 * Feature identifier - unique key for each feature in the system
 */
export type FeatureId =
  // Stabilize phase features
  | 'dashboard'
  | 'basic-transactions'
  | 'simple-reports'
  | 'accounts-basic'
  | 'help-center'

  // Organize phase features
  | 'categories'
  | 'tags'
  | 'reconciliation'
  | 'advanced-reports'
  | 'search'
  | 'filters'

  // Build phase features
  | 'invoicing'
  | 'customers'
  | 'inventory'
  | 'products'
  | 'recurring-transactions'
  | 'estimates'

  // Grow phase features
  | 'forecasting'
  | 'analytics'
  | 'integrations'
  | 'api-access'
  | 'multi-currency'
  | 'custom-reports';

/**
 * Feature metadata
 */
export interface FeatureMetadata {
  /** Unique feature identifier */
  id: FeatureId;

  /** Display name for the feature */
  name: string;

  /** Short description of what the feature does */
  description: string;

  /** Phase when this feature becomes available */
  availableInPhase: BusinessPhase;

  /** Optional icon identifier */
  icon?: string;

  /** Route or path to the feature (if applicable) */
  route?: string;

  /** Category for grouping features */
  category?: 'transactions' | 'reports' | 'contacts' | 'settings' | 'advanced';
}

/**
 * Visibility rules for a specific phase
 */
export interface PhaseVisibilityRules {
  /** Business phase these rules apply to */
  phase: BusinessPhase;

  /** Features visible in this phase */
  visibleFeatures: FeatureId[];

  /** Features that should be shown as "coming soon" */
  previewFeatures?: FeatureId[];
}

/**
 * User feature visibility preferences
 */
export interface FeatureVisibilityPreferences {
  /** User ID */
  userId: string;

  /** Show all features regardless of phase */
  showAllFeatures: boolean;

  /** Dismissed feature unlock notifications */
  dismissedUnlocks: FeatureId[];

  /** Last seen phase (for detecting phase transitions) */
  lastSeenPhase: BusinessPhase;

  /** Timestamp of last update */
  updatedAt: Date;
}

/**
 * Feature unlock event
 */
export interface FeatureUnlockEvent {
  /** Feature that was unlocked */
  featureId: FeatureId;

  /** New phase the user transitioned to */
  newPhase: BusinessPhase;

  /** Old phase the user was in */
  oldPhase: BusinessPhase;

  /** Timestamp of unlock */
  timestamp: Date;

  /** Whether the user has seen the notification */
  notificationSeen: boolean;
}

/**
 * Feature access result
 */
export interface FeatureAccessResult {
  /** Whether the feature is accessible */
  canAccess: boolean;

  /** Whether the feature is visible (but may be locked) */
  isVisible: boolean;

  /** Phase when this feature becomes available */
  availableInPhase?: BusinessPhase;

  /** Reason for denial (if not accessible) */
  reason?: 'phase-locked' | 'preference-hidden' | 'not-found';

  /** Message to show user */
  message?: string;
}

/**
 * Feature visibility state for UI
 */
export interface FeatureVisibilityState {
  /** Current user phase */
  currentPhase: BusinessPhase;

  /** All available features */
  allFeatures: FeatureMetadata[];

  /** Features accessible in current phase */
  accessibleFeatures: FeatureId[];

  /** Features locked (visible but not accessible) */
  lockedFeatures: FeatureId[];

  /** Features completely hidden */
  hiddenFeatures: FeatureId[];

  /** Show all features preference */
  showAllFeatures: boolean;

  /** Features unlocked in last transition */
  recentlyUnlocked: FeatureId[];
}
