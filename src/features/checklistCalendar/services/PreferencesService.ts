/**
 * Preferences Service
 *
 * Handles user preferences for the checklist calendar system.
 * Including view modes, calendar settings, and custom priority colors.
 *
 * Requirements:
 * - CK-B6: PreferencesService
 *
 * @see Roadmaps/ROADMAP_CHECKLIST_CALENDAR.md
 */

import { nanoid } from 'nanoid';
import { db } from '../../../db/database';
import type { DatabaseResult } from '../../../store/types';
import type {
  UserChecklistPreferences,
  TaskViewMode,
} from '../../../db/schema/checklistCalendar.schema';
import {
  createDefaultUserChecklistPreferences,
  DEFAULT_PRIORITY_COLORS,
} from '../../../db/schema/checklistCalendar.schema';
import { getDeviceId } from '../../../utils/device';
import { logger } from '../../../utils/logger';

const preferencesLogger = logger.child('PreferencesService');

// =============================================================================
// TYPES
// =============================================================================

/**
 * Input for updating preferences
 */
export interface UpdatePreferencesInput {
  viewMode?: TaskViewMode;
  defaultCalendarView?: 'month' | 'week' | 'agenda';
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  priorityColorHigh?: string;
  priorityColorMedium?: string;
  priorityColorLow?: string;
  emailReminders?: boolean;
  reminderTime?: string | null;
}

/**
 * Priority colors configuration
 */
export interface PriorityColors {
  high: string;
  medium: string;
  low: string;
}

// =============================================================================
// GET / CREATE PREFERENCES
// =============================================================================

/**
 * Get user preferences, creating defaults if they don't exist
 */
