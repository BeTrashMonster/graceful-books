import { useNavigate } from 'react-router-dom';
import { FinancialWebGraph } from '../components/cpg/FinancialWebGraph';
import { getEcosystemData } from '../services/ecosystemGraph.service';
import type { EcosystemNode } from '../services/ecosystemGraph.service';
import { MetricCard } from '../components/dashboard/MetricCard';
import { RecentTransactions } from '../components/dashboard/RecentTransactions';
import { CashPositionWidget } from '../components/dashboard/CashPositionWidget';
import { OverdueInvoicesWidget } from '../components/dashboard/OverdueInvoicesWidget';
import { RevenueExpensesChart } from '../components/dashboard/RevenueExpensesChart';
import { useDashboardMetrics, useRecentTransactions } from '../hooks/useDashboardMetrics';
import { useCashPosition } from '../hooks/useCashPosition';
import { useOverdueInvoices } from '../hooks/useOverdueInvoices';
import { useRevenueExpensesData } from '../hooks/useRevenueExpensesData';
import { formatCurrency } from '../utils/metricsCalculation';
import { useAuth } from '../contexts/AuthContext';
import styles from './Dashboard.module.css';

export default function Dashboard() {
  const navigate = useNavigate();
  const { companyId } = useAuth();

  // Fallback to demo company ID if not authenticated (development only)
  // IMPORTANT: Must match the fallback in ChartOfAccounts.tsx and other pages
  const activeCompanyId = companyId || 'demo-company';

  // Fetch dashboard metrics
  const metrics = useDashboardMetrics({ companyId: activeCompanyId });
  const { transactions, isLoading: transactionsLoading } = useRecentTransactions(activeCompanyId, 10);

  // Fetch data for advanced widgets
  const { data: cashPositionData, isLoading: cashPositionLoading } = useCashPosition(activeCompanyId);
  const { invoices: overdueInvoices, isLoading: overdueInvoicesLoading } = useOverdueInvoices(activeCompanyId, 5);
  const { data: revenueExpensesData, isLoading: revenueExpensesLoading } = useRevenueExpensesData(activeCompanyId, 6);

  // Get ecosystem graph data - both products active for now
  // TODO: Get actual product access from user subscription
  const ecosystemData = getEcosystemData({ bookkeeping: true, cpg: true });

  // Handle node clicks for navigation
  const handleNodeClick = (nodeId: string, nodeType: string) => {
    const node = ecosystemData.nodes.find(n => n.id === nodeId) as EcosystemNode | undefined;

    if (node?.route && node.isActive) {
      navigate(node.route);
    } else if (!node?.isActive) {
      // Could show upgrade prompt for inactive features
      console.log('Feature not active:', nodeId);
    }
  };

  // Handle connection clicks (optional - could show relationship info)
  const handleConnectionClick = (sourceId: string, targetId: string) => {
    console.log('Connection clicked:', sourceId, '->', targetId);
  };

  // Quick actions
  const quickActions = [
    { id: 'new-transaction', label: 'New Transaction', icon: '+', route: '/transactions', primary: true },
    { id: 'new-invoice', label: 'New Invoice', icon: '📄', route: '/invoices' },
    { id: 'reconcile', label: 'Reconcile', icon: '✓', route: '/reconciliation' },
    { id: 'view-reports', label: 'View Reports', icon: '📊', route: '/reports/profit-loss' },
    { id: 'cpg-tool', label: 'CPG Analytics', icon: '🌱', route: '/cpg' },
  ];

  return (
    <div className={styles.container}>
      {/* Main Layout: Graph + Quick Actions */}
      <div className={styles.mainLayout}>
        {/* Ecosystem Graph */}
        <div className={styles.graphContainer}>
          <div className={styles.graphContent}>
            <FinancialWebGraph
              nodes={ecosystemData.nodes}
              connections={ecosystemData.connections}
              onNodeClick={handleNodeClick}
              onConnectionClick={handleConnectionClick}
              width={900}
              height={500}
            />
          </div>
        </div>

        {/* Quick Actions Panel */}
        <div className={styles.actionsPanel}>
          <div className={styles.actionsPanelContent}>
            {quickActions.map(action => (
              <button
                key={action.id}
                className={`${styles.actionButton} ${action.primary ? styles.primary : ''}`}
                onClick={() => navigate(action.route)}
              >
                <span className={styles.actionIcon}>{action.icon}</span>
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className={styles.legend}>
        <h3>How to Navigate</h3>
        <div className={styles.legendGrid}>
          <div className={styles.legendItem}>
            <span className={styles.legendIconBookkeeping}>●</span>
            <div>
              <strong>Bookkeeping</strong>
              <p>Core accounting features. Click to navigate.</p>
            </div>
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendIconCPG}>●</span>
            <div>
              <strong>CPG Analytics</strong>
              <p>Cost per good and distribution analysis.</p>
            </div>
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendIconFuture}>●</span>
            <div>
              <strong>Coming Soon</strong>
              <p>Future features in development.</p>
            </div>
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendIconConnection}>━</span>
            <div>
              <strong>Connections</strong>
              <p>How features work together.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Financial Overview Section */}
      <div className={styles.metricsSection}>
        <div className={styles.metricsGrid}>
          <MetricCard
            title="Total Revenue"
            value={formatCurrency(metrics.revenue)}
            icon={<span>💰</span>}
            variant="default"
            isLoading={metrics.isLoading}
          />
          <MetricCard
            title="Total Expenses"
            value={formatCurrency(metrics.expenses)}
            icon={<span>💸</span>}
            variant="default"
            isLoading={metrics.isLoading}
          />
          <MetricCard
            title={metrics.isProfitable ? 'Net Profit' : 'Net Loss'}
            value={formatCurrency(metrics.netProfit)}
            icon={<span>{metrics.isProfitable ? '📈' : '📉'}</span>}
            variant={metrics.isProfitable ? 'success' : 'danger'}
            isLoading={metrics.isLoading}
          />
        </div>
      </div>

      {/* Revenue vs Expenses Chart */}
      <div className={styles.widgetSection} data-title="Revenue vs Expenses Trend">
        <div className={styles.widgetContent}>
          <RevenueExpensesChart
            data={revenueExpensesData}
            isLoading={revenueExpensesLoading}
            period="Last 6 Months"
          />
        </div>
      </div>

      {/* Two Column Widgets */}
      <div className={styles.twoColumnLayout}>
        {/* Cash Position */}
        <div className={styles.widgetSection} data-title="Cash Position">
          <div className={styles.widgetContent}>
            <CashPositionWidget
              data={cashPositionData || { currentBalance: 0, monthlyExpenses: 0, trend: [] }}
              isLoading={cashPositionLoading}
            />
          </div>
        </div>

        {/* Overdue Invoices */}
        <div className={styles.widgetSection} data-title="Overdue Invoices">
          <div className={styles.widgetContent}>
            <OverdueInvoicesWidget
              invoices={overdueInvoices}
              isLoading={overdueInvoicesLoading}
              onFollowUp={(invoiceId) => navigate(`/invoices/${invoiceId}`)}
            />
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className={styles.widgetSection} data-title="Recent Transactions">
        <div className={styles.widgetContent}>
          <RecentTransactions
            transactions={transactions}
            isLoading={transactionsLoading}
            limit={10}
            onViewAll={() => navigate('/transactions')}
          />
        </div>
      </div>
    </div>
  );
}
