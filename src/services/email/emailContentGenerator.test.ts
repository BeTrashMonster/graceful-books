/**
 * Email Content Generator Tests
 *
 * Tests for DISC-adapted email content generation
 */

import { describe, it, expect } from 'vitest';
import type { EmailGenerationContext } from '../../types/email.types';
import type { ChecklistItem } from '../../types/checklist.types';
import { generateEmailContent } from './emailContentGenerator';
import { addDays } from 'date-fns';

/**
 * Create mock generation context
 */
function createMockContext(discType: 'D' | 'I' | 'S' | 'C'): EmailGenerationContext {
  const now = new Date();

  const mockChecklistItems: ChecklistItem[] = [
    {
      id: 'item-1',
      categoryId: 'foundation',
      title: 'Set up chart of accounts',
      description: 'Create your account structure',
      explanationLevel: 'detailed',
      status: 'active',
      completedAt: null,
      snoozedUntil: null,
      snoozedReason: null,
      notApplicableReason: null,
      featureLink: '/chart-of-accounts',
      helpArticle: null,
      isCustom: false,
      isReordered: false,
      customOrder: null,
      recurrence: 'once',
      priority: 'high',
      lastDueDate: null,
      nextDueDate: addDays(now, 2),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'item-2',
      categoryId: 'weekly',
      title: 'Reconcile transactions',
      description: 'Match bank records',
      explanationLevel: 'brief',
      status: 'active',
      completedAt: null,
      snoozedUntil: null,
      snoozedReason: null,
      notApplicableReason: null,
      featureLink: '/reconciliation',
      helpArticle: null,
      isCustom: false,
      isReordered: false,
      customOrder: null,
      recurrence: 'weekly',
      priority: 'medium',
      lastDueDate: null,
      nextDueDate: addDays(now, 5),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'item-3',
      categoryId: 'foundation',
      title: 'Upload receipts',
      description: 'Keep digital copies',
      explanationLevel: 'brief',
      status: 'completed',
      completedAt: now,
      snoozedUntil: null,
      snoozedReason: null,
      notApplicableReason: null,
      featureLink: '/receipts',
      helpArticle: null,
      isCustom: false,
      isReordered: false,
      customOrder: null,
      recurrence: 'weekly',
      priority: 'low',
      lastDueDate: null,
      nextDueDate: null,
      createdAt: now,
      updatedAt: now,
    },
  ];

  return {
    user: {
      id: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      timezone: 'America/Los_Angeles',
    },
    company: {
      id: 'company-1',
      name: 'Test Company',
    },
    preferences: {
      id: 'pref-1',
      userId: 'user-1',
      companyId: 'company-1',
      enabled: true,
      frequency: 'weekly',
      dayOfWeek: 'monday',
      timeOfDay: '08:00',
      timezone: 'America/Los_Angeles',
      includeSections: [
        'checklist-summary',
        'foundation-tasks',
        'upcoming-deadlines',
        'quick-tips',
        'progress-update',
      ],
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
    checklistItems: mockChecklistItems,
    discType,
    generatedAt: now,
  };
}

describe('Email Content Generator', () => {
  describe('generateEmailContent', () => {
    it('should generate content for Dominance (D) type', () => {
      const context = createMockContext('D');
      const content = generateEmailContent(context);

      expect(content.discType).toBe('D');
      expect(content.subject.primary).toBeTruthy();
      expect(content.greeting).toBeTruthy();
      expect(content.sections.length).toBeGreaterThan(0);

      // D type should have direct, action-oriented tone
      expect(content.greeting.length).toBeLessThan(100); // Brief
      expect(content.sections[0]!.title).toBeTruthy();
    });

    it('should generate content for Influence (I) type', () => {
      const context = createMockContext('I');
      const content = generateEmailContent(context);

      expect(content.discType).toBe('I');
      expect(content.subject.primary).toBeTruthy();
      expect(content.greeting).toBeTruthy();

      // I type should have enthusiastic, encouraging tone
      // Greeting likely has exclamation marks or enthusiasm
      const hasEnthusiasm =
        content.greeting.includes('!') ||
        content.greeting.toLowerCase().includes('great') ||
        content.greeting.toLowerCase().includes('awesome');
      expect(hasEnthusiasm).toBe(true);
    });

    it('should generate content for Steadiness (S) type', () => {
      const context = createMockContext('S');
      const content = generateEmailContent(context);

      expect(content.discType).toBe('S');
      expect(content.subject.primary).toBeTruthy();
      expect(content.greeting).toBeTruthy();

      // S type should have supportive, patient tone
      // Subject line should be gentle
      const subjectLower = content.subject.primary.toLowerCase();
      const hasGentleTone =
        subjectLower.includes('small steps') ||
        subjectLower.includes('gentle') ||
        subjectLower.includes('steady') ||
        subjectLower.includes('together');
      expect(hasGentleTone).toBe(true);
    });

    it('should generate content for Conscientiousness (C) type', () => {
      const context = createMockContext('C');
      const content = generateEmailContent(context);

      expect(content.discType).toBe('C');
      expect(content.subject.primary).toBeTruthy();
      expect(content.greeting).toBeTruthy();

      // C type should have detailed, formal tone
      const subjectLower = content.subject.primary.toLowerCase();
      const hasFormalTone =
        subjectLower.includes('report') ||
        subjectLower.includes('detailed') ||
        subjectLower.includes('comprehensive') ||
        subjectLower.includes('status');
      expect(hasFormalTone).toBe(true);
    });

    it('should include requested sections only', () => {
      const context = createMockContext('S');
      context.preferences.includeSections = ['checklist-summary', 'quick-tips'];

      const content = generateEmailContent(context);

      // Should have exactly 2 sections (or fewer if some sections have no data)
      expect(content.sections.length).toBeLessThanOrEqual(2);

      const sectionTypes = content.sections.map((s) => s.type);
      expect(sectionTypes).toContain('checklist-summary');
      expect(sectionTypes).toContain('quick-tips');
    });

    it('should respect maxTasksToShow limit', () => {
      const context = createMockContext('S');
      context.preferences.maxTasksToShow = 1;

      // Add more active items
      const now = new Date();
      for (let i = 0; i < 10; i++) {
        context.checklistItems.push({
          id: `extra-${i}`,
          categoryId: 'weekly',
          title: `Task ${i}`,
          description: `Description ${i}`,
          explanationLevel: 'brief',
          status: 'active',
          completedAt: null,
          snoozedUntil: null,
          snoozedReason: null,
          notApplicableReason: null,
          featureLink: null,
          helpArticle: null,
          isCustom: false,
          isReordered: false,
          customOrder: null,
          recurrence: 'weekly',
          priority: 'medium',
          lastDueDate: null,
          nextDueDate: addDays(now, i + 1),
          createdAt: now,
          updatedAt: now,
        });
      }

      const content = generateEmailContent(context);

      // Find checklist summary section
      const summarySection = content.sections.find((s) => s.type === 'checklist-summary');
      if (summarySection && summarySection.items) {
        expect(summarySection.items.length).toBeLessThanOrEqual(1);
      }
    });

    it('should generate proper footer with unsubscribe link', () => {
      const context = createMockContext('S');
      const content = generateEmailContent(context);

      expect(content.footer.unsubscribeLink).toBeTruthy();
      expect(content.footer.unsubscribeLink).toContain('unsubscribe');
      expect(content.footer.preferencesLink).toBeTruthy();
      expect(content.footer.companyName).toBe('Test Company');
      expect(content.footer.supportEmail).toBeTruthy();
    });

    it('should generate preheader text appropriate for DISC type', () => {
      const contexts = {
        D: createMockContext('D'),
        I: createMockContext('I'),
        S: createMockContext('S'),
        C: createMockContext('C'),
      };

      for (const context of Object.values(contexts)) {
        const content = generateEmailContent(context);
        expect(content.preheader).toBeTruthy();
        expect(content.preheader.length).toBeGreaterThan(10);
        expect(content.preheader.length).toBeLessThan(150); // Preheaders should be concise
      }
    });

    it('should handle empty checklist items gracefully', () => {
      const context = createMockContext('S');
      context.checklistItems = [];

      const content = generateEmailContent(context);

      expect(content.subject.primary).toBeTruthy();
      expect(content.greeting).toBeTruthy();
      // Sections may be empty or contain only non-checklist sections
      expect(content.sections).toBeDefined();
    });

    it('should sort tasks by priority correctly', () => {
      const context = createMockContext('S');
      const now = new Date();

      // Add tasks with different priorities
      context.checklistItems = [
        {
          id: 'low-priority',
          categoryId: 'foundation',
          title: 'Low priority task',
          description: '',
          explanationLevel: 'brief',
          status: 'active',
          completedAt: null,
          snoozedUntil: null,
          snoozedReason: null,
          notApplicableReason: null,
          featureLink: null,
          helpArticle: null,
          isCustom: false,
          isReordered: false,
          customOrder: null,
          recurrence: 'once',
          priority: 'low',
          lastDueDate: null,
          nextDueDate: null,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'high-priority',
          categoryId: 'foundation',
          title: 'High priority task',
          description: '',
          explanationLevel: 'brief',
          status: 'active',
          completedAt: null,
          snoozedUntil: null,
          snoozedReason: null,
          notApplicableReason: null,
          featureLink: null,
          helpArticle: null,
          isCustom: false,
          isReordered: false,
          customOrder: null,
          recurrence: 'once',
          priority: 'high',
          lastDueDate: null,
          nextDueDate: null,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'medium-priority',
          categoryId: 'foundation',
          title: 'Medium priority task',
          description: '',
          explanationLevel: 'brief',
          status: 'active',
          completedAt: null,
          snoozedUntil: null,
          snoozedReason: null,
          notApplicableReason: null,
          featureLink: null,
          helpArticle: null,
          isCustom: false,
          isReordered: false,
          customOrder: null,
          recurrence: 'once',
          priority: 'medium',
          lastDueDate: null,
          nextDueDate: null,
          createdAt: now,
          updatedAt: now,
        },
      ];

      const content = generateEmailContent(context);

      const summarySection = content.sections.find((s) => s.type === 'checklist-summary');
      if (summarySection && summarySection.items) {
        // First item should be high priority
        expect(summarySection.items[0]!.title).toBe('High priority task');
      }
    });
  });
});
