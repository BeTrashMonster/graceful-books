import { Breadcrumbs } from '../components/navigation/Breadcrumbs'
import { DataSafetyPanel } from '../components/settings/DataSafetyPanel'
import { CharitySettingsPanel } from '../components/settings/CharitySettingsPanel'
import { TimezoneSettingsPanel } from '../components/settings/TimezoneSettingsPanel'

export default function Settings() {
  console.log('[Settings] Rendering Settings page');
  console.log('[Settings] About to render TimezoneSettingsPanel');

  return (
    <div className="page">
      <Breadcrumbs />
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-description">Manage your account and application preferences.</p>
      </div>

      <div className="page-content">
        {console.log('[Settings] Rendering page-content div')}
        <TimezoneSettingsPanel />
        {console.log('[Settings] After TimezoneSettingsPanel')}
        <CharitySettingsPanel />
        {console.log('[Settings] After CharitySettingsPanel')}
        <DataSafetyPanel />
        {console.log('[Settings] After DataSafetyPanel')}
        {/* Account management has been moved to the Billing page */}
      </div>
    </div>
  )
}
