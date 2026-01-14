/**
 * Email Templates with Steadiness Communication Style
 *
 * Per D3: Weekly Email Summary Setup
 * Provides email templates using Steadiness communication style for all users.
 * Steadiness: Patient, step-by-step, supportive, stable
 */

import type { EmailContentSection } from '../../types/email.types';

/**
 * Steadiness email template
 * Used for all users - patient, supportive, step-by-step guidance
 */
export const EMAIL_TEMPLATE = {
  subjectLines: [
    'Your Week Ahead: Small Steps, Big Progress',
    'A Gentle Reminder: This Week\'s Tasks',
    'Taking Care of Your Business, One Step at a Time',
    'Your Weekly Guide: We\'re Here With You',
    'Steady Progress: Your Tasks for the Week',
  ],
  greetings: [
    'Good morning. Let\'s look at what\'s ahead together.',
    'Hello. We\'re here to help you stay on track this week.',
    'Welcome to your weekly check-in. Take your time with these.',
    'Hi there. Here\'s a gentle overview of your upcoming tasks.',
  ],
  sectionIntros: {
    'checklist-summary': 'Here\'s where things stand - no rush, just steady progress:',
    'foundation-tasks': 'These foundational tasks will help keep things stable:',
    'upcoming-deadlines': 'Coming up soon, so you have time to prepare:',
    'quick-tips': 'A helpful tip for your week:',
    'progress-update': 'See how far you\'ve come - you\'re doing great:',
    'financial-snapshot': 'Your financial overview - everything is in order:',
  },
  closings: [
    'Take it one step at a time. We\'re here if you need us.',
    'You\'re making steady progress. That\'s what matters.',
    'Remember, consistency beats perfection. Keep going.',
    'We\'re here to support you every step of the way.',
  ],
  toneGuidelines: {
    formality: 'professional' as const,
    enthusiasm: 'medium' as const,
    directness: 'indirect' as const,
    supportiveness: 'highly-supportive' as const,
  },
};

/**
 * Get subject line
 * Returns the primary subject line (cycles through variants)
 */
export function getSubjectLine(index: number = 0): string {
  const subjectLines = EMAIL_TEMPLATE.subjectLines;
  return subjectLines[index % subjectLines.length];
}

/**
 * Get greeting
 * Returns a random greeting with optional personalization
 */
export function getGreeting(userName?: string): string {
  const greetings = EMAIL_TEMPLATE.greetings;
  const greeting = greetings[Math.floor(Math.random() * greetings.length)];

  if (userName) {
    // Add personalized name for Steadiness style (personal and supportive)
    return greeting.replace(/^(Hello|Hi|Good morning|Welcome)/, `$1, ${userName}`);
  }

  return greeting;
}

/**
 * Get section intro
 */
export function getSectionIntro(section: EmailContentSection): string {
  return EMAIL_TEMPLATE.sectionIntros[section] || '';
}

/**
 * Get closing
 * Returns a random closing
 */
export function getClosing(): string {
  const closings = EMAIL_TEMPLATE.closings;
  return closings[Math.floor(Math.random() * closings.length)];
}

/**
 * Get template
 */
export function getEmailTemplate() {
  return EMAIL_TEMPLATE;
}
