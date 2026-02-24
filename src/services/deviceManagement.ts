/**
 * Device Management Service
 *
 * Service layer for managing user sessions across devices.
 * Provides functions to:
 * - List active sessions
 * - Revoke individual sessions
 * - Force logout all devices
 *
 * Task: S5-6: Session Security Hardening
 */

import { db } from '../db';
import type { Session, Device } from '../types/database.types';
import type {
  DeviceSessionInfo,
  SessionMetadata,
  ForceLogoutOptions,
  ForceLogoutResult,
} from '../auth/sessionSecurity.types';
import { forceLogout } from '../auth/sessionSecurity';
import { logger } from '../utils/logger';
import { AppError, ErrorCode } from '../utils/errors';
import { validateCompanyId } from '../utils/authorization';

/**
 * Get all active sessions for a user
 *
 * @param userId - User ID
 * @param companyId - Company ID (for authorization)
 * @returns Array of active sessions
 */
export async function getActiveSessionsForUser(
  userId: string,
  companyId: string
): Promise<Session[]> {
  try {
    // Validate companyId
    validateCompanyId(companyId);

    // Query sessions table
    const sessions = await db.sessions
      .where('user_id')
      .equals(userId)
      .and((session) => !session.deleted_at)
      .toArray();

    // Filter to only active (not expired, not revoked)
    const now = Date.now();
    return sessions.filter((session) => {
      return session.expires_at > now;
    });
  } catch (error) {
    logger.error('Failed to get active sessions', { error, userId });
    throw new AppError(
      ErrorCode.DATABASE_ERROR,
      'We couldn\'t retrieve your active sessions. Please try again.'
    );
  }
}

/**
 * Get all devices for a user
 *
 * @param userId - User ID
 * @param companyId - Company ID (for authorization)
 * @returns Array of devices
 */
export async function getDevicesForUser(
  userId: string,
  companyId: string
): Promise<Device[]> {
  try {
    // Validate companyId
    validateCompanyId(companyId);

    // Query devices table
    const devices = await db.devices
      .where('user_id')
      .equals(userId)
      .and((device) => !device.deleted_at)
      .toArray();

    return devices;
  } catch (error) {
    logger.error('Failed to get devices', { error, userId });
    throw new AppError(
      ErrorCode.DATABASE_ERROR,
      'We couldn\'t retrieve your devices. Please try again.'
    );
  }
}

/**
 * Get device session information for management UI
 *
 * Combines session and device data for display.
 *
 * @param userId - User ID
 * @param companyId - Company ID (for authorization)
 * @param currentSessionId - Current session ID (to mark as current)
 * @returns Array of device session info
 */
export async function getDeviceSessionsForManagement(
  userId: string,
  companyId: string,
  currentSessionId: string
): Promise<DeviceSessionInfo[]> {
  try {
    // Get sessions and devices
    const [sessions, devices] = await Promise.all([
      getActiveSessionsForUser(userId, companyId),
      getDevicesForUser(userId, companyId),
    ]);

    // Create device map for quick lookup
    const deviceMap = new Map<string, Device>();
    devices.forEach((device) => {
      deviceMap.set(device.device_id, device);
    });

    // Transform sessions to DeviceSessionInfo
    const deviceSessions: DeviceSessionInfo[] = sessions.map((session) => {
      const device = deviceMap.get(session.device_id);

      return {
        sessionId: session.id,
        deviceId: session.device_id,
        deviceName: session.device_name || 'Unknown Device',
        deviceType: device?.device_type || 'browser',
        userAgent: session.user_agent,
        ipAddress: session.ip_address,
        createdAt: session.created_at,
        expiresAt: session.expires_at,
        lastActivityAt: session.last_activity_at,
        isCurrent: session.id === currentSessionId,
        location: undefined, // TODO: Derive from IP using geolocation service
      };
    });

    return deviceSessions;
  } catch (error) {
    logger.error('Failed to get device sessions for management', { error, userId });
    throw new AppError(
      ErrorCode.DATABASE_ERROR,
      'We couldn\'t retrieve your device information. Please try again.'
    );
  }
}

/**
 * Revoke a specific session
 *
 * @param sessionId - Session ID to revoke
 * @param userId - User ID (for authorization)
 * @param companyId - Company ID (for authorization)
 * @returns True if successful
 */
export async function revokeSession(
  sessionId: string,
  userId: string,
  companyId: string
): Promise<boolean> {
  try {
    // Validate companyId
    validateCompanyId(companyId);

    // Get session
    const session = await db.sessions.get(sessionId);

    if (!session) {
      throw new AppError(
        ErrorCode.NOT_FOUND,
        'Session not found.'
      );
    }

    // Verify user owns this session
    if (session.user_id !== userId) {
      throw new AppError(
        ErrorCode.AUTHORIZATION_FAILED,
        'You don\'t have permission to revoke this session.'
      );
    }

    // Mark session as deleted (soft delete)
    const now = Date.now();
    await db.sessions.update(sessionId, {
      deleted_at: now,
      updated_at: now,
    });

    logger.info('Session revoked', { sessionId, userId });

    return true;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error('Failed to revoke session', { error, sessionId, userId });
    throw new AppError(
      ErrorCode.DATABASE_ERROR,
      'We couldn\'t revoke that session. Please try again.'
    );
  }
}

