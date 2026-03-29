/**
 * User Feature Preferences Service
 *
 * Manages per-user feature activation preferences for progressive disclosure.
 * Users can activate/deactivate features to customize their interface.
 *
 * Features:
 * - Get user's feature preferences
 * - Activate/deactivate features
 * - Initialize default preferences for new users
 * - Per-user (not company-wide)
 */

import { nanoid } from 'nanoid';
import type { TreasureChestDB } from '../db/database';
import type { UserFeaturePreference } from '../db/schema/userFeaturePreferences.schema';
import {
  createDefaultUserFeaturePreference,
  getDefaultFeatureStates,
} from '../db/schema/userFeaturePreferences.schema';

export type FeatureName = 'events' | 'distribution' | 'promos';

export class UserFeaturePreferencesService {
  constructor(private db: TreasureChestDB) {}

  /**
   * Get all feature preferences for a user
   * Returns default inactive state for any missing features
   */
  async getUserPreferences(userId: string): Promise<Record<FeatureName, boolean>> {
    const preferences = await this.db.userFeaturePreferences
      .where('user_id')
      .equals(userId)
      .toArray();

    // Start with defaults (all inactive)
    const result: Record<string, boolean> = getDefaultFeatureStates();

    // Override with user's saved preferences
    preferences.forEach(pref => {
      if (pref.feature_name in result) {
        result[pref.feature_name] = pref.is_active;
      }
    });

    return result as Record<FeatureName, boolean>;
  }

  /**
   * Check if a specific feature is active for a user
   */
  async isFeatureActive(userId: string, featureName: FeatureName): Promise<boolean> {
    const pref = await this.db.userFeaturePreferences
      .where('[user_id+feature_name]')
      .equals([userId, featureName])
      .first();

    // Default to inactive if no preference exists
    return pref?.is_active ?? false;
  }

  /**
   * Activate a feature for a user
   */
  async activateFeature(userId: string, featureName: FeatureName): Promise<void> {
    console.log('🔍 activateFeature: Looking for existing pref with userId:', userId, 'feature:', featureName);

    const existing = await this.db.userFeaturePreferences
      .where('[user_id+feature_name]')
      .equals([userId, featureName])
      .first();

    console.log('📊 activateFeature: Existing record:', existing ? 'Found (id: ' + existing.id + ')' : 'Not found');

    const now = Date.now();

    if (existing) {
      // Update existing preference
      console.log('🔄 activateFeature: Updating existing record id:', existing.id);
      const updateCount = await this.db.userFeaturePreferences.update(existing.id, {
        is_active: true,
        activated_at: existing.activated_at ?? now,
        deactivated_at: null,
        updated_at: now,
      });
      console.log('✅ activateFeature: Updated', updateCount, 'record(s)');
    } else {
      // Create new preference
      const newPref: UserFeaturePreference = {
        ...createDefaultUserFeaturePreference(userId, featureName, true),
        id: nanoid(),
      };
      console.log('➕ activateFeature: Creating new record with id:', newPref.id);
      await this.db.userFeaturePreferences.add(newPref);
      console.log('✅ activateFeature: New record created');
    }
  }

  /**
   * Deactivate a feature for a user
   */
  async deactivateFeature(userId: string, featureName: FeatureName): Promise<void> {
    const existing = await this.db.userFeaturePreferences
      .where('[user_id+feature_name]')
      .equals([userId, featureName])
      .first();

    const now = Date.now();

    if (existing) {
      // Update existing preference
      await this.db.userFeaturePreferences.update(existing.id, {
        is_active: false,
        deactivated_at: now,
        updated_at: now,
      });
    } else {
      // Create new preference (deactivated)
      const newPref: UserFeaturePreference = {
        ...createDefaultUserFeaturePreference(userId, featureName, false),
        id: nanoid(),
        deactivated_at: now,
      };
      await this.db.userFeaturePreferences.add(newPref);
    }
  }

  /**
   * Toggle a feature for a user
   */
  async toggleFeature(userId: string, featureName: FeatureName): Promise<boolean> {
    console.log('🔍 Service: toggleFeature called for', featureName, 'userId:', userId);

    const isActive = await this.isFeatureActive(userId, featureName);
    console.log('📊 Service: Current state from DB:', isActive);

    if (isActive) {
      console.log('⬇️ Service: Deactivating feature');
      await this.deactivateFeature(userId, featureName);
      console.log('✅ Service: Feature deactivated, returning false');
      return false;
    } else {
      console.log('⬆️ Service: Activating feature');
      await this.activateFeature(userId, featureName);
      console.log('✅ Service: Feature activated, returning true');

      // Verify it was actually saved
      const verified = await this.isFeatureActive(userId, featureName);
      console.log('🔍 Service: Verified state after activation:', verified);

      return true;
    }
  }

  /**
   * Initialize default preferences for a new user
   * All features start INACTIVE for progressive disclosure
   */
  async initializeUserPreferences(userId: string): Promise<void> {
    const features: FeatureName[] = ['events', 'distribution', 'promos'];

    for (const feature of features) {
      const existing = await this.db.userFeaturePreferences
        .where('[user_id+feature_name]')
        .equals([userId, feature])
        .first();

      if (!existing) {
        const newPref: UserFeaturePreference = {
          ...createDefaultUserFeaturePreference(userId, feature, false),
          id: nanoid(),
        };
        await this.db.userFeaturePreferences.add(newPref);
      }
    }
  }

  /**
   * Get list of active features for a user
   */
  async getActiveFeatures(userId: string): Promise<FeatureName[]> {
    const prefs = await this.getUserPreferences(userId);
    return Object.entries(prefs)
      .filter(([_, isActive]) => isActive)
      .map(([feature, _]) => feature as FeatureName);
  }

  /**
   * Get list of inactive features for a user
   */
  async getInactiveFeatures(userId: string): Promise<FeatureName[]> {
    const prefs = await this.getUserPreferences(userId);
    return Object.entries(prefs)
      .filter(([_, isActive]) => !isActive)
      .map(([feature, _]) => feature as FeatureName);
  }
}
