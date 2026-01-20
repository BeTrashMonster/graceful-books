/**
 * Tests for ColumnMapper Component
 * Includes accessibility validation
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ColumnMapper } from './ColumnMapper';
import type { MappingSuggestion } from '../../types/csv.types';

describe('ColumnMapper Component', () => {
  const mockHeaders = ['Date', 'Amount', 'Description'];
  const mockSuggestions: MappingSuggestion[] = [
    { csvColumn: 'Date', suggestedField: 'Date', confidence: 1.0, alternativeSuggestions: [] },
    { csvColumn: 'Amount', suggestedField: 'Amount', confidence: 1.0, alternativeSuggestions: [] },
    { csvColumn: 'Description', suggestedField: 'Description', confidence: 0.8, alternativeSuggestions: [] },
  ];
  const mockAvailableFields = ['Date', 'Amount', 'Description', 'Account', 'Category', 'Notes'];
  const mockOnMappingsChange = vi.fn();

  describe('Rendering', () => {
    it('should render the component', () => {
      render(
        <ColumnMapper
          headers={mockHeaders}
          suggestions={mockSuggestions}
          entityType="transactions"
          availableFields={mockAvailableFields}
          onMappingsChange={mockOnMappingsChange}
        />
      );

      expect(screen.getByRole('heading', { name: /map csv columns to fields/i })).toBeInTheDocument();
    });

    it('should render table with headers', () => {
      render(
        <ColumnMapper
          headers={mockHeaders}
          suggestions={mockSuggestions}
          entityType="transactions"
          availableFields={mockAvailableFields}
          onMappingsChange={mockOnMappingsChange}
        />
      );

      expect(screen.getByRole('columnheader', { name: /csv column/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /maps to field/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /confidence/i })).toBeInTheDocument();
    });

    it('should render all CSV columns', () => {
      render(
        <ColumnMapper
          headers={mockHeaders}
          suggestions={mockSuggestions}
          entityType="transactions"
          availableFields={mockAvailableFields}
          onMappingsChange={mockOnMappingsChange}
        />
      );

      mockHeaders.forEach((header) => {
        expect(screen.getByText(header)).toBeInTheDocument();
      });
    });

    it('should render confidence badges', () => {
      render(
        <ColumnMapper
          headers={mockHeaders}
          suggestions={mockSuggestions}
          entityType="transactions"
          availableFields={mockAvailableFields}
          onMappingsChange={mockOnMappingsChange}
        />
      );

      expect(screen.getAllByText(/high confidence/i)).toHaveLength(2);
    });

    it('should show unmapped required fields warning', () => {
      const limitedSuggestions: MappingSuggestion[] = [
        { csvColumn: 'Date', suggestedField: 'Date', confidence: 1.0, alternativeSuggestions: [] },
      ];

      render(
        <ColumnMapper
          headers={['Date']}
          suggestions={limitedSuggestions}
          entityType="transactions"
          availableFields={mockAvailableFields}
          onMappingsChange={mockOnMappingsChange}
        />
      );

      // Should warn about unmapped Amount and Account
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/required fields not mapped/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible table structure', () => {
      render(
        <ColumnMapper
          headers={mockHeaders}
          suggestions={mockSuggestions}
          entityType="transactions"
          availableFields={mockAvailableFields}
          onMappingsChange={mockOnMappingsChange}
        />
      );

      const table = screen.getByRole('table');
      expect(table).toHaveAccessibleName();
    });

    it('should have labels for select dropdowns', () => {
      render(
        <ColumnMapper
          headers={mockHeaders}
          suggestions={mockSuggestions}
          entityType="transactions"
          availableFields={mockAvailableFields}
          onMappingsChange={mockOnMappingsChange}
        />
      );

      mockHeaders.forEach((header) => {
        expect(screen.getByLabelText(`Map ${header} to field`)).toBeInTheDocument();
      });
    });

    it('should announce mapping count with aria-live', () => {
      const { container } = render(
        <ColumnMapper
          headers={mockHeaders}
          suggestions={mockSuggestions}
          entityType="transactions"
          availableFields={mockAvailableFields}
          onMappingsChange={mockOnMappingsChange}
        />
      );

      const mappingCount = container.querySelector('[aria-live="polite"]');
      expect(mappingCount).toBeInTheDocument();
      expect(mappingCount).toHaveTextContent(/3 of 3 columns mapped/i);
    });

    it('should have role="alert" for warnings', () => {
      const limitedSuggestions: MappingSuggestion[] = [
        { csvColumn: 'Date', suggestedField: 'Date', confidence: 1.0, alternativeSuggestions: [] },
      ];

      render(
        <ColumnMapper
          headers={['Date']}
          suggestions={limitedSuggestions}
          entityType="transactions"
          availableFields={mockAvailableFields}
          onMappingsChange={mockOnMappingsChange}
        />
      );

      const warning = screen.getByRole('alert');
      expect(warning).toBeInTheDocument();
    });

    it('should have accessible checkbox for filter', () => {
      render(
        <ColumnMapper
          headers={mockHeaders}
          suggestions={mockSuggestions}
          entityType="transactions"
          availableFields={mockAvailableFields}
          onMappingsChange={mockOnMappingsChange}
        />
      );

      const checkbox = screen.getByLabelText(/show only unmapped columns/i);
      expect(checkbox).toBeInTheDocument();
      expect(checkbox).toHaveAttribute('type', 'checkbox');
    });
  });

  describe('Interaction', () => {
    it('should call onMappingsChange when initialized', () => {
      render(
        <ColumnMapper
          headers={mockHeaders}
          suggestions={mockSuggestions}
          entityType="transactions"
          availableFields={mockAvailableFields}
          onMappingsChange={mockOnMappingsChange}
        />
      );

      expect(mockOnMappingsChange).toHaveBeenCalled();
    });

    it('should change mapping when select is changed', () => {
      mockOnMappingsChange.mockClear();

      render(
        <ColumnMapper
          headers={mockHeaders}
          suggestions={mockSuggestions}
          entityType="transactions"
          availableFields={mockAvailableFields}
          onMappingsChange={mockOnMappingsChange}
        />
      );

      const select = screen.getByLabelText(/map date to field/i);
      fireEvent.change(select, { target: { value: 'Account' } });

      expect(mockOnMappingsChange).toHaveBeenCalled();
    });

    it('should allow unmapping a column', () => {
      mockOnMappingsChange.mockClear();

      render(
        <ColumnMapper
          headers={mockHeaders}
          suggestions={mockSuggestions}
          entityType="transactions"
          availableFields={mockAvailableFields}
          onMappingsChange={mockOnMappingsChange}
        />
      );

      const select = screen.getByLabelText(/map date to field/i);
      fireEvent.change(select, { target: { value: '' } });

      expect(mockOnMappingsChange).toHaveBeenCalled();
    });

    it('should filter to show only unmapped columns', () => {
      const { rerender: _rerender } = render(
        <ColumnMapper
          headers={mockHeaders}
          suggestions={mockSuggestions}
          entityType="transactions"
          availableFields={mockAvailableFields}
          onMappingsChange={mockOnMappingsChange}
        />
      );

      const checkbox = screen.getByLabelText(/show only unmapped columns/i);
      fireEvent.click(checkbox);

      // When all columns are mapped, should show empty state
      expect(screen.getByText(/all columns have been mapped/i)).toBeInTheDocument();
    });

    it('should display confidence levels correctly', () => {
      render(
        <ColumnMapper
          headers={mockHeaders}
          suggestions={mockSuggestions}
          entityType="transactions"
          availableFields={mockAvailableFields}
          onMappingsChange={mockOnMappingsChange}
        />
      );

      // High confidence (1.0)
      expect(screen.getAllByText(/high confidence/i)).toHaveLength(2);

      // Medium confidence (0.8)
      expect(screen.getByText(/medium confidence/i)).toBeInTheDocument();
    });

    it('should show help text', () => {
      render(
        <ColumnMapper
          headers={mockHeaders}
          suggestions={mockSuggestions}
          entityType="transactions"
          availableFields={mockAvailableFields}
          onMappingsChange={mockOnMappingsChange}
        />
      );

      expect(screen.getByText(/mapping tips/i)).toBeInTheDocument();
    });
  });

  describe('Confidence Indicators', () => {
    it('should show high confidence for exact matches', () => {
      render(
        <ColumnMapper
          headers={mockHeaders}
          suggestions={mockSuggestions}
          entityType="transactions"
          availableFields={mockAvailableFields}
          onMappingsChange={mockOnMappingsChange}
        />
      );

      const highConfidenceBadges = screen.getAllByText(/high confidence/i);
      expect(highConfidenceBadges.length).toBeGreaterThan(0);
    });

    it('should show medium confidence for partial matches', () => {
      const mediumSuggestions: MappingSuggestion[] = [
        { csvColumn: 'Amt', suggestedField: 'Amount', confidence: 0.7, alternativeSuggestions: [] },
      ];

      render(
        <ColumnMapper
          headers={['Amt']}
          suggestions={mediumSuggestions}
          entityType="transactions"
          availableFields={mockAvailableFields}
          onMappingsChange={mockOnMappingsChange}
        />
      );

      expect(screen.getByText(/medium confidence/i)).toBeInTheDocument();
    });

    it('should show low confidence for weak matches', () => {
      const lowSuggestions: MappingSuggestion[] = [
        { csvColumn: 'Unknown', suggestedField: 'Date', confidence: 0.5, alternativeSuggestions: [] },
      ];

      render(
        <ColumnMapper
          headers={['Unknown']}
          suggestions={lowSuggestions}
          entityType="transactions"
          availableFields={mockAvailableFields}
          onMappingsChange={mockOnMappingsChange}
        />
      );

      expect(screen.getByText(/low confidence/i)).toBeInTheDocument();
    });
  });
});
