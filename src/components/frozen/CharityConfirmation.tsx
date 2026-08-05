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
// CATEGORY ICONS & STYLING
// =============================================================================

const CATEGORY_ICONS: Record<CharityCategory, JSX.Element> = {
  [CharityCategory.POVERTY]: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  [CharityCategory.EDUCATION]: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
    </svg>
  ),
  [CharityCategory.ENVIRONMENT]: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22c4-4 8-7 8-12a8 8 0 1 0-16 0c0 5 4 8 8 12z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  [CharityCategory.HEALTH]: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  ),
  [CharityCategory.ANIMAL_WELFARE]: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 5.172C10 3.782 8.423 2.679 6.5 3c-2.823.47-4.113 6.006-4 7 .08.703 1.725 1.722 3.656 1 1.261-.472 1.96-1.45 2.344-2.5M14.267 5.172c0-1.39 1.577-2.493 3.5-2.172 2.823.47 4.113 6.006 4 7-.08.703-1.725 1.722-3.656 1-1.261-.472-1.855-1.45-2.239-2.5" />
      <path d="M8 14v.5M16 14v.5M11.25 16.25h1.5L12 17l-.75-.75z" />
      <path d="M4.42 11.247A13.152 13.152 0 0 0 4 14.556C4 18.728 7.582 21 12 21s8-2.272 8-6.444c0-1.061-.162-2.2-.493-3.309" />
    </svg>
  ),
  [CharityCategory.HUMAN_RIGHTS]: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  [CharityCategory.DISASTER_RELIEF]: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      <path d="M12 5L9.04 7.96a2.17 2.17 0 0 0 0 3.08v0c.82.82 2.13.85 3 .07l2.07-1.9a2.82 2.82 0 0 1 3.79 0l2.96 2.66" />
    </svg>
  ),
  [CharityCategory.ARTS_CULTURE]: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="13.5" cy="6.5" r="0.5" />
      <circle cx="17.5" cy="10.5" r="0.5" />
      <circle cx="8.5" cy="7.5" r="0.5" />
      <circle cx="6.5" cy="12.5" r="0.5" />
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2z" />
    </svg>
  ),
  [CharityCategory.COMMUNITY]: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 21a8 8 0 0 0-16 0" />
      <circle cx="10" cy="8" r="5" />
      <path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3" />
    </svg>
  ),
  [CharityCategory.OTHER]: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
};

const CATEGORY_STYLES: Record<CharityCategory, string> = {
  [CharityCategory.POVERTY]: styles.categoryPoverty,
  [CharityCategory.EDUCATION]: styles.categoryEducation,
  [CharityCategory.ENVIRONMENT]: styles.categoryEnvironment,
  [CharityCategory.HEALTH]: styles.categoryHealth,
  [CharityCategory.ANIMAL_WELFARE]: styles.categoryDefault,
  [CharityCategory.HUMAN_RIGHTS]: styles.categoryHumanitarian,
  [CharityCategory.DISASTER_RELIEF]: styles.categoryHumanitarian,
  [CharityCategory.ARTS_CULTURE]: styles.categoryDefault,
  [CharityCategory.COMMUNITY]: styles.categoryDefault,
  [CharityCategory.OTHER]: styles.categoryDefault,
};

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

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className={styles.container} data-testid="charity-confirmation">
      {/* Header with tagline */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <p className={styles.headerTagline}>
            They said it would trickle down. It didn't.
          </p>
          <p className={styles.headerHighlight}>
            So we're giving from the top.
          </p>
        </div>
        <button
          type="button"
          className={styles.closeButton}
          onClick={onCancel}
          aria-label="Close"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className={styles.body}>
        <p className={styles.bodyText}>
          $5 of every subscription goes directly to the cause you select &mdash; our gift, not an extra charge.
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
            {charities.map((charity) => {
              const categoryStyle = CATEGORY_STYLES[charity.category] || styles.categoryDefault;
              const categoryIcon = CATEGORY_ICONS[charity.category];

              return (
                <button
                  key={charity.id}
                  type="button"
                  className={`${styles.charityCard} ${
                    selectedCharityId === charity.id ? styles.charityCardSelected : ''
                  }`}
                  onClick={() => setSelectedCharityId(charity.id)}
                  aria-pressed={selectedCharityId === charity.id}
                >
                  {/* Category Icon */}
                  <div className={`${styles.charityIcon} ${categoryStyle}`} aria-hidden="true">
                    {categoryIcon}
                  </div>

                  {/* Charity Info */}
                  <div className={styles.charityName}>{charity.name}</div>
                  {charity.shortDescription && (
                    <div className={styles.charityDescription}>
                      {charity.shortDescription}
                    </div>
                  )}

                  {/* Selected Checkmark */}
                  {selectedCharityId === charity.id && (
                    <div className={styles.checkmark} aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

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
