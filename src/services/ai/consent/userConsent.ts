/**
 * User Consent Service
 *
 * Manages user consent for AI features.
 * Ensures users explicitly opt-in to AI assistance and understand
 * what AI will do with their data.
 *
 * Key principles:
 * - Explicit consent required before any AI features
 * - Clear disclosure of what AI does
 * - Easy opt-out at any time
 * - Granular control per feature
 * - Consent stored with user preferences
 *
 * @security Phase 3.4 - User Disclosure & Consent Framework
 * @see docs/security/AGENTIC_AI_SECURITY_ROADMAP.md
 */

/**
 * AI feature types that require consent
 */
export enum AIFeature {
  // Transaction categorization
  AUTO_CATEGORIZE = 'auto_categorize',

  // Anomaly detection
  ANOMALY_DETECTION = 'anomaly_detection',

  // Financial forecasting
  CASH_FLOW_FORECAST = 'cash_flow_forecast',

  // Bank reconciliation assistance
  RECONCILIATION_ASSIST = 'reconciliation_assist',

  // Financial summaries and insights
  FINANCIAL_INSIGHTS = 'financial_insights',

  // Document data extraction (OCR + AI)
  DOCUMENT_EXTRACTION = 'document_extraction',
}

/**
 * Consent status
 */
export enum ConsentStatus {
  NOT_ASKED = 'not_asked',
  GRANTED = 'granted',
  DENIED = 'denied',
  REVOKED = 'revoked',
}

/**
 * Individual feature consent record
 */
export interface FeatureConsent {
  feature: AIFeature;
  status: ConsentStatus;
  granted_at?: string;
  revoked_at?: string;
  last_updated: string;
}

/**
 * User's complete AI consent record
 */
export interface UserAIConsent {
  user_id: string;
  company_id: string;

  // Master consent (must be granted first)
  master_consent: {
    status: ConsentStatus;
    granted_at?: string;
    revoked_at?: string;
  };

  // Per-feature consent
  feature_consent: Record<AIFeature, FeatureConsent>;

  // Preferences
  preferences: {
    require_review_before_apply: boolean;
    notification_frequency: 'immediate' | 'daily' | 'weekly' | 'none';
    auto_reject_low_confidence: boolean;
    confidence_threshold: number;
  };

  // Metadata
  created_at: string;
  updated_at: string;
  version: number;
}

/**
 * Consent disclosure information
 */
export interface FeatureDisclosure {
  feature: AIFeature;
  name: string;
  description: string;
  data_used: string[];
  ai_actions: string[];
  human_review: boolean;
  can_modify_data: boolean;
}

// Feature disclosures
const FEATURE_DISCLOSURES: Record<AIFeature, FeatureDisclosure> = {
  [AIFeature.AUTO_CATEGORIZE]: {
    feature: AIFeature.AUTO_CATEGORIZE,
    name: 'Auto-Categorization',
    description:
      'AI suggests categories for your transactions based on descriptions and patterns.',
    data_used: [
      'Transaction descriptions (sanitized)',
      'Transaction amounts',
      'Your existing categories',
    ],
    ai_actions: [
      'Analyzes transaction patterns',
      'Suggests categories for uncategorized transactions',
    ],
    human_review: true,
    can_modify_data: false, // Only suggests, never applies directly
  },

  [AIFeature.ANOMALY_DETECTION]: {
    feature: AIFeature.ANOMALY_DETECTION,
    name: 'Anomaly Detection',
    description:
      'AI identifies unusual transactions that might need your attention.',
    data_used: [
      'Transaction amounts',
      'Transaction dates',
      'Transaction patterns',
    ],
    ai_actions: [
      'Compares transactions to historical patterns',
      'Flags potential duplicates',
      'Identifies unusual amounts',
    ],
    human_review: true,
    can_modify_data: false,
  },

  [AIFeature.CASH_FLOW_FORECAST]: {
    feature: AIFeature.CASH_FLOW_FORECAST,
    name: 'Cash Flow Forecasting',
    description: 'AI predicts your future income and expenses based on patterns.',
    data_used: [
      'Historical income amounts',
      'Historical expense amounts',
      'Transaction dates and patterns',
    ],
    ai_actions: [
      'Analyzes spending trends',
      'Projects future cash flow',
      'Identifies seasonal patterns',
    ],
    human_review: false, // Read-only forecasts
    can_modify_data: false,
  },

  [AIFeature.RECONCILIATION_ASSIST]: {
    feature: AIFeature.RECONCILIATION_ASSIST,
    name: 'Reconciliation Assistance',
    description:
      'AI helps match bank transactions with your records during reconciliation.',
    data_used: [
      'Bank transaction descriptions',
      'Bank transaction amounts',
      'Your existing transactions',
    ],
    ai_actions: [
      'Suggests matches between bank and book entries',
      'Identifies potential discrepancies',
    ],
    human_review: true,
    can_modify_data: false,
  },

  [AIFeature.FINANCIAL_INSIGHTS]: {
    feature: AIFeature.FINANCIAL_INSIGHTS,
    name: 'Financial Insights',
    description: 'AI provides summaries and insights about your financial data.',
    data_used: [
      'Aggregated transaction totals',
      'Category breakdowns',
      'Period comparisons',
    ],
    ai_actions: [
      'Generates spending summaries',
      'Identifies trends',
      'Provides actionable insights',
    ],
    human_review: false, // Read-only insights
    can_modify_data: false,
  },

  [AIFeature.DOCUMENT_EXTRACTION]: {
    feature: AIFeature.DOCUMENT_EXTRACTION,
    name: 'Document Data Extraction',
    description:
      'AI extracts data from receipts and invoices to help with data entry.',
    data_used: [
      'Uploaded document images',
      'OCR-extracted text',
    ],
    ai_actions: [
      'Identifies vendor names',
      'Extracts amounts and dates',
      'Suggests transaction details',
    ],
    human_review: true,
    can_modify_data: false,
  },
};

