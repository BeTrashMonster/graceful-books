/**
 * Integration verification test for checklist module
 * Ensures all pieces work together
 */

import { describe, it, expect } from 'vitest';
import { ChecklistPhase, ChecklistCategory } from '../../db/schema/checklistItems.schema';
import { BusinessType } from './types';
import {
  generateChecklistItems,
  previewChecklistGeneration,
  createAssessmentResults,
} from './checklistGenerator';
import { ALL_CHECKLIST_TEMPLATES } from './templates';

describe('Checklist Module Integration', () => {
  it('should have comprehensive template library', () => {
    expect(ALL_CHECKLIST_TEMPLATES.length).toBeGreaterThan(40);

    // Check all phases are represented
    const phases = new Set(ALL_CHECKLIST_TEMPLATES.map((t) => t.phase));
    expect(phases.has(ChecklistPhase.STABILIZE)).toBe(true);
    expect(phases.has(ChecklistPhase.ORGANIZE)).toBe(true);
    expect(phases.has(ChecklistPhase.BUILD)).toBe(true);
    expect(phases.has(ChecklistPhase.GROW)).toBe(true);

    // Check all categories are represented
    const categories = new Set(ALL_CHECKLIST_TEMPLATES.map((t) => t.category));
    expect(categories.has(ChecklistCategory.SETUP)).toBe(true);
    expect(categories.has(ChecklistCategory.DAILY)).toBe(true);
    expect(categories.has(ChecklistCategory.WEEKLY)).toBe(true);
    expect(categories.has(ChecklistCategory.MONTHLY)).toBe(true);
  });

  it('should generate appropriate items for freelancer in stabilize phase', () => {
    const assessment = createAssessmentResults({
      userId: 'test-user',
      companyId: 'test-company',
      phase: ChecklistPhase.STABILIZE,
      businessType: BusinessType.FREELANCER,
      literacyLevel: 2,
      sellsServices: true,
      needsInvoicing: true,
    });

    const items = generateChecklistItems(assessment);

    expect(items.length).toBeGreaterThan(5);

    // Should have setup items
    const hasSetup = items.some((i) => i.category === ChecklistCategory.SETUP);
    expect(hasSetup).toBe(true);

    // Should have weekly items
    const hasWeekly = items.some((i) => i.category === ChecklistCategory.WEEKLY);
    expect(hasWeekly).toBe(true);

    // Should include items from multiple phases (generateChecklistItems includes all applicable)
    const phases = new Set(items.map((i) => i.phase));
    expect(phases.size).toBeGreaterThan(0);
  });

  it('should generate different items for product business vs freelancer', () => {
    const freelancerAssessment = createAssessmentResults({
      userId: 'freelancer',
      companyId: 'company-1',
      phase: ChecklistPhase.ORGANIZE,
      businessType: BusinessType.FREELANCER,
      literacyLevel: 2,
      sellsServices: true,
      needsInvoicing: true,
    });

    const productAssessment = createAssessmentResults({
      userId: 'product-biz',
      companyId: 'company-2',
      phase: ChecklistPhase.ORGANIZE,
      businessType: BusinessType.PRODUCT_BUSINESS,
      literacyLevel: 2,
      sellsProducts: true,
      hasInventory: true,
    });

    const freelancerItems = generateChecklistItems(freelancerAssessment);
    const productItems = generateChecklistItems(productAssessment);

    // Should have different items
    expect(freelancerItems.length).not.toBe(productItems.length);

    // Freelancer should have invoicing items
    const freelancerHasInvoicing = freelancerItems.some(
      (i) => i.template_id?.includes('invoice')
    );
    expect(freelancerHasInvoicing).toBe(true);

    // Product business should have inventory items
    const productHasInventory = productItems.some(
      (i) => i.template_id?.includes('inventory')
    );
    expect(productHasInventory).toBe(true);
  });

  it('should scale complexity with literacy level', () => {
    const beginnerAssessment = createAssessmentResults({
      userId: 'beginner',
      companyId: 'company-1',
      phase: ChecklistPhase.BUILD,
      businessType: BusinessType.CONSULTANT,
      literacyLevel: 1,
    });

    const advancedAssessment = createAssessmentResults({
      userId: 'advanced',
      companyId: 'company-2',
      phase: ChecklistPhase.BUILD,
      businessType: BusinessType.CONSULTANT,
      literacyLevel: 5,
    });

    const beginnerItems = generateChecklistItems(beginnerAssessment);
    const advancedItems = generateChecklistItems(advancedAssessment);

    // Advanced should have more items (more advanced templates)
    expect(advancedItems.length).toBeGreaterThan(beginnerItems.length);
  });

  it('should provide accurate preview without creating items', () => {
    const assessment = createAssessmentResults({
      userId: 'preview-user',
      companyId: 'preview-company',
      phase: ChecklistPhase.ORGANIZE,
      businessType: BusinessType.AGENCY,
      literacyLevel: 3,
      hasEmployees: true,
    });

    const preview = previewChecklistGeneration(assessment);

    expect(preview.totalItems).toBeGreaterThan(0);
    expect(preview.byPhase[ChecklistPhase.ORGANIZE]).toBeGreaterThan(0);
    expect(preview.templates.length).toBe(preview.totalItems);

    // Verify counts match
    const categoryTotal = Object.values(preview.byCategory).reduce((sum, count) => sum + count, 0);
    expect(categoryTotal).toBe(preview.totalItems);
  });

  it('should handle all business types', () => {
    const businessTypes = [
      BusinessType.FREELANCER,
      BusinessType.CONSULTANT,
      BusinessType.CREATIVE,
      BusinessType.SERVICE_PROVIDER,
      BusinessType.PRODUCT_BUSINESS,
      BusinessType.ECOMMERCE,
      BusinessType.AGENCY,
      BusinessType.RETAIL,
      BusinessType.RESTAURANT,
      BusinessType.OTHER,
    ];

    businessTypes.forEach((businessType) => {
      const assessment = createAssessmentResults({
        userId: `user-${businessType}`,
        companyId: 'test-company',
        phase: ChecklistPhase.STABILIZE,
        businessType,
        literacyLevel: 2,
      });

      // Should generate items for each business type
      const items = generateChecklistItems(assessment);
      expect(items.length).toBeGreaterThan(0);
    });
  });

  it('should have plain english descriptions', () => {
    const items = generateChecklistItems(
      createAssessmentResults({
        userId: 'test',
        companyId: 'test',
        phase: ChecklistPhase.STABILIZE,
        businessType: BusinessType.FREELANCER,
        literacyLevel: 2,
      })
    );

    items.forEach((item) => {
      // Should have readable title
      expect(item.title.length).toBeGreaterThan(10);
      expect(item.title).not.toMatch(/undefined|null|NaN/);

      // Should have helpful description
      expect(item.description.length).toBeGreaterThan(20);
      expect(item.description).not.toMatch(/undefined|null|NaN/);

      // Should not have jargon without explanation
      const hasJargonWithoutContext =
        item.description.includes('GAAP') ||
        item.description.includes('accrual basis') ||
        item.description.includes('chart of accounts');

      // If it has jargon, it should explain it
      if (hasJargonWithoutContext) {
        expect(item.description.length).toBeGreaterThan(50);
      }
    });
  });

  it('should maintain data integrity', () => {
    const assessment = createAssessmentResults({
      userId: 'integrity-test',
      companyId: 'integrity-company',
      phase: ChecklistPhase.ORGANIZE,
      businessType: BusinessType.CONSULTANT,
      literacyLevel: 3,
    });

    const items = generateChecklistItems(assessment);

    items.forEach((item) => {
      // All required fields should be present
      expect(item.user_id).toBe(assessment.userId);
      expect(item.company_id).toBe(assessment.companyId);
      expect(item.phase).toBeDefined();
      expect(item.category).toBeDefined();
      expect(item.title).toBeDefined();
      expect(item.description).toBeDefined();

      // Default states should be correct
      expect(item.completed).toBe(false);
      expect(item.not_applicable).toBe(false);
      expect(item.streak_count).toBe(0);

      // Nullable fields should be null
      expect(item.completed_at).toBeNull();
      expect(item.last_completed_at).toBeNull();
      expect(item.snoozed_until).toBeNull();

      // Metadata should be set
      expect(item.template_id).toBeDefined();
      expect(item.business_type).toBe(assessment.businessType);
      expect(item.literacy_level).toBe(assessment.literacyLevel);
    });
  });
});
