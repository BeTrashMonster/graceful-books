/**
 * SetupWizard Component
 *
 * Multi-step wizard for setting up the Admin Calendar with default checklists.
 *
 * Requirements:
 * - CK-F: Setup Wizard
 *
 * @see Roadmaps/ROADMAP_CHECKLIST_CALENDAR.md
 */

import { useState, useCallback } from 'react';
import clsx from 'clsx';
import type {
  ChecklistRecurrenceType,
  ChecklistType,
  TaskPriority,
} from '../../../../db/schema/checklistCalendar.schema';
import { CHECKLIST_COLORS } from '../../../../db/schema/checklistCalendar.schema';
import { DayPicker } from '../DayPicker';
import { ScheduleSelector } from '../ScheduleSelector';
import type { ScheduleConfig } from '../ScheduleSelector';
import styles from './SetupWizard.module.css';

// =============================================================================
// TYPES
// =============================================================================

export interface WizardTask {
  id: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  recurrence: ChecklistRecurrenceType;
  enabled: boolean;
  daysOfWeek: number[] | null; // null = inherit from checklist
}

export interface WizardChecklist {
  id: string;
  name: string;
  description?: string;
  color: string;
  checklistType: ChecklistType; // 'scheduled' or 'procedure'
  recurrence: ChecklistRecurrenceType;
  tasks: WizardTask[];
  enabled: boolean;
  excludeWeekends: boolean;

  // Scheduling configuration (only for scheduled checklists)
  weeklyDays: number[];
  isEveryOtherWeek: boolean;
  monthlyScheduleType: 'day' | 'weekday';
  monthlyDay: number;
  monthlyWeek: number;
  monthlyDayOfWeek: number;
  quarterlyMonths: number[]; // Array of months (1-12) for flexible quarterly scheduling
  quarterlyDay: number;
  annualMonth: number;
  annualDay: number;
}

export interface SetupWizardProps {
  /**
   * Whether the wizard is open
   */
  isOpen: boolean;

  /**
   * Callback when the wizard is closed
   */
  onClose: () => void;

  /**
   * Callback when setup is complete
   */
  onComplete: (checklists: WizardChecklist[]) => void;

  /**
   * Additional CSS class name
   */
  className?: string;
}

// =============================================================================
// DEFAULT TEMPLATE
// =============================================================================

// Default scheduling fields for all checklists
const DEFAULT_SCHEDULE_FIELDS = {
  weeklyDays: [5],
  isEveryOtherWeek: false,
  monthlyScheduleType: 'day' as const,
  monthlyDay: -1,
  monthlyWeek: 1,
  monthlyDayOfWeek: 1,
  quarterlyMonths: [3, 6, 9, 12],
  quarterlyDay: -1,
  annualMonth: 12,
  annualDay: 31,
};

