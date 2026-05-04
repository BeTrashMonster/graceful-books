/**
 * Smart Redirect Component
 *
 * Redirects users to their appropriate default page based on their subscribed products
 */

import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function SmartRedirect() {
  const { products } = useAuth();

  // Check user's products and redirect accordingly
  // Priority: CPG > Bookkeeping > Default to CPG

  if (!products || products.length === 0) {
    // No products detected, default to CPG for now
    return <Navigate to="/cpg" replace />;
  }

  // Check for CPG product
  const hasCPG = products.some(p =>
    p.slug === 'cpu-cpg-calculator' ||
    p.slug === 'cpg' ||
    p.slug === 'cpu-calculator'
  );

  // Check for Bookkeeping product
  const hasBookkeeping = products.some(p =>
    p.slug === 'bookkeeping' ||
    p.slug === 'bookkeeping-suite'
  );

  // Redirect based on products
  if (hasCPG) {
    return <Navigate to="/cpg" replace />;
  }

  if (hasBookkeeping) {
    return <Navigate to="/dashboard" replace />;
  }

  // Default fallback
  return <Navigate to="/cpg" replace />;
}
