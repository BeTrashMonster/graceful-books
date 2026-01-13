/**
 * Chart of Accounts Wizard Component Tests
 *
 * Tests for the COA setup wizard UI
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CoaWizard } from './CoaWizard'

// Mock wizard state utilities
vi.mock('../../utils/wizardState')

describe('CoaWizard', () => {
  const mockOnComplete = vi.fn()
  const mockOnCancel = vi.fn()

  const defaultProps = {
    companyId: 'test-company',
    onComplete: mockOnComplete,
    onCancel: mockOnCancel,
  }

  it('should render without crashing', () => {
    render(<CoaWizard {...defaultProps} />)

    // Wizard should render
    expect(screen.getByText(/welcome/i)).toBeInTheDocument()
  })

  it('should display progress indicator', () => {
    render(<CoaWizard {...defaultProps} />)

    // Should show step titles
    expect(screen.getByText('Welcome')).toBeInTheDocument()
    expect(screen.getByText('Choose Your Template')).toBeInTheDocument()
  })

  it('should have navigation buttons', () => {
    render(<CoaWizard {...defaultProps} />)

    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)
  })
})
