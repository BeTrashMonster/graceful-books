/**
 * Tutorial Overlay Component
 *
 * Provides the main tutorial overlay with:
 * - Step highlighting with visual distinction
 * - Backdrop for focus
 * - Keyboard navigation support
 * - Skip and "Don't show again" options
 * - Progress tracking display
 *
 * Requirements:
 * - D4: Tutorial System Framework
 * - LEARN-001: Contextual Tutorial System
 * - WCAG 2.1 AA accessibility compliance
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import type { TutorialStep } from '../../types/tutorial.types';
import { StepPosition } from '../../types/tutorial.types';
import styles from './TutorialOverlay.module.css';

export interface TutorialOverlayProps {
  /**
   * Current step to display
   */
  step: TutorialStep;

  /**
   * Current step index (0-based)
   */
  currentStepIndex: number;

  /**
   * Total number of steps
   */
  totalSteps: number;

  /**
   * Whether this is the first step
   */
  isFirstStep: boolean;

  /**
   * Whether this is the last step
   */
  isLastStep: boolean;

  /**
   * Callback when next is clicked
   */
  onNext: () => void;

  /**
   * Callback when back is clicked
   */
  onBack: () => void;

  /**
   * Callback when skip is clicked
   */
  onSkip: () => void;

  /**
   * Callback when "Don't show again" is clicked
   */
  onDismiss: () => void;

  /**
   * Callback when tutorial is closed
   */
  onClose: () => void;
}

/**
 * Calculate tooltip position relative to highlighted element
 */
function calculateTooltipPosition(
  element: HTMLElement | null,
  position: StepPosition,
  tooltipWidth: number = 400,
  tooltipHeight: number = 200
): { top: number; left: number; position: StepPosition } {
  if (!element) {
    // Center on screen if no element
    return {
      top: window.innerHeight / 2 - tooltipHeight / 2,
      left: window.innerWidth / 2 - tooltipWidth / 2,
      position: StepPosition.CENTER,
    };
  }

  const rect = element.getBoundingClientRect();
  const padding = 16;

  let top = 0;
  let left = 0;
  let actualPosition = position;

  switch (position) {
    case StepPosition.TOP:
      top = rect.top - tooltipHeight - padding;
      left = rect.left + rect.width / 2 - tooltipWidth / 2;
      // Fallback to bottom if not enough space
      if (top < 0) {
        top = rect.bottom + padding;
        actualPosition = StepPosition.BOTTOM;
      }
      break;

    case StepPosition.BOTTOM:
      top = rect.bottom + padding;
      left = rect.left + rect.width / 2 - tooltipWidth / 2;
      // Fallback to top if not enough space
      if (top + tooltipHeight > window.innerHeight) {
        top = rect.top - tooltipHeight - padding;
        actualPosition = StepPosition.TOP;
      }
      break;

    case StepPosition.LEFT:
      top = rect.top + rect.height / 2 - tooltipHeight / 2;
      left = rect.left - tooltipWidth - padding;
      // Fallback to right if not enough space
      if (left < 0) {
        left = rect.right + padding;
        actualPosition = StepPosition.RIGHT;
      }
      break;

    case StepPosition.RIGHT:
      top = rect.top + rect.height / 2 - tooltipHeight / 2;
      left = rect.right + padding;
      // Fallback to left if not enough space
      if (left + tooltipWidth > window.innerWidth) {
        left = rect.left - tooltipWidth - padding;
        actualPosition = StepPosition.LEFT;
      }
      break;

    case StepPosition.AUTO:
      // Try positions in order: bottom, top, right, left
      if (rect.bottom + tooltipHeight + padding < window.innerHeight) {
        top = rect.bottom + padding;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        actualPosition = StepPosition.BOTTOM;
      } else if (rect.top - tooltipHeight - padding > 0) {
        top = rect.top - tooltipHeight - padding;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        actualPosition = StepPosition.TOP;
      } else if (rect.right + tooltipWidth + padding < window.innerWidth) {
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.right + padding;
        actualPosition = StepPosition.RIGHT;
      } else {
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.left - tooltipWidth - padding;
        actualPosition = StepPosition.LEFT;
      }
      break;

    case StepPosition.CENTER:
    default:
      top = window.innerHeight / 2 - tooltipHeight / 2;
      left = window.innerWidth / 2 - tooltipWidth / 2;
      actualPosition = StepPosition.CENTER;
      break;
  }

  // Clamp to viewport
  top = Math.max(padding, Math.min(top, window.innerHeight - tooltipHeight - padding));
  left = Math.max(padding, Math.min(left, window.innerWidth - tooltipWidth - padding));

  return { top, left, position: actualPosition };
}

/**
 * Tutorial Overlay Component
 */