export async function getOrCreatePreferences(
  userId: string,
  companyId: string
): Promise<DatabaseResult<UserChecklistPreferences>> {
  try {
    // Try to find existing preferences
    const existing = await db.userChecklistPreferences
      .where('[user_id+company_id]')
      .equals([userId, companyId])
      .filter((p) => !p.deleted_at)
      .first();

    if (existing) {
      return {
        success: true,
        data: existing,
      };
    }

    // Create default preferences
    const deviceId = await getDeviceId();
    const id = nanoid();
    const now = Date.now();

    const preferences: UserChecklistPreferences = {
      id,
      user_id: userId,
      company_id: companyId,
      view_mode: 'incomplete',
      default_calendar_view: 'month',
      week_starts_on: 0, // Sunday
      priority_color_high: DEFAULT_PRIORITY_COLORS.high,
      priority_color_medium: DEFAULT_PRIORITY_COLORS.medium,
      priority_color_low: DEFAULT_PRIORITY_COLORS.low,
      email_reminders: false,
      reminder_time: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };

    await db.userChecklistPreferences.add(preferences);

    preferencesLogger.info('Created default preferences', {
      userId,
      companyId,
    });

    return {
      success: true,
      data: preferences,
    };
  } catch (error) {
    preferencesLogger.error('Failed to get or create preferences', {
      error,
      userId,
      companyId,
    });
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

/**
 * Get preferences for a user (returns null if not found)
 */
export async function getPreferences(
  userId: string,
  companyId: string
): Promise<DatabaseResult<UserChecklistPreferences | null>> {
  try {
    const preferences = await db.userChecklistPreferences
      .where('[user_id+company_id]')
      .equals([userId, companyId])
      .filter((p) => !p.deleted_at)
      .first();

    return {
      success: true,
      data: preferences ?? null,
    };
  } catch (error) {
    preferencesLogger.error('Failed to get preferences', {
      error,
      userId,
      companyId,
    });
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

// =============================================================================
// UPDATE PREFERENCES
// =============================================================================

/**
 * Update user preferences
 */
export async function updatePreferences(
  userId: string,
  companyId: string,
  input: UpdatePreferencesInput
): Promise<DatabaseResult<UserChecklistPreferences>> {
  try {
    // Get or create preferences
    const result = await getOrCreatePreferences(userId, companyId);
    if (!result.success) {
      return result;
    }

    const existing = result.data;
    const now = Date.now();

    const updated: UserChecklistPreferences = {
      ...existing,
      view_mode: input.viewMode ?? existing.view_mode,
      default_calendar_view:
        input.defaultCalendarView ?? existing.default_calendar_view,
      week_starts_on: input.weekStartsOn ?? existing.week_starts_on,
      priority_color_high:
        input.priorityColorHigh ?? existing.priority_color_high,
      priority_color_medium:
        input.priorityColorMedium ?? existing.priority_color_medium,
      priority_color_low: input.priorityColorLow ?? existing.priority_color_low,
      email_reminders: input.emailReminders ?? existing.email_reminders,
      reminder_time:
        input.reminderTime !== undefined
          ? input.reminderTime
          : existing.reminder_time,
      updated_at: now,
    };

    await db.userChecklistPreferences.put(updated);

    preferencesLogger.info('Preferences updated', { userId, companyId });

    return {
      success: true,
      data: updated,
    };
  } catch (error) {
    preferencesLogger.error('Failed to update preferences', {
      error,
      userId,
      companyId,
      input,
    });
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

// =============================================================================
// VIEW MODE
// =============================================================================

/**
 * Toggle view mode (all <-> incomplete)
 */
export async function toggleViewMode(
  userId: string,
  companyId: string
): Promise<DatabaseResult<TaskViewMode>> {
  try {
    const result = await getOrCreatePreferences(userId, companyId);
    if (result.success === false) {
      return { success: false, error: result.error };
    }

    const newMode: TaskViewMode =
      result.data.view_mode === 'all' ? 'incomplete' : 'all';

    const updateResult = await updatePreferences(userId, companyId, {
      viewMode: newMode,
    });

    if (updateResult.success === false) {
      return { success: false, error: updateResult.error };
    }

    return {
      success: true,
      data: newMode,
    };
  } catch (error) {
    preferencesLogger.error('Failed to toggle view mode', {
      error,
      userId,
      companyId,
    });
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

/**
 * Set view mode explicitly
 */
export async function setViewMode(
  userId: string,
  companyId: string,
  viewMode: TaskViewMode
): Promise<DatabaseResult<void>> {
  try {
    await updatePreferences(userId, companyId, { viewMode });

    return { success: true, data: undefined };
  } catch (error) {
    preferencesLogger.error('Failed to set view mode', {
      error,
      userId,
      companyId,
      viewMode,
    });
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

// =============================================================================
// PRIORITY COLORS
// =============================================================================

/**
 * Get priority colors for a user
 */
export async function getPriorityColors(
  userId: string,
  companyId: string
): Promise<DatabaseResult<PriorityColors>> {
  try {
    const result = await getOrCreatePreferences(userId, companyId);
    if (!result.success || !result.data) {
      // Return defaults if error
      return {
        success: true,
        data: DEFAULT_PRIORITY_COLORS,
      };
    }

    return {
      success: true,
      data: {
        high: result.data.priority_color_high,
        medium: result.data.priority_color_medium,
        low: result.data.priority_color_low,
      },
    };
  } catch (error) {
    preferencesLogger.error('Failed to get priority colors', {
      error,
      userId,
      companyId,
    });
    // Return defaults on error
    return {
      success: true,
      data: DEFAULT_PRIORITY_COLORS,
    };
  }
}

/**
 * Update priority colors
 */
export async function updatePriorityColors(
  userId: string,
  companyId: string,
  colors: Partial<PriorityColors>
): Promise<DatabaseResult<PriorityColors>> {
  try {
    const input: UpdatePreferencesInput = {};

    if (colors.high) {
      input.priorityColorHigh = colors.high;
    }
    if (colors.medium) {
      input.priorityColorMedium = colors.medium;
    }
    if (colors.low) {
      input.priorityColorLow = colors.low;
    }

    const result = await updatePreferences(userId, companyId, input);

    if (result.success === false) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      data: {
        high: result.data.priority_color_high,
        medium: result.data.priority_color_medium,
        low: result.data.priority_color_low,
      },
    };
  } catch (error) {
    preferencesLogger.error('Failed to update priority colors', {
      error,
      userId,
      companyId,
      colors,
    });
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

/**
 * Reset priority colors to defaults
 */
export async function resetPriorityColors(
  userId: string,
  companyId: string
): Promise<DatabaseResult<PriorityColors>> {
  try {
    const result = await updatePreferences(userId, companyId, {
      priorityColorHigh: DEFAULT_PRIORITY_COLORS.high,
      priorityColorMedium: DEFAULT_PRIORITY_COLORS.medium,
      priorityColorLow: DEFAULT_PRIORITY_COLORS.low,
    });

    if (result.success === false) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      data: DEFAULT_PRIORITY_COLORS,
    };
  } catch (error) {
    preferencesLogger.error('Failed to reset priority colors', {
      error,
      userId,
      companyId,
    });
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

// =============================================================================
// CALENDAR SETTINGS
// =============================================================================

/**
 * Set default calendar view
 */
export async function setDefaultCalendarView(
  userId: string,
  companyId: string,
  view: 'month' | 'week' | 'agenda'
): Promise<DatabaseResult<void>> {
  try {
    await updatePreferences(userId, companyId, { defaultCalendarView: view });

    return { success: true, data: undefined };
  } catch (error) {
    preferencesLogger.error('Failed to set default calendar view', {
      error,
      userId,
      companyId,
      view,
    });
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

/**
 * Set week start day
 */
export async function setWeekStartsOn(
  userId: string,
  companyId: string,
  day: 0 | 1 | 2 | 3 | 4 | 5 | 6
): Promise<DatabaseResult<void>> {
  try {
    await updatePreferences(userId, companyId, { weekStartsOn: day });

    return { success: true, data: undefined };
  } catch (error) {
    preferencesLogger.error('Failed to set week starts on', {
      error,
      userId,
      companyId,
      day,
    });
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

// =============================================================================
// REMINDER SETTINGS
// =============================================================================

/**
 * Enable or disable email reminders
 */
export async function setEmailReminders(
  userId: string,
  companyId: string,
  enabled: boolean,
  time?: string
): Promise<DatabaseResult<void>> {
  try {
    await updatePreferences(userId, companyId, {
      emailReminders: enabled,
      reminderTime: enabled ? time ?? '09:00' : null,
    });

    return { success: true, data: undefined };
  } catch (error) {
    preferencesLogger.error('Failed to set email reminders', {
      error,
      userId,
      companyId,
      enabled,
      time,
    });
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

// =============================================================================
// DELETE
// =============================================================================

/**
 * Delete user preferences (soft delete)
 */
export async function deletePreferences(
  userId: string,
  companyId: string
): Promise<DatabaseResult<void>> {
  try {
    const existing = await db.userChecklistPreferences
      .where('[user_id+company_id]')
      .equals([userId, companyId])
      .filter((p) => !p.deleted_at)
      .first();

    if (existing) {
      const now = Date.now();
      await db.userChecklistPreferences.update(existing.id, {
        deleted_at: now,
        updated_at: now,
      });

      preferencesLogger.info('Preferences deleted', { userId, companyId });
    }

    return { success: true, data: undefined };
  } catch (error) {
    preferencesLogger.error('Failed to delete preferences', {
      error,
      userId,
      companyId,
    });
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}
