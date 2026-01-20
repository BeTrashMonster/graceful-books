/**
 * Goal Creation Wizard Component
 *
 * Multi-step wizard for creating financial goals with templates
 *
 * Features:
 * - 5 goal type templates (revenue, profit, runway, savings, custom)
 * - Target amount and deadline input
 * - Required monthly progress preview
 * - Personal note (optional)
 * - Validation and error handling
 *
 * WCAG 2.1 AA Compliant:
 * - Keyboard navigation
 * - Form labels and error messages
 * - Clear step indicators
 * - Accessible validation feedback
 */

import React, { useState } from 'react';
import Decimal from 'decimal.js';
import type { GoalType, GoalPeriod, GoalTemplate, CreateGoalRequest } from '../../types/goals.types';
import styles from './GoalCreationWizard.module.css';

interface GoalCreationWizardProps {
  companyId: string;
  onComplete: (goal: CreateGoalRequest) => void;
  onCancel: () => void;
}

// Goal templates
const GOAL_TEMPLATES: GoalTemplate[] = [
  {
    type: 'revenue',
    name: 'Revenue Goal',
    description: 'Track progress toward a revenue target',
    default_period: 'annual',
    placeholder_target: '100000',
    help_text: 'How much revenue do you want to generate?',
    icon: 'trending-up',
    example: 'e.g., "Reach $100k in annual revenue"',
  },
  {
    type: 'profit',
    name: 'Profit Goal',
    description: 'Track progress toward a profitability target',
    default_period: 'annual',
    placeholder_target: '25000',
    help_text: 'How much net profit do you want to achieve?',
    icon: 'dollar-sign',
    example: 'e.g., "Achieve $25k in annual profit"',
  },
  {
    type: 'runway',
    name: 'Runway Goal',
    description: 'Build enough cash reserves to extend runway',
    default_period: 'one-time',
    placeholder_target: '12',
    help_text: 'How many months of runway do you want?',
    icon: 'clock',
    example: 'e.g., "Reach 12 months of runway"',
  },
  {
    type: 'savings',
    name: 'Savings Goal',
    description: 'Build cash reserves or emergency fund',
    default_period: 'one-time',
    placeholder_target: '50000',
    help_text: 'How much do you want to save?',
    icon: 'piggy-bank',
    example: 'e.g., "Save $50k emergency fund"',
  },
  {
    type: 'custom',
    name: 'Custom Goal',
    description: 'Track any other financial metric',
    default_period: 'one-time',
    placeholder_target: '100',
    help_text: 'What custom metric do you want to track?',
    icon: 'target',
    example: 'e.g., "Reduce AR by 30 days"',
  },
];

