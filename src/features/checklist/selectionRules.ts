/**
 * Checklist Item Selection Rules
 *
 * Logic for determining which checklist templates should be included
 * for a given user based on their assessment results.
 *
 * Requirements:
 * - C3: Checklist Generation Engine
 * - CHECK-001: Dynamic item selection based on user profile
 */

import type { ChecklistItemTemplate, AssessmentResults } from './types';
import { ChecklistPhase } from '../../db/schema/checklistItems.schema';

/**
 * Determine if a template should be included based on selection rules
 *
 * @param template - The template to evaluate
 * @param assessment - User's assessment results
 * @returns true if template should be included, false otherwise
 */
export function shouldIncludeTemplate(
  template: ChecklistItemTemplate,
  assessment: AssessmentResults
): boolean {
  const rules = template.selectionRules;

  // Check phase requirement
  if (rules.requiredPhases && rules.requiredPhases.length > 0) {
    if (!rules.requiredPhases.includes(assessment.phase)) {
      return false;
    }
  }

  // Check business type requirement
  if (rules.businessTypes && rules.businessTypes.length > 0) {
    if (!rules.businessTypes.includes(assessment.businessType)) {
      return false;
    }
  }

  // Check literacy level requirements
  if (rules.minLiteracyLevel !== undefined) {
    if (assessment.literacyLevel < rules.minLiteracyLevel) {
      return false;
    }
  }

  if (rules.maxLiteracyLevel !== undefined) {
    if (assessment.literacyLevel > rules.maxLiteracyLevel) {
      return false;
    }
  }

  // Check conditional requirements
  if (rules.requiresEmployees === true && !assessment.hasEmployees) {
    return false;
  }

  if (rules.requiresInventory === true && !assessment.hasInventory) {
    return false;
  }

  if (rules.requiresOnlinePayments === true && !assessment.acceptsOnlinePayments) {
    return false;
  }

  if (rules.requiresProducts === true && !assessment.sellsProducts) {
    return false;
  }

  if (rules.requiresServices === true && !assessment.sellsServices) {
    return false;
  }

  if (rules.requiresInvoicing === true && !assessment.needsInvoicing) {
    return false;
  }

  if (rules.requiresMileageTracking === true && !assessment.tracksMileage) {
    return false;
  }

  if (rules.requiresMultiCurrency === true && !assessment.hasMultipleCurrencies) {
    return false;
  }

  // All checks passed
  return true;
}

/**
 * Filter templates based on assessment results
 *
 * @param templates - Array of templates to filter
 * @param assessment - User's assessment results
 * @returns Filtered array of templates that should be included
 */
export function filterTemplatesByAssessment(
  templates: ChecklistItemTemplate[],
  assessment: AssessmentResults
): ChecklistItemTemplate[] {
  return templates.filter((template) => shouldIncludeTemplate(template, assessment));
}

/**
 * Get the appropriate title for a template based on business type
 *
 * @param template - The template
 * @param assessment - User's assessment results
 * @returns Customized title or default title
 */
export function getCustomizedTitle(
  template: ChecklistItemTemplate,
  assessment: AssessmentResults
): string {
  const variants = template.customization?.titleVariants;

  if (!variants) {
    return template.title;
  }

  // Check for business type specific variant
  const customTitle = variants[assessment.businessType];
  return customTitle || template.title;
}

/**
 * Get the appropriate description for a template based on assessment results
 *
 * @param template - The template
 * @param assessment - User's assessment results
 * @returns Customized description or default description
 */
export function getCustomizedDescription(
  template: ChecklistItemTemplate,
  assessment: AssessmentResults
): string {
  const customization = template.customization;

  if (!customization) {
    return template.description;
  }

  // Check for literacy level specific description first (more specific)
  if (customization.literacyLevelDescriptions) {
    const literacyDesc = customization.literacyLevelDescriptions[assessment.literacyLevel];
    if (literacyDesc) {
      return literacyDesc;
    }
  }

  // Check for business type specific description
  if (customization.descriptionVariants) {
    const businessDesc = customization.descriptionVariants[assessment.businessType];
    if (businessDesc) {
      return businessDesc;
    }
  }

  // Return default description
  return template.description;
}

/**
 * Customize a template based on assessment results
 *
 * @param template - The template to customize
 * @param assessment - User's assessment results
 * @returns Template with customized title and description
 */
export function customizeTemplate(
  template: ChecklistItemTemplate,
  assessment: AssessmentResults
): ChecklistItemTemplate {
  return {
    ...template,
    title: getCustomizedTitle(template, assessment),
    description: getCustomizedDescription(template, assessment),
  };
}

