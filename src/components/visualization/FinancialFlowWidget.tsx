/**
 * Financial Flow Widget Component (J1)
 *
 * Main widget component that provides:
 * - Compact mode (200x150px in upper-right corner)
 * - Full-screen expanded mode
 * - Barter transaction toggle (I5 integration)
 * - Date range selector
 * - Screen reader accessible data table view
 * - Keyboard navigation
 *
 * Requirements:
 * - J1: Financial Flow Widget (Nice)
 * - WCAG 2.1 AA compliance
 * - I5: Barter/Trade Transactions integration
 */

import React, { useState, useEffect, useRef } from 'react'
import { FinancialFlowCanvas } from './FinancialFlowCanvas'
import {
  aggregateAccountsByNode,
  determineTransactionFlow,
  hasActiveBarterActivity,
  formatCurrency,
  type TransactionFlow,
} from '../../utils/flowCalculations'
import type { Account, JournalEntry } from '../../types'
import './FinancialFlowWidget.css'

export interface FinancialFlowWidgetProps {
  accounts: Account[]
  transactions: JournalEntry[]
  onNavigateToAccount?: (accountId: string) => void
}

type DateRange = 'last-30' | 'last-90' | 'last-365' | 'ytd' | 'last-year' | 'all-time' | 'custom'
type BarterDisplayMode = 'auto' | 'on' | 'off'