const DEFAULT_CHECKLISTS: WizardChecklist[] = [
  {
    id: 'daily',
    name: 'Daily Tasks',
    description: 'Tasks to complete every business day',
    color: CHECKLIST_COLORS[0].value,
    checklistType: 'scheduled',
    recurrence: 'daily',
    enabled: true,
    excludeWeekends: true, // Default to weekdays only for daily tasks
    ...DEFAULT_SCHEDULE_FIELDS,
    tasks: [
      {
        id: 'daily-1',
        title: 'Review incoming transactions',
        description: 'Check bank feeds and categorize new transactions',
        priority: 'high',
        recurrence: 'daily',
        enabled: true,
        daysOfWeek: null,
      },
      {
        id: 'daily-2',
        title: 'Process customer payments',
        description: 'Record and deposit customer payments received',
        priority: 'high',
        recurrence: 'daily',
        enabled: true,
        daysOfWeek: null,
      },
      {
        id: 'daily-3',
        title: 'Review accounts receivable',
        description: 'Check for overdue invoices and follow up',
        priority: 'medium',
        recurrence: 'daily',
        enabled: true,
        daysOfWeek: null,
      },
      {
        id: 'daily-4',
        title: 'Check cash position',
        description: 'Review current cash balances across accounts',
        priority: 'medium',
        recurrence: 'daily',
        enabled: true,
        daysOfWeek: null,
      },
    ],
  },
  {
    id: 'weekly',
    name: 'Weekly Tasks',
    description: 'Tasks to complete each week',
    color: CHECKLIST_COLORS[1].value,
    checklistType: 'scheduled',
    recurrence: 'weekly',
    enabled: true,
    excludeWeekends: false,
    ...DEFAULT_SCHEDULE_FIELDS,
    weeklyDays: [5], // Friday
    tasks: [
      {
        id: 'weekly-1',
        title: 'Send customer invoices',
        description: 'Generate and send invoices for completed work',
        priority: 'high',
        recurrence: 'weekly',
        enabled: true,
        daysOfWeek: null,
      },
      {
        id: 'weekly-2',
        title: 'Review accounts payable',
        description: 'Check upcoming bills and payment due dates',
        priority: 'high',
        recurrence: 'weekly',
        enabled: true,
        daysOfWeek: null,
      },
      {
        id: 'weekly-3',
        title: 'Reconcile petty cash',
        description: 'Count and reconcile petty cash fund',
        priority: 'medium',
        recurrence: 'weekly',
        enabled: true,
        daysOfWeek: null,
      },
      {
        id: 'weekly-4',
        title: 'Review expense reports',
        description: 'Process and approve employee expense reports',
        priority: 'medium',
        recurrence: 'weekly',
        enabled: false,
      },
      {
        id: 'weekly-5',
        title: 'Backup financial data',
        description: 'Export and backup accounting data',
        priority: 'low',
        recurrence: 'weekly',
        enabled: true,
        daysOfWeek: null,
      },
    ],
  },
  {
    id: 'monthly',
    name: 'Monthly Close Tasks',
    description: 'Month-end closing procedures',
    color: CHECKLIST_COLORS[2].value,
    checklistType: 'scheduled',
    recurrence: 'monthly',
    enabled: true,
    excludeWeekends: false,
    ...DEFAULT_SCHEDULE_FIELDS,
    monthlyDay: -1, // Last day of month
    tasks: [
      {
        id: 'monthly-1',
        title: 'Reconcile all bank accounts',
        description: 'Complete bank reconciliation for all accounts',
        priority: 'high',
        recurrence: 'monthly',
        enabled: true,
        daysOfWeek: null,
      },
      {
        id: 'monthly-2',
        title: 'Reconcile credit cards',
        description: 'Match credit card statements to recorded transactions',
        priority: 'high',
        recurrence: 'monthly',
        enabled: true,
        daysOfWeek: null,
      },
      {
        id: 'monthly-3',
        title: 'Review accounts receivable aging',
        description: 'Generate and review A/R aging report',
        priority: 'medium',
        recurrence: 'monthly',
        enabled: true,
        daysOfWeek: null,
      },
      {
        id: 'monthly-4',
        title: 'Review accounts payable aging',
        description: 'Generate and review A/P aging report',
        priority: 'medium',
        recurrence: 'monthly',
        enabled: true,
        daysOfWeek: null,
      },
      {
        id: 'monthly-5',
        title: 'Record depreciation',
        description: 'Post monthly depreciation entries',
        priority: 'medium',
        recurrence: 'monthly',
        enabled: false,
      },
      {
        id: 'monthly-6',
        title: 'Review profit & loss',
        description: 'Generate and review P&L statement',
        priority: 'high',
        recurrence: 'monthly',
        enabled: true,
        daysOfWeek: null,
      },
      {
        id: 'monthly-7',
        title: 'Review balance sheet',
        description: 'Generate and review balance sheet',
        priority: 'high',
        recurrence: 'monthly',
        enabled: true,
        daysOfWeek: null,
      },
    ],
  },
  {
    id: 'quarterly',
    name: 'Quarterly Tasks',
    description: 'End-of-quarter procedures',
    color: CHECKLIST_COLORS[3].value,
    checklistType: 'scheduled',
    recurrence: 'quarterly',
    enabled: true,
    excludeWeekends: false,
    ...DEFAULT_SCHEDULE_FIELDS,
    quarterlyMonths: [3, 6, 9, 12], // Third month of quarter
    quarterlyDay: -1, // Last day
    tasks: [
      {
        id: 'quarterly-1',
        title: 'Prepare quarterly tax estimates',
        description: 'Calculate and file estimated tax payments',
        priority: 'high',
        recurrence: 'quarterly',
        enabled: true,
        daysOfWeek: null,
      },
      {
        id: 'quarterly-2',
        title: 'File sales tax returns',
        description: 'Prepare and file quarterly sales tax',
        priority: 'high',
        recurrence: 'quarterly',
        enabled: true,
        daysOfWeek: null,
      },
      {
        id: 'quarterly-3',
        title: 'Review budget vs actual',
        description: 'Compare actual results to budget',
        priority: 'medium',
        recurrence: 'quarterly',
        enabled: true,
        daysOfWeek: null,
      },
      {
        id: 'quarterly-4',
        title: 'File payroll tax returns',
        description: 'Prepare and file Form 941',
        priority: 'high',
        recurrence: 'quarterly',
        enabled: false,
      },
    ],
  },
  {
    id: 'annual',
    name: 'Annual Tasks',
    description: 'Year-end procedures and filings',
    color: CHECKLIST_COLORS[4].value,
    checklistType: 'scheduled',
    recurrence: 'annual',
    enabled: true,
    excludeWeekends: false,
    ...DEFAULT_SCHEDULE_FIELDS,
    annualMonth: 12, // December
    annualDay: 31, // 31st
    tasks: [
      {
        id: 'annual-1',
        title: 'Year-end close procedures',
        description: 'Complete all year-end closing entries',
        priority: 'high',
        recurrence: 'annual',
        enabled: true,
        daysOfWeek: null,
      },
      {
        id: 'annual-2',
        title: 'Prepare W-2s and 1099s',
        description: 'Generate and distribute tax forms',
        priority: 'high',
        recurrence: 'annual',
        enabled: true,
        daysOfWeek: null,
      },
      {
        id: 'annual-3',
        title: 'Prepare annual tax return',
        description: 'Gather documents and prepare business tax return',
        priority: 'high',
        recurrence: 'annual',
        enabled: true,
        daysOfWeek: null,
      },
      {
        id: 'annual-4',
        title: 'Review chart of accounts',
        description: 'Clean up and optimize chart of accounts',
        priority: 'low',
        recurrence: 'annual',
        enabled: true,
        daysOfWeek: null,
      },
      {
        id: 'annual-5',
        title: 'Update vendor W-9s',
        description: 'Request updated W-9 forms from vendors',
        priority: 'medium',
        recurrence: 'annual',
        enabled: true,
        daysOfWeek: null,
      },
    ],
  },
  // ==========================================================================
  // PROCEDURE TEMPLATES (SOPs)
  // ==========================================================================
  {
    id: 'client-onboarding',
    name: 'Client Onboarding',
    description: 'Complete process for new client setup',
    color: CHECKLIST_COLORS[5].value, // Teal
    checklistType: 'procedure',
    recurrence: 'one-time',
    enabled: false,
    excludeWeekends: false,
    ...DEFAULT_SCHEDULE_FIELDS,
    tasks: [
      {
        id: 'client-1',
        title: 'Send engagement letter',
        description: 'Prepare and send the engagement letter for client signature',
        priority: 'high',
        recurrence: 'one-time',
        enabled: true,
        daysOfWeek: null,
      },
      {
        id: 'client-2',
        title: 'Collect signed engagement letter',
        description: 'Receive and file the signed engagement letter',
        priority: 'high',
        recurrence: 'one-time',
        enabled: true,
        daysOfWeek: null,
      },
      {
        id: 'client-3',
        title: 'Set up client folder',
        description: 'Create client folder structure in the system',
        priority: 'medium',
        recurrence: 'one-time',
        enabled: true,
        daysOfWeek: null,
      },
      {
        id: 'client-4',
        title: 'Request bank access',
        description: 'Request read-only access to client bank accounts',
        priority: 'high',
        recurrence: 'one-time',
        enabled: true,
        daysOfWeek: null,
      },
      {
        id: 'client-5',
        title: 'Import opening balances',
        description: 'Set up chart of accounts and import opening balances',
        priority: 'high',
        recurrence: 'one-time',
        enabled: true,
        daysOfWeek: null,
      },
      {
        id: 'client-6',
        title: 'Set up recurring transactions',
        description: 'Configure any recurring transactions or templates',
        priority: 'medium',
        recurrence: 'one-time',
        enabled: true,
        daysOfWeek: null,
      },
      {
        id: 'client-7',
        title: 'Schedule kickoff call',
        description: 'Schedule and conduct initial kickoff meeting with client',
        priority: 'medium',
        recurrence: 'one-time',
        enabled: true,
        daysOfWeek: null,
      },
    ],
  },
  {
    id: 'employee-onboarding',
    name: 'Employee Onboarding',
    description: 'New team member setup checklist',
    color: CHECKLIST_COLORS[6].value, // Red
    checklistType: 'procedure',
    recurrence: 'one-time',
    enabled: false,
    excludeWeekends: false,
    ...DEFAULT_SCHEDULE_FIELDS,
    tasks: [
      {
        id: 'emp-1',
        title: 'Send offer letter',
        description: 'Prepare and send employment offer letter',
        priority: 'high',
        recurrence: 'one-time',
        enabled: true,
        daysOfWeek: null,
      },
      {
        id: 'emp-2',
        title: 'Collect I-9 documentation',
        description: 'Verify identity and work authorization documents',
        priority: 'high',
        recurrence: 'one-time',
        enabled: true,
        daysOfWeek: null,
      },
      {
        id: 'emp-3',
        title: 'Complete W-4 form',
        description: 'Have employee complete federal tax withholding form',
        priority: 'high',
        recurrence: 'one-time',
        enabled: true,
        daysOfWeek: null,
      },
      {
        id: 'emp-4',
        title: 'Set up payroll',
        description: 'Add employee to payroll system with correct details',
        priority: 'high',
        recurrence: 'one-time',
        enabled: true,
        daysOfWeek: null,
      },
      {
        id: 'emp-5',
        title: 'Order equipment',
        description: 'Request necessary equipment (laptop, monitors, etc.)',
        priority: 'medium',
        recurrence: 'one-time',
        enabled: true,
        daysOfWeek: null,
      },
      {
        id: 'emp-6',
        title: 'Create email account',
        description: 'Set up company email and add to distribution lists',
        priority: 'medium',
        recurrence: 'one-time',
        enabled: true,
        daysOfWeek: null,
      },
      {
        id: 'emp-7',
        title: 'Set up system access',
        description: 'Grant access to necessary systems and software',
        priority: 'medium',
        recurrence: 'one-time',
        enabled: true,
        daysOfWeek: null,
      },
      {
        id: 'emp-8',
        title: 'Schedule orientation',
        description: 'Plan and conduct new employee orientation',
        priority: 'medium',
        recurrence: 'one-time',
        enabled: true,
        daysOfWeek: null,
      },
    ],
  },
  {
    id: 'contractor-setup',
    name: 'Contractor Setup',
    description: '1099 contractor onboarding process',
    color: CHECKLIST_COLORS[7].value, // Yellow
    checklistType: 'procedure',
    recurrence: 'one-time',
    enabled: false,
    excludeWeekends: false,
    ...DEFAULT_SCHEDULE_FIELDS,
    tasks: [
      {
        id: 'cont-1',
        title: 'Send contract agreement',
        description: 'Prepare and send contractor agreement for signature',
        priority: 'high',
        recurrence: 'one-time',
        enabled: true,
        daysOfWeek: null,
      },
      {
        id: 'cont-2',
        title: 'Collect W-9 form',
        description: 'Request and file W-9 for tax reporting',
        priority: 'high',
        recurrence: 'one-time',
        enabled: true,
        daysOfWeek: null,
      },
      {
        id: 'cont-3',
        title: 'Set up in vendor system',
        description: 'Add contractor as vendor for payment processing',
        priority: 'medium',
        recurrence: 'one-time',
        enabled: true,
        daysOfWeek: null,
      },
      {
        id: 'cont-4',
        title: 'Grant system access',
        description: 'Provide any necessary system access (if applicable)',
        priority: 'low',
        recurrence: 'one-time',
        enabled: true,
        daysOfWeek: null,
      },
      {
        id: 'cont-5',
        title: 'Document payment terms',
        description: 'Record payment schedule and method preferences',
        priority: 'medium',
        recurrence: 'one-time',
        enabled: true,
        daysOfWeek: null,
      },
    ],
  },
];

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

