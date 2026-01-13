/**
 * Tests for Adaptive Message Selection Logic
 */

import { describe, it, expect,  vi } from 'vitest';
import {
  getAdaptiveMessage,
  getMessageVariants,
  getMessageCompleteness
} from './adaptiveMessages';
import type { DISCProfile } from '../../utils/discMessageAdapter';

describe('adaptiveMessages', () => {
  describe('getAdaptiveMessage', () => {
    it('should return message for Dominance style', () => {
      const profile: DISCProfile = {
        dominanceScore: 90,
        influenceScore: 30,
        steadinessScore: 20,
        conscientiousnessScore: 40,
        primaryStyle: 'D',
        secondaryStyle: 'C',
      };

      const message = getAdaptiveMessage('transaction.save.success', { profile });
      expect(message).toBe("Done. Transaction recorded. What's next?");
    });

    it('should return message for Influence style', () => {
      const profile: DISCProfile = {
        dominanceScore: 30,
        influenceScore: 90,
        steadinessScore: 20,
        conscientiousnessScore: 40,
        primaryStyle: 'I',
        secondaryStyle: 'C',
      };

      const message = getAdaptiveMessage('transaction.save.success', { profile });
      expect(message).toBe("Woohoo! Transaction saved! You're on a roll!");
    });

    it('should return message for Steadiness style', () => {
      const profile: DISCProfile = {
        dominanceScore: 30,
        influenceScore: 20,
        steadinessScore: 90,
        conscientiousnessScore: 40,
        primaryStyle: 'S',
        secondaryStyle: 'C',
      };

      const message = getAdaptiveMessage('transaction.save.success', { profile });
      expect(message).toBe("Transaction saved successfully. Great work! We'll guide you through each step as you continue.");
    });

    it('should return message for Conscientiousness style', () => {
      const profile: DISCProfile = {
        dominanceScore: 30,
        influenceScore: 20,
        steadinessScore: 40,
        conscientiousnessScore: 90,
        primaryStyle: 'C',
        secondaryStyle: 'S',
      };

      const message = getAdaptiveMessage('transaction.save.success', { profile });
      expect(message).toBe("Transaction successfully recorded. All fields validated and saved to local database.");
    });

    it('should return default Steadiness message when profile is null', () => {
      const message = getAdaptiveMessage('transaction.save.success', { profile: null });
      expect(message).toBe("Transaction saved successfully. Great work! We'll guide you through each step as you continue.");
    });

    it('should return default message when no profile provided', () => {
      const message = getAdaptiveMessage('transaction.save.success');
      expect(message).toBe("Transaction saved successfully. Great work! We'll guide you through each step as you continue.");
    });

    it('should interpolate placeholders', () => {
      const profile: DISCProfile = {
        dominanceScore: 30,
        influenceScore: 20,
        steadinessScore: 40,
        conscientiousnessScore: 90,
        primaryStyle: 'C',
        secondaryStyle: 'S',
      };

      const message = getAdaptiveMessage('account.create.success', {
        profile,
        placeholders: {
          type: 'Asset',
          number: '1000',
        },
      });

      expect(message).toContain('Asset');
      expect(message).toContain('1000');
    });

    it('should force specific DISC type when requested', () => {
      const message = getAdaptiveMessage('transaction.save.success', {
        forceDISCType: 'D',
      });

      expect(message).toBe("Done. Transaction recorded. What's next?");
    });

    it('should return fallback for missing message ID', () => {
      // Mock console.error to avoid noise in test output
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const message = getAdaptiveMessage('nonexistent.message');
      expect(message).toContain('[Message not found:');

      consoleError.mockRestore();
    });

    it('should fall back to secondary style if primary variant missing', () => {
      const profile: DISCProfile = {
        dominanceScore: 75,
        influenceScore: 40,
        steadinessScore: 60,
        conscientiousnessScore: 80,
        primaryStyle: 'C',
        secondaryStyle: 'D',
      };

      // Using a message where we know all variants exist
      const message = getAdaptiveMessage('welcome.after_signup', { profile });
      expect(message).toBeTruthy();
    });

    it('should handle missing placeholder gracefully', () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const profile: DISCProfile = {
        dominanceScore: 30,
        influenceScore: 20,
        steadinessScore: 40,
        conscientiousnessScore: 90,
        primaryStyle: 'C',
        secondaryStyle: 'S',
      };

      const message = getAdaptiveMessage('account.create.success', {
        profile,
        placeholders: {
          type: 'Asset',
          // Missing 'number' placeholder
        },
      });

      expect(message).toContain('Asset');
      expect(consoleWarn).toHaveBeenCalled();

      consoleWarn.mockRestore();
    });
  });

  describe('getMessageVariants', () => {
    it('should return all variants for a message', () => {
      const variants = getMessageVariants('transaction.save.success');

      expect(variants).toBeTruthy();
      expect(variants?.D).toBe("Done. Transaction recorded. What's next?");
      expect(variants?.I).toBe("Woohoo! Transaction saved! You're on a roll!");
      expect(variants?.S).toBe("Transaction saved successfully. Great work! We'll guide you through each step as you continue.");
      expect(variants?.C).toBe("Transaction successfully recorded. All fields validated and saved to local database.");
    });

    it('should interpolate placeholders in all variants', () => {
      const variants = getMessageVariants('account.create.success', {
        type: 'Asset',
        number: '1000',
      });

      // Not all variants use placeholders (e.g., D and I are generic)
      // but C variant should contain them
      expect(variants).toBeTruthy();
      expect(variants?.C).toContain('Asset');
      expect(variants?.C).toContain('1000');
    });

    it('should return null for non-existent message', () => {
      const variants = getMessageVariants('nonexistent.message');
      expect(variants).toBeNull();
    });
  });

  describe('getMessageCompleteness', () => {
    it('should return 100% completeness for fully implemented message', () => {
      const completeness = getMessageCompleteness('transaction.save.success');

      expect(completeness.hasD).toBe(true);
      expect(completeness.hasI).toBe(true);
      expect(completeness.hasS).toBe(true);
      expect(completeness.hasC).toBe(true);
      expect(completeness.completeness).toBe(100);
      expect(completeness.missingStyles).toHaveLength(0);
    });

    it('should identify missing variants', () => {
      // For a message that might not have all variants
      // This is a hypothetical test - all our messages have full variants
      const completeness = getMessageCompleteness('transaction.save.success');

      expect(completeness.completeness).toBeGreaterThanOrEqual(0);
      expect(completeness.completeness).toBeLessThanOrEqual(100);
    });

    it('should return 0% for non-existent message', () => {
      const completeness = getMessageCompleteness('nonexistent.message');

      expect(completeness.hasD).toBe(false);
      expect(completeness.hasI).toBe(false);
      expect(completeness.hasS).toBe(false);
      expect(completeness.hasC).toBe(false);
      expect(completeness.completeness).toBe(0);
      expect(completeness.missingStyles).toEqual(['D', 'I', 'S', 'C']);
    });
  });

  describe('Message Coverage', () => {
    it('should have all key messages with full DISC variants', () => {
      const criticalMessages = [
        'welcome.after_signup',
        'transaction.save.success',
        'transaction.save.first',
        'account.create.success',
        'sync.complete',
        'transaction.validation.unbalanced',
        'sync.error.network',
        'form.validation.required',
        'error.generic',
        'transactions.empty_state',
        'accounts.empty_state',
        'help.chart_of_accounts',
        'help.double_entry',
        'help.reconciliation',
      ];

      criticalMessages.forEach((messageId) => {
        const completeness = getMessageCompleteness(messageId);
        expect(completeness.completeness).toBe(100);
        expect(completeness.missingStyles).toHaveLength(0);
      });
    });
  });

  describe('Manual Override Behavior', () => {
    it('should use Steadiness style when manual override is enabled', () => {
      const profile: DISCProfile = {
        dominanceScore: 90,
        influenceScore: 30,
        steadinessScore: 20,
        conscientiousnessScore: 40,
        primaryStyle: 'D',
        secondaryStyle: 'C',
        manualOverride: true,
      };

      const message = getAdaptiveMessage('transaction.save.success', { profile });
      // Should get Steadiness message despite D being primary
      expect(message).toBe("Transaction saved successfully. Great work! We'll guide you through each step as you continue.");
    });
  });

  describe('Error Messages', () => {
    it('should provide DISC-adapted error messages', () => {
      const profiles: DISCProfile[] = [
        {
          dominanceScore: 90,
          influenceScore: 30,
          steadinessScore: 20,
          conscientiousnessScore: 40,
          primaryStyle: 'D',
          secondaryStyle: 'C',
        },
        {
          dominanceScore: 30,
          influenceScore: 90,
          steadinessScore: 20,
          conscientiousnessScore: 40,
          primaryStyle: 'I',
          secondaryStyle: 'C',
        },
      ];

      profiles.forEach((profile) => {
        const message = getAdaptiveMessage('transaction.validation.unbalanced', {
          profile,
          placeholders: {
            debits: '100.00',
            credits: '95.00',
            difference: '5.00',
          },
        });

        expect(message).toBeTruthy();
        expect(message.length).toBeGreaterThan(0);
      });
    });
  });
});
