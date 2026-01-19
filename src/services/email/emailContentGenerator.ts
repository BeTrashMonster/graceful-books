/**
 * Email Content Generator
 *
 * Per D3: Weekly Email Summary Setup
 * Generates email content with Steadiness communication style from checklist data and user preferences.
 *
 * Security Note: This file uses Math.random() intentionally for selecting
 * content variants (tips, greetings). These random values are NOT used for
 * security purposes - they provide variety in email communications.
 */

import type {
  EmailContent,
  EmailSection,
  EmailSectionItem,
  EmailContentSection,
  EmailGenerationContext,
  EmailFooter,
} from '../../types/email.types';
import type { ChecklistItem } from '../../types/checklist.types';
import {
  getSubjectLine,
  getGreeting,
  getSectionIntro,
} from './emailTemplates';
import { format, addDays } from 'date-fns';

/**
 * Generate complete email content
 */
export function generateEmailContent(context: EmailGenerationContext): EmailContent {
  const { user, company, preferences, checklistItems, discType, generatedAt: _generatedAt } = context;

  // Generate subject line
  const subject = {
    primary: getSubjectLine(0, discType),
    fallback: 'Your Week Ahead: Small Steps, Big Progress',
  };

  // Generate preheader (preview text)
  const preheader = generatePreheader(checklistItems);

  // Generate greeting
  const greeting = getGreeting(user.name, discType);

  // Generate sections based on preferences
  const sections = generateSections(
    checklistItems,
    preferences.includeSections,
    preferences.maxTasksToShow
  );

  // Generate footer
  const footer = generateFooter(company, user);

  return {
    subject,
    preheader,
    greeting,
    sections,
    footer,
    discType,
  };
}

/**
 * Generate email preheader (preview text)
 */
function generatePreheader(items: ChecklistItem[]): string {
  const activeItems = items.filter((item) => item.status === 'active');
  const completedCount = items.filter((item) => item.status === 'completed').length;

  // Steadiness style: patient, supportive
  return `${activeItems.length} tasks ahead. Take your time - ${completedCount} already done.`;
}

/**
 * Generate email sections
 */
function generateSections(
  checklistItems: ChecklistItem[],
  includeSections: EmailContentSection[],
  maxTasksToShow: number
): EmailSection[] {
  const sections: EmailSection[] = [];
  let order = 1;

  for (const sectionType of includeSections) {
    const section = generateSection(sectionType, checklistItems, maxTasksToShow, order);
    if (section) {
      sections.push(section);
      order++;
    }
  }

  return sections;
}

/**
 * Generate individual section
 */
function generateSection(
  type: EmailContentSection,
  items: ChecklistItem[],
  maxItems: number,
  order: number
): EmailSection | null {
  const intro = getSectionIntro(type);

  switch (type) {
    case 'checklist-summary':
      return generateChecklistSummary(items, maxItems, intro, order);
    case 'foundation-tasks':
      return generateFoundationTasks(items, maxItems, intro, order);
    case 'upcoming-deadlines':
      return generateUpcomingDeadlines(items, maxItems, intro, order);
    case 'quick-tips':
      return generateQuickTips(intro, order);
    case 'progress-update':
      return generateProgressUpdate(items, intro, order);
    case 'financial-snapshot':
      return generateFinancialSnapshot(intro, order);
    default:
      return null;
  }
}

/**
 * Generate checklist summary section
 */
function generateChecklistSummary(
  items: ChecklistItem[],
  maxItems: number,
  intro: string,
  order: number
): EmailSection | null {
  const activeItems = items
    .filter((item) => item.status === 'active')
    .sort((a, b) => {
      // Sort by priority, then by due date
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;

      if (a.nextDueDate && b.nextDueDate) {
        return a.nextDueDate.getTime() - b.nextDueDate.getTime();
      }
      return 0;
    })
    .slice(0, maxItems);

  if (activeItems.length === 0) {
    return null;
  }

  const sectionItems: EmailSectionItem[] = activeItems.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    actionLink: item.featureLink || undefined,
    actionText: getActionText(),
    metadata: {
      priority: item.priority,
      category: item.categoryId,
      dueDate: item.nextDueDate,
    },
  }));

  return {
    type: 'checklist-summary',
    title: getChecklistSummaryTitle(),
    content: intro,
    items: sectionItems,
    order,
  };
}

/**
 * Generate foundation tasks section
 */
function generateFoundationTasks(
  items: ChecklistItem[],
  maxItems: number,
  intro: string,
  order: number
): EmailSection | null {
  const foundationItems = items
    .filter((item) => item.status === 'active' && item.categoryId === 'foundation')
    .slice(0, maxItems);

  if (foundationItems.length === 0) {
    return null;
  }

  const sectionItems: EmailSectionItem[] = foundationItems.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.explanationLevel === 'detailed' ? item.description : undefined,
    actionLink: item.featureLink || undefined,
    actionText: getActionText(),
  }));

  return {
    type: 'foundation-tasks',
    title: getFoundationTasksTitle(),
    content: intro,
    items: sectionItems,
    order,
  };
}

