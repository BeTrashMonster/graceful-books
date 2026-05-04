import { useState, useEffect, useMemo } from 'react';
import type { Charity, CharityCategory } from '../../types/database.types';
import { getAllCharities } from '../../store/charities';
import { getCategoryDisplay } from '../../db/schema/charity.schema';
import { CharityCard } from './CharityCard';
import styles from './CharitySelector.module.css';

export interface CharitySelectorProps {
  /**
   * Currently selected charity ID
   */
  selectedCharityId?: string | null;
  /**
   * Callback when a charity is selected
   */
  onSelect: (charity: Charity) => void;
  /**
   * Whether to show the search input
   */
  showSearch?: boolean;
  /**
   * Whether to show category filters
   */
  showFilters?: boolean;
  /**
   * Optional: provide charities directly (for testing)
   */
  charities?: Charity[];
}

/**
 * CharitySelector component for choosing a charity to support
 *
 * Features:
 * - Display all available charities
 * - Search charities by name or description
 * - Filter by category
 * - Visual indication of selected charity
 * - Responsive grid layout
 * - Accessible with keyboard navigation
 *
 * @example
 * ```tsx
 * <CharitySelector
 *   selectedCharityId={user.selected_charity_id}
 *   onSelect={handleCharitySelect}
 *   showSearch
 *   showFilters
 * />
 * ```
 */
export function CharitySelector({
  selectedCharityId,
  onSelect,
  showSearch = true,
  showFilters = true,
  charities: providedCharities,
}: CharitySelectorProps) {
  const [charities, setCharities] = useState<Charity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CharityCategory | 'all'>('all');
  const [hoveredCharity, setHoveredCharity] = useState<Charity | null>(null);

  // Load charities on mount (or use provided ones)
  useEffect(() => {
    if (providedCharities) {
      setCharities(providedCharities);
      setLoading(false);
    } else {
      loadCharities();
    }
  }, [providedCharities]);

  const loadCharities = async () => {
    setLoading(true);
    try {
      const data = await getAllCharities();
      setCharities(data);
    } catch (error) {
      console.error('Failed to load charities:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter charities based on search and category
  const filteredCharities = useMemo(() => {
    let filtered = charities;

    // Apply category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter((c) => c.category === selectedCategory);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.shortDescription?.toLowerCase().includes(query) ||
          c.longDescription?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [charities, selectedCategory, searchQuery]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleCategoryFilter = (category: CharityCategory | 'all') => {
    setSelectedCategory(category);
  };

  const categories = useMemo(() => {
    const uniqueCategories = new Set(charities.map((c) => c.category));
    return Array.from(uniqueCategories).sort();
  }, [charities]);

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <p>Loading charities...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Select Give Back</h1>
        <p className={styles.description}>
          Choose a cause that matters to you
        </p>
        <div className={styles.impactStatement}>
          ✨ $5/month makes a real difference
        </div>
      </div>

      {showSearch && (
        <div className={styles.searchContainer}>
          <div className={styles.searchInputWrapper}>
            <svg
              className={styles.searchIcon}
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M9 17C13.4183 17 17 13.4183 17 9C17 4.58172 13.4183 1 9 1C4.58172 1 1 4.58172 1 9C1 13.4183 4.58172 17 9 17Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M19 19L14.65 14.65"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <input
              type="text"
              placeholder="Search charities..."
              value={searchQuery}
              onChange={handleSearch}
              className={styles.searchInput}
              aria-label="Search charities"
            />
          </div>
        </div>
      )}

      {showFilters && categories.length > 0 && (
        <div className={styles.filters}>
          <button
            className={`${styles.filterButton} ${selectedCategory === 'all' ? styles.active : ''}`}
            onClick={() => handleCategoryFilter('all')}
            aria-pressed={selectedCategory === 'all'}
          >
            All Charities
          </button>
          {categories.map((category) => (
            <button
              key={category}
              className={`${styles.filterButton} ${selectedCategory === category ? styles.active : ''}`}
              onClick={() => handleCategoryFilter(category)}
              aria-pressed={selectedCategory === category}
            >
              {getCategoryDisplay(category)}
            </button>
          ))}
        </div>
      )}

      {filteredCharities.length === 0 ? (
        <div className={styles.empty}>
          <p>No charities found matching your criteria.</p>
          {(searchQuery || selectedCategory !== 'all') && (
            <button
              className={styles.clearButton}
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <>
          <div className={styles.grid}>
          {/* Center golden circle */}
          <div className={styles.centerHeader}>
            <h2 className={styles.centerTitle}>
              Choose<br />Your<br />Cause
            </h2>
          </div>

          {/* Charity cards in perfect pentagon */}
          {filteredCharities.map((charity, index) => {
            const angle = (index * 360) / filteredCharities.length;
            const radius = window.innerWidth <= 768 ? 180 : 270;
            const style = {
              transform: `rotate(${angle}deg) translate(${radius}px) rotate(-${angle}deg)`
            };

            // Mark only NAYA as coming soon (Feed Seven Generations has given consent!)
            const isComingSoon = charity.name.includes('NAYA');

            return (
              <div
                key={charity.id}
                style={style}
                onMouseEnter={() => !isComingSoon && setHoveredCharity(charity)}
                onMouseLeave={() => setHoveredCharity(null)}
              >
                <CharityCard
                  charity={charity}
                  selected={charity.id === selectedCharityId}
                  onClick={onSelect}
                  showFullDescription={false}
                  comingSoon={isComingSoon}
                />
              </div>
            );
          })}
        </div>

        {/* Honor Panel - Shows hovered charity details over center circle */}
        {hoveredCharity && (
          <div className={styles.honorPanel}>
            <div className={styles.honorContent}>
              <div className={styles.honorHeader}>
                <h3 className={styles.honorTitle}>{hoveredCharity.name}</h3>
                <div className={styles.honorDivider}></div>
              </div>
              <p className={styles.honorDescription}>
                {hoveredCharity.longDescription || hoveredCharity.shortDescription}
              </p>
              <div className={styles.honorFooter}>
                <div className={styles.honorImpact}>
                  ✨ $5 from your membership helps fund their vital work
                </div>
              </div>
            </div>
          </div>
        )}
        </>
      )}
    </div>
  );
}
