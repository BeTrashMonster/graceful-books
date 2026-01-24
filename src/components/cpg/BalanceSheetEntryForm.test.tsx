/**
 * Balance Sheet Entry Form Component Tests
 *
 * Tests for Balance Sheet entry functionality and balance validation
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BalanceSheetEntryForm } from './BalanceSheetEntryForm';

describe('BalanceSheetEntryForm', () => {
  const mockCompanyId = 'test-company-123';
  const mockOnSave = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial Render', () => {
    it('renders period selection fields', () => {
      render(
        <BalanceSheetEntryForm companyId={mockCompanyId} onSave={mockOnSave} />
      );

      expect(screen.getByLabelText(/Period Type/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/As of Date/i)).toBeInTheDocument();
    });

    it('renders all balance sheet sections', () => {
      render(
        <BalanceSheetEntryForm companyId={mockCompanyId} onSave={mockOnSave} />
      );

      expect(screen.getByText(/^Assets$/i)).toBeInTheDocument();
      expect(screen.getByText(/^Liabilities$/i)).toBeInTheDocument();
      expect(screen.getByText(/^Equity$/i)).toBeInTheDocument();
    });

    it('renders current and fixed asset subsections', () => {
      render(
        <BalanceSheetEntryForm companyId={mockCompanyId} onSave={mockOnSave} />
      );

      expect(screen.getByText(/Current Assets/i)).toBeInTheDocument();
      expect(screen.getByText(/Fixed Assets/i)).toBeInTheDocument();
    });

    it('renders current and long-term liability subsections', () => {
      render(
        <BalanceSheetEntryForm companyId={mockCompanyId} onSave={mockOnSave} />
      );

      expect(screen.getByText(/Current Liabilities/i)).toBeInTheDocument();
      expect(screen.getByText(/Long-term Liabilities/i)).toBeInTheDocument();
    });

    it('renders balance indicator', () => {
      render(
        <BalanceSheetEntryForm companyId={mockCompanyId} onSave={mockOnSave} />
      );

      expect(
        screen.getByText(/Balance Sheet Needs Adjustment/i)
      ).toBeInTheDocument();
    });

    it('save button is disabled when not balanced', () => {
      render(
        <BalanceSheetEntryForm companyId={mockCompanyId} onSave={mockOnSave} />
      );

      const saveButton = screen.getByText('Save Balance Sheet');
      expect(saveButton).toBeDisabled();
    });
  });

  describe('Line Item Management', () => {
    it('adds new current asset line', async () => {
      render(
        <BalanceSheetEntryForm companyId={mockCompanyId} onSave={mockOnSave} />
      );

      const addButtons = screen.getAllByText('+ Add Line');
      const initialDescriptionInputs = screen.getAllByLabelText(/Description/i);
      const initialCount = initialDescriptionInputs.length;

      // Click first "Add Line" button (Current Assets)
      fireEvent.click(addButtons[0]);

      await waitFor(() => {
        const updatedDescriptionInputs = screen.getAllByLabelText(/Description/i);
        expect(updatedDescriptionInputs.length).toBe(initialCount + 1);
      });
    });

    it('removes line item when more than one exists', async () => {
      render(
        <BalanceSheetEntryForm companyId={mockCompanyId} onSave={mockOnSave} />
      );

      // Add a line first
      const addButtons = screen.getAllByText('+ Add Line');
      fireEvent.click(addButtons[0]);

      await waitFor(() => {
        const removeButtons = screen.getAllByLabelText(/Remove line item/i);
        expect(removeButtons.length).toBeGreaterThan(0);
      });

      const removeButtons = screen.getAllByLabelText(/Remove line item/i);
      const initialCount = screen.getAllByLabelText(/Description/i).length;

      fireEvent.click(removeButtons[0]);

      await waitFor(() => {
        const updatedDescriptionInputs = screen.getAllByLabelText(/Description/i);
        expect(updatedDescriptionInputs.length).toBe(initialCount - 1);
      });
    });
  });

  describe('Balance Calculations', () => {
    it('calculates total current assets', async () => {
      render(
        <BalanceSheetEntryForm companyId={mockCompanyId} onSave={mockOnSave} />
      );

      const amountInputs = screen.getAllByLabelText(/Amount/i);

      // Set current asset amount
      fireEvent.change(amountInputs[0], { target: { value: '5000' } });

      await waitFor(() => {
        expect(screen.getByText(/Total Current Assets:/i)).toBeInTheDocument();
        expect(screen.getByText('$5000.00')).toBeInTheDocument();
      });
    });

    it('calculates total assets', async () => {
      render(
        <BalanceSheetEntryForm companyId={mockCompanyId} onSave={mockOnSave} />
      );

      const amountInputs = screen.getAllByLabelText(/Amount/i);

      // Set current asset
      fireEvent.change(amountInputs[0], { target: { value: '5000' } });

      // Set fixed asset
      fireEvent.change(amountInputs[1], { target: { value: '3000' } });

      await waitFor(() => {
        expect(screen.getByText(/Total Assets:/i)).toBeInTheDocument();
        expect(screen.getByText('$8000.00')).toBeInTheDocument();
      });
    });

    it('detects balanced sheet', async () => {
      render(
        <BalanceSheetEntryForm companyId={mockCompanyId} onSave={mockOnSave} />
      );

      const amountInputs = screen.getAllByLabelText(/Amount/i);

      // Set Assets = 10,000
      fireEvent.change(amountInputs[0], { target: { value: '5000' } }); // Current Assets
      fireEvent.change(amountInputs[1], { target: { value: '5000' } }); // Fixed Assets

      // Set Liabilities = 6,000
      fireEvent.change(amountInputs[2], { target: { value: '3000' } }); // Current Liabilities
      fireEvent.change(amountInputs[3], { target: { value: '3000' } }); // Long-term Liabilities

      // Set Equity = 4,000 (so Assets = Liabilities + Equity)
      fireEvent.change(amountInputs[4], { target: { value: '4000' } });

      await waitFor(() => {
        expect(screen.getByText(/Balance Sheet is Balanced!/i)).toBeInTheDocument();
        expect(screen.getByText('✓')).toBeInTheDocument();
      });
    });

    it('detects unbalanced sheet', async () => {
      render(
        <BalanceSheetEntryForm companyId={mockCompanyId} onSave={mockOnSave} />
      );

      const amountInputs = screen.getAllByLabelText(/Amount/i);

      // Set unbalanced amounts
      fireEvent.change(amountInputs[0], { target: { value: '10000' } }); // Assets
      fireEvent.change(amountInputs[2], { target: { value: '5000' } }); // Liabilities
      fireEvent.change(amountInputs[4], { target: { value: '3000' } }); // Equity (doesn't balance)

      await waitFor(() => {
        expect(screen.getByText(/Balance Sheet Needs Adjustment/i)).toBeInTheDocument();
        expect(screen.getByText('⚠')).toBeInTheDocument();
      });
    });

    it('enables save button when balanced', async () => {
      render(
        <BalanceSheetEntryForm companyId={mockCompanyId} onSave={mockOnSave} />
      );

      const amountInputs = screen.getAllByLabelText(/Amount/i);

      // Set balanced amounts (Assets = Liabilities + Equity)
      fireEvent.change(amountInputs[0], { target: { value: '10000' } }); // Current Assets
      fireEvent.change(amountInputs[2], { target: { value: '6000' } }); // Current Liabilities
      fireEvent.change(amountInputs[4], { target: { value: '4000' } }); // Equity

      await waitFor(() => {
        const saveButton = screen.getByText('Save Balance Sheet');
        expect(saveButton).not.toBeDisabled();
      });
    });
  });

  describe('Validation', () => {
    it('validates date is required', async () => {
      render(
        <BalanceSheetEntryForm companyId={mockCompanyId} onSave={mockOnSave} />
      );

      const dateInput = screen.getByLabelText(/As of Date/i) as HTMLInputElement;

      // Clear the date
      fireEvent.change(dateInput, { target: { value: '' } });

      // Try to save (need to balance first)
      const amountInputs = screen.getAllByLabelText(/Amount/i);
      fireEvent.change(amountInputs[0], { target: { value: '1000' } });
      fireEvent.change(amountInputs[4], { target: { value: '1000' } });

      const saveButton = screen.getByText('Save Balance Sheet');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).not.toHaveBeenCalled();
      });
    });

    it('validates amounts cannot be negative', async () => {
      render(
        <BalanceSheetEntryForm companyId={mockCompanyId} onSave={mockOnSave} />
      );

      const amountInputs = screen.getAllByLabelText(/Amount/i);

      // Set negative amount
      fireEvent.change(amountInputs[0], { target: { value: '-1000' } });

      // Try to save (need to balance first)
      fireEvent.change(amountInputs[4], { target: { value: '1000' } });

      const saveButton = screen.getByText('Save Balance Sheet');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/Amount cannot be negative/i)).toBeInTheDocument();
      });
    });

    it('shows error when trying to save unbalanced sheet', async () => {
      render(
        <BalanceSheetEntryForm companyId={mockCompanyId} onSave={mockOnSave} />
      );

      const amountInputs = screen.getAllByLabelText(/Amount/i);

      // Set unbalanced amounts
      fireEvent.change(amountInputs[0], { target: { value: '10000' } });
      fireEvent.change(amountInputs[4], { target: { value: '5000' } });

      // Save button should be disabled
      const saveButton = screen.getByText('Save Balance Sheet');
      expect(saveButton).toBeDisabled();
    });
  });

  describe('Save Functionality', () => {
    it('calls onSave with correct data structure when balanced', async () => {
      render(
        <BalanceSheetEntryForm companyId={mockCompanyId} onSave={mockOnSave} />
      );

      const amountInputs = screen.getAllByLabelText(/Amount/i);

      // Set balanced amounts
      fireEvent.change(amountInputs[0], { target: { value: '10000' } }); // Assets
      fireEvent.change(amountInputs[2], { target: { value: '6000' } }); // Liabilities
      fireEvent.change(amountInputs[4], { target: { value: '4000' } }); // Equity

      await waitFor(() => {
        const saveButton = screen.getByText('Save Balance Sheet');
        expect(saveButton).not.toBeDisabled();
      });

      const saveButton = screen.getByText('Save Balance Sheet');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            periodType: expect.any(String),
            periodStart: expect.any(Number),
            periodEnd: expect.any(Number),
            lineItems: expect.any(Array),
          })
        );
      });
    });

    it('calls onCancel when cancel button clicked', () => {
      render(
        <BalanceSheetEntryForm
          companyId={mockCompanyId}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('has proper heading hierarchy', () => {
      render(
        <BalanceSheetEntryForm companyId={mockCompanyId} onSave={mockOnSave} />
      );

      expect(screen.getByRole('heading', { level: 2, name: /^Assets$/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: /^Liabilities$/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 3, name: /Current Assets/i })).toBeInTheDocument();
    });

    it('has descriptive labels for all inputs', () => {
      render(
        <BalanceSheetEntryForm companyId={mockCompanyId} onSave={mockOnSave} />
      );

      expect(screen.getByLabelText(/Period Type/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/As of Date/i)).toBeInTheDocument();
    });

    it('has accessible remove buttons', () => {
      render(
        <BalanceSheetEntryForm companyId={mockCompanyId} onSave={mockOnSave} />
      );

      // Add a line to get remove buttons
      const addButtons = screen.getAllByText('+ Add Line');
      fireEvent.click(addButtons[0]);

      const removeButtons = screen.getAllByLabelText(/Remove line item/i);
      expect(removeButtons.length).toBeGreaterThan(0);
    });
  });

  describe('User Guidance', () => {
    it('shows helpful text when unbalanced', async () => {
      render(
        <BalanceSheetEntryForm companyId={mockCompanyId} onSave={mockOnSave} />
      );

      const amountInputs = screen.getAllByLabelText(/Amount/i);

      // Set unbalanced amounts
      fireEvent.change(amountInputs[0], { target: { value: '10000' } });
      fireEvent.change(amountInputs[4], { target: { value: '5000' } });

      await waitFor(() => {
        expect(
          screen.getByText(/Take your time adjusting the amounts/i)
        ).toBeInTheDocument();
      });
    });

    it('shows encouraging text when balanced', async () => {
      render(
        <BalanceSheetEntryForm companyId={mockCompanyId} onSave={mockOnSave} />
      );

      const amountInputs = screen.getAllByLabelText(/Amount/i);

      // Set balanced amounts
      fireEvent.change(amountInputs[0], { target: { value: '10000' } });
      fireEvent.change(amountInputs[2], { target: { value: '6000' } });
      fireEvent.change(amountInputs[4], { target: { value: '4000' } });

      await waitFor(() => {
        expect(screen.getByText(/Great!/i)).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles zero values correctly', async () => {
      render(
        <BalanceSheetEntryForm companyId={mockCompanyId} onSave={mockOnSave} />
      );

      const amountInputs = screen.getAllByLabelText(/Amount/i);

      // All zeros should balance
      fireEvent.change(amountInputs[0], { target: { value: '0' } });
      fireEvent.change(amountInputs[2], { target: { value: '0' } });
      fireEvent.change(amountInputs[4], { target: { value: '0' } });

      await waitFor(() => {
        expect(screen.getByText(/Balance Sheet is Balanced!/i)).toBeInTheDocument();
      });
    });

    it('handles decimal values correctly', async () => {
      render(
        <BalanceSheetEntryForm companyId={mockCompanyId} onSave={mockOnSave} />
      );

      const amountInputs = screen.getAllByLabelText(/Amount/i);

      // Set decimal amounts that balance
      fireEvent.change(amountInputs[0], { target: { value: '1000.50' } });
      fireEvent.change(amountInputs[2], { target: { value: '600.25' } });
      fireEvent.change(amountInputs[4], { target: { value: '400.25' } });

      await waitFor(() => {
        expect(screen.getByText(/Balance Sheet is Balanced!/i)).toBeInTheDocument();
      });
    });
  });
});
