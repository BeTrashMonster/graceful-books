/**
 * AI Categorization Feature Module
 *
 * @security Phase 4.1 - AI Categorization Feature
 */

export {
  categorizeTransactions,
  applyCategorizationApproval,
  rejectCategorization,
  addNeverSuggestRule,
  getNeverSuggestRules,
  removeNeverSuggestRule,
  getPendingCategorizationSuggestions,
  clearNeverSuggestRules,
  AIDisabledError,
  ConsentNotGrantedError,
  type TransactionInput,
  type CategorySuggestion,
  type CategorizationRequest,
  type CategorizationResult,
} from './categorizationService';

export { default } from './categorizationService';
