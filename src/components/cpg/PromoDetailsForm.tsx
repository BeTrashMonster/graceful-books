import { useState, useCallback } from 'react';
import { Input } from '../forms/Input';
import { Button } from '../core/Button';
import styles from './PromoDetailsForm.module.css';

export interface PromoVariantData {
  retailPrice: string;
  unitsAvailable: string;
  baseCPU: string;
}

export interface PromoFormData {
  promoName: string;
  retailerName: string;
  promoStartDate: string;
  promoEndDate: string;
  storeSalePercentage: string;
  producerPaybackPercentage: string;
  variants: Record<string, PromoVariantData>;
}

export interface PromoDetailsFormProps {
  /**
   * Initial form data
   */
  initialData?: Partial<PromoFormData>;
  /**
   * Available product variants (e.g., ["8oz", "16oz", "32oz"])
   */
  availableVariants: string[];
  /**
   * Latest CPUs per variant (auto-populate)
   */
  latestCPUs?: Record<string, string>;
  /**
   * Callback when form is submitted
   */
  onSubmit: (data: PromoFormData) => void;
  /**
   * Loading state
   */
  isLoading?: boolean;
}

/**
 * PromoDetailsForm Component
 *
 * Form for entering sales promo details with variant-specific data.
 *
 * Features:
 * - Promo metadata (name, retailer, dates, percentages)
 * - Per-variant inputs (retail price, units available, base CPU)
 * - Auto-populate base CPUs from latest invoice
 * - Real-time validation
 * - Accessible form structure
 *
 * Requirements:
 * - WCAG 2.1 AA compliant
 * - Steadiness communication style
 * - Clear validation messages
 * - Mobile responsive
 *
 * @example
 * ```tsx
 * <PromoDetailsForm
 *   availableVariants={["8oz", "16oz", "32oz"]}
 *   latestCPUs={{ "8oz": "2.15", "16oz": "3.20", "32oz": "4.50" }}
 *   onSubmit={handleSubmit}
 * />
 * ```
 */
