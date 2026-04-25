/**
 * CPG Worksheet Wizard
 *
 * Embedded version of the CPG quickstart worksheet for signup flow
 * Adapted from cpg-quickstart standalone app
 */

import { useState } from 'react';
import type { WorksheetData, WizardStep } from '../../types/cpg-quickstart.types';
import { WelcomeStep } from './wizard/WelcomeStep';
import { CategoriesStep } from './wizard/CategoriesStep';
import { ProductsStep } from './wizard/ProductsStep';
import { RecipesStep } from './wizard/RecipesStep';
import { InvoicesStep } from './wizard/InvoicesStep';
import { ReviewStep } from './wizard/ReviewStep';
import styles from './CPGWorksheetWizard.module.css';

interface CPGWorksheetWizardProps {
  onComplete: (data: WorksheetData) => void;
  onSkip: () => void;
}

export function CPGWorksheetWizard({ onComplete, onSkip }: CPGWorksheetWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('welcome');
  const [data, setData] = useState<WorksheetData>({
    version: '1.0.0',
    created_at: new Date().toISOString(),
    categories: [],
    finished_products: [],
    recipes: [],
    invoices: [],
  });

  const steps: WizardStep[] = ['welcome', 'categories', 'products', 'recipes', 'invoices', 'review'];
  const currentStepIndex = steps.indexOf(currentStep);

  const goToStep = (step: WizardStep) => {
    setCurrentStep(step);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const nextStep = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      goToStep(steps[nextIndex]);
    }
  };

  const prevStep = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      goToStep(steps[prevIndex]);
    }
  };

  const updateData = (updates: Partial<WorksheetData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  };

  const handleComplete = () => {
    onComplete(data);
  };

  return (
    <div className={styles.wizard}>
      {/* Skip Button - always visible except on welcome and review */}
      {currentStep !== 'welcome' && currentStep !== 'review' && (
        <button onClick={onSkip} className={styles.skipButton}>
          Skip for Now
        </button>
      )}

      {/* Step Content */}
      <div className={styles.stepContent}>
        {currentStep === 'welcome' && (
          <WelcomeStep onNext={nextStep} onSkip={onSkip} />
        )}
        {currentStep === 'categories' && (
          <CategoriesStep
            data={data}
            updateData={updateData}
            onNext={nextStep}
            onPrev={prevStep}
          />
        )}
        {currentStep === 'products' && (
          <ProductsStep
            data={data}
            updateData={updateData}
            onNext={nextStep}
            onPrev={prevStep}
          />
        )}
        {currentStep === 'recipes' && (
          <RecipesStep
            data={data}
            updateData={updateData}
            onNext={nextStep}
            onPrev={prevStep}
          />
        )}
        {currentStep === 'invoices' && (
          <InvoicesStep
            data={data}
            updateData={updateData}
            onNext={nextStep}
            onPrev={prevStep}
          />
        )}
        {currentStep === 'review' && (
          <ReviewStep
            data={data}
            goToStep={goToStep}
            onComplete={handleComplete}
            onSkip={onSkip}
          />
        )}
      </div>

      {/* Progress Bar */}
      {currentStep !== 'welcome' && currentStep !== 'review' && (
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${((currentStepIndex) / (steps.length - 1)) * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}
