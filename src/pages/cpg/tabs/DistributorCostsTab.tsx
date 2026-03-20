/**
 * Distributor Costs Tab
 *
 * Displays historical distributor cost trends with comparison capabilities.
 * Includes statistics, charts, calculation history table, and export functionality.
 *
 * Features:
 * - Single distributor cost trend analysis
 * - Side-by-side distributor comparison
 * - Interactive charts (trend lines and bars)
 * - Calculation history table with customizable columns
 * - Export to CSV and PDF (summary, detailed, and data table formats)
 * - Date range filtering
 * - Draft inclusion toggle
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ComposedChart,
  Line,
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { db } from '../../../db';
import {
  createHistoricalAnalyticsService,
  type DateRangePreset,
  type DistributorCostTrend,
} from '../../../services/cpg/historicalAnalytics.service';
import type { CPGDistributor } from '../../../db/schema/cpg.schema';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import styles from '../Distribution.module.css';

interface DistributorCostsTabProps {
  companyId: string;
}

export function DistributorCostsTab({ companyId }: DistributorCostsTabProps) {
  const navigate = useNavigate();
  const service = createHistoricalAnalyticsService(db);

  // Read URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const distributorParam = urlParams.get('distributor');

  // State
  const [isLoading, setIsLoading] = useState(false);
  const [dateRange, setDateRange] = useState<DateRangePreset>('12mo');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [selectedDistributor, setSelectedDistributor] = useState<string>(distributorParam || 'all');
  const [compareDistributor, setCompareDistributor] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState<boolean>(false);
  const [comparisonChartView, setComparisonChartView] = useState<'trend' | 'bars'>('trend');
  const [includeDrafts, setIncludeDrafts] = useState<boolean>(false);

  const [distributors, setDistributors] = useState<CPGDistributor[]>([]);
  const [distributorTrend, setDistributorTrend] = useState<DistributorCostTrend | null>(null);
  const [compareDistributorTrend, setCompareDistributorTrend] = useState<DistributorCostTrend | null>(null);
  const [fullCalculations, setFullCalculations] = useState<any[]>([]);

  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    'date',
    'invoiceNumber',
    'products',
    'pallets',
    'unitsPerPallet',
    'totalUnits',
    'totalCost',
    'costPerUnit',
    'actions'
  ]);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [showTableExportMenu, setShowTableExportMenu] = useState(false);

  // Load distributors
  useEffect(() => {
    const loadDistributors = async () => {
      if (!companyId) return;

      try {
        const dists = await db.cpgDistributors
          .where('company_id')
          .equals(companyId)
          .and((dist) => dist.active && !dist.deleted_at)
          .toArray();

        setDistributors(dists);
      } catch (err) {
        console.error('Failed to load distributors:', err);
      }
    };

    loadDistributors();
  }, [companyId]);

  // Load distributor trend data
  useEffect(() => {
    if (companyId && selectedDistributor !== 'all') {
      loadDistributorTrend();
    }
  }, [companyId, selectedDistributor, dateRange, customStartDate, customEndDate, includeDrafts, showComparison, compareDistributor]);

  const loadDistributorTrend = async () => {
    if (!companyId || selectedDistributor === 'all') {
      setDistributorTrend(null);
      setCompareDistributorTrend(null);
      return;
    }

    setIsLoading(true);

    try {
      // Get date range (custom or preset)
      let range: DateRangePreset | { start: number; end: number } = dateRange;
      if (dateRange === 'custom' && customStartDate && customEndDate) {
        const [startYear, startMonth, startDay] = customStartDate.split('-').map(Number);
        const [endYear, endMonth, endDay] = customEndDate.split('-').map(Number);

        const startDate = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0);
        const endDate = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999);

        range = {
          start: startDate.getTime(),
          end: endDate.getTime(),
        };
      }

      const trend = await service.getDistributorCostTrend(
        companyId,
        selectedDistributor,
        range,
        includeDrafts
      );

      setDistributorTrend(trend);

      // Fetch full calculation details for the table
      if (trend.data_points.length > 0) {
        const calcIds = trend.data_points.map(p => p.calculation_id).filter(Boolean);
        const fullCalcs = await Promise.all(
          calcIds.map(id => db.cpgDistributionCalculations.get(id))
        );
        setFullCalculations(fullCalcs.filter(Boolean));
      } else {
        setFullCalculations([]);
      }

      // Load comparison distributor if comparison mode is active
      if (showComparison && compareDistributor && compareDistributor !== 'none') {
        const compareTrend = await service.getDistributorCostTrend(
          companyId,
          compareDistributor,
          range,
          includeDrafts
        );
        setCompareDistributorTrend(compareTrend);
      } else {
        setCompareDistributorTrend(null);
      }
    } catch (err) {
      console.error('Failed to load distributor trend:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper functions
  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatCurrency = (value: string | number): string => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '$0.00';

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  const getTrendDirectionIcon = (direction: 'increasing' | 'decreasing' | 'stable'): string => {
    switch (direction) {
      case 'increasing':
        return '📈';
      case 'decreasing':
        return '📉';
      case 'stable':
        return '➡️';
    }
  };

  const getTrendDirectionClass = (direction: 'increasing' | 'decreasing' | 'stable'): string => {
    switch (direction) {
      case 'increasing':
        return styles.trendIncreasing;
      case 'decreasing':
        return styles.trendDecreasing;
      case 'stable':
        return styles.trendStable;
    }
  };

  // Column management
  const allColumns = [
    { id: 'date', label: 'Date' },
    { id: 'invoiceNumber', label: 'Invoice #' },
    { id: 'products', label: 'Products' },
    { id: 'pallets', label: 'Pallets' },
    { id: 'unitsPerPallet', label: 'Units/Pallet' },
    { id: 'totalUnits', label: 'Total Units' },
    { id: 'totalCost', label: 'Total Cost' },
    { id: 'costPerUnit', label: 'Cost Per Unit' },
    { id: 'actions', label: 'Actions' },
  ];

  const toggleColumn = (columnId: string) => {
    setVisibleColumns((prev) =>
      prev.includes(columnId) ? prev.filter((id) => id !== columnId) : [...prev, columnId]
    );
  };

  // Export functions
  const exportSummaryToCSV = (trend: DistributorCostTrend, fullCalcs: any[]) => {
    // Create CSV content
    const headers = ['Date', 'Invoice #', 'Products', 'Pallets', 'Units/Pallet', 'Total Units', 'Total Cost', 'Cost Per Unit'];
    const rows = trend.data_points.map(point => {
      const totalUnits = parseFloat(point.num_pallets) * parseFloat(point.units_per_pallet);
      const fullCalc = fullCalcs.find(c => c?.id === point.calculation_id);
      const products = fullCalc?.variant_data ? Object.keys(fullCalc.variant_data).join(', ') : '';
      // Get invoice number from fullCalc (which has all the data)
      const invoiceNumber = fullCalc?.invoice_number || '';

      return [
        formatDate(point.date),
        invoiceNumber,
        products,
        point.num_pallets,
        point.units_per_pallet,
        totalUnits.toString(),
        point.total_distribution_cost,
        point.distribution_cost_per_unit,
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `distributor-costs-${trend.distributor_name}-${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportDetailedToCSV = (trend: DistributorCostTrend, fullCalcs: any[]) => {
    const rows: string[] = [];

    // Export header
    rows.push(`DETAILED DISTRIBUTION COST REPORT - ${trend.distributor_name}`);
    rows.push(`Date Range: ${formatDate(trend.start_date)} to ${formatDate(trend.end_date)}`);
    rows.push(`Total Calculations: ${fullCalcs.length}`);
    rows.push('');

    fullCalcs.forEach((calc, index) => {
      if (!calc) return;

      const point = trend.data_points.find(p => p.calculation_id === calc.id);
      if (!point) return;

      const calcNumber = index + 1;
      const totalUnits = parseFloat(calc.num_pallets) * parseFloat(calc.units_per_pallet);
      const numPallets = parseFloat(calc.num_pallets);
      const products = Object.keys(calc.variant_data || {});
      const palletWord = numPallets === 1 ? 'Pallet' : 'Pallets';

      // Visual separator for calculation
      rows.push('');
      rows.push('################################################################################');
      rows.push(`###  INVOICE ${calc.invoice_number || 'N/A'} - SHIPMENT: ${formatDate(point.date).toUpperCase()} - ${numPallets} ${palletWord}  ###`);
      rows.push('################################################################################');

      // Basic shipment info
      rows.push('');
      rows.push('SHIPMENT SUMMARY');
      rows.push(`Pallets,${calc.num_pallets}`);
      rows.push(`Units per Pallet,${calc.units_per_pallet}`);
      rows.push(`Total Units,${totalUnits}`);

      // Fee breakdown - show Qty, unit Amount, and Total
      if (calc.fee_breakdown && calc.fee_breakdown.length > 0) {
        rows.push('');
        rows.push('FEES');
        rows.push('Description,Qty,Amount,Total');

        let feesTotal = 0;
        // Need to match fee_breakdown with selected_fees to get quantity info
        calc.fee_breakdown.forEach((fee: any) => {
          const feeAmount = parseFloat(fee.feeAmount);
          feesTotal += feeAmount;

          // Find matching selected_fee to get unit amount and quantity
          const selectedFee = calc.selected_fees?.find((sf: any) => sf.feeId === fee.feeId);
          let qty = '1';
          let unitAmount = fee.feeAmount;

          if (selectedFee) {
            if (selectedFee.unit === 'per_pallet') {
              qty = selectedFee.quantity || calc.num_pallets;
              unitAmount = selectedFee.amount;
            } else if (selectedFee.unit.includes('per_day')) {
              qty = selectedFee.quantity || '1';
              unitAmount = selectedFee.amount;
            } else if (selectedFee.unit === 'percentage') {
              qty = selectedFee.quantity || selectedFee.amount;
              unitAmount = selectedFee.amount;
            } else {
              qty = selectedFee.quantity || '1';
              unitAmount = selectedFee.amount;
            }
          }

          rows.push(`"${selectedFee?.description || fee.feeName}",${qty},$${parseFloat(unitAmount).toFixed(2)},$${feeAmount.toFixed(2)}`);
        });

        rows.push(',,,TOTAL: $' + feesTotal.toFixed(2));
      }

      // Pallet Breakdown (if pallet_data exists - accurate structure)
      if (calc.pallet_data && calc.pallet_data.length > 0) {
        rows.push('');
        rows.push('PALLET BREAKDOWN');
        rows.push('');

        calc.pallet_data.forEach((pallet: any) => {
          rows.push(`Pallet ${pallet.pallet_number} (${pallet.units_per_pallet} units total)`);
          pallet.products.forEach((product: any) => {
            rows.push(`  ${product.product_name},${product.quantity} units,$${parseFloat(product.price_per_unit).toFixed(2)}/unit`);
          });
          rows.push('');
        });
      }

      // Cost Summary
      rows.push('');
      rows.push('COST SUMMARY');
      rows.push(`Total Distribution Cost,$${parseFloat(calc.total_distribution_cost).toFixed(2)}`);
      rows.push(`Distribution Cost Per Unit,$${parseFloat(calc.distribution_cost_per_unit).toFixed(2)}`);

      if (calc.invoice_total_amount) {
        rows.push(`Invoice Total,$${parseFloat(calc.invoice_total_amount).toFixed(2)}`);
      }

      if (calc.payment_status && calc.payment_status !== 'unpaid') {
        rows.push(`Payment Status,${calc.payment_status.replace('_', ' ').toUpperCase()}`);
        if (calc.amount_paid) {
          rows.push(`Amount Paid,$${parseFloat(calc.amount_paid).toFixed(2)}`);
        }
      }

      // Product breakdown
      if (calc.variant_data && Object.keys(calc.variant_data).length > 0) {
        rows.push('');
        rows.push('PRODUCT DETAILS');

        // Create pallet lookup if pallet_data exists
        const palletLookup: Record<string, { pallet_number: number, quantity: number }> = {};

        if (calc.pallet_data && calc.pallet_data.length > 0) {
          calc.pallet_data.forEach((pallet: any) => {
            pallet.products.forEach((product: any) => {
              palletLookup[product.product_name] = {
                pallet_number: pallet.pallet_number,
                quantity: product.quantity  // Quantity of THIS product, not total units on pallet
              };
            });
          });
        }

        rows.push('Product,Pallet #,Units,Base CPU,Dist Cost/Unit,Total CPU,Price,Margin %,MSRP');

        products.forEach((variant) => {
          const varData = calc.variant_data[variant];
          const result = calc.variant_results?.[variant];
          if (!result) return;

          const msrp = result.msrp || 'N/A';
          const palletInfo = palletLookup[variant];
          const palletNum = palletInfo ? palletInfo.pallet_number : 'N/A';
          const productUnits = palletInfo ? palletInfo.quantity : 'N/A';

          rows.push(`${variant},${palletNum},${productUnits},$${varData.base_cpu},$${calc.distribution_cost_per_unit},$${result.total_cpu},$${varData.price_per_unit},${result.net_profit_margin}%,${msrp}`);
        });
      }

      // Notes
      if (calc.notes) {
        rows.push('');
        rows.push('NOTES');
        rows.push(`"${calc.notes}"`);
      }

      rows.push('');
    });

    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `distributor-costs-DETAILED-${trend.distributor_name}-${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportSummaryToPDF = async (trend: DistributorCostTrend, fullCalcs: any[]) => {
    const doc = new jsPDF();

    // Title
    doc.setFontSize(16);
    doc.text(`Distribution Cost Analysis - ${trend.distributor_name}`, 14, 20);

    doc.setFontSize(10);
    doc.text(`Date Range: ${formatDate(trend.start_date)} - ${formatDate(trend.end_date)}`, 14, 28);

    // Statistics
    doc.setFontSize(12);
    doc.text('Summary Statistics', 14, 38);
    doc.setFontSize(10);
    doc.text(`Average Total Cost: ${formatCurrency(trend.statistics.average_total_cost)}`, 14, 45);
    doc.text(`Average Cost Per Unit: ${formatCurrency(trend.statistics.average_cost_per_unit)}`, 14, 52);
    doc.text(`Cost Range: ${formatCurrency(trend.statistics.min_cost)} - ${formatCurrency(trend.statistics.max_cost)}`, 14, 59);

    // Table
    let y = 70;
    doc.setFontSize(12);
    doc.text('Calculation History', 14, y);
    y += 7;

    doc.setFontSize(7);
    // Table headers
    doc.text('Date', 14, y);
    doc.text('Invoice #', 35, y);
    doc.text('Products', 60, y);
    doc.text('Pallets', 95, y);
    doc.text('Units/Pallet', 115, y);
    doc.text('Total Units', 143, y);
    doc.text('Total Cost', 168, y);
    doc.text('Cost/Unit', 188, y);
    y += 5;

    // Table rows
    trend.data_points.forEach((point, index) => {
      const fullCalc = fullCalcs.find(c => c?.id === point.calculation_id);
      const products = fullCalc?.variant_data ? Object.keys(fullCalc.variant_data).join(', ') : '';
      // Get invoice number from fullCalc (which has all the data)
      const invoiceNumber = fullCalc?.invoice_number || '';
      const totalUnits = parseFloat(point.num_pallets) * parseFloat(point.units_per_pallet);

      // Wrap product text to fit
      const wrappedProducts = doc.splitTextToSize(products, 30); // 30mm width for products column
      const rowHeight = Math.max(7, wrappedProducts.length * 3.5); // Adjust row height based on wrapped lines

      // Check if we need a new page
      if (y + rowHeight > 270) {
        doc.addPage();
        y = 20;
      }

      // Draw all cells at the same y position
      doc.text(formatDate(point.date), 14, y);
      doc.text(invoiceNumber.substring(0, 10), 35, y);
      // Draw wrapped product text
      wrappedProducts.forEach((line: string, lineIndex: number) => {
        doc.text(line, 60, y + (lineIndex * 3.5));
      });
      doc.text(point.num_pallets, 95, y);
      doc.text(point.units_per_pallet, 115, y);
      doc.text(totalUnits.toString(), 143, y);
      doc.text(formatCurrency(point.total_distribution_cost), 168, y);
      doc.text(formatCurrency(point.distribution_cost_per_unit), 188, y);

      y += rowHeight;
    });

    // Add timestamp footer - RIGHT ALIGNED
    const pageCount = doc.getNumberOfPages();
    const generatedTimestamp = new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    const footerText = `Report generated: ${generatedTimestamp}`;
    const pageWidth = 210; // A4 portrait width in mm

    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      const textWidth = doc.getTextWidth(footerText);
      doc.text(footerText, pageWidth - textWidth - 14, 285);
      doc.setTextColor(0, 0, 0);
    }

    // Download
    doc.save(`distributor-costs-SUMMARY-${trend.distributor_name}-${Date.now()}.pdf`);
  };

  const exportDetailedToPDF = async (trend: DistributorCostTrend, fullCalcs: any[]) => {
    const doc = new jsPDF();

    // Title page
    doc.setFontSize(18);
    doc.text(`Detailed Distribution Cost Report`, 14, 20);
    doc.setFontSize(14);
    doc.text(`${trend.distributor_name}`, 14, 30);

    doc.setFontSize(10);
    doc.text(`Date Range: ${formatDate(trend.start_date)} - ${formatDate(trend.end_date)}`, 14, 38);
    doc.text(`Total Calculations: ${fullCalcs.length}`, 14, 44);

    let y = 55;

    fullCalcs.forEach((calc, index) => {
      if (!calc) return;

      const point = trend.data_points.find(p => p.calculation_id === calc.id);
      if (!point) return;

      const calcNumber = index + 1;
      const totalUnits = parseFloat(calc.num_pallets) * parseFloat(calc.units_per_pallet);
      const numPallets = parseFloat(calc.num_pallets);
      const palletWord = numPallets === 1 ? 'Pallet' : 'Pallets';
      const products = Object.keys(calc.variant_data || {});

      // New page for each calculation
      if (index > 0) {
        doc.addPage();
        y = 20;
      }

      // Calculation header with visual separator (purple color)
      doc.setFontSize(14);
      doc.setFillColor(128, 90, 213); // Purple color
      doc.rect(10, y - 5, 190, 15, 'F');
      doc.setTextColor(255, 255, 255);
      const invoiceNum = calc.invoice_number || 'N/A';
      doc.text(`INVOICE ${invoiceNum} - SHIPMENT: ${formatDate(point.date).toUpperCase()} - ${numPallets} ${palletWord}`, 14, y + 3);
      doc.setTextColor(0, 0, 0);
      y += 15;

      // Shipment summary
      doc.setFontSize(12);
      doc.text('Shipment Summary', 14, y);
      y += 7;

      doc.setFontSize(9);
      doc.text(`Invoice Number: ${calc.invoice_number || 'N/A'}`, 20, y);
      y += 5;
      doc.text(`Pallets: ${calc.num_pallets}`, 20, y);
      y += 5;
      doc.text(`Units per Pallet: ${calc.units_per_pallet}`, 20, y);
      y += 5;
      doc.text(`Total Units: ${totalUnits}`, 20, y);
      y += 5;
      const productsList = products.join(', ');
      const wrappedProducts = doc.splitTextToSize(`Products: ${productsList}`, 170);
      wrappedProducts.forEach((line: string) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.text(line, 20, y);
        y += 4;
      });
      y += 3;

      // Fee breakdown - show Qty, unit Amount, and Total
      if (calc.fee_breakdown && calc.fee_breakdown.length > 0) {
        if (y > 250) {
          doc.addPage();
          y = 20;
        }

        doc.setFontSize(12);
        doc.text('Fees', 14, y);
        y += 7;

        doc.setFontSize(9);
        // Table header
        doc.text('Description', 20, y);
        doc.text('Qty', 120, y);
        doc.text('Amount', 145, y);
        doc.text('Total', 175, y);
        y += 5;

        let feesTotal = 0;
        calc.fee_breakdown.forEach((fee: any) => {
          if (y > 270) {
            doc.addPage();
            y = 20;
          }

          const feeAmount = parseFloat(fee.feeAmount);
          feesTotal += feeAmount;

          // Find matching selected_fee to get unit amount and quantity
          const selectedFee = calc.selected_fees?.find((sf: any) => sf.feeId === fee.feeId);
          let qty = '1';
          let unitAmount = fee.feeAmount;

          if (selectedFee) {
            if (selectedFee.unit === 'per_pallet') {
              qty = selectedFee.quantity || calc.num_pallets;
              unitAmount = selectedFee.amount;
            } else if (selectedFee.unit.includes('per_day')) {
              qty = selectedFee.quantity || '1';
              unitAmount = selectedFee.amount;
            } else if (selectedFee.unit === 'percentage') {
              qty = selectedFee.quantity || selectedFee.amount;
              unitAmount = selectedFee.amount;
            } else {
              qty = selectedFee.quantity || '1';
              unitAmount = selectedFee.amount;
            }
          }

          const desc = (selectedFee?.description || fee.feeName).length > 60
            ? (selectedFee?.description || fee.feeName).substring(0, 57) + '...'
            : (selectedFee?.description || fee.feeName);
          doc.text(desc, 20, y);
          doc.text(qty.toString(), 120, y);
          doc.text(`$${parseFloat(unitAmount).toFixed(2)}`, 145, y);
          doc.text(`$${feeAmount.toFixed(2)}`, 175, y);
          y += 5;
        });

        // Total row
        y += 2;
        doc.setFontSize(10);
        doc.text('TOTAL', 145, y, { align: 'right' });
        doc.text(`$${feesTotal.toFixed(2)}`, 175, y);
        y += 10;
      }

      // Pallet Breakdown (if pallet_data exists - accurate structure)
      if (calc.pallet_data && calc.pallet_data.length > 0) {
        if (y > 200) {
          doc.addPage();
          y = 20;
        }

        doc.setFontSize(12);
        doc.text('Pallet Breakdown', 14, y);
        y += 7;

        doc.setFontSize(9);
        calc.pallet_data.forEach((pallet: any) => {
          if (y > 260) {
            doc.addPage();
            y = 20;
          }

          doc.setFontSize(10);
          doc.text(`Pallet ${pallet.pallet_number} (${pallet.units_per_pallet} units):`, 20, y);
          y += 5;

          doc.setFontSize(9);
          pallet.products.forEach((product: any) => {
            if (y > 270) {
              doc.addPage();
              y = 20;
            }
            doc.text(`  ${product.product_name}: ${product.quantity} units @ $${parseFloat(product.price_per_unit).toFixed(2)}`, 25, y);
            y += 4;
          });
          y += 3;
        });
        y += 5;
      }

      // Cost Summary
      if (y > 220) {
        doc.addPage();
        y = 20;
      }

      doc.setFontSize(12);
      doc.text('Cost Summary', 14, y);
      y += 7;

      doc.setFontSize(9);
      doc.text(`Total Distribution Cost: ${formatCurrency(calc.total_distribution_cost)}`, 20, y);
      y += 5;
      doc.text(`Distribution Cost Per Unit: ${formatCurrency(calc.distribution_cost_per_unit)}`, 20, y);
      y += 5;

      if (calc.invoice_total_amount) {
        doc.text(`Invoice Total: ${formatCurrency(calc.invoice_total_amount)}`, 20, y);
        y += 5;
      }

      if (calc.payment_status && calc.payment_status !== 'unpaid') {
        doc.text(`Payment Status: ${calc.payment_status.replace('_', ' ').toUpperCase()}`, 20, y);
        y += 5;
        if (calc.amount_paid) {
          doc.text(`Amount Paid: ${formatCurrency(calc.amount_paid)}`, 20, y);
          y += 5;
        }
      }
      y += 5;

      // Product breakdown
      if (calc.variant_data && Object.keys(calc.variant_data).length > 0) {
        if (y > 240) {
          doc.addPage();
          y = 20;
        }

        doc.setFontSize(12);
        doc.text('Product/Variant Breakdown', 14, y);
        y += 7;

        Object.entries(calc.variant_data).forEach(([variant, varData]: [string, any]) => {
          if (y > 250) {
            doc.addPage();
            y = 20;
          }

          const result = calc.variant_results?.[variant];
          if (!result) return;

          const baseCPU = parseFloat(varData.base_cpu);
          const distCostPerUnit = parseFloat(calc.distribution_cost_per_unit);
          const totalCPU = parseFloat(result.total_cpu);
          const price = parseFloat(varData.price_per_unit);
          const profitPerUnit = price - totalCPU;

          doc.setFontSize(10);
          doc.text(`${variant}:`, 20, y);
          y += 6;

          doc.setFontSize(8);
          doc.text(`Base CPU: $${baseCPU.toFixed(2)}`, 25, y);
          y += 4;
          doc.text(`+ Distribution Cost Per Unit: $${distCostPerUnit.toFixed(2)}`, 25, y);
          y += 4;
          doc.text(`= Total CPU: $${totalCPU.toFixed(2)}`, 25, y);
          y += 4;
          doc.text(`Selling Price: $${price.toFixed(2)}`, 25, y);
          y += 4;
          doc.text(`Profit: $${profitPerUnit.toFixed(2)} (${result.net_profit_margin}%)`, 25, y);
          y += 4;
          if (result.msrp) {
            doc.text(`MSRP: ${formatCurrency(result.msrp)}`, 25, y);
            y += 4;
          }
          y += 4;
        });
      }

      // Notes
      if (calc.notes) {
        if (y > 250) {
          doc.addPage();
          y = 20;
        }
        doc.setFontSize(12);
        doc.text('Notes', 14, y);
        y += 7;
        doc.setFontSize(9);
        const lines = doc.splitTextToSize(calc.notes, 180);
        doc.text(lines, 20, y);
      }
    });

    // Add timestamp footer - RIGHT ALIGNED
    const pageCount = doc.getNumberOfPages();
    const generatedTimestamp = new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    const footerText = `Report generated: ${generatedTimestamp}`;
    const pageWidth = 210; // A4 portrait width in mm

    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      const textWidth = doc.getTextWidth(footerText);
      doc.text(footerText, pageWidth - textWidth - 14, 285);
      doc.setTextColor(0, 0, 0);
    }

    // Download
    doc.save(`distributor-costs-DETAILED-${trend.distributor_name}-${Date.now()}.pdf`);
  };

  const exportDataTableCSV = (trend: DistributorCostTrend, fullCalcs: any[]) => {
    // Create a flat table format perfect for pivot tables
    const rows: string[] = [];

    // Headers
    const headers = [
      'Date',
      'Invoice Number',
      'Distributor',
      'Pallets',
      'Pallet #',
      'Product Units',
      'Product',
      'Base CPU',
      'Distribution Cost Per Unit',
      'Total CPU',
      'Selling Price',
      'Profit Per Unit',
      'Margin %',
      'MSRP',
      'Fee Description',
      'Fee Amount',
      'Total Distribution Cost'
    ];
    rows.push(headers.join(','));

    // Data rows - one row per product per calculation
    fullCalcs.forEach((calc, index) => {
      if (!calc) return;

      const point = trend.data_points.find(p => p.calculation_id === calc.id);
      if (!point) return;

      const calcNumber = index + 1;

      // Build product lookup from pallet_data for accurate quantities
      const productLookup: Record<string, { pallet_number: number, quantity: number }> = {};
      if (calc.pallet_data && calc.pallet_data.length > 0) {
        calc.pallet_data.forEach((pallet: any) => {
          pallet.products.forEach((product: any) => {
            productLookup[product.product_name] = {
              pallet_number: pallet.pallet_number,
              quantity: product.quantity
            };
          });
        });
      }

      // Get all products
      const products = Object.keys(calc.variant_data || {});

      products.forEach((variant) => {
        const varData = calc.variant_data[variant];
        const result = calc.variant_results?.[variant];
        if (!result) return;

        // Get product-specific data
        const productInfo = productLookup[variant];
        const palletNum = productInfo ? productInfo.pallet_number : 'N/A';
        const productUnits = productInfo ? productInfo.quantity : (varData.quantity || 'N/A');

        const baseCPU = parseFloat(varData.base_cpu);
        const distCostPerUnit = parseFloat(calc.distribution_cost_per_unit);
        const totalCPU = parseFloat(result.total_cpu);
        const price = parseFloat(varData.price_per_unit);
        const profitPerUnit = price - totalCPU;

        // Create a row for each fee (or one row if no fees)
        // Use calculated fee_breakdown instead of selected_fees
        if (calc.fee_breakdown && calc.fee_breakdown.length > 0) {
          calc.fee_breakdown.forEach((fee: any) => {
            rows.push([
              `"${formatDate(point.date)}"`,
              calc.invoice_number || 'N/A',
              trend.distributor_name,
              calc.num_pallets,
              palletNum,
              productUnits,
              `"${variant}"`,
              baseCPU.toFixed(2),
              distCostPerUnit.toFixed(2),
              totalCPU.toFixed(2),
              price.toFixed(2),
              profitPerUnit.toFixed(2),
              result.net_profit_margin,
              result.msrp || '',
              `"${fee.feeName}"`,
              parseFloat(fee.feeAmount).toFixed(2),
              calc.total_distribution_cost
            ].join(','));
          });
        } else {
          // No fees, just product row
          rows.push([
            `"${formatDate(point.date)}"`,
            calc.invoice_number || 'N/A',
            trend.distributor_name,
            calc.num_pallets,
            palletNum,
            productUnits,
            `"${variant}"`,
            baseCPU.toFixed(2),
            distCostPerUnit.toFixed(2),
            totalCPU.toFixed(2),
            price.toFixed(2),
            profitPerUnit.toFixed(2),
            result.net_profit_margin,
            result.msrp || '',
            '',
            '',
            calc.total_distribution_cost
          ].join(','));
        }
      });
    });

    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `distributor-data-table-${trend.distributor_name}-${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportChartToPDF = async (trend: DistributorCostTrend, compareTrend: DistributorCostTrend | null) => {
    const html2canvas = (await import('html2canvas')).default;

    // Find the chart (just the recharts wrapper, not the whole container)
    const chartElement = document.querySelector('.recharts-wrapper') as HTMLElement;
    if (!chartElement) {
      alert('Chart not found. Please try again.');
      return;
    }

    // Capture the chart as image with high quality
    const canvas = await html2canvas(chartElement, {
      backgroundColor: '#ffffff',
      scale: 2,
    });

    const imgData = canvas.toDataURL('image/png');
    const doc = new jsPDF('l', 'mm', 'a4'); // Landscape

    // Title
    doc.setFontSize(16);
    const title = compareTrend
      ? `Distribution Cost Comparison: ${trend.distributor_name} vs ${compareTrend.distributor_name}`
      : `Distribution Cost Trend - ${trend.distributor_name}`;
    doc.text(title, 14, 20);

    doc.setFontSize(10);
    doc.text(`Date Range: ${formatDate(trend.start_date)} - ${formatDate(trend.end_date)}`, 14, 28);

    // Add chart image
    const imgWidth = 270;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    doc.addImage(imgData, 'PNG', 10, 35, imgWidth, imgHeight);

    // Add statistics - side by side if comparing
    let y = 35 + imgHeight + 10;

    if (compareTrend) {
      // Side-by-side layout for comparison
      const leftX = 14;
      const rightX = 150; // Right column starts at midpoint

      // Left column - Primary distributor
      doc.setFontSize(12);
      doc.text(`${trend.distributor_name} Statistics:`, leftX, y);
      let leftY = y + 7;
      doc.setFontSize(10);
      doc.text(`Average Total Cost: ${formatCurrency(trend.statistics.average_total_cost)}`, leftX + 6, leftY);
      leftY += 6;
      doc.text(`Average Cost Per Unit: ${formatCurrency(trend.statistics.average_cost_per_unit)}`, leftX + 6, leftY);
      leftY += 6;
      doc.text(`Trend: ${trend.statistics.trend_direction} (${trend.statistics.change_percentage}%)`, leftX + 6, leftY);

      // Right column - Comparison distributor
      doc.setFontSize(12);
      doc.text(`${compareTrend.distributor_name} Statistics:`, rightX, y);
      let rightY = y + 7;
      doc.setFontSize(10);
      doc.text(`Average Total Cost: ${formatCurrency(compareTrend.statistics.average_total_cost)}`, rightX + 6, rightY);
      rightY += 6;
      doc.text(`Average Cost Per Unit: ${formatCurrency(compareTrend.statistics.average_cost_per_unit)}`, rightX + 6, rightY);
      rightY += 6;
      doc.text(`Trend: ${compareTrend.statistics.trend_direction} (${compareTrend.statistics.change_percentage}%)`, rightX + 6, rightY);
    } else {
      // Single column layout for single distributor
      doc.setFontSize(12);
      doc.text(`${trend.distributor_name} Statistics:`, 14, y);
      y += 7;
      doc.setFontSize(10);
      doc.text(`Average Total Cost: ${formatCurrency(trend.statistics.average_total_cost)}`, 20, y);
      y += 6;
      doc.text(`Average Cost Per Unit: ${formatCurrency(trend.statistics.average_cost_per_unit)}`, 20, y);
      y += 6;
      doc.text(`Trend: ${trend.statistics.trend_direction} (${trend.statistics.change_percentage}%)`, 20, y);
    }

    // Add timestamp footer - RIGHT ALIGNED
    const generatedTimestamp = new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    const pageWidth = 297; // A4 landscape width in mm
    const pageHeight = 210; // A4 landscape height in mm
    const footerText = `Report generated: ${generatedTimestamp}`;

    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);

    // Get text width to right align
    const textWidth = doc.getTextWidth(footerText);
    doc.text(footerText, pageWidth - textWidth - 14, pageHeight - 5);

    doc.setTextColor(0, 0, 0);

    doc.save(`distributor-chart-${trend.distributor_name}-${Date.now()}.pdf`);
  };

  return (
    <div style={{ paddingLeft: '6rem', paddingRight: '6rem' }}>
      {/* Filters Section */}
      <div className={styles.filters}>
        {/* Date Range Filter */}
        <div className={styles.filterGroup}>
          <label htmlFor="dateRange" className={styles.filterLabel}>
            Date Range
          </label>
          <select
            id="dateRange"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as DateRangePreset)}
            className={styles.filterSelect}
          >
            <option value="3mo">Last 3 Months</option>
            <option value="6mo">Last 6 Months</option>
            <option value="12mo">Last 12 Months</option>
            <option value="all">All Time</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>

        {/* Custom Date Range */}
        {dateRange === 'custom' && (
          <>
            <div className={styles.filterGroup}>
              <label htmlFor="customStartDate" className={styles.filterLabel}>
                Start Date
              </label>
              <input
                type="date"
                id="customStartDate"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className={styles.filterSelect}
              />
            </div>
            <div className={styles.filterGroup}>
              <label htmlFor="customEndDate" className={styles.filterLabel}>
                End Date
              </label>
              <input
                type="date"
                id="customEndDate"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className={styles.filterSelect}
              />
            </div>
          </>
        )}

        {/* Distributor Filter */}
        <div className={styles.filterGroup}>
          <label htmlFor="distributor" className={styles.filterLabel}>
            Distributor
          </label>
          <select
            id="distributor"
            value={selectedDistributor}
            onChange={(e) => setSelectedDistributor(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="all">Select a distributor...</option>
            {distributors
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((dist) => (
                <option key={dist.id} value={dist.id}>
                  {dist.name}
                </option>
              ))}
          </select>
        </div>

        {/* Checkboxes Group */}
        <div className={styles.filterGroup} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {selectedDistributor !== 'all' && (
            <label className={styles.filterLabel}>
              <input
                type="checkbox"
                checked={showComparison}
                onChange={(e) => setShowComparison(e.target.checked)}
                style={{ marginRight: '0.5rem' }}
              />
              Compare with another distributor
            </label>
          )}
          <label className={styles.filterLabel}>
            <input
              type="checkbox"
              checked={includeDrafts}
              onChange={(e) => setIncludeDrafts(e.target.checked)}
              style={{ marginRight: '0.5rem' }}
            />
            Include draft calculations
          </label>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className={styles.loading}>
          Loading distributor cost data...
        </div>
      )}

      {/* Main Content */}
      {!isLoading && (
        <div className={styles.content}>
          {selectedDistributor === 'all' ? (
            <div className={styles.noData}>Please select a distributor to view cost trends</div>
          ) : distributorTrend ? (
            <>
              {/* Statistics Cards */}
              {showComparison ? (
                <div className={styles.comparisonStatsContainer} style={{ marginTop: '3rem' }}>
                  {/* Primary Distributor Stats */}
                  <div className={styles.comparisonStatsSection}>
                    <h3 className={styles.comparisonDistributorName}>
                      {distributorTrend.distributor_name}
                      <span className={styles.primaryBadge}>Primary</span>
                    </h3>
                    <div className={styles.statsGrid} style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                      <div className={styles.statCard}>
                        <div className={styles.statLabel}>Avg Total Cost</div>
                        <div className={styles.statValue}>
                          {formatCurrency(distributorTrend.statistics.average_total_cost)}
                        </div>
                      </div>
                      <div className={styles.statCard}>
                        <div className={styles.statLabel}>Avg Cost Per Unit</div>
                        <div className={styles.statValue}>
                          {formatCurrency(distributorTrend.statistics.average_cost_per_unit)}
                        </div>
                      </div>
                      <div className={styles.statCard}>
                        <div className={styles.statLabel}>Cost Range</div>
                        <div className={styles.statValue}>
                          {formatCurrency(distributorTrend.statistics.min_cost)} -{' '}
                          {formatCurrency(distributorTrend.statistics.max_cost)}
                        </div>
                      </div>
                      <div className={styles.statCard}>
                        <div className={styles.statLabel}>Trend</div>
                        <div
                          className={`${styles.statValue} ${getTrendDirectionClass(distributorTrend.statistics.trend_direction)}`}
                        >
                          {distributorTrend.statistics.change_percentage}%
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Comparison Distributor Stats */}
                  <div className={styles.comparisonStatsSection} style={{ position: 'relative' }}>
                    {/* Compare With Dropdown - Positioned absolutely to not affect layout flow */}
                    <div style={{ position: 'absolute', top: '-3.5rem', right: 0, left: 0, zIndex: 1 }}>
                      <label htmlFor="compareDistributor" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Compare With
                      </label>
                      <select
                        id="compareDistributor"
                        value={compareDistributor || 'none'}
                        onChange={(e) => setCompareDistributor(e.target.value === 'none' ? null : e.target.value)}
                        className={styles.filterSelect}
                        style={{ fontSize: '0.875rem', padding: '0.375rem 0.5rem' }}
                      >
                        <option value="none">Select distributor to compare...</option>
                        {distributors
                          .filter((dist) => dist.id !== selectedDistributor)
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((dist) => (
                            <option key={dist.id} value={dist.id}>
                              {dist.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    {compareDistributorTrend ? (
                      <>
                        <h3 className={styles.comparisonDistributorName}>
                          {compareDistributorTrend.distributor_name}
                          <span className={styles.comparisonBadge}>Comparison</span>
                        </h3>
                        <div className={styles.statsGrid} style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                          <div className={styles.statCard}>
                            <div className={styles.statLabel}>Avg Total Cost</div>
                            <div className={styles.statValue}>
                              {formatCurrency(compareDistributorTrend.statistics.average_total_cost)}
                            </div>
                          </div>
                          <div className={styles.statCard}>
                            <div className={styles.statLabel}>Avg Cost Per Unit</div>
                            <div className={styles.statValue}>
                              {formatCurrency(compareDistributorTrend.statistics.average_cost_per_unit)}
                            </div>
                          </div>
                          <div className={styles.statCard}>
                            <div className={styles.statLabel}>Cost Range</div>
                            <div className={styles.statValue}>
                              {formatCurrency(compareDistributorTrend.statistics.min_cost)} -{' '}
                              {formatCurrency(compareDistributorTrend.statistics.max_cost)}
                            </div>
                          </div>
                          <div className={styles.statCard}>
                            <div className={styles.statLabel}>Trend</div>
                            <div
                              className={`${styles.statValue} ${getTrendDirectionClass(compareDistributorTrend.statistics.trend_direction)}`}
                            >
                              {compareDistributorTrend.statistics.change_percentage}%
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280', fontSize: '0.875rem' }}>
                        Select a distributor to compare
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className={styles.statsGrid}>
                  <div className={styles.statCard}>
                    <div className={styles.statLabel}>Avg Total Cost</div>
                    <div className={styles.statValue}>
                      {formatCurrency(distributorTrend.statistics.average_total_cost)}
                    </div>
                  </div>
                  <div className={styles.statCard}>
                    <div className={styles.statLabel}>Avg Cost Per Unit</div>
                    <div className={styles.statValue}>
                      {formatCurrency(distributorTrend.statistics.average_cost_per_unit)}
                    </div>
                  </div>
                  <div className={styles.statCard}>
                    <div className={styles.statLabel}>Cost Range</div>
                    <div className={styles.statValue}>
                      {formatCurrency(distributorTrend.statistics.min_cost)} -{' '}
                      {formatCurrency(distributorTrend.statistics.max_cost)}
                    </div>
                  </div>
                  <div className={styles.statCard}>
                    <div className={styles.statLabel}>Trend</div>
                    <div
                      className={`${styles.statValue} ${getTrendDirectionClass(distributorTrend.statistics.trend_direction)}`}
                    >
                      {distributorTrend.statistics.change_percentage}%
                    </div>
                  </div>
                </div>
              )}

              {/* Distributor Cost Chart */}
              {distributorTrend.data_points.length > 0 ? (
                <div className={styles.chartContainer}>
                  <div className={styles.chartTitle} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>
                      Distribution Cost Trend
                      {showComparison && compareDistributorTrend
                        ? ` - ${distributorTrend.distributor_name} vs ${compareDistributorTrend.distributor_name}`
                        : ` - ${distributorTrend.distributor_name}`}
                    </span>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      {/* View Toggle for Comparison Mode */}
                      {showComparison && compareDistributorTrend && (
                        <div style={{
                          display: 'inline-flex',
                          background: 'rgba(255, 255, 255, 0.15)',
                          borderRadius: '6px',
                          padding: '2px',
                          marginRight: '0.5rem'
                        }}>
                          <button
                            onClick={() => setComparisonChartView('trend')}
                            style={{
                              padding: '0.4rem 0.8rem',
                              border: 'none',
                              borderRadius: '4px',
                              background: comparisonChartView === 'trend' ? 'linear-gradient(135deg, #E8D4A0 0%, #D4AF37 50%, #B8860B 100%)' : 'transparent',
                              fontWeight: '600',
                              color: comparisonChartView === 'trend' ? '#2d1b00' : '#ffffff',
                              cursor: 'pointer',
                              fontSize: '0.875rem',
                              boxShadow: comparisonChartView === 'trend' ? '0 2px 6px rgba(184, 134, 11, 0.4)' : 'none',
                              transition: 'all 0.2s'
                            }}
                          >
                            📈 Trend
                          </button>
                          <button
                            onClick={() => setComparisonChartView('bars')}
                            style={{
                              padding: '0.4rem 0.8rem',
                              border: 'none',
                              borderRadius: '4px',
                              background: comparisonChartView === 'bars' ? 'linear-gradient(135deg, #E8D4A0 0%, #D4AF37 50%, #B8860B 100%)' : 'transparent',
                              fontWeight: '600',
                              color: comparisonChartView === 'bars' ? '#2d1b00' : '#ffffff',
                              cursor: 'pointer',
                              fontSize: '0.875rem',
                              boxShadow: comparisonChartView === 'bars' ? '0 2px 6px rgba(184, 134, 11, 0.4)' : 'none',
                              transition: 'all 0.2s'
                            }}
                          >
                            📊 Compare
                          </button>
                        </div>
                      )}
                      <button
                        className={styles.exportButton}
                        onClick={() => {
                          exportChartToPDF(distributorTrend, compareDistributorTrend);
                        }}
                        style={{
                          padding: '0.5rem 1rem',
                          fontSize: '0.875rem',
                          boxShadow: '0 2px 6px rgba(184, 134, 11, 0.4)'
                        }}
                      >
                        Export Chart
                      </button>
                    </div>
                  </div>
                  <div className={styles.chartContent}>

                  {/* Insight Banner - Only show when NOT comparing */}
                  {!showComparison && (() => {
                    const trend = distributorTrend.statistics.trend_direction;
                    const changePercent = parseFloat(distributorTrend.statistics.change_percentage);
                    const avgCost = parseFloat(distributorTrend.statistics.average_cost_per_unit);

                    // Find best and worst deals
                    const sortedPoints = [...distributorTrend.data_points].sort((a, b) =>
                      parseFloat(a.distribution_cost_per_unit) - parseFloat(b.distribution_cost_per_unit)
                    );
                    const bestDeal = sortedPoints[0];
                    const worstDeal = sortedPoints[sortedPoints.length - 1];

                    const trendIcon = trend === 'increasing' ? '📈' : trend === 'decreasing' ? '📉' : '➡️';
                    const trendColor = trend === 'increasing' ? '#ef4444' : trend === 'decreasing' ? '#10b981' : '#6b7280';
                    const trendText = trend === 'increasing'
                      ? `Costs are trending UP by ${Math.abs(changePercent).toFixed(1)}%`
                      : trend === 'decreasing'
                      ? `Costs are trending DOWN by ${Math.abs(changePercent).toFixed(1)}%`
                      : 'Costs are holding steady';

                    return (
                      <div style={{
                        background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        padding: '1rem',
                        marginBottom: '1rem',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                          <span style={{ fontSize: '1.5rem' }}>{trendIcon}</span>
                          <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: trendColor }}>
                            {trendText}
                          </span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', fontSize: '0.9rem' }}>
                          <div>
                            <div style={{ color: '#6b7280', marginBottom: '0.25rem' }}>Your Average</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1f2937' }}>
                              {formatCurrency(avgCost)}/unit
                            </div>
                          </div>
                          <div>
                            <div style={{ color: '#10b981', marginBottom: '0.25rem' }}>✓ Best Deal</div>
                            <div style={{ fontSize: '1rem', fontWeight: '600' }}>
                              {formatCurrency(bestDeal.distribution_cost_per_unit)} on {formatDate(bestDeal.date)}
                            </div>
                          </div>
                          <div>
                            <div style={{ color: '#ef4444', marginBottom: '0.25rem' }}>⚠ Highest Cost</div>
                            <div style={{ fontSize: '1rem', fontWeight: '600' }}>
                              {formatCurrency(worstDeal.distribution_cost_per_unit)} on {formatDate(worstDeal.date)}
                            </div>
                          </div>
                        </div>
                        <div style={{
                          marginTop: '0.75rem',
                          paddingTop: '0.75rem',
                          borderTop: '1px solid #d1d5db',
                          fontSize: '0.85rem',
                          color: '#6b7280',
                          fontStyle: 'italic'
                        }}>
                          💡 Green bars = below average cost (good deals), Red bars = above average (watch these)
                        </div>
                      </div>
                    );
                  })()}

                  {/* Trend Chart View (Option 1) */}
                  {(!showComparison || comparisonChartView === 'trend') && (
                  <>
                  <ResponsiveContainer width="100%" height={400}>
                    <ComposedChart
                      data={(() => {
                        // Calculate average cost per unit for color coding
                        const avgCostPerUnit = distributorTrend.data_points.reduce((sum, point) =>
                          sum + parseFloat(point.distribution_cost_per_unit), 0
                        ) / distributorTrend.data_points.length;

                        // Combine data points from both distributors if comparing
                        if (showComparison && compareDistributorTrend) {
                          const allDataPoints: any[] = [];

                          const compareAvgCostPerUnit = compareDistributorTrend.data_points.reduce((sum, point) =>
                            sum + parseFloat(point.distribution_cost_per_unit), 0
                          ) / compareDistributorTrend.data_points.length;

                          // Add primary distributor data - each invoice gets its own point
                          distributorTrend.data_points.forEach((point, index) => {
                            const totalUnits = parseFloat(point.num_pallets) * parseFloat(point.units_per_pallet);
                            const costPerUnit = parseFloat(point.distribution_cost_per_unit);
                            const isAboveAverage = costPerUnit > avgCostPerUnit;

                            allDataPoints.push({
                              // Make date unique by appending calculation_id so multiple invoices on same date show separately
                              date: `${formatDate(point.date)}::${point.calculation_id || index}`,
                              timestamp: point.date,
                              perUnit: costPerUnit,
                              totalUnits: totalUnits,
                              numPallets: parseFloat(point.num_pallets),
                              isAboveAverage: isAboveAverage,
                              avgCostPerUnit: avgCostPerUnit,
                              originalPoint: point,
                              uniqueKey: `primary-${point.calculation_id || index}`,
                            });
                          });

                          // Add comparison distributor data - each invoice gets its own point
                          compareDistributorTrend.data_points.forEach((point, index) => {
                            const totalUnits = parseFloat(point.num_pallets) * parseFloat(point.units_per_pallet);
                            const costPerUnit = parseFloat(point.distribution_cost_per_unit);
                            const isAboveAverage = costPerUnit > compareAvgCostPerUnit;

                            allDataPoints.push({
                              // Make date unique by appending calculation_id
                              date: `${formatDate(point.date)}::${point.calculation_id || index}`,
                              timestamp: point.date,
                              comparePerUnit: costPerUnit,
                              compareTotalUnits: totalUnits,
                              compareNumPallets: parseFloat(point.num_pallets),
                              compareIsAboveAverage: isAboveAverage,
                              compareAvgCostPerUnit: compareAvgCostPerUnit,
                              compareOriginalPoint: point,
                              uniqueKey: `compare-${point.calculation_id || index}`,
                            });
                          });

                          // Sort by timestamp, then by uniqueKey for consistent ordering
                          return allDataPoints.sort((a, b) => {
                            if (a.timestamp !== b.timestamp) {
                              return a.timestamp - b.timestamp;
                            }
                            return a.uniqueKey.localeCompare(b.uniqueKey);
                          });
                        }

                        // Single distributor view
                        // Each point needs a unique key for Recharts to treat them separately
                        return distributorTrend.data_points.map((point, index) => {
                          const totalUnits = parseFloat(point.num_pallets) * parseFloat(point.units_per_pallet);
                          const costPerUnit = parseFloat(point.distribution_cost_per_unit);
                          const isAboveAverage = costPerUnit > avgCostPerUnit;
                          const formattedDate = formatDate(point.date);

                          return {
                            // Use calculation_id + index to ensure uniqueness for Recharts
                            date: `${formattedDate}::${point.calculation_id || index}`,
                            displayDate: formattedDate, // Clean date for display
                            timestamp: point.date,
                            perUnit: costPerUnit,
                            totalUnits: totalUnits,
                            numPallets: parseFloat(point.num_pallets),
                            isAboveAverage: isAboveAverage,
                            avgCostPerUnit: avgCostPerUnit,
                            originalPoint: point,
                            calculationId: point.calculation_id || `calc-${index}`,
                          };
                        });
                      })()}
                      margin={{ top: 20, right: 60, left: 20, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        tickFormatter={(value) => {
                          // Strip out the ::calculation_id part to show clean dates
                          return value.split('::')[0];
                        }}
                      />
                      <YAxis
                        yAxisId="left"
                        label={{ value: 'Cost Per Unit ($)', angle: -90, position: 'insideLeft' }}
                      />
                      {/* Only show right axis (volume) when NOT comparing */}
                      {!showComparison && (
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          label={{
                            value: 'Total Units',
                            angle: 90,
                            position: 'insideRight',
                          }}
                        />
                      )}
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length > 0) {
                            const dataPoint = payload[0].payload;

                            // Comparison Mode Tooltip - show whichever distributor this point belongs to
                            if (showComparison && compareDistributorTrend) {
                              const primaryPoint = dataPoint.originalPoint;
                              const comparePoint = dataPoint.compareOriginalPoint;
                              const point = primaryPoint || comparePoint;

                              if (!point) return null;

                              const isPrimary = !!primaryPoint;
                              const distributorName = isPrimary ? distributorTrend.distributor_name : compareDistributorTrend.distributor_name;
                              const color = isPrimary ? '#3b82f6' : '#8b5cf6';

                              return (
                                <div className={styles.chartTooltip}>
                                  <p className={styles.tooltipDate} style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
                                    {formatDate(point.date)}
                                  </p>
                                  <p style={{ fontWeight: 'bold', color, marginBottom: '0.5rem' }}>
                                    {distributorName}
                                  </p>
                                  <p><strong>Cost/Unit:</strong> {formatCurrency(point.distribution_cost_per_unit)}</p>
                                  <p><strong>Total Cost:</strong> {formatCurrency(point.total_distribution_cost)}</p>
                                  <p><strong>Volume:</strong> {dataPoint.totalUnits || dataPoint.compareTotalUnits} units</p>
                                  {point.invoice_number && (
                                    <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#6b7280' }}>
                                      Invoice: {point.invoice_number}
                                    </p>
                                  )}
                                </div>
                              );
                            }

                            // Single Distributor Tooltip
                            const point = dataPoint.originalPoint;
                            if (!point) return null;

                            const costPerUnit = parseFloat(point.distribution_cost_per_unit);
                            const avgCostPerUnit = dataPoint.avgCostPerUnit;
                            const variance = ((costPerUnit - avgCostPerUnit) / avgCostPerUnit) * 100;
                            const isGoodDeal = costPerUnit < avgCostPerUnit;

                            return (
                              <div className={styles.chartTooltip}>
                                <p className={styles.tooltipDate}>{formatDate(point.date)}</p>
                                <p><strong>Cost Per Unit:</strong> {formatCurrency(point.distribution_cost_per_unit)}</p>
                                <p><strong>Volume:</strong> {dataPoint.totalUnits.toLocaleString()} units ({point.num_pallets} pallets)</p>
                                <p><strong>Total Cost:</strong> {formatCurrency(point.total_distribution_cost)}</p>
                                <div style={{
                                  marginTop: '0.5rem',
                                  paddingTop: '0.5rem',
                                  borderTop: '1px solid #e5e7eb',
                                  color: isGoodDeal ? '#10b981' : '#ef4444',
                                  fontWeight: 'bold'
                                }}>
                                  {isGoodDeal ? '✓' : '⚠'} {Math.abs(variance).toFixed(1)}% {isGoodDeal ? 'below' : 'above'} your average
                                </div>
                                {point.calculation_name && (
                                  <p className={styles.tooltipDetail} style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#6b7280' }}>
                                    {point.calculation_name}
                                  </p>
                                )}
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend />

                      {/* Volume Bars - Only show when NOT comparing (too noisy with 2 distributors) */}
                      {!showComparison && (
                        <Bar
                          yAxisId="right"
                          dataKey="totalUnits"
                          fill="#10b981"
                          opacity={0.6}
                          name="Volume (Units)"
                          shape={(props: any) => {
                            const { x, y, width, height, payload } = props;
                            const fill = payload.isAboveAverage ? '#ef4444' : '#10b981';
                            return <rect x={x} y={y} width={width} height={height} fill={fill} opacity={0.6} />;
                          }}
                        />
                      )}

                      {/* Cost Per Unit Line - Primary Distributor */}
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="perUnit"
                        stroke="#3b82f6"
                        strokeWidth={3}
                        dot={{ r: 6, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                        activeDot={{ r: 8 }}
                        name={showComparison ? distributorTrend.distributor_name : 'Cost Per Unit'}
                      />

                      {/* Comparison Distributor - Only show cost line */}
                      {showComparison && compareDistributorTrend && (
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="comparePerUnit"
                          stroke="#8b5cf6"
                          strokeWidth={3}
                          strokeDasharray="5 5"
                          dot={{ r: 6, fill: '#8b5cf6', strokeWidth: 2, stroke: '#fff' }}
                          activeDot={{ r: 8 }}
                          name={compareDistributorTrend.distributor_name}
                        />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>


                  {/* Helper text for comparison mode */}
                  {showComparison && compareDistributorTrend && comparisonChartView === 'trend' && (
                    <div style={{
                      marginTop: '1rem',
                      padding: '0.75rem',
                      background: '#f9fafb',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '0.9rem',
                      color: '#6b7280'
                    }}>
                      <strong style={{ color: '#374151' }}>📊 Comparison View:</strong> Solid blue line = {distributorTrend.distributor_name}, Dashed purple line = {compareDistributorTrend.distributor_name}. Hover over any date to see both distributors' costs and the difference.
                    </div>
                  )}
                  </>
                  )}

                  {/* Side-by-Side Bar Chart View (Option 2) */}
                  {showComparison && compareDistributorTrend && comparisonChartView === 'bars' && (
                    <>
                      <ResponsiveContainer width="100%" height={400}>
                        <BarChart
                          data={[
                            {
                              metric: 'Avg Cost/Unit',
                              [distributorTrend.distributor_name]: parseFloat(distributorTrend.statistics.average_cost_per_unit),
                              [compareDistributorTrend.distributor_name]: parseFloat(compareDistributorTrend.statistics.average_cost_per_unit),
                            },
                            {
                              metric: 'Min Cost',
                              [distributorTrend.distributor_name]: parseFloat(distributorTrend.statistics.min_cost),
                              [compareDistributorTrend.distributor_name]: parseFloat(compareDistributorTrend.statistics.min_cost),
                            },
                            {
                              metric: 'Max Cost',
                              [distributorTrend.distributor_name]: parseFloat(distributorTrend.statistics.max_cost),
                              [compareDistributorTrend.distributor_name]: parseFloat(compareDistributorTrend.statistics.max_cost),
                            },
                          ]}
                          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="metric" />
                          <YAxis label={{ value: 'Cost ($)', angle: -90, position: 'insideLeft' }} />
                          <Tooltip
                            formatter={(value: any) => `$${value.toFixed(2)}`}
                            contentStyle={{
                              backgroundColor: '#fff',
                              border: '1px solid #e5e7eb',
                              borderRadius: '6px',
                              padding: '0.75rem'
                            }}
                          />
                          <Legend />
                          <Bar dataKey={distributorTrend.distributor_name} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                          <Bar dataKey={compareDistributorTrend.distributor_name} fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>

                      {/* Insight cards below bars */}
                      <div style={{
                        marginTop: '1.5rem',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                        gap: '1rem'
                      }}>
                        {/* Cost Difference Card */}
                        <div style={{
                          padding: '1rem',
                          background: '#f9fafb',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px'
                        }}>
                          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                            Avg Cost Difference
                          </div>
                          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1f2937' }}>
                            {(() => {
                              const diff = parseFloat(distributorTrend.statistics.average_cost_per_unit) - parseFloat(compareDistributorTrend.statistics.average_cost_per_unit);
                              const isLower = diff < 0;
                              return (
                                <span style={{ color: isLower ? '#10b981' : '#ef4444' }}>
                                  {isLower ? '↓' : '↑'} ${Math.abs(diff).toFixed(2)}
                                </span>
                              );
                            })()}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                            {parseFloat(distributorTrend.statistics.average_cost_per_unit) < parseFloat(compareDistributorTrend.statistics.average_cost_per_unit)
                              ? `${distributorTrend.distributor_name} is cheaper`
                              : `${compareDistributorTrend.distributor_name} is cheaper`}
                          </div>
                        </div>

                        {/* Trend Direction Card */}
                        <div style={{
                          padding: '1rem',
                          background: '#f9fafb',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px'
                        }}>
                          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                            Cost Trends
                          </div>
                          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.9rem' }}>
                            <div>
                              <div style={{ fontWeight: '600', color: '#3b82f6' }}>
                                {distributorTrend.distributor_name}:
                              </div>
                              <div style={{
                                color: distributorTrend.statistics.trend_direction === 'decreasing' ? '#10b981' : '#ef4444'
                              }}>
                                {distributorTrend.statistics.trend_direction === 'increasing' ? '📈' : '📉'} {distributorTrend.statistics.change_percentage}%
                              </div>
                            </div>
                            <div>
                              <div style={{ fontWeight: '600', color: '#8b5cf6' }}>
                                {compareDistributorTrend.distributor_name}:
                              </div>
                              <div style={{
                                color: compareDistributorTrend.statistics.trend_direction === 'decreasing' ? '#10b981' : '#ef4444'
                              }}>
                                {compareDistributorTrend.statistics.trend_direction === 'increasing' ? '📈' : '📉'} {compareDistributorTrend.statistics.change_percentage}%
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Data Points Card */}
                        <div style={{
                          padding: '1rem',
                          background: '#f9fafb',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px'
                        }}>
                          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                            Shipments Analyzed
                          </div>
                          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.9rem' }}>
                            <div>
                              <span style={{ fontWeight: '600', color: '#3b82f6' }}>{distributorTrend.distributor_name}:</span>
                              <span style={{ marginLeft: '0.5rem' }}>{distributorTrend.data_points.length}</span>
                            </div>
                            <div>
                              <span style={{ fontWeight: '600', color: '#8b5cf6' }}>{compareDistributorTrend.distributor_name}:</span>
                              <span style={{ marginLeft: '0.5rem' }}>{compareDistributorTrend.data_points.length}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                  </div>
                </div>
              ) : null}

              {/* Calculations History Table */}
              {distributorTrend.data_points.length > 0 && (
                <div className={styles.tableContainer}>
                  <div className={styles.tableTitle} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>
                      Calculation History Summary for {distributorTrend.distributor_name}
                    </span>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                      {/* Column Selector */}
                      <div style={{ position: 'relative' }}>
                        <button
                          className={styles.exportButton}
                          onClick={() => setShowColumnSelector(!showColumnSelector)}
                          style={{
                            padding: '0.5rem 1rem',
                            fontSize: '0.875rem',
                            boxShadow: '0 2px 6px rgba(184, 134, 11, 0.4)'
                          }}
                        >
                          Columns
                        </button>
                        {showColumnSelector && (
                          <div className={styles.columnSelector}>
                            <div className={styles.columnSelectorHeader}>
                              <strong>Select Columns</strong>
                              <button
                                onClick={() => setShowColumnSelector(false)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}
                              >
                                ✕
                              </button>
                            </div>
                            {allColumns.map(col => (
                              <label key={col.id} className={styles.columnOption}>
                                <input
                                  type="checkbox"
                                  checked={visibleColumns.includes(col.id)}
                                  onChange={() => toggleColumn(col.id)}
                                />
                                <span>{col.label}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Export Section */}
                      <div style={{ position: 'relative' }}>
                        <button
                          className={styles.exportButton}
                          onClick={() => setShowTableExportMenu(!showTableExportMenu)}
                          style={{
                            padding: '0.5rem 1rem',
                            fontSize: '0.875rem',
                            boxShadow: '0 2px 6px rgba(184, 134, 11, 0.4)'
                          }}
                        >
                          Export Table
                        </button>
                        {showTableExportMenu && (
                          <div className={styles.exportDropdown}>
                            <div className={styles.exportDropdownHeader}>
                              <strong>Table Exports</strong>
                              <button
                                onClick={() => setShowTableExportMenu(false)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}
                              >
                                ✕
                              </button>
                            </div>
                            <div className={styles.exportDropdownSection}>
                              <div className={styles.exportDropdownSectionTitle}>Summary Exports</div>
                              <button
                                className={styles.exportDropdownItem}
                                onClick={() => {
                                  exportSummaryToCSV(distributorTrend, fullCalculations);
                                  setShowTableExportMenu(false);
                                }}
                              >
                                📊 Summary CSV
                              </button>
                              <button
                                className={styles.exportDropdownItem}
                                onClick={() => {
                                  exportSummaryToPDF(distributorTrend, fullCalculations);
                                  setShowTableExportMenu(false);
                                }}
                              >
                                📄 Summary PDF
                              </button>
                            </div>
                            <div className={styles.exportDropdownSection}>
                              <div className={styles.exportDropdownSectionTitle}>Detailed Exports</div>
                              <button
                                className={styles.exportDropdownItem}
                                onClick={() => {
                                  exportDetailedToCSV(distributorTrend, fullCalculations);
                                  setShowTableExportMenu(false);
                                }}
                              >
                                📊 Detailed CSV
                              </button>
                              <button
                                className={styles.exportDropdownItem}
                                onClick={() => {
                                  exportDetailedToPDF(distributorTrend, fullCalculations);
                                  setShowTableExportMenu(false);
                                }}
                              >
                                📄 Detailed PDF
                              </button>
                            </div>
                            <div className={styles.exportDropdownSection}>
                              <div className={styles.exportDropdownSectionTitle}>Data Analysis</div>
                              <button
                                className={styles.exportDropdownItem}
                                onClick={() => {
                                  exportDataTableCSV(distributorTrend, fullCalculations);
                                  setShowTableExportMenu(false);
                                }}
                                title="Export in flat table format for pivot tables and data analysis"
                              >
                                📊 Data Table CSV
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className={styles.tableContent}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        {visibleColumns.includes('date') && <th>Date</th>}
                        {visibleColumns.includes('invoiceNumber') && <th>Invoice #</th>}
                        {visibleColumns.includes('products') && <th>Products</th>}
                        {visibleColumns.includes('pallets') && <th>Pallets</th>}
                        {visibleColumns.includes('unitsPerPallet') && <th>Units/Pallet</th>}
                        {visibleColumns.includes('totalUnits') && <th>Total Units</th>}
                        {visibleColumns.includes('totalCost') && <th>Total Cost</th>}
                        {visibleColumns.includes('costPerUnit') && <th>Cost Per Unit</th>}
                        {visibleColumns.includes('actions') && <th>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {distributorTrend.data_points.map((point) => {
                        const totalUnits = parseFloat(point.num_pallets) * parseFloat(point.units_per_pallet);
                        const fullCalc = fullCalculations.find(c => c?.id === point.calculation_id);
                        const products = fullCalc?.variant_data ? Object.keys(fullCalc.variant_data).join(', ') : '—';
                        return (
                          <tr key={point.calculation_id}>
                            {visibleColumns.includes('date') && <td>{formatDate(point.date)}</td>}
                            {visibleColumns.includes('invoiceNumber') && (
                              <td>
                                {fullCalc?.invoice_number || (fullCalc?.is_draft ? '—' : '—')}
                              </td>
                            )}
                            {visibleColumns.includes('products') && (
                              <td>
                                <strong>{products}</strong>
                              </td>
                            )}
                            {visibleColumns.includes('pallets') && <td>{point.num_pallets}</td>}
                            {visibleColumns.includes('unitsPerPallet') && <td>{point.units_per_pallet}</td>}
                            {visibleColumns.includes('totalUnits') && <td>{totalUnits.toLocaleString()}</td>}
                            {visibleColumns.includes('totalCost') && <td>{formatCurrency(point.total_distribution_cost)}</td>}
                            {visibleColumns.includes('costPerUnit') && (
                              <td className={styles.highlightCell}>
                                {formatCurrency(point.distribution_cost_per_unit)}
                              </td>
                            )}
                            {visibleColumns.includes('actions') && (
                              <td>
                                <button
                                  onClick={() => navigate(`/cpg/distribution-cost?calculation=${point.calculation_id}`)}
                                  className={styles.actionButton}
                                  title="Edit this calculation"
                                  style={{
                                    padding: '0.25rem 0.75rem',
                                    fontSize: '0.875rem',
                                    background: '#4b006e',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                  }}
                                >
                                  Edit
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                </div>
              )}

              {distributorTrend.data_points.length === 0 && (
                <div className={styles.noData}>
                  No distribution cost calculations found for this distributor in the selected date
                  range.
                </div>
              )}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
