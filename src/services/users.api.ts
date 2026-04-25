/**
 * Users API Service
 *
 * Handles all user account management API calls to the backend.
 */

import { api } from './api';

interface DeleteAccountRequest {
  password: string;
  confirmText: string;
}

interface DeleteAccountResponse {
  message: string;
  deleted: boolean;
}

interface DeactivateAccountRequest {
  password: string;
}

interface DeactivateAccountResponse {
  message: string;
  deactivated: boolean;
}

interface ReactivateAccountRequest {
  password: string;
}

interface ReactivateAccountResponse {
  message: string;
  reactivated: boolean;
}

/**
 * Permanently delete user account
 */
export async function deleteAccount(data: DeleteAccountRequest): Promise<DeleteAccountResponse> {
  const response = await api.delete<{ data: DeleteAccountResponse }>('/users/me', { data });
  return response.data;
}

/**
 * Deactivate user account (temporary suspension)
 */
export async function deactivateAccount(data: DeactivateAccountRequest): Promise<DeactivateAccountResponse> {
  const response = await api.post<{ data: DeactivateAccountResponse }>('/users/me/deactivate', data);
  return response.data;
}

/**
 * Reactivate a suspended user account
 */
export async function reactivateAccount(data: ReactivateAccountRequest): Promise<ReactivateAccountResponse> {
  const response = await api.post<{ data: ReactivateAccountResponse }>('/users/me/reactivate', data);
  return response.data;
}
