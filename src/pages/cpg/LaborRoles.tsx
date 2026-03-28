/**
 * Labor + Roles Page
 *
 * Manages labor roles and compensation for CPG cost tracking.
 *
 * Features:
 * - View all labor roles with compensation details
 * - Create new labor roles (hourly or salary)
 * - Edit existing labor roles
 * - Delete labor roles
 * - Track products assigned to each role
 *
 * Requirements:
 * - Labor + Roles Roadmap Phase 1
 */

import { useState, useEffect } from 'react';
import { Button } from '../../components/core/Button';
import { Loading } from '../../components/feedback/Loading';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../db/database';
import { LaborRoleService } from '../../services/cpg/laborRole.service';
import { AddLaborRoleModal } from '../../components/cpg/modals/AddLaborRoleModal';
import type { CPGLaborRole } from '../../db/schema/cpg.schema';
import styles from './LaborRoles.module.css';

export default function LaborRoles() {
  const { companyId, deviceId } = useAuth();
  const [roles, setRoles] = useState<CPGLaborRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [service] = useState(() => new LaborRoleService(db));

  // UI State
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRole, setEditingRole] = useState<CPGLaborRole | null>(null);
  const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null);
  const [confirmDeleteRole, setConfirmDeleteRole] = useState<CPGLaborRole | null>(null);

  // Load roles
  useEffect(() => {
    loadRoles();
  }, [companyId]);

  // Listen for data updates
  useEffect(() => {
    const handleDataUpdate = (event: CustomEvent) => {
      if (event.detail?.type === 'labor-role') {
        loadRoles();
      }
    };

    window.addEventListener('cpg-data-updated', handleDataUpdate as EventListener);
    return () => window.removeEventListener('cpg-data-updated', handleDataUpdate as EventListener);
  }, [companyId]);

  const loadRoles = async () => {
    try {
      setLoading(true);
      setError(null);

      const allRoles = await service.getRoles(companyId);
      setRoles(allRoles);
    } catch (err) {
      console.error('Error loading labor roles:', err);
      setError('Failed to load labor roles. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddRole = () => {
    setEditingRole(null);
    setShowAddModal(true);
  };

  const handleEditRole = (role: CPGLaborRole) => {
    setEditingRole(role);
    setShowAddModal(true);
  };

  const handleDeleteRole = async () => {
    if (!confirmDeleteRole) return;

    try {
      setDeletingRoleId(confirmDeleteRole.id);
      await service.deleteRole(confirmDeleteRole.id, deviceId);
      await loadRoles();
      setConfirmDeleteRole(null);
    } catch (err: any) {
      console.error('Error deleting labor role:', err);
      setError(err.message || 'Failed to delete labor role. Please try again.');
      setConfirmDeleteRole(null);
    } finally {
      setDeletingRoleId(null);
    }
  };

  const formatCompensation = (role: CPGLaborRole): string => {
    if (role.compensation_type === 'hourly') {
      return `$${parseFloat(role.hourly_rate || '0').toFixed(2)}/hr`;
    } else {
      const amount = parseFloat(role.salary_amount || '0').toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
      });
      let period = '';
      switch (role.salary_period) {
        case 'yearly':
          period = '/year';
          break;
        case 'monthly':
          period = '/month';
          break;
        case 'biweekly':
          period = '/biweekly';
          break;
        case 'weekly':
          period = '/week';
          break;
      }
      const calculatedRate = parseFloat(role.calculated_hourly_rate || '0').toFixed(2);
      return `${amount}${period} (~$${calculatedRate}/hr)`;
    }
  };

  if (loading) {
    return <Loading message="Loading labor roles..." />;
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Labor + Roles</h1>
        <Button variant="purple" onClick={handleAddRole}>
          + Add Labor Role
        </Button>
      </header>

      {/* Disclaimer */}
      <div className={styles.disclaimer}>
        <svg
          className={styles.disclaimerIcon}
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10 6v5M10 14v.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <p>
          Labor does not include employer taxes, insurance, or other applicable fees. Consult with
          your accountant for total employment costs.
        </p>
      </div>

      {error && (
        <div className={styles.error}>
          <p>{error}</p>
        </div>
      )}

      {/* Labor Roles Table */}
      {roles.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyStateIcon}>👷</div>
          <h2>No Labor Roles Yet</h2>
          <p>
            Create your first labor role to start tracking how employee time affects your cost per
            unit.
          </p>
          <Button variant="purple" onClick={handleAddRole}>
            + Add Your First Labor Role
          </Button>
        </div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Role Name</th>
                <th>Compensation Type</th>
                <th>Rate / Salary</th>
                <th>Description</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role.id}>
                  <td className={styles.roleName}>{role.role_name}</td>
                  <td>
                    <span
                      className={`${styles.badge} ${
                        role.compensation_type === 'hourly' ? styles.badgeHourly : styles.badgeSalary
                      }`}
                    >
                      {role.compensation_type === 'hourly' ? 'Hourly' : 'Salary'}
                    </span>
                  </td>
                  <td className={styles.compensation}>{formatCompensation(role)}</td>
                  <td className={styles.description}>
                    {role.description || <span className={styles.noDescription}>—</span>}
                  </td>
                  <td className={styles.actions}>
                    <button
                      className={styles.actionButton}
                      onClick={() => handleEditRole(role)}
                      title="Edit role"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M11.333 2A1.886 1.886 0 0 1 14 4.667l-9 9-3.667.666.667-3.666 9-9z"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    <button
                      className={`${styles.actionButton} ${styles.deleteButton}`}
                      onClick={() => setConfirmDeleteRole(role)}
                      disabled={deletingRoleId === role.id}
                      title="Delete role"
                    >
                      {deletingRoleId === role.id ? (
                        <span className={styles.spinner} />
                      ) : (
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M2 4h12M5.333 4V2.667a1.333 1.333 0 0 1 1.334-1.334h2.666a1.333 1.333 0 0 1 1.334 1.334V4m2 0v9.333a1.333 1.333 0 0 1-1.334 1.334H4.667a1.333 1.333 0 0 1-1.334-1.334V4h9.334z"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      <AddLaborRoleModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={loadRoles}
        editingRole={editingRole}
      />

      {/* Delete Confirmation Dialog */}
      {confirmDeleteRole && (
        <div className={styles.confirmOverlay} onClick={() => setConfirmDeleteRole(null)}>
          <div className={styles.confirmDialog} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.confirmTitle}>Delete Labor Role?</h3>
            <p className={styles.confirmMessage}>
              Are you sure you want to delete <strong>{confirmDeleteRole.role_name}</strong>? This
              action cannot be undone.
            </p>
            <div className={styles.confirmActions}>
              <Button variant="outline" onClick={() => setConfirmDeleteRole(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDeleteRole}>
                Delete Role
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
