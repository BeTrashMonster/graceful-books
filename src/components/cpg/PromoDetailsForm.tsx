import { useState, useCallback, useRef, useEffect } from 'react';
import { nanoid } from 'nanoid';
import { Input } from '../forms/Input';
import { Button } from '../core/Button';
import { db } from '../../db/database';
import { LaborRoleService } from '../../services/cpg/laborRole.service';
import type { CPGLaborRole } from '../../db/schema/cpg.schema';
import styles from './PromoDetailsForm.module.css';

/**
 * Safely evaluate a simple math expression WITHOUT using eval() or Function()
 * Supports basic operations: +, -, *, /, parentheses
 * Returns the result or the original string if invalid
 *
 * Security: Uses recursive descent parser instead of eval/Function to prevent code injection
 */
const evaluateMathExpression = (expr: string): string => {
  const trimmed = expr.trim();

  // Only allow numbers, spaces, decimal points, and basic math operators
  if (!/^[\d\s+\-*/.()]+$/.test(trimmed)) {
    return trimmed;
  }

  try {
    // Tokenize the expression
    const tokens = trimmed.match(/(\d+\.?\d*|[+\-*/()])/g);
    if (!tokens || tokens.length === 0) return trimmed;

    let pos = 0;

    // Parse a number or parenthesized expression
    const parseAtom = (): number => {
      if (pos >= tokens.length) throw new Error('Unexpected end');

      const token = tokens[pos];

      if (token === '(') {
        pos++; // skip '('
        const result = parseAddSub();
        if (tokens[pos] !== ')') throw new Error('Mismatched parentheses');
        pos++; // skip ')'
        return result;
      }

      if (!/^\d+\.?\d*$/.test(token)) throw new Error('Invalid number');
      pos++;
      return parseFloat(token);
    };

    // Parse multiplication and division (higher precedence)
    const parseMulDiv = (): number => {
      let result = parseAtom();

      while (pos < tokens.length && (tokens[pos] === '*' || tokens[pos] === '/')) {
        const op = tokens[pos++];
        const right = parseAtom();
        result = op === '*' ? result * right : result / right;
      }

      return result;
    };

    // Parse addition and subtraction (lower precedence)
    const parseAddSub = (): number => {
      let result = parseMulDiv();

      while (pos < tokens.length && (tokens[pos] === '+' || tokens[pos] === '-')) {
        const op = tokens[pos++];
        const right = parseMulDiv();
        result = op === '+' ? result + right : result - right;
      }

      return result;
    };

    const result = parseAddSub();

    // Verify we consumed all tokens
    if (pos !== tokens.length) throw new Error('Unexpected token');

    if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
      // Round to 2 decimal places to avoid floating point precision issues
      return (Math.round(result * 100) / 100).toString();
    }

    return trimmed;
  } catch {
    return trimmed; // If parsing fails, return original input
  }
};

export interface PromoVariantData {
  retailPrice: string;
  unitsAvailable: string;
  baseCPU: string;
  productionCPU: string; // Production labor cost per unit
}

export interface DemoHoursEntry {
  id: string;
  roleId: string; // Role ID or 'custom'
  roleName: string; // Role name for display
  hours: string;
  hourlyRate: string;
  costType: 'actual' | 'opportunity'; // actual = paying someone, opportunity = owner's time
}

export interface PromoFormData {
  promoName: string;
  retailerName: string;
  promoStartDate: string;
  promoEndDate: string;
  storeSalePercentage: string;
  producerPaybackPercentage: string;
  demoHoursEntries: DemoHoursEntry[]; // Changed from single fields to array
  selectedVariants: string[]; // Array of selected variant names
  variants: Record<string, PromoVariantData>;
}

