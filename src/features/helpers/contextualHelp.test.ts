/**
 * Tests for contextual help logic
 */

import { describe, it, expect } from 'vitest';
import {
  getContextualHelp,
  shouldShowBeginnerHelp,
  getTermHelp,
  getSuggestedTopics,
  hasHelpForContext,
  type HelpContext,
} from './contextualHelp';

describe('contextualHelp', () => {
  describe('getContextualHelp', () => {
    it('should return help for transaction page', () => {
      const context: HelpContext = {
        page: 'transactions',
        section: 'transaction',
      };
      const help = getContextualHelp(context);
      expect(help).toBeDefined();
      expect(help.relatedDefinitions).toBeDefined();
      expect(help.relatedDefinitions?.length).toBeGreaterThan(0);
    });

    it('should return help for accounts page', () => {
      const context: HelpContext = {
        page: 'accounts',
      };
      const help = getContextualHelp(context);
      expect(help.relatedDefinitions).toBeDefined();
      expect(help.relatedDefinitions?.some(d => d.term.includes('Account'))).toBe(true);
    });

    it('should return help for balance sheet', () => {
      const context: HelpContext = {
        page: 'balance-sheet',
      };
      const help = getContextualHelp(context);
      expect(help.relatedDefinitions).toBeDefined();
      expect(help.relatedDefinitions?.some(d => d.term.includes('Balance Sheet'))).toBe(true);
    });

    it('should return help for profit & loss', () => {
      const context: HelpContext = {
        page: 'profit-loss',
      };
      const help = getContextualHelp(context);
      expect(help.relatedDefinitions).toBeDefined();
      expect(help.relatedDefinitions?.some(d => d.term.includes('Profit'))).toBe(true);
    });

    it('should return help for cash flow', () => {
      const context: HelpContext = {
        page: 'cash-flow',
      };
      const help = getContextualHelp(context);
      expect(help.relatedDefinitions).toBeDefined();
      expect(help.relatedDefinitions?.some(d => d.term.includes('Cash'))).toBe(true);
    });

    it('should return quick tip for specific field', () => {
      const context: HelpContext = {
        page: 'transactions',
        section: 'transaction',
        field: 'debit-credit',
      };
      const help = getContextualHelp(context);
      expect(help.quickTip).toBeDefined();
      expect(help.quickTip?.id).toBe('transaction-debit-credit');
    });

    it('should return additional resources for section', () => {
      const context: HelpContext = {
        page: 'transactions',
        section: 'transaction',
      };
      const help = getContextualHelp(context);
      expect(help.additionalResources).toBeDefined();
      expect(Array.isArray(help.additionalResources)).toBe(true);
    });

    it('should handle empty context gracefully', () => {
      const context: HelpContext = {};
      const help = getContextualHelp(context);
      expect(help).toBeDefined();
      expect(help.relatedDefinitions).toEqual([]);
    });

    it('should include related definitions for reports page', () => {
      const context: HelpContext = {
        page: 'reports',
      };
      const help = getContextualHelp(context);
      expect(help.relatedDefinitions).toBeDefined();
      expect(help.relatedDefinitions?.length).toBeGreaterThan(0);
    });
  });

  describe('shouldShowBeginnerHelp', () => {
    it('should show beginner help by default', () => {
      const context: HelpContext = {};
      expect(shouldShowBeginnerHelp(context)).toBe(true);
    });

    it('should show beginner help when explicitly set', () => {
      const context: HelpContext = {
        userLevel: 'beginner',
      };
      expect(shouldShowBeginnerHelp(context)).toBe(true);
    });

    it('should not show beginner help for intermediate users', () => {
      const context: HelpContext = {
        userLevel: 'intermediate',
      };
      expect(shouldShowBeginnerHelp(context)).toBe(false);
    });

    it('should not show beginner help for advanced users', () => {
      const context: HelpContext = {
        userLevel: 'advanced',
      };
      expect(shouldShowBeginnerHelp(context)).toBe(false);
    });
  });

  describe('getTermHelp', () => {
    it('should return definition for valid term', () => {
      const help = getTermHelp('double-entry');
      expect(help).toBeDefined();
      expect(help?.term).toBe('Double-Entry Bookkeeping');
    });

    it('should return undefined for invalid term', () => {
      const help = getTermHelp('nonexistent-term');
      expect(help).toBeUndefined();
    });

    it('should return complete definition', () => {
      const help = getTermHelp('assets');
      expect(help).toBeDefined();
      expect(help?.shortDescription).toBeTruthy();
      expect(help?.longDescription).toBeTruthy();
      expect(help?.whyItMatters).toBeTruthy();
    });
  });

  describe('getSuggestedTopics', () => {
    it('should return beginner topics by default', () => {
      const topics = getSuggestedTopics();
      expect(topics.length).toBeGreaterThan(0);
      expect(topics.some(t => t.term.includes('Double-Entry'))).toBe(true);
    });

    it('should return beginner topics for beginners', () => {
      const topics = getSuggestedTopics('beginner');
      expect(topics.length).toBeGreaterThan(0);
      expect(topics.some(t => t.term.includes('Debit'))).toBe(true);
    });

    it('should return more topics for intermediate users', () => {
      const beginnerTopics = getSuggestedTopics('beginner');
      const intermediateTopics = getSuggestedTopics('intermediate');
      expect(intermediateTopics.length).toBeGreaterThan(beginnerTopics.length);
    });

    it('should return all topics for advanced users', () => {
      const intermediateTopics = getSuggestedTopics('intermediate');
      const advancedTopics = getSuggestedTopics('advanced');
      expect(advancedTopics.length).toBeGreaterThanOrEqual(intermediateTopics.length);
    });

    it('should include foundational topics for all levels', () => {
      const beginner = getSuggestedTopics('beginner');
      const intermediate = getSuggestedTopics('intermediate');
      const advanced = getSuggestedTopics('advanced');

      [beginner, intermediate, advanced].forEach(topics => {
        expect(topics.some(t => t.term.includes('Double-Entry'))).toBe(true);
      });
    });

    it('should return valid definitions', () => {
      const topics = getSuggestedTopics('intermediate');
      topics.forEach(topic => {
        expect(topic.term).toBeTruthy();
        expect(topic.shortDescription).toBeTruthy();
        expect(topic.longDescription).toBeTruthy();
      });
    });
  });

  describe('hasHelpForContext', () => {
    it('should return true for context with help', () => {
      const context: HelpContext = {
        section: 'transaction',
        field: 'debit-credit',
      };
      expect(hasHelpForContext(context)).toBe(true);
    });

    it('should return false for context without help', () => {
      const context: HelpContext = {
        section: 'nonexistent',
        field: 'nonexistent',
      };
      expect(hasHelpForContext(context)).toBe(false);
    });

    it('should return false for empty context', () => {
      const context: HelpContext = {};
      expect(hasHelpForContext(context)).toBe(false);
    });

    it('should work with section only', () => {
      const context: HelpContext = {
        section: 'account',
        field: 'type',
      };
      const hasHelp = hasHelpForContext(context);
      expect(typeof hasHelp).toBe('boolean');
    });
  });

  describe('contextual help mapping', () => {
    it('should provide relevant help for transaction contexts', () => {
      const context: HelpContext = {
        page: 'transactions',
      };
      const help = getContextualHelp(context);
      expect(help.relatedDefinitions?.some(d =>
        d.term.includes('Double-Entry') || d.term.includes('Debit')
      )).toBe(true);
    });

    it('should provide relevant help for report contexts', () => {
      const balanceSheet: HelpContext = { page: 'balance-sheet' };
      const profitLoss: HelpContext = { page: 'profit-loss' };

      const bsHelp = getContextualHelp(balanceSheet);
      const plHelp = getContextualHelp(profitLoss);

      expect(bsHelp.relatedDefinitions?.some(d => d.term.includes('Balance'))).toBe(true);
      expect(plHelp.relatedDefinitions?.some(d => d.term.includes('Profit'))).toBe(true);
    });

    it('should provide settings help', () => {
      const context: HelpContext = {
        page: 'settings',
      };
      const help = getContextualHelp(context);
      expect(help.relatedDefinitions).toBeDefined();
    });
  });
});
