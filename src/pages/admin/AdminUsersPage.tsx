/**
 * AdminUsersPage
 *
 * Redesigned admin user list with tiered information architecture:
 * - Tier 1: User row with key info at a glance
 * - Tier 2: Expanded panel with quick actions and details
 * - Tier 3: Full details page (navigates to separate route)
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserFilterBar,
  UserRowHeader,
  UserRow,
  UserExpandedPanel,
} from '../../components/admin/users';
import { useAdminUsers } from '../../hooks/admin/useAdminUsers';
import { useUserDetails } from '../../hooks/admin/useUserDetails';
import styles from './AdminUsersPage.module.css';

export default function AdminUsersPage() {
  const navigate = useNavigate();
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  // User list with filters
  const {
    users,
    totalCount,
    currentPage,
    totalPages,
    isLoading,
    error,
    filterOptions,
    filters,
    setFilters,
    setPage,
    refresh,
  } = useAdminUsers();

  // User details for expanded panel
  const {
    data: expandedUserData,
    isLoading: isLoadingDetails,
    fetch: fetchUserDetails,
    addTag,
    removeTag,
    resendEmail,
    cancelScheduledEmail,
  } = useUserDetails();

  // Toggle expanded row
  const handleToggleExpand = useCallback(
    async (userId: string) => {
      if (expandedUserId === userId) {
        setExpandedUserId(null);
      } else {
        setExpandedUserId(userId);
        await fetchUserDetails(userId);
      }
    },
    [expandedUserId, fetchUserDetails]
  );

  // Navigate to full details page
  const handleViewDetails = useCallback(
    (userId: string) => {
      navigate(`/admin/users/${userId}`);
    },
    [navigate]
  );

  // Handle add note (opens modal - placeholder for now)
  const handleAddNote = useCallback(() => {
    // TODO: Open add note modal
    console.log('Add note clicked');
  }, []);

  // Handle tag operations
  const handleAddTag = useCallback(
    async (tag: string) => {
      if (expandedUserId) {
        await addTag(expandedUserId, tag);
        refresh();
      }
    },
    [expandedUserId, addTag, refresh]
  );

  const handleRemoveTag = useCallback(
    async (tag: string) => {
      if (expandedUserId) {
        await removeTag(expandedUserId, tag);
        refresh();
      }
    },
    [expandedUserId, removeTag, refresh]
  );

  // Handle email operations
  const handleResendEmail = useCallback(
    async (emailId: string) => {
      if (expandedUserId) {
        const success = await resendEmail(expandedUserId, emailId);
        if (success) {
          // Show success toast/notification
          console.log('Email resent successfully');
        }
      }
    },
    [expandedUserId, resendEmail]
  );

  const handleCancelEmail = useCallback(
    async (scheduledId: string) => {
      if (expandedUserId) {
        await cancelScheduledEmail(expandedUserId, scheduledId);
      }
    },
    [expandedUserId, cancelScheduledEmail]
  );

  // Get admin session
  const sessionData = sessionStorage.getItem('graceful_books_admin_session');
  if (!sessionData) {
    navigate('/admin/login');
    return null;
  }

  const session = JSON.parse(sessionData);

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.headerContent}>
            <div>
              <h1 className={styles.title}>Users</h1>
              <p className={styles.subtitle}>
                {totalCount} total users
              </p>
            </div>
            <div className={styles.headerActions}>
              <button
                type="button"
                className={styles.backButton}
                onClick={() => navigate('/admin')}
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </header>

        {/* Filter bar */}
        <UserFilterBar
          filters={filters}
          options={filterOptions}
          onFilterChange={setFilters}
          isLoading={isLoading}
        />

        {/* Error state */}
        {error && (
          <div className={styles.error}>
            <p>{error}</p>
            <button type="button" onClick={refresh}>
              Try again
            </button>
          </div>
        )}

        {/* User list */}
        <div className={styles.userList}>
          <UserRowHeader />

          {isLoading && users.length === 0 ? (
            <div className={styles.loading}>Loading users...</div>
          ) : users.length === 0 ? (
            <div className={styles.empty}>
              <p>No users found</p>
              {(filters.search || filters.product || filters.status) && (
                <button
                  type="button"
                  onClick={() =>
                    setFilters({
                      search: '',
                      product: '',
                      workshop: '',
                      status: '',
                      isBeta: false,
                      needsAttention: false,
                      emailSuppressed: false,
                      tag: '',
                    })
                  }
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className={styles.rows}>
              {users.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  isExpanded={expandedUserId === user.id}
                  onToggleExpand={() => handleToggleExpand(user.id)}
                  onViewDetails={() => handleViewDetails(user.id)}
                >
                  {expandedUserId === user.id && expandedUserData && (
                    <UserExpandedPanel
                      data={expandedUserData}
                      onViewDetails={() => handleViewDetails(user.id)}
                      onAddNote={handleAddNote}
                      onAddTag={handleAddTag}
                      onRemoveTag={handleRemoveTag}
                      onResendEmail={handleResendEmail}
                      onCancelEmail={handleCancelEmail}
                      isLoading={isLoadingDetails}
                    />
                  )}
                </UserRow>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className={styles.pagination}>
            <button
              type="button"
              className={styles.pageButton}
              onClick={() => setPage(currentPage - 1)}
              disabled={currentPage === 1 || isLoading}
            >
              Previous
            </button>
            <span className={styles.pageInfo}>
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              className={styles.pageButton}
              onClick={() => setPage(currentPage + 1)}
              disabled={currentPage === totalPages || isLoading}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
