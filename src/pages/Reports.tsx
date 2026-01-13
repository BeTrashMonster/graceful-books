import { Link } from 'react-router-dom'
import { Breadcrumbs } from '../components/navigation/Breadcrumbs'

export default function Reports() {
  const reports = [
    {
      title: 'Profit & Loss',
      description: 'View your income and expenses over time',
      path: '/reports/profit-loss',
    },
    {
      title: 'Balance Sheet',
      description: 'See your assets, liabilities, and equity',
      path: '/reports/balance-sheet',
    },
    {
      title: 'Cash Flow',
      description: 'Track money in and out of your business',
      path: '/reports/cash-flow',
    },
  ]

  return (
    <div className="page">
      <Breadcrumbs />
      <div className="page-header">
        <h1 className="page-title">Reports</h1>
        <p className="page-description">Financial reports and insights for your business.</p>
      </div>

      <div className="page-content">
        <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          {reports.map((report) => (
            <Link
              key={report.path}
              to={report.path}
              className="card"
              style={{ textDecoration: 'none', color: 'inherit', transition: 'transform 0.2s' }}
            >
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' }}>{report.title}</h2>
              <p style={{ color: 'var(--color-text-secondary, #6b7280)', fontSize: '0.875rem' }}>
                {report.description}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
