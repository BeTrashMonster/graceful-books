/**
 * Selection Rules Tests
 *
 * Test suite for checklist item selection rules and template filtering logic.
 */

import { describe, it, expect } from 'vitest';
import {
  shouldIncludeTemplate,
  filterTemplatesByAssessment,
  getCustomizedTitle,
  getCustomizedDescription,
  customizeTemplate,
  calculateTemplatePriority,
  validateAssessmentResults,
} from './selectionRules';
import { ChecklistPhase, ChecklistCategory } from '../../db/schema/checklistItems.schema';
import { BusinessType } from './types';
import type { ChecklistItemTemplate, AssessmentResults } from './types';

describe('selectionRules', () => {
  const baseAssessment: AssessmentResults = {
    userId: 'user-123',
    companyId: 'company-123',
    phase: ChecklistPhase.STABILIZE,
    businessType: BusinessType.FREELANCER,
    literacyLevel: 2,
    hasEmployees: false,
    hasInventory: false,
    acceptsOnlinePayments: false,
    sellsProducts: false,
    sellsServices: true,
    needsInvoicing: true,
    tracksMileage: false,
    hasMultipleCurrencies: false,
    isRegisteredBusiness: true,
  };

  const baseTemplate: ChecklistItemTemplate = {
    id: 'test-template',
    phase: ChecklistPhase.STABILIZE,
    category: ChecklistCategory.SETUP,
    title: 'Test Item',
    description: 'Test description',
    order: 1,
    linkedFeature: null,
    selectionRules: {},
  };

  describe('shouldIncludeTemplate', () => {
    it('should include template with no selection rules', () => {
      expect(shouldIncludeTemplate(baseTemplate, baseAssessment)).toBe(true);
    });

    it('should exclude template if phase does not match', () => {
      const template: ChecklistItemTemplate = {
        ...baseTemplate,
        selectionRules: {
          requiredPhases: [ChecklistPhase.BUILD],
        },
      };

      expect(shouldIncludeTemplate(template, baseAssessment)).toBe(false);
    });

    it('should include template if phase matches', () => {
      const template: ChecklistItemTemplate = {
        ...baseTemplate,
        selectionRules: {
          requiredPhases: [ChecklistPhase.STABILIZE, ChecklistPhase.ORGANIZE],
        },
      };

      expect(shouldIncludeTemplate(template, baseAssessment)).toBe(true);
    });

    it('should exclude template if business type does not match', () => {
      const template: ChecklistItemTemplate = {
        ...baseTemplate,
        selectionRules: {
          businessTypes: [BusinessType.PRODUCT_BUSINESS],
        },
      };

      expect(shouldIncludeTemplate(template, baseAssessment)).toBe(false);
    });

    it('should include template if business type matches', () => {
      const template: ChecklistItemTemplate = {
        ...baseTemplate,
        selectionRules: {
          businessTypes: [BusinessType.FREELANCER, BusinessType.CONSULTANT],
        },
      };

      expect(shouldIncludeTemplate(template, baseAssessment)).toBe(true);
    });

    it('should exclude template if literacy level is too low', () => {
      const template: ChecklistItemTemplate = {
        ...baseTemplate,
        selectionRules: {
          minLiteracyLevel: 4,
        },
      };

      expect(shouldIncludeTemplate(template, baseAssessment)).toBe(false);
    });

    it('should exclude template if literacy level is too high', () => {
      const template: ChecklistItemTemplate = {
        ...baseTemplate,
        selectionRules: {
          maxLiteracyLevel: 1,
        },
      };

      expect(shouldIncludeTemplate(template, baseAssessment)).toBe(false);
    });

    it('should include template if literacy level is in range', () => {
      const template: ChecklistItemTemplate = {
        ...baseTemplate,
        selectionRules: {
          minLiteracyLevel: 1,
          maxLiteracyLevel: 3,
        },
      };

      expect(shouldIncludeTemplate(template, baseAssessment)).toBe(true);
    });

    it('should exclude template if requires employees but user has none', () => {
      const template: ChecklistItemTemplate = {
        ...baseTemplate,
        selectionRules: {
          requiresEmployees: true,
        },
      };

      expect(shouldIncludeTemplate(template, baseAssessment)).toBe(false);
    });

    it('should exclude template if requires inventory but user has none', () => {
      const template: ChecklistItemTemplate = {
        ...baseTemplate,
        selectionRules: {
          requiresInventory: true,
        },
      };

      expect(shouldIncludeTemplate(template, baseAssessment)).toBe(false);
    });

    it('should exclude template if requires products but user sells none', () => {
      const template: ChecklistItemTemplate = {
        ...baseTemplate,
        selectionRules: {
          requiresProducts: true,
        },
      };

      expect(shouldIncludeTemplate(template, baseAssessment)).toBe(false);
    });

    it('should include template if requires services and user sells them', () => {
      const template: ChecklistItemTemplate = {
        ...baseTemplate,
        selectionRules: {
          requiresServices: true,
        },
      };

      expect(shouldIncludeTemplate(template, baseAssessment)).toBe(true);
    });

    it('should include template if requires invoicing and user needs it', () => {
      const template: ChecklistItemTemplate = {
        ...baseTemplate,
        selectionRules: {
          requiresInvoicing: true,
        },
      };

      expect(shouldIncludeTemplate(template, baseAssessment)).toBe(true);
    });

    it('should handle multiple selection rules (AND logic)', () => {
      const template: ChecklistItemTemplate = {
        ...baseTemplate,
        selectionRules: {
          requiresServices: true,
          requiresInvoicing: true,
          minLiteracyLevel: 2,
        },
      };

      expect(shouldIncludeTemplate(template, baseAssessment)).toBe(true);

      const failingAssessment = { ...baseAssessment, needsInvoicing: false };
      expect(shouldIncludeTemplate(template, failingAssessment)).toBe(false);
    });
  });

  describe('filterTemplatesByAssessment', () => {
    it('should filter templates based on assessment', () => {
      const templates: ChecklistItemTemplate[] = [
        {
          ...baseTemplate,
          id: 'template-1',
          selectionRules: {},
        },
        {
          ...baseTemplate,
          id: 'template-2',
          selectionRules: { requiresEmployees: true },
        },
        {
          ...baseTemplate,
          id: 'template-3',
          selectionRules: { requiresServices: true },
        },
      ];

      const filtered = filterTemplatesByAssessment(templates, baseAssessment);

      expect(filtered).toHaveLength(2);
      expect(filtered.map((t) => t.id)).toEqual(['template-1', 'template-3']);
    });
  });

  describe('getCustomizedTitle', () => {
    it('should return default title if no customization', () => {
      const title = getCustomizedTitle(baseTemplate, baseAssessment);
      expect(title).toBe('Test Item');
    });

    it('should return custom title for business type', () => {
      const template: ChecklistItemTemplate = {
        ...baseTemplate,
        customization: {
          titleVariants: {
            [BusinessType.FREELANCER]: 'Freelancer-specific title',
          },
        },
      };

      const title = getCustomizedTitle(template, baseAssessment);
      expect(title).toBe('Freelancer-specific title');
    });

    it('should return default title if business type variant not found', () => {
      const template: ChecklistItemTemplate = {
        ...baseTemplate,
        customization: {
          titleVariants: {
            [BusinessType.PRODUCT_BUSINESS]: 'Product business title',
          },
        },
      };

      const title = getCustomizedTitle(template, baseAssessment);
      expect(title).toBe('Test Item');
    });
  });

  describe('getCustomizedDescription', () => {
    it('should return default description if no customization', () => {
      const desc = getCustomizedDescription(baseTemplate, baseAssessment);
      expect(desc).toBe('Test description');
    });

    it('should prefer literacy level description over business type', () => {
      const template: ChecklistItemTemplate = {
        ...baseTemplate,
        customization: {
          literacyLevelDescriptions: {
            2: 'Literacy level 2 description',
          },
          descriptionVariants: {
            [BusinessType.FREELANCER]: 'Freelancer description',
          },
        },
      };

      const desc = getCustomizedDescription(template, baseAssessment);
      expect(desc).toBe('Literacy level 2 description');
    });

    it('should use business type description if literacy level not found', () => {
      const template: ChecklistItemTemplate = {
        ...baseTemplate,
        customization: {
          literacyLevelDescriptions: {
            4: 'Literacy level 4 description',
          },
          descriptionVariants: {
            [BusinessType.FREELANCER]: 'Freelancer description',
          },
        },
      };

      const desc = getCustomizedDescription(template, baseAssessment);
      expect(desc).toBe('Freelancer description');
    });

    it('should use default description if no variants match', () => {
      const template: ChecklistItemTemplate = {
        ...baseTemplate,
        customization: {
          literacyLevelDescriptions: {
            5: 'Literacy level 5 description',
          },
          descriptionVariants: {
            [BusinessType.PRODUCT_BUSINESS]: 'Product business description',
          },
        },
      };

      const desc = getCustomizedDescription(template, baseAssessment);
      expect(desc).toBe('Test description');
    });
  });

  describe('customizeTemplate', () => {
    it('should customize both title and description', () => {
      const template: ChecklistItemTemplate = {
        ...baseTemplate,
        customization: {
          titleVariants: {
            [BusinessType.FREELANCER]: 'Custom title',
          },
          descriptionVariants: {
            [BusinessType.FREELANCER]: 'Custom description',
          },
        },
      };

      const customized = customizeTemplate(template, baseAssessment);

      expect(customized.title).toBe('Custom title');
      expect(customized.description).toBe('Custom description');
      expect(customized.id).toBe(baseTemplate.id); // Other fields preserved
    });
  });

  describe('calculateTemplatePriority', () => {
    it('should give base score to templates', () => {
      const priority = calculateTemplatePriority(baseTemplate, baseAssessment);
      expect(priority).toBeGreaterThanOrEqual(0);
      expect(priority).toBeLessThanOrEqual(100);
    });

    it('should boost setup tasks in stabilize phase', () => {
      const setupTemplate: ChecklistItemTemplate = {
        ...baseTemplate,
        category: ChecklistCategory.SETUP,
      };

      const dailyTemplate: ChecklistItemTemplate = {
        ...baseTemplate,
        category: ChecklistCategory.DAILY,
      };

      const setupPriority = calculateTemplatePriority(setupTemplate, baseAssessment);
      const dailyPriority = calculateTemplatePriority(dailyTemplate, baseAssessment);

      expect(setupPriority).toBeGreaterThan(dailyPriority);
    });

    it('should boost daily tasks', () => {
      const dailyTemplate: ChecklistItemTemplate = {
        ...baseTemplate,
        category: ChecklistCategory.DAILY,
      };

      const monthlyTemplate: ChecklistItemTemplate = {
        ...baseTemplate,
        category: ChecklistCategory.MONTHLY,
      };

      const dailyPriority = calculateTemplatePriority(dailyTemplate, baseAssessment);
      const monthlyPriority = calculateTemplatePriority(monthlyTemplate, baseAssessment);

      expect(dailyPriority).toBeGreaterThan(monthlyPriority);
    });

    it('should boost templates matching user needs', () => {
      const invoicingTemplate: ChecklistItemTemplate = {
        ...baseTemplate,
        selectionRules: { requiresInvoicing: true },
      };

      const employeeTemplate: ChecklistItemTemplate = {
        ...baseTemplate,
        selectionRules: { requiresEmployees: true },
      };

      const invoicingPriority = calculateTemplatePriority(invoicingTemplate, baseAssessment);
      const employeePriority = calculateTemplatePriority(employeeTemplate, baseAssessment);

      // Invoicing should be boosted because user needs it
      // Employee should not because user doesn't have employees
      expect(invoicingPriority).toBeGreaterThan(employeePriority);
    });
  });

  describe('validateAssessmentResults', () => {
    it('should validate complete assessment results', () => {
      const errors = validateAssessmentResults(baseAssessment);
      expect(errors).toHaveLength(0);
    });

    it('should detect missing userId', () => {
      const invalid = { ...baseAssessment, userId: '' };
      const errors = validateAssessmentResults(invalid);
      expect(errors).toContain('userId is required');
    });

    it('should detect missing companyId', () => {
      const invalid = { ...baseAssessment, companyId: '' };
      const errors = validateAssessmentResults(invalid);
      expect(errors).toContain('companyId is required');
    });

    it('should detect invalid literacy level', () => {
      const invalid = { ...baseAssessment, literacyLevel: 10 as any };
      const errors = validateAssessmentResults(invalid);
      expect(errors).toContain('literacyLevel must be between 1 and 5');
    });

    it('should detect missing boolean fields', () => {
      const invalid = { ...baseAssessment };
      delete (invalid as any).hasEmployees;

      const errors = validateAssessmentResults(invalid);
      expect(errors).toContain('hasEmployees is required');
    });

    it('should return multiple errors for multiple issues', () => {
      const invalid: Partial<AssessmentResults> = {
        phase: ChecklistPhase.STABILIZE,
      };

      const errors = validateAssessmentResults(invalid);
      expect(errors.length).toBeGreaterThan(5);
    });
  });
});
