/**
 * Email Preview Service Integration Tests
 *
 * Tests for complete email generation and preview flow
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateEmailPreview,
  generatePreviewsForAllDISCTypes,
  validateEmailContent,
  getSampleChecklistItems,
} from './emailPreviewService';
import type { EmailGenerationContext } from '../../types/email.types';
import { addDays } from 'date-fns';

/**
 * Create minimal valid context for testing
 */
function createTestContext(): EmailGenerationContext {
  const now = new Date();

  return {
    user: {
      id: 'test-user-1',
      name: 'Test User',
      email: 'test@example.com',
      timezone: 'America/New_York',
    },
    company: {
      id: 'test-company-1',
      name: 'Test Company LLC',
    },
    preferences: {
      id: 'pref-1',
      userId: 'test-user-1',
      companyId: 'test-company-1',
      enabled: true,
      frequency: 'weekly',
      dayOfWeek: 'monday',
      timeOfDay: '09:00',
      timezone: 'America/New_York',
      includeSections: ['checklist-summary', 'quick-tips'],
      maxTasksToShow: 5,
      discProfileId: null,
      useDiscAdaptation: true,
      lastSentAt: null,
      nextScheduledAt: null,
      unsubscribedAt: null,
      unsubscribeReason: null,
      createdAt: now,
      updatedAt: now,
    },
    checklistItems: getSampleChecklistItems('test-user-1', 'test-company-1'),
    discType: 'S',
    generatedAt: now,
  };
}

