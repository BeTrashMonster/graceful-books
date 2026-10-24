/**
 * Email Storage Service
 *
 * Handles storing sent emails and checking suppression lists.
 * This enables support staff to see exactly what emails users received.
 */

import { query } from '../db/connection.js';

// =============================================================================
// TYPES
// =============================================================================

export interface StoreSentEmailParams {
  userId: string;
  recipientEmail: string;
  emailType: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  workshopId?: string;
  workshopEnrollmentId?: string;
  triggeredBy?: 'system' | 'cron' | 'webhook' | 'manual' | 'admin';
  triggeredByAdminId?: string;
  deliveryStatus?: string;
  deliveryProvider?: string;
  providerMessageId?: string;
}

export interface SuppressionCheckResult {
  isSuppressed: boolean;
  suppressionType?: string;
  reason?: string;
}

// =============================================================================
// SUPPRESSION CHECKING
// =============================================================================

/**
 * Check if an email address is suppressed
 * @param email - Email address to check
 * @param emailType - Optional: specific email type to check (empty = check all)
 * @returns Suppression status and reason
 */
export async function checkSuppression(
  email: string,
  emailType?: string
): Promise<SuppressionCheckResult> {
  try {
    // Check for active suppression (reactivated_at IS NULL)
    const result = await query(
      `SELECT suppression_type, suppression_reason, email_types
       FROM email_suppressions
       WHERE email = $1
         AND reactivated_at IS NULL
       LIMIT 1`,
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return { isSuppressed: false };
    }

    const suppression = result.rows[0];
    const suppressedTypes: string[] = suppression.email_types || [];

    // If email_types is empty, all emails are suppressed
    // If email_types has values, only those types are suppressed
    if (suppressedTypes.length === 0 || (emailType && suppressedTypes.includes(emailType))) {
      return {
        isSuppressed: true,
        suppressionType: suppression.suppression_type,
        reason: suppression.suppression_reason,
      };
    }

    return { isSuppressed: false };
  } catch (error) {
    console.error('[EmailStorage] Error checking suppression:', error);
    // Fail open - don't block emails if suppression check fails
    return { isSuppressed: false };
  }
}

// =============================================================================
// EMAIL STORAGE
// =============================================================================

/**
 * Store a sent email record for support diagnostics
 * @param params - Email details to store
 * @returns The ID of the stored email record
 */
export async function storeSentEmail(params: StoreSentEmailParams): Promise<string | null> {
  try {
    const result = await query(
      `INSERT INTO sent_emails (
        user_id, recipient_email, email_type, subject, html_content, text_content,
        workshop_id, workshop_enrollment_id,
        triggered_by, triggered_by_admin_id,
        delivery_status, delivery_provider, provider_message_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id`,
      [
        params.userId,
        params.recipientEmail.toLowerCase(),
        params.emailType,
        params.subject,
        params.htmlContent,
        params.textContent || null,
        params.workshopId || null,
        params.workshopEnrollmentId || null,
        params.triggeredBy || 'system',
        params.triggeredByAdminId || null,
        params.deliveryStatus || 'sent',
        params.deliveryProvider || 'postmark',
        params.providerMessageId || null,
      ]
    );

    return result.rows[0]?.id || null;
  } catch (error) {
    console.error('[EmailStorage] Error storing sent email:', error);
    // Don't fail the email send if storage fails
    return null;
  }
}

/**
 * Update delivery status for a sent email (called by webhook)
 * @param providerMessageId - Message ID from email provider
 * @param status - New delivery status
 * @param bounceType - Optional bounce type for bounced emails
 * @param bounceReason - Optional bounce reason
 */
