/**
 * HelpTooltip - Inline help tooltips for quick contextual help
 */

import React, { useState, useRef, useEffect } from 'react';

export interface HelpTooltipProps {
  content: string;
  title?: string;
  learnMoreLink?: string;
  onLearnMore?: (link: string) => void;
  position?: 'top' | 'bottom' | 'left' | 'right';
  children?: React.ReactNode;
}

export const HelpTooltip: React.FC<HelpTooltipProps> = ({
  content,
  title,
  learnMoreLink,
  onLearnMore,
  position = 'top',
  children,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const hideTimeoutRef = useRef<number | null>(null);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  const handleMouseEnter = () => {
    // Clear any pending hide timeout
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    setIsVisible(true);
  };

  const handleMouseLeave = () => {
    // Add a small delay before hiding to prevent flicker
    hideTimeoutRef.current = window.setTimeout(() => {
      setIsVisible(false);
      hideTimeoutRef.current = null;
    }, 100);
  };

  const handleLearnMore = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (learnMoreLink && onLearnMore) {
      onLearnMore(learnMoreLink);
    }
  };

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-3',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-3',
    left: 'right-full top-1/2 -translate-y-1/2 mr-3',
    right: 'left-full top-1/2 -translate-y-1/2 ml-3',
  };

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        className="inline-flex items-center justify-center w-4 h-4 ml-1 text-xs text-gray-400 hover:text-gray-600 rounded-full border border-gray-300 hover:border-gray-400 transition-colors"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleMouseEnter}
        onBlur={handleMouseLeave}
        aria-label="Help"
        data-testid="help-tooltip-trigger"
      >
        ?
      </button>

      {isVisible && (
        <div
          className={`absolute z-50 p-3 bg-white border border-gray-200 rounded-lg shadow-lg ${positionClasses[position]}`}
          role="tooltip"
          data-testid="help-tooltip-content"
          style={{
            minWidth: '16rem',
            maxWidth: '24rem',
            width: 'max-content',
            pointerEvents: 'none',
          }}
        >
          {title && (
            <div className="font-semibold text-sm text-gray-900 mb-1">
              {title}
            </div>
          )}
          <div className="text-sm text-gray-600 leading-relaxed">
            {content}
          </div>
          {learnMoreLink && onLearnMore && (
            <button
              onClick={handleLearnMore}
              className="mt-2 text-xs text-blue-600 hover:text-blue-800 underline"
              data-testid="help-tooltip-learn-more"
              style={{ pointerEvents: 'auto' }}
            >
              Learn more
            </button>
          )}
        </div>
      )}

      {children}
    </div>
  );
};
