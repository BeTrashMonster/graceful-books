/**
 * Tutorial Engine Component
 *
 * Main orchestrator for the tutorial system. Manages tutorial state and
 * renders the TutorialOverlay when a tutorial is active.
 *
 * Requirements:
 * - D4: Tutorial System Framework
 * - LEARN-001: Contextual Tutorial System
 */

import { useCallback } from 'react';
import { useTutorial } from '../../hooks/useTutorial';
import { TutorialOverlay } from './TutorialOverlay';

export interface TutorialEngineProps {
  /**
   * Current user ID
   */
  userId: string;
}

/**
 * Tutorial Engine Component
 *
 * Wrap your application with this component to enable tutorials.
 *
 * @example
 * ```tsx
 * <TutorialEngine userId={currentUser.id}>
 *   <YourApp />
 * </TutorialEngine>
 * ```
 */
export function TutorialEngine({ userId }: TutorialEngineProps) {
  const tutorial = useTutorial(userId);

  // Handle skip with confirmation
  const handleSkip = useCallback(() => {
    const confirmed = window.confirm(
      'Skip this tutorial? You can always restart it from the Help menu.'
    );
    if (confirmed) {
      tutorial.skipTutorial(false);
    }
  }, [tutorial]);

  // Handle dismiss with "Don't show again"
  const handleDismiss = useCallback(() => {
    const confirmed = window.confirm(
      'Are you sure you don\'t want to see this tutorial again? You can still access it from the Help menu if you change your mind.'
    );
    if (confirmed) {
      tutorial.skipTutorial(true);
    }
  }, [tutorial]);

  // Handle complete
  const handleComplete = useCallback(async () => {
    await tutorial.completeTutorial();
  }, [tutorial]);

  // Don't render anything if no active tutorial
  if (!tutorial.state.isActive || !tutorial.state.tutorial || !tutorial.currentStep) {
    return null;
  }

  const isFirstStep = tutorial.state.currentStepIndex === 0;
  const isLastStep = tutorial.state.currentStepIndex === tutorial.state.tutorial.steps.length - 1;

  return (
    <TutorialOverlay
      step={tutorial.currentStep}
      currentStepIndex={tutorial.state.currentStepIndex}
      totalSteps={tutorial.state.tutorial.steps.length}
      isFirstStep={isFirstStep}
      isLastStep={isLastStep}
      onNext={isLastStep ? handleComplete : tutorial.nextStep}
      onBack={tutorial.previousStep}
      onSkip={handleSkip}
      onDismiss={handleDismiss}
      onClose={tutorial.stopTutorial}
    />
  );
}

/**
 * Tutorial trigger helper
 *
 * Use this in your components to trigger tutorials based on user actions.
 *
 * @example
 * ```tsx
 * function InvoiceList() {
 *   const tutorial = useTutorial(userId);
 *
 *   useEffect(() => {
 *     // Show tutorial on first visit
 *     tutorial.shouldShowTutorial('first-invoice').then((shouldShow) => {
 *       if (shouldShow) {
 *         tutorial.startTutorial('first-invoice');
 *       }
 *     });
 *   }, []);
 *
 *   return <div data-tutorial="invoice-list">...</div>;
 * }
 * ```
 */
export { useTutorial };
