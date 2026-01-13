/**
 * Tutorial Progress Data Access Layer
 *
 * Provides CRUD operations for tutorial progress tracking with:
 * - Tutorial state management (started, completed, skipped, dismissed)
 * - Progress persistence and resumption
 * - "Don't show again" preferences
 * - Badge tracking for completion
 * - CRDT version vector management
 *
 * Requirements:
 * - D4: Tutorial System Framework
 * - LEARN-001: Contextual Tutorial System
 */

import { nanoid } from 'nanoid';
import { db } from './database';
import type { DatabaseResult } from './types';
import type {
  TutorialProgress,
  TutorialStats,
  TutorialBadge,
  TutorialDefinition,
} from '../types/tutorial.types';
import { TutorialStatus } from '../types/tutorial.types';
import type { VersionVector } from '../types/database.types';

/**
 * Generate device ID (stored in localStorage)
 */
function getDeviceId(): string {
  let deviceId = localStorage.getItem('deviceId');
  if (!deviceId) {
    deviceId = nanoid();
    localStorage.setItem('deviceId', deviceId);
  }
  return deviceId;
}

/**
 * Increment version vector for an update
 */
function incrementVersionVector(current: VersionVector): VersionVector {
  const deviceId = getDeviceId();
  return {
    ...current,
    [deviceId]: (current[deviceId] || 0) + 1,
  };
}

/**
 * Get tutorial progress for a specific user and tutorial
 *
 * @param userId - User ID
 * @param tutorialId - Tutorial ID
 * @returns Tutorial progress record or null if not found
 */
