/**
 * PinIcon Component
 *
 * A subtle push pin icon that indicates whether a tab is pinned or not.
 * - Unpinned: Gray outline
 * - Pinned: Gold/yellow filled
 */

import styles from './PinIcon.module.css';

interface PinIconProps {
  isPinned: boolean;
  onClick?: () => void;
  className?: string;
  size?: number;
  title?: string;
}

export function PinIcon({ isPinned, onClick, className = '', size = 16, title }: PinIconProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent tab switch when clicking pin
    onClick?.();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`${styles.pinButton} ${className}`}
      aria-label={isPinned ? 'Unpin this tab' : 'Pin this tab as default'}
      title={title || (isPinned ? 'Unpin this tab' : 'Pin this tab as default')}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${styles.pin} ${isPinned ? styles.pinned : styles.unpinned}`}
      >
        {/* Push pin shape */}
        <g transform="rotate(-45 12 12)">
          {/* Pin head (circular top) */}
          <ellipse
            cx="12"
            cy="8"
            rx="4"
            ry="2.5"
            className={styles.pinHead}
            stroke="currentColor"
            strokeWidth="1.5"
            fill={isPinned ? 'currentColor' : 'none'}
          />

          {/* Pin body (shaft) */}
          <rect
            x="10.5"
            y="8"
            width="3"
            height="6"
            className={styles.pinBody}
            stroke="currentColor"
            strokeWidth="1.5"
            fill={isPinned ? 'currentColor' : 'none'}
          />

          {/* Pin base (where it goes into the board) */}
          <path
            d="M 9 14 L 12 14 L 15 14 L 14 16 L 13 18 L 12 20 L 11 18 L 10 16 Z"
            className={styles.pinBase}
            stroke="currentColor"
            strokeWidth="1.5"
            fill={isPinned ? 'currentColor' : 'none'}
            strokeLinejoin="round"
          />

          {/* Pin point (sharp tip) */}
          <line
            x1="12"
            y1="20"
            x2="12"
            y2="22"
            className={styles.pinPoint}
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </g>
      </svg>
    </button>
  );
}
