/**
 * Tab Preferences Service
 *
 * Manages user preferences for pinned default tabs on each page.
 * Allows users to customize which tab opens by default when they navigate to a page.
 */

import { nanoid } from 'nanoid';
import { db } from '../db/database';
import type { TabPreference } from '../db/schema/tabPreferences.schema';
import { DEFAULT_TABS } from '../db/schema/tabPreferences.schema';

export class TabPreferencesService {
  /**
   * Get the pinned tab for a specific page
   * Returns the pinned tab ID if one exists, otherwise returns the system default
   */
  async getPinnedTab(userId: string, pageId: string): Promise<string> {
    try {
      const preference = await db.tabPreferences
        .where('[user_id+page_id]')
        .equals([userId, pageId])
        .and((p) => p.deleted_at === null)
        .first();

      if (preference) {
        return preference.pinned_tab_id;
      }

      // Return system default if no preference exists
      return DEFAULT_TABS[pageId as keyof typeof DEFAULT_TABS] || '';
    } catch (error) {
      console.error('Error getting pinned tab:', error);
      return DEFAULT_TABS[pageId as keyof typeof DEFAULT_TABS] || '';
    }
  }

  /**
   * Pin a tab for a specific page
   * Creates or updates the user's tab preference
   */
  async pinTab(userId: string, pageId: string, tabId: string): Promise<void> {
    try {
      // Check if preference already exists
      const existing = await db.tabPreferences
        .where('[user_id+page_id]')
        .equals([userId, pageId])
        .and((p) => p.deleted_at === null)
        .first();

      const now = Date.now();

      if (existing) {
        // Update existing preference
        await db.tabPreferences.update(existing.id, {
          pinned_tab_id: tabId,
          updated_at: now,
        });
      } else {
        // Create new preference
        const newPreference: TabPreference = {
          id: nanoid(),
          user_id: userId,
          page_id: pageId,
          pinned_tab_id: tabId,
          created_at: now,
          updated_at: now,
          deleted_at: null,
          version_vector: {},
        };

        await db.tabPreferences.add(newPreference);
      }
    } catch (error) {
      console.error('Error pinning tab:', error);
      throw error;
    }
  }

  /**
   * Unpin a tab for a specific page
   * Removes the user's custom preference, returning to system default
   */
  async unpinTab(userId: string, pageId: string): Promise<void> {
    try {
      const existing = await db.tabPreferences
        .where('[user_id+page_id]')
        .equals([userId, pageId])
        .and((p) => p.deleted_at === null)
        .first();

      if (existing) {
        // Soft delete the preference
        await db.tabPreferences.update(existing.id, {
          deleted_at: Date.now(),
          updated_at: Date.now(),
        });
      }
    } catch (error) {
      console.error('Error unpinning tab:', error);
      throw error;
    }
  }

  /**
   * Check if a tab is currently pinned
   */
  async isTabPinned(userId: string, pageId: string, tabId: string): Promise<boolean> {
    try {
      const preference = await db.tabPreferences
        .where('[user_id+page_id]')
        .equals([userId, pageId])
        .and((p) => p.deleted_at === null)
        .first();

      return preference?.pinned_tab_id === tabId;
    } catch (error) {
      console.error('Error checking if tab is pinned:', error);
      return false;
    }
  }

  /**
   * Get all tab preferences for a user
   * Useful for exporting/syncing user settings
   */
  async getAllPreferences(userId: string): Promise<TabPreference[]> {
    try {
      return await db.tabPreferences
        .where('user_id')
        .equals(userId)
        .and((p) => p.deleted_at === null)
        .toArray();
    } catch (error) {
      console.error('Error getting all preferences:', error);
      return [];
    }
  }
}

// Export singleton instance
export const tabPreferencesService = new TabPreferencesService();
