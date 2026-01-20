/**
 * TemplateSelectionStep Component Tests
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemplateSelectionStep } from './TemplateSelectionStep'
import { INDUSTRY_TEMPLATES } from '../../../data/industryTemplates'

describe('TemplateSelectionStep', () => {
  const mockTemplates = INDUSTRY_TEMPLATES.slice(0, 3) // Use first 3 templates for tests

  it('should render all provided templates', () => {
    const onSelect = vi.fn()
    const onBack = vi.fn()

    render(
      <TemplateSelectionStep
        templates={mockTemplates}
        onSelect={onSelect}
        onBack={onBack}
      />
    )

    mockTemplates.forEach((template) => {
      expect(screen.getByText(template.friendlyName)).toBeInTheDocument()
      expect(screen.getByText(template.description)).toBeInTheDocument()
    })
  })

  it('should show account count for each template', () => {
    const onSelect = vi.fn()
    const onBack = vi.fn()

    render(
      <TemplateSelectionStep
        templates={mockTemplates}
        onSelect={onSelect}
        onBack={onBack}
      />
    )

    // Multiple templates may have the same account count, so use getAllByText
    mockTemplates.forEach((template) => {
      const accountCounts = screen.getAllByText(`${template.accounts.length} accounts`)
      expect(accountCounts.length).toBeGreaterThan(0)
    })
  })

  it('should allow selecting a template', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const onBack = vi.fn()

    render(
      <TemplateSelectionStep
        templates={mockTemplates}
        onSelect={onSelect}
        onBack={onBack}
      />
    )

    const templateName = screen.getAllByText(mockTemplates[0].friendlyName)[0]!
    const templateCard = templateName.closest('button')!
    await user.click(templateCard)

    // Template should be selected visually
    expect(templateCard).toHaveAttribute('aria-pressed', 'true')
  })

  it('should show preview when template is selected', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const onBack = vi.fn()

    render(
      <TemplateSelectionStep
        templates={mockTemplates}
        onSelect={onSelect}
        onBack={onBack}
      />
    )

    const templateName = screen.getAllByText(mockTemplates[0].friendlyName)[0]!
    const templateCard = templateName.closest('button')!
    await user.click(templateCard)

    // Preview should show template details
    expect(screen.getByText(/What's included/i)).toBeInTheDocument()

    // Should show some default accounts
    const defaultAccounts = mockTemplates[0]!.accounts.filter((a) => a.isDefault).slice(0, 5)
    defaultAccounts.forEach((account) => {
      expect(screen.getByText(account.name)).toBeInTheDocument()
    })
  })

  it('should call onSelect when continue button is clicked', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const onBack = vi.fn()

    render(
      <TemplateSelectionStep
        templates={mockTemplates}
        onSelect={onSelect}
        onBack={onBack}
      />
    )

    // Select a template - use getByText on the heading instead of getByRole
    const templateName = screen.getAllByText(mockTemplates[0].friendlyName)[0]!
    const templateCard = templateName.closest('button')!
    await user.click(templateCard)

    // Click continue
    const continueButton = screen.getByRole('button', { name: /Continue with this template/i })
    await user.click(continueButton)

    expect(onSelect).toHaveBeenCalledWith(mockTemplates[0]!.id)
  })

  it('should call onBack when back button is clicked', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const onBack = vi.fn()

    render(
      <TemplateSelectionStep
        templates={mockTemplates}
        onSelect={onSelect}
        onBack={onBack}
      />
    )

    const backButton = screen.getByRole('button', { name: /Back/i })
    await user.click(backButton)

    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('should disable continue button when no template is selected', () => {
    const onSelect = vi.fn()
    const onBack = vi.fn()

    render(
      <TemplateSelectionStep
        templates={mockTemplates}
        onSelect={onSelect}
        onBack={onBack}
      />
    )

    const continueButton = screen.getByRole('button', { name: /Continue with this template/i })
    expect(continueButton).toBeDisabled()
  })

  it('should use encouraging, non-judgmental language', () => {
    const onSelect = vi.fn()
    const onBack = vi.fn()

    render(
      <TemplateSelectionStep
        templates={mockTemplates}
        onSelect={onSelect}
        onBack={onBack}
      />
    )

    expect(screen.getByText(/Don't stress about picking the "perfect" one/i)).toBeInTheDocument()
  })

  it('should be keyboard accessible', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const onBack = vi.fn()

    render(
      <TemplateSelectionStep
        templates={mockTemplates}
        onSelect={onSelect}
        onBack={onBack}
      />
    )

    // Should be able to navigate to template cards with keyboard
    await user.tab()
    const templateName = screen.getAllByText(mockTemplates[0].friendlyName)[0]!
    const firstCard = templateName.closest('button')!
    expect(firstCard).toHaveFocus()

    // Should be able to select with Enter or Space
    await user.keyboard('{Enter}')
    expect(firstCard).toHaveAttribute('aria-pressed', 'true')
  })

  it('should restore previously selected template', () => {
    const onSelect = vi.fn()
    const onBack = vi.fn()

    render(
      <TemplateSelectionStep
        templates={mockTemplates}
        selectedTemplateId={mockTemplates[1]!.id}
        onSelect={onSelect}
        onBack={onBack}
      />
    )

    const templateName = screen.getAllByText(mockTemplates[1].friendlyName)[0]!
    const selectedCard = templateName.closest('button')!
    expect(selectedCard).toHaveAttribute('aria-pressed', 'true')
  })
})
