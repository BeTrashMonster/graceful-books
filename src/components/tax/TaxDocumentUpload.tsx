/**
 * Tax Document Upload Component
 *
 * Handles file upload for tax documents with accessible drag-and-drop
 * Per ROADMAP J8 specification
 */

import React, { useState, useRef } from 'react'
import { Button } from '../core/Button'
import { uploadTaxDocument, getTaxDocumentsByCategory, deleteTaxDocument } from '../../services/tax/taxDocumentManager.service'
import type { TaxYear, TaxDocument } from '../../types/tax.types'
import './TaxDocumentUpload.css'

interface TaxDocumentUploadProps {
  userId: string
  taxYear: TaxYear
  categoryId: string
  categoryName: string
  onUploadComplete?: () => void
}

export function TaxDocumentUpload({ userId, taxYear, categoryId, categoryName, onUploadComplete }: TaxDocumentUploadProps) {
  const [documents, setDocuments] = useState<TaxDocument[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    loadDocuments()
  }, [userId, taxYear, categoryId])

  async function loadDocuments() {
    const docs = await getTaxDocumentsByCategory(userId, taxYear, categoryId)
    setDocuments(docs)
  }

  async function handleFileSelect(files: FileList | null) {
    if (!files || files.length === 0) return

    setUploading(true)
    setError(null)

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        await uploadTaxDocument(userId, taxYear, categoryId, file, notes)
      }
      await loadDocuments()
      setNotes('')
      if (onUploadComplete) onUploadComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(documentId: string) {
    if (!confirm('Delete this document?')) return
    await deleteTaxDocument(documentId)
    await loadDocuments()
    if (onUploadComplete) onUploadComplete()
  }

  return (
    <div className="tax-document-upload">
      <div className="upload-area">
        <input ref={fileInputRef} type="file" multiple accept="application/pdf,image/jpeg,image/png" onChange={(e) => handleFileSelect(e.target.files)} aria-label={`Upload ${categoryName} documents`} style={{ display: 'none' }} />
        <div className="upload-prompt">
          <p>Upload {categoryName}</p>
          <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? 'Uploading...' : 'Choose Files'}
          </Button>
          <p className="upload-hint">PDF, JPEG, PNG (Max 10MB per file)</p>
        </div>
        {error && <div className="error-message">{error}</div>}
        <div className="notes-input">
          <label htmlFor={`notes-${categoryId}`}>Notes for accountant (optional):</label>
          <textarea id={`notes-${categoryId}`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add context for your tax preparer..." rows={3} />
        </div>
      </div>
      {documents.length > 0 && (
        <div className="document-list">
          <h4>Uploaded Documents ({documents.length})</h4>
          <ul>
            {documents.map((doc) => (
              <li key={doc.id}>
                <span className="doc-name">{doc.fileName}</span>
                {doc.notes && <span className="doc-notes">{doc.notes}</span>}
                <Button variant="secondary" size="small" onClick={() => handleDelete(doc.id)}>Delete</Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
