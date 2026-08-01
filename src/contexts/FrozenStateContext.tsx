/**
 * Frozen State Context
 *
 * PURPOSE:
 * Provides frozen state awareness across the app. This is a UX layer that:
 * - Shows users their account status (frozen or active)
 * - Prevents frustration by warning before write attempts
 * - Guides users to reactivation when needed
 *
 * ARCHITECTURE:
 * - This context is READ-ONLY for account state
 * - Does NOT modify database or intercept writes
 * - Backend middleware (requireNotFrozen) is the real enforcement
 * - This is purely for user experience
 *
 * FROZEN TRIGGERS:
 * - Workshop trial expired (no conversion to paid)
 * - Regular subscription trial expired
 * - Subscription cancelled or expired
 *
 * WHEN FROZEN:
 * - User can VIEW all their data
 * - User can EXPORT their data
 * - User CANNOT create, edit, or delete records (enforced by backend)
 * - User sees banner + modal guiding to reactivation
 *
 * DEBUG MODE:
 * Add ?debug_frozen=workshop_trial_expired to URL to test frozen state
 *
 * @module contexts/FrozenStateContext
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode
} from 'react';
import { getMyWorkshopEnrollment, type WorkshopEnrollment } from '../services/workshops.api';
import { useSubscription } from './SubscriptionContext';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Reasons why an account might be frozen
 */
export type FrozenReason =
  | 'workshop_trial_expired'
  | 'subscription_trial_expired'
  | 'subscription_cancelled'
  | 'subscription_expired'
  | 'payment_failed';

/**
 * Actions that are always allowed regardless of frozen state
 */
export type AllowedAction = 'read' | 'export' | 'pay' | 'settings';

/**
 * Context value shape
 */
interface FrozenStateContextValue {
  /** Whether the account is currently frozen */
  isFrozen: boolean;

  /** Why the account is frozen (null if not frozen) */
  frozenReason: FrozenReason | null;

  /** When the account was frozen (null if not frozen) */
  frozenAt: Date | null;

  /** Workshop enrollment if user came through workshop */
  workshopEnrollment: WorkshopEnrollment | null;

  /** Check if a specific action is allowed */
  canPerformAction: (action: AllowedAction | 'write') => boolean;

  /** Loading state - don't show frozen UI while loading */
  isLoading: boolean;

  /** Refresh frozen state (call after payment, etc.) */
  refreshFrozenState: () => Promise<void>;

  /** Open the reactivation flow modal */
  openReactivationFlow: () => void;

  /** Close the reactivation flow modal */
  closeReactivationFlow: () => void;

  /** Whether reactivation flow is open */
  isReactivationFlowOpen: boolean;

  /** Whether the frozen notification modal is visible */
  isFrozenModalVisible: boolean;

  /** Dismiss the frozen notification modal ("I'll do this later") */
  dismissFrozenModal: () => void;

  /** Show the frozen notification modal */
  showFrozenModal: () => void;

  /** Days remaining in trial (null if not in trial or trial expired) */
  trialDaysRemaining: number | null;

  /** Whether user is in a workshop trial (not expired) */
  isInWorkshopTrial: boolean;
}

// =============================================================================
// CONTEXT
// =============================================================================

const FrozenStateContext = createContext<FrozenStateContextValue | undefined>(undefined);

// =============================================================================
// DEBUG UTILITIES
// =============================================================================

/**
 * Check URL for debug frozen state parameter
 * Usage: ?debug_frozen=workshop_trial_expired
 *
 * This allows testing the frozen UI without actually expiring a trial
 */
function getDebugFrozenReason(): FrozenReason | null {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  const debugValue = params.get('debug_frozen');

  const validReasons: FrozenReason[] = [
    'workshop_trial_expired',
    'subscription_trial_expired',
    'subscription_cancelled',
    'subscription_expired',
    'payment_failed'
  ];

  if (debugValue && validReasons.includes(debugValue as FrozenReason)) {
    console.log(`[FrozenState] DEBUG MODE: Forcing frozen state with reason: ${debugValue}`);
    return debugValue as FrozenReason;
  }

  return null;
}

