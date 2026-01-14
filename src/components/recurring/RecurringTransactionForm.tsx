/**
 * RecurringTransactionForm Component
 *
 * Form for creating and editing recurring transactions.
 *
 * Requirements:
 * - E2: Recurring Transactions [MVP]
 * - Frequency options (weekly, bi-weekly, monthly, quarterly, annually)
 * - Auto-create vs. draft-for-approval option
 * - End date options (specific date, after N occurrences, never)
 */

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Input } from '../forms/Input';
import { Label } from '../forms/Label';
import { Button } from '../core/Button';
import { Radio } from '../forms/Radio';
import { getRecurrencePreview, getRecurrenceDescription } from '../../services/recurrence.service';
import { logger } from '../../utils/logger';
import type {
  RecurrenceRule,
  RecurrenceFrequency,
  RecurrenceEndType,
  AutoCreationMode,
  TransactionTemplate,
  RecurrencePreview,
} from '../../types/recurring.types';

export interface RecurringTransactionFormProps {
  initialName?: string;
  initialRule?: RecurrenceRule;
  initialTemplate?: TransactionTemplate;
  initialAutoCreationMode?: AutoCreationMode;
  onSubmit: (
    name: string,
    rule: RecurrenceRule,
    template: TransactionTemplate,
    autoCreationMode: AutoCreationMode
  ) => void;
  onCancel: () => void;
  isLoading?: boolean;
  error?: string;
}

