/**
 * AI Disclosure Service
 *
 * Generates disclosure information for AI-assisted features.
 * Ensures users always know when AI is involved and what it's doing.
 *
 * Key principles:
 * - Clear visual indicators for AI-assisted content
 * - Hover/click disclosure with details
 * - Confidence level display
 * - Easy access to original/manual options
 *
 * @security Phase 3.4 - User Disclosure & Consent Framework
 * @see docs/security/AGENTIC_AI_SECURITY_ROADMAP.md
 */

import { AIFeature } from './userConsent';
import { AITaskType } from '../architecture/types';

/**
 * Disclosure level
 */
export enum DisclosureLevel {
  MINIMAL = 'minimal', // Just an icon
  STANDARD = 'standard', // Icon + short text
  DETAILED = 'detailed', // Full explanation
}

/**
 * AI indicator type for UI
 */
export interface AIIndicator {
  type: 'badge' | 'icon' | 'banner' | 'tooltip';
  label: string;
  description: string;
  confidence?: number;
  feature: AIFeature;
  task_type?: AITaskType;
}

/**
 * AI suggestion disclosure
 */
export interface SuggestionDisclosure {
  suggestion_id: string;
  feature: AIFeature;
  task_type: AITaskType;

  // Main disclosure
  title: string;
  description: string;
  confidence: number;
  confidence_label: string;

  // What AI analyzed
  data_analyzed: string;

  // Actions
  actions: {
    approve: string;
    reject: string;
    modify?: string;
    view_details: string;
  };

  // Warnings
  warnings: string[];

  // Timestamp
  generated_at: string;
}

/**
 * Map task type to user-friendly name
 */
const TASK_TYPE_NAMES: Record<AITaskType, string> = {
  [AITaskType.CATEGORIZE]: 'Category Suggestion',
  [AITaskType.ANOMALY_DETECT]: 'Anomaly Alert',
  [AITaskType.FORECAST]: 'Cash Flow Forecast',
  [AITaskType.RECONCILE]: 'Reconciliation Match',
  [AITaskType.SUMMARIZE]: 'Financial Summary',
};

/**
 * Map task type to feature
 */
const TASK_TO_FEATURE: Record<AITaskType, AIFeature> = {
  [AITaskType.CATEGORIZE]: AIFeature.AUTO_CATEGORIZE,
  [AITaskType.ANOMALY_DETECT]: AIFeature.ANOMALY_DETECTION,
  [AITaskType.FORECAST]: AIFeature.CASH_FLOW_FORECAST,
  [AITaskType.RECONCILE]: AIFeature.RECONCILIATION_ASSIST,
  [AITaskType.SUMMARIZE]: AIFeature.FINANCIAL_INSIGHTS,
};

/**
 * Get confidence label
 */
function getConfidenceLabel(confidence: number): string {
  if (confidence >= 0.9) return 'Very High';
  if (confidence >= 0.7) return 'High';
  if (confidence >= 0.5) return 'Moderate';
  if (confidence >= 0.3) return 'Low';
  return 'Very Low';
}

/**
 * Generate an AI indicator for UI display
 */
export function generateIndicator(
  feature: AIFeature,
  taskType?: AITaskType,
  confidence?: number
): AIIndicator {
  const taskName = taskType ? TASK_TYPE_NAMES[taskType] : 'AI Assisted';

  let description = 'This content was generated with AI assistance.';
  if (confidence !== undefined) {
    description += ` Confidence: ${getConfidenceLabel(confidence)} (${Math.round(confidence * 100)}%)`;
  }

  return {
    type: confidence !== undefined ? 'badge' : 'icon',
    label: taskName,
    description,
    confidence,
    feature,
    task_type: taskType,
  };
}

/**
 * Generate disclosure for an AI suggestion
 */
