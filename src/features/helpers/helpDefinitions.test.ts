/**
 * Tests for help definitions
 */

import { describe, it, expect } from 'vitest';
import {
  helpDefinitions,
  getAllHelpTerms,
  searchHelpDefinitions,
  getHelpDefinition,
} from './helpDefinitions';

describe('helpDefinitions', () => {
  describe('helpDefinitions data structure', () => {
    it('should contain all 12 required terms', () => {
      const requiredTerms = [
        'double-entry',
        'debit-credit',
        'chart-of-accounts',
        'assets',
        'liabilities',
        'equity',
        'revenue',
        'expenses',
        'balance-sheet',
        'profit-loss',
        'cash-flow',
        'accrual-vs-cash',
      ];

      requiredTerms.forEach((termId: any) => {
        expect(helpDefinitions[termId]).toBeDefined();
        expect(helpDefinitions[termId]!.term).toBeTruthy();
      });
    });

    it('should have all required fields for each definition', () => {
      Object.values(helpDefinitions).forEach((def: any) => {
        expect(def.term).toBeTruthy();
        expect(def.shortDescription).toBeTruthy();
        expect(def.longDescription).toBeTruthy();
        expect(def.whyItMatters).toBeTruthy();
        expect(typeof def.term).toBe('string');
        expect(typeof def.shortDescription).toBe('string');
        expect(typeof def.longDescription).toBe('string');
        expect(typeof def.whyItMatters).toBe('string');
      });
    });

    it('should have plain English, conversational descriptions', () => {
      const doubleEntry = helpDefinitions['double-entry'];
      expect(doubleEntry!.shortDescription).toContain('two sides');
      expect(doubleEntry!.longDescription.toLowerCase()).toContain('seesaw');
    });

    it('should include examples for most terms', () => {
      const termsWithExamples = Object.values(helpDefinitions).filter(
        def => def.example
      );
      expect(termsWithExamples.length).toBeGreaterThan(8);
    });

    it('should include common misconceptions for key terms', () => {
      expect(helpDefinitions['debit-credit']!.commonMisconception).toBeTruthy();
      expect(helpDefinitions['double-entry']!.commonMisconception).toBeTruthy();
    });

    it('should have related terms for interconnected concepts', () => {
      const balanceSheet = helpDefinitions['balance-sheet'];
      expect(balanceSheet!.relatedTerms).toBeDefined();
      expect(balanceSheet!.relatedTerms).toContain('assets');
      expect(balanceSheet!.relatedTerms).toContain('liabilities');
      expect(balanceSheet!.relatedTerms).toContain('equity');
    });
  });

  describe('getAllHelpTerms', () => {
    it('should return all term IDs', () => {
      const terms = getAllHelpTerms();
      expect(terms).toBeInstanceOf(Array);
      expect(terms.length).toBeGreaterThanOrEqual(12);
      expect(terms).toContain('double-entry');
      expect(terms).toContain('debit-credit');
    });

    it('should return unique term IDs', () => {
      const terms = getAllHelpTerms();
      const uniqueTerms = new Set(terms);
      expect(uniqueTerms.size).toBe(terms.length);
    });
  });

  describe('searchHelpDefinitions', () => {
    it('should find definitions by term name', () => {
      const results = searchHelpDefinitions('balance');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r: any) => r.term.toLowerCase().includes('balance'))).toBe(true);
    });

    it('should find definitions by short description', () => {
      const results = searchHelpDefinitions('money coming in');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r: any) => r.shortDescription.toLowerCase().includes('money coming in'))).toBe(true);
    });

    it('should find definitions by long description content', () => {
      const results = searchHelpDefinitions('seesaw');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r: any) => r.longDescription.toLowerCase().includes('seesaw'))).toBe(true);
    });

    it('should be case-insensitive', () => {
      const lower = searchHelpDefinitions('asset');
      const upper = searchHelpDefinitions('ASSET');
      const mixed = searchHelpDefinitions('AsSEt');
      expect(lower.length).toBe(upper.length);
      expect(lower.length).toBe(mixed.length);
    });

    it('should return empty array for no matches', () => {
      const results = searchHelpDefinitions('xyznonexistent');
      expect(results).toEqual([]);
    });

    it('should return multiple results when applicable', () => {
      const results = searchHelpDefinitions('money');
      expect(results.length).toBeGreaterThan(1);
    });

    it('should handle empty search query', () => {
      const results = searchHelpDefinitions('');
      expect(results).toBeInstanceOf(Array);
      // Should match all (empty string is in all strings)
      expect(results.length).toBe(Object.keys(helpDefinitions).length);
    });
  });

  describe('getHelpDefinition', () => {
    it('should return definition for valid term ID', () => {
      const def = getHelpDefinition('double-entry');
      expect(def).toBeDefined();
      expect(def?.term).toBe('Double-Entry Bookkeeping');
    });

    it('should return undefined for invalid term ID', () => {
      const def = getHelpDefinition('nonexistent-term');
      expect(def).toBeUndefined();
    });

    it('should return complete definition object', () => {
      const def = getHelpDefinition('assets');
      expect(def).toBeDefined();
      expect(def?.term).toBeTruthy();
      expect(def?.shortDescription).toBeTruthy();
      expect(def?.longDescription).toBeTruthy();
      expect(def?.whyItMatters).toBeTruthy();
    });
  });

  describe('content quality', () => {
    it('should use judgment-free language', () => {
      Object.values(helpDefinitions).forEach((def: any) => {
        const fullText = `${def.term} ${def.shortDescription} ${def.longDescription}`.toLowerCase();
        // Should avoid judgmental terms
        expect(fullText).not.toContain('stupid');
        expect(fullText).not.toContain('dumb');
        expect(fullText).not.toContain('wrong way');
      });
    });

    it('should use conversational tone', () => {
      const debitCredit = helpDefinitions['debit-credit'];
      expect(debitCredit!.longDescription).toContain('you');
      expect(debitCredit!.longDescription).toContain('don\'t');
    });

    it('should provide real-world examples', () => {
      const assets = helpDefinitions['assets'];
      expect(assets!.example).toBeTruthy();
      expect(assets!.example?.toLowerCase()).toMatch(/\$\d+/); // Contains dollar amounts
    });

    it('should explain why concepts matter', () => {
      Object.values(helpDefinitions).forEach((def: any) => {
        expect(def.whyItMatters.length).toBeGreaterThan(20);
        expect(def.whyItMatters).toMatch(/\w+/);
      });
    });
  });

  describe('educational approach', () => {
    it('should address common misconceptions', () => {
      const debitCredit = helpDefinitions['debit-credit'];
      expect(debitCredit!.commonMisconception).toBeTruthy();
      expect(debitCredit!.commonMisconception?.toLowerCase()).toContain('debit');
    });

    it('should link related concepts', () => {
      const doubleEntry = helpDefinitions['double-entry'];
      expect(doubleEntry!.relatedTerms).toBeDefined();
      expect(doubleEntry!.relatedTerms?.length).toBeGreaterThan(0);
    });

    it('should use analogies and metaphors', () => {
      const doubleEntry = helpDefinitions['double-entry'];
      expect(doubleEntry!.longDescription.toLowerCase()).toContain('seesaw');
    });
  });
});
