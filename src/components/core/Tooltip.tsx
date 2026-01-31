import { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';
import styles from './Tooltip.module.css';

export interface TooltipProps {
  /**
   * The content to display in the tooltip
   */
  content: string | React.ReactNode;
  /**
   * The trigger element (what you hover/click)
   */
  children: React.ReactNode;
  /**
   * Position of tooltip relative to trigger
   */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /**
   * Trigger method
   */
  trigger?: 'hover' | 'click' | 'both';
  /**
   * Optional className for the tooltip
   */
  className?: string;
}

/**
 * Tooltip Component
 *
 * Displays additional information in a popup on hover or click.
 *
 * Features:
 * - Hover and/or click trigger
 * - Configurable position
 * - Accessible with ARIA attributes
 * - Click outside to close
 * - Escape key to close
 *
 * Requirements:
 * - WCAG 2.1 AA compliant
 * - Keyboard accessible
 *
 * @example
 * ```tsx
 * <Tooltip content="This is additional information">
 *   <span>Hover me*</span>
 * </Tooltip>
 * ```
 */
export function Tooltip({
  content,
  children,
  position = 'top',
  trigger = 'both',
  className,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close
  useEffect(() => {
    if (!isVisible) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        tooltipRef.current &&
        triggerRef.current &&
        !tooltipRef.current.contains(event.target as Node) &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsVisible(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsVisible(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isVisible]);

  const handleMouseEnter = () => {
    if (trigger === 'hover' || trigger === 'both') {
      setIsVisible(true);
    }
  };

  const handleMouseLeave = () => {
    if (trigger === 'hover' || trigger === 'both') {
      setIsVisible(false);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (trigger === 'click' || trigger === 'both') {
      e.preventDefault();
      e.stopPropagation();
      setIsVisible(!isVisible);
    }
  };

  const handleFocus = () => {
    if (trigger === 'hover' || trigger === 'both') {
      setIsVisible(true);
    }
  };

  const handleBlur = () => {
    if (trigger === 'hover' || trigger === 'both') {
      setIsVisible(false);
    }
  };

  return (
    <div className={styles.tooltipContainer}>
      <div
        ref={triggerRef}
        className={styles.trigger}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onFocus={handleFocus}
        onBlur={handleBlur}
        tabIndex={0}
        aria-describedby={isVisible ? 'tooltip' : undefined}
      >
        {children}
      </div>
      {isVisible && (
        <div
          ref={tooltipRef}
          id="tooltip"
          role="tooltip"
          className={clsx(
            styles.tooltip,
            styles[`position-${position}`],
            className
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
}
