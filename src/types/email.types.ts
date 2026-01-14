/**
 * Email Notification Type Definitions for Graceful Books
 *
 * Per D3: Weekly Email Summary Setup
 * Defines types for email preferences, scheduling, and content generation.
 */

import type { ChecklistItem } from './checklist.types';

// =============================================================================
// Email Preference Types
// =============================================================================

/**
 * Days of the week for email delivery
 */
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

/**
 * Email frequency options
 */
export type EmailFrequency = 'weekly' | 'bi-weekly' | 'monthly' | 'disabled';

/**
 * Email content sections that can be toggled
 */
export type EmailContentSection =
  | 'checklist-summary'
  | 'foundation-tasks'
  | 'upcoming-deadlines'
  | 'quick-tips'
  | 'progress-update'
  | 'financial-snapshot';

/**
 * User's email notification preferences
 */
export interface EmailPreferences {
  id: string;
  userId: string;
  companyId: string;

  // Scheduling
  enabled: boolean;
  frequency: EmailFrequency;
  dayOfWeek: DayOfWeek;
  timeOfDay: string; // HH:MM format in user's timezone
  timezone: string; // IANA timezone identifier

  // Content preferences
  includeSections: EmailContentSection[];
  maxTasksToShow: number; // Default: 5

  // Delivery tracking
  lastSentAt: Date | null;
  nextScheduledAt: Date | null;

  // Unsubscribe
  unsubscribedAt: Date | null;
  unsubscribeReason: string | null;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// Email Content Types
// =============================================================================

/**
 * Subject line options for emails
 */
export interface EmailSubjectLine {
  primary: string;
  fallback: string;
}

/**
 * Generated email content
 */
export interface EmailContent {
  subject: EmailSubjectLine;
  preheader: string;
  greeting: string;
  sections: EmailSection[];
  footer: EmailFooter;
}

/**
 * Individual email section
 */
export interface EmailSection {
  type: EmailContentSection;
  title: string;
  content: string; // Can be HTML or plain text
  items?: EmailSectionItem[];
  order: number;
}

/**
 * Item within an email section
 */
export interface EmailSectionItem {
  id: string;
  title: string;
  description?: string;
  actionLink?: string;
  actionText?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Email footer content
 */
export interface EmailFooter {
  unsubscribeLink: string;
  preferencesLink: string;
  companyName: string;
  supportEmail: string;
}

// =============================================================================
// Email Generation Context
// =============================================================================

/**
 * Context data needed to generate an email
 */
export interface EmailGenerationContext {
  user: {
    id: string;
    name: string;
    email: string;
    timezone: string;
  };
  company: {
    id: string;
    name: string;
  };
  preferences: EmailPreferences;
  checklistItems: ChecklistItem[];
  generatedAt: Date;
}

// =============================================================================
// Email Templates
// =============================================================================

/**
 * Email template with Steadiness communication style
 */
export interface EmailTemplate {
  subjectLines: string[];
  greetings: string[];
  sectionIntros: Record<EmailContentSection, string>;
  closings: string[];
  toneGuidelines: {
    formality: 'casual' | 'professional' | 'formal';
    enthusiasm: 'low' | 'medium' | 'high';
    directness: 'indirect' | 'balanced' | 'direct';
    supportiveness: 'standard' | 'encouraging' | 'highly-supportive';
  };
}

// =============================================================================
// Email Delivery
// =============================================================================

/**
 * Email delivery status
 */
export type EmailDeliveryStatus =
  | 'pending'
  | 'sending'
  | 'sent'
  | 'failed'
  | 'bounced'
  | 'unsubscribed';

/**
 * Email delivery record
 */
export interface EmailDeliveryRecord {
  id: string;
  userId: string;
  companyId: string;

  // Email details
  emailType: 'weekly-summary' | 'reminder' | 'notification';
  recipientEmail: string;
  subject: string;

  // Status tracking
  status: EmailDeliveryStatus;
  scheduledAt: Date;
  sentAt: Date | null;
  deliveredAt: Date | null;
  openedAt: Date | null;
  clickedAt: Date | null;
  failedAt: Date | null;
  failureReason: string | null;

  // Retry tracking
  retryCount: number;
  maxRetries: number;
  lastRetryAt: Date | null;

  // Content reference
  contentHash: string; // For deduplication

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// Email Preview
// =============================================================================

/**
 * Email preview data for UI display
 */
export interface EmailPreview {
  subject: string;
  preheader: string;
  htmlContent: string;
  plainTextContent: string;
  estimatedSendTime: Date;
}

// =============================================================================
// Result Types
// =============================================================================

/**
 * Result of email operations
 */
export type EmailResult<T> =
  | { success: true; data: T }
  | { success: false; error: EmailError };

/**
 * Email error types
 */
export interface EmailError {
  code:
    | 'NOT_FOUND'
    | 'VALIDATION_ERROR'
    | 'GENERATION_ERROR'
    | 'DELIVERY_FAILED'
    | 'RATE_LIMITED'
    | 'UNSUBSCRIBED'
    | 'INVALID_EMAIL';
  message: string;
  details?: unknown;
}

// =============================================================================
// Input Types
// =============================================================================

/**
 * Input for creating/updating email preferences
 */
export interface EmailPreferencesInput {
  enabled?: boolean;
  frequency?: EmailFrequency;
  dayOfWeek?: DayOfWeek;
  timeOfDay?: string;
  timezone?: string;
  includeSections?: EmailContentSection[];
  maxTasksToShow?: number;
}

/**
 * Input for unsubscribing from emails
 */
export interface UnsubscribeInput {
  userId: string;
  reason?: string;
  feedback?: string;
}
