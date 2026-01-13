export default function Setup() {
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
          Account Setup
        </h1>
        <p style={{ color: 'var(--color-text-secondary, #6b7280)', marginBottom: '2rem' }}>
          Let's configure your account settings and preferences.
        </p>

        <div className="card">
          <p style={{ color: 'var(--color-text-secondary, #6b7280)' }}>
            Setup wizard will be implemented here.
          </p>
        </div>
      </div>
    </div>
  )
}
