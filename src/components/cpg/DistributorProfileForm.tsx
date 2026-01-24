import { useState } from 'react';
import { Input } from '../forms/Input';
import { Button } from '../core/Button';
import { Card, CardHeader, CardBody, CardFooter } from '../ui/Card';
import type { CPGDistributor } from '../../db/schema/cpg.schema';
import styles from './DistributorProfileForm.module.css';

export interface DistributorProfileFormProps {
  /**
   * Existing distributor to edit (null for new)
   */
  distributor?: CPGDistributor | null;
  /**
   * Callback when form is submitted
   */
  onSubmit: (data: DistributorFormData) => void;
  /**
   * Callback when form is cancelled
   */
  onCancel: () => void;
  /**
   * Loading state
   */
  loading?: boolean;
}

export interface DistributorFormData {
  name: string;
  description: string | null;
  contact_info: string | null;
  fee_structure: {
    pallet_cost: string | null;
    warehouse_services: string | null;
    pallet_build: string | null;
    floor_space_full_day: string | null;
    floor_space_half_day: string | null;
    truck_transfer_zone1: string | null;
    truck_transfer_zone2: string | null;
    custom_fees: Record<string, string> | null;
  };
}

interface CustomFee {
  id: string;
  name: string;
  amount: string;
}

/**
 * DistributorProfileForm Component
 *
 * Form to create or edit distributor profile with multi-layered fee structure.
 *
 * Requirements: Group C2 - Distribution Cost Analyzer
 *
 * Fee structure includes:
 * - Pallet cost ($)
 * - Warehouse services ($)
 * - Pallet build ($)
 * - Floor space - full day ($)
 * - Floor space - half day ($)
 * - Truck transfer - Zone 1 ($)
 * - Truck transfer - Zone 2 ($)
 * - Custom fees (name + amount, multiple)
 *
 * @example
 * ```tsx
 * <DistributorProfileForm
 *   onSubmit={(data) => handleSave(data)}
 *   onCancel={() => setShowForm(false)}
 * />
 * ```
 */