export function PromoDetailsForm({
  initialData,
  availableVariants,
  latestCPUs = {},
  onSubmit,
  isLoading = false,
}: PromoDetailsFormProps) {
  const [formData, setFormData] = useState<PromoFormData>(() => {
    const defaultVariants: Record<string, PromoVariantData> = {};
    availableVariants.forEach((variant) => {
      defaultVariants[variant] = {
        retailPrice: '',
        unitsAvailable: '',
        baseCPU: latestCPUs[variant] || '',
      };
    });

    return {
      promoName: initialData?.promoName || '',
      retailerName: initialData?.retailerName || '',
      promoStartDate: initialData?.promoStartDate || '',
      promoEndDate: initialData?.promoEndDate || '',
      storeSalePercentage: initialData?.storeSalePercentage || '',
      producerPaybackPercentage: initialData?.producerPaybackPercentage || '',
      variants: initialData?.variants || defaultVariants,
    };
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate promo name
    if (!formData.promoName.trim()) {
      newErrors.promoName = 'Promo name is required';
    }

    // Validate retailer name
    if (!formData.retailerName.trim()) {
      newErrors.retailerName = 'Retailer name is required';
    }

    // Validate store sale percentage
    const storeSalePct = parseFloat(formData.storeSalePercentage);
    if (isNaN(storeSalePct) || storeSalePct < 0 || storeSalePct > 100) {
      newErrors.storeSalePercentage = 'Store sale % must be between 0 and 100';
    }

    // Validate producer payback percentage
    const paybackPct = parseFloat(formData.producerPaybackPercentage);
    if (isNaN(paybackPct) || paybackPct < 0 || paybackPct > 100) {
      newErrors.producerPaybackPercentage = 'Producer payback % must be between 0 and 100';
    }

    // Validate variant data
    Object.entries(formData.variants).forEach(([variant, data]) => {
      if (!data.retailPrice || parseFloat(data.retailPrice) <= 0) {
        newErrors[`variant_${variant}_retailPrice`] = `${variant}: Retail price must be greater than 0`;
      }
      if (!data.unitsAvailable || parseFloat(data.unitsAvailable) <= 0) {
        newErrors[`variant_${variant}_unitsAvailable`] = `${variant}: Units available must be greater than 0`;
      }
      if (!data.baseCPU || parseFloat(data.baseCPU) < 0) {
        newErrors[`variant_${variant}_baseCPU`] = `${variant}: Base CPU is required`;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const handleChange = (field: keyof PromoFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  };

  const handleVariantChange = (variant: string, field: keyof PromoVariantData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      variants: {
        ...prev.variants,
        [variant]: {
          retailPrice: '',
          unitsAvailable: '',
          baseCPU: '',
          ...prev.variants[variant],
          [field]: value,
        },
      },
    }));
    // Clear error for this field
    const errorKey = `variant_${variant}_${field}`;
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[errorKey];
      return newErrors;
    });
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form} noValidate>
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Promo Details</h3>

        <div className={styles.row}>
          <Input
            label="Promo Name"
            type="text"
            value={formData.promoName}
            onChange={(e) => handleChange('promoName', e.target.value)}
            error={errors.promoName}
            required
            fullWidth
            helperText="Give this promo a memorable name (e.g., 'Summer Sale 2026')"
          />
        </div>

        <div className={styles.row}>
          <Input
            label="Retailer Name"
            type="text"
            value={formData.retailerName}
            onChange={(e) => handleChange('retailerName', e.target.value)}
            error={errors.retailerName}
            required
            fullWidth
            helperText="Which retailer is running this promotion?"
          />
        </div>

        <div className={styles.row}>
          <Input
            label="Promo Start Date"
            type="date"
            value={formData.promoStartDate}
            onChange={(e) => handleChange('promoStartDate', e.target.value)}
            fullWidth
          />
          <Input
            label="Promo End Date"
            type="date"
            value={formData.promoEndDate}
            onChange={(e) => handleChange('promoEndDate', e.target.value)}
            fullWidth
          />
        </div>

        <div className={styles.row}>
          <Input
            label="Store Sale %"
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={formData.storeSalePercentage}
            onChange={(e) => handleChange('storeSalePercentage', e.target.value)}
            error={errors.storeSalePercentage}
            required
            fullWidth
            helperText="How much discount are customers getting? (e.g., 20 for 20% off)"
          />
          <Input
            label="Producer Payback %"
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={formData.producerPaybackPercentage}
            onChange={(e) => handleChange('producerPaybackPercentage', e.target.value)}
            error={errors.producerPaybackPercentage}
            required
            fullWidth
            helperText="What % of the retail price are you covering? (e.g., 10 for 10% cost-share)"
          />
        </div>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Product Details</h3>
        <p className={styles.sectionDescription}>
          Enter pricing and availability for each product. Base CPUs are pre-filled from your latest invoice.
        </p>

        {availableVariants.map((variant) => (
          <div key={variant} className={styles.variantCard}>
            <h4 className={styles.variantTitle}>{variant}</h4>
            <div className={styles.variantRow}>
              <Input
                label="Retail Price"
                type="number"
                step="0.01"
                min="0"
                value={formData.variants[variant]?.retailPrice || ''}
                onChange={(e) => handleVariantChange(variant, 'retailPrice', e.target.value)}
                error={errors[`variant_${variant}_retailPrice`]}
                required
                fullWidth
                helperText="Price customers pay (before promo discount)"
              />
              <Input
                label="Units Available"
                type="number"
                step="1"
                min="0"
                value={formData.variants[variant]?.unitsAvailable || ''}
                onChange={(e) => handleVariantChange(variant, 'unitsAvailable', e.target.value)}
                error={errors[`variant_${variant}_unitsAvailable`]}
                required
                fullWidth
                helperText="How many units are you committing to this promo?"
              />
              <Input
                label="Base CPU"
                type="number"
                step="0.01"
                min="0"
                value={formData.variants[variant]?.baseCPU || ''}
                onChange={(e) => handleVariantChange(variant, 'baseCPU', e.target.value)}
                error={errors[`variant_${variant}_baseCPU`]}
                required
                fullWidth
                helperText="Your cost per unit (from latest invoice)"
              />
            </div>
          </div>
        ))}
      </div>

      <div className={styles.actions}>
        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={isLoading}
          disabled={isLoading}
        >
          Analyze Promo
        </Button>
      </div>
    </form>
  );
}
