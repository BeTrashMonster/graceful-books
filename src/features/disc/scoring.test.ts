/**
 * Tests for DISC Scoring Algorithm
 *
 * Tests the calculation of DISC scores from assessment answers
 */

import { describe, it, expect } from 'vitest';
import {
  calculateDISCScores,
  getScoreInterpretation,
  compareProfiles,
  exportScoringResult,
} from './scoring';
import type { DISCScores } from '../../db/schema/discProfile.schema';
import { DISC_QUESTIONS } from './questions';

describe('DISC Scoring Algorithm', () => {
  describe('calculateDISCScores', () => {
    it('should calculate scores for all strongly agree answers', () => {
      // All strongly agree (value 3)
      const answers = new Array(DISC_QUESTIONS.length).fill(3);
      const result = calculateDISCScores(answers);

      expect(result.scores).toBeDefined();
      expect(result.scores.dominance).toBeGreaterThanOrEqual(0);
      expect(result.scores.dominance).toBeLessThanOrEqual(100);
      expect(result.scores.influence).toBeGreaterThanOrEqual(0);
      expect(result.scores.influence).toBeLessThanOrEqual(100);
      expect(result.scores.steadiness).toBeGreaterThanOrEqual(0);
      expect(result.scores.steadiness).toBeLessThanOrEqual(100);
      expect(result.scores.conscientiousness).toBeGreaterThanOrEqual(0);
      expect(result.scores.conscientiousness).toBeLessThanOrEqual(100);
    });

    it('should calculate scores for all strongly disagree answers', () => {
      // All strongly disagree (value 0)
      const answers = new Array(DISC_QUESTIONS.length).fill(0);
      const result = calculateDISCScores(answers);

      expect(result.scores).toBeDefined();
      expect(result.scores.dominance).toBeGreaterThanOrEqual(0);
      expect(result.scores.dominance).toBeLessThanOrEqual(100);
      expect(result.scores.influence).toBeGreaterThanOrEqual(0);
      expect(result.scores.influence).toBeLessThanOrEqual(100);
      expect(result.scores.steadiness).toBeGreaterThanOrEqual(0);
      expect(result.scores.steadiness).toBeLessThanOrEqual(100);
      expect(result.scores.conscientiousness).toBeGreaterThanOrEqual(0);
      expect(result.scores.conscientiousness).toBeLessThanOrEqual(100);
    });

    it('should calculate scores for mixed answers', () => {
      // Mixed answers pattern
      const answers = [3, 0, 2, 1, 3, 1, 2, 0, 3, 2, 1, 0, 3, 2, 1, 2];
      const result = calculateDISCScores(answers);

      expect(result.scores).toBeDefined();
      expect(result.rawScores).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(100);
    });

    it('should throw error for invalid answers length', () => {
      const answers = [3, 0, 2]; // Too few answers
      expect(() => calculateDISCScores(answers)).toThrow('Invalid answers length');
    });

    it('should throw error for invalid answer value', () => {
      const answers = new Array(DISC_QUESTIONS.length).fill(3);
      answers[5] = 5; // Invalid value
      expect(() => calculateDISCScores(answers)).toThrow('Invalid answer value');
    });

    it('should produce different scores for dominant vs influential answers', () => {
      // Pattern favoring Dominance
      const dominantAnswers = DISC_QUESTIONS.map((q) => {
        // Answer based on D weight
        return q.weights.D > 0.5 ? 3 : 0;
      });

      // Pattern favoring Influence
      const influentialAnswers = DISC_QUESTIONS.map((q) => {
        // Answer based on I weight
        return q.weights.I > 0.5 ? 3 : 0;
      });

      const dominantResult = calculateDISCScores(dominantAnswers);
      const influentialResult = calculateDISCScores(influentialAnswers);

      // Dominant profile should have higher D score
      expect(dominantResult.scores.dominance).toBeGreaterThan(
        influentialResult.scores.dominance
      );
      // Influential profile should have higher I score
      expect(influentialResult.scores.influence).toBeGreaterThan(
        dominantResult.scores.influence
      );
    });

    it('should calculate confidence based on answer extremity', () => {
      // All extreme answers (0 or 3)
      const extremeAnswers = new Array(DISC_QUESTIONS.length).fill(0).map((_, i) =>
        i % 2 === 0 ? 0 : 3
      );
      const extremeResult = calculateDISCScores(extremeAnswers);

      // All moderate answers (1 or 2)
      const moderateAnswers = new Array(DISC_QUESTIONS.length).fill(0).map((_, i) =>
        i % 2 === 0 ? 1 : 2
      );
      const moderateResult = calculateDISCScores(moderateAnswers);

      // Extreme answers should have higher confidence
      expect(extremeResult.confidence).toBeGreaterThan(moderateResult.confidence);
    });

    it('should normalize scores consistently', () => {
      const answers = [3, 2, 1, 0, 3, 2, 1, 0, 3, 2, 1, 0, 3, 2, 1, 0];
      const result = calculateDISCScores(answers);

      // All scores should be integers
      expect(Number.isInteger(result.scores.dominance)).toBe(true);
      expect(Number.isInteger(result.scores.influence)).toBe(true);
      expect(Number.isInteger(result.scores.steadiness)).toBe(true);
      expect(Number.isInteger(result.scores.conscientiousness)).toBe(true);

      // All scores should be in valid range
      expect(result.scores.dominance).toBeGreaterThanOrEqual(0);
      expect(result.scores.dominance).toBeLessThanOrEqual(100);
      expect(result.scores.influence).toBeGreaterThanOrEqual(0);
      expect(result.scores.influence).toBeLessThanOrEqual(100);
      expect(result.scores.steadiness).toBeGreaterThanOrEqual(0);
      expect(result.scores.steadiness).toBeLessThanOrEqual(100);
      expect(result.scores.conscientiousness).toBeGreaterThanOrEqual(0);
      expect(result.scores.conscientiousness).toBeLessThanOrEqual(100);
    });
  });

  describe('getScoreInterpretation', () => {
    it('should return correct interpretation for very high scores', () => {
      expect(getScoreInterpretation(85)).toBe('Very High');
      expect(getScoreInterpretation(70)).toBe('Very High');
    });

    it('should return correct interpretation for high scores', () => {
      expect(getScoreInterpretation(65)).toBe('High');
      expect(getScoreInterpretation(55)).toBe('High');
    });

    it('should return correct interpretation for moderate scores', () => {
      expect(getScoreInterpretation(50)).toBe('Moderate');
      expect(getScoreInterpretation(45)).toBe('Moderate');
    });

    it('should return correct interpretation for low scores', () => {
      expect(getScoreInterpretation(40)).toBe('Low');
      expect(getScoreInterpretation(30)).toBe('Low');
    });

    it('should return correct interpretation for very low scores', () => {
      expect(getScoreInterpretation(25)).toBe('Very Low');
      expect(getScoreInterpretation(10)).toBe('Very Low');
    });

    it('should handle edge cases', () => {
      expect(getScoreInterpretation(0)).toBe('Very Low');
      expect(getScoreInterpretation(100)).toBe('Very High');
    });
  });

  describe('compareProfiles', () => {
    it('should return 100 for identical profiles', () => {
      const profile1: DISCScores = {
        dominance: 75,
        influence: 60,
        steadiness: 45,
        conscientiousness: 55,
      };
      const profile2: DISCScores = {
        dominance: 75,
        influence: 60,
        steadiness: 45,
        conscientiousness: 55,
      };

      const similarity = compareProfiles(profile1, profile2);
      expect(similarity).toBe(100);
    });

    it('should return 0 for completely opposite profiles', () => {
      const profile1: DISCScores = {
        dominance: 100,
        influence: 100,
        steadiness: 100,
        conscientiousness: 100,
      };
      const profile2: DISCScores = {
        dominance: 0,
        influence: 0,
        steadiness: 0,
        conscientiousness: 0,
      };

      const similarity = compareProfiles(profile1, profile2);
      expect(similarity).toBe(0);
    });

    it('should return similarity score for similar profiles', () => {
      const profile1: DISCScores = {
        dominance: 75,
        influence: 60,
        steadiness: 45,
        conscientiousness: 55,
      };
      const profile2: DISCScores = {
        dominance: 70,
        influence: 65,
        steadiness: 50,
        conscientiousness: 60,
      };

      const similarity = compareProfiles(profile1, profile2);
      expect(similarity).toBeGreaterThan(80); // Should be quite similar
      expect(similarity).toBeLessThan(100);
    });

    it('should return low similarity for different profiles', () => {
      const profile1: DISCScores = {
        dominance: 90,
        influence: 20,
        steadiness: 30,
        conscientiousness: 75,
      };
      const profile2: DISCScores = {
        dominance: 25,
        influence: 85,
        steadiness: 80,
        conscientiousness: 35,
      };

      const similarity = compareProfiles(profile1, profile2);
      expect(similarity).toBeLessThan(50); // Should be quite different
    });

    it('should be commutative', () => {
      const profile1: DISCScores = {
        dominance: 60,
        influence: 70,
        steadiness: 50,
        conscientiousness: 65,
      };
      const profile2: DISCScores = {
        dominance: 55,
        influence: 75,
        steadiness: 45,
        conscientiousness: 70,
      };

      const similarity1 = compareProfiles(profile1, profile2);
      const similarity2 = compareProfiles(profile2, profile1);

      expect(similarity1).toBe(similarity2);
    });
  });

  describe('exportScoringResult', () => {
    it('should export scoring result correctly', () => {
      const answers = new Array(DISC_QUESTIONS.length).fill(2);
      const result = calculateDISCScores(answers);

      const exported = exportScoringResult(result);

      expect(exported.scores).toBeDefined();
      expect(exported.confidence).toBeDefined();
      expect(exported.scores).toEqual(result.scores);
      expect(exported.confidence).toBe(result.confidence);
    });

    it('should not include rawScores in export', () => {
      const answers = new Array(DISC_QUESTIONS.length).fill(2);
      const result = calculateDISCScores(answers);

      const exported = exportScoringResult(result);

      expect(exported).not.toHaveProperty('rawScores');
    });
  });

  describe('edge cases and validation', () => {
    it('should handle all questions with same answer', () => {
      for (let value = 0; value <= 3; value++) {
        const answers = new Array(DISC_QUESTIONS.length).fill(value);
        const result = calculateDISCScores(answers);

        expect(result.scores).toBeDefined();
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(100);
      }
    });

    it('should handle alternating pattern answers', () => {
      const answers = new Array(DISC_QUESTIONS.length)
        .fill(0)
        .map((_, i) => (i % 2 === 0 ? 0 : 3));
      const result = calculateDISCScores(answers);

      expect(result.scores).toBeDefined();
      expect(result.rawScores).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should produce consistent results for same answers', () => {
      const answers = [3, 1, 2, 0, 3, 2, 1, 0, 3, 1, 2, 0, 3, 2, 1, 0];

      const result1 = calculateDISCScores(answers);
      const result2 = calculateDISCScores([...answers]); // Copy array

      expect(result1.scores).toEqual(result2.scores);
      expect(result1.confidence).toBe(result2.confidence);
    });

    it('should handle negative weights correctly', () => {
      // Some questions have negative weights for certain dimensions
      const answers = new Array(DISC_QUESTIONS.length).fill(3);
      const result = calculateDISCScores(answers);

      // Should still produce valid scores despite negative weights
      expect(result.scores.dominance).toBeGreaterThanOrEqual(0);
      expect(result.scores.influence).toBeGreaterThanOrEqual(0);
      expect(result.scores.steadiness).toBeGreaterThanOrEqual(0);
      expect(result.scores.conscientiousness).toBeGreaterThanOrEqual(0);
    });
  });

  describe('confidence calculation', () => {
    it('should give high confidence for clear dominant profile', () => {
      // Strongly agree with all D questions, disagree with others
      const answers = DISC_QUESTIONS.map((q) => (q.weights.D > 0.5 ? 3 : 0));
      const result = calculateDISCScores(answers);

      expect(result.confidence).toBeGreaterThan(60);
    });

    it('should give low confidence for all neutral answers', () => {
      const answers = new Array(DISC_QUESTIONS.length).fill(1.5).map(() => 1); // All neutral
      const result = calculateDISCScores(answers);

      expect(result.confidence).toBeLessThan(50);
    });

    it('should give moderate confidence for mixed but consistent answers', () => {
      const answers = new Array(DISC_QUESTIONS.length)
        .fill(0)
        .map((_, i) => (i % 4 < 2 ? 2 : 1));
      const result = calculateDISCScores(answers);

      expect(result.confidence).toBeGreaterThan(20);
      expect(result.confidence).toBeLessThan(80);
    });
  });
});
