/**
 * CharityConfirmation Component
 *
 * PURPOSE:
 * First step of the reactivation flow. Before payment, users confirm
 * which charity will receive the $5/month donation from Audacious Money.
 *
 * KEY MESSAGING:
 * "They said it would trickle down. It didn't.
 *  So we're giving from the top."
 *
 * IMPORTANT LEGAL NOTE:
 * Audacious Money makes this donation as a business expense.
 * The user is NOT donating - they are selecting WHERE our donation goes.
 * This is our gift, not an additional charge to them.
 *
 * @module components/frozen/CharityConfirmation
 */

import { useState, useEffect, useCallback } from 'react';
import { useFrozenState } from '../../contexts/FrozenStateContext';
import { getCharities, type Charity } from '../../services/charities.api';
import { CharityCategory, CharityStatus } from '../../types/database.types';
import styles from './CharityConfirmation.module.css';

// =============================================================================
// FALLBACK CHARITIES (for testing/debug mode)
// =============================================================================

const FALLBACK_CHARITIES: Charity[] = [
  {
    id: 'fallback-1',
    name: 'Local Food Bank',
    ein: '00-0000001',
    shortDescription: 'Providing meals to families in need across your community.',
    website: 'https://example.com',
    category: CharityCategory.POVERTY,
    status: CharityStatus.VERIFIED,
    active: true,
    displayOrder: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'fallback-2',
    name: 'Youth Education Fund',
    ein: '00-0000002',
    shortDescription: 'Supporting educational opportunities for underserved youth.',
    website: 'https://example.com',
    category: CharityCategory.EDUCATION,
    status: CharityStatus.VERIFIED,
    active: true,
    displayOrder: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'fallback-3',
    name: 'Environmental Action',
    ein: '00-0000003',
    shortDescription: 'Protecting natural spaces and promoting sustainability.',
    website: 'https://example.com',
    category: CharityCategory.ENVIRONMENT,
    status: CharityStatus.VERIFIED,
    active: true,
    displayOrder: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// =============================================================================
// TYPES
// =============================================================================

interface CharityConfirmationProps {
  /** Called when user confirms charity and is ready to proceed to payment */
  onContinue: (charityId: string) => void;
  /** Called when user wants to go back/cancel */
  onCancel: () => void;
  /** Whether the continue action is loading */
  isLoading?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function CharityConfirmation({
  onContinue,
  onCancel,
  isLoading = false
}: CharityConfirmationProps) {
  const { workshopEnrollment } = useFrozenState();

  const [charities, setCharities] = useState<Charity[]>([]);
  const [selectedCharityId, setSelectedCharityId] = useState<string | null>(null);
  const [isLoadingCharities, setIsLoadingCharities] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Load available charities
  const loadCharities = useCallback(async () => {
    try {
      setIsLoadingCharities(true);
      setError(null);
      const result = await getCharities();
      setCharities(result);

      // Pre-select user's existing charity if they have one
      // or default to first charity
      if (workshopEnrollment?.charityId) {
        setSelectedCharityId(workshopEnrollment.charityId);
      } else if (result.length > 0) {
        setSelectedCharityId(result[0].id);
      }
    } catch (err) {
      console.error('[CharityConfirmation] Failed to load charities:', err);

      // Check if we're in debug mode - use fallback charities
      const isDebugMode = window.location.search.includes('debug_frozen');
      if (isDebugMode) {
        console.log('[CharityConfirmation] Debug mode: using fallback charities');
        setCharities(FALLBACK_CHARITIES);
        setSelectedCharityId(FALLBACK_CHARITIES[0].id);
        setError(null);
      } else {
        setError('Unable to load charity options. Please try again.');
      }
    } finally {
      setIsLoadingCharities(false);
    }
  }, [workshopEnrollment?.charityId]);

  // Initial load
  useEffect(() => {
    loadCharities();
  }, [loadCharities]);

  // Retry handler
  const handleRetry = useCallback(() => {
    setRetryCount(prev => prev + 1);
    loadCharities();
  }, [loadCharities]);

  const handleContinue = () => {
    if (selectedCharityId) {
      onContinue(selectedCharityId);
    }
  };

  const selectedCharity = charities.find(c => c.id === selectedCharityId);

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className={styles.container} data-testid="charity-confirmation">
      {/* Mission Statement */}
      <div className={styles.missionSection}>
        <p className={styles.missionBold}>
          They said it would trickle down. It didn't.
        </p>
        <p className={styles.missionHighlight}>
          So we're giving from the top.
        </p>
        <p className={styles.missionDetail}>
          $5 of every subscription goes directly to the cause you select &mdash;
          our gift, not an extra charge.
        </p>
      </div>

      {/* Charity Selection */}
      <div className={styles.selectionSection}>
        <h3 className={styles.selectionTitle}>
          Where should your $5 go each month?
        </h3>

        {isLoadingCharities ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner} aria-hidden="true" />
            <span>Loading charity options...</span>
          </div>
        ) : error ? (
          <div className={styles.errorState}>
            <p>{error}</p>
            <button
              type="button"
              onClick={handleRetry}
              className={styles.retryButton}
            >
              Retry
            </button>
          </div>
        ) : (
          <div className={styles.charityGrid}>
            {charities.map((charity) => (
              <button
                key={charity.id}
                type="button"
                className={`${styles.charityCard} ${
                  selectedCharityId === charity.id ? styles.charityCardSelected : ''
                }`}
                onClick={() => setSelectedCharityId(charity.id)}
                aria-pressed={selectedCharityId === charity.id}
              >
                <div className={styles.charityName}>{charity.name}</div>
                {charity.shortDescription && (
                  <div className={styles.charityDescription}>
                    {charity.shortDescription}
                  </div>
                )}
                {selectedCharityId === charity.id && (
                  <div className={styles.checkmark} aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected charity confirmation */}
      {selectedCharity && (
        <div className={styles.confirmationText}>
          Each month, <strong>$5</strong> will go to <strong>{selectedCharity.name}</strong>.
        </div>
      )}

      {/* Actions */}
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.continueButton}
          onClick={handleContinue}
          disabled={!selectedCharityId || isLoading || isLoadingCharities}
        >
          {isLoading ? (
            <>
              <span className={styles.buttonSpinner} aria-hidden="true" />
              Processing...
            </>
          ) : (
            'Continue to Payment'
          )}
        </button>

        <button
          type="button"
          className={styles.cancelButton}
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
