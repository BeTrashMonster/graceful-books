/**
 * UserExpandedPanel Component
 *
 * Tier 2: Expanded panel showing more user details when row is clicked.
 * Shows quick actions, recent emails, notes preview, and tags.
 */

import { useState } from 'react';
import { InfoCard, InfoGrid } from './InfoCard';
import { TagBadge } from './StatusBadge';
import styles from './UserExpandedPanel.module.css';

export interface EmailHistoryItem {
  id: string;
  emailType: string;
  subject: string;
  status: 'pending' | 'sent' | 'delivered' | 'bounced' | 'failed';
  sentAt: string | null;
  scheduledFor: string | null;
}

export interface NotePreview {
  id: string;
  note: string;
  noteType: string;
  createdAt: string;
  createdByName: string;
}

export interface UserExpandedData {
  userId: string;
  email: string;
  supportKey: string;
  createdAt: string;
  lastLoginAt: string | null;
  stripeCustomerId: string | null;
  subscriptionStatus: string | null;
  recentEmails: EmailHistoryItem[];
  recentNotes: NotePreview[];
  tags: string[];
  suppressions: Array<{ type: string; createdAt: string }>;
}

interface UserExpandedPanelProps {
  data: UserExpandedData;
  onViewDetails: () => void;
  onAddNote: () => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  onResendEmail: (emailId: string) => void;
  onCancelEmail: (emailId: string) => void;
  isLoading?: boolean;
}

export function UserExpandedPanel({
  data,
  onViewDetails,
  onAddNote,
  onAddTag,
  onRemoveTag,
  onResendEmail,
  onCancelEmail,
  isLoading = false,
}: UserExpandedPanelProps) {
  const [newTag, setNewTag] = useState('');

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const handleAddTag = () => {
    if (newTag.trim()) {
      onAddTag(newTag.trim());
      setNewTag('');
    }
  };

  const getEmailStatusClass = (status: EmailHistoryItem['status']): string => {
    switch (status) {
      case 'delivered':
        return styles.statusDelivered;
      case 'sent':
        return styles.statusSent;
      case 'pending':
        return styles.statusPending;
      case 'bounced':
      case 'failed':
        return styles.statusFailed;
      default:
        return '';
    }
  };

  return (
    <div className={`${styles.panel} ${isLoading ? styles.loading : ''}`}>
      {/* Quick actions */}
      <div className={styles.quickActions}>
        <button
          type="button"
          className={styles.actionButton}
          onClick={onViewDetails}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          Full Details
        </button>
        <button
          type="button"
          className={styles.actionButton}
          onClick={onAddNote}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          Add Note
        </button>
      </div>

      <div className={styles.content}>
        {/* Account info */}
        <div className={styles.column}>
          <InfoCard
            title="Account"
            variant="compact"
            items={[
              { label: 'Support Key', value: data.supportKey, copyable: true },
              { label: 'Created', value: formatDate(data.createdAt) },
              { label: 'Last Login', value: formatDate(data.lastLoginAt) },
              {
                label: 'Subscription',
                value: data.subscriptionStatus || 'None',
              },
            ]}
          />

          {/* Suppressions warning */}
          {data.suppressions.length > 0 && (
            <div className={styles.suppressionWarning}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <div>
                <strong>Email Suppressed</strong>
                <span>
                  {data.suppressions.map((s) => s.type).join(', ')}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Recent emails */}
        <div className={styles.column}>
          <div className={styles.sectionHeader}>
            <h4 className={styles.sectionTitle}>Recent Emails</h4>
          </div>
          {data.recentEmails.length > 0 ? (
            <ul className={styles.emailList}>
              {data.recentEmails.slice(0, 5).map((email) => (
                <li key={email.id} className={styles.emailItem}>
                  <div className={styles.emailInfo}>
                    <span className={styles.emailType}>{email.emailType}</span>
                    <span className={`${styles.emailStatus} ${getEmailStatusClass(email.status)}`}>
                      {email.status}
                    </span>
                  </div>
                  <span className={styles.emailDate}>
                    {formatDate(email.sentAt || email.scheduledFor)}
                  </span>
                  <div className={styles.emailActions}>
                    {email.status === 'pending' && (
                      <button
                        type="button"
                        className={styles.smallButton}
                        onClick={() => onCancelEmail(email.id)}
                        title="Cancel"
                      >
                        Cancel
                      </button>
                    )}
                    {(email.status === 'delivered' || email.status === 'sent') && (
                      <button
                        type="button"
                        className={styles.smallButton}
                        onClick={() => onResendEmail(email.id)}
                        title="Resend"
                      >
                        Resend
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.emptyMessage}>No emails sent yet</p>
          )}
        </div>

        {/* Tags */}
        <div className={styles.column}>
          <div className={styles.sectionHeader}>
            <h4 className={styles.sectionTitle}>Tags</h4>
          </div>
          <div className={styles.tagSection}>
            <div className={styles.tagList}>
              {data.tags.map((tag) => (
                <TagBadge
                  key={tag}
                  tag={tag}
                  onRemove={() => onRemoveTag(tag)}
                />
              ))}
              {data.tags.length === 0 && (
                <span className={styles.emptyMessage}>No tags</span>
              )}
            </div>
            <div className={styles.addTagForm}>
              <input
                type="text"
                className={styles.tagInput}
                placeholder="Add tag..."
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
              />
              <button
                type="button"
                className={styles.addTagButton}
                onClick={handleAddTag}
                disabled={!newTag.trim()}
              >
                Add
              </button>
            </div>
          </div>

          {/* Recent notes preview */}
          {data.recentNotes.length > 0 && (
            <div className={styles.notesPreview}>
              <div className={styles.sectionHeader}>
                <h4 className={styles.sectionTitle}>Recent Notes</h4>
              </div>
              <ul className={styles.notesList}>
                {data.recentNotes.slice(0, 2).map((note) => (
                  <li key={note.id} className={styles.noteItem}>
                    <p className={styles.noteText}>{note.note}</p>
                    <span className={styles.noteMeta}>
                      {note.createdByName} - {formatDate(note.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
