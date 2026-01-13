/**
 * AdaptiveHelp Component
 *
 * Help text and tooltips that adapt based on user's DISC profile.
 * Provides contextual assistance with personalized explanations.
 */

import React, { useState, useRef, useEffect } from 'react';
import { useAdaptiveMessage } from '../../features/messaging/useAdaptiveMessage';
import type { DISCProfile } from '../../utils/discMessageAdapter';
import './AdaptiveHelp.css';

export interface AdaptiveHelpProps {
  /** Message ID from the message library */
  messageId: string;
  /** Placeholder values for message interpolation */
  placeholders?: Record<string, string | number>;
  /** User's DISC profile */
  profile?: DISCProfile | null;
  /** Display mode: tooltip (hover) or inline (always visible) */
  mode?: 'tooltip' | 'inline';
  /** Icon to display */
  icon?: React.ReactNode;
  /** Additional CSS class */
  className?: string;
  /** Tooltip position */
  position?: 'top' | 'bottom' | 'left' | 'right';
}

/**
 * AdaptiveHelp - Contextual help text with DISC-adapted messaging
 *
 * @example
 * ```tsx
 * <AdaptiveHelp
 *   messageId="help.chart_of_accounts"
 *   profile={userProfile}
 *   mode="tooltip"
 *   position="right"
 * />
 * ```
 */
export function AdaptiveHelp({
  messageId,
  placeholders,
  profile,
  mode = 'tooltip',
  icon,
  className = '',
  position = 'top',
}: AdaptiveHelpProps) {
  const { getMessage } = useAdaptiveMessage(profile);
  const [isVisible, setIsVisible] = useState(mode === 'inline');
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const message = getMessage(messageId, placeholders);

  // Update tooltip position when visible
  useEffect(() => {
    if (isVisible && mode === 'tooltip' && triggerRef.current && tooltipRef.current) {
      updateTooltipPosition();
    }
  }, [isVisible, mode]);

  const updateTooltipPosition = () => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const gap = 8; // Gap between trigger and tooltip

    let top = 0;
    let left = 0;

    switch (position) {
      case 'top':
        top = triggerRect.top - tooltipRect.height - gap;
        left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
        break;
      case 'bottom':
        top = triggerRect.bottom + gap;
        left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
        break;
      case 'left':
        top = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2);
        left = triggerRect.left - tooltipRect.width - gap;
        break;
      case 'right':
        top = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2);
        left = triggerRect.right + gap;
        break;
    }

    setTooltipStyle({
      top: `${top}px`,
      left: `${left}px`,
    });
  };

  const handleMouseEnter = () => {
    if (mode === 'tooltip') {
      setIsVisible(true);
    }
  };

  const handleMouseLeave = () => {
    if (mode === 'tooltip') {
      setIsVisible(false);
    }
  };

  const handleFocus = () => {
    if (mode === 'tooltip') {
      setIsVisible(true);
    }
  };

  const handleBlur = () => {
    if (mode === 'tooltip') {
      setIsVisible(false);
    }
  };

  if (mode === 'inline') {
    return (
      <div className={`adaptive-help adaptive-help--inline ${className}`}>
        {icon && <span className="adaptive-help__icon">{icon}</span>}
        <p className="adaptive-help__text">{message}</p>
      </div>
    );
  }

  return (
    <>
      <button
        ref={triggerRef}
        className={`adaptive-help__trigger ${className}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        aria-label="Help"
        type="button"
      >
        {icon || <HelpIcon />}
      </button>

      {isVisible && (
        <div
          ref={tooltipRef}
          className={`adaptive-help__tooltip adaptive-help__tooltip--${position}`}
          style={tooltipStyle}
          role="tooltip"
        >
          <div className="adaptive-help__tooltip-content">
            {message}
          </div>
          <div className={`adaptive-help__tooltip-arrow adaptive-help__tooltip-arrow--${position}`} />
        </div>
      )}
    </>
  );
}

/**
 * Default help icon (question mark in circle)
 */
function HelpIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M6.5 6C6.5 5.17157 7.17157 4.5 8 4.5C8.82843 4.5 9.5 5.17157 9.5 6C9.5 6.82843 8.82843 7.5 8 7.5C8 7.5 8 8 8 9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="8" cy="11" r="0.75" fill="currentColor" />
    </svg>
  );
}

/**
 * AdaptiveHelpText - Simple text-only help component
 * For cases where you just need the adapted text without tooltip UI
 *
 * @example
 * ```tsx
 * <label>
 *   Chart of Accounts
 *   <AdaptiveHelpText
 *     messageId="help.chart_of_accounts"
 *     profile={userProfile}
 *   />
 * </label>
 * ```
 */
export interface AdaptiveHelpTextProps {
  /** Message ID from the message library */
  messageId: string;
  /** Placeholder values for message interpolation */
  placeholders?: Record<string, string | number>;
  /** User's DISC profile */
  profile?: DISCProfile | null;
  /** Additional CSS class */
  className?: string;
  /** HTML tag to render */
  as?: 'p' | 'span' | 'div';
}

export function AdaptiveHelpText({
  messageId,
  placeholders,
  profile,
  className = '',
  as: Component = 'p',
}: AdaptiveHelpTextProps) {
  const { getMessage } = useAdaptiveMessage(profile);
  const message = getMessage(messageId, placeholders);

  return (
    <Component className={`adaptive-help-text ${className}`}>
      {message}
    </Component>
  );
}
