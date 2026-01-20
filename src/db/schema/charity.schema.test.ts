/**
 * Charity Schema Tests
 */

import { describe, it, expect } from 'vitest';
import {
  createDefaultCharity,
  validateCharity,
  getCategoryDisplay,
  getCategoryDescription,
} from './charity.schema';

describe('Charity Schema', () => {
  describe('createDefaultCharity', () => {
    it('should create a charity with all required fields', () => {
      const charity = createDefaultCharity(
        'Test Charity',
        '12-3456789',
        'A test charity description',
        'EDUCATION' as any,
        'https://testcharity.org'
      );

      expect(charity.name).toBe('Test Charity');
      expect(charity.description).toBe('A test charity description');
      expect(charity.category).toBe('EDUCATION');
      expect(charity.website).toBe('https://testcharity.org');
      expect(charity.active).toBe(true);
      expect(charity.logo).toBeNull();
    });

    it('should include logo when provided', () => {
      const charity = createDefaultCharity(
        'Test Charity',
        '23-4567890',
        'Description',
        'HEALTH' as any,
        'https://testcharity.org',
        undefined,
        'test-logo'
      );

      expect(charity.logo).toBe('test-logo');
    });
  });

  describe('validateCharity', () => {
    it('should pass validation for valid charity', () => {
      const charity = createDefaultCharity(
        'Valid Charity',
        '34-5678901',
        'Valid description',
        'EDUCATION' as any,
        'https://validcharity.org'
      );

      const errors = validateCharity(charity);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation when name is missing', () => {
      const charity = {
        name: '',
        description: 'Test description',
        category: 'education',
        website: 'https://test.org',
      };

      const errors = validateCharity(charity as any);
      expect(errors).toContain('name is required');
    });

    it('should fail validation when description is missing', () => {
      const charity = {
        name: 'Test Charity',
        description: '',
        category: 'education',
        website: 'https://test.org',
      };

      const errors = validateCharity(charity as any);
      expect(errors).toContain('description is required');
    });

    it('should fail validation when category is missing', () => {
      const charity = {
        name: 'Test Charity',
        description: 'Test description',
        website: 'https://test.org',
      };

      const errors = validateCharity(charity as any);
      expect(errors).toContain('category is required');
    });

    it('should fail validation when website is missing', () => {
      const charity = {
        name: 'Test Charity',
        description: 'Test description',
        category: 'education',
        website: '',
      };

      const errors = validateCharity(charity as any);
      expect(errors).toContain('website is required');
    });

    it('should fail validation for invalid website URL', () => {
      const charity = {
        name: 'Test Charity',
        description: 'Test description',
        category: 'education',
        website: 'not-a-valid-url',
      };

      const errors = validateCharity(charity as any);
      expect(errors).toContain('website must be a valid URL');
    });

    it('should collect multiple validation errors', () => {
      const charity = {
        name: '',
        description: '',
        website: 'invalid-url',
      };

      const errors = validateCharity(charity as any);
      expect(errors.length).toBeGreaterThan(1);
      expect(errors).toContain('name is required');
      expect(errors).toContain('description is required');
    });
  });

  describe('getCategoryDisplay', () => {
    it('should return correct display name for each category', () => {
      expect(getCategoryDisplay('EDUCATION' as any)).toBe('Education');
      expect(getCategoryDisplay('ENVIRONMENT' as any)).toBe('Environment');
      expect(getCategoryDisplay('HEALTH' as any)).toBe('Health');
      expect(getCategoryDisplay('POVERTY' as any)).toBe('Poverty Relief');
      expect(getCategoryDisplay('ANIMAL_WELFARE' as any)).toBe('Animal Welfare');
      expect(getCategoryDisplay('HUMAN_RIGHTS' as any)).toBe('Human Rights');
      expect(getCategoryDisplay('DISASTER_RELIEF' as any)).toBe('Disaster Relief');
      expect(getCategoryDisplay('ARTS_CULTURE' as any)).toBe('Arts & Culture');
      expect(getCategoryDisplay('COMMUNITY' as any)).toBe('Community Development');
      expect(getCategoryDisplay('OTHER' as any)).toBe('Other');
    });
  });

  describe('getCategoryDescription', () => {
    it('should return descriptive text for each category', () => {
      expect(getCategoryDescription('EDUCATION' as any)).toContain('learning');
      expect(getCategoryDescription('ENVIRONMENT' as any)).toContain('natural');
      expect(getCategoryDescription('HEALTH' as any)).toContain('health');
      expect(getCategoryDescription('POVERTY' as any)).toContain('economic');
      expect(getCategoryDescription('ANIMAL_WELFARE' as any)).toContain('animals');
      expect(getCategoryDescription('HUMAN_RIGHTS' as any)).toContain('equality');
      expect(getCategoryDescription('DISASTER_RELIEF' as any)).toContain('disaster');
      expect(getCategoryDescription('ARTS_CULTURE' as any)).toContain('creative');
      expect(getCategoryDescription('COMMUNITY' as any)).toContain('communities');
      expect(getCategoryDescription('OTHER' as any)).toContain('charitable');
    });
  });
});
