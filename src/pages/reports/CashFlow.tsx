import { Breadcrumbs } from '../../components/navigation/Breadcrumbs'

export default function CashFlow() {
  return (
    <div className="page">
      <Breadcrumbs />
      <div className="page-header">
        <h1 className="page-title">Cash Flow</h1>
        <p className="page-description">Track money in and out of your business.</p>
      </div>

      <div className="page-content">
        <div className="card">
          <p style={{ color: 'var(--color-text-secondary, #6b7280)' }}>
            Your Cash Flow statement will show how cash moves through your business over time.
          </p>
        </div>
      </div>
    </div>
  )
}
