/**
 * WelcomeStep Component Tests
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WelcomeStep } from './WelcomeStep'

describe('WelcomeStep', () => {
  it('should render welcome content with judgment-free language', () => {
    const onNext = vi.fn()
    render(<WelcomeStep onNext={onNext} />)

    // Check for encouraging, Steadiness-style messaging
    expect(screen.getByText(/Let's set up your chart of accounts together/i)).toBeInTheDocument()
    expect(screen.getByText(/No accounting degree required/i)).toBeInTheDocument()
    expect(screen.getByText(/Don't worry about getting it perfect/i)).toBeInTheDocument()
  })

  it('should explain what a chart of accounts is in plain English', () => {
    const onNext = vi.fn()
    render(<WelcomeStep onNext={onNext} />)

    expect(screen.getByText(/What is a chart of accounts/i)).toBeInTheDocument()
    expect(screen.getByText(/labeled folders/i)).toBeInTheDocument()
  })

  it('should call onNext when continue button is clicked', async () => {
    const user = userEvent.setup()
    const onNext = vi.fn()
    render(<WelcomeStep onNext={onNext} />)

    const continueButton = screen.getByRole('button', { name: /Let's get started/i })
    await user.click(continueButton)

    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('should describe what the wizard will do', () => {
    const onNext = vi.fn()
    render(<WelcomeStep onNext={onNext} />)

    expect(screen.getByText(/Pick a starting point/i)).toBeInTheDocument()
    expect(screen.getByText(/Customize it/i)).toBeInTheDocument()
    expect(screen.getByText(/Review together/i)).toBeInTheDocument()
  })

  it('should mention estimated time', () => {
    const onNext = vi.fn()
    render(<WelcomeStep onNext={onNext} />)

    expect(screen.getByText(/5-10 minutes/i)).toBeInTheDocument()
  })

  it('should be keyboard accessible', async () => {
    const user = userEvent.setup()
    const onNext = vi.fn()
    render(<WelcomeStep onNext={onNext} />)

    const continueButton = screen.getByRole('button', { name: /Let's get started/i })

    // Tab to button and press Enter
    await user.tab()
    expect(continueButton).toHaveFocus()

    await user.keyboard('{Enter}')
    expect(onNext).toHaveBeenCalledTimes(1)
  })
})
