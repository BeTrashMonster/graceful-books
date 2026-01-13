/**
 * DISC Profiles Data Access Layer
 *
 * Provides CRUD operations for DISC personality profiles with:
 * - Encryption/decryption integration points
 * - CRDT version vector management
 * - Soft delete with tombstone markers
 * - Profile history tracking
 */

import { nanoid } from 'nanoid';
import { db } from './database';
import type { DatabaseResult, EncryptionContext, VersionVector } from './types';
import type {
  DISCProfile,
  DISCScores,
  DISCType,
} from '../db/schema/discProfile.schema';
import {
  createDefaultDISCProfile,
  validateDISCProfile,
} from '../db/schema/discProfile.schema';

/**
 * Generate current device ID (stored in localStorage)
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
 * Initialize version vector for a new entity
 */

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
 * Create a new DISC profile
 */
export async function createDISCProfile(
  userId: string,
  scores: DISCScores,
  answers: number[],
  context?: EncryptionContext
): Promise<DatabaseResult<DISCProfile>> {
  try {
    const deviceId = getDeviceId();

    // Create entity with CRDT fields
    let profile: DISCProfile = {
      id: nanoid(),
      ...createDefaultDISCProfile(userId, scores, answers, deviceId),
    } as DISCProfile;

    // Validate profile
    const errors = validateDISCProfile(profile);
    if (errors.length > 0) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Validation failed: ${errors.join(', ')}`,
        },
      };
    }

    // Apply encryption if service provided
    if (context?.encryptionService) {
      const { encryptionService } = context;
      profile = {
        ...profile,
        scores: JSON.parse(
          await encryptionService.encrypt(JSON.stringify(profile.scores))
        ) as DISCScores,
        answers: JSON.parse(
          await encryptionService.encrypt(JSON.stringify(profile.answers))
        ) as number[],
      };
    }

    // Store in database
    await db.discProfiles.add(profile);

    return { success: true, data: profile };
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
 * Get DISC profile by ID
 */
export async function getDISCProfile(
  id: string,
  context?: EncryptionContext
): Promise<DatabaseResult<DISCProfile>> {
  try {
    const profile = await db.discProfiles.get(id);

    if (!profile) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `DISC profile not found: ${id}`,
        },
      };
    }

    // Check if soft deleted
    if (profile.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `DISC profile has been deleted: ${id}`,
        },
      };
    }

    // Decrypt if service provided
    let result = profile;
    if (context?.encryptionService) {
      const { encryptionService } = context;
      result = {
        ...profile,
        scores: JSON.parse(
          await encryptionService.decrypt(JSON.stringify(profile.scores))
        ) as DISCScores,
        answers: JSON.parse(
          await encryptionService.decrypt(JSON.stringify(profile.answers))
        ) as number[],
      };
    }

    return { success: true, data: result };
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
 * Get the most recent DISC profile for a user
 */
export async function getUserDISCProfile(
  userId: string,
  context?: EncryptionContext
): Promise<DatabaseResult<DISCProfile>> {
  try {
    const profiles = await db.discProfiles
      .where('user_id')
      .equals(userId)
      .and((p) => !p.deleted_at)
      .sortBy('assessment_date');

    if (profiles.length === 0) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'No DISC profile found for this user',
        },
      };
    }

    // Get most recent profile
    const profile = profiles[profiles.length - 1]!;

    // Decrypt if service provided
    let result = profile;
    if (context?.encryptionService) {
      const { encryptionService } = context;
      result = {
        ...profile,
        scores: JSON.parse(
          await encryptionService.decrypt(JSON.stringify(profile.scores))
        ) as DISCScores,
        answers: JSON.parse(
          await encryptionService.decrypt(JSON.stringify(profile.answers))
        ) as number[],
      };
    }

    return { success: true, data: result };
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
 * Get all DISC profiles for a user (history)
 */
export async function getUserDISCProfileHistory(
  userId: string,
  includeDeleted: boolean = false,
  context?: EncryptionContext
): Promise<DatabaseResult<DISCProfile[]>> {
  try {
    let query = db.discProfiles.where('user_id').equals(userId);

    if (!includeDeleted) {
      query = query.and((p) => !p.deleted_at);
    }

    const profiles = await query.sortBy('assessment_date');

    // Decrypt if service provided
    let results = profiles;
    if (context?.encryptionService) {
      const { encryptionService } = context;
      results = await Promise.all(
        profiles.map(async (profile) => ({
          ...profile,
          scores: JSON.parse(
            await encryptionService.decrypt(JSON.stringify(profile.scores))
          ) as DISCScores,
          answers: JSON.parse(
            await encryptionService.decrypt(JSON.stringify(profile.answers))
          ) as number[],
        }))
      );
    }

    return { success: true, data: results };
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
 * Update a DISC profile (mainly for soft delete)
 */
export async function updateDISCProfile(
  id: string,
  updates: Partial<Omit<DISCProfile, 'id' | 'user_id' | 'created_at'>>,
  context?: EncryptionContext
): Promise<DatabaseResult<DISCProfile>> {
  try {
    const existing = await db.discProfiles.get(id);

    if (!existing) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `DISC profile not found: ${id}`,
        },
      };
    }

    if (existing.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `DISC profile has been deleted: ${id}`,
        },
      };
    }

    // Prepare updated entity
    const now = Date.now();

    let updated: DISCProfile = {
      ...existing,
      ...updates,
      id, // Ensure ID doesn't change
      user_id: existing.user_id, // Ensure user_id doesn't change
      created_at: existing.created_at, // Preserve creation date
      updated_at: now,
      version_vector: incrementVersionVector(existing.version_vector),
    };

    // Apply encryption if service provided
    if (context?.encryptionService) {
      const { encryptionService } = context;
      if (updates.scores) {
        updated.scores = JSON.parse(
          await encryptionService.encrypt(JSON.stringify(updates.scores))
        ) as DISCScores;
      }
      if (updates.answers) {
        updated.answers = JSON.parse(
          await encryptionService.encrypt(JSON.stringify(updates.answers))
        ) as number[];
      }
    }

    // Update in database
    await db.discProfiles.put(updated);

    // Decrypt for return
    let result = updated;
    if (context?.encryptionService) {
      const { encryptionService } = context;
      result = {
        ...updated,
        scores: JSON.parse(
          await encryptionService.decrypt(JSON.stringify(updated.scores))
        ) as DISCScores,
        answers: JSON.parse(
          await encryptionService.decrypt(JSON.stringify(updated.answers))
        ) as number[],
      };
    }

    return { success: true, data: result };
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
 * Delete a DISC profile (soft delete with tombstone)
 */
export async function deleteDISCProfile(
  id: string
): Promise<DatabaseResult<void>> {
  try {
    const existing = await db.discProfiles.get(id);

    if (!existing) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `DISC profile not found: ${id}`,
        },
      };
    }

    if (existing.deleted_at) {
      return { success: true, data: undefined }; // Already deleted
    }

    // Soft delete with tombstone marker
    const now = Date.now();

    await db.discProfiles.update(id, {
      deleted_at: now,
      version_vector: incrementVersionVector(existing.version_vector),
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
 * Get profiles by DISC type
 */
export async function getProfilesByType(
  type: DISCType,
  context?: EncryptionContext
): Promise<DatabaseResult<DISCProfile[]>> {
  try {
    const profiles = await db.discProfiles
      .where('primary_type')
      .equals(type)
      .and((p) => !p.deleted_at)
      .toArray();

    // Decrypt if service provided
    let results = profiles;
    if (context?.encryptionService) {
      const { encryptionService } = context;
      results = await Promise.all(
        profiles.map(async (profile) => ({
          ...profile,
          scores: JSON.parse(
            await encryptionService.decrypt(JSON.stringify(profile.scores))
          ) as DISCScores,
          answers: JSON.parse(
            await encryptionService.decrypt(JSON.stringify(profile.answers))
          ) as number[],
        }))
      );
    }

    return { success: true, data: results };
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
