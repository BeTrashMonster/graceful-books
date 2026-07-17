/**
 * Checklist Page
 *
 * Main page for the Admin Calendar - calendar-centric task and SOP management.
 * This replaces the previous checklist implementation with the new calendar view.
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
  createChecklist,
  createTask,
  getChecklists,
} from '../features/checklistCalendar';
import type { WizardChecklist } from '../features/checklistCalendar';

/**
 * Main Checklist page component - now using Admin Calendar
 */
export default function Checklist() {
  const [showWizard, setShowWizard] = useState(false);
  const [showManager, setShowManager] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
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
    // Refresh the calendar to show the new checklists
    setRefreshKey((k) => k + 1);
  }, []);

  // Handle wizard close
  const handleWizardClose = useCallback(() => {
    setShowWizard(false);
  }, []);

  // Handle manager close with refresh
  // IMPORTANT: All hooks must be called before any conditional returns
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
      />

      {/* Admin Calendar */}
      <AdminCalendarPage
        key={refreshKey}
        userId="demo-user"
        userName="Demo User"
      />

      {/* Quick actions */}
      {hasChecklists && !showWizard && !showManager && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          display: 'flex',
          gap: '12px',
        }}>
          <button
            type="button"
            onClick={() => setShowManager(true)}
            style={{
              padding: '12px 20px',
              fontSize: '14px',
              fontWeight: 500,
              color: 'var(--color-primary, #8b5cf6)',
              background: 'white',
              border: '1px solid var(--color-primary, #8b5cf6)',
              borderRadius: '8px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            }}
          >
            Manage Checklists
          </button>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            style={{
              padding: '12px 20px',
              fontSize: '14px',
              fontWeight: 500,
              color: 'white',
              background: 'var(--color-primary, #8b5cf6)',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)',
            }}
          >
            + New Checklist
          </button>
        </div>
      )}
    </div>
  );
}
