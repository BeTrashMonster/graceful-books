/**
 * Subscription Context
 *
 * Provides subscription status across the app to enable read-only mode
 * when subscription is paused.
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getSubscription } from '../services/billing.api';
import type { Subscription } from '../services/billing.api';

interface SubscriptionContextValue {
  subscription: Subscription | null;
  isLoading: boolean;
  hasActiveSubscription: boolean;
  isInGracePeriod: boolean;
  isReadOnly: boolean;
  refreshSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

interface SubscriptionProviderProps {
  children: ReactNode;
}

export function SubscriptionProvider({ children }: SubscriptionProviderProps) {
  // Check if we're on an admin route - skip user API calls if so
  const isAdminRoute = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(!isAdminRoute);

  /**
   * Load subscription status
   * Skips API call on admin routes to avoid token type conflicts
   */
  const loadSubscription = async () => {
    // Skip on admin routes - admin uses different auth token type
    if (isAdminRoute) {
      setIsLoading(false);
      return;
    }

    try {
      const data = await getSubscription();
      setSubscription(data);
    } catch (error) {
      console.error('[SubscriptionContext] Failed to load subscription:', error);
      setSubscription(null);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Refresh subscription (call after pause/resume/etc)
   */
  const refreshSubscription = async () => {
    setIsLoading(true);
    await loadSubscription();
  };

  // Load subscription on mount
  useEffect(() => {
    loadSubscription();

    // Listen for subscription updates
    const handleSubscriptionUpdate = () => {
      loadSubscription();
    };

    window.addEventListener('subscription-updated', handleSubscriptionUpdate);
    return () => window.removeEventListener('subscription-updated', handleSubscriptionUpdate);
  }, []);

  /**
   * Check if user has an active subscription (trial or active)
   */
  const hasActiveSubscription =
    subscription !== null &&
    (subscription.status === 'trial' || subscription.status === 'active');

  /**
   * Check if user is in grace period (payment failed)
   */
  const isInGracePeriod =
    subscription !== null && subscription.gracePeriodEndsAt !== null;

  /**
   * Determine if user is in read-only mode
   * Read-only when:
   * - Subscription is paused
   * - No subscription at all (shouldn't happen, but be safe)
   * - Subscription is expired or cancelled
   */
  const isReadOnly =
    subscription === null ||
    subscription.status === 'paused' ||
    subscription.status === 'expired' ||
    subscription.status === 'cancelled';

  const value: SubscriptionContextValue = {
    subscription,
    isLoading,
    hasActiveSubscription,
    isInGracePeriod,
    isReadOnly,
    refreshSubscription,
  };

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

/**
 * Hook to access subscription context
 */
export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}
