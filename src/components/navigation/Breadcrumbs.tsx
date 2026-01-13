import { Link, useLocation } from 'react-router-dom'
import './Breadcrumbs.css'

interface BreadcrumbItem {
  label: string
  path: string
}

// Map routes to breadcrumb labels
const routeLabels: Record<string, string> = {
  dashboard: 'Dashboard',
  transactions: 'Transactions',
  reports: 'Reports',
  'profit-loss': 'Profit & Loss',
  'balance-sheet': 'Balance Sheet',
  'cash-flow': 'Cash Flow',
  settings: 'Settings',
}

export function Breadcrumbs() {
  const location = useLocation()

  const getBreadcrumbs = (): BreadcrumbItem[] => {
    const pathSegments = location.pathname.split('/').filter(Boolean)

    if (pathSegments.length === 0) {
      return []
    }

    const breadcrumbs: BreadcrumbItem[] = []
    let currentPath = ''

    pathSegments.forEach((segment) => {
      currentPath += `/${segment}`
      const label = routeLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1)

      breadcrumbs.push({
        label,
        path: currentPath,
      })
    })

    return breadcrumbs
  }

  const breadcrumbs = getBreadcrumbs()

  if (breadcrumbs.length === 0) {
    return null
  }

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <ol className="breadcrumbs__list">
        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1

          return (
            <li key={crumb.path} className="breadcrumbs__item">
              {!isLast ? (
                <>
                  <Link to={crumb.path} className="breadcrumbs__link">
                    {crumb.label}
                  </Link>
                  <span className="breadcrumbs__separator" aria-hidden="true">
                    /
                  </span>
                </>
              ) : (
                <span className="breadcrumbs__current" aria-current="page">
                  {crumb.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
