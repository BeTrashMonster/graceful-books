import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PinIcon } from '../../components/common/PinIcon';
import { useTabPinning } from '../../hooks/useTabPinning';
import { PAGE_IDS } from '../../db/schema/tabPreferences.schema';
import { DistributorSelector } from '../../components/cpg/DistributorSelector';
import { DistributorProfileForm } from '../../components/cpg/DistributorProfileForm';
import { DistributionCalculatorForm } from '../../components/cpg/DistributionCalculatorForm';
import { DistributionResultsDisplay } from '../../components/cpg/DistributionResultsDisplay';
import { DistributorManager } from '../../components/cpg/DistributorManager';
import { SavedScenarios } from '../../components/cpg/SavedScenarios';
import { Modal } from '../../components/modals/Modal';
import { Button } from '../../components/core/Button';
import { Loading } from '../../components/feedback/Loading';
import { ErrorMessage } from '../../components/feedback/ErrorMessage';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../db/database';
import type { CPGDistributor, CPGDistributionCalculation } from '../../db/schema/cpg.schema';
import type {
  DistributionCalcParams,
  DistributionCostResult,
} from '../../services/cpg/distributionCostCalculator.service';
import { DistributionCostCalculatorService } from '../../services/cpg/distributionCostCalculator.service';
import type { DistributorFormData } from '../../components/cpg/DistributorProfileForm';
import { DistributorCostsTab } from './tabs/DistributorCostsTab';
import styles from './Distribution.module.css';

type ViewMode = 'manage' | 'costs' | 'calculations' | 'scenarios';

/**
 * Distribution Page
 *
 * Main page for distribution cost analysis and distributor management.
 *
 * Requirements: Group C2 - Distribution Cost Analyzer
 *
 * Features:
 * - Two-tab structure: Cost Calculations | Manage Distributors
 * - Cost Calculations: Calculate distribution costs and profit margins
 * - Manage Distributors: Full CRUD for distributor profiles
 *
 * @example
 * Route: /cpg/distribution?tab=calculations (default)
 * Route: /cpg/distribution?tab=manage
 */
