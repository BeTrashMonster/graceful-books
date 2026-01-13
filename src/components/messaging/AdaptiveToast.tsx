/**
 * AdaptiveToast Component
 *
 * Toast notification component that adapts its message based on user's DISC profile.
 * Provides feedback for user actions with personalized messaging.
 */

import { useEffect, useState } from 'react';
import { useAdaptiveMessage } from '../../features/messaging/useAdaptiveMessage';
import type { DISCProfile } from '../../utils/discMessageAdapter';
import './AdaptiveToast.css';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface AdaptiveToastProps {
  /** Message ID from the message library */
  messageId: string;
  /** Placeholder values for message interpolation */
  placeholders?: Record<string, string | number>;
  /** User's DISC profile */
  profile?: DISCProfile | null;
  /** Toast type for styling */
  type?: ToastType;
  /** Duration in milliseconds (0 = manual dismiss) */
  duration?: number;
  /** Callback when toast is dismissed */
  onDismiss?: () => void;
  /** Show toast (controlled mode) */
  show?: boolean;
  /** Additional CSS class */
  className?: string;
}

/**
 * AdaptiveToast - Toast notification with DISC-adapted messaging
 *
 * @example
 * ```tsx
 * <AdaptiveToast
 *   messageId="transaction.save.success"
 *   type="success"
 *   profile={userProfile}
 *   duration={3000}
 *   onDismiss={() => setShowToast(false)}
 * />
 * ```
 */
export function AdaptiveToast({
  messageId,
  placeholders,
  profile,
  type = 'info',
  duration = 3000,
  onDismiss,
  show = true,
  className = '',
}: AdaptiveToastProps) {
  const { getMessage } = useAdaptiveMessage(profile);
  const [isVisible, setIsVisible] = useState(show);
  const [isExiting, setIsExiting] = useState(false);

  const message = getMessage(messageId, placeholders);

  // Auto-dismiss after duration
  useEffect(() => {
    if (show && duration > 0) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [show, duration]);

  // Sync with controlled show prop
  useEffect(() => {
    if (show) {
      setIsVisible(true);
      setIsExiting(false);
    }
  }, [show]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      onDismiss?.();
    }, 300); // Match CSS animation duration
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={`adaptive-toast adaptive-toast--${type} ${isExiting ? 'adaptive-toast--exiting' : ''} ${className}`}
      role="alert"
      aria-live="polite"
    >
      <div className="adaptive-toast__icon">
        {getToastIcon(type)}
      </div>
      <div className="adaptive-toast__message">
        {message}
      </div>
      <button
        className="adaptive-toast__dismiss"
        onClick={handleDismiss}
        aria-label="Dismiss notification"
        type="button"
      >
        ×
      </button>
    </div>
  );
}

/**
 * Get icon for toast type
 */
function getToastIcon(type: ToastType): string {
  switch (type) {
    case 'success':
      return '✓';
    case 'error':
      return '✕';
    case 'warning':
      return '⚠';
    case 'info':
    default:
      return 'ℹ';
  }
}

/**
 * Toast Container - Manages multiple toasts
 */
export interface Toast {
  id: string;
  messageId: string;
  placeholders?: Record<string, string | number>;
  type?: ToastType;
  duration?: number;
}

export interface AdaptiveToastContainerProps {
  /** List of active toasts */
  toasts: Toast[];
  /** User's DISC profile */
  profile?: DISCProfile | null;
  /** Callback when a toast is dismissed */
  onDismiss: (id: string) => void;
  /** Position of toast container */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
}

/**
 * AdaptiveToastContainer - Container for managing multiple toasts
 *
 * @example
 * ```tsx
 * function App() {
 *   const [toasts, setToasts] = useState<Toast[]>([]);
 *
 *   const addToast = (toast: Toast) => {
 *     setToasts(prev => [...prev, toast]);
 *   };
 *
 *   const removeToast = (id: string) => {
 *     setToasts(prev => prev.filter(t => t.id !== id));
 *   };
 *
 *   return (
 *     <AdaptiveToastContainer
 *       toasts={toasts}
 *       profile={userProfile}
 *       onDismiss={removeToast}
 *       position="top-right"
 *     />
 *   );
 * }
 * ```
 */
export function AdaptiveToastContainer({
  toasts,
  profile,
  onDismiss,
  position = 'top-right',
}: AdaptiveToastContainerProps) {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className={`adaptive-toast-container adaptive-toast-container--${position}`}>
      {toasts.map((toast) => (
        <AdaptiveToast
          key={toast.id}
          messageId={toast.messageId}
          placeholders={toast.placeholders}
          profile={profile}
          type={toast.type}
          duration={toast.duration}
          onDismiss={() => onDismiss(toast.id)}
        />
      ))}
    </div>
  );
}
