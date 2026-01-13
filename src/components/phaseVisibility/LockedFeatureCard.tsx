/**
 * LockedFeatureCard Component
 *
 * Displays a dimmed/locked feature card with information about when
 * the feature will become available. Uses Steadiness communication style.
 *
 * Requirements:
 * - PFD-001: Feature visibility rules by phase
 * - PFD-002: UI adaptation based on phase
 * - WCAG 2.1 AA: Accessible, keyboard navigable, proper contrast
 */

import type { FeatureId } from '../../features/phaseVisibility/types';
import { getFeatureMetadata, getPhaseDescription } from '../../features/phaseVisibility/visibilityRules';
import './LockedFeatureCard.css';

export interface LockedFeatureCardProps {
  /** Feature ID to display as locked */
  featureId: FeatureId;

  /** Whether to show a "curious" peek link */
  showPeek?: boolean;

  /** Callback when user wants to learn more */
  onLearnMore?: () => void;

  /** Custom message override */
  customMessage?: string;

  /** Additional CSS class */
  className?: string;

  /** Size variant */
  size?: 'small' | 'medium' | 'large';
}

/**
 * LockedFeatureCard - Shows a locked feature with encouraging messaging
 *
 * @example
 * ```tsx
 * <LockedFeatureCard
 *   featureId="invoicing"
 *   showPeek={true}
 *   onLearnMore={() => setShowInfoModal(true)}
 * />
 * ```
 */
export function LockedFeatureCard({
  featureId,
  showPeek = true,
  onLearnMore,
  customMessage,
  className = '',
  size = 'medium',
}: LockedFeatureCardProps) {
  const metadata = getFeatureMetadata(featureId);

  if (!metadata) {
    return null;
  }

  const phaseDescription = getPhaseDescription(metadata.availableInPhase);
  const phaseName = metadata.availableInPhase.charAt(0).toUpperCase() + metadata.availableInPhase.slice(1);

  const defaultMessage = customMessage || `This feature becomes available as you grow. It's part of the ${phaseName} phase: ${phaseDescription}`;

  return (
    <div
      className={`locked-feature-card locked-feature-card--${size} ${className}`}
      role="region"
      aria-label={`${metadata.name} - Coming Soon`}
    >
      <div className="locked-feature-card__icon-container">
        {metadata.icon && (
          <div className="locked-feature-card__icon" aria-hidden="true">
            {getIconDisplay(metadata.icon)}
          </div>
        )}
        <div className="locked-feature-card__lock" aria-label="Locked">
          🔒
        </div>
      </div>

      <div className="locked-feature-card__content">
        <h3 className="locked-feature-card__title">{metadata.name}</h3>
        <p className="locked-feature-card__description">{metadata.description}</p>

        <div className="locked-feature-card__unlock-info">
          <p className="locked-feature-card__message">{defaultMessage}</p>

          {showPeek && (
            <div className="locked-feature-card__peek">
              <p className="locked-feature-card__peek-text">
                Curious? Peek ahead!
              </p>
              {onLearnMore && (
                <button
                  type="button"
                  className="locked-feature-card__learn-more"
                  onClick={onLearnMore}
                  aria-label={`Learn more about ${metadata.name}`}
                >
                  Learn more →
                </button>
              )}
            </div>
          )}
        </div>

        <div className="locked-feature-card__phase-badge">
          <span className="locked-feature-card__phase-label">Available in:</span>
          <span className="locked-feature-card__phase-name">{phaseName}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Get icon display for feature
 * In a real implementation, this would map to actual icon components
 */
function getIconDisplay(icon: string): string {
  const iconMap: Record<string, string> = {
    dashboard: '📊',
    transaction: '💳',
    report: '📈',
    account: '🏦',
    help: '❓',
    category: '📁',
    tag: '🏷️',
    reconcile: '✓',
    chart: '📉',
    search: '🔍',
    filter: '⚙️',
    invoice: '📄',
    customer: '👥',
    inventory: '📦',
    product: '🛍️',
    recurring: '🔄',
    estimate: '📝',
    forecast: '🔮',
    analytics: '📊',
    integration: '🔌',
    api: '🔗',
    currency: '💱',
    'report-builder': '🛠️',
  };

  return iconMap[icon] || '✨';
}

/**
 * LockedFeatureList - Display multiple locked features in a list
 */
export interface LockedFeatureListProps {
  /** Array of feature IDs to show as locked */
  featureIds: FeatureId[];

  /** Title for the list */
  title?: string;

  /** Show peek links */
  showPeek?: boolean;

  /** Callback for learn more */
  onLearnMore?: (featureId: FeatureId) => void;

  /** Additional CSS class */
  className?: string;
}

/**
 * LockedFeatureList - Shows multiple locked features
 *
 * @example
 * ```tsx
 * <LockedFeatureList
 *   featureIds={['invoicing', 'customers', 'inventory']}
 *   title="Coming in Build Phase"
 *   showPeek={true}
 * />
 * ```
 */
export function LockedFeatureList({
  featureIds,
  title = 'Coming Soon',
  showPeek = false,
  onLearnMore,
  className = '',
}: LockedFeatureListProps) {
  if (featureIds.length === 0) {
    return null;
  }

  return (
    <div className={`locked-feature-list ${className}`}>
      <h2 className="locked-feature-list__title">{title}</h2>
      <div className="locked-feature-list__grid">
        {featureIds.map((featureId) => (
          <LockedFeatureCard
            key={featureId}
            featureId={featureId}
            size="small"
            showPeek={showPeek}
            onLearnMore={onLearnMore ? () => onLearnMore(featureId) : undefined}
          />
        ))}
      </div>
    </div>
  );
}
