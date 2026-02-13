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
  fee_structure: Array<{
    id: string;
    description: string;
    amount: string;
    unit: 'per_pallet' | 'per_case' | 'per_day_full' | 'per_day_half' | 'per_shipment' | 'per_zone' | 'flat_fee' | 'percentage';
  }>;
  last_fee_update_date: number | null;
  typical_update_frequency: 'weekly' | 'monthly' | 'quarterly' | 'annually' | null;
}

interface Fee {
  id: string;
  description: string;
  amount: string;
  unit: 'per_pallet' | 'per_case' | 'per_day_full' | 'per_day_half' | 'per_shipment' | 'per_zone' | 'flat_fee' | 'percentage';
}

// Common fee suggestions to help users get started
const COMMON_FEE_SUGGESTIONS = [
  { label: 'Pallet Cost', unit: 'per_pallet' as const },
  { label: 'Warehouse Services', unit: 'per_pallet' as const },
  { label: 'Pallet Build', unit: 'per_pallet' as const },
  { label: 'Floor Space', unit: 'per_day_full' as const },
  { label: 'Truck Transfer', unit: 'per_shipment' as const },
  { label: 'Custom...', unit: 'flat_fee' as const },
];

/**
 * DistributorProfileForm Component
 *
 * Form to create or edit distributor profile with flexible fee structure.
 *
 * Requirements: Group C2 - Distribution Cost Analyzer
 *
 * Fee structure is now completely flexible:
 * - Add any number of fees
 * - Customize fee description
 * - Set amount
 * - Choose unit type (per pallet, per case, per day, etc.)
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

  // Fee tracking
  const [lastFeeUpdateDate, setLastFeeUpdateDate] = useState<string>(
    distributor?.last_fee_update_date
      ? new Date(distributor.last_fee_update_date).toISOString().split('T')[0]
      : ''
  );
  const [typicalUpdateFrequency, setTypicalUpdateFrequency] = useState<string>(
    distributor?.typical_update_frequency || ''
  );

  // Fee structure - flexible array
  const initialFees: Fee[] = distributor?.fee_structure || [];
  const [fees, setFees] = useState<Fee[]>(initialFees);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const addFee = (suggestion?: { label: string; unit: typeof fees[0]['unit'] }) => {
    const newFee: Fee = {
      id: Math.random().toString(36).substr(2, 9),
      description: suggestion?.label === 'Custom...' ? '' : (suggestion?.label || ''),
      amount: '',
      unit: suggestion?.unit || 'per_pallet',
    };
    setFees([...fees, newFee]);
  };

  const removeFee = (id: string) => {
    setFees(fees.filter((fee) => fee.id !== id));
  };

  const updateFee = (id: string, field: keyof Fee, value: string) => {
    setFees(
      fees.map((fee) =>
        fee.id === id ? { ...fee, [field]: value } : fee
      )
    );
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Distributor name is required';
    }

    // Validate fees
    fees.forEach((fee) => {
      if (!fee.description.trim()) {
        newErrors[`fee_${fee.id}_description`] = 'Fee description is required';
      }
      if (!fee.amount.trim()) {
        newErrors[`fee_${fee.id}_amount`] = 'Amount is required';
      } else {
        const amount = parseFloat(fee.amount);
        if (isNaN(amount) || amount < 0) {
          newErrors[`fee_${fee.id}_amount`] = 'Amount must be a valid positive number';
        }
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

    const formData: DistributorFormData = {
      name: name.trim(),
      description: description.trim() || null,
      contact_info: contactInfo.trim() || null,
      fee_structure: fees.filter(fee => fee.description.trim() && fee.amount.trim()),
      last_fee_update_date: lastFeeUpdateDate ? new Date(lastFeeUpdateDate).getTime() : null,
      typical_update_frequency: (typicalUpdateFrequency as 'weekly' | 'monthly' | 'quarterly' | 'annually') || null,
    };

    onSubmit(formData);
  };

  const getUnitLabel = (unit: Fee['unit']): string => {
    const labels = {
      per_pallet: 'per pallet',
      per_case: 'per case',
      per_day_full: 'per day (full)',
      per_day_half: 'per day (half)',
      per_shipment: 'per shipment',
      per_zone: 'per zone',
      flat_fee: 'flat fee',
      percentage: '%',
    };
    return labels[unit];
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

              <Input
                label="Last Fee Update Date"
                type="date"
                value={lastFeeUpdateDate}
                onChange={(e) => setLastFeeUpdateDate(e.target.value)}
                fullWidth
                helperText="When did this distributor last update their fees?"
              />

              <div className={styles.selectWrapper}>
                <label htmlFor="updateFrequency" className={styles.label}>
                  Typical Update Frequency
                </label>
                <select
                  id="updateFrequency"
                  value={typicalUpdateFrequency}
                  onChange={(e) => setTypicalUpdateFrequency(e.target.value)}
                  className={styles.select}
                >
                  <option value="">Select frequency...</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annually">Annually</option>
                </select>
                <p className={styles.helperText}>
                  How often does this distributor typically update their fees?
                </p>
              </div>
            </div>

            {/* Fee Structure - Flexible Builder */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <div>
                  <h4 className={styles.sectionTitle}>Fee Structure</h4>
                  <p className={styles.sectionDescription}>
                    Add the fees charged by this distributor. Customize the description, amount, and unit for each fee.
                  </p>
                </div>
              </div>

              {/* Common Fee Suggestions */}
              <div className={styles.suggestionsContainer}>
                <p className={styles.suggestionsLabel}>Quick Add:</p>
                <div className={styles.suggestionButtons}>
                  {COMMON_FEE_SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion.label}
                      type="button"
                      onClick={() => addFee(suggestion)}
                      className={styles.suggestionButton}
                    >
                      + {suggestion.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Fee List */}
              {fees.length > 0 ? (
                <div className={styles.feesList}>
                  {fees.map((fee) => (
                    <div key={fee.id} className={styles.feeRow}>
                      <div className={styles.feeFields}>
                        <div className={styles.feeField}>
                          <label className={styles.feeLabel}>Description</label>
                          <input
                            type="text"
                            value={fee.description}
                            onChange={(e) => updateFee(fee.id, 'description', e.target.value)}
                            placeholder="ex: Pallet Cost"
                            className={styles.feeInput}
                          />
                          {errors[`fee_${fee.id}_description`] && (
                            <span className={styles.errorText}>{errors[`fee_${fee.id}_description`]}</span>
                          )}
                        </div>

                        <div className={styles.feeField}>
                          <label className={styles.feeLabel}>Amount</label>
                          <div className={styles.amountWrapper}>
                            {fee.unit !== 'percentage' && <span className={styles.currencySymbol}>$</span>}
                            <input
                              type="number"
                              step={fee.unit === 'percentage' ? '1' : '0.01'}
                              min="0"
                              max={fee.unit === 'percentage' ? '100' : undefined}
                              value={fee.amount}
                              onChange={(e) => updateFee(fee.id, 'amount', e.target.value)}
                              placeholder={fee.unit === 'percentage' ? '0' : '0.00'}
                              className={styles.feeInputAmount}
                            />
                            {fee.unit === 'percentage' && <span className={styles.percentSymbol}>%</span>}
                          </div>
                          {errors[`fee_${fee.id}_amount`] && (
                            <span className={styles.errorText}>{errors[`fee_${fee.id}_amount`]}</span>
                          )}
                        </div>

                        <div className={styles.feeField}>
                          <label className={styles.feeLabel}>Unit</label>
                          <select
                            value={fee.unit}
                            onChange={(e) => updateFee(fee.id, 'unit', e.target.value)}
                            className={styles.feeSelect}
                          >
                            <option value="per_pallet">per pallet</option>
                            <option value="per_case">per case</option>
                            <option value="per_day_full">per day (full)</option>
                            <option value="per_day_half">per day (half)</option>
                            <option value="per_shipment">per shipment</option>
                            <option value="per_zone">per zone</option>
                            <option value="flat_fee">flat fee</option>
                            <option value="percentage">%</option>
                          </select>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeFee(fee.id)}
                          className={styles.removeButton}
                          aria-label="Remove fee"
                          title="Remove fee"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <p>No fees added yet. Use the quick add buttons above or create a custom fee.</p>
                </div>
              )}

              {/* Add Fee Button */}
              <div className={styles.addFeeButtonContainer}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addFee()}
                  iconBefore={<span>+</span>}
                >
                  Add Custom Fee
                </Button>
              </div>
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
