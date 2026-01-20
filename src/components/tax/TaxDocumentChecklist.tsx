/**
 * Tax Document Checklist Component
 *
 * Displays 8-category checklist for tax document preparation
 * Allows marking categories as N/A, In Progress, or Complete
 *
 * Per ROADMAP J8 specification
 */

import { useState, useEffect } from 'react'
import { TaxDocumentUpload } from './TaxDocumentUpload'
import {
  getTaxDocumentCategories,
  getCategoryStatus,
  setCategoryStatus,
} from '../../services/tax/taxDocumentManager.service'
import type { TaxYear, TaxDocumentCategory } from '../../types/tax.types'
import './TaxDocumentChecklist.css'

interface TaxDocumentChecklistProps {
  userId: string
  taxYear: TaxYear
  onProgressUpdate?: () => void
}

type CategoryStatus = 'not-applicable' | 'in-progress' | 'complete'

export function TaxDocumentChecklist({
  userId,
  taxYear,
  onProgressUpdate,
}: TaxDocumentChecklistProps) {
  const [categories] = useState(getTaxDocumentCategories())
  const [categoryStatuses, setCategoryStatuses] = useState<Map<string, CategoryStatus>>(new Map())
  const [documentCounts, setDocumentCounts] = useState<Map<string, number>>(new Map())
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)

  useEffect(() => {
    loadCategoryStatuses()
  }, [userId, taxYear])

  async function loadCategoryStatuses() {
    const statuses = new Map<string, CategoryStatus>()
    const counts = new Map<string, number>()

    for (const category of categories) {
      const status = await getCategoryStatus(userId, taxYear, category.id)
      statuses.set(category.id, status.status)
      counts.set(category.id, status.documentCount)
    }

    setCategoryStatuses(statuses)
    setDocumentCounts(counts)
  }

  async function handleStatusChange(categoryId: string, status: CategoryStatus) {
    await setCategoryStatus(userId, taxYear, categoryId, status)
    await loadCategoryStatuses()
    if (onProgressUpdate) onProgressUpdate()
  }

  function handleCategoryClick(categoryId: string) {
    setExpandedCategory(expandedCategory === categoryId ? null : categoryId)
  }

  function getStatusIcon(status: CategoryStatus): string {
    switch (status) {
      case 'complete':
        return '✓'
      case 'in-progress':
        return '🔄'
      case 'not-applicable':
        return '—'
      default:
        return '⏸'
    }
  }

  function getStatusLabel(status: CategoryStatus): string {
    switch (status) {
      case 'complete':
        return 'Complete'
      case 'in-progress':
        return 'In Progress'
      case 'not-applicable':
        return 'Not Applicable'
      default:
        return 'Not Started'
    }
  }

  function getStatusClass(status: CategoryStatus): string {
    switch (status) {
      case 'complete':
        return 'status-complete'
      case 'in-progress':
        return 'status-in-progress'
      case 'not-applicable':
        return 'status-na'
      default:
        return 'status-not-started'
    }
  }

  return (
    <div className="tax-document-checklist">
      <h2>Tax Document Checklist</h2>
      <p className="checklist-description">
        Upload documents for each category. Mark categories as "Not Applicable" if they don't apply to your business.
      </p>

      <div className="category-list" role="list">
        {categories.map((category) => {
          const status = categoryStatuses.get(category.id) || 'in-progress'
          const documentCount = documentCounts.get(category.id) || 0
          const isExpanded = expandedCategory === category.id

          return (
            <div
              key={category.id}
              className={`category-item ${getStatusClass(status)} ${isExpanded ? 'expanded' : ''}`}
              role="listitem"
            >
              <div className="category-header">
                <button
                  className="category-toggle"
                  onClick={() => handleCategoryClick(category.id)}
                  aria-expanded={isExpanded}
                  aria-controls={`category-content-${category.id}`}
                >
                  <span className="status-icon" aria-label={getStatusLabel(status)}>
                    {getStatusIcon(status)}
                  </span>
                  <div className="category-info">
                    <h3 className="category-name">
                      {category.name}
                      {category.required && <span className="required-badge">Required</span>}
                    </h3>
                    <p className="category-description">{category.description}</p>
                    {documentCount > 0 && (
                      <p className="document-count">
                        {documentCount} document{documentCount !== 1 ? 's' : ''} uploaded
                      </p>
                    )}
                  </div>
                </button>

                <div className="category-actions">
                  <button
                    className={`status-button ${status === 'not-applicable' ? 'active' : ''}`}
                    onClick={() => handleStatusChange(category.id, 'not-applicable')}
                    aria-label={`Mark ${category.name} as not applicable`}
                    title="Not Applicable"
                  >
                    N/A
                  </button>
                  <button
                    className={`status-button ${status === 'complete' ? 'active' : ''}`}
                    onClick={() => handleStatusChange(category.id, 'complete')}
                    aria-label={`Mark ${category.name} as complete`}
                    title="Complete"
                    disabled={documentCount === 0 && status !== 'complete'}
                  >
                    ✓
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div
                  id={`category-content-${category.id}`}
                  className="category-content"
                  role="region"
                  aria-label={`${category.name} upload area`}
                >
                  <TaxDocumentUpload
                    userId={userId}
                    taxYear={taxYear}
                    categoryId={category.id}
                    categoryName={category.name}
                    onUploadComplete={async () => {
                      await loadCategoryStatuses()
                      if (onProgressUpdate) onProgressUpdate()
                    }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="checklist-help">
        <h4>Need Help?</h4>
        <ul>
          <li>
            <strong>Required categories:</strong> These are typically needed for most tax returns.
          </li>
          <li>
            <strong>Mark as N/A:</strong> If a category doesn't apply to your business, mark it as "Not Applicable".
          </li>
          <li>
            <strong>Documents:</strong> Upload PDFs or images (JPEG, PNG). Max 10MB per file.
          </li>
          <li>
            <strong>Notes:</strong> Add notes to each document to help your tax preparer understand the context.
          </li>
        </ul>
      </div>
    </div>
  )
}
