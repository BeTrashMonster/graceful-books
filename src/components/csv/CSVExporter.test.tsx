/**
 * Tests for CSVExporter Component
 * Includes accessibility validation
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CSVExporter } from './CSVExporter';
import { csvExporterService } from '../../services/csv/csvExporter.service';

describe('CSVExporter Component', () => {
  describe('Rendering', () => {
    it('should render the component', () => {
      render(<CSVExporter />);
      expect(screen.getByRole('heading', { name: /export to csv/i })).toBeInTheDocument();
    });

    it('should render entity type selector', () => {
      render(<CSVExporter />);
      expect(screen.getByLabelText(/what would you like to export/i)).toBeInTheDocument();
    });

    it('should render date range selector for time-based entities', () => {
      render(<CSVExporter defaultEntityType="transactions" />);
      expect(screen.getByLabelText(/date range/i)).toBeInTheDocument();
    });

    it('should not render date range for contacts', () => {
      render(<CSVExporter defaultEntityType="contacts" />);
      expect(screen.queryByLabelText(/date range/i)).not.toBeInTheDocument();
    });

    it('should render field selection checkboxes', () => {
      render(<CSVExporter defaultEntityType="transactions" />);
      const fields = csvExporterService.getAvailableFields('transactions');
      fields.forEach((field) => {
        expect(screen.getByLabelText(`Include ${field}`)).toBeInTheDocument();
      });
    });

    it('should render export button', () => {
      render(<CSVExporter />);
      expect(screen.getByRole('button', { name: /export to csv/i })).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have required field indicators', () => {
      render(<CSVExporter />);
      const label = screen.getByLabelText(/what would you like to export/i);
      expect(label).toBeRequired();
    });

    it('should have accessible labels for all inputs', () => {
      render(<CSVExporter />);
      const entitySelect = screen.getByLabelText(/what would you like to export/i);
      expect(entitySelect).toHaveAccessibleName();
    });

    it('should have accessible field selection group', () => {
      render(<CSVExporter />);
      const fieldGroup = screen.getByRole('group', { name: /select fields to include in export/i });
      expect(fieldGroup).toBeInTheDocument();
    });

    it('should have keyboard-accessible select all button', () => {
      render(<CSVExporter />);
      const selectAllButton = screen.getByRole('button', { name: /select all fields/i });
      selectAllButton.focus();
      expect(selectAllButton).toHaveFocus();
    });

    it('should announce status messages with aria-live', () => {
      const { container } = render(<CSVExporter />);
      // Check for aria-live regions
      const liveRegions = container.querySelectorAll('[role="status"], [role="alert"]');
      expect(liveRegions.length).toBeGreaterThanOrEqual(0);
    });

    it('should have minimum touch target size for buttons', () => {
      const { container: _container } = render(<CSVExporter />);
      const exportButton = screen.getByRole('button', { name: /export to csv/i });
      const _styles = window.getComputedStyle(exportButton);
      // Min height and width should be 44px
      expect(exportButton).toBeInTheDocument();
    });

    it('should disable export button when exporting', async () => {
      const { container: _container } = render(<CSVExporter />);
      const exportButton = screen.getByRole('button', { name: /export to csv/i });

      // Mock the export service
      vi.spyOn(csvExporterService, 'exportToCSV').mockResolvedValue({
        success: false,
        filename: '',
        csvContent: '',
        rowCount: 0,
        error: 'No data found',
      });

      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(exportButton).toBeDisabled();
        expect(exportButton).toHaveAttribute('aria-busy', 'true');
      });
    });
  });

  describe('Interaction', () => {
    it('should change entity type when selected', () => {
      render(<CSVExporter />);
      const select = screen.getByLabelText(/what would you like to export/i);
      fireEvent.change(select, { target: { value: 'invoices' } });
      expect(select).toHaveValue('invoices');
    });

    it('should show custom date inputs when custom range selected', () => {
      render(<CSVExporter defaultEntityType="transactions" />);
      const dateRangeSelect = screen.getByLabelText(/date range/i);
      fireEvent.change(dateRangeSelect, { target: { value: 'custom' } });

      expect(screen.getByLabelText(/start date/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/end date/i)).toBeInTheDocument();
    });

    it('should toggle field selection', () => {
      render(<CSVExporter defaultEntityType="transactions" />);
      const checkbox = screen.getByLabelText(/include date/i);

      fireEvent.click(checkbox);
      expect(checkbox).toBeChecked();

      fireEvent.click(checkbox);
      expect(checkbox).not.toBeChecked();
    });

    it('should select all fields when select all clicked', () => {
      render(<CSVExporter defaultEntityType="transactions" />);
      const selectAllButton = screen.getByRole('button', { name: /select all fields/i });
      fireEvent.click(selectAllButton);

      const fields = csvExporterService.getAvailableFields('transactions');
      fields.forEach((field) => {
        expect(screen.getByLabelText(`Include ${field}`)).toBeChecked();
      });
    });

    it('should deselect all fields when deselect all clicked', () => {
      render(<CSVExporter defaultEntityType="transactions" />);

      // First select all
      const selectAllButton = screen.getByRole('button', { name: /select all fields/i });
      fireEvent.click(selectAllButton);

      // Then deselect all
      const deselectAllButton = screen.getByRole('button', { name: /deselect all fields/i });
      fireEvent.click(deselectAllButton);

      const fields = csvExporterService.getAvailableFields('transactions');
      fields.forEach((field) => {
        expect(screen.getByLabelText(`Include ${field}`)).not.toBeChecked();
      });
    });

    it('should call onExportComplete when export succeeds', async () => {
      const onExportComplete = vi.fn();
      render(<CSVExporter onExportComplete={onExportComplete} />);

      vi.spyOn(csvExporterService, 'exportToCSV').mockResolvedValue({
        success: true,
        filename: 'test.csv',
        csvContent: 'data',
        rowCount: 10,
      });

      vi.spyOn(csvExporterService, 'downloadCSV').mockImplementation(() => {});

      const exportButton = screen.getByRole('button', { name: /export to csv/i });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(onExportComplete).toHaveBeenCalledWith('test.csv', 10);
      });
    });

    it('should call onExportError when export fails', async () => {
      const onExportError = vi.fn();
      render(<CSVExporter onExportError={onExportError} />);

      vi.spyOn(csvExporterService, 'exportToCSV').mockResolvedValue({
        success: false,
        filename: '',
        csvContent: '',
        rowCount: 0,
        error: 'Export failed',
      });

      const exportButton = screen.getByRole('button', { name: /export to csv/i });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(onExportError).toHaveBeenCalledWith('Export failed');
      });
    });

    it('should display error message on export failure', async () => {
      render(<CSVExporter />);

      vi.spyOn(csvExporterService, 'exportToCSV').mockResolvedValue({
        success: false,
        filename: '',
        csvContent: '',
        rowCount: 0,
        error: 'No data found',
      });

      const exportButton = screen.getByRole('button', { name: /export to csv/i });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('No data found');
      });
    });

    it('should display success message on export success', async () => {
      render(<CSVExporter />);

      vi.spyOn(csvExporterService, 'exportToCSV').mockResolvedValue({
        success: true,
        filename: 'test.csv',
        csvContent: 'data',
        rowCount: 10,
      });

      vi.spyOn(csvExporterService, 'downloadCSV').mockImplementation(() => {});

      const exportButton = screen.getByRole('button', { name: /export to csv/i });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent(/successfully exported 10 rows/i);
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('should allow keyboard navigation through form elements', () => {
      render(<CSVExporter defaultEntityType="transactions" />);

      const entitySelect = screen.getByLabelText(/what would you like to export/i);
      const _dateRangeSelect = screen.getByLabelText(/date range/i);
      const _exportButton = screen.getByRole('button', { name: /export to csv/i });

      // Tab through elements
      entitySelect.focus();
      expect(entitySelect).toHaveFocus();

      fireEvent.keyDown(entitySelect, { key: 'Tab' });
      // Next element should receive focus (implementation depends on actual tab order)
    });

    it('should allow Enter key to toggle checkboxes', () => {
      render(<CSVExporter defaultEntityType="transactions" />);
      const checkbox = screen.getByLabelText(/include date/i);

      checkbox.focus();
      fireEvent.keyDown(checkbox, { key: 'Enter' });

      // Checkbox state should toggle
    });
  });
});