export function generateSuggestionDisclosure(
  suggestionId: string,
  taskType: AITaskType,
  confidence: number,
  affectedCount: number,
  details?: Record<string, unknown>
): SuggestionDisclosure {
  const feature = TASK_TO_FEATURE[taskType];
  const taskName = TASK_TYPE_NAMES[taskType];
  const confidenceLabel = getConfidenceLabel(confidence);

  const warnings: string[] = [];

  // Add confidence warning
  if (confidence < 0.5) {
    warnings.push(
      'This suggestion has low confidence. Please review carefully before accepting.'
    );
  }

  // Add volume warning
  if (affectedCount > 50) {
    warnings.push(
      `This suggestion affects ${affectedCount} items. Consider reviewing a sample before bulk acceptance.`
    );
  }

  // Task-specific descriptions
  let description = '';
  let dataAnalyzed = '';

  switch (taskType) {
    case AITaskType.CATEGORIZE:
      description = `AI has analyzed your transactions and suggested ${affectedCount} category assignment${affectedCount !== 1 ? 's' : ''}.`;
      dataAnalyzed = 'Transaction descriptions, amounts, and your existing categories';
      break;

    case AITaskType.ANOMALY_DETECT:
      description = `AI has identified ${affectedCount} transaction${affectedCount !== 1 ? 's' : ''} that may need your attention.`;
      dataAnalyzed = 'Transaction patterns, amounts, and timing';
      break;

    case AITaskType.FORECAST:
      description = 'AI has generated a cash flow forecast based on your historical data.';
      dataAnalyzed = 'Historical income and expense patterns';
      break;

    case AITaskType.RECONCILE:
      description = `AI has suggested ${affectedCount} match${affectedCount !== 1 ? 'es' : ''} between bank and book entries.`;
      dataAnalyzed = 'Bank transaction details and your existing records';
      break;

    case AITaskType.SUMMARIZE:
      description = 'AI has generated a summary of your financial activity.';
      dataAnalyzed = 'Aggregated transaction totals and category breakdowns';
      break;
  }

  return {
    suggestion_id: suggestionId,
    feature,
    task_type: taskType,
    title: taskName,
    description,
    confidence,
    confidence_label: confidenceLabel,
    data_analyzed: dataAnalyzed,
    actions: {
      approve: 'Accept Suggestion',
      reject: 'Dismiss',
      modify: taskType === AITaskType.CATEGORIZE ? 'Modify Category' : undefined,
      view_details: 'View Details',
    },
    warnings,
    generated_at: new Date().toISOString(),
  };
}

/**
 * Generate banner text for AI-assisted screens
 */
export function generateBannerText(feature: AIFeature): {
  title: string;
  description: string;
  learn_more_link: string;
} {
  switch (feature) {
    case AIFeature.AUTO_CATEGORIZE:
      return {
        title: 'AI-Assisted Categorization',
        description:
          'AI is helping suggest categories for your transactions. You review and approve all suggestions before they are applied.',
        learn_more_link: '/help/ai/categorization',
      };

    case AIFeature.ANOMALY_DETECTION:
      return {
        title: 'AI Anomaly Detection Active',
        description:
          'AI is monitoring your transactions for unusual patterns. Any flagged items appear here for your review.',
        learn_more_link: '/help/ai/anomaly-detection',
      };

    case AIFeature.CASH_FLOW_FORECAST:
      return {
        title: 'AI-Powered Forecast',
        description:
          'This forecast uses AI to analyze your historical patterns. Actual results may vary.',
        learn_more_link: '/help/ai/forecasting',
      };

    case AIFeature.RECONCILIATION_ASSIST:
      return {
        title: 'AI-Assisted Reconciliation',
        description:
          'AI suggests matches between your bank and book entries. Review each match before confirming.',
        learn_more_link: '/help/ai/reconciliation',
      };

    case AIFeature.FINANCIAL_INSIGHTS:
      return {
        title: 'AI-Generated Insights',
        description:
          'These insights are generated by AI analysis of your financial data.',
        learn_more_link: '/help/ai/insights',
      };

    case AIFeature.DOCUMENT_EXTRACTION:
      return {
        title: 'AI Document Processing',
        description:
          'AI is extracting data from your documents. Please verify all extracted values.',
        learn_more_link: '/help/ai/documents',
      };
  }
}

/**
 * Generate accessibility text for AI indicators
 */
export function generateA11yText(
  feature: AIFeature,
  taskType?: AITaskType,
  confidence?: number
): string {
  let text = 'AI-assisted content';

  if (taskType) {
    text = `AI ${TASK_TYPE_NAMES[taskType]}`;
  }

  if (confidence !== undefined) {
    text += ` with ${getConfidenceLabel(confidence).toLowerCase()} confidence`;
  }

  text += '. Select for more information about this AI suggestion.';

  return text;
}

/**
 * Generate explanation of what AI did
 */
