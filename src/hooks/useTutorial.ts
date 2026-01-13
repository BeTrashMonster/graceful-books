/**
 * Tutorial Hook
 *
 * React hook for managing tutorial state and interactions.
 * Provides context for starting, navigating, and completing tutorials.
 *
 * Requirements:
 * - D4: Tutorial System Framework
 * - LEARN-001: Contextual Tutorial System
 */

import { useState, useCallback } from 'react';
import type {
  TutorialState,
  TutorialDefinition,
  TutorialProgress,
  TutorialBadge,
  TutorialStats,
} from '../types/tutorial.types';
import {
  getTutorialProgress,
  startTutorial as startTutorialStore,
  updateTutorialStep,
  completeTutorial as completeTutorialStore,
  skipTutorial as skipTutorialStore,
  shouldShowTutorial as shouldShowTutorialStore,
  getTutorialStats as getTutorialStatsStore,
  getEarnedBadges,
} from '../store/tutorials';
import {
  getTutorialById,
  allTutorials,
} from '../features/tutorials/tutorialDefinitions';

/**
 * Tutorial hook return type
 */
export interface UseTutorialReturn {
  /**
   * Current tutorial state
   */
  state: TutorialState;

  /**
   * Current step in the tutorial (null if not active)
   */
  currentStep: TutorialDefinition['steps'][0] | null;

  /**
   * Progress percentage (0-100)
   */
  progressPercentage: number;

  /**
   * Whether user can go to next step
   */
  canGoNext: boolean;

  /**
   * Whether user can go to previous step
   */
  canGoPrevious: boolean;

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
  nextStep: () => Promise<void>;

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
   * Stop/close current tutorial
   */
  stopTutorial: () => void;

  /**
   * Get tutorial progress
   */
  getTutorialProgressData: (tutorialId: string) => Promise<TutorialProgress | null>;

  /**
   * Check if tutorial should be shown
   */
  shouldShowTutorial: (tutorialId: string) => Promise<boolean>;

  /**
   * Get all available tutorials
   */
  getAvailableTutorials: () => TutorialDefinition[];

  /**
   * Get tutorial statistics
   */
  getTutorialStats: () => Promise<TutorialStats | null>;

  /**
   * Get earned badges
   */
  getBadges: () => Promise<TutorialBadge[]>;
}

/**
 * Tutorial hook
 *
 * @param userId - User ID
 * @returns Tutorial hook utilities
 */
