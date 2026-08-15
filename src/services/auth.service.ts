/**
 * Authentication Service
 *
 * Handles user authentication, registration, and session management
 * with the backend API.
 */

import { API_URL } from '../config/api';

export interface SignupRequest {
  email: string;
  password: string;
  charity_id?: string;
  product?: string; // 'cpg', 'budgeting', 'debt-management', etc.
  affiliate_code?: string;
  discount_code?: string;
}

export interface SignupResponse {
  success: boolean;
  user: {
    id: string;
    email: string;
    support_key: string;
    selected_charity_id?: string;
  };
  token: string; // JWT token
  requires_payment: boolean;
  checkout_session_url?: string; // Stripe checkout URL if payment required
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  user: {
    id: string;
    email: string;
    support_key: string;
    selected_charity_id?: string;
    products: string[]; // List of products user has access to
  };
  token: string; // JWT token
}

export interface VerifyTokenResponse {
  valid: boolean;
  user?: {
    id: string;
    email: string;
    support_key: string;
    selected_charity_id?: string;
    products: string[];
  };
}

/**
 * Sign up a new user
 */
export async function signup(data: SignupRequest): Promise<SignupResponse> {
  const response = await fetch(`${API_URL}/auth/signup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Signup failed' }));
    throw new Error(error.message || 'Failed to create account');
  }

  return response.json();
}

/**
 * Log in an existing user
 */
export async function login(data: LoginRequest): Promise<LoginResponse> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Login failed' }));
    throw new Error(error.message || 'Invalid email or password');
  }

  return response.json();
}

/**
 * Log out the current user
 */
export async function logout(token: string): Promise<void> {
  await fetch(`${API_URL}/auth/logout`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  // Clear local storage regardless of API response
  localStorage.removeItem('auth_token');
  localStorage.removeItem('graceful_books_user');
}

/**
 * Verify if a token is still valid
 */
export async function verifyToken(token: string): Promise<VerifyTokenResponse> {
  const response = await fetch(`${API_URL}/auth/verify`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    return { valid: false };
  }

  return response.json();
}

/**
 * Request password reset email
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const response = await fetch(`${API_URL}/auth/forgot-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || 'Failed to send reset email');
  }
}

/**
 * Reset password with token from email
 */
export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const response = await fetch(`${API_URL}/auth/reset-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token, password: newPassword }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Reset failed' }));
    throw new Error(error.message || 'Failed to reset password');
  }
}

/**
 * Get stored auth token
 */
export function getAuthToken(): string | null {
  return localStorage.getItem('auth_token');
}

/**
 * Store auth token
 */
export function setAuthToken(token: string): void {
  localStorage.setItem('auth_token', token);
}

/**
 * Clear auth token
 */
export function clearAuthToken(): void {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('graceful_books_user');
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return !!getAuthToken();
}

/**
 * Get authorization header for API requests
 */
export function getAuthHeader(): { Authorization: string } | {} {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Verify user's password by attempting re-authentication
 * Used for sensitive operations like viewing masked data
 */
export async function verifyPassword(email: string, password: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    // If login succeeds, password is correct
    return response.ok;
  } catch {
    // Network error or other failure - treat as invalid
    return false;
  }
}
