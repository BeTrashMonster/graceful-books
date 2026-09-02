/**
 * WorksheetSidebar Component
 *
 * Right sidebar for worksheet navigation with:
 * - Progress indicator
 * - Step navigation (click to jump)
 * - Skip for Now link
 * - Calculator widget
 */

import { WorksheetCalculator } from './WorksheetCalculator';
import styles from './WorksheetSidebar.module.css';

export type WorksheetStep = 'products' | 'recipes' | 'invoices' | 'review';

interface StepConfig {
  id: WorksheetStep;
  label: string;
  shortLabel: string;
}

const STEPS: StepConfig[] = [
  { id: 'products', label: 'Your Products', shortLabel: 'Products' },
  { id: 'recipes', label: 'Product Recipes', shortLabel: 'Recipes' },
  { id: 'invoices', label: 'Supplier Invoices', shortLabel: 'Invoices' },
  { id: 'review', label: 'Review & Submit', shortLabel: 'Review' },
];

interface WorksheetSidebarProps {
  currentStep: WorksheetStep;
  onStepClick: (step: WorksheetStep) => void;
  onSkip: () => void;
  onContinue: () => void;
  canNavigateToStep: (step: WorksheetStep) => boolean;
  canContinue: boolean;
}

export function WorksheetSidebar({
  currentStep,
  onStepClick,
  onSkip,
  onContinue,
  canNavigateToStep,
  canContinue,
}: WorksheetSidebarProps) {
  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep);
  const progress = ((currentStepIndex + 1) / STEPS.length) * 100;

  const getStepStatus = (step: StepConfig, index: number): 'completed' | 'current' | 'pending' => {
    if (index < currentStepIndex) return 'completed';
    if (index === currentStepIndex) return 'current';
    return 'pending';
  };

  const handleStepClick = (step: StepConfig) => {
    if (canNavigateToStep(step.id)) {
      onStepClick(step.id);
    }
  };

  return (
    <aside className={styles.sidebar} role="complementary" aria-label="Worksheet navigation">
      {/* Progress */}
      <div className={styles.progressSection}>
        <div className={styles.progressLabel}>
          Progress: {Math.round(progress)}%
        </div>
        <div
          className={styles.progressBar}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={styles.progressFill}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <nav className={styles.stepsNav} role="navigation" aria-label="Worksheet steps">
        <ul className={styles.stepsList}>
          {STEPS.map((step, index) => {
            const status = getStepStatus(step, index);
            const canClick = canNavigateToStep(step.id);

            return (
              <li key={step.id}>
                <button
                  type="button"
                  className={`${styles.stepItem} ${styles[status]}`}
                  onClick={() => handleStepClick(step)}
                  disabled={!canClick}
                  aria-current={status === 'current' ? 'step' : undefined}
                  aria-disabled={!canClick}
                >
                  <span className={styles.stepNumber}>
                    {status === 'completed' ? (
                      <span className={styles.checkmark} aria-hidden="true">
                        &#10003;
                      </span>
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span className={styles.stepLabel}>{step.label}</span>
                  {status === 'current' && (
                    <span className={styles.currentIndicator} aria-hidden="true">
                      &#8594;
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Continue Button */}
      <div className={styles.continueSection}>
        <button
          type="button"
          className={styles.continueButton}
          onClick={onContinue}
          disabled={!canContinue}
        >
          {currentStep === 'review' ? 'Submit' : 'Continue'}
          <span className={styles.continueArrow} aria-hidden="true">&#8594;</span>
        </button>
      </div>

      {/* Skip for Now */}
      <div className={styles.skipSection}>
        <button
          type="button"
          className={styles.skipButton}
          onClick={onSkip}
        >
          Skip for Now
          <span className={styles.skipArrow} aria-hidden="true">&#8594;</span>
        </button>
        <p className={styles.skipHint}>
          You can complete this later in the app
        </p>
      </div>

      {/* Calculator */}
      <div className={styles.calculatorSection}>
        <h3 className={styles.calculatorTitle}>Calculator</h3>
        <WorksheetCalculator />
      </div>
    </aside>
  );
}
