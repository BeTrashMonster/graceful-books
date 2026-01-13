/**
 * QuickActions Component
 *
 * Displays quick action buttons for common tasks
 */

import { ReactNode } from 'react';
import styles from './QuickActions.module.css';

export interface QuickAction {
  id: string;
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}

export interface QuickActionsProps {
  actions: QuickAction[];
  title?: string;
  className?: string;
}

export function QuickActions({
  actions,
  title = 'Quick Actions',
  className = '',
}: QuickActionsProps) {
  if (actions.length === 0) {
    return null;
  }

  return (
    <div className={`${styles.container} ${className}`}>
      <h2 className={styles.title}>{title}</h2>

      <div className={styles.grid} role="group" aria-label={title}>
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={action.onClick}
            disabled={action.disabled}
            className={`${styles.action} ${styles[action.variant || 'secondary']}`}
            aria-label={action.label}
          >
            {action.icon && (
              <span className={styles.icon} aria-hidden="true">
                {action.icon}
              </span>
            )}
            <span className={styles.label}>{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
