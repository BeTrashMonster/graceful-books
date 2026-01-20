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
        'EDUCATION',
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
        'HEALTH',
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
        'EDUCATION',
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

      const errors = validateCharity(charity);
      expect(errors).toContain('name is required');
    });

    it('should fail validation when description is missing', () => {
      const charity = {
        name: 'Test Charity',
        description: '',
        category: 'education',
        website: 'https://test.org',
      };

      const errors = validateCharity(charity);
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

      const errors = validateCharity(charity);
      expect(errors).toContain('website is required');
    });

    it('should fail validation for invalid website URL', () => {
      const charity = {
        name: 'Test Charity',
        description: 'Test description',
        category: 'education',
        website: 'not-a-valid-url',
      };

      const errors = validateCharity(charity);
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
      expect(getCategoryDisplay('EDUCATION')).toBe('Education');
      expect(getCategoryDisplay('ENVIRONMENT')).toBe('Environment');
      expect(getCategoryDisplay('HEALTH')).toBe('Health');
      expect(getCategoryDisplay('POVERTY')).toBe('Poverty Relief');
      expect(getCategoryDisplay('ANIMAL_WELFARE')).toBe('Animal Welfare');
      expect(getCategoryDisplay('HUMAN_RIGHTS')).toBe('Human Rights');
      expect(getCategoryDisplay('DISASTER_RELIEF')).toBe('Disaster Relief');
      expect(getCategoryDisplay('ARTS_CULTURE')).toBe('Arts & Culture');
      expect(getCategoryDisplay('COMMUNITY')).toBe('Community Development');
      expect(getCategoryDisplay('OTHER')).toBe('Other');
    });
  });

  describe('getCategoryDescription', () => {
    it('should return descriptive text for each category', () => {
      expect(getCategoryDescription('EDUCATION')).toContain('learning');
      expect(getCategoryDescription('ENVIRONMENT')).toContain('natural');
      expect(getCategoryDescription('HEALTH')).toContain('health');
      expect(getCategoryDescription('POVERTY')).toContain('economic');
      expect(getCategoryDescription('ANIMAL_WELFARE')).toContain('animals');
      expect(getCategoryDescription('HUMAN_RIGHTS')).toContain('equality');
      expect(getCategoryDescription('DISASTER_RELIEF')).toContain('disaster');
      expect(getCategoryDescription('ARTS_CULTURE')).toContain('creative');
      expect(getCategoryDescription('COMMUNITY')).toContain('communities');
      expect(getCategoryDescription('OTHER')).toContain('charitable');
    });
  });
});
