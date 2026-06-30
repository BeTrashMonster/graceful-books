import { useState } from 'react';
import { CharitySelector } from '../components/charity/CharitySelector';
import type { Charity } from '../types/database.types';
import styles from './auth/Signup.module.css';

// Mock charity data matching production
const mockCharities: Charity[] = [
  {
    id: '1',
    name: 'Senior Dog Rescue of Oregon',
    shortDescription: 'Rescuing and rehoming senior dogs',
    longDescription: 'Dedicated to giving senior dogs a second chance at a loving home',
    category: 'animal_welfare',
    website: 'https://example.com/senior-dog',
    logo: null,
    ein: '12-3456789',
    status: 'active',
    brandColorBackground: '#4FB3D4',
    brandColorTitle: '#FF6B35',
    created_at: Date.now(),
    updated_at: Date.now(),
  },
  {
    id: '2',
    name: 'Feed Seven Generations',
    shortDescription: 'Providing food security for communities',
    longDescription: 'Working to ensure sustainable food access for seven generations',
    category: 'food_security',
    website: 'https://example.com/feed-seven',
    logo: null,
    ein: '12-3456790',
    status: 'active',
    brandColorBackground: '#8B7355',
    brandColorTitle: '#FFA500',
    created_at: Date.now(),
    updated_at: Date.now(),
  },
  {
    id: '3',
    name: 'Built Oregon',
    shortDescription: 'Building sustainable communities in Oregon',
    longDescription: 'Creating opportunities through construction and community development',
    category: 'community_development',
    website: 'https://example.com/built-oregon',
    logo: null,
    ein: '12-3456791',
    status: 'active',
    brandColorBackground: '#FFFFFF',
    brandColorTitle: '#000000',
    created_at: Date.now(),
    updated_at: Date.now(),
  },
  {
    id: '4',
    name: 'NAYA Youth and Family',
    shortDescription: 'Supporting Native American youth and families',
    longDescription: 'Empowering Native American communities through education and support',
    category: 'education',
    website: 'https://example.com/naya',
    logo: null,
    ein: '12-3456792',
    status: 'active',
    brandColorBackground: '#FFFFFF',
    brandColorTitle: '#000000',
    created_at: Date.now(),
    updated_at: Date.now(),
  },
  {
    id: '5',
    name: 'Hot Mess Express',
    shortDescription: 'Supporting families in crisis',
    longDescription: 'Providing immediate support to families experiencing difficult times',
    category: 'family_support',
    website: 'https://example.com/hot-mess',
    logo: null,
    ein: '12-3456793',
    status: 'active',
    brandColorBackground: '#2F5233',
    brandColorTitle: '#FF6B6B',
    created_at: Date.now(),
    updated_at: Date.now(),
  },
];

/**
 * Test page for charity selector - accessible at /charity-selector-test
 * Matches the exact layout of the production signup charity selection step
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
          charities={mockCharities}
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
