import { useNavigate } from 'react-router-dom'
import { BackupLocationSetup } from '../../components/onboarding/BackupLocationSetup'

export default function Setup() {
  const navigate = useNavigate()

  const handleBackupComplete = (directoryPath: string) => {
    console.log('Backup location selected:', directoryPath)
    // Navigate to CPU Tracker after setup completes
    navigate('/cpg/cpu-tracker')
  }

  const handleBackupSkip = () => {
    console.log('Backup location setup skipped')
    // Allow skip, navigate to CPU Tracker anyway
    navigate('/cpg/cpu-tracker')
  }

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
        <BackupLocationSetup
          onComplete={handleBackupComplete}
          onSkip={handleBackupSkip}
        />
      </div>
    </div>
  )
}
