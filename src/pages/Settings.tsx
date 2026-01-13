import { Breadcrumbs } from '../components/navigation/Breadcrumbs'

export default function Settings() {
  return (
    <div className="page">
      <Breadcrumbs />
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-description">Manage your account and application preferences.</p>
      </div>

      <div className="page-content">
        <div className="card">
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>Account Settings</h2>
          <p style={{ color: 'var(--color-text-secondary, #6b7280)', marginBottom: '1rem' }}>
            Configure your account preferences, security settings, and more.
          </p>
        </div>
      </div>
    </div>
  )
}
