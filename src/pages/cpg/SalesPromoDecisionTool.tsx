import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/core/Button';
import { PromoDetailsForm, type PromoFormData } from '../../components/cpg/PromoDetailsForm';
import { PromoComparison, type VariantComparisonData } from '../../components/cpg/PromoComparison';
import { PromoImpactSummary } from '../../components/cpg/PromoImpactSummary';
import { PromoTrackerTab } from './tabs/PromoTrackerTab';
import { PinIcon } from '../../components/common/PinIcon';
import { useAuth } from '../../contexts/AuthContext';
import { useTabPinning } from '../../hooks/useTabPinning';
import { useCPGSettings } from '../../hooks/useCPGSettings';
import { PAGE_IDS } from '../../db/schema/tabPreferences.schema';
import { db } from '../../db';
import type { CPGSettings } from '../../db/schema/cpg.schema';
import { createDefaultCPGSettings, getProfitMarginQualityWithSettings } from '../../db/schema/cpg.schema';
import { SalesPromoAnalyzerService, type PromoAnalysisResult } from '../../services/cpg/salesPromoAnalyzer.service';
import { cpuCalculatorService } from '../../services/cpg/cpuCalculator.service';
import styles from './SalesPromoDecisionTool.module.css';

/**
 * SalesPromoDecisionTool Page
 *
 * Main page for analyzing and deciding on sales promo participation.
 *
 * Features:
 * - Promo details form
 * - Side-by-side comparison (WITH vs WITHOUT promo)
 * - Recommendation badge
 * - Impact summary
 * - Decision actions (approve/decline/save for later)
 *
 * Workflow:
 * 1. User enters promo details and variant data
 * 2. System analyzes promo using SalesPromoAnalyzerService
 * 3. Displays side-by-side comparison
 * 4. Shows recommendation badge
 * 5. Shows impact summary
 * 6. User makes decision (approve/decline/save)
 *
 * Requirements:
 * - CPG Module Roadmap Group C3
 * - WCAG 2.1 AA compliant
 * - Steadiness communication style
 * - Mobile responsive
 *
 * Integration:
 * - Uses SalesPromoAnalyzerService from Group B3
 * - Fetches latest CPUs from invoices
 * - Saves promo decisions to database
 */

/**
 * Convert date string (YYYY-MM-DD) to local midnight timestamp
 * Prevents timezone shifts when saving/loading dates
 */
const dateStringToLocalTimestamp = (dateString: string): number => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day).getTime();
};

/**
 * Convert timestamp to date string (YYYY-MM-DD) in local timezone
 * Prevents timezone shifts when displaying dates
 */
