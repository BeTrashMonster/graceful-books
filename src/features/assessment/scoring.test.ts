/**
 * Scoring Algorithm Tests
 *
 * Tests for assessment scoring calculations.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateRawScores,
  normalizeScores,
  calculateConfidence,
  getScoreInterpretation,
  getPhaseName,
  getPhaseDescription,
  getLiteracyLevelName,
  getLiteracyLevelDescription,
} from './scoring';
import type { AssessmentAnswer } from './types';
import {
  BusinessPhase,
  FinancialLiteracyLevel,
  RevenueRange,
} from './types';

describe('Scoring', () => {
  describe('calculateRawScores', () => {
    it('should calculate scores for stabilize phase indicators', () => {
      const answers = new Map<string, AssessmentAnswer>([
        [
          'revenue_range',
          {
            questionId: 'revenue_range',
            value: RevenueRange.ZERO_TO_25K,
            answeredAt: Date.now(),
          },
        ],
        [
          'knows_current_cash',
          { questionId: 'knows_current_cash', value: 'no_idea', answeredAt: Date.now() },
        ],
        [
          'tracks_expenses',
          { questionId: 'tracks_expenses', value: 'none', answeredAt: Date.now() },
        ],
        [
          'reconciles_bank',
          { questionId: 'reconciles_bank', value: 'never', answeredAt: Date.now() },
        ],
      ]);

      const scores = calculateRawScores(answers);

      // Should have higher stabilize scores due to beginner-level answers
      expect(scores.phaseScores[BusinessPhase.STABILIZE]).toBeGreaterThan(0);
      expect(scores.literacyScores[FinancialLiteracyLevel.BEGINNER]).toBeGreaterThan(0);
    });

    it('should calculate scores for advanced phase indicators', () => {
      const answers = new Map<string, AssessmentAnswer>([
        [
          'revenue_range',
          {
            questionId: 'revenue_range',
            value: RevenueRange.OVER_1M,
            answeredAt: Date.now(),
          },
        ],
        [
          'has_employees',
          { questionId: 'has_employees', value: 'yes', answeredAt: Date.now() },
        ],
        [
          'bookkeeping_time',
          { questionId: 'bookkeeping_time', value: 'many_hours', answeredAt: Date.now() },
        ],
      ]);

      const scores = calculateRawScores(answers);

      // Should have higher grow/build scores
      expect(
        scores.phaseScores[BusinessPhase.BUILD] + scores.phaseScores[BusinessPhase.GROW]
      ).toBeGreaterThan(0);
    });

    it('should handle empty answers', () => {
      const answers = new Map<string, AssessmentAnswer>();
      const scores = calculateRawScores(answers);

      // All scores should be 0
      expect(scores.phaseScores[BusinessPhase.STABILIZE]).toBe(0);
      expect(scores.phaseScores[BusinessPhase.ORGANIZE]).toBe(0);
      expect(scores.phaseScores[BusinessPhase.BUILD]).toBe(0);
      expect(scores.phaseScores[BusinessPhase.GROW]).toBe(0);
      expect(scores.literacyScores[FinancialLiteracyLevel.BEGINNER]).toBe(0);
      expect(scores.literacyScores[FinancialLiteracyLevel.INTERMEDIATE]).toBe(0);
      expect(scores.literacyScores[FinancialLiteracyLevel.ADVANCED]).toBe(0);
    });
  });

  describe('normalizeScores', () => {
    it('should normalize scores to 0-100 range', () => {
      const rawScores = {
        phaseScores: {
          [BusinessPhase.STABILIZE]: 10,
          [BusinessPhase.ORGANIZE]: 5,
          [BusinessPhase.BUILD]: 2,
          [BusinessPhase.GROW]: 1,
        },
        literacyScores: {
          [FinancialLiteracyLevel.BEGINNER]: 8,
          [FinancialLiteracyLevel.INTERMEDIATE]: 4,
          [FinancialLiteracyLevel.ADVANCED]: 2,
        },
      };

      const normalized = normalizeScores(rawScores);

      // Check all scores are in 0-100 range
      Object.values(normalized.phaseScores).forEach((score) => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      });

      Object.values(normalized.literacyScores).forEach((score) => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      });

      // Highest raw score should normalize to 100
      expect(normalized.phaseScores[BusinessPhase.STABILIZE]).toBe(100);
      expect(normalized.literacyScores[FinancialLiteracyLevel.BEGINNER]).toBe(100);
    });

    it('should handle zero scores', () => {
      const rawScores = {
        phaseScores: {
          [BusinessPhase.STABILIZE]: 0,
          [BusinessPhase.ORGANIZE]: 0,
          [BusinessPhase.BUILD]: 0,
          [BusinessPhase.GROW]: 0,
        },
        literacyScores: {
          [FinancialLiteracyLevel.BEGINNER]: 0,
          [FinancialLiteracyLevel.INTERMEDIATE]: 0,
          [FinancialLiteracyLevel.ADVANCED]: 0,
        },
      };

      const normalized = normalizeScores(rawScores);

      // Should not crash and return valid values
      Object.values(normalized.phaseScores).forEach((score) => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('calculateConfidence', () => {
    it('should return high confidence for well-differentiated scores', () => {
      const scores = {
        [BusinessPhase.STABILIZE]: 100,
        [BusinessPhase.ORGANIZE]: 50,
        [BusinessPhase.BUILD]: 30,
        [BusinessPhase.GROW]: 20,
      };

      const answers = new Map<string, AssessmentAnswer>([
        ['q1', { questionId: 'q1', value: 'yes', answeredAt: Date.now() }],
        ['q2', { questionId: 'q2', value: 'no', answeredAt: Date.now() }],
        ['q3', { questionId: 'q3', value: 1, answeredAt: Date.now() }],
        ['q4', { questionId: 'q4', value: 5, answeredAt: Date.now() }],
      ]);

      const confidence = calculateConfidence(scores, answers);

      expect(confidence).toBeGreaterThanOrEqual(70);
    });

    it('should return lower confidence for poorly differentiated scores', () => {
      const scores = {
        [BusinessPhase.STABILIZE]: 50,
        [BusinessPhase.ORGANIZE]: 48,
        [BusinessPhase.BUILD]: 49,
        [BusinessPhase.GROW]: 47,
      };

      const answers = new Map<string, AssessmentAnswer>([
        ['q1', { questionId: 'q1', value: 'not_sure', answeredAt: Date.now() }],
        ['q2', { questionId: 'q2', value: 3, answeredAt: Date.now() }],
      ]);

      const confidence = calculateConfidence(scores, answers);

      expect(confidence).toBeLessThan(70);
    });

    it('should penalize indecisive answers', () => {
      const scores = {
        [BusinessPhase.STABILIZE]: 60,
        [BusinessPhase.ORGANIZE]: 40,
        [BusinessPhase.BUILD]: 30,
        [BusinessPhase.GROW]: 20,
      };

      const indecisiveAnswers = new Map<string, AssessmentAnswer>([
        ['q1', { questionId: 'q1', value: 'not_sure', answeredAt: Date.now() }],
        ['q2', { questionId: 'q2', value: 'planning', answeredAt: Date.now() }],
        ['q3', { questionId: 'q3', value: 3, answeredAt: Date.now() }],
      ]);

      const decisiveAnswers = new Map<string, AssessmentAnswer>([
        ['q1', { questionId: 'q1', value: 'yes', answeredAt: Date.now() }],
        ['q2', { questionId: 'q2', value: 'no', answeredAt: Date.now() }],
        ['q3', { questionId: 'q3', value: 1, answeredAt: Date.now() }],
      ]);

      const indecisiveConfidence = calculateConfidence(scores, indecisiveAnswers);
      const decisiveConfidence = calculateConfidence(scores, decisiveAnswers);

      expect(indecisiveConfidence).toBeLessThan(decisiveConfidence);
    });
  });

  describe('Helper functions', () => {
    it('should return correct score interpretations', () => {
      expect(getScoreInterpretation(80)).toBe('Very High');
      expect(getScoreInterpretation(60)).toBe('High');
      expect(getScoreInterpretation(40)).toBe('Moderate');
      expect(getScoreInterpretation(20)).toBe('Low');
      expect(getScoreInterpretation(5)).toBe('Very Low');
    });

    it('should return phase names', () => {
      expect(getPhaseName(BusinessPhase.STABILIZE)).toBe('Stabilize');
      expect(getPhaseName(BusinessPhase.ORGANIZE)).toBe('Organize');
      expect(getPhaseName(BusinessPhase.BUILD)).toBe('Build');
      expect(getPhaseName(BusinessPhase.GROW)).toBe('Grow');
    });

    it('should return phase descriptions', () => {
      const description = getPhaseDescription(BusinessPhase.STABILIZE);
      expect(description).toContain('foundation');
      expect(typeof description).toBe('string');
      expect(description.length).toBeGreaterThan(0);
    });

    it('should return literacy level names', () => {
      expect(getLiteracyLevelName(FinancialLiteracyLevel.BEGINNER)).toBe('Beginner');
      expect(getLiteracyLevelName(FinancialLiteracyLevel.INTERMEDIATE)).toBe('Intermediate');
      expect(getLiteracyLevelName(FinancialLiteracyLevel.ADVANCED)).toBe('Advanced');
    });

    it('should return literacy level descriptions', () => {
      const description = getLiteracyLevelDescription(FinancialLiteracyLevel.BEGINNER);
      expect(typeof description).toBe('string');
      expect(description.length).toBeGreaterThan(0);
      expect(description.toLowerCase()).toContain('guide');
    });
  });
});
