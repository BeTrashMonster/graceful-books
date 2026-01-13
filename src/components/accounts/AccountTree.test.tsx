/**
 * Tests for AccountTree Component
 *
 * Tests hierarchical rendering, expand/collapse, and accessibility
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { AccountTree } from './AccountTree'
import type { AccountTreeNode } from '../../hooks/useAccounts'

expect.extend(toHaveNoViolations)

describe('AccountTree Component', () => {
  const mockTreeNodes: AccountTreeNode[] = [
    {
      id: 'acc-1',
      companyId: 'company-123',
      name: 'Assets',
      accountNumber: '1000',
      type: 'asset',
      isActive: true,
      balance: 15000,
      createdAt: new Date(),
      updatedAt: new Date(),
      children: [
        {
          id: 'acc-1-1',
          companyId: 'company-123',
          name: 'Cash',
          accountNumber: '1010',
          type: 'asset',
          parentAccountId: 'acc-1',
          isActive: true,
          balance: 10000,
          createdAt: new Date(),
          updatedAt: new Date(),
          children: [],
          level: 1,
          path: ['acc-1', 'acc-1-1'],
        },
        {
          id: 'acc-1-2',
          companyId: 'company-123',
          name: 'Accounts Receivable',
          accountNumber: '1020',
          type: 'asset',
          parentAccountId: 'acc-1',
          isActive: true,
          balance: 5000,
          createdAt: new Date(),
          updatedAt: new Date(),
          children: [],
          level: 1,
          path: ['acc-1', 'acc-1-2'],
        },
      ],
      level: 0,
      path: ['acc-1'],
    },
    {
      id: 'acc-2',
      companyId: 'company-123',
      name: 'Liabilities',
      accountNumber: '2000',
      type: 'liability',
      isActive: true,
      balance: 5000,
      createdAt: new Date(),
      updatedAt: new Date(),
      children: [],
      level: 0,
      path: ['acc-2'],
    },
  ]

  describe('rendering', () => {
    it('should render tree nodes', () => {
      render(<AccountTree nodes={mockTreeNodes} />)

      expect(screen.getByText('Assets')).toBeInTheDocument()
      expect(screen.getByText('Liabilities')).toBeInTheDocument()
    })

    it('should render account numbers', () => {
      render(<AccountTree nodes={mockTreeNodes} />)

      expect(screen.getByText('1000')).toBeInTheDocument()
      expect(screen.getByText('2000')).toBeInTheDocument()
    })

    it('should render child nodes', () => {
      render(<AccountTree nodes={mockTreeNodes} />)

      expect(screen.getByText('Cash')).toBeInTheDocument()
      expect(screen.getByText('Accounts Receivable')).toBeInTheDocument()
    })

    it('should render balances when showBalances is true', () => {
      render(<AccountTree nodes={mockTreeNodes} showBalances />)

      expect(screen.getByText('$15,000.00')).toBeInTheDocument()
      expect(screen.getByText('$10,000.00')).toBeInTheDocument()
    })

    it('should not render balances when showBalances is false', () => {
      render(<AccountTree nodes={mockTreeNodes} showBalances={false} />)

      expect(screen.queryByText('$15,000.00')).not.toBeInTheDocument()
    })

    it('should show inactive badge for inactive accounts', () => {
      const inactiveNodes: AccountTreeNode[] = [
        {
          ...mockTreeNodes[0]!,
          isActive: false,
          children: [],
          level: 0,
          path: [],
        },
      ]

      render(<AccountTree nodes={inactiveNodes} />)

      expect(screen.getByText('Inactive')).toBeInTheDocument()
    })

    it('should show empty state when no nodes', () => {
      render(<AccountTree nodes={[]} />)

      expect(screen.getByText('No accounts to display')).toBeInTheDocument()
    })
  })

  describe('expand/collapse functionality', () => {
    it('should show children by default', () => {
      render(<AccountTree nodes={mockTreeNodes} />)

      expect(screen.getByText('Cash')).toBeVisible()
      expect(screen.getByText('Accounts Receivable')).toBeVisible()
    })

    it('should collapse children when expand button is clicked', async () => {
      const user = userEvent.setup()

      render(<AccountTree nodes={mockTreeNodes} />)

      const expandButtons = screen.getAllByRole('button', { name: /collapse/i })
      await user.click(expandButtons[0]!)

      expect(screen.queryByText('Cash')).not.toBeInTheDocument()
      expect(screen.queryByText('Accounts Receivable')).not.toBeInTheDocument()
    })

    it('should expand children when expand button is clicked again', async () => {
      const user = userEvent.setup()

      render(<AccountTree nodes={mockTreeNodes} />)

      const expandButton = screen.getAllByRole('button', { name: /collapse/i })[0]!

      // Collapse
      await user.click(expandButton)
      expect(screen.queryByText('Cash')).not.toBeInTheDocument()

      // Expand
      const collapseButton = screen.getByRole('button', { name: /expand/i })
      await user.click(collapseButton)
      expect(screen.getByText('Cash')).toBeVisible()
    })

    it('should not show expand button for nodes without children', () => {
      render(<AccountTree nodes={mockTreeNodes} />)

      const cashNode = screen.getByText('Cash').closest('[role="treeitem"]')
      expect(cashNode?.querySelector('button')).not.toBeInTheDocument()
    })
  })

  describe('selection', () => {
    it('should call onSelect when node is clicked', async () => {
      const user = userEvent.setup()
      const onSelect = vi.fn()

      render(<AccountTree nodes={mockTreeNodes} onSelect={onSelect} />)

      const assetsNode = screen.getByText('Assets').closest('[tabindex="0"]')!
      await user.click(assetsNode)

      expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'acc-1', name: 'Assets' })
      )
    })

    it('should highlight selected node', () => {
      render(
        <AccountTree nodes={mockTreeNodes} selectedId="acc-1" onSelect={vi.fn()} />
      )

      // Find the node content div that has the selected class
      // Structure: span.name -> div.nodeName -> div.nodeInfo -> div.nodeContent
      const nameSpan = screen.getByText('Assets')
      const nodeContent = nameSpan.parentElement?.parentElement?.parentElement!
      expect(nodeContent.className).toMatch(/selected/)
    })

    it('should support keyboard selection with Enter', async () => {
      const user = userEvent.setup()
      const onSelect = vi.fn()

      render(<AccountTree nodes={mockTreeNodes} onSelect={onSelect} />)

      const assetsNode = screen.getByText('Assets').closest('[tabindex="0"]') as HTMLElement
      assetsNode.focus()
      await user.keyboard('{Enter}')

      expect(onSelect).toHaveBeenCalled()
    })

    it('should support keyboard selection with Space', async () => {
      const user = userEvent.setup()
      const onSelect = vi.fn()

      render(<AccountTree nodes={mockTreeNodes} onSelect={onSelect} />)

      const assetsNode = screen.getByText('Assets').closest('[tabindex="0"]') as HTMLElement
      assetsNode.focus()
      await user.keyboard(' ')

      expect(onSelect).toHaveBeenCalled()
    })

    it('should not be clickable when onSelect is not provided', () => {
      render(<AccountTree nodes={mockTreeNodes} />)

      const assetsNode = screen.getByText('Assets').closest('div')!
      expect(assetsNode.className).not.toContain('clickable')
      expect(assetsNode).not.toHaveAttribute('tabindex')
    })
  })

  describe('grouping by type', () => {
    it('should group accounts by type when groupByType is true', () => {
      render(<AccountTree nodes={mockTreeNodes} groupByType />)

      // When groupByType is true, we should have group headers
      expect(screen.getAllByText('Assets').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Liabilities').length).toBeGreaterThan(0)
    })

    it('should show group headers with type names', () => {
      render(<AccountTree nodes={mockTreeNodes} groupByType />)

      expect(screen.getByRole('heading', { name: /assets/i })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: /liabilities/i })).toBeInTheDocument()
    })

    it('should show total balance for each group', () => {
      render(<AccountTree nodes={mockTreeNodes} groupByType showBalances />)

      // Assets group total (parent balance + children balances)
      // Use getAllByText since balances might appear multiple times (node balance + group total)
      expect(screen.getAllByText('$15,000.00').length).toBeGreaterThan(0)
      // Liabilities group total
      expect(screen.getAllByText('$5,000.00').length).toBeGreaterThan(0)
    })

    it('should calculate correct group totals including children', () => {
      const nodesWithChildren: AccountTreeNode[] = [
        {
          id: 'acc-1',
          companyId: 'company-123',
          name: 'Parent',
          type: 'asset',
          isActive: true,
          balance: 1000,
          createdAt: new Date(),
          updatedAt: new Date(),
          children: [
            {
              id: 'acc-1-1',
              companyId: 'company-123',
              name: 'Child 1',
              type: 'asset',
              parentAccountId: 'acc-1',
              isActive: true,
              balance: 2000,
              createdAt: new Date(),
              updatedAt: new Date(),
              children: [],
              level: 1,
              path: ['acc-1', 'acc-1-1'],
            },
            {
              id: 'acc-1-2',
              companyId: 'company-123',
              name: 'Child 2',
              type: 'asset',
              parentAccountId: 'acc-1',
              isActive: true,
              balance: 3000,
              createdAt: new Date(),
              updatedAt: new Date(),
              children: [],
              level: 1,
              path: ['acc-1', 'acc-1-2'],
            },
          ],
          level: 0,
          path: ['acc-1'],
        },
      ]

      render(<AccountTree nodes={nodesWithChildren} groupByType showBalances />)

      // Total should be 1000 + 2000 + 3000 = 6000
      expect(screen.getByText('$6,000.00')).toBeInTheDocument()
    })
  })

  describe('indentation', () => {
    it('should apply indentation based on level', () => {
      render(<AccountTree nodes={mockTreeNodes} />)

      // Find nodes by traversing from the text element up to the styled div
      // Structure: span.name -> div.nodeName -> div.nodeInfo -> div.nodeContent (has style)
      const parentNode = screen.getByText('Assets').parentElement?.parentElement?.parentElement as HTMLElement
      const childNode = screen.getByText('Cash').parentElement?.parentElement?.parentElement as HTMLElement

      const parentPadding = parseFloat(parentNode.style.paddingLeft)
      const childPadding = parseFloat(childNode.style.paddingLeft)

      expect(childPadding).toBeGreaterThan(parentPadding)
    })
  })

  describe('balance formatting', () => {
    it('should format positive balances', () => {
      render(<AccountTree nodes={mockTreeNodes} showBalances />)

      expect(screen.getByText('$15,000.00')).toBeInTheDocument()
    })

    it('should format negative balances', () => {
      const negativeNodes: AccountTreeNode[] = [
        {
          ...mockTreeNodes[0]!,
          balance: -5000,
          children: [],
          level: 0,
          path: [],
        },
      ]

      render(<AccountTree nodes={negativeNodes} showBalances />)

      expect(screen.getByText('-$5,000.00')).toBeInTheDocument()
    })

    it('should format zero balance', () => {
      const zeroNodes: AccountTreeNode[] = [
        {
          ...mockTreeNodes[0]!,
          balance: 0,
          children: [],
          level: 0,
          path: [],
        },
      ]

      render(<AccountTree nodes={zeroNodes} showBalances />)

      expect(screen.getByText('$0.00')).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<AccountTree nodes={mockTreeNodes} />)

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have no accessibility violations with selection', async () => {
      const { container } = render(
        <AccountTree nodes={mockTreeNodes} onSelect={vi.fn()} selectedId="acc-1" />
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have no accessibility violations when grouped', async () => {
      const { container } = render(
        <AccountTree nodes={mockTreeNodes} groupByType showBalances />
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have role="tree" on root', () => {
      render(<AccountTree nodes={mockTreeNodes} />)

      expect(screen.getByRole('tree')).toBeInTheDocument()
    })

    it('should have role="treeitem" on nodes', () => {
      render(<AccountTree nodes={mockTreeNodes} />)

      const treeItems = screen.getAllByRole('treeitem')
      expect(treeItems.length).toBeGreaterThan(0)
    })

    it('should have aria-expanded on expandable nodes', () => {
      render(<AccountTree nodes={mockTreeNodes} />)

      const expandableNode = screen.getByText('Assets').closest('[role="treeitem"]')!
      expect(expandableNode).toHaveAttribute('aria-expanded', 'true')
    })

    it('should not have aria-expanded on leaf nodes', () => {
      render(<AccountTree nodes={mockTreeNodes} />)

      const leafNode = screen.getByText('Cash').closest('[role="treeitem"]')!
      expect(leafNode).not.toHaveAttribute('aria-expanded')
    })

    it('should have aria-label on expand buttons', () => {
      render(<AccountTree nodes={mockTreeNodes} />)

      const expandButton = screen.getAllByRole('button')[0]
      expect(expandButton).toHaveAttribute('aria-label')
    })

    it('should be keyboard navigable', () => {
      render(<AccountTree nodes={mockTreeNodes} onSelect={vi.fn()} />)

      const clickableNodes = screen.getAllByRole('treeitem').filter(node =>
        node.querySelector('[tabindex="0"]')
      )

      clickableNodes.forEach(node => {
        const clickableElement = node.querySelector('[tabindex="0"]')
        expect(clickableElement).toHaveAttribute('tabindex', '0')
      })
    })
  })

  describe('custom className', () => {
    it('should accept custom className', () => {
      const { container } = render(
        <AccountTree nodes={mockTreeNodes} className="custom-tree" />
      )

      const tree = container.firstChild as HTMLElement
      expect(tree.className).toContain('custom-tree')
    })
  })
})
