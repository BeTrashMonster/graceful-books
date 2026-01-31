import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/core/Button';
import { PromoDetailsForm, type PromoFormData } from '../../components/cpg/PromoDetailsForm';
import { PromoComparison, type VariantComparisonData } from '../../components/cpg/PromoComparison';
import { PromoImpactSummary } from '../../components/cpg/PromoImpactSummary';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../db';
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
export default function SalesPromoDecisionTool() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { companyId, deviceId } = useAuth();
  // Database is imported as singleton

  // Fallback to demo IDs if not authenticated (development only)
  const activeCompanyId = companyId || 'demo-company-id';
  const activeDeviceId = deviceId || 'demo-device-id';

  // Check if we're editing an existing promo
  const editPromoId = searchParams.get('edit');

  // State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<PromoAnalysisResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [notes, setNotes] = useState('');
  const [availableVariants, setAvailableVariants] = useState<string[]>([]);
  const [latestCPUs, setLatestCPUs] = useState<Record<string, string>>({});
  const [latestMSRPs, setLatestMSRPs] = useState<Record<string, string>>({});
  const [cpuErrors, setCpuErrors] = useState<string[]>([]); // Track products with CPU errors
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [submittedFormData, setSubmittedFormData] = useState<PromoFormData | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<{ title: string; message: string; action?: string } | null>(null);
  const [initialFormData, setInitialFormData] = useState<Partial<PromoFormData> | undefined>(undefined);
  const [confirmationDialog, setConfirmationDialog] = useState<{
    isOpen: boolean;
    type: 'approve' | 'decline' | null;
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
    if (pageContentRef.current) {
      pageContentRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const scrollToResults = () => {
    if (resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Load finished products (SKUs) and their CPUs
  useEffect(() => {
    const loadProductsAndCPUs = async () => {
      try {
        setIsLoadingData(true);

        // Get all active finished products
        const products = await db.cpgFinishedProducts
          .where('company_id')
          .equals(activeCompanyId)
          .filter(p => p.active && p.deleted_at === null)
          .toArray();

        // Use SKU or name as the variant identifier
        const productNames: string[] = [];
        const cpuMap: Record<string, string> = {};
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
              activeCompanyId
            );
            if (cpuBreakdown.cpu) {
              cpuMap[variantName] = cpuBreakdown.cpu;
            } else {
              failedCPUs.push(variantName);
            }
          } catch (error) {
            console.error(`Failed to get CPU for ${variantName}:`, error);
            failedCPUs.push(variantName);
          }

          // Get MSRP for this product (if available)
          if (product.msrp) {
            msrpMap[variantName] = product.msrp;
          }
        }

        setAvailableVariants(productNames.sort());
        setLatestCPUs(cpuMap);
        setLatestMSRPs(msrpMap);
        setCpuErrors(failedCPUs);
      } catch (error) {
        console.error('Error loading products and CPUs:', error);
        setSuccessMessage(null);
        setErrorMessage({
          title: 'Unable to Load Product Data',
          message: 'We had trouble loading your products from the database. This could be a temporary issue.',
          action: 'Try refreshing the page. If the problem continues, check that your products are properly saved in the Product Catalog.',
        });
      } finally {
        setIsLoadingData(false);
      }
    };

    loadProductsAndCPUs();
  }, [activeCompanyId]);

  // Load draft promo if editing
  useEffect(() => {
    if (!editPromoId) return;

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

        // Convert promo data to form data format
        const formData: Partial<PromoFormData> = {
          promoName: promo.promo_name,
          retailerName: promo.retailer_name || '',
          promoStartDate: promo.promo_start_date ? new Date(promo.promo_start_date).toISOString().split('T')[0] : '',
          promoEndDate: promo.promo_end_date ? new Date(promo.promo_end_date).toISOString().split('T')[0] : '',
          storeSalePercentage: promo.store_sale_percentage,
          producerPaybackPercentage: promo.producer_payback_percentage,
          demoHoursEntries: promo.demo_hours_entries || [],
          selectedVariants: promo.variant_promo_data ? Object.keys(promo.variant_promo_data) : [],
          variants: promo.variant_promo_data as Record<string, { retailPrice: string; unitsAvailable: string; baseCPU: string }>,
        };

        setInitialFormData(formData);
        setNotes(promo.notes || '');

        // If there are analysis results, load them too
        if (promo.variant_promo_results && Object.keys(promo.variant_promo_results).length > 0) {
          const result: PromoAnalysisResult = {
            promoId: promo.id,
            promoName: promo.promo_name,
            retailerName: promo.retailer_name,
            storeSalePercentage: promo.store_sale_percentage,
            producerPaybackPercentage: promo.producer_payback_percentage,
            demoHoursEntries: promo.demo_hours_entries || [],
            variantResults: promo.variant_promo_results as any,
            totalPromoCost: promo.total_promo_cost,
            totalActualLaborCost: promo.total_actual_labor_cost,
            totalOpportunityCost: promo.total_opportunity_cost,
            recommendation: promo.recommendation || 'neutral',
            recommendationReason: '',
          };
          setAnalysisResult(result);
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
  }, [editPromoId]);

  /**
   * Handle form submission - analyze the promo
   */
  const handleAnalyzePromo = async (formData: PromoFormData) => {
    setIsAnalyzing(true);

    try {
      const service = new SalesPromoAnalyzerService(db);

      // Create promo record
      const promo = await service.createPromo(
        {
          companyId: activeCompanyId,
          promoName: formData.promoName,
          retailerName: formData.retailerName,
          promoStartDate: formData.promoStartDate ? new Date(formData.promoStartDate).getTime() : undefined,
          promoEndDate: formData.promoEndDate ? new Date(formData.promoEndDate).getTime() : undefined,
          storeSalePercentage: formData.storeSalePercentage,
          producerPaybackPercentage: formData.producerPaybackPercentage,
          demoHoursEntries: formData.demoHoursEntries,
        },
        activeDeviceId
      );

      // Filter to only include selected variants
      const selectedVariantData: Record<string, any> = {};
      formData.selectedVariants.forEach((variantName) => {
        if (formData.variants[variantName]) {
          selectedVariantData[variantName] = formData.variants[variantName];
        }
      });

      // Analyze promo
      const result = await service.analyzePromo(
        {
          promoId: promo.id,
          variantPromoData: selectedVariantData,
        },
        activeDeviceId
      );

      setAnalysisResult(result);
      setSubmittedFormData(formData);

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
    setConfirmationDialog({
      isOpen: true,
      type: 'approve',
      title: 'Approve Promo Participation?',
      message: 'You\'re about to approve participation in this promo. Your decision will be saved and tracked in your promo history.',
      confirmLabel: 'Yes, Approve',
      onConfirm: handleApproveConfirmed,
    });
  };

  /**
   * Handle approve participation decision (after confirmation)
   */
  const handleApproveConfirmed = async () => {
    if (!analysisResult) return;

    setConfirmationDialog({ ...confirmationDialog, isOpen: false });
    setIsSaving(true);
    try {
      const service = new SalesPromoAnalyzerService(db);
      await service.updatePromo(
        analysisResult.promoId,
        {
          status: 'approved',
          notes: notes || null,
        },
        activeDeviceId
      );

      // Clear the analysis and form to show success state
      setAnalysisResult(null);
      setSubmittedFormData(null);
      setInitialFormData(undefined);
      setNotes('');
      setErrorMessage(null);
      setSuccessMessage("Great! You've approved participation in this promo. Your decision has been saved.");

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
    setConfirmationDialog({
      isOpen: true,
      type: 'decline',
      title: 'Decline Promo Participation?',
      message: 'You\'re about to decline participation in this promo. Your decision will be saved and you can review it later if needed.',
      confirmLabel: 'Yes, Decline',
      onConfirm: handleDeclineConfirmed,
    });
  };

  /**
   * Handle decline participation decision (after confirmation)
   */
  const handleDeclineConfirmed = async () => {
    if (!analysisResult) return;

    setConfirmationDialog({ ...confirmationDialog, isOpen: false });
    setIsSaving(true);
    try {
      const service = new SalesPromoAnalyzerService(db);
      await service.updatePromo(
        analysisResult.promoId,
        {
          status: 'declined',
          notes: notes || null,
        },
        activeDeviceId
      );

      // Clear the analysis and form to show success state
      setAnalysisResult(null);
      setSubmittedFormData(null);
      setInitialFormData(undefined);
      setNotes('');
      setErrorMessage(null);
      setSuccessMessage('Your decision to decline has been saved. Good call protecting your margins!');

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
    if (!analysisResult) return;

    setIsSaving(true);
    try {
      const service = new SalesPromoAnalyzerService(db);
      await service.updatePromo(
        analysisResult.promoId,
        {
          status: 'draft',
          notes: notes || null,
        },
        activeDeviceId
      );

      // Clear the analysis and form to show success state
      setAnalysisResult(null);
      setSubmittedFormData(null);
      setInitialFormData(undefined);
      setNotes('');
      setErrorMessage(null);
      setSuccessMessage('Saved! You can review this promo again anytime from your promo list.');

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

    return Object.entries(analysisResult.variantResults).map(([variant, results]) => {
      // Get retail price from submitted form data
      const retailPrice = submittedFormData.variants[variant]?.retailPrice || '0';
      const retailPriceNum = parseFloat(retailPrice);

      // Calculate base CPU (without promo cost)
      const baseCPU = (parseFloat(results.cpuWithPromo) - parseFloat(results.salesPromoCostPerUnit)).toFixed(2);
      const baseCPUNum = parseFloat(baseCPU);

      // Calculate gross profit for WITHOUT promo
      const grossProfitWithout = (retailPriceNum - baseCPUNum).toFixed(2);

      // Calculate total cost and gross profit for WITH promo
      const salesPromoCost = parseFloat(results.salesPromoCostPerUnit);
      const actualLaborCost = results.actualLaborCostPerUnit ? parseFloat(results.actualLaborCostPerUnit) : 0;
      const opportunityCost = results.opportunityCostPerUnit ? parseFloat(results.opportunityCostPerUnit) : 0;
      const totalLaborCost = actualLaborCost + opportunityCost;
      const totalCostWith = (baseCPUNum + salesPromoCost + totalLaborCost).toFixed(2);
      const grossProfitWith = (retailPriceNum - parseFloat(totalCostWith)).toFixed(2);

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
          demoHoursCost: totalLaborCost > 0 ? totalLaborCost.toFixed(2) : undefined,
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
   * Helper to determine margin quality from percentage
   */
  const getProfitMarginQuality = (marginPercentage: string): 'gutCheck' | 'good' | 'better' | 'best' => {
    const margin = parseFloat(marginPercentage);
    if (margin < 50) return 'gutCheck';
    if (margin < 60) return 'good';
    if (margin < 70) return 'better';
    return 'best';
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

    const totalRetailPrice = comparisonData.reduce((sum, v) => sum + parseFloat(v.retailPrice), 0);
    const totalCPU = comparisonData.reduce((sum, v) => sum + parseFloat(v.withPromo.cpu), 0);
    const totalSalesPromo = comparisonData.reduce((sum, v) => sum + parseFloat(v.withPromo.salesPromoCost), 0);
    const totalGrossProfit = comparisonData.reduce((sum, v) => sum + parseFloat(v.withPromo.grossProfit), 0);
    const totalMargin = comparisonData.reduce((sum, v) => sum + parseFloat(v.withPromo.margin), 0);

    const count = comparisonData.length;

    return {
      averageRetailPrice: (totalRetailPrice / count).toFixed(2),
      averageCPU: (totalCPU / count).toFixed(2),
      averageSalesPromoCost: (totalSalesPromo / count).toFixed(2),
      averageGrossProfitWithPromo: (totalGrossProfit / count).toFixed(2),
      averageMarginWithPromo: (totalMargin / count).toFixed(2),
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

      // Calculate base CPU (without promo cost)
      const baseCPU = parseFloat(variantResult.cpuWithPromo) - parseFloat(variantResult.salesPromoCostPerUnit);

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
        <h1 className="page-title">Sales Promo Decision Tool</h1>
        <p className="page-description">
          Take your time reviewing this promotion. We'll help you understand the impact on your margins
          and make a confident decision.
        </p>
        <p className={styles.helpLink}>
          Need to review past decisions? Visit{' '}
          <a href="/cpg/analytics?tab=promo-tracker" className={styles.link}>
            Analytics → Promo Tracker
          </a>
        </p>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className={styles.successMessage}>
          <div className={styles.successIcon}>✓</div>
          <div className={styles.successContent}>
            <p className={styles.successText}>{successMessage}</p>
            <p className={styles.successLink}>
              View all your decisions in <a href="/cpg/analytics?tab=promo-tracker" className={styles.link}>Analytics → Promo Tracker</a>.
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
                  availableVariants={availableVariants}
                  latestCPUs={latestCPUs}
                  latestMSRPs={latestMSRPs}
                  onSubmit={handleAnalyzePromo}
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
                    Approve Participation
                  </Button>
                  <Button
                    variant="danger"
                    size="lg"
                    onClick={handleDecline}
                    loading={isSaving}
                    disabled={isSaving}
                    className={styles.declineButton}
                  >
                    Decline Participation
                  </Button>
                  <Button
                    variant="secondary"
                    size="lg"
                    onClick={handleSaveForLater}
                    loading={isSaving}
                    disabled={isSaving}
                  >
                    Save for Later
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
                Cancel
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
  );
}
