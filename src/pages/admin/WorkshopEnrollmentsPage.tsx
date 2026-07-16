/**
 * Workshop Enrollments Page
 *
 * Admin page showing all enrollments for a specific workshop.
 * Displays enrollment details, status, and provides actions for managing enrollments.
 *
 * Features:
 * - Table view with user details and enrollment status
 * - Search by name/email
 * - Filter by enrollment status
 * - Sort by various columns
 * - Bulk actions (grant access to multiple users)
 * - Export to CSV
 * - WCAG 2.1 AA compliant
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getWorkshop,
  getWorkshopEnrollments,
  grantEnrollmentAccess,
  startEnrollmentTrial,
  exportEnrollmentsCSV,
  getEnrollmentEmailTracking,
  sendWorkshopEmails,
  type Workshop,
  type WorkshopEnrollment,
  type EmailTrackingData,
  type EmailType,
  type SendEmailResponse,
} from '../../services/workshops.api';
import styles from './WorkshopEnrollmentsPage.module.css';

type SortField = 'name' | 'email' | 'enrolledAt' | 'status' | 'accessGrantedAt';
type SortDirection = 'asc' | 'desc';

export default function WorkshopEnrollmentsPage() {
  const { id: workshopId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [workshop, setWorkshop] = useState<Workshop | null>(null);
  const [enrollments, setEnrollments] = useState<WorkshopEnrollment[]>([]);
  const [filteredEnrollments, setFilteredEnrollments] = useState<WorkshopEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters and search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('enrolledAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Bulk actions
  const [selectedEnrollments, setSelectedEnrollments] = useState<Set<string>>(new Set());

  // Detail view
  const [selectedEnrollment, setSelectedEnrollment] = useState<WorkshopEnrollment | null>(null);

  // Email modal
  const [showEmailModal, setShowEmailModal] = useState(false);

  useEffect(() => {
    if (workshopId) {
      loadData();
    }
  }, [workshopId]);

  useEffect(() => {
    filterAndSortEnrollments();
  }, [enrollments, searchTerm, statusFilter, sortField, sortDirection]);

  const loadData = async () => {
    if (!workshopId) return;

    setLoading(true);
    setError(null);

    try {
      const [workshopData, enrollmentsData] = await Promise.all([
        getWorkshop(workshopId),
        getWorkshopEnrollments(workshopId),
      ]);

      setWorkshop(workshopData);
      setEnrollments(enrollmentsData);
    } catch (err) {
      console.error('Error loading workshop enrollments:', err);
      setError(err instanceof Error ? err.message : 'Failed to load enrollments');
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortEnrollments = () => {
    let filtered = [...enrollments];

    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        enrollment =>
          enrollment.user?.name?.toLowerCase().includes(search) ||
          enrollment.user?.email?.toLowerCase().includes(search)
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(enrollment => enrollment.status === statusFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'name':
          aValue = a.user?.name?.toLowerCase() || '';
          bValue = b.user?.name?.toLowerCase() || '';
          break;
        case 'email':
          aValue = a.user?.email?.toLowerCase() || '';
          bValue = b.user?.email?.toLowerCase() || '';
          break;
        case 'enrolledAt':
          aValue = new Date(a.enrolledAt).getTime();
          bValue = new Date(b.enrolledAt).getTime();
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        case 'accessGrantedAt':
          aValue = a.accessGrantedAt ? new Date(a.accessGrantedAt).getTime() : 0;
          bValue = b.accessGrantedAt ? new Date(b.accessGrantedAt).getTime() : 0;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredEnrollments(filtered);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleSelectEnrollment = (enrollmentId: string) => {
    const newSelected = new Set(selectedEnrollments);
    if (newSelected.has(enrollmentId)) {
      newSelected.delete(enrollmentId);
    } else {
      newSelected.add(enrollmentId);
    }
    setSelectedEnrollments(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedEnrollments.size === filteredEnrollments.length) {
      setSelectedEnrollments(new Set());
    } else {
      setSelectedEnrollments(new Set(filteredEnrollments.map(e => e.id)));
    }
  };

  const handleGrantAccess = async (enrollmentId: string) => {
    try {
      await grantEnrollmentAccess(enrollmentId);
      await loadData();
    } catch (err) {
      console.error('Error granting access:', err);
      alert('Failed to grant access. Please try again.');
    }
  };

  const handleStartTrial = async (enrollmentId: string) => {
    try {
      await startEnrollmentTrial(enrollmentId);
      await loadData();
    } catch (err) {
      console.error('Error starting trial:', err);
      alert('Failed to start trial. Please try again.');
    }
  };

  const handleBulkGrantAccess = async () => {
    if (selectedEnrollments.size === 0) return;

    if (!confirm(`Grant access to ${selectedEnrollments.size} users?`)) return;

    try {
      await Promise.all(
        Array.from(selectedEnrollments).map(id => grantEnrollmentAccess(id))
      );
      setSelectedEnrollments(new Set());
      await loadData();
    } catch (err) {
      console.error('Error granting bulk access:', err);
      alert('Some enrollments failed to update. Please try again.');
    }
  };

  const handleExportCSV = () => {
    if (!workshopId) return;
    exportEnrollmentsCSV(workshopId, filteredEnrollments);
  };

  const handleSendEmail = () => {
    if (selectedEnrollments.size === 0) return;
    setShowEmailModal(true);
  };

  const handleEmailSent = (response: SendEmailResponse) => {
    setShowEmailModal(false);
    setSelectedEnrollments(new Set());
    alert(`Email sent successfully to ${response.summary.success} of ${response.summary.total} recipients.`);
    loadData();
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'enrolled':
        return styles.statusEnrolled;
      case 'active':
        return styles.statusActive;
      case 'trial_active':
        return styles.statusTrialActive;
      case 'trial_expired':
        return styles.statusTrialExpired;
      case 'converted':
        return styles.statusConverted;
      case 'cancelled':
        return styles.statusCancelled;
      default:
        return '';
    }
  };

  if (loading && !workshop) {
    return (
      <div className={styles.loading} role="status" aria-live="polite">
        <div className={styles.spinner} aria-hidden="true"></div>
        <span>Loading enrollments...</span>
      </div>
    );
  }

  if (error && !workshop) {
    return (
      <div className={styles.error} role="alert">
        <h2>Error Loading Enrollments</h2>
        <p>{error}</p>
        <button type="button" onClick={loadData} className={styles.retryButton}>
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div>
          <button
            type="button"
            onClick={() => navigate('/admin/workshops')}
            className={styles.backButton}
            aria-label="Back to workshops list"
          >
            ← Back to Workshops
          </button>
          <h1 className={styles.title}>
            {workshop?.cohortName} - Enrollments
          </h1>
          <p className={styles.subtitle}>
            {enrollments.length} total enrollments
            {workshop?.maxEnrollment && ` / ${workshop.maxEnrollment} max`}
          </p>
        </div>
        <button
          type="button"
          onClick={loadData}
          className={styles.refreshButton}
          disabled={loading}
          aria-label="Refresh enrollments"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </header>

      {/* Controls */}
      <div className={styles.controls}>
        <div className={styles.searchContainer}>
          <label htmlFor="enrollment-search" className={styles.visuallyHidden}>
            Search enrollments
          </label>
          <input
            type="search"
            id="enrollment-search"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className={styles.searchInput}
            aria-label="Search enrollments by name or email"
          />
        </div>

        <div className={styles.filterContainer}>
          <label htmlFor="status-filter" className={styles.visuallyHidden}>
            Filter by status
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className={styles.filterSelect}
            aria-label="Filter enrollments by status"
          >
            <option value="all">All Statuses</option>
            <option value="enrolled">Enrolled</option>
            <option value="active">Active</option>
            <option value="trial_active">Trial Active</option>
            <option value="trial_expired">Trial Expired</option>
            <option value="converted">Converted</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <button
          type="button"
          onClick={handleExportCSV}
          className={styles.exportButton}
          aria-label="Export enrollments to CSV"
        >
          Export CSV
        </button>
      </div>

      {/* Bulk Actions */}
      {selectedEnrollments.size > 0 && (
        <div className={styles.bulkActions}>
          <span className={styles.bulkActionsLabel}>
            {selectedEnrollments.size} selected
          </span>
          <button
            type="button"
            onClick={handleBulkGrantAccess}
            className={styles.bulkActionButton}
          >
            Grant Access to Selected
          </button>
          <button
            type="button"
            onClick={handleSendEmail}
            className={styles.bulkActionButton}
          >
            Send Email
          </button>
          <button
            type="button"
            onClick={() => setSelectedEnrollments(new Set())}
            className={styles.bulkActionClear}
          >
            Clear Selection
          </button>
        </div>
      )}

      {/* Enrollments Table */}
      {filteredEnrollments.length === 0 ? (
        <div className={styles.empty}>
          <p>No enrollments found matching your criteria.</p>
        </div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col" className={styles.checkboxColumn}>
                  <input
                    type="checkbox"
                    checked={selectedEnrollments.size === filteredEnrollments.length}
                    onChange={handleSelectAll}
                    aria-label="Select all enrollments"
                  />
                </th>
                <th scope="col" className={styles.sortable} onClick={() => handleSort('name')}>
                  Name {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th scope="col" className={styles.sortable} onClick={() => handleSort('email')}>
                  Email {sortField === 'email' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th scope="col" className={styles.sortable} onClick={() => handleSort('enrolledAt')}>
                  Enrolled {sortField === 'enrolledAt' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th scope="col" className={styles.sortable} onClick={() => handleSort('status')}>
                  Status {sortField === 'status' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th scope="col" className={styles.sortable} onClick={() => handleSort('accessGrantedAt')}>
                  Access Granted {sortField === 'accessGrantedAt' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th scope="col">Worksheet</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEnrollments.map(enrollment => (
                <tr key={enrollment.id} className={styles.row}>
                  <td className={styles.checkboxColumn}>
                    <input
                      type="checkbox"
                      checked={selectedEnrollments.has(enrollment.id)}
                      onChange={() => handleSelectEnrollment(enrollment.id)}
                      aria-label={`Select enrollment for ${enrollment.user?.email}`}
                    />
                  </td>
                  <td>{enrollment.user?.name || 'N/A'}</td>
                  <td>{enrollment.user?.email}</td>
                  <td className={styles.date}>
                    {new Date(enrollment.enrolledAt).toLocaleDateString()}
                  </td>
                  <td>
                    <span className={`${styles.statusBadge} ${getStatusBadgeClass(enrollment.status || 'enrolled')}`}>
                      {enrollment.status?.replace('_', ' ') || 'enrolled'}
                    </span>
                  </td>
                  <td className={styles.date}>
                    {enrollment.accessGrantedAt
                      ? new Date(enrollment.accessGrantedAt).toLocaleDateString()
                      : 'No'}
                  </td>
                  <td>
                    {enrollment.worksheetCompletedAt ? (
                      <span className={styles.completed}>✓ Completed</span>
                    ) : (
                      <span className={styles.incomplete}>Incomplete</span>
                    )}
                  </td>
                  <td className={styles.actions}>
                    {!enrollment.accessGranted && (
                      <button
                        type="button"
                        onClick={() => handleGrantAccess(enrollment.id)}
                        className={styles.actionButton}
                        aria-label={`Grant access to ${enrollment.user?.email}`}
                      >
                        Grant Access
                      </button>
                    )}
                    {enrollment.accessGranted && !enrollment.trialStartedAt && (
                      <button
                        type="button"
                        onClick={() => handleStartTrial(enrollment.id)}
                        className={styles.actionButton}
                        aria-label={`Start trial for ${enrollment.user?.email}`}
                      >
                        Start Trial
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedEnrollment(enrollment)}
                      className={styles.viewButton}
                      aria-label={`View details for ${enrollment.user?.email}`}
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      {selectedEnrollment && (
        <EnrollmentDetailModal
          enrollment={selectedEnrollment}
          onClose={() => setSelectedEnrollment(null)}
          onUpdate={loadData}
        />
      )}

      {/* Send Email Modal */}
      {showEmailModal && workshopId && (
        <SendEmailModal
          workshopId={workshopId}
          workshopName={workshop?.cohortName || 'Workshop'}
          enrollmentIds={Array.from(selectedEnrollments)}
          enrollments={enrollments.filter(e => selectedEnrollments.has(e.id))}
          onClose={() => setShowEmailModal(false)}
          onSuccess={handleEmailSent}
        />
      )}
    </div>
  );
}

interface EnrollmentDetailModalProps {
  enrollment: WorkshopEnrollment;
  onClose: () => void;
  onUpdate: () => void;
}

// =============================================================================
// SEND EMAIL MODAL
// =============================================================================

interface SendEmailModalProps {
  workshopId: string;
  workshopName: string;
  enrollmentIds: string[];
  enrollments: WorkshopEnrollment[];
  onClose: () => void;
  onSuccess: (response: SendEmailResponse) => void;
}

function SendEmailModal({
  workshopId,
  workshopName,
  enrollmentIds,
  enrollments,
  onClose,
  onSuccess,
}: SendEmailModalProps) {
  const [emailType, setEmailType] = useState<EmailType>('welcome');
  const [isCustom, setIsCustom] = useState(false);
  const [customSubject, setCustomSubject] = useState('');
  const [customBody, setCustomBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const predefinedEmailTypes: { value: EmailType; label: string; description: string }[] = [
    { value: 'welcome', label: 'Welcome Email', description: 'Initial welcome message sent at signup' },
    { value: 'reminder', label: 'Reminder Email', description: 'Workshop reminder before start date' },
    { value: 'week1', label: 'Week 1 Email', description: 'First week follow-up' },
    { value: 'week2', label: 'Week 2 Email', description: 'Second week follow-up' },
    { value: 'week3', label: 'Week 3 Email', description: 'Third week follow-up' },
    { value: 'week4', label: 'Week 4 Email', description: 'Fourth week follow-up' },
    { value: 'wrapUp', label: 'Wrap-Up Email', description: 'Workshop completion summary' },
  ];

  const handleSend = async () => {
    if (isCustom && (!customSubject.trim() || !customBody.trim())) {
      setError('Please enter both a subject and message for custom emails.');
      return;
    }

    setSending(true);
    setError(null);

    try {
      const response = await sendWorkshopEmails(workshopId, {
        enrollmentIds,
        emailType: isCustom ? 'custom' : emailType,
        customContent: isCustom
          ? {
              subject: customSubject,
              htmlBody: customBody.replace(/\n/g, '<br>'),
              plainTextBody: customBody,
            }
          : undefined,
      });

      if (response.summary.failed > 0) {
        setError(`${response.summary.failed} email(s) failed to send.`);
      }

      onSuccess(response);
    } catch (err) {
      console.error('Error sending emails:', err);
      setError(err instanceof Error ? err.message : 'Failed to send emails');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={styles.modalContent}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="send-email-title"
        style={{ maxWidth: '600px' }}
      >
        <div className={styles.modalHeader}>
          <h2 id="send-email-title">Send Email to {enrollmentIds.length} Attendee(s)</h2>
          <button
            type="button"
            onClick={onClose}
            className={styles.closeButton}
            aria-label="Close send email modal"
          >
            ×
          </button>
        </div>

        <div className={styles.modalBody}>
          {/* Recipients Preview */}
          <div className={styles.detailSection}>
            <h3>Recipients</h3>
            <div style={{ maxHeight: '100px', overflowY: 'auto', fontSize: '14px', color: '#666' }}>
              {enrollments.map(e => (
                <div key={e.id}>{e.user?.name || e.user?.email}</div>
              ))}
            </div>
          </div>

          {/* Email Type Selection */}
          <div className={styles.detailSection}>
            <h3>Email Type</h3>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="emailMode"
                  checked={!isCustom}
                  onChange={() => setIsCustom(false)}
                />
                <span>Send predefined email</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '8px' }}>
                <input
                  type="radio"
                  name="emailMode"
                  checked={isCustom}
                  onChange={() => setIsCustom(true)}
                />
                <span>Compose custom email</span>
              </label>
            </div>

            {!isCustom && (
              <div style={{ marginTop: '16px' }}>
                <label htmlFor="email-type-select" style={{ display: 'block', fontWeight: '500', marginBottom: '8px' }}>
                  Select email to send:
                </label>
                <select
                  id="email-type-select"
                  value={emailType}
                  onChange={e => setEmailType(e.target.value as EmailType)}
                  className={styles.filterSelect}
                  style={{ width: '100%' }}
                >
                  {predefinedEmailTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                <p style={{ fontSize: '13px', color: '#666', marginTop: '8px' }}>
                  {predefinedEmailTypes.find(t => t.value === emailType)?.description}
                </p>
                <p style={{ fontSize: '13px', color: '#888', marginTop: '4px' }}>
                  Note: If custom templates are configured for this workshop, they will be used.
                </p>
              </div>
            )}

            {isCustom && (
              <div style={{ marginTop: '16px' }}>
                <div style={{ marginBottom: '16px' }}>
                  <label htmlFor="custom-subject" style={{ display: 'block', fontWeight: '500', marginBottom: '8px' }}>
                    Subject:
                  </label>
                  <input
                    type="text"
                    id="custom-subject"
                    value={customSubject}
                    onChange={e => setCustomSubject(e.target.value)}
                    placeholder={`[${workshopName}] Your custom subject`}
                    className={styles.searchInput}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label htmlFor="custom-body" style={{ display: 'block', fontWeight: '500', marginBottom: '8px' }}>
                    Message:
                  </label>
                  <textarea
                    id="custom-body"
                    value={customBody}
                    onChange={e => setCustomBody(e.target.value)}
                    placeholder="Enter your message here...&#10;&#10;Available template tags:&#10;{{firstName}} - Recipient's first name&#10;{{workshopName}} - Workshop name&#10;{{workshopDate}} - Workshop date&#10;{{workshopLocation}} - Workshop location"
                    rows={8}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontFamily: 'inherit',
                      resize: 'vertical',
                    }}
                  />
                  <p style={{ fontSize: '12px', color: '#888', marginTop: '8px' }}>
                    You can use template tags like {'{{firstName}}'}, {'{{workshopName}}'}, etc.
                  </p>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div style={{ background: '#fef2f2', color: '#dc2626', padding: '12px', borderRadius: '6px', marginTop: '16px' }}>
              {error}
            </div>
          )}
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            type="button"
            onClick={onClose}
            className={styles.bulkActionClear}
            disabled={sending}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSend}
            className={styles.bulkActionButton}
            disabled={sending}
          >
            {sending ? 'Sending...' : `Send to ${enrollmentIds.length} Recipient(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// ENROLLMENT DETAIL MODAL
// =============================================================================

function EnrollmentDetailModal({ enrollment, onClose, onUpdate }: EnrollmentDetailModalProps) {
  const [emailTracking, setEmailTracking] = useState<EmailTrackingData | null>(null);
  const [loadingEmailTracking, setLoadingEmailTracking] = useState(false);

  useEffect(() => {
    if (enrollment) {
      loadEmailTracking();
    }
  }, [enrollment]);

  const loadEmailTracking = async () => {
    if (!enrollment) return;

    setLoadingEmailTracking(true);
    try {
      const data = await getEnrollmentEmailTracking(
        enrollment.workshopId,
        enrollment.userId
      );
      setEmailTracking(data);
    } catch (error) {
      console.error('Failed to load email tracking:', error);
    } finally {
      setLoadingEmailTracking(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={styles.modalContent}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="enrollment-detail-title"
      >
        <div className={styles.modalHeader}>
          <h2 id="enrollment-detail-title">Enrollment Details</h2>
          <button
            type="button"
            onClick={onClose}
            className={styles.closeButton}
            aria-label="Close enrollment details"
          >
            ×
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.detailSection}>
            <h3>User Information</h3>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Name:</span>
              <span>{enrollment.user?.name || 'N/A'}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Email:</span>
              <span>{enrollment.user?.email}</span>
            </div>
          </div>

          <div className={styles.detailSection}>
            <h3>Enrollment Timeline</h3>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Enrolled:</span>
              <span>{new Date(enrollment.enrolledAt).toLocaleString()}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Access Granted:</span>
              <span>
                {enrollment.accessGrantedAt
                  ? new Date(enrollment.accessGrantedAt).toLocaleString()
                  : 'Not yet granted'}
              </span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>First Login:</span>
              <span>
                {enrollment.firstLoginAt
                  ? new Date(enrollment.firstLoginAt).toLocaleString()
                  : 'Not yet logged in'}
              </span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Trial Started:</span>
              <span>
                {enrollment.trialStartedAt
                  ? new Date(enrollment.trialStartedAt).toLocaleString()
                  : 'Not started'}
              </span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Trial Expires:</span>
              <span>
                {enrollment.trialExpiresAt
                  ? new Date(enrollment.trialExpiresAt).toLocaleString()
                  : 'N/A'}
              </span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Converted to Paid:</span>
              <span>
                {enrollment.convertedToPaidAt
                  ? new Date(enrollment.convertedToPaidAt).toLocaleString()
                  : 'Not yet converted'}
              </span>
            </div>
          </div>

          <div className={styles.detailSection}>
            <h3>Progress</h3>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Status:</span>
              <span>{enrollment.status?.replace('_', ' ') || 'enrolled'}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Worksheet Completed:</span>
              <span>
                {enrollment.worksheetCompletedAt
                  ? new Date(enrollment.worksheetCompletedAt).toLocaleString()
                  : 'Not completed'}
              </span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Last Active:</span>
              <span>
                {enrollment.lastActiveAt
                  ? new Date(enrollment.lastActiveAt).toLocaleString()
                  : 'Never'}
              </span>
            </div>
          </div>

          {/* Email Engagement Metrics */}
          {emailTracking && emailTracking.summary.length > 0 && (
            <div className={styles.detailSection}>
              <h3>Email Engagement</h3>
              <div className={styles.metricsGrid}>
                {emailTracking.summary.map((metric) => {
                  const openRate = metric.sent_count > 0
                    ? Math.round((metric.open_count / metric.sent_count) * 100)
                    : 0;
                  const clickRate = metric.open_count > 0
                    ? Math.round((metric.click_count / metric.open_count) * 100)
                    : 0;

                  return (
                    <div key={metric.email_type} className={styles.metricCard}>
                      <div className={styles.metricHeader}>
                        <span className={styles.emailTypeBadge}>{metric.email_type}</span>
                      </div>
                      <div className={styles.metricStats}>
                        <div className={styles.stat}>
                          <span className={styles.statValue}>{metric.sent_count}</span>
                          <span className={styles.statLabel}>Sent</span>
                        </div>
                        <div className={styles.stat}>
                          <span className={styles.statValue}>{openRate}%</span>
                          <span className={styles.statLabel}>Open Rate</span>
                        </div>
                        <div className={styles.stat}>
                          <span className={styles.statValue}>{clickRate}%</span>
                          <span className={styles.statLabel}>Click Rate</span>
                        </div>
                        {metric.bounce_count > 0 && (
                          <div className={styles.stat}>
                            <span className={styles.statValue} style={{ color: '#dc2626' }}>
                              {metric.bounce_count}
                            </span>
                            <span className={styles.statLabel}>Bounced</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Email Activity Timeline */}
          {emailTracking && emailTracking.events.length > 0 && (
            <div className={styles.detailSection}>
              <h3>Email Activity Timeline</h3>
              <div className={styles.timeline}>
                {emailTracking.events.map((event, index) => {
                  const isFirstOfMessage = index === 0 ||
                    event.message_id !== emailTracking.events[index - 1].message_id;

                  return (
                    <div key={`${event.message_id}-${event.event_type}-${index}`}
                         className={styles.timelineItem}>
                      <div className={styles.timelineDot}
                           data-event-type={event.event_type} />
                      <div className={styles.timelineContent}>
                        {isFirstOfMessage && (
                          <div className={styles.emailSubject}>
                            <strong>{event.subject}</strong>
                            <span className={styles.emailType}>{event.email_type}</span>
                          </div>
                        )}
                        <div className={styles.eventDetails}>
                          <span className={styles.eventType}>
                            {event.event_type === 'sent' && '📧 Sent'}
                            {event.event_type === 'delivered' && '✅ Delivered'}
                            {event.event_type === 'opened' && '👁️ Opened'}
                            {event.event_type === 'clicked' && '🔗 Clicked'}
                            {event.event_type === 'bounced' && '⚠️ Bounced'}
                          </span>
                          <span className={styles.eventTimestamp}>
                            {new Date(event.event_timestamp).toLocaleString()}
                          </span>
                        </div>
                        {event.event_metadata?.clickedUrl && (
                          <div className={styles.eventMeta}>
                            Link: <code>{event.event_metadata.clickedUrl}</code>
                          </div>
                        )}
                        {event.event_metadata?.description && (
                          <div className={styles.eventMeta}>
                            Reason: {event.event_metadata.description}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {loadingEmailTracking && (
            <div className={styles.detailSection}>
              <p>Loading email tracking data...</p>
            </div>
          )}

          {enrollment.emailsSent && enrollment.emailsSent.length > 0 && (
            <div className={styles.detailSection}>
              <h3>Emails Sent</h3>
              <ul className={styles.emailList}>
                {enrollment.emailsSent.map((email, index) => (
                  <li key={index}>
                    <strong>{email.emailType}:</strong>{' '}
                    {new Date(email.sentAt).toLocaleString()}
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
