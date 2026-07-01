/**
 * Email Template Utilities
 *
 * Shared email template types, defaults, and helper constants for workshop emails.
 * Used by EmailTemplateEditor, EmailPreviewPanel, and WorkshopFormPage.
 */

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface EmailTemplate {
  subject: string;
  preheader?: string;
  htmlBody: string;
  plainTextBody?: string;
  fromName?: string;
}

export interface EmailTemplates {
  welcome?: EmailTemplate;
  reminder?: EmailTemplate;
  week1?: EmailTemplate;
  week2?: EmailTemplate;
  week3?: EmailTemplate;
  week4?: EmailTemplate;
  wrapUp?: EmailTemplate;
}

export type EmailType = 'welcome' | 'reminder' | 'week1' | 'week2' | 'week3' | 'week4' | 'wrapUp';

// =============================================================================
// DEFAULT EMAIL TEMPLATES
// =============================================================================

export const DEFAULT_EMAIL_TEMPLATES: Record<EmailType, EmailTemplate> = {
  welcome: {
    subject: 'Welcome to {{workshopName}}!',
    preheader: "We're excited to have you join us",
    htmlBody: '<p>Hi {{firstName}},</p><p>Welcome to {{workshopName}}! We\'re so glad you\'re here.</p><p>Your workshop begins on {{workshopDate}} at {{workshopTime}}.</p><p>See you soon!</p>',
  },
  reminder: {
    subject: 'Workshop starts tomorrow!',
    preheader: "Don't forget about {{workshopName}}",
    htmlBody: '<p>Hi {{firstName}},</p><p>Just a friendly reminder that {{workshopName}} starts tomorrow at {{workshopTime}}.</p><p>Location: {{workshopLocation}}</p><p>See you there!</p>',
  },
  week1: {
    subject: 'Week 1: Getting Started',
    preheader: 'Your first week journey begins',
    htmlBody: '<p>Hi {{firstName}},</p><p>Welcome to Week 1 of your journey!</p><p>This week, focus on getting familiar with the platform.</p>',
  },
  week2: {
    subject: 'Week 2: Building Momentum',
    preheader: "You're making great progress",
    htmlBody: '<p>Hi {{firstName}},</p><p>Week 2 is all about building momentum!</p><p>Keep up the great work.</p>',
  },
  week3: {
    subject: 'Week 3: Going Deeper',
    preheader: 'Time to dive into advanced features',
    htmlBody: '<p>Hi {{firstName}},</p><p>This week, we\'re diving deeper into the platform.</p><p>Explore the advanced features!</p>',
  },
  week4: {
    subject: 'Week 4: Mastering the Basics',
    preheader: "You've come so far",
    htmlBody: '<p>Hi {{firstName}},</p><p>Week 4 - you\'re becoming a pro!</p><p>Let\'s master these fundamentals.</p>',
  },
  wrapUp: {
    subject: "You've completed the journey!",
    preheader: 'Congratulations on your achievement',
    htmlBody: '<p>Hi {{firstName}},</p><p>Congratulations on completing {{workshopName}}!</p><p>We hope you found it valuable.</p><p>Keep up the great work!</p>',
  },
};

// =============================================================================
// EMAIL TYPE LABELS (for UI display)
// =============================================================================

export const EMAIL_TYPE_LABELS: Record<EmailType, string> = {
  welcome: 'Welcome Email',
  reminder: 'Pre-Workshop Reminder',
  week1: 'Week 1 Email',
  week2: 'Week 2 Email',
  week3: 'Week 3 Email',
  week4: 'Week 4 Email',
  wrapUp: 'Wrap-Up Email',
};

// =============================================================================
// TEMPLATE TAGS (for autocomplete/reference)
// =============================================================================

export interface TemplateTag {
  tag: string;
  description: string;
}

export const TEMPLATE_TAGS: TemplateTag[] = [
  { tag: '{{firstName}}', description: "Recipient's first name" },
  { tag: '{{fullName}}', description: "Recipient's full name" },
  { tag: '{{workshopName}}', description: 'Workshop cohort name' },
  { tag: '{{workshopDate}}', description: 'Workshop start date' },
  { tag: '{{workshopTime}}', description: 'Workshop start time' },
  { tag: '{{workshopLocation}}', description: 'Workshop location/URL' },
  { tag: '{{trialEndDate}}', description: 'Trial expiration date' },
  { tag: '{{trialDaysRemaining}}', description: 'Days until trial expires' },
];

// =============================================================================
// ALL EMAIL TYPES (for iteration)
// =============================================================================

export const ALL_EMAIL_TYPES: EmailType[] = [
  'welcome',
  'reminder',
  'week1',
  'week2',
  'week3',
  'week4',
  'wrapUp',
];