/**
 * Force logout all devices for a user
 *
 * @param userId - User ID
 * @param companyId - Company ID (for authorization)
 * @param reason - Reason for logout
 * @returns Logout result
 */
export async function forceLogoutAllDevices(
  userId: string,
  companyId: string,
  reason: ForceLogoutOptions['reason'] = 'user_initiated'
): Promise<ForceLogoutResult> {
  try {
    // Validate companyId
    validateCompanyId(companyId);

    // Get all active sessions
    const sessions = await getActiveSessionsForUser(userId, companyId);

    // Convert to SessionMetadata format
    const sessionMetadata: SessionMetadata[] = sessions.map((session) => ({
      id: session.id,
      user_id: session.user_id,
      company_id: session.company_id,
      token: session.token,
      device_id: session.device_id,
      device_fingerprint: '', // Not stored in current schema
      user_agent: session.user_agent,
      ip_address: session.ip_address,
      device_name: session.device_name,
      created_at: session.created_at,
      expires_at: session.expires_at,
      last_activity_at: session.last_activity_at,
      role: 'OWNER', // TODO: Get from session or user
      remember_device: session.remember_device,
      is_active: true,
      revoked_at: null,
      version_vector: session.version_vector,
    }));

    // Force logout
    const result = await forceLogout(
      {
        userId,
        allDevices: true,
        reason,
      },
      sessionMetadata
    );

    // Update database
    if (result.success) {
      const now = Date.now();
      const sessionIds = sessions.map((s) => s.id);

      // Soft delete all sessions
      await Promise.all(
        sessionIds.map((id) =>
          db.sessions.update(id, {
            deleted_at: now,
            updated_at: now,
          })
        )
      );

      logger.info('All devices logged out', { userId, sessionsRevoked: result.sessionsRevoked });
    }

    return result;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error('Failed to force logout all devices', { error, userId });
    throw new AppError(
      ErrorCode.DATABASE_ERROR,
      'We couldn\'t log out all devices. Please try again.'
    );
  }
}

/**
 * Update device name
 *
 * @param deviceId - Device ID
 * @param userId - User ID (for authorization)
 * @param companyId - Company ID (for authorization)
 * @param newName - New device name
 * @returns True if successful
 */
export async function updateDeviceName(
  deviceId: string,
  userId: string,
  companyId: string,
  newName: string
): Promise<boolean> {
  try {
    // Validate companyId
    validateCompanyId(companyId);

    // Get device
    const device = await db.devices
      .where('device_id')
      .equals(deviceId)
      .and((d) => !d.deleted_at)
      .first();

    if (!device) {
      throw new AppError(
        ErrorCode.NOT_FOUND,
        'Device not found.'
      );
    }

    // Verify user owns this device
    if (device.user_id !== userId) {
      throw new AppError(
        ErrorCode.AUTHORIZATION_FAILED,
        'You don\'t have permission to update this device.'
      );
    }

    // Update device name
    const now = Date.now();
    await db.devices.update(device.id, {
      device_name: newName,
      updated_at: now,
    });

    logger.info('Device name updated', { deviceId, userId, newName });

    return true;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error('Failed to update device name', { error, deviceId, userId });
    throw new AppError(
      ErrorCode.DATABASE_ERROR,
      'We couldn\'t update the device name. Please try again.'
    );
  }
}

/**
 * Get session count for a user
 *
 * @param userId - User ID
 * @param companyId - Company ID (for authorization)
 * @returns Number of active sessions
 */
export async function getActiveSessionCount(
  userId: string,
  companyId: string
): Promise<number> {
  try {
    const sessions = await getActiveSessionsForUser(userId, companyId);
    return sessions.length;
  } catch (error) {
    logger.error('Failed to get active session count', { error, userId });
    return 0;
  }
}

/**
 * Clean up expired sessions for all users
 *
 * Should be run periodically (e.g., daily cron job).
 *
 * @returns Number of sessions cleaned up
 */
export async function cleanupExpiredSessionsForAllUsers(): Promise<number> {
  try {
    const now = Date.now();

    // Get all expired sessions
    const expiredSessions = await db.sessions
      .where('expires_at')
      .below(now)
      .and((session) => !session.deleted_at)
      .toArray();

    // Soft delete expired sessions
    await Promise.all(
      expiredSessions.map((session) =>
        db.sessions.update(session.id, {
          deleted_at: now,
          updated_at: now,
        })
      )
    );

    logger.info('Expired sessions cleaned up', { count: expiredSessions.length });

    return expiredSessions.length;
  } catch (error) {
    logger.error('Failed to clean up expired sessions', { error });
    return 0;
  }
}
