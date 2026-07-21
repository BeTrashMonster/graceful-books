/**
 * AdminCalendarPage
 *
 * Main page for the Admin Calendar feature.
 * Displays a calendar view with tasks and checklists.
 *
 * Requirements:
 * - CK-E: Calendar Page
 *
 * @see Roadmaps/ROADMAP_CHECKLIST_CALENDAR.md
 */

import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarMonth, TaskDetailModal, DayDetailPanel } from '../components';
import { useCalendar } from '../hooks';
import styles from './AdminCalendarPage.module.css';

// =============================================================================
// TYPES
// =============================================================================

export interface AdminCalendarPageProps {
  /**
   * Current user ID
   */
  userId?: string;

  /**
   * Current user name
   */
  userName?: string;

  /**
   * Hide the header (for when embedded in a page with its own header)
   */
  hideHeader?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function AdminCalendarPage({
  userId = 'demo-user',
  userName = 'Demo User',
  hideHeader = false,
}: AdminCalendarPageProps) {
  const navigate = useNavigate();

  const {
    currentDate,
    selectedDate,
    calendarData,
    selectedTask,
    selectedTaskChecklist,
    taskComments,
    viewMode,
    isLoading,
    isTaskModalOpen,
    error,
    goToPreviousMonth,
    goToNextMonth,
    goToToday,
    selectDate,
    selectTask,
    closeTaskModal,
    toggleTaskComplete,
    updateTaskTitle,
    updateTaskDescription,
    updateTaskPriority,
    updateTaskFeatureLink,
    updateTaskDaysOfWeek,
    addSubTask,
    toggleSubTask,
    deleteSubTask,
    deleteTask,
    addComment,
    removeComment,
    toggleViewMode,
  } = useCalendar({ userId });

  // Handle feature link navigation
  const handleFeatureLinkClick = useCallback(
    (path: string) => {
      closeTaskModal();
      navigate(path);
    },
    [closeTaskModal, navigate]
  );

  // Handle task click from calendar
  const handleTaskClick = useCallback(
    (taskId: string, date: Date) => {
      selectTask(taskId, date);
    },
    [selectTask]
  );

  // Handle task toggle from calendar
  const handleTaskToggle = useCallback(
    (taskId: string, date: Date) => {
      toggleTaskComplete(taskId, date);
    },
    [toggleTaskComplete]
  );

  // Get selected day data
  const selectedDay = useMemo(() => {
    if (!selectedDate || !calendarData?.days) return null;
    return calendarData.days.find(
      (d) => d.date.toDateString() === selectedDate.toDateString()
    ) || null;
  }, [selectedDate, calendarData]);

  // Check if selected task is complete for the selected date
  const isSelectedTaskComplete = useMemo(() => {
    if (!selectedTask || !selectedDay) return false;

    const calendarTask = selectedDay.tasks.find(
      (t) => t.task.id === selectedTask.task.id
    );
    return calendarTask?.isComplete || false;
  }, [selectedTask, selectedDay]);

  return (
    <div className={styles.page}>
      {/* Header - can be hidden when embedded */}
      {!hideHeader && (
        <header className={styles.header}>
          <div className={styles.headerContent}>
            <h1 className={styles.title}>Admin Calendar</h1>
            <p className={styles.subtitle}>
              Manage your recurring tasks and checklists
            </p>
          </div>
          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.viewToggle}
              onClick={toggleViewMode}
              aria-pressed={viewMode === 'incomplete'}
            >
              {viewMode === 'incomplete' ? 'Show All Tasks' : 'Show Incomplete Only'}
            </button>
          </div>
        </header>
      )}

      {/* Error banner */}
      {error && (
        <div className={styles.errorBanner} role="alert">
          <span className={styles.errorIcon}>⚠</span>
          <span>{error}</span>
        </div>
      )}

      {/* Day Detail and Calendar */}
      <main className={styles.main}>
        <div className={styles.dayDetailSection}>
          <DayDetailPanel
            day={selectedDay}
            onTaskClick={handleTaskClick}
            onTaskToggle={handleTaskToggle}
          />
        </div>
        <div className={styles.calendarSection}>
          <CalendarMonth
            data={calendarData}
            isLoading={isLoading}
            selectedDate={selectedDate || undefined}
            onDateSelect={selectDate}
            onPreviousMonth={goToPreviousMonth}
            onNextMonth={goToNextMonth}
            onToday={goToToday}
            onTaskClick={handleTaskClick}
            onTaskToggle={handleTaskToggle}
            showSummary
          />
        </div>
      </main>

      {/* Task Detail Modal */}
      {selectedTask && selectedTaskChecklist && (
        <TaskDetailModal
          task={selectedTask}
          checklist={selectedTaskChecklist}
          isComplete={isSelectedTaskComplete}
          comments={taskComments}
          isOpen={isTaskModalOpen}
          currentUserId={userId}
          currentUserName={userName}
          onClose={closeTaskModal}
          onUpdateTitle={updateTaskTitle}
          onUpdateDescription={updateTaskDescription}
          onUpdatePriority={updateTaskPriority}
          onUpdateFeatureLink={updateTaskFeatureLink}
          onToggleComplete={() =>
            selectedDate && toggleTaskComplete(selectedTask.task.id, selectedDate)
          }
          onAddSubTask={addSubTask}
          onToggleSubTask={toggleSubTask}
          onDeleteSubTask={deleteSubTask}
          onAddComment={addComment}
          onDeleteComment={removeComment}
          onFeatureLinkClick={handleFeatureLinkClick}
          onDelete={deleteTask}
          onUpdateDaysOfWeek={updateTaskDaysOfWeek}
          canDelete
        />
      )}
    </div>
  );
}

AdminCalendarPage.displayName = 'AdminCalendarPage';
