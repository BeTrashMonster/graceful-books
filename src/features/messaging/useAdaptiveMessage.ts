/**
 * React Hook for Adaptive Messages
 *
 * Provides a simple hook interface for retrieving DISC-adapted messages
 * in React components.
 */

import { useMemo, useCallback } from 'react';
import { getAdaptiveMessage, getMessageVariants } from './adaptiveMessages';
import type { DISCProfile } from '../../utils/discMessageAdapter';

/**
 * Hook for getting adaptive messages based on user's DISC profile
 *
 * @param profile - User's DISC profile (optional)
 * @returns Function to get adaptive messages
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const userProfile = useDISCProfile(); // Your DISC profile hook
 *   const getMessage = useAdaptiveMessage(userProfile);
 *
 *   return (
 *     <div>
 *       {getMessage('welcome.after_signup')}
 *     </div>
 *   );
 * }
 * ```
 */
export function useAdaptiveMessage(profile?: DISCProfile | null) {
  /**
   * Get a message by ID with optional placeholders
   */
  const getMessage = useCallback(
    (messageId: string, placeholders?: Record<string, string | number>) => {
      return getAdaptiveMessage(messageId, { profile, placeholders });
    },
    [profile]
  );

  /**
   * Get all variants of a message (for preview/testing)
   */
  const getVariants = useCallback(
    (messageId: string, placeholders?: Record<string, string | number>) => {
      return getMessageVariants(messageId, placeholders);
    },
    []
  );

  return useMemo(
    () => ({
      getMessage,
      getVariants,
    }),
    [getMessage, getVariants]
  );
}

/**
 * Simple hook that returns just the getMessage function
 * For cases where you only need basic message retrieval
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const getMessage = useMessage();
 *   return <p>{getMessage('transaction.save.success')}</p>;
 * }
 * ```
 */
export function useMessage(profile?: DISCProfile | null) {
  return useCallback(
    (messageId: string, placeholders?: Record<string, string | number>) => {
      return getAdaptiveMessage(messageId, { profile, placeholders });
    },
    [profile]
  );
}

/**
 * Hook for message preview (shows all DISC variants)
 * Useful for admin/testing interfaces
 *
 * @example
 * ```tsx
 * function MessagePreview({ messageId }: { messageId: string }) {
 *   const variants = useMessagePreview(messageId);
 *
 *   return (
 *     <div>
 *       <h3>D: {variants.D}</h3>
 *       <h3>I: {variants.I}</h3>
 *       <h3>S: {variants.S}</h3>
 *       <h3>C: {variants.C}</h3>
 *     </div>
 *   );
 * }
 * ```
 */
export function useMessagePreview(
  messageId: string,
  placeholders?: Record<string, string | number>
) {
  return useMemo(() => {
    return getMessageVariants(messageId, placeholders);
  }, [messageId, placeholders]);
}
