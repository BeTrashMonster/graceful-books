/**
 * Email Content Generator
 *
 * Per D3: Weekly Email Summary Setup
 * Generates DISC-adapted email content from checklist data and user preferences.
 */

import type { DISCType } from '../../features/messaging/messageLibrary';
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
  getClosing,
} from './emailTemplates';
import { format, addDays, startOfWeek } from 'date-fns';

/**
 * Generate complete email content
 */
export function generateEmailContent(context: EmailGenerationContext): EmailContent {
  const { user, company, preferences, checklistItems, discType, generatedAt } = context;

  // Generate subject line
  const subject = {
    primary: getSubjectLine(discType),
    fallback: 'Your Week Ahead: Small Steps, Big Progress',
  };

  // Generate preheader (preview text)
  const preheader = generatePreheader(checklistItems, discType);

  // Generate greeting
  const greeting = getGreeting(discType, user.name);

  // Generate sections based on preferences
  const sections = generateSections(
    checklistItems,
    preferences.includeSections,
    preferences.maxTasksToShow,
    discType
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
function generatePreheader(items: ChecklistItem[], discType: DISCType): string {
  const activeItems = items.filter((item) => item.status === 'active');
  const completedCount = items.filter((item) => item.status === 'completed').length;

  const preheaders: Record<DISCType, string> = {
    D: `${activeItems.length} items need attention. ${completedCount} completed.`,
    I: `You've completed ${completedCount} tasks! ${activeItems.length} more to go - you've got this!`,
    S: `${activeItems.length} tasks ahead. Take your time - ${completedCount} already done.`,
    C: `Status: ${activeItems.length} pending, ${completedCount} completed, ${items.length} total.`,
  };

  return preheaders[discType];
}

/**
 * Generate email sections
 */
function generateSections(
  checklistItems: ChecklistItem[],
  includeSections: EmailContentSection[],
  maxTasksToShow: number,
  discType: DISCType
): EmailSection[] {
  const sections: EmailSection[] = [];
  let order = 1;

  for (const sectionType of includeSections) {
    const section = generateSection(sectionType, checklistItems, maxTasksToShow, discType, order);
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
  discType: DISCType,
  order: number
): EmailSection | null {
  const intro = getSectionIntro(discType, type);

  switch (type) {
    case 'checklist-summary':
      return generateChecklistSummary(items, maxItems, discType, intro, order);
    case 'foundation-tasks':
      return generateFoundationTasks(items, maxItems, discType, intro, order);
    case 'upcoming-deadlines':
      return generateUpcomingDeadlines(items, maxItems, discType, intro, order);
    case 'quick-tips':
      return generateQuickTips(discType, intro, order);
    case 'progress-update':
      return generateProgressUpdate(items, discType, intro, order);
    case 'financial-snapshot':
      return generateFinancialSnapshot(discType, intro, order);
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
  discType: DISCType,
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
    actionText: getActionText(discType),
    metadata: {
      priority: item.priority,
      category: item.categoryId,
      dueDate: item.nextDueDate,
    },
  }));

  return {
    type: 'checklist-summary',
    title: getChecklistSummaryTitle(discType),
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
  discType: DISCType,
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
    actionText: getActionText(discType),
  }));

  return {
    type: 'foundation-tasks',
    title: getFoundationTasksTitle(discType),
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
  discType: DISCType,
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
    actionText: getActionText(discType),
  }));

  return {
    type: 'upcoming-deadlines',
    title: getUpcomingDeadlinesTitle(discType),
    content: intro,
    items: sectionItems,
    order,
  };
}

/**
 * Generate quick tips section
 */
function generateQuickTips(
  discType: DISCType,
  intro: string,
  order: number
): EmailSection {
  const tips = getQuickTipsForDISC(discType);
  const randomTip = tips[Math.floor(Math.random() * tips.length)];

  return {
    type: 'quick-tips',
    title: getQuickTipsTitle(discType),
    content: `${intro}\n\n${randomTip}`,
    order,
  };
}

/**
 * Generate progress update section
 */
function generateProgressUpdate(
  items: ChecklistItem[],
  discType: DISCType,
  intro: string,
  order: number
): EmailSection {
  const totalItems = items.length;
  const completedItems = items.filter((item) => item.status === 'completed').length;
  const percentComplete = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  const progressText = getProgressText(completedItems, totalItems, percentComplete, discType);

  return {
    type: 'progress-update',
    title: getProgressUpdateTitle(discType),
    content: `${intro}\n\n${progressText}`,
    order,
  };
}

