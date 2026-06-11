/**
 * Admin Workshops Page
 *
 * Lists all educational workshop cohorts with analytics and management.
 *
 * Features:
 * - View all workshops in table/card format
 * - Filter by status
 * - Sort by date or conversion rate
 * - Create new workshops
 * - Edit existing workshops
 * - View enrollment stats and conversion rates
 *
 * Requirements:
 * - C1: Admin Workshop List Page
 * - WCAG 2.1 AA compliant
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './WorkshopsPage.module.css';

const API_URL = 'https://api.audacious.money';

// Workshop analytics type (will be imported from API service when backend is integrated)
interface WorkshopAnalytics {
  id: string;
  cohortName: string;
  slug: string;
  workshopType: 'in_person' | 'online';
  status: 'draft' | 'open_registration' | 'registration_closed' | 'in_progress' | 'completed' | 'archived';
  workshopStartDatetime: Date;
  workshopEndDatetime: Date;
  maxEnrollment?: number;
  totalEnrolled: number;
  activeCount: number;
  convertedCount: number;
  withdrawnCount: number;
  trialExpiredCount: number;
  worksheetCompletedCount: number;
  firstLoginCount: number;
  spotsRemaining?: number;
  isFull: boolean;
  currentPhase: 'before_access' | 'access_granted' | 'in_progress' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

type WorkshopStatus = 'all' | 'draft' | 'open_registration' | 'registration_closed' | 'in_progress' | 'completed' | 'archived';

export default function WorkshopsPage() {
  const navigate = useNavigate();
  const [workshops, setWorkshops] = useState<WorkshopAnalytics[]>([]);
  const [statusFilter, setStatusFilter] = useState<WorkshopStatus>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadWorkshops();
  }, [statusFilter]);

  const loadWorkshops = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get admin token from sessionStorage
      const sessionData = sessionStorage.getItem('graceful_books_admin_session');
      const token = sessionData ? JSON.parse(sessionData).token : null;

      if (!token) {
        setError('Admin session expired. Please log in again.');
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_URL}/api/workshops`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load workshops');
      }

      const data = await response.json();
      setWorkshops(data.data.workshops || []);
    } catch (err) {
      console.error('Error loading workshops:', err);
      setError(err instanceof Error ? err.message : 'Failed to load workshops');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWorkshop = () => {
    navigate('/admin/workshops/new');
  };

  const handleEditWorkshop = (workshopId: string) => {
    navigate(`/admin/workshops/${workshopId}`);
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'draft':
        return styles.statusDraft;
      case 'open_registration':
        return styles.statusOpen;
      case 'registration_closed':
        return styles.statusClosed;
      case 'in_progress':
        return styles.statusInProgress;
      case 'completed':
        return styles.statusCompleted;
      case 'archived':
        return styles.statusArchived;
      default:
        return '';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft':
        return 'Draft';
      case 'open_registration':
        return 'Open Registration';
      case 'registration_closed':
        return 'Registration Closed';
      case 'in_progress':
        return 'In Progress';
      case 'completed':
        return 'Completed';
      case 'archived':
        return 'Archived';
      default:
        return status;
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const calculateConversionRate = (converted: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((converted / total) * 100);
  };

  if (loading && workshops.length === 0) {
    return (
      <div className={styles.loading} role="status" aria-live="polite">
        <div className={styles.spinner} aria-hidden="true"></div>
        <span>Loading workshops...</span>
      </div>
    );
  }

  if (error && workshops.length === 0) {
    return (
      <div className={styles.error} role="alert">
        <h2>Error Loading Workshops</h2>
        <p>{error}</p>
        <button type="button" onClick={loadWorkshops} className={styles.retryButton}>
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Workshops</h1>
          <p className={styles.subtitle}>
            Manage educational workshop cohorts, track enrollments, and monitor conversions.
          </p>
        </div>
        <button
          type="button"
          onClick={handleCreateWorkshop}
          className={styles.createButton}
          aria-label="Create new workshop"
        >
          <span aria-hidden="true">+</span> Create Workshop
        </button>
      </header>

      <div className={styles.controls}>
        <div className={styles.filterGroup}>
          <label htmlFor="status-filter" className={styles.filterLabel}>
            Filter by status:
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as WorkshopStatus)}
            className={styles.filterSelect}
            aria-label="Filter workshops by status"
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="open_registration">Open Registration</option>
            <option value="registration_closed">Registration Closed</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      {workshops.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon} aria-hidden="true">
            📚
          </div>
          <h2>No workshops yet</h2>
          <p>Create your first educational workshop to get started.</p>
          <button
            type="button"
            onClick={handleCreateWorkshop}
            className={styles.emptyCreateButton}
          >
            Create First Workshop
          </button>
        </div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table} role="table">
            <thead>
              <tr>
                <th scope="col">Cohort Name</th>
                <th scope="col">Status</th>
                <th scope="col">Workshop Date</th>
                <th scope="col">Enrolled</th>
                <th scope="col">Converted</th>
                <th scope="col">Conv. Rate</th>
                <th scope="col" className={styles.actionsColumn}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {workshops.map((workshop) => (
                <tr
                  key={workshop.id}
                  className={styles.tableRow}
                  onClick={() => handleEditWorkshop(workshop.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>
                    <div className={styles.workshopName}>
                      <span className={styles.cohortName}>{workshop.cohortName}</span>
                      <span className={styles.workshopType}>
                        {workshop.workshopType === 'in_person' ? '🏢 In Person' : '💻 Online'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className={`${styles.statusBadge} ${getStatusBadgeClass(workshop.status)}`}>
                      {getStatusLabel(workshop.status)}
                    </span>
                  </td>
                  <td>{formatDate(workshop.workshopStartDatetime)}</td>
                  <td>
                    {workshop.totalEnrolled}
                    {workshop.maxEnrollment ? ` / ${workshop.maxEnrollment}` : ''}
                    {workshop.isFull && (
                      <span className={styles.fullBadge} aria-label="Workshop is full">
                        Full
                      </span>
                    )}
                  </td>
                  <td>{workshop.convertedCount}</td>
                  <td>
                    <span className={styles.conversionRate}>
                      {calculateConversionRate(workshop.convertedCount, workshop.totalEnrolled)}%
                    </span>
                  </td>
                  <td className={styles.actionsColumn}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditWorkshop(workshop.id);
                      }}
                      className={styles.actionButton}
                      aria-label={`Edit ${workshop.cohortName}`}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