function StepIndicator({ currentStep, totalSteps }: StepIndicatorProps) {
  return (
    <div className={styles.stepIndicator}>
      {Array.from({ length: totalSteps }, (_, i) => (
        <div
          key={i}
          className={clsx(
            styles.step,
            i < currentStep && styles.completed,
            i === currentStep && styles.current
          )}
        >
          <span className={styles.stepNumber}>{i + 1}</span>
        </div>
      ))}
    </div>
  );
}

interface WelcomeStepProps {
  onNext: () => void;
}

function WelcomeStep({ onNext }: WelcomeStepProps) {
  return (
    <div className={styles.stepContent}>
      <h2 className={styles.stepTitle}>Welcome to Admin Calendar</h2>
      <p className={styles.stepDescription}>
        Your calendar-based task management system for bookkeeping and administrative tasks.
        We'll help you set up your recurring checklists in just a few steps.
      </p>
      <div className={styles.featureList}>
        <div className={styles.feature}>
          <span className={styles.featureIcon}>✓</span>
          <span>Recurring task schedules (daily, weekly, monthly, quarterly, annual)</span>
        </div>
        <div className={styles.feature}>
          <span className={styles.featureIcon}>✓</span>
          <span>Ability to attach Standard Operating Procedures to tasks</span>
        </div>
        <div className={styles.feature}>
          <span className={styles.featureIcon}>✓</span>
          <span>Sub-tasks, comments, and team collaboration</span>
        </div>
        <div className={styles.feature}>
          <span className={styles.featureIcon}>✓</span>
          <span>Links to app features for quick navigation</span>
        </div>
      </div>
      <button type="button" className={styles.primaryButton} onClick={onNext}>
        Get Started
      </button>
    </div>
  );
}

