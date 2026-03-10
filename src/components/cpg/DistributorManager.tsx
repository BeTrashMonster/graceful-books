/**
 * Distributor Manager Component
 *
 * Manage CPG distributors and their fee structures.
 *
 * Features:
 * - View all distributors
 * - Edit distributor details
 * - Archive/unarchive distributors
 * - Delete distributors with confirmation
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Modal } from '../modals/Modal';
import { Button } from '../core/Button';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../db/database';
import type { CPGDistributor, CPGDistributionCalculation } from '../../db/schema/cpg.schema';
import { DistributionCostCalculatorService } from '../../services/cpg/distributionCostCalculator.service';
import { DistributorProfileForm, type DistributorFormData } from './DistributorProfileForm';
import styles from './DistributorManager.module.css';

export interface DistributorManagerProps {
  isOpen: boolean;
  onClose: () => void;
  embedded?: boolean; // If true, render without Modal wrapper
}

export function DistributorManager({ isOpen, onClose, embedded = false }: DistributorManagerProps) {
  const { companyId, deviceId } = useAuth();
  const calculatorService = new DistributionCostCalculatorService(db);

  const [distributors, setDistributors] = useState<CPGDistributor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingDistributor, setEditingDistributor] = useState<CPGDistributor | null>(null);
  const [deletingDistributorId, setDeletingDistributorId] = useState<string | null>(null);
  const [showPermanentDeleteConfirm, setShowPermanentDeleteConfirm] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [affectedCalculations, setAffectedCalculations] = useState<CPGDistributionCalculation[]>([]);
  const [showRecalculateConfirm, setShowRecalculateConfirm] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<{
    distributorId: string;
    formData: DistributorFormData;
    oldFees: CPGDistributor['fee_structure'];
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'recent' | 'archived'>('name');
  const [archiveMessage, setArchiveMessage] = useState<string | null>(null);
  const [calculationData, setCalculationData] = useState<Record<string, { avgCostPerUnit: string; calcCount: number; latestCalcDate: number }>>({});
  const [selectedDistributorForInvoices, setSelectedDistributorForInvoices] = useState<CPGDistributor | null>(null);
  const [dateRangeFilter, setDateRangeFilter] = useState<
    'today' | 'yesterday' | '7days' | '30days' |
    'thisMonth' | 'lastMonth' | 'thisQuarter' | 'lastQuarter' | 'thisYear' | 'lastYear' |
    '6mo' | '12mo' | '24mo' |
    'all' | 'custom'
  >('12mo'); // Default to Last 12 Months
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [distributorInvoices, setDistributorInvoices] = useState<Record<string, CPGDistributionCalculation[]>>({});
  const [deletingCalculationId, setDeletingCalculationId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'date' | 'invoice' | 'totalCost' | 'costPerUnit'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc'); // Default newest first
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [checkNumber, setCheckNumber] = useState('');
  const navigate = useNavigate();

  /**
   * Get date range based on filter
   */
  const getDateRange = (): { start: number; end: number } => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

    if (dateRangeFilter === 'custom') {
      if (customStartDate && customEndDate) {
        // Parse dates manually in local time to avoid timezone issues
        const [startYear, startMonth, startDay] = customStartDate.split('-').map(Number);
        const [endYear, endMonth, endDay] = customEndDate.split('-').map(Number);

        // Create dates in local time (month is 0-indexed)
        const start = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0).getTime();
        const end = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999).getTime();

        return { start, end };
      }
      // If custom selected but dates not set, use all time
      return { start: 0, end: todayEnd };
    }

    switch (dateRangeFilter) {
      // Recent Activity
      case 'today':
        return { start: todayStart, end: todayEnd };

      case 'yesterday': {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0).getTime();
        const end = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999).getTime();
        return { start, end };
      }

      case '7days': {
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const start = new Date(sevenDaysAgo.getFullYear(), sevenDaysAgo.getMonth(), sevenDaysAgo.getDate(), 0, 0, 0, 0).getTime();
        return { start, end: todayEnd };
      }

      case '30days': {
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const start = new Date(thirtyDaysAgo.getFullYear(), thirtyDaysAgo.getMonth(), thirtyDaysAgo.getDate(), 0, 0, 0, 0).getTime();
        return { start, end: todayEnd };
      }

      // Calendar Periods
      case 'thisMonth': {
        const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime();
        return { start, end: todayEnd };
      }

      case 'lastMonth': {
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const start = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1, 0, 0, 0, 0).getTime();
        const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).getTime(); // Last day of previous month
        return { start, end };
      }

      case 'thisQuarter': {
        const quarter = Math.floor(now.getMonth() / 3);
        const start = new Date(now.getFullYear(), quarter * 3, 1, 0, 0, 0, 0).getTime();
        return { start, end: todayEnd };
      }

      case 'lastQuarter': {
        const currentQuarter = Math.floor(now.getMonth() / 3);
        const lastQuarter = currentQuarter === 0 ? 3 : currentQuarter - 1;
        const year = currentQuarter === 0 ? now.getFullYear() - 1 : now.getFullYear();
        const start = new Date(year, lastQuarter * 3, 1, 0, 0, 0, 0).getTime();
        const end = new Date(year, (lastQuarter + 1) * 3, 0, 23, 59, 59, 999).getTime(); // Last day of quarter
        return { start, end };
      }

      case 'thisYear': {
        const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0).getTime();
        return { start, end: todayEnd };
      }

      case 'lastYear': {
        const start = new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0, 0).getTime();
        const end = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999).getTime();
        return { start, end };
      }

      // Longer Trends
      case '6mo': {
        const sixMonthsAgo = new Date(now);
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const start = new Date(sixMonthsAgo.getFullYear(), sixMonthsAgo.getMonth(), sixMonthsAgo.getDate(), 0, 0, 0, 0).getTime();
        return { start, end: todayEnd };
      }

      case '12mo': {
        const twelveMonthsAgo = new Date(now);
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
        const start = new Date(twelveMonthsAgo.getFullYear(), twelveMonthsAgo.getMonth(), twelveMonthsAgo.getDate(), 0, 0, 0, 0).getTime();
        return { start, end: todayEnd };
      }

      case '24mo': {
        const twentyFourMonthsAgo = new Date(now);
        twentyFourMonthsAgo.setMonth(twentyFourMonthsAgo.getMonth() - 24);
        const start = new Date(twentyFourMonthsAgo.getFullYear(), twentyFourMonthsAgo.getMonth(), twentyFourMonthsAgo.getDate(), 0, 0, 0, 0).getTime();
        return { start, end: todayEnd };
      }

      // All Data
      case 'all':
      default:
        return { start: 0, end: todayEnd };
    }
  };

  /**
   * Auto-expand short years in date inputs (26 → 2026)
   */
  const handleDateBlur = (value: string, setter: (value: string) => void) => {
    if (!value) return;

    const parts = value.split('-');
    if (parts.length === 3) {
      let [year, month, day] = parts;

      // Parse year as integer
      const yearNum = parseInt(year, 10);

      // If year is 0-99, assume 20xx
      if (yearNum >= 0 && yearNum <= 99) {
        year = '20' + String(yearNum).padStart(2, '0');
        setter(`${year}-${month}-${day}`);
      }
    }
  };

  /**
   * Toggle sort direction or change sort field
   */
  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      // Toggle direction
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to descending for dates/costs, ascending for invoice numbers
      setSortField(field);
      setSortDirection(field === 'invoice' ? 'asc' : 'desc');
    }
  };

  /**
   * Sort invoices based on current sort settings
   */
  const sortInvoices = (invoices: CPGDistributionCalculation[]): CPGDistributionCalculation[] => {
    return [...invoices].sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortField) {
        case 'date':
          aVal = a.calculation_date;
          bVal = b.calculation_date;
          break;
        case 'invoice':
          aVal = a.invoice_number || '';
          bVal = b.invoice_number || '';
          break;
        case 'totalCost':
          aVal = parseFloat(a.total_distribution_cost);
          bVal = parseFloat(b.total_distribution_cost);
          break;
        case 'costPerUnit':
          aVal = parseFloat(a.distribution_cost_per_unit);
          bVal = parseFloat(b.distribution_cost_per_unit);
          break;
      }

      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      } else {
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
      }
    });
  };

  /**
   * Load calculation data for all distributors
   * Shows average distribution cost per unit from saved calculations
   * Respects date range filter
   */
  const loadCalculationData = async () => {
    if (!companyId) return;

    try {
      const allCalculations = await db.cpgDistributionCalculations
        .where('company_id')
        .equals(companyId)
        .and(calc => calc.active && !calc.deleted_at) // Only active, non-deleted
        .toArray();

      const { start, end } = getDateRange();

      // Filter by date range
      const calculations = allCalculations.filter(calc =>
        calc.calculation_date >= start && calc.calculation_date <= end
      );

      // Store full invoices grouped by distributor for inline display
      const invoicesByDistributor: Record<string, CPGDistributionCalculation[]> = {};
      calculations.forEach(calc => {
        if (!calc.distributor_id) return;

        if (!invoicesByDistributor[calc.distributor_id]) {
          invoicesByDistributor[calc.distributor_id] = [];
        }
        invoicesByDistributor[calc.distributor_id].push(calc);
      });

      // Don't sort here - let the drawer handle sorting dynamically
      setDistributorInvoices(invoicesByDistributor);

      // Group by distributor and calculate averages
      const dataByDistributor: Record<string, { total: number; count: number }> = {};

      calculations.forEach(calc => {
        if (!calc.distributor_id || !calc.distribution_cost_per_unit) {
          return;
        }

        if (!dataByDistributor[calc.distributor_id]) {
          dataByDistributor[calc.distributor_id] = { total: 0, count: 0 };
        }

        const costPerUnit = parseFloat(calc.distribution_cost_per_unit);

        if (!isNaN(costPerUnit)) {
          dataByDistributor[calc.distributor_id].total += costPerUnit;
          dataByDistributor[calc.distributor_id].count += 1;
        }
      });

      // Calculate averages and track latest calculation date
      const avgData: Record<string, { avgCostPerUnit: string; calcCount: number; latestCalcDate: number }> = {};

      // Group calculations by distributor and find latest date
      const latestDateByDistributor: Record<string, number> = {};
      calculations.forEach(calc => {
        if (!calc.distributor_id || !calc.calculation_date) return;

        const currentLatest = latestDateByDistributor[calc.distributor_id] || 0;
        latestDateByDistributor[calc.distributor_id] = Math.max(currentLatest, calc.calculation_date);
      });

      Object.entries(dataByDistributor).forEach(([distributorId, { total, count }]) => {
        if (count > 0) {
          avgData[distributorId] = {
            avgCostPerUnit: (total / count).toFixed(2),
            calcCount: count,
            latestCalcDate: latestDateByDistributor[distributorId] || 0,
          };
        }
      });

      setCalculationData(avgData);
    } catch (error) {
      console.error('Error loading calculation data:', error);
    }
  };

  /**
   * Generate smart cost information from actual calculation data
   */
  const getSmartCostInfo = (distributorId: string, distributorName: string): string => {
    const data = calculationData[distributorId];

    if (data) {
      // Blended format: Lead with cost, concise calc count
      if (data.calcCount === 1) {
        return `$${data.avgCostPerUnit}/unit`;
      } else {
        return `$${data.avgCostPerUnit}/unit (${data.calcCount} calcs)`;
      }
    } else {
      // No calculations yet
      return 'Run calculation to see distribution cost per unit';
    }
  };

  /**
   * Check if a distributor needs recalculation
   * Compares distributor's last update time with latest calculation date
   */
  const needsRecalculation = (distributor: CPGDistributor): boolean => {
    const data = calculationData[distributor.id];

    if (!data) {
      // No calculations yet - doesn't need "recalculation", needs initial calculation
      return false;
    }

    // If distributor was updated after the latest calculation, it needs recalculation
    return distributor.updated_at > data.latestCalcDate;
  };

  /**
   * Get user-friendly label for date range filter
   */
  const getDateRangeLabel = (): string => {
    switch (dateRangeFilter) {
      case 'today': return 'today';
      case 'yesterday': return 'yesterday';
      case '7days': return 'last 7 days';
      case '30days': return 'last 30 days';
      case 'thisMonth': return 'this month';
      case 'lastMonth': return 'last month';
      case 'thisQuarter': return 'this quarter';
      case 'lastQuarter': return 'last quarter';
      case 'thisYear': return 'this year';
      case 'lastYear': return 'last year';
      case '6mo': return 'last 6 months';
      case '12mo': return 'last 12 months';
      case '24mo': return 'last 24 months';
      case 'all': return 'all time';
      case 'custom': return customStartDate && customEndDate
        ? `${new Date(customStartDate).toLocaleDateString()} - ${new Date(customEndDate).toLocaleDateString()}`
        : 'custom range';
      default: return 'all time';
    }
  };

  /**
   * Format date for display
   */
  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  /**
   * Format currency for display
   */
  const formatCurrency = (value: string): string => {
    const num = parseFloat(value);
    return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  /**
   * Open invoice drawer for a distributor
   */
  const openInvoiceDrawer = (distributor: CPGDistributor) => {
    setSelectedDistributorForInvoices(distributor);
  };

  /**
   * Close invoice drawer
   */
  const closeInvoiceDrawer = () => {
    setSelectedDistributorForInvoices(null);
  };

  /**
   * Calculate amount due for an invoice
   */
  const getAmountDue = (invoice: CPGDistributionCalculation): string => {
    if (invoice.is_draft) return '0.00';
    const totalAmount = parseFloat(invoice.invoice_total_amount || invoice.total_distribution_cost);
    const amountPaid = parseFloat(invoice.amount_paid || '0');
    return (totalAmount - amountPaid).toFixed(2);
  };

  /**
   * Get payment status display text
   */
  const getPaymentStatus = (invoice: CPGDistributionCalculation): string => {
    if (invoice.is_draft) return 'Draft';
    return invoice.payment_status === 'paid' ? 'Paid'
      : invoice.payment_status === 'partially_paid' ? 'Partially Paid'
      : invoice.payment_status === 'unpaid' ? 'Unpaid'
      : 'Unpaid';
  };

  /**
   * Export invoices to CSV (Summary)
   */
  const exportToCSV = (distributor: CPGDistributor, invoices: CPGDistributionCalculation[]) => {
    // Sort invoices first
    const sortedInvoices = sortInvoices(invoices);

    // Create CSV header
    const headers = ['Date', 'Invoice #', 'Total Cost', 'Cost Per Unit', 'Payment Status', 'Amount Due'];

    // Create CSV rows
    const rows = sortedInvoices.map(invoice => [
      formatDate(invoice.calculation_date),
      invoice.invoice_number || '',
      invoice.total_distribution_cost,
      invoice.distribution_cost_per_unit,
      getPaymentStatus(invoice),
      getAmountDue(invoice)
    ]);

    // Combine header and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${distributor.name.replace(/[^a-z0-9]/gi, '_')}_invoices_summary_${getDateRangeLabel().replace(/\s+/g, '_')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /**
   * Export detailed data table CSV (like Analytics Data Table)
   */
  const exportDetailedDataTableCSV = (distributor: CPGDistributor, invoices: CPGDistributionCalculation[]) => {
    const sortedInvoices = sortInvoices(invoices);
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
      'Total Distribution Cost',
      'Payment Status',
      'Amount Due'
    ];
    rows.push(headers.join(','));

    // Data rows - one row per product per invoice
    sortedInvoices.forEach((invoice) => {
      if (!invoice) return;

      // Build product lookup from pallet_data
      const productLookup: Record<string, { pallet_number: number; quantity: number }> = {};
      if (invoice.pallet_data && invoice.pallet_data.length > 0) {
        invoice.pallet_data.forEach((pallet) => {
          pallet.products.forEach((product) => {
            productLookup[product.product_name] = {
              pallet_number: pallet.pallet_number,
              quantity: product.quantity
            };
          });
        });
      }

      // Get all products
      const products = Object.keys(invoice.variant_data || {});

      products.forEach((variant) => {
        const varData = invoice.variant_data[variant];
        const result = invoice.variant_results?.[variant];
        if (!result) return;

        // Get product-specific data
        const productInfo = productLookup[variant];
        const palletNum = productInfo ? productInfo.pallet_number : 'N/A';
        const productUnits = productInfo ? productInfo.quantity : 'N/A';

        const baseCPU = parseFloat(varData.base_cpu);
        const distCostPerUnit = parseFloat(invoice.distribution_cost_per_unit);
        const totalCPU = parseFloat(result.total_cpu);
        const price = parseFloat(varData.price_per_unit);
        const profitPerUnit = price - totalCPU;

        // Create a row for each fee (or one row if no fees)
        if (invoice.fee_breakdown && invoice.fee_breakdown.length > 0) {
          invoice.fee_breakdown.forEach((fee) => {
            rows.push([
              `"${formatDate(invoice.calculation_date)}"`,
              invoice.invoice_number || 'N/A',
              distributor.name,
              invoice.num_pallets,
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
              invoice.total_distribution_cost,
              getPaymentStatus(invoice),
              getAmountDue(invoice)
            ].join(','));
          });
        } else {
          // No fees, just product row
          rows.push([
            `"${formatDate(invoice.calculation_date)}"`,
            invoice.invoice_number || 'N/A',
            distributor.name,
            invoice.num_pallets,
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
            invoice.total_distribution_cost,
            getPaymentStatus(invoice),
            getAmountDue(invoice)
          ].join(','));
        }
      });
    });

    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${distributor.name.replace(/[^a-z0-9]/gi, '_')}_data_table_${getDateRangeLabel().replace(/\s+/g, '_')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /**
   * Export invoices to PDF
   */
  const exportToPDF = async (distributor: CPGDistributor, invoices: CPGDistributionCalculation[]) => {
    try {
      // Lazy-load pdfMake only when needed
      const pdfMake = await import('pdfmake/build/pdfmake');
      const pdfFonts = await import('pdfmake/build/vfs_fonts');

      // Initialize fonts
      (pdfMake as any).default.vfs = pdfFonts.default;

      // Sort invoices first
      const sortedInvoices = sortInvoices(invoices);
      const data = calculationData[distributor.id];

      // Prepare table data
      const tableBody = sortedInvoices.map(invoice => [
        formatDate(invoice.calculation_date),
        invoice.invoice_number || '—',
        formatCurrency(invoice.total_distribution_cost),
        formatCurrency(invoice.distribution_cost_per_unit),
        getPaymentStatus(invoice),
        formatCurrency(getAmountDue(invoice))
      ]);

      // Create PDF document definition
      const docDefinition: any = {
        content: [
          { text: distributor.name, style: 'header', margin: [0, 0, 0, 10] },
          { text: `Invoice History - ${getDateRangeLabel()}`, style: 'subheader', margin: [0, 0, 0, 5] },
          {
            text: [
              { text: 'Average Cost Per Unit: ', bold: true },
              data ? `$${data.avgCostPerUnit}` : 'N/A',
              { text: '  |  Total Invoices: ', bold: true },
              invoices.length.toString()
            ],
            margin: [0, 0, 0, 15],
            fontSize: 10
          },
          {
            table: {
              headerRows: 1,
              widths: ['auto', 'auto', 'auto', 'auto', 'auto', 'auto'],
              body: [
                [
                  { text: 'Date', style: 'tableHeader' },
                  { text: 'Invoice #', style: 'tableHeader' },
                  { text: 'Total Cost', style: 'tableHeader', alignment: 'right' },
                  { text: 'Cost/Unit', style: 'tableHeader', alignment: 'right' },
                  { text: 'Payment Status', style: 'tableHeader' },
                  { text: 'Amount Due', style: 'tableHeader', alignment: 'right' }
                ],
                ...tableBody.map(row => [
                  row[0],
                  row[1],
                  { text: row[2], alignment: 'right' },
                  { text: row[3], alignment: 'right' },
                  row[4],
                  { text: row[5], alignment: 'right' }
                ])
              ]
            },
            layout: {
              fillColor: (rowIndex: number) => rowIndex === 0 ? '#6366f1' : (rowIndex % 2 === 0 ? '#f9fafb' : null),
              hLineColor: () => '#e5e7eb',
              vLineColor: () => '#e5e7eb',
            }
          }
        ],
        styles: {
          header: {
            fontSize: 18,
            bold: true,
            color: '#111827'
          },
          subheader: {
            fontSize: 12,
            bold: true,
            color: '#6b7280'
          },
          tableHeader: {
            bold: true,
            fontSize: 10,
            color: 'white',
            fillColor: '#6366f1'
          }
        },
        defaultStyle: {
          fontSize: 9
        }
      };

      // Generate and download PDF
      const filename = `${distributor.name.replace(/[^a-z0-9]/gi, '_')}_invoices_${getDateRangeLabel().replace(/\s+/g, '_')}.pdf`;
      (pdfMake as any).default.createPdf(docDefinition).download(filename);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to export PDF. Please try again.');
    }
  };

  /**
   * Delete a calculation (permanently)
   */
  const handleDeleteCalculation = async (calculationId: string) => {
    try {
      // Permanently delete from database
      await db.cpgDistributionCalculations.delete(calculationId);

      // Reload data to reflect changes
      await loadCalculationData();

      // Close the confirmation modal
      setDeletingCalculationId(null);

      // Notify other parts of the app
      window.dispatchEvent(new CustomEvent('cpg-data-updated', { detail: { type: 'calculation' } }));
    } catch (error) {
      console.error('Error deleting calculation:', error);
      alert('Failed to delete calculation. Please try again.');
    }
  };

  /**
   * Handle payment submission
   */
  const handlePayInvoice = async () => {
    console.log('🔵 handlePayInvoice called');
    console.log('payingInvoiceId:', payingInvoiceId);
    console.log('deviceId:', deviceId);
    console.log('paymentAmount:', paymentAmount);

    if (!payingInvoiceId) {
      console.log('❌ Missing payingInvoiceId');
      return;
    }

    try {
      const invoice = Object.values(distributorInvoices)
        .flat()
        .find(inv => inv.id === payingInvoiceId);

      console.log('📄 Found invoice:', invoice);

      if (!invoice) {
        console.log('❌ Invoice not found');
        return;
      }

      const amount = parseFloat(paymentAmount);
      console.log('💰 Payment amount parsed:', amount);

      if (isNaN(amount) || amount <= 0) {
        alert('Please enter a valid payment amount');
        return;
      }

      const totalAmount = parseFloat(invoice.invoice_total_amount || invoice.total_distribution_cost);
      const currentPaid = parseFloat(invoice.amount_paid || '0');
      const newTotalPaid = currentPaid + amount;

      console.log('Total amount:', totalAmount);
      console.log('Current paid:', currentPaid);
      console.log('New total paid:', newTotalPaid);

      // Determine new payment status
      let newStatus: 'paid' | 'partially_paid' | 'unpaid';
      if (newTotalPaid >= totalAmount) {
        newStatus = 'paid';
      } else if (newTotalPaid > 0) {
        newStatus = 'partially_paid';
      } else {
        newStatus = 'unpaid';
      }

      console.log('New status:', newStatus);

      // Prepare update object
      const updateData: any = {
        payment_status: newStatus,
        amount_paid: newTotalPaid.toFixed(2),
        payment_date: Date.now(),
        payment_method: paymentMethod || null,
        check_number: checkNumber || null,
        updated_at: Date.now(),
      };

      // Only update version_vector if deviceId is available
      if (deviceId) {
        updateData.version_vector = {
          ...invoice.version_vector,
          [deviceId]: (invoice.version_vector[deviceId] || 0) + 1,
        };
      }

      // Update invoice
      console.log('🔄 Updating invoice...');
      await db.cpgDistributionCalculations.update(payingInvoiceId, updateData);

      console.log('✅ Invoice updated successfully');

      // Reset form and close modal
      setPayingInvoiceId(null);
      setPaymentAmount('');
      setPaymentMethod('');
      setCheckNumber('');

      // Reload data
      console.log('🔄 Reloading calculation data...');
      await loadCalculationData();

      // Notify other parts of the app
      window.dispatchEvent(new CustomEvent('cpg-data-updated', { detail: { type: 'calculation' } }));

      console.log('✅ Payment recorded successfully');
    } catch (error) {
      console.error('❌ Error recording payment:', error);
      alert('Failed to record payment. Please try again.');
    }
  };

  useEffect(() => {
    if ((!isOpen && !embedded) || !companyId) return;

    loadDistributors();
    loadCalculationData();

    // Listen for changes
    const handleUpdate = () => {
      loadDistributors();
      loadCalculationData();
    };
    window.addEventListener('cpg-data-updated', handleUpdate);
    return () => window.removeEventListener('cpg-data-updated', handleUpdate);
  }, [isOpen, embedded, companyId, dateRangeFilter, customStartDate, customEndDate]);

  const loadDistributors = async () => {
    if (!companyId) return;

    setIsLoading(true);
    try {
      const all = await db.cpgDistributors
        .where('company_id')
        .equals(companyId)
        .toArray();

      setDistributors(all); // Load all distributors, filter happens in render based on sortBy
    } catch (error) {
      console.error('Error loading distributors:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleArchive = async (distributor: CPGDistributor) => {
    if (!companyId || !deviceId) return;

    try {
      await db.cpgDistributors.update(distributor.id, {
        deleted_at: Date.now(),
        updated_at: Date.now(),
        version_vector: {
          ...distributor.version_vector,
          [deviceId]: (distributor.version_vector[deviceId] || 0) + 1,
        },
      });

      // Show success message
      setArchiveMessage(`"${distributor.name}" archived! Switch to "Archived Distributors" in the dropdown to restore it.`);
      setTimeout(() => setArchiveMessage(null), 20000); // Auto-hide after 20 seconds

      window.dispatchEvent(new CustomEvent('cpg-data-updated', { detail: { type: 'distributor' } }));
      loadDistributors();
    } catch (error) {
      console.error('Error archiving distributor:', error);
    }
  };

  const handleUnarchive = async (distributor: CPGDistributor) => {
    if (!companyId || !deviceId) return;

    try {
      await db.cpgDistributors.update(distributor.id, {
        deleted_at: null,
        updated_at: Date.now(),
        version_vector: {
          ...distributor.version_vector,
          [deviceId]: (distributor.version_vector[deviceId] || 0) + 1,
        },
      });

      window.dispatchEvent(new CustomEvent('cpg-data-updated', { detail: { type: 'distributor' } }));
      loadDistributors();
    } catch (error) {
      console.error('Error unarchiving distributor:', error);
    }
  };

  const handlePermanentDelete = async () => {
    if (!deletingDistributorId) return;

    try {
      await db.cpgDistributors.delete(deletingDistributorId);
      window.dispatchEvent(new CustomEvent('cpg-data-updated', { detail: { type: 'distributor' } }));
      setDeletingDistributorId(null);
      setShowPermanentDeleteConfirm(false);
      loadDistributors();
    } catch (error) {
      console.error('Error deleting distributor:', error);
    }
  };

  const handleCreateSubmit = async (formData: DistributorFormData) => {
    if (!companyId || !deviceId) return;

    setIsSaving(true);
    try {
      const distributor = await calculatorService.createDistributor(
        companyId,
        formData.name,
        formData.description,
        formData.contact_info,
        formData.fee_structure,
        deviceId,
        formData.last_fee_update_date,
        formData.typical_update_frequency
      );

      window.dispatchEvent(new CustomEvent('cpg-data-updated', { detail: { type: 'distributor' } }));
      setShowAddModal(false);
      loadDistributors();
    } catch (error) {
      console.error('Error creating distributor:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditSubmit = async (formData: DistributorFormData) => {
    if (!editingDistributor || !companyId || !deviceId) return;

    // Check if fees changed
    const feesChanged = JSON.stringify(editingDistributor.fee_structure) !== JSON.stringify(formData.fee_structure);

    if (feesChanged) {
      // Find affected calculations
      const calculations = await db.cpgDistributionCalculations
        .where('distributor_id')
        .equals(editingDistributor.id)
        .toArray();

      if (calculations.length > 0) {
        // Store pending update and show confirmation
        setPendingUpdate({
          distributorId: editingDistributor.id,
          formData,
          oldFees: editingDistributor.fee_structure,
        });
        setAffectedCalculations(calculations);
        setShowRecalculateConfirm(true);
        return;
      } else {
        // Fees changed but no calculations - still mark for update prompt
        await saveDistributorUpdate(editingDistributor.id, formData, true);
        return;
      }
    }

    // Fees didn't change - just save
    await saveDistributorUpdate(editingDistributor.id, formData, false);
  };

  const saveDistributorUpdate = async (distributorId: string, formData: DistributorFormData, feesChanged = false) => {
    if (!deviceId) return;

    setIsSaving(true);
    try {
      const distributor = await db.cpgDistributors.get(distributorId);
      if (!distributor) throw new Error('Distributor not found');

      // Update distributor - historical calculations remain unchanged
      await db.cpgDistributors.update(distributorId, {
        name: formData.name,
        description: formData.description,
        contact_info: formData.contact_info,
        fee_structure: formData.fee_structure,
        last_fee_update_date: formData.last_fee_update_date,
        typical_update_frequency: formData.typical_update_frequency,
        updated_at: Date.now(),
        version_vector: {
          ...distributor.version_vector,
          [deviceId]: (distributor.version_vector[deviceId] || 0) + 1,
        },
      });

      window.dispatchEvent(new CustomEvent('cpg-data-updated', { detail: { type: 'distributor' } }));
      setEditingDistributor(null);
      setPendingUpdate(null);
      setShowRecalculateConfirm(false);
      setAffectedCalculations([]);
      loadDistributors();
    } catch (error) {
      console.error('Error saving distributor:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRecalculateConfirm = async () => {
    if (!pendingUpdate) return;
    // Pass true to clear calculation data since fees changed
    await saveDistributorUpdate(pendingUpdate.distributorId, pendingUpdate.formData, true);
  };

  // Filter based on view mode (active vs archived)
  const isShowingArchived = sortBy === 'archived';
  const baseDistributors = isShowingArchived
    ? distributors.filter(d => d.deleted_at)
    : distributors.filter(d => d.active && !d.deleted_at);

  // Apply search filter
  const filteredDistributors = baseDistributors.filter(d =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d.description && d.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (d.contact_info && d.contact_info.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Apply sorting
  const sortedDistributors = [...filteredDistributors].sort((a, b) => {
    if (sortBy === 'recent') {
      return b.updated_at - a.updated_at;
    } else {
      // Default to alphabetical for both 'name' and 'archived'
      return a.name.localeCompare(b.name);
    }
  });

  // Main content to be rendered either in modal or embedded
  const managerContent = (
    <div className={embedded ? styles.embeddedContainer : styles.container}>
          {isLoading ? (
            <div className={styles.loadingState}>
              <div className={styles.loadingSpinner}>⏳</div>
              <p>Loading distributors...</p>
            </div>
          ) : (
            <>
              {distributors.length === 0 ? (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>📦</div>
                  <h3>No distributors yet</h3>
                  <p>Get started by adding your first distributor</p>
                  <Button
                    variant="primary"
                    onClick={() => setShowAddModal(true)}
                    style={{ marginTop: '1rem' }}
                  >
                    + Add Your First Distributor
                  </Button>
                </div>
              ) : (
                <>
                  {/* Search and Sort Controls */}
                  <div className={styles.controls}>
                    <div className={styles.searchWrapper}>
                      <span className={styles.searchIcon}>🔍</span>
                      <input
                        type="text"
                        placeholder="Search distributors..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className={styles.searchInput}
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className={styles.clearSearch}
                          aria-label="Clear search"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <select
                        value={dateRangeFilter}
                        onChange={(e) => setDateRangeFilter(e.target.value as typeof dateRangeFilter)}
                        className={styles.sortSelect}
                        title="Filter invoices by date range"
                      >
                        <optgroup label="Recent Activity">
                          <option value="today">Today</option>
                          <option value="yesterday">Yesterday</option>
                          <option value="7days">Last 7 Days</option>
                          <option value="30days">Last 30 Days</option>
                        </optgroup>
                        <optgroup label="Calendar Periods">
                          <option value="thisMonth">This Month</option>
                          <option value="lastMonth">Last Month</option>
                          <option value="thisQuarter">This Quarter</option>
                          <option value="lastQuarter">Last Quarter</option>
                          <option value="thisYear">This Year</option>
                          <option value="lastYear">Last Year</option>
                        </optgroup>
                        <optgroup label="Longer Trends">
                          <option value="6mo">Last 6 Months</option>
                          <option value="12mo">Last 12 Months</option>
                          <option value="24mo">Last 24 Months</option>
                        </optgroup>
                        <optgroup label="All Data">
                          <option value="all">All Time</option>
                          <option value="custom">Custom Range</option>
                        </optgroup>
                      </select>

                      {/* Custom Date Pickers on Dashboard */}
                      {dateRangeFilter === 'custom' && (
                        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                          <input
                            type="date"
                            value={customStartDate}
                            onChange={(e) => setCustomStartDate(e.target.value)}
                            onBlur={(e) => handleDateBlur(e.target.value, setCustomStartDate)}
                            placeholder="Start"
                            style={{
                              padding: '0.5rem',
                              border: '1px solid #d1d5db',
                              borderRadius: '6px',
                              fontSize: '0.875rem',
                              width: '140px',
                            }}
                          />
                          <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>to</span>
                          <input
                            type="date"
                            value={customEndDate}
                            onChange={(e) => setCustomEndDate(e.target.value)}
                            onBlur={(e) => handleDateBlur(e.target.value, setCustomEndDate)}
                            placeholder="End"
                            style={{
                              padding: '0.5rem',
                              border: '1px solid #d1d5db',
                              borderRadius: '6px',
                              fontSize: '0.875rem',
                              width: '140px',
                            }}
                          />
                        </div>
                      )}

                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as 'name' | 'recent' | 'archived')}
                        className={styles.sortSelect}
                      >
                        <option value="name">Sort A-Z</option>
                        <option value="recent">Recently Updated</option>
                        <option value="archived">Archived Distributors</option>
                      </select>
                    </div>
                  </div>

                  {/* Archive Success Message */}
                  {archiveMessage && (
                    <div className={styles.successMessage}>
                      <span className={styles.successIcon}>✓</span>
                      <span>{archiveMessage}</span>
                      <button
                        onClick={() => setArchiveMessage(null)}
                        className={styles.dismissButton}
                        aria-label="Dismiss"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {/* Active Distributors Grid */}
                  {sortedDistributors.length > 0 ? (
                    <div className={styles.distributorGrid}>
                      {sortedDistributors.map(distributor => {
                        const invoices = distributorInvoices[distributor.id] || [];
                        const hasInvoices = invoices.length > 0;

                        return (
                        <div key={distributor.id} className={styles.distributorCard}>
                          <div className={styles.cardHeader}>
                            <h4
                              className={styles.distributorName}
                              onClick={() => hasInvoices && !isShowingArchived && openInvoiceDrawer(distributor)}
                              style={{ cursor: hasInvoices && !isShowingArchived ? 'pointer' : 'default' }}
                            >
                              {distributor.name}
                              {isShowingArchived && (
                                <span className={styles.archivedBadge}>Archived</span>
                              )}
                            </h4>
                            {!isShowingArchived && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingDistributor(distributor);
                                }}
                                className={styles.iconButton}
                                aria-label="Edit distributor"
                                title="Edit"
                              >
                                ✏️
                              </button>
                            )}
                          </div>

                          {distributor.description && (
                            <p className={styles.distributorDescription}>{distributor.description}</p>
                          )}

                          {distributor.contact_info && (
                            <div className={styles.contactInfo}>
                              <span className={styles.contactIcon}>📞</span>
                              <span>{distributor.contact_info}</span>
                            </div>
                          )}

                          {/* Smart Cost Info - Calculated Data */}
                          <div className={styles.costSummary}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
                              {calculationData[distributor.id] && (
                                <button
                                  onClick={() => hasInvoices && openInvoiceDrawer(distributor)}
                                  className={styles.costText}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    padding: 0,
                                    cursor: hasInvoices ? 'pointer' : 'default',
                                    textAlign: 'left',
                                    color: hasInvoices ? '#6366f1' : 'inherit',
                                    textDecoration: hasInvoices ? 'underline' : 'none',
                                  }}
                                  disabled={!hasInvoices}
                                >
                                  {getSmartCostInfo(distributor.id, distributor.name)}
                                </button>
                              )}
                              {!calculationData[distributor.id] && (
                                <button
                                  onClick={() => {
                                    console.log('🔗 Attempting navigation to:', `/cpg/distribution-cost?tab=calculations&distributor=${distributor.id}`);
                                    window.location.href = `/cpg/distribution-cost?tab=calculations&distributor=${distributor.id}`;
                                  }}
                                  className={styles.costLink}
                                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
                                >
                                  Calculate cost per unit →
                                </button>
                              )}
                              {calculationData[distributor.id] && needsRecalculation(distributor) && (
                                <button
                                  onClick={() => {
                                    console.log('🔗 Attempting navigation to (update):', `/cpg/distribution-cost?tab=calculations&distributor=${distributor.id}`);
                                    window.location.href = `/cpg/distribution-cost?tab=calculations&distributor=${distributor.id}`;
                                  }}
                                  className={styles.updateLink}
                                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
                                >
                                  Run updated fees →
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Archive/Unarchive Action with Analytics Link */}
                          {isShowingArchived ? (
                            <button
                              onClick={() => handleUnarchive(distributor)}
                              className={styles.unarchiveButton}
                            >
                              Unarchive
                            </button>
                          ) : (
                            <div className={styles.archiveTextWrapper}>
                              <button
                                onClick={() => {
                                  window.location.href = `/cpg/distribution-cost?tab=costs&distributor=${distributor.id}`;
                                }}
                                className={styles.analyticsLink}
                              >
                                View Analytics →
                              </button>
                              <button
                                onClick={() => handleArchive(distributor)}
                                className={styles.archiveTextButton}
                              >
                                Archive
                              </button>
                            </div>
                          )}
                        </div>
                        ); // Closing return statement
                      })} {/* Closing map function */}
                    </div>
                  ) : (
                    <div className={styles.noResults}>
                      <p>No distributors match "{searchQuery}"</p>
                      <button
                        onClick={() => setSearchQuery('')}
                        className={styles.clearSearchButton}
                      >
                        Clear search
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
  );

  return (
    <>
      {embedded ? (
        <>
          {/* Embedded mode - render content directly */}
          {managerContent}
        </>
      ) : (
        <Modal
          isOpen={isOpen}
          onClose={onClose}
          title="Manage Distributors"
          size="lg"
          footer={
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'space-between', width: '100%' }}>
              <Button variant="outline" onClick={() => setShowAddModal(true)}>
                + Add Distributor
              </Button>
              <Button variant="primary" onClick={onClose}>
                Done
              </Button>
            </div>
          }
        >
          {managerContent}
        </Modal>
      )}

      {/* Add Distributor Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add New Distributor"
        size="xl"
        closeOnBackdropClick={false}
      >
        <DistributorProfileForm
          onSubmit={handleCreateSubmit}
          onCancel={() => setShowAddModal(false)}
          loading={isSaving}
        />
      </Modal>

      {/* Edit Distributor Modal */}
      <Modal
        isOpen={!!editingDistributor}
        onClose={() => setEditingDistributor(null)}
        title="Edit Distributor"
        size="xl"
        closeOnBackdropClick={false}
      >
        {editingDistributor && (
          <DistributorProfileForm
            distributor={editingDistributor}
            onSubmit={handleEditSubmit}
            onCancel={() => setEditingDistributor(null)}
            loading={isSaving}
          />
        )}
      </Modal>

      {/* Recalculation Confirmation Modal */}
      <Modal
        isOpen={showRecalculateConfirm}
        onClose={() => {
          setShowRecalculateConfirm(false);
          setPendingUpdate(null);
          setAffectedCalculations([]);
        }}
        title="Fee Structure Updated"
        size="md"
        closeOnBackdropClick={false}
        footer={
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', width: '100%' }}>
            <Button
              variant="outline"
              onClick={() => {
                setShowRecalculateConfirm(false);
                setPendingUpdate(null);
                setAffectedCalculations([]);
              }}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => handleRecalculateConfirm()}
              loading={isSaving}
              disabled={isSaving}
            >
              Save Changes
            </Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{
            padding: '1rem',
            backgroundColor: '#dbeafe',
            border: '1px solid #60a5fa',
            borderRadius: '8px',
          }}>
            <strong style={{ color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>ℹ️</span>
              <span>Fee Changes Detected</span>
            </strong>
            <p style={{ margin: '0.5rem 0 0', color: '#1e40af', fontSize: '0.875rem' }}>
              You have {affectedCalculations.length} existing calculation{affectedCalculations.length !== 1 ? 's' : ''} using the old fees. These will remain unchanged to preserve historical data.
            </p>
          </div>

          {pendingUpdate && (
            <div>
              <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>
                Fee Changes:
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem' }}>
                {(() => {
                  const oldFees = pendingUpdate.oldFees;
                  const newFees = pendingUpdate.formData.fee_structure;
                  const changes: JSX.Element[] = [];

                  // Find removed fees
                  oldFees.forEach((oldFee) => {
                    const stillExists = newFees.some(f => f.description === oldFee.description);
                    if (!stillExists) {
                      changes.push(
                        <div key={`removed-${oldFee.id}`} style={{
                          padding: '0.5rem',
                          backgroundColor: '#fee2e2',
                          borderRadius: '4px',
                          border: '1px solid #fecaca'
                        }}>
                          <span style={{ fontWeight: 500, color: '#991b1b' }}>
                            Removed: {oldFee.description} (${oldFee.amount})
                          </span>
                        </div>
                      );
                    }
                  });

                  // Find added or changed fees
                  newFees.forEach((newFee) => {
                    const oldFee = oldFees.find(f => f.description === newFee.description);

                    if (!oldFee) {
                      // New fee added
                      changes.push(
                        <div key={`added-${newFee.id}`} style={{
                          padding: '0.5rem',
                          backgroundColor: '#d1fae5',
                          borderRadius: '4px',
                          border: '1px solid #a7f3d0'
                        }}>
                          <span style={{ fontWeight: 500, color: '#065f46' }}>
                            Added: {newFee.description} (${newFee.amount})
                          </span>
                        </div>
                      );
                    } else if (oldFee.amount !== newFee.amount || oldFee.unit !== newFee.unit) {
                      // Fee changed
                      changes.push(
                        <div key={`changed-${newFee.id}`} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '0.5rem',
                          backgroundColor: '#fef3c7',
                          borderRadius: '4px',
                          border: '1px solid #fcd34d'
                        }}>
                          <span style={{ fontWeight: 500, color: '#92400e' }}>
                            {newFee.description}:
                          </span>
                          <span style={{ color: '#92400e' }}>
                            ${oldFee.amount} → ${newFee.amount}
                          </span>
                        </div>
                      );
                    }
                  });

                  return changes.length > 0 ? changes : (
                    <p style={{ color: '#6b7280', fontStyle: 'italic' }}>No fee changes detected</p>
                  );
                })()}
              </div>
            </div>
          )}

          <div>
            <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>
              Affected Scenarios:
            </h4>
            <div style={{
              maxHeight: '150px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem'
            }}>
              {affectedCalculations.map((calc) => (
                <div key={calc.id} style={{
                  padding: '0.5rem 0.75rem',
                  backgroundColor: '#f3f4f6',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  color: '#374151'
                }}>
                  {calc.calculation_name || `Calculation from ${new Date(calc.calculation_date).toLocaleDateString()}`}
                </div>
              ))}
            </div>
          </div>

          <div style={{
            padding: '1rem',
            backgroundColor: '#f0fdf4',
            border: '1px solid #86efac',
            borderRadius: '8px',
          }}>
            <strong style={{ color: '#166534', fontSize: '0.875rem' }}>💡 Next Step</strong>
            <p style={{ margin: '0.5rem 0 0', color: '#166534', fontSize: '0.875rem', lineHeight: '1.5' }}>
              After saving, run a new calculation with these updated fees to see how they affect your costs.
            </p>
          </div>
        </div>
      </Modal>

      {/* Permanent Delete Confirmation */}
      <Modal
        isOpen={showPermanentDeleteConfirm}
        onClose={() => {
          setShowPermanentDeleteConfirm(false);
          setDeletingDistributorId(null);
        }}
        title="Permanently Delete Distributor?"
        size="sm"
        footer={
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', width: '100%' }}>
            <Button
              variant="outline"
              onClick={() => {
                setShowPermanentDeleteConfirm(false);
                setDeletingDistributorId(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handlePermanentDelete}
              style={{ backgroundColor: '#dc2626' }}
            >
              Permanently Delete
            </Button>
          </div>
        }
      >
        <p style={{ marginBottom: '1rem', color: '#64748b' }}>
          Are you sure you want to permanently delete this distributor? This action cannot be undone.
        </p>
        <div style={{
          padding: '1rem',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          color: '#dc2626',
          fontSize: '0.875rem'
        }}>
          <strong>Warning:</strong> This will permanently remove all distributor data and cannot be recovered.
        </div>
      </Modal>

      {/* Pay Invoice Modal */}
      {payingInvoiceId && (() => {
        const invoice = Object.values(distributorInvoices)
          .flat()
          .find(inv => inv.id === payingInvoiceId);

        if (!invoice) return null;

        const totalAmount = parseFloat(invoice.invoice_total_amount || invoice.total_distribution_cost);
        const currentPaid = parseFloat(invoice.amount_paid || '0');
        const amountDue = totalAmount - currentPaid;

        return (
          <Modal
            isOpen={true}
            onClose={() => {
              setPayingInvoiceId(null);
              setPaymentAmount('');
              setPaymentMethod('');
              setCheckNumber('');
            }}
            title="Record Payment"
            size="md"
            footer={
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', width: '100%' }}>
                <Button
                  variant="outline"
                  onClick={() => {
                    setPayingInvoiceId(null);
                    setPaymentAmount('');
                    setPaymentMethod('');
                    setCheckNumber('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handlePayInvoice}
                  style={{ backgroundColor: '#10b981' }}
                >
                  Record Payment
                </Button>
              </div>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Invoice Info */}
              <div style={{
                padding: '1rem',
                background: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '0.875rem',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ color: '#6b7280' }}>Invoice #:</span>
                  <span style={{ fontWeight: 600, color: '#111827' }}>{invoice.invoice_number || 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ color: '#6b7280' }}>Total Amount:</span>
                  <span style={{ fontWeight: 600, color: '#111827' }}>{formatCurrency(totalAmount.toFixed(2))}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ color: '#6b7280' }}>Already Paid:</span>
                  <span style={{ fontWeight: 500, color: '#6b7280' }}>{formatCurrency(currentPaid.toFixed(2))}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid #e5e7eb' }}>
                  <span style={{ color: '#111827', fontWeight: 600 }}>Amount Due:</span>
                  <span style={{ fontWeight: 700, color: '#dc2626', fontSize: '1.125rem' }}>{formatCurrency(amountDue.toFixed(2))}</span>
                </div>
              </div>

              {/* Payment Form */}
              <div>
                <label htmlFor="payment-amount" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.5rem' }}>
                  Payment Amount *
                </label>
                <input
                  id="payment-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={amountDue}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0.00"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                  }}
                />
              </div>

              <div>
                <label htmlFor="payment-method" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.5rem' }}>
                  Payment Method
                </label>
                <select
                  id="payment-method"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                  }}
                >
                  <option value="">Select method...</option>
                  <option value="Check">Check</option>
                  <option value="ACH">ACH</option>
                  <option value="Wire Transfer">Wire Transfer</option>
                  <option value="Credit Card">Credit Card</option>
                  <option value="Cash">Cash</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {paymentMethod === 'Check' && (
                <div>
                  <label htmlFor="check-number" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.5rem' }}>
                    Check Number
                  </label>
                  <input
                    id="check-number"
                    type="text"
                    value={checkNumber}
                    onChange={(e) => setCheckNumber(e.target.value)}
                    placeholder="Enter check number"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                    }}
                  />
                </div>
              )}
            </div>
          </Modal>
        );
      })()}

      {/* Delete Calculation Confirmation - Rendered at top level so it appears above drawer */}
      {deletingCalculationId && (() => {
        const calculation = Object.values(distributorInvoices)
          .flat()
          .find(inv => inv.id === deletingCalculationId);

        return (
          <Modal
            isOpen={true}
            onClose={() => setDeletingCalculationId(null)}
            title="Delete Calculation?"
            size="sm"
            footer={
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', width: '100%' }}>
                <Button
                  variant="outline"
                  onClick={() => setDeletingCalculationId(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={() => handleDeleteCalculation(deletingCalculationId)}
                  style={{ backgroundColor: '#dc2626' }}
                >
                  Delete
                </Button>
              </div>
            }
          >
            <p style={{ marginBottom: '1rem', color: '#374151' }}>
              Are you sure you want to delete this calculation?
            </p>
            {calculation && (
              <div style={{
                padding: '1rem',
                background: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '0.875rem',
                marginBottom: '1rem',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ color: '#6b7280' }}>Date:</span>
                  <span style={{ fontWeight: 500, color: '#111827' }}>{formatDate(calculation.calculation_date)}</span>
                </div>
                {calculation.invoice_number && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: '#6b7280' }}>Invoice #:</span>
                    <span style={{ fontWeight: 500, color: '#111827' }}>{calculation.invoice_number}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>Total Cost:</span>
                  <span style={{ fontWeight: 600, color: '#111827' }}>{formatCurrency(calculation.total_distribution_cost)}</span>
                </div>
              </div>
            )}
            <div style={{
              padding: '0.75rem 1rem',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              color: '#991b1b',
              fontSize: '0.875rem'
            }}>
              <strong>Warning:</strong> This will permanently delete the calculation. This cannot be undone.
            </div>
          </Modal>
        );
      })()}

      {/* Invoice Drawer - Slide out from right */}
      {selectedDistributorForInvoices && (() => {
        const invoices = distributorInvoices[selectedDistributorForInvoices.id] || [];
        const data = calculationData[selectedDistributorForInvoices.id];

        return (
          <>
            {/* Backdrop */}
            <div
              onClick={closeInvoiceDrawer}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.5)',
                zIndex: 1000,
                animation: 'fadeIn 0.2s ease-out',
              }}
            />

            {/* Drawer */}
            <div
              style={{
                position: 'fixed',
                top: 0,
                right: 0,
                bottom: 0,
                width: 'min(800px, 90vw)',
                background: 'white',
                boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.15)',
                zIndex: 1001,
                display: 'flex',
                flexDirection: 'column',
                animation: 'slideInRight 0.3s ease-out',
              }}
            >
              {/* Header */}
              <div style={{
                padding: '1.5rem 2rem',
                borderBottom: '1px solid #e5e7eb',
                background: '#f9fafb',
              }}>
                {/* Top row: Name, Stats, and Buttons */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#111827', margin: '0 0 0.5rem 0' }}>
                      {selectedDistributorForInvoices.name}
                    </h2>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span>
                        {data ? `$${data.avgCostPerUnit}/unit average` : 'No calculations yet'}
                      </span>
                      <span>•</span>
                      <span>
                        📦 {invoices.length} invoice{invoices.length !== 1 ? 's' : ''} ({getDateRangeLabel()})
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons Group */}
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <button
                      onClick={() => {
                        setEditingDistributor(selectedDistributorForInvoices);
                        closeInvoiceDrawer();
                      }}
                      style={{
                        padding: '0.5rem 1rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        color: '#374151',
                        background: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f9fafb';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'white';
                      }}
                    >
                      <span>✏️</span>
                      Edit Distributor
                    </button>

                    <button
                      onClick={closeInvoiceDrawer}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '1.5rem',
                        cursor: 'pointer',
                        color: '#6b7280',
                        padding: '0.5rem',
                        lineHeight: 1,
                      }}
                      aria-label="Close"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Controls: Date Filter */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <label htmlFor="drawer-date-filter" style={{ fontSize: '0.875rem', color: '#6b7280', fontWeight: 500 }}>
                      Show invoices from:
                    </label>
                    <select
                      id="drawer-date-filter"
                      value={dateRangeFilter}
                      onChange={(e) => setDateRangeFilter(e.target.value as typeof dateRangeFilter)}
                      style={{
                        padding: '0.5rem 0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '0.875rem',
                        color: '#374151',
                        background: 'white',
                        cursor: 'pointer',
                      }}
                    >
                      <optgroup label="Recent Activity">
                        <option value="today">Today</option>
                        <option value="yesterday">Yesterday</option>
                        <option value="7days">Last 7 Days</option>
                        <option value="30days">Last 30 Days</option>
                      </optgroup>
                      <optgroup label="Calendar Periods">
                        <option value="thisMonth">This Month</option>
                        <option value="lastMonth">Last Month</option>
                        <option value="thisQuarter">This Quarter</option>
                        <option value="lastQuarter">Last Quarter</option>
                        <option value="thisYear">This Year</option>
                        <option value="lastYear">Last Year</option>
                      </optgroup>
                      <optgroup label="Longer Trends">
                        <option value="6mo">Last 6 Months</option>
                        <option value="12mo">Last 12 Months</option>
                        <option value="24mo">Last 24 Months</option>
                      </optgroup>
                      <optgroup label="All Data">
                        <option value="all">All Time</option>
                        <option value="custom">Custom Range</option>
                      </optgroup>
                    </select>
                  </div>

                  {/* Custom Date Pickers */}
                  {dateRangeFilter === 'custom' && (
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginLeft: '0.5rem' }}>
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        onBlur={(e) => handleDateBlur(e.target.value, setCustomStartDate)}
                        placeholder="Start date"
                        style={{
                          padding: '0.375rem 0.5rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          fontSize: '0.8125rem',
                        }}
                      />
                      <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>to</span>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        onBlur={(e) => handleDateBlur(e.target.value, setCustomEndDate)}
                        placeholder="End date"
                        style={{
                          padding: '0.375rem 0.5rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          fontSize: '0.8125rem',
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Content */}
              <div style={{ flex: 1, overflow: 'auto', padding: '2rem' }}>
                {/* Export Button */}
                <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={() => setShowExportMenu(!showExportMenu)}
                      style={{
                        padding: '0.5rem 1rem',
                        border: '1px solid #6366f1',
                        borderRadius: '6px',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        color: '#6366f1',
                        background: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#eef2ff';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'white';
                      }}
                    >
                      <span>📥</span>
                      Export
                      <span style={{ fontSize: '0.7rem' }}>▼</span>
                    </button>

                    {/* Export Menu Dropdown */}
                    {showExportMenu && (
                      <>
                        {/* Backdrop to close menu */}
                        <div
                          onClick={() => setShowExportMenu(false)}
                          style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            zIndex: 1,
                          }}
                        />
                        {/* Menu */}
                        <div
                          style={{
                            position: 'absolute',
                            top: 'calc(100% + 0.5rem)',
                            right: 0,
                            background: 'white',
                            border: '1px solid #e5e7eb',
                            borderRadius: '6px',
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                            zIndex: 2,
                            minWidth: '200px',
                          }}
                        >
                          {/* Summary Section */}
                          <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f3f4f6' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                              Summary
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              exportToCSV(selectedDistributorForInvoices, invoices);
                              setShowExportMenu(false);
                            }}
                            style={{
                              width: '100%',
                              padding: '0.75rem 1rem',
                              border: 'none',
                              background: 'none',
                              textAlign: 'left',
                              cursor: 'pointer',
                              fontSize: '0.875rem',
                              color: '#374151',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              transition: 'background 0.15s',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#f9fafb';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'none';
                            }}
                          >
                            <span>📊</span>
                            Summary CSV
                          </button>
                          <button
                            onClick={() => {
                              exportToPDF(selectedDistributorForInvoices, invoices);
                              setShowExportMenu(false);
                            }}
                            style={{
                              width: '100%',
                              padding: '0.75rem 1rem',
                              border: 'none',
                              background: 'none',
                              textAlign: 'left',
                              cursor: 'pointer',
                              fontSize: '0.875rem',
                              color: '#374151',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              transition: 'background 0.15s',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#f9fafb';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'none';
                            }}
                          >
                            <span>📄</span>
                            Summary PDF
                          </button>

                          {/* Detailed Section */}
                          <div style={{ padding: '0.5rem 0.75rem', borderTop: '1px solid #f3f4f6', borderBottom: '1px solid #f3f4f6', marginTop: '0.5rem' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                              Data Analysis
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              exportDetailedDataTableCSV(selectedDistributorForInvoices, invoices);
                              setShowExportMenu(false);
                            }}
                            title="Export detailed data table for pivot tables and analysis"
                            style={{
                              width: '100%',
                              padding: '0.75rem 1rem',
                              border: 'none',
                              background: 'none',
                              textAlign: 'left',
                              cursor: 'pointer',
                              fontSize: '0.875rem',
                              color: '#374151',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              transition: 'background 0.15s',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#f9fafb';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'none';
                            }}
                          >
                            <span>📊</span>
                            Data Table CSV
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {invoices.length > 0 ? (
                  <>
                    {invoices.length > 20 && (
                      <div style={{
                        padding: '0.75rem 1rem',
                        background: '#fef3c7',
                        border: '1px solid #fcd34d',
                        borderRadius: '8px',
                        marginBottom: '1.5rem',
                        fontSize: '0.875rem',
                        color: '#92400e',
                      }}>
                        💡 <strong>Tip:</strong> You have {invoices.length} invoices. Use the date filter at the top to focus on recent costs for more accurate averages.
                      </div>
                    )}

                    <table style={{ width: '100%', fontSize: '0.875rem', borderCollapse: 'separate', borderSpacing: 0 }}>
                      <thead>
                        <tr style={{ background: '#f9fafb' }}>
                          <th
                            onClick={() => handleSort('date')}
                            style={{
                              padding: '0.75rem 1rem',
                              textAlign: 'left',
                              fontWeight: 600,
                              color: '#6b7280',
                              borderBottom: '2px solid #e5e7eb',
                              cursor: 'pointer',
                              userSelect: 'none',
                              transition: 'color 0.15s',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = '#111827'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = '#6b7280'; }}
                          >
                            Date {sortField === 'date' && (sortDirection === 'asc' ? '▲' : '▼')}
                          </th>
                          <th
                            onClick={() => handleSort('invoice')}
                            style={{
                              padding: '0.75rem 1rem',
                              textAlign: 'left',
                              fontWeight: 600,
                              color: '#6b7280',
                              borderBottom: '2px solid #e5e7eb',
                              cursor: 'pointer',
                              userSelect: 'none',
                              transition: 'color 0.15s',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = '#111827'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = '#6b7280'; }}
                          >
                            Invoice # {sortField === 'invoice' && (sortDirection === 'asc' ? '▲' : '▼')}
                          </th>
                          <th
                            onClick={() => handleSort('totalCost')}
                            style={{
                              padding: '0.75rem 1rem',
                              textAlign: 'right',
                              fontWeight: 600,
                              color: '#6b7280',
                              borderBottom: '2px solid #e5e7eb',
                              cursor: 'pointer',
                              userSelect: 'none',
                              transition: 'color 0.15s',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = '#111827'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = '#6b7280'; }}
                          >
                            Total Cost {sortField === 'totalCost' && (sortDirection === 'asc' ? '▲' : '▼')}
                          </th>
                          <th
                            onClick={() => handleSort('costPerUnit')}
                            style={{
                              padding: '0.75rem 1rem',
                              textAlign: 'right',
                              fontWeight: 600,
                              color: '#6b7280',
                              borderBottom: '2px solid #e5e7eb',
                              cursor: 'pointer',
                              userSelect: 'none',
                              transition: 'color 0.15s',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = '#111827'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = '#6b7280'; }}
                          >
                            Cost/Unit {sortField === 'costPerUnit' && (sortDirection === 'asc' ? '▲' : '▼')}
                          </th>
                          <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 600, color: '#6b7280', borderBottom: '2px solid #e5e7eb' }}>
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortInvoices(invoices).map((invoice, index) => (
                          <tr
                            key={invoice.id}
                            style={{
                              background: index % 2 === 0 ? 'white' : '#f9fafb',
                              transition: 'background 0.15s',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#f3f4f6';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = index % 2 === 0 ? 'white' : '#f9fafb';
                            }}
                          >
                            <td style={{ padding: '0.75rem 1rem', color: '#374151', borderBottom: '1px solid #f3f4f6' }}>
                              {formatDate(invoice.calculation_date)}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', color: '#374151', borderBottom: '1px solid #f3f4f6' }}>
                              {invoice.invoice_number || '—'}
                              {invoice.is_draft && (
                                <span style={{
                                  marginLeft: '0.5rem',
                                  padding: '0.125rem 0.5rem',
                                  background: '#fef3c7',
                                  color: '#92400e',
                                  fontSize: '0.75rem',
                                  borderRadius: '4px',
                                  fontWeight: 500,
                                }}>
                                  Draft
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#111827', fontWeight: 600, borderBottom: '1px solid #f3f4f6' }}>
                              {formatCurrency(invoice.total_distribution_cost)}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#6b7280', borderBottom: '1px solid #f3f4f6' }}>
                              {formatCurrency(invoice.distribution_cost_per_unit)}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'center', borderBottom: '1px solid #f3f4f6' }}>
                              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                                <button
                                  onClick={() => {
                                    window.location.href = `/cpg/distribution-cost?tab=calculations&distributor=${selectedDistributorForInvoices.id}&calculation=${invoice.id}`;
                                  }}
                                  style={{
                                    background: '#6366f1',
                                    color: 'white',
                                    border: 'none',
                                    padding: '0.375rem 0.875rem',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '0.8125rem',
                                    fontWeight: 500,
                                    transition: 'background 0.15s',
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = '#4f46e5';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = '#6366f1';
                                  }}
                                >
                                  Edit
                                </button>
                                {!invoice.is_draft && invoice.payment_status !== 'paid' && (
                                  <button
                                    onClick={() => {
                                      setPayingInvoiceId(invoice.id);
                                      // Pre-fill with remaining amount
                                      const amountDue = getAmountDue(invoice);
                                      setPaymentAmount(amountDue);
                                    }}
                                    style={{
                                      background: '#10b981',
                                      color: 'white',
                                      border: 'none',
                                      padding: '0.375rem 0.875rem',
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      fontSize: '0.8125rem',
                                      fontWeight: 500,
                                      transition: 'background 0.15s',
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = '#059669';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = '#10b981';
                                    }}
                                  >
                                    Pay Invoice
                                  </button>
                                )}
                                <button
                                  onClick={() => setDeletingCalculationId(invoice.id)}
                                  style={{
                                    background: 'none',
                                    color: '#dc2626',
                                    border: '1px solid #fecaca',
                                    padding: '0.375rem 0.875rem',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '0.8125rem',
                                    fontWeight: 500,
                                    transition: 'all 0.15s',
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = '#fef2f2';
                                    e.currentTarget.style.borderColor = '#dc2626';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'none';
                                    e.currentTarget.style.borderColor = '#fecaca';
                                  }}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#6b7280' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>
                      No invoices yet
                    </h3>
                    <p style={{ marginBottom: '1.5rem' }}>
                      Run a calculation for this distributor to see invoice history here.
                    </p>
                    <button
                      onClick={() => {
                        window.location.href = `/cpg/distribution-cost?tab=calculations&distributor=${selectedDistributorForInvoices.id}`;
                      }}
                      style={{
                        background: '#6366f1',
                        color: 'white',
                        border: 'none',
                        padding: '0.75rem 1.5rem',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                      }}
                    >
                      Run First Calculation →
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Add keyframe animations */}
            <style>{`
              @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
              }
              @keyframes slideInRight {
                from {
                  transform: translateX(100%);
                  opacity: 0;
                }
                to {
                  transform: translateX(0);
                  opacity: 1;
                }
              }
            `}</style>
          </>
        );
      })()}
    </>
  );
}
