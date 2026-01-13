/**
 * Tests for DISC Profiles Store
 *
 * Tests CRUD operations for DISC profiles
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
  createDISCProfile,
  getDISCProfile,
  getUserDISCProfile,
  getUserDISCProfileHistory,
  
  deleteDISCProfile,
  getProfilesByType,
} from './discProfiles';
import { DISCType } from '../db/schema/discProfile.schema';
import type { DISCScores } from '../db/schema/discProfile.schema';
import { db } from './database';

describe('DISC Profiles Store', () => {
  const TEST_USER_ID = 'test-user-123';
  const TEST_SCORES: DISCScores = {
    dominance: 75,
    influence: 60,
    steadiness: 45,
    conscientiousness: 55,
  };
  const TEST_ANSWERS = [3, 2, 1, 0, 3, 2, 1, 0, 3, 2, 1, 0, 3, 2, 1, 0];

  beforeEach(async () => {
    // Clear the database before each test
    await db.discProfiles.clear();
  });

  afterEach(async () => {
    // Clean up after each test
    await db.discProfiles.clear();
  });

  describe('createDISCProfile', () => {
    it('should create a new DISC profile', async () => {
      const result = await createDISCProfile(TEST_USER_ID, TEST_SCORES, TEST_ANSWERS);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeDefined();
        expect(result.data.user_id).toBe(TEST_USER_ID);
        expect(result.data.scores).toEqual(TEST_SCORES);
        expect(result.data.primary_type).toBe(DISCType.DOMINANCE); // Highest score
      }
    });

    it('should assign primary type based on highest score', async () => {
      const influenceScores: DISCScores = {
        dominance: 40,
        influence: 85,
        steadiness: 50,
        conscientiousness: 45,
      };

      const result = await createDISCProfile(TEST_USER_ID, influenceScores, TEST_ANSWERS);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.primary_type).toBe(DISCType.INFLUENCE);
      }
    });

    it('should assign secondary type if within 15 points of primary', async () => {
      const closeScores: DISCScores = {
        dominance: 75,
        influence: 70, // Within 15 points
        steadiness: 45,
        conscientiousness: 50,
      };

      const result = await createDISCProfile(TEST_USER_ID, closeScores, TEST_ANSWERS);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.primary_type).toBe(DISCType.DOMINANCE);
        expect(result.data.secondary_type).toBe(DISCType.INFLUENCE);
      }
    });

    it('should not assign secondary type if more than 15 points from primary', async () => {
      const separatedScores: DISCScores = {
        dominance: 75,
        influence: 50, // More than 15 points
        steadiness: 40,
        conscientiousness: 45,
      };

      const result = await createDISCProfile(TEST_USER_ID, separatedScores, TEST_ANSWERS);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.secondary_type).toBeNull();
      }
    });

    it('should validate scores are in valid range', async () => {
      const invalidScores: DISCScores = {
        dominance: 150, // Invalid - over 100
        influence: 60,
        steadiness: 45,
        conscientiousness: 55,
      };

      const result = await createDISCProfile(TEST_USER_ID, invalidScores, TEST_ANSWERS);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error?.code).toBe('VALIDATION_ERROR');
      }
    });

    it('should require answers array', async () => {
      const result = await createDISCProfile(TEST_USER_ID, TEST_SCORES, []);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error?.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('answers');
      }
    });

    it('should set timestamps correctly', async () => {
      const before = Date.now();
      const result = await createDISCProfile(TEST_USER_ID, TEST_SCORES, TEST_ANSWERS);
      const after = Date.now();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.created_at).toBeGreaterThanOrEqual(before);
        expect(result.data.created_at).toBeLessThanOrEqual(after);
        expect(result.data.assessment_date).toBeGreaterThanOrEqual(before);
        expect(result.data.assessment_date).toBeLessThanOrEqual(after);
      }
    });

    it('should set version vector', async () => {
      const result = await createDISCProfile(TEST_USER_ID, TEST_SCORES, TEST_ANSWERS);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.version_vector).toBeDefined();
        expect(Object.keys(result.data.version_vector || {}).length).toBeGreaterThan(0);
      }
    });
  });

  describe('getDISCProfile', () => {
    it('should get profile by ID', async () => {
      const created = await createDISCProfile(TEST_USER_ID, TEST_SCORES, TEST_ANSWERS);
      expect(created.success).toBe(true);

      if (!created.success) throw new Error('Failed to create profile');

      const result = await getDISCProfile(created.data.id);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(created.data.id);
        expect(result.data.user_id).toBe(TEST_USER_ID);
      }
    });

    it('should return error for non-existent profile', async () => {
      const result = await getDISCProfile('non-existent-id');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error?.code).toBe('NOT_FOUND');
      }
    });

    it('should return error for deleted profile', async () => {
      const created = await createDISCProfile(TEST_USER_ID, TEST_SCORES, TEST_ANSWERS);
      expect(created.success).toBe(true);

      if (!created.success) throw new Error('Failed to create profile');

      await deleteDISCProfile(created.data.id);

      const result = await getDISCProfile(created.data.id);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error?.code).toBe('NOT_FOUND');
      }
    });
  });

  describe('getUserDISCProfile', () => {
    it('should get most recent profile for user', async () => {
      // Create first profile
      const first = await createDISCProfile(TEST_USER_ID, TEST_SCORES, TEST_ANSWERS);
      expect(first.success).toBe(true);

      if (!first.success) throw new Error('Failed to create first profile');

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Create second profile (more recent)
      const second = await createDISCProfile(TEST_USER_ID, TEST_SCORES, TEST_ANSWERS);
      expect(second.success).toBe(true);

      if (!second.success) throw new Error('Failed to create second profile');

      const result = await getUserDISCProfile(TEST_USER_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(second.data.id); // Should get most recent
      }
    });

    it('should return error if no profile exists for user', async () => {
      const result = await getUserDISCProfile('user-with-no-profile');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error?.code).toBe('NOT_FOUND');
      }
    });

    it('should not return deleted profiles', async () => {
      const created = await createDISCProfile(TEST_USER_ID, TEST_SCORES, TEST_ANSWERS);
      expect(created.success).toBe(true);

      if (!created.success) throw new Error('Failed to create profile');

      await deleteDISCProfile(created.data.id);

      const result = await getUserDISCProfile(TEST_USER_ID);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error?.code).toBe('NOT_FOUND');
      }
    });
  });

  describe('getUserDISCProfileHistory', () => {
    it('should get all profiles for user', async () => {
      // Create multiple profiles
      await createDISCProfile(TEST_USER_ID, TEST_SCORES, TEST_ANSWERS);
      await new Promise((resolve) => setTimeout(resolve, 10));
      await createDISCProfile(TEST_USER_ID, TEST_SCORES, TEST_ANSWERS);
      await new Promise((resolve) => setTimeout(resolve, 10));
      await createDISCProfile(TEST_USER_ID, TEST_SCORES, TEST_ANSWERS);

      const result = await getUserDISCProfileHistory(TEST_USER_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBe(3);
      }
    });

    it('should return profiles in chronological order', async () => {
      // Create profiles with delays
      const first = await createDISCProfile(TEST_USER_ID, TEST_SCORES, TEST_ANSWERS);
      if (!first.success) throw new Error('Failed to create first profile');

      await new Promise((resolve) => setTimeout(resolve, 10));
      const second = await createDISCProfile(TEST_USER_ID, TEST_SCORES, TEST_ANSWERS);
      if (!second.success) throw new Error('Failed to create second profile');

      await new Promise((resolve) => setTimeout(resolve, 10));
      const third = await createDISCProfile(TEST_USER_ID, TEST_SCORES, TEST_ANSWERS);
      if (!third.success) throw new Error('Failed to create third profile');

      const result = await getUserDISCProfileHistory(TEST_USER_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data[0]?.id).toBe(first.data.id);
        expect(result.data[1]?.id).toBe(second.data.id);
        expect(result.data[2]?.id).toBe(third.data.id);
      }
    });

    it('should not include deleted profiles by default', async () => {
      const first = await createDISCProfile(TEST_USER_ID, TEST_SCORES, TEST_ANSWERS);
      if (!first.success) throw new Error('Failed to create first profile');

      const second = await createDISCProfile(TEST_USER_ID, TEST_SCORES, TEST_ANSWERS);
      if (!second.success) throw new Error('Failed to create second profile');

      await deleteDISCProfile(first.data.id);

      const result = await getUserDISCProfileHistory(TEST_USER_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBe(1);
        expect(result.data[0]?.id).toBe(second.data.id);
      }
    });

    it('should include deleted profiles when requested', async () => {
      const first = await createDISCProfile(TEST_USER_ID, TEST_SCORES, TEST_ANSWERS);
      if (!first.success) throw new Error('Failed to create first profile');

      const second = await createDISCProfile(TEST_USER_ID, TEST_SCORES, TEST_ANSWERS);
      if (!second.success) throw new Error('Failed to create second profile');

      await deleteDISCProfile(first.data.id);

      const result = await getUserDISCProfileHistory(TEST_USER_ID, true);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBe(2);
      }
    });

    it('should return empty array if no profiles exist', async () => {
      const result = await getUserDISCProfileHistory('user-with-no-profile');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBe(0);
      }
    });
  });

  describe('deleteDISCProfile', () => {
    it('should soft delete a profile', async () => {
      const created = await createDISCProfile(TEST_USER_ID, TEST_SCORES, TEST_ANSWERS);
      expect(created.success).toBe(true);

      if (!created.success) throw new Error('Failed to create profile');

      const result = await deleteDISCProfile(created.data.id);

      expect(result.success).toBe(true);

      // Profile should still exist in database but marked as deleted
      const profile = await db.discProfiles.get(created.data.id);
      expect(profile).toBeDefined();
      expect(profile?.deleted_at).not.toBeNull();
    });

    it('should return success for already deleted profile', async () => {
      const created = await createDISCProfile(TEST_USER_ID, TEST_SCORES, TEST_ANSWERS);
      expect(created.success).toBe(true);

      if (!created.success) throw new Error('Failed to create profile');

      await deleteDISCProfile(created.data.id);
      const result = await deleteDISCProfile(created.data.id); // Delete again

      expect(result.success).toBe(true);
    });

    it('should return error for non-existent profile', async () => {
      const result = await deleteDISCProfile('non-existent-id');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error?.code).toBe('NOT_FOUND');
      }
    });

    it('should update version vector on delete', async () => {
      const created = await createDISCProfile(TEST_USER_ID, TEST_SCORES, TEST_ANSWERS);
      expect(created.success).toBe(true);

      if (!created.success) throw new Error('Failed to create profile');

      const originalVersion = created.data.version_vector;

      await deleteDISCProfile(created.data.id);

      const profile = await db.discProfiles.get(created.data.id);
      expect(profile?.version_vector).not.toEqual(originalVersion);
    });
  });

  describe('getProfilesByType', () => {
    it('should get all profiles of a specific type', async () => {
      // Create profiles with different primary types
      const dScores: DISCScores = { dominance: 85, influence: 45, steadiness: 40, conscientiousness: 50 };
      const iScores: DISCScores = { dominance: 45, influence: 85, steadiness: 40, conscientiousness: 50 };

      await createDISCProfile('user1', dScores, TEST_ANSWERS);
      await createDISCProfile('user2', dScores, TEST_ANSWERS);
      await createDISCProfile('user3', iScores, TEST_ANSWERS);

      const result = await getProfilesByType(DISCType.DOMINANCE);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBe(2);
        expect(result.data.every((p) => p.primary_type === DISCType.DOMINANCE)).toBe(true);
      }
    });

    it('should not return deleted profiles', async () => {
      const dScores: DISCScores = { dominance: 85, influence: 45, steadiness: 40, conscientiousness: 50 };

      const first = await createDISCProfile('user1', dScores, TEST_ANSWERS);
      if (!first.success) throw new Error('Failed to create first profile');

      await createDISCProfile('user2', dScores, TEST_ANSWERS);

      await deleteDISCProfile(first.data.id);

      const result = await getProfilesByType(DISCType.DOMINANCE);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBe(1);
      }
    });

    it('should return empty array if no profiles of type exist', async () => {
      const result = await getProfilesByType(DISCType.STEADINESS);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBe(0);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle multiple users with profiles', async () => {
      await createDISCProfile('user1', TEST_SCORES, TEST_ANSWERS);
      await createDISCProfile('user2', TEST_SCORES, TEST_ANSWERS);
      await createDISCProfile('user3', TEST_SCORES, TEST_ANSWERS);

      const user1Profile = await getUserDISCProfile('user1');
      const user2Profile = await getUserDISCProfile('user2');

      expect(user1Profile.success).toBe(true);
      expect(user2Profile.success).toBe(true);
      if (user1Profile.success) {
        expect(user1Profile.data?.user_id).toBe('user1');
      }
      if (user2Profile.success) {
        expect(user2Profile.data?.user_id).toBe('user2');
      }
    });

    it('should handle extreme score values correctly', async () => {
      const extremeScores: DISCScores = {
        dominance: 100,
        influence: 0,
        steadiness: 50,
        conscientiousness: 25,
      };

      const result = await createDISCProfile(TEST_USER_ID, extremeScores, TEST_ANSWERS);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.primary_type).toBe(DISCType.DOMINANCE);
      }
    });

    it('should handle equal scores correctly', async () => {
      const equalScores: DISCScores = {
        dominance: 50,
        influence: 50,
        steadiness: 50,
        conscientiousness: 50,
      };

      const result = await createDISCProfile(TEST_USER_ID, equalScores, TEST_ANSWERS);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.primary_type).toBeDefined();
      }
    });
  });
});
