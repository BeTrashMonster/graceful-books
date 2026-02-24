/**
 * Device Management Component
 *
 * UI for viewing and managing active sessions across devices.
 * Features:
 * - List all active sessions
 * - Show device details, location, last activity
 * - Revoke individual sessions
 * - Force logout all devices
 *
 * Task: S5-6: Session Security Hardening
 */

import { useState, useEffect } from 'react';
import type { DeviceSessionInfo } from '../../auth/sessionSecurity.types';
import {
  getDeviceSessionsForManagement,
  revokeSession,
  forceLogoutAllDevices,
} from '../../services/deviceManagement';
import { logger } from '../../utils/logger';
import styles from './DeviceManagement.module.css';

interface DeviceManagementProps {
  /** Current user ID */
  userId: string;
  /** Current company ID */
  companyId: string;
  /** Current session ID */
  currentSessionId: string;
  /** Callback when user logs out all devices */
  onLogoutAll?: () => void;
}

/**
 * Device Management Component
 */
export const DeviceManagement: React.FC<DeviceManagementProps> = ({
  userId,
  companyId,
  currentSessionId,
  onLogoutAll,
}) => {
  const [sessions, setSessions] = useState<DeviceSessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revokingSession, setRevokingSession] = useState<string | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOutAll, setLoggingOutAll] = useState(false);

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, [userId, companyId, currentSessionId]);

  /**
   * Load active sessions for user
   */
  const loadSessions = async () => {
    try {
      setLoading(true);
      setError(null);

      const deviceSessions = await getDeviceSessionsForManagement(
        userId,
        companyId,
        currentSessionId
      );

      // Sort by last activity (most recent first)
      deviceSessions.sort((a, b) => b.lastActivityAt - a.lastActivityAt);

      setSessions(deviceSessions);
    } catch (err) {
      logger.error('Failed to load sessions', { error: err });
      setError('We couldn\'t load your active sessions. Please try refreshing the page.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Revoke a specific session
   */
  const handleRevokeSession = async (sessionId: string) => {
    // Don't allow revoking current session this way
    if (sessionId === currentSessionId) {
      return;
    }

    try {
      setRevokingSession(sessionId);
      await revokeSession(sessionId, userId, companyId);

      // Remove from list
      setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
    } catch (err) {
      logger.error('Failed to revoke session', { error: err, sessionId });
      setError('We couldn\'t revoke that session. Please try again.');
    } finally {
      setRevokingSession(null);
    }
  };

  /**
   * Force logout all devices
   */
  const handleLogoutAllDevices = async () => {
    try {
      setLoggingOutAll(true);
      await forceLogoutAllDevices(userId, companyId, 'user_initiated');

      // Clear sessions list
      setSessions([]);
      setShowLogoutConfirm(false);

      // Callback to parent (usually triggers re-login)
      if (onLogoutAll) {
        onLogoutAll();
      }
    } catch (err) {
      logger.error('Failed to logout all devices', { error: err });
      setError('We couldn\'t log out all devices. Please try again.');
    } finally {
      setLoggingOutAll(false);
    }
  };

  /**
   * Format timestamp to readable date/time
   */
  const formatDateTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  /**
   * Format relative time (e.g., "5 minutes ago")
   */
  const formatRelativeTime = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) {
      return 'Just now';
    } else if (minutes < 60) {
      return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    } else if (hours < 24) {
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    } else {
      return `${days} day${days !== 1 ? 's' : ''} ago`;
    }
  };

  /**
   * Get device icon based on type
   */
  const getDeviceIcon = (type: DeviceSessionInfo['deviceType']): string => {
    switch (type) {
      case 'desktop':
        return '🖥️';
      case 'mobile':
        return '📱';
      case 'browser':
      default:
        return '🌐';
    }
  };

  /**
   * Parse browser name from user agent
   */
  const getBrowserName = (userAgent: string | null): string => {
    if (!userAgent) return 'Unknown Browser';

    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    if (userAgent.includes('Opera')) return 'Opera';

    return 'Unknown Browser';
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Loading your active sessions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Active Sessions</h2>
        <p className={styles.description}>
          These are the devices and browsers currently signed into your account. If you see
          something you don't recognize, you can revoke that session right away.
        </p>
      </div>

      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}

      {sessions.length === 0 && !error && (
        <div className={styles.empty}>
          <p>No active sessions found.</p>
        </div>
      )}

      {sessions.length > 0 && (
        <>
          <div className={styles.sessionList}>
            {sessions.map((session) => (
              <div
                key={session.sessionId}
                className={`${styles.sessionCard} ${
                  session.isCurrent ? styles.currentSession : ''
                }`}
              >
                <div className={styles.sessionIcon}>
                  {getDeviceIcon(session.deviceType)}
                </div>

                <div className={styles.sessionDetails}>
                  <div className={styles.sessionHeader}>
                    <h3>
                      {session.deviceName}
                      {session.isCurrent && (
                        <span className={styles.currentBadge}>Current Session</span>
                      )}
                    </h3>
                  </div>

                  <div className={styles.sessionMeta}>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Browser:</span>
                      <span className={styles.metaValue}>
                        {getBrowserName(session.userAgent)}
                      </span>
                    </div>

                    {session.ipAddress && (
                      <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>IP Address:</span>
                        <span className={styles.metaValue}>{session.ipAddress}</span>
                      </div>
                    )}

                    {session.location && (
                      <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>Location:</span>
                        <span className={styles.metaValue}>{session.location}</span>
                      </div>
                    )}

                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Last Active:</span>
                      <span className={styles.metaValue}>
                        {formatRelativeTime(session.lastActivityAt)}
                      </span>
                    </div>

                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Started:</span>
                      <span className={styles.metaValue}>
                        {formatDateTime(session.createdAt)}
                      </span>
                    </div>

                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Expires:</span>
                      <span className={styles.metaValue}>
                        {formatDateTime(session.expiresAt)}
                      </span>
                    </div>
                  </div>
                </div>

                {!session.isCurrent && (
                  <div className={styles.sessionActions}>
                    <button
                      onClick={() => handleRevokeSession(session.sessionId)}
                      disabled={revokingSession === session.sessionId}
                      className={styles.revokeButton}
                      aria-label={`Revoke session for ${session.deviceName}`}
                    >
                      {revokingSession === session.sessionId ? 'Revoking...' : 'Revoke'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {sessions.length > 1 && (
            <div className={styles.footer}>
              <button
                onClick={() => setShowLogoutConfirm(true)}
                className={styles.logoutAllButton}
                disabled={loggingOutAll}
              >
                Log Out All Devices
              </button>
              <p className={styles.footerNote}>
                This will sign you out of all devices, including this one. You'll need to sign in
                again to continue.
              </p>
            </div>
          )}
        </>
      )}

      {/* Logout All Confirmation Modal */}
      {showLogoutConfirm && (
        <div className={styles.modal} role="dialog" aria-modal="true">
          <div className={styles.modalContent}>
            <h3>Log Out All Devices?</h3>
            <p>
              This will end all active sessions on all your devices. You'll need to sign in again
              on each device to continue using Graceful Books.
            </p>
            <p className={styles.warningText}>
              This is helpful if you think someone else might have access to your account.
            </p>
            <div className={styles.modalActions}>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                disabled={loggingOutAll}
                className={styles.cancelButton}
              >
                Cancel
              </button>
              <button
                onClick={handleLogoutAllDevices}
                disabled={loggingOutAll}
                className={styles.confirmButton}
              >
                {loggingOutAll ? 'Logging Out...' : 'Yes, Log Out All Devices'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
