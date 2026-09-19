/**
 * Global Error Handler Service
 *
 * Catches unhandled errors and promise rejections at the window level.
 * Shows user-visible toasts only for data-affecting errors (Dexie, backup, crypto).
 * Everything else is logged to console only.
 *
 * Also handles Dexie-specific events (blocked, versionchange) for multi-tab scenarios.
 */

// ============================================================================
// Toast Rendering (outside React tree)
// ============================================================================

interface ToastOptions {
  message: string;
  type: 'error' | 'warning' | 'info';
  action?: {
    label: string;
    onClick: () => void;
  };
  autoDismiss?: boolean;
  duration?: number;
}

let toastContainer: HTMLDivElement | null = null;
let toastCount = 0;

function getToastContainer(): HTMLDivElement {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'global-error-toast-container';
    toastContainer.style.cssText = `
      position: fixed;
      top: 1rem;
      right: 1rem;
      z-index: 99999;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      max-width: 400px;
      pointer-events: none;
    `;
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

function showToast(options: ToastOptions): void {
  const { message, type, action, autoDismiss = true, duration = 10000 } = options;

  const container = getToastContainer();
  const toastId = `toast-${++toastCount}`;

  const toast = document.createElement('div');
  toast.id = toastId;
  toast.setAttribute('role', 'alert');
  toast.style.cssText = `
    background: ${type === 'error' ? '#fef2f2' : type === 'warning' ? '#fffbeb' : '#eff6ff'};
    border: 1px solid ${type === 'error' ? '#fecaca' : type === 'warning' ? '#fde68a' : '#bfdbfe'};
    border-left: 4px solid ${type === 'error' ? '#dc2626' : type === 'warning' ? '#d97706' : '#2563eb'};
    border-radius: 0.375rem;
    padding: 1rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    pointer-events: auto;
    animation: slideIn 0.2s ease-out;
  `;

  // Add animation keyframes if not present
  if (!document.getElementById('toast-animations')) {
    const style = document.createElement('style');
    style.id = 'toast-animations';
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  const messageDiv = document.createElement('div');
  messageDiv.style.cssText = `
    color: ${type === 'error' ? '#991b1b' : type === 'warning' ? '#92400e' : '#1e40af'};
    font-size: 0.875rem;
    line-height: 1.4;
    margin-bottom: ${action ? '0.75rem' : '0'};
  `;
  messageDiv.textContent = message;
  toast.appendChild(messageDiv);

  if (action) {
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = 'display: flex; gap: 0.5rem;';

    const actionButton = document.createElement('button');
    actionButton.textContent = action.label;
    actionButton.style.cssText = `
      background: ${type === 'error' ? '#dc2626' : type === 'warning' ? '#d97706' : '#2563eb'};
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 0.25rem;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
    `;
    actionButton.onclick = () => {
      dismissToast(toastId);
      action.onClick();
    };
    buttonContainer.appendChild(actionButton);

    const dismissButton = document.createElement('button');
    dismissButton.textContent = 'Dismiss';
    dismissButton.style.cssText = `
      background: transparent;
      color: ${type === 'error' ? '#991b1b' : type === 'warning' ? '#92400e' : '#1e40af'};
      border: 1px solid currentColor;
      padding: 0.5rem 1rem;
      border-radius: 0.25rem;
      font-size: 0.875rem;
      cursor: pointer;
    `;
    dismissButton.onclick = () => dismissToast(toastId);
    buttonContainer.appendChild(dismissButton);

    toast.appendChild(buttonContainer);
  } else {
    // Add close button for toasts without action
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '&times;';
    closeButton.style.cssText = `
      position: absolute;
      top: 0.5rem;
      right: 0.5rem;
      background: transparent;
      border: none;
      font-size: 1.25rem;
      color: ${type === 'error' ? '#991b1b' : type === 'warning' ? '#92400e' : '#1e40af'};
      cursor: pointer;
      line-height: 1;
    `;
    closeButton.onclick = () => dismissToast(toastId);
    toast.style.position = 'relative';
    toast.appendChild(closeButton);
  }

  container.appendChild(toast);

  if (autoDismiss) {
    setTimeout(() => dismissToast(toastId), duration);
  }
}

function dismissToast(toastId: string): void {
  const toast = document.getElementById(toastId);
  if (toast) {
    toast.style.animation = 'slideOut 0.2s ease-in forwards';
    setTimeout(() => toast.remove(), 200);
  }
}

// ============================================================================
// Error Classification
// ============================================================================

/**
 * Check if error is related to data operations (Dexie, backup, crypto)
 * These are the only errors we show toasts for
 */
function isDataAffectingError(error: Error | unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  const stack = (error instanceof Error ? error.stack || '' : '').toLowerCase();

  // Keywords that indicate data-affecting operations
  const dataKeywords = [
    'dexie',
    'indexeddb',
    'database',
    'transaction',
    'objectstore',
    'backup',
    'encrypt',
    'decrypt',
    'restore',
    'crypto',
    'cipher',
    'passphrase',
  ];

  // Path patterns that indicate data-affecting code
  const dataPaths = ['/db/', '/backup/', '/crypto/', 'database.ts', 'backupservice'];

  const hasDataKeyword = dataKeywords.some((kw) => message.includes(kw) || stack.includes(kw));
  const hasDataPath = dataPaths.some((p) => stack.includes(p));

  return hasDataKeyword || hasDataPath;
}

/**
 * Check if error is a stale module error (deployment while user active)
 */
function isStaleModuleError(error: Error | unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Importing a module script failed') ||
    message.includes('error loading dynamically imported module')
  );
}

/**
 * Handle stale module error by clearing cache and reloading
 */
function handleStaleModuleError(): void {
  console.warn('⚠️ Detected stale code after deployment. Reloading page...');
  if ('caches' in window) {
    caches.keys().then((names) => {
      names.forEach((name) => caches.delete(name));
    });
  }
  window.location.reload();
}

// ============================================================================
// Global Error Handlers
// ============================================================================

/**
 * Initialize all global error handlers
 * Call this once at app startup, before React renders
 */
export function initGlobalErrorHandlers(): void {
  // Handler for uncaught exceptions
  window.addEventListener('error', (event) => {
    try {
      const error = event.error || new Error(event.message);

      // Stale module error → auto-reload (no toast)
      if (isStaleModuleError(error)) {
        handleStaleModuleError();
        return;
      }

      // Log everything to console for support
      console.error('[GlobalErrorHandler] Uncaught error:', error);

      // Only show toast for data-affecting errors
      if (isDataAffectingError(error)) {
        showToast({
          message:
            'A database operation failed. Your recent changes may not have been saved. Try refreshing the page.',
          type: 'error',
          action: {
            label: 'Refresh',
            onClick: () => window.location.reload(),
          },
          autoDismiss: false,
        });
      }
    } catch (handlerError) {
      // Handler must never throw
      console.error('[GlobalErrorHandler] Error in error handler:', handlerError);
    }
  });

  // Handler for unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    try {
      const error = event.reason;

      // Stale module error → auto-reload (no toast)
      if (isStaleModuleError(error)) {
        event.preventDefault(); // Prevent error from showing in console
        handleStaleModuleError();
        return;
      }

      // Log everything to console for support
      console.error('[GlobalErrorHandler] Unhandled rejection:', error);

      // Only show toast for data-affecting errors
      if (isDataAffectingError(error)) {
        showToast({
          message:
            'A database operation failed. Your recent changes may not have been saved. Try refreshing the page.',
          type: 'error',
          action: {
            label: 'Refresh',
            onClick: () => window.location.reload(),
          },
          autoDismiss: false,
        });
      }
    } catch (handlerError) {
      // Handler must never throw
      console.error('[GlobalErrorHandler] Error in rejection handler:', handlerError);
    }
  });

  console.log('[GlobalErrorHandler] Global error handlers initialized');
}

