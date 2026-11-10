/**
 * AI Consent & Disclosure Module
 *
 * Manages user consent for AI features and provides disclosure information.
 * Ensures transparency and user control over AI assistance.
 *
 * @security Phase 3.4 - User Disclosure & Consent Framework
 * @see docs/security/AGENTIC_AI_SECURITY_ROADMAP.md
 */

// User Consent
export {
  getUserConsent,
  grantMasterConsent,
  revokeMasterConsent,
  grantFeatureConsent,
  revokeFeatureConsent,
  isFeatureAllowed,
  hasAnyAIConsent,
  getConsentedFeatures,
  updatePreferences,
  getFeatureDisclosure,
  getAllFeatureDisclosures,
  generateConsentRequest,
  clearAll as clearConsentStore,
  AIFeature,
  ConsentStatus,
  type UserAIConsent,
  type FeatureConsent,
  type FeatureDisclosure,
} from './userConsent';

// Disclosure
export {
  generateIndicator,
  generateSuggestionDisclosure,
  generateBannerText,
  generateA11yText,
  generateExplanation,
  generateHowItWorks,
  DisclosureLevel,
  type AIIndicator,
  type SuggestionDisclosure,
} from './disclosure';

/**
 * Quick check if AI can be used for a user/feature
 */
export function canUseAI(
  userId: string,
  companyId: string,
  feature?: string
): {
  allowed: boolean;
  reason?: string;
} {
  const { getUserConsent, isFeatureAllowed, AIFeature } = require('./userConsent');
  const consent = getUserConsent(userId, companyId);

  // Check master consent
  if (consent.master_consent.status !== 'granted') {
    return {
      allowed: false,
      reason: 'AI features require user consent. Please enable AI assistance in settings.',
    };
  }

  // Check specific feature if provided
  if (feature && Object.values(AIFeature).includes(feature as AIFeature)) {
    if (!isFeatureAllowed(userId, companyId, feature as AIFeature)) {
      return {
        allowed: false,
        reason: `The ${feature} feature requires separate consent. Enable it in AI settings.`,
      };
    }
  }

  return { allowed: true };
}

// Default export
export default {
  canUseAI,
};