/**
 * Get templates for a specific phase, filtered and customized
 *
 * @param phase - The phase to get templates for
 * @param templates - All available templates
 * @param assessment - User's assessment results
 * @returns Filtered and customized templates for the phase
 */
export function getTemplatesForPhase(
  phase: ChecklistPhase,
  templates: ChecklistItemTemplate[],
  assessment: AssessmentResults
): ChecklistItemTemplate[] {
  // Filter templates to the requested phase
  const phaseTemplates = templates.filter((t) => t.phase === phase);

  // Filter by selection rules
  const applicableTemplates = filterTemplatesByAssessment(phaseTemplates, assessment);

  // Customize each template
  return applicableTemplates.map((t) => customizeTemplate(t, assessment));
}

/**
 * Calculate priority score for a template based on assessment
 * Higher score = higher priority
 *
 * This can be used to determine which items to show first or emphasize
 *
 * @param template - The template to score
 * @param assessment - User's assessment results
 * @returns Priority score (0-100)
 */
export function calculateTemplatePriority(
  template: ChecklistItemTemplate,
  assessment: AssessmentResults
): number {
  let score = 50; // Base score

  // Setup tasks are higher priority in early phases
  if (template.category === 'SETUP') {
    if (assessment.phase === ChecklistPhase.STABILIZE) {
      score += 30;
    } else if (assessment.phase === ChecklistPhase.ORGANIZE) {
      score += 20;
    }
  }

  // Daily tasks are always important
  if (template.category === 'DAILY') {
    score += 15;
  }

  // Boost score for templates that match specific needs
  const rules = template.selectionRules;

  if (rules.requiresInvoicing && assessment.needsInvoicing) {
    score += 10;
  }

  if (rules.requiresInventory && assessment.hasInventory) {
    score += 10;
  }

  if (rules.requiresEmployees && assessment.hasEmployees) {
    score += 10;
  }

  // Lower literacy users get boosted priority for simpler tasks
  if (assessment.literacyLevel <= 2) {
    if (!rules.minLiteracyLevel || rules.minLiteracyLevel <= 2) {
      score += 10;
    }
  }

  // Higher literacy users get boosted priority for advanced tasks
  if (assessment.literacyLevel >= 4) {
    if (rules.minLiteracyLevel && rules.minLiteracyLevel >= 4) {
      score += 10;
    }
  }

  // Ensure score stays in 0-100 range
  return Math.max(0, Math.min(100, score));
}

/**
 * Sort templates by priority
 *
 * @param templates - Templates to sort
 * @param assessment - User's assessment results
 * @returns Templates sorted by priority (highest first)
 */
export function sortTemplatesByPriority(
  templates: ChecklistItemTemplate[],
  assessment: AssessmentResults
): ChecklistItemTemplate[] {
  return [...templates].sort((a, b) => {
    const priorityA = calculateTemplatePriority(a, assessment);
    const priorityB = calculateTemplatePriority(b, assessment);

    // Sort by priority (descending)
    if (priorityA !== priorityB) {
      return priorityB - priorityA;
    }

    // If priority is the same, sort by order
    return a.order - b.order;
  });
}

/**
 * Validate assessment results have all required fields
 *
 * @param assessment - Assessment results to validate
 * @returns Array of validation error messages (empty if valid)
 */
export function validateAssessmentResults(assessment: Partial<AssessmentResults>): string[] {
  const errors: string[] = [];

  if (!assessment.userId) {
    errors.push('userId is required');
  }

  if (!assessment.companyId) {
    errors.push('companyId is required');
  }

  if (!assessment.phase) {
    errors.push('phase is required');
  }

  if (!assessment.businessType) {
    errors.push('businessType is required');
  }

  if (!assessment.literacyLevel) {
    errors.push('literacyLevel is required');
  } else if (assessment.literacyLevel < 1 || assessment.literacyLevel > 5) {
    errors.push('literacyLevel must be between 1 and 5');
  }

  if (assessment.hasEmployees === undefined) {
    errors.push('hasEmployees is required');
  }

  if (assessment.hasInventory === undefined) {
    errors.push('hasInventory is required');
  }

  if (assessment.acceptsOnlinePayments === undefined) {
    errors.push('acceptsOnlinePayments is required');
  }

  if (assessment.sellsProducts === undefined) {
    errors.push('sellsProducts is required');
  }

  if (assessment.sellsServices === undefined) {
    errors.push('sellsServices is required');
  }

  if (assessment.needsInvoicing === undefined) {
    errors.push('needsInvoicing is required');
  }

  return errors;
}
