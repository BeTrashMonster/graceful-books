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
  type Workshop,
  type WorkshopEnrollment,
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
    </div>
  );
}

interface EnrollmentDetailModalProps {
  enrollment: WorkshopEnrollment;
  onClose: () => void;
  onUpdate: () => void;
}

function EnrollmentDetailModal({ enrollment, onClose, onUpdate }: EnrollmentDetailModalProps) {
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
