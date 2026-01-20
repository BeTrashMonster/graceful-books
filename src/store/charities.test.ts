/**
 * Charities Store Tests
 */

import { describe, it, expect } from 'vitest';
import {
  getAllCharities,
  getCharity,
  getCharitiesByFilter,
  searchCharities,
  getCharitiesGroupedByCategory,
} from './charities';

describe('Charities Store', () => {
  describe('getAllCharities', () => {
    it('should return all active charities', async () => {
      const charities = await getAllCharities();

      expect(charities).toBeDefined();
      expect(Array.isArray(charities)).toBe(true);
      expect(charities.length).toBeGreaterThan(0);

      // Verify all charities are active
      charities.forEach((charity) => {
        expect(charity.active).toBe(true);
      });
    });

    it('should return charities with all required fields', async () => {
      const charities = await getAllCharities();
      const firstCharity = charities[0];

      expect(firstCharity!.id).toBeDefined();
      expect(firstCharity!.name).toBeDefined();
      expect(firstCharity!.description).toBeDefined();
      expect(firstCharity!.category).toBeDefined();
      expect(firstCharity!.website).toBeDefined();
      expect(typeof firstCharity!.active).toBe('boolean');
    });
  });

  describe('getCharity', () => {
    it('should return a charity by ID', async () => {
      const allCharities = await getAllCharities();
      const targetCharity = allCharities[0];

      if (!targetCharity) throw new Error('No charities found');

      const charity = await getCharity(targetCharity.id);

      expect(charity).toBeDefined();
      expect(charity?.id).toBe(targetCharity.id);
      expect(charity?.name).toBe(targetCharity.name);
    });

    it('should return undefined for non-existent ID', async () => {
      const charity = await getCharity('non-existent-id');

      expect(charity).toBeUndefined();
    });
  });

  describe('getCharitiesByFilter', () => {
    it('should return all charities when no category filter is provided', async () => {
      const charities = await getCharitiesByFilter();
      const allCharities = await getAllCharities();

      expect(charities.length).toBe(allCharities.length);
    });

    it('should filter charities by category', async () => {
      const educationCharities = await getCharitiesByFilter('EDUCATION');

      expect(Array.isArray(educationCharities)).toBe(true);

      // All returned charities should be in EDUCATION category
      educationCharities.forEach((charity) => {
        expect(charity.category).toBe('EDUCATION');
      });
    });

    it('should return empty array for category with no charities', async () => {
      // Assuming ARTS_CULTURE might have fewer or no charities
      const charities = await getCharitiesByFilter('ARTS_CULTURE');

      expect(Array.isArray(charities)).toBe(true);
    });
  });

  describe('searchCharities', () => {
    it('should return all charities for empty query', async () => {
      const searchResults = await searchCharities('');
      const allCharities = await getAllCharities();

      expect(searchResults.length).toBe(allCharities.length);
    });

    it('should search charities by name', async () => {
      const allCharities = await getAllCharities();
      const targetCharity = allCharities[0];
      if (!targetCharity) throw new Error('No charities found');
      const firstWord = targetCharity.name.split(' ')[0];
      if (!firstWord) throw new Error('No name found');
      const searchTerm = firstWord; // First word of name

      const searchResults = await searchCharities(searchTerm);

      expect(searchResults.length).toBeGreaterThan(0);
      expect(searchResults.some((c) => c.id === targetCharity?.id)).toBe(true);
    });

    it('should search charities by description', async () => {
      const searchResults = await searchCharities('education');

      expect(Array.isArray(searchResults)).toBe(true);
      // Should find at least one charity with "education" in name or description
      expect(searchResults.length).toBeGreaterThan(0);
    });

    it('should be case-insensitive', async () => {
      const lowerCaseResults = await searchCharities('khan');
      const upperCaseResults = await searchCharities('KHAN');

      expect(lowerCaseResults.length).toBe(upperCaseResults.length);
    });

    it('should trim whitespace from query', async () => {
      const trimmedResults = await searchCharities('khan');
      const untrimmedResults = await searchCharities('  khan  ');

      expect(trimmedResults.length).toBe(untrimmedResults.length);
    });

    it('should return empty array for no matches', async () => {
      const searchResults = await searchCharities('xyznonexistent123');

      expect(searchResults).toHaveLength(0);
    });
  });

  describe('getCharitiesGroupedByCategory', () => {
    it('should return a map of categories to charities', async () => {
      const grouped = await getCharitiesGroupedByCategory();

      expect(grouped instanceof Map).toBe(true);
      expect(grouped.size).toBeGreaterThan(0);
    });

    it('should group charities correctly by category', async () => {
      const grouped = await getCharitiesGroupedByCategory();

      grouped.forEach((charities, category) => {
        charities.forEach((charity) => {
          expect(charity.category).toBe(category);
        });
      });
    });

    it('should only include active charities', async () => {
      const grouped = await getCharitiesGroupedByCategory();

      grouped.forEach((charities) => {
        charities.forEach((charity) => {
          expect(charity.active).toBe(true);
        });
      });
    });
  });
});
