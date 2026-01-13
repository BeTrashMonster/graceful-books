/**
 * Phase-Based Feature Visibility - Barrel Export
 *
 * Central export point for all phase visibility functionality.
 */

// Types
export type {
  FeatureId,
  FeatureMetadata,
  PhaseVisibilityRules,
  FeatureAccessResult,
  FeatureVisibilityPreferences,
  FeatureUnlockEvent,
  FeatureVisibilityState,
} from './types';

// Visibility Rules
export {
  FEATURE_METADATA,
  PHASE_VISIBILITY_RULES,
  isFeatureAccessible,
  isFeatureVisible,
  getFeatureAccess,
  getFeaturesForPhase,
  getAccessibleFeatures,
  getLockedFeatures,
  getUnlockedFeatures,
  getFeatureMetadata,
  getAllFeatures,
  getFeaturesByCategory,
  getPhaseDescription,
  getNextPhase,
} from './visibilityRules';

// Hook
export { useFeatureVisibility } from './useFeatureVisibility';
export type { UseFeatureVisibilityOptions, UseFeatureVisibilityReturn } from './useFeatureVisibility';

// Component
export { FeatureGate, useFeatureGate } from './FeatureGate';
export type { FeatureGateProps } from './FeatureGate';
