/**
 * FeatureGate Component
 *
 * Wrapper component that conditionally renders features based on
 * user's phase and feature visibility settings.
 *
 * Requirements:
 * - PFD-001: Feature visibility rules by phase
 * - PFD-002: UI adaptation based on phase
 */

import type { ReactNode } from 'react';
import type { FeatureId } from './types';
import { useFeatureVisibility } from './useFeatureVisibility';
import type { UseFeatureVisibilityOptions } from './useFeatureVisibility';

export interface FeatureGateProps {
  /** Feature ID to check access for */
  feature: FeatureId;

  /** Child components to render if accessible */
  children: ReactNode;

  /** Fallback to render if not accessible (defaults to null) */
  fallback?: ReactNode;

  /** Whether to show fallback for locked features (default: true) */
  showLocked?: boolean;

  /** Whether to render nothing if not visible (default: true) */
  hideIfNotVisible?: boolean;

  /** Feature visibility options */
  visibilityOptions: UseFeatureVisibilityOptions;
}

/**
 * FeatureGate - Conditionally render features based on phase
 *
 * @example
 * ```tsx
 * // Basic usage - hide if not accessible
 * <FeatureGate
 *   feature="invoicing"
 *   visibilityOptions={{ currentPhase: user.phase, userId: user.id }}
 * >
 *   <InvoicingFeature />
 * </FeatureGate>
 *
 * // With custom fallback for locked features
 * <FeatureGate
 *   feature="invoicing"
 *   visibilityOptions={{ currentPhase: user.phase, userId: user.id }}
 *   fallback={<LockedFeatureCard featureId="invoicing" />}
 * >
 *   <InvoicingFeature />
 * </FeatureGate>
 *
 * // Show in navigation but dimmed
 * <FeatureGate
 *   feature="forecasting"
 *   visibilityOptions={{ currentPhase: user.phase, userId: user.id }}
 *   showLocked={true}
 *   hideIfNotVisible={false}
 *   fallback={<LockedNavItem name="Forecasting" />}
 * >
 *   <NavItem name="Forecasting" href="/forecasting" />
 * </FeatureGate>
 * ```
 */
export function FeatureGate({
  feature,
  children,
  fallback = null,
  showLocked = true,
  hideIfNotVisible = true,
  visibilityOptions,
}: FeatureGateProps) {
  const { canAccess, isVisible } = useFeatureVisibility(visibilityOptions);

  const featureIsVisible = isVisible(feature);
  const featureCanAccess = canAccess(feature);

  // If not visible and hideIfNotVisible is true, render nothing
  if (!featureIsVisible && hideIfNotVisible) {
    return null;
  }

  // If accessible, render children
  if (featureCanAccess) {
    return <>{children}</>;
  }

  // If not accessible but visible (locked), show fallback if showLocked is true
  if (featureIsVisible && showLocked) {
    return <>{fallback}</>;
  }

  // Otherwise render nothing
  return null;
}

/**
 * Hook-based alternative to FeatureGate for more flexibility
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { canAccess } = useFeatureGate('invoicing', {
 *     currentPhase: user.phase,
 *     userId: user.id,
 *   });
 *
 *   if (!canAccess) {
 *     return <LockedMessage />;
 *   }
 *
 *   return <InvoicingFeature />;
 * }
 * ```
 */
export function useFeatureGate(
  feature: FeatureId,
  options: UseFeatureVisibilityOptions
) {
  const { canAccess, isVisible, getAccess, getMetadata } = useFeatureVisibility(options);

  return {
    canAccess: canAccess(feature),
    isVisible: isVisible(feature),
    access: getAccess(feature),
    metadata: getMetadata(feature),
  };
}
