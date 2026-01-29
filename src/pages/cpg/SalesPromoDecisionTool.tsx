import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Breadcrumbs } from '../../components/navigation/Breadcrumbs';
import { Button } from '../../components/core/Button';
import { PromoDetailsForm, type PromoFormData } from '../../components/cpg/PromoDetailsForm';
import { PromoComparison, type VariantComparisonData } from '../../components/cpg/PromoComparison';
import { RecommendationBadge } from '../../components/cpg/RecommendationBadge';
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
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [submittedFormData, setSubmittedFormData] = useState<PromoFormData | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [initialFormData, setInitialFormData] = useState<Partial<PromoFormData> | undefined>(undefined);

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
            }
          } catch (error) {
            console.error(`Failed to get CPU for ${variantName}:`, error);
          }
        }

        setAvailableVariants(productNames.sort());
        setLatestCPUs(cpuMap);
      } catch (error) {
        console.error('Error loading products and CPUs:', error);
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
            variantResults: promo.variant_promo_results as any,
            totalPromoCost: promo.total_promo_cost,
            recommendation: promo.recommendation || 'neutral',
            recommendationReason: '',
          };
          setAnalysisResult(result);
        }
      } catch (error) {
        console.error('Error loading draft promo:', error);
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
        },
        activeDeviceId
      );

      // Analyze promo
      const result = await service.analyzePromo(
        {
          promoId: promo.id,
          variantPromoData: formData.variants,
        },
        activeDeviceId
      );

      setAnalysisResult(result);
      setSubmittedFormData(formData);

      // Scroll to results section after a brief delay
      setTimeout(() => {
        const resultsSection = document.querySelector('[data-results-section]');
        if (resultsSection) {
          resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    } catch (error) {
      console.error('Error analyzing promo:', error);
      setSuccessMessage('Oops! Something went wrong while analyzing the promo. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  /**
   * Handle approve participation decision
   */
  const handleApprove = async () => {
    if (!analysisResult) return;

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

      // Clear the analysis to show success state
      setAnalysisResult(null);
      setSuccessMessage("Great! You've approved participation in this promo. Your decision has been saved.");

      // Scroll to top to show success message - find the scrollable main container
      setTimeout(() => {
        // The scrollable container is the main element with overflow-y: auto
        const scrollContainer = document.querySelector('main');
        if (scrollContainer) {
          scrollContainer.scrollTop = 0;
        }
      }, 100);
    } catch (error) {
      console.error('Error approving promo:', error);
      setSuccessMessage('Oops! Something went wrong while saving your decision. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Handle decline participation decision
   */
  const handleDecline = async () => {
    if (!analysisResult) return;

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

      // Clear the analysis to show success state
      setAnalysisResult(null);
      setSuccessMessage('Your decision to decline has been saved. Good call protecting your margins!');

      // Scroll to top to show success message - find the scrollable main container
      setTimeout(() => {
        const scrollContainer = document.querySelector('main');
        if (scrollContainer) {
          scrollContainer.scrollTop = 0;
        }
      }, 100);
    } catch (error) {
      console.error('Error declining promo:', error);
      setSuccessMessage('Oops! Something went wrong while saving your decision. Please try again.');
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

      // Clear the analysis to show success state
      setAnalysisResult(null);
      setSuccessMessage('Saved! You can review this promo again anytime from your promo list.');

      // Scroll to top to show success message - find the scrollable main container
      setTimeout(() => {
        const scrollContainer = document.querySelector('main');
        if (scrollContainer) {
          scrollContainer.scrollTop = 0;
        }
      }, 100);
    } catch (error) {
      console.error('Error saving promo:', error);
      setSuccessMessage('Oops! Something went wrong while saving. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Convert analysis result to comparison data format
   */
  const getComparisonData = (): VariantComparisonData[] => {
    if (!analysisResult) return [];

    return Object.entries(analysisResult.variantResults).map(([variant, results]) => {
      // Calculate base CPU (without promo cost)
      const baseCPU = (parseFloat(results.cpuWithPromo) - parseFloat(results.salesPromoCostPerUnit)).toFixed(2);

      return {
        variant,
        withoutPromo: {
          cpu: baseCPU,
          margin: results.netProfitMarginWithoutPromo,
          marginQuality: getProfitMarginQuality(results.netProfitMarginWithoutPromo),
        },
        withPromo: {
          cpu: baseCPU, // Base CPU is the same, promo cost is shown separately
          salesPromoCost: results.salesPromoCostPerUnit,
          margin: results.netProfitMarginWithPromo,
          marginQuality: results.marginQualityWithPromo,
        },
        marginDifference: results.marginDifference,
      };
    });
  };

  /**
   * Helper to determine margin quality from percentage
   */
  const getProfitMarginQuality = (marginPercentage: string): 'poor' | 'good' | 'better' | 'best' => {
    const margin = parseFloat(marginPercentage);
    if (margin < 50) return 'poor';
    if (margin < 60) return 'good';
    if (margin < 70) return 'better';
    return 'best';
  };

  /**
   * Calculate total units across all variants
   */
  const getTotalUnits = (): string => {
    if (!submittedFormData) return '0';

    const total = Object.values(submittedFormData.variants).reduce((sum, variant) => {
      return sum + parseFloat(variant.unitsAvailable || '0');
    }, 0);

    return total.toString();
  };

  return (
    <div className="page">
      <Breadcrumbs />
      <div className="page-header">
        <h1 className="page-title">Sales Promo Decision Tool</h1>
        <p className="page-description">
          Take your time reviewing this promotion. We'll help you understand the impact on your margins
          and make a confident decision.
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

      {isLoadingData ? (
        <div className={styles.loading}>
          <p>Loading your product variants and costs...</p>
        </div>
      ) : (
        <div className={styles.pageContent}>
          {/* Promo Details Form */}
          <section className={styles.section}>
            <PromoDetailsForm
              availableVariants={availableVariants}
              latestCPUs={latestCPUs}
              onSubmit={handleAnalyzePromo}
              isLoading={isAnalyzing}
              initialData={initialFormData}
            />
          </section>

        {/* Analysis Results - Only show after analysis */}
        {analysisResult && (
          <div data-results-section>
            {/* Recommendation Badge */}
            <section className={styles.section}>
              <RecommendationBadge
                recommendation={analysisResult.recommendation}
                reason={analysisResult.recommendationReason}
              />
            </section>

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
                totalUnits={getTotalUnits()}
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
        </div>
      )}
    </div>
  );
}
