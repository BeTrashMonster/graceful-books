/**
 * IC4: Email Queue Processor
 *
 * Processes queued emails with retry logic and exponential backoff
 * Runs in background to ensure reliable email delivery
 */

import { logger } from './logger';
import { db } from '../store/database';
import { emailService } from '../services/email/email.service';
import { EmailDeliveryStatus, EmailPriority } from '../types/ic4-email.types';
import type { EmailQueueEntity } from '../db/schema/emailQueue.schema';

const log = logger.child('EmailQueue');

/**
 * Email queue processor
 */
export class EmailQueueProcessor {
  private isRunning = false;
  private intervalId: number | null = null;
  private readonly processingIntervalMs = 30000; // 30 seconds

  /**
   * Start processing the email queue
   */
  start(): void {
    if (this.isRunning) {
      log.warn('Email queue processor already running');
      return;
    }

    this.isRunning = true;
    log.info('Starting email queue processor');

    // Process immediately on start
    this.processQueue().catch((error) => {
      log.error('Error processing queue on start', { error });
    });

    // Then process every 30 seconds
    this.intervalId = window.setInterval(() => {
      this.processQueue().catch((error) => {
        log.error('Error processing queue', { error });
      });
    }, this.processingIntervalMs);
  }

  /**
   * Stop processing the email queue
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    log.info('Stopped email queue processor');
  }

  /**
   * Process all pending emails in the queue
   */
  private async processQueue(): Promise<void> {
    try {
      const now = Date.now();

      // Get emails ready to send (queued or ready for retry)
      const pendingEmails = await db.emailQueue
        .where('status')
        .anyOf([
          EmailDeliveryStatus.QUEUED,
          EmailDeliveryStatus.FAILED, // For retries
        ])
        .filter((email) => {
          // Check if scheduled time has passed
          if (email.scheduledAt > now) {
            return false;
          }

          // Check if ready for retry
          if (email.status === EmailDeliveryStatus.FAILED) {
            if (!email.nextRetryAt || email.nextRetryAt > now) {
              return false;
            }
          }

          return true;
        })
        .sortBy('priority');

      // Sort by priority (URGENT > HIGH > NORMAL > LOW)
      const sortedEmails = this.sortByPriority(pendingEmails);

      log.info(`Processing ${sortedEmails.length} pending emails`);

      // Process each email
      for (const email of sortedEmails) {
        await this.processEmail(email);
      }
    } catch (error) {
      log.error('Error processing queue', { error });
    }
  }

  /**
   * Process a single email
   */
  private async processEmail(email: EmailQueueEntity): Promise<void> {
    try {
      log.info('Processing email', {
        id: email.id,
        templateType: email.templateType,
        recipientEmail: email.recipientEmail,
        retryCount: email.retryCount,
      });

      // Update status to SENDING
      await db.emailQueue.update(email.id, {
        status: EmailDeliveryStatus.SENDING,
        updatedAt: Date.now(),
      });

      // Parse variables
      const variables = JSON.parse(email.variables);

      // Send email
      const result = await emailService.sendEmail({
        companyId: email.companyId,
        userId: email.userId,
        recipientEmail: email.recipientEmail,
        recipientName: email.recipientName,
        templateType: email.templateType,
        variables,
        priority: email.priority as EmailPriority,
      });

      if (result.success) {
        // Success: Update to SENT
        await db.emailQueue.update(email.id, {
          status: EmailDeliveryStatus.SENT,
          sentAt: Date.now(),
          providerMessageId: result.messageId || null,
          updatedAt: Date.now(),
        });

        log.info('Email sent successfully', {
          id: email.id,
          messageId: result.messageId,
        });
      } else {
        // Failed: Check if we should retry
        const shouldRetry =
          result.error?.retryable &&
          email.retryCount < email.maxRetries;

        if (shouldRetry) {
          const nextRetryAt = this.calculateNextRetry(email.retryCount + 1);

          await db.emailQueue.update(email.id, {
            status: EmailDeliveryStatus.FAILED,
            retryCount: email.retryCount + 1,
            lastRetryAt: Date.now(),
            nextRetryAt,
            errorMessage: result.error?.message || 'Unknown error',
            updatedAt: Date.now(),
          });

          log.warn('Email failed, will retry', {
            id: email.id,
            retryCount: email.retryCount + 1,
            nextRetryAt: new Date(nextRetryAt),
            error: result.error?.message,
          });
        } else {
          // Max retries reached or non-retryable error
          await db.emailQueue.update(email.id, {
            status: EmailDeliveryStatus.FAILED,
            failedAt: Date.now(),
            errorMessage: result.error?.message || 'Unknown error',
            updatedAt: Date.now(),
          });

          log.error('Email failed permanently', {
            id: email.id,
            error: result.error?.message,
            retryCount: email.retryCount,
          });
        }
      }
    } catch (error) {
      log.error('Error processing email', { error, emailId: email.id });

      // Update to failed
      await db.emailQueue.update(email.id, {
        status: EmailDeliveryStatus.FAILED,
        failedAt: Date.now(),
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        updatedAt: Date.now(),
      });
    }
  }