interface ChecklistSelectionStepProps {
  checklists: WizardChecklist[];
  onToggleChecklist: (id: string) => void;
  onToggleWeekends: (id: string) => void;
  onUpdateSchedule: (id: string, config: Partial<ScheduleConfig>) => void;
  onBack: () => void;
  onNext: () => void;
}

function ChecklistSelectionStep({
  checklists,
  onToggleChecklist,
  onToggleWeekends,
  onUpdateSchedule,
  onBack,
  onNext,
}: ChecklistSelectionStepProps) {
  const enabledCount = checklists.filter((c) => c.enabled).length;
  const scheduledChecklists = checklists.filter((c) => c.checklistType === 'scheduled');
  const procedureChecklists = checklists.filter((c) => c.checklistType === 'procedure');

  return (
    <div className={styles.stepContent}>
      <h2 className={styles.stepTitle}>Choose Your Checklists</h2>
      <p className={styles.stepDescription}>
        Select recurring schedules and procedure templates you'd like to set up.
      </p>

      {/* Scheduled Checklists Section */}
      <div className={styles.sectionHeader}>
        <span className={styles.sectionIcon}>📅</span>
        <div className={styles.sectionHeaderText}>
          <span className={styles.sectionHeaderTitle}>Scheduled</span>
          <span className={styles.sectionHeaderSubtitle}>Tasks that repeat on a regular schedule</span>
        </div>
      </div>

      <div className={styles.checklistGrid}>
        {scheduledChecklists.map((checklist) => (
          <label
            key={checklist.id}
            className={clsx(
              styles.checklistCard,
              checklist.enabled && styles.selected
            )}
            style={{ '--checklist-color': checklist.color } as React.CSSProperties}
          >
            <input
              type="checkbox"
              checked={checklist.enabled}
              onChange={() => onToggleChecklist(checklist.id)}
              className={styles.hiddenCheckbox}
            />
            <div className={styles.checklistHeader}>
              <span className={styles.checklistName}>{checklist.name}</span>
              <span className={styles.checklistBadge}>{checklist.recurrence}</span>
            </div>
            <p className={styles.checklistDescription}>{checklist.description}</p>
            <span className={styles.taskCount}>
              {checklist.tasks.filter((t) => t.enabled).length} tasks
            </span>
            {checklist.enabled && checklist.recurrence === 'daily' && (
              <label
                className={styles.weekendToggle}
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={!checklist.excludeWeekends}
                  onChange={(e) => {
                    e.stopPropagation();
                    onToggleWeekends(checklist.id);
                  }}
                />
                <span>Include Sat/Sun</span>
              </label>
            )}
            {checklist.enabled && checklist.recurrence !== 'daily' && (
              <div onClick={(e) => e.stopPropagation()}>
                <ScheduleSelector
                  recurrenceType={checklist.recurrence}
                  config={{
                    weeklyDays: checklist.weeklyDays,
                    isEveryOtherWeek: checklist.isEveryOtherWeek,
                    monthlyScheduleType: checklist.monthlyScheduleType,
                    monthlyDay: checklist.monthlyDay,
                    monthlyWeek: checklist.monthlyWeek,
                    monthlyDayOfWeek: checklist.monthlyDayOfWeek,
                    quarterlyMonths: checklist.quarterlyMonths,
                    quarterlyDay: checklist.quarterlyDay,
                    annualMonth: checklist.annualMonth,
                    annualDay: checklist.annualDay,
                  }}
                  onChange={(config) => onUpdateSchedule(checklist.id, config)}
                />
                {/* Show exclude weekends for monthly/quarterly/annual (not weekly - users select days directly) */}
                {checklist.recurrence !== 'weekly' && (
                  <label
                    className={styles.weekendToggle}
                    style={{ marginTop: '8px' }}
                  >
                    <input
                      type="checkbox"
                      checked={checklist.excludeWeekends}
                      onChange={() => onToggleWeekends(checklist.id)}
                    />
                    <span>Exclude Sat/Sun (shifts to Monday)</span>
                  </label>
                )}
              </div>
            )}
          </label>
        ))}
      </div>

      {/* Procedures Section */}
      <div className={styles.sectionHeader}>
        <span className={styles.sectionIcon}>📖</span>
        <div className={styles.sectionHeaderText}>
          <span className={styles.sectionHeaderTitle}>Procedures</span>
          <span className={styles.sectionHeaderSubtitle}>Step-by-step processes you start when the need arises</span>
        </div>
      </div>

      <div className={styles.checklistGrid}>
        {procedureChecklists.map((checklist) => (
          <label
            key={checklist.id}
            className={clsx(
              styles.checklistCard,
              styles.procedureCard,
              checklist.enabled && styles.selected
            )}
            style={{ '--checklist-color': checklist.color } as React.CSSProperties}
          >
            <input
              type="checkbox"
              checked={checklist.enabled}
              onChange={() => onToggleChecklist(checklist.id)}
              className={styles.hiddenCheckbox}
            />
            <div className={styles.checklistHeader}>
              <span className={styles.checklistName}>{checklist.name}</span>
              <span className={styles.checklistBadge}>procedure</span>
            </div>
            <p className={styles.checklistDescription}>{checklist.description}</p>
            <span className={styles.taskCount}>
              {checklist.tasks.filter((t) => t.enabled).length} steps
            </span>
          </label>
        ))}
      </div>

      <div className={styles.stepActions}>
        <button type="button" className={styles.secondaryButton} onClick={onBack}>
          Back
        </button>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={onNext}
          disabled={enabledCount === 0}
        >
          Customize Tasks ({enabledCount} selected)
        </button>
      </div>
    </div>
  );
}

