import { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: (error: Error, reset: () => void) => ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  level?: 'root' | 'route' | 'component'
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo)

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo)

    // TODO: Send to error tracking service (e.g., Sentry)
    // trackError(error, errorInfo, this.props.level)
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  public render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleReset)
      }

      // Default fallback UI based on level
      return <DefaultErrorFallback error={this.state.error} reset={this.handleReset} level={this.props.level} />
    }

    return this.props.children
  }
}

interface FallbackProps {
  error: Error
  reset: () => void
  level?: 'root' | 'route' | 'component'
}

function DefaultErrorFallback({ error, reset, level = 'component' }: FallbackProps) {
  const isRoot = level === 'root'

  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: isRoot ? '100vh' : '400px',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <div style={{ maxWidth: '600px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#dc2626' }}>
          {isRoot ? 'Oops! Something went wrong' : 'Something unexpected happened'}
        </h1>
        <p style={{ marginBottom: '1.5rem', color: '#6b7280' }}>
          {isRoot
            ? "Don't worry - your data is safe. We've logged the error and will look into it."
            : "We couldn't load this section. Let's try again."}
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
              {'\n\n'}
              {error.stack}
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

          {isRoot && (
            <button
              onClick={() => window.location.reload()}
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
              Reload Page
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
