import { useState, useEffect, useRef } from 'react';
import { Input } from '../forms/Input';
import { Button } from '../core/Button';
import { Checkbox } from '../forms/Checkbox';
import { Modal } from '../modals/Modal';
import type { CPGDistributor } from '../../db/schema/cpg.schema';
import styles from './DistributorProfileForm.module.css';
import modalStyles from './modals/CPGModals.module.css';

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
    percentage_basis?: 'product_value' | 'distribution_cost' | 'discount';
  }>;
  last_fee_update_date: number | null;
  typical_update_frequency: 'weekly' | 'monthly' | 'quarterly' | 'annually' | null;
}

interface Fee {
  id: string;
  description: string;
  amount: string;
  unit: 'per_pallet' | 'per_case' | 'per_day_full' | 'per_day_half' | 'per_shipment' | 'per_zone' | 'flat_fee' | 'percentage';
  percentage_basis?: 'product_value' | 'distribution_cost' | 'discount';
}

// Common fee suggestions to help users get started
const COMMON_FEE_SUGGESTIONS = [
  { label: 'Pallet Cost', unit: 'per_pallet' as const },
  { label: 'Warehouse Services', unit: 'per_pallet' as const },
  { label: 'Pallet Build', unit: 'per_pallet' as const },
  { label: 'Short Term Storage', unit: 'per_day_full' as const },
  { label: 'Floor Space', unit: 'per_day_full' as const },
  { label: 'Truck Transfer', unit: 'per_shipment' as const },
  { label: 'Zone (Delivery)', unit: 'per_zone' as const },
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
  const errorAlertRef = useRef<HTMLDivElement>(null);

  // Scroll to error when errors are set
  useEffect(() => {
    if (Object.keys(errors).length > 0 && errorAlertRef.current) {
      errorAlertRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [errors]);

  // Zone info modal state
  const [showZoneInfoModal, setShowZoneInfoModal] = useState(false);
  const [dontShowZoneInfoAgain, setDontShowZoneInfoAgain] = useState(false);
  const [hasShownZoneInfoThisSession, setHasShownZoneInfoThisSession] = useState(false);
  const [pendingZoneFee, setPendingZoneFee] = useState<{ label: string; unit: typeof fees[0]['unit'] } | null>(null);

  // Quick Add customization state
  const [showQuickAddCustomizer, setShowQuickAddCustomizer] = useState(false);
  const [customQuickAdds, setCustomQuickAdds] = useState<typeof COMMON_FEE_SUGGESTIONS>([]);
  const [removedDefaultLabels, setRemovedDefaultLabels] = useState<string[]>([]);
  const [quickAddSuggestions, setQuickAddSuggestions] = useState<typeof COMMON_FEE_SUGGESTIONS>(COMMON_FEE_SUGGESTIONS);
  const [newQuickAddLabel, setNewQuickAddLabel] = useState('');
  const [newQuickAddUnit, setNewQuickAddUnit] = useState<typeof fees[0]['unit']>('per_pallet');

  // Load custom Quick Adds and removed defaults from localStorage on mount
  useEffect(() => {
    try {
      const savedCustom = localStorage.getItem('customQuickAdds');
      const savedRemoved = localStorage.getItem('removedDefaultQuickAdds');

      let custom: typeof COMMON_FEE_SUGGESTIONS = [];
      let removed: string[] = [];

      if (savedCustom) {
        custom = JSON.parse(savedCustom);
        setCustomQuickAdds(custom);
      }

      if (savedRemoved) {
        removed = JSON.parse(savedRemoved);
        setRemovedDefaultLabels(removed);
      }

      // Build Quick Add suggestions: custom + (defaults - removed)
      const activeDefaults = COMMON_FEE_SUGGESTIONS.filter(
        suggestion => !removed.includes(suggestion.label)
      );
      setQuickAddSuggestions([...custom, ...activeDefaults]);
    } catch (error) {
      console.error('Error loading Quick Add preferences:', error);
    }
  }, []);

  const addFee = (suggestion?: { label: string; unit: typeof fees[0]['unit'] }) => {
    // Check if this is a zone fee and if user hasn't seen the info modal this session
    if (suggestion?.unit === 'per_zone' && !hasShownZoneInfoThisSession) {
      const hideZoneTip = localStorage.getItem('hideZoneInfoModal');
      if (!hideZoneTip) {
        setPendingZoneFee(suggestion);
        setShowZoneInfoModal(true);
        setHasShownZoneInfoThisSession(true); // Mark as shown for this session
        return;
      }
    }

    const newFee: Fee = {
      id: Math.random().toString(36).substr(2, 9),
      description: suggestion?.label === 'Custom...' ? '' : (suggestion?.label || ''),
      amount: '',
      unit: suggestion?.unit || 'per_pallet',
    };
    setFees([...fees, newFee]);
  };

  const handleZoneInfoConfirm = () => {
    // Save preference if checkbox is checked
    if (dontShowZoneInfoAgain) {
      localStorage.setItem('hideZoneInfoModal', 'true');
    }

    // Add the zone fee
    if (pendingZoneFee) {
      const newFee: Fee = {
        id: Math.random().toString(36).substr(2, 9),
        description: pendingZoneFee.label === 'Custom...' ? '' : pendingZoneFee.label,
        amount: '',
        unit: pendingZoneFee.unit,
      };
      setFees([...fees, newFee]);
    }

    // Close modal and reset
    setShowZoneInfoModal(false);
    setPendingZoneFee(null);
    setDontShowZoneInfoAgain(false);
  };

  // Quick Add management functions
  const addCustomQuickAdd = (label: string, unit: typeof fees[0]['unit']) => {
    const newCustomAdd = { label, unit };
    const updatedCustom = [...customQuickAdds, newCustomAdd];
    setCustomQuickAdds(updatedCustom);

    // Rebuild suggestions
    const activeDefaults = COMMON_FEE_SUGGESTIONS.filter(
      suggestion => !removedDefaultLabels.includes(suggestion.label)
    );
    setQuickAddSuggestions([...updatedCustom, ...activeDefaults]);

    // Save to localStorage
    try {
      localStorage.setItem('customQuickAdds', JSON.stringify(updatedCustom));
    } catch (error) {
      console.error('Error saving custom Quick Adds:', error);
    }
  };

  const removeCustomQuickAdd = (index: number) => {
    const updatedCustom = customQuickAdds.filter((_, i) => i !== index);
    setCustomQuickAdds(updatedCustom);

    // Rebuild suggestions
    const activeDefaults = COMMON_FEE_SUGGESTIONS.filter(
      suggestion => !removedDefaultLabels.includes(suggestion.label)
    );
    setQuickAddSuggestions([...updatedCustom, ...activeDefaults]);

    // Save to localStorage
    try {
      localStorage.setItem('customQuickAdds', JSON.stringify(updatedCustom));
    } catch (error) {
      console.error('Error saving custom Quick Adds:', error);
    }
  };

  const removeDefaultQuickAdd = (label: string) => {
    const updatedRemoved = [...removedDefaultLabels, label];
    setRemovedDefaultLabels(updatedRemoved);

    // Rebuild suggestions
    const activeDefaults = COMMON_FEE_SUGGESTIONS.filter(
      suggestion => !updatedRemoved.includes(suggestion.label)
    );
    setQuickAddSuggestions([...customQuickAdds, ...activeDefaults]);

    // Save to localStorage
    try {
      localStorage.setItem('removedDefaultQuickAdds', JSON.stringify(updatedRemoved));
    } catch (error) {
      console.error('Error saving removed defaults:', error);
    }
  };

  const restoreDefaultQuickAdd = (label: string) => {
    const updatedRemoved = removedDefaultLabels.filter(l => l !== label);
    setRemovedDefaultLabels(updatedRemoved);

    // Rebuild suggestions
    const activeDefaults = COMMON_FEE_SUGGESTIONS.filter(
      suggestion => !updatedRemoved.includes(suggestion.label)
    );
    setQuickAddSuggestions([...customQuickAdds, ...activeDefaults]);

    // Save to localStorage
    try {
      if (updatedRemoved.length === 0) {
        localStorage.removeItem('removedDefaultQuickAdds');
      } else {
        localStorage.setItem('removedDefaultQuickAdds', JSON.stringify(updatedRemoved));
      }
    } catch (error) {
      console.error('Error saving removed defaults:', error);
    }
  };

  const resetQuickAddsToDefault = () => {
    setCustomQuickAdds([]);
    setRemovedDefaultLabels([]);
    setQuickAddSuggestions(COMMON_FEE_SUGGESTIONS);

    // Clear from localStorage
    try {
      localStorage.removeItem('customQuickAdds');
      localStorage.removeItem('removedDefaultQuickAdds');
    } catch (error) {
      console.error('Error clearing Quick Add preferences:', error);
    }
  };

  const handleAddNewQuickAdd = () => {
    if (!newQuickAddLabel.trim()) return;

    addCustomQuickAdd(newQuickAddLabel, newQuickAddUnit);
    setNewQuickAddLabel('');
    setNewQuickAddUnit('per_pallet');
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
    <>
      <form onSubmit={handleSubmit} className={modalStyles.form} style={{ padding: '1.5rem' }}>
        {/* Error Alert */}
        {Object.keys(errors).some(key => !key.startsWith('fee_')) && (
          <div ref={errorAlertRef} className={modalStyles.errorAlert} role="alert">
            {errors.name || 'Please fix the errors below'}
          </div>
        )}

        {/* Basic Information */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h4 className={modalStyles.sectionHeader}>Basic Information</h4>

          <div className={modalStyles.row}>
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
                  placeholder="Optional notes"
                />

                <Input
                  label="Contact Info"
                  value={contactInfo}
                  onChange={(e) => setContactInfo(e.target.value)}
                  fullWidth
                  placeholder="Email or phone"
                />
          </div>

          <div className={modalStyles.rowEqual}>
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
        </div>

        {/* Fee Structure - Flexible Builder */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h4 className={modalStyles.sectionHeader}>Fee Structure</h4>
          <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1rem' }}>
            Add the fees charged by this distributor. Customize the description, amount, and unit for each fee.
          </p>

          {/* Common Fee Suggestions */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            padding: '1rem',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            marginBottom: '1rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#4b006e', margin: 0 }}>Quick Add:</p>
              <button
                type="button"
                onClick={() => setShowQuickAddCustomizer(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#4b006e',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: 0
                }}
              >
                ⚙️ Customize
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {quickAddSuggestions.map((suggestion, index) => (
                <button
                  key={`${suggestion.label}-${index}`}
                  type="button"
                  onClick={() => addFee(suggestion)}
                  style={{
                    padding: '0.5rem 1rem',
                    background: 'linear-gradient(135deg, rgba(75, 0, 110, 0.05), rgba(255, 215, 0, 0.05))',
                    border: '2px solid #FFD700',
                    borderRadius: '6px',
                    color: '#4b006e',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #4b006e, #FFD700)';
                    e.currentTarget.style.color = 'white';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(75, 0, 110, 0.05), rgba(255, 215, 0, 0.05))';
                    e.currentTarget.style.color = '#4b006e';
                  }}
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

                        {fee.unit === 'percentage' && (
                          <div className={styles.feeField}>
                            <label className={styles.feeLabel}>Calculate % of</label>
                            <select
                              value={fee.percentage_basis || 'product_value'}
                              onChange={(e) => updateFee(fee.id, 'percentage_basis', e.target.value)}
                              className={styles.feeSelect}
                            >
                              <option value="discount">Discount on Distribution Cost</option>
                              <option value="distribution_cost">Total Distribution Cost</option>
                              <option value="product_value">Total Product Value</option>
                            </select>
                          </div>
                        )}

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
          <div style={{ marginTop: '1rem' }}>
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

        {/* Form Actions */}
        <div className={modalStyles.modalActions} style={{ marginTop: '1.5rem' }}>
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
      </form>

      {/* Zone Info Modal */}
      {showZoneInfoModal && (
        <Modal
          isOpen={showZoneInfoModal}
          onClose={() => {
            setShowZoneInfoModal(false);
            setPendingZoneFee(null);
            setDontShowZoneInfoAgain(false);
          }}
          title="About Delivery Zones"
          size="md"
        >
          <div style={{ padding: '1.5rem' }}>
            <p style={{ marginBottom: '1rem', lineHeight: '1.6' }}>
              <strong>Delivery Zones</strong> help you track different delivery areas with varying costs.
            </p>
            <p style={{ marginBottom: '1rem', lineHeight: '1.6' }}>
              When you include the word <strong>"Zone"</strong> in a fee description (e.g., "Zone 1", "Delivery Zone 2"),
              the system automatically separates it into the <strong>Delivery Zone</strong> section in the calculator.
            </p>
            <p style={{ marginBottom: '1rem', lineHeight: '1.6' }}>
              This makes it easy to compare costs between different delivery zones and helps you make informed
              decisions about which zone to ship to.
            </p>
            <p style={{ marginBottom: '1.5rem', lineHeight: '1.6' }}>
              <strong>Tip:</strong> Add multiple zones (e.g., "Zone 1", "Zone 2", "Zone 3") to compare delivery costs
              across all your distributor's service areas.
            </p>

            <div style={{ marginBottom: '1.5rem' }}>
              <Checkbox
                label="Don't show this message again"
                checked={dontShowZoneInfoAgain}
                onChange={(e) => setDontShowZoneInfoAgain(e.target.checked)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="primary" onClick={handleZoneInfoConfirm}>
                Got it!
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Quick Add Customization Modal */}
      {showQuickAddCustomizer && (
        <Modal
          isOpen={showQuickAddCustomizer}
          onClose={() => setShowQuickAddCustomizer(false)}
          title="Customize Quick Adds"
          size="md"
        >
          <div style={{ padding: '1.5rem' }}>
            <p style={{ marginBottom: '1.5rem', lineHeight: '1.6' }}>
              Customize your Quick Add buttons to match your workflow. Add your most commonly used fees
              for faster distributor setup.
            </p>

            {/* Active Quick Adds List */}
            {(customQuickAdds.length > 0 || COMMON_FEE_SUGGESTIONS.some(d => !removedDefaultLabels.includes(d.label))) && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ marginBottom: '0.75rem', fontWeight: 600 }}>Active Quick Adds:</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {/* Custom Quick Adds */}
                  {customQuickAdds.map((quickAdd, index) => (
                    <div
                      key={`custom-${index}`}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.75rem',
                        backgroundColor: '#f0f9ff',
                        borderRadius: '0.375rem',
                        border: '1px solid #bae6fd',
                      }}
                    >
                      <div>
                        <strong>{quickAdd.label}</strong>
                        <span style={{ marginLeft: '0.5rem', color: '#6b7280' }}>
                          ({quickAdd.unit.replace(/_/g, ' ')})
                        </span>
                        <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: '#0284c7', fontWeight: 600 }}>
                          CUSTOM
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCustomQuickAdd(index)}
                        style={{
                          padding: '0.25rem 0.5rem',
                          backgroundColor: '#fee2e2',
                          color: '#dc2626',
                          border: 'none',
                          borderRadius: '0.25rem',
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}

                  {/* Default Quick Adds (not removed) */}
                  {COMMON_FEE_SUGGESTIONS
                    .filter(suggestion => !removedDefaultLabels.includes(suggestion.label))
                    .map((quickAdd, index) => (
                      <div
                        key={`default-${index}`}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.75rem',
                          backgroundColor: '#f9fafb',
                          borderRadius: '0.375rem',
                          border: '1px solid #e5e7eb',
                        }}
                      >
                        <div>
                          <strong>{quickAdd.label}</strong>
                          <span style={{ marginLeft: '0.5rem', color: '#6b7280' }}>
                            ({quickAdd.unit.replace(/_/g, ' ')})
                          </span>
                          <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: '#6b7280' }}>
                            default
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeDefaultQuickAdd(quickAdd.label)}
                          style={{
                            padding: '0.25rem 0.5rem',
                            backgroundColor: '#fee2e2',
                            color: '#dc2626',
                            border: 'none',
                            borderRadius: '0.25rem',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Removed Defaults (can be restored) */}
            {removedDefaultLabels.length > 0 && (
              <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#fef3c7', borderRadius: '0.375rem', border: '1px solid #fde68a' }}>
                <h4 style={{ marginBottom: '0.75rem', fontWeight: 600, color: '#92400e' }}>Removed Defaults:</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {removedDefaultLabels.map((label, index) => {
                    const defaultItem = COMMON_FEE_SUGGESTIONS.find(s => s.label === label);
                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={() => restoreDefaultQuickAdd(label)}
                        style={{
                          padding: '0.375rem 0.75rem',
                          backgroundColor: 'white',
                          border: '1px solid #d97706',
                          borderRadius: '0.25rem',
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                          color: '#92400e',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                        }}
                      >
                        <span>↺</span>
                        {label}
                      </button>
                    );
                  })}
                </div>
                <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#92400e' }}>
                  Click to restore
                </p>
              </div>
            )}

            {/* Add New Quick Add */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ marginBottom: '0.75rem', fontWeight: 600 }}>Add New Quick Add:</h4>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <input
                  type="text"
                  value={newQuickAddLabel}
                  onChange={(e) => setNewQuickAddLabel(e.target.value)}
                  placeholder="Fee label (e.g., Storage Fee)"
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddNewQuickAdd();
                    }
                  }}
                />
                <select
                  value={newQuickAddUnit}
                  onChange={(e) => setNewQuickAddUnit(e.target.value as typeof fees[0]['unit'])}
                  style={{
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                  }}
                >
                  <option value="per_pallet">Per Pallet</option>
                  <option value="per_case">Per Case</option>
                  <option value="per_day_full">Per Full Day</option>
                  <option value="per_day_half">Per Half Day</option>
                  <option value="per_shipment">Per Shipment</option>
                  <option value="per_zone">Per Zone</option>
                  <option value="flat_fee">Flat Fee</option>
                  <option value="percentage">Percentage</option>
                </select>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleAddNewQuickAdd}
                  disabled={!newQuickAddLabel.trim()}
                >
                  Add
                </Button>
              </div>
            </div>

            {/* Info */}
            <div style={{ marginBottom: '1.5rem', padding: '0.75rem', backgroundColor: '#f0f9ff', borderRadius: '0.375rem', border: '1px solid #bfdbfe' }}>
              <p style={{ fontSize: '0.875rem', color: '#1e3a8a', lineHeight: '1.6' }}>
                <strong>Tip:</strong> Customize your Quick Adds to match your workflow. Remove defaults you don't use and add your own custom ones. All changes are saved automatically.
              </p>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
              <Button
                type="button"
                variant="outline"
                onClick={resetQuickAddsToDefault}
                disabled={customQuickAdds.length === 0 && removedDefaultLabels.length === 0}
              >
                Reset All to Defaults
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => setShowQuickAddCustomizer(false)}
              >
                Done
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
