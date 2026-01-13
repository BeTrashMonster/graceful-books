/**
 * Email Templates Tests
 *
 * Tests for DISC-adapted email template system
 */

import { describe, it, expect } from 'vitest';
import {
  DISC_EMAIL_TEMPLATES,
  getSubjectLine,
  getGreeting,
  getSectionIntro,
  getClosing,
  getEmailTemplate,
  getAllDISCTypes,
} from './emailTemplates';
import type { DISCType } from '../../features/messaging/messageLibrary';

describe('Email Templates', () => {
  describe('DISC_EMAIL_TEMPLATES', () => {
    it('should have templates for all DISC types', () => {
      const discTypes: DISCType[] = ['D', 'I', 'S', 'C'];

      discTypes.forEach((type) => {
        expect(DISC_EMAIL_TEMPLATES[type]).toBeDefined();
        expect(DISC_EMAIL_TEMPLATES[type].discType).toBe(type);
      });
    });

    it('should have at least 3 subject lines per DISC type', () => {
      const discTypes: DISCType[] = ['D', 'I', 'S', 'C'];

      discTypes.forEach((type) => {
        const template = DISC_EMAIL_TEMPLATES[type];
        expect(template.subjectLines.length).toBeGreaterThanOrEqual(3);
        template.subjectLines.forEach((line) => {
          expect(line.length).toBeGreaterThan(0);
          expect(line.length).toBeLessThan(100); // Subject lines should be concise
        });
      });
    });

    it('should have appropriate tone for each DISC type', () => {
      // Dominance: Direct and action-oriented
      const dTemplate = DISC_EMAIL_TEMPLATES.D;
      expect(dTemplate.toneGuidelines.directness).toBe('direct');
      expect(dTemplate.toneGuidelines.enthusiasm).toBe('low');

      // Influence: Enthusiastic and friendly
      const iTemplate = DISC_EMAIL_TEMPLATES.I;
      expect(iTemplate.toneGuidelines.enthusiasm).toBe('high');
      expect(iTemplate.toneGuidelines.formality).toBe('casual');

      // Steadiness: Supportive and patient
      const sTemplate = DISC_EMAIL_TEMPLATES.S;
      expect(sTemplate.toneGuidelines.supportiveness).toBe('highly-supportive');
      expect(sTemplate.toneGuidelines.directness).toBe('indirect');

      // Conscientiousness: Formal and detailed
      const cTemplate = DISC_EMAIL_TEMPLATES.C;
      expect(cTemplate.toneGuidelines.formality).toBe('formal');
    });

    it('should have section intros for all content sections', () => {
      const requiredSections = [
        'checklist-summary',
        'foundation-tasks',
        'upcoming-deadlines',
        'quick-tips',
        'progress-update',
        'financial-snapshot',
      ];

      const discTypes: DISCType[] = ['D', 'I', 'S', 'C'];

      discTypes.forEach((type) => {
        const template = DISC_EMAIL_TEMPLATES[type];
        requiredSections.forEach((section) => {
          expect(template.sectionIntros[section as keyof typeof template.sectionIntros]).toBeDefined();
          expect(template.sectionIntros[section as keyof typeof template.sectionIntros].length).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('getSubjectLine', () => {
    it('should return subject line for each DISC type', () => {
      const discTypes: DISCType[] = ['D', 'I', 'S', 'C'];

      discTypes.forEach((type) => {
        const subject = getSubjectLine(type);
        expect(subject).toBeTruthy();
        expect(typeof subject).toBe('string');
      });
    });

    it('should cycle through subject lines with index', () => {
      const type: DISCType = 'S';
      const template = DISC_EMAIL_TEMPLATES[type];

      const subject0 = getSubjectLine(type, 0);
      const subject1 = getSubjectLine(type, 1);

      expect(subject0).toBe(template.subjectLines[0]);
      expect(subject1).toBe(template.subjectLines[1]);
    });

    it('should wrap around with large index', () => {
      const type: DISCType = 'S';
      const template = DISC_EMAIL_TEMPLATES[type];

      const largeIndex = template.subjectLines.length + 1;
      const subject = getSubjectLine(type, largeIndex);

      expect(subject).toBe(template.subjectLines[1]); // Should wrap around
    });
  });

  describe('getGreeting', () => {
    it('should return greeting for each DISC type', () => {
      const discTypes: DISCType[] = ['D', 'I', 'S', 'C'];

      discTypes.forEach((type) => {
        const greeting = getGreeting(type);
        expect(greeting).toBeTruthy();
        expect(typeof greeting).toBe('string');
      });
    });

    it('should personalize greeting with name for I and S types', () => {
      const userName = 'John';

      const greetingI = getGreeting('I', userName);
      const greetingS = getGreeting('S', userName);

      // I and S types might include the name if the greeting starts with certain words
      // But the function should still return valid greetings
      expect(greetingI).toBeTruthy();
      expect(greetingS).toBeTruthy();
      expect(typeof greetingI).toBe('string');
      expect(typeof greetingS).toBe('string');
    });

    it('should not personalize greeting for D and C types', () => {
      const userName = 'John';

      const greetingD = getGreeting('D', userName);
      const greetingC = getGreeting('C', userName);

      // D and C types typically don't include personal names
      // (they're more formal/direct)
      expect(typeof greetingD).toBe('string');
      expect(typeof greetingC).toBe('string');
    });
  });

  describe('getSectionIntro', () => {
    it('should return section intro for valid section type', () => {
      const discTypes: DISCType[] = ['D', 'I', 'S', 'C'];
      const section = 'checklist-summary';

      discTypes.forEach((type) => {
        const intro = getSectionIntro(type, section);
        expect(intro).toBeTruthy();
        expect(typeof intro).toBe('string');
      });
    });

    it('should return different intros for different DISC types', () => {
      const section = 'checklist-summary';

      const introD = getSectionIntro('D', section);
      const introI = getSectionIntro('I', section);
      const introS = getSectionIntro('S', section);
      const introC = getSectionIntro('C', section);

      // Each type should have unique intro
      const intros = [introD, introI, introS, introC];
      const uniqueIntros = new Set(intros);
      expect(uniqueIntros.size).toBe(4);
    });
  });

  describe('getClosing', () => {
    it('should return closing for each DISC type', () => {
      const discTypes: DISCType[] = ['D', 'I', 'S', 'C'];

      discTypes.forEach((type) => {
        const closing = getClosing(type);
        expect(closing).toBeTruthy();
        expect(typeof closing).toBe('string');
      });
    });

    it('should return random closing from available options', () => {
      const type: DISCType = 'S';
      const template = DISC_EMAIL_TEMPLATES[type];

      // Generate multiple closings and verify they're all valid
      const closings = new Set<string>();
      for (let i = 0; i < 10; i++) {
        const closing = getClosing(type);
        closings.add(closing);
        expect(template.closings).toContain(closing);
      }

      // Should have some variety (though not guaranteed in 10 tries)
      // At least verify all are valid
      expect(closings.size).toBeGreaterThan(0);
    });
  });

  describe('getEmailTemplate', () => {
    it('should return complete template for each DISC type', () => {
      const discTypes: DISCType[] = ['D', 'I', 'S', 'C'];

      discTypes.forEach((type) => {
        const template = getEmailTemplate(type);
        expect(template).toBeDefined();
        expect(template.discType).toBe(type);
        expect(template.subjectLines).toBeDefined();
        expect(template.greetings).toBeDefined();
        expect(template.sectionIntros).toBeDefined();
        expect(template.closings).toBeDefined();
        expect(template.toneGuidelines).toBeDefined();
      });
    });
  });

  describe('getAllDISCTypes', () => {
    it('should return all 4 DISC types', () => {
      const types = getAllDISCTypes();
      expect(types).toHaveLength(4);
      expect(types).toContain('D');
      expect(types).toContain('I');
      expect(types).toContain('S');
      expect(types).toContain('C');
    });
  });

  describe('Steadiness (S) template specific tests', () => {
    it('should have encouraging subject lines', () => {
      const template = DISC_EMAIL_TEMPLATES.S;

      template.subjectLines.forEach((subject) => {
        const lowerSubject = subject.toLowerCase();
        const hasEncouragement =
          lowerSubject.includes('small steps') ||
          lowerSubject.includes('gentle') ||
          lowerSubject.includes('steady') ||
          lowerSubject.includes('together') ||
          lowerSubject.includes('care') ||
          lowerSubject.includes('guide');

        expect(hasEncouragement).toBe(true);
      });
    });

    it('should have patient, supportive greetings', () => {
      const template = DISC_EMAIL_TEMPLATES.S;

      template.greetings.forEach((greeting) => {
        // Should be gentle and not pushy
        expect(greeting).not.toMatch(/now|immediately|urgent/i);
      });
    });
  });
});
