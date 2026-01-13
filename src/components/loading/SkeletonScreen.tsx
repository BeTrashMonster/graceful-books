import './SkeletonScreen.css'

interface SkeletonProps {
  width?: string
  height?: string
  variant?: 'text' | 'circular' | 'rectangular'
  className?: string
}

export function Skeleton({ width = '100%', height = '1rem', variant = 'text', className = '' }: SkeletonProps) {
  return (
    <div
      className={`skeleton skeleton--${variant} ${className}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  )
}

interface SkeletonTextProps {
  lines?: number
  lastLineWidth?: string
}

export function SkeletonText({ lines = 3, lastLineWidth = '70%' }: SkeletonTextProps) {
  return (
    <div className="skeleton-text">
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          width={index === lines - 1 ? lastLineWidth : '100%'}
          height="1rem"
          variant="text"
        />
      ))}
    </div>
  )
}

interface SkeletonCardProps {
  hasImage?: boolean
}

export function SkeletonCard({ hasImage = false }: SkeletonCardProps) {
  return (
    <div className="skeleton-card">
      {hasImage && <Skeleton height="200px" variant="rectangular" />}
      <div className="skeleton-card__content">
        <Skeleton width="60%" height="1.5rem" variant="text" />
        <SkeletonText lines={2} />
      </div>
    </div>
  )
}

interface SkeletonTableProps {
  rows?: number
  columns?: number
}

export function SkeletonTable({ rows = 5, columns = 4 }: SkeletonTableProps) {
  return (
    <div className="skeleton-table">
      {/* Header */}
      <div className="skeleton-table__row skeleton-table__header">
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton key={`header-${index}`} height="2rem" variant="text" />
        ))}
      </div>

      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={`row-${rowIndex}`} className="skeleton-table__row">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={`cell-${rowIndex}-${colIndex}`} height="1.5rem" variant="text" />
          ))}
        </div>
      ))}
    </div>
  )
}
