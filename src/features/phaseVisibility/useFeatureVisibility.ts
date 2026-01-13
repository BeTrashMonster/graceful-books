/**
 * useFeatureVisibility Hook
 *
 * React hook for checking feature visibility and access based on user's phase.
 * Provides utilities for feature gating and unlock notifications.
 *
 * Requirements:
 * - PFD-001: Feature visibility rules by phase
 * - PFD-002: UI adaptation based on phase
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { BusinessPhase } from '../../types';
import type {
  FeatureId,
  FeatureMetadata,
  FeatureAccessResult,
  FeatureVisibilityState,
  FeatureVisibilityPreferences,
  FeatureUnlockEvent,
} from './types';
import {
  isFeatureAccessible,
  isFeatureVisible,
  getFeatureAccess,
  getAccessibleFeatures,
  getLockedFeatures,
  getAllFeatures,
  getUnlockedFeatures,
  getFeatureMetadata,
} from './visibilityRules';

/**
 * Hook options
 */
export interface UseFeatureVisibilityOptions {
  /** Current user phase */
  currentPhase: BusinessPhase;

  /** User ID for preferences */
  userId?: string;

  /** Initial show all features preference */
  initialShowAllFeatures?: boolean;

  /** Callback when feature unlock occurs */
  onFeatureUnlock?: (event: FeatureUnlockEvent) => void;
}

/**
 * Hook return value
 */
export interface UseFeatureVisibilityReturn {
  /** Check if a feature is accessible */
  canAccess: (featureId: FeatureId) => boolean;

  /** Check if a feature is visible */
  isVisible: (featureId: FeatureId) => boolean;

  /** Get detailed access information for a feature */
  getAccess: (featureId: FeatureId) => FeatureAccessResult;

  /** Get feature metadata */
  getMetadata: (featureId: FeatureId) => FeatureMetadata | undefined;

  /** Current visibility state */
  state: FeatureVisibilityState;

  /** Show all features preference */
  showAllFeatures: boolean;

  /** Toggle show all features */
  toggleShowAllFeatures: () => void;

  /** Set show all features */
  setShowAllFeatures: (value: boolean) => void;

  /** Check if phase has changed and handle unlocks */
  handlePhaseChange: (newPhase: BusinessPhase) => FeatureId[];

  /** Dismiss unlock notification for a feature */
  dismissUnlock: (featureId: FeatureId) => void;

  /** Get recently unlocked features */
  getRecentlyUnlocked: () => FeatureId[];
}

/**
 * Local storage key for preferences
 */
const PREFERENCES_STORAGE_KEY = 'graceful_books_feature_visibility_prefs';

/**
 * Load preferences from localStorage
 */
function loadPreferences(userId?: string): FeatureVisibilityPreferences | null {
  if (!userId) {
    return null;
  }

  try {
    const stored = localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!stored) {
      return null;
    }

    const prefs = JSON.parse(stored) as FeatureVisibilityPreferences;
    if (prefs.userId === userId) {
      return {
        ...prefs,
        updatedAt: new Date(prefs.updatedAt),
      };
    }
    return null;
  } catch (error) {
    console.error('Failed to load feature visibility preferences:', error);
    return null;
  }
}

/**
 * Save preferences to localStorage
 */
function savePreferences(prefs: FeatureVisibilityPreferences): void {
  try {
    localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(prefs));
  } catch (error) {
    console.error('Failed to save feature visibility preferences:', error);
  }
}

/**
 * useFeatureVisibility Hook
 *
 * Manages feature visibility based on user's current phase.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { canAccess, isVisible, state } = useFeatureVisibility({
 *     currentPhase: user.phase,
 *     userId: user.id,
 *   });
 *
 *   if (!isVisible('invoicing')) {
 *     return null;
 *   }
 *
 *   if (!canAccess('invoicing')) {
 *     return <LockedFeatureCard featureId="invoicing" />;
 *   }
 *
 *   return <InvoicingFeature />;
 * }
 * ```
 */
