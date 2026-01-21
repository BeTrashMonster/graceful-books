/**
 * Charity Schema Definition
 *
 * Defines the structure for charities that users can select to support.
 * Each user selects a charity during signup, and $5 from their monthly
 * subscription goes to their chosen charity.
 *
 * Requirements:
 * - CHARITY-001: Charity selection during signup
 */

import type { Charity, CharityCategory } from '../../types/database.types';
import { CharityStatus } from '../../types/database.types';

/**
 * Dexie.js schema definition for Charities table
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - category: For filtering by charity type
 * - status: For filtering by verification status
 * - active: For querying only active charities
 * - ein: For EIN lookup
 */
export const charitiesSchema = 'id, category, status, active, ein';

/**
 * Table name constant
 */
export const CHARITIES_TABLE = 'charities';

/**
 * Default values for new Charity
 */
export const createDefaultCharity = (
  name: string,
  ein: string,
  description: string,
  category: CharityCategory,
  website: string,
  createdBy?: string,
  logo?: string
): Partial<Charity> => {
  const now = Date.now();
  return {
    name,
    ein,
    description,
    category,
    website,
    logo: logo || null,
    status: CharityStatus.PENDING,
    verification_notes: null,
    rejection_reason: null,
    created_by: createdBy || null,
    created_at: now,
    updated_at: now,
    active: true,
  };
};

/**
 * Validation: Ensure charity has required fields
 */
export const validateCharity = (charity: Partial<Charity>): string[] => {
  const errors: string[] = [];

  if (!charity.name || charity.name.trim() === '') {
    errors.push('name is required');
  }

  if (!charity.ein || charity.ein.trim() === '') {
    errors.push('EIN is required');
  }

  // Validate EIN format (XX-XXXXXXX)
  if (charity.ein && !isValidEIN(charity.ein)) {
    errors.push('EIN must be in format XX-XXXXXXX (e.g., 12-3456789)');
  }

  if (!charity.description || charity.description.trim() === '') {
    errors.push('description is required');
  }

  if (!charity.category) {
    errors.push('category is required');
  }

  if (!charity.website || charity.website.trim() === '') {
    errors.push('website is required');
  }

  // Validate website URL format
  if (charity.website && !isValidUrl(charity.website)) {
    errors.push('website must be a valid URL');
  }

  return errors;
};

/**
 * Helper: Validate URL format
 */
const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Helper: Validate EIN format (XX-XXXXXXX)
 */
export const isValidEIN = (ein: string): boolean => {
  const einRegex = /^\d{2}-\d{7}$/;
  return einRegex.test(ein);
};

/**
 * Helper: Get category display name
 */
export const getCategoryDisplay = (category: CharityCategory): string => {
  const displays: Record<CharityCategory, string> = {
    EDUCATION: 'Education',
    ENVIRONMENT: 'Environment',
    HEALTH: 'Health',
    POVERTY: 'Poverty Relief',
    ANIMAL_WELFARE: 'Animal Welfare',
    HUMAN_RIGHTS: 'Human Rights',
    DISASTER_RELIEF: 'Disaster Relief',
    ARTS_CULTURE: 'Arts & Culture',
    COMMUNITY: 'Community Development',
    OTHER: 'Other',
  };
  return displays[category];
};

/**
 * Helper: Get category description
 */
export const getCategoryDescription = (category: CharityCategory): string => {
  const descriptions: Record<CharityCategory, string> = {
    EDUCATION: 'Support learning and educational opportunities',
    ENVIRONMENT: 'Protect and preserve our natural world',
    HEALTH: 'Improve health and medical care access',
    POVERTY: 'Help those in economic need',
    ANIMAL_WELFARE: 'Protect and care for animals',
    HUMAN_RIGHTS: 'Promote equality and justice',
    DISASTER_RELIEF: 'Aid communities affected by disasters',
    ARTS_CULTURE: 'Support creative and cultural endeavors',
    COMMUNITY: 'Build stronger communities',
    OTHER: 'Other charitable causes',
  };
  return descriptions[category];
};

/**
 * Query helper: Get charities by category
 */
export interface GetCharitiesByCategoryQuery {
  category: CharityCategory;
  active?: boolean;
}
