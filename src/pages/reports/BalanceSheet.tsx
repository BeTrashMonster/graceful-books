import { Breadcrumbs } from '../../components/navigation/Breadcrumbs'

export default function BalanceSheet() {
  return (
    <div className="page">
      <Breadcrumbs />
      <div className="page-header">
        <h1 className="page-title">Balance Sheet</h1>
        <p className="page-description">See your assets, liabilities, and equity.</p>
      </div>

      <div className="page-content">
        <div className="card">
          <p style={{ color: 'var(--color-text-secondary, #6b7280)' }}>
            Your Balance Sheet will display your company's financial position at a specific point in time.
          </p>
        </div>
      </div>
    </div>
  )
}
