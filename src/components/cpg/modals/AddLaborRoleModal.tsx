/**
 * Add/Edit Labor Role Modal
 *
 * Modal for creating new labor roles or editing existing ones.
 * Supports both hourly and salary compensation types with period selection.
 */

import { useState, useEffect, useRef } from 'react';
import { Modal } from '../../modals/Modal';
import { Input } from '../../forms/Input';
import { Button } from '../../core/Button';
import { useAuth } from '../../../contexts/AuthContext';
import { LaborRoleService } from '../../../services/cpg/laborRole.service';
import { db } from '../../../db/database';
import type { CPGLaborRole } from '../../../db/schema/cpg.schema';
import { processMathInput } from '../../../utils/mathParser';
import { useCPGSettings } from '../../../hooks/useCPGSettings';
import styles from './CPGModals.module.css';

export interface AddLaborRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  editingRole?: CPGLaborRole | null;
}

const SALARY_PERIODS = [
  { value: 'yearly', label: 'Yearly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'weekly', label: 'Weekly' },
];

export function AddLaborRoleModal({
  isOpen,
  onClose,
  onSuccess,
  editingRole,
}: AddLaborRoleModalProps) {
  const { companyId, deviceId } = useAuth();
  const [service] = useState(() => new LaborRoleService(db));
  const { _formatCurrency } = useCPGSettings();

  // Form state
  const [roleName, setRoleName] = useState('');
  const [description, setDescription] = useState('');
  const [compensationType, setCompensationType] = useState<'hourly' | 'salary'>('hourly');
  const [hourlyRate, setHourlyRate] = useState('20.00');
  const [salaryAmount, setSalaryAmount] = useState('52000.00');
  const [salaryAmountDisplay, setSalaryAmountDisplay] = useState('52,000.00');
  const [salaryPeriod, setSalaryPeriod] = useState<'yearly' | 'monthly' | 'biweekly' | 'weekly'>('yearly');
  const [notes, setNotes] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const errorAlertRef = useRef<HTMLDivElement>(null);

  // Helper to format number with commas
  const formatWithCommas = (value: string): string => {
    const num = parseFloat(value.replace(/,/g, ''));
    if (isNaN(num)) return value;
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Helper to remove commas from formatted number
  const removeCommas = (value: string): string => {
    return value.replace(/,/g, '');
  };

  // Scroll to error when errors are set
  useEffect(() => {
    if (Object.keys(errors).length > 0 && errorAlertRef.current) {
      errorAlertRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [errors]);

  // Apply purple header styling when modal is open
  useEffect(() => {
    if (!isOpen) return;

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
  }, [isOpen]);

  // Pre-fill form when editing
  useEffect(() => {
    if (editingRole) {
      setRoleName(editingRole.role_name);
      setDescription(editingRole.description || '');
      setCompensationType(editingRole.compensation_type);
      setNotes(editingRole.notes || '');

      if (editingRole.compensation_type === 'hourly') {
        setHourlyRate(editingRole.hourly_rate || '20.00');
      } else {
        const salAmt = editingRole.salary_amount || '52000.00';
        setSalaryAmount(salAmt);
        setSalaryAmountDisplay(formatWithCommas(salAmt));
        setSalaryPeriod(editingRole.salary_period || 'yearly');
      }
    } else {
      // Reset form for new role
      setRoleName('');
      setDescription('');
      setCompensationType('hourly');
      setHourlyRate('20.00');
      setSalaryAmount('52000.00');
      setSalaryAmountDisplay('52,000.00');
      setSalaryPeriod('yearly');
      setNotes('');
    }
    setErrors({});
  }, [editingRole, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!companyId) {
      setErrors({ form: 'Not authenticated' });
      return;
    }

    // Validate role name
    if (!roleName.trim()) {
      setErrors({ roleName: 'Role name is required' });
      return;
    }

    // Validate compensation based on type
    if (compensationType === 'hourly') {
      const rate = parseFloat(hourlyRate);
      if (isNaN(rate) || rate <= 0) {
        setErrors({ hourlyRate: 'Hourly rate must be a positive number' });
        return;
      }
    } else {
      const amount = parseFloat(salaryAmount);
      if (isNaN(amount) || amount <= 0) {
        setErrors({ salaryAmount: 'Salary amount must be a positive number' });
        return;
      }
    }

    // Save to database
    setIsSubmitting(true);
    try {
      if (editingRole) {
        // Update existing role
        await service.updateRole(
          editingRole.id,
          {
            roleName: roleName.trim(),
            description: description.trim() || null,
            compensationType,
            hourlyRate: compensationType === 'hourly' ? hourlyRate : undefined,
            salaryAmount: compensationType === 'salary' ? salaryAmount : undefined,
            salaryPeriod: compensationType === 'salary' ? salaryPeriod : undefined,
            notes: notes.trim() || null,
          },
          deviceId || 'default'
        );
      } else {
        // Create new role
        await service.createRole(
          companyId,
          roleName.trim(),
          compensationType,
          {
            hourlyRate: compensationType === 'hourly' ? hourlyRate : undefined,
            salaryAmount: compensationType === 'salary' ? salaryAmount : undefined,
            salaryPeriod: compensationType === 'salary' ? salaryPeriod : undefined,
          },
          deviceId || 'default',
          {
            description: description.trim() || undefined,
            notes: notes.trim() || undefined,
          }
        );
      }

      // Dispatch update event
      window.dispatchEvent(
        new CustomEvent('cpg-data-updated', { detail: { type: 'labor-role' } })
      );

      // Call onSuccess and close
      onSuccess?.();
      handleClose();
    } catch (error) {
      console.error('Failed to save labor role:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setErrors({ form: `Failed to save labor role: ${errorMessage}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setRoleName('');
    setDescription('');
    setCompensationType('hourly');
    setHourlyRate('20.00');
    setSalaryAmount('52000.00');
    setSalaryAmountDisplay('52,000.00');
    setSalaryPeriod('yearly');
    setNotes('');
    setErrors({});
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={editingRole ? 'Edit Labor Role' : 'Add New Labor Role'}
      size="lg"
      closeOnBackdropClick={false}
      footer={
        <div className={styles.modalFooter}>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="purple" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting
              ? 'Saving...'
              : editingRole
              ? 'Update Role'
              : 'Add Role'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className={styles.form}>
        {errors.form && (
          <div ref={errorAlertRef} className={styles.errorAlert} role="alert">
            {errors.form}
          </div>
        )}

        <Input
          label="Role Name"
          placeholder="ex: Production Worker, Packaging Specialist"
          value={roleName}
          onChange={(e) => setRoleName(e.target.value)}
          error={errors.roleName}
          required
          fullWidth
          autoFocus
        />

        <Input
          label="Description (Optional)"
          placeholder="Brief description of this role"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          fullWidth
        />

        {/* Compensation Type Toggle */}
        <div className={styles.formGroup}>
          <label className={styles.label}>Compensation Type</label>
          <div className={styles.compensationToggle}>
            <button
              type="button"
              className={`${styles.toggleButton} ${
                compensationType === 'hourly' ? styles.toggleActive : ''
              }`}
              onClick={() => setCompensationType('hourly')}
            >
              Hourly
            </button>
            <button
              type="button"
              className={`${styles.toggleButton} ${
                compensationType === 'salary' ? styles.toggleActive : ''
              }`}
              onClick={() => setCompensationType('salary')}
            >
              Salary
            </button>
          </div>
        </div>

        {/* Hourly Rate Fields */}
        {compensationType === 'hourly' && (
          <Input
            label="Hourly Rate"
            placeholder="20.00"
            value={hourlyRate}
            onChange={(e) => setHourlyRate(e.target.value)}
            onBlur={(e) => {
              const { value, calculated } = processMathInput(e.target.value, true);
              if (calculated || e.target.value !== value) {
                setHourlyRate(value);
              }
            }}
            error={errors.hourlyRate}
            iconBefore="$"
            required
            fullWidth
          />
        )}

        {/* Salary Fields */}
        {compensationType === 'salary' && (
          <div className={styles.rowEqual}>
            <Input
              label="Salary Amount"
              placeholder="52,000.00"
              value={salaryAmountDisplay}
              onChange={(e) => {
                const cleanValue = removeCommas(e.target.value);
                setSalaryAmount(cleanValue);
                setSalaryAmountDisplay(e.target.value);
              }}
              onBlur={(e) => {
                const cleanValue = removeCommas(e.target.value);
                const { value, _calculated } = processMathInput(cleanValue, true);
                setSalaryAmount(value);
                setSalaryAmountDisplay(formatWithCommas(value));
              }}
              error={errors.salaryAmount}
              iconBefore="$"
              required
              fullWidth
            />

            <div>
              <label
                htmlFor="salaryPeriod"
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: 500,
                  fontSize: '0.875rem',
                  color: '#374151',
                }}
              >
                Pay Period
              </label>
              <select
                id="salaryPeriod"
                value={salaryPeriod}
                onChange={(e) =>
                  setSalaryPeriod(e.target.value as 'yearly' | 'monthly' | 'biweekly' | 'weekly')
                }
                style={{
                  width: '100%',
                  padding: '0.625rem 0.75rem',
                  fontSize: '0.95rem',
                  border: '1px solid #D1D5DB',
                  borderRadius: '6px',
                  backgroundColor: 'white',
                  color: '#1F2937',
                  cursor: 'pointer',
                }}
              >
                {SALARY_PERIODS.map((period) => (
                  <option key={period.value} value={period.value}>
                    {period.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className={styles.formGroup}>
          <label htmlFor="notes" className={styles.label}>
            Notes (Optional)
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional notes about this role..."
            rows={3}
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
      </form>
    </Modal>
  );
}
