/**
 * AdminRoute Component
 *
 * Protected route wrapper that checks if user has admin role.
 * Non-admin users receive 403 Forbidden error.
 *
 * Requirements:
 * - IC3: Admin Panel - Charity Management (admin-only access)
 */

import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

interface AdminRouteProps {
  children: ReactNode;
}

/**
 * Check if current user has admin role
 * TODO: Replace with actual user context/auth service
 */
function isAdmin(): boolean {
  try {
    const userData = localStorage.getItem('graceful_books_user');
    if (!userData) {
      return false;
    }

    const user = JSON.parse(userData);
    // Check if user has admin role
    // In a real implementation, this would check the user's role from the database
    return user.role === 'admin' || user.isAdmin === true;
  } catch {
    return false;
  }
}

/**
 * AdminRoute wrapper component
 * Redirects non-admin users to 403 Forbidden page
 */
export function AdminRoute({ children }: AdminRouteProps) {
  const location = useLocation();

  // Check if user is authenticated first
  const isAuthenticated = () => {
    try {
      const userData = localStorage.getItem('graceful_books_user');
      return !!userData;
    } catch {
      return false;
    }
  };

  // If not authenticated, redirect to login
  if (!isAuthenticated()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If authenticated but not admin, show 403 error
  if (!isAdmin()) {
    return <Navigate to="/forbidden" state={{ from: location }} replace />;
  }

  // User is admin, render children
  return <>{children}</>;
}
