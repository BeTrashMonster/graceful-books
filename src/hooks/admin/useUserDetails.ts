/**
 * useUserDetails Hook
 *
 * Fetches detailed user information for the expanded panel and details view.
 * Provides operations for managing notes, tags, and emails.
 */

import { useState, useCallback } from 'react';
import { API_URL } from '../../config/api';
import type { UserExpandedData, EmailHistoryItem, NotePreview } from '../../components/admin/users/UserExpandedPanel';

export interface UserDetailsData extends UserExpandedData {
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  productSlug: string;
  productName: string;
  subscriptionId: string | null;
  isBeta: boolean;
  needsAttention: boolean;
  frozenAt: string | null;
  frozenReason: string | null;
  pausedAt: string | null;
  pausedUntil: string | null;
  cancelledAt: string | null;
}

export interface UseUserDetailsReturn {
  data: UserDetailsData | null;
  isLoading: boolean;
  error: string | null;
  fetch: (userId: string) => Promise<void>;
  // Note operations
  addNote: (userId: string, note: string, noteType: string) => Promise<boolean>;
  updateNote: (userId: string, noteId: string, note: string) => Promise<boolean>;
  deleteNote: (userId: string, noteId: string) => Promise<boolean>;
  // Tag operations
  addTag: (userId: string, tag: string) => Promise<boolean>;
  removeTag: (userId: string, tag: string) => Promise<boolean>;
  // Email operations
  resendEmail: (userId: string, emailId: string) => Promise<boolean>;
  cancelScheduledEmail: (userId: string, scheduledId: string) => Promise<boolean>;
  // Suppression operations
  addSuppression: (userId: string, type: string, reason?: string) => Promise<boolean>;
  removeSuppression: (userId: string, type: string) => Promise<boolean>;
}

/**
 * Transform backend data to UserDetailsData format
 * Backend returns nested structure: { summary, cards, recentEmails, recentNotes, tags, suppressions }
 */
function transformDetails(data: Record<string, unknown>): UserDetailsData {
  // Handle nested response structure from backend
  const summary = (data.summary || {}) as Record<string, unknown>;
  const cards = (data.cards || {}) as Record<string, unknown>;
  const account = (cards.account || {}) as Record<string, unknown>;
  const subscription = (cards.subscription || {}) as Record<string, unknown>;
  const health = (cards.health || {}) as Record<string, unknown>;
  const products = (subscription.products || []) as Array<Record<string, unknown>>;
  const firstProduct = products[0] || {};

  return {
    userId: String(summary.id || data.id || ''),
    email: String(summary.email || data.email || ''),
    firstName: (summary.name as string)?.split(' ')[0] || null,
    lastName: (summary.name as string)?.split(' ').slice(1).join(' ') || null,
    companyName: (summary.companyName || null) as string | null,
    supportKey: String(summary.supportKey || account.supportKey || ''),
    productSlug: String(firstProduct.slug || ''),
    productName: String(firstProduct.name || firstProduct.slug || ''),
    createdAt: String(account.createdAt || ''),
    lastLoginAt: (account.lastLoginAt || null) as string | null,
    stripeCustomerId: (firstProduct.stripeCustomerId || null) as string | null,
    subscriptionId: (firstProduct.stripeSubscriptionId || null) as string | null,
    subscriptionStatus: (firstProduct.status || null) as string | null,
    isBeta: Boolean(summary.isBeta || account.isBeta),
    needsAttention: Boolean(health.isFrozen || health.hasPaymentIssue),
    frozenAt: health.isFrozen ? 'frozen' : null,
    frozenReason: (health.frozenReason || null) as string | null,
    pausedAt: (firstProduct.pausedAt || null) as string | null,
    pausedUntil: null,
    cancelledAt: (firstProduct.cancelledAt || null) as string | null,
    recentEmails: Array.isArray(data.recentEmails)
      ? (data.recentEmails as Array<Record<string, unknown>>).map((e) => ({
          id: String(e.id),
          emailType: String(e.emailType),
          subject: String(e.subject || ''),
          status: (e.status || 'sent') as EmailHistoryItem['status'],
          sentAt: (e.sentAt || null) as string | null,
          scheduledFor: (e.scheduledFor || null) as string | null,
        }))
      : [],
    recentNotes: Array.isArray(data.recentNotes)
      ? (data.recentNotes as Array<Record<string, unknown>>).map((n) => ({
          id: String(n.id),
          note: String(n.note),
          noteType: String(n.noteType),
          createdAt: String(n.createdAt),
          createdByName: String(n.createdByName || 'Admin'),
        }))
      : [],
    tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
    suppressions: Array.isArray(data.suppressions)
      ? (data.suppressions as Array<Record<string, unknown>>).map((s) => ({
          type: String(s.type),
          createdAt: String(s.createdAt),
        }))
      : [],
  };
}

