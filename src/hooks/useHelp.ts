/**
 * useHelp - Hook for accessing help content
 */

import { useState, useCallback, useMemo } from 'react';
import { getContextualHelp, type HelpContext, type ContextualHelpResult } from '../features/helpers/contextualHelp';
import { getHelpDefinition, type HelpDefinition } from '../features/helpers/helpDefinitions';
import { getHelpContent, type HelpContent } from '../features/helpers/helpContent';

export interface UseHelpOptions {
  context?: HelpContext;
  autoLoad?: boolean;
}

export interface UseHelpReturn {
  // Current help data
  contextualHelp: ContextualHelpResult | null;
  currentDefinition: HelpDefinition | null;
  currentContent: HelpContent | null;

  // Actions
  loadContextualHelp: (context: HelpContext) => void;
  showDefinition: (termId: string) => void;
  showContent: (contentId: string) => void;
  clearHelp: () => void;

  // State
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook for accessing and managing help content
 */
export function useHelp(options: UseHelpOptions = {}): UseHelpReturn {
  const { context, autoLoad = false } = options;

  const [contextualHelp, setContextualHelp] = useState<ContextualHelpResult | null>(null);
  const [currentDefinition, setCurrentDefinition] = useState<HelpDefinition | null>(null);
  const [currentContent, setCurrentContent] = useState<HelpContent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load contextual help based on context
  const loadContextualHelp = useCallback((ctx: HelpContext) => {
    setIsLoading(true);
    setError(null);

    try {
      const help = getContextualHelp(ctx);
      setContextualHelp(help);

      // Auto-show quick tip if available
      if (help.quickTip) {
        setCurrentContent(help.quickTip);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load help');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Show a specific definition
  const showDefinition = useCallback((termId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const definition = getHelpDefinition(termId);
      if (definition) {
        setCurrentDefinition(definition);
        setCurrentContent(null);
      } else {
        setError(`Help topic "${termId}" not found`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load definition');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Show specific help content
  const showContent = useCallback((contentId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const content = getHelpContent(contentId);
      if (content) {
        setCurrentContent(content);
        setCurrentDefinition(null);
      } else {
        setError(`Help content "${contentId}" not found`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load content');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Clear all help state
  const clearHelp = useCallback(() => {
    setContextualHelp(null);
    setCurrentDefinition(null);
    setCurrentContent(null);
    setError(null);
  }, []);

  // Auto-load contextual help if context provided and autoLoad enabled
  useMemo(() => {
    if (context && autoLoad) {
      loadContextualHelp(context);
    }
  }, [context, autoLoad, loadContextualHelp]);

  return {
    contextualHelp,
    currentDefinition,
    currentContent,
    loadContextualHelp,
    showDefinition,
    showContent,
    clearHelp,
    isLoading,
    error,
  };
}