const timestampToLocalDateString = (timestamp: number): string => {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

type ViewTab = 'decision-tool' | 'promo-tracker';

export default function SalesPromoDecisionTool() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { companyId, deviceId } = useAuth();
  // Database is imported as singleton

  // Check if we're editing an existing promo
  const editPromoId = searchParams.get('edit');

  // Tab pinning
  const { defaultTab, pinTab, unpinTab, isTabPinned, isLoading: isPinningLoading } = useTabPinning({
    pageId: PAGE_IDS.PROMO_ANALYSIS,
  });

  // CPG Settings for formatting
  const { settings: cpgSettingsFromContext } = useCPGSettings();

  // Tab State
  const [activeTab, setActiveTab] = useState<ViewTab>('decision-tool');
  const [pinnedTabs, setPinnedTabs] = useState<Record<string, boolean>>({});

  // Update active tab when pinned default loads (unless there's a URL parameter or edit mode)
  useEffect(() => {
    const tabParam = searchParams.get('tab');

    // Priority: URL param > edit mode > pinned default
    if (tabParam) {
      if (tabParam === 'promo-tracker') {
        setActiveTab('promo-tracker');
      } else if (tabParam === 'decision-tool') {
        setActiveTab('decision-tool');
      }
    } else if (editPromoId) {
      setActiveTab('decision-tool');
    } else if (!isPinningLoading && defaultTab) {
      setActiveTab(defaultTab as ViewTab);
    }
  }, [defaultTab, isPinningLoading, searchParams, editPromoId]);

  // Load pinned tabs state
  useEffect(() => {
    const loadPinnedState = async () => {
      const states: Record<string, boolean> = {};
      const tabs: ViewTab[] = ['decision-tool', 'promo-tracker'];

      for (const tab of tabs) {
        states[tab] = await isTabPinned(tab);
      }

      setPinnedTabs(states);
    };

    loadPinnedState();
  }, [isTabPinned]);

  // State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<PromoAnalysisResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [notes, setNotes] = useState('');
  const [availableVariants, setAvailableVariants] = useState<string[]>([]);
  const [latestCPUs, setLatestCPUs] = useState<Record<string, string>>({});
  const [latestLaborCosts, setLatestLaborCosts] = useState<Record<string, string>>({});
  const [latestSoldPriceToYous, setLatestSoldPriceToYous] = useState<Record<string, string>>({});
  const [cpuErrors, setCpuErrors] = useState<string[]>([]); // Track products with CPU errors
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [cpgSettings, setCpgSettings] = useState<CPGSettings | null>(null); // CPG settings for margin thresholds
  const [submittedFormData, setSubmittedFormData] = useState<PromoFormData | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<{ title: string; message: string; action?: string } | null>(null);
  const [initialFormData, setInitialFormData] = useState<Partial<PromoFormData> | undefined>(undefined);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [confirmationDialog, setConfirmationDialog] = useState<{
    isOpen: boolean;
    type: 'approve' | 'decline' | 'unsaved' | null;
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    type: null,
    title: '',
    message: '',
    confirmLabel: '',
    onConfirm: () => {},
  });

  // Refs for reliable scrolling
  const pageContentRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const tabContentRef = useRef<HTMLDivElement>(null);

  /**
   * Focus trap for confirmation modal
   */
  useEffect(() => {
    if (!confirmationDialog.isOpen || !modalRef.current) return;

    const modal = modalRef.current;
    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    // Focus first element when modal opens
    firstElement?.focus();

    // Trap focus within modal
    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleTabKey);
    return () => document.removeEventListener('keydown', handleTabKey);
  }, [confirmationDialog.isOpen]);

  /**
   * Utility function for reliable scrolling
   */
  const scrollToTop = () => {
    if (tabContentRef.current) {
      tabContentRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  /**
   * Handle tab pin toggle
   */
  const handlePinToggle = async (tabId: ViewTab) => {
    const currentlyPinned = pinnedTabs[tabId];

    try {
      if (currentlyPinned) {
        await unpinTab();
        setPinnedTabs((prev) => ({ ...prev, [tabId]: false }));
      } else {
        await pinTab(tabId);
        setPinnedTabs({
          'decision-tool': tabId === 'decision-tool',
          'promo-tracker': tabId === 'promo-tracker',
        });
      }
    } catch (error) {
      console.error('Failed to toggle pin:', error);
    }
  };

  const scrollToResults = () => {
    if (resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Load finished products (SKUs) and their CPUs
  useEffect(() => {
    // Don't try to load if companyId isn't available yet
    if (!companyId) {
      return;
    }

    const loadProductsAndCPUs = async () => {
      try {
        setIsLoadingData(true);

        // Get CPG settings for margin quality thresholds
        let settings = await db.cpgSettings
          .where('company_id')
          .equals(companyId)
          .and((s) => s.active && !s.deleted_at)
          .first();

        // If no settings exist, create default ones
        if (!settings) {
          const defaultSettings = createDefaultCPGSettings(companyId, deviceId);
          await db.cpgSettings.add(defaultSettings as CPGSettings);
          settings = defaultSettings as CPGSettings;
        }

        setCpgSettings(settings);

        // Get all active finished products
        const products = await db.cpgFinishedProducts
          .where('company_id')
          .equals(companyId)
          .filter(p => p.active && p.deleted_at === null)
          .toArray();

        // Use SKU or name as the variant identifier
        const productNames: string[] = [];
        const cpuMap: Record<string, string> = {};
        const laborCostMap: Record<string, string> = {};
        const msrpMap: Record<string, string> = {};
        const failedCPUs: string[] = [];

        for (const product of products) {
          // Show both SKU and product name for clarity
          const variantName = product.sku
            ? `${product.sku} - ${product.name}`
            : product.name;
          productNames.push(variantName);

          // Get CPU for this product
          try {
            const cpuBreakdown = await cpuCalculatorService.getFinishedProductCPUBreakdown(
              product.id,
              companyId
            );
            if (cpuBreakdown.materialCPU) {
              // Store material CPU separately (base cost without labor)
              cpuMap[variantName] = cpuBreakdown.materialCPU;
              // Store labor cost separately if available
              if (cpuBreakdown.laborCost) {
                laborCostMap[variantName] = cpuBreakdown.laborCost;
              }
            } else {
              failedCPUs.push(variantName);
            }
          } catch (error) {
            console.error(`Failed to get CPU for ${variantName}:`, error);
            failedCPUs.push(variantName);
          }

          // Get Selling Price for this product (if available)
          if (product.msrp) {
            msrpMap[variantName] = product.msrp;
          }
        }

        setAvailableVariants(productNames.sort());
        setLatestCPUs(cpuMap);
        setLatestLaborCosts(laborCostMap);
        setLatestSoldPriceToYous(msrpMap);
        setCpuErrors(failedCPUs);
      } catch (error) {
        console.error('Error loading products and CPUs:', error);
        setSuccessMessage(null);
        setErrorMessage({
          title: 'Unable to Load Product Data',
          message: 'We had trouble loading your products from the database. This happens when products haven\'t been fully set up yet.',
          action: 'Please visit "My Products" to ensure your products have recipes and ingredient costs, then try again. If you just uploaded data, give it a moment to finish processing.',
        });
      } finally {
        setIsLoadingData(false);
      }
    };

    loadProductsAndCPUs();
  }, [companyId]);

  // Load draft promo if editing
  useEffect(() => {
    if (!editPromoId) {
      // Clear form when not editing
      setInitialFormData(undefined);
      setAnalysisResult(null);
      setSubmittedFormData(null);
      setNotes('');
      setHasUnsavedChanges(false);
      return;
    }

    // Clear existing state before loading new promo
    setSuccessMessage(null);
    setErrorMessage(null);
    setAnalysisResult(null);
    setSubmittedFormData(null);
    setInitialFormData(undefined);
    setNotes('');
    setHasUnsavedChanges(false);

    const loadDraftPromo = async () => {
      try {
        const promo = await db.cpgSalesPromos.get(editPromoId);
        if (!promo) {
          console.error('Draft promo not found');
          setSuccessMessage(null);
          setErrorMessage({
            title: 'Promo Not Found',
            message: `We couldn't find a promo with ID "${editPromoId}". It may have been deleted or the link is outdated.`,
            action: 'Visit Analytics → Promo Tracker to see all your saved promos, or create a new analysis from scratch.',
          });
          return;
        }

        // Convert variant_promo_data from snake_case (DB) to camelCase (form)
        const convertedVariants: Record<string, { retailPrice: string; unitsAvailable: string; baseCPU: string; productionCPU: string }> = {};
        if (promo.variant_promo_data) {
          Object.entries(promo.variant_promo_data).forEach(([key, value]) => {
            convertedVariants[key] = {
              retailPrice: value.retail_price,
              unitsAvailable: value.units_available,
              baseCPU: value.base_cpu,
              productionCPU: value.production_cpu || '',
            };
          });
        }

        // Convert demo_hours_entries from snake_case (DB) to camelCase (form)
        const convertedDemoEntries = promo.demo_hours_entries?.map(entry => ({
          id: entry.id,
          roleId: entry.role_id || 'custom', // Use role_id if available, otherwise custom
          roleName: entry.role_name || entry.description || '', // Use role_name or fallback to description for old data
          hours: entry.hours,
          hourlyRate: entry.hourly_rate,
          costType: entry.cost_type,
        })) || [];

        // Convert promo data to form data format
        const formData: Partial<PromoFormData> = {
          promoName: promo.promo_name,
          retailerName: promo.retailer_name || '',
          promoStartDate: promo.promo_start_date ? timestampToLocalDateString(promo.promo_start_date) : '',
          promoEndDate: promo.promo_end_date ? timestampToLocalDateString(promo.promo_end_date) : '',
          storeSalePercentage: promo.store_sale_percentage,
          producerPaybackPercentage: promo.producer_payback_percentage,
          demoHoursEntries: convertedDemoEntries,
          selectedVariants: promo.variant_promo_data ? Object.keys(promo.variant_promo_data) : [],
          variants: convertedVariants,
        };

        setInitialFormData(formData);
        setSubmittedFormData(formData as PromoFormData);
        setNotes(promo.notes || '');

        // If there are analysis results, load them too
        if (promo.variant_promo_results && Object.keys(promo.variant_promo_results).length > 0) {
          // Convert variant_promo_results from snake_case (DB) to camelCase (code)
          const convertedResults: Record<string, any> = {};
          const percentageDecimals = cpgSettings?.decimal_places_percentage ?? 2;

          Object.entries(promo.variant_promo_results).forEach(([key, value]) => {
            // Recalculate margin quality using current settings instead of using stored value
            // This ensures old promos get updated thresholds
            const marginToUse = value.net_profit_margin_with_demo || value.net_profit_margin_with_promo;
            const recalculatedMarginQuality = cpgSettings
              ? getProfitMarginQualityWithSettings(marginToUse, cpgSettings)
              : value.margin_quality_with_promo; // Fallback to stored value if settings not loaded

            convertedResults[key] = {
              salesPromoCostPerUnit: value.sales_promo_cost_per_unit,
              cpuWithPromo: value.cpu_with_promo,
              actualLaborCostPerUnit: value.demo_hours_cost_per_unit,
              opportunityCostPerUnit: null, // Not separately stored
              totalCostWithLabor: value.total_cost_with_demo,
              netProfitMarginWithPromo: value.net_profit_margin_with_promo,
              netProfitMarginWithoutPromo: value.net_profit_margin_without_promo,
              netProfitMarginWithLabor: value.net_profit_margin_with_demo,
              marginQualityWithPromo: recalculatedMarginQuality,
              marginDifference: (parseFloat(value.net_profit_margin_with_promo) - parseFloat(value.net_profit_margin_without_promo)).toFixed(percentageDecimals),
            };
          });

          const result: PromoAnalysisResult = {
            promoId: promo.id,
            promoName: promo.promo_name,
            retailerName: promo.retailer_name,
            storeSalePercentage: promo.store_sale_percentage,
            producerPaybackPercentage: promo.producer_payback_percentage,
            demoHoursEntries: convertedDemoEntries,
            variantResults: convertedResults,
            totalPromoCost: promo.total_promo_cost,
            totalActualLaborCost: promo.total_actual_labor_cost,
            totalOpportunityCost: promo.total_opportunity_cost,
            recommendation: promo.recommendation || 'neutral',
            recommendationReason: '',
          };
          setAnalysisResult(result);

          // Scroll to results after a brief delay to allow rendering
          setTimeout(() => {
            scrollToResults();
          }, 300);
        }
      } catch (error) {
        console.error('Error loading draft promo:', error);
        setSuccessMessage(null);
        setErrorMessage({
          title: 'Error Loading Saved Promo',
          message: 'We encountered a problem while loading your saved promo. The data may be corrupted or incomplete.',
          action: 'You can start a fresh analysis instead. Your original promo is still saved and may be accessible later.',
        });
      }
    };

    loadDraftPromo();
  }, [editPromoId, cpgSettings]);

  /**
   * Handle form changes - track that there are unsaved edits
   */
  const handleFormChange = () => {
    setHasUnsavedChanges(true);
  };

  /**
   * Handle form submission - analyze the promo
   */
  const handleAnalyzePromo = async (formData: PromoFormData) => {
    setIsAnalyzing(true);
    setHasUnsavedChanges(false); // Clear unsaved changes flag since we're analyzing

    try {
      const service = new SalesPromoAnalyzerService(db);

      // Determine which promo to use:
      // 1. If editing an existing promo (editPromoId), use that
      // 2. If re-analyzing (analysisResult exists), use the existing promo
      // 3. Otherwise, create a new draft promo
      let promoId: string;

      // Convert demo hours entries from camelCase (form) to snake_case (DB)
      const convertedDemoEntries = formData.demoHoursEntries?.map(entry => ({
        id: entry.id,
        role_id: entry.roleId,
        role_name: entry.roleName,
        hours: entry.hours,
        hourly_rate: entry.hourlyRate,
        cost_type: entry.costType,
      })) || null;

      if (editPromoId) {
        // Editing existing promo
        promoId = editPromoId;
        await service.updatePromo(
          promoId,
          {
            promo_name: formData.promoName,
            retailer_name: formData.retailerName,
            promo_start_date: formData.promoStartDate ? dateStringToLocalTimestamp(formData.promoStartDate) : undefined,
            promo_end_date: formData.promoEndDate ? dateStringToLocalTimestamp(formData.promoEndDate) : undefined,
            store_sale_percentage: formData.storeSalePercentage,
            producer_payback_percentage: formData.producerPaybackPercentage,
            demo_hours_entries: convertedDemoEntries,
          },
          deviceId
        );
      } else if (analysisResult) {
        // Re-analyzing existing draft
        promoId = analysisResult.promoId;
        await service.updatePromo(
          promoId,
          {
            promo_name: formData.promoName,
            retailer_name: formData.retailerName,
            promo_start_date: formData.promoStartDate ? dateStringToLocalTimestamp(formData.promoStartDate) : undefined,
            promo_end_date: formData.promoEndDate ? dateStringToLocalTimestamp(formData.promoEndDate) : undefined,
            store_sale_percentage: formData.storeSalePercentage,
            producer_payback_percentage: formData.producerPaybackPercentage,
            demo_hours_entries: convertedDemoEntries,
          },
          deviceId
        );
      } else {
        // First analysis - create new draft promo
        const promo = await service.createPromo(
          {
            companyId: companyId,
            promoName: formData.promoName,
            retailerName: formData.retailerName,
            promoStartDate: formData.promoStartDate ? dateStringToLocalTimestamp(formData.promoStartDate) : undefined,
            promoEndDate: formData.promoEndDate ? dateStringToLocalTimestamp(formData.promoEndDate) : undefined,
            storeSalePercentage: formData.storeSalePercentage,
            producerPaybackPercentage: formData.producerPaybackPercentage,
            demoHoursEntries: formData.demoHoursEntries,
          },
          deviceId
        );
        promoId = promo.id;
      }

      // Filter to only include selected variants and ensure all values are valid
      const selectedVariantData: Record<string, any> = {};
      formData.selectedVariants.forEach((variantName) => {
        if (formData.variants[variantName]) {
          const variant = formData.variants[variantName];
          selectedVariantData[variantName] = {
            retailPrice: variant.retailPrice || '0',
            unitsAvailable: variant.unitsAvailable || '0',
            baseCPU: variant.baseCPU || '0', // Default to "0" if empty
            productionCPU: variant.productionCPU || '0', // Default to "0" if empty
          };
        }
      });

      // Analyze promo
      const result = await service.analyzePromo(
        {
          promoId: promoId,
          variantPromoData: selectedVariantData,
        },
        deviceId
      );

      setAnalysisResult(result);
      setSubmittedFormData(formData);
      setInitialFormData(formData); // Update baseline so form knows this is the "saved" state

      // Scroll to results section after a brief delay
      setTimeout(() => {
        scrollToResults();
      }, 100);
    } catch (error) {
      console.error('Error analyzing promo:', error);
      setSuccessMessage(null);
      setErrorMessage({
        title: 'Analysis Error',
        message: 'We ran into a problem while calculating your promo margins. This could be due to missing CPU data or an invalid calculation.',
        action: 'Double-check that all products have valid costs in your Product Catalog. Make sure all numbers in the form are valid (no negative values or extreme numbers).',
      });

      // Scroll to error message at top
      setTimeout(() => {
        scrollToTop();
      }, 100);
    } finally {
      setIsAnalyzing(false);
    }
  };

  /**
   * Show confirmation dialog for approve decision
   */
  const handleApprove = () => {
    // Check if there are unsaved changes
    if (hasUnsavedChanges) {
      setConfirmationDialog({
        isOpen: true,
        type: 'unsaved',
        title: 'Unsaved Changes Detected',
        message: 'You\'ve made changes to the form but haven\'t clicked "Update Analysis" yet. These changes won\'t be saved to the promo. Do you want to go back and update the analysis first, or proceed without saving these changes?',
        confirmLabel: 'Proceed Without Saving',
        onConfirm: () => {
          // Close unsaved warning and show approve confirmation
          setConfirmationDialog({
            isOpen: true,
            type: 'approve',
            title: editPromoId ? 'Update Promo Decision to Approve?' : 'Approve Promo Participation?',
            message: editPromoId
              ? 'You\'re about to update this promo\'s status to approved. This will replace the previous decision.'
              : 'You\'re about to approve participation in this promo. Your decision will be saved and tracked in your promo history.',
            confirmLabel: editPromoId ? 'Yes, Update to Approve' : 'Yes, Approve',
            onConfirm: handleApproveConfirmed,
          });
        },
      });
    } else {
      setConfirmationDialog({
        isOpen: true,
        type: 'approve',
        title: editPromoId ? 'Update Promo Decision to Approve?' : 'Approve Promo Participation?',
        message: editPromoId
          ? 'You\'re about to update this promo\'s status to approved. This will replace the previous decision.'
          : 'You\'re about to approve participation in this promo. Your decision will be saved and tracked in your promo history.',
        confirmLabel: editPromoId ? 'Yes, Update to Approve' : 'Yes, Approve',
        onConfirm: handleApproveConfirmed,
      });
    }
  };

  /**
   * Handle approve participation decision (after confirmation)
   */
  const handleApproveConfirmed = async () => {
    if (!analysisResult || !submittedFormData) return;

    setConfirmationDialog({ ...confirmationDialog, isOpen: false });
    setIsSaving(true);
    try {
      const service = new SalesPromoAnalyzerService(db);

      // Get current promo to check existing status
      const currentPromo = await db.cpgSalesPromos.get(analysisResult.promoId);

      // Preserve "completed" status if it's already completed, otherwise set to "approved"
      const newStatus = currentPromo?.status === 'completed' ? 'completed' : 'approved';

      // Convert demo hours entries from camelCase (form) to snake_case (DB)
      const convertedDemoEntries = submittedFormData.demoHoursEntries?.map(entry => ({
        id: entry.id,
        role_id: entry.roleId,
        role_name: entry.roleName,
        hours: entry.hours,
        hourly_rate: entry.hourlyRate,
        cost_type: entry.costType,
      })) || null;

      await service.updatePromo(
        analysisResult.promoId,
        {
          promo_name: submittedFormData.promoName,
          retailer_name: submittedFormData.retailerName,
          promo_start_date: submittedFormData.promoStartDate ? dateStringToLocalTimestamp(submittedFormData.promoStartDate) : undefined,
          promo_end_date: submittedFormData.promoEndDate ? dateStringToLocalTimestamp(submittedFormData.promoEndDate) : undefined,
          store_sale_percentage: submittedFormData.storeSalePercentage,
          producer_payback_percentage: submittedFormData.producerPaybackPercentage,
          demo_hours_entries: convertedDemoEntries,
          status: newStatus,
          notes: notes || null,
        },
        deviceId
      );

      // Clear the analysis and form to show success state
      setAnalysisResult(null);
      setSubmittedFormData(null);
      setInitialFormData(undefined);
      setNotes('');
      setErrorMessage(null);
      setSuccessMessage(editPromoId
        ? "Great! You've updated this promo to approved. Your decision has been saved."
        : "Great! You've approved participation in this promo. Your decision has been saved.");

      // Clear edit parameter from URL
      if (editPromoId) {
        navigate('/cpg/promo-decision', { replace: true });
      }

      // Scroll to top to show success message
      setTimeout(() => {
        scrollToTop();
      }, 100);
    } catch (error) {
      console.error('Error approving promo:', error);
      setSuccessMessage(null);
      setErrorMessage({
        title: 'Save Failed',
        message: 'We couldn\'t save your approval decision. This could be a temporary database issue.',
        action: 'Try clicking "Approve & Participate" again. If it still fails, take a screenshot of your analysis and contact support.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Show confirmation dialog for decline decision
   */
  const handleDecline = () => {
    // Check if there are unsaved changes
    if (hasUnsavedChanges) {
      setConfirmationDialog({
        isOpen: true,
        type: 'unsaved',
        title: 'Unsaved Changes Detected',
        message: 'You\'ve made changes to the form but haven\'t clicked "Update Analysis" yet. These changes won\'t be saved to the promo. Do you want to go back and update the analysis first, or proceed without saving these changes?',
        confirmLabel: 'Proceed Without Saving',
        onConfirm: () => {
          // Close unsaved warning and show decline confirmation
          setConfirmationDialog({
            isOpen: true,
            type: 'decline',
            title: editPromoId ? 'Update Promo Decision to Decline?' : 'Decline Promo Participation?',
            message: editPromoId
              ? 'You\'re about to update this promo\'s status to declined. This will replace the previous decision.'
              : 'You\'re about to decline participation in this promo. Your decision will be saved and you can review it later if needed.',
            confirmLabel: editPromoId ? 'Yes, Update to Decline' : 'Yes, Decline',
            onConfirm: handleDeclineConfirmed,
          });
        },
      });
    } else {
      setConfirmationDialog({
        isOpen: true,
        type: 'decline',
        title: editPromoId ? 'Update Promo Decision to Decline?' : 'Decline Promo Participation?',
        message: editPromoId
          ? 'You\'re about to update this promo\'s status to declined. This will replace the previous decision.'
          : 'You\'re about to decline participation in this promo. Your decision will be saved and you can review it later if needed.',
        confirmLabel: editPromoId ? 'Yes, Update to Decline' : 'Yes, Decline',
        onConfirm: handleDeclineConfirmed,
      });
    }
  };

  /**
   * Handle decline participation decision (after confirmation)
   */
  const handleDeclineConfirmed = async () => {
    if (!analysisResult || !submittedFormData) return;

    setConfirmationDialog({ ...confirmationDialog, isOpen: false });
    setIsSaving(true);
    try {
      const service = new SalesPromoAnalyzerService(db);

      // Get current promo to check existing status
      const currentPromo = await db.cpgSalesPromos.get(analysisResult.promoId);

      // Preserve "completed" status if it's already completed, otherwise set to "declined"
      const newStatus = currentPromo?.status === 'completed' ? 'completed' : 'declined';

      // Convert demo hours entries from camelCase (form) to snake_case (DB)
      const convertedDemoEntries = submittedFormData.demoHoursEntries?.map(entry => ({
        id: entry.id,
        role_id: entry.roleId,
        role_name: entry.roleName,
        hours: entry.hours,
        hourly_rate: entry.hourlyRate,
        cost_type: entry.costType,
      })) || null;

      await service.updatePromo(
        analysisResult.promoId,
        {
          promo_name: submittedFormData.promoName,
          retailer_name: submittedFormData.retailerName,
          promo_start_date: submittedFormData.promoStartDate ? dateStringToLocalTimestamp(submittedFormData.promoStartDate) : undefined,
          promo_end_date: submittedFormData.promoEndDate ? dateStringToLocalTimestamp(submittedFormData.promoEndDate) : undefined,
          store_sale_percentage: submittedFormData.storeSalePercentage,
          producer_payback_percentage: submittedFormData.producerPaybackPercentage,
          demo_hours_entries: convertedDemoEntries,
          status: newStatus,
          notes: notes || null,
        },
        deviceId
      );

      // Clear the analysis and form to show success state
      setAnalysisResult(null);
      setSubmittedFormData(null);
      setInitialFormData(undefined);
      setNotes('');
      setErrorMessage(null);
      setSuccessMessage(editPromoId
        ? "You've updated this promo to declined. Your decision has been saved. Good call protecting your margins!"
        : 'Your decision to decline has been saved. Good call protecting your margins!');

      // Clear edit parameter from URL
      if (editPromoId) {
        navigate('/cpg/promo-decision', { replace: true });
      }

      // Scroll to top to show success message
      setTimeout(() => {
        scrollToTop();
      }, 100);
    } catch (error) {
      console.error('Error declining promo:', error);
      setSuccessMessage(null);
      setErrorMessage({
        title: 'Save Failed',
        message: 'We couldn\'t save your decline decision. This could be a temporary database issue.',
        action: 'Try clicking "Decline" again. If it still fails, take a screenshot of your analysis and contact support.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Handle save for later decision
   */
  const handleSaveForLater = async () => {
    if (!analysisResult || !submittedFormData) return;

    // Check if there are unsaved changes
    if (hasUnsavedChanges) {
      setConfirmationDialog({
        isOpen: true,
        type: 'unsaved',
        title: 'Unsaved Changes Detected',
        message: 'You\'ve made changes to the form but haven\'t clicked "Update Analysis" yet. These changes won\'t be saved to the promo. Do you want to go back and update the analysis first, or proceed without saving these changes?',
        confirmLabel: 'Proceed Without Saving',
        onConfirm: handleSaveForLaterConfirmed,
      });
      return;
    }

    handleSaveForLaterConfirmed();
  };

  /**
   * Handle save for later decision (after unsaved changes check)
   */
  const handleSaveForLaterConfirmed = async () => {
    if (!analysisResult || !submittedFormData) return;

    setConfirmationDialog({ ...confirmationDialog, isOpen: false });
    setIsSaving(true);
    try {
      const service = new SalesPromoAnalyzerService(db);

      // Get current promo to check existing status
      const currentPromo = await db.cpgSalesPromos.get(analysisResult.promoId);

      // Preserve existing status if it's completed or approved, otherwise set to draft
      const newStatus = currentPromo?.status === 'completed' || currentPromo?.status === 'approved'
        ? currentPromo.status
        : 'draft';

      // Convert demo hours entries from camelCase (form) to snake_case (DB)
      const convertedDemoEntries = submittedFormData.demoHoursEntries?.map(entry => ({
        id: entry.id,
        role_id: entry.roleId,
        role_name: entry.roleName,
        hours: entry.hours,
        hourly_rate: entry.hourlyRate,
        cost_type: entry.costType,
      })) || null;

      await service.updatePromo(
        analysisResult.promoId,
        {
          promo_name: submittedFormData.promoName,
          retailer_name: submittedFormData.retailerName,
          promo_start_date: submittedFormData.promoStartDate ? dateStringToLocalTimestamp(submittedFormData.promoStartDate) : undefined,
          promo_end_date: submittedFormData.promoEndDate ? dateStringToLocalTimestamp(submittedFormData.promoEndDate) : undefined,
          store_sale_percentage: submittedFormData.storeSalePercentage,
          producer_payback_percentage: submittedFormData.producerPaybackPercentage,
          demo_hours_entries: convertedDemoEntries,
          status: newStatus,
          notes: notes || null,
        },
        deviceId
      );

      // Clear the analysis and form to show success state
      setAnalysisResult(null);
      setSubmittedFormData(null);
      setInitialFormData(undefined);
      setNotes('');
      setErrorMessage(null);
      setSuccessMessage(editPromoId
        ? 'Draft updated! You can review this promo again anytime from your promo list.'
        : 'Saved! You can review this promo again anytime from your promo list.');

      // Clear edit parameter from URL
      if (editPromoId) {
        navigate('/cpg/promo-decision', { replace: true });
      }

      // Scroll to top to show success message
      setTimeout(() => {
        scrollToTop();
      }, 100);
    } catch (error) {
      console.error('Error saving promo:', error);
      setSuccessMessage(null);
      setErrorMessage({
        title: 'Save Failed',
        message: 'We couldn\'t save your promo for later review. This could be a temporary database issue.',
        action: 'Try clicking "Save for Later" again. Your analysis is still visible on screen, so you won\'t lose your work.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Convert analysis result to comparison data format
   */
  const getComparisonData = (): VariantComparisonData[] => {
    if (!analysisResult || !submittedFormData) return [];

    // Get decimal precision from settings (default to 2 if not available)
    const decimalPlaces = cpgSettingsFromContext?.decimal_places_currency ?? cpgSettings?.decimal_places_currency ?? 2;

    return Object.entries(analysisResult.variantResults).map(([variant, results]) => {
      // Get data from submitted form
      const retailPrice = submittedFormData.variants[variant]?.retailPrice || '0';
      const retailPriceNum = parseFloat(retailPrice);
      const materialCPU = parseFloat(submittedFormData.variants[variant]?.baseCPU || '0');
      const productionCPU = parseFloat(submittedFormData.variants[variant]?.productionCPU || '0');

      // Calculate total base CPU (materials + production labor)
      const baseCPU = (materialCPU + productionCPU).toFixed(decimalPlaces);
      const baseCPUNum = parseFloat(baseCPU);

      // Calculate gross profit for WITHOUT promo
      const grossProfitWithout = (retailPriceNum - baseCPUNum).toFixed(decimalPlaces);

      // Calculate total cost and gross profit for WITH promo
      const salesPromoCost = parseFloat(results.salesPromoCostPerUnit);
      const actualLaborCost = results.actualLaborCostPerUnit ? parseFloat(results.actualLaborCostPerUnit) : 0;
      const opportunityCost = results.opportunityCostPerUnit ? parseFloat(results.opportunityCostPerUnit) : 0;
      const totalLaborCost = actualLaborCost + opportunityCost;
      const totalCostWith = (baseCPUNum + salesPromoCost + totalLaborCost).toFixed(decimalPlaces);
      const grossProfitWith = (retailPriceNum - parseFloat(totalCostWith)).toFixed(decimalPlaces);

      return {
        variant,
        retailPrice,
        withoutPromo: {
          cpu: baseCPU,
          grossProfit: grossProfitWithout,
          margin: results.netProfitMarginWithoutPromo,
          marginQuality: getProfitMarginQuality(results.netProfitMarginWithoutPromo),
        },
        withPromo: {
          cpu: baseCPU, // Base CPU is the same, promo cost is shown separately
          salesPromoCost: results.salesPromoCostPerUnit,
          demoHoursCost: totalLaborCost > 0 ? totalLaborCost.toFixed(decimalPlaces) : undefined,
          totalCost: totalCostWith,
          grossProfit: grossProfitWith,
          margin: results.netProfitMarginWithLabor || results.netProfitMarginWithPromo,
          marginQuality: results.marginQualityWithPromo,
        },
        marginDifference: results.marginDifference,
      };
    });
  };

  /**
   * Helper to determine margin quality from percentage using CPG settings
   */
  const getProfitMarginQuality = (marginPercentage: string): 'gutCheck' | 'good' | 'better' | 'best' => {
    if (!cpgSettings) {
      // Fallback to defaults if settings not loaded yet
      const margin = parseFloat(marginPercentage);
      if (margin < 50) return 'gutCheck';
      if (margin < 60) return 'good';
      if (margin < 70) return 'better';
      return 'best';
    }
    return getProfitMarginQualityWithSettings(marginPercentage, cpgSettings);
  };

  /**
   * Calculate average financial metrics across all variants
   */
  const getAverageFinancialMetrics = () => {
    const comparisonData = getComparisonData();
    if (comparisonData.length === 0) {
      return {
        averageRetailPrice: '0',
        averageCPU: '0',
        averageSalesPromoCost: '0',
        averageGrossProfitWithPromo: '0',
        averageMarginWithPromo: '0',
      };
    }

    // Get decimal precision from settings
    const currencyDecimals = cpgSettingsFromContext?.decimal_places_currency ?? cpgSettings?.decimal_places_currency ?? 2;
    const percentageDecimals = cpgSettingsFromContext?.decimal_places_percentage ?? cpgSettings?.decimal_places_percentage ?? 2;

    const totalRetailPrice = comparisonData.reduce((sum, v) => sum + parseFloat(v.retailPrice), 0);
    const totalCPU = comparisonData.reduce((sum, v) => sum + parseFloat(v.withPromo.cpu), 0);
    const totalSalesPromo = comparisonData.reduce((sum, v) => sum + parseFloat(v.withPromo.salesPromoCost), 0);
    const totalGrossProfit = comparisonData.reduce((sum, v) => sum + parseFloat(v.withPromo.grossProfit), 0);
    const totalMargin = comparisonData.reduce((sum, v) => sum + parseFloat(v.withPromo.margin), 0);

    const count = comparisonData.length;

    return {
      averageRetailPrice: (totalRetailPrice / count).toFixed(currencyDecimals),
      averageCPU: (totalCPU / count).toFixed(currencyDecimals),
      averageSalesPromoCost: (totalSalesPromo / count).toFixed(currencyDecimals),
      averageGrossProfitWithPromo: (totalGrossProfit / count).toFixed(currencyDecimals),
      averageMarginWithPromo: (totalMargin / count).toFixed(percentageDecimals),
    };
  };

  /**
   * Calculate total units across SELECTED variants only
   */
  const getTotalUnits = (): string => {
    if (!submittedFormData) return '0';

    // IMPORTANT: Only count selected variants, not all variants in the form
    const total = submittedFormData.selectedVariants.reduce((sum, variantName) => {
      const variant = submittedFormData.variants[variantName];
      if (variant) {
        return sum + parseFloat(variant.unitsAvailable || '0');
      }
      return sum;
    }, 0);

    return total.toString();
  };

  /**
   * Get variant-specific data for per-variant what-if scenarios
   */
  const getVariantData = () => {
    if (!analysisResult || !submittedFormData) return undefined;

    return submittedFormData.selectedVariants.map((variantName) => {
      const variant = submittedFormData.variants[variantName];
      const variantResult = analysisResult.variantResults[variantName];

      if (!variant || !variantResult) return null;

      // Calculate base CPU (materials + production labor, without promo cost)
      const materialCPU = parseFloat(variant.baseCPU || '0');
      const productionCPU = parseFloat(variant.productionCPU || '0');
      const baseCPU = materialCPU + productionCPU;

      return {
        name: variantName,
        unitsAvailable: parseFloat(variant.unitsAvailable),
        retailPrice: parseFloat(variant.retailPrice),
        promoCostPerUnit: parseFloat(variantResult.salesPromoCostPerUnit),
        baseCPU: baseCPU,
      };
    }).filter((v): v is NonNullable<typeof v> => v !== null);
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Promo Analysis</h1>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          onClick={() => {
            setActiveTab('decision-tool');
            // Clear edit parameter when manually switching to Decision Tool
            if (editPromoId) {
              navigate('/cpg/promo-decision', { replace: true });
            }
          }}
          className={activeTab === 'decision-tool' ? styles.tabActive : styles.tab}
        >
          Decision Tool
          <PinIcon
            isPinned={pinnedTabs['decision-tool'] || false}
            onClick={() => handlePinToggle('decision-tool')}
            size={14}
          />
        </button>
        <button
          onClick={() => {
            setActiveTab('promo-tracker');
            // Clear edit parameter when switching to Promo Tracker
            if (editPromoId) {
              navigate('/cpg/promo-decision', { replace: true });
            }
          }}
          className={activeTab === 'promo-tracker' ? styles.tabActive : styles.tab}
        >
          Promo Tracker
          <PinIcon
            isPinned={pinnedTabs['promo-tracker'] || false}
            onClick={() => handlePinToggle('promo-tracker')}
            size={14}
          />
        </button>
      </div>

      {/* Decision Tool Tab */}
      {activeTab === 'decision-tool' && (
        <div className={styles.tabContent} ref={tabContentRef}>

        {/* Success Message */}
        {successMessage && (
          <div className={styles.successMessage}>
            <div className={styles.successIcon}>✓</div>
            <div className={styles.successContent}>
              <p className={styles.successText}>{successMessage}</p>
              <p className={styles.successLink}>
                View all your decisions in the Promo Tracker tab.
              </p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {errorMessage && (
          <div className={styles.errorMessage}>
            <div className={styles.errorIcon}>⚠️</div>
            <div className={styles.errorContent}>
              <h4 className={styles.errorTitle}>{errorMessage.title}</h4>
              <p className={styles.errorText}>{errorMessage.message}</p>
              {errorMessage.action && (
                <p className={styles.errorAction}>
                  <strong>What to do:</strong> {errorMessage.action}
                </p>
              )}
              <Button
                type="button"
                variant="secondary"
                size="small"
                onClick={() => setErrorMessage(null)}
                className={styles.dismissButton}
              >
                Dismiss
              </Button>
            </div>
          </div>
        )}

        {isLoadingData ? (
          <div className={styles.loading}>
            <div className={styles.loadingIcon}>🌱</div>
            <p className={styles.loadingText}>Gathering your ingredients from the garden...</p>
          </div>
        ) : (
          <div className={styles.pageContent} ref={pageContentRef}>
            {/* CPU Error Warning */}
            {cpuErrors.length > 0 && (
              <div className={styles.cpuErrorWarning}>
                <div className={styles.warningIcon}>⚠️</div>
                <div className={styles.warningContent}>
                  <h4 className={styles.warningTitle}>Missing Cost Data</h4>
                  <p className={styles.warningMessage}>
                    We couldn't calculate costs for {cpuErrors.length} product{cpuErrors.length > 1 ? 's' : ''}.
                    These products may be missing ingredient costs or recipe data.
                  </p>
                  <ul className={styles.warningList}>
                    {cpuErrors.slice(0, 5).map((product) => (
                      <li key={product}>{product}</li>
                    ))}
                    {cpuErrors.length > 5 && (
                      <li>...and {cpuErrors.length - 5} more</li>
                    )}
                  </ul>
                  <p className={styles.warningAction}>
                    Please update these products in your Product Catalog before including them in promo analysis.
                  </p>
                </div>
              </div>
            )}

            {/* Empty State - No Products */}
            {availableVariants.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyStateIcon}>📦</div>
                <h3 className={styles.emptyStateTitle}>No Products Available</h3>
                <p className={styles.emptyStateMessage}>
                  You need to create products in your Product Catalog before you can analyze promo offers.
                </p>
                <p className={styles.emptyStateAction}>
                  Visit <a href="/cpg/products" className={styles.link}>Product Catalog</a> to add your first product.
                </p>
              </div>
            ) : (
              <>
                {/* Promo Details Form */}
                <section className={styles.section}>
                <PromoDetailsForm
                  companyId={companyId}
                  availableVariants={availableVariants}
                  latestCPUs={latestCPUs}
                  latestLaborCosts={latestLaborCosts}
                  latestSoldPriceToYous={latestSoldPriceToYous}
                  onSubmit={handleAnalyzePromo}
                  onClear={() => {
                    setAnalysisResult(null);
                    setSubmittedFormData(null);
                    setSuccessMessage(null);
                    setErrorMessage(null);
                    setInitialFormData(undefined);
                    setHasUnsavedChanges(false);
                  }}
                  onFormChange={handleFormChange}
                  isLoading={isAnalyzing}
                  initialData={initialFormData}
                />
                </section>

                {/* Analysis Results - Only show after analysis */}
                {analysisResult && (
                  <div ref={resultsRef}>
                    {/* Side-by-Side Comparison */}
                    <section className={styles.section}>
                      <PromoComparison variants={getComparisonData()} />
                    </section>

                    {/* Impact Summary */}
                    <section className={styles.section}>
                      <PromoImpactSummary
                        marginDifference={
                          Object.values(analysisResult.variantResults)[0]?.marginDifference || '0.00'
                        }
                        totalPromoCost={analysisResult.totalPromoCost}
                        totalActualLaborCost={analysisResult.totalActualLaborCost}
                        totalOpportunityCost={analysisResult.totalOpportunityCost}
                        totalUnits={getTotalUnits()}
                        variantData={getVariantData()}
                        {...getAverageFinancialMetrics()}
                      />
                    </section>

                    {/* Decision Actions */}
                    <section className={styles.section}>
                      <div className={styles.decisionCard}>
                        <h3 className={styles.decisionTitle}>Your Decision</h3>
                        <p className={styles.decisionDescription}>
                          Based on the analysis above, what would you like to do with this promotion?
                        </p>

                        {/* Notes Field */}
                        <div className={styles.notesField}>
                          <label htmlFor="decision-notes" className={styles.notesLabel}>
                            Notes (Optional)
                          </label>
                          <textarea
                            id="decision-notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className={styles.notesTextarea}
                            placeholder="Add any notes about your decision..."
                            rows={4}
                          />
                        </div>

                        {/* Action Buttons */}
                        <div className={styles.decisionActions}>
                          <Button
                            variant="primary"
                            size="lg"
                            onClick={handleApprove}
                            loading={isSaving}
                            disabled={isSaving}
                            className={styles.approveButton}
                          >
                            {editPromoId ? 'Update to Approve' : 'Approve Participation'}
                          </Button>
                          <Button
                            variant="danger"
                            size="lg"
                            onClick={handleDecline}
                            loading={isSaving}
                            disabled={isSaving}
                            className={styles.declineButton}
                          >
                            {editPromoId ? 'Update to Decline' : 'Decline Participation'}
                          </Button>
                          <Button
                            variant="secondary"
                            size="lg"
                            onClick={handleSaveForLater}
                            loading={isSaving}
                            disabled={isSaving}
                            className={styles.saveDraftButton}
                          >
                            {editPromoId ? 'Update Draft' : 'Save for Later'}
                          </Button>
                        </div>
                      </div>
                    </section>
                  </div>
                )}
              </>
            )}
          </div>
        )}

          {/* Confirmation Dialog */}
          {confirmationDialog.isOpen && (
            <div className={styles.modalOverlay} onClick={() => setConfirmationDialog({ ...confirmationDialog, isOpen: false })}>
              <div
                ref={modalRef}
                className={styles.modalContent}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
              >
                <div className={styles.modalHeader}>
                  <h3 id="modal-title" className={styles.modalTitle}>{confirmationDialog.title}</h3>
                </div>
                <div className={styles.modalBody}>
                  <p className={styles.modalMessage}>{confirmationDialog.message}</p>
                </div>
                <div className={styles.modalFooter}>
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() => setConfirmationDialog({ ...confirmationDialog, isOpen: false })}
                  >
                    {confirmationDialog.type === 'unsaved' ? 'Go Back and Update' : 'Cancel'}
                  </Button>
                  <Button
                    type="button"
                    variant={confirmationDialog.type === 'approve' ? 'primary' : 'danger'}
                    size="md"
                    onClick={confirmationDialog.onConfirm}
                    className={confirmationDialog.type === 'approve' ? styles.approveButton : styles.declineButton}
                  >
                    {confirmationDialog.confirmLabel}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Promo Tracker Tab */}
      {activeTab === 'promo-tracker' && (
        <div className={styles.tabContent}>
          <PromoTrackerTab />
        </div>
      )}
    </div>
  );
}
