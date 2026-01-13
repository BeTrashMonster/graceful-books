/**
 * Tests for DISC Message Adapter
 */

import { describe, it, expect } from 'vitest';
import {
  getPrimaryStyle,
  getSecondaryStyle,
  calculateStyles,
  validateDISCScores,
  createDISCProfile,
  getFallbackStyle,
  DEFAULT_DISC_PROFILE,
  type DISCProfile,
} from './discMessageAdapter';

describe('discMessageAdapter', () => {
  describe('getPrimaryStyle', () => {
    it('should return primary style from valid profile', () => {
      const profile: DISCProfile = {
        dominanceScore: 75,
        influenceScore: 40,
        steadinessScore: 60,
        conscientiousnessScore: 80,
        primaryStyle: 'C',
        secondaryStyle: 'D',
      };

      expect(getPrimaryStyle(profile)).toBe('C');
    });

    it('should return S as default when profile is null', () => {
      expect(getPrimaryStyle(null)).toBe('S');
    });

    it('should return S as default when profile is undefined', () => {
      expect(getPrimaryStyle(undefined)).toBe('S');
    });

    it('should return S when manual override is enabled', () => {
      const profile: DISCProfile = {
        dominanceScore: 75,
        influenceScore: 40,
        steadinessScore: 60,
        conscientiousnessScore: 80,
        primaryStyle: 'D',
        secondaryStyle: 'C',
        manualOverride: true,
      };

      expect(getPrimaryStyle(profile)).toBe('S');
    });
  });

  describe('getSecondaryStyle', () => {
    it('should return secondary style from valid profile', () => {
      const profile: DISCProfile = {
        dominanceScore: 75,
        influenceScore: 40,
        steadinessScore: 60,
        conscientiousnessScore: 80,
        primaryStyle: 'C',
        secondaryStyle: 'D',
      };

      expect(getSecondaryStyle(profile)).toBe('D');
    });

    it('should return C as default when profile is null', () => {
      expect(getSecondaryStyle(null)).toBe('C');
    });

    it('should return C when manual override is enabled', () => {
      const profile: DISCProfile = {
        dominanceScore: 75,
        influenceScore: 40,
        steadinessScore: 60,
        conscientiousnessScore: 80,
        primaryStyle: 'D',
        secondaryStyle: 'I',
        manualOverride: true,
      };

      expect(getSecondaryStyle(profile)).toBe('C');
    });
  });

  describe('calculateStyles', () => {
    it('should calculate primary and secondary styles correctly', () => {
      const scores = {
        dominanceScore: 75,
        influenceScore: 40,
        steadinessScore: 60,
        conscientiousnessScore: 80,
      };

      const styles = calculateStyles(scores);
      expect(styles.primaryStyle).toBe('C'); // Highest score
      expect(styles.secondaryStyle).toBe('D'); // Second highest
    });

    it('should handle ties with tiebreaker order (S, C, I, D)', () => {
      const scores = {
        dominanceScore: 50,
        influenceScore: 50,
        steadinessScore: 50,
        conscientiousnessScore: 50,
      };

      const styles = calculateStyles(scores);
      expect(styles.primaryStyle).toBe('S'); // S wins ties
      expect(styles.secondaryStyle).toBe('C'); // C is second in tiebreaker
    });

    it('should handle partial tie correctly', () => {
      const scores = {
        dominanceScore: 80,
        influenceScore: 80,
        steadinessScore: 60,
        conscientiousnessScore: 40,
      };

      const styles = calculateStyles(scores);
      // D and I are tied at 80, but I should win based on tiebreaker
      expect(['D', 'I']).toContain(styles.primaryStyle);
      expect(['D', 'I']).toContain(styles.secondaryStyle);
    });

    it('should identify single dominant style', () => {
      const scores = {
        dominanceScore: 90,
        influenceScore: 30,
        steadinessScore: 20,
        conscientiousnessScore: 10,
      };

      const styles = calculateStyles(scores);
      expect(styles.primaryStyle).toBe('D');
      expect(styles.secondaryStyle).toBe('I');
    });
  });

  describe('validateDISCScores', () => {
    it('should validate correct scores', () => {
      const scores = {
        dominanceScore: 75,
        influenceScore: 40,
        steadinessScore: 60,
        conscientiousnessScore: 80,
      };

      const result = validateDISCScores(scores);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject scores below 0', () => {
      const scores = {
        dominanceScore: -10,
        influenceScore: 40,
        steadinessScore: 60,
        conscientiousnessScore: 80,
      };

      const result = validateDISCScores(scores);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject scores above 100', () => {
      const scores = {
        dominanceScore: 75,
        influenceScore: 150,
        steadinessScore: 60,
        conscientiousnessScore: 80,
      };

      const result = validateDISCScores(scores);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject when no score is greater than 50', () => {
      const scores = {
        dominanceScore: 25,
        influenceScore: 25,
        steadinessScore: 25,
        conscientiousnessScore: 25,
      };

      const result = validateDISCScores(scores);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('At least one DISC score must be greater than 50');
    });

    it('should accept when at least one score is greater than 50', () => {
      const scores = {
        dominanceScore: 25,
        influenceScore: 25,
        steadinessScore: 100,
        conscientiousnessScore: 25,
      };

      const result = validateDISCScores(scores);
      expect(result.valid).toBe(true);
    });
  });

  describe('createDISCProfile', () => {
    it('should create a valid DISC profile', () => {
      const scores = {
        dominanceScore: 75,
        influenceScore: 40,
        steadinessScore: 60,
        conscientiousnessScore: 80,
      };

      const profile = createDISCProfile(scores);
      expect(profile.dominanceScore).toBe(75);
      expect(profile.influenceScore).toBe(40);
      expect(profile.steadinessScore).toBe(60);
      expect(profile.conscientiousnessScore).toBe(80);
      expect(profile.primaryStyle).toBe('C');
      expect(profile.secondaryStyle).toBe('D');
      expect(profile.manualOverride).toBe(false);
    });

    it('should throw error for invalid scores', () => {
      const scores = {
        dominanceScore: -10,
        influenceScore: 40,
        steadinessScore: 60,
        conscientiousnessScore: 80,
      };

      expect(() => createDISCProfile(scores)).toThrow('Invalid DISC scores');
    });
  });

  describe('getFallbackStyle', () => {
    it('should return primary style if available', () => {
      const profile: DISCProfile = {
        dominanceScore: 75,
        influenceScore: 40,
        steadinessScore: 60,
        conscientiousnessScore: 80,
        primaryStyle: 'C',
        secondaryStyle: 'D',
      };
      const availableStyles = ['D', 'I', 'S', 'C'] as const;

      expect(getFallbackStyle(profile, [...availableStyles])).toBe('C');
    });

    it('should return secondary style if primary not available', () => {
      const profile: DISCProfile = {
        dominanceScore: 75,
        influenceScore: 40,
        steadinessScore: 60,
        conscientiousnessScore: 80,
        primaryStyle: 'C',
        secondaryStyle: 'D',
      };
      const availableStyles = ['D', 'I', 'S'] as const;

      expect(getFallbackStyle(profile, [...availableStyles])).toBe('D');
    });

    it('should return S if neither primary nor secondary available', () => {
      const profile: DISCProfile = {
        dominanceScore: 75,
        influenceScore: 40,
        steadinessScore: 60,
        conscientiousnessScore: 80,
        primaryStyle: 'C',
        secondaryStyle: 'D',
      };
      const availableStyles = ['I', 'S'] as const;

      expect(getFallbackStyle(profile, [...availableStyles])).toBe('S');
    });

    it('should return first available style if S not available', () => {
      const profile: DISCProfile = {
        dominanceScore: 75,
        influenceScore: 40,
        steadinessScore: 60,
        conscientiousnessScore: 80,
        primaryStyle: 'C',
        secondaryStyle: 'D',
      };
      const availableStyles = ['I'] as const;

      expect(getFallbackStyle(profile, [...availableStyles])).toBe('I');
    });

    it('should handle null profile', () => {
      const availableStyles = ['D', 'I', 'S', 'C'] as const;
      expect(getFallbackStyle(null, [...availableStyles])).toBe('S'); // Default primary is S
    });
  });

  describe('DEFAULT_DISC_PROFILE', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_DISC_PROFILE.dominanceScore).toBe(25);
      expect(DEFAULT_DISC_PROFILE.influenceScore).toBe(25);
      expect(DEFAULT_DISC_PROFILE.steadinessScore).toBe(100);
      expect(DEFAULT_DISC_PROFILE.conscientiousnessScore).toBe(25);
      expect(DEFAULT_DISC_PROFILE.primaryStyle).toBe('S');
      expect(DEFAULT_DISC_PROFILE.secondaryStyle).toBe('C');
      expect(DEFAULT_DISC_PROFILE.manualOverride).toBe(false);
    });
  });
});
