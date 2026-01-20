/**
 * IC4: Email Service Integration Types
 *
 * Defines types for the 9 email templates specified in ROADMAP.md lines 1454-1688
 * All emails are notification-only with NO financial data (per security requirements)
 */

// =============================================================================
// Email Template Types
// =============================================================================

/**
 * Email template identifiers
 */
export enum EmailTemplateType {
  ADVISOR_INVITATION = 'ADVISOR_INVITATION',
  CLIENT_BILLING_TRANSFER = 'CLIENT_BILLING_TRANSFER',
  ADVISOR_REMOVED_CLIENT = 'ADVISOR_REMOVED_CLIENT',
  SCENARIO_PUSHED = 'SCENARIO_PUSHED',
  TAX_SEASON_ACCESS = 'TAX_SEASON_ACCESS',
  TAX_PREP_COMPLETION = 'TAX_PREP_COMPLETION',
  WELCOME = 'WELCOME',
  PASSWORD_RESET = 'PASSWORD_RESET',
  EMAIL_VERIFICATION = 'EMAIL_VERIFICATION',
}

/**
 * Email delivery status
 */
export enum EmailDeliveryStatus {
  QUEUED = 'QUEUED',
  SENDING = 'SENDING',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  BOUNCED = 'BOUNCED',
  FAILED = 'FAILED',
  UNSUBSCRIBED = 'UNSUBSCRIBED',
}

/**
 * Email priority level
 */
export enum EmailPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

// =============================================================================
// Template Variable Types
// =============================================================================

/**
 * Variables for Template 1: Advisor Invitation
 */
export interface AdvisorInvitationVariables {
  clientFirstName: string;
  advisorName: string;
  advisorFirm: string;
  invitationUrl: string;
}

/**
 * Variables for Template 2: Client Billing Transfer
 */
export interface ClientBillingTransferVariables {
  clientFirstName: string;
  advisorName: string;
  accountUrl: string;
  advisorEmail: string;
}

/**
 * Variables for Template 3: Advisor Removed Client
 */
export interface AdvisorRemovedClientVariables {
  clientFirstName: string;
  advisorName: string;
  billingChoiceUrl: string;
}

/**
 * Variables for Template 4: Scenario Pushed to Client
 */
export interface ScenarioPushedVariables {
  clientFirstName: string;
  advisorName: string;
  scenarioName: string;
  advisorNote: string;
  scenarioUrl: string;
}

/**
 * Variables for Template 5: Tax Season Access Granted
 */
export interface TaxSeasonAccessVariables {
  clientFirstName: string;
  advisorName: string;
  taxYear: string;
  accessExpiresDate: string;
  taxPrepUrl: string;
  advisorEmail: string;
}

/**
 * Variables for Template 6: Tax Prep Completion
 */
export interface TaxPrepCompletionVariables {
  firstName: string;
  taxYear: string;
  downloadUrl: string;
}

/**
 * Variables for Template 7: Welcome Email
 */
export interface WelcomeEmailVariables {
  firstName: string;
  dashboardUrl: string;
  charityName: string;
}

/**
 * Variables for Template 8: Password Reset
 */
export interface PasswordResetVariables {
  firstName: string;
  resetUrl: string;
}

/**
 * Variables for Template 9: Email Verification
 */
export interface EmailVerificationVariables {
  firstName: string;
  verificationUrl: string;
}

/**
 * Union type for all template variables
 */
export type EmailTemplateVariables =
  | AdvisorInvitationVariables
  | ClientBillingTransferVariables
  | AdvisorRemovedClientVariables
  | ScenarioPushedVariables
  | TaxSeasonAccessVariables
  | TaxPrepCompletionVariables
  | WelcomeEmailVariables
  | PasswordResetVariables
  | EmailVerificationVariables;

// =============================================================================
// Email Content Types
// =============================================================================

/**
 * Rendered email content (HTML + plain text)
 */
export interface EmailContent {
  html: string;
  plainText: string;
  subject: string;
  preheader?: string;
}

/**
 * Email template definition
 */
export interface EmailTemplate {
  type: EmailTemplateType;
  subject: string;
  preheader?: string;
  htmlBody: string;
  plainTextBody: string;
  requiredVariables: string[];
  allowUnsubscribe: boolean; // False for critical emails (password reset, verification)
}

// =============================================================================
// Email Queue Types
// =============================================================================

/**
 * Email queue entry
 */
export interface EmailQueueEntry {
  id: string;
  companyId: string;
  userId: string;

  // Recipient
  recipientEmail: string;
  recipientName: string;

