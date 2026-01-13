/**
 * Tests for help content
 */

import { describe, it, expect } from 'vitest';
import {
  helpContent,
  getHelpContent,
  getHelpContentByArea,
  searchHelpContent,
} from './helpContent';

describe('helpContent', () => {
  describe('helpContent data structure', () => {
    it('should have help content for key areas', () => {
      const keyAreas = [
        'transaction-debit-credit',
        'account-type',
        'balance-sheet-date',
        'profit-loss-period',
        'accounting-method',
      ];

      keyAreas.forEach(id => {
        expect(helpContent[id]).toBeDefined();
      });
    });

    it('should have all required fields for each content item', () => {
      Object.values(helpContent).forEach(content => {
        expect(content.id).toBeTruthy();
        expect(content.title).toBeTruthy();
        expect(content.content).toBeTruthy();
        expect(typeof content.id).toBe('string');
        expect(typeof content.title).toBe('string');
        expect(typeof content.content).toBe('string');
      });
    });

    it('should have concise tooltip content', () => {
      Object.values(helpContent).forEach(content => {
        // Tooltips should be relatively short (under 300 chars ideally)
        expect(content.content.length).toBeLessThan(500);
      });
    });

    it('should link to detailed definitions where applicable', () => {
      const contentWithLinks = Object.values(helpContent).filter(
        c => c.learnMoreLink
      );
      expect(contentWithLinks.length).toBeGreaterThan(5);
    });
  });

  describe('getHelpContent', () => {
    it('should return content for valid ID', () => {
      const content = getHelpContent('transaction-debit-credit');
      expect(content).toBeDefined();
      expect(content?.title).toBe('Debit & Credit');
    });

    it('should return undefined for invalid ID', () => {
      const content = getHelpContent('nonexistent-content');
      expect(content).toBeUndefined();
    });

    it('should return complete content object', () => {
      const content = getHelpContent('account-type');
      expect(content).toBeDefined();
      expect(content?.id).toBeTruthy();
      expect(content?.title).toBeTruthy();
      expect(content?.content).toBeTruthy();
    });
  });

  describe('getHelpContentByArea', () => {
    it('should return all content for transaction area', () => {
      const content = getHelpContentByArea('transaction');
      expect(content.length).toBeGreaterThan(0);
      content.forEach(c => {
        expect(c.id.startsWith('transaction')).toBe(true);
      });
    });

    it('should return all content for account area', () => {
      const content = getHelpContentByArea('account');
      expect(content.length).toBeGreaterThan(0);
      content.forEach(c => {
        expect(c.id.startsWith('account')).toBe(true);
      });
    });

    it('should return empty array for non-existent area', () => {
      const content = getHelpContentByArea('nonexistent-area');
      expect(content).toEqual([]);
    });

    it('should return only matching area content', () => {
      const balanceSheetContent = getHelpContentByArea('balance-sheet');
      balanceSheetContent.forEach(c => {
        expect(c.id.startsWith('balance-sheet')).toBe(true);
      });
    });
  });

  describe('searchHelpContent', () => {
    it('should find content by title', () => {
      const results = searchHelpContent('debit');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.title.toLowerCase().includes('debit'))).toBe(true);
    });

    it('should find content by content text', () => {
      const results = searchHelpContent('seesaw');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.content.toLowerCase().includes('seesaw'))).toBe(true);
    });

    it('should be case-insensitive', () => {
      const lower = searchHelpContent('account');
      const upper = searchHelpContent('ACCOUNT');
      expect(lower.length).toBe(upper.length);
    });

    it('should return empty array for no matches', () => {
      const results = searchHelpContent('xyznonexistent');
      expect(results).toEqual([]);
    });

    it('should return multiple results when applicable', () => {
      const results = searchHelpContent('account');
      expect(results.length).toBeGreaterThan(1);
    });
  });

  describe('content organization', () => {
    it('should organize content by feature area', () => {
      const allIds = Object.keys(helpContent);
      const areas = new Set(allIds.map(id => id.split('-')[0]));
      expect(areas.size).toBeGreaterThan(3); // Multiple areas
    });

    it('should have transaction-related content', () => {
      const transactionContent = getHelpContentByArea('transaction');
      expect(transactionContent.length).toBeGreaterThan(0);
    });

    it('should have account-related content', () => {
      const accountContent = getHelpContentByArea('account');
      expect(accountContent.length).toBeGreaterThan(0);
    });

    it('should have report-related content', () => {
      const reportContent = [
        ...getHelpContentByArea('balance-sheet'),
        ...getHelpContentByArea('profit-loss'),
        ...getHelpContentByArea('cash-flow'),
      ];
      expect(reportContent.length).toBeGreaterThan(0);
    });
  });

  describe('content quality', () => {
    it('should use conversational, helpful tone', () => {
      const content = getHelpContent('transaction-description');
      expect(content).toBeDefined();
      expect(content?.content.toLowerCase()).toContain('you');
    });

    it('should provide actionable guidance', () => {
      Object.values(helpContent).forEach(content => {
        expect(content.content.length).toBeGreaterThan(10);
        // Should be informative and helpful (not just contain specific keywords)
        expect(content.content).toBeTruthy();
        expect(typeof content.content).toBe('string');
      });
    });

    it('should link to deeper learning where appropriate', () => {
      const doubleEntry = getHelpContent('double-entry-explained');
      expect(doubleEntry?.learnMoreLink).toBeTruthy();
    });

    it('should avoid jargon in tooltips', () => {
      Object.values(helpContent).forEach(content => {
        const text = content.content.toLowerCase();
        // Should minimize complex terminology without explanation
        if (text.includes('accrual') || text.includes('depreciation')) {
          expect(content.learnMoreLink).toBeTruthy();
        }
      });
    });
  });
});
