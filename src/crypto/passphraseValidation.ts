/**
 * Passphrase Validation Module
 *
 * Implements passphrase strength validation based on NIST Special
 * Publication 800-63B per TECH-003 requirement.
 *
 * Requirements:
 * - Minimum 4 words or 12 characters
 * - Sufficient entropy for secure key derivation
 * - User-friendly error messages and suggestions
 */

import type { PassphraseValidationResult } from './types';

/**
 * Minimum passphrase requirements per NIST 800-63B
 */
const MIN_REQUIREMENTS = {
  minLength: 12, // Minimum 12 characters
  minWords: 4, // Minimum 4 words for passphrase style
  minEntropy: 50, // Minimum 50 bits of entropy
  recommendedEntropy: 80, // Recommended 80+ bits
  minUniqueChars: 4, // Minimum unique characters to prevent repetition
};

/**
 * Common weak passwords to check against
 * (In production, this would be a much larger list or use a proper library)
 */
const COMMON_WEAK_PASSWORDS = new Set([
  'password',
  'password123',
  '123456',
  '12345678',
  'qwerty',
  'abc123',
  'monkey',
  'letmein',
  'trustno1',
  'dragon',
  'baseball',
  'iloveyou',
  'master',
  'sunshine',
  'ashley',
  'bailey',
  'passw0rd',
  'shadow',
  'superman',
  'qwertyuiop',
]);

/**
 * Validate passphrase strength
 *
 * Per TECH-003: Validates that a passphrase meets minimum security
 * requirements based on NIST 800-63B guidelines.
 *
 * Acceptance criteria:
 * - 4+ words OR 12+ characters
 * - Sufficient entropy (50+ bits minimum, 80+ recommended)
 * - Not in common weak password list
 *
 * @param passphrase - The passphrase to validate
 * @returns Validation result with entropy calculation and suggestions
 *
 * @example
 * ```typescript
 * const result = validatePassphrase('correct horse battery staple');
 * if (result.isValid) {
 *   console.log('Entropy:', result.entropy, 'bits');
 * } else {
 *   console.log('Error:', result.errorMessage);
 *   console.log('Suggestions:', result.suggestions);
 * }
 * ```
 */
