/**
 * Manage Scenarios Tab
 *
 * Data table showing all Impact Share scenarios with management actions.
 *
 * Features:
 * - Table columns: Name | Method | Products | Added CPU | Status | Actions
 * - Filter button to show/hide Inactive scenarios
 * - Actions menu: Edit, Activate/Deactivate, Delete
 * - Status badges (Active/Saved/Inactive)
 * - Empty state when no scenarios exist
 * - Confirmation dialogs for destructive actions
 */

import { useState, useEffect, _useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../../components/core/Button';
import { Loading } from '../../../../components/feedback/Loading';
import { ErrorMessage } from '../../../../components/feedback/ErrorMessage';
import type { CPGImpactScenario } from '../../../../db/schema/cpg.schema';
import { impactShareService } from '../../../../services/cpg/impactShare.service';
import { _db } from '../../../../_db/database';
import { useAuth } from '../../../../contexts/AuthContext';
import styles from './ManageScenariosTab.module.css';

// ============================================================================
// Component
// ============================================================================

export function ManageScenariosTab() {
  const navigate = useNavigate();
  const { companyId, deviceId } = useAuth();

  // ========================================
  // State - Data Loading
  // ========================================
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scenarios, setScenarios] = useState<CPGImpactScenario[]>([]);
  const [averageCPUs, setAverageCPUs] = useState<Record<string, string>>({});

  // ========================================
  // State - Filters
  // ========================================
  const [showInactive, setShowInactive] = useState(false);

  // ========================================
  // State - Actions
  // ========================================
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deactivateConfirmId, setDeactivateConfirmId] = useState<string | null>(null);

  // ========================================
  // Data Loading
  // ========================================

  const loadScenarios = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load all scenarios (including inactive if filter is on)
      const allScenarios = await impactShareService.getAllScenarios(companyId, showInactive);

      setScenarios(allScenarios);

      // Calculate average CPU for each scenario
      const cpuMap: Record<string, string> = {};
      for (const scenario of allScenarios) {
        const avgCPU = await impactShareService.calculateAverageImpactCPU(scenario.id);
        cpuMap[scenario.id] = avgCPU;
      }
      setAverageCPUs(cpuMap);

      setLoading(false);
    } catch (err) {
      console.error('Error loading scenarios:', err);
      setError('Failed to load scenarios. Please refresh and try again.');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (companyId) {
      loadScenarios();
    }
  }, [companyId, showInactive]);

  // ========================================
  // Action Handlers
  // ========================================

  const handleEdit = (scenarioId: string) => {
    navigate(`/cpg/impact-share?tab=builder&edit=${scenarioId}`);
  };

  const handleActivate = async (scenarioId: string) => {
    try {
      setActionLoading(scenarioId);
      setError(null);

      await impactShareService.activateScenario(scenarioId, deviceId);

      // Reload scenarios
      await loadScenarios();

      setActionLoading(null);
    } catch (err) {
      console.error('Error activating scenario:', err);
      setError(`Failed to activate scenario: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setActionLoading(null);
    }
  };

  const handleDeactivate = async (scenarioId: string) => {
    try {
      setActionLoading(scenarioId);
      setError(null);

      await impactShareService.deactivateScenario(scenarioId, deviceId);

      // Reload scenarios
      await loadScenarios();

      setActionLoading(null);
      setDeactivateConfirmId(null);
    } catch (err) {
      console.error('Error deactivating scenario:', err);
      setError(`Failed to deactivate scenario: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setActionLoading(null);
      setDeactivateConfirmId(null);
    }
  };

  const handleDelete = async (scenarioId: string) => {
    try {
      setActionLoading(scenarioId);
      setError(null);

      await impactShareService.deleteScenario(scenarioId);

      // Reload scenarios
      await loadScenarios();

      setActionLoading(null);
      setDeleteConfirmId(null);
    } catch (err) {
      console.error('Error deleting scenario:', err);
      setError(`Failed to delete scenario: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setActionLoading(null);
      setDeleteConfirmId(null);
    }
  };

  // ========================================
  // Helper Functions
  // ========================================

  const formatMethod = (scenario: CPGImpactScenario): string => {
    switch (scenario.method_type) {
      case 'fixed_amount':
        return `$${scenario.amount}/unit`;
      case 'percent_retail':
        return `${scenario.percentage}% of retail`;
      case 'percent_cpu':
        return `${scenario.percentage}% of CPU`;
      case 'percent_profit':
        return `${scenario.percentage}% of profit`;
      default:
        return 'Unknown';
    }
  };

  const getStatusBadgeClass = (status: string): string => {
    switch (status) {
      case 'active':
        return styles.activeBadge;
      case 'saved':
        return styles.savedBadge;
      case 'inactive':
        return styles.inactiveBadge;
      default:
        return styles.savedBadge;
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'active':
        return 'Active';
      case 'saved':
        return 'Saved';
      case 'inactive':
        return 'Inactive';
      default:
        return 'Unknown';
    }
  };

  // ========================================
  // Loading State
  // ========================================

  if (loading) {
    return <Loading message="Loading scenarios..." />;
  }

  // ========================================
  // Empty State
  // ========================================

  if (scenarios.length === 0 && !showInactive) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyStateIcon}>💡</div>
        <h3 className={styles.emptyStateTitle}>No Scenarios Yet</h3>
        <p className={styles.emptyStateMessage}>
          Create your first Impact Share scenario in the Scenario Builder tab to get started.
        </p>
        <Button onClick={() => navigate('/cpg/impact-share?tab=builder')} variant="primary" size="large">
          Create Scenario
        </Button>
      </div>
    );
  }

  // ========================================
  // Render
  // ========================================

  return (
    <div className={styles.container}>
      {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}

      <div className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <h2 className={styles.sectionTitle}>
            {showInactive ? 'All Scenarios' : 'Active & Saved Scenarios'}
          </h2>
          <Button
            onClick={() => setShowInactive(!showInactive)}
            variant="outline"
            size="medium"
          >
            {showInactive ? 'Hide' : 'Show'} Inactive Scenarios
          </Button>
        </div>

        {scenarios.length === 0 && showInactive ? (
          <p className={styles.emptyText}>No inactive scenarios found.</p>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.scenariosTable}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Method</th>
                  <th>Products</th>
                  <th>Added CPU</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {scenarios.map((scenario) => (
                  <tr key={scenario.id}>
                    <td className={styles.nameCell}>{scenario.scenario_name}</td>
                    <td className={styles.methodCell}>{formatMethod(scenario)}</td>
                    <td className={styles.productsCell}>
                      {scenario.selected_product_ids.length} product
                      {scenario.selected_product_ids.length !== 1 ? 's' : ''}
                    </td>
                    <td className={styles.cpuCell}>{averageCPUs[scenario.id] || '—'}</td>
                    <td>
                      <span className={getStatusBadgeClass(scenario.status)}>
                        {getStatusLabel(scenario.status)}
                      </span>
                    </td>
                    <td className={styles.actionsCell}>
                      {actionLoading === scenario.id ? (
                        <span className={styles.actionLoading}>Loading...</span>
                      ) : (
                        <div className={styles.actionButtons}>
                          <button
                            onClick={() => handleEdit(scenario.id)}
                            className={styles.actionButton}
                            title="Edit scenario"
                          >
                            ✏️
                          </button>

                          {scenario.status === 'active' ? (
                            <button
                              onClick={() => setDeactivateConfirmId(scenario.id)}
                              className={styles.actionButton}
                              title="Deactivate scenario"
                            >
                              ⏸️
                            </button>
                          ) : (
                            <button
                              onClick={() => handleActivate(scenario.id)}
                              className={styles.actionButton}
                              title="Activate scenario"
                            >
                              ✅
                            </button>
                          )}

                          <button
                            onClick={() => setDeleteConfirmId(scenario.id)}
                            className={styles.actionButtonDanger}
                            title="Delete scenario"
                          >
                            🗑️
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className={styles.modalOverlay} onClick={() => setDeleteConfirmId(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Delete Scenario</h3>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.modalMessage}>
                Are you sure you want to delete this scenario? This action cannot be undone.
              </p>
            </div>
            <div className={styles.modalFooter}>
              <Button onClick={() => setDeleteConfirmId(null)} variant="outline" size="medium">
                Cancel
              </Button>
              <Button
                onClick={() => handleDelete(deleteConfirmId)}
                variant="danger"
                size="medium"
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate Confirmation Modal */}
      {deactivateConfirmId && (
        <div className={styles.modalOverlay} onClick={() => setDeactivateConfirmId(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Deactivate Scenario</h3>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.modalMessage}>
                This will remove Impact Share from all calculations. Continue?
              </p>
            </div>
            <div className={styles.modalFooter}>
              <Button onClick={() => setDeactivateConfirmId(null)} variant="outline" size="medium">
                Cancel
              </Button>
              <Button
                onClick={() => handleDeactivate(deactivateConfirmId)}
                variant="primary"
                size="medium"
              >
                Deactivate
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
