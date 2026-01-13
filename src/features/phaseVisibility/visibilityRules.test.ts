/**
 * Tests for Phase-Based Feature Visibility Rules
 */

import { describe, it, expect } from 'vitest';
import {
  isFeatureAccessible,
  isFeatureVisible,
  getFeatureAccess,
  getFeaturesForPhase,
  getAccessibleFeatures,
  getLockedFeatures,
  getUnlockedFeatures,
  getFeatureMetadata,
  getAllFeatures,
  getFeaturesByCategory,
  getPhaseDescription,
  getNextPhase,
  FEATURE_METADATA,
  PHASE_VISIBILITY_RULES,
} from './visibilityRules';
import type { BusinessPhase } from '../../types';

describe('visibilityRules', () => {
  describe('isFeatureAccessible', () => {
    it('should allow access to Stabilize features in Stabilize phase', () => {
      expect(isFeatureAccessible('dashboard', 'stabilize')).toBe(true);
      expect(isFeatureAccessible('basic-transactions', 'stabilize')).toBe(true);
    });

    it('should not allow access to Organize features in Stabilize phase', () => {
      expect(isFeatureAccessible('categories', 'stabilize')).toBe(false);
      expect(isFeatureAccessible('tags', 'stabilize')).toBe(false);
    });

    it('should allow access to Stabilize features in Organize phase', () => {
      expect(isFeatureAccessible('dashboard', 'organize')).toBe(true);
      expect(isFeatureAccessible('basic-transactions', 'organize')).toBe(true);
    });

    it('should allow access to Organize features in Organize phase', () => {
      expect(isFeatureAccessible('categories', 'organize')).toBe(true);
      expect(isFeatureAccessible('tags', 'organize')).toBe(true);
    });

    it('should not allow access to Build features in Organize phase', () => {
      expect(isFeatureAccessible('invoicing', 'organize')).toBe(false);
      expect(isFeatureAccessible('customers', 'organize')).toBe(false);
    });

    it('should allow access to all previous features in Build phase', () => {
      expect(isFeatureAccessible('dashboard', 'build')).toBe(true);
      expect(isFeatureAccessible('categories', 'build')).toBe(true);
      expect(isFeatureAccessible('invoicing', 'build')).toBe(true);
    });

    it('should allow access to all features in Grow phase', () => {
      expect(isFeatureAccessible('dashboard', 'grow')).toBe(true);
      expect(isFeatureAccessible('categories', 'grow')).toBe(true);
      expect(isFeatureAccessible('invoicing', 'grow')).toBe(true);
      expect(isFeatureAccessible('forecasting', 'grow')).toBe(true);
    });

    it('should return false for non-existent features', () => {
      expect(isFeatureAccessible('non-existent' as any, 'stabilize')).toBe(false);
    });
  });

  describe('isFeatureVisible', () => {
    it('should show Stabilize features in Stabilize phase', () => {
      expect(isFeatureVisible('dashboard', 'stabilize')).toBe(true);
      expect(isFeatureVisible('basic-transactions', 'stabilize')).toBe(true);
    });

    it('should show preview features in Stabilize phase', () => {
      expect(isFeatureVisible('categories', 'stabilize')).toBe(true);
      expect(isFeatureVisible('tags', 'stabilize')).toBe(true);
    });

    it('should not show Build features in Stabilize phase', () => {
      expect(isFeatureVisible('invoicing', 'stabilize')).toBe(false);
      expect(isFeatureVisible('customers', 'stabilize')).toBe(false);
    });

    it('should show all accessible and preview features in each phase', () => {
      const organizeVisible = PHASE_VISIBILITY_RULES.organize.visibleFeatures;
      organizeVisible.forEach((featureId) => {
        expect(isFeatureVisible(featureId, 'organize')).toBe(true);
      });
    });
  });

  describe('getFeatureAccess', () => {
    it('should return accessible result for available features', () => {
      const result = getFeatureAccess('dashboard', 'stabilize');
      expect(result.canAccess).toBe(true);
      expect(result.isVisible).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should return locked result for preview features', () => {
      const result = getFeatureAccess('categories', 'stabilize');
      expect(result.canAccess).toBe(false);
      expect(result.isVisible).toBe(true);
      expect(result.reason).toBe('phase-locked');
      expect(result.message).toBeDefined();
    });

    it('should return hidden result for features not in current phase', () => {
      const result = getFeatureAccess('invoicing', 'stabilize');
      expect(result.canAccess).toBe(false);
      expect(result.isVisible).toBe(false);
      expect(result.reason).toBe('preference-hidden');
    });

    it('should show all features when showAllFeatures is true', () => {
      const result = getFeatureAccess('forecasting', 'stabilize', true);
      expect(result.canAccess).toBe(false);
      expect(result.isVisible).toBe(true);
      expect(result.reason).toBe('phase-locked');
    });

    it('should return not-found for non-existent features', () => {
      const result = getFeatureAccess('non-existent' as any, 'stabilize');
      expect(result.canAccess).toBe(false);
      expect(result.isVisible).toBe(false);
      expect(result.reason).toBe('not-found');
    });
  });

  describe('getFeaturesForPhase', () => {
    it('should return all visible features for Stabilize phase', () => {
      const features = getFeaturesForPhase('stabilize');
      expect(features).toContain('dashboard');
      expect(features).toContain('basic-transactions');
      expect(features.length).toBeGreaterThan(0);
    });

    it('should return more features for higher phases', () => {
      const stabilize = getFeaturesForPhase('stabilize');
      const organize = getFeaturesForPhase('organize');
      const build = getFeaturesForPhase('build');
      const grow = getFeaturesForPhase('grow');

      expect(organize.length).toBeGreaterThan(stabilize.length);
      expect(build.length).toBeGreaterThan(organize.length);
      expect(grow.length).toBeGreaterThan(build.length);
    });
  });

  describe('getAccessibleFeatures', () => {
    it('should return only accessible features for each phase', () => {
      const stabilizeAccessible = getAccessibleFeatures('stabilize');
      stabilizeAccessible.forEach((featureId) => {
        expect(isFeatureAccessible(featureId, 'stabilize')).toBe(true);
      });

      const organizeAccessible = getAccessibleFeatures('organize');
      organizeAccessible.forEach((featureId) => {
        expect(isFeatureAccessible(featureId, 'organize')).toBe(true);
      });
    });
  });

  describe('getLockedFeatures', () => {
    it('should return locked features (visible but not accessible)', () => {
      const stabilizeLocked = getLockedFeatures('stabilize');
      stabilizeLocked.forEach((featureId) => {
        expect(isFeatureVisible(featureId, 'stabilize')).toBe(true);
        expect(isFeatureAccessible(featureId, 'stabilize')).toBe(false);
      });
    });

    it('should return empty array for Grow phase if all features are unlocked', () => {
      const growLocked = getLockedFeatures('grow');
      expect(growLocked.length).toBe(0);
    });
  });

  describe('getUnlockedFeatures', () => {
    it('should return features unlocked when moving from Stabilize to Organize', () => {
      const unlocked = getUnlockedFeatures('stabilize', 'organize');
      expect(unlocked).toContain('categories');
      expect(unlocked).toContain('tags');
      expect(unlocked.length).toBeGreaterThan(0);
    });

    it('should return features unlocked when moving from Organize to Build', () => {
      const unlocked = getUnlockedFeatures('organize', 'build');
      expect(unlocked).toContain('invoicing');
      expect(unlocked).toContain('customers');
      expect(unlocked.length).toBeGreaterThan(0);
    });

    it('should return features unlocked when moving from Build to Grow', () => {
      const unlocked = getUnlockedFeatures('build', 'grow');
      expect(unlocked).toContain('forecasting');
      expect(unlocked).toContain('analytics');
      expect(unlocked.length).toBeGreaterThan(0);
    });

    it('should return empty array when not changing phase', () => {
      const unlocked = getUnlockedFeatures('organize', 'organize');
      expect(unlocked.length).toBe(0);
    });

    it('should return empty array when moving to lower phase', () => {
      const unlocked = getUnlockedFeatures('build', 'organize');
      expect(unlocked.length).toBe(0);
    });
  });

  describe('getFeatureMetadata', () => {
    it('should return metadata for existing features', () => {
      const metadata = getFeatureMetadata('dashboard');
      expect(metadata).toBeDefined();
      expect(metadata?.id).toBe('dashboard');
      expect(metadata?.name).toBeDefined();
      expect(metadata?.description).toBeDefined();
      expect(metadata?.availableInPhase).toBe('stabilize');
    });

    it('should return undefined for non-existent features', () => {
      const metadata = getFeatureMetadata('non-existent' as any);
      expect(metadata).toBeUndefined();
    });

    it('should have all required fields', () => {
      const metadata = getFeatureMetadata('invoicing');
      expect(metadata).toBeDefined();
      expect(metadata?.id).toBe('invoicing');
      expect(metadata?.name).toBeDefined();
      expect(metadata?.description).toBeDefined();
      expect(metadata?.availableInPhase).toBeDefined();
    });
  });

  describe('getAllFeatures', () => {
    it('should return all features', () => {
      const features = getAllFeatures();
      expect(features.length).toBeGreaterThan(0);
      expect(features).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'dashboard' }),
        expect.objectContaining({ id: 'categories' }),
        expect.objectContaining({ id: 'invoicing' }),
        expect.objectContaining({ id: 'forecasting' }),
      ]));
    });

    it('should match FEATURE_METADATA count', () => {
      const features = getAllFeatures();
      const metadataCount = Object.keys(FEATURE_METADATA).length;
      expect(features.length).toBe(metadataCount);
    });
  });

  describe('getFeaturesByCategory', () => {
    it('should return features for transactions category', () => {
      const features = getFeaturesByCategory('transactions');
      expect(features.length).toBeGreaterThan(0);
      features.forEach((feature) => {
        expect(feature.category).toBe('transactions');
      });
    });

    it('should return features for reports category', () => {
      const features = getFeaturesByCategory('reports');
      expect(features.length).toBeGreaterThan(0);
      features.forEach((feature) => {
        expect(feature.category).toBe('reports');
      });
    });

    it('should return empty array for category with no features', () => {
      const features = getFeaturesByCategory('non-existent' as any);
      expect(features.length).toBe(0);
    });
  });

  describe('getPhaseDescription', () => {
    it('should return description for all phases', () => {
      const phases: BusinessPhase[] = ['stabilize', 'organize', 'build', 'grow'];
      phases.forEach((phase) => {
        const description = getPhaseDescription(phase);
        expect(description).toBeDefined();
        expect(typeof description).toBe('string');
        expect(description.length).toBeGreaterThan(0);
      });
    });

    it('should return different descriptions for each phase', () => {
      const descriptions = [
        getPhaseDescription('stabilize'),
        getPhaseDescription('organize'),
        getPhaseDescription('build'),
        getPhaseDescription('grow'),
      ];

      const uniqueDescriptions = new Set(descriptions);
      expect(uniqueDescriptions.size).toBe(4);
    });
  });

  describe('getNextPhase', () => {
    it('should return next phase in sequence', () => {
      expect(getNextPhase('stabilize')).toBe('organize');
      expect(getNextPhase('organize')).toBe('build');
      expect(getNextPhase('build')).toBe('grow');
    });

    it('should return null for the last phase', () => {
      expect(getNextPhase('grow')).toBeNull();
    });
  });

  describe('FEATURE_METADATA', () => {
    it('should have metadata for all feature IDs', () => {
      const metadataKeys = Object.keys(FEATURE_METADATA);
      expect(metadataKeys.length).toBeGreaterThan(0);

      metadataKeys.forEach((key) => {
        const metadata = FEATURE_METADATA[key as keyof typeof FEATURE_METADATA];
        expect(metadata).toBeDefined();
        expect(metadata.id).toBe(key);
      });
    });

    it('should have valid phase assignments', () => {
      const validPhases: BusinessPhase[] = ['stabilize', 'organize', 'build', 'grow'];
      Object.values(FEATURE_METADATA).forEach((metadata) => {
        expect(validPhases).toContain(metadata.availableInPhase);
      });
    });
  });

  describe('PHASE_VISIBILITY_RULES', () => {
    it('should have rules for all phases', () => {
      const phases: BusinessPhase[] = ['stabilize', 'organize', 'build', 'grow'];
      phases.forEach((phase) => {
        expect(PHASE_VISIBILITY_RULES[phase]).toBeDefined();
        expect(PHASE_VISIBILITY_RULES[phase].phase).toBe(phase);
        expect(Array.isArray(PHASE_VISIBILITY_RULES[phase].visibleFeatures)).toBe(true);
      });
    });

    it('should accumulate features as phases progress', () => {
      const stabilize = PHASE_VISIBILITY_RULES.stabilize.visibleFeatures;
      const organize = PHASE_VISIBILITY_RULES.organize.visibleFeatures;
      const build = PHASE_VISIBILITY_RULES.build.visibleFeatures;

      // Organize should include all Stabilize features
      stabilize.forEach((featureId) => {
        expect(organize).toContain(featureId);
      });

      // Build should include all Organize features
      organize.forEach((featureId) => {
        expect(build).toContain(featureId);
      });
    });

    it('should have valid feature IDs in visible features', () => {
      Object.values(PHASE_VISIBILITY_RULES).forEach((rules) => {
        rules.visibleFeatures.forEach((featureId) => {
          expect(FEATURE_METADATA[featureId]).toBeDefined();
        });
      });
    });
  });
});
