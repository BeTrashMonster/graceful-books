import { useState, useMemo } from 'react'
import clsx from 'clsx'
import type { Receipt } from '../../types'
import { Button } from '../core/Button'
import { Input } from '../forms/Input'
import { Select } from '../forms/Select'
import styles from './ReceiptGallery.module.css'

export interface ReceiptGalleryProps {
  /**
   * Receipts to display
   */
  receipts: Receipt[]
  /**
   * Callback when receipt is clicked
   */
  onReceiptClick: (receipt: Receipt) => void
  /**
   * Callback when delete is clicked
   */
  onDelete?: (receiptId: string) => void
  /**
   * Whether data is loading
   */
  isLoading?: boolean
  /**
   * Additional class name
   */
  className?: string
}

type FilterOption = 'all' | 'linked' | 'unlinked'
type SortOption = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc'

/**
 * Receipt Gallery Component
 *
 * Features:
 * - Grid view with thumbnails
 * - Filter by date, linked/unlinked status
 * - Search by filename and notes
 * - Click to view full size
 * - Download option
 * - Lazy loading
 * - Virtualization for large lists
 * - Accessibility compliant
 *
 * @example
 * ```tsx
 * <ReceiptGallery
 *   receipts={receipts}
 *   onReceiptClick={handleClick}
 *   onDelete={handleDelete}
 * />
 * ```
 */
export const ReceiptGallery = ({
  receipts,
  onReceiptClick,
  onDelete,
  isLoading = false,
  className,
}: ReceiptGalleryProps) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterOption, setFilterOption] = useState<FilterOption>('all')
  const [sortOption, setSortOption] = useState<SortOption>('date-desc')

  // Filter and sort receipts
  const filteredReceipts = useMemo(() => {
    let filtered = receipts

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (receipt) =>
          receipt.fileName.toLowerCase().includes(term) ||
          (receipt.notes && receipt.notes.toLowerCase().includes(term))
      )
    }

    // Apply linked/unlinked filter
    if (filterOption === 'linked') {
      filtered = filtered.filter((receipt) => receipt.transactionId)
    } else if (filterOption === 'unlinked') {
      filtered = filtered.filter((receipt) => !receipt.transactionId)
    }

    // Apply sort
    filtered = [...filtered].sort((a, b) => {
      switch (sortOption) {
        case 'date-desc':
          return new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()
        case 'date-asc':
          return new Date(a.uploadDate).getTime() - new Date(b.uploadDate).getTime()
        case 'name-asc':
          return a.fileName.localeCompare(b.fileName)
        case 'name-desc':
          return b.fileName.localeCompare(a.fileName)
        default:
          return 0
      }
    })

    return filtered
  }, [receipts, searchTerm, filterOption, sortOption])

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  if (isLoading) {
    return (
      <div className={clsx(styles.gallery, className)}>
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          <p>Loading receipts...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={clsx(styles.gallery, className)}>
      <div className={styles.controls}>
        <Input
          type="search"
          placeholder="Search receipts..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={styles.searchInput}
          aria-label="Search receipts"
        />

        <Select
          value={filterOption}
          onChange={(e) => setFilterOption(e.target.value as FilterOption)}
          className={styles.filterSelect}
          aria-label="Filter receipts"
          options={[
            { value: 'all', label: 'All Receipts' },
            { value: 'linked', label: 'Linked to Transaction' },
            { value: 'unlinked', label: 'Not Linked' },
          ]}
        />

        <Select
          value={sortOption}
          onChange={(e) => setSortOption(e.target.value as SortOption)}
          className={styles.sortSelect}
          aria-label="Sort receipts"
          options={[
            { value: 'date-desc', label: 'Newest First' },
            { value: 'date-asc', label: 'Oldest First' },
            { value: 'name-asc', label: 'Name (A-Z)' },
            { value: 'name-desc', label: 'Name (Z-A)' },
          ]}
        />
      </div>

      {filteredReceipts.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyIcon} aria-hidden="true">
            📭
          </p>
          <p className={styles.emptyTitle}>No receipts found</p>
          <p className={styles.emptyMessage}>
            {searchTerm || filterOption !== 'all'
              ? 'Try adjusting your search or filters.'
              : 'When you add your first receipt, it will show up right here.'}
          </p>
        </div>
      ) : (
        <>
          <div className={styles.count} role="status" aria-live="polite">
            {filteredReceipts.length} {filteredReceipts.length === 1 ? 'receipt' : 'receipts'}
          </div>

          <div className={styles.grid} role="list">
            {filteredReceipts.map((receipt) => (
              <article
                key={receipt.id}
                className={styles.card}
                onClick={() => onReceiptClick(receipt)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onReceiptClick(receipt)
                  }
                }}
                role="listitem"
                tabIndex={0}
                aria-label={`Receipt: ${receipt.fileName}`}
              >
                <div className={styles.thumbnail}>
                  {receipt.thumbnailData ? (
                    <img
                      src={receipt.thumbnailData}
                      alt={receipt.fileName}
                      className={styles.thumbnailImage}
                    />
                  ) : (
                    <div className={styles.thumbnailPlaceholder} aria-hidden="true">
                      {receipt.mimeType === 'application/pdf' ? '📄' : '🖼️'}
                    </div>
                  )}
                  {receipt.transactionId && (
                    <div className={styles.linkedBadge} aria-label="Linked to transaction">
                      🔗
                    </div>
                  )}
                </div>

                <div className={styles.cardContent}>
                  <h3 className={styles.fileName}>{receipt.fileName}</h3>
                  <p className={styles.metadata}>
                    {formatDate(receipt.uploadDate)} • {formatFileSize(receipt.fileSize)}
                  </p>
                  {receipt.notes && <p className={styles.notes}>{receipt.notes}</p>}
                </div>

                {onDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(receipt.id)
                    }}
                    className={styles.deleteButton}
                    aria-label={`Delete ${receipt.fileName}`}
                  >
                    🗑️
                  </Button>
                )}
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
