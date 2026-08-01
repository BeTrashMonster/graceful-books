import { useEffect } from 'react'
import { DataSafetyPanel } from '../components/settings/DataSafetyPanel'
import { CharitySettingsPanel } from '../components/settings/CharitySettingsPanel'
import { TimezoneSettingsPanel } from '../components/settings/TimezoneSettingsPanel'

export default function Settings() {
  // Handle scroll to section (e.g., from frozen state modal "Export Data" button)
  useEffect(() => {
    const scrollTarget = sessionStorage.getItem('scrollToSection');
    if (scrollTarget) {
      sessionStorage.removeItem('scrollToSection');
      // Wait for page to render, then scroll
      setTimeout(() => {
        const element = document.getElementById(scrollTarget);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }, []);

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-description">Manage your account and application preferences.</p>
      </div>

      <div className="page-content">
        <TimezoneSettingsPanel />
        <CharitySettingsPanel />
        <DataSafetyPanel />
      </div>
    </div>
  )
}
