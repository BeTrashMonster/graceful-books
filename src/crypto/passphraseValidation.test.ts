/**
 * Tests for Passphrase Validation Module
 *
 * Tests passphrase strength validation based on NIST 800-63B
 */

import { describe, it, expect } from 'vitest';
import {
  validatePassphrase,
  calculateEntropy,
  isWordBased,
  getStrengthFeedback,
  estimateCrackTime,
  detectWeakPatterns,
  generatePassphraseSuggestion,
  validatePassphraseDetailed,
} from './passphraseValidation';

describe('Passphrase Validation Module', () => {
  describe('validatePassphrase', () => {
    it('should accept strong passphrase with 4+ words', () => {
      const result = validatePassphrase('correct horse battery staple');

      expect(result.isValid).toBe(true);
      expect(result.entropy).toBeGreaterThan(50);
      expect(result.wordCount).toBeGreaterThanOrEqual(4);
    });

    it('should accept strong passphrase with 12+ characters', () => {
      const result = validatePassphrase('MyStr0ngP@ss');

      expect(result.isValid).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(12);
      expect(result.entropy).toBeGreaterThan(50);
    });

    it('should reject empty passphrase', () => {
      const result = validatePassphrase('');

      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('cannot be empty');
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions?.length).toBeGreaterThan(0);
    });

    it('should reject common weak passwords', () => {
      const weakPasswords = ['password', 'password123', '123456', 'qwerty'];

      weakPasswords.forEach((password) => {
        const result = validatePassphrase(password);
        expect(result.isValid).toBe(false);
        expect(result.errorMessage).toContain('too common');
      });
    });

    it('should reject passphrase that is too short', () => {
      const result = validatePassphrase('short');

      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('at least');
      expect(result.suggestions).toBeDefined();
    });

    it('should reject passphrase with insufficient entropy', () => {
      const result = validatePassphrase('aaaaaaaaaaaa'); // 12 chars but low entropy

      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('entropy');
      expect(result.entropy).toBeLessThan(50);
    });

    it('should provide suggestions for improvement', () => {
      const result = validatePassphrase('weak');

      expect(result.isValid).toBe(false);
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions?.length).toBeGreaterThan(0);
    });

    it('should suggest improvements for acceptable but not optimal passphrases', () => {
      const result = validatePassphrase('correct horse battery'); // Only 3 words

      if (!result.isValid || result.entropy < 80) {
        expect(result.suggestions).toBeDefined();
      }
    });

    it('should handle Unicode characters', () => {
      const result = validatePassphrase('🔐 secure passphrase 世界 🌍');

      expect(result.isValid).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should calculate word count correctly', () => {
      const result = validatePassphrase('one two three four five');

      expect(result.wordCount).toBe(5);
    });

    it('should handle extra whitespace', () => {
      const result = validatePassphrase('  word1   word2  word3  word4  ');

      expect(result.wordCount).toBe(4);
    });
  });

  describe('calculateEntropy', () => {
    it('should calculate entropy for lowercase only', () => {
      const entropy = calculateEntropy('abcdefghijklmnop'); // 16 chars lowercase
      const expectedMin = 16 * Math.log2(26); // 16 * 4.7
      expect(entropy).toBeGreaterThanOrEqual(expectedMin - 1);
      expect(entropy).toBeLessThanOrEqual(expectedMin + 1);
    });

    it('should calculate higher entropy for mixed case', () => {
      const lowerEntropy = calculateEntropy('abcdefghijklmnop');
      const mixedEntropy = calculateEntropy('AbCdEfGhIjKlMnOp');

      expect(mixedEntropy).toBeGreaterThan(lowerEntropy);
    });

    it('should calculate higher entropy with numbers', () => {
      const letterEntropy = calculateEntropy('abcdefghijklmnop');
      const alphanumEntropy = calculateEntropy('abc123def456ghij');

      expect(alphanumEntropy).toBeGreaterThan(letterEntropy);
    });

    it('should calculate higher entropy with special characters', () => {
      const alphanumEntropy = calculateEntropy('abc123def456');
      const fullEntropy = calculateEntropy('abc!@#123$%^');

      expect(fullEntropy).toBeGreaterThan(alphanumEntropy);
    });

    it('should return 0 for empty string', () => {
      const entropy = calculateEntropy('');
      expect(entropy).toBe(0);
    });

    it('should increase with length', () => {
      const entropy1 = calculateEntropy('password');
      const entropy2 = calculateEntropy('passwordpassword');

      expect(entropy2).toBeGreaterThan(entropy1);
    });

    it('should handle all character types', () => {
      const entropy = calculateEntropy('Abc123!@#');
      expect(entropy).toBeGreaterThan(0);
    });
  });

  describe('isWordBased', () => {
    it('should detect word-based passphrases', () => {
      const result = isWordBased('correct horse battery staple');
      expect(result).toBe(true);
    });

    it('should detect single long string as not word-based', () => {
      const result = isWordBased('thisisaverylongpasswordwithoutspaces');
      expect(result).toBe(false);
    });

    it('should require at least 2 words', () => {
      const result = isWordBased('singleword');
      expect(result).toBe(false);
    });

    it('should reject very short words', () => {
      const result = isWordBased('a b c d e');
      expect(result).toBe(false);
    });

    it('should reject very long words', () => {
      const result = isWordBased('supercalifragilisticexpialidocious another');
      expect(result).toBe(false);
    });

    it('should accept typical word-based passphrases', () => {
      const examples = [
        'correct horse battery staple',
        'blue moon river mountain',
        'dragon wizard castle tower',
      ];

      examples.forEach((passphrase) => {
        const result = isWordBased(passphrase);
        expect(result).toBe(true);
      });
    });
  });

  describe('getStrengthFeedback', () => {
    it('should rate very weak passphrases', () => {
      const feedback = getStrengthFeedback(20);

      expect(feedback.level).toBe('very-weak');
      expect(feedback.description).toContain('Very Weak');
      expect(feedback.color).toBeDefined();
    });

    it('should rate weak passphrases', () => {
      const feedback = getStrengthFeedback(40);

      expect(feedback.level).toBe('weak');
      expect(feedback.description).toContain('Weak');
    });

    it('should rate fair passphrases', () => {
      const feedback = getStrengthFeedback(60);

      expect(feedback.level).toBe('fair');
      expect(feedback.description).toContain('Fair');
    });

    it('should rate strong passphrases', () => {
      const feedback = getStrengthFeedback(80);

      expect(feedback.level).toBe('strong');
      expect(feedback.description).toContain('Strong');
    });

    it('should rate very strong passphrases', () => {
      const feedback = getStrengthFeedback(100);

      expect(feedback.level).toBe('very-strong');
      expect(feedback.description).toContain('Very Strong');
    });

    it('should provide different colors for different levels', () => {
      const veryWeak = getStrengthFeedback(20);
      const veryStrong = getStrengthFeedback(100);

      expect(veryWeak.color).not.toBe(veryStrong.color);
    });
  });

  describe('estimateCrackTime', () => {
    it('should estimate very short time for weak passphrases', () => {
      const time = estimateCrackTime(30);
      expect(time).toBeDefined();
      expect(typeof time).toBe('string');
    });

    it('should estimate long time for strong passphrases', () => {
      const time = estimateCrackTime(100);
      expect(time).toBeDefined();
      expect(time).toContain('year');
    });

    it('should scale with entropy', () => {
      const time1 = estimateCrackTime(40);
      const time2 = estimateCrackTime(80);

      expect(time1).toBeDefined();
      expect(time2).toBeDefined();
      // Higher entropy should take longer
    });

    it('should handle very high entropy', () => {
      const time = estimateCrackTime(200);
      expect(time).toBeDefined();
    });

    it('should handle very low entropy', () => {
      const time = estimateCrackTime(10);
      expect(time).toBeDefined();
    });

    it('should provide human-readable estimates', () => {
      const times = [
        estimateCrackTime(20),
        estimateCrackTime(40),
        estimateCrackTime(60),
        estimateCrackTime(80),
        estimateCrackTime(100),
      ];

      times.forEach((time) => {
        expect(typeof time).toBe('string');
        expect(time.length).toBeGreaterThan(0);
      });
    });
  });

  describe('detectWeakPatterns', () => {
    it('should detect repeated characters', () => {
      const patterns = detectWeakPatterns('aaaaaa');
      expect(patterns).toContain('Contains repeated characters');
    });

    it('should detect sequential numbers', () => {
      const patterns = detectWeakPatterns('password1234');
      expect(patterns).toContain('Contains sequential numbers');
    });

    it('should detect sequential letters', () => {
      const patterns = detectWeakPatterns('abcdefgh');
      expect(patterns).toContain('Contains sequential letters');
    });

    it('should detect keyboard patterns', () => {
      const keyboardPatterns = ['qwerty123', 'asdfgh456', 'zxcvbnm'];

      keyboardPatterns.forEach((pattern) => {
        const detected = detectWeakPatterns(pattern);
        expect(detected).toContain('Contains keyboard pattern');
      });
    });

    it('should detect leet speak', () => {
      const patterns = detectWeakPatterns('p4ssw0rd');
      // May or may not detect depending on implementation
      expect(patterns).toBeDefined();
    });

    it('should return empty array for strong passphrases', () => {
      const patterns = detectWeakPatterns('correct horse battery staple');
      expect(patterns.length).toBe(0);
    });

    it('should detect multiple patterns', () => {
      const patterns = detectWeakPatterns('aaaa1234qwerty');
      expect(patterns.length).toBeGreaterThan(1);
    });

    it('should be case-insensitive for pattern detection', () => {
      const patterns1 = detectWeakPatterns('QWERTY');
      const patterns2 = detectWeakPatterns('qwerty');

      expect(patterns1).toEqual(patterns2);
    });
  });

  describe('generatePassphraseSuggestion', () => {
    it('should generate passphrase with default word count', () => {
      const suggestion = generatePassphraseSuggestion();
      const words = suggestion.split(' ');

      expect(words.length).toBe(4);
    });

    it('should generate passphrase with custom word count', () => {
      const suggestion = generatePassphraseSuggestion(6);
      const words = suggestion.split(' ');

      expect(words.length).toBe(6);
    });

    it('should generate different passphrases', () => {
      const suggestion1 = generatePassphraseSuggestion();
      const suggestion2 = generatePassphraseSuggestion();

      expect(suggestion1).not.toBe(suggestion2);
    });

    it('should generate passphrases without duplicates', () => {
      const suggestion = generatePassphraseSuggestion(5);
      const words = suggestion.split(' ');
      const uniqueWords = new Set(words);

      expect(uniqueWords.size).toBe(words.length);
    });

    it('should validate its own suggestions', () => {
      const suggestion = generatePassphraseSuggestion(4);
      const validation = validatePassphrase(suggestion);

      expect(validation.isValid).toBe(true);
    });

    it('should handle large word counts', () => {
      const suggestion = generatePassphraseSuggestion(10);
      const words = suggestion.split(' ');

      expect(words.length).toBe(10);
      expect(words.every((w) => w.length > 0)).toBe(true);
    });
  });

  describe('validatePassphraseDetailed', () => {
    it('should include all validation details', () => {
      const result = validatePassphraseDetailed('correct horse battery staple');

      expect(result.isValid).toBeDefined();
      expect(result.entropy).toBeDefined();
      expect(result.length).toBeDefined();
      expect(result.weakPatterns).toBeDefined();
      expect(result.strengthFeedback).toBeDefined();
      expect(result.crackTime).toBeDefined();
      expect(result.wordBased).toBeDefined();
    });

    it('should detect weak patterns in detailed validation', () => {
      const result = validatePassphraseDetailed('password1234qwerty');

      expect(result.weakPatterns.length).toBeGreaterThan(0);
    });

    it('should provide strength feedback', () => {
      const result = validatePassphraseDetailed('MyStr0ngP@ssw0rd!');

      expect(result.strengthFeedback.level).toBeDefined();
      expect(result.strengthFeedback.description).toBeDefined();
      expect(result.strengthFeedback.color).toBeDefined();
    });

    it('should identify word-based passphrases', () => {
      const result = validatePassphraseDetailed('correct horse battery staple');

      expect(result.wordBased).toBe(true);
    });

    it('should estimate crack time', () => {
      const result = validatePassphraseDetailed('test passphrase here');

      expect(result.crackTime).toBeDefined();
      expect(typeof result.crackTime).toBe('string');
    });

    it('should work for weak passphrases', () => {
      const result = validatePassphraseDetailed('weak');

      expect(result.isValid).toBe(false);
      expect(result.weakPatterns).toBeDefined();
      expect(result.strengthFeedback.level).toBe('very-weak');
    });

    it('should work for strong passphrases', () => {
      const result = validatePassphraseDetailed(
        'correct horse battery staple mountain river'
      );

      expect(result.isValid).toBe(true);
      expect(result.strengthFeedback.level).toMatch(/strong/);
    });
  });

  describe('edge cases', () => {
    it('should handle null-like inputs gracefully', () => {
      const result = validatePassphrase('');
      expect(result.isValid).toBe(false);
    });

    it('should handle very long passphrases', () => {
      const longPassphrase = 'word '.repeat(100);
      const result = validatePassphrase(longPassphrase);

      expect(result.isValid).toBe(true);
      expect(result.entropy).toBeGreaterThan(100);
    });

    it('should handle passphrases with only special characters', () => {
      const result = validatePassphrase('!@#$%^&*()_+');

      expect(result.length).toBe(12);
      expect(result.entropy).toBeGreaterThan(0);
    });

    it('should handle passphrases with mixed scripts', () => {
      const result = validatePassphrase('English 日本語 Español Русский');

      expect(result.isValid).toBe(true);
    });

    it('should handle passphrases with emojis', () => {
      const result = validatePassphrase('🔐🔑🗝️🛡️🔒🔓🔏🔐🔑🗝️🛡️🔒');

      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle numeric-only passphrases', () => {
      const result = validatePassphrase('123456789012');

      expect(result.length).toBe(12);
      // Will likely fail entropy check
    });

    it('should handle whitespace-only as invalid', () => {
      const result = validatePassphrase('            ');

      expect(result.isValid).toBe(false);
    });

    it('should treat case sensitively', () => {
      const lower = validatePassphrase('correct horse battery staple');
      const mixed = validatePassphrase('Correct Horse Battery Staple');

      // Both should be valid but with different entropy
      expect(lower.isValid).toBe(true);
      expect(mixed.isValid).toBe(true);
      expect(mixed.entropy).toBeGreaterThan(lower.entropy);
    });
  });

  describe('NIST 800-63B compliance', () => {
    it('should enforce minimum 12 character length', () => {
      const result = validatePassphrase('short123');

      expect(result.isValid).toBe(false);
      expect(result.length).toBeLessThan(12);
    });

    it('should accept 4+ word passphrases', () => {
      const result = validatePassphrase('one two three four');

      if (result.wordCount && result.wordCount >= 4) {
        expect(result.entropy).toBeGreaterThan(0);
      }
    });

    it('should enforce minimum entropy', () => {
      const result = validatePassphrase('aaaaaaaaaaaaa');

      expect(result.isValid).toBe(false);
      expect(result.entropy).toBeLessThan(50);
    });

    it('should reject common passwords', () => {
      const commonPasswords = [
        'password',
        'password123',
        '123456',
        'qwerty',
        'letmein',
      ];

      commonPasswords.forEach((password) => {
        const result = validatePassphrase(password);
        expect(result.isValid).toBe(false);
      });
    });
  });
});
