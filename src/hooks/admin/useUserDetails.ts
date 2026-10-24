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
 */
function transformDetails(data: Record<string, unknown>): UserDetailsData {
  return {
    userId: String(data.userId || data.id),
    email: String(data.email),
    firstName: data.firstName as string | null,
    lastName: data.lastName as string | null,
    companyName: data.companyName as string | null,
    supportKey: String(data.supportKey),
    productSlug: String(data.productSlug),
    productName: String(data.productName || data.productSlug),
    createdAt: String(data.createdAt),
    lastLoginAt: data.lastLoginAt as string | null,
    stripeCustomerId: data.stripeCustomerId as string | null,
    subscriptionId: data.subscriptionId as string | null,
    subscriptionStatus: data.subscriptionStatus as string | null,
    isBeta: Boolean(data.isBeta),
    needsAttention: Boolean(data.needsAttention),
    frozenAt: data.frozenAt as string | null,
    frozenReason: data.frozenReason as string | null,
    pausedAt: data.pausedAt as string | null,
    pausedUntil: data.pausedUntil as string | null,
    cancelledAt: data.cancelledAt as string | null,
    recentEmails: Array.isArray(data.recentEmails)
      ? (data.recentEmails as Array<Record<string, unknown>>).map((e) => ({
          id: String(e.id),
          emailType: String(e.emailType),
          subject: String(e.subject || ''),
          status: e.status as EmailHistoryItem['status'],
          sentAt: e.sentAt as string | null,
          scheduledFor: e.scheduledFor as string | null,
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

  // Fetch user details
  const fetch = useCallback(async (userId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await window.fetch(`${API_URL}/admin/users/${userId}/details`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch user details: ${response.statusText}`);
      }

      const responseData = await response.json();
      setData(transformDetails(responseData));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch user details');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Add note
  const addNote = useCallback(
    async (userId: string, note: string, noteType: string): Promise<boolean> => {
      try {
        const response = await window.fetch(`${API_URL}/admin/users/${userId}/notes`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
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
    [fetch]
  );

  // Update note
  const updateNote = useCallback(
    async (userId: string, noteId: string, note: string): Promise<boolean> => {
      try {
        const response = await window.fetch(
          `${API_URL}/admin/users/${userId}/notes/${noteId}`,
          {
            method: 'PATCH',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
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
    [fetch]
  );

  // Delete note
  const deleteNote = useCallback(
    async (userId: string, noteId: string): Promise<boolean> => {
      try {
        const response = await window.fetch(
          `${API_URL}/admin/users/${userId}/notes/${noteId}`,
          {
            method: 'DELETE',
            credentials: 'include',
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
    [fetch]
  );

  // Add tag
  const addTag = useCallback(
    async (userId: string, tag: string): Promise<boolean> => {
      try {
        const response = await window.fetch(`${API_URL}/admin/users/${userId}/tags`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
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
    [data]
  );

  // Remove tag
  const removeTag = useCallback(
    async (userId: string, tag: string): Promise<boolean> => {
      try {
        const response = await window.fetch(
          `${API_URL}/admin/users/${userId}/tags/${encodeURIComponent(tag)}`,
          {
            method: 'DELETE',
            credentials: 'include',
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
    [data]
  );

  // Resend email
  const resendEmail = useCallback(
    async (userId: string, emailId: string): Promise<boolean> => {
      try {
        const response = await window.fetch(
          `${API_URL}/admin/users/${userId}/emails/${emailId}/resend`,
          {
            method: 'POST',
            credentials: 'include',
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
    []
  );

  // Cancel scheduled email
  const cancelScheduledEmail = useCallback(
    async (userId: string, scheduledId: string): Promise<boolean> => {
      try {
        const response = await window.fetch(
          `${API_URL}/admin/users/${userId}/scheduled-emails/${scheduledId}`,
          {
            method: 'DELETE',
            credentials: 'include',
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
    [fetch]
  );

  // Add suppression
  const addSuppression = useCallback(
    async (userId: string, type: string, reason?: string): Promise<boolean> => {
      try {
        const response = await window.fetch(
          `${API_URL}/admin/users/${userId}/suppressions`,
          {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
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
    [fetch]
  );

  // Remove suppression
  const removeSuppression = useCallback(
    async (userId: string, type: string): Promise<boolean> => {
      try {
        const response = await window.fetch(
          `${API_URL}/admin/users/${userId}/suppressions/${encodeURIComponent(type)}`,
          {
            method: 'DELETE',
            credentials: 'include',
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
    [fetch]
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
