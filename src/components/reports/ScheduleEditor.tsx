/**
 * Schedule Editor Component
 *
 * Per I6: Scheduled Report Delivery
 * Allows users to create and edit report delivery schedules.
 */

import { useState } from 'react';
import type {
  CreateScheduleInput,
  UpdateScheduleInput,
  ReportSchedule,
  ScheduleFrequency,
  DayOfWeek,
  SchedulableReportType,
} from '../../types/scheduledReports.types';
import type { ReportExportFormat } from '../../types/reports.types';
import { Button } from '../core/Button';
import { Input } from '../forms/Input';
import { Label } from '../forms/Label';

export interface ScheduleEditorProps {
  schedule?: ReportSchedule;
  companyId: string;
  userId: string;
  onSave: (input: CreateScheduleInput | UpdateScheduleInput) => Promise<void>;
  onCancel: () => void;
  onSendTest?: (testEmail: string) => Promise<void>;
}

export function ScheduleEditor({
  schedule,
  companyId: _companyId,
  userId,
  onSave,
  onCancel,
  onSendTest,
}: ScheduleEditorProps) {
  const [reportType, setReportType] = useState<SchedulableReportType>(
    schedule?.reportType || 'profit-loss'
  );
  const [reportName, setReportName] = useState(schedule?.reportName || '');
  const [frequency, setFrequency] = useState<ScheduleFrequency>(schedule?.frequency || 'weekly');
  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeek>(schedule?.dayOfWeek || 'monday');
  const [timeOfDay, setTimeOfDay] = useState(schedule?.timeOfDay || '08:00');
  const [format, setFormat] = useState<ReportExportFormat>(schedule?.format || 'pdf');
  const [recipients, setRecipients] = useState(schedule?.recipients.join(', ') || '');
  const [testEmail, setTestEmail] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const recipientList = recipients.split(',').map((r) => r.trim()).filter(Boolean);

      if (schedule) {
        // Update
        const input: UpdateScheduleInput = {
          reportName,
          frequency,
          dayOfWeek,
          timeOfDay,
          format,
          recipients: recipientList,
        };
        await onSave(input);
      } else {
        // Create
        const input: CreateScheduleInput = {
          reportType,
          reportName,
          frequency,
          dayOfWeek,
          timeOfDay,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          recipients: recipientList,
          format,
          reportParameters: {
            dateRangeType: 'last-month',
          },
        };
        await onSave(input);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTest = async () => {
    if (!testEmail || !onSendTest) return;
    setIsSendingTest(true);
    try {
      await onSendTest(testEmail);
    } finally {
      setIsSendingTest(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Label htmlFor="reportType">Report Type</Label>
        <select
          id="reportType"
          value={reportType}
          onChange={(e) => setReportType(e.target.value as SchedulableReportType)}
          disabled={!!schedule}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          required
        >
          <option value="profit-loss">Profit & Loss</option>
          <option value="balance-sheet">Balance Sheet</option>
          <option value="cash-flow">Cash Flow</option>
          <option value="ar-aging">Accounts Receivable Aging</option>
          <option value="ap-aging">Accounts Payable Aging</option>
        </select>
      </div>

      <div>
        <Label htmlFor="reportName">Report Name</Label>
        <Input
          id="reportName"
          value={reportName}
          onChange={(e) => setReportName(e.target.value)}
          placeholder="e.g., Monthly P&L"
          required
        />
      </div>

      <div>
        <Label htmlFor="frequency">Frequency</Label>
        <select
          id="frequency"
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as ScheduleFrequency)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          required
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="yearly">Yearly</option>
        </select>
      </div>

      {frequency === 'weekly' && (
        <div>
          <Label htmlFor="dayOfWeek">Day of Week</Label>
          <select
            id="dayOfWeek"
            value={dayOfWeek}
            onChange={(e) => setDayOfWeek(e.target.value as DayOfWeek)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            required
          >
            <option value="monday">Monday</option>
            <option value="tuesday">Tuesday</option>
            <option value="wednesday">Wednesday</option>
            <option value="thursday">Thursday</option>
            <option value="friday">Friday</option>
            <option value="saturday">Saturday</option>
            <option value="sunday">Sunday</option>
          </select>
        </div>
      )}

      <div>
        <Label htmlFor="timeOfDay">Time of Day</Label>
        <Input
          id="timeOfDay"
          type="time"
          value={timeOfDay}
          onChange={(e) => setTimeOfDay(e.target.value)}
          required
        />
      </div>

      <div>
        <Label htmlFor="format">Format</Label>
        <select
          id="format"
          value={format}
          onChange={(e) => setFormat(e.target.value as ReportExportFormat)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          required
        >
          <option value="pdf">PDF</option>
          <option value="csv">CSV (Excel)</option>
        </select>
      </div>

      <div>
        <Label htmlFor="recipients">Recipients (comma-separated)</Label>
        <Input
          id="recipients"
          value={recipients}
          onChange={(e) => setRecipients(e.target.value)}
          placeholder="email1@example.com, email2@example.com"
          required
        />
      </div>

      {onSendTest && (
        <div className="border-t pt-4">
          <Label htmlFor="testEmail">Send Test Email</Label>
          <div className="flex gap-2">
            <Input
              id="testEmail"
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="your@email.com"
              className="flex-1"
            />
            <Button
              type="button"
              onClick={handleSendTest}
              disabled={!testEmail || isSendingTest}
              variant="secondary"
            >
              {isSendingTest ? 'Sending...' : 'Send Test'}
            </Button>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3 border-t pt-4">
        <Button type="button" onClick={onCancel} variant="secondary">
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? 'Saving...' : schedule ? 'Update Schedule' : 'Create Schedule'}
        </Button>
      </div>
    </form>
  );
}