/**
 * Generate upcoming deadlines section
 */
function generateUpcomingDeadlines(
  items: ChecklistItem[],
  maxItems: number,
  intro: string,
  order: number
): EmailSection | null {
  const now = new Date();
  const weekFromNow = addDays(now, 7);

  const upcomingItems = items
    .filter((item) => {
      if (!item.nextDueDate || item.status !== 'active') return false;
      const dueDate = new Date(item.nextDueDate);
      return dueDate >= now && dueDate <= weekFromNow;
    })
    .sort((a, b) => {
      const dateA = a.nextDueDate ? new Date(a.nextDueDate).getTime() : 0;
      const dateB = b.nextDueDate ? new Date(b.nextDueDate).getTime() : 0;
      return dateA - dateB;
    })
    .slice(0, maxItems);

  if (upcomingItems.length === 0) {
    return null;
  }

  const sectionItems: EmailSectionItem[] = upcomingItems.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.nextDueDate
      ? `Due: ${format(new Date(item.nextDueDate), 'EEEE, MMM d')}`
      : undefined,
    actionLink: item.featureLink || undefined,
    actionText: getActionText(),
  }));

  return {
    type: 'upcoming-deadlines',
    title: getUpcomingDeadlinesTitle(),
    content: intro,
    items: sectionItems,
    order,
  };
}

/**
 * Generate quick tips section
 */
function generateQuickTips(
  intro: string,
  order: number
): EmailSection {
  const tips = getQuickTips();
  const randomTip = tips[Math.floor(Math.random() * tips.length)];

  return {
    type: 'quick-tips',
    title: getQuickTipsTitle(),
    content: `${intro}\n\n${randomTip}`,
    order,
  };
}

/**
 * Generate progress update section
 */
function generateProgressUpdate(
  items: ChecklistItem[],
  intro: string,
  order: number
): EmailSection {
  const totalItems = items.length;
  const completedItems = items.filter((item) => item.status === 'completed').length;
  const percentComplete = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  const progressText = getProgressText(completedItems, totalItems, percentComplete);

  return {
    type: 'progress-update',
    title: getProgressUpdateTitle(),
    content: `${intro}\n\n${progressText}`,
    order,
  };
}

/**
 * Generate financial snapshot section (placeholder)
 */
function generateFinancialSnapshot(
  intro: string,
  order: number
): EmailSection {
  return {
    type: 'financial-snapshot',
    title: getFinancialSnapshotTitle(),
    content: `${intro}\n\nYour financial reports are up to date. Visit your dashboard for detailed insights.`,
    order,
  };
}

/**
 * Generate email footer
 */
function generateFooter(
  company: { id: string; name: string },
  user: { id: string; email: string }
): EmailFooter {
  return {
    unsubscribeLink: `/email/unsubscribe?userId=${user.id}`,
    preferencesLink: `/settings/email-preferences`,
    companyName: company.name,
    supportEmail: 'support@gracefulbooks.com',
  };
}

// ============================================================================
// Helper Functions - Section Titles (Steadiness Style)
// ============================================================================

function getChecklistSummaryTitle(): string {
  return 'Your Tasks This Week';
}

function getFoundationTasksTitle(): string {
  return 'Foundational Tasks';
}

function getUpcomingDeadlinesTitle(): string {
  return 'Upcoming Due Dates';
}

function getQuickTipsTitle(): string {
  return 'Helpful Insight';
}

function getProgressUpdateTitle(): string {
  return 'Your Progress';
}

function getFinancialSnapshotTitle(): string {
  return 'Financial Overview';
}

// ============================================================================
// Helper Functions - Action Text (Steadiness Style)
// ============================================================================

function getActionText(): string {
  return 'Take a look';
}

// ============================================================================
// Helper Functions - Progress Text (Steadiness Style)
// ============================================================================

function getProgressText(
  completed: number,
  total: number,
  percent: number
): string {
  return `You've completed ${completed} of ${total} tasks (${percent}%). Steady progress is what counts.`;
}

// ============================================================================
// Quick Tips Library (Steadiness Style)
// ============================================================================

function getQuickTips(): string[] {
  return [
    'Reconciling weekly (not monthly) catches errors when they\'re easy to fix.',
    'A quick photo of your receipt is better than a lost receipt.',
    'Set up recurring transactions for predictable expenses - saves time.',
    'Your P&L tells you if you\'re profitable. Check it monthly at minimum.',
    'Small, consistent actions beat marathon sessions.',
    'Create a routine and stick to it - consistency is your superpower.',
    'Block out the same time each week for bookkeeping.',
    'Remember: done is better than perfect.',
  ];
}
