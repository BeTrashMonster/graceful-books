/**
 * Email Preferences Store
 *
 * Per D3: Weekly Email Summary Setup
 * Manages email preference data with CRDT support.
 */

import { nanoid } from 'nanoid';
import { db } from '../db/database';
import type {
  EmailPreferencesEntity,
  EmailDeliveryEntity,
} from '../db/schema/emailPreferences.schema';
import {
  createDefaultEmailPreferences,
  createEmailDeliveryRecord,
  validateEmailPreferences,
} from '../db/schema/emailPreferences.schema';
import type { EmailPreferencesInput } from '../types/email.types';
import { incrementVersionVector } from '../utils/versionVector';
import { getDeviceId } from '../utils/device';
import { logger } from '../utils/logger';
import { AppError, ErrorCode } from '../utils/errors';

const storeLogger = logger.child('EmailPreferencesStore');

/**
 * Get email preferences for a user
 */
export async function getEmailPreferences(
  userId: string
): Promise<EmailPreferencesEntity | null> {
  try {
    const preferences = await db.emailPreferences
      .where('user_id')
      .equals(userId)
      .and((p) => p.deleted_at === null)
      .first();

    return preferences || null;
  } catch (error) {
    storeLogger.error('Failed to get email preferences', { userId, error });
    throw new AppError(
      ErrorCode.DATABASE_ERROR,
      'We couldn\'t retrieve your email preferences. Please try again.',
      { userId }
    );
  }
}

/**
 * Get or create email preferences for a user
 */
export async function getOrCreateEmailPreferences(
  userId: string,
  companyId: string
): Promise<EmailPreferencesEntity> {
  try {
    const existing = await getEmailPreferences(userId);
    if (existing) {
      return existing;
    }

    // Create default preferences
    const deviceId = getDeviceId();
    const defaults = createDefaultEmailPreferences(userId, companyId, deviceId);

    const newPreferences: EmailPreferencesEntity = {
      ...defaults,
      id: nanoid(),
      created_at: new Date(),
      updated_at: new Date(),
    };

    await db.emailPreferences.add(newPreferences);

    storeLogger.info('Created default email preferences', { userId, companyId });

    return newPreferences;
  } catch (error) {
    storeLogger.error('Failed to get or create email preferences', { userId, error });
    throw new AppError(
      ErrorCode.DATABASE_ERROR,
      'We couldn\'t set up your email preferences. Please try again.',
      { userId }
    );
  }
}

/**
 * Update email preferences
 */
export async function updateEmailPreferences(
  userId: string,
  updates: EmailPreferencesInput
): Promise<EmailPreferencesEntity> {
  try {
    const existing = await getEmailPreferences(userId);
    if (!existing) {
      throw new AppError(
        ErrorCode.NOT_FOUND,
        'Email preferences not found. Please refresh and try again.',
        { userId }
      );
    }

    // Validate updates
    const validation = validateEmailPreferences(updates);
    if (!validation.valid) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        `Invalid preferences: ${validation.errors.join(', ')}`,
        { updates, errors: validation.errors }
      );
    }

    // Prepare updates
    const deviceId = getDeviceId();
    const now = new Date();

    const updatedPreferences: Partial<EmailPreferencesEntity> = {
      ...updates,
      version_vector: incrementVersionVector(existing.version_vector, deviceId),
      last_modified_by: deviceId,
      last_modified_at: now,
      updated_at: now,
    };

    // Update in database
    await db.emailPreferences.update(existing.id, updatedPreferences);

    storeLogger.info('Updated email preferences', { userId, updates });

    // Retrieve and return updated record
    const updated = await db.emailPreferences.get(existing.id);
    if (!updated) {
      throw new AppError(
        ErrorCode.DATABASE_ERROR,
        'Failed to retrieve updated preferences',
        { userId }
      );
    }

    return updated;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    storeLogger.error('Failed to update email preferences', { userId, updates, error });
    throw new AppError(
      ErrorCode.DATABASE_ERROR,
      'We couldn\'t save your email preferences. Please try again.',
      { userId, updates }
    );
  }
}

/**
 * Enable email notifications
 */
export async function enableEmailNotifications(
  userId: string,
  companyId: string
): Promise<EmailPreferencesEntity> {
  const preferences = await getOrCreateEmailPreferences(userId, companyId);

  return updateEmailPreferences(userId, {
    enabled: true,
    unsubscribedAt: null,
    unsubscribeReason: null,
  } as any);
}

/**
 * Disable email notifications
 */