export function useUserDetails(): UseUserDetailsReturn {
  const [data, setData] = useState<UserDetailsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get admin session from sessionStorage
  const getSession = useCallback(() => {
    const sessionData = sessionStorage.getItem('graceful_books_admin_session');
    return sessionData ? JSON.parse(sessionData) : null;
  }, []);

  // Fetch user details
  const fetch = useCallback(async (userId: string) => {
    const session = getSession();
    if (!session?.token) {
      setError('Not authenticated');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await window.fetch(`${API_URL}/admin/users/${userId}/details`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch user details: ${response.statusText}`);
      }

      const responseData = await response.json();
      // Unwrap the API response - backend wraps data in { data: ... }
      const detailsData = responseData.data || responseData;
      setData(transformDetails(detailsData));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch user details');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [getSession]);

  // Add note
  const addNote = useCallback(
    async (userId: string, note: string, noteType: string): Promise<boolean> => {
      const session = getSession();
      if (!session?.token) return false;

      try {
        const response = await window.fetch(`${API_URL}/admin/users/${userId}/notes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.token}`,
          },
          body: JSON.stringify({ note, noteType }),
        });

        if (!response.ok) {
          throw new Error('Failed to add note');
        }

        // Refresh data
        await fetch(userId);
        return true;
      } catch {
        return false;
      }
    },
    [fetch, getSession]
  );

  // Update note
  const updateNote = useCallback(
    async (userId: string, noteId: string, note: string): Promise<boolean> => {
      const session = getSession();
      if (!session?.token) return false;

      try {
        const response = await window.fetch(
          `${API_URL}/admin/users/${userId}/notes/${noteId}`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.token}`,
            },
            body: JSON.stringify({ note }),
          }
        );

        if (!response.ok) {
          throw new Error('Failed to update note');
        }

        // Refresh data
        await fetch(userId);
        return true;
      } catch {
        return false;
      }
    },
    [fetch, getSession]
  );

  // Delete note
  const deleteNote = useCallback(
    async (userId: string, noteId: string): Promise<boolean> => {
      const session = getSession();
      if (!session?.token) return false;

      try {
        const response = await window.fetch(
          `${API_URL}/admin/users/${userId}/notes/${noteId}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${session.token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error('Failed to delete note');
        }

        // Refresh data
        await fetch(userId);
        return true;
      } catch {
        return false;
      }
    },
    [fetch, getSession]
  );

  // Add tag
  const addTag = useCallback(
    async (userId: string, tag: string): Promise<boolean> => {
      const session = getSession();
      if (!session?.token) return false;

      try {
        const response = await window.fetch(`${API_URL}/admin/users/${userId}/tags`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.token}`,
          },
          body: JSON.stringify({ tag }),
        });

        if (!response.ok) {
          throw new Error('Failed to add tag');
        }

        // Update local state
        if (data) {
          const normalizedTag = tag.toLowerCase().replace(/\s+/g, '-');
          setData({
            ...data,
            tags: [...data.tags, normalizedTag],
          });
        }
        return true;
      } catch {
        return false;
      }
    },
    [data, getSession]
  );

  // Remove tag
  const removeTag = useCallback(
    async (userId: string, tag: string): Promise<boolean> => {
      const session = getSession();
      if (!session?.token) return false;

      try {
        const response = await window.fetch(
          `${API_URL}/admin/users/${userId}/tags/${encodeURIComponent(tag)}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${session.token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error('Failed to remove tag');
        }

        // Update local state
        if (data) {
          setData({
            ...data,
            tags: data.tags.filter((t) => t !== tag),
          });
        }
        return true;
      } catch {
        return false;
      }
    },
    [data, getSession]
  );

  // Resend email
  const resendEmail = useCallback(
    async (userId: string, emailId: string): Promise<boolean> => {
      const session = getSession();
      if (!session?.token) return false;

      try {
        const response = await window.fetch(
          `${API_URL}/admin/users/${userId}/emails/${emailId}/resend`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error('Failed to resend email');
        }

        return true;
      } catch {
        return false;
      }
    },
    [getSession]
  );

  // Cancel scheduled email
  const cancelScheduledEmail = useCallback(
    async (userId: string, scheduledId: string): Promise<boolean> => {
      const session = getSession();
      if (!session?.token) return false;

      try {
        const response = await window.fetch(
          `${API_URL}/admin/users/${userId}/scheduled-emails/${scheduledId}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${session.token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error('Failed to cancel scheduled email');
        }

        // Refresh data
        await fetch(userId);
        return true;
      } catch {
        return false;
      }
    },
    [fetch, getSession]
  );

  // Add suppression
  const addSuppression = useCallback(
    async (userId: string, type: string, reason?: string): Promise<boolean> => {
      const session = getSession();
      if (!session?.token) return false;

      try {
        const response = await window.fetch(
          `${API_URL}/admin/users/${userId}/suppressions`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.token}`,
            },
            body: JSON.stringify({ type, reason }),
          }
        );

        if (!response.ok) {
          throw new Error('Failed to add suppression');
        }

        // Refresh data
        await fetch(userId);
        return true;
      } catch {
        return false;
      }
    },
    [fetch, getSession]
  );

  // Remove suppression
  const removeSuppression = useCallback(
    async (userId: string, type: string): Promise<boolean> => {
      const session = getSession();
      if (!session?.token) return false;

      try {
        const response = await window.fetch(
          `${API_URL}/admin/users/${userId}/suppressions/${encodeURIComponent(type)}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${session.token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error('Failed to remove suppression');
        }

        // Refresh data
        await fetch(userId);
        return true;
      } catch {
        return false;
      }
    },
    [fetch, getSession]
  );

  return {
    data,
    isLoading,
    error,
    fetch,
    addNote,
    updateNote,
    deleteNote,
    addTag,
    removeTag,
    resendEmail,
    cancelScheduledEmail,
    addSuppression,
    removeSuppression,
  };
}
