/**
 * P&L Entry Form Component Tests
 *
 * Tests for Profit & Loss statement entry functionality
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PLEntryForm } from './PLEntryForm';

describe('PLEntryForm', () => {
  const mockCompanyId = 'test-company-123';
  const mockOnSave = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial Render', () => {
    it('renders period selection fields', () => {
      render(
        <PLEntryForm companyId={mockCompanyId} onSave={mockOnSave} />
      );

      expect(screen.getByLabelText(/Period Type/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Start Date/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/End Date/i)).toBeInTheDocument();
    });

    it('renders revenue, COGS, and expense sections', () => {
      render(
        <PLEntryForm companyId={mockCompanyId} onSave={mockOnSave} />
      );

      expect(screen.getByText(/Revenue/i)).toBeInTheDocument();
      expect(screen.getByText(/Cost of Goods Sold/i)).toBeInTheDocument();
      expect(screen.getByText(/Expenses/i)).toBeInTheDocument();
    });

    it('renders initial line items for each category', () => {
      render(
        <PLEntryForm companyId={mockCompanyId} onSave={mockOnSave} />
      );

      // Should have at least 3 line items (one for each category)
      const descriptionInputs = screen.getAllByLabelText(/Description/i);
      expect(descriptionInputs.length).toBeGreaterThanOrEqual(3);
    });

    it('renders save button', () => {
      render(
        <PLEntryForm companyId={mockCompanyId} onSave={mockOnSave} />
      );

      expect(screen.getByText('Save P&L Statement')).toBeInTheDocument();
    });

    it('renders cancel button when onCancel provided', () => {
      render(
        <PLEntryForm
          companyId={mockCompanyId}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });

  describe('Period Selection', () => {
    it('updates period end when period type changes', async () => {
      render(
        <PLEntryForm companyId={mockCompanyId} onSave={mockOnSave} />
      );

      const periodTypeSelect = screen.getByLabelText(/Period Type/i);

      // Change to quarterly
      fireEvent.change(periodTypeSelect, { target: { value: 'quarterly' } });

      // Period label should update
      await waitFor(() => {
        expect(screen.getByText(/Period:/i)).toBeInTheDocument();
      });
    });

    it('displays period label based on selection', async () => {
      render(
        <PLEntryForm companyId={mockCompanyId} onSave={mockOnSave} />
      );

      const startDate = screen.getByLabelText(/Start Date/i) as HTMLInputElement;
      const endDate = screen.getByLabelText(/End Date/i) as HTMLInputElement;

      expect(startDate.value).toBeTruthy();
      expect(endDate.value).toBeTruthy();
    });
  });

  describe('Line Item Management', () => {
    it('adds new revenue line item', async () => {
      render(
        <PLEntryForm companyId={mockCompanyId} onSave={mockOnSave} />
      );

      const addRevenueButton = screen.getByText('+ Add Revenue Line');
      const initialDescriptionInputs = screen.getAllByLabelText(/Description/i);
      const initialCount = initialDescriptionInputs.length;

      fireEvent.click(addRevenueButton);

      await waitFor(() => {
        const updatedDescriptionInputs = screen.getAllByLabelText(/Description/i);
        expect(updatedDescriptionInputs.length).toBe(initialCount + 1);
      });
    });

    it('adds new COGS line item', async () => {
      render(
        <PLEntryForm companyId={mockCompanyId} onSave={mockOnSave} />
      );

      const addCogsButton = screen.getByText('+ Add COGS Line');
      const initialDescriptionInputs = screen.getAllByLabelText(/Description/i);
      const initialCount = initialDescriptionInputs.length;

      fireEvent.click(addCogsButton);

      await waitFor(() => {
        const updatedDescriptionInputs = screen.getAllByLabelText(/Description/i);
        expect(updatedDescriptionInputs.length).toBe(initialCount + 1);
      });
    });

    it('adds new expense line item', async () => {
      render(
        <PLEntryForm companyId={mockCompanyId} onSave={mockOnSave} />
      );

      const addExpenseButton = screen.getByText('+ Add Expense Line');
      const initialDescriptionInputs = screen.getAllByLabelText(/Description/i);
      const initialCount = initialDescriptionInputs.length;

      fireEvent.click(addExpenseButton);

      await waitFor(() => {
        const updatedDescriptionInputs = screen.getAllByLabelText(/Description/i);
        expect(updatedDescriptionInputs.length).toBe(initialCount + 1);
      });
    });

    it('removes line item when more than one exists', async () => {
      render(
        <PLEntryForm companyId={mockCompanyId} onSave={mockOnSave} />
      );

      // Add a revenue line first
      const addRevenueButton = screen.getByText('+ Add Revenue Line');
      fireEvent.click(addRevenueButton);

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

  describe('Calculations', () => {
    it('calculates total revenue', async () => {
      render(
        <PLEntryForm companyId={mockCompanyId} onSave={mockOnSave} />
      );

      const amountInputs = screen.getAllByLabelText(/Amount/i);
      const revenueInput = amountInputs[0]; // First input is revenue

      fireEvent.change(revenueInput, { target: { value: '1000' } });

      await waitFor(() => {
        expect(screen.getByText(/Total Revenue:/i)).toBeInTheDocument();
        expect(screen.getByText('$1000.00')).toBeInTheDocument();
      });
    });

    it('calculates gross profit', async () => {
      render(
        <PLEntryForm companyId={mockCompanyId} onSave={mockOnSave} />
      );

      const amountInputs = screen.getAllByLabelText(/Amount/i);

      // Set revenue
      fireEvent.change(amountInputs[0], { target: { value: '1000' } });

      // Set COGS
      fireEvent.change(amountInputs[1], { target: { value: '400' } });

      await waitFor(() => {
        expect(screen.getByText(/Gross Profit:/i)).toBeInTheDocument();
        expect(screen.getByText('$600.00')).toBeInTheDocument();
      });
    });

    it('calculates net income', async () => {
      render(
        <PLEntryForm companyId={mockCompanyId} onSave={mockOnSave} />
      );

      const amountInputs = screen.getAllByLabelText(/Amount/i);

      // Set revenue
      fireEvent.change(amountInputs[0], { target: { value: '1000' } });

      // Set COGS
      fireEvent.change(amountInputs[1], { target: { value: '400' } });

      // Set expenses
      fireEvent.change(amountInputs[2], { target: { value: '200' } });

      await waitFor(() => {
        expect(screen.getByText(/Net Income \(Profit\):/i)).toBeInTheDocument();
        expect(screen.getByText('$400.00')).toBeInTheDocument();
      });
    });

    it('shows positive messaging for profitable net income', async () => {
      render(
        <PLEntryForm companyId={mockCompanyId} onSave={mockOnSave} />
      );

      const amountInputs = screen.getAllByLabelText(/Amount/i);

      // Set profitable scenario
      fireEvent.change(amountInputs[0], { target: { value: '1000' } });
      fireEvent.change(amountInputs[1], { target: { value: '400' } });
      fireEvent.change(amountInputs[2], { target: { value: '200' } });

      await waitFor(() => {
        expect(
          screen.getByText(/Great! Your business is profitable this period./i)
        ).toBeInTheDocument();
      });
    });

    it('shows supportive messaging for negative net income', async () => {
      render(
        <PLEntryForm companyId={mockCompanyId} onSave={mockOnSave} />
      );

      const amountInputs = screen.getAllByLabelText(/Amount/i);

      // Set unprofitable scenario
      fireEvent.change(amountInputs[0], { target: { value: '1000' } });
      fireEvent.change(amountInputs[1], { target: { value: '800' } });
      fireEvent.change(amountInputs[2], { target: { value: '300' } });

      await waitFor(() => {
        expect(
          screen.getByText(/Your expenses exceeded revenue this period/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Validation', () => {
    it('validates period dates are required', async () => {
      render(
        <PLEntryForm companyId={mockCompanyId} onSave={mockOnSave} />
      );

      const startDateInput = screen.getByLabelText(/Start Date/i) as HTMLInputElement;
      const saveButton = screen.getByText('Save P&L Statement');

      // Clear the date
      fireEvent.change(startDateInput, { target: { value: '' } });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).not.toHaveBeenCalled();
      });
    });

    it('validates period end is after start', async () => {
      render(
        <PLEntryForm companyId={mockCompanyId} onSave={mockOnSave} />
      );

      const startDateInput = screen.getByLabelText(/Start Date/i);
      const endDateInput = screen.getByLabelText(/End Date/i);
      const saveButton = screen.getByText('Save P&L Statement');

      // Set end before start
      fireEvent.change(startDateInput, { target: { value: '2024-02-01' } });
      fireEvent.change(endDateInput, { target: { value: '2024-01-01' } });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/Period end must be after period start/i)).toBeInTheDocument();
      });
    });

    it('validates amounts cannot be negative', async () => {
      render(
        <PLEntryForm companyId={mockCompanyId} onSave={mockOnSave} />
      );

      const amountInputs = screen.getAllByLabelText(/Amount/i);
      const saveButton = screen.getByText('Save P&L Statement');

      // Set negative amount
      fireEvent.change(amountInputs[0], { target: { value: '-100' } });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/Amount cannot be negative/i)).toBeInTheDocument();
      });
    });
  });

  describe('Save Functionality', () => {
    it('calls onSave with correct data structure', async () => {
      render(
        <PLEntryForm companyId={mockCompanyId} onSave={mockOnSave} />
      );

      const amountInputs = screen.getAllByLabelText(/Amount/i);
      const saveButton = screen.getByText('Save P&L Statement');

      // Fill in some data
      fireEvent.change(amountInputs[0], { target: { value: '1000' } });

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
        <PLEntryForm
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
        <PLEntryForm companyId={mockCompanyId} onSave={mockOnSave} />
      );

      expect(screen.getByRole('heading', { level: 3, name: /Statement Period/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 3, name: /Revenue/i })).toBeInTheDocument();
    });

    it('has descriptive labels for all inputs', () => {
      render(
        <PLEntryForm companyId={mockCompanyId} onSave={mockOnSave} />
      );

      expect(screen.getByLabelText(/Period Type/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Start Date/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/End Date/i)).toBeInTheDocument();
    });
  });
});
