/**
 * Adaptive Message Selection Logic
 *
 * Selects the appropriate message variant based on user's DISC profile
 * with intelligent fallback handling.
 */

import type { DISCProfile } from '../../utils/discMessageAdapter';
import { getPrimaryStyle, getSecondaryStyle, getFallbackStyle } from '../../utils/discMessageAdapter';
import { getMessageById, type DISCType, type MessageVariants } from './messageLibrary';

/**
 * Options for message retrieval
 */
export interface GetMessageOptions {
  /** User's DISC profile (optional - will use default if not provided) */
  profile?: DISCProfile | null;
  /** Placeholder values for message interpolation */
  placeholders?: Record<string, string | number>;
  /** Force a specific DISC type (for testing/preview) */
  forceDISCType?: DISCType;
}

/**
 * Get an adaptive message based on user's DISC profile
 *
 * Algorithm:
 * 1. Retrieve user's DISC profile
 * 2. Get primary style from profile
 * 3. Look up message variants for message ID
 * 4. Select variant matching primary style
 * 5. If primary style variant missing, try secondary style
 * 6. If both missing, use Steadiness variant (default)
 * 7. If Steadiness variant missing, use fallback message
 *
 * @param messageId - Unique message identifier
 * @param options - Message retrieval options
 * @returns Appropriate message text for the user
 */
export function getAdaptiveMessage(messageId: string, options: GetMessageOptions = {}): string {
  const message = getMessageById(messageId);

  // If message not found, return a generic fallback
  if (!message) {
    console.error(`Message not found: ${messageId}`);
    return `[Message not found: ${messageId}]`;
  }

  // Determine which DISC style to use
  let discStyle: DISCType;

  if (options.forceDISCType) {
    // For testing/preview - force a specific type
    discStyle = options.forceDISCType;
  } else {
    // Get primary style from profile (or default 'S')
    const primaryStyle = getPrimaryStyle(options.profile);
    const secondaryStyle = getSecondaryStyle(options.profile);

    // Try to find an available variant
    const availableStyles = getAvailableStyles(message.variants);

    // Use primary if available, otherwise use fallback logic
    if (availableStyles.includes(primaryStyle)) {
      discStyle = primaryStyle;
    } else if (availableStyles.includes(secondaryStyle)) {
      discStyle = secondaryStyle;
    } else {
      discStyle = getFallbackStyle(options.profile, availableStyles);
    }
  }

  // Get the message text for the selected DISC style
  let messageText = message.variants[discStyle] || message.fallback;

  // If still no message, use the fallback
  if (!messageText) {
    console.warn(`No variant found for ${messageId} with style ${discStyle}, using fallback`);
    messageText = message.fallback;
  }

  // Interpolate placeholders if provided
  if (options.placeholders && message.placeholders) {
    messageText = interpolatePlaceholders(messageText, options.placeholders, message.placeholders);
  }

  return messageText;
}

/**
 * Get all available DISC styles for a message's variants
 */
function getAvailableStyles(variants: MessageVariants): DISCType[] {
  const styles: DISCType[] = [];
  const discTypes: DISCType[] = ['D', 'I', 'S', 'C'];

  for (const type of discTypes) {
    if (variants[type]) {
      styles.push(type);
    }
  }

  return styles;
}

/**
 * Interpolate placeholders in a message
 * Replaces {placeholder} with actual values
 */
function interpolatePlaceholders(
  message: string,
  values: Record<string, string | number>,
  expectedPlaceholders: string[]
): string {
  let result = message;

  for (const placeholder of expectedPlaceholders) {
    const value = values[placeholder];

    if (value === undefined || value === null) {
      console.warn(`Missing placeholder value for: ${placeholder}`);
      continue;
    }

    // Replace all occurrences of {placeholder}
    const regex = new RegExp(`\\{${placeholder}\\}`, 'g');
    result = result.replace(regex, String(value));
  }

  return result;
}

/**
 * Get all variants of a message (for preview/testing)
 */
export function getMessageVariants(messageId: string, placeholders?: Record<string, string | number>): {
  D: string;
  I: string;
  S: string;
  C: string;
  fallback: string;
} | null {
  const message = getMessageById(messageId);

  if (!message) {
    return null;
  }

  const result = {
    D: message.variants.D || message.fallback,
    I: message.variants.I || message.fallback,
    S: message.variants.S || message.fallback,
    C: message.variants.C || message.fallback,
    fallback: message.fallback,
  };

  // Interpolate placeholders if provided
  if (placeholders && message.placeholders) {
    result.D = interpolatePlaceholders(result.D, placeholders, message.placeholders);
    result.I = interpolatePlaceholders(result.I, placeholders, message.placeholders);
    result.S = interpolatePlaceholders(result.S, placeholders, message.placeholders);
    result.C = interpolatePlaceholders(result.C, placeholders, message.placeholders);
    result.fallback = interpolatePlaceholders(result.fallback, placeholders, message.placeholders);
  }

  return result;
}

/**
 * Validate message variant coverage
 * Returns completeness percentage for a message
 */
export function getMessageCompleteness(messageId: string): {
  hasD: boolean;
  hasI: boolean;
  hasS: boolean;
  hasC: boolean;
  completeness: number; // 0-100%
  missingStyles: DISCType[];
} {
  const message = getMessageById(messageId);

  if (!message) {
    return {
      hasD: false,
      hasI: false,
      hasS: false,
      hasC: false,
      completeness: 0,
      missingStyles: ['D', 'I', 'S', 'C'],
    };
  }

  const hasD = !!message.variants.D;
  const hasI = !!message.variants.I;
  const hasS = !!message.variants.S;
  const hasC = !!message.variants.C;

  const count = [hasD, hasI, hasS, hasC].filter(Boolean).length;
  const completeness = (count / 4) * 100;

  const missingStyles: DISCType[] = [];
  if (!hasD) missingStyles.push('D');
  if (!hasI) missingStyles.push('I');
  if (!hasS) missingStyles.push('S');
  if (!hasC) missingStyles.push('C');

  return {
    hasD,
    hasI,
    hasS,
    hasC,
    completeness,
    missingStyles,
  };
}
