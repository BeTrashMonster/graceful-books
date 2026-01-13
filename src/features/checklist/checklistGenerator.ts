/**
 * Checklist Generation Engine
 *
 * Core logic for generating personalized checklists based on assessment results.
 * Integrates templates, selection rules, and database operations.
 *
 * Requirements:
 * - C3: Checklist Generation Engine
 * - CHECK-001: Personalized Checklist System
 * - Dynamic item selection and customization
 */

import { nanoid } from 'nanoid';
import type {
  AssessmentResults,
  ChecklistItemTemplate,
  ChecklistGenerationOptions,
} from './types';
import { ALL_CHECKLIST_TEMPLATES } from './templates';
import {
  filterTemplatesByAssessment,
  customizeTemplate,
  getTemplatesForPhase,
  sortTemplatesByPriority,
  validateAssessmentResults,
} from './selectionRules';
import type { ChecklistItem } from '../../db/schema/checklistItems.schema';
import { createDefaultChecklistItem } from '../../db/schema/checklistItems.schema';

/**
 * Generate device ID for CRDT versioning
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
 * Generate checklist items from a template
 *
 * @param template - The template to convert
 * @param assessment - User's assessment results
 * @returns ChecklistItem (without encryption, ready for database)
 */
export function generateItemFromTemplate(
  template: ChecklistItemTemplate,
  assessment: AssessmentResults
): Omit<ChecklistItem, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'version_vector'> {
  // Customize the template for this user
  const customized = customizeTemplate(template, assessment);

  const deviceId = getDeviceId();
  const defaults = createDefaultChecklistItem(
    assessment.userId,
    assessment.companyId,
    customized.phase,
    customized.category,
    customized.title,
    customized.description,
    deviceId
  );

  return {
    ...defaults,
    order: customized.order,
    linked_feature: customized.linkedFeature,
    template_id: template.id,
    business_type: assessment.businessType,
    literacy_level: assessment.literacyLevel,
  } as Omit<ChecklistItem, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'version_vector'>;
}

/**
 * Generate all applicable checklist items for a user
 *
 * @param assessment - User's assessment results
 * @param options - Generation options
 * @returns Array of checklist items to create
 */
export function generateChecklistItems(
  assessment: AssessmentResults,
  options?: ChecklistGenerationOptions
): Omit<ChecklistItem, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'version_vector'>[] {
  // Validate assessment results
  const validationErrors = validateAssessmentResults(assessment);
  if (validationErrors.length > 0) {
    throw new Error(`Invalid assessment results: ${validationErrors.join(', ')}`);
  }

  // Get all templates (default + custom)
  const allTemplates = options?.customTemplates
    ? [...ALL_CHECKLIST_TEMPLATES, ...options.customTemplates]
    : ALL_CHECKLIST_TEMPLATES;

  // Filter templates based on assessment
  const applicableTemplates = filterTemplatesByAssessment(allTemplates, assessment);

  // Sort by priority
  const sortedTemplates = sortTemplatesByPriority(applicableTemplates, assessment);

  // Generate items from templates
  return sortedTemplates.map((template) => generateItemFromTemplate(template, assessment));
}

/**
 * Generate checklist items for a specific phase only
 *
 * @param phase - The phase to generate items for
 * @param assessment - User's assessment results
 * @param options - Generation options
 * @returns Array of checklist items for the phase
 */
export function generateChecklistItemsForPhase(
  assessment: AssessmentResults,
  options?: ChecklistGenerationOptions
): Omit<ChecklistItem, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'version_vector'>[] {
  // Validate assessment results
  const validationErrors = validateAssessmentResults(assessment);
  if (validationErrors.length > 0) {
    throw new Error(`Invalid assessment results: ${validationErrors.join(', ')}`);
  }

  // Get all templates (default + custom)
  const allTemplates = options?.customTemplates
    ? [...ALL_CHECKLIST_TEMPLATES, ...options.customTemplates]
    : ALL_CHECKLIST_TEMPLATES;

  // Get templates for the user's current phase
  const phaseTemplates = getTemplatesForPhase(assessment.phase, allTemplates, assessment);

  // Sort by priority
  const sortedTemplates = sortTemplatesByPriority(phaseTemplates, assessment);

  // Generate items from templates
  return sortedTemplates.map((template) => generateItemFromTemplate(template, assessment));
}

/**
 * Preview checklist generation without creating items
 * Useful for showing users what their checklist will look like
 *
 * @param assessment - User's assessment results
 * @param options - Generation options
 * @returns Summary of what would be generated
 */
export function previewChecklistGeneration(
  assessment: AssessmentResults,
  options?: ChecklistGenerationOptions
): {
  totalItems: number;
  byPhase: Record<string, number>;
  byCategory: Record<string, number>;
  templates: ChecklistItemTemplate[];
} {
  // Validate assessment results
  const validationErrors = validateAssessmentResults(assessment);
  if (validationErrors.length > 0) {
    throw new Error(`Invalid assessment results: ${validationErrors.join(', ')}`);
  }

  // Get all templates (default + custom)
  const allTemplates = options?.customTemplates
    ? [...ALL_CHECKLIST_TEMPLATES, ...options.customTemplates]
    : ALL_CHECKLIST_TEMPLATES;

  // Filter templates based on assessment
  const applicableTemplates = filterTemplatesByAssessment(allTemplates, assessment);

  // Customize templates
  const customizedTemplates = applicableTemplates.map((t) => customizeTemplate(t, assessment));

  // Count by phase
  const byPhase: Record<string, number> = {};
  customizedTemplates.forEach((t) => {
    byPhase[t.phase] = (byPhase[t.phase] || 0) + 1;
  });

  // Count by category
  const byCategory: Record<string, number> = {};
  customizedTemplates.forEach((t) => {
    byCategory[t.category] = (byCategory[t.category] || 0) + 1;
  });

  return {
    totalItems: customizedTemplates.length,
    byPhase,
    byCategory,
    templates: sortTemplatesByPriority(customizedTemplates, assessment),
  };
}

