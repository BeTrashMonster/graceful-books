import { useState, useEffect } from 'react';
import { DistributorSelector } from '../../components/cpg/DistributorSelector';
import { DistributorProfileForm } from '../../components/cpg/DistributorProfileForm';
import { DistributionCalculatorForm } from '../../components/cpg/DistributionCalculatorForm';
import { DistributionResultsDisplay } from '../../components/cpg/DistributionResultsDisplay';
import { Modal } from '../../components/modals/Modal';
import { Button } from '../../components/core/Button';
import { Loading } from '../../components/feedback/Loading';
import { ErrorMessage } from '../../components/feedback/ErrorMessage';
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

  // Modal states
  const [showAddDistributorModal, setShowAddDistributorModal] = useState(false);
  const [showEditDistributorModal, setShowEditDistributorModal] = useState(false);
  const [showSaveScenarioModal, setShowSaveScenarioModal] = useState(false);

  // Loading and error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [savingDistributor, setSavingDistributor] = useState(false);
  const [savingScenario, setSavingScenario] = useState(false);

  // Service
  const [calculatorService] = useState(
    () => new DistributionCostCalculatorService(db)
  );

  // Device ID for CRDT
  const deviceId = 'device-1'; // TODO: Get from auth context

  // Company ID
  const companyId = 'company-1'; // TODO: Get from auth context

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
        deviceId
      );

      setDistributors([...distributors, distributor]);
      setSelectedDistributorId(distributor.id);
      setShowAddDistributorModal(false);
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
        },
        deviceId
      );

      setDistributors(
        distributors.map((d) => (d.id === updated.id ? updated : d))
      );
      setShowEditDistributorModal(false);
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
    } catch (err) {
      console.error('Error calculating distribution costs:', err);
      setError('Oops! We had trouble calculating the costs. Please check your inputs.');
    } finally {
      setCalculating(false);
    }
  };

  const handleSaveScenario = async () => {
    if (!calculationResults || !selectedDistributor) return;

    try {
      setSavingScenario(true);
      setError(null);

      // For now, save without a name (can be enhanced to ask for scenario name)
      const scenarioName = `Calculation - ${new Date().toLocaleDateString()}`;

      // Build params from results (we need to reconstruct the original params)
      // This is a simplified version - in production, you'd store the original params
      const params: DistributionCalcParams = {
        distributorId: calculationResults.distributorId,
        numPallets: '1', // TODO: Store original params
        unitsPerPallet: '100',
        variantData: Object.entries(calculationResults.variantResults).reduce(
          (acc, [variantName, result]) => {
            acc[variantName] = {
              price_per_unit: '0', // TODO: Store original params
              base_cpu: result.total_cpu,
            };
            return acc;
          },
          {} as DistributionCalcParams['variantData']
        ),
        appliedFees: {
          pallet_cost: false,
          warehouse_services: false,
          pallet_build: false,
          floor_space: 'none',
          truck_transfer_zone: 'none',
        },
      };

      await calculatorService.saveCalculation(
        calculationResults,
        params,
        companyId,
        scenarioName,
        deviceId
      );

      setShowSaveScenarioModal(false);
      // Show success message (can be enhanced with toast notification)
      alert('Calculation saved successfully!');
    } catch (err) {
      console.error('Error saving scenario:', err);
      setError('Oops! We had trouble saving the calculation. Please try again.');
    } finally {
      setSavingScenario(false);
    }
  };

  if (loading) {
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
          <h1 className={styles.title}>Distribution Cost Analyzer</h1>
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
        {calculationResults && (
          <div className={styles.section}>
            <DistributionResultsDisplay
              results={calculationResults}
              onSave={() => setShowSaveScenarioModal(true)}
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
          title="Save Calculation"
          size="sm"
        >
          <div className={styles.saveScenarioModal}>
            <p>Save this calculation to compare with future scenarios?</p>
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
    </div>
  );
}
