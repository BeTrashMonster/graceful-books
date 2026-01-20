/**
 * AdminRoute Component Tests
 *
 * Tests for admin-only route protection and authorization checks.
 *
 * Requirements:
 * - IC3: Admin Panel - Charity Management (403 error for non-admin users)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AdminRoute } from './AdminRoute';

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

describe('AdminRoute', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
  });

  it('should redirect to login if user is not authenticated', () => {
    render(
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route
            path="/admin/test"
            element={
              <AdminRoute>
                <div>Admin Content</div>
              </AdminRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    );

    // Should redirect to login
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
  });

  it('should redirect to forbidden if user is authenticated but not admin', () => {
    // Set up non-admin user
    mockLocalStorage.setItem(
      'graceful_books_user',
      JSON.stringify({
        id: 'user-123',
        email: 'user@example.com',
        role: 'user',
        isAdmin: false,
      })
    );

    render(
      <BrowserRouter>
        <Routes>
          <Route path="/forbidden" element={<div>Forbidden Page</div>} />
          <Route
            path="/admin/test"
            element={
              <AdminRoute>
                <div>Admin Content</div>
              </AdminRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    );

    // Should redirect to forbidden
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
  });

  it('should render children if user is admin with role property', () => {
    // Set up admin user with role property
    mockLocalStorage.setItem(
      'graceful_books_user',
      JSON.stringify({
        id: 'admin-123',
        email: 'admin@example.com',
        role: 'admin',
      })
    );

    render(
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              <AdminRoute>
                <div>Admin Content</div>
              </AdminRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    );

    // Should render admin content
    expect(screen.getByText('Admin Content')).toBeInTheDocument();
  });

  it('should render children if user is admin with isAdmin property', () => {
    // Set up admin user with isAdmin property
    mockLocalStorage.setItem(
      'graceful_books_user',
      JSON.stringify({
        id: 'admin-123',
        email: 'admin@example.com',
        isAdmin: true,
      })
    );

    render(
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              <AdminRoute>
                <div>Admin Content</div>
              </AdminRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    );

    // Should render admin content
    expect(screen.getByText('Admin Content')).toBeInTheDocument();
  });

  it('should handle corrupted localStorage data gracefully', () => {
    // Set up corrupted user data
    mockLocalStorage.setItem('graceful_books_user', 'invalid-json');

    render(
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route
            path="/admin/test"
            element={
              <AdminRoute>
                <div>Admin Content</div>
              </AdminRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    );

    // Should redirect to login due to parse error
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
  });
});
