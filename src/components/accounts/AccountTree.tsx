/**
 * AccountTree Component
 *
 * Displays accounts in a hierarchical tree structure.
 * Shows parent-child relationships with visual indentation.
 *
 * Features:
 * - Hierarchical tree view with indentation
 * - Expand/collapse functionality
 * - Account balances at each level
 * - Type-based grouping
 * - WCAG 2.1 AA accessible
 */

import { type FC, useState, useMemo } from 'react'
import clsx from 'clsx'
import type { Account, AccountType } from '../../types'
import type { AccountTreeNode } from '../../hooks/useAccounts'
import styles from './AccountTree.module.css'

export interface AccountTreeProps {
  /**
   * Tree nodes to display
   */
  nodes: AccountTreeNode[]

  /**
   * Called when an account is selected
   */
  onSelect?: (account: Account) => void

  /**
   * Currently selected account ID
   */
  selectedId?: string

  /**
   * Group accounts by type
   */
  groupByType?: boolean

  /**
   * Show account balances
   */
  showBalances?: boolean

  /**
   * Custom className
   */
  className?: string
}

/**
 * Tree node component
 */
interface TreeNodeProps {
  node: AccountTreeNode
  onSelect?: (account: Account) => void
  selectedId?: string
  showBalances: boolean
}

/**
 * Format balance with currency
 */
function formatBalance(balance: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(balance)
}

/**
 * Tree node component with expand/collapse
 */
const TreeNode: FC<TreeNodeProps> = ({ node, onSelect, selectedId, showBalances }) => {
  const [isExpanded, setIsExpanded] = useState(true)
  const hasChildren = node.children.length > 0
  const isSelected = selectedId === node.id

  const handleClick = () => {
    onSelect?.(node)
  }

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsExpanded(!isExpanded)
  }

  return (
    <div className={styles.treeNode} role="treeitem" aria-expanded={hasChildren ? isExpanded : undefined}>
      <div
        className={clsx(
          styles.nodeContent,
          isSelected && styles.selected,
          !node.isActive && styles.inactive,
          onSelect && styles.clickable
        )}
        style={{ paddingLeft: `${node.level * 1.5 + 0.5}rem` }}
        onClick={onSelect ? handleClick : undefined}
        onKeyDown={
          onSelect
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleClick()
                }
              }
            : undefined
        }
        tabIndex={onSelect ? 0 : undefined}
      >
        {hasChildren && (
          <button
            type="button"
            className={styles.expandButton}
            onClick={handleToggle}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
            aria-expanded={isExpanded}
          >
            <span className={clsx(styles.expandIcon, isExpanded && styles.expanded)}>
              ▶
            </span>
          </button>
        )}

        <div className={styles.nodeInfo}>
          <div className={styles.nodeName}>
            {node.accountNumber && (
              <span className={styles.accountNumber}>{node.accountNumber}</span>
            )}
            <span className={styles.name}>{node.name}</span>
            {!node.isActive && (
              <span className={styles.inactiveBadge}>Inactive</span>
            )}
          </div>

          {showBalances && (
            <div className={styles.nodeBalance}>
              {formatBalance(node.balance)}
            </div>
          )}
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div className={styles.nodeChildren} role="group">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              onSelect={onSelect}
              selectedId={selectedId}
              showBalances={showBalances}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Get account type display label
 */
function getAccountTypeLabel(type: AccountType): string {
  const labels: Record<AccountType, string> = {
    'asset': 'Assets',
    'liability': 'Liabilities',
    'equity': 'Equity',
    'income': 'Income',
    'expense': 'Expenses',
    'cost-of-goods-sold': 'Cost of Goods Sold',
    'other-income': 'Other Income',
    'other-expense': 'Other Expenses',
  }
  return labels[type] || type
}

/**
 * Group tree nodes by account type
 */
function groupNodesByType(nodes: AccountTreeNode[]): Map<AccountType, AccountTreeNode[]> {
  const groups = new Map<AccountType, AccountTreeNode[]>()

  nodes.forEach((node) => {
    const existing = groups.get(node.type) || []
    groups.set(node.type, [...existing, node])
  })

  return groups
}

/**
 * Calculate total balance for a group
 */
function calculateGroupBalance(nodes: AccountTreeNode[]): number {
  return nodes.reduce((sum, node) => {
    const nodeTotal = node.balance + calculateGroupBalance(node.children)
    return sum + nodeTotal
  }, 0)
}

/**
 * AccountTree Component
 *
 * @example
 * ```tsx
 * const tree = buildTree(accounts)
 *
 * <AccountTree
 *   nodes={tree}
 *   groupByType
 *   showBalances
 *   onSelect={handleSelect}
 * />
 * ```
 */
export const AccountTree: FC<AccountTreeProps> = ({
  nodes,
  onSelect,
  selectedId,
  groupByType = false,
  showBalances = true,
  className,
}) => {
  const content = useMemo(() => {
    if (!groupByType) {
      return (
        <div className={styles.treeRoot} role="tree">
          {nodes.map((node) => (
            <TreeNode
              key={node.id}
              node={node}
              onSelect={onSelect}
              selectedId={selectedId}
              showBalances={showBalances}
            />
          ))}
        </div>
      )
    }

    // Group by type
    const groups = groupNodesByType(nodes)
    const typeOrder: AccountType[] = [
      'asset',
      'liability',
      'equity',
      'income',
      'cost-of-goods-sold',
      'expense',
      'other-income',
      'other-expense',
    ]

    return (
      <div className={styles.groupedTree}>
        {typeOrder.map((type) => {
          const groupNodes = groups.get(type)
          if (!groupNodes || groupNodes.length === 0) return null

          const totalBalance = calculateGroupBalance(groupNodes)

          return (
            <div key={type} className={styles.typeGroup}>
              <div className={styles.typeGroupHeader}>
                <h3 className={styles.typeGroupTitle}>
                  {getAccountTypeLabel(type)}
                </h3>
                {showBalances && (
                  <div className={styles.typeGroupBalance}>
                    {formatBalance(totalBalance)}
                  </div>
                )}
              </div>
              <div className={styles.treeRoot} role="tree" aria-label={getAccountTypeLabel(type)}>
                {groupNodes.map((node) => (
                  <TreeNode
                    key={node.id}
                    node={node}
                    onSelect={onSelect}
                    selectedId={selectedId}
                    showBalances={showBalances}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    )
  }, [nodes, groupByType, onSelect, selectedId, showBalances])

  if (nodes.length === 0) {
    return (
      <div className={clsx(styles.accountTree, className)}>
        <div className={styles.emptyState}>
          <p>No accounts to display</p>
        </div>
      </div>
    )
  }

  return (
    <div className={clsx(styles.accountTree, className)}>
      {content}
    </div>
  )
}
