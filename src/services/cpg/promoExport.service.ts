/**
 * Promo Export Service
 *
 * Handles exporting promo tracker data in CSV and PDF formats.
 * Supports both summary (table view) and detail (full breakdown) exports.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { CPGSalesPromo } from '../../db/schema/cpg.schema';

interface ExportData {
  promoName: string;
  retailer: string;
  status: string;
  startDate: string;
  endDate: string;
  projectedPayback: string;
  actualPayback: string;
  variance: string;
  sellThrough: string;
  marginQuality: string;
}

interface DetailExportData extends ExportData {
  variants: Array<{
    name: string;
    unitsAvailable: string;
    actualUnitsSold: string;
    promoCostPerUnit: string;
    totalPromoCost: string;
    sellThrough: string;
  }>;
  demoWarriors: string;
  totalPromoCost: string;
  netProfitMargin: string;
  recommendation: string;
}

class PromoExportService {
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
      case 'approve':
        return 'Best';
      case 'consider':
        return 'Better';
      case 'caution':
      case 'decline':
        return 'Gut Check';
      default:
        return 'Good';
    }
  }

  /**
   * Check if promo has demo warriors
   */
  private hasDemoWarriors(promo: CPGSalesPromo): boolean {
    return !!(promo.demo_hours_entries && promo.demo_hours_entries.length > 0);
  }

  /**
   * Calculate total demo hours
   */
  private getTotalDemoHours(promo: CPGSalesPromo): number {
    if (!this.hasDemoWarriors(promo)) return 0;
    return promo.demo_hours_entries!.reduce((total, entry) => {
      return total + parseFloat(entry.hours || '0');
    }, 0);
  }

  /**
   * Calculate weighted average hourly rate
   */
  private getAverageHourlyRate(promo: CPGSalesPromo): number {
    if (!this.hasDemoWarriors(promo)) return 0;

    let totalHours = 0;
    let totalCost = 0;

    promo.demo_hours_entries!.forEach(entry => {
      const hours = parseFloat(entry.hours || '0');
      const rate = parseFloat(entry.hourly_rate || '0');
      totalHours += hours;
      totalCost += hours * rate;
    });

    return totalHours > 0 ? totalCost / totalHours : 0;
  }

  /**
   * Get paid demo labor cost (actual cost only)
   */
  private getPaidDemoLaborCost(promo: CPGSalesPromo): number {
    if (!this.hasDemoWarriors(promo)) return 0;
    return parseFloat(promo.total_actual_labor_cost || '0');
  }

  /**
   * Get sweat equity cost (opportunity cost only)
   */
  private getSweatEquityCost(promo: CPGSalesPromo): number {
    if (!this.hasDemoWarriors(promo)) return 0;
    return parseFloat(promo.total_opportunity_cost || '0');
  }

  /**
   * Get total demo labor cost (actual + opportunity)
   */
  private getTotalDemoLaborCost(promo: CPGSalesPromo): number {
    return this.getPaidDemoLaborCost(promo) + this.getSweatEquityCost(promo);
  }

  /**
   * Get aggregated net profit margin with demo from variants
   */
  private getNetProfitMarginWithDemo(promo: CPGSalesPromo): string {
    if (!promo.variant_promo_results) return '';

    // Get the first variant's margin with demo (they should all be the same)
    const firstVariant = Object.values(promo.variant_promo_results)[0];
    return firstVariant?.net_profit_margin_with_demo || '';
  }

  /**
   * Get aggregated net profit margin with promo (no demo) from variants
   */
  private getNetProfitMarginWithPromo(promo: CPGSalesPromo): string {
    if (!promo.variant_promo_results) return '';

    // Get the first variant's margin with promo (they should all be the same)
    const firstVariant = Object.values(promo.variant_promo_results)[0];
    return firstVariant?.net_profit_margin_with_promo || '';
  }

  /**
   * Calculate sell-through percentage
   */
  private calculateSellThrough(promo: CPGSalesPromo): string {
    if (!promo.actual_units_sold || !promo.variant_promo_data) return '0.0';

    const totalUnits = Object.values(promo.variant_promo_data).reduce((total, variant) => {
      return total + parseFloat(variant.units_available || '0');
    }, 0);

    if (totalUnits === 0) return '0.0';
    const sellThrough = (parseFloat(promo.actual_units_sold) / totalUnits) * 100;
    return sellThrough.toFixed(1);
  }

  /**
   * Calculate variance between projected and actual payback
   */
  private calculateVariance(promo: CPGSalesPromo, forCSV: boolean = false): string {
    if (!promo.actual_payback || promo.status !== 'completed') return forCSV ? '' : '—';
    const variance = parseFloat(promo.total_promo_cost) - parseFloat(promo.actual_payback);
    return this.formatCurrency(variance);
  }

  /**
   * Prepare summary data for export
   */
  private prepareSummaryData(promos: CPGSalesPromo[], forCSV: boolean = false): ExportData[] {
    const emptyValue = forCSV ? '' : '—';
    return promos.map(promo => {
      const isCompleted = promo.status === 'completed';
      return {
        promoName: promo.promo_name,
        retailer: promo.retailer_name || 'N/A',
        status: promo.status,
        startDate: this.formatDate(promo.promo_start_date),
        endDate: this.formatDate(promo.promo_end_date),
        projectedPayback: this.formatCurrency(promo.total_promo_cost),
        actualPayback: isCompleted && promo.actual_payback ? this.formatCurrency(promo.actual_payback) : emptyValue,
        variance: this.calculateVariance(promo, forCSV),
        sellThrough: isCompleted ? `${this.calculateSellThrough(promo)}%` : emptyValue,
        marginQuality: this.getMarginQualityText(promo.recommendation),
      };
    });
  }

  /**
   * Export summary data as CSV
   */
  exportSummaryCSV(promos: CPGSalesPromo[]): void {
    const data = this.prepareSummaryData(promos, true);

    // CSV Header
    const headers = [
      'Promo Name',
      'Retailer',
      'Status',
      'Start Date',
      'End Date',
      'Projected Payback',
      'Actual Payback',
      'Variance',
      'Sell-Through',
      'Margin Quality',
    ];

    // CSV Rows
    const rows = data.map(row => [
      row.promoName,
      row.retailer,
      row.status,
      row.startDate,
      row.endDate,
      row.projectedPayback,
      row.actualPayback,
      row.variance,
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
      `promo-tracker-summary-${new Date().toISOString().split('T')[0]}.csv`,
      'text/csv'
    );
  }

  /**
   * Export summary data as PDF
   */
  exportSummaryPDF(promos: CPGSalesPromo[]): void {
    const data = this.prepareSummaryData(promos);

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    // Title
    doc.setFontSize(18);
    doc.setTextColor(75, 0, 110); // Purple brand color
    doc.text('Promo Tracker - Summary Report', 14, 15);

    // Date
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128); // Gray
    doc.text(`Generated: ${new Date().toLocaleDateString('en-US')}`, 14, 22);

    // Table
    autoTable(doc, {
      startY: 28,
      head: [[
        'Promo Name',
        'Retailer',
        'Status',
        'Start Date',
        'End Date',
        'Projected\nPayback',
        'Actual\nPayback',
        'Variance',
        'Sell-\nThrough',
        'Margin\nQuality',
      ]],
      body: data.map(row => [
        row.promoName,
        row.retailer,
        row.status,
        row.startDate,
        row.endDate,
        row.projectedPayback,
        row.actualPayback,
        row.variance,
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
    doc.save(`promo-tracker-summary-${new Date().toISOString().split('T')[0]}.pdf`);
  }

  /**
   * Export detail data as CSV
   */
  exportDetailCSV(promos: CPGSalesPromo[]): void {
    // Build CSV with variant-level details
    const rows: string[] = [];

    // Add header
    rows.push([
      'Promo Name',
      'Retailer',
      'Status',
      'Start Date',
      'End Date',
      'Variant Name',
      'Units Available',
      'Actual Units Sold',
      'Variant Sell-Through %',
      'Promo Sellback Per Unit (excl. labor)',
      'Total Variant Promo Cost (excl. labor)',
      'Total Projected Payback (excl. labor)',
      'Total Actual Payback',
      'Total Variance',
      'Demo Warriors Used?',
      'Avg Demo Hourly Rate',
      'Total Demo Hours',
      'Paid Demo Labor Cost',
      'Sweat Equity Cost',
      'Total Demo Labor Cost',
      'Net Profit Margin % (excl. labor)',
      'Net Profit Margin % (with labor)',
      'Final Margin Quality',
      'Recommendation',
    ].map(h => `"${h}"`).join(','));

    // Add data rows
    promos.forEach(promo => {
      const isCompleted = promo.status === 'completed';
      const variants = promo.variant_promo_data ? Object.keys(promo.variant_promo_data) : [];
      const hasDemo = this.hasDemoWarriors(promo);

      // If no variants, add a single row with summary data
      if (variants.length === 0) {
        rows.push([
          promo.promo_name,
          promo.retailer_name || 'N/A',
          promo.status,
          this.formatDate(promo.promo_start_date),
          this.formatDate(promo.promo_end_date),
          '',
          '',
          '',
          '',
          '',
          '',
          this.formatCurrency(promo.total_promo_cost),
          isCompleted && promo.actual_payback ? this.formatCurrency(promo.actual_payback) : '',
          this.calculateVariance(promo, true),
          hasDemo ? 'Yes' : 'No',
          hasDemo ? this.formatCurrency(this.getAverageHourlyRate(promo)) : '',
          hasDemo ? this.getTotalDemoHours(promo).toString() : '',
          hasDemo ? this.formatCurrency(this.getPaidDemoLaborCost(promo)) : '',
          hasDemo ? this.formatCurrency(this.getSweatEquityCost(promo)) : '',
          hasDemo ? this.formatCurrency(this.getTotalDemoLaborCost(promo)) : '',
          this.getNetProfitMarginWithPromo(promo),
          hasDemo ? this.getNetProfitMarginWithDemo(promo) : '',
          this.getMarginQualityText(promo.recommendation),
          promo.recommendation || '',
        ].map(cell => `"${cell}"`).join(','));
      } else {
        // Add one row per variant
        variants.forEach((variantName, index) => {
          const variantData = promo.variant_promo_data![variantName];
          const variantResults = promo.variant_promo_results?.[variantName];
          const actualUnitsSold = promo.variant_actual_units_sold?.[variantName] || 0;
          const unitsAvailable = parseFloat(variantData.units_available || '0');
          const variantSellThrough = unitsAvailable > 0 && isCompleted ? ((actualUnitsSold / unitsAvailable) * 100).toFixed(1) : '';

          rows.push([
            index === 0 ? promo.promo_name : '',
            index === 0 ? (promo.retailer_name || 'N/A') : '',
            index === 0 ? promo.status : '',
            index === 0 ? this.formatDate(promo.promo_start_date) : '',
            index === 0 ? this.formatDate(promo.promo_end_date) : '',
            variantName,
            variantData.units_available || '0',
            isCompleted ? actualUnitsSold.toString() : '',
            variantSellThrough,
            variantResults?.sales_promo_cost_per_unit || '',
            variantResults ? this.formatCurrency(parseFloat(variantResults.sales_promo_cost_per_unit || '0') * parseFloat(variantData.units_available || '0')) : '',
            index === 0 ? this.formatCurrency(promo.total_promo_cost) : '',
            index === 0 && isCompleted && promo.actual_payback ? this.formatCurrency(promo.actual_payback) : '',
            index === 0 ? this.calculateVariance(promo, true) : '',
            index === 0 ? (hasDemo ? 'Yes' : 'No') : '',
            index === 0 && hasDemo ? this.formatCurrency(this.getAverageHourlyRate(promo)) : '',
            index === 0 && hasDemo ? this.getTotalDemoHours(promo).toString() : '',
            index === 0 && hasDemo ? this.formatCurrency(this.getPaidDemoLaborCost(promo)) : '',
            index === 0 && hasDemo ? this.formatCurrency(this.getSweatEquityCost(promo)) : '',
            index === 0 && hasDemo ? this.formatCurrency(this.getTotalDemoLaborCost(promo)) : '',
            index === 0 ? this.getNetProfitMarginWithPromo(promo) : '',
            index === 0 && hasDemo ? this.getNetProfitMarginWithDemo(promo) : '',
            index === 0 ? this.getMarginQualityText(promo.recommendation) : '',
            index === 0 ? (promo.recommendation || '') : '',
          ].map(cell => `"${cell}"`).join(','));
        });
      }
    });

    const csvContent = rows.join('\n');

    // Download
    this.downloadFile(
      csvContent,
      `promo-tracker-detail-${new Date().toISOString().split('T')[0]}.csv`,
      'text/csv'
    );
  }

  /**
   * Export detail data as PDF
   */
  exportDetailPDF(promos: CPGSalesPromo[]): void {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    let currentY = 15;

    promos.forEach((promo, promoIndex) => {
      // Add new page for each promo after the first
      if (promoIndex > 0) {
        doc.addPage();
        currentY = 15;
      }

      const hasDemo = this.hasDemoWarriors(promo);
      const isCompleted = promo.status === 'completed';

      // Promo Header
      doc.setFontSize(16);
      doc.setTextColor(75, 0, 110);
      doc.text(promo.promo_name, 14, currentY);
      currentY += 8;

      // Promo Summary
      doc.setFontSize(10);
      doc.setTextColor(55, 65, 81);

      const summary = [
        `Retailer: ${promo.retailer_name || 'N/A'}`,
        `Status: ${promo.status}`,
        `Date Range: ${this.formatDate(promo.promo_start_date)} - ${this.formatDate(promo.promo_end_date)}`,
        `Projected Payback (excl. labor): ${this.formatCurrency(promo.total_promo_cost)}`,
      ];

      if (isCompleted && promo.actual_payback) {
        summary.push(`Actual Payback: ${this.formatCurrency(promo.actual_payback)}`);
        summary.push(`Variance: ${this.calculateVariance(promo)}`);
        summary.push(`Sell-Through: ${this.calculateSellThrough(promo)}%`);
      }

      const marginWithPromo = this.getNetProfitMarginWithPromo(promo);
      summary.push(`Margin (excl. labor): ${marginWithPromo || 'N/A'}`);

      if (hasDemo) {
        const marginWithDemo = this.getNetProfitMarginWithDemo(promo);
        summary.push(`Margin (with labor): ${marginWithDemo || 'N/A'}`);
      }

      summary.push(`Quality: ${this.getMarginQualityText(promo.recommendation)}`);
      summary.push(`Recommendation: ${promo.recommendation || 'N/A'}`);

      summary.forEach(line => {
        doc.text(line, 14, currentY);
        currentY += 5;
      });

      // Demo Warriors Section (if applicable)
      if (hasDemo) {
        currentY += 2;
        doc.setFontSize(12);
        doc.setTextColor(75, 0, 110);
        doc.text('Demo Warrior Details', 14, currentY);
        currentY += 5;

        doc.setFontSize(10);
        doc.setTextColor(55, 65, 81);

        const paidLabor = this.getPaidDemoLaborCost(promo);
        const sweatEquity = this.getSweatEquityCost(promo);
        const totalLabor = this.getTotalDemoLaborCost(promo);

        const demoInfo = [
          `Average Hourly Rate: ${this.formatCurrency(this.getAverageHourlyRate(promo))}`,
          `Total Hours: ${this.getTotalDemoHours(promo)}`,
          `Paid Demo Labor Cost: ${this.formatCurrency(paidLabor)}`,
          `Sweat Equity Cost: ${this.formatCurrency(sweatEquity)}`,
          `Total Demo Labor Cost: ${this.formatCurrency(totalLabor)}`,
        ];

        demoInfo.forEach(line => {
          doc.text(line, 14, currentY);
          currentY += 5;
        });
      }

      currentY += 3;

      // Variant Details Table
      if (promo.variant_promo_data && Object.keys(promo.variant_promo_data).length > 0) {
        doc.setFontSize(12);
        doc.setTextColor(75, 0, 110);
        doc.text('Product Breakdown (Promo Costs Exclude Demo Labor)', 14, currentY);
        currentY += 5;

        const variants = Object.keys(promo.variant_promo_data);
        const variantRows = variants.map(variantName => {
          const variantData = promo.variant_promo_data![variantName];
          const variantResults = promo.variant_promo_results?.[variantName];
          const actualUnitsSold = promo.variant_actual_units_sold?.[variantName] || 0;
          const unitsAvailable = parseFloat(variantData.units_available || '0');
          const variantSellThrough = unitsAvailable > 0 && isCompleted ? ((actualUnitsSold / unitsAvailable) * 100).toFixed(1) : '';

          return [
            variantName,
            variantData.units_available || '0',
            isCompleted ? actualUnitsSold.toString() : '—',
            variantResults?.sales_promo_cost_per_unit || '—',
            isCompleted && variantSellThrough ? `${variantSellThrough}%` : '—',
          ];
        });

        autoTable(doc, {
          startY: currentY,
          head: [['Product', 'Units\nAvailable', 'Actual\nSold', 'Sellback\n/Unit', 'Sell-\nThrough']],
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
    doc.save(`promo-tracker-detail-${new Date().toISOString().split('T')[0]}.pdf`);
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

export const promoExportService = new PromoExportService();