// In-memory consent storage (in production, persist to database)
const consentStore = new Map<string, UserAIConsent>();

/**
 * Generate consent store key
 */
function getConsentKey(userId: string, companyId: string): string {
  return `${companyId}:${userId}`;
}

/**
 * Create default consent record
 */
function createDefaultConsent(userId: string, companyId: string): UserAIConsent {
  const now = new Date().toISOString();

  const featureConsent: Record<AIFeature, FeatureConsent> = {} as any;
  for (const feature of Object.values(AIFeature)) {
    featureConsent[feature] = {
      feature,
      status: ConsentStatus.NOT_ASKED,
      last_updated: now,
    };
  }

  return {
    user_id: userId,
    company_id: companyId,
    master_consent: {
      status: ConsentStatus.NOT_ASKED,
    },
    feature_consent: featureConsent,
    preferences: {
      require_review_before_apply: true,
      notification_frequency: 'immediate',
      auto_reject_low_confidence: false,
      confidence_threshold: 0.7,
    },
    created_at: now,
    updated_at: now,
    version: 1,
  };
}

/**
 * Get user's consent record
 */
export function getUserConsent(userId: string, companyId: string): UserAIConsent {
  const key = getConsentKey(userId, companyId);
  let consent = consentStore.get(key);

  if (!consent) {
    consent = createDefaultConsent(userId, companyId);
    consentStore.set(key, consent);
  }

  return { ...consent };
}

/**
 * Grant master consent for AI features
 */
export function grantMasterConsent(
  userId: string,
  companyId: string
): UserAIConsent {
  const key = getConsentKey(userId, companyId);
  const consent = getUserConsent(userId, companyId);
  const now = new Date().toISOString();

  consent.master_consent = {
    status: ConsentStatus.GRANTED,
    granted_at: now,
  };
  consent.updated_at = now;
  consent.version++;

  consentStore.set(key, consent);
  return { ...consent };
}

/**
 * Revoke master consent for AI features
 */
export function revokeMasterConsent(
  userId: string,
  companyId: string
): UserAIConsent {
  const key = getConsentKey(userId, companyId);
  const consent = getUserConsent(userId, companyId);
  const now = new Date().toISOString();

  consent.master_consent = {
    status: ConsentStatus.REVOKED,
    revoked_at: now,
    granted_at: consent.master_consent.granted_at,
  };

  // Also revoke all feature consent
  for (const feature of Object.values(AIFeature)) {
    if (consent.feature_consent[feature].status === ConsentStatus.GRANTED) {
      consent.feature_consent[feature] = {
        feature,
        status: ConsentStatus.REVOKED,
        granted_at: consent.feature_consent[feature].granted_at,
        revoked_at: now,
        last_updated: now,
      };
    }
  }

  consent.updated_at = now;
  consent.version++;

  consentStore.set(key, consent);
  return { ...consent };
}

/**
 * Grant consent for a specific feature
 */
