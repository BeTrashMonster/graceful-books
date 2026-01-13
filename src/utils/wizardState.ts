/**
 * Wizard State Management Utilities
 *
 * Provides utilities for saving and restoring wizard progress.
 * Supports localStorage-based persistence with CRDT compatibility.
 */

import type { WizardProgress, WizardState, WizardStep } from '../types/wizard.types'

const WIZARD_STORAGE_PREFIX = 'graceful-books-wizard-'

/**
 * Save wizard progress to localStorage
 */
export function saveWizardProgress(progress: WizardProgress): void {
  try {
    const key = `${WIZARD_STORAGE_PREFIX}${progress.wizardId}-${progress.companyId}`
    localStorage.setItem(key, JSON.stringify(progress))
  } catch (error) {
    console.error('Failed to save wizard progress:', error)
  }
}

/**
 * Load wizard progress from localStorage
 */
export function loadWizardProgress(
  wizardId: string,
  companyId: string
): WizardProgress | null {
  try {
    const key = `${WIZARD_STORAGE_PREFIX}${wizardId}-${companyId}`
    const stored = localStorage.getItem(key)

    if (!stored) return null

    const progress = JSON.parse(stored) as WizardProgress

    // Restore Date objects
    progress.lastUpdated = new Date(progress.lastUpdated)
    progress.createdAt = new Date(progress.createdAt)

    return progress
  } catch (error) {
    console.error('Failed to load wizard progress:', error)
    return null
  }
}

/**
 * Clear wizard progress from localStorage
 */
export function clearWizardProgress(wizardId: string, companyId: string): void {
  try {
    const key = `${WIZARD_STORAGE_PREFIX}${wizardId}-${companyId}`
    localStorage.removeItem(key)
  } catch (error) {
    console.error('Failed to clear wizard progress:', error)
  }
}

/**
 * Calculate wizard completion percentage
 */
export function calculateWizardProgress(steps: WizardStep[]): number {
  if (steps.length === 0) return 0

  const completedSteps = steps.filter(
    (step) => step.status === 'completed' || step.status === 'skipped'
  ).length

  return Math.round((completedSteps / steps.length) * 100)
}

/**
 * Get next incomplete step
 */
export function getNextIncompleteStep(steps: WizardStep[]): WizardStep | null {
  return steps.find((step) => step.status === 'pending' || step.status === 'active') || null
}

/**
 * Check if wizard can proceed to next step
 */
export function canProceedToNextStep(currentStep: WizardStep): boolean {
  // Can proceed if current step is completed or optional
  return currentStep.status === 'completed' || currentStep.isOptional === true
}

/**
 * Update step status in wizard state
 */
export function updateStepStatus(
  steps: WizardStep[],
  stepId: string,
  status: WizardStep['status']
): WizardStep[] {
  return steps.map((step) =>
    step.id === stepId ? { ...step, status } : step
  )
}

/**
 * Initialize wizard state
 */
export function initializeWizardState(
  wizardId: string,
  steps: Omit<WizardStep, 'status'>[]
): WizardState {
  const now = new Date()

  return {
    wizardId,
    currentStepId: steps[0]?.id || '',
    steps: steps.map((step, index) => ({
      ...step,
      status: index === 0 ? 'active' : 'pending',
    })),
    data: {},
    startedAt: now,
    lastModifiedAt: now,
  }
}

/**
 * Navigate to next step
 */
export function navigateToNextStep(state: WizardState): WizardState {
  const currentIndex = state.steps.findIndex((s) => s.id === state.currentStepId)
  const nextStep = state.steps[currentIndex + 1]

  if (!nextStep) {
    // No next step - wizard is complete
    return {
      ...state,
      completedAt: new Date(),
      lastModifiedAt: new Date(),
    }
  }

  return {
    ...state,
    currentStepId: nextStep.id,
    steps: state.steps.map((step, index) => ({
      ...step,
      status:
        index === currentIndex
          ? 'completed'
          : index === currentIndex + 1
          ? 'active'
          : step.status,
    })),
    lastModifiedAt: new Date(),
  }
}

/**
 * Navigate to previous step
 */
export function navigateToPreviousStep(state: WizardState): WizardState {
  const currentIndex = state.steps.findIndex((s) => s.id === state.currentStepId)
  const previousStep = state.steps[currentIndex - 1]

  if (!previousStep) {
    // Already at first step
    return state
  }

  return {
    ...state,
    currentStepId: previousStep.id,
    steps: state.steps.map((step, index) => ({
      ...step,
      status:
        index === currentIndex - 1
          ? 'active'
          : index === currentIndex
          ? 'pending'
          : step.status,
    })),
    lastModifiedAt: new Date(),
  }
}

/**
 * Jump to specific step
 */
export function navigateToStep(state: WizardState, stepId: string): WizardState {
  const stepIndex = state.steps.findIndex((s) => s.id === stepId)

  if (stepIndex === -1) {
    // Step not found
    return state
  }

  return {
    ...state,
    currentStepId: stepId,
    steps: state.steps.map((step, index) => ({
      ...step,
      status: index === stepIndex ? 'active' : step.status,
    })),
    lastModifiedAt: new Date(),
  }
}

/**
 * Update wizard data
 */
export function updateWizardData(
  state: WizardState,
  updates: Record<string, any>
): WizardState {
  return {
    ...state,
    data: {
      ...state.data,
      ...updates,
    },
    lastModifiedAt: new Date(),
  }
}
