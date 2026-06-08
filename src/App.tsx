import { useEffect } from 'react'
import { BrowserRouter, useNavigate } from 'react-router-dom'
import { ErrorBoundary } from './components/error/ErrorBoundary'
import { AppRoutes } from './routes'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { CPGSettingsProvider } from './contexts/CPGSettingsContext'
import { SubscriptionProvider } from './contexts/SubscriptionContext'
import { smartAutoBackup } from './services/backup/SmartAutoBackupService'
import { useDataRecovery } from './hooks/useDataRecovery'
import { DataRecoveryModal } from './components/backup/DataRecoveryModal'
import { BackupStatusIndicator } from './components/backup/BackupStatusIndicator'

function AppContent() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  // Data recovery hook (only checks when user is authenticated)
  const recovery = useDataRecovery({ isAuthenticated })

  // Start auto-backup only when user is authenticated
  useEffect(() => {
    if (isAuthenticated) {
      // Start smart auto-backup with default settings
      smartAutoBackup.start({
        enabled: true,
        frequency: 'normal', // normal = every 10 changes or 5 minutes
      })
    }

    // Cleanup on unmount or when auth changes
    return () => {
      smartAutoBackup.stop()
    }
  }, [isAuthenticated])

  return (
    <>
      {/* Main app routes */}
      <AppRoutes />

      {/* Backup status indicator (shows subtle notification after backups) */}
      <BackupStatusIndicator />

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
            <CPGSettingsProvider>
              <AppContent />
            </CPGSettingsProvider>
          </SubscriptionProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
