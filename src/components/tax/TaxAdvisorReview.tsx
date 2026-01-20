/**
 * Tax Advisor Review Component (J7 Integration)
 *
 * Allows advisors to review client tax packages
 * Per ROADMAP J8 and J7 specifications
 */

import React, { useState, useEffect } from 'react'
import { Button } from '../core/Button'
import { db } from '../../db'
import type { TaxYear, TaxAdvisorAccess } from '../../types/tax.types'
import './TaxAdvisorReview.css'

interface TaxAdvisorReviewProps {
  advisorUserId: string
  clientUserId: string
  taxYear: TaxYear
}

export function TaxAdvisorReview({ advisorUserId, clientUserId, taxYear }: TaxAdvisorReviewProps) {
  const [access, setAccess] = useState<TaxAdvisorAccess | null>(null)
  const [notes, setNotes] = useState('')

  useEffect(() => {
    loadAccess()
  }, [advisorUserId, clientUserId, taxYear])

  async function loadAccess() {
    const accessRecord = await db.taxAdvisorAccess.where({ advisorUserId, clientUserId, taxYear }).first()
    if (accessRecord) {
      setAccess(accessRecord)
      setNotes(accessRecord.advisorNotes || '')
    }
  }

  async function handleStatusUpdate(status: 'reviewed' | 'needs-info') {
    if (!access) return
    await db.taxAdvisorAccess.update(access.id!, { reviewStatus: status, advisorNotes: notes })
    await loadAccess()
    // TODO: Trigger IC4 email notification to client (Template 6)
  }

  if (!access) return <div>No access to this tax package</div>

  return (
    <div className="tax-advisor-review">
      <h3>Tax Package Review</h3>
      <div className="review-notes">
        <label htmlFor="advisor-notes">Your Notes:</label>
        <textarea id="advisor-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={5} placeholder="Add notes or questions for the client..." />
      </div>
      <div className="review-actions">
        <Button onClick={() => handleStatusUpdate('reviewed')}>Mark as Reviewed</Button>
        <Button variant="secondary" onClick={() => handleStatusUpdate('needs-info')}>Request More Info</Button>
      </div>
    </div>
  )
}
