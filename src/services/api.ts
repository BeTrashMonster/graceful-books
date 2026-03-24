/**
 * API Client Service
 *
 * Central service for making HTTP requests to the backend API.
 * Handles authentication tokens, error handling, and request/response formatting.
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface ApiError {
  message: string;
  code?: string;
  status: number;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Make an authenticated API request
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    // Get auth token from session storage
    const sessionData = sessionStorage.getItem('graceful_books_session');
    const token = sessionData ? JSON.parse(sessionData).token : null;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Add authorization header if token exists
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    console.log(`🌐 API Request: ${options.method || 'GET'} ${url}`);
    if (options.body) {
      console.log('🌐 Request body:', options.body);
    }
    if (token) {
      console.log('🌐 Auth token present:', token.substring(0, 20) + '...');
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      console.log(`🌐 Response status: ${response.status} ${response.statusText}`);

      // Handle error responses
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          error: { message: 'An unexpected error occurred' },
        }));

        console.error('🌐 API Error response:', errorData);

        // Backend returns errors in { error: { code, message } } format
        const errorInfo = errorData.error || errorData;

        const error: ApiError = {
          message: errorInfo.message || 'Request failed',
          code: errorInfo.code,
          status: response.status,
        };

        throw error;
      }

      // Handle 204 No Content
      if (response.status === 204) {
        return {} as T;
      }

      // Parse and return JSON response
      return await response.json();
    } catch (error) {
      // Network errors or parsing errors
      if (error instanceof Error && 'status' in error) {
        throw error; // Already an ApiError
      }

      throw {
        message: error instanceof Error ? error.message : 'Network error',
        status: 0,
      } as ApiError;
    }
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  /**
   * POST request
   */
  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * PUT request
   */
  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  /**
   * PATCH request
   */
  async patch<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }
}

// Export singleton instance
export const api = new ApiClient(API_URL);

// Export types
export type { ApiError };
