/**
 * ProceduresTab Component
 *
 * Displays procedure templates and their instances (in progress and completed).
 * Allows users to start new procedure instances and track progress.
 *
 * Layout:
 * - Templates section: Cards for each procedure template with "Start" button
 * - In Progress section: Active instances being worked on
 * - Completed section: Finished instances (collapsible)
 */

import { useState, useEffect, useCallback } from 'react';
import clsx from 'clsx';
import type { AdminChecklist } from '../../../../db/schema/checklistCalendar.schema';
import {
  getProcedureTemplates,
  getProcedureInstances,
  type ProcedureInstanceWithTemplate,
} from '../../services/ProcedureService';
import { getTasksForChecklist } from '../../services/TaskService';
import { StartProcedureModal } from '../StartProcedureModal';
import { ProcedureInstanceView } from '../ProcedureInstanceView';
import styles from './ProceduresTab.module.css';

// =============================================================================
// TYPES
// =============================================================================

export interface ProceduresTabProps {
  companyId: string;
  userId: string;
  userName: string;
  onCreateTemplate: () => void;
  refreshKey?: number;
}

interface TemplateWithTaskCount extends AdminChecklist {
  taskCount: number;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ProceduresTab({
  companyId,
  userId,
  userName,
  onCreateTemplate,
  refreshKey = 0,
}: ProceduresTabProps) {
  const [templates, setTemplates] = useState<TemplateWithTaskCount[]>([]);
  const [inProgressInstances, setInProgressInstances] = useState<ProcedureInstanceWithTemplate[]>([]);
  const [completedInstances, setCompletedInstances] = useState<ProcedureInstanceWithTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCompletedSection, setShowCompletedSection] = useState(false);

  // Modal states
  const [startModalTemplate, setStartModalTemplate] = useState<AdminChecklist | null>(null);
  const [viewingInstanceId, setViewingInstanceId] = useState<string | null>(null);

  // Load data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Load templates
      const templatesResult = await getProcedureTemplates(companyId);
      if (templatesResult.success) {
        // Get task counts for each template
        const templatesWithCounts = await Promise.all(
          templatesResult.data.map(async (template) => {
            const tasksResult = await getTasksForChecklist(template.id);
            return {
              ...template,
              taskCount: tasksResult.success ? tasksResult.data.length : 0,
            };
          })
        );
        setTemplates(templatesWithCounts);
      }

      // Load in-progress instances
      const inProgressResult = await getProcedureInstances(companyId, {
        status: 'in_progress',
        sortBy: 'started_at',
        sortDirection: 'desc',
      });
      if (inProgressResult.success) {
        setInProgressInstances(inProgressResult.data);
      }

