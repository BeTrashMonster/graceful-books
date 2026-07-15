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
  TaskPriority,
} from '../../../../db/schema/checklistCalendar.schema';
import { CHECKLIST_COLORS } from '../../../../db/schema/checklistCalendar.schema';
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
}

export interface WizardChecklist {
  id: string;
  name: string;
  description?: string;
  color: string;
  recurrence: ChecklistRecurrenceType;
  tasks: WizardTask[];
  enabled: boolean;
  excludeWeekends: boolean;
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

const DEFAULT_CHECKLISTS: WizardChecklist[] = [
  {
    id: 'daily',
    name: 'Daily Tasks',
    description: 'Tasks to complete every business day',
    color: CHECKLIST_COLORS[0].value,
    recurrence: 'daily',
    enabled: true,
    excludeWeekends: true, // Default to weekdays only for daily tasks
    tasks: [
      {
        id: 'daily-1',
        title: 'Review incoming transactions',
        description: 'Check bank feeds and categorize new transactions',
        priority: 'high',
        recurrence: 'daily',
        enabled: true,
      },
      {
        id: 'daily-2',
        title: 'Process customer payments',
        description: 'Record and deposit customer payments received',
        priority: 'high',
        recurrence: 'daily',
        enabled: true,
      },
      {
        id: 'daily-3',
        title: 'Review accounts receivable',
        description: 'Check for overdue invoices and follow up',
        priority: 'medium',
        recurrence: 'daily',
        enabled: true,
      },
      {
        id: 'daily-4',
        title: 'Check cash position',
        description: 'Review current cash balances across accounts',
        priority: 'medium',
        recurrence: 'daily',
        enabled: true,
      },
    ],
  },
  {
    id: 'weekly',
    name: 'Weekly Tasks',
    description: 'Tasks to complete each week',
    color: CHECKLIST_COLORS[1].value,
    recurrence: 'weekly',
    enabled: true,
    excludeWeekends: false,
    tasks: [
      {
        id: 'weekly-1',
        title: 'Send customer invoices',
        description: 'Generate and send invoices for completed work',
        priority: 'high',
        recurrence: 'weekly',
        enabled: true,
      },
      {
        id: 'weekly-2',
        title: 'Review accounts payable',
        description: 'Check upcoming bills and payment due dates',
        priority: 'high',
        recurrence: 'weekly',
        enabled: true,
      },
      {
        id: 'weekly-3',
        title: 'Reconcile petty cash',
        description: 'Count and reconcile petty cash fund',
        priority: 'medium',
        recurrence: 'weekly',
        enabled: true,
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
      },
    ],
  },
  {
    id: 'monthly',
    name: 'Monthly Close Tasks',
    description: 'Month-end closing procedures',
    color: CHECKLIST_COLORS[2].value,
    recurrence: 'monthly',
    enabled: true,
    excludeWeekends: false,
    tasks: [
      {
        id: 'monthly-1',
        title: 'Reconcile all bank accounts',
        description: 'Complete bank reconciliation for all accounts',
        priority: 'high',
        recurrence: 'monthly',
        enabled: true,
      },
      {
        id: 'monthly-2',
        title: 'Reconcile credit cards',
        description: 'Match credit card statements to recorded transactions',
        priority: 'high',
        recurrence: 'monthly',
        enabled: true,
      },
      {
        id: 'monthly-3',
        title: 'Review accounts receivable aging',
        description: 'Generate and review A/R aging report',
        priority: 'medium',
        recurrence: 'monthly',
        enabled: true,
      },
      {
        id: 'monthly-4',
        title: 'Review accounts payable aging',
        description: 'Generate and review A/P aging report',
        priority: 'medium',
        recurrence: 'monthly',
        enabled: true,
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
      },
      {
        id: 'monthly-7',
        title: 'Review balance sheet',
        description: 'Generate and review balance sheet',
        priority: 'high',
        recurrence: 'monthly',
        enabled: true,
      },
    ],
  },
  {
    id: 'quarterly',
    name: 'Quarterly Tasks',
    description: 'End-of-quarter procedures',
    color: CHECKLIST_COLORS[3].value,
    recurrence: 'quarterly',
    enabled: true,
    excludeWeekends: false,
    tasks: [
      {
        id: 'quarterly-1',
        title: 'Prepare quarterly tax estimates',
        description: 'Calculate and file estimated tax payments',
        priority: 'high',
        recurrence: 'quarterly',
        enabled: true,
      },
      {
        id: 'quarterly-2',
        title: 'File sales tax returns',
        description: 'Prepare and file quarterly sales tax',
        priority: 'high',
        recurrence: 'quarterly',
        enabled: true,
      },
      {
        id: 'quarterly-3',
        title: 'Review budget vs actual',
        description: 'Compare actual results to budget',
        priority: 'medium',
        recurrence: 'quarterly',
        enabled: true,
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
    recurrence: 'annual',
    enabled: true,
    excludeWeekends: false,
    tasks: [
      {
        id: 'annual-1',
        title: 'Year-end close procedures',
        description: 'Complete all year-end closing entries',
        priority: 'high',
        recurrence: 'annual',
        enabled: true,
      },
      {
        id: 'annual-2',
        title: 'Prepare W-2s and 1099s',
        description: 'Generate and distribute tax forms',
        priority: 'high',
        recurrence: 'annual',
        enabled: true,
      },
      {
        id: 'annual-3',
        title: 'Prepare annual tax return',
        description: 'Gather documents and prepare business tax return',
        priority: 'high',
        recurrence: 'annual',
        enabled: true,
      },
      {
        id: 'annual-4',
        title: 'Review chart of accounts',
        description: 'Clean up and optimize chart of accounts',
        priority: 'low',
        recurrence: 'annual',
        enabled: true,
      },
      {
        id: 'annual-5',
        title: 'Update vendor W-9s',
        description: 'Request updated W-9 forms from vendors',
        priority: 'medium',
        recurrence: 'annual',
        enabled: true,
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
  onBack: () => void;
  onNext: () => void;
}

function ChecklistSelectionStep({
  checklists,
  onToggleChecklist,
  onToggleWeekends,
  onBack,
  onNext,
}: ChecklistSelectionStepProps) {
  const enabledCount = checklists.filter((c) => c.enabled).length;

  return (
    <div className={styles.stepContent}>
      <h2 className={styles.stepTitle}>Choose Your Checklists</h2>
      <p className={styles.stepDescription}>
        Select which recurring checklists you'd like to set up. You can customize tasks in the next step.
      </p>

      <div className={styles.checklistGrid}>
        {checklists.map((checklist) => (
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
            {checklist.enabled && (
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
  };

  const handleSaveEdit = () => {
    if (editingTask) {
      onUpdateTask(editingTask.checklistId, editingTask.task.id, {
        title: editTitle,
        description: editDescription,
        priority: editPriority,
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
  };

  const handleSaveNewTask = () => {
    if (addingToChecklist && editTitle.trim()) {
      onAddTask(addingToChecklist, {
        title: editTitle.trim(),
        description: editDescription.trim() || undefined,
        priority: editPriority,
        recurrence: checklists.find(c => c.id === addingToChecklist)?.recurrence || 'daily',
        enabled: true,
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
