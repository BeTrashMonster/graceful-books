import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--color-background, #f9fafb)',
      padding: '1rem'
    }}>
      <div style={{
        textAlign: 'center',
        maxWidth: '600px'
      }}>
        <h1 style={{
          fontSize: '6rem',
          fontWeight: 'bold',
          color: 'var(--color-primary, #3b82f6)',
          margin: 0
        }}>
          404
        </h1>
        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: 600,
          marginTop: '1rem',
          marginBottom: '0.5rem'
        }}>
          Page Not Found
        </h2>
        <p style={{
          color: 'var(--color-text-secondary, #6b7280)',
          marginBottom: '2rem'
        }}>
          Sorry, we couldn't find the page you're looking for. Let's get you back on track.
        </p>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link
            to="/dashboard"
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: 'var(--color-primary, #3b82f6)',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '0.375rem',
              fontWeight: 500,
              display: 'inline-block'
            }}
          >
            Go to Dashboard
          </Link>

          <button
            onClick={() => window.history.back()}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: 'transparent',
              color: 'var(--color-text-primary, #111827)',
              border: '1px solid var(--color-border, #e5e7eb)',
              borderRadius: '0.375rem',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  )
}
