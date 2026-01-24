import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Breadcrumbs } from '../../components/navigation/Breadcrumbs';
import { Button } from '../../components/core/Button';
import { PromoDetailsForm, type PromoFormData } from '../../components/cpg/PromoDetailsForm';
import { PromoComparison, type VariantComparisonData } from '../../components/cpg/PromoComparison';
import { RecommendationBadge } from '../../components/cpg/RecommendationBadge';
import { PromoImpactSummary } from '../../components/cpg/PromoImpactSummary';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../db';
import { SalesPromoAnalyzerService, type PromoAnalysisResult } from '../../services/cpg/salesPromoAnalyzer.service';
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
  const { companyId, deviceId } = useAuth();
  // Database is imported as singleton

  // Fallback to demo IDs if not authenticated (development only)
  const activeCompanyId = companyId || 'demo-company-id';
  const activeDeviceId = deviceId || 'demo-device-id';

  // State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<PromoAnalysisResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [notes, setNotes] = useState('');

  // TODO: Replace with actual variants from company settings
  // For demo, using example variants
  const availableVariants = ['8oz', '16oz', '32oz'];

  // TODO: Replace with actual latest CPUs from invoices
  // For demo, using example CPUs
  const latestCPUs = {
    '8oz': '2.15',
    '16oz': '3.20',
    '32oz': '4.50',
  };

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
    } catch (error) {
      console.error('Error analyzing promo:', error);
      alert('Oops! Something went wrong while analyzing the promo. Please try again.');
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

      alert("Great! You've approved participation in this promo. Your decision has been saved.");
      navigate('/cpg/promos'); // TODO: Update route when promo list page exists
    } catch (error) {
      console.error('Error approving promo:', error);
      alert('Oops! Something went wrong while saving your decision. Please try again.');
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

      alert('Your decision to decline has been saved. Good call protecting your margins!');
      navigate('/cpg/promos'); // TODO: Update route when promo list page exists
    } catch (error) {
      console.error('Error declining promo:', error);
      alert('Oops! Something went wrong while saving your decision. Please try again.');
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

      alert('Saved! You can review this promo again anytime from your promo list.');
      navigate('/cpg/promos'); // TODO: Update route when promo list page exists
    } catch (error) {
      console.error('Error saving promo:', error);
      alert('Oops! Something went wrong while saving. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Convert analysis result to comparison data format
   */
  const getComparisonData = (): VariantComparisonData[] => {
    if (!analysisResult) return [];

    return Object.entries(analysisResult.variantResults).map(([variant, results]) => ({
      variant,
      withoutPromo: {
        cpu: results.cpuWithPromo, // Base CPU is cpuWithPromo minus salesPromoCostPerUnit
        margin: results.netProfitMarginWithoutPromo,
        marginQuality: getProfitMarginQuality(results.netProfitMarginWithoutPromo),
      },
      withPromo: {
        cpu: results.cpuWithPromo,
        salesPromoCost: results.salesPromoCostPerUnit,
        margin: results.netProfitMarginWithPromo,
        marginQuality: results.marginQualityWithPromo,
      },
      marginDifference: results.marginDifference,
    }));
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
    if (!analysisResult) return '0';
    // TODO: Get this from form data or analysis result
    return '500'; // Placeholder
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

      <div className={styles.pageContent}>
        {/* Promo Details Form */}
        <section className={styles.section}>
          <PromoDetailsForm
            availableVariants={availableVariants}
            latestCPUs={latestCPUs}
            onSubmit={handleAnalyzePromo}
            isLoading={isAnalyzing}
          />
        </section>

        {/* Analysis Results - Only show after analysis */}
        {analysisResult && (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}
