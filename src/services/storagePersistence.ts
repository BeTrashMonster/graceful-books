/**
 * Storage Persistence Service
 *
 * Requests durable storage from the browser to prevent IndexedDB eviction
 * under storage pressure. Called once on app startup.
 *
 * Context: Browsers can evict IndexedDB data when storage is low. Chrome
 * grants persistence based on engagement signals (bookmarks, PWA install, etc),
 * so denial is normal - it just means backups are more important.
 *
 * Caching strategy:
 * - 'granted' and 'unsupported': cached permanently (won't change)
 * - 'denied': cached with timestamp, retry after 7 days
 *   (engagement signals build over time, so a user denied on day 1
 *    could be granted on day 30)
 *
 * Storage keys:
 * - 'graceful_books_storage_persistence': status value
 * - 'graceful_books_storage_persistence_denied_at': timestamp of last denial
 */

const STORAGE_KEY = 'graceful_books_storage_persistence';
const DENIED_AT_KEY = 'graceful_books_storage_persistence_denied_at';
const RETRY_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export type StoragePersistenceStatus = 'granted' | 'denied' | 'unsupported' | 'error' | 'unknown';

/**
 * Get the current storage persistence status
 * Returns the cached status from localStorage
 */
export function getStoragePersistenceStatus(): StoragePersistenceStatus {
  try {
    const status = localStorage.getItem(STORAGE_KEY);
    if (status === 'granted' || status === 'denied' || status === 'unsupported' || status === 'error') {
      return status;
    }
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Check if we should skip requesting persistence
 * - Skip if already granted or unsupported (permanent states)
 * - Skip if denied recently (within RETRY_INTERVAL_MS)
 * - Request again if denied more than RETRY_INTERVAL_MS ago
 */
function shouldSkipRequest(): boolean {
  try {
    const status = localStorage.getItem(STORAGE_KEY);

    // Granted or unsupported are permanent - never retry
    if (status === 'granted' || status === 'unsupported') {
      return true;
    }

    // If denied, check if enough time has passed to retry
    if (status === 'denied') {
      const deniedAtStr = localStorage.getItem(DENIED_AT_KEY);
      if (deniedAtStr) {
        const deniedAt = parseInt(deniedAtStr, 10);
        const elapsed = Date.now() - deniedAt;
        if (elapsed < RETRY_INTERVAL_MS) {
          // Still within retry interval, skip
          return true;
        }
        // Enough time passed, retry
        console.log('[StoragePersistence] Retrying after denial (7+ days elapsed)');
        return false;
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Request durable storage from the browser
 *
 * Called on app startup. Skips if already granted, or if denied recently.
 * Retries denied requests after 7 days (engagement signals build over time).
 */
export async function requestStoragePersistence(): Promise<StoragePersistenceStatus> {
  if (shouldSkipRequest()) {
    return getStoragePersistenceStatus();
  }

  try {
    // Check if StorageManager API is supported
    if (!navigator.storage || typeof navigator.storage.persist !== 'function') {
      console.log('[StoragePersistence] navigator.storage.persist not supported');
      localStorage.setItem(STORAGE_KEY, 'unsupported');
      return 'unsupported';
    }

    // Check if already persisted (in case browser granted it automatically)
    const alreadyPersisted = await navigator.storage.persisted();
    if (alreadyPersisted) {
      console.log('[StoragePersistence] Storage already persisted');
      localStorage.setItem(STORAGE_KEY, 'granted');
      localStorage.removeItem(DENIED_AT_KEY); // Clean up if previously denied
      return 'granted';
    }

    // Request persistence
    const granted = await navigator.storage.persist();

    if (granted) {
      console.log('[StoragePersistence] Durable storage granted');
      localStorage.setItem(STORAGE_KEY, 'granted');
      localStorage.removeItem(DENIED_AT_KEY); // Clean up if previously denied
      return 'granted';
    } else {
      console.log('[StoragePersistence] Durable storage denied (normal for low engagement)');
      localStorage.setItem(STORAGE_KEY, 'denied');
      localStorage.setItem(DENIED_AT_KEY, String(Date.now()));
      return 'denied';
    }
  } catch (err) {
    console.warn('[StoragePersistence] Error requesting persistence:', err);
    localStorage.setItem(STORAGE_KEY, 'error');
    return 'error';
  }
}

/**
 * Initialize storage persistence on app startup
 * This is called from main.tsx before React renders
 */
export function initStoragePersistence(): void {
  // Fire and forget - don't block app startup
  requestStoragePersistence().catch((err) => {
    console.warn('[StoragePersistence] Init failed:', err);
  });
}
