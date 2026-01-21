/**
 * Tutorial Store Tests
 *
 * Unit tests for tutorial data access layer functions.
 * Tests CRUD operations, progress tracking, and state management.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from './database';
import {
  getTutorialProgress,
  startTutorial,
  updateTutorialStep,
  completeTutorial,
  skipTutorial,
  resetTutorialProgress,
  shouldShowTutorial,
  getTutorialStats,
  getEarnedBadges,
} from './tutorials';
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
  ],
};

const testUserId = 'test-user-123';

describe('Tutorial Store', () => {
  beforeEach(async () => {
    // Clear database before each test
    await db.tutorialProgress.clear();
  });

  afterEach(async () => {
    // Clean up after each test
    await db.tutorialProgress.clear();
  });

  describe('getTutorialProgress', () => {
    it('should return null when no progress exists', async () => {
      const result = await getTutorialProgress(testUserId, mockTutorial.id);

      expect(result.success).toBe(true);
      expect((result as any).data).toBeNull();
    });

    it('should return progress when it exists', async () => {
      // Create progress first
      await startTutorial(testUserId, mockTutorial);

      const result = await getTutorialProgress(testUserId, mockTutorial.id);

      expect(result.success).toBe(true);
      expect((result as any).data).toBeDefined();
      expect((result as any).data.user_id).toBe(testUserId);
      expect((result as any).data.tutorial_id).toBe(mockTutorial.id);
      expect((result as any).data.status).toBe('IN_PROGRESS');
    });
  });

  describe('startTutorial', () => {
    it('should create new progress record', async () => {
      const result = await startTutorial(testUserId, mockTutorial);

      expect(result.success).toBe(true);
      if (!result.success) throw new Error('Expected success');
      expect(result.data).toBeDefined();
      expect(result.data.user_id).toBe(testUserId);
      expect(result.data.tutorial_id).toBe(mockTutorial.id);
      expect(result.data.status).toBe('IN_PROGRESS');
      expect(result.data.current_step).toBe(0);
      expect(result.data.total_steps).toBe(mockTutorial.steps.length);
      expect(result.data.attempt_count).toBe(1);
      expect(result.data.dont_show_again).toBe(false);
    });

    it('should increment attempt count when resuming', async () => {
      await startTutorial(testUserId, mockTutorial);
      const result = await startTutorial(testUserId, mockTutorial);

      expect(result.success).toBe(true);
      if (!result.success) throw new Error('Expected success');
      expect(result.data.attempt_count).toBe(2);
    });

    it('should create new progress after dismissal', async () => {
      await skipTutorial(testUserId, mockTutorial.id, true);
      const result = await startTutorial(testUserId, mockTutorial);

      // Should still resume since dismissal doesn't prevent starting
      expect(result.success).toBe(true);
      if (!result.success) throw new Error('Expected success');
      expect(result.data.status).toBe('IN_PROGRESS');
    });
  });

  describe('updateTutorialStep', () => {
    it('should update current step', async () => {
      await startTutorial(testUserId, mockTutorial);

      const result = await updateTutorialStep(testUserId, mockTutorial.id, 1);

      expect(result.success).toBe(true);
      if (!result.success) throw new Error('Expected success');
      expect(result.data.current_step).toBe(1);
    });

    it('should return error when progress does not exist', async () => {
      const result = await updateTutorialStep(testUserId, 'nonexistent', 1);

      expect(result.success).toBe(false);
      expect((result as any).error.code).toBe('NOT_FOUND');
    });
  });

  describe('completeTutorial', () => {
    it('should mark tutorial as completed', async () => {
      await startTutorial(testUserId, mockTutorial);

      const result = await completeTutorial(testUserId, mockTutorial.id);

      expect(result.success).toBe(true);
      if (!result.success) throw new Error('Expected success');
      expect(result.data.status).toBe('COMPLETED');
      expect(result.data.completed_at).toBeDefined();
      expect(result.data.current_step).toBe(mockTutorial.steps.length);
    });

    it('should save badge data', async () => {
      await startTutorial(testUserId, mockTutorial);

      const badge = {
        id: 'badge-1',
        name: 'First Tutorial',
        icon: '🎓',
        earned_at: Date.now(),
      };

      const result = await completeTutorial(testUserId, mockTutorial.id, badge);

      expect(result.success).toBe(true);
      if (!result.success) throw new Error('Expected success');
      expect(result.data.badge_data).toEqual(badge);
    });

    it('should return error when progress does not exist', async () => {
      const result = await completeTutorial(testUserId, 'nonexistent');

      expect(result.success).toBe(false);
      expect((result as any).error.code).toBe('NOT_FOUND');
    });
  });

  describe('skipTutorial', () => {
    it('should mark tutorial as skipped', async () => {
      await startTutorial(testUserId, mockTutorial);

      const result = await skipTutorial(testUserId, mockTutorial.id, false);

      expect(result.success).toBe(true);
      if (!result.success) throw new Error('Expected success');
      expect(result.data.status).toBe('SKIPPED');
      expect(result.data.dont_show_again).toBe(false);
    });

    it('should mark as dismissed when dontShowAgain is true', async () => {
      await startTutorial(testUserId, mockTutorial);

      const result = await skipTutorial(testUserId, mockTutorial.id, true);

      expect(result.success).toBe(true);
      if (!result.success) throw new Error('Expected success');
      expect(result.data.status).toBe('DISMISSED');
      expect(result.data.dont_show_again).toBe(true);
    });

    it('should create progress if none exists', async () => {
      const result = await skipTutorial(testUserId, mockTutorial.id, false);

      expect(result.success).toBe(true);
      if (!result.success) throw new Error('Expected success');
      expect(result.data.status).toBe('SKIPPED');
    });
  });

  describe('resetTutorialProgress', () => {
    it('should soft delete progress', async () => {
      await startTutorial(testUserId, mockTutorial);

      const result = await resetTutorialProgress(testUserId, mockTutorial.id);

      expect(result.success).toBe(true);

      // Verify it's deleted
      const progressResult = await getTutorialProgress(testUserId, mockTutorial.id);
      expect((progressResult as any).data).toBeNull();
    });

    it('should succeed when no progress exists', async () => {
      const result = await resetTutorialProgress(testUserId, 'nonexistent');

      expect(result.success).toBe(true);
    });
  });

  describe('shouldShowTutorial', () => {
    it('should return true when no progress exists', async () => {
      const result = await shouldShowTutorial(testUserId, mockTutorial.id);

      expect(result.success).toBe(true);
      expect((result as any).data).toBe(true);
    });

    it('should return false when dismissed', async () => {
      await skipTutorial(testUserId, mockTutorial.id, true);

      const result = await shouldShowTutorial(testUserId, mockTutorial.id);

      expect(result.success).toBe(true);
      expect((result as any).data).toBe(false);
    });

    it('should return false when completed', async () => {
      await startTutorial(testUserId, mockTutorial);
      await completeTutorial(testUserId, mockTutorial.id);

      const result = await shouldShowTutorial(testUserId, mockTutorial.id);

      expect(result.success).toBe(true);
      expect((result as any).data).toBe(false);
    });

    it('should return true when in progress', async () => {
      await startTutorial(testUserId, mockTutorial);

      const result = await shouldShowTutorial(testUserId, mockTutorial.id);

      expect(result.success).toBe(true);
      expect((result as any).data).toBe(true);
    });

    it('should return true when skipped (can retry)', async () => {
      await skipTutorial(testUserId, mockTutorial.id, false);

      const result = await shouldShowTutorial(testUserId, mockTutorial.id);

      expect(result.success).toBe(true);
      expect((result as any).data).toBe(true);
    });
  });

  describe('getTutorialStats', () => {
    it('should return correct statistics', async () => {
      const tutorials = [mockTutorial];

      // Start one tutorial
      await startTutorial(testUserId, mockTutorial);

      const result = await getTutorialStats(testUserId, tutorials);

      expect(result.success).toBe(true);
      expect((result as any).data).toBeDefined();
      expect((result as any).data.total).toBe(1);
      expect((result as any).data.inProgress).toBe(1);
      expect((result as any).data.completed).toBe(0);
      expect((result as any).data.skipped).toBe(0);
      expect((result as any).data.dismissed).toBe(0);
      expect((result as any).data.completionRate).toBe(0);
    });

    it('should calculate completion rate correctly', async () => {
      const tutorial2: TutorialDefinition = {
        ...mockTutorial,
        id: 'test-tutorial-2',
      };
      const tutorials = [mockTutorial, tutorial2];

      // Complete one tutorial
      await startTutorial(testUserId, mockTutorial);
      await completeTutorial(testUserId, mockTutorial.id);

      const result = await getTutorialStats(testUserId, tutorials);

      expect(result.success).toBe(true);
      expect((result as any).data.completed).toBe(1);
      expect((result as any).data.completionRate).toBe(50); // 1 out of 2
    });

    it('should return available tutorials', async () => {
      const tutorial2: TutorialDefinition = {
        ...mockTutorial,
        id: 'test-tutorial-2',
      };
      const tutorials = [mockTutorial, tutorial2];

      // Start only first tutorial
      await startTutorial(testUserId, mockTutorial);

      const result = await getTutorialStats(testUserId, tutorials);

      expect(result.success).toBe(true);
      expect((result as any).data.available).toHaveLength(1);
      expect((result as any).data.available[0].id).toBe('test-tutorial-2');
    });
  });

  describe('getEarnedBadges', () => {
    it('should return empty array when no badges earned', async () => {
      const result = await getEarnedBadges(testUserId);

      expect(result.success).toBe(true);
      expect((result as any).data).toEqual([]);
    });

    it('should return earned badges', async () => {
      await startTutorial(testUserId, mockTutorial);

      const badge = {
        id: 'badge-1',
        name: 'First Tutorial',
        icon: '🎓',
        earned_at: Date.now(),
      };

      await completeTutorial(testUserId, mockTutorial.id, badge);

      const result = await getEarnedBadges(testUserId);

      expect(result.success).toBe(true);
      expect((result as any).data).toHaveLength(1);
      expect((result as any).data[0]).toEqual(badge);
    });

    it('should sort badges by earned date', async () => {
      const tutorial2: TutorialDefinition = {
        ...mockTutorial,
        id: 'test-tutorial-2',
      };

      const badge1 = {
        id: 'badge-1',
        name: 'Badge 1',
        icon: '🎓',
        earned_at: Date.now(),
      };

      const badge2 = {
        id: 'badge-2',
        name: 'Badge 2',
        icon: '🏆',
        earned_at: Date.now() + 1000,
      };

      await startTutorial(testUserId, mockTutorial);
      await completeTutorial(testUserId, mockTutorial.id, badge1);

      await startTutorial(testUserId, tutorial2);
      await completeTutorial(testUserId, tutorial2.id, badge2);

      const result = await getEarnedBadges(testUserId);

      expect(result.success).toBe(true);
      expect((result as any).data).toHaveLength(2);
      // Most recent first
      expect((result as any).data[0].id).toBe('badge-2');
      expect((result as any).data[1].id).toBe('badge-1');
    });
  });
});
