/**
 * StripePricingTable Component
 *
 * Embeds Stripe's Pricing Table for subscription selection.
 * This replaces the custom checkout session flow, letting Stripe
 * handle the monthly/annual toggle natively.
 *
 * @module components/frozen/StripePricingTable
 */

import { useEffect, useRef } from 'react';
import styles from './StripePricingTable.module.css';

// =============================================================================
// TYPES
// =============================================================================

interface StripePricingTableProps {
  /** User's email to prefill in checkout */
  userEmail?: string;
  /** User ID for tracking (passed as client-reference-id) */
  userId?: string;
  /** Called when user wants to go back */
  onBack?: () => void;
}

// Stripe Pricing Table configuration
const PRICING_TABLE_ID = 'prctbl_1U1TfLDAS9U3cd2ICC0sZdSJ';
const PUBLISHABLE_KEY = 'pk_live_51QAb8kDAS9U3cd2IJbZUErA5r9RymOJHLivsvpjRG0DCWIcuRFAvC2lenopH1SDGE0NQDrAMw9PqP2pwqoliYYfN00e3dg3eag';

// =============================================================================
// COMPONENT
// =============================================================================

export function StripePricingTable({
  userEmail,
  userId,
  onBack,
}: StripePricingTableProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scriptLoaded = useRef(false);

  useEffect(() => {
    // Load Stripe Pricing Table script if not already loaded
    if (!scriptLoaded.current && !document.querySelector('script[src*="pricing-table.js"]')) {
      const script = document.createElement('script');
      script.src = 'https://js.stripe.com/v3/pricing-table.js';
      script.async = true;
      document.head.appendChild(script);
      scriptLoaded.current = true;
    }

    // Create the pricing table element
    if (containerRef.current) {
      // Clear any existing content
      containerRef.current.innerHTML = '';

      // Create the stripe-pricing-table element
      const pricingTable = document.createElement('stripe-pricing-table');
      pricingTable.setAttribute('pricing-table-id', PRICING_TABLE_ID);
      pricingTable.setAttribute('publishable-key', PUBLISHABLE_KEY);

      // Add user info for prefill and tracking
      if (userEmail) {
        pricingTable.setAttribute('customer-email', userEmail);
      }
      if (userId) {
        pricingTable.setAttribute('client-reference-id', userId);
      }

      containerRef.current.appendChild(pricingTable);
    }

    // Cleanup function
    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [userEmail, userId]);

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h2 className={styles.title}>Choose Your Plan</h2>
        <p className={styles.subtitle}>
          Select the billing option that works best for you
        </p>
      </div>

      {/* Stripe Pricing Table Container */}
      <div ref={containerRef} className={styles.tableContainer} />

      {/* Back Button */}
      {onBack && (
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.backButton}
            onClick={onBack}
          >
            Back to Charity Selection
          </button>
        </div>
      )}
    </div>
  );
}
