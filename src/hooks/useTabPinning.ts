/**
 * useTabPinning Hook
 *
 * Manages tab pinning state for a page with multiple tabs.
 * Provides functions to pin/unpin tabs and get the default tab to open.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { tabPreferencesService } from '../services/tabPreferences.service';
import { DEFAULT_TABS } from '../db/schema/tabPreferences.schema';

interface UseTabPinningOptions {
  pageId: string;
  defaultTab?: string; // Override system default if needed
}

interface UseTabPinningReturn {
  /** The tab that should be shown by default (either pinned or system default) */
  defaultTab: string;
  /** Whether the data is still loading */
  isLoading: boolean;
  /** Pin a specific tab as the default */
  pinTab: (tabId: string) => Promise<void>;
  /** Unpin the current tab (return to system default) */
  unpinTab: () => Promise<void>;
  /** Check if a specific tab is currently pinned */
  isTabPinned: (tabId: string) => Promise<boolean>;
  /** Get the currently pinned tab ID (or null if none pinned) */
  getPinnedTabId: () => Promise<string | null>;
}

export function useTabPinning({ pageId, defaultTab }: UseTabPinningOptions): UseTabPinningReturn {
  const { userIdentifier: authUserIdentifier, companyId } = useAuth();
  // Use userIdentifier from auth, fall back to companyId, then to 'demo-user'
  const userIdentifier = authUserIdentifier || companyId || 'demo-user';
  const [currentDefaultTab, setCurrentDefaultTab] = useState<string>(
    defaultTab || DEFAULT_TABS[pageId as keyof typeof DEFAULT_TABS] || ''
  );
  const [isLoading, setIsLoading] = useState(true);

  // Load the pinned tab when component mounts or user changes
  useEffect(() => {
    const loadPinnedTab = async () => {
      if (!userIdentifier) {
        setIsLoading(false);
        return;
      }

      try {
        const pinnedTabId = await tabPreferencesService.getPinnedTab(userIdentifier, pageId);
        setCurrentDefaultTab(pinnedTabId);
      } catch (error) {
        console.error('Error loading pinned tab:', error);
        // Fall back to default
        setCurrentDefaultTab(defaultTab || DEFAULT_TABS[pageId as keyof typeof DEFAULT_TABS] || '');
      } finally {
        setIsLoading(false);
      }
    };

    loadPinnedTab();
  }, [userIdentifier, pageId, defaultTab]);

  const pinTab = useCallback(
    async (tabId: string) => {
      if (!userIdentifier) {
        console.warn('Cannot pin tab: no user logged in');
        return;
      }

      try {
        await tabPreferencesService.pinTab(userIdentifier, pageId, tabId);
        setCurrentDefaultTab(tabId);
      } catch (error) {
        console.error('Error pinning tab:', error);
        throw error;
      }
    },
    [userIdentifier, pageId]
  );

  const unpinTab = useCallback(async () => {
    if (!userIdentifier) {
      console.warn('Cannot unpin tab: no user logged in');
      return;
    }

    try {
      await tabPreferencesService.unpinTab(userIdentifier, pageId);
      // Reset to system default
      const systemDefault = defaultTab || DEFAULT_TABS[pageId as keyof typeof DEFAULT_TABS] || '';
      setCurrentDefaultTab(systemDefault);
    } catch (error) {
      console.error('Error unpinning tab:', error);
      throw error;
    }
  }, [userIdentifier, pageId, defaultTab]);

  const isTabPinned = useCallback(
    async (tabId: string): Promise<boolean> => {
      if (!userIdentifier) return false;

      try {
        return await tabPreferencesService.isTabPinned(userIdentifier, pageId, tabId);
      } catch (error) {
        console.error('Error checking if tab is pinned:', error);
        return false;
      }
    },
    [userIdentifier, pageId]
  );

  const getPinnedTabId = useCallback(async (): Promise<string | null> => {
    if (!userIdentifier) return null;

    try {
      const pinnedTabId = await tabPreferencesService.getPinnedTab(userIdentifier, pageId);
      const systemDefault = defaultTab || DEFAULT_TABS[pageId as keyof typeof DEFAULT_TABS] || '';

      // If the pinned tab is the same as system default, user hasn't pinned anything
      if (pinnedTabId === systemDefault) {
        return null;
      }

      return pinnedTabId;
    } catch (error) {
      console.error('Error getting pinned tab ID:', error);
      return null;
    }
  }, [userIdentifier, pageId, defaultTab]);

  return {
    defaultTab: currentDefaultTab,
    isLoading,
    pinTab,
    unpinTab,
    isTabPinned,
    getPinnedTabId,
  };
}