      // Load completed instances (limit to recent ones)
      const completedResult = await getProcedureInstances(companyId, {
        status: ['completed', 'cancelled'],
        sortBy: 'updated_at',
        sortDirection: 'desc',
        limit: 10,
      });
      if (completedResult.success) {
        setCompletedInstances(completedResult.data);
      }
    } catch (error) {
      console.error('Failed to load procedures data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshKey]);

  // Handle start procedure
  const handleStartClick = (template: AdminChecklist) => {
    setStartModalTemplate(template);
  };

  // Handle procedure started
  const handleProcedureStarted = () => {
    setStartModalTemplate(null);
    loadData();
  };

  // Handle view instance
  const handleViewInstance = (instanceId: string) => {
    setViewingInstanceId(instanceId);
  };

  // Handle instance updated (refresh data)
  const handleInstanceUpdated = () => {
    loadData();
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading procedures...</div>
      </div>
    );
  }

  // If viewing an instance, show the instance view
  if (viewingInstanceId) {
    return (
      <ProcedureInstanceView
        instanceId={viewingInstanceId}
        userId={userId}
        userName={userName}
        onBack={() => setViewingInstanceId(null)}
        onUpdated={handleInstanceUpdated}
      />
    );
  }

  return (
    <div className={styles.container}>
      {/* Templates Section */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Templates</h2>
          <button
            type="button"
            className={styles.createButton}
            onClick={onCreateTemplate}
          >
            + Create Template
          </button>
        </div>

        {templates.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No procedure templates yet.</p>
            <button
              type="button"
              className={styles.emptyStateButton}
              onClick={onCreateTemplate}
            >
              Create your first procedure template
            </button>
          </div>
        ) : (
          <div className={styles.templateGrid}>
            {templates.map((template) => (
              <div
                key={template.id}
                className={styles.templateCard}
                style={{ '--template-color': template.color } as React.CSSProperties}
              >
                <div className={styles.templateHeader}>
                  <span
                    className={styles.templateColorDot}
                    style={{ backgroundColor: template.color }}
                  />
                  <span className={styles.templateName}>{template.name}</span>
                </div>
                {template.description && (
                  <p className={styles.templateDescription}>{template.description}</p>
                )}
                <div className={styles.templateFooter}>
                  <span className={styles.templateSteps}>{template.taskCount} steps</span>
                  <button
                    type="button"
                    className={styles.startButton}
                    onClick={() => handleStartClick(template)}
                  >
                    Start
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* In Progress Section */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          In Progress
          {inProgressInstances.length > 0 && (
            <span className={styles.sectionCount}>({inProgressInstances.length})</span>
          )}
        </h2>

        {inProgressInstances.length === 0 ? (
          <div className={styles.emptyStateSmall}>
            <p>No procedures in progress.</p>
          </div>
        ) : (
          <div className={styles.instanceList}>
            {inProgressInstances.map((instance) => (
              <button
                key={instance.id}
                type="button"
                className={styles.instanceCard}
                onClick={() => handleViewInstance(instance.id)}
                style={{ '--instance-color': instance.checklist.color } as React.CSSProperties}
              >
                <div className={styles.instanceMain}>
                  <span
                    className={styles.instanceColorDot}
                    style={{ backgroundColor: instance.checklist.color }}
                  />
                  <div className={styles.instanceInfo}>
                    <span className={styles.instanceName}>{instance.name}</span>
                    <span className={styles.instanceTemplate}>
                      {instance.checklist.name} · Started {formatRelativeTime(instance.started_at)}
                    </span>
                  </div>
                </div>
                <div className={styles.instanceProgress}>
                  <div className={styles.progressBar}>
                    <div
                      className={styles.progressFill}
                      style={{
                        width: `${instance.total_tasks > 0 ? (instance.completed_tasks / instance.total_tasks) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span className={styles.progressText}>
                    {instance.completed_tasks}/{instance.total_tasks}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Completed Section */}
      {completedInstances.length > 0 && (
        <section className={styles.section}>
          <button
            type="button"
            className={styles.sectionTitleButton}
            onClick={() => setShowCompletedSection(!showCompletedSection)}
          >
            <h2 className={styles.sectionTitle}>
              Completed
              <span className={styles.sectionCount}>({completedInstances.length})</span>
            </h2>
            <span className={styles.expandIcon}>
              {showCompletedSection ? '▼' : '▶'}
            </span>
          </button>

          {showCompletedSection && (
            <div className={styles.instanceList}>
              {completedInstances.map((instance) => (
                <button
                  key={instance.id}
                  type="button"
                  className={clsx(styles.instanceCard, styles.completedCard)}
                  onClick={() => handleViewInstance(instance.id)}
                >
                  <div className={styles.instanceMain}>
                    <span
                      className={styles.instanceColorDot}
                      style={{ backgroundColor: instance.checklist.color }}
                    />
                    <div className={styles.instanceInfo}>
                      <span className={styles.instanceName}>{instance.name}</span>
                      <span className={styles.instanceTemplate}>
                        {instance.checklist.name} · {instance.status === 'completed' ? 'Completed' : 'Cancelled'}{' '}
                        {formatRelativeTime(instance.completed_at || instance.updated_at)}
                      </span>
                    </div>
                  </div>
                  <div className={styles.instanceStatus}>
                    {instance.status === 'completed' ? (
                      <span className={styles.statusCompleted}>Done</span>
                    ) : (
                      <span className={styles.statusCancelled}>Cancelled</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Start Procedure Modal */}
      {startModalTemplate && (
        <StartProcedureModal
          template={startModalTemplate}
          companyId={companyId}
          userId={userId}
          userName={userName}
          onClose={() => setStartModalTemplate(null)}
          onStarted={handleProcedureStarted}
        />
      )}
    </div>
  );
}

// =============================================================================
// HELPERS
// =============================================================================

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return days === 1 ? 'yesterday' : `${days} days ago`;
  }
  if (hours > 0) {
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  }
  if (minutes > 0) {
    return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
  }
  return 'just now';
}

ProceduresTab.displayName = 'ProceduresTab';