/**
 * Generate financial snapshot section (placeholder)
 */
function generateFinancialSnapshot(
  discType: DISCType,
  intro: string,
  order: number
): EmailSection {
  return {
    type: 'financial-snapshot',
    title: getFinancialSnapshotTitle(discType),
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
// Helper Functions - Section Titles
// ============================================================================

function getChecklistSummaryTitle(discType: DISCType): string {
  const titles: Record<DISCType, string> = {
    D: 'Action Items',
    I: 'What\'s on Deck',
    S: 'Your Tasks This Week',
    C: 'Outstanding Items',
  };
  return titles[discType];
}

function getFoundationTasksTitle(discType: DISCType): string {
  const titles: Record<DISCType, string> = {
    D: 'Foundation Priorities',
    I: 'Building Your Foundation',
    S: 'Foundational Tasks',
    C: 'Core System Tasks',
  };
  return titles[discType];
}

function getUpcomingDeadlinesTitle(discType: DISCType): string {
  const titles: Record<DISCType, string> = {
    D: 'Deadlines',
    I: 'Coming Up Soon',
    S: 'Upcoming Due Dates',
    C: 'Scheduled Deadlines',
  };
  return titles[discType];
}

function getQuickTipsTitle(discType: DISCType): string {
  const titles: Record<DISCType, string> = {
    D: 'Quick Win',
    I: 'This Week\'s Tip',
    S: 'Helpful Insight',
    C: 'Technical Note',
  };
  return titles[discType];
}

function getProgressUpdateTitle(discType: DISCType): string {
  const titles: Record<DISCType, string> = {
    D: 'Status',
    I: 'You\'re Doing Great!',
    S: 'Your Progress',
    C: 'Completion Metrics',
  };
  return titles[discType];
}

function getFinancialSnapshotTitle(discType: DISCType): string {
  const titles: Record<DISCType, string> = {
    D: 'Financial Status',
    I: 'Your Financial Story',
    S: 'Financial Overview',
    C: 'Financial Data Summary',
  };
  return titles[discType];
}

// ============================================================================
// Helper Functions - Action Text
// ============================================================================

function getActionText(discType: DISCType): string {
  const actions: Record<DISCType, string> = {
    D: 'Do it now',
    I: 'Let\'s go!',
    S: 'Take a look',
    C: 'Review details',
  };
  return actions[discType];
}

// ============================================================================
// Helper Functions - Progress Text
// ============================================================================

function getProgressText(
  completed: number,
  total: number,
  percent: number,
  discType: DISCType
): string {
  const templates: Record<DISCType, string> = {
    D: `${completed}/${total} completed (${percent}%). Keep moving.`,
    I: `You've completed ${completed} out of ${total} tasks - that's ${percent}%! Way to go!`,
    S: `You've completed ${completed} of ${total} tasks (${percent}%). Steady progress is what counts.`,
    C: `Completion rate: ${percent}% (${completed}/${total} items completed).`,
  };
  return templates[discType];
}

// ============================================================================
// Quick Tips Library
// ============================================================================

function getQuickTipsForDISC(discType: DISCType): string[] {
  const commonTips = [
    'Reconciling weekly (not monthly) catches errors when they\'re easy to fix.',
    'A quick photo of your receipt is better than a lost receipt.',
    'Set up recurring transactions for predictable expenses - saves time.',
    'Your P&L tells you if you\'re profitable. Check it monthly at minimum.',
    'Small, consistent actions beat marathon sessions.',
  ];

  const discSpecificTips: Record<DISCType, string[]> = {
    D: [
      'Batch similar tasks together for maximum efficiency.',
      'Focus on the 20% of tasks that drive 80% of results.',
      'Set hard deadlines for yourself - and stick to them.',
    ],
    I: [
      'Share your progress with someone - accountability makes it fun!',
      'Celebrate small wins - they add up to big successes.',
      'Find a friend also running a business and check in weekly.',
    ],
    S: [
      'Create a routine and stick to it - consistency is your superpower.',
      'Block out the same time each week for bookkeeping.',
      'Remember: done is better than perfect.',
    ],
    C: [
      'Document your processes as you go - future you will thank you.',
      'Review your account categories quarterly for accuracy.',
      'Keep a log of unusual transactions with detailed notes.',
    ],
  };

  return [...commonTips, ...discSpecificTips[discType]];
}
