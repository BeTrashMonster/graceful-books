/**
 * UserDetailsPage
 *
 * Tier 3: Full user details page with comprehensive information and actions.
 * Accessible via /admin/users/:userId
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_URL } from '../../config/api';
import { StatusBadge, TagBadge, SubscriptionManagement, ActivityTab } from '../../components/admin/users';
import type { SubscriptionData } from '../../components/admin/users';
import { InfoCard, InfoGrid, InfoSection } from '../../components/admin/users/InfoCard';
import styles from './UserDetailsPage.module.css';

interface UserDetails {
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
  emailVerified: boolean;
  isBeta: boolean;
  needsAttention: boolean;
  stripeCustomerId: string | null;
  subscriptionId: string | null;
  subscriptionStatus: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  frozenAt: string | null;
  frozenReason: string | null;
  pausedAt: string | null;
  pausedUntil: string | null;
  cancelledAt: string | null;
  statusBadge: {
    label: string;
    variant: 'success' | 'warning' | 'error' | 'info' | 'purple';
    details?: string;
  };
  workshops: Array<{
    id: string;
    name: string;
    cohortName: string;
    status: string;
    enrolledAt: string;
  }>;
  tags: string[];
  suppressions: Array<{
    type: string;
    reason: string | null;
    createdAt: string;
  }>;
}

interface EmailRecord {
  id: string;
  emailType: string;
  subject: string;
  status: 'pending' | 'sent' | 'delivered' | 'bounced' | 'failed';
  sentAt: string | null;
  scheduledFor: string | null;
  deliveredAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  htmlContent?: string;
}

interface NoteRecord {
  id: string;
  note: string;
  noteType: string;
  createdAt: string;
  updatedAt: string;
  createdByName: string;
  updatedByName: string | null;
}

/**
 * Transform backend nested response to flat UserDetails structure
 */
function transformUserDetails(data: Record<string, unknown>): UserDetails {
  const summary = (data.summary || {}) as Record<string, unknown>;
  const cards = (data.cards || {}) as Record<string, unknown>;
  const account = (cards.account || {}) as Record<string, unknown>;
  const subscription = (cards.subscription || {}) as Record<string, unknown>;
  const health = (cards.health || {}) as Record<string, unknown>;
  const workshop = cards.workshop as Record<string, unknown> | null;
  const products = (subscription.products || []) as Array<Record<string, unknown>>;
  const firstProduct = products[0] || {};
  const statusBadge = (summary.statusBadge || { label: 'UNKNOWN', variant: 'info' }) as UserDetails['statusBadge'];

  // Build workshops array
  const workshops: UserDetails['workshops'] = [];
  if (workshop) {
    workshops.push({
      id: String(workshop.workshopId || ''),
      name: String(workshop.cohortName || 'Workshop'),
      cohortName: String(workshop.cohortName || ''),
      status: String(workshop.status || 'active'),
      enrolledAt: String(workshop.enrolledAt || ''),
    });
  }

  // Build suppressions array
  const suppressionsData = Array.isArray(data.suppressions) ? data.suppressions : [];
  const suppressions: UserDetails['suppressions'] = suppressionsData.map((s: Record<string, unknown>) => ({
    type: String(s.type || ''),
    reason: (s.reason || null) as string | null,
    createdAt: String(s.createdAt || ''),
  }));

  // Extract name parts from summary.name
  const fullName = String(summary.name || '');
  const nameParts = fullName.split(' ');
  const firstName = nameParts[0] || null;
  const lastName = nameParts.slice(1).join(' ') || null;

  return {
    id: String(summary.id || data.id || ''),
    email: String(summary.email || ''),
    firstName,
    lastName,
    companyName: (summary.companyName || null) as string | null,
    supportKey: String(summary.supportKey || ''),
    productSlug: String(firstProduct.slug || ''),
    productName: String(firstProduct.name || firstProduct.slug || 'No Product'),
    createdAt: String(account.createdAt || ''),
    lastLoginAt: (account.lastLoginAt || null) as string | null,
    emailVerified: Boolean(account.emailVerified),
    isBeta: Boolean(summary.isBeta || account.isBeta),
    needsAttention: Boolean(health.isFrozen || health.hasPaymentIssue),
    stripeCustomerId: (firstProduct.stripeCustomerId || null) as string | null,
    subscriptionId: (firstProduct.stripeSubscriptionId || null) as string | null,
    subscriptionStatus: (firstProduct.status || null) as string | null,
    currentPeriodStart: (firstProduct.currentPeriodStart || null) as string | null,
    currentPeriodEnd: (firstProduct.currentPeriodEnd || null) as string | null,
    frozenAt: health.isFrozen ? 'frozen' : null,
    frozenReason: (health.frozenReason || null) as string | null,
    pausedAt: (firstProduct.pausedAt || null) as string | null,
    pausedUntil: null,
    cancelledAt: (firstProduct.cancelledAt || null) as string | null,
    statusBadge,
    workshops,
    tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
    suppressions,
  };
}

