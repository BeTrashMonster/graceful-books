/**
 * Checklist Feature Types
 *
 * Type definitions for the checklist generation and management system.
 * These types support personalized checklist generation based on assessment results.
 */

import type { ChecklistPhase, ChecklistCategory } from '../../db/schema/checklistItems.schema';

/**
 * Business type categories for checklist customization
 */
export enum BusinessType {
  FREELANCER = 'FREELANCER', // Solo freelancer/contractor
  CONSULTANT = 'CONSULTANT', // Professional consultant
  CREATIVE = 'CREATIVE', // Artist, designer, writer, etc.
  SERVICE_PROVIDER = 'SERVICE_PROVIDER', // Service-based business
  PRODUCT_BUSINESS = 'PRODUCT_BUSINESS', // Physical products
  ECOMMERCE = 'ECOMMERCE', // Online product sales
  AGENCY = 'AGENCY', // Agency with employees/contractors
  RETAIL = 'RETAIL', // Brick and mortar retail
  RESTAURANT = 'RESTAURANT', // Food service
  OTHER = 'OTHER', // Other business type
}

/**
 * Financial literacy level (1-5)
 * Determines depth and complexity of checklist items
 */
export type FinancialLiteracyLevel = 1 | 2 | 3 | 4 | 5;

/**
 * Assessment results that drive checklist generation
 * This is a simplified version - full assessment results will come from C1
 */
export interface AssessmentResults {
  userId: string;
  companyId: string;
  phase: ChecklistPhase;
  businessType: BusinessType;
  literacyLevel: FinancialLiteracyLevel;
  hasEmployees: boolean;
  hasInventory: boolean;
  acceptsOnlinePayments: boolean;
  sellsProducts: boolean;
  sellsServices: boolean;
  needsInvoicing: boolean;
  tracksMileage: boolean;
  hasMultipleCurrencies: boolean;
  isRegisteredBusiness: boolean;
}

/**
 * Checklist item template
 * Templates are selected and customized based on assessment results
 */
export interface ChecklistItemTemplate {
  id: string; // Unique template ID
  phase: ChecklistPhase; // Which phase this template belongs to
  category: ChecklistCategory; // When to do this task
  title: string; // Task title
  description: string; // Detailed description with guidance
  order: number; // Default sort order
  linkedFeature: string | null; // Route/feature this links to

  // Selection criteria - determines if this template should be included
  selectionRules: {
    requiredPhases?: ChecklistPhase[]; // Only show in these phases
    businessTypes?: BusinessType[]; // Only for these business types
    minLiteracyLevel?: FinancialLiteracyLevel; // Minimum literacy level
    maxLiteracyLevel?: FinancialLiteracyLevel; // Maximum literacy level
    requiresEmployees?: boolean; // Only if has employees
    requiresInventory?: boolean; // Only if tracks inventory
    requiresOnlinePayments?: boolean; // Only if accepts online payments
    requiresProducts?: boolean; // Only if sells products
    requiresServices?: boolean; // Only if sells services
    requiresInvoicing?: boolean; // Only if needs invoicing
    requiresMileageTracking?: boolean; // Only if tracks mileage
    requiresMultiCurrency?: boolean; // Only if uses multiple currencies
  };

  // Customization - how to adjust the item based on context
  customization?: {
    titleVariants?: Partial<Record<BusinessType, string>>; // Custom title by business type
    descriptionVariants?: Partial<Record<BusinessType, string>>; // Custom description
    literacyLevelDescriptions?: Partial<Record<FinancialLiteracyLevel, string>>; // Adjust depth by literacy
  };
}

/**
 * Checklist generation options
 */
export interface ChecklistGenerationOptions {
  includeCompleted?: boolean; // Include items the user has already completed
  regenerate?: boolean; // Regenerate all items (vs. just add new ones)
  customTemplates?: ChecklistItemTemplate[]; // Add custom templates beyond defaults
}

/**
 * Checklist generation result
 */
export interface ChecklistGenerationResult {
  generated: number; // Number of new items generated
  skipped: number; // Number of templates skipped (already exist)
  total: number; // Total items after generation
  itemIds: string[]; // IDs of newly generated items
}

/**
 * Checklist statistics
 */
export interface ChecklistStats {
  total: number;
  completed: number;
  pending: number;
  snoozed: number;
  notApplicable: number;
  overdue: number;
  streakCount: number; // Highest streak
  completionRate: number; // Percentage (0-100)
  byCategory: Record<ChecklistCategory, {
    total: number;
    completed: number;
    pending: number;
  }>;
}
