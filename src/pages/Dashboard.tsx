import { useNavigate } from 'react-router-dom';
import { Breadcrumbs } from '../components/navigation/Breadcrumbs';
import { MetricCard } from '../components/dashboard/MetricCard';
import { RecentTransactions } from '../components/dashboard/RecentTransactions';
import { QuickActions, type QuickAction } from '../components/dashboard/QuickActions';
import { FinancialSummary } from '../components/dashboard/FinancialSummary';
import { CashPositionWidget } from '../components/dashboard/CashPositionWidget';
import { OverdueInvoicesWidget } from '../components/dashboard/OverdueInvoicesWidget';
import { RevenueExpensesChart } from '../components/dashboard/RevenueExpensesChart';
import { ResumeWidget } from '../components/dashboard/ResumeWidget';
import { useDashboardMetrics, useRecentTransactions } from '../hooks/useDashboardMetrics';
import { useCashPosition } from '../hooks/useCashPosition';
import { useOverdueInvoices } from '../hooks/useOverdueInvoices';
import { useRevenueExpensesData } from '../hooks/useRevenueExpensesData';
import { useRecentActivity } from '../hooks/useRecentActivity';
import { formatCurrency } from '../utils/metricsCalculation';
import { useAuth } from '../contexts/AuthContext';

export default function Dashboard() {
  const navigate = useNavigate();
  const { companyId } = useAuth();

  // Fallback to demo company ID if not authenticated (development only)
  const activeCompanyId = companyId || 'demo-company-id';

  // Fetch dashboard metrics
  const metrics = useDashboardMetrics({ companyId: activeCompanyId });
  const { transactions, isLoading: transactionsLoading } = useRecentTransactions(activeCompanyId, 10);

  // Fetch data for advanced widgets
  const { data: cashPositionData, isLoading: cashPositionLoading } = useCashPosition(activeCompanyId);
  const { invoices: overdueInvoices, isLoading: overdueInvoicesLoading } = useOverdueInvoices(activeCompanyId, 5);
  const { data: revenueExpensesData, isLoading: revenueExpensesLoading } = useRevenueExpensesData(activeCompanyId, 6);
  const { recentEdits, isLoading: recentActivityLoading } = useRecentActivity(activeCompanyId, 5);

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

        {/* Advanced Widgets Section */}
        <div style={{ marginTop: '2rem' }}>
          {/* Revenue vs Expenses Chart - Full Width */}
          <div style={{ marginBottom: '1.5rem' }}>
            <RevenueExpensesChart
              data={revenueExpensesData}
              isLoading={revenueExpensesLoading}
              period="Last 6 Months"
            />
          </div>

          {/* Two-Column Widget Grid */}
          <div
            style={{
              display: 'grid',
              gap: '1.5rem',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            }}
          >
            {/* Cash Position Widget */}
            <CashPositionWidget
              data={cashPositionData || { currentBalance: 0, monthlyExpenses: 0, trend: [] }}
              isLoading={cashPositionLoading}
            />

            {/* Overdue Invoices Widget */}
            <OverdueInvoicesWidget
              invoices={overdueInvoices}
              isLoading={overdueInvoicesLoading}
              onFollowUp={(invoiceId) => navigate(`/invoices/${invoiceId}`)}
            />
          </div>

          {/* Resume Widget - Full Width */}
          <div style={{ marginTop: '1.5rem' }}>
            <ResumeWidget
              recentEdits={recentEdits}
              onItemClick={(entityType, entityId) => {
                // Navigate to the appropriate page based on entity type
                const routeMap: Record<string, string> = {
                  transaction: '/transactions',
                  invoice: '/invoices',
                  customer: '/customers',
                  vendor: '/vendors',
                  account: '/accounts',
                };
                const basePath = routeMap[entityType] || '/dashboard';
                navigate(`${basePath}?id=${entityId}`);
              }}
              isLoading={recentActivityLoading}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