  /**
   * Calculate next retry time with exponential backoff
   * Retry delays: 1 minute, 5 minutes, 15 minutes
   */
  private calculateNextRetry(retryCount: number): number {
    const delays = [1, 5, 15]; // minutes
    const delayMinutes = delays[Math.min(retryCount - 1, delays.length - 1)];
    return Date.now() + delayMinutes * 60 * 1000;
  }

  /**
   * Sort emails by priority
   */
  private sortByPriority(emails: EmailQueueEntity[]): EmailQueueEntity[] {
    const priorityOrder: Record<EmailPriority, number> = {
      URGENT: 0,
      HIGH: 1,
      NORMAL: 2,
      LOW: 3,
    };

    return emails.sort((a, b) => {
      const aPriority = priorityOrder[a.priority as EmailPriority] ?? 2;
      const bPriority = priorityOrder[b.priority as EmailPriority] ?? 2;
      return aPriority - bPriority;
    });
  }

  /**
   * Get queue status
   */
  async getQueueStatus(): Promise<{
    queued: number;
    sending: number;
    failed: number;
    total: number;
  }> {
    const all = await db.emailQueue.toArray();

    return {
      queued: all.filter((e) => e.status === EmailDeliveryStatus.QUEUED).length,
      sending: all.filter((e) => e.status === EmailDeliveryStatus.SENDING)
        .length,
      failed: all.filter((e) => e.status === EmailDeliveryStatus.FAILED).length,
      total: all.length,
    };
  }

  /**
   * Retry all failed emails immediately
   */
  async retryFailedEmails(): Promise<number> {
    const failedEmails = await db.emailQueue
      .where('status')
      .equals(EmailDeliveryStatus.FAILED)
      .toArray();

    // Reset retry time to now
    const now = Date.now();
    for (const email of failedEmails) {
      await db.emailQueue.update(email.id, {
        nextRetryAt: now,
        updatedAt: now,
      });
    }

    log.info(`Queued ${failedEmails.length} failed emails for immediate retry`);

    return failedEmails.length;
  }

  /**
   * Clear old sent emails (older than 30 days)
   */
  async clearOldEmails(): Promise<number> {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    const oldEmails = await db.emailQueue
      .where('status')
      .equals(EmailDeliveryStatus.SENT)
      .filter((email) => (email.sentAt || 0) < thirtyDaysAgo)
      .toArray();

    for (const email of oldEmails) {
      await db.emailQueue.delete(email.id);
    }

    log.info(`Cleared ${oldEmails.length} old emails from queue`);

    return oldEmails.length;
  }
}

// Export singleton instance
export const emailQueueProcessor = new EmailQueueProcessor();

/**
 * Start the email queue processor (call on app initialization)
 */
export function startEmailQueue(): void {
  emailQueueProcessor.start();
}

/**
 * Stop the email queue processor (call on app shutdown)
 */
export function stopEmailQueue(): void {
  emailQueueProcessor.stop();
}
