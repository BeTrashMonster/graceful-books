/**
 * Phase Detection Tests
 *
 * Tests for determining business phase and financial literacy from assessment scores.
 */

import { describe, it, expect } from 'vitest';
import {
  determinePhase,
  determineLiteracyLevel,
  extractBusinessMetadata,
  determineRecommendedFeatures,
  determineRecommendedChecklists,
  generateAssessmentResults,
  getPhaseTransitionSuggestions,
  getLiteracyImprovementSuggestions,
} from './phaseDetection';
import type { AssessmentAnswer } from './types';
import {
  BusinessPhase,
  FinancialLiteracyLevel,
  BusinessType,
  RevenueRange,
} from './types';

describe('Phase Detection', () => {
  describe('determinePhase', () => {
    it('should select the highest scoring phase', () => {
      const scores = {
        phaseScores: {
          [BusinessPhase.STABILIZE]: 100,
          [BusinessPhase.ORGANIZE]: 50,
          [BusinessPhase.BUILD]: 30,
          [BusinessPhase.GROW]: 20,
        },
        literacyScores: {
          [FinancialLiteracyLevel.BEGINNER]: 80,
          [FinancialLiteracyLevel.INTERMEDIATE]: 50,
          [FinancialLiteracyLevel.ADVANCED]: 20,
        },
      };

      const phase = determinePhase(scores);
      expect(phase).toBe(BusinessPhase.STABILIZE);
    });

    it('should handle tie scores', () => {
      const scores = {
        phaseScores: {
          [BusinessPhase.STABILIZE]: 75,
          [BusinessPhase.ORGANIZE]: 75,
          [BusinessPhase.BUILD]: 50,
          [BusinessPhase.GROW]: 50,
        },
        literacyScores: {
          [FinancialLiteracyLevel.BEGINNER]: 50,
          [FinancialLiteracyLevel.INTERMEDIATE]: 50,
          [FinancialLiteracyLevel.ADVANCED]: 50,
        },
      };

      const phase = determinePhase(scores);
      // Should return one of the tied values
      expect([BusinessPhase.STABILIZE, BusinessPhase.ORGANIZE]).toContain(phase);
    });
  });

  describe('determineLiteracyLevel', () => {
    it('should select the highest scoring literacy level', () => {
      const scores = {
        phaseScores: {
          [BusinessPhase.STABILIZE]: 50,
          [BusinessPhase.ORGANIZE]: 50,
          [BusinessPhase.BUILD]: 50,
          [BusinessPhase.GROW]: 50,
        },
        literacyScores: {
          [FinancialLiteracyLevel.BEGINNER]: 30,
          [FinancialLiteracyLevel.INTERMEDIATE]: 90,
          [FinancialLiteracyLevel.ADVANCED]: 40,
        },
      };

      const level = determineLiteracyLevel(scores);
      expect(level).toBe(FinancialLiteracyLevel.INTERMEDIATE);
    });
  });

  describe('extractBusinessMetadata', () => {
    it('should extract business information from answers', () => {
      const answers = new Map<string, AssessmentAnswer>([
        [
          'business_structure',
          {
            questionId: 'business_structure',
            value: BusinessType.LLC,
            answeredAt: Date.now(),
          },
        ],
        [
          'revenue_range',
          {
            questionId: 'revenue_range',
            value: RevenueRange.ONE_HUNDRED_TO_500K,
            answeredAt: Date.now(),
          },
        ],
        [
          'has_employees',
          { questionId: 'has_employees', value: 'yes', answeredAt: Date.now() },
        ],
        [
          'has_sales_tax',
          { questionId: 'has_sales_tax', value: 'yes', answeredAt: Date.now() },
        ],
        [
          'has_inventory',
          { questionId: 'has_inventory', value: 'both', answeredAt: Date.now() },
        ],
      ]);

      const metadata = extractBusinessMetadata(answers);

      expect(metadata.businessType).toBe(BusinessType.LLC);
      expect(metadata.revenueRange).toBe(RevenueRange.ONE_HUNDRED_TO_500K);
      expect(metadata.hasEmployees).toBe(true);
      expect(metadata.hasSalesTax).toBe(true);
      expect(metadata.hasInventory).toBe(true);
    });

    it('should handle missing answers with defaults', () => {
      const answers = new Map<string, AssessmentAnswer>();
      const metadata = extractBusinessMetadata(answers);

      expect(metadata.businessType).toBe(BusinessType.SOLE_PROPRIETOR);
      expect(metadata.revenueRange).toBe(RevenueRange.ZERO_TO_25K);
      expect(metadata.hasEmployees).toBe(false);
      expect(metadata.hasSalesTax).toBe(false);
      expect(metadata.hasInventory).toBe(false);
    });
  });

  describe('determineRecommendedFeatures', () => {
    it('should include core features for everyone', () => {
      const metadata = {
        businessType: BusinessType.SOLE_PROPRIETOR,
        revenueRange: RevenueRange.ZERO_TO_25K,
        hasEmployees: false,
        hasSalesTax: false,
        hasInventory: false,
      };

      const features = determineRecommendedFeatures(
        BusinessPhase.STABILIZE,
        FinancialLiteracyLevel.BEGINNER,
        metadata
      );

      expect(features).toContain('chart_of_accounts');
      expect(features).toContain('transactions');
      expect(features).toContain('dashboard');
    });

    it('should add beginner features for beginner literacy', () => {
      const metadata = {
        businessType: BusinessType.SOLE_PROPRIETOR,
        revenueRange: RevenueRange.ZERO_TO_25K,
        hasEmployees: false,
        hasSalesTax: false,
        hasInventory: false,
      };

      const features = determineRecommendedFeatures(
        BusinessPhase.STABILIZE,
        FinancialLiteracyLevel.BEGINNER,
        metadata
      );

      expect(features).toContain('tutorials');
      expect(features).toContain('tooltips');
      expect(features).toContain('guided_workflows');
    });

    it('should add inventory features when business has inventory', () => {
      const metadata = {
        businessType: BusinessType.LLC,
        revenueRange: RevenueRange.ONE_HUNDRED_TO_500K,
        hasEmployees: false,
        hasSalesTax: false,
        hasInventory: true,
      };

      const features = determineRecommendedFeatures(
        BusinessPhase.BUILD,
        FinancialLiteracyLevel.INTERMEDIATE,
        metadata
      );

      expect(features).toContain('inventory_management');
      expect(features).toContain('cogs_tracking');
      expect(features).toContain('product_catalog');
    });

    it('should add payroll features when business has employees', () => {
      const metadata = {
        businessType: BusinessType.S_CORP,
        revenueRange: RevenueRange.FIVE_HUNDRED_K_TO_1M,
        hasEmployees: true,
        hasSalesTax: false,
        hasInventory: false,
      };

      const features = determineRecommendedFeatures(
        BusinessPhase.BUILD,
        FinancialLiteracyLevel.INTERMEDIATE,
        metadata
      );

      expect(features).toContain('payroll_tracking');
      expect(features).toContain('employee_expenses');
    });
  });

  describe('determineRecommendedChecklists', () => {
    it('should always include onboarding basics', () => {
      const metadata = {
        businessType: BusinessType.SOLE_PROPRIETOR,
        revenueRange: RevenueRange.ZERO_TO_25K,
        hasEmployees: false,
        hasSalesTax: false,
        hasInventory: false,
      };

      const answers = new Map<string, AssessmentAnswer>();

      const checklists = determineRecommendedChecklists(
        BusinessPhase.STABILIZE,
        FinancialLiteracyLevel.BEGINNER,
        metadata,
        answers
      );

      expect(checklists).toContain('onboarding_basics');
    });

    it('should add phase-specific checklists', () => {
      const metadata = {
        businessType: BusinessType.LLC,
        revenueRange: RevenueRange.ONE_HUNDRED_TO_500K,
        hasEmployees: false,
        hasSalesTax: false,
        hasInventory: false,
      };

      const answers = new Map<string, AssessmentAnswer>();

      const checklists = determineRecommendedChecklists(
        BusinessPhase.BUILD,
        FinancialLiteracyLevel.INTERMEDIATE,
        metadata,
        answers
      );

      expect(checklists).toContain('scale_operations');
      expect(checklists).toContain('advanced_tracking');
    });

    it('should add goal-based checklists', () => {
      const metadata = {
        businessType: BusinessType.SOLE_PROPRIETOR,
        revenueRange: RevenueRange.ZERO_TO_25K,
        hasEmployees: false,
        hasSalesTax: false,
        hasInventory: false,
      };

      const answers = new Map<string, AssessmentAnswer>([
        [
          'primary_goal',
          { questionId: 'primary_goal', value: 'tax_ready', answeredAt: Date.now() },
        ],
      ]);

      const checklists = determineRecommendedChecklists(
        BusinessPhase.STABILIZE,
        FinancialLiteracyLevel.BEGINNER,
        metadata,
        answers
      );

      expect(checklists).toContain('tax_readiness');
      expect(checklists).toContain('deduction_tracking');
    });
  });

  describe('generateAssessmentResults', () => {
    it('should generate complete assessment results', () => {
      const rawScores = {
        phaseScores: {
          [BusinessPhase.STABILIZE]: 15,
          [BusinessPhase.ORGANIZE]: 8,
          [BusinessPhase.BUILD]: 3,
          [BusinessPhase.GROW]: 1,
        },
        literacyScores: {
          [FinancialLiteracyLevel.BEGINNER]: 12,
          [FinancialLiteracyLevel.INTERMEDIATE]: 6,
          [FinancialLiteracyLevel.ADVANCED]: 2,
        },
      };

      const normalizedScores = {
        phaseScores: {
          [BusinessPhase.STABILIZE]: 100,
          [BusinessPhase.ORGANIZE]: 53,
          [BusinessPhase.BUILD]: 20,
          [BusinessPhase.GROW]: 7,
        },
        literacyScores: {
          [FinancialLiteracyLevel.BEGINNER]: 100,
          [FinancialLiteracyLevel.INTERMEDIATE]: 50,
          [FinancialLiteracyLevel.ADVANCED]: 17,
        },
      };

      const answers = new Map<string, AssessmentAnswer>([
        [
          'business_structure',
          {
            questionId: 'business_structure',
            value: BusinessType.SOLE_PROPRIETOR,
            answeredAt: Date.now(),
          },
        ],
        [
          'revenue_range',
          {
            questionId: 'revenue_range',
            value: RevenueRange.ZERO_TO_25K,
            answeredAt: Date.now(),
          },
        ],
      ]);

      const results = generateAssessmentResults(rawScores, normalizedScores, answers);

      expect(results.phase).toBe(BusinessPhase.STABILIZE);
      expect(results.literacyLevel).toBe(FinancialLiteracyLevel.BEGINNER);
      expect(results.businessType).toBe(BusinessType.SOLE_PROPRIETOR);
      expect(results.revenueRange).toBe(RevenueRange.ZERO_TO_25K);
      expect(results.phaseConfidence).toBeGreaterThan(0);
      expect(results.literacyConfidence).toBeGreaterThan(0);
      expect(Array.isArray(results.recommendedFeatures)).toBe(true);
      expect(Array.isArray(results.recommendedChecklists)).toBe(true);
    });
  });

  describe('Helper functions', () => {
    it('should provide phase transition suggestions', () => {
      const rawScores = {
        phaseScores: {
          [BusinessPhase.STABILIZE]: 100,
          [BusinessPhase.ORGANIZE]: 50,
          [BusinessPhase.BUILD]: 30,
          [BusinessPhase.GROW]: 20,
        },
        literacyScores: {
          [FinancialLiteracyLevel.BEGINNER]: 80,
          [FinancialLiteracyLevel.INTERMEDIATE]: 50,
          [FinancialLiteracyLevel.ADVANCED]: 20,
        },
      };

      const suggestions = getPhaseTransitionSuggestions(BusinessPhase.STABILIZE, rawScores);

      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some((s) => s.toLowerCase().includes('bank'))).toBe(true);
    });

    it('should provide literacy improvement suggestions', () => {
      const suggestions = getLiteracyImprovementSuggestions(FinancialLiteracyLevel.BEGINNER);

      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some((s) => s.toLowerCase().includes('tutorial'))).toBe(true);
    });
  });
});
