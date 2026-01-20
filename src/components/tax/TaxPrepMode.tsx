/**
 * Tax Prep Mode Component
 *
 * Main tax preparation workflow (J8)
 * Guides users through tax document preparation with calm, reassuring experience
 *
 * Per ROADMAP J8 specification
 */

import { useState, useEffect } from 'react'
import { Button } from '../core/Button'
import { Radio } from '../forms/Radio'
import { Label } from '../forms/Label'
import { Loading } from '../feedback/Loading'
import { ErrorMessage } from '../feedback/ErrorMessage'
import { TaxDocumentChecklist } from './TaxDocumentChecklist'
import { TaxPackageAssembly } from './TaxPackageAssembly'
import { calculateTaxPrepProgress } from '../../services/tax/taxDocumentManager.service'
import { db } from '../../db'
import type { TaxYear, TaxPrepSession } from '../../types/tax.types'
import './TaxPrepMode.css'

interface TaxPrepModeProps {
  userId: string
  onClose?: () => void
}

type BusinessStructure = 'sole-proprietor' | 'partnership' | 's-corp' | 'c-corp'

export function TaxPrepMode({ userId, onClose }: TaxPrepModeProps) {
  const [isActivated, setIsActivated] = useState(false)
  const [session, setSession] = useState<TaxPrepSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState({ percentage: 0, categoriesComplete: 0, categoriesTotal: 8 })

  // Activation form state
  const [taxYear, setTaxYear] = useState<TaxYear>(new Date().getFullYear().toString())
  const [businessStructure, setBusinessStructure] = useState<BusinessStructure>('sole-proprietor')
  const [workingWithCPA, setWorkingWithCPA] = useState<boolean>(true)

  useEffect(() => {
    loadSession()
  }, [userId])

  useEffect(() => {
    if (session) {
      loadProgress()
    }
  }, [session])

  async function loadSession() {
    try {
      setIsLoading(true)
      setError(null)

      // Check for existing active session
      const existingSession = await db.taxPrepSessions
        .where({ userId, status: 'active' })
        .first()

      if (existingSession) {
        setSession(existingSession)
        setIsActivated(true)
      }
    } catch (err) {
      setError('Failed to load tax prep session. Please try again.')
      console.error('Error loading session:', err)
    } finally {
      setIsLoading(false)
    }
  }

  async function loadProgress() {
    if (!session) return

    try {
      const progressData = await calculateTaxPrepProgress(userId, session.taxYear)
      setProgress(progressData)
    } catch (err) {
      console.error('Error loading progress:', err)
    }
  }

  async function handleActivate() {
    try {
      setIsLoading(true)
      setError(null)

      const newSession: TaxPrepSession = {
        id: crypto.randomUUID(),
        userId,
        taxYear,
        businessStructure,
        workingWithCPA,
        activatedAt: new Date().toISOString(),
        status: 'active',
      }

      await db.taxPrepSessions.add(newSession)
      setSession(newSession)
      setIsActivated(true)
    } catch (err) {
      setError('Failed to activate tax prep mode. Please try again.')
      console.error('Error activating tax prep:', err)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleComplete() {
    if (!session) return

    try {
      setIsLoading(true)
      setError(null)

      await db.taxPrepSessions.update(session.id!, {
        status: 'complete',
        completedAt: new Date().toISOString(),
      })

      setIsActivated(false)
      if (onClose) onClose()
    } catch (err) {
      setError('Failed to complete tax prep. Please try again.')
      console.error('Error completing tax prep:', err)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="tax-prep-loading">
        <Loading message="Loading tax preparation..." />
      </div>
    )
  }

  if (!isActivated) {
    return (
      <div className="tax-prep-activation">
        <div className="tax-prep-header">
          <h1>Get Ready for Tax Season</h1>
          <p>
            Let's get organized for tax season. We'll take it step by step - no rush.
          </p>
        </div>

        {error && (
          <ErrorMessage message={error} onDismiss={() => setError(null)} />
        )}

        <div className="tax-prep-form">
          <div className="form-group">
            <Label htmlFor="tax-year">Which tax year are you preparing?</Label>
            <div className="radio-group" role="radiogroup" aria-labelledby="tax-year">
              <Radio
                id="tax-year-current"
                name="tax-year"
                value={new Date().getFullYear().toString()}
                checked={taxYear === new Date().getFullYear().toString()}
                onChange={(e) => setTaxYear(e.target.value as TaxYear)}
                label={`${new Date().getFullYear()} (most recent)`}
              />
              <Radio
                id="tax-year-previous"
                name="tax-year"
                value={(new Date().getFullYear() - 1).toString()}
                checked={taxYear === (new Date().getFullYear() - 1).toString()}
                onChange={(e) => setTaxYear(e.target.value as TaxYear)}
                label={`${new Date().getFullYear() - 1} (prior year)`}
              />
            </div>
          </div>

          <div className="form-group">
            <Label htmlFor="business-structure">What's your business structure?</Label>
            <div className="radio-group" role="radiogroup" aria-labelledby="business-structure">
              <Radio
                id="structure-sole-prop"
                name="business-structure"
                value="sole-proprietor"
                checked={businessStructure === 'sole-proprietor'}
                onChange={(e) => setBusinessStructure(e.target.value as BusinessStructure)}
                label="Sole Proprietor / LLC (Schedule C)"
              />
              <Radio
                id="structure-partnership"
                name="business-structure"
                value="partnership"
                checked={businessStructure === 'partnership'}
                onChange={(e) => setBusinessStructure(e.target.value as BusinessStructure)}
                label="Partnership"
              />
              <Radio
                id="structure-s-corp"
                name="business-structure"
                value="s-corp"
                checked={businessStructure === 's-corp'}
                onChange={(e) => setBusinessStructure(e.target.value as BusinessStructure)}
                label="S-Corporation"
              />
              <Radio
                id="structure-c-corp"
                name="business-structure"
                value="c-corp"
                checked={businessStructure === 'c-corp'}
                onChange={(e) => setBusinessStructure(e.target.value as BusinessStructure)}
                label="C-Corporation"
              />
            </div>
          </div>

          <div className="form-group">
            <Label htmlFor="working-with-cpa">Are you working with a tax professional?</Label>
            <div className="radio-group" role="radiogroup" aria-labelledby="working-with-cpa">
              <Radio
                id="cpa-yes"
                name="working-with-cpa"
                value="yes"
                checked={workingWithCPA === true}
                onChange={() => setWorkingWithCPA(true)}
                label="Yes - I'll send them an export package"
              />
              <Radio
                id="cpa-no"
                name="working-with-cpa"
                value="no"
                checked={workingWithCPA === false}
                onChange={() => setWorkingWithCPA(false)}
                label="No - I'm doing my own taxes"
              />
            </div>
          </div>

          <div className="form-actions">
            {onClose && (
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
            )}
            <Button variant="primary" onClick={handleActivate}>
              Start Tax Prep
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="tax-prep-active">
      <div className="tax-prep-header">
        <h1>Tax Prep Mode: {session?.taxYear} Tax Year</h1>
        <div className="progress-bar" role="progressbar" aria-valuenow={progress.percentage} aria-valuemin={0} aria-valuemax={100}>
          <div className="progress-fill" style={{ width: `${progress.percentage}%` }} />
          <span className="progress-label">{progress.percentage}% Complete</span>
        </div>
      </div>

      {error && (
        <ErrorMessage message={error} onDismiss={() => setError(null)} />
      )}

      <div className="tax-prep-content">
        <TaxDocumentChecklist
          userId={userId}
          taxYear={session?.taxYear || taxYear}
          onProgressUpdate={loadProgress}
        />

        <TaxPackageAssembly
          userId={userId}
          taxYear={session?.taxYear || taxYear}
          workingWithCPA={session?.workingWithCPA || workingWithCPA}
        />
      </div>

      <div className="tax-prep-actions">
        <Button variant="secondary" onClick={onClose}>
          Save and Exit
        </Button>
        {progress.percentage === 100 && (
          <Button variant="primary" onClick={handleComplete}>
            Mark as Complete
          </Button>
        )}
      </div>
    </div>
  )
}
