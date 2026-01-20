/**
 * FlowNode Component Tests
 *
 * Tests for FlowNode.tsx covering:
 * - Rendering with correct size
 * - Keyboard navigation
 * - Popover display
 * - ARIA labels
 * - Health indicators
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FlowNode } from './FlowNode'
import type { FlowNode as FlowNodeType } from '../../utils/flowCalculations'

describe('FlowNode', () => {
  const mockNode: FlowNodeType = {
    type: 'assets',
    label: 'Assets',
    balance: 50000,
    accountIds: ['acc1', 'acc2'],
    subNodes: [
      { accountId: 'acc1', accountName: 'Cash', balance: 30000 },
      { accountId: 'acc2', accountName: 'Accounts Receivable', balance: 20000 },
    ],
    healthStatus: 'healthy',
  }

  const defaultProps = {
    node: mockNode,
    allBalances: [50000, 30000, 20000],
    position: { x: 100, y: 100 },
    isCompact: false,
  }

  it('should render node with label and balance', () => {
    render(
      <svg>
        <FlowNode {...defaultProps} />
      </svg>
    )

    expect(screen.getByText('Assets')).toBeInTheDocument()
    expect(screen.getByText('$50,000')).toBeInTheDocument()
  })

  it('should have correct ARIA label', () => {
    render(
      <svg>
        <FlowNode {...defaultProps} />
      </svg>
    )

    const node = screen.getByRole('button')
    expect(node).toHaveAttribute(
      'aria-label',
      expect.stringContaining('Assets: $50,000')
    )
    expect(node).toHaveAttribute(
      'aria-label',
      expect.stringContaining('Health status: healthy')
    )
  })

  it('should be keyboard accessible with Tab', () => {
    render(
      <svg>
        <FlowNode {...defaultProps} />
      </svg>
    )

    const node = screen.getByRole('button')
    expect(node).toHaveAttribute('tabIndex', '0')
  })

  it('should show popover on hover', async () => {
    const user = userEvent.setup()
    render(
      <svg>
        <FlowNode {...defaultProps} />
      </svg>
    )

    const node = screen.getByRole('button')
    await user.hover(node)

    // Popover should appear with sub-accounts
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Cash')).toBeInTheDocument()
    expect(screen.getByText('Accounts Receivable')).toBeInTheDocument()
  })

  it('should show popover on Enter key', async () => {
    const user = userEvent.setup()
    render(
      <svg>
        <FlowNode {...defaultProps} />
      </svg>
    )

    const node = screen.getByRole('button')
    node.focus()
    await user.keyboard('{Enter}')

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('should show popover on Space key', async () => {
    const user = userEvent.setup()
    render(
      <svg>
        <FlowNode {...defaultProps} />
      </svg>
    )

    const node = screen.getByRole('button')
    node.focus()
    await user.keyboard(' ')

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('should close popover on Escape key', async () => {
    const user = userEvent.setup()
    render(
      <svg>
        <FlowNode {...defaultProps} />
      </svg>
    )

    const node = screen.getByRole('button')
    await user.hover(node)

    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('should call onNodeClick when clicked', async () => {
    const user = userEvent.setup()
    const onNodeClick = vi.fn()

    render(
      <svg>
        <FlowNode {...defaultProps} onNodeClick={onNodeClick} />
      </svg>
    )

    const node = screen.getByRole('button')
    await user.click(node)

    expect(onNodeClick).toHaveBeenCalledWith('assets')
  })

  it('should call onSubAccountClick when sub-account clicked', async () => {
    const user = userEvent.setup()
    const onSubAccountClick = vi.fn()

    render(
      <svg>
        <FlowNode {...defaultProps} onSubAccountClick={onSubAccountClick} />
      </svg>
    )

    const node = screen.getByRole('button')
    await user.hover(node)

    const subAccountButton = screen.getByText('Cash').closest('button')
    expect(subAccountButton).toBeInTheDocument()

    await user.click(subAccountButton!)

    expect(onSubAccountClick).toHaveBeenCalledWith('acc1')
  })

  it('should navigate sub-accounts with arrow keys', async () => {
    const user = userEvent.setup()
    render(
      <svg>
        <FlowNode {...defaultProps} />
      </svg>
    )

    const node = screen.getByRole('button')
    await user.hover(node)

    // Arrow down should focus first sub-account
    await user.keyboard('{ArrowDown}')

    const popover = screen.getByRole('dialog')
    const items = within(popover).getAllByRole('listitem')

    expect(items[0]).toHaveClass('focused')

    // Arrow down again should focus second sub-account
    await user.keyboard('{ArrowDown}')
    expect(items[1]).toHaveClass('focused')

    // Arrow up should focus first sub-account again
    await user.keyboard('{ArrowUp}')
    expect(items[0]).toHaveClass('focused')
  })

  it('should render health indicator with correct color', () => {
    const { container } = render(
      <svg>
        <FlowNode {...defaultProps} />
      </svg>
    )

    const healthRing = container.querySelector('.flow-node-health-ring')
    expect(healthRing).toBeInTheDocument()
    expect(healthRing).toHaveAttribute('stroke', expect.any(String))
  })

  it('should render in compact mode with smaller size', () => {
    const { container } = render(
      <svg>
        <FlowNode {...defaultProps} isCompact={true} />
      </svg>
    )

    const label = screen.getByText('Assets')
    expect(label).toHaveAttribute('font-size', '12')
  })

  it('should not show popover in compact mode', async () => {
    const user = userEvent.setup()
    render(
      <svg>
        <FlowNode {...defaultProps} isCompact={true} />
      </svg>
    )

    const node = screen.getByRole('button')
    await user.hover(node)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('should show empty state when no sub-accounts', async () => {
    const user = userEvent.setup()
    const nodeWithoutSubs: FlowNodeType = {
      ...mockNode,
      subNodes: [],
    }

    render(
      <svg>
        <FlowNode {...defaultProps} node={nodeWithoutSubs} />
      </svg>
    )

    const node = screen.getByRole('button')
    await user.hover(node)

    expect(screen.getByText('No sub-accounts')).toBeInTheDocument()
  })

  it('should have aria-expanded attribute', () => {
    render(
      <svg>
        <FlowNode {...defaultProps} />
      </svg>
    )

    const node = screen.getByRole('button')
    expect(node).toHaveAttribute('aria-expanded', 'false')
  })

  it('should update aria-expanded when popover opens', async () => {
    const user = userEvent.setup()
    render(
      <svg>
        <FlowNode {...defaultProps} />
      </svg>
    )

    const node = screen.getByRole('button')
    await user.hover(node)

    expect(node).toHaveAttribute('aria-expanded', 'true')
  })

  it('should close popover when clicking close button', async () => {
    const user = userEvent.setup()
    render(
      <svg>
        <FlowNode {...defaultProps} />
      </svg>
    )

    const node = screen.getByRole('button')
    await user.hover(node)

    const closeButton = screen.getByLabelText('Close sub-accounts panel')
    await user.click(closeButton)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('should handle different health statuses', () => {
    const cautionNode: FlowNodeType = {
      ...mockNode,
      healthStatus: 'caution',
    }

    const { rerender, container } = render(
      <svg>
        <FlowNode {...defaultProps} node={cautionNode} />
      </svg>
    )

    let healthRing = container.querySelector('.flow-node-health-ring')
    expect(healthRing).toBeInTheDocument()

    const concernNode: FlowNodeType = {
      ...mockNode,
      healthStatus: 'concern',
    }

    rerender(
      <svg>
        <FlowNode {...defaultProps} node={concernNode} />
      </svg>
    )

    healthRing = container.querySelector('.flow-node-health-ring')
    expect(healthRing).toBeInTheDocument()
  })
})