export function validatePassphrase(passphrase: string): PassphraseValidationResult {
  // Basic validation
  if (!passphrase || passphrase.length === 0) {
    return {
      isValid: false,
      entropy: 0,
      length: 0,
      errorMessage: 'Passphrase cannot be empty',
      suggestions: [
        'Use at least 4 random words separated by spaces',
        'Or use at least 12 mixed characters including numbers and symbols',
      ],
    };
  }

  // Check for whitespace-only passphrases
  if (passphrase.trim().length === 0) {
    return {
      isValid: false,
      entropy: 0,
      length: passphrase.length,
      errorMessage: 'Passphrase cannot be only whitespace',
      suggestions: [
        'Use at least 4 random words separated by spaces',
        'Or use at least 12 mixed characters including numbers and symbols',
      ],
    };
  }

  const length = passphrase.length;
  const wordCount = countWords(passphrase);
  const entropy = calculateEntropy(passphrase);
  const uniqueChars = new Set(passphrase.replace(/\s+/g, '')).size;

  // Check against common weak passwords
  if (COMMON_WEAK_PASSWORDS.has(passphrase.toLowerCase())) {
    return {
      isValid: false,
      entropy,
      length,
      wordCount,
      errorMessage: 'This passphrase is too common and easily guessable',
      suggestions: [
        'Use a unique passphrase not found in password lists',
        'Try combining 4-6 random words instead',
        'Add numbers or symbols between words',
      ],
    };
  }

  // Check minimum length requirement
  if (length < MIN_REQUIREMENTS.minLength && wordCount < MIN_REQUIREMENTS.minWords) {
    return {
      isValid: false,
      entropy,
      length,
      wordCount,
      errorMessage: `Passphrase must be at least ${MIN_REQUIREMENTS.minWords} words or ${MIN_REQUIREMENTS.minLength} characters`,
      suggestions: [
        `Add ${MIN_REQUIREMENTS.minWords - wordCount} more word(s) to reach minimum length`,
        `Or add ${MIN_REQUIREMENTS.minLength - length} more character(s)`,
        'Example: "correct horse battery staple"',
      ],
    };
  }

  // Check for insufficient unique characters (prevents repetitive patterns like "aaaaaaaaaaaa")
  if (uniqueChars < MIN_REQUIREMENTS.minUniqueChars) {
    return {
      isValid: false,
      entropy,
      length,
      wordCount,
      errorMessage: `Passphrase has insufficient entropy (uses only ${uniqueChars} unique character${uniqueChars !== 1 ? 's' : ''}, need at least ${MIN_REQUIREMENTS.minUniqueChars})`,
      suggestions: [
        'Add more variety to your passphrase',
        'Use different characters, numbers, or words',
        'Avoid repetitive patterns like "aaaaaa" or "111111"',
        'Try using multiple distinct words separated by spaces',
      ],
    };
  }

  // Check entropy requirement
  if (entropy < MIN_REQUIREMENTS.minEntropy) {
    return {
      isValid: false,
      entropy,
      length,
      wordCount,
      errorMessage: `Passphrase has insufficient entropy (${entropy.toFixed(1)} bits, need ${MIN_REQUIREMENTS.minEntropy}+)`,
      suggestions: [
        'Add more random words or characters',
        'Use a mix of uppercase, lowercase, numbers, and symbols',
        'Avoid predictable patterns or sequences',
        'Consider using a passphrase generator',
      ],
    };
  }

  // Passphrase is valid
  const suggestions: string[] = [];
  if (entropy < MIN_REQUIREMENTS.recommendedEntropy) {
    suggestions.push(
      `Good passphrase! For even better security, aim for ${MIN_REQUIREMENTS.recommendedEntropy}+ bits of entropy`,
      'Consider adding 1-2 more random words'
    );
  }

  return {
    isValid: true,
    entropy,
    length,
    wordCount,
    suggestions: suggestions.length > 0 ? suggestions : undefined,
  };
}

/**
 * Count words in a passphrase
 *
 * Splits on whitespace and counts non-empty tokens.
 *
 * @param passphrase - Passphrase to analyze
 * @returns Number of words
 */
