import { HTMLAttributes, forwardRef } from 'react';
import type { Charity } from '../../types/database.types';
import styles from './CharityBadge.module.css';
import clsx from 'clsx';

export interface CharityBadgeProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * The charity to display
   */
  charity: Charity;
  /**
   * Size variant
   */
  size?: 'sm' | 'md' | 'lg';
  /**
   * Whether to show the category
   */
  showCategory?: boolean;
}

/**
 * CharityBadge component displays a compact representation of a selected charity
 *
 * Features:
 * - Compact display for showing selected charity
 * - Multiple size variants
 * - Optional category display
 * - Accessible with proper ARIA labels
 *
 * @example
 * ```tsx
 * <CharityBadge charity={selectedCharity} size="md" showCategory />
 * ```
 */
export const CharityBadge = forwardRef<HTMLDivElement, CharityBadgeProps>(
  (
    {
      charity,
      size = 'md',
      showCategory = false,
      className,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={clsx(
          styles.badge,
          styles[size],
          className
        )}
        role="status"
        aria-label={`Supporting ${charity.name}`}
        {...props}
      >
        <div className={styles.icon}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M8 14C8 14 2 10 2 5.5C2 3.5 3.5 2 5.5 2C6.5 2 7.5 2.5 8 3.5C8.5 2.5 9.5 2 10.5 2C12.5 2 14 3.5 14 5.5C14 10 8 14 8 14Z"
              fill="currentColor"
            />
          </svg>
        </div>
        <div className={styles.content}>
          <span className={styles.label}>Supporting</span>
          <span className={styles.name}>{charity.name}</span>
          {showCategory && (
            <span className={styles.category}>
              {charity.category.toLowerCase().replace('_', ' ')}
            </span>
          )}
        </div>
      </div>
    );
  }
);

CharityBadge.displayName = 'CharityBadge';