  // Template
  templateType: EmailTemplateType;
  variables: Record<string, string>;

  // Delivery
  status: EmailDeliveryStatus;
  priority: EmailPriority;
  scheduledAt: Date;
  sentAt: Date | null;
  deliveredAt: Date | null;
  failedAt: Date | null;

  // Retry logic
  retryCount: number;
  maxRetries: number;
  lastRetryAt: Date | null;
  nextRetryAt: Date | null;

  // Error tracking
  errorMessage: string | null;
  providerMessageId: string | null;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Email log entry (for tracking all email sends)
 */
export interface EmailLog {
  id: string;
  companyId: string;
  userId: string;

  // Email details
  templateType: EmailTemplateType;
  recipientEmail: string;
  subject: string;

  // Status
  status: EmailDeliveryStatus;
  sentAt: Date | null;
  deliveredAt: Date | null;
  openedAt: Date | null;
  clickedAt: Date | null;
  bouncedAt: Date | null;
  failedAt: Date | null;

  // Provider tracking
  providerMessageId: string | null;
  providerResponse: string | null;

  // Error tracking
  errorMessage: string | null;
  retryCount: number;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// Email Service Configuration
// =============================================================================

/**
 * Email service provider
 */
export enum EmailProvider {
  RESEND = 'RESEND',
  SENDGRID = 'SENDGRID',
  TEST = 'TEST', // For development/testing
}

/**
 * Email service configuration
 */
export interface EmailServiceConfig {
  provider: EmailProvider;
  apiKey: string;
  fromEmail: string;
  fromName: string;
  replyToEmail?: string;
  testMode: boolean;

  // Rate limiting
  maxEmailsPerMinute: number;
  maxEmailsPerHour: number;

  // Retry configuration
  defaultMaxRetries: number;
  retryDelayMinutes: number[]; // [1, 5, 15] for exponential backoff
}

// =============================================================================
// Email Service Response Types
// =============================================================================

/**
 * Result of sending an email
 */
export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: EmailServiceError;
}

/**
 * Email service error
 */
export interface EmailServiceError {
  code: EmailErrorCode;
  message: string;
  details?: unknown;
  retryable: boolean;
}

/**
 * Email error codes
 */
export enum EmailErrorCode {
  INVALID_EMAIL = 'INVALID_EMAIL',
  INVALID_TEMPLATE = 'INVALID_TEMPLATE',
  MISSING_VARIABLES = 'MISSING_VARIABLES',
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  RATE_LIMITED = 'RATE_LIMITED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNSUBSCRIBED = 'UNSUBSCRIBED',
  BOUNCED = 'BOUNCED',
  SPAM_REPORTED = 'SPAM_REPORTED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

// =============================================================================
// Webhook Types
// =============================================================================

/**
 * Email delivery event (from provider webhook)
 */
export interface EmailDeliveryEvent {
  messageId: string;
  event: 'delivered' | 'bounced' | 'opened' | 'clicked' | 'spam_report' | 'unsubscribed';
  timestamp: Date;
  recipientEmail: string;
  metadata?: Record<string, unknown>;
}

/**
 * Webhook payload (provider-specific)
 */
export interface WebhookPayload {
  provider: EmailProvider;
  rawPayload: unknown;
  events: EmailDeliveryEvent[];
}

// =============================================================================
// Email Preferences Types
// =============================================================================

/**
 * User email notification preferences
 */
export interface EmailNotificationPreferences {
  id: string;
  userId: string;
  companyId: string;

  // Per-template preferences
  advisorInvitation: boolean;
  clientBillingTransfer: boolean;
  advisorRemovedClient: boolean;
  scenarioPushed: boolean;
  taxSeasonAccess: boolean;
  taxPrepCompletion: boolean;

  // Critical emails (cannot be disabled)
  // - welcome
  // - passwordReset
  // - emailVerification

  // Global unsubscribe
  unsubscribedAt: Date | null;
  unsubscribeReason: string | null;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// Email Analytics Types
// =============================================================================

/**
 * Email analytics summary
 */
export interface EmailAnalytics {
  templateType: EmailTemplateType;
  period: 'day' | 'week' | 'month' | 'all';

  // Counts
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  failed: number;
  unsubscribed: number;

  // Rates
  deliveryRate: number; // delivered / sent
  openRate: number; // opened / delivered
  clickRate: number; // clicked / delivered
  bounceRate: number; // bounced / sent

  // Response times
  avgDeliveryTimeMs: number;
  avgOpenTimeMinutes: number;
}
