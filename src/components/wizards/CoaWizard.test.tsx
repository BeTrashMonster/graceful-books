/**
 * Chart of Accounts Wizard Component Tests
 *
 * Tests for the COA setup wizard UI
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CoaWizard } from './CoaWizard'
import type { WizardState, WizardStep } from '../../types/wizard.types'

// Mock wizard state utilities with proper implementations
vi.mock('../../utils/wizardState', () => ({
  initializeWizardState: (wizardId: string, steps: Omit<WizardStep, 'status'>[]) => {
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
    } as WizardState
  },
  navigateToNextStep: (state: WizardState) => state,
  navigateToPreviousStep: (state: WizardState) => state,
  updateWizardData: (state: WizardState, updates: Record<string, any>) => ({
    ...state,
    data: { ...state.data, ...updates },
  }),
  saveWizardProgress: vi.fn(),
  loadWizardProgress: vi.fn(() => null),
  clearWizardProgress: vi.fn(),
}))

describe('CoaWizard', () => {
  const mockOnComplete = vi.fn()
  const mockOnCancel = vi.fn()

  const defaultProps = {
    companyId: 'test-company',
    onComplete: mockOnComplete,
    onCancel: mockOnCancel,
  }

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
    mockOnComplete.mockClear()
    mockOnCancel.mockClear()
  })

  it('should render without crashing', () => {
    render(<CoaWizard {...defaultProps} />)

    // Wizard should render - look for the welcome heading
    expect(screen.getByRole('heading', { name: /welcome/i })).toBeInTheDocument()
  })

  it('should display progress indicator', () => {
    render(<CoaWizard {...defaultProps} />)

    // Should show step titles in progress indicator
    expect(screen.getByText('Choose Your Template')).toBeInTheDocument()
    expect(screen.getByText('Customize Accounts')).toBeInTheDocument()
    expect(screen.getByText('Review & Confirm')).toBeInTheDocument()
  })

  it('should have navigation buttons', () => {
    render(<CoaWizard {...defaultProps} />)

    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)
  })
})
