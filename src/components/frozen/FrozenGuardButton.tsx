/**
 * FrozenGuardButton Component
 *
 * PURPOSE:
 * A wrapper around the Button component that checks frozen state before
 * executing onClick. If the account is frozen, it shows the reactivation
 * modal instead of performing the action.
 *
 * USAGE:
 * Use this component for any button that performs a write action (save, add,
 * delete, update). It provides a consistent UX for frozen accounts without
 * requiring each component to implement its own frozen state handling.
 *
 * The backend middleware (requireNotFrozen) is still the real enforcement.
 * This component is purely for UX - preventing user frustration by guiding
 * them to reactivation before they attempt an action that will fail.
 *
 * @example
 * // Instead of:
 * <Button onClick={handleSave}>Save Product</Button>
 *
 * // Use:
 * <FrozenGuardButton onClick={handleSave}>Save Product</FrozenGuardButton>
 *
 * @module components/frozen/FrozenGuardButton
 */

import { forwardRef, useCallback, type MouseEvent } from 'react';
import { Button, type ButtonProps } from '../core/Button';
import { useFrozenState } from '../../contexts/FrozenStateContext';

export interface FrozenGuardButtonProps extends ButtonProps {
  /**
   * If true, bypasses the frozen check (for actions that should always work,
   * like "Export Data" or "View Report")
   * @default false
   */
  bypassFrozenCheck?: boolean;
}

/**
 * FrozenGuardButton - Button that checks frozen state before executing onClick
 *
 * When the account is frozen and the user clicks this button:
 * 1. The onClick is NOT called
 * 2. The reactivation flow modal is opened instead
 * 3. User is guided to reactivate their account
 *
 * When the account is NOT frozen:
 * - Behaves exactly like a normal Button
 */
export const FrozenGuardButton = forwardRef<HTMLButtonElement, FrozenGuardButtonProps>(
  (
    {
      onClick,
      bypassFrozenCheck = false,
      children,
      ...buttonProps
    },
    ref
  ) => {
    const { isFrozen, openReactivationFlow, isLoading } = useFrozenState();

    const handleClick = useCallback((event: MouseEvent<HTMLButtonElement>) => {
      // If bypassing frozen check, just call onClick
      if (bypassFrozenCheck) {
        onClick?.(event);
        return;
      }

      // If frozen, show reactivation modal instead
      if (isFrozen && !isLoading) {
        event.preventDefault();
        event.stopPropagation();
        console.log('[FrozenGuardButton] Action blocked - account is frozen');
        openReactivationFlow();
        return;
      }

      // Not frozen - proceed normally
      onClick?.(event);
    }, [onClick, bypassFrozenCheck, isFrozen, isLoading, openReactivationFlow]);

    return (
      <Button
        ref={ref}
        onClick={handleClick}
        {...buttonProps}
      >
        {children}
      </Button>
    );
  }
);

FrozenGuardButton.displayName = 'FrozenGuardButton';
