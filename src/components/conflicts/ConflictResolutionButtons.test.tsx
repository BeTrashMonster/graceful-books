/**
 * Tests for ConflictResolutionButtons Component
 *
 * Tests button rendering, interactions, and accessibility
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConflictResolutionButtons } from './ConflictResolutionButtons'
import type { DetectedConflict } from '../../types/crdt.types'

const mockConflict: DetectedConflict = {
  id: 'conflict-1',
  entityType: 'Transaction',
  entityId: 'txn-1',
  conflictType: 'concurrent_update' as any,
  severity: 'low' as any,
  localVersion: { id: 'txn-1' } as any,
  remoteVersion: { id: 'txn-1' } as any,
  conflictingFields: ['amount', 'description'],
  detectedAt: Date.now(),
  deviceId: 'device-1',
}

describe('ConflictResolutionButtons Component', () => {
  describe('rendering', () => {
    it('should render all primary buttons', () => {
      render(
        <ConflictResolutionButtons
          conflict={mockConflict}
          onKeepLocal={vi.fn()}
          onKeepRemote={vi.fn()}
          showAllOptions={false}
        />
      )

      expect(screen.getByText('Keep Mine')).toBeInTheDocument()
      expect(screen.getByText('Keep Theirs')).toBeInTheDocument()
    })

    it('should render all options when showAllOptions is true', () => {
      render(
        <ConflictResolutionButtons
          conflict={mockConflict}
          onKeepLocal={vi.fn()}
          onKeepRemote={vi.fn()}
          onMergeFields={vi.fn()}
          onCustom={vi.fn()}
          showAllOptions={true}
        />
      )

      expect(screen.getByRole('button', { name: /keep mine/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /keep theirs/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /merge fields/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /custom/i })).toBeInTheDocument()
    })

    it('should not render merge button when callback not provided', () => {
      render(
        <ConflictResolutionButtons
          conflict={mockConflict}
          onKeepLocal={vi.fn()}
          onKeepRemote={vi.fn()}
          showAllOptions={true}
        />
      )

      expect(screen.queryByRole('button', { name: /merge fields/i })).not.toBeInTheDocument()
    })

    it('should not render custom button when callback not provided', () => {
      render(
        <ConflictResolutionButtons
          conflict={mockConflict}
          onKeepLocal={vi.fn()}
          onKeepRemote={vi.fn()}
          showAllOptions={true}
        />
      )

      expect(screen.queryByRole('button', { name: /custom/i })).not.toBeInTheDocument()
    })

    it('should render with horizontal layout', () => {
      const { container } = render(
        <ConflictResolutionButtons
          conflict={mockConflict}
          onKeepLocal={vi.fn()}
          onKeepRemote={vi.fn()}
          layout="horizontal"
        />
      )

      const group = container.querySelector('[role="group"]')
      expect(group?.className).toContain('horizontal')
    })

    it('should render with vertical layout', () => {
      const { container } = render(
        <ConflictResolutionButtons
          conflict={mockConflict}
          onKeepLocal={vi.fn()}
          onKeepRemote={vi.fn()}
          layout="vertical"
        />
      )

      const group = container.querySelector('[role="group"]')
      expect(group?.className).toContain('vertical')
    })

    it('should render all size variants', () => {
      const sizes = ['sm', 'md', 'lg'] as const

      sizes.forEach((size) => {
        const { unmount } = render(
          <ConflictResolutionButtons
            conflict={mockConflict}
            onKeepLocal={vi.fn()}
            onKeepRemote={vi.fn()}
            size={size}
          />
        )

        expect(screen.getByRole('button', { name: /keep mine/i })).toBeInTheDocument()
        unmount()
      })
    })
  })

  describe('interactions', () => {
    it('should call onKeepLocal when Keep Mine is clicked', async () => {
      const user = userEvent.setup()
      const handleKeepLocal = vi.fn()

      render(
        <ConflictResolutionButtons
          conflict={mockConflict}
          onKeepLocal={handleKeepLocal}
          onKeepRemote={vi.fn()}
        />
      )

      await user.click(screen.getByRole('button', { name: /keep mine/i }))

      expect(handleKeepLocal).toHaveBeenCalledTimes(1)
      expect(handleKeepLocal).toHaveBeenCalledWith('conflict-1')
    })

    it('should call onKeepRemote when Keep Theirs is clicked', async () => {
      const user = userEvent.setup()
      const handleKeepRemote = vi.fn()

      render(
        <ConflictResolutionButtons
          conflict={mockConflict}
          onKeepLocal={vi.fn()}
          onKeepRemote={handleKeepRemote}
        />
      )

      await user.click(screen.getByRole('button', { name: /keep theirs/i }))

      expect(handleKeepRemote).toHaveBeenCalledTimes(1)
      expect(handleKeepRemote).toHaveBeenCalledWith('conflict-1')
    })

    it('should call onMergeFields when Merge Fields is clicked', async () => {
      const user = userEvent.setup()
      const handleMergeFields = vi.fn()

      render(
        <ConflictResolutionButtons
          conflict={mockConflict}
          onKeepLocal={vi.fn()}
          onKeepRemote={vi.fn()}
          onMergeFields={handleMergeFields}
          showAllOptions={true}
        />
      )

      await user.click(screen.getByRole('button', { name: /merge fields/i }))

      expect(handleMergeFields).toHaveBeenCalledTimes(1)
      expect(handleMergeFields).toHaveBeenCalledWith('conflict-1')
    })

    it('should call onCustom when Custom is clicked', async () => {
      const user = userEvent.setup()
      const handleCustom = vi.fn()

      render(
        <ConflictResolutionButtons
          conflict={mockConflict}
          onKeepLocal={vi.fn()}
          onKeepRemote={vi.fn()}
          onCustom={handleCustom}
          showAllOptions={true}
        />
      )

      await user.click(screen.getByRole('button', { name: /custom/i }))

      expect(handleCustom).toHaveBeenCalledTimes(1)
      expect(handleCustom).toHaveBeenCalledWith('conflict-1')
    })

    it('should not call handlers when loading', async () => {
      const user = userEvent.setup()
      const handleKeepLocal = vi.fn()

      render(
        <ConflictResolutionButtons
          conflict={mockConflict}
          onKeepLocal={handleKeepLocal}
          onKeepRemote={vi.fn()}
          loading={true}
        />
      )

      await user.click(screen.getByRole('button', { name: /keep mine/i }))

      expect(handleKeepLocal).not.toHaveBeenCalled()
    })
  })

  describe('loading state', () => {
    it('should disable all buttons when loading', () => {
      render(
        <ConflictResolutionButtons
          conflict={mockConflict}
          onKeepLocal={vi.fn()}
          onKeepRemote={vi.fn()}
          onMergeFields={vi.fn()}
          onCustom={vi.fn()}
          loading={true}
          showAllOptions={true}
        />
      )

      const buttons = screen.getAllByRole('button')
      buttons.forEach((button) => {
        expect(button).toBeDisabled()
      })
    })

    it('should show loading spinner on Keep Mine button', () => {
      render(
        <ConflictResolutionButtons
          conflict={mockConflict}
          onKeepLocal={vi.fn()}
          onKeepRemote={vi.fn()}
          loading={true}
        />
      )

      const keepMineButton = screen.getByRole('button', { name: /keep mine/i })
      expect(keepMineButton).toHaveAttribute('aria-busy', 'true')
    })
  })

  describe('accessibility', () => {
    it('should have role="group" on button container', () => {
      const { container } = render(
        <ConflictResolutionButtons
          conflict={mockConflict}
          onKeepLocal={vi.fn()}
          onKeepRemote={vi.fn()}
        />
      )

      const group = container.querySelector('[role="group"]')
      expect(group).toBeInTheDocument()
    })

    it('should have appropriate aria-label on group', () => {
      const { container } = render(
        <ConflictResolutionButtons
          conflict={mockConflict}
          onKeepLocal={vi.fn()}
          onKeepRemote={vi.fn()}
        />
      )

      const group = container.querySelector('[role="group"]')
      expect(group).toHaveAttribute('aria-label', 'Conflict resolution options')
    })

    it('should have clear accessible names on buttons', () => {
      render(
        <ConflictResolutionButtons
          conflict={mockConflict}
          onKeepLocal={vi.fn()}
          onKeepRemote={vi.fn()}
          onMergeFields={vi.fn()}
          onCustom={vi.fn()}
          showAllOptions={true}
        />
      )

      expect(
        screen.getByRole('button', { name: /keep mine/i })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /keep theirs/i })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /merge fields/i })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /custom/i })
      ).toBeInTheDocument()
    })

    it('should be keyboard navigable', async () => {
      const user = userEvent.setup()

      render(
        <ConflictResolutionButtons
          conflict={mockConflict}
          onKeepLocal={vi.fn()}
          onKeepRemote={vi.fn()}
        />
      )

      const keepMineButton = screen.getByRole('button', { name: /keep mine/i })
      const keepTheirsButton = screen.getByRole('button', { name: /keep theirs/i })

      keepMineButton.focus()
      expect(document.activeElement).toBe(keepMineButton)

      await user.keyboard('{Tab}')
      expect(document.activeElement).toBe(keepTheirsButton)
    })

    it('should support keyboard activation', async () => {
      const user = userEvent.setup()
      const handleKeepLocal = vi.fn()

      render(
        <ConflictResolutionButtons
          conflict={mockConflict}
          onKeepLocal={handleKeepLocal}
          onKeepRemote={vi.fn()}
        />
      )

      const keepMineButton = screen.getByRole('button', { name: /keep mine/i })
      keepMineButton.focus()
      await user.keyboard('{Enter}')

      expect(handleKeepLocal).toHaveBeenCalledTimes(1)
    })
  })

  describe('edge cases', () => {
    it('should handle rapid clicks', async () => {
      const user = userEvent.setup()
      const handleKeepLocal = vi.fn()

      render(
        <ConflictResolutionButtons
          conflict={mockConflict}
          onKeepLocal={handleKeepLocal}
          onKeepRemote={vi.fn()}
        />
      )

      const button = screen.getByRole('button', { name: /keep mine/i })
      await user.tripleClick(button)

      expect(handleKeepLocal).toHaveBeenCalledTimes(3)
    })

    it('should handle different conflict IDs', async () => {
      const user = userEvent.setup()
      const handleKeepLocal = vi.fn()

      const conflict1 = { ...mockConflict, id: 'conflict-1' }
      const conflict2 = { ...mockConflict, id: 'conflict-2' }

      const { rerender } = render(
        <ConflictResolutionButtons
          conflict={conflict1}
          onKeepLocal={handleKeepLocal}
          onKeepRemote={vi.fn()}
        />
      )

      await user.click(screen.getByRole('button', { name: /keep mine/i }))
      expect(handleKeepLocal).toHaveBeenCalledWith('conflict-1')

      rerender(
        <ConflictResolutionButtons
          conflict={conflict2}
          onKeepLocal={handleKeepLocal}
          onKeepRemote={vi.fn()}
        />
      )

      await user.click(screen.getByRole('button', { name: /keep mine/i }))
      expect(handleKeepLocal).toHaveBeenCalledWith('conflict-2')
    })
  })
})
