/**
 * Labor Assignment Modal
 *
 * Modal for assigning labor roles to a finished product with per-batch or per-unit entry.
 * Includes quick-add flow for creating new roles on-the-fly.
 */

import { useState, useEffect } from 'react';
import { Modal } from '../../modals/Modal';
import { Input } from '../../forms/Input';
import { Button } from '../../core/Button';
import { useAuth } from '../../../contexts/AuthContext';
import { LaborRoleService } from '../../../services/cpg/laborRole.service';
import { db } from '../../../db/database';
import type { CPGLaborRole, CPGProductLabor } from '../../../db/schema/cpg.schema';
import { processMathInput } from '../../../utils/mathParser';
import { useCPGSettings } from '../../../hooks/useCPGSettings';
import styles from './CPGModals.module.css';
import laborStyles from './LaborAssignmentModal.module.css';

export interface LaborAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  productId: string;
  productName: string;
}

export function LaborAssignmentModal({
  isOpen,
  onClose,
  onSuccess,
  productId,
  productName,
}: LaborAssignmentModalProps) {
  const { companyId, deviceId } = useAuth();
  const [service] = useState(() => new LaborRoleService(db));
  const { formatCurrency, formatNumber } = useCPGSettings();

  // Data state
  const [roles, setRoles] = useState<CPGLaborRole[]>([]);
  const [assignments, setAssignments] = useState<CPGProductLabor[]>([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [showAddForm, setShowAddForm] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<CPGProductLabor | null>(null);
  const [deletingAssignmentId, setDeletingAssignmentId] = useState<string | null>(null);

  // Form state
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [entryMode, setEntryMode] = useState<'per_batch' | 'per_unit'>('per_batch');
  const [hoursPerBatch, setHoursPerBatch] = useState('');
  const [batchSize, setBatchSize] = useState('');
  const [hoursPerUnit, setHoursPerUnit] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Quick-add form state
  const [quickAddRoleName, setQuickAddRoleName] = useState('');
  const [quickAddHourlyRate, setQuickAddHourlyRate] = useState('20.00');
  const [quickAddSubmitting, setQuickAddSubmitting] = useState(false);

  // Load data
  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, productId, companyId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [allRoles, productAssignments] = await Promise.all([
        service.getRoles(companyId),
        service.getProductAssignments(productId),
      ]);
      setRoles(allRoles);
      setAssignments(productAssignments);
    } catch (err) {
      console.error('Error loading labor data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAssignment = () => {
    setEditingAssignment(null);
    setSelectedRoleId('');
    setEntryMode('per_batch');
    setHoursPerBatch('');
    setBatchSize('');
    setHoursPerUnit('');
    setNotes('');
    setErrors({});
    setShowAddForm(true);
  };

  const handleEditAssignment = (assignment: CPGProductLabor) => {
    setEditingAssignment(assignment);
    setSelectedRoleId(assignment.labor_role_id);
    setEntryMode(assignment.entry_mode);
    setHoursPerBatch(assignment.hours_per_batch || '');
    setBatchSize(assignment.batch_size || '');
    setHoursPerUnit(assignment.hours_per_unit || '');
    setNotes(assignment.notes || '');
    setErrors({});
    setShowAddForm(true);
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    try {
      setDeletingAssignmentId(assignmentId);
      await service.removeAssignment(assignmentId, deviceId || 'default');
      await loadData();
      onSuccess?.();
    } catch (err: any) {
      console.error('Error deleting assignment:', err);
      setErrors({ form: err.message || 'Failed to delete assignment' });
    } finally {
      setDeletingAssignmentId(null);
    }
  };

  const handleSubmitAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!selectedRoleId) {
      setErrors({ role: 'Please select a labor role' });
      return;
    }

    if (entryMode === 'per_batch') {
      if (!hoursPerBatch || parseFloat(hoursPerBatch) <= 0) {
        setErrors({ hoursPerBatch: 'Hours per batch must be greater than 0' });
        return;
      }
      if (!batchSize || parseFloat(batchSize) <= 0) {
        setErrors({ batchSize: 'Batch size must be greater than 0' });
        return;
      }
    } else {
      if (!hoursPerUnit || parseFloat(hoursPerUnit) <= 0) {
        setErrors({ hoursPerUnit: 'Hours per unit must be greater than 0' });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (editingAssignment) {
        // Update existing assignment
        await service.updateAssignment(
          editingAssignment.id,
          {
            entryMode,
            hoursPerBatch: entryMode === 'per_batch' ? hoursPerBatch : undefined,
            batchSize: entryMode === 'per_batch' ? batchSize : undefined,
            hoursPerUnit: entryMode === 'per_unit' ? hoursPerUnit : undefined,
            notes: notes || null,
          },
          deviceId || 'default'
        );
      } else {
        // Create new assignment
        await service.assignRoleToProduct(
          companyId,
          productId,
          selectedRoleId,
          entryMode,
          {
            hoursPerBatch: entryMode === 'per_batch' ? hoursPerBatch : undefined,
            batchSize: entryMode === 'per_batch' ? batchSize : undefined,
            hoursPerUnit: entryMode === 'per_unit' ? hoursPerUnit : undefined,
          },
          deviceId || 'default',
          {
            notes: notes || undefined,
          }
        );
      }

      await loadData();
      setShowAddForm(false);
      onSuccess?.();
    } catch (err: any) {
      console.error('Error saving assignment:', err);
      setErrors({ form: err.message || 'Failed to save assignment' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickAddRole = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!quickAddRoleName.trim()) {
      return;
    }

    setQuickAddSubmitting(true);
    try {
      const newRole = await service.createRole(
        companyId,
        quickAddRoleName.trim(),
        'hourly',
        { hourlyRate: quickAddHourlyRate },
        deviceId || 'default'
      );

      // Reload roles
      const updatedRoles = await service.getRoles(companyId);
      setRoles(updatedRoles);

      // Select the new role
      setSelectedRoleId(newRole.id);

      // Close quick-add and show main form
      setShowQuickAdd(false);
      setQuickAddRoleName('');
      setQuickAddHourlyRate('20.00');
    } catch (err: any) {
      console.error('Error creating role:', err);
      setErrors({ quickAdd: err.message || 'Failed to create role' });
    } finally {
      setQuickAddSubmitting(false);
    }
  };

  const getRoleById = (roleId: string): CPGLaborRole | undefined => {
    return roles.find((r) => r.id === roleId);
  };

  const formatRate = (role: CPGLaborRole): string => {
    return `${formatCurrency(parseFloat(service.getEffectiveHourlyRate(role)))}/hr`;
  };

  const calculateLaborCost = (assignment: CPGProductLabor): string => {
    const role = getRoleById(assignment.labor_role_id);
    if (!role) return 'N/A';

    const hoursPerUnit = parseFloat(assignment.hours_per_unit || '0');
    const hourlyRate = parseFloat(service.getEffectiveHourlyRate(role));
    const cost = hoursPerUnit * hourlyRate;

    return formatCurrency(cost);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        setShowAddForm(false);
        setShowQuickAdd(false);
        onClose();
      }}
      title={`Labor Assignment - ${productName}`}
      size="lg"
      closeOnBackdropClick={false}
    >
      <div className={laborStyles.container}>
        {/* Disclaimer */}
        <div className={laborStyles.disclaimer}>
          <svg
            className={laborStyles.disclaimerIcon}
            width="18"
            height="18"
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

        {loading ? (
          <div className={laborStyles.loading}>Loading labor assignments...</div>
        ) : (
          <>
            {/* Assignments List */}
            {!showAddForm && !showQuickAdd && (
              <>
                {assignments.length === 0 ? (
                  <div className={laborStyles.emptyState}>
                    <div className={laborStyles.emptyIcon}>👷</div>
                    <h3>No Labor Assigned Yet</h3>
                    <p>Add labor roles to this product to track labor costs per unit.</p>
                  </div>
                ) : (
                  <div className={laborStyles.assignmentsList}>
                    <table className={laborStyles.assignmentsTable}>
                      <thead>
                        <tr>
                          <th>Role</th>
                          <th>Rate</th>
                          <th>Hours/Unit</th>
                          <th>Labor Cost/Unit</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assignments.map((assignment) => {
                          const role = getRoleById(assignment.labor_role_id);
                          if (!role) return null;

                          return (
                            <tr key={assignment.id}>
                              <td>
                                <div className={laborStyles.roleName}>{role.role_name}</div>
                                {assignment.notes && (
                                  <div style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '0.25rem' }}>
                                    {assignment.notes}
                                  </div>
                                )}
                              </td>
                              <td className={laborStyles.rate}>{formatRate(role)}</td>
                              <td className={laborStyles.hours}>
                                {formatNumber(parseFloat(assignment.hours_per_unit || '0'))} hrs
                                {assignment.entry_mode === 'per_batch' && (
                                  <div style={{ fontSize: '0.75rem', color: '#9CA3AF', marginTop: '0.25rem' }}>
                                    ({formatNumber(parseFloat(assignment.hours_per_batch || '0'))}h / {formatNumber(parseFloat(assignment.batch_size || '0'))} units)
                                  </div>
                                )}
                              </td>
                              <td className={laborStyles.laborCost}>{calculateLaborCost(assignment)}</td>
                              <td>
                                <div className={laborStyles.assignmentActions}>
                                  <button
                                    onClick={() => handleEditAssignment(assignment)}
                                    className={laborStyles.editButton}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteAssignment(assignment.id)}
                                    disabled={deletingAssignmentId === assignment.id}
                                    className={laborStyles.deleteButton}
                                  >
                                    {deletingAssignmentId === assignment.id ? '...' : 'Remove'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className={laborStyles.footer}>
                  <Button variant="purple" onClick={handleAddAssignment}>
                    + Assign Labor Role
                  </Button>
                </div>
              </>
            )}

            {/* Add/Edit Assignment Form */}
            {showAddForm && !showQuickAdd && (
              <form onSubmit={handleSubmitAssignment} className={styles.form}>
                {errors.form && (
                  <div className={styles.errorAlert} role="alert">
                    {errors.form}
                  </div>
                )}

                {/* Role Selection */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>Labor Role *</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <select
                      value={selectedRoleId}
                      onChange={(e) => setSelectedRoleId(e.target.value)}
                      disabled={!!editingAssignment}
                      style={{
                        flex: 1,
                        padding: '0.625rem 0.75rem',
                        fontSize: '0.95rem',
                        border: errors.role ? '1px solid #DC2626' : '1px solid #D1D5DB',
                        borderRadius: '6px',
                        backgroundColor: editingAssignment ? '#F3F4F6' : 'white',
                        color: '#1F2937',
                        cursor: editingAssignment ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <option value="">-- Select a role --</option>
                      {roles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.role_name} ({formatRate(role)})
                        </option>
                      ))}
                    </select>
                    {!editingAssignment && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowQuickAdd(true)}
                      >
                        + New Role
                      </Button>
                    )}
                  </div>
                  {errors.role && (
                    <div style={{ color: '#DC2626', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                      {errors.role}
                    </div>
                  )}
                </div>

                {/* Entry Mode Toggle */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>Entry Mode</label>
                  <div className={styles.compensationToggle}>
                    <button
                      type="button"
                      className={`${styles.toggleButton} ${
                        entryMode === 'per_batch' ? styles.toggleActive : ''
                      }`}
                      onClick={() => setEntryMode('per_batch')}
                    >
                      Per Batch (Default)
                    </button>
                    <button
                      type="button"
                      className={`${styles.toggleButton} ${
                        entryMode === 'per_unit' ? styles.toggleActive : ''
                      }`}
                      onClick={() => setEntryMode('per_unit')}
                    >
                      Per Unit
                    </button>
                  </div>
                </div>

                {/* Per-Batch Fields */}
                {entryMode === 'per_batch' && (
                  <div className={styles.rowEqual}>
                    <Input
                      label="Hours per Batch"
                      placeholder="8.00"
                      value={hoursPerBatch}
                      onChange={(e) => setHoursPerBatch(e.target.value)}
                      onBlur={(e) => {
                        const { value } = processMathInput(e.target.value, false);
                        setHoursPerBatch(value);
                      }}
                      error={errors.hoursPerBatch}
                      required
                      fullWidth
                    />
                    <Input
                      label="Batch Size (units)"
                      placeholder="100"
                      value={batchSize}
                      onChange={(e) => setBatchSize(e.target.value)}
                      onBlur={(e) => {
                        const { value } = processMathInput(e.target.value, false);
                        setBatchSize(value);
                      }}
                      error={errors.batchSize}
                      required
                      fullWidth
                    />
                  </div>
                )}

                {/* Per-Unit Fields */}
                {entryMode === 'per_unit' && (
                  <Input
                    label="Hours per Unit"
                    placeholder="0.08"
                    value={hoursPerUnit}
                    onChange={(e) => setHoursPerUnit(e.target.value)}
                    onBlur={(e) => {
                      const { value } = processMathInput(e.target.value, false);
                      setHoursPerUnit(value);
                    }}
                    error={errors.hoursPerUnit}
                    required
                    fullWidth
                  />
                )}

                {/* Notes */}
                <div className={styles.formGroup}>
                  <label htmlFor="notes" className={styles.label}>
                    Notes (Optional)
                  </label>
                  <textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Additional notes about this labor assignment..."
                    rows={2}
                    style={{
                      width: '100%',
                      padding: '0.625rem 0.75rem',
                      fontSize: '0.95rem',
                      border: '1px solid #D1D5DB',
                      borderRadius: '6px',
                      backgroundColor: 'white',
                      color: '#1F2937',
                      fontFamily: 'inherit',
                      resize: 'vertical',
                    }}
                  />
                </div>

                <div className={styles.modalFooter}>
                  <Button variant="outline" onClick={() => setShowAddForm(false)}>
                    Cancel
                  </Button>
                  <Button variant="purple" type="submit" disabled={isSubmitting}>
                    {isSubmitting
                      ? 'Saving...'
                      : editingAssignment
                      ? 'Update Assignment'
                      : 'Add Assignment'}
                  </Button>
                </div>
              </form>
            )}

            {/* Quick-Add Role Form */}
            {showQuickAdd && (
              <form onSubmit={handleQuickAddRole} className={styles.form}>
                <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>Quick Add New Role</h3>

                {errors.quickAdd && (
                  <div className={styles.errorAlert} role="alert">
                    {errors.quickAdd}
                  </div>
                )}

                <Input
                  label="Role Name"
                  placeholder="ex: Production Worker"
                  value={quickAddRoleName}
                  onChange={(e) => setQuickAddRoleName(e.target.value)}
                  required
                  fullWidth
                  autoFocus
                />

                <Input
                  label="Hourly Rate"
                  placeholder="20.00"
                  value={quickAddHourlyRate}
                  onChange={(e) => setQuickAddHourlyRate(e.target.value)}
                  onBlur={(e) => {
                    const { value } = processMathInput(e.target.value, true);
                    setQuickAddHourlyRate(value);
                  }}
                  iconBefore="$"
                  required
                  fullWidth
                />

                <div className={styles.modalFooter}>
                  <Button variant="outline" onClick={() => setShowQuickAdd(false)}>
                    Cancel
                  </Button>
                  <Button variant="gold" type="submit" disabled={quickAddSubmitting}>
                    {quickAddSubmitting ? 'Creating...' : 'Create & Select Role'}
                  </Button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
