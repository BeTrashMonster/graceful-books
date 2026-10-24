/**
 * UserRow Component
 *
 * Tier 1: Displays a single user row in the admin user list.
 * Shows key information at a glance with expand/collapse functionality.
 */

import { useState } from 'react';
import { StatusBadge, WorkshopBadge, TagBadge } from './StatusBadge';
import styles from './UserRow.module.css';

export interface UserStatusBadge {
  label: string;
  variant: 'success' | 'warning' | 'error' | 'info' | 'purple';
  details?: string;
}

export interface UserWorkshop {
  id: string;
  shortName: string;
  cohortName: string;
}

export interface UserRowData {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  supportKey: string;
  productSlug: string;
  productName: string;
  createdAt: string;
  lastLoginAt: string | null;
  isBeta: boolean;
  needsAttention: boolean;
  statusBadge: UserStatusBadge;
  workshops: UserWorkshop[];
  tags: string[];
}

interface UserRowProps {
  user: UserRowData;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onViewDetails: () => void;
  children?: React.ReactNode; // Expanded panel content
}

export function UserRow({
  user,
  isExpanded,
  onToggleExpand,
  onViewDetails,
  children,
}: UserRowProps) {
  const displayName = user.firstName || user.lastName
    ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
    : null;

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const timeSince = (dateString: string | null): string => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  return (
    <div className={`${styles.container} ${isExpanded ? styles.expanded : ''}`}>
      <div
        className={styles.row}
        onClick={onToggleExpand}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggleExpand();
          }
        }}
        aria-expanded={isExpanded}
      >
        {/* Expand indicator */}
        <div className={styles.expandIndicator}>
          <svg
            className={`${styles.chevron} ${isExpanded ? styles.chevronExpanded : ''}`}
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>

        {/* User info */}
        <div className={styles.userInfo}>
          <div className={styles.nameRow}>
            <span className={styles.name}>{displayName || user.email}</span>
            {user.needsAttention && (
              <span className={styles.attentionDot} title="Needs attention" />
            )}
          </div>
          {displayName && <span className={styles.email}>{user.email}</span>}
          <span className={styles.supportKey}>{user.supportKey}</span>
        </div>

        {/* Status badges */}
        <div className={styles.badgeColumn}>
          <StatusBadge
            label={user.statusBadge.label}
            variant={user.statusBadge.variant}
            details={user.statusBadge.details}
            size="small"
          />
          {user.isBeta && (
            <StatusBadge label="BETA" variant="purple" size="small" />
          )}
        </div>

        {/* Product */}
        <div className={styles.productColumn}>
          <span className={styles.productName}>{user.productName}</span>
        </div>

        {/* Workshops */}
        <div className={styles.workshopColumn}>
          {user.workshops.length > 0 ? (
            <div className={styles.workshopBadges}>
              {user.workshops.slice(0, 2).map((w) => (
                <WorkshopBadge
                  key={w.id}
                  shortName={w.shortName}
                  cohortName={w.cohortName}
                />
              ))}
              {user.workshops.length > 2 && (
                <span className={styles.moreCount}>
                  +{user.workshops.length - 2}
                </span>
              )}
            </div>
          ) : (
            <span className={styles.noData}>-</span>
          )}
        </div>

        {/* Last login */}
        <div className={styles.dateColumn}>
          <span className={styles.dateRelative}>{timeSince(user.lastLoginAt)}</span>
          <span className={styles.dateAbsolute}>{formatDate(user.lastLoginAt)}</span>
        </div>

        {/* Tags */}
        <div className={styles.tagColumn}>
          {user.tags.length > 0 ? (
            <div className={styles.tagList}>
              {user.tags.slice(0, 2).map((tag) => (
                <TagBadge key={tag} tag={tag} />
              ))}
              {user.tags.length > 2 && (
                <span className={styles.moreCount}>+{user.tags.length - 2}</span>
              )}
            </div>
          ) : (
            <span className={styles.noData}>-</span>
          )}
        </div>

        {/* Actions */}
        <div className={styles.actionsColumn}>
          <button
            type="button"
            className={styles.viewButton}
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails();
            }}
            aria-label={`View details for ${displayName || user.email}`}
          >
            View
          </button>
        </div>
      </div>

      {/* Expanded panel */}
      {isExpanded && children && (
        <div className={styles.expandedPanel}>{children}</div>
      )}
    </div>
  );
}

/**
 * UserRowHeader Component
 * Column headers for the user list
 */
export function UserRowHeader() {
  return (
    <div className={styles.header}>
      <div className={styles.expandIndicator} />
      <div className={styles.userInfo}>User</div>
      <div className={styles.badgeColumn}>Status</div>
      <div className={styles.productColumn}>Product</div>
      <div className={styles.workshopColumn}>Workshops</div>
      <div className={styles.dateColumn}>Last Login</div>
      <div className={styles.tagColumn}>Tags</div>
      <div className={styles.actionsColumn}>Actions</div>
    </div>
  );
}