export async function getTutorialProgress(
  userId: string,
  tutorialId: string
): Promise<DatabaseResult<TutorialProgress | null>> {
  try {
    const progress = await db.tutorialProgress
      .where('[user_id+tutorial_id]')
      .equals([userId, tutorialId])
      .and((p) => !p.deleted_at)
      .first();

    return {
      success: true,
      data: progress || null,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}

/**
 * Get all tutorial progress for a user
 *
 * @param userId - User ID
 * @param status - Optional status filter
 * @returns Array of tutorial progress records
 */
export async function getAllTutorialProgress(
  userId: string,
  status?: TutorialStatus
): Promise<DatabaseResult<TutorialProgress[]>> {
  try {
    let collection = db.tutorialProgress.where('user_id').equals(userId);

    if (status) {
      collection = collection.and((p) => p.status === status);
    }

    const progress = await collection.and((p) => !p.deleted_at).toArray();

    return {
      success: true,
      data: progress,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}

/**
 * Start a tutorial for a user
 *
 * @param userId - User ID
 * @param tutorial - Tutorial definition
 * @returns Created tutorial progress record
 */
export async function startTutorial(
  userId: string,
  tutorial: TutorialDefinition
): Promise<DatabaseResult<TutorialProgress>> {
  try {
    // Check if progress already exists
    const existingResult = await getTutorialProgress(userId, tutorial.id);
    if (!existingResult.success) {
      return existingResult as DatabaseResult<never>;
    }

    const now = Date.now();
    const deviceId = getDeviceId();

    // If exists and not dismissed, resume instead
    if (existingResult.data && existingResult.data.status !== TutorialStatus.DISMISSED) {
      const updated = {
        ...existingResult.data,
        status: TutorialStatus.IN_PROGRESS,
        last_viewed_at: now,
        attempt_count: existingResult.data.attempt_count + 1,
        updated_at: now,
        version_vector: incrementVersionVector(existingResult.data.version_vector),
      };

      await db.tutorialProgress.put(updated);

      return {
        success: true,
        data: updated,
      };
    }

    // Create new progress record
    const progress: TutorialProgress = {
      id: nanoid(),
      user_id: userId,
      tutorial_id: tutorial.id,
      status: TutorialStatus.IN_PROGRESS,
      current_step: 0,
      total_steps: tutorial.steps.length,
      started_at: now,
      completed_at: null,
      last_viewed_at: now,
      attempt_count: 1,
      dont_show_again: false,
      badge_data: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version_vector: {
        [deviceId]: 1,
      },
    };

    await db.tutorialProgress.add(progress);

    return {
      success: true,
      data: progress,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}

/**
 * Update tutorial progress step
 *
 * @param userId - User ID
 * @param tutorialId - Tutorial ID
 * @param currentStep - Current step index
 * @returns Updated progress record
 */
export async function updateTutorialStep(
  userId: string,
  tutorialId: string,
  currentStep: number
): Promise<DatabaseResult<TutorialProgress>> {
  try {
    const progressResult = await getTutorialProgress(userId, tutorialId);
    if (!progressResult.success) {
      return progressResult as DatabaseResult<never>;
    }

    if (!progressResult.data) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Tutorial progress not found for user ${userId} and tutorial ${tutorialId}`,
        },
      };
    }

    const now = Date.now();
    const updated: TutorialProgress = {
      ...progressResult.data,
      current_step: currentStep,
      last_viewed_at: now,
      updated_at: now,
      version_vector: incrementVersionVector(progressResult.data.version_vector),
    };

    await db.tutorialProgress.put(updated);

    return {
      success: true,
      data: updated,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}

/**
 * Complete a tutorial
 *
 * @param userId - User ID
 * @param tutorialId - Tutorial ID
 * @param badge - Optional badge data for completion
 * @returns Updated progress record
 */
export async function completeTutorial(
  userId: string,
  tutorialId: string,
  badge?: TutorialBadge
): Promise<DatabaseResult<TutorialProgress>> {
  try {
    const progressResult = await getTutorialProgress(userId, tutorialId);
    if (!progressResult.success) {
      return progressResult as DatabaseResult<never>;
    }

    if (!progressResult.data) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Tutorial progress not found for user ${userId} and tutorial ${tutorialId}`,
        },
      };
    }

    const now = Date.now();
    const updated: TutorialProgress = {
      ...progressResult.data,
      status: TutorialStatus.COMPLETED,
      current_step: progressResult.data.total_steps,
      completed_at: now,
      last_viewed_at: now,
      badge_data: badge || null,
      updated_at: now,
      version_vector: incrementVersionVector(progressResult.data.version_vector),
    };

    await db.tutorialProgress.put(updated);

    return {
      success: true,
      data: updated,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}

/**
 * Skip a tutorial
 *
 * @param userId - User ID
 * @param tutorialId - Tutorial ID
 * @param dontShowAgain - Whether to mark as "don't show again"
 * @returns Updated progress record
 */
export async function skipTutorial(
  userId: string,
  tutorialId: string,
  dontShowAgain: boolean = false
): Promise<DatabaseResult<TutorialProgress>> {
  try {
    const progressResult = await getTutorialProgress(userId, tutorialId);
    if (!progressResult.success) {
      return progressResult as DatabaseResult<never>;
    }

    // If no progress exists, create one
    if (!progressResult.data) {
      const now = Date.now();
      const deviceId = getDeviceId();

      const progress: TutorialProgress = {
        id: nanoid(),
        user_id: userId,
        tutorial_id: tutorialId,
        status: dontShowAgain ? TutorialStatus.DISMISSED : TutorialStatus.SKIPPED,
        current_step: 0,
        total_steps: 0, // Unknown at this point
        started_at: null,
        completed_at: null,
        last_viewed_at: now,
        attempt_count: 0,
        dont_show_again: dontShowAgain,
        badge_data: null,
        created_at: now,
        updated_at: now,
        deleted_at: null,
        version_vector: {
          [deviceId]: 1,
        },
      };

      await db.tutorialProgress.add(progress);

      return {
        success: true,
        data: progress,
      };
    }

    const now = Date.now();
    const updated: TutorialProgress = {
      ...progressResult.data,
      status: dontShowAgain ? TutorialStatus.DISMISSED : TutorialStatus.SKIPPED,
      dont_show_again: dontShowAgain,
      last_viewed_at: now,
      updated_at: now,
      version_vector: incrementVersionVector(progressResult.data.version_vector),
    };

    await db.tutorialProgress.put(updated);

    return {
      success: true,
      data: updated,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}

/**
 * Reset tutorial progress (allows user to retry)
 *
 * @param userId - User ID
 * @param tutorialId - Tutorial ID
 * @returns Success result
 */
export async function resetTutorialProgress(
  userId: string,
  tutorialId: string
): Promise<DatabaseResult<void>> {
  try {
    const progressResult = await getTutorialProgress(userId, tutorialId);
    if (!progressResult.success) {
      return progressResult as DatabaseResult<never>;
    }

    if (!progressResult.data) {
      return { success: true, data: undefined };
    }

    const now = Date.now();
    await db.tutorialProgress.update(progressResult.data.id, {
      deleted_at: now,
      version_vector: incrementVersionVector(progressResult.data.version_vector),
      updated_at: now,
    });

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}

/**
 * Check if tutorial should be shown to user
 *
 * @param userId - User ID
 * @param tutorialId - Tutorial ID
 * @returns Whether tutorial should be shown
 */
export async function shouldShowTutorial(
  userId: string,
  tutorialId: string
): Promise<DatabaseResult<boolean>> {
  try {
    const progressResult = await getTutorialProgress(userId, tutorialId);
    if (!progressResult.success) {
      return progressResult as DatabaseResult<never>;
    }

    // Show if no progress exists
    if (!progressResult.data) {
      return { success: true, data: true };
    }

    // Don't show if user dismissed it
    if (progressResult.data.dont_show_again || progressResult.data.status === TutorialStatus.DISMISSED) {
      return { success: true, data: false };
    }

    // Don't show if completed
    if (progressResult.data.status === TutorialStatus.COMPLETED) {
      return { success: true, data: false };
    }

    // Show if in progress or skipped (can retry)
    return { success: true, data: true };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}

/**
 * Get tutorial statistics for a user
 *
 * @param userId - User ID
 * @param availableTutorials - List of all available tutorials
 * @returns Statistics summary
 */
export async function getTutorialStats(
  userId: string,
  availableTutorials: TutorialDefinition[]
): Promise<DatabaseResult<TutorialStats>> {
  try {
    const progressResult = await getAllTutorialProgress(userId);
    if (!progressResult.success) {
      return progressResult as DatabaseResult<never>;
    }

    const allProgress = progressResult.data;
    const total = availableTutorials.length;
    const completed = allProgress.filter((p) => p.status === 'COMPLETED').length;
    const inProgress = allProgress.filter((p) => p.status === 'IN_PROGRESS').length;
    const skipped = allProgress.filter((p) => p.status === 'SKIPPED').length;
    const dismissed = allProgress.filter((p) => p.status === 'DISMISSED').length;

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Get recently completed tutorials
    const recentlyCompleted = allProgress
      .filter((p) => p.status === 'COMPLETED' && p.completed_at)
      .sort((a, b) => (b.completed_at || 0) - (a.completed_at || 0))
      .slice(0, 5);

    // Get available tutorials not yet started
    const startedTutorialIds = new Set(allProgress.map((p) => p.tutorial_id));
    const available = availableTutorials.filter((t) => !startedTutorialIds.has(t.id));

    return {
      success: true,
      data: {
        total,
        completed,
        inProgress,
        skipped,
        dismissed,
        completionRate,
        recentlyCompleted,
        available,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}

/**
 * Get all earned badges for a user
 *
 * @param userId - User ID
 * @returns Array of earned badges
 */
export async function getEarnedBadges(
  userId: string
): Promise<DatabaseResult<TutorialBadge[]>> {
  try {
    const progressResult = await getAllTutorialProgress(userId, TutorialStatus.COMPLETED);
    if (!progressResult.success) {
      return progressResult as DatabaseResult<never>;
    }

    const badges = progressResult.data
      .map((p) => p.badge_data)
      .filter((badge): badge is TutorialBadge => badge !== null)
      .sort((a, b) => b.earned_at - a.earned_at);

    return {
      success: true,
      data: badges,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}
