import { useState } from 'react';
import { CharitySelector } from '../components/charity/CharitySelector';
import type { Charity } from '../types/database.types';
import styles from './auth/Signup.module.css';

/**
 * Test page for charity selector - accessible at /charity-selector-test
 * Fetches live charity data from the API to match production behavior
 */
export default function CharitySelectorTest() {
  const [selectedCharityId, setSelectedCharityId] = useState<string | null>(null);

  const handleSelect = (charity: Charity) => {
    setSelectedCharityId(charity.id);
    console.log('Selected charity:', charity);
  };

  const handleBack = () => {
    console.log('Back button clicked');
    // In production this would go to the previous step
  };

  const handleContinue = () => {
    if (!selectedCharityId) {
      alert('Please select a charity to continue');
      return;
    }
    console.log('Continue button clicked with charity:', selectedCharityId);
    // In production this would proceed to product selection
  };

  return (
    <div className={styles.container}>
      <div className={styles.wideCard}>
        <CharitySelector
          selectedCharityId={selectedCharityId}
          onSelect={handleSelect}
          showSearch={false}
          showFilters={false}
        />

        <div className={styles.navigationButtons}>
          <button onClick={handleBack} className={styles.backButton}>
            Back
          </button>
          <button
            onClick={handleContinue}
            disabled={!selectedCharityId}
            className={styles.continueButton}
          >
            Continue to Product Selection
          </button>
        </div>
      </div>
    </div>
  );
}
