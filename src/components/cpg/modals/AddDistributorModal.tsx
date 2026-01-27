/**
 * Add Distributor Modal
 *
 * Allows users to create new distributors with fee structures
 */

import { useState } from 'react';
import { Modal } from '../../modals/Modal';
import { Input } from '../../forms/Input';
import { Button } from '../../core/Button';
import { useAuth } from '../../../contexts/AuthContext';
import { db } from '../../../db/database';
import { createDefaultCPGDistributor, validateCPGDistributor } from '../../../db/schema/cpg.schema';
import { v4 as uuidv4 } from 'uuid';
import styles from './CPGModals.module.css';

export interface AddDistributorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AddDistributorModal({ isOpen, onClose, onSuccess }: AddDistributorModalProps) {
  const { companyId, deviceId } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [fees, setFees] = useState({
    pallet_cost: '',
    warehouse_services: '',
    pallet_build: '',
    floor_space_full_day: '',
    floor_space_half_day: '',
    truck_transfer_zone1: '',
    truck_transfer_zone2: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFeeChange = (field: keyof typeof fees, value: string) => {
    setFees(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!companyId) {
      setErrors({ form: 'Not authenticated' });
      return;
    }

    // Create distributor object
    const distributorData = createDefaultCPGDistributor(
      companyId,
      name,
      deviceId || 'default'
    );

    // Override with user-provided data
    distributorData.description = description || null;
    distributorData.contact_info = contactInfo || null;
    distributorData.fee_structure = {
      pallet_cost: fees.pallet_cost || null,
      warehouse_services: fees.warehouse_services || null,
      pallet_build: fees.pallet_build || null,
      floor_space_full_day: fees.floor_space_full_day || null,
      floor_space_half_day: fees.floor_space_half_day || null,
      truck_transfer_zone1: fees.truck_transfer_zone1 || null,
      truck_transfer_zone2: fees.truck_transfer_zone2 || null,
      custom_fees: null,
    };

    // Validate
    const validationErrors = validateCPGDistributor(distributorData);
    if (validationErrors.length > 0) {
      const errorMap: Record<string, string> = {};
      validationErrors.forEach(err => {
        if (err.includes('name')) errorMap.name = err;
        else errorMap.form = err;
      });
      setErrors(errorMap);
      return;
    }

    // Save to database
    setIsSubmitting(true);
    try {
      await db.cpgDistributors.add({
        ...distributorData,
        id: uuidv4(),
      });

      // Reset form and close
      setName('');
      setDescription('');
      setContactInfo('');
      setFees({
        pallet_cost: '',
        warehouse_services: '',
        pallet_build: '',
        floor_space_full_day: '',
        floor_space_half_day: '',
        truck_transfer_zone1: '',
        truck_transfer_zone2: '',
      });
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Error adding distributor:', error);
      setErrors({ form: 'Failed to save distributor. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    setContactInfo('');
    setFees({
      pallet_cost: '',
      warehouse_services: '',
      pallet_build: '',
      floor_space_full_day: '',
      floor_space_half_day: '',
      truck_transfer_zone1: '',
      truck_transfer_zone2: '',
    });
    setErrors({});
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add New Distributor"
      size="lg"
      closeOnBackdropClick={false}
      footer={
        <div className={styles.modalFooter}>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Adding...' : 'Add Distributor'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className={styles.form}>
        {errors.form && (
          <div className={styles.errorAlert} role="alert">
            {errors.form}
          </div>
        )}

        <Input
          label="Distributor Name"
          placeholder="ex: ABC Logistics"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          required
          fullWidth
          autoFocus
        />

        <Input
          label="Description (Optional)"
          placeholder="ex: Primary distributor for West Coast"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          fullWidth
        />

        <Input
          label="Contact Info (Optional)"
          placeholder="ex: Phone, email, or representative name"
          value={contactInfo}
          onChange={(e) => setContactInfo(e.target.value)}
          fullWidth
        />

        <div className={styles.feeStructure}>
          <div className={styles.sectionHeader}>Fee Structure (Optional)</div>
          <p style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '-0.5rem' }}>
            Enter fees as dollar amounts (ex: 81.00). All fields are optional.
          </p>

          <div className={styles.feeRow}>
            <Input
              label="Pallet Cost"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={fees.pallet_cost}
              onChange={(e) => handleFeeChange('pallet_cost', e.target.value)}
              iconBefore="$"
              fullWidth
            />
            <Input
              label="Warehouse Services"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={fees.warehouse_services}
              onChange={(e) => handleFeeChange('warehouse_services', e.target.value)}
              iconBefore="$"
              fullWidth
            />
          </div>

          <div className={styles.feeRow}>
            <Input
              label="Pallet Build"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={fees.pallet_build}
              onChange={(e) => handleFeeChange('pallet_build', e.target.value)}
              iconBefore="$"
              fullWidth
            />
            <Input
              label="Floor Space (Full Day)"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={fees.floor_space_full_day}
              onChange={(e) => handleFeeChange('floor_space_full_day', e.target.value)}
              iconBefore="$"
              fullWidth
            />
          </div>

          <div className={styles.feeRow}>
            <Input
              label="Floor Space (Half Day)"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={fees.floor_space_half_day}
              onChange={(e) => handleFeeChange('floor_space_half_day', e.target.value)}
              iconBefore="$"
              fullWidth
            />
            <Input
              label="Truck Transfer Zone 1"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={fees.truck_transfer_zone1}
              onChange={(e) => handleFeeChange('truck_transfer_zone1', e.target.value)}
              iconBefore="$"
              fullWidth
            />
          </div>

          <div className={styles.feeRow}>
            <Input
              label="Truck Transfer Zone 2"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={fees.truck_transfer_zone2}
              onChange={(e) => handleFeeChange('truck_transfer_zone2', e.target.value)}
              iconBefore="$"
              fullWidth
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
