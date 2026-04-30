/**
 * Charity Settings Panel
 *
 * Allows users to view and change their charity selection
 * Changes take effect on the next billing cycle
 */

import { useState, useEffect } from 'react';
import type { Charity } from '../../types/database.types';
import { CharitySelector } from '../charity';
import { getMyCharitySelection, selectCharity } from '../../services/charities.api';
import styles from './CharitySettingsPanel.module.css';

interface UserCharitySelection {
  id: string;
  charityId: string;
  selectedAt: string;
  effectiveFrom: string;
  charity: {
    name: string;
    shortDescription: string;
    website: string;
    ein: string;
    category: string;
    logo?: string;
  };
}

export function CharitySettingsPanel() {
  const [currentSelection, setCurrentSelection] = useState<UserCharitySelection | null>(null);
  const [isChanging, setIsChanging] = useState(false);
  const [selectedCharity, setSelectedCharity] = useState<Charity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadCurrentSelection();
  }, []);

  const loadCurrentSelection = async () => {
    setLoading(true);
    setError(null);

    try {
      const selection = await getMyCharitySelection();
      setCurrentSelection(selection);
    } catch (err) {
      console.error('Failed to load charity selection:', err);
      setError(err instanceof Error ? err.message : 'Failed to load charity selection');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeClick = () => {
    setIsChanging(true);
    setSuccessMessage(null);
  };

  const handleCancelChange = () => {
    setIsChanging(false);
    setSelectedCharity(null);
  };

  const handleCharitySelect = (charity: Charity) => {
    setSelectedCharity(charity);
  };

  const handleSaveChange = async () => {
    if (!selectedCharity) {
      setError('Please select a charity');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await selectCharity(selectedCharity.id);
      setSuccessMessage(`Your charity has been updated to ${selectedCharity.name}. This change will take effect on your next billing cycle.`);
      setIsChanging(false);
      setSelectedCharity(null);

      // Reload the current selection
      await loadCurrentSelection();
    } catch (err) {
      console.error('Failed to change charity:', err);
      setError(err instanceof Error ? err.message : 'Failed to change charity');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.panel}>
        <h2 className={styles.title}>Charity Selection</h2>
        <div className={styles.loading}>Loading your charity selection...</div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <h2 className={styles.title}>Charity Selection</h2>
      <p className={styles.description}>
        $5 from your monthly subscription goes to your chosen charity. You can change your selection at any time.
      </p>

      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}

      {successMessage && (
        <div className={styles.success} role="status">
          {successMessage}
        </div>
      )}

      {!isChanging && currentSelection ? (
        <div className={styles.currentSelection}>
          <h3 className={styles.currentTitle}>Current Charity</h3>
          <div className={styles.charityCard}>
            <div className={styles.charityInfo}>
              <h4 className={styles.charityName}>{currentSelection.charity.name}</h4>
              <p className={styles.charityDescription}>
                {currentSelection.charity.shortDescription}
              </p>
              <p className={styles.charityCategory}>
                Category: {currentSelection.charity.category}
              </p>
              <a
                href={currentSelection.charity.website}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.charityLink}
              >
                Visit website →
              </a>
            </div>
          </div>
          <button
            type="button"
            onClick={handleChangeClick}
            className={styles.changeButton}
          >
            Change Charity
          </button>
        </div>
      ) : !isChanging && !currentSelection ? (
        <div className={styles.noSelection}>
          <p>You haven't selected a charity yet.</p>
          <button
            type="button"
            onClick={handleChangeClick}
            className={styles.selectButton}
          >
            Select a Charity
          </button>
        </div>
      ) : (
        <div className={styles.selectorContainer}>
          <div className={styles.selectorHeader}>
            <h3 className={styles.selectorTitle}>
              {currentSelection ? 'Choose a New Charity' : 'Choose a Charity'}
            </h3>
            <p className={styles.selectorNote}>
              {currentSelection
                ? 'Your new selection will take effect on your next billing cycle.'
                : 'Select a charity to support with $5 from your monthly subscription.'}
            </p>
          </div>

          <CharitySelector
            selectedCharityId={selectedCharity?.id}
            onSelect={handleCharitySelect}
            showSearch={false}
            showFilters={false}
          />

          <div className={styles.actions}>
            <button
              type="button"
              onClick={handleCancelChange}
              className={styles.cancelButton}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveChange}
              className={styles.saveButton}
              disabled={!selectedCharity || isSaving}
            >
              {isSaving ? 'Saving...' : currentSelection ? 'Update Charity' : 'Save Selection'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
