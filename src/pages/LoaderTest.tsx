/**
 * Loader Test Page
 *
 * Simple page to view the PageLoader component without time constraints
 */

import { PageLoader } from '../components/loading/PageLoader'

export default function LoaderTest() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#faf5ff',
      padding: '2rem'
    }}>
      <PageLoader message="Loading your workspace..." />
    </div>
  )
}
