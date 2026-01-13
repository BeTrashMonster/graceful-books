import { HTMLAttributes, forwardRef } from 'react';
import type { Charity } from '../../types/database.types';
import { getCategoryDisplay } from '../../db/schema/charity.schema';
import styles from './CharityCard.module.css';
import clsx from 'clsx';

export interface CharityCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onClick'> {
  /**
   * The charity to display
   */
  charity: Charity;
  /**
   * Whether this charity is currently selected
   */
  selected?: boolean;
  /**
   * Callback when the card is clicked
   */
  onClick?: (charity: Charity) => void;
  /**
   * Whether to show the full description
   */
  showFullDescription?: boolean;
}

/**
 * CharityCard component displays information about a charity
 *
 * Features:
 * - Shows charity name, description, and category
 * - Clickable card for selection
 * - Visual indication of selected state
 * - Accessible with keyboard navigation
 * - Learn more link to charity website
 *
 * @example
 * ```tsx
 * <CharityCard
 *   charity={charity}
 *   selected={selectedId === charity.id}
 *   onClick={handleCharitySelect}
 * />
 * ```
 */
export const CharityCard = forwardRef<HTMLDivElement, CharityCardProps>(
  (
    {
      charity,
      selected = false,
      onClick,
      showFullDescription = true,
      className,
      ...props
    },
    ref
  ) => {
    const handleClick = () => {
      onClick?.(charity);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      }
    };

    return (
      <div
        ref={ref}
        className={clsx(
          styles.card,
          selected && styles.selected,
          onClick && styles.clickable,
          className
        )}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        aria-pressed={onClick ? selected : undefined}
        {...props}
      >
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <h3 className={styles.name}>{charity.name}</h3>
            {selected && (
              <div className={styles.selectedBadge} aria-label="Selected">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <circle cx="10" cy="10" r="10" fill="currentColor" />
                  <path
                    d="M6 10L9 13L14 7"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            )}
          </div>
          <span className={styles.category}>
            {getCategoryDisplay(charity.category)}
          </span>
        </div>

        {showFullDescription && (
          <p className={styles.description}>{charity.description}</p>
        )}

        <div className={styles.footer}>
          <a
            href={charity.website}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.link}
            onClick={(e) => e.stopPropagation()}
          >
            Learn more
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M3 1H11V9M11 1L1 11"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        </div>
      </div>
    );
  }
);

CharityCard.displayName = 'CharityCard';
