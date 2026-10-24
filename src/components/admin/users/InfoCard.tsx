/**
 * InfoCard Component
 *
 * Reusable card for displaying labeled information.
 * Used in expanded panels and detail views.
 */

import styles from './InfoCard.module.css';

export interface InfoItem {
  label: string;
  value: React.ReactNode;
  copyable?: boolean;
}

interface InfoCardProps {
  title: string;
  items: InfoItem[];
  actions?: React.ReactNode;
  variant?: 'default' | 'compact';
}

export function InfoCard({ title, items, actions, variant = 'default' }: InfoCardProps) {
  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className={`${styles.card} ${styles[variant]}`}>
      <div className={styles.header}>
        <h3 className={styles.title}>{title}</h3>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
      <dl className={styles.list}>
        {items.map((item, index) => (
          <div key={index} className={styles.item}>
            <dt className={styles.label}>{item.label}</dt>
            <dd className={styles.value}>
              {item.value}
              {item.copyable && typeof item.value === 'string' && (
                <button
                  type="button"
                  className={styles.copyButton}
                  onClick={() => handleCopy(item.value as string)}
                  aria-label={`Copy ${item.label}`}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                  </svg>
                </button>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * InfoSection Component
 * Groups multiple InfoCards with a section title
 */
interface InfoSectionProps {
  title?: string;
  children: React.ReactNode;
}

export function InfoSection({ title, children }: InfoSectionProps) {
  return (
    <section className={styles.section}>
      {title && <h2 className={styles.sectionTitle}>{title}</h2>}
      <div className={styles.sectionContent}>{children}</div>
    </section>
  );
}

/**
 * InfoGrid Component
 * Layout container for multiple InfoCards in a grid
 */
interface InfoGridProps {
  columns?: 1 | 2 | 3 | 4;
  children: React.ReactNode;
}

export function InfoGrid({ columns = 2, children }: InfoGridProps) {
  return (
    <div
      className={styles.grid}
      style={{ '--columns': columns } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

/**
 * QuickStat Component
 * Compact stat display for dashboards
 */
interface QuickStatProps {
  label: string;
  value: string | number;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}

export function QuickStat({ label, value, trend, trendValue }: QuickStatProps) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{value}</span>
      {trend && trendValue && (
        <span className={`${styles.statTrend} ${styles[trend]}`}>
          {trend === 'up' && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
              <polyline points="17 6 23 6 23 12" />
            </svg>
          )}
          {trend === 'down' && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
              <polyline points="17 18 23 18 23 12" />
            </svg>
          )}
          {trendValue}
        </span>
      )}
    </div>
  );
}