export async function updateDeliveryStatus(
  providerMessageId: string,
  status: string,
  bounceType?: string,
  bounceReason?: string
): Promise<void> {
  try {
    await query(
      `UPDATE sent_emails
       SET
         delivery_status = $1,
         delivery_status_updated_at = NOW(),
         bounce_type = COALESCE($2, bounce_type),
         bounce_reason = COALESCE($3, bounce_reason),
         opened_at = CASE WHEN $1 = 'opened' AND opened_at IS NULL THEN NOW() ELSE opened_at END,
         open_count = CASE WHEN $1 = 'opened' THEN open_count + 1 ELSE open_count END,
         clicked_at = CASE WHEN $1 = 'clicked' AND clicked_at IS NULL THEN NOW() ELSE clicked_at END,
         click_count = CASE WHEN $1 = 'clicked' THEN click_count + 1 ELSE click_count END
       WHERE provider_message_id = $4`,
      [status, bounceType || null, bounceReason || null, providerMessageId]
    );
  } catch (error) {
    console.error('[EmailStorage] Error updating delivery status:', error);
  }
}

// =============================================================================
// SUPPRESSION MANAGEMENT
// =============================================================================

/**
 * Add an email to the suppression list
 * @param email - Email address to suppress
 * @param type - Suppression type
 * @param reason - Reason for suppression
 * @param sourceEmailId - Optional: ID of email that caused suppression
 * @param sourceProvider - Optional: Provider that reported the issue
 * @param sourceEventId - Optional: Provider's event ID
 */
export async function addToSuppressionList(
  email: string,
  type: 'unsubscribed' | 'hard_bounce' | 'soft_bounce' | 'spam_complaint' | 'manual',
  reason?: string,
  sourceEmailId?: string,
  sourceProvider?: string,
  sourceEventId?: string
): Promise<void> {
  try {
    // First, check if there's an existing active suppression
    const existing = await query(
      `SELECT id FROM email_suppressions
       WHERE email = $1 AND reactivated_at IS NULL`,
      [email.toLowerCase()]
    );

    if (existing.rows.length > 0) {
      // Already suppressed, update the reason if it's a "worse" type
      const typeOrder = ['manual', 'soft_bounce', 'unsubscribed', 'hard_bounce', 'spam_complaint'];
      await query(
        `UPDATE email_suppressions
         SET suppression_type = CASE
           WHEN array_position($2::text[], suppression_type) < array_position($2::text[], $3) THEN $3
           ELSE suppression_type
         END,
         suppression_reason = COALESCE($4, suppression_reason)
         WHERE id = $5`,
        [email.toLowerCase(), typeOrder, type, reason, existing.rows[0].id]
      );
      return;
    }

    // Insert new suppression
    await query(
      `INSERT INTO email_suppressions (
        email, user_id, suppression_type, suppression_reason,
        source_email_id, source_provider, source_event_id
      ) VALUES (
        $1,
        (SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1),
        $2, $3, $4, $5, $6
      )`,
      [
        email.toLowerCase(),
        type,
        reason || null,
        sourceEmailId || null,
        sourceProvider || null,
        sourceEventId || null,
      ]
    );

    console.log(`[EmailStorage] Added ${email} to suppression list: ${type}`);
  } catch (error) {
    console.error('[EmailStorage] Error adding to suppression list:', error);
  }
}

/**
 * Remove an email from the suppression list (reactivate)
 * @param email - Email address to reactivate
 * @param adminId - Admin who reactivated
 * @param reason - Reason for reactivation
 */
export async function removeFromSuppressionList(
  email: string,
  adminId: string,
  reason?: string
): Promise<void> {
  try {
    await query(
      `UPDATE email_suppressions
       SET reactivated_at = NOW(),
           reactivated_by_admin_id = $1,
           reactivation_reason = $2
       WHERE email = $3 AND reactivated_at IS NULL`,
      [adminId, reason || null, email.toLowerCase()]
    );

    console.log(`[EmailStorage] Removed ${email} from suppression list`);
  } catch (error) {
    console.error('[EmailStorage] Error removing from suppression list:', error);
  }
}

/**
 * Link a scheduled email to its sent_emails record after sending
 * @param scheduledEmailId - ID of the scheduled email
 * @param sentEmailId - ID of the sent_emails record
 */
export async function linkScheduledToSent(
  scheduledEmailId: string,
  sentEmailId: string
): Promise<void> {
  try {
    await query(
      `UPDATE scheduled_emails SET sent_email_id = $1 WHERE id = $2`,
      [sentEmailId, scheduledEmailId]
    );
  } catch (error) {
    console.error('[EmailStorage] Error linking scheduled to sent:', error);
  }
}
