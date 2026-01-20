/**
 * Financial Flow Canvas Component
 *
 * Main canvas for rendering the financial flow visualization.
 * Features:
 * - SVG-based layout with 6 primary nodes
 * - Accounting equation layout (Assets = Liabilities + Equity)
 * - D3-based positioning (optional force-directed layout)
 * - Responsive sizing
 * - Keyboard accessible
 *
 * Requirements:
 * - J1: Financial Flow Widget (Nice)
 * - WCAG 2.1 AA compliance
 */

import React, { useEffect, useRef, useState } from 'react'
import { FlowNode } from './FlowNode'
import { FlowAnimationQueue } from './FlowAnimation'
import type {
  FlowNode as FlowNodeType,
  FlowNodeType as NodeType,
  TransactionFlow,
} from '../../utils/flowCalculations'
import './FinancialFlowCanvas.css'

export interface FinancialFlowCanvasProps {
  nodes: FlowNodeType[]
  flows: TransactionFlow[]
  width: number
  height: number
  isCompact?: boolean
  showBarterFlows?: boolean
  onNodeClick?: (nodeType: string) => void
  onSubAccountClick?: (accountId: string) => void
}

export const FinancialFlowCanvas: React.FC<FinancialFlowCanvasProps> = ({
  nodes,
  flows,
  width,
  height,
  isCompact = false,
  showBarterFlows = true,
  onNodeClick,
  onSubAccountClick,
}) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const [nodePositions, setNodePositions] = useState<Map<NodeType, { x: number; y: number }>>(
    new Map()
  )

  // Calculate node positions based on accounting equation layout
  useEffect(() => {
    const padding = isCompact ? 40 : 80
    const centerX = width / 2
    const centerY = height / 2

    // Layout nodes to reflect accounting equation: Assets = Liabilities + Equity
    // Left side: Assets
    // Right side: Liabilities, Equity
    // Bottom: Revenue, COGS, Expenses (flow into top accounts)

    const positions = new Map<NodeType, { x: number; y: number }>()

    if (isCompact) {
      // Compact layout: simplified grid
      positions.set('assets', { x: padding + 60, y: centerY - 40 })
      positions.set('liabilities', { x: width - padding - 60, y: centerY - 60 })
      positions.set('equity', { x: width - padding - 60, y: centerY + 20 })
      positions.set('revenue', { x: centerX - 60, y: height - padding - 20 })
      positions.set('cogs', { x: centerX, y: height - padding - 20 })
      positions.set('expenses', { x: centerX + 60, y: height - padding - 20 })
    } else {
      // Full layout: accounting equation layout
      const topY = padding + 60
      const bottomY = height - padding - 60

      // Top row: Balance sheet accounts
      positions.set('assets', { x: padding + 100, y: topY })
      positions.set('liabilities', { x: width - padding - 150, y: topY - 30 })
      positions.set('equity', { x: width - padding - 150, y: topY + 60 })

      // Bottom row: Income statement accounts
      const bottomSpacing = (width - 2 * padding) / 4
      positions.set('revenue', { x: padding + bottomSpacing, y: bottomY })
      positions.set('cogs', { x: padding + bottomSpacing * 2, y: bottomY })
      positions.set('expenses', { x: padding + bottomSpacing * 3, y: bottomY })
    }

    setNodePositions(positions)
  }, [width, height, isCompact])

  // Get node position helper
  const getNodePosition = (nodeType: string): { x: number; y: number } => {
    return nodePositions.get(nodeType as NodeType) || { x: 0, y: 0 }
  }

  // Filter flows based on barter toggle
  const visibleFlows = showBarterFlows
    ? flows
    : flows.filter((flow) => !flow.isBarter)

  // Get all balances for size calculation
  const allBalances = nodes.map((node) => node.balance)

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      className="financial-flow-canvas"
      role="img"
      aria-label="Financial flow visualization showing money movement through your business"
    >
      <title>Financial Flow Visualization</title>
      <desc>
        Interactive visualization showing how money flows through your business.
        Six primary nodes represent Assets, Liabilities, Equity, Revenue, Cost of Goods Sold, and Expenses.
        Node size represents balance amount. Animated flows show transaction movement.
      </desc>

      {/* Background */}
      <rect width={width} height={height} fill="#fafafa" />

      {/* Grid lines (subtle) */}
      <g className="grid-lines" opacity={0.1}>
        {Array.from({ length: 5 }).map((_, i) => {
          const y = (height / 5) * (i + 1)
          return (
            <line
              key={`h-${i}`}
              x1={0}
              y1={y}
              x2={width}
              y2={y}
              stroke="#9ca3af"
              strokeWidth={1}
            />
          )
        })}
        {Array.from({ length: 5 }).map((_, i) => {
          const x = (width / 5) * (i + 1)
          return (
            <line
              key={`v-${i}`}
              x1={x}
              y1={0}
              x2={x}
              y2={height}
              stroke="#9ca3af"
              strokeWidth={1}
            />
          )
        })}
      </g>

      {/* Accounting equation label (full layout only) */}
      {!isCompact && (
        <text
          x={width / 2}
          y={30}
          textAnchor="middle"
          fill="#6b7280"
          fontSize="14"
          fontWeight="500"
          className="equation-label"
        >
          Assets = Liabilities + Equity
        </text>
      )}

      {/* Connection lines between nodes (static guides) */}
      <g className="connection-guides" opacity={0.15}>
        {/* Assets to Revenue */}
        <line
          x1={getNodePosition('assets').x}
          y1={getNodePosition('assets').y}
          x2={getNodePosition('revenue').x}
          y2={getNodePosition('revenue').y}
          stroke="#9ca3af"
          strokeWidth={1}
          strokeDasharray="2,2"
        />
        {/* Assets to Expenses */}
        <line
          x1={getNodePosition('assets').x}
          y1={getNodePosition('assets').y}
          x2={getNodePosition('expenses').x}
          y2={getNodePosition('expenses').y}
          stroke="#9ca3af"
          strokeWidth={1}
          strokeDasharray="2,2"
        />
        {/* Liabilities to Assets */}
        <line
          x1={getNodePosition('liabilities').x}
          y1={getNodePosition('liabilities').y}
          x2={getNodePosition('assets').x}
          y2={getNodePosition('assets').y}
          stroke="#9ca3af"
          strokeWidth={1}
          strokeDasharray="2,2"
        />
      </g>

      {/* Animated transaction flows */}
      {visibleFlows.length > 0 && (
        <FlowAnimationQueue
          flows={visibleFlows}
          getNodePosition={getNodePosition}
          maxConcurrent={3}
        />
      )}

      {/* Flow nodes */}
      {nodes.map((node) => {
        const position = getNodePosition(node.type)
        return (
          <FlowNode
            key={node.type}
            node={node}
            allBalances={allBalances}
            position={position}
            isCompact={isCompact}
            onNodeClick={onNodeClick}
            onSubAccountClick={onSubAccountClick}
          />
        )
      })}

      {/* Legend (full layout only) */}
      {!isCompact && (
        <g className="legend" transform={`translate(20, ${height - 100})`}>
          <text x={0} y={0} fontSize="12" fontWeight="600" fill="#374151">
            Legend:
          </text>
          <g transform="translate(0, 15)">
            <line x1={0} y1={0} x2={30} y2={0} stroke="#10b981" strokeWidth={2} />
            <text x={35} y={4} fontSize="11" fill="#6b7280">
              Cash Transaction
            </text>
          </g>
          <g transform="translate(0, 30)">
            <line x1={0} y1={0} x2={30} y2={0} stroke="#3b82f6" strokeWidth={2} strokeDasharray="5,5" />
            <text x={35} y={4} fontSize="11" fill="#6b7280">
              Accrual Entry
            </text>
          </g>
          {showBarterFlows && (
            <g transform="translate(0, 45)">
              <line x1={0} y1={0} x2={30} y2={0} stroke="#ea580c" strokeWidth={2} />
              <text x={35} y={4} fontSize="11" fill="#6b7280">
                Barter Transaction ↔
              </text>
            </g>
          )}
        </g>
      )}
    </svg>
  )
}
