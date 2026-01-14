/**
 * Email Preview Service
 *
 * Per D3: Weekly Email Summary Setup
 * Generates preview of what the email will look like before enabling.
 */

import type { EmailPreview, EmailGenerationContext } from '../../types/email.types';
import { generateEmailContent } from './emailContentGenerator';
import { renderEmailToHTML, renderEmailToPlainText } from './emailRenderer';
import { addDays, nextMonday, set } from 'date-fns';

/**
 * Generate email preview
 */
export async function generateEmailPreview(
  context: EmailGenerationContext
): Promise<EmailPreview> {
  // Generate email content
  const content = generateEmailContent(context);

  // Render to HTML and plain text
  const htmlContent = renderEmailToHTML(content);
  const plainTextContent = renderEmailToPlainText(content);

  // Calculate estimated send time
  const estimatedSendTime = calculateNextSendTime(
    context.preferences.dayOfWeek,
    context.preferences.timeOfDay,
    context.preferences.timezone
  );

  return {
    subject: content.subject.primary,
    preheader: content.preheader,
    htmlContent,
    plainTextContent,
    estimatedSendTime,
  };
}

/**
 * Calculate next send time based on preferences
 */
function calculateNextSendTime(
  dayOfWeek: string,
  timeOfDay: string,
  timezone: string
): Date {
  const now = new Date();

  // Map day of week to date-fns day index (0 = Sunday, 1 = Monday, etc.)
  const dayMap: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };

  const targetDay = dayMap[dayOfWeek.toLowerCase()] || 1; // Default to Monday

  // Parse time of day (HH:MM)
  const [hours, minutes] = timeOfDay.split(':').map(Number);

  // Get next occurrence of target day
  let targetDate = now;
  while (targetDate.getDay() !== targetDay) {
    targetDate = addDays(targetDate, 1);
  }

  // Set time
  targetDate = set(targetDate, {
    hours: hours || 8,
    minutes: minutes || 0,
    seconds: 0,
    milliseconds: 0,
  });

  // If the target time has already passed today, move to next week
  if (targetDate <= now) {
    targetDate = addDays(targetDate, 7);
  }

  return targetDate;
}

/**
 * Validate email content before sending
 */
export function validateEmailContent(content: EmailGenerationContext): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate user info
  if (!content.user.email) {
    errors.push('User email is required');
  }

  if (!content.user.name) {
    errors.push('User name is required');
  }

  // Validate company info
  if (!content.company.name) {
    errors.push('Company name is required');
  }

  // Validate preferences
  if (!content.preferences.enabled) {
    errors.push('Email preferences must be enabled');
  }

  if (content.preferences.includeSections.length === 0) {
    errors.push('At least one email section must be included');
  }

  // Validate checklist items
  if (!content.checklistItems || content.checklistItems.length === 0) {
    // This is a warning, not an error - emails can be sent with no tasks
    // errors.push('No checklist items available');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get sample checklist items for preview
 * Used when user wants to preview email but doesn't have real checklist data yet
 */
export function getSampleChecklistItems(userId: string, companyId: string) {
  const now = new Date();

  return [
    {
      id: 'sample-1',
      categoryId: 'foundation',
      title: 'Set up your chart of accounts',
      description: 'Create the basic account structure for your business finances.',
      explanationLevel: 'detailed' as const,
      status: 'active' as const,
      completedAt: null,
      snoozedUntil: null,
      snoozedReason: null,
      notApplicableReason: null,
      featureLink: '/chart-of-accounts/setup',
      helpArticle: null,
      isCustom: false,
      isReordered: false,
      customOrder: null,
      recurrence: 'once' as const,
      priority: 'high' as const,
      lastDueDate: null,
      nextDueDate: addDays(now, 2),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'sample-2',
      categoryId: 'weekly',
      title: 'Reconcile last week\'s transactions',
      description: 'Match your bank statement to your records to catch any discrepancies.',
      explanationLevel: 'brief' as const,
      status: 'active' as const,
      completedAt: null,
      snoozedUntil: null,
      snoozedReason: null,
      notApplicableReason: null,
      featureLink: '/reconciliation',
      helpArticle: null,
      isCustom: false,
      isReordered: false,
      customOrder: null,
      recurrence: 'weekly' as const,
      priority: 'medium' as const,
      lastDueDate: null,
      nextDueDate: addDays(now, 5),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'sample-3',
      categoryId: 'foundation',
      title: 'Upload your business receipts',
      description: 'Keep digital copies of all business expenses.',
      explanationLevel: 'brief' as const,
      status: 'active' as const,
      completedAt: null,
      snoozedUntil: null,
      snoozedReason: null,
      notApplicableReason: null,
      featureLink: '/receipts/upload',
      helpArticle: null,
      isCustom: false,
      isReordered: false,
      customOrder: null,
      recurrence: 'weekly' as const,
      priority: 'low' as const,
      lastDueDate: null,
      nextDueDate: addDays(now, 7),
      createdAt: now,
      updatedAt: now,
    },
  ];
}