function countWords(passphrase: string): number {
  return passphrase.trim().split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Calculate Shannon entropy of a passphrase
 *
 * Estimates the information entropy based on character set diversity
 * and length. This is a simplified calculation that provides a
 * reasonable estimate for validation purposes.
 *
 * Formula: entropy = log2(charset_size^length)
 * Adjusted for repetition: uses unique character count when low diversity
 *
 * @param passphrase - Passphrase to analyze
 * @returns Estimated entropy in bits
 */
export function calculateEntropy(passphrase: string): number {
  if (!passphrase || passphrase.length === 0) {
    return 0;
  }

  const charsetSize = estimateCharsetSize(passphrase);
  const length = passphrase.length;
  const uniqueChars = new Set(passphrase.replace(/\s+/g, '')).size;

  // Base entropy = log2(charset^length) = length * log2(charset)
  let entropy = length * Math.log2(charsetSize);

  // Penalize low character diversity (patterns like "aaaaaa" are weak)
  // If unique chars is very low (< 4), significantly reduce entropy
  if (uniqueChars < 4) {
    // For highly repetitive patterns, entropy is roughly based on unique chars
    // plus a small bonus for length variation
    // E.g., "aaaaaaaaaaaa" = log2(26) + log2(12) ≈ 4.7 + 3.6 ≈ 8 bits
    entropy = Math.log2(charsetSize) + Math.log2(length);
  }

  return entropy;
}

/**
 * Estimate the character set size based on characters used
 *
 * Determines which character classes are present:
 * - Lowercase letters: 26
 * - Uppercase letters: 26
 * - Digits: 10
 * - Special symbols: 32
 * - Extended characters: 100
 *
 * @param passphrase - Passphrase to analyze
 * @returns Estimated character set size
 */
function estimateCharsetSize(passphrase: string): number {
  let charsetSize = 0;

  // Check for lowercase letters
  if (/[a-z]/.test(passphrase)) {
    charsetSize += 26;
  }

  // Check for uppercase letters
  if (/[A-Z]/.test(passphrase)) {
    charsetSize += 26;
  }

  // Check for digits
  if (/[0-9]/.test(passphrase)) {
    charsetSize += 10;
  }

  // Check for special symbols
  if (/[^a-zA-Z0-9]/.test(passphrase)) {
    charsetSize += 32;
  }

  // Minimum charset size (at least lowercase if nothing detected)
  if (charsetSize === 0) {
    charsetSize = 26;
  }

  return charsetSize;
}

/**
 * Check if passphrase is word-based (diceware style)
 *
 * Detects if passphrase follows word-based pattern with spaces.
 *
 * @param passphrase - Passphrase to check
 * @returns True if passphrase appears to be word-based
 */
export function isWordBased(passphrase: string): boolean {
  const wordCount = countWords(passphrase);
  const avgWordLength = passphrase.replace(/\s+/g, '').length / wordCount;

  // Typical words are 3-10 characters
  // Word-based passphrases typically have multiple words
  return wordCount >= 2 && avgWordLength >= 3 && avgWordLength <= 10;
}

/**
 * Generate passphrase strength feedback
 *
 * Provides user-friendly feedback about passphrase strength
 * using a 5-level scale.
 *
 * @param entropy - Calculated entropy in bits
 * @returns Strength level and description
 */
export function getStrengthFeedback(entropy: number): {
  level: 'very-weak' | 'weak' | 'fair' | 'strong' | 'very-strong';
  description: string;
  color: string;
} {
  if (entropy < 30) {
    return {
      level: 'very-weak',
      description: 'Very Weak - Easily cracked',
      color: '#d32f2f',
    };
  } else if (entropy < 50) {
    return {
      level: 'weak',
      description: 'Weak - Vulnerable to attacks',
      color: '#f57c00',
    };
  } else if (entropy < 70) {
    return {
      level: 'fair',
      description: 'Fair - Acceptable for basic use',
      color: '#fbc02d',
    };
  } else if (entropy < 90) {
    return {
      level: 'strong',
      description: 'Strong - Good security',
      color: '#689f38',
    };
  } else {
    return {
      level: 'very-strong',
      description: 'Very Strong - Excellent security',
      color: '#388e3c',
    };
  }
}

/**
 * Estimate time to crack passphrase
 *
 * Provides a rough estimate of how long it would take to crack
 * the passphrase using brute force with modern hardware.
 *
 * Assumptions:
 * - Attacker can try 10 billion guesses/second (modern GPU cluster)
 * - For Argon2id with our parameters, reduce to ~100 guesses/second
 *
 * @param entropy - Calculated entropy in bits
 * @returns Human-readable time estimate
 */
export function estimateCrackTime(entropy: number): string {
  // With Argon2id (64MB, 3 iterations), assume ~100 guesses/second
  const guessesPerSecond = 100;
  const possibleCombinations = Math.pow(2, entropy);
  const seconds = possibleCombinations / (2 * guessesPerSecond); // Divide by 2 for average case

  // Convert to human-readable format
  if (seconds < 60) {
    return 'less than a minute';
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  } else if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  } else if (seconds < 31536000) {
    const days = Math.floor(seconds / 86400);
    return `${days} day${days !== 1 ? 's' : ''}`;
  } else {
    // For extremely high entropy
    const years = Math.floor(seconds / 31536000);
    // If years is extremely large (more than what can be reasonably displayed),
    // use the "longer than" message, otherwise show the years
    if (years > Number.MAX_SAFE_INTEGER / 1000) {
      return 'longer than the age of the universe (more years than atoms in the galaxy)';
    }
    return `${years} year${years !== 1 ? 's' : ''}`;
  }
}