export const GoalCreationWizard: React.FC<GoalCreationWizardProps> = ({
  companyId,
  onComplete,
  onCancel,
}) => {
  const [step, setStep] = useState<'template' | 'details' | 'preview'>('template');
  const [selectedType, setSelectedType] = useState<GoalType | null>(null);
  const [goalName, setGoalName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [period, setPeriod] = useState<GoalPeriod>('annual');
  const [personalNote, setPersonalNote] = useState('');
  const [customMetricName, setCustomMetricName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedTemplate = GOAL_TEMPLATES.find((t) => t.type === selectedType);

  // Calculate required monthly progress
  const calculateRequiredMonthly = (): string | null => {
    if (!targetAmount || !deadline) return null;

    try {
      const target = new Decimal(targetAmount);
      const deadlineDate = new Date(deadline).getTime();
      const now = Date.now();
      const daysRemaining = Math.ceil((deadlineDate - now) / (1000 * 60 * 60 * 24));
      const monthsRemaining = daysRemaining / 30;

      if (monthsRemaining <= 0) return null;

      const monthlyAmount = target.dividedBy(monthsRemaining);

      if (selectedType === 'runway') {
        return `${monthlyAmount.toFixed(1)} months per month`;
      }

      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(monthlyAmount.toNumber());
    } catch {
      return null;
    }
  };

  // Validate form
  const validateDetails = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!goalName.trim()) {
      newErrors.goalName = 'Goal name is required';
    }

    if (!targetAmount || isNaN(parseFloat(targetAmount)) || parseFloat(targetAmount) <= 0) {
      newErrors.targetAmount = 'Please enter a valid target amount greater than 0';
    }

    if (!deadline) {
      newErrors.deadline = 'Deadline is required';
    } else {
      const deadlineDate = new Date(deadline);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (deadlineDate < today) {
        newErrors.deadline = 'Deadline must be in the future';
      }
    }

    if (selectedType === 'custom' && !customMetricName.trim()) {
      newErrors.customMetricName = 'Custom metric name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle template selection
  const handleTemplateSelect = (type: GoalType) => {
    const template = GOAL_TEMPLATES.find((t) => t.type === type);
    if (template) {
      setSelectedType(type);
      setPeriod(template.default_period);
      setGoalName(template.name);
      setTargetAmount(template.placeholder_target);
      setStep('details');
    }
  };

  // Handle details submission
  const handleDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateDetails()) {
      return;
    }

    setStep('preview');
  };

  // Handle final submission
  const handleFinalSubmit = () => {
    if (!selectedType) return;

    const request: CreateGoalRequest = {
      company_id: companyId,
      name: goalName,
      type: selectedType,
      period,
      target_amount: targetAmount,
      deadline: new Date(deadline).getTime(),
      personal_note: personalNote || undefined,
      custom_metric_name: selectedType === 'custom' ? customMetricName : undefined,
      custom_metric_formula: selectedType === 'custom' ? 'manual' : undefined,
    };

    onComplete(request);
  };

  return (
    <div className={styles.wizard} role="dialog" aria-labelledby="wizard-title">
      {/* Header */}
      <div className={styles.wizardHeader}>
        <h2 id="wizard-title" className={styles.wizardTitle}>
          Create Financial Goal
        </h2>

        {/* Step indicator */}
        <div className={styles.stepIndicator} role="navigation" aria-label="Progress">
          <div className={`${styles.stepDot} ${step === 'template' ? styles.active : styles.completed}`} aria-label="Step 1: Choose template" />
          <div className={styles.stepLine} />
          <div className={`${styles.stepDot} ${step === 'details' ? styles.active : step === 'preview' ? styles.completed : ''}`} aria-label="Step 2: Enter details" />
          <div className={styles.stepLine} />
          <div className={`${styles.stepDot} ${step === 'preview' ? styles.active : ''}`} aria-label="Step 3: Preview" />
        </div>
      </div>

      {/* Step 1: Template Selection */}
      {step === 'template' && (
        <div className={styles.stepContent}>
          <h3 className={styles.stepTitle}>Choose your goal type</h3>
          <p className={styles.stepDescription}>
            Select the type of financial goal you want to track. You can customize it in the next step.
          </p>

          <div className={styles.templateGrid}>
            {GOAL_TEMPLATES.map((template) => (
              <button
                key={template.type}
                className={styles.templateCard}
                onClick={() => handleTemplateSelect(template.type)}
                aria-label={`Select ${template.name}: ${template.description}`}
              >
                <div className={styles.templateIcon}>
                  <i className={`icon-${template.icon}`} aria-hidden="true" />
                </div>
                <h4 className={styles.templateName}>{template.name}</h4>
                <p className={styles.templateDescription}>{template.description}</p>
                <p className={styles.templateExample}>{template.example}</p>
              </button>
            ))}
          </div>

          <div className={styles.wizardActions}>
            <button type="button" onClick={onCancel} className={styles.cancelButton}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Details */}
      {step === 'details' && selectedTemplate && (
        <form className={styles.stepContent} onSubmit={handleDetailsSubmit}>
          <h3 className={styles.stepTitle}>{selectedTemplate.name} Details</h3>
          <p className={styles.stepDescription}>{selectedTemplate.help_text}</p>

          {/* Goal name */}
          <div className={styles.formGroup}>
            <label htmlFor="goal-name" className={styles.formLabel}>
              Goal Name <span className={styles.required}>*</span>
            </label>
            <input
              type="text"
              id="goal-name"
              className={styles.formInput}
              value={goalName}
              onChange={(e) => setGoalName(e.target.value)}
              placeholder="e.g., Q1 Revenue Target"
              aria-required="true"
              aria-invalid={!!errors.goalName}
              aria-describedby={errors.goalName ? 'goal-name-error' : undefined}
            />
            {errors.goalName && (
              <p id="goal-name-error" className={styles.errorMessage} role="alert">
                {errors.goalName}
              </p>
            )}
          </div>

          {/* Custom metric name (for custom goals) */}
          {selectedType === 'custom' && (
            <div className={styles.formGroup}>
              <label htmlFor="custom-metric" className={styles.formLabel}>
                Metric Name <span className={styles.required}>*</span>
              </label>
              <input
                type="text"
                id="custom-metric"
                className={styles.formInput}
                value={customMetricName}
                onChange={(e) => setCustomMetricName(e.target.value)}
                placeholder="e.g., Days Sales Outstanding"
                aria-required="true"
                aria-invalid={!!errors.customMetricName}
                aria-describedby={errors.customMetricName ? 'custom-metric-error' : undefined}
              />
              {errors.customMetricName && (
                <p id="custom-metric-error" className={styles.errorMessage} role="alert">
                  {errors.customMetricName}
                </p>
              )}
            </div>
          )}

          {/* Target amount */}
          <div className={styles.formGroup}>
            <label htmlFor="target-amount" className={styles.formLabel}>
              Target {selectedType === 'runway' ? 'Months' : 'Amount'} <span className={styles.required}>*</span>
            </label>
            <div className={styles.inputWithPrefix}>
              {selectedType !== 'runway' && selectedType !== 'custom' && (
                <span className={styles.inputPrefix}>$</span>
              )}
              <input
                type="number"
                id="target-amount"
                className={`${styles.formInput} ${(selectedType !== 'runway' && selectedType !== 'custom') ? styles.withPrefix : ''}`}
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                placeholder={selectedTemplate.placeholder_target}
                step={selectedType === 'runway' ? '0.1' : '1'}
                min="0"
                aria-required="true"
                aria-invalid={!!errors.targetAmount}
                aria-describedby={errors.targetAmount ? 'target-amount-error' : undefined}
              />
            </div>
            {errors.targetAmount && (
              <p id="target-amount-error" className={styles.errorMessage} role="alert">
                {errors.targetAmount}
              </p>
            )}
          </div>

          {/* Deadline */}
          <div className={styles.formGroup}>
            <label htmlFor="deadline" className={styles.formLabel}>
              Deadline <span className={styles.required}>*</span>
            </label>
            <input
              type="date"
              id="deadline"
              className={styles.formInput}
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              aria-required="true"
              aria-invalid={!!errors.deadline}
              aria-describedby={errors.deadline ? 'deadline-error' : undefined}
            />
            {errors.deadline && (
              <p id="deadline-error" className={styles.errorMessage} role="alert">
                {errors.deadline}
              </p>
            )}
          </div>

          {/* Personal note (optional) */}
          <div className={styles.formGroup}>
            <label htmlFor="personal-note" className={styles.formLabel}>
              Personal Note (Optional)
            </label>
            <textarea
              id="personal-note"
              className={styles.formTextarea}
              value={personalNote}
              onChange={(e) => setPersonalNote(e.target.value)}
              placeholder="Why does this goal matter to you?"
              rows={3}
            />
            <p className={styles.helpText}>A reminder of why this goal is important to you.</p>
          </div>

          {/* Actions */}
          <div className={styles.wizardActions}>
            <button
              type="button"
              onClick={() => setStep('template')}
              className={styles.backButton}
            >
              Back
            </button>
            <button type="submit" className={styles.nextButton}>
              Next: Preview
            </button>
          </div>
        </form>
      )}

      {/* Step 3: Preview */}
      {step === 'preview' && selectedTemplate && (
        <div className={styles.stepContent}>
          <h3 className={styles.stepTitle}>Review Your Goal</h3>
          <p className={styles.stepDescription}>
            Here's what you'll need to reach your goal. Everything look good?
          </p>

          {/* Preview card */}
          <div className={styles.previewCard}>
            <div className={styles.previewRow}>
              <span className={styles.previewLabel}>Goal Type:</span>
              <span className={styles.previewValue}>{selectedTemplate.name}</span>
            </div>

            <div className={styles.previewRow}>
              <span className={styles.previewLabel}>Goal Name:</span>
              <span className={styles.previewValue}>{goalName}</span>
            </div>

            {selectedType === 'custom' && (
              <div className={styles.previewRow}>
                <span className={styles.previewLabel}>Metric:</span>
                <span className={styles.previewValue}>{customMetricName}</span>
              </div>
            )}

            <div className={styles.previewRow}>
              <span className={styles.previewLabel}>Target:</span>
              <span className={styles.previewValue}>
                {selectedType === 'runway'
                  ? `${targetAmount} months`
                  : selectedType === 'custom'
                  ? targetAmount
                  : new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: 'USD',
                      minimumFractionDigits: 0,
                    }).format(parseFloat(targetAmount))}
              </span>
            </div>

            <div className={styles.previewRow}>
              <span className={styles.previewLabel}>Deadline:</span>
              <span className={styles.previewValue}>
                {new Date(deadline).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </div>

            {personalNote && (
              <div className={styles.previewRow}>
                <span className={styles.previewLabel}>Personal Note:</span>
                <span className={styles.previewValue}>{personalNote}</span>
              </div>
            )}
          </div>

          {/* Required monthly progress */}
          {calculateRequiredMonthly() && (
            <div className={styles.monthlyPreview}>
              <i className="icon-info" aria-hidden="true" />
              <div>
                <p className={styles.monthlyLabel}>Required Monthly Progress</p>
                <p className={styles.monthlyValue}>
                  To reach {goalName} by {new Date(deadline).toLocaleDateString()}, you need{' '}
                  <strong>{calculateRequiredMonthly()}</strong> on average.
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className={styles.wizardActions}>
            <button
              type="button"
              onClick={() => {
                setErrors({});
                setStep('details');
              }}
              className={styles.backButton}
            >
              Back
            </button>
            <button type="button" onClick={handleFinalSubmit} className={styles.submitButton}>
              Create Goal
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
