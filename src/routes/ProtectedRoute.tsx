import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

interface ProtectedRouteProps {
  children: ReactNode;
  requireProduct?: string; // 'bookkeeping-suite' | 'cpu-cpg-calculator'
}

export function ProtectedRoute({ children, requireProduct }: ProtectedRouteProps) {
  const location = useLocation();

  // DEV MODE: Skip auth check on localhost for development
  const isDev = import.meta.env.DEV && window.location.hostname === 'localhost';
  if (isDev) {
    return <>{children}</>;
  }

  // Check if user is authenticated
  const getSession = () => {
    try {
      const sessionData = sessionStorage.getItem('graceful_books_session');
      if (!sessionData) return null;
      return JSON.parse(sessionData);
    } catch {
      return null;
    }
  };

  const session = getSession();

  // Not authenticated - redirect to login
  if (!session || !session.token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If a specific product is required, check if user has it
  if (requireProduct) {
    const products = session.products || [];
    const hasProduct = products.some((p: any) => p.slug === requireProduct);

    if (!hasProduct) {
      // User doesn't have access to this product
      // Redirect to their primary product or show access denied
      const hasCPG = products.some((p: any) => p.slug === 'cpu-cpg-calculator');
      const hasBookkeeping = products.some((p: any) => p.slug === 'bookkeeping-suite');

      if (requireProduct === 'bookkeeping-suite' && hasCPG) {
        // User tried to access bookkeeping but only has CPG
        return <Navigate to="/cpg" replace />;
      } else if (requireProduct === 'cpu-cpg-calculator' && hasBookkeeping) {
        // User tried to access CPG but only has bookkeeping
        return <Navigate to="/dashboard" replace />;
      } else {
        // User has no products - show forbidden
        return <Navigate to="/forbidden" replace />;
      }
    }
  }

  return <>{children}</>;
}
