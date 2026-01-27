/**
 * CPG Dashboard - Entry point for standalone CPG module
 * Includes Getting Started card for new users
 */

import { Link, useOutletContext } from 'react-router-dom';
import { Button } from '../../components/core/Button';
import { GettingStartedCard } from '../../components/cpg/GettingStartedCard';
import styles from './CPGDashboard.module.css';

interface CPGOutletContext {
  onAction?: (action: string) => void;
}

export default function CPGDashboard() {
  const context = useOutletContext<CPGOutletContext>();
  const onAction = context?.onAction || ((action: string) => console.log('Action:', action));

  return (
    <div className={styles.dashboard}>
      <header className={styles.header}>
        <h1>CPG Business Tools</h1>
        <p>Manage your cost per unit, distribution costs, and promotional decisions</p>
      </header>

      <GettingStartedCard onAction={onAction} />

      <div className={styles.grid}>
        <Link to="/cpg/cpu-tracker" className={styles.card}>
          <h2>📊 CPU Tracker</h2>
          <p>Track cost per unit across distributors and product variants</p>
        </Link>

        <Link to="/cpg/distribution-cost" className={styles.card}>
          <h2>🚚 Distribution Cost Analyzer</h2>
          <p>Calculate and analyze distribution costs by distributor</p>
        </Link>

        <Link to="/cpg/promo-decision" className={styles.card}>
          <h2>💰 Sales Promo Decision Tool</h2>
          <p>Analyze promotional effectiveness and make data-driven decisions</p>
        </Link>

        <Link to="/cpg/financial-entry" className={styles.card}>
          <h2>📝 Financial Statement Entry</h2>
          <p>Enter P&L and Balance Sheet data for your CPG business</p>
        </Link>

        <Link to="/cpg/analytics" className={styles.card}>
          <h2>📈 Historical Analytics</h2>
          <p>View trends and insights from your historical data</p>
        </Link>

        <Link to="/cpg/scenario-planning" className={styles.card}>
          <h2>🎯 Scenario Planning</h2>
          <p>Model what-if scenarios and compare outcomes</p>
        </Link>
      </div>

      <div className={styles.reports}>
        <h2>Reports</h2>
        <div className={styles.reportGrid}>
          <Link to="/cpg/reports/profit-loss" className={styles.reportCard}>CPG P&L Report</Link>
          <Link to="/cpg/reports/distribution-cost" className={styles.reportCard}>Distribution Cost Report</Link>
          <Link to="/cpg/reports/gross-margin" className={styles.reportCard}>Gross Margin Report</Link>
          <Link to="/cpg/reports/trade-spend" className={styles.reportCard}>Trade Spend Report</Link>
        </div>
      </div>
    </div>
  );
}