// ============================================================================
// Dexie Event Handlers
// ============================================================================

/**
 * Initialize Dexie-specific event handlers
 * Call this after the database instance is created
 *
 * @param db - The Dexie database instance
 */
export function initDexieErrorHandlers(db: { on: (event: string, callback: () => void) => void }): void {
  try {
    // 'blocked' fires when another tab holds the DB open during version upgrade
    db.on('blocked', () => {
      try {
        console.warn('[GlobalErrorHandler] Database blocked by another tab');
        showToast({
          message:
            "This app can't update while it's open in other tabs. Close other tabs of this app and reload.",
          type: 'warning',
          action: {
            label: 'Reload',
            onClick: () => window.location.reload(),
          },
          autoDismiss: false,
        });
      } catch (handlerError) {
        console.error('[GlobalErrorHandler] Error in blocked handler:', handlerError);
      }
    });

    // 'versionchange' fires when another tab upgraded the schema
    db.on('versionchange', () => {
      try {
        console.warn('[GlobalErrorHandler] Database version changed in another tab');
        showToast({
          message: 'This app was updated in another tab. Reload to continue.',
          type: 'warning',
          action: {
            label: 'Reload Now',
            onClick: () => window.location.reload(),
          },
          autoDismiss: false,
        });
      } catch (handlerError) {
        console.error('[GlobalErrorHandler] Error in versionchange handler:', handlerError);
      }
    });

    console.log('[GlobalErrorHandler] Dexie error handlers initialized');
  } catch (error) {
    // Registration itself failed - log but don't crash the app
    console.error('[GlobalErrorHandler] Failed to register Dexie handlers:', error);
  }
}

