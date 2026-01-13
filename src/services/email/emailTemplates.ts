/**
 * DISC-Adapted Email Templates
 *
 * Per D3: Weekly Email Summary Setup
 * Provides email templates adapted for each DISC personality type.
 */

import type { DISCType } from '../../features/messaging/messageLibrary';
import type { EmailTemplate, EmailContentSection } from '../../types/email.types';

/**
 * DISC-adapted email templates
 * Each template is optimized for a specific personality type
 */
export const DISC_EMAIL_TEMPLATES: Record<DISCType, EmailTemplate> = {
  /**
   * Dominance (D) - Direct, Results-Oriented
   * Focus: Efficiency, outcomes, quick wins
   */
  D: {
    discType: 'D',
    subjectLines: [
      'Your Week Ahead: Action Items Ready',
      'This Week\'s Priorities - Get It Done',
      'Weekly Focus: Key Tasks Identified',
      'Your Action Plan for the Week',
      'Quick Check: Week\'s Deliverables',
    ],
    greetings: [
      'Let\'s get right to it.',
      'Here\'s what needs your attention this week.',
      'Your priorities for the week ahead:',
      'Time to tackle your key tasks.',
    ],
    sectionIntros: {
      'checklist-summary': 'Outstanding items requiring your attention:',
      'foundation-tasks': 'Core tasks to complete:',
      'upcoming-deadlines': 'Deadlines approaching:',
      'quick-tips': 'Efficiency tip:',
      'progress-update': 'Progress snapshot:',
      'financial-snapshot': 'Financial status at a glance:',
    },
    closings: [
      'Stay focused on what matters.',
      'Make it count this week.',
      'You\'ve got this. Now execute.',
      'Time to make progress.',
    ],
    toneGuidelines: {
      formality: 'professional',
      enthusiasm: 'low',
      directness: 'direct',
      supportiveness: 'standard',
    },
  },

  /**
   * Influence (I) - Enthusiastic, People-Oriented
   * Focus: Collaboration, energy, celebration
   */
  I: {
    discType: 'I',
    subjectLines: [
      'Your Week Ahead: Let\'s Make Magic Happen!',
      'Exciting Updates - Your Tasks Await!',
      'This Week\'s Adventures in Your Business',
      'Ready to Shine? Here\'s Your Weekly Guide',
      'Your Week Ahead: Small Steps, Big Progress!',
    ],
    greetings: [
      'Hey there! Ready for an awesome week?',
      'Hello! Let\'s dive into what\'s ahead together.',
      'Great to connect with you! Here\'s what\'s coming up.',
      'Welcome to your weekly check-in - let\'s make it great!',
    ],
    sectionIntros: {
      'checklist-summary': 'Let\'s celebrate what you\'ve done and see what\'s next:',
      'foundation-tasks': 'Building blocks for your success:',
      'upcoming-deadlines': 'Keep these on your radar:',
      'quick-tips': 'Fun tip to brighten your week:',
      'progress-update': 'Look at you go! Here\'s your progress:',
      'financial-snapshot': 'Your financial story this week:',
    },
    closings: [
      'You\'re doing amazing - keep that momentum going!',
      'Have a fantastic week ahead!',
      'Cheering you on every step of the way!',
      'Let\'s make this week incredible together!',
    ],
    toneGuidelines: {
      formality: 'casual',
      enthusiasm: 'high',
      directness: 'balanced',
      supportiveness: 'highly-supportive',
    },
  },

  /**
   * Steadiness (S) - Patient, Supportive
   * Focus: Consistency, reassurance, step-by-step guidance
   */
  S: {
    discType: 'S',
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
      formality: 'professional',
      enthusiasm: 'medium',
      directness: 'indirect',
      supportiveness: 'highly-supportive',
    },
  },

  /**
   * Conscientiousness (C) - Detail-Oriented, Analytical
   * Focus: Accuracy, completeness, quality
   */
  C: {
    discType: 'C',
    subjectLines: [
      'Weekly Report: Tasks and Status Overview',
      'Your Detailed Weekly Summary',
      'Comprehensive Task Review for the Week',
      'Weekly Status: Complete Task Breakdown',
      'Detailed Overview: Week Ahead',
    ],
    greetings: [
      'Here is your detailed weekly summary.',
      'Your comprehensive task overview is ready for review.',
      'The following report outlines your tasks for the upcoming week.',
      'Please find below a complete breakdown of your weekly items.',
    ],
    sectionIntros: {
      'checklist-summary': 'Current status of all outstanding items:',
      'foundation-tasks': 'Critical foundation tasks requiring completion:',
      'upcoming-deadlines': 'Scheduled deadlines with dates:',
      'quick-tips': 'Technical insight for improved accuracy:',
      'progress-update': 'Detailed progress metrics:',
      'financial-snapshot': 'Comprehensive financial data summary:',
    },
    closings: [
      'All information is accurate as of the send time noted above.',
      'Please review and proceed with due diligence.',
      'Detailed records available in your dashboard.',
      'Thank you for maintaining accurate records.',
    ],
    toneGuidelines: {
      formality: 'formal',
      enthusiasm: 'low',
      directness: 'direct',
      supportiveness: 'standard',
    },
  },
};

/**
 * Get subject line for DISC type
 * Returns the primary subject line for a given DISC type
 */
export function getSubjectLine(discType: DISCType, index: number = 0): string {
  const template = DISC_EMAIL_TEMPLATES[discType];
  const subjectLines = template.subjectLines;
  return subjectLines[index % subjectLines.length];
}

/**
 * Get greeting for DISC type
 * Returns a random greeting appropriate for the DISC type
 */
export function getGreeting(discType: DISCType, userName?: string): string {
  const template = DISC_EMAIL_TEMPLATES[discType];
  const greetings = template.greetings;
  const greeting = greetings[Math.floor(Math.random() * greetings.length)];

  if (userName) {
    // Add personalized name for I and S types (more personal)
    if (discType === 'I' || discType === 'S') {
      return greeting.replace(/^(Hey|Hello|Hi|Good morning|Welcome)/, `$1, ${userName}`);
    }
  }

  return greeting;
}

/**
 * Get section intro for DISC type
 */
export function getSectionIntro(discType: DISCType, section: EmailContentSection): string {
  const template = DISC_EMAIL_TEMPLATES[discType];
  return template.sectionIntros[section] || '';
}

/**
 * Get closing for DISC type
 * Returns a random closing appropriate for the DISC type
 */
export function getClosing(discType: DISCType): string {
  const template = DISC_EMAIL_TEMPLATES[discType];
  const closings = template.closings;
  return closings[Math.floor(Math.random() * closings.length)];
}

/**
 * Get template for DISC type
 */
export function getEmailTemplate(discType: DISCType): EmailTemplate {
  return DISC_EMAIL_TEMPLATES[discType];
}

/**
 * Get all available DISC types
 */
export function getAllDISCTypes(): DISCType[] {
  return Object.keys(DISC_EMAIL_TEMPLATES) as DISCType[];
}