export function RecurringTransactionForm({
  initialName = '',
  initialRule,
  initialTemplate,
  initialAutoCreationMode = 'DRAFT',
  onSubmit,
  onCancel,
  isLoading = false,
  error,
}: RecurringTransactionFormProps) {
  // Form state
  const [name, setName] = useState(initialName);
  const [frequency, setFrequency] = useState<RecurrenceFrequency>(
    initialRule?.frequency || 'MONTHLY'
  );
  const [interval, setInterval] = useState(initialRule?.interval || 1);
  const [startDate, setStartDate] = useState(
    initialRule?.startDate
      ? format(new Date(initialRule.startDate), 'yyyy-MM-dd')
      : format(new Date(), 'yyyy-MM-dd')
  );
  const [endType, setEndType] = useState<RecurrenceEndType>(initialRule?.endType || 'NEVER');
  const [endDate, setEndDate] = useState(
    initialRule?.endDate ? format(new Date(initialRule.endDate), 'yyyy-MM-dd') : ''
  );
  const [occurrenceCount, setOccurrenceCount] = useState(initialRule?.occurrenceCount || 12);
  const [dayOfMonth, setDayOfMonth] = useState(initialRule?.dayOfMonth || 1);
  const [autoCreationMode, setAutoCreationMode] = useState<AutoCreationMode>(
    initialAutoCreationMode
  );

  // Preview state
  const [preview, setPreview] = useState<RecurrencePreview | null>(null);
  const [description, setDescription] = useState<string>('');

  // Validation error state
  const [validationError, setValidationError] = useState<string>('');

  // Update preview whenever rule changes
  useEffect(() => {
    try {
      const rule = buildRecurrenceRule();
      const newPreview = getRecurrencePreview(rule, 5);
      const newDescription = getRecurrenceDescription(rule);
      setPreview(newPreview);
      setDescription(newDescription);
    } catch (error) {
      logger.error('Error generating recurrence preview', { error });
      setPreview(null);
      setDescription('Invalid recurrence rule');
    }
  }, [frequency, interval, startDate, endType, endDate, occurrenceCount, dayOfMonth]);

  const buildRecurrenceRule = (): RecurrenceRule => {
    const rule: RecurrenceRule = {
      frequency,
      interval,
      startDate: new Date(startDate).getTime(),
      endType,
    };

    if (endType === 'ON_DATE' && endDate) {
      rule.endDate = new Date(endDate).getTime();
    }

    if (endType === 'AFTER_COUNT') {
      rule.occurrenceCount = occurrenceCount;
    }

    // Add day of month for monthly/quarterly/annually
    if (frequency === 'MONTHLY' || frequency === 'QUARTERLY' || frequency === 'ANNUALLY') {
      rule.dayOfMonth = dayOfMonth;
    }

    return rule;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Clear any previous validation errors
    setValidationError('');

    if (!name.trim()) {
      setValidationError("Let's add a name for this recurring transaction. This helps you identify it later when reviewing your recurring transactions.");
      return;
    }

    if (!initialTemplate) {
      setValidationError("We need a transaction template to create this recurring transaction. Please go back and set up the transaction details first.");
      return;
    }

    const rule = buildRecurrenceRule();

    onSubmit(name, rule, initialTemplate, autoCreationMode);
  };

  const frequencyOptions: Array<{ value: RecurrenceFrequency; label: string }> = [
    { value: 'WEEKLY', label: 'Weekly' },
    { value: 'BI_WEEKLY', label: 'Bi-weekly (Every 2 weeks)' },
    { value: 'MONTHLY', label: 'Monthly' },
    { value: 'QUARTERLY', label: 'Quarterly (Every 3 months)' },
    { value: 'ANNUALLY', label: 'Annually' },
  ];

  return (
    <form onSubmit={handleSubmit} className="recurring-transaction-form" style={{ maxWidth: '800px' }}>
      <h2>Create Recurring Transaction</h2>

      {error && (
        <div style={{ padding: '12px', marginBottom: '16px', backgroundColor: '#fee', border: '1px solid #fcc', borderRadius: '4px', color: '#c00' }}>
          {error}
        </div>
      )}

      {validationError && (
        <div style={{ padding: '12px', marginBottom: '16px', backgroundColor: '#fef3cd', border: '1px solid #f6e58d', borderRadius: '4px', color: '#856404' }}>
          {validationError}
        </div>
      )}

      {/* Name */}
      <div style={{ marginBottom: '20px' }}>
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Monthly Office Rent"
          required
          disabled={isLoading}
        />
        <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '4px' }}>
          Give this recurring transaction a descriptive name
        </p>
      </div>

      {/* Frequency */}
      <div style={{ marginBottom: '20px' }}>
        <Label htmlFor="frequency">Frequency</Label>
        <select
          id="frequency"
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as RecurrenceFrequency)}
          disabled={isLoading}
          style={{ padding: '8px', width: '100%', fontSize: '1rem', borderRadius: '4px', border: '1px solid #ccc' }}
        >
          {frequencyOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Interval (for custom frequencies) */}
      {frequency !== 'BI_WEEKLY' && frequency !== 'QUARTERLY' && (
        <div style={{ marginBottom: '20px' }}>
          <Label htmlFor="interval">Every</Label>
          <Input
            id="interval"
            type="number"
            min="1"
            max="99"
            value={interval}
            onChange={(e) => setInterval(parseInt(e.target.value, 10))}
            disabled={isLoading}
          />
          <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '4px' }}>
            Repeat every {interval} {frequency === 'WEEKLY' ? 'week(s)' : frequency === 'MONTHLY' ? 'month(s)' : 'year(s)'}
          </p>
        </div>
      )}

      {/* Day of Month (for monthly/quarterly/annually) */}
      {(frequency === 'MONTHLY' || frequency === 'QUARTERLY' || frequency === 'ANNUALLY') && (
        <div style={{ marginBottom: '20px' }}>
          <Label htmlFor="dayOfMonth">Day of Month</Label>
          <Input
            id="dayOfMonth"
            type="number"
            min="1"
            max="31"
            value={dayOfMonth}
            onChange={(e) => setDayOfMonth(parseInt(e.target.value, 10))}
            disabled={isLoading}
          />
          <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '4px' }}>
            For months with fewer days, the last day of the month will be used
          </p>
        </div>
      )}

      {/* Start Date */}
      <div style={{ marginBottom: '20px' }}>
        <Label htmlFor="startDate">Start Date</Label>
        <Input
          id="startDate"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          required
          disabled={isLoading}
        />
        <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '4px' }}>
          When should this recurring transaction start?
        </p>
      </div>

      {/* End Type */}
      <div style={{ marginBottom: '20px' }}>
        <Label>Ends</Label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Radio
            id="end-never"
            name="endType"
            value="NEVER"
            checked={endType === 'NEVER'}
            onChange={() => setEndType('NEVER')}
            label="Never"
            disabled={isLoading}
          />
          <Radio
            id="end-on-date"
            name="endType"
            value="ON_DATE"
            checked={endType === 'ON_DATE'}
            onChange={() => setEndType('ON_DATE')}
            label="On a specific date"
            disabled={isLoading}
          />
          {endType === 'ON_DATE' && (
            <div style={{ marginLeft: '28px' }}>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                required
                disabled={isLoading}
              />
            </div>
          )}
          <Radio
            id="end-after-count"
            name="endType"
            value="AFTER_COUNT"
            checked={endType === 'AFTER_COUNT'}
            onChange={() => setEndType('AFTER_COUNT')}
            label="After a number of occurrences"
            disabled={isLoading}
          />
          {endType === 'AFTER_COUNT' && (
            <div style={{ marginLeft: '28px' }}>
              <Input
                id="occurrenceCount"
                type="number"
                min="1"
                max="999"
                value={occurrenceCount}
                onChange={(e) => setOccurrenceCount(parseInt(e.target.value, 10))}
                required
                disabled={isLoading}
              />
              <span style={{ marginLeft: '8px' }}>occurrences</span>
            </div>
          )}
        </div>
      </div>

      {/* Auto-Creation Mode */}
      <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
        <Label>Creation Mode</Label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Radio
            id="mode-draft"
            name="autoCreationMode"
            value="DRAFT"
            checked={autoCreationMode === 'DRAFT'}
            onChange={() => setAutoCreationMode('DRAFT')}
            label="Create as drafts for approval"
            disabled={isLoading}
          />
          <p style={{ fontSize: '0.875rem', color: '#666', marginLeft: '28px', marginTop: '-8px' }}>
            Transactions will be created as drafts that you can review before posting
          </p>
          <Radio
            id="mode-auto"
            name="autoCreationMode"
            value="AUTO"
            checked={autoCreationMode === 'AUTO'}
            onChange={() => setAutoCreationMode('AUTO')}
            label="Automatically post transactions"
            disabled={isLoading}
          />
          <p style={{ fontSize: '0.875rem', color: '#666', marginLeft: '28px', marginTop: '-8px' }}>
            Transactions will be automatically posted without review
          </p>
        </div>
      </div>

      {/* Preview */}
      {preview && preview.dates.length > 0 && (
        <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#f0f8ff', borderRadius: '4px', border: '1px solid #b0d8ff' }}>
          <h3 style={{ marginTop: 0 }}>Preview</h3>
          <p style={{ fontWeight: 'bold', marginBottom: '12px' }}>{description}</p>
          <p style={{ marginBottom: '8px', fontWeight: '500' }}>Next {preview.count} occurrences:</p>
          <ul style={{ marginLeft: '20px', marginBottom: 0 }}>
            {preview.dates.map((date, index) => (
              <li key={index}>{format(new Date(date), 'MMMM d, yyyy')}</li>
            ))}
          </ul>
          {preview.hasMore && (
            <p style={{ marginTop: '8px', fontSize: '0.875rem', color: '#666' }}>
              ... and more
            </p>
          )}
        </div>
      )}

      {/* Joy Opportunity Message */}
      <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#f0fff0', borderRadius: '4px', border: '1px solid #90ee90' }}>
        <p style={{ margin: 0, fontSize: '1rem', color: '#2d5016' }}>
          🎉 <strong>Set it and forget it!</strong> This transaction will record itself.
        </p>
      </div>

      {/* Form Actions */}
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
        <Button type="button" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading || !name.trim()}>
          {isLoading ? 'Creating...' : 'Create Recurring Transaction'}
        </Button>
      </div>
    </form>
  );
}
