import { useNavigate } from 'react-router-dom';
import { Breadcrumbs } from '../components/navigation/Breadcrumbs';
import { MetricCard } from '../components/dashboard/MetricCard';
import { RecentTransactions } from '../components/dashboard/RecentTransactions';
import { QuickActions, type QuickAction } from '../components/dashboard/QuickActions';
import { FinancialSummary } from '../components/dashboard/FinancialSummary';
import { useDashboardMetrics, useRecentTransactions } from '../hooks/useDashboardMetrics';
import { formatCurrency } from '../utils/metricsCalculation';

export default function Dashboard() {
  const navigate = useNavigate();

  // TODO: Get actual company ID from auth context
  const companyId = 'demo-company-id';

  // Fetch dashboard metrics
  const metrics = useDashboardMetrics({ companyId });
  const { transactions, isLoading: transactionsLoading } = useRecentTransactions(companyId, 10);

  // Define quick actions
  const quickActions: QuickAction[] = [
    {
      id: 'new-transaction',
      label: 'New Transaction',
      icon: <span>+</span>,
      onClick: () => navigate('/transactions'),
      variant: 'primary',
    },
    {
      id: 'new-account',
      label: 'New Account',
      icon: <span>$</span>,
      onClick: () => navigate('/accounts'),
      variant: 'secondary',
    },
    {
      id: 'view-reports',
      label: 'View Reports',
      icon: <span>📊</span>,
      onClick: () => navigate('/reports'),
      variant: 'secondary',
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <span>⚙️</span>,
      onClick: () => navigate('/settings'),
      variant: 'secondary',
    },
  ];

  return (
    <div className="page">
      <Breadcrumbs />
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-description">
          Welcome to Graceful Books. Take your time with this. We'll guide you through everything, step by step.
        </p>
      </div>

      <div className="page-content">
        {/* Financial Metrics Grid */}
        <div
          style={{
            display: 'grid',
            gap: '1.5rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            marginBottom: '1.5rem',
          }}
        >
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

        {/* Two-Column Layout */}
        <div
          style={{
            display: 'grid',
            gap: '1.5rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          }}
        >
          {/* Left Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <FinancialSummary
              revenue={metrics.revenue}
              expenses={metrics.expenses}
              netProfit={metrics.netProfit}
              isProfitable={metrics.isProfitable}
              period="This Month"
              isLoading={metrics.isLoading}
            />

            <QuickActions actions={quickActions} />
          </div>

          {/* Right Column */}
          <div>
            <RecentTransactions
              transactions={transactions}
              isLoading={transactionsLoading}
              limit={10}
              onViewAll={() => navigate('/transactions')}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
