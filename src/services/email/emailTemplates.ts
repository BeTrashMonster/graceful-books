/**
 * Email Templates with DISC-Adapted Communication Styles
 *
 * Per D3: Weekly Email Summary Setup
 * Provides email templates adapted for different DISC communication styles.
 *
 * Security Note: This file uses Math.random() intentionally for selecting
 * greeting and closing text variants. These random values are NOT used for
 * security purposes - they provide variety in email communications.
 */

import type { EmailContentSection } from '../../types/email.types';

type DISCType = 'D' | 'I' | 'S' | 'C';

/**
 * DISC-adapted email templates
 */
const DISC_TEMPLATES: Record<DISCType, {
  subjectLines: string[];
  greetings: string[];
}> = {
  D: {
    // Dominance: Direct, action-oriented, results-focused
    subjectLines: [
      'Your Weekly Action Plan',
      'Tasks to Complete This Week',
      'Your Business: Key Priorities',
      'Weekly Overview: Take Action',
      'Priority Tasks for Maximum Impact',
    ],
    greetings: [
      'Here\'s what needs to get done.',
      'Your priorities this week.',
      'Focus on these key tasks.',
      'Let\'s tackle your priorities.',
    ],
  },
  I: {
    // Influence: Enthusiastic, encouraging, social
    subjectLines: [
      'Great Week Ahead - You\'ve Got This!',
      'Exciting Progress on Your Business Journey!',
      'Your Weekly Guide - Let\'s Make It Amazing!',
      'Looking Forward to Your Success This Week!',
      'Awesome Things Ahead - Your Weekly Overview',
    ],
    greetings: [
      'Hey there! Great to see you!',
      'Hello! So excited to share what\'s ahead!',
      'Hi! You\'re doing awesome!',
      'Good morning! Let\'s make this week great!',
    ],
  },
  S: {
    // Steadiness: Patient, supportive, step-by-step
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
  },
  C: {
    // Conscientiousness: Detailed, formal, analytical
    subjectLines: [
      'Weekly Status Report: Your Business Tasks',
      'Comprehensive Task Overview for This Week',
      'Detailed Weekly Summary and Action Items',
      'Your Business Status: Week of [Date]',
      'Weekly Task Report and Analysis',
    ],
    greetings: [
      'Good morning. Here is your detailed task overview.',
      'Hello. Please find your comprehensive weekly summary below.',
      'Welcome to your weekly status report.',
      'Here is your detailed breakdown of upcoming tasks.',
    ],
  },
};

/**
 * Steadiness email template (legacy/default)
 * Used for all users - patient, supportive, step-by-step guidance
 */
export const EMAIL_TEMPLATE = {
  subjectLines: DISC_TEMPLATES.S.subjectLines,
  greetings: DISC_TEMPLATES.S.greetings,
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
export function getSubjectLine(index: number = 0, discType?: DISCType): string {
  const template = discType ? DISC_TEMPLATES[discType] : EMAIL_TEMPLATE;
  const subjectLines = template.subjectLines;
  return subjectLines[index % subjectLines.length]!;
}

/**
 * Get greeting
 * Returns a random greeting with optional personalization
 */
export function getGreeting(userName?: string, discType?: DISCType): string {
  const template = discType ? DISC_TEMPLATES[discType] : EMAIL_TEMPLATE;
  const greetings = template.greetings;
  const greeting = greetings[Math.floor(Math.random() * greetings.length)]!;

  if (userName) {
    // Add personalized name for Steadiness style (personal and supportive)
    return greeting.replace(/^(Hello|Hi|Good morning|Welcome|Hey there|Here\'s|Your|Focus|Let\'s)/, (match) => {
      if (match === 'Here\'s' || match === 'Your' || match === 'Focus' || match === 'Let\'s') {
        return `${userName}, ${match.toLowerCase()}`;
      }
      return `${match}, ${userName}`;
    });
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
  return closings[Math.floor(Math.random() * closings.length)]!;
}

/**
 * Get template
 */
export function getEmailTemplate() {
  return EMAIL_TEMPLATE;
}