export default function UserDetailsPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();

  const [user, setUser] = useState<UserDetails | null>(null);
  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showAddNote, setShowAddNote] = useState(false);
  const [showEditNote, setShowEditNote] = useState<NoteRecord | null>(null);
  const [showAddTag, setShowAddTag] = useState(false);
  const [showFreezeModal, setShowFreezeModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Form states
  const [newNote, setNewNote] = useState({ note: '', noteType: 'general' });
  const [newTag, setNewTag] = useState('');
  const [freezeReason, setFreezeReason] = useState('');
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('');
  const [deleteReason, setDeleteReason] = useState('');

  // Email pagination & preview
  const [emailPage, setEmailPage] = useState(1);
  const [previewEmail, setPreviewEmail] = useState<EmailRecord | null>(null);
  const emailsPerPage = 6;

  // Get admin session
  const getSession = useCallback(() => {
    const sessionData = sessionStorage.getItem('graceful_books_admin_session');
    if (!sessionData) {
      navigate('/admin/login');
      return null;
    }
    return JSON.parse(sessionData);
  }, [navigate]);

  // Fetch user details
  const fetchUser = useCallback(async () => {
    const session = getSession();
    if (!session || !userId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/admin/users/${userId}/details`, {
        headers: {
          'Authorization': `Bearer ${session.token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user details');
      }

      const responseData = await response.json();
      // Unwrap the API response - backend wraps data in { data: ... }
      const detailsData = responseData.data || responseData;
      setUser(transformUserDetails(detailsData));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user');
    } finally {
      setIsLoading(false);
    }
  }, [userId, getSession]);

  // Fetch email history
  const fetchEmails = useCallback(async () => {
    const session = getSession();
    if (!session || !userId) return;

    try {
      const response = await fetch(`${API_URL}/admin/users/${userId}/emails`, {
        headers: {
          'Authorization': `Bearer ${session.token}`,
        },
      });

      if (response.ok) {
        const responseData = await response.json();
        const emailData = responseData.data || responseData;
        setEmails(emailData.emails || []);
      }
    } catch (err) {
      console.error('Failed to fetch emails:', err);
    }
  }, [userId, getSession]);

  // Fetch notes
  const fetchNotes = useCallback(async () => {
    const session = getSession();
    if (!session || !userId) return;

    try {
      const response = await fetch(`${API_URL}/admin/users/${userId}/notes`, {
        headers: {
          'Authorization': `Bearer ${session.token}`,
        },
      });

      if (response.ok) {
        const responseData = await response.json();
        const notesData = responseData.data || responseData;
        setNotes(notesData.notes || []);
      }
    } catch (err) {
      console.error('Failed to fetch notes:', err);
    }
  }, [userId, getSession]);

  // Fetch subscriptions
  const fetchSubscriptions = useCallback(async () => {
    const session = getSession();
    if (!session || !userId) return;

    try {
      const response = await fetch(`${API_URL}/admin/users/${userId}/subscriptions`, {
        headers: {
          'Authorization': `Bearer ${session.token}`,
        },
      });

      if (response.ok) {
        const responseData = await response.json();
        const subscriptionsData = responseData.data || responseData;
        setSubscriptions(subscriptionsData.subscriptions || []);
      }
    } catch (err) {
      console.error('Failed to fetch subscriptions:', err);
    }
  }, [userId, getSession]);

  // Initial load
  useEffect(() => {
    fetchUser();
    fetchEmails();
    fetchNotes();
    fetchSubscriptions();
  }, [fetchUser, fetchEmails, fetchNotes, fetchSubscriptions]);

  // Add note
  const handleAddNote = async () => {
    const session = getSession();
    if (!session || !userId || !newNote.note.trim()) return;

    try {
      const response = await fetch(`${API_URL}/admin/users/${userId}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.token}`,
        },
        body: JSON.stringify(newNote),
      });

      if (!response.ok) throw new Error('Failed to add note');

      setNewNote({ note: '', noteType: 'general' });
      setShowAddNote(false);
      fetchNotes();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add note');
    }
  };

  // Update note
  const handleUpdateNote = async () => {
    const session = getSession();
    if (!session || !userId || !showEditNote) return;

    try {
      const response = await fetch(
        `${API_URL}/admin/users/${userId}/notes/${showEditNote.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.token}`,
          },
          body: JSON.stringify({ note: showEditNote.note }),
        }
      );

      if (!response.ok) throw new Error('Failed to update note');

      setShowEditNote(null);
      fetchNotes();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update note');
    }
  };

  // Delete note
  const handleDeleteNote = async (noteId: string) => {
    const session = getSession();
    if (!session || !userId) return;

    if (!confirm('Delete this note?')) return;

    try {
      const response = await fetch(
        `${API_URL}/admin/users/${userId}/notes/${noteId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session.token}`,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to delete note');

      fetchNotes();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete note');
    }
  };

  // Add tag
  const handleAddTag = async () => {
    const session = getSession();
    if (!session || !userId || !newTag.trim()) return;

    try {
      const response = await fetch(`${API_URL}/admin/users/${userId}/tags`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.token}`,
        },
        body: JSON.stringify({ tag: newTag }),
      });

      if (!response.ok) throw new Error('Failed to add tag');

      setNewTag('');
      setShowAddTag(false);
      fetchUser();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add tag');
    }
  };

  // Remove tag
  const handleRemoveTag = async (tag: string) => {
    const session = getSession();
    if (!session || !userId) return;

    try {
      const response = await fetch(
        `${API_URL}/admin/users/${userId}/tags/${encodeURIComponent(tag)}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session.token}`,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to remove tag');

      fetchUser();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove tag');
    }
  };

  // Freeze user
  const handleFreeze = async () => {
    const session = getSession();
    if (!session || !userId) return;

    try {
      const response = await fetch(`${API_URL}/admin/users/${userId}/freeze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.token}`,
        },
        body: JSON.stringify({ reason: freezeReason }),
      });

      if (!response.ok) throw new Error('Failed to freeze user');

      setShowFreezeModal(false);
      setFreezeReason('');
      fetchUser();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to freeze user');
    }
  };

  // Unfreeze user
  const handleUnfreeze = async () => {
    const session = getSession();
    if (!session || !userId) return;

    if (!confirm('Unfreeze this user? They will regain access to their account.')) return;

    try {
      const response = await fetch(`${API_URL}/admin/users/${userId}/unfreeze`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to unfreeze user');

      fetchUser();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to unfreeze user');
    }
  };

  // Delete user
  const handleDelete = async () => {
    const session = getSession();
    if (!session || !userId || !user) return;

    if (deleteConfirmEmail !== user.email) {
      alert('Email does not match');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.token}`,
        },
        body: JSON.stringify({
          confirmEmail: deleteConfirmEmail,
          reason: deleteReason,
        }),
      });

      if (!response.ok) throw new Error('Failed to delete user');

      navigate('/admin/users');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete user');
    }
  };

  // Export user data (GDPR)
  const handleExportData = async () => {
    const session = getSession();
    if (!session || !userId) return;

    try {
      const response = await fetch(`${API_URL}/admin/users/${userId}/export`, {
        headers: {
          'Authorization': `Bearer ${session.token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to export data');

      const data = await response.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `user-export-${userId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to export data');
    }
  };

  // Resend email
  const handleResendEmail = async (emailId: string) => {
    const session = getSession();
    if (!session || !userId) return;

    try {
      const response = await fetch(
        `${API_URL}/admin/users/${userId}/emails/${emailId}/resend`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.token}`,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to resend email');

      alert('Email queued for resend');
      fetchEmails();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to resend email');
    }
  };

  // Format date helper
  const formatDate = (dateString: string | null, includeTime = false): string => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    if (includeTime) {
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    }
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>Loading user details...</div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className={styles.page}>
        <div className={styles.error}>
          <p>{error || 'User not found'}</p>
          <button onClick={() => navigate('/admin/users')}>Back to Users</button>
        </div>
      </div>
    );
  }

  const displayName = user.firstName || user.lastName
    ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
    : user.email;

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Header */}
        <header className={styles.header}>
          <button
            type="button"
            className={styles.backButton}
            onClick={() => navigate('/admin/users')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to Users
          </button>

          <div className={styles.headerContent}>
            <div className={styles.headerInfo}>
              <h1 className={styles.title}>{displayName}</h1>
              <p className={styles.email}>{user.email}</p>
              <div className={styles.badges}>
                {user.statusBadge && (
                  <StatusBadge
                    label={user.statusBadge.label}
                    variant={user.statusBadge.variant}
                    details={user.statusBadge.details}
                  />
                )}
                {user.isBeta && <StatusBadge label="BETA" variant="purple" />}
                {user.needsAttention && (
                  <span className={styles.attentionBadge}>Needs Attention</span>
                )}
              </div>
            </div>

            <div className={styles.headerActions}>
              <button
                type="button"
                className={styles.actionButton}
                onClick={handleExportData}
              >
                Export Data
              </button>
              {user.frozenAt ? (
                <button
                  type="button"
                  className={`${styles.actionButton} ${styles.success}`}
                  onClick={handleUnfreeze}
                >
                  Unfreeze Account
                </button>
              ) : (
                <button
                  type="button"
                  className={`${styles.actionButton} ${styles.warning}`}
                  onClick={() => setShowFreezeModal(true)}
                >
                  Freeze Account
                </button>
              )}
              <button
                type="button"
                className={`${styles.actionButton} ${styles.danger}`}
                onClick={() => setShowDeleteModal(true)}
              >
                Delete User
              </button>
            </div>
          </div>
        </header>

        {/* Suppression warnings */}
        {user.suppressions.length > 0 && (
          <div className={styles.suppressionBanner}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div>
              <strong>Email Suppressed</strong>
              <p>
                This user has email suppressions: {user.suppressions.map(s => s.type).join(', ')}
              </p>
            </div>
          </div>
        )}

        {/* Main content */}
        <div className={styles.content}>
          {/* Left column */}
          <div className={styles.mainColumn}>
            {/* Account Info */}
            <InfoSection title="Account Information">
              <InfoGrid columns={2}>
                <InfoCard
                  title="Profile"
                  items={[
                    { label: 'Email', value: user.email, copyable: true },
                    { label: 'Support Key', value: user.supportKey, copyable: true },
                    { label: 'Company', value: user.companyName || 'Not set' },
                    { label: 'Email Verified', value: user.emailVerified ? 'Yes' : 'No' },
                  ]}
                />
                <InfoCard
                  title="Activity"
                  items={[
                    { label: 'Created', value: formatDate(user.createdAt) },
                    { label: 'Last Login', value: formatDate(user.lastLoginAt) },
                    { label: 'Product', value: user.productName },
                    { label: 'Beta User', value: user.isBeta ? 'Yes' : 'No' },
                  ]}
                />
              </InfoGrid>
            </InfoSection>

            {/* Subscription */}
            <InfoSection title="Subscription">
              <InfoCard
                title="Billing"
                items={[
                  { label: 'Status', value: user.subscriptionStatus || 'None' },
                  { label: 'Stripe Customer', value: user.stripeCustomerId || 'Not linked', copyable: !!user.stripeCustomerId },
                  { label: 'Subscription ID', value: user.subscriptionId || 'None', copyable: !!user.subscriptionId },
                  { label: 'Current Period', value: user.currentPeriodEnd ? `Ends ${formatDate(user.currentPeriodEnd)}` : 'N/A' },
                ]}
              />
              {user.frozenAt && (
                <div className={styles.statusCard}>
                  <h4>Account Frozen</h4>
                  <p>Frozen on: {formatDate(user.frozenAt, true)}</p>
                  {user.frozenReason && <p>Reason: {user.frozenReason}</p>}
                </div>
              )}
              {user.pausedAt && (
                <div className={styles.statusCard}>
                  <h4>Account Paused</h4>
                  <p>Paused on: {formatDate(user.pausedAt, true)}</p>
                  {user.pausedUntil && <p>Resumes: {formatDate(user.pausedUntil)}</p>}
                </div>
              )}
              {user.cancelledAt && (
                <div className={styles.statusCard}>
                  <h4>Subscription Cancelled</h4>
                  <p>Cancelled on: {formatDate(user.cancelledAt, true)}</p>
                </div>
              )}
              {userId && (
                <SubscriptionManagement
                  userId={userId}
                  subscriptions={subscriptions}
                  onRefresh={() => {
                    fetchSubscriptions();
                    fetchUser();
                  }}
                />
              )}
            </InfoSection>

            {/* Workshops */}
            {user.workshops.length > 0 && (
              <InfoSection title="Workshop Enrollments">
                <div className={styles.workshopList}>
                  {user.workshops.map((workshop) => (
                    <div key={workshop.id} className={styles.workshopItem}>
                      <div>
                        <strong>{workshop.name}</strong>
                        <span className={styles.cohortName}>{workshop.cohortName}</span>
                      </div>
                      <div className={styles.workshopMeta}>
                        <span className={`${styles.workshopStatus} ${styles[workshop.status]}`}>
                          {workshop.status}
                        </span>
                        <span>Enrolled {formatDate(workshop.enrolledAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </InfoSection>
            )}

            {/* Email History */}
            <InfoSection title="Email History">
              <div className={styles.emailHistory}>
                {emails.length === 0 ? (
                  <p className={styles.emptyState}>No emails sent yet</p>
                ) : (
                  <>
                    <table className={styles.emailTable}>
                      <thead>
                        <tr>
                          <th>Type</th>
                          <th>Subject</th>
                          <th>Status</th>
                          <th>Sent</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {emails
                          .slice((emailPage - 1) * emailsPerPage, emailPage * emailsPerPage)
                          .map((email) => (
                          <tr key={email.id}>
                            <td>{email.emailType}</td>
                            <td>{email.subject || '-'}</td>
                            <td>
                              <span className={`${styles.emailStatus} ${styles[email.status]}`}>
                                {email.status}
                              </span>
                            </td>
                            <td>{formatDate(email.sentAt || email.scheduledFor, true)}</td>
                            <td className={styles.emailActions}>
                              <button
                                type="button"
                                className={styles.smallButton}
                                onClick={() => setPreviewEmail(email)}
                                title="Preview email"
                              >
                                View
                              </button>
                              {(email.status === 'sent' || email.status === 'delivered') && (
                                <button
                                  type="button"
                                  className={styles.smallButton}
                                  onClick={() => handleResendEmail(email.id)}
                                >
                                  Resend
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {/* Pagination */}
                    {emails.length > emailsPerPage && (
                      <div className={styles.emailPagination}>
                        <button
                          type="button"
                          onClick={() => setEmailPage(p => Math.max(1, p - 1))}
                          disabled={emailPage === 1}
                          className={styles.paginationButton}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="15 18 9 12 15 6" />
                          </svg>
                        </button>
                        <span className={styles.paginationInfo}>
                          {emailPage} of {Math.ceil(emails.length / emailsPerPage)}
                        </span>
                        <button
                          type="button"
                          onClick={() => setEmailPage(p => Math.min(Math.ceil(emails.length / emailsPerPage), p + 1))}
                          disabled={emailPage >= Math.ceil(emails.length / emailsPerPage)}
                          className={styles.paginationButton}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </InfoSection>

            {/* Activity */}
            {userId && (
              <InfoSection title="Activity History">
                <ActivityTab userId={userId} />
              </InfoSection>
            )}
          </div>

          {/* Right column */}
          <div className={styles.sideColumn}>
            {/* Tags */}
            <div className={styles.sideSection}>
              <div className={styles.sectionHeader}>
                <h3>Tags</h3>
                <button
                  type="button"
                  className={styles.addButton}
                  onClick={() => setShowAddTag(true)}
                >
                  + Add
                </button>
              </div>
              <div className={styles.tagList}>
                {user.tags.length === 0 ? (
                  <p className={styles.emptyState}>No tags</p>
                ) : (
                  user.tags.map((tag) => (
                    <TagBadge
                      key={tag}
                      tag={tag}
                      onRemove={() => handleRemoveTag(tag)}
                    />
                  ))
                )}
              </div>
              {showAddTag && (
                <div className={styles.inlineForm}>
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="Enter tag..."
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                  />
                  <button type="button" onClick={handleAddTag}>Add</button>
                  <button type="button" onClick={() => setShowAddTag(false)}>Cancel</button>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className={styles.sideSection}>
              <div className={styles.sectionHeader}>
                <h3>Notes</h3>
                <button
                  type="button"
                  className={styles.addButton}
                  onClick={() => setShowAddNote(true)}
                >
                  + Add
                </button>
              </div>
              <div className={styles.notesList}>
                {notes.length === 0 ? (
                  <p className={styles.emptyState}>No notes</p>
                ) : (
                  notes.map((note) => (
                    <div key={note.id} className={styles.noteItem}>
                      <div className={styles.noteHeader}>
                        <span className={`${styles.noteType} ${styles[note.noteType]}`}>
                          {note.noteType}
                        </span>
                        <div className={styles.noteActions}>
                          <button
                            type="button"
                            onClick={() => setShowEditNote(note)}
                            title="Edit"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteNote(note.id)}
                            title="Delete"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      <p className={styles.noteText}>{note.note}</p>
                      <span className={styles.noteMeta}>
                        {note.createdByName} - {formatDate(note.createdAt, true)}
                        {note.updatedByName && ` (edited by ${note.updatedByName})`}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Add Note Modal */}
        {showAddNote && (
          <div className={styles.modal} onClick={() => setShowAddNote(false)}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <h3>Add Note</h3>
              <div className={styles.formGroup}>
                <label>Type</label>
                <select
                  value={newNote.noteType}
                  onChange={(e) => setNewNote({ ...newNote, noteType: e.target.value })}
                >
                  <option value="general">General</option>
                  <option value="support">Support</option>
                  <option value="billing">Billing</option>
                  <option value="technical">Technical</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label>Note</label>
                <textarea
                  value={newNote.note}
                  onChange={(e) => setNewNote({ ...newNote, note: e.target.value })}
                  rows={4}
                  placeholder="Enter note..."
                />
              </div>
              <div className={styles.modalActions}>
                <button type="button" onClick={() => setShowAddNote(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.primary}
                  onClick={handleAddNote}
                  disabled={!newNote.note.trim()}
                >
                  Add Note
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Note Modal */}
        {showEditNote && (
          <div className={styles.modal} onClick={() => setShowEditNote(null)}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <h3>Edit Note</h3>
              <div className={styles.formGroup}>
                <label>Note</label>
                <textarea
                  value={showEditNote.note}
                  onChange={(e) => setShowEditNote({ ...showEditNote, note: e.target.value })}
                  rows={4}
                />
              </div>
              <div className={styles.modalActions}>
                <button type="button" onClick={() => setShowEditNote(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.primary}
                  onClick={handleUpdateNote}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Freeze Modal */}
        {showFreezeModal && (
          <div className={styles.modal} onClick={() => setShowFreezeModal(false)}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <h3>Freeze Account</h3>
              <p className={styles.modalWarning}>
                Freezing this account will prevent the user from accessing their data.
                They will see a message explaining their account is frozen.
              </p>
              <div className={styles.formGroup}>
                <label>Reason (visible to user)</label>
                <textarea
                  value={freezeReason}
                  onChange={(e) => setFreezeReason(e.target.value)}
                  rows={3}
                  placeholder="Enter reason for freezing..."
                />
              </div>
              <div className={styles.modalActions}>
                <button type="button" onClick={() => setShowFreezeModal(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.warning}
                  onClick={handleFreeze}
                >
                  Freeze Account
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Modal */}
        {showDeleteModal && (
          <div className={styles.modal} onClick={() => setShowDeleteModal(false)}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <h3>Delete User</h3>
              <p className={styles.modalDanger}>
                This action is permanent and cannot be undone. All user data will be deleted.
              </p>
              <div className={styles.formGroup}>
                <label>Type the user's email to confirm: <strong>{user.email}</strong></label>
                <input
                  type="email"
                  value={deleteConfirmEmail}
                  onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                  placeholder={user.email}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Reason for deletion (for audit log)</label>
                <textarea
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  rows={2}
                  placeholder="Enter reason..."
                />
              </div>
              <div className={styles.modalActions}>
                <button type="button" onClick={() => setShowDeleteModal(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.danger}
                  onClick={handleDelete}
                  disabled={deleteConfirmEmail !== user.email || !deleteReason.trim()}
                >
                  Delete User Permanently
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Email Preview Modal */}
        {previewEmail && (
          <div className={styles.modal} onClick={() => setPreviewEmail(null)}>
            <div className={`${styles.modalContent} ${styles.emailPreviewModal}`} onClick={(e) => e.stopPropagation()}>
              <div className={styles.emailPreviewHeader}>
                <h3>Email Preview</h3>
                <button
                  type="button"
                  className={styles.closeButton}
                  onClick={() => setPreviewEmail(null)}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <div className={styles.emailPreviewMeta}>
                <div><strong>Type:</strong> {previewEmail.emailType}</div>
                <div><strong>Subject:</strong> {previewEmail.subject || '-'}</div>
                <div><strong>Sent:</strong> {formatDate(previewEmail.sentAt || previewEmail.scheduledFor, true)}</div>
                <div><strong>Status:</strong> {previewEmail.status}</div>
              </div>
              <div className={styles.emailPreviewContent}>
                {previewEmail.htmlContent ? (
                  <iframe
                    srcDoc={previewEmail.htmlContent}
                    title="Email Preview"
                    className={styles.emailPreviewFrame}
                    sandbox="allow-same-origin"
                  />
                ) : (
                  <p className={styles.noPreview}>
                    Email content not available for preview.
                    <br />
                    <small>Template emails are rendered at send time and content is not stored.</small>
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
