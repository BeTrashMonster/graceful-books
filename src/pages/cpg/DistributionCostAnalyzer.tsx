import { useState, useEffect } from 'react';
import { DistributorSelector } from '../../components/cpg/DistributorSelector';
import { DistributorProfileForm } from '../../components/cpg/DistributorProfileForm';
import { DistributionCalculatorForm } from '../../components/cpg/DistributionCalculatorForm';
import { DistributionResultsDisplay } from '../../components/cpg/DistributionResultsDisplay';
import { Modal } from '../../components/modals/Modal';
import { Button } from '../../components/core/Button';
import { Loading } from '../../components/feedback/Loading';
import { ErrorMessage } from '../../components/feedback/ErrorMessage';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../db/database';
import type { CPGDistributor } from '../../db/schema/cpg.schema';
import type {
  DistributionCalcParams,
  DistributionCostResult,
} from '../../services/cpg/distributionCostCalculator.service';
import { DistributionCostCalculatorService } from '../../services/cpg/distributionCostCalculator.service';
import type { DistributorFormData } from '../../components/cpg/DistributorProfileForm';
import styles from './DistributionCostAnalyzer.module.css';

/**
 * DistributionCostAnalyzer Page
 *
 * Main page for distribution cost analysis with multi-layered fee structures.
 *
 * Requirements: Group C2 - Distribution Cost Analyzer
 *
 * Features:
 * - Distributor selection with "Add New Distributor" button
 * - Distributor profile form (fee structure entry)
 * - Distribution calculator (inputs and checkboxes)
 * - Results display with color-coded margins
 * - Save scenarios for comparison
 *
 * User Flow:
 * 1. Select or create distributor
 * 2. Enter calculation parameters
 * 3. Select applicable fees
 * 4. View results with color-coded margins
 * 5. Save calculation as scenario
 *
 * @example
 * Route: /cpg/distribution-cost-analyzer
 */
export default function DistributionCostAnalyzer() {
  // State
  const [distributors, setDistributors] = useState<CPGDistributor[]>([]);
  const [selectedDistributorId, setSelectedDistributorId] = useState<string | null>(null);
  const [selectedDistributor, setSelectedDistributor] = useState<CPGDistributor | null>(null);
  const [calculationResults, setCalculationResults] = useState<DistributionCostResult | null>(
    null
  );
  const [lastCalculationParams, setLastCalculationParams] = useState<DistributionCalcParams | null>(
    null
  );

  // Modal states
  const [showAddDistributorModal, setShowAddDistributorModal] = useState(false);
  const [showEditDistributorModal, setShowEditDistributorModal] = useState(false);
  const [showSaveScenarioModal, setShowSaveScenarioModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalMessage, setSuccessModalMessage] = useState('');

  // Loading and error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [savingDistributor, setSavingDistributor] = useState(false);
  const [savingScenario, setSavingScenario] = useState(false);

  // Auth context
  const { companyId, deviceId, _currentCompany, isLoading: authLoading } = useAuth();

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

  // Load distributors
  useEffect(() => {
    loadDistributors();
  }, []);

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

  const handleCalculate = async (params: DistributionCalcParams) => {
    try {
      setCalculating(true);
      setError(null);

      const results = await calculatorService.calculateDistributionCost(params);
      setCalculationResults(results);
      setLastCalculationParams(params); // Store params for saving later

      // Scroll to results after a brief delay to allow DOM to update
      setTimeout(() => {
        const resultsSection = document.querySelector('[data-results-section]');
        if (resultsSection) {
          resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    } catch (err) {
      console.error('Error calculating distribution costs:', err);
      setError('Oops! We had trouble calculating the costs. Please check your inputs.');
    } finally {
      setCalculating(false);
    }
  };

  const handleSaveScenario = async () => {
    if (!calculationResults || !selectedDistributor || !lastCalculationParams) return;

    try {
      setSavingScenario(true);
      setError(null);

      // For now, save without a name (can be enhanced to ask for scenario name)
      const scenarioName = `Calculation - ${new Date().toLocaleDateString()}`;

      console.log('Saving calculation with:', {
        companyId,
        deviceId,
        distributorId: calculationResults.distributorId,
        scenarioName,
      });

      const saved = await calculatorService.saveCalculation(
        calculationResults,
        lastCalculationParams,
        companyId,
        scenarioName,
        deviceId
      );

      console.log('Calculation saved:', saved);

      // Verify it was saved by querying all calculations for this company
      const allCalcs = await db.cpgDistributionCalculations
        .where('company_id')
        .equals(companyId)
        .toArray();
      console.log('All calculations in DB for this company:', allCalcs);

      setShowSaveScenarioModal(false);
      // Show success modal
      setSuccessModalMessage('Calculation saved successfully! You can view it in the Analytics tab under "Distributor Costs".');
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
        <div className={styles.headerContent}>
          <h1 className={styles.title}>Distribution Cost Analyzer ✅ NEW BUILD</h1>
          <p className={styles.description}>
            Calculate distribution costs and profit margins across different distributors.
            Compare scenarios to find the most profitable distribution strategy.
          </p>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className={styles.errorContainer}>
          <ErrorMessage message={error} onDismiss={() => setError(null)} />
        </div>
      )}

      {/* Main Content */}
      <div className={styles.content}>
        {/* Distributor Selection */}
        <div className={styles.section}>
          <DistributorSelector
            distributors={distributors}
            selectedDistributorId={selectedDistributorId}
            onSelect={setSelectedDistributorId}
            onAddNew={() => setShowAddDistributorModal(true)}
            loading={loading}
          />

          {selectedDistributor && (
            <div className={styles.editDistributorButton}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEditDistributorModal(true)}
              >
                Edit Distributor Profile
              </Button>
            </div>
          )}
        </div>

        {/* Calculator Form */}
        {selectedDistributor && (
          <div className={styles.section}>
            <DistributionCalculatorForm
              distributor={selectedDistributor}
              onCalculate={handleCalculate}
              loading={calculating}
            />
          </div>
        )}

        {/* Results */}
        {calculationResults && lastCalculationParams && (
          <div className={styles.section} data-results-section>
            <DistributionResultsDisplay
              results={calculationResults}
              params={lastCalculationParams}
              onSave={() => setShowSaveScenarioModal(true)}
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
          size="sm"
        >
          <div className={styles.confirmModal}>
            <div className={styles.confirmModalHeader}>
              <h2 className={styles.confirmModalTitle}>Save Calculation</h2>
            </div>
            <p className={styles.confirmModalMessage}>
              Save this calculation to compare with future scenarios?
            </p>
            <div className={styles.modalActions}>
              <Button
                variant="outline"
                onClick={() => setShowSaveScenarioModal(false)}
                disabled={savingScenario}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSaveScenario}
                loading={savingScenario}
                disabled={savingScenario}
              >
                Save Calculation
              </Button>
            </div>
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
              {successModalMessage.includes('Distributor Costs') ? (
                <>
                  {successModalMessage.split('Distributor Costs')[0]}
                  <a
                    href="/cpg/analytics?tab=distributor"
                    className={styles.successLink}
                    onClick={(e) => {
                      e.preventDefault();
                      setShowSuccessModal(false);
                      window.location.href = '/cpg/analytics?tab=distributor';
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
    </div>
  );
}