// ============================================================================
// Test Helpers (for verification)
// ============================================================================

/**
 * Trigger test errors for verification
 * Only available in development mode
 * Access via browser console: window.__errorTriggers.unhandledRejection()
 */
export const testTriggers = {
  /** Test 1: Unhandled promise rejection with data-affecting keyword → shows toast */
  unhandledRejection: () => {
    if (import.meta.env.DEV) {
      console.log('🧪 Triggering unhandled rejection (data-affecting)...');
      setTimeout(() => {
        // Simulate a Dexie error (data-affecting)
        Promise.reject(new Error('Test Dexie transaction failed'));
      }, 100);
    }
  },
  /** Test 2: Uncaught error with data-affecting keyword → shows toast */
  uncaughtError: () => {
    if (import.meta.env.DEV) {
      console.log('🧪 Triggering uncaught error (data-affecting)...');
      setTimeout(() => {
        // Simulate a database error (data-affecting)
        throw new Error('Test database write failed');
      }, 100);
    }
  },
  /** Test 3: Non-data error → NO toast, only console */
  nonDataError: () => {
    if (import.meta.env.DEV) {
      console.log('🧪 Triggering non-data error (should NOT show toast)...');
      setTimeout(() => {
        // Simulate a non-data error (should NOT show toast)
        Promise.reject(new Error('Test analytics call failed'));
      }, 100);
    }
  },
  /** Test 4: Simulated Dexie blocked event → shows warning toast */
  dexieBlocked: () => {
    if (import.meta.env.DEV) {
      console.log('🧪 Simulating Dexie blocked event...');
      showToast({
        message:
          "This app can't update while it's open in other tabs. Close other tabs of this app and reload.",
        type: 'warning',
        action: {
          label: 'Reload',
          onClick: () => console.log('Would reload page'),
        },
        autoDismiss: false,
      });
    }
  },
  /** Test 5: Simulated Dexie versionchange event → shows warning toast */
  dexieVersionChange: () => {
    if (import.meta.env.DEV) {
      console.log('🧪 Simulating Dexie versionchange event...');
      showToast({
        message: 'This app was updated in another tab. Reload to continue.',
        type: 'warning',
        action: {
          label: 'Reload Now',
          onClick: () => console.log('Would reload page'),
        },
        autoDismiss: false,
      });
    }
  },
};

// Expose test triggers on window in development mode
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as Window & { __errorTriggers?: typeof testTriggers }).__errorTriggers = testTriggers;
  console.log('🧪 Error test triggers available: window.__errorTriggers');
}