// =============================================================================
// PROVIDER
// =============================================================================

interface FrozenStateProviderProps {
  children: ReactNode;
}

export function FrozenStateProvider({ children }: FrozenStateProviderProps) {
  // Get subscription state from existing context
  const { subscription, isReadOnly: subscriptionReadOnly } = useSubscription();

  // Local state
  const [workshopEnrollment, setWorkshopEnrollment] = useState<WorkshopEnrollment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReactivationFlowOpen, setIsReactivationFlowOpen] = useState(false);
  const [isFrozenModalDismissed, setIsFrozenModalDismissed] = useState(false);

  // Debug mode - check URL param
  const debugFrozenReason = useMemo(() => getDebugFrozenReason(), []);

  // ===========================================================================
  // DATA LOADING
  // ===========================================================================

  /**
   * Load workshop enrollment status from API
   */
  const loadWorkshopEnrollment = useCallback(async () => {
    try {
      const enrollment = await getMyWorkshopEnrollment();
      setWorkshopEnrollment(enrollment);
    } catch (error) {
      // User might not be in a workshop - that's fine
      console.debug('[FrozenState] No workshop enrollment found');
      setWorkshopEnrollment(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Refresh frozen state (call after payment, subscription change, etc.)
   */
  const refreshFrozenState = useCallback(async () => {
    setIsLoading(true);
    await loadWorkshopEnrollment();
    // Trigger subscription refresh via event
    window.dispatchEvent(new Event('subscription-updated'));
  }, [loadWorkshopEnrollment]);

  // Load on mount and listen for updates
  useEffect(() => {
    loadWorkshopEnrollment();

    const handleUpdate = () => loadWorkshopEnrollment();

    window.addEventListener('frozen-state-updated', handleUpdate);
    window.addEventListener('subscription-updated', handleUpdate);

    // Listen for backend enforcement catching a frozen write
    const handleBackendFrozenError = () => {
      console.log('[FrozenState] Backend rejected write - account is frozen');
      loadWorkshopEnrollment();
      setIsReactivationFlowOpen(true);
    };
    window.addEventListener('account-frozen-error', handleBackendFrozenError);

    return () => {
      window.removeEventListener('frozen-state-updated', handleUpdate);
      window.removeEventListener('subscription-updated', handleUpdate);
      window.removeEventListener('account-frozen-error', handleBackendFrozenError);
    };
  }, [loadWorkshopEnrollment]);

  // ===========================================================================
  // COMPUTED VALUES
  // ===========================================================================

  /**
   * Calculate days remaining in trial
   */
  const trialDaysRemaining = useMemo(() => {
    if (!workshopEnrollment?.trialExpiresAt) return null;

    const now = new Date();
    const expiresAt = new Date(workshopEnrollment.trialExpiresAt);
    const msRemaining = expiresAt.getTime() - now.getTime();

    if (msRemaining <= 0) return 0;
    return Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
  }, [workshopEnrollment]);

  /**
   * Check if user is in an active (non-expired) workshop trial
   */
  const isInWorkshopTrial = useMemo(() => {
    if (!workshopEnrollment) return false;
    if (workshopEnrollment.convertedToPaidAt) return false;
    if (trialDaysRemaining === null) return false;
    return trialDaysRemaining > 0;
  }, [workshopEnrollment, trialDaysRemaining]);

  /**
   * Check if workshop trial has expired
   */
  const isWorkshopTrialExpired = useMemo(() => {
    if (!workshopEnrollment) return false;
    if (workshopEnrollment.convertedToPaidAt) return false;
    if (!workshopEnrollment.trialExpiresAt) return false;

    const now = new Date();
    const expiresAt = new Date(workshopEnrollment.trialExpiresAt);
    return now > expiresAt;
  }, [workshopEnrollment]);

  /**
   * Check if regular subscription trial has expired
   */
  const isSubscriptionTrialExpired = useMemo(() => {
    if (!subscription) return false;
    if (workshopEnrollment) return false; // Workshop users handled separately
    if (subscription.trialConverted) return false;
    if (!subscription.trialEndsAt) return false;

    const now = new Date();
    const trialEndsAt = new Date(subscription.trialEndsAt);
    return now > trialEndsAt;
  }, [subscription, workshopEnrollment]);

  /**
   * Determine frozen state and reason
   *
   * PRIORITY ORDER:
   * 1. Debug mode (for testing)
   * 2. Workshop trial expired
   * 3. Subscription trial expired
   * 4. Subscription cancelled/expired
   */
  const { isFrozen, frozenReason, frozenAt } = useMemo(() => {
    // DEBUG MODE - allows testing without real expiration
    if (debugFrozenReason) {
      return {
        isFrozen: true,
        frozenReason: debugFrozenReason,
        frozenAt: new Date(),
      };
    }

    // Don't show frozen state while still loading
    if (isLoading) {
      return { isFrozen: false, frozenReason: null, frozenAt: null };
    }

    // Workshop trial expired
    if (isWorkshopTrialExpired) {
      return {
        isFrozen: true,
        frozenReason: 'workshop_trial_expired' as FrozenReason,
        frozenAt: workshopEnrollment?.trialExpiresAt
          ? new Date(workshopEnrollment.trialExpiresAt)
          : null,
      };
    }

    // Regular subscription trial expired
    if (isSubscriptionTrialExpired && subscription) {
      return {
        isFrozen: true,
        frozenReason: 'subscription_trial_expired' as FrozenReason,
        frozenAt: subscription.trialEndsAt
          ? new Date(subscription.trialEndsAt)
          : null,
      };
    }

    // Subscription cancelled or expired
    if (subscription) {
      if (subscription.status === 'cancelled') {
        return {
          isFrozen: true,
          frozenReason: 'subscription_cancelled' as FrozenReason,
          frozenAt: subscription.currentPeriodEnd
            ? new Date(subscription.currentPeriodEnd)
            : null,
        };
      }

      if (subscription.status === 'expired') {
        return {
          isFrozen: true,
          frozenReason: 'subscription_expired' as FrozenReason,
          frozenAt: subscription.currentPeriodEnd
            ? new Date(subscription.currentPeriodEnd)
            : null,
        };
      }
    }

    // Check subscription context's isReadOnly for other cases (paused, etc.)
    // But only for non-workshop users with actual subscription records
    if (subscriptionReadOnly && !isInWorkshopTrial && !workshopEnrollment && subscription) {
      return {
        isFrozen: true,
        frozenReason: 'subscription_expired' as FrozenReason,
        frozenAt: null,
      };
    }

    // Not frozen
    return { isFrozen: false, frozenReason: null, frozenAt: null };
  }, [
    debugFrozenReason,
    isLoading,
    isWorkshopTrialExpired,
    isSubscriptionTrialExpired,
    isInWorkshopTrial,
    workshopEnrollment,
    subscription,
    subscriptionReadOnly,
  ]);

  // ===========================================================================
  // ACTIONS
  // ===========================================================================

  /**
   * Check if a specific action is allowed
   */
  const canPerformAction = useCallback((action: AllowedAction | 'write'): boolean => {
    // These actions are always allowed regardless of frozen state
    if (action === 'read' || action === 'export' || action === 'pay' || action === 'settings') {
      return true;
    }

    // Write actions are blocked when frozen
    if (action === 'write') {
      return !isFrozen;
    }

    return false;
  }, [isFrozen]);

  const openReactivationFlow = useCallback(() => {
    setIsFrozenModalDismissed(true); // Hide the notification modal
    setIsReactivationFlowOpen(true);
  }, []);

  const closeReactivationFlow = useCallback(() => {
    setIsReactivationFlowOpen(false);
  }, []);

  const dismissFrozenModal = useCallback(() => {
    setIsFrozenModalDismissed(true);
  }, []);

  const showFrozenModal = useCallback(() => {
    setIsFrozenModalDismissed(false);
  }, []);

  // Frozen modal is visible when: frozen, not dismissed, and reactivation flow not open
  const isFrozenModalVisible = isFrozen && !isFrozenModalDismissed && !isReactivationFlowOpen;

  // ===========================================================================
  // CONTEXT VALUE
  // ===========================================================================

  const value = useMemo<FrozenStateContextValue>(() => ({
    isFrozen,
    frozenReason,
    frozenAt,
    workshopEnrollment,
    canPerformAction,
    isLoading,
    refreshFrozenState,
    openReactivationFlow,
    closeReactivationFlow,
    isReactivationFlowOpen,
    isFrozenModalVisible,
    dismissFrozenModal,
    showFrozenModal,
    trialDaysRemaining,
    isInWorkshopTrial,
  }), [
    isFrozen,
    frozenReason,
    frozenAt,
    workshopEnrollment,
    canPerformAction,
    isLoading,
    refreshFrozenState,
    openReactivationFlow,
    closeReactivationFlow,
    isReactivationFlowOpen,
    isFrozenModalVisible,
    dismissFrozenModal,
    showFrozenModal,
    trialDaysRemaining,
    isInWorkshopTrial,
  ]);

  return (
    <FrozenStateContext.Provider value={value}>
      {children}
    </FrozenStateContext.Provider>
  );
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Hook to access frozen state context
 *
 * @throws Error if used outside FrozenStateProvider
 *
 * @example
 * const { isFrozen, openReactivationFlow } = useFrozenState();
 * if (isFrozen) {
 *   openReactivationFlow();
 *   return;
 * }
 */
export function useFrozenState(): FrozenStateContextValue {
  const context = useContext(FrozenStateContext);
  if (context === undefined) {
    throw new Error('useFrozenState must be used within a FrozenStateProvider');
  }
  return context;
}

/**
 * Hook for guarding write operations
 *
 * Provides utilities for components that perform write operations:
 * - checkCanWrite(): Returns boolean, opens modal if frozen
 * - guardedAction(): Wraps an async action, blocks if frozen
 *
 * @example
 * const { checkCanWrite, guardedAction } = useFrozenGuard();
 *
 * // Option 1: Check before action
 * const handleSave = () => {
 *   if (!checkCanWrite()) return;
 *   saveData();
 * };
 *
 * // Option 2: Wrap the action
 * const handleSave = () => guardedAction(async () => {
 *   await saveData();
 * });
 */
export function useFrozenGuard() {
  const { isFrozen, frozenReason, openReactivationFlow } = useFrozenState();

  /**
   * Check if writes are allowed, opens reactivation modal if not
   * @returns true if write is allowed, false if blocked
   */
  const checkCanWrite = useCallback((): boolean => {
    if (isFrozen) {
      console.log(`[FrozenGuard] Write blocked: ${frozenReason}`);
      openReactivationFlow();
      return false;
    }
    return true;
  }, [isFrozen, frozenReason, openReactivationFlow]);

  /**
   * Wrap an async action with frozen state check
   * If frozen, opens modal and returns undefined
   * If not frozen, executes and returns the action result
   */
  const guardedAction = useCallback(async <T,>(
    action: () => Promise<T>
  ): Promise<T | undefined> => {
    if (!checkCanWrite()) {
      return undefined;
    }
    return action();
  }, [checkCanWrite]);

  return {
    checkCanWrite,
    guardedAction,
    isFrozen,
    frozenReason,
  };
}

/**
 * Custom error class for frozen state write attempts
 * Used when backend rejects a write due to frozen state
 */
export class FrozenStateError extends Error {
  public readonly reason: FrozenReason | null;

  constructor(reason: FrozenReason | null) {
    const messages: Record<FrozenReason, string> = {
      workshop_trial_expired: 'Your trial has ended. Please subscribe to continue.',
      subscription_trial_expired: 'Your trial has ended. Please subscribe to continue.',
      subscription_cancelled: 'Your subscription has been cancelled. Please reactivate to continue.',
      subscription_expired: 'Your subscription has expired. Please renew to continue.',
      payment_failed: 'There was an issue with your payment. Please update your payment method.',
    };

    super(reason ? messages[reason] : 'Account is frozen. Please subscribe to continue.');
    this.name = 'FrozenStateError';
    this.reason = reason;
  }
}