describe('Email Preview Service', () => {
  describe('generateEmailPreview', () => {
    it('should generate complete email preview', async () => {
      const context = createTestContext();
      const preview = await generateEmailPreview(context);

      expect(preview).toBeDefined();
      expect(preview.subject).toBeTruthy();
      expect(preview.preheader).toBeTruthy();
      expect(preview.htmlContent).toBeTruthy();
      expect(preview.plainTextContent).toBeTruthy();
      expect(preview.estimatedSendTime).toBeInstanceOf(Date);
      expect(preview.discType).toBe('S');
    });

    it('should generate valid HTML content', async () => {
      const context = createTestContext();
      const preview = await generateEmailPreview(context);

      // Check for HTML structure
      expect(preview.htmlContent).toContain('<!DOCTYPE html>');
      expect(preview.htmlContent).toContain('<html');
      expect(preview.htmlContent).toContain('</html>');
      expect(preview.htmlContent).toContain('<body');
      expect(preview.htmlContent).toContain('</body>');
    });

    it('should generate valid plain text content', async () => {
      const context = createTestContext();
      const preview = await generateEmailPreview(context);

      // Plain text should not contain HTML tags
      expect(preview.plainTextContent).not.toContain('<html');
      expect(preview.plainTextContent).not.toContain('<body');

      // Should contain actual content
      expect(preview.plainTextContent.length).toBeGreaterThan(100);
      expect(preview.plainTextContent).toContain('Test Company LLC');
    });

    it('should include unsubscribe link in HTML', async () => {
      const context = createTestContext();
      const preview = await generateEmailPreview(context);

      expect(preview.htmlContent.toLowerCase()).toContain('unsubscribe');
      expect(preview.htmlContent).toContain('/email/unsubscribe');
    });

    it('should calculate next send time correctly', async () => {
      const context = createTestContext();
      const now = new Date();

      const preview = await generateEmailPreview(context);

      // Estimated send time should be in the future
      expect(preview.estimatedSendTime.getTime()).toBeGreaterThan(now.getTime());

      // Should be on a Monday (day 1)
      expect(preview.estimatedSendTime.getDay()).toBe(1);
    });

    it('should respect user preferences in preview', async () => {
      const context = createTestContext();
      context.preferences.includeSections = ['quick-tips', 'progress-update'];

      const preview = await generateEmailPreview(context);

      // HTML should include requested sections
      const htmlLower = preview.htmlContent.toLowerCase();
      expect(htmlLower.includes('tip') || htmlLower.includes('insight')).toBe(true);
      expect(htmlLower.includes('progress')).toBe(true);
    });
  });

  describe('generatePreviewsForAllDISCTypes', () => {
    it('should generate previews for all 4 DISC types', async () => {
      const context = createTestContext();
      const previews = await generatePreviewsForAllDISCTypes(context);

      expect(Object.keys(previews)).toHaveLength(4);
      expect(previews.D).toBeDefined();
      expect(previews.I).toBeDefined();
      expect(previews.S).toBeDefined();
      expect(previews.C).toBeDefined();
    });

    it('should generate different content for each DISC type', async () => {
      const context = createTestContext();
      const previews = await generatePreviewsForAllDISCTypes(context);

      // Subject lines should be different
      const subjects = [
        previews.D.subject,
        previews.I.subject,
        previews.S.subject,
        previews.C.subject,
      ];

      const uniqueSubjects = new Set(subjects);
      expect(uniqueSubjects.size).toBeGreaterThanOrEqual(3); // At least 3 should be unique
    });

    it('should maintain same base content across DISC types', async () => {
      const context = createTestContext();
      const previews = await generatePreviewsForAllDISCTypes(context);

      // All should reference the same company name
      Object.values(previews).forEach((preview) => {
        expect(preview.htmlContent).toContain('Test Company LLC');
      });

      // All should have unsubscribe links
      Object.values(previews).forEach((preview) => {
        expect(preview.htmlContent.toLowerCase()).toContain('unsubscribe');
      });
    });
  });

  describe('validateEmailContent', () => {
    it('should validate valid context', () => {
      const context = createTestContext();
      const result = validateEmailContent(context);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject context without user email', () => {
      const context = createTestContext();
      context.user.email = '';

      const result = validateEmailContent(context);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('User email is required');
    });

    it('should reject context without user name', () => {
      const context = createTestContext();
      context.user.name = '';

      const result = validateEmailContent(context);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('User name is required');
    });

    it('should reject context without company name', () => {
      const context = createTestContext();
      context.company.name = '';

      const result = validateEmailContent(context);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Company name is required');
    });

    it('should reject disabled preferences', () => {
      const context = createTestContext();
      context.preferences.enabled = false;

      const result = validateEmailContent(context);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Email preferences must be enabled');
    });

    it('should reject context with no email sections', () => {
      const context = createTestContext();
      context.preferences.includeSections = [];

      const result = validateEmailContent(context);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('At least one email section must be included');
    });

    it('should allow empty checklist items', () => {
      const context = createTestContext();
      context.checklistItems = [];

      const result = validateEmailContent(context);

      // Empty checklist is allowed - email can still be sent
      expect(result.valid).toBe(true);
    });
  });

  describe('getSampleChecklistItems', () => {
    it('should generate sample checklist items', () => {
      const items = getSampleChecklistItems('user-1', 'company-1');

      expect(items).toBeDefined();
      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThan(0);
    });

    it('should generate items with proper structure', () => {
      const items = getSampleChecklistItems('user-1', 'company-1');

      items.forEach((item) => {
        expect(item.id).toBeTruthy();
        expect(item.title).toBeTruthy();
        expect(item.description).toBeTruthy();
        expect(item.status).toBeTruthy();
        expect(item.priority).toBeTruthy();
        expect(['active', 'completed', 'snoozed', 'not-applicable']).toContain(item.status);
        expect(['high', 'medium', 'low']).toContain(item.priority);
      });
    });

    it('should generate items with future due dates', () => {
      const items = getSampleChecklistItems('user-1', 'company-1');
      const now = new Date();

      items.forEach((item) => {
        if (item.nextDueDate) {
          expect(new Date(item.nextDueDate).getTime()).toBeGreaterThan(now.getTime());
        }
      });
    });

    it('should include mix of foundation and weekly tasks', () => {
      const items = getSampleChecklistItems('user-1', 'company-1');

      const categories = items.map((item) => item.categoryId);
      const uniqueCategories = new Set(categories);

      expect(uniqueCategories.size).toBeGreaterThan(1);
    });
  });

  describe('End-to-end preview generation', () => {
    it('should generate preview with all sections', async () => {
      const context = createTestContext();
      context.preferences.includeSections = [
        'checklist-summary',
        'foundation-tasks',
        'upcoming-deadlines',
        'quick-tips',
        'progress-update',
      ];

      const preview = await generateEmailPreview(context);

      // Check that HTML contains elements from multiple sections
      const htmlLower = preview.htmlContent.toLowerCase();

      // Should have task content
      expect(htmlLower).toContain('task');

      // Should have tip content
      expect(htmlLower.includes('tip') || htmlLower.includes('insight')).toBe(true);

      // Should have progress content
      expect(htmlLower.includes('progress') || htmlLower.includes('completed')).toBe(true);
    });

    it('should handle Steadiness (S) communication style', async () => {
      const context = createTestContext();
      context.discType = 'S';

      const preview = await generateEmailPreview(context);

      // Should have gentle, supportive language
      const textLower = preview.plainTextContent.toLowerCase();
      const hasGentleTone =
        textLower.includes('gentle') ||
        textLower.includes('steady') ||
        textLower.includes('together') ||
        textLower.includes('time') ||
        textLower.includes('step');

      expect(hasGentleTone).toBe(true);

      // Subject should be encouraging
      const subjectLower = preview.subject.toLowerCase();
      const hasEncouragingSubject =
        subjectLower.includes('small steps') ||
        subjectLower.includes('steady') ||
        subjectLower.includes('gentle') ||
        subjectLower.includes('care');

      expect(hasEncouragingSubject).toBe(true);
    });
  });
});
