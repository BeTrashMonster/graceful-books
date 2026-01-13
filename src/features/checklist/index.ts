/**
 * Checklist Feature Module
 *
 * Exports all public APIs for the checklist generation and management system.
 */

// Types
export type {
  BusinessType,
  FinancialLiteracyLevel,
  AssessmentResults,
  ChecklistItemTemplate,
  ChecklistGenerationOptions,
  ChecklistGenerationResult,
  ChecklistStats,
} from './types';

export { BusinessType as ChecklistBusinessType } from './types';

// Generator
export {
  generateItemFromTemplate,
  generateChecklistItems,
  generateChecklistItemsForPhase,
  previewChecklistGeneration,
  shouldRegenerateChecklist,
  getNewlyApplicableTemplates,
  getNoLongerApplicableTemplates,
  createAssessmentResults,
} from './checklistGenerator';

// Selection Rules
export {
  shouldIncludeTemplate,
  filterTemplatesByAssessment,
  getCustomizedTitle,
  getCustomizedDescription,
  customizeTemplate,
  getTemplatesForPhase,
  calculateTemplatePriority,
  sortTemplatesByPriority,
  validateAssessmentResults,
} from './selectionRules';

// Templates
export {
  ALL_CHECKLIST_TEMPLATES,
  getTemplatesByPhase,
  getTemplatesByCategory,
  getTemplateById,
} from './templates';
