import { Breadcrumbs } from '../components/navigation/Breadcrumbs'
import { DataSafetyPanel } from '../components/settings/DataSafetyPanel'
import { CharitySettingsPanel } from '../components/settings/CharitySettingsPanel'

export default function Settings() {
  return (
    <div className="page">
      <Breadcrumbs />
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-description">Manage your account and application preferences.</p>
      </div>

      <div className="page-content">
        <CharitySettingsPanel />
        <DataSafetyPanel />
        {/* Account management has been moved to the Billing page */}
      </div>
    </div>
  )
}
