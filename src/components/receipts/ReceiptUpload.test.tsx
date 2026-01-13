/**
 * Tests for ReceiptUpload Component
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReceiptUpload } from './ReceiptUpload'

describe('ReceiptUpload', () => {
  it('should render upload area', () => {
    const mockOnFileSelect = vi.fn()

    render(<ReceiptUpload onFileSelect={mockOnFileSelect} />)

    expect(screen.getByRole('button', { name: /upload receipt/i })).toBeInTheDocument()
    expect(screen.getByText(/drag and drop receipt here/i)).toBeInTheDocument()
  })

  it('should show uploading state', () => {
    const mockOnFileSelect = vi.fn()

    render(<ReceiptUpload onFileSelect={mockOnFileSelect} isUploading={true} />)

    expect(screen.getByText(/uploading receipt/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/uploading/i)).toBeInTheDocument()
  })

  it('should display error message', () => {
    const mockOnFileSelect = vi.fn()
    const errorMessage = 'File too large'

    render(<ReceiptUpload onFileSelect={mockOnFileSelect} error={errorMessage} />)

    expect(screen.getByRole('alert')).toHaveTextContent(errorMessage)
  })

  it('should display success message', () => {
    const mockOnFileSelect = vi.fn()
    const successMessage = 'Receipt uploaded successfully'

    render(<ReceiptUpload onFileSelect={mockOnFileSelect} success={successMessage} />)

    expect(screen.getByRole('status')).toHaveTextContent(successMessage)
  })

  it('should be keyboard accessible', () => {
    const mockOnFileSelect = vi.fn()

    render(<ReceiptUpload onFileSelect={mockOnFileSelect} />)

    const uploadArea = screen.getByRole('button', { name: /upload receipt/i })
    expect(uploadArea).toHaveAttribute('tabIndex', '0')
  })

  it('should have proper ARIA attributes', () => {
    const mockOnFileSelect = vi.fn()

    render(<ReceiptUpload onFileSelect={mockOnFileSelect} />)

    const uploadArea = screen.getByRole('button', { name: /upload receipt/i })
    expect(uploadArea).toHaveAttribute('aria-label', 'Upload receipt')
    expect(uploadArea).toHaveAttribute('aria-disabled', 'false')
  })

  it('should disable upload when uploading', () => {
    const mockOnFileSelect = vi.fn()

    render(<ReceiptUpload onFileSelect={mockOnFileSelect} isUploading={true} />)

    const uploadArea = screen.getByRole('button', { name: /upload receipt/i })
    expect(uploadArea).toHaveAttribute('aria-disabled', 'true')
  })

  it('should accept correct file types', () => {
    const mockOnFileSelect = vi.fn()

    render(<ReceiptUpload onFileSelect={mockOnFileSelect} />)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    expect(fileInput).toHaveAttribute(
      'accept',
      'image/jpeg,image/png,image/heic,application/pdf'
    )
  })

  it('should support mobile camera capture', () => {
    const mockOnFileSelect = vi.fn()

    render(<ReceiptUpload onFileSelect={mockOnFileSelect} />)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    expect(fileInput).toHaveAttribute('capture', 'environment')
  })
})
