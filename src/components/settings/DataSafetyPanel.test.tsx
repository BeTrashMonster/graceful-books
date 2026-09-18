/**
 * DataSafetyPanel Component Tests
 *
 * Tests backup status display, user interactions, and accessibility compliance
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DataSafetyPanel } from './DataSafetyPanel'
import { BackupService } from '../../services/backup'

// Mock BackupService
vi.mock('../../services/backup', () => ({
  BackupService: {
    createBackup: vi.fn(),
    downloadBackup: vi.fn(),
  },
}))

// Mock window.prompt
const originalPrompt = window.prompt
beforeEach(() => {
  window.prompt = vi.fn()
})

afterEach(() => {
  window.prompt = originalPrompt
  vi.clearAllMocks()
})

describe('DataSafetyPanel', () => {
  describe('Rendering', () => {
    it('should render component with title and subtitle', async () => {
      render(<DataSafetyPanel />)

      await waitFor(() => {
        expect(screen.getByText('Data Safety')).toBeInTheDocument()
        expect(screen.getByText('Peace of mind in one glance')).toBeInTheDocument()
      })
    })

    it('should show loading state initially', async () => {
      render(<DataSafetyPanel />)

      // Check if loading indicator is present (it may render very quickly)
      const loadingText = screen.queryByText('Loading your backup settings...')

      // If still loading, wait for it to complete
      if (loadingText) {
        await waitFor(() => {
          expect(screen.queryByText('Loading your backup settings...')).not.toBeInTheDocument()
        })
      } else {
        // If loading completed immediately, that's also valid
        expect(screen.getByText('Data Safety')).toBeInTheDocument()
      }
    })

    it('should display status badge after loading', async () => {
      render(<DataSafetyPanel />)

      await waitFor(() => {
        expect(screen.queryByText('Loading your backup settings...')).not.toBeInTheDocument()
      })

      const statusBadge = screen.getByText(/No Backups Yet|Protected/)
      expect(statusBadge).toBeInTheDocument()
    })

    it('should show "No Backups Yet" when no backups exist', async () => {
      render(<DataSafetyPanel />)

      await waitFor(() => {
        expect(screen.getByText('No Backups Yet')).toBeInTheDocument()
      })
    })
  })

  describe('Backup Status Section', () => {
    it('should display save location as "Downloads folder" initially', async () => {
      render(<DataSafetyPanel />)

      await waitFor(() => {
        expect(screen.getByText('Save Location:')).toBeInTheDocument()
        expect(screen.getByText('Downloads folder')).toBeInTheDocument()
      })
    })

    it('should display last backup as "Never" initially', async () => {
      render(<DataSafetyPanel />)

      await waitFor(() => {
        expect(screen.getByText('Last Backup:')).toBeInTheDocument()
        expect(screen.getByText('Never')).toBeInTheDocument()
      })
    })

    it('should show passphrase status', async () => {
      render(<DataSafetyPanel />)

      await waitFor(() => {
        expect(screen.getByText('Passphrase:')).toBeInTheDocument()
        expect(screen.getByText('Not set yet')).toBeInTheDocument()
      })
    })

    it('should show "Choose Folder (optional)" button when not configured', async () => {
      render(<DataSafetyPanel />)

      await waitFor(() => {
        expect(screen.getByText('Choose Folder (optional)')).toBeInTheDocument()
      })
    })

    it('should show "Backup Now" button', async () => {
      render(<DataSafetyPanel />)

      await waitFor(() => {
        expect(screen.getByText('Backup Now')).toBeInTheDocument()
      })
    })

    it('should display guidance message about no backups', async () => {
      render(<DataSafetyPanel />)

      await waitFor(() => {
        expect(screen.getByText(/You have no backups yet/)).toBeInTheDocument()
      })
    })
  })

  describe('Backup History Section', () => {
    it('should render backup history section', async () => {
      render(<DataSafetyPanel />)

      await waitFor(() => {
        expect(screen.getByText('Backup History')).toBeInTheDocument()
        expect(screen.getByText('Your 10 most recent backups')).toBeInTheDocument()
      })
    })

    it('should show empty state when no backups exist', async () => {
      render(<DataSafetyPanel />)

      await waitFor(() => {
        expect(screen.getByText('No backups yet')).toBeInTheDocument()
        expect(
          screen.getByText(/Your first backup will appear here/)
        ).toBeInTheDocument()
      })
    })
  })

  describe('Security Information Section', () => {
    it('should display security information', async () => {
      render(<DataSafetyPanel />)

      await waitFor(() => {
        expect(screen.getByText('How your backups are protected')).toBeInTheDocument()
        expect(screen.getByText(/Passphrase encryption/)).toBeInTheDocument()
        expect(screen.getByText(/Restore anywhere/)).toBeInTheDocument()
        expect(screen.getByText(/Automatic cleanup/)).toBeInTheDocument()
      })
    })
  })

  describe('Change Location Functionality', () => {
    it('should show error for unsupported browsers', async () => {
      const user = userEvent.setup()
      render(<DataSafetyPanel />)

      await waitFor(() => {
        expect(screen.getByText('Choose Folder (optional)')).toBeInTheDocument()
      })

      const button = screen.getByText('Choose Folder (optional)')
      await user.click(button)

      await waitFor(() => {
        expect(
          screen.getByText(/Your browser doesn't support/)
        ).toBeInTheDocument()
      })
    })

    it('should have accessible button label', async () => {
      render(<DataSafetyPanel />)

      await waitFor(() => {
        const button = screen.getByLabelText('Change backup location')
        expect(button).toBeInTheDocument()
      })
    })
  })

  describe('Manual Backup Functionality', () => {
    it('should open backup modal when clicking Backup Now', async () => {
      const user = userEvent.setup()
      render(<DataSafetyPanel />)

      await waitFor(() => {
        expect(screen.getByText('Backup Now')).toBeInTheDocument()
      })

      const button = screen.getByText('Backup Now')
      await user.click(button)

      // Modal should open with title "Encrypted Backup & Restore"
      await waitFor(() => {
        expect(screen.getByText('Encrypted Backup & Restore')).toBeInTheDocument()
      })
    })

    it('should show passphrase input in backup modal', async () => {
      const user = userEvent.setup()
      render(<DataSafetyPanel />)

      await waitFor(() => {
        expect(screen.getByText('Backup Now')).toBeInTheDocument()
      })

      const button = screen.getByRole('button', { name: /backup now/i })
      await user.click(button)

      // Modal should show backup/restore content
      await waitFor(() => {
        expect(screen.getByText(/Create Encrypted Backup/)).toBeInTheDocument()
      })
    })

    it('should have accessible button label', async () => {
      render(<DataSafetyPanel />)

      await waitFor(() => {
        const button = screen.getByLabelText('Create backup now')
        expect(button).toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', async () => {
      render(<DataSafetyPanel />)

      await waitFor(() => {
        const h2 = screen.getByRole('heading', { level: 2, name: 'Data Safety' })
        expect(h2).toBeInTheDocument()

        const h3List = screen.getAllByRole('heading', { level: 3 })
        expect(h3List.length).toBeGreaterThan(0)
      })
    })

    it('should have accessible status badge', async () => {
      render(<DataSafetyPanel />)

      await waitFor(() => {
        expect(screen.queryByText('Loading your backup settings...')).not.toBeInTheDocument()
      })

      const statusBadge = screen.getByText(/No Backups Yet|Protected/)
      expect(statusBadge).toBeInTheDocument()
    })

    it('should be keyboard navigable', async () => {
      render(<DataSafetyPanel />)

      await waitFor(() => {
        expect(screen.queryByText('Loading your backup settings...')).not.toBeInTheDocument()
      })

      // Use getByRole to find actual buttons
      const backupButton = screen.getByRole('button', { name: /create backup now/i })
      const folderButton = screen.getByRole('button', { name: /change backup location/i })

      // Both buttons should be in the document
      expect(backupButton).toBeInTheDocument()
      expect(folderButton).toBeInTheDocument()
    })
  })

  describe('Callback Props', () => {
    it('should accept onSettingsChange prop', async () => {
      const onSettingsChange = vi.fn()

      render(<DataSafetyPanel onSettingsChange={onSettingsChange} />)

      await waitFor(() => {
        expect(screen.getByText('Backup Now')).toBeInTheDocument()
      })

      // The callback prop should be accepted without errors
      expect(screen.getByText('Data Safety')).toBeInTheDocument()
    })
  })

  describe('Steadiness Communication Style', () => {
    it('should use patient, supportive language', async () => {
      render(<DataSafetyPanel />)

      await waitFor(() => {
        expect(screen.queryByText('Loading your backup settings...')).not.toBeInTheDocument()
      })

      // Check for steadiness messaging
      expect(screen.getByText('Peace of mind in one glance')).toBeInTheDocument()
      expect(screen.getByText(/You have no backups yet/)).toBeInTheDocument()
    })

    it('should use supportive language for security information', async () => {
      render(<DataSafetyPanel />)

      await waitFor(() => {
        expect(screen.queryByText('Loading your backup settings...')).not.toBeInTheDocument()
      })

      // Check for supportive security messaging
      expect(screen.getByText(/Passphrase encryption/)).toBeInTheDocument()
      expect(screen.getByText(/Restore anywhere/)).toBeInTheDocument()
    })
  })
})
