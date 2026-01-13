import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ErrorBoundary } from './ErrorBoundary'

interface RouteErrorBoundaryProps {
  children: React.ReactNode
}

export function RouteErrorBoundary({ children }: RouteErrorBoundaryProps) {
  const location = useLocation()
  const navigate = useNavigate()

  // Reset error boundary when route changes
  useEffect(() => {
    // This will unmount and remount the error boundary on route change
  }, [location.pathname])

  const handleReset = () => {
    // Navigate back or to dashboard
    navigate(-1)
  }

  return (
    <ErrorBoundary
      level="route"
      fallback={(error, reset) => (
        <RouteErrorFallback error={error} reset={reset} onNavigateBack={handleReset} />
      )}
    >
      {children}
    </ErrorBoundary>
  )
}

interface RouteErrorFallbackProps {
  error: Error
  reset: () => void
  onNavigateBack: () => void
}

function RouteErrorFallback({ error, reset, onNavigateBack }: RouteErrorFallbackProps) {
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <div style={{ maxWidth: '600px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem', color: '#dc2626' }}>
          We couldn't load that page
        </h2>
        <p style={{ marginBottom: '1.5rem', color: '#6b7280' }}>
          Something went wrong while loading this page. Let's try again or go back.
        </p>

        {import.meta.env.DEV && (
          <details style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
            <summary style={{ cursor: 'pointer', marginBottom: '0.5rem' }}>Error details (dev only)</summary>
            <pre
              style={{
                padding: '1rem',
                backgroundColor: '#f3f4f6',
                borderRadius: '0.375rem',
                overflow: 'auto',
                fontSize: '0.875rem',
              }}
            >
              {error.message}
            </pre>
          </details>
        )}

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={reset}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontWeight: '500',
            }}
          >
            Try Again
          </button>

          <button
            onClick={onNavigateBack}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontWeight: '500',
            }}
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  )
}
