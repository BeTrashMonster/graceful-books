import { HTMLAttributes, forwardRef } from 'react';
import type { Charity } from '../../types/database.types';
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

    // Use brand colors from charity or fallback to default
    const cardStyle: React.CSSProperties = {
      ...(charity.brandColorBackground && {
        background: `radial-gradient(circle at top, ${charity.brandColorBackground}dd 0%, ${charity.brandColorBackground} 100%)`
      })
    };

    // Custom border for Built Oregon (black outline)
    if (charity.name === 'Built Oregon') {
      cardStyle.border = '3px solid #000000';
    }

    // Custom gradient border for NAYA (dream catcher colors: black, red, yellow, white starting at 9 o'clock)
    if (charity.name === 'NAYA Family and Youth' || charity.name.includes('NAYA')) {
      cardStyle.border = '6px solid transparent';
      cardStyle.borderRadius = '50%';
      cardStyle.background = `
        radial-gradient(circle, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.9) 100%),
        conic-gradient(from 270deg, #000000 0deg 90deg, #DC143C 90deg 180deg, #FFD700 180deg 270deg, #FFFFFF 270deg 360deg)
      `;
      cardStyle.backgroundOrigin = 'padding-box, border-box';
      cardStyle.backgroundClip = 'padding-box, border-box';
    }

    // Custom button styles for Built Oregon and NAYA
    const isBuiltOrNAYA = charity.name === 'Built Oregon' || charity.name.includes('NAYA');
    const buttonStyle: React.CSSProperties | undefined = isBuiltOrNAYA ? {
      background: 'transparent',
      border: '2px solid #000000',
      color: '#000000',
    } : undefined;

    return (
      <div
        ref={ref}
        className={clsx(
          styles.card,
          selected && styles.selected,
          onClick && styles.clickable,
          !showFullDescription && styles.compact,
          className
        )}
        style={cardStyle}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        aria-pressed={onClick ? selected : undefined}
        {...props}
      >
        <div className={styles.titleRow}>
          <h3
            className={styles.name}
            style={charity.brandColorTitle ? { color: charity.brandColorTitle } : undefined}
          >
            {charity.name}
          </h3>
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

        {charity.shortDescription && (
          <p
            className={styles.description}
            style={charity.brandColorDescription ? { color: charity.brandColorDescription } : undefined}
          >
            {charity.shortDescription}
          </p>
        )}

        <div className={styles.footer}>
          <span className={styles.category}>{charity.category}</span>
          <a
            href={charity.website}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.link}
            style={buttonStyle}
            onClick={(e) => e.stopPropagation()}
          >
            Learn more
            <svg
              width="14"
              height="14"
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
