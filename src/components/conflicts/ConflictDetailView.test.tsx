/**
 * Tests for ConflictDetailView Component
 *
 * Tests detail view rendering, field selection, and resolution actions
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConflictDetailView } from './ConflictDetailView'
import type { DetectedConflict } from '../../types/crdt.types'
import * as conflictResolutionService from '../../services/conflictResolution.service'

vi.mock('../../services/conflictResolution.service', () => ({
  getFieldConflicts: vi.fn(),
}))

const mockConflict: DetectedConflict = {
  id: 'conflict-1',
  entityType: 'Transaction',
  entityId: 'txn-123',
  conflictType: 'concurrent_update' as any,
  severity: 'medium' as any,
  localVersion: {
    id: 'txn-123',
    amount: 100,
    description: 'Local description',
  } as any,
  remoteVersion: {
    id: 'txn-123',
    amount: 150,
    description: 'Remote description',
  } as any,
  conflictingFields: ['amount', 'description'],
  detectedAt: Date.now(),
  deviceId: 'device-1',
}

const mockFieldConflicts = [
  {
    fieldName: 'amount',
    localValue: 100,
    remoteValue: 150,
    canAutoResolve: true,
    suggestedResolution: 150,
  },
  {
    fieldName: 'description',
    localValue: 'Local description',
    remoteValue: 'Remote description',
    canAutoResolve: false,
  },
]

describe('ConflictDetailView Component', () => {
  beforeEach(() => {
    vi.mocked(conflictResolutionService.getFieldConflicts).mockReturnValue(mockFieldConflicts)
  })

  describe('rendering', () => {
    it('should render conflict metadata', () => {
      render(
        <ConflictDetailView
          conflict={mockConflict}
          onKeepLocal={vi.fn()}
          onKeepRemote={vi.fn()}
          onCustomMerge={vi.fn()}
        />
      )

      expect(screen.getByText('Resolve Conflict')).toBeInTheDocument()
      expect(screen.getAllByText(/Transaction/i).length).toBeGreaterThan(0)
      expect(screen.getByText(/medium/i)).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument() // Conflicting fields count
    })

    it('should render quick action buttons', () => {
      render(
        <ConflictDetailView
          conflict={mockConflict}
          onKeepLocal={vi.fn()}
          onKeepRemote={vi.fn()}
          onCustomMerge={vi.fn()}
        />
      )

      expect(screen.getByRole('button', { name: /keep mine/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /keep theirs/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /choose field by field/i })).toBeInTheDocument()
    })

    it('should render back button when onBack is provided', () => {
      render(
        <ConflictDetailView
          conflict={mockConflict}
          onKeepLocal={vi.fn()}
          onKeepRemote={vi.fn()}
          onCustomMerge={vi.fn()}
          onBack={vi.fn()}
        />
      )

      expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument()
    })

    it('should not render back button when onBack is not provided', () => {
      render(
        <ConflictDetailView
          conflict={mockConflict}
          onKeepLocal={vi.fn()}
          onKeepRemote={vi.fn()}
          onCustomMerge={vi.fn()}
        />
      )

      expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument()
    })

    it('should show field comparison when in custom mode', async () => {
      const user = userEvent.setup()

      render(
        <ConflictDetailView
          conflict={mockConflict}
          onKeepLocal={vi.fn()}
          onKeepRemote={vi.fn()}
          onCustomMerge={vi.fn()}
        />
      )

      await user.click(screen.getByRole('button', { name: /choose field by field/i }))

      expect(screen.getByText('Field-by-Field Comparison')).toBeInTheDocument()
      expect(screen.getByText('amount')).toBeInTheDocument()
      expect(screen.getByText('description')).toBeInTheDocument()
    })

    it('should display suggested resolution when available', async () => {
      const user = userEvent.setup()

      render(
        <ConflictDetailView
          conflict={mockConflict}
          onKeepLocal={vi.fn()}
          onKeepRemote={vi.fn()}
          onCustomMerge={vi.fn()}
        />
      )

      await user.click(screen.getByRole('button', { name: /choose field by field/i }))

      expect(screen.getByText(/Suggested: 150/i)).toBeInTheDocument()
    })
  })

  describe('quick actions', () => {
    it('should call onKeepLocal when Keep Mine is clicked', async () => {
      const user = userEvent.setup()
      const handleKeepLocal = vi.fn()

      render(
        <ConflictDetailView
          conflict={mockConflict}
          onKeepLocal={handleKeepLocal}
          onKeepRemote={vi.fn()}
          onCustomMerge={vi.fn()}
        />
      )

      await user.click(screen.getByRole('button', { name: /keep mine/i }))

      expect(handleKeepLocal).toHaveBeenCalledWith('conflict-1')
    })

    it('should call onKeepRemote when Keep Theirs is clicked', async () => {
      const user = userEvent.setup()
      const handleKeepRemote = vi.fn()

      render(
        <ConflictDetailView
          conflict={mockConflict}
          onKeepLocal={vi.fn()}
          onKeepRemote={handleKeepRemote}
          onCustomMerge={vi.fn()}
        />
      )

      await user.click(screen.getByRole('button', { name: /keep theirs/i }))

      expect(handleKeepRemote).toHaveBeenCalledWith('conflict-1')
    })

    it('should call onBack when back button is clicked', async () => {
      const user = userEvent.setup()
      const handleBack = vi.fn()

      render(
        <ConflictDetailView
          conflict={mockConflict}
          onKeepLocal={vi.fn()}
          onKeepRemote={vi.fn()}
          onCustomMerge={vi.fn()}
          onBack={handleBack}
        />
      )

      await user.click(screen.getByRole('button', { name: /back/i }))

      expect(handleBack).toHaveBeenCalledTimes(1)
    })
  })

  describe('field selection', () => {
    it('should allow selecting local version for a field', async () => {
      const user = userEvent.setup()

      render(
        <ConflictDetailView
          conflict={mockConflict}
          onKeepLocal={vi.fn()}
          onKeepRemote={vi.fn()}
          onCustomMerge={vi.fn()}
        />
      )

      await user.click(screen.getByRole('button', { name: /choose field by field/i }))

      const localButton = screen.getByRole('button', { name: /keep my version: 100/i })
      await user.click(localButton)

      expect(localButton).toHaveAttribute('aria-pressed', 'true')
    })

    it('should allow selecting remote version for a field', async () => {
      const user = userEvent.setup()

      render(
        <ConflictDetailView
          conflict={mockConflict}
          onKeepLocal={vi.fn()}
          onKeepRemote={vi.fn()}
          onCustomMerge={vi.fn()}
        />
      )

      await user.click(screen.getByRole('button', { name: /choose field by field/i }))

      const remoteButton = screen.getByRole('button', { name: /keep their version: 150/i })
      await user.click(remoteButton)

      expect(remoteButton).toHaveAttribute('aria-pressed', 'true')
    })

    it('should toggle selection between local and remote', async () => {
      const user = userEvent.setup()

      render(
        <ConflictDetailView
          conflict={mockConflict}
          onKeepLocal={vi.fn()}
          onKeepRemote={vi.fn()}
          onCustomMerge={vi.fn()}
        />
      )

      await user.click(screen.getByRole('button', { name: /choose field by field/i }))

      const localButton = screen.getByRole('button', { name: /keep my version: 100/i })
      const remoteButton = screen.getByRole('button', { name: /keep their version: 150/i })

      // Initially local should be selected
      expect(localButton).toHaveAttribute('aria-pressed', 'true')

      // Click remote
      await user.click(remoteButton)
      expect(remoteButton).toHaveAttribute('aria-pressed', 'true')
      expect(localButton).toHaveAttribute('aria-pressed', 'false')

      // Click local again
      await user.click(localButton)
      expect(localButton).toHaveAttribute('aria-pressed', 'true')
      expect(remoteButton).toHaveAttribute('aria-pressed', 'false')
    })
  })

  describe('custom merge', () => {
    it('should call onCustomMerge with selected values', async () => {
      const user = userEvent.setup()
      const handleCustomMerge = vi.fn()

      render(
        <ConflictDetailView
          conflict={mockConflict}
          onKeepLocal={vi.fn()}
          onKeepRemote={vi.fn()}
          onCustomMerge={handleCustomMerge}
        />
      )

      // Enter custom mode
      await user.click(screen.getByRole('button', { name: /choose field by field/i }))

      // Select remote for amount
      await user.click(screen.getByRole('button', { name: /keep their version: 150/i }))

      // Apply selection
      await user.click(screen.getByRole('button', { name: /apply selection/i }))

      expect(handleCustomMerge).toHaveBeenCalledWith('conflict-1', {
        amount: 150,
        description: 'Local description', // Default to local
      })
    })

    it('should exit custom mode when Cancel is clicked', async () => {
      const user = userEvent.setup()

      render(
        <ConflictDetailView
          conflict={mockConflict}
          onKeepLocal={vi.fn()}
          onKeepRemote={vi.fn()}
          onCustomMerge={vi.fn()}
        />
      )

      // Enter custom mode
      await user.click(screen.getByRole('button', { name: /choose field by field/i }))
      expect(screen.getByText('Field-by-Field Comparison')).toBeInTheDocument()

      // Cancel
      await user.click(screen.getByRole('button', { name: /cancel/i }))
      expect(screen.queryByText('Field-by-Field Comparison')).not.toBeInTheDocument()
    })
  })

  describe('loading state', () => {
    it('should disable buttons when loading', () => {
      render(
        <ConflictDetailView
          conflict={mockConflict}
          onKeepLocal={vi.fn()}
          onKeepRemote={vi.fn()}
          onCustomMerge={vi.fn()}
          loading={true}
        />
      )

      const keepMineButton = screen.getByRole('button', { name: /keep mine/i })
      const keepTheirsButton = screen.getByRole('button', { name: /keep theirs/i })

      expect(keepMineButton).toBeDisabled()
      expect(keepTheirsButton).toBeDisabled()
    })

    it('should show loading spinner on primary button', () => {
      render(
        <ConflictDetailView
          conflict={mockConflict}
          onKeepLocal={vi.fn()}
          onKeepRemote={vi.fn()}
          onCustomMerge={vi.fn()}
          loading={true}
        />
      )

      const keepMineButton = screen.getByRole('button', { name: /keep mine/i })
      expect(keepMineButton).toHaveAttribute('aria-busy', 'true')
    })

    it('should announce loading state to screen readers', async () => {
      const user = userEvent.setup()

      const { rerender } = render(
        <ConflictDetailView
          conflict={mockConflict}
          onKeepLocal={vi.fn()}
          onKeepRemote={vi.fn()}
          onCustomMerge={vi.fn()}
          loading={false}
        />
      )

      rerender(
        <ConflictDetailView
          conflict={mockConflict}
          onKeepLocal={vi.fn()}
          onKeepRemote={vi.fn()}
          onCustomMerge={vi.fn()}
          loading={true}
        />
      )

      expect(screen.getByRole('status')).toHaveTextContent('Resolving conflict...')
    })
  })

  describe('accessibility', () => {
    it('should have proper heading hierarchy', () => {
      render(
        <ConflictDetailView
          conflict={mockConflict}
          onKeepLocal={vi.fn()}
          onKeepRemote={vi.fn()}
          onCustomMerge={vi.fn()}
        />
      )

      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Resolve Conflict')
    })

    it('should have descriptive labels for field options', async () => {
      const user = userEvent.setup()

      render(
        <ConflictDetailView
          conflict={mockConflict}
          onKeepLocal={vi.fn()}
          onKeepRemote={vi.fn()}
          onCustomMerge={vi.fn()}
        />
      )

      await user.click(screen.getByRole('button', { name: /choose field by field/i }))

      expect(screen.getByRole('button', { name: /keep my version: 100/i })).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /keep their version: 150/i })
      ).toBeInTheDocument()
    })

    it('should have list role for field list', async () => {
      const user = userEvent.setup()

      render(
        <ConflictDetailView
          conflict={mockConflict}
          onKeepLocal={vi.fn()}
          onKeepRemote={vi.fn()}
          onCustomMerge={vi.fn()}
        />
      )

      await user.click(screen.getByRole('button', { name: /choose field by field/i }))

      expect(screen.getByRole('list')).toBeInTheDocument()
    })

    it('should have listitem role for each field', async () => {
      const user = userEvent.setup()

      render(
        <ConflictDetailView
          conflict={mockConflict}
          onKeepLocal={vi.fn()}
          onKeepRemote={vi.fn()}
          onCustomMerge={vi.fn()}
        />
      )

      await user.click(screen.getByRole('button', { name: /choose field by field/i }))

      const listitems = screen.getAllByRole('listitem')
      expect(listitems).toHaveLength(2) // amount and description
    })

    it('should be keyboard navigable', async () => {
      const user = userEvent.setup()

      render(
        <ConflictDetailView
          conflict={mockConflict}
          onKeepLocal={vi.fn()}
          onKeepRemote={vi.fn()}
          onCustomMerge={vi.fn()}
        />
      )

      const firstButton = screen.getByRole('button', { name: /keep mine/i })
      firstButton.focus()
      expect(document.activeElement).toBe(firstButton)

      await user.keyboard('{Tab}')
      const secondButton = screen.getByRole('button', { name: /keep theirs/i })
      expect(document.activeElement).toBe(secondButton)
    })
  })

  describe('value formatting', () => {
    it('should format null values', async () => {
      const user = userEvent.setup()

      vi.mocked(conflictResolutionService.getFieldConflicts).mockReturnValue([
        {
          fieldName: 'optional_field',
          localValue: null,
          remoteValue: 'value',
          canAutoResolve: false,
        },
      ])

      render(
        <ConflictDetailView
          conflict={mockConflict}
          onKeepLocal={vi.fn()}
          onKeepRemote={vi.fn()}
          onCustomMerge={vi.fn()}
        />
      )

      await user.click(screen.getByRole('button', { name: /choose field by field/i }))

      expect(screen.getByText('null')).toBeInTheDocument()
    })

    it('should format array values', async () => {
      const user = userEvent.setup()

      vi.mocked(conflictResolutionService.getFieldConflicts).mockReturnValue([
        {
          fieldName: 'tags',
          localValue: ['tag1', 'tag2'],
          remoteValue: ['tag3'],
          canAutoResolve: false,
        },
      ])

      render(
        <ConflictDetailView
          conflict={mockConflict}
          onKeepLocal={vi.fn()}
          onKeepRemote={vi.fn()}
          onCustomMerge={vi.fn()}
        />
      )

      await user.click(screen.getByRole('button', { name: /choose field by field/i }))

      expect(screen.getByText('[2 items]')).toBeInTheDocument()
      expect(screen.getByText('[1 items]')).toBeInTheDocument()
    })

    it('should format object values as JSON', async () => {
      const user = userEvent.setup()

      vi.mocked(conflictResolutionService.getFieldConflicts).mockReturnValue([
        {
          fieldName: 'metadata',
          localValue: { key: 'value' },
          remoteValue: { key: 'other' },
          canAutoResolve: false,
        },
      ])

      render(
        <ConflictDetailView
          conflict={mockConflict}
          onKeepLocal={vi.fn()}
          onKeepRemote={vi.fn()}
          onCustomMerge={vi.fn()}
        />
      )

      await user.click(screen.getByRole('button', { name: /choose field by field/i }))

      expect(screen.getByText(/"key": "value"/i)).toBeInTheDocument()
      expect(screen.getByText(/"key": "other"/i)).toBeInTheDocument()
    })
  })
})
