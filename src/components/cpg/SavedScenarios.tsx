import { useState, useEffect } from 'react';
import { Button } from '../core/Button';
import { Loading } from '../feedback/Loading';
import { ErrorMessage } from '../feedback/ErrorMessage';
import { Modal } from '../modals/Modal';
import { db } from '../../db/database';
import type { CPGDistributionCalculation, CPGDistributor } from '../../db/schema/cpg.schema';
import styles from './SavedScenarios.module.css';

interface SavedScenariosProps {
  companyId: string;
  deviceId: string;
  onLoadScenario?: (scenario: CPGDistributionCalculation) => void;
  onConvertToInvoice?: (scenario: CPGDistributionCalculation) => void;
}

/**
 * Saved Scenarios Component
 *
 * Displays all draft distribution calculations for scenario planning.
 * Features:
 * - Table view with scenario details
 * - Load scenario into calculator
 * - Duplicate scenario
 * - Delete scenario
 * - Convert to invoice
 */
export function SavedScenarios({ companyId, deviceId, onLoadScenario, onConvertToInvoice }: SavedScenariosProps) {
  const [scenarios, setScenarios] = useState<CPGDistributionCalculation[]>([]);
  const [distributors, setDistributors] = useState<CPGDistributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [scenarioToDelete, setScenarioToDelete] = useState<CPGDistributionCalculation | null>(null);

  useEffect(() => {
    loadData();
  }, [companyId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load all draft scenarios (query by company_id and filter for drafts)
      const draftScenarios = await db.cpgDistributionCalculations
        .where('company_id')
        .equals(companyId)
        .and((calc) => calc.active === true && calc.deleted_at === null && calc.is_draft === true)
        .toArray();

      // Load distributors for display
      const allDistributors = await db.cpgDistributors
        .where('company_id')
        .equals(companyId)
        .toArray();

      setScenarios(draftScenarios.sort((a, b) => b.updated_at - a.updated_at));
      setDistributors(allDistributors);
    } catch (err) {
      console.error('Error loading scenarios:', err);
      setError('Oops! We had trouble loading your saved scenarios. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getDistributorName = (distributorId: string): string => {
    const distributor = distributors.find((d) => d.id === distributorId);
    return distributor?.name || 'Unknown';
  };

  const handleDelete = (scenario: CPGDistributionCalculation) => {
    setScenarioToDelete(scenario);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!scenarioToDelete) return;

    try {
      setDeletingId(scenarioToDelete.id);
      setError(null);

      // Soft delete
      await db.cpgDistributionCalculations.update(scenarioToDelete.id, {
        active: false,
        deleted_at: Date.now(),
        updated_at: Date.now(),
      });

      // Remove from local state
      setScenarios(scenarios.filter((s) => s.id !== scenarioToDelete.id));
      setShowDeleteConfirm(false);
      setScenarioToDelete(null);
    } catch (err) {
      console.error('Error deleting scenario:', err);
      setError('Oops! We had trouble deleting the scenario. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDuplicate = async (scenario: CPGDistributionCalculation) => {
    try {
      setError(null);

      const newScenario: CPGDistributionCalculation = {
        ...scenario,
        id: crypto.randomUUID(),
        calculation_name: `${scenario.calculation_name} (Copy)`,
        created_at: Date.now(),
        updated_at: Date.now(),
        version_vector: { [deviceId]: 1 },
      };

      await db.cpgDistributionCalculations.add(newScenario);
      setScenarios([newScenario, ...scenarios]);
    } catch (err) {
      console.error('Error duplicating scenario:', err);
      setError('Oops! We had trouble duplicating the scenario. Please try again.');
    }
  };

  const handleLoad = (scenario: CPGDistributionCalculation) => {
    if (onLoadScenario) {
      onLoadScenario(scenario);
    }
  };

  const handleConvertToInvoice = (scenario: CPGDistributionCalculation) => {
    if (onConvertToInvoice) {
      onConvertToInvoice(scenario);
    }
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatCurrency = (value: string): string => {
    return `$${parseFloat(value).toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <Loading message="Loading saved scenarios..." />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {error && (
        <div className={styles.errorContainer}>
          <ErrorMessage message={error} onDismiss={() => setError(null)} />
        </div>
      )}

      {scenarios.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyStateIcon}>💭</div>
          <h3 className={styles.emptyStateTitle}>No Saved Scenarios Yet</h3>
          <p className={styles.emptyStateMessage}>
            Draft scenarios let you explore "what-if" calculations without creating invoices or accounting entries.
            <br />
            Calculate distribution costs and choose "Save as Draft" to create your first scenario.
          </p>
        </div>
      ) : (
        <div className={styles.tableContainer}>
          <div className={styles.tableHeader}>
            <h2 className={styles.tableTitle}>Saved Scenarios ({scenarios.length})</h2>
            <p className={styles.tableDescription}>
              Draft calculations for scenario planning and what-if analysis.
            </p>
          </div>

          <table className={styles.table}>
            <thead>
              <tr>
                <th>Scenario Name</th>
                <th>Distributor</th>
                <th>Pallets</th>
                <th>Total Cost</th>
                <th>Last Modified</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((scenario) => (
                <tr key={scenario.id}>
                  <td className={styles.nameCell}>
                    <div className={styles.scenarioName}>{scenario.calculation_name}</div>
                    {scenario.notes && (
                      <div className={styles.scenarioNotes}>{scenario.notes}</div>
                    )}
                  </td>
                  <td>{getDistributorName(scenario.distributor_id)}</td>
                  <td>{scenario.num_pallets}</td>
                  <td className={styles.costCell}>
                    {formatCurrency(scenario.total_distribution_cost)}
                  </td>
                  <td className={styles.dateCell}>{formatDate(scenario.updated_at)}</td>
                  <td className={styles.actionsCell}>
                    <div className={styles.actions}>
                      <button
                        onClick={() => handleLoad(scenario)}
                        className={styles.actionButton}
                        title="Load into calculator"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => handleConvertToInvoice(scenario)}
                        className={styles.actionButtonSuccess}
                        title="Convert to invoice"
                      >
                        Convert to Invoice
                      </button>
                      <button
                        onClick={() => handleDuplicate(scenario)}
                        className={styles.actionButton}
                        title="Duplicate scenario"
                      >
                        Duplicate
                      </button>
                      <button
                        onClick={() => handleDelete(scenario)}
                        className={styles.actionButtonDanger}
                        disabled={deletingId === scenario.id}
                        title="Delete scenario"
                      >
                        {deletingId === scenario.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && scenarioToDelete && (
        <Modal
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          title=""
          size="sm"
        >
          <div className={styles.confirmModal}>
            <div className={styles.confirmModalHeader}>
              <h2 className={styles.confirmModalTitle}>Delete Scenario?</h2>
            </div>
            <p className={styles.confirmModalMessage}>
              Are you sure you want to delete "{scenarioToDelete.calculation_name}"? This action cannot be undone.
            </p>
            <div className={styles.modalActions}>
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deletingId !== null}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={confirmDelete}
                loading={deletingId !== null}
                disabled={deletingId !== null}
              >
                Delete
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