interface TaskCustomizationStepProps {
  checklists: WizardChecklist[];
  onToggleTask: (checklistId: string, taskId: string) => void;
  onUpdateTask: (checklistId: string, taskId: string, updates: Partial<WizardTask>) => void;
  onAddTask: (checklistId: string, task: Omit<WizardTask, 'id'>) => void;
  onBack: () => void;
  onNext: () => void;
}

interface EditingTask {
  checklistId: string;
  task: WizardTask;
}

function TaskCustomizationStep({
  checklists,
  onToggleTask,
  onUpdateTask,
  onAddTask,
  onBack,
  onNext,
}: TaskCustomizationStepProps) {
  const [editingTask, setEditingTask] = useState<EditingTask | null>(null);
  const [addingToChecklist, setAddingToChecklist] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPriority, setEditPriority] = useState<TaskPriority>('medium');
  const [editDaysOfWeek, setEditDaysOfWeek] = useState<number[] | null>(null);

  const enabledChecklists = checklists.filter((c) => c.enabled);
  const totalTasks = enabledChecklists.reduce(
    (sum, c) => sum + c.tasks.filter((t) => t.enabled).length,
    0
  );

  const handleEditClick = (checklistId: string, task: WizardTask, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingTask({ checklistId, task });
    setEditTitle(task.title);
    setEditDescription(task.description || '');
    setEditPriority(task.priority);
    setEditDaysOfWeek(task.daysOfWeek);
  };

  const handleSaveEdit = () => {
    if (editingTask) {
      onUpdateTask(editingTask.checklistId, editingTask.task.id, {
        title: editTitle,
        description: editDescription,
        priority: editPriority,
        daysOfWeek: editDaysOfWeek,
      });
      setEditingTask(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingTask(null);
  };

  const handleAddClick = (checklistId: string) => {
    setAddingToChecklist(checklistId);
    setEditTitle('');
    setEditDescription('');
    setEditPriority('medium');
    setEditDaysOfWeek(null);
  };

  const handleSaveNewTask = () => {
    if (addingToChecklist && editTitle.trim()) {
      onAddTask(addingToChecklist, {
        title: editTitle.trim(),
        description: editDescription.trim() || undefined,
        priority: editPriority,
        recurrence: checklists.find(c => c.id === addingToChecklist)?.recurrence || 'daily',
        enabled: true,
        daysOfWeek: editDaysOfWeek,
      });
      setAddingToChecklist(null);
    }
  };

  const handleCancelAdd = () => {
    setAddingToChecklist(null);
  };

  return (
    <div className={styles.stepContent}>
      <h2 className={styles.stepTitle}>Customize Your Tasks</h2>
      <p className={styles.stepDescription}>
        Select the tasks relevant to your business and edit them to fit your needs. Click the edit icon to customize any task.
      </p>

      {/* Edit Modal */}
      {editingTask && (
        <div className={styles.editModal}>
          <div className={styles.editModalContent}>
            <h3 className={styles.editModalTitle}>Edit Task</h3>
            <div className={styles.editField}>
              <label className={styles.editLabel}>Title</label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className={styles.editInput}
                placeholder="Task title"
              />
            </div>
            <div className={styles.editField}>
              <label className={styles.editLabel}>Description</label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className={styles.editTextarea}
                placeholder="Task description (optional)"
                rows={3}
              />
            </div>
            <div className={styles.editField}>
              <label className={styles.editLabel}>Priority</label>
              <select
                value={editPriority}
                onChange={(e) => setEditPriority(e.target.value as TaskPriority)}
                className={styles.editSelect}
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
                <option value="none">None</option>
              </select>
            </div>
            {/* Day picker for daily/weekly tasks */}
            {editingTask && (editingTask.task.recurrence === 'daily' || editingTask.task.recurrence === 'weekly') && (
              <div className={styles.editField}>
                <label className={styles.editLabel}>
                  Days of Week
                  {editDaysOfWeek !== null && (
                    <button
                      type="button"
                      className={styles.resetLink}
                      onClick={() => setEditDaysOfWeek(null)}
                    >
                      Reset
                    </button>
                  )}
                </label>
                <DayPicker
                  selectedDays={editDaysOfWeek ?? [0, 1, 2, 3, 4, 5, 6]}
                  onChange={(days) => setEditDaysOfWeek(days)}
                  isInherited={editDaysOfWeek === null}
                  compact
                />
                {editDaysOfWeek === null && (
                  <span className={styles.inheritedHint}>
                    {editingTask.task.recurrence === 'daily' ? 'Shows every day' : 'Inherits from checklist'}
                  </span>
                )}
              </div>
            )}
            <div className={styles.editActions}>
              <button type="button" className={styles.secondaryButton} onClick={handleCancelEdit}>
                Cancel
              </button>
              <button type="button" className={styles.primaryButton} onClick={handleSaveEdit}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Task Modal */}
      {addingToChecklist && (
        <div className={styles.editModal}>
          <div className={styles.editModalContent}>
            <h3 className={styles.editModalTitle}>Add New Task</h3>
            <div className={styles.editField}>
              <label className={styles.editLabel}>Title</label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className={styles.editInput}
                placeholder="Enter task title"
                autoFocus
              />
            </div>
            <div className={styles.editField}>
              <label className={styles.editLabel}>Description</label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className={styles.editTextarea}
                placeholder="Task description (optional)"
                rows={3}
              />
            </div>
            <div className={styles.editField}>
              <label className={styles.editLabel}>Priority</label>
              <select
                value={editPriority}
                onChange={(e) => setEditPriority(e.target.value as TaskPriority)}
                className={styles.editSelect}
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
                <option value="none">None</option>
              </select>
            </div>
            {/* Day picker for daily/weekly tasks */}
            {addingToChecklist && (() => {
              const checklist = checklists.find(c => c.id === addingToChecklist);
              if (checklist && (checklist.recurrence === 'daily' || checklist.recurrence === 'weekly')) {
                return (
                  <div className={styles.editField}>
                    <label className={styles.editLabel}>
                      Days of Week
                      {editDaysOfWeek !== null && (
                        <button
                          type="button"
                          className={styles.resetLink}
                          onClick={() => setEditDaysOfWeek(null)}
                        >
                          Reset
                        </button>
                      )}
                    </label>
                    <DayPicker
                      selectedDays={editDaysOfWeek ?? [0, 1, 2, 3, 4, 5, 6]}
                      onChange={(days) => setEditDaysOfWeek(days)}
                      isInherited={editDaysOfWeek === null}
                      compact
                    />
                    {editDaysOfWeek === null && (
                      <span className={styles.inheritedHint}>
                        {checklist.recurrence === 'daily' ? 'Shows every day' : 'Inherits from checklist'}
                      </span>
                    )}
                  </div>
                );
              }
              return null;
            })()}
            <div className={styles.editActions}>
              <button type="button" className={styles.secondaryButton} onClick={handleCancelAdd}>
                Cancel
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={handleSaveNewTask}
                disabled={!editTitle.trim()}
              >
                Add Task
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.taskListContainer}>
        {enabledChecklists.map((checklist) => (
          <div key={checklist.id} className={styles.taskSection}>
            <h3
              className={styles.sectionTitle}
              style={{ '--checklist-color': checklist.color } as React.CSSProperties}
            >
              <span
                className={styles.colorDot}
                style={{ backgroundColor: checklist.color }}
              />
              {checklist.name}
            </h3>
            <div className={styles.taskList}>
              {checklist.tasks.map((task) => (
                <div
                  key={task.id}
                  className={clsx(styles.taskItem, task.enabled && styles.enabled)}
                >
                  <input
                    type="checkbox"
                    checked={task.enabled}
                    onChange={() => onToggleTask(checklist.id, task.id)}
                    className={styles.taskCheckbox}
                  />
                  <div className={styles.taskInfo}>
                    <span className={styles.taskTitle}>{task.title}</span>
                    {task.priority !== 'none' && (
                      <span className={clsx(styles.priorityBadge, styles[task.priority])}>
                        {task.priority}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    className={styles.editButton}
                    onClick={(e) => handleEditClick(checklist.id, task, e)}
                    aria-label={`Edit ${task.title}`}
                  >
                    ✏️
                  </button>
                </div>
              ))}
              <button
                type="button"
                className={styles.addTaskButton}
                onClick={() => handleAddClick(checklist.id)}
              >
                + Add custom task
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.stepActions}>
        <button type="button" className={styles.secondaryButton} onClick={onBack}>
          Back
        </button>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={onNext}
          disabled={totalTasks === 0}
        >
          Review Setup ({totalTasks} tasks)
        </button>
      </div>
    </div>
  );
}

interface ReviewStepProps {
  checklists: WizardChecklist[];
  onBack: () => void;
  onComplete: () => void;
}

function ReviewStep({ checklists, onBack, onComplete }: ReviewStepProps) {
  const enabledChecklists = checklists.filter((c) => c.enabled);
  const totalTasks = enabledChecklists.reduce(
    (sum, c) => sum + c.tasks.filter((t) => t.enabled).length,
    0
  );

  return (
    <div className={styles.stepContent}>
      <h2 className={styles.stepTitle}>Review Your Setup</h2>
      <p className={styles.stepDescription}>
        Here's a summary of what will be created. You can go back to make changes.
      </p>

      <div className={styles.reviewSummary}>
        <div className={styles.summaryCard}>
          <span className={styles.summaryNumber}>{enabledChecklists.length}</span>
          <span className={styles.summaryLabel}>Checklists</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryNumber}>{totalTasks}</span>
          <span className={styles.summaryLabel}>Tasks</span>
        </div>
      </div>

      <div className={styles.reviewList}>
        {enabledChecklists.map((checklist) => {
          const enabledTasks = checklist.tasks.filter((t) => t.enabled);
          return (
            <div
              key={checklist.id}
              className={styles.reviewChecklist}
              style={{ '--checklist-color': checklist.color } as React.CSSProperties}
            >
              <div className={styles.reviewHeader}>
                <span
                  className={styles.colorDot}
                  style={{ backgroundColor: checklist.color }}
                />
                <span className={styles.reviewName}>{checklist.name}</span>
                <span className={styles.reviewBadge}>{checklist.recurrence}</span>
                <span className={styles.reviewCount}>{enabledTasks.length} tasks</span>
              </div>
              <ul className={styles.reviewTasks}>
                {enabledTasks.map((task) => (
                  <li key={task.id}>{task.title}</li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <div className={styles.stepActions}>
        <button type="button" className={styles.secondaryButton} onClick={onBack}>
          Back
        </button>
        <button type="button" className={styles.primaryButton} onClick={onComplete}>
          Create Checklists
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function SetupWizard({
  isOpen,
  onClose,
  onComplete,
  className,
}: SetupWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [checklists, setChecklists] = useState<WizardChecklist[]>(DEFAULT_CHECKLISTS);

  const totalSteps = 4;

  // Toggle checklist enabled state
  const handleToggleChecklist = useCallback((id: string) => {
    setChecklists((prev) =>
      prev.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c))
    );
  }, []);

  // Toggle weekend exclusion for a checklist
  const handleToggleWeekends = useCallback((id: string) => {
    setChecklists((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, excludeWeekends: !c.excludeWeekends } : c
      )
    );
  }, []);

  // Update schedule configuration for a checklist
  const handleUpdateSchedule = useCallback((id: string, config: Partial<ScheduleConfig>) => {
    setChecklists((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, ...config } : c
      )
    );
  }, []);

  // Toggle task enabled state
  const handleToggleTask = useCallback((checklistId: string, taskId: string) => {
    setChecklists((prev) =>
      prev.map((c) =>
        c.id === checklistId
          ? {
              ...c,
              tasks: c.tasks.map((t) =>
                t.id === taskId ? { ...t, enabled: !t.enabled } : t
              ),
            }
          : c
      )
    );
  }, []);

  // Update task properties
  const handleUpdateTask = useCallback((checklistId: string, taskId: string, updates: Partial<WizardTask>) => {
    setChecklists((prev) =>
      prev.map((c) =>
        c.id === checklistId
          ? {
              ...c,
              tasks: c.tasks.map((t) =>
                t.id === taskId ? { ...t, ...updates } : t
              ),
            }
          : c
      )
    );
  }, []);

  // Add a new custom task
  const handleAddTask = useCallback((checklistId: string, task: Omit<WizardTask, 'id'>) => {
    const newTask: WizardTask = {
      ...task,
      id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    setChecklists((prev) =>
      prev.map((c) =>
        c.id === checklistId
          ? { ...c, tasks: [...c.tasks, newTask] }
          : c
      )
    );
  }, []);

  // Navigation
  const goNext = useCallback(() => {
    setCurrentStep((prev) => Math.min(prev + 1, totalSteps - 1));
  }, []);

  const goBack = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  // Complete setup
  const handleComplete = useCallback(() => {
    const enabledChecklists = checklists.filter((c) => c.enabled).map((c) => ({
      ...c,
      tasks: c.tasks.filter((t) => t.enabled),
    }));
    onComplete(enabledChecklists);
  }, [checklists, onComplete]);

  // Handle keyboard - removed Escape to prevent accidental closure
  // Users must explicitly close via the X button or complete the wizard

  if (!isOpen) return null;

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="setup-wizard-title"
    >
      <div
        className={clsx(styles.wizard, className)}
      >
        {/* Header */}
        <div className={styles.header}>
          <StepIndicator currentStep={currentStep} totalSteps={totalSteps} />
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close wizard"
          >
            ×
          </button>
        </div>

        {/* Steps */}
        {currentStep === 0 && <WelcomeStep onNext={goNext} />}
        {currentStep === 1 && (
          <ChecklistSelectionStep
            checklists={checklists}
            onToggleChecklist={handleToggleChecklist}
            onToggleWeekends={handleToggleWeekends}
            onUpdateSchedule={handleUpdateSchedule}
            onBack={goBack}
            onNext={goNext}
          />
        )}
        {currentStep === 2 && (
          <TaskCustomizationStep
            checklists={checklists}
            onToggleTask={handleToggleTask}
            onUpdateTask={handleUpdateTask}
            onAddTask={handleAddTask}
            onBack={goBack}
            onNext={goNext}
          />
        )}
        {currentStep === 3 && (
          <ReviewStep
            checklists={checklists}
            onBack={goBack}
            onComplete={handleComplete}
          />
        )}
      </div>
    </div>
  );
}

SetupWizard.displayName = 'SetupWizard';