export function grantFeatureConsent(
  userId: string,
  companyId: string,
  feature: AIFeature
): { success: boolean; error?: string; consent?: UserAIConsent } {
  const consent = getUserConsent(userId, companyId);

  // Master consent required first
  if (consent.master_consent.status !== ConsentStatus.GRANTED) {
    return {
      success: false,
      error: 'Master AI consent must be granted first',
    };
  }

  const key = getConsentKey(userId, companyId);
  const now = new Date().toISOString();

  consent.feature_consent[feature] = {
    feature,
    status: ConsentStatus.GRANTED,
    granted_at: now,
    last_updated: now,
  };
  consent.updated_at = now;
  consent.version++;

  consentStore.set(key, consent);
  return { success: true, consent: { ...consent } };
}

/**
 * Revoke consent for a specific feature
 */
export function revokeFeatureConsent(
  userId: string,
  companyId: string,
  feature: AIFeature
): UserAIConsent {
  const key = getConsentKey(userId, companyId);
  const consent = getUserConsent(userId, companyId);
  const now = new Date().toISOString();

  consent.feature_consent[feature] = {
    feature,
    status: ConsentStatus.REVOKED,
    granted_at: consent.feature_consent[feature].granted_at,
    revoked_at: now,
    last_updated: now,
  };
  consent.updated_at = now;
  consent.version++;

  consentStore.set(key, consent);
  return { ...consent };
}

/**
 * Check if a feature is allowed for user
 */
export function isFeatureAllowed(
  userId: string,
  companyId: string,
  feature: AIFeature
): boolean {
  const consent = getUserConsent(userId, companyId);

  // Master consent required
  if (consent.master_consent.status !== ConsentStatus.GRANTED) {
    return false;
  }

  // Feature consent required
  return consent.feature_consent[feature].status === ConsentStatus.GRANTED;
}

/**
 * Check if any AI features are allowed
 */
export function hasAnyAIConsent(userId: string, companyId: string): boolean {
  const consent = getUserConsent(userId, companyId);
  return consent.master_consent.status === ConsentStatus.GRANTED;
}

/**
 * Get list of features user has consented to
 */
export function getConsentedFeatures(
  userId: string,
  companyId: string
): AIFeature[] {
  const consent = getUserConsent(userId, companyId);

  if (consent.master_consent.status !== ConsentStatus.GRANTED) {
    return [];
  }

  return Object.values(AIFeature).filter(
    (feature) => consent.feature_consent[feature].status === ConsentStatus.GRANTED
  );
}

/**
 * Update user preferences
 */
export function updatePreferences(
  userId: string,
  companyId: string,
  preferences: Partial<UserAIConsent['preferences']>
): UserAIConsent {
  const key = getConsentKey(userId, companyId);
  const consent = getUserConsent(userId, companyId);
  const now = new Date().toISOString();

  consent.preferences = {
    ...consent.preferences,
    ...preferences,
  };
  consent.updated_at = now;
  consent.version++;

  consentStore.set(key, consent);
  return { ...consent };
}

/**
 * Get feature disclosure information
 */
export function getFeatureDisclosure(feature: AIFeature): FeatureDisclosure {
  return { ...FEATURE_DISCLOSURES[feature] };
}

/**
 * Get all feature disclosures
 */
export function getAllFeatureDisclosures(): FeatureDisclosure[] {
  return Object.values(FEATURE_DISCLOSURES).map((d) => ({ ...d }));
}

/**
 * Generate consent request for UI
 */
export function generateConsentRequest(feature: AIFeature): {
  disclosure: FeatureDisclosure;
  consent_text: string;
  requires_human_review: boolean;
} {
  const disclosure = getFeatureDisclosure(feature);

  const dataList = disclosure.data_used.join(', ');
  const actionList = disclosure.ai_actions.join('; ');

  const consentText = `
By enabling ${disclosure.name}, you allow Graceful Books AI to:

What data is used:
${disclosure.data_used.map((d) => `• ${d}`).join('\n')}

What AI does:
${disclosure.ai_actions.map((a) => `• ${a}`).join('\n')}

${disclosure.human_review ? 'All AI suggestions require your review before any changes are made.' : 'This feature provides read-only insights and does not modify your data.'}

You can revoke this consent at any time in Settings.
  `.trim();

  return {
    disclosure,
    consent_text: consentText,
    requires_human_review: disclosure.human_review,
  };
}

/**
 * Clear all consent data (for testing)
 */
export function clearAll(): void {
  consentStore.clear();
}

export default {
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
  clearAll,
  AIFeature,
  ConsentStatus,
};
