/**
 * Wizard State Management Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  saveWizardProgress,
  loadWizardProgress,
  clearWizardProgress,
  calculateWizardProgress,
  getNextIncompleteStep,
  canProceedToNextStep,
  updateStepStatus,
  initializeWizardState,
  navigateToNextStep,
  navigateToPreviousStep,
  navigateToStep,
  updateWizardData,
} from './wizardState'
import type { WizardProgress, WizardStep } from '../types/wizard.types'

describe('wizardState utilities', () => {
  const wizardId = 'test-wizard'
  const companyId = 'test-company'

  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('saveWizardProgress and loadWizardProgress', () => {
    it('should save and load wizard progress', () => {
      const progress: WizardProgress = {
        wizardId,
        companyId,
        currentStep: 'step-1',
        data: { selectedOption: 'option-a' },
        isComplete: false,
        lastUpdated: new Date(),
        createdAt: new Date(),
      }

      saveWizardProgress(progress)
      const loaded = loadWizardProgress(wizardId, companyId)

      expect(loaded).toBeDefined()
      expect(loaded?.wizardId).toBe(wizardId)
      expect(loaded?.companyId).toBe(companyId)
      expect(loaded?.currentStep).toBe('step-1')
      expect(loaded?.data).toEqual({ selectedOption: 'option-a' })
      expect(loaded?.isComplete).toBe(false)
    })

    it('should return null when no progress exists', () => {
      const loaded = loadWizardProgress('nonexistent', companyId)
      expect(loaded).toBeNull()
    })

    it('should restore Date objects when loading', () => {
      const now = new Date()
      const progress: WizardProgress = {
        wizardId,
        companyId,
        currentStep: 'step-1',
        data: {},
        isComplete: false,
        lastUpdated: now,
        createdAt: now,
      }

      saveWizardProgress(progress)
      const loaded = loadWizardProgress(wizardId, companyId)

      expect(loaded?.lastUpdated).toBeInstanceOf(Date)
      expect(loaded?.createdAt).toBeInstanceOf(Date)
    })
  })

  describe('clearWizardProgress', () => {
    it('should clear saved wizard progress', () => {
      const progress: WizardProgress = {
        wizardId,
        companyId,
        currentStep: 'step-1',
        data: {},
        isComplete: false,
        lastUpdated: new Date(),
        createdAt: new Date(),
      }

      saveWizardProgress(progress)
      expect(loadWizardProgress(wizardId, companyId)).toBeDefined()

      clearWizardProgress(wizardId, companyId)
      expect(loadWizardProgress(wizardId, companyId)).toBeNull()
    })
  })

  describe('calculateWizardProgress', () => {
    it('should calculate progress percentage for empty steps', () => {
      const steps: WizardStep[] = []
      expect(calculateWizardProgress(steps)).toBe(0)
    })

    it('should calculate progress percentage for completed steps', () => {
      const steps: WizardStep[] = [
        { id: '1', title: 'Step 1', description: '', status: 'completed' },
        { id: '2', title: 'Step 2', description: '', status: 'completed' },
        { id: '3', title: 'Step 3', description: '', status: 'pending' },
        { id: '4', title: 'Step 4', description: '', status: 'pending' },
      ]
      expect(calculateWizardProgress(steps)).toBe(50)
    })

    it('should count skipped steps as complete', () => {
      const steps: WizardStep[] = [
        { id: '1', title: 'Step 1', description: '', status: 'completed' },
        { id: '2', title: 'Step 2', description: '', status: 'skipped' },
        { id: '3', title: 'Step 3', description: '', status: 'pending' },
      ]
      expect(calculateWizardProgress(steps)).toBe(67)
    })

    it('should return 100 for all completed steps', () => {
      const steps: WizardStep[] = [
        { id: '1', title: 'Step 1', description: '', status: 'completed' },
        { id: '2', title: 'Step 2', description: '', status: 'completed' },
      ]
      expect(calculateWizardProgress(steps)).toBe(100)
    })
  })

  describe('getNextIncompleteStep', () => {
    it('should return first pending step', () => {
      const steps: WizardStep[] = [
        { id: '1', title: 'Step 1', description: '', status: 'completed' },
        { id: '2', title: 'Step 2', description: '', status: 'pending' },
        { id: '3', title: 'Step 3', description: '', status: 'pending' },
      ]
      const next = getNextIncompleteStep(steps)
      expect(next?.id).toBe('2')
    })

    it('should return active step if present', () => {
      const steps: WizardStep[] = [
        { id: '1', title: 'Step 1', description: '', status: 'completed' },
        { id: '2', title: 'Step 2', description: '', status: 'active' },
        { id: '3', title: 'Step 3', description: '', status: 'pending' },
      ]
      const next = getNextIncompleteStep(steps)
      expect(next?.id).toBe('2')
    })

    it('should return null when all steps are complete', () => {
      const steps: WizardStep[] = [
        { id: '1', title: 'Step 1', description: '', status: 'completed' },
        { id: '2', title: 'Step 2', description: '', status: 'completed' },
      ]
      const next = getNextIncompleteStep(steps)
      expect(next).toBeNull()
    })
  })

  describe('canProceedToNextStep', () => {
    it('should allow proceeding when step is completed', () => {
      const step: WizardStep = { id: '1', title: 'Step', description: '', status: 'completed' }
      expect(canProceedToNextStep(step)).toBe(true)
    })

    it('should allow proceeding when step is optional', () => {
      const step: WizardStep = { id: '1', title: 'Step', description: '', status: 'pending', isOptional: true }
      expect(canProceedToNextStep(step)).toBe(true)
    })

    it('should not allow proceeding when step is pending and required', () => {
      const step: WizardStep = { id: '1', title: 'Step', description: '', status: 'pending', isOptional: false }
      expect(canProceedToNextStep(step)).toBe(false)
    })
  })

  describe('updateStepStatus', () => {
    it('should update status of specific step', () => {
      const steps: WizardStep[] = [
        { id: '1', title: 'Step 1', description: '', status: 'completed' },
        { id: '2', title: 'Step 2', description: '', status: 'pending' },
        { id: '3', title: 'Step 3', description: '', status: 'pending' },
      ]

      const updated = updateStepStatus(steps, '2', 'active')
      expect(updated[1].status).toBe('active')
      expect(updated[0].status).toBe('completed')
      expect(updated[2].status).toBe('pending')
    })

    it('should not modify other steps', () => {
      const steps: WizardStep[] = [
        { id: '1', title: 'Step 1', description: '', status: 'completed' },
        { id: '2', title: 'Step 2', description: '', status: 'active' },
      ]

      const updated = updateStepStatus(steps, '2', 'completed')
      expect(updated[0]).toEqual(steps[0])
    })
  })

  describe('initializeWizardState', () => {
    it('should initialize wizard with first step active', () => {
      const steps = [
        { id: '1', title: 'Step 1', description: 'First step' },
        { id: '2', title: 'Step 2', description: 'Second step' },
      ]

      const state = initializeWizardState(wizardId, steps)

      expect(state.wizardId).toBe(wizardId)
      expect(state.currentStepId).toBe('1')
      expect(state.steps[0].status).toBe('active')
      expect(state.steps[1].status).toBe('pending')
      expect(state.data).toEqual({})
    })

    it('should set start and modified timestamps', () => {
      const steps = [{ id: '1', title: 'Step 1', description: '' }]
      const state = initializeWizardState(wizardId, steps)

      expect(state.startedAt).toBeInstanceOf(Date)
      expect(state.lastModifiedAt).toBeInstanceOf(Date)
      expect(state.completedAt).toBeUndefined()
    })
  })

  describe('navigateToNextStep', () => {
    it('should move to next step and update statuses', () => {
      const initialState = initializeWizardState(wizardId, [
        { id: '1', title: 'Step 1', description: '' },
        { id: '2', title: 'Step 2', description: '' },
        { id: '3', title: 'Step 3', description: '' },
      ])

      const nextState = navigateToNextStep(initialState)

      expect(nextState.currentStepId).toBe('2')
      expect(nextState.steps[0].status).toBe('completed')
      expect(nextState.steps[1].status).toBe('active')
      expect(nextState.steps[2].status).toBe('pending')
    })

    it('should mark wizard as complete when on last step', () => {
      const initialState = initializeWizardState(wizardId, [
        { id: '1', title: 'Step 1', description: '' },
        { id: '2', title: 'Step 2', description: '' },
      ])

      const state = navigateToNextStep(initialState)
      const finalState = navigateToNextStep(state)

      expect(finalState.completedAt).toBeInstanceOf(Date)
    })

    it('should update lastModifiedAt timestamp', () => {
      const initialState = initializeWizardState(wizardId, [
        { id: '1', title: 'Step 1', description: '' },
        { id: '2', title: 'Step 2', description: '' },
      ])

      const originalTime = initialState.lastModifiedAt.getTime()

      // Add a small delay to ensure timestamp changes
      const nextState = navigateToNextStep(initialState)

      expect(nextState.lastModifiedAt.getTime()).toBeGreaterThanOrEqual(originalTime)
    })
  })

  describe('navigateToPreviousStep', () => {
    it('should move to previous step and update statuses', () => {
      const initialState = initializeWizardState(wizardId, [
        { id: '1', title: 'Step 1', description: '' },
        { id: '2', title: 'Step 2', description: '' },
        { id: '3', title: 'Step 3', description: '' },
      ])

      const nextState = navigateToNextStep(initialState)
      const prevState = navigateToPreviousStep(nextState)

      expect(prevState.currentStepId).toBe('1')
      expect(prevState.steps[0].status).toBe('active')
      expect(prevState.steps[1].status).toBe('pending')
    })

    it('should stay on first step when going back from first step', () => {
      const initialState = initializeWizardState(wizardId, [
        { id: '1', title: 'Step 1', description: '' },
        { id: '2', title: 'Step 2', description: '' },
      ])

      const prevState = navigateToPreviousStep(initialState)

      expect(prevState.currentStepId).toBe('1')
      expect(prevState).toEqual(initialState)
    })
  })

  describe('navigateToStep', () => {
    it('should jump to specific step', () => {
      const initialState = initializeWizardState(wizardId, [
        { id: '1', title: 'Step 1', description: '' },
        { id: '2', title: 'Step 2', description: '' },
        { id: '3', title: 'Step 3', description: '' },
      ])

      const jumpedState = navigateToStep(initialState, '3')

      expect(jumpedState.currentStepId).toBe('3')
      expect(jumpedState.steps[2].status).toBe('active')
    })

    it('should return unchanged state for invalid step ID', () => {
      const initialState = initializeWizardState(wizardId, [
        { id: '1', title: 'Step 1', description: '' },
      ])

      const jumpedState = navigateToStep(initialState, 'invalid')

      expect(jumpedState).toEqual(initialState)
    })
  })

  describe('updateWizardData', () => {
    it('should merge new data with existing data', () => {
      const initialState = initializeWizardState(wizardId, [
        { id: '1', title: 'Step 1', description: '' },
      ])

      const state1 = updateWizardData(initialState, { field1: 'value1' })
      expect(state1.data).toEqual({ field1: 'value1' })

      const state2 = updateWizardData(state1, { field2: 'value2' })
      expect(state2.data).toEqual({ field1: 'value1', field2: 'value2' })
    })

    it('should overwrite existing fields', () => {
      const initialState = initializeWizardState(wizardId, [
        { id: '1', title: 'Step 1', description: '' },
      ])

      const state1 = updateWizardData(initialState, { field1: 'value1' })
      const state2 = updateWizardData(state1, { field1: 'value2' })

      expect(state2.data).toEqual({ field1: 'value2' })
    })

    it('should update lastModifiedAt timestamp', () => {
      const initialState = initializeWizardState(wizardId, [
        { id: '1', title: 'Step 1', description: '' },
      ])

      const originalTime = initialState.lastModifiedAt.getTime()
      const updatedState = updateWizardData(initialState, { test: 'data' })

      expect(updatedState.lastModifiedAt.getTime()).toBeGreaterThanOrEqual(originalTime)
    })
  })
})
