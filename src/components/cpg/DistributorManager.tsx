/**
 * Distributor Manager Component
 *
 * Manage CPG distributors and their fee structures.
 *
 * Features:
 * - View all distributors
 * - Edit distributor details
 * - Archive/unarchive distributors
 * - Delete distributors with confirmation
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Modal } from '../modals/Modal';
import { Button } from '../core/Button';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../db/database';
import type { CPGDistributor, CPGDistributionCalculation } from '../../db/schema/cpg.schema';
import { DistributionCostCalculatorService } from '../../services/cpg/distributionCostCalculator.service';
import { DistributorProfileForm, type DistributorFormData } from './DistributorProfileForm';
import styles from './DistributorManager.module.css';

export interface DistributorManagerProps {
  isOpen: boolean;
  onClose: () => void;
  embedded?: boolean; // If true, render without Modal wrapper
}

export function DistributorManager({ isOpen, onClose, embedded = false }: DistributorManagerProps) {
  const { companyId: authCompanyId, deviceId: authDeviceId } = useAuth();

  // Use auth values with fallbacks for development
  const companyId = authCompanyId || 'cpg-demo';
  const deviceId = authDeviceId || 'device-1';

  const [distributors, setDistributors] = useState<CPGDistributor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingDistributor, setEditingDistributor] = useState<CPGDistributor | null>(null);
  const [deletingDistributorId, setDeletingDistributorId] = useState<string | null>(null);
  const [showPermanentDeleteConfirm, setShowPermanentDeleteConfirm] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [affectedCalculations, setAffectedCalculations] = useState<CPGDistributionCalculation[]>([]);
  const [showRecalculateConfirm, setShowRecalculateConfirm] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<{
    distributorId: string;
    formData: DistributorFormData;
    oldFees: CPGDistributor['fee_structure'];
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'recent' | 'archived'>('name');
  const [archiveMessage, setArchiveMessage] = useState<string | null>(null);
  const [calculationData, setCalculationData] = useState<Record<string, { avgCostPerUnit: string; calcCount: number; latestCalcDate: number }>>({});
  const navigate = useNavigate();

  /**
   * Load calculation data for all distributors
   * Shows average distribution cost per unit from saved calculations
   */
  const loadCalculationData = async () => {
    if (!companyId) return;

    try {
      const calculations = await db.cpgDistributionCalculations
        .where('company_id')
        .equals(companyId)
        .toArray();

      // Group by distributor and calculate averages
      const dataByDistributor: Record<string, { total: number; count: number }> = {};

      calculations.forEach(calc => {
        if (!calc.distributor_id || !calc.distribution_cost_per_unit) {
          return;
        }

        if (!dataByDistributor[calc.distributor_id]) {
          dataByDistributor[calc.distributor_id] = { total: 0, count: 0 };
        }

        const costPerUnit = parseFloat(calc.distribution_cost_per_unit);

        if (!isNaN(costPerUnit)) {
          dataByDistributor[calc.distributor_id].total += costPerUnit;
          dataByDistributor[calc.distributor_id].count += 1;
        }
      });

      // Calculate averages and track latest calculation date
      const avgData: Record<string, { avgCostPerUnit: string; calcCount: number; latestCalcDate: number }> = {};

      // Group calculations by distributor and find latest date
      const latestDateByDistributor: Record<string, number> = {};
      calculations.forEach(calc => {
        if (!calc.distributor_id || !calc.calculation_date) return;

        const currentLatest = latestDateByDistributor[calc.distributor_id] || 0;
        latestDateByDistributor[calc.distributor_id] = Math.max(currentLatest, calc.calculation_date);
      });

      Object.entries(dataByDistributor).forEach(([distributorId, { total, count }]) => {
        if (count > 0) {
          avgData[distributorId] = {
            avgCostPerUnit: (total / count).toFixed(2),
            calcCount: count,
            latestCalcDate: latestDateByDistributor[distributorId] || 0,
          };
        }
      });

      setCalculationData(avgData);
    } catch (error) {
      console.error('Error loading calculation data:', error);
    }
  };

  /**
   * Generate smart cost information from actual calculation data
   */
  const getSmartCostInfo = (distributorId: string, distributorName: string): string => {
    const data = calculationData[distributorId];

    if (data) {
      // Blended format: Lead with cost, concise calc count
      if (data.calcCount === 1) {
        return `$${data.avgCostPerUnit}/unit`;
      } else {
        return `$${data.avgCostPerUnit}/unit (${data.calcCount} calcs)`;
      }
    } else {
      // No calculations yet
      return 'Run calculation to see distribution cost per unit';
    }
  };

  /**
   * Check if a distributor needs recalculation
   * Compares distributor's last update time with latest calculation date
   */
  const needsRecalculation = (distributor: CPGDistributor): boolean => {
    const data = calculationData[distributor.id];

    if (!data) {
      // No calculations yet - doesn't need "recalculation", needs initial calculation
      return false;
    }

    // If distributor was updated after the latest calculation, it needs recalculation
    return distributor.updated_at > data.latestCalcDate;
  };

  useEffect(() => {
    if ((!isOpen && !embedded) || !companyId) return;

    loadDistributors();
    loadCalculationData();

    // Listen for changes
    const handleUpdate = () => {
      loadDistributors();
      loadCalculationData();
    };
    window.addEventListener('cpg-data-updated', handleUpdate);
    return () => window.removeEventListener('cpg-data-updated', handleUpdate);
  }, [isOpen, embedded, companyId]);

  const loadDistributors = async () => {
    if (!companyId) return;

    setIsLoading(true);
    try {
      const all = await db.cpgDistributors
        .where('company_id')
        .equals(companyId)
        .toArray();

      setDistributors(all); // Load all distributors, filter happens in render based on sortBy
    } catch (error) {
      console.error('Error loading distributors:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleArchive = async (distributor: CPGDistributor) => {
    if (!companyId || !deviceId) return;

    try {
      await db.cpgDistributors.update(distributor.id, {
        deleted_at: Date.now(),
        updated_at: Date.now(),
        version_vector: {
          ...distributor.version_vector,
          [deviceId]: (distributor.version_vector[deviceId] || 0) + 1,
        },
      });

      // Show success message
      setArchiveMessage(`"${distributor.name}" archived! Switch to "Archived Distributors" in the dropdown to restore it.`);
      setTimeout(() => setArchiveMessage(null), 20000); // Auto-hide after 20 seconds

      window.dispatchEvent(new CustomEvent('cpg-data-updated', { detail: { type: 'distributor' } }));
      loadDistributors();
    } catch (error) {
      console.error('Error archiving distributor:', error);
    }
  };

  const handleUnarchive = async (distributor: CPGDistributor) => {
    if (!companyId || !deviceId) return;

    try {
      await db.cpgDistributors.update(distributor.id, {
        deleted_at: null,
        updated_at: Date.now(),
        version_vector: {
          ...distributor.version_vector,
          [deviceId]: (distributor.version_vector[deviceId] || 0) + 1,
        },
      });

      window.dispatchEvent(new CustomEvent('cpg-data-updated', { detail: { type: 'distributor' } }));
      loadDistributors();
    } catch (error) {
      console.error('Error unarchiving distributor:', error);
    }
  };

  const handlePermanentDelete = async () => {
    if (!deletingDistributorId) return;

    try {
      await db.cpgDistributors.delete(deletingDistributorId);
      window.dispatchEvent(new CustomEvent('cpg-data-updated', { detail: { type: 'distributor' } }));
      setDeletingDistributorId(null);
      setShowPermanentDeleteConfirm(false);
      loadDistributors();
    } catch (error) {
      console.error('Error deleting distributor:', error);
    }
  };

  const handleCreateSubmit = async (formData: DistributorFormData) => {
    if (!companyId || !deviceId) return;

    setIsSaving(true);
    try {
      const distributor = await calculatorService.createDistributor(
        companyId,
        formData.name,
        formData.description,
        formData.contact_info,
        formData.fee_structure,
        deviceId,
        formData.last_fee_update_date,
        formData.typical_update_frequency
      );

      window.dispatchEvent(new CustomEvent('cpg-data-updated', { detail: { type: 'distributor' } }));
      setShowAddModal(false);
      loadDistributors();
    } catch (error) {
      console.error('Error creating distributor:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditSubmit = async (formData: DistributorFormData) => {
    if (!editingDistributor || !companyId || !deviceId) return;

    // Check if fees changed
    const feesChanged = JSON.stringify(editingDistributor.fee_structure) !== JSON.stringify(formData.fee_structure);

    if (feesChanged) {
      // Find affected calculations
      const calculations = await db.cpgDistributionCalculations
        .where('distributor_id')
        .equals(editingDistributor.id)
        .toArray();

      if (calculations.length > 0) {
        // Store pending update and show confirmation
        setPendingUpdate({
          distributorId: editingDistributor.id,
          formData,
          oldFees: editingDistributor.fee_structure,
        });
        setAffectedCalculations(calculations);
        setShowRecalculateConfirm(true);
        return;
      } else {
        // Fees changed but no calculations - still mark for update prompt
        await saveDistributorUpdate(editingDistributor.id, formData, true);
        return;
      }
    }

    // Fees didn't change - just save
    await saveDistributorUpdate(editingDistributor.id, formData, false);
  };

  const saveDistributorUpdate = async (distributorId: string, formData: DistributorFormData, feesChanged = false) => {
    if (!deviceId) return;

    setIsSaving(true);
    try {
      const distributor = await db.cpgDistributors.get(distributorId);
      if (!distributor) throw new Error('Distributor not found');

      // Update distributor - historical calculations remain unchanged
      await db.cpgDistributors.update(distributorId, {
        name: formData.name,
        description: formData.description,
        contact_info: formData.contact_info,
        fee_structure: formData.fee_structure,
        last_fee_update_date: formData.last_fee_update_date,
        typical_update_frequency: formData.typical_update_frequency,
        updated_at: Date.now(),
        version_vector: {
          ...distributor.version_vector,
          [deviceId]: (distributor.version_vector[deviceId] || 0) + 1,
        },
      });

      window.dispatchEvent(new CustomEvent('cpg-data-updated', { detail: { type: 'distributor' } }));
      setEditingDistributor(null);
      setPendingUpdate(null);
      setShowRecalculateConfirm(false);
      setAffectedCalculations([]);
      loadDistributors();
    } catch (error) {
      console.error('Error saving distributor:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRecalculateConfirm = async () => {
    if (!pendingUpdate) return;
    // Pass true to clear calculation data since fees changed
    await saveDistributorUpdate(pendingUpdate.distributorId, pendingUpdate.formData, true);
  };

  // Filter based on view mode (active vs archived)
  const isShowingArchived = sortBy === 'archived';
  const baseDistributors = isShowingArchived
    ? distributors.filter(d => d.deleted_at)
    : distributors.filter(d => d.active && !d.deleted_at);

  // Apply search filter
  const filteredDistributors = baseDistributors.filter(d =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d.description && d.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (d.contact_info && d.contact_info.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Apply sorting
  const sortedDistributors = [...filteredDistributors].sort((a, b) => {
    if (sortBy === 'recent') {
      return b.updated_at - a.updated_at;
    } else {
      // Default to alphabetical for both 'name' and 'archived'
      return a.name.localeCompare(b.name);
    }
  });

  // Main content to be rendered either in modal or embedded
  const managerContent = (
    <div className={embedded ? styles.embeddedContainer : styles.container}>
          {isLoading ? (
            <div className={styles.loadingState}>
              <div className={styles.loadingSpinner}>⏳</div>
              <p>Loading distributors...</p>
            </div>
          ) : (
            <>
              {distributors.length === 0 ? (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>📦</div>
                  <h3>No distributors yet</h3>
                  <p>Get started by adding your first distributor</p>
                  <Button
                    variant="primary"
                    onClick={() => setShowAddModal(true)}
                    style={{ marginTop: '1rem' }}
                  >
                    + Add Your First Distributor
                  </Button>
                </div>
              ) : (
                <>
                  {/* Search and Sort Controls */}
                  <div className={styles.controls}>
                    <div className={styles.searchWrapper}>
                      <span className={styles.searchIcon}>🔍</span>
                      <input
                        type="text"
                        placeholder="Search distributors..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className={styles.searchInput}
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className={styles.clearSearch}
                          aria-label="Clear search"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as 'name' | 'recent' | 'archived')}
                      className={styles.sortSelect}
                    >
                      <option value="name">Sort A-Z</option>
                      <option value="recent">Recently Updated</option>
                      <option value="archived">Archived Distributors</option>
                    </select>
                  </div>

                  {/* Archive Success Message */}
                  {archiveMessage && (
                    <div className={styles.successMessage}>
                      <span className={styles.successIcon}>✓</span>
                      <span>{archiveMessage}</span>
                      <button
                        onClick={() => setArchiveMessage(null)}
                        className={styles.dismissButton}
                        aria-label="Dismiss"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {/* Active Distributors Grid */}
                  {sortedDistributors.length > 0 ? (
                    <div className={styles.distributorGrid}>
                      {sortedDistributors.map(distributor => (
                        <div key={distributor.id} className={styles.distributorCard}>
                          <div className={styles.cardHeader}>
                            <h4 className={styles.distributorName}>
                              {distributor.name}
                              {isShowingArchived && (
                                <span className={styles.archivedBadge}>Archived</span>
                              )}
                            </h4>
                            {!isShowingArchived && (
                              <button
                                onClick={() => setEditingDistributor(distributor)}
                                className={styles.iconButton}
                                aria-label="Edit distributor"
                                title="Edit"
                              >
                                ✏️
                              </button>
                            )}
                          </div>

                          {distributor.description && (
                            <p className={styles.distributorDescription}>{distributor.description}</p>
                          )}

                          {distributor.contact_info && (
                            <div className={styles.contactInfo}>
                              <span className={styles.contactIcon}>📞</span>
                              <span>{distributor.contact_info}</span>
                            </div>
                          )}

                          {/* Smart Cost Info - Calculated Data */}
                          <div className={styles.costSummary}>
                            <span className={styles.costIcon}>💰</span>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
                              {calculationData[distributor.id] && (
                                <span className={styles.costText}>{getSmartCostInfo(distributor.id, distributor.name)}</span>
                              )}
                              {!calculationData[distributor.id] && (
                                <button
                                  onClick={() => {
                                    console.log('🔗 Attempting navigation to:', `/cpg/distribution-cost?tab=calculations&distributor=${distributor.id}`);
                                    window.location.href = `/cpg/distribution-cost?tab=calculations&distributor=${distributor.id}`;
                                  }}
                                  className={styles.costLink}
                                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
                                >
                                  Calculate cost per unit →
                                </button>
                              )}
                              {calculationData[distributor.id] && needsRecalculation(distributor) && (
                                <button
                                  onClick={() => {
                                    console.log('🔗 Attempting navigation to (update):', `/cpg/distribution-cost?tab=calculations&distributor=${distributor.id}`);
                                    window.location.href = `/cpg/distribution-cost?tab=calculations&distributor=${distributor.id}`;
                                  }}
                                  className={styles.updateLink}
                                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
                                >
                                  Run updated fees →
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Archive/Unarchive Action with Analytics Link */}
                          {isShowingArchived ? (
                            <button
                              onClick={() => handleUnarchive(distributor)}
                              className={styles.unarchiveButton}
                            >
                              Unarchive
                            </button>
                          ) : (
                            <div className={styles.archiveTextWrapper}>
                              <Link
                                to={`/cpg/analytics?tab=distributor&distributor=${distributor.id}`}
                                className={styles.analyticsLink}
                              >
                                View Analytics →
                              </Link>
                              <button
                                onClick={() => handleArchive(distributor)}
                                className={styles.archiveTextButton}
                              >
                                Archive
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.noResults}>
                      <p>No distributors match "{searchQuery}"</p>
                      <button
                        onClick={() => setSearchQuery('')}
                        className={styles.clearSearchButton}
                      >
                        Clear search
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
  );

  return (
    <>
      {embedded ? (
        <>
          {/* Embedded mode - render content directly */}
          <div className={styles.embeddedHeader}>
            <h2 className={styles.embeddedTitle}>Manage Distributors</h2>
            <Button variant="primary" onClick={() => setShowAddModal(true)}>
              + Add Distributor
            </Button>
          </div>
          {managerContent}
        </>
      ) : (
        <Modal
          isOpen={isOpen}
          onClose={onClose}
          title="Manage Distributors"
          size="lg"
          footer={
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'space-between', width: '100%' }}>
              <Button variant="outline" onClick={() => setShowAddModal(true)}>
                + Add Distributor
              </Button>
              <Button variant="primary" onClick={onClose}>
                Done
              </Button>
            </div>
          }
        >
          {managerContent}
        </Modal>
      )}

      {/* Add Distributor Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add New Distributor"
        size="xl"
        closeOnBackdropClick={false}
      >
        <DistributorProfileForm
          onSubmit={handleCreateSubmit}
          onCancel={() => setShowAddModal(false)}
          loading={isSaving}
        />
      </Modal>

      {/* Edit Distributor Modal */}
      <Modal
        isOpen={!!editingDistributor}
        onClose={() => setEditingDistributor(null)}
        title="Edit Distributor"
        size="xl"
        closeOnBackdropClick={false}
      >
        {editingDistributor && (
          <DistributorProfileForm
            distributor={editingDistributor}
            onSubmit={handleEditSubmit}
            onCancel={() => setEditingDistributor(null)}
            loading={isSaving}
          />
        )}
      </Modal>

      {/* Recalculation Confirmation Modal */}
      <Modal
        isOpen={showRecalculateConfirm}
        onClose={() => {
          setShowRecalculateConfirm(false);
          setPendingUpdate(null);
          setAffectedCalculations([]);
        }}
        title="Fee Structure Updated"
        size="md"
        closeOnBackdropClick={false}
        footer={
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', width: '100%' }}>
            <Button
              variant="outline"
              onClick={() => {
                setShowRecalculateConfirm(false);
                setPendingUpdate(null);
                setAffectedCalculations([]);
              }}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => handleRecalculateConfirm()}
              loading={isSaving}
              disabled={isSaving}
            >
              Save Changes
            </Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{
            padding: '1rem',
            backgroundColor: '#dbeafe',
            border: '1px solid #60a5fa',
            borderRadius: '8px',
          }}>
            <strong style={{ color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>ℹ️</span>
              <span>Fee Changes Detected</span>
            </strong>
            <p style={{ margin: '0.5rem 0 0', color: '#1e40af', fontSize: '0.875rem' }}>
              You have {affectedCalculations.length} existing calculation{affectedCalculations.length !== 1 ? 's' : ''} using the old fees. These will remain unchanged to preserve historical data.
            </p>
          </div>

          {pendingUpdate && (
            <div>
              <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>
                Fee Changes:
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem' }}>
                {(() => {
                  const oldFees = pendingUpdate.oldFees;
                  const newFees = pendingUpdate.formData.fee_structure;
                  const changes: JSX.Element[] = [];

                  // Find removed fees
                  oldFees.forEach((oldFee) => {
                    const stillExists = newFees.some(f => f.description === oldFee.description);
                    if (!stillExists) {
                      changes.push(
                        <div key={`removed-${oldFee.id}`} style={{
                          padding: '0.5rem',
                          backgroundColor: '#fee2e2',
                          borderRadius: '4px',
                          border: '1px solid #fecaca'
                        }}>
                          <span style={{ fontWeight: 500, color: '#991b1b' }}>
                            Removed: {oldFee.description} (${oldFee.amount})
                          </span>
                        </div>
                      );
                    }
                  });

                  // Find added or changed fees
                  newFees.forEach((newFee) => {
                    const oldFee = oldFees.find(f => f.description === newFee.description);

                    if (!oldFee) {
                      // New fee added
                      changes.push(
                        <div key={`added-${newFee.id}`} style={{
                          padding: '0.5rem',
                          backgroundColor: '#d1fae5',
                          borderRadius: '4px',
                          border: '1px solid #a7f3d0'
                        }}>
                          <span style={{ fontWeight: 500, color: '#065f46' }}>
                            Added: {newFee.description} (${newFee.amount})
                          </span>
                        </div>
                      );
                    } else if (oldFee.amount !== newFee.amount || oldFee.unit !== newFee.unit) {
                      // Fee changed
                      changes.push(
                        <div key={`changed-${newFee.id}`} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '0.5rem',
                          backgroundColor: '#fef3c7',
                          borderRadius: '4px',
                          border: '1px solid #fcd34d'
                        }}>
                          <span style={{ fontWeight: 500, color: '#92400e' }}>
                            {newFee.description}:
                          </span>
                          <span style={{ color: '#92400e' }}>
                            ${oldFee.amount} → ${newFee.amount}
                          </span>
                        </div>
                      );
                    }
                  });

                  return changes.length > 0 ? changes : (
                    <p style={{ color: '#6b7280', fontStyle: 'italic' }}>No fee changes detected</p>
                  );
                })()}
              </div>
            </div>
          )}

          <div>
            <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>
              Affected Scenarios:
            </h4>
            <div style={{
              maxHeight: '150px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem'
            }}>
              {affectedCalculations.map((calc) => (
                <div key={calc.id} style={{
                  padding: '0.5rem 0.75rem',
                  backgroundColor: '#f3f4f6',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  color: '#374151'
                }}>
                  {calc.calculation_name || `Calculation from ${new Date(calc.calculation_date).toLocaleDateString()}`}
                </div>
              ))}
            </div>
          </div>

          <div style={{
            padding: '1rem',
            backgroundColor: '#f0fdf4',
            border: '1px solid #86efac',
            borderRadius: '8px',
          }}>
            <strong style={{ color: '#166534', fontSize: '0.875rem' }}>💡 Next Step</strong>
            <p style={{ margin: '0.5rem 0 0', color: '#166534', fontSize: '0.875rem', lineHeight: '1.5' }}>
              After saving, run a new calculation with these updated fees to see how they affect your costs.
            </p>
          </div>
        </div>
      </Modal>

      {/* Permanent Delete Confirmation */}
      <Modal
        isOpen={showPermanentDeleteConfirm}
        onClose={() => {
          setShowPermanentDeleteConfirm(false);
          setDeletingDistributorId(null);
        }}
        title="Permanently Delete Distributor?"
        size="sm"
        footer={
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', width: '100%' }}>
            <Button
              variant="outline"
              onClick={() => {
                setShowPermanentDeleteConfirm(false);
                setDeletingDistributorId(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handlePermanentDelete}
              style={{ backgroundColor: '#dc2626' }}
            >
              Permanently Delete
            </Button>
          </div>
        }
      >
        <p style={{ marginBottom: '1rem', color: '#64748b' }}>
          Are you sure you want to permanently delete this distributor? This action cannot be undone.
        </p>
        <div style={{
          padding: '1rem',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          color: '#dc2626',
          fontSize: '0.875rem'
        }}>
          <strong>Warning:</strong> This will permanently remove all distributor data and cannot be recovered.
        </div>
      </Modal>
    </>
  );
}
