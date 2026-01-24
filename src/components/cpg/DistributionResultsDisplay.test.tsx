import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DistributionResultsDisplay } from './DistributionResultsDisplay';
import type { DistributionCostResult } from '../../services/cpg/distributionCostCalculator.service';

const mockResults: DistributionCostResult = {
  distributorId: 'dist-1',
  totalDistributionCost: '406.00',
  distributionCostPerUnit: '0.35',
  variantResults: {
    '8oz': {
      total_cpu: '2.50',
      net_profit_margin: '67.76',
      margin_quality: 'better',
      msrp: '10.00',
    },
    '16oz': {
      total_cpu: '3.55',
      net_profit_margin: '72.50',
      margin_quality: 'best',
      msrp: '15.00',
    },
  },
  feeBreakdown: [
    { feeName: 'Pallet Cost', feeAmount: '81.00' },
    { feeName: 'Warehouse Services', feeAmount: '25.00' },
    { feeName: 'Pallet Build', feeAmount: '25.00' },
    { feeName: 'Floor Space - Full Day', feeAmount: '100.00' },
    { feeName: 'Truck Transfer - Zone 1', feeAmount: '100.00' },
    { feeName: 'Floor Space - Half Day', feeAmount: '50.00' },
    { feeName: 'Custom Fee - Special Handling', feeAmount: '25.00' },
  ],
};

describe('DistributionResultsDisplay', () => {
  describe('Rendering', () => {
    it('renders results title and description', () => {
      render(<DistributionResultsDisplay results={mockResults} />);

      expect(screen.getByText('Distribution Cost Analysis')).toBeInTheDocument();
      expect(
        screen.getByText('Calculated distribution costs and profit margins.')
      ).toBeInTheDocument();
    });

    it('renders total distribution cost', () => {
      render(<DistributionResultsDisplay results={mockResults} />);

      expect(screen.getByText('Total Distribution Cost')).toBeInTheDocument();
      expect(screen.getByText('$406.00')).toBeInTheDocument();
    });

    it('renders distribution cost per unit', () => {
      render(<DistributionResultsDisplay results={mockResults} />);

      expect(screen.getByText('Distribution Cost Per Unit')).toBeInTheDocument();
      expect(screen.getByText('$0.35')).toBeInTheDocument();
    });
  });

  describe('Variant Results', () => {
    it('renders all variant results', () => {
      render(<DistributionResultsDisplay results={mockResults} />);

      expect(screen.getByText('8oz')).toBeInTheDocument();
      expect(screen.getByText('16oz')).toBeInTheDocument();
    });

    it('renders total CPU for each variant', () => {
      render(<DistributionResultsDisplay results={mockResults} />);

      expect(screen.getByText('$2.50')).toBeInTheDocument();
      expect(screen.getByText('$3.55')).toBeInTheDocument();
    });

    it('renders profit margins for each variant', () => {
      render(<DistributionResultsDisplay results={mockResults} />);

      expect(screen.getByText('67.76%')).toBeInTheDocument();
      expect(screen.getByText('72.50%')).toBeInTheDocument();
    });

    it('renders MSRP when available', () => {
      render(<DistributionResultsDisplay results={mockResults} />);

      expect(screen.getAllByText(/MSRP/).length).toBeGreaterThan(0);
      expect(screen.getByText('$10.00')).toBeInTheDocument();
      expect(screen.getByText('$15.00')).toBeInTheDocument();
    });

    it('renders margin quality badges', () => {
      render(<DistributionResultsDisplay results={mockResults} />);

      expect(screen.getByText('Better')).toBeInTheDocument();
      expect(screen.getByText('Best')).toBeInTheDocument();
    });
  });

  describe('Fee Breakdown', () => {
    it('renders fee breakdown table', () => {
      render(<DistributionResultsDisplay results={mockResults} />);

      expect(screen.getByText('Fee Breakdown')).toBeInTheDocument();
      expect(screen.getByText('Pallet Cost')).toBeInTheDocument();
      expect(screen.getByText('Warehouse Services')).toBeInTheDocument();
    });

    it('renders all fees with amounts', () => {
      render(<DistributionResultsDisplay results={mockResults} />);

      mockResults.feeBreakdown.forEach((fee) => {
        expect(screen.getByText(fee.feeName)).toBeInTheDocument();
      });
    });

    it('renders total in fee breakdown', () => {
      render(<DistributionResultsDisplay results={mockResults} />);

      const totalRows = screen.getAllByText('Total');
      expect(totalRows.length).toBeGreaterThan(0);
    });

    it('shows empty state when no fees selected', () => {
      const resultsNoFees: DistributionCostResult = {
        ...mockResults,
        feeBreakdown: [],
      };

      render(<DistributionResultsDisplay results={resultsNoFees} />);

      expect(
        screen.getByText(/no fees selected/i)
      ).toBeInTheDocument();
    });
  });

  describe('Save Button', () => {
    it('renders save button when showSaveButton is true', () => {
      const onSave = vi.fn();

      render(
        <DistributionResultsDisplay
          results={mockResults}
          onSave={onSave}
          showSaveButton={true}
        />
      );

      expect(screen.getByRole('button', { name: /save calculation/i })).toBeInTheDocument();
    });

    it('does not render save button when showSaveButton is false', () => {
      render(
        <DistributionResultsDisplay
          results={mockResults}
          showSaveButton={false}
        />
      );

      expect(screen.queryByRole('button', { name: /save calculation/i })).not.toBeInTheDocument();
    });

    it('calls onSave when save button is clicked', () => {
      const onSave = vi.fn();

      render(
        <DistributionResultsDisplay
          results={mockResults}
          onSave={onSave}
          showSaveButton={true}
        />
      );

      const saveButton = screen.getByRole('button', { name: /save calculation/i });
      fireEvent.click(saveButton);

      expect(onSave).toHaveBeenCalled();
    });

    it('disables save button when saving', () => {
      const onSave = vi.fn();

      render(
        <DistributionResultsDisplay
          results={mockResults}
          onSave={onSave}
          showSaveButton={true}
          saving={true}
        />
      );

      const saveButton = screen.getByRole('button', { name: /save calculation/i });
      expect(saveButton).toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('has proper heading hierarchy', () => {
      render(<DistributionResultsDisplay results={mockResults} />);

      const h3 = screen.getByRole('heading', { level: 3, name: /distribution cost analysis/i });
      expect(h3).toBeInTheDocument();

      const h4s = screen.getAllByRole('heading', { level: 4 });
      expect(h4s.length).toBeGreaterThan(0);
    });

    it('renders variant names as headings', () => {
      render(<DistributionResultsDisplay results={mockResults} />);

      const variantHeadings = screen.getAllByRole('heading', { level: 5 });
      expect(variantHeadings.length).toBe(2);
    });
  });
});
