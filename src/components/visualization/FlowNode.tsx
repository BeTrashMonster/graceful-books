/**
 * Flow Node Component
 *
 * Renders an individual node in the financial flow visualization.
 * Features:
 * - Size proportional to balance
 * - Color-coded by node type
 * - Health indicator border
 * - Hover popover with sub-accounts
 * - Keyboard accessible
 *
 * Requirements:
 * - J1: Financial Flow Widget (Nice)
 * - WCAG 2.1 AA compliance
 */

import React, { useState, useRef, useEffect } from 'react'
import type { FlowNode as FlowNodeType } from '../../utils/flowCalculations'
import {
  getNodeColor,
  getHealthColor,
  formatCurrency,
  calculateNodeSize,
} from '../../utils/flowCalculations'
import './FlowNode.css'

export interface FlowNodeProps {
  node: FlowNodeType
  allBalances: number[]
  position: { x: number; y: number }
  isCompact?: boolean
  onNodeClick?: (nodeType: string) => void
  onSubAccountClick?: (accountId: string) => void
}

export const FlowNode: React.FC<FlowNodeProps> = ({
  node,
  allBalances,
  position,
  isCompact = false,
  onNodeClick,
  onSubAccountClick,
}) => {
  const [showPopover, setShowPopover] = useState(false)
  const [focusedSubIndex, setFocusedSubIndex] = useState(-1)
  const nodeRef = useRef<SVGGElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Calculate node size
  const sizeScale = calculateNodeSize(node.balance, allBalances)
  const baseRadius = isCompact ? 30 : 50
  const radius = baseRadius * sizeScale

  // Colors
  const nodeColor = getNodeColor(node.type)
  const healthColor = getHealthColor(node.healthStatus)

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (onNodeClick) {
        onNodeClick(node.type)
      }
      setShowPopover(!showPopover)
    } else if (e.key === 'Escape') {
      setShowPopover(false)
      setFocusedSubIndex(-1)
    } else if (showPopover && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault()
      const direction = e.key === 'ArrowDown' ? 1 : -1
      const newIndex = Math.max(
        -1,
        Math.min(node.subNodes.length - 1, focusedSubIndex + direction)
      )
      setFocusedSubIndex(newIndex)
    }
  }

  // Handle sub-account keyboard selection
  const handleSubAccountKeyDown = (
    e: React.KeyboardEvent,
    accountId: string,
    index: number
  ) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (onSubAccountClick) {
        onSubAccountClick(accountId)
      }
    }
  }

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        nodeRef.current &&
        !nodeRef.current.contains(event.target as Node)
      ) {
        setShowPopover(false)
      }
    }

    if (showPopover) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showPopover])

  // Generate accessible label
  const ariaLabel = `${node.label}: ${formatCurrency(node.balance)}. Health status: ${node.healthStatus}. ${node.subNodes.length} sub-accounts. Press Enter to view details.`

  return (
    <>
      <g
        ref={nodeRef}
        transform={`translate(${position.x}, ${position.y})`}
        className="flow-node"
        tabIndex={0}
        role="button"
        aria-label={ariaLabel}
        aria-expanded={showPopover}
        onKeyDown={handleKeyDown}
        onMouseEnter={() => setShowPopover(true)}
        onMouseLeave={() => setShowPopover(false)}
        onClick={() => {
          if (onNodeClick) onNodeClick(node.type)
          setShowPopover(!showPopover)
        }}
      >
        {/* Health indicator ring */}
        <circle
          cx={0}
          cy={0}
          r={radius + 4}
          fill="none"
          stroke={healthColor}
          strokeWidth={3}
          className="flow-node-health-ring"
        />

        {/* Main node circle */}
        <circle
          cx={0}
          cy={0}
          r={radius}
          fill={nodeColor}
          className="flow-node-circle"
        />

        {/* Node label */}
        <text
          x={0}
          y={-5}
          textAnchor="middle"
          fill="white"
          fontSize={isCompact ? 12 : 14}
          fontWeight="600"
          className="flow-node-label"
        >
          {node.label}
        </text>

        {/* Balance */}
        <text
          x={0}
          y={isCompact ? 8 : 10}
          textAnchor="middle"
          fill="white"
          fontSize={isCompact ? 10 : 12}
          className="flow-node-balance"
        >
          {formatCurrency(node.balance)}
        </text>

        {/* Focus indicator (keyboard navigation) */}
        <circle
          cx={0}
          cy={0}
          r={radius + 8}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className="flow-node-focus-ring"
          style={{ display: 'none' }}
        />
      </g>

      {/* Popover with sub-accounts */}
      {showPopover && !isCompact && (
        <div
          ref={popoverRef}
          className="flow-node-popover"
          style={{
            position: 'absolute',
            left: position.x + radius + 20,
            top: position.y - 100,
            zIndex: 1000,
          }}
          role="dialog"
          aria-label={`Sub-accounts for ${node.label}`}
        >
          <div className="flow-node-popover-header">
            <h3>{node.label}</h3>
            <button
              type="button"
              className="flow-node-popover-close"
              onClick={(e) => {
                e.stopPropagation()
                setShowPopover(false)
              }}
              aria-label="Close sub-accounts panel"
            >
              ×
            </button>
          </div>
          <div className="flow-node-popover-content">
            {node.subNodes.length === 0 ? (
              <p className="flow-node-popover-empty">No sub-accounts</p>
            ) : (
              <ul className="flow-node-popover-list" role="list">
                {node.subNodes.map((subNode, index) => (
                  <li
                    key={subNode.accountId}
                    className={`flow-node-popover-item ${
                      focusedSubIndex === index ? 'focused' : ''
                    }`}
                    role="listitem"
                  >
                    <button
                      type="button"
                      className="flow-node-popover-item-button"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (onSubAccountClick) {
                          onSubAccountClick(subNode.accountId)
                        }
                      }}
                      onKeyDown={(e) =>
                        handleSubAccountKeyDown(e, subNode.accountId, index)
                      }
                      tabIndex={0}
                    >
                      <span className="flow-node-popover-item-name">
                        {subNode.accountName}
                      </span>
                      <span className="flow-node-popover-item-balance">
                        {formatCurrency(subNode.balance)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  )
}