export function TutorialOverlay({
  step,
  currentStepIndex,
  totalSteps,
  isFirstStep,
  isLastStep,
  onNext,
  onBack,
  onSkip,
  onDismiss,
  onClose,
}: TutorialOverlayProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [highlightedElement, setHighlightedElement] = useState<HTMLElement | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0, position: StepPosition.CENTER });
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);

  // Find and highlight the target element
  useEffect(() => {
    if (!step.element) {
      setHighlightedElement(null);
      setSpotlightRect(null);
      return;
    }

    const element = document.querySelector<HTMLElement>(step.element);
    if (element) {
      setHighlightedElement(element);
      setSpotlightRect(element.getBoundingClientRect());

      // Scroll element into view
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center',
      });

      // Execute onShow callback if provided
      if (step.onShow) {
        Promise.resolve(step.onShow()).catch((err) => {
          console.error('Error in step onShow callback:', err);
        });
      }
    } else {
      console.warn(`Tutorial step element not found: ${step.element}`);
      setHighlightedElement(null);
      setSpotlightRect(null);
    }
  }, [step.element, step.onShow]);

  // Calculate tooltip position
  useEffect(() => {
    if (!tooltipRef.current) return;

    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const position = calculateTooltipPosition(
      highlightedElement,
      step.position,
      tooltipRect.width,
      tooltipRect.height
    );

    setTooltipPosition(position);
  }, [highlightedElement, step.position]);

  // Update positions on window resize
  useEffect(() => {
    const handleResize = () => {
      if (highlightedElement) {
        setSpotlightRect(highlightedElement.getBoundingClientRect());
      }

      if (tooltipRef.current) {
        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        const position = calculateTooltipPosition(
          highlightedElement,
          step.position,
          tooltipRect.width,
          tooltipRect.height
        );
        setTooltipPosition(position);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [highlightedElement, step.position]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowRight':
        case 'Enter':
          if (!isLastStep) {
            onNext();
          }
          break;
        case 'ArrowLeft':
          if (!isFirstStep) {
            onBack();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isFirstStep, isLastStep, onNext, onBack, onClose]);

  // Prevent body scroll when tutorial is active
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Generate progress dots
  const progressDots = Array.from({ length: totalSteps }, (_, i) => {
    const isActive = i === currentStepIndex;
    const isCompleted = i < currentStepIndex;

    return (
      <div
        key={i}
        className={clsx(styles.progressDot, {
          [styles.active]: isActive,
          [styles.completed]: isCompleted,
        })}
        aria-label={`Step ${i + 1} of ${totalSteps}${isActive ? ' (current)' : ''}${isCompleted ? ' (completed)' : ''}`}
      />
    );
  });

  const overlayContent = (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
      {/* Spotlight for highlighted element */}
      {spotlightRect && (
        <div
          className={clsx(styles.spotlight, {
            [styles.allowInteraction]: step.allowInteraction,
          })}
          style={{
            top: `${spotlightRect.top}px`,
            left: `${spotlightRect.left}px`,
            width: `${spotlightRect.width}px`,
            height: `${spotlightRect.height}px`,
          }}
          aria-hidden="true"
        />
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className={clsx(styles.tooltip, {
          [styles.top]: tooltipPosition.position === StepPosition.TOP,
          [styles.bottom]: tooltipPosition.position === StepPosition.BOTTOM,
          [styles.left]: tooltipPosition.position === StepPosition.LEFT,
          [styles.right]: tooltipPosition.position === StepPosition.RIGHT,
          [styles.center]: tooltipPosition.position === StepPosition.CENTER,
        })}
        style={{
          top: `${tooltipPosition.top}px`,
          left: `${tooltipPosition.left}px`,
        }}
      >
        {/* Header */}
        <div className={styles.tooltipHeader}>
          <h2 id="tutorial-title" className={styles.tooltipTitle}>
            {step.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className={styles.closeButton}
            aria-label="Close tutorial"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className={styles.tooltipBody}>
          {step.image && (
            <img src={step.image} alt="" className={styles.tooltipImage} />
          )}
          <p className={styles.tooltipDescription}>{step.description}</p>
        </div>

        {/* Footer */}
        <div className={styles.tooltipFooter}>
          <div className={styles.footerLeft}>
            <div className={styles.progressIndicator}>
              <div className={styles.progressDots}>{progressDots}</div>
              <span>
                {currentStepIndex + 1} of {totalSteps}
              </span>
            </div>
          </div>

          <div className={styles.footerRight}>
            {!isFirstStep && (
              <button
                type="button"
                onClick={onBack}
                className={clsx(styles.button, styles.buttonSecondary)}
              >
                Back
              </button>
            )}

            {!isLastStep ? (
              <>
                <button
                  type="button"
                  onClick={onSkip}
                  className={clsx(styles.button, styles.buttonText)}
                >
                  Skip
                </button>
                <button
                  type="button"
                  onClick={onNext}
                  className={clsx(styles.button, styles.buttonPrimary)}
                >
                  Next →
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onDismiss}
                  className={clsx(styles.button, styles.buttonText)}
                >
                  Don't show again
                </button>
                <button
                  type="button"
                  onClick={onNext}
                  className={clsx(styles.button, styles.buttonPrimary)}
                >
                  Complete
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(overlayContent, document.body);
}
