/**
 * Tests for useFeatureVisibility Hook
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFeatureVisibility } from './useFeatureVisibility';
import type { UseFeatureVisibilityOptions } from './useFeatureVisibility';

describe('useFeatureVisibility', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('canAccess', () => {
    it('should allow access to features in current phase', () => {
      const { result } = renderHook(() =>
        useFeatureVisibility({
          currentPhase: 'stabilize',
          userId: 'test-user',
        })
      );

      expect(result.current.canAccess('dashboard')).toBe(true);
      expect(result.current.canAccess('basic-transactions')).toBe(true);
    });

    it('should deny access to features in higher phases', () => {
      const { result } = renderHook(() =>
        useFeatureVisibility({
          currentPhase: 'stabilize',
          userId: 'test-user',
        })
      );

      expect(result.current.canAccess('categories')).toBe(false);
      expect(result.current.canAccess('invoicing')).toBe(false);
    });

    it('should allow access to previous phase features', () => {
      const { result } = renderHook(() =>
        useFeatureVisibility({
          currentPhase: 'organize',
          userId: 'test-user',
        })
      );

      expect(result.current.canAccess('dashboard')).toBe(true);
      expect(result.current.canAccess('categories')).toBe(true);
    });
  });

  describe('isVisible', () => {
    it('should show visible features based on phase rules', () => {
      const { result } = renderHook(() =>
        useFeatureVisibility({
          currentPhase: 'stabilize',
          userId: 'test-user',
        })
      );

      expect(result.current.isVisible('dashboard')).toBe(true);
      expect(result.current.isVisible('categories')).toBe(true); // Preview feature
    });

    it('should hide features not in visibility rules', () => {
      const { result } = renderHook(() =>
        useFeatureVisibility({
          currentPhase: 'stabilize',
          userId: 'test-user',
        })
      );

      expect(result.current.isVisible('invoicing')).toBe(false);
      expect(result.current.isVisible('forecasting')).toBe(false);
    });

    it('should show all features when showAllFeatures is true', () => {
      const { result } = renderHook(() =>
        useFeatureVisibility({
          currentPhase: 'stabilize',
          userId: 'test-user',
          initialShowAllFeatures: true,
        })
      );

      expect(result.current.isVisible('invoicing')).toBe(true);
      expect(result.current.isVisible('forecasting')).toBe(true);
    });
  });

  describe('getAccess', () => {
    it('should return detailed access information', () => {
      const { result } = renderHook(() =>
        useFeatureVisibility({
          currentPhase: 'stabilize',
          userId: 'test-user',
        })
      );

      const accessibleResult = result.current.getAccess('dashboard');
      expect(accessibleResult.canAccess).toBe(true);
      expect(accessibleResult.isVisible).toBe(true);

      const lockedResult = result.current.getAccess('categories');
      expect(lockedResult.canAccess).toBe(false);
      expect(lockedResult.isVisible).toBe(true);
      expect(lockedResult.reason).toBe('phase-locked');
    });
  });

  describe('getMetadata', () => {
    it('should return feature metadata', () => {
      const { result } = renderHook(() =>
        useFeatureVisibility({
          currentPhase: 'stabilize',
          userId: 'test-user',
        })
      );

      const metadata = result.current.getMetadata('dashboard');
      expect(metadata).toBeDefined();
      expect(metadata?.id).toBe('dashboard');
      expect(metadata?.name).toBeDefined();
    });

    it('should return undefined for non-existent features', () => {
      const { result } = renderHook(() =>
        useFeatureVisibility({
          currentPhase: 'stabilize',
          userId: 'test-user',
        })
      );

      const metadata = result.current.getMetadata('non-existent' as any);
      expect(metadata).toBeUndefined();
    });
  });

  describe('state', () => {
    it('should provide complete visibility state', () => {
      const { result } = renderHook(() =>
        useFeatureVisibility({
          currentPhase: 'stabilize',
          userId: 'test-user',
        })
      );

      const state = result.current.state;
      expect(state.currentPhase).toBe('stabilize');
      expect(state.allFeatures.length).toBeGreaterThan(0);
      expect(state.accessibleFeatures.length).toBeGreaterThan(0);
      expect(state.showAllFeatures).toBe(false);
    });

    it('should include recently unlocked features', () => {
      const { result } = renderHook(() =>
        useFeatureVisibility({
          currentPhase: 'organize',
          userId: 'test-user',
        })
      );

      expect(result.current.state.recentlyUnlocked).toBeDefined();
      expect(Array.isArray(result.current.state.recentlyUnlocked)).toBe(true);
    });
  });

  describe('showAllFeatures', () => {
    it('should toggle show all features', () => {
      const { result } = renderHook(() =>
        useFeatureVisibility({
          currentPhase: 'stabilize',
          userId: 'test-user',
          initialShowAllFeatures: false,
        })
      );

      expect(result.current.showAllFeatures).toBe(false);

      act(() => {
        result.current.toggleShowAllFeatures();
      });

      expect(result.current.showAllFeatures).toBe(true);

      act(() => {
        result.current.toggleShowAllFeatures();
      });

      expect(result.current.showAllFeatures).toBe(false);
    });

    it('should set show all features directly', () => {
      const { result } = renderHook(() =>
        useFeatureVisibility({
          currentPhase: 'stabilize',
          userId: 'test-user',
        })
      );

      act(() => {
        result.current.setShowAllFeatures(true);
      });

      expect(result.current.showAllFeatures).toBe(true);

      act(() => {
        result.current.setShowAllFeatures(false);
      });

      expect(result.current.showAllFeatures).toBe(false);
    });

    it('should persist show all features preference to localStorage', () => {
      const { result } = renderHook(() =>
        useFeatureVisibility({
          currentPhase: 'stabilize',
          userId: 'test-user',
        })
      );

      act(() => {
        result.current.setShowAllFeatures(true);
      });

      // Check localStorage
      const stored = localStorage.getItem('graceful_books_feature_visibility_prefs');
      expect(stored).toBeDefined();
      const prefs = JSON.parse(stored!);
      expect(prefs.showAllFeatures).toBe(true);
    });
  });

  describe('handlePhaseChange', () => {
    it('should detect unlocked features when phase increases', () => {
      const { result } = renderHook(() =>
        useFeatureVisibility({
          currentPhase: 'stabilize',
          userId: 'test-user',
        })
      );

      let unlockedFeatures: string[] = [];
      act(() => {
        unlockedFeatures = result.current.handlePhaseChange('organize');
      });

      expect(unlockedFeatures.length).toBeGreaterThan(0);
      expect(unlockedFeatures).toContain('categories');
      expect(unlockedFeatures).toContain('tags');
    });

    it('should trigger onFeatureUnlock callback', () => {
      const onFeatureUnlock = vi.fn();

      const { result } = renderHook(() =>
        useFeatureVisibility({
          currentPhase: 'stabilize',
          userId: 'test-user',
          onFeatureUnlock,
        })
      );

      act(() => {
        result.current.handlePhaseChange('organize');
      });

      expect(onFeatureUnlock).toHaveBeenCalled();
      expect(onFeatureUnlock).toHaveBeenCalledWith(
        expect.objectContaining({
          newPhase: 'organize',
          oldPhase: 'stabilize',
        })
      );
    });

    it('should not trigger unlocks when phase stays the same', () => {
      const onFeatureUnlock = vi.fn();

      const { result } = renderHook(() =>
        useFeatureVisibility({
          currentPhase: 'organize',
          userId: 'test-user',
          onFeatureUnlock,
        })
      );

      act(() => {
        result.current.handlePhaseChange('organize');
      });

      expect(onFeatureUnlock).not.toHaveBeenCalled();
    });
  });

  describe('dismissUnlock', () => {
    it('should remove feature from recently unlocked', () => {
      const { result } = renderHook(() =>
        useFeatureVisibility({
          currentPhase: 'stabilize',
          userId: 'test-user',
        })
      );

      // Trigger unlock
      act(() => {
        result.current.handlePhaseChange('organize');
      });

      const unlockedBefore = result.current.getRecentlyUnlocked();
      expect(unlockedBefore.length).toBeGreaterThan(0);

      // Dismiss first unlock
      const firstFeature = unlockedBefore[0]!;
      act(() => {
        result.current.dismissUnlock(firstFeature);
      });

      const unlockedAfter = result.current.getRecentlyUnlocked();
      expect(unlockedAfter).not.toContain(firstFeature);
    });

    it('should persist dismissed unlocks', () => {
      const { result } = renderHook(() =>
        useFeatureVisibility({
          currentPhase: 'stabilize',
          userId: 'test-user',
        })
      );

      // Trigger unlock
      act(() => {
        result.current.handlePhaseChange('organize');
      });

      // Dismiss unlock
      act(() => {
        result.current.dismissUnlock('categories');
      });

      // Check localStorage
      const stored = localStorage.getItem('graceful_books_feature_visibility_prefs');
      expect(stored).toBeDefined();
      const prefs = JSON.parse(stored!);
      expect(prefs.dismissedUnlocks).toContain('categories');
    });
  });

  describe('getRecentlyUnlocked', () => {
    it('should return features unlocked and not dismissed', () => {
      const { result } = renderHook(() =>
        useFeatureVisibility({
          currentPhase: 'stabilize',
          userId: 'test-user',
        })
      );

      // Trigger unlock
      act(() => {
        result.current.handlePhaseChange('organize');
      });

      const unlocked = result.current.getRecentlyUnlocked();
      expect(unlocked.length).toBeGreaterThan(0);

      // Dismiss one
      act(() => {
        result.current.dismissUnlock(unlocked[0]!);
      });

      const afterDismiss = result.current.getRecentlyUnlocked();
      expect(afterDismiss.length).toBe(unlocked.length - 1);
      expect(afterDismiss).not.toContain(unlocked[0]);
    });
  });

  describe('localStorage persistence', () => {
    it('should load preferences from localStorage on mount', () => {
      // Set preferences in localStorage
      const prefs = {
        userId: 'test-user',
        showAllFeatures: true,
        dismissedUnlocks: ['categories'],
        lastSeenPhase: 'organize',
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem('graceful_books_feature_visibility_prefs', JSON.stringify(prefs));

      const { result } = renderHook(() =>
        useFeatureVisibility({
          currentPhase: 'organize',
          userId: 'test-user',
        })
      );

      expect(result.current.showAllFeatures).toBe(true);
    });

    it('should not load preferences for different user', () => {
      // Set preferences for different user
      const prefs = {
        userId: 'other-user',
        showAllFeatures: true,
        dismissedUnlocks: [],
        lastSeenPhase: 'organize',
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem('graceful_books_feature_visibility_prefs', JSON.stringify(prefs));

      const { result } = renderHook(() =>
        useFeatureVisibility({
          currentPhase: 'stabilize',
          userId: 'test-user',
          initialShowAllFeatures: false,
        })
      );

      expect(result.current.showAllFeatures).toBe(false);
    });

    it('should handle missing localStorage gracefully', () => {
      const { result } = renderHook(() =>
        useFeatureVisibility({
          currentPhase: 'stabilize',
          userId: 'test-user',
        })
      );

      expect(result.current).toBeDefined();
      expect(result.current.state).toBeDefined();
    });
  });

  describe('automatic phase change detection', () => {
    it('should detect phase changes automatically', () => {
      const onFeatureUnlock = vi.fn();

      const { rerender } = renderHook(
        (props: UseFeatureVisibilityOptions) => useFeatureVisibility(props),
        {
          initialProps: {
            currentPhase: 'stabilize',
            userId: 'test-user',
            onFeatureUnlock,
          } as UseFeatureVisibilityOptions,
        }
      );

      // Change phase
      rerender({
        currentPhase: 'organize',
        userId: 'test-user',
        onFeatureUnlock,
      });

      expect(onFeatureUnlock).toHaveBeenCalled();
    });
  });
});
