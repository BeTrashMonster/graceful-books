/**
 * CharityVerificationForm Component
 *
 * Form for adding and verifying charities with 5-step workflow:
 * 1. Initial submission
 * 2. EIN format validation (automated)
 * 3. IRS 501(c)(3) verification (manual)
 * 4. Website & mission verification (manual)
 * 5. Final approval
 *
 * Requirements:
 * - IC3: Admin Panel - Charity Management
 * - WCAG 2.1 AA compliant
 */

import { useState, FormEvent } from 'react';
import type { CharityCategory } from '../../types/database.types';
import {
  createCharity,
  validateEINFormat,
  type CreateCharityInput,
} from '../../services/admin/charity.service';
import styles from './CharityVerificationForm.module.css';

interface CharityVerificationFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const CHARITY_CATEGORIES: { value: CharityCategory; label: string }[] = [
  { value: 'EDUCATION', label: 'Education' },
  { value: 'ENVIRONMENT', label: 'Environment' },
  { value: 'HEALTH', label: 'Health' },
  { value: 'POVERTY', label: 'Poverty Relief' },
  { value: 'ANIMAL_WELFARE', label: 'Animal Welfare' },
  { value: 'HUMAN_RIGHTS', label: 'Human Rights' },
  { value: 'DISASTER_RELIEF', label: 'Disaster Relief' },
  { value: 'ARTS_CULTURE', label: 'Arts & Culture' },
  { value: 'COMMUNITY', label: 'Community Development' },
  { value: 'OTHER', label: 'Other' },
];