export default function Distribution() {
  const [searchParams] = useSearchParams();

  // Get initial tab from URL parameter, default to 'manage'
  const tabParam = searchParams.get('tab') as ViewMode | null;
  const initialTab = tabParam && ['manage', 'costs', 'calculations', 'scenarios'].includes(tabParam)
    ? tabParam
    : 'manage';

  // Get initial distributor and calculation from URL parameters
  const distributorParam = searchParams.get('distributor');
  const calculationParam = searchParams.get('calculation');

  // Tab pinning
  const { defaultTab, pinTab, unpinTab, isTabPinned, isLoading: isPinningLoading } = useTabPinning({
    pageId: PAGE_IDS.DISTRIBUTION_CENTER,
  });

  const [viewMode, setViewMode] = useState<ViewMode>('manage');
  const [pinnedTabs, setPinnedTabs] = useState<Record<string, boolean>>({});

  // Update active tab when pinned default loads
  useEffect(() => {
    if (!isPinningLoading && defaultTab) {
      setViewMode(defaultTab as ViewMode);
    } else if (!isPinningLoading && initialTab) {
      setViewMode(initialTab);
    }
  }, [defaultTab, isPinningLoading, initialTab]);

  // Load pinned tabs state
  useEffect(() => {
    const loadPinnedState = async () => {
      const states: Record<string, boolean> = {};
      const tabs: ViewMode[] = ['manage', 'costs', 'calculations', 'scenarios'];

      for (const tab of tabs) {
        states[tab] = await isTabPinned(tab);
      }

      setPinnedTabs(states);
    };

    loadPinnedState();
  }, [isTabPinned]);

  // State
  const [distributors, setDistributors] = useState<CPGDistributor[]>([]);
  const [selectedDistributorId, setSelectedDistributorId] = useState<string | null>(distributorParam);
  const [selectedDistributor, setSelectedDistributor] = useState<CPGDistributor | null>(null);
  const [calculationResults, setCalculationResults] = useState<DistributionCostResult | null>(
    null
  );
  const [lastCalculationParams, setLastCalculationParams] = useState<DistributionCalcParams | null>(
    null
  );
  const [loadedScenarioParams, setLoadedScenarioParams] = useState<DistributionCalcParams | null>(
    null
  );

  // Modal states
  const [showAddDistributorModal, setShowAddDistributorModal] = useState(false);
  const [showEditDistributorModal, setShowEditDistributorModal] = useState(false);
  const [showSaveScenarioModal, setShowSaveScenarioModal] = useState(false);
  const [saveMode, setSaveMode] = useState<'draft' | 'invoice' | null>(null); // null = choice screen
  const [isConvertingDraft, setIsConvertingDraft] = useState(false);
  const [draftToConvert, setDraftToConvert] = useState<CPGDistributionCalculation | null>(null);
  const [loadedDraftId, setLoadedDraftId] = useState<string | null>(null);
  const [editingCalculationId, setEditingCalculationId] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalMessage, setSuccessModalMessage] = useState('');
  const [showUnsavedWarningModal, setShowUnsavedWarningModal] = useState(false);
  const [showClearDataModal, setShowClearDataModal] = useState(false);

  // Track unsaved calculation results
  const [hasUnsavedResults, setHasUnsavedResults] = useState(false);

  // Track if form has been modified since last calculation
  const [formModifiedSinceCalculation, setFormModifiedSinceCalculation] = useState(false);

  // Calculation date (default to today in local timezone)
  const [calculationDate, setCalculationDate] = useState<string>(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  // Scenario name (for drafts)
  const [scenarioName, setScenarioName] = useState<string>('');

  // Invoice & Payment fields
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [invoiceTotalAmount, setInvoiceTotalAmount] = useState<string>('');
  const [invoiceDueDate, setInvoiceDueDate] = useState<string>('');
  const [paymentStatus, setPaymentStatus] = useState<'unpaid' | 'partially_paid' | 'paid'>('unpaid');
  const [amountPaid, setAmountPaid] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [paymentAccountId, setPaymentAccountId] = useState<string>('');
  const [checkNumber, setCheckNumber] = useState<string>('');
  const [paymentAccounts, setPaymentAccounts] = useState<Array<{ id: string; name: string; code: string; type: string }>>([]);
  const [hasChartOfAccounts, setHasChartOfAccounts] = useState<boolean>(false);

  // Loading and error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [savingDistributor, setSavingDistributor] = useState(false);
  const [savingScenario, setSavingScenario] = useState(false);

  // Auth context
  const { companyId, deviceId, currentCompany, isLoading: authLoading } = useAuth();

  // Service
  const [calculatorService] = useState(
    () => new DistributionCostCalculatorService(db)
  );

  // Apply purple header styling to distributor modals
  useEffect(() => {
    if (!showAddDistributorModal && !showEditDistributorModal) return;

    const timer = setTimeout(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return;

      const modalTitle = dialog.querySelector('#modal-title') as HTMLElement;
      const modalHeader = modalTitle?.parentElement as HTMLElement;
      const closeButton = dialog.querySelector('[aria-label="Close modal"]') as HTMLElement;

      if (modalHeader) {
        modalHeader.style.backgroundColor = '#4b006e';
        modalHeader.style.padding = '0.75rem 1.5rem';
        modalHeader.style.borderBottom = 'none';
      }

      if (modalTitle) {
        modalTitle.style.color = '#ffffff';
      }

      if (closeButton) {
        closeButton.style.color = '#ffffff';
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [showAddDistributorModal, showEditDistributorModal]);

  // Load distributors and payment accounts
  useEffect(() => {
    loadDistributors();
    loadPaymentAccounts();
  }, [companyId]);

  // Listen for data updates from modals (e.g., distributor added/edited)
  useEffect(() => {
    const handleDataUpdate = (event: CustomEvent) => {
      // Reload distributors when distributor data changes
      if (event.detail?.type === 'distributor') {
        loadDistributors();
      }
    };

    window.addEventListener('cpg-data-updated', handleDataUpdate as EventListener);
    return () => {
      window.removeEventListener('cpg-data-updated', handleDataUpdate as EventListener);
    };
  }, [companyId]);

  // Load calculation from URL parameter (for editing)
  useEffect(() => {
    if (calculationParam && distributors.length > 0) {
      loadCalculationFromUrl(calculationParam);
    }
  }, [calculationParam, distributors]);

  // Warn before closing/refreshing if there are unsaved results
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedResults) {
        e.preventDefault();
        e.returnValue = ''; // Chrome requires returnValue to be set
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedResults]);

  // Update selected distributor when selection changes
  useEffect(() => {
    if (selectedDistributorId) {
      const distributor = distributors.find((d) => d.id === selectedDistributorId);
      setSelectedDistributor(distributor || null);
    } else {
      setSelectedDistributor(null);
    }
  }, [selectedDistributorId, distributors]);

  const loadDistributors = async () => {
    try {
      setLoading(true);
      setError(null);

      const allDistributors = await db.cpgDistributors
        .where('company_id')
        .equals(companyId)
        .toArray();

      setDistributors(allDistributors);
    } catch (err) {
      console.error('Error loading distributors:', err);
      setError('Oops! We had trouble loading your distributors. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadPaymentAccounts = async () => {
    try {
      // Check if they have Chart of Accounts (bookkeeping side)
      // Require at least 5 accounts to distinguish from auto-created accounts
      const anyAccountsCount = await db.accounts
        .where('company_id')
        .equals(companyId)
        .and((acc) => acc.active && !acc.deleted_at)
        .count();

      setHasChartOfAccounts(anyAccountsCount >= 5);

      // Load bank, cash, and credit card accounts from Chart of Accounts
      const accounts = await db.accounts
        .where('[company_id+type]')
        .equals([companyId, 'ASSET'])
        .and((acc) => {
          // Only include active accounts
          if (!acc.active || acc.deleted_at) return false;

          // Include if subType is Bank, Cash, or Credit Card
          // OR if account name contains these keywords
          const subType = (acc.subType || '').toLowerCase();
          const name = (acc.name || '').toLowerCase();

          return (
            subType.includes('bank') ||
            subType.includes('cash') ||
            subType.includes('credit') ||
            subType.includes('checking') ||
            subType.includes('savings') ||
            name.includes('bank') ||
            name.includes('cash') ||
            name.includes('credit') ||
            name.includes('checking') ||
            name.includes('savings')
          );
        })
        .toArray();

      // Format for dropdown
      const formatted = accounts.map(acc => ({
        id: acc.id,
        name: acc.name,
        code: acc.account_number || acc.account_code || '',
        type: acc.subType || '',
      }));

      setPaymentAccounts(formatted);
    } catch (err) {
      console.error('Error loading payment accounts:', err);
      // Don't set error state - just means no bookkeeping, will show simple dropdown
      setPaymentAccounts([]);
      setHasChartOfAccounts(false);
    }
  };

  const loadCalculationFromUrl = async (calculationId: string) => {
    try {
      setLoading(true);
      const calculation = await db.cpgDistributionCalculations.get(calculationId);

      if (!calculation) {
        setError('Calculation not found');
        return;
      }

      // Set the distributor
      setSelectedDistributorId(calculation.distributor_id);

      // Set editing mode
      setEditingCalculationId(calculationId);

      // Build the params to load into the form
      // Rebuild variantData with quantities from pallet_data
      const variantDataWithQuantities: Record<string, { price_per_unit: string; base_cpu: string; quantity: number }> = {};

      if (calculation.pallet_data && calculation.pallet_data.length > 0) {
        // Aggregate quantities from pallet_data
        calculation.pallet_data.forEach((pallet: any) => {
          pallet.products.forEach((product: any) => {
            if (variantDataWithQuantities[product.product_name]) {
              variantDataWithQuantities[product.product_name].quantity += product.quantity;
            } else {
              variantDataWithQuantities[product.product_name] = {
                price_per_unit: product.price_per_unit,
                base_cpu: product.base_cpu,
                quantity: product.quantity,
              };
            }
          });
        });
      } else {
        // Fallback: use variant_data from database (old calculations without pallet_data)
        Object.entries(calculation.variant_data).forEach(([productName, data]: [string, any]) => {
          variantDataWithQuantities[productName] = {
            price_per_unit: data.price_per_unit,
            base_cpu: data.base_cpu,
            quantity: data.quantity || 0,
          };
        });
      }

      const params: DistributionCalcParams = {
        distributorId: calculation.distributor_id,
        numPallets: calculation.num_pallets,
        unitsPerPallet: calculation.units_per_pallet,
        pallet_data: calculation.pallet_data || [], // Load accurate pallet structure
        variantData: variantDataWithQuantities,
        selectedFees: calculation.selected_fees,
        msrpMarkupPercentage: calculation.msrp_markup_percentage || undefined,
      };

      setLoadedScenarioParams(params);

      // Set calculation date
      if (calculation.calculation_date) {
        const date = new Date(calculation.calculation_date);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        setCalculationDate(`${year}-${month}-${day}`);
      }

      // If it's an invoice (not a draft), pre-fill invoice fields
      if (!calculation.is_draft) {
        setScenarioName(calculation.calculation_name || '');
        setInvoiceNumber(calculation.invoice_number || '');
        setInvoiceTotalAmount(calculation.invoice_total_amount || '');

        if (calculation.invoice_due_date) {
          const dueDate = new Date(calculation.invoice_due_date);
          const year = dueDate.getFullYear();
          const month = String(dueDate.getMonth() + 1).padStart(2, '0');
          const day = String(dueDate.getDate()).padStart(2, '0');
          setInvoiceDueDate(`${year}-${month}-${day}`);
        }

        setPaymentStatus(calculation.payment_status || 'unpaid');
        setAmountPaid(calculation.amount_paid || '');

        if (calculation.payment_date) {
          const paymentDate = new Date(calculation.payment_date);
          const year = paymentDate.getFullYear();
          const month = String(paymentDate.getMonth() + 1).padStart(2, '0');
          const day = String(paymentDate.getDate()).padStart(2, '0');
          setPaymentDate(`${year}-${month}-${day}`);
        }

        setPaymentMethod(calculation.payment_method || '');
        setPaymentAccountId(calculation.payment_account_id || '');
        setCheckNumber(calculation.check_number || '');
      } else {
        // It's a draft
        setScenarioName(calculation.calculation_name || '');
      }

      // Load saved results (don't recalculate - would trigger validation errors on old IDs)
      const results: DistributionCostResult = {
        distributorId: calculation.distributor_id,
        totalDistributionCost: calculation.total_distribution_cost,
        distributionCostPerUnit: calculation.distribution_cost_per_unit,
        variantResults: calculation.variant_results || {},
        feeBreakdown: calculation.fee_breakdown || [],
      };

      setCalculationResults(results);
      setLastCalculationParams(params);
      setHasUnsavedResults(false); // It's already saved
      setFormModifiedSinceCalculation(false); // Form loaded from saved data, not modified

    } catch (err) {
      console.error('Error loading calculation:', err);
      setError('Failed to load calculation');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDistributor = async (data: DistributorFormData) => {
    try {
      setSavingDistributor(true);
      setError(null);

      const distributor = await calculatorService.createDistributor(
        companyId,
        data.name,
        data.description,
        data.contact_info,
        data.fee_structure,
        deviceId,
        data.last_fee_update_date,
        data.typical_update_frequency
      );

      setDistributors([...distributors, distributor]);
      setSelectedDistributorId(distributor.id);
      setShowAddDistributorModal(false);

      // Dispatch event to notify other components
      window.dispatchEvent(
        new CustomEvent('cpg-data-updated', { detail: { type: 'distributor' } })
      );

      // Show success modal
      setSuccessModalMessage(`Distributor "${distributor.name}" created successfully! You can now use it to calculate distribution costs.`);
      setShowSuccessModal(true);
    } catch (err) {
      console.error('Error creating distributor:', err);
      setError('Oops! We had trouble creating the distributor. Please try again.');
    } finally {
      setSavingDistributor(false);
    }
  };

  const handleUpdateDistributor = async (data: DistributorFormData) => {
    if (!selectedDistributor) return;

    try {
      setSavingDistributor(true);
      setError(null);

      const updated = await calculatorService.updateDistributor(
        selectedDistributor.id,
        {
          name: data.name,
          description: data.description,
          contact_info: data.contact_info,
          fee_structure: data.fee_structure,
          last_fee_update_date: data.last_fee_update_date,
          typical_update_frequency: data.typical_update_frequency,
        },
        deviceId
      );

      setDistributors(
        distributors.map((d) => (d.id === updated.id ? updated : d))
      );
      setShowEditDistributorModal(false);

      // Dispatch event to notify other components
      window.dispatchEvent(
        new CustomEvent('cpg-data-updated', { detail: { type: 'distributor' } })
      );

      // Show success modal
      setSuccessModalMessage(`Distributor "${updated.name}" updated successfully!`);
      setShowSuccessModal(true);
    } catch (err) {
      console.error('Error updating distributor:', err);
      setError('Oops! We had trouble updating the distributor. Please try again.');
    } finally {
      setSavingDistributor(false);
    }
  };

  const handleFormChange = () => {
    // When the form changes, mark it as modified
    setFormModifiedSinceCalculation(true);
  };

  const handleCalculate = async (params: DistributionCalcParams) => {
    try {
      setCalculating(true);
      setError(null);

      // Only clear loaded scenario params when NOT in edit mode
      // In edit mode, we want to keep the scenario loaded so we can update it
      if (!editingCalculationId) {
        setLoadedScenarioParams(null);
        setLoadedDraftId(null); // Clear draft tracking since they're making changes
      }

      const results = await calculatorService.calculateDistributionCost(params);
      setCalculationResults(results);
      setLastCalculationParams(params); // Store params for saving later
      setHasUnsavedResults(true); // Mark as unsaved
      setFormModifiedSinceCalculation(false); // Clear the modified flag since we just calculated

      // Don't auto-scroll - let users control their view position
    } catch (err) {
      console.error('Error calculating distribution costs:', err);
      setError('Oops! We had trouble calculating the costs. Please check your inputs.');
    } finally {
      setCalculating(false);
    }
  };

  const handleTabSwitch = (newTab: ViewMode) => {
    if (hasUnsavedResults && viewMode === 'calculations') {
      setShowUnsavedWarningModal(true);
    } else {
      setViewMode(newTab);
    }
  };

  const confirmTabSwitch = (newTab: ViewMode) => {
    setHasUnsavedResults(false);
    setShowUnsavedWarningModal(false);
    setViewMode(newTab);
  };

  // Handle tab pin toggle
  const handlePinToggle = async (tabId: ViewMode) => {
    const currentlyPinned = pinnedTabs[tabId];

    try {
      if (currentlyPinned) {
        await unpinTab();
        setPinnedTabs((prev) => ({ ...prev, [tabId]: false }));
      } else {
        await pinTab(tabId);
        setPinnedTabs({
          manage: tabId === 'manage',
          costs: tabId === 'costs',
          calculations: tabId === 'calculations',
          scenarios: tabId === 'scenarios',
        });
      }
    } catch (error) {
      console.error('Failed to toggle pin:', error);
    }
  };

  const handleClearData = () => {
    if (hasUnsavedResults || calculationResults) {
      setShowClearDataModal(true);
    } else {
      // Nothing to clear
      return;
    }
  };

  const confirmClearData = () => {
    setCalculationResults(null);
    setLastCalculationParams(null);
    setLoadedScenarioParams(null);
    setLoadedDraftId(null);
    setEditingCalculationId(null);
    setHasUnsavedResults(false);
    setShowClearDataModal(false);
    setError(null);

    // Reset form by changing distributor selection (triggers form reset)
    const currentDistributor = selectedDistributorId;
    setSelectedDistributorId(null);
    setTimeout(() => {
      setSelectedDistributorId(currentDistributor);
    }, 0);
  };

  const handleDateBlur = (value: string, setter: (value: string) => void) => {
    if (!value) return;

    // Handle partial year input (e.g., "0026-02-18" -> "2026-02-18")
    const parts = value.split('-');
    if (parts.length === 3) {
      let [year, month, day] = parts;

      // Parse year as integer to remove leading zeros
      const yearNum = parseInt(year, 10);

      // If year is 0-99, assume 20xx (only when user is done typing)
      if (yearNum >= 0 && yearNum <= 99 && year.length === 4) {
        year = '20' + String(yearNum).padStart(2, '0');
        setter(`${year}-${month}-${day}`);
      }
    }
  };

  const handleLoadScenario = async (scenario: CPGDistributionCalculation) => {
    try {
      setError(null);

      // Set the distributor from the scenario
      setSelectedDistributorId(scenario.distributor_id);

      // Prepare calculation parameters from the scenario
      // Rebuild variantData with quantities from pallet_data
      const variantDataWithQuantities: Record<string, { price_per_unit: string; base_cpu: string; quantity: number }> = {};

      if (scenario.pallet_data && scenario.pallet_data.length > 0) {
        // Aggregate quantities from pallet_data
        scenario.pallet_data.forEach((pallet: any) => {
          pallet.products.forEach((product: any) => {
            if (variantDataWithQuantities[product.product_name]) {
              variantDataWithQuantities[product.product_name].quantity += product.quantity;
            } else {
              variantDataWithQuantities[product.product_name] = {
                price_per_unit: product.price_per_unit,
                base_cpu: product.base_cpu,
                quantity: product.quantity,
              };
            }
          });
        });
      } else {
        // Fallback: use variant_data from database (old calculations without pallet_data)
        Object.entries(scenario.variant_data).forEach(([productName, data]: [string, any]) => {
          variantDataWithQuantities[productName] = {
            price_per_unit: data.price_per_unit,
            base_cpu: data.base_cpu,
            quantity: data.quantity || 0,
          };
        });
      }

      const params: DistributionCalcParams = {
        distributorId: scenario.distributor_id,
        numPallets: scenario.num_pallets,
        unitsPerPallet: scenario.units_per_pallet,
        pallet_data: scenario.pallet_data || [], // Load accurate pallet structure
        variantData: variantDataWithQuantities,
        selectedFees: scenario.selected_fees,
        msrpMarkupPercentage: scenario.msrp_markup_percentage || undefined,
      };

      // Prepare results from the scenario
      const results: DistributionCostResult = {
        distributorId: scenario.distributor_id,
        totalDistributionCost: scenario.total_distribution_cost,
        distributionCostPerUnit: scenario.distribution_cost_per_unit,
        variantResults: scenario.variant_results,
        feeBreakdown: scenario.selected_fees.map((fee) => ({
          feeId: fee.feeId,
          feeName: fee.description,
          feeAmount: fee.amount,
        })),
      };

      // Set the results and params
      setCalculationResults(results);
      setLastCalculationParams(params);
      setLoadedScenarioParams(params); // Store params to populate form
      setHasUnsavedResults(false); // This is a loaded scenario, not new unsaved results

      // Track if this was a draft (so we can delete it if they save as invoice)
      if (scenario.is_draft) {
        setLoadedDraftId(scenario.id);
      }

      // Switch to calculations tab
      setViewMode('calculations');

      // Don't auto-scroll - let users control their view position
    } catch (err) {
      console.error('Error loading scenario:', err);
      setError('Oops! We had trouble loading the scenario. Please try again.');
    }
  };

  const handleConvertToInvoice = async (scenario: CPGDistributionCalculation) => {
    try {
      setError(null);

      // Store the draft being converted
      setDraftToConvert(scenario);
      setIsConvertingDraft(true);

      // Set the distributor from the scenario
      setSelectedDistributorId(scenario.distributor_id);

      // Prepare calculation parameters from the scenario
      // Rebuild variantData with quantities from pallet_data
      const variantDataWithQuantities: Record<string, { price_per_unit: string; base_cpu: string; quantity: number }> = {};

      if (scenario.pallet_data && scenario.pallet_data.length > 0) {
        // Aggregate quantities from pallet_data
        scenario.pallet_data.forEach((pallet: any) => {
          pallet.products.forEach((product: any) => {
            if (variantDataWithQuantities[product.product_name]) {
              variantDataWithQuantities[product.product_name].quantity += product.quantity;
            } else {
              variantDataWithQuantities[product.product_name] = {
                price_per_unit: product.price_per_unit,
                base_cpu: product.base_cpu,
                quantity: product.quantity,
              };
            }
          });
        });
      } else {
        // Fallback: use variant_data from database (old calculations without pallet_data)
        Object.entries(scenario.variant_data).forEach(([productName, data]: [string, any]) => {
          variantDataWithQuantities[productName] = {
            price_per_unit: data.price_per_unit,
            base_cpu: data.base_cpu,
            quantity: data.quantity || 0,
          };
        });
      }

      const params: DistributionCalcParams = {
        distributorId: scenario.distributor_id,
        numPallets: scenario.num_pallets,
        unitsPerPallet: scenario.units_per_pallet,
        pallet_data: scenario.pallet_data || [], // Load accurate pallet structure
        variantData: variantDataWithQuantities,
        selectedFees: scenario.selected_fees,
        msrpMarkupPercentage: scenario.msrp_markup_percentage || undefined,
      };

      // Prepare results from the scenario
      const results: DistributionCostResult = {
        distributorId: scenario.distributor_id,
        totalDistributionCost: scenario.total_distribution_cost,
        distributionCostPerUnit: scenario.distribution_cost_per_unit,
        variantResults: scenario.variant_results,
        feeBreakdown: scenario.selected_fees.map((fee) => ({
          feeId: fee.feeId,
          feeName: fee.description,
          feeAmount: fee.amount,
        })),
      };

      // Set the results and params
      setCalculationResults(results);
      setLastCalculationParams(params);

      // Use the scenario's calculation date
      const scenarioDate = new Date(scenario.calculation_date);
      const year = scenarioDate.getFullYear();
      const month = String(scenarioDate.getMonth() + 1).padStart(2, '0');
      const day = String(scenarioDate.getDate()).padStart(2, '0');
      setCalculationDate(`${year}-${month}-${day}`);

      // Pre-fill invoice total with the scenario's cost
      setInvoiceTotalAmount(scenario.total_distribution_cost);

      // Calculate due date (Net 30)
      const today = new Date();
      const dueDate = new Date(today);
      dueDate.setDate(dueDate.getDate() + 30);
      const dueYear = dueDate.getFullYear();
      const dueMonth = String(dueDate.getMonth() + 1).padStart(2, '0');
      const dueDay = String(dueDate.getDate()).padStart(2, '0');
      setInvoiceDueDate(`${dueYear}-${dueMonth}-${dueDay}`);

      // Reset other invoice fields
      setInvoiceNumber('');
      setPaymentStatus('unpaid');
      setAmountPaid('');
      setPaymentDate('');
      setPaymentMethod('');

      // Open the invoice form directly (skip choice screen)
      setSaveMode('invoice');
      setShowSaveScenarioModal(true);
    } catch (err) {
      console.error('Error converting to invoice:', err);
      setError('Oops! We had trouble loading the scenario for conversion. Please try again.');
    }
  };

  const openSaveScenarioModal = async () => {
    // Clear any previous errors
    setError(null);

    // If editing an existing calculation, determine if it's a draft or invoice
    if (editingCalculationId) {
      const calc = await db.cpgDistributionCalculations.get(editingCalculationId);
      if (calc && !calc.is_draft) {
        // It's an invoice - open directly to invoice form with pre-filled data
        setSaveMode('invoice');
      } else {
        // It's a draft - show choice screen
        setSaveMode(null);
      }
      // Don't reset any fields - keep the pre-filled data from loadCalculationFromUrl
    } else {
      // Creating new calculation - reset everything
      setSaveMode(null);

      // Reset to today's date when opening modal (local timezone)
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      setCalculationDate(`${year}-${month}-${day}`);

      // Pre-fill invoice total with calculated cost
      if (calculationResults) {
        setInvoiceTotalAmount(calculationResults.totalDistributionCost);
      }

      // Calculate due date (Net 30)
      const dueDate = new Date(today);
      dueDate.setDate(dueDate.getDate() + 30);
      const dueYear = dueDate.getFullYear();
      const dueMonth = String(dueDate.getMonth() + 1).padStart(2, '0');
      const dueDay = String(dueDate.getDate()).padStart(2, '0');
      setInvoiceDueDate(`${dueYear}-${dueMonth}-${dueDay}`);

      // Reset scenario name and invoice fields
      setScenarioName('');
      setInvoiceNumber('');
      setPaymentStatus('unpaid');
      setAmountPaid('');
      setPaymentDate('');
      setPaymentMethod('');
      setPaymentAccountId('');
      setCheckNumber('');
    }

    setShowSaveScenarioModal(true);
  };

  const handleSaveScenario = async () => {
    if (!calculationResults || !selectedDistributor || !lastCalculationParams) {
      return;
    }

    // Check if form has been modified since last calculation
    if (formModifiedSinceCalculation) {
      setError('Please click "Calculate Distribution Costs" before saving. Your form has been modified since the last calculation.');
      return;
    }

    const isDraft = saveMode === 'draft';

    // Validate based on save mode
    if (isDraft) {
      // Draft only requires a scenario name
      if (!scenarioName.trim()) {
        setError('Scenario name is required');
        return;
      }
    } else {
      // Invoice requires invoice amount
      if (!invoiceTotalAmount || parseFloat(invoiceTotalAmount) <= 0) {
        setError('Invoice total amount must be greater than $0');
        return;
      }
      if ((paymentStatus === 'partially_paid' || paymentStatus === 'paid') && !amountPaid) {
        setError('Please enter the amount paid');
        return;
      }
      if ((paymentStatus === 'partially_paid' || paymentStatus === 'paid') && !paymentDate) {
        setError('Please enter the payment date');
        return;
      }
      if ((paymentStatus === 'partially_paid' || paymentStatus === 'paid') && !paymentAccountId) {
        setError('Please select a payment account');
        return;
      }
    }

    try {
      setSavingScenario(true);
      setError(null);

      // Convert the selected date to timestamp (parse manually to avoid timezone issues)
      const [year, month, day] = calculationDate.split('-').map(Number);
      const selectedDate = new Date(year, month - 1, day, 12, 0, 0, 0); // Set to noon local time
      const calculationTimestamp = selectedDate.getTime();

      // Prepare calculation name
      let calculationName: string;
      if (isDraft) {
        calculationName = scenarioName;
      } else {
        calculationName = `${invoiceNumber} - ${selectedDate.toLocaleDateString()}`;
      }

      // Prepare invoice data (only for invoices)
      let invoiceData: any = undefined;
      if (!isDraft) {
        // Convert due date to timestamp
        let dueDateTimestamp: number | null = null;
        if (invoiceDueDate) {
          const [dueYear, dueMonth, dueDay] = invoiceDueDate.split('-').map(Number);
          const dueDate = new Date(dueYear, dueMonth - 1, dueDay, 12, 0, 0, 0);
          dueDateTimestamp = dueDate.getTime();
        }

        // Convert payment date to timestamp
        let paymentDateTimestamp: number | null = null;
        if (paymentDate) {
          const [pYear, pMonth, pDay] = paymentDate.split('-').map(Number);
          const pDate = new Date(pYear, pMonth - 1, pDay, 12, 0, 0, 0);
          paymentDateTimestamp = pDate.getTime();
        }

        invoiceData = {
          invoice_number: invoiceNumber,
          invoice_total_amount: invoiceTotalAmount,
          invoice_due_date: dueDateTimestamp,
          payment_status: paymentStatus,
          amount_paid: amountPaid || null,
          payment_date: paymentDateTimestamp,
          payment_method: paymentMethod || null,
          payment_account_id: paymentAccountId || null,
          check_number: checkNumber || null,
        };
      }

      console.log('Saving calculation:', {
        companyId,
        deviceId,
        distributorId: calculationResults.distributorId,
        calculationName,
        isDraft,
        invoiceData,
        editMode: !!editingCalculationId,
      });

      let saved: any;
      if (editingCalculationId) {
        // Update existing calculation
        saved = await calculatorService.updateCalculation(
          editingCalculationId,
          calculationResults,
          lastCalculationParams,
          companyId,
          calculationName,
          deviceId,
          null, // notes
          calculationTimestamp, // custom timestamp
          invoiceData,
          isDraft
        );
      } else {
        // Create new calculation
        saved = await calculatorService.saveCalculation(
          calculationResults,
          lastCalculationParams,
          companyId,
          calculationName,
          deviceId,
          null, // notes
          calculationTimestamp, // custom timestamp
          invoiceData,
          isDraft
        );
      }

      console.log('Calculation saved:', saved);

      // If converting a draft (either from "Convert to Invoice" button or from loading and saving as invoice), mark the original as inactive
      if (isConvertingDraft && draftToConvert) {
        await db.cpgDistributionCalculations.update(draftToConvert.id, {
          active: false,
          deleted_at: Date.now(),
          updated_at: Date.now(),
        });
        console.log('Original draft marked as inactive (from Convert button):', draftToConvert.id);
      } else if (!isDraft && loadedDraftId) {
        // User loaded a draft and saved it as an invoice (not via Convert button)
        await db.cpgDistributionCalculations.update(loadedDraftId, {
          active: false,
          deleted_at: Date.now(),
          updated_at: Date.now(),
        });
        console.log('Original draft marked as inactive (from Load+Save as Invoice):', loadedDraftId);
      }

      // Verify it was saved by querying all calculations for this company
      const allCalcs = await db.cpgDistributionCalculations
        .where('company_id')
        .equals(companyId)
        .toArray();
      console.log('All calculations in DB for this company:', allCalcs);

      setShowSaveScenarioModal(false);
      setHasUnsavedResults(false); // Mark as saved

      // Show success modal with appropriate message
      const wasEditing = !!editingCalculationId;
      if (wasEditing) {
        setSuccessModalMessage(isDraft ? 'Draft scenario updated successfully!' : 'Invoice updated successfully! You can view it in the Analytics tab under "Distributor Costs".');
      } else if (isDraft) {
        setSuccessModalMessage('Draft scenario saved successfully! You can view and manage it in Saved Scenarios.');
      } else if (isConvertingDraft) {
        setSuccessModalMessage('Draft converted to invoice successfully! You can view it in the Analytics tab under "Distributor Costs".');
      } else {
        setSuccessModalMessage('Invoice saved successfully! You can view it in the Analytics tab under "Distributor Costs".');
      }

      // Reset conversion state
      setIsConvertingDraft(false);
      setDraftToConvert(null);
      setLoadedDraftId(null);
      setEditingCalculationId(null); // Clear edit mode

      setShowSuccessModal(true);
    } catch (err) {
      console.error('Error saving scenario:', err);
      setError('Oops! We had trouble saving the calculation. Please try again.');
    } finally {
      setSavingScenario(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className={styles.loadingContainer}>
        <Loading message="Loading distributors..." />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Page Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Distribution Center</h1>
        <button
          onClick={() => setShowAddDistributorModal(true)}
          style={{
            padding: '0.75rem 1.5rem',
            background: 'linear-gradient(135deg, #E8D4A0 0%, #D4AF37 50%, #B8860B 100%)',
            color: '#2d1b00',
            border: '2px solid #B8860B',
            borderRadius: '8px',
            fontSize: '1rem',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(184, 134, 11, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(184, 134, 11, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(184, 134, 11, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
          }}
        >
          <span style={{ fontSize: '1.25rem', fontWeight: 700 }} aria-hidden="true">+</span>
          Add Distributor
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className={styles.errorContainer}>
          <ErrorMessage message={error} onDismiss={() => setError(null)} />
        </div>
      )}

      {/* View Mode Tabs */}
      <div className={styles.tabs} role="tablist">
        <button
          role="tab"
          aria-selected={viewMode === 'manage'}
          onClick={() => handleTabSwitch('manage')}
          className={viewMode === 'manage' ? styles.tabActive : styles.tab}
        >
          Manage Distributors
          <PinIcon
            isPinned={pinnedTabs['manage'] || false}
            onClick={() => handlePinToggle('manage')}
            size={14}
          />
        </button>
        <button
          role="tab"
          aria-selected={viewMode === 'costs'}
          onClick={() => handleTabSwitch('costs')}
          className={viewMode === 'costs' ? styles.tabActive : styles.tab}
        >
          Distributor Costs
          <PinIcon
            isPinned={pinnedTabs['costs'] || false}
            onClick={() => handlePinToggle('costs')}
            size={14}
          />
        </button>
        <button
          role="tab"
          aria-selected={viewMode === 'calculations'}
          onClick={() => handleTabSwitch('calculations')}
          className={viewMode === 'calculations' ? styles.tabActive : styles.tab}
        >
          Cost Calculations
          <PinIcon
            isPinned={pinnedTabs['calculations'] || false}
            onClick={() => handlePinToggle('calculations')}
            size={14}
          />
        </button>
        <button
          role="tab"
          aria-selected={viewMode === 'scenarios'}
          onClick={() => handleTabSwitch('scenarios')}
          className={viewMode === 'scenarios' ? styles.tabActive : styles.tab}
        >
          Saved Scenarios
          <PinIcon
            isPinned={pinnedTabs['scenarios'] || false}
            onClick={() => handlePinToggle('scenarios')}
            size={14}
          />
        </button>
      </div>

      {/* Main Content */}
      <div className={styles.content}>
        {/* Manage Distributors Tab */}
        {viewMode === 'manage' && (
          <div className={styles.manageSection}>
            <DistributorManager
              isOpen={true}
              onClose={() => {}}
              embedded={true}
            />
          </div>
        )}

        {/* Distributor Costs Tab */}
        {viewMode === 'costs' && (
          <div className={styles.costsSection}>
            <DistributorCostsTab companyId={companyId} />
          </div>
        )}

        {/* Cost Calculations Tab */}
        {viewMode === 'calculations' && (
          <div className={styles.calculationsSection}>
            {/* Distributor Selection */}
            <div className={styles.section}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
                <div style={{ flex: '0 0 auto', minWidth: '300px' }}>
                  <DistributorSelector
                    distributors={distributors}
                    selectedDistributorId={selectedDistributorId}
                    onSelect={setSelectedDistributorId}
                    loading={loading}
                    hideAddButton={true}
                  />
                </div>
                {/* Action Buttons */}
                {selectedDistributor && (
                  <div className={styles.distributorActions} style={{ paddingBottom: '0.375rem' }}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowEditDistributorModal(true)}
                    >
                      Edit Distributor Profile
                    </Button>
                    {(calculationResults || hasUnsavedResults) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleClearData}
                      >
                        Clear Data
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Calculator Form */}
            {selectedDistributor && (
              <div className={styles.section}>
                <DistributionCalculatorForm
                  key={`${selectedDistributor.id}-${loadedScenarioParams ? JSON.stringify(loadedScenarioParams.selectedFees) : 'normal'}`}
                  distributor={selectedDistributor}
                  onCalculate={handleCalculate}
                  loading={calculating}
                  initialValues={loadedScenarioParams || undefined}
                  onFormChange={handleFormChange}
                />
              </div>
            )}

            {/* Warning when form has been modified */}
            {formModifiedSinceCalculation && calculationResults && (
              <div style={{
                background: '#fef3c7',
                border: '2px solid #f59e0b',
                borderRadius: '0.5rem',
                padding: '1rem',
                margin: '1rem 0',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem'
              }}>
                <div>
                  <strong style={{ color: '#92400e' }}>Form Modified</strong>
                  <p style={{ margin: '0.25rem 0 0 0', color: '#92400e', fontSize: '0.875rem' }}>
                    You've made changes to the form. Please click "Calculate Distribution Costs" before saving to ensure your results reflect the current data.
                  </p>
                </div>
              </div>
            )}

            {/* Results */}
            {calculationResults && lastCalculationParams && (
              <div className={styles.section} data-results-section>
                <DistributionResultsDisplay
                  results={calculationResults}
                  params={lastCalculationParams}
                  onSave={openSaveScenarioModal}
                  onRecalculate={handleCalculate}
                  saving={savingScenario}
                  showSaveButton={true}
                />
              </div>
            )}

            {/* Empty State */}
            {!selectedDistributor && distributors.length > 0 && (
              <div className={styles.emptyState}>
                <p>Select a distributor above to start analyzing distribution costs.</p>
              </div>
            )}
          </div>
        )}

        {/* Saved Scenarios Tab */}
        {viewMode === 'scenarios' && (
          <div className={styles.scenariosSection}>
            <SavedScenarios
              companyId={companyId}
              deviceId={deviceId}
              onLoadScenario={handleLoadScenario}
              onConvertToInvoice={handleConvertToInvoice}
            />
          </div>
        )}
      </div>

      {/* Modals */}
      {showAddDistributorModal && (
        <Modal
          isOpen={showAddDistributorModal}
          onClose={() => setShowAddDistributorModal(false)}
          title="Add New Distributor"
          closeOnBackdropClick={false}
          size="lg"
        >
          <DistributorProfileForm
            onSubmit={handleCreateDistributor}
            onCancel={() => setShowAddDistributorModal(false)}
            loading={savingDistributor}
          />
        </Modal>
      )}

      {showEditDistributorModal && selectedDistributor && (
        <Modal
          isOpen={showEditDistributorModal}
          onClose={() => setShowEditDistributorModal(false)}
          title="Edit Distributor"
          closeOnBackdropClick={false}
          size="lg"
        >
          <DistributorProfileForm
            distributor={selectedDistributor}
            onSubmit={handleUpdateDistributor}
            onCancel={() => setShowEditDistributorModal(false)}
            loading={savingDistributor}
          />
        </Modal>
      )}

      {showSaveScenarioModal && (
        <Modal
          isOpen={showSaveScenarioModal}
          onClose={() => setShowSaveScenarioModal(false)}
          title=""
          closeOnBackdropClick={false}
          size="md"
        >
          <div className={styles.confirmModal}>
            {/* Error Display */}
            {error && (
              <div style={{
                background: '#fee2e2',
                border: '1px solid #ef4444',
                borderRadius: '0.5rem',
                padding: '0.75rem',
                marginBottom: '1rem',
                color: '#991b1b',
              }}>
                <strong>Error:</strong> {error}
              </div>
            )}

            {/* Choice Screen */}
            {saveMode === null && (
              <>
                <div className={styles.confirmModalHeader}>
                  <h2 className={styles.confirmModalTitle}>
                    {editingCalculationId ? 'Update Calculation' : 'Save Calculation'}
                  </h2>
                </div>
                <p className={styles.confirmModalMessage}>
                  {editingCalculationId
                    ? 'You are editing an existing calculation. How would you like to update it?'
                    : 'How would you like to save this calculation?'}
                </p>

                {editingCalculationId && (
                  <div style={{
                    background: '#fef3c7',
                    border: '1px solid #f59e0b',
                    borderRadius: '0.5rem',
                    padding: '0.75rem',
                    marginTop: '1rem',
                    fontSize: '0.875rem',
                    color: '#92400e',
                  }}>
                    <strong>Note:</strong> Your choice will update the existing record in place.
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem' }}>
                  <button
                    onClick={() => setSaveMode('draft')}
                    style={{
                      padding: '1.25rem',
                      border: '2px solid #d1d5db',
                      borderRadius: '0.5rem',
                      background: 'white',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#D4AF37';
                      e.currentTarget.style.background = 'rgba(232, 212, 160, 0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#d1d5db';
                      e.currentTarget.style.background = 'white';
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '1rem', color: '#4b006e', marginBottom: '0.25rem' }}>
                      {editingCalculationId ? 'Convert to Draft' : 'Save as Draft'}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      {editingCalculationId
                        ? 'This will remove invoice status and convert to a draft scenario. Any accounting entries will remain, but this will no longer be tracked as an invoice.'
                        : 'Save this scenario for what-if planning. No invoice or accounting entry will be created.'}
                    </div>
                  </button>

                  <button
                    onClick={() => setSaveMode('invoice')}
                    style={{
                      padding: '1.25rem',
                      border: '2px solid #d1d5db',
                      borderRadius: '0.5rem',
                      background: 'white',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#D4AF37';
                      e.currentTarget.style.background = 'rgba(232, 212, 160, 0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#d1d5db';
                      e.currentTarget.style.background = 'white';
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '1rem', color: '#4b006e', marginBottom: '0.25rem' }}>
                      {editingCalculationId ? 'Update Invoice' : 'Save as Invoice'}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      {editingCalculationId
                        ? 'Update the existing invoice with new values. This will overwrite the previous invoice details.'
                        : 'Record an actual distributor invoice and create an accounting entry in your books.'}
                    </div>
                  </button>
                </div>

                <div className={styles.modalActions} style={{ marginTop: '1.5rem' }}>
                  <Button
                    variant="outline"
                    onClick={() => setShowSaveScenarioModal(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </>
            )}

            {/* Draft Form */}
            {saveMode === 'draft' && (
              <>
                <div className={styles.confirmModalHeader}>
                  <h2 className={styles.confirmModalTitle}>
                    {editingCalculationId ? 'Convert to Draft Scenario' : 'Save as Draft Scenario'}
                  </h2>
                </div>
                <p className={styles.confirmModalMessage}>
                  {editingCalculationId
                    ? 'This will remove the invoice status and save as a draft scenario. Give it a name for reference.'
                    : 'Give this scenario a name so you can easily find it later.'}
                </p>
                {editingCalculationId && (
                  <div style={{
                    background: '#fee2e2',
                    border: '1px solid #ef4444',
                    borderRadius: '0.5rem',
                    padding: '0.75rem',
                    marginTop: '1rem',
                    fontSize: '0.875rem',
                    color: '#991b1b',
                  }}>
                    <strong>Warning:</strong> This will remove the invoice status. The record will no longer appear in Analytics under "Distributor Costs" invoices.
                  </div>
                )}

                {/* Scenario Name */}
                <div style={{ marginBottom: '1rem', marginTop: '1rem' }}>
                  <label htmlFor="scenario-name" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#4b006e', marginBottom: '0.5rem' }}>
                    Scenario Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    id="scenario-name"
                    type="text"
                    value={scenarioName}
                    onChange={(e) => setScenarioName(e.target.value)}
                    placeholder="ex: 3 Pallets Test, Holiday Rush Scenario"
                    required
                    autoFocus
                    style={{ width: '100%', padding: '0.625rem 0.875rem', border: '2px solid #e0e0e0', borderRadius: '6px', fontSize: '1rem', backgroundColor: '#E5F6DF' }}
                  />
                </div>

                {/* Calculation Date */}
                <div style={{ marginBottom: '1rem' }}>
                  <label htmlFor="calculation-date-draft" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#4b006e', marginBottom: '0.5rem' }}>
                    Date
                  </label>
                  <input
                    id="calculation-date-draft"
                    type="date"
                    value={calculationDate}
                    onChange={(e) => setCalculationDate(e.target.value)}
                    onBlur={(e) => handleDateBlur(e.target.value, setCalculationDate)}
                    max={new Date().toISOString().split('T')[0]}
                    style={{ width: '100%', padding: '0.625rem 0.875rem', border: '2px solid #e0e0e0', borderRadius: '6px', fontSize: '1rem', backgroundColor: '#E5F6DF' }}
                  />
                </div>

                <div className={styles.modalActions}>
                  <Button
                    variant="outline"
                    onClick={() => setSaveMode(null)}
                    disabled={savingScenario}
                  >
                    Back
                  </Button>
                  <Button
                    variant="gold"
                    onClick={handleSaveScenario}
                    loading={savingScenario}
                    disabled={savingScenario}
                  >
                    Save Draft
                  </Button>
                </div>
              </>
            )}

            {/* Invoice Form */}
            {saveMode === 'invoice' && (
              <>
                <div className={styles.confirmModalHeader}>
                  <h2 className={styles.confirmModalTitle}>
                    {editingCalculationId ? 'Update Distribution Invoice' : 'Save Distribution Invoice'}
                  </h2>
                </div>
                <p className={styles.confirmModalMessage}>
                  {editingCalculationId
                    ? 'Update the invoice details below. Changes will overwrite the existing invoice record.'
                    : 'Enter invoice details to save this calculation and create an accounting entry.'}
                </p>
                {editingCalculationId && (
                  <div style={{
                    background: '#dbeafe',
                    border: '1px solid #3b82f6',
                    borderRadius: '0.5rem',
                    padding: '0.75rem',
                    marginTop: '1rem',
                    fontSize: '0.875rem',
                    color: '#1e40af',
                  }}>
                    <strong>Editing Mode:</strong> You are updating an existing invoice.
                  </div>
                )}

            {/* Invoice Date */}
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="calculation-date" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#4b006e', marginBottom: '0.5rem' }}>
                Invoice Date <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                id="calculation-date"
                type="date"
                value={calculationDate}
                onChange={(e) => setCalculationDate(e.target.value)}
                onBlur={(e) => handleDateBlur(e.target.value, setCalculationDate)}
                max={new Date().toISOString().split('T')[0]}
                required
                style={{ width: '100%', padding: '0.625rem 0.875rem', border: '2px solid #e0e0e0', borderRadius: '6px', fontSize: '1rem', backgroundColor: '#E5F6DF' }}
              />
            </div>

            {/* Invoice Number */}
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="invoice-number" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#4b006e', marginBottom: '0.5rem' }}>
                Invoice Number
              </label>
              <input
                id="invoice-number"
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="INV-12345"
                style={{ width: '100%', padding: '0.625rem 0.875rem', border: '2px solid #e0e0e0', borderRadius: '6px', fontSize: '1rem', backgroundColor: '#E5F6DF' }}
              />
            </div>

            {/* Invoice Total Amount */}
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="invoice-total" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#4b006e', marginBottom: '0.5rem' }}>
                Invoice Total Amount <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#6b7280', fontSize: '0.875rem' }}>$</span>
                <input
                  id="invoice-total"
                  type="number"
                  step="0.01"
                  min="0"
                  value={invoiceTotalAmount}
                  onChange={(e) => {
                    setInvoiceTotalAmount(e.target.value);
                    // Auto-update amount paid if status is "paid"
                    if (paymentStatus === 'paid') {
                      setAmountPaid(e.target.value);
                    }
                  }}
                  required
                  style={{ width: '100%', padding: '0.625rem 0.875rem 0.625rem 1.75rem', border: '2px solid #e0e0e0', borderRadius: '6px', fontSize: '1rem', backgroundColor: '#E5F6DF' }}
                />
              </div>
              {calculationResults && parseFloat(invoiceTotalAmount || '0') !== parseFloat(calculationResults.totalDistributionCost) && invoiceTotalAmount && (
                <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '0.375rem', fontSize: '0.75rem', color: '#92400e' }}>
                  Invoice total (${invoiceTotalAmount}) differs from calculated cost (${calculationResults.totalDistributionCost}).
                  Difference: ${Math.abs(parseFloat(invoiceTotalAmount) - parseFloat(calculationResults.totalDistributionCost)).toFixed(2)}
                </div>
              )}
            </div>

            {/* Due Date */}
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="due-date" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#4b006e', marginBottom: '0.5rem' }}>
                Due Date
              </label>
              <input
                id="due-date"
                type="date"
                value={invoiceDueDate}
                onChange={(e) => setInvoiceDueDate(e.target.value)}
                onBlur={(e) => handleDateBlur(e.target.value, setInvoiceDueDate)}
                style={{ width: '100%', padding: '0.625rem 0.875rem', border: '2px solid #e0e0e0', borderRadius: '6px', fontSize: '1rem', backgroundColor: '#E5F6DF' }}
              />
              <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>Defaults to Net 30</p>
            </div>

            {/* Payment Status */}
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="payment-status" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#4b006e', marginBottom: '0.5rem' }}>
                Payment Status
              </label>
              <select
                id="payment-status"
                value={paymentStatus}
                onChange={(e) => {
                  const newStatus = e.target.value as 'unpaid' | 'partially_paid' | 'paid';
                  setPaymentStatus(newStatus);
                  // Auto-fill amount paid when "paid" is selected
                  if (newStatus === 'paid' && invoiceTotalAmount) {
                    setAmountPaid(invoiceTotalAmount);
                  } else if (newStatus === 'unpaid') {
                    setAmountPaid('');
                  }
                }}
                style={{ width: '100%', padding: '0.625rem 0.875rem', border: '2px solid #e0e0e0', borderRadius: '6px', fontSize: '1rem', backgroundColor: '#E5F6DF' }}
              >
                <option value="unpaid">Unpaid</option>
                <option value="partially_paid">Partially Paid</option>
                <option value="paid">Paid in Full</option>
              </select>
            </div>

            {/* Conditional Payment Fields */}
            {(paymentStatus === 'partially_paid' || paymentStatus === 'paid') && (
              <>
                <div style={{ marginBottom: '1rem' }}>
                  <label htmlFor="amount-paid" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#4b006e', marginBottom: '0.5rem' }}>
                    Amount Paid <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#6b7280', fontSize: '0.875rem' }}>$</span>
                    <input
                      id="amount-paid"
                      type="number"
                      step="0.01"
                      min="0"
                      max={invoiceTotalAmount}
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value)}
                      required
                      style={{ width: '100%', padding: '0.625rem 0.875rem 0.625rem 1.75rem', border: '2px solid #e0e0e0', borderRadius: '6px', fontSize: '1rem', backgroundColor: '#E5F6DF' }}
                    />
                  </div>
                  {paymentStatus === 'partially_paid' && amountPaid && invoiceTotalAmount && (
                    <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                      Remaining: ${(parseFloat(invoiceTotalAmount) - parseFloat(amountPaid)).toFixed(2)}
                    </p>
                  )}
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label htmlFor="payment-date" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#4b006e', marginBottom: '0.5rem' }}>
                    Payment Date <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    id="payment-date"
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    onBlur={(e) => handleDateBlur(e.target.value, setPaymentDate)}
                    max={new Date().toISOString().split('T')[0]}
                    required
                    style={{ width: '100%', padding: '0.625rem 0.875rem', border: '2px solid #e0e0e0', borderRadius: '6px', fontSize: '1rem', backgroundColor: '#E5F6DF' }}
                  />
                </div>

                {/* Payment Account - Smart Dropdown */}
                <div style={{ marginBottom: '1rem' }}>
                  <label htmlFor="payment-account" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#4b006e', marginBottom: '0.5rem' }}>
                    Payment Account <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    id="payment-account"
                    value={paymentAccountId}
                    onChange={(e) => setPaymentAccountId(e.target.value)}
                    required
                    style={{ width: '100%', padding: '0.625rem 0.875rem', border: '2px solid #e0e0e0', borderRadius: '6px', fontSize: '1rem', backgroundColor: '#E5F6DF' }}
                  >
                    <option value="">Select payment account...</option>
                    {paymentAccounts.length > 0 ? (
                      // Show actual accounts from Chart of Accounts
                      paymentAccounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} {acc.code ? `(${acc.code})` : ''}
                        </option>
                      ))
                    ) : (
                      // Fallback: Simple payment methods if no bookkeeping
                      <>
                        <option value="cash">Cash</option>
                        <option value="checking">Checking Account</option>
                        <option value="savings">Savings Account</option>
                        <option value="credit-card">Credit Card</option>
                      </>
                    )}
                  </select>
                  {hasChartOfAccounts && paymentAccounts.length === 0 && (
                    <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                      Set up bank accounts in Chart of Accounts to select them here
                    </p>
                  )}
                </div>

                {/* Check Number - Optional, shows for checking accounts */}
                {(paymentAccountId && (
                  paymentAccounts.find(acc => acc.id === paymentAccountId)?.name.toLowerCase().includes('check') ||
                  paymentAccounts.find(acc => acc.id === paymentAccountId)?.type.toLowerCase().includes('check') ||
                  paymentAccountId === 'checking'
                )) && (
                  <div style={{ marginBottom: '1rem' }}>
                    <label htmlFor="check-number" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#4b006e', marginBottom: '0.5rem' }}>
                      Check Number
                    </label>
                    <input
                      id="check-number"
                      type="text"
                      value={checkNumber}
                      onChange={(e) => setCheckNumber(e.target.value)}
                      placeholder="1234"
                      style={{ width: '100%', padding: '0.625rem 0.875rem', border: '2px solid #e0e0e0', borderRadius: '6px', fontSize: '1rem', backgroundColor: '#E5F6DF' }}
                    />
                  </div>
                )}
              </>
            )}

                <div className={styles.modalActions}>
                  <Button
                    variant="outline"
                    onClick={() => setSaveMode(null)}
                    disabled={savingScenario}
                  >
                    Back
                  </Button>
                  <Button
                    variant="gold"
                    onClick={handleSaveScenario}
                    loading={savingScenario}
                    disabled={savingScenario}
                  >
                    Save Invoice
                  </Button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}

      {showSuccessModal && (
        <Modal
          isOpen={showSuccessModal}
          onClose={() => setShowSuccessModal(false)}
          title=""
          size="sm"
        >
          <div className={styles.successModal}>
            <div className={styles.successModalHeaderGreen}>
              <h2 className={styles.successModalTitle}>
                <span className={styles.successIcon}>✓</span>
                Success!
              </h2>
            </div>
            <p className={styles.successModalMessage}>
              {successModalMessage.includes('Saved Scenarios') ? (
                <>
                  {successModalMessage.split('Saved Scenarios')[0]}
                  <a
                    href="#"
                    className={styles.successLink}
                    onClick={(e) => {
                      e.preventDefault();
                      setShowSuccessModal(false);
                      setViewMode('scenarios');
                    }}
                  >
                    Saved Scenarios
                  </a>
                  {successModalMessage.split('Saved Scenarios')[1]}
                </>
              ) : successModalMessage.includes('Distributor Costs') ? (
                <>
                  {successModalMessage.split('Distributor Costs')[0]}
                  <a
                    href={`/cpg/analytics?tab=distributor&distributor=${calculationResults?.distributorId || ''}`}
                    className={styles.successLink}
                    onClick={(e) => {
                      e.preventDefault();
                      setShowSuccessModal(false);
                      window.location.href = `/cpg/analytics?tab=distributor&distributor=${calculationResults?.distributorId || ''}`;
                    }}
                  >
                    Distributor Costs
                  </a>
                  {successModalMessage.split('Distributor Costs')[1]}
                </>
              ) : (
                successModalMessage
              )}
            </p>
            <div className={styles.modalActions}>
              <Button
                variant="primary"
                onClick={() => setShowSuccessModal(false)}
              >
                OK
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {showUnsavedWarningModal && (
        <Modal
          isOpen={showUnsavedWarningModal}
          onClose={() => setShowUnsavedWarningModal(false)}
          title=""
          closeOnBackdropClick={false}
          size="sm"
        >
          <div className={styles.confirmModal}>
            <div className={styles.confirmModalHeader}>
              <h2 className={styles.confirmModalTitle}>Unsaved Calculation</h2>
            </div>
            <p className={styles.confirmModalMessage}>
              You have unsaved calculation results. If you leave now, your results will be lost.
            </p>
            <div className={styles.modalActions}>
              <Button
                variant="outline"
                onClick={() => setShowUnsavedWarningModal(false)}
              >
                Stay Here
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  openSaveScenarioModal();
                  setShowUnsavedWarningModal(false);
                }}
              >
                Save First
              </Button>
              <Button
                variant="danger"
                onClick={() => confirmTabSwitch('manage')}
              >
                Leave Anyway
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {showClearDataModal && (
        <Modal
          isOpen={showClearDataModal}
          onClose={() => setShowClearDataModal(false)}
          title=""
          closeOnBackdropClick={false}
          size="sm"
        >
          <div className={styles.confirmModal}>
            <div className={styles.confirmModalHeader}>
              <h2 className={styles.confirmModalTitle}>Clear All Data?</h2>
            </div>
            <p className={styles.confirmModalMessage}>
              {hasUnsavedResults
                ? 'You have unsaved calculation results. Clearing will remove all current data and results. This action cannot be undone.'
                : 'This will clear all current calculation data and results. This action cannot be undone.'}
            </p>
            <div className={styles.modalActions}>
              <Button
                variant="outline"
                onClick={() => setShowClearDataModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={confirmClearData}
              >
                Clear Data
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
