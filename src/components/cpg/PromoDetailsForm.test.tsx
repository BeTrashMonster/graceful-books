import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PromoDetailsForm } from './PromoDetailsForm';

describe('PromoDetailsForm', () => {
  const mockSubmit = vi.fn();
  const availableVariants = ['8oz', '16oz', '32oz'];
  const latestCPUs = {
    '8oz': '2.15',
    '16oz': '3.20',
    '32oz': '4.50',
  };

  describe('Rendering', () => {
    it('renders all form fields', () => {
      render(
        <PromoDetailsForm
          availableVariants={availableVariants}
          latestCPUs={latestCPUs}
          onSubmit={mockSubmit}
        />
      );

      expect(screen.getByLabelText(/Promo Name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Retailer Name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Promo Start Date/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Promo End Date/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Store Sale %/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Producer Payback %/i)).toBeInTheDocument();
    });

    it('renders variant cards for all variants', () => {
      render(
        <PromoDetailsForm
          availableVariants={availableVariants}
          latestCPUs={latestCPUs}
          onSubmit={mockSubmit}
        />
      );

      expect(screen.getByText('8oz')).toBeInTheDocument();
      expect(screen.getByText('16oz')).toBeInTheDocument();
      expect(screen.getByText('32oz')).toBeInTheDocument();
    });

    it('auto-populates base CPUs from latestCPUs prop', () => {
      render(
        <PromoDetailsForm
          availableVariants={availableVariants}
          latestCPUs={latestCPUs}
          onSubmit={mockSubmit}
        />
      );

      const baseCPUInputs = screen.getAllByLabelText(/Base CPU/i);
      expect(baseCPUInputs[0]).toHaveValue(2.15);
      expect(baseCPUInputs[1]).toHaveValue(3.20);
      expect(baseCPUInputs[2]).toHaveValue(4.50);
    });

    it('renders submit button', () => {
      render(
        <PromoDetailsForm
          availableVariants={availableVariants}
          latestCPUs={latestCPUs}
          onSubmit={mockSubmit}
        />
      );

      expect(screen.getByRole('button', { name: /Analyze Promo/i })).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('validates required promo name', async () => {
      render(
        <PromoDetailsForm
          availableVariants={availableVariants}
          latestCPUs={latestCPUs}
          onSubmit={mockSubmit}
        />
      );

      const submitButton = screen.getByRole('button', { name: /Analyze Promo/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Promo name is required/i)).toBeInTheDocument();
      });
      expect(mockSubmit).not.toHaveBeenCalled();
    });

    it('validates required retailer name', async () => {
      render(
        <PromoDetailsForm
          availableVariants={availableVariants}
          latestCPUs={latestCPUs}
          onSubmit={mockSubmit}
        />
      );

      const submitButton = screen.getByRole('button', { name: /Analyze Promo/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Retailer name is required/i)).toBeInTheDocument();
      });
      expect(mockSubmit).not.toHaveBeenCalled();
    });

    it('validates store sale percentage range (0-100)', async () => {
      const user = userEvent.setup();
      render(
        <PromoDetailsForm
          availableVariants={availableVariants}
          latestCPUs={latestCPUs}
          onSubmit={mockSubmit}
        />
      );

      const storeSaleInput = screen.getByLabelText(/Store Sale %/i);
      await user.type(storeSaleInput, '150');

      const submitButton = screen.getByRole('button', { name: /Analyze Promo/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Store sale % must be between 0 and 100/i)).toBeInTheDocument();
      });
      expect(mockSubmit).not.toHaveBeenCalled();
    });

    it('validates producer payback percentage range (0-100)', async () => {
      const user = userEvent.setup();
      render(
        <PromoDetailsForm
          availableVariants={availableVariants}
          latestCPUs={latestCPUs}
          onSubmit={mockSubmit}
        />
      );

      const paybackInput = screen.getByLabelText(/Producer Payback %/i);
      await user.type(paybackInput, '-10');

      const submitButton = screen.getByRole('button', { name: /Analyze Promo/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Producer payback % must be between 0 and 100/i)).toBeInTheDocument();
      });
      expect(mockSubmit).not.toHaveBeenCalled();
    });

    it('validates retail price must be greater than 0', async () => {
      const user = userEvent.setup();
      render(
        <PromoDetailsForm
          availableVariants={['8oz']}
          latestCPUs={{ '8oz': '2.15' }}
          onSubmit={mockSubmit}
        />
      );

      const retailPriceInput = screen.getAllByLabelText(/Retail Price/i)[0];
      await user.type(retailPriceInput, '0');

      const submitButton = screen.getByRole('button', { name: /Analyze Promo/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/8oz: Retail price must be greater than 0/i)).toBeInTheDocument();
      });
      expect(mockSubmit).not.toHaveBeenCalled();
    });

    it('validates units available must be greater than 0', async () => {
      const user = userEvent.setup();
      render(
        <PromoDetailsForm
          availableVariants={['8oz']}
          latestCPUs={{ '8oz': '2.15' }}
          onSubmit={mockSubmit}
        />
      );

      const unitsInput = screen.getAllByLabelText(/Units Available/i)[0];
      await user.type(unitsInput, '-5');

      const submitButton = screen.getByRole('button', { name: /Analyze Promo/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/8oz: Units available must be greater than 0/i)).toBeInTheDocument();
      });
      expect(mockSubmit).not.toHaveBeenCalled();
    });
  });

  describe('Form Submission', () => {
    it('submits valid form data', async () => {
      const user = userEvent.setup();
      render(
        <PromoDetailsForm
          availableVariants={['8oz']}
          latestCPUs={{ '8oz': '2.15' }}
          onSubmit={mockSubmit}
        />
      );

      await user.type(screen.getByLabelText(/Promo Name/i), 'Summer Sale 2026');
      await user.type(screen.getByLabelText(/Retailer Name/i), 'Whole Foods');
      await user.type(screen.getByLabelText(/Store Sale %/i), '20');
      await user.type(screen.getByLabelText(/Producer Payback %/i), '10');
      await user.type(screen.getAllByLabelText(/Retail Price/i)[0], '10.00');
      await user.type(screen.getAllByLabelText(/Units Available/i)[0], '100');

      const submitButton = screen.getByRole('button', { name: /Analyze Promo/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalledWith({
          promoName: 'Summer Sale 2026',
          retailerName: 'Whole Foods',
          promoStartDate: '',
          promoEndDate: '',
          storeSalePercentage: '20',
          producerPaybackPercentage: '10',
          variants: {
            '8oz': {
              retailPrice: '10.00',
              unitsAvailable: '100',
              baseCPU: '2.15',
            },
          },
        });
      });
    });

    it('clears errors when user corrects invalid fields', async () => {
      const user = userEvent.setup();
      render(
        <PromoDetailsForm
          availableVariants={['8oz']}
          latestCPUs={{ '8oz': '2.15' }}
          onSubmit={mockSubmit}
        />
      );

      // Submit invalid form
      const submitButton = screen.getByRole('button', { name: /Analyze Promo/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Promo name is required/i)).toBeInTheDocument();
      });

      // Correct the field
      await user.type(screen.getByLabelText(/Promo Name/i), 'Summer Sale');

      // Error should be cleared
      await waitFor(() => {
        expect(screen.queryByText(/Promo name is required/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('disables submit button when loading', () => {
      render(
        <PromoDetailsForm
          availableVariants={availableVariants}
          latestCPUs={latestCPUs}
          onSubmit={mockSubmit}
          isLoading={true}
        />
      );

      const submitButton = screen.getByRole('button', { name: /Analyze Promo/i });
      expect(submitButton).toBeDisabled();
    });

    it('shows loading indicator on submit button when loading', () => {
      render(
        <PromoDetailsForm
          availableVariants={availableVariants}
          latestCPUs={latestCPUs}
          onSubmit={mockSubmit}
          isLoading={true}
        />
      );

      const submitButton = screen.getByRole('button', { name: /Analyze Promo/i });
      expect(submitButton).toHaveAttribute('aria-busy', 'true');
    });
  });

  describe('Initial Data', () => {
    it('populates form with initial data when provided', () => {
      const initialData = {
        promoName: 'Existing Promo',
        retailerName: 'Target',
        storeSalePercentage: '25',
        producerPaybackPercentage: '12.5',
      };

      render(
        <PromoDetailsForm
          availableVariants={availableVariants}
          latestCPUs={latestCPUs}
          onSubmit={mockSubmit}
          initialData={initialData}
        />
      );

      expect(screen.getByLabelText(/Promo Name/i)).toHaveValue('Existing Promo');
      expect(screen.getByLabelText(/Retailer Name/i)).toHaveValue('Target');
      expect(screen.getByLabelText(/Store Sale %/i)).toHaveValue(25);
      expect(screen.getByLabelText(/Producer Payback %/i)).toHaveValue(12.5);
    });
  });

  describe('Helper Text', () => {
    it('displays helper text for key fields', () => {
      render(
        <PromoDetailsForm
          availableVariants={availableVariants}
          latestCPUs={latestCPUs}
          onSubmit={mockSubmit}
        />
      );

      expect(screen.getByText(/Give this promo a memorable name/i)).toBeInTheDocument();
      expect(screen.getByText(/Which retailer is running this promotion/i)).toBeInTheDocument();
      expect(screen.getByText(/How much discount are customers getting/i)).toBeInTheDocument();
    });
  });
});