export function CharityVerificationForm({ onSuccess, onCancel }: CharityVerificationFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    ein: '',
    description: '',
    category: '' | '',
    website: '',
    logo: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Handle input changes
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  // Validate EIN on blur
  const handleEINBlur = () => {
    if (!formData.ein) return;

    const validation = validateEINFormat(formData.ein);
    if (!validation.valid) {
      setErrors(prev => ({ ...prev, ein: validation.error || 'Invalid EIN format' }));
    }
  };

  // Validate form
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Charity name is required';
    }

    if (!formData.ein.trim()) {
      newErrors.ein = 'EIN is required';
    } else {
      const validation = validateEINFormat(formData.ein);
      if (!validation.valid) {
        newErrors.ein = validation.error || 'Invalid EIN format';
      }
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    } else if (formData.description.length < 20) {
      newErrors.description = 'Description must be at least 20 characters';
    }

    if (!formData.category) {
      newErrors.category = 'Category is required';
    }

    if (!formData.website.trim()) {
      newErrors.website = 'Website is required';
    } else {
      try {
        new URL(formData.website);
      } catch {
        newErrors.website = 'Please enter a valid URL (e.g., https://example.org)';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // TODO: Get actual admin user ID from auth context
      const adminUserId = 'admin-user-id';

      const input: CreateCharityInput = {
        name: formData.name,
        ein: formData.ein,
        description: formData.description,
        category: formData.category,
        website: formData.website,
        logo: formData.logo || undefined,
        createdBy: adminUserId,
      };

      await createCharity(input);
      onSuccess();
    } catch (error) {
      console.error('Error creating charity:', error);
      setSubmitError(
        error instanceof Error ? error.message : 'Failed to create charity. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.formBody}>
        {/* Step 1: Initial Submission */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>
            <span className={styles.stepNumber}>Step 1</span>
            Initial Submission
          </h3>
          <p className={styles.sectionDescription}>
            Enter the charity details. The charity will start in "Pending" status.
          </p>

          {/* Charity Name */}
          <div className={styles.formGroup}>
            <label htmlFor="name" className={styles.label}>
              Charity Name <span className={styles.required}>*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className={`${styles.input} ${errors.name ? styles.inputError : ''}`}
              aria-required="true"
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'name-error' : undefined}
              placeholder="e.g., Khan Academy"
            />
            {errors.name && (
              <span id="name-error" className={styles.errorMessage} role="alert">
                {errors.name}
              </span>
            )}
          </div>

          {/* EIN */}
          <div className={styles.formGroup}>
            <label htmlFor="ein" className={styles.label}>
              EIN (Tax ID) <span className={styles.required}>*</span>
            </label>
            <input
              type="text"
              id="ein"
              name="ein"
              value={formData.ein}
              onChange={handleChange}
              onBlur={handleEINBlur}
              className={`${styles.input} ${errors.ein ? styles.inputError : ''}`}
              aria-required="true"
              aria-invalid={!!errors.ein}
              aria-describedby={errors.ein ? 'ein-error' : 'ein-help'}
              placeholder="XX-XXXXXXX (e.g., 12-3456789)"
            />
            <span id="ein-help" className={styles.helpText}>
              Format: XX-XXXXXXX (9 digits with hyphen)
            </span>
            {errors.ein && (
              <span id="ein-error" className={styles.errorMessage} role="alert">
                {errors.ein}
              </span>
            )}
          </div>

          {/* Category */}
          <div className={styles.formGroup}>
            <label htmlFor="category" className={styles.label}>
              Category <span className={styles.required}>*</span>
            </label>
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleChange}
              className={`${styles.select} ${errors.category ? styles.inputError : ''}`}
              aria-required="true"
              aria-invalid={!!errors.category}
              aria-describedby={errors.category ? 'category-error' : undefined}
            >
              <option value="">Select a category</option>
              {CHARITY_CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
            {errors.category && (
              <span id="category-error" className={styles.errorMessage} role="alert">
                {errors.category}
              </span>
            )}
          </div>

          {/* Website */}
          <div className={styles.formGroup}>
            <label htmlFor="website" className={styles.label}>
              Website <span className={styles.required}>*</span>
            </label>
            <input
              type="url"
              id="website"
              name="website"
              value={formData.website}
              onChange={handleChange}
              className={`${styles.input} ${errors.website ? styles.inputError : ''}`}
              aria-required="true"
              aria-invalid={!!errors.website}
              aria-describedby={errors.website ? 'website-error' : undefined}
              placeholder="https://example.org"
            />
            {errors.website && (
              <span id="website-error" className={styles.errorMessage} role="alert">
                {errors.website}
              </span>
            )}
          </div>

          {/* Description */}
          <div className={styles.formGroup}>
            <label htmlFor="description" className={styles.label}>
              Mission Description <span className={styles.required}>*</span>
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={4}
              className={`${styles.textarea} ${errors.description ? styles.inputError : ''}`}
              aria-required="true"
              aria-invalid={!!errors.description}
              aria-describedby={errors.description ? 'description-error' : 'description-help'}
              placeholder="Brief description of the charity's mission (1-2 sentences)"
            />
            <span id="description-help" className={styles.helpText}>
              {formData.description.length} characters (minimum 20)
            </span>
            {errors.description && (
              <span id="description-error" className={styles.errorMessage} role="alert">
                {errors.description}
              </span>
            )}
          </div>

          {/* Logo (Optional) */}
          <div className={styles.formGroup}>
            <label htmlFor="logo" className={styles.label}>
              Logo URL (Optional)
            </label>
            <input
              type="url"
              id="logo"
              name="logo"
              value={formData.logo}
              onChange={handleChange}
              className={styles.input}
              placeholder="https://example.org/logo.png"
            />
          </div>
        </div>

        {/* Step 2: EIN Validation Info */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>
            <span className={styles.stepNumber}>Step 2</span>
            EIN Format Validation
          </h3>
          <p className={styles.sectionDescription}>
            The system will automatically validate the EIN format when you submit.
          </p>
        </div>

        {/* Step 3-5: Manual Verification Info */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>
            <span className={styles.stepNumber}>Steps 3-5</span>
            Manual Verification
          </h3>
          <p className={styles.sectionDescription}>
            After creation, you'll be able to add verification notes and approve/reject the charity
            from the charity detail view.
          </p>
          <ul className={styles.verificationSteps}>
            <li>
              <strong>Step 3:</strong> Verify 501(c)(3) status via{' '}
              <a
                href="https://apps.irs.gov/app/eos/"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.link}
              >
                IRS EOS Search
              </a>
            </li>
            <li>
              <strong>Step 4:</strong> Verify website legitimacy and mission alignment
            </li>
            <li>
              <strong>Step 5:</strong> Final approval (changes status to "Verified")
            </li>
          </ul>
        </div>

        {/* Submit Error */}
        {submitError && (
          <div className={styles.submitError} role="alert">
            {submitError}
          </div>
        )}
      </div>

      {/* Form Actions */}
      <div className={styles.formActions}>
        <button
          type="button"
          onClick={onCancel}
          className={styles.cancelButton}
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button type="submit" className={styles.submitButton} disabled={isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create Charity'}
        </button>
      </div>
    </form>
  );
}
