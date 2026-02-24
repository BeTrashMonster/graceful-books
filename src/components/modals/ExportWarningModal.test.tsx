/**
 * Export Warning Modal Tests
 *
 * S7-3: Secure Data Export - Component test coverage
 *
 * Tests the user-facing warning modal for data exports.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ExportWarningModal } from './ExportWarningModal'

describe('ExportWarningModal', () => {
  const defaultProps = {
    isOpen: true,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    entityType: 'transactions',
    recordCount: 150,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render when open', () => {
      render(<ExportWarningModal {...defaultProps} />)

      expect(screen.getByText('Export Data - Security Notice')).toBeInTheDocument()
      expect(screen.getByText(/important: exported data is not encrypted/i)).toBeInTheDocument()
    })

    it('should not render when closed', () => {
      render(<ExportWarningModal {...defaultProps} isOpen={false} />)

      expect(screen.queryByText('Export Data - Security Notice')).not.toBeInTheDocument()
    })

    it('should display entity type', () => {
      render(<ExportWarningModal {...defaultProps} entityType="invoices" />)

      expect(screen.getByText(/invoices/i)).toBeInTheDocument()
    })

    it('should display record count', () => {
      render(<ExportWarningModal {...defaultProps} recordCount={42} />)

      expect(screen.getByText(/42 records/i)).toBeInTheDocument()
    })

    it('should handle singular record count', () => {
      render(<ExportWarningModal {...defaultProps} recordCount={1} />)

      expect(screen.getByText(/1 record[^s]/i)).toBeInTheDocument()
    })

    it('should display security warnings', () => {
      render(<ExportWarningModal {...defaultProps} />)

      expect(screen.getByText(/store the file in a secure location/i)).toBeInTheDocument()
      expect(screen.getByText(/delete the file when you no longer need it/i)).toBeInTheDocument()
      expect(screen.getByText(/never share the file over unsecured channels/i)).toBeInTheDocument()
    })
  })

  describe('Warning Acknowledgment', () => {
    it('should disable export button initially', () => {
      render(<ExportWarningModal {...defaultProps} />)

      const exportButton = screen.getByRole('button', { name: /export data/i })
      expect(exportButton).toBeDisabled()
    })

    it('should enable export button when checkbox is checked', async () => {
      render(<ExportWarningModal {...defaultProps} />)

      const checkbox = screen.getByRole('checkbox')
      const exportButton = screen.getByRole('button', { name: /export data/i })

      expect(exportButton).toBeDisabled()

      fireEvent.click(checkbox)

      await waitFor(() => {
        expect(exportButton).not.toBeDisabled()
      })
    })

    it('should disable export button when checkbox is unchecked', async () => {
      render(<ExportWarningModal {...defaultProps} />)

      const checkbox = screen.getByRole('checkbox')
      const exportButton = screen.getByRole('button', { name: /export data/i })

      // Check the box
      fireEvent.click(checkbox)
      await waitFor(() => expect(exportButton).not.toBeDisabled())

      // Uncheck the box
      fireEvent.click(checkbox)
      await waitFor(() => expect(exportButton).toBeDisabled())
    })

    it('should call onConfirm when export button clicked with acknowledgment', async () => {
      render(<ExportWarningModal {...defaultProps} />)

      const checkbox = screen.getByRole('checkbox')
      const exportButton = screen.getByRole('button', { name: /export data/i })

      fireEvent.click(checkbox)
      fireEvent.click(exportButton)

      await waitFor(() => {
        expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1)
      })
    })

    it('should not call onConfirm without acknowledgment', () => {
      render(<ExportWarningModal {...defaultProps} />)

      const exportButton = screen.getByRole('button', { name: /export data/i })

      // Try to click disabled button
      fireEvent.click(exportButton)

      expect(defaultProps.onConfirm).not.toHaveBeenCalled()
    })
  })

  describe('Rate Limit Display', () => {
    it('should display rate limit information', () => {
      const rateLimit = {
        remaining: 5,
        resetsAt: Date.now() + 3600000, // 1 hour from now
      }

      render(<ExportWarningModal {...defaultProps} rateLimit={rateLimit} />)

      expect(screen.getByText(/5 exports remaining/i)).toBeInTheDocument()
    })

    it('should handle zero remaining exports', () => {
      const rateLimit = {
        remaining: 0,
        resetsAt: Date.now() + 1800000, // 30 minutes from now
      }

      render(<ExportWarningModal {...defaultProps} rateLimit={rateLimit} />)

      expect(screen.getByText(/0 exports remaining/i)).toBeInTheDocument()
      expect(screen.getByText(/quota will reset/i)).toBeInTheDocument()
    })

    it('should handle singular export remaining', () => {
      const rateLimit = {
        remaining: 1,
        resetsAt: Date.now() + 3600000,
      }

      render(<ExportWarningModal {...defaultProps} rateLimit={rateLimit} />)

      expect(screen.getByText(/1 export remaining/i)).toBeInTheDocument()
    })

    it('should not display rate limit when not provided', () => {
      render(<ExportWarningModal {...defaultProps} />)

      expect(screen.queryByText(/exports remaining/i)).not.toBeInTheDocument()
    })
  })

  describe('Exporting State', () => {
    it('should show exporting message when in progress', () => {
      render(<ExportWarningModal {...defaultProps} isExporting={true} />)

      expect(screen.getByText(/exporting\.\.\./i)).toBeInTheDocument()
    })

    it('should disable all buttons when exporting', () => {
      render(<ExportWarningModal {...defaultProps} isExporting={true} />)

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      const exportButton = screen.getByRole('button', { name: /exporting/i })

      expect(cancelButton).toBeDisabled()
      expect(exportButton).toBeDisabled()
    })

    it('should disable checkbox when exporting', () => {
      render(<ExportWarningModal {...defaultProps} isExporting={true} />)

      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).toBeDisabled()
    })

    it('should not call onConfirm when exporting', () => {
      render(<ExportWarningModal {...defaultProps} isExporting={true} />)

      const checkbox = screen.getByRole('checkbox')
      fireEvent.click(checkbox)

      const exportButton = screen.getByRole('button', { name: /exporting/i })
      fireEvent.click(exportButton)

      expect(defaultProps.onConfirm).not.toHaveBeenCalled()
    })
  })

  describe('Cancel Behavior', () => {
    it('should call onCancel when cancel button clicked', () => {
      render(<ExportWarningModal {...defaultProps} />)

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      fireEvent.click(cancelButton)

      expect(defaultProps.onCancel).toHaveBeenCalledTimes(1)
    })

    it('should reset acknowledgment when modal closes', async () => {
      const { rerender } = render(<ExportWarningModal {...defaultProps} />)

      const checkbox = screen.getByRole('checkbox')
      fireEvent.click(checkbox)

      await waitFor(() => expect(checkbox).toBeChecked())

      // Close modal
      rerender(<ExportWarningModal {...defaultProps} isOpen={false} />)

      // Reopen modal
      rerender(<ExportWarningModal {...defaultProps} isOpen={true} />)

      const newCheckbox = screen.getByRole('checkbox')
      expect(newCheckbox).not.toBeChecked()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<ExportWarningModal {...defaultProps} />)

      expect(screen.getByRole('button', { name: /cancel export/i })).toBeInTheDocument()
      expect(screen.getByLabelText(/i understand that the exported file/i)).toBeInTheDocument()
    })

    it('should have alert role for warning box', () => {
      render(<ExportWarningModal {...defaultProps} />)

      const warningBox = screen.getByRole('alert')
      expect(warningBox).toBeInTheDocument()
      expect(warningBox).toHaveTextContent(/important: exported data is not encrypted/i)
    })

    it('should have proper checkbox description', () => {
      render(<ExportWarningModal {...defaultProps} />)

      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).toHaveAttribute('aria-describedby', 'export-warning-description')
    })

    it('should update aria-label when checkbox state changes', async () => {
      render(<ExportWarningModal {...defaultProps} />)

      const exportButton = screen.getByRole('button', { name: /acknowledge warning to enable export/i })
      expect(exportButton).toBeInTheDocument()

      const checkbox = screen.getByRole('checkbox')
      fireEvent.click(checkbox)

      await waitFor(() => {
        const updatedButton = screen.getByRole('button', { name: /proceed with export/i })
        expect(updatedButton).toBeInTheDocument()
      })
    })
  })

  describe('Entity Type Formatting', () => {
    it('should format transactions correctly', () => {
      render(<ExportWarningModal {...defaultProps} entityType="transactions" />)
      expect(screen.getByText(/transactions/i)).toBeInTheDocument()
    })

    it('should format invoices correctly', () => {
      render(<ExportWarningModal {...defaultProps} entityType="invoices" />)
      expect(screen.getByText(/invoices/i)).toBeInTheDocument()
    })

    it('should format products correctly', () => {
      render(<ExportWarningModal {...defaultProps} entityType="products" />)
      expect(screen.getByText(/products & services/i)).toBeInTheDocument()
    })

    it('should handle unknown entity types', () => {
      render(<ExportWarningModal {...defaultProps} entityType="unknown" />)
      expect(screen.getByText(/unknown/i)).toBeInTheDocument()
    })
  })
})