export function generateExplanation(
  taskType: AITaskType,
  details: Record<string, unknown>
): string {
  switch (taskType) {
    case AITaskType.CATEGORIZE:
      return `AI analyzed the transaction description and compared it with similar transactions you've categorized before. Based on patterns in your data, it suggests this category.`;

    case AITaskType.ANOMALY_DETECT:
      const anomalyType = details.anomaly_type as string;
      switch (anomalyType) {
        case 'duplicate':
          return 'This transaction appears similar to another transaction. It may be a duplicate entry.';
        case 'unusual_amount':
          return 'The amount of this transaction is significantly different from your typical transactions.';
        case 'unusual_timing':
          return 'This transaction occurred at an unusual time compared to your normal patterns.';
        default:
          return 'This transaction has characteristics that differ from your usual patterns.';
      }

    case AITaskType.FORECAST:
      return `This forecast is based on analysis of your income and expense patterns over the past ${details.months_analyzed || 'several'} months. It uses trend analysis to project future cash flow.`;

    case AITaskType.RECONCILE:
      const matchType = details.match_type as string;
      switch (matchType) {
        case 'exact':
          return 'These entries match exactly in amount, date, and description.';
        case 'fuzzy':
          return 'These entries have similar amounts and dates, with minor description differences.';
        case 'partial':
          return 'These entries share some characteristics but may require manual verification.';
        default:
          return 'AI has identified these entries as potential matches.';
      }

    case AITaskType.SUMMARIZE:
      return 'This summary was generated by analyzing your transaction data and identifying key patterns and totals.';
  }
}

/**
 * Generate "How AI Works" explanation
 */
export function generateHowItWorks(feature: AIFeature): {
  title: string;
  steps: string[];
  privacy_note: string;
} {
  const basePrivacyNote =
    'Your financial data is processed securely and is never shared with third parties. AI analysis happens with sanitized data that protects your privacy.';

  switch (feature) {
    case AIFeature.AUTO_CATEGORIZE:
      return {
        title: 'How Auto-Categorization Works',
        steps: [
          'AI reads the description of your transaction (sanitized to protect privacy)',
          'It compares with categories you have used before',
          'It identifies patterns similar to your existing categorizations',
          'A suggestion is generated and added to your review queue',
          'You review and approve, modify, or reject the suggestion',
          'Only approved suggestions are applied to your data',
        ],
        privacy_note: basePrivacyNote,
      };

    case AIFeature.ANOMALY_DETECTION:
      return {
        title: 'How Anomaly Detection Works',
        steps: [
          'AI analyzes your transaction patterns over time',
          'It establishes baselines for amounts, timing, and vendors',
          'New transactions are compared against these patterns',
          'Unusual transactions are flagged for your review',
          'You decide whether to take action on flagged items',
        ],
        privacy_note: basePrivacyNote,
      };

    case AIFeature.CASH_FLOW_FORECAST:
      return {
        title: 'How Cash Flow Forecasting Works',
        steps: [
          'AI analyzes your historical income and expense data',
          'It identifies recurring patterns and seasonal trends',
          'Mathematical models project future cash flows',
          'Forecasts include confidence intervals',
          'Results are for planning purposes only',
        ],
        privacy_note: basePrivacyNote,
      };

    case AIFeature.RECONCILIATION_ASSIST:
      return {
        title: 'How Reconciliation Assistance Works',
        steps: [
          'AI compares bank transactions with your book entries',
          'Exact matches are identified first',
          'Fuzzy matching finds near-matches',
          'Each suggested match is presented for your review',
          'You confirm or reject each match',
          'Only confirmed matches are recorded',
        ],
        privacy_note: basePrivacyNote,
      };

    case AIFeature.FINANCIAL_INSIGHTS:
      return {
        title: 'How Financial Insights Work',
        steps: [
          'AI aggregates your transaction data',
          'It identifies patterns and trends',
          'Key metrics are calculated and compared',
          'Insights are generated in plain language',
          'All insights are read-only observations',
        ],
        privacy_note: basePrivacyNote,
      };

    case AIFeature.DOCUMENT_EXTRACTION:
      return {
        title: 'How Document Extraction Works',
        steps: [
          'Your document is processed with OCR (Optical Character Recognition)',
          'AI identifies key fields (vendor, amount, date)',
          'Extracted data is presented for your review',
          'You verify and correct any extracted values',
          'Only verified data is saved',
        ],
        privacy_note:
          'Document images are processed securely and are not stored after extraction is complete.',
      };
  }
}

export default {
  generateIndicator,
  generateSuggestionDisclosure,
  generateBannerText,
  generateA11yText,
  generateExplanation,
  generateHowItWorks,
  DisclosureLevel,
};
