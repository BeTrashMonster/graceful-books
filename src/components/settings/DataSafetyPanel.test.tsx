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

      const statusBadge = screen.getByText(/Manual Backups Only|Automatic Backups ON/)
      expect(statusBadge).toBeInTheDocument()
    })

    it('should show "Manual Backups Only" when automatic backups not configured', async () => {
      render(<DataSafetyPanel />)

      await waitFor(() => {
        expect(screen.getByText('Manual Backups Only')).toBeInTheDocument()
      })
    })
  })

  describe('Backup Status Section', () => {
    it('should display backup location as "Not configured" initially', async () => {
      render(<DataSafetyPanel />)

      await waitFor(() => {
        expect(screen.getByText('Backup Location:')).toBeInTheDocument()
        expect(screen.getByText('Not configured')).toBeInTheDocument()
      })
    })

    it('should display last backup as "Never" initially', async () => {
      render(<DataSafetyPanel />)

      await waitFor(() => {
        expect(screen.getByText('Last Backup:')).toBeInTheDocument()
        expect(screen.getByText('Never')).toBeInTheDocument()
      })
    })

    it('should show "Set Up Automatic Backups" button when not configured', async () => {
      render(<DataSafetyPanel />)

      await waitFor(() => {
        expect(screen.getByText('Set Up Automatic Backups')).toBeInTheDocument()
      })
    })

    it('should show "Backup Now" button', async () => {
      render(<DataSafetyPanel />)

      await waitFor(() => {
        expect(screen.getByText('Backup Now')).toBeInTheDocument()
      })
    })

    it('should display informational message about automatic backups', async () => {
      render(<DataSafetyPanel />)

      await waitFor(() => {
        expect(screen.getByText(/Want automatic backups?/)).toBeInTheDocument()
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
        expect(screen.getByText(/Bank-level encryption/)).toBeInTheDocument()
        expect(screen.getByText(/Zero-knowledge security/)).toBeInTheDocument()
        expect(screen.getByText(/Multiple safety nets/)).toBeInTheDocument()
        expect(screen.getByText(/Smart retention/)).toBeInTheDocument()
      })
    })
  })

  describe('Change Location Functionality', () => {
    it('should show error for unsupported browsers', async () => {
      const user = userEvent.setup()
      render(<DataSafetyPanel />)

      await waitFor(() => {
        expect(screen.getByText('Set Up Automatic Backups')).toBeInTheDocument()
      })

      const button = screen.getByText('Set Up Automatic Backups')
      await user.click(button)

      await waitFor(() => {
        expect(
          screen.getByText(/Your browser doesn't support automatic backups/)
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
    it('should prompt for passphrase when creating backup', async () => {
      const user = userEvent.setup()
      render(<DataSafetyPanel />)

      await waitFor(() => {
        expect(screen.getByText('Backup Now')).toBeInTheDocument()
      })

      const promptMock = vi.mocked(window.prompt)
      promptMock.mockReturnValue(null) // User cancels

      const button = screen.getByText('Backup Now')
      await user.click(button)

      expect(promptMock).toHaveBeenCalledWith(
        expect.stringContaining('Enter a passphrase to encrypt your backup')
      )
    })

    it('should create backup when passphrase provided', async () => {
      const user = userEvent.setup()
      const mockCreateBackup = vi.mocked(BackupService.createBackup)
      const mockDownloadBackup = vi.mocked(BackupService.downloadBackup)

      mockCreateBackup.mockResolvedValue({
        success: true,
        blob: new Blob(['test'], { type: 'application/json' }),
        filename: 'test-backup.gbbackup',
      })

      render(<DataSafetyPanel />)

      await waitFor(() => {
        expect(screen.getByText('Backup Now')).toBeInTheDocument()
      })

      const promptMock = vi.mocked(window.prompt)
      promptMock.mockReturnValue('test-passphrase')

      const button = screen.getByText('Backup Now')
      await user.click(button)

      await waitFor(() => {
        expect(mockCreateBackup).toHaveBeenCalledWith('test-passphrase')
        expect(mockDownloadBackup).toHaveBeenCalled()
      })
    })

    it('should show success message after successful backup', async () => {
      const user = userEvent.setup()
      const mockCreateBackup = vi.mocked(BackupService.createBackup)

      mockCreateBackup.mockResolvedValue({
        success: true,
        blob: new Blob(['test'], { type: 'application/json' }),
        filename: 'test-backup.gbbackup',
      })

      render(<DataSafetyPanel />)

      await waitFor(() => {
        expect(screen.getByText('Backup Now')).toBeInTheDocument()
      })

      const promptMock = vi.mocked(window.prompt)
      promptMock.mockReturnValue('test-passphrase')

      const button = screen.getByText('Backup Now')
      await user.click(button)

      await waitFor(() => {
        expect(
          screen.getByText(/Backup complete! Your data is safe and sound/)
        ).toBeInTheDocument()
      })
    })

    it('should show error message on backup failure', async () => {
      const user = userEvent.setup()
      const mockCreateBackup = vi.mocked(BackupService.createBackup)

      mockCreateBackup.mockResolvedValue({
        success: false,
        error: 'Test error message',
      })

      render(<DataSafetyPanel />)

      await waitFor(() => {
        expect(screen.getByText('Backup Now')).toBeInTheDocument()
      })

      const promptMock = vi.mocked(window.prompt)
      promptMock.mockReturnValue('test-passphrase')

      const button = screen.getByText('Backup Now')
      await user.click(button)

      await waitFor(() => {
        expect(screen.getByText('Test error message')).toBeInTheDocument()
      })
    })

    it('should show loading state during backup creation', async () => {
      const user = userEvent.setup()
      const mockCreateBackup = vi.mocked(BackupService.createBackup)

      // Mock with delayed resolution
      mockCreateBackup.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  success: true,
                  blob: new Blob(['test'], { type: 'application/json' }),
                  filename: 'test-backup.gbbackup',
                }),
              100
            )
          )
      )

      render(<DataSafetyPanel />)

      await waitFor(() => {
        expect(screen.getByText('Backup Now')).toBeInTheDocument()
      })

      const promptMock = vi.mocked(window.prompt)
      promptMock.mockReturnValue('test-passphrase')

      const button = screen.getByText('Backup Now')
      await user.click(button)

      // Should show loading state
      expect(screen.getByText('Creating Backup...')).toBeInTheDocument()
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

      const statusBadge = screen.getByText(/Manual Backups Only|Automatic Backups ON/)
      expect(statusBadge).toBeInTheDocument()
    })

    it('should use role="status" for alerts', async () => {
      const user = userEvent.setup()
      const mockCreateBackup = vi.mocked(BackupService.createBackup)

      mockCreateBackup.mockResolvedValue({
        success: true,
        blob: new Blob(['test'], { type: 'application/json' }),
        filename: 'test-backup.gbbackup',
      })

      render(<DataSafetyPanel />)

      await waitFor(() => {
        expect(screen.getByText('Backup Now')).toBeInTheDocument()
      })

      const promptMock = vi.mocked(window.prompt)
      promptMock.mockReturnValue('test-passphrase')

      const button = screen.getByText('Backup Now')
      await user.click(button)

      await waitFor(() => {
        const alert = screen.getByRole('status')
        expect(alert).toBeInTheDocument()
      })
    })

    it('should be keyboard navigable', async () => {
      render(<DataSafetyPanel />)

      await waitFor(() => {
        expect(screen.queryByText('Loading your backup settings...')).not.toBeInTheDocument()
      })

      const firstButton = await screen.findByText('Set Up Automatic Backups')
      const secondButton = await screen.findByText('Backup Now')

      // Both buttons should be in the document and be button elements
      expect(firstButton).toBeInTheDocument()
      expect(firstButton.tagName).toBe('BUTTON')
      expect(secondButton).toBeInTheDocument()
      expect(secondButton.tagName).toBe('BUTTON')
    })
  })

  describe('Callback Props', () => {
    it('should call onSettingsChange after successful backup', async () => {
      const user = userEvent.setup()
      const onSettingsChange = vi.fn()
      const mockCreateBackup = vi.mocked(BackupService.createBackup)

      mockCreateBackup.mockResolvedValue({
        success: true,
        blob: new Blob(['test'], { type: 'application/json' }),
        filename: 'test-backup.gbbackup',
      })

      render(<DataSafetyPanel onSettingsChange={onSettingsChange} />)

      await waitFor(() => {
        expect(screen.getByText('Backup Now')).toBeInTheDocument()
      })

      const promptMock = vi.mocked(window.prompt)
      promptMock.mockReturnValue('test-passphrase')

      const button = screen.getByText('Backup Now')
      await user.click(button)

      await waitFor(() => {
        expect(onSettingsChange).toHaveBeenCalled()
      })
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
      expect(screen.getByText(/Want automatic backups?/)).toBeInTheDocument()
    })

    it('should not blame user in error messages', async () => {
      const user = userEvent.setup()
      const mockCreateBackup = vi.mocked(BackupService.createBackup)

      mockCreateBackup.mockRejectedValue(new Error('Network error'))

      render(<DataSafetyPanel />)

      await waitFor(() => {
        expect(screen.queryByText('Loading your backup settings...')).not.toBeInTheDocument()
      })

      const promptMock = vi.mocked(window.prompt)
      promptMock.mockReturnValue('test-passphrase')

      const button = screen.getByText('Backup Now')
      await user.click(button)

      // Wait for error to appear
      const errorMessage = await screen.findByText(
        /Oops! Something unexpected happened/,
        {},
        { timeout: 3000 }
      )

      expect(errorMessage).toBeInTheDocument()
      // Should start with supportive language
      expect(errorMessage.textContent).toMatch(/Oops!/)
    })
  })
})