export function DistributorProfileForm({
  distributor,
  onSubmit,
  onCancel,
  loading = false,
}: DistributorProfileFormProps) {
  const [name, setName] = useState(distributor?.name || '');
  const [description, setDescription] = useState(distributor?.description || '');
  const [contactInfo, setContactInfo] = useState(distributor?.contact_info || '');

  // Fee structure
  const [palletCost, setPalletCost] = useState(
    distributor?.fee_structure.pallet_cost || ''
  );
  const [warehouseServices, setWarehouseServices] = useState(
    distributor?.fee_structure.warehouse_services || ''
  );
  const [palletBuild, setPalletBuild] = useState(
    distributor?.fee_structure.pallet_build || ''
  );
  const [floorSpaceFullDay, setFloorSpaceFullDay] = useState(
    distributor?.fee_structure.floor_space_full_day || ''
  );
  const [floorSpaceHalfDay, setFloorSpaceHalfDay] = useState(
    distributor?.fee_structure.floor_space_half_day || ''
  );
  const [truckTransferZone1, setTruckTransferZone1] = useState(
    distributor?.fee_structure.truck_transfer_zone1 || ''
  );
  const [truckTransferZone2, setTruckTransferZone2] = useState(
    distributor?.fee_structure.truck_transfer_zone2 || ''
  );

  // Custom fees
  const initialCustomFees: CustomFee[] = distributor?.fee_structure.custom_fees
    ? Object.entries(distributor.fee_structure.custom_fees).map(([name, amount]) => ({
        id: Math.random().toString(36).substr(2, 9),
        name,
        amount,
      }))
    : [];

  const [customFees, setCustomFees] = useState<CustomFee[]>(initialCustomFees);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const addCustomFee = () => {
    setCustomFees([
      ...customFees,
      { id: Math.random().toString(36).substr(2, 9), name: '', amount: '' },
    ]);
  };

  const removeCustomFee = (id: string) => {
    setCustomFees(customFees.filter((fee) => fee.id !== id));
  };

  const updateCustomFee = (id: string, field: 'name' | 'amount', value: string) => {
    setCustomFees(
      customFees.map((fee) =>
        fee.id === id ? { ...fee, [field]: value } : fee
      )
    );
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Distributor name is required';
    }

    // Validate custom fees
    customFees.forEach((fee, _index) => {
      if (fee.name.trim() && !fee.amount.trim()) {
        newErrors[`customFee_${fee.id}_amount`] = 'Amount is required for custom fee';
      }
      if (!fee.name.trim() && fee.amount.trim()) {
        newErrors[`customFee_${fee.id}_name`] = 'Name is required for custom fee';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    // Build custom fees object
    const customFeesObj: Record<string, string> = {};
    customFees.forEach((fee) => {
      if (fee.name.trim() && fee.amount.trim()) {
        customFeesObj[fee.name.trim()] = fee.amount.trim();
      }
    });

    const formData: DistributorFormData = {
      name: name.trim(),
      description: description.trim() || null,
      contact_info: contactInfo.trim() || null,
      fee_structure: {
        pallet_cost: palletCost.trim() || null,
        warehouse_services: warehouseServices.trim() || null,
        pallet_build: palletBuild.trim() || null,
        floor_space_full_day: floorSpaceFullDay.trim() || null,
        floor_space_half_day: floorSpaceHalfDay.trim() || null,
        truck_transfer_zone1: truckTransferZone1.trim() || null,
        truck_transfer_zone2: truckTransferZone2.trim() || null,
        custom_fees: Object.keys(customFeesObj).length > 0 ? customFeesObj : null,
      },
    };

    onSubmit(formData);
  };

  return (
    <Card variant="bordered" padding="lg">
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <h3 className={styles.formTitle}>
            {distributor ? 'Edit Distributor' : 'New Distributor'}
          </h3>
          <p className={styles.formDescription}>
            Set up your distributor profile with their fee structure.
          </p>
        </CardHeader>

        <CardBody>
          <div className={styles.formGrid}>
            {/* Basic Information */}
            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>Basic Information</h4>

              <Input
                label="Distributor Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                error={errors.name}
                required
                fullWidth
                placeholder="e.g., UNFI, KeHE, DPI"
              />

              <Input
                label="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                fullWidth
                placeholder="Optional notes about this distributor"
              />

              <Input
                label="Contact Information"
                value={contactInfo}
                onChange={(e) => setContactInfo(e.target.value)}
                fullWidth
                placeholder="Email, phone, or contact person"
              />
            </div>

            {/* Fee Structure */}
            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>Fee Structure</h4>
              <p className={styles.sectionDescription}>
                Enter the fees charged by this distributor. Leave blank if not applicable.
              </p>

              <div className={styles.feeGrid}>
                <Input
                  label="Pallet Cost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={palletCost}
                  onChange={(e) => setPalletCost(e.target.value)}
                  placeholder="0.00"
                  iconBefore={<span>$</span>}
                  helperText="Cost per pallet"
                />

                <Input
                  label="Warehouse Services"
                  type="number"
                  step="0.01"
                  min="0"
                  value={warehouseServices}
                  onChange={(e) => setWarehouseServices(e.target.value)}
                  placeholder="0.00"
                  iconBefore={<span>$</span>}
                  helperText="Per pallet warehouse fee"
                />

                <Input
                  label="Pallet Build"
                  type="number"
                  step="0.01"
                  min="0"
                  value={palletBuild}
                  onChange={(e) => setPalletBuild(e.target.value)}
                  placeholder="0.00"
                  iconBefore={<span>$</span>}
                  helperText="Per pallet build fee"
                />

                <Input
                  label="Floor Space - Full Day"
                  type="number"
                  step="0.01"
                  min="0"
                  value={floorSpaceFullDay}
                  onChange={(e) => setFloorSpaceFullDay(e.target.value)}
                  placeholder="0.00"
                  iconBefore={<span>$</span>}
                  helperText="Per full day rate"
                />

                <Input
                  label="Floor Space - Half Day"
                  type="number"
                  step="0.01"
                  min="0"
                  value={floorSpaceHalfDay}
                  onChange={(e) => setFloorSpaceHalfDay(e.target.value)}
                  placeholder="0.00"
                  iconBefore={<span>$</span>}
                  helperText="Per half day rate"
                />

                <Input
                  label="Truck Transfer - Zone 1"
                  type="number"
                  step="0.01"
                  min="0"
                  value={truckTransferZone1}
                  onChange={(e) => setTruckTransferZone1(e.target.value)}
                  placeholder="0.00"
                  iconBefore={<span>$</span>}
                  helperText="Zone 1 transfer fee"
                />

                <Input
                  label="Truck Transfer - Zone 2"
                  type="number"
                  step="0.01"
                  min="0"
                  value={truckTransferZone2}
                  onChange={(e) => setTruckTransferZone2(e.target.value)}
                  placeholder="0.00"
                  iconBefore={<span>$</span>}
                  helperText="Zone 2 transfer fee"
                />
              </div>
            </div>

            {/* Custom Fees */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h4 className={styles.sectionTitle}>Custom Fees</h4>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addCustomFee}
                  iconBefore={<span>+</span>}
                >
                  Add Custom Fee
                </Button>
              </div>

              {customFees.length > 0 ? (
                <div className={styles.customFeesList}>
                  {customFees.map((fee) => (
                    <div key={fee.id} className={styles.customFeeRow}>
                      <Input
                        label="Fee Name"
                        value={fee.name}
                        onChange={(e) => updateCustomFee(fee.id, 'name', e.target.value)}
                        error={errors[`customFee_${fee.id}_name`]}
                        placeholder="e.g., Special handling"
                        fullWidth
                      />
                      <Input
                        label="Amount"
                        type="number"
                        step="0.01"
                        min="0"
                        value={fee.amount}
                        onChange={(e) => updateCustomFee(fee.id, 'amount', e.target.value)}
                        error={errors[`customFee_${fee.id}_amount`]}
                        placeholder="0.00"
                        iconBefore={<span>$</span>}
                        fullWidth
                      />
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={() => removeCustomFee(fee.id)}
                        aria-label="Remove custom fee"
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.emptyState}>
                  No custom fees added. Use the button above to add distributor-specific fees.
                </p>
              )}
            </div>
          </div>
        </CardBody>

        <CardFooter>
          <div className={styles.formActions}>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={loading}
              disabled={loading}
            >
              {distributor ? 'Save Changes' : 'Create Distributor'}
            </Button>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}