export function useTutorial(userId: string): UseTutorialReturn {
  const [state, setState] = useState<TutorialState>({
    isActive: false,
    tutorial: null,
    currentStepIndex: 0,
    isLoading: false,
    error: null,
  });

  // Get current step
  const currentStep = state.tutorial && state.isActive
    ? state.tutorial.steps[state.currentStepIndex] || null
    : null;

  // Calculate progress percentage
  const progressPercentage = state.tutorial
    ? Math.round((state.currentStepIndex / state.tutorial.steps.length) * 100)
    : 0;

  // Check if can navigate
  // Allow next on last step to trigger completion
  const canGoNext = state.tutorial
    ? state.currentStepIndex < state.tutorial.steps.length
    : false;

  const canGoPrevious = state.currentStepIndex > 0;

  /**
   * Start a tutorial
   */
  const startTutorial = useCallback(
    async (tutorialId: string) => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const tutorial = getTutorialById(tutorialId);
        if (!tutorial) {
          throw new Error(`Tutorial not found: ${tutorialId}`);
        }

        // Start tutorial in store
        const result = await startTutorialStore(userId, tutorial);
        if (!result.success) {
          throw new Error(result.error.message);
        }

        setState({
          isActive: true,
          tutorial,
          currentStepIndex: result.data.current_step,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to start tutorial',
        }));
      }
    },
    [userId]
  );

  /**
   * Resume a tutorial
   */
  const resumeTutorial = useCallback(
    async (tutorialId: string) => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const tutorial = getTutorialById(tutorialId);
        if (!tutorial) {
          throw new Error(`Tutorial not found: ${tutorialId}`);
        }

        // Get existing progress
        const progressResult = await getTutorialProgress(userId, tutorialId);
        if (!progressResult.success) {
          throw new Error(progressResult.error.message);
        }

        const progress = progressResult.data;
        if (!progress) {
          // No progress exists, start fresh
          await startTutorial(tutorialId);
          return;
        }

        setState({
          isActive: true,
          tutorial,
          currentStepIndex: progress.current_step,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to resume tutorial',
        }));
      }
    },
    [userId, startTutorial]
  );

  /**
   * Go to next step
   */
  const nextStep = useCallback(async () => {
    if (!state.tutorial || !canGoNext) return;

    const nextStepIndex = state.currentStepIndex + 1;

    // Update progress in store
    try {
      const result = await updateTutorialStep(userId, state.tutorial.id, nextStepIndex);
      if (!result.success) {
        throw new Error(result.error.message);
      }

      setState((prev) => ({
        ...prev,
        currentStepIndex: nextStepIndex,
      }));

      // If this was the last step, complete the tutorial
      if (nextStepIndex >= state.tutorial.steps.length) {
        // Inline completion logic to avoid circular dependency
        const badge: TutorialBadge = {
          id: `badge-${state.tutorial.id}`,
          name: state.tutorial.title,
          icon: '🎓',
          earned_at: Date.now(),
          description: `Completed: ${state.tutorial.title}`,
        };

        const completeResult = await completeTutorialStore(userId, state.tutorial.id, badge);
        if (completeResult.success) {
          setState({
            isActive: false,
            tutorial: null,
            currentStepIndex: 0,
            isLoading: false,
            error: null,
          });
        }
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to progress tutorial',
      }));
    }
  }, [state.tutorial, state.currentStepIndex, canGoNext, userId]);

  /**
   * Go to previous step
   */
  const previousStep = useCallback(() => {
    if (!canGoPrevious) return;

    setState((prev) => ({
      ...prev,
      currentStepIndex: prev.currentStepIndex - 1,
    }));
  }, [canGoPrevious]);

  /**
   * Skip tutorial
   */
  const skipTutorial = useCallback(
    async (dontShowAgain: boolean = false) => {
      if (!state.tutorial) return;

      try {
        const result = await skipTutorialStore(userId, state.tutorial.id, dontShowAgain);
        if (!result.success) {
          throw new Error(result.error.message);
        }

        setState({
          isActive: false,
          tutorial: null,
          currentStepIndex: 0,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to skip tutorial',
        }));
      }
    },
    [state.tutorial, userId]
  );

  /**
   * Complete tutorial
   */
  const completeTutorial = useCallback(async () => {
    if (!state.tutorial) return;

    try {
      // Generate badge for completion
      const badge: TutorialBadge = {
        id: `badge-${state.tutorial.id}`,
        name: state.tutorial.title,
        icon: '🎓',
        earned_at: Date.now(),
        description: `Completed: ${state.tutorial.title}`,
      };

      const result = await completeTutorialStore(userId, state.tutorial.id, badge);
      if (!result.success) {
        throw new Error(result.error.message);
      }

      setState({
        isActive: false,
        tutorial: null,
        currentStepIndex: 0,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to complete tutorial',
      }));
    }
  }, [state.tutorial, userId]);

  /**
   * Stop/close tutorial without completing or skipping
   */
  const stopTutorial = useCallback(() => {
    setState({
      isActive: false,
      tutorial: null,
      currentStepIndex: 0,
      isLoading: false,
      error: null,
    });
  }, []);

  /**
   * Get tutorial progress data
   */
  const getTutorialProgressData = useCallback(
    async (tutorialId: string): Promise<TutorialProgress | null> => {
      const result = await getTutorialProgress(userId, tutorialId);
      if (!result.success) {
        console.error('Failed to get tutorial progress:', result.error.message);
        return null;
      }
      return result.data;
    },
    [userId]
  );

  /**
   * Check if tutorial should be shown
   */
  const shouldShowTutorial = useCallback(
    async (tutorialId: string): Promise<boolean> => {
      const result = await shouldShowTutorialStore(userId, tutorialId);
      if (!result.success) {
        console.error('Failed to check if tutorial should show:', result.error.message);
        return false;
      }
      return result.data;
    },
    [userId]
  );

  /**
   * Get all available tutorials
   */
  const getAvailableTutorials = useCallback((): TutorialDefinition[] => {
    return allTutorials;
  }, []);

  /**
   * Get tutorial statistics
   */
  const getTutorialStats = useCallback(async (): Promise<TutorialStats | null> => {
    const result = await getTutorialStatsStore(userId, allTutorials);
    if (!result.success) {
      console.error('Failed to get tutorial stats:', result.error.message);
      return null;
    }
    return result.data;
  }, [userId]);

  /**
   * Get earned badges
   */
  const getBadges = useCallback(async (): Promise<TutorialBadge[]> => {
    const result = await getEarnedBadges(userId);
    if (!result.success) {
      console.error('Failed to get badges:', result.error.message);
      return [];
    }
    return result.data;
  }, [userId]);

  return {
    state,
    currentStep,
    progressPercentage,
    canGoNext,
    canGoPrevious,
    startTutorial,
    resumeTutorial,
    nextStep,
    previousStep,
    skipTutorial,
    completeTutorial,
    stopTutorial,
    getTutorialProgressData,
    shouldShowTutorial,
    getAvailableTutorials,
    getTutorialStats,
    getBadges,
  };
}