export const FinancialFlowWidget: React.FC<FinancialFlowWidgetProps> = ({
  accounts,
  transactions,
  onNavigateToAccount,
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showDataTable, setShowDataTable] = useState(false)
  const [dateRange, setDateRange] = useState<DateRange>('last-365')
  const [barterDisplay, setBarterDisplay] = useState<BarterDisplayMode>('auto')
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null)
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null)

  const widgetRef = useRef<HTMLDivElement>(null)
  const expandButtonRef = useRef<HTMLButtonElement>(null)

  // Calculate date range filter
  const getDateRangeFilter = (): { start: Date; end: Date } => {
    const now = new Date()
    const end = now

    switch (dateRange) {
      case 'last-30':
        return { start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), end }
      case 'last-90':
        return { start: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000), end }
      case 'last-365':
        return { start: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000), end }
      case 'ytd':
        return { start: new Date(now.getFullYear(), 0, 1), end }
      case 'last-year':
        return {
          start: new Date(now.getFullYear() - 1, 0, 1),
          end: new Date(now.getFullYear() - 1, 11, 31),
        }
      case 'custom':
        return {
          start: customStartDate || new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
          end: customEndDate || now,
        }
      case 'all-time':
      default:
        return { start: new Date(0), end }
    }
  }

  // Filter transactions by date range
  const { start, end } = getDateRangeFilter()
  const filteredTransactions = transactions.filter((tx) => {
    const txDate = new Date(tx.date)
    return txDate >= start && txDate <= end
  })

  // Aggregate nodes
  const nodes = aggregateAccountsByNode(accounts)

  // Generate flows from transactions
  const allFlows: TransactionFlow[] = filteredTransactions.flatMap((tx) =>
    determineTransactionFlow(tx)
  )

  // Detect barter activity
  const hasBarterActivity = hasActiveBarterActivity(filteredTransactions)

  // Determine if barter flows should be shown
  const showBarterFlows =
    barterDisplay === 'on' || (barterDisplay === 'auto' && hasBarterActivity)

  // Handle expand/collapse
  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded)
  }

  // Handle keyboard navigation (Esc to close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isExpanded) {
        setIsExpanded(false)
        // Return focus to expand button
        expandButtonRef.current?.focus()
      }
    }

    if (isExpanded) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isExpanded])

  // Canvas dimensions
  const compactSize = { width: 200, height: 150 }
  const expandedSize = { width: 1200, height: 700 }
  const canvasSize = isExpanded ? expandedSize : compactSize

  return (
    <>
      {/* Compact widget */}
      {!isExpanded && (
        <div
          ref={widgetRef}
          className="financial-flow-widget-compact"
          role="region"
          aria-label="Financial flow widget"
        >
          <div className="financial-flow-widget-header">
            <h3 className="financial-flow-widget-title">Financial Flow</h3>
            <button
              ref={expandButtonRef}
              type="button"
              className="financial-flow-widget-expand-btn"
              onClick={handleToggleExpand}
              aria-label="Expand financial flow visualization to full screen"
              aria-expanded={false}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M0 0h6v2H2v4H0V0zm16 0v6h-2V2h-4V0h6zM0 16v-6h2v4h4v2H0zm16 0h-6v-2h4v-4h2v6z" />
              </svg>
            </button>
          </div>
          <FinancialFlowCanvas
            nodes={nodes}
            flows={allFlows.slice(0, 5)} // Show only recent 5 flows in compact mode
            width={compactSize.width}
            height={compactSize.height}
            isCompact={true}
            showBarterFlows={showBarterFlows}
            onNodeClick={(_nodeType) => {
              // Click expands to full screen
              setIsExpanded(true)
            }}
          />
        </div>
      )}

      {/* Full-screen expanded view */}
      {isExpanded && (
        <div
          className="financial-flow-widget-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Financial flow visualization - full screen"
        >
          <div className="financial-flow-widget-expanded">
            {/* Header with controls */}
            <div className="financial-flow-widget-expanded-header">
              <h2 className="financial-flow-widget-expanded-title">
                Financial Flow Visualization
              </h2>

              <div className="financial-flow-widget-controls">
                {/* Date range selector */}
                <div className="financial-flow-widget-control-group">
                  <label htmlFor="date-range-select" className="financial-flow-widget-label">
                    Date Range:
                  </label>
                  <select
                    id="date-range-select"
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value as DateRange)}
                    className="financial-flow-widget-select"
                  >
                    <option value="last-30">Last 30 Days</option>
                    <option value="last-90">Last 90 Days</option>
                    <option value="last-365">Last 365 Days</option>
                    <option value="ytd">Year to Date</option>
                    <option value="last-year">Last Year</option>
                    <option value="all-time">All Time</option>
                    <option value="custom">Custom Range</option>
                  </select>
                </div>

                {/* Custom date inputs (shown when custom is selected) */}
                {dateRange === 'custom' && (
                  <div className="financial-flow-widget-control-group">
                    <label htmlFor="custom-start-date" className="financial-flow-widget-label">
                      Start:
                    </label>
                    <input
                      type="date"
                      id="custom-start-date"
                      value={customStartDate?.toISOString().split('T')[0] || ''}
                      onChange={(e) => setCustomStartDate(new Date(e.target.value))}
                      className="financial-flow-widget-date-input"
                    />
                    <label htmlFor="custom-end-date" className="financial-flow-widget-label">
                      End:
                    </label>
                    <input
                      type="date"
                      id="custom-end-date"
                      value={customEndDate?.toISOString().split('T')[0] || ''}
                      onChange={(e) => setCustomEndDate(new Date(e.target.value))}
                      className="financial-flow-widget-date-input"
                    />
                  </div>
                )}

                {/* Barter transaction toggle (I5 integration) */}
                <div className="financial-flow-widget-control-group">
                  <label htmlFor="barter-display-select" className="financial-flow-widget-label">
                    Barter Transactions:
                  </label>
                  <select
                    id="barter-display-select"
                    value={barterDisplay}
                    onChange={(e) => setBarterDisplay(e.target.value as BarterDisplayMode)}
                    className="financial-flow-widget-select"
                  >
                    <option value="auto">Auto (show if active)</option>
                    <option value="on">Always Show</option>
                    <option value="off">Always Hide</option>
                  </select>
                </div>

                {/* Screen reader data table toggle */}
                <button
                  type="button"
                  className="financial-flow-widget-toggle-table-btn"
                  onClick={() => setShowDataTable(!showDataTable)}
                  aria-pressed={showDataTable}
                >
                  {showDataTable ? 'Show Visualization' : 'Show Data Table'}
                </button>

                {/* Close button */}
                <button
                  type="button"
                  className="financial-flow-widget-close-btn"
                  onClick={handleToggleExpand}
                  aria-label="Close financial flow visualization"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Main content */}
            <div className="financial-flow-widget-content">
              {showDataTable ? (
                /* Accessible data table view */
                <div className="financial-flow-widget-data-table" role="region" aria-label="Financial flow data table">
                  <table className="financial-flow-table">
                    <caption className="sr-only">
                      Financial flow data showing account balances and health status
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Category</th>
                        <th scope="col">Balance</th>
                        <th scope="col">Health Status</th>
                        <th scope="col">Sub-Accounts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {nodes.map((node) => (
                        <tr key={node.type}>
                          <th scope="row">{node.label}</th>
                          <td>{formatCurrency(node.balance)}</td>
                          <td>
                            <span className={`health-badge health-badge-${node.healthStatus}`}>
                              {node.healthStatus}
                            </span>
                          </td>
                          <td>
                            {node.subNodes.length > 0 ? (
                              <ul className="sub-accounts-list">
                                {node.subNodes.map((sub) => (
                                  <li key={sub.accountId}>
                                    {sub.accountName}: {formatCurrency(sub.balance)}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <span className="text-muted">None</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Recent transactions table */}
                  <h3 className="financial-flow-widget-section-title">Recent Transactions</h3>
                  <table className="financial-flow-table">
                    <caption className="sr-only">
                      Recent transactions showing date, description, and amount
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Date</th>
                        <th scope="col">Description</th>
                        <th scope="col">Type</th>
                        <th scope="col">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allFlows.slice(0, 10).map((flow) => (
                        <tr key={flow.id}>
                          <td>{flow.date.toLocaleDateString()}</td>
                          <td>{flow.description}</td>
                          <td>
                            {flow.isBarter ? (
                              <span className="badge badge-barter">Barter ↔</span>
                            ) : flow.isCash ? (
                              <span className="badge badge-cash">Cash</span>
                            ) : (
                              <span className="badge badge-accrual">Accrual</span>
                            )}
                          </td>
                          <td>{formatCurrency(flow.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                /* Visual canvas */
                <FinancialFlowCanvas
                  nodes={nodes}
                  flows={allFlows}
                  width={canvasSize.width}
                  height={canvasSize.height}
                  isCompact={false}
                  showBarterFlows={showBarterFlows}
                  onNodeClick={(nodeType) => {
                    console.log('Node clicked:', nodeType)
                  }}
                  onSubAccountClick={(accountId) => {
                    if (onNavigateToAccount) {
                      onNavigateToAccount(accountId)
                      setIsExpanded(false)
                    }
                  }}
                />
              )}
            </div>

            {/* Footer with status */}
            <div className="financial-flow-widget-footer">
              <p className="financial-flow-widget-status">
                Showing {allFlows.length} transactions from{' '}
                {start.toLocaleDateString()} to {end.toLocaleDateString()}
                {hasBarterActivity && showBarterFlows && (
                  <span className="barter-active-indicator"> • Barter transactions active</span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
