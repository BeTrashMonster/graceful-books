/**
 * Contextual help logic - determines what help to show based on user context
 */

import { getHelpContent, getHelpContentByArea, type HelpContent } from './helpContent';
import { getHelpDefinition, type HelpDefinition } from './helpDefinitions';

export interface HelpContext {
  page?: string;
  section?: string;
  field?: string;
  userLevel?: 'beginner' | 'intermediate' | 'advanced';
  accountingMethod?: 'cash' | 'accrual';
}

export interface ContextualHelpResult {
  quickTip?: HelpContent;
  relatedDefinitions?: HelpDefinition[];
  additionalResources?: HelpContent[];
}

/**
 * Get contextual help based on where the user is in the app
 */
export function getContextualHelp(context: HelpContext): ContextualHelpResult {
  const result: ContextualHelpResult = {
    relatedDefinitions: [],
    additionalResources: [],
  };

  // Build help ID from context
  const helpId = buildHelpId(context);

  // Get quick tip for this context
  if (helpId) {
    result.quickTip = getHelpContent(helpId);
  }

  // Get related definitions based on page
  if (context.page) {
    result.relatedDefinitions = getRelatedDefinitions(context.page);
  }

  // Get additional resources
  if (context.section) {
    result.additionalResources = getHelpContentByArea(context.section);
  }

  return result;
}

/**
 * Build help content ID from context
 */
function buildHelpId(context: HelpContext): string | null {
  if (context.field && context.section) {
    return `${context.section}-${context.field}`;
  }
  if (context.section) {
    return context.section;
  }
  return null;
}

/**
 * Get related term definitions based on page/feature
 */
function getRelatedDefinitions(page: string): HelpDefinition[] {
  const definitionMap: Record<string, string[]> = {
    'transactions': ['double-entry', 'debit-credit', 'chart-of-accounts'],
    'accounts': ['chart-of-accounts', 'assets', 'liabilities', 'equity', 'revenue', 'expenses'],
    'balance-sheet': ['balance-sheet', 'assets', 'liabilities', 'equity'],
    'profit-loss': ['profit-loss', 'revenue', 'expenses'],
    'cash-flow': ['cash-flow', 'accrual-vs-cash'],
    'reports': ['balance-sheet', 'profit-loss', 'cash-flow'],
    'settings': ['accrual-vs-cash', 'chart-of-accounts'],
    'dashboard': ['balance-sheet', 'profit-loss', 'cash-flow'],
  };

  const termIds = definitionMap[page] || [];
  return termIds
    .map(id => getHelpDefinition(id))
    .filter((def): def is HelpDefinition => def !== undefined);
}

/**
 * Determine if user should see beginner-level help
 */
export function shouldShowBeginnerHelp(context: HelpContext): boolean {
  // Show beginner help by default, or if explicitly set
  return !context.userLevel || context.userLevel === 'beginner';
}

/**
 * Get help for a specific accounting term
 */
export function getTermHelp(termId: string): HelpDefinition | undefined {
  return getHelpDefinition(termId);
}

/**
 * Get suggested help topics for a user
 */
export function getSuggestedTopics(userLevel: 'beginner' | 'intermediate' | 'advanced' = 'beginner'): HelpDefinition[] {
  const beginnerTopics = ['double-entry', 'debit-credit', 'chart-of-accounts', 'assets', 'liabilities'];
  const intermediateTopics = ['balance-sheet', 'profit-loss', 'cash-flow'];
  const advancedTopics = ['accrual-vs-cash', 'equity', 'revenue', 'expenses'];

  let topicIds: string[] = [];

  if (userLevel === 'beginner') {
    topicIds = beginnerTopics;
  } else if (userLevel === 'intermediate') {
    topicIds = [...beginnerTopics, ...intermediateTopics];
  } else {
    topicIds = [...beginnerTopics, ...intermediateTopics, ...advancedTopics];
  }

  return topicIds
    .map(id => getHelpDefinition(id))
    .filter((def): def is HelpDefinition => def !== undefined);
}

/**
 * Check if help content exists for a given context
 */
export function hasHelpForContext(context: HelpContext): boolean {
  const helpId = buildHelpId(context);
  if (!helpId) return false;
  return getHelpContent(helpId) !== undefined;
}