export async function disableEmailNotifications(
  userId: string
): Promise<EmailPreferencesEntity> {
  return updateEmailPreferences(userId, {
    enabled: false,
  });
}

/**
 * Unsubscribe from emails
 */
export async function unsubscribeFromEmails(
  userId: string,
  reason?: string
): Promise<EmailPreferencesEntity> {
  return updateEmailPreferences(userId, {
    enabled: false,
    unsubscribedAt: new Date(),
    unsubscribeReason: reason || 'User unsubscribed',
  } as any);
}

/**
 * Record email delivery
 */
export async function recordEmailDelivery(
  userId: string,
  companyId: string,
  recipientEmail: string,
  subject: string,
  scheduledAt: Date,
  contentHash: string
): Promise<EmailDeliveryEntity> {
  try {
    const deviceId = getDeviceId();
    const deliveryRecord = createEmailDeliveryRecord(
      userId,
      companyId,
      recipientEmail,
      subject,
      scheduledAt,
      deviceId
    );

    const record: EmailDeliveryEntity = {
      ...deliveryRecord,
      id: nanoid(),
      content_hash: contentHash,
      created_at: new Date(),
      updated_at: new Date(),
    };

    await db.emailDelivery.add(record);

    storeLogger.info('Recorded email delivery', { userId, subject });

    return record;
  } catch (error) {
    storeLogger.error('Failed to record email delivery', { userId, error });
    throw new AppError(
      ErrorCode.DATABASE_ERROR,
      'Failed to record email delivery',
      { userId }
    );
  }
}

/**
 * Update email delivery status
 */
export async function updateEmailDeliveryStatus(
  deliveryId: string,
  status: 'sending' | 'sent' | 'failed' | 'bounced' | 'unsubscribed',
  failureReason?: string
): Promise<void> {
  try {
    const deviceId = getDeviceId();
    const now = new Date();

    const updates: Partial<EmailDeliveryEntity> = {
      status,
      last_modified_by: deviceId,
      last_modified_at: now,
      updated_at: now,
    };

    if (status === 'sent') {
      updates.sent_at = now;
      updates.delivered_at = now;
    } else if (status === 'failed' || status === 'bounced') {
      updates.failed_at = now;
      updates.failure_reason = failureReason || 'Unknown error';
    }

    await db.emailDelivery.update(deliveryId, updates);

    storeLogger.info('Updated email delivery status', { deliveryId, status });
  } catch (error) {
    storeLogger.error('Failed to update email delivery status', { deliveryId, status, error });
    throw new AppError(
      ErrorCode.DATABASE_ERROR,
      'Failed to update email delivery status',
      { deliveryId }
    );
  }
}

/**
 * Get recent email deliveries for a user
 */
export async function getRecentEmailDeliveries(
  userId: string,
  limit: number = 10
): Promise<EmailDeliveryEntity[]> {
  try {
    const deliveries = await db.emailDelivery
      .where('user_id')
      .equals(userId)
      .and((d) => d.deleted_at === null)
      .reverse()
      .sortBy('sent_at');

    return deliveries.slice(0, limit);
  } catch (error) {
    storeLogger.error('Failed to get recent email deliveries', { userId, error });
    throw new AppError(
      ErrorCode.DATABASE_ERROR,
      'We couldn\'t retrieve your email history. Please try again.',
      { userId }
    );
  }
}

/**
 * Check if user has unsubscribed
 */
export async function isUserUnsubscribed(userId: string): Promise<boolean> {
  try {
    const preferences = await getEmailPreferences(userId);
    return preferences?.unsubscribed_at !== null;
  } catch (error) {
    storeLogger.error('Failed to check unsubscribe status', { userId, error });
    return false; // Fail safe - don't send if we can't verify
  }
}

/**
 * Delete email preferences (soft delete)
 */
export async function deleteEmailPreferences(userId: string): Promise<void> {
  try {
    const preferences = await getEmailPreferences(userId);
    if (!preferences) {
      return; // Already deleted or never existed
    }

    const deviceId = getDeviceId();
    const now = new Date();

    await db.emailPreferences.update(preferences.id, {
      deleted_at: now,
      last_modified_by: deviceId,
      last_modified_at: now,
      updated_at: now,
    });

    storeLogger.info('Deleted email preferences', { userId });
  } catch (error) {
    storeLogger.error('Failed to delete email preferences', { userId, error });
    throw new AppError(
      ErrorCode.DATABASE_ERROR,
      'We couldn\'t remove your email preferences. Please try again.',
      { userId }
    );
  }
}
