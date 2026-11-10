/**
 * TESTING GATE 6.1: NIST AI RMF Compliance
 *
 * ALL VERIFICATIONS MUST PASS TO PROCEED TO SECTION 6.2
 *
 * Verifies that the NIST AI RMF Implementation document
 * contains all required sections and content.
 *
 * @security Phase 6.1 - NIST AI RMF Implementation
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('GATE 6.1: NIST AI RMF Implementation', () => {
  const nistDocPath = path.resolve(__dirname, '../NIST_AI_RMF_IMPLEMENTATION.md');
  let content: string;

  beforeAll(() => {
    content = fs.readFileSync(nistDocPath, 'utf-8');
  });

  // ============================================================================
  // 6.1.T.1: MAP Function Documentation
  // ============================================================================

  describe('6.1.T.1: MAP Function Documentation', () => {
    it('documents AI System Inventory', () => {
      expect(content).toContain('AI System Inventory');
      expect(content).toMatch(/Transaction Categorizer/i);
    });

    it('lists all AI systems with purpose', () => {
      expect(content).toContain('Anomaly Detector');
      expect(content).toContain('Forecaster');
    });

    it('documents Stakeholder Identification', () => {
      expect(content).toContain('Stakeholder Identification');
      expect(content).toContain('End User');
    });

    it('documents Context Mapping', () => {
      expect(content).toContain('Context Mapping');
      expect(content).toContain('Business Context');
      expect(content).toContain('Technical Context');
    });

    it('includes risk levels for all AI systems', () => {
      expect(content).toMatch(/Risk Level/i);
      expect(content).toMatch(/(Low|Medium|High)/);
    });

    it('identifies data types processed', () => {
      expect(content).toContain('Data Types');
      expect(content).toMatch(/Financial/i);
    });
  });

  // ============================================================================
  // 6.1.T.2: MEASURE Function Documentation
  // ============================================================================

  describe('6.1.T.2: MEASURE Function Documentation', () => {
    it('defines risk metrics', () => {
      expect(content).toContain('Risk Metrics');
      expect(content).toContain('Metric');
    });

    it('defines accuracy metrics with targets', () => {
      expect(content).toMatch(/accuracy/i);
      expect(content).toMatch(/\d+%/); // Target percentage
      expect(content).toMatch(/>90%/); // Specific accuracy target
    });

    it('defines measurement schedule', () => {
      expect(content).toContain('Measurement Schedule');
      expect(content).toMatch(/(Daily|Weekly|Monthly|Quarterly)/i);
    });

    it('includes measurement methods', () => {
      expect(content).toContain('Measurement Methods');
      expect(content).toMatch(/Automated/i);
    });

    it('documents baseline establishment', () => {
      expect(content).toMatch(/baseline/i);
    });
  });

  // ============================================================================
  // 6.1.T.3: MANAGE Function Documentation
  // ============================================================================

  describe('6.1.T.3: MANAGE Function Documentation', () => {
    it('documents risk treatments', () => {
      expect(content).toContain('Risk Treatments');
      expect(content).toContain('Treatment');
    });

    it('documents treatment for prompt injection', () => {
      expect(content).toMatch(/Prompt injection/i);
      expect(content).toMatch(/sanitization/i);
    });

    it('documents treatment for AI hallucination', () => {
      expect(content).toMatch(/hallucination/i);
      expect(content).toMatch(/Proof gate/i);
    });

    it('documents treatment for privacy leaks', () => {
      expect(content).toMatch(/Privacy/i);
      expect(content).toMatch(/CaMeL/i);
    });

    it('documents residual risk acceptance', () => {
      expect(content).toContain('Residual Risk');
      expect(content).toContain('Accepted By');
    });

    it('documents control implementation status', () => {
      expect(content).toContain('Implementation Status');
      expect(content).toMatch(/Implemented|Passed/i);
    });
  });

  // ============================================================================
  // 6.1.T.4: GOVERN Function Documentation
  // ============================================================================

  describe('6.1.T.4: GOVERN Function Documentation', () => {
    it('documents governance structure', () => {
      expect(content).toContain('Governance Structure');
    });

    it('documents roles and responsibilities', () => {
      expect(content).toContain('Roles and Responsibilities');
      expect(content).toContain('AI Safety Lead');
      expect(content).toContain('Security Lead');
    });

    it('documents escalation path', () => {
      expect(content).toMatch(/Escalation/i);
      expect(content).toMatch(/Level/i);
    });

    it('documents policy documents', () => {
      expect(content).toContain('Policy Documents');
    });

    it('documents review cadence', () => {
      expect(content).toContain('Review Cadence');
      expect(content).toMatch(/(Weekly|Monthly|Quarterly|Annually)/i);
    });

    it('documents decision authority', () => {
      expect(content).toMatch(/Authority/i);
      expect(content).toMatch(/Approval/i);
    });
  });

  // ============================================================================
  // 6.1.T.5: Implementation Status
  // ============================================================================

  describe('6.1.T.5: Implementation Status', () => {
    it('all four NIST functions are documented', () => {
      expect(content).toContain('MAP Function');
      expect(content).toContain('MEASURE Function');
      expect(content).toContain('MANAGE Function');
      expect(content).toContain('GOVERN Function');
    });

    it('document is complete and formatted', () => {
      expect(content.length).toBeGreaterThan(5000); // Substantial content
      expect(content).toContain('# NIST AI RMF Implementation');
      expect(content).toContain('## 1. MAP Function');
      expect(content).toContain('## 2. MEASURE Function');
      expect(content).toContain('## 3. MANAGE Function');
      expect(content).toContain('## 4. GOVERN Function');
    });

    it('includes version history', () => {
      expect(content).toContain('Version History');
    });

    it('references related documents', () => {
      expect(content).toMatch(/Related Documents|Appendix/i);
    });
  });
});