/**
 * Determine if checklist needs regeneration
 * True if user's phase or business characteristics have changed significantly
 *
 * @param currentAssessment - Current assessment results
 * @param previousAssessment - Previous assessment results
 * @returns true if checklist should be regenerated
 */
export function shouldRegenerateChecklist(
  currentAssessment: AssessmentResults,
  previousAssessment: AssessmentResults
): boolean {
  // Phase change always triggers regeneration
  if (currentAssessment.phase !== previousAssessment.phase) {
    return true;
  }

  // Business type change triggers regeneration
  if (currentAssessment.businessType !== previousAssessment.businessType) {
    return true;
  }

  // Significant literacy level change (2+ levels)
  if (Math.abs(currentAssessment.literacyLevel - previousAssessment.literacyLevel) >= 2) {
    return true;
  }

  // Major business characteristic changes
  const characteristicChanges = [
    currentAssessment.hasEmployees !== previousAssessment.hasEmployees,
    currentAssessment.hasInventory !== previousAssessment.hasInventory,
    currentAssessment.acceptsOnlinePayments !== previousAssessment.acceptsOnlinePayments,
    currentAssessment.sellsProducts !== previousAssessment.sellsProducts,
    currentAssessment.sellsServices !== previousAssessment.sellsServices,
    currentAssessment.needsInvoicing !== previousAssessment.needsInvoicing,
    currentAssessment.hasMultipleCurrencies !== previousAssessment.hasMultipleCurrencies,
  ];

  // If 2 or more major characteristics changed, regenerate
  const changeCount = characteristicChanges.filter(Boolean).length;
  return changeCount >= 2;
}

/**
 * Get templates that would be added based on assessment change
 *
 * @param currentAssessment - Current assessment results
 * @param previousAssessment - Previous assessment results
 * @returns Templates that would be newly applicable
 */
export function getNewlyApplicableTemplates(
  currentAssessment: AssessmentResults,
  previousAssessment: AssessmentResults
): ChecklistItemTemplate[] {
  // Get templates for both assessments
  const currentTemplates = filterTemplatesByAssessment(ALL_CHECKLIST_TEMPLATES, currentAssessment);
  const previousTemplates = filterTemplatesByAssessment(
    ALL_CHECKLIST_TEMPLATES,
    previousAssessment
  );

  // Find templates that are in current but not in previous
  const previousIds = new Set(previousTemplates.map((t) => t.id));
  const newTemplates = currentTemplates.filter((t) => !previousIds.has(t.id));

  return newTemplates;
}

/**
 * Get templates that would be removed based on assessment change
 *
 * @param currentAssessment - Current assessment results
 * @param previousAssessment - Previous assessment results
 * @returns Templates that would no longer be applicable
 */
export function getNoLongerApplicableTemplates(
  currentAssessment: AssessmentResults,
  previousAssessment: AssessmentResults
): ChecklistItemTemplate[] {
  // Get templates for both assessments
  const currentTemplates = filterTemplatesByAssessment(ALL_CHECKLIST_TEMPLATES, currentAssessment);
  const previousTemplates = filterTemplatesByAssessment(
    ALL_CHECKLIST_TEMPLATES,
    previousAssessment
  );

  // Find templates that are in previous but not in current
  const currentIds = new Set(currentTemplates.map((t) => t.id));
  const removedTemplates = previousTemplates.filter((t) => !currentIds.has(t.id));

  return removedTemplates;
}

/**
 * Create a simplified assessment from user inputs
 * This is a helper for when you have individual fields rather than full assessment
 *
 * @param params - Individual assessment parameters
 * @returns Complete AssessmentResults object
 */
export function createAssessmentResults(params: {
  userId: string;
  companyId: string;
  phase: string;
  businessType: string;
  literacyLevel: number;
  hasEmployees?: boolean;
  hasInventory?: boolean;
  acceptsOnlinePayments?: boolean;
  sellsProducts?: boolean;
  sellsServices?: boolean;
  needsInvoicing?: boolean;
  tracksMileage?: boolean;
  hasMultipleCurrencies?: boolean;
  isRegisteredBusiness?: boolean;
}): AssessmentResults {
  return {
    userId: params.userId,
    companyId: params.companyId,
    phase: params.phase as any,
    businessType: params.businessType as any,
    literacyLevel: params.literacyLevel as any,
    hasEmployees: params.hasEmployees ?? false,
    hasInventory: params.hasInventory ?? false,
    acceptsOnlinePayments: params.acceptsOnlinePayments ?? false,
    sellsProducts: params.sellsProducts ?? false,
    sellsServices: params.sellsServices ?? false,
    needsInvoicing: params.needsInvoicing ?? false,
    tracksMileage: params.tracksMileage ?? false,
    hasMultipleCurrencies: params.hasMultipleCurrencies ?? false,
    isRegisteredBusiness: params.isRegisteredBusiness ?? false,
  };
}
