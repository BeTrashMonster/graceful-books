/**
 * Labor Roles Tab
 *
 * Manages labor roles and compensation for CPG cost tracking.
 *
 * Features:
 * - View all labor roles with compensation details
 * - Create new labor roles (hourly or salary)
 * - Edit existing labor roles
 * - Delete labor roles
 * - Track products assigned to each role
 */

import { useState, useEffect } from 'react';
import { Button } from '../../../../components/core/Button';
import { Loading } from '../../../../components/feedback/Loading';
import { useAuth } from '../../../../contexts/AuthContext';
import { db } from '../../../../db/database';
import { LaborRoleService } from '../../../../services/cpg/laborRole.service';
import { AddLaborRoleModal } from '../../../../components/cpg/modals/AddLaborRoleModal';
import type { CPGLaborRole } from '../../../../db/schema/cpg.schema';
import { useCPGSettings } from '../../../../hooks/useCPGSettings';
import styles from './LaborRolesTab.module.css';

export function LaborRolesTab() {
  const { companyId, deviceId } = useAuth();
  const { formatCurrency } = useCPGSettings();
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
      return `${formatCurrency(parseFloat(role.hourly_rate || '0'))}/hr`;
    } else {
      const amount = parseFloat(role.salary_amount || '0').toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });

      const period = role.salary_period === 'yearly' ? '/year' :
        role.salary_period === 'monthly' ? '/month' :
        role.salary_period === 'biweekly' ? '/2 weeks' :
        role.salary_period === 'weekly' ? '/week' : '';

      const calculatedRate = role.calculated_hourly_rate
        ? formatCurrency(parseFloat(role.calculated_hourly_rate))
        : formatCurrency(0);

      return `${amount}${period} (~${calculatedRate}/hr)`;
    }
  };

  if (loading) {
    return <Loading message="Loading labor roles..." />;
  }

  return (
    <div className={styles.container}>
      <div className={styles.headerActions}>
        <Button variant="purple" onClick={handleAddRole}>
          + Add Labor Role
        </Button>
      </div>

      {error && (
        <div className={styles.error}>
          <p>{error}</p>
        </div>
      )}

      {roles.length === 0 && !error ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyStateIcon}>👷</div>
          <h2>No Labor Roles Yet</h2>
          <p>
            Labor roles help you track and calculate labor costs for your products. Create your
            first role to get started!
          </p>
        </div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Role Name</th>
                <th>Type</th>
                <th>Compensation</th>
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
                      className={
                        role.compensation_type === 'hourly'
                          ? styles.badgeHourly
                          : styles.badgeSalary
                      }
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
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M13.498 1.502a1.503 1.503 0 010 2.125L6.497 10.628l-3.125.375.375-3.125 7.001-7.001a1.503 1.503 0 012.125 0l.625.625z" />
                        <path d="M14.5 13.5v-8h-1v8h-12v-12h8v-1h-8a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1z" />
                      </svg>
                    </button>
                    <button
                      className={styles.deleteButton}
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
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M6.5 1.5a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v1h3a.5.5 0 010 1h-.441l-.443 8.896A1.5 1.5 0 0110.122 14H5.878a1.5 1.5 0 01-1.494-1.604L3.941 3.5H3.5a.5.5 0 010-1h3v-1zM5.894 3.5l.428 8.58a.5.5 0 00.498.42h4.36a.5.5 0 00.498-.42l.428-8.58H5.894z"
                            clipRule="evenodd"
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

      {/* Add/Edit Role Modal */}
      {showAddModal && (
        <AddLaborRoleModal
          isOpen={showAddModal}
          editingRole={editingRole}
          onClose={() => {
            setShowAddModal(false);
            setEditingRole(null);
          }}
          onSuccess={loadRoles}
        />
      )}

      {/* Delete Confirmation */}
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
              <Button
                variant="danger"
                onClick={handleDeleteRole}
                disabled={deletingRoleId !== null}
              >
                {deletingRoleId ? 'Deleting...' : 'Delete Role'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
