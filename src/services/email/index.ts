/**
 * Email Services - Public API
 *
 * Central export point for all email-related services.
 * Per D3: Weekly Email Summary Setup [MVP]
 */

// Templates
export {
  EMAIL_TEMPLATE,
  getSubjectLine,
  getGreeting,
  getSectionIntro,
  getClosing,
  getEmailTemplate,
} from './emailTemplates';

// Content Generation
export { generateEmailContent } from './emailContentGenerator';

// Rendering
export {
  renderEmailToHTML,
  renderEmailToPlainText,
  generateEmailPreviewHTML,
} from './emailRenderer';

// Preview
export {
  generateEmailPreview,
  validateEmailContent,
  getSampleChecklistItems,
} from './emailPreviewService';

// Scheduling (mocked for MVP)
export {
  scheduleEmail,
  sendEmailNow,
  cancelScheduledEmail,
  processPendingEmails,
  validateEmailAddress,
  isEmailServiceConfigured,
} from './emailSchedulingService';
