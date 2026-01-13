/**
 * useTutorial Hook Tests
 *
 * Tests for the tutorial hook functionality including:
 * - Starting and resuming tutorials
 * - Navigation between steps
 * - Skipping and completing tutorials
 * - State management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { useTutorial } from './useTutorial';
import { db } from '../store/database';
import type { TutorialDefinition } from '../types/tutorial.types';
import { TutorialTrigger, StepPosition } from '../types/tutorial.types';

// Test tutorial definition
const mockTutorial: TutorialDefinition = {
  id: 'test-tutorial',
  title: 'Test Tutorial',
  description: 'A test tutorial',
  category: 'feature',
  trigger: TutorialTrigger.FIRST_TIME,
  estimatedMinutes: 2,
  steps: [
    {
      id: 'step1',
      title: 'Step 1',
      description: 'First step',
      element: null,
      position: StepPosition.CENTER,
    },
    {
      id: 'step2',
      title: 'Step 2',
      description: 'Second step',
      element: '[data-test="element"]',
      position: StepPosition.BOTTOM,
    },
    {
      id: 'step3',
      title: 'Step 3',
      description: 'Third step',
      element: null,
      position: StepPosition.CENTER,
    },
  ],
};

const testUserId = 'test-user-123';

// Mock tutorial definitions - defined inside factory to avoid hoisting issues
vi.mock('../features/tutorials/tutorialDefinitions', () => {
  // Duplicate mockTutorial inside factory since vi.mock is hoisted
  // Use literal values instead of imported enums to avoid circular reference
  const mockTutorialInFactory = {
    id: 'test-tutorial',
    title: 'Test Tutorial',
    description: 'A test tutorial',
    category: 'feature' as const,
    trigger: 'FIRST_TIME' as const, // TutorialTrigger.FIRST_TIME
    estimatedMinutes: 2,
    steps: [
      {
        id: 'step1',
        title: 'Step 1',
        description: 'First step',
        element: null,
        position: 'center' as const, // StepPosition.CENTER
      },
      {
        id: 'step2',
        title: 'Step 2',
        description: 'Second step',
        element: '[data-test="element"]',
        position: 'bottom' as const, // StepPosition.BOTTOM
      },
      {
        id: 'step3',
        title: 'Step 3',
        description: 'Third step',
        element: null,
        position: 'center' as const, // StepPosition.CENTER
      },
    ],
  };

  return {
    getTutorialById: (id: string) => (id === mockTutorialInFactory.id ? mockTutorialInFactory : undefined),
    allTutorials: [mockTutorialInFactory],
  };
});

describe('useTutorial Hook', () => {
  beforeEach(async () => {
    await db.tutorialProgress.clear();
  });

  afterEach(async () => {
    await db.tutorialProgress.clear();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useTutorial(testUserId));

      expect(result.current.state.isActive).toBe(false);
      expect(result.current.state.tutorial).toBeNull();
      expect(result.current.state.currentStepIndex).toBe(0);
      expect(result.current.state.isLoading).toBe(false);
      expect(result.current.state.error).toBeNull();
      expect(result.current.currentStep).toBeNull();
      expect(result.current.progressPercentage).toBe(0);
      expect(result.current.canGoNext).toBe(false);
      expect(result.current.canGoPrevious).toBe(false);
    });
  });

  describe('startTutorial', () => {
    it('should start a tutorial', async () => {
      const { result } = renderHook(() => useTutorial(testUserId));

      await act(async () => {
        await result.current.startTutorial(mockTutorial.id);
      });

      await waitFor(() => {
        expect(result.current.state.isActive).toBe(true);
        expect(result.current.state.tutorial).toEqual(mockTutorial);
        expect(result.current.state.currentStepIndex).toBe(0);
        expect(result.current.currentStep).toEqual(mockTutorial.steps[0]);
      });
    });

    it('should set error for non-existent tutorial', async () => {
      const { result } = renderHook(() => useTutorial(testUserId));

      await act(async () => {
        await result.current.startTutorial('nonexistent');
      });

      await waitFor(() => {
        expect(result.current.state.error).toBeTruthy();
        expect(result.current.state.isActive).toBe(false);
      });
    });
  });

  describe('Navigation', () => {
    it('should navigate to next step', async () => {
      const { result } = renderHook(() => useTutorial(testUserId));

      await act(async () => {
        await result.current.startTutorial(mockTutorial.id);
      });

      await waitFor(() => {
        expect(result.current.state.isActive).toBe(true);
      });

      await act(async () => {
        await result.current.nextStep();
      });

      await waitFor(() => {
        expect(result.current.state.currentStepIndex).toBe(1);
        expect(result.current.currentStep).toEqual(mockTutorial.steps[1]);
      });
    });

    it('should navigate to previous step', async () => {
      const { result } = renderHook(() => useTutorial(testUserId));

      await act(async () => {
        await result.current.startTutorial(mockTutorial.id);
      });

      await waitFor(() => {
        expect(result.current.state.isActive).toBe(true);
      });

      await act(async () => {
        await result.current.nextStep();
      });

      await waitFor(() => {
        expect(result.current.state.currentStepIndex).toBe(1);
      });

      act(() => {
        result.current.previousStep();
      });

      await waitFor(() => {
        expect(result.current.state.currentStepIndex).toBe(0);
      });
    });

    it('should not go previous from first step', async () => {
      const { result } = renderHook(() => useTutorial(testUserId));

      await act(async () => {
        await result.current.startTutorial(mockTutorial.id);
      });

      await waitFor(() => {
        expect(result.current.state.isActive).toBe(true);
      });

      act(() => {
        result.current.previousStep();
      });

      expect(result.current.state.currentStepIndex).toBe(0);
    });

    it('should complete tutorial on last step next', async () => {
      const { result } = renderHook(() => useTutorial(testUserId));

      await act(async () => {
        await result.current.startTutorial(mockTutorial.id);
      });

      await waitFor(() => {
        expect(result.current.state.isActive).toBe(true);
      });

      await act(async () => {
        await result.current.nextStep();
      });

      await waitFor(() => {
        expect(result.current.state.currentStepIndex).toBe(1);
      });

      await act(async () => {
        await result.current.nextStep();
      });

      await waitFor(() => {
        expect(result.current.state.currentStepIndex).toBe(2);
      });

      await act(async () => {
        await result.current.nextStep(); // Last step - should complete
      });

      await waitFor(() => {
        expect(result.current.state.isActive).toBe(false);
      });

      // Verify completion in database
      const progress = await result.current.getTutorialProgressData(mockTutorial.id);
      expect(progress?.status).toBe('COMPLETED');
    });
  });

  describe('Progress Calculation', () => {
    it('should calculate progress percentage correctly', async () => {
      const { result } = renderHook(() => useTutorial(testUserId));

      await act(async () => {
        await result.current.startTutorial(mockTutorial.id);
      });

      await waitFor(() => {
        expect(result.current.progressPercentage).toBe(0); // 0/3 = 0%
      });

      await act(async () => {
        await result.current.nextStep();
      });

      await waitFor(() => {
        expect(result.current.progressPercentage).toBe(33); // 1/3 = 33%
      });

      await act(async () => {
        await result.current.nextStep();
      });

      await waitFor(() => {
        expect(result.current.progressPercentage).toBe(67); // 2/3 = 67%
      });
    });

    it('should correctly calculate canGoNext and canGoPrevious', async () => {
      const { result } = renderHook(() => useTutorial(testUserId));

      await act(async () => {
        await result.current.startTutorial(mockTutorial.id);
      });

      await waitFor(() => {
        expect(result.current.canGoNext).toBe(true);
        expect(result.current.canGoPrevious).toBe(false);
      });

      await act(async () => {
        await result.current.nextStep();
      });

      await waitFor(() => {
        expect(result.current.canGoNext).toBe(true);
        expect(result.current.canGoPrevious).toBe(true);
      });

      await act(async () => {
        await result.current.nextStep();
      });

      await waitFor(() => {
        expect(result.current.canGoNext).toBe(true); // Can go next on last step to trigger completion
        expect(result.current.canGoPrevious).toBe(true);
      });
    });
  });

  describe('skipTutorial', () => {
    it('should skip tutorial', async () => {
      const { result } = renderHook(() => useTutorial(testUserId));

      await act(async () => {
        await result.current.startTutorial(mockTutorial.id);
      });

      await waitFor(() => {
        expect(result.current.state.isActive).toBe(true);
      });

      await act(async () => {
        await result.current.skipTutorial(false);
      });

      await waitFor(() => {
        expect(result.current.state.isActive).toBe(false);
      });

      const progress = await result.current.getTutorialProgressData(mockTutorial.id);
      expect(progress?.status).toBe('SKIPPED');
      expect(progress?.dont_show_again).toBe(false);
    });

    it('should dismiss tutorial when dontShowAgain is true', async () => {
      const { result } = renderHook(() => useTutorial(testUserId));

      await act(async () => {
        await result.current.startTutorial(mockTutorial.id);
      });

      await waitFor(() => {
        expect(result.current.state.isActive).toBe(true);
      });

      await act(async () => {
        await result.current.skipTutorial(true);
      });

      await waitFor(() => {
        expect(result.current.state.isActive).toBe(false);
      });

      const progress = await result.current.getTutorialProgressData(mockTutorial.id);
      expect(progress?.status).toBe('DISMISSED');
      expect(progress?.dont_show_again).toBe(true);
    });
  });

  describe('completeTutorial', () => {
    it('should complete tutorial with badge', async () => {
      const { result } = renderHook(() => useTutorial(testUserId));

      await act(async () => {
        await result.current.startTutorial(mockTutorial.id);
      });

      await waitFor(() => {
        expect(result.current.state.isActive).toBe(true);
      });

      await act(async () => {
        await result.current.completeTutorial();
      });

      await waitFor(() => {
        expect(result.current.state.isActive).toBe(false);
      });

      const progress = await result.current.getTutorialProgressData(mockTutorial.id);
      expect(progress?.status).toBe('COMPLETED');
      expect(progress?.badge_data).toBeDefined();
    });
  });

  describe('stopTutorial', () => {
    it('should stop tutorial without saving state', async () => {
      const { result } = renderHook(() => useTutorial(testUserId));

      await act(async () => {
        await result.current.startTutorial(mockTutorial.id);
      });

      await waitFor(() => {
        expect(result.current.state.isActive).toBe(true);
      });

      act(() => {
        result.current.stopTutorial();
      });

      expect(result.current.state.isActive).toBe(false);

      // Progress should still be in database as IN_PROGRESS
      const progress = await result.current.getTutorialProgressData(mockTutorial.id);
      expect(progress?.status).toBe('IN_PROGRESS');
    });
  });

  describe('resumeTutorial', () => {
    it('should resume from saved progress', async () => {
      const { result } = renderHook(() => useTutorial(testUserId));

      // Start and progress to step 1
      await act(async () => {
        await result.current.startTutorial(mockTutorial.id);
      });

      await waitFor(() => {
        expect(result.current.state.isActive).toBe(true);
      });

      await act(async () => {
        await result.current.nextStep();
      });

      await waitFor(() => {
        expect(result.current.state.currentStepIndex).toBe(1);
      });

      // Stop tutorial
      act(() => {
        result.current.stopTutorial();
      });

      // Resume tutorial
      await act(async () => {
        await result.current.resumeTutorial(mockTutorial.id);
      });

      await waitFor(() => {
        expect(result.current.state.isActive).toBe(true);
        expect(result.current.state.currentStepIndex).toBe(1);
      });
    });

    it('should start fresh if no progress exists', async () => {
      const { result } = renderHook(() => useTutorial(testUserId));

      await act(async () => {
        await result.current.resumeTutorial(mockTutorial.id);
      });

      await waitFor(() => {
        expect(result.current.state.isActive).toBe(true);
        expect(result.current.state.currentStepIndex).toBe(0);
      });
    });
  });

  describe('shouldShowTutorial', () => {
    it('should return true for new tutorial', async () => {
      const { result } = renderHook(() => useTutorial(testUserId));

      const shouldShow = await result.current.shouldShowTutorial(mockTutorial.id);
      expect(shouldShow).toBe(true);
    });

    it('should return false for dismissed tutorial', async () => {
      const { result } = renderHook(() => useTutorial(testUserId));

      await act(async () => {
        await result.current.startTutorial(mockTutorial.id);
      });

      await waitFor(() => {
        expect(result.current.state.isActive).toBe(true);
      });

      await act(async () => {
        await result.current.skipTutorial(true);
      });

      await waitFor(async () => {
        const shouldShow = await result.current.shouldShowTutorial(mockTutorial.id);
        expect(shouldShow).toBe(false);
      });
    });

    it('should return false for completed tutorial', async () => {
      const { result } = renderHook(() => useTutorial(testUserId));

      await act(async () => {
        await result.current.startTutorial(mockTutorial.id);
      });

      await waitFor(() => {
        expect(result.current.state.isActive).toBe(true);
      });

      await act(async () => {
        await result.current.completeTutorial();
      });

      await waitFor(async () => {
        const shouldShow = await result.current.shouldShowTutorial(mockTutorial.id);
        expect(shouldShow).toBe(false);
      });
    });
  });

  describe('getTutorialStats', () => {
    it('should return tutorial statistics', async () => {
      const { result } = renderHook(() => useTutorial(testUserId));

      const stats = await result.current.getTutorialStats();

      expect(stats).toBeDefined();
      expect(stats?.total).toBe(1);
      expect(stats?.completed).toBe(0);
      expect(stats?.inProgress).toBe(0);
    });
  });

  describe('getBadges', () => {
    it('should return empty array when no badges earned', async () => {
      const { result } = renderHook(() => useTutorial(testUserId));

      const badges = await result.current.getBadges();

      expect(badges).toEqual([]);
    });

    it('should return badges after completion', async () => {
      const { result } = renderHook(() => useTutorial(testUserId));

      await act(async () => {
        await result.current.startTutorial(mockTutorial.id);
      });

      await waitFor(() => {
        expect(result.current.state.isActive).toBe(true);
      });

      await act(async () => {
        await result.current.completeTutorial();
      });

      await waitFor(async () => {
        const badges = await result.current.getBadges();
        expect(badges.length).toBeGreaterThan(0);
      });
    });
  });
});
