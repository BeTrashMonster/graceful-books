export default function Assessment() {
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
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1rem' }}>
          Business Assessment
        </h1>
        <p style={{ color: 'var(--color-text-secondary, #6b7280)', marginBottom: '1rem' }}>
          This assessment will help us understand your business phase and prepare a personalized path for you.
        </p>

        <div style={{
          backgroundColor: 'var(--color-primary-50, #eff6ff)',
          padding: '1rem',
          borderRadius: '0.375rem',
          marginBottom: '2rem'
        }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            Our Communication Style
          </h2>
          <p style={{ color: 'var(--color-text-secondary, #6b7280)', fontSize: '0.875rem' }}>
            We use a patient, step-by-step approach for all users. You'll find clear guidance,
            supportive messaging, and no rush to complete tasks. We're here to support you at your own pace.
          </p>
        </div>

        <div className="card">
          <p style={{ color: 'var(--color-text-secondary, #6b7280)' }}>
            Assessment questions will focus on your business phase, type, and financial literacy level.
          </p>
        </div>
      </div>
    </div>
  )
}
