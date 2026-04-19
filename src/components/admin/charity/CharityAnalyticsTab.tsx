/**
 * Charity Analytics Tab
 *
 * Displays comprehensive analytics and impact metrics
 */

import type { ComprehensiveAnalytics, CharityAnalytics } from '../../../services/charities.api';
import styles from './CharityAnalyticsTab.module.css';

interface Props {
  analytics: ComprehensiveAnalytics;
  charities: CharityAnalytics[];
  onRefresh: () => void;
}

export function CharityAnalyticsTab({ analytics, charities }: Props) {
  const formatCurrency = (cents: number) => `$${(cents / 100).toLocaleString()}`;

  // Sort charities by lifetime total
  const sortedCharities = [...charities]
    .filter(c => c.lifetimeTotal > 0)
    .sort((a, b) => b.lifetimeTotal - a.lifetimeTotal)
    .slice(0, 10);

  return (
    <div className={styles.container}>
      {/* Summary Section */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Overview</h2>
        <div className={styles.grid}>
          <MetricCard
            label="Total Contributors"
            value={analytics.summary.totalContributors.toString()}
            icon="👥"
          />
          <MetricCard
            label="Pending Charities"
            value={analytics.summary.pendingCharities.toString()}
            icon="⏳"
            highlight={analytics.summary.pendingCharities > 0}
          />
        </div>
      </section>

      {/* Top Charities */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Top 10 Charities by Impact</h2>
        <div className={styles.table}>
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Charity</th>
                <th>Lifetime Total</th>
                <th>This Month</th>
                <th>Contributors</th>
                <th>Active Selections</th>
              </tr>
            </thead>
            <tbody>
              {sortedCharities.map((charity, index) => (
                <tr key={charity.id}>
                  <td className={styles.rank}>{index + 1}</td>
                  <td className={styles.charityName}>{charity.name}</td>
                  <td className={styles.amount}>{formatCurrency(charity.lifetimeTotal)}</td>
                  <td className={styles.amount}>{formatCurrency(charity.currentMonthTotal)}</td>
                  <td>{charity.lifetimeContributors}</td>
                  <td>{charity.activeUserSelections}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Monthly Trend */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Monthly Trend (Last 12 Months)</h2>
        <div className={styles.trendChart}>
          {analytics.monthlyTrend.map((month) => (
            <div key={month.month} className={styles.trendBar}>
              <div className={styles.trendLabel}>{month.month}</div>
              <div className={styles.trendAmount}>{formatCurrency(month.totalAmount)}</div>
              <div className={styles.trendContributors}>{month.contributorCount} users</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  icon: string;
  highlight?: boolean;
}

function MetricCard({ label, value, icon, highlight }: MetricCardProps) {
  return (
    <div className={`${styles.metricCard} ${highlight ? styles.metricCardHighlight : ''}`}>
      <div className={styles.metricIcon}>{icon}</div>
      <div>
        <div className={styles.metricLabel}>{label}</div>
        <div className={styles.metricValue}>{value}</div>
      </div>
    </div>
  );
}