/**
 * Check for common patterns that weaken passphrases
 *
 * Detects common patterns like:
 * - Keyboard walks (qwerty, asdfgh)
 * - Sequences (123456, abcdef)
 * - Repetition (aaaaaa, 111111)
 *
 * @param passphrase - Passphrase to check
 * @returns List of detected patterns
 */
export function detectWeakPatterns(passphrase: string): string[] {
  const patterns: string[] = [];

  // Check for repeated characters
  if (/(.)\1{2,}/.test(passphrase)) {
    patterns.push('Contains repeated characters');
  }

  // Check for sequential numbers
  if (/(?:0123|1234|2345|3456|4567|5678|6789)/.test(passphrase)) {
    patterns.push('Contains sequential numbers');
  }

  // Check for sequential letters
  if (/(?:abcd|bcde|cdef|defg|efgh|fghi|ghij)/.test(passphrase.toLowerCase())) {
    patterns.push('Contains sequential letters');
  }

  // Check for keyboard walks
  const keyboardPatterns = [
    'qwert', 'asdf', 'zxcv', 'yuiop', 'hjkl', 'bnm',
    'qwerty', 'asdfgh', 'zxcvbn',
  ];

  for (const pattern of keyboardPatterns) {
    if (passphrase.toLowerCase().includes(pattern)) {
      patterns.push('Contains keyboard pattern');
      break;
    }
  }

  // Check for common substitutions that don't add much entropy
  if (/[3e][1l][7t][0o][5s]/i.test(passphrase)) {
    patterns.push('Uses common character substitutions (leet speak)');
  }

  return patterns;
}

/**
 * Generate a random passphrase suggestion
 *
 * Generates a secure random passphrase using word-based approach.
 * In production, this would use a proper word list (like EFF's).
 *
 * @param wordCount - Number of words to generate (default 4)
 * @returns Generated passphrase
 *
 * @example
 * ```typescript
 * const suggestion = generatePassphraseSuggestion(5);
 * // "correct horse battery staple cloud"
 * ```
 */
export function generatePassphraseSuggestion(wordCount: number = 4): string {
  // Simple word list for demonstration
  // In production, use EFF's long wordlist or similar
  const words = [
    'correct', 'horse', 'battery', 'staple', 'cloud', 'mountain',
    'river', 'ocean', 'forest', 'desert', 'valley', 'canyon',
    'thunder', 'lightning', 'rainbow', 'sunshine', 'moonlight',
    'starlight', 'crystal', 'diamond', 'emerald', 'sapphire',
    'dragon', 'phoenix', 'griffin', 'unicorn', 'pegasus',
    'wizard', 'knight', 'castle', 'tower', 'bridge', 'garden',
    'palace', 'temple', 'shrine', 'monument', 'statue',
  ];

  const selectedWords: string[] = [];
  const usedIndices = new Set<number>();

  for (let i = 0; i < wordCount; i++) {
    let randomIndex: number;
    do {
      // Use crypto.getRandomValues for secure random selection
      const randomArray = new Uint32Array(1);
      crypto.getRandomValues(randomArray);
      const randomValue = randomArray[0];
      if (randomValue === undefined) {
        throw new Error('Failed to generate random value');
      }
      randomIndex = randomValue % words.length;
    } while (usedIndices.has(randomIndex));

    usedIndices.add(randomIndex);
    const word = words[randomIndex];
    if (word) {
      selectedWords.push(word);
    }
  }

  return selectedWords.join(' ');
}

/**
 * Validate passphrase with detailed feedback
 *
 * Extended validation that includes pattern detection and
 * crack time estimation.
 *
 * @param passphrase - Passphrase to validate
 * @returns Detailed validation result
 */
export function validatePassphraseDetailed(passphrase: string) {
  const basicResult = validatePassphrase(passphrase);
  const weakPatterns = detectWeakPatterns(passphrase);
  const strengthFeedback = getStrengthFeedback(basicResult.entropy);
  const crackTime = estimateCrackTime(basicResult.entropy);
  const wordBased = isWordBased(passphrase);

  return {
    ...basicResult,
    weakPatterns,
    strengthFeedback,
    crackTime,
    wordBased,
  };
}
