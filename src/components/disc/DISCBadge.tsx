/**
 * DISC Badge Component
 *
 * Displays a compact badge showing user's DISC type.
 * Can be used in user profiles, dashboards, etc.
 */

import type { DISCType } from '../../db/schema/discProfile.schema';
import { getDISCTypeDisplay } from '../../db/schema/discProfile.schema';

export interface DISCBadgeProps {
  type: DISCType;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  onClick?: () => void;
  className?: string;
}

export function DISCBadge({
  type,
  size = 'md',
  showLabel = true,
  onClick,
  className = '',
}: DISCBadgeProps) {
  const display = getDISCTypeDisplay(type);

  const badgeClasses = [
    'disc-badge',
    `disc-badge--${size}`,
    `disc-badge--${type.toLowerCase()}`,
    onClick ? 'disc-badge--clickable' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      <span className="disc-badge__letter" aria-hidden="true">
        {type}
      </span>
      {showLabel && (
        <span className="disc-badge__label">{display}</span>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={badgeClasses}
        onClick={onClick}
        aria-label={`DISC Type: ${display}`}
        data-testid="disc-badge"
      >
        {content}
      </button>
    );
  }

  return (
    <div
      className={badgeClasses}
      role="img"
      aria-label={`DISC Type: ${display}`}
      data-testid="disc-badge"
    >
      {content}
    </div>
  );
}

/**
 * DISC Badge Group Component
 *
 * Displays primary and optional secondary DISC types together.
 */

export interface DISCBadgeGroupProps {
  primaryType: DISCType;
  secondaryType?: DISCType | null;
  size?: 'sm' | 'md' | 'lg';
  showLabels?: boolean;
  onClick?: () => void;
  className?: string;
}

export function DISCBadgeGroup({
  primaryType,
  secondaryType,
  size = 'md',
  showLabels = true,
  onClick,
  className = '',
}: DISCBadgeGroupProps) {
  return (
    <div className={`disc-badge-group ${className}`} data-testid="disc-badge-group">
      <DISCBadge
        type={primaryType}
        size={size}
        showLabel={showLabels}
        onClick={onClick}
      />
      {secondaryType && (
        <>
          <span className="disc-badge-group__separator" aria-hidden="true">
            +
          </span>
          <DISCBadge
            type={secondaryType}
            size={size}
            showLabel={showLabels}
            onClick={onClick}
          />
        </>
      )}
    </div>
  );
}
