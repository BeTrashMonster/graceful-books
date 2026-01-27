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
import { Modal } from '../modals/Modal';
import { Button } from '../core/Button';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../db/database';
import type { CPGDistributor } from '../../db/schema/cpg.schema';
import { AddDistributorModal } from './modals/AddDistributorModal';
import styles from './DistributorManager.module.css';

export interface DistributorManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DistributorManager({ isOpen, onClose }: DistributorManagerProps) {
  const { companyId, deviceId } = useAuth();
  const [distributors, setDistributors] = useState<CPGDistributor[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [editingDistributor, setEditingDistributor] = useState<CPGDistributor | null>(null);
  const [deletingDistributorId, setDeletingDistributorId] = useState<string | null>(null);
  const [showPermanentDeleteConfirm, setShowPermanentDeleteConfirm] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    if (!isOpen || !companyId) return;

    loadDistributors();

    // Listen for changes
    const handleUpdate = () => loadDistributors();
    window.addEventListener('cpg-data-updated', handleUpdate);
    return () => window.removeEventListener('cpg-data-updated', handleUpdate);
  }, [isOpen, companyId, showArchived]);

  const loadDistributors = async () => {
    if (!companyId) return;

    setIsLoading(true);
    try {
      let query = db.cpgDistributors
        .where('company_id')
        .equals(companyId);

      const all = await query.toArray();
      const filtered = all.filter(d => {
        if (showArchived) return true; // Show all when showArchived is true
        return d.active && !d.deleted_at; // Show only active, non-deleted
      });

      setDistributors(filtered);
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

  const activeDistributors = distributors.filter(d => d.active && !d.deleted_at);
  const archivedDistributors = distributors.filter(d => d.deleted_at);

  return (
    <>
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
        <div className={styles.container}>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
              Loading distributors...
            </div>
          ) : (
            <>
              {activeDistributors.length === 0 && archivedDistributors.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  <p>No distributors yet.</p>
                  <Button
                    variant="primary"
                    onClick={() => setShowAddModal(true)}
                    style={{ marginTop: '1rem' }}
                  >
                    Add Your First Distributor
                  </Button>
                </div>
              ) : (
                <>
                  {/* Active distributors */}
                  {activeDistributors.length > 0 && (
                    <div className={styles.section}>
                      <h3 className={styles.sectionTitle}>Active Distributors</h3>
                      <div className={styles.distributorList}>
                        {activeDistributors.map(distributor => (
                          <div key={distributor.id} className={styles.distributorCard}>
                            <div className={styles.distributorHeader}>
                              <div>
                                <h4 className={styles.distributorName}>{distributor.name}</h4>
                                {distributor.description && (
                                  <p className={styles.distributorDescription}>{distributor.description}</p>
                                )}
                                {distributor.contact_info && (
                                  <p className={styles.distributorContact}>{distributor.contact_info}</p>
                                )}
                              </div>
                              <div className={styles.actions}>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleArchive(distributor)}
                                >
                                  Archive
                                </Button>
                              </div>
                            </div>

                            {/* Fee structure preview */}
                            {distributor.fee_structure && (
                              <div className={styles.feePreview}>
                                <strong>Fee Structure:</strong>
                                <div className={styles.feeGrid}>
                                  {distributor.fee_structure.pallet_cost && (
                                    <div>Pallet Cost: ${distributor.fee_structure.pallet_cost}</div>
                                  )}
                                  {distributor.fee_structure.warehouse_services && (
                                    <div>Warehouse: ${distributor.fee_structure.warehouse_services}</div>
                                  )}
                                  {distributor.fee_structure.pallet_build && (
                                    <div>Pallet Build: ${distributor.fee_structure.pallet_build}</div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Archived distributors */}
                  {archivedDistributors.length > 0 && (
                    <div className={styles.section}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 className={styles.sectionTitle}>Archived Distributors</h3>
                        <button
                          onClick={() => setShowArchived(!showArchived)}
                          className={styles.toggleButton}
                        >
                          {showArchived ? 'Hide' : 'Show'} Archived ({archivedDistributors.length})
                        </button>
                      </div>

                      {showArchived && (
                        <div className={styles.distributorList}>
                          {archivedDistributors.map(distributor => (
                            <div key={distributor.id} className={`${styles.distributorCard} ${styles.archived}`}>
                              <div className={styles.distributorHeader}>
                                <div>
                                  <h4 className={styles.distributorName}>
                                    {distributor.name}
                                    <span className={styles.archivedBadge}>Archived</span>
                                  </h4>
                                  {distributor.description && (
                                    <p className={styles.distributorDescription}>{distributor.description}</p>
                                  )}
                                </div>
                                <div className={styles.actions}>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleUnarchive(distributor)}
                                  >
                                    Unarchive
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setDeletingDistributorId(distributor.id);
                                      setShowPermanentDeleteConfirm(true);
                                    }}
                                    style={{ color: '#dc2626', borderColor: '#dc2626' }}
                                  >
                                    Delete
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </Modal>

      {/* Add Distributor Modal */}
      <AddDistributorModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => {
          setShowAddModal(false);
          loadDistributors();
        }}
      />

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
