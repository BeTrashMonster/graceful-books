/**
 * Helpers feature index
 */

export {
  helpDefinitions,
  getAllHelpTerms,
  searchHelpDefinitions,
  getHelpDefinition,
  type HelpDefinition,
} from './helpDefinitions';

export {
  helpContent,
  getHelpContent,
  getHelpContentByArea,
  searchHelpContent,
  type HelpContent,
} from './helpContent';

export {
  getContextualHelp,
  shouldShowBeginnerHelp,
  getTermHelp,
  getSuggestedTopics,
  hasHelpForContext,
  type HelpContext,
  type ContextualHelpResult,
} from './contextualHelp';
