/**
 * Event Export Service
 *
 * Handles exporting event tracker data in CSV and PDF formats.
 * Supports both summary (table view) and detail (full breakdown) exports.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { CPGEvent } from '../../db/schema/cpg.schema';

interface ExportData {
  eventName: string;
  location: string;
  date: string;
  status: string;
  totalCost: string;
  revenue: string;
  profit: string;
  roi: string;
  sellThrough: string;
  marginQuality: string;
}

interface DetailExportData extends ExportData {
  variants: Array<{
    name: string;
    unitsBrought: string;
    unitsSold: string;
    unitsDamaged: string;
    unitsDemo: string;
    variantRevenue: string;
    sellThrough: string;
  }>;
  laborCosts: string;
  totalLaborCost: string;
  recommendation: string;
}

class EventExportService {
  /**
   * Format date for display
   */
  private formatDate(timestamp: number | undefined | null): string {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  /**
   * Format date range for display
   */
  private formatDateRange(startDate: number, endDate: number): string {
    const start = this.formatDate(startDate);
    const end = this.formatDate(endDate);
    return startDate === endDate ? start : `${start} - ${end}`;
  }

  /**
   * Format currency for display
   */
  private formatCurrency(value: string | number | undefined | null): string {
    if (value === undefined || value === null || value === '') return '$0.00';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num);
  }

  /**
   * Get margin quality text from recommendation
   */
  private getMarginQualityText(recommendation: string | undefined): string {
    if (!recommendation) return 'N/A';
    switch (recommendation) {
      case 'participate':
        return 'Best';
      case 'neutral':
        return 'Good';
      case 'decline':
        return 'Gut Check';
      default:
        return 'Good';
    }
  }

  /**
   * Check if event has labor entries
   */
  private hasLaborEntries(event: CPGEvent): boolean {
    return !!(event.labor_entries && event.labor_entries.length > 0);
  }

  /**
   * Calculate total units brought to event
   */
  private getTotalUnitsBrought(event: CPGEvent): number {
    if (!event.variant_event_data) return 0;
    return Object.values(event.variant_event_data).reduce((total, variant) => {
      return total + parseFloat(variant.units_bringing || '0');
    }, 0);
  }

  /**
   * Calculate total units sold
   */
  private getTotalUnitsSold(event: CPGEvent): number {
    if (!event.variant_actual_units_sold) return 0;
    return Object.values(event.variant_actual_units_sold).reduce((total, units) => {
      return total + units;
    }, 0);
  }

  /**
   * Calculate sell-through percentage
   */
  private calculateSellThrough(event: CPGEvent): string {
    const totalBrought = this.getTotalUnitsBrought(event);
    const totalSold = this.getTotalUnitsSold(event);

    if (totalBrought === 0) return '0.0';
    const sellThrough = (totalSold / totalBrought) * 100;
    return sellThrough.toFixed(1);
  }

  /**
   * Get paid labor cost (actual cost only)
   */
  private getPaidLaborCost(event: CPGEvent): number {
    if (!this.hasLaborEntries(event)) return 0;
    return parseFloat(event.total_actual_labor_cost || '0');
  }

  /**
   * Get sweat equity cost (opportunity cost only)
   */
  private getSweatEquityCost(event: CPGEvent): number {
    if (!this.hasLaborEntries(event)) return 0;
    return parseFloat(event.total_opportunity_cost || '0');
  }

  /**
   * Get total labor cost (actual + opportunity)
   */
  private getTotalLaborCost(event: CPGEvent): number {
    return this.getPaidLaborCost(event) + this.getSweatEquityCost(event);
  }

  /**
   * Prepare summary data for export
   */
  private prepareSummaryData(events: CPGEvent[], forCSV: boolean = false): ExportData[] {
    const emptyValue = forCSV ? '' : '—';
    return events.map(event => {
      const isCompleted = event.status === 'completed';
      return {
        eventName: event.event_name,
        location: event.location || 'N/A',
        date: this.formatDateRange(event.event_start_date, event.event_end_date),
        status: event.status,
        totalCost: this.formatCurrency(event.total_event_cost),
        revenue: isCompleted && event.actual_total_revenue ? this.formatCurrency(event.actual_total_revenue) : emptyValue,
        profit: isCompleted && event.actual_total_profit ? this.formatCurrency(event.actual_total_profit) : emptyValue,
        roi: isCompleted && event.actual_roi ? `${parseFloat(event.actual_roi).toFixed(1)}%` : emptyValue,
        sellThrough: isCompleted ? `${this.calculateSellThrough(event)}%` : emptyValue,
        marginQuality: this.getMarginQualityText(event.recommendation),
      };
    });
  }

  /**
   * Export summary data as CSV
   */
  exportSummaryCSV(events: CPGEvent[]): void {
    const data = this.prepareSummaryData(events, true);

    // CSV Header
    const headers = [
      'Event Name',
      'Location',
      'Date',
      'Status',
      'Total Cost',
      'Revenue',
      'Profit',
      'ROI',
      'Sell-Through',
      'Margin Quality',
    ];

    // CSV Rows
    const rows = data.map(row => [
      row.eventName,
      row.location,
      row.date,
      row.status,
      row.totalCost,
      row.revenue,
      row.profit,
      row.roi,
      row.sellThrough,
      row.marginQuality,
    ]);

    // Build CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    // Download
    this.downloadFile(
      csvContent,
      `event-tracker-summary-${new Date().toISOString().split('T')[0]}.csv`,
      'text/csv'
    );
  }

  /**
   * Export summary data as PDF
   */
  exportSummaryPDF(events: CPGEvent[]): void {
    const data = this.prepareSummaryData(events);

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    // Title
    doc.setFontSize(18);
    doc.setTextColor(75, 0, 110); // Purple brand color
    doc.text('Event Tracker - Summary Report', 14, 15);

    // Date
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128); // Gray
    doc.text(`Generated: ${new Date().toLocaleDateString('en-US')}`, 14, 22);

    // Table
    autoTable(doc, {
      startY: 28,
      head: [[
        'Event Name',
        'Location',
        'Date',
        'Status',
        'Total\nCost',
        'Revenue',
        'Profit',
        'ROI',
        'Sell-\nThrough',
        'Margin\nQuality',
      ]],
      body: data.map(row => [
        row.eventName,
        row.location,
        row.date,
        row.status,
        row.totalCost,
        row.revenue,
        row.profit,
        row.roi,
        row.sellThrough,
        row.marginQuality,
      ]),
      styles: {
        fontSize: 8,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [75, 0, 110], // Purple brand color
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251],
      },
      margin: { top: 28, left: 14, right: 14 },
    });

    // Save
    doc.save(`event-tracker-summary-${new Date().toISOString().split('T')[0]}.pdf`);
  }

  /**
   * Export detail data as CSV
   */
  exportDetailCSV(events: CPGEvent[]): void {
    // Build CSV with variant-level details
    const rows: string[] = [];

    // Add header
    rows.push([
      'Event Name',
      'Location',
      'Status',
      'Date Range',
      'Variant Name',
      'Units Brought',
      'Units Sold',
      'Units Damaged',
      'Units Demo',
      'Variant Sell-Through %',
      'Variant Revenue',
      'Total Event Cost',
      'Total Revenue',
      'Total Profit',
      'ROI %',
      'Labor Used?',
      'Paid Labor Cost',
      'Sweat Equity Cost',
      'Total Labor Cost',
      'Final Margin Quality',
      'Recommendation',
    ].map(h => `"${h}"`).join(','));

    // Add data rows
    events.forEach(event => {
      const isCompleted = event.status === 'completed';
      const variants = event.variant_event_data ? Object.keys(event.variant_event_data) : [];
      const hasLabor = this.hasLaborEntries(event);

      // If no variants, add a single row with summary data
      if (variants.length === 0) {
        rows.push([
          event.event_name,
          event.location || 'N/A',
          event.status,
          this.formatDateRange(event.event_start_date, event.event_end_date),
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          this.formatCurrency(event.total_event_cost),
          isCompleted && event.actual_total_revenue ? this.formatCurrency(event.actual_total_revenue) : '',
          isCompleted && event.actual_total_profit ? this.formatCurrency(event.actual_total_profit) : '',
          isCompleted && event.actual_roi ? event.actual_roi : '',
          hasLabor ? 'Yes' : 'No',
          hasLabor ? this.formatCurrency(this.getPaidLaborCost(event)) : '',
          hasLabor ? this.formatCurrency(this.getSweatEquityCost(event)) : '',
          hasLabor ? this.formatCurrency(this.getTotalLaborCost(event)) : '',
          this.getMarginQualityText(event.recommendation),
          event.recommendation || '',
        ].map(cell => `"${cell}"`).join(','));
      } else {
        // Add one row per variant
        variants.forEach((variantName, index) => {
          const variantData = event.variant_event_data![variantName];
          const unitsSold = event.variant_actual_units_sold?.[variantName] || 0;
          const unitsDamaged = event.variant_units_damaged?.[variantName] || 0;
          const unitsDemo = event.variant_units_demo?.[variantName] || 0;
          const unitsBrought = parseFloat(variantData.units_bringing || '0');
          const retailPrice = parseFloat(variantData.retail_price || '0');
          const variantRevenue = unitsSold * retailPrice;
          const variantSellThrough = unitsBrought > 0 && isCompleted ? ((unitsSold / unitsBrought) * 100).toFixed(1) : '';

          rows.push([
            index === 0 ? event.event_name : '',
            index === 0 ? (event.location || 'N/A') : '',
            index === 0 ? event.status : '',
            index === 0 ? this.formatDateRange(event.event_start_date, event.event_end_date) : '',
            variantName,
            unitsBrought.toString(),
            isCompleted ? unitsSold.toString() : '',
            isCompleted ? unitsDamaged.toString() : '',
            isCompleted ? unitsDemo.toString() : '',
            variantSellThrough,
            isCompleted ? this.formatCurrency(variantRevenue) : '',
            index === 0 ? this.formatCurrency(event.total_event_cost) : '',
            index === 0 && isCompleted && event.actual_total_revenue ? this.formatCurrency(event.actual_total_revenue) : '',
            index === 0 && isCompleted && event.actual_total_profit ? this.formatCurrency(event.actual_total_profit) : '',
            index === 0 && isCompleted && event.actual_roi ? event.actual_roi : '',
            index === 0 ? (hasLabor ? 'Yes' : 'No') : '',
            index === 0 && hasLabor ? this.formatCurrency(this.getPaidLaborCost(event)) : '',
            index === 0 && hasLabor ? this.formatCurrency(this.getSweatEquityCost(event)) : '',
            index === 0 && hasLabor ? this.formatCurrency(this.getTotalLaborCost(event)) : '',
            index === 0 ? this.getMarginQualityText(event.recommendation) : '',
            index === 0 ? (event.recommendation || '') : '',
          ].map(cell => `"${cell}"`).join(','));
        });
      }
    });

    const csvContent = rows.join('\n');

    // Download
    this.downloadFile(
      csvContent,
      `event-tracker-detail-${new Date().toISOString().split('T')[0]}.csv`,
      'text/csv'
    );
  }

  /**
   * Export detail data as PDF
   */
  exportDetailPDF(events: CPGEvent[]): void {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    let currentY = 15;

    events.forEach((event, eventIndex) => {
      // Add new page for each event after the first
      if (eventIndex > 0) {
        doc.addPage();
        currentY = 15;
      }

      const hasLabor = this.hasLaborEntries(event);
      const isCompleted = event.status === 'completed';

      // Event Header
      doc.setFontSize(16);
      doc.setTextColor(75, 0, 110);
      doc.text(event.event_name, 14, currentY);
      currentY += 8;

      // Event Summary
      doc.setFontSize(10);
      doc.setTextColor(55, 65, 81);

      const summary = [
        `Location: ${event.location || 'N/A'}`,
        `Status: ${event.status}`,
        `Date: ${this.formatDateRange(event.event_start_date, event.event_end_date)}`,
        `Total Event Cost: ${this.formatCurrency(event.total_event_cost)}`,
      ];

      if (isCompleted) {
        if (event.actual_total_revenue) {
          summary.push(`Total Revenue: ${this.formatCurrency(event.actual_total_revenue)}`);
        }
        if (event.actual_total_profit) {
          summary.push(`Net Profit: ${this.formatCurrency(event.actual_total_profit)}`);
        }
        if (event.actual_roi) {
          summary.push(`ROI: ${parseFloat(event.actual_roi).toFixed(1)}%`);
        }
        summary.push(`Sell-Through: ${this.calculateSellThrough(event)}%`);
      }

      summary.push(`Quality: ${this.getMarginQualityText(event.recommendation)}`);
      summary.push(`Recommendation: ${event.recommendation || 'N/A'}`);

      summary.forEach(line => {
        doc.text(line, 14, currentY);
        currentY += 5;
      });

      // Labor Section (if applicable)
      if (hasLabor) {
        currentY += 2;
        doc.setFontSize(12);
        doc.setTextColor(75, 0, 110);
        doc.text('Labor Costs', 14, currentY);
        currentY += 5;

        doc.setFontSize(10);
        doc.setTextColor(55, 65, 81);

        const paidLabor = this.getPaidLaborCost(event);
        const sweatEquity = this.getSweatEquityCost(event);
        const totalLabor = this.getTotalLaborCost(event);

        const laborInfo = [
          `Paid Labor Cost: ${this.formatCurrency(paidLabor)}`,
          `Sweat Equity Cost: ${this.formatCurrency(sweatEquity)}`,
          `Total Labor Cost: ${this.formatCurrency(totalLabor)}`,
        ];

        laborInfo.forEach(line => {
          doc.text(line, 14, currentY);
          currentY += 5;
        });
      }

      currentY += 3;

      // Variant Details Table
      if (event.variant_event_data && Object.keys(event.variant_event_data).length > 0) {
        doc.setFontSize(12);
        doc.setTextColor(75, 0, 110);
        doc.text('Product Breakdown', 14, currentY);
        currentY += 5;

        const variants = Object.keys(event.variant_event_data);
        const variantRows = variants.map(variantName => {
          const variantData = event.variant_event_data![variantName];
          const unitsSold = event.variant_actual_units_sold?.[variantName] || 0;
          const unitsDamaged = event.variant_units_damaged?.[variantName] || 0;
          const unitsDemo = event.variant_units_demo?.[variantName] || 0;
          const unitsBrought = parseFloat(variantData.units_bringing || '0');
          const retailPrice = parseFloat(variantData.retail_price || '0');
          const variantRevenue = unitsSold * retailPrice;
          const variantSellThrough = unitsBrought > 0 && isCompleted ? ((unitsSold / unitsBrought) * 100).toFixed(1) : '';

          return [
            variantName,
            unitsBrought.toString(),
            isCompleted ? unitsSold.toString() : '—',
            isCompleted ? unitsDamaged.toString() : '—',
            isCompleted ? unitsDemo.toString() : '—',
            isCompleted ? this.formatCurrency(variantRevenue) : '—',
            isCompleted && variantSellThrough ? `${variantSellThrough}%` : '—',
          ];
        });

        autoTable(doc, {
          startY: currentY,
          head: [['Product', 'Brought', 'Sold', 'Damaged', 'Demo', 'Revenue', 'Sell-\nThrough']],
          body: variantRows,
          styles: {
            fontSize: 9,
            cellPadding: 2,
          },
          headStyles: {
            fillColor: [75, 0, 110],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
          },
          alternateRowStyles: {
            fillColor: [249, 250, 251],
          },
          margin: { left: 14, right: 14 },
        });
      }
    });

    // Save
    doc.save(`event-tracker-detail-${new Date().toISOString().split('T')[0]}.pdf`);
  }

  /**
   * Helper to download file
   */
  private downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export const eventExportService = new EventExportService();
