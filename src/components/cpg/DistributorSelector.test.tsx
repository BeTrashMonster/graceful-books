import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DistributorSelector } from './DistributorSelector';
import type { CPGDistributor } from '../../db/schema/cpg.schema';

const mockDistributors: CPGDistributor[] = [
  {
    id: 'dist-1',
    company_id: 'company-1',
    name: 'UNFI',
    description: 'United Natural Foods',
    contact_info: 'contact@unfi.com',
    fee_structure: {
      pallet_cost: '81.00',
      warehouse_services: '25.00',
      pallet_build: '25.00',
      floor_space_full_day: '100.00',
      floor_space_half_day: '50.00',
      truck_transfer_zone1: '100.00',
      truck_transfer_zone2: '160.00',
      custom_fees: null,
    },
    active: true,
    created_at: Date.now(),
    updated_at: Date.now(),
    deleted_at: null,
    version_vector: { 'device-1': 1 },
  },
  {
    id: 'dist-2',
    company_id: 'company-1',
    name: 'KeHE',
    description: 'KeHE Distributors',
    contact_info: 'contact@kehe.com',
    fee_structure: {
      pallet_cost: '75.00',
      warehouse_services: '20.00',
      pallet_build: '20.00',
      floor_space_full_day: '90.00',
      floor_space_half_day: '45.00',
      truck_transfer_zone1: '95.00',
      truck_transfer_zone2: '150.00',
      custom_fees: null,
    },
    active: true,
    created_at: Date.now(),
    updated_at: Date.now(),
    deleted_at: null,
    version_vector: { 'device-1': 1 },
  },
];

describe('DistributorSelector', () => {
  describe('Rendering', () => {
    it('renders distributor dropdown', () => {
      const onSelect = vi.fn();
      const onAddNew = vi.fn();

      render(
        <DistributorSelector
          distributors={mockDistributors}
          selectedDistributorId={null}
          onSelect={onSelect}
          onAddNew={onAddNew}
        />
      );

      expect(screen.getByLabelText('Distributor')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add new distributor/i })).toBeInTheDocument();
    });

    it('renders "Add New Distributor" button', () => {
      const onSelect = vi.fn();
      const onAddNew = vi.fn();

      render(
        <DistributorSelector
          distributors={mockDistributors}
          selectedDistributorId={null}
          onSelect={onSelect}
          onAddNew={onAddNew}
        />
      );

      expect(screen.getByRole('button', { name: /add new distributor/i })).toBeInTheDocument();
    });

    it('displays empty state when no distributors', () => {
      const onSelect = vi.fn();
      const onAddNew = vi.fn();

      render(
        <DistributorSelector
          distributors={[]}
          selectedDistributorId={null}
          onSelect={onSelect}
          onAddNew={onAddNew}
        />
      );

      expect(screen.getByRole('status')).toHaveTextContent(
        /no distributors found/i
      );
    });
  });

  describe('Interactions', () => {
    it('calls onSelect when distributor is selected', () => {
      const onSelect = vi.fn();
      const onAddNew = vi.fn();

      render(
        <DistributorSelector
          distributors={mockDistributors}
          selectedDistributorId={null}
          onSelect={onSelect}
          onAddNew={onAddNew}
        />
      );

      const select = screen.getByLabelText('Distributor') as HTMLSelectElement;
      fireEvent.change(select, { target: { value: 'dist-1' } });

      expect(onSelect).toHaveBeenCalledWith('dist-1');
    });

    it('calls onAddNew when "Add New Distributor" button is clicked', () => {
      const onSelect = vi.fn();
      const onAddNew = vi.fn();

      render(
        <DistributorSelector
          distributors={mockDistributors}
          selectedDistributorId={null}
          onSelect={onSelect}
          onAddNew={onAddNew}
        />
      );

      const addButton = screen.getByRole('button', { name: /add new distributor/i });
      fireEvent.click(addButton);

      expect(onAddNew).toHaveBeenCalled();
    });
  });

  describe('Loading State', () => {
    it('disables select when loading', () => {
      const onSelect = vi.fn();
      const onAddNew = vi.fn();

      render(
        <DistributorSelector
          distributors={mockDistributors}
          selectedDistributorId={null}
          onSelect={onSelect}
          onAddNew={onAddNew}
          loading={true}
        />
      );

      const select = screen.getByLabelText('Distributor');
      expect(select).toBeDisabled();
    });

    it('disables "Add New" button when loading', () => {
      const onSelect = vi.fn();
      const onAddNew = vi.fn();

      render(
        <DistributorSelector
          distributors={mockDistributors}
          selectedDistributorId={null}
          onSelect={onSelect}
          onAddNew={onAddNew}
          loading={true}
        />
      );

      const addButton = screen.getByRole('button', { name: /add new distributor/i });
      expect(addButton).toBeDisabled();
    });
  });

  describe('Disabled State', () => {
    it('disables select when disabled', () => {
      const onSelect = vi.fn();
      const onAddNew = vi.fn();

      render(
        <DistributorSelector
          distributors={mockDistributors}
          selectedDistributorId={null}
          onSelect={onSelect}
          onAddNew={onAddNew}
          disabled={true}
        />
      );

      const select = screen.getByLabelText('Distributor');
      expect(select).toBeDisabled();
    });
  });

  describe('Active Distributors Filtering', () => {
    it('only shows active distributors', () => {
      const distributorsWithInactive: CPGDistributor[] = [
        ...mockDistributors,
        {
          ...mockDistributors[0],
          id: 'dist-3',
          name: 'Inactive Distributor',
          active: false,
        },
      ];

      const onSelect = vi.fn();
      const onAddNew = vi.fn();

      render(
        <DistributorSelector
          distributors={distributorsWithInactive}
          selectedDistributorId={null}
          onSelect={onSelect}
          onAddNew={onAddNew}
        />
      );

      const select = screen.getByLabelText('Distributor') as HTMLSelectElement;
      const options = Array.from(select.options).map((opt) => opt.text);

      expect(options).toContain('UNFI');
      expect(options).toContain('KeHE');
      expect(options).not.toContain('Inactive Distributor');
    });
  });
});
