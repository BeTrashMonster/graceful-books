import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DistributorSelector } from '../../components/cpg/DistributorSelector';
import { DistributorProfileForm } from '../../components/cpg/DistributorProfileForm';
import { DistributionCalculatorForm } from '../../components/cpg/DistributionCalculatorForm';
import { DistributionResultsDisplay } from '../../components/cpg/DistributionResultsDisplay';
import { DistributorManager } from '../../components/cpg/DistributorManager';
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
import styles from './Distribution.module.css';

type ViewMode = 'calculations' | 'manage';

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

  // Get initial tab from URL parameter, default to 'calculations'
  const tabParam = searchParams.get('tab') as ViewMode | null;
  const initialTab = tabParam && ['calculations', 'manage'].includes(tabParam)
    ? tabParam
    : 'calculations';

  // Get initial distributor from URL parameter
  const distributorParam = searchParams.get('distributor');

  const [viewMode, setViewMode] = useState<ViewMode>(initialTab);

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

  // Modal states
  const [showAddDistributorModal, setShowAddDistributorModal] = useState(false);
  const [showEditDistributorModal, setShowEditDistributorModal] = useState(false);
  const [showSaveScenarioModal, setShowSaveScenarioModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalMessage, setSuccessModalMessage] = useState('');
  const [showUnsavedWarningModal, setShowUnsavedWarningModal] = useState(false);

  // Track unsaved calculation results
  const [hasUnsavedResults, setHasUnsavedResults] = useState(false);

  // Loading and error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [savingDistributor, setSavingDistributor] = useState(false);
  const [savingScenario, setSavingScenario] = useState(false);

  // Auth context
  const { companyId: authCompanyId, deviceId: authDeviceId, currentCompany, isLoading: authLoading } = useAuth();

  // Service
  const [calculatorService] = useState(
    () => new DistributionCostCalculatorService(db)
  );

  // Use auth values (fallback to defaults for development if not authenticated)
  const companyId = authCompanyId || 'company-1';
  const deviceId = authDeviceId || 'device-1';

  // Load distributors
  useEffect(() => {
    loadDistributors();
  }, []);

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
      setHasUnsavedResults(true); // Mark as unsaved

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
      setHasUnsavedResults(false); // Mark as saved
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
          <h1 className={styles.title}>Distribution Center</h1>
          <p className={styles.description}>
            Calculate distribution costs, analyze profit margins, and manage distributor profiles.
          </p>
        </div>
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
          aria-selected={viewMode === 'calculations'}
          onClick={() => handleTabSwitch('calculations')}
          className={viewMode === 'calculations' ? styles.tabActive : styles.tab}
        >
          Cost Calculations
        </button>
        <button
          role="tab"
          aria-selected={viewMode === 'manage'}
          onClick={() => handleTabSwitch('manage')}
          className={viewMode === 'manage' ? styles.tabActive : styles.tab}
        >
          Manage Distributors
        </button>
      </div>

      {/* Main Content */}
      <div className={styles.content}>
        {/* Cost Calculations Tab */}
        {viewMode === 'calculations' && (
          <>
            {/* Distributor Selection */}
            <div className={styles.section}>
              <DistributorSelector
                distributors={distributors}
                selectedDistributorId={selectedDistributorId}
                onSelect={setSelectedDistributorId}
                loading={loading}
                hideAddButton={true}
              />

              {/* Action Buttons */}
              <div className={styles.distributorActions}>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setShowAddDistributorModal(true)}
                  disabled={loading}
                >
                  + Add New Distributor
                </Button>
                {selectedDistributor && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowEditDistributorModal(true)}
                  >
                    Edit Distributor Profile
                  </Button>
                )}
              </div>
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
          </>
        )}

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
                  setShowSaveScenarioModal(true);
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
    </div>
  );
}
