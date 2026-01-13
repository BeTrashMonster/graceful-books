/**
 * Logout Module
 *
 * Handles secure session cleanup on logout, timeout, or tab close.
 * Ensures all sensitive data is properly cleared from memory and storage.
 */

import type { LogoutOptions } from './types';
import { clearSession, getActiveSession } from './session';
import {
  revokeDeviceToken,
  revokeAllDeviceTokens,
  clearAllSessionData,
  removeSessionToken,
} from './sessionStorage';

/**
 * Logout callbacks for cleanup
 */
const logoutCallbacks: (() => void | Promise<void>)[] = [];

/**
 * Perform logout
 *
 * Securely clears session data, encryption keys, and optionally
 * revokes device tokens.
 *
 * @param options - Logout options
 * @returns Promise that resolves when logout is complete
 */
export async function logout(
  options: LogoutOptions = {}
): Promise<void> {
  const session = getActiveSession();
  const companyId = session?.companyId;

  // Clear active session (includes zeroing encryption keys)
  clearSession(options.reason === 'user_initiated' ? 'logout' : (options.reason || 'logout'));

  // Clear session storage
  clearAllSessionData();

  // Remove session token from storage
  if (companyId) {
    removeSessionToken(companyId);
  }

  // Revoke device tokens if requested
  if (options.forgetDevice && companyId) {
    await revokeDeviceToken(companyId);
  }

  // Revoke all device tokens if requested (security event)
  if (options.revokeAllSessions) {
    await revokeAllDeviceTokens();
  }

  // Clear any cached data (additional cleanup)
  await clearCachedData();

  // Execute logout callbacks
  await executeLogoutCallbacks();

  // Log logout event (in production, send to audit log)
  logLogoutEvent(session?.userId, companyId, options.reason);
}

/**
 * Clear cached data
 *
 * Removes any cached encrypted data or temporary files.
 * In production, this would clear IndexedDB caches and other storage.
 */
async function clearCachedData(): Promise<void> {
  try {
    // Clear any localStorage items related to session
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('session-') || key.startsWith('cache-'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));

    // In production, also clear IndexedDB caches
    // await clearIndexedDBCaches();
  } catch (error) {
    console.error('Error clearing cached data:', error);
  }
}

/**
 * Execute all registered logout callbacks
 *
 * Allows other modules to register cleanup functions.
 */
async function executeLogoutCallbacks(): Promise<void> {
  for (const callback of logoutCallbacks) {
    try {
      await callback();
    } catch (error) {
      console.error('Error executing logout callback:', error);
    }
  }
}

/**
 * Register a logout callback
 *
 * Allows modules to register cleanup functions that run on logout.
 *
 * @param callback - Cleanup function
 */
export function onLogout(callback: () => void | Promise<void>): void {
  logoutCallbacks.push(callback);
}

/**
 * Remove a logout callback
 *
 * @param callback - Callback to remove
 */
export function offLogout(callback: () => void | Promise<void>): void {
  const index = logoutCallbacks.indexOf(callback);
  if (index !== -1) {
    logoutCallbacks.splice(index, 1);
  }
}

/**
 * Log logout event
 *
 * In production, this would send to audit log or analytics.
 *
 * @param userId - User identifier
 * @param companyId - Company identifier
 * @param reason - Logout reason
 */
function logLogoutEvent(
  userId: string | undefined,
  companyId: string | undefined,
  reason: string | undefined
): void {
  const event = {
    type: 'logout',
    userId,
    companyId,
    reason,
    timestamp: new Date().toISOString(),
  };

  // In production, send to audit log
  console.log('Logout event:', event);
}

/**
 * Emergency logout
 *
 * Immediate logout for security events.
 * Clears everything without waiting for async operations.
 */
export function emergencyLogout(): void {
  // Synchronous cleanup only
  clearSession('security');
  try {
    sessionStorage.clear();
    // Don't clear localStorage device tokens in emergency logout
    // (might be needed for recovery)
  } catch (error) {
    console.error('Error in emergency logout:', error);
  }

  // Reload page to clear any remaining state
  window.location.href = '/login';
}

/**
 * Set up automatic logout handlers
 *
 * Registers handlers for various logout triggers:
 * - Tab/window close
 * - Browser back/forward
 * - Page reload
 *
 * @param companyId - Company identifier
 */
