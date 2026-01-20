/**
 * IC4: Email Queue and Logs Schema
 *
 * Database schema for email queue, logs, and delivery tracking
 */

import type {
  EmailTemplateType,
  EmailDeliveryStatus,
  EmailPriority,
} from '../../types/ic4-email.types';

/**
 * Email queue entry (for sending emails)
 */
export interface EmailQueueEntity {
  id: string;
  companyId: string;
  userId: string;

  // Recipient
  recipientEmail: string;
  recipientName: string;

  // Template
  templateType: EmailTemplateType;
  variables: string; // JSON string of variables

  // Delivery
  status: EmailDeliveryStatus;
  priority: EmailPriority;
  scheduledAt: number; // Unix timestamp
  sentAt: number | null;
  deliveredAt: number | null;
  failedAt: number | null;

  // Retry logic
  retryCount: number;
  maxRetries: number;
  lastRetryAt: number | null;
  nextRetryAt: number | null;

  // Error tracking
  errorMessage: string | null;
  providerMessageId: string | null;

  // Metadata
  createdAt: number;
  updatedAt: number;

  // Sync metadata (CRDT)
  _hlc: string; // Hybrid Logical Clock
  _deviceId: string;
  _version: number;
  _deleted: boolean;
}

/**
 * Email log entry (historical record of all emails)
 */
export interface EmailLogEntity {
  id: string;
  companyId: string;
  userId: string;

  // Email details
  templateType: EmailTemplateType;
  recipientEmail: string;
  subject: string;

  // Status
  status: EmailDeliveryStatus;
  sentAt: number | null;
  deliveredAt: number | null;
  openedAt: number | null;
  clickedAt: number | null;
  bouncedAt: number | null;
  failedAt: number | null;

  // Provider tracking
  providerMessageId: string | null;
  providerResponse: string | null; // JSON string

  // Error tracking
  errorMessage: string | null;
  retryCount: number;

  // Metadata
  createdAt: number;
  updatedAt: number;

  // Sync metadata (CRDT)
  _hlc: string;
  _deviceId: string;
  _version: number;
  _deleted: boolean;
}

/**
 * Email notification preferences (per-user)
 */
export interface EmailNotificationPreferencesEntity {
  id: string;
  userId: string;
  companyId: string;

  // Per-template preferences (boolean flags)
  advisorInvitation: boolean;
  clientBillingTransfer: boolean;
  advisorRemovedClient: boolean;
  scenarioPushed: boolean;
  taxSeasonAccess: boolean;
  taxPrepCompletion: boolean;

  // Critical emails cannot be disabled:
  // - welcome
  // - passwordReset
  // - emailVerification

  // Global unsubscribe
  unsubscribedAt: number | null;
  unsubscribeReason: string | null;

  // Metadata
  createdAt: number;
  updatedAt: number;

  // Sync metadata (CRDT)
  _hlc: string;
  _deviceId: string;
  _version: number;
  _deleted: boolean;
}

/**
 * Email queue schema definition
 */
export const emailQueueSchema = `
  id,
  companyId,
  userId,
  recipientEmail,
  recipientName,
  templateType,
  variables,
  status,
  priority,
  scheduledAt,
  sentAt,
  deliveredAt,
  failedAt,
  retryCount,
  maxRetries,
  lastRetryAt,
  nextRetryAt,
  errorMessage,
  providerMessageId,
  createdAt,
  updatedAt,
  _hlc,
  _deviceId,
  _version,
  _deleted
`;

/**
 * Email logs schema definition
 */
export const emailLogsSchema = `
  id,
  companyId,
  userId,
  templateType,
  recipientEmail,
  subject,
  status,
  sentAt,
  deliveredAt,
  openedAt,
  clickedAt,
  bouncedAt,
  failedAt,
  providerMessageId,
  providerResponse,
  errorMessage,
  retryCount,
  createdAt,
  updatedAt,
  _hlc,
  _deviceId,
  _version,
  _deleted
`;

/**
 * Email notification preferences schema definition
 */
export const emailNotificationPreferencesSchema = `
  id,
  userId,
  companyId,
  advisorInvitation,
  clientBillingTransfer,
  advisorRemovedClient,
  scenarioPushed,
  taxSeasonAccess,
  taxPrepCompletion,
  unsubscribedAt,
  unsubscribeReason,
  createdAt,
  updatedAt,
  _hlc,
  _deviceId,
  _version,
  _deleted
`;
