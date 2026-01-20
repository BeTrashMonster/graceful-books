/**
 * Flow Animation Component
 *
 * Renders animated transaction flows between nodes.
 * Features:
 * - Solid lines for cash transactions
 * - Dashed lines for accrual entries
 * - Bidirectional arrows for barter transactions
 * - Smooth animations (1-2 seconds)
 * - Respects prefers-reduced-motion
 *
 * Requirements:
 * - J1: Financial Flow Widget (Nice)
 * - WCAG 2.1 AA compliance (reduced motion support)
 */

import React, { useEffect, useState } from 'react'
import type { TransactionFlow } from '../../utils/flowCalculations'
import './FlowAnimation.css'

export interface FlowAnimationProps {
  flow: TransactionFlow
  startPosition: { x: number; y: number }
  endPosition: { x: number; y: number }
  onAnimationComplete?: () => void
}

export const FlowAnimation: React.FC<FlowAnimationProps> = ({
  flow,
  startPosition,
  endPosition,
  onAnimationComplete,
}) => {
  const [progress, setProgress] = useState(0)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches)
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  // Animate the flow
  useEffect(() => {
    if (prefersReducedMotion) {
      // Skip animation, show final state immediately
      setProgress(1)
      if (onAnimationComplete) {
        onAnimationComplete()
      }
      return
    }

    const duration = 1500 // 1.5 seconds
    const startTime = Date.now()

    const animate = () => {
      const elapsed = Date.now() - startTime
      const newProgress = Math.min(elapsed / duration, 1)
      setProgress(newProgress)

      if (newProgress < 1) {
        requestAnimationFrame(animate)
      } else if (onAnimationComplete) {
        onAnimationComplete()
      }
    }

    const animationFrame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationFrame)
  }, [onAnimationComplete, prefersReducedMotion])

  // Calculate path coordinates
  const dx = endPosition.x - startPosition.x
  const dy = endPosition.y - startPosition.y

  // Use quadratic bezier curve for smoother path
  const controlX = startPosition.x + dx / 2
  const controlY = startPosition.y + dy / 2 - 50 // Slight arc

  const pathData = flow.isBarter
    ? // Bidirectional for barter (straight line with arrows on both ends)
      `M ${startPosition.x},${startPosition.y} L ${endPosition.x},${endPosition.y}`
    : // Normal flow (curved)
      `M ${startPosition.x},${startPosition.y} Q ${controlX},${controlY} ${endPosition.x},${endPosition.y}`

  // Calculate current position along path for animated particle
  const currentX = flow.isBarter
    ? startPosition.x + dx * progress
    : startPosition.x + dx * progress + (controlX - startPosition.x - dx * 0.5) * Math.sin(progress * Math.PI)

  const currentY = flow.isBarter
    ? startPosition.y + dy * progress
    : startPosition.y + dy * progress + (controlY - startPosition.y - dy * 0.5) * Math.sin(progress * Math.PI)

  // Determine stroke style and color
  const strokeDasharray = flow.isAccrual ? '5,5' : 'none'
  const strokeColor = flow.isBarter ? '#ea580c' : flow.isCash ? '#10b981' : '#3b82f6'
  const strokeWidth = 2

  // Arrow marker ID (unique per flow)
  const markerId = `arrow-${flow.id}`
  const markerStartId = flow.isBarter ? `arrow-start-${flow.id}` : undefined

  return (
    <g className="flow-animation" role="img" aria-label={`Transaction flow: ${flow.description}`}>
      <defs>
        {/* Arrow marker for end of path */}
        <marker
          id={markerId}
          markerWidth="10"
          markerHeight="10"
          refX="8"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L0,6 L9,3 z" fill={strokeColor} />
        </marker>

        {/* Arrow marker for start of path (barter only) */}
        {flow.isBarter && (
          <marker
            id={markerStartId!}
            markerWidth="10"
            markerHeight="10"
            refX="1"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M9,0 L9,6 L0,3 z" fill={strokeColor} />
          </marker>
        )}
      </defs>

      {/* Path line */}
      <path
        d={pathData}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDasharray}
        markerEnd={`url(#${markerId})`}
        markerStart={flow.isBarter ? `url(#${markerStartId})` : undefined}
        opacity={0.6}
        className="flow-animation-path"
      />

      {/* Animated particle moving along path */}
      {!prefersReducedMotion && progress < 1 && (
        <circle
          cx={currentX}
          cy={currentY}
          r={5}
          fill={strokeColor}
          className="flow-animation-particle"
        >
          <animate
            attributeName="r"
            values="5;7;5"
            dur="0.5s"
            repeatCount="indefinite"
          />
        </circle>
      )}

      {/* Label for barter transactions */}
      {flow.isBarter && (
        <text
          x={controlX}
          y={controlY - 10}
          textAnchor="middle"
          fill={strokeColor}
          fontSize="12"
          fontWeight="600"
          className="flow-animation-label"
        >
          Trade ↔
        </text>
      )}

      {/* Amount label (shows on hover or reduced motion) */}
      {(prefersReducedMotion || progress >= 0.5) && (
        <text
          x={controlX}
          y={controlY + 20}
          textAnchor="middle"
          fill="#374151"
          fontSize="11"
          fontWeight="500"
          className="flow-animation-amount"
        >
          {new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          }).format(flow.amount)}
        </text>
      )}
    </g>
  )
}

/**
 * Flow Animation Queue Component
 *
 * Manages multiple animations to prevent visual chaos
 */
export interface FlowAnimationQueueProps {
  flows: TransactionFlow[]
  getNodePosition: (nodeType: string) => { x: number; y: number }
  maxConcurrent?: number
}

export const FlowAnimationQueue: React.FC<FlowAnimationQueueProps> = ({
  flows,
  getNodePosition,
  maxConcurrent = 3,
}) => {
  const [activeFlows, setActiveFlows] = useState<TransactionFlow[]>([])
  const [_queuedFlows, setQueuedFlows] = useState<TransactionFlow[]>(flows)

  // Start next animation when one completes
  const handleAnimationComplete = (flowId: string) => {
    setActiveFlows((current) => current.filter((f) => f.id !== flowId))

    // Start next queued animation
    setQueuedFlows((current) => {
      if (current.length > 0) {
        const [next, ...rest] = current
        if (next) {
          setActiveFlows((active) => [...active, next])
        }
        return rest
      }
      return current
    })
  }

  // Initialize active flows
  useEffect(() => {
    const initial = flows.slice(0, maxConcurrent)
    const remaining = flows.slice(maxConcurrent)
    setActiveFlows(initial)
    setQueuedFlows(remaining)
  }, [flows, maxConcurrent])

  return (
    <g className="flow-animation-queue">
      {activeFlows.map((flow) => (
        <FlowAnimation
          key={flow.id}
          flow={flow}
          startPosition={getNodePosition(flow.fromNode)}
          endPosition={getNodePosition(flow.toNode)}
          onAnimationComplete={() => handleAnimationComplete(flow.id)}
        />
      ))}
    </g>
  )
}