export interface PromoDetailsFormProps {
  /**
   * Company ID for loading labor roles
   */
  companyId: string;
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
   * Latest labor costs per variant (auto-populate production CPU)
   */
  latestLaborCosts?: Record<string, string>;
  /**
   * Latest Selling Prices per variant (auto-populate retail price)
   */
  latestSoldPriceToYous?: Record<string, string>;
  /**
   * Callback when form is submitted
   */
  onSubmit: (data: PromoFormData) => void;
  /**
   * Callback when form is cleared
   */
  onClear?: () => void;
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
  companyId,
  initialData,
  availableVariants,
  latestCPUs = {},
  latestLaborCosts = {},
  latestSoldPriceToYous = {},
  onSubmit,
  onClear,
  isLoading = false,
}: PromoDetailsFormProps) {
  const [formData, setFormData] = useState<PromoFormData>(() => {
    const defaultVariants: Record<string, PromoVariantData> = {};
    availableVariants.forEach((variant) => {
      defaultVariants[variant] = {
        retailPrice: latestSoldPriceToYous[variant] || '',
        unitsAvailable: '',
        baseCPU: latestCPUs[variant] || '0', // Default to "0" instead of empty to pass validation
        productionCPU: latestLaborCosts[variant] || '0', // Default to "0" instead of empty
      };
    });

    return {
      promoName: initialData?.promoName || '',
      retailerName: initialData?.retailerName || '',
      promoStartDate: initialData?.promoStartDate || '',
      promoEndDate: initialData?.promoEndDate || '',
      storeSalePercentage: initialData?.storeSalePercentage || '',
      producerPaybackPercentage: initialData?.producerPaybackPercentage || '',
      demoHoursEntries: initialData?.demoHoursEntries || [],
      selectedVariants: initialData?.selectedVariants || [], // Start empty
      variants: initialData?.variants || defaultVariants,
    };
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [laborRoleService] = useState(() => new LaborRoleService(db));
  const [laborRoles, setLaborRoles] = useState<CPGLaborRole[]>([]);
  const [showProductSelector, setShowProductSelector] = useState(false);
  const productSelectorRef = useRef<HTMLDivElement>(null);
  const productButtonRef = useRef<HTMLButtonElement>(null);
  const productDropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
    maxHeight: 300
  });

  // Update dropdown position when shown - ensure it fits in viewport
  useEffect(() => {
    if (showProductSelector && productButtonRef.current) {
      const rect = productButtonRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom - 20; // 20px margin
      const spaceAbove = rect.top - 20; // 20px margin

      // Calculate max height based on available space
      const maxHeight = Math.min(300, Math.max(200, spaceBelow));

      // If not enough space below, consider positioning above
      const shouldPositionAbove = spaceBelow < 200 && spaceAbove > spaceBelow;

      setDropdownPosition({
        top: shouldPositionAbove ? rect.top - maxHeight - 4 : rect.bottom + 4,
        left: rect.left,
        width: rect.width / 2,
        maxHeight: shouldPositionAbove ? Math.min(300, spaceAbove) : maxHeight,
      });
    }
  }, [showProductSelector]);

  // Load labor roles
  useEffect(() => {
    const loadLaborRoles = async () => {
      try {
        const roles = await laborRoleService.getRoles(companyId);
        setLaborRoles(roles);
      } catch (error) {
        console.error('Error loading labor roles:', error);
      }
    };
    loadLaborRoles();
  }, [companyId]);

  // Sync form state with initialData when it changes (for edit mode)
  useEffect(() => {
    if (!initialData) return;

    // Rebuild default variants with latest CPUs/Selling Prices/LaborCosts
    const defaultVariants: Record<string, PromoVariantData> = {};
    availableVariants.forEach((variant) => {
      defaultVariants[variant] = {
        retailPrice: latestSoldPriceToYous[variant] || '',
        unitsAvailable: '',
        baseCPU: latestCPUs[variant] || '0', // Default to "0" instead of empty
        productionCPU: latestLaborCosts[variant] || '0', // Default to "0" instead of empty
      };
    });

    // Update form data with initialData
    setFormData({
      promoName: initialData.promoName || '',
      retailerName: initialData.retailerName || '',
      promoStartDate: initialData.promoStartDate || '',
      promoEndDate: initialData.promoEndDate || '',
      storeSalePercentage: initialData.storeSalePercentage || '',
      producerPaybackPercentage: initialData.producerPaybackPercentage || '',
      demoHoursEntries: initialData.demoHoursEntries || [],
      selectedVariants: initialData.selectedVariants || [],
      variants: initialData.variants || defaultVariants,
    });

    // Clear any validation errors when loading new data
    setErrors({});
  }, [initialData, availableVariants, latestCPUs, latestLaborCosts, latestSoldPriceToYous]);

  // Close product selector when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // Check if click is outside both the button AND the dropdown
      const isOutsideButton = productButtonRef.current && !productButtonRef.current.contains(target);
      const isOutsideDropdown = productDropdownRef.current && !productDropdownRef.current.contains(target);

      if (isOutsideButton && isOutsideDropdown) {
        setShowProductSelector(false);
      }
    };

    if (showProductSelector) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showProductSelector]);

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

    // Validate promo dates - REQUIRED
    if (!formData.promoStartDate.trim()) {
      newErrors.promoStartDate = 'Promo start date is required';
    }
    if (!formData.promoEndDate.trim()) {
      newErrors.promoEndDate = 'Promo end date is required';
    }

    // Validate date format and logic if both are provided
    if (formData.promoStartDate && formData.promoEndDate) {
      const startDate = new Date(formData.promoStartDate);
      const endDate = new Date(formData.promoEndDate);

      if (isNaN(startDate.getTime())) {
        newErrors.promoStartDate = 'Invalid start date';
      }
      if (isNaN(endDate.getTime())) {
        newErrors.promoEndDate = 'Invalid end date';
      }

      // Check that end date is not before start date (same day is okay)
      if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
        if (endDate < startDate) {
          newErrors.promoEndDate = 'End date cannot be before start date';
        }
      }
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

    // Cross-validate: Producer payback cannot exceed store discount
    if (!isNaN(storeSalePct) && !isNaN(paybackPct) && storeSalePct > 0) {
      // Payback percentage cannot be higher than the store discount percentage
      // Example: If store gives 20% discount, producer can't pay back 30% (that's more than the discount!)
      if (paybackPct > storeSalePct) {
        newErrors.producerPaybackPercentage =
          `Producer payback (${paybackPct}%) cannot exceed the store discount (${storeSalePct}%). ` +
          `You can't pay back more than the discount amount.`;
      }
    }

    // Validate demo hours entries (optional)
    formData.demoHoursEntries.forEach((entry, index) => {
      // If hours are entered, role must be selected
      const hours = parseFloat(entry.hours);
      if (!isNaN(hours) && hours > 0 && !entry.roleId.trim()) {
        newErrors[`demoEntry_${index}_role`] = 'Role is required when hours are entered';
      }
      if (isNaN(hours) || hours <= 0) {
        newErrors[`demoEntry_${index}_hours`] = 'Hours must be greater than 0';
      }
      const rate = parseFloat(entry.hourlyRate);
      if (isNaN(rate) || rate <= 0) {
        newErrors[`demoEntry_${index}_rate`] = 'Rate must be greater than 0';
      }
    });

    // Validate that at least one variant is selected
    if (formData.selectedVariants.length === 0) {
      newErrors.selectedVariants = 'Please select at least one product for this promo';
    }

    // Validate variant data (only for selected variants)
    formData.selectedVariants.forEach((variant) => {
      const data = formData.variants[variant];
      if (!data) return;

      const retailPriceValue = parseFloat(data.retailPrice);
      if (!data.retailPrice || data.retailPrice.trim() === '') {
        newErrors[`variant_${variant}_retailPrice`] = `${variant}: Retail price is required`;
      } else if (isNaN(retailPriceValue) || retailPriceValue <= 0) {
        newErrors[`variant_${variant}_retailPrice`] = `${variant}: Retail price must be greater than 0`;
      }

      const unitsValue = parseFloat(data.unitsAvailable);
      if (!data.unitsAvailable || data.unitsAvailable.trim() === '') {
        newErrors[`variant_${variant}_unitsAvailable`] = `${variant}: Units available is required`;
      } else if (isNaN(unitsValue) || unitsValue <= 0) {
        newErrors[`variant_${variant}_unitsAvailable`] = `${variant}: Units available must be greater than 0`;
      }
      const baseCPUValue = parseFloat(data.baseCPU);
      if (!data.baseCPU || data.baseCPU.trim() === '') {
        newErrors[`variant_${variant}_baseCPU`] = `${variant}: Base CPU is required (enter 0 if unknown)`;
      } else if (isNaN(baseCPUValue) || baseCPUValue < 0) {
        newErrors[`variant_${variant}_baseCPU`] = `${variant}: Base CPU must be a valid non-negative number`;
      }
      // Production CPU is optional, but if provided must be >= 0
      if (data.productionCPU && data.productionCPU.trim() !== '') {
        const prodCPUValue = parseFloat(data.productionCPU);
        if (isNaN(prodCPUValue) || prodCPUValue < 0) {
          newErrors[`variant_${variant}_productionCPU`] = `${variant}: Production CPU must be a valid non-negative number`;
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
    } else {
      // Scroll to first error (closest to top of form)
      setTimeout(() => {
        // Look for error messages specifically within this form
        const form = e.currentTarget as HTMLFormElement;

        // Null check: form might be unmounted during test cleanup
        if (!form || !form.querySelectorAll) {
          return;
        }

        const errorElements = form.querySelectorAll('[class*="errorMessage"], [class*="error"][role="alert"], input[aria-invalid="true"]');

        if (errorElements.length > 0) {
          // Find the error element closest to the top
          let topError = errorElements[0];
          let minTop = (errorElements[0] as HTMLElement).offsetTop;

          errorElements.forEach((el) => {
            const offsetTop = (el as HTMLElement).offsetTop;
            if (offsetTop < minTop) {
              minTop = offsetTop;
              topError = el;
            }
          });

          (topError as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
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

  // Handle date blur to fix 2-digit year entries (26 -> 2026, not 0026)
  const handleDateBlur = (field: 'promoStartDate' | 'promoEndDate', value: string) => {
    if (!value) return;

    try {
      const parts = value.split('-');
      if (parts.length === 3) {
        let year = parseInt(parts[0], 10);

        // If year is 2 digits (0-99), convert to current century
        if (year >= 0 && year < 100) {
          year += 2000;
          const fixedDate = `${year}-${parts[1]}-${parts[2]}`;
          setFormData((prev) => ({ ...prev, [field]: fixedDate }));
        }
      }
    } catch (e) {
      // Invalid date format, ignore
    }
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
          productionCPU: '',
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

  const handleVariantSelection = (variant: string, selected: boolean) => {
    setFormData((prev) => {
      const newSelectedVariants = selected
        ? [...prev.selectedVariants, variant]
        : prev.selectedVariants.filter((v) => v !== variant);
      return {
        ...prev,
        selectedVariants: newSelectedVariants,
      };
    });
  };

  const handleAddDemoEntry = () => {
    const newEntry: DemoHoursEntry = {
      id: nanoid(),
      roleId: '',
      roleName: '',
      hours: '',
      hourlyRate: '',
      costType: 'actual',
    };
    setFormData((prev) => ({
      ...prev,
      demoHoursEntries: [...prev.demoHoursEntries, newEntry],
    }));
  };

  const handleRemoveDemoEntry = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      demoHoursEntries: prev.demoHoursEntries.filter((entry) => entry.id !== id),
    }));
    // Clear errors for this entry
    setErrors((prev) => {
      const newErrors = { ...prev };
      const index = formData.demoHoursEntries.findIndex((e) => e.id === id);
      delete newErrors[`demoEntry_${index}_description`];
      delete newErrors[`demoEntry_${index}_hours`];
      delete newErrors[`demoEntry_${index}_rate`];
      return newErrors;
    });
  };

  const handleDemoEntryChange = (id: string, field: keyof Omit<DemoHoursEntry, 'id'>, value: string, index: number) => {
    setFormData((prev) => ({
      ...prev,
      demoHoursEntries: prev.demoHoursEntries.map((entry) =>
        entry.id === id ? { ...entry, [field]: value } : entry
      ),
    }));
    // Clear error for this field
    const errorKey = field === 'hourlyRate' ? `demoEntry_${index}_rate` : `demoEntry_${index}_${field}`;
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[errorKey];
      return newErrors;
    });
  };

  const handleRoleChange = (id: string, roleId: string, index: number) => {
    if (roleId && roleId !== 'custom') {
      // Find the selected role and auto-fill rate and name
      const selectedRole = laborRoles.find(r => r.id === roleId);
      if (selectedRole) {
        setFormData((prev) => ({
          ...prev,
          demoHoursEntries: prev.demoHoursEntries.map((entry) =>
            entry.id === id
              ? { ...entry, roleId, roleName: selectedRole.role_name, hourlyRate: selectedRole.compensation_type === 'hourly' ? selectedRole.hourly_rate || '' : selectedRole.calculated_hourly_rate || '' }
              : entry
          ),
        }));
      }
    } else {
      // Custom or empty - just set roleId and clear others
      setFormData((prev) => ({
        ...prev,
        demoHoursEntries: prev.demoHoursEntries.map((entry) =>
          entry.id === id
            ? { ...entry, roleId, roleName: roleId === 'custom' ? 'Custom' : '', hourlyRate: '' }
            : entry
        ),
      }));
    }
    // Clear error
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[`demoEntry_${index}_role`];
      return newErrors;
    });
  };

  const handleDemoHoursBlur = (id: string, value: string) => {
    const evaluated = evaluateMathExpression(value);
    if (evaluated !== value) {
      handleDemoEntryChange(id, 'hours', evaluated);
    }
  };

  const handleAddVariant = () => {
    const unselectedVariants = availableVariants.filter(
      (v) => !formData.selectedVariants.includes(v)
    );
    if (unselectedVariants.length > 0) {
      handleVariantSelection(unselectedVariants[0], true);
    }
  };

  const handleRemoveVariant = (variant: string) => {
    handleVariantSelection(variant, false);
  };

  const handleSelectAllVariants = () => {
    setFormData((prev) => ({
      ...prev,
      selectedVariants: [...availableVariants],
    }));
    // Clear variant selection error if it exists
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors.selectedVariants;
      return newErrors;
    });
  };

  const handleClearAllVariants = () => {
    setFormData((prev) => ({
      ...prev,
      selectedVariants: [],
    }));
  };

  const handleClearForm = () => {
    const defaultVariants: Record<string, PromoVariantData> = {};
    availableVariants.forEach((variant) => {
      defaultVariants[variant] = {
        retailPrice: latestSoldPriceToYous[variant] || '',
        unitsAvailable: '',
        baseCPU: latestCPUs[variant] || '0', // Default to "0" instead of empty
        productionCPU: latestLaborCosts[variant] || '0', // Default to "0" instead of empty
      };
    });

    setFormData({
      promoName: '',
      retailerName: '',
      promoStartDate: '',
      promoEndDate: '',
      storeSalePercentage: '',
      producerPaybackPercentage: '',
      demoHoursEntries: [],
      selectedVariants: [],
      variants: defaultVariants,
    });
    setErrors({});

    // Notify parent to clear analysis results
    if (onClear) {
      onClear();
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form} noValidate>
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>Promo Details</h3>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleClearForm}
            className={styles.clearButton}
          >
            Clear Data
          </Button>
        </div>

        <div className={styles.row}>
          <Input
            label="Promo Name"
            type="text"
            value={formData.promoName}
            onChange={(e) => handleChange('promoName', e.target.value)}
            error={errors.promoName}
            required
            fullWidth
            helperText="Give this promo a memorable name"
          />
          <Input
            label="Retailer Name"
            type="text"
            value={formData.retailerName}
            onChange={(e) => handleChange('retailerName', e.target.value)}
            error={errors.retailerName}
            required
            fullWidth
            helperText="Which retailer is running this?"
          />
          <Input
            label="Promo Start Date"
            type="date"
            value={formData.promoStartDate}
            onChange={(e) => handleChange('promoStartDate', e.target.value)}
            onBlur={(e) => handleDateBlur('promoStartDate', e.target.value)}
            error={errors.promoStartDate}
            required
            fullWidth
          />
          <Input
            label="Promo End Date"
            type="date"
            value={formData.promoEndDate}
            onChange={(e) => handleChange('promoEndDate', e.target.value)}
            onBlur={(e) => handleDateBlur('promoEndDate', e.target.value)}
            error={errors.promoEndDate}
            required
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

        <div className={styles.demoHoursSection}>
          <h4 className={styles.demoHoursTitle}>Demo Labor (Optional)</h4>
          <p className={styles.demoHoursDescription}>
            Track labor for demos. Add multiple entries if you and employees will be doing demos.
            <br />
            <span className={styles.tipText}>💡 Tip: You can type math like "5*4" in the hours field and press Enter to calculate.</span>
          </p>
          {formData.demoHoursEntries.length > 0 && (
            <div className={styles.demoEntriesList}>
              {formData.demoHoursEntries.map((entry, index) => (
                <fieldset key={entry.id} className={styles.demoEntryCard}>
                  <legend className={styles.demoEntryLegend}>
                    Demo Labor Entry {index + 1}
                  </legend>
                  <button
                    type="button"
                    onClick={() => handleRemoveDemoEntry(entry.id)}
                    className={styles.removeButton}
                    aria-label={`Remove demo entry ${index + 1}${entry.roleName ? ': ' + entry.roleName : ''}`}
                  >
                    ✕
                  </button>
                  <div className={styles.demoEntryFields}>
                    <div className={styles.demoEntryRow}>
                      <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#4b006e' }}>
                          Role
                        </label>
                        <select
                          value={entry.roleId}
                          onChange={(e) => handleRoleChange(entry.id, e.target.value, index)}
                          style={{
                            width: '100%',
                            padding: '0.625rem 0.875rem',
                            background: '#E5F6DF',
                            border: errors[`demoEntry_${index}_role`] ? '2px solid #ef4444' : '2px solid #D4AF37',
                            borderRadius: '6px',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            color: '#475569',
                            cursor: 'pointer',
                          }}
                        >
                          <option value="">-- Select Role --</option>
                          {laborRoles.map(role => (
                            <option key={role.id} value={role.id}>
                              {role.role_name}
                            </option>
                          ))}
                          <option value="custom">Custom</option>
                        </select>
                        {errors[`demoEntry_${index}_role`] && (
                          <p style={{ color: '#ef4444', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                            {errors[`demoEntry_${index}_role`]}
                          </p>
                        )}
                      </div>
                      <Input
                        label="Hours"
                        type="text"
                        value={entry.hours}
                        onChange={(e) => handleDemoEntryChange(entry.id, 'hours', e.target.value, index)}
                        onBlur={(e) => handleDemoHoursBlur(entry.id, e.target.value)}
                        error={errors[`demoEntry_${index}_hours`]}
                        fullWidth
                      />
                      <Input
                        label="Hourly Rate"
                        type="number"
                        step="0.01"
                        min="0"
                        value={entry.hourlyRate}
                        onChange={(e) => handleDemoEntryChange(entry.id, 'hourlyRate', e.target.value, index)}
                        error={errors[`demoEntry_${index}_rate`]}
                        fullWidth
                      />
                    </div>
                    <div className={styles.costTypeSelector}>
                      <label className={styles.costTypeLabel}>Cost Type:</label>
                      <div className={styles.radioGroup}>
                        <label className={styles.radioLabel}>
                          <input
                            type="radio"
                            name={`costType_${entry.id}`}
                            value="actual"
                            checked={entry.costType === 'actual'}
                            onChange={() => handleDemoEntryChange(entry.id, 'costType', 'actual', index)}
                          />
                          <span>Actual Cost (paid helping hands)</span>
                        </label>
                        <label className={styles.radioLabel}>
                          <input
                            type="radio"
                            name={`costType_${entry.id}`}
                            value="opportunity"
                            checked={entry.costType === 'opportunity'}
                            onChange={() => handleDemoEntryChange(entry.id, 'costType', 'opportunity', index)}
                          />
                          <span>Sweat Equity (owner's time)</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </fieldset>
              ))}
            </div>
          )}
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={handleAddDemoEntry}
            className={styles.addDemoButton}
          >
            ✨ Add Demo Warrior
          </Button>
        </div>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Select Products Included in this Promotion</h3>
        {errors.selectedVariants && (
          <div className={styles.errorMessage}>{errors.selectedVariants}</div>
        )}
        <div className={styles.productSelector} ref={productSelectorRef}>
          <button
            type="button"
            ref={productButtonRef}
            className={styles.productDropdown}
            onClick={() => setShowProductSelector(!showProductSelector)}
            aria-expanded={showProductSelector}
            aria-haspopup="menu"
          >
            <span>
              {formData.selectedVariants.length === 0
                ? 'No Products Selected'
                : formData.selectedVariants.length === availableVariants.length
                ? 'All Products Selected'
                : `${formData.selectedVariants.length} Product${formData.selectedVariants.length === 1 ? '' : 's'} Selected`}
            </span>
            <span aria-hidden="true">{showProductSelector ? '▲' : '▼'}</span>
          </button>

          {showProductSelector && (
            <div
              ref={productDropdownRef}
              className={styles.productDropdownMenu}
              role="menu"
              style={{
                top: `${dropdownPosition.top}px`,
                left: `${dropdownPosition.left}px`,
                width: `${dropdownPosition.width}px`,
                maxHeight: `${dropdownPosition.maxHeight}px`,
              }}
            >
              {/* Select All / Clear All */}
              <div className={styles.productDropdownActions}>
                <button
                  type="button"
                  onClick={handleSelectAllVariants}
                  className={styles.selectAllButton}
                  aria-label="Select all products"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={handleClearAllVariants}
                  className={styles.clearAllButton}
                  aria-label="Clear all product selections"
                >
                  Clear All
                </button>
              </div>

              {/* Product List */}
              {availableVariants.map((variant) => (
                <label
                  key={variant}
                  className={styles.productCheckboxLabel}
                >
                  <input
                    type="checkbox"
                    checked={formData.selectedVariants.includes(variant)}
                    onChange={(e) => {
                      handleVariantSelection(variant, e.target.checked);
                    }}
                    aria-label={`Select ${variant}`}
                  />
                  <span>{variant}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        {formData.selectedVariants.length > 0 && (
          <div className={styles.selectedProductsList}>
            <h4 className={styles.selectedProductsTitle}>Selected Products ({formData.selectedVariants.length}):</h4>
            <div className={styles.selectedProductsGrid}>
              {formData.selectedVariants.map((variant) => (
                <div key={variant} className={styles.selectedProductChip}>
                  <span className={styles.productChipLabel}>{variant}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveVariant(variant)}
                    className={styles.removeChipButton}
                    aria-label={`Remove ${variant} from selection`}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Product Details</h3>
        <p className={styles.sectionDescription}>
          Enter pricing and availability for selected products. Base CPUs (materials) and Production CPUs (labor) are pre-filled from your latest data.
        </p>

        {formData.selectedVariants.map((variant) => (
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
                helperText={
                  latestSoldPriceToYous[variant] && formData.variants[variant]?.retailPrice === latestSoldPriceToYous[variant]
                    ? "Auto-filled from product Selling Price (editable)"
                    : "Price customers pay (before promo discount)"
                }
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
                helperText="Material cost per unit (from latest invoice)"
              />
              <Input
                label="Production CPU"
                type="number"
                step="0.01"
                min="0"
                value={formData.variants[variant]?.productionCPU || ''}
                onChange={(e) => handleVariantChange(variant, 'productionCPU', e.target.value)}
                error={errors[`variant_${variant}_productionCPU`]}
                fullWidth
                helperText={
                  latestLaborCosts[variant] && formData.variants[variant]?.productionCPU === latestLaborCosts[variant]
                    ? "Auto-filled from product labor costs (editable)"
                    : "Production labor cost per unit"
                }
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
          className={styles.analyzeButton}
        >
          {initialData ? 'Update Analysis' : 'Analyze Promo'}
        </Button>
      </div>
    </form>
  );
}
