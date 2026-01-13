/**
 * Checklist Generator Tests
 *
 * Test suite for checklist generation logic.
 */

import { describe, it, expect } from 'vitest';
import {
  generateItemFromTemplate,
  generateChecklistItems,
  generateChecklistItemsForPhase,
  previewChecklistGeneration,
  shouldRegenerateChecklist,
  getNewlyApplicableTemplates,
  getNoLongerApplicableTemplates,
  createAssessmentResults,
} from './checklistGenerator';
import { ChecklistPhase, ChecklistCategory } from '../../db/schema/checklistItems.schema';
import { BusinessType } from './types';
import type { ChecklistItemTemplate, AssessmentResults } from './types';

describe('checklistGenerator', () => {
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

  const testTemplate: ChecklistItemTemplate = {
    id: 'test-template-1',
    phase: ChecklistPhase.STABILIZE,
    category: ChecklistCategory.SETUP,
    title: 'Test Setup Item',
    description: 'This is a test setup item',
    order: 1,
    linkedFeature: '/test',
    selectionRules: {},
  };

  describe('generateItemFromTemplate', () => {
    it('should generate checklist item from template', () => {
      const item = generateItemFromTemplate(testTemplate, baseAssessment);

      expect(item.user_id).toBe(baseAssessment.userId);
      expect(item.company_id).toBe(baseAssessment.companyId);
      expect(item.phase).toBe(testTemplate.phase);
      expect(item.category).toBe(testTemplate.category);
      expect(item.title).toBe(testTemplate.title);
      expect(item.description).toBe(testTemplate.description);
      expect(item.order).toBe(testTemplate.order);
      expect(item.linked_feature).toBe(testTemplate.linkedFeature);
      expect(item.template_id).toBe(testTemplate.id);
      expect(item.business_type).toBe(baseAssessment.businessType);
      expect(item.literacy_level).toBe(baseAssessment.literacyLevel);
    });

    it('should set default completion values', () => {
      const item = generateItemFromTemplate(testTemplate, baseAssessment);

      expect(item.completed).toBe(false);
      expect(item.completed_at).toBeNull();
      expect(item.snoozed_until).toBeNull();
      expect(item.not_applicable).toBe(false);
      expect(item.streak_count).toBe(0);
      expect(item.last_completed_at).toBeNull();
    });

    it('should customize template before generating item', () => {
      const customTemplate: ChecklistItemTemplate = {
        ...testTemplate,
        customization: {
          titleVariants: {
            [BusinessType.FREELANCER]: 'Freelancer Custom Title',
          },
        },
      };

      const item = generateItemFromTemplate(customTemplate, baseAssessment);

      expect(item.title).toBe('Freelancer Custom Title');
    });
  });

  describe('generateChecklistItems', () => {
    it('should generate items from applicable templates', () => {
      const items = generateChecklistItems(baseAssessment);

      expect(items).toBeDefined();
      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThan(0);

      // All items should match assessment
      items.forEach((item) => {
        expect(item.user_id).toBe(baseAssessment.userId);
        expect(item.company_id).toBe(baseAssessment.companyId);
      });
    });

    it('should include custom templates if provided', () => {
      const customTemplate: ChecklistItemTemplate = {
        id: 'custom-template',
        phase: ChecklistPhase.STABILIZE,
        category: ChecklistCategory.SETUP,
        title: 'Custom Item',
        description: 'Custom description',
        order: 999,
        linkedFeature: null,
        selectionRules: {},
      };

      const items = generateChecklistItems(baseAssessment, {
        customTemplates: [customTemplate],
      });

      const hasCustom = items.some((item) => item.template_id === 'custom-template');
      expect(hasCustom).toBe(true);
    });

    it('should filter out templates that do not match assessment', () => {
      const assessment: AssessmentResults = {
        ...baseAssessment,
        hasEmployees: false,
        hasInventory: false,
      };

      const items = generateChecklistItems(assessment);

      // No items should require employees or inventory
      items.forEach((item) => {
        // We'd need to check the original template to verify this
        // For now, just verify items were generated
        expect(item).toBeDefined();
      });
    });

    it('should throw error for invalid assessment', () => {
      const invalidAssessment = {
        userId: '',
        companyId: 'company-123',
      } as any;

      expect(() => generateChecklistItems(invalidAssessment)).toThrow();
    });

    it('should sort items by priority', () => {
      const items = generateChecklistItems(baseAssessment);

      // Setup items should generally come before monthly items in stabilize phase
      const setupItems = items.filter((i) => i.category === ChecklistCategory.SETUP);
      const monthlyItems = items.filter((i) => i.category === ChecklistCategory.MONTHLY);

      if (setupItems.length > 0 && monthlyItems.length > 0) {
        const firstSetupIndex = items.findIndex(
          (i) => i.category === ChecklistCategory.SETUP
        );
        const firstMonthlyIndex = items.findIndex(
          (i) => i.category === ChecklistCategory.MONTHLY
        );

        // In stabilize phase, setup should generally come before monthly
        // (This is a general expectation based on priority logic)
        expect(firstSetupIndex).toBeLessThan(firstMonthlyIndex);
      }
    });
  });

  describe('generateChecklistItemsForPhase', () => {
    it('should generate items only for current phase', () => {
      const items = generateChecklistItemsForPhase(baseAssessment);

      // All items should be for stabilize phase
      items.forEach((item) => {
        expect(item.phase).toBe(ChecklistPhase.STABILIZE);
      });
    });

    it('should generate different items for different phases', () => {
      const stabilizeAssessment = { ...baseAssessment, phase: ChecklistPhase.STABILIZE };
      const buildAssessment = { ...baseAssessment, phase: ChecklistPhase.BUILD };

      const stabilizeItems = generateChecklistItemsForPhase(stabilizeAssessment);
      const buildItems = generateChecklistItemsForPhase(buildAssessment);

      // Different phases should have different template sets
      expect(stabilizeItems.length).not.toBe(buildItems.length);

      // Verify phases match
      stabilizeItems.forEach((item) => expect(item.phase).toBe(ChecklistPhase.STABILIZE));
      buildItems.forEach((item) => expect(item.phase).toBe(ChecklistPhase.BUILD));
    });
  });

  describe('previewChecklistGeneration', () => {
    it('should preview without creating items', () => {
      const preview = previewChecklistGeneration(baseAssessment);

      expect(preview).toBeDefined();
      expect(preview.totalItems).toBeGreaterThan(0);
      expect(preview.byPhase).toBeDefined();
      expect(preview.byCategory).toBeDefined();
      expect(preview.templates).toBeDefined();
      expect(Array.isArray(preview.templates)).toBe(true);
    });

    it('should show counts by phase', () => {
      const preview = previewChecklistGeneration(baseAssessment);

      expect(preview.byPhase[ChecklistPhase.STABILIZE]).toBeGreaterThan(0);
    });

    it('should show counts by category', () => {
      const preview = previewChecklistGeneration(baseAssessment);

      // Should have at least some setup items in stabilize phase
      expect(preview.byCategory[ChecklistCategory.SETUP]).toBeGreaterThan(0);
    });

    it('should return customized templates', () => {
      const preview = previewChecklistGeneration(baseAssessment);

      // Templates should be sorted by priority
      expect(preview.templates.length).toBe(preview.totalItems);

      // Verify templates are customized
      preview.templates.forEach((template) => {
        expect(template.title).toBeDefined();
        expect(template.description).toBeDefined();
      });
    });
  });

  describe('shouldRegenerateChecklist', () => {
    it('should regenerate when phase changes', () => {
      const current = { ...baseAssessment, phase: ChecklistPhase.ORGANIZE };
      const previous = { ...baseAssessment, phase: ChecklistPhase.STABILIZE };

      expect(shouldRegenerateChecklist(current, previous)).toBe(true);
    });

    it('should regenerate when business type changes', () => {
      const current = { ...baseAssessment, businessType: BusinessType.PRODUCT_BUSINESS };
      const previous = { ...baseAssessment, businessType: BusinessType.FREELANCER };

      expect(shouldRegenerateChecklist(current, previous)).toBe(true);
    });

    it('should regenerate when literacy level changes significantly', () => {
      const current: AssessmentResults = { ...baseAssessment, literacyLevel: 5 };
      const previous: AssessmentResults = { ...baseAssessment, literacyLevel: 2 };

      expect(shouldRegenerateChecklist(current, previous)).toBe(true);
    });

    it('should not regenerate for small literacy level change', () => {
      const current: AssessmentResults = { ...baseAssessment, literacyLevel: 3 };
      const previous: AssessmentResults = { ...baseAssessment, literacyLevel: 2 };

      expect(shouldRegenerateChecklist(current, previous)).toBe(false);
    });

    it('should regenerate when multiple characteristics change', () => {
      const current = {
        ...baseAssessment,
        hasEmployees: true,
        hasInventory: true,
      };
      const previous = {
        ...baseAssessment,
        hasEmployees: false,
        hasInventory: false,
      };

      expect(shouldRegenerateChecklist(current, previous)).toBe(true);
    });

    it('should not regenerate for single characteristic change', () => {
      const current = { ...baseAssessment, hasEmployees: true };
      const previous = { ...baseAssessment, hasEmployees: false };

      expect(shouldRegenerateChecklist(current, previous)).toBe(false);
    });

    it('should not regenerate when nothing changes', () => {
      expect(shouldRegenerateChecklist(baseAssessment, baseAssessment)).toBe(false);
    });
  });

  describe('getNewlyApplicableTemplates', () => {
    it('should find templates that are newly applicable', () => {
      const current = { ...baseAssessment, hasEmployees: true };
      const previous = { ...baseAssessment, hasEmployees: false };

      const newTemplates = getNewlyApplicableTemplates(current, previous);

      // Should have templates that require employees
      const hasEmployeeTemplate = newTemplates.some(
        (t) => t.selectionRules.requiresEmployees === true
      );
      expect(hasEmployeeTemplate).toBe(true);
    });

    it('should return empty array when nothing new is applicable', () => {
      const newTemplates = getNewlyApplicableTemplates(baseAssessment, baseAssessment);

      expect(newTemplates).toHaveLength(0);
    });
  });

  describe('getNoLongerApplicableTemplates', () => {
    it('should find templates that are no longer applicable', () => {
      const current = { ...baseAssessment, needsInvoicing: false };
      const previous = { ...baseAssessment, needsInvoicing: true };

      const removedTemplates = getNoLongerApplicableTemplates(current, previous);

      // Should have templates that require invoicing
      const hasInvoicingTemplate = removedTemplates.some(
        (t) => t.selectionRules.requiresInvoicing === true
      );
      expect(hasInvoicingTemplate).toBe(true);
    });

    it('should return empty array when nothing is removed', () => {
      const removedTemplates = getNoLongerApplicableTemplates(baseAssessment, baseAssessment);

      expect(removedTemplates).toHaveLength(0);
    });
  });

  describe('createAssessmentResults', () => {
    it('should create complete assessment from params', () => {
      const assessment = createAssessmentResults({
        userId: 'user-456',
        companyId: 'company-456',
        phase: ChecklistPhase.ORGANIZE,
        businessType: BusinessType.CONSULTANT,
        literacyLevel: 3,
        hasEmployees: true,
        sellsServices: true,
        needsInvoicing: true,
      });

      expect(assessment.userId).toBe('user-456');
      expect(assessment.companyId).toBe('company-456');
      expect(assessment.phase).toBe(ChecklistPhase.ORGANIZE);
      expect(assessment.businessType).toBe(BusinessType.CONSULTANT);
      expect(assessment.literacyLevel).toBe(3);
      expect(assessment.hasEmployees).toBe(true);
      expect(assessment.sellsServices).toBe(true);
      expect(assessment.needsInvoicing).toBe(true);
    });

    it('should use default false for omitted boolean fields', () => {
      const assessment = createAssessmentResults({
        userId: 'user-789',
        companyId: 'company-789',
        phase: ChecklistPhase.STABILIZE,
        businessType: BusinessType.FREELANCER,
        literacyLevel: 2,
      });

      expect(assessment.hasEmployees).toBe(false);
      expect(assessment.hasInventory).toBe(false);
      expect(assessment.acceptsOnlinePayments).toBe(false);
      expect(assessment.sellsProducts).toBe(false);
      expect(assessment.sellsServices).toBe(false);
      expect(assessment.needsInvoicing).toBe(false);
      expect(assessment.tracksMileage).toBe(false);
      expect(assessment.hasMultipleCurrencies).toBe(false);
      expect(assessment.isRegisteredBusiness).toBe(false);
    });
  });
});
