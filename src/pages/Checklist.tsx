/**
 * Checklist Page
 *
 * Main page for the Admin Calendar - calendar-centric task and SOP management.
 * Features two tabs:
 * - Schedule: Calendar view for recurring scheduled tasks
 * - Procedures: SOPs and procedure instance management
 *
 * @see Roadmaps/ROADMAP_CHECKLIST_CALENDAR.md
 */

import { useState, useCallback, useEffect } from 'react';
import { Breadcrumbs } from '../components/navigation/Breadcrumbs';
import {
  AdminCalendarPage,
  SetupWizard,
  ChecklistManager,
  CreateChecklistModal,
  ProceduresTab,
  createChecklist,
  createTask,
  getChecklists,
} from '../features/checklistCalendar';
import type { WizardChecklist } from '../features/checklistCalendar';

type TabType = 'schedule' | 'procedures';

/**
 * Main Checklist page component - now using Admin Calendar with tabs
 */
export default function Checklist() {
  const [activeTab, setActiveTab] = useState<TabType>('schedule');
  const [showWizard, setShowWizard] = useState(false);
  const [showManager, setShowManager] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createModalType, setCreateModalType] = useState<'scheduled' | 'procedure'>('scheduled');
  const [hasChecklists, setHasChecklists] = useState<boolean | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Check if user has any checklists
  useEffect(() => {
    async function checkChecklists() {
      const result = await getChecklists('demo-company');
      if (result.success) {
        const hasAny = result.data.length > 0;
        setHasChecklists(hasAny);
        // Auto-show wizard if no checklists exist
        if (!hasAny) {
          setShowWizard(true);
        }
      } else {
        setHasChecklists(false);
        setShowWizard(true);
      }
    }
    checkChecklists();
  }, []);

  // Handle wizard completion - create checklists and tasks
  const handleWizardComplete = useCallback(async (wizardChecklists: WizardChecklist[]) => {
    const companyId = 'demo-company';
    const userId = 'demo-user';

    for (const wc of wizardChecklists) {
      // Build recurrence-specific fields based on recurrence type and wizard config
      // These are required for the calendar to know which dates to show tasks
      const recurrenceFields: {
        weeklyDays?: number[];
        monthlyDay?: number;
        monthlyWeek?: number;
        monthlyDayOfWeek?: number;
        recurrenceMonths?: number[];
        quarterlyDay?: number;
        annualMonth?: number;
        annualDay?: number;
        customIntervalValue?: number;
        customIntervalUnit?: 'days' | 'weeks' | 'months';
        customStartDate?: number;
      } = {};

      // Determine actual recurrence type (may change if "every other week" is selected)
      let actualRecurrence = wc.recurrence;

      switch (wc.recurrence) {
        case 'weekly':
          if (wc.isEveryOtherWeek) {
            // Convert to custom interval for biweekly
            actualRecurrence = 'custom';
            recurrenceFields.customIntervalValue = 2;
            recurrenceFields.customIntervalUnit = 'weeks';
            recurrenceFields.customStartDate = Date.now();
          } else {
            recurrenceFields.weeklyDays = wc.weeklyDays;
          }
          break;
        case 'monthly':
          if (wc.monthlyScheduleType === 'day') {
            recurrenceFields.monthlyDay = wc.monthlyDay;
          } else {
            // "Second Tuesday" style
            recurrenceFields.monthlyWeek = wc.monthlyWeek;
            recurrenceFields.monthlyDayOfWeek = wc.monthlyDayOfWeek;
          }
          break;
        case 'quarterly':
          recurrenceFields.recurrenceMonths = wc.quarterlyMonths;
          recurrenceFields.quarterlyDay = wc.quarterlyDay;
          break;
        case 'annual':
          recurrenceFields.annualMonth = wc.annualMonth;
          recurrenceFields.annualDay = wc.annualDay;
          break;
      }

      // Create the checklist
      const checklistResult = await createChecklist({
        companyId,
        name: wc.name,
        description: wc.description,
        color: wc.color,
        checklistType: wc.checklistType,
        recurrenceType: actualRecurrence,
        excludeWeekends: wc.excludeWeekends,
        isTemplate: false,
        ...recurrenceFields,
      });

      if (checklistResult.success) {
        // Create tasks for this checklist
        for (const wt of wc.tasks) {
          await createTask({
            checklistId: checklistResult.data.id,
            companyId,
            userId,
            title: wt.title,
            description: wt.description,
            priority: wt.priority,
            daysOfWeek: wt.daysOfWeek,
          });
        }
      }
    }

    setShowWizard(false);
    setHasChecklists(true);
    // Refresh to show the new checklists
    setRefreshKey((k) => k + 1);
  }, []);

  // Handle wizard close
  const handleWizardClose = useCallback(() => {
    setShowWizard(false);
  }, []);

  // Handle manager close with refresh
  const handleManagerClose = useCallback(() => {
    setShowManager(false);
    setRefreshKey((k) => k + 1);
  }, []);

  // Handle custom checklist created
  const handleChecklistCreated = useCallback(() => {
    setShowCreateModal(false);
    setHasChecklists(true);
    setRefreshKey((k) => k + 1);
  }, []);

  // Handle create button click - opens modal with appropriate type
  const handleCreateClick = useCallback(() => {
    setCreateModalType(activeTab === 'procedures' ? 'procedure' : 'scheduled');
    setShowCreateModal(true);
  }, [activeTab]);

  // Handle create procedure template
  const handleCreateProcedureTemplate = useCallback(() => {
    setCreateModalType('procedure');
    setShowCreateModal(true);
  }, []);

  // Loading state - must come AFTER all hooks
  if (hasChecklists === null) {
    return (
      <div className="page">
        <Breadcrumbs />
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '400px',
          color: 'var(--color-text-tertiary)'
        }}>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="page" style={{ padding: 0 }}>
      {/* Setup Wizard */}
      <SetupWizard
        isOpen={showWizard}
        onClose={handleWizardClose}
        onComplete={handleWizardComplete}
      />

      {/* Checklist Manager */}
      <ChecklistManager
        isOpen={showManager}
        onClose={handleManagerClose}
        onRefresh={() => setRefreshKey((k) => k + 1)}
      />

      {/* Create Checklist Modal */}
      <CreateChecklistModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleChecklistCreated}
        defaultType={createModalType}
      />

      {/* Page Header with Tabs */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '20px 24px',
        borderBottom: '1px solid var(--color-border, #e5e7eb)',
        background: 'var(--color-surface, #ffffff)',
      }}>
        {/* Title and Tab Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <h1 style={{
            margin: 0,
            fontSize: '24px',
            fontWeight: 700,
            color: 'var(--color-text-primary, #111827)',
          }}>
            Checklists
          </h1>

          {/* Tab Toggle */}
          <div style={{
            display: 'flex',
            gap: '4px',
            padding: '4px',
            background: 'var(--color-surface-muted, #f3f4f6)',
            borderRadius: '10px',
          }}>
            <button
              type="button"
              onClick={() => setActiveTab('schedule')}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: 600,
                color: activeTab === 'schedule' ? 'white' : 'var(--color-text-secondary, #6b7280)',
                background: activeTab === 'schedule' ? '#d4af37' : 'transparent',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                boxShadow: activeTab === 'schedule' ? '0 2px 8px rgba(212, 175, 55, 0.4)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              Schedule
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('procedures')}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: 600,
                color: activeTab === 'procedures' ? 'white' : 'var(--color-text-secondary, #6b7280)',
                background: activeTab === 'procedures' ? '#d4af37' : 'transparent',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                boxShadow: activeTab === 'procedures' ? '0 2px 8px rgba(212, 175, 55, 0.4)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              Procedures
            </button>
          </div>
        </div>

        {/* Header actions */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setShowManager(true)}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: 500,
              color: 'var(--color-text-secondary, #6b7280)',
              background: 'transparent',
              border: '1px solid var(--color-border, #e5e7eb)',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            Manage
          </button>
          <button
            type="button"
            onClick={handleCreateClick}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: 500,
              color: 'white',
              background: 'var(--color-primary, #8b5cf6)',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            + Add {activeTab === 'procedures' ? 'Procedure' : 'Checklist'}
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'schedule' ? (
        <AdminCalendarPage
          key={refreshKey}
          userId="demo-user"
          userName="Demo User"
          hideHeader
        />
      ) : (
        <ProceduresTab
          companyId="demo-company"
          userId="demo-user"
          userName="Demo User"
          onCreateTemplate={handleCreateProcedureTemplate}
          refreshKey={refreshKey}
        />
      )}
    </div>
  );
}
