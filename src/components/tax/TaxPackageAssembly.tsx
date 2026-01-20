/**
 * Tax Package Assembly Component
 *
 * Assembles and exports complete tax package
 * Per ROADMAP J8 specification
 */

import { useState } from 'react'
import { Button } from '../core/Button'
import { generateTaxPackage, shareTaxPackageWithAdvisor } from '../../services/tax/taxPackageGenerator.service'
import type { TaxYear } from '../../types/tax.types'
import './TaxPackageAssembly.css'

interface TaxPackageAssemblyProps {
  userId: string
  taxYear: TaxYear
  workingWithCPA: boolean
}

export function TaxPackageAssembly({ userId, taxYear, workingWithCPA }: TaxPackageAssemblyProps) {
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDownload() {
    try {
      setGenerating(true)
      setError(null)
      const { blob } = await generateTaxPackage(userId, taxYear, 'Your Business')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Tax_Package_${taxYear}.zip`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError('Failed to generate package')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="tax-package-assembly">
      <h2>Export Tax Package</h2>
      <p>Your package includes:</p>
      <ul>
        <li>Profit & Loss Statement (PDF)</li>
        <li>Balance Sheet (PDF)</li>
        <li>Transaction CSV</li>
        <li>All uploaded documents</li>
      </ul>
      {error && <div className="error-message">{error}</div>}
      <Button onClick={handleDownload} disabled={generating}>
        {generating ? 'Generating...' : 'Download ZIP Package'}
      </Button>
      {workingWithCPA && (
        <p className="cpa-hint">Tip: You can also share this directly with your advisor through Graceful Books!</p>
      )}
    </div>
  )
}