export function setupLogoutHandlers(_companyId: string): void {
  // Handle tab/window close
  window.addEventListener('beforeunload', (_event) => {
    const session = getActiveSession();
    if (session) {
      // Attempt to clear session on tab close
      // Note: This is best-effort as beforeunload is limited
      clearSession('tab_close');

      // Don't clear device tokens (handled by sessionStorage module)
    }
  });

  // Handle page visibility change (tab switching)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // Tab is hidden - could start inactivity timer
      // Handled by session idle timeout
    } else {
      // Tab is visible again - validate session
      const session = getActiveSession();
      if (session && session.expiresAt < Date.now()) {
        // Session expired while tab was hidden
        logout({ reason: 'timeout' });
      }
    }
  });

  // Handle browser navigation
  window.addEventListener('pagehide', () => {
    // Page is being unloaded (more reliable than beforeunload)
    clearSession('tab_close');
  });
}

/**
 * Clear specific data on logout
 *
 * Allows targeted cleanup of specific data types.
 *
 * @param dataTypes - Types of data to clear
 */
export async function clearDataOnLogout(
  dataTypes: ('session' | 'cache' | 'device' | 'all')[]
): Promise<void> {
  for (const type of dataTypes) {
    switch (type) {
      case 'session':
        clearSession('logout');
        clearAllSessionData();
        break;

      case 'cache':
        await clearCachedData();
        break;

      case 'device':
        await revokeAllDeviceTokens();
        break;

      case 'all':
        clearSession('logout');
        clearAllSessionData();
        await clearCachedData();
        await revokeAllDeviceTokens();
        break;
    }
  }
}

/**
 * Validate logout was successful
 *
 * Checks that all session data was properly cleared.
 *
 * @returns True if logout was successful
 */
export function validateLogout(): boolean {
  // Check active session
  const session = getActiveSession();
  if (session !== null) {
    console.warn('Active session still exists after logout');
    return false;
  }

  // Check sessionStorage
  try {
    if (sessionStorage.length > 0) {
      console.warn('SessionStorage not empty after logout');
      return false;
    }
  } catch (error) {
    // SessionStorage might not be available
  }

  return true;
}

/**
 * Get logout confirmation message
 *
 * Returns user-friendly logout confirmation based on context.
 *
 * @param reason - Logout reason
 * @returns Confirmation message
 */
export function getLogoutMessage(
  reason: 'user_initiated' | 'timeout' | 'security' | 'tab_close' = 'user_initiated'
): string {
  switch (reason) {
    case 'timeout':
      return "You've been logged out due to inactivity. Your data is secure.";

    case 'security':
      return "You've been logged out for security reasons. Please log in again.";

    case 'tab_close':
      return 'Session ended. See you next time!';

    case 'user_initiated':
    default:
      return 'Logged out successfully. Your data is secure.';
  }
}

/**
 * Schedule automatic logout
 *
 * Sets up a timer to automatically logout after a specified duration.
 *
 * @param delayMs - Delay in milliseconds
 * @param reason - Logout reason
 * @returns Timer ID that can be used to cancel
 */
export function scheduleLogout(
  delayMs: number,
  reason: LogoutOptions['reason'] = 'timeout'
): number {
  return window.setTimeout(() => {
    logout({ reason });
  }, delayMs);
}

/**
 * Cancel scheduled logout
 *
 * @param timerId - Timer ID from scheduleLogout
 */
export function cancelScheduledLogout(timerId: number): void {
  clearTimeout(timerId);
}

/**
 * Logout with confirmation
 *
 * Shows confirmation dialog before logging out (for user-initiated logout).
 *
 * @param options - Logout options
 * @returns Promise that resolves when user confirms or rejects
 */
export async function logoutWithConfirmation(
  options: LogoutOptions = {}
): Promise<boolean> {
  // In production, this would show a proper UI modal
  const confirmed = window.confirm(
    'Are you sure you want to log out?' +
    (options.forgetDevice ? '\n\nThis will also forget this device.' : '')
  );

  if (confirmed) {
    await logout(options);
    return true;
  }

  return false;
}

/**
 * Zero out sensitive data in memory
 *
 * Security utility to overwrite sensitive data with zeros.
 * Called during logout to ensure data is not recoverable.
 *
 * @param data - Uint8Array to zero out
 */
export function zeroMemory(data: Uint8Array): void {
  if (data && data.fill) {
    data.fill(0);
  }
}

/**
 * Clear browser storage
 *
 * Clears localStorage and sessionStorage.
 * Use with caution - this will clear ALL stored data.
 */
export function clearAllBrowserStorage(): void {
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch (error) {
    console.error('Error clearing browser storage:', error);
  }
}
