/**
 * Sync Settings Panel Tests
 *
 * Comprehensive tests for sync configuration UI component.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SyncSettingsPanel, type SyncSettingsPanelProps } from './SyncSettingsPanel'
import {
  DEFAULT_SYNC_CONFIG,
  SyncConnectionStatus,
  type SyncStatistics,
} from '../../config/syncConfig'

// Helper to create default props
function createDefaultProps(overrides?: Partial<SyncSettingsPanelProps>): SyncSettingsPanelProps {
  return {
    userId: 'user-123',
    initialConfig: {},
    statistics: undefined,
    onSave: vi.fn(),
    onClearQueue: vi.fn(),
    ...overrides,
  }
}

// Helper to create test statistics
function createTestStatistics(
  overrides?: Partial<SyncStatistics>
): SyncStatistics {
  return {
    status: SyncConnectionStatus.CONNECTED,
    messagesSent: 0,
    messagesReceived: 0,
    pendingMessages: 0,
    lastSyncAt: undefined,
    ...overrides,
  }
}

describe('SyncSettingsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('rendering', () => {
    it('should render panel with title and subtitle', () => {
      render(<SyncSettingsPanel {...createDefaultProps()} />)

      expect(screen.getByText('Real-Time Sync')).toBeInTheDocument()
      expect(
        screen.getByText(/Keep your data in sync across all your devices/i)
      ).toBeInTheDocument()
      expect(
        screen.getByText(/All data is encrypted before syncing/i)
      ).toBeInTheDocument()
    })

    it('should render enable toggle', () => {
      render(<SyncSettingsPanel {...createDefaultProps()} />)

      expect(screen.getByText('Enable Real-Time Sync')).toBeInTheDocument()
      expect(
        screen.getByText(/Automatically sync changes across your devices/i)
      ).toBeInTheDocument()
      expect(screen.getByRole('checkbox', { name: /enable sync/i })).toBeInTheDocument()
    })

    it('should not render relay options when sync is disabled', () => {
      render(<SyncSettingsPanel {...createDefaultProps()} />)

      expect(screen.queryByText('Sync Relay')).not.toBeInTheDocument()
      expect(screen.queryByText('Audacious-Hosted (Recommended)')).not.toBeInTheDocument()
    })

    it('should render relay options when sync is enabled', () => {
      render(
        <SyncSettingsPanel
          {...createDefaultProps({ initialConfig: { enabled: true } })}
        />
      )

      expect(screen.getByText('Sync Relay')).toBeInTheDocument()
      expect(screen.getByText('Audacious-Hosted (Recommended)')).toBeInTheDocument()
      expect(screen.getByText('Self-Hosted')).toBeInTheDocument()
    })

    it('should render sync status section when enabled', () => {
      render(
        <SyncSettingsPanel
          {...createDefaultProps({ initialConfig: { enabled: true } })}
        />
      )

      expect(screen.getByText('Sync Status')).toBeInTheDocument()
      expect(screen.getByText('Connection:')).toBeInTheDocument()
    })

    it('should render statistics when provided', () => {
      const statistics = createTestStatistics({
        messagesSent: 10,
        messagesReceived: 8,
        pendingMessages: 2,
      })

      render(
        <SyncSettingsPanel
          {...createDefaultProps({
            initialConfig: { enabled: true },
            statistics,
          })}
        />
      )

      expect(screen.getByText('10')).toBeInTheDocument()
      expect(screen.getByText('Messages Sent')).toBeInTheDocument()
      expect(screen.getByText('8')).toBeInTheDocument()
      expect(screen.getByText('Messages Received')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument()
      expect(screen.getByText('Pending')).toBeInTheDocument()
    })

    it('should render last sync time when available', () => {
      const lastSyncAt = new Date('2025-01-15T10:30:00Z').getTime()
      const statistics = createTestStatistics({ lastSyncAt })

      render(
        <SyncSettingsPanel
          {...createDefaultProps({
            initialConfig: { enabled: true },
            statistics,
          })}
        />
      )

      expect(screen.getByText(/Last synced:/i)).toBeInTheDocument()
    })

    it('should render advanced settings toggle', () => {
      render(
        <SyncSettingsPanel
          {...createDefaultProps({ initialConfig: { enabled: true } })}
        />
      )

      expect(screen.getByText('▶ Advanced Settings')).toBeInTheDocument()
    })
  })

  describe('initialization', () => {
    it('should initialize with sync disabled by default', () => {
      render(<SyncSettingsPanel {...createDefaultProps()} />)

      const checkbox = screen.getByRole('checkbox', { name: /enable sync/i })
      expect(checkbox).not.toBeChecked()
    })

    it('should initialize with provided enabled state', () => {
      render(
        <SyncSettingsPanel
          {...createDefaultProps({ initialConfig: { enabled: true } })}
        />
      )

      const checkbox = screen.getByRole('checkbox', { name: /enable sync/i })
      expect(checkbox).toBeChecked()
    })

    it('should initialize with Audacious-hosted selected by default', () => {
      render(
        <SyncSettingsPanel
          {...createDefaultProps({ initialConfig: { enabled: true } })}
        />
      )

      const radios = screen.getAllByRole('radio')
      expect(radios[0]).toBeChecked() // Audacious-hosted
      expect(radios[1]).not.toBeChecked() // Self-hosted
    })

    it('should initialize with self-hosted when configured', () => {
      render(
        <SyncSettingsPanel
          {...createDefaultProps({
            initialConfig: { enabled: true, selfHosted: true },
          })}
        />
      )

      const radios = screen.getAllByRole('radio')
      expect(radios[0]).not.toBeChecked() // Audacious-hosted
      expect(radios[1]).toBeChecked() // Self-hosted
    })

    it('should initialize with default relay URL', () => {
      render(
        <SyncSettingsPanel
          {...createDefaultProps({ initialConfig: { enabled: true } })}
        />
      )

      // Audacious URL not visible (it's the default, not shown in input)
      expect(screen.queryByDisplayValue(DEFAULT_SYNC_CONFIG.relayUrl)).not.toBeInTheDocument()
    })

    it('should initialize with custom relay URL for self-hosted', () => {
      const customUrl = 'wss://my-relay.example.com'
      render(
        <SyncSettingsPanel
          {...createDefaultProps({
            initialConfig: { enabled: true, selfHosted: true, relayUrl: customUrl },
          })}
        />
      )

      expect(screen.getByDisplayValue(customUrl)).toBeInTheDocument()
    })
  })

  describe('enable/disable toggle', () => {
    it('should toggle enabled state when clicked', () => {
      render(<SyncSettingsPanel {...createDefaultProps()} />)

      const checkbox = screen.getByRole('checkbox', { name: /enable sync/i })
      expect(checkbox).not.toBeChecked()

      fireEvent.click(checkbox)
      expect(checkbox).toBeChecked()

      fireEvent.click(checkbox)
      expect(checkbox).not.toBeChecked()
    })

    it('should show relay options when enabled', () => {
      render(<SyncSettingsPanel {...createDefaultProps()} />)

      const checkbox = screen.getByRole('checkbox', { name: /enable sync/i })
      fireEvent.click(checkbox)

      expect(screen.getByText('Sync Relay')).toBeInTheDocument()
      expect(screen.getByText('Audacious-Hosted (Recommended)')).toBeInTheDocument()
    })

    it('should hide relay options when disabled', () => {
      render(
        <SyncSettingsPanel
          {...createDefaultProps({ initialConfig: { enabled: true } })}
        />
      )

      expect(screen.getByText('Sync Relay')).toBeInTheDocument()

      const checkbox = screen.getByRole('checkbox', { name: /enable sync/i })
      fireEvent.click(checkbox)

      expect(screen.queryByText('Sync Relay')).not.toBeInTheDocument()
    })

    it('should mark form as changed when toggled', () => {
      render(<SyncSettingsPanel {...createDefaultProps()} />)

      expect(screen.queryByText('Save Changes')).not.toBeInTheDocument()

      const checkbox = screen.getByRole('checkbox', { name: /enable sync/i })
      fireEvent.click(checkbox)

      expect(screen.getByText('Save Changes')).toBeInTheDocument()
    })

    it('should clear success message when toggled', async () => {
      const onSave = vi.fn()
      render(<SyncSettingsPanel {...createDefaultProps({ onSave })} />)

      // Enable sync
      const checkbox = screen.getByRole('checkbox', { name: /enable sync/i })
      fireEvent.click(checkbox)

      // Save
      const saveButton = screen.getByText('Save Changes')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText(/settings saved successfully/i)).toBeInTheDocument()
      })

      // Toggle again
      fireEvent.click(checkbox)

      await waitFor(() => {
        expect(screen.queryByText(/settings saved successfully/i)).not.toBeInTheDocument()
      })
    })
  })

  describe('relay type selection', () => {
    it('should select Audacious-hosted when clicked', () => {
      render(
        <SyncSettingsPanel
          {...createDefaultProps({
            initialConfig: { enabled: true, selfHosted: true },
          })}
        />
      )

      const radios = screen.getAllByRole('radio')
      expect(radios[1]).toBeChecked()

      fireEvent.click(radios[0])
      expect(radios[0]).toBeChecked()
      expect(radios[1]).not.toBeChecked()
    })

    it('should select self-hosted when clicked', () => {
      render(
        <SyncSettingsPanel
          {...createDefaultProps({ initialConfig: { enabled: true } })}
        />
      )

      const radios = screen.getAllByRole('radio')
      expect(radios[0]).toBeChecked()

      fireEvent.click(radios[1])
      expect(radios[0]).not.toBeChecked()
      expect(radios[1]).toBeChecked()
    })

    it('should reset URL to default when switching to Audacious-hosted', () => {
      render(
        <SyncSettingsPanel
          {...createDefaultProps({
            initialConfig: {
              enabled: true,
              selfHosted: true,
              relayUrl: 'wss://custom.example.com',
            },
          })}
        />
      )

      expect(screen.getByDisplayValue('wss://custom.example.com')).toBeInTheDocument()

      const radios = screen.getAllByRole('radio')
      fireEvent.click(radios[0])

      expect(screen.queryByDisplayValue('wss://custom.example.com')).not.toBeInTheDocument()
    })

    it('should clear URL when switching to self-hosted', () => {
      render(
        <SyncSettingsPanel
          {...createDefaultProps({ initialConfig: { enabled: true } })}
        />
      )

      const radios = screen.getAllByRole('radio')
      fireEvent.click(radios[1])

      const input = screen.getByPlaceholderText('wss://your-relay.example.com')
      expect(input).toHaveValue('')
    })

    it('should show relay URL input when self-hosted selected', () => {
      render(
        <SyncSettingsPanel
          {...createDefaultProps({ initialConfig: { enabled: true } })}
        />
      )

      expect(screen.queryByLabelText('Relay URL')).not.toBeInTheDocument()

      const radios = screen.getAllByRole('radio')
      fireEvent.click(radios[1])

      expect(screen.getByLabelText('Relay URL')).toBeInTheDocument()
    })

    it('should mark form as changed when relay type changes', () => {
      render(
        <SyncSettingsPanel
          {...createDefaultProps({ initialConfig: { enabled: true } })}
        />
      )

      expect(screen.queryByText('Save Changes')).not.toBeInTheDocument()

      const radios = screen.getAllByRole('radio')
      fireEvent.click(radios[1])

      expect(screen.getByText('Save Changes')).toBeInTheDocument()
    })
  })

  describe('relay URL input', () => {
    it('should update URL when typed', () => {
      render(
        <SyncSettingsPanel
          {...createDefaultProps({
            initialConfig: { enabled: true, selfHosted: true },
          })}
        />
      )

      const input = screen.getByLabelText('Relay URL')
      fireEvent.change(input, { target: { value: 'wss://my-relay.com' } })

      expect(input).toHaveValue('wss://my-relay.com')
    })

    it('should trim whitespace from URL', () => {
      render(
        <SyncSettingsPanel
          {...createDefaultProps({
            initialConfig: { enabled: true, selfHosted: true },
          })}
        />
      )

      const input = screen.getByLabelText('Relay URL')
      fireEvent.change(input, { target: { value: '  wss://my-relay.com  ' } })

      expect(input).toHaveValue('wss://my-relay.com')
    })

    it('should mark form as changed when URL changes', () => {
      render(
        <SyncSettingsPanel
          {...createDefaultProps({
            initialConfig: { enabled: true, selfHosted: true },
          })}
        />
      )

      expect(screen.queryByText('Save Changes')).not.toBeInTheDocument()

      const input = screen.getByLabelText('Relay URL')
      fireEvent.change(input, { target: { value: 'wss://my-relay.com' } })

      expect(screen.getByText('Save Changes')).toBeInTheDocument()
    })

    it('should show help text about wss:// requirement', () => {
      render(
        <SyncSettingsPanel
          {...createDefaultProps({
            initialConfig: { enabled: true, selfHosted: true },
          })}
        />
      )

      expect(screen.getByText(/Must start with wss:\/\//i)).toBeInTheDocument()
    })
  })

  describe('status display', () => {
    it('should show Not connected when no statistics', () => {
      render(
        <SyncSettingsPanel
          {...createDefaultProps({ initialConfig: { enabled: true } })}
        />
      )

      expect(screen.getByText('Not connected')).toBeInTheDocument()
    })

    it('should show Connected status', () => {
      const statistics = createTestStatistics({
        status: SyncConnectionStatus.CONNECTED,
      })

      render(
        <SyncSettingsPanel
          {...createDefaultProps({
            initialConfig: { enabled: true },
            statistics,
          })}
        />
      )

      expect(screen.getByText('Connected')).toBeInTheDocument()
    })

    it('should show Connecting status', () => {
      const statistics = createTestStatistics({
        status: SyncConnectionStatus.CONNECTING,
      })

      render(
        <SyncSettingsPanel
          {...createDefaultProps({
            initialConfig: { enabled: true },
            statistics,
          })}
        />
      )

      expect(screen.getByText('Connecting...')).toBeInTheDocument()
    })

    it('should show Reconnecting status', () => {
      const statistics = createTestStatistics({
        status: SyncConnectionStatus.RECONNECTING,
      })

      render(
        <SyncSettingsPanel
          {...createDefaultProps({
            initialConfig: { enabled: true },
            statistics,
          })}
        />
      )

      expect(screen.getByText('Reconnecting...')).toBeInTheDocument()
    })

    it('should show Connection error status', () => {
      const statistics = createTestStatistics({
        status: SyncConnectionStatus.ERROR,
      })

      render(
        <SyncSettingsPanel
          {...createDefaultProps({
            initialConfig: { enabled: true },
            statistics,
          })}
        />
      )

      expect(screen.getByText('Connection error')).toBeInTheDocument()
    })

    it('should show Disconnected status', () => {
      const statistics = createTestStatistics({
        status: SyncConnectionStatus.DISCONNECTED,
      })

      render(
        <SyncSettingsPanel
          {...createDefaultProps({
            initialConfig: { enabled: true },
            statistics,
          })}
        />
      )

      expect(screen.getByText('Disconnected')).toBeInTheDocument()
    })
  })

  describe('advanced settings', () => {
    it('should not show advanced options by default', () => {
      render(
        <SyncSettingsPanel
          {...createDefaultProps({ initialConfig: { enabled: true } })}
        />
      )

      expect(screen.queryByText('Clear Pending Queue')).not.toBeInTheDocument()
    })

    it('should toggle advanced settings when clicked', () => {
      render(
        <SyncSettingsPanel
          {...createDefaultProps({ initialConfig: { enabled: true } })}
        />
      )

      const toggle = screen.getByText('▶ Advanced Settings')
      fireEvent.click(toggle)

      expect(screen.getByText('▼ Advanced Settings')).toBeInTheDocument()
      expect(screen.getByText('Clear Pending Queue')).toBeInTheDocument()
    })

    it('should show warning about permanent actions', () => {
      render(
        <SyncSettingsPanel
          {...createDefaultProps({ initialConfig: { enabled: true } })}
        />
      )

      const toggle = screen.getByText('▶ Advanced Settings')
      fireEvent.click(toggle)

      expect(
        screen.getByText(/These actions are permanent and cannot be undone/i)
      ).toBeInTheDocument()
    })

    it('should disable clear queue button when no pending messages', () => {
      const statistics = createTestStatistics({ pendingMessages: 0 })

      render(
        <SyncSettingsPanel
          {...createDefaultProps({
            initialConfig: { enabled: true },
            statistics,
          })}
        />
      )

      const toggle = screen.getByText('▶ Advanced Settings')
      fireEvent.click(toggle)

      const clearButton = screen.getByText('Clear Pending Queue')
      expect(clearButton).toBeDisabled()
    })

    it('should enable clear queue button when pending messages exist', () => {
      const statistics = createTestStatistics({ pendingMessages: 5 })

      render(
        <SyncSettingsPanel
          {...createDefaultProps({
            initialConfig: { enabled: true },
            statistics,
          })}
        />
      )

      const toggle = screen.getByText('▶ Advanced Settings')
      fireEvent.click(toggle)

      const clearButton = screen.getByText('Clear Pending Queue')
      expect(clearButton).not.toBeDisabled()
    })

    it('should call onClearQueue when button clicked', () => {
      const onClearQueue = vi.fn()
      const statistics = createTestStatistics({ pendingMessages: 5 })

      render(
        <SyncSettingsPanel
          {...createDefaultProps({
            initialConfig: { enabled: true },
            statistics,
            onClearQueue,
          })}
        />
      )

      const toggle = screen.getByText('▶ Advanced Settings')
      fireEvent.click(toggle)

      const clearButton = screen.getByText('Clear Pending Queue')
      fireEvent.click(clearButton)

      expect(onClearQueue).toHaveBeenCalledTimes(1)
    })
  })

  describe('validation', () => {
    it('should validate relay URL format', async () => {
      render(
        <SyncSettingsPanel
          {...createDefaultProps({
            initialConfig: { enabled: true, selfHosted: false },
          })}
        />
      )

      // Switch to self-hosted and enter invalid URL
      const radios = screen.getAllByRole('radio')
      fireEvent.click(radios[1])

      const input = screen.getByLabelText('Relay URL')
      fireEvent.change(input, { target: { value: 'http://insecure.com' } })

      const saveButton = screen.getByText('Save Changes')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument()
        expect(screen.getByText(/must start with wss:\/\//i)).toBeInTheDocument()
      })
    })

    it('should validate relay URL is provided for self-hosted', async () => {
      render(
        <SyncSettingsPanel
          {...createDefaultProps({
            initialConfig: { enabled: true, selfHosted: false },
          })}
        />
      )

      // Switch to self-hosted without entering URL
      const radios = screen.getAllByRole('radio')
      fireEvent.click(radios[1])

      const saveButton = screen.getByText('Save Changes')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument()
        expect(screen.getByText(/relay URL is required/i)).toBeInTheDocument()
      })
    })

    it('should clear validation errors when input is fixed', async () => {
      render(
        <SyncSettingsPanel
          {...createDefaultProps({
            initialConfig: { enabled: true, selfHosted: false },
          })}
        />
      )

      // Switch to self-hosted
      const radios = screen.getAllByRole('radio')
      fireEvent.click(radios[1])

      // Try to save without URL
      let saveButton = screen.getByText('Save Changes')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument()
      })

      // Fix the input
      const input = screen.getByLabelText('Relay URL')
      fireEvent.change(input, { target: { value: 'wss://valid.com' } })

      // Save again
      saveButton = screen.getByText('Save Changes')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      })
    })
  })

  describe('save functionality', () => {
    it('should not show save button when no changes', () => {
      render(<SyncSettingsPanel {...createDefaultProps()} />)

      expect(screen.queryByText('Save Changes')).not.toBeInTheDocument()
    })

    it('should show save button when changes are made', () => {
      render(<SyncSettingsPanel {...createDefaultProps()} />)

      const checkbox = screen.getByRole('checkbox', { name: /enable sync/i })
      fireEvent.click(checkbox)

      expect(screen.getByText('Save Changes')).toBeInTheDocument()
    })

    it('should call onSave with config when saved', async () => {
      const onSave = vi.fn()
      render(<SyncSettingsPanel {...createDefaultProps({ onSave })} />)

      const checkbox = screen.getByRole('checkbox', { name: /enable sync/i })
      fireEvent.click(checkbox)

      const saveButton = screen.getByText('Save Changes')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledTimes(1)
        expect(onSave).toHaveBeenCalledWith({
          enabled: true,
          selfHosted: false,
          relayUrl: DEFAULT_SYNC_CONFIG.relayUrl,
        })
      })
    })

    it('should show saving state during save', async () => {
      render(<SyncSettingsPanel {...createDefaultProps()} />)

      const checkbox = screen.getByRole('checkbox', { name: /enable sync/i })
      fireEvent.click(checkbox)

      const saveButton = screen.getByText('Save Changes')
      fireEvent.click(saveButton)

      expect(screen.getByText('Saving...')).toBeInTheDocument()

      await waitFor(() => {
        expect(screen.queryByText('Saving...')).not.toBeInTheDocument()
      })
    })

    it('should disable save button during save', async () => {
      render(<SyncSettingsPanel {...createDefaultProps()} />)

      const checkbox = screen.getByRole('checkbox', { name: /enable sync/i })
      fireEvent.click(checkbox)

      const saveButton = screen.getByText('Save Changes')
      fireEvent.click(saveButton)

      expect(saveButton).toBeDisabled()

      await waitFor(() => {
        expect(screen.queryByText('Save Changes')).not.toBeInTheDocument()
      })
    })

    it('should show success message after save', async () => {
      render(<SyncSettingsPanel {...createDefaultProps()} />)

      const checkbox = screen.getByRole('checkbox', { name: /enable sync/i })
      fireEvent.click(checkbox)

      const saveButton = screen.getByText('Save Changes')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText(/settings saved successfully/i)).toBeInTheDocument()
      })
    })

    it('should hide save button after successful save', async () => {
      render(<SyncSettingsPanel {...createDefaultProps()} />)

      const checkbox = screen.getByRole('checkbox', { name: /enable sync/i })
      fireEvent.click(checkbox)

      const saveButton = screen.getByText('Save Changes')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(screen.queryByText('Save Changes')).not.toBeInTheDocument()
      })
    })

    it('should auto-hide success message after 3 seconds', async () => {
      render(<SyncSettingsPanel {...createDefaultProps()} />)

      const checkbox = screen.getByRole('checkbox', { name: /enable sync/i })
      fireEvent.click(checkbox)

      const saveButton = screen.getByText('Save Changes')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText(/settings saved successfully/i)).toBeInTheDocument()
      })

      // Wait for auto-hide (3 seconds + buffer)
      await waitFor(
        () => {
          expect(screen.queryByText(/settings saved successfully/i)).not.toBeInTheDocument()
        },
        { timeout: 4000 }
      )
    })
  })

  describe('accessibility', () => {
    it('should have accessible checkbox label', () => {
      render(<SyncSettingsPanel {...createDefaultProps()} />)

      const checkbox = screen.getByRole('checkbox', { name: /enable sync/i })
      expect(checkbox).toHaveAccessibleName()
    })

    it('should have accessible relay URL input', () => {
      render(
        <SyncSettingsPanel
          {...createDefaultProps({
            initialConfig: { enabled: true, selfHosted: true },
          })}
        />
      )

      const input = screen.getByLabelText('Relay URL')
      expect(input).toHaveAccessibleName()
      expect(input).toHaveAttribute('aria-describedby', 'relay-url-help')
    })

    it('should have accessible advanced settings toggle', () => {
      render(
        <SyncSettingsPanel
          {...createDefaultProps({ initialConfig: { enabled: true } })}
        />
      )

      const toggle = screen.getByRole('button', { name: /advanced settings/i })
      expect(toggle).toHaveAttribute('aria-expanded', 'false')

      fireEvent.click(toggle)
      expect(toggle).toHaveAttribute('aria-expanded', 'true')
    })

    it('should announce validation errors with role="alert"', async () => {
      render(
        <SyncSettingsPanel
          {...createDefaultProps({
            initialConfig: { enabled: true, selfHosted: false },
          })}
        />
      )

      // Switch to self-hosted without providing URL
      const radios = screen.getAllByRole('radio')
      fireEvent.click(radios[1])

      const saveButton = screen.getByText('Save Changes')
      fireEvent.click(saveButton)

      await waitFor(() => {
        const alert = screen.getByRole('alert')
        expect(alert).toBeInTheDocument()
      })
    })

    it('should announce success with role="status"', async () => {
      render(<SyncSettingsPanel {...createDefaultProps()} />)

      const checkbox = screen.getByRole('checkbox', { name: /enable sync/i })
      fireEvent.click(checkbox)

      const saveButton = screen.getByText('Save Changes')
      fireEvent.click(saveButton)

      await waitFor(
        () => {
          const status = screen.getByRole('status')
          expect(status).toBeInTheDocument()
        },
        { timeout: 5000 }
      )
    })
  })

  describe('communication style', () => {
    it('should use plain English in explanations', () => {
      render(
        <SyncSettingsPanel
          {...createDefaultProps({ initialConfig: { enabled: true } })}
        />
      )

      expect(
        screen.getByText(/Your data stays encrypted—we can't read it/i)
      ).toBeInTheDocument()
    })

    it('should use reassuring tone in messages', () => {
      render(
        <SyncSettingsPanel
          {...createDefaultProps({ initialConfig: { enabled: true } })}
        />
      )

      expect(screen.getByText(/We handle the infrastructure/i)).toBeInTheDocument()
    })

    it('should use patient language for self-hosted option', () => {
      render(
        <SyncSettingsPanel
          {...createDefaultProps({ initialConfig: { enabled: true } })}
        />
      )

      expect(screen.getByText(/Requires technical setup/i)).toBeInTheDocument()
    })

    it('should use encouraging success message', async () => {
      render(<SyncSettingsPanel {...createDefaultProps()} />)

      const checkbox = screen.getByRole('checkbox', { name: /enable sync/i })
      fireEvent.click(checkbox)

      const saveButton = screen.getByText('Save Changes')
      fireEvent.click(saveButton)

      await waitFor(
        () => {
          expect(screen.getByText(/settings saved successfully/i)).toBeInTheDocument()
        },
        { timeout: 5000 }
      )
    })

    it('should use non-blaming validation messages', async () => {
      render(
        <SyncSettingsPanel
          {...createDefaultProps({
            initialConfig: { enabled: true, selfHosted: false },
          })}
        />
      )

      // Switch to self-hosted without providing URL
      const radios = screen.getAllByRole('radio')
      fireEvent.click(radios[1])

      const saveButton = screen.getByText('Save Changes')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText(/Please check the following:/i)).toBeInTheDocument()
      })
    })
  })
})
