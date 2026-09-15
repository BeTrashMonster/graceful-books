import { BrowserRouter } from 'react-router-dom'
import { ErrorBoundary } from './components/error/ErrorBoundary'
import { AppRoutes } from './routes'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { CPGSettingsProvider } from './contexts/CPGSettingsContext'
import { SubscriptionProvider } from './contexts/SubscriptionContext'
import { FrozenStateProvider } from './contexts/FrozenStateContext'
// NOTE: SmartAutoBackupService is NOT wired up. See SmartAutoBackupService.ts for details.
// Automatic/scheduled backups require a design for secure passphrase handling that doesn't exist yet.
import { useDataRecovery } from './hooks/useDataRecovery'
import { DataRecoveryModal } from './components/backup/DataRecoveryModal'
import { BackupStatusIndicator } from './components/backup/BackupStatusIndicator'
import { FrozenStateBanner, FrozenStateModal, ReactivationFlow } from './components/frozen'

function AppContent() {
  const { isAuthenticated } = useAuth()

  // Data recovery hook (only checks when user is authenticated)
  const recovery = useDataRecovery({ isAuthenticated })

  // NOTE: Automatic/scheduled backups are NOT active.
  // SmartAutoBackupService requires a way to cache the passphrase securely,
  // which is not implemented. Manual backup with passphrase is the only path.

  return (
    <>
      {/* Frozen state banner - shows at top when account is frozen */}
      <FrozenStateBanner />

      {/* Main app routes */}
      <AppRoutes />

      {/* Backup status indicator (shows subtle notification after backups) */}
      <BackupStatusIndicator />

      {/* Frozen state modal - shows when user attempts write while frozen */}
      <FrozenStateModal />

      {/* Reactivation flow - charity confirmation and payment */}
      <ReactivationFlow />

      {/* Data recovery modal (only shows if database is empty AND user is authenticated) */}
      {recovery.needsRecovery && (
        <DataRecoveryModal
          onRestore={async (fileHandle) => {
            await recovery.restoreFromBackup(fileHandle)
            // Navigate to dashboard with full page reload to ensure fresh data
            window.location.href = '/dashboard'
          }}
          onDismiss={recovery.dismissRecovery}
        />
      )}
    </>
  )
}

function App() {
  return (
    <ErrorBoundary level="root">
      <BrowserRouter>
        <AuthProvider>
          <SubscriptionProvider>
            <FrozenStateProvider>
              <CPGSettingsProvider>
                <AppContent />
              </CPGSettingsProvider>
            </FrozenStateProvider>
          </SubscriptionProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
