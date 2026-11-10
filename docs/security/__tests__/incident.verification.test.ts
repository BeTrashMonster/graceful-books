/**
 * TESTING GATE 6.2: Incident Response Playbook
 *
 * ALL VERIFICATIONS MUST PASS TO PROCEED TO SECTION 6.3
 *
 * Verifies that the AI Incident Response Playbook contains
 * all required sections for effective incident handling.
 *
 * @security Phase 6.2 - Incident Response Playbook
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('GATE 6.2: Incident Response Playbook', () => {
  const playbookPath = path.resolve(__dirname, '../AI_INCIDENT_RESPONSE.md');
  let content: string;

  beforeAll(() => {
    content = fs.readFileSync(playbookPath, 'utf-8');
  });

  // ============================================================================
  // 6.2.T.1: Incident Classification
  // ============================================================================

  describe('6.2.T.1: Incident Classification', () => {
    it('defines severity levels', () => {
      expect(content).toContain('Severity Levels');
      expect(content).toContain('SEV1');
      expect(content).toContain('SEV2');
      expect(content).toContain('SEV3');
      expect(content).toContain('SEV4');
    });

    it('defines response times for each severity', () => {
      expect(content).toMatch(/SEV1.*15 minutes/i);
      expect(content).toMatch(/SEV2.*1 hour/i);
      expect(content).toMatch(/SEV3.*4 hours/i);
      expect(content).toMatch(/SEV4.*24 hours/i);
    });

    it('defines escalation for each severity', () => {
      expect(content).toContain('Escalation');
      expect(content).toMatch(/Immediate/i);
    });

    it('includes severity determination matrix', () => {
      expect(content).toMatch(/Severity Determination|Impact.*Urgency/i);
    });
  });

  // ============================================================================
  // 6.2.T.2: Incident Type Coverage
  // ============================================================================

  describe('6.2.T.2: Incident Type Coverage', () => {
    it('covers AI Unauthorized Action', () => {
      expect(content).toMatch(/Unauthorized Action/i);
    });

    it('covers Prompt Injection Detected', () => {
      expect(content).toMatch(/Prompt Injection/i);
    });

    it('covers AI Accuracy Degradation', () => {
      expect(content).toMatch(/Accuracy Degradation/i);
    });

    it('each incident type has indicators', () => {
      expect(content).toContain('Indicators');
      // Multiple indicator sections
      const indicatorCount = (content.match(/\*\*Indicators:\*\*/g) || []).length;
      expect(indicatorCount).toBeGreaterThanOrEqual(3);
    });
  });

  // ============================================================================
  // 6.2.T.3: Response Procedures
  // ============================================================================

  describe('6.2.T.3: Response Procedures', () => {
    it('includes immediate actions for SEV1', () => {
      expect(content).toMatch(/Immediate Actions.*15 minutes/is);
    });

    it('includes kill switch activation', () => {
      expect(content).toMatch(/kill.?switch/i);
      expect(content).toMatch(/killSwitch\.disable/i);
    });

    it('includes investigation steps', () => {
      expect(content).toContain('Investigation');
      const investigationCount = (content.match(/\*\*Investigation/g) || []).length;
      expect(investigationCount).toBeGreaterThanOrEqual(3);
    });

    it('includes remediation steps', () => {
      expect(content).toContain('Remediation');
      const remediationCount = (content.match(/\*\*Remediation/g) || []).length;
      expect(remediationCount).toBeGreaterThanOrEqual(3);
    });

    it('includes post-incident steps', () => {
      expect(content).toMatch(/Post.?Incident/i);
    });

    it('includes state preservation guidance', () => {
      expect(content).toMatch(/Preserve State/i);
      expect(content).toMatch(/Export audit logs/i);
    });
  });

  // ============================================================================
  // 6.2.T.4: Communication Templates
  // ============================================================================

  describe('6.2.T.4: Communication Templates', () => {
    it('includes user notification template', () => {
      expect(content).toMatch(/User Notification/i);
    });

    it('includes internal escalation template', () => {
      expect(content).toMatch(/Internal Escalation/i);
    });

    it('user notification includes key elements', () => {
      expect(content).toContain('What happened');
      expect(content).toContain('What we did');
      expect(content).toContain('What you should do');
    });

    it('includes incident report template', () => {
      expect(content).toMatch(/Incident Report Template/i);
    });
  });

  // ============================================================================
  // 6.2.T.5: Contact Information
  // ============================================================================

  describe('6.2.T.5: Contact Information', () => {
    it('includes contacts section', () => {
      expect(content).toContain('Contacts');
    });

    it('defines AI Safety Lead role', () => {
      expect(content).toMatch(/AI Safety Lead/i);
    });

    it('defines Security Lead role', () => {
      expect(content).toMatch(/Security Lead/i);
    });

    it('defines On-Call Engineer role', () => {
      expect(content).toMatch(/On.?Call/i);
    });

    it('includes escalation phone tree', () => {
      expect(content).toMatch(/Phone Tree/i);
    });
  });

  // ============================================================================
  // 6.2.T.6: Tabletop Exercise Readiness
  // ============================================================================

  describe('6.2.T.6: Tabletop Exercise Readiness', () => {
    it('playbook is comprehensive enough for tabletop', () => {
      // Check for all required sections
      const requiredSections = [
        'Incident Classification',
        'Immediate Actions',
        'Investigation',
        'Remediation',
        'Communication',
        'Contacts',
      ];

      for (const section of requiredSections) {
        expect(content.toLowerCase()).toContain(section.toLowerCase());
      }
    });

    it('includes tabletop exercise schedule', () => {
      expect(content).toMatch(/Tabletop Exercise/i);
      expect(content).toMatch(/Quarterly|Q[1-4]/i);
    });

    it('includes quick reference card', () => {
      expect(content).toMatch(/Quick Reference/i);
    });

    it('includes emergency procedures', () => {
      expect(content).toMatch(/Emergency Procedures/i);
    });

    it('document is substantial', () => {
      expect(content.length).toBeGreaterThan(8000); // Comprehensive playbook
    });
  });

  // ============================================================================
  // 6.2.T.7: Kill Switch Procedures
  // ============================================================================

  describe('6.2.T.7: Kill Switch Procedures', () => {
    it('documents when to activate kill switch', () => {
      expect(content).toMatch(/When to Activate/i);
    });

    it('documents how to activate via multiple methods', () => {
      expect(content).toMatch(/Via Dashboard/i);
      expect(content).toMatch(/Via Code/i);
    });

    it('documents re-enablement procedures', () => {
      expect(content).toMatch(/Re.?enablement/i);
      expect(content).toMatch(/Prerequisites/i);
    });
  });
});
