import { Link } from 'react-router-dom'

export default function Onboarding() {
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
        width: '100%',
        maxWidth: '600px',
        backgroundColor: 'var(--color-surface, #ffffff)',
        padding: '2rem',
        borderRadius: '0.5rem',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            Welcome to Graceful Books
          </h1>
          <p style={{ color: 'var(--color-text-secondary, #6b7280)', fontSize: '0.875rem' }}>
            Let's get you started with your financial journey
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Link
            to="/onboarding/assessment"
            className="card"
            style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}
          >
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              1. Assessment
            </h2>
            <p style={{ color: 'var(--color-text-secondary, #6b7280)', fontSize: '0.875rem' }}>
              Tell us about your business and goals
            </p>
          </Link>

          <div className="card" style={{ opacity: 0.6 }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              2. Setup
            </h2>
            <p style={{ color: 'var(--color-text-secondary, #6b7280)', fontSize: '0.875rem' }}>
              Configure your account and preferences
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
