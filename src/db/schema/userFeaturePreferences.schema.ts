/**
 * User Feature Preferences Schema
 *
 * Stores per-user feature activation preferences for progressive disclosure.
 * Users can activate/deactivate features to customize their interface.
 *
 * Features:
 * - Per-user preferences (not company-wide)
 * - Features: events, distribution, promos
 * - Controls sidebar navigation visibility
 * - Controls dashboard node visibility
 */

export interface UserFeaturePreference {
  id: string;
  user_id: string;
  feature_name: 'events' | 'distribution' | 'promos';
  is_active: boolean;
  activated_at: number | null; // When user first activated this feature
  deactivated_at: number | null; // When user last deactivated this feature
  created_at: number;
  updated_at: number;
}

/**
 * Dexie schema for user feature preferences
 * Indexes: user_id, [user_id+feature_name] for unique lookups
 */
export const userFeaturePreferencesSchema =
  'id, user_id, [user_id+feature_name], is_active, updated_at';

/**
 * Create default user feature preference
 */
export function createDefaultUserFeaturePreference(
  userId: string,
  featureName: 'events' | 'distribution' | 'promos',
  isActive: boolean = false
): UserFeaturePreference {
  const now = Date.now();
  return {
    id: '', // Will be set by service
    user_id: userId,
    feature_name: featureName,
    is_active: isActive,
    activated_at: isActive ? now : null,
    deactivated_at: null,
    created_at: now,
    updated_at: now,
  };
}

/**
 * Get default feature states for new users
 * All features start INACTIVE for progressive disclosure
 */
export function getDefaultFeatureStates(): Record<string, boolean> {
  return {
    events: false,
    distribution: false,
    promos: false,
  };
}