export function useFeatureVisibility(
  options: UseFeatureVisibilityOptions
): UseFeatureVisibilityReturn {
  const { currentPhase, userId, initialShowAllFeatures = false, onFeatureUnlock } = options;

  // Load preferences from localStorage
  const [preferences, setPreferences] = useState<FeatureVisibilityPreferences>(() => {
    const loaded = loadPreferences(userId);
    if (loaded) {
      return loaded;
    }

    return {
      userId: userId || '',
      showAllFeatures: initialShowAllFeatures,
      dismissedUnlocks: [],
      lastSeenPhase: currentPhase,
      updatedAt: new Date(),
    };
  });

  // Track recently unlocked features
  const [recentlyUnlocked, setRecentlyUnlocked] = useState<FeatureId[]>([]);

  // Sync preferences to localStorage when they change
  useEffect(() => {
    if (userId) {
      savePreferences(preferences);
    }
  }, [preferences, userId]);

  // Check if a feature is accessible
  const canAccess = useCallback(
    (featureId: FeatureId): boolean => {
      return isFeatureAccessible(featureId, currentPhase);
    },
    [currentPhase]
  );

  // Check if a feature is visible
  const isVisible = useCallback(
    (featureId: FeatureId): boolean => {
      if (preferences.showAllFeatures) {
        return true;
      }
      return isFeatureVisible(featureId, currentPhase);
    },
    [currentPhase, preferences.showAllFeatures]
  );

  // Get detailed access information
  const getAccess = useCallback(
    (featureId: FeatureId): FeatureAccessResult => {
      return getFeatureAccess(featureId, currentPhase, preferences.showAllFeatures);
    },
    [currentPhase, preferences.showAllFeatures]
  );

  // Get feature metadata
  const getMetadata = useCallback((featureId: FeatureId): FeatureMetadata | undefined => {
    return getFeatureMetadata(featureId);
  }, []);

  // Toggle show all features
  const toggleShowAllFeatures = useCallback(() => {
    setPreferences((prev) => ({
      ...prev,
      showAllFeatures: !prev.showAllFeatures,
      updatedAt: new Date(),
    }));
  }, []);

  // Set show all features
  const setShowAllFeatures = useCallback((value: boolean) => {
    setPreferences((prev) => ({
      ...prev,
      showAllFeatures: value,
      updatedAt: new Date(),
    }));
  }, []);

  // Handle phase change and detect unlocks
  const handlePhaseChange = useCallback(
    (newPhase: BusinessPhase): FeatureId[] => {
      const unlockedFeatures = getUnlockedFeatures(preferences.lastSeenPhase, newPhase);

      if (unlockedFeatures.length > 0) {
        // Update preferences with new phase
        setPreferences((prev) => ({
          ...prev,
          lastSeenPhase: newPhase,
          updatedAt: new Date(),
        }));

        // Update recently unlocked
        setRecentlyUnlocked(unlockedFeatures);

        // Trigger callbacks for each unlock
        if (onFeatureUnlock) {
          unlockedFeatures.forEach((featureId) => {
            onFeatureUnlock({
              featureId,
              newPhase,
              oldPhase: preferences.lastSeenPhase,
              timestamp: new Date(),
              notificationSeen: false,
            });
          });
        }
      }

      return unlockedFeatures;
    },
    [preferences.lastSeenPhase, onFeatureUnlock]
  );

  // Dismiss unlock notification
  const dismissUnlock = useCallback((featureId: FeatureId) => {
    setPreferences((prev) => ({
      ...prev,
      dismissedUnlocks: [...prev.dismissedUnlocks, featureId],
      updatedAt: new Date(),
    }));

    setRecentlyUnlocked((prev) => prev.filter((id) => id !== featureId));
  }, []);

  // Get recently unlocked features (not dismissed)
  const getRecentlyUnlocked = useCallback((): FeatureId[] => {
    return recentlyUnlocked.filter(
      (featureId) => !preferences.dismissedUnlocks.includes(featureId)
    );
  }, [recentlyUnlocked, preferences.dismissedUnlocks]);

  // Compute visibility state
  const state = useMemo((): FeatureVisibilityState => {
    const allFeatures = getAllFeatures();
    const accessibleFeatures = getAccessibleFeatures(currentPhase);
    const lockedFeatures = getLockedFeatures(currentPhase);

    const hiddenFeatures = allFeatures
      .filter((feature) => {
        if (preferences.showAllFeatures) {
          return false;
        }
        return (
          !isFeatureVisible(feature.id, currentPhase) &&
          !isFeatureAccessible(feature.id, currentPhase)
        );
      })
      .map((f) => f.id);

    return {
      currentPhase,
      allFeatures,
      accessibleFeatures,
      lockedFeatures,
      hiddenFeatures,
      showAllFeatures: preferences.showAllFeatures,
      recentlyUnlocked: getRecentlyUnlocked(),
    };
  }, [currentPhase, preferences.showAllFeatures, getRecentlyUnlocked]);

  // Check for phase changes
  useEffect(() => {
    if (currentPhase !== preferences.lastSeenPhase) {
      handlePhaseChange(currentPhase);
    }
  }, [currentPhase, preferences.lastSeenPhase, handlePhaseChange]);

  return {
    canAccess,
    isVisible,
    getAccess,
    getMetadata,
    state,
    showAllFeatures: preferences.showAllFeatures,
    toggleShowAllFeatures,
    setShowAllFeatures,
    handlePhaseChange,
    dismissUnlock,
    getRecentlyUnlocked,
  };
}
