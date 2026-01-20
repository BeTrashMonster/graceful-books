/**
 * Tests for useHelp hook
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHelp } from './useHelp';
import type { HelpContext } from '../features/helpers/contextualHelp';

describe('useHelp', () => {
  describe('initialization', () => {
    it('should initialize with null state', () => {
      const { result } = renderHook(() => useHelp());
      expect(result.current.contextualHelp).toBeNull();
      expect(result.current.currentDefinition).toBeNull();
      expect(result.current.currentContent).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should provide all expected methods', () => {
      const { result } = renderHook(() => useHelp());
      expect(typeof result.current.loadContextualHelp).toBe('function');
      expect(typeof result.current.showDefinition).toBe('function');
      expect(typeof result.current.showContent).toBe('function');
      expect(typeof result.current.clearHelp).toBe('function');
    });
  });

  describe('loadContextualHelp', () => {
    it('should load contextual help for a given context', () => {
      const { result } = renderHook(() => useHelp());
      const context: HelpContext = {
        page: 'transactions',
        section: 'transaction',
      };

      act(() => {
        result.current.loadContextualHelp(context);
      });

      expect(result.current.contextualHelp).not.toBeNull();
      expect(result.current.contextualHelp?.relatedDefinitions).toBeDefined();
    });

    it('should auto-show quick tip if available', () => {
      const { result } = renderHook(() => useHelp());
      const context: HelpContext = {
        page: 'transactions',
        section: 'transaction',
        field: 'debit-credit',
      };

      act(() => {
        result.current.loadContextualHelp(context);
      });

      expect(result.current.currentContent).not.toBeNull();
      expect(result.current.currentContent?.id).toBe('transaction-debit-credit');
    });

    it('should handle empty context', () => {
      const { result } = renderHook(() => useHelp());

      act(() => {
        result.current.loadContextualHelp({});
      });

      expect(result.current.error).toBeNull();
      expect(result.current.contextualHelp).not.toBeNull();
    });

    it('should update loading state', () => {
      const { result } = renderHook(() => useHelp());
      const context: HelpContext = { page: 'transactions' };

      act(() => {
        result.current.loadContextualHelp(context);
      });

      // After completion, loading should be false
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('showDefinition', () => {
    it('should load and display a definition', () => {
      const { result } = renderHook(() => useHelp());

      act(() => {
        result.current.showDefinition('double-entry');
      });

      expect(result.current.currentDefinition).not.toBeNull();
      expect(result.current.currentDefinition?.term).toBe('Double-Entry Bookkeeping');
      expect(result.current.currentContent).toBeNull();
    });

    it('should clear current content when showing definition', () => {
      const { result } = renderHook(() => useHelp());

      act(() => {
        result.current.showContent('transaction-debit-credit');
      });

      expect(result.current.currentContent).not.toBeNull();

      act(() => {
        result.current.showDefinition('assets');
      });

      expect(result.current.currentDefinition).not.toBeNull();
      expect(result.current.currentContent).toBeNull();
    });

    it('should set error for non-existent definition', () => {
      const { result } = renderHook(() => useHelp());

      act(() => {
        result.current.showDefinition('nonexistent-term');
      });

      expect(result.current.currentDefinition).toBeNull();
      expect(result.current.error).toContain('not found');
    });

    it('should handle multiple consecutive calls', () => {
      const { result } = renderHook(() => useHelp());

      act(() => {
        result.current.showDefinition('assets');
      });

      expect(result.current.currentDefinition?.term).toBe('Assets');

      act(() => {
        result.current.showDefinition('liabilities');
      });

      expect(result.current.currentDefinition?.term).toBe('Liabilities');
    });
  });

  describe('showContent', () => {
    it('should load and display help content', () => {
      const { result } = renderHook(() => useHelp());

      act(() => {
        result.current.showContent('transaction-debit-credit');
      });

      expect(result.current.currentContent).not.toBeNull();
      expect(result.current.currentContent?.title).toBe('Debit & Credit');
      expect(result.current.currentDefinition).toBeNull();
    });

    it('should clear current definition when showing content', () => {
      const { result } = renderHook(() => useHelp());

      act(() => {
        result.current.showDefinition('assets');
      });

      expect(result.current.currentDefinition).not.toBeNull();

      act(() => {
        result.current.showContent('account-type');
      });

      expect(result.current.currentContent).not.toBeNull();
      expect(result.current.currentDefinition).toBeNull();
    });

    it('should set error for non-existent content', () => {
      const { result } = renderHook(() => useHelp());

      act(() => {
        result.current.showContent('nonexistent-content');
      });

      expect(result.current.currentContent).toBeNull();
      expect(result.current.error).toContain('not found');
    });

    it('should handle multiple consecutive calls', () => {
      const { result } = renderHook(() => useHelp());

      act(() => {
        result.current.showContent('transaction-debit-credit');
      });

      expect(result.current.currentContent?.id).toBe('transaction-debit-credit');

      act(() => {
        result.current.showContent('account-type');
      });

      expect(result.current.currentContent?.id).toBe('account-type');
    });
  });

  describe('clearHelp', () => {
    it('should clear all help state', () => {
      const { result } = renderHook(() => useHelp());

      // Set up some state
      act(() => {
        result.current.loadContextualHelp({ page: 'transactions' });
        result.current.showDefinition('assets');
      });

      expect(result.current.contextualHelp).not.toBeNull();
      expect(result.current.currentDefinition).not.toBeNull();

      // Clear everything
      act(() => {
        result.current.clearHelp();
      });

      expect(result.current.contextualHelp).toBeNull();
      expect(result.current.currentDefinition).toBeNull();
      expect(result.current.currentContent).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('should be safe to call multiple times', () => {
      const { result } = renderHook(() => useHelp());

      act(() => {
        result.current.clearHelp();
        result.current.clearHelp();
        result.current.clearHelp();
      });

      expect(result.current.contextualHelp).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should clear previous errors when loading new content', () => {
      const { result } = renderHook(() => useHelp());

      // Trigger an error
      act(() => {
        result.current.showDefinition('nonexistent');
      });

      expect(result.current.error).not.toBeNull();

      // Load valid content
      act(() => {
        result.current.showDefinition('assets');
      });

      expect(result.current.error).toBeNull();
      expect(result.current.currentDefinition).not.toBeNull();
    });

    it('should clear errors when loading contextual help', () => {
      const { result } = renderHook(() => useHelp());

      // Trigger an error
      act(() => {
        result.current.showContent('nonexistent');
      });

      expect(result.current.error).not.toBeNull();

      // Load contextual help
      act(() => {
        result.current.loadContextualHelp({ page: 'transactions' });
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('autoLoad option', () => {
    it('should auto-load contextual help when autoLoad is true', () => {
      const context: HelpContext = {
        page: 'transactions',
        section: 'transaction',
        field: 'debit-credit',
      };

      const { result } = renderHook(() => useHelp({ context, autoLoad: true }));

      expect(result.current.contextualHelp).not.toBeNull();
    });

    it('should not auto-load when autoLoad is false', () => {
      const context: HelpContext = {
        page: 'transactions',
      };

      const { result } = renderHook(() => useHelp({ context, autoLoad: false }));

      expect(result.current.contextualHelp).toBeNull();
    });

    it('should not auto-load by default', () => {
      const context: HelpContext = {
        page: 'transactions',
      };

      const { result } = renderHook(() => useHelp({ context }));

      expect(result.current.contextualHelp).toBeNull();
    });
  });

  describe('integration scenarios', () => {
    it('should support workflow: load context -> show definition -> clear', () => {
      const { result } = renderHook(() => useHelp());

      // Load contextual help
      act(() => {
        result.current.loadContextualHelp({ page: 'transactions' });
      });
      expect(result.current.contextualHelp).not.toBeNull();

      // Show a definition
      act(() => {
        result.current.showDefinition('double-entry');
      });
      expect(result.current.currentDefinition).not.toBeNull();

      // Clear all
      act(() => {
        result.current.clearHelp();
      });
      expect(result.current.contextualHelp).toBeNull();
      expect(result.current.currentDefinition).toBeNull();
    });

    it('should support switching between definitions', () => {
      const { result } = renderHook(() => useHelp());

      const terms = ['assets', 'liabilities', 'equity', 'revenue'];

      terms.forEach((term: any) => {
        act(() => {
          result.current.showDefinition(term);
        });
        expect(result.current.currentDefinition).not.toBeNull();
        expect(result.current.error).toBeNull();
      });
    });

    it('should support switching between content items', () => {
      const { result } = renderHook(() => useHelp());

      const contentIds = ['transaction-debit-credit', 'account-type', 'accounting-method'];

      contentIds.forEach((id: any) => {
        act(() => {
          result.current.showContent(id);
        });
        expect(result.current.currentContent).not.toBeNull();
        expect(result.current.error).toBeNull();
      });
    });
  });
});
