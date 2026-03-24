/**
 * Authentication API Service
 *
 * Handles all authentication-related API calls to the backend.
 */

import { api } from './api';

interface SignupRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  companyName?: string;
  affiliateCode?: string;
  charityId?: number;
}

interface SignupResponse {
  user: {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
    supportKey: string;
    emailVerified: boolean;
    createdAt: string;
  };
  token: string;
  message?: string;
}

interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse {
  user: {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
  };
  token: string;
}

/**
 * Sign up a new user
 */
export async function signup(data: SignupRequest): Promise<SignupResponse> {
  const response = await api.post<SignupResponse>('/auth/signup', data);
  return response;
}

/**
 * Log in an existing user
 */
export async function login(data: LoginRequest): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>('/auth/login', data);
  return response;
}

/**
 * Request a password reset email
 */
export async function forgotPassword(email: string): Promise<{ message: string }> {
  return await api.post('/auth/forgot-password', { email });
}

/**
 * Reset password using token from email
 */
export async function resetPassword(
  token: string,
  password: string
): Promise<{ message: string }> {
  return await api.post('/auth/reset-password', { token, password });
}

/**
 * Verify email using token from email
 */
export async function verifyEmail(token: string): Promise<{ message: string }> {
  return await api.post('/auth/verify-email', { token });
}
